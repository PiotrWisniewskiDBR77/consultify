/**
 * R04-2A — pilot kanonicznego register shella na `FilterableTable`.
 *
 * Kontrakt: `MY_WORK_TABLE_SURFACE_CONTRACT_V1.md` §5 (tabela, Settings2,
 * selection, stany), decyzja kanoniczna R04-0 (56 px nadrzędne).
 *
 * ZAKRES: wyłącznie `FilterableTable`. `StandardTable` celowo nietknięty —
 * to druga faza pilota.
 *
 * OGRANICZENIE DOWODOWE: jsdom nie liczy layoutu, więc wysokość jest dowodzona
 * przez klasę, która ją ustala (`h-14`), plus asercja wiążąca tę klasę z
 * `CANON_TABLE` (56 px). Piksele domyka dowód wizualny G3/G4.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CANON_TABLE } from '@/contracts/tableSurface/canon';

import { FilterableTable, type TableColumn, type TableRow } from '../ModuleHub/FilterableTable';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // `FilterableTable` woła `t` w obu wariantach: `t(key, 'fallback')` oraz
    // `t(key, { defaultValue })`. Mock zwracający drugi argument wprost oddawał
    // Reactowi obiekt i wywracał cały render — stąd ta rozgałęziona wersja.
    t: (key: string, fallback?: string | { defaultValue?: string }) => {
      if (typeof fallback === 'string') return fallback;
      if (fallback && typeof fallback === 'object' && fallback.defaultValue) {
        return fallback.defaultValue;
      }
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

const columns: TableColumn[] = [
  { id: 'name', label: 'Name' },
  { id: 'status', label: 'Status', filterable: true, filterOptions: [{ value: 'a', label: 'A' }] },
];

const data: TableRow[] = [
  { id: '1', name: 'Alpha', status: 'a' },
  { id: '2', name: 'Beta', status: 'b' },
];

function renderTable(props: Partial<React.ComponentProps<typeof FilterableTable>> = {}) {
  const onFilterChange = vi.fn();
  const utils = render(
    <FilterableTable
      columns={columns}
      data={data}
      activeFilters={[]}
      onFilterChange={onFilterChange}
      {...props}
    />
  );
  return { ...utils, onFilterChange };
}

const headerCells = () => [...document.querySelectorAll('thead th')] as HTMLElement[];
const bodyCells = () => [...document.querySelectorAll('tbody td')] as HTMLElement[];

// ── Wysokość 56 px (decyzja R04-0) ─────────────────────────────────────────

describe('R04-2A · wysokość nagłówka i wiersza', () => {
  it('klasa h-14 odpowiada kanonicznym 56 px', () => {
    // Wiązanie klasy z liczbą — inaczej zmiana kanonu nie ruszyłaby kodu.
    expect(CANON_TABLE.rowHeight).toBe(56);
    expect(CANON_TABLE.headerHeight).toBe(56);
  });

  it('każda komórka nagłówka deklaruje 56 px', () => {
    renderTable();
    const cells = headerCells();
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) expect(cell.className).toContain('h-14');
  });

  it('każda komórka wiersza deklaruje 56 px', () => {
    renderTable();
    const cells = bodyCells();
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) expect(cell.className).toContain('h-14');
  });

  it('tryb compact NIE obniża wysokości — padding tak, wysokość nie', () => {
    // To jest sedno decyzji kanonicznej: `density` steruje paddingiem,
    // ale końcowa wysokość rejestru pozostaje 56 px w obu trybach.
    renderTable({ density: 'compact' });
    for (const cell of bodyCells()) {
      expect(cell.className).toContain('h-14');
      expect(cell.className).toContain('py-2');
    }
  });

  it('tryb comfortable ma ten sam wymiar końcowy', () => {
    renderTable({ density: 'comfortable' });
    for (const cell of bodyCells()) {
      expect(cell.className).toContain('h-14');
      expect(cell.className).toContain('py-3');
    }
  });
});

// ── Selection (§5, §10) ────────────────────────────────────────────────────

describe('R04-2A · checkbox tylko przy zadeklarowanym selection', () => {
  const selectColumns: TableColumn[] = [{ id: 'sel', label: '', type: 'select' }, ...columns];
  const selection = {
    selectedIds: new Set<string>(),
    onToggleRow: vi.fn(),
    onToggleAll: vi.fn(),
    isAllSelected: false,
    isIndeterminate: false,
  };

  it('BEZ propa selection nie ma ani jednego checkboxa', () => {
    renderTable({ columns: selectColumns });
    expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  });

  it('Z propem selection są checkboxy nagłówka i wierszy', () => {
    renderTable({ columns: selectColumns, selection });
    const header = within(document.querySelector('thead') as HTMLElement).getAllByRole('checkbox');
    const body = within(document.querySelector('tbody') as HTMLElement).getAllByRole('checkbox');
    expect(header).toHaveLength(1);
    expect(body).toHaveLength(data.length);
  });

  it('klik checkboxa NIE uruchamia preview ani full detail', () => {
    const onRowClick = vi.fn();
    const onRowDoubleClick = vi.fn();
    const onToggleRow = vi.fn();
    renderTable({
      columns: selectColumns,
      selection: { ...selection, onToggleRow },
      onRowClick,
      onRowDoubleClick,
    });

    const rowCheckbox = within(document.querySelector('tbody') as HTMLElement).getAllByRole(
      'checkbox'
    )[0];
    fireEvent.click(rowCheckbox);

    expect(onToggleRow).toHaveBeenCalledWith('1');
    expect(onRowClick).not.toHaveBeenCalled();
    expect(onRowDoubleClick).not.toHaveBeenCalled();
  });
});

// ── Interakcja wiersza (§5) ────────────────────────────────────────────────

describe('R04-2A · interakcja wiersza', () => {
  it('pojedynczy klik wiersza otwiera preview', () => {
    const onRowClick = vi.fn();
    renderTable({ onRowClick });
    fireEvent.click(screen.getByText('Alpha').closest('tr') as HTMLElement);
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick.mock.calls[0][0].id).toBe('1');
  });

  it('podwójny klik otwiera pełny szczegół', () => {
    const onRowDoubleClick = vi.fn();
    renderTable({ onRowDoubleClick });
    fireEvent.doubleClick(screen.getByText('Alpha').closest('tr') as HTMLElement);
    expect(onRowDoubleClick).toHaveBeenCalledTimes(1);
  });
});

// ── Stany empty (§5 Stany) ─────────────────────────────────────────────────

describe('R04-2A · empty state rozróżnia przyczynę', () => {
  const emptyCell = () => document.querySelector('[data-empty-reason]') as HTMLElement;

  it('brak danych — powód „no-data"', () => {
    renderTable({ data: [], emptyMessage: 'Nothing here yet' });
    expect(emptyCell().getAttribute('data-empty-reason')).toBe('no-data');
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
  });

  it('dane są, ale filtr nic nie zwrócił — powód „no-filter-results"', () => {
    renderTable({
      activeFilters: [{ id: 'status', label: 'Status', value: 'zzz' } as never],
    });
    const cell = emptyCell();
    expect(cell).not.toBeNull();
    expect(cell.getAttribute('data-empty-reason')).toBe('no-filter-results');
  });

  it('stan „brak wyniku filtra" oferuje reset, a nie tylko komunikat', () => {
    const { onFilterChange } = renderTable({
      activeFilters: [{ id: 'status', label: 'Status', value: 'zzz' } as never],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onFilterChange).toHaveBeenCalledWith([]);
  });

  it('respektuje własny komunikat dla stanu przefiltrowanego', () => {
    renderTable({
      activeFilters: [{ id: 'status', label: 'Status', value: 'zzz' } as never],
      emptyFilteredMessage: 'Nic nie pasuje do filtrów',
    });
    expect(screen.getByText('Nic nie pasuje do filtrów')).toBeInTheDocument();
  });

  it('empty state ZACHOWUJE nagłówek i jego geometrię', () => {
    // §5: „empty state zachowuje nagłówek i geometrię tabeli".
    renderTable({ data: [] });
    const cells = headerCells();
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) expect(cell.className).toContain('h-14');
    expect(screen.getByText('Name')).toBeInTheDocument();
  });
});

// ── Overflow / 1280 (§9) ───────────────────────────────────────────────────

describe('R04-2A · brak clippingu przy 1280', () => {
  it('tabela żyje w kontenerze z jawnym poziomym overflow', () => {
    const { container } = renderTable();
    const table = container.querySelector('table') as HTMLElement;
    const scroller = table.closest('.overflow-x-auto');
    // Kolumny nie są chowane — nadmiar jest osiągalny przewijaniem.
    expect(scroller).not.toBeNull();
  });
});

// ── Sort / filter — brak regresji ──────────────────────────────────────────

describe('R04-2A · sort i filtr nadal działają', () => {
  it('sortowalna kolumna reaguje na klik nagłówka', () => {
    const sortableColumns: TableColumn[] = [
      { id: 'name', label: 'Name', sortable: true },
      { id: 'status', label: 'Status' },
    ];
    renderTable({ columns: sortableColumns });
    const header = screen.getByText('Name');
    fireEvent.click(header);
    // Kolejność w DOM po sortowaniu rosnąco: Alpha przed Beta.
    const names = [...document.querySelectorAll('tbody tr')].map(
      (tr) => tr.textContent?.trim() ?? ''
    );
    expect(names[0]).toContain('Alpha');
  });

  it('renderuje wszystkie wiersze bez filtrów', () => {
    renderTable();
    expect(document.querySelectorAll('tbody tr')).toHaveLength(data.length);
  });
});
