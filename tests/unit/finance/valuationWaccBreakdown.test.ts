/**
 * Task #110 (M16 Finanse — valuations polish).
 *
 * Guards computeWaccFromBreakdown — the pure CAPM/WACC derivation used by the
 * valuation view. Critically it must survive PG's habit of returning numeric
 * columns as strings (bigint/numeric-as-string): every input is fed through
 * Number(), so string inputs must produce identical results to numeric ones.
 */
import { describe, expect, it } from 'vitest';

import { computeWaccFromBreakdown } from '../../../server/src/services/valuationService.js';

describe('computeWaccFromBreakdown', () => {
  it('computes the classic WACC = wE*ke + wD*kd*(1-tax)', () => {
    // ke = rf + beta*erp = 3 + 1*5 = 8; kdAfterTax = 4*(1-0.19) = 3.24
    // wacc = 0.6*8 + 0.4*3.24 = 4.8 + 1.296 = 6.096 -> rounded 6.1
    const wacc = computeWaccFromBreakdown({
      riskFreeRate: 3,
      equityRiskPremium: 5,
      beta: 1,
      costOfDebt: 4,
      taxRate: 19,
      equityWeight: 60,
      debtWeight: 40,
    });
    expect(wacc).toBeCloseTo(6.1, 5);
  });

  it('is invariant to string vs numeric inputs (PG numeric-as-string safety)', () => {
    const numeric = computeWaccFromBreakdown({
      riskFreeRate: 3,
      equityRiskPremium: 5,
      beta: 1,
      costOfDebt: 4,
      taxRate: 19,
      equityWeight: 60,
      debtWeight: 40,
    });
    const stringy = computeWaccFromBreakdown({
      riskFreeRate: '3',
      equityRiskPremium: '5',
      beta: '1',
      costOfDebt: '4',
      taxRate: '19',
      equityWeight: '60',
      debtWeight: '40',
    } as any);
    expect(stringy).toBe(numeric);
  });

  it('normalizes weights that do not sum to 1 (or 100)', () => {
    // Weights 3:1 -> 0.75 / 0.25 regardless of absolute scale.
    const a = computeWaccFromBreakdown({
      riskFreeRate: 2,
      equityRiskPremium: 6,
      beta: 1,
      costOfDebt: 5,
      taxRate: 0,
      equityWeight: 75,
      debtWeight: 25,
    });
    const b = computeWaccFromBreakdown({
      riskFreeRate: 2,
      equityRiskPremium: 6,
      beta: 1,
      costOfDebt: 5,
      taxRate: 0,
      equityWeight: 3,
      debtWeight: 1,
    });
    expect(b).toBe(a);
  });

  it('falls back to 100% equity when both weights are zero/absent', () => {
    // ke only: rf + beta*erp = 2 + 1*6 = 8
    const wacc = computeWaccFromBreakdown({
      riskFreeRate: 2,
      equityRiskPremium: 6,
      beta: 1,
      costOfDebt: 5,
      taxRate: 30,
      equityWeight: 0,
      debtWeight: 0,
    });
    expect(wacc).toBe(8);
  });

  it('clamps the tax rate into [0,100] and treats junk numbers as 0', () => {
    // tax clamped to 100 -> kdAfterTax = kd*(1-1)=0; pure equity leg.
    const clamped = computeWaccFromBreakdown({
      riskFreeRate: 1,
      equityRiskPremium: 4,
      beta: 1,
      costOfDebt: 10,
      taxRate: 500,
      equityWeight: 50,
      debtWeight: 50,
    });
    // ke = 1 + 4 = 5; kdAfterTax = 0; wacc = 0.5*5 + 0.5*0 = 2.5
    expect(clamped).toBeCloseTo(2.5, 5);

    const junk = computeWaccFromBreakdown({
      riskFreeRate: 'abc',
      equityRiskPremium: undefined,
      beta: null,
      costOfDebt: NaN,
      taxRate: 'x',
      equityWeight: 1,
      debtWeight: 0,
    } as any);
    expect(junk).toBe(0);
  });
});
