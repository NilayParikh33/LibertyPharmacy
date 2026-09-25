import { NextResponse, after } from "next/server";
import { z } from "zod";
import { registerPatient, startMfaChallenge, startDecoyChallenge } from "@/lib/auth";
import { sendAccountExistsEmail } from "@/lib/mail";
import { getClientIp, getAppBaseUrl } from "@/lib/request";
import { createRateLimiter } from "@/lib/rate-limit";

/**
 * Patient registration.
 *
 * Collects the DRX-aligned patient record (see src/lib/db.ts for the column
 * mapping). All PHI is encrypted before it reaches disk. Responses and server
 * logs never echo submitted values back.
 */

const US_STATES = /^(A[LKZR]|C[AOT]|D[EC]|FL|GA|HI|I[DLNA]|K[SY]|LA|M[EDAINSOT]|N[EVHJMYCD]|O[HKR]|PA|RI|S[CD]|T[NX]|UT|V[TA]|W[AVIY])$/i;

const registrationSchema = z.object({
  // Account
  email: z.string().trim().email("A valid email is required").max(254),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .max(128)
    .regex(/[a-z]/, "Include a lowercase letter")
    .regex(/[A-Z]/, "Include an uppercase letter")
    .regex(/[0-9]/, "Include a number"),
  // Identity — DRX: FirstName / MI / LastName / DOB / Sex
  firstName: z.string().trim().min(1, "First name is required").max(100),
  middleInitial: z.string().trim().max(1).optional().or(z.literal("")),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth is required")
    .refine((d) => {
      const dob = new Date(d + "T00:00:00Z");
      const now = new Date();
      return dob < now && dob > new Date("1900-01-01");
    }, "Enter a valid date of birth"),
  gender: z.enum(["M", "F", "O", "U"]),
  // Address — DRX: Address1/2, City, State, Zip
  address1: z.string().trim().min(1, "Street address is required").max(200),
  address2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().min(1, "City is required").max(100),
  state: z.string().trim().regex(US_STATES, "Enter a 2-letter state code"),
  zip: z.string().trim().regex(/^\d{5}(-\d{4})?$/, "Enter a valid ZIP code"),
  // Contact — DRX: Phone / CellPhone / Email / Language
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  cellPhone: z.string().trim().regex(/^[\d\s().+-]{10,20}$/, "Enter a valid mobile phone"),
  preferredLanguage: z.enum(["English", "Spanish", "Vietnamese", "Mandarin", "Other"]),
  // Clinical — DRX: Allergies / Diseases
  allergies: z.string().trim().max(500).optional().or(z.literal("")),
  medicalConditions: z.string().trim().max(500).optional().or(z.literal("")),
  // Insurance — DRX: InsBIN / InsPCN / InsGroup / InsID / PersonCode / Relationship
  insBin: z.string().trim().regex(/^\d{6}$/, "BIN is 6 digits").optional().or(z.literal("")),
  insPcn: z.string().trim().max(20).optional().or(z.literal("")),
  insGroup: z.string().trim().max(30).optional().or(z.literal("")),
  insCardholderId: z.string().trim().max(30).optional().or(z.literal("")),
  insPersonCode: z.string().trim().max(3).optional().or(z.literal("")),
  insRelationship: z.enum(["1", "2", "3", "4"]).optional().or(z.literal("")),
  // Preferences — DRX: DeliveryMethod / SMSOptIn
  deliveryMethod: z.enum(["pickup", "delivery", "mail"]),
  smsOptIn: z.boolean().default(false),
  // Consent
  hipaaAcknowledged: z.literal(true, {
    errorMap: () => ({ message: "You must acknowledge the Notice of Privacy Practices" }),
  }),
});

// Max 5 registration attempts / 10 min / IP.
const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (limiter.hit(ip)) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? "Please check the form and try again.", field: first?.path?.[0] },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const result = await registerPatient(
    {
      ...d,
      middleInitial: d.middleInitial || undefined,
      address2: d.address2 || undefined,
      phone: d.phone || undefined,
      allergies: d.allergies || undefined,
      medicalConditions: d.medicalConditions || undefined,
      insBin: d.insBin || undefined,
      insPcn: d.insPcn || undefined,
      insGroup: d.insGroup || undefined,
      insCardholderId: d.insCardholderId || undefined,
      insPersonCode: d.insPersonCode || undefined,
      insRelationship: d.insRelationship || undefined,
    },
    ip
  );

  if (!result.ok) {
    // Email already registered. Answer exactly as for a new signup — same
    // body, same pending cookie (a decoy that can never complete) — so this
    // endpoint can't be used to test which emails are patients here (SEC-002).
    // The real owner is emailed a notice instead of a code, after the
    // response so mail latency isn't observable either.
    await startDecoyChallenge();
    const base = getAppBaseUrl(request);
    const email = d.email.trim().toLowerCase();
    after(() => sendAccountExistsEmail(email, `${base}/portal/login`, `${base}/portal/forgot`).catch(() => {}));
    return NextResponse.json({ ok: true, next: "verify" });
  }

  // Account exists but is NOT active until the emailed code is confirmed.
  // demoCode is non-null only under DEMO_SHOW_OTP_ON_SCREEN (see startMfaChallenge)
  // and is returned to the browser so a demo can be completed without email.
  const demoCode = await startMfaChallenge(result.accountId, d.email.trim().toLowerCase(), "email_verify");
  return NextResponse.json({ ok: true, next: "verify", ...(demoCode ? { demoCode } : {}) });
}
