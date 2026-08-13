/**
 * ideaFinance/engine — unit tests (Program E / epic E09).
 *
 * Every formula test is hand-computable (worked in comments) so the assertion
 * can be checked against the docstring math independently of the
 * implementation. Coverage:
 *   - gross/net annual benefit, incl. conflation guard (cash vs capacity-raw
 *     vs risk-avoidance vs qualitative all reported separately)
 *   - implementation cost (contingency) and recurring cost (escalation)
 *   - net cash flow / cumulative cash flow / payback (exact and interpolated)
 *   - simple ROI with named numerator/denominator
 *   - NPV with an explicit period convention
 *   - IRR: exact applicable case, all-same-sign not-applicable case, and
 *     multiple-sign-change not-applicable case
 *   - benefit-cost ratio
 *   - sensitivity (drivers moved individually, not the finished total)
 *   - scenario comparison where Base/Upside/Downside vary different named
 *     drivers, not copied totals
 *   - confidence-adjusted NPV as a separate, non-blended output
 *   - invalid/missing input paths: currency mismatch, capacity release
 *     without a realization assumption, qualitative benefit carrying an
 *     amount, unknown scenario driver override, zero-cost ROI/BCR
 */

import { describe, expect, it } from 'vitest';

import {
  __buildScheduleForTests,
  computeAnnualBenefit,
  computeBenefitCostRatio,
  computeConfidenceAdjustedNPV,
  computeCumulativeCashFlowAndPayback,
  computeImplementationCost,
  computeIRR,
  computeNetCashFlowPerPeriod,
  computeNPV,
  computeRecurringCost,
  computeScenarioComparison,
  computeSensitivity,
  computeSimpleROI,
  FORMULA_VERSION,
} from '../engine';
import type {
  BenefitInput,
  CurrencyInfo,
  IdeaFinancialCaseInput,
  InvestmentCostInput,
  RecurringCostInput,
} from '../types';

const PLN: CurrencyInfo = { code: 'PLN', scale: 'unit' };
const CONF_HIGH = { level: 'high' as const };
const CONF_LOW = { level: 'low' as const };

