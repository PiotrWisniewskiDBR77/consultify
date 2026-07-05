/**
 * Structural tests for the maturity pathway engine (OXFORD Round 4 #4, O1).
 *
 * Guards:
 * - DRD: all 32 Canon §5 transitions (8 dimensions × I→II→III→IV→V) are present,
 *   non-empty, and produce a well-formed K1→K4 recommendation.
 * - SIRI/ADMA: every dimension × every non-ceiling level returns a non-empty
 *   recipe derived from the structure/knowledge modules.
 * - Ceiling levels and unknown dimensions never throw and never return an
 *   empty recipe (fallback contract).
 */
import { describe, expect, it } from 'vitest';

import { DRD_DIMENSION_IDS, DRD_DIMENSION_LABELS } from '@/services/assessmentKnowledge/drdIndustryProfiles';
import {
  DRD_MATURITY_PATHWAYS,
  getDRDPathway,
} from '@/services/assessmentKnowledge/maturityPathwayDrdData';
import {
  getMaturityPathway,
  type MaturityPathwayRecommendation,
} from '@/services/assessmentKnowledge/maturityPathwayService';
import { ADMA_DIMENSIONS } from '@/services/admaStructure';
import { SIRI_DIMENSIONS } from '@/services/siriStructure';

function expectWellFormed(rec: MaturityPathwayRecommendation) {
  expect(rec.currentState.length).toBeGreaterThan(10);
  expect(rec.gapMeaning.length).toBeGreaterThan(10);
  expect(Array.isArray(rec.actions)).toBe(true);
  expect(rec.actions.length).toBeGreaterThan(0);
  for (const a of rec.actions) {
    expect(a.length).toBeGreaterThan(5);
  }
  expect(rec.targetEvidence.length).toBeGreaterThan(10);
  expect(Array.isArray(rec.typicalObstacles)).toBe(true);
}

describe('DRD Canon §5 pathway data — completeness (32 paths)', () => {
  it('defines exactly 32 transitions: 8 dimensions × 4 (I→II→III→IV→V)', () => {
    expect(DRD_MATURITY_PATHWAYS).toHaveLength(32);
    expect(DRD_DIMENSION_IDS).toHaveLength(8);
  });

  it('covers every dimension × fromLevel 1..4 with no gaps and no duplicates', () => {
    const seen = new Set<string>();
    for (const p of DRD_MATURITY_PATHWAYS) {
      const key = `${p.dimension}#${p.fromLevel}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(p.toLevel).toBe(p.fromLevel + 1);
    }
    for (const dim of DRD_DIMENSION_IDS) {
      for (const fromLevel of [1, 2, 3, 4] as const) {
        expect(seen.has(`${dim}#${fromLevel}`)).toBe(true);
      }
    }
  });

  it('every transition has 1-5 non-empty actions transcribed from the canon', () => {
    // Canon §5 text is semicolon-separated per transition; most transitions carry
    // 2-4 clauses, but a single-clause canon sentence (e.g. D5 I→II) is legitimate
    // and must NOT be artificially split just to satisfy a test assumption.
    for (const p of DRD_MATURITY_PATHWAYS) {
      expect(p.actions.length).toBeGreaterThanOrEqual(1);
      expect(p.actions.length).toBeLessThanOrEqual(5);
      for (const action of p.actions) {
        expect(action.trim().length).toBeGreaterThan(5);
      }
      expect(p.canonText.length).toBeGreaterThan(20);
    }
  });

  it('getDRDPathway looks up by dimension + fromLevel', () => {
    const p = getDRDPathway('D1', 1);
    expect(p).toBeDefined();
    expect(p?.toLevel).toBe(2);
    expect(getDRDPathway('D8', 4)?.actions.length).toBeGreaterThan(0);
    expect(getDRDPathway('D1', 5)).toBeUndefined(); // no I→VI
  });
});

