/**
 * COORD-11 — DRD scoring: `legacy_v1` (frozen, defects included) vs
 * `drd_scoring_v2` (canon §6.1/§6.2 correct).
 *
 * Canon: docs/product/DRD_CANON.md §6.
 * Confirmed defects (measured pre-COORD-11, reproduced here as golden
 * regression tests so they never silently drift):
 *   DEFECT 1 — no normalization: level 5 on a 1-5 axis and level 5 on a 1-7
 *              axis both report `actual: 5` (should be 1.0 vs 0.667 normalized).
 *   DEFECT 2 — zero counted as a level: an unassessed area recorded as
 *              `{actual: 0}` drags the mean down as if "0" were real.
 * Both are reproduced unchanged by `legacy_v1` below (golden values) and
 * fixed by `drd_scoring_v2`.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  calculateAxisScore,
  calculateAxisScoreLegacyV1,
  calculateAxisScoreV2,
  calculateAxisScoreVersioned,
  calculateOverallScore,
  calculateOverallScoreLegacyV1,
  calculateOverallScoreV2,
  calculateOverallScoreVersioned,
  drdLevelFromNorm,
  normalizeDrdAreaV2,
  type DrdAreaInputV2,
} from '@/services/drdStructure';

describe('DRD scoring — legacy_v1 golden values (frozen, do not "fix")', () => {
  it('golden: calculateOverallScore({2A: 5/5}) === calculateOverallScore({1A: 5/7}) — defect 1, frozen', () => {
    // 2A belongs to axis 2 (levelCount 5) — level 5 is that axis's maximum.
    // 1A belongs to axis 1 (levelCount 7) — level 5 is 66.7% of that axis.
    const a = calculateOverallScore({ '2A': { actual: 5, target: 5 } });
    const b = calculateOverallScore({ '1A': { actual: 5, target: 5 } });
    expect(a).toEqual({ actual: 5, target: 5, gap: 0 });
    expect(b).toEqual({ actual: 5, target: 5, gap: 0 });
    // The defect, frozen: legacy treats these as identical.
    expect(a.actual).toBe(b.actual);
  });

  it('golden: calculateAxisScore(2, ...) with one unassessed(0) area drags the mean down — defect 2, frozen', () => {
    const twoAssessed = calculateAxisScore(2, {
      '2A': { actual: 4, target: 5 },
      '2B': { actual: 4, target: 5 },
    });
    const plusOneUnassessed = calculateAxisScore(2, {
      '2A': { actual: 4, target: 5 },
      '2B': { actual: 4, target: 5 },
      '2C': { actual: 0, target: 0 },
    });
    expect(twoAssessed.actual).toBe(4);
    expect(plusOneUnassessed.actual).toBeCloseTo(2.7, 1);
    expect(plusOneUnassessed.actual).toBeLessThan(twoAssessed.actual);
  });

  it('calculateOverallScoreLegacyV1 / calculateAxisScoreLegacyV1 are the exact same function as the unversioned exports', () => {
    expect(calculateOverallScoreLegacyV1).toBe(calculateOverallScore);
    expect(calculateAxisScoreLegacyV1).toBe(calculateAxisScore);
  });

  it('calculateOverallScoreVersioned defaults to legacy_v1 and reproduces the same numbers, tagged', () => {
    const raw = calculateOverallScore({ '2A': { actual: 5, target: 5 } });
    const versioned = calculateOverallScoreVersioned({ '2A': { actual: 5, target: 5 } });
    expect(versioned).toEqual({ calculationVersion: 'legacy_v1', ...raw });
  });
});

describe('DRD scoring — test 1: 5/5 and 5/7 must NOT normalize the same', () => {
  it('drd_scoring_v2: level 5 on a 1-5 axis normalizes to 1.0, level 5 on a 1-7 axis normalizes to 0.667', () => {
    const maxOfFive = calculateOverallScoreV2({ '2A': { actual: 5, target: 5 } }); // axis 2, levelCount 5
    const notMaxOfSeven = calculateOverallScoreV2({ '1A': { actual: 5, target: 5 } }); // axis 1, levelCount 7

    expect(maxOfFive.scoreNorm).toBe(1);
    expect(notMaxOfSeven.scoreNorm).toBeCloseTo(0.6667, 3);
    expect(maxOfFive.scoreNorm).not.toBe(notMaxOfSeven.scoreNorm);
  });
});

describe('DRD scoring — test 2: unassessed is never treated as zero/lowest level', () => {
  it('an unassessed area (actual undefined) is excluded from the mean, not averaged in as 0', () => {
    const twoAssessed = calculateAxisScoreV2(2, {
      '2A': { actual: 4, target: 5 },
      '2B': { actual: 4, target: 5 },
    });
    const plusOneUnassessed = calculateAxisScoreV2(2, {
      '2A': { actual: 4, target: 5 },
      '2B': { actual: 4, target: 5 },
      '2C': { actual: undefined, target: undefined },
    });
    // Mean over ASSESSED areas is unchanged by adding an unassessed one.
    expect(plusOneUnassessed.scoreNorm).toBe(twoAssessed.scoreNorm);
    expect(plusOneUnassessed.assessedCount).toBe(2);
    expect(plusOneUnassessed.unassessedCount).toBe(1);
    expect(plusOneUnassessed.excluded).toEqual([{ areaId: '2C', state: 'unassessed' }]);
  });

  it('the legacy `{actual: 0}` sentinel is also inferred as unassessed under v2 (no explicit state given)', () => {
    const result = normalizeDrdAreaV2('2C', { actual: 0, target: 0 });
    expect(result?.state).toBe('unassessed');
    expect(result?.scoreNorm).toBeNull();
  });
});

describe('DRD scoring — test 3: real assessed_zero vs DRD ladder (1..Lmax)', () => {
  it('DRD ladders start at level 1 (documented: DRD_STRUCTURE areas number levels from 1) — a real achieved_level of 0 is not a valid DRD position', () => {
    // Every axis area's first level is `level: 1` — see drdStructure.ts AXIS_*
    // definitions. This test documents the finding requested by the
    // coordinator: for DRD specifically, `assessed_zero` cannot legitimately
    // occur (there is no level-0 rung), so this engine treats an explicit
    // `state: 'assessed_zero'` the same as `unassessed` — excluded, counted,
    // and surfaced in `excluded`, never silently scored as the lowest level.
    const result = normalizeDrdAreaV2('2A', { actual: 0, target: 5, state: 'assessed_zero' });
    expect(result?.state).toBe('assessed_zero');
    expect(result?.scoreNorm).toBeNull();

    const aggregate = calculateOverallScoreV2({
      '2A': { actual: 0, target: 5, state: 'assessed_zero' },
      '2B': { actual: 4, target: 5 },
    });
    expect(aggregate.assessedZeroCount).toBe(1);
    expect(aggregate.assessedCount).toBe(1);
    expect(aggregate.scoreNorm).toBe(calculateAxisScoreV2(2, { '2B': { actual: 4, target: 5 } }).scoreNorm);
    expect(aggregate.excluded).toContainEqual({ areaId: '2A', state: 'assessed_zero' });
  });
});

describe('DRD scoring — test 4: insufficient_evidence never promotes the level', () => {
  it('an area with a proposed high level but insufficient_evidence contributes nothing to the mean', () => {
    const withoutIt = calculateAxisScoreV2(2, { '2A': { actual: 4, target: 5 } });
    const withInsufficientEvidence = calculateAxisScoreV2(2, {
      '2A': { actual: 4, target: 5 },
      '2B': { actual: 5, target: 5, state: 'insufficient_evidence' },
    });
    expect(withInsufficientEvidence.scoreNorm).toBe(withoutIt.scoreNorm);
    expect(withInsufficientEvidence.insufficientEvidenceCount).toBe(1);
    expect(withInsufficientEvidence.assessedCount).toBe(1);
    // Distinguishable from a plain unassessed area — different bucket.
    expect(withInsufficientEvidence.unassessedCount).toBe(0);
  });
});

describe('DRD scoring — test 5: not_applicable does not lower the denominator', () => {
  it('coverage stays 100% when the only unassessed-looking area is explicitly not_applicable', () => {
    const result = calculateAxisScoreV2(2, {
      '2A': { actual: 4, target: 5 },
      '2B': { actual: 4, target: 5 },
      '2C': { actual: null, target: null, state: 'not_applicable' },
    });
    expect(result.assessedCount).toBe(2);
    expect(result.notApplicableCount).toBe(1);
    // Denominator excludes N/A entirely — 2/2, not 2/3.
    expect(result.denominatorCount).toBe(2);
    expect(result.coverage).toBe(1);
    expect(result.coveragePercent).toBe(100);
  });
});

describe('DRD scoring — test 6: 2/3 assessed -> coverage 66.7%', () => {
  it('axis with 2 assessed + 1 unassessed area out of 3 reports coverage 66.7%', () => {
    const result = calculateAxisScoreV2(2, {
      '2A': { actual: 4, target: 5 },
      '2B': { actual: 4, target: 5 },
      '2C': { actual: undefined, target: undefined },
    });
    expect(result.assessedCount).toBe(2);
    expect(result.denominatorCount).toBe(3);
    expect(result.coverage).toBeCloseTo(0.6667, 3);
    expect(result.coveragePercent).toBe(66.7);
  });
});

describe('DRD scoring — test 7: legacy_v1 reproduces historical golden values', () => {
  it('golden fixture: axis 2 two areas at level 4/5 -> actual 4.0, target 5.0, gap 1.0', () => {
    const result = calculateAxisScore(2, {
      '2A': { actual: 4, target: 5 },
      '2B': { actual: 4, target: 5 },
    });
    expect(result).toEqual({ actual: 4, target: 5, gap: 1 });
  });

  it('golden fixture: overall score across mixed axes averages raw (unnormalized) levels — frozen defect', () => {
    const result = calculateOverallScore({
      '1A': { actual: 7, target: 7 }, // axis 1 max is 7
      '2A': { actual: 5, target: 5 }, // axis 2 max is 5
    });
    // Legacy: (7+5)/2 = 6.0 raw mean — NOT the canon-correct (1.0+1.0)/2 = 1.0 normalized.
    expect(result).toEqual({ actual: 6, target: 6, gap: 0 });
  });
});

describe('DRD scoring — test 8: drd_scoring_v2 is deterministic', () => {
  it('same input -> same output across repeated calls', () => {
    const input: Record<string, DrdAreaInputV2> = {
      '2A': { actual: 4, target: 5 },
      '2B': { actual: 2, target: 5 },
      '2C': { actual: undefined, target: undefined },
      '2D': { actual: 5, target: 5, state: 'insufficient_evidence' },
      '2E': { actual: null, target: null, state: 'not_applicable' },
    };
    const runs = Array.from({ length: 5 }, () => calculateOverallScoreV2(input));
    for (const run of runs.slice(1)) {
      expect(run).toEqual(runs[0]);
    }
  });

  it('deterministic across a fresh module instance (vi.resetModules — guards against module-level cache bugs)', async () => {
    vi.resetModules();
    const fresh = await import('@/services/drdStructure');
    const a = fresh.calculateOverallScoreV2({ '2A': { actual: 4, target: 5 }, '2B': { actual: 2, target: 5 } });
    vi.resetModules();
    const fresh2 = await import('@/services/drdStructure');
    const b = fresh2.calculateOverallScoreV2({ '2A': { actual: 4, target: 5 }, '2B': { actual: 2, target: 5 } });
    expect(a).toEqual(b);
  });

  it('does not mutate its input', () => {
    const input: Record<string, DrdAreaInputV2> = Object.freeze({
      '2A': Object.freeze({ actual: 4, target: 5 }),
      '2B': Object.freeze({ actual: 2, target: 5 }),
    });
    expect(() => calculateOverallScoreV2(input)).not.toThrow();
    expect(() => calculateAxisScoreV2(2, input)).not.toThrow();
  });
});

describe('DRD scoring — level bands (canon §6.2 thresholds)', () => {
  it.each([
    [0, 'I'],
    [0.19, 'I'],
    [0.2, 'II'],
    [0.39, 'II'],
    [0.4, 'III'],
    [0.59, 'III'],
    [0.6, 'IV'],
    [0.79, 'IV'],
    [0.8, 'V'],
    [1, 'V'],
  ] as const)('drdLevelFromNorm(%f) === %s', (norm, level) => {
    expect(drdLevelFromNorm(norm)).toBe(level);
  });
});

describe('DRD scoring — calculateAxisScoreVersioned', () => {
  it('dispatches to v2 when asked, legacy when not, and never silently mixes the two', () => {
    const legacy = calculateAxisScoreVersioned(2, { '2A': { actual: 5, target: 5 } }, 'legacy_v1');
    const v2 = calculateAxisScoreVersioned(2, { '2A': { actual: 5, target: 5 } }, 'drd_scoring_v2');
    expect(legacy.calculationVersion).toBe('legacy_v1');
    expect(v2.calculationVersion).toBe('drd_scoring_v2');
    expect(legacy).not.toEqual(v2);
  });
});
