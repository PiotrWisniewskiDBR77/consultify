---
module_id: MODULE_TABLES
doc_kind: SCOPE
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Scope — Tabele / Table Studio

## Purpose

Define exact ownership boundaries so the system does not duplicate features across modules.

## In Scope (Must)

- Table schema, rows/cells, provenance, formulas/typed columns, imports, views and AI proposals.
- Decision/idea tables, consulting analysis tables and operational data tables.
- Function set: `TB_EXCELE_PLACEHOLDER`, `TB_TABLE_RUNTIME_TARGET`.

## Out Of Scope (Must Not)

- Spreadsheet replacement without governance.
- Unapproved AI edits to rows/cells.
- Duplicate sidebar entry Tabele Studio as separate module.

## Inputs

- User actions and module objects allowed by current permissions.
- Source documents and raw author requirements listed in `SSOT.md`.
- Cross-module handoffs only through explicit objects/links, not hidden state.

## Outputs

- Governed module objects, proposals, reports, tasks, decisions, artifacts or links as defined by this contract.

## Acceptance Criteria

- [ ] Every new feature request can be classified as in-scope, out-of-scope or cross-module handoff.
- [ ] The module does not become a duplicate owner for another module's canonical object.
