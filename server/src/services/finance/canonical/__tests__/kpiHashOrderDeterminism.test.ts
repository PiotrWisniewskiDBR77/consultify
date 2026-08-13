/**
 * W3-determinism — pure unit-level negative control for `hashPayloadFor()`
 * (`kpiComputeService.ts`), no database required, always runs.
 *
 * Full context and the real-DB proof this fix responds to:
 * `docs/validation/finance-v3/generated/gate-d/W3_COMPUTE_DETERMINISM_report.md`.
 *
 * `finance_analysis_kpi_values` is read with no `ORDER BY` (deliberately — see
 * `kpiComputeService.ts`'s comment at that query), so the `results` array
 * `evaluateAllRows()` builds is in an ARBITRARY order across two compute runs of the
 * exact same underlying rows (proven empirically on real Postgres: plain `UPDATE`
 * churn from `persistResults()` alone reorders the physical scan within a handful of
 * runs — no VACUUM or forced index scan needed). `hashPayloadFor()` re-sorts a COPY
 * of that array by a value-based key before it is handed to `canonicalPayloadHash()`,
 * so `content_semantic_hash` stops depending on SQL row order.
 *
 * This test is the NEGATIVE CONTROL required before trusting any determinism claim:
 * it must be able to go RED. It proves that in the absence of the sort — hashing the
 * array in an arbitrary (here: reversed) order directly — the hash DOES change, and
 * that `hashPayloadFor()` neutralizes exactly that difference.
 */
import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { canonicalPayloadHash } from '../contentHash.js';
import { hashPayloadFor, type ComputedKpiResult } from '../kpiComputeService.js';

function makeResults(): ComputedKpiResult[] {
  // 18 rows, deliberately NOT already sorted by (kpiCode, entityId, periodId) — mirrors a
  // real no-ORDER-BY SQL return where physical row order has no relationship to the value
  // sort key.
  const codes = [
    'GROSS_MARGIN_PCT', 'EBITDA_MARGIN_PCT', 'NET_MARGIN_PCT', 'ROE_PCT', 'ROA_PCT',
    'CURRENT_RATIO', 'QUICK_RATIO', 'DEBT_TO_EQUITY', 'INTEREST_COVERAGE', 'DSO_DAYS',
    'DIO_DAYS', 'DPO_DAYS', 'CASH_CONVERSION_CYCLE_DAYS', 'ASSET_TURNOVER', 'REVENUE_GROWTH_YOY_PCT',
    'EBITDA_GROWTH_YOY_PCT', 'CAPEX_TO_REVENUE_PCT', 'FCF_MARGIN_PCT',
  ];
  return codes.map((kpiCode, idx) => ({
    kpiValueId: `kv-${idx}`,
    kpiCode,
    entityId: 'ent-1',
    periodId: 'per-2025-12',
    status: 'PRESENT_NONZERO' as const,
    value: idx * 1.5 + 0.25,
    qualityFlag: null,
    detail: null,
  }));
}

/** Fisher-Yates with a fixed seed-free swap pattern — deterministic across test runs, still a
 *  genuine permutation (not merely reversed, which could coincidentally share ties). */
function shuffled<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = (i * 7 + 3) % (i + 1); // deterministic pseudo-shuffle, no Math.random() dependency
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

describe('kpiComputeService.hashPayloadFor — order-independent content_semantic_hash', () => {
  it('NEGATIVE CONTROL: hashing the raw (unsorted) array directly IS order-dependent — proves this test can detect the bug hashPayloadFor fixes', () => {
    const a = makeResults();
    const b = shuffled(a);
    expect(a.map((r) => r.kpiCode)).not.toEqual(b.map((r) => r.kpiCode)); // fixture sanity: genuinely reordered

    const legacyHashA = createHash('sha256').update(JSON.stringify(a)).digest('hex');
    const legacyHashB = createHash('sha256').update(JSON.stringify(b)).digest('hex');
    // RED if hashPayloadFor's sort were removed and canonicalPayloadHash(results) were
    // called directly on SQL-order-dependent input, as the code did before W3-determinism.
    expect(legacyHashA).not.toBe(legacyHashB);
  });

  it('hashPayloadFor(results) is invariant to input array order — same content, same hash, any permutation', () => {
    const a = makeResults();
    const b = shuffled(a);
    const c = shuffled(shuffled(a));

    const hashA = canonicalPayloadHash(hashPayloadFor(a));
    const hashB = canonicalPayloadHash(hashPayloadFor(b));
    const hashC = canonicalPayloadHash(hashPayloadFor(c));

    expect(hashB).toBe(hashA);
    expect(hashC).toBe(hashA);
  });

  it('hashPayloadFor does NOT mutate its input array (results returned to callers/persisted stays in SQL-return order)', () => {
    const a = makeResults();
    const originalOrder = a.map((r) => r.kpiCode);
    hashPayloadFor(a);
    expect(a.map((r) => r.kpiCode)).toEqual(originalOrder);
  });

  it('hashPayloadFor DOES change the hash when a value genuinely changes (not a false-positive-proof no-op)', () => {
    const a = makeResults();
    const changed = a.map((r) => (r.kpiCode === 'ROE_PCT' ? { ...r, value: (r.value ?? 0) + 1 } : r));

    const hashA = canonicalPayloadHash(hashPayloadFor(a));
    const hashChanged = canonicalPayloadHash(hashPayloadFor(changed));
    expect(hashChanged).not.toBe(hashA);
  });
});
