import { describe, expect, it } from 'vitest';

import { presentationVersionApprovalId } from '../../../src/components/Presentations/DeckBuilder/presentationApproval';

describe('presentationVersionApprovalId', () => {
  it('pins approval identity to the persisted deck version', () => {
    expect(
      presentationVersionApprovalId({
        deck_id: 'deck-42',
        version: 7,
      })
    ).toBe('deck-42@7');
  });

  it('changes when a material autosave advances the server version', () => {
    const before = presentationVersionApprovalId({
      deck_id: 'deck-42',
      version: 7,
    });
    const after = presentationVersionApprovalId({
      deck_id: 'deck-42',
      version: 8,
    });

    expect(after).not.toBe(before);
  });
});
