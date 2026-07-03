import { describe, it, expect } from 'vitest';
import {
  calculateImpactValue,
  rankByImpactValue,
  buildDefaultInputs,
  DEFAULT_SIRI_PM_WEIGHTS,
  type SIRIPrioritisationInput,
} from '../../src/services/siriPrioritisation';
import { SIRI_PRIORITISATION_AREAS } from '../../src/services/siriStructure';

describe('siriPrioritisation — Impact Value engine', () => {
  // ----------------------------------------------------------------
  // Formula correctness
  // ----------------------------------------------------------------
  it('calculateImpactValue computes the canonical formula for known inputs', () => {
    // IV = Wc·(DOR_c·Cost) + Wk·(DOR_k·KPI) + Wp·(BIC − AMS)
    // With defaults Wc=0.3, Wk=0.3, Wp=0.4:
    //   cost term      = 0.3 · (0.5 · 2) = 0.3 · 1.0   = 0.30
    //   kpi term       = 0.3 · (1.0 · 3) = 0.3 · 3.0   = 0.90
    //   proximity term = 0.4 · (5 − 2)   = 0.4 · 3     = 1.20
    //   total = 2.40
    const input: SIRIPrioritisationInput = {
      areaId: 'vertical_integration',
      ams: 2,
      bic: 5,
      costRelevance: 0.5,
      costProfile: 2,
      kpiRelevance: 1.0,
      kpiImportance: 3,
    };
    expect(calculateImpactValue(input)).toBe(2.4);
  });

  it('calculateImpactValue rounds the result to 2 decimal places', () => {
    // proximity-only: 0.4 · (3.333 − 0) ≈ 1.3332 → 1.33
    const input: SIRIPrioritisationInput = {
      areaId: 'horizontal_integration',
      ams: 0,
      bic: 3.333,
      costRelevance: 0,
      costProfile: 0,
      kpiRelevance: 0,
      kpiImportance: 0,
    };
    expect(calculateImpactValue(input)).toBe(1.33);
  });

  // ----------------------------------------------------------------
  // Weights invariant
  // ----------------------------------------------------------------
  it('default weights sum to exactly 1', () => {
    const { cost, kpi, proximity } = DEFAULT_SIRI_PM_WEIGHTS;
    expect(cost + kpi + proximity).toBeCloseTo(1, 10);
  });

  it('throws when weights do not sum to 1', () => {
    const input: SIRIPrioritisationInput = {
      areaId: 'vertical_integration',
      ams: 2,
      bic: 5,
      costRelevance: 1,
      costProfile: 1,
      kpiRelevance: 1,
      kpiImportance: 1,
    };
    expect(() =>
      calculateImpactValue(input, { cost: 0.5, kpi: 0.5, proximity: 0.5 })
    ).toThrow();
  });

  // ----------------------------------------------------------------
  // Ranking
  // ----------------------------------------------------------------
  it('rankByImpactValue sorts descending and assigns rank 1..n', () => {
    const inputs: SIRIPrioritisationInput[] = [
      // low IV (small gap)
      mk('vertical_integration', { ams: 4, bic: 5 }),
      // high IV (large gap)
      mk('horizontal_integration', { ams: 0, bic: 5 }),
      // medium IV
      mk('integrated_product_lifecycle', { ams: 2, bic: 5 }),
    ];
    const ranked = rankByImpactValue(inputs);

    // descending order
    expect(ranked[0].impactValue).toBeGreaterThanOrEqual(ranked[1].impactValue);
    expect(ranked[1].impactValue).toBeGreaterThanOrEqual(ranked[2].impactValue);
    // ranks
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
    // top is the largest gap area
    expect(ranked[0].areaId).toBe('horizontal_integration');
    // name attached from SIRI_PRIORITISATION_AREAS
    expect(ranked[0].name).toBe('Horizontal Integration');
  });

  it('result gapToBIC equals bic − ams', () => {
    const ranked = rankByImpactValue([mk('vertical_integration', { ams: 1.5, bic: 4 })]);
    expect(ranked[0].gapToBIC).toBe(2.5);
  });

  // ----------------------------------------------------------------
  // buildDefaultInputs
  // ----------------------------------------------------------------
  it('buildDefaultInputs returns 16 inputs when 16 scores are provided', () => {
    const scores: Record<string, number> = {};
    SIRI_PRIORITISATION_AREAS.forEach((area, i) => {
      scores[area.id] = (i % 6) as number; // bands 0..5
    });
    expect(Object.keys(scores)).toHaveLength(16);

    const inputs = buildDefaultInputs(scores);
    expect(inputs).toHaveLength(16);
    // defaults applied
    expect(inputs[0].bic).toBe(4);
    expect(inputs[0].costRelevance).toBe(1);
    expect(inputs[0].kpiRelevance).toBe(1);
    // even share = 1/16
    expect(inputs[0].costProfile).toBeCloseTo(1 / 16, 10);
    // ranking off default inputs must produce 16 ranked results
    const ranked = rankByImpactValue(inputs);
    expect(ranked).toHaveLength(16);
    expect(ranked[ranked.length - 1].rank).toBe(16);
  });

  it('buildDefaultInputs honors a custom defaultBIC', () => {
    const inputs = buildDefaultInputs({ vertical_integration: 1 }, { defaultBIC: 5 });
    expect(inputs[0].bic).toBe(5);
  });
});

// Helper: build a full input with sensible neutral cost/kpi members,
// so the proximity member dominates the ranking under test.
function mk(
  areaId: string,
  partial: Partial<SIRIPrioritisationInput>
): SIRIPrioritisationInput {
  return {
    areaId,
    ams: 0,
    bic: 5,
    costRelevance: 0,
    costProfile: 0,
    kpiRelevance: 0,
    kpiImportance: 0,
    ...partial,
  };
}
