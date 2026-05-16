---
module_id: MODULE_RESULTS
function_id: RZ_KPI_OKR_ROUTE
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-11
---

# Function Execution Card — RZ_KPI_OKR_ROUTE

## 1. Metadata

- scope_anchor: `07_rezultaty/RZ_KPI_OKR_ROUTE`
- primary_module: `07_rezultaty`
- primary_function: `RZ_KPI_OKR_ROUTE`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: impact-only parity audit for companion route `/kpi-okr`.
- Out of scope: standalone backlog execution; no canonical task IDs in this integration pass.
- Rule: this card exists only to record impact and boundary conditions.

## 3. Dependency Scope

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `RZ_KPI_WORKSPACE` | parity and handoff impact tracking | diverging behavior without owner decision |

## 4. Source Inputs

- `docs/modules/07_rezultaty/functions/RZ_KPI_OKR_ROUTE.md`
- `docs/modules/07_rezultaty/03_BEHAVIOR.md`
- `docs/modules/07_rezultaty/04_UI_UX.md`

## 5. Impact Backlog

| Impact ID | Priority | Description | Evidence target | Status |
| --- | --- | --- | --- | --- |
| `RZ-KOR-IMP-001` | `P1` | Confirm parity of source/provenance and approval posture vs `RZ_KPI_WORKSPACE`. | route/component/test references for `/kpi-okr` parity | `OPEN` |
| `RZ-KOR-IMP-002` | `P2` | Decide long-term route strategy (`parallel` vs `alias`) with owner. | decision log + module contract references | `OPEN` |

## 6. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Companion `/kpi-okr` route remains mounted. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/views/KpiOkrView.tsx` | shared results APIs | `tests/components/Results/KpiOkrView.redirect.test.tsx`, `tests/navigation/routeMapping.test.ts` | `PASS_WITH_P2` |

## 7. Done Gate

- impact scope documented: `PASS`
- no mixed-scope backlog pollution: `PASS`
- owner acceptance: `PENDING`
