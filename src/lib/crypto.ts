import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "crypto";

/**
 * Cryptography helpers for HIPAA-conscious data handling.
 *
 *  - PHI columns are encrypted at rest with AES-256-GCM (authenticated
 *    encryption). Each value gets a fresh random IV; ciphertext format is
 *    `v1:<iv b64>:<authTag b64>:<ciphertext b64>`.
 *  - Passwords are hashed with scrypt (N=16384, r=8, p=1) and a per-user
 *    salt. Format: `scrypt:<salt b64>:<hash b64>`.
 *  - Session tokens are stored only as SHA-256 digests so a DB leak cannot
 *    replay live sessions.
 *
 * Key management: PHI_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)
 * set in .env.local. In production this key belongs in a managed secret store
 * (AWS KMS / Secrets Manager, etc.) — see HIPAA-COMPLIANCE.md. Rotating the
 * key requires re-encrypting existing rows (the `v1:` prefix exists so a
 * future `v2:` scheme can coexist during rotation).
 */

function getKey(): Buffer {
  const hex = process.env.PHI_ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "PHI_ENCRYPTION_KEY is missing or invalid. Set a 64-char hex key in .env.local (generate: openssl rand -hex 32)."
    );
  }
  return Buffer.from(hex, "hex");
}

export function encryptPHI(plaintext: string): string {
  if (plaintext === "") return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptPHI(stored: string): string {
  if (stored === "") return "";
  const [version, ivB64, tagB64, dataB64] = stored.split(":");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Unrecognized ciphertext format");
  }
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_PARAMS.keylen, SCRYPT_PARAMS);
  return `scrypt:${salt.toString("base64")}:${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split(":");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = scryptSync(password, Buffer.from(saltB64, "base64"), expected.length, SCRYPT_PARAMS);
  return timingSafeEqual(actual, expected);
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
