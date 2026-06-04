# UI/UX Conformance Audit — Group B

**Date:** 2026-06-04
**Scope:** `src/components/Execution/**`, `src/components/Results/**`, `src/components/Initiatives/**`, `src/components/Economics/**` (Finance), `src/components/Meeting/**`, `src/components/Organization/**`
**Standard:** `docs/ui-standards/03-modules/module-hub-standard.md` (A–R blocks, canonical Menu3 chip classes) + `docs/UI_UX/11/13/14/21`
**SSOT reference:** `src/components/Execution/ExecutionHub.tsx` (Menu-3 canonical token consumer)
**Mode:** Read-only. No code edited.

---

## Executive Summary

| Module | Live Hub | Shell | Menu3 | States | Tokens | Verdict |
| ------ | -------- | ----- | ----- | ------ | ------ | ------- |
| Execution | `ExecutionHub.tsx` | ModuleHub ✓ | Canonical ✓ | LoadingState ✓ | minor | **PASS (SSOT)** |
| Results | `ResultsHub.tsx` | ModuleHub ✓ | Canonical ✓ | mostly ✓ | clean | **MINOR** |
| Initiatives | `InitiativesHub.tsx` | ModuleHub ✓ | Canonical ✓ | hand-rolled error/empty | minor | **MINOR** |
| Finance | `Economics/FinanceHub.tsx` | ModuleHub ✓ | Canonical ✓ | EmptyStateInline ✓ | hex in charts | **MINOR** |
| Meeting | `Meeting/MeetingHub.tsx` | ModuleHub ✓ | Canonical ✓ | **empty-on-failure bug** | clean | **NEEDS-WORK** |
| Organization | `views/OrganizationView.tsx` | **NOT ModuleHub** (bespoke sidebar) | none | raw spinners/tables | hardcoded hex | **NEEDS-WORK** |

**Top systemic findings**
1. **Organization bypasses the entire module canon** — custom left-sidebar shell, no ModuleHub/ModuleNavBar/Menu3, raw `<table>`, raw `<select>`, hand-rolled kebabs, hardcoded hex palette.
2. **Meeting empty-on-failure bug** — load failure sets `setMeetings([])` with only a toast, so the empty state renders on error (no distinct error state).
3. **`EconomicsHub.tsx` is dead code** — `views/EconomicsView.tsx:22` renders `FinanceHub`, not `EconomicsHub`. The dead hub still carries a raw `animate-spin` full-area loader and no Menu3 canon. Audit treats FinanceHub as the live Finance hub.
4. **Canonical chip-system adoption is near-zero** in operational tables — `StatusChip/PriorityChip/MetaChip/DueChip` are barely imported (Execution 0, Results 1, Initiatives 1, Meeting 1). Status rendering is hand-rolled inside `FilterableTable` itself (`FilterableTable.tsx:110`).
5. **RowActionsMenu adoption is partial** — present in Results (4) and Initiatives (3) but absent in Economics, Meeting, Organization, which hand-roll buttons.

---

## 1. Execution — **PASS (SSOT reference)**

Live hub: `Execution/ExecutionHub.tsx`. This is the Menu-3 reference; others should match it.

**Conformant**
- ModuleHub shell + canonical Menu3 tokens imported (`ExecutionHub.tsx:88-106`: `ModuleHub`, `FilterableTable`, `MENU_3_CHIP_ACTIVE/INACTIVE`, `MENU_3_BADGE_*`, `MENU_3_ALL_DOT_CLASS`, `MENU_3_LEFT_CLASS`).
- `LoadingState` primitive used (`:54`); `HubWorkAreaLoadError`/`HubWorkAreaLoading` imported (`:91-92`).
- Distinct error state: `initiativesLoadError` + `initiativesLoadErrorCode` via `mapHubLoadFailureToPresentation` (`:1004-1009`), not empty-on-failure.

**Stray ad-hoc elements (minor)**
- Kanban task/column cards are hand-rolled with local chip-like spans and a hand-rolled count badge `bg-slate-100 ... px-2 py-0.5 rounded-full` (`ExecutionHub.tsx:343-345`, `:281`, `:291`). Acceptable as a view-local Kanban surface, but the count badge does not use `MENU_3_BADGE_*`.
- Raw `fixed inset-0` (4) and `animate-spin` (5) occurrences across Execution sub-views (`RolloutTab.tsx`, `ReportDocumentView.tsx` raw `<table>`; spinners in panels). These are secondary panels, not the hub.
- 4 hex colors in Execution sub-files (chart/report internals).

