/**
 * @vitest-environment jsdom
 *
 * S17-OVERLAPTEST (2026-08-12) — contract test for the Updated-column /
 * pinned-actions-column OVERLAP defect that S13-STICKY's fix introduced.
 *
 * S13-STICKY pinned the row-actions column (`sticky right-0`,
 * IdeasTableContent.tsx:991 header / :1366 body) so the kebab — the ONLY
 * route to per-row actions — stays reachable when the fixed columns overflow
 * the viewport. That part works. But nothing reserves screen width for the
 * pinned column: at the acceptance viewport (1280×800) the sticky actions
 * cell renders ON TOP of the `Updated` column instead of beside it, clipping
 * both the header ("Updat…") and every row's value ("15/07/:"). The owner
 * has classified this as a REGRESSION, not an acceptable trade-off, and
 * specified the assertion himself:
 *
 *     updatedCell.right <= actionCell.left
 *
 * plus the analogous assertion for the header cells.
 *
 * ── ENVIRONMENT: jsdom + EXPLICITLY STUBBED RECTS — READ BEFORE TRUSTING ──
 * jsdom does not run layout: `getBoundingClientRect()` on a real jsdom
 * render returns all-zero rects, which would make every assertion below
 * vacuously pass/fail regardless of the real defect. This suite instead
 * STUBS `getBoundingClientRect()` on the real, rendered header/body cells
 * with numbers CAPTURED FROM A REAL BROWSER — Playwright/Chromium against
 * the production-shape harness `dev-render/screens/idea-table-production.tsx`
 * (`?screen=idea-table-production`), via the companion script
 * `dev-render/measure-idea-table-overlap.mjs`. Those are not invented
 * numbers; they are the actual measured geometry at the time this test was
 * written (see the script's output for the full viewport matrix).
 *
 * Every scenario asserts the SAME contract regardless of what today's code
 * happens to do: `updated.right <= actions.left` must hold — `true` is the
 * required, unconditional target for every scenario below (matching the
 * owner's literal spec), not "whatever today's broken code currently
 * produces". `knownHoldsToday` on each scenario is documentation only (which
 * cases are already fine vs. already broken); it is never used as the
 * expected value.
 *
 * IMPORTANT — what this DOES and does NOT prove:
 *   - It DOES exercise the exact assertion shape the owner specified, with
 *     one failing case per row (keyed by idea title) plus the header case,
 *     each carrying a human-readable "column overlap" message with the real
 *     measured numbers baked in.
 *   - It DOES keep two assertions genuinely live against the real rendered
 *     DOM (not stubbed): (a) the actions cell/header still carry the sticky
 *     right-edge classes, and (b) the kebab is reachable by role + accessible
 *     name for every row. Both read real `className`/DOM structure, so they
 *     react to actual code changes — a "fix" that quietly removes the sticky
 *     pin (which WOULD kill the overlap, since jsdom can't see that either
 *     way) fails class assertion (a); the two are enforced together
 *     specifically so satisfying one without the other cannot pass.
 *   - It does NOT prove real browser geometry, and — because the overlap
 *     numbers below are frozen stubs, not a live layout computation — this
 *     suite will NOT automatically flip green when the implementing stream
 *     lands the width reservation. Going green (safely) requires either (i)
 *     re-measuring with `dev-render/measure-idea-table-overlap.mjs` against
 *     the fixed code and updating the stub constants below to the new,
 *     non-overlapping numbers, or (ii) promoting the companion script into a
 *     real Playwright test that measures live. Treat this file as pinning
 *     the CONTRACT (the assertion + message shape) and the CURRENT DEFECT
 *     (frozen real evidence), not as an oracle for the eventual fix.
 *
 * ── SABOTAGE STATE = TODAY'S CODE, UNMODIFIED ──
 * The owner's mandated sabotage is "remove the width reservation without
 * unsticking the column." Today's code (`a18b625a78`) has never had a width
 * reservation at all — S13-STICKY added the sticky pin but no reservation —
 * so today's HEAD already IS the sabotage state. This suite is RED against
 * it unmodified; that is the negative control, and it's the real defect
 * rather than a synthetic stand-in.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IdeasTableContent } from '../../../src/components/MyWork/IdeasTableContent';
import type { MyIdea } from '../../../src/components/MyWork/myIdeasTypes';
import type { ColumnWidths, FilterOption, TableFilters } from '../../../src/components/ui/ResizableTable';

// Byte-for-byte match of MyIdeasListContent's DEFAULT_IDEAS_COLUMN_WIDTHS /
// dev-render/screens/idea-table-production.tsx's DEFAULT_COLUMN_WIDTHS —
// the exact widths measured in the real-browser evidence below.
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

/** Stub `getBoundingClientRect()` on a real, rendered DOM node. */
function stubRect(el: Element, rect: { top: number; right: number; bottom: number; left: number }) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    ...rect,
    width: rect.right - rect.left,
    height: rect.bottom - rect.top,
    x: rect.left,
    y: rect.top,
    toJSON: () => rect,
  } as DOMRect);
}

/**
 * Real geometry captured via `node dev-render/measure-idea-table-overlap.mjs
 * http://localhost:<dev-render-port>`, driving
 * `dev-render/screens/idea-table-production.tsx` (byte-for-byte production
 * wrapper shape) with Playwright/Chromium against `a18b625a78` unmodified.
 * Every row shared the same x-position in the real measurement (only y
 * differs per row) — a direct consequence of it being a plain HTML table.
 *
 * 1440×900 is included as a CONTROL: at that width the fixed columns
 * (1354px total) fit inside the viewport with no horizontal overflow, so the
 * sticky column never activates and the relation genuinely holds today —
 * this guards against a future "fix" that breaks the currently-working wide
 * viewport while chasing the narrow one.
 */
