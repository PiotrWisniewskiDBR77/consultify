import { describe, it, expect } from 'vitest';
import {
  oneWaySensitivity,
  tornado,
  dataTable2D,
  breakEven,
  type Drivers,
} from '../../../server/src/services/whatIfSensitivityService.js';

// Linear target: profit = price * volume - fixedCost
// Driver values chosen so signs/impacts are predictable.
const baseDrivers: Drivers = {
  price: 100,
  volume: 50,
  fixedCost: 1000,
};

const profitFn = (d: Drivers): number => d.price * d.volume - d.fixedCost;

describe('whatIfSensitivityService', () => {
  describe('oneWaySensitivity', () => {
    it('returns one point per delta in order', () => {
      const range = [-20, -10, 0, 10, 20];
      const rows = oneWaySensitivity(baseDrivers, profitFn, 'price', range);
      expect(rows.map((r) => r.deltaPct)).toEqual(range);
    });

    it('is monotonically increasing for a positively-correlated linear driver', () => {
      const rows = oneWaySensitivity(baseDrivers, profitFn, 'price');
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i].targetValue).toBeGreaterThan(rows[i - 1].targetValue);
      }
    });

    it('delta=0 reproduces the base target', () => {
      const rows = oneWaySensitivity(baseDrivers, profitFn, 'price', [0]);
      expect(rows[0].targetValue).toBe(profitFn(baseDrivers));
    });

    it('is monotonically decreasing for a negatively-correlated driver', () => {
      const rows = oneWaySensitivity(baseDrivers, profitFn, 'fixedCost');
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i].targetValue).toBeLessThan(rows[i - 1].targetValue);
      }
    });

    it('uses the default range when none is supplied', () => {
      const rows = oneWaySensitivity(baseDrivers, profitFn, 'price');
      expect(rows.map((r) => r.deltaPct)).toEqual([-20, -10, 0, 10, 20]);
    });

    it('does not mutate the base drivers', () => {
      const snapshot = { ...baseDrivers };
      oneWaySensitivity(baseDrivers, profitFn, 'price');
      expect(baseDrivers).toEqual(snapshot);
    });
  });

  describe('tornado', () => {
    it('reports the unmodified base target', () => {
      const { base } = tornado(baseDrivers, profitFn, ['price', 'volume', 'fixedCost']);
      expect(base).toBe(profitFn(baseDrivers));
    });

    it('emits one bar per driver with the expected shape', () => {
      const { bars } = tornado(baseDrivers, profitFn, ['price', 'volume', 'fixedCost']);
      expect(bars).toHaveLength(3);
      for (const bar of bars) {
        expect(bar).toHaveProperty('label');
        expect(bar).toHaveProperty('low');
        expect(bar).toHaveProperty('high');
        expect(typeof bar.low).toBe('number');
        expect(typeof bar.high).toBe('number');
      }
    });

    it('sorts bars by descending impact (|high - low|)', () => {
      const { bars } = tornado(baseDrivers, profitFn, ['fixedCost', 'price', 'volume']);
      const impacts = bars.map((b) => Math.abs(b.high - b.low));
      for (let i = 1; i < impacts.length; i++) {
        expect(impacts[i]).toBeLessThanOrEqual(impacts[i - 1]);
      }
      // price & volume each swing ±20% of 5000 (=±1000 -> impact 2000),
      // fixedCost swings ±20% of 1000 (=±200 -> impact 400), so it ranks last.
      expect(bars[bars.length - 1].label).toBe('fixedCost');
    });

    it('honors a custom swingPct', () => {
      const small = tornado(baseDrivers, profitFn, ['price'], 5);
      const big = tornado(baseDrivers, profitFn, ['price'], 40);
      const smallImpact = Math.abs(small.bars[0].high - small.bars[0].low);
      const bigImpact = Math.abs(big.bars[0].high - big.bars[0].low);
      expect(bigImpact).toBeGreaterThan(smallImpact);
    });
  });

  describe('dataTable2D', () => {
    it('builds an x by y matrix with matching labels', () => {
      const xRange = [80, 100, 120];
      const yRange = [40, 50];
      const { xLabels, yLabels, matrix } = dataTable2D(
        baseDrivers,
        profitFn,
        'price',
        'volume',
        xRange,
        yRange,
      );
      expect(xLabels).toEqual(xRange);
      expect(yLabels).toEqual(yRange);
      expect(matrix).toHaveLength(xRange.length * yRange.length);
    });

    it('computes each cell from the absolute x/y driver values', () => {
      const { matrix } = dataTable2D(
        baseDrivers,
        profitFn,
        'price',
        'volume',
        [100],
        [50],
      );
      // price=100, volume=50, fixedCost=1000 -> 100*50 - 1000 = 4000
      expect(matrix[0]).toEqual({ x: 100, y: 50, value: 4000 });
    });

    it('covers the full cartesian product', () => {
      const xRange = [1, 2];
      const yRange = [10, 20, 30];
      const { matrix } = dataTable2D(
        baseDrivers,
        profitFn,
        'price',
        'volume',
        xRange,
        yRange,
      );
      for (const y of yRange) {
        for (const x of xRange) {
          expect(matrix.some((c) => c.x === x && c.y === y)).toBe(true);
        }
      }
    });
  });

  describe('breakEven', () => {
    it('finds the driver value where the target is zero', () => {
      // profit = price * 50 - 1000 = 0  =>  price = 20
      const value = breakEven(baseDrivers, profitFn, 'price');
      expect(value).not.toBeNull();
      expect(value).toBeCloseTo(20, 6);
    });

    it('finds a non-zero break-even target', () => {
      // price * 50 - 1000 = 1500  =>  price = 50
      const value = breakEven(baseDrivers, profitFn, 'price', 1500);
      expect(value).toBeCloseTo(50, 6);
    });

    it('verifies the found root actually zeroes the target', () => {
      const value = breakEven(baseDrivers, profitFn, 'volume');
      expect(value).not.toBeNull();
      const atRoot = profitFn({ ...baseDrivers, volume: value as number });
      expect(atRoot).toBeCloseTo(0, 4);
    });

    it('returns null when the target never crosses zero', () => {
      // Constant positive target: no driver value yields 0.
      const value = breakEven(baseDrivers, () => 42, 'price');
      expect(value).toBeNull();
    });
  });
});
