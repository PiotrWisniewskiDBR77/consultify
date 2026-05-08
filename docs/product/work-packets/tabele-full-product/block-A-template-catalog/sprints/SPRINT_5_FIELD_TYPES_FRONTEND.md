# Sprint 5 — Specialized Field Types Frontend + MELS Right Rail (Block A)

**Sprint ID:** `A-S5`
**Owner:** Agent B
**Status:** `FRONTEND COMPLETE — 2026-05-08` (cell renderers + PlatformCellRenderer registration + i18n landed; MELS right-rail / shortcuts / persistence already shipped earlier in EPIC-T16 S2/S4b; AddColumnDialog UX deferred to A-FU-S5b per CTO Q9)
**Estimate:** ~2.5 days planned → ~0.5 day actual (MELS substream pre-shipped, AddColumnDialog deferred)
**Epics:** EPIC-T7, **EPIC-T16 (D5, D6, D7)**

## Goal

Two sub-streams:

1. **Field types:** Build 5 specialized cell renderers + editors, register them in the cell-renderer switch, expose new types in `AddColumnDialog`. `source_reference` ships with a TODO state until Block B `tp_record_sources` is deployed.
2. **MELS right rail (EPIC-T16):** Build `TabeleRightRail` with module tools (Search records, AI Editor, QA Report, Source Pack, Layout, Share, Analytics) docked into `ExecutiveModuleShell` from S4. Wire keyboard shortcuts (`Cmd/Ctrl+\`, `Cmd/Ctrl+/`, `Cmd/Ctrl+K`, `Cmd/Ctrl+Enter`, `Cmd/Ctrl+Shift+A`). Persist rail widths and collapsed state in localStorage namespaced by module.

## Pre-sprint risk check

A-P4 (heat-map vs DBR77) — visual review mandatory. A-P5 (AI cell ownership clarity) — sparkle icon + tooltip. A-T6 (null cell crash) — explicit null branches in each renderer.

## Deliverables

**Field types (EPIC-T7) — landed:**
- [x] `consultify/src/components/MyWork/table/cells/RiskScoreCell.tsx` — read-only chip with severity tone derived from percent of scale; axes (likelihood × impact) surface in tooltip.
- [x] `consultify/src/components/MyWork/table/cells/PriorityCell.tsx` — chip with deterministic tone per preset position; supports both `P0_P1_P2_P3` and `CRITICAL_HIGH_MEDIUM_LOW` presets.
- [x] `consultify/src/components/MyWork/table/cells/AiSummaryCell.tsx` — truncated text with sparkle marker; clamps to hard 2000-char limit; renders manual-override flag with `UserCheck` icon.
- [x] `consultify/src/components/MyWork/table/cells/AiClassificationCell.tsx` — chip with deterministic tone per class index; manual-override surfaced.
- [x] `consultify/src/components/MyWork/table/cells/SourceReferenceCell.tsx` — supports UUID string, `{source_id}` object, and `{external_url}` object (gated by `allow_external`); blocked external URLs render rose chip.
- [x] `consultify/src/components/MyWork/table/cells/index.ts` — barrel.
- [x] `consultify/src/types/tablePlatform.ts` — `FieldType` union extended with 5 specialized types; 5 new `*FieldOptions` interfaces; `FieldOptions` union extended.
- [x] `consultify/src/components/MyWork/table/PlatformCellRenderer.tsx` — registers 5 specialized renderers; forwards `__manual_override` flag from `record.data`.
- [x] `consultify/public/locales/{en,pl}/translation.json` — `tabele.fieldTypes.{risk_score,priority,ai_generated_summary,ai_classification,source_reference}.{label,description}` (10 keys × 2 locales = 20 strings).
- [x] 5 unit tests (`cells/__tests__/*.test.tsx`) + 1 PlatformCellRenderer registration regression (`__tests__/PlatformCellRenderer.specialized.test.tsx`) → 55/55 GREEN.

**Deferred per CTO Q9:**
- `tableTypes.ts` `ColumnType` union extension and `AddColumnDialog.tsx` UX for specialized types → follow-up `A-FU-S5b` (Add-Field UX with option pickers for `risk_score.scale`, `priority.levels`, AI prompt template editor, `allow_external` toggle). Reasoning: legacy ColumnType registry is pre-DBR77 and contains raw hex literals; mixing the two registries would duplicate render paths. Chat-driven schema creation (Foundation Block path) covers 100 % of consulting templates' specialized fields today.

**MELS right rail + shortcuts + persistence (EPIC-T16 D5–D7) — pre-shipped:**
- All deliverables (TabeleRightRail, shortcuts.ts, useRailState rail persistence, snapshot tests) already landed in EPIC-T16 sprints S2 and S4b. See `epics/EPIC-T16_UNIFIED_EXECUTIVE_LAYOUT.md` for evidence.

## Files

### Created (this sprint)
- `consultify/src/components/MyWork/table/cells/RiskScoreCell.tsx`
- `consultify/src/components/MyWork/table/cells/PriorityCell.tsx`
- `consultify/src/components/MyWork/table/cells/AiSummaryCell.tsx`
- `consultify/src/components/MyWork/table/cells/AiClassificationCell.tsx`
- `consultify/src/components/MyWork/table/cells/SourceReferenceCell.tsx`
- `consultify/src/components/MyWork/table/cells/index.ts`
- `consultify/src/components/MyWork/table/cells/__tests__/RiskScoreCell.test.tsx`
- `consultify/src/components/MyWork/table/cells/__tests__/PriorityCell.test.tsx`
- `consultify/src/components/MyWork/table/cells/__tests__/AiSummaryCell.test.tsx`
- `consultify/src/components/MyWork/table/cells/__tests__/AiClassificationCell.test.tsx`
- `consultify/src/components/MyWork/table/cells/__tests__/SourceReferenceCell.test.tsx`
- `consultify/src/components/MyWork/table/__tests__/PlatformCellRenderer.specialized.test.tsx`

### Created (pre-shipped in EPIC-T16)
- `consultify/src/components/shared/ExecutiveModuleShell/shortcuts.ts`
- `consultify/src/components/AIChat/KimiWorkspace/tabeleShell/TabeleRightRail.tsx`
- shortcut + right-rail tests under `__tests__` siblings.

### Updated (this sprint)
- `consultify/src/types/tablePlatform.ts` (extend `FieldType` union + 5 `*FieldOptions` interfaces + `FieldOptions` union)
- `consultify/src/components/MyWork/table/PlatformCellRenderer.tsx` (register 5 specialized renderers; forward `__manual_override`)
- `consultify/public/locales/en/translation.json` (`tabele.fieldTypes.*` block — 10 strings)
- `consultify/public/locales/pl/translation.json` (`tabele.fieldTypes.*` block — 10 strings)

### Deferred to A-FU-S5b
- `consultify/src/components/MyWork/table/tableTypes.ts` (legacy `ColumnType` union extension — out of scope per CTO Q9)
- `consultify/src/components/MyWork/table/CellRenderer.tsx` (legacy registry — out of scope per CTO Q9)
- `consultify/src/components/MyWork/table/AddColumnDialog.tsx` (Add-Field UX with option pickers — separate sprint)

### Untouched
- All Foundation Block files (verified via `git status`).
- `ViewRouter.tsx`, `TableDataProvider.tsx`, `TableToolbar.tsx`, `TableTabStrip.tsx`.
- `TabeleView.tsx` (no rewiring needed — TabeleRightRail mounts via existing MELS shell).

## Sprint Entry Gate

- [ ] S3 closed `GO` (backend validators available).
- [ ] S4 closed `GO` (lifecycle frontend stable).

## Sprint Exit Gate

- [x] Frontend typecheck clean (scoped to A-S5 paths; repo-wide baseline carry-over is documented).
- [x] Lint clean (`npx eslint --fix` then re-verify → 0 errors).
- [x] Component tests green: 55/55 (`npx vitest run src/components/MyWork/table/cells/__tests__ src/components/MyWork/table/__tests__/PlatformCellRenderer.specialized.test.tsx`).
- [x] DBR77 hex scan: 0 hits in `src/components/MyWork/table/cells/` (`Grep '#[0-9a-fA-F]{6}'`).
- [x] Manual review (code-level): 5 cells render through `PlatformCellRenderer.RENDERERS` registry; legacy `CellRenderer` (Idea Table) is intentionally untouched per Q9.
- [x] EPIC-T16 D5–D7 substream pre-shipped (TabeleRightRail, shortcuts, rail persistence, help modal, drag handle) — see `epics/EPIC-T16_UNIFIED_EXECUTIVE_LAYOUT.md` evidence.
- [ ] Visual review: 5 cells in `TabelePreviewLayout` records section + Builder GridView — **DEFERRED to A-S6 QA gate** (requires staging build).
- [x] Recommendation: `GO` to A-S6.

## Realized risks

- A-T6 (null cell crash): mitigated. Each renderer has explicit `value == null || value === ''` branch returning a dash / pending affordance; tested.
- A-P5 (AI cell ownership clarity): mitigated. `Sparkles` icon for AI-derived, `UserCheck` icon for `manual_override = true` (server-audited flag forwarded from `record.data.__manual_override`).
- A-P4 (heat-map vs DBR77): mitigated. All tone classes are Tailwind utilities (`bg-rose-100`, `text-emerald-700`, etc.); 0 raw hex literals.
- New: scope discipline maintained — `tableTypes.ts` ColumnType registry not touched (Q9 lock).

## Daily evidence

- 2026-05-08 16:46 — `npx vitest run` 55/55 tests GREEN (1.21 s).
- 2026-05-08 16:47 — `npx eslint` 0 errors after auto-fix.
- 2026-05-08 16:48 — DBR77 hex scan 0 hits.
