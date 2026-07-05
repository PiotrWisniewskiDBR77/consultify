import { describe, it, expect } from 'vitest';
import {
  simulateNpv,
  histogram,
  type Drivers,
  type NpvFn,
} from '../../../server/src/services/monteCarloNpvService';

/**
 * A simple linear NPV model: weighted sum of the sampled drivers minus an
 * upfront cost. Pure, so simulation determinism depends only on the PRNG.
 */
const npvFn: NpvFn = (d) => (d.revenue ?? 0) - (d.cost ?? 0);

describe('monteCarloNpvService.simulateNpv', () => {
  const drivers: Drivers = {
    revenue: { kind: 'triangular', min: 80, mode: 100, max: 130 },
    cost: { kind: 'normal', mean: 50, sd: 5 },
  };

  it('is deterministic: same seed → identical p50, mean and samples', () => {
    const a = simulateNpv(drivers, npvFn, 2000, 42);
    const b = simulateNpv(drivers, npvFn, 2000, 42);

    expect(b.p50).toBe(a.p50);
    expect(b.mean).toBe(a.mean);
    expect(b.p10).toBe(a.p10);
    expect(b.p90).toBe(a.p90);
    expect(b.valueAtRisk5).toBe(a.valueAtRisk5);
    expect(b.samples).toEqual(a.samples);
  });

  it('produces different distributions for different seeds', () => {
    const a = simulateNpv(drivers, npvFn, 2000, 42);
    const b = simulateNpv(drivers, npvFn, 2000, 7);
    // Overwhelmingly likely to differ across 2000 draws.
    expect(b.samples).not.toEqual(a.samples);
  });

  it('returns the requested number of samples', () => {
    const res = simulateNpv(drivers, npvFn, 2000, 42);
    expect(res.samples).toHaveLength(2000);
  });

  it('percentiles are monotonic: VaR5 ≤ p10 < p50 < p90', () => {
    const res = simulateNpv(drivers, npvFn, 2000, 42);
    expect(res.valueAtRisk5).toBeLessThanOrEqual(res.p10);
    expect(res.p10).toBeLessThan(res.p50);
    expect(res.p50).toBeLessThan(res.p90);
  });

  it('probPositive ≈ 1 for a strictly positive distribution', () => {
    // revenue ~ 100, cost ~ 1 → NPV always strongly positive.
    const positiveDrivers: Drivers = {
      revenue: { kind: 'triangular', min: 90, mode: 100, max: 110 },
      cost: { kind: 'normal', mean: 1, sd: 0.5 },
    };
    const res = simulateNpv(positiveDrivers, npvFn, 2000, 42);
    expect(res.probPositive).toBeGreaterThan(0.999);
  });

  it('probPositive ≈ 0 for a strictly negative distribution', () => {
    const negativeDrivers: Drivers = {
      revenue: { kind: 'triangular', min: 1, mode: 2, max: 3 },
      cost: { kind: 'normal', mean: 100, sd: 0.5 },
    };
    const res = simulateNpv(negativeDrivers, npvFn, 2000, 42);
    expect(res.probPositive).toBeLessThan(0.001);
  });

  it('mean falls between p10 and p90', () => {
    const res = simulateNpv(drivers, npvFn, 2000, 42);
    expect(res.mean).toBeGreaterThan(res.p10);
    expect(res.mean).toBeLessThan(res.p90);
  });
});

describe('monteCarloNpvService.histogram', () => {
  const drivers: Drivers = {
    revenue: { kind: 'triangular', min: 80, mode: 100, max: 130 },
    cost: { kind: 'normal', mean: 50, sd: 5 },
  };

  it('bin counts sum to the number of iterations', () => {
    const res = simulateNpv(drivers, npvFn, 2000, 42);
    const bins = histogram(res.samples, 20);
    const total = bins.reduce((acc, b) => acc + b.count, 0);
    expect(total).toBe(2000);
  });

  it('produces the requested number of bins (non-degenerate range)', () => {
    const res = simulateNpv(drivers, npvFn, 2000, 42);
    const bins = histogram(res.samples, 20);
    expect(bins).toHaveLength(20);
  });

  it('bins are contiguous and ascending', () => {
    const res = simulateNpv(drivers, npvFn, 2000, 42);
    const bins = histogram(res.samples, 20);
    for (let i = 0; i < bins.length; i++) {
      expect(bins[i].binEnd).toBeGreaterThan(bins[i].binStart);
      if (i > 0) {
        expect(bins[i].binStart).toBeCloseTo(bins[i - 1].binEnd, 9);
      }
    }
  });

  it('handles a degenerate (all-equal) sample set with one bin', () => {
    const bins = histogram([5, 5, 5, 5], 20);
    expect(bins).toHaveLength(1);
    expect(bins[0].count).toBe(4);
    expect(bins[0].binStart).toBe(5);
    expect(bins[0].binEnd).toBe(5);
  });

  it('drops non-finite samples but keeps the total over finite ones', () => {
    const bins = histogram([1, 2, 3, NaN, Infinity, 4], 4);
    const total = bins.reduce((acc, b) => acc + b.count, 0);
    expect(total).toBe(4);
  });

  it('returns an empty array when there are no finite samples', () => {
    expect(histogram([], 20)).toEqual([]);
    expect(histogram([NaN, Infinity], 20)).toEqual([]);
  });
});
