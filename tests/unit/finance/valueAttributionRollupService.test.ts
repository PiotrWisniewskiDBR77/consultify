import { describe, it, expect } from 'vitest';
import {
  rollupPortfolioValue,
  valueByInitiative,
  type ValueContribution,
} from '../../../server/src/services/valueAttributionRollupService.js';

describe('valueAttributionRollupService (M16/2.4 anti-double-count rollup)', () => {
  describe('rollupPortfolioValue', () => {
    it('caps 3 initiatives on 1 KPI so attributed units <= delta (overlap removed)', () => {
      // 3 initiatives each claim 0.5 of the SAME 100-unit KPI delta.
      // Naive sum of shares = 1.5 -> would over-count by 50%.
      const contributions: ValueContribution[] = [
        { initiativeId: 'i1', kpiId: 'k1', kpiDelta: 100, contributionShare: 0.5, valuePerKpiUnit: 10 },
        { initiativeId: 'i2', kpiId: 'k1', kpiDelta: 100, contributionShare: 0.5, valuePerKpiUnit: 10 },
        { initiativeId: 'i3', kpiId: 'k1', kpiDelta: 100, contributionShare: 0.5, valuePerKpiUnit: 10 },
      ];

      const rollup = rollupPortfolioValue(contributions);

      // KPI delta = 100 units * 10 value/unit = 1000 max possible value.
      // Shares sum to 1.5 -> scaled to 1.0 -> 100 units attributed -> 1000 value.
      expect(rollup.byKpi).toHaveLength(1);
      const kpi = rollup.byKpi[0];
      expect(kpi.kpiId).toBe('k1');
      expect(kpi.delta).toBe(100);

      // Attributed value must not exceed delta * valuePerKpiUnit.
      expect(kpi.attributed).toBeLessThanOrEqual(100 * 10 + 0.001);
      expect(kpi.attributed).toBeCloseTo(1000, 2);

      // Fully explained -> no remainder.
      expect(kpi.unexplainedRemainder).toBeCloseTo(0, 2);

      // Naive total = 1500, capped = 1000 -> 500 double-count avoided.
      expect(rollup.totalAttributed).toBeCloseTo(1000, 2);
      expect(rollup.doubleCountAvoided).toBeCloseTo(500, 2);
    });

    it('reports unexplainedRemainder when total share < 100%', () => {
      // Two initiatives claim 0.3 + 0.4 = 0.7 of a 200-unit KPI delta.
      const contributions: ValueContribution[] = [
        { initiativeId: 'i1', kpiId: 'k2', kpiDelta: 200, contributionShare: 0.3, valuePerKpiUnit: 5 },
        { initiativeId: 'i2', kpiId: 'k2', kpiDelta: 200, contributionShare: 0.4, valuePerKpiUnit: 5 },
      ];

      const rollup = rollupPortfolioValue(contributions);
      const kpi = rollup.byKpi[0];

      // 0.7 * 200 = 140 units attributed * 5 = 700 value.
      expect(kpi.attributed).toBeCloseTo(700, 2);

      // Remainder = (200 - 140) units * 5 = 300 value.
      expect(kpi.unexplainedRemainder).toBeCloseTo(300, 2);

      // attributed + remainder == full KPI value (200 * 5 = 1000).
      expect(kpi.attributed + kpi.unexplainedRemainder).toBeCloseTo(1000, 2);

      // Under-claim -> nothing was over-counted.
      expect(rollup.doubleCountAvoided).toBeCloseTo(0, 2);
      expect(rollup.totalAttributed).toBeCloseTo(700, 2);
    });

    it('aggregates across multiple KPIs independently', () => {
      const contributions: ValueContribution[] = [
        { initiativeId: 'i1', kpiId: 'kA', kpiDelta: 100, contributionShare: 1.0, valuePerKpiUnit: 2 },
        { initiativeId: 'i2', kpiId: 'kB', kpiDelta: 50, contributionShare: 0.5, valuePerKpiUnit: 4 },
      ];

      const rollup = rollupPortfolioValue(contributions);

      expect(rollup.byKpi).toHaveLength(2);
      // kA: 100 * 1.0 * 2 = 200. kB: 50 * 0.5 * 4 = 100.
      expect(rollup.totalAttributed).toBeCloseTo(300, 2);

      const kB = rollup.byKpi.find((k) => k.kpiId === 'kB')!;
      // kB remainder = (50 - 25) units * 4 = 100.
      expect(kB.unexplainedRemainder).toBeCloseTo(100, 2);
    });

    it('returns empty rollup for no contributions', () => {
      const rollup = rollupPortfolioValue([]);
      expect(rollup.totalAttributed).toBe(0);
      expect(rollup.byKpi).toHaveLength(0);
      expect(rollup.doubleCountAvoided).toBe(0);
    });
  });

  describe('valueByInitiative', () => {
    it('attributes capped per-initiative value after anti-double-count', () => {
      // 3 initiatives over-claim the same KPI (shares sum to 1.5).
      const contributions: ValueContribution[] = [
        { initiativeId: 'i1', kpiId: 'k1', kpiDelta: 100, contributionShare: 0.5, valuePerKpiUnit: 10 },
        { initiativeId: 'i2', kpiId: 'k1', kpiDelta: 100, contributionShare: 0.5, valuePerKpiUnit: 10 },
        { initiativeId: 'i3', kpiId: 'k1', kpiDelta: 100, contributionShare: 0.5, valuePerKpiUnit: 10 },
      ];

      const result = valueByInitiative(contributions);

      expect(result).toHaveLength(3);
      // Each capped share = 0.5/1.5 = 1/3 -> 33.33 units * 10 ≈ 333.33.
      for (const r of result) {
        expect(r.attributedValue).toBeCloseTo(333.33, 1);
      }

      // Sum of per-initiative value == capped portfolio total (no double-count).
      const sum = result.reduce((s, r) => s + r.attributedValue, 0);
      const rollup = rollupPortfolioValue(contributions);
      expect(sum).toBeCloseTo(rollup.totalAttributed, 1);
    });

    it('sums an initiative across multiple KPIs', () => {
      const contributions: ValueContribution[] = [
        { initiativeId: 'i1', kpiId: 'kA', kpiDelta: 100, contributionShare: 1.0, valuePerKpiUnit: 2 },
        { initiativeId: 'i1', kpiId: 'kB', kpiDelta: 50, contributionShare: 1.0, valuePerKpiUnit: 4 },
        { initiativeId: 'i2', kpiId: 'kB', kpiDelta: 50, contributionShare: 1.0, valuePerKpiUnit: 4 },
      ];

      const result = valueByInitiative(contributions);
      // kB is over-claimed by i1+i2 (share 2.0 -> each capped to 0.5).
      // i1: kA = 100*1*2 = 200, kB = 50*0.5*4 = 100 -> 300.
      // i2: kB = 50*0.5*4 = 100.
      const i1 = result.find((r) => r.initiativeId === 'i1')!;
      const i2 = result.find((r) => r.initiativeId === 'i2')!;
      expect(i1.attributedValue).toBeCloseTo(300, 2);
      expect(i2.attributedValue).toBeCloseTo(100, 2);
    });

    it('returns empty for no contributions', () => {
      expect(valueByInitiative([])).toEqual([]);
    });
  });
});
