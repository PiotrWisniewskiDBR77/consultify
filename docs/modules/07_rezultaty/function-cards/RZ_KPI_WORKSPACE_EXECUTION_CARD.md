---
module_id: MODULE_RESULTS
function_id: RZ_KPI_WORKSPACE
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-11
---

# Function Execution Card — RZ_KPI_WORKSPACE

## 1. Metadata

- scope_anchor: `07_rezultaty/RZ_KPI_WORKSPACE`
- primary_module: `07_rezultaty`
- primary_function: `RZ_KPI_WORKSPACE`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: KPI workspace contract/evidence alignment for `/benefits` tab `results_kpi`.
- Out of scope: companion `/kpi-okr` route implementation and ROI/report internals.
- Allowed global docs: `_RAW_TARGET_STATE_2_0_PLAYBOOK_2026-05-10.md`, `_RAW_TARGET_STATE_2_0_SEQUENCE_TRACKER_2026-05-10.md`.

## 3. Dependency Scope

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `RZ_KPI_OKR_ROUTE` | impact-only parity note | using companion route as primary scope |
| `RZ_REPORTS_WORKSPACE` | impact note for report handoff | editing reports as primary task |

## 4. Source Inputs

- `docs/modules/07_rezultaty/functions/RZ_KPI_WORKSPACE.md`
- `docs/modules/07_rezultaty/03_BEHAVIOR.md`
- `docs/modules/07_rezultaty/04_UI_UX.md`
- `docs/modules/07_rezultaty/07_ACCEPTANCE_AND_TESTS.md`

## 5. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `RZ-KPI-P0-001` | `P0` | `docs` | Lock route/component/API/test baseline for KPI workspace and mode map. | owner docs acceptance | route/component/API/test | contract/evidence complete |
| `RZ-KPI-P1-001` | `P1` | `test/docs` | Add dedicated regression for `scorecards` branch and mode-depth behavior. | `RZ-KPI-P0-001` | component/test | waiting for P0 close |
| `RZ-KPI-P2-001` | `P2` | `docs` | Enrich degraded/fallback and provenance evidence links. | `RZ-KPI-P0-001`,`RZ-KPI-P1-001` | route/component/API/test | waiting for P0 close |

## 6. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| KPI workspace is in `/benefits` under `results_kpi`. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/Results/ResultsHub.tsx` | `src/services/api/v8/results.ts` | `tests/navigation/routeMapping.test.ts`, `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` | `PASS` |
| KPI writes are explicit and read-back aligned. | `/benefits` user flow | mutation handlers in `ResultsHub` | `createKpiTimeSeriesValue`, `deleteKpi` | `tests/components/Results/KPICreateModal.v8-write.test.tsx`, `tests/unit/services/v8-results-api.test.ts` | `PASS_WITH_P2` |

## 7. Done Gate

- contract complete: `PASS`
- UI/UX complete: `PASS_WITH_P2`
- evidence complete: `PASS_WITH_P2`
- implementation backlog ready: `PASS`
- owner acceptance: `PENDING`
