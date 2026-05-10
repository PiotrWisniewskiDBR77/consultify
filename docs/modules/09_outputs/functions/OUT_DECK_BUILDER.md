---
module_id: MODULE_OUTPUTS
function_id: OUT_DECK_BUILDER
function_name: Outputs — Deck Builder
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Deck Builder

## 1. Function Identity
- Function ID: `OUT_DECK_BUILDER`
- Route: `/presentations/builder/:deckId`
- Runtime anchor: `DeckBuilder`
- Feature state: `real`

## 2-12. Contract Summary
- Purpose: edit and finalize presentation decks.
- Inputs: deck id, deck content state, output governance metadata.
- Outputs: explicit save/review/export/share actions.
- Evidence: route mount and deck builder runtime.
- Risk: shared vs internal deck state can drift without regression checks.
