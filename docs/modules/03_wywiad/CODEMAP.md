---
module_id: MODULE_INTERVIEW
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Wywiad / Interview

## Route / AppView / Sidebar

- Sidebar label: `Wywiad`
- Route: `/discovery`
- AppView: `AppView.DISCOVERY_CONSULTANT`
- Routing source: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`

## Code Ownership Rule

Implementation files must be discovered from the active router/sidebar config before coding. This document is a contract map, not a guarantee that current code is complete.

## Integration Points

- Interview template authoring and approval.
- Submission runtime, assignment and response storage.
- Privacy, consent, export and AI governance around responses.
- Insight/export handoff to downstream modules.

## Hard Stops

- Do not implement against a missing or guessed route without confirming code.
- Do not create a second module owner for objects listed as out-of-scope in `02_SCOPE.md`.
