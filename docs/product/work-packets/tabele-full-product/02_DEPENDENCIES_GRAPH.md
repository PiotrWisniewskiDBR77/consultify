# Dependencies Graph — Table Studio Full Product Program

**Program ID:** `TABELE_FULL_PRODUCT_PROGRAM`
**Status:** `LOCKED — based on CTO Q1 decision`

---

## High-level block graph

```
                       ┌──────────────────────┐
                       │ Foundation Block     │
                       │ (DONE 2026-05-07)    │
                       │ - Tabele lane        │
                       │ - Word-canvas preview │
                       │ - RelationExplain    │
                       │ - Materialization    │
                       │ - P0 ACL fix         │
                       └──────────┬───────────┘
                                  │
                ┌─────────────────┴─────────────────┐
                │                                   │
                ▼                                   ▼
        ┌────────────────┐                  ┌────────────────┐
        │ Block A        │                  │ Block B        │
        │ Template       │ ◄── parallel ──► │ Record         │
        │ Catalog        │                  │ Provenance     │
        │ (Days 1-10)    │                  │ (Days 1-10)    │
        └───────┬────────┘                  └────────┬───────┘
                │                                    │
                └─────────────────┬──────────────────┘
                                  │
                                  ▼
                          ┌───────────────┐
                          │ Barrier Gate  │
                          │ Day 10        │
                          │ A=GO ∧ B=GO   │
                          └───────┬───────┘
                                  │
                                  ▼
                          ┌────────────────┐
                          │ Block C        │
                          │ AI Operator    │
                          │ (Days 11-17)   │
                          └───────┬────────┘
                                  │
                                  ▼
                          ┌────────────────┐
                          │ Block D        │
                          │ Integration &  │
                          │ Evidence       │
                          │ (Days 18-21)   │
                          └───────┬────────┘
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │ PROGRAM CLOSEOUT    │
                       └─────────────────────┘
```

---

## Why A and B can run in parallel

| Surface | Block A touches | Block B touches | Conflict? |
|---|---|---|---|
| `tp_base_templates` | INSERT 30 rows + ALTER TABLE add `status/version/owner` | — | No |
| `tp_records` | — | ALTER TABLE add `confidence_score/validation_status` | No |
| `tp_record_sources` (new) | — | CREATE TABLE | No |
| `tp_fields` | INSERT through new `ALLOWED_FIELD_TYPES` values | — | No |
| `ArtifactModuleHome.tsx` | Add lifecycle filter + new template cards | — | No |
| `MyWork/table/CellRenderer.tsx` | Add new field type renderers | — | No |
| `MyWork/table/GridView.tsx` | — | Add confidence bar + source popover | Different render slots; no merge conflict |
| `TabelePreviewLayout.tsx` | — | Add source/confidence column in records section | Block B owner |
| Backend routes | Add `/templates/:id/approve` etc. | Add `/records/:id/sources` etc. | Different paths |

**Merge protocol:** Both blocks branch from `main`. Block A merges first if both finish on the same day; Block B rebases on top. CI green required on both before merge.

---

## Why C waits for A and B

Block C epics consume both:

- **EPIC-T11 (Table QA Engine):** requires `confidence_score` (B) to flag low-confidence records, requires `template.field_schema` (A) to detect methodological drift.
- **EPIC-T10 (Unified AI Table Editor):** Source-level edits (level 8) write to `tp_record_sources` (B). Methodological-level edits (level 7) compare against approved template schemas (A).
- **EPIC-T12 (Source Pack Builder):** UI surfaces existing record provenance (B) when picking source records to feed into a new generation.

If either A or B exits `GO_WITH_CONSTRAINTS`, Block C cannot start until the constraint is closed.

---

## Why D waits for everything

Block D epics tie the program together:

- **EPIC-T13 (Table → Document/Presentation):** uses templates (A), provenance (B), and AI editor (C) outputs to render reports/decks faithfully.
- **EPIC-T14 (Form-as-intake-app):** form submissions write records with provenance (B) and respect template lifecycle (A); no AI editor needed but evidence pack covers full flow.
- **EPIC-T15 (Evidence & Trials):** Anygravity P0 #2 requires the full product surface to be live.

---

## Risk: dependency creep

If during Block C execution we discover that A or B left a gap, the protocol is:

1. Stop Block C sprint.
2. File a hotfix card under the relevant block (`block-A-template-catalog/sprints/SPRINT_X_HOTFIX.md` or analogous).
3. Resolve hotfix.
4. Resume Block C.
5. Update closeout for the impacted block from `GO` to `GO + hotfix`.

This protocol mirrors the Foundation Block P0 hotfix flow (`TBL-SEC-1`).

---

## Cross-references inside the program

| Block | Reads from |
|---|---|
| A | Foundation Block lane infrastructure, `TemplateService`, `ArtifactModuleHome` |
| B | Foundation Block `TabelePreviewLayout`, `RecordsService`, `tp_records` schema |
| C | A: template metadata; B: provenance + confidence; Foundation: ChatToSchemaService |
| D | A: templates; B: provenance; C: AI Editor + QA Engine; Foundation: lane |

---

## Cross-references outside the program

- `DRD/consultify/docs/product/TABLE_V8_SSOT.md` — V8 contract for tables.
- `DRD/consultify/docs/product/CANVAS_SOURCE_OF_TRUTH.md` — canvas idiom rules.
- `.cursor/SOURCE_OF_TRUTH_INDEX.md` — index of all SoT files.
- `DRD/testy_antygravity/TEST_QUEUE.md` — Anygravity trial queue.
- `DRD/testy_antygravity/ENTERPRISE_AI_FUNCTION_TRIAL_PROCEDURE.md` — Anygravity procedure.
