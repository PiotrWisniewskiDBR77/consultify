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
