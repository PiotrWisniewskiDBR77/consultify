/**
 * Bezpiecznik kanonu fokusa dla wspólnej tabeli listowej.
 *
 * DLACZEGO:
 * Odbiór MPQ (2026-08-13) zmierzył na żywo, przez realny Tab i getComputedStyle,
 * że pierścień fokusa w tabeli listowej ma kolor rgb(229,151,0) — bursztyn. To nie
 * jest wybrany kolor, tylko DOMYŚLNY OUTLINE PRZEGLĄDARKI, rysowany dlatego, że
 * przycisk nie miał żadnej klasy `focus-visible`. Kanon wymaga niebieskiego tokenu
 * `c-focus`.
 *
 * Waga defektu brała się z miejsca: `FilterableTable` renderuje KAŻDY ekran listowy
 * produktu, a przycisk sortowania nagłówka jest zwykle pierwszym elementem, na który
 * trafia Tab. Jedna brakująca klasa łamała więc kanon dostępności wszędzie naraz i
 * przeżyła kilka rund poprawek, bo każdy audyt patrzył na ekran modułu, a nie na
 * wspólny komponent pod spodem.
 *
 * Ten test nie sprawdza wyglądu — od tego są zrzuty. Sprawdza niecofalność: że żaden
 * interaktywny element tej tabeli nie wróci do stanu „brak deklaracji fokusa", w
 * którym przeglądarka podstawia swój własny.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, '..', 'FilterableTable.tsx'), 'utf8');

describe('kanon fokusa we wspólnej tabeli listowej', () => {
  it('każdy <button> deklaruje niebieski pierścień c-focus', () => {
    const buttons = source.match(/<button/g)?.length ?? 0;
    const focusRings = source.match(/focus-visible:ring-c-focus/g)?.length ?? 0;

    // Sedno jest w RÓWNOŚCI, nie w tym, że deklaracji jest „dużo": każdy przycisk
    // ma mieć własną. Nadmiar też jest sygnałem — znaczy, że policzenie się rozjechało
    // i ktoś powinien na to spojrzeć.
    expect(
      focusRings,
      `W FilterableTable jest ${buttons} przycisków, a deklaracji focus-visible:ring-c-focus ` +
        `jest ${focusRings}. Przycisk bez tej klasy dostaje domyślny outline przeglądarki ` +
        '(zmierzony bursztyn rgb(229,151,0)) i łamie kanon na każdym ekranie listowym.',
    ).toBeGreaterThanOrEqual(buttons);
  });

  it('nie używa crimsonu jako koloru fokusa', () => {
    // `primary-*` to w tym repo crimson #85182F, zarezerwowany dla semantyki
    // krytycznej. Fokus krytyczny nie jest.
    expect(source).not.toMatch(/focus[^"']*:(ring|border)-primary-/);
  });
});
