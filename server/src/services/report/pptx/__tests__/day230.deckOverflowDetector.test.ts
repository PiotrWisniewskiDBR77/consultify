import { describe, expect, it } from 'vitest';

import { wykryjPrzepelnienie } from '../deckOverflowDetector.js';

// FIX-230: the two tests below this comment ARE the "sample instead of the
// set" ODBIOR_230 warned about — `blocks: []` on every card, `key_message`
// as a bare string. That shape happens to be the ONE input that never
// touches the block-metadata bug (F1) or the `||` short-circuit bug (F2),
// so it stayed green through both defects and gave false confidence.
// `pushBlockShaped` below builds the shape the product actually persists
// (`deckData.ts` pushBlock / autosave): every block carries `block_id` /
// `card_id` / `type` / `position` alongside `content`.
function pushBlockShaped(
  deckId: string,
  cardIdx: number,
  blockIdx: number,
  type: string,
  content: Record<string, unknown>
) {
  return {
    block_id: `block-${deckId}-${cardIdx}-${blockIdx}`,
    card_id: `card-${deckId}-${cardIdx}`,
    type,
    content,
    is_refreshable: false,
    position: { area: 'full', order: blockIdx },
    ai_editable: true,
  };
}

describe('day230 deck overflow detector', () => {
  it('wskazuje 1-based numer jedynego przepełnionego slajdu', () => {
    const deck = {
      cards: [
        { title: 'Okładka', key_message: 'Krótko', blocks: [] },
        { title: 'Kontekst', key_message: 'Nadal krótko', blocks: [] },
        { title: 'Wniosek', key_message: 'x'.repeat(721), blocks: [] },
      ],
    };

    const result = wykryjPrzepelnienie(deck);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      slideIndex: 3,
      slideTitle: 'Wniosek',
      powod: 'tresc',
      zmierzone: 721,
      budzet: 240,
      pewnosc: 'wysoka',
    });
  });

  it('zachowuje ciszę dla poprawnego decku', () => {
    const result = wykryjPrzepelnienie({
      cards: [
        { title: 'Okładka', key_message: 'Krótko', blocks: [] },
        { title: 'Wniosek', key_message: 'Mieści się', blocks: [] },
      ],
    });

    expect(result).toEqual([]);
  });

  // FIX-230 F1 — the dowód minimalny from ODBIOR_230 itself: a slide with
  // 3 blocks and 8 visible chars ("Agenda" + a one-word bullet) must NOT
  // warn. Pre-fix this measured "zmierzone: 316, budżet: 240" from
  // block_id/card_id noise alone.
  it('F1: 8 znaków widocznych w blokach z realnymi block_id/card_id ⇒ cisza', () => {
    const deckId = 'd4e5f6a7-0000-4000-8000-000000000001';
    const result = wykryjPrzepelnienie({
      cards: [
        {
          title: 'Agenda',
          key_message: '',
          blocks: [
            pushBlockShaped(deckId, 0, 0, 'heading', { text: 'Agenda', level: 2 }),
            pushBlockShaped(deckId, 0, 1, 'bullet_list', { items: ['Cel'] }),
          ],
        },
      ],
    });

    expect(result).toEqual([]);
  });

  // FIX-230 F2 — the false-NEGATIVE half of the same bug: a non-empty
  // key_message used to short-circuit past the blocks entirely.
  it('F2: krótki key_message + 5 pełnych bloków ⇒ ostrzeżenie (suma, nie zwarcie)', () => {
    const deckId = 'd4e5f6a7-0000-4000-8000-000000000002';
    const result = wykryjPrzepelnienie({
      cards: [
        {
          title: 'Przeciążony',
          key_message: 'Krótka teza.',
          blocks: Array.from({ length: 5 }, (_, i) =>
            pushBlockShaped(deckId, 0, i, 'paragraph', { text: 'x'.repeat(400) })
          ),
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ slideIndex: 1, powod: 'tresc' });
  });

  // FIX-230 F3 — a slide explicitly disabled never exports; warning about
  // it is noise the owner correctly flagged as measured, not hypothetical.
  it('F3: slajd enabled:false z ogromną treścią ⇒ pomijany', () => {
    const deckId = 'd4e5f6a7-0000-4000-8000-000000000003';
    const result = wykryjPrzepelnienie({
      cards: [
        {
          title: 'Wyłączony',
          key_message: '',
          enabled: false,
          blocks: [pushBlockShaped(deckId, 0, 0, 'paragraph', { text: 'x'.repeat(2000) })],
        },
      ],
    });

    expect(result).toEqual([]);
  });
});
