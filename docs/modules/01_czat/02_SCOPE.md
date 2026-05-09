---
module_id: MODULE_CHAT
doc_kind: SCOPE
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Scope — Czat / Teresa Chat Engine

## Purpose

Define exact ownership boundaries so the system does not duplicate features across modules.

## In Scope (Must)

- Unified chat shell and conversation runtime.
- Project/workspace context selection, source scope and model/tool governance.
- Attachments, retrieval, citations, memory candidates and source transparency.
- Proposal -> approval -> execution -> audit for actions started from chat.
- Artifact handoff to Outputs, Documents, Tables, Presentations, tasks and decisions.

## Out Of Scope (Must Not)

- Silent execution or hidden writes.
- Bypassing tenant, project or source permissions.
- Using chat as an unmanaged dumping ground for every artifact instead of handoff to canonical modules.

## Inputs

- User actions and module objects allowed by current permissions.
- Source documents and raw author requirements listed in `SSOT.md`.
- Cross-module handoffs only through explicit objects/links, not hidden state.

## Outputs

- Governed module objects, proposals, reports, tasks, decisions, artifacts or links as defined by this contract.

## Acceptance Criteria

- [ ] Every new feature request can be classified as in-scope, out-of-scope or cross-module handoff.
- [ ] The module does not become a duplicate owner for another module's canonical object.
