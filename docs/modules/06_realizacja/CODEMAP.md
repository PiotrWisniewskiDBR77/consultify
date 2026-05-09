---
module_id: MODULE_EXECUTION
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Realizacja / Implementation & PMO

## Route / AppView / Sidebar

- Sidebar label: `Realizacja`
- Route: `/execution`
- AppView: `AppView.FULL_STEP5_EXECUTION`
- Routing source: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`

## Code Ownership Rule

Implementation files must be discovered from the active router/sidebar config before coding. This document is a contract map, not a guarantee that current code is complete.

## Integration Points

- Task/decision runtime during delivery.
- Portfolio, reports and manager/control tower surfaces.
- Schedule, baseline, blockers, risk, capacity and recovery interventions.

## Hard Stops

- Do not implement against a missing or guessed route without confirming code.
- Do not create a second module owner for objects listed as out-of-scope in `02_SCOPE.md`.
