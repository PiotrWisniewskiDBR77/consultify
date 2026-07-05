import { describe, it, expect } from 'vitest';
import {
  projectCounterfactual,
  attributableDelta,
  confidenceLabel,
} from '../../../server/src/services/results/counterfactualBaselineService.js';

describe('counterfactualBaselineService', () => {
  describe('projectCounterfactual', () => {
    it('extrapolates a clean linear pre-trend to atT', () => {
      // value = 2*t + 1 ; at t=10 → 21
      const pre = [
        { t: 0, value: 1 },
        { t: 1, value: 3 },
        { t: 2, value: 5 },
        { t: 3, value: 7 },
      ];
      const cf = projectCounterfactual(pre, 10);
      expect(cf).not.toBeNull();
      expect(cf as number).toBeCloseTo(21, 6);
    });

    it('fits a least-squares trend through noisy points', () => {
      // roughly value = t ; extrapolate to t=4
      const pre = [
        { t: 0, value: 0.1 },
        { t: 1, value: 0.9 },
        { t: 2, value: 2.1 },
        { t: 3, value: 2.9 },
      ];
      const cf = projectCounterfactual(pre, 4);
      expect(cf).not.toBeNull();
      expect(cf as number).toBeCloseTo(4, 0);
    });

    it('handles a flat pre-trend (slope 0)', () => {
      const pre = [
        { t: 0, value: 5 },
        { t: 1, value: 5 },
        { t: 2, value: 5 },
      ];
      expect(projectCounterfactual(pre, 99)).toBeCloseTo(5, 6);
    });

    it('returns null with no data', () => {
      expect(projectCounterfactual([], 5)).toBeNull();
    });

    it('returns null with a single point (no determinable trend)', () => {
      expect(projectCounterfactual([{ t: 0, value: 3 }], 5)).toBeNull();
    });

    it('returns null when all points share the same t (degenerate)', () => {
      const pre = [
        { t: 2, value: 1 },
        { t: 2, value: 9 },
      ];
      expect(projectCounterfactual(pre, 5)).toBeNull();
    });

    it('returns null for non-finite atT', () => {
      const pre = [
        { t: 0, value: 1 },
        { t: 1, value: 2 },
      ];
      expect(projectCounterfactual(pre, Number.NaN)).toBeNull();
    });

    it('ignores malformed points', () => {
      const pre = [
        { t: 0, value: 1 },
        { t: Number.NaN, value: 99 } as { t: number; value: number },
        { t: 1, value: 3 },
        { t: 2, value: 5 },
      ];
      // remaining clean points follow value = 2*t + 1 → at t=5 → 11
      expect(projectCounterfactual(pre, 5)).toBeCloseTo(11, 6);
    });
  });

  describe('attributableDelta', () => {
    it('computes attributable = observed − counterfactual', () => {
      // pre-trend value = 2*t + 1 ; counterfactual at t=10 = 21
      const pre = [
        { t: 0, value: 1 },
        { t: 1, value: 3 },
        { t: 2, value: 5 },
        { t: 3, value: 7 },
      ];
      const res = attributableDelta({ observedValue: 30, prePoints: pre, atT: 10 });
      expect(res.counterfactual as number).toBeCloseTo(21, 6);
      expect(res.attributable as number).toBeCloseTo(9, 6);
      expect(res.attributablePct as number).toBeCloseTo(9 / 21, 6);
    });

    it('yields negative attributable when observed underperforms baseline', () => {
      const pre = [
        { t: 0, value: 0 },
        { t: 1, value: 10 },
        { t: 2, value: 20 },
      ];
      // counterfactual at t=3 = 30
      const res = attributableDelta({ observedValue: 25, prePoints: pre, atT: 3 });
      expect(res.counterfactual as number).toBeCloseTo(30, 6);
      expect(res.attributable as number).toBeCloseTo(-5, 6);
      expect(res.attributablePct as number).toBeCloseTo(-5 / 30, 6);
    });

    it('returns nulls for attributable when there is no counterfactual', () => {
      const res = attributableDelta({ observedValue: 10, prePoints: [], atT: 5 });
      expect(res.counterfactual).toBeNull();
      expect(res.attributable).toBeNull();
      expect(res.attributablePct).toBeNull();
    });

    it('returns null pct when counterfactual is 0', () => {
      // value = t - 2 ; at t=2 → 0
      const pre = [
        { t: 0, value: -2 },
        { t: 1, value: -1 },
      ];
      const res = attributableDelta({ observedValue: 4, prePoints: pre, atT: 2 });
      expect(res.counterfactual as number).toBeCloseTo(0, 6);
      expect(res.attributable as number).toBeCloseTo(4, 6);
      expect(res.attributablePct).toBeNull();
    });
  });

  describe('confidenceLabel', () => {
    it('returns low with no / insufficient data', () => {
      expect(confidenceLabel([])).toBe('low');
      expect(confidenceLabel([{ t: 0, value: 1 }])).toBe('low');
    });

    it('returns high for many points with a strong fit', () => {
      const pre = [
        { t: 0, value: 0 },
        { t: 1, value: 2 },
        { t: 2, value: 4 },
        { t: 3, value: 6 },
        { t: 4, value: 8 },
      ];
      expect(confidenceLabel(pre)).toBe('high');
    });

    it('returns medium for a moderate count with a reasonable fit', () => {
      const pre = [
        { t: 0, value: 0 },
        { t: 1, value: 2 },
        { t: 2, value: 4 },
      ];
      expect(confidenceLabel(pre)).toBe('medium');
    });

    it('returns low when many points fit poorly (noisy scatter)', () => {
      const pre = [
        { t: 0, value: 10 },
        { t: 1, value: -5 },
        { t: 2, value: 8 },
        { t: 3, value: -3 },
        { t: 4, value: 9 },
      ];
      expect(confidenceLabel(pre)).toBe('low');
    });
  });
});
