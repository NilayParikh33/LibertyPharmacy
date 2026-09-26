import { cookies } from "next/headers";
import { after } from "next/server";
import { getDb, audit } from "./db";
import {
  encryptPHI,
  decryptPHI,
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashSessionToken,
  generateOtpCode,
  burnPasswordCheck,
} from "./crypto";
import { sendOtpEmail, sendPasswordResetEmail, sendAccountExistsEmail } from "./mail";
import { createRateLimiter } from "./rate-limit";

/**
 * Authentication + patient-record service.
 *
 * Security posture (see HIPAA-COMPLIANCE.md):
 *  - Sessions: 30-minute idle-style absolute expiry, httpOnly + SameSite=Lax
 *    cookies, token stored only as SHA-256 hash.
 *  - Account lockout: 5 failed logins → 15-minute lock (mitigates
 *    credential stuffing without a hard DoS vector).
 *  - All reads/writes of patient rows are audited.
 *  - PHI fields are encrypted before INSERT and decrypted only when a row is
 *    served to its authenticated owner.
 */

export const SESSION_COOKIE = "lp_session";
export const MFA_COOKIE = "lp_mfa";
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min — short by design for PHI apps
const MFA_TTL_MS = 10 * 60 * 1000; // pending challenges live 10 minutes
const MAX_CODE_ATTEMPTS = 5;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

/** Fields collected at registration, mirroring DRX patient fields. */
export interface RegistrationInput {
  email: string;
  password: string;
  firstName: string;
  middleInitial?: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: "M" | "F" | "O" | "U";
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  phone?: string;
  cellPhone: string;
  preferredLanguage: string;
  allergies?: string;
  medicalConditions?: string;
  insBin?: string;
  insPcn?: string;
  insGroup?: string;
  insCardholderId?: string;
  insPersonCode?: string;
  insRelationship?: string;
  deliveryMethod: "pickup" | "delivery" | "mail";
  smsOptIn: boolean;
  hipaaAcknowledged: boolean;
}

export interface PatientProfile {
  patientId: number;
  firstName: string;
  lastName: string;
  email: string;
  cellPhone: string;
  deliveryMethod: string;
  preferredLanguage: string;
}

const enc = (v: string | undefined | null) => (v ? encryptPHI(v) : null);

/**
 * Creates the account + patient record.
 *
 * `{ duplicate: true }` means the email is already registered. Callers must
 * make that outcome indistinguishable from a new signup to whoever sent the
 * request — same response, same cookies, same timing — and tell the real
 * owner by email instead (see the register route and SEC-002).
 */