function baseInput(overrides: Partial<IdeaFinancialCaseInput> = {}): IdeaFinancialCaseInput {
  return {
    formulaVersion: FORMULA_VERSION,
    currency: PLN,
    periodConvention: { unit: 'month', periodsPerYear: 12, anchorDate: '2026-01-01' },
    discountRatePct: 0,
    baseline: [],
    investments: [],
    recurringCosts: [],
    benefits: [],
    timing: { startDate: '2026-01-01', implementationRampPeriods: 0, benefitRampPeriods: 0, usefulHorizonPeriods: 11 },
    scenarios: [{ name: 'base', driverOverrides: [] }],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Fixture A — 12 monthly periods (0..11), payback lands exactly on period 7.
//
//   investment  12000 @ p0
//   recurring     500 / period, p0..p11  -> 6000 total
//   revenue      2000 / period, p0..p11  -> 24000 total
//
// costTotal[0] = 12500, costTotal[1..11] = 500
// netCashFlow[0] = 2000 - 12500 = -10500
// netCashFlow[1..11] = 2000 - 500 = 1500
// cumulative: -10500, -9000, -7500, -6000, -4500, -3000, -1500, 0, 1500, ...
//   -> reaches exactly 0 at period 7
// total cash benefit = 24000, total cost = 12000 + 6000 = 18000
// ROI numerator = 24000 - 18000 = 6000, ROI = 6000/18000 = 1/3
// ---------------------------------------------------------------------------
function fixtureA(): IdeaFinancialCaseInput {
  const investment: InvestmentCostInput = {
    id: 'inv-1',
    label: 'Platform build',
    amount: 12000,
    currency: PLN,
    classification: 'capex',
    internalOrExternal: 'external',
    periodIndex: 0,
    confidence: CONF_HIGH,
  };
  const recurring: RecurringCostInput = {
    id: 'rc-1',
    label: 'Hosting',
    category: 'operations',
    amountPerPeriod: 500,
    currency: PLN,
    startPeriodIndex: 0,
    confidence: CONF_HIGH,
  };
  const revenue: BenefitInput = {
    id: 'ben-1',
    label: 'New revenue',
    type: 'revenue',
    amountPerPeriod: 2000,
    currency: PLN,
    startPeriodIndex: 0,
    confidence: CONF_HIGH,
  };
  return baseInput({ investments: [investment], recurringCosts: [recurring], benefits: [revenue] });
}

describe('ideaFinance/engine — net cash flow per period (fixture A)', () => {
  it('computes cash benefit, cost total and net cash flow exactly', () => {
    const result = computeNetCashFlowPerPeriod(fixtureA(), 'base');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.value.periods).toEqual(Array.from({ length: 12 }, (_, i) => i));
    expect(result.value.cashBenefit).toEqual(new Array(12).fill(2000));
    expect(result.value.costTotal[0]).toBe(12500);
    expect(result.value.costTotal.slice(1)).toEqual(new Array(11).fill(500));
    expect(result.value.netCashFlow[0]).toBe(-10500);
    expect(result.value.netCashFlow.slice(1)).toEqual(new Array(11).fill(1500));
    expect(result.meta.formulaVersion).toBe(FORMULA_VERSION);
    expect(result.meta.currency).toBe('PLN');
    expect(result.meta.periodUnit).toBe('month');
    expect(result.meta.periodsPerYear).toBe(12);
    expect(result.meta.scenario).toBe('base');
    expect(result.meta.inputs.sort()).toEqual(['ben-1', 'inv-1', 'rc-1']);
  });
});

describe('ideaFinance/engine — cumulative cash flow and payback (fixture A)', () => {
  it('finds the exact payback period when cumulative cash flow lands on zero', () => {
    const result = computeCumulativeCashFlowAndPayback(fixtureA(), 'base');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.value.cumulativeCashFlow).toEqual([
      -10500, -9000, -7500, -6000, -4500, -3000, -1500, 0, 1500, 3000, 4500, 6000,
    ]);
    expect(result.value.paybackPeriodIndex).toBe(7);
    expect(result.value.reason).toBeUndefined();
  });

  it('interpolates a fractional payback period when cash flow crosses zero mid-period', () => {
    // netCashFlow: [-1000, 400, 400, 400] -> cumulative -1000,-600,-200,200
    // crosses zero between p2 (-200) and p3 (200): fraction = 200/400 = 0.5
    // paybackPeriodIndex = 2 + 0.5 = 2.5
    const investment: InvestmentCostInput = {
      id: 'inv',
      label: 'inv',
      amount: 1000,
      currency: PLN,
      classification: 'capex',
      internalOrExternal: 'internal',
      periodIndex: 0,
      confidence: CONF_HIGH,
    };
    const revenue: BenefitInput = {
      id: 'ben',
      label: 'ben',
      type: 'revenue',
      amountPerPeriod: 400,
      currency: PLN,
      startPeriodIndex: 0,
      confidence: CONF_HIGH,
    };
    const input = baseInput({
      investments: [investment],
      benefits: [revenue],
      timing: { startDate: '2026-01-01', implementationRampPeriods: 0, benefitRampPeriods: 0, usefulHorizonPeriods: 3 },
    });
    const result = computeCumulativeCashFlowAndPayback(input, 'base');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.value.cumulativeCashFlow).toEqual([-600, -200, 200, 600]);
    expect(result.value.paybackPeriodIndex).toBeCloseTo(1.5, 10);
  });

  it('returns null payback with a reason when cash flow never recovers', () => {
    const investment: InvestmentCostInput = {
      id: 'inv',
      label: 'inv',
      amount: 100000,
      currency: PLN,
      classification: 'capex',
      internalOrExternal: 'internal',
      periodIndex: 0,
      confidence: CONF_HIGH,
    };
    const input = baseInput({ investments: [investment] });
    const result = computeCumulativeCashFlowAndPayback(input, 'base');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.value.paybackPeriodIndex).toBeNull();
    expect(result.value.reason).toMatch(/never reaches zero/);
  });
});

describe('ideaFinance/engine — simple ROI (fixture A)', () => {
  it('names numerator/denominator and computes 1/3', () => {
    const result = computeSimpleROI(fixtureA(), 'base');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.value.numeratorLabel).toBe('Net benefit (cash-basis benefit − total cost)');
    expect(result.value.denominatorLabel).toBe('Total cost (implementation + recurring)');
    expect(result.value.numerator).toBe(6000);
    expect(result.value.denominator).toBe(18000);
    expect(result.value.roi).toBeCloseTo(1 / 3, 10);
  });

  it('returns invalid (not NaN/Infinity) when total cost is zero', () => {
    const revenue: BenefitInput = {
      id: 'ben',
      label: 'ben',
      type: 'revenue',
      amountPerPeriod: 100,
      currency: PLN,
      startPeriodIndex: 0,
      confidence: CONF_HIGH,
    };
    const result = computeSimpleROI(baseInput({ benefits: [revenue] }), 'base');
    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') return;
    expect(result.reason).toMatch(/denominator.*zero/i);
  });
});

