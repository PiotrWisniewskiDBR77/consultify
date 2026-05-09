---
module_id: MODULE_ORGANIZATION
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Organizacja / Organization Context

## Route / AppView / Sidebar

- Sidebar label: `Organizacja`
- Route: `/organization`
- AppView: `AppView.ORGANIZATION`
- Routing source: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`

## Code Ownership Rule

Implementation files must be discovered from the active router/sidebar config before coding. This document is a contract map, not a guarantee that current code is complete.

## Integration Points

- Organization context ingestion, extraction, package/chunking, retrieval, citations and lineage.
- Org/project/user scoped knowledge available to AI under permissions.

## Hard Stops

- Do not implement against a missing or guessed route without confirming code.
- Do not create a second module owner for objects listed as out-of-scope in `02_SCOPE.md`.
