---
module_id: MODULE_TABLES
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Tabele / Table Studio

## Route / AppView / Sidebar

- Sidebar label: `Tabele`
- Route: `/tables`
- AppView: `AppView.TABLES`
- Routing source: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`

## Code Ownership Rule

Implementation files must be discovered from the active router/sidebar config before coding. This document is a contract map, not a guarantee that current code is complete.

## Integration Points

- Table schema, rows/cells, provenance, formulas/typed columns, imports, views and AI proposals.
- Decision/idea tables, consulting analysis tables and operational data tables.

## Hard Stops

- Do not implement against a missing or guessed route without confirming code.
- Do not create a second module owner for objects listed as out-of-scope in `02_SCOPE.md`.
