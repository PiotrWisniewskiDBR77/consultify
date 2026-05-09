---
module_id: MODULE_TABLES
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Tabele / Table Studio

## Purpose

Describe runtime behavior that must remain true across UI, backend and AI workflows.

## Must

- MUST treat table as governed artifact with schema, source and version.
- MUST use AI proposal -> diff -> approve for generated rows/cell edits.
- MUST preserve row/cell provenance and confidence where AI/research contributes.

## Must Not

- MUST NOT silently mutate high-impact objects.
- MUST NOT show fake success, hide blocking errors or leave users in infinite loading states.
- MUST NOT bypass source, role, approval or tenant constraints for convenience.

## Should

- SHOULD expose recovery paths for failed or degraded states.
- SHOULD make AI-generated proposals reviewable before they become durable state.

## Acceptance Criteria

- [ ] Main happy path can be executed end-to-end with visible state transitions.
- [ ] Error/degraded/empty states are explicit and recoverable.
- [ ] Any AI or automation action is auditable and approval-aware.

## Related Sources

- `DRD/consultify/docs/product/TABLE_V8_SSOT.md`
- `DRD/consultify/docs/product/TABLE_RELATIONAL_SCHEMA_AND_DOCS_WORKFLOW_V8.md`
- `DRD/consultify/docs/product/TABLE_MISSING_CAPABILITIES_MATRIX_V8.md`
- `DRD/consultify/docs/product/TABLE_V8_READINESS_AUDIT.md`
- `DRD/consultify/docs/strategy/TABELE_V8_SSOT.md`
- `DRD/consultify/docs/UI_UX/101_RAW_IDEAS_TABLES_STRUCTURED_THINKING_TABLE_ENGINE_2026-05-09.md`
