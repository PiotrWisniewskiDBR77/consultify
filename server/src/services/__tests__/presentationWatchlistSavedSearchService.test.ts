import { describe, expect, it } from 'vitest';

import {
  matchesSavedSearch,
  normalizeSavedSearchFilters,
  normalizeSavedSearchName,
  normalizeSavedSearchQueryText,
  type SavedSearchFilters,
  validateSavedSearchCreateInput,
} from '../presentationWatchlistSavedSearchService.js';

describe('presentationWatchlistSavedSearchService - normalizeSavedSearchName', () => {
  it('trims and collapses internal whitespace to a single space', () => {
    const out = normalizeSavedSearchName('  Hello   World  \n\t Friend  ');
    expect(out.name).toBe('Hello World Friend');
    expect(out.warnings).toEqual([]);
  });

  it('returns empty when input is blank or non-string (validation layer rejects later)', () => {
    expect(normalizeSavedSearchName('   ').name).toBe('');
    expect(normalizeSavedSearchName(undefined).name).toBe('');
    expect(normalizeSavedSearchName(42).name).toBe('');
  });

  it('truncates to 60 chars and emits a name_truncated warning', () => {
    const out = normalizeSavedSearchName('a'.repeat(80));
    expect(out.name).toHaveLength(60);
    expect(out.name).toBe('a'.repeat(60));
    expect(out.warnings).toContain('name_truncated');
  });
});

describe('presentationWatchlistSavedSearchService - normalizeSavedSearchQueryText', () => {
  it('trims and allows empty (filter-only saved search)', () => {
    expect(normalizeSavedSearchQueryText('   ').queryText).toBe('');
    expect(normalizeSavedSearchQueryText('').queryText).toBe('');
    expect(normalizeSavedSearchQueryText(undefined).queryText).toBe('');
    // Internal whitespace is preserved verbatim — only outer trim happens.
    expect(normalizeSavedSearchQueryText('  hello   world  ').queryText).toBe('hello   world');
  });

  it('truncates query text past 120 chars with a query_truncated warning', () => {
    const out = normalizeSavedSearchQueryText('q'.repeat(200));
    expect(out.queryText).toHaveLength(120);
    expect(out.warnings).toContain('query_truncated');
  });
});

