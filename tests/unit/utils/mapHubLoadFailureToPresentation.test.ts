import { describe, expect, it } from 'vitest';

import { mapHubLoadFailureToPresentation } from '@/utils/errors/mapHubLoadFailureToPresentation';

describe('mapHubLoadFailureToPresentation', () => {
  it('returns curated message for known results code', () => {
    const result = mapHubLoadFailureToPresentation(
      { data: { code: 'RESULTS_KPI_CATALOG_UNAVAILABLE', error: 'raw backend text' } },
      'fallback'
    );
    expect(result).toEqual({
      message: 'Failed to load KPI catalog.',
      code: 'RESULTS_KPI_CATALOG_UNAVAILABLE',
    });
  });

  it('fails closed to fallback for unknown or missing code', () => {
    const result = mapHubLoadFailureToPresentation(
      new Error('Failed to fetch http://127.0.0.1:9999/internal'),
      'Failed to load KPI catalog.'
    );
    expect(result).toEqual({
      message: 'Failed to load KPI catalog.',
      code: null,
    });
    expect(result.message).not.toContain('127.0.0.1');
    expect(result.message).not.toContain('http://');
    expect(result.message).not.toContain('internal');
  });

  it('is deterministic for repeated identical inputs', () => {
    const error = { data: { code: 'EXECUTION_INITIATIVES_READ_FAILED' } };
    const first = mapHubLoadFailureToPresentation(error, 'fallback');
    const second = mapHubLoadFailureToPresentation(error, 'fallback');
    expect(first).toEqual(second);
  });
});

