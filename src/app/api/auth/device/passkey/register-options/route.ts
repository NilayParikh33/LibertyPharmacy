import { passkeyRegistrationOptions } from "@/lib/device-auth";
import { notInDeviceMode, respond } from "@/lib/device-route";

/** Starts adding a passkey to the account being set up (or the signed-in one). */
export async function POST(request: Request) {
  const off = notInDeviceMode();
  if (off) return off;
  return respond(await passkeyRegistrationOptions(request));
}
