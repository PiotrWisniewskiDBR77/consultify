import { describe, it, expect } from 'vitest';
import {
  suggestRca,
  suggestActions,
  type RcaCategory,
} from '../../../server/src/services/results/deviationRcaSuggestService.js';

describe('deviationRcaSuggestService.suggestRca', () => {
  it('returns no hypotheses for empty / benign input', () => {
    expect(suggestRca({})).toEqual([]);
    expect(suggestRca({ deviationPct: 0.05, trend: 'improving', adoptionScore: 0.9 })).toEqual([]);
  });

  it('maps staleData → data-quality and cites the signal', () => {
    const out = suggestRca({ staleData: true });
    expect(out).toHaveLength(1);
    expect(out[0].category).toBe('data-quality');
    expect(out[0].hypothesis).toContain('staleData');
    expect(out[0].confidence).toBeGreaterThan(0);
  });

  it('maps low adoptionScore → adoption and cites the score', () => {
    const out = suggestRca({ adoptionScore: 0.2 });
    expect(out).toHaveLength(1);
    expect(out[0].category).toBe('adoption');
    expect(out[0].hypothesis).toContain('0.20');
  });

  it('does NOT raise adoption when adoptionScore is high', () => {
    const out = suggestRca({ adoptionScore: 0.8 });
    expect(out.some((h) => h.category === 'adoption')).toBe(false);
  });

  it('maps scopeChanged → scope', () => {
    const out = suggestRca({ scopeChanged: true });
    expect(out.map((h) => h.category)).toContain('scope');
    expect(out[0].hypothesis).toContain('scopeChanged');
  });

  it('maps capacityOverloaded → capacity', () => {
    const out = suggestRca({ capacityOverloaded: true });
    expect(out.map((h) => h.category)).toContain('capacity');
    expect(out[0].hypothesis).toContain('capacityOverloaded');
  });

  it('maps large deviationPct → measurement and cites the percentage', () => {
    const out = suggestRca({ deviationPct: 0.3 });
    expect(out.map((h) => h.category)).toContain('measurement');
    const m = out.find((h) => h.category === 'measurement')!;
    expect(m.hypothesis).toContain('30%');
  });

  it('ignores small deviationPct below threshold', () => {
    const out = suggestRca({ deviationPct: 0.1 });
    expect(out.some((h) => h.category === 'measurement')).toBe(false);
  });

  it('maps declining trend → external and cites the signal', () => {
    const out = suggestRca({ trend: 'declining' });
    expect(out.map((h) => h.category)).toContain('external');
    const e = out.find((h) => h.category === 'external')!;
    expect(e.hypothesis).toContain('declining');
  });

  it('confidence values are clamped to 0..1', () => {
    const out = suggestRca({
      deviationPct: 5,
      adoptionScore: 0,
      trend: 'declining',
      staleData: true,
      scopeChanged: true,
      capacityOverloaded: true,
    });
    for (const h of out) {
      expect(h.confidence).toBeGreaterThanOrEqual(0);
      expect(h.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('returns hypotheses sorted by confidence descending', () => {
    const out = suggestRca({
      deviationPct: 0.25,
      adoptionScore: 0.05,
      trend: 'declining',
      staleData: true,
      scopeChanged: true,
      capacityOverloaded: true,
    });
    expect(out.length).toBeGreaterThan(1);
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1].confidence).toBeGreaterThanOrEqual(out[i].confidence);
    }
  });

  it('emits one hypothesis per distinct triggering signal', () => {
    const out = suggestRca({
      staleData: true,
      adoptionScore: 0.1,
      scopeChanged: true,
      capacityOverloaded: true,
      deviationPct: 0.4,
      trend: 'declining',
    });
    const cats = out.map((h) => h.category).sort();
    expect(cats).toEqual(
      ['adoption', 'capacity', 'data-quality', 'external', 'measurement', 'scope'].sort()
    );
  });
});

describe('deviationRcaSuggestService.suggestActions', () => {
  const cases: Array<[RcaCategory, string, string]> = [
    ['adoption', 'Wzmocnij komunikację/szkolenia', 'Change Manager'],
    ['data-quality', 'Napraw źródło pomiaru', 'Data Owner'],
    ['capacity', 'Realokuj zasoby', 'Resource Manager'],
    ['scope', 'Rewaliduj zakres', 'Initiative Owner'],
    ['external', 'Aktualizuj założenia', 'Sponsor'],
    ['measurement', 'Zweryfikuj definicję KPI', 'KPI Owner'],
  ];

  it.each(cases)('maps %s → action with owner', (category, title, ownerRole) => {
    const out = suggestActions([{ category }]);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe(title);
    expect(out[0].ownerRole).toBe(ownerRole);
  });

  it('returns [] for empty rca list', () => {
    expect(suggestActions([])).toEqual([]);
  });

  it('deduplicates repeated categories preserving first-seen order', () => {
    const out = suggestActions([
      { category: 'adoption' },
      { category: 'scope' },
      { category: 'adoption' },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].title).toBe('Wzmocnij komunikację/szkolenia');
    expect(out[1].title).toBe('Rewaliduj zakres');
  });

  it('chains end-to-end: suggestRca output feeds suggestActions', () => {
    const rca = suggestRca({ adoptionScore: 0.1, staleData: true });
    const actions = suggestActions(rca);
    const titles = actions.map((a) => a.title);
    expect(titles).toContain('Wzmocnij komunikację/szkolenia');
    expect(titles).toContain('Napraw źródło pomiaru');
  });
});
