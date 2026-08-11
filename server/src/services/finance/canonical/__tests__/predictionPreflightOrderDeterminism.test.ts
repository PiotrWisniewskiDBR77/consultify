/**
 * PKG-A determinism — pure unit-level negative controls for `predictionPreflightService.ts`
 * (`docs/validation/finance-v3/generated/gate-e/PKG_A_DETERMINISM_report.md`), no database
 * required, always runs. Same pattern as `kpiHashOrderDeterminism.test.ts`.
 *
 * Two sites found by this audit (NOT part of the three known-unfixed sites in
 * `predictionComputeService.ts` this package was scoped to start from — found by extending the
 * audit to every query feeding a `content_semantic_hash`-class value, per the audit's own scope):
 *   1. `assumption_set_semantic_hash` — hashed from `driverOverrideRows`/`impactChainRows`, both read
 *      with no `ORDER BY`. `buildAssumptionSetSemanticHash()` sorts a copy of each by `id` first.
 *   2. `layer2Combined` — summed from `overlap.sources`, itself `finance_prediction_detect_overlaps()`'s
 *      own `jsonb_agg(...)` with no `ORDER BY` inside the aggregate (frozen migration, not edited by
 *      this fix). `sortOverlapSourcesById()` sorts a copy by `source_id` first.
 */
import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { buildAssumptionSetSemanticHash, sortOverlapSourcesById } from '../predictionPreflightService.js';

/** Deterministic pseudo-shuffle, no Math.random() dependency — same technique as kpiHashOrderDeterminism.test.ts. */
function shuffled<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = (i * 7 + 3) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// (1) buildAssumptionSetSemanticHash
// ---------------------------------------------------------------------------

function makeDriverOverrides() {
  return [
    { id: 'do-3', schedule_type: 'revenue_pvm', driver_code: 'REVENUE_GROWTH_YOY', entity_id: 'ent-1', period_id: 'per-2026-03', value_decimal: '0.05' },
    { id: 'do-1', schedule_type: 'cogs_opex', driver_code: 'COGS_PCT_OF_REVENUE', entity_id: 'ent-1', period_id: 'per-2026-01', value_decimal: '0.42' },
    { id: 'do-2', schedule_type: 'capex_depreciation', driver_code: 'CAPEX_PCT_OF_REVENUE', entity_id: 'ent-1', period_id: 'per-2026-02', value_decimal: '0.08' },
  ];
}
function makeImpactChain() {
  return [
    { id: 'ic-2', statement_line_id: 'line-cogs', amount_kind: 'ABSOLUTE_AMOUNT' as const, amount_decimal: '5000', sign: 'NEGATIVE' as const, start_period_id: 'per-2026-02' },
    { id: 'ic-1', statement_line_id: 'line-revenue', amount_kind: 'ABSOLUTE_AMOUNT' as const, amount_decimal: '10000', sign: 'POSITIVE' as const, start_period_id: 'per-2026-01' },
  ];
}

describe('predictionPreflightService.buildAssumptionSetSemanticHash — order-independent assumption_set_semantic_hash', () => {
  it('NEGATIVE CONTROL: hashing raw (SQL-order) arrays directly IS order-dependent — proves this fixture can detect the bug the fix closes', () => {
    const driverA = makeDriverOverrides();
    const driverB = shuffled(driverA);
    const impactA = makeImpactChain();
    const impactB = shuffled(impactA);
    expect(driverB.map((r) => r.id)).not.toEqual(driverA.map((r) => r.id)); // fixture sanity
    expect(impactB.map((r) => r.id)).not.toEqual(impactA.map((r) => r.id));

    const legacyHashA = createHash('sha256').update(JSON.stringify({ driverOverrides: driverA, impactChain: impactA })).digest('hex');
    const legacyHashB = createHash('sha256').update(JSON.stringify({ driverOverrides: driverB, impactChain: impactB })).digest('hex');
    // RED if buildAssumptionSetSemanticHash's sort were removed and the raw SQL-order arrays were
    // hashed directly, as the code did before this fix.
    expect(legacyHashA).not.toBe(legacyHashB);
  });

  it('buildAssumptionSetSemanticHash is invariant to input array order — same content, same hash, any permutation of either array', () => {
    const driverA = makeDriverOverrides();
    const impactA = makeImpactChain();
    const hashA = buildAssumptionSetSemanticHash(driverA, impactA);
    const hashB = buildAssumptionSetSemanticHash(shuffled(driverA), shuffled(impactA));
    const hashC = buildAssumptionSetSemanticHash(shuffled(shuffled(driverA)), shuffled(shuffled(impactA)));
    expect(hashB).toBe(hashA);
    expect(hashC).toBe(hashA);
  });

  it('does NOT mutate its input arrays', () => {
    const driverA = makeDriverOverrides();
    const impactA = makeImpactChain();
    const driverOrder = driverA.map((r) => r.id);
    const impactOrder = impactA.map((r) => r.id);
    buildAssumptionSetSemanticHash(driverA, impactA);
    expect(driverA.map((r) => r.id)).toEqual(driverOrder);
    expect(impactA.map((r) => r.id)).toEqual(impactOrder);
  });

  it('DOES change the hash when a value genuinely changes (not a false-positive-proof no-op)', () => {
    const driverA = makeDriverOverrides();
    const impactA = makeImpactChain();
    const hashA = buildAssumptionSetSemanticHash(driverA, impactA);
    const driverChanged = driverA.map((r) => (r.id === 'do-1' ? { ...r, value_decimal: '0.99' } : r));
    const hashChanged = buildAssumptionSetSemanticHash(driverChanged, impactA);
    expect(hashChanged).not.toBe(hashA);
  });
});

