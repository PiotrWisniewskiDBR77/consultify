/**
 * @vitest-environment jsdom
 *
 * S13-STICKY (2026-08-12) — regression coverage for the row-actions kebab
 * overflow defect: at 1280×800 in the true production shape
 * (MyIdeasListContent.tsx:1786/:1791 — IdeasTableContent as the sole child
 * of a column flex, no sibling ArtifactRightPanel), DEFAULT_IDEAS_COLUMN_WIDTHS
 * sums to 1354px against a 1280px viewport, pushing the kebab — the ONLY
 * route to per-row actions — ~74px past the right edge at rest.
 *
 * jsdom does not run layout, so this test cannot measure real pixel
 * positions (that verification lives in the dev-render harness, driven with
 * a real browser — see dev-render/screens/idea-table-production.tsx). What
 * IS verifiable here, structurally:
 *   1. The actions column (header + every body cell) carries sticky
 *      right-edge positioning classes — the actual fix.
 *   2. The kebab button stays reachable by ROLE + ACCESSIBLE NAME for every
 *      rendered row (not just "present somewhere in the DOM").
 *
 * Negative control performed manually during development (not committed):
 * temporarily strip `sticky right-0` from the actions <td>/<th> in
 * IdeasTableContent.tsx → this suite goes RED on the sticky-class assertion
 * → restore → GREEN again. See the session report for the exact red output.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { IdeasTableContent } from '../../../src/components/MyWork/IdeasTableContent';
import type { MyIdea } from '../../../src/components/MyWork/myIdeasTypes';
import type { ColumnWidths, FilterOption, TableFilters } from '../../../src/components/ui/ResizableTable';

// Byte-for-byte match of dev-render/screens/idea-table-production.tsx's
// DEFAULT_COLUMN_WIDTHS, itself a copy of MyIdeasListContent's
// DEFAULT_IDEAS_COLUMN_WIDTHS — the exact widths that overflow 1280px.
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
    body: 'Mapa hipotez wejścia na rynek DE.',
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
  {
    id: 'idea-3',
    title: 'Program lojalnościowy B2B',
    body: 'Warstwowy program partnerski dla top-50 klientów.',
    tags: ['sprzedaż'],
    stage: 'incubating',
    preferredTool: 'whiteboard',
    createdAt: '2026-07-01T09:00:00Z',
    updatedAt: '2026-07-10T14:30:00Z',
  },
];

const STAGE_OPTIONS: FilterOption[] = [{ value: 'spark', label: 'Iskra' }];
const TAG_OPTIONS: FilterOption[] = [{ value: 'rynek', label: 'rynek' }];
const TOOL_OPTIONS: FilterOption[] = [{ value: 'mindmap', label: 'Mapa rekomendacji' }];

function renderTable() {
  const tableFilters: TableFilters = {};
  return render(
    // MemoryRouter: renderPreviewFooter → ConvertToOutputMenu calls useNavigate(),
    // even though this suite never opens a preview (no row click).
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

describe('IdeasTableContent — sticky actions column (S13-STICKY)', () => {
  it('every row exposes a reachable "Row actions" kebab by role + accessible name', () => {
    renderTable();

    // aria-label="Row actions" is hardcoded in RowActionsMenu.tsx (not
    // translated) — a stable accessible name regardless of isPolish.
    const kebabs = screen.getAllByRole('button', { name: 'Row actions' });
    expect(kebabs).toHaveLength(IDEAS.length);
    kebabs.forEach((kebab) => {
      expect(kebab).toBeVisible();
      expect(kebab).not.toBeDisabled();
    });
  });

  it('the actions header cell and every body cell carry sticky right-edge positioning', () => {
    const { container } = renderTable();
    const table = container.querySelector('table');
    expect(table).not.toBeNull();

    const headerCell = table!.querySelector('thead tr th:last-child');
    expect(headerCell).not.toBeNull();
    expect(headerCell!.className).toMatch(/\bsticky\b/);
    expect(headerCell!.className).toMatch(/\bright-0\b/);
    // Opaque background required — the sticky cell overlays scrolling
    // content, a transparent cell would show the data columns bleeding
    // through underneath it.
    expect(headerCell!.className).toMatch(/bg-c-surface-raised/);

    const bodyCells = table!.querySelectorAll('tbody tr td:last-child');
    expect(bodyCells).toHaveLength(IDEAS.length);
    bodyCells.forEach((cell) => {
      expect(cell.className).toMatch(/\bsticky\b/);
      expect(cell.className).toMatch(/\bright-0\b/);
      // Every row state resolves to an opaque bg-* class (never transparent).
      expect(cell.className).toMatch(/bg-(c-surface|slate-)/);
    });
  });

  it('the kebab in every row lives inside the sticky actions cell (structural pairing)', () => {
    renderTable();
    const kebabs = screen.getAllByRole('button', { name: 'Row actions' });

    kebabs.forEach((kebab) => {
      const cell = kebab.closest('td');
      expect(cell).not.toBeNull();
      expect(cell!.className).toMatch(/\bsticky\b/);
      expect(cell!.className).toMatch(/\bright-0\b/);
    });
  });
});
