/**
 * KANON SZEROKOŚCI KOLUMN (K5-7) — test mechaniki, nie ekranu.
 *
 * Każdy przypadek odpowiada odchyleniu zmierzonemu na odbiorze właściciela
 * (staging `cf3fded7e4`, 2026-09-13): kolumny dzielone po równo, kolumna
 * z samymi „—" tak szeroka jak tytuł, nagłówek ucięty.
 *
 * DOWÓD MUTACYJNY jest dopisany przy każdym teście: która zmiana w kodzie
 * produkcyjnym musi go wywrócić.
 */
import React from 'react';
import { describe, expect, it } from 'vitest';

import {
  cellCanClip,
  cellTextLines,
  COLUMN_MAX_WIDTH_BY_DATA_TYPE,
  distributeColumnSurplus,
  inferColumnDataType,
  measureColumnContent,
  type SurplusColumn,
} from '../columnWidthCanon';

/** Pomiar atrapowy: 7 px na znak — deterministyczny, bez przeglądarki. */
const measure = (text: string) => text.length * 7;

const h = React.createElement;

describe('inferColumnDataType — typ kolumny, gdy moduł go nie podał', () => {
  it('deklaracja modułu ma pierwszeństwo nad wszystkim', () => {
    // Mutacja: usunięcie `if (column.dataType) return column.dataType`.
    expect(inferColumnDataType({ id: 'updatedAt', dataType: 'text' })).toBe('text');
  });

  it('rozpoznaje datę, status, osobę i liczbę po nazwie kolumny', () => {
    expect(inferColumnDataType({ id: 'updatedAt', label: 'Updated' })).toBe('date');
    expect(inferColumnDataType({ id: 'plannedWindow', label: 'Planned window' })).toBe('date');
    expect(inferColumnDataType({ id: 'gateReadiness', label: 'Readiness' })).toBe('status');
    expect(inferColumnDataType({ id: 'owner', label: 'Owner' })).toBe('owner');
    expect(inferColumnDataType({ id: 'daysOverdue', label: 'Days overdue' })).toBe('number');
  });

  it('bez podpowiedzi w nazwie rozstrzyga KSZTAŁT danych', () => {
    expect(inferColumnDataType({ id: 'kolumna', label: 'Kolumna' }, ['12,5', '3', '108'])).toBe(
      'number'
    );
    expect(inferColumnDataType({ id: 'kolumna', label: 'Kolumna' }, ['2026-09-13'])).toBe('date');
    expect(inferColumnDataType({ id: 'kolumna', label: 'Kolumna' }, ['Zweryfikuj efekty'])).toBe(
      'text'
    );
  });
});

describe('cellTextLines — tekst komórki rozbity na linie', () => {
  it('sąsiadujące teksty w jednym elemencie to JEDNA linia', () => {
    expect(cellTextLines(h('span', {}, 'Confidence', ': ', 'Medium'))).toEqual([
      'Confidence: Medium',
    ]);
  });

  it('zagnieżdżony element zaczyna nową linię (komórka dwupiętrowa)', () => {
    const komorka = h(
      'div',
      {},
      h('span', {}, 'Optymalizacja zapasów'),
      h('span', {}, 'Brak opisu problemu')
    );
    // Mutacja: sklejenie w jeden string — test padnie, bo zobaczy jedną linię
    // o sumarycznej szerokości (to był powód, dla którego kolumna rosła 2×).
    expect(cellTextLines(komorka)).toEqual(['Optymalizacja zapasów', 'Brak opisu problemu']);
  });
});

describe('measureColumnContent — ile kolumna NAPRAWDĘ potrzebuje', () => {
  const columns = [
    { id: 'name', label: 'Initiative', render: (r: any) => h('span', {}, r.name) },
    { id: 'areaOrAxis', label: 'Area / Axis', render: () => h('span', {}, '—') },
    { id: 'status', label: 'Status' },
  ];
  const rows = [
    { id: '1', name: 'Optymalizacja zapasów komponentów', status: 'Pending approval' },
    { id: '2', name: 'RPA', status: 'Draft' },
  ];

  it('kolumna z samymi „—" jest oznaczona jako PUSTA i mierzy kilkanaście pikseli', () => {
    const wynik = measureColumnContent({ columns, rows, measure });
    // Odchylenie T1: „kolumny z samymi — tak samo szerokie jak tytuł".
    expect(wynik.areaOrAxis.empty).toBe(true);
    expect(wynik.areaOrAxis.width).toBeLessThan(wynik.name.width);
  });

  it('mierzy NAJSZERSZY wiersz, nie pierwszy', () => {
    const wynik = measureColumnContent({ columns, rows, measure });
    expect(wynik.name.width).toBe('Optymalizacja zapasów komponentów'.length * 7 + 40);
  });

  it('kolumna bez `render` mierzy surową wartość wiersza', () => {
    const wynik = measureColumnContent({ columns, rows, measure });
    expect(wynik.status.width).toBe('Pending approval'.length * 7 + 40);
  });

  it('polska pigułka statusu mieści pełną etykietę w kanonicznej szerokości', () => {
    const wynik = measureColumnContent({
      columns: [{ id: 'status', label: 'STATUS', dataType: 'status' as const }],
      rows: [{ id: '1', status: 'Zatwierdzona' }],
      measure,
    });
    expect(COLUMN_MAX_WIDTH_BY_DATA_TYPE.status).toBeGreaterThanOrEqual(wynik.status.width);
  });

  it('`render`, który rzuca, nie wywraca pomiaru całej tabeli', () => {
    const wynik = measureColumnContent({
      columns: [
        {
          id: 'bomba',
          label: 'Bomba',
          render: () => {
            throw new Error('boom');
          },
        },
      ],
      rows,
      measure,
    });
    expect(wynik.bomba.width).toBe(40);
  });
});

