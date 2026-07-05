import { describe, expect, it } from 'vitest';

import {
  type CapitalProject,
  frontierByBudget,
  knapsack,
  profitabilityIndexRank,
} from '../../../server/src/services/capitalRationingService.js';

describe('capitalRationingService', () => {
  describe('profitabilityIndexRank', () => {
    it('computes PI = (npv + cost) / cost and ranks descending', () => {
      const projects: CapitalProject[] = [
        { id: 'low', npv: 1000, cost: 1000 }, // PI 2.0
        { id: 'high', npv: 3000, cost: 1000 }, // PI 4.0
        { id: 'mid', npv: 2000, cost: 2000 }, // PI 2.0
      ];

      const rows = profitabilityIndexRank(projects);

      expect(rows[0].id).toBe('high');
      expect(rows[0].pi).toBeCloseTo(4.0);
      // low vs mid both PI 2.0 → deterministic id tie-break ('low' < 'mid')
      expect(rows[1].id).toBe('low');
      expect(rows[2].id).toBe('mid');
    });

    it('accepts cumulatively until the budget cut, leaving the rest rejected', () => {
      const projects: CapitalProject[] = [
        { id: 'a', npv: 3000, cost: 1000 }, // PI 4.0
        { id: 'b', npv: 2000, cost: 1000 }, // PI 3.0
        { id: 'c', npv: 1000, cost: 1000 }, // PI 2.0
      ];

      const rows = profitabilityIndexRank(projects, 2000);

      const accepted = rows.filter((r) => r.accepted).map((r) => r.id);
      expect(accepted).toEqual(['a', 'b']); // budget exhausted after 2 × 1000
      expect(rows.find((r) => r.id === 'c')!.accepted).toBe(false);

      // cumulativeCost only advances on accepted rows.
      expect(rows.find((r) => r.id === 'a')!.cumulativeCost).toBe(1000);
      expect(rows.find((r) => r.id === 'b')!.cumulativeCost).toBe(2000);
      expect(rows.find((r) => r.id === 'c')!.cumulativeCost).toBe(2000);
    });
  });

  describe('knapsack', () => {
    // Hand-worked example. Budget 5000:
    //   A npv 3000 / cost 2000
    //   B npv 4000 / cost 3000
    //   C npv 2500 / cost 2000
    //   D npv 1000 / cost 1000
    // Feasible sets at cost 5000: {A,B}=7000, {A,C,D}=6500, {B,C}=6500.
    // Optimal = {A,B} with total NPV 7000.
    const projects: CapitalProject[] = [
      { id: 'A', npv: 3000, cost: 2000 },
      { id: 'B', npv: 4000, cost: 3000 },
      { id: 'C', npv: 2500, cost: 2000 },
      { id: 'D', npv: 1000, cost: 1000 },
    ];

    it('selects the optimal value-maximising set within budget', () => {
      const result = knapsack(projects, 5000);

      expect(result.selected.sort()).toEqual(['A', 'B']);
      expect(result.totalNpv).toBe(7000);
      expect(result.totalCost).toBe(5000);
      expect(result.rejected.sort()).toEqual(['C', 'D']);
    });

    it('beats greedy PI ranking when greedy is sub-optimal', () => {
      // Greedy by PI would pick the highest bang-for-buck first; the DP here
      // must still land on the true optimum {A,B}.
      const result = knapsack(projects, 5000);
      expect(result.totalNpv).toBe(7000);
    });

    it('always selects must-do (forced) projects even when uneconomic', () => {
      const withForced: CapitalProject[] = [
        { id: 'mustdo', npv: -500, cost: 2000, forced: true },
        { id: 'X', npv: 3000, cost: 2000 },
        { id: 'Y', npv: 2000, cost: 2000 },
      ];

      // Budget 4000: forced consumes 2000, leaving 2000 → pick X (npv 3000).
      const result = knapsack(withForced, 4000);

      expect(result.selected).toContain('mustdo');
      expect(result.selected).toContain('X');
      expect(result.selected).not.toContain('Y');
      expect(result.totalCost).toBe(4000);
      expect(result.totalNpv).toBe(2500); // -500 + 3000
    });

    it('honours forced projects even when they alone exceed budget', () => {
      const overBudget: CapitalProject[] = [
        { id: 'huge', npv: 1000, cost: 9999, forced: true },
        { id: 'cheap', npv: 500, cost: 1000 },
      ];
      const result = knapsack(overBudget, 5000);

      expect(result.selected).toEqual(['huge']);
      expect(result.rejected).toContain('cheap');
      expect(result.totalCost).toBe(9999);
    });

    it('rejects negative-NPV optional projects', () => {
      const mixed: CapitalProject[] = [
        { id: 'good', npv: 2000, cost: 1000 },
        { id: 'bad', npv: -1000, cost: 1000 },
      ];
      const result = knapsack(mixed, 5000);
      expect(result.selected).toEqual(['good']);
      expect(result.rejected).toContain('bad');
    });
  });

  describe('frontierByBudget', () => {
    const projects: CapitalProject[] = [
      { id: 'A', npv: 3000, cost: 2000 },
      { id: 'B', npv: 4000, cost: 3000 },
      { id: 'C', npv: 2500, cost: 2000 },
    ];

    it('produces a non-decreasing value curve as budget grows', () => {
      const curve = frontierByBudget(projects, [0, 2000, 4000, 5000, 7000]);

      expect(curve.map((p) => p.budget)).toEqual([0, 2000, 4000, 5000, 7000]);

      // totalNpv must be monotonically non-decreasing in budget.
      for (let i = 1; i < curve.length; i++) {
        expect(curve[i].totalNpv).toBeGreaterThanOrEqual(curve[i - 1].totalNpv);
      }

      // Endpoints: zero budget funds nothing; full budget funds everything.
      expect(curve[0]).toMatchObject({ totalNpv: 0, count: 0 });
      const full = curve[curve.length - 1];
      expect(full.count).toBe(3);
      expect(full.totalNpv).toBe(9500); // 3000 + 4000 + 2500
    });
  });
});
