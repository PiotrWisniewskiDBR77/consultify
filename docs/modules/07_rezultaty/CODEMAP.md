---
module_id: MODULE_RESULTS
doc_kind: CODEMAP
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Codemap — Rezultaty / Results & Value Realization

## Route / AppView / Sidebar (As-Is)

- Sidebar entry `MODULE_BENEFITS` maps to `AppView.BENEFITS_REALIZATION` in `menuConfig.ts`.
- Canonical and related routes in `routeConfig.ts`: `/benefits`, `/kpi-okr`.
- Route render map in `AppRoutes.tsx`:
  - `/benefits` -> `ResultsHub`
  - `/kpi-okr` -> `KpiOkrView`

## Main Component Paths (As-Is)

- `src/components/Results/ResultsHub.tsx` — primary results/KPI/ROI runtime.
- `src/views/KpiOkrView.tsx` — legacy/parallel KPI route surface.
- `src/components/Results/*` subviews for KPI catalog, reports, scorecards, ROI analysis and tracking.

## Function Map (As-Is)

| Function | Runtime anchor | Notes |
| --- | --- | --- |
| `RZ_INITIATIVES_TRACKING` | `ResultsHub` tab `results_initiatives` | initiative realization tracking. |
| `RZ_KPI_WORKSPACE` | `ResultsHub` tab `results_kpi` | KPI operations with multiple modes. |
| `RZ_REPORTS_WORKSPACE` | `ResultsHub` tab `results_reports` | value-realization reporting lane. |
| `RZ_ROI_TRACKING` | `ResultsHub` tab `roi` | ROI tracking and assumptions lane. |
| `RZ_ROI_ANALYSIS` | `ResultsHub` tab `roi_analysis` | portfolio ROI analysis lane. |
| `RZ_KPI_OKR_ROUTE` | `KpiOkrView` route `/kpi-okr` | parallel KPI entry route (`partial`). |

## API / Services / Models (Confirmable)

- Shared API usage: `src/services/api.ts`.
- Results contracts: `src/services/api/v8/results.ts`.
- Initiative linkage helper usage in results runtime: `src/services/initiativeWriteTruth.ts`.
- Results domain types in component runtime: `kpiDomain` and related types under `src/components/Results`.

## Test / Evidence References (Confirmable)

- No dedicated `src/components/Results/*test*` files found.

## Known Gaps (As-Is)

- Active route coverage exists, but module-local automated tests for results surfaces are absent (`code_gap`).
- Presence of both `/benefits` and `/kpi-okr` indicates mixed route surfaces for one functional lane (`partial`).
