import { describe, expect, it } from 'vitest';

import { enrichDeckSetupFromBrief } from '../../server/src/services/deliverables/deliverablesGenerationService.js';
import type { DeckSetup } from '../../server/src/services/presentationGeneratorService.js';

/**
 * Root-cause deck-treść (2026-07-22): deck z czatu gubił temat i register.
 * enrichDeckSetupFromBrief derywuje audience/goal z briefu GDY na domyślnych,
 * zachowuje brief (który zapala useBriefRewrite), i nie rusza jawnych wyborów.
 */
function base(overrides: Partial<DeckSetup> = {}): DeckSetup {
  return {
    title: 'Deck',
    audience: 'internal',
    goal: 'inform',
    language: 'pl',
    theme: 'corporate',
    confidentiality: 'internal',
    sourceArtifacts: [],
    ...overrides,
  } as DeckSetup;
}

describe('enrichDeckSetupFromBrief', () => {
  it('„dla zarządu" na domyślnych → executive, brief zachowany', () => {
    const out = enrichDeckSetupFromBrief(base({ brief: 'Prezentacja dla zarządu z wyników pilota' }));
    expect(out.audience).toBe('executive');
    expect(out.brief).toBe('Prezentacja dla zarządu z wyników pilota');
  });

  it('brief z „decyzja/rekomendacja" → goal decide', () => {
    const out = enrichDeckSetupFromBrief(base({ brief: 'Deck do decyzji zarządu: rekomendacja wdrożenia' }));
    expect(out.goal).toBe('decide');
  });

  it('bez briefu → setup nietknięty (zero regresji)', () => {
    const input = base();
    const out = enrichDeckSetupFromBrief(input);
    expect(out.audience).toBe('internal');
    expect(out.goal).toBe('inform');
    expect(out.brief).toBeUndefined();
  });

  it('jawnie wybrany non-default audience → zachowany mimo briefu', () => {
    const out = enrichDeckSetupFromBrief(base({ audience: 'investor', brief: 'coś dla zarządu' }));
    expect(out.audience).toBe('investor');
  });

  it('brief same białe znaki → traktowany jak brak', () => {
    const out = enrichDeckSetupFromBrief(base({ brief: '   ' }));
    expect(out.audience).toBe('internal');
  });
});
