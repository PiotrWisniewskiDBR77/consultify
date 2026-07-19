/**
 * AES-256-GCM symmetric encryption for integration secrets (CalDAV credentials,
 * OAuth access/refresh tokens) stored at rest in the DB.
 *
 * Requires INTEGRATION_ENCRYPT_KEY env var — a 64-char hex string (32 bytes).
 * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * If the key is absent the module degrades gracefully: encrypt() returns the
 * plaintext unchanged (with a one-time WARNING) and decrypt() transparently
 * handles both encrypted ("enc:iv:ct:tag") and legacy plaintext values.
 *
 * Stored format: "enc:<16-byte IV hex>:<ciphertext hex>:<16-byte auth tag hex>"
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

import Logger from './Logger.js';

const ALGO = 'aes-256-gcm';
const ENC_PREFIX = 'enc:';
let keyWarningEmitted = false;

function getKey(): Buffer | null {
  const raw = process.env.INTEGRATION_ENCRYPT_KEY || '';
  if (!raw) {
    if (!keyWarningEmitted) {
      Logger.warn(
        '[secretEncryption] INTEGRATION_ENCRYPT_KEY not set — integration secrets stored as plaintext. Set this env var to enable encryption at rest.'
      );
      keyWarningEmitted = true;
    }
    return null;
  }
  if (raw.length !== 64 || !/^[0-9a-fA-F]+$/.test(raw)) {
    Logger.error(
      '[secretEncryption] INTEGRATION_ENCRYPT_KEY must be a 64-char hex string (32 bytes). Falling back to plaintext.'
    );
    return null;
  }
  return Buffer.from(raw, 'hex');
}

/**
 * True when a valid encryption key is configured (encrypt-at-rest is active).
 * Callers use this to decide whether lazy re-encryption of legacy plaintext
 * rows is worth attempting.
 */
export function encryptionEnabled(): boolean {
  return getKey() !== null;
}

/**
 * True when `stored` is in the encrypted "enc:iv:ct:tag" format. A false result
 * means the value is legacy plaintext (or empty) and — when encryptionEnabled()
 * — a candidate for lazy re-encryption.
 */
export function isEncrypted(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && stored.startsWith(ENC_PREFIX);
}

/**
 * Encrypt a plaintext secret. Returns "enc:<iv>:<ct>:<tag>" or the original
 * plaintext if no key is configured.
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return plaintext;
  const key = getKey();
  if (!key) return plaintext;

  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString('hex')}:${ct.toString('hex')}:${tag.toString('hex')}`;
}

/**
 * Decrypt a value that may be encrypted ("enc:iv:ct:tag") or legacy plaintext.
 * Always returns a string — never throws (logs + returns plaintext on failure).
 */
export function decryptSecret(stored: string): string {
  if (!stored) return stored;
  if (!stored.startsWith(ENC_PREFIX)) return stored; // legacy plaintext passthrough

  const key = getKey();
  if (!key) {
    // Key not configured but value is marked encrypted — cannot decrypt.
    Logger.error(
      '[secretEncryption] Encrypted value found but INTEGRATION_ENCRYPT_KEY not set — cannot decrypt. Re-authenticate the integration.'
    );
    return '';
  }

  try {
    const parts = stored.slice(ENC_PREFIX.length).split(':');
    if (parts.length !== 3) throw new Error('malformed encrypted value');
    const [ivHex, ctHex, tagHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const ct = Buffer.from(ctHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ct) + decipher.final('utf8');
  } catch (err: any) {
    Logger.error(`[secretEncryption] Decryption failed: ${err?.message}`);
    return '';
  }
}
