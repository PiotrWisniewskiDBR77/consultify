/**
 * M02-004 regression — the Decision workspace must never interpolate a raw
 * payload into user-facing microcopy.
 *
 * The observed demo failure rendered:
 *   "Could not load this decision. [object Object]"
 * because the call sites read `err.data.error` (the RAW parsed body) instead
 * of the already-normalized message. These tests pin the contract of the
 * shared helper that replaced them.
 */
import { describe, expect, it } from 'vitest';

import { readDecisionApiErrorDetail } from '../../../src/components/MyWork/Decision/decisionWorkspaceApi';

function apiErrorWith(data: unknown, message = 'Request failed'): Error {
  const err = new Error(message) as Error & { data?: unknown; status?: number };
  err.data = data;
  return err;
}

describe('readDecisionApiErrorDetail (M02-004)', () => {
  it('never returns "[object Object]" for an object-valued error field', () => {
    // This is the exact shape that produced the finding.
    const detail = readDecisionApiErrorDetail(
      apiErrorWith({ error: { code: 'DB_ERROR', message: 'relation does not exist' } })
    );
    expect(detail).not.toContain('[object Object]');
    expect(detail).toBe('relation does not exist');
  });

  it('uses a plain string error body as-is', () => {
    expect(readDecisionApiErrorDetail(apiErrorWith({ error: 'Decision not found' }))).toBe(
      'Decision not found'
    );
  });

  it('falls back to the normalized transport message when the body carries nothing readable', () => {
    expect(readDecisionApiErrorDetail(apiErrorWith({}, 'HTTP 500 Internal Server Error'))).toBe(
      'HTTP 500 Internal Server Error'
    );
  });

  it('flattens validation detail payloads instead of dumping the object', () => {
    const detail = readDecisionApiErrorDetail(
      apiErrorWith({ error: 'Validation failed', details: { rationale: 'is required' } })
    );
    expect(detail).not.toContain('[object Object]');
    expect(detail).toBe('Validation failed');
  });

  it('suppresses a literal "[object Object]" that already leaked upstream', () => {
    expect(readDecisionApiErrorDetail(apiErrorWith({ error: '[object Object]' }, '[object Object]')))
      .toBe('');
  });

  it('never throws on a non-Error rejection', () => {
    expect(() => readDecisionApiErrorDetail('boom')).not.toThrow();
    expect(() => readDecisionApiErrorDetail(undefined)).not.toThrow();
    expect(readDecisionApiErrorDetail(undefined)).toBe('Request failed');
  });
});
