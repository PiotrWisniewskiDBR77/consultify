import { describe, expect, it } from 'vitest';

import { wykryjPrzepelnienie } from '../deckOverflowDetector.js';

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
});
