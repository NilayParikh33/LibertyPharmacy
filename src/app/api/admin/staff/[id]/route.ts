import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { setStaffDisabled } from "@/lib/admin-staff";
import { getClientIp } from "@/lib/request";
import { parseId } from "@/lib/ids";

/** Disables (signs out everywhere) or re-enables a staff account. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "Not found." }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = z.object({ disabled: z.boolean() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  const r = await setStaffDisabled(id, parsed.data.disabled, admin, getClientIp(request));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}
