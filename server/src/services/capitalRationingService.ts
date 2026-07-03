/**
 * capitalRationingService — M16/4.4
 *
 * Pure, side-effect-free helpers for capital rationing: deciding which projects
 * to fund under a constrained budget B.
 *
 * Three strategies:
 *  1. profitabilityIndexRank — rank by Profitability Index (bang-for-buck),
 *     accept cumulatively until the budget is exhausted. Fast, classic, but
 *     can be sub-optimal because it greedily fills the budget.
 *  2. knapsack — 0/1 knapsack that maximises Σ NPV subject to Σ cost ≤ budget.
 *     Projects are indivisible. Supports `forced` (must-do) projects that are
 *     always selected. This is the value-maximising answer.
 *  3. frontierByBudget — the efficient frontier: for each candidate budget,
 *     the maximum attainable total NPV. A non-decreasing curve.
 *
 * All inputs are plain objects; nothing here touches the DB or the network.
 */

export interface CapitalProject {
  id: string;
  /** Net Present Value of the project (can be negative). */
  npv: number;
  /** Up-front capital outlay required. Must be ≥ 0. */
  cost: number;
  /** Must-do project: always selected regardless of economics. */
  forced?: boolean;
}

export interface PiRankRow {
  id: string;
  /** Profitability Index = (npv + cost) / cost = PV(benefits) / cost. */
  pi: number;
  npv: number;
  cost: number;
  /** Running total of cost across accepted projects, in rank order. */
  cumulativeCost: number;
  accepted: boolean;
}

export interface KnapsackResult {
  selected: string[];
  totalNpv: number;
  totalCost: number;
  rejected: string[];
}

export interface FrontierPoint {
  budget: number;
  totalNpv: number;
  count: number;
}

/**
 * Profitability Index for a single project.
 * PI = (npv + cost) / cost = PV(benefits) / cost.
 * A zero-cost project is treated as having infinite PI when it adds value,
 * and is ranked accordingly (placed first when npv > 0).
 */
function profitabilityIndex(project: CapitalProject): number {
  if (project.cost <= 0) {
    return project.npv > 0 ? Number.POSITIVE_INFINITY : project.npv === 0 ? 0 : Number.NEGATIVE_INFINITY;
  }
  return (project.npv + project.cost) / project.cost;
}

/**
 * Rank projects by Profitability Index (descending) and accept cumulatively
 * until the budget is exhausted. Forced projects are accepted first and always.
 *
 * Note: greedy PI ranking maximises value-per-dollar, not total value — it can
 * leave budget on the table or be beaten by `knapsack`. It is included because
 * it is the textbook rationing heuristic and is transparent to stakeholders.
 */
export function profitabilityIndexRank(
  projects: CapitalProject[],
  budget: number = Number.POSITIVE_INFINITY,
): PiRankRow[] {
  // Sort by forced-first, then PI descending. Stable tie-break on id keeps
  // output deterministic.
  const ranked = [...projects].sort((a, b) => {
    const af = a.forced ? 1 : 0;
    const bf = b.forced ? 1 : 0;
    if (af !== bf) return bf - af; // forced first
    const piDiff = profitabilityIndex(b) - profitabilityIndex(a);
    if (piDiff !== 0 && !Number.isNaN(piDiff)) return piDiff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  let cumulativeCost = 0;
  const rows: PiRankRow[] = [];

  for (const project of ranked) {
    const accepted =
      project.forced === true || cumulativeCost + project.cost <= budget;
    if (accepted) {
      cumulativeCost += project.cost;
    }
    rows.push({
      id: project.id,
      pi: profitabilityIndex(project),
      npv: project.npv,
      cost: project.cost,
      cumulativeCost,
      accepted,
    });
  }

  return rows;
}

/**
 * 0/1 knapsack maximising Σ NPV subject to Σ cost ≤ budget.
 *
 * Costs are quantised to a `step` (default 1000) so the DP table stays small;
 * each project's cost is rounded UP to the next step so we never understate the
 * budget consumed. Forced (must-do) projects are selected up-front: their cost
 * is subtracted from the budget and their NPV added to the result, then the DP
 * optimises the remaining projects over the remaining budget.
 *
 * Projects with non-positive NPV that are not forced are never selected (they
 * only consume budget), so they are dropped before the DP.
 */
export function knapsack(
  projects: CapitalProject[],
  budget: number,
  step: number = 1000,
): KnapsackResult {
  if (step <= 0) throw new Error('knapsack: step must be > 0');

  const forced = projects.filter((p) => p.forced === true);
  const optional = projects.filter((p) => p.forced !== true);

  const forcedNpv = forced.reduce((s, p) => s + p.npv, 0);
  const forcedCost = forced.reduce((s, p) => s + p.cost, 0);

  // Remaining budget after committing the must-do set, in whole steps.
  const remainingBudget = budget - forcedCost;
  const selected: string[] = forced.map((p) => p.id);
  const rejected: string[] = [];

  if (remainingBudget < 0) {
    // Must-do set alone blows the budget. Honour the must-do commitment
    // (forced means forced) and reject everything optional.
    for (const p of optional) rejected.push(p.id);
    return {
      selected,
      totalNpv: forcedNpv,
      totalCost: forcedCost,
      rejected,
    };
  }

  // Candidates: only optional projects that add value and could ever fit.
  const candidates = optional.filter((p) => p.npv > 0);
  for (const p of optional) {
    if (p.npv <= 0) rejected.push(p.id);
  }

  const capacity = Math.floor(remainingBudget / step);
  // weights[i] = cost of candidate i in steps (rounded up).
  const weights = candidates.map((p) => Math.ceil(p.cost / step));

  // best[w] = { npv, picks } — best NPV achievable using capacity w steps.
  // Iterate items, descending over capacity for 0/1 semantics.
  const bestNpv: number[] = new Array(capacity + 1).fill(0);
  const bestPicks: number[][] = Array.from({ length: capacity + 1 }, () => []);

  for (let i = 0; i < candidates.length; i++) {
    const w = weights[i];
    const value = candidates[i].npv;
    if (w > capacity) {
      // Cannot fit even in an empty budget.
      rejected.push(candidates[i].id);
      continue;
    }
    for (let c = capacity; c >= w; c--) {
      const cand = bestNpv[c - w] + value;
      if (cand > bestNpv[c]) {
        bestNpv[c] = cand;
        bestPicks[c] = [...bestPicks[c - w], i];
      }
    }
  }

  const chosenIdx = new Set(bestPicks[capacity]);
  let optionalNpv = 0;
  let optionalCost = 0;
  for (let i = 0; i < candidates.length; i++) {
    if (chosenIdx.has(i)) {
      selected.push(candidates[i].id);
      optionalNpv += candidates[i].npv;
      optionalCost += candidates[i].cost;
    } else if (!rejected.includes(candidates[i].id)) {
      rejected.push(candidates[i].id);
    }
  }

  return {
    selected,
    totalNpv: forcedNpv + optionalNpv,
    totalCost: forcedCost + optionalCost,
    rejected,
  };
}

/**
 * Efficient frontier: for each budget in `budgetSteps`, the maximum attainable
 * total NPV (via knapsack) and the number of projects funded. The resulting
 * NPV is non-decreasing in budget (more money never hurts).
 */
export function frontierByBudget(
  projects: CapitalProject[],
  budgetSteps: number[],
  step: number = 1000,
): FrontierPoint[] {
  return budgetSteps.map((budget) => {
    const result = knapsack(projects, budget, step);
    return {
      budget,
      totalNpv: result.totalNpv,
      count: result.selected.length,
    };
  });
}
