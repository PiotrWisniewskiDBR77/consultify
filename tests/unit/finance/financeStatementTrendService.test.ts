import { describe, expect, it } from 'vitest';

import {
  analyseStatementLine,
  computeTrend,
  decomposeDrivers,
  extrapolate,
  type SeriesPoint,
} from '../../../server/src/services/financeStatementTrendService.ts';

const series = (...values: number[]): SeriesPoint[] =>
  values.map((value, i) => ({ periodLabel: `P${i}`, periodIndex: i, value }));

describe('computeTrend', () => {
  it('needs at least 2 periods; a single point is flat with cagr null', () => {
    const t = computeTrend(series(100));
    expect(t.periods).toBe(1);
    expect(t.direction).toBe('flat');
    expect(t.cagrPct).toBeNull();
  });

  it('detects a rising direction and computes CAGR on positive series', () => {
    const t = computeTrend(series(100, 110, 121)); // 10%/period compound
    expect(t.direction).toBe('rising');
    expect(t.cagrPct).toBeCloseTo(10, 1);
    expect(t.totalChange).toBe(21);
  });

  it('flags deceleration when successive deltas shrink', () => {
    const t = computeTrend(series(100, 150, 170, 175)); // +50, +20, +5
    expect(t.direction).toBe('rising');
    expect(t.shape).toBe('decelerating');
  });

  it('flags acceleration when successive deltas grow', () => {
    const t = computeTrend(series(100, 105, 115, 140)); // +5, +10, +25
    expect(t.shape).toBe('accelerating');
  });

  it('treats a change within tolerance as flat', () => {
    const t = computeTrend(series(100, 100.5)); // +0.5% < 1% tol
    expect(t.direction).toBe('flat');
  });
});

describe('decomposeDrivers', () => {
  it('ranks components by absolute contribution and marks dampening movers', () => {
    // parent rose +30; liabilities +40 (amplifying), assets +10 opposing? both +
    const drivers = decomposeDrivers(30, [
      { name: 'short-term liabilities', oldest: 100, newest: 140 }, // +40
      { name: 'current assets', oldest: 200, newest: 190 }, // -10
    ]);
    expect(drivers[0].name).toBe('short-term liabilities'); // biggest mover first
    expect(drivers[0].role).toBe('amplifying'); // +40 same sign as parent +30
    expect(drivers[1].role).toBe('dampening'); // -10 opposes parent
    // shares sum to 1 (40/50 + 10/50)
    expect(drivers[0].contributionShare + drivers[1].contributionShare).toBeCloseTo(1, 5);
  });

  it('returns zero shares when there is no component movement', () => {
    const drivers = decomposeDrivers(0, [{ name: 'x', oldest: 10, newest: 10 }]);
    expect(drivers[0].contributionShare).toBe(0);
  });
});

describe('extrapolate', () => {
  it('refuses to forecast on fewer than 3 points (no fabrication)', () => {
    const f = extrapolate(series(100, 110), 1);
    expect(f.method).toBe('none');
    expect(f.confidence).toBe('insufficient-data');
    expect(f.projected).toHaveLength(0);
    expect(f.assumption).toBeNull();
  });

  it('extrapolates compound growth on a clean positive series with an assumption', () => {
    const f = extrapolate(series(100, 110, 121), 1); // 10%/period
    expect(f.method).toBe('cagr-extrapolation');
    expect(f.projected[0].value).toBeCloseTo(133.1, 1);
    expect(f.projected[0].periodIndex).toBe(3);
    expect(f.assumption?.en).toContain('%');
  });

  it('falls back to linear when the series contains non-positive values', () => {
    const f = extrapolate(series(-10, 0, 10), 1); // avg delta +10
    expect(f.method).toBe('linear-extrapolation');
    expect(f.projected[0].value).toBe(20);
  });
});

describe('analyseStatementLine', () => {
  it('assembles trend + drivers + forecast; empty drivers when no components', () => {
    const out = analyseStatementLine({
      lineCode: 'revenue',
      lineName: 'Revenue',
      series: series(1000, 1100, 1210),
    });
    expect(out.trend.direction).toBe('rising');
    expect(out.drivers).toHaveLength(0); // honest: no decomposition data
    expect(out.forecast.method).toBe('cagr-extrapolation');
  });

  it('includes driver decomposition when component series supplied', () => {
    const out = analyseStatementLine({
      lineCode: 'current_ratio',
      lineName: 'Current ratio',
      series: series(1.6, 1.4, 1.2),
      componentSeries: [
        { name: 'short-term liabilities', oldest: 100, newest: 138 },
        { name: 'current assets', oldest: 160, newest: 165 },
      ],
    });
    expect(out.drivers[0].name).toBe('short-term liabilities');
    expect(out.trend.direction).toBe('falling');
  });
});
