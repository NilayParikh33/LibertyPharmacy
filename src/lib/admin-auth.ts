import { cookies } from "next/headers";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { verifySync } from "otplib";

/**
 * Admin authentication — deliberately separate from the patient-portal auth
 * in src/lib/auth.ts. There is exactly one internal admin identity (env-var
 * credentials), so this skips the account/session DB tables built for
 * PHI-handling patient accounts and instead uses a signed, stateless session
 * cookie.
 *
 * Sign-in requires two factors: the ADMIN_PASSWORD, plus a TOTP code from an
 * authenticator app (ADMIN_TOTP_SECRET). The admin panel can read
 * patient-submitted contact messages, so single-factor access to it was a
 * weaker gate than the patient portal it oversees — see finding T-02 in
 * SECURITY-RISK-ANALYSIS.md.
 *
 * STILL OPEN (T-02): this remains one *shared* identity, so admin actions
 * cannot be attributed to an individual (§164.312(a)(2)(i) wants a unique
 * identifier per user), sessions are stateless and therefore cannot be
 * revoked before they expire, and admin actions are not yet written to
 * audit_log. Those need per-user accounts backed by the sessions table.
 */

export const ADMIN_COOKIE = "lp_admin";
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") {
    return "dev-only-insecure-admin-session-secret";
  }
  throw new Error("ADMIN_SESSION_SECRET is not set — cannot start admin sessions in production.");
}

function sign(expiresAtMs: number): string {
  return createHmac("sha256", getSecret()).update(String(expiresAtMs)).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Constant-time credential check against ADMIN_USERNAME / ADMIN_PASSWORD. */
export function verifyAdminCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;
  if (!expectedUser || !expectedPass) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[admin-auth] ADMIN_USERNAME/ADMIN_PASSWORD not set — admin login is disabled.");
    }
    return false;
  }
  const userHash = createHash("sha256").update(username).digest("hex");
  const expectedUserHash = createHash("sha256").update(expectedUser).digest("hex");
  const passHash = createHash("sha256").update(password).digest("hex");
  const expectedPassHash = createHash("sha256").update(expectedPass).digest("hex");
  return safeEqual(userHash, expectedUserHash) && safeEqual(passHash, expectedPassHash);
}

// Tolerate one 30-second step either side of the current one, so a slightly
// skewed phone clock doesn't lock the pharmacy out of its own admin panel.
const TOTP_EPOCH_TOLERANCE_SEC = 30;

/** Whether a TOTP secret is configured at all. */
export function isAdminMfaConfigured(): boolean {
  return !!process.env.ADMIN_TOTP_SECRET;
}

// A TOTP code stays valid for its whole step (plus the drift window above), so
// without this an attacker who observes one code — over a shoulder, or in a
// phished form — could replay it for up to ~90 seconds. Codes are burned on
// first use. Entries are dropped once they can no longer be valid.
const usedTotpCodes = new Map<string, number>();
const TOTP_REPLAY_TTL_MS = 120_000;

/**
 * Verifies a TOTP code against ADMIN_TOTP_SECRET, rejecting reuse.
 *
 * Fails closed: with no secret configured, production refuses the login
 * outright rather than silently downgrading to password-only — an unset env
 * var should not be able to quietly disable a required safeguard.
 */
export function verifyAdminTotp(token: string): boolean {
  const secret = process.env.ADMIN_TOTP_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") return false;
    console.warn("[admin-auth] ADMIN_TOTP_SECRET not set — skipping MFA (development only).");
    return true;
  }

  const now = Date.now();
  for (const [code, seenAt] of usedTotpCodes) {
    if (seenAt < now - TOTP_REPLAY_TTL_MS) usedTotpCodes.delete(code);
  }
  if (usedTotpCodes.has(token)) return false;

  let ok = false;
  try {
    ok = verifySync({ secret, token, epochTolerance: TOTP_EPOCH_TOLERANCE_SEC }).valid;
  } catch {
    // Malformed secret or token — treat as a failed attempt, never as a pass.
    return false;
  }
  if (ok) usedTotpCodes.set(token, now);
  return ok;
}

export async function createAdminSession(): Promise<void> {
  const expires = Date.now() + SESSION_TTL_MS;
  const token = `${expires}.${sign(expires)}`;
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expires),
  });
}

export async function isAdminSessionValid(): Promise<boolean> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  const [expiresStr, signature] = token.split(".");
  const expires = Number(expiresStr);
  if (!expiresStr || !signature || Number.isNaN(expires)) return false;
  if (Date.now() > expires) return false;
  return safeEqual(signature, sign(expires));
}

export async function destroyAdminSession(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}

// In-memory login rate limit — mirrors the pattern in
// src/app/api/auth/register/route.ts. A single-process concern, acceptable
// for a low-traffic internal login endpoint.
const attempts = new Map<string, { count: number; lockedUntil: number | null; resetAt: number }>();

export function isLoginLocked(ip: string): boolean {
  const slot = attempts.get(ip);
  return !!slot?.lockedUntil && slot.lockedUntil > Date.now();
}

export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  for (const [key, slot] of attempts) {
    if (slot.resetAt < now) attempts.delete(key);
  }
  const slot = attempts.get(ip) ?? { count: 0, lockedUntil: null, resetAt: now + LOCKOUT_MS };
  slot.count += 1;
  slot.resetAt = now + LOCKOUT_MS;
  if (slot.count >= MAX_FAILED_LOGINS) slot.lockedUntil = now + LOCKOUT_MS;
  attempts.set(ip, slot);
}

export function clearLoginFailures(ip: string): void {
  attempts.delete(ip);
}
