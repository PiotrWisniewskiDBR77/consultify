/**
 * RODZINA UCIĘĆ — łamanie tekstu w komórce TYLKO na granicy wyrazu (2026-09-02).
 * @vitest-environment jsdom
 *
 * Czego broni: `td` nosi `break-words` (`overflow-wrap: break-word`) jako ostatnią
 * deskę ratunku dla treści wylewającej się poza kolumnę. Ta reguła jest DZIEDZICZONA,
 * więc treść, którą moduł renderuje jako WŁASNE ELEMENTY, dostawała ją bez żadnej
 * osłony i rozrywała wyraz w połowie przy wąskiej kolumnie. Zmierzone na zrzutach
 * 2026-09-02: `results-zestawienia` („3 wskaźnik / i", kolumna 90 px) i
 * `chat-signals-feed` („Interpretac / ja AI"). Tekst GOŁY (string/number) był
 * chroniony przez `CELL_TEXT_CLAMP_CLASS` od 2026-08-30 — elementowy nie.
 *
 * Dowód mutacyjny: usunięcie `CELL_ELEMENT_WRAP_CLASS` z gałęzi elementowej w
 * `FilterableTable.tsx` wywala oba pierwsze testy (opakowanie znika, więc komórka
 * znów oddaje `break-words` w dół).
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  CELL_ELEMENT_WRAP_CLASS,
  CELL_TEXT_CLAMP_CLASS,
  FilterableTable,
} from '../FilterableTable';

const rows = [{ id: 'r1', name: 'Wiersz', licznik: 3 }];

describe('FilterableTable — łamanie tekstu w komórce', () => {
  it('treść renderowana jako ELEMENTY dostaje warstwę zbijającą overflow-wrap', () => {
    const { container } = render(
      <FilterableTable
        columns={[
          { id: 'name', label: 'Nazwa' },
          {
            id: 'licznik',
            label: 'Wskaźniki',
            width: '90px',
            render: (row: any) => <span>{row.licznik} wskaźniki</span>,
          },
        ]}
        data={rows}
        activeFilters={[]}
        onFilterChange={() => {}}
      />
    );
    const komorka = container.querySelector('tbody tr td:nth-child(2)') as HTMLElement;
    const opakowanie = komorka.firstElementChild as HTMLElement;
    expect(opakowanie).toBeTruthy();
    expect(opakowanie.className).toContain('break-normal');
    expect(opakowanie.textContent).toBe('3 wskaźniki');
  });

  it('warstwa elementowa NIE przycina (popovery komórek muszą wychodzić poza obrys)', () => {
    expect(CELL_ELEMENT_WRAP_CLASS).not.toContain('overflow-hidden');
    expect(CELL_ELEMENT_WRAP_CLASS).toContain('break-normal');
  });

  it('goły tekst dalej dostaje wielokropek na warstwie tekstu', () => {
    expect(CELL_TEXT_CLAMP_CLASS).toContain('break-normal');
    expect(CELL_TEXT_CLAMP_CLASS).toContain('text-ellipsis');
    const { container } = render(
      <FilterableTable
        columns={[
          { id: 'name', label: 'Nazwa' },
          { id: 'licznik', label: 'Wskaźniki', render: (row: any) => `${row.licznik} wskaźniki` },
        ]}
        data={rows}
        activeFilters={[]}
        onFilterChange={() => {}}
      />
    );
    const komorka = container.querySelector('tbody tr td:nth-child(2)') as HTMLElement;
    expect((komorka.firstElementChild as HTMLElement).className).toContain('text-ellipsis');
  });

  it('ŻADEN element kanonu tabeli nie wpuszcza `break-all` (rozrywa wyraz zawsze)', () => {
    expect(CELL_TEXT_CLAMP_CLASS).not.toContain('break-all');
    expect(CELL_ELEMENT_WRAP_CLASS).not.toContain('break-all');
  });
});
