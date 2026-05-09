---
module_id: MODULE_RESULTS
doc_kind: SCOPE
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Scope — Rezultaty / Results & Value Realization

## Purpose

Define exact ownership boundaries so the system does not duplicate features across modules.

## In Scope (Must)

- KPI and scorecard truth.
- Baseline/target/actual/deviation tracking.
- ROI realization, reconciliation and evidence.
- Corrective action loop linked to initiatives/execution/finance.

## Out Of Scope (Must Not)

- Owning financial model calculations that belong in Finance.
- Owning task execution runtime that belongs in Realizacja.

## Inputs

- User actions and module objects allowed by current permissions.
- Source documents and raw author requirements listed in `SSOT.md`.
- Cross-module handoffs only through explicit objects/links, not hidden state.

## Outputs

- Governed module objects, proposals, reports, tasks, decisions, artifacts or links as defined by this contract.

## Acceptance Criteria

- [ ] Every new feature request can be classified as in-scope, out-of-scope or cross-module handoff.
- [ ] The module does not become a duplicate owner for another module's canonical object.