**Verdict: PASS.** Top fixes (cosmetic): (1) route Kanban count badge through `MENU_3_BADGE_INACTIVE`; (2) migrate `RolloutTab`/`ReportDocumentView` raw `<table>` to canonical table; (3) replace panel `Loader2 animate-spin` with `LoadingState`.

---

## 2. Results — **MINOR**

Live hub: `Results/ResultsHub.tsx`.

**Conformant**
- ModuleHub shell (`ResultsHub.tsx:20`), canonical Menu3 tokens (`:23-30`: `MENU_3_CHIP_ACTIVE/INACTIVE`, `MENU_3_BADGE_INACTIVE`, `MENU_3_LEFT_CLASS`, `MENU_3_RIGHT_CLASS`, `MENU_3_ACTION_NEUTRAL`), `HubWorkAreaLoadError` (`:18`, `:1432`).
- Menu3 chips/badges use canonical classes (`:77-98`, `:1158`). RowActionsMenu used (4 files).

**Stray ad-hoc elements**
- Raw `<select>` bypassing `SelectField` primitive — `ResultsControlSelect` (`ResultsHub.tsx:116-127`), hand-styled `h-9 rounded-full border ...`.
- Menu3 action buttons carry a leading `<Plus size={14}>` icon (`:1126`, `:1226`) — Menu2/Menu3 canon says creation is communicated by position/label, not a leading `+`.
- Raw `fixed inset-0` modals across 9 Results files (`ROITrackingView`, `ROIAnalysisView`, `ROIOpenModal`, `ROIDetailDrawer`, `KPITimeSeriesDrawer`, `KpiQueueView`, `ResultsKpiReportsView`, `KPICreateModal`, `ResultsKPITable`) — should use canonical `Modal`/`Drawer`/`sheet`.
- Raw `<table>` in 7 Results files (`ROITrackingView`, `ROIAnalysisView`, `ResultsInitiativesView`, `ROIDetailDrawer`, `KPITimeSeriesDrawer`, `ROIAssumptionEditor`, `ResultsKPITable`) vs canonical `FilterableTable`/`ResizableTable`/`DataTable`.
- Hand-rolled chip spans (`rounded-full`) in `ROIAnalysisView.tsx` (6), `ROITrackingView.tsx` (4) instead of chip-system.

**Verdict: MINOR.** Top fixes: (1) replace `ResultsControlSelect` raw `<select>` with `SelectField`; (2) drop leading `+` from Menu3 action buttons (`:1126`, `:1226`); (3) migrate ROI/KPI raw modals to canonical `Modal`/`Drawer`; (4) migrate ROI/KPI raw `<table>` views to canonical tables; (5) adopt `StatusChip`/`MetaChip` in ROI/KPI views.

---

## 3. Initiatives — **MINOR**

Live hub: `Initiatives/InitiativesHub.tsx`.

**Conformant**
- ModuleHub shell (`:68`), full canonical Menu3 token set (`:71-79`), `TableWithPreviewLayout` (`:80`, used 4×).
- Primary CTA is canonical: `h-9 px-4 rounded-full ... bg-hig-primary`, **no leading `+`** (`:1772-1781`).
- Distinct loading vs error vs empty in `renderContent` (`:1172` error, `:1199` loading via `HubWorkAreaLoading`, `:1203` empty). Not empty-on-failure.

