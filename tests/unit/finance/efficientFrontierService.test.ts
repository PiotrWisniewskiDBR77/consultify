import { describe, expect, it } from 'vitest';
import {
  frontier,
  portfolioRiskValue,
  type CorrelationMatrix,
  type FrontierInitiative,
} from '../../../server/src/services/efficientFrontierService.js';

const POOL: FrontierInitiative[] = [
  { id: 'a', value: 100, risk: 0.1, cost: 50 }, // safe, cheap, high density
  { id: 'b', value: 220, risk: 0.4, cost: 100 },
  { id: 'c', value: 400, risk: 0.7, cost: 150 }, // high value, high risk
  { id: 'd', value: 60, risk: 0.9, cost: 40 }, // risky, low value
];

describe('efficientFrontierService.frontier', () => {
  it('produces a curve whose value is monotonically non-decreasing as risk rises', () => {
    const { curve } = frontier(POOL, 1000, 12);

    expect(curve.length).toBeGreaterThan(0);

    // sorted by risk ascending
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].risk).toBeGreaterThanOrEqual(curve[i - 1].risk);
    }
    // more risk appetite never yields less value
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i].value).toBeGreaterThanOrEqual(curve[i - 1].value);
    }
  });

  it('every frontier point reports risk within [0,1] and a consistent value/mix', () => {
    const { curve } = frontier(POOL, 1000, 8);
    for (const pt of curve) {
      expect(pt.risk).toBeGreaterThanOrEqual(0);
      expect(pt.risk).toBeLessThanOrEqual(1);
      const recomputed = portfolioRiskValue(pt.mix, POOL);
      expect(recomputed.totalValue).toBeCloseTo(pt.value, 6);
    }
  });

  it('optimal has the best value/risk ratio on the curve', () => {
    const { curve, optimal } = frontier(POOL, 1000, 12);

    const ratio = (r: number, v: number) =>
      r > 1e-9 ? v / r : v > 0 ? Infinity : 0;
    const optimalRatio = ratio(optimal.risk, optimal.value);

    for (const pt of curve) {
      expect(ratio(pt.risk, pt.value)).toBeLessThanOrEqual(optimalRatio + 1e-9);
    }
  });

  it('respects the budget constraint (selection cost never exceeds budget)', () => {
    const budget = 150;
    const { curve } = frontier(POOL, budget, 10);
    const costOf = (id: string) => POOL.find((p) => p.id === id)!.cost;
    for (const pt of curve) {
      const spent = pt.mix.reduce((s, id) => s + costOf(id), 0);
      expect(spent).toBeLessThanOrEqual(budget);
    }
  });

  it('is deterministic — identical inputs give identical curves', () => {
    const a = frontier(POOL, 1000, 12);
    const b = frontier(POOL, 1000, 12);
    expect(a).toEqual(b);
  });

  it('handles an empty pool gracefully', () => {
    const { curve, optimal } = frontier([], 1000, 12);
    expect(curve).toHaveLength(1);
    expect(optimal.value).toBe(0);
    expect(optimal.mix).toEqual([]);
  });

  it('exposes a current (fully affordable) portfolio when budget allows', () => {
    const { current } = frontier(POOL, 1000, 12);
    expect(current).toBeDefined();
    expect(current!.value).toBeGreaterThan(0);
  });
});

describe('efficientFrontierService.portfolioRiskValue', () => {
  it('sums value and cost-weights risk across selected initiatives', () => {
    const { totalValue, portfolioRisk } = portfolioRiskValue(['a', 'c'], POOL);

    expect(totalValue).toBe(500); // 100 + 400

    // cost-weighted: (50*0.1 + 150*0.7) / 200 = (5 + 105)/200 = 0.55
    expect(portfolioRisk).toBeCloseTo(0.55, 6);
  });

  it('falls back to equal weighting when costs are absent', () => {
    const noCost: FrontierInitiative[] = [
      { id: 'x', value: 10, risk: 0.2, cost: 0 },
      { id: 'y', value: 10, risk: 0.6, cost: 0 },
    ];
    const { portfolioRisk } = portfolioRiskValue(['x', 'y'], noCost);
    // equal weights → (0.2 + 0.6)/2 = 0.4
    expect(portfolioRisk).toBeCloseTo(0.4, 6);
  });

  it('ignores ids that are not in the pool', () => {
    const { totalValue, portfolioRisk } = portfolioRiskValue(['a', 'ghost'], POOL);
    expect(totalValue).toBe(100);
    expect(portfolioRisk).toBeCloseTo(0.1, 6);
  });

  it('returns zeros for an empty selection', () => {
    const { totalValue, portfolioRisk } = portfolioRiskValue([], POOL);
    expect(totalValue).toBe(0);
    expect(portfolioRisk).toBe(0);
  });

  it('applies correlation: negatively correlated bets lower portfolio risk', () => {
    const corr: CorrelationMatrix = { a: { c: -1 }, c: { a: -1 } };
    const base = portfolioRiskValue(['a', 'c'], POOL).portfolioRisk;
    const diversified = portfolioRiskValue(['a', 'c'], POOL, corr).portfolioRisk;
    expect(diversified).toBeLessThan(base);
  });
});