describe('ideaFinance/engine — implementation cost', () => {
  it('applies contingency percentage to the one-time investment', () => {
    // 12000 * (1 + 10%) = 13200
    const investment: InvestmentCostInput = {
      id: 'inv-1',
      label: 'Platform build',
      amount: 12000,
      currency: PLN,
      classification: 'capex',
      internalOrExternal: 'external',
      contingencyPct: 10,
      periodIndex: 0,
      confidence: CONF_HIGH,
    };
    const result = computeImplementationCost(baseInput({ investments: [investment] }), 'base');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.value.total).toBeCloseTo(13200, 10);
    expect(result.value.byDriver).toHaveLength(1);
    expect(result.value.byDriver[0].id).toBe('inv-1');
    expect(result.value.byDriver[0].label).toBe('Platform build');
    expect(result.value.byDriver[0].amount).toBeCloseTo(13200, 8);
  });
});

describe('ideaFinance/engine — recurring cost with annual escalation', () => {
  it('escalates 10%/year, compounding once per elapsed year', () => {
    // amountPerPeriod=100, periods 0..23 (24 months), escalation 10%/year
    // elapsedYears = floor((p-0)/12): periods 0-11 -> year 0 -> 100
    //                periods 12-23 -> year 1 -> 100*1.10 = 110
    // total = 100*12 + 110*12 = 1200 + 1320 = 2520
    const recurring: RecurringCostInput = {
      id: 'rc-1',
      label: 'License',
      category: 'license',
      amountPerPeriod: 100,
      currency: PLN,
      startPeriodIndex: 0,
      escalationPctPerYear: 10,
      confidence: CONF_HIGH,
    };
    const input = baseInput({
      recurringCosts: [recurring],
      timing: { startDate: '2026-01-01', implementationRampPeriods: 0, benefitRampPeriods: 0, usefulHorizonPeriods: 23 },
    });
    const result = computeRecurringCost(input, 'base');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.value.perPeriod.slice(0, 12)).toEqual(new Array(12).fill(100));
    result.value.perPeriod.slice(12).forEach((v) => expect(v).toBeCloseTo(110, 10));
    expect(result.value.total).toBeCloseTo(2520, 8);
  });
});

describe('ideaFinance/engine — gross/net annual benefit and conflation guard', () => {
  it('separates cash benefit, capacity-release raw vs realized, risk avoidance and qualitative count', () => {
    // 24 monthly periods (0..23); representative year = last full year = periods 12..23.
    // revenue: 1000/period all periods           -> year sum 12000
    // recurring cost: 200/period all periods      -> year sum 2400
    // capacity_release: raw 500/period, realizedFraction 0.4 -> realized 200/period
    //   -> byType.capacity_release (raw) year sum = 6000
    //   -> cashBenefit contribution (realized) year sum = 2400
    // risk_avoidance: 300/period                   -> year sum 3600 (kept OUT of cash basis)
    // qualitative: no amount, narrative only        -> qualitativeCount = 1
    //
    // grossCashBenefit = revenue(12000) + realized capacity(2400) = 14400
    // netCashBenefit = grossCashBenefit - recurringCostInYear(2400) = 12000
    const revenue: BenefitInput = {
      id: 'rev',
      label: 'Revenue',
      type: 'revenue',
      amountPerPeriod: 1000,
      currency: PLN,
      startPeriodIndex: 0,
      confidence: CONF_HIGH,
    };
    const capacity: BenefitInput = {
      id: 'cap',
      label: 'Freed analyst time',
      type: 'capacity_release',
      amountPerPeriod: 500,
      currency: PLN,
      startPeriodIndex: 0,
      capacityRealization: { realizedFraction: 0.4, rationale: 'historical redeployment rate' },
      confidence: CONF_HIGH,
    };
    const risk: BenefitInput = {
      id: 'risk',
      label: 'Avoided fine exposure',
      type: 'risk_avoidance',
      amountPerPeriod: 300,
      currency: PLN,
      startPeriodIndex: 0,
      confidence: CONF_HIGH,
    };
    const qualitative: BenefitInput = {
      id: 'qual',
      label: 'Brand trust',
      type: 'qualitative',
      startPeriodIndex: 0,
      qualitativeDescription: 'Improves client trust in delivery quality.',
      confidence: CONF_HIGH,
    };
    const recurring: RecurringCostInput = {
      id: 'rc',
      label: 'Ops',
      category: 'operations',
      amountPerPeriod: 200,
      currency: PLN,
      startPeriodIndex: 0,
      confidence: CONF_HIGH,
    };
    const input = baseInput({
      benefits: [revenue, capacity, risk, qualitative],
      recurringCosts: [recurring],
      timing: { startDate: '2026-01-01', implementationRampPeriods: 0, benefitRampPeriods: 0, usefulHorizonPeriods: 23 },
    });
    const result = computeAnnualBenefit(input, 'base');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.value.yearPeriodRange).toEqual([12, 23]);
    expect(result.value.byType.revenue).toBeCloseTo(12000, 8);
    expect(result.value.byType.capacity_release).toBeCloseTo(6000, 8); // raw, not realized
    expect(result.value.byType.risk_avoidance).toBeCloseTo(3600, 8);
    expect(result.value.grossCashBenefit).toBeCloseTo(14400, 8); // 12000 + realized 2400, NOT +6000 raw
    expect(result.value.netCashBenefit).toBeCloseTo(12000, 8);
    expect(result.value.riskAvoidanceValue).toBeCloseTo(3600, 8);
    expect(result.value.qualitativeCount).toBe(1);
  });

  it('is invalid when the horizon is shorter than one full year', () => {
    const input = baseInput({
      timing: { startDate: '2026-01-01', implementationRampPeriods: 0, benefitRampPeriods: 0, usefulHorizonPeriods: 5 },
    });
    const result = computeAnnualBenefit(input, 'base');
    expect(result.status).toBe('invalid');
  });
});

