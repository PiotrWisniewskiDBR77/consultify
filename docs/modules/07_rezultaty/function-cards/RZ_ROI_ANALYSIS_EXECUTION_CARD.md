---
module_id: MODULE_RESULTS
function_id: RZ_ROI_ANALYSIS
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-11
---

# Function Execution Card — RZ_ROI_ANALYSIS

## 1. Metadata

- scope_anchor: `07_rezultaty/RZ_ROI_ANALYSIS`
- primary_module: `07_rezultaty`
- primary_function: `RZ_ROI_ANALYSIS`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: ROI analysis lane contract/evidence for `/benefits` tab `roi_analysis`.
- Out of scope: ROI tracking writes and finance modeling implementation.
- Allowed global docs: `_RAW_TARGET_STATE_2_0_PLAYBOOK_2026-05-10.md`, `_RAW_TARGET_STATE_2_0_SEQUENCE_TRACKER_2026-05-10.md`.

## 3. Dependency Scope

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `RZ_ROI_TRACKING` | impact note for analysis input lineage | editing tracking as primary scope |
| `RZ_REPORTS_WORKSPACE` | impact note for report handoff of insights | editing reporting as primary scope |

## 4. Source Inputs

- `docs/modules/07_rezultaty/functions/RZ_ROI_ANALYSIS.md`
- `docs/modules/07_rezultaty/03_BEHAVIOR.md`
- `docs/modules/07_rezultaty/04_UI_UX.md`
- `docs/modules/07_rezultaty/07_ACCEPTANCE_AND_TESTS.md`

## 5. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `RZ-RAN-P0-001` | `P0` | `docs` | Lock ROI analysis evidence baseline for route/component/API/test. | owner docs acceptance | route/component/API/test | contract/evidence complete |
| `RZ-RAN-P1-001` | `P1` | `test/docs` | Add dedicated source/provenance/no-hidden-write regression for analysis lane. | `RZ-RAN-P0-001` | component/API/test | waiting for P0 close |
| `RZ-RAN-P2-001` | `P2` | `docs` | Enrich degraded-state and confidence/evidence signaling references. | `RZ-RAN-P0-001`,`RZ-RAN-P1-001` | route/component/API/test | waiting for P0 close |

## 6. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| ROI analysis is anchored at `/benefits` tab `roi_analysis`. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/Results/ResultsHub.tsx` | n/a | `tests/navigation/routeMapping.test.ts`, `tests/e2e/smoke/sidebar-navigation.spec.ts` | `PASS` |
| ROI analysis remains advisory and explicit. | `/benefits?tab=roi_analysis` | `ROIAnalysisView` in Results runtime | `src/services/api/v8/results.ts` read contracts | `tests/components/Results/ROIViews.v8-portfolio-summary.test.tsx` | `PASS_WITH_P2` |

## 7. Done Gate

- contract complete: `PASS`
- UI/UX complete: `PASS_WITH_P2`
- evidence complete: `PASS_WITH_P2`
- implementation backlog ready: `PASS`
- owner acceptance: `PENDING`
