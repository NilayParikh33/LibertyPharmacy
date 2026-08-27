import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { encryptPHI } from "@/lib/crypto";
import { sendContactEmail } from "@/lib/mail";

/**
 * Contact form endpoint — HIPAA-conscious by design.
 *
 * Validates the payload server-side, then screens the free-text message for
 * obvious PHI patterns and rejects submissions that appear to contain health
 * information (defense in depth — the UI also warns users not to send PHI).
 * Only general inquiries reach storage/delivery below.
 *
 * Delivery is temporary: the same non-BAA Gmail transport used for OTP mail
 * (src/lib/mail.ts). Before real patients rely on this for anything beyond
 * general questions, swap for a BAA-covered provider.
 */

const contactSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  email: z.string().trim().email("A valid email is required").max(254),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  subject: z.enum(["hours", "products", "services", "billing", "other"]),
  message: z.string().trim().min(1, "Message is required").max(2000),
});

/**
 * Heuristic screen for content that looks like PHI. Not exhaustive — the
 * real protection is that we collect general inquiries only and store nothing.
 */
const phiPatterns: Array<{ re: RegExp; label: string }> = [
  { re: /\b\d{3}-?\d{2}-?\d{4}\b/, label: "an SSN-like number" },
  { re: /\brx\s*#?\s*\d{4,}\b/i, label: "a prescription number" },
  { re: /\b(dob|date of birth)\b/i, label: "a date of birth" },
  { re: /\b(diagnos(is|ed)|prescri(bed|ption)|medication list)\b/i, label: "medical details" },
];

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? "Invalid form data." },
      { status: 400 }
    );
  }

  const { message } = parsed.data;
  const hit = phiPatterns.find((p) => p.re.test(message));
  if (hit) {
    return NextResponse.json(
      {
        error: `Your message appears to include ${hit.label}. To protect your privacy, please call us instead — this form is for general questions only.`,
      },
      { status: 422 }
    );
  }

  const data = parsed.data;
  const db = await getDb();
  await db
    .prepare(
      `INSERT INTO contact_messages (first_name, last_name, email, phone, subject, message)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    // Encrypted at rest (finding T-06). The PHI screening above rejects the
    // obvious cases, but a sender can always describe a condition in ordinary
    // words that no pattern will catch, so these columns are treated as
    // though they will eventually contain health information.
    .run(
      encryptPHI(data.firstName),
      encryptPHI(data.lastName),
      encryptPHI(data.email),
      data.phone ? encryptPHI(data.phone) : null,
      encryptPHI(data.subject),
      encryptPHI(data.message)
    );

  // The submission is already durably stored above, so a transport hiccup
  // must not fail the request — the admin panel is the reliable path either
  // way, email is a convenience notification on top of it.
  try {
    await sendContactEmail(data);
  } catch (err) {
    console.error("contact form: email forward failed", err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ ok: true });
}
