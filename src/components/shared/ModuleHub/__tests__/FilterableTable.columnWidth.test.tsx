/**
 * @vitest-environment jsdom
 *
 * P2 — szerokość zadeklarowana ani zapisana nie może przebić podłogi typu.
 * Dowód mutacyjny: status=90 łamie pierwszy test; usunięcie Math.max z
 * mergePersisted łamie drugi.
 */
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { FilterableTable, type TableColumn } from '../FilterableTable';

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

  it('status podbija zadeklarowane 90 px do floora 130 px', () => {
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
});
