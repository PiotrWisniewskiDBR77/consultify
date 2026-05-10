---
module_id: MODULE_EXECUTION
doc_kind: SCOPE
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Scope — Realizacja / Implementation & PMO

## Purpose

Define exact ownership boundaries so the system does not duplicate features across modules.

## In Scope (Must)

- Task/decision runtime during delivery.
- Portfolio, reports and manager/control tower surfaces.
- Schedule, baseline, blockers, risk, capacity and recovery interventions.
- Function set: `RL_EXECUTION_PORTFOLIO`, `RL_EXECUTION_REPORTS`, `RL_EXECUTION_MANAGER`, `RL_FULL_EXECUTION_VIEW`, `RL_ROLLOUT_VIEW`.

## Out Of Scope (Must Not)

- Initial initiative planning ownership.
- Final KPI/ROI truth ownership after handoff to Results.

## Inputs

- User actions and module objects allowed by current permissions.
- Source documents and raw author requirements listed in `SSOT.md`.
- Cross-module handoffs only through explicit objects/links, not hidden state.

## Outputs

- Governed module objects, proposals, reports, tasks, decisions, artifacts or links as defined by this contract.

## Acceptance Criteria

- [ ] Every new feature request can be classified as in-scope, out-of-scope or cross-module handoff.
- [ ] The module does not become a duplicate owner for another module's canonical object.
