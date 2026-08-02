/**
 * FIN-005/FIN-006 — proves the appraisal adapter is glue, not a second engine:
 * feeding it the REAL canonical Atelier events through the REAL `computeModel()`
 * and the REAL `appraise()` gives the same numbers those two engines would give
 * if composed by hand.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAll = vi.fn();
const dbGet = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => dbAll(...args),
  get: (...args: unknown[]) => dbGet(...args),
  run: vi.fn(),
}));

import { computeModel } from '../financialModelingService.js';
import {
  appraiseComputeResult,
  deriveAppraisalInputFromComputeResult,
} from '../financialModelAppraisalAdapter.js';
import { appraise } from '../investmentAppraisalService.js';

/** Field-for-field identical to `upsertAtelierRoiFinancialModel` (demoSeedService.ts:3442-3490). */
const ATELIER_MODEL_ROW = {
  id: 'model-atelier',
  organization_id: 'org-atelier',
  start_date: '2015-01-01',
  horizon_months: 36,
  granularity: 'annual',
  assumptions_json: '{}',
};

const ATELIER_EVENTS = [
  {
    id: 'e-revenue-uplift',
    model_id: 'model-atelier',
    event_type: 'revenue',
    name: 'Revenue uplift (digitized lines)',
    amount: 2_400_000,
    period_start: '2015-01-01',
    period_end: null,
    recurrence: 'annual',
    growth_rate: 0.08,
    cf_classification: 'operating',
    posting_rules: '{}',
    sort_order: 1,
    is_active: true,
  },
  {
    id: 'e-digital-capex',
    model_id: 'model-atelier',
    event_type: 'capex_purchase',
    name: 'Digital transformation capex',
    amount: 800_000,
    period_start: '2015-01-01',
    period_end: null,
    recurrence: 'one_time',
    growth_rate: 0,
    cf_classification: 'investing',
    posting_rules: '{}',
    sort_order: 2,
    is_active: true,
  },
  {
    id: 'e-opex-reduction',
    model_id: 'model-atelier',
    event_type: 'opex',
    name: 'OpEx reduction (automation)',
    amount: -400_000,
    period_start: '2016-01-01',
    period_end: null,
    recurrence: 'annual',
    growth_rate: 0,
    cf_classification: 'operating',
    posting_rules: '{}',
    sort_order: 3,
    is_active: true,
  },
];

beforeEach(() => {
  dbAll.mockReset();
  dbGet.mockReset();
  dbGet.mockResolvedValue(ATELIER_MODEL_ROW);
  dbAll.mockResolvedValue(ATELIER_EVENTS);
});

describe('financialModelAppraisalAdapter — pure reshape', () => {
  it('derives cashflows and initialInvestment from ComputeResult.periods with no new arithmetic', () => {
    const synthetic = {
      periods: [
        { date: '2015-01-01', label: '2015', pl: {}, bs: {}, cf: { OPERATING_CF: 1_000, INVESTING_CF: -300, FINANCING_CF: 0 } },
        { date: '2016-01-01', label: '2016', pl: {}, bs: {}, cf: { OPERATING_CF: 1_200, INVESTING_CF: 0, FINANCING_CF: 0 } },
      ],
    } as any;

    const input = deriveAppraisalInputFromComputeResult(synthetic, { discountRatePct: 10 });

    expect(input.initialInvestment).toBe(300);
    expect(input.cashflows).toEqual([1_000, 1_200]);
    expect(input.discountRatePct).toBe(10);
    expect(input.hurdleRatePct).toBe(10); // defaults to discountRatePct
  });

  it('does NOT pull a LATER period investing cash flow forward to t=0 — it stays in its own period', () => {
    const synthetic = {
      periods: [
        { date: '2015-01-01', label: '2015', pl: {}, bs: {}, cf: { OPERATING_CF: 500, INVESTING_CF: -200, FINANCING_CF: 0 } },
        { date: '2016-01-01', label: '2016', pl: {}, bs: {}, cf: { OPERATING_CF: 900, INVESTING_CF: -100, FINANCING_CF: 0 } },
      ],
    } as any;

    const input = deriveAppraisalInputFromComputeResult(synthetic, { discountRatePct: 5 });

    // Only period 0's investing becomes the outlay.
    expect(input.initialInvestment).toBe(200);
    // Period 1's own investing (-100) stays embedded in cashflows[1], not moved to t=0.
    expect(input.cashflows).toEqual([500, 800]);
  });

  it('floors initialInvestment at 0 when the first period has no net outflow', () => {
    const synthetic = {
      periods: [{ date: '2015-01-01', label: '2015', pl: {}, bs: {}, cf: { OPERATING_CF: 100, INVESTING_CF: 50, FINANCING_CF: 0 } }],
    } as any;
    const input = deriveAppraisalInputFromComputeResult(synthetic, { discountRatePct: 10 });
    expect(input.initialInvestment).toBe(0);
    // Positive investing in period 0 is not extracted (would go negative) — stays in cashflows[0].
    expect(input.cashflows).toEqual([150]);
  });

  it('handles zero periods without throwing', () => {
    const input = deriveAppraisalInputFromComputeResult({ periods: [] } as any, { discountRatePct: 10 });
    expect(input).toEqual({ cashflows: [], initialInvestment: 0, discountRatePct: 10, hurdleRatePct: 10 });
  });

  it('appraiseComputeResult(input) === appraise(derive(input)) — composition, not a second engine', () => {
    const synthetic = {
      periods: [
        { date: '2015-01-01', label: '2015', pl: {}, bs: {}, cf: { OPERATING_CF: 1_000, INVESTING_CF: -300, FINANCING_CF: 0 } },
        { date: '2016-01-01', label: '2016', pl: {}, bs: {}, cf: { OPERATING_CF: 1_200, INVESTING_CF: 0, FINANCING_CF: 0 } },
      ],
    } as any;
    const rates = { discountRatePct: 8, hurdleRatePct: 12 };

    const viaAdapter = appraiseComputeResult(synthetic, rates);
    const byHand = appraise(deriveAppraisalInputFromComputeResult(synthetic, rates));

    expect(viaAdapter.result).toEqual(byHand);
  });
});

