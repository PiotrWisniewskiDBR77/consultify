/**
 * FIN-005 — authentication of the cleanup manifest.
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * The manifest is the rollback plan: it names every row that was moved, the
 * tenant it came from, and the full prior state to restore. `--rollback` acts on
 * it. It is a FILE on an operator's disk, i.e. untrusted input.
 *
 * The first implementation protected it with a plain, unkeyed SHA-256 and called
 * the result a "signature". It was not one. Anyone who can edit the file can
 * recompute an unkeyed digest, so the check proved only that the file was not
 * *accidentally* truncated — it stopped nobody who intended to change it. A
 * forged manifest is a way to make the rollback path write attacker-chosen
 * `organization_id` values into Finance rows.
 *
 * This module replaces it with a real HMAC-SHA256 over the canonical manifest
 * payload, keyed by a secret that only the operator running the script holds.
 *
 * RULES THIS MODULE ENFORCES
 * --------------------------
 * 1. The key comes from the environment and is REQUIRED for `--write` and
 *    `--rollback`. There is no default and no fallback: a missing key refuses
 *    the run rather than silently downgrading to an unkeyed digest.
 * 2. The key ID is declared EXPLICITLY too, and is written into the manifest.
 *    It is deliberately NOT derived from the secret: any derivation (a hash, a
 *    truncated HMAC) publishes a function of the key inside a file that travels
 *    with the manifest, which is offline-brute-forcible if the key is weak. An
 *    explicit label leaks nothing and still makes a rotation detectable.
 * 3. Comparison is constant time (`crypto.timingSafeEqual`), and a length
 *    mismatch returns `false` instead of throwing.
 * 4. THE SECRET IS NEVER LOGGED. Not in an error message, not in the report, not
 *    in the manifest. Only the key ID and the key's length ever appear.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export const MANIFEST_SIGNATURE_LABEL = 'finance-demo-cleanup';

/** The only algorithm this codebase accepts for a manifest signature. */
export const MANIFEST_SIGNATURE_ALGORITHM = 'HMAC-SHA256';

export const MANIFEST_HMAC_KEY_ENV = 'FIN005_MANIFEST_HMAC_KEY';
export const MANIFEST_HMAC_KEY_ID_ENV = 'FIN005_MANIFEST_HMAC_KEY_ID';

/**
 * Minimum key length. A short key makes the HMAC brute-forcible offline from a
 * single manifest, which would put us back where the unkeyed digest was.
 */
export const MANIFEST_HMAC_MIN_KEY_LENGTH = 32;

/** Key ids travel in the manifest, so keep them boring and printable. */
const KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

function fail(message: string): never {
  throw new Error(`[${MANIFEST_SIGNATURE_LABEL}] ${message}`);
}

export interface ManifestSigningKey {
  /** Public label written into the manifest. Never secret. */
  keyId: string;
  /** The secret itself. Never printed, never serialized. */
  secret: Buffer;
}

export interface ManifestSignature {
  algorithm: string;
  keyId: string;
  /** Lowercase hex HMAC-SHA256 over the canonical manifest payload. */
  value: string;
}

export type ManifestSignatureFailure = 'missing' | 'algorithm' | 'key-id' | 'value';

/**
 * Read the signing key from the environment.
 *
 * `env` is a parameter (defaulting to `process.env`) so tests can exercise every
 * refusal without mutating global state.
 *
 * The secret is trimmed: a value pasted into a shell or a Railway variable
 * routinely picks up a trailing newline, and a key that verifies in one shell
 * and not another is a worse failure than a documented trim.
 */
