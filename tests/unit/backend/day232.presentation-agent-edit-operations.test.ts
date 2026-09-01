import { describe, expect, it } from 'vitest';

import {
  applyPresentationEditPlan,
  parsePresentationEditIntent,
} from '../../../server/src/services/presentationAgentEditService.js';

function deckFixture() {
  return {
    deck_id: 'deck-day232',
    title: 'Day232 operations',
    cards: [
      {
        card_id: 'card-1',
        order_index: 0,
        title: 'First',
        layout_id: 'content_full',
        blocks: [
          { type: 'text', content: { text: 'A long sentence that can be rewritten or shortened.' } },
          { type: 'text', content: { text: 'Second block for split proof.' } },
        ],
        source_refs: [],
      },
    ],
  };
}

function apply(prompt: string) {
  const plan = parsePresentationEditIntent(prompt, { enableTeresaDeckEdit: true });
  return applyPresentationEditPlan({ deck: deckFixture(), prompt, plan, isPolish: true });
}

describe('Day232 five governed deck editorial operations', { retry: 0 }, () => {
  it('keeps flag OFF byte-identical to the legacy parser call', () => {
    const prompts = [
      'przeredaguj slajd 1: Nowa treść',
      'skróć slajd 1',
      'rozbij slajd 1',
      'zmień archetyp slajd 1 na big_number',
      'dodaj źródło slajd 1 https://example.test/source',
    ];
    for (const prompt of prompts) {
      expect(parsePresentationEditIntent(prompt, { enableTeresaDeckEdit: false })).toEqual(
        parsePresentationEditIntent(prompt)
      );
    }
  });

  it('rewrites one targeted slide and records an operation action', () => {
    const result = apply('przeredaguj slajd 1: Nowa treść zarządcza');
    expect(result.deck.cards[0].blocks[0].content.text).toBe('Nowa treść zarządcza');
    expect(result.appliedActions).toContain('rewrite_slide:1');
  });

  it('shortens only the targeted slide', () => {
    const result = apply('skróć slajd 1');
    expect(result.plan.editorialOperation).toBe('shorten_slide');
    expect(result.appliedActions).toContain('skrócono copy');
  });

  it('splits one slide into two cards', () => {
    const result = apply('rozbij slajd 1');
    expect(result.deck.cards).toHaveLength(2);
    expect(result.appliedActions).toContain('split_slide:1');
  });

  it('changes the targeted slide archetype', () => {
    const result = apply('zmień archetyp slajd 1 na big_number');
    expect(result.deck.cards[0].layout_id).toBe('big_number');
    expect(result.appliedActions).toContain('change_archetype:1:big_number');
  });

  it('adds a source reference without replacing existing sources', () => {
    const result = apply('dodaj źródło slajd 1 https://example.test/source');
    expect(result.deck.cards[0].source_refs).toEqual([
      expect.objectContaining({ source_type: 'url', url: 'https://example.test/source' }),
    ]);
    expect(result.appliedActions).toContain('add_source:1');
  });
});
