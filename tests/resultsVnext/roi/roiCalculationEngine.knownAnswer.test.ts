/**
 * ROI-E002 — pure calculation engine known-answer tests (AC-05, §9).
 *
 * Design: docs/product/results-vnext/ROI_E002_DESIGN.md §9. Pure, no DB —
 * every expectation below is hand-computed from the textbook formula (shown
 * in each test's own comment), same style as
 * `tests/unit/finance/investmentAppraisalService.test.ts`. This is the most
 * important test file in the ROI-E002 package — financial correctness here
 * is a real product risk, not a style preference.
 */
import { describe, expect, it, vi } from 'vitest';

import * as investmentAppraisalService from '../../../server/src/services/investmentAppraisalService.js';
import { runRoiCalculationEngine } from '../../../server/src/services/resultsVnext/roi/engine/roiCalculationEngine.js';
import type {
  RoiCalculationEngineInput,
  RoiEngineAssumption,
  RoiEngineBenefitLine,
  RoiEngineCostLine,
} from '../../../server/src/services/resultsVnext/roi/engine/roiCalculationEngine.types.js';

function baseInput(overrides: Partial<RoiCalculationEngineInput> = {}): RoiCalculationEngineInput {
  return {
    currency: 'USD',
    granularity: 'monthly',
    analysisStart: '2026-01-01',
    analysisEnd: '2026-12-31',
    discountRatePct: null,
    roundingPolicy: 'none',
    requiredMetrics: null,
    assumptions: [],
    costLines: [],
    benefitLines: [],
    scenarioType: null,
    scenarioOverrides: [],
    ...overrides,
  };
}

function costLine(overrides: Partial<RoiEngineCostLine> & { id: string; amount: number }): RoiEngineCostLine {
  return {
    currency: 'USD',
    timingType: 'one_time',
    oneTimePeriodDate: null,
    recurrenceStartDate: null,
    recurrenceEndDate: null,
    recurrenceCadence: null,
    ...overrides,
  };
}

function benefitLine(overrides: Partial<RoiEngineBenefitLine> & { id: string }): RoiEngineBenefitLine {
  return {
    isFinancial: true,
    amount: null,
    currency: 'USD',
    timingType: 'one_time',
    oneTimePeriodDate: null,
    recurrenceStartDate: null,
    recurrenceEndDate: null,
    recurrenceCadence: null,
    rampPeriods: null,
    doubleCountingGroup: null,
    doubleCountingResolutionNote: null,
    ...overrides,
  };
}

