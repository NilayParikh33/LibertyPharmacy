import { NextResponse } from "next/server";
import { z } from "zod";
import { isDeviceMode } from "./device-auth";
import { createRateLimiter } from "./rate-limit";

/**
 * Shared plumbing for the /api/auth/device/* routes (src/lib/device-auth.ts).
 * They exist only when PATIENT_AUTH_MODE=device; otherwise they answer 404,
 * as if they weren't there.
 */

export function notInDeviceMode(): NextResponse | null {
  return isDeviceMode() ? null : NextResponse.json({ error: "Not found." }, { status: 404 });
}

/** Turns a device-auth result into a response. */
export function respond(result: ({ ok: true } & Record<string, unknown>) | { ok: false; error: string; status: number }) {
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * Failed sign-in steps per client, across accounts (same idea as the password
 * limiter in /api/auth/login, SEC-004). Each pending step also dies after
 * 5 failures, so this mainly stops one client cycling through many steps.
 */
export const deviceFailures = createRateLimiter({ limit: 30, windowMs: 15 * 60 * 1000 });

export const tooMany = () =>
  NextResponse.json({ error: "Too many attempts. Please try again in a few minutes." }, { status: 429 });

// Same rules as registration (src/app/api/auth/register/route.ts).
export const newPasswordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128)
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[0-9]/, "Include a number");
