import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Application-layer encryption for third-party secrets stored at rest
 * (social/API tokens). AES-256-GCM with a key from SECRETS_ENCRYPTION_KEY.
 *
 * Safe, reversible rollout:
 *  - `decryptSecret` returns plaintext values untouched (only decrypts values
 *    carrying the `enc:v1:` prefix), so existing rows keep working and a
 *    backfill can run gradually.
 *  - `encryptSecret` no-ops (returns plaintext) when no key is configured, so
 *    deploying this code before the key is set changes nothing.
 *
 * SECRETS_ENCRYPTION_KEY may be a base64-encoded 32-byte key (preferred,
 * `openssl rand -base64 32`) or any passphrase (derived via scrypt).
 */

const PREFIX = "enc:v1:";
const IV_BYTES = 12;
const TAG_BYTES = 16;

let cachedKey: Buffer | null | undefined;

function getKey(): Buffer | null {
  if (cachedKey !== undefined) {
    return cachedKey;
  }
  const raw = process.env.SECRETS_ENCRYPTION_KEY?.trim();
  if (!raw) {
    cachedKey = null;
    return null;
  }
  const asBase64 = Buffer.from(raw, "base64");
  cachedKey = asBase64.length === 32 ? asBase64 : scryptSync(raw, "canopy-secret-crypto-v1", 32);
  return cachedKey;
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/**
 * Encrypt a secret for storage. Returns the value unchanged when no key is
 * configured (so the app keeps working before SECRETS_ENCRYPTION_KEY is set),
 * logging a one-time warning in production.
 */
let warnedMissingKey = false;
export function encryptSecret(plaintext: string): string {
  if (isEncrypted(plaintext)) {
    return plaintext;
  }
  const key = getKey();
  if (!key) {
    if (!warnedMissingKey && process.env.NODE_ENV === "production") {
      warnedMissingKey = true;
      console.warn("[secret-crypto] SECRETS_ENCRYPTION_KEY not set — secrets stored in plaintext");
    }
    return plaintext;
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

/**
 * Decrypt a stored secret. Plaintext (un-prefixed) values are returned as-is
 * so pre-encryption rows keep working. Throws if an encrypted value is present
 * but no key is configured.
 */
export function decryptSecret(value: string): string {
  if (!isEncrypted(value)) {
    return value;
  }
  const key = getKey();
  if (!key) {
    throw new Error("SECRETS_ENCRYPTION_KEY must be set to decrypt stored secrets.");
  }
  const raw = Buffer.from(value.slice(PREFIX.length), "base64");
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const data = raw.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** Null-safe encrypt. */
export function encryptSecretNullable(value: string | null | undefined): string | null {
  return value == null || value === "" ? (value ?? null) : encryptSecret(value);
}

/** Null-safe decrypt. */
export function decryptSecretNullable(value: string | null | undefined): string | null {
  return value == null ? null : decryptSecret(value);
}
