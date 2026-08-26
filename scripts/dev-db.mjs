#!/usr/bin/env node
/**
 * Local development Postgres.
 *
 *   npm run db          # start (Ctrl-C to stop)
 *
 * Runs a real Postgres server from the `embedded-postgres` package, so local
 * dev needs no Homebrew, Docker, or admin rights. The cluster lives in
 * ./data/pg (gitignored) and persists between runs.
 *
 * Connection details are taken from DATABASE_URL in .env.local, so the app and
 * this script cannot drift apart. This is a DEV CONVENIENCE ONLY — production
 * uses Amazon RDS (see .env.example and HIPAA-COMPLIANCE.md).
 */
import { readFileSync, existsSync } from "fs";
import EmbeddedPostgres from "embedded-postgres";

const DATA_DIR = "./data/pg";

function readEnvFile(path) {
  const env = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = { ...readEnvFile(".env.local"), ...process.env };
if (!env.DATABASE_URL) {
  console.error("\n  DATABASE_URL is not set in .env.local.\n");
  process.exit(1);
}

const url = new URL(env.DATABASE_URL);
if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
  // Guard against pointing this at RDS and trying to boot a local cluster on
  // top of a production connection string.
  console.error(`\n  DATABASE_URL points at ${url.hostname}, not localhost.`);
  console.error("  This script only runs a LOCAL dev database. Aborting.\n");
  process.exit(1);
}

const user = decodeURIComponent(url.username);
const password = decodeURIComponent(url.password);
const database = url.pathname.slice(1);
const port = Number(url.port || 5432);

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user,
  password,
  port,
  persistent: true,
});

const firstRun = !existsSync(DATA_DIR);
if (firstRun) {
  console.log(`  Initialising a new Postgres cluster in ${DATA_DIR} …`);
  console.log("  (first run downloads the Postgres binaries — this takes a minute)");
  await pg.initialise();
}

await pg.start();
console.log(`  Postgres running on port ${port} as "${user}".`);

// The app's own init() creates its tables; this only needs the database to
// exist for it to connect to.
try {
  await pg.createDatabase(database);
  console.log(`  Created database "${database}".`);
} catch {
  console.log(`  Database "${database}" already exists.`);
}

console.log(`\n  Ready. Start the app in another terminal:  npm run dev`);
console.log(`  Press Ctrl-C to stop the database.\n`);

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    if (stopping) return;
    stopping = true;
    console.log("\n  Stopping Postgres …");
    await pg.stop();
    process.exit(0);
  });
}
