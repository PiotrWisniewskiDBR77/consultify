/** @vitest-environment node */

/**
 * RN-G6 P0 fix (F1) — direct unit coverage for the shared correlation-id
 * validator (`../correlationId.ts`) used by all six resultsVnext route
 * files. See that file's own doc comment for the full root-cause writeup.
 * `kpi.routes.test.ts`'s "X-Correlation-ID validation" describe block covers
 * the same behavior through the HTTP boundary (one route, chosen as the
 * representative caller) — this file tests the function directly and in
 * isolation, including the `req.correlationId`-precedence branch that the
 * HTTP-level tests cannot easily exercise (the minimal test app there never
 * mounts `apiLoggingMiddleware`, which is what attaches that field in
 * production).
 */
import { describe, expect, it } from 'vitest';

import { getCorrelationId, isValidCorrelationId } from '../correlationId.js';
import type { AuthenticatedRequest } from '../../../types/index.js';

function fakeReq(opts: { attached?: unknown; header?: string | undefined }): AuthenticatedRequest {
  return {
    correlationId: opts.attached,
    get: (name: string) => (name === 'X-Correlation-ID' ? opts.header : undefined),
  } as unknown as AuthenticatedRequest;
}

const VALID_UUID = '4d60dfca-1111-4aaa-8bbb-000000000001';
const OLD_BUGGY_SHAPE =
  Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

describe('isValidCorrelationId', () => {
  it('accepts a well-formed UUID', () => {
    expect(isValidCorrelationId(VALID_UUID)).toBe(true);
  });

  it('accepts a UUID regardless of case', () => {
    expect(isValidCorrelationId(VALID_UUID.toUpperCase())).toBe(true);
  });

  it('rejects the exact shape the old client bug produced', () => {
    expect(isValidCorrelationId(OLD_BUGGY_SHAPE)).toBe(false);
  });

  it('rejects a value that is merely alphanumeric-safe (apiLoggingMiddleware sanitizer would accept this)', () => {
    expect(isValidCorrelationId('safe-but-not-a-uuid-123')).toBe(false);
  });

  it('rejects empty string, undefined, null, and non-string values', () => {
    expect(isValidCorrelationId('')).toBe(false);
    expect(isValidCorrelationId(undefined)).toBe(false);
    expect(isValidCorrelationId(null)).toBe(false);
    expect(isValidCorrelationId(12345)).toBe(false);
    expect(isValidCorrelationId({})).toBe(false);
  });

  it('rejects a UUID with the wrong number of hex digits in a group (shape, not just character set)', () => {
    expect(isValidCorrelationId('4d60dfca-111-4aaa-8bbb-000000000001')).toBe(false);
  });
});

describe('getCorrelationId', () => {
  it('prefers a valid req.correlationId (set upstream by apiLoggingMiddleware) over the header', () => {
    const req = fakeReq({ attached: VALID_UUID, header: '11111111-1111-4111-8111-111111111111' });
    expect(getCorrelationId(req)).toBe(VALID_UUID);
  });

  it('falls back to a valid header when req.correlationId is absent', () => {
    const req = fakeReq({ attached: undefined, header: VALID_UUID });
    expect(getCorrelationId(req)).toBe(VALID_UUID);
  });

  it('falls back to the header when req.correlationId is present but NOT UUID-shaped (this is the production bug path: apiLoggingMiddleware only guarantees safe characters, not UUID shape)', () => {
    const req = fakeReq({ attached: OLD_BUGGY_SHAPE, header: VALID_UUID });
    expect(getCorrelationId(req)).toBe(VALID_UUID);
  });

  it('returns undefined when NEITHER source is UUID-shaped — never returns the malformed value', () => {
    const req = fakeReq({ attached: OLD_BUGGY_SHAPE, header: 'also-not-a-uuid' });
    expect(getCorrelationId(req)).toBeUndefined();
  });

  it('returns undefined when both sources are absent', () => {
    const req = fakeReq({ attached: undefined, header: undefined });
    expect(getCorrelationId(req)).toBeUndefined();
  });

  it('tolerates a request object with no .get method at all', () => {
    const req = { correlationId: undefined } as unknown as AuthenticatedRequest;
    expect(getCorrelationId(req)).toBeUndefined();
  });
});
