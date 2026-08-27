import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySync } from "otplib";
import { getDb, audit } from "@/lib/db";
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashSessionToken,
  encryptPHI,
  decryptPHI,
} from "@/lib/crypto";

/**
 * Admin authentication — one account per staff member, backed by the
 * `admin_users` and `admin_sessions` tables.
 *
 * Deliberately separate from the patient auth in src/lib/auth.ts: different
 * lifecycle, no PHI of its own, and no email-delivery dependency (staff use
 * an authenticator app, so admin access keeps working even if mail is down).
 *
 * This replaces an earlier design that used a single shared identity from
 * environment variables with a stateless signed cookie. That had three
 * problems, all of them findings in SECURITY-RISK-ANALYSIS.md (T-02):
 *
 *  - A shared login cannot be attributed to a person, so the audit trail
 *    could only ever say "the admin" — §164.312(a)(2)(i) requires a unique
 *    identifier per user.
 *  - A stateless cookie cannot be revoked before it expires, so a stolen
 *    cookie stayed valid and a departing staff member could not be cut off
 *    without rotating the secret for everyone.
 *  - Admin actions were not written to audit_log at all.
 *
 * Sign-in requires the password plus a TOTP code. Each user has their own
 * TOTP seed, stored encrypted at rest.
 */

export const ADMIN_COOKIE = "lp_admin";
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

// One 30-second step of tolerance either side, so a slightly skewed phone
// clock doesn't lock the pharmacy out of its own admin panel.
const TOTP_EPOCH_TOLERANCE_SEC = 30;

export interface AdminUser {
  id: number;
  username: string;
}

interface AdminRow {
  id: number;
  username: string;
  password_hash: string;
  totp_secret: string;
  disabled_at: string | null;
}

/**
 * Creates the first admin from ADMIN_USERNAME / ADMIN_PASSWORD /
 * ADMIN_TOTP_SECRET when no accounts exist yet.
 *
 * Runs only when `admin_users` is empty, so it cannot resurrect or overwrite
 * an account that was deliberately removed or disabled. Once real accounts
 * exist the env vars are ignored entirely and users are managed in the DB.
 */
async function seedFirstAdmin(): Promise<void> {
  const db = await getDb();
  const { n } = (await db.prepare("SELECT COUNT(*) AS n FROM admin_users").get<{ n: number }>()) ?? { n: 0 };
  if (n > 0) return;

  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const totp = process.env.ADMIN_TOTP_SECRET;
  if (!username || !password || !totp) return;

  await db
    .prepare("INSERT INTO admin_users (username, password_hash, totp_secret) VALUES (?, ?, ?)")
    .run(username, hashPassword(password), encryptPHI(totp));
  await audit({
    actor: "system",
    action: "admin.user.seeded",
    subject: `admin:${username}`,
    outcome: "success",
    detail: "bootstrapped first admin from environment",
  });
}

async function findAdmin(username: string): Promise<AdminRow | undefined> {
  await seedFirstAdmin();
  const db = await getDb();
  return db
    .prepare("SELECT * FROM admin_users WHERE username = ? AND disabled_at IS NULL")
    .get<AdminRow>(username);
}

// TOTP codes stay valid for their whole step plus the drift window above, so
// without this an observed code could be replayed for ~90 seconds. Codes are
// burned on first use.
const usedTotpCodes = new Map<string, number>();
const TOTP_REPLAY_TTL_MS = 120_000;

function totpAlreadyUsed(key: string): boolean {
  const now = Date.now();
  for (const [k, seenAt] of usedTotpCodes) {
    if (seenAt < now - TOTP_REPLAY_TTL_MS) usedTotpCodes.delete(k);
  }
  if (usedTotpCodes.has(key)) return true;
  usedTotpCodes.set(key, now);
  return false;
}

/**
 * Verifies username + password + TOTP together, returning the user on success.
 *
 * Callers get a single yes/no and never learn which factor failed — naming it
 * would tell an attacker when they had guessed the password correctly.
 */
export async function verifyAdminLogin(
  username: string,
  password: string,
  token: string
): Promise<AdminUser | null> {
  const row = await findAdmin(username);
  if (!row) return null;
  if (!verifyPassword(password, row.password_hash)) return null;

  // Scoped per user so one account's code can't be replayed against another.
  if (totpAlreadyUsed(`${row.id}:${token}`)) return null;

  let secret: string;
  try {
    secret = decryptPHI(row.totp_secret);
  } catch {
    // Seed unreadable (wrong key, corrupted row) — fail closed.
    return null;
  }

  try {
    if (!verifySync({ secret, token, epochTolerance: TOTP_EPOCH_TOLERANCE_SEC }).valid) return null;
  } catch {
    // Malformed token or seed — a failed attempt, never a pass.
    return null;
  }

  const db = await getDb();
  await db.prepare("UPDATE admin_users SET last_login_at = ? WHERE id = ?").run(new Date().toISOString(), row.id);
  return { id: row.id, username: row.username };
}

/** Issues a server-side session and sets the cookie. */
export async function createAdminSession(adminUserId: number): Promise<void> {
  const token = generateSessionToken();
  const expires = Date.now() + SESSION_TTL_MS;
  const db = await getDb();
  await db
    .prepare("INSERT INTO admin_sessions (token_hash, admin_user_id, expires_at) VALUES (?, ?, ?)")
    .run(hashSessionToken(token), adminUserId, new Date(expires).toISOString());

  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expires),
  });
}

/** The signed-in admin, or null. Expired rows are deleted as they're found. */
export async function getCurrentAdmin(): Promise<AdminUser | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;

  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT u.id, u.username, s.expires_at
         FROM admin_sessions s
         JOIN admin_users u ON u.id = s.admin_user_id
        WHERE s.token_hash = ? AND u.disabled_at IS NULL`
    )
    .get<{ id: number; username: string; expires_at: string }>(hashSessionToken(token));

  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(hashSessionToken(token));
    return null;
  }
  return { id: row.id, username: row.username };
}

/** For server components: the current admin, or a redirect to sign-in. */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export async function destroyAdminSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(hashSessionToken(token));
  }
  jar.delete(ADMIN_COOKIE);
}

/**
 * Revokes every session for one admin — the control that was impossible with
 * stateless cookies. Use on staff departure or a suspected stolen session.
 */
export async function revokeAllSessionsFor(adminUserId: number): Promise<void> {
  const db = await getDb();
  await db.prepare("DELETE FROM admin_sessions WHERE admin_user_id = ?").run(adminUserId);
}

// In-memory login throttle. Per-process, which is sufficient while the app
// runs as a single instance; see finding T-03 before scaling horizontally.
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
