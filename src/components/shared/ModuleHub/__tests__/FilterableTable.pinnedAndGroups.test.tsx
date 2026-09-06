/**
 * @vitest-environment jsdom
 *
 * JĄDRO TABELI — trzy mechaniki dołożone dla raportu KPI (SSOT
 * `docs/modules/07_rezultaty/SSOT_WYNIKI_KPI_OKR_ROI.md` §6), wszystkie
 * OPT-IN, więc bez propów tabela ma zachowywać się jak dotąd:
 *   1. `TableColumn.pinned` — kolumna przypięta z lewej/prawej przy
 *      przewijaniu poziomym, z offsetem policzonym z JEJ WŁASNEJ szerokości;
 *   2. `isGroupRow`/`renderGroupRow` — wiersz grupy jako JEDNA komórka na
 *      całą szerokość (werdykt K6: „zero »—« w wierszu grupy");
 *   3. odporność KOLEJNOŚCI kolumn na zapisany układ z INNEGO zestawu kolumn.
 *
 * Punkt 3 to defekt ZMIERZONY na pierwszym zrzucie poziomu 2
 * (`evidence/p7k-a-kpi/`): ekran renderuje się najpierw bez kolumn okresów
 * (matryca jeszcze leci), zapisuje kolejność dla KRÓTKIEJ listy, a po dojściu
 * danych zapisane `order` kolumn YTD/STAN zderza się z indeksami dwunastu
 * nowych kolumn — i tabela pokazuje „MIERNIK · STY · YTD · LUT · STAN · MAR".
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { FilterableTable, type TableColumn } from '../FilterableTable';

const PERSIST_KEY = 'test.filterable.pinned-groups';
const STORAGE_KEY = `filterableTable.cols.${PERSIST_KEY}`;

const kolumnaOkresu = (n: number): TableColumn => ({
  id: `period-${n}`,
  label: `M${n}`,
  width: '140px',
  render: (row: any) => <span>{row[`period-${n}`] ?? '—'}</span>,
});

function kolumny(liczbaOkresow: number): TableColumn[] {
  return [
    { id: 'name', label: 'MIERNIK', width: '320px', pinned: 'left', render: (r: any) => <b>{r.name}</b> },
    ...Array.from({ length: liczbaOkresow }, (_u, i) => kolumnaOkresu(i + 1)),
    { id: 'ytd', label: 'YTD', width: '140px', pinned: 'right', render: (r: any) => <span>{r.ytd}</span> },
    { id: 'state', label: 'STAN', width: '130px', pinned: 'right', render: (r: any) => <span>{r.state}</span> },
  ];
}

const WIERSZE = [
  { id: 'g-1', group: true, area: 'SPRZEDAŻ' },
  { id: 'k-1', name: 'Wielkość sprzedaży netto', ytd: '94 810', state: 'Krytyczne', 'period-1': '11 050' },
];

function naglowki(): string[] {
  return [...document.querySelectorAll('thead th')]
    .map((th) => (th.textContent ?? '').trim())
    .filter(Boolean);
}

describe('FilterableTable — przypięte kolumny i wiersz grupujący', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('bez propów NIC nie jest przypięte ani grupowane (addytywność)', () => {
    const zwykle: TableColumn[] = [
      { id: 'name', label: 'NAZWA', render: (r: any) => <span>{r.name}</span> },
      { id: 'ytd', label: 'YTD', render: (r: any) => <span>{r.ytd}</span> },
    ];
    render(<FilterableTable columns={zwykle} data={[WIERSZE[1]!]} persistKey={`${PERSIST_KEY}.plain`} activeFilters={[]} onFilterChange={() => {}} hideRowActions />);
    const przypiete = [...document.querySelectorAll('thead th')].filter(
      (th) => getComputedStyle(th).position === 'sticky'
    );
    // Jedyna przypięta komórka nagłówka to strukturalna kolumna akcji —
    // i to tylko wtedy, gdy moduł zadeklarował kebab (tu: nie zadeklarował).
    expect(przypiete).toHaveLength(0);
    expect(document.querySelector('tr[data-group-row="true"]')).toBeNull();
  });

  it('przypina MIERNIK z lewej, a YTD i STAN z prawej, z offsetem z własnej szerokości', () => {
    render(
      <FilterableTable
        columns={kolumny(12)}
        data={WIERSZE}
        persistKey={PERSIST_KEY}
        activeFilters={[]}
        onFilterChange={() => {}}
        minTableWidth={2354}
        isGroupRow={(row: any) => !!row.group}
        renderGroupRow={(row: any) => <b>{row.area}</b>}
      />
    );
    const th = [...document.querySelectorAll('thead th')] as HTMLElement[];
    const miernik = th.find((t) => t.textContent?.includes('MIERNIK'))!;
    const ytd = th.find((t) => t.textContent?.trim() === 'YTD')!;
    const stan = th.find((t) => t.textContent?.trim() === 'STAN')!;

    expect(miernik.style.left).toBe('0px');
    // STAN stoi ZA strukturalną kolumną akcji (80 px). YTD stoi za STANEM —
    // sprawdzamy NIEZMIENNIK (offset = 80 + szerokość STANU), a nie literał:
    // to właśnie rozjazd między offsetem a realną szerokością sąsiada tworzył
    // szczelinę, przez którą przebijała przewijana treść (defekt K10).
    expect(stan.style.right).toBe('80px');
    const szerokoscStanu = Number.parseInt(stan.style.width, 10);
    expect(Number.isFinite(szerokoscStanu)).toBe(true);
    expect(ytd.style.right).toBe(`${80 + szerokoscStanu}px`);
    // Szerokość przypiętej kolumny jest ZAMKNIĘTA — inaczej między kolumnami
    // zostaje szczelina, przez którą przebija przewijana treść (defekt K10).
    expect(ytd.style.width).toBe(ytd.style.minWidth);
    expect(ytd.style.width).toBe(ytd.style.maxWidth);
  });

  it('wiersz grupy to JEDNA komórka na całą szerokość — zero „—" w kolumnach grupy', () => {
    render(
      <FilterableTable
        columns={kolumny(12)}
        data={WIERSZE}
        persistKey={PERSIST_KEY}
        activeFilters={[]}
        onFilterChange={() => {}}
        isGroupRow={(row: any) => !!row.group}
        renderGroupRow={(row: any) => <b>{row.area}</b>}
      />
    );
    const wierszGrupy = document.querySelector('tr[data-group-row="true"]') as HTMLElement;
    expect(wierszGrupy).not.toBeNull();
    expect(wierszGrupy.querySelectorAll('td')).toHaveLength(1);
    expect(wierszGrupy).toHaveTextContent('SPRZEDAŻ');
    expect(wierszGrupy.textContent).not.toContain('—');
    // Wiersz danych obok — dla kontrastu — przechodzi normalną ścieżką komórek.
    expect(screen.getByText('Wielkość sprzedaży netto')).toBeInTheDocument();
  });

  it('ZAPISANY układ z INNEGO zestawu kolumn nie przeplata kolumn (defekt zmierzony na zrzucie)', () => {
    /* Układ zapisany, gdy kolumn okresów jeszcze nie było: ytd=1, state=2.
       Po dojściu dwunastu okresów te wartości zderzają się z ich indeksami. */
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        widths: {},
        visibility: { name: true, ytd: true, state: true },
        order: { name: 0, ytd: 1, state: 2 },
      })
    );
    render(
      <FilterableTable
        columns={kolumny(12)}
        data={WIERSZE}
        persistKey={PERSIST_KEY}
        activeFilters={[]}
        onFilterChange={() => {}}
        isGroupRow={(row: any) => !!row.group}
        renderGroupRow={(row: any) => <b>{row.area}</b>}
      />
    );
    const etykiety = naglowki();
    expect(etykiety[0]).toBe('MIERNIK');
    // Wszystkie dwanaście okresów PRZED YTD i STANEM, w kolejności deklaracji.
    expect(etykiety.slice(1, 13)).toEqual(
      Array.from({ length: 12 }, (_u, i) => `M${i + 1}`)
    );
    expect(etykiety[13]).toBe('YTD');
    expect(etykiety[14]).toBe('STAN');
  });

  it('KOMPLETNY i jednoznaczny układ użytkownika nadal obowiązuje', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        widths: {},
        visibility: { name: true, 'period-1': true, ytd: true, state: true },
        // Odwrócona kolejność dwóch ostatnich — kompletna dla TEGO zestawu.
        order: { name: 0, 'period-1': 1, state: 2, ytd: 3 },
      })
    );
    render(
      <FilterableTable
        columns={kolumny(1)}
        data={WIERSZE}
        persistKey={PERSIST_KEY}
        activeFilters={[]}
        onFilterChange={() => {}}
        isGroupRow={(row: any) => !!row.group}
        renderGroupRow={(row: any) => <b>{row.area}</b>}
      />
    );
    expect(naglowki()).toEqual(['MIERNIK', 'M1', 'STAN', 'YTD']);
  });
});
