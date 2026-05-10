---
module_id: MODULE_TOOLS
doc_kind: SCOPE
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Scope — Narzędzia / Tools

## Purpose

Define exact ownership boundaries so the system does not duplicate features across modules.

## In Scope (Must)

- Tool library, detail pages, sessions and results.
- Licensed assessment and consulting tool catalog patterns.
- Tool output as persistent source object.
- Optional initiative draft handoff with traceability.

Function mapping:

- In scope functions: `NZ_DISCOVERY_LIBRARY`, `NZ_DISCOVERY_SESSIONS`, `NZ_DISCOVERY_OUTPUTS`, `NZ_DISCOVERY_INITIATIVES`, `NZ_ASSESSMENT_HUB`, `NZ_MEGATRENDS_WORKSPACE`.

## Out Of Scope (Must Not)

- Unreviewed direct initiative creation.
- Replacing Interview, Initiatives or Outputs ownership.
- Treating Tools outputs as canonical editable destination instead of handoff references.

## Inputs

- User actions and module objects allowed by current permissions.
- Source documents and raw author requirements listed in `SSOT.md`.
- Cross-module handoffs only through explicit objects/links, not hidden state.

## Outputs

- Governed module objects, proposals, reports, tasks, decisions, artifacts or links as defined by this contract.

## Acceptance Criteria

- [ ] Every new feature request can be classified as in-scope, out-of-scope or cross-module handoff.
- [ ] The module does not become a duplicate owner for another module's canonical object.
