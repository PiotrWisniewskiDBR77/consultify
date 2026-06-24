/**
 * Decision Copilot service tests (M16/8.5)
 *
 * Deterministic trade-off engine — no LLM. Verifies the directional and
 * numeric correctness of the three what-if scenarios.
 */

import { describe, expect, it } from 'vitest';

import {
  whatIfHire,
  whatIfPriceChange,
  whatIfDelayInitiative,
} from '../../../server/src/services/decisionCopilotService.js';

describe('decisionCopilotService — whatIfHire', () => {
  it('shortens runway and lowers EBITDA when adding headcount', () => {
    const result = whatIfHire(
      { openingCash: 1_000_000, monthlyNetCash: -50_000, monthlyEbitda: -50_000 },
      3, // new hires
      20_000, // loaded cost per hire / month
      0, // start immediately
      24, // horizon
    );

    expect(result.runwayAfter).toBeLessThan(result.runwayBefore);
    expect(result.ebitdaImpact).toBeLessThan(0);
    expect(result.ebitdaImpact).toBe(-60_000);
    expect(result.tradeoff).toContain('Zatrudnienie');
  });

  it('pushes breakeven later and flags short runway', () => {
    const result = whatIfHire(
      { openingCash: 300_000, monthlyNetCash: -40_000, monthlyEbitda: 10_000 },
      5,
      15_000,
      0,
      24,
    );

    expect(result.ebitdaImpact).toBe(-75_000);
    expect(result.breakevenShiftPeriods).toBeGreaterThan(0);
    // 300k cash, burn becomes 40k + 75k = 115k/mo → < 6 months runway.
    expect(result.runwayAfter).toBeLessThan(6);
    expect(result.tradeoff).toContain('OSTRZEŻENIE');
  });

  it('is a no-op for zero hires', () => {
    const result = whatIfHire(
      { openingCash: 500_000, monthlyNetCash: -10_000, monthlyEbitda: -10_000 },
      0,
      20_000,
      0,
      12,
    );
    expect(result.runwayAfter).toBe(result.runwayBefore);
    expect(result.ebitdaImpact).toBe(0);
    expect(result.breakevenShiftPeriods).toBe(0);
  });

  it('defers cost so a later start preserves more runway than an immediate one', () => {
    const base = { openingCash: 600_000, monthlyNetCash: -20_000, monthlyEbitda: -20_000 };
    const immediate = whatIfHire(base, 2, 25_000, 0, 36);
    const deferred = whatIfHire(base, 2, 25_000, 6, 36);
    expect(deferred.runwayAfter).toBeGreaterThan(immediate.runwayAfter);
  });
});

describe('decisionCopilotService — whatIfPriceChange', () => {
  it('reflects volume elasticity: inelastic price hike raises EBITDA', () => {
    // +10% price, elasticity -0.5 → volume -5%, net revenue up.
    const result = whatIfPriceChange(
      { revenue: 1_000_000, variableCostRatio: 0.4 },
      10,
      -0.5,
    );
    expect(result.revenueImpact).toBeGreaterThan(0);
    expect(result.ebitdaImpact).toBeGreaterThan(0);
    expect(result.recommendation).toContain('wdrożyć');
  });

  it('elastic demand: same price hike can destroy revenue', () => {
    // +10% price, elasticity -2 → volume -20%, revenue falls.
    const elastic = whatIfPriceChange(
      { revenue: 1_000_000, variableCostRatio: 0.4 },
      10,
      -2,
    );
    const inelastic = whatIfPriceChange(
      { revenue: 1_000_000, variableCostRatio: 0.4 },
      10,
      -0.5,
    );
    expect(elastic.revenueImpact).toBeLessThan(0);
    // More elastic demand → strictly worse revenue outcome.
    expect(elastic.revenueImpact).toBeLessThan(inelastic.revenueImpact);
  });

  it('returns a neutral message for zero price change', () => {
    const result = whatIfPriceChange({ revenue: 500_000 }, 0, -1);
    expect(result.revenueImpact).toBe(0);
    expect(result.ebitdaImpact).toBe(0);
    expect(result.recommendation).toContain('Brak zmiany');
  });
});

describe('decisionCopilotService — whatIfDelayInitiative', () => {
  it('produces negative NPV impact and value at risk on delay', () => {
    const result = whatIfDelayInitiative(
      { annualBenefit: 200_000, discountRate: 0.1, horizonYears: 5, upfrontCost: 100_000 },
      12, // delay 1 year
    );
    expect(result.npvImpact).toBeLessThan(0);
    expect(result.valueAtRisk).toBeGreaterThan(0);
    expect(result.valueAtRisk).toBeCloseTo(-result.npvImpact, 2);
    expect(result.recommendation).toContain('Opóźnienie');
  });

  it('larger delay destroys more value', () => {
    const init = {
      annualBenefit: 150_000,
      discountRate: 0.08,
      horizonYears: 6,
      upfrontCost: 50_000,
    };
    const small = whatIfDelayInitiative(init, 6);
    const large = whatIfDelayInitiative(init, 24);
    expect(large.valueAtRisk).toBeGreaterThan(small.valueAtRisk);
  });

  it('is a no-op for zero delay', () => {
    const result = whatIfDelayInitiative(
      { annualBenefit: 100_000, discountRate: 0.1, horizonYears: 4 },
      0,
    );
    expect(result.npvImpact).toBe(0);
    expect(result.valueAtRisk).toBe(0);
    expect(result.recommendation).toContain('Brak opóźnienia');
  });
});
