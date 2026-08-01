/**
 * FIN-005 round 8 — `financeFixtureComplete` vs `financeGoldenFlowComplete`
 * must never be the same boolean.
 *
 * `verifyAtelierFinanceGoldenFlowComplete` is the one place that gets to say
 * "the user can open the model and see a real NPV/IRR/payback". These tests
 * pin: it never says so on fixture status alone, it never says so without
 * actually invoking the canonical compute + appraisal engines, and a broken
 * compute result (not just a missing one) is caught, not waved through.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAll = vi.fn();
const dbGet = vi.fn();

vi.mock('../../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => dbAll(...args),
  get: (...args: unknown[]) => dbGet(...args),
  run: vi.fn(),
}));

import {
  ATELIER_CANONICAL_DISCOUNT_RATE_PCT,
  atelierCanonicalModelId,
  verifyAtelierFinanceGoldenFlowComplete,
} from '../atelierFinanceSeed.js';

const ORG_ID = 'org-atelier-r8';
const MODEL_ID = atelierCanonicalModelId(ORG_ID);

/**
 * FIN-005 round 9: the seed (`upsertAtelierRoiFinancialModel`,
 * demoSeedService.ts) now writes `discountRatePct`/`hurdleRatePct` plus the
 * two explicit "no implementation lag was invented" keys into
 * `assumptions_json` — see `resolveAtelierAppraisalRates` in
 * `atelierFinanceSeed.ts`. This fixture mirrors what the real seed writes so
 * these tests exercise the actual runtime shape, not a stale `{}`.
 */
const ATELIER_MODEL_ASSUMPTIONS = {
  implementationLagMonths: null,
  implementationLagAssumptionStatus: 'NEEDS_PRODUCT_DECISION',
  implementationLagAssumptionNote:
    'Source data does not specify a ramp-up schedule between CAPEX and revenue/savings realization — events are modeled exactly as dated, with no assumed delay.',
  discountRatePct: 10,
  hurdleRatePct: 10,
};

/**
 * A FACTORY, not a shared constant: `getModel()` (`financialModelingService.ts`)
 * mutates the row it is handed — it JSON.parses `assumptions_json` in place —
 * and every test below wires `dbGet.mockResolvedValue(...)` to the SAME
 * object reference every call. Sharing one object across tests would make a
 * later test observe an already-parsed `assumptions_json` from an earlier
 * test's call to `getModel()`, which happens to be harmless here but is not a
 * property worth relying on.
 */
function atelierModelRow(
  assumptions: Record<string, unknown> = ATELIER_MODEL_ASSUMPTIONS
): Record<string, unknown> {
  return {
    id: MODEL_ID,
    organization_id: ORG_ID,
    start_date: '2015-01-01',
    horizon_months: 36,
    granularity: 'annual',
    assumptions_json: JSON.stringify(assumptions),
  };
}

const ATELIER_EVENTS = [
  {
    id: 'e-revenue-uplift',
    model_id: MODEL_ID,
    event_type: 'revenue',
    name: 'Revenue uplift',
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
    model_id: MODEL_ID,
    event_type: 'capex_purchase',
    name: 'Digital capex',
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
    model_id: MODEL_ID,
    event_type: 'opex',
    name: 'OpEx reduction',
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
});

