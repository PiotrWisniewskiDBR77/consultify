# UI/UX Conformance Audit — Group A (MyWork / Interview / Decisions / Tools / Assessment)

Date: 2026-06-04
Scope (read-only): `src/components/MyWork/**`, `src/components/Interview/**`, `src/components/Decisions/**`, `src/components/DiscoveryTools/**`, `src/components/Assessment/**` (note: `assessment/**` and `Assessment/**` resolve to the **same** directory on this macOS case-insensitive FS — single set of files).
Standard: `docs/ui-standards/03-modules/module-hub-standard.md` (A–R blocks, canonical Menu3 chip classes) + `docs/UI_UX/{11,13,14,21}`.

Canonical building blocks that SHOULD be used: `ModuleHub`/`ModuleNavBar`, `ModuleMenu3` class constants (`MENU_2_TAB_*`, `MENU_3_CHIP_*`, `MENU_3_ROW_CLASS`, `MENU_3_BADGE_*`, `MENU_3_ALL_DOT_CLASS`, `getMenu3AiButtonClass`), `ResizableTable`/`FilterableTable`/`DataTable`, `ui/primitives` `Button`/`Modal`/`Drawer`/`Input`/`SelectField`/`Switch`/`Toggle`, chip-system (`StatusChip`/`PriorityChip`/`MetaChip`/`ToolChip`/`DueChip`), `LoadingState`/`EmptyState`/`ErrorState`, `Banner`, `RowActionsMenu`, `TableSettingsPopover`.

## Executive summary

| Module | Shell / Menu | States | Chips | Modals | Tables | Color | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Decisions** | Hand-rolled shell but canonical Menu3 classes | **Empty-on-failure bug** in DecisionInbox | DecisionCard hand-rolled pills | Clean (Decisions/) | — | gradient on inbox icon | **MINOR** |
| **MyWork** | ModuleHub + canonical Menu3 | mixed: raw spinners, partial error states | many hand-rolled pills | 4 raw `fixed inset-0` detail modals | raw `<table>` (table-fixed) | mostly tokens | **NEEDS-WORK** |
| **Interview** | ModuleHub + canonical Menu3 | **sessions empty-on-failure**, no ErrorState in hub | 34 hand-rolled pills | 4 raw `fixed inset-0` | 5 raw `<table>` | tokens OK | **NEEDS-WORK** |
| **DiscoveryTools** | tool-workspace (Menu3 portaled correctly) | OK in main views | KnownToolDetailView 7 decorative pills | 2 raw `fixed inset-0` | n/a | tokens OK | **MINOR** |
| **Assessment** | ModuleHub + canonical Menu3 (AssessmentMenu3ActionBar) | **raw full-area spinner**, no LoadingState/EmptyState/ErrorState in hub | hub clean; raw banner | 1 raw `fixed inset-0` | uses MyAssessmentsList (LoadingState OK) | tokens OK | **NEEDS-WORK** |

Cross-cutting wins already in place: all five module hubs use the canonical `MENU_3_*` class constants (no local chip CSS in the command rows), Menu2 CTAs have no leading `+`, no `Help` in Menu2, and `ResizableTable` is used in the golden-reference Ideas table. The remaining debt is concentrated in (1) detail/dialog modals still hand-rolled as `fixed inset-0`, (2) full-area loading using raw `animate-spin` instead of `LoadingState`, (3) status/meta pills still hand-rolled instead of the chip-system, and (4) two real **empty-shown-on-failure** state bugs (Decisions inbox + Interview sessions).

---

## 1. Decisions — Verdict: MINOR

Files: `DecisionsHub.tsx`, `DecisionInbox.tsx`, `DecisionCard.tsx`, `DecisionsByInitiative.tsx`, `EscalationDashboard.tsx`.

### Shell / Menu conformance — PASS (with note)
- `DecisionsHub.tsx` hand-rolls the nav-bar block (`DecisionsHub.tsx:107`) rather than using `ModuleHub`/`ModuleNavBar`, but it correctly imports and uses every canonical Menu3 class (`DecisionsHub.tsx:16-31`), Menu2 tabs use `MENU_2_TAB_ACTIVE/INACTIVE` (`:119`), Menu3 is `MENU_3_ROW_CLASS` + `justify-between` with chips left / AI right (`:155-189`), CTA "New Decision" has no leading `+` and is not gradient (`:130-150`). This is conformant content inside a non-canonical shell — low risk, but it duplicates ModuleNavBar.

