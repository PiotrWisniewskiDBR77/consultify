/**
 * Bramka PILNE-12: teksty inicjatyw nie pokazują encji HTML.
 *
 * Przegląd 128 zrzutów, Initiatives → Portfolio, widok kart:
 *   `organization&#x27;s`            zamiast `organization's`
 *   `&quot;defense matrix&quot;`     zamiast `"defense matrix"`
 *   `Date &amp;amp; Participants`    ← PODWÓJNE kodowanie (dwa przebiegi sanitizera)
 *
 * Odkodowanie istniało, ale było podpięte wyłącznie do idei. Inicjatywy szły
 * obok, choć wpadają w ten sam sanitizer serwera.
 */
import { describe, expect, it } from 'vitest';

import {
  decodeDisplayFields,
  decodeHtmlEntities,
  POLA_TEKSTOWE_INICJATYWY,
} from '@/utils/decodeHtmlEntities';

describe('encje HTML w tekstach inicjatyw', () => {
  it('rozwija dokładnie te trzy zapisy, które były na ekranie', () => {
    expect(decodeHtmlEntities('organization&#x27;s')).toBe("organization's");
    expect(decodeHtmlEntities('&quot;defense matrix&quot;')).toBe('"defense matrix"');
    // Podwojne kodowanie: &amp;amp; -> &amp; -> &
    expect(decodeHtmlEntities('Date &amp;amp; Participants')).toBe('Date & Participants');
  });

  it('czyści wszystkie pola, które użytkownik czyta na karcie', () => {
    const wiersz = {
      name: 'Defense: use organization&#x27;s strengths',
      title: '&quot;Offense&quot;',
      description: 'Date &amp;amp; Participants',
      summary: 'Repair &amp; eliminate',
      status: 'draft',
    };

    decodeDisplayFields(wiersz, POLA_TEKSTOWE_INICJATYWY);

    expect(wiersz.name).toBe("Defense: use organization's strengths");
    expect(wiersz.title).toBe('"Offense"');
    expect(wiersz.description).toBe('Date & Participants');
    expect(wiersz.summary).toBe('Repair & eliminate');
    // Pola niewyswietlane jako tekst zostaja nietkniete.
    expect(wiersz.status).toBe('draft');
  });

  it('jest bezpieczny dla zwykłego tekstu i wartości nietekstowych', () => {
    const wiersz = { name: 'Zwykła nazwa bez encji', description: null, summary: 42 };
    decodeDisplayFields(wiersz, POLA_TEKSTOWE_INICJATYWY);

    expect(wiersz.name).toBe('Zwykła nazwa bez encji');
    expect(wiersz.description).toBeNull();
    expect(wiersz.summary).toBe(42);
    expect(decodeDisplayFields(null, POLA_TEKSTOWE_INICJATYWY)).toBeNull();
  });

  it('nie rozwija czegoś, co encją nie jest (brak fałszywych trafień)', () => {
    expect(decodeHtmlEntities('koszt < 5 & czas > 2')).toBe('koszt < 5 & czas > 2');
    expect(decodeHtmlEntities('R&D')).toBe('R&D');
  });
});
