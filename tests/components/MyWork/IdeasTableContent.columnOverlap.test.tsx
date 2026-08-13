/**
 * @vitest-environment jsdom
 *
 * S17-OVERLAPTEST (2026-08-12) — contract test for the Updated-column /
 * pinned-actions-column OVERLAP defect that S13-STICKY's fix introduced.
 * UPDATED by S18-NOOVERLAP (2026-08-12), which implemented the fix and
 * corrected this suite's structural flaw — read the second doc block below
 * before trusting anything in this file.
 *
 * S13-STICKY pinned the row-actions column (`sticky right-0`,
 * IdeasTableContent.tsx header/body `<th>`/`<td>`) so the kebab — the ONLY
 * route to per-row actions — stays reachable when the fixed columns overflow
 * the viewport. That part works. But nothing reserved screen width for the
 * pinned column: at the acceptance viewport (1280×800) the sticky actions
 * cell rendered ON TOP of the `Updated` column instead of beside it, clipping
 * both the header ("Updat…") and every row's value ("15/07/:"). The owner
 * classified this as a REGRESSION, not an acceptable trade-off, and
 * specified the assertion himself:
 *
 *     updatedCell.right <= actionCell.left
 *
 * plus the analogous assertion for the header cells.
 *
 * ── S18-NOOVERLAP: THE GEOMETRY ASSERTIONS MOVED TO A REAL BROWSER ──
 * The original version of this file asserted the contract above against
 * `getBoundingClientRect()` STUBBED with numbers frozen at the time of
 * writing — jsdom performs no layout, so there was no other way to get a
 * non-zero rect at all. That is a structural flaw, not just a limitation:
 * frozen stubs can never detect whether a real code change fixed anything,
 * because the numbers don't come from the code under test. Going "green"
 * would have required hand-editing the stub constants to match whatever the
 * implementation happened to produce — exactly the "edit the numbers until
 * it passes" shortcut the owner forbade for this regression.
 *
 * The geometry contract now lives in
 * `tests/e2e/ideas-table-overlap-geometry.spec.ts`, a Playwright/Chromium
 * spec that drives the real production-shape harness
 * (`dev-render/screens/idea-table-production.tsx`) and reads live
 * `getBoundingClientRect()` at the owner's full viewport matrix
 * (1280×800, 1440×900, 720×450, 200%-zoom/640×400) at both scroll extremes.
 * It keeps the exact same assertion shape (`updated.right <= actions.left`),
 * the same "column overlap by Npx" failure-message format with real
 * measured numbers, and enforces the kebab-reachability check together with
 * the no-overlap check in the same test — run it with:
 *
 *     npx playwright test --config playwright.ideas-overlap.config.ts
 *
 * This file keeps only what jsdom CAN prove for real: two assertions read
 * from the actual rendered DOM (not stubbed numbers) — (a) the actions
 * cell/header still carry the sticky right-edge classes, and (b) the kebab
 * is reachable by role + accessible name for every row. Both react to
 * actual code changes and are enforced together on purpose: a "fix" that
 * quietly removes the sticky pin (which jsdom cannot see the geometry
 * consequence of either way) fails assertion (a).
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { IdeasTableContent } from '../../../src/components/MyWork/IdeasTableContent';
import type { MyIdea } from '../../../src/components/MyWork/myIdeasTypes';
import type { ColumnWidths, FilterOption, TableFilters } from '../../../src/components/ui/ResizableTable';

// Byte-for-byte match of MyIdeasListContent's DEFAULT_IDEAS_COLUMN_WIDTHS /
// dev-render/screens/idea-table-production.tsx's DEFAULT_COLUMN_WIDTHS.
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

describe('IdeasTableContent — Updated column vs pinned actions column overlap (S17-OVERLAPTEST / S18-NOOVERLAP)', () => {
  describe('kebab reachability (NOT stubbed — reads real rendered DOM)', () => {
    it('every row exposes a reachable "Row actions" kebab by role + accessible name, AND its cell still carries the sticky pin', () => {
      renderTable();

      // aria-label="Row actions" is hardcoded in RowActionsMenu.tsx (not
      // translated) — a stable accessible name regardless of isPolish.
      const kebabs = screen.getAllByRole('button', { name: 'Row actions' });
      expect(kebabs).toHaveLength(IDEAS.length);

      kebabs.forEach((kebab, index) => {
        expect(kebab, `row ${index} kebab should be visible`).toBeVisible();
        expect(kebab, `row ${index} kebab should not be disabled`).not.toBeDisabled();

        // Enforced TOGETHER with reachability on purpose: a "fix" that
        // removes the sticky pin instead of reserving width would restore
        // the Updated column's visible space (no more overlap) but would
        // also let the kebab scroll off-screen again — the exact defect
        // S13-STICKY fixed. This assertion blocks that "fix".
        const cell = kebab.closest('td');
        expect(cell, `row ${index} kebab should live inside a <td>`).not.toBeNull();
        expect(cell!.className, `row ${index} actions cell should stay sticky-pinned`).toMatch(/\bsticky\b/);
        expect(cell!.className, `row ${index} actions cell should stay pinned to the right edge`).toMatch(/\bright-0\b/);
      });
    });

    it('the actions header cell still carries the sticky pin', () => {
      const { container } = renderTable();
      const table = container.querySelector('table')!;
      const headerActionsTh = table.querySelector('thead tr th:last-child')!;
      expect(headerActionsTh.className).toMatch(/\bsticky\b/);
      expect(headerActionsTh.className).toMatch(/\bright-0\b/);
    });
  });
});
