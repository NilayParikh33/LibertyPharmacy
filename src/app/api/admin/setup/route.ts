import { NextResponse } from "next/server";
import { z } from "zod";
import { completeInvite } from "@/lib/admin-staff";
import { newPasswordSchema } from "@/lib/device-route";
import { getClientIp } from "@/lib/request";
import { createRateLimiter } from "@/lib/rate-limit";

/** Completes a staff setup link: own password + authenticator (no admin session needed). */
const schema = z.object({
  token: z.string().min(20).max(200),
  password: newPasswordSchema,
  code: z.string().trim().transform((v) => v.replace(/\s/g, "")).pipe(z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your app")),
});

const limiter = createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 });

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (limiter.hit(ip)) return NextResponse.json({ error: "Too many attempts. Please try again in a few minutes." }, { status: 429 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the form." }, { status: 400 });
  const r = await completeInvite(parsed.data.token, parsed.data.password, parsed.data.code, ip);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, username: r.username });
}
