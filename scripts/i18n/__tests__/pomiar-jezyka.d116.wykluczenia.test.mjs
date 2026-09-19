/**
 * @vitest-environment node
 *
 * D-116 (Wpis 168): hook J0 w trybie `--staged` nie stosował wykluczenia
 * `/__tests__/`, które stosuje pełny skan — fixture testowy z `title`/
 * `description` liczył się w pre-commit, a nie liczył w pełnym skanie i bazy
 * się rozjeżdżały. Naprawa = JEDNA funkcja wykluczeń (`pominSciezke`, czytająca
 * `pomijaneSciezki` z `pomiar-jezyka.wyjatki.json`) używana przez OBA tryby:
 * pełny skan przez `listujPliki`, szybki przez `czyDotknieteZrodlo`.
 *
 * Test mrożący kontrakt: fixture w `__tests__/` nie liczy się ani w `--staged`,
 * ani w pełnym skanie; ten sam obiekt POZA `__tests__/` liczy się w obu.
 *
 * Mutacja: rozdziel listy (szybki tryb przestaje wołać `pominSciezke`, np.
 * `czyDotknieteZrodlo` = sam prefiks ścieżki) → przypadek 1 czerwony.
 */
import { describe, expect, it } from 'vitest';
import {
  analizujLiteralyObiektowZawartosc,
  czyDotknieteZrodlo,
  pominSciezke,
} from '../pomiar-jezyka.mjs';

// Ten sam obiekt-_fixture (angielskie `title`/`description` = K4obj) w dwóch
// lokalizacjach: w `__tests__/` i poza nim.
const SCIEZKA_TEST = 'src/components/ReportsAndPresentations/__tests__/Tpl.d116.test.tsx';
const SCIEZKA_PRODUKT = 'src/components/ReportsAndPresentations/Tpl.d116.tsx';
const TRESC_FIXTURE = `export const tpl = { title: 'Quarterly review', description: 'Narrative pack' };\n`;

describe('D-116 — jedno źródło wykluczeń dla pełnego skanu i --staged', () => {
  it('1. fixture w __tests__: pomijany i w pełnym skanie, i w --staged', () => {
    // Pełny skan pomija (listujPliki -> pominSciezkeRaw).
    expect(pominSciezke(SCIEZKA_TEST)).toBe(true);
    // Szybki (--staged) też pomija — to jest NAPRAWA D-116.
    expect(czyDotknieteZrodlo(SCIEZKA_TEST)).toBe(false);
  });

  it('2. ten sam obiekt POZA __tests__: liczony i w pełnym skanie, i w --staged', () => {
    expect(pominSciezke(SCIEZKA_PRODUKT)).toBe(false);
    expect(czyDotknieteZrodlo(SCIEZKA_PRODUKT)).toBe(true);
  });

  it('3. to WYKLUCZENIE zeruje licznik, nie analizator (treść fixture naprawdę ma K4obj)', () => {
    const w = analizujLiteralyObiektowZawartosc(TRESC_FIXTURE);
    expect(w.K4obj).toBeGreaterThan(0);
  });
});
