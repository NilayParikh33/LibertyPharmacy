import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionAccountId } from "@/lib/auth";
import { removePasskey } from "@/lib/device-auth";
import { notInDeviceMode, readJson, respond } from "@/lib/device-route";
import { getClientIp } from "@/lib/request";

export async function POST(request: Request) {
  const off = notInDeviceMode();
  if (off) return off;
  const accountId = await getSessionAccountId();
  if (!accountId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const parsed = z.object({ id: z.number().int().positive() }).safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  return respond(await removePasskey(accountId, parsed.data.id, getClientIp(request)));
}
