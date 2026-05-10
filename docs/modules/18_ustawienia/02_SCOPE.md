---
module_id: MODULE_SETTINGS
doc_kind: SCOPE
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Scope — Ustawienia

## Purpose

Define exact ownership boundaries so the system does not duplicate features across modules.

## In Scope (Must)

- User preferences and profile.
- AI memory controls visible to the user.
- Honest partial/stub state for settings not implemented.
- Deep links to Admin/Organization for tenant-owned controls.
- Function set: `SET_SETTINGS_WORKSPACE`, `SET_POLICY_BOUNDARY_LINKS`.

## Out Of Scope (Must Not)

- Second admin root.
- Silent changes to org-level policies.

## Inputs

- User actions and module objects allowed by current permissions.
- Source documents and raw author requirements listed in `SSOT.md`.
- Cross-module handoffs only through explicit objects/links, not hidden state.

## Outputs

- Governed module objects, proposals, reports, tasks, decisions, artifacts or links as defined by this contract.

## Acceptance Criteria

- [ ] Every new feature request can be classified as in-scope, out-of-scope or cross-module handoff.
- [ ] The module does not become a duplicate owner for another module's canonical object.
