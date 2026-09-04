// KONTRAKT DYŻURU 338 — DEC-388
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  INITIATIVE_BOARD_CANONICAL_ORDER,
  wybierzDostepneSekcjeBoarduInicjatywy,
} from '../../../src/components/Initiatives/sections/initiativeCardContract';

const ROOT = path.resolve(__dirname, '../../..');
const WIDOK = path.join(ROOT, 'src/components/Initiatives/InitiativeDocumentView.tsx');

const wszystkie = INITIATIVE_BOARD_CANONICAL_ORDER.map((id) => ({ id }));
const quickWin = new Set([
  'initiative-definition',
  'target-state-scope',
  'tasks',
  'kpi',
  'attachments-links',
  'artifacts',
]);

describe('DEC-388 — szablon porządkuje, ale nie usuwa sekcji z nawigacji', () => {
  it('ON oddaje do renderu komplet 24 sekcji przy niepustym szablonie quick_win', () => {
    const wynik = wybierzDostepneSekcjeBoarduInicjatywy(wszystkie, quickWin, true);

    expect(wynik.map(({ id }) => id)).toEqual([...INITIATIVE_BOARD_CANONICAL_ORDER]);
    expect(wynik).toHaveLength(24);
  });

  it('OFF zachowuje zastany zbiór 6 sekcji quick_win', () => {
    const wynik = wybierzDostepneSekcjeBoarduInicjatywy(wszystkie, quickWin, false);

    expect(wynik.map(({ id }) => id)).toEqual(
      INITIATIVE_BOARD_CANONICAL_ORDER.filter((id) => quickWin.has(id))
    );
    expect(wynik).toHaveLength(6);
  });

  it('brak szablonu daje 24 sekcje niezależnie od flagi', () => {
    for (const flaga of [false, true]) {
      const wynik = wybierzDostepneSekcjeBoarduInicjatywy(wszystkie, null, flaga);
      expect(wynik.map(({ id }) => id)).toEqual([...INITIATIVE_BOARD_CANONICAL_ORDER]);
    }
  });

  it('widok przekazuje do selektora pełne allSections i nową flagę', () => {
    const src = fs.readFileSync(WIDOK, 'utf8');
    expect(src).toMatch(
      /wybierzDostepneSekcjeBoarduInicjatywy\(\s*allSections,\s*enabledNModeSectionIds,\s*initiativeSectionsCompleteEnabled\s*\)/
    );
    expect(src).not.toMatch(
      /allSections\.filter\(\(section\) => enabledNModeSectionIds\.has\(section\.id\)\)/
    );
  });
});