export function resolveManifestSigningKey(
  env: Record<string, string | undefined> = process.env,
  purpose = 'this operation'
): ManifestSigningKey {
  const secret = String(env[MANIFEST_HMAC_KEY_ENV] ?? '').trim();
  if (!secret) {
    fail(
      `${MANIFEST_HMAC_KEY_ENV} is not set, and ${purpose} needs it: the rollback manifest must be ` +
        `authenticated with HMAC-SHA256, not with an unkeyed digest anybody who can edit the file ` +
        `could recompute. Set it to the shared FIN-005 manifest signing secret ` +
        `(at least ${MANIFEST_HMAC_MIN_KEY_LENGTH} characters). The value is never logged and never ` +
        `written into the manifest.`
    );
  }
  if (secret.length < MANIFEST_HMAC_MIN_KEY_LENGTH) {
    // Length only — never the value.
    fail(
      `${MANIFEST_HMAC_KEY_ENV} is too short: ${secret.length} characters, minimum ` +
        `${MANIFEST_HMAC_MIN_KEY_LENGTH}. A short key can be brute-forced offline from a single ` +
        `manifest. (The value itself is never logged.)`
    );
  }

  const keyId = String(env[MANIFEST_HMAC_KEY_ID_ENV] ?? '').trim();
  if (!keyId) {
    fail(
      `${MANIFEST_HMAC_KEY_ID_ENV} is not set. The key id is written into the manifest so a key ` +
        `rotation is detectable at rollback time. It is declared explicitly on purpose: deriving it ` +
        `from the secret would publish a function of the key inside the manifest.`
    );
  }
  if (!KEY_ID_PATTERN.test(keyId)) {
    fail(
      `${MANIFEST_HMAC_KEY_ID_ENV} must match ${KEY_ID_PATTERN} (a short printable label such as ` +
        `"fin005-2026-08-a"). It is stored in the manifest in clear text.`
    );
  }
  if (keyId.includes(secret)) {
    // Cheap guard against the operator pasting the key into both variables.
    fail(
      `${MANIFEST_HMAC_KEY_ID_ENV} contains the key material. The key id is written into the ` +
        `manifest in clear text — set it to a label, not to the secret.`
    );
  }

  return { keyId, secret: Buffer.from(secret, 'utf8') };
}

/** HMAC-SHA256 over an already-canonicalized payload string. */
export function computeManifestHmac(payload: string, key: ManifestSigningKey): string {
  return createHmac('sha256', key.secret).update(payload, 'utf8').digest('hex');
}

export function buildManifestSignature(
  payload: string,
  key: ManifestSigningKey
): ManifestSignature {
  return {
    algorithm: MANIFEST_SIGNATURE_ALGORITHM,
    keyId: key.keyId,
    value: computeManifestHmac(payload, key),
  };
}

/**
 * Constant-time comparison that never throws.
 *
 * `timingSafeEqual` throws on a length mismatch, which would both leak the
 * length through an exception path and turn a tampered manifest into a crash
 * instead of a refusal. Compare lengths first and return `false`.
 */
export function constantTimeEquals(a: unknown, b: unknown): boolean {
  const left = Buffer.from(typeof a === 'string' ? a : '', 'utf8');
  const right = Buffer.from(typeof b === 'string' ? b : '', 'utf8');
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

/**
 * Verify a signature against a payload. Returns the reason rather than throwing
 * so the caller can phrase the refusal in its own vocabulary.
 */
export function verifyManifestSignature(
  payload: string,
  signature: ManifestSignature | null | undefined,
  key: ManifestSigningKey
): { ok: true } | { ok: false; failure: ManifestSignatureFailure } {
  if (
    !signature ||
    typeof signature !== 'object' ||
    typeof signature.value !== 'string' ||
    !signature.value
  ) {
    return { ok: false, failure: 'missing' };
  }
  if (signature.algorithm !== MANIFEST_SIGNATURE_ALGORITHM) {
    return { ok: false, failure: 'algorithm' };
  }
  if (signature.keyId !== key.keyId) {
    return { ok: false, failure: 'key-id' };
  }
  if (!constantTimeEquals(signature.value, computeManifestHmac(payload, key))) {
    return { ok: false, failure: 'value' };
  }
  return { ok: true };
}