### Stray ad-hoc elements
- `DecisionCard.tsx:127` and `DecisionCard.tsx:146` — hand-rolled status/priority pills (`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ...`) instead of `StatusChip`/`PriorityChip`. Includes `animate-pulse`, which is off-canon for metadata.
- `DecisionInbox.tsx:294` — header icon uses an off-brand gradient `bg-gradient-to-br from-primary-500 to-pink-600` (only visible when `showHeader`; the hub renders embedded so it is usually hidden, but it is still dead off-brand styling).
- `DecisionInbox.tsx:330-336` — raw `<button>` "New" with leading `<Plus>` (`:334`) and a one-off color (`bg-primary-600`) instead of the `Button` primitive (again header-only path).
- `DecisionInbox.tsx` correctly uses `LoadingState` (`:281`) and `StatusChip` (`:306`, `:312`); `DecisionsByInitiative.tsx` uses `EmptyState`+`LoadingState` (`:21-22`, `:341`, `:433`).

### State correctness — FAIL (empty-on-failure)
- `DecisionInbox.tsx:108-113` — fetch `catch` only `console.error`s; no error flag is set, so a failed load falls through to the **empty** render at `:530-532` ("No decisions awaiting your action"). This is the exact Ideas-class bug: failure is indistinguishable from genuinely-empty. No `ErrorState` in the file.

### Top fixes
1. Set an error flag in `DecisionInbox.tsx:108` and render `ErrorState` (distinct from empty) — fixes the empty-on-failure bug.
2. Replace `DecisionCard.tsx:127`/`:146` pills with `StatusChip`/`PriorityChip`; drop `animate-pulse` on metadata.
3. Remove the `from-primary-500 to-pink-600` gradient at `DecisionInbox.tsx:294`; use a neutral/token icon chip.
4. Replace the header "New" raw button (`DecisionInbox.tsx:330`) with the `Button` primitive, no leading `+`.
5. (Optional) Migrate `DecisionsHub` shell to `ModuleHub`/`ModuleNavBar` to retire the duplicated nav block.

---

## 2. MyWork — Verdict: NEEDS-WORK

Files: `MyWorkHub.tsx` (hub), and main screens `MyTasksListContent.tsx`, `IdeasTableContent.tsx`, `InboxContent.tsx`, `NotebookContent.tsx`, `DecisionsPanelContent.tsx`, `TaskDetailModal.tsx`, `DecisionDetailModal.tsx`, `ConvertToDialog.tsx`, `CommandPalette.tsx`, etc.

### Shell / Menu conformance — PASS
- `MyWorkHub.tsx` uses ModuleHub pattern and the canonical Menu3 constants throughout (`MyWorkHub.tsx:64-79`; rows at `:2250`, `:2408`, `:2496`, `:2727`, `:2995`). Tab classes alias `MENU_2_TAB_*` (`:495-496`) and chips alias `MENU_3_CHIP_*` (`:517-518`). Menu3 is the reference pattern for the whole app, so this is the model — good.

### Stray ad-hoc elements
- **Raw full-area loading** (should be `LoadingState`): `MyTasksListContent.tsx:1792-1794` (`Loader2 animate-spin` centered in a 64-tall box). The same file correctly uses `ErrorState` (`:1800-1804`), so the loading path is the outlier.
- **Raw modals (`fixed inset-0`)** instead of `Modal`/`Drawer` primitive:
  - `TaskDetailModal.tsx:175`
  - `DecisionDetailModal.tsx:247`
  - `ConvertToDialog.tsx:82`
  - `CommandPalette.tsx:553` (palette overlay — arguably bespoke, lower priority)
- **Hand-rolled pills** instead of chip-system: `IdeasTableContent.tsx:500` (status badge) and `:581` (meta pill); `MyTasksListContent.tsx:2043` (meta pill). MyWork has ~107 `inline-flex … rounded-full px-*` spans total across the dir — the golden Ideas table itself still hand-rolls its status/meta chips rather than using `StatusChip`/`MetaChip`.
- **Tables**: `MyTasksListContent.tsx:2071` and `IdeasTableContent.tsx:694` use raw `<table className="w-full table-fixed">`. Ideas wraps it with `ResizableTable`/`ColumnResizer`/`FilterDropdown` (`IdeasTableContent.tsx:45-46`), so the fixed-column contract is honored; the raw `<table>` element is acceptable under app-table-standard when the resize/settings scaffolding is present. `MyTasksListContent` uses `RowActionsMenu` (`:43`, `:756`) — good.

