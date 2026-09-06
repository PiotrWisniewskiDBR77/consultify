import { describe, expect, it } from 'vitest';

import { shouldOfferDocumentEmission } from '../../../src/components/AIChat/canvasEmissionHeuristic';

const para = (n: number) =>
  Array.from({ length: n }, (_, i) => `To jest zdanie numer ${i + 1} z konkretną treścią analizy.`).join(
    ' '
  );

describe('shouldOfferDocumentEmission (B4 auto-emission)', () => {
  it('offers for a structured multi-section report', () => {
    const content = [
      '## Wprowadzenie',
      para(3),
      '',
      '## Analiza',
      '- punkt pierwszy z treścią',
      '- punkt drugi z treścią',
      '- punkt trzeci z treścią',
      '',
      '## Rekomendacje',
      para(3),
    ].join('\n');
    const d = shouldOfferDocumentEmission(content);
    expect(d.offer).toBe(true);
    expect(d.title).toBe('Wprowadzenie');
  });

  it('does NOT offer for a short conversational reply', () => {
    expect(shouldOfferDocumentEmission('Jasne, zrobione — daj znać jeśli coś jeszcze.').offer).toBe(
      false
    );
  });

  it('does NOT offer for a long answer without any structure', () => {
    // Long prose, no headings/bullets → still a chat reply, not a document.
    expect(shouldOfferDocumentEmission(para(20)).offer).toBe(false);
  });

  it('does NOT offer when a single heading decorates an otherwise short answer', () => {
    expect(
      shouldOfferDocumentEmission('## Krótko\nTak, to dobry pomysł. Ruszamy jutro.').offer
    ).toBe(false);
  });

  it('does NOT offer for a code-dominated answer', () => {
    const code = '```ts\n' + Array.from({ length: 40 }, (_, i) => `const x${i} = ${i};`).join('\n') + '\n```';
    const content = `## Rozwiązanie\nOto kod:\n${code}`;
    expect(shouldOfferDocumentEmission(content).offer).toBe(false);
  });

  it('offers for a heading + markdown table with enough rows', () => {
    const content = [
      '## Porównanie dostawców',
      'Zestawienie trzech ofert poniżej, z uwzględnieniem ceny, czasu wdrożenia w tygodniach oraz zakresu serwisu posprzedażowego dla każdego z rozważanych dostawców.',
      '',
      '| Dostawca | Cena | Czas |',
      '| --- | --- | --- |',
      '| A | 100 | 4 |',
      '| B | 120 | 3 |',
      '| C | 90 | 6 |',
      '',
      'Rekomendujemy dostawcę B ze względu na najkrótszy czas wdrożenia przy akceptowalnej cenie oraz najszerszy zakres wsparcia technicznego w pierwszym roku eksploatacji.',
    ].join('\n');
    expect(shouldOfferDocumentEmission(content).offer).toBe(true);
  });

  it('derives title from first heading, stripping markdown', () => {
    const content = ['# **Raport** kwartalny', para(4), '## Sekcja', para(4), '## Druga', para(4)].join(
      '\n'
    );
    const d = shouldOfferDocumentEmission(content);
    expect(d.offer).toBe(true);
    expect(d.title).toBe('Raport kwartalny');
  });

  it('returns no offer for empty content', () => {
    expect(shouldOfferDocumentEmission('').offer).toBe(false);
    expect(shouldOfferDocumentEmission('   ').offer).toBe(false);
  });
});

/**
 * [ODMROZENIE 13_CHAT DEC-397] Odpowiedź Teresy po polsku bywa dokumentem BEZ
 * ani jednego nagłówka markdown — sekcje pisze pogrubieniem („1. **Wizja i cele
 * transformacji**: …"). Zmierzone 06.09 (1.1-D) na żywej odpowiedzi z prośby
 * właściciela o „krótką zajawkę planu strategicznego": 1457 znaków, 5 sekcji,
 * ZERO „# ". Heurystyka wymagała `headingCount >= 1`, więc chip „Otwórz jako
 * dokument" nie pojawiał się nigdy i bramka DEC-400 nie mogła przejść.
 *
 * Dowód mutacyjny (ręcznie zweryfikowany): usunięcie składnika `boldSections`
 * z `headingCount` w canvasEmissionHeuristic.ts czerwieni pierwszy przypadek.
 */
describe('[DEC-397] sekcje pisane pogrubieniem zamiast nagłówków markdown', () => {
  const ODPOWIEDZ_TERESY_0609 = [
    'Plan strategiczny w kontekście cyfrowej transformacji przemysłu zazwyczaj obejmuje kilka kluczowych elementów:',
    '',
    '1. **Wizja i cele transformacji**: Określenie, jaki jest docelowy stan organizacji po transformacji i jakie konkretne cele biznesowe ma ona osiągnąć, np. zwiększenie efektywności operacyjnej czy poprawa jakości produktów.',
    '',
    '2. **Analiza bieżącego stanu**: Ocena obecnej dojrzałości cyfrowej organizacji, identyfikacja istniejących procesów, systemów oraz luk, które wymagają adresowania.',
    '',
    '3. **Inicjatywy transformacyjne**: Lista priorytetowych projektów i działań, które są niezbędne do osiągnięcia wyznaczonych celów.',
    '',
    '4. **Plan wdrożenia**: Szczegółowy harmonogram realizacji poszczególnych inicjatyw, uwzględniający zasoby, terminy oraz kluczowe kamienie milowe.',
    '',
    '5. **Monitorowanie i ewaluacja**: Mechanizmy śledzenia postępów oraz metody oceny skuteczności transformacji, np. poprzez KPI.',
    '',
    'Każdy z tych elementów zapewnia, że transformacja jest dobrze zaplanowana, zarządzana i monitorowana.',
  ].join('\n');

  it('oferuje dokument dla realnej odpowiedzi Teresy z 06.09', () => {
    const decision = shouldOfferDocumentEmission(ODPOWIEDZ_TERESY_0609);
    expect(decision.offer).toBe(true);
    expect(decision.title.length).toBeGreaterThan(0);
  });

  it('POJEDYNCZA pogrubiona etykieta to nadal nie dokument', () => {
    const zwyklaOdpowiedz = [
      'Jasne, mogę to zrobić. **Uwaga**: potrzebuję jeszcze dostępu do danych z zeszłego kwartału,',
      'bo bez nich każde wyliczenie będzie zgadywanką, a tego chcemy uniknąć w rozmowie z zarządem.',
      'Daj znać, kiedy będą gotowe, to wrócę do tematu i przygotuję dla Ciebie porządne zestawienie.',
      'W międzyczasie mogę przejrzeć to, co już mamy w systemie, i powiedzieć, czego brakuje.',
    ].join('\n');
    expect(zwyklaOdpowiedz.length).toBeGreaterThan(300);
    expect(shouldOfferDocumentEmission(zwyklaOdpowiedz).offer).toBe(false);
  });
});
