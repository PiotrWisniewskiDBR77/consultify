/**
 * FIN-005 — negative-control regression test for the `case 'opex':` sign bug
 * documented in `docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/FIN-005_IMPLEMENTATION_HANDOFF.md`
 * §17.3, finding #1.
 *
 * BUG (pre-fix): `computeModel()`'s switch statement did
 * `totalOPEX += Math.abs(amt)` for `event_type === 'opex'`, which discarded
 * the sign of `amount`. A NEGATIVE `amount` — meant to represent an OpEx
 * REDUCTION / saving (e.g. "OpEx reduction (automation)") — got flipped into
 * a POSITIVE contribution to `totalOPEX`, i.e. treated as an ordinary cost
 * INCREASE instead of a saving. A positive `amount` (the ordinary cost case)
 * was unaffected, since `Math.abs(x) === x` for `x >= 0`.
 *
 * FIX: `totalOPEX += amt` (sign preserved). `out.pl.OPEX = -totalOPEX` then
 * correctly turns a negative `totalOPEX` (net saving) into a POSITIVE P&L
 * contribution, and a positive `totalOPEX` (net cost) into a negative one,
 * exactly as before.
 *
 * This suite proves the fix two ways:
 *   1. Direct assertions on `computeModel()`'s real output for minimal
 *      negative- and positive-amount opex events (§ "unit" describe block).
 *   2. A negative-control that hand-computes what the OLD `Math.abs()`
 *      formula would have produced for the same fixture, to prove this
 *      suite's assertions are not vacuous — i.e. they would actually have
 *      gone red against the pre-fix code (§ "negative control" test).
 *   3. An end-to-end recompute of the full canonical 3-event Atelier
 *      fixture (same `ATELIER_EVENTS` as `financialModelAppraisalAdapter.test.ts`),
 *      cross-checked against the round-8-documented OLD (buggy) NPV/IRR/payback.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAll = vi.fn();
const dbGet = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => dbAll(...args),
  get: (...args: unknown[]) => dbGet(...args),
  run: vi.fn(),
}));

import { appraiseComputeResult } from '../financialModelAppraisalAdapter.js';
import { computeModel } from '../financialModelingService.js';

beforeEach(() => {
  dbAll.mockReset();
  dbGet.mockReset();
});

// ---------------------------------------------------------------------------
// Minimal synthetic fixtures
// ---------------------------------------------------------------------------

const BASE_MODEL_ROW = {
  organization_id: 'org-opex-sign-regression',
  start_date: '2020-01-01',
  horizon_months: 12,
  granularity: 'annual' as const,
  assumptions_json: '{}',
};

function negativeOpexEvent() {
  return {
    id: 'e-opex-negative',
    model_id: 'model-opex-negative',
    event_type: 'opex',
    name: 'OpEx reduction (synthetic negative control)',
    amount: -100,
    period_start: '2020-01-01',
    period_end: null,
    recurrence: 'annual',
    growth_rate: 0,
    cf_classification: 'operating',
    posting_rules: '{}',
    sort_order: 1,
    is_active: true,
  };
}

function positiveOpexEvent() {
  return {
    id: 'e-opex-positive',
    model_id: 'model-opex-positive',
    event_type: 'opex',
    name: 'Ordinary OpEx cost (companion regression guard)',
    amount: 100,
    period_start: '2020-01-01',
    period_end: null,
    recurrence: 'annual',
    growth_rate: 0,
    cf_classification: 'operating',
    posting_rules: '{}',
    sort_order: 1,
    is_active: true,
  };
}

describe('financialModelingService.computeModel — opex sign regression (unit)', () => {
  it('a NEGATIVE opex amount is a SAVING: it makes pl.OPEX positive and increases NET_INCOME', async () => {
    dbGet.mockResolvedValue({ id: 'model-opex-negative', ...BASE_MODEL_ROW });
    dbAll.mockResolvedValue([negativeOpexEvent()]);

    const result = await computeModel('model-opex-negative');
    expect(result.periods).toHaveLength(1); // 12 months, annual granularity -> 1 FY period

    const period = result.periods[0];
    // totalOPEX = amt = -100 (fix preserves sign) => pl.OPEX = -totalOPEX = +100
    expect(period.pl.OPEX).toBeCloseTo(100, 6);
    // No revenue/COGS/depreciation/interest/tax in this fixture, so NET_INCOME
    // is driven purely by the opex line: 0 - (-100) = +100.
    expect(period.pl.NET_INCOME).toBeCloseTo(100, 6);
    expect(period.pl.EBITDA).toBeCloseTo(100, 6);
  });

  it('a POSITIVE opex amount still behaves as an ordinary cost (companion guard — proves the fix did not break the normal case)', async () => {
    dbGet.mockResolvedValue({ id: 'model-opex-positive', ...BASE_MODEL_ROW });
    dbAll.mockResolvedValue([positiveOpexEvent()]);

    const result = await computeModel('model-opex-positive');
    expect(result.periods).toHaveLength(1);

    const period = result.periods[0];
    // totalOPEX = amt = +100 => pl.OPEX = -totalOPEX = -100 (an ordinary expense)
    expect(period.pl.OPEX).toBeCloseTo(-100, 6);
    expect(period.pl.NET_INCOME).toBeCloseTo(-100, 6);
    expect(period.pl.EBITDA).toBeCloseTo(-100, 6);
  });

  it('baseline comparison: removing the negative opex event drops NET_INCOME back to 0 (proves the +100 above is attributable to that one event, not a fixture artifact)', async () => {
    dbGet.mockResolvedValue({ id: 'model-opex-baseline', ...BASE_MODEL_ROW });
    dbAll.mockResolvedValue([]); // no events at all, no baseline ratios either

    const result = await computeModel('model-opex-baseline');
    expect(result.periods).toHaveLength(1);
    expect(result.periods[0].pl.NET_INCOME).toBeCloseTo(0, 6);
    expect(result.periods[0].pl.OPEX).toBeCloseTo(0, 6);
  });
});

describe('negative control — proves this suite is not vacuous', () => {
  it('the OLD (pre-fix) Math.abs(amt) formula would have produced the OPPOSITE-SIGN pl.OPEX for the same negative-amount fixture', () => {
    // This does NOT call computeModel() or touch financialModelingService.ts —
    // it is a standalone, hand-rolled copy of exactly the one line that was
    // buggy (`totalOPEX += Math.abs(amt)`), applied to the same amt = -100
    // used in the "unit" describe block above. It exists purely to
    // demonstrate that the assertions above are a real regression test: if
    // financialModelingService.ts's `case 'opex':` still used this old
    // formula, `pl.OPEX` for the negative-amount fixture would come out as
    // -100 (a cost), not +100 (a saving) — contradicting the fixed-code
    // assertion `expect(period.pl.OPEX).toBeCloseTo(100, 6)` above, which
    // would therefore go red.
    const amt = -100;

    const oldBuggyTotalOpex = Math.abs(amt); // pre-fix line
    const oldBuggyPlOpex = -oldBuggyTotalOpex; // out.pl.OPEX = -totalOPEX (unchanged by the fix)

    const fixedTotalOpex = amt; // post-fix line
    const fixedPlOpex = -fixedTotalOpex;

    expect(oldBuggyPlOpex).toBe(-100); // what the bug would have produced: treated as a COST
    expect(fixedPlOpex).toBe(100); // what the real engine produces today: treated as a SAVING
    expect(oldBuggyPlOpex).not.toBe(fixedPlOpex); // the two formulas diverge on this fixture — a real regression test
  });
});

// ---------------------------------------------------------------------------
// End-to-end: real canonical Atelier 3-event fixture, full appraisal
// ---------------------------------------------------------------------------

/**
 * Field-for-field identical to `financialModelAppraisalAdapter.test.ts`'s
 * `ATELIER_MODEL_ROW` / `ATELIER_EVENTS` (itself field-for-field identical to
 * `upsertAtelierRoiFinancialModel`, demoSeedService.ts:3442-3490) — copied
 * verbatim rather than re-derived, per task instructions, so the fixture
 * numbers are not accidentally "slightly different".
 */
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

