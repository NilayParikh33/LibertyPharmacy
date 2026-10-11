import { cookies } from "next/headers";
import { createHash, randomInt } from "crypto";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { getDb, audit } from "./db";
import { decryptPHI, encryptPHI, generateSessionToken, hashPassword, hashSessionToken } from "./crypto";
import { SESSION_COOKIE, createSession, getSessionAccountId } from "./auth";

/**
 * Device sign-in: passkeys and authenticator apps instead of emailed codes.
 *
 * Switched on with PATIENT_AUTH_MODE=device. Built because Amazon SES is still
 * in its sandbox, so the emailed one-time codes of the default ("email") mode
 * don't reach patients. Nothing here sends email.
 *
 * Ways in:
 *  - A passkey alone (Face ID / Touch ID / Windows Hello / phone). A passkey is
 *    already two factors — the device, unlocked by biometrics or PIN — so it
 *    needs no password. User verification is required, never "preferred".
 *  - Email + password, then a second factor: a code from an authenticator app,
 *    a passkey registered to that account, or a one-time recovery code.
 *
 * Every account gets 10 one-time recovery codes the first time it adds a
 * factor. A patient with no factor and no recovery code calls the pharmacy;
 * staff use Admin → Patients → Reset sign-in, which clears every factor and
 * issues a one-time temporary password (must_change_password).
 *
 * Accepted risk (SECURITY-RISK-ANALYSIS.md, SEC-016): an account without any
 * factor — new, or just reset by staff — adds its first one after the password
 * alone, and registering an email that already exists says so on screen.
 * Both are consequences of not having working email; both go away when this
 * is switched back to PATIENT_AUTH_MODE=email.
 *
 * The steps between "password accepted" and "session created" are tracked in
 * auth_pending, bound to the browser by the lp_auth cookie (only its SHA-256
 * is stored), exactly like mfa_pending / lp_mfa in email mode.
 */

export const AUTH_COOKIE = "lp_auth";
const PENDING_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RECOVERY_CODE_COUNT = 10;
const TOTP_EPOCH_TOLERANCE_SEC = 30; // one step either side for phone clock drift
const RP_NAME = "Liberty Pharmacy";

export type AuthMode = "email" | "device";

export function patientAuthMode(): AuthMode {
  return process.env.PATIENT_AUTH_MODE === "device" ? "device" : "email";
}

export const isDeviceMode = () => patientAuthMode() === "device";

type Purpose = "enroll" | "second_factor" | "passkey_login";

interface Pending {
  id: number;
  accountId: number | null;
  purpose: Purpose;
  challenge: string | null;
  totpSecret: string | null;
  attempts: number;
}

// ---------------------------------------------------------------------------
// Relying party (the website, as passkeys see it)
// ---------------------------------------------------------------------------

/**
 * Passkeys are bound to a domain. APP_BASE_URL fixes it in production
 * (rxlibertypharmacy.com) — a passkey made there also works on www. Falls back
 * to the request's own origin for local development (localhost).
 */
export function relyingParty(request: Request): { rpID: string; origins: string[] } {
  const base = new URL(process.env.APP_BASE_URL?.replace(/\/$/, "") || new URL(request.url).origin);
  const rpID = base.hostname.replace(/^www\./, "");
  const origins = new Set([base.origin]);
  if (base.hostname === rpID && rpID !== "localhost") origins.add(`${base.protocol}//www.${rpID}`);
  else if (base.hostname !== rpID) origins.add(`${base.protocol}//${rpID}`);
  return { rpID, origins: [...origins] };
}

// ---------------------------------------------------------------------------
// Pending state
// ---------------------------------------------------------------------------