// ---------------------------------------------------------------------------
// Fixture B — 2 annual periods, for hand-computable NPV/IRR/BCR.
//   investment 1000 @ p0
//   revenue     600 @ p1 and p2 (periodsPerYear = 1, so periodRate = discount rate)
//   discount rate 10%
//
//   netCashFlow = [-1000, 600, 600]
//   NPV = -1000 + 600/1.1 + 600/1.1^2
//       = -1000 + 545.454545... + 495.867769... = 41.322314...
//   PV(benefits) = 545.454545... + 495.867769... = 1041.322314...
//   PV(costs)    = 1000 (undiscounted, lands at p0)
//   BCR = 1041.322314... / 1000 = 1.041322314...
// ---------------------------------------------------------------------------
function fixtureB(): IdeaFinancialCaseInput {
  const investment: InvestmentCostInput = {
    id: 'inv',
    label: 'Investment',
    amount: 1000,
    currency: PLN,
    classification: 'capex',
    internalOrExternal: 'external',
    periodIndex: 0,
    confidence: CONF_HIGH,
  };
  const revenue: BenefitInput = {
    id: 'ben',
    label: 'Revenue',
    type: 'revenue',
    amountPerPeriod: 600,
    currency: PLN,
    startPeriodIndex: 1,
    endPeriodIndex: 2,
    confidence: CONF_HIGH,
  };
  return baseInput({
    investments: [investment],
    benefits: [revenue],
    discountRatePct: 10,
    periodConvention: { unit: 'year', periodsPerYear: 1, anchorDate: '2026-01-01' },
    timing: { startDate: '2026-01-01', implementationRampPeriods: 0, benefitRampPeriods: 0, usefulHorizonPeriods: 2 },
  });
}

const EXPECTED_NPV_B = -1000 + 600 / 1.1 + 600 / 1.21;
const EXPECTED_PV_BENEFITS_B = 600 / 1.1 + 600 / 1.21;

describe('ideaFinance/engine — NPV (fixture B)', () => {
  it('discounts each period at the annual rate under a periodsPerYear=1 convention', () => {
    const result = computeNPV(fixtureB(), 'base');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.value.npv).toBeCloseTo(EXPECTED_NPV_B, 6);
    expect(result.value.discountRatePct).toBe(10);
    expect(result.value.periodRatePct).toBeCloseTo(10, 10); // periodsPerYear=1 => periodRate === annual rate
    expect(result.value.periodConvention).toBe('year');
  });

  it('compounds a monthly period rate from the annual rate (periodsPerYear > 1)', () => {
    // periodRate = (1 + 12%)^(1/12) - 1, compounded 12x should reproduce 12%.
    const input = baseInput({ discountRatePct: 12 });
    const result = computeNPV(input, 'base');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const compoundedAnnual = Math.pow(1 + result.value.periodRatePct / 100, 12) - 1;
    expect(compoundedAnnual).toBeCloseTo(0.12, 8);
  });
});

