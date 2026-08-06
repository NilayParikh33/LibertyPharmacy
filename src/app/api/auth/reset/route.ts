import { NextResponse } from "next/server";
import { z } from "zod";
import { resetPassword } from "@/lib/auth";
import { getClientIp } from "@/lib/request";

/**
 * Complete a password reset.
 *
 * Password rules mirror registration. On success all of the account's sessions
 * are revoked (handled in resetPassword) and the user must sign in again —
 * which also means passing MFA, so a stolen reset link alone cannot yield a
 * logged-in session.
 */
const resetSchema = z.object({
  token: z.string().min(10).max(200),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .max(128)
    .regex(/[a-z]/, "Include a lowercase letter")
    .regex(/[A-Z]/, "Include an uppercase letter")
    .regex(/[0-9]/, "Include a number"),
});

export async function POST(request: Request) {
  const ip = getClientIp(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Please check the form." }, { status: 400 });
  }

  const result = await resetPassword(parsed.data.token, parsed.data.password, ip);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