async function setAuthCookie(token: string, expires: Date): Promise<void> {
  (await cookies()).set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

/** Replaces any step in progress in this browser with a new one. */
export async function startPending(purpose: Purpose, accountId: number | null): Promise<void> {
  const db = await getDb();
  await clearPending();
  const token = generateSessionToken();
  const expires = new Date(Date.now() + PENDING_TTL_MS);
  await db
    .prepare("INSERT INTO auth_pending (token_hash, account_id, purpose, expires_at) VALUES (?, ?, ?, ?)")
    .run(hashSessionToken(token), accountId, purpose, expires.toISOString());
  await setAuthCookie(token, expires);
}

async function getPending(): Promise<Pending | null> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const row = await db
    .prepare("SELECT id, account_id, purpose, challenge, totp_secret, attempts, expires_at FROM auth_pending WHERE token_hash = ?")
    .get<{ id: number; account_id: number | null; purpose: Purpose; challenge: string | null; totp_secret: string | null; attempts: number; expires_at: string }>(
      hashSessionToken(token)
    );
  if (!row) return null;
  if (new Date(row.expires_at) <= new Date()) {
    await db.prepare("DELETE FROM auth_pending WHERE id = ?").run(row.id);
    return null;
  }
  return {
    id: row.id,
    accountId: row.account_id,
    purpose: row.purpose,
    challenge: row.challenge,
    totpSecret: row.totp_secret,
    attempts: row.attempts,
  };
}

export async function clearPending(): Promise<void> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.prepare("DELETE FROM auth_pending WHERE token_hash = ?").run(hashSessionToken(token));
  }
  store.delete(AUTH_COOKIE);
}

/** Counts a failed attempt; the step is destroyed after MAX_ATTEMPTS. */
async function failAttempt(p: Pending, message = "That didn't work. Please try again."): Promise<{ ok: false; error: string; status: number }> {
  const db = await getDb();
  if (p.attempts + 1 >= MAX_ATTEMPTS) {
    await clearPending();
    return { ok: false, error: "Too many attempts. Please sign in again.", status: 429 };
  }
  await db.prepare("UPDATE auth_pending SET attempts = attempts + 1 WHERE id = ?").run(p.id);
  return { ok: false, error: message, status: 401 };
}

const expired = { ok: false as const, error: "Your sign-in has expired. Please start again.", status: 401 };

// ---------------------------------------------------------------------------
// What an account has
// ---------------------------------------------------------------------------

export interface Factors {
  passkeys: number;
  totp: boolean;
  recoveryCodesLeft: number;
}

export async function getFactors(accountId: number): Promise<Factors> {
  const db = await getDb();
  const pk = await db.prepare("SELECT COUNT(*) AS n FROM webauthn_credentials WHERE account_id = ?").get<{ n: string | number }>(accountId);
  const rc = await db
    .prepare("SELECT COUNT(*) AS n FROM recovery_codes WHERE account_id = ? AND used_at IS NULL")
    .get<{ n: string | number }>(accountId);
  const acct = await db.prepare("SELECT totp_secret FROM accounts WHERE id = ?").get<{ totp_secret: string | null }>(accountId);
  return { passkeys: Number(pk?.n ?? 0), totp: Boolean(acct?.totp_secret), recoveryCodesLeft: Number(rc?.n ?? 0) };
}

export const hasAnyFactor = (f: Factors) => f.passkeys > 0 || f.totp;

/**
 * After the password is accepted (device mode): either ask for the second
 * factor, or — for an account with none yet, or one staff just reset — go
 * straight to setting one up.
 */
export async function afterPasswordAccepted(accountId: number): Promise<{ next: "device"; methods: { passkey: boolean; totp: boolean } } | { next: "setup" }> {
  const db = await getDb();
  const acct = await db.prepare("SELECT must_change_password FROM accounts WHERE id = ?").get<{ must_change_password: number }>(accountId);
  const f = await getFactors(accountId);
  if (acct?.must_change_password === 1 || !hasAnyFactor(f)) {
    await startPending("enroll", accountId);
    return { next: "setup" };
  }
  await startPending("second_factor", accountId);
  return { next: "device", methods: { passkey: f.passkeys > 0, totp: f.totp } };
}

// ---------------------------------------------------------------------------
// Setting up a factor (new account, after a reset, or from the Security page)
// ---------------------------------------------------------------------------

