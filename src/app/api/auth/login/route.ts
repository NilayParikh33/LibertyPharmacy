import { NextResponse } from "next/server";
import { z } from "zod";
import { loginPatient, startMfaChallenge } from "@/lib/auth";
import { getClientIp } from "@/lib/request";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    // Generic message — never hint at which field failed on a login form.
    return NextResponse.json({ error: "Invalid email or password." }, { status: 400 });
  }

  const result = await loginPatient(parsed.data.email, parsed.data.password, ip);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // Password alone never grants a session. Unverified accounts must first
  // activate via the emailed code; verified accounts get a login MFA code.
  const purpose = result.emailVerified ? "login_mfa" : "email_verify";
  // demoCode is non-null only under DEMO_SHOW_OTP_ON_SCREEN (see startMfaChallenge).
  const demoCode = await startMfaChallenge(result.accountId, result.email, purpose);
  return NextResponse.json({ ok: true, next: "verify", purpose, ...(demoCode ? { demoCode } : {}) });
}