describe('ideaFinance/engine — benefit-cost ratio (fixture B)', () => {
  it('computes PV(benefits)/PV(costs)', () => {
    const result = computeBenefitCostRatio(fixtureB(), 'base');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.value.presentValueBenefits).toBeCloseTo(EXPECTED_PV_BENEFITS_B, 6);
    expect(result.value.presentValueCosts).toBeCloseTo(1000, 6);
    expect(result.value.bcr).toBeCloseTo(EXPECTED_PV_BENEFITS_B / 1000, 6);
  });

  it('is invalid when present value of costs is zero', () => {
    const revenue: BenefitInput = {
      id: 'ben',
      label: 'ben',
      type: 'revenue',
      amountPerPeriod: 100,
      currency: PLN,
      startPeriodIndex: 0,
      confidence: CONF_HIGH,
    };
    const result = computeBenefitCostRatio(baseInput({ benefits: [revenue] }), 'base');
    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') return;
    expect(result.reason).toMatch(/present value of costs is zero/);
  });
});

describe('ideaFinance/engine — IRR', () => {
  it('is exactly 10% for the classic [-100, 110] one-period case', () => {
    // -100 + 110/(1+r) = 0  =>  r = 10/100 = 0.10 exactly
    const investment: InvestmentCostInput = {
      id: 'inv',
      label: 'inv',
      amount: 100,
      currency: PLN,
      classification: 'capex',
      internalOrExternal: 'internal',
      periodIndex: 0,
      confidence: CONF_HIGH,
    };
    const revenue: BenefitInput = {
      id: 'ben',
      label: 'ben',
      type: 'revenue',
      amountPerPeriod: 110,
      currency: PLN,
      startPeriodIndex: 1,
      endPeriodIndex: 1,
      confidence: CONF_HIGH,
    };
    const input = baseInput({
      investments: [investment],
      benefits: [revenue],
      periodConvention: { unit: 'year', periodsPerYear: 1, anchorDate: '2026-01-01' },
      timing: { startDate: '2026-01-01', implementationRampPeriods: 0, benefitRampPeriods: 0, usefulHorizonPeriods: 1 },
    });
    const result = computeIRR(input, 'base');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.value.applicable).toBe(true);
    if (!result.value.applicable) return;
    expect(result.value.irrPct).toBeCloseTo(10, 4);
  });

  it('is not applicable when cash flow never changes sign (all outflow)', () => {
    const investment: InvestmentCostInput = {
      id: 'inv',
      label: 'inv',
      amount: 100,
      currency: PLN,
      classification: 'capex',
      internalOrExternal: 'internal',
      periodIndex: 0,
      confidence: CONF_HIGH,
    };
    const input = baseInput({
      investments: [investment],
      timing: { startDate: '2026-01-01', implementationRampPeriods: 0, benefitRampPeriods: 0, usefulHorizonPeriods: 0 },
    });
    const result = computeIRR(input, 'base');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.value.applicable).toBe(false);
    if (result.value.applicable) return;
    expect(result.value.reason).toMatch(/never changes sign/);
  });

  it('is not applicable when cash flow changes sign more than once (no guaranteed unique root)', () => {
    // netCashFlow: [-100, +300, -250, +300] -> signs -,+,-,+ => 3 changes
    const investment1: InvestmentCostInput = {
      id: 'inv-1',
      label: 'inv-1',
      amount: 100,
      currency: PLN,
      classification: 'capex',
      internalOrExternal: 'internal',
      periodIndex: 0,
      confidence: CONF_HIGH,
    };
    const investment2: InvestmentCostInput = {
      id: 'inv-2',
      label: 'inv-2 (later outlay)',
      amount: 250,
      currency: PLN,
      classification: 'capex',
      internalOrExternal: 'internal',
      periodIndex: 2,
      confidence: CONF_HIGH,
    };
    const benefit1: BenefitInput = {
      id: 'ben-1',
      label: 'ben-1',
      type: 'revenue',
      amountPerPeriod: 300,
      currency: PLN,
      startPeriodIndex: 1,
      endPeriodIndex: 1,
      confidence: CONF_HIGH,
    };
    const benefit2: BenefitInput = {
      id: 'ben-2',
      label: 'ben-2',
      type: 'revenue',
      amountPerPeriod: 300,
      currency: PLN,
      startPeriodIndex: 3,
      endPeriodIndex: 3,
      confidence: CONF_HIGH,
    };
    const input = baseInput({
      investments: [investment1, investment2],
      benefits: [benefit1, benefit2],
      periodConvention: { unit: 'year', periodsPerYear: 1, anchorDate: '2026-01-01' },
      timing: { startDate: '2026-01-01', implementationRampPeriods: 0, benefitRampPeriods: 0, usefulHorizonPeriods: 3 },
    });
    const netCashFlow = (__buildScheduleForTests(input, 'base') as { ok: true; schedule: { netCashFlow: number[] } })
      .schedule.netCashFlow;
    expect(netCashFlow).toEqual([-100, 300, -250, 300]);

    const result = computeIRR(input, 'base');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.value.applicable).toBe(false);
    if (result.value.applicable) return;
    expect(result.value.reason).toMatch(/changes sign 3 times/);
  });
});

