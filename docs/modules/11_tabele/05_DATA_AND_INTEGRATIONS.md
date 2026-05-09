---
module_id: MODULE_TABLES
doc_kind: DATA
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Data & Integrations — Tabele / Table Studio

## Purpose

Define module objects, integrations and lineage responsibilities.

## Core Objects

- Table artifact, table schema, row, cell, formula, source link, proposal, view, import and export.

## Must

- MUST keep stable identifiers for durable objects.
- MUST preserve source/provenance when objects are generated, imported, exported or converted.
- MUST record integration calls and important transformations with enough metadata for audit.

## Must Not

- MUST NOT duplicate another module's canonical object as an independent source of truth.
- MUST NOT expose raw sensitive payloads where summaries/source links are sufficient.

## Should

- SHOULD prefer links and ownership references over copied data.
- SHOULD make stale or partial data visible to the UI layer.

## Acceptance Criteria

- [ ] Every durable object has owner module, source/provenance and lifecycle state where applicable.
- [ ] Cross-module handoff preserves lineage.
- [ ] Integration failures do not corrupt local canonical state.

## Related Sources

- `DRD/consultify/docs/product/TABLE_V8_SSOT.md`
- `DRD/consultify/docs/product/TABLE_RELATIONAL_SCHEMA_AND_DOCS_WORKFLOW_V8.md`
- `DRD/consultify/docs/product/TABLE_MISSING_CAPABILITIES_MATRIX_V8.md`
- `DRD/consultify/docs/product/TABLE_V8_READINESS_AUDIT.md`
- `DRD/consultify/docs/strategy/TABELE_V8_SSOT.md`
- `DRD/consultify/docs/UI_UX/101_RAW_IDEAS_TABLES_STRUCTURED_THINKING_TABLE_ENGINE_2026-05-09.md`
