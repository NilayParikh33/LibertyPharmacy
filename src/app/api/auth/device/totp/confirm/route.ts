import { NextResponse } from "next/server";
import { z } from "zod";
import { totpConfirm } from "@/lib/device-auth";
import { notInDeviceMode, readJson, respond } from "@/lib/device-route";
import { getClientIp } from "@/lib/request";

/** Confirms the app shows the right code, then saves it to the account. */
export async function POST(request: Request) {
  const off = notInDeviceMode();
  if (off) return off;
  const parsed = z.object({ code: z.string().trim().regex(/^\d{6}$/) }).safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Enter the 6-digit code from your app." }, { status: 400 });
  return respond(await totpConfirm(parsed.data.code, getClientIp(request)));
}
