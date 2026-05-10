---
module_id: MODULE_FINANCE
function_id: FN_FINANCE_DETAIL_ROUTES
function_name: Finance — Detail Route Surfaces
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Detail Route Surfaces

## 1. Function Identity
- Function ID: `FN_FINANCE_DETAIL_ROUTES`
- Routes: `/finance/statements/:id`, `/finance/models/:id`, `/finance/analyses/:id`
- Runtime anchor: `EconomicsView` -> `FinanceHub`
- Feature state: `real`

## 2-12. Contract Summary
- Purpose: deep-link into statement/model/analysis detail contexts.
- Inputs: route id params and resolved finance entities.
- Outputs: explicit open/edit/review actions within governed finance runtime.
- Boundaries: detail routes are entry surfaces, not hidden mutation channels.
- Evidence: `AppRoutes.tsx` finance detail routes.
- Risk: deep-link state mismatch if tab/selection sync regresses.