describe('financialModelAppraisalAdapter — end to end on the REAL canonical Atelier events', () => {
  it('computeModel() -> appraiseComputeResult() produces a real, non-hardcoded NPV/IRR/payback', async () => {
    const computeResult = await computeModel('model-atelier');
    expect(computeResult.periods).toHaveLength(3); // 36 months, annual granularity -> 2015/2016/2017

    const appraisal = appraiseComputeResult(computeResult, { discountRatePct: 10, hurdleRatePct: 10 });

    // Lineage: the derived input must come from computeModel()'s own CF lines,
    // not from the raw event amounts (2_400_000 / 800_000 / -400_000) directly —
    // those get netted into P&L/CF by the canonical engine first.
    expect(appraisal.input.initialInvestment).toBeCloseTo(800_000, 0);
    expect(appraisal.input.cashflows).toHaveLength(3);
    expect(appraisal.periodLabels).toHaveLength(3);

    // A real, finite, non-hardcoded number — NOT the fabricated 1_820_000 that
    // lives in the unrelated `analysis_financials` legacy row for this same
    // initiative (demoSeedService.ts:3593).
    expect(Number.isFinite(appraisal.result.npv)).toBe(true);
    expect(appraisal.result.npv).not.toBe(1_820_000);
    expect(['go', 'conditional', 'no-go']).toContain(appraisal.result.verdict);
  });

  it('changing an input event amount changes the output (proves it is not a stored/hardcoded constant)', async () => {
    const base = appraiseComputeResult(await computeModel('model-atelier'), { discountRatePct: 10 });

    dbAll.mockResolvedValue(
      ATELIER_EVENTS.map((e) => (e.id === 'e-revenue-uplift' ? { ...e, amount: 4_800_000 } : e))
    );
    const doubled = appraiseComputeResult(await computeModel('model-atelier'), { discountRatePct: 10 });

    expect(doubled.result.npv).not.toBeCloseTo(base.result.npv, 0);
    expect(doubled.result.npv).toBeGreaterThan(base.result.npv);
  });

  it('reopen determinism: recomputing from the same stored events twice gives byte-identical results', async () => {
    const first = appraiseComputeResult(await computeModel('model-atelier'), { discountRatePct: 10 });
    const second = appraiseComputeResult(await computeModel('model-atelier'), { discountRatePct: 10 });
    expect(second).toEqual(first);
  });

  it('a different discount rate changes NPV (rate is a parameter, never hardcoded)', async () => {
    const computeResult = await computeModel('model-atelier');
    const at5 = appraiseComputeResult(computeResult, { discountRatePct: 5 });
    const at20 = appraiseComputeResult(computeResult, { discountRatePct: 20 });
    expect(at5.result.npv).not.toBeCloseTo(at20.result.npv, 0);
  });

  it('pins the NEW (fixed opex-sign) canonical Atelier appraisal, and proves it differs from the OLD (buggy Math.abs()) numbers in the round-8 report (§17.3)', async () => {
    const computeResult = await computeModel('model-atelier');
    const appraisal = appraiseComputeResult(computeResult, { discountRatePct: 10, hurdleRatePct: 10 });

    // NEW (fixed sign) — pinned to the values this fix produces.
    expect(appraisal.result.npv).toBeCloseTo(5_804_022.19, 1);
    expect(appraisal.result.irr).toBeCloseTo(307.161, 2);
    expect(appraisal.result.payback).toBeCloseTo(0.3333, 3);

    // OLD (buggy Math.abs()-flips-the-saving-to-a-cost) numbers, documented in
    // docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/FIN-005_IMPLEMENTATION_HANDOFF.md
    // §17.3: NPV≈4,541,813, IRR≈282.5%, payback≈0.33yr. This proves the fix
    // actually MOVED the number (a genuine saving can only raise NPV, never
    // lower it), not merely re-confirmed the old one.
    const OLD_BUGGY_NPV = 4_541_813.33;
    const OLD_BUGGY_IRR_PCT = 282.5337066347494;
    expect(appraisal.result.npv).not.toBeCloseTo(OLD_BUGGY_NPV, 0);
    expect(appraisal.result.npv).toBeGreaterThan(OLD_BUGGY_NPV);
    expect(appraisal.result.irr).toBeGreaterThan(OLD_BUGGY_IRR_PCT);
    // Payback is unaffected here: period 0 alone already recovers the 800k
    // capex outlay (2,400,000 > 800,000) regardless of the opex fix, which
    // only starts applying in period 1 (2016).
    expect(appraisal.result.payback).toBeCloseTo(0.3333333333333333, 6);
  });
});

