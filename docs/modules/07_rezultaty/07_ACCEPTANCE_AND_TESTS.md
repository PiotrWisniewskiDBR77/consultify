---
module_id: MODULE_RESULTS
doc_kind: TESTS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Acceptance & Tests — Rezultaty / Results & Value Realization

## Acceptance Matrix (As-Is Runtime Paths)

| Path / flow | Current runtime evidence | Status |
| --- | --- | --- |
| Sidebar Results -> `/benefits` | `menuConfig.ts` + `AppRoutes.tsx` | pass |
| KPI alternative route `/kpi-okr` | mapped and mounted in routes | pass (`partial` lane split) |
| V8 results dashboard/catalog contracts | `src/services/api/v8/results.ts` | pass |
| Results runtime hub | `src/components/Results/ResultsHub.tsx` | pass |
| Module-local frontend tests in results folder | not found | gap (`code_gap`) |

## Function-Level Acceptance Matrix

| Function | Acceptance focus | Runtime/code evidence | Status |
| --- | --- | --- | --- |
| `RZ_INITIATIVES_TRACKING` | Initiatives tracking tab is mounted and active | `ResultsHub.tsx` tab logic | pass |
| `RZ_KPI_WORKSPACE` | KPI tab with workspace modes is active | `ResultsHub.tsx` KPI branches | pass |
| `RZ_REPORTS_WORKSPACE` | Reports tab is active and routable | `ResultsHub.tsx` reports branches | pass |
| `RZ_ROI_TRACKING` | ROI tracking tab is active | `ResultsHub.tsx` ROI branch + ROI views | pass |
| `RZ_ROI_ANALYSIS` | ROI analysis tab is active | `ResultsHub.tsx` `roi_analysis` branch | pass |
| `RZ_KPI_OKR_ROUTE` | Parallel KPI route is mounted | `AppRoutes.tsx`, `KpiOkrView.tsx` | pass (`partial`) |

## Confirmed Automated Evidence (As-Is)

- No dedicated `src/components/Results/*test*` file found in current tree scan.

## Known Gaps / Blockers

- `code_gap`: missing automated regression tests for KPI/ROI/reporting interactions in results hub.
- `doc_gap`: no module-local UI evidence links in this file yet.

## Gate Vocabulary (Used For Reporting)

- `PASS`, `PASS_WITH_P2`, `BLOCKED_P1`, `INCONCLUSIVE`.
