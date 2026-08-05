/**
 * M01-006 — this file is referenced by name in `citationAccessStatus.ts`'s
 * module docstring ("see `citationAccessStatus.test.ts`") since the M01-P04B
 * packet, but never actually existed — a dangling reference discovered while
 * verifying the citation ACL chain for M01-006. Closes it with real coverage
 * of `mapVerificationStatusToAccessStatus` / `buildCitationStatusPayload`,
 * including the `no_access` value this packet adds.
 */
import { describe, expect, it } from 'vitest';

import {
  buildCitationStatusPayload,
  mapVerificationStatusToAccessStatus,
} from '../citationAccessStatus.js';

describe('mapVerificationStatusToAccessStatus', () => {
  it('maps verified -> ready', () => {
    expect(mapVerificationStatusToAccessStatus('verified')).toBe('ready');
  });
  it('maps partial and unverified -> stale', () => {
    expect(mapVerificationStatusToAccessStatus('partial')).toBe('stale');
    expect(mapVerificationStatusToAccessStatus('unverified')).toBe('stale');
  });
  it('maps broken -> failed', () => {
    expect(mapVerificationStatusToAccessStatus('broken')).toBe('failed');
  });
  it('maps no_access -> no_access (M01-006)', () => {
    expect(mapVerificationStatusToAccessStatus('no_access')).toBe('no_access');
  });
  it('maps any unknown value defensively to stale, never leaking it verbatim', () => {
    expect(mapVerificationStatusToAccessStatus('some_future_value')).toBe('stale');
  });
});

describe('buildCitationStatusPayload', () => {
  it('only ever emits {id, status} — never title/excerpt/url, even if present on the report', () => {
    const report = {
      results: [
        {
          citationId: 'cit-1',
          status: 'no_access',
          // Not part of VerificationResult's real shape, but simulates a
          // hypothetical future field leaking through if this function ever
          // stopped being a narrow allow-list mapper.
          title: 'Confidential Board Memo.docx',
        } as any,
      ],
    };
    const payload = buildCitationStatusPayload(report);
    expect(payload).toEqual([{ id: 'cit-1', status: 'no_access' }]);
    expect(JSON.stringify(payload)).not.toContain('Confidential');
  });

  it('returns an empty array for a null/malformed report', () => {
    expect(buildCitationStatusPayload(null)).toEqual([]);
    expect(buildCitationStatusPayload(undefined)).toEqual([]);
    expect(buildCitationStatusPayload({} as any)).toEqual([]);
  });

  it('drops results with an empty citationId', () => {
    const payload = buildCitationStatusPayload({
      results: [{ citationId: '  ', status: 'verified' }],
    });
    expect(payload).toEqual([]);
  });
});
