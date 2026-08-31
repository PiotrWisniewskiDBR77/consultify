import { describe, expect, it } from 'vitest';

import { enforceBlockGrounding } from '../documentBlockContentGenerator.js';

/**
 * Owner decision 2026-08-29: relax the grounding guard so that only
 * UNSUPPORTED NUMBERS (rule A) are removed; all-caps acronyms and proper
 * names (rule B) pass through. Guarded by the module constant
 * GROUNDING_ACRONYM_RULE in documentBlockContentGenerator.ts — flipping it
 * back to 'enforced' must turn the first test red.
 */
const BRIEF = 'Plan poprawy terminowości wdrożeń. Odbiorcy: zarząd, dyrektor operacyjny.';
describe('enforceBlockGrounding — skróty dozwolone, liczby zachowane i oznaczone', () => {
  it('przepuszcza zdanie ze skrótami spoza SAFE_BUSINESS_ACRONYMS (reguła B zniesiona)', () => {
    const sentence = 'Wdrożymy OTD i SLA w obszarze produkcji.';
    const result = enforceBlockGrounding({ text: sentence }, BRIEF);

    expect(result.content.text).toBe(sentence);
    expect(result.changed).toBe(false);
  });

  it('przepuszcza akapit z WIP, ERP i RCA bez liczb', () => {
    const paragraph =
      'Limit prac w toku (WIP) ustalimy z kierownikami zmian. Wdrożenie ERP obejmie planowanie, ' +
      'a analiza RCA wskaże przyczyny źródłowe opóźnień.';
    const result = enforceBlockGrounding({ text: paragraph }, BRIEF);

    expect(result.content.text).toBe(paragraph);
    expect(result.changed).toBe(false);
  });

  it('zachowuje zdanie z niepopartą liczbą i oznacza blok jako założenie', () => {
    const sentence = 'Terminowość wdrożeń spadła do 68% w ostatnim kwartale.';
    const result = enforceBlockGrounding({ text: sentence }, BRIEF);

    expect(result.content.text).toBe(sentence);
    expect(result.changed).toBe(true);
  });

  it('zachowuje zdanie łączące dozwolony skrót z niepopartą liczbą i oznacza blok', () => {
    const sentence = 'Do końca 2026 osiągniemy poziom OTD na 90%.';
    const result = enforceBlockGrounding({ text: sentence }, BRIEF);

    expect(result.content.text).toBe(sentence);
    expect(result.changed).toBe(true);
  });

  it('zachowuje surową wartość number i oznacza blok zamiast usuwać klucz', () => {
    const result = enforceBlockGrounding({ value: 68 }, BRIEF);

    expect(result.content.value).toBe(68);
    expect(result.changed).toBe(true);
  });

  it('przepuszcza liczbę obecną dosłownie w źródle', () => {
    const source = 'Plan poprawy terminowości. Cel OTD to 95% do końca roku.';
    const sentence = 'Utrzymamy poziom OTD na 95%.';
    const result = enforceBlockGrounding({ text: sentence }, source);

    expect(result.content.text).toBe(sentence);
    expect(result.changed).toBe(false);
  });
});