describe('roiCalculationEngine — known-answer tests (§9)', () => {
  // ==========================================================
  // KA-1 (required by AC-05): $100,000 one-time cost at period 0,
  // $8,000/month benefit for periods 1-24, discountRatePct=12 (annual),
  // granularity='monthly'.
  //
  // Decision D13: periodRate = (1.12)^(1/12) - 1.
  //   ln(1.12) = 0.11332868530700041
  //   periodRate = exp(0.11332868530700041 / 12) - 1 = 0.009488792934583046
  //   (≈ 0.94888% monthly)
  //
  // Hand-computed NPV = -100000 + Σ_{t=1}^{24} 8000/(1.009488792934583046)^t
  //   t=1..24 partial sums (computed independently below, NOT via the
  //   engine or investmentAppraisalService — a plain loop over the closed
  //   formula):
  //     Σ_{t=1}^{24} 8000/(1+r)^t = 170985.81355681579   (r = periodRate above)
  //   NPV = 170985.81355681579 - 100000 = 70985.81355681579
  //
  // Hand-computed undiscounted payback: cumulative 8000/month —
  //   after 12 periods: 96000 (< 100000)
  //   after 13 periods: 104000 (>= 100000)
  //   shortfall at period 13 = 100000 - 96000 = 4000; fraction = 4000/8000 = 0.5
  //   payback = 12 + 0.5 = 12.5 periods
  // ==========================================================
  it('KA-1: known-answer NPV and payback at 12% annual discount, monthly granularity', () => {
    // Independent hand computation (plain loop, no Decimal, no engine
    // import) — the arithmetic this test's expectation is checked against.
    const periodRate = Math.pow(1 + 12 / 100, 1 / 12) - 1;
    let handComputedPvOfBenefits = 0;
    for (let t = 1; t <= 24; t++) {
      handComputedPvOfBenefits += 8000 / Math.pow(1 + periodRate, t);
    }
    const handComputedNpv = handComputedPvOfBenefits - 100000;
    expect(handComputedNpv).toBeCloseTo(70985.8136, 3); // sanity on the hand computation itself

    const result = runRoiCalculationEngine(
      baseInput({
        analysisStart: '2026-01-01',
        analysisEnd: '2028-01-31', // period 24
        discountRatePct: 12,
        costLines: [costLine({ id: 'cost-1', amount: 100000, timingType: 'one_time', oneTimePeriodDate: '2026-01-01' })],
        benefitLines: [
          benefitLine({
            id: 'benefit-1',
            amount: 8000,
            timingType: 'recurring',
            recurrenceStartDate: '2026-02-01', // period 1
            recurrenceEndDate: '2028-01-01', // period 24
            recurrenceCadence: 'monthly',
          }),
        ],
      })
    );

    expect(result.status).toBe('completed');
    expect(result.npv).toBeCloseTo(handComputedNpv, 4);
    expect(result.npv).toBeCloseTo(70985.8136, 3);
    expect(result.paybackPeriods).toBeCloseTo(12.5, 6);
    expect(result.totalCosts).toBe(100000);
    expect(result.totalFinancialBenefits).toBe(192000); // 8000 * 24
  });

  // ==========================================================
  // KA-2: recurring cost + ramped benefit. Ramp formula (this engine's own
  // documented choice, roiCalculationEngine.ts's addLineContributions):
  //   factor(occurrenceIndex) = min(occurrenceIndex, rampPeriods) / rampPeriods
  // rampPeriods=4, full amount=$1000/month, 6 monthly occurrences (periods
  // 1-6) => hand-computed per-period benefit:
  //   period1: 1000*(1/4)=250   period2: 1000*(2/4)=500
  //   period3: 1000*(3/4)=750   period4: 1000*(4/4)=1000
  //   period5: 1000 (capped)    period6: 1000 (capped)
  //   total = 250+500+750+1000+1000+1000 = 4500
  // Recurring cost $500/month, same 6 periods (no ramp — cost lines never
  // ramp): total = 500*6 = 3000.
  // ==========================================================
  it('KA-2: ramp linearly scales benefit from 0 toward full amount over rampPeriods', () => {
    const result = runRoiCalculationEngine(
      baseInput({
        analysisStart: '2026-01-01',
        analysisEnd: '2026-07-31', // period 6
        costLines: [
          costLine({
            id: 'cost-1',
            amount: 500,
            timingType: 'recurring',
            recurrenceStartDate: '2026-02-01',
            recurrenceEndDate: '2026-07-01',
            recurrenceCadence: 'monthly',
          }),
        ],
        benefitLines: [
          benefitLine({
            id: 'benefit-1',
            amount: 1000,
            timingType: 'recurring',
            recurrenceStartDate: '2026-02-01',
            recurrenceEndDate: '2026-07-01',
            recurrenceCadence: 'monthly',
            rampPeriods: 4,
          }),
        ],
      })
    );

    expect(result.status).toBe('completed');
    const benefitsByPeriod = result.periodSeries.map((p) => p.financialBenefitsTotal);
    expect(benefitsByPeriod).toEqual([0, 250, 500, 750, 1000, 1000, 1000]);
    const costsByPeriod = result.periodSeries.map((p) => p.costsTotal);
    expect(costsByPeriod).toEqual([0, 500, 500, 500, 500, 500, 500]);
    expect(result.totalFinancialBenefits).toBe(4500);
    expect(result.totalCosts).toBe(3000);
  });

  // ==========================================================
  // KA-3: downside/base/upside — same lines, three engine calls differing
  // only in scenarioType. Uses this engine's documented "mirror" rule
  // (roiCalculationEngine.ts's header comment / §9 simplification note): a
  // benefit line whose amount EXACTLY equals an assumption's baseValue is
  // substituted with that assumption's downside/upside value.
  //   assumption A1: baseValue=8000, downsideValue=6000, upsideValue=10000
  //   benefit line mirrors A1 (amount=8000), recurring 12 months
  //   cost line = $50,000 one-time (does not mirror any assumption)
  //   discountRatePct=null (0% — undiscounted sum for a clean hand check)
  //
  // Hand-computed NPV per scenario (0% discount => NPV = totalBenefits - totalCosts):
  //   base:     8000*12 - 50000 = 96000 - 50000 = 46000
  //   downside: 6000*12 - 50000 = 72000 - 50000 = 22000
  //   upside:  10000*12 - 50000 = 120000 - 50000 = 70000
  //   Monotonic: downside(22000) < base(46000) < upside(70000)
  // ==========================================================
  it('KA-3: downside < base < upside, monotonic NPV via the assumption-mirror rule', () => {
    const assumptions: RoiEngineAssumption[] = [
      { id: 'assumption-1', category: 'adoption', label: 'Adoption rate', baseValue: 8000, downsideValue: 6000, upsideValue: 10000 },
    ];
    const costLines = [costLine({ id: 'cost-1', amount: 50000, timingType: 'one_time', oneTimePeriodDate: '2026-01-01' })];
    const benefitLines = [
      benefitLine({
        id: 'benefit-1',
        amount: 8000,
        timingType: 'recurring',
        recurrenceStartDate: '2026-02-01',
        recurrenceEndDate: '2027-01-01',
        recurrenceCadence: 'monthly',
      }),
    ];
    const commonInput = {
      analysisStart: '2026-01-01',
      analysisEnd: '2027-01-31', // period 12
      assumptions,
      costLines,
      benefitLines,
    };

    const base = runRoiCalculationEngine(baseInput({ ...commonInput, scenarioType: null }));
    const downside = runRoiCalculationEngine(baseInput({ ...commonInput, scenarioType: 'downside' }));
    const upside = runRoiCalculationEngine(baseInput({ ...commonInput, scenarioType: 'upside' }));

    expect(base.npv).toBe(46000);
    expect(downside.npv).toBe(22000);
    expect(upside.npv).toBe(70000);
    expect(downside.npv).toBeLessThan(base.npv as number);
    expect(base.npv).toBeLessThan(upside.npv as number);

    // Only the mirrored line's own amount changed — totalCosts (the
    // non-mirrored cost line) is identical across all three scenarios.
    expect(base.totalCosts).toBe(50000);
    expect(downside.totalCosts).toBe(50000);
    expect(upside.totalCosts).toBe(50000);
  });

  // ==========================================================
  // KA-4: delayed start + fractional (non-integer) payback period.
  //   initialInvestment = $50,000 one-time (period 0)
  //   benefit = $12,000/month starting period 3 (periods 1-2 are $0),
  //     10 occurrences (periods 3-12)
  // Hand-computed undiscounted cumulative (cashflows[] = periods 1..N):
  //   [0, 0, 12000, 12000, 12000, 12000, 12000, 12000, 12000, 12000]
  //   cumulative after i=5 (6 cashflow entries, periods 1-6): 48000 (< 50000)
  //   cumulative after i=6 (periods 1-7): 60000 (>= 50000)
  //   shortfall = 50000 - 48000 = 2000; fraction = 2000/12000 = 0.16666...
  //   payback = 6 + 0.16666... = 6.16666...
  // ==========================================================
  it('KA-4: delayed benefit start produces a non-integer payback period', () => {
    const real = runRoiCalculationEngine(
      baseInput({
        analysisStart: '2026-01-01',
        analysisEnd: '2027-01-31', // period 12
        costLines: [costLine({ id: 'cost-1', amount: 50000, timingType: 'one_time', oneTimePeriodDate: '2026-01-01' })],
        benefitLines: [
          benefitLine({
            id: 'benefit-1',
            amount: 12000,
            timingType: 'recurring',
            recurrenceStartDate: '2026-04-01', // period 3
            recurrenceEndDate: '2027-01-01', // period 12
            recurrenceCadence: 'monthly',
          }),
        ],
      })
    );

    expect(real.status).toBe('completed');
    expect(real.paybackPeriods).toBeCloseTo(6 + 1 / 6, 6);
    expect(real.paybackPeriods).not.toBeNull();
    expect(Number.isInteger(real.paybackPeriods)).toBe(false);
  });

  // ==========================================================
  // KA-5: negative-ROI case — investment never recovered. paybackPeriods
  // must stay `null` (JSON-safe), never `Infinity` and never a fabricated
  // large number.
  //   cost = $100,000 one-time; benefit = $1,000/month for 12 periods
  //   (total undiscounted benefit = 12,000, far short of the $100,000 outlay)
  // ==========================================================
  it('KA-5: paybackPeriods is null (never Infinity) when the investment is never recovered', () => {
    const result = runRoiCalculationEngine(
      baseInput({
        analysisStart: '2026-01-01',
        analysisEnd: '2027-01-31', // period 12
        costLines: [costLine({ id: 'cost-1', amount: 100000, timingType: 'one_time', oneTimePeriodDate: '2026-01-01' })],
        benefitLines: [
          benefitLine({
            id: 'benefit-1',
            amount: 1000,
            timingType: 'recurring',
            recurrenceStartDate: '2026-02-01',
            recurrenceEndDate: '2027-01-01',
            recurrenceCadence: 'monthly',
          }),
        ],
      })
    );

    expect(result.status).toBe('completed');
    expect(result.paybackPeriods).toBeNull();
    expect(result.discountedPaybackPeriods).toBeNull();
    expect(result.totalFinancialBenefits).toBe(12000);
    expect(result.npv).toBe(12000 - 100000);
  });

  // ==========================================================
  // KA-6: non-financial-only benefit line — excluded from the financial
  // sum entirely (never a fabricated $0 contribution counted as if it were
  // a real financial line). simpleRoi/npv computed from the financial
  // benefit line and cost line only.
  //   cost = $10,000 one-time; financial benefit = $3,000 one-time;
  //   non-financial benefit (isFinancial=false, amount=null) contributes
  //   nothing to totals.
  // Hand-computed (0% discount): npv = 3000 - 10000 = -7000
  // ==========================================================
  it('KA-6: a non-financial benefit line is excluded from the financial totals, not a fabricated $0', () => {
    const result = runRoiCalculationEngine(
      baseInput({
        costLines: [costLine({ id: 'cost-1', amount: 10000, timingType: 'one_time', oneTimePeriodDate: '2026-01-01' })],
        benefitLines: [
          benefitLine({ id: 'benefit-financial', amount: 3000, timingType: 'one_time', oneTimePeriodDate: '2026-02-01' }),
          benefitLine({
            id: 'benefit-nonfinancial',
            isFinancial: false,
            amount: null,
            currency: null,
            timingType: 'one_time',
            oneTimePeriodDate: '2026-02-01',
          }),
        ],
      })
    );

    expect(result.status).toBe('completed');
    expect(result.totalFinancialBenefits).toBe(3000);
    expect(result.totalCosts).toBe(10000);
    expect(result.npv).toBe(3000 - 10000);
    expect(result.simpleRoi).toBeCloseTo((3000 - 10000) / 10000, 10);
  });

  // ==========================================================
  // KA-7: missing input vs. true zero. A FINANCIAL benefit line with
  // amount=null must be EXCLUDED from the sum (with a validation finding),
  // never silently treated as $0 in a way that could corrupt the total
  // (e.g. NaN propagation from a naive Decimal(null) call).
  //   cost = $5,000 one-time
  //   benefit-A (amount=1000/month, 3 occurrences) = $3,000 total
  //   benefit-B (amount=null, financial) = excluded, must not corrupt the sum
  // Hand-computed: totalFinancialBenefits = 3000 (benefit-A only), npv (0%
  // discount) = 3000 - 5000 = -2000 — NOT NaN, NOT as if benefit-B were $0
  // AND counted (that would still be 3000 here by coincidence — the real
  // guard is the assertion below that the engine does not throw/NaN and
  // records a finding for the missing line, proving it took the "exclude"
  // path rather than an unguarded arithmetic path).
  // ==========================================================
  it('KA-7: a financial benefit line with amount=null is excluded, not silently treated as $0, and is recorded as a finding', () => {
    const result = runRoiCalculationEngine(
      baseInput({
        analysisStart: '2026-01-01',
        analysisEnd: '2026-04-30', // period 3
        costLines: [costLine({ id: 'cost-1', amount: 5000, timingType: 'one_time', oneTimePeriodDate: '2026-01-01' })],
        benefitLines: [
          benefitLine({
            id: 'benefit-a',
            amount: 1000,
            timingType: 'recurring',
            recurrenceStartDate: '2026-02-01',
            recurrenceEndDate: '2026-04-01',
            recurrenceCadence: 'monthly',
          }),
          benefitLine({
            id: 'benefit-b-missing',
            amount: null,
            timingType: 'recurring',
            recurrenceStartDate: '2026-02-01',
            recurrenceEndDate: '2026-04-01',
            recurrenceCadence: 'monthly',
          }),
        ],
      })
    );

    expect(result.status).toBe('completed');
    expect(result.totalFinancialBenefits).toBe(3000);
    expect(Number.isNaN(result.totalFinancialBenefits)).toBe(false);
    expect(result.npv).toBe(3000 - 5000);
    expect(
      result.validationFindings.some((f) => f.code === 'benefit_line_amount_missing' && f.refs?.benefitLineId === 'benefit-b-missing')
    ).toBe(true);
  });

  // ==========================================================
  // KA-8 (required by AC-05): mixed-currency hard-fail. Case currency is
  // USD; one benefit line is EUR. status='failed', hasMixedCurrencyFailure
  // =true, periodSeries=[], every metric null — no number computed at all.
  // ==========================================================
  it('KA-8: mixed-currency input hard-fails — no metric is computed', () => {
    const result = runRoiCalculationEngine(
      baseInput({
        currency: 'USD',
        costLines: [costLine({ id: 'cost-1', amount: 10000, currency: 'USD', timingType: 'one_time', oneTimePeriodDate: '2026-01-01' })],
        benefitLines: [
          benefitLine({
            id: 'benefit-1',
            amount: 5000,
            currency: 'EUR', // mismatch
            timingType: 'one_time',
            oneTimePeriodDate: '2026-02-01',
          }),
        ],
      })
    );

    expect(result.status).toBe('failed');
    expect(result.hasMixedCurrencyFailure).toBe(true);
    expect(result.periodSeries).toEqual([]);
    expect(result.totalCosts).toBeNull();
    expect(result.totalFinancialBenefits).toBeNull();
    expect(result.simpleRoi).toBeNull();
    expect(result.npv).toBeNull();
    expect(result.irrPct).toBeNull();
    expect(result.paybackPeriods).toBeNull();
    expect(result.discountedPaybackPeriods).toBeNull();
    expect(result.benefitCostRatio).toBeNull();
    expect(result.validationFindings.some((f) => f.code === 'mixed_currency_hard_fail')).toBe(true);
  });

  // ==========================================================
  // KA-9: IRR 'not_applicable' when there is no sign change (all-positive
  // flows, zero outlay) — irr() must return null, not throw.
  // ==========================================================
  it("KA-9: irrStatus is 'not_applicable' (not a thrown error) when there is no sign change", () => {
    const result = runRoiCalculationEngine(
      baseInput({
        analysisStart: '2026-01-01',
        analysisEnd: '2026-04-30', // period 3
        costLines: [costLine({ id: 'cost-1', amount: 0, timingType: 'one_time', oneTimePeriodDate: '2026-01-01' })],
        benefitLines: [
          benefitLine({
            id: 'benefit-1',
            amount: 1000,
            timingType: 'recurring',
            recurrenceStartDate: '2026-02-01',
            recurrenceEndDate: '2026-04-01',
            recurrenceCadence: 'monthly',
          }),
        ],
      })
    );

    expect(result.status).toBe('completed');
    expect(result.irrPct).toBeNull();
    expect(result.irrStatus).toBe('not_applicable');
  });

  // ==========================================================
  // KA-10: double-counting — two benefit lines share a
  // double_counting_group with no resolution note => hasUnresolvedDoubleCounting
  // =true. Adding a note to either => false on the next call with the same
  // inputs plus that one note.
  // ==========================================================
  it('KA-10: an unresolved double-counting group is flagged, and resolves once a note is added', () => {
    const linesWithoutNote = [
      benefitLine({ id: 'benefit-1', amount: 1000, timingType: 'one_time', oneTimePeriodDate: '2026-02-01', doubleCountingGroup: 'G1' }),
      benefitLine({ id: 'benefit-2', amount: 2000, timingType: 'one_time', oneTimePeriodDate: '2026-02-01', doubleCountingGroup: 'G1' }),
    ];
    const unresolved = runRoiCalculationEngine(baseInput({ benefitLines: linesWithoutNote }));
    expect(unresolved.hasUnresolvedDoubleCounting).toBe(true);
    expect(unresolved.validationFindings.some((f) => f.code === 'unresolved_double_counting_group')).toBe(true);

    const linesWithNote = [
      benefitLine({
        id: 'benefit-1',
        amount: 1000,
        timingType: 'one_time',
        oneTimePeriodDate: '2026-02-01',
        doubleCountingGroup: 'G1',
        doubleCountingResolutionNote: 'Reviewed — no overlap with benefit-2, both counted independently.',
      }),
      benefitLine({ id: 'benefit-2', amount: 2000, timingType: 'one_time', oneTimePeriodDate: '2026-02-01', doubleCountingGroup: 'G1' }),
    ];
    const resolved = runRoiCalculationEngine(baseInput({ benefitLines: linesWithNote }));
    expect(resolved.hasUnresolvedDoubleCounting).toBe(false);
  });

  // ==========================================================
  // KA-11: determinism — the same input object run twice produces a
  // byte-identical (deep-equal) output object. Prerequisite for
  // computeStateHash's input_hash stability at the command layer.
  // ==========================================================
  it('KA-11: the same input run twice produces deep-equal output', () => {
    const input = baseInput({
      analysisStart: '2026-01-01',
      analysisEnd: '2028-01-31',
      discountRatePct: 12,
      costLines: [costLine({ id: 'cost-1', amount: 100000, timingType: 'one_time', oneTimePeriodDate: '2026-01-01' })],
      benefitLines: [
        benefitLine({
          id: 'benefit-1',
          amount: 8000,
          timingType: 'recurring',
          recurrenceStartDate: '2026-02-01',
          recurrenceEndDate: '2028-01-01',
          recurrenceCadence: 'monthly',
        }),
      ],
    });

    const first = runRoiCalculationEngine(input);
    const second = runRoiCalculationEngine(input);
    expect(first).toEqual(second);
  });

  // ==========================================================
  // KA-12: requiredMetrics excludes 'irr' => irrStatus='not_required_by_policy'
  // and the imported irr() function is never invoked (spy on the imported
  // function — the design's own suggested simplest verification method).
  // ==========================================================
  it("KA-12: requiredMetrics excluding 'irr' sets not_required_by_policy and never calls irr()", () => {
    const irrSpy = vi.spyOn(investmentAppraisalService, 'irr');
    irrSpy.mockClear();

    const result = runRoiCalculationEngine(
      baseInput({
        requiredMetrics: ['npv', 'payback'],
        costLines: [costLine({ id: 'cost-1', amount: 10000, timingType: 'one_time', oneTimePeriodDate: '2026-01-01' })],
        benefitLines: [
          benefitLine({
            id: 'benefit-1',
            amount: 2000,
            timingType: 'recurring',
            recurrenceStartDate: '2026-02-01',
            recurrenceEndDate: '2026-12-01',
            recurrenceCadence: 'monthly',
          }),
        ],
      })
    );

    expect(result.status).toBe('completed');
    expect(result.irrStatus).toBe('not_required_by_policy');
    expect(result.irrPct).toBeNull();
    expect(irrSpy).not.toHaveBeenCalled();

    irrSpy.mockRestore();
  });
});
