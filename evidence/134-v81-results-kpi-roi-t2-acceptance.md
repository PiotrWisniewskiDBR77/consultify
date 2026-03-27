# V8.1 Results / KPI / ROI T2 Acceptance

Date: 2026-03-26
Lane: `Results / KPI / ROI`
Taxonomy: `T2`
Tranche: `Tranche 2`
Decision: `accepted`

## Acceptance basis

The bounded active `T2` packet for `Results / KPI / ROI` is accepted as complete.

Accepted closure points:

1. routed Results entry authority is coherent around `/benefits`, with `/kpi-okr` reduced to a compatibility redirect path
2. governed runtime strip data no longer coexists with synthetic demo KPI or initiative backfill on active results surfaces
3. active ROI portfolio and ROI detail drawer reads now follow governed V8-first seams with compatibility-only fallback
4. active KPI list/report/drawer surfaces now share a governed V8-first KPI catalog seam
5. KPI drawer measurement history and open deviation-case continuity now follow a governed V8-first detail seam
6. active `ResultsHub` and `ResultsSummaryView` no longer depend on standalone legacy KPI catalog reads during normal operation

## Evidence chain

- `docs/product/work-packets/T2_RESULTS_KPI_ROI_CHARTER.md`
- `evidence/126-v81-results-kpi-roi-split-brain-map.md`
- `evidence/127-v81-results-route-canonicalization.md`
- `evidence/128-v81-results-runtime-truth-alignment.md`
- `evidence/129-v81-results-roi-portfolio-v8-parity.md`
- `evidence/130-v81-results-roi-detail-drawer-v8-parity.md`
- `evidence/131-v81-results-kpi-read-seam-v8-parity.md`
- `evidence/132-v81-results-kpi-drawer-detail-v8-parity.md`
- `evidence/133-v81-results-hub-summary-kpi-catalog-parity.md`

## Verification basis

Passed:

- `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx`
- `tests/components/Results/ResultsSummaryView.runtime-truth.test.tsx`
- `tests/components/Results/KPITimeSeriesDrawer.v8-catalog.test.tsx`
- `tests/unit/services/v8-results-api.test.ts`
- `server/src/routes/v8/__tests__/results.routes.test.ts`
- `server/src/services/v8/__tests__/resultsRuntime.test.ts`

## Residual note

Legacy-backed KPI writes, KPI report creation flows, ROI write mutations, and broader operator breadth
still exist in the repository, but they are no longer treated as blockers for this bounded `T2`
results-lane acceptance. They are broader parity work, not absence of a working bounded V8-first
Results lane.
