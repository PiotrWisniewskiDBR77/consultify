import { describe, expect, it } from 'vitest';

import {
  isEmptyValue,
  mergeLibraryContent,
  mergeLibraryContentJson,
  parseLibraryContent,
  type LibraryContent,
} from '../libraryContentMerge.js';

/**
 * Testy naprawy L11.
 *
 * Defekt: `ensureToolsSeedOnce()` nadpisywał `library_content_translations`
 * obiektem zawierającym wyłącznie `whatYouGet`, kasując 7 z 8 pól wniesionych
 * przez migracje 559 i 562 dla wszystkich 31 narzędzi.
 */

/** Osiem pól, które migracje 559/562 realnie wnoszą. */
const RICH_FIELDS = [
  'whatYouGet',
  'whenToUse',
  'inputs',
  'steps',
  'outputs',
  'commonMistakes',
  'example',
  'nextSteps',
] as const;

function richLocale(prefix: string): Record<string, unknown> {
  return {
    whatYouGet: [`${prefix} co dostajesz`],
    whenToUse: `${prefix} kiedy użyć`,
    inputs: [`${prefix} wejścia`],
    steps: [`${prefix} kroki`],
    outputs: [`${prefix} wyniki`],
    commonMistakes: [`${prefix} typowe błędy`],
    example: `${prefix} przykład`,
    nextSteps: [`${prefix} następne kroki`],
  };
}

const migrationContent: LibraryContent = {
  en: richLocale('EN'),
  pl: richLocale('PL'),
};

/** Dokładnie to, co produkuje seed — tylko whatYouGet. */
const seedContent: LibraryContent = {
  en: { whatYouGet: ['seed EN bullet'] },
  pl: { whatYouGet: ['seed PL bullet'] },
};

/** STARA implementacja: bezwarunkowy replace. Zachowana jako reprodukcja defektu. */
function legacyReplace(_existing: LibraryContent, seed: LibraryContent): LibraryContent {
  return seed;
}

describe('L11 — reprodukcja defektu na starej implementacji', () => {
  it('stary replace kasuje 7 z 8 pól', () => {
    const after = legacyReplace(migrationContent, seedContent);

    const lostFields = RICH_FIELDS.filter(
      (f) => migrationContent.pl[f] !== undefined && after.pl?.[f] === undefined
    );

    // whatYouGet przeżywa, reszta ginie — dokładnie 7 pól
    expect(lostFields).toHaveLength(7);
    expect(lostFields).not.toContain('whatYouGet');
    expect(after.pl.whenToUse).toBeUndefined();
  });
});

