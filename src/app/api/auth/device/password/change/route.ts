import { NextResponse } from "next/server";
import { z } from "zod";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { changePassword } from "@/lib/device-auth";
import { deviceFailures, newPasswordSchema, notInDeviceMode, readJson, respond, tooMany } from "@/lib/device-route";
import { getClientIp } from "@/lib/request";

const schema = z.object({
  password: newPasswordSchema,
  totpCode: z.string().trim().regex(/^\d{6}$/).optional(),
  passkeyResponse: z.object({ id: z.string().min(1).max(1024) }).passthrough().optional(),
});

/** Signed-in password change, confirmed with a passkey or authenticator code. */
export async function POST(request: Request) {
  const off = notInDeviceMode();
  if (off) return off;
  const ip = getClientIp(request);
  if (deviceFailures.isLimited(ip)) return tooMany();
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const msg = issue?.path[0] === "password" ? issue.message : "Enter the 6-digit code from your app.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const result = await changePassword(
    request,
    {
      password: parsed.data.password,
      totpCode: parsed.data.totpCode,
      passkeyResponse: parsed.data.passkeyResponse as AuthenticationResponseJSON | undefined,
    },
    ip
  );
  if (!result.ok) deviceFailures.hit(ip);
  return respond(result);
}
