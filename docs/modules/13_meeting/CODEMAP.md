---
module_id: MODULE_MEETING
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Meeting

## Route / AppView / Sidebar

- Sidebar label: `Meeting`
- Route: `/meeting`
- AppView: `AppView.MEETING`
- Routing source: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`

## Code Ownership Rule

Implementation files must be discovered from the active router/sidebar config before coding. This document is a contract map, not a guarantee that current code is complete.

## Integration Points

- Meeting record, participants, agenda, pre-read, notes, decisions, tasks and follow-up.
- Conversion from meeting outcomes to relevant modules.

## Hard Stops

- Do not implement against a missing or guessed route without confirming code.
- Do not create a second module owner for objects listed as out-of-scope in `02_SCOPE.md`.