export async function registerPatient(
  input: RegistrationInput,
  ip?: string
): Promise<{ ok: true; accountId: number } | { ok: false; duplicate: true }> {
  const db = await getDb();
  const email = input.email.trim().toLowerCase();

  const existing = await db.prepare("SELECT id FROM accounts WHERE email = ?").get(email);
  if (existing) {
    // Match the scrypt cost of the new-account path below, so response time
    // doesn't reveal that this email is taken.
    burnPasswordCheck(input.password);
    await audit({ actor: "anonymous", action: "auth.register", outcome: "failure", detail: "duplicate_email", ip });
    return { ok: false, duplicate: true };
  }

  const accountId = await db.transaction(async () => {
    // email_verified explicitly 0: the column default differs between fresh
    // databases (0) and ones migrated from the pre-MFA schema (1, to
    // grandfather old accounts) — new accounts must always start unverified.
    const acct = await db
      .prepare("INSERT INTO accounts (email, password_hash, email_verified) VALUES (?, ?, 0) RETURNING id")
      .run(email, hashPassword(input.password));
    const accountId = acct.lastInsertRowid;

    await db
      .prepare(
        `INSERT INTO patients (
          account_id, first_name, middle_initial, last_name, date_of_birth, gender,
          address1, address2, city, state, zip, phone, cell_phone, email,
          preferred_language, allergies, medical_conditions,
          ins_bin, ins_pcn, ins_group, ins_cardholder_id, ins_person_code, ins_relationship,
          delivery_method, sms_opt_in, hipaa_ack_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        accountId,
        encryptPHI(input.firstName),
        enc(input.middleInitial),
        encryptPHI(input.lastName),
        encryptPHI(input.dateOfBirth),
        encryptPHI(input.gender),
        encryptPHI(input.address1),
        enc(input.address2),
        encryptPHI(input.city),
        encryptPHI(input.state),
        encryptPHI(input.zip),
        enc(input.phone),
        encryptPHI(input.cellPhone),
        encryptPHI(email),
        input.preferredLanguage,
        enc(input.allergies),
        enc(input.medicalConditions),
        enc(input.insBin),
        enc(input.insPcn),
        enc(input.insGroup),
        enc(input.insCardholderId),
        enc(input.insPersonCode),
        input.insRelationship ?? null,
        input.deliveryMethod,
        input.smsOptIn ? 1 : 0,
        new Date().toISOString()
      );
    return accountId;
  });

  await audit({ actor: `account:${accountId}`, action: "auth.register", subject: `patient:account:${accountId}`, outcome: "success", ip });
  return { ok: true, accountId };
}

// Failed-login counter for emails that have no account. Real accounts lock in
// the database after MAX_FAILED_LOGINS; without an equivalent here, only real
// accounts ever answered "too many attempts", which told an attacker exactly
// which emails are registered (SEC-002b). Same threshold and window.
const unknownEmailFailures = createRateLimiter({ limit: MAX_FAILED_LOGINS, windowMs: LOCKOUT_MS });

export async function loginPatient(
  emailRaw: string,
  password: string,
  ip?: string
): Promise<
  | { ok: true; accountId: number; email: string; emailVerified: boolean }
  | { ok: false; error: string; status: number }
> {
  const db = await getDb();
  const email = emailRaw.trim().toLowerCase();
  const generic = { ok: false as const, error: "Invalid email or password.", status: 401 };

  const acct = await db
    .prepare("SELECT id, password_hash, failed_logins, locked_until, email_verified FROM accounts WHERE email = ?")
    .get<{ id: number; password_hash: string; failed_logins: number; locked_until: string | null; email_verified: number }>(email);

  if (!acct) {
    if (unknownEmailFailures.isLimited(email)) {
      await audit({ actor: "anonymous", action: "auth.login", outcome: "failure", detail: "locked", ip });
      return { ok: false, error: "Too many failed attempts. Please try again in a few minutes.", status: 429 };
    }
    // Same scrypt cost as a real account's wrong password (SEC-002c).
    burnPasswordCheck(password);
    unknownEmailFailures.hit(email);
    await audit({ actor: "anonymous", action: "auth.login", outcome: "failure", detail: "unknown_email", ip });
    return generic;
  }

  if (acct.locked_until && new Date(acct.locked_until) > new Date()) {
    await audit({ actor: `account:${acct.id}`, action: "auth.login", outcome: "failure", detail: "locked", ip });
    return { ok: false, error: "Too many failed attempts. Please try again in a few minutes.", status: 429 };
  }

  if (!verifyPassword(password, acct.password_hash)) {
    const failed = acct.failed_logins + 1;
    const lock = failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCKOUT_MS).toISOString() : null;
    await db.prepare("UPDATE accounts SET failed_logins = ?, locked_until = ? WHERE id = ?").run(
      lock ? 0 : failed,
      lock,
      acct.id
    );
    await audit({ actor: `account:${acct.id}`, action: "auth.login", outcome: "failure", detail: lock ? "bad_password_locked" : "bad_password", ip });
    return generic;
  }

  await db.prepare("UPDATE accounts SET failed_logins = 0, locked_until = NULL WHERE id = ?").run(acct.id);
  await audit({ actor: `account:${acct.id}`, action: "auth.login", outcome: "success", detail: "password_ok_pending_mfa", ip });
  return { ok: true, accountId: acct.id, email, emailVerified: acct.email_verified === 1 };
}

// ---------------------------------------------------------------------------
// Email verification / login MFA challenges
// ---------------------------------------------------------------------------

export type MfaPurpose = "email_verify" | "login_mfa";

/**
 * DEMO ESCAPE HATCH - hands the freshly issued OTP back to the caller so it
 * can be displayed in the browser instead of emailed.
 *
 * This does not weaken the second factor, it removes it: the code travels in
 * the API response, so anyone who can reach the endpoint can register an
 * address they do not control and verify it themselves. There is no
 * configuration involving real patients in which this is acceptable.
 *
 * Opt-in, exact-match "true", and deliberately separate from
 * DEMO_LOG_OTP_CODES so the log-only behaviour can be used without this one.
 */
const demoRevealOtp = process.env.DEMO_SHOW_OTP_ON_SCREEN === "true";

/**
 * Start (or restart) a one-time-code challenge for an account: stores hashed
 * code + pending token, sets the pending cookie, emails the code.
 *
 * Returns the plaintext code when DEMO_SHOW_OTP_ON_SCREEN is on, otherwise
 * null. A non-null result is only ever safe to surface in that demo mode.
 */
export async function startMfaChallenge(
  accountId: number,
  email: string,
  purpose: MfaPurpose
): Promise<string | null> {
  const db = await getDb();
  const token = generateSessionToken();
  const code = generateOtpCode();
  const expires = new Date(Date.now() + MFA_TTL_MS);

  // One live challenge per account/purpose — a resend invalidates the old code.
  await db.prepare("DELETE FROM mfa_pending WHERE account_id = ? AND purpose = ?").run(accountId, purpose);
  await db
    .prepare(
      "INSERT INTO mfa_pending (token_hash, account_id, purpose, code_hash, expires_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run(hashSessionToken(token), accountId, purpose, hashSessionToken(code), expires.toISOString());

  await setPendingCookie(token, expires);

  // Sent after the response goes out, not before: how long the mail provider
  // takes must not be observable, or it would distinguish this path from the
  // no-email paths (e.g. a registration attempt on an existing account).
  //
  // The pending challenge (DB row + cookie) is already committed above, so a
  // transport failure here must not crash an otherwise-successful
  // register/login request — the user can still recover via Resend. Log it
  // so a persistently broken mail transport is visible in the audit trail.
  after(async () => {
    try {
      await sendOtpEmail(email, code, purpose);
      await audit({ actor: `account:${accountId}`, action: `auth.mfa.${purpose}.sent`, outcome: "success" });
    } catch (err) {
      await audit({
        actor: `account:${accountId}`,
        action: `auth.mfa.${purpose}.sent`,
        outcome: "failure",
        detail: `mail_send_failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });

  return demoRevealOtp ? code : null;
}

// ---------------------------------------------------------------------------
// Decoy challenges (registration on an already-registered email)
// ---------------------------------------------------------------------------

/**
 * Challenges with no account behind them, handed out when someone registers
 * an email that already has an account (SEC-002).
 *
 * The requester gets the same response and the same pending cookie as a real
 * signup, and the verify/resend endpoints then behave identically too: wrong
 * codes count toward the same 5-attempt limit and resend succeeds. Only the
 * mailbox owner could tell the difference — and they are emailed a notice
 * instead of a code. A decoy can never produce a session: there is no code
 * that completes it and no account to attach a session to.
 *
 * In memory only (per-process, like the other limiters — see T-03).
 */
const decoyChallenges = new Map<string, { attempts: number; expiresAt: number }>();
const MAX_DECOYS = 10_000;

function setPendingCookie(token: string, expires: Date): Promise<void> {
  return cookies().then((jar) => {
    jar.set(MFA_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires,
    });
  });
}

