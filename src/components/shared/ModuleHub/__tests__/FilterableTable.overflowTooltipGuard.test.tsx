/**
 * KOSMETYKA RAPORT_B #10 (evidence/audyt-mvp-20260906/B/RAPORT_B.md):
 * `OverflowTooltip` (komórka bez `column.render`) budowało `content` przez
 * `String(row[column.id])`, chronione tylko przez `isEmptyCell()`
 * (null/undefined/pusty string → myślnik „—"). Rzadki, ale realny przypadek —
 * surowy obiekt/tablica przekazany bez `column.render` — przechodzi
 * `isEmptyCell` (nie jest null/undefined/pustym stringiem) i trafiał do
 * `String()`, który dla obiektu daje literał "[object Object]": TRUTHY
 * string, którego `Tooltip`'s own `!content` guard nie łapie.
 *
 * Naprawa: `toTooltipSafeString()` — tylko genuine string/number/boolean
 * dostają tekst tooltipa, wszystko inne dostaje pusty string (Tooltip wtedy
 * po prostu nie renderuje popupu, `if (!content) return children;`).
 *
 * Dowód mutacyjny: przywrócenie `String(value)` bezwarunkowego (bez guardu
 * typeof) w `toTooltipSafeString` wywala test „nigdy nie zamienia obiektu...".
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FilterableTable, toTooltipSafeString } from '../FilterableTable';

// NOTE: a raw object/array as a cell value (no `column.render`) crashes React
// itself ("Objects are not valid as a React child") on the VISIBLE `{row[
// column.id]}` children, independent of the tooltip — confirmed by hand while
// writing this test. So that combination was already unrenderable before this
// fix; the fix's job is narrower and real: make sure NOTHING that reaches
// `toTooltipSafeString` (now or after a future refactor of the children path)
// can turn into "undefined"/"[object Object]" as the tooltip's own text —
// covered directly below.

describe('toTooltipSafeString — guard przeciw "undefined"/"[object Object]" w tooltipie', () => {
  it('przepuszcza genuine string/number/boolean bez zmian (poza konwersją na string)', () => {
    expect(toTooltipSafeString('Alicja')).toBe('Alicja');
    expect(toTooltipSafeString(42)).toBe('42');
    expect(toTooltipSafeString(0)).toBe('0');
    expect(toTooltipSafeString(true)).toBe('true');
    expect(toTooltipSafeString(false)).toBe('false');
  });

  it('nigdy nie zamienia obiektu/tablicy/undefined/null na literał techniczny — pusty string zamiast tego', () => {
    expect(toTooltipSafeString(undefined)).toBe('');
    expect(toTooltipSafeString(null)).toBe('');
    expect(toTooltipSafeString({ section: 'goals' })).toBe('');
    expect(toTooltipSafeString([1, 2, 3])).toBe('');
    // Jawnie: NIGDY surowy String() na obiekcie/undefined.
    expect(toTooltipSafeString({ section: 'goals' })).not.toBe('[object Object]');
    expect(toTooltipSafeString(undefined)).not.toBe('undefined');
    expect(toTooltipSafeString(null)).not.toBe('null');
  });
});

describe('FilterableTable — komórka z wartością 0 renderuje się poprawnie (nie trafia na myślnik isEmptyCell)', () => {
  it('liczba 0 NIE daje "undefined"/"[object Object]" w DOM i pokazuje faktyczne "0"', () => {
    const rows = [{ id: 'r1', licznik: 0 }];

    const { container } = render(
      <FilterableTable
        columns={[{ id: 'licznik', label: 'Licznik' }]}
        data={rows}
        activeFilters={[]}
        onFilterChange={() => {}}
      />
    );

    expect(container.textContent).not.toContain('undefined');
    expect(container.textContent).not.toContain('[object Object]');
    expect(container.textContent).toContain('0');
  });
});
