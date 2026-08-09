/**
 * Pure unit tests for `baselineScheduleEngine.ts` — no database. Hand-verifiable arithmetic for
 * every schedule_type function, plus GoldCo PARENT (PLN standalone) January 2026 cross-checks
 * against the independent oracle (`wp_d06_oracle.mjs` / WP-D06 report), matching the "pure,
 * DB-free" test style already established in this directory.
 */
import { describe, expect, it } from 'vitest';

import {
  computeCapexDepreciation,
  computeCogsOpex,
  computeEquityRe,
  computeHeadcount,
  computeLeases,
  computeRevenuePvm,
  computeTaxNol,
  computeWcDsoDioDpo,
  lookupScheduledAmortization,
} from '../baselineScheduleEngine.js';

describe('computeRevenuePvm', () => {
  it('GoldCo January 2026: 11,375,000 * 1.05 = 11,943,750', () => {
    expect(computeRevenuePvm({ priorYearSameMonthRevenue: 11_375_000, annualGrowthRate: 0.05 })).toBeCloseTo(11_943_750, 6);
  });
  it('0% growth is a pure carry-forward', () => {
    expect(computeRevenuePvm({ priorYearSameMonthRevenue: 1_000_000, annualGrowthRate: 0 })).toBe(1_000_000);
  });
});

describe('computeCogsOpex', () => {
  it('GoldCo January 2026 ratios (COGS_RATIO=118/182, OPEX_RATIO=34/182)', () => {
    const revenue = 11_943_750;
    const result = computeCogsOpex({ revenue, cogsRatio: 118 / 182, opexRatio: 34 / 182 });
    expect(result.cogs).toBeCloseTo(7_743_750, 3);
    expect(result.opex).toBeCloseTo(2_231_250, 3);
    expect(result.grossMargin).toBeCloseTo(revenue - result.cogs, 6);
    expect(result.ebitda).toBeCloseTo(result.grossMargin - result.opex, 6);
  });
});

describe('computeWcDsoDioDpo', () => {
  it('brief literal formula: AR = revenue/days_in_period * DSO', () => {
    const result = computeWcDsoDioDpo({ revenue: 11_943_750, cogs: 7_743_750, daysInPeriod: 31, dsoDays: 52.14285714285714, dioDays: 60.317796610169495, dpoDays: 54.131355932203384 });
    expect(result.ar).toBeCloseTo(20_089_717.74193548, 1);
    expect(result.inventory).toBeCloseTo(15_067_288.306451613, 1);
    expect(result.ap).toBeCloseTo(13_521_925.403225804, 1);
  });
  it('rejects zero/negative daysInPeriod', () => {
    expect(() => computeWcDsoDioDpo({ revenue: 1, cogs: 1, daysInPeriod: 0, dsoDays: 1, dioDays: 1, dpoDays: 1 })).toThrow();
  });
});

describe('computeCapexDepreciation', () => {
  it('GoldCo January 2026: depreciation on the OPENING gross block, straight-line run-rate', () => {
    const result = computeCapexDepreciation({
      revenue: 11_943_750,
      priorFixedAssets: 101_500_000,
      capexPctOfRevenue: 9_000_000 / 182_000_000,
      usefulLifeMonths: (12 * 96_500_000) / 7_000_000,
    });
    expect(result.capex).toBeCloseTo(590_625, 3);
    expect(result.depreciation).toBeCloseTo(613_557.8583765113, 1);
    expect(result.closingFixedAssets).toBeCloseTo(101_500_000 + result.capex - result.depreciation, 6);
  });
});

describe('lookupScheduledAmortization', () => {
  it('returns the contractual schedule value at the given 0-based period index', () => {
    const schedule = { scheduledPrincipalByMonth: [675_000, 675_000, 675_000] };
    expect(lookupScheduledAmortization(schedule, 0)).toBe(675_000);
    expect(lookupScheduledAmortization(schedule, 2)).toBe(675_000);
  });
  it('returns 0 once the schedule is exhausted (facility fully amortized), not undefined/NaN', () => {
    const schedule = { scheduledPrincipalByMonth: [675_000] };
    expect(lookupScheduledAmortization(schedule, 5)).toBe(0);
  });
  it('rejects a negative periodIndex', () => {
    expect(() => lookupScheduledAmortization({ scheduledPrincipalByMonth: [1] }, -1)).toThrow();
  });
});

describe('computeTaxNol', () => {
  it('a profit is taxed at the statutory rate', () => {
    const result = computeTaxNol({ pretaxIncome: 21_000_000, statutoryTaxRate: 0.19 });
    expect(result.taxExpense).toBeCloseTo(3_990_000, 6);
    expect(result.netIncome).toBeCloseTo(17_010_000, 6);
  });
  it('a loss carries ZERO tax expense (never a fabricated tax benefit) and flows through in full', () => {
    const result = computeTaxNol({ pretaxIncome: -500_000, statutoryTaxRate: 0.19 });
    expect(result.taxExpense).toBe(0);
    expect(result.netIncome).toBe(-500_000);
  });
});

describe('computeEquityRe', () => {
  it('no-dividend roll-forward: closing = opening + NI', () => {
    expect(computeEquityRe({ priorRetainedEarnings: 84_603_000, netIncome: 968_661.54, dividendsDeclared: 0 }).closingRetainedEarnings).toBeCloseTo(
      85_571_661.54,
      2
    );
  });
});

describe('computeHeadcount (implemented, not yet wired to a P0 canonical output line)', () => {
  it('hires minus attrition, salary grows monthly', () => {
    const result = computeHeadcount({ priorHeadcount: 100, hiresPerPeriod: 5, attritionRatePct: 0.02, priorAvgMonthlySalary: 10_000, avgSalaryGrowthRatePct: 0.003 });
    expect(result.closingHeadcount).toBeCloseTo(103, 6); // 100 + 5 - 100*0.02
    expect(result.avgMonthlySalary).toBeCloseTo(10_030, 6);
    expect(result.payrollCost).toBeCloseTo(103 * 10_030, 6);
  });
  it('never produces a negative headcount', () => {
    const result = computeHeadcount({ priorHeadcount: 5, hiresPerPeriod: 0, attritionRatePct: 5, priorAvgMonthlySalary: 1000, avgSalaryGrowthRatePct: 0 });
    expect(result.closingHeadcount).toBe(0);
  });
});

describe('computeLeases (implemented, not yet wired to a P0 canonical output line)', () => {
  it('escalates once per fiscal year, not compounded every month', () => {
    const jan = computeLeases({ priorLeaseLiability: 1_000_000, monthlyLeasePayment: 10_000, escalationRateAnnual: 0.02, monthIndexInYear: 0 });
    expect(jan.effectiveMonthlyPayment).toBeCloseTo(10_200, 6);
    const feb = computeLeases({ priorLeaseLiability: jan.closingLeaseLiability, monthlyLeasePayment: 10_000, escalationRateAnnual: 0.02, monthIndexInYear: 1 });
    expect(feb.effectiveMonthlyPayment).toBeCloseTo(10_000, 6);
  });
  it('liability never goes negative', () => {
    const result = computeLeases({ priorLeaseLiability: 5_000, monthlyLeasePayment: 10_000, escalationRateAnnual: 0, monthIndexInYear: 1 });
    expect(result.closingLeaseLiability).toBe(0);
  });
});
