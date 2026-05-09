---
module_id: MODULE_TOOLS
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Narzędzia / Tools

## Route / AppView / Sidebar

- Sidebar label: `Narzędzia`
- Route: `/discovery-tools`
- AppView: `AppView.DISCOVERY_TOOLS`
- Routing source: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`

## Code Ownership Rule

Implementation files must be discovered from the active router/sidebar config before coding. This document is a contract map, not a guarantee that current code is complete.

## Integration Points

- Tool library, detail pages, sessions and results.
- Licensed assessment and consulting tool catalog patterns.
- Tool output as persistent source object.
- Optional initiative draft handoff with traceability.

## Hard Stops

- Do not implement against a missing or guessed route without confirming code.
- Do not create a second module owner for objects listed as out-of-scope in `02_SCOPE.md`.
