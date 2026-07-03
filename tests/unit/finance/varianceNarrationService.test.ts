import { describe, it, expect } from 'vitest';
import {
  narrateVariance,
  topVarianceDrivers,
  varianceSeverity,
  type VarianceBridge,
} from '../../../server/src/services/varianceNarrationService.js';

/**
 * A representative plan/actual bridge.
 *
 * Favourable-signed variances:
 *   Revenue  (income): actual - plan = 1000 - 1200 = -200  (unfavourable, miss)
 *   COGS     (cost)  : plan - actual =  400 -  520 = -120  (unfavourable, overspend)
 *   Marketing(cost)  : plan - actual =  200 -  150 =  +50  (favourable, underspend)
 *   Other    (cost)  : plan - actual =  100 -   90 =  +10  (favourable, underspend)
 *
 * Net variance = -200 - 120 + 50 + 10 = -260
 * Total |variance| = 200 + 120 + 50 + 10 = 380
 * Plan base (sum |plan|) = 1200 + 400 + 200 + 100 = 1900
 */
const bridge: VarianceBridge = [
  { label: 'Revenue', plan: 1200, actual: 1000, isCost: false },
  { label: 'COGS', plan: 400, actual: 520, isCost: true },
  { label: 'Marketing', plan: 200, actual: 150, isCost: true },
  { label: 'Other', plan: 100, actual: 90, isCost: true },
];

describe('narrateVariance', () => {
  it('produces a headline carrying the net amount and a percentage', () => {
    const { headline } = narrateVariance(bridge);
    // net = -260 → fmtAmount = "-260"; netPct = -260/1900 = -13.7%
    expect(headline).toContain('-260');
    expect(headline).toMatch(/%/);
    expect(headline).toMatch(/-13\.7%/);
  });

  it('headline names the dominant driver with its share', () => {
    const { headline } = narrateVariance(bridge);
    // Largest |contribution| is Revenue at 200 (200/380 = 52.6%)
    expect(headline).toContain('Revenue');
    expect(headline).toMatch(/52\.6%/);
  });

  it('returns drivers sorted by absolute contribution descending', () => {
    const { drivers } = narrateVariance(bridge);
    expect(drivers.map((d) => d.line)).toEqual(['Revenue', 'COGS', 'Marketing', 'Other']);
    const absSorted = drivers.map((d) => Math.abs(d.contribution));
    for (let i = 1; i < absSorted.length; i++) {
      expect(absSorted[i - 1]).toBeGreaterThanOrEqual(absSorted[i]);
    }
  });

  it('labels driver directions correctly (favorable vs unfavorable)', () => {
    const { drivers } = narrateVariance(bridge);
    const byLine = Object.fromEntries(drivers.map((d) => [d.line, d]));
    expect(byLine.Revenue.direction).toBe('unfavorable');
    expect(byLine.COGS.direction).toBe('unfavorable');
    expect(byLine.Marketing.direction).toBe('favorable');
    expect(byLine.Other.direction).toBe('favorable');
  });

  it('driver pct values sum to ~100%', () => {
    const { drivers } = narrateVariance(bridge);
    const sum = drivers.reduce((s, d) => s + d.pct, 0);
    expect(sum).toBeGreaterThan(99);
    expect(sum).toBeLessThan(101);
  });

  it('commentary mentions the largest drag and an offsetting favorable line', () => {
    const { commentary } = narrateVariance(bridge);
    expect(commentary).toContain('Revenue'); // largest drag
    expect(commentary).toContain('Marketing'); // best favourable
    expect(commentary.length).toBeGreaterThan(40);
  });

  it('handles an empty bridge gracefully', () => {
    const out = narrateVariance([]);
    expect(out.drivers).toEqual([]);
    expect(out.headline).toMatch(/No variance data/i);
  });

  it('handles a perfectly on-plan bridge', () => {
    const out = narrateVariance([
      { label: 'Revenue', plan: 1000, actual: 1000, isCost: false },
      { label: 'COGS', plan: 400, actual: 400, isCost: true },
    ]);
    expect(out.headline).toMatch(/on plan/i);
    expect(out.drivers.every((d) => d.direction === 'neutral')).toBe(true);
  });
});

describe('topVarianceDrivers', () => {
  it('returns the n lines with the largest absolute variance', () => {
    const top = topVarianceDrivers(bridge, 3);
    expect(top).toHaveLength(3);
    expect(top.map((d) => d.line)).toEqual(['Revenue', 'COGS', 'Marketing']);
    expect(top[0].variance).toBe(-200);
    expect(top[1].variance).toBe(-120);
    expect(top[2].variance).toBe(50);
  });

  it('defaults to top 3', () => {
    expect(topVarianceDrivers(bridge)).toHaveLength(3);
  });

  it('shares of ALL drivers sum to ~100%', () => {
    const all = topVarianceDrivers(bridge, bridge.length);
    const sum = all.reduce((s, d) => s + d.sharePct, 0);
    expect(sum).toBeGreaterThan(99);
    expect(sum).toBeLessThan(101);
  });

  it('individual shares are correct (Revenue = 52.6% of 380)', () => {
    const all = topVarianceDrivers(bridge, bridge.length);
    const rev = all.find((d) => d.line === 'Revenue')!;
    expect(rev.sharePct).toBeCloseTo(52.6, 1);
  });

  it('returns [] for empty bridge or n <= 0', () => {
    expect(topVarianceDrivers([], 3)).toEqual([]);
    expect(topVarianceDrivers(bridge, 0)).toEqual([]);
  });

  it('never returns more rows than the bridge has', () => {
    expect(topVarianceDrivers(bridge, 99)).toHaveLength(bridge.length);
  });
});

describe('varianceSeverity', () => {
  it('classifies a small deviation as on-track (< 5%)', () => {
    // net -19 over plan base 1900 = 1.0%
    const small: VarianceBridge = [
      { label: 'Revenue', plan: 1200, actual: 1190, isCost: false }, // -10
      { label: 'COGS', plan: 400, actual: 409, isCost: true }, // -9
      { label: 'Marketing', plan: 200, actual: 200, isCost: true },
      { label: 'Other', plan: 100, actual: 100, isCost: true },
    ];
    expect(varianceSeverity(small)).toBe('on-track');
  });

  it('classifies a moderate deviation as watch (5%–15%)', () => {
    // The representative bridge nets -260 / 1900 = 13.7% → watch
    expect(varianceSeverity(bridge)).toBe('watch');
  });

  it('classifies a large deviation as off-track (>= 15%)', () => {
    const big: VarianceBridge = [
      { label: 'Revenue', plan: 1000, actual: 600, isCost: false }, // -400
    ];
    // 400 / 1000 = 40% → off-track
    expect(varianceSeverity(big)).toBe('off-track');
  });

  it('returns on-track for an empty or zero-plan bridge', () => {
    expect(varianceSeverity([])).toBe('on-track');
    expect(varianceSeverity([{ label: 'X', plan: 0, actual: 50, isCost: false }])).toBe(
      'on-track',
    );
  });
});
