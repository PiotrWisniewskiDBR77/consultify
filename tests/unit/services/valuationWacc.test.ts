/**
 * M16/F1.1 — WACC from CAPM (single source of truth for the discount rate).
 */
import { describe, expect, it } from 'vitest';

import {
  computeWaccFromBreakdown,
  defaultAssumptions,
  type WaccBreakdown,
} from '../../../server/src/services/valuationService.js';

const DEFAULT: WaccBreakdown = {
  riskFreeRate: 4,
  equityRiskPremium: 5,
  beta: 1.2,
  costOfDebt: 8,
  taxRate: 19,
  debtWeight: 30,
  equityWeight: 70,
};

describe('computeWaccFromBreakdown — CAPM', () => {
  it('default breakdown → ~8.94% (ke=10, kd_at=6.48, 0.7·10+0.3·6.48)', () => {
    // ke = 4 + 1.2*5 = 10; kd_after_tax = 8*(1-0.19)=6.48; wacc=0.7*10+0.3*6.48=8.944
    expect(computeWaccFromBreakdown(DEFAULT)).toBeCloseTo(8.94, 1);
  });
  it('all-equity (debtWeight 0) → WACC = cost of equity', () => {
    expect(computeWaccFromBreakdown({ ...DEFAULT, equityWeight: 100, debtWeight: 0 })).toBeCloseTo(
      10,
      1
    );
  });
  it('all-debt → WACC = after-tax cost of debt', () => {
    expect(computeWaccFromBreakdown({ ...DEFAULT, equityWeight: 0, debtWeight: 100 })).toBeCloseTo(
      6.48,
      1
    );
  });
  it('normalizes weights that do not sum to 100', () => {
    const a = computeWaccFromBreakdown({ ...DEFAULT, equityWeight: 7, debtWeight: 3 });
    expect(a).toBeCloseTo(8.94, 1);
  });
  it('higher beta raises WACC', () => {
    expect(computeWaccFromBreakdown({ ...DEFAULT, beta: 2 })).toBeGreaterThan(
      computeWaccFromBreakdown(DEFAULT)
    );
  });
  it('tax shield lowers WACC (higher tax → lower)', () => {
    expect(computeWaccFromBreakdown({ ...DEFAULT, taxRate: 40 })).toBeLessThan(
      computeWaccFromBreakdown({ ...DEFAULT, taxRate: 0 })
    );
  });
  it('degenerate zero weights → equity-only fallback (no div-by-zero)', () => {
    expect(computeWaccFromBreakdown({ ...DEFAULT, equityWeight: 0, debtWeight: 0 })).toBeCloseTo(
      10,
      1
    );
  });
});

describe('defaultAssumptions — derives WACC from CAPM, not flat 12', () => {
  it('waccPercent comes from breakdown (~8.94), not the old flat 12', () => {
    const a = defaultAssumptions(5);
    expect(a.waccPercent).toBeCloseTo(8.94, 1);
    expect(a.waccPercent).not.toBe(12);
  });
  it('orgWacc overrides the derived value', () => {
    expect(defaultAssumptions(5, 11).waccPercent).toBe(11);
  });
});