### State correctness — MIXED
- Loading: `MyTasksList`, `DecisionsPanelContent`, `TodayDashboard` use `LoadingState`; but `MyTasksListContent` uses a raw spinner (above).
- Error/empty: `MyTasksListContent` has `ErrorState`; `IdeasTableContent`, `NotebookContent`, `InboxContent` have neither `LoadingState` nor `ErrorState` imported — `InboxContent` swallows fetch failures with `.catch(() => …)` fallbacks (`InboxContent.tsx:1712-1731`, `:1915`, `:2002`), risking empty-on-failure on the inbox table.

### Color / token drift
- No hardcoded hex found in the scanned MyWork main screens; styling is token-based. Modal scrims use `bg-black/40–/50 backdrop-blur` inline (would be standardized by adopting the `Modal` primitive).

### Top fixes
1. Convert `TaskDetailModal`, `DecisionDetailModal`, `ConvertToDialog` to the `Modal`/`Drawer` primitive (retire `fixed inset-0` at `TaskDetailModal.tsx:175`, `DecisionDetailModal.tsx:247`, `ConvertToDialog.tsx:82`).
2. Replace the raw full-area spinner at `MyTasksListContent.tsx:1792` with `LoadingState`.
3. Add explicit `ErrorState` to `IdeasTableContent`/`InboxContent` so the `.catch(() => [])` fallbacks don't render as "empty".
4. Migrate the Ideas-table status/meta pills (`IdeasTableContent.tsx:500`, `:581`) to `StatusChip`/`MetaChip` so the golden reference itself is on the chip-system.

---

## 3. Interview — Verdict: NEEDS-WORK

Files: `InterviewHub.tsx` (8.9k lines, hub for Sessions / Templates / Insights / Assignments tabs) + supporting modals/panels.

### Shell / Menu conformance — PASS
- Uses `ModuleHub` (`InterviewHub.tsx:95-99`) with canonical Menu3 classes (`MENU_3_CHIP_*`, `MENU_3_ROW_CLASS`, `MENU_3_LEFT_CLASS`, `MENU_3_RIGHT_CLASS` at `:69-75`; rows at `:2353`, `:2493`, `:2535`). `primaryCta` is computed and passed to ModuleHub (`:8400`, `:8527`) — no leading `+`, no `Help` in Menu2 (grep clean). The historical "Help in Menu2 / duplicate generic filters" anti-pattern from standard §2b appears resolved.

### Stray ad-hoc elements
- **34 hand-rolled pills** (`inline-flex … rounded-full px-*`) across the hub for status/meta/category badges instead of `StatusChip`/`MetaChip`/`ToolChip`.
- **Raw tables**: 5 occurrences — `InterviewHub.tsx:3042`, `:3877`, `:4488`, `:5931`, `:7027` (all `w-full table-fixed`, `:7027` adds `rounded-xl`). These are hand-assembled rather than `FilterableTable`/`DataTable`; confirm each has the resize/settings scaffolding the app-table-standard requires (the inline `<table>` alone does not show `ResizableTable` wrapping in this file).
- **Raw modals**: 4 `fixed inset-0` occurrences in the hub; supporting modal files (`NewSessionModal`, `AssignInterviewModal`, `InsightCreatorModal`) should be confirmed against the `Modal` primitive.

### State correctness — FAIL (sessions empty-on-failure) + partial
- `InterviewHub.tsx:1040-1045` — on `sessionsRes` rejection the code `console.error`s and `setSessions([])` with **no** error flag, so the Sessions tab renders empty on fetch failure (Ideas-class bug). By contrast insights (`:1047-1057`) and initiatives (`:1060-1062`) DO set `insightsLoadError`/`initiativesLoadError` — so the pattern is half-applied; sessions (the primary tab) is the gap.
- Hub uses `LoadingState` (2x) and `EmptyState` (1x) but imports **no** `ErrorState`; there is no canonical error surface for the sessions/templates tabs.

### Color / token drift
- No hardcoded hex in the hub (grep clean). Tokens used throughout.

### Top fixes
1. Add a `sessionsLoadError` flag at `InterviewHub.tsx:1040` and render `ErrorState` for the Sessions tab — fixes empty-on-failure (mirror the insights branch at `:1050`).
2. Import and wire `ErrorState` for the Templates/Assignments tabs too (currently none).
3. Migrate the 34 status/meta pills to the chip-system (`StatusChip`/`MetaChip`/`ToolChip`).
4. Confirm the 5 raw `<table>`s (`:3042`, `:3877`, `:4488`, `:5931`, `:7027`) carry the ResizableTable/settings-popover contract; otherwise wrap with the canonical table.
5. Convert the 4 `fixed inset-0` overlays to the `Modal`/`Drawer` primitive.

