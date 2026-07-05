import { describe, expect, it } from 'vitest';

import {
  buildScorecard,
  topBenefits,
  topRisks,
  valueWaterfall,
  type ScorecardItem,
} from '../../../server/src/services/results/transformationScorecardService.js';

const items: ScorecardItem[] = [
  { id: 'a', name: 'Alpha', targetValue: 100, realizedValue: 60, forecastValue: 30 },
  { id: 'b', name: 'Beta', targetValue: 200, realizedValue: 0, forecastValue: 150 },
  { id: 'c', name: 'Gamma', targetValue: 100, realizedValue: 0, forecastValue: 80, atRisk: true },
  { id: 'd', name: 'Delta', targetValue: 100, realizedValue: 40, forecastValue: 20 },
];

describe('buildScorecard', () => {
  it('aggregates banked / inFlight / atRisk / totals', () => {
    const sc = buildScorecard({ items });

    // banked = Σ realized = 60 + 0 + 0 + 40
    expect(sc.banked).toBe(100);
    // inFlight = forecast of non-at-risk, not-yet-realized items = Beta(150)
    expect(sc.inFlight).toBe(150);
    // atRisk = forecast of at-risk items = Gamma(80)
    expect(sc.atRisk).toBe(80);
    // totalTarget = 100 + 200 + 100 + 100
    expect(sc.totalTarget).toBe(500);
    expect(sc.itemCount).toBe(4);
  });

  it('computes pctOfTarget = (banked + inFlight) / totalTarget', () => {
    const sc = buildScorecard({ items });
    expect(sc.pctOfTarget).toBeCloseTo((100 + 150) / 500, 10); // 0.5
    expect(sc.bankedPct).toBeCloseTo(100 / 500, 10); // 0.2
  });

  it('excludes realized items from inFlight even if they carry a forecast', () => {
    // Alpha & Delta are realized (>0) → their forecast must NOT count as inFlight.
    const sc = buildScorecard({ items });
    expect(sc.inFlight).toBe(150); // not 150 + 30 + 20
  });

  it('handles empty / missing input without dividing by zero', () => {
    const sc = buildScorecard({ items: [] });
    expect(sc).toEqual({
      banked: 0,
      inFlight: 0,
      atRisk: 0,
      totalTarget: 0,
      pctOfTarget: 0,
      bankedPct: 0,
      itemCount: 0,
    });
  });

  it('coerces null/undefined numeric fields to 0', () => {
    const sc = buildScorecard({
      items: [{ id: 'x', targetValue: null, realizedValue: undefined, forecastValue: null }],
    });
    expect(sc.banked).toBe(0);
    expect(sc.inFlight).toBe(0);
    expect(sc.totalTarget).toBe(0);
    expect(sc.itemCount).toBe(1);
  });
});

describe('topBenefits', () => {
  it('sorts by realizedValue descending and limits to n', () => {
    const top = topBenefits(items, 2);
    expect(top.map((b) => b.id)).toEqual(['a', 'd']); // 60, 40
    expect(top[0]).toEqual({ id: 'a', name: 'Alpha', realizedValue: 60 });
  });

  it('defaults to n=5 and includes zero-realized items at the bottom', () => {
    const top = topBenefits(items);
    expect(top).toHaveLength(4);
    expect(top.map((b) => b.realizedValue)).toEqual([60, 40, 0, 0]);
  });

  it('returns [] for empty input', () => {
    expect(topBenefits([])).toEqual([]);
  });
});

describe('topRisks', () => {
  it('considers only at-risk items, sorted by forecast descending', () => {
    const moreRisk: ScorecardItem[] = [
      ...items,
      { id: 'e', name: 'Eps', forecastValue: 200, atRisk: true },
      { id: 'f', name: 'Zeta', forecastValue: 999, atRisk: false },
    ];
    const risks = topRisks(moreRisk, 5);
    expect(risks.map((r) => r.id)).toEqual(['e', 'c']); // 200, 80 — Zeta excluded (not at-risk)
    expect(risks[0]).toEqual({ id: 'e', name: 'Eps', atRiskValue: 200 });
  });

  it('limits to n', () => {
    const risks = topRisks(
      [
        { id: '1', forecastValue: 10, atRisk: true },
        { id: '2', forecastValue: 20, atRisk: true },
        { id: '3', forecastValue: 30, atRisk: true },
      ],
      2,
    );
    expect(risks.map((r) => r.id)).toEqual(['3', '2']);
  });

  it('returns [] when nothing is at risk', () => {
    expect(topRisks([{ id: '1', forecastValue: 10 }])).toEqual([]);
  });
});

describe('valueWaterfall', () => {
  it('builds base → increments → total with running from/to', () => {
    const steps = valueWaterfall({
      baseline: 100,
      increments: [
        { label: 'Banked', delta: 50 },
        { label: 'Risk loss', delta: -30 },
        { label: 'In flight', delta: 20 },
      ],
    });

    expect(steps).toEqual([
      { label: 'Baseline', from: 0, to: 100, delta: 100, type: 'base' },
      { label: 'Banked', from: 100, to: 150, delta: 50, type: 'increase' },
      { label: 'Risk loss', from: 150, to: 120, delta: -30, type: 'decrease' },
      { label: 'In flight', from: 120, to: 140, delta: 20, type: 'increase' },
      { label: 'Total', from: 0, to: 140, delta: 140, type: 'total' },
    ]);
  });

  it('classifies delta >= 0 as increase, < 0 as decrease', () => {
    const steps = valueWaterfall({
      baseline: 0,
      increments: [
        { label: 'zero', delta: 0 },
        { label: 'down', delta: -5 },
      ],
    });
    expect(steps[1].type).toBe('increase'); // delta 0 → increase
    expect(steps[2].type).toBe('decrease');
  });

  it('handles no increments: base then total at baseline', () => {
    const steps = valueWaterfall({ baseline: 77, increments: [] });
    expect(steps).toHaveLength(2);
    expect(steps[0].type).toBe('base');
    expect(steps[1]).toEqual({ label: 'Total', from: 0, to: 77, delta: 77, type: 'total' });
  });
});
