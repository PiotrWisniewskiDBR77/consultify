---
module_id: MODULE_RESULTS
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Rezultaty / Results & Value Realization

## Runtime Behavior (As-Is)

- `/benefits` runs `ResultsHub`, which manages KPI, tracked-initiative, reporting, and ROI views in one runtime.
- Results runtime consumes V8 results dashboard/catalog structures and can fall back to legacy paths when configured.
- `/kpi-okr` remains an active route surface tied to KPI-focused view.

## Function Runtime Breakdown

- `RZ_INITIATIVES_TRACKING`: initiative realization tracking lane in results runtime.
- `RZ_KPI_WORKSPACE`: KPI operations lane (`catalog`, `overview`, `queue`, `scorecards` modes).
- `RZ_REPORTS_WORKSPACE`: results reporting lane.
- `RZ_ROI_TRACKING` and `RZ_ROI_ANALYSIS`: ROI tracking and analysis lanes.
- `RZ_KPI_OKR_ROUTE`: route-level KPI-focused parallel surface.

## State Handling (As-Is)

- `ResultsHub` manages active tab/mode/filter/search state with URL query synchronization.
- Runtime maintains KPI and ROI drawer/modal states, watched KPI state, and manual signal sheet context.
- Loading and source-state (`v8`/`legacy`/`empty`/`showcase`) are explicit runtime flags.

## Security / Tenant / Governance (As-Is)

- Results entities are organization-scoped in V8 API contracts.
- Updates/handoffs to initiative status use explicit helper calls (`initiativeWriteTruth`) and user-triggered interactions.
- No hidden route-level mutation branch exists for results lane.
