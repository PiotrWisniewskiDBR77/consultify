# Sprint 5 — Specialized Field Types Frontend + MELS Right Rail (Block A)

**Sprint ID:** `A-S5`
**Owner:** Agent B
**Status:** `PLANNED`
**Estimate:** ~2.5 days (cell renderers 1.5 days + MELS right rail / shortcuts / persistence 1.0 day)
**Epics:** EPIC-T7, **EPIC-T16 (D5, D6, D7)**

## Goal

Two sub-streams:

1. **Field types:** Build 5 specialized cell renderers + editors, register them in the cell-renderer switch, expose new types in `AddColumnDialog`. `source_reference` ships with a TODO state until Block B `tp_record_sources` is deployed.
2. **MELS right rail (EPIC-T16):** Build `TabeleRightRail` with module tools (Search records, AI Editor, QA Report, Source Pack, Layout, Share, Analytics) docked into `ExecutiveModuleShell` from S4. Wire keyboard shortcuts (`Cmd/Ctrl+\`, `Cmd/Ctrl+/`, `Cmd/Ctrl+K`, `Cmd/Ctrl+Enter`, `Cmd/Ctrl+Shift+A`). Persist rail widths and collapsed state in localStorage namespaced by module.

## Pre-sprint risk check

A-P4 (heat-map vs DBR77) — visual review mandatory. A-P5 (AI cell ownership clarity) — sparkle icon + tooltip. A-T6 (null cell crash) — explicit null branches in each renderer.

## Deliverables

**Field types (EPIC-T7):**
- 5 cell components with renderer + editor.
- `tableTypes.ts` `ColumnType` union extended.
- `CellRenderer.tsx` and `PlatformCellRenderer.tsx` register new types.
- `AddColumnDialog.tsx` lists new types with descriptions.
- 5 unit tests + 1 `AddColumnDialog.test.tsx` regression.

**MELS right rail + shortcuts + persistence (EPIC-T16, deliverables D5–D7):**
- `consultify/src/components/AIChat/KimiWorkspace/tabele/TabeleRightRail.tsx` (icon strip + side-panels for AI Editor / QA Report / Source Pack / Layout / Share / Analytics).
- `consultify/src/components/shared/ExecutiveModuleShell/shortcuts.ts` (keyboard shortcut registry + `?` help modal contents).
- Persistence already scaffolded in S4 `useRailState.ts` — extend to right rail and verify localStorage keys are module-scoped.
- Snapshot tests for right rail icon strip + side-panel docking.
- Test for shortcut registration / cleanup on unmount.

## Files

### Created
- `consultify/src/components/MyWork/table/cells/RiskScoreCell.tsx`
- `consultify/src/components/MyWork/table/cells/PriorityCell.tsx`
- `consultify/src/components/MyWork/table/cells/AiSummaryCell.tsx`
- `consultify/src/components/MyWork/table/cells/AiClassificationCell.tsx`
- `consultify/src/components/MyWork/table/cells/SourceReferenceCell.tsx`
- `consultify/src/components/AIChat/KimiWorkspace/tabele/TabeleRightRail.tsx`
- `consultify/src/components/shared/ExecutiveModuleShell/shortcuts.ts`
- `tests/components/MyWork/table/cells/RiskScoreCell.test.tsx`
- `tests/components/MyWork/table/cells/PriorityCell.test.tsx`
- `tests/components/MyWork/table/cells/AiSummaryCell.test.tsx`
- `tests/components/MyWork/table/cells/AiClassificationCell.test.tsx`
- `tests/components/MyWork/table/cells/SourceReferenceCell.test.tsx`
- `tests/components/AIChat/KimiWorkspace/tabele/TabeleRightRail.test.tsx`
- `tests/components/shared/ExecutiveModuleShell/shortcuts.test.ts`

### Updated
- `consultify/src/components/MyWork/table/tableTypes.ts` (extend union)
- `consultify/src/components/MyWork/table/CellRenderer.tsx` (register)
- `consultify/src/components/MyWork/table/PlatformCellRenderer.tsx` (register)
- `consultify/src/components/MyWork/table/AddColumnDialog.tsx` (lists new types)
- `consultify/src/components/AIChat/KimiWorkspace/TabeleView.tsx` (wire `TabeleRightRail` into the shell)
- `consultify/public/locales/{en,pl}/translation.json` (~25 keys: 5 type labels + descriptions; ~10 keys MELS shortcuts + right rail labels)

### Untouched
- All Foundation Block files.
- `ViewRouter.tsx`, `TableDataProvider.tsx`, `TableToolbar.tsx`, `TableTabStrip.tsx`.

## Sprint Entry Gate

- [ ] S3 closed `GO` (backend validators available).
- [ ] S4 closed `GO` (lifecycle frontend stable).

## Sprint Exit Gate

- [ ] Frontend typecheck clean.
- [ ] Lint clean.
- [ ] Component tests green.
- [ ] Manual review: 5 cells in GridView + KanbanView + TabelePreviewLayout records section.
- [ ] Manual review: TabeleRightRail icon strip docks correctly into shell; AI Editor / QA / Source Pack reachable in ≤ 2 clicks.
- [ ] Keyboard shortcuts verified (`Cmd+\`, `Cmd+/`, `Cmd+K`, `Cmd+Enter`, `Cmd+Shift+A`); `?` help modal lists them.
- [ ] localStorage rail state persists across reload (manual + test).
- [ ] DBR77 hex scan: 0 hits in new files (cells + right rail + shortcuts).
- [ ] Recommendation: `GO` to S6.

## Realized risks

(filled at exit)

## Daily evidence

(filled per day)
