import { NextResponse } from "next/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { passkeyLoginVerify } from "@/lib/device-auth";
import { deviceFailures, notInDeviceMode, readJson, respond, tooMany } from "@/lib/device-route";
import { getClientIp } from "@/lib/request";

/** Checks the passkey's signature and signs the patient in. */
export async function POST(request: Request) {
  const off = notInDeviceMode();
  if (off) return off;
  const ip = getClientIp(request);
  if (deviceFailures.isLimited(ip)) return tooMany();
  const body = (await readJson(request)) as { response?: AuthenticationResponseJSON } | null;
  if (!body?.response || typeof body.response.id !== "string") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const result = await passkeyLoginVerify(request, body.response, ip);
  if (!result.ok) deviceFailures.hit(ip);
  return respond(result);
}
