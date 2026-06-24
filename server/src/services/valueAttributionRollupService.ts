/**
 * Value Attribution Rollup Service (M16/2.4)
 *
 * Pure, deterministic functions that aggregate per-initiative KPI contributions
 * into a portfolio-level "value delivered" figure WITHOUT double-counting overlap.
 *
 * Seam E fix: a naive portfolio rollup sums each initiative's claimed benefit
 * independently. When 3 initiatives move the SAME KPI, their shares are summed
 * over a single, finite KPI delta — so the naive total can exceed what the KPI
 * actually moved. These functions cap the sum of attributed KPI units per KPI at
 * the observed delta (anti-double-count), carry the leftover as
 * `unexplainedRemainder`, and convert the capped, per-initiative KPI units into
 * monetary value via `valuePerKpiUnit`.
 *
 * Mirrors kpiAttributionService semantics: contributionShare ≈ effectiveWeight
 * share, unexplainedRemainder = portion of the KPI delta not explained by mapped
 * initiatives. No DB access, no I/O — safe to unit-test and reuse anywhere.
 */

export interface ValueContribution {
  /** Initiative claiming a share of a KPI's movement. */
  initiativeId: string;
  /** KPI whose delta this contribution draws from. */
  kpiId: string;
  /** Total observed change of the KPI over the period (same units as KPI). */
  kpiDelta: number;
  /** Fraction (0..1) of the KPI delta attributed to this initiative. */
  contributionShare: number;
  /** Monetary value of one KPI unit (e.g. PLN per unit of the KPI). */
  valuePerKpiUnit: number;
}

export interface KpiRollup {
  kpiId: string;
  /** Observed KPI delta for the period. */
  delta: number;
  /** Monetary value attributed across all initiatives for this KPI (capped). */
  attributed: number;
  /** KPI units left unexplained (delta minus capped attributed units), in value. */
  unexplainedRemainder: number;
}

export interface PortfolioRollup {
  /** Sum of attributed value across all KPIs, after anti-double-count capping. */
  totalAttributed: number;
  byKpi: KpiRollup[];
  /**
   * Monetary value that a naive (uncapped) sum would have over-counted, i.e.
   * (naive total) - (capped total). >= 0. The Seam E overlap that we removed.
   */
  doubleCountAvoided: number;
}

