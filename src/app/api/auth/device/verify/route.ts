import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyRecoveryLogin, verifyTotpLogin } from "@/lib/device-auth";
import { deviceFailures, notInDeviceMode, readJson, respond, tooMany } from "@/lib/device-route";
import { getClientIp } from "@/lib/request";

const schema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("totp"), code: z.string().trim().regex(/^\d{6}$/) }),
  z.object({ method: z.literal("recovery"), code: z.string().trim().min(10).max(20) }),
]);

/** The step after the password: an authenticator-app code or a recovery code. */
export async function POST(request: Request) {
  const off = notInDeviceMode();
  if (off) return off;
  const ip = getClientIp(request);
  if (deviceFailures.isLimited(ip)) return tooMany();
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Check the code and try again." }, { status: 400 });
  const { method, code } = parsed.data;
  const result = method === "totp" ? await verifyTotpLogin(code, ip) : await verifyRecoveryLogin(code, ip);
  if (!result.ok) deviceFailures.hit(ip);
  return respond(result);
}