describe('ideaFinance/engine — sensitivity (fixture B, driver moved individually)', () => {
  it('moves only the named driver, leaving other drivers and the base case untouched', () => {
    // Bumping the revenue driver +/-10% must reproduce recomputing NPV with
    // amountPerPeriod scaled by the same factor (not scaling the whole
    // finished NPV total).
    // +10%: 660/1.1 + 660/1.21 = 600 + 545.454545... = 1145.454545...; NPV = 145.454545...
    // -10%: 540/1.1 + 540/1.21 = 490.909091 + 446.280992 = 937.190083...; NPV = -62.809917...
    const result = computeSensitivity(fixtureB(), 'base', [
      { driverId: 'ben', label: 'Revenue', kind: 'benefit', deltasPct: [-10, 10] },
    ]);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.value.baseNpv).toBeCloseTo(EXPECTED_NPV_B, 6);
    const plus10 = result.value.points.find((p) => p.deltaPct === 10);
    const minus10 = result.value.points.find((p) => p.deltaPct === -10);
    expect(plus10?.npv).toBeCloseTo(660 / 1.1 + 660 / 1.21 - 1000, 6);
    expect(minus10?.npv).toBeCloseTo(540 / 1.1 + 540 / 1.21 - 1000, 6);
    expect(plus10?.deltaNpv).toBeCloseTo((plus10?.npv ?? NaN) - EXPECTED_NPV_B, 6);
  });
});

describe('ideaFinance/engine — scenario comparison (drivers differ, not copied totals)', () => {
  it('Upside/Downside multiply distinct named drivers, so totals diverge for different reasons', () => {
    // base:    investment 1000, revenue 600/600         -> NPV as fixture B
    // upside:  revenue driver x1.2 (benefit optimism), investment unchanged
    // downside: investment driver x1.15 (cost overrun), revenue unchanged
    const input: IdeaFinancialCaseInput = {
      ...fixtureB(),
      scenarios: [
        { name: 'base', driverOverrides: [] },
        { name: 'upside', driverOverrides: [{ driverId: 'ben', multiplier: 1.2 }] },
        { name: 'downside', driverOverrides: [{ driverId: 'inv', multiplier: 1.15 }] },
      ],
    };
    const rows = computeScenarioComparison(input);
    expect(rows).toHaveLength(3);
    const base = rows.find((r) => r.scenario === 'base')!;
    const upside = rows.find((r) => r.scenario === 'upside')!;
    const downside = rows.find((r) => r.scenario === 'downside')!;

    expect(base.npv.status).toBe('ok');
    expect(upside.npv.status).toBe('ok');
    expect(downside.npv.status).toBe('ok');
    if (base.npv.status !== 'ok' || upside.npv.status !== 'ok' || downside.npv.status !== 'ok') return;

    // Upside raises NPV via the benefit driver only.
    const expectedUpsideNpv = -1000 + (600 * 1.2) / 1.1 + (600 * 1.2) / 1.21;
    expect(upside.npv.value.npv).toBeCloseTo(expectedUpsideNpv, 6);
    expect(upside.npv.value.npv).toBeGreaterThan(base.npv.value.npv);

    // Downside lowers NPV via the investment driver only — benefits unchanged.
    const expectedDownsideNpv = -1000 * 1.15 + 600 / 1.1 + 600 / 1.21;
    expect(downside.npv.value.npv).toBeCloseTo(expectedDownsideNpv, 6);
    expect(downside.npv.value.npv).toBeLessThan(base.npv.value.npv);

    // The two scenarios move different drivers — confirm they are not the
    // same delta applied to the finished total (i.e. genuinely different
    // shapes, not a copied/scaled total).
    const upsideDelta = upside.npv.value.npv - base.npv.value.npv;
    const downsideDelta = downside.npv.value.npv - base.npv.value.npv;
    expect(upside.driverOverrides).toEqual([{ driverId: 'ben', multiplier: 1.2 }]);
    expect(downside.driverOverrides).toEqual([{ driverId: 'inv', multiplier: 1.15 }]);
    expect(upsideDelta).not.toBeCloseTo(-downsideDelta, 2); // asymmetric, driver-specific deltas
  });
});