const MEASURED_SCENARIOS = [
  {
    label: '1280×800 @100%, scrollLeft=0 (acceptance viewport, at rest)',
    headerDateRight: 1299.0,
    headerActionsLeft: 1216.0,
    bodyDateRight: 1299.0,
    bodyActionsLeft: 1216.0,
    knownHoldsToday: false,
  },
  {
    label: '1280×800 @100%, scrollLeft=max(75) (acceptance viewport, scrolled fully right)',
    headerDateRight: 1224.0,
    headerActionsLeft: 1216.0,
    bodyDateRight: 1224.0,
    bodyActionsLeft: 1216.0,
    knownHoldsToday: false,
  },
  {
    label: '1440×900 @100%, scrollLeft=0 (control — no horizontal overflow, columns fit)',
    headerDateRight: 1371.8,
    headerActionsLeft: 1371.8,
    bodyDateRight: 1371.8,
    bodyActionsLeft: 1371.8,
    knownHoldsToday: true,
  },
  {
    label: '720×450, scrollLeft=max(635) (narrow viewport, scrolled fully right)',
    headerDateRight: 664.0,
    headerActionsLeft: 656.0,
    bodyDateRight: 664.0,
    bodyActionsLeft: 656.0,
    knownHoldsToday: false,
  },
  {
    label: '200% zoom / reflow (emulated 640×400 CSS px), scrollLeft=max(715)',
    headerDateRight: 584.0,
    headerActionsLeft: 576.0,
    bodyDateRight: 584.0,
    bodyActionsLeft: 576.0,
    knownHoldsToday: false,
  },
] as const;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('IdeasTableContent — Updated column vs pinned actions column overlap (S17-OVERLAPTEST)', () => {
  describe.each(MEASURED_SCENARIOS)('$label', (scenario) => {
    it(`header: Updated <th> right edge vs actions <th> left edge (updatedCell.right <= actionCell.left)`, () => {
      const { container } = renderTable();
      const table = container.querySelector('table')!;
      const headerCells = Array.from(table.querySelectorAll('thead tr th'));
      const headerDateTh = headerCells.find((th) => /updated/i.test(th.textContent || ''));
      const headerActionsTh = headerCells[headerCells.length - 1];
      expect(headerDateTh, 'expected an "Updated" header cell to be rendered').toBeTruthy();
      expect(headerActionsTh, 'expected an actions header cell to be rendered').toBeTruthy();

      stubRect(headerDateTh!, { top: 0, bottom: 32, left: scenario.headerDateRight - 128, right: scenario.headerDateRight });
      stubRect(headerActionsTh!, { top: 0, bottom: 32, left: scenario.headerActionsLeft, right: scenario.headerActionsLeft + 56 });

      const updatedRect = headerDateTh!.getBoundingClientRect();
      const actionsRect = headerActionsTh!.getBoundingClientRect();
      const holds = updatedRect.right <= actionsRect.left;
      const overlapPx = Math.round((updatedRect.right - actionsRect.left) * 10) / 10;

      expect(
        holds,
        `[${scenario.label}] header: Updated column overlaps the pinned actions column by ${overlapPx}px ` +
          `(updated.right=${updatedRect.right}, actions.left=${actionsRect.left})`
      ).toBe(true);
    });

    it.each(IDEAS.map((idea, index) => [idea, index] as const))(
      `body row %s (index %i): Updated <td> right edge vs actions <td> left edge`,
      (idea, index) => {
        const { container } = renderTable();
        const table = container.querySelector('table')!;
        const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
        const row = bodyRows[index];
        expect(row, `expected row ${index} ("${idea.title}") to be rendered`).toBeTruthy();

        const cells = Array.from(row.querySelectorAll('td'));
        const dateCell = cells[cells.length - 2];
        const actionsCell = cells[cells.length - 1];
        expect(dateCell, `expected a date/updated cell in row ${index} ("${idea.title}")`).toBeTruthy();
        expect(actionsCell, `expected an actions cell in row ${index} ("${idea.title}")`).toBeTruthy();

        // Real measurement: identical x-position across rows (plain table
        // layout — only the row's y differs), so every row reuses the same
        // captured left/right, offset vertically by row index for realism.
        const rowTop = index * 40;
        stubRect(dateCell!, {
          top: rowTop,
          bottom: rowTop + 36,
          left: scenario.bodyDateRight - 128,
          right: scenario.bodyDateRight,
        });
        stubRect(actionsCell!, {
          top: rowTop,
          bottom: rowTop + 36,
          left: scenario.bodyActionsLeft,
          right: scenario.bodyActionsLeft + 56,
        });

        const updatedRect = dateCell!.getBoundingClientRect();
        const actionsRect = actionsCell!.getBoundingClientRect();
        const holds = updatedRect.right <= actionsRect.left;
        const overlapPx = Math.round((updatedRect.right - actionsRect.left) * 10) / 10;

        expect(
          holds,
          `[${scenario.label}] row ${index} ("${idea.title}"): Updated column overlaps the pinned actions ` +
            `column by ${overlapPx}px (updated.right=${updatedRect.right}, actions.left=${actionsRect.left})`
        ).toBe(true);
      }
    );
  });

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
