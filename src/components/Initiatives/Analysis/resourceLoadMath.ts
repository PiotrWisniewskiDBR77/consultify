/**
 * resourceLoadMath — pure, unit-testable portfolio resource-load aggregation.
 *
 * HARVARD #90 (P7 #71 · audyt UI-T11): the Analysis › Resources view reported
 * "4500% Overallocated" because utilization was computed as
 *
 *     utilizationPercent = ownedInitiativeCount * 100
 *
 * i.e. every initiative a person *owns* was booked as a full 100% of their
 * capacity. Owning 45 initiatives → 4500%. That is a broken UNIT: ownership is a
 * concurrency/load signal, NOT a per-initiative FTE booking, and the portfolio
 * carries no per-initiative hours to derive a real FTE% from.
 *
 * Fix: model load as *concurrent active ownership* against a sane capacity of
 * {@link DEFAULT_CONCURRENT_CAPACITY} simultaneously-owned active initiatives
 * (= 100%). Real overload (e.g. 6 active initiatives → 200%) STAYS VISIBLE; the
 * garbage 4500% from the unit error disappears. Terminal / not-yet-active
 * statuses are excluded from the active load so DRAFT and CANCELLED work does not
 * inflate a person's utilization.
 *
 * Pure: inputs in → numbers out, no React, no I/O. Tested in
 * tests/unit/initiatives/resourceLoadMath.test.ts.
 */

/**
 * How many simultaneously-owned ACTIVE initiatives count as a full workload
 * (100% utilization). Owning this many active initiatives at once is the point
 * at which a single owner is considered fully loaded. Chosen to match the PMO
 * capacity signal (server: pmo/initiatives.routes.ts flags amber at 3+ active).
 */
export const DEFAULT_CONCURRENT_CAPACITY = 3;

/**
 * Hard ceiling on the utilization NUMBER we surface, so a pathological portfolio
 * (someone nominally owning dozens of initiatives) renders as ">= 400%" rather
 * than an absurd 4-digit figure. This caps the *label*, not the *classification*
 * — an owner past this ceiling is still flagged `overallocated`. 400% = 4× a full
 * load, which is already unambiguous overload.
 */
export const UTILIZATION_DISPLAY_CAP = 400;

export type ResourceLoadStatus = 'ok' | 'overallocated' | 'underutilized';

/** Statuses that DO NOT count toward a person's active concurrent load. */
const NON_ACTIVE_LOAD_STATUSES = new Set<string>([
  'DRAFT',
  'PENDING_REVIEW',
  'DONE',
  'TRACKING',
  'CANCELLED',
  'ARCHIVED',
]);

/**
 * Whether an initiative status contributes to a person's *active* concurrent
 * load. Everything that is neither terminal nor a pre-active source draft counts
 * (REVIEW/PROMOTED/PLANNING/APPROVED/SCHEDULED/EXECUTING/BLOCKED …). Unknown /
 * empty statuses are treated as active so real work is never silently dropped.
 */
export function isActiveLoadStatus(status: string | null | undefined): boolean {
  const s = String(status || '')
    .trim()
    .toUpperCase();
  if (!s) return true;
  return !NON_ACTIVE_LOAD_STATUSES.has(s);
}

/**
 * Compute a bounded, unit-consistent utilization percentage from the number of
 * ACTIVE initiatives a person concurrently owns.
 *
 *   activeCount = 0                      → 0
 *   activeCount = capacity               → 100
 *   activeCount = 2 × capacity           → 200 (real overload, stays visible)
 *   activeCount ≥ cap/100 × capacity     → UTILIZATION_DISPLAY_CAP (label ceiling)
 *
 * Guards: capacity ≤ 0 is coerced to 1 (never divide by zero); negative counts
 * clamp to 0. Result is rounded to an integer percent.
 */
export function computeUtilizationPercent(
  activeCount: number,
  capacity: number = DEFAULT_CONCURRENT_CAPACITY
): number {
  const safeCapacity = capacity > 0 ? capacity : 1;
  const safeCount = Number.isFinite(activeCount) && activeCount > 0 ? activeCount : 0;
  const raw = Math.round((safeCount / safeCapacity) * 100);
  return Math.min(UTILIZATION_DISPLAY_CAP, raw);
}

/**
 * Classify a utilization percentage. Thresholds preserved from the original view:
 * > 100% overloaded, > 0 and < 50% underutilized, otherwise ok. Because the input
 * is now the bounded {@link computeUtilizationPercent}, 150% still reads as
 * overallocated while the former 4500% artefact can no longer occur.
 */
export function classifyLoad(utilizationPercent: number): ResourceLoadStatus {
  if (utilizationPercent > 100) return 'overallocated';
  if (utilizationPercent > 0 && utilizationPercent < 50) return 'underutilized';
  return 'ok';
}

/** Format a utilization percentage for display (integer percent, locale-aware). */
export function formatUtilizationPercent(utilizationPercent: number, locale?: string): string {
  const value = Number.isFinite(utilizationPercent) ? Math.round(utilizationPercent) : 0;
  return `${value.toLocaleString(locale)}%`;
}