describe('distributeColumnSurplus — luz dostaje TYTUŁ, nie wszyscy po równo', () => {
  const kolumny: SurplusColumn[] = [
    { id: 'name', width: 200, want: 400, isPrimary: true, dataType: 'text' },
    { id: 'status', width: 120, want: 120, isPrimary: false, dataType: 'status' },
    { id: 'updatedAt', width: 100, want: 100, isPrimary: false, dataType: 'date' },
  ];

  it('kolumna stanowa i data NIE rosną ani o piksel', () => {
    // ODCHYLENIE T1: to jest dokładnie ta reguła, której brak dawał „po równo".
    // Mutacja: nadanie wagi 1 kolumnom innym niż title/text — test padnie.
    const w = distributeColumnSurplus(kolumny, 300);
    expect(w.status).toBe(120);
    expect(w.updatedAt).toBe(100);
  });

  it('cały luz trafia do kolumny tytułowej', () => {
    const w = distributeColumnSurplus(kolumny, 300);
    expect(w.name).toBe(500);
  });

  it('suma po rozdaniu = suma przed + luz (przeglądarce nie zostaje nic)', () => {
    const luz = 137;
    const w = distributeColumnSurplus(kolumny, luz);
    const przed = kolumny.reduce((s, c) => s + c.width, 0);
    expect(Object.values(w).reduce((s, x) => s + x, 0)).toBe(przed + luz);
  });

  it('kolumna ruszona ręcznie nie dostaje luzu', () => {
    const w = distributeColumnSurplus(
      [
        { id: 'name', width: 200, want: 900, isPrimary: true, dataType: 'text', manual: true },
        { id: 'opis', width: 150, want: 900, isPrimary: false, dataType: 'text' },
      ],
      100
    );
    expect(w.name).toBe(200);
    expect(w.opis).toBe(250);
  });

  it('same kolumny stanowe — luz idzie po równo, bo nie ma komu go oddać', () => {
    const w = distributeColumnSurplus(
      [
        { id: 'a', width: 100, want: 100, isPrimary: false, dataType: 'status' },
        { id: 'b', width: 100, want: 100, isPrimary: false, dataType: 'date' },
      ],
      50
    );
    expect(w.a + w.b).toBe(250);
  });

  it('brak luzu nie zmienia niczego', () => {
    expect(distributeColumnSurplus(kolumny, 0)).toEqual({
      name: 200,
      status: 120,
      updatedAt: 100,
    });
  });
});

describe('sufity typów', () => {
  it('kolumna stanowa/data/liczba ma sufit węższy niż proza', () => {
    expect(COLUMN_MAX_WIDTH_BY_DATA_TYPE.status).toBeLessThan(COLUMN_MAX_WIDTH_BY_DATA_TYPE.text);
    expect(COLUMN_MAX_WIDTH_BY_DATA_TYPE.number).toBeLessThan(COLUMN_MAX_WIDTH_BY_DATA_TYPE.text);
    expect(COLUMN_MAX_WIDTH_BY_DATA_TYPE.date).toBeLessThan(COLUMN_MAX_WIDTH_BY_DATA_TYPE.text);
  });
});

describe('cellCanClip — przycinamy tylko to, z czego nic nie wyskoczy', () => {
  it('czysty tekst i zwykłe spany wolno przyciąć', () => {
    expect(cellCanClip('Monitor the execution')).toBe(true);
    expect(cellCanClip(h('span', { className: 'x' }, 'Draft'))).toBe(true);
    expect(cellCanClip(h('div', {}, h('span', {}, 'A'), h('span', {}, 'B')))).toBe(true);
  });

  it('komórka z przyciskiem, uchwytem zdarzeń lub `role` NIE jest przycinana', () => {
    // To jest zabezpieczenie popoverów renderowanych bez portalu wprost
    // w komórce (`PMO/StatusTransitionDropdown`). Mutacja: usunięcie któregoś
    // z warunków — test padnie.
    expect(cellCanClip(h('button', {}, 'Zmień'))).toBe(false);
    expect(cellCanClip(h('span', { onClick: () => {} }, 'Zmień'))).toBe(false);
    expect(cellCanClip(h('div', { role: 'menu' }, 'Menu'))).toBe(false);
  });

  it('komponent (nie tag HTML) jest traktowany jako nieprzycinalny', () => {
    const Chip: React.FC = () => null;
    expect(cellCanClip(h(Chip, {}))).toBe(false);
  });
});