describe('getMaturityPathway — DRD (canon-sourced, all 8 dims × levels 1-4)', () => {
  for (const dimensionId of DRD_DIMENSION_IDS) {
    for (const currentLevel of [1, 2, 3, 4]) {
      it(`${dimensionId} @ level ${currentLevel} -> non-empty K1-K4 recipe`, () => {
        const rec = getMaturityPathway({ framework: 'drd', dimensionId, currentLevel });
        expect(rec.source).toBe('canon');
        expect(rec.fromLevel).toBe(currentLevel);
        expect(rec.toLevel).toBe(currentLevel + 1);
        expect(rec.dimensionName).toBe(DRD_DIMENSION_LABELS[dimensionId].pl);
        expectWellFormed(rec);
      });
    }
  }

  it('D8 (AI) surfaces the D4 prerequisite from the foundation graph (Canon §7.3)', () => {
    const rec = getMaturityPathway({ framework: 'drd', dimensionId: 'D8', currentLevel: 2 });
    expect(rec.prerequisiteNote).toBeDefined();
    expect(rec.prerequisiteNote).toContain('D4');
  });

  it('at the ceiling (level 5) returns a well-formed "sustain" recommendation, not an error', () => {
    const rec = getMaturityPathway({ framework: 'drd', dimensionId: 'D1', currentLevel: 5 });
    expect(rec.fromLevel).toBe(rec.toLevel);
    expectWellFormed(rec);
  });

  it('unknown DRD dimension id degrades to the generic fallback without throwing', () => {
    const rec = getMaturityPathway({ framework: 'drd', dimensionId: 'D99', currentLevel: 2 });
    expect(rec.source).toBe('fallback');
    expectWellFormed(rec);
  });

  it('supports English output for the same transition', () => {
    const rec = getMaturityPathway({
      framework: 'drd',
      dimensionId: 'D1',
      currentLevel: 1,
      language: 'en',
    });
    expect(rec.dimensionName).toBe(DRD_DIMENSION_LABELS.D1.en);
    expectWellFormed(rec);
  });
});

describe('getMaturityPathway — SIRI (structure-derived, all 8 dims × levels 0-4)', () => {
  for (const dimension of SIRI_DIMENSIONS) {
    for (const currentLevel of [0, 1, 2, 3, 4]) {
      it(`${dimension.id} @ level ${currentLevel} -> non-empty recipe`, () => {
        const rec = getMaturityPathway({
          framework: 'siri',
          dimensionId: dimension.id,
          currentLevel,
        });
        expect(rec.source).toBe('structure-derived');
        expect(rec.fromLevel).toBe(currentLevel);
        expect(rec.toLevel).toBe(currentLevel + 1);
        expectWellFormed(rec);
      });
    }
  }

  it('at the ceiling (level 5) returns a well-formed "sustain" recommendation', () => {
    const rec = getMaturityPathway({ framework: 'siri', dimensionId: 'operations', currentLevel: 5 });
    expect(rec.fromLevel).toBe(rec.toLevel);
    expectWellFormed(rec);
  });

  it('unknown SIRI dimension id degrades to the generic fallback', () => {
    const rec = getMaturityPathway({ framework: 'siri', dimensionId: 'nope', currentLevel: 2 });
    expect(rec.source).toBe('fallback');
    expectWellFormed(rec);
  });
});

describe('getMaturityPathway — ADMA (structure-derived, all 12 dims × levels 1-4)', () => {
  for (const dimension of ADMA_DIMENSIONS) {
    for (const currentLevel of [1, 2, 3, 4]) {
      it(`${dimension.id} @ level ${currentLevel} -> non-empty recipe`, () => {
        const rec = getMaturityPathway({
          framework: 'adma',
          dimensionId: dimension.id,
          currentLevel,
        });
        expect(rec.source).toBe('structure-derived');
        expect(rec.fromLevel).toBe(currentLevel);
        expect(rec.toLevel).toBe(currentLevel + 1);
        expectWellFormed(rec);
      });
    }
  }

  it('at the ceiling (level 5) returns a well-formed "sustain" recommendation', () => {
    const rec = getMaturityPathway({
      framework: 'adma',
      dimensionId: 'digital_strategy',
      currentLevel: 5,
    });
    expect(rec.fromLevel).toBe(rec.toLevel);
    expectWellFormed(rec);
  });

  it('unknown ADMA dimension id degrades to the generic fallback', () => {
    const rec = getMaturityPathway({ framework: 'adma', dimensionId: 'nope', currentLevel: 2 });
    expect(rec.source).toBe('fallback');
    expectWellFormed(rec);
  });
});

describe('getMaturityPathway — cross-cutting robustness', () => {
  it('never throws on an unknown framework string', () => {
    expect(() =>
      getMaturityPathway({ framework: 'unknown' as never, dimensionId: 'D1', currentLevel: 1 })
    ).not.toThrow();
  });

  it('clamps out-of-range currentLevel instead of throwing', () => {
    expect(() => getMaturityPathway({ framework: 'drd', dimensionId: 'D1', currentLevel: 999 })).not.toThrow();
    expect(() => getMaturityPathway({ framework: 'drd', dimensionId: 'D1', currentLevel: -5 })).not.toThrow();
  });
});
