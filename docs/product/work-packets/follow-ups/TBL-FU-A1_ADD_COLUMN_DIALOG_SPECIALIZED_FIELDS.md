# TBL-FU-A1 — AddColumnDialog UX for specialized field types

**Priority:** P1
**Owner:** Frontend lead
**Source:** Block A · A-S5 scope narrow per CTO Q9 (`tabele-full-product/00_CTO_DECISIONS.md`)
**Filed at:** A-S7 closeout, 2026-05-08

## Goal

Surface the 5 specialized field types (`risk_score`, `priority`, `ai_generated_summary`, `ai_classification`, `source_reference`) as creatable column types in the AddField / AddColumn dialog so power users can configure them outside chat-driven schema generation. A-S5 shipped read-only renderers; this follow-up ships the create + configure flow.

## Acceptance Criteria

- AddField dialog (platform-side, parallel to legacy AddColumnDialog) lists the 5 specialized types with description text from `tabele.fieldTypes.*` i18n.
- Type-specific configuration panels:
  - `risk_score` — `scale` picker (3 / 5 / 25) + optional axes inputs (`likelihood`, `impact`).
  - `priority` — preset selector (`P0_P1_P2_P3` vs `CRITICAL_HIGH_MEDIUM_LOW`) + optional default level.
  - `ai_generated_summary` — prompt template textarea + `max_chars` slider + `recompute_on` field-id picker.
  - `ai_classification` — class list editor (2..50 entries, deduped) + prompt template textarea.
  - `source_reference` — `allow_external` toggle.
- Validation mirrors `SpecializedFieldTypes.validateSpecializedField` server-side: invalid options block submit with inline error.
- Component tests for each panel + a single regression test verifying that AddField dialog round-trips a specialized field through the platform `POST /tables/:tableId/fields` endpoint.
- 0 raw hex literals (DBR77 invariant).
- Strictly out-of-scope: legacy `tableTypes.ColumnType` registry (`AddColumnDialog.tsx`) remains untouched per CTO Q9.

## Dependencies

- C-S5 (AI Editor frontend) consumes this dialog when the AI Editor proposes a new specialized field; if this follow-up has not landed by C-S5 kickoff, AI Editor falls back to read-only display of proposed fields.

## Estimate

~1.5 days (5 panels × ~0.2 day + integration + tests).
