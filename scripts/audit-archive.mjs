#!/usr/bin/env node
/**
 * Archives audit_log entries to S3, and reports on them.
 *
 *   npm run audit:report                 summary for the last 90 days
 *   npm run audit:report -- --days 30    summary for a chosen window
 *   npm run audit:archive                archive everything before this month
 *   npm run audit:archive -- --month 2026-08
 *
 * WHY THIS EXISTS (finding T-07)
 *
 * HIPAA requires audit records to be retained for six years
 * (§164.316(b)(2)(i)) and reviewed regularly (§164.308(a)(1)(ii)(D)).
 *
 * Retention was not actually satisfied by the database alone. RDS backups are
 * kept 30 days, so an audit entry older than that existed in exactly one
 * place — the live table. Losing the instance would have destroyed years of
 * audit history that the law requires you to still hold.
 *
 * Archives are written to a bucket with S3 Object Lock set to a six-year
 * retention, so an archived file cannot be deleted or overwritten by the
 * application, by a compromised credential, or by an ordinary administrator.
 *
 * Rows are NOT deleted from the database after archiving. The application
 * role has no DELETE privilege on audit_log by design, and at this volume
 * keeping both copies costs almost nothing. Archiving adds a durable second
 * copy; it is not a way to prune the table.
 */
import { execFileSync } from "child_process";
import { writeFileSync, unlinkSync, readFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import pg from "pg";

const BUCKET = "liberty-pharmacy-audit-archive-429186228745";
const REGION = "us-east-1";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/** DATABASE_URL from the environment, .env.local, or AWS Secrets Manager. */
function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  if (existsSync(".env.local")) {
    const m = /^DATABASE_URL=(.*)$/m.exec(readFileSync(".env.local", "utf8"));
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }

  const raw = execFileSync(
    "aws",
    ["secretsmanager", "get-secret-value", "--secret-id", "liberty-pharmacy/database-url",
     "--query", "SecretString", "--output", "text", "--region", REGION],
    { encoding: "utf8" }
  );
  return JSON.parse(raw).DATABASE_URL;
}

async function connect() {
  const client = new pg.Client({ connectionString: resolveDatabaseUrl() });
  await client.connect();
  return client;
}

/**
 * Periodic review (§164.308(a)(1)(ii)(D)).
 *
 * Prints what a reviewer actually needs to notice: failed sign-ins, which
 * accounts they targeted, and who has been reading patient data. Logging
 * without reviewing satisfies the audit-controls requirement but not this
 * separate one.
 */
async function report(days) {
  const db = await connect();
  const since = new Date(Date.now() - days * 86400_000).toISOString();

  const q = async (sql, params = [since]) => (await db.query(sql, params)).rows;

  const total = await q("SELECT count(*)::int n FROM audit_log WHERE at >= $1");
  const byAction = await q(
    `SELECT action, outcome, count(*)::int n FROM audit_log WHERE at >= $1
      GROUP BY action, outcome ORDER BY n DESC LIMIT 20`
  );
  const failures = await q(
    `SELECT actor, count(*)::int n, max(at) AS last_seen FROM audit_log
      WHERE at >= $1 AND outcome = 'failure'
      GROUP BY actor ORDER BY n DESC LIMIT 10`
  );
  const failIps = await q(
    `SELECT ip, count(*)::int n FROM audit_log
      WHERE at >= $1 AND outcome = 'failure' AND ip IS NOT NULL
      GROUP BY ip ORDER BY n DESC LIMIT 10`
  );

  console.log(`\n  Audit review — last ${days} days (since ${since.slice(0, 10)})`);
  console.log(`  ${"=".repeat(58)}`);
  console.log(`  Total events: ${total[0].n}\n`);

  console.log("  Activity by type");
  if (!byAction.length) console.log("    (none)");
  for (const r of byAction) {
    console.log(`    ${String(r.n).padStart(6)}  ${r.action.padEnd(28)} ${r.outcome}`);
  }

  console.log("\n  Failures by actor  <- investigate repeated entries");
  if (!failures.length) console.log("    (none)");
  for (const r of failures) {
    console.log(`    ${String(r.n).padStart(6)}  ${String(r.actor).padEnd(34)} last ${r.last_seen}`);
  }

  console.log("\n  Failures by source address");
  if (!failIps.length) console.log("    (none)");
  for (const r of failIps) console.log(`    ${String(r.n).padStart(6)}  ${r.ip}`);

  console.log(`
  Reviewer: record that you performed this review, the date, and anything
  you followed up on. An unreviewed log does not satisfy §164.308(a)(1)(ii)(D).
`);
  await db.end();
}

/** Exports one calendar month to newline-delimited JSON and uploads it. */
async function archive(month) {
  const start = `${month}-01T00:00:00.000Z`;
  const [y, m] = month.split("-").map(Number);
  const end = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1)).toISOString();

  const db = await connect();
  const { rows } = await db.query(
    "SELECT * FROM audit_log WHERE at >= $1 AND at < $2 ORDER BY id",
    [start, end]
  );
  await db.end();

  if (rows.length === 0) {
    console.log(`  No audit entries for ${month} — nothing to archive.`);
    return;
  }

  const body = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
  const tmp = join(tmpdir(), `audit-${month}.ndjson`);
  writeFileSync(tmp, body);

  const key = `audit-log/${month.slice(0, 4)}/audit-${month}.ndjson`;
  try {
    // --if-none-match "*" makes this a conditional write: it fails if the key
    // already exists. Object Lock alone does not prevent this — it protects a
    // *version* from deletion, but an overwrite simply adds a newer version
    // that becomes what readers get by default. The bucket policy enforces the
    // same condition, so an archive cannot be silently replaced even by a
    // caller that skips this script.
    execFileSync(
      "aws",
      ["s3api", "put-object", "--bucket", BUCKET, "--key", key,
       "--body", tmp, "--content-type", "application/x-ndjson",
       "--if-none-match", "*", "--region", REGION],
      { stdio: "pipe" }
    );
    console.log(`  Archived ${rows.length} entries for ${month}`);
    console.log(`    s3://${BUCKET}/${key}`);
    console.log(`    Locked against deletion or modification for 6 years.`);
  } catch (err) {
    const msg = String(err.stderr ?? err.message);
    if (/PreconditionFailed|already exists|Access Denied/i.test(msg)) {
      console.error(`  ${month} is already archived — refusing to overwrite it.`);
      console.error(`    s3://${BUCKET}/${key}`);
      console.error(`    Archives are immutable by design. If the existing file is`);
      console.error(`    genuinely wrong, that is an incident to investigate, not to`);
      console.error(`    overwrite.`);
      process.exitCode = 1;
    } else {
      throw err;
    }
  } finally {
    unlinkSync(tmp);
  }
}

const mode = process.argv[2];
if (mode === "report") {
  await report(Number(arg("days", "90")));
} else if (mode === "archive") {
  // Default to last month: the current month is still being written to.
  const now = new Date();
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  await archive(arg("month", prev.toISOString().slice(0, 7)));
} else {
  console.error("\n  Usage: audit-archive.mjs report [--days N] | archive [--month YYYY-MM]\n");
  process.exit(1);
}
