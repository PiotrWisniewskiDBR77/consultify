import { describe, expect, it } from 'vitest';

import {
  FUNNEL_ORDER,
  buildFunnel,
  funnelConversion,
  mapInitiativeToFunnel,
  valueAtRisk,
  type FunnelItem,
} from '../../../server/src/services/results/valueFunnelService.js';

describe('valueFunnelService', () => {
  describe('buildFunnel', () => {
    it('aggregates count/value/riskAdjustedValue per stage', () => {
      const items: FunnelItem[] = [
        { funnelStage: 'ideas', value: 100, confidence: 0.5 },
        { funnelStage: 'ideas', value: 200, confidence: 1 },
        { funnelStage: 'validated', value: 300, confidence: 0.8 },
        { funnelStage: 'realized', value: 50 }, // brak confidence → 1
      ];
      const funnel = buildFunnel(items);

      // kolejność zawsze wg FUNNEL_ORDER
      expect(funnel.map((f) => f.stage)).toEqual([...FUNNEL_ORDER]);

      const ideas = funnel.find((f) => f.stage === 'ideas')!;
      expect(ideas.count).toBe(2);
      expect(ideas.value).toBe(300);
      expect(ideas.riskAdjustedValue).toBe(100 * 0.5 + 200 * 1); // 250

      const validated = funnel.find((f) => f.stage === 'validated')!;
      expect(validated.count).toBe(1);
      expect(validated.value).toBe(300);
      expect(validated.riskAdjustedValue).toBeCloseTo(240); // 300 * 0.8

      const realized = funnel.find((f) => f.stage === 'realized')!;
      expect(realized.count).toBe(1);
      expect(realized.riskAdjustedValue).toBe(50); // brak confidence → ×1
    });

    it('includes every stage even when empty (count/value=0)', () => {
      const funnel = buildFunnel([{ funnelStage: 'ideas', value: 10 }]);
      expect(funnel).toHaveLength(FUNNEL_ORDER.length);

      const inflight = funnel.find((f) => f.stage === 'inflight')!;
      expect(inflight).toEqual({
        stage: 'inflight',
        count: 0,
        value: 0,
        riskAdjustedValue: 0,
      });
    });

    it('handles empty input — all stages zeroed', () => {
      const funnel = buildFunnel([]);
      expect(funnel).toHaveLength(4);
      expect(funnel.every((f) => f.count === 0 && f.value === 0)).toBe(true);
    });

    it('clamps out-of-range confidence (>1 → 1, <0 → 0)', () => {
      const funnel = buildFunnel([
        { funnelStage: 'ideas', value: 100, confidence: 5 },
        { funnelStage: 'validated', value: 100, confidence: -2 },
      ]);
      expect(funnel.find((f) => f.stage === 'ideas')!.riskAdjustedValue).toBe(
        100,
      );
      expect(
        funnel.find((f) => f.stage === 'validated')!.riskAdjustedValue,
      ).toBe(0);
    });
  });

  describe('funnelConversion', () => {
    it('computes conversion pct and leakage between adjacent stages', () => {
      const funnel = buildFunnel([
        { funnelStage: 'ideas', value: 1000 },
        { funnelStage: 'validated', value: 600 },
        { funnelStage: 'inflight', value: 300 },
        { funnelStage: 'realized', value: 120 },
      ]);
      const conv = funnelConversion(funnel);

      expect(conv).toHaveLength(3);

      expect(conv[0]).toMatchObject({
        from: 'ideas',
        to: 'validated',
        conversionPct: 60,
        leakageValue: 400,
      });
      expect(conv[1]).toMatchObject({
        from: 'validated',
        to: 'inflight',
        conversionPct: 50,
        leakageValue: 300,
      });
      expect(conv[2]).toMatchObject({
        from: 'inflight',
        to: 'realized',
        conversionPct: 40,
        leakageValue: 180,
      });
    });

    it('conversion 0 and leakage 0 when from-stage value is 0', () => {
      const funnel = buildFunnel([{ funnelStage: 'validated', value: 100 }]);
      const conv = funnelConversion(funnel);
      // ideas=0 → validated=100
      expect(conv[0]).toMatchObject({
        from: 'ideas',
        to: 'validated',
        conversionPct: 0,
        leakageValue: 0, // max(0, 0-100)=0, brak ujemnego wycieku
      });
    });

    it('no negative leakage when value grows downstream', () => {
      const funnel = buildFunnel([
        { funnelStage: 'ideas', value: 100 },
        { funnelStage: 'validated', value: 150 },
      ]);
      const conv = funnelConversion(funnel);
      expect(conv[0].conversionPct).toBe(150);
      expect(conv[0].leakageValue).toBe(0);
    });
  });

  describe('valueAtRisk', () => {
    it('flags items with confidence < 0.5', () => {
      const res = valueAtRisk([
        { value: 100, confidence: 0.4 },
        { value: 200, confidence: 0.5 }, // próg — NIE at-risk
        { value: 300, confidence: 0.9 },
      ]);
      expect(res.atRiskValue).toBe(100);
      expect(res.atRiskCount).toBe(1);
    });

    it('flags items behindPlan regardless of confidence', () => {
      const res = valueAtRisk([
        { value: 100, confidence: 0.9, behindPlan: true },
        { value: 50, confidence: 0.95, behindPlan: false },
      ]);
      expect(res.atRiskValue).toBe(100);
      expect(res.atRiskCount).toBe(1);
    });

    it('OR semantics — low confidence OR behind both count once', () => {
      const res = valueAtRisk([
        { value: 100, confidence: 0.2, behindPlan: true },
        { value: 200, confidence: 0.3 },
        { value: 300, confidence: 1, behindPlan: true },
        { value: 400, confidence: 1 }, // safe
      ]);
      expect(res.atRiskValue).toBe(600);
      expect(res.atRiskCount).toBe(3);
    });

    it('missing confidence counts as full trust (not at risk)', () => {
      const res = valueAtRisk([{ value: 100 }]);
      expect(res).toEqual({ atRiskValue: 0, atRiskCount: 0 });
    });

    it('empty input → zeroed', () => {
      expect(valueAtRisk([])).toEqual({ atRiskValue: 0, atRiskCount: 0 });
    });
  });

  describe('mapInitiativeToFunnel', () => {
    it('maps DRAFT/REVIEWING → ideas', () => {
      expect(mapInitiativeToFunnel('DRAFT')).toBe('ideas');
      expect(mapInitiativeToFunnel('REVIEWING')).toBe('ideas');
    });

    it('maps APPROVED/SCHEDULED → validated', () => {
      expect(mapInitiativeToFunnel('APPROVED')).toBe('validated');
      expect(mapInitiativeToFunnel('SCHEDULED')).toBe('validated');
    });

    it('maps EXECUTING/BLOCKED → inflight', () => {
      expect(mapInitiativeToFunnel('EXECUTING')).toBe('inflight');
      expect(mapInitiativeToFunnel('BLOCKED')).toBe('inflight');
    });

    it('maps DONE/TRACKING → realized', () => {
      expect(mapInitiativeToFunnel('DONE')).toBe('realized');
      expect(mapInitiativeToFunnel('TRACKING')).toBe('realized');
    });

    it('is case-insensitive', () => {
      expect(mapInitiativeToFunnel('done')).toBe('realized');
      expect(mapInitiativeToFunnel('Executing')).toBe('inflight');
    });

    it('unknown/undefined status → ideas (widest stage)', () => {
      expect(mapInitiativeToFunnel(undefined)).toBe('ideas');
      expect(mapInitiativeToFunnel('SOMETHING_ELSE')).toBe('ideas');
    });
  });
});
