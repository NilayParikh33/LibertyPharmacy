import { reauthPasskeyOptions } from "@/lib/device-auth";
import { notInDeviceMode, respond } from "@/lib/device-route";

/** Passkey prompt for confirming a password change. */
export async function POST(request: Request) {
  const off = notInDeviceMode();
  if (off) return off;
  return respond(await reauthPasskeyOptions(request));
}
