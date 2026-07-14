/**
 * M14/F3 — per-initiative tolerances (PRINCE2 manage-by-exception), pure.
 *
 * Replaces hard-coded thresholds (e.g. "overdue > 7 days = critical") with
 * tolerance bands that can vary per initiative. An exception is raised only when
 * a dimension breaches its tolerance — the core of management-by-exception. The
 * loading of per-initiative overrides is a follow-up; this is the resolution +
 * breach-evaluation core, fully unit-tested.
 */

export interface Tolerances {
  /** schedule slip allowed before exception, in days. */
  scheduleDays: number;
  /** cost overrun allowed before exception, as a fraction (0.10 = 10%). */
  costPct: number;
  /** scope-change items allowed before exception. */
  scopeItems: number;
  /** open high risks allowed before exception. */
  riskCount: number;
  /** decision latency allowed before exception, in days. */
  decisionDays: number;
}

export const DEFAULT_TOLERANCES: Tolerances = {
  scheduleDays: 7,
  costPct: 0.1,
  scopeItems: 2,
  riskCount: 3,
  decisionDays: 7,
};

/** Merge per-initiative overrides over the org/default tolerances. */
export function resolveTolerances(overrides?: Partial<Tolerances> | null): Tolerances {
  if (!overrides) return { ...DEFAULT_TOLERANCES };
  const pick = (k: keyof Tolerances): number => {
    const v = overrides[k];
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : DEFAULT_TOLERANCES[k];
  };
  return {
    scheduleDays: pick('scheduleDays'),
    costPct: pick('costPct'),
    scopeItems: pick('scopeItems'),
    riskCount: pick('riskCount'),
    decisionDays: pick('decisionDays'),
  };
}

export type ToleranceDimension = keyof Tolerances;

export interface ToleranceBreach {
  dimension: ToleranceDimension;
  actual: number;
  tolerance: number;
}

export interface ToleranceEvalInputs {
  slipDays?: number | null;
  /** cost overrun as a fraction (actual-planned)/planned. */
  costOverrunPct?: number | null;
  scopeChangeItems?: number | null;
  openHighRisks?: number | null;
  decisionLatencyDays?: number | null;
}

/**
 * Evaluate which dimensions have breached tolerance. An empty list = "within
 * tolerance, no exception" (manager-by-exception: nothing to surface).
 */
export function evaluateToleranceBreaches(
  inputs: ToleranceEvalInputs,
  tolerances: Tolerances = DEFAULT_TOLERANCES
): ToleranceBreach[] {
  const breaches: ToleranceBreach[] = [];
  const check = (dim: ToleranceDimension, actual: number | null | undefined, tol: number): void => {
    if (actual != null && actual > tol) breaches.push({ dimension: dim, actual, tolerance: tol });
  };
  check('scheduleDays', inputs.slipDays, tolerances.scheduleDays);
  check('costPct', inputs.costOverrunPct, tolerances.costPct);
  check('scopeItems', inputs.scopeChangeItems, tolerances.scopeItems);
  check('riskCount', inputs.openHighRisks, tolerances.riskCount);
  check('decisionDays', inputs.decisionLatencyDays, tolerances.decisionDays);
  return breaches;
}

/** True when at least one dimension breached tolerance (an exception). */
export function isException(
  inputs: ToleranceEvalInputs,
  tolerances: Tolerances = DEFAULT_TOLERANCES
): boolean {
  return evaluateToleranceBreaches(inputs, tolerances).length > 0;
}
