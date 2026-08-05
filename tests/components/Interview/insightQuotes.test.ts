/**
 * M03 — regresja cytatów w karcie wniosku (Insight).
 *
 * Defekt widoczny na zrzucie `karta-insight`: cytat renderował się jako
 * `". Utrzymanie Ruchu: „Rozliczam się z liczby zamkniętych zleceń"` —
 * z osieroconym cudzysłowem i kropką na początku. Przyczyna: wzorzec
 * `/"([^"\n]{16,220})"/g` znał tylko cudzysłów ASCII, więc przy DWÓCH parach
 * „…" w jednym akapicie parował cudzysłów zamykający pierwszej pary
 * z zamykającym drugiej, przeskakując otwierające „ pomiędzy nimi.
 */
import { describe, expect, it } from 'vitest';

import { extractQuotedFragments } from '@/components/Interview/insightQuotes';

describe('extractQuotedFragments', () => {
  it('rozpoznaje polską parę „…" (U+201E + ASCII)', () => {
    const content = 'Rozmówca powiedział: „Rozliczam się z liczby zamkniętych zleceń".';
    expect(extractQuotedFragments(content)).toEqual([
      'Rozliczam się z liczby zamkniętych zleceń',
    ]);
  });

  it('rozpoznaje polską parę „…” (U+201E + U+201D)', () => {
    const content = 'Rozmówca powiedział: „Rozliczam się z liczby zamkniętych zleceń”.';
    expect(extractQuotedFragments(content)).toEqual([
      'Rozliczam się z liczby zamkniętych zleceń',
    ]);
  });

  it('rozpoznaje parę ASCII "…" (zachowana zgodność wsteczna)', () => {
    const content = 'Rozmówca powiedział: "Rozliczam sie z liczby zamknietych zlecen".';
    expect(extractQuotedFragments(content)).toEqual([
      'Rozliczam sie z liczby zamknietych zlecen',
    ]);
  });

  it('REGRESJA: dwie pary „…" w jednym akapicie dają dwa CZYSTE cytaty', () => {
    // To jest dokładnie przypadek z defektu. Przed naprawą wynik zawierał
    // JEDEN fragment zaczynający się od `. Utrzymanie Ruchu: „…`.
    const content =
      'Kierownik Produkcji: „Nie widzę realnego obłożenia gniazd w czasie". ' +
      'Utrzymanie Ruchu: „Rozliczam się z liczby zamkniętych zleceń".';

    const fragments = extractQuotedFragments(content);

    expect(fragments).toEqual([
      'Nie widzę realnego obłożenia gniazd w czasie',
      'Rozliczam się z liczby zamkniętych zleceń',
    ]);
    // Żaden fragment nie może zaczynać się od osieroconego cudzysłowu ani
    // interpunkcji zdania poprzedniego, ani nieść własnych cudzysłowów —
    // renderer dokleja `"{quote}"` sam.
    fragments.forEach((fragment) => {
      expect(fragment).not.toMatch(/^[".,;:]/);
      expect(fragment).not.toMatch(/["„“”]/);
    });
  });

  it('zwraca pustą listę dla tekstu bez cudzysłowów', () => {
    const content =
      'Zdanie bez żadnego cytatu, wystarczająco długie, żeby przekroczyć próg szesnastu znaków.';
    expect(extractQuotedFragments(content)).toEqual([]);
  });

  it('zwraca pustą listę dla pustego wejścia', () => {
    expect(extractQuotedFragments(undefined)).toEqual([]);
    expect(extractQuotedFragments('')).toEqual([]);
  });

  it('nie wywraca się i nie zapętla na nieparzystych/zagnieżdżonych cudzysłowach', () => {
    const unbalanced = 'Otwarty „cytat, który nigdy nie zostaje zamknięty w tym akapicie';
    const nested = 'Powiedział: „on stwierdził "krótko" i wyszedł z sali konferencyjnej".';
    const stormy = '„'.repeat(200) + 'tekst pomiędzy powtórzonymi cudzysłowami' + '"'.repeat(200);

    const started = Date.now();
    expect(() => extractQuotedFragments(unbalanced)).not.toThrow();
    expect(() => extractQuotedFragments(nested)).not.toThrow();
    expect(() => extractQuotedFragments(stormy)).not.toThrow();
    expect(Date.now() - started).toBeLessThan(1000);

    expect(extractQuotedFragments(unbalanced)).toEqual([]);
  });

  it('zachowuje limity długości 16–220 znaków', () => {
    expect(extractQuotedFragments('Krótkie: „za krótki".')).toEqual([]);

    const tooLong = 'x'.repeat(221);
    expect(extractQuotedFragments(`Długie: „${tooLong}".`)).toEqual([]);

    const atMax = 'x'.repeat(220);
    expect(extractQuotedFragments(`Długie: „${atMax}".`)).toEqual([atMax]);

    const atMin = 'y'.repeat(16);
    expect(extractQuotedFragments(`Krótkie: „${atMin}".`)).toEqual([atMin]);
  });

  it('zachowuje kontrakt kolejności: cytaty blokowe przed cytatami w linii', () => {
    const content = [
      '> Cytat blokowy z markdownu, wystarczająco długi',
      '',
      'Akapit z cytatem: „Cytat w linii, też wystarczająco długi".',
    ].join('\n');

    expect(extractQuotedFragments(content)).toEqual([
      'Cytat blokowy z markdownu, wystarczająco długi',
      'Cytat w linii, też wystarczająco długi',
    ]);
  });
});
