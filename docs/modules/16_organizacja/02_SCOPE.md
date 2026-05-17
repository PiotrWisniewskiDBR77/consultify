---
module_id: MODULE_ORGANIZATION
doc_kind: SCOPE
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Scope — Organizacja / Organization Context

## Purpose

Define exact ownership boundaries so the system does not duplicate features across modules.

## In Scope (Must)

- Organization context ingestion, extraction, package/chunking, retrieval, citations and lineage.
- Org/project/user scoped knowledge available to AI under permissions.
- Function set: `ORG_CONTEXT_WORKSPACE`, `ORG_LEGACY_CONTEXT_BUILDER`.

## Out Of Scope (Must Not)

- Bypassing permissions via AI context.
- Replacing Admin/Settings ownership.

## Inputs

- User actions and module objects allowed by current permissions.
- Source documents and raw author requirements listed in `SSOT.md`.
- Cross-module handoffs only through explicit objects/links, not hidden state.

## Outputs

- Governed module objects, proposals, reports, tasks, decisions, artifacts or links as defined by this contract.

## Acceptance Criteria

- [ ] Every new feature request can be classified as in-scope, out-of-scope or cross-module handoff.
- [ ] The module does not become a duplicate owner for another module's canonical object.
