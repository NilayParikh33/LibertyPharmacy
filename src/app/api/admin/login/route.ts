import { NextResponse } from "next/server";
import { z } from "zod";
import {
  verifyAdminLogin,
  createAdminSession,
  isLoginLocked,
  recordLoginFailure,
  clearLoginFailures,
} from "@/lib/admin-auth";
import { audit } from "@/lib/db";
import { getClientIp } from "@/lib/request";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
  // Authenticator apps emit exactly 6 digits; strip spaces some apps display.
  token: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{6}$/)),
});

// Deliberately identical whichever factor failed. Naming the failed factor
// would tell an attacker when they had guessed the password correctly.
const INVALID = "Invalid username, password, or authentication code.";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (isLoginLocked(ip)) {
    return NextResponse.json(
      { error: "Too many failed attempts. Please try again in a few minutes." },
      { status: 429 }
    );
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

  const admin = await verifyAdminLogin(parsed.data.username, parsed.data.password, parsed.data.token);
  if (!admin) {
    recordLoginFailure(ip);
    // The attempted username is recorded, never the password or code.
    await audit({
      actor: `admin:${parsed.data.username}`,
      action: "admin.login",
      outcome: "failure",
      ip,
    });
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }

  clearLoginFailures(ip);
  await createAdminSession(admin.id);
  await audit({
    actor: `admin:${admin.username}`,
    action: "admin.login",
    subject: `admin:${admin.id}`,
    outcome: "success",
    ip,
  });
  return NextResponse.json({ ok: true });
}
