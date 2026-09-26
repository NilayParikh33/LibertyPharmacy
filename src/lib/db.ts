import { Pool, type PoolClient, types } from "pg";
import { AsyncLocalStorage } from "async_hooks";
import { readFileSync } from "fs";
import { isRdsDeployment } from "./deployment";

// node-postgres returns BIGINT (e.g. COUNT(*)) as a string by default, to
// avoid silent precision loss beyond Number.MAX_SAFE_INTEGER. Every count in
// this app is small (messages, posts), so parse it back to a plain number —
// matching what every `COUNT(*) AS n` call site here already expects.
types.setTypeParser(20, (val) => parseInt(val, 10));

/**
 * PostgreSQL data layer — production database (previously SQLite during
 * early prototyping; see git history for that version).
 *
 * Connects via `DATABASE_URL` to Amazon RDS for PostgreSQL (BAA-covered
 * account required before real patient data exists — see HIPAA-COMPLIANCE.md).
 * The wrapper below (`prepare().get/all/run()`, `exec()`, `transaction()`)
 * keeps the same shape the rest of the codebase already relies on; callers
 * still use `?` placeholders, which are rewritten to Postgres's `$1, $2, ...`
 * here.
 *
 * RDS connection security:
 *  - TLS is verified against Amazon's own CA bundle (`RDS_CA_BUNDLE_PATH`),
 *    not just "encrypted but unverified" — RDS server certs chain to Amazon's
 *    CA, which isn't in Node's default trust store, so skipping verification
 *    would accept any certificate a MITM presented. `DB_SSL_MODE` can relax
 *    this for a non-RDS managed Postgres (demo/staging only — see
 *    `resolveSsl` below for what each mode does and does not guarantee).
 *  - `DB_AUTH_MODE=iam` swaps the static DB password for a 15-minute IAM
 *    auth token (via `@aws-sdk/rds-signer`), so there's no long-lived DB
 *    credential to leak — requires IAM DB auth enabled on the instance and
 *    an app IAM role/credentials with `rds-db:connect` on that DB user.
 *
 * HIPAA-conscious design decisions:
 *  - Credentials (accounts) are stored separately from demographics/PHI
 *    (patients). A breach of one table does not expose the other.
 *  - Every PHI column on `patients` is encrypted at rest (AES-256-GCM via
 *    src/lib/crypto.ts) — the DB never contains plaintext PHI.
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

// Produces the same ISO-8601-with-milliseconds-and-Z shape the app already
// stores/parses everywhere (kept as TEXT, not TIMESTAMPTZ, so every existing
// `new Date(row.created_at)` call and JSON response keeps working unchanged).
const NOW_ISO = `to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

interface RunResult {
  lastInsertRowid: number;
  changes: number;
}

// Scopes a single pooled client to one transaction's async call tree, so
// concurrent requests can't interleave BEGIN/COMMIT across each other's
// connections the way a shared global connection would.
const txContext = new AsyncLocalStorage<PoolClient>();

function toPgParams(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/** Thin promise-based wrapper matching the small subset of the
 * prepare/get/run/all/exec/transaction shape this app relies on. */
class AppDb {
  constructor(private pool: Pool) {}

  private get client(): Pool | PoolClient {
    return txContext.getStore() ?? this.pool;
  }

  exec(sql: string): Promise<void> {
    return this.client.query(sql).then(() => undefined);
  }