describe('financialModelAppraisalAdapter — computeModel() opex sign semantics (OpEx reduction is a saving, not forced to a cost)', () => {
  const OPEX_SIGN_MODEL_ROW = {
    id: 'model-opex-sign',
    organization_id: 'org-opex-sign',
    start_date: '2020-01-01',
    horizon_months: 1,
    granularity: 'monthly',
    assumptions_json: '{}',
  };

  function singleOpexEvent(amount: number) {
    return [
      {
        id: 'e-opex',
        model_id: 'model-opex-sign',
        event_type: 'opex',
        name: amount < 0 ? 'OpEx reduction (automation)' : 'Real OpEx cost',
        amount,
        period_start: '2020-01-01',
        period_end: null,
        recurrence: 'one_time',
        growth_rate: 0,
        cf_classification: 'operating',
        posting_rules: '{}',
        parameters: '{}',
        sort_order: 1,
        is_active: true,
      },
    ];
  }

  it('a NEGATIVE opex amount is a genuine saving: reduces OPEX and INCREASES net income (the product decision this fix implements)', async () => {
    dbGet.mockResolvedValue(OPEX_SIGN_MODEL_ROW);
    dbAll.mockResolvedValue(singleOpexEvent(-400_000));

    const result = await computeModel('model-opex-sign');
    const period = result.periods[0];

    // Pre-fix, Math.abs() would have flipped this into a -400,000 COST
    // (out.pl.OPEX === -400000). The fix respects the stored sign: a negative
    // amount REDUCES totalOPEX, so out.pl.OPEX = -totalOPEX becomes a
    // POSITIVE contribution to profit — a saving, exactly as the event name says.
    expect(period.pl.OPEX).toBe(400_000);
    expect(period.pl.EBITDA).toBe(400_000);
    expect(period.pl.EBIT).toBe(400_000);
    expect(period.pl.NET_INCOME).toBe(400_000);
  });

  it('a POSITIVE opex amount still behaves exactly as before the fix (regression guard: Math.abs(x) === x for x > 0)', async () => {
    dbGet.mockResolvedValue(OPEX_SIGN_MODEL_ROW);
    dbAll.mockResolvedValue(singleOpexEvent(50_000));

    const result = await computeModel('model-opex-sign');
    const period = result.periods[0];

    expect(period.pl.OPEX).toBe(-50_000);
    expect(period.pl.EBITDA).toBe(-50_000);
    expect(period.pl.EBIT).toBe(-50_000);
    expect(period.pl.NET_INCOME).toBe(-50_000);
  });
});
