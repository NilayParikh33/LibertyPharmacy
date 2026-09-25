import { NextResponse } from "next/server";
import { resendMfaCode } from "@/lib/auth";
import { getClientIp } from "@/lib/request";
import { createRateLimiter } from "@/lib/rate-limit";

// One resend per client per 30s window.
const limiter = createRateLimiter({ limit: 1, windowMs: 30_000 });

/** Re-sends the code for the browser's pending verification challenge. */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (limiter.hit(ip)) {
    return NextResponse.json({ error: "Please wait a moment before requesting another code." }, { status: 429 });
  }

  const result = await resendMfaCode();
  if (!result.ok) {
    return NextResponse.json(
      { error: "No pending verification found. Please sign in again." },
      { status: 401 }
    );
  }
  // demoCode is present only under DEMO_SHOW_OTP_ON_SCREEN (see startMfaChallenge).
  return NextResponse.json({ ok: true, ...(result.demoCode ? { demoCode: result.demoCode } : {}) });
}
