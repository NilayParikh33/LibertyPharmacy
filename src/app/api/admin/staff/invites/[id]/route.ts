import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { cancelInvite } from "@/lib/admin-staff";
import { getClientIp } from "@/lib/request";
import { parseId } from "@/lib/ids";

/** Cancels an unused setup link. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!(await cancelInvite(id, admin.username, getClientIp(request)))) {
    return NextResponse.json({ error: "Link not found or already used." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
