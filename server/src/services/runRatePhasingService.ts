/**
 * Run-Rate vs One-Time Split + Phasing (M16/3.5)
 *
 * Pure, dependency-free functions that model the distinction every CFO/board
 * cares about when reading a benefits case:
 *
 *   1. splitBenefit        — split a benefit's total value into a recurring
 *                            annual "run-rate" portion and a one-time portion.
 *   2. phasingCurve        — S-curve (logistic) or linear ramp describing how
 *                            quickly the full run-rate is attained.
 *   3. inYearVsFullYear    — in-year (pro-rated) impact vs full-year run-rate.
 *                            Boards "buy" the full-year run-rate; the in-year
 *                            number is smaller because the benefit lands mid-year.
 *   4. bankableValue       — sum of ONLY run-rate value; one-time gains do NOT
 *                            enter the durable base of year N+1.
 *
 * No I/O, no DB, no side effects — safe to unit-test in isolation.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BenefitInput {
  /** Total value of the benefit (annualised gross figure the case quotes). */
  totalValue: number;
  /**
   * Share of {@link totalValue} that is recurring run-rate, in [0, 1].
   * The remainder (1 - runRateShare) is treated as one-time.
   * Defaults to 1 (fully recurring) when omitted.
   */
  runRateShare?: number;
  // Additional descriptive fields are tolerated and ignored.
  [key: string]: unknown;
}

export interface BenefitSplit {
  /** Recurring annual value (enters the durable base). */
  runRate: number;
  /** One-time value (does NOT recur next year). */
  oneTime: number;
}

export type RampShape = 'logistic' | 'linear';

export interface PhasingInput {
  /** Steady-state recurring annual value once fully ramped. */
  fullRunRate: number;
  /** Months taken to reach (effectively) 100% of the full run-rate. */
  rampMonths: number;
  /** Period index (0-based month offset) at which the ramp begins. */
  startPeriod?: number;
  /** Total number of monthly periods to project. */
  horizonMonths: number;
  /** Ramp shape; defaults to 'logistic' (S-curve). */
  shape?: RampShape;
}

export interface PhasingPoint {
  /** 0-based period (month) index. */
  period: number;
  /** Cumulative value delivered up to and including this period. */
  cumulative: number;
  /** Fraction of full run-rate attained at this period, in [0, 1]. */
  runRateAttained: number;
}

export interface PhasingCurve {
  points: PhasingPoint[];
}

export interface InYearVsFullYear {
  /** Impact recognised in the current (partial) year — pro-rated. */
  inYearImpact: number;
  /** Full annual run-rate — what the board "buys". */
  fullYearRunRate: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const clamp = (value: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, value));

const num = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/**
 * Logistic attainment fraction across the ramp, normalised so that:
 *   - progress 0   → ~0 (re-based to exactly 0 at the start),
 *   - progress 1   → exactly 1 at rampMonths,
 *   - strictly monotonically increasing in between.
 *
 * @param progress fraction of the ramp elapsed, in [0, 1]
 */
const logisticAttained = (progress: number): number => {
  const p = clamp(progress, 0, 1);
  // Steepness of the S-curve; k≈6 gives a recognisable sigmoid over [0,1].
  const k = 6;
  const raw = (t: number) => 1 / (1 + Math.exp(-k * (t - 0.5)));
  const base = raw(0);
  const top = raw(1);
  // Re-base and re-scale so the curve spans exactly [0, 1] across the ramp.
  return (raw(p) - base) / (top - base);
};

// ─── 1. Run-rate vs one-time split ───────────────────────────────────────────

export function splitBenefit(benefit: BenefitInput): BenefitSplit {
  const total = num(benefit?.totalValue, 0);
  const share = clamp(num(benefit?.runRateShare, 1), 0, 1);
  const runRate = total * share;
  return {
    runRate,
    oneTime: total - runRate,
  };
}

// ─── 2. Phasing curve (ramp to full run-rate) ────────────────────────────────

export function phasingCurve(input: PhasingInput): PhasingCurve {
  const fullRunRate = num(input?.fullRunRate, 0);
  const rampMonths = Math.max(0, num(input?.rampMonths, 0));
  const startPeriod = Math.max(0, Math.floor(num(input?.startPeriod, 0)));
  const horizonMonths = Math.max(0, Math.floor(num(input?.horizonMonths, 0)));
  const shape: RampShape = input?.shape === 'linear' ? 'linear' : 'logistic';

  const points: PhasingPoint[] = [];
  let cumulative = 0;

  for (let period = 0; period < horizonMonths; period++) {
    let attained: number;
    if (period < startPeriod) {
      attained = 0;
    } else if (rampMonths <= 0) {
      // Instant ramp: full run-rate from the start period onward.
      attained = 1;
    } else {
      const elapsed = period - startPeriod + 1; // months into the ramp (1-based)
      const progress = clamp(elapsed / rampMonths, 0, 1);
      attained = shape === 'linear' ? progress : logisticAttained(progress);
    }
    attained = clamp(attained, 0, 1);

    // Monthly delivered value = attained fraction of the monthly run-rate.
    const monthlyValue = (fullRunRate / 12) * attained;
    cumulative += monthlyValue;

    points.push({ period, cumulative, runRateAttained: attained });
  }

  return { points };
}

// ─── 3. In-year vs full-year run-rate ────────────────────────────────────────

export function inYearVsFullYear(
  benefit: BenefitInput,
  monthsRemainingInYear: number
): InYearVsFullYear {
  const { runRate: fullYearRunRate } = splitBenefit(benefit);
  const months = clamp(num(monthsRemainingInYear, 0), 0, 12);
  const inYearImpact = fullYearRunRate * (months / 12);
  return {
    inYearImpact,
    fullYearRunRate,
  };
}

// ─── 4. Bankable value (run-rate only) ───────────────────────────────────────

export function bankableValue(benefits: BenefitInput[]): number {
  if (!Array.isArray(benefits)) return 0;
  return benefits.reduce((sum, benefit) => sum + splitBenefit(benefit).runRate, 0);
}
