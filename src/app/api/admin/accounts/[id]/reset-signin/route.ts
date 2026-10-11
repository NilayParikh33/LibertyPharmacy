import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request";
import { parseId } from "@/lib/ids";
import { staffResetSignIn } from "@/lib/device-auth";

/**
 * Staff reset of a patient's sign-in (src/lib/device-auth.ts): removes their
 * passkeys, authenticator app and recovery codes, signs them out everywhere,
 * and returns a one-time temporary password — shown to staff once, never
 * stored in plain text, for reading to the patient after checking who they are.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const accountId = parseId((await params).id);
  if (accountId === null) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const temporaryPassword = await staffResetSignIn(accountId, admin.username, getClientIp(request));
  if (!temporaryPassword) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, temporaryPassword });
}
