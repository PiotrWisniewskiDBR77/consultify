import { describe, expect, it } from 'vitest';

import {
  SIRI_DIMENSIONS,
  type SIRIAssessmentData,
} from '../../../src/services/siriStructure';
import { buildSIRIConclusionModel } from '../../../src/services/report/siriConclusion';

/**
 * Structure tests for the SIRI conclusion layer (OXFORD O2.2, CONCLUSION_LAYER_STANDARD W1).
 * These assert the report is WNIOSKOWA (conclusive) — verdict + K1→K2→K3→K4 + gap cards —
 * and that numbers come only from the engine input (no invented values).
 */

function makeSIRIData(dims: Record<string, { current: number; target: number }>): SIRIAssessmentData {
  const dimensions: Record<string, { current: number; target: number; gap: number }> = {};
  SIRI_DIMENSIONS.forEach((d) => {
    const s = dims[d.id] ?? { current: 0, target: 0 };
    dimensions[d.id] = { current: s.current, target: s.target, gap: Math.max(0, s.target - s.current) };
  });
  const vals = Object.values(dims).map((v) => v.current);
  const overall = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
  return {
    buildingBlocks: {
      PROCESS: { score: 0, dimensionScores: {} },
      TECHNOLOGY: { score: 0, dimensionScores: {} },
      ORGANIZATION: { score: 0, dimensionScores: {} },
    },
    dimensions,
    prioritisationMatrix: {},
    overallScore: overall,
    metadata: { assessmentDate: '2026-07-02', version: '2.0', source: 'manual' },
  } as SIRIAssessmentData;
}

const SAMPLE = makeSIRIData({
  operations: { current: 3, target: 4 },
  supply_chain: { current: 2, target: 4 }, // gap 2
  product_lifecycle: { current: 3, target: 3 },
  automation: { current: 4, target: 4 },
  connectivity: { current: 1, target: 4 }, // gap 3 (largest)
  intelligence: { current: 2, target: 3 },
  talent_readiness: { current: 3, target: 4 },
  structure_management: { current: 2, target: 3 },
});

describe('SIRI conclusion — executive summary (W1)', () => {
  it('produces an answer-first verdict headline (not "wynik wynosi X")', () => {
    const { executiveSummary } = buildSIRIConclusionModel(SAMPLE, 'pl');
    expect(executiveSummary.headline).toBeTruthy();
    expect(executiveSummary.headline.length).toBeGreaterThan(20);
    // headline is a thesis: it names the blocking dimension (largest gap = connectivity)
    expect(executiveSummary.headline).toContain('Connectivity');
  });

  it('has all K1–K4 blocks non-empty', () => {
    const { executiveSummary: e } = buildSIRIConclusionModel(SAMPLE, 'pl');
    for (const k of [e.k1_state, e.k2_meaning, e.k3_threeGaps, e.k4_whatFirst, e.k5_effect]) {
      expect(k.trim().length).toBeGreaterThan(0);
    }
  });

  it('carries only engine numbers (overall + weakest gap = connectivity 3)', () => {
    const { executiveSummary: e } = buildSIRIConclusionModel(SAMPLE, 'pl');
    expect(e.facts.overallScore).toBe(SAMPLE.overallScore);
    expect(e.facts.weakestName).toBe('Connectivity');
    expect(e.facts.weakestGap).toBe(3);
    expect(e.facts.totalDimensions).toBe(SIRI_DIMENSIONS.length);
  });

  it('recommends the largest-gap dimension first with a why-first rationale', () => {
    const { executiveSummary: e } = buildSIRIConclusionModel(SAMPLE, 'pl');
    expect(e.k4_whatFirst).toContain('Connectivity');
    expect(e.k4_whatFirst.toLowerCase()).toMatch(/bo|kolejność/);
  });

  it('effect block has a time horizon (K4 rule R6)', () => {
    const { executiveSummary: e } = buildSIRIConclusionModel(SAMPLE, 'pl');
    expect(e.k5_effect).toMatch(/12 miesi|6–12/);
  });
});

describe('SIRI conclusion — gap cards (co jest → co znaczy → co robić → efekt)', () => {
  it('returns top-3 gaps ordered by gap size', () => {
    const { gapCards } = buildSIRIConclusionModel(SAMPLE, 'pl');
    expect(gapCards).toHaveLength(3);
    expect(gapCards[0].dimensionName).toBe('Connectivity'); // gap 3
    expect(gapCards[0].gap).toBeGreaterThanOrEqual(gapCards[1].gap);
    expect(gapCards[1].gap).toBeGreaterThanOrEqual(gapCards[2].gap);
  });

  it('each card carries the full 4-part formula', () => {
    const { gapCards } = buildSIRIConclusionModel(SAMPLE, 'pl');
    for (const c of gapCards) {
      expect(c.whatIs).toContain(String(c.current));
      expect(c.whatItMeans.length).toBeGreaterThan(0);
      expect(c.whatToDo.length).toBeGreaterThan(0);
      expect(c.effect).toContain(String(c.gap));
    }
  });

  it('assigns an owner role to each recommendation (R6 adresat)', () => {
    const { gapCards } = buildSIRIConclusionModel(SAMPLE, 'en');
    for (const c of gapCards) {
      expect(c.whatToDo).toMatch(/Lead/);
    }
  });
});

describe('SIRI conclusion — degenerate inputs', () => {
  it('handles no-gap data (all targets met) without a false bottleneck', () => {
    const data = makeSIRIData({
      operations: { current: 4, target: 4 },
      automation: { current: 5, target: 5 },
    });
    const { executiveSummary, gapCards } = buildSIRIConclusionModel(data, 'pl');
    expect(gapCards).toHaveLength(0);
    expect(executiveSummary.k3_threeGaps).toMatch(/Brak istotnych luk/);
  });

  it('handles empty assessment as insufficient confidence', () => {
    const data = makeSIRIData({});
    const { executiveSummary } = buildSIRIConclusionModel(data, 'pl');
    expect(executiveSummary.confidence).toBe('insufficient');
    expect(executiveSummary.headline).toMatch(/niekompletny/);
  });
});
