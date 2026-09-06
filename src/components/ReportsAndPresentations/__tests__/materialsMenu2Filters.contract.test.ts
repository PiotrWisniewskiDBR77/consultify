/**
 * DEC-423 (właściciel, 06.09.2026, zrzut Materiały → Wszystkie 06.09 16:20):
 * „to filtrowanie w prawym górnym rogu trzeba doprowadzić do standardu, czyli
 * rozwijanej listy. Zostają dwa rozwijane filtry, a to dziwne coś usuń."
 *
 * Bespoke popover „Filters" (przycisk + panel 320px z sekcjami Status/Typ
 * outputu/Widoczność/Review/Source, stopka „Wyczyść wszystko"/„Zrobione")
 * zastąpiony dwoma kanonicznymi dropdownami Menu 2 (`Menu2PresetDropdown` —
 * ten sam komponent, co Inicjatywy DEC-420 i Ocena DEC-414 — zero nowego
 * komponentu).
 *
 * Kontrakt źródłowy (nie pełny render — hub ciągnie router/zustand/fetch;
 * ten sam wzorzec co `Interview/__tests__/AssignInterviewModal.ownerContract.test.ts`),
 * żeby regres bespoke popovera złapać bez ciężkiego środowiska RTL.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const HUB_PATH = path.resolve(__dirname, '../ReportsAndPresentationsHub.tsx');
const source = readFileSync(HUB_PATH, 'utf-8');

describe('ReportsAndPresentationsHub — Menu 2 filtry (DEC-423)', () => {
  it('nie ma bespoke popovera „Filters" (przycisk/stan/stopka Wyczyść wszystko|Zrobione)', () => {
    expect(source).not.toContain('filtersOpen');
    expect(source).not.toContain("t('common.filters'");
    expect(source).not.toContain("t('rap.filters.hint'");
    expect(source).not.toContain("t('common.clearAll'");
    expect(source).not.toContain('toggleFilter(');
  });

  it('renderuje dokładnie dwa kanoniczne dropdowny Menu 2 (Status, Widoczność)', () => {
    const statusDropdownHits = source.match(/data-testid="materials-status-dropdown"/g) || [];
    const visibilityDropdownHits =
      source.match(/data-testid="materials-visibility-dropdown"/g) || [];
    expect(statusDropdownHits).toHaveLength(1);
    expect(visibilityDropdownHits).toHaveLength(1);
    // Nie trzeci dropdown "Typ outputu" — pełny duplikat chipów Menu 3
    // (obie ścieżki pisały do tej samej kolumny `outputKind`).
    expect(source).not.toContain('materials-outputkind-dropdown');
  });

  it('używa istniejącego Menu2PresetDropdown (Inicjatywy DEC-420) — nie pisze nowego komponentu', () => {
    // 1.1-M-2 (DEC-423b/c/d): komponent przeniesiony z `Initiatives/` do
    // `standard/` — jest kanonicznym dropdownem Menu 2 dla wielu modułów, nie
    // własnością Inicjatyw. Stara ścieżka żyje jako re-eksport zgodnościowy.
    expect(source).toContain("import { Menu2PresetDropdown } from '../standard/Menu2PresetDropdown'");
    // Dwa wywołania komponentu w rightControls: Status + Widoczność.
    const usageHits = source.match(/<Menu2PresetDropdown/g) || [];
    expect(usageHits).toHaveLength(2);
  });

  it('CTA „Nowy output" zmieniony na „Nowy materiał" (żargon → P4)', () => {
    expect(source).not.toContain("t('rap.outputs.cta.new', 'New output')");
    expect(source).toContain("t('rap.outputs.cta.new', 'New material')");
  });
});
