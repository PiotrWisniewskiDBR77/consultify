/**
 * Efficient Frontier Service — Initiative Portfolio Value vs Risk
 *
 * M16/4.7. Pure, deterministic functions (no I/O, no Math.random).
 *
 * Treats a set of candidate initiatives as a portfolio-selection problem.
 * For an increasing appetite for risk (and budget), we build the portfolios
 * that maximise total value (NPV) while staying under a given per-level risk
 * ceiling, producing an efficient-frontier curve of (risk, value) points.
 *
 * The optimiser is intentionally simplified: a value-density greedy /
 * knapsack-style pass is run per risk level. This is fast, deterministic and
 * good enough to communicate the value-vs-risk trade-off to a user, without
 * pretending to be a full mean-variance optimiser.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FrontierInitiative {
  id: string;
  /** Expected value of the initiative, e.g. NPV. */
  value: number;
  /** Probability-of-failure style risk in [0, 1]. */
  risk: number;
  /** Capital / budget required to undertake the initiative. */
  cost: number;
}

export interface FrontierPoint {
  /** Portfolio-level risk (weighted average of member risks) in [0, 1]. */
  risk: number;
  /** Total portfolio value (sum of member values). */
  value: number;
  /** Initiative ids selected at this point on the frontier. */
  mix: string[];
}

export interface FrontierResult {
  curve: FrontierPoint[];
  /** Frontier point matching the full (all-affordable) selection, if any. */
  current?: FrontierPoint;
  /** Frontier point with the best value-per-unit-risk ratio. */
  optimal: FrontierPoint;
}

export interface PortfolioRiskValue {
  totalValue: number;
  /** Weighted-average portfolio risk in [0, 1]. */
  portfolioRisk: number;
}

/**
 * Optional pairwise correlation matrix keyed by initiative id.
 * `correlation[a]?.[b]` in [-1, 1]. Symmetric; missing entries treated as 0.
 */
export type CorrelationMatrix = Record<string, Record<string, number>>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

function sanitize(initiatives: FrontierInitiative[]): FrontierInitiative[] {
  return (initiatives ?? [])
    .filter((i) => i && typeof i.id === 'string')
    .map((i) => ({
      id: i.id,
      value: Number.isFinite(i.value) ? i.value : 0,
      risk: clamp01(Number.isFinite(i.risk) ? i.risk : 0),
      cost: Number.isFinite(i.cost) && i.cost > 0 ? i.cost : 0,
    }));
}

/**
 * Weighted-average portfolio risk. Weighting is by cost (capital exposure);
 * if no cost information is available it falls back to an equal weighting.
 *
 * When a correlation matrix is supplied, risk is inflated/deflated by the
 * average pairwise correlation between members — positively correlated bets
 * concentrate risk, negatively correlated ones diversify it. This keeps the
 * model simple while still rewarding diversification.
 */
function weightedRisk(members: FrontierInitiative[], correlation?: CorrelationMatrix): number {
  if (members.length === 0) return 0;

  const totalCost = members.reduce((s, m) => s + m.cost, 0);
  const useEqual = totalCost <= 0;
  const weightOf = (m: FrontierInitiative): number =>
    useEqual ? 1 / members.length : m.cost / totalCost;

  const baseRisk = members.reduce((s, m) => s + weightOf(m) * m.risk, 0);

  if (!correlation || members.length < 2) {
    return clamp01(baseRisk);
  }

  // Average off-diagonal pairwise correlation across the portfolio.
  let pairSum = 0;
  let pairCount = 0;
  for (let a = 0; a < members.length; a++) {
    for (let b = a + 1; b < members.length; b++) {
      const ida = members[a].id;
      const idb = members[b].id;
      const c = correlation[ida]?.[idb] ?? correlation[idb]?.[ida] ?? 0;
      pairSum += c;
      pairCount += 1;
    }
  }
  const avgCorr = pairCount > 0 ? pairSum / pairCount : 0;

  // Diversification factor: avgCorr=1 → no benefit, avgCorr=-1 → halve risk.
  const factor = 1 + avgCorr * 0.5 - 0.5; // maps [-1,1] → [0,1]
  return clamp01(baseRisk * clamp01(factor + 0.5));
}

/**
 * Greedy knapsack: pick highest value-per-cost initiatives that fit the budget
 * AND keep the portfolio's weighted risk at or below `riskCeiling`.
 * Deterministic ordering (value-density desc, then id asc).
 */
