import { NextResponse } from "next/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { passkeyRegistrationVerify } from "@/lib/device-auth";
import { notInDeviceMode, readJson, respond } from "@/lib/device-route";
import { getClientIp } from "@/lib/request";

/** Saves the new passkey; signs in a patient who is setting up their account. */
export async function POST(request: Request) {
  const off = notInDeviceMode();
  if (off) return off;
  const body = (await readJson(request)) as { response?: RegistrationResponseJSON } | null;
  if (!body?.response || typeof body.response.id !== "string") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  return respond(await passkeyRegistrationVerify(request, body.response, getClientIp(request)));
}
