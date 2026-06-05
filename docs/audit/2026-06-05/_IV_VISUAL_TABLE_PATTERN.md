# Interview Module — Visual + Table-Consistency Audit & Canonical Table Spec

**Date:** 2026-06-05
**Branch:** `feat/wave1-foundations`
**Scope:** Every table / list / card surface across the 6 Interview nav tabs.
**Goal:** Establish ONE canonical table component pattern for the Interview module and a ranked migration plan to adopt it.
**Method:** Read / Grep / Glob only. No code modified.

Primary file: `src/components/Interview/InterviewHub.tsx` (8,903 lines).
The 6 tabs: **Inbox** (`my_assignments`), **Sessions** (`sessions`), **Assigned** (`managed`), **Templates** (`templates`), **Insights** (`insights`), **Initiatives** (`initiatives`).

---

## 0. TL;DR (the verdict)

There is **no canonical Interview table**. Instead there are **5 hand-written `<table>` builders** in InterviewHub, each ~150–450 lines, that re-implement the same machinery (select column, resizable headers, hide-columns, view-settings popover, status pill, progress bar, row-action menu, empty state). They are wrapped — inconsistently — by the genuinely-shared `TableWithPreviewLayout` (preview pane + J/K nav).

- **Shared infra that IS used:** `TableWithPreviewLayout` (5 of 6 tabs), `ColumnResizer` (4 tables), `FilterDropdown` (Insights only), `RowActionsMenu` (all), module-level CSS-class constants (`INTERVIEW_STATUS_CHIP_BASE_CLASS` etc.), `GridView` (assignment cards).
- **Shared infra that is NOT used:** `ResizableTable` (the actual table component — imported only for its *types* and `ColumnResizer`), `DataTable` (`ui/composed`), `FilterableTable` (`shared/ModuleHub`). The module rejects all three full-table components and rolls its own `<table>` 5×.
- **4 different status-pill systems** coexist (`getSessionStatusConfig`, `getAssignmentStatusColor`+`getAssignmentStatusLabel`, an inline insight `statusConfig`, and `getStatusStyle` from the SSOT). Only 2 of them (Insights, Initiatives) use the canonical palette in `src/constants/statusColors.ts`.
- **Column widths are NOT persisted** (plain `useState` with hardcoded defaults). Only hidden-columns + row-description booleans persist to `localStorage`.
- **Initiatives** is the outlier: raw `<table>`, **no** preview pane, **no** view toggle, **no** J/K nav.
- **Design-token hygiene is actually good:** 0 hardcoded hex in InterviewHub; all 74 `style={{}}` are legitimate dynamic `width`/`minWidth` for resizable columns. The real token issue is **palette divergence** (3 tables hardcode `bg-blue-50 text-blue-900`-style strings that don't match the SSOT tiers) and a **crimson- vs primary- mix**.

---

## 1. INVENTORY — per tab

| Tab (key) | Table builder | Wrapper | Columns (visible order) | View-settings popover? | Resizable cols? | Card/alt mode? | Empty state | Loading | Error |
|---|---|---|---|---|---|---|---|---|---|
| **Inbox** (`my_assignments`) | `renderAssignmentsTable(rows, false)` — bespoke `<table>` @5608 | `TableWithPreviewLayout` @7694 | select, template, status, progress, due, actions | ✅ (shared with Managed) @6031 | ✅ `ColumnResizer` @5684 | ✅ cards → `GridView` @7835 (keeps preview) | plain Inbox icon + "No assignments" @6455 | `LoadingState` spinner @6485 | shared amber error card @6488 |
| **Sessions** (`sessions`) | `renderSessionsTable` — bespoke `<table>` @2961 | `TableWithPreviewLayout` @6550 | select, name, status, progress, date, actions | ✅ @3112 | ✅ `ColumnResizer` @3031 | ✅ grid → `renderSessionsGrid` @3442 (**no preview**) | rich Teresa CTA card @3392 | same | same |
| **Assigned** (`managed`) | `renderAssignmentsTable(rows, true)` — same builder, `showAssignee=true` @5608 | `TableWithPreviewLayout` @7907 | select, template, **assignee**, status, progress, due, actions | ✅ @6031 | ✅ @5684 | ✅ cards → `GridView` @7960ish (keeps preview) | plain Inbox icon @6455 | same | same |
| **Templates** (`templates`) | `renderTemplatesTable` — bespoke `<table>` @4409 | `TableWithPreviewLayout` @7566 (table mode only) | select, name, category, questions, status, actions | ✅ @4600ish | ✅ `ColumnResizer` @4477 | ✅ cards → `renderTemplatesCards` @4953 (**no preview** — separate branch @7553) | FileText icon + "New template" CTA @4926 | same | same |
| **Insights** (`insights`) | `renderInsightsTable` — bespoke `<table>` @3773 | `TableWithPreviewLayout` @6733 | select, title, type, status, source, date, actions | ✅ @4020ish | ✅ `ColumnResizer` @3844 + **`FilterDropdown`** on type/status @3931/3962 | ✅ flat / report (grouped) @6864 — **fully built**, reuses same table per group | Lightbulb + "Generate AI Insights" CTA @4373 | same | same |
| **Initiatives** (`initiatives`) | inline `<table>` directly in branch @7036 | **none** (raw `overflow-auto p-4` div @7033) | select, title, status, priority, source, date, actions | ✅ @7140ish | ✅ `ColumnResizer` @7015 | ❌ none (no view toggle) | Rocket icon + dual CTA @7426 | same | same |

**Row count:** 5 distinct `<table>` literals (@3049, @3884, @4495, @5938, @7036). `renderAssignmentsTable` is reused for 2 tabs (Inbox/Managed), so 5 builders cover 6 tabs.

**Component-usage summary**
- `ResizableTable` (the component): **not used anywhere** in Interview. Only its *types* (`ColumnDef`, `ColumnWidths`, `TableFilters`), `ColumnResizer`, and `FilterDropdown` are imported (InterviewHub @80–86).
- `DataTable` (`ui/composed/DataTable.tsx`): **not used anywhere in the repo** (0 importers) — dead/orphan candidate.
- `FilterableTable` (`shared/ModuleHub`): used by ~20 other hubs, **not by Interview**.
- `TableWithPreviewLayout`: used 5× in Interview (Sessions, Insights, Templates, Inbox, Managed). **Not** used by Initiatives.

---

## 2. INCONSISTENCIES (file:line)

### 2.1 Wrapper / interaction model diverges
- **Initiatives has no preview pane and no keyboard nav.** Every other tab wraps its table in `TableWithPreviewLayout` (single-click→preview, J/K, Enter→open, Esc→close, Alt+←/→ history, Pin-for-comparison). Initiatives is a bare scroll container: `InterviewHub.tsx:7033` `<div className="h-full overflow-auto p-4">` → raw `<table>` @7036. Result: no preview, no J/K, no pin, inconsistent selection affordance.
- **Cards/grid alt-modes are incoherent about preview:**
  - Assignments cards: `GridView` rendered **inside** `TableWithPreviewLayout` → preview still works @7833–7849.
  - Sessions grid: `renderSessionsGrid()` rendered in a **bare** `<div>` outside the preview wrapper @6661–6662 → selecting a card gives **no preview**.
  - Templates cards: separate early-return branch with **no** `TableWithPreviewLayout` @7553–7561 → `setSelectedTemplateId` fires but **no preview renders**.
  - So 3 tabs with an alt view → 3 different preview behaviors.

### 2.2 Column-header styling diverges
- Header text color: Sessions/Templates/Initiatives use `text-slate-600 dark:text-slate-400` (`InterviewHub.tsx:3075`, `:4498`-ish, `:7039`-ish); Assignments and Insights use `text-slate-500 dark:text-slate-400` (`:5964`, `:3886`). Two different greys for the same header role.
- Header background: most use `bg-slate-50/70 dark:bg-navy-900/40`; Initiatives uses `bg-white/60 dark:bg-navy-900/60` and is `sticky top-0 z-10` (`:7038`). Sessions/Insights/Templates headers are **not** sticky (Templates header alone has `sticky top-0 z-10` @4497). Inconsistent sticky behavior.
- **Sortable headers exist only in Assignments.** Status/Progress/Due headers are click-to-sort with a `ChevronDown` indicator (`:5979`–`:6025`, `toggleAssignmentSort`). Sessions, Insights, Templates, Initiatives headers are **not** sortable at all. Insights instead exposes column **filters** (FilterDropdown) — a different mechanism again.

### 2.3 Status-pill rendering: 4 separate systems
1. **Sessions** → `getSessionStatusConfig(status)` returns `{label:{en,pl}, bgColor, textColor, dotColor}`. Pill = `INTERVIEW_STATUS_CHIP_BASE_CLASS + statusConfig.bgColor`, dot `w-2 h-2` colored by `dotColor`, text colored by `textColor` (`InterviewHub.tsx:3280`–3289). Definition @2895.
   - Latent redundancy: `bgColor` already contains border+bg+**text** classes, yet a separate `textColor` is also applied — two text colors fight; the later wins.
2. **Assignments** (Inbox+Managed) → `getAssignmentStatusColor(status)` (string only) + `getAssignmentStatusLabel(status)`. Pill = `INTERVIEW_STATUS_CHIP_BASE_CLASS + getAssignmentStatusColor(...)`, dot is `w-1.5 h-1.5 bg-current` (inherits text color) (`:6281`–6288). Defs @5316 / @5339.
3. **Insights** → inline `statusConfig` map (6 states) → `getStatusStyle(statusKey)` (SSOT) → pill = `inline-flex ... px-2.5 py-1 rounded-full text-xs font-semibold ${sc.bg} ${sc.text}` with a separate `h-1.5 w-1.5` dot (`:4262`–4267). **Does not** use `INTERVIEW_STATUS_CHIP_BASE_CLASS`. Plus a left **accent bar** `h-8 w-1.5` in the title cell @4202 — unique to Insights.
4. **Initiatives** → `statusMeta()` → `getStatusStyle(status)` (SSOT) returning `{label, cls, accentClass, dotClass}`; pill uses `cls` = `border border-current/20 ${bg} ${text}`, plus a per-status row **`shadow-[inset_4px_0_0_...]` accent** (`:6912`–6944). A 4th pill shape.

Same five semantic states (assigned/in-progress/submitted/approved/sent-back) get **4 different class strings, 2 different dot sizes (w-2 vs w-1.5), 2 dot-color strategies (explicit vs `bg-current`), and 2 palettes** (hardcoded blue-900 vs SSOT blue-600).

### 2.4 Status palette doesn't match the SSOT
`src/constants/statusColors.ts` is the declared "Canonical color palette for all badges" (5-color semantic system, 3 tiers). But:
- Sessions (`getSessionStatusConfig` @2895) and Assignments (`getAssignmentStatusColor` @5316) **hardcode** `border-blue-300/80 bg-blue-50 text-blue-900 dark:...` strings — these do **not** equal `getStatusStyle('IN_PROGRESS')` (which returns `bg-blue-50/70 text-blue-600`). Visibly different blues/greens for the same status across tabs.
- Templates status (@4804) hardcodes `border-blue-300/80 bg-blue-50 text-blue-900` for "Default" and emerald for "Active" — again off-SSOT.
- Only Insights and Initiatives route through the SSOT.

### 2.5 Progress bar — shared classes, but one tab re-implements labels
- Track/fill use shared constants `INTERVIEW_PROGRESS_TRACK_CLASS` / `INTERVIEW_PROGRESS_FILL_CLASS` in Sessions (@3299), Assignments (@6297) — good.
- But the **Sessions grid** re-implements the progress block inline (`:3520`-ish) and the status pill inline with a hand-written label `switch` instead of `statusConfig.label` (`:3531`–3545). So the grid and the table of the *same* tab render status differently.
- Initiatives table has **no progress column at all** (status/priority/source/date) — the only data table without progress, despite initiatives having lifecycle %.

### 2.6 Overdue / due chip exists in only 2 tabs, defined twice
- The "days to due" / overdue chip (`98d overdue`, ⚠ triangle, crimson fill) is **Assignments-only**. Helper `getAssignmentDaysToDue` @5359 (module-level) feeds the chip @6314–6336 using `INTERVIEW_DUE_CHIP_BASE_CLASS + dtd.colorClass` with icon logic (`AlertTriangle` for ≤0, `Clock` for ≤3, `Calendar` for >3).
- **A second, near-identical `getDaysToDue` is defined locally inside `renderAssignmentsTable`** @5739 — duplicate of the module-level one, with the same color strings. Dead/duplicated logic.
- **Sessions** have a `dueAt` but render only a plain `Calendar` + `toLocaleDateString()` (@3318) with **no overdue treatment**. Same business concept, no visual parity.

### 2.7 Assignee cell — bespoke, only in Assignments
- Assignee avatar is an inline `w-6 h-6 rounded-full bg-slate-200` with `name.charAt(0) || '?'` (`:6262`–6272) — the "?" avatar from the screenshot. No shared `Avatar` component; Sessions instead show assignee only as row sub-text (`:3266`) when "row description" is enabled. No consistent assignee-cell component.

### 2.8 Empty states — 5 different designs
- Sessions: full Teresa-branded CTA card, 2 buttons (@3392).
- Insights: Lightbulb + paragraph + "Generate AI Insights" (@4373).
- Templates: FileText + "New template" (@4926).
- Initiatives: Rocket + conditional dual-CTA, distinguishes "no data" vs "no data for filter" (@7426) — the most sophisticated.
- Assignments: bare `Inbox` icon + "No assignments", **no CTA** (@6455).
Five icon/copy/CTA combinations, no shared `EmptyState`. (Note: a shared `EmptyState` exists in `ui/composed` and `EmptyStateInline` is even imported @77 but unused for tables.)

### 2.9 Row density / padding diverges
- Cell padding: Sessions name cell `px-3 py-3` (@3255); Assignments template cell `px-4 py-3` (@6223); other Assignment cells `px-4 py-3` vs Sessions `px-3 py-3`. Mixed `px-3`/`px-4` within and across tables.
- Selected-row treatment: Sessions/Assignments use `INTERVIEW_TABLE_SELECTED_ROW_CLASS` (inset crimson bar + ring) (@537); Insights uses a **different** selected treatment (`shadow-[inset_4px_0_0_theme(colors.primary.500)]` + `bg-primary-50` + ring assembled inline @4149–4174); Initiatives uses per-status inset accent that **competes** with selection. Three selected-row visual languages.

### 2.10 View-settings popover — copy-pasted 4–5×
Each builder re-implements the same popover (`Settings2` button → absolute panel → "Visible columns" checkboxes → divider → "Show row description"): Sessions @3112, Insights @4020-ish, Templates @4600-ish, Assignments @6031, Initiatives @7140-ish. ~70 lines each, identical structure, different `*HiddenColumns` state + storage key. Not a shared component.

---

## 3. STATUS PILLS / PROGRESS / CHIPS — where each is defined

| Primitive | Shared? | Definitions / call-sites |
|---|---|---|
| Pill base class | Partial constant | `INTERVIEW_STATUS_CHIP_BASE_CLASS` @544 — used by Sessions, Assignments, Templates; **not** by Insights/Initiatives/Sessions-grid |
| Session status | Bespoke | `getSessionStatusConfig` @2895; rendered @3280 (table), @3531 (grid, re-implemented) |
| Assignment status | Bespoke | `getAssignmentStatusColor` @5316 + `getAssignmentStatusLabel` @5339; rendered @6281; reused in previews @7715/@7928 |
| Insight status | Inline + SSOT | inline `statusConfig` @4108 → `getStatusStyle` @4138; rendered @4262; preview variant @4108 area & @6773 |
| Initiative status | SSOT | `statusMeta()` @6912 → `getStatusStyle`; rendered @7300-ish |
| Insight type chip | Bespoke | `getInsightTypeConfig` (→ `typeConfig.bgColor/textColor`) rendered @4250 |
| Progress bar | Shared constants | `INTERVIEW_PROGRESS_TRACK_CLASS`/`_FILL_CLASS` @548/550; used @3299 (sessions), @6297 (assignments); re-implemented inline @3520 (sessions grid) |
| Overdue/due chip | Bespoke ×2 | `INTERVIEW_DUE_CHIP_BASE_CLASS` @546; `getAssignmentDaysToDue` @5359 **and** duplicate `getDaysToDue` @5739; rendered @6314 |
| Meta chip | Constant | `INTERVIEW_META_CHIP_CLASS` @542 |
| Category/source chip | Mixed | inline @6236 (assignments category) vs `getTypeStyle('source')` @4139/@7224 (insights/initiatives) |
| Canonical SSOT | Available | `getStatusStyle`/`getPriorityStyle`/`getTypeStyle` from `src/constants/statusColors.ts` — used by only 2 of 6 tabs |

**Net:** the same 5 semantic statuses are encoded 4× with diverging colors; the overdue helper is duplicated; the progress block is duplicated table-vs-grid.

---

## 4. VIEW-SETTINGS + RESIZE + HIDE-COLUMNS mechanics

**Is it shared?** No. It is **copy-pasted per builder** (5 instances), each with:
- its own `*HiddenColumns` state + `loadHiddenColumns(KEY, defaults, alwaysVisible)` initializer,
- its own `*ColumnWidths` state (`useState<ColumnWidths>({...hardcoded...})`),
- its own `handle*ColumnResize` (an identical neighbor-pair clamp algorithm, ~20 lines, repeated 5×: Sessions @3008, Insights @3821, Templates @4454, Assignments @5661, Initiatives @6991),
- its own `render*Resizer` wrapper around the shared `ColumnResizer`,
- its own view-settings popover markup.

**Persistence (localStorage):**
- ✅ Hidden columns persist — `saveHiddenColumns(KEY, ...)` @301, called from each popover (Sessions @3156, Insights @4045, Templates @4628, Initiatives @7170; Assignments writes `localStorage.setItem(assignmentsViewStorageKey,...)` directly @6112).
- ✅ "Show row description" boolean persists — `saveBooleanSetting` @321.
- ❌ **Column widths do NOT persist.** All `*ColumnWidths` are plain `useState` seeded from hardcoded default-width constants (`INTERVIEW_*_TABLE_DEFAULT_WIDTHS` @164–244). No `saveColumnWidths` exists. **Resizing a column is lost on reload** — a real UX regression and a consistency gap (hide persists, resize doesn't).

**Storage keys (per tab, separate):** Inbox @140, Managed @143, Sessions @147, Insights @150, Templates @153, Initiatives @156. Inbox and Managed each have their own key (assignee column differs), which is reasonable; the rest are 1:1.

**Consistency across tabs that have it:** structurally identical but textually duplicated. The `alwaysVisible` set differs (`['name','actions']` for sessions/templates; `['title','actions']` for insights/initiatives; template/actions for assignments). The resize clamp algorithm is byte-for-byte the same 5×.

---

## 5. CARDS vs TABLE (Templates) and FLAT vs REPORT (Insights)

### Templates: `cards` vs `table` — **half-built**
- `table`: full bespoke table inside `TableWithPreviewLayout` (preview works).
- `cards`: `renderTemplatesCards` rendered in a **separate early-return** with **no preview wrapper** (@7553). Card click sets `selectedTemplateId` but nothing shows it → dead selection in cards mode. View toggle in `rightControls` @8276.
- Verdict: functional but the two modes don't share the preview/selection contract → incoherent.

### Insights: `flat` vs `report` — **coherent / fully built**
- Both modes render the **same** `renderInsightsTable` inside the **same** `TableWithPreviewLayout`; `report` just groups rows by source-session count + "General" with a group header (@6864–6895). Grouping/sorting logic @6684–6709. Preview, selection, J/K all work in both modes.
- Verdict: the **only** alt-mode done right — this is the model the others should follow.

### Sessions: `table` vs `grid`
- `grid` (`renderSessionsGrid` @3442) renders **outside** the preview wrapper → no preview, and re-implements status/progress inline. Half-built like Templates cards.

### Assignments: `list` vs `cards`
- `cards` uses shared `GridView` **inside** the preview wrapper → preview preserved. Closest to coherent, but uses a *different* card component (`GridView`) than Sessions/Templates (which use bespoke cards).

**Summary:** 4 tabs have alt modes; only Insights' is fully coherent. Card components themselves are inconsistent (GridView vs bespoke session cards vs bespoke template cards).

---

## 6. DESIGN TOKENS

**Inline `style={{}}` (repo bans these outside `ui/`):**
- Interview dir total: **86**. Breakdown — InterviewHub 74, InterviewSingleQuestionRuntime 4, InterviewWorkspace 2, others 1 each.
- In InterviewHub the 74 break down as: **69 `width`** + **5 `minWidth`** — all dynamic table-column sizing (`style={{ width: columnWidths.x }}`, `style={{ minWidth: tableMinWidth }}`). This is the **unavoidable** exception for resizable tables (the shared `ResizableTable`/`TableHeader` do exactly the same, e.g. `ResizableTable/TableHeader.tsx:90`). **Not true violations**, but they are a symptom: every bespoke table re-introduces inline width styles instead of inheriting them from one shared table component.

**Hardcoded hex:**
- InterviewHub: **0**.
- Interview dir: **3**, all outside the table surfaces — `InterviewWorkspace.tsx:2334` (`#0a0f1e`), `TemplateBuilder.tsx:1598` (`#151E32`), `TemplateBuilder.tsx:2501` (`#0F172A`/`#151E32`). These are navy shades that should be `navy-*` tokens but are not table-related.

**Palette violations (the real token problem):**
- **Off-SSOT status colors** in 3 builders: `getSessionStatusConfig` (@2895), `getAssignmentStatusColor` (@5316), Templates status (@4804) hardcode `border-X-300/80 bg-X-50 text-X-900` strings that diverge from `getStatusStyle()` (SSOT `bg-X-50/70 text-X-600`). Count: **~30 hardcoded status-color class strings** across these 3 helpers that should resolve to the 5-color SSOT.
- **crimson- vs primary- mix:** InterviewHub uses `primary-*` on 74 lines (buttons, rings, selected rows, pills) but `crimson-*` on 9 lines (error refresh button @6503, empty-state CTAs @3415/@7454, Teresa mark area @3396). The dark-navy/crimson theme is applied via `crimson-*` in some CTAs and `primary-*` elsewhere — two token families for the same accent. Pick one (the platform accent token) and alias.

**Verdict:** token *hygiene* (no hex, no rogue inline color styles) is good. Token *consistency* (palette source of truth + accent family) is the gap.

---

## 7. CANONICAL TABLE SPEC — proposal for approval

### 7.1 THE component
**Adopt `TableWithPreviewLayout` as the outer shell for all 6 tabs (incl. Initiatives), and introduce ONE new shared inner table — `InterviewDataTable` — to replace the 5 bespoke `<table>` builders.**

Why not the existing options as-is:
- `ResizableTable` (`ui/ReusableTable/index.tsx`): closest fit (resizable headers, hide via column list, select column, filter dropdowns) — but it has **no** view-settings popover, **no** localStorage persistence, **no** sort, and the Interview module already imports its types/`ColumnResizer`. Use it as the **foundation**, extend it.
- `DataTable` (`ui/composed`): nice sort + pagination + skeleton + EmptyState, but **no** resize/hide/preview and **0 repo usage** → would be a regression for this module. Reject (and flag for deletion).
- `FilterableTable` (`shared/ModuleHub`): used widely elsewhere but doesn't carry the preview-pane + per-tab view-settings the Interview module needs; adopting it would fork from the rest of Interview's preview UX. Reject for now.

**Decision:** `InterviewDataTable = thin column-driven wrapper built on ResizableTable primitives (`TableHeader`+`ColumnResizer`+`FilterDropdown`), rendered as `children` of `TableWithPreviewLayout`.** This keeps the preview/J-K layer (already shared, already loved) and collapses the 5 hand-written tables into one config-driven renderer.

### 7.2 Canonical column model
A single `InterviewColumn<T>` type (extends the existing `ColumnDef`):
```
{ id, label, width, minWidth, maxWidth, resizable, hideable,
  alwaysVisible?, sortable?, filter?: {type, options},
  align?, render: (row)=>ReactNode, headerRender? }
```
- **Header style (canonical):** `px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400`; first-data column left, metric columns center, actions right; header bg `bg-slate-50/70 dark:bg-navy-900/40`; `sticky top-0 z-10` ON for every table. (Resolves §2.2.)
- **Sort:** opt-in per column via `sortable`, single shared `ChevronDown` indicator + `toggleSort(field)` in the wrapper. Sessions/Insights/Initiatives gain sort for free. (Resolves §2.2 sort gap.)
- **Resize:** one shared `useColumnResize(storageKey, defaults, bounds)` hook owning the neighbor-pair clamp (delete the 5 duplicate `handle*ColumnResize`). **Persist widths to localStorage** (new `saveColumnWidths`). (Resolves §4 persistence gap.)
- **Hide:** driven by `hideable` + a shared hidden-columns set persisted per `storageKey` (already exists — keep `loadHiddenColumns`/`saveHiddenColumns`).
- **Density:** standardize cell padding to `px-3 py-3` everywhere (drop the `px-4` variants). One row height. (Resolves §2.9.)
- **Select column:** the existing checkbox button markup → extract to `<RowSelectCheckbox>` (it's already byte-identical 5×).

### 7.3 Canonical status / progress / chip components
Create `src/components/Interview/ui/` (or `shared/status/`) with:
- **`<StatusPill status tone />`** — single component. Resolve color **only** through `getStatusStyle()` (the SSOT in `constants/statusColors.ts`). Fixed geometry: `INTERVIEW_STATUS_CHIP_BASE_CLASS` + `h-1.5 w-1.5` dot. Delete `getSessionStatusConfig`, `getAssignmentStatusColor`/`Label`, the inline insight `statusConfig`, and `statusMeta` — replace with a single `interviewStatusMeta(domain, status) → {labelKey, statusKey}` map feeding `getStatusStyle(statusKey)`. (Resolves §2.3, §2.4.)
- **`<ProgressCell value />`** — wraps `INTERVIEW_PROGRESS_TRACK/FILL` + `%` label. Used by table AND grid (kill the inline grid copy @3520). (Resolves §2.5.)
- **`<DueChip dueAt />`** — wraps `INTERVIEW_DUE_CHIP_BASE_CLASS` + the icon/threshold logic. Delete the duplicate `getDaysToDue` @5739; keep one `getAssignmentDaysToDue`. **Add it to Sessions** (currently bare date) for parity. (Resolves §2.6.)
- **`<AssigneeCell user />`** — shared avatar (initial / "?" fallback) + name truncation. (Resolves §2.7.)
- **`<TypeChip>` / `<SourceChip>`** — route through `getTypeStyle()`.

### 7.4 Canonical empty / loading / error
- **Loading:** keep `LoadingState variant="spinner"` (already shared, already consistent).
- **Error:** keep the shared amber error card (@6488) — already consistent; extract to `<InterviewLoadError onRetry />`.
- **Empty:** one `<InterviewEmptyState icon title description primaryCta secondaryCta filtered? />` supporting the "no data" vs "no data for this filter" split (steal Initiatives' two-state logic @7426). Every tab supplies icon+copy+CTA. (Resolves §2.8.) Reuse `ui/composed/EmptyState` underneath if it fits.

### 7.5 Canonical row-action menu
`RowActionsMenu` is already shared and used by all 5 builders — **keep**. Standardize: always `iconVariant="vertical"`, always `className="opacity-40 ... group-hover:opacity-100"` (Templates omits the hover-fade @4827 — align it).

### 7.6 Canonical view-settings panel
One `<TableViewSettings columns hidden onToggle rowDescription onToggleRowDescription storageKey />` rendered from the actions header. Replaces the 5 copy-pasted popovers. Persists hidden + rowDescription + (new) widths under `storageKey`.

### 7.7 Canonical alt-view contract
Every alt mode (cards/grid/report) MUST render **inside** the same `TableWithPreviewLayout` so selection→preview and J/K survive (Insights `report` is the reference @6864). Standardize on **one** card component (`GridView`) for Sessions + Templates + Assignments cards; delete bespoke `renderSessionsGrid` cards and `renderTemplatesCards` card markup in favor of `GridView` items. (Resolves §2.1, §5.)

---

## 8. MIGRATION PLAN — ranked by effort (lowest → highest)

> Strategy: ship the shared primitives first (mechanical, low-risk), then collapse the tables, hardest tab last.

**Phase 0 — Extract shared primitives (no behavior change).** Effort: **S**.
- `StatusPill`, `ProgressCell`, `DueChip`, `AssigneeCell`, `RowSelectCheckbox`, `TableViewSettings`, `useColumnResize` (with width persistence), `InterviewEmptyState`, `InterviewLoadError`.
- Route all status colors through `getStatusStyle()`; delete the 4 bespoke status helpers.
- Net: ~600 lines deleted, palette unified, widths now persist. Pure refactor, visually near-identical.

**Phase 1 — Initiatives → `TableWithPreviewLayout`.** Effort: **S–M**. Highest UX payoff per line.
- Wrap the existing initiatives `<table>` in `TableWithPreviewLayout` (gains preview, J/K, pin). Add a preview body (`InterviewInitiativePreview` — partner of the 4 existing previews). Add the list/grid view toggle for parity. Add a progress column.

**Phase 2 — Sessions grid + Templates cards → coherent preview.** Effort: **M**.
- Move `renderSessionsGrid` and `renderTemplatesCards` **inside** their `TableWithPreviewLayout`; swap bespoke cards for `GridView`. Kill the inline status/progress copies in the session grid (use the Phase-0 components).

**Phase 3 — Collapse Sessions + Templates + Insights tables → `InterviewDataTable`.** Effort: **M–L** each.
- Express each as a `columns: InterviewColumn<T>[]` config + `render` cells using Phase-0 components. Sort comes free. Insights keeps its `FilterDropdown` columns (the column model already supports `filter`). Report mode keeps grouping by rendering the same `InterviewDataTable` per group (already the pattern).

**Phase 4 — Collapse Assignments (Inbox + Managed) → `InterviewDataTable`.** Effort: **L**. Do last — most logic-dense (sort, days-to-due, start/continue/fix/approve/send-back actions, assignee column toggle, two storage keys).
- The `showAssignee` switch becomes a column-config flag. Cards already use `GridView` → minimal change.

**Phase 5 — Cleanup.** Effort: **S**.
- Delete `ui/composed/DataTable.tsx` (0 importers) or document it as non-canonical. Migrate the 3 navy hex (`InterviewWorkspace`/`TemplateBuilder`) to `navy-*` tokens. Resolve the crimson-/primary- accent split to one token family.

**Effort ladder (most→least bang-for-buck):** Phase 0 (foundation) → Phase 1 (Initiatives, biggest gap) → Phase 2 (alt-view coherence) → Phase 3 → Phase 4 → Phase 5.

---

## 9. Appendix — file:line index

| Thing | Location |
|---|---|
| Shared class constants (pill/progress/row) | `InterviewHub.tsx:537–550` |
| Default width constants (×5) | `:164–244` |
| Storage keys (×6) | `:140–157` |
| `loadHiddenColumns`/`saveHiddenColumns`/`saveBooleanSetting` | `:287–323` |
| `getSessionStatusConfig` | `:2895` |
| `renderSessionsTable` | `:2961` |
| `renderSessionsGrid` (re-impl status/progress) | `:3442` |
| `renderInsightsTable` (+FilterDropdown) | `:3773` (`:3931/3962`) |
| Insight status via SSOT | `:4108/4138` |
| `renderTemplatesTable` | `:4409` |
| Templates status (off-SSOT) | `:4804` |
| `renderTemplatesCards` (no preview) | `:4953` |
| `getAssignmentStatusColor` / `Label` | `:5316` / `:5339` |
| `getAssignmentDaysToDue` (module) | `:5359` |
| `renderAssignmentsTable` (Inbox+Managed) | `:5608` |
| duplicate `getDaysToDue` (local) | `:5739` |
| Assignee "?" avatar | `:6262` |
| Assignment status pill | `:6281` |
| Due chip render | `:6314` |
| `renderListContent` (tab dispatch) | `:6483` |
| Initiatives `statusMeta` (SSOT) | `:6912` |
| Initiatives raw table (no preview) | `:7033–7036` |
| Insights flat/report branch | `:6864` |
| Templates cards branch (no preview) | `:7553` |
| Templates `TableWithPreviewLayout` | `:7566` |
| Inbox `TableWithPreviewLayout` + GridView cards | `:7694` / `:7833` |
| Managed `TableWithPreviewLayout` | `:7907` |
| `rightControls` (view toggles) | `:8185` |
| SSOT palette | `src/constants/statusColors.ts:131` (`getStatusStyle`), `:153` (`getPriorityStyle`) |
| `TableWithPreviewLayout` | `src/components/shared/TableWithPreviewLayout.tsx` |
| `ResizableTable` (unused as component) | `src/components/ui/ResizableTable/index.tsx:33` |
| `DataTable` (0 importers) | `src/components/ui/composed/DataTable.tsx` |