describe('verifyAtelierFinanceGoldenFlowComplete', () => {
  it('never reports golden-flow-complete when the fixture itself is incomplete — and never touches the DB to check', async () => {
    const result = await verifyAtelierFinanceGoldenFlowComplete(ORG_ID, 'incomplete');

    expect(result.fixtureComplete).toBe(false);
    expect(result.goldenFlowComplete).toBe(false);
    expect(result.reason).toBeTruthy();
    // The whole point: an incomplete fixture short-circuits BEFORE compute is
    // even attempted — a broken statement/analysis leg cannot be papered over
    // by a lucky compute result.
    expect(dbGet).not.toHaveBeenCalled();
    expect(dbAll).not.toHaveBeenCalled();
  });

  it('fixtureComplete=true does NOT imply goldenFlowComplete=true — a compute failure is reported, not swallowed', async () => {
    dbGet.mockResolvedValue(atelierModelRow());
    dbAll.mockRejectedValue(new Error('connection reset'));

    const result = await verifyAtelierFinanceGoldenFlowComplete(ORG_ID, 'complete');

    expect(result.fixtureComplete).toBe(true);
    expect(result.goldenFlowComplete).toBe(false);
    expect(result.reason).toMatch(/connection reset/);
    expect(result.appraisal).toBeUndefined();
  });

  it('reports incomplete when the model has zero forecast events (well-formed but all-zero periods)', async () => {
    dbGet.mockResolvedValue(atelierModelRow());
    dbAll.mockResolvedValue([]); // no events

    const result = await verifyAtelierFinanceGoldenFlowComplete(ORG_ID, 'complete');

    // computeModel() still generates 3 periods from start_date/horizon_months
    // with zero events — the bug this guards against is treating that
    // well-formed-but-empty shape as "complete".
    expect(result.fixtureComplete).toBe(true);
    expect(result.goldenFlowComplete).toBe(false);
    expect(result.reason).toMatch(/no cash-flow activity/);
  });

  it('NEGATIVE CONTROL: real (not injected) Infinity from the canonical engine is caught, not reported as complete', async () => {
    // `aggregateMonthlyOutputs` sums monthly P&L/CF lines with `... || 0`
    // (financialModelingService.ts) — that coercion swallows a NaN month back
    // to 0, but NOT Infinity (`Infinity || 0` is `Infinity`, since Infinity is
    // truthy). An absurd but real `growth_rate` overflows the REAL
    // `expandEventToAmounts` compound-growth formula past Number.MAX_VALUE —
    // genuine engine behavior, not a synthetic stub. Proves the
    // Number.isFinite(npv) gate is load-bearing: remove it, and this would
    // silently become `goldenFlowComplete: true`.
    expect(2_400_000 * Math.pow(1 + 1e300 / 100, 35 / 12)).toBe(Infinity); // pins the JS behavior this relies on
    dbGet.mockResolvedValue(atelierModelRow());
    dbAll.mockResolvedValue([{ ...ATELIER_EVENTS[0], growth_rate: 1e300 }]);

    const result = await verifyAtelierFinanceGoldenFlowComplete(ORG_ID, 'complete');

    expect(result.fixtureComplete).toBe(true);
    expect(result.goldenFlowComplete).toBe(false);
    expect(result.reason).toMatch(/non-finite NPV/);
  });

  it('goldenFlowComplete=true only after ACTUALLY computing a finite NPV from the real canonical events', async () => {
    dbGet.mockResolvedValue(atelierModelRow());
    dbAll.mockResolvedValue(ATELIER_EVENTS);

    const result = await verifyAtelierFinanceGoldenFlowComplete(ORG_ID, 'complete');

    expect(result.fixtureComplete).toBe(true);
    expect(result.goldenFlowComplete).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.appraisal).toBeDefined();
    expect(Number.isFinite(result.appraisal!.result.npv)).toBe(true);
    // Evidence, not a claim: dbAll/dbGet were genuinely called with the model id.
    expect(dbGet).toHaveBeenCalledWith(expect.stringMatching(/financial_models/), [MODEL_ID]);
  });

  it('FIN-005 round 9: reads the discount/hurdle rate from the model\'s own assumptions_json, not the hardcoded constant', async () => {
    // A rate that deliberately differs from ATELIER_CANONICAL_DISCOUNT_RATE_PCT
    // (10) — if the appraisal used the constant instead of assumptions_json,
    // input.discountRatePct below would read 10, not 7.
    dbGet.mockResolvedValue(atelierModelRow({ ...ATELIER_MODEL_ASSUMPTIONS, discountRatePct: 7, hurdleRatePct: 6 }));
    dbAll.mockResolvedValue(ATELIER_EVENTS);

    const result = await verifyAtelierFinanceGoldenFlowComplete(ORG_ID, 'complete');

    expect(result.goldenFlowComplete).toBe(true);
    expect(result.appraisal!.input.discountRatePct).toBe(7);
    expect(result.appraisal!.input.hurdleRatePct).toBe(6);
    expect(result.appraisal!.input.discountRatePct).not.toBe(ATELIER_CANONICAL_DISCOUNT_RATE_PCT);
  });

  it('falls back to ATELIER_CANONICAL_DISCOUNT_RATE_PCT ONLY when assumptions_json genuinely lacks discountRatePct', async () => {
    // No discountRatePct/hurdleRatePct at all — the shape an older, pre-round-9
    // fixture would have. The seed written today always populates these keys
    // (see demoSeedService.ts's upsertAtelierRoiFinancialModel); this pins the
    // defensive path for a row it did not write.
    dbGet.mockResolvedValue(atelierModelRow({}));
    dbAll.mockResolvedValue(ATELIER_EVENTS);

    const result = await verifyAtelierFinanceGoldenFlowComplete(ORG_ID, 'complete');

    expect(result.goldenFlowComplete).toBe(true);
    expect(result.appraisal!.input.discountRatePct).toBe(ATELIER_CANONICAL_DISCOUNT_RATE_PCT);
    expect(result.appraisal!.input.hurdleRatePct).toBe(ATELIER_CANONICAL_DISCOUNT_RATE_PCT);
  });
});
