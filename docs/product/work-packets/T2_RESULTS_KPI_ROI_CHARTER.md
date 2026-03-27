# T2 Charter — Results / KPI / ROI

Date: 2026-03-26
Lane: `Results / KPI / ROI`
Taxonomy: `T2`
Tranche: `Tranche 2`
Status: `done`

## Why now

`Execution / delivery control` is now accepted as the previous active `T2` lane. `Results / KPI / ROI`
is the next highest-value parked candidate because it already has a governed V8 runtime strip,
route/client tests, and clear split-brain around entry URLs and mixed benefits/V8 truth.

## Goal

Promote one bounded results parity slice that reduces mixed truth across:

- results lane URL authority
- results route/auth consistency
- bounded V8-first results runtime continuity

## In scope

1. results lane route/auth consistency
2. split-brain map for results URLs, frontend surfaces, and runtime contracts
3. one bounded results packet at a time
4. tracker/program/evidence updates after each packet

## Explicitly out of scope

1. full KPI/ROI/reconciliation write parity
2. broad merger of legacy `benefits` and V8 `results` data stores
3. standalone `/roi` product redesign
4. unrelated parked `T2` lanes

## Initial bounded packet

Packet 1:

- canonicalize the routed results entry to `/benefits`
- keep `/kpi-okr` only as a compatibility alias
- apply the same protected-route behavior to `/kpi-okr` as `/benefits`

Why this first:

- smallest user-visible split-brain cut
- low-risk
- removes duplicate live entry authority before deeper runtime convergence

## Packet 2

Completed:

- remove synthetic `DEMO_*` fallback from active `ResultsHub` and `ResultsSummaryView`
- preserve governed V8 snapshot/strip visibility while showing a true empty live state
- add regression coverage proving active results surfaces no longer backfill fake KPI/initiative records

Recorded in:

- `evidence/128-v81-results-runtime-truth-alignment.md`

## Packet 3

Completed:

- add V8 parity for the active ROI portfolio summary surface
- move `ROITrackingView` and `ROIAnalysisView` to a V8-first client seam
- keep fallback bounded to compatibility statuses only

Recorded in:

- `evidence/129-v81-results-roi-portfolio-v8-parity.md`

## Packet 4

Completed:

- add V8 parity for the active ROI detail drawer read surface
- move `ROIDetailDrawer` to a V8-first detail seam for variance, assumptions, and realized history
- keep fallback bounded to compatibility statuses only

Recorded in:

- `evidence/130-v81-results-roi-detail-drawer-v8-parity.md`

## Packet 5

Completed:

- add V8 parity for the shared KPI catalog + mappings read surface
- move `OperationalAnalysisView`, `ResultsKpiReportsView`, and `KPITimeSeriesDrawer` to a common V8-first KPI read seam
- keep fallback bounded to compatibility statuses only

Recorded in:

- `evidence/131-v81-results-kpi-read-seam-v8-parity.md`

## Packet 6

Completed:

- add V8 parity for the active KPI drawer time-series and open deviation-case read surface
- move `KPITimeSeriesDrawer` to a governed V8-first detail seam for measurements and deviation continuity
- keep fallback bounded to compatibility statuses only while leaving KPI/deviation writes on legacy paths

Recorded in:

- `evidence/132-v81-results-kpi-drawer-detail-v8-parity.md`

## Packet 7

Completed:

- move `ResultsHub` KPI list hydration onto the shared governed V8 KPI catalog seam
- move `ResultsSummaryView` KPI monitoring hydration onto the same governed V8 catalog seam
- keep fallback bounded to compatibility statuses only and leave broader write flows outside this packet

Recorded in:

- `evidence/133-v81-results-hub-summary-kpi-catalog-parity.md`

## Acceptance decision

1. the bounded active `Results / KPI / ROI` lane is now ready for `T2` acceptance
2. remaining legacy-backed writes and broader operator breadth are treated as broader parity work, not blockers for bounded acceptance
3. acceptance is recorded in `evidence/134-v81-results-kpi-roi-t2-acceptance.md`
