import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

/**
 * SQLite data layer — local development stand-in for the eventual
 * BAA-covered production database.
 *
 * HIPAA-conscious design decisions:
 *  - Credentials (accounts) are stored separately from demographics/PHI
 *    (patients). A breach of one table does not expose the other.
 *  - Every PHI column on `patients` is encrypted at rest (AES-256-GCM via
 *    src/lib/crypto.ts) — the DB file never contains plaintext PHI.
 *    Non-PHI operational columns (ids, timestamps, status) stay plaintext.
 *  - `audit_log` records every access/modification of patient data with
 *    actor, action, subject, and timestamp (HIPAA Security Rule §164.312(b)).
 *  - Sessions store only SHA-256 hashes of tokens, with absolute expiry.
 *
 * DRX FIELD MAPPING: `patients` column names deliberately mirror the DRX
 * (drxapp.com) patient record fields so the later integration is a 1:1
 * column-to-field copy. See the mapping table in HIPAA-COMPLIANCE.md.
 * Columns marked [enc] hold AES-256-GCM ciphertext.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "liberty.db");

declare global {
  // eslint-disable-next-line no-var
  var __libertyDb: Database.Database | undefined;
}

function init(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT NOT NULL UNIQUE,        -- login identifier (lowercased)
      password_hash TEXT NOT NULL,               -- scrypt, never plaintext
      failed_logins INTEGER NOT NULL DEFAULT 0,
      locked_until  TEXT,                        -- ISO8601; lockout after repeated failures
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    -- DRX-aligned patient record. [enc] = AES-256-GCM ciphertext at rest.
    CREATE TABLE IF NOT EXISTS patients (
      patient_id     INTEGER PRIMARY KEY AUTOINCREMENT, -- DRX: PatientID
      account_id     INTEGER NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
      first_name     TEXT NOT NULL,  -- [enc] DRX: FirstName
      middle_initial TEXT,           -- [enc] DRX: MI
      last_name      TEXT NOT NULL,  -- [enc] DRX: LastName
      date_of_birth  TEXT NOT NULL,  -- [enc] DRX: DOB (YYYY-MM-DD)
      gender         TEXT NOT NULL,  -- [enc] DRX: Sex (M/F/O/U)
      address1       TEXT NOT NULL,  -- [enc] DRX: Address1
      address2       TEXT,           -- [enc] DRX: Address2
      city           TEXT NOT NULL,  -- [enc] DRX: City
      state          TEXT NOT NULL,  -- [enc] DRX: State (2-letter)
      zip            TEXT NOT NULL,  -- [enc] DRX: Zip
      phone          TEXT,           -- [enc] DRX: Phone (home)
      cell_phone     TEXT NOT NULL,  -- [enc] DRX: CellPhone
      email          TEXT NOT NULL,  -- [enc] DRX: Email (contact copy; login email lives on accounts)
      preferred_language TEXT NOT NULL DEFAULT 'English', -- DRX: Language
      allergies      TEXT,           -- [enc] DRX: Allergies (free text / NKDA)
      medical_conditions TEXT,       -- [enc] DRX: Diseases
      ins_bin        TEXT,           -- [enc] DRX: InsBIN
      ins_pcn        TEXT,           -- [enc] DRX: InsPCN
      ins_group      TEXT,           -- [enc] DRX: InsGroup
      ins_cardholder_id TEXT,        -- [enc] DRX: InsID / CardholderID
      ins_person_code   TEXT,        -- [enc] DRX: PersonCode
      ins_relationship  TEXT,        -- DRX: Relationship (1=self,2=spouse,3=child,4=other)
      delivery_method   TEXT NOT NULL DEFAULT 'pickup', -- DRX: DeliveryMethod (pickup/delivery/mail)
      sms_opt_in     INTEGER NOT NULL DEFAULT 0,        -- DRX: SMSOptIn
      hipaa_ack_at   TEXT NOT NULL,  -- timestamp of Notice of Privacy Practices acknowledgment
      created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash  TEXT NOT NULL UNIQUE,          -- SHA-256 of the cookie token
      account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      expires_at  TEXT NOT NULL,                 -- ISO8601 absolute expiry
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);

    -- HIPAA §164.312(b) audit controls. Never store PHI values here — only
    -- identifiers, actions, and outcomes.
    CREATE TABLE IF NOT EXISTS audit_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      actor       TEXT NOT NULL,                 -- account:<id> | anonymous | system
      action      TEXT NOT NULL,                 -- e.g. auth.register, auth.login.failed, patient.read
      subject     TEXT,                          -- e.g. patient:<id>
      outcome     TEXT NOT NULL,                 -- success | failure
      detail      TEXT,                          -- non-PHI context (reason codes, field names)
      ip          TEXT,
      at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at);
  `);

  return db;
}

/** Reuse one connection across Next.js hot reloads. */
export function getDb(): Database.Database {
  if (!globalThis.__libertyDb) globalThis.__libertyDb = init();
  return globalThis.__libertyDb;
}

export function audit(entry: {
  actor: string;
  action: string;
  subject?: string;
  outcome: "success" | "failure";
  detail?: string;
  ip?: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO audit_log (actor, action, subject, outcome, detail, ip)
       VALUES (@actor, @action, @subject, @outcome, @detail, @ip)`
    )
    .run({ subject: null, detail: null, ip: null, ...entry });
}