describe('end-to-end — real canonical Atelier fixture, full appraisal, vs round-8-documented OLD numbers', () => {
  beforeEach(() => {
    dbGet.mockResolvedValue(ATELIER_MODEL_ROW);
    dbAll.mockResolvedValue(ATELIER_EVENTS);
  });

  it('recomputes to numbers DIFFERENT FROM, and BETTER THAN (higher NPV), the round-8-documented OLD buggy numbers', async () => {
    const computeResult = await computeModel('model-atelier');
    expect(computeResult.periods).toHaveLength(3); // FY2015/16/17

    const appraisal = appraiseComputeResult(computeResult, {
      discountRatePct: 10,
      hurdleRatePct: 10,
    });

    // OLD (pre-fix, round-8-documented) numbers — source:
    // docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/FIN-005_IMPLEMENTATION_HANDOFF.md §17.3
    //   input.cashflows = [2_400_000, 2_001_920, 2_003_841.54]
    //   result.npv      ≈ 4_541_813 EUR
    //   result.irr      ≈ 282.5%
    //   result.payback  ≈ 0.33 yr
    const OLD_NPV = 4_541_813;

    // The 2016/2017 cashflows must differ from the OLD documented values, and
    // by construction (a cost becoming a saving can only help) every period
    // from the opex event's start (2016) onward must be HIGHER than before,
    // since the fix flips a -400k cost into a +400k benefit — an 800k swing.
    expect(appraisal.input.cashflows[0]).toBeCloseTo(2_400_000, 0); // FY2015: opex event not active yet — unaffected by the fix
    expect(appraisal.input.cashflows[1]).not.toBeCloseTo(2_001_920, 0);
    expect(appraisal.input.cashflows[2]).not.toBeCloseTo(2_003_841.54, 0);
    expect(appraisal.input.cashflows[1]).toBeGreaterThan(2_001_920);
    expect(appraisal.input.cashflows[2]).toBeGreaterThan(2_003_841.54);

    // NPV must be both different from and strictly greater than the OLD
    // documented figure — a cost turning into a saving can only raise NPV.
    expect(appraisal.result.npv).not.toBeCloseTo(OLD_NPV, 0);
    expect(appraisal.result.npv).toBeGreaterThan(OLD_NPV);

    expect(appraisal.result.verdict).toBe('go');

    // Report the actual new numbers (full precision) for cross-check against
    // the sibling engine-fixing agent's own numbers — printed to stdout so it
    // shows up in the test run's console output, not just asserted silently.
    // eslint-disable-next-line no-console
    console.log('[opex-sign-regression] NEW Atelier appraisal numbers:', {
      cashflows: appraisal.input.cashflows,
      initialInvestment: appraisal.input.initialInvestment,
      npv: appraisal.result.npv,
      irr: appraisal.result.irr,
      mirr: appraisal.result.mirr,
      payback: appraisal.result.payback,
      pi: appraisal.result.pi,
      verdict: appraisal.result.verdict,
    });
  });
});
