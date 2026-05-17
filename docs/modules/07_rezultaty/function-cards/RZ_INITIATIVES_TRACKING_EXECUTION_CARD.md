---
module_id: MODULE_RESULTS
function_id: RZ_INITIATIVES_TRACKING
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-11
---

# Function Execution Card — RZ_INITIATIVES_TRACKING

## 1. Metadata

- scope_anchor: `07_rezultaty/RZ_INITIATIVES_TRACKING`
- primary_module: `07_rezultaty`
- primary_function: `RZ_INITIATIVES_TRACKING`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: initiatives tracking contract/evidence alignment in Results lane (`/benefits`, `results_initiatives`).
- Out of scope: KPI, reports and ROI implementation details.
- Allowed global docs: `_RAW_TARGET_STATE_2_0_PLAYBOOK_2026-05-10.md`, `_RAW_TARGET_STATE_2_0_SEQUENCE_TRACKER_2026-05-10.md`.

## 3. Dependency Scope

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `RZ_KPI_WORKSPACE` | impact note for KPI linkage context | editing KPI scope as primary task |
| `RZ_REPORTS_WORKSPACE` | impact note for reporting handoff | editing reports as primary task |

## 4. Source Inputs

- `docs/modules/07_rezultaty/functions/RZ_INITIATIVES_TRACKING.md`
- `docs/modules/07_rezultaty/03_BEHAVIOR.md`
- `docs/modules/07_rezultaty/04_UI_UX.md`
- `docs/modules/07_rezultaty/07_ACCEPTANCE_AND_TESTS.md`

## 5. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `RZ-INI-P0-001` | `P0` | `docs` | Lock docs evidence baseline (`route + component + API + test`) for initiatives lane. | owner docs acceptance | route/component/API/test | contract/evidence complete |
| `RZ-INI-P1-001` | `P1` | `test/docs` | Add dedicated `results_initiatives` branch assertions and mutation read-back evidence. | `RZ-INI-P0-001` | component/API/test | waiting for P0 close |
| `RZ-INI-P2-001` | `P2` | `docs` | Enrich degraded/empty/error state lineage and cross-module evidence links. | `RZ-INI-P0-001`,`RZ-INI-P1-001` | route/component/API/test | waiting for P0 close |

## 6. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Initiatives lane is anchored in `/benefits`. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/Results/ResultsHub.tsx` | n/a | `tests/navigation/routeMapping.test.ts`, `tests/e2e/smoke/sidebar-navigation.spec.ts` | `PASS` |
| Initiative status mutation is explicit and audited. | `/benefits` user flow | `ResultsHub` status change handler | `src/services/initiativeWriteTruth.ts` | `tests/unit/services/initiativeWriteTruth.test.ts`, `tests/e2e/full-flow.spec.ts` | `PASS_WITH_P2` |

## 7. Done Gate

- contract complete: `PASS`
- UI/UX complete: `PASS_WITH_P2`
- evidence complete: `PASS_WITH_P2`
- implementation backlog ready: `PASS`
- owner acceptance: `PENDING`
