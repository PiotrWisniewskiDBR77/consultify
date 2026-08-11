/**
 * PKG-A determinism — pure unit-level negative controls + permutation calculus for
 * `predictionComputeService.ts`'s three previously-unfixed no-`ORDER BY` sites (see
 * `docs/validation/finance-v3/generated/gate-e/PKG_A_DETERMINISM_report.md`), no database required,
 * always runs. Same pattern as `kpiHashOrderDeterminism.test.ts` / `valuationFcffOrderDeterminism.test.ts`.
 *
 * Three fixed sites, all downstream of `finance_prediction_impact_chain`/`finance_prediction_financing`
 * queries that have no `ORDER BY`:
 *   1. `impactDeltaFor()`'s `total +=` accumulation over impact_chain rows targeting one line — float64
 *      addition, not associative.
 *   2. `financingRows.find(kind === 'FACILITY_DRAWDOWN')` — used to pick the facility interest rate;
 *      "first" without a canonical order is a random pick among possibly several DRAWDOWN rows.
 *   3. The per-period financing overlay loop's `Math.max(0, facilityDebtBalance - amount)` floor
 *      clamp — unlike (1), this is a genuine BUSINESS RESULT change, not just float rounding: which
 *      event (repayment vs. drawdown) is applied first changes the ending facility balance.
 *
 * The fix is `sortByCreatedAtThenId()` (canonical base order, used for both (1) and (2)) plus
 * `orderFinancingEventsForPeriod()` (the DEC-FIN-012 policy decision for (3): apply
 * `DISCRETIONARY_REPAYMENT` before `FACILITY_DRAWDOWN` within the same period — industry-standard
 * debt-schedule convention, obligations/paydowns before shortfall-covering draws).
 */
import { describe, expect, it } from 'vitest';

import {
  FINANCING_KIND_PROCESSING_RANK,
  orderFinancingEventsForPeriod,
  sortByCreatedAtThenId,
  type FinancingKind,
} from '../predictionComputeService.js';

// ---------------------------------------------------------------------------
// (1) impact_chain delta summation — permutation calculus
// ---------------------------------------------------------------------------

/**
 * Synthetic monthly impact-chain deltas, PLN, realistic order of magnitude for a mid-size
 * initiative (ABSOLUTE_AMOUNT terms after ramp/decay expansion). Finance v3 has ZERO rows on any
 * live database at audit time (`information_schema` read on PROD/DEMO/DEV — see the report's
 * "ustalenie, które zmienia kalkulację ryzyka" section) — there is no real captured repro to quote
 * (unlike `valuationFcffOrderDeterminism.test.ts`'s GoldCo EBIT series, captured from an actual
 * live-DB repro of an EARLIER bug). These 7 values were instead constructed and VERIFIED by an
 * exhaustive 5040-permutation search (7! = 5040, computed once, result pasted below) to reproduce
 * the mechanism directly: float64 addition of realistic-magnitude signed decimals is measurably
 * order-dependent.
 */
const SYNTHETIC_IMPACT_DELTAS = [
  12345.678912345, -8734.291823741, 45231.128374652, -19283.746192837, 7654.321987654, -3456.789123456, 28193.746281937,
];
/** `sum = 61950.048416554` under forward order; exhaustive search over all 5040 permutations of the
 *  7 values above found exactly 6 distinct float64 bit patterns among the results (verified with a
 *  standalone Node script, not re-run inside this test to keep it fast — `it('permutation calculus...')`
 *  below re-verifies the CLAIM about the canonical-order value and re-runs a representative sample,
 *  not the full 5040, to keep CI time bounded while still proving the effect on every run). */
const CANONICAL_ORDER_SUM = 61950.048416554;
const KNOWN_DISTINCT_SUMS_UNDER_FULL_PERMUTATION = 6;

function permutations<T>(arr: readonly T[]): T[][] {
  if (arr.length <= 1) return [[...arr]];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) result.push([arr[i], ...p]);
  }
  return result;
}

