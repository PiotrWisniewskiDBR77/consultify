---
module_id: MODULE_MY_WORK
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Moja Praca / My Work

## Route / AppView / Sidebar

- Sidebar label: `Moja Praca`
- Route: `/my-work`
- AppView: `AppView.MY_WORK`
- Routing source: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`

## Code Ownership Rule

Implementation files must be discovered from the active router/sidebar config before coding. This document is a contract map, not a guarantee that current code is complete.

## Integration Points

- Personal home/dashboard blocks.
- Inbox, SLA, assigned work and follow-up surfaces.
- Radar signals, briefings and recommended next moves.
- Notebook and calendar links where they support personal work orchestration.
- Filtered view of artifacts owned by other modules.

## Hard Stops

- Do not implement against a missing or guessed route without confirming code.
- Do not create a second module owner for objects listed as out-of-scope in `02_SCOPE.md`.