/**
 * The account being set up: a pending "enroll" step from sign-up/sign-in, or
 * the signed-in patient (Security page), who gets an enroll step of their own
 * so the challenge/secret in progress has somewhere to live.
 */
async function enrollContext(): Promise<{ pending: Pending; accountId: number; signedIn: boolean } | null> {
  const p = await getPending();
  if (p && p.purpose === "enroll" && p.accountId) return { pending: p, accountId: p.accountId, signedIn: false };
  const sessionAccount = await getSessionAccountId();
  if (!sessionAccount) return null;
  if (!p || p.purpose !== "enroll" || p.accountId !== sessionAccount) await startPending("enroll", sessionAccount);
  const fresh = await getPending();
  return fresh ? { pending: fresh, accountId: sessionAccount, signedIn: true } : null;
}

export async function enrollStatus(): Promise<{ active: boolean; signedIn: boolean; mustChangePassword: boolean; factors: Factors | null }> {
  const p = await getPending();
  const sessionAccount = await getSessionAccountId();
  const accountId = p?.purpose === "enroll" && p.accountId ? p.accountId : sessionAccount;
  if (!accountId) return { active: false, signedIn: false, mustChangePassword: false, factors: null };
  const db = await getDb();
  const acct = await db.prepare("SELECT must_change_password FROM accounts WHERE id = ?").get<{ must_change_password: number }>(accountId);
  return {
    active: true,
    signedIn: Boolean(sessionAccount) && sessionAccount === accountId,
    mustChangePassword: acct?.must_change_password === 1,
    factors: await getFactors(accountId),
  };
}

/** After a staff reset: the patient replaces the temporary password first. */
export async function setNewPassword(password: string, ip?: string): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const p = await getPending();
  if (!p || p.purpose !== "enroll" || !p.accountId) return expired;
  const db = await getDb();
  await db
    .prepare("UPDATE accounts SET password_hash = ?, must_change_password = 0, failed_logins = 0, locked_until = NULL WHERE id = ?")
    .run(hashPassword(password), p.accountId);
  await audit({ actor: `account:${p.accountId}`, action: "auth.device.password_changed", outcome: "success", ip });
  return { ok: true };
}

async function mustChangePassword(accountId: number): Promise<boolean> {
  const db = await getDb();
  const acct = await db.prepare("SELECT must_change_password FROM accounts WHERE id = ?").get<{ must_change_password: number }>(accountId);
  return acct?.must_change_password === 1;
}

const changePasswordFirst = { ok: false as const, error: "Please choose a new password first.", status: 409 };

/**
 * A factor was just added. The first time, issue recovery codes (returned so
 * the page can show them once); then end the pending step and, unless already
 * signed in, sign the patient in.
 */
async function finishEnrollment(accountId: number, signedIn: boolean): Promise<{ ok: true; recoveryCodes?: string[] }> {
  const f = await getFactors(accountId);
  const recoveryCodes = f.recoveryCodesLeft === 0 ? await issueRecoveryCodes(accountId) : undefined;
  await clearPending();
  if (!signedIn) await createSession(accountId);
  return { ok: true, ...(recoveryCodes ? { recoveryCodes } : {}) };
}

export async function passkeyRegistrationOptions(request: Request) {
  const ctx = await enrollContext();
  if (!ctx) return expired;
  if (await mustChangePassword(ctx.accountId)) return changePasswordFirst;
  const db = await getDb();
  const acct = await db.prepare("SELECT email FROM accounts WHERE id = ?").get<{ email: string }>(ctx.accountId);
  const existing = await db
    .prepare("SELECT credential_id, transports FROM webauthn_credentials WHERE account_id = ?")
    .all<{ credential_id: string; transports: string | null }>(ctx.accountId);
  const { rpID } = relyingParty(request);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: acct?.email ?? `account-${ctx.accountId}`,
    userDisplayName: acct?.email ?? "",
    userID: new TextEncoder().encode(`account:${ctx.accountId}`),
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({ id: c.credential_id, transports: parseTransports(c.transports) })),
    // Discoverable, so "Sign in with a passkey" works without typing an email.
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  await db.prepare("UPDATE auth_pending SET challenge = ? WHERE id = ?").run(options.challenge, ctx.pending.id);
  return { ok: true as const, options };
}

