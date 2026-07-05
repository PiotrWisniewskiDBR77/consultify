import { describe, expect, it } from 'vitest';

import {
  hurdleRate,
  riskAdjustedNpv,
  evaluateAgainstHurdle,
  rankByRiskAdjusted,
  RISK_PREMIUM_PP,
} from '../../../server/src/services/capitalDecisionService.js';

describe('capitalDecisionService — 4.1 hurdleRate', () => {
  it('core adds +0 pp', () => {
    expect(hurdleRate(12, 'core')).toBe(12);
  });

  it('rdzeń (PL alias) adds +0 pp', () => {
    expect(hurdleRate(8, 'rdzeń')).toBe(8);
  });

  it('transformation adds +4 pp', () => {
    expect(hurdleRate(12, 'transformation')).toBe(16);
  });

  it('rd adds +10 pp', () => {
    expect(hurdleRate(12, 'rd')).toBe(22);
  });

  it('new_market alias maps to rd (+10 pp)', () => {
    expect(hurdleRate(10, 'new_market')).toBe(20);
  });

  it('exposes the premium table', () => {
    expect(RISK_PREMIUM_PP).toEqual({ core: 0, transformation: 4, rd: 10 });
  });
});

describe('capitalDecisionService — 4.3 riskAdjustedNpv', () => {
  it('P=0.7 => 70% of NPV when no leakage', () => {
    const r = riskAdjustedNpv(100_000, 0.7);
    expect(r.rnpv).toBeCloseTo(70_000, 6);
    expect(r.haircut).toBeCloseTo(30_000, 6);
  });

  it('applies leakage on top of probability', () => {
    // 100k × 0.7 × (1 − 0.1) = 63k
    const r = riskAdjustedNpv(100_000, 0.7, 0.1);
    expect(r.rnpv).toBeCloseTo(63_000, 6);
    expect(r.haircut).toBeCloseTo(37_000, 6);
  });

  it('leakage defaults to 0', () => {
    const r = riskAdjustedNpv(50_000, 1);
    expect(r.rnpv).toBeCloseTo(50_000, 6);
    expect(r.haircut).toBeCloseTo(0, 6);
  });

  it('haircut always equals npv − rnpv', () => {
    const r = riskAdjustedNpv(200_000, 0.45, 0.2);
    expect(r.haircut).toBeCloseTo(200_000 - r.rnpv, 6);
  });

  it('clamps out-of-range probability and leakage to [0,1]', () => {
    const r = riskAdjustedNpv(100_000, 1.5, -0.3);
    // P clamped to 1, leakage clamped to 0 => full NPV
    expect(r.rnpv).toBeCloseTo(100_000, 6);
  });
});

describe('capitalDecisionService — evaluateAgainstHurdle', () => {
  it('margin > 2pp => go', () => {
    const r = evaluateAgainstHurdle(20, 12);
    expect(r.verdict).toBe('go');
    expect(r.marginPp).toBeCloseTo(8, 6);
  });

  it('margin between 0 and 2pp => borderline', () => {
    const r = evaluateAgainstHurdle(13, 12);
    expect(r.verdict).toBe('borderline');
    expect(r.marginPp).toBeCloseTo(1, 6);
  });

  it('margin exactly 0 => borderline', () => {
    const r = evaluateAgainstHurdle(12, 12);
    expect(r.verdict).toBe('borderline');
    expect(r.marginPp).toBe(0);
  });

  it('exactly +2pp is still borderline (boundary is > 2)', () => {
    const r = evaluateAgainstHurdle(14, 12);
    expect(r.verdict).toBe('borderline');
    expect(r.marginPp).toBeCloseTo(2, 6);
  });

  it('negative margin => kill', () => {
    const r = evaluateAgainstHurdle(9, 12);
    expect(r.verdict).toBe('kill');
    expect(r.marginPp).toBeCloseTo(-3, 6);
  });
});

describe('capitalDecisionService — rankByRiskAdjusted', () => {
  it('sorts items by rNPV descending', () => {
    const ranked = rankByRiskAdjusted([
      { id: 'a', npv: 100_000, probabilityOfSuccess: 0.5 }, // 50k
      { id: 'b', npv: 100_000, probabilityOfSuccess: 0.9 }, // 90k
      { id: 'c', npv: 200_000, probabilityOfSuccess: 0.3, leakagePct: 0.5 }, // 30k
    ]);

    expect(ranked.map((r) => r.id)).toEqual(['b', 'a', 'c']);
    expect(ranked[0].rnpv).toBeCloseTo(90_000, 6);
    expect(ranked[1].rnpv).toBeCloseTo(50_000, 6);
    expect(ranked[2].rnpv).toBeCloseTo(30_000, 6);
  });

  it('attaches rnpv and haircut to each item', () => {
    const ranked = rankByRiskAdjusted([
      { id: 'x', npv: 100_000, probabilityOfSuccess: 0.7, leakagePct: 0.1 },
    ]);
    expect(ranked[0].rnpv).toBeCloseTo(63_000, 6);
    expect(ranked[0].haircut).toBeCloseTo(37_000, 6);
  });

  it('does not mutate the input array', () => {
    const input = [
      { id: 'a', npv: 100_000, probabilityOfSuccess: 0.5 },
      { id: 'b', npv: 100_000, probabilityOfSuccess: 0.9 },
    ];
    const snapshot = input.map((i) => i.id);
    rankByRiskAdjusted(input);
    expect(input.map((i) => i.id)).toEqual(snapshot);
  });

  it('handles empty input', () => {
    expect(rankByRiskAdjusted([])).toEqual([]);
  });
});
