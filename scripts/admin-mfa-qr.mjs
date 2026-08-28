#!/usr/bin/env node
/**
 * Prints the admin TOTP enrolment QR code to the terminal.
 *
 *   npm run admin:mfa              local development credentials (.env.local)
 *   npm run admin:mfa -- --prod    live site credentials (AWS Secrets Manager)
 *
 * Scan it with Google Authenticator, 1Password, Authy, or any TOTP app.
 *
 * Production deliberately has different credentials and a different TOTP seed
 * from development, so a leaked dev secret cannot reach the live system. That
 * means two separate entries in your authenticator — label them clearly.
 *
 * Everything below is printed to your own terminal and nowhere else. Keep it
 * off shared screens and out of chat logs, tickets, and screenshots.
 */
import { readFileSync } from "fs";
import { execFileSync } from "child_process";
import QRCode from "qrcode";

const useProd = process.argv.includes("--prod") || process.argv.includes("--production");

function readSecretsManager() {
  // Requires the AWS CLI to be configured; the values never touch disk.
  const raw = execFileSync(
    "aws",
    ["secretsmanager", "get-secret-value", "--secret-id", "liberty-pharmacy/app-secrets",
     "--query", "SecretString", "--output", "text", "--region", "us-east-1"],
    { encoding: "utf8" }
  );
  return JSON.parse(raw);
}

function readEnvFile(path) {
  // Deliberately minimal: a standalone node script gets none of Next.js's
  // automatic .env loading, and this only needs plain KEY=value lines.
  const env = {};
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return env;
  }
  for (const line of text.split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

let env;
if (useProd) {
  try {
    env = readSecretsManager();
  } catch (err) {
    console.error("\n  Could not read AWS Secrets Manager. Is the AWS CLI configured?");
    console.error("  " + String(err.message).split("\n")[0] + "\n");
    process.exit(1);
  }
} else {
  env = { ...readEnvFile(".env.local"), ...process.env };
}

const secret = env.ADMIN_TOTP_SECRET;
const account = env.ADMIN_USERNAME || "admin";

if (!secret) {
  console.error(
    useProd
      ? "\n  ADMIN_TOTP_SECRET is not present in the production secret.\n"
      : "\n  ADMIN_TOTP_SECRET is not set in .env.local.\n"
  );
  process.exit(1);
}

const issuer = useProd ? "Liberty Pharmacy (LIVE)" : "Liberty Pharmacy (dev)";
const uri =
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}` +
  `?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

const qr = await QRCode.toString(uri, { type: "terminal", small: true });

const signInUrl = useProd
  ? "https://rxlibertypharmacy.com/admin/login"
  : "http://localhost:3000/admin/login";

console.log(`\n  Liberty Pharmacy — admin authenticator enrolment`);
console.log(`  Environment: ${useProd ? "PRODUCTION (live site)" : "development (local)"}`);
console.log(`  Sign in at:  ${signInUrl}\n`);
console.log(qr);
console.log(`  Can't scan? Enter this key manually in your authenticator app:\n`);
console.log(`      ${secret.replace(/(.{4})/g, "$1 ").trim()}\n`);
console.log(`  Sign-in credentials`);
console.log(`      Username: ${account}`);
console.log(`      Password: ${env.ADMIN_PASSWORD ?? "(not available — check your secret store)"}\n`);
console.log(`  Enrol a second device or save a backup now — losing this secret`);
console.log(`  locks you out of the admin panel.`);
if (useProd) {
  console.log(`\n  These are the LIVE credentials. They differ from your local ones`);
  console.log(`  on purpose, so a development leak cannot reach real patient data.`);
}
console.log("");
