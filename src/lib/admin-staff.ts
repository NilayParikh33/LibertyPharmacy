import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import { getDb, audit } from "./db";
import { decryptPHI, encryptPHI, generateSessionToken, hashPassword, hashSessionToken } from "./crypto";
import { revokeAllSessionsFor } from "./admin-auth";

/**
 * Staff accounts for the admin panel, added by an existing admin with a
 * one-time setup link instead of a shared login (HIPAA §164.312(a)(2)(i):
 * a unique identity per person; SECURITY-RISK-ANALYSIS.md T-02).
 *
 *  1. An admin adds a username → a setup link, shown once, valid 24 hours.
 *  2. The staff member opens it, chooses their own password and scans the
 *     authenticator QR, then confirms a code. Only then does the account
 *     exist (or, for an existing user, get its password and authenticator
 *     replaced, e.g. after a lost phone).
 *  3. Admins can disable an account (signs it out everywhere) or enable it.
 *     Nobody can disable themselves, so the panel can't lock itself out.
 */

const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const TOTP_EPOCH_TOLERANCE_SEC = 30;

export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,39}$/;

export interface StaffRow {
  id: number;
  username: string;
  createdAt: string;
  lastLoginAt: string | null;
  disabled: boolean;
}

export interface PendingInvite {
  id: number;
  username: string;
  createdBy: string;
  expiresAt: string;
}

export async function listStaff(): Promise<{ staff: StaffRow[]; invites: PendingInvite[] }> {
  const db = await getDb();
  const staff = await db
    .prepare("SELECT id, username, created_at, last_login_at, disabled_at FROM admin_users ORDER BY id")
    .all<{ id: number; username: string; created_at: string; last_login_at: string | null; disabled_at: string | null }>();
  const invites = await db
    .prepare("SELECT id, username, created_by, expires_at FROM admin_invites WHERE used_at IS NULL AND expires_at > ? ORDER BY id DESC")
    .all<{ id: number; username: string; created_by: string; expires_at: string }>(new Date().toISOString());
  return {
    staff: staff.map((s) => ({
      id: s.id,
      username: s.username,
      createdAt: s.created_at,
      lastLoginAt: s.last_login_at,
      disabled: s.disabled_at !== null,
    })),
    invites: invites.map((i) => ({ id: i.id, username: i.username, createdBy: i.created_by, expiresAt: i.expires_at })),
  };
}

/**
 * A setup link for `username`. `existing` = re-setup of an existing account
 * (lost phone / forgotten password); otherwise the username must be new.
 * Any earlier unused link for the same username stops working.
 */
export async function createInvite(
  username: string,
  createdBy: string,
  baseUrl: string,
  existing: boolean,
  ip?: string
): Promise<{ ok: true; link: string; expiresAt: string } | { ok: false; error: string; status: number }> {
  const db = await getDb();
  const user = await db.prepare("SELECT id FROM admin_users WHERE username = ?").get<{ id: number }>(username);
  if (existing && !user) return { ok: false, error: "Staff member not found.", status: 404 };
  if (!existing && user) return { ok: false, error: "That username is already taken.", status: 409 };

  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();
  await db.transaction(async () => {
    await db.prepare("UPDATE admin_invites SET used_at = ? WHERE username = ? AND used_at IS NULL").run(new Date().toISOString(), username);
    await db
      .prepare("INSERT INTO admin_invites (token_hash, username, totp_secret, created_by, expires_at) VALUES (?, ?, ?, ?, ?)")
      .run(hashSessionToken(token), username, encryptPHI(generateSecret()), createdBy, expiresAt);
  });
  await audit({
    actor: `admin:${createdBy}`,
    action: existing ? "admin.staff.reset_link" : "admin.staff.invite",
    subject: `admin:${username}`,
    outcome: "success",
    ip,
  });
  return { ok: true, link: `${baseUrl}/admin/setup?token=${token}`, expiresAt };
}

export async function cancelInvite(id: number, by: string, ip?: string): Promise<boolean> {
  const db = await getDb();
  const r = await db.prepare("UPDATE admin_invites SET used_at = ? WHERE id = ? AND used_at IS NULL").run(new Date().toISOString(), id);
  if (r.changes === 1) await audit({ actor: `admin:${by}`, action: "admin.staff.invite_cancelled", subject: `invite:${id}`, outcome: "success", ip });
  return r.changes === 1;
}