export async function passkeyRegistrationVerify(request: Request, response: RegistrationResponseJSON, ip?: string) {
  const ctx = await enrollContext();
  if (!ctx || !ctx.pending.challenge) return expired;
  if (await mustChangePassword(ctx.accountId)) return changePasswordFirst;
  const { rpID, origins } = relyingParty(request);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: ctx.pending.challenge,
      expectedOrigin: origins,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch {
    verification = null;
  }
  if (!verification?.verified || !verification.registrationInfo) {
    await audit({ actor: `account:${ctx.accountId}`, action: "auth.device.passkey_added", outcome: "failure", ip });
    return failAttempt(ctx.pending);
  }
  const { credential, credentialBackedUp } = verification.registrationInfo;
  const db = await getDb();
  await db
    .prepare(
      "INSERT INTO webauthn_credentials (account_id, credential_id, public_key, counter, transports, backed_up) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (credential_id) DO NOTHING"
    )
    .run(
      ctx.accountId,
      credential.id,
      Buffer.from(credential.publicKey).toString("base64url"),
      credential.counter,
      JSON.stringify(credential.transports ?? []),
      credentialBackedUp ? 1 : 0
    );
  await audit({ actor: `account:${ctx.accountId}`, action: "auth.device.passkey_added", outcome: "success", ip });
  return finishEnrollment(ctx.accountId, ctx.signedIn);
}

/** A new authenticator seed for this step, shown as a QR code and as text. */
export async function totpSetup() {
  const ctx = await enrollContext();
  if (!ctx) return expired;
  if (await mustChangePassword(ctx.accountId)) return changePasswordFirst;
  const db = await getDb();
  const acct = await db.prepare("SELECT email FROM accounts WHERE id = ?").get<{ email: string }>(ctx.accountId);
  // Same key for the whole setup step: pressing Back or the button again must
  // not replace a key the patient has already scanned.
  const secret = ctx.pending.totpSecret ? decryptPHI(ctx.pending.totpSecret) : generateSecret();
  if (!ctx.pending.totpSecret) {
    await db.prepare("UPDATE auth_pending SET totp_secret = ? WHERE id = ?").run(encryptPHI(secret), ctx.pending.id);
  }
  const uri = generateURI({ issuer: RP_NAME, label: acct?.email ?? "Patient portal", secret });
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
  return { ok: true as const, secret, qr };
}

export async function totpConfirm(code: string, ip?: string) {
  const ctx = await enrollContext();
  if (!ctx || !ctx.pending.totpSecret) return expired;
  if (await mustChangePassword(ctx.accountId)) return changePasswordFirst;
  const secret = decryptPHI(ctx.pending.totpSecret);
  const step = checkTotp(secret, code);
  if (step === null) {
    await audit({ actor: `account:${ctx.accountId}`, action: "auth.device.totp_added", outcome: "failure", ip });
    return failAttempt(
      ctx.pending,
      "That code doesn't match. If Liberty Pharmacy is already in your app from an earlier setup, delete that entry, scan this QR code again and use the new code."
    );
  }
  const db = await getDb();
  await db
    .prepare("UPDATE accounts SET totp_secret = ?, totp_last_step = ? WHERE id = ?")
    .run(encryptPHI(secret), step, ctx.accountId);
  await audit({ actor: `account:${ctx.accountId}`, action: "auth.device.totp_added", outcome: "success", ip });
  return finishEnrollment(ctx.accountId, ctx.signedIn);
}

// ---------------------------------------------------------------------------
// Signing in
// ---------------------------------------------------------------------------

/** Returns the accepted time step, or null. */
function checkTotp(secret: string, code: string): number | null {
  try {
    const r = verifySync({ secret, token: code, epochTolerance: TOTP_EPOCH_TOLERANCE_SEC });
    return r.valid && "timeStep" in r ? r.timeStep : null; // the matched step, not the current one
  } catch {
    return null; // malformed code or seed — a failure, never a pass
  }
}