---

## 4. DiscoveryTools — Verdict: MINOR

Files in scope are tool-workspace/detail views (the list hub `DiscoveryToolsHub` lives in `src/components/Discovery/`, **outside** this scope path). Audited: `ToolWorkspace.tsx`, `ToolDocumentView.tsx`, `GenericToolDocumentView.tsx`, `KnownToolDetailView.tsx`, `ToolHeader.tsx`, `ToolActionBar.tsx`.

### Shell / Menu conformance — PASS
- `ToolDocumentView.tsx` integrates with Menu3 correctly: it builds `commandRowActions` and **portals** them into the host hub's command row (`ToolDocumentView.tsx:1809`, `:1946-1947`) using `getMenu3AiButtonClass` (`:34`). This is the canonical "specialist workspace owns Menu3 right slot" pattern from standard §3.1a/§3.4 — good.

### Stray ad-hoc elements
- **Hand-rolled pills**: `KnownToolDetailView.tsx` has 7 decorative library badges (`:609`, `:629`, `:663`, `:766`, `:940`, `:963`, `:1005`) — `inline-flex … rounded-full border … px-2 py-0.5 text-[9px] uppercase tracking-[0.16em]`. These are presentation/library chrome rather than operational status, so lower severity, but they bypass the chip-system and use bespoke sizing/tracking.
- **Raw modals**: `ToolWorkspace.tsx:694` and `ToolDocumentView.tsx:2004` use `fixed inset-0` overlays instead of the `Modal` primitive.
- `ToolDocumentView.tsx:500-581`-style chips: 2 hand-rolled pills.

### State correctness — PASS
- `ToolDocumentView` and `GenericToolDocumentView` reference `LoadingState`/`EmptyState`/`ErrorState` (2 each). `GenericToolDocumentView.tsx` has one inline `animate-spin` (small inline, not full-area). No empty-on-failure pattern observed in the main views.

### Color / token drift — PASS
- `ToolHeader.tsx:110` `style={{ width: `${progress}%` }}` is a legitimate dynamic progress-bar width, not color drift. No hardcoded hex.

### Top fixes
1. Convert `ToolWorkspace.tsx:694` and `ToolDocumentView.tsx:2004` overlays to the `Modal` primitive.
2. Replace the 7 decorative pills in `KnownToolDetailView.tsx` with `MetaChip`/`ToolChip` (or a single shared library-badge component) for consistent radius/padding/size.
3. Normalize the 2 hand-rolled chips in `ToolDocumentView.tsx`.

---

## 5. Assessment — Verdict: NEEDS-WORK

Live entry: route `AssessmentHub` → `src/components/assessment/AssessmentHub.tsx` (`src/routes/AppRoutes.tsx:64-65`, `:1644-1646`). Per-assessment workspace: `AssessmentModuleHub.tsx` (rendered by `views/AssessmentView.tsx:279`, `views/FullAssessmentView.tsx:354`). Main list: `MyAssessmentsList.tsx`.

### Shell / Menu conformance — PASS
- `AssessmentHub.tsx` uses `ModuleHub` (`:52-59`, `:1647`) with a dedicated `AssessmentMenu3ActionBar` that imports the full canonical Menu3 vocabulary (`AssessmentMenu3ActionBar.tsx:4-13`: `getMenu3AiButtonClass`, `MENU_3_CHIP_*`, `MENU_3_BADGE_*`, `MENU_3_ALL_DOT_CLASS`, `MENU_3_INNER_CLASS`, `MENU_3_LEFT/RIGHT_CLASS`) and renders `MENU_3_INNER_CLASS` (`:46`). Command row wired via `commandRowContent={hubCommandRowContent}` (`AssessmentHub.tsx:1345-1346`, `:1665`). CTA label via `getNewItemLabel()` (`:1663`) — no leading `+`. This is the strongest Menu conformance in the group.
- `AssessmentModuleHub.tsx` is the editor workspace; it has 0 chips/tables/modals and uses `LoadingState`/`EmptyState`/`ErrorState` (3 refs) — clean.

