import { NextResponse } from "next/server";
import { z } from "zod";
import { setNewPassword } from "@/lib/device-auth";
import { newPasswordSchema, notInDeviceMode, readJson, respond } from "@/lib/device-route";
import { getClientIp } from "@/lib/request";

/** After a staff reset: replaces the temporary password (setup step 1). */
export async function POST(request: Request) {
  const off = notInDeviceMode();
  if (off) return off;
  const parsed = z.object({ password: newPasswordSchema }).safeParse(await readJson(request));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Choose a stronger password." }, { status: 400 });
  }
  return respond(await setNewPassword(parsed.data.password, getClientIp(request)));
}
