---
module_id: MODULE_INITIATIVES
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Inicjatywy

## Route / AppView / Sidebar

- Sidebar label: `Inicjatywy`
- Route: `/initiatives`
- AppView: `AppView.FULL_STEP2_INITIATIVES`
- Routing source: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`

## Code Ownership Rule

Implementation files must be discovered from the active router/sidebar config before coding. This document is a contract map, not a guarantee that current code is complete.

## Integration Points

- Initiative identity, lifecycle, gates, roles, decisions and planning.
- Source traceability from tools/interview/chat/artifacts.
- Capability-driven UI and status/role CTA matrix.
- Handoff to Execution and Results.

## Hard Stops

- Do not implement against a missing or guessed route without confirming code.
- Do not create a second module owner for objects listed as out-of-scope in `02_SCOPE.md`.
