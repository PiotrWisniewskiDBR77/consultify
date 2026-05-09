---
module_id: MODULE_CHAT
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Czat / Teresa Chat Engine

## Route / AppView / Sidebar

- Sidebar label: `Czat`
- Route: `/chat`
- AppView: `AppView.AI_CHAT`
- Routing source: `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`

## Code Ownership Rule

Implementation files must be discovered from the active router/sidebar config before coding. This document is a contract map, not a guarantee that current code is complete.

## Integration Points

- Unified chat shell and conversation runtime.
- Project/workspace context selection, source scope and model/tool governance.
- Attachments, retrieval, citations, memory candidates and source transparency.
- Proposal -> approval -> execution -> audit for actions started from chat.
- Artifact handoff to Outputs, Documents, Tables, Presentations, tasks and decisions.

## Hard Stops

- Do not implement against a missing or guessed route without confirming code.
- Do not create a second module owner for objects listed as out-of-scope in `02_SCOPE.md`.
