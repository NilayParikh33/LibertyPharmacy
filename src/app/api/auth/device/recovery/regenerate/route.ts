import { NextResponse } from "next/server";
import { getSessionAccountId } from "@/lib/auth";
import { issueRecoveryCodes } from "@/lib/device-auth";
import { notInDeviceMode } from "@/lib/device-route";

/** New recovery codes for the signed-in patient; the old ones stop working. */
export async function POST() {
  const off = notInDeviceMode();
  if (off) return off;
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  return NextResponse.json({ ok: true, recoveryCodes: await issueRecoveryCodes(accountId) });
}
