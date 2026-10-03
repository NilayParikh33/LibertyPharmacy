import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAccountId } from "@/lib/auth";
import { getPatientIdForAccount } from "@/lib/rx-requests";
import { linkDrxPatient } from "@/lib/drx-link";
import { getClientIp } from "@/lib/request";
import { createRateLimiter } from "@/lib/rate-limit";

/**
 * A signed-in patient links their account to their pharmacy record by giving
 * one Rx number from a label. Their date of birth and name come from their
 * profile (src/lib/drx-link.ts explains the checks and why the Rx number alone
 * is not enough).
 *
 * Tight limits, because each try is a guess at someone's Rx number: 5 per
 * account and 20 per address per hour. Failures all get the same answer, so
 * the response never reveals whether an Rx number exists.
 */

const schema = z.object({
  rxNumber: z
    .string()
    .trim()
    .regex(/^\d{1,10}$/, "Enter the Rx number exactly as printed on your label (digits only)")
    .refine((v) => Number(v) > 0, "Enter the Rx number exactly as printed on your label (digits only)"),
});

const ipLimiter = createRateLimiter({ limit: 20, windowMs: 60 * 60 * 1000 });
const accountLimiter = createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 });

const NO_MATCH =
  "We couldn't match that to your pharmacy record. Check the Rx number on your label. The date of birth on this account also has to be exactly the one the pharmacy has for you. If it still doesn't work, please call us.";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (ipLimiter.hit(ip)) {
    return NextResponse.json({ error: "Too many attempts. Please try again later or call the pharmacy." }, { status: 429 });
  }
  const accountId = await getSessionAccountId();
  if (!accountId) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }
  if (accountLimiter.hit(`account:${accountId}`)) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again in an hour, or call the pharmacy and we'll link it for you." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the Rx number." }, { status: 400 });
  }

  const patientId = await getPatientIdForAccount(accountId);
  if (!patientId) {
    return NextResponse.json({ error: "We couldn't find your patient record. Please call the pharmacy." }, { status: 404 });
  }

  const result = await linkDrxPatient(patientId, parsed.data.rxNumber, `account:${accountId}`);
  switch (result) {
    case "linked":
    case "already_linked":
      accountLimiter.reset(`account:${accountId}`);
      return NextResponse.json({ ok: true });
    case "no_match":
      return NextResponse.json({ error: NO_MATCH }, { status: 422 });
    case "disabled":
      return NextResponse.json({ error: "This isn't available yet. Please call the pharmacy." }, { status: 503 });
    default:
      return NextResponse.json(
        { error: "We couldn't reach the pharmacy system just now. Please try again in a few minutes." },
        { status: 502 }
      );
  }
}
