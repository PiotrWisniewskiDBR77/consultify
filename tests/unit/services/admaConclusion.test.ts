import { describe, expect, it } from 'vitest';

import {
  ADMA_DIMENSIONS,
  ADMA_PILLARS,
  type ADMAAssessmentData,
  type ADMAPillarId,
} from '../../../src/services/admaStructure';
import { buildADMAConclusionModel, buildFoFRoad } from '../../../src/services/report/admaConclusion';

/**
 * Structure tests for the ADMA conclusion layer (OXFORD O2.2, CONCLUSION_LAYER_STANDARD W1).
 * Adds the explicit "road to Factory of the Future (FoF≥4)" assertions on top of the
 * verdict + K1→K2→K3→K4 + gap-card checks shared with SIRI.
 */

function makeADMAData(dims: Record<string, { current: number; target: number }>): ADMAAssessmentData {
  const dimensions: Record<string, { current: number; target: number; gap: number }> = {};
  ADMA_DIMENSIONS.forEach((d) => {
    const s = dims[d.id] ?? { current: 0, target: 0 };
    dimensions[d.id] = { current: s.current, target: s.target, gap: Math.max(0, s.target - s.current) };
  });

  const pillars = {} as Record<ADMAPillarId, { current: number; target: number; gap: number; dimensionScores: Record<string, number> }>;
  (Object.keys(ADMA_PILLARS) as ADMAPillarId[]).forEach((pid) => {
    const dimIds = ADMA_PILLARS[pid].dimensionIds;
    const curs = dimIds.map((id) => dimensions[id]?.current ?? 0).filter((v) => v > 0);
    const tgts = dimIds.map((id) => dimensions[id]?.target ?? 0).filter((v) => v > 0);
    const cur = curs.length ? Math.round((curs.reduce((a, b) => a + b, 0) / curs.length) * 10) / 10 : 0;
    const tgt = tgts.length ? Math.round((tgts.reduce((a, b) => a + b, 0) / tgts.length) * 10) / 10 : 0;
    pillars[pid] = { current: cur, target: tgt, gap: Math.max(0, tgt - cur), dimensionScores: {} };
  });

  const vals = Object.values(dims).map((v) => v.current);
  const overall = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;

  return {
    pillars,
    dimensions,
    overallMaturity: overall,
    metadata: { assessmentDate: '2026-07-02', version: '2.0', source: 'manual' },
  } as ADMAAssessmentData;
}

// Mixed profile: some transformations below FoF (4), some at/above.
const SAMPLE = makeADMAData({
  digital_strategy: { current: 3, target: 5 },
  digital_investments: { current: 2, target: 4 },
  digital_culture: { current: 2, target: 4 }, // strategy pillar weak
  product_features: { current: 4, target: 5 },
  product_data: { current: 4, target: 5 },
  production_tech: { current: 5, target: 5 }, // strong
  production_it: { current: 4, target: 5 },
  supply_integration: { current: 2, target: 4 },
  supply_visibility: { current: 2, target: 4 },
  data_collection: { current: 3, target: 5 },
  data_analytics: { current: 2, target: 5 }, // large gap
  data_services: { current: 1, target: 4 },
});

describe('ADMA conclusion — road to Factory of the Future (FoF≥4)', () => {
  it('classifies each T1–T7 transformation vs the FoF benchmark', () => {
    const road = buildFoFRoad(SAMPLE, 'pl', 4.0);
    expect(road.benchmark).toBe(4.0);
    expect(road.all).toHaveLength(7);
    expect(road.belowFoF.length + road.atOrAboveFoF.length).toBeLessThanOrEqual(7);
    // at least one transformation is below FoF given the weak profile
    expect(road.belowFoF.length).toBeGreaterThan(0);
  });

  it('orders below-FoF transformations by largest distance first', () => {
    const road = buildFoFRoad(SAMPLE, 'pl', 4.0);
    for (let i = 1; i < road.belowFoF.length; i++) {
      expect(road.belowFoF[i - 1].gapToFoF!).toBeGreaterThanOrEqual(road.belowFoF[i].gapToFoF!);
    }
  });

  it('gapToFoF equals benchmark minus current (numbers from engine)', () => {
    const road = buildFoFRoad(SAMPLE, 'pl', 4.0);
    for (const t of road.all) {
      if (t.current === null || t.gapToFoF === null) continue;
      expect(t.gapToFoF).toBeCloseTo(Math.round((4.0 - t.current) * 10) / 10, 5);
    }
  });

  it('summary states how many transformations are below FoF', () => {
    const road = buildFoFRoad(SAMPLE, 'pl', 4.0);
    expect(road.summary).toMatch(/Factory of the Future/);
    expect(road.summary).toContain(String(road.belowFoF.length));
  });

  it('when all transformations reach FoF, summary says so', () => {
    const strong = makeADMAData(
      Object.fromEntries(ADMA_DIMENSIONS.map((d) => [d.id, { current: 5, target: 5 }]))
    );
    const road = buildFoFRoad(strong, 'pl', 4.0);
    expect(road.belowFoF).toHaveLength(0);
    expect(road.summary).toMatch(/osiąga próg|Wszystkie/);
  });
});

describe('ADMA conclusion — executive summary (FoF-oriented verdict)', () => {
  it('headline is a FoF-oriented thesis mentioning the number below threshold', () => {
    const { executiveSummary, fofRoad } = buildADMAConclusionModel(SAMPLE, 'pl', 4.0);
    expect(executiveSummary.headline).toMatch(/Factory of the Future|FoF/);
    expect(executiveSummary.facts.transformationsBelowFoF).toBe(fofRoad.belowFoF.length);
  });

  it('has all K1–K4 blocks and a horizon in the effect', () => {
    const { executiveSummary: e } = buildADMAConclusionModel(SAMPLE, 'pl', 4.0);
    for (const k of [e.k1_state, e.k2_meaning, e.k3_threeGaps, e.k4_whatFirst, e.k5_effect]) {
      expect(k.trim().length).toBeGreaterThan(0);
    }
    expect(e.k5_effect).toMatch(/miesi/);
  });

  it('recommends closing the largest FoF-gap transformation first', () => {
    const { executiveSummary: e, fofRoad } = buildADMAConclusionModel(SAMPLE, 'pl', 4.0);
    expect(e.k4_whatFirst).toContain(fofRoad.belowFoF[0].name);
  });
});

describe('ADMA conclusion — gap cards', () => {
  it('returns top-3 dimension gaps with the 4-part formula and owner role', () => {
    const { gapCards } = buildADMAConclusionModel(SAMPLE, 'pl', 4.0);
    expect(gapCards).toHaveLength(3);
    for (const c of gapCards) {
      expect(c.whatIs).toContain(String(c.current));
      expect(c.whatItMeans).toMatch(/FoF|Factory/);
      expect(c.whatToDo.length).toBeGreaterThan(0);
      expect(c.effect).toContain(String(c.target));
    }
  });
});