async function signInComplete(accountId: number, how: string, ip?: string) {
  await clearPending();
  const db = await getDb();
  await db.prepare("UPDATE accounts SET failed_logins = 0, locked_until = NULL WHERE id = ?").run(accountId);
  await createSession(accountId);
  await audit({ actor: `account:${accountId}`, action: "auth.login", outcome: "success", detail: `device:${how}`, ip });
}

/** Second step after the password: a code from the authenticator app. */
export async function verifyTotpLogin(code: string, ip?: string) {
  const p = await getPending();
  if (!p || p.purpose !== "second_factor" || !p.accountId) return expired;
  const db = await getDb();
  const acct = await db
    .prepare("SELECT totp_secret, totp_last_step FROM accounts WHERE id = ?")
    .get<{ totp_secret: string | null; totp_last_step: string | number | null }>(p.accountId);
  const step = acct?.totp_secret ? checkTotp(decryptPHI(acct.totp_secret), code) : null;
  // A code is accepted once: a step at or before the last one used is a replay.
  if (step === null) {
    await audit({ actor: `account:${p.accountId}`, action: "auth.login", outcome: "failure", detail: "device:bad_totp", ip });
    return failAttempt(p, "That code didn't work. Check you're using the Liberty Pharmacy entry in your app and try the current code.");
  }
  if (acct?.totp_last_step != null && step <= Number(acct.totp_last_step)) {
    await audit({ actor: `account:${p.accountId}`, action: "auth.login", outcome: "failure", detail: "device:totp_reused", ip });
    return failAttempt(p, "That code was already used. Wait for your app to show a new code, then enter it.");
  }
  await db.prepare("UPDATE accounts SET totp_last_step = ? WHERE id = ?").run(step, p.accountId);
  await signInComplete(p.accountId, "totp", ip);
  return { ok: true as const };
}

/** Second step after the password: a one-time recovery code. */
export async function verifyRecoveryLogin(code: string, ip?: string) {
  const p = await getPending();
  if (!p || p.purpose !== "second_factor" || !p.accountId) return expired;
  const db = await getDb();
  const used = await db
    .prepare("UPDATE recovery_codes SET used_at = ? WHERE id = (SELECT id FROM recovery_codes WHERE account_id = ? AND code_hash = ? AND used_at IS NULL LIMIT 1)")
    .run(new Date().toISOString(), p.accountId, hashRecoveryCode(code));
  if (used.changes !== 1) {
    await audit({ actor: `account:${p.accountId}`, action: "auth.login", outcome: "failure", detail: "device:bad_recovery_code", ip });
    return failAttempt(p);
  }
  await signInComplete(p.accountId, "recovery_code", ip);
  return { ok: true as const };
}

/**
 * Passkey sign-in options. During the second step after a password this asks
 * for one of that account's passkeys; otherwise it starts a passkey-only
 * sign-in where the browser offers whichever passkeys it has for this site.
 */
export async function passkeyLoginOptions(request: Request) {
  const { rpID } = relyingParty(request);
  let p = await getPending();
  const db = await getDb();
  let allowCredentials: { id: string; transports?: string[] }[] | undefined;
  if (p?.purpose === "second_factor" && p.accountId) {
    const creds = await db
      .prepare("SELECT credential_id, transports FROM webauthn_credentials WHERE account_id = ?")
      .all<{ credential_id: string; transports: string | null }>(p.accountId);
    allowCredentials = creds.map((c) => ({ id: c.credential_id, transports: parseTransports(c.transports) }));
  } else {
    await startPending("passkey_login", null);
    p = await getPending();
  }
  if (!p) return expired;
  const options = await generateAuthenticationOptions({ rpID, allowCredentials, userVerification: "required" });
  await db.prepare("UPDATE auth_pending SET challenge = ? WHERE id = ?").run(options.challenge, p.id);
  return { ok: true as const, options };
}

type CredRow = { id: number; account_id: number; credential_id: string; public_key: string; counter: string | number; transports: string | null };

