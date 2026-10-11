import { NextResponse } from "next/server";
import { getSessionAccountId } from "@/lib/auth";
import { removeTotp } from "@/lib/device-auth";
import { notInDeviceMode, respond } from "@/lib/device-route";
import { getClientIp } from "@/lib/request";

export async function POST(request: Request) {
  const off = notInDeviceMode();
  if (off) return off;
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  return respond(await removeTotp(accountId, getClientIp(request)));
}
