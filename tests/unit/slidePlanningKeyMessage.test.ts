import { describe, expect, it } from 'vitest';

import type { DeckSetup, OutlineItem } from '../../server/src/services/presentationGeneratorService.js';
import { planSlides } from '../../server/src/services/slidePlanningEngineService.js';

/**
 * HOTFIX #62 (UI-M4): the slide planner must NEVER inject a generic
 * "Key message for X" / "Decision message: X" placeholder onto an outline item
 * with an empty keyMessage. Instead it derives an intent-appropriate PL/EN
 * phrase, or leaves keyMessage empty so the per-intent builder's own fallback
 * fires downstream.
 */

function baseSetup(overrides: Partial<DeckSetup> = {}): DeckSetup {
  return {
    title: 'Test Deck',
    audience: 'sponsor',
    goal: 'inform',
    language: 'en',
    theme: 'corporate',
    confidentiality: 'internal',
    sourceArtifacts: [],
    ...overrides,
  } as DeckSetup;
}

function outline(items: Partial<OutlineItem>[]): OutlineItem[] {
  return items.map((i) => ({ intent: 'executive_summary', title: 'X', enabled: true, ...i })) as OutlineItem[];
}

describe('planSlides keyMessage fallback (HOTFIX #62)', () => {
  it('never emits a "Key message for X" placeholder for empty keyMessage', () => {
    const setup = baseSetup();
    const items = outline([
      { intent: 'executive_summary', title: 'Podsumowanie' },
      { intent: 'key_messages', title: 'Kluczowe wnioski' },
      { intent: 'roadmap', title: 'Roadmap' },
      { intent: 'cover', title: 'Cover' },
      { intent: 'single_insight', title: 'Insight' },
      { intent: 'next_steps', title: 'Next Steps' },
    ]);
    const result = planSlides({ setup, outline: items });

    for (const planned of result.outline) {
      const km = (planned as any).keyMessage;
      if (km != null) {
        expect(km).not.toMatch(/^Key message for /);
        expect(km).not.toMatch(/^Decision message: /);
      }
    }
    for (const recipe of result.slideRecipes) {
      expect(recipe.keyMessage).not.toMatch(/^Key message for /);
      expect(recipe.keyMessage).not.toMatch(/^Decision message: /);
    }
  });

  it('never emits a "Decision message: X" placeholder in executive register', () => {
    const setup = baseSetup({ audience: 'executive' } as Partial<DeckSetup>);
    (setup as any).communicationRegister = 'executive';
    const items = outline([{ intent: 'executive_summary', title: 'Summary' }]);
    const result = planSlides({ setup, outline: items });
    for (const planned of result.outline) {
      const km = (planned as any).keyMessage;
      if (km != null) expect(km).not.toMatch(/^Decision message: /);
    }
  });

  it('derives an intent-appropriate EN keyMessage for mapped intents', () => {
    const setup = baseSetup();
    const items = outline([{ intent: 'executive_summary', title: 'Whatever' }]);
    const result = planSlides({ setup, outline: items });
    expect((result.outline[0] as any).keyMessage).toBe('Summary of key findings');
  });

  it('derives an intent-appropriate PL keyMessage honoring setup.language', () => {
    const setup = baseSetup({ language: 'pl' });
    const items = outline([{ intent: 'executive_summary', title: 'Cokolwiek' }]);
    const result = planSlides({ setup, outline: items });
    expect((result.outline[0] as any).keyMessage).toBe('Podsumowanie kluczowych ustaleń');
  });

  it('leaves keyMessage empty for unmapped intents (builder decides)', () => {
    const setup = baseSetup();
    // 'cover' is intentionally unmapped so the cover builder's own logic wins.
    const items = outline([{ intent: 'cover', title: 'Cover Title' }]);
    const result = planSlides({ setup, outline: items });
    expect((result.outline[0] as any).keyMessage).toBeUndefined();
  });

  it('preserves a real caller-provided keyMessage verbatim', () => {
    const setup = baseSetup();
    const items = outline([
      { intent: 'executive_summary', title: 'T', keyMessage: 'Revenue grew 23% YoY' },
    ]);
    const result = planSlides({ setup, outline: items });
    expect((result.outline[0] as any).keyMessage).toBe('Revenue grew 23% YoY');
  });
});