  prepare(sql: string) {
    const text = toPgParams(sql);
    const run = (params: unknown[]) => this.client.query(text, params);
    return {
      async get<T = unknown>(...params: unknown[]): Promise<T | undefined> {
        const { rows } = await run(params);
        return rows[0] as T | undefined;
      },
      async all<T = unknown>(...params: unknown[]): Promise<T[]> {
        const { rows } = await run(params);
        return rows as T[];
      },
      async run(...params: unknown[]): Promise<RunResult> {
        const { rows, rowCount } = await run(params);
        return { lastInsertRowid: (rows[0] as { id?: number } | undefined)?.id ?? 0, changes: rowCount ?? 0 };
      },
    };
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await txContext.run(client, fn);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
}

function resolveSsl(
  connectionString: string
): boolean | { ca: string; rejectUnauthorized: true } | { rejectUnauthorized: boolean } {
  const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
  if (isLocal) return false; // local dev Postgres typically doesn't speak TLS at all

  // DB_SSL_MODE selects how the server certificate is trusted. The default
  // (unset) is the strictest option and the only one used against RDS.
  let mode = process.env.DB_SSL_MODE ?? "verify-ca";
  // RDS is the production patient-data database: it is always verified
  // against Amazon's CA, as at launch. The relaxed modes exist for demo
  // databases only, so a relaxed setting here is overridden, not honoured.
  if (isRdsDeployment() && mode !== "verify-ca") {
    console.error(
      `[db] DB_SSL_MODE="${mode}" is IGNORED for Amazon RDS; using verify-ca (RDS_CA_BUNDLE_PATH). Remove the variable.`
    );
    mode = "verify-ca";
  }
  switch (mode) {
    // Pin to a specific CA bundle. Required for RDS: its server certs chain
    // to Amazon's own CA, which is absent from Node's default trust store, so
    // verifying against the system store alone would reject a valid RDS cert
    // (and skipping verification would accept any cert a MITM presented).
    case "verify-ca": {
      const caBundlePath = process.env.RDS_CA_BUNDLE_PATH;
      if (!caBundlePath) {
        throw new Error(
          "RDS_CA_BUNDLE_PATH is not set — download Amazon's RDS CA bundle and point this at it " +
            "(see .env.example) before connecting to a non-local database. If this database is " +
            "not RDS, set DB_SSL_MODE (see .env.example) to match how its certificate is signed."
        );
      }
      return { ca: readFileSync(caBundlePath, "utf8"), rejectUnauthorized: true };
    }

    // Verify against Node's built-in trust store, for a managed Postgres whose
    // certificate is signed by a publicly trusted CA. Still fully verified —
    // it just isn't pinned to one issuer.
    case "verify-public":
      return { rejectUnauthorized: true };

    // Encrypt but do NOT verify the server certificate. This stops passive
    // eavesdropping but not an active MITM, so it does not meet the
    // transmission-security bar in HIPAA-COMPLIANCE.md. Acceptable only for a
    // demo/staging database holding no patient data.
    case "require":
      return { rejectUnauthorized: false };

    // No TLS at all. Only defensible when the database is reachable solely
    // over a private network the provider terminates (e.g. a platform-internal
    // hostname), never across the public internet, and never with PHI.
    case "disable":
      return false;

    default:
      throw new Error(
        `DB_SSL_MODE="${process.env.DB_SSL_MODE}" is not recognised — ` +
          'use "verify-ca" (default), "verify-public", "require", or "disable".'
      );
  }
}


/** IAM auth token as the DB password: minted fresh (15 min TTL) each time a
 * new physical connection is opened by the pool, via the app's own AWS
 * credentials (IAM role in AWS, or an OIDC-federated role elsewhere). */
function iamPasswordProvider(connectionString: string): () => Promise<string> {
  const { hostname, port, username } = new URL(connectionString);
  return async () => {
    const { Signer } = await import("@aws-sdk/rds-signer");
    const signer = new Signer({
      hostname,
      port: Number(port || 5432),
      username: decodeURIComponent(username),
      region: process.env.AWS_REGION,
    });
    return signer.getAuthToken();
  };
}

async function init(): Promise<AppDb> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — configure it in .env.local (see .env.example).");
  }

  const pool = new Pool({
    connectionString,
    ssl: resolveSsl(connectionString),
    ...(process.env.DB_AUTH_MODE === "iam" ? { password: iamPasswordProvider(connectionString) } : {}),
  });
  const db = new AppDb(pool);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id            SERIAL PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,        -- login identifier (lowercased)
      password_hash TEXT NOT NULL,               -- scrypt, never plaintext
      email_verified INTEGER NOT NULL DEFAULT 0, -- 0 until the emailed code is confirmed
      failed_logins INTEGER NOT NULL DEFAULT 0,
      locked_until  TEXT,                        -- ISO8601; lockout after repeated failures
      created_at    TEXT NOT NULL DEFAULT (${NOW_ISO}),
      updated_at    TEXT NOT NULL DEFAULT (${NOW_ISO})
    );

    -- One-time-code challenges for email verification and login MFA.
    -- The browser holds an opaque pending token (cookie); the emailed 6-digit
    -- code is stored only as a hash. Both expire quickly.
    CREATE TABLE IF NOT EXISTS mfa_pending (
      id          SERIAL PRIMARY KEY,
      token_hash  TEXT NOT NULL UNIQUE,          -- SHA-256 of the pending cookie token
      account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      purpose     TEXT NOT NULL CHECK (purpose IN ('email_verify','login_mfa')),
      code_hash   TEXT NOT NULL,                 -- SHA-256 of the 6-digit code
      attempts    INTEGER NOT NULL DEFAULT 0,    -- wrong-code count; challenge dies at 5
      expires_at  TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (${NOW_ISO})
    );

    -- DRX-aligned patient record. [enc] = AES-256-GCM ciphertext at rest.
    CREATE TABLE IF NOT EXISTS patients (
      patient_id     SERIAL PRIMARY KEY, -- DRX: PatientID
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
      created_at     TEXT NOT NULL DEFAULT (${NOW_ISO}),
      updated_at     TEXT NOT NULL DEFAULT (${NOW_ISO})
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id          SERIAL PRIMARY KEY,
      token_hash  TEXT NOT NULL UNIQUE,          -- SHA-256 of the cookie token
      account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      expires_at  TEXT NOT NULL,                 -- ISO8601 absolute expiry
      created_at  TEXT NOT NULL DEFAULT (${NOW_ISO})
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);

    -- Password reset links. Only the SHA-256 of the emailed token is stored,
    -- so a database leak cannot be used to reset anyone's password. Tokens are
    -- single-use (used_at) and short-lived (expires_at).
    CREATE TABLE IF NOT EXISTS password_resets (
      id          SERIAL PRIMARY KEY,
      token_hash  TEXT NOT NULL UNIQUE,
      account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      expires_at  TEXT NOT NULL,
      used_at     TEXT,
      created_at  TEXT NOT NULL DEFAULT (${NOW_ISO})
    );
    CREATE INDEX IF NOT EXISTS idx_resets_account ON password_resets(account_id);

    -- HIPAA §164.312(b) audit controls. Never store PHI values here — only
    -- identifiers, actions, and outcomes.
    CREATE TABLE IF NOT EXISTS audit_log (
      id          SERIAL PRIMARY KEY,
      actor       TEXT NOT NULL,                 -- account:<id> | anonymous | system
      action      TEXT NOT NULL,                 -- e.g. auth.register, auth.login.failed, patient.read
      subject     TEXT,                          -- e.g. patient:<id>
      outcome     TEXT NOT NULL,                 -- success | failure
      detail      TEXT,                          -- non-PHI context (reason codes, field names)
      ip          TEXT,
      at          TEXT NOT NULL DEFAULT (${NOW_ISO})
    );
    -- NOTE: audit_log's index is created separately, after this block. In
    -- production the table is deliberately owned by another role so the app
    -- cannot UPDATE or DELETE its own audit trail (finding T-07), and
    -- CREATE INDEX requires ownership even when the index already exists.

    -- Internal staff accounts for the admin panel, one row per person.
    -- Separate from the accounts table (patients) on purpose: different
    -- lifecycle,
    -- different auth surface, and no PHI. A distinct row per staff member is
    -- what makes admin actions attributable in audit_log — a single shared
    -- login cannot satisfy §164.312(a)(2)(i) (unique user identification).
    CREATE TABLE IF NOT EXISTS admin_users (
      id            SERIAL PRIMARY KEY,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,               -- scrypt, same scheme as patients
      totp_secret   TEXT NOT NULL,               -- [enc] base32 seed, AES-256-GCM at rest
      disabled_at   TEXT,                        -- set on departure; keeps the audit trail intact
      created_at    TEXT NOT NULL DEFAULT (${NOW_ISO}),
      last_login_at TEXT
    );

    -- Server-side admin sessions, so access can actually be revoked. The
    -- previous stateless signed cookie could not be invalidated before its
    -- own expiry, which meant a stolen cookie stayed usable and a departing
    -- staff member could not be cut off without rotating everyone's secret.
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id            SERIAL PRIMARY KEY,
      token_hash    TEXT NOT NULL UNIQUE,        -- SHA-256 of the cookie token
      admin_user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
      expires_at    TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (${NOW_ISO})
    );
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(admin_user_id);

    -- General-inquiry contact form submissions. The API route screens out
    -- anything that obviously looks like PHI, but free-text screening cannot
    -- be relied on ("my blood pressure medication makes me dizzy" defeats
    -- every pattern), so the identifying and free-text columns are encrypted
    -- at rest like any other PHI. See finding T-06.
    CREATE TABLE IF NOT EXISTS contact_messages (
      id          SERIAL PRIMARY KEY,
      first_name  TEXT NOT NULL,                 -- [enc]
      last_name   TEXT NOT NULL,                 -- [enc]
      email       TEXT NOT NULL,                 -- [enc]
      phone       TEXT,                          -- [enc]
      subject     TEXT NOT NULL,                 -- [enc]
      message     TEXT NOT NULL,                 -- [enc]
      status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','replied')),
      created_at  TEXT NOT NULL DEFAULT (${NOW_ISO})
    );
    CREATE INDEX IF NOT EXISTS idx_contact_messages_created ON contact_messages(created_at);

    -- Blog content, admin-managed. sections_json holds Post["sections"].
    CREATE TABLE IF NOT EXISTS posts (
      id            SERIAL PRIMARY KEY,
      slug          TEXT NOT NULL UNIQUE,
      title         TEXT NOT NULL,
      excerpt       TEXT NOT NULL,
      author        TEXT NOT NULL,
      date          TEXT NOT NULL,
      read_minutes  INTEGER NOT NULL,
      sections_json TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (${NOW_ISO}),
      updated_at    TEXT NOT NULL DEFAULT (${NOW_ISO})
    );

    -- Single-row (id=1) site content, admin-managed. See src/lib/site.ts.
    CREATE TABLE IF NOT EXISTS site_settings (
      id             INTEGER PRIMARY KEY CHECK (id = 1),
      name           TEXT NOT NULL,
      tagline        TEXT NOT NULL,
      phone          TEXT NOT NULL,
      phone_href     TEXT NOT NULL,
      fax            TEXT NOT NULL,
      email          TEXT NOT NULL,
      address_line1  TEXT NOT NULL,
      address_city   TEXT NOT NULL,
      address_state  TEXT NOT NULL,
      address_zip    TEXT NOT NULL,
      address_county TEXT NOT NULL,
      hours_json     TEXT NOT NULL,
      maps_url       TEXT NOT NULL,
      updated_at     TEXT NOT NULL DEFAULT (${NOW_ISO})
    );
  `);

  // audit_log's index, guarded. In production the table is owned by a
  // different role than the application's, so that a compromised app can
  // append to the audit trail but never rewrite or erase it (finding T-07).
  // Postgres requires table ownership for CREATE INDEX even with IF NOT
  // EXISTS, so check first and only issue the DDL when it's genuinely
  // missing — otherwise every boot would fail with "must be owner".
  const auditIndex = await db
    .prepare("SELECT 1 AS present FROM pg_indexes WHERE schemaname = 'public' AND indexname = ?")
    .get<{ present: number }>("idx_audit_at");
  if (!auditIndex) {
    await db.exec("CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at);");
  }

  // One-time seed: preserves the content that used to live hardcoded in
  // src/lib/posts.ts and src/lib/site.ts so the admin panel has a starting
  // point instead of an empty blog / blank site info.
  const postCount = await db.prepare("SELECT COUNT(*) AS n FROM posts").get<{ n: number }>();
  if (postCount?.n === 0) {
    await db
      .prepare(
        `INSERT INTO posts (slug, title, excerpt, author, date, read_minutes, sections_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        "embracing-wellness",
        "Embracing Wellness: Your Guide to a Healthier Lifestyle",
        "Your health and well-being are our top priorities. Explore key insights and everyday habits to unlock a healthier you.",
        "Liberty Pharmacy Team",
        "2026-07-15",
        3,
        JSON.stringify([
          {
            heading: "The Liberty Commitment",
            body: "At Liberty Pharmacy, we go beyond being just a pharmacy — we are your partners in wellness. Our commitment extends to personalized care and support from our experienced team of pharmacists, guiding you on your unique path to better health.",
          },
          {
            heading: "Convenience Without Compromise",
            body: "Managing your health should be effortless. Refills ready in minutes, free local delivery, and medication synchronization mean fewer trips and fewer missed doses — with our online patient portal on the way to make it even easier.",
          },
          {
            heading: "Wellness Essentials In Store",
            body: "From vitamins and supplements to first aid and everyday self-care products, our shelves are curated to support your whole-health journey — and our pharmacists can help you choose what actually works.",
          },
        ])
      );
  }

  const settingsRow = await db.prepare("SELECT id FROM site_settings WHERE id = 1").get();
  if (!settingsRow) {
    await db
      .prepare(
        `INSERT INTO site_settings (
          id, name, tagline, phone, phone_href, fax, email,
          address_line1, address_city, address_state, address_zip, address_county,
          hours_json, maps_url
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        "Liberty Pharmacy",
        "Your local independent pharmacy in Austin, Texas",
        "(512) 249-7500",
        "tel:+15122497500",
        "(512) 249-7512",
        "info@libertypharmacyatx.com",
        "8650 Spicewood Springs Rd #106",
        "Austin",
        "TX",
        "78759",
        "Travis",
        JSON.stringify([
          { days: "Mon – Fri", hours: "9:00 AM – 6:00 PM" },
          { days: "Saturday", hours: "Closed" },
          { days: "Sunday", hours: "Closed" },
        ]),
        "https://www.google.com/maps?q=8650+Spicewood+Springs+Rd+%23106+Austin+TX+78759"
      );
  }

  return db;
}

declare global {
  // eslint-disable-next-line no-var
  var __libertyDbPromise: Promise<AppDb> | undefined;
}

/**
 * Reuse one pool across Next.js hot reloads.
 *
 * Only a *successful* init is cached. If the database is unreachable when the
 * first request arrives (a restart, a managed-Postgres blip during deploy),
 * caching the rejected promise would make every later request fail too — the
 * site would return 500s until the Node process restarted, even after the
 * database came back. Clearing it lets the next request retry. A failed init
 * leaves nothing to clean up: the pool opens no sockets until first use.
 */
export function getDb(): Promise<AppDb> {
  if (!globalThis.__libertyDbPromise) {
    globalThis.__libertyDbPromise = init().catch((err) => {
      globalThis.__libertyDbPromise = undefined;
      throw err;
    });
  }
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
