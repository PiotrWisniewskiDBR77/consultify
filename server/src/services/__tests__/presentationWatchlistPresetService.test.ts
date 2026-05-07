import { describe, expect, it } from 'vitest';

import {
  comparePresetsByName,
  normalizePresetFilters,
  normalizePresetName,
  validatePresetCreateInput,
} from '../presentationWatchlistPresetService.js';

describe('presentationWatchlistPresetService - normalizePresetName', () => {
  it('trims, collapses internal whitespace, and truncates at 60 chars', () => {
    expect(normalizePresetName('  Hello   World  ')).toBe('Hello World');

    const long = 'a'.repeat(80);
    const out = normalizePresetName(long);
    expect(out).toHaveLength(60);
    expect(out).toBe('a'.repeat(60));
  });

  it('throws NAME_REQUIRED when the input is empty after trim', () => {
    expect(() => normalizePresetName('   ')).toThrowError('NAME_REQUIRED');
    expect(() => normalizePresetName('')).toThrowError('NAME_REQUIRED');
    // Non-strings must surface as NAME_REQUIRED rather than crashing.
    // @ts-expect-error - intentionally exercising the runtime guard
    expect(() => normalizePresetName(undefined)).toThrowError('NAME_REQUIRED');
  });
});

describe('presentationWatchlistPresetService - normalizePresetFilters', () => {
  it('applies onlyBlocked=true and limit=50 defaults when input is missing/invalid', () => {
    expect(normalizePresetFilters(undefined)).toEqual({
      onlyBlocked: true,
      limit: 50,
    });
    expect(normalizePresetFilters({})).toEqual({
      onlyBlocked: true,
      limit: 50,
    });
    expect(normalizePresetFilters({ onlyBlocked: false })).toEqual({
      onlyBlocked: false,
      limit: 50,
    });
  });

  it('clamps limit into the [1, 200] range and rounds non-integers', () => {
    expect(normalizePresetFilters({ limit: 0 }).limit).toBe(1);
    expect(normalizePresetFilters({ limit: -10 }).limit).toBe(1);
    expect(normalizePresetFilters({ limit: 9999 }).limit).toBe(200);
    expect(normalizePresetFilters({ limit: 25.7 }).limit).toBe(26);
    expect(normalizePresetFilters({ limit: 'lots' as unknown as number }).limit).toBe(50);
  });

  it('strips minSeverity values that are not in the allow-list', () => {
    expect(normalizePresetFilters({ minSeverity: 'BLOCKED_P0' }).minSeverity).toBe(
      'BLOCKED_P0'
    );
    expect(normalizePresetFilters({ minSeverity: 'BLOCKED_P1' }).minSeverity).toBe(
      'BLOCKED_P1'
    );
    expect(normalizePresetFilters({ minSeverity: 'PASS' }).minSeverity).toBeUndefined();
    expect(normalizePresetFilters({ minSeverity: 42 }).minSeverity).toBeUndefined();
  });

  it('dedupes confidentiality values and drops anything outside the allow-list', () => {
    const out = normalizePresetFilters({
      confidentiality: ['public', 'internal', 'public', 'top-secret', 'confidential', 7],
    });
    expect(out.confidentiality).toBeDefined();
    // Order is preserved as-inserted; just assert membership + uniqueness.
    expect(new Set(out.confidentiality)).toEqual(
      new Set(['public', 'internal', 'confidential'])
    );
    expect(out.confidentiality).toHaveLength(3);
  });

  it('omits confidentiality entirely when no allow-listed values remain', () => {
    expect(
      normalizePresetFilters({ confidentiality: ['secret', 7, null] }).confidentiality
    ).toBeUndefined();
  });
});

describe('presentationWatchlistPresetService - validatePresetCreateInput', () => {
  it('returns ok=true for a happy-path payload', () => {
    const result = validatePresetCreateInput({
      name: '  My Preset  ',
      description: 'Used during quarterly review',
      filters: { onlyBlocked: false, limit: 25 },
      isDefault: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('My Preset');
    expect(result.value.description).toBe('Used during quarterly review');
    expect(result.value.filters).toEqual({ onlyBlocked: false, limit: 25 });
    expect(result.value.isDefault).toBe(true);
  });

  it('returns NAME_REQUIRED when name is missing or blank', () => {
    expect(
      validatePresetCreateInput({ filters: { onlyBlocked: true, limit: 50 } })
    ).toEqual({ ok: false, error: 'NAME_REQUIRED' });
    expect(
      validatePresetCreateInput({ name: '   ', filters: { onlyBlocked: true, limit: 50 } })
    ).toEqual({ ok: false, error: 'NAME_REQUIRED' });
  });

  it('returns NAME_TOO_LONG instead of silently truncating', () => {
    const result = validatePresetCreateInput({
      name: 'x'.repeat(80),
      filters: { onlyBlocked: true, limit: 50 },
    });
    expect(result).toEqual({ ok: false, error: 'NAME_TOO_LONG' });
  });

  it('returns DESCRIPTION_TOO_LONG when description exceeds 280 chars', () => {
    const result = validatePresetCreateInput({
      name: 'OK',
      description: 'd'.repeat(281),
      filters: { onlyBlocked: true, limit: 50 },
    });
    expect(result).toEqual({ ok: false, error: 'DESCRIPTION_TOO_LONG' });
  });

  it('returns FILTERS_INVALID when filters object is missing or not an object', () => {
    expect(validatePresetCreateInput({ name: 'OK' })).toEqual({
      ok: false,
      error: 'FILTERS_INVALID',
    });
    expect(validatePresetCreateInput({ name: 'OK', filters: 'oops' })).toEqual({
      ok: false,
      error: 'FILTERS_INVALID',
    });
  });
});

describe('presentationWatchlistPresetService - comparePresetsByName', () => {
  it('sorts alphabetically and treats casing as equal', () => {
    const presets = [{ name: 'banana' }, { name: 'Apple' }, { name: 'cherry' }];
    presets.sort(comparePresetsByName);
    expect(presets.map((p) => p.name.toLowerCase())).toEqual([
      'apple',
      'banana',
      'cherry',
    ]);

    expect(comparePresetsByName({ name: 'foo' }, { name: 'FOO' })).toBe(0);
  });
});