describe('presentationWatchlistSavedSearchService - normalizeSavedSearchFilters', () => {
  it('drops unknown verdict values and emits dropped_unknown_verdict warning', () => {
    const out = normalizeSavedSearchFilters({
      verdicts: ['BLOCKED_P0', 'lol', 'NOT_A_VERDICT', 'PASS'],
    });
    expect(out.filters.verdicts).toBeDefined();
    expect(new Set(out.filters.verdicts)).toEqual(new Set(['BLOCKED_P0', 'PASS']));
    expect(out.warnings).toContain('dropped_unknown_verdict');
  });

  it('dedupes verdicts while preserving allow-list members', () => {
    const out = normalizeSavedSearchFilters({
      verdicts: ['BLOCKED_P0', 'BLOCKED_P0', 'BLOCKED_P1', 'PASS_WITH_P2', 'PASS_WITH_P2'],
    });
    expect(out.filters.verdicts).toBeDefined();
    expect(new Set(out.filters.verdicts)).toEqual(
      new Set(['BLOCKED_P0', 'BLOCKED_P1', 'PASS_WITH_P2'])
    );
    expect(out.filters.verdicts).toHaveLength(3);
    expect(out.warnings).not.toContain('dropped_unknown_verdict');
  });

  it('drops unknown confidentiality values and dedupes the rest', () => {
    const out = normalizeSavedSearchFilters({
      confidentiality: ['PUBLIC', 'INTERNAL', 'PUBLIC', 'top-secret', 7, 'CONFIDENTIAL'],
    });
    expect(out.filters.confidentiality).toBeDefined();
    expect(new Set(out.filters.confidentiality)).toEqual(
      new Set(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL'])
    );
    expect(out.warnings).toContain('dropped_unknown_confidentiality');
  });

  it('clamps limit to [1, 200] and minSeverityScore to [0, 1000]', () => {
    expect(normalizeSavedSearchFilters({ limit: 0 }).filters.limit).toBe(1);
    expect(normalizeSavedSearchFilters({ limit: -10 }).filters.limit).toBe(1);
    expect(normalizeSavedSearchFilters({ limit: 9999 }).filters.limit).toBe(200);
    expect(normalizeSavedSearchFilters({ limit: 25.7 }).filters.limit).toBe(26);
    expect(normalizeSavedSearchFilters({}).filters.limit).toBe(50);

    expect(normalizeSavedSearchFilters({ minSeverityScore: -5 }).filters.minSeverityScore).toBe(0);
    expect(normalizeSavedSearchFilters({ minSeverityScore: 5000 }).filters.minSeverityScore).toBe(
      1000
    );
    expect(normalizeSavedSearchFilters({ minSeverityScore: 250 }).filters.minSeverityScore).toBe(
      250
    );
    expect(normalizeSavedSearchFilters({}).filters.minSeverityScore).toBe(0);
  });
});

describe('presentationWatchlistSavedSearchService - validateSavedSearchCreateInput', () => {
  it('returns ok=true for a happy-path payload with normalized values', () => {
    const result = validateSavedSearchCreateInput({
      name: '  Quarterly review  ',
      queryText: '  Strategy 2026  ',
      filters: { verdicts: ['BLOCKED_P0'], limit: 25, minSeverityScore: 100 },
      isDefault: true,
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.normalized).toBeDefined();
    expect(result.normalized?.name).toBe('Quarterly review');
    expect(result.normalized?.queryText).toBe('Strategy 2026');
    expect(result.normalized?.filters.verdicts).toEqual(['BLOCKED_P0']);
    expect(result.normalized?.filters.limit).toBe(25);
    expect(result.normalized?.filters.minSeverityScore).toBe(100);
    expect(result.normalized?.isDefault).toBe(true);
  });

  it('flags NAME_REQUIRED when name is missing or blank, leaving normalized undefined', () => {
    const r1 = validateSavedSearchCreateInput({ filters: {} });
    expect(r1.ok).toBe(false);
    expect(r1.errors).toContain('NAME_REQUIRED');
    expect(r1.normalized).toBeUndefined();

    const r2 = validateSavedSearchCreateInput({ name: '   ', filters: {} });
    expect(r2.ok).toBe(false);
    expect(r2.errors).toContain('NAME_REQUIRED');
  });

  it('separates warnings (truncation, clamps) from errors and still returns ok=true', () => {
    const result = validateSavedSearchCreateInput({
      name: 'OK name',
      queryText: 'q'.repeat(200),
      filters: { limit: 9999, verdicts: ['PASS', 'oops'] },
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toContain('query_truncated');
    expect(result.warnings).toContain('limit_clamped_max');
    expect(result.warnings).toContain('dropped_unknown_verdict');
    expect(result.normalized?.queryText).toHaveLength(120);
    expect(result.normalized?.filters.limit).toBe(200);
  });

  it('rejects non-object payloads with INVALID_PAYLOAD', () => {
    expect(validateSavedSearchCreateInput(null).errors).toContain('INVALID_PAYLOAD');
    expect(validateSavedSearchCreateInput('nope').errors).toContain('INVALID_PAYLOAD');
    expect(validateSavedSearchCreateInput([1, 2, 3]).errors).toContain('INVALID_PAYLOAD');
  });
});

describe('presentationWatchlistSavedSearchService - matchesSavedSearch', () => {
  const baseEntry = {
    deckTitle: 'Project Phoenix Q4 strategy',
    verdict: 'BLOCKED_P1',
    confidentiality: 'internal',
    severityScore: 250,
  };
  const emptyFilters: SavedSearchFilters = {};

  it('matches everything when queryText is empty', () => {
    expect(matchesSavedSearch(baseEntry, { queryText: '', filters: emptyFilters })).toBe(true);
    expect(matchesSavedSearch(baseEntry, { queryText: '   ', filters: emptyFilters })).toBe(true);
  });

  it('does case-insensitive substring matching on the deck title', () => {
    expect(matchesSavedSearch(baseEntry, { queryText: 'phoenix', filters: emptyFilters })).toBe(
      true
    );
    expect(matchesSavedSearch(baseEntry, { queryText: 'PHOENIX', filters: emptyFilters })).toBe(
      true
    );
    expect(matchesSavedSearch(baseEntry, { queryText: 'q4 strategy', filters: emptyFilters })).toBe(
      true
    );
    expect(matchesSavedSearch(baseEntry, { queryText: 'unicorn', filters: emptyFilters })).toBe(
      false
    );
  });

  it('respects the verdict filter when provided', () => {
    expect(
      matchesSavedSearch(baseEntry, {
        queryText: '',
        filters: { verdicts: ['BLOCKED_P1'] },
      })
    ).toBe(true);
    expect(
      matchesSavedSearch(baseEntry, {
        queryText: '',
        filters: { verdicts: ['PASS', 'BLOCKED_P0'] },
      })
    ).toBe(false);
    // Empty array means "no filtering" — anything passes.
    expect(matchesSavedSearch(baseEntry, { queryText: '', filters: { verdicts: [] } })).toBe(true);
  });

  it('respects confidentiality filter case-insensitively (server enum vs entry casing)', () => {
    expect(
      matchesSavedSearch(baseEntry, {
        queryText: '',
        filters: { confidentiality: ['INTERNAL', 'CONFIDENTIAL'] },
      })
    ).toBe(true);
    expect(
      matchesSavedSearch(baseEntry, {
        queryText: '',
        filters: { confidentiality: ['PUBLIC'] },
      })
    ).toBe(false);
  });

  it('honors minSeverityScore as a >= threshold', () => {
    expect(
      matchesSavedSearch(baseEntry, {
        queryText: '',
        filters: { minSeverityScore: 250 },
      })
    ).toBe(true);
    expect(
      matchesSavedSearch(baseEntry, {
        queryText: '',
        filters: { minSeverityScore: 251 },
      })
    ).toBe(false);
    expect(
      matchesSavedSearch(
        { ...baseEntry, severityScore: 0 },
        {
          queryText: '',
          filters: { minSeverityScore: 0 },
        }
      )
    ).toBe(true);
  });
});

describe('presentationWatchlistSavedSearchService - JSON-serializable result', () => {
  it('validateSavedSearchCreateInput result has no Date / Map / Set instances', () => {
    const result = validateSavedSearchCreateInput({
      name: 'Test',
      queryText: 'hello',
      filters: { verdicts: ['BLOCKED_P0'], confidentiality: ['INTERNAL'] },
      isDefault: false,
    });

    // round-trips cleanly through JSON.stringify / parse without throwing,
    // and the parsed output stays structurally equal — no exotic types.
    const json = JSON.stringify(result);
    expect(typeof json).toBe('string');
    const round = JSON.parse(json);
    expect(round).toEqual(result);

    function assertPlain(value: unknown): void {
      if (value === null || typeof value !== 'object') return;
      expect(value instanceof Date).toBe(false);
      expect(value instanceof Map).toBe(false);
      expect(value instanceof Set).toBe(false);
      if (Array.isArray(value)) {
        for (const item of value) assertPlain(item);
      } else {
        for (const v of Object.values(value as Record<string, unknown>)) {
          assertPlain(v);
        }
      }
    }
    assertPlain(result);
  });
});