/**
 * Checks a passkey signature against the challenge of the step in progress.
 * Does not update the counter — callers do that once they accept it.
 */
async function checkPasskeyAssertion(
  request: Request,
  response: AuthenticationResponseJSON,
  challenge: string
): Promise<{ kind: "unknown" } | { kind: "bad"; accountId: number } | { kind: "ok"; cred: CredRow; newCounter: number }> {
  const db = await getDb();
  const cred = await db
    .prepare("SELECT id, account_id, credential_id, public_key, counter, transports FROM webauthn_credentials WHERE credential_id = ?")
    .get<CredRow>(response.id);
  if (!cred) return { kind: "unknown" };
  const { rpID, origins } = relyingParty(request);
  try {
    const v = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origins,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: cred.credential_id,
        publicKey: new Uint8Array(Buffer.from(cred.public_key, "base64url")),
        counter: Number(cred.counter),
        transports: parseTransports(cred.transports),
      },
    });
    if (v.verified) return { kind: "ok", cred, newCounter: v.authenticationInfo.newCounter };
  } catch {
    // malformed or forged response — a failure, never a pass
  }
  return { kind: "bad", accountId: cred.account_id };
}

async function markPasskeyUsed(credId: number, newCounter: number): Promise<void> {
  const db = await getDb();
  await db
    .prepare("UPDATE webauthn_credentials SET counter = ?, last_used_at = ? WHERE id = ?")
    .run(newCounter, new Date().toISOString(), credId);
}

export async function passkeyLoginVerify(request: Request, response: AuthenticationResponseJSON, ip?: string) {
  const p = await getPending();
  if (!p || !p.challenge || (p.purpose !== "passkey_login" && p.purpose !== "second_factor")) return expired;
  const r = await checkPasskeyAssertion(request, response, p.challenge);
  // In the second step the passkey must belong to the account whose password was given.
  if (r.kind === "unknown" || (p.purpose === "second_factor" && (r.kind === "ok" ? r.cred.account_id : r.accountId) !== p.accountId)) {
    await audit({ actor: "anonymous", action: "auth.login", outcome: "failure", detail: "device:unknown_passkey", ip });
    return failAttempt(p);
  }
  if (r.kind === "bad") {
    await audit({ actor: `account:${r.accountId}`, action: "auth.login", outcome: "failure", detail: "device:bad_passkey", ip });
    return failAttempt(p);
  }
  // A passkey-only sign-in still respects a lockout from failed passwords.
  const db = await getDb();
  const acct = await db.prepare("SELECT locked_until FROM accounts WHERE id = ?").get<{ locked_until: string | null }>(r.cred.account_id);
  if (acct?.locked_until && new Date(acct.locked_until) > new Date()) {
    await audit({ actor: `account:${r.cred.account_id}`, action: "auth.login", outcome: "failure", detail: "device:locked", ip });
    return { ok: false as const, error: "Too many failed attempts. Please try again in a few minutes.", status: 429 };
  }
  await markPasskeyUsed(r.cred.id, r.newCounter);
  await signInComplete(r.cred.account_id, "passkey", ip);
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Change password (signed in)
// ---------------------------------------------------------------------------

/**
 * The patient confirms with a passkey or authenticator code — not the old
 * password, which is the thing they may have forgotten. Being signed in is
 * not enough on its own: an unattended, signed-in browser must not be able to
 * take over the account by changing its password.
 */

const notSignedIn = { ok: false as const, error: "Please sign in again.", status: 401 };

/** Passkey challenge for confirming a password change (one of the signed-in account's passkeys). */
export async function reauthPasskeyOptions(request: Request) {
  const accountId = await getSessionAccountId();
  if (!accountId) return notSignedIn;
  const db = await getDb();
  const creds = await db
    .prepare("SELECT credential_id, transports FROM webauthn_credentials WHERE account_id = ?")
    .all<{ credential_id: string; transports: string | null }>(accountId);
  if (!creds.length) return { ok: false as const, error: "You don't have a passkey on this account.", status: 409 };
  await startPending("second_factor", accountId);
  const p = await getPending();
  if (!p) return notSignedIn;
  const { rpID } = relyingParty(request);
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: creds.map((c) => ({ id: c.credential_id, transports: parseTransports(c.transports) })),
    userVerification: "required",
  });
  await db.prepare("UPDATE auth_pending SET challenge = ? WHERE id = ?").run(options.challenge, p.id);
  return { ok: true as const, options };
}