export async function startDecoyChallenge(): Promise<void> {
  const now = Date.now();
  for (const [key, d] of decoyChallenges) {
    if (d.expiresAt <= now) decoyChallenges.delete(key);
  }
  while (decoyChallenges.size >= MAX_DECOYS) {
    const oldest = decoyChallenges.keys().next().value;
    if (oldest === undefined) break;
    decoyChallenges.delete(oldest);
  }
  const token = generateSessionToken();
  const expires = new Date(now + MFA_TTL_MS);
  decoyChallenges.set(hashSessionToken(token), { attempts: 0, expiresAt: expires.getTime() });
  await setPendingCookie(token, expires);
}

function getDecoy(tokenHash: string) {
  const d = decoyChallenges.get(tokenHash);
  if (!d) return null;
  if (d.expiresAt <= Date.now()) {
    decoyChallenges.delete(tokenHash);
    return null;
  }
  return d;
}

/** The account+purpose behind the browser's pending cookie, if still valid. */
async function getPendingChallenge(): Promise<
  { id: number; accountId: number; purpose: MfaPurpose; attempts: number; codeHash: string } | null
> {
  const token = (await cookies()).get(MFA_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const row = await db
    .prepare("SELECT id, account_id, purpose, attempts, code_hash, expires_at FROM mfa_pending WHERE token_hash = ?")
    .get<{ id: number; account_id: number; purpose: MfaPurpose; attempts: number; code_hash: string; expires_at: string }>(
      hashSessionToken(token)
    );
  if (!row) return null;
  if (new Date(row.expires_at) <= new Date()) {
    await db.prepare("DELETE FROM mfa_pending WHERE id = ?").run(row.id);
    return null;
  }
  return { id: row.id, accountId: row.account_id, purpose: row.purpose, attempts: row.attempts, codeHash: row.code_hash };
}

/**
 * Verify the submitted code. On success: email_verify activates the account;
 * both purposes end with a real session. On repeated failure the challenge is
 * destroyed and the user must restart.
 */
export async function completeMfaChallenge(
  code: string,
  ip?: string
): Promise<{ ok: true; purpose: MfaPurpose } | { ok: false; error: string; status: number }> {
  const db = await getDb();
  const pending = await getPendingChallenge();
  if (!pending) {
    // A decoy (see startDecoyChallenge) answers exactly like a real challenge
    // receiving a wrong code — every code is wrong, since none was issued.
    const token = (await cookies()).get(MFA_COOKIE)?.value;
    const decoy = token ? getDecoy(hashSessionToken(token)) : null;
    if (decoy) {
      decoy.attempts += 1;
      if (decoy.attempts >= MAX_CODE_ATTEMPTS) {
        decoyChallenges.delete(hashSessionToken(token!));
        return { ok: false, error: "Too many incorrect codes. Please sign in again to get a new one.", status: 429 };
      }
      return { ok: false, error: "That code isn't right. Please check your email and try again.", status: 400 };
    }
    return { ok: false, error: "Your code has expired. Please sign in again to get a new one.", status: 401 };
  }

  if (hashSessionToken(code.trim()) !== pending.codeHash) {
    const attempts = pending.attempts + 1;
    if (attempts >= MAX_CODE_ATTEMPTS) {
      await db.prepare("DELETE FROM mfa_pending WHERE id = ?").run(pending.id);
      await audit({ actor: `account:${pending.accountId}`, action: `auth.mfa.${pending.purpose}.verify`, outcome: "failure", detail: "too_many_attempts", ip });
      return { ok: false, error: "Too many incorrect codes. Please sign in again to get a new one.", status: 429 };
    }
    await db.prepare("UPDATE mfa_pending SET attempts = ? WHERE id = ?").run(attempts, pending.id);
    await audit({ actor: `account:${pending.accountId}`, action: `auth.mfa.${pending.purpose}.verify`, outcome: "failure", detail: "bad_code", ip });
    return { ok: false, error: "That code isn't right. Please check your email and try again.", status: 400 };
  }

  await db.prepare("DELETE FROM mfa_pending WHERE id = ?").run(pending.id);
  if (pending.purpose === "email_verify") {
    await db.prepare("UPDATE accounts SET email_verified = 1 WHERE id = ?").run(pending.accountId);
  }
  await audit({ actor: `account:${pending.accountId}`, action: `auth.mfa.${pending.purpose}.verify`, outcome: "success", ip });

  (await cookies()).delete(MFA_COOKIE);
  await createSession(pending.accountId);
  return { ok: true, purpose: pending.purpose };
}

/** Re-issue the code for the browser's pending challenge (resend button). */
export async function resendMfaCode(): Promise<{ ok: boolean; demoCode?: string }> {
  const pending = await getPendingChallenge();
  if (!pending) {
    // Decoy: "resend" succeeds like a real one (a fresh decoy, fresh attempts).
    const token = (await cookies()).get(MFA_COOKIE)?.value;
    if (token && getDecoy(hashSessionToken(token))) {
      decoyChallenges.delete(hashSessionToken(token));
      await startDecoyChallenge();
      return { ok: true };
    }
    return { ok: false };
  }
  const db = await getDb();
  const acct = await db.prepare("SELECT email FROM accounts WHERE id = ?").get<{ email: string }>(pending.accountId);
  if (!acct) return { ok: false };
  const demoCode = await startMfaChallenge(pending.accountId, acct.email, pending.purpose);
  return demoCode ? { ok: true, demoCode } : { ok: true };
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

const RESET_TTL_MS = 30 * 60 * 1000; // reset links live 30 minutes

/**
 * Issue a reset link for `emailRaw` if such an account exists.
 *
 * Always resolves the same way regardless of whether the account exists —
 * callers must return an identical response either way so the endpoint can't
 * be used to discover which emails are registered.
 */
export async function requestPasswordReset(emailRaw: string, baseUrl: string, ip?: string): Promise<void> {
  const db = await getDb();
  const email = emailRaw.trim().toLowerCase();
  const acct = await db.prepare("SELECT id FROM accounts WHERE email = ?").get<{ id: number }>(email);

  if (!acct) {
    await audit({ actor: "anonymous", action: "auth.reset.request", outcome: "failure", detail: "unknown_email", ip });
    return;
  }

  // Supersede any outstanding link for this account.
  await db.prepare("DELETE FROM password_resets WHERE account_id = ?").run(acct.id);

  const token = generateSessionToken();
  const expires = new Date(Date.now() + RESET_TTL_MS);
  await db
    .prepare("INSERT INTO password_resets (token_hash, account_id, expires_at) VALUES (?, ?, ?)")
    .run(hashSessionToken(token), acct.id, expires.toISOString());

  await sendPasswordResetEmail(email, `${baseUrl}/portal/reset?token=${token}`);
  await audit({ actor: `account:${acct.id}`, action: "auth.reset.request", outcome: "success", ip });
}

/** True when the token is a live, unused reset token (for rendering the form). */
export async function isResetTokenValid(token: string): Promise<boolean> {
  const db = await getDb();
  const row = await db
    .prepare("SELECT expires_at, used_at FROM password_resets WHERE token_hash = ?")
    .get<{ expires_at: string; used_at: string | null }>(hashSessionToken(token));
  return Boolean(row && !row.used_at && new Date(row.expires_at) > new Date());
}

/**
 * Consume a reset token and set the new password.
 *
 * On success every existing session for that account is destroyed — a password
 * reset is the standard remedy for a suspected account takeover, so any
 * attacker's session must die with it. The account is also unlocked, since a
 * legitimate owner locked out by failed guesses should regain access.
 */
export async function resetPassword(
  token: string,
  newPassword: string,
  ip?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = await getDb();
  const tokenHash = hashSessionToken(token);
  const row = await db
    .prepare("SELECT id, account_id, expires_at, used_at FROM password_resets WHERE token_hash = ?")
    .get<{ id: number; account_id: number; expires_at: string; used_at: string | null }>(tokenHash);

  const invalid = {
    ok: false as const,
    error: "This reset link is no longer valid. Please request a new one.",
  };
  if (!row || row.used_at || new Date(row.expires_at) <= new Date()) {
    await audit({ actor: "anonymous", action: "auth.reset.complete", outcome: "failure", detail: "invalid_token", ip });
    return invalid;
  }

  await db.transaction(async () => {
    await db
      .prepare("UPDATE accounts SET password_hash = ?, failed_logins = 0, locked_until = NULL WHERE id = ?")
      .run(hashPassword(newPassword), row.account_id);
    await db
      .prepare("UPDATE password_resets SET used_at = ? WHERE id = ?")
      .run(new Date().toISOString(), row.id);
    await db.prepare("DELETE FROM sessions WHERE account_id = ?").run(row.account_id);
  });

  await audit({ actor: `account:${row.account_id}`, action: "auth.reset.complete", outcome: "success", ip });
  return { ok: true };
}

export async function createSession(accountId: number): Promise<void> {
  const db = await getDb();
  const token = generateSessionToken();
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await db
    .prepare("INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)")
    .run(hashSessionToken(token), accountId, expires.toISOString());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function getSessionAccountId(): Promise<number | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const row = await db
    .prepare("SELECT account_id, expires_at FROM sessions WHERE token_hash = ?")
    .get<{ account_id: number; expires_at: string }>(hashSessionToken(token));
  if (!row) return null;
  if (new Date(row.expires_at) <= new Date()) {
    await db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashSessionToken(token));
    return null;
  }
  return row.account_id;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashSessionToken(token));
  }
  store.delete(SESSION_COOKIE);
}

/** Minimal profile for the signed-in portal view. Access is audited. */
export async function getPatientProfile(accountId: number, ip?: string): Promise<PatientProfile | null> {
  const db = await getDb();
  const row = await db
    .prepare(
      `SELECT patient_id, first_name, last_name, email, cell_phone, delivery_method, preferred_language
       FROM patients WHERE account_id = ?`
    )
    .get<{ patient_id: number; first_name: string; last_name: string; email: string; cell_phone: string; delivery_method: string; preferred_language: string }>(
      accountId
    );
  if (!row) return null;

  await audit({ actor: `account:${accountId}`, action: "patient.read", subject: `patient:${row.patient_id}`, outcome: "success", ip });
  return {
    patientId: row.patient_id,
    firstName: decryptPHI(row.first_name),
    lastName: decryptPHI(row.last_name),
    email: decryptPHI(row.email),
    cellPhone: decryptPHI(row.cell_phone),
    deliveryMethod: row.delivery_method,
    preferredLanguage: row.preferred_language,
  };
}
