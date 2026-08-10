/**
 * FC-11 REGRESSION CEILINGS for `perfSlo.pg.test.ts`.
 *
 * These are CI drift-detection thresholds, NOT a declared production SLO.
 * A production SLO (gate FC-11's "declared p50/p95/p99") remains
 * EVIDENCE_MISSING — see
 * `docs/validation/finance-v3/generated/gate-d/W2_FC11_SLO_report.md` for the
 * full derivation, the raw measurement runs this file is built from (two
 * independent own n=20 runs plus two cited W9 runs), and why a production
 * number cannot be honestly declared from measurements taken on a laptop
 * with unpredictable, heavily contended CPU (other agents' Postgres
 * clusters running concurrently; observed load average up to ~170 on a
 * 16-core machine during this work).
 *
 * WHY A MULTIPLIER OF EACH PATH'S OWN OBSERVED p95, NOT A FLAT NUMBER:
 * The same compute path measured the same way, on the same (idle-as-it-gets)
 * machine, in two back-to-back n=20 runs, produced p50s that differed by up
 * to ~9.3x (D1: 1368ms vs 147ms) purely from machine contention — no code
 * changed between the runs. A regression ceiling has to clear that noise
 * floor or every CI run becomes a coin flip. It also has to stay well under
 * "100x must fail, 20% drift may pass" (the ORIGINAL, un-derived sanity
 * ceiling this replaces was a flat 30s for every path) or it stops being a
 * regression gate at all.
 *
 * DERIVATION (see report §6 for the full table):
 *   observedMaxP95Ms = the largest p95 seen for that path across ALL known
 *     isolated n>=12 samples: two own n=20 runs (this package) + the two
 *     cited W9 runs (n=20, n=12) from
 *     `W9_FAULT_CONCURRENCY_TENANT_MATRIX_report.md` §5. The confounded
 *     "whole finance/canonical directory" run (30 other test files sharing
 *     the same Postgres connection pool) is EXCLUDED from this derivation —
 *     it is not an isolated perf-path sample — but its p95s were 3-16x
 *     higher still and are reported as a separate, worse-case data point.
 *   multiplier = 5. Neither of the two own n=20 runs, nor either cited W9
 *     run, comes anywhere close to tripping ceiling = observedMaxP95Ms * 5
 *     (see report §6/§7) — so 5x safely clears the noise actually observed.
 *     The negative control in the report (§7) confirms the gate is not the
 *     "have to slow the code down 10x to trip" failure mode the brief
 *     warned against: an injected delay on the same order as the ceiling
 *     itself is enough to turn the test red.
 *   ceilingMs = ceil(observedMaxP95Ms * multiplier) rounded UP to the
 *     nearest 50ms, for a round, auditable number.
 */

export interface PerfPathThreshold {
  /** Largest p95 (ms) observed for this path across all known isolated n>=12 runs (own + cited), pre-multiplier. */
  readonly observedMaxP95Ms: number;
  /** Safety multiplier applied to observedMaxP95Ms to absorb this machine's measured run-to-run noise. */
  readonly multiplier: number;
  /** Regression ceiling in ms. Assertion is `p95Ms < ceilingMs`. */
  readonly ceilingMs: number;
  /** One line describing where observedMaxP95Ms came from, for error messages and audits. */
  readonly basis: string;
}

function threshold(observedMaxP95Ms: number, multiplier: number, basis: string): PerfPathThreshold {
  const ceilingMs = Math.ceil((observedMaxP95Ms * multiplier) / 50) * 50;
  return { observedMaxP95Ms, multiplier, ceilingMs, basis };
}

/**
 * Regression ceilings, keyed by compute path. NOT a production SLO — see
 * file header and the W2 FC-11 report.
 */
export const PERF_REGRESSION_THRESHOLDS = {
  D1_BASELINE: threshold(
    1824.08,
    5,
    'max p95 across own run#1 n=20 (1824.08ms), own run#2 n=20 (391.1ms), cited W9 n=20 (336.8ms), cited W9 n=12 (867.7ms)'
  ),
  D2_KPI: threshold(
    140.23,
    5,
    'max p95 across own run#1 n=20 (140.23ms), own run#2 n=20 (25.88ms), cited W9 n=20 (26.4ms), cited W9 n=12 (46.9ms)'
  ),
  D3A_VALUATION_DCF: threshold(
    202.0,
    5,
    'max p95 across own run#1 n=20 (113.29ms), own run#2 n=20 (115.58ms), cited W9 n=20 (155.2ms), cited W9 n=12 (202.0ms)'
  ),
  D3B_SENSITIVITY_GRID: threshold(
    81.3,
    5,
    'max p95 across own run#1 n=20 (64.96ms), own run#2 n=20 (80.5ms), cited W9 n=20 (81.3ms), cited W9 n=12 (49.1ms)'
  ),
  D3_VALUATION_WITH_GRID: threshold(
    215.5,
    5,
    'max p95 across own run#1 n=20 (169.67ms), own run#2 n=20 (151.29ms), cited W9 n=20 (204.7ms), cited W9 n=12 (215.5ms)'
  ),
} as const satisfies Record<string, PerfPathThreshold>;
