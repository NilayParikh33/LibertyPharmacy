#!/usr/bin/env node
/**
 * Prints the admin TOTP enrolment QR code to the terminal.
 *
 *   npm run admin:mfa
 *
 * Scan it with Google Authenticator, 1Password, Authy, or any TOTP app. The
 * secret is read from .env.local and only ever printed to your own terminal —
 * keep it off shared screens and out of chat logs, tickets, and screenshots.
 */
import { readFileSync } from "fs";
import QRCode from "qrcode";

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

const env = { ...readEnvFile(".env.local"), ...process.env };
const secret = env.ADMIN_TOTP_SECRET;
const account = env.ADMIN_USERNAME || "admin";

if (!secret) {
  console.error("\n  ADMIN_TOTP_SECRET is not set in .env.local.\n");
  process.exit(1);
}

const issuer = "Liberty Pharmacy Admin";
const uri =
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}` +
  `?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

const qr = await QRCode.toString(uri, { type: "terminal", small: true });

console.log(`\n  Liberty Pharmacy — admin authenticator enrolment`);
console.log(`  Account: ${account}\n`);
console.log(qr);
console.log(`  Can't scan? Enter this key manually in your authenticator app:\n`);
console.log(`      ${secret.replace(/(.{4})/g, "$1 ").trim()}\n`);
console.log(`  Then sign in at /admin/login with your password and the 6-digit code.`);
console.log(`  Enrol a second device or save a backup now — losing this secret`);
console.log(`  locks you out of the admin panel.\n`);