export async function changePassword(
  request: Request,
  input: { password: string; totpCode?: string; passkeyResponse?: AuthenticationResponseJSON },
  ip?: string
) {
  const accountId = await getSessionAccountId();
  if (!accountId) return notSignedIn;
  const db = await getDb();
  const fail = (detail: string, error: string) =>
    audit({ actor: `account:${accountId}`, action: "auth.device.password_changed", outcome: "failure", detail, ip }).then(() => ({
      ok: false as const,
      error,
      status: 401,
    }));

  if (input.passkeyResponse) {
    const p = await getPending();
    if (!p || p.purpose !== "second_factor" || p.accountId !== accountId || !p.challenge) {
      return { ok: false as const, error: "That took too long. Please try again.", status: 401 };
    }
    const r = await checkPasskeyAssertion(request, input.passkeyResponse, p.challenge);
    if (r.kind !== "ok" || r.cred.account_id !== accountId) {
      await failAttempt(p);
      return fail("bad_passkey", "Your passkey couldn't be confirmed. Please try again.");
    }
    await markPasskeyUsed(r.cred.id, r.newCounter);
    await clearPending();
  } else if (input.totpCode) {
    const acct = await db
      .prepare("SELECT totp_secret, totp_last_step FROM accounts WHERE id = ?")
      .get<{ totp_secret: string | null; totp_last_step: string | number | null }>(accountId);
    const step = acct?.totp_secret ? checkTotp(decryptPHI(acct.totp_secret), input.totpCode) : null;
    if (step === null) return fail("bad_totp", "That code didn't work. Use the current code from your Liberty Pharmacy entry.");
    if (acct?.totp_last_step != null && step <= Number(acct.totp_last_step)) {
      return fail("totp_reused", "That code was already used. Wait for your app to show a new code, then enter it.");
    }
    await db.prepare("UPDATE accounts SET totp_last_step = ? WHERE id = ?").run(step, accountId);
  } else {
    return { ok: false as const, error: "Confirm with your passkey or authenticator app.", status: 400 };
  }

  // Every other signed-in browser is signed out; this one stays signed in.
  const current = (await cookies()).get(SESSION_COOKIE)?.value;
  await db.transaction(async () => {
    await db
      .prepare("UPDATE accounts SET password_hash = ?, must_change_password = 0, failed_logins = 0, locked_until = NULL WHERE id = ?")
      .run(hashPassword(input.password), accountId);
    await db
      .prepare("DELETE FROM sessions WHERE account_id = ? AND token_hash <> ?")
      .run(accountId, current ? hashSessionToken(current) : "");
  });
  await audit({ actor: `account:${accountId}`, action: "auth.device.password_changed", outcome: "success", detail: input.passkeyResponse ? "passkey" : "totp", ip });
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Recovery codes
// ---------------------------------------------------------------------------

// No 0/O/1/I/L, so codes read back over the phone or from paper unambiguously.
const RECOVERY_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(`recovery:${normalizeRecoveryCode(code)}`).digest("hex");
}

/** Replaces all of an account's recovery codes; returns the new ones (shown once). */
export async function issueRecoveryCodes(accountId: number): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const chars = Array.from({ length: 10 }, () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]).join("");
    return `${chars.slice(0, 5)}-${chars.slice(5)}`;
  });
  const db = await getDb();
  await db.transaction(async () => {
    await db.prepare("DELETE FROM recovery_codes WHERE account_id = ?").run(accountId);
    for (const c of codes) {
      await db.prepare("INSERT INTO recovery_codes (account_id, code_hash) VALUES (?, ?)").run(accountId, hashRecoveryCode(c));
    }
  });
  await audit({ actor: `account:${accountId}`, action: "auth.device.recovery_codes_issued", outcome: "success" });
  return codes;
}

