/**
 * Capacity Model Service (M14 / F4) — Unit Tests (REAL CODE, PURE functions)
 *
 * Tests server/src/services/capacityModelService.ts
 */
import { describe, expect, it } from 'vitest';

import {
  capacityVsDemand,
  computeUtilization,
  overloadAlerts,
  resourceHeatmap,
  type ResourceAllocation,
  type ResourceCapacity,
} from '../../../server/src/services/capacityModelService.js';

describe('capacityModelService (REAL, PURE)', () => {
  describe('computeUtilization', () => {
    it('classifies under / optimal / over and sums allocations per resource', () => {
      const allocations: ResourceAllocation[] = [
        // r-under: 0.5 / 1.0 = 50% → under
        { resourceId: 'r-under', initiativeId: 'i1', allocatedFte: 0.5, periodStart: '2026-01-01', periodEnd: '2026-03-31' },
        // r-opt: 0.6 + 0.3 = 0.9 / 1.0 = 90% → optimal
        { resourceId: 'r-opt', initiativeId: 'i1', allocatedFte: 0.6, periodStart: '2026-01-01', periodEnd: '2026-03-31' },
        { resourceId: 'r-opt', initiativeId: 'i2', allocatedFte: 0.3, periodStart: '2026-01-01', periodEnd: '2026-03-31' },
        // r-over: 1.2 / 1.0 = 120% → over
        { resourceId: 'r-over', initiativeId: 'i3', allocatedFte: 1.2, periodStart: '2026-01-01', periodEnd: '2026-03-31' },
      ];
      const capacities: ResourceCapacity[] = [
        { resourceId: 'r-under', availableFte: 1.0 },
        { resourceId: 'r-opt', availableFte: 1.0 },
        { resourceId: 'r-over', availableFte: 1.0 },
      ];

      const result = computeUtilization(allocations, capacities);
      const byId = Object.fromEntries(result.map((r) => [r.resourceId, r]));

      expect(byId['r-under']).toMatchObject({ allocatedFte: 0.5, availableFte: 1.0, utilizationPct: 50, status: 'under' });
      expect(byId['r-opt']).toMatchObject({ allocatedFte: 0.9, availableFte: 1.0, utilizationPct: 90, status: 'optimal' });
      expect(byId['r-over']).toMatchObject({ allocatedFte: 1.2, availableFte: 1.0, utilizationPct: 120, status: 'over' });
    });

    it('treats exactly 100% as optimal (boundary)', () => {
      const result = computeUtilization(
        [{ resourceId: 'r', initiativeId: 'i', allocatedFte: 2, periodStart: '2026-01-01', periodEnd: '2026-12-31' }],
        [{ resourceId: 'r', availableFte: 2 }],
      );
      expect(result[0]).toMatchObject({ utilizationPct: 100, status: 'optimal' });
    });

    it('treats exactly 70% as optimal (lower boundary is not under)', () => {
      const result = computeUtilization(
        [{ resourceId: 'r', initiativeId: 'i', allocatedFte: 0.7, periodStart: '2026-01-01', periodEnd: '2026-12-31' }],
        [{ resourceId: 'r', availableFte: 1 }],
      );
      expect(result[0]).toMatchObject({ utilizationPct: 70, status: 'optimal' });
    });

    it('includes idle resources (capacity, no allocation) as under at 0%', () => {
      const result = computeUtilization([], [{ resourceId: 'idle', availableFte: 1 }]);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ resourceId: 'idle', allocatedFte: 0, utilizationPct: 0, status: 'under' });
    });

    it('handles a resource with allocation but zero capacity (utilizationPct 0, under)', () => {
      const result = computeUtilization(
        [{ resourceId: 'ghost', initiativeId: 'i', allocatedFte: 1, periodStart: '2026-01-01', periodEnd: '2026-12-31' }],
        [],
      );
      expect(result[0]).toMatchObject({ resourceId: 'ghost', allocatedFte: 1, availableFte: 0, utilizationPct: 0, status: 'under' });
    });
  });

  describe('capacityVsDemand', () => {
    it('aggregates portfolio capacity, demand and gap (positive gap)', () => {
      const result = capacityVsDemand(
        [
          { resourceId: 'a', initiativeId: 'i1', allocatedFte: 0.5, periodStart: '2026-01-01', periodEnd: '2026-03-31' },
          { resourceId: 'b', initiativeId: 'i2', allocatedFte: 1.0, periodStart: '2026-01-01', periodEnd: '2026-03-31' },
        ],
        [
          { resourceId: 'a', availableFte: 1 },
          { resourceId: 'b', availableFte: 2 },
        ],
      );
      // capacity 3, demand 1.5
      expect(result).toEqual({ totalCapacity: 3, totalDemand: 1.5, gap: 1.5, coveragePct: 200 });
    });

    it('reports a negative gap when portfolio is over-committed', () => {
      const result = capacityVsDemand(
        [{ resourceId: 'a', initiativeId: 'i', allocatedFte: 4, periodStart: '2026-01-01', periodEnd: '2026-12-31' }],
        [{ resourceId: 'a', availableFte: 2 }],
      );
      expect(result.gap).toBe(-2);
      expect(result.totalCapacity).toBe(2);
      expect(result.totalDemand).toBe(4);
      expect(result.coveragePct).toBe(50);
    });

    it('handles empty / zero-demand portfolio without dividing by zero', () => {
      const result = capacityVsDemand([], [{ resourceId: 'a', availableFte: 1 }]);
      expect(result).toEqual({ totalCapacity: 1, totalDemand: 0, gap: 1, coveragePct: 0 });
    });
  });

  describe('resourceHeatmap', () => {
    it('computes utilization per resource × period using window overlap', () => {
      const allocations: ResourceAllocation[] = [
        // Active only in Q1
        { resourceId: 'r', initiativeId: 'i1', allocatedFte: 1, periodStart: '2026-01-01', periodEnd: '2026-03-31' },
        // Active only in Q2
        { resourceId: 'r', initiativeId: 'i2', allocatedFte: 0.5, periodStart: '2026-04-01', periodEnd: '2026-06-30' },
      ];
      const capacities: ResourceCapacity[] = [{ resourceId: 'r', availableFte: 1 }];
      const periods = ['2026-02-15', '2026-05-15', '2026-08-15'];

      const result = resourceHeatmap(allocations, capacities, periods);
      expect(result).toHaveLength(1);
      const cells = result[0].cells;
      expect(cells.map((c) => c.period)).toEqual(periods);
      // Feb → i1 active → 100% optimal
      expect(cells[0]).toMatchObject({ utilizationPct: 100, status: 'optimal' });
      // May → i2 active → 50% under
      expect(cells[1]).toMatchObject({ utilizationPct: 50, status: 'under' });
      // Aug → nothing active → 0% under
      expect(cells[2]).toMatchObject({ utilizationPct: 0, status: 'under' });
    });

    it('sums overlapping allocations within the same period → over', () => {
      const allocations: ResourceAllocation[] = [
        { resourceId: 'r', initiativeId: 'i1', allocatedFte: 0.8, periodStart: '2026-01-01', periodEnd: '2026-12-31' },
        { resourceId: 'r', initiativeId: 'i2', allocatedFte: 0.5, periodStart: '2026-01-01', periodEnd: '2026-12-31' },
      ];
      const result = resourceHeatmap(allocations, [{ resourceId: 'r', availableFte: 1 }], ['2026-06-15']);
      expect(result[0].cells[0]).toMatchObject({ utilizationPct: 130, status: 'over' });
    });

    it('returns a cell per period even for resources with no allocations', () => {
      const result = resourceHeatmap([], [{ resourceId: 'idle', availableFte: 1 }], ['p1', 'p2']);
      expect(result[0].cells).toHaveLength(2);
      expect(result[0].cells.every((c) => c.utilizationPct === 0 && c.status === 'under')).toBe(true);
    });
  });

  describe('overloadAlerts', () => {
    it('returns only over-allocated resources', () => {
      const util = computeUtilization(
        [
          { resourceId: 'r-over', initiativeId: 'i', allocatedFte: 1.5, periodStart: '2026-01-01', periodEnd: '2026-12-31' },
          { resourceId: 'r-ok', initiativeId: 'i', allocatedFte: 0.8, periodStart: '2026-01-01', periodEnd: '2026-12-31' },
        ],
        [
          { resourceId: 'r-over', availableFte: 1 },
          { resourceId: 'r-ok', availableFte: 1 },
        ],
      );
      const alerts = overloadAlerts(util);
      expect(alerts).toEqual([{ resourceId: 'r-over', utilizationPct: 150 }]);
    });

    it('returns an empty array when nobody is overloaded', () => {
      const util = computeUtilization(
        [{ resourceId: 'r', initiativeId: 'i', allocatedFte: 0.5, periodStart: '2026-01-01', periodEnd: '2026-12-31' }],
        [{ resourceId: 'r', availableFte: 1 }],
      );
      expect(overloadAlerts(util)).toEqual([]);
    });
  });
});