describe('predictionComputeService — impact_chain delta summation is order-sensitive (permutation calculus)', () => {
  it('RACHUNEK PERMUTACYJNY: exhaustive 5040-permutation search over 7 realistic delta values finds 6 distinct float64 sums — proves the risk is real, not theoretical', () => {
    const allSums = new Set<number>();
    for (const p of permutations(SYNTHETIC_IMPACT_DELTAS)) {
      allSums.add(p.reduce((a, b) => a + b, 0));
    }
    expect(allSums.size).toBe(KNOWN_DISTINCT_SUMS_UNDER_FULL_PERMUTATION);
    expect(SYNTHETIC_IMPACT_DELTAS.reduce((a, b) => a + b, 0)).toBe(CANONICAL_ORDER_SUM);
  });

  it('NEGATIVE CONTROL: a genuine permutation of the same 7 deltas sums to a DIFFERENT float64 value than forward order — proves this fixture can detect the bug the fix closes', () => {
    // A concrete permutation captured from the exhaustive search above and verified (via a
    // standalone Node run) to land on a DIFFERENT one of the 6 distinct float64 sums — most
    // permutations of this particular series happen to COLLIDE onto the same bit pattern as forward
    // order (only 6 distinct sums out of 5040 permutations), so an arbitrary/hand-picked shuffle is
    // NOT reliably a negative control; this exact index order (only the last two elements swapped)
    // is the minimal permutation confirmed to diverge.
    const shuffled = [0, 1, 2, 3, 4, 6, 5].map((i) => SYNTHETIC_IMPACT_DELTAS[i]);
    expect(shuffled).not.toEqual(SYNTHETIC_IMPACT_DELTAS); // fixture sanity
    const shuffledSum = shuffled.reduce((a, b) => a + b, 0);
    expect(shuffledSum).not.toBe(CANONICAL_ORDER_SUM);
  });
});

// ---------------------------------------------------------------------------
// (1)+(2) sortByCreatedAtThenId — order-independent canonical base order
// ---------------------------------------------------------------------------

interface FakeRow {
  id: string;
  created_at: string;
  tag: string;
}

function makeRows(): FakeRow[] {
  return [
    { id: 'row-b', created_at: '2026-08-01T10:00:00.000Z', tag: 'second' },
    { id: 'row-a', created_at: '2026-08-01T09:00:00.000Z', tag: 'first' },
    { id: 'row-d', created_at: '2026-08-01T09:00:00.000Z', tag: 'first-tiebreak-b' }, // same created_at as row-a, id tiebreak
    { id: 'row-c', created_at: '2026-08-01T11:00:00.000Z', tag: 'third' },
  ];
}

/** Deterministic pseudo-shuffle, no Math.random() dependency — same technique as kpiHashOrderDeterminism.test.ts. */
function shuffled<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = (i * 7 + 3) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

describe('predictionComputeService.sortByCreatedAtThenId — canonical, order-independent base order', () => {
  it('NEGATIVE CONTROL: the raw (unsorted) array order is arbitrary — proves this fixture is a genuine reorder, not a no-op', () => {
    const rows = makeRows();
    const rowsShuffled = shuffled(rows);
    expect(rowsShuffled.map((r) => r.id)).not.toEqual(rows.map((r) => r.id));
  });

  it('sorts by (created_at, id) regardless of input order — any permutation of the same rows yields the identical output array', () => {
    const rows = makeRows();
    const a = sortByCreatedAtThenId(rows);
    const b = sortByCreatedAtThenId(shuffled(rows));
    const c = sortByCreatedAtThenId(shuffled(shuffled(rows)));
    expect(a.map((r) => r.id)).toEqual(['row-a', 'row-d', 'row-b', 'row-c']); // row-a before row-d: same created_at, 'row-a' < 'row-d'
    expect(b.map((r) => r.id)).toEqual(a.map((r) => r.id));
    expect(c.map((r) => r.id)).toEqual(a.map((r) => r.id));
  });

  it('does NOT mutate its input array (financingRows/impactChainRows stay in SQL-return order for any other consumer)', () => {
    const rows = makeRows();
    const originalOrder = rows.map((r) => r.id);
    sortByCreatedAtThenId(rows);
    expect(rows.map((r) => r.id)).toEqual(originalOrder);
  });
});

// ---------------------------------------------------------------------------
// (3) financing overlay — DEC-FIN-012 processing-order policy: repayments before drawdowns
// ---------------------------------------------------------------------------

interface FakeFinancingEvent {
  id: string;
  created_at: string;
  financing_kind: FinancingKind;
  amount: number;
}

/** Replicates ONLY the `facilityDebtBalance` floor-clamp recurrence from
 *  `runOverlayCompute`'s financing-overlay loop (`predictionComputeService.ts`) — the minimal
 *  extract needed to prove the policy decision changes the BUSINESS RESULT, not the whole engine. */
function replayFacilityDebtBalance(events: readonly FakeFinancingEvent[], openingBalance: number): number {
  let balance = openingBalance;
  for (const e of events) {
    if (e.financing_kind === 'FACILITY_DRAWDOWN') balance += e.amount;
    else if (e.financing_kind === 'DISCRETIONARY_REPAYMENT') balance = Math.max(0, balance - e.amount);
  }
  return balance;
}