export interface InitiativeValue {
  initiativeId: string;
  /** Value really attributed to this initiative after per-KPI capping. */
  attributedValue: number;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Per-KPI capped share: the sum of contributionShare across initiatives on a KPI
 * may exceed 1.0 (each initiative independently over-claims). We scale all shares
 * on that KPI down proportionally so they sum to at most 1.0, then each
 * initiative's attributed KPI units = cappedShare * kpiDelta.
 *
 * Returns, per (initiativeId, kpiId), the capped attributed VALUE for that
 * contribution, plus the capping factor used.
 */
function capContributionsByKpi(contributions: ValueContribution[]): {
  /** Capped value per contribution, index-aligned with `contributions`. */
  cappedValues: number[];
  /** Capped attributed KPI units per contribution. */
  cappedUnits: number[];
  /** Naive (uncapped) value per contribution. */
  naiveValues: number[];
} {
  // Group indices by KPI.
  const byKpi = new Map<string, number[]>();
  contributions.forEach((c, i) => {
    const arr = byKpi.get(c.kpiId);
    if (arr) arr.push(i);
    else byKpi.set(c.kpiId, [i]);
  });

  const cappedValues = new Array<number>(contributions.length).fill(0);
  const cappedUnits = new Array<number>(contributions.length).fill(0);
  const naiveValues = new Array<number>(contributions.length).fill(0);

  for (const indices of byKpi.values()) {
    // Total claimed share for this KPI across all its initiatives.
    let totalShare = 0;
    for (const i of indices) {
      const c = contributions[i];
      totalShare += Math.max(0, c.contributionShare);
    }

    // Scale factor so capped shares sum to <= 1.0 (anti-double-count).
    const scale = totalShare > 1 ? 1 / totalShare : 1;

    for (const i of indices) {
      const c = contributions[i];
      const share = Math.max(0, c.contributionShare);
      const cappedShare = share * scale;
      const units = cappedShare * c.kpiDelta;
      cappedUnits[i] = units;
      cappedValues[i] = units * c.valuePerKpiUnit;
      naiveValues[i] = share * c.kpiDelta * c.valuePerKpiUnit;
    }
  }

  return { cappedValues, cappedUnits, naiveValues };
}

/**
 * Aggregate contributions of many initiatives to KPIs into a portfolio value,
 * capping per-KPI attribution so the summed shares never exceed the KPI delta.
 */
export function rollupPortfolioValue(contributions: ValueContribution[]): PortfolioRollup {
  if (!Array.isArray(contributions) || contributions.length === 0) {
    return { totalAttributed: 0, byKpi: [], doubleCountAvoided: 0 };
  }

  const { cappedValues, cappedUnits, naiveValues } = capContributionsByKpi(contributions);

  // Aggregate per KPI.
  const kpiAgg = new Map<
    string,
    { delta: number; attributedUnits: number; attributedValue: number }
  >();
  contributions.forEach((c, i) => {
    const agg = kpiAgg.get(c.kpiId) || {
      delta: c.kpiDelta,
      attributedUnits: 0,
      attributedValue: 0,
    };
    // kpiDelta is a property of the KPI; keep the first-seen value.
    agg.delta = c.kpiDelta;
    agg.attributedUnits += cappedUnits[i];
    agg.attributedValue += cappedValues[i];
    kpiAgg.set(c.kpiId, agg);
  });

  const byKpi: KpiRollup[] = [];
  let totalAttributed = 0;
  for (const [kpiId, agg] of kpiAgg.entries()) {
    // Per-KPI value-per-unit: derive from the largest contribution's rate so the
    // remainder is expressed in monetary terms consistently. Use the average
    // valuePerKpiUnit weighted by capped units; fall back to first contribution.
    const remainderUnits = agg.delta - agg.attributedUnits;
    const ratePerUnit = derivePerUnitRate(contributions, kpiId);
    const remainderValue = remainderUnits * ratePerUnit;

    byKpi.push({
      kpiId,
      delta: round2(agg.delta),
      attributed: round2(agg.attributedValue),
      unexplainedRemainder: round2(remainderValue),
    });
    totalAttributed += agg.attributedValue;
  }

  const naiveTotal = naiveValues.reduce((s, v) => s + v, 0);
  const doubleCountAvoided = Math.max(0, naiveTotal - totalAttributed);

  return {
    totalAttributed: round2(totalAttributed),
    byKpi,
    doubleCountAvoided: round2(doubleCountAvoided),
  };
}

/**
 * Per-unit monetary rate for a KPI, used to value the unexplained remainder.
 * Weighted average of valuePerKpiUnit across that KPI's contributions
 * (weighted by raw share); falls back to the first contribution's rate.
 */
function derivePerUnitRate(contributions: ValueContribution[], kpiId: string): number {
  let weightSum = 0;
  let rateWeighted = 0;
  let firstRate = 0;
  let seen = false;
  for (const c of contributions) {
    if (c.kpiId !== kpiId) continue;
    if (!seen) {
      firstRate = c.valuePerKpiUnit;
      seen = true;
    }
    const w = Math.max(0, c.contributionShare);
    weightSum += w;
    rateWeighted += w * c.valuePerKpiUnit;
  }
  if (weightSum > 0) return rateWeighted / weightSum;
  return firstRate;
}

/**
 * Value really attributed to each initiative after anti-double-count capping.
 * Sums an initiative's capped per-KPI values across all KPIs it touches.
 */
export function valueByInitiative(contributions: ValueContribution[]): InitiativeValue[] {
  if (!Array.isArray(contributions) || contributions.length === 0) return [];

  const { cappedValues } = capContributionsByKpi(contributions);

  const byInit = new Map<string, number>();
  // Preserve first-seen order of initiatives.
  const order: string[] = [];
  contributions.forEach((c, i) => {
    if (!byInit.has(c.initiativeId)) order.push(c.initiativeId);
    byInit.set(c.initiativeId, (byInit.get(c.initiativeId) || 0) + cappedValues[i]);
  });

  return order.map((initiativeId) => ({
    initiativeId,
    attributedValue: round2(byInit.get(initiativeId) || 0),
  }));
}
