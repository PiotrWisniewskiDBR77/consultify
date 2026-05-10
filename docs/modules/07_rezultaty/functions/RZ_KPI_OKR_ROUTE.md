---
module_id: MODULE_RESULTS
function_id: RZ_KPI_OKR_ROUTE
function_name: Results — KPI/OKR Route Surface
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — KPI/OKR Route Surface

## 1. Function Identity
- Function ID: `RZ_KPI_OKR_ROUTE`
- Route: `/kpi-okr`
- Runtime anchor: `KpiOkrView`
- Feature state: `partial` (parallel route vs `/benefits`)

## 2-12. Contract Summary
- Purpose: KPI-focused entry path preserved as active parallel surface.
- Inputs: KPI-focused results datasets.
- Outputs: explicit user-driven KPI operations only.
- Boundaries: no hidden bypass of canonical results governance.
- Evidence: `AppRoutes.tsx`, `KpiOkrView.tsx`, module codemap.
- Risk: lane split can create UX inconsistency if parity drifts.
