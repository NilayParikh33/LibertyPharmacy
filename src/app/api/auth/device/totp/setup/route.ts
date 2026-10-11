import { totpSetup } from "@/lib/device-auth";
import { notInDeviceMode, respond } from "@/lib/device-route";

/** A new authenticator-app key (QR code + text) for the account being set up. */
export async function POST() {
  const off = notInDeviceMode();
  if (off) return off;
  return respond(await totpSetup());
}
