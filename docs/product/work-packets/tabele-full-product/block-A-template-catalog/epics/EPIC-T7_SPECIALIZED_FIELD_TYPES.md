# EPIC-T7 — Specialized Field Types

**Block:** A — Template Catalog
**Status:** `PLANNED`
**Spec source:** Consultify Table Studio specification, section 5F.
**Owner agent:** A (validators) + B (cell components)

---

## Goal

Add five first-class field types to the Table Platform: `risk_score`, `priority`, `ai_generated_summary`, `ai_classification`, `source_reference`. Each gets a schema validator, default options preset, cell renderer, cell editor, exposure in `AddColumnDialog`. Existing field types remain unchanged.

## Acceptance criteria

- `ALLOWED_FIELD_TYPES` extended with the 5 new entries (no renames).
- `validateFieldType` accepts new types.
- `validateFieldOptions` enforces type-specific rules:
  - `risk_score`: `options.scale ∈ {3, 5, 25}`; default `25` (5×5 matrix).
  - `priority`: `options.levels ∈ ['P0_P1_P2_P3', 'CRITICAL_HIGH_MEDIUM_LOW']`; default `P0_P1_P2_P3`.
  - `ai_generated_summary`: `options.prompt_template` (string), `options.max_chars` (integer ≤ 2000), `options.recompute_on` (array of field IDs).
  - `ai_classification`: `options.classes` (string array, ≥ 2), `options.prompt_template`.
  - `source_reference`: `options.allow_external` (boolean, default false).
- Cell renderer for each type renders correctly in `GridView`, `KanbanView`, `TabelePreviewLayout` records section.
- Cell editor for each type opens an appropriate inline editor:
  - `risk_score`: heat-map matrix grid with hover highlight.
  - `priority`: dropdown with color chips.
  - `ai_generated_summary`: read-only text + "Regenerate" button (writes audit when used).
  - `ai_classification`: dropdown with predicted class auto-selected, manual override allowed.
  - `source_reference`: button "Pick source…" opening source picker (rendered with TODO state until Block B ships `tp_record_sources`).
- `AddColumnDialog` lists 5 new types with descriptions and default options.
- Each cell renderer has a unit test.
- Each validator has a unit test.

## In scope

### Backend

New file `consultify/server/src/services/tablePlatform/SpecializedFieldTypes.ts`:

```ts
export const SPECIALIZED_FIELD_TYPES = [
  'risk_score',
  'priority',
  'ai_generated_summary',
  'ai_classification',
  'source_reference',
] as const;

export const SPECIALIZED_FIELD_DEFAULTS: Record<SpecializedType, FieldOptions>;
export function validateSpecializedField(type, options): { valid: boolean; errors: string[] };
export function defaultOptionsFor(type): FieldOptions;
```

Update `SchemaValidationService.ts`:
- Add `SPECIALIZED_FIELD_TYPES` entries to `ALLOWED_FIELD_TYPES` (currently 28 entries → becomes 33; per S0 finding A-S0-F6).
- Branch in `validateFieldOptions` to call `validateSpecializedField` for new types.
- Add new constant `AI_REGEN_FIELD_TYPES = new Set(['ai_generated_summary', 'ai_classification'])` (separate from `AUTO_FIELD_TYPES` which rejects manual writes; per S0 finding A-S0-F5).
- For AI fields: when `options.aiAuto = true`, recompute via Block C orchestration; manual writes are accepted with audit row noting `manual_override = true`.

### Frontend

New cell component files under `consultify/src/components/MyWork/table/cells/`:
- `RiskScoreCell.tsx` (heat-map renderer + matrix editor)
- `PriorityCell.tsx` (chip renderer + dropdown editor)
- `AiSummaryCell.tsx` (text renderer with sparkle icon + "Regenerate" affordance)
- `AiClassificationCell.tsx` (chip + dropdown editor)
- `SourceReferenceCell.tsx` (link renderer + picker; TODO state until Block B integration)

Update:
- `tableTypes.ts` `ColumnType` union extended with the 5 new strings.
- `CellRenderer.tsx` switch case routes new types to specialized cell components.
- `PlatformCellRenderer.tsx` registers same.
- `AddColumnDialog.tsx` lists new types with i18n labels and descriptions.

### Tests

- `SpecializedFieldTypes.test.ts`: per-type validator suite.
- `RiskScoreCell.test.tsx`, `PriorityCell.test.tsx`, `AiSummaryCell.test.tsx`, `AiClassificationCell.test.tsx`, `SourceReferenceCell.test.tsx`.
- `AddColumnDialog.test.tsx` regression covering new types.

## Out of scope

- Backend AI execution pipeline for `ai_generated_summary` / `ai_classification` recompute (lands in Block C; A only ships the schema and a placeholder service stub).
- `source_reference` actual source picker UI is wired in Block B (this block only ships the cell shell and "TODO: Block B" tooltip).
- Visual heat-map design polish — using DBR77 semantic ramp, no custom colors.

## Default option presets (table)

| Type | Default options |
|---|---|
| `risk_score` | `{ scale: 25, axes: { likelihood: 5, impact: 5 } }` |
| `priority` | `{ levels: 'P0_P1_P2_P3', defaultLevel: 'P2' }` |
| `ai_generated_summary` | `{ prompt_template: 'Summarize record in ≤200 chars', max_chars: 200, recompute_on: [] }` |
| `ai_classification` | `{ classes: ['option_a', 'option_b'], prompt_template: 'Classify the record' }` |
| `source_reference` | `{ allow_external: false }` |

## Cross-block dependencies

- A-XB1: `source_reference` field type points at `tp_record_sources.id` from Block B. Until B deploys, the cell renders a "TODO: Block B" disabled state.
- C-XB1: `ai_generated_summary` and `ai_classification` recompute orchestration lives in Block C `TableAiEditorService`. Block A only ships schema, defaults, audit hooks for manual override.

## Estimated effort

- S3 (1 day): backend validators + defaults + tests.
- S5 (1.5 days): frontend cells + AddColumnDialog wiring + tests.

## Open questions

- Q: Should `priority.defaultLevel` be configurable per template, or per workspace?
  A (CTO): per template (governance rule); workspace-wide override comes later.
- Q: Should `risk_score` heat-map flip colors in dark mode?
  A (CTO): yes, follow existing DBR77 dark-mode token pattern.
