---
module_id: MODULE_RESULTS
function_id: RZ_ROI_TRACKING
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-11
---

# Function Execution Card — RZ_ROI_TRACKING

## 1. Metadata

- scope_anchor: `07_rezultaty/RZ_ROI_TRACKING`
- primary_module: `07_rezultaty`
- primary_function: `RZ_ROI_TRACKING`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: ROI tracking lane contract/evidence for `/benefits` tab `roi`.
- Out of scope: ROI analysis lane and finance runtime implementation.
- Allowed global docs: `_RAW_TARGET_STATE_2_0_PLAYBOOK_2026-05-10.md`, `_RAW_TARGET_STATE_2_0_SEQUENCE_TRACKER_2026-05-10.md`.

## 3. Dependency Scope

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `RZ_ROI_ANALYSIS` | impact note for analysis handoff | editing analysis as primary scope |
| `08_finanse` | impact-only owner boundary note | changing finance ownership from this scope |

## 4. Source Inputs

- `docs/modules/07_rezultaty/functions/RZ_ROI_TRACKING.md`
- `docs/modules/07_rezultaty/03_BEHAVIOR.md`
- `docs/modules/07_rezultaty/05_DATA_AND_INTEGRATIONS.md`
- `docs/modules/07_rezultaty/07_ACCEPTANCE_AND_TESTS.md`

## 5. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `RZ-ROI-P0-001` | `P0` | `docs` | Lock ROI tracking evidence baseline for route/component/API/test. | owner docs acceptance | route/component/API/test | contract/evidence complete |
| `RZ-ROI-P1-001` | `P1` | `test/docs` | Add dedicated regression for degraded-state and read-back mutation flow. | `RZ-ROI-P0-001` | component/API/test | waiting for P0 close |
| `RZ-ROI-P2-001` | `P2` | `docs` | Enrich assumption lineage and finance handoff evidence links. | `RZ-ROI-P0-001`,`RZ-ROI-P1-001` | route/component/API/test | waiting for P0 close |

## 6. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| ROI tracking is anchored at `/benefits` tab `roi`. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/Results/ResultsHub.tsx` | n/a | `tests/navigation/routeMapping.test.ts`, `tests/e2e/smoke/sidebar-navigation.spec.ts` | `PASS` |
| ROI tracking edits are explicit and not hidden. | `/benefits?tab=roi` | ROI drawer interactions in Results surfaces | `src/services/api/v8/results.ts` | `tests/components/Results/ROIDetailDrawer.v8-detail.test.tsx`, `tests/components/Results/ROIDetailDrawer.v8-assumptions-write.test.tsx` | `PASS_WITH_P2` |

## 7. Done Gate

- contract complete: `PASS`
- UI/UX complete: `PASS_WITH_P2`
- evidence complete: `PASS_WITH_P2`
- implementation backlog ready: `PASS`
- owner acceptance: `PENDING`
