# TABLE GRAPHICS ROOT-CAUSE REPORT
**Date:** 2026-06-03 | **Scope:** all list/table views across Consultify

---

## What the screenshots show

Screenshot 1 (`19.00.48`): Radar canvas view — no table visible; baseline.

Screenshot 2 (`19.01.04`): **Ideas table** (My Work → Ideas, table view). Columns are clearly misaligned: the title column content overflows into the right columns; the stage/tags/tool badges appear shifted from their header labels; the right-hand action column is partially off-screen.

---

## Root-cause findings (evidence-based, file:line)

### (A) SYSTEMIC — shared-component or architectural bugs

**RC-1 · Double scroll container — sticky header de-syncs horizontally**

`src/components/shared/TableWithPreviewLayout.tsx:301` wraps all MyWork tables in:
```
flex-1 min-w-0 overflow-auto pr-2 [scrollbar-gutter:stable]
```
Every child table component (Ideas, Tasks, Decisions, Inbox, Notifications) then adds its **own** inner `overflow-x-auto` div (e.g. `IdeasTableContent.tsx:696`). This creates two competing scroll containers. The sticky `thead` (`sticky top-0 z-10`, `IdeasTableContent.tsx:700`) is anchored to the **inner** div's scroll context, not the outer. When the outer `overflow-auto` is the actual vertical scroll container, the sticky header can still float at the wrong offset — or, when preview pane opens and squeezes the flex-1 area, the inner div recalculates its scroll range independently, causing the header row to misalign with body columns.

**RC-2 · Preview-pane width reduction not propagated to inner scroll container**

When preview opens, `TableWithPreviewLayout` animates in a `shrink-0` pane at `clamp(340px, 28%, 480px)` (`TableWithPreviewLayout.tsx:431`). The table's flex-1 area shrinks accordingly. The inner `overflow-x-auto` div in `IdeasTableContent.tsx:696` has `pr-4` right padding. `table-fixed` with a computed `minWidth` (e.g. 1120px) then forces horizontal scroll inside the inner div **at a width that was calculated without subtracting the pane or the padding**. Result: horizontal scroll bar appears mid-session, body columns scroll while header lags or vice versa.

**RC-3 · `w-9` header vs `columnWidths.select=40` body — 4px column mismatch in Ideas table**

`IdeasTableContent.tsx:702`: select column header is `<th className="w-9 px-2 py-3">` (Tailwind `w-9` = 36 px, set via CSS class, **no inline style**).  
`IdeasTableContent.tsx:207`: `DEFAULT_IDEAS_COLUMN_WIDTHS.select = 40` (used in `tableMinWidth` calculation, `IdeasTableContent.tsx:428`).  
`IdeasTableContent.tsx:1168`: body `<td className="relative px-2 py-3 align-middle">` has no width class and no inline style.

With `table-fixed`, column widths are controlled by the header row. The header imposes 36 px; the `tableMinWidth` formula counts 40 px. The sum is 4 px short → the table is slightly too wide → overflow triggers → horizontal scroll de-syncs header from body.

**RC-4 · `overflow-hidden` parent breaks sticky thead in Portfolio, Results, and Assessment tables**

`PortfolioListView.tsx:245–248`:
```html
<div class="... overflow-hidden">      <!-- kills sticky! -->
  <div class="overflow-x-auto">
    <table class="w-full table-fixed" ...>
      <thead class="sticky top-0 z-10 ...">
```
Same pattern in `ResultsInitiativesView.tsx:492–508` and `InitiativeGatesWorkflowTable.tsx:749`.  
`overflow-hidden` on the grandparent clips the stacking context. `sticky top-0` inside `overflow-x-auto` inside `overflow-hidden` has **no valid scroll ancestor** for vertical stickiness — the header scrolls away with content on tall tables.

**RC-5 · Fragmentation: 230+ files render raw `<table>` elements — no canonical primitive**

The design system has **two** canonical table components: `DataTable` (`src/components/ui/composed/DataTable.tsx`) and `ResizableTable` (`src/components/ui/ResizableTable/index.tsx`). Neither is used by the majority of modules. Every module implements its own `<table>` with hand-rolled column widths, inline styles, and sticky headers, creating 6+ incompatible alignment strategies. Cross-module inconsistency is the multiplier for all the bugs above.

---

### (B) PER-MODULE — isolated bugs

**RC-6 · `InterviewHub` has 5 independent tables; one with `sticky top-0` inside `overflow-hidden` parent**

`InterviewHub.tsx:7039`: the `renderInitiativesTableTab` function puts `sticky top-0 z-10` on the thead inside:
```html
<div class="overflow-hidden rounded-xl border ...">   <!-- kills sticky -->
  <div class="h-full overflow-auto p-4">              <!-- this is the scroll root -->
    <table class="w-full table-fixed" ...>
```
The `overflow-auto` is the **child**, not the parent — sticky is relative to the wrong ancestor.

