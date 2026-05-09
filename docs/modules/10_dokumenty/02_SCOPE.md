---
module_id: MODULE_DOCUMENTS
doc_kind: SCOPE
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Scope — Dokumenty / Document Studio

## Purpose

Define exact ownership boundaries so the system does not duplicate features across modules.

## In Scope (Must)

- Document schema, source pack, narrative plan, template, review/diff/approval and DOCX/PDF export.
- Document as artifact type under Outputs, not separate file storage.

## Out Of Scope (Must Not)

- Competing with MS Word as a generic editor.
- One-shot AI text generation without structure, sources and lifecycle.

## Inputs

- User actions and module objects allowed by current permissions.
- Source documents and raw author requirements listed in `SSOT.md`.
- Cross-module handoffs only through explicit objects/links, not hidden state.

## Outputs

- Governed module objects, proposals, reports, tasks, decisions, artifacts or links as defined by this contract.

## Acceptance Criteria

- [ ] Every new feature request can be classified as in-scope, out-of-scope or cross-module handoff.
- [ ] The module does not become a duplicate owner for another module's canonical object.
