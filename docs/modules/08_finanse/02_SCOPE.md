---
module_id: MODULE_FINANCE
doc_kind: SCOPE
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Scope — Finanse / Finance & Intelligence

## Purpose

Define exact ownership boundaries so the system does not duplicate features across modules.

## In Scope (Must)

- Financial statements, normalized financial models and analysis.
- Forecasting, valuation, investment decision support and management reporting.
- Optional KPI/Results reconciliation bridge.
- Function set: `FN_STATEMENTS_WORKSPACE`, `FN_MODELS_WORKSPACE`, `FN_ANALYSIS_WORKSPACE`, `FN_PREDICTION_WORKSPACE`, `FN_VALUATION_WORKSPACE`, `FN_INVESTMENT_WORKSPACE`, `FN_FINANCE_DETAIL_ROUTES`.

## Out Of Scope (Must Not)

- Becoming general KPI dashboard.
- Creating unverified numbers without source/evidence.

## Inputs

- User actions and module objects allowed by current permissions.
- Source documents and raw author requirements listed in `SSOT.md`.
- Cross-module handoffs only through explicit objects/links, not hidden state.

## Outputs

- Governed module objects, proposals, reports, tasks, decisions, artifacts or links as defined by this contract.

## Acceptance Criteria

- [ ] Every new feature request can be classified as in-scope, out-of-scope or cross-module handoff.
- [ ] The module does not become a duplicate owner for another module's canonical object.