async function findInvite(token: string) {
  const db = await getDb();
  const row = await db
    .prepare("SELECT id, username, totp_secret, attempts, expires_at, used_at FROM admin_invites WHERE token_hash = ?")
    .get<{ id: number; username: string; totp_secret: string; attempts: number; expires_at: string; used_at: string | null }>(
      hashSessionToken(token)
    );
  if (!row || row.used_at || new Date(row.expires_at) <= new Date() || row.attempts >= MAX_ATTEMPTS) return null;
  return row;
}

/** For the setup page: who it's for, and the authenticator QR + key. */
export async function getInviteForSetup(token: string): Promise<{ username: string; qr: string; secret: string } | null> {
  const row = await findInvite(token);
  if (!row) return null;
  const secret = decryptPHI(row.totp_secret);
  const uri = generateURI({ issuer: "Liberty Pharmacy Admin", label: row.username, secret });
  return { username: row.username, secret, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
}

export async function completeInvite(
  token: string,
  password: string,
  code: string,
  ip?: string
): Promise<{ ok: true; username: string } | { ok: false; error: string; status: number }> {
  const row = await findInvite(token);
  const expired = { ok: false as const, error: "This setup link has expired or was already used. Ask an admin for a new one.", status: 410 };
  if (!row) return expired;
  const db = await getDb();
  const secret = decryptPHI(row.totp_secret);
  let valid = false;
  try {
    valid = verifySync({ secret, token: code, epochTolerance: TOTP_EPOCH_TOLERANCE_SEC }).valid;
  } catch {
    valid = false;
  }
  if (!valid) {
    await db.prepare("UPDATE admin_invites SET attempts = attempts + 1 WHERE id = ?").run(row.id);
    await audit({ actor: `admin:${row.username}`, action: "admin.staff.setup", outcome: "failure", detail: "bad_code", ip });
    return row.attempts + 1 >= MAX_ATTEMPTS
      ? expired
      : {
          ok: false,
          error: "That code doesn't match. Scan the QR code again (delete any old Liberty Pharmacy Admin entry first) and enter the current code.",
          status: 401,
        };
  }

  const now = new Date().toISOString();
  const existing = await db.prepare("SELECT id FROM admin_users WHERE username = ?").get<{ id: number }>(row.username);
  await db.transaction(async () => {
    if (existing) {
      await db
        .prepare("UPDATE admin_users SET password_hash = ?, totp_secret = ?, disabled_at = NULL WHERE id = ?")
        .run(hashPassword(password), encryptPHI(secret), existing.id);
    } else {
      await db
        .prepare("INSERT INTO admin_users (username, password_hash, totp_secret) VALUES (?, ?, ?)")
        .run(row.username, hashPassword(password), encryptPHI(secret));
    }
    await db.prepare("UPDATE admin_invites SET used_at = ? WHERE id = ?").run(now, row.id);
  });
  // A reset replaces the old password and phone: end any session they opened.
  if (existing) await revokeAllSessionsFor(existing.id);
  await audit({ actor: `admin:${row.username}`, action: "admin.staff.setup", outcome: "success", detail: existing ? "reset" : "new", ip });
  return { ok: true, username: row.username };
}

export async function setStaffDisabled(
  id: number,
  disabled: boolean,
  by: { id: number; username: string },
  ip?: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (disabled && id === by.id) return { ok: false, error: "You can't disable your own account.", status: 409 };
  const db = await getDb();
  const user = await db.prepare("SELECT username FROM admin_users WHERE id = ?").get<{ username: string }>(id);
  if (!user) return { ok: false, error: "Staff member not found.", status: 404 };
  await db.prepare("UPDATE admin_users SET disabled_at = ? WHERE id = ?").run(disabled ? new Date().toISOString() : null, id);
  if (disabled) await revokeAllSessionsFor(id);
  await audit({
    actor: `admin:${by.username}`,
    action: disabled ? "admin.staff.disabled" : "admin.staff.enabled",
    subject: `admin:${user.username}`,
    outcome: "success",
    ip,
  });
  return { ok: true };
}
