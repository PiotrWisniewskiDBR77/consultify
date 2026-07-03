import { describe, expect, it } from 'vitest';

import {
  lineVariance,
  varianceBridge,
  ytdVariance,
  varianceSummary,
  type VarianceLineInput,
} from '../../../server/src/services/budgetVarianceService.js';

describe('lineVariance', () => {
  it('cost line: actual < plan is favorable (saving)', () => {
    const r = lineVariance(1000, 800, true);
    expect(r.variance).toBe(-200);
    expect(r.variancePct).toBe(-0.2);
    expect(r.direction).toBe('favorable');
  });

  it('cost line: actual > plan is unfavorable (overspend)', () => {
    const r = lineVariance(1000, 1200, true);
    expect(r.variance).toBe(200);
    expect(r.variancePct).toBeCloseTo(0.2, 6);
    expect(r.direction).toBe('unfavorable');
  });

  it('revenue line: actual > plan is favorable', () => {
    const r = lineVariance(1000, 1300, false);
    expect(r.variance).toBe(300);
    expect(r.variancePct).toBeCloseTo(0.3, 6);
    expect(r.direction).toBe('favorable');
  });

  it('revenue line: actual < plan is unfavorable', () => {
    const r = lineVariance(1000, 700, false);
    expect(r.variance).toBe(-300);
    expect(r.direction).toBe('unfavorable');
  });

  it('zero delta is neutral with 0% variance', () => {
    expect(lineVariance(500, 500, true).direction).toBe('neutral');
    expect(lineVariance(500, 500, false).variancePct).toBe(0);
  });

  it('variancePct uses |plan| in denominator', () => {
    // negative plan: pct still scaled by absolute plan
    const r = lineVariance(-200, -100, true);
    expect(r.variance).toBe(100);
    expect(r.variancePct).toBe(0.5);
  });

  it('plan === 0 yields 0% (no divide-by-zero)', () => {
    const r = lineVariance(0, 50, false);
    expect(r.variance).toBe(50);
    expect(r.variancePct).toBe(0);
  });

  it('coerces non-finite inputs to 0', () => {
    const r = lineVariance(NaN, 100, false);
    expect(r.variance).toBe(100);
    expect(Number.isFinite(r.variancePct)).toBe(true);
  });
});

describe('varianceBridge', () => {
  const lines: VarianceLineInput[] = [
    { label: 'Salaries', plan: 1000, actual: 1200, isCost: true }, // unfavorable -200 fav-signed
    { label: 'Materials', plan: 500, actual: 400, isCost: true }, // favorable +100 fav-signed
    { label: 'Revenue', plan: 2000, actual: 2300, isCost: false }, // favorable +300 fav-signed
  ];

  it('starts with plan total and ends with actual total', () => {
    const b = varianceBridge(lines);
    const start = b.steps[0];
    const total = b.steps[b.steps.length - 1];

    expect(start.kind).toBe('start');
    expect(start.value).toBe(3500); // 1000+500+2000

    expect(total.kind).toBe('total');
    expect(total.value).toBe(3900); // 1200+400+2300
  });

  it('emits one step per line plus start and total', () => {
    const b = varianceBridge(lines);
    expect(b.steps).toHaveLength(lines.length + 2);
  });

  it('step kind reflects favorability direction', () => {
    const b = varianceBridge(lines);
    const byLabel = Object.fromEntries(b.steps.map((s) => [s.label, s]));

    // Salaries overspend = unfavorable = decrease, value negative
    expect(byLabel.Salaries.kind).toBe('decrease');
    expect(byLabel.Salaries.value).toBe(-200);

    // Materials saving = favorable = increase, value positive
    expect(byLabel.Materials.kind).toBe('increase');
    expect(byLabel.Materials.value).toBe(100);

    // Revenue beat = favorable = increase, value positive
    expect(byLabel.Revenue.kind).toBe('increase');
    expect(byLabel.Revenue.value).toBe(300);
  });

  it('totalVariance equals actualTotal - planTotal', () => {
    const b = varianceBridge(lines);
    expect(b.totalVariance).toBe(400); // 3900 - 3500
  });

  it('handles empty input', () => {
    const b = varianceBridge([]);
    expect(b.steps).toHaveLength(2);
    expect(b.steps[0].value).toBe(0);
    expect(b.steps[1].value).toBe(0);
    expect(b.totalVariance).toBe(0);
  });
});

describe('ytdVariance', () => {
  it('accumulates plan and actual across periods', () => {
    const r = ytdVariance([
      { plan: 100, actual: 90 },
      { plan: 200, actual: 250 },
      { plan: 300, actual: 300 },
    ]);
    expect(r.ytdPlan).toBe(600);
    expect(r.ytdActual).toBe(640);
    expect(r.ytdVariance).toBe(40);
    // variancePct is rounded to 4 decimals by the service contract
    expect(r.ytdVariancePct).toBe(0.0667);
    expect(r.ytdVariancePct).toBeCloseTo(40 / 600, 3);
  });

  it('zero plan total yields 0% variance', () => {
    const r = ytdVariance([{ plan: 0, actual: 0 }]);
    expect(r.ytdVariancePct).toBe(0);
  });

  it('handles empty periods', () => {
    const r = ytdVariance([]);
    expect(r).toEqual({ ytdPlan: 0, ytdActual: 0, ytdVariance: 0, ytdVariancePct: 0 });
  });
});

describe('varianceSummary', () => {
  const lines: VarianceLineInput[] = [
    { label: 'Salaries', plan: 1000, actual: 1200, isCost: true }, // unfavorable +200
    { label: 'Materials', plan: 500, actual: 400, isCost: true }, // favorable -100
    { label: 'Revenue', plan: 2000, actual: 2300, isCost: false }, // favorable +300
    { label: 'Travel', plan: 300, actual: 800, isCost: true }, // unfavorable +500
    { label: 'Rent', plan: 600, actual: 600, isCost: true }, // neutral 0
  ];

  it('counts favorable and unfavorable lines', () => {
    const s = varianceSummary(lines);
    expect(s.favorableCount).toBe(2); // Materials, Revenue
    expect(s.unfavorableCount).toBe(2); // Salaries, Travel
  });

  it('netVariance is the sum of signed deltas', () => {
    const s = varianceSummary(lines);
    // 200 - 100 + 300 + 500 + 0
    expect(s.netVariance).toBe(900);
  });

  it('worstLines lists biggest unfavorable swings first', () => {
    const s = varianceSummary(lines);
    expect(s.worstLines[0].label).toBe('Travel'); // +500 unfavorable
    expect(s.worstLines[0].direction).toBe('unfavorable');
    expect(s.worstLines[1].label).toBe('Salaries'); // +200 unfavorable
    // favorable/neutral lines sink below unfavorable ones
    expect(s.worstLines[2].direction).not.toBe('unfavorable');
  });

  it('caps worstLines at 5', () => {
    const many: VarianceLineInput[] = Array.from({ length: 8 }, (_, i) => ({
      label: `L${i}`,
      plan: 100,
      actual: 100 + (i + 1) * 10,
      isCost: true,
    }));
    expect(varianceSummary(many).worstLines).toHaveLength(5);
  });

  it('handles empty input', () => {
    const s = varianceSummary([]);
    expect(s).toEqual({ favorableCount: 0, unfavorableCount: 0, netVariance: 0, worstLines: [] });
  });
});
