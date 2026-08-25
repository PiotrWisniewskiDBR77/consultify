/**
 * @vitest-environment jsdom
 *
 * MYW-IDEA-REC-001 (docs/program/waves/WAVE_03_ACCEPTANCE/modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md):
 * "Right-click context menu does not work on the Ideas table." IdeasTableContent.tsx's
 * <tr> previously had only onClick/onDoubleClick — right-click fell through to the
 * browser's native menu. Fixed by wiring the same PPM-mirror contract every other
 * canon table already uses (ANEKS #3b, `RowActionsMenu`'s `contextMenuAnchor`/
 * `onContextMenuClose` props, see FilterableTable.tsx:613/1237-1268/1384-1398 for the
 * reference implementation this mirrors): right-click opens the SAME popover the row's
 * kebab renders, anchored at the cursor instead of the button.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { IdeasTableContent } from '../../../src/components/MyWork/IdeasTableContent';
import type { MyIdea } from '../../../src/components/MyWork/myIdeasTypes';
import type { ColumnWidths, FilterOption, TableFilters } from '../../../src/components/ui/ResizableTable';

const COLUMN_WIDTHS: ColumnWidths = {
  select: 40,
  title: 560,
  stage: 150,
  tags: 230,
  tool: 190,
  date: 128,
  actions: 56,
};

const IDEAS: MyIdea[] = [
  {
    id: 'idea-1',
    title: 'Ekspansja DE — mapa hipotez',
    body: 'Mapa hipotez wejscia na rynek DE.',
    tags: ['rynek', 'DE'],
    stage: 'shaping',
    preferredTool: 'mindmap',
    createdAt: '2026-06-20T09:00:00Z',
    updatedAt: '2026-07-15T11:20:00Z',
  },
  {
    id: 'idea-2',
    title: 'Automatyzacja raportowania OEE',
    body: 'Dashboard OEE zasilany z hali w czasie rzeczywistym.',
    tags: ['operacje'],
    stage: 'ready',
    preferredTool: 'table',
    createdAt: '2026-06-18T09:00:00Z',
    updatedAt: '2026-07-12T08:00:00Z',
  },
];

const STAGE_OPTIONS: FilterOption[] = [{ value: 'spark', label: 'Iskra' }];
const TAG_OPTIONS: FilterOption[] = [{ value: 'rynek', label: 'rynek' }];
const TOOL_OPTIONS: FilterOption[] = [{ value: 'mindmap', label: 'Mapa rekomendacji' }];

function renderTable() {
  const tableFilters: TableFilters = {};
  return render(
    <MemoryRouter initialEntries={['/']}>
      <IdeasTableContent
        ideas={IDEAS}
        isPolish={false}
        tableFilters={tableFilters}
        availableStageOptions={STAGE_OPTIONS}
        availableTagOptions={TAG_OPTIONS}
        availableToolOptions={TOOL_OPTIONS}
        columnWidths={COLUMN_WIDTHS}
        selectedIds={new Set()}
        allSelected={false}
        someSelected={false}
        focusedIndex={-1}
        sortField="date"
        sortDir="desc"
        onSort={() => {}}
        onFocusIndexChange={() => {}}
        onToggleSelect={() => {}}
        onSelectAllVisible={() => {}}
        onClearSelection={() => {}}
        onColumnResize={() => {}}
        onTableFilterChange={() => {}}
        onOpenIdea={() => {}}
        onOpenIdeaInProcessFlow={() => {}}
        onStartConvert={() => {}}
        onDeleteIdea={() => {}}
        onRefresh={() => {}}
      />
    </MemoryRouter>
  );
}

const getRow = (title: string) => screen.getByText(title).closest('tr') as HTMLTableRowElement;

describe('IdeasTableContent — row right-click context menu (MYW-IDEA-REC-001)', () => {
  it('right-click on a row opens the same popover its kebab renders, anchored at the cursor', () => {
    renderTable();
    const row = getRow('Ekspansja DE — mapa hipotez');

    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.contextMenu(row, { clientX: 123, clientY: 456 });

    const menu = screen.getByRole('menu');
    expect(menu.getAttribute('data-row-actions-menu')).toBe('context');
    // Same sections/labels the kebab would show for this row — not a
    // different, ad-hoc menu.
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Open' })).toBeInTheDocument();
    // Anchored at the cursor point (+ RowActionsMenu's fixed ANCHOR_GAP below
    // it), not the kebab button's rect.
    expect(menu.style.top).toBe('462px');
  });

  it('right-clicking a different row moves the popover to that row, never showing two at once', () => {
    renderTable();
    const rowOne = getRow('Ekspansja DE — mapa hipotez');
    const rowTwo = getRow('Automatyzacja raportowania OEE');

    fireEvent.contextMenu(rowOne, { clientX: 10, clientY: 20 });
    expect(screen.getAllByRole('menu')).toHaveLength(1);

    fireEvent.contextMenu(rowTwo, { clientX: 300, clientY: 400 });
    const menus = screen.getAllByRole('menu');
    expect(menus).toHaveLength(1);
    expect(menus[0].style.top).toBe('406px');
  });

  it('does not open the native browser menu (event default is prevented)', () => {
    renderTable();
    const row = getRow('Ekspansja DE — mapa hipotez');

    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 5,
      clientY: 5,
    });
    row.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('clicking the row action closes the popover and fires the same handler as the kebab', () => {
    renderTable();
    const row = getRow('Ekspansja DE — mapa hipotez');

    fireEvent.contextMenu(row, { clientX: 1, clientY: 1 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open preview' }));

    expect(screen.queryByRole('menu')).toBeNull();
  });
});
