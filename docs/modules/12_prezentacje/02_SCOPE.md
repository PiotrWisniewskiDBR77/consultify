---
module_id: MODULE_PRESENTATIONS
doc_kind: SCOPE
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Scope — Prezentacje / Presentation Studio

## Purpose

Define exact ownership boundaries so the system does not duplicate features across modules.

## In Scope (Must)

- Deck model, storyline, slide schema, visual system, sources, review workflow and export.
- Decks as Outputs artifacts with format-specific runtime.

## Out Of Scope (Must Not)

- Simple PowerPoint clone.
- One-shot slide generator without governance.

## Inputs

- User actions and module objects allowed by current permissions.
- Source documents and raw author requirements listed in `SSOT.md`.
- Cross-module handoffs only through explicit objects/links, not hidden state.

## Outputs

- Governed module objects, proposals, reports, tasks, decisions, artifacts or links as defined by this contract.

## Acceptance Criteria

- [ ] Every new feature request can be classified as in-scope, out-of-scope or cross-module handoff.
- [ ] The module does not become a duplicate owner for another module's canonical object.
