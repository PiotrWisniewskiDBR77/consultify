/**
 * Testy fixtures empty i populated.
 *
 * Reguła, którą sprawdzają: „Brak danych nie usuwa struktury tabeli ani
 * powierzchni odbiorowych" (REPAIR_MASTER_PLAN §Zasady architektoniczne 6;
 * R04: „empty state zachowuje nagłówek i geometrię tabeli").
 *
 * Drugi powód istnienia tych testów: AUDIT_CHECKPOINT_MODEL stwierdza, że pusty
 * stan NIE DOWODZI anatomii wiersza, preview, kebaba ani PPM. Odbiór wymaga
 * obu wariantów, więc oba muszą istnieć i oba muszą być deterministyczne.
 */

import { describe, expect, it } from 'vitest';

import { EMPTY_PREVIEW_PROBE, emptyFixture, fixtureColumns, populatedFixture } from '../fixtures';
import { TABLE_SURFACE_IDS, TABLE_SURFACE_REGISTER } from '../surfaceRegister';
import { validateMenu2, validateMenu3, validatePreviewSchema } from '../validators';

describe('Fixture empty — struktura przeżywa brak danych', () => {
  it.each(TABLE_SURFACE_IDS)('%s: zero wierszy, pełny komplet kolumn', (id) => {
    const fixture = emptyFixture(id);
    expect(fixture.rows).toHaveLength(0);
    expect(fixture.columns).toEqual(fixtureColumns(fixture.contract));
    expect(fixture.columns.length).toBeGreaterThan(1);
  });

  it.each(TABLE_SURFACE_IDS)('%s: kolumna identyfikująca jest pierwsza', (id) => {
    const fixture = emptyFixture(id);
    expect(fixture.columns[0]).toBe(fixture.contract.capabilities.columns.identifier);
  });

  it.each(TABLE_SURFACE_IDS)('%s: kebab jest ostatnią kolumną', (id) => {
    // §5: „kebab jest ostatnią kolumną i jest wyrównany do prawej".
    const fixture = emptyFixture(id);
    expect(fixture.columns[fixture.columns.length - 1]).toBe('actions');
  });

  it.each(TABLE_SURFACE_IDS)('%s: Menu 2 i Menu 3 pozostają obecne', (id) => {
    const fixture = emptyFixture(id);
    expect(validateMenu2(fixture.menu2).violations).toEqual([]);
    expect(validateMenu3(fixture.menu3, fixture.contract.capabilities).violations).toEqual([]);
    expect(fixture.menu3.chips.length).toBeGreaterThan(0);
  });

  it.each(TABLE_SURFACE_IDS)('%s: chipy filtrów pokazują licznik 0', (id) => {
    // §4 Formuła 1: „każdy chip ma licznik, RÓWNIEŻ 0".
    const fixture = emptyFixture(id);
    expect(fixture.menu3.chips.every((chip) => chip.count === 0)).toBe(true);
  });

  it.each(TABLE_SURFACE_IDS)('%s: nie buduje menu wiersza bez rekordu', (id) => {
    expect(emptyFixture(id).rowMenu).toBeNull();
  });

  it.each(TABLE_SURFACE_IDS)('%s: schemat preview przechodzi na pustej sondzie', (id) => {
    const fixture = emptyFixture(id);
    expect(validatePreviewSchema(fixture.previewSchema, EMPTY_PREVIEW_PROBE).violations).toEqual(
      []
    );
  });
});

describe('Fixture populated — anatomia wiersza jest dowodliwa', () => {
  it.each(TABLE_SURFACE_IDS)('%s: trzy deterministyczne wiersze', (id) => {
    const fixture = populatedFixture(id);
    expect(fixture.rows).toHaveLength(3);
    expect(fixture.rows.map((row) => row.id)).toEqual([`${id}-r1`, `${id}-r2`, `${id}-r3`]);
  });

  it.each(TABLE_SURFACE_IDS)('%s: buduje menu wiersza dla pierwszego rekordu', (id) => {
    const fixture = populatedFixture(id);
    expect(fixture.rowMenu).not.toBeNull();
    expect(fixture.rowMenu?.recordId).toBe(`${id}-r1`);
  });

  it.each(TABLE_SURFACE_IDS)('%s: zawiera wiersz z pustą komórką terminu', (id) => {
    // Wariant `—` (§5: „pusta komórka zawsze —") musi być testowalny bez
    // budowania osobnego fixture per powierzchnia.
    const fixture = populatedFixture(id);
    expect(fixture.rows.some((row) => row.dueDate === null)).toBe(true);
  });

  it.each(TABLE_SURFACE_IDS)('%s: zawiera rekord bez relacji', (id) => {
    // Ścieżka kanonicznego `No relations` musi być osiągalna także w populated.
    const fixture = populatedFixture(id);
    expect(fixture.rows.some((row) => row.relations.length === 0)).toBe(true);
  });

  it.each(TABLE_SURFACE_IDS)('%s: liczniki Menu 3 odpowiadają liczbie wierszy', (id) => {
    const fixture = populatedFixture(id);
    const total = fixture.menu3.chips.reduce((sum, chip) => sum + chip.count, 0);
    expect(total).toBe(fixture.rows.length);
  });

  it('jest deterministyczny między wywołaniami', () => {
    expect(JSON.stringify(populatedFixture('T05').rows)).toBe(
      JSON.stringify(populatedFixture('T05').rows)
    );
  });
});

describe('Fixture — pokrycie wszystkich rodzajów adaptera', () => {
  it('każdy rodzaj adaptera ma co najmniej jeden fixture empty i populated', () => {
    const kinds = new Set(
      Object.values(TABLE_SURFACE_REGISTER).map((contract) => contract.adapter)
    );
    expect(kinds.size).toBeGreaterThanOrEqual(4);

    for (const kind of kinds) {
      const sample = Object.values(TABLE_SURFACE_REGISTER).find(
        (contract) => contract.adapter === kind
      );
      expect(sample).toBeDefined();
      expect(emptyFixture(sample!.id).rows).toHaveLength(0);
      expect(populatedFixture(sample!.id).rows).toHaveLength(3);
    }
  });

  it('powierzchnie wymagające nowego rejestru mają oba warianty', () => {
    // REPAIR_MASTER_PLAN Fala 2: „Każda powierzchnia musi dostać prawdziwą
    // tabelę w wariancie empty i populated."
    const needsNew = Object.values(TABLE_SURFACE_REGISTER).filter(
      (contract) => contract.requiresNewRegistry
    );
    for (const contract of needsNew) {
      expect(emptyFixture(contract.id).columns.length).toBeGreaterThan(1);
      expect(populatedFixture(contract.id).rows).toHaveLength(3);
    }
  });
});
