import { describe, expect, it } from 'vitest';

import { canonicalizePresentationAutosaveDeck } from '../presentationDeckAutosaveCanonicalizer.js';

describe('presentation autosave canonicalizer', () => {
  it('decodes legacy entities and aligns duplicated title metadata with the visible heading', () => {
    const result = canonicalizePresentationAutosaveDeck({
      title: 'Board deck',
      cards: [
        {
          title: 'Risks &amp; Mitigations',
          key_message: 'Risks &amp; Mitigations',
          blocks: [
            {
              type: 'heading',
              content: { text: 'Risks and Mitigations' },
            },
            {
              type: 'table',
              content: { rows: [['Data&nbsp;migration', 'Parallel reconciliation']] },
            },
          ],
        },
      ],
    }) as any;

    expect(result.cards[0].title).toBe('Risks and Mitigations');
    expect(result.cards[0].key_message).toBe('Risks and Mitigations');
    expect(result.cards[0].blocks[1].content.rows[0][0]).toBe('Data migration');
    expect(JSON.stringify(result)).not.toContain('&amp;');
    expect(JSON.stringify(result)).not.toContain('&nbsp;');
  });

  it('preserves a distinct evidence-led key message', () => {
    const result = canonicalizePresentationAutosaveDeck({
      cards: [
        {
          title: 'Legacy title',
          key_message: 'Two risks require named owners',
          blocks: [{ type: 'title', content: { text: 'Risks and Mitigations' } }],
        },
      ],
    }) as any;

    expect(result.cards[0].title).toBe('Risks and Mitigations');
    expect(result.cards[0].key_message).toBe('Two risks require named owners');
  });
});
