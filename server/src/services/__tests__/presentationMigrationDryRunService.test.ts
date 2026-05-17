import { describe, expect, it } from 'vitest';

import {
  buildDryRunReport,
  getCatalogEntry,
  listCatalogIds,
  PRESENTATION_MIGRATION_CATALOG,
} from '../presentationMigrationDryRunService.js';

describe('presentationMigrationDryRunService — catalog', () => {
  it('catalog has expected presentation migrations 760-767', () => {
    const expectedIds = [
      '760_presentation_legacy_normalization',
      '761_presentation_runtime_events',
      '762_presentation_governance_alerts',
      '763_presentation_governance_alert_signing',
      '764_presentation_watchlist_presets',
      '765_presentation_governance_subscriber_tokens',
      '766_presentation_watchlist_saved_searches',
      '767_presentation_template_governance',
    ];
    expect(listCatalogIds()).toEqual(expectedIds);
    for (const id of expectedIds) {
      expect(getCatalogEntry(id)).not.toBeNull();
    }
  });

  it('every catalog entry has a non-empty filename and at least one affected table', () => {
    for (const entry of PRESENTATION_MIGRATION_CATALOG) {
      expect(entry.filename).toMatch(/^\d+_.*\.sql$/);
      expect(entry.affects.length).toBeGreaterThan(0);
      expect(entry.preflightChecks.length).toBeGreaterThan(0);
      expect(entry.postCheck.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(20);
    }
  });

  it('migration 760 is flagged as data_normalize affecting presentation_decks', () => {
    const entry = getCatalogEntry('760_presentation_legacy_normalization');
    expect(entry).not.toBeNull();
    expect(entry!.category).toBe('data_normalize');
    expect(entry!.affects).toContain('presentation_decks');
    expect(entry!.riskTier).toBe('P0');
    expect(entry!.rollbackStrategy).toBe('restore_snapshot');
  });

  it('migration 767 is flagged as schema_alter for template_governance', () => {
    const entry = getCatalogEntry('767_presentation_template_governance');
    expect(entry).not.toBeNull();
    expect(entry!.category).toBe('schema_alter');
    expect(entry!.affects).toContain('presentation_templates');
    expect(entry!.riskTier).toBe('P0');
    expect(entry!.rollbackStrategy).toBe('drop_columns');
  });

  it('getCatalogEntry returns null for unknown ids and never throws on bad input', () => {
    expect(getCatalogEntry('does_not_exist')).toBeNull();
    expect(getCatalogEntry('')).toBeNull();
    expect(getCatalogEntry(null as unknown as string)).toBeNull();
    expect(getCatalogEntry(undefined as unknown as string)).toBeNull();
  });
});

describe('presentationMigrationDryRunService — buildDryRunReport', () => {
  it('empty input produces empty report with PROCEED recommendation', () => {
    const report = buildDryRunReport({ migrationIds: [] });
    expect(report.impact).toEqual([]);
    expect(report.totals).toEqual({
      migrations: 0,
      p0: 0,
      p1: 0,
      p2: 0,
      reversibleCount: 0,
      nonReversibleCount: 0,
    });
    expect(report.blockers).toEqual([]);
    expect(report.recommendation).toBe('PROCEED');
    expect(report.scope.organizationIds).toBe('global');
    expect(report.scope.estimatedDeckCount).toBeNull();
    expect(report.scope.estimatedTemplateCount).toBeNull();
  });

  it('single migration request yields exactly one impact row', () => {
    const report = buildDryRunReport({ migrationIds: ['761_presentation_runtime_events'] });
    expect(report.impact.length).toBe(1);
    expect(report.impact[0].migrationId).toBe('761_presentation_runtime_events');
    expect(report.totals.migrations).toBe(1);
    expect(report.totals.p2).toBe(1);
  });

  it('unknown migration id becomes a blocker and forces BLOCK recommendation', () => {
    const report = buildDryRunReport({ migrationIds: ['999_does_not_exist'] });
    expect(report.recommendation).toBe('BLOCK');
    expect(report.blockers.some((b) => b.includes('999_does_not_exist'))).toBe(true);
    expect(report.impact[0].blockers.some((b) => b.includes('999_does_not_exist'))).toBe(true);
  });

  it('mixed P0/P1/P2 migrations roll up totals correctly', () => {
    const report = buildDryRunReport({
      migrationIds: [
        '760_presentation_legacy_normalization', // P0
        '762_presentation_governance_alerts', // P1
        '763_presentation_governance_alert_signing', // P1
        '761_presentation_runtime_events', // P2
        '764_presentation_watchlist_presets', // P2
      ],
    });
    expect(report.totals.migrations).toBe(5);
    expect(report.totals.p0).toBe(1);
    expect(report.totals.p1).toBe(2);
    expect(report.totals.p2).toBe(2);
  });

  it('P0 reversible-only set recommends PROCEED (no review escalation)', () => {
    const report = buildDryRunReport({
      migrationIds: [
        '760_presentation_legacy_normalization',
        '767_presentation_template_governance',
      ],
    });
    expect(report.totals.p0).toBe(2);
    expect(report.totals.nonReversibleCount).toBe(0);
    expect(report.blockers).toEqual([]);
    expect(report.recommendation).toBe('PROCEED');
  });

  it('P0 + non-reversible entry recommends PROCEED_WITH_REVIEW', () => {
    // The standard catalog is fully reversible, so we transiently mutate a
    // non-P0 entry to be non-reversible to drive the PROCEED_WITH_REVIEW
    // branch deterministically. State is restored in finally.
    const target = PRESENTATION_MIGRATION_CATALOG.find(
      (e) => e.id === '764_presentation_watchlist_presets'
    );
    expect(target).toBeDefined();
    const originalReversible = target!.reversible;
    const originalStrategy = target!.rollbackStrategy;
    try {
      target!.reversible = false;
      target!.rollbackStrategy = 'manual_review';
      const report = buildDryRunReport({
        migrationIds: [
          '760_presentation_legacy_normalization', // P0, reversible
          '764_presentation_watchlist_presets', // patched: non-reversible
        ],
      });
      expect(report.totals.p0).toBe(1);
      expect(report.totals.nonReversibleCount).toBe(1);
      expect(report.blockers).toEqual([]);
      expect(report.recommendation).toBe('PROCEED_WITH_REVIEW');
    } finally {
      target!.reversible = originalReversible;
      target!.rollbackStrategy = originalStrategy;
    }
  });

  it('estimatedRowsAffected for data_normalize follows estimatedDeckCount', () => {
    const report = buildDryRunReport({
      migrationIds: ['760_presentation_legacy_normalization'],
      estimatedDeckCount: 1500,
    });
    expect(report.impact[0].category).toBe('data_normalize');
    expect(report.impact[0].estimatedRowsAffected).toBe(1500);
    expect(report.impact[0].estimatedDurationSeconds).toBe(300);

    const bigReport = buildDryRunReport({
      migrationIds: ['760_presentation_legacy_normalization'],
      estimatedDeckCount: 25000,
    });
    expect(bigReport.impact[0].estimatedRowsAffected).toBe(25000);
    expect(bigReport.impact[0].estimatedDurationSeconds).toBe(900);
  });

  it('schema_alter rows have a small fixed estimate and 5s duration', () => {
    const report = buildDryRunReport({
      migrationIds: ['761_presentation_runtime_events'],
    });
    expect(report.impact[0].category).toBe('schema_alter');
    expect(report.impact[0].estimatedRowsAffected).toBe(0);
    expect(report.impact[0].estimatedDurationSeconds).toBe(5);
  });

  it('organizationIds scope is preserved when provided', () => {
    const report = buildDryRunReport({
      migrationIds: ['761_presentation_runtime_events'],
      organizationIds: ['org_a', 'org_b'],
    });
    expect(report.scope.organizationIds).toEqual(['org_a', 'org_b']);
  });

  it('output is JSON-serializable and round-trips cleanly', () => {
    const report = buildDryRunReport({
      migrationIds: [
        '760_presentation_legacy_normalization',
        '767_presentation_template_governance',
      ],
      organizationIds: ['org_xyz'],
      estimatedDeckCount: 4200,
      estimatedTemplateCount: 12,
    });
    const json = JSON.stringify(report);
    expect(typeof json).toBe('string');
    const parsed = JSON.parse(json);
    expect(parsed.totals.migrations).toBe(2);
    expect(parsed.scope.estimatedDeckCount).toBe(4200);
    expect(parsed.scope.estimatedTemplateCount).toBe(12);
    expect(parsed.scope.organizationIds).toEqual(['org_xyz']);
  });

  it('never throws on malformed inputs', () => {
    expect(() =>
      buildDryRunReport({ migrationIds: undefined as unknown as string[] })
    ).not.toThrow();
    expect(() => buildDryRunReport({} as unknown as { migrationIds: string[] })).not.toThrow();
    expect(() =>
      buildDryRunReport({
        migrationIds: ['', null as unknown as string, '   '],
        estimatedDeckCount: -1,
        estimatedTemplateCount: Number.NaN,
        organizationIds: ['valid', '', null as unknown as string],
      })
    ).not.toThrow();

    const malformed = buildDryRunReport({
      migrationIds: [null as unknown as string, '760_presentation_legacy_normalization'],
    });
    expect(malformed.recommendation).toBe('BLOCK');
    expect(malformed.impact.length).toBe(1);
  });

  it('warnings flag P0 sign-off requirement and snapshot rollback risk', () => {
    const report = buildDryRunReport({
      migrationIds: ['760_presentation_legacy_normalization'],
    });
    expect(report.impact[0].warnings.some((w) => w.toLowerCase().includes('p0'))).toBe(true);
    expect(report.impact[0].warnings.some((w) => w.toLowerCase().includes('snapshot'))).toBe(true);
    expect(report.impact[0].rollbackPossible).toBe(true);
  });

  it('duplicate blockers in input are deduped at report level', () => {
    const report = buildDryRunReport({
      migrationIds: ['unknown_a', 'unknown_a', 'unknown_a'],
    });
    expect(report.recommendation).toBe('BLOCK');
    const matching = report.blockers.filter((b) => b.includes('unknown_a'));
    expect(matching.length).toBe(1);
  });

  it('full catalog dry-run produces a coherent recommendation and stable counts', () => {
    const report = buildDryRunReport({
      migrationIds: listCatalogIds(),
      estimatedDeckCount: 1000,
      estimatedTemplateCount: 50,
    });
    expect(report.totals.migrations).toBe(8);
    expect(report.totals.p0).toBe(2);
    expect(report.totals.p1).toBe(3);
    expect(report.totals.p2).toBe(3);
    expect(report.totals.reversibleCount).toBe(8);
    expect(report.totals.nonReversibleCount).toBe(0);
    expect(report.blockers).toEqual([]);
    expect(report.recommendation).toBe('PROCEED');
  });
});
