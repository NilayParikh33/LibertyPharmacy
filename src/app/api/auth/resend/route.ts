import { NextResponse } from "next/server";
import { resendMfaCode } from "@/lib/auth";
import { getClientIp } from "@/lib/request";

// Simple in-memory throttle: one resend per pending challenge per 30s window.
const lastResend = new Map<string, number>();

/** Re-sends the code for the browser's pending verification challenge. */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const now = Date.now();
  if ((lastResend.get(ip) ?? 0) > now - 30_000) {
    return NextResponse.json({ error: "Please wait a moment before requesting another code." }, { status: 429 });
  }
  lastResend.set(ip, now);

  const result = await resendMfaCode();
  if (!result.ok) {
    return NextResponse.json(
      { error: "No pending verification found. Please sign in again." },
      { status: 401 }
    );
  }
  return NextResponse.json({ ok: true });
}