function selectAtRiskLevel(
  candidates: FrontierInitiative[],
  budget: number,
  riskCeiling: number,
  correlation?: CorrelationMatrix
): FrontierInitiative[] {
  const ordered = [...candidates].sort((a, b) => {
    const da = a.cost > 0 ? a.value / a.cost : a.value;
    const db = b.cost > 0 ? b.value / b.cost : b.value;
    if (db !== da) return db - da;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const chosen: FrontierInitiative[] = [];
  let spent = 0;

  for (const cand of ordered) {
    if (cand.value <= 0) continue;
    const nextCost = spent + cand.cost;
    if (budget > 0 && nextCost > budget) continue;

    const trial = [...chosen, cand];
    if (weightedRisk(trial, correlation) > riskCeiling + 1e-9) continue;

    chosen.push(cand);
    spent = nextCost;
  }

  return chosen;
}

function pointOf(members: FrontierInitiative[], correlation?: CorrelationMatrix): FrontierPoint {
  const value = members.reduce((s, m) => s + m.value, 0);
  const risk = weightedRisk(members, correlation);
  const mix = members.map((m) => m.id).sort();
  return { risk, value, mix };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Build the efficient frontier of initiative portfolios.
 *
 * For `points` evenly spaced risk ceilings between the minimum and maximum
 * achievable risk, run a greedy knapsack to maximise value under both the
 * budget and the risk ceiling. The resulting curve is sorted by risk ascending
 * and is monotonic non-decreasing in value (a higher risk appetite can only
 * unlock more — never less — value, since lower ceilings are a strict subset
 * of allowable selections).
 *
 * @param initiatives candidate pool
 * @param budget total capital available (<= 0 means unconstrained)
 * @param points  number of frontier samples (default 12, min 2)
 * @param correlation optional pairwise correlation matrix
 */
export function frontier(
  initiatives: FrontierInitiative[],
  budget: number,
  points = 12,
  correlation?: CorrelationMatrix
): FrontierResult {
  const pool = sanitize(initiatives).filter((i) => i.value > 0);
  const nPoints = Math.max(2, Math.floor(points));

  if (pool.length === 0) {
    const empty: FrontierPoint = { risk: 0, value: 0, mix: [] };
    return { curve: [empty], optimal: empty };
  }

  const maxRisk = pool.reduce((m, i) => Math.max(m, i.risk), 0);
  const minRisk = pool.reduce((m, i) => Math.min(m, i.risk), 1);

  // Sample risk ceilings from the cheapest single risk up to the max risk.
  const lo = Math.min(minRisk, maxRisk);
  const hi = maxRisk;
  const span = hi - lo;

  const seen = new Map<string, FrontierPoint>();
  for (let k = 0; k < nPoints; k++) {
    const ceiling = nPoints === 1 ? hi : lo + (span * k) / (nPoints - 1);
    const members = selectAtRiskLevel(pool, budget, ceiling, correlation);
    const pt = pointOf(members, correlation);
    const key = pt.mix.join('|');
    const prev = seen.get(key);
    if (!prev || pt.value > prev.value) seen.set(key, pt);
  }

  // Build a monotonic frontier: sort by risk asc, then enforce that value is
  // non-decreasing by carrying the best-so-far selection forward.
  let curve = Array.from(seen.values()).sort((a, b) =>
    a.risk !== b.risk ? a.risk - b.risk : a.value - b.value
  );

  let bestValueSoFar = -Infinity;
  let bestPointSoFar: FrontierPoint | null = null;
  curve = curve.map((pt) => {
    if (pt.value >= bestValueSoFar) {
      bestValueSoFar = pt.value;
      bestPointSoFar = pt;
      return pt;
    }
    // Dominated point: carry the better (lower-risk, higher-value) portfolio.
    return bestPointSoFar
      ? { risk: pt.risk, value: bestPointSoFar.value, mix: bestPointSoFar.mix }
      : pt;
  });

  // optimal = best value-per-risk. Zero-risk portfolios with value win outright.
  let optimal = curve[0];
  let bestRatio = -Infinity;
  for (const pt of curve) {
    const ratio = pt.risk > 1e-9 ? pt.value / pt.risk : pt.value > 0 ? Infinity : 0;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      optimal = pt;
    }
  }

  // current = the full affordable selection (highest risk ceiling).
  const currentMembers = selectAtRiskLevel(pool, budget, hi, correlation);
  const current = currentMembers.length > 0 ? pointOf(currentMembers, correlation) : undefined;

  return { curve, current, optimal };
}

/**
 * Compute total value and weighted-average portfolio risk for an explicit
 * selection of initiative ids.
 *
 * @param selectedIds ids to include in the portfolio
 * @param initiatives the full candidate pool
 * @param correlation optional pairwise correlation matrix
 */
export function portfolioRiskValue(
  selectedIds: string[],
  initiatives: FrontierInitiative[],
  correlation?: CorrelationMatrix
): PortfolioRiskValue {
  const pool = sanitize(initiatives);
  const wanted = new Set(selectedIds ?? []);
  const members = pool.filter((i) => wanted.has(i.id));

  const totalValue = members.reduce((s, m) => s + m.value, 0);
  const portfolioRisk = weightedRisk(members, correlation);

  return { totalValue, portfolioRisk };
}