**Stray ad-hoc elements**
- Error state is **hand-rolled** rose panel + hand-rolled retry/dismiss `<button>`s (`:1172-1196`) instead of canonical `HubWorkAreaLoadError`/`ErrorState`. Functionally distinct from empty, but off-canon.
- Empty-state CTA is an off-brand **gradient** button with leading `+`: `bg-gradient-to-r from-primary-500 to-primary-600 ... <Plus size={14} className="inline mr-2" />` (`:1216-1219`) — violates "no gradient in operational chrome" + "no leading `+`".
- Raw `fixed inset-0` modals (24) and `animate-spin` (69) concentrated in `sections/**`, `Analysis/**`, `Wizard/**`, drawers. Raw `<table>` in 13 sub-files (`sections/ResourcesSection`, `InitiativeGatesWorkflowTable`, `TimelineSection`, `TasksMilestonesSection`, `DecisionsSection`, `DependenciesSection`, `GateReadinessSection`, `CompetencyRequirementsSection`, `Analysis/*`, `InitiativeDocumentView`).
- Multiple raw `<select>` in new/edit modals (`InitiativesHub.tsx:1880,2047,2064,2080,2097`).
- 8 hex colors in Initiatives sub-files; hand-rolled chip spans in `InitiativeFullView.tsx` (10).

**Verdict: MINOR** (hub conformant; sub-screens carry debt). Top fixes: (1) replace hand-rolled error panel with `HubWorkAreaLoadError`/`ErrorState` (`:1172`); (2) replace gradient `+` empty-CTA with neutral Button matching the primary CTA token (`:1216`); (3) migrate modal `<select>`s to `SelectField`; (4) migrate `sections/**` raw `<table>` to canonical tables; (5) replace panel `animate-spin` with `LoadingState`.

---

## 4. Finance (Economics) — **MINOR**

Live hub: `Economics/FinanceHub.tsx` (confirmed via `views/EconomicsView.tsx:19-22`). **`Economics/EconomicsHub.tsx` is dead code** (only self-export `index.ts:8` + legacy comment).

**Conformant**
- ModuleHub + `FilterableTable` + `TableWithPreviewLayout` (`FinanceHub.tsx:59-80`), canonical Menu3 tokens (`:72-78`), `getMenu3AiButtonClass` for AI right-slot (`:69`).
- Empty vs error handled: `EmptyStateInline` (`:79`, `:1920`) + per-tab `emptyMessage` (`:1731-1759`) + `loadError` consumed (`:202`). FinanceDegradedBanner present in module.
- Best chip-system adoption in scope (4 files import chips).

**Stray ad-hoc elements**
- Menu3/CTA leading `<Plus size={14}>` (`FinanceHub.tsx:2045`) — drop leading `+`.
- Raw `fixed inset-0` modal (`FinanceHub.tsx:2204`); 11 across Economics dir.
- Raw `<table>` in `BenefitsTrackingDashboard`, `FinancePreviewPanel`, `FinanceModelDocumentView`, `AnalysisCatalog` vs canonical tables.
- **36 hardcoded hex** in Economics (highest in scope) — concentrated in chart components (`CashFlowChart`, `SensitivityChart`) and panels; verify against `color-system.md` tokens. `animate-spin` (20) in panels/wizards.
- `AnalysisCreateModal`, `ExcelImportWizard`, `PDFExportModal` use raw modal patterns.

**Verdict: MINOR.** Top fixes: (1) delete/retire dead `EconomicsHub.tsx` (its raw full-area `animate-spin` at `:460` is a trap if re-wired); (2) drop leading `+` (`:2045`); (3) tokenize chart hex (`CashFlowChart`/`SensitivityChart`); (4) migrate `FinanceHub.tsx:2204` modal to canonical `Modal`; (5) adopt `RowActionsMenu` (currently 0 in Economics).

---

## 5. Meeting — **NEEDS-WORK**

Live hub: `Meeting/MeetingHub.tsx`.

**Conformant**
- ModuleHub + `FilterableTable` + `TableWithPreviewLayout` + canonical `Menu3Row` shell with canonical tokens (`MeetingHub.tsx:23-37`).
- `LoadingState` primitive used (`:626`); `StatusChip` imported (`:37`).

**State correctness — BUG**
- **Empty-on-failure:** `loadMeetings` catch sets `setMeetings([])` + toast, with **no persistent error state** (`MeetingHub.tsx:113-116`). On API failure the table renders the empty state, indistinguishable from "no meetings." Block O FAIL. Needs a distinct error state (e.g., `HubWorkAreaLoadError`) and must not clear data to `[]` on failure.

