import { describe, expect, it } from 'vitest';

import {
  buildPortfolioAdvisory,
  type PortfolioItemInput,
  type SynergyInput,
} from '../../../server/src/services/financePortfolioAdvisory.ts';

const items: PortfolioItemInput[] = [
  { id: 'a', name: 'Wspólny model danych', npv: 400_000, capex: 200_000, effort: 4, risk: 0.2 },
  { id: 'b', name: 'Automatyzacja raportów', npv: 600_000, capex: 150_000, effort: 3, risk: 0.3, dependsOn: ['a'] },
  { id: 'c', name: 'Predykcja popytu', npv: 900_000, capex: 500_000, effort: 6, risk: 0.5, dependsOn: ['a', 'b'] },
];

const synergies: SynergyInput[] = [
  { a: 'a', b: 'b', bonusNpv: 100_000, rationale: 'wspólne dane zasilają raporty' },
  { a: 'b', b: 'c', bonusNpv: 150_000, rationale: 'raporty walidują predykcję' },
];

describe('buildPortfolioAdvisory — sequencing', () => {
  it('respects prerequisites: a before b before c', () => {
    const adv = buildPortfolioAdvisory(items, synergies, 0, 'pl');
    const order = adv.sequence.map((s) => s.id);
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'));
  });

  it('records what blocked each item (for the why-first justification)', () => {
    const adv = buildPortfolioAdvisory(items, synergies, 0, 'pl');
    const c = adv.sequence.find((s) => s.id === 'c')!;
    expect(c.blockedBy).toEqual(expect.arrayContaining(['a', 'b']));
  });

  it('leads the conclusion with the prerequisite-forced first item', () => {
    const adv = buildPortfolioAdvisory(items, synergies, 0, 'pl');
    expect(adv.sequence[0].id).toBe('a');
    expect(adv.conclusion).toContain('Wspólny model danych');
  });

  it('tolerates a broken/cyclic dependency without throwing', () => {
    const cyclic: PortfolioItemInput[] = [
      { id: 'x', name: 'X', npv: 100, capex: 10, effort: 1, dependsOn: ['y'] },
      { id: 'y', name: 'Y', npv: 100, capex: 10, effort: 1, dependsOn: ['x'] },
    ];
    const adv = buildPortfolioAdvisory(cyclic, [], 0, 'pl');
    expect(adv.sequence.length).toBe(2);
  });
});

describe('buildPortfolioAdvisory — budget envelope', () => {
  it('marks items beyond the budget as deferred and reports an over verdict', () => {
    // total capex = 850k; budget 400k → only a fits, b+c deferred
    const adv = buildPortfolioAdvisory(items, synergies, 400_000, 'pl');
    expect(adv.budgetVerdict).toBe('over');
    expect(adv.deferred).toContain('c');
    const a = adv.sequence.find((s) => s.id === 'a')!;
    expect(a.withinBudget).toBe(true);
  });

  it('reports a tight verdict when spend is >90% of budget', () => {
    const adv = buildPortfolioAdvisory(items, synergies, 900_000, 'pl'); // total 850k of 900k = 94%
    expect(adv.budgetVerdict).toBe('tight');
    expect(adv.conclusion).toMatch(/napięcie|tension/);
  });

  it('reports fits with headroom when the budget is comfortable', () => {
    const adv = buildPortfolioAdvisory(items, synergies, 2_000_000, 'pl');
    expect(adv.budgetVerdict).toBe('fits');
    expect(adv.deferred).toHaveLength(0);
  });
});

describe('buildPortfolioAdvisory — synergies', () => {
  it('marks synergies captured only when both items are funded', () => {
    const adv = buildPortfolioAdvisory(items, synergies, 2_000_000, 'pl');
    const ab = adv.synergies.find((s) => s.a === 'a' && s.b === 'b')!;
    expect(ab.captured).toBe(true);
  });

  it('flags latent synergies when a partner falls outside the budget', () => {
    const adv = buildPortfolioAdvisory(items, synergies, 400_000, 'pl'); // b, c deferred
    const bc = adv.synergies.find((s) => s.a === 'b' && s.b === 'c')!;
    expect(bc.captured).toBe(false);
    expect(adv.conclusion).toMatch(/synerg/);
  });

  it('handles an empty portfolio with an honest fallback conclusion', () => {
    const adv = buildPortfolioAdvisory([], [], 0, 'pl');
    expect(adv.sequence).toHaveLength(0);
    expect(adv.conclusion).toContain('Brak inicjatyw');
  });
});
