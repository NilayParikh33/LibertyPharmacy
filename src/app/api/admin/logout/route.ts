import { NextResponse } from "next/server";
import { getCurrentAdmin, destroyAdminSession } from "@/lib/admin-auth";
import { audit } from "@/lib/db";
import { getClientIp } from "@/lib/request";

export async function POST(request: Request) {
  // Read the identity before the session row is deleted, so the audit entry
  // can name who signed out rather than logging an anonymous event.
  const admin = await getCurrentAdmin();
  await destroyAdminSession();
  if (admin) {
    await audit({
      actor: `admin:${admin.username}`,
      action: "admin.logout",
      subject: `admin:${admin.id}`,
      outcome: "success",
      ip: getClientIp(request),
    });
  }
  return NextResponse.json({ ok: true });
}
