/**
 * Monte Carlo NPV Simulation Service (M16/4.5)
 *
 * Pure, deterministic functions for running Monte Carlo simulations over an
 * NPV model. Each driver carries a probability distribution; on every
 * iteration we sample all drivers using a seeded PRNG (mulberry32 — NEVER
 * Math.random, which is forbidden in this environment) and evaluate the
 * caller-supplied NPV function.
 *
 * Determinism guarantee: identical (drivers, iterations, seed) inputs always
 * produce identical samples, statistics and percentiles.
 *
 * Exports:
 *   - simulateNpv(drivers, iterations, seed) -> SimulationResult
 *   - histogram(samples, bins) -> HistogramBin[]   (feeds DistributionHistogram)
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** Triangular distribution: min ≤ mode ≤ max. */
export interface TriangularDriver {
  kind: 'triangular';
  min: number;
  mode: number;
  max: number;
}

/** Normal (Gaussian) distribution. */
export interface NormalDriver {
  kind: 'normal';
  mean: number;
  sd: number;
}

export type Driver = TriangularDriver | NormalDriver;

/** Map of driver name → its distribution. */
export type Drivers = Record<string, Driver>;

/** Caller-supplied NPV model: given one sampled value per driver, return NPV. */
export type NpvFn = (sampledDrivers: Record<string, number>) => number;

export interface SimulationResult {
  /** Raw NPV outcome of every iteration, length === iterations. */
  samples: number[];
  mean: number;
  /** 10th percentile of the NPV distribution. */
  p10: number;
  /** 50th percentile (median). */
  p50: number;
  /** 90th percentile. */
  p90: number;
  /** Share of iterations with NPV > 0, in [0, 1]. */
  probPositive: number;
  /** Value at Risk at 5% — the 5th percentile of the NPV distribution. */
  valueAtRisk5: number;
}

export interface HistogramBin {
  binStart: number;
  binEnd: number;
  count: number;
}

// ─── Seeded PRNG (mulberry32) ────────────────────────────────────────────────

/**
 * mulberry32 — a small, fast, deterministic 32-bit PRNG.
 * Returns a function producing floats in [0, 1). Pure given its seed.
 */
function mulberry32(seed: number): () => number {
  // Force seed into a 32-bit unsigned integer space.
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Distribution sampling ────────────────────────────────────────────────────

/**
 * Inverse-CDF sample from a triangular distribution.
 * Standard formula; clamps degenerate ranges (min === max) to that point.
 */
function sampleTriangular(d: TriangularDriver, u: number): number {
  const { min, mode, max } = d;
  if (max <= min) return min;
  // Guard mode inside [min, max].
  const m = Math.min(Math.max(mode, min), max);
  const fc = (m - min) / (max - min); // CDF value at the mode
  if (u < fc) {
    return min + Math.sqrt(u * (max - min) * (m - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - m));
}

/**
 * Sample from a normal distribution via the Box–Muller transform.
 * Consumes two uniforms; guards against u1 === 0 (log of zero).
 */
function sampleNormal(d: NormalDriver, u1: number, u2: number): number {
  const safeU1 = u1 <= 0 ? Number.MIN_VALUE : u1;
  const z = Math.sqrt(-2 * Math.log(safeU1)) * Math.cos(2 * Math.PI * u2);
  return d.mean + d.sd * z;
}

// ─── Percentiles ──────────────────────────────────────────────────────────────

/**
 * Linear-interpolation percentile over an UNSORTED array.
 * p in [0, 1]. Returns NaN for an empty array.
 */
function percentile(values: number[], p: number): number {
  const n = values.length;
  if (n === 0) return NaN;
  if (n === 1) return values[0];
  const sorted = [...values].sort((a, b) => a - b);
  const rank = p * (n - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const frac = rank - lo;
  return sorted[lo] + (sorted[hi] - sorted[lo]) * frac;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run a deterministic Monte Carlo simulation of the NPV model.
 *
 * @param drivers     Named distributions to sample each iteration.
 * @param npvFn       Model mapping one sampled value per driver → NPV.
 * @param iterations  Number of Monte Carlo trials (default 2000).
 * @param seed        PRNG seed; same seed → identical results (default 42).
 */
export function simulateNpv(
  drivers: Drivers,
  npvFn: NpvFn,
  iterations = 2000,
  seed = 42
): SimulationResult {
  const rand = mulberry32(seed);
  const driverNames = Object.keys(drivers);
  const safeIterations = Math.max(0, Math.floor(iterations));

  const samples: number[] = new Array(safeIterations);
  let sum = 0;
  let positive = 0;

  for (let i = 0; i < safeIterations; i++) {
    const sampled: Record<string, number> = {};
    for (const name of driverNames) {
      const driver = drivers[name];
      if (driver.kind === 'triangular') {
        sampled[name] = sampleTriangular(driver, rand());
      } else {
        // Normal consumes two uniforms — keep stream advance deterministic.
        sampled[name] = sampleNormal(driver, rand(), rand());
      }
    }
    const npv = npvFn(sampled);
    samples[i] = npv;
    sum += npv;
    if (npv > 0) positive++;
  }

  const mean = safeIterations > 0 ? sum / safeIterations : NaN;

  return {
    samples,
    mean,
    p10: percentile(samples, 0.1),
    p50: percentile(samples, 0.5),
    p90: percentile(samples, 0.9),
    probPositive: safeIterations > 0 ? positive / safeIterations : 0,
    valueAtRisk5: percentile(samples, 0.05),
  };
}

/**
 * Bucket samples into a fixed number of equal-width bins for the
 * DistributionHistogram component.
 *
 * Guarantees Σ count === samples.length: every finite sample lands in exactly
 * one bin (the last bin is inclusive of the max). Non-finite samples are
 * dropped, so they do not inflate the total.
 *
 * @param samples Raw simulation outcomes.
 * @param bins    Number of equal-width buckets (default 20).
 */
export function histogram(samples: number[], bins = 20): HistogramBin[] {
  const binCount = Math.max(1, Math.floor(bins));
  const finite = samples.filter((v) => Number.isFinite(v));

  if (finite.length === 0) {
    return [];
  }

  let min = Infinity;
  let max = -Infinity;
  for (const v of finite) {
    if (v < min) min = v;
    if (v > max) max = v;
  }

  // Degenerate range: all samples equal → single bin holding everything.
  if (min === max) {
    return [{ binStart: min, binEnd: max, count: finite.length }];
  }

  const width = (max - min) / binCount;
  const result: HistogramBin[] = new Array(binCount);
  for (let b = 0; b < binCount; b++) {
    result[b] = {
      binStart: min + b * width,
      binEnd: min + (b + 1) * width,
      count: 0,
    };
  }

  for (const v of finite) {
    let idx = Math.floor((v - min) / width);
    // Clamp: the max value (and float drift) maps into the last bin.
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    result[idx].count++;
  }

  return result;
}
