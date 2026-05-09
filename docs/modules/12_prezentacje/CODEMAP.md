---
module_id: MODULE_PRESENTATIONS
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Prezentacje / Presentation Studio

## Route / AppView / Sidebar

- Sidebar label: `Prezentacje`
- Route: `/presentations`
- AppView: `AppView.PRESENTATIONS`
- Routing source: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`

## Code Ownership Rule

Implementation files must be discovered from the active router/sidebar config before coding. This document is a contract map, not a guarantee that current code is complete.

## Integration Points

- Deck model, storyline, slide schema, visual system, sources, review workflow and export.
- Decks as Outputs artifacts with format-specific runtime.

## Hard Stops

- Do not implement against a missing or guessed route without confirming code.
- Do not create a second module owner for objects listed as out-of-scope in `02_SCOPE.md`.
