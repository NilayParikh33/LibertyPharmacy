import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { createInvite } from "@/lib/admin-staff";
import { getDb } from "@/lib/db";
import { getAppBaseUrl, getClientIp } from "@/lib/request";
import { parseId } from "@/lib/ids";

/**
 * New setup link for an existing staff member (lost phone / forgotten
 * password). Completing it replaces their password and authenticator; until
 * then their current login keeps working.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const db = await getDb();
  const user = await db.prepare("SELECT username FROM admin_users WHERE id = ?").get<{ username: string }>(id);
  if (!user) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
  const r = await createInvite(user.username, admin.username, getAppBaseUrl(request), true, getClientIp(request));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r);
}