### Stray ad-hoc elements
- **Raw full-area loading**: `AssessmentHub.tsx:1634-1642` renders a hand-rolled `animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500` + "Loading assessments..." instead of `LoadingState`. The hub imports **no** `LoadingState`/`EmptyState`/`ErrorState` at all.
- Additional raw spinners: `AssessmentHub.tsx:1599`, `:2000`, `:2044`, `:2117`, `:2156`, `:2186` (mix of inline `Loader2 animate-spin` and `border-b-2` spinners across upload/sub-panels). 7 total.
- **Hand-rolled banner**: `AssessmentHub.tsx:1668` renders an inline `rounded-xl border border-amber-500/30 bg-amber-500/10 …` warning strip instead of the `Banner` component.
- **Inline assessment-editor header** (`AssessmentHub.tsx:1399-1410`): hand-rolled header with raw `<button>` (`:1403`) instead of the `Button` primitive / a shared artifact header.
- **Raw modal**: 1 `fixed inset-0` in the hub.
- The main list `MyAssessmentsList.tsx` uses `LoadingState` (`:28`, `:254`), 0 hand-rolled chips, 0 raw tables — but it also does not use the canonical `ResizableTable`/`FilterableTable` (no table component import), so confirm its record list satisfies the app-table fixed-column/settings contract.

### State correctness — MIXED → FAIL on hub
- Hub `isLoading` path is the raw spinner above (no `LoadingState`); no `ErrorState`/`EmptyState` in the hub means load failures and empties are not visually distinct. `MyAssessmentsList` and `AssessmentModuleHub` are fine.

### Color / token drift — PASS
- No hardcoded hex in the hub. Spinner/banner colors use tokens; issue is component-canon, not color.

### Top fixes
1. Replace the hub loading block (`AssessmentHub.tsx:1634-1642`) with `LoadingState`, and add `ErrorState`/`EmptyState` so failure ≠ empty.
2. Replace the 6 remaining raw spinners (`:1599`, `:2000`, `:2044`, `:2117`, `:2156`, `:2186`) with `LoadingState` (full-area) / the primitive's inline spinner.
3. Replace the inline amber warning (`AssessmentHub.tsx:1668`) with `Banner`.
4. Convert the inline editor header raw `<button>` (`AssessmentHub.tsx:1403`) to the `Button` primitive and the 1 `fixed inset-0` overlay to `Modal`.
5. Confirm `MyAssessmentsList` record table meets the app-table contract or migrate to `ResizableTable`/`FilterableTable`.

---

## Consolidated fix backlog (priority order)

**P0 — state bugs (empty-shown-on-failure):**
1. `DecisionInbox.tsx:108` — set error flag, render `ErrorState`.
2. `InterviewHub.tsx:1040` — add `sessionsLoadError`, render `ErrorState` for Sessions tab.
3. `IdeasTableContent` / `InboxContent` (MyWork) — surface fetch errors instead of `.catch(() => [])` → empty.
4. `AssessmentHub` — add `ErrorState`/`EmptyState` (currently none imported).

**P1 — raw full-area loading → `LoadingState`:**
- `MyTasksListContent.tsx:1792`, `AssessmentHub.tsx:1634` (+6 more spinners in AssessmentHub).

**P1 — raw `fixed inset-0` → `Modal`/`Drawer`:**
- `TaskDetailModal.tsx:175`, `DecisionDetailModal.tsx:247`, `ConvertToDialog.tsx:82` (MyWork); `InterviewHub.tsx` (4×); `ToolWorkspace.tsx:694`, `ToolDocumentView.tsx:2004`; AssessmentHub (1×).

**P2 — hand-rolled pills → chip-system (`StatusChip`/`PriorityChip`/`MetaChip`/`ToolChip`):**
- `DecisionCard.tsx:127,146`; `IdeasTableContent.tsx:500,581`; `MyTasksListContent.tsx:2043`; `InterviewHub.tsx` (34×); `KnownToolDetailView.tsx` (7×); `ToolDocumentView.tsx` (2×).

**P2 — off-brand color / non-canon primitives:**
- `DecisionInbox.tsx:294` gradient icon; `DecisionInbox.tsx:330` raw "New" button w/ `+`; `AssessmentHub.tsx:1668` raw banner → `Banner`; `AssessmentHub.tsx:1403` raw button → `Button`.

**P3 — table contract confirmation:**
- Interview raw `<table>`s (`:3042,:3877,:4488,:5931,:7027`) and `MyAssessmentsList` — verify ResizableTable/settings-popover/fixed-column contract or migrate to canonical table.

**Note on duplicate shell:** `DecisionsHub.tsx` hand-rolls the Menu2/Menu3 bar (`:107`) instead of `ModuleHub`/`ModuleNavBar`; content is conformant but the shell is a migration candidate.
