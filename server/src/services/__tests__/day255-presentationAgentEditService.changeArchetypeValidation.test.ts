import { describe, expect, it } from 'vitest';

import { applyPresentationEditPlan, parsePresentationEditIntent } from '../presentationAgentEditService.js';

async function changeTo(layoutId: string) {
  const prompt = `Zmień archetyp slajd 1 na ${layoutId}`;
  return applyPresentationEditPlan({
    deck: { deck_id: 'deck-255', cards: [{ card_id: 'card-1', layout_id: 'stacked', blocks: [] }] },
    prompt,
    isPolish: true,
    plan: parsePresentationEditIntent(prompt, { enableTeresaDeckEdit: true }),
    organizationId: 'org-255',
  });
}

describe('day255 change_archetype validation', () => {
  it('accepts a registered slide archetype', async () => {
    const result = await changeTo('two_column');
    expect(result.deck.cards[0].layout_id).toBe('two_column');
    expect(result.appliedActions).toContain('change_archetype:1:two_column');
  });

  it('rejects an unknown archetype without mutating the card', async () => {
    const result = await changeTo('nieistniejacy_archetyp_xyz');
    expect(result.deck.cards[0].layout_id).toBe('stacked');
    expect(result.appliedActions).not.toContain('change_archetype:1:nieistniejacy_archetyp_xyz');
    expect(result.reply).toContain('nieznany identyfikator nieistniejacy_archetyp_xyz');
  });
});
