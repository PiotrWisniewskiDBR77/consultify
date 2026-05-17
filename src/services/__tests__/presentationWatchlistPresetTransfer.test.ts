import { describe, expect, it } from 'vitest';

import {
  __internals,
  buildExportBundle,
  bundleToJson,
  parseImportJson,
  planImport,
  type WatchlistPresetExportBundle,
  type WatchlistPresetExportRecord,
} from '../presentationWatchlistPresetTransfer';

const FIXED_NOW = '2026-05-07T10:00:00.000Z';

function validRecord(
  overrides: Partial<WatchlistPresetExportRecord> = {}
): WatchlistPresetExportRecord {
  return {
    name: 'Sample preset',
    description: null,
    filters: { onlyBlocked: true, limit: 50 },
    isDefault: false,
    ...overrides,
  };
}

function validBundle(presets: WatchlistPresetExportRecord[]): WatchlistPresetExportBundle {
  return {
    schema: 'consultify.watchlist.preset.bundle.v1',
    exportedAt: FIXED_NOW,
    count: presets.length,
    presets,
  };
}

describe('buildExportBundle', () => {
  it('clamps out-of-range limit and trims whitespace from name', () => {
    const bundle = buildExportBundle({
      presets: [
        {
          name: '   Quarterly review   ',
          description: null,
          filters: { onlyBlocked: false, limit: 9999 },
          isDefault: false,
        },
        {
          name: 'Tiny limit',
          description: null,
          filters: { onlyBlocked: true, limit: -10 },
          isDefault: false,
        },
      ],
      nowIso: FIXED_NOW,
    });

    expect(bundle.presets).toHaveLength(2);
    expect(bundle.presets[0].name).toBe('Quarterly review');
    expect(bundle.presets[0].filters.limit).toBe(200);
    expect(bundle.presets[1].filters.limit).toBe(1);
    expect(bundle.exportedAt).toBe(FIXED_NOW);
  });

  it('skips presets whose name is empty after trim', () => {
    const bundle = buildExportBundle({
      presets: [
        {
          name: '   ',
          description: 'should be skipped',
          filters: { onlyBlocked: true, limit: 50 },
          isDefault: false,
        },
        {
          name: 'Kept',
          description: null,
          filters: { onlyBlocked: true, limit: 50 },
          isDefault: false,
        },
      ],
      nowIso: FIXED_NOW,
    });

    expect(bundle.presets).toHaveLength(1);
    expect(bundle.presets[0].name).toBe('Kept');
    expect(bundle.count).toBe(1);
  });

  it('emits the canonical schema string', () => {
    const bundle = buildExportBundle({
      presets: [
        {
          name: 'Anything',
          description: null,
          filters: { onlyBlocked: true, limit: 50 },
          isDefault: false,
        },
      ],
      nowIso: FIXED_NOW,
    });

    expect(bundle.schema).toBe('consultify.watchlist.preset.bundle.v1');
    expect(__internals.BUNDLE_SCHEMA).toBe('consultify.watchlist.preset.bundle.v1');
  });

  it('truncates names longer than 60 chars', () => {
    const longName = 'x'.repeat(120);
    const bundle = buildExportBundle({
      presets: [
        {
          name: longName,
          description: null,
          filters: { onlyBlocked: true, limit: 50 },
          isDefault: false,
        },
      ],
      nowIso: FIXED_NOW,
    });

    expect(bundle.presets[0].name).toHaveLength(__internals.NAME_MAX_LEN);
  });

  it('strips invalid minSeverity and dedupes confidentiality', () => {
    const bundle = buildExportBundle({
      presets: [
        {
          name: 'Filters preset',
          description: null,
          filters: {
            onlyBlocked: true,
            limit: 25,
            minSeverity: 'NOPE',
            confidentiality: ['public', 'public', 'internal', 'bogus'],
          },
          isDefault: false,
        },
      ],
      nowIso: FIXED_NOW,
    });

    const f = bundle.presets[0].filters;
    expect(f.minSeverity).toBeUndefined();
    expect(f.confidentiality).toEqual(['public', 'internal']);
  });
});

