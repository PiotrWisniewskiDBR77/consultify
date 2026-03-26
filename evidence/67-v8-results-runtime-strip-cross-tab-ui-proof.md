# V8 Results runtime strip cross-tab UI proof

Date: 2026-03-25
Environment: staging (`https://stage.consultinity.ai`)
Service: `consultify`
Deployment: `0c3da9d9-0e31-4e17-9670-363f1236e3f9`

## Scope

Broaden Results continuity beyond the summary-only packet by proving that the governed V8 dashboard snapshot remains visibly present in the single canonical command row while operators move across multiple live Results tabs.

## Local verification

- `npx vitest run tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx tests/unit/services/v8-results-api.test.ts --maxWorkers=1 --maxConcurrency=1`

## Live staging proof

Fresh route:

- `https://stage.consultinity.ai/kpi-okr?ts=1774476000`

Observed initial governed request:

- `GET /api/v8/results/dashboard` -> `200`

Visible governed runtime strip on `Summary`:

- `Governed KPIs`
- `Realized ROI`
- `Reconciliation`

After switching to `KPIs`, the same governed runtime strip remained visible in the single command row:

- `Governed KPIs`
- `Realized ROI`
- `Reconciliation`

After switching again to `ROI`, the same governed runtime strip still remained visible:

- `Governed KPIs`
- `Realized ROI`
- `Reconciliation`

Observed continuity boundary on `ROI`:

- `GET /api/benefits/roi/portfolio/summary` -> `200`

## Honest closure read

This does not make the full Results module V8-only.

It does prove that the governed `/api/v8/results/dashboard` slice is now a broader live Results runtime surface, not just a summary-only detail. The live user-facing Results hub now keeps the governed strip visible while operators move across at least:

- `Summary`
- `KPIs`
- `ROI`

The remaining gap is broader KPI/ROI/reconciliation workflow breadth and legacy ROI/list/write continuity, not whether the governed Results truth survives beyond the default tab.