describe('predictionComputeService — financing overlay processing-order policy (DEC-FIN-012)', () => {
  it('NEGATIVE CONTROL: applying a same-period drawdown before vs. after a repayment gives a DIFFERENT ending facility balance — proves this is a genuine business-result risk, not just float rounding', () => {
    const drawdownFirst: FakeFinancingEvent[] = [
      { id: 'fin-drawdown', created_at: '2026-08-01T00:00:00.000Z', financing_kind: 'FACILITY_DRAWDOWN', amount: 100 },
      { id: 'fin-repay', created_at: '2026-08-01T00:00:01.000Z', financing_kind: 'DISCRETIONARY_REPAYMENT', amount: 50 },
    ];
    const repayFirst = [...drawdownFirst].reverse();

    const endingDrawdownFirst = replayFacilityDebtBalance(drawdownFirst, 0);
    const endingRepayFirst = replayFacilityDebtBalance(repayFirst, 0);

    expect(endingDrawdownFirst).toBe(50); // 0+100=100, max(0,100-50)=50
    expect(endingRepayFirst).toBe(100); // max(0,0-50)=0, 0+100=100
    expect(endingDrawdownFirst).not.toBe(endingRepayFirst);
  });

  it('orderFinancingEventsForPeriod always applies DISCRETIONARY_REPAYMENT before FACILITY_DRAWDOWN, regardless of input order — this IS the DEC-FIN-012 policy', () => {
    const rawOrder: FakeFinancingEvent[] = [
      { id: 'fin-drawdown', created_at: '2026-08-01T00:00:00.000Z', financing_kind: 'FACILITY_DRAWDOWN', amount: 100 },
      { id: 'fin-repay', created_at: '2026-08-01T00:00:01.000Z', financing_kind: 'DISCRETIONARY_REPAYMENT', amount: 50 },
    ];
    const ordered = orderFinancingEventsForPeriod(rawOrder);
    expect(ordered.map((e) => e.financing_kind)).toEqual(['DISCRETIONARY_REPAYMENT', 'FACILITY_DRAWDOWN']);
    expect(replayFacilityDebtBalance(ordered, 0)).toBe(100); // matches "repayFirst" above — the policy this fix enforces

    const reversedRawOrder = [...rawOrder].reverse();
    const orderedFromReversed = orderFinancingEventsForPeriod(reversedRawOrder);
    expect(orderedFromReversed.map((e) => e.financing_kind)).toEqual(['DISCRETIONARY_REPAYMENT', 'FACILITY_DRAWDOWN']);
    expect(replayFacilityDebtBalance(orderedFromReversed, 0)).toBe(100);
  });

  it('is a total order over every financing_kind (FINANCING_KIND_PROCESSING_RANK has one distinct rank per kind)', () => {
    const kinds = Object.keys(FINANCING_KIND_PROCESSING_RANK) as FinancingKind[];
    const ranks = kinds.map((k) => FINANCING_KIND_PROCESSING_RANK[k]);
    expect(new Set(ranks).size).toBe(kinds.length); // no ties across kinds — every kind has its own rank
    expect(FINANCING_KIND_PROCESSING_RANK.DISCRETIONARY_REPAYMENT).toBeLessThan(FINANCING_KIND_PROCESSING_RANK.FACILITY_DRAWDOWN);
  });

  it('for commutative kinds (no floor clamp), processing order does not change the additive result — only the total order needs to be FIXED, not any particular order', () => {
    const events: FakeFinancingEvent[] = [
      { id: 'fin-1', created_at: '2026-08-01T00:00:00.000Z', financing_kind: 'EQUITY_INJECTION', amount: 30 },
      { id: 'fin-2', created_at: '2026-08-01T00:00:01.000Z', financing_kind: 'SHARE_BUYBACK', amount: 10 },
      { id: 'fin-3', created_at: '2026-08-01T00:00:02.000Z', financing_kind: 'DIVIDEND_DECLARATION', amount: 5 },
    ];
    const sumAdjustment = (ordered: readonly FakeFinancingEvent[]): number => {
      let equityAdj = 0;
      let dividend = 0;
      for (const e of ordered) {
        if (e.financing_kind === 'EQUITY_INJECTION') equityAdj += e.amount;
        else if (e.financing_kind === 'SHARE_BUYBACK') equityAdj -= e.amount;
        else if (e.financing_kind === 'DIVIDEND_DECLARATION') dividend += e.amount;
      }
      return equityAdj + dividend;
    };
    const orderedForward = orderFinancingEventsForPeriod(events);
    const orderedFromReversed = orderFinancingEventsForPeriod([...events].reverse());
    expect(sumAdjustment(orderedForward)).toBe(sumAdjustment(orderedFromReversed));
    expect(sumAdjustment(orderedForward)).toBe(30 - 10 + 5);
  });
});
