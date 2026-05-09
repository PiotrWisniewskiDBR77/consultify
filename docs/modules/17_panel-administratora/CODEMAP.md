---
module_id: MODULE_ADMIN_PANEL
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Panel Administratora

## Route / AppView / Sidebar

- Sidebar label: `Panel Administratora`
- Route: `/admin`
- AppView: `AppView.ADMIN`
- Routing source: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`

## Code Ownership Rule

Implementation files must be discovered from the active router/sidebar config before coding. This document is a contract map, not a guarantee that current code is complete.

## Integration Points

- Tenant admin IA, users, roles, settings, integrations, audit and mounted admin sections.
- Inventory-driven real/partial/stub status.

## Hard Stops

- Do not implement against a missing or guessed route without confirming code.
- Do not create a second module owner for objects listed as out-of-scope in `02_SCOPE.md`.
