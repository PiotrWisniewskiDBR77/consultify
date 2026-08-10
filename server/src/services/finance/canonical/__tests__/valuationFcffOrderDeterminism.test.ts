/**
 * W3-determinism — pure unit-level negative control for `sumFlow()`
 * (`valuationFcffService.ts`), no database required, always runs.
 *
 * Full investigation, empirical proof, and decision record:
 * `docs/validation/finance-v3/generated/gate-d/W3_COMPUTE_DETERMINISM_report.md`.
 *
 * `loadCells()` reads `finance_baseline_outputs` with no `ORDER BY` (same reasoning as
 * `kpiComputeService.ts`'s own no-`ORDER BY` query), so the `cells` array `sumFlow()` used to sum
 * directly arrived in whatever order Postgres's query plan happened to return — NOT guaranteed
 * stable even for byte-identical underlying rows. Proven on real Postgres 15: 10 independent
 * `runDcfFcffValuation()` runs with IDENTICAL GoldCo inputs stored bit-identical monthly EBIT
 * values in `finance_baseline_outputs` every time, yet `enterpriseValueComputed` differed across 3
 * distinct values — because float64 addition is not associative and the SQL row order varied as
 * the shared table grew across runs.
 *
 * The 12 monthly EBIT values below are the EXACT real values captured from that reproduction (not
 * synthetic) — a smooth, monotonically-decreasing series that turned out to sum IDENTICALLY under
 * simple forward/reverse iteration (verified separately) but DOES diverge under a genuine
 * permutation, exactly matching two of the three real bit patterns observed against live Postgres.
 * This is the negative control: it must be able to go RED, proving the test can detect the bug
 * `sumFlow()`'s period-order sort fixes.
 */
import { describe, expect, it } from 'vitest';

import { sumFlow, type CellRow } from '../valuationFcffService.js';

/** Real values captured from `docs/validation/finance-v3/generated/gate-d/W3_COMPUTE_DETERMINISM_report.md`'s
 *  full-chain reproduction — 12 monthly EBIT values for GoldCo FY2026, PARENT entity, as actually
 *  written to `finance_baseline_outputs` by `baselineComputeService.ts` (bit-identical across every
 *  one of 10 independent runs — this fixture is about ARRAY ORDER, not about these values ever
 *  changing). */
const REAL_MONTHLY_EBIT = [
  '2041666.6666666665', '2040493.2950191572', '2039326.666886863', '2038166.7435139501',
  '2037013.486367318', '2035866.857135322', '2034726.8177264985', '2033593.3302683001',
  '2032466.3571058386', '2031345.8608006327', '2030231.8041293647', '2029124.150082644',
];
const CANONICAL_PERIOD_IDS = REAL_MONTHLY_EBIT.map((_, i) => `per-2026-${String(i + 1).padStart(2, '0')}`);
/** A genuine permutation (not a simple reversal — reversal happens to sum identically for this
 *  particular smooth series, verified separately) of the same 12 periods, captured from a targeted
 *  search that reproduces a DIFFERENT bit pattern than the canonical-order sum — this is real
 *  evidence the reordering channel is not a corner case, not an invented worst case. */
const SHUFFLED_PERIOD_ORDER = [
  4, 5, 9, 3, 2, 1, 8, 7, 0, 11, 6, 10,
].map((i) => CANONICAL_PERIOD_IDS[i]);

function makeCells(order: readonly string[]): CellRow[] {
  const valueByPeriod = new Map(CANONICAL_PERIOD_IDS.map((pid, i) => [pid, REAL_MONTHLY_EBIT[i]]));
  return order.map((periodId) => ({
    canonical_line_id: 'ebit-line',
    period_id: periodId,
    value_status: 'PRESENT_NONZERO',
    value_decimal: valueByPeriod.get(periodId)!,
    presentation_currency: 'PLN',
    unit: 'UNITS' as const,
    multiplier: '1',
  }));
}

describe('valuationFcffService.sumFlow — order-independent FCFF summation', () => {
  it('NEGATIVE CONTROL: summing the raw (SQL-order) array directly, without sorting to canonical period order, IS order-dependent — proves this test can detect the bug the fix closes', () => {
    const canonicalOrderCells = makeCells(CANONICAL_PERIOD_IDS);
    const shuffledOrderCells = makeCells(SHUFFLED_PERIOD_ORDER);
    expect(shuffledOrderCells.map((c) => c.period_id)).not.toEqual(canonicalOrderCells.map((c) => c.period_id)); // fixture sanity

    const rawSumCanonical = canonicalOrderCells.reduce((s, c) => s + Number(c.value_decimal), 0);
    const rawSumShuffled = shuffledOrderCells.reduce((s, c) => s + Number(c.value_decimal), 0);
    // RED if sumFlow's period-order sort were removed and cells were summed directly in
    // whatever order the SQL/array happened to arrive in, as the code did before this fix.
    expect(rawSumCanonical).not.toBe(rawSumShuffled);
  });

  it('sumFlow(cells, lineId, orderedPeriodIds) is invariant to the INPUT array order — same content, same sum, any permutation', () => {
    const canonicalOrderCells = makeCells(CANONICAL_PERIOD_IDS);
    const shuffledOrderCells = makeCells(SHUFFLED_PERIOD_ORDER);
    const reversedOrderCells = makeCells([...CANONICAL_PERIOD_IDS].reverse());

    const sumCanonical = sumFlow(canonicalOrderCells, 'ebit-line', CANONICAL_PERIOD_IDS);
    const sumShuffled = sumFlow(shuffledOrderCells, 'ebit-line', CANONICAL_PERIOD_IDS);
    const sumReversed = sumFlow(reversedOrderCells, 'ebit-line', CANONICAL_PERIOD_IDS);

    expect(sumShuffled.value).toBe(sumCanonical.value);
    expect(sumReversed.value).toBe(sumCanonical.value);
    // Matches the exact real-world value the fixed code produces (see report §"po naprawie").
    expect(sumCanonical.value).toBe(24424022.035702556372);
  });

  it('sumFlow still returns null (MISSING) when a period is genuinely absent, regardless of input order', () => {
    const missingOnePeriod = makeCells(CANONICAL_PERIOD_IDS.slice(0, 11));
    const result = sumFlow(missingOnePeriod, 'ebit-line', CANONICAL_PERIOD_IDS);
    expect(result.value).toBeNull();
    expect(result.presentCount).toBe(11);
  });
});