**RC-7 · `NotificationsContent` hardcoded `colSpan={7}` (correct today but fragile)**

`NotificationsContent.tsx:1256`: `<td colSpan={7}>` for the group-header row. There are exactly 7 `<th>` elements and none are conditionally hidden today, so it doesn't break yet. However, if any column becomes toggleable, the colSpan will be wrong and produce a visual gap or compression. Compare: `EnhancedDataTable.tsx:580` computes colSpan dynamically as `displayColumns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)` — the correct pattern.

**RC-8 · Hardcoded `max-w-[760px]` on title description text — overflows narrow columns**

`IdeasTableContent.tsx:1225`: the row's subtitle line uses `max-w-[760px] truncate pr-6`. When `columnWidths.title` is resized below 760 px (e.g. when preview pane is open), the text refuses to truncate at the actual column boundary and visually overflows into adjacent cells.  
Same pattern: `MyTasksListContent.tsx:587`.

---

## Summary table

| # | Severity | Type | Files | Effect |
|---|----------|------|-------|--------|
| RC-1 | P0 | Systemic | `TableWithPreviewLayout.tsx:301`, all 5 MyWork tables | Header/body de-sync on horizontal scroll |
| RC-2 | P0 | Systemic | `IdeasTableContent.tsx:696`, `MyTasksListContent.tsx` (same pattern) | Phantom horizontal scroll when preview opens |
| RC-3 | P1 | Systemic | `IdeasTableContent.tsx:702,207,428` | 4 px column drift in Ideas table |
| RC-4 | P1 | Per-module | `PortfolioListView.tsx:245`, `ResultsInitiativesView.tsx:492`, `InitiativeGatesWorkflowTable.tsx:749` | Sticky header scrolls off screen |
| RC-5 | P1 | Systemic | 230 files | Inconsistency multiplier, no single source of truth |
| RC-6 | P1 | Per-module | `InterviewHub.tsx:7039` | Sticky broken in initiative sub-table |
| RC-7 | P2 | Per-module | `NotificationsContent.tsx:1256` | Fragile colSpan, will break on column toggle |
| RC-8 | P2 | Per-module | `IdeasTableContent.tsx:1225`, `MyTasksListContent.tsx:587` | Text overflows beyond column boundary |

---

## Prioritized fix plan

### Phase 1 — Stop the bleeding (RC-1, RC-2, RC-3): 1–2 days

1. **Remove the inner `overflow-x-auto` wrapper in `IdeasTableContent` and `MyTasksListContent`** — rely solely on the `overflow-auto` in `TableWithPreviewLayout`. The table should be a direct child of the `flex-1 min-w-0 overflow-auto` div. Delete the `h-full overflow-x-auto bg-slate-50/40 pr-4` wrapper (`IdeasTableContent.tsx:696`).

2. **Fix the select column width mismatch** in `IdeasTableContent`: change `<th className="w-9 px-2 py-3">` (line 702) to `<th style={{ width: columnWidths.select }} className="px-2 py-3">` — matching how Tasks and Decisions already do it.

3. **Add the `columnWidths.select` inline style to the body `<td>`** at `IdeasTableContent.tsx:1168` for completeness: `style={{ width: columnWidths.select }}`.

### Phase 2 — Fix per-module sticky bugs (RC-4, RC-6): 1 day

4. **Remove `overflow-hidden` from wrapper divs** around `overflow-x-auto` in `PortfolioListView.tsx:245`, `ResultsInitiativesView.tsx:492`, and `InitiativeGatesWorkflowTable.tsx:749`. Use `rounded-xl overflow-x-auto` directly on the scroll container instead of wrapping both in an extra `overflow-hidden` div.

5. **Fix `InterviewHub.tsx:7039`**: move the `overflow-hidden rounded-xl` to a wrapper that does not create a scroll context, or restructure so `overflow-auto` is the outermost boundary.

### Phase 3 — Canonicalize (RC-5, RC-7, RC-8): 3–5 days

6. **Declare `ResizableTable` + `TableWithPreviewLayout` as the canonical pair** for all MyWork-style module tables (Tasks, Ideas, Decisions, Inbox, Notifications, Interview). Migrate any remaining bespoke `<table>` implementations in these modules.

7. **Use `FilterableTable` (`src/components/shared/ModuleHub/FilterableTable.tsx`)** as canonical for read-only/filterable module hub lists (Results, Portfolio, Admin). It already uses dynamic colSpan and ColumnResizer correctly.

8. **Fix `max-w-[760px]` hardcodes**: replace with `style={{ maxWidth: columnWidths.title }}` so truncation tracks the live column width.

9. **Audit all hardcoded `colSpan` integers** across the codebase; replace with computed values following the `EnhancedDataTable` pattern.
