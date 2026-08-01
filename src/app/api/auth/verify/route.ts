import { NextResponse } from "next/server";
import { z } from "zod";
import { completeMfaChallenge } from "@/lib/auth";

/** Confirms the emailed 6-digit code; activates the account and/or grants the session. */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the 6-digit code from your email." }, { status: 400 });
  }

  const result = await completeMfaChallenge(parsed.data.code, ip);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, purpose: result.purpose });
}
