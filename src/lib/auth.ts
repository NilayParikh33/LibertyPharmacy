import { cookies } from "next/headers";
import { getDb, audit } from "./db";
import {
  encryptPHI,
  decryptPHI,
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashSessionToken,
} from "./crypto";

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
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min — short by design for PHI apps
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

export function registerPatient(
  input: RegistrationInput,
  ip?: string
): { ok: true; accountId: number } | { ok: false; error: string } {
  const db = getDb();
  const email = input.email.trim().toLowerCase();

  const existing = db.prepare("SELECT id FROM accounts WHERE email = ?").get(email);
  if (existing) {
    audit({ actor: "anonymous", action: "auth.register", outcome: "failure", detail: "duplicate_email", ip });
    // Same message as success path would imply — do not confirm which emails exist.
    return { ok: false, error: "Unable to create an account with these details. If you already have an account, please sign in." };
  }

  const createAll = db.transaction(() => {
    const acct = db
      .prepare("INSERT INTO accounts (email, password_hash) VALUES (?, ?)")
      .run(email, hashPassword(input.password));
    const accountId = Number(acct.lastInsertRowid);

    db.prepare(
      `INSERT INTO patients (
        account_id, first_name, middle_initial, last_name, date_of_birth, gender,
        address1, address2, city, state, zip, phone, cell_phone, email,
        preferred_language, allergies, medical_conditions,
        ins_bin, ins_pcn, ins_group, ins_cardholder_id, ins_person_code, ins_relationship,
        delivery_method, sms_opt_in, hipaa_ack_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
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

  const accountId = createAll();
  audit({ actor: `account:${accountId}`, action: "auth.register", subject: `patient:account:${accountId}`, outcome: "success", ip });
  return { ok: true, accountId };
}

export function loginPatient(
  emailRaw: string,
  password: string,
  ip?: string
): { ok: true; accountId: number } | { ok: false; error: string; status: number } {
  const db = getDb();
  const email = emailRaw.trim().toLowerCase();
  const generic = { ok: false as const, error: "Invalid email or password.", status: 401 };

  const acct = db
    .prepare("SELECT id, password_hash, failed_logins, locked_until FROM accounts WHERE email = ?")
    .get(email) as { id: number; password_hash: string; failed_logins: number; locked_until: string | null } | undefined;

  if (!acct) {
    audit({ actor: "anonymous", action: "auth.login", outcome: "failure", detail: "unknown_email", ip });
    return generic;
  }

  if (acct.locked_until && new Date(acct.locked_until) > new Date()) {
    audit({ actor: `account:${acct.id}`, action: "auth.login", outcome: "failure", detail: "locked", ip });
    return { ok: false, error: "Too many failed attempts. Please try again in a few minutes.", status: 429 };
  }

  if (!verifyPassword(password, acct.password_hash)) {
    const failed = acct.failed_logins + 1;
    const lock = failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCKOUT_MS).toISOString() : null;
    db.prepare("UPDATE accounts SET failed_logins = ?, locked_until = ? WHERE id = ?").run(
      lock ? 0 : failed,
      lock,
      acct.id
    );
    audit({ actor: `account:${acct.id}`, action: "auth.login", outcome: "failure", detail: lock ? "bad_password_locked" : "bad_password", ip });
    return generic;
  }

  db.prepare("UPDATE accounts SET failed_logins = 0, locked_until = NULL WHERE id = ?").run(acct.id);
  audit({ actor: `account:${acct.id}`, action: "auth.login", outcome: "success", ip });
  return { ok: true, accountId: acct.id };
}

export async function createSession(accountId: number): Promise<void> {
  const token = generateSessionToken();
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  getDb()
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
  const row = getDb()
    .prepare("SELECT account_id, expires_at FROM sessions WHERE token_hash = ?")
    .get(hashSessionToken(token)) as { account_id: number; expires_at: string } | undefined;
  if (!row) return null;
  if (new Date(row.expires_at) <= new Date()) {
    getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashSessionToken(token));
    return null;
  }
  return row.account_id;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashSessionToken(token));
  }
  store.delete(SESSION_COOKIE);
}

/** Minimal profile for the signed-in portal view. Access is audited. */
export function getPatientProfile(accountId: number, ip?: string): PatientProfile | null {
  const row = getDb()
    .prepare(
      `SELECT patient_id, first_name, last_name, email, cell_phone, delivery_method, preferred_language
       FROM patients WHERE account_id = ?`
    )
    .get(accountId) as
    | { patient_id: number; first_name: string; last_name: string; email: string; cell_phone: string; delivery_method: string; preferred_language: string }
    | undefined;
  if (!row) return null;

  audit({ actor: `account:${accountId}`, action: "patient.read", subject: `patient:${row.patient_id}`, outcome: "success", ip });
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
