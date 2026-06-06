# UI Component Fragmentation Scan — 2026-06-03

> Read+Grep only. All counts from `src/**/*.tsx`. Evidence file:line included.

---

## Summary Table

| # | Category | Canonical component | Files using canonical | Files bespoke/raw | Fragmentation ratio | Top offenders |
|---|----------|--------------------|-----------------------|-------------------|--------------------|----|
| 1 | **Tables** | FilterableTable / ResizableTable / DataTable | 41 | 232 (raw `<table`) | **82 % raw** | `InitiativeDetailModal.tsx`, `MaturityMatrix.tsx`, `ResultsKPITable.tsx` |
| 2 | **Buttons** | `ui/primitives/Button` | 224 | 9 394 raw `<button` occurrences, 3 Button impls | **Button.tsx** exists in `ui/primitives`, `ui/`, AND `Admin/shared/` | `IdeaTableTool.tsx:87 <button`, `TaskDetailView.tsx:72`, `InterviewHub.tsx:67` |
| 3 | **Menu3/tabs** | `ModuleMenu3` / `MENU_3_*` | 14 consumers | 3 bespoke tab bars (FullPilotWorkspace, FullROIWorkspace, MegatrendsWorkspace) + 1 142 occurrences of local `bg-slate-50 dark:bg-navy-900/50` header strips | **~80 % of hub-like files** | `FullPilotWorkspace.tsx`, `RoadmapGantt.tsx:614`, `MaturityMatrix.tsx:115` |
| 4 | **Preview pane** | `TableWithPreviewLayout` | 24 | ~13+ local split implementations (`ResizablePanelProps` defined in-file, border-r flex splits) | **35 % bespoke** | `TargetStateSection.tsx:63 ResizablePanel`, `IdeaTableTool.tsx` (12 local `fixed inset-0`) |
| 5 | **Modals** | `ui/primitives/Modal` / `Drawer` | 15 (canonical Modal import) / 83 (any Modal-named import) | 453 **files** with `fixed inset-0` raw overlay; ~20 unique bespoke modal shells | **97 % raw** | `IdeaTableTool.tsx:12 overlays`, `InterviewHub.tsx:4`, `MeetingHub.tsx:4`, `InitiativeDetailModal.tsx:443` |
| 6 | **States** | `LoadingState` / `EmptyState` / `ErrorState` | LoadingState: 4 files; EmptyState: 22 files | 863 files with `animate-spin`/`Loader2`; 1 683 raw `animate-spin` occurrences | **99 % raw** | `AIChat/ResearchProgress.tsx`, `AIChat/ChatHistorySidebar.tsx`, `AIChat/ChatMenu.tsx` |
| 7 | **Chips/badges** | `StatusChip` / `PriorityChip` / `MetaChip` | 2 files | 1 513 occurrences of hand-rolled `rounded-full px-2 py-0.5 text-xs` badges | **99 % raw** | `InitiativeTasksTab.tsx:184`, `PresentationStudioLayoutCapacityAdminPanel.tsx:622,664,676`, `RoadmapGantt.tsx:618,624` |
| 8 | **Tokens** | Design tokens / semantic classes | — | `slate-*`: 45 404 occ; `#rrggbb` hex: 1 670 occ; `style={{`: 1 454 occ; `bg-gradient`/`bg-hig-primary`: 876 occ | **pervasive** | `InitiativeDetailModal.tsx`, `RoadmapGantt.tsx`, `PresentationStudio/*` |
| 9 | **Row actions** | `RowActionsMenu` | 60 occurrences / 29 files | 88 files with raw `MoreVertical`/`MoreHorizontal`/`EllipsisVertical` kebab; 168 total occurrences | **75 % bespoke** | `IdeaTableTool.tsx`, `MyWorkHub.tsx`, `InterviewHub.tsx`, `Admin/UnifiedSyncHub.tsx` |

---

## Ranked: Worst Fragmentation (biggest standardisation wins)