**Stray ad-hoc elements**
- 4 raw `fixed inset-0` modals (`:716`, `:821`, `:869`, `:924`) — create/edit/delete/decision dialogs should use canonical `Modal`/`Drawer`.
- Inline `Loader2 ... animate-spin` button spinners (`:614`, `:955`) — acceptable inline, but no `RowActionsMenu` (0) so row actions are hand-rolled.

**Verdict: NEEDS-WORK** (single but real state bug + raw modals). Top fixes: (1) fix empty-on-failure: add error state, stop clearing to `[]` on catch (`:113-116`); (2) migrate the 4 `fixed inset-0` dialogs to canonical `Modal`; (3) adopt `RowActionsMenu` for row kebab; (4) confirm Menu2 right-cluster order (Area→Add→Tool→View→Filters) and no Help.

---

## 6. Organization — **NEEDS-WORK (off-canon shell)**

Live view: `views/OrganizationView.tsx` rendering `Organization/**` components. **This module does not use the module canon at all.**

**Shell — FAIL**
- No `ModuleHub`, no `ModuleNavBar` (Menu2), no `Menu3`. Instead a **bespoke left `OrganizationSidebar` + custom sticky header** (`OrganizationView.tsx:192-258`): hand-rolled `<h1>` page title (`:231`, the canon explicitly forbids a large module-name heading — info belongs in breadcrumbs), hand-rolled hamburger `<button>`s (`:222`, `:239`), raw `fixed inset-0` scrim (`:198`). No Menu2 tab bar, no Menu3 command row, no view toggle, no canonical filters.

**Stray ad-hoc elements**
- `OrganizationAdminPanel.tsx`: raw `<table>` (`:199`), raw `<select>` (`:174`), hand-rolled `<button>`s throughout (`:149,184,291,474,687,724,741`), `Loader2 animate-spin` (`:190`), hardcoded hex brand color defaults `'#6366f1'` (`:767`, `:778`).
- `CompetencyCatalog.tsx`: raw `<table>` (`:384`), raw `<select>` (`:345`), hand-rolled `<button>`s (`:211–372`).
- `KnowledgeGraphExplorer.tsx`: hardcoded hex palette for node types (`:74–81`: `#6366f1`, `#0ea5e9`, `#10b981`, `#f59e0b`, `#ec4899`, `#3b82f6`, `#64748b`), edge styles `#94a3b8` (`:131-132`), hand-rolled `<button>`s + inline `animate-spin` (`:315`). (Graph canvas hex is partly defensible for react-flow, but should map to `color-system.md` tokens.)
- Chip-system: only 1 file imports chips; `RowActionsMenu` 0; canonical states 0.

**Verdict: NEEDS-WORK.** Top fixes: (1) re-platform Organization onto `ModuleHub` + `ModuleNavBar` + Menu3 (largest item — remove bespoke sidebar/header, drop the `<h1>` title per breadcrumb canon); (2) migrate `OrganizationAdminPanel`/`CompetencyCatalog` raw `<table>` to canonical tables + `RowActionsMenu`; (3) replace raw `<select>`s with `SelectField`; (4) tokenize `KnowledgeGraphExplorer`/admin brand hex via `color-system.md`; (5) replace `animate-spin` loaders with `LoadingState`.

---

## Appendix — Anti-pattern counts (occurrences per module dir)

| Module dir | `fixed inset-0` | `animate-spin` | raw `<table>` files | hex (non-svg) | ModuleHub files | Menu3-canon files | chip-system files | RowActionsMenu files |
| ---------- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Execution | 4 | 5 | 2 | 4 | 2 | 3 | 0 | 0 |
| Results | 14 | 0 | 7 | 0 | 1 | 1 | 1 | 4 |
| Initiatives | 24 | 69 | 13 | 8 | 2 | 1 | 1 | 3 |
| Economics | 11 | 20 | 4 | 36 | 2 | 1 | 4 | 0 |
| Meeting | 4 | 2 | 0 | 1 | 1 | 1 | 1 | 0 |
| Organization | 0 | 3 | 2 | 14 | 0 | 0 | 1 | 0 |

> Note: Execution/Results/Initiatives/Finance hubs are themselves canon-conformant; most counts above come from secondary sub-views (panels, drawers, sections, analysis). Organization is the only module whose **top-level shell** is off-canon.
