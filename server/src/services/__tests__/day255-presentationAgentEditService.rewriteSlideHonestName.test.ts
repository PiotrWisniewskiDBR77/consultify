import { describe, expect, it } from 'vitest';

import { applyPresentationEditPlan, parsePresentationEditIntent } from '../presentationAgentEditService.js';

describe('day255 rewrite_slide honest response', () => {
  it('describes the operation as literal replacement without implying model editing', async () => {
    const prompt = 'Przeredaguj slajd 1: Tekst podany przez użytkownika';
    const result = await applyPresentationEditPlan({
      deck: { deck_id: 'deck-255', cards: [{ card_id: 'card-1', blocks: [{ content: { text: 'Stary tekst' } }] }] },
      prompt,
      isPolish: true,
      plan: parsePresentationEditIntent(prompt, { enableTeresaDeckEdit: true }),
      organizationId: 'org-255',
    });

    expect(result.deck.cards[0].blocks[0].content.text).toBe('Tekst podany przez użytkownika');
    expect(result.reply).toContain('podmieniono treść slajdu 1 na podany tekst');
    expect(result.reply).not.toMatch(/przeanaliz|poprawi.*styl|przeredag/i);
  });
});
