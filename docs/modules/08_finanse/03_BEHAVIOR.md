---
module_id: MODULE_FINANCE
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Finanse / Finance & Intelligence

## Runtime Behavior (As-Is)

- Finance lane routes mount `EconomicsView`, which delegates runtime to `FinanceHub`.
- `FinanceHub` manages multiple finance domains (statements, models, analysis, prediction, valuation, investment) with one tabbed runtime.
- Runtime attempts V8 dashboard/data loading and falls back to legacy mode on defined fallback conditions.

## Function Runtime Breakdown

- `FN_STATEMENTS_WORKSPACE`, `FN_MODELS_WORKSPACE`, `FN_ANALYSIS_WORKSPACE`, `FN_PREDICTION_WORKSPACE`, `FN_VALUATION_WORKSPACE`, `FN_INVESTMENT_WORKSPACE`: core tabbed function lanes within `FinanceHub`.
- `FN_FINANCE_DETAIL_ROUTES`: deep-link detail entry routes for statement/model/analysis contexts via `EconomicsView`.

## State Handling (As-Is)

- Hub maintains active tab/view/filter/query/open-document state and preview/detail state.
- Finance lane panel and lane strip states are explicit in runtime for surfaced governance/runtime context.
- Import/create/export flows are modal-based and user-triggered.

## Security / Tenant / Governance (As-Is)

- Feature blocking is checked through policy snapshot and feature-flag hooks.
- Finance actions call shared API clients with authenticated headers/session context.
- No hidden route mutation path is defined; writes are initiated from visible row/actions/modals.
