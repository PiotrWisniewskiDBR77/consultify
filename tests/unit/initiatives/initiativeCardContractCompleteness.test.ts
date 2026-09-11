/**
 * BEZPIECZNIK DEC-387 — „Musimy mieć kompletne karty inicjatyw — to jest sens
 * naszej aplikacji" (właściciel, 2026-09-04).
 *
 * CO SIĘ STAŁO: kontrakt karty (dyżur 305, flaga `ff_initiativeCardContract`,
 * default OFF) przy włączeniu ZWĘŻAŁ lewą nawigację rekordu inicjatywy do
 * czterech pozycji. Pomiar kanonicznym `scripts/dev/grafika-zrzuty.mjs --zlicz`
 * na REALNYM rekordzie (`karta-initiative`, id `init-smed-linia-pakowania`,
 * ścieżka produkcyjna, nie fikstura `init-showcase-*`): OFF 24 sekcje / 5 grup,
 * ON 4 sekcje / 2 grupy — kasowane 20 z 24 sekcji i całe grupy „Decyzje i
 * ryzyko", „Ludzie", „Zapisy".
 *
 * DECYZJA: kontrakt ma sekcje ZACHOWYWAĆ i tylko PORZĄDKOWAĆ. Ten test broni
 * dokładnie tego zabezpieczenia (nie mechanizmu obok):
 *   M1 — kolejność kanoniczna POKRYWA każdą sekcję boardu produktu;
 *   M2 — porządkowanie jest PERMUTACJĄ (nic nie wypada po drodze);
 *   M3 — ziarno ukryć przy fladze ON jest PUSTE;
 *   M4 — funkcja porządkująca ma realnego WOŁACZA w widoku (nie biblioteka bez wywołania).
 *
 * Lista id boardu jest czytana ZE ŹRÓDŁA produktu, nie przepisana do testu —
 * inaczej test starzałby się w milczeniu przy dodaniu nowej sekcji.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  INITIATIVE_BOARD_CANONICAL_ORDER,
  INITIATIVE_CONTRACT_HIDDEN_SEED,
  sekcjeBoarduPozaKontraktem,
  uporzadkujSekcjeBoarduInicjatywy,
} from '../../../src/components/Initiatives/sections/initiativeCardContract';

const ROOT = path.resolve(__dirname, '../../..');
const WIDOK = path.join(ROOT, 'src/components/Initiatives/InitiativeDocumentView.tsx');

/**
 * Wydobądź id sekcji boardu z tablicy `allSections` w `initiativeNSections`.
 * Granice: od `const initiativeNSections` do deklaracji `const groupLabels`
 * (pierwsza linia PO tablicy). Wewnątrz — wpisy wcięte o 8 spacji.
 */
function idSekcjiBoarduZeZrodla(): string[] {
  const src = fs.readFileSync(WIDOK, 'utf8');
  const start = src.indexOf('const initiativeNSections');
  const koniec = src.indexOf('const groupLabels', start);
  expect(start, 'nie znaleziono `const initiativeNSections` w źródle widoku').toBeGreaterThan(-1);
  expect(koniec, 'nie znaleziono `const groupLabels` w źródle widoku').toBeGreaterThan(start);
  const blok = src.slice(start, koniec);
  const ids = Array.from(blok.matchAll(/^ {8}id: '([a-z0-9-]+)',$/gm)).map((m) => m[1]);
  // „Brak pomiaru nie jest wynikiem": gdyby parsowanie się rozjechało, test ma
  // paść tutaj, a nie przejść na pustej liście.
  expect(ids.length, 'parsowanie id boardu zwróciło podejrzanie mało pozycji').toBeGreaterThanOrEqual(20);
  expect(ids).toContain('initiative-definition');
  expect(new Set(ids).size, 'id boardu muszą być unikalne').toBe(ids.length);
  return ids;
}

describe('DEC-387 — kontrakt karty Inicjatywy porządkuje, nie ucina', () => {
  it('M1: kolejność kanoniczna pokrywa KAŻDĄ sekcję boardu produktu', () => {
    const board = idSekcjiBoarduZeZrodla();
    expect(sekcjeBoarduPozaKontraktem(board)).toEqual([]);
  });

  it('M2: uporządkowanie jest permutacją — ta sama liczebność i ten sam zbiór id', () => {
    const board = idSekcjiBoarduZeZrodla();
    const wynik = uporzadkujSekcjeBoarduInicjatywy(board);
    expect(wynik).toHaveLength(board.length);
    expect([...wynik].sort()).toEqual([...board].sort());
  });

  it('M3: przy fladze ON kontrakt nie ukrywa ANI JEDNEJ sekcji', () => {
    expect(INITIATIVE_CONTRACT_HIDDEN_SEED).toEqual([]);
  });

  it('M3b: liczba sekcji widocznych przy ON nie jest mniejsza niż przy OFF', () => {
    const board = idSekcjiBoarduZeZrodla();
    const ukryte = new Set(INITIATIVE_CONTRACT_HIDDEN_SEED);
    const widoczneOff = board; // OFF = brak ziarna ukryć (hiddenSectionIds = pusty zbiór)
    const widoczneOn = uporzadkujSekcjeBoarduInicjatywy(board).filter((id) => !ukryte.has(id));
    expect(widoczneOn.length).toBeGreaterThanOrEqual(widoczneOff.length);
    expect([...widoczneOn].sort()).toEqual([...widoczneOff].sort());
  });

  it('M4: widok REALNIE woła porządkowanie kontraktu (nie biblioteka bez wywołania)', () => {
    const src = fs.readFileSync(WIDOK, 'utf8');
    expect(src).toMatch(/uporzadkujSekcjeBoarduInicjatywy\(/);
    // Zakaz powrotu ziarna-allowlisty: żadnego ukrywania „wszystkiego poza rdzeniem"
    // przy montażu. Preset „Rdzeń inicjatywy" zostaje, ale wyłącznie jako klik użytkownika.
    expect(src).not.toMatch(/setHiddenSectionIds\(new Set\(hide\)\)/);
  });

  it('M1b: kolejność kanoniczna nie ma pozycji-widmo (każdy wpis istnieje w boardzie)', () => {
    const board = new Set(idSekcjiBoarduZeZrodla());
    const widma = INITIATIVE_BOARD_CANONICAL_ORDER.filter((id) => !board.has(id));
    expect(widma).toEqual([]);
  });
});
