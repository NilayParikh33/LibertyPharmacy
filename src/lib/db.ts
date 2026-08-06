import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";

/**
 * SQLite data layer — local development stand-in for the eventual
 * BAA-covered production database.
 *
 * Uses the classic `sqlite3` driver (not `better-sqlite3`): on this project's
 * dev machine, better-sqlite3's prebuilt native binary reproducibly
 * segfaults on any query — confirmed in isolation with no Next.js involved,
 * across multiple package versions, unrelated to this app's code. `sqlite3`
 * loads and runs correctly here, so the small promise-based wrapper below
 * (`prepare().get/all/run()`, `exec()`, `transaction()`) gives the rest of
 * the codebase the same shape better-sqlite3 had, just async.
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

interface RunResult {
  lastInsertRowid: number;
  changes: number;
}

/** Thin promise-based wrapper matching the small subset of the
 * prepare/get/run/all/exec/transaction shape this app relies on. */
class AppDb {
  constructor(private raw: sqlite3.Database) {}

  exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.raw.exec(sql, (err) => (err ? reject(err) : resolve()));
    });
  }

  prepare(sql: string) {
    const raw = this.raw;
    return {
      get<T = unknown>(...params: unknown[]): Promise<T | undefined> {
        return new Promise((resolve, reject) => {
          raw.get(sql, params, (err, row) => (err ? reject(err) : resolve(row as T | undefined)));
        });
      },
      all<T = unknown>(...params: unknown[]): Promise<T[]> {
        return new Promise((resolve, reject) => {
          raw.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows as T[])));
        });
      },
      run(...params: unknown[]): Promise<RunResult> {
        return new Promise((resolve, reject) => {
          raw.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastInsertRowid: this.lastID, changes: this.changes });
          });
        });
      },
    };
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.exec("BEGIN");
    try {
      const result = await fn();
      await this.exec("COMMIT");
      return result;
    } catch (err) {
      await this.exec("ROLLBACK").catch(() => {});
      throw err;
    }
  }
}

async function init(): Promise<AppDb> {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const raw = await new Promise<sqlite3.Database>((resolve, reject) => {
    const conn = new sqlite3.Database(DB_PATH, (err) => (err ? reject(err) : resolve(conn)));
  });
  const db = new AppDb(raw);
  await db.exec("PRAGMA journal_mode = WAL");
  await db.exec("PRAGMA foreign_keys = ON");

  await db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT NOT NULL UNIQUE,        -- login identifier (lowercased)
      password_hash TEXT NOT NULL,               -- scrypt, never plaintext
      email_verified INTEGER NOT NULL DEFAULT 0, -- 0 until the emailed code is confirmed
      failed_logins INTEGER NOT NULL DEFAULT 0,
      locked_until  TEXT,                        -- ISO8601; lockout after repeated failures
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    -- One-time-code challenges for email verification and login MFA.
    -- The browser holds an opaque pending token (cookie); the emailed 6-digit
    -- code is stored only as a hash. Both expire quickly.
    CREATE TABLE IF NOT EXISTS mfa_pending (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash  TEXT NOT NULL UNIQUE,          -- SHA-256 of the pending cookie token
      account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      purpose     TEXT NOT NULL CHECK (purpose IN ('email_verify','login_mfa')),
      code_hash   TEXT NOT NULL,                 -- SHA-256 of the 6-digit code
      attempts    INTEGER NOT NULL DEFAULT 0,    -- wrong-code count; challenge dies at 5
      expires_at  TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
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

    -- Password reset links. Only the SHA-256 of the emailed token is stored,
    -- so a database leak cannot be used to reset anyone's password. Tokens are
    -- single-use (used_at) and short-lived (expires_at).
    CREATE TABLE IF NOT EXISTS password_resets (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash  TEXT NOT NULL UNIQUE,
      account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      expires_at  TEXT NOT NULL,
      used_at     TEXT,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_resets_account ON password_resets(account_id);

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

  // Migration for databases created before email verification existed.
  const accountCols = await db.prepare("PRAGMA table_info(accounts)").all<{ name: string }>();
  if (!accountCols.some((c) => c.name === "email_verified")) {
    // Pre-existing accounts were created without verification; grandfather them
    // in as verified rather than locking their owners out.
    await db.exec("ALTER TABLE accounts ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1");
  }

  return db;
}

declare global {
  // eslint-disable-next-line no-var
  var __libertyDbPromise: Promise<AppDb> | undefined;
}

/** Reuse one connection across Next.js hot reloads. */
export function getDb(): Promise<AppDb> {
  if (!globalThis.__libertyDbPromise) globalThis.__libertyDbPromise = init();
  return globalThis.__libertyDbPromise;
}

export async function audit(entry: {
  actor: string;
  action: string;
  subject?: string;
  outcome: "success" | "failure";
  detail?: string;
  ip?: string;
}): Promise<void> {
  const db = await getDb();
  const e = { subject: null, detail: null, ip: null, ...entry };
  await db
    .prepare(
      `INSERT INTO audit_log (actor, action, subject, outcome, detail, ip)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(e.actor, e.action, e.subject, e.outcome, e.detail, e.ip);
}