// ---------------------------------------------------------------------------
// (2) sortOverlapSourcesById + layer2Combined summation
// ---------------------------------------------------------------------------

interface FakeSource {
  source_type: 'DRIVER_OVERRIDE' | 'INITIATIVE_IMPACT' | 'FINANCING';
  source_id: string;
  estimated_delta: number;
}

/** Same 7 synthetic-but-permutation-verified delta values used in
 *  `predictionOverlayOrderDeterminism.test.ts` (see that file's own comment on why these are
 *  synthetic — Finance v3 has zero rows on any live database at audit time), reused here as
 *  `estimated_delta` stand-ins to demonstrate the identical mechanism for `overlap.sources`. */
const SOURCES: FakeSource[] = [
  { source_type: 'DRIVER_OVERRIDE', source_id: 'src-4', estimated_delta: 12345.678912345 },
  { source_type: 'INITIATIVE_IMPACT', source_id: 'src-7', estimated_delta: -8734.291823741 },
  { source_type: 'DRIVER_OVERRIDE', source_id: 'src-1', estimated_delta: 45231.128374652 },
  { source_type: 'FINANCING', source_id: 'src-6', estimated_delta: -19283.746192837 },
  { source_type: 'INITIATIVE_IMPACT', source_id: 'src-2', estimated_delta: 7654.321987654 },
  { source_type: 'DRIVER_OVERRIDE', source_id: 'src-5', estimated_delta: -3456.789123456 },
  { source_type: 'FINANCING', source_id: 'src-3', estimated_delta: 28193.746281937 },
];

describe('predictionPreflightService.sortOverlapSourcesById — order-independent layer2Combined', () => {
  it('NEGATIVE CONTROL: summing overlap.sources in raw (jsonb_agg-order) sequence IS order-dependent', () => {
    // Same underlying 7 values as predictionOverlayOrderDeterminism.test.ts's permutation-calculus
    // fixture — only 6 of 5040 permutations are distinct float64 sums, so (as documented there) an
    // arbitrary shuffle is not reliably a negative control; this exact reorder (last two elements
    // swapped) is verified to diverge from forward order.
    const reordered = [0, 1, 2, 3, 4, 6, 5].map((i) => SOURCES[i]);
    const rawOrderSum = SOURCES.reduce((a, s) => a + s.estimated_delta, 0);
    const reorderedSum = reordered.reduce((a, s) => a + s.estimated_delta, 0);
    expect(reordered.map((s) => s.source_id)).not.toEqual(SOURCES.map((s) => s.source_id)); // fixture sanity
    expect(rawOrderSum).not.toBe(reorderedSum);
  });

  it('sortOverlapSourcesById(sources) is invariant to input order, and the resulting sum is stable across permutations', () => {
    const a = sortOverlapSourcesById(SOURCES);
    const b = sortOverlapSourcesById(shuffled(SOURCES));
    const c = sortOverlapSourcesById(shuffled(shuffled(SOURCES)));
    expect(a.map((s) => s.source_id)).toEqual(['src-1', 'src-2', 'src-3', 'src-4', 'src-5', 'src-6', 'src-7']);
    expect(b.map((s) => s.source_id)).toEqual(a.map((s) => s.source_id));
    expect(c.map((s) => s.source_id)).toEqual(a.map((s) => s.source_id));

    const sumA = a.reduce((acc, s) => acc + s.estimated_delta, 0);
    const sumB = b.reduce((acc, s) => acc + s.estimated_delta, 0);
    const sumC = c.reduce((acc, s) => acc + s.estimated_delta, 0);
    expect(sumB).toBe(sumA);
    expect(sumC).toBe(sumA);
  });

  it('does NOT mutate its input array', () => {
    const originalOrder = SOURCES.map((s) => s.source_id);
    sortOverlapSourcesById(SOURCES);
    expect(SOURCES.map((s) => s.source_id)).toEqual(originalOrder);
  });
});
