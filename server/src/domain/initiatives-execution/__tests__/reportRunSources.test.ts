import { describe, expect, it } from 'vitest';

import { reportSourceValidationFindings } from '../reportRun.js';

describe('Day 14 X.3b report source validation', () => {
  it('rejects the vacuously valid empty source set', () => {
    expect(reportSourceValidationFindings([])).toEqual(['NO_SOURCES']);
  });

  it('keeps a complete real source valid', () => {
    expect(
      reportSourceValidationFindings([
        {
          sourceType: 'work',
          sourceId: 'w1',
          version: 2,
          capturedAt: '2026-08-25T00:00:00.000Z',
          freshness: 'CURRENT',
          formula: null,
          unit: null,
          currency: null,
          window: null,
          confidence: 'HIGH',
          accessState: 'ALLOWED',
          redactions: [],
        },
      ])
    ).toEqual([]);
  });
});
