---
module_id: MODULE_TABLES
doc_kind: PURPOSE
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Purpose — Tabele / Table Studio

## Purpose

Table Studio jako metadata-first table platform: tabele decyzyjne i operacyjne z provenance, schema, AI proposal workflow, intake forms, QA and conversions.

As-Is realizacja jest ograniczona do funkcji placeholder (`TB_EXCELE_PLACEHOLDER`) z utrzymanym kontraktem docelowego runtime (`TB_TABLE_RUNTIME_TARGET`).

## Must

- MUST solve the job described above for the user-visible module, not only expose implementation internals.
- MUST keep its ownership boundary clear against adjacent modules.
- MUST preserve traceability from source input to output, decision, task or report when work leaves the module.

## Must Not

- Spreadsheet replacement without governance.
- Unapproved AI edits to rows/cells.
- Duplicate sidebar entry Tabele Studio as separate module.

## Should

- SHOULD expose the next useful action rather than forcing users to infer workflow state.
- SHOULD reuse global UI, security and evidence standards instead of inventing module-local variants.

## Acceptance Criteria

- [ ] A new contributor can explain why this module exists from this file alone.
- [ ] The purpose does not conflict with any out-of-scope boundary in `02_SCOPE.md`.
- [ ] Primary source docs listed in `SSOT.md` are linked and readable.

## Related Sources

- `DRD/consultify/docs/product/TABLE_V8_SSOT.md`
- `DRD/consultify/docs/product/TABLE_RELATIONAL_SCHEMA_AND_DOCS_WORKFLOW_V8.md`
- `DRD/consultify/docs/product/TABLE_MISSING_CAPABILITIES_MATRIX_V8.md`
- `DRD/consultify/docs/product/TABLE_V8_READINESS_AUDIT.md`
- `DRD/consultify/docs/strategy/TABELE_V8_SSOT.md`
- `DRD/consultify/docs/UI_UX/101_RAW_IDEAS_TABLES_STRUCTURED_THINKING_TABLE_ENGINE_2026-05-09.md`
