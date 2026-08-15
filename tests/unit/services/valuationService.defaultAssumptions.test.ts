import { describe, expect, it } from 'vitest';
import { defaultAssumptions } from '../../../server/src/services/valuationService';

describe('valuationService.defaultAssumptions', () => {
  it('returns defaults with expected baseline values', () => {
    const assumptions = defaultAssumptions();
    expect(assumptions.horizonYears).toBe(5);
    expect(assumptions.waccPercent).toBe(8.94);
    expect(assumptions.waccBreakdown).toEqual(
      expect.objectContaining({
        riskFreeRate: 4,
        equityRiskPremium: 5,
        beta: 1.2,
        costOfDebt: 8,
        taxRate: 19,
        debtWeight: 30,
        equityWeight: 70,
      })
    );
    expect(assumptions.terminalMethod).toBe('gordon');
    expect(assumptions.terminalGrowthPercent).toBe(3);
    expect(assumptions.exitMultiple).toBe(8);
    expect(assumptions.exitMultipleMetric).toBe('EV/EBITDA');
    expect(assumptions.netDebt).toBe(0);
    expect(assumptions.manualForecast?.years).toEqual([]);
  });

  it('respects custom horizon years', () => {
    const assumptions = defaultAssumptions(10);
    expect(assumptions.horizonYears).toBe(10);
  });

  it('returns independent objects across calls', () => {
    const a = defaultAssumptions();
    const b = defaultAssumptions();
    expect(a).not.toBe(b);
    a.waccBreakdown.beta = 9;
    a.manualForecast?.years.push({ year: 1, fcff: 100 });
    expect(b.waccBreakdown.beta).toBe(1.2);
    expect(b.manualForecast?.years).toEqual([]);
  });
});