describe('bundleToJson + parseImportJson round-trip', () => {
  it('round-trips a non-trivial bundle through JSON without loss', () => {
    const original = buildExportBundle({
      presets: [
        {
          name: 'Quarterly review',
          description: 'Top blockers only',
          filters: {
            onlyBlocked: true,
            limit: 100,
            minSeverity: 'BLOCKED_P0',
            confidentiality: ['public', 'internal'],
          },
          isDefault: true,
        },
        {
          name: 'All decks',
          description: null,
          filters: { onlyBlocked: false, limit: 200 },
          isDefault: false,
        },
      ],
      sourceOrgIdHint: 'org-hint-abc',
      note: 'shared via teams',
      nowIso: FIXED_NOW,
    });

    const json = bundleToJson(original);
    const result = parseImportJson(json);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.presetsCount).toBe(2);
    expect(result.bundle?.presets[0].name).toBe('Quarterly review');
    expect(result.bundle?.presets[0].filters.minSeverity).toBe('BLOCKED_P0');
    expect(result.bundle?.presets[0].filters.confidentiality).toEqual(['public', 'internal']);
    expect(result.bundle?.presets[1].filters.limit).toBe(200);
    expect(result.bundle?.meta?.sourceOrgIdHint).toBe('org-hint-abc');
  });
});

