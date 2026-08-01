import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Contact form endpoint — HIPAA-conscious by design.
 *
 * Current behavior (pre-integration):
 *  - Validates the payload server-side.
 *  - Screens the free-text message for obvious PHI patterns and rejects
 *    submissions that appear to contain health information (defense in
 *    depth — the UI also warns users not to send PHI).
 *  - Does NOT store, log, or forward the submission anywhere. There is no
 *    database and no email provider configured, so nothing persists.
 *
 * Before enabling delivery:
 *  1. Choose a HIPAA-eligible email/CRM provider and sign a BAA, OR keep the
 *     no-PHI policy and use any provider for general inquiries only.
 *  2. Wire the provider below where indicated. Never console.log form
 *     contents — server logs are a common accidental PHI repository.
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

  // -------------------------------------------------------------------------
  // TODO(delivery): forward parsed.data via a BAA-covered channel.
  // Until then we intentionally do nothing with the data — no storage, no
  // logging — so this endpoint cannot become an accidental PHI repository.
  // -------------------------------------------------------------------------

  return NextResponse.json({ ok: true });
}
