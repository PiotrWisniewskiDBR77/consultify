/**
 * R04-0 — kanoniczna wysokość nagłówka i wiersza rejestru.
 *
 * Decyzja zarządzająca (2026-08-06): **56 px jest nadrzędne** dla wysokości
 * nagłówka i wiersza; `px-3 py-2.5` z kontraktu §5 to wyłącznie wskazówka
 * paddingu i nie może zmienić wysokości końcowej.
 *
 * PO CO TEN PLIK. Preflight R04 wykazał, że do tej pory kanon podawał wyłącznie
 * paddingi — wysokość wiersza była wypadkową fontu i line-heightu, więc nie
 * istniała liczba, względem której cokolwiek dałoby się zasertować. W kodzie
 * żyje `px-4 py-3` / `px-4 py-2`, a żaden test nie mógł tego złapać. To jest
 * dokładnie wzorzec „test zielony, bo nie ma czego sprawdzać", od którego cały
 * program naprawczy się zaczął (kebab 160 px przy kanonie 220 px).
 *
 * ZAKRES: wyłącznie `canon.ts`. R04-0 NIE zmienia ani jednego komponentu —
 * podłączenie 56 px do `FilterableTable`/`StandardTable` należy do R04-2,
 * dziś zablokowanego cudzą konsolidacją.
 */

import { describe, expect, it } from 'vitest';

import { CANON_HIT_TARGET, CANON_TABLE, CANON_TYPOGRAPHY } from '../canon';
import { TABLE_SURFACE_IDS, TABLE_SURFACE_REGISTER } from '../surfaceRegister';
import { canonicalRegisterPreset } from '../types';
import { validateSurfaceRegister, validateTableSurfaceCapabilities } from '../validators';

describe('R04-0 · wysokość nagłówka i wiersza', () => {
  it('nagłówek ma dokładnie 56 px', () => {
    expect(CANON_TABLE.headerHeight).toBe(56);
  });

  it('wiersz ma dokładnie 56 px', () => {
    expect(CANON_TABLE.rowHeight).toBe(56);
  });

  it('nagłówek i wiersz mają tę samą wysokość', () => {
    // R04: „wysokość nagłówka i wiersza 56 px" — jedna liczba, nie dwie zbieżne.
    expect(CANON_TABLE.headerHeight).toBe(CANON_TABLE.rowHeight);
  });

  it('obie wartości są liczbami całkowitymi w px, nie stringami z jednostką', () => {
    expect(Number.isInteger(CANON_TABLE.headerHeight)).toBe(true);
    expect(Number.isInteger(CANON_TABLE.rowHeight)).toBe(true);
  });
});

describe('R04-0 · spójność 56 px z resztą kanonu', () => {
  it('mieści się w bazowej siatce 4 px', () => {
    expect(CANON_TABLE.rowHeight % CANON_TABLE.spacingGrid).toBe(0);
    expect(CANON_TABLE.headerHeight % CANON_TABLE.spacingGrid).toBe(0);
  });

  it('mieści cel kliknięcia 32×32 wraz z oddechem', () => {
    // Kebab wiersza i Settings2 mają 32 px; przy 56 px zostaje 12 px z każdej
    // strony, więc trigger nie dotyka krawędzi wiersza.
    expect(CANON_TABLE.rowHeight).toBeGreaterThan(CANON_HIT_TARGET.min);
    expect((CANON_TABLE.rowHeight - CANON_HIT_TARGET.min) / 2).toBeGreaterThanOrEqual(8);
  });

  it('padding jest WSKAZÓWKĄ — mieści się w 56 px i nie może ich wyznaczać', () => {
    // Gdyby padding wyznaczał wysokość, 2×10 px + treść dałoby ~44 px, nie 56.
    // Test pilnuje, że wskazówka mieści się w nadrzędnej liczbie, a nie że ją tworzy.
    expect(CANON_TABLE.cellPaddingY * 2).toBeLessThan(CANON_TABLE.rowHeight);
    expect(CANON_TABLE.titleCellPaddingY * 2).toBeLessThan(CANON_TABLE.rowHeight);
  });

  it('zostaje miejsce na tytuł w dwóch liniach', () => {
    // Tytuł 14 px semibold, line-height ~20 px, maks. 2 linie = 40 px.
    // Przy 56 px mieści się razem z paddingiem — wysokość nie musi rosnąć,
    // co jest warunkiem reguły „stabilna wysokość dla opisu włączonego i wyłączonego".
    const twoLines = CANON_TYPOGRAPHY.rowTitleSizePx * 2 * 1.45;
    expect(twoLines).toBeLessThanOrEqual(CANON_TABLE.rowHeight);
  });

  it('nagłówek mieści typografię 11 px uppercase', () => {
    expect(CANON_TYPOGRAPHY.tableHeaderSizePx).toBeLessThan(CANON_TABLE.headerHeight);
    expect(CANON_TYPOGRAPHY.tableHeaderTransform).toBe('uppercase');
    expect(CANON_TYPOGRAPHY.tableHeaderWeight).toBe(600);
  });
});

describe('R04-0 · brak regresji presetów i walidatorów', () => {
  it('rejestr 45 powierzchni nadal przechodzi walidator', () => {
    expect(validateSurfaceRegister(TABLE_SURFACE_REGISTER).violations).toEqual([]);
  });

  it.each(TABLE_SURFACE_IDS)('%s: deskryptor capability nadal kompletny', (id) => {
    expect(
      validateTableSurfaceCapabilities(TABLE_SURFACE_REGISTER[id].capabilities).violations
    ).toEqual([]);
  });

  it.each(TABLE_SURFACE_IDS)('%s: kanoniczny preset rejestru bez zmian', (id) => {
    const contract = TABLE_SURFACE_REGISTER[id];
    const preset = canonicalRegisterPreset(contract.capabilities);
    // Dodanie wysokości do kanonu nie może zmienić kształtu presetu — 56 px
    // opisuje geometrię, nie capability.
    expect(preset.settings2).toBe(true);
    expect(preset.stickyHeader).toBe(true);
    expect(preset.zebraStriping).toBe(false);
    expect(preset.emptyStatePreservesStructure).toBe(true);
    expect(preset.selectionCheckboxes).toBe(contract.capabilities.selection === 'bulk');
  });

  it('preset NIE niesie wysokości — geometria żyje w kanonie, nie w capability', () => {
    const preset = canonicalRegisterPreset(TABLE_SURFACE_REGISTER.T05.capabilities);
    expect('rowHeight' in preset).toBe(false);
    expect('headerHeight' in preset).toBe(false);
  });
});

describe('R04-0 · granica pakietu', () => {
  it('empty state ma zachować nagłówek i geometrię — reguła jest w presecie', () => {
    // Liczba 56 px staje się egzekwowalna dopiero, gdy R04-2 podłączy ją do
    // shella. Tutaj utrwalamy jedynie, że kontrakt tego wymaga.
    const preset = canonicalRegisterPreset(TABLE_SURFACE_REGISTER.T22.capabilities);
    expect(preset.emptyStatePreservesStructure).toBe(true);
    expect(CANON_TABLE.headerHeight).toBe(56);
  });
});