describe('parseImportJson failure modes', () => {
  it('returns ok=false with a parse-related error on malformed JSON', () => {
    const result = parseImportJson('{ this is not: json,');
    expect(result.ok).toBe(false);
    expect(result.presetsCount).toBe(0);
    expect(result.errors[0]).toMatch(/parse/i);
  });

  it('returns a schema-mismatch error pointing at the actual value', () => {
    const result = parseImportJson(JSON.stringify({ schema: 'something.else.v2', presets: [] }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/schema/i);
    expect(result.errors.join(' ')).toMatch(/something\.else\.v2/);
  });

  it('caps presets at 50 and pushes an explanatory warning', () => {
    const oversized = Array.from({ length: 60 }, (_, i) => ({
      name: `Preset ${i + 1}`,
      description: null,
      filters: { onlyBlocked: true, limit: 50 },
      isDefault: false,
    }));
    const json = JSON.stringify({
      schema: 'consultify.watchlist.preset.bundle.v1',
      exportedAt: FIXED_NOW,
      count: oversized.length,
      presets: oversized,
    });

    const result = parseImportJson(json);
    expect(result.ok).toBe(true);
    expect(result.presetsCount).toBe(__internals.MAX_PRESETS_PER_BUNDLE);
    expect(result.bundle?.presets).toHaveLength(__internals.MAX_PRESETS_PER_BUNDLE);
    expect(result.errors.some((e) => /50/.test(e))).toBe(true);
    expect(result.bundle?.presets[0].name).toBe('Preset 1');
  });

  it('omits presets with invalid filters and records a reason', () => {
    const json = JSON.stringify({
      schema: 'consultify.watchlist.preset.bundle.v1',
      exportedAt: FIXED_NOW,
      count: 2,
      presets: [
        {
          name: 'Bad limit',
          description: null,
          filters: { onlyBlocked: true, limit: 9999 },
          isDefault: false,
        },
        {
          name: 'Good preset',
          description: null,
          filters: { onlyBlocked: true, limit: 25 },
          isDefault: false,
        },
      ],
    });

    const result = parseImportJson(json);
    expect(result.bundle?.presets.map((p) => p.name)).toEqual(['Good preset']);
    expect(result.errors.some((e) => /Bad limit/.test(e))).toBe(true);
  });

  it('rejects a payload where presets is null', () => {
    const json = JSON.stringify({
      schema: 'consultify.watchlist.preset.bundle.v1',
      exportedAt: FIXED_NOW,
      presets: null,
    });
    const result = parseImportJson(json);
    expect(result.ok).toBe(false);
    expect(result.presetsCount).toBe(0);
    expect(result.errors.join(' ')).toMatch(/presets/i);
  });

  it('accepts a preset that omits optional fields', () => {
    const json = JSON.stringify({
      schema: 'consultify.watchlist.preset.bundle.v1',
      exportedAt: FIXED_NOW,
      count: 1,
      presets: [
        {
          name: 'Minimal',
          filters: { onlyBlocked: true, limit: 10 },
        },
      ],
    });

    const result = parseImportJson(json);
    expect(result.ok).toBe(true);
    expect(result.bundle?.presets).toHaveLength(1);
    expect(result.bundle?.presets[0].description).toBeNull();
    expect(result.bundle?.presets[0].filters.minSeverity).toBeUndefined();
    expect(result.bundle?.presets[0].isDefault).toBe(false);
  });

  it('never throws on completely garbage input', () => {
    expect(() => parseImportJson('')).not.toThrow();
    expect(() => parseImportJson('null')).not.toThrow();
    expect(() => parseImportJson('[1,2,3]')).not.toThrow();
    expect(parseImportJson('null').ok).toBe(false);
  });
});

describe('planImport', () => {
  it('separates duplicates by name (case-insensitive, trimmed)', () => {
    const bundle = validBundle([
      validRecord({ name: 'Quarterly review' }),
      validRecord({ name: 'Top blockers' }),
      validRecord({ name: '  TOP blockers  ' }),
    ]);

    const plan = planImport({
      bundle,
      existingNames: ['quarterly review', 'top blockers'],
    });

    expect(plan.toCreate).toHaveLength(0);
    expect(plan.duplicates.map((d) => d.name)).toEqual([
      'Quarterly review',
      'Top blockers',
      '  TOP blockers  ',
    ]);
    expect(plan.duplicates.every((d) => d.reason === 'name_exists')).toBe(true);
    expect(plan.invalid).toHaveLength(0);
  });

  it('flags filters that fail strict validation as invalid (not toCreate)', () => {
    const bundle: WatchlistPresetExportBundle = {
      schema: 'consultify.watchlist.preset.bundle.v1',
      exportedAt: FIXED_NOW,
      count: 2,
      presets: [
        {
          name: 'Broken',
          description: null,
          // Coerce through unknown to simulate a tampered post-parse object
          // that bypassed parseImportJson's strict pre-check.
          filters: 'not an object' as unknown as WatchlistPresetExportRecord['filters'],
          isDefault: false,
        },
        validRecord({ name: 'Healthy' }),
      ],
    };

    const plan = planImport({ bundle, existingNames: [] });
    expect(plan.invalid.map((i) => i.name)).toEqual(['Broken']);
    expect(plan.toCreate.map((c) => c.name)).toEqual(['Healthy']);
  });

  it('preserves order across buckets', () => {
    const bundle = validBundle([
      validRecord({ name: 'A' }),
      validRecord({ name: 'B' }),
      validRecord({ name: 'C' }),
    ]);

    const plan = planImport({
      bundle,
      existingNames: ['b'],
    });

    expect(plan.toCreate.map((p) => p.name)).toEqual(['A', 'C']);
    expect(plan.duplicates.map((d) => d.name)).toEqual(['B']);
  });

  it('does not throw on a missing bundle.presets array', () => {
    const broken = {
      schema: 'consultify.watchlist.preset.bundle.v1',
      exportedAt: FIXED_NOW,
      count: 0,
    } as unknown as WatchlistPresetExportBundle;

    expect(() => planImport({ bundle: broken, existingNames: [] })).not.toThrow();
    const plan = planImport({ bundle: broken, existingNames: [] });
    expect(plan.toCreate).toEqual([]);
    expect(plan.duplicates).toEqual([]);
    expect(plan.invalid).toEqual([]);
  });
});
