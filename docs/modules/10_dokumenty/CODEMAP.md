---
module_id: MODULE_DOCUMENTS
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Dokumenty / Document Studio

## Route / AppView / Sidebar

- Sidebar label: `Dokumenty`
- Route: `/documents`
- AppView: `AppView.DOCUMENTS`
- Routing source: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`

## Code Ownership Rule

Implementation files must be discovered from the active router/sidebar config before coding. This document is a contract map, not a guarantee that current code is complete.

## Integration Points

- Document schema, source pack, narrative plan, template, review/diff/approval and DOCX/PDF export.
- Document as artifact type under Outputs, not separate file storage.

## Hard Stops

- Do not implement against a missing or guessed route without confirming code.
- Do not create a second module owner for objects listed as out-of-scope in `02_SCOPE.md`.