describe('mergeLibraryContent — reguły scalania', () => {
  it('ZACHOWUJE wszystkie osiem pól', () => {
    const merged = mergeLibraryContent(migrationContent, seedContent);
    RICH_FIELDS.forEach((f) => {
      expect(merged.pl[f], `utracono pole ${f}`).toBeDefined();
      expect(merged.en[f], `utracono pole ${f}`).toBeDefined();
    });
  });

  it('istniejąca niepusta wartość WYGRYWA z seedem', () => {
    const merged = mergeLibraryContent(migrationContent, seedContent);
    expect(merged.pl.whatYouGet).toEqual(['PL co dostajesz']);
    expect(merged.en.whatYouGet).toEqual(['EN co dostajesz']);
  });

  it('seed UZUPEŁNIA wartość brakującą', () => {
    const existing: LibraryContent = { pl: { whenToUse: 'zostaje' } };
    const merged = mergeLibraryContent(existing, { pl: { whatYouGet: ['z seeda'] } });
    expect(merged.pl.whenToUse).toBe('zostaje');
    expect(merged.pl.whatYouGet).toEqual(['z seeda']);
  });

  it('seed UZUPEŁNIA wartość pustą', () => {
    const existing: LibraryContent = { pl: { whatYouGet: [], whenToUse: '   ' } };
    const merged = mergeLibraryContent(existing, {
      pl: { whatYouGet: ['z seeda'], whenToUse: 'z seeda' },
    });
    expect(merged.pl.whatYouGet).toEqual(['z seeda']);
    expect(merged.pl.whenToUse).toBe('z seeda');
  });

  it('brak pola w seedzie NICZEGO nie usuwa', () => {
    const merged = mergeLibraryContent(migrationContent, { pl: {} });
    RICH_FIELDS.forEach((f) => expect(merged.pl[f]).toBeDefined());
  });

  it('ZACHOWUJE nieznane pola', () => {
    const existing: LibraryContent = {
      pl: { ...richLocale('PL'), customField: 'wartość', futureField: { a: 1 } },
    };
    const merged = mergeLibraryContent(existing, seedContent);
    expect(merged.pl.customField).toBe('wartość');
    expect(merged.pl.futureField).toEqual({ a: 1 });
  });

  it('obsługuje WIELE locale, także spoza seeda', () => {
    const existing: LibraryContent = {
      pl: richLocale('PL'),
      en: richLocale('EN'),
      de: richLocale('DE'),
      fr: { whenToUse: 'quand' },
    };
    const merged = mergeLibraryContent(existing, seedContent);
    // locale spoza seeda nietknięte
    expect(merged.de).toEqual(richLocale('DE'));
    expect(merged.fr.whenToUse).toBe('quand');
    // locale znane zachowane
    expect(merged.pl.whenToUse).toBe('PL kiedy użyć');
  });

  it('dodaje locale, którego wcześniej nie było', () => {
    const merged = mergeLibraryContent({ pl: richLocale('PL') }, seedContent);
    expect(merged.en).toEqual({ whatYouGet: ['seed EN bullet'] });
  });

  it('nie wstawia pustki seeda w miejsce pustki', () => {
    const merged = mergeLibraryContent({ pl: { whatYouGet: [] } }, { pl: { whatYouGet: [] } });
    expect(merged.pl.whatYouGet).toEqual([]);
  });

  it('0 i false NIE są traktowane jako puste', () => {
    const merged = mergeLibraryContent(
      { pl: { count: 0, flag: false } },
      { pl: { count: 99, flag: true } }
    );
    expect(merged.pl.count).toBe(0);
    expect(merged.pl.flag).toBe(false);
  });

  it('nie mutuje wejść', () => {
    const existing = { pl: richLocale('PL') };
    const snapshot = JSON.stringify(existing);
    mergeLibraryContent(existing, seedContent);
    expect(JSON.stringify(existing)).toBe(snapshot);
  });

  it('jest IDEMPOTENTNY', () => {
    const once = mergeLibraryContent(migrationContent, seedContent);
    const twice = mergeLibraryContent(once, seedContent);
    const thrice = mergeLibraryContent(twice, seedContent);
    expect(twice).toEqual(once);
    expect(thrice).toEqual(once);
  });

  it('DWUKROTNY restart nie degraduje danych', () => {
    let state = JSON.stringify(migrationContent);
    const seedJson = JSON.stringify(seedContent);
    // każdy „restart" to kolejne wywołanie seeda na zapisanym stanie
    const after1 = mergeLibraryContentJson(state, seedJson);
    const after2 = mergeLibraryContentJson(after1, seedJson);
    const after3 = mergeLibraryContentJson(after2, seedJson);

    expect(after2).toBe(after1);
    expect(after3).toBe(after1);

    state = after3;
    const final = parseLibraryContent(state);
    RICH_FIELDS.forEach((f) => expect(final.pl[f]).toBeDefined());
    expect(final.pl.whatYouGet).toEqual(['PL co dostajesz']);
  });

  it('ZERO utraconych niepustych wartości — własność ogólna', () => {
    const existing: LibraryContent = {
      pl: { ...richLocale('PL'), extra: 'x' },
      en: richLocale('EN'),
      de: { whenToUse: 'wann' },
    };
    const merged = mergeLibraryContent(existing, seedContent);

    for (const [locale, content] of Object.entries(existing)) {
      for (const [field, value] of Object.entries(content)) {
        if (isEmptyValue(value)) continue;
        expect(merged[locale]?.[field], `utracono ${locale}.${field}`).toEqual(value);
      }
    }
  });
});

describe('parseLibraryContent — dane legacy', () => {
  it('znosi null i undefined', () => {
    expect(parseLibraryContent(null)).toEqual({});
    expect(parseLibraryContent(undefined)).toEqual({});
  });

  it('znosi pusty string', () => {
    expect(parseLibraryContent('')).toEqual({});
    expect(parseLibraryContent('   ')).toEqual({});
  });

  it('znosi zepsuty JSON bez rzucania', () => {
    expect(() => parseLibraryContent('{nie-json')).not.toThrow();
    expect(parseLibraryContent('{nie-json')).toEqual({});
  });

  it('znosi JSON, który nie jest obiektem', () => {
    expect(parseLibraryContent('"tekst"')).toEqual({});
    expect(parseLibraryContent('[1,2]')).toEqual({});
    expect(parseLibraryContent('null')).toEqual({});
  });

  it('scalanie na zepsutych danych legacy przywraca treść seeda', () => {
    const merged = mergeLibraryContentJson('{zepsute', JSON.stringify(seedContent));
    const parsed = parseLibraryContent(merged);
    expect(parsed.pl.whatYouGet).toEqual(['seed PL bullet']);
  });

  it('locale o wartości nie-obiektowej nie wywraca scalania', () => {
    const merged = mergeLibraryContent({ pl: 'zły-kształt' as never }, seedContent);
    expect(merged.en).toEqual({ whatYouGet: ['seed EN bullet'] });
  });
});

describe('mergeLibraryContentJson — stabilność zapisu', () => {
  it('daje ten sam ciąg dla tego samego stanu (10 przebiegów)', () => {
    const a = JSON.stringify(migrationContent);
    const b = JSON.stringify(seedContent);
    const results = new Set(Array.from({ length: 10 }, () => mergeLibraryContentJson(a, b)));
    expect(results.size).toBe(1);
  });

  it('kolejność kluczy wejścia nie zmienia wyniku', () => {
    const order1 = JSON.stringify({ en: richLocale('EN'), pl: richLocale('PL') });
    const order2 = JSON.stringify({ pl: richLocale('PL'), en: richLocale('EN') });
    const seedJson = JSON.stringify(seedContent);
    expect(mergeLibraryContentJson(order1, seedJson)).toBe(
      mergeLibraryContentJson(order2, seedJson)
    );
  });
});
