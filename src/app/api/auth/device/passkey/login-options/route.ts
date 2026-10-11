import { passkeyLoginOptions } from "@/lib/device-auth";
import { deviceFailures, notInDeviceMode, respond, tooMany } from "@/lib/device-route";
import { getClientIp } from "@/lib/request";

/** Starts a passkey sign-in (alone, or as the step after the password). */
export async function POST(request: Request) {
  const off = notInDeviceMode();
  if (off) return off;
  if (deviceFailures.isLimited(getClientIp(request))) return tooMany();
  return respond(await passkeyLoginOptions(request));
}
