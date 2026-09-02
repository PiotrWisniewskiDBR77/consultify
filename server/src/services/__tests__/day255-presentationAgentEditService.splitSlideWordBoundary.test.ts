import { describe, expect, it, vi } from 'vitest';

import { applyPresentationEditPlan, parsePresentationEditIntent } from '../presentationAgentEditService.js';

function deckWith(text: string, id = 'card-1') {
  return { deck_id: 'deck-255', cards: [{ card_id: id, title: 'Slide', blocks: [{ content: { text } }] }] };
}

async function split(text: string, id?: string) {
  const prompt = 'Rozbij slajd 1';
  return applyPresentationEditPlan({
    deck: deckWith(text, id),
    prompt,
    isPolish: true,
    plan: parsePresentationEditIntent(prompt, { enableTeresaDeckEdit: true }),
    organizationId: 'org-255',
  });
}

describe('day255 split_slide word boundary and identifiers', () => {
  it('splits a single text block at the nearest whitespace rather than inside a word', async () => {
    const result = await split('Alpha bravocharlie delta echo');
    expect(result.deck.cards.map((card: any) => card.blocks[0].content.text)).toEqual([
      'Alpha bravocharlie',
      'delta echo',
    ]);
  });

  it('creates distinct card identifiers for two synchronous split operations', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234567890);
    const firstPromise = split('Alpha bravo charlie delta', 'same-card');
    const secondPromise = split('Alpha bravo charlie delta', 'same-card');
    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(first.deck.cards[1].card_id).not.toBe(second.deck.cards[1].card_id);
    vi.restoreAllMocks();
  });
});
