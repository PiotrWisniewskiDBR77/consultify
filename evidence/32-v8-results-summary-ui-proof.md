# V8 Results Summary UI Proof

Date: 2026-03-25

Environment:
- Railway project `heartfelt-blessing`
- service `consultify`
- environment `staging`
- deployment `3c6ffc14-121b-4822-bdc2-ffb8f98ddaf5`

Authenticated browser session:
- `https://stage.consultinity.ai`
- authenticated `Admin DBR77` browser session
- surface: `Results` via `/kpi-okr`

## What was verified

UI continuity proof:
- the live `Results` module loads on staging in the authenticated browser session after the new deployment
- opening `/kpi-okr` loads the Results shell and summary surface with the current Results assets bundle
- the live Results summary surface now calls the governed V8 dashboard snapshot endpoint:
  - `GET /api/v8/results/dashboard` -> `200`

Observed continuity note:
- the same page load still hydrates broader legacy read paths, including:
  - `GET /api/initiatives/by-status/DONE` -> `200`
  - `GET /api/benefits/kpis` -> `200`
  - `GET /api/benefits/kpi-mappings` -> `200`
  - `GET /api/benefits/roi/portfolio/summary` -> `200`

## Scope note

This proves a real user-facing V8 Results read slice on staging, but not full Results migration:
- the governed V8 slice currently covers the summary dashboard snapshot rendered by the Results surface
- initiative table hydration, KPI tables, ROI tracking, KPI reports, and reconciliation workflows still read or write through legacy Results endpoints
- this capture proves Results summary continuity on the live surface, not full KPI/ROI/reconciliation parity

Conclusion:
- Results no longer lacks dedicated staging UI proof entirely
- the live Results surface now has browser-proven V8 continuity for the governed dashboard snapshot read
- remaining gap is broader list/workflow/write continuity, not absence of any live V8 Results UI path
