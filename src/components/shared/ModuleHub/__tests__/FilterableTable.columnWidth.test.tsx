/**
 * @vitest-environment jsdom
 *
 * P2 — szerokość zadeklarowana ani zapisana nie może przebić podłogi typu.
 * Dowód mutacyjny: status=90 łamie pierwszy test; usunięcie Math.max z
 * mergePersisted łamie drugi.
 */
import { fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FilterableTable,
  HEADER_FILTER_BUDGET_PX,
  HEADER_HORIZONTAL_PADDING_PX,
  HEADER_SORT_BUDGET_PX,
  getColumnFitFloor,
  type TableColumn,
} from '../FilterableTable';

const renderTable = (columns: TableColumn[], persistKey?: string) =>
  render(
    <FilterableTable
      columns={columns}
      data={[{ id: 'r1', urgency: 'Wysoka', owner: 'Jan Kowalski' }]}
      activeFilters={[]}
      onFilterChange={() => {}}
      hideRowActions
      persistKey={persistKey}
    />
  );

describe('FilterableTable — podłogi szerokości P2', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('status podbija zadeklarowane 90 px do floora 130 px', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        font: '',
        measureText: () => ({ width: 0 }),
      } as unknown as CanvasRenderingContext2D);
    const { getByRole } = renderTable([
      { id: 'urgency', label: 'PILNOŚĆ', width: '90px', dataType: 'status' },
    ]);

    const header = getByRole('columnheader');
    expect(header.style.width).toBe('130px');
    expect(header.style.minWidth).toBe('130px');
  });

  it('mergePersisted podbija zapisane 95 px właściciela do 150 px', () => {
    window.localStorage.setItem(
      'filterableTable.cols.p2-owner',
      JSON.stringify({ widths: { owner: 95 }, visibility: {}, order: {} })
    );

    const { getByRole } = renderTable(
      [{ id: 'owner', label: 'WŁAŚCICIEL', dataType: 'owner' }],
      'p2-owner'
    );

    const header = getByRole('columnheader');
    expect(header.style.width).toBe('150px');
    expect(header.style.minWidth).toBe('150px');
  });

  it('długa etykieta mieści pomiar canvas oraz budżet ikon', () => {
    const measuredTextPx = 180;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        font: '',
        measureText: () => ({ width: measuredTextPx }),
      } as unknown as CanvasRenderingContext2D);

    const { getByRole } = renderTable([
      {
        id: 'effect',
        label: 'OCZEKIWANY EFEKT',
        width: '90px',
        sortable: true,
        filterable: true,
      },
    ]);

    const width = Number.parseFloat(getByRole('columnheader').style.width);
    expect(width).toBeGreaterThanOrEqual(
      measuredTextPx +
        HEADER_HORIZONTAL_PADDING_PX +
        HEADER_SORT_BUDGET_PX +
        HEADER_FILTER_BUDGET_PX
    );
  });

  it('pokazuje komponentowy Tooltip tylko przy realnym przepełnieniu', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(180);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(90);
    const { container, getByRole } = renderTable([
      { id: 'urgency', label: 'PILNOŚĆ', dataType: 'status' },
    ]);
    const trigger = container.querySelector('[data-overflow-tooltip-trigger]') as HTMLElement;
    expect(trigger).toBeTruthy();
    expect(trigger.getAttribute('title')).toBeNull();

    fireEvent.mouseEnter(trigger);
    await waitFor(() => expect(getByRole('tooltip')).toHaveTextContent('PILNOŚĆ'));
  });

  it('nie pokazuje Tooltipa, gdy tekst faktycznie się mieści', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(90);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(90);
    const { container, queryByRole } = renderTable([
      { id: 'urgency', label: 'PILNOŚĆ', dataType: 'status' },
    ]);
    const trigger = container.querySelector('[data-overflow-tooltip-trigger]') as HTMLElement;

    fireEvent.mouseEnter(trigger);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(queryByRole('tooltip')).toBeNull();
  });

  it.each([
    ['Skrzynka Moja Praca', { id: 'status', label: 'STATUS', dataType: 'status' }, 130],
    ['Sejf', { id: 'owner', label: 'WŁAŚCICIEL', dataType: 'owner' }, 150],
    ['Realizacje', { id: 'deadline', label: 'TERMIN', dataType: 'date' }, 110],
    ['Sprawozdania Finanse', { id: 'amount', label: 'WARTOŚĆ', dataType: 'number' }, 90],
    ['Biblioteka Audyty', { id: 'scope', label: 'ZAKRES', dataType: 'text' }, 140],
  ] as const)('%s: columnFit nie schodzi poniżej floora typu', (_screen, column, floor) => {
    expect(getColumnFitFloor(column)).toBe(floor);
  });
});
