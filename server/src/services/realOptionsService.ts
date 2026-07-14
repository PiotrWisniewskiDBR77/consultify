/**
 * Real Options Service (M16/4.6)
 *
 * MBA-grade real-options valuation for capital-investment decisions.
 * Treats managerial flexibility as financial options on real (non-traded) assets.
 *
 *   1. deferOption     — option to wait (call-like), binomial lattice
 *   2. abandonOption   — option to abandon for salvage (put-like)
 *   3. stagedInvestment — value of staging (pilot → gate → scale) vs full commit
 *
 * Pure functions only — deterministic, no Math.random / Date.now.
 * Binomial model (Cox-Ross-Rubinstein):
 *   u = e^(σ·√Δt),  d = 1/u,  p = (e^(r·Δt) − d) / (u − d)
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DeferOptionInput {
  /** Present value of the underlying project's expected cash flows. */
  underlyingValue: number;
  /** Cost (strike) required to make the investment. */
  investmentCost: number;
  /** Annualized volatility of the underlying value (e.g. 0.30 = 30%). */
  volatility: number;
  /** Annual risk-free rate (e.g. 0.04 = 4%). */
  riskFreeRate: number;
  /** Years available before the decision must be made. */
  timeToDecideYears: number;
  /** Number of binomial steps in the lattice (default 4). */
  steps?: number;
}

export type DeferRecommendation = 'defer' | 'invest-now' | 'abandon';

export interface DeferOptionResult {
  /** Value of the option to defer (always ≥ 0). */
  optionValue: number;
  /** max(staticNpv, optionValue) — value capturing managerial flexibility. */
  expandedNpv: number;
  recommendation: DeferRecommendation;
}

export interface AbandonOptionInput {
  /** Present value of continuing the project. */
  underlyingValue: number;
  /** Recoverable value if the project is abandoned (the put strike). */
  salvageValue: number;
  /** Annualized volatility of the underlying value. */
  volatility: number;
  /** Annual risk-free rate. */
  riskFreeRate: number;
  /** Years over which abandonment remains possible. */
  timeToDecideYears: number;
  /** Number of binomial steps in the lattice (default 4). */
  steps?: number;
}

export interface AbandonOptionResult {
  /** The salvage (put strike) echoed back for convenience. */
  salvageValue: number;
  /** Value of the option to abandon (always ≥ 0). */
  optionValue: number;
}

export interface InvestmentStage {
  /** Cost (investment) required to execute this stage. */
  cost: number;
  /** Present value of the payoff if this stage succeeds. */
  expectedValue: number;
  /** Probability this stage succeeds and the next stage proceeds (0..1). */
  successProb: number;
}

export type StagedRecommendation = 'pilot-first' | 'full-commit';

export interface StagedInvestmentResult {
  /** Expected value of the staged (sequential, abandon-on-failure) path. */
  totalOptionValue: number;
  recommendation: StagedRecommendation;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Cox-Ross-Rubinstein lattice parameters for a single step of length dt.
 * Returns up/down multipliers and the risk-neutral up-probability.
 */
function crrParams(
  volatility: number,
  riskFreeRate: number,
  dt: number
): { u: number; d: number; p: number; disc: number } {
  const vol = Math.max(0, volatility);
  const u = Math.exp(vol * Math.sqrt(dt));
  // Guard the degenerate σ≈0 case where u === d (avoid divide-by-zero).
  const d = u === 0 ? 0 : 1 / u;
  const growth = Math.exp(riskFreeRate * dt);
  const spread = u - d;
  const p = spread === 0 ? 0.5 : clamp01((growth - d) / spread);
  const disc = Math.exp(-riskFreeRate * dt);
  return { u, d, p, disc };
}

/**
 * Generic European-style binomial valuation on a CRR lattice.
 * `payoff(terminalUnderlying)` gives the exercise value at each terminal node.
 */
function binomialEuropean(
  underlyingValue: number,
  volatility: number,
  riskFreeRate: number,
  timeYears: number,
  steps: number,
  payoff: (terminal: number) => number
): number {
  const n = Math.max(1, Math.floor(steps));
  const t = Math.max(0, timeYears);
  const dt = t / n;
  const { u, d, p, disc } = crrParams(volatility, riskFreeRate, dt);

  // Terminal-node values: S·u^j·d^(n-j), j up-moves.
  const values: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) {
    const terminal = underlyingValue * Math.pow(u, j) * Math.pow(d, n - j);
    values[j] = payoff(terminal);
  }

