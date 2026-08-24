import { NextResponse } from "next/server";
import { z } from "zod";
import { requestPasswordReset } from "@/lib/auth";
import { getClientIp } from "@/lib/request";

/**
 * Request a password reset link.
 *
 * Always responds 200 with the same body whether or not the address is
 * registered — revealing which emails have accounts would leak the patient
 * roster of a pharmacy, which is itself sensitive.
 */

// Max 5 reset requests per 15 min per IP — limits mail-bombing a known address.
const attempts = new Map<string, { count: number; resetAt: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  for (const [key, slot] of attempts) {
    if (slot.resetAt < now) attempts.delete(key);
  }
  const slot = attempts.get(ip);
  if (!slot || slot.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  slot.count += 1;
  return slot.count > 5;
}

/** Base URL for the emailed link: configured origin, else this request's own. */
function baseUrl(request: Request): string {
  const configured = process.env.APP_BASE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const generic = NextResponse.json({
    ok: true,
    message: "If an account exists for that email, we've sent a reset link.",
  });

  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many reset requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = z.object({ email: z.string().trim().email().max(254) }).safeParse(body);
  // Even a malformed email gets the generic response — no signal either way.
  if (!parsed.success) return generic;

  try {
    await requestPasswordReset(parsed.data.email, baseUrl(request), ip);
  } catch {
    // Mail transport failures must not reveal whether the account existed.
    return generic;
  }
  return generic;
}
