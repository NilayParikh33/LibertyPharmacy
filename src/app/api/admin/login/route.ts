import { NextResponse } from "next/server";
import { z } from "zod";
import {
  verifyAdminCredentials,
  verifyAdminTotp,
  isAdminMfaConfigured,
  createAdminSession,
  isLoginLocked,
  recordLoginFailure,
  clearLoginFailures,
} from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
  // Authenticator apps emit exactly 6 digits; strip spaces some apps display.
  token: z.string().trim().transform((v) => v.replace(/\s/g, "")).pipe(z.string().regex(/^\d{6}$/)),
});

// Deliberately identical whichever factor failed. Naming the failed factor
// would tell an attacker when they had guessed the password correctly.
const INVALID = "Invalid username, password, or authentication code.";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (isLoginLocked(ip)) {
    return NextResponse.json({ error: "Too many failed attempts. Please try again in a few minutes." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: INVALID }, { status: 400 });
  }

  if (!verifyAdminCredentials(parsed.data.username, parsed.data.password)) {
    recordLoginFailure(ip);
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }

  // Only reachable once the password is correct, so this reports a real
  // deployment problem to the operator without telling an anonymous attacker
  // anything about how the admin panel is configured.
  if (!isAdminMfaConfigured() && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Admin MFA is not configured on this server. Set ADMIN_TOTP_SECRET and redeploy." },
      { status: 503 },
    );
  }

  if (!verifyAdminTotp(parsed.data.token)) {
    recordLoginFailure(ip);
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }

  clearLoginFailures(ip);
  await createAdminSession();
  return NextResponse.json({ ok: true });
}