  // Backward induction (risk-neutral, discounted).
  for (let step = n; step > 0; step--) {
    for (let j = 0; j < step; j++) {
      values[j] = disc * (p * values[j + 1] + (1 - p) * values[j]);
    }
  }

  const result = values[0];
  return Number.isFinite(result) && result > 0 ? result : 0;
}

// ─── 1. Option to defer (call-like) ──────────────────────────────────────────

/**
 * Value the option to wait before committing capital.
 *
 * The investment is a call: at decision time the firm invests only if the
 * project value exceeds the cost, so the per-node payoff is
 * max(underlying − investmentCost, 0).
 */
export function deferOption(input: DeferOptionInput): DeferOptionResult {
  const {
    underlyingValue,
    investmentCost,
    volatility,
    riskFreeRate,
    timeToDecideYears,
    steps = 4,
  } = input;

  const staticNpv = underlyingValue - investmentCost;

  const optionValue = binomialEuropean(
    underlyingValue,
    volatility,
    riskFreeRate,
    timeToDecideYears,
    steps,
    (terminal) => Math.max(terminal - investmentCost, 0)
  );

  const expandedNpv = Math.max(staticNpv, optionValue);

  // Recommendation:
  //  - abandon    → no value either way (option worthless and NPV ≤ 0)
  //  - invest-now → static NPV already captures (or beats) the option's value
  //  - defer      → waiting adds value over investing immediately
  let recommendation: DeferRecommendation;
  if (optionValue <= 0 && staticNpv <= 0) {
    recommendation = 'abandon';
  } else if (staticNpv >= optionValue) {
    recommendation = 'invest-now';
  } else {
    recommendation = 'defer';
  }

  return { optionValue, expandedNpv, recommendation };
}

// ─── 2. Option to abandon (put-like) ─────────────────────────────────────────

/**
 * Value the option to abandon an in-progress project for its salvage value.
 *
 * Abandonment is a put: it is exercised when the project's value falls below
 * salvage, so the per-node payoff is max(salvageValue − underlying, 0).
 */
export function abandonOption(input: AbandonOptionInput): AbandonOptionResult {
  const {
    underlyingValue,
    salvageValue,
    volatility,
    riskFreeRate,
    timeToDecideYears,
    steps = 4,
  } = input;

  const optionValue = binomialEuropean(
    underlyingValue,
    volatility,
    riskFreeRate,
    timeToDecideYears,
    steps,
    (terminal) => Math.max(salvageValue - terminal, 0)
  );

  return { salvageValue, optionValue };
}

// ─── 3. Staged investment (pilot → gate → scale) ─────────────────────────────

/**
 * Compare a staged (sequential, abandon-on-failure) investment path against a
 * single up-front full commitment.
 *
 * Staged path: each stage is funded only if every prior stage succeeded. A
 * failed stage stops further spend, so downside is capped at the stages
 * actually executed. Value is the expected NPV across the sequential tree:
 *
 *   EV = Σ_i  ( ∏_{k<i} successProb_k ) · ( successProb_i · expectedValue_i − cost_i )
 *
 * Full-commit path: all costs are sunk up-front; payoff requires the whole
 * chain to succeed (product of success probabilities).
 *
 * Recommendation favours `pilot-first` whenever staging is worth at least as
 * much as committing everything at once (i.e. the value of the abandonment
 * flexibility under uncertainty is non-negative).
 */
export function stagedInvestment(stages: InvestmentStage[]): StagedInvestmentResult {
  const list = Array.isArray(stages) ? stages : [];

  if (list.length === 0) {
    return { totalOptionValue: 0, recommendation: 'full-commit' };
  }

  // Staged: spend stage i only if all earlier stages succeeded.
  let stagedValue = 0;
  let reachProb = 1; // probability of reaching the current stage
  for (const stage of list) {
    const sp = clamp01(stage.successProb);
    const stageNet = sp * stage.expectedValue - stage.cost;
    stagedValue += reachProb * stageNet;
    reachProb *= sp;
  }

  // Full commit: all cost up front, full payoff only if the whole chain works.
  const totalCost = list.reduce((sum, s) => sum + s.cost, 0);
  const chainProb = list.reduce((prod, s) => prod * clamp01(s.successProb), 1);
  const totalPayoff = list.reduce((sum, s) => sum + s.expectedValue, 0);
  const fullCommitValue = chainProb * totalPayoff - totalCost;

  const recommendation: StagedRecommendation =
    stagedValue >= fullCommitValue ? 'pilot-first' : 'full-commit';

  return { totalOptionValue: stagedValue, recommendation };
}
