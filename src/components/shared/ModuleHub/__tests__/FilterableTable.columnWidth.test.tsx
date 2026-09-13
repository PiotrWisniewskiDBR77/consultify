/**
 * @vitest-environment jsdom
 *
 * REGRESJA — `TableColumn.width` w jednostce innej niż piksele.
 *
 * Defekt (naprawiony 2026-08-30): `parsePx` kończył się fallbackiem
 * `Number(value.replace(/[^\d.]/g, ''))`, więc `'30%'` stawało się `30` i
 * kolumna tytułowa dostawała `width: 30px`. Przy `table-layout: fixed` daje to
 * nagłówki nachodzące na siebie i treść uciętą do jednego znaku — zmierzone w
 * dev-render (43 px realnej szerokości; `min-width: 200px` na `<th>` NIE
 * ratuje, bo przeglądarka pomija min/max-width komórek w `table-fixed`).
 * Objaw wystąpił już raz (commit 45e2a15408, ResultsHub) i został wtedy
 * załatany w JEDNYM wywołaniu, nie w parserze — dlatego odrósł w 12 plikach.
 *
 * Test pilnuje KONTRAKTU parsera, nie wyglądu: `<th>` dostaje inline
 * `width` w px, więc atrybut stylu jest bezpośrednim odczytem wyniku `parsePx`
 * (jsdom nie liczy layoutu — i nie musi).
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultOrOpts?: any) =>
      typeof defaultOrOpts === 'string' ? defaultOrOpts : key,
  }),
}));

import { FilterableTable, type TableColumn } from '../FilterableTable';

const ROWS = [{ id: 'r1', title: 'Ocena gotowości — obszar 1', other: 'x' }];

const renderZeSzerokoscia = (width?: string) => {
  const columns: TableColumn[] = [
    { id: 'title', label: 'Title', width },
    { id: 'other', label: 'Other' },
  ];
  const { unmount } = render(
    <FilterableTable columns={columns} data={ROWS} activeFilters={[]} onFilterChange={vi.fn()} />
  );
  const th = screen.getByText('Title').closest('th')!;
  const wynik = th.style.width;
  unmount();
  return wynik;
};

describe('FilterableTable — kontrakt TableColumn.width', () => {
  it('piksele przechodzą bez zmian ("260px" i samo "260")', () => {
    expect(renderZeSzerokoscia('260px')).toBe('260px');
    expect(renderZeSzerokoscia('300px')).toBe('300px');
    expect(renderZeSzerokoscia('300')).toBe('300px');
  });

  it('brak `width` daje kanoniczny fallback kolumny tytułowej (260 px)', () => {
    expect(renderZeSzerokoscia(undefined)).toBe('260px');
  });

  it('PROCENTY nie stają się pikselami — spadają do fallbacku', () => {
    // Przed naprawą każdy z tych przypadków dawał odpowiednio 30/25/26/28/38 px.
    for (const procent of ['30%', '25%', '26%', '28%', '38%']) {
      expect(renderZeSzerokoscia(procent)).toBe('260px');
    }
  });

  it('inne jednostki względne też spadają do fallbacku', () => {
    for (const wartosc of ['20rem', 'auto', 'calc(100% - 40px)', '', '   ']) {
      expect(renderZeSzerokoscia(wartosc)).toBe('260px');
    }
  });

  it('kolumna niebędąca title/name ma fallback 140 px', () => {
    const columns: TableColumn[] = [
      { id: 'title', label: 'Title', width: '260px' },
      { id: 'other', label: 'Other', width: '16%' },
    ];
    render(
      <FilterableTable columns={columns} data={ROWS} activeFilters={[]} onFilterChange={vi.fn()} />
    );
    expect(screen.getByText('Other').closest('th')!.style.width).toBe('140px');
  });
});
