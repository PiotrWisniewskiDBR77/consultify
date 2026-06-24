import { describe, expect, it } from 'vitest';

import {
  applyScenario,
  compareScenarios,
  scenarioFanData,
  SCENARIO_MODIFIERS,
  type ScenarioMetrics,
} from '../../../server/src/services/scenarioComputeService.ts';

describe('scenarioComputeService (M16/5.2 multi-scenario compute)', () => {
  describe('SCENARIO_MODIFIERS', () => {
    it('encodes base/optimistic/conservative multipliers', () => {
      expect(SCENARIO_MODIFIERS.base).toEqual({ growthMult: 1, costMult: 1 });
      expect(SCENARIO_MODIFIERS.optimistic).toEqual({ growthMult: 1.15, costMult: 0.95 });
      expect(SCENARIO_MODIFIERS.conservative).toEqual({ growthMult: 0.85, costMult: 1.05 });
    });
  });

  describe('applyScenario', () => {
    const assumptions = {
      revenueGrowth: 0.1,
      annualRevenue: 1000,
      opex: 200,
      cogs: 400,
      fixedCost: 50,
      headcount: 12, // unmatched → unchanged
      label: 'plan-A', // non-numeric → unchanged
    };

    it('optimistic: growth/revenue ↑ and costs ↓', () => {
      const out = applyScenario(assumptions, 'optimistic');
      expect(out.revenueGrowth).toBeCloseTo(0.1 * 1.15, 10);
      expect(out.annualRevenue).toBeCloseTo(1000 * 1.15, 10);
      expect(out.opex).toBeCloseTo(200 * 0.95, 10);
      expect(out.cogs).toBeCloseTo(400 * 0.95, 10);
      expect(out.fixedCost).toBeCloseTo(50 * 0.95, 10);
      // untouched fields
      expect(out.headcount).toBe(12);
      expect(out.label).toBe('plan-A');
    });

    it('conservative: growth/revenue ↓ and costs ↑', () => {
      const out = applyScenario(assumptions, 'conservative');
      expect(out.annualRevenue).toBeCloseTo(1000 * 0.85, 10);
      expect(out.opex).toBeCloseTo(200 * 1.05, 10);
      expect(out.cogs).toBeCloseTo(400 * 1.05, 10);
    });

    it('base: identity (no scaling)', () => {
      const out = applyScenario(assumptions, 'base');
      expect(out.annualRevenue).toBe(1000);
      expect(out.opex).toBe(200);
    });

    it('does not mutate the original assumptions object', () => {
      const original = { annualRevenue: 1000, opex: 200 };
      applyScenario(original, 'optimistic');
      expect(original.annualRevenue).toBe(1000);
      expect(original.opex).toBe(200);
    });

    it('scales nested structures recursively (e.g. baseline)', () => {
      const nested = { baseline: { revenue: 1000, cogs: 400, opex: 100 } };
      const out = applyScenario(nested, 'optimistic');
      expect(out.baseline.revenue).toBeCloseTo(1150, 10);
      expect(out.baseline.cogs).toBeCloseTo(380, 10);
      expect(out.baseline.opex).toBeCloseTo(95, 10);
    });
  });

  describe('compareScenarios', () => {
    // A toy compute fn: revenue line minus cost lines.
    const computeFn = (a: Record<string, any>): ScenarioMetrics => {
      const revenue = a.annualRevenue ?? 0;
      const cost = (a.opex ?? 0) + (a.cogs ?? 0);
      return { revenue, ebitda: revenue - cost };
    };

    const base = { annualRevenue: 1000, opex: 200, cogs: 400 };

    it('orders revenue optimistic > base > conservative', () => {
      const cmp = compareScenarios(base, computeFn);
      expect(cmp.optimistic.revenue).toBeGreaterThan(cmp.base.revenue);
      expect(cmp.base.revenue).toBeGreaterThan(cmp.conservative.revenue);
    });

    it('orders ebitda optimistic > base > conservative', () => {
      const cmp = compareScenarios(base, computeFn);
      expect(cmp.optimistic.ebitda).toBeGreaterThan(cmp.base.ebitda);
      expect(cmp.base.ebitda).toBeGreaterThan(cmp.conservative.ebitda);
    });

    it('reports deltas vs base (optimistic positive, conservative negative)', () => {
      const cmp = compareScenarios(base, computeFn);
      expect(cmp.deltas.optimistic.revenue).toBeCloseTo(
        cmp.optimistic.revenue - cmp.base.revenue,
        10,
      );
      expect(cmp.deltas.optimistic.revenue).toBeGreaterThan(0);
      expect(cmp.deltas.conservative.revenue).toBeLessThan(0);
    });
  });

  describe('scenarioFanData', () => {
    const scenarios = {
      base: { revenue: [100, 110, 120] },
      optimistic: { revenue: [115, 130, 145] },
      conservative: { revenue: [85, 90, 95] },
    };

    it('returns the base series and optimistic/conservative bands', () => {
      const fan = scenarioFanData(scenarios, 'revenue');
      expect(fan.base).toEqual([100, 110, 120]);
      expect(fan.bands).toHaveLength(2);
      const labels = fan.bands.map((b) => b.label);
      expect(labels).toContain('optimistic');
      expect(labels).toContain('conservative');
      const opt = fan.bands.find((b) => b.label === 'optimistic');
      expect(opt?.values).toEqual([115, 130, 145]);
    });

    it('falls back to empty arrays for a missing metric', () => {
      const fan = scenarioFanData(scenarios, 'ebitda');
      expect(fan.base).toEqual([]);
      expect(fan.bands.every((b) => b.values.length === 0)).toBe(true);
    });
  });
});
