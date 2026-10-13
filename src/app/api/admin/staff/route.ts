import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { createInvite, USERNAME_RE } from "@/lib/admin-staff";
import { getAppBaseUrl, getClientIp } from "@/lib/request";

const schema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(USERNAME_RE, "3–40 characters: lowercase letters, numbers, dots, dashes or underscores"),
});

/** Adds a staff member: returns a one-time setup link (shown once). */
export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the username." }, { status: 400 });
  const r = await createInvite(parsed.data.username, admin.username, getAppBaseUrl(request), false, getClientIp(request));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r);
}
