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
const PLACEHOLDER = 'Treść usunięta — niepoparte twierdzenie (założenie do weryfikacji).';

describe('enforceBlockGrounding — rozluźniony próg (skróty dozwolone, liczby nadal pilnowane)', () => {
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

  it('nadal kasuje zdanie z niepopartą liczbą (reguła A żyje)', () => {
    const result = enforceBlockGrounding(
      { text: 'Terminowość wdrożeń spadła do 68% w ostatnim kwartale.' },
      BRIEF
    );

    expect(result.content.text).toBe(PLACEHOLDER);
    expect(result.changed).toBe(true);
  });

  it('nadal kasuje zdanie, które łączy dozwolony skrót z niepopartą liczbą', () => {
    const result = enforceBlockGrounding(
      { text: 'Do końca 2026 osiągniemy poziom OTD na 90%.' },
      BRIEF
    );

    expect(result.content.text).toBe(PLACEHOLDER);
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
