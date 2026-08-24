import { NextResponse } from "next/server";
import { z } from "zod";
import {
  verifyAdminCredentials,
  createAdminSession,
  isLoginLocked,
  recordLoginFailure,
  clearLoginFailures,
} from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
});

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
    return NextResponse.json({ error: "Invalid username or password." }, { status: 400 });
  }

  if (!verifyAdminCredentials(parsed.data.username, parsed.data.password)) {
    recordLoginFailure(ip);
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  clearLoginFailures(ip);
  await createAdminSession();
  return NextResponse.json({ ok: true });
}
