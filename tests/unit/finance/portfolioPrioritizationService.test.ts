import { describe, it, expect } from 'vitest';

import {
  prioritize,
  bubbleData,
  QUADRANT_COLORS,
  type PortfolioInitiativeInput,
} from '../../../server/src/services/portfolioPrioritizationService.js';

/**
 * Four-corner fixture. With four points the median NPV and median risk
 * land between the corners, so each corner falls into a distinct quadrant:
 *   - high npv + low  risk -> fund
 *   - high npv + high risk -> evaluate
 *   - low  npv + low  risk -> quick_win
 *   - low  npv + high risk -> defer
 */
const corners: PortfolioInitiativeInput[] = [
  { id: 'hi-lo', name: 'High NPV / Low risk', npv: 1000, risk: 0.1, effort: 5 },
  { id: 'hi-hi', name: 'High NPV / High risk', npv: 900, risk: 0.9, effort: 8 },
  { id: 'lo-lo', name: 'Low NPV / Low risk', npv: 100, risk: 0.2, effort: 2 },
  { id: 'lo-hi', name: 'Low NPV / High risk', npv: 50, risk: 0.8, effort: 3 },
];

function byId(rows: ReturnType<typeof prioritize>) {
  return new Map(rows.map((r) => [r.id, r]));
}

describe('portfolioPrioritizationService.prioritize — quadrants', () => {
  it('classifies the four corners into the four quadrants', () => {
    const map = byId(prioritize(corners));
    expect(map.get('hi-lo')!.quadrant).toBe('fund');
    expect(map.get('hi-hi')!.quadrant).toBe('evaluate');
    expect(map.get('lo-lo')!.quadrant).toBe('quick_win');
    expect(map.get('lo-hi')!.quadrant).toBe('defer');
  });

  it('returns an empty array for empty input', () => {
    expect(prioritize([])).toEqual([]);
    // @ts-expect-error — guarding non-array runtime input
    expect(prioritize(undefined)).toEqual([]);
  });

  it('clamps risk and strategicFit into 0..1', () => {
    const [row] = prioritize([
      { id: 'x', npv: 10, risk: 5, effort: 1, strategicFit: 2 },
    ]);
    expect(row.risk).toBe(1);
    expect(row.strategicFit).toBe(1);
  });
});

describe('portfolioPrioritizationService.prioritize — rank', () => {
  it('ranks by npv / (1 + risk) descending', () => {
    // a: 1000/1.1  = 909.09  -> highest
    // b: 900/1.9   = 473.68
    // c: 100/1.2   = 83.33
    // d: 50/1.8    = 27.78   -> lowest
    const rows = prioritize(corners);
    const map = byId(rows);
    expect(map.get('hi-lo')!.rank).toBe(1);
    expect(map.get('hi-hi')!.rank).toBe(2);
    expect(map.get('lo-lo')!.rank).toBe(3);
    expect(map.get('lo-hi')!.rank).toBe(4);
  });

  it('prefers lower risk when raw NPV is equal (value/risk)', () => {
    const rows = prioritize([
      { id: 'risky', npv: 500, risk: 0.9, effort: 1 },
      { id: 'safe', npv: 500, risk: 0.1, effort: 1 },
    ]);
    const map = byId(rows);
    expect(map.get('safe')!.rank).toBe(1);
    expect(map.get('risky')!.rank).toBe(2);
  });

  it('produces a contiguous 1..N ranking with no duplicates', () => {
    const ranks = prioritize(corners)
      .map((r) => r.rank)
      .sort((a, b) => a - b);
    expect(ranks).toEqual([1, 2, 3, 4]);
  });
});

describe('portfolioPrioritizationService.bubbleData — shape', () => {
  it('maps x=risk, y=npv, size=effort and color by quadrant', () => {
    const points = bubbleData(corners);
    const map = new Map(points.map((p) => [p.id, p]));

    const fund = map.get('hi-lo')!;
    expect(fund.x).toBe(0.1);
    expect(fund.y).toBe(1000);
    expect(fund.size).toBe(5);
    expect(fund.color).toBe(QUADRANT_COLORS.fund);
    expect(fund.label).toBe('High NPV / Low risk');

    expect(map.get('hi-hi')!.color).toBe(QUADRANT_COLORS.evaluate);
    expect(map.get('lo-lo')!.color).toBe(QUADRANT_COLORS.quick_win);
    expect(map.get('lo-hi')!.color).toBe(QUADRANT_COLORS.defer);
  });

  it('falls back to id for the label when name is absent', () => {
    const [p] = bubbleData([{ id: 'noname', npv: 1, risk: 0, effort: 1 }]);
    expect(p.label).toBe('noname');
  });

  it('returns one bubble per initiative', () => {
    expect(bubbleData(corners)).toHaveLength(corners.length);
  });
});
