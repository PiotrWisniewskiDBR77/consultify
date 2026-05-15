---
module_id: MODULE_RESULTS
function_id: RZ_REPORTS_WORKSPACE
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-11
---

# Function Execution Card — RZ_REPORTS_WORKSPACE

## 1. Metadata

- scope_anchor: `07_rezultaty/RZ_REPORTS_WORKSPACE`
- primary_module: `07_rezultaty`
- primary_function: `RZ_REPORTS_WORKSPACE`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: reports workspace contract/evidence alignment for `/benefits` tab `results_reports`.
- Out of scope: KPI runtime implementation and ROI runtime implementation.
- Allowed global docs: `_RAW_TARGET_STATE_2_0_PLAYBOOK_2026-05-10.md`, `_RAW_TARGET_STATE_2_0_SEQUENCE_TRACKER_2026-05-10.md`.

## 3. Dependency Scope

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `RZ_KPI_WORKSPACE` | impact note for KPI report input context | editing KPI as primary scope |
| `RZ_ROI_ANALYSIS` | impact note for ROI insight handoff to reports | editing ROI analysis as primary scope |

## 4. Source Inputs

- `docs/modules/07_rezultaty/functions/RZ_REPORTS_WORKSPACE.md`
- `docs/modules/07_rezultaty/04_UI_UX.md`
- `docs/modules/07_rezultaty/05_DATA_AND_INTEGRATIONS.md`
- `docs/modules/07_rezultaty/07_ACCEPTANCE_AND_TESTS.md`

## 5. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `RZ-REP-P0-001` | `P0` | `docs` | Lock reports lane evidence baseline and approval posture contract. | owner docs acceptance | route/component/API/test | contract/evidence complete |
| `RZ-REP-P1-001` | `P1` | `test/docs` | Add explicit regression for approval/finalization guard and no-hidden-finalization path. | `RZ-REP-P0-001` | component/API/test | waiting for P0 close |
| `RZ-REP-P2-001` | `P2` | `docs` | Enrich `MISSING_EVIDENCE` and provenance-depth evidence per report family. | `RZ-REP-P0-001`,`RZ-REP-P1-001` | route/component/API/test | waiting for P0 close |

## 6. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Reports workspace is anchored at `/benefits` (`results_reports`). | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/Results/ResultsHub.tsx` | `src/services/api/v8/results.ts` | `tests/navigation/routeMapping.test.ts`, `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` | `PASS` |
| Report create/refresh stays explicit and reviewable. | `/benefits` reporting flow | `src/components/Results/ResultsKpiReportsView.tsx` | `createKpiReport`, `refreshKpiReport` | component strip baseline; dedicated approval regression pending | `PASS_WITH_P2` |

## 7. Done Gate

- contract complete: `PASS`
- UI/UX complete: `PASS_WITH_P2`
- evidence complete: `PASS_WITH_P2`
- implementation backlog ready: `PASS`
- owner acceptance: `PENDING`
