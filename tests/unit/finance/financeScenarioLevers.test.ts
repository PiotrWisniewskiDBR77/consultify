import { describe, expect, it } from 'vitest';

import {
  leversFor,
  recommendLever,
  BUSINESS_LEVERS,
  type LeverOutcome,
} from '../../../server/src/services/financeScenarioLevers.ts';

describe('BUSINESS_LEVERS', () => {
  it('names scenarios as business decisions, not ±% bands', () => {
    const pl = leversFor('pl');
    const names = pl.map((l) => l.name);
    expect(names).toContain('Agresywna automatyzacja');
    expect(names).toContain('Ostrożna modernizacja');
    // No lever name is a bare percentage band
    for (const n of names) expect(n).not.toMatch(/[+-]?\d+%/);
  });

  it('every lever carries a hypothesis and a driver rationale (R2 causality)', () => {
    for (const lang of ['pl', 'en'] as const) {
      for (const lever of BUSINESS_LEVERS[lang]) {
        expect(lever.hypothesis.length).toBeGreaterThan(10);
        expect(lever.driverRationale.length).toBeGreaterThan(10);
        expect(['low', 'medium', 'high']).toContain(lever.risk);
        expect(Number.isFinite(lever.multiplier.growthMult)).toBe(true);
        expect(Number.isFinite(lever.multiplier.costMult)).toBe(true);
      }
    }
  });

  it('keeps a status-quo anchor (1.0/1.0) to beat', () => {
    const sq = leversFor('pl').find((l) => l.id === 'status_quo')!;
    expect(sq.multiplier.growthMult).toBe(1);
    expect(sq.multiplier.costMult).toBe(1);
  });
});

describe('recommendLever', () => {
  const levers = leversFor('pl');
  const byId = (id: string) => levers.find((l) => l.id === id)!;

  it('prefers a solid lever over a higher raw number that is high-risk', () => {
    // aggressive_automation has the biggest raw metric but high risk;
    // cautious_modernization is lower raw but low risk.
    const outcomes: LeverOutcome[] = [
      { lever: byId('status_quo'), metric: 0, deltaVsStatusQuo: 0 },
      { lever: byId('aggressive_automation'), metric: 1000, deltaVsStatusQuo: 1000 }, // ×0.7 = 700
      { lever: byId('cautious_modernization'), metric: 800, deltaVsStatusQuo: 800 }, // ×1.0 = 800
    ];
    const rec = recommendLever(outcomes, 'pl', true)!;
    expect(rec.chosenId).toBe('cautious_modernization');
    expect(rec.rejectedId).toBe('aggressive_automation');
    expect(rec.tradeoff).toContain('KOSZTEM');
    expect(rec.rationale.length).toBeGreaterThan(0);
    expect(rec.verdict).toContain('Ostrożna modernizacja');
  });

  it('honours higherIsBetter=false (e.g. payback months — smaller is better)', () => {
    const outcomes: LeverOutcome[] = [
      { lever: byId('aggressive_automation'), metric: 12, deltaVsStatusQuo: -12 }, // low months but high risk
      { lever: byId('cautious_modernization'), metric: 18, deltaVsStatusQuo: -6 },
    ];
    const rec = recommendLever(outcomes, 'pl', false)!;
    // risk-adjust: aggressive 12/0.7=17.1 effective months; cautious 18/1.0=18 → aggressive still wins
    expect(rec.chosenId).toBe('aggressive_automation');
  });

  it('returns null with no finite outcomes', () => {
    expect(recommendLever([], 'pl')).toBeNull();
    expect(
      recommendLever([{ lever: byId('status_quo'), metric: NaN, deltaVsStatusQuo: 0 }], 'pl')
    ).toBeNull();
  });

  it('degrades gracefully to a single-lever recommendation (no trade-off pair)', () => {
    const rec = recommendLever(
      [{ lever: byId('aggressive_automation'), metric: 500, deltaVsStatusQuo: 500 }],
      'pl'
    )!;
    expect(rec.chosenId).toBe('aggressive_automation');
    expect(rec.rejectedId).toBeNull();
  });
});
