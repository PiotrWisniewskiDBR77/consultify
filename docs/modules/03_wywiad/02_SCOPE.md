---
module_id: MODULE_INTERVIEW
doc_kind: SCOPE
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Scope — Wywiad / Interview

## Purpose

Define exact ownership boundaries so the system does not duplicate features across modules.

## In Scope (Must)

- Interview template authoring and approval.
- Submission runtime, assignment and response storage.
- Privacy, consent, export and AI governance around responses.
- Insight/export handoff to downstream modules.

Function mapping:

- In scope functions: `WY_MY_ASSIGNMENTS`, `WY_MANAGED_ASSIGNMENTS`, `WY_SESSIONS`, `WY_TEMPLATES`, `WY_INSIGHTS`, `WY_PENDING_REVIEW`.

## Out Of Scope (Must Not)

- Direct creation of initiatives without governed review.
- Analytics dashboards beyond interview evidence unless defined in source docs.
- Silent approval/finalization outside explicit review functions.

## Inputs

- User actions and module objects allowed by current permissions.
- Source documents and raw author requirements listed in `SSOT.md`.
- Cross-module handoffs only through explicit objects/links, not hidden state.

## Outputs

- Governed module objects, proposals, reports, tasks, decisions, artifacts or links as defined by this contract.

## Acceptance Criteria

- [ ] Every new feature request can be classified as in-scope, out-of-scope or cross-module handoff.
- [ ] The module does not become a duplicate owner for another module's canonical object.