// ---------------------------------------------------------------------------
// Security page (signed in)
// ---------------------------------------------------------------------------

export interface PasskeyInfo {
  id: number;
  createdAt: string;
  lastUsedAt: string | null;
  synced: boolean;
}

export async function listPasskeys(accountId: number): Promise<PasskeyInfo[]> {
  const db = await getDb();
  const rows = await db
    .prepare("SELECT id, created_at, last_used_at, backed_up FROM webauthn_credentials WHERE account_id = ? ORDER BY id")
    .all<{ id: number; created_at: string; last_used_at: string | null; backed_up: number }>(accountId);
  return rows.map((r) => ({ id: r.id, createdAt: r.created_at, lastUsedAt: r.last_used_at, synced: r.backed_up === 1 }));
}

const lastFactor = { ok: false as const, error: "Add another passkey or an authenticator app before removing your last one.", status: 409 };

export async function removePasskey(accountId: number, id: number, ip?: string) {
  const f = await getFactors(accountId);
  if (f.passkeys + (f.totp ? 1 : 0) <= 1) return lastFactor;
  const db = await getDb();
  const r = await db.prepare("DELETE FROM webauthn_credentials WHERE id = ? AND account_id = ?").run(id, accountId);
  if (r.changes !== 1) return { ok: false as const, error: "Passkey not found.", status: 404 };
  await audit({ actor: `account:${accountId}`, action: "auth.device.passkey_removed", outcome: "success", ip });
  return { ok: true as const };
}

export async function removeTotp(accountId: number, ip?: string) {
  const f = await getFactors(accountId);
  if (!f.totp) return { ok: true as const };
  if (f.passkeys === 0) return lastFactor;
  const db = await getDb();
  await db.prepare("UPDATE accounts SET totp_secret = NULL, totp_last_step = NULL WHERE id = ?").run(accountId);
  await audit({ actor: `account:${accountId}`, action: "auth.device.totp_removed", outcome: "success", ip });
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Staff reset (Admin → Patients)
// ---------------------------------------------------------------------------

/**
 * For a patient who has lost every factor and every recovery code. Removes
 * all of them, ends every session and step in progress, and sets a one-time
 * temporary password (returned once, for staff to read to the patient over
 * the phone after confirming who they are). Signing in with it goes straight
 * to choosing a new password and adding a new factor.
 */
export async function staffResetSignIn(accountId: number, adminUsername: string, ip?: string): Promise<string | null> {
  const db = await getDb();
  const acct = await db.prepare("SELECT id FROM accounts WHERE id = ?").get<{ id: number }>(accountId);
  if (!acct) return null;
  // 12 characters from the unambiguous alphabet, grouped for reading aloud.
  const raw = Array.from({ length: 12 }, () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]).join("");
  const temporary = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
  await db.transaction(async () => {
    await db.prepare("DELETE FROM webauthn_credentials WHERE account_id = ?").run(accountId);
    await db.prepare("DELETE FROM recovery_codes WHERE account_id = ?").run(accountId);
    await db.prepare("DELETE FROM auth_pending WHERE account_id = ?").run(accountId);
    await db.prepare("DELETE FROM sessions WHERE account_id = ?").run(accountId);
    await db
      .prepare(
        "UPDATE accounts SET password_hash = ?, must_change_password = 1, totp_secret = NULL, totp_last_step = NULL, failed_logins = 0, locked_until = NULL WHERE id = ?"
      )
      .run(hashPassword(temporary), accountId);
  });
  await audit({ actor: `admin:${adminUsername}`, action: "admin.patient.signin_reset", subject: `account:${accountId}`, outcome: "success", ip });
  return temporary;
}

// ---------------------------------------------------------------------------

function parseTransports(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  try {
    const t = JSON.parse(raw);
    return Array.isArray(t) ? (t as string[]) : undefined;
  } catch {
    return undefined;
  }
}