### 1. Chips/Badges — CRITICAL (99 % bespoke)
1 513 inline `rounded-full px-2 py-0.5 text-xs` spans across the entire codebase with zero consistent colour semantics. StatusChip/PriorityChip adopted by 2 files only.
- `src/components/InitiativeTasksTab.tsx:184`
- `src/components/PresentationStudio/PresentationStudioLayoutCapacityAdminPanel.tsx:622`
- `src/components/RoadmapGantt.tsx:618`

### 2. States (Loading/Empty/Error) — CRITICAL (99 % bespoke)
863 files use raw `animate-spin` or `Loader2` without canonical `LoadingState`. Empty states are completely fragmented across module-local divs. 4 files use LoadingState; 22 use EmptyState.
- `src/components/AIChat/ResearchProgress.tsx`
- `src/components/AIChat/ChatHistorySidebar.tsx`

### 3. Modals — CRITICAL (97 % bespoke)
453 files contain raw `fixed inset-0` overlay logic. Only 15 files import `ui/primitives/Modal`. Every module has invented its own backdrop, z-index stack, and animation.
- `src/components/MyWork/IdeaTableTool.tsx` — 12 local overlays
- `src/components/InitiativeDetailModal.tsx:443`
- `src/components/ConversionModal.tsx:66`

### 4. Tables — HIGH (82 % raw)
232 files use raw `<table` HTML. Only 41 import a canonical table component (FilterableTable/ResizableTable/DataTable). Raw tables miss sorting, pagination, keyboard nav, and accessibility.
- `src/components/Results/ResultsKPITable.tsx`
- `src/components/MaturityMatrix.tsx`

### 5. Buttons — HIGH (3 competing implementations)
`ui/primitives/Button`, `ui/Button`, and `Admin/shared/Button` all export a `Button` component with differing APIs. 9 394 raw `<button` occurrences remain unstyled via the canonical system.
- `src/components/ui/Button.tsx` (standalone duplicate)
- `src/components/Admin/shared/Button.tsx:40`
- `src/components/MyWork/IdeaTableTool.tsx:87` (87 raw buttons)

### 6. Row Actions — HIGH (75 % bespoke)
88 files manually implement kebab menus via `MoreVertical`/`MoreHorizontal`. RowActionsMenu is adopted in 29 files but has not been rolled out to the majority of list/table views.
- `src/components/Admin/UnifiedSyncHub.tsx:47 <button` (kebab)
- `src/components/Interview/InterviewHub.tsx:67 <button`

### 7. Token usage — HIGH (pervasive)
45 404 `slate-*` Tailwind hits show the colour system has never been lifted to semantic tokens. 1 670 hardcoded hex values and 1 454 inline `style={{` blocks indicate point-in-time overrides that will not respond to theme changes.

### 8. ModuleMenu3/Tabs — MEDIUM
14 hub files use `ModuleMenu3` correctly. 3 workspace files (`FullPilotWorkspace`, `FullROIWorkspace`, `MegatrendsWorkspace`) implement their own tab bar. 1 142 local `bg-slate-50 dark:bg-navy-900/50` header strips show the panel header pattern is not tokenised.

### 9. Preview Pane — MEDIUM
`TableWithPreviewLayout` is used in 24 files. At least 13 more define `ResizablePanel` locally or build flex+`border-r` splits inline. Manageable but growing.

---

## Quick-win Prioritisation

| Priority | Action | Est. files touched | Impact |
|----------|--------|--------------------|--------|
| P0 | Extract `StatusChip`/`PriorityChip` and sweep 1 513 inline badge spans | ~80 | Consistency + dark-mode correctness |
| P0 | Adopt `LoadingState`/`EmptyState` in the 863 spinner files | ~200 | UX + a11y |
| P0 | Consolidate 3 Button impls → 1; add lint rule banning raw `<button` without className | codebase-wide | API surface |
| P1 | Route all 453 `fixed inset-0` raw modals through `ui/primitives/Modal` | ~60 unique shells | z-index sanity |
| P1 | Extend `RowActionsMenu` to the 88 kebab-menu files | ~60 | Keyboard nav |
| P2 | Migrate raw `<table` to `FilterableTable`/`DataTable` | ~190 | Accessibility |
| P2 | Introduce semantic colour tokens; ban hex literals via Tailwind config | codebase-wide | Theme support |