describe('ideaFinance/engine — confidence-adjusted value (separate output)', () => {
  it('halves a low-confidence benefit driver under default weights, without mutating the headline NPV', () => {
    // discount rate 0%, investment 100 @ p0, benefit 200 @ p1 (low confidence)
    // unadjustedNpv = -100 + 200 = 100
    // default weight for 'low' = 0.5 -> adjusted benefit = 100 @ p1
    // confidenceAdjustedNpv = -100 + 100 = 0
    const investment: InvestmentCostInput = {
      id: 'inv',
      label: 'inv',
      amount: 100,
      currency: PLN,
      classification: 'capex',
      internalOrExternal: 'internal',
      periodIndex: 0,
      confidence: CONF_HIGH,
    };
    const benefit: BenefitInput = {
      id: 'ben',
      label: 'ben',
      type: 'revenue',
      amountPerPeriod: 200,
      currency: PLN,
      startPeriodIndex: 1,
      endPeriodIndex: 1,
      confidence: CONF_LOW,
    };
    const input = baseInput({
      investments: [investment],
      benefits: [benefit],
      discountRatePct: 0,
      periodConvention: { unit: 'year', periodsPerYear: 1, anchorDate: '2026-01-01' },
      timing: { startDate: '2026-01-01', implementationRampPeriods: 0, benefitRampPeriods: 0, usefulHorizonPeriods: 1 },
    });

    const npvResult = computeNPV(input, 'base');
    const confResult = computeConfidenceAdjustedNPV(input, 'base');
    expect(npvResult.status).toBe('ok');
    expect(confResult.status).toBe('ok');
    if (npvResult.status !== 'ok' || confResult.status !== 'ok') return;

    expect(npvResult.value.npv).toBeCloseTo(100, 8);
    expect(confResult.value.unadjustedNpv).toBeCloseTo(100, 8);
    expect(confResult.value.confidenceAdjustedNpv).toBeCloseTo(0, 8);
    expect(confResult.value.label).toMatch(/separate from headline NPV/);
    expect(confResult.value.perDriverWeight).toEqual([{ driverId: 'ben', level: 'low', weight: 0.5 }]);
    // Headline NPV is untouched by the confidence adjustment (never silently blended).
    expect(npvResult.value.npv).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Invalid / missing input paths
// ---------------------------------------------------------------------------

describe('ideaFinance/engine — invalid/missing input paths', () => {
  it('rejects a benefit currency that differs from the case currency with no fx conversion', () => {
    const benefit: BenefitInput = {
      id: 'ben',
      label: 'ben',
      type: 'revenue',
      amountPerPeriod: 100,
      currency: { code: 'EUR', scale: 'unit' },
      startPeriodIndex: 0,
      confidence: CONF_HIGH,
    };
    const result = computeNetCashFlowPerPeriod(baseInput({ benefits: [benefit] }), 'base');
    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') return;
    expect(result.reason).toMatch(/currency mismatch/);
    expect(result.reason).toMatch(/EUR/);
    expect(result.reason).toMatch(/PLN/);
  });

  it('accepts a currency mismatch when an explicit sourced fx rate is provided', () => {
    const benefit: BenefitInput = {
      id: 'ben',
      label: 'ben',
      type: 'revenue',
      amountPerPeriod: 100,
      currency: { code: 'EUR', scale: 'unit', fx: { toCaseCurrency: 4.3, source: 'NBP', date: '2026-08-01' } },
      startPeriodIndex: 0,
      endPeriodIndex: 0,
      confidence: CONF_HIGH,
    };
    const result = computeNetCashFlowPerPeriod(baseInput({ benefits: [benefit] }), 'base');
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.value.cashBenefit[0]).toBeCloseTo(430, 8);
  });

  it('is missing (not silently invalid) when a capacity_release benefit lacks a realization assumption', () => {
    const benefit: BenefitInput = {
      id: 'ben',
      label: 'ben',
      type: 'capacity_release',
      amountPerPeriod: 100,
      currency: PLN,
      startPeriodIndex: 0,
      confidence: CONF_HIGH,
    };
    const result = computeNetCashFlowPerPeriod(baseInput({ benefits: [benefit] }), 'base');
    expect(result.status).toBe('missing');
    if (result.status !== 'missing') return;
    expect(result.reason).toMatch(/realization assumption/);
  });

  it('rejects a capacity_release realizedFraction outside [0, 1]', () => {
    const benefit: BenefitInput = {
      id: 'ben',
      label: 'ben',
      type: 'capacity_release',
      amountPerPeriod: 100,
      currency: PLN,
      startPeriodIndex: 0,
      capacityRealization: { realizedFraction: 1.5, rationale: 'bad input' },
      confidence: CONF_HIGH,
    };
    const result = computeNetCashFlowPerPeriod(baseInput({ benefits: [benefit] }), 'base');
    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') return;
    expect(result.reason).toMatch(/realizedFraction/);
  });

  it('rejects a qualitative benefit that carries a numeric amountPerPeriod', () => {
    const benefit: BenefitInput = {
      id: 'ben',
      label: 'ben',
      type: 'qualitative',
      amountPerPeriod: 50,
      startPeriodIndex: 0,
      qualitativeDescription: 'should not have an amount',
      confidence: CONF_HIGH,
    };
    const result = computeNetCashFlowPerPeriod(baseInput({ benefits: [benefit] }), 'base');
    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') return;
    expect(result.reason).toMatch(/must not carry amountPerPeriod/);
  });

  it('rejects a scenario driver override referencing an unknown driver id', () => {
    const input = baseInput({
      scenarios: [
        { name: 'base', driverOverrides: [] },
        { name: 'upside', driverOverrides: [{ driverId: 'does-not-exist', multiplier: 1.1 }] },
      ],
    });
    const result = computeNetCashFlowPerPeriod(input, 'upside');
    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') return;
    expect(result.reason).toMatch(/unknown driver id/);
  });

  it('is missing when scenarios[] does not include a "base" scenario', () => {
    const input = baseInput({ scenarios: [{ name: 'upside', driverOverrides: [] }] });
    const result = computeNetCashFlowPerPeriod(input, 'upside');
    expect(result.status).toBe('missing');
    if (result.status !== 'missing') return;
    expect(result.reason).toMatch(/must include a scenario named "base"/);
  });

  it('rejects an unknown scenario name', () => {
    const result = computeNetCashFlowPerPeriod(fixtureA(), 'does-not-exist');
    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') return;
    expect(result.reason).toMatch(/unknown scenario/);
  });

  it('rejects periodConvention.periodsPerYear that does not match the unit', () => {
    const input = baseInput({ periodConvention: { unit: 'month', periodsPerYear: 4, anchorDate: '2026-01-01' } });
    const result = computeNetCashFlowPerPeriod(input, 'base');
    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') return;
    expect(result.reason).toMatch(/does not match unit/);
  });

  it('is missing when discountRatePct is not a finite number', () => {
    const input = baseInput({ discountRatePct: NaN });
    const result = computeNetCashFlowPerPeriod(input, 'base');
    expect(result.status).toBe('missing');
    if (result.status !== 'missing') return;
    expect(result.reason).toMatch(/discountRatePct/);
  });

  it('rejects an investment periodIndex outside the modeled horizon', () => {
    const investment: InvestmentCostInput = {
      id: 'inv',
      label: 'inv',
      amount: 100,
      currency: PLN,
      classification: 'capex',
      internalOrExternal: 'internal',
      periodIndex: 99,
      confidence: CONF_HIGH,
    };
    const result = computeNetCashFlowPerPeriod(baseInput({ investments: [investment] }), 'base');
    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') return;
    expect(result.reason).toMatch(/outside the horizon/);
  });

  it('propagates the missing/invalid distinction through computeConfidenceAdjustedNPV', () => {
    const input = baseInput({ discountRatePct: NaN });
    const result = computeConfidenceAdjustedNPV(input, 'base');
    expect(result.status).toBe('missing');
  });
});
