# V8 results summary V8-only ROI continuity proof

Date: 2026-03-25
Environment: staging (`https://stage.consultinity.ai`)
Service: `consultify`
Deployment: `bb6556d2-87bf-4ee9-9529-acc511288979`

## Scope

Tighten the existing Results summary continuity packet so the `/kpi-okr` summary surface no longer depends on the legacy ROI portfolio summary fetch just to derive ROI plan/actual badges.

## Shipped path

- removed the redundant legacy `GET /api/benefits/roi/portfolio/summary` fetch from `ResultsSummaryView`
- derived `hasRoiPlan` and `hasRoiRealized` directly from the existing governed `V8ResultsApi.getDashboard()` snapshot
- kept the broader legacy results surfaces out of scope

## Local verification

- `ReadLints` returned no diagnostics for `src/components/Results/ResultsSummaryView.tsx`
- `npx vitest run tests/unit/services/v8-results-api.test.ts --maxWorkers=1 --maxConcurrency=1`

## Live staging proof

Fresh route:

- `https://stage.consultinity.ai/kpi-okr?ts=1774473200`

Observed requests from the live Results summary surface:

- `GET /api/v8/results/dashboard` -> `200`
- `GET /api/initiatives/by-status/DONE` -> `200`
- `GET /api/benefits/kpi-mappings` -> `200`

Observed absence:

- no `GET /api/benefits/roi/portfolio/summary` request was issued during the summary load

## Honest closure read

The Results summary surface still is not fully V8-only, but its ROI badge derivation no longer depends on the legacy ROI portfolio summary endpoint. The governed `/api/v8/results/dashboard` snapshot is now the only ROI-summary source on that screen.
