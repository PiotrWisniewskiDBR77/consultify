/**
 * FIN-005 — the manifest signing key and the HMAC primitives.
 *
 * The manifest is what `--rollback` writes into the database, so "is this file
 * ours?" is a security question, not a hygiene one. These tests pin the three
 * properties that make the answer trustworthy: the key is REQUIRED (never
 * defaulted), the comparison is constant time and never throws, and the secret
 * never appears in anything the script emits.
 */

import { createHash, createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  buildManifestSignature,
  computeManifestHmac,
  constantTimeEquals,
  resolveManifestSigningKey,
  verifyManifestSignature,
  MANIFEST_HMAC_KEY_ENV,
  MANIFEST_HMAC_KEY_ID_ENV,
  MANIFEST_HMAC_MIN_KEY_LENGTH,
  MANIFEST_SIGNATURE_ALGORITHM,
} from '../financeDemoManifestSignature.js';

const SECRET = 'fin005-manifest-signing-key-for-unit-tests';
const KEY_ID = 'fin005-test-a';

function env(overrides: Record<string, string | undefined> = {}) {
  return {
    [MANIFEST_HMAC_KEY_ENV]: SECRET,
    [MANIFEST_HMAC_KEY_ID_ENV]: KEY_ID,
    ...overrides,
  };
}

describe('resolveManifestSigningKey', () => {
  it('reads the key and its id from the environment', () => {
    const key = resolveManifestSigningKey(env());
    expect(key.keyId).toBe(KEY_ID);
    expect(key.secret.toString('utf8')).toBe(SECRET);
  });

  it('REFUSES when the key is missing — there is no unkeyed fallback', () => {
    expect(() => resolveManifestSigningKey(env({ [MANIFEST_HMAC_KEY_ENV]: undefined }))).toThrow(
      new RegExp(`${MANIFEST_HMAC_KEY_ENV} is not set`)
    );
    expect(() => resolveManifestSigningKey(env({ [MANIFEST_HMAC_KEY_ENV]: '   ' }))).toThrow(
      /is not set/
    );
  });

  it('names the operation that needs the key', () => {
    expect(() =>
      resolveManifestSigningKey(env({ [MANIFEST_HMAC_KEY_ENV]: '' }), 'a --rollback run')
    ).toThrow(/a --rollback run needs it/);
  });

  it('refuses a key short enough to brute-force offline', () => {
    const short = 'x'.repeat(MANIFEST_HMAC_MIN_KEY_LENGTH - 1);
    expect(() => resolveManifestSigningKey(env({ [MANIFEST_HMAC_KEY_ENV]: short }))).toThrow(
      /too short/
    );
  });

  it('requires an explicit key id so a rotation is detectable', () => {
    expect(() => resolveManifestSigningKey(env({ [MANIFEST_HMAC_KEY_ID_ENV]: undefined }))).toThrow(
      new RegExp(`${MANIFEST_HMAC_KEY_ID_ENV} is not set`)
    );
    expect(() => resolveManifestSigningKey(env({ [MANIFEST_HMAC_KEY_ID_ENV]: 'has spaces' }))).toThrow(
      /must match/
    );
  });

  it('refuses a key id that contains the key material', () => {
    // The key id is written into the manifest in clear text.
    // This secret happens to be label-shaped, so the charset check would have
    // let it through — the explicit containment check is what stops it.
    expect(() => resolveManifestSigningKey(env({ [MANIFEST_HMAC_KEY_ID_ENV]: SECRET }))).toThrow(
      /contains the key material/
    );
    expect(() =>
      resolveManifestSigningKey(env({ [MANIFEST_HMAC_KEY_ID_ENV]: `${SECRET}-suffixed` }))
    ).toThrow(/contains the key material/);
    expect(() =>
      resolveManifestSigningKey(env({ [MANIFEST_HMAC_KEY_ID_ENV]: 'fin005-2026-08-a' }))
    ).not.toThrow();
  });

  it('tolerates a trailing newline from a pasted or file-sourced value', () => {
    const key = resolveManifestSigningKey(env({ [MANIFEST_HMAC_KEY_ENV]: `${SECRET}\n` }));
    expect(key.secret.toString('utf8')).toBe(SECRET);
  });

  it('never echoes the secret in any refusal message', () => {
    for (const broken of [
      env({ [MANIFEST_HMAC_KEY_ID_ENV]: undefined }),
      env({ [MANIFEST_HMAC_KEY_ID_ENV]: 'has spaces' }),
      env({ [MANIFEST_HMAC_KEY_ENV]: 'short-key' }),
    ]) {
      let message = '';
      try {
        resolveManifestSigningKey(broken);
      } catch (error) {
        message = String((error as Error).message);
      }
      expect(message).toBeTruthy();
      expect(message).not.toContain(SECRET);
      expect(message).not.toContain('short-key');
    }
  });
});

