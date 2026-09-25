import { NextResponse, after } from "next/server";
import { z } from "zod";
import { requestPasswordReset } from "@/lib/auth";
import { getClientIp, getAppBaseUrl } from "@/lib/request";
import { createRateLimiter } from "@/lib/rate-limit";

/**
 * Request a password reset link.
 *
 * Always responds 200 with the same body whether or not the address is
 * registered — revealing which emails have accounts would leak the patient
 * roster of a pharmacy, which is itself sensitive.
 */

// Max 5 reset requests per 15 min per IP — limits mail-bombing a known address.
const limiter = createRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const generic = NextResponse.json({
    ok: true,
    message: "If an account exists for that email, we've sent a reset link.",
  });

  if (limiter.hit(ip)) {
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

  // Done after the response is sent. Only a registered email does real work
  // here (token insert + sending mail), so doing it inline made registered
  // addresses measurably slower to answer — a timing oracle for the patient
  // roster (SEC-002). Failures are swallowed for the same reason.
  const base = getAppBaseUrl(request);
  const email = parsed.data.email;
  after(() => requestPasswordReset(email, base, ip).catch(() => {}));
  return generic;
}
