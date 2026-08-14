/**
 * COORD-11 — `DrdReportModel` (the "Report" object) must reveal which
 * scoring engine produced it, and adding the `drd_scoring_v2` block must
 * never perturb the existing legacy_v1 numbers that downstream renderers
 * already consume (drdReportGenerator.ts's publishing-grade HTML; the
 * separate DRDReportTemplate.tsx radar is NOT touched by this file).
 *
 * Tests 9, 10, 11 from the COORD-11 mandate live here (see the coordinator
 * brief's numbered test list). Tests 1-8 live in drdScoringV2.test.ts
 * against the drdStructure.ts engine directly.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { buildDrdReportModel, type AreaScores } from '@/services/report/drdReportModel';
import { DRD_SCORING_V2_FLAG_KEYS } from '@/utils/drdScoringV2Flag';

const FIXTURE: AreaScores = {
  '1A': { actual: 5, target: 7 },
  '2A': { actual: 5, target: 5 },
  '2B': { actual: 0, target: 5 }, // unassessed (legacy sentinel)
};

function clearFlagOverrides(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(DRD_SCORING_V2_FLAG_KEYS.localStorage);
  }
}

describe('DrdReportModel — calculationVersion (test 10: Report reveals calculationVersion)', () => {
  afterEach(() => clearFlagOverrides());

  it('defaults to legacy_v1 when no option is passed and the flag is OFF (default)', async () => {
    clearFlagOverrides();
    const model = await buildDrdReportModel(FIXTURE, { organizationName: 'Acme', language: 'pl' });
    expect(model.calculationVersion).toBe('legacy_v1');
    expect(model.scoringV2).toBeUndefined();
  });

  it('an explicit calculationVersion option always wins and is reflected on the model', async () => {
    const model = await buildDrdReportModel(
      FIXTURE,
      { organizationName: 'Acme', language: 'pl' },
      { calculationVersion: 'drd_scoring_v2' }
    );
    expect(model.calculationVersion).toBe('drd_scoring_v2');
    expect(model.scoringV2).toBeDefined();
    expect(model.scoringV2!.overall.calculationVersion).toBe('drd_scoring_v2');
    // 2B (actual 0, legacy sentinel) is excluded from v2's mean, unlike legacy's overall.
    expect(model.scoringV2!.byAxis[2].excluded).toContainEqual({ areaId: '2B', state: 'unassessed' });
  });
});

describe('DrdReportModel — test 9: an approved legacy_v1 report keeps its numbers no matter what v2 does', () => {
  it('overall/areas/dimensions are byte-identical whether or not drd_scoring_v2 is also requested', async () => {
    const legacyOnly = await buildDrdReportModel(
      FIXTURE,
      { organizationName: 'Acme', language: 'pl' },
      { calculationVersion: 'legacy_v1' }
    );
    const withV2Attached = await buildDrdReportModel(
      FIXTURE,
      { organizationName: 'Acme', language: 'pl' },
      { calculationVersion: 'drd_scoring_v2' }
    );
    // The legacy_v1-authored numbers are computed identically regardless of
    // whether the additive v2 block was also requested — opting into v2
    // never rewrites/perturbs the already-approved legacy content.
    expect(withV2Attached.overall).toEqual(legacyOnly.overall);
    expect(withV2Attached.areas).toEqual(legacyOnly.areas);
    expect(withV2Attached.dimensions).toEqual(legacyOnly.dimensions);
  });
});

describe('DrdReportModel — test 11: no silent backfill', () => {
  it('building a second report with a different calculationVersion never mutates a previously built report object', async () => {
    const first = await buildDrdReportModel(
      FIXTURE,
      { organizationName: 'Acme', language: 'pl' },
      { calculationVersion: 'legacy_v1' }
    );
    const snapshot = JSON.parse(JSON.stringify(first));

    await buildDrdReportModel(
      FIXTURE,
      { organizationName: 'Acme', language: 'pl' },
      { calculationVersion: 'drd_scoring_v2' }
    );

    expect(first).toEqual(snapshot);
    expect(first.calculationVersion).toBe('legacy_v1');
    expect(first.scoringV2).toBeUndefined();
  });

  it('there is no recalculate/backfill entry point exported from drdReportModel.ts — building a NEW report is the only way to get NEW numbers', async () => {
    const mod = await import('@/services/report/drdReportModel');
    const exportedNames = Object.keys(mod);
    const suspicious = exportedNames.filter((name) => /backfill|recalculate|migrate/i.test(name));
    expect(suspicious).toEqual([]);
  });
});