describe('computeManifestHmac', () => {
  const key = resolveManifestSigningKey(env());

  it('is a real HMAC-SHA256, not a digest of the payload', () => {
    const payload = '{"a":1}';
    expect(computeManifestHmac(payload, key)).toBe(
      createHmac('sha256', SECRET).update(payload, 'utf8').digest('hex')
    );
    expect(computeManifestHmac(payload, key)).not.toBe(
      createHash('sha256').update(payload).digest('hex')
    );
  });

  it('changes with the key — the old unkeyed scheme did not', () => {
    const other = resolveManifestSigningKey(
      env({ [MANIFEST_HMAC_KEY_ENV]: `${SECRET}-rotated`, [MANIFEST_HMAC_KEY_ID_ENV]: 'b' })
    );
    expect(computeManifestHmac('{"a":1}', key)).not.toBe(computeManifestHmac('{"a":1}', other));
  });

  it('changes with a single byte of the payload', () => {
    expect(computeManifestHmac('{"a":1}', key)).not.toBe(computeManifestHmac('{"a":2}', key));
  });
});

describe('constantTimeEquals', () => {
  it('compares equal strings as equal', () => {
    expect(constantTimeEquals('abc123', 'abc123')).toBe(true);
  });

  it('returns false — never throws — on a length mismatch', () => {
    // `timingSafeEqual` throws on unequal lengths; a truncated manifest must be
    // a refusal, not a crash.
    expect(() => constantTimeEquals('abc', 'abcdef')).not.toThrow();
    expect(constantTimeEquals('abc', 'abcdef')).toBe(false);
    expect(constantTimeEquals('', '')).toBe(false);
    expect(constantTimeEquals(undefined, 'abc')).toBe(false);
    expect(constantTimeEquals('abc', null)).toBe(false);
    expect(constantTimeEquals(123 as unknown as string, 123 as unknown as string)).toBe(false);
  });
});

describe('verifyManifestSignature', () => {
  const key = resolveManifestSigningKey(env());
  const payload = '{"runId":"r1"}';
  const signature = buildManifestSignature(payload, key);

  it('accepts its own signature', () => {
    expect(signature.algorithm).toBe(MANIFEST_SIGNATURE_ALGORITHM);
    expect(signature.keyId).toBe(KEY_ID);
    expect(verifyManifestSignature(payload, signature, key)).toEqual({ ok: true });
  });

  it('reports each failure kind distinctly', () => {
    expect(verifyManifestSignature(payload, null, key)).toEqual({ ok: false, failure: 'missing' });
    expect(verifyManifestSignature(payload, { ...signature, value: '' }, key)).toEqual({
      ok: false,
      failure: 'missing',
    });
    expect(verifyManifestSignature(payload, { ...signature, algorithm: 'SHA-256' }, key)).toEqual({
      ok: false,
      failure: 'algorithm',
    });
    expect(verifyManifestSignature(payload, { ...signature, keyId: 'other' }, key)).toEqual({
      ok: false,
      failure: 'key-id',
    });
    expect(verifyManifestSignature('{"runId":"r2"}', signature, key)).toEqual({
      ok: false,
      failure: 'value',
    });
  });

  it('rejects a plain unkeyed SHA-256 pasted into the signature field', () => {
    const forged = {
      ...signature,
      value: createHash('sha256').update(payload).digest('hex'),
    };
    expect(verifyManifestSignature(payload, forged, key)).toEqual({ ok: false, failure: 'value' });
  });

  it('rejects a truncated signature without throwing', () => {
    const truncated = { ...signature, value: signature.value.slice(0, 32) };
    expect(() => verifyManifestSignature(payload, truncated, key)).not.toThrow();
    expect(verifyManifestSignature(payload, truncated, key)).toEqual({
      ok: false,
      failure: 'value',
    });
  });
});
