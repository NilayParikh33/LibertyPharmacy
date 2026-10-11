import { NextResponse } from "next/server";
import { getSessionAccountId } from "@/lib/auth";
import { getFactors, listPasskeys } from "@/lib/device-auth";
import { notInDeviceMode } from "@/lib/device-route";

/** The signed-in patient's passkeys, authenticator and recovery codes left. */
export async function GET() {
  const off = notInDeviceMode();
  if (off) return off;
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  return NextResponse.json({ ...(await getFactors(accountId)), passkeyList: await listPasskeys(accountId) });
}
