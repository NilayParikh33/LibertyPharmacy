import { NextResponse } from "next/server";
import { z } from "zod";
import { loginPatient, createSession } from "@/lib/auth";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

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

  const result = loginPatient(parsed.data.email, parsed.data.password, ip);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await createSession(result.accountId);
  return NextResponse.json({ ok: true });
}
