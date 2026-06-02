---
module_id: MODULE_RESULTS
function_id: RZ_KPI_WORKSPACE
function_name: Results — KPI Workspace
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-11
---

# Function Contract — KPI Workspace

## 1. Function Identity
- Function ID: `RZ_KPI_WORKSPACE`
- Runtime anchor: `ResultsHub` tab `results_kpi`
- Route scope: `/benefits`
- Feature state: `real`
- Scope anchor: `07_rezultaty/RZ_KPI_WORKSPACE`
- Work type for this closeout: `docs-only`
- Canonical source documents:
  - `docs/modules/07_rezultaty/03_BEHAVIOR.md`
  - `docs/modules/07_rezultaty/04_UI_UX.md`
  - `docs/modules/07_rezultaty/06_PERMISSIONS_AND_SECURITY.md`
  - `docs/modules/07_rezultaty/07_ACCEPTANCE_AND_TESTS.md`
  - `docs/product/KPI_FULL_SYSTEM_CANON_V8.md`

## 2. User Job and Business Outcome
- Purpose: operate governed KPI catalog, operator overview, queue triage and scorecard-oriented review inside Results.
- Primary user question: "Ktore KPI wymagaja reakcji teraz i czy ich wartosc jest wiarygodna?"
- Business outcome: one KPI workspace for signal -> interpretation -> action flow without splitting KPI truth across modules.

## 3. Trigger and Entry Points
- Primary route: `/benefits`
- Primary component: `src/components/Results/ResultsHub.tsx`
- Entry state: `tab=results_kpi` is a valid runtime branch in `ResultsHub` with mode transitions.

## 4. UI Component Footprint
- `ResultsHub` tab map includes `results_kpi`.
- KPI workspace modes are visible and switchable in one surface: `catalog` (`KPI List`), `queue` (`Data / Signals`), `overview`, `scorecards`.
- KPI workspace uses KPI-specific surfaces/components without leaving module route (`ResultsKpisTableV3`, `KpiQueueView`, `KpiOverviewView`, scorecards lane).

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: KPI catalog rows, mappings, dashboard scorecard snapshot, KPI time-series mutations and report snapshot data.
- Upstream dependencies:
  - governed results dashboard and KPI catalog contracts,
  - initiative linkages and deviations context,
  - report snapshot layer for KPI review outputs.
- API/service evidence:
  - `src/services/api/v8/results.ts` (`getDashboard`, `getKpiCatalog`, `createKpiTimeSeriesValue`, `deleteKpi`, KPI report endpoints),
  - fallback boundary in `ResultsHub` for bounded compatibility errors (`Api.get('/benefits/kpis')`, `Api.delete('/benefits/kpis/:id')`).

## 6. Outputs and Side Effects
- Output artifacts: KPI list/grid views, queue/overview insight surfaces, scorecard context, KPI report linkages.
- Side effects:
  - explicit KPI mutations (create/update/delete/value record),
  - explicit refresh of dashboard + catalog after mutations,
  - user feedback through visible UI transitions and mutation outcomes.

## 7. Ownership and Handoff Boundaries
- `07_rezultaty` owns KPI operations runtime and KPI truth presentation.
- `05_inicjatywy` provides initiative context linkage but does not replace KPI workspace ownership.
- `08_finanse` provides interpretation linkage only; KPI truth remains in Results.
- Forbidden ownership: no hidden KPI truth mutation, no silent AI write-back to KPI actuals/targets.

## 8. Runtime States and UX Behavior
- Loading: KPI lane waits for governed dashboard/catalog payload and shows active tab/mode context.
- Empty: empty KPI catalog stays explicit (no silent demo backfill in governed strip mode).
- Error: bounded compatibility fallback is explicit (V8-first, legacy only for known fallback statuses).
- Degraded: fallback mode and partial payload posture are visible and must not be treated as complete KPI truth.
- Success: user can switch catalog/queue/overview/scorecards and record KPI updates with read-back refresh.
- Next action guidance: queue and overview modes direct operator to stale/below-target/review-needed KPI handling.

## 9. AI, Source, Evidence, Approval
- AI placement requirement: contextual AI actions stay in Menu 3/right command area, without duplicate canvas controls.
- Source visibility: KPI claims must preserve source-state and governed contract provenance.
- Approval: high-impact KPI decisions/reports are explicit user actions; no hidden approvals.
- Canon alignment: AI may support reasoning but never mutate KPI truth silently (`KPI_FULL_SYSTEM_CANON_V8`).

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence
| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Gate |
| --- | --- | --- | --- | --- | --- |
| `RZ_KPI_WORKSPACE` is anchored in `/benefits` (tab `results_kpi`). | `src/routes/routeConfig.ts` (`ROUTES.BENEFITS='/benefits'`), `src/routes/AppRoutes.tsx` (`path={ROUTES.BENEFITS}`) | `src/components/Results/ResultsHub.tsx` tab declarations and active-tab routing | `src/services/api/v8/results.ts` (`getDashboard`, `getKpiCatalog`) | `tests/navigation/routeMapping.test.ts`, `tests/e2e/smoke/wave1-module-closeout.spec.ts`, `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` | `PASS` |
| KPI workspace exposes governed mode transitions (`catalog`, `queue`, `overview`, `scorecards`) inside one runtime. | `/benefits` route hosts KPI lane without route switch | `ResultsHub.tsx` mode guards and branches for `activeTab === 'results_kpi'` | `src/services/api/v8/results.ts` KPI catalog/dashboard contracts feeding all modes | `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` (mode switches and command-row assertions) | `PASS` |
| KPI mutations are explicit, V8-first and refresh read-back after writes. | user action path in `/benefits?tab=results_kpi` | `ResultsHub.tsx` mutation handlers + refresh sequencing | `src/services/api/v8/results.ts` (`deleteKpi`, `createKpiTimeSeriesValue`), bounded fallback `src/services/api.ts` legacy delete path | `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx`, `tests/unit/services/v8-results-api.test.ts` | `PASS` |
| KPI workspace keeps governed no-backfill and fallback boundaries explicit. | `/benefits` KPI lane runtime context | `ResultsHub.tsx` governed strip behavior and fallback gating | `src/services/api/v8/results.ts`, legacy `/benefits/kpis` fallback usage constrained to compatibility errors | `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` (empty no-backfill + compatibility fallback) | `PASS_WITH_P2` |

## 12. As-Is -> Delta

### As-Is
- KPI workspace is already present in `ResultsHub` with active runtime tab and mode logic.
- V8 KPI contracts and bounded fallback paths exist in service/runtime layers.
- Component and cross-suite tests already cover key KPI workspace runtime behavior.

### Delta Closed In This Pass
- Locked function contract to immutable scope anchor `07_rezultaty/RZ_KPI_WORKSPACE`.
- Added mandatory `route + component + API + test` evidence matrix for KPI closeout gate.
- Synced task-ready rows (`RZ-KPI-P0-001`, `RZ-KPI-P1-001`, `RZ-KPI-P2-001`) for task registry.

## 13. Task Board Ready Rows (RZ-KPI)

| Task ID | Scope anchor | Priority | Status | Change type | Depends on | Evidence | Source card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `RZ-KPI-P0-001` | `07_rezultaty/RZ_KPI_WORKSPACE` | `P0` | `READY` | `docs` | owner acceptance | route `/benefits`; component `ResultsHub` KPI tab + mode branches; API `V8ResultsApi` KPI contracts; tests routeMapping + wave1 closeout smoke + ResultsHub runtime strip | `functions/RZ_KPI_WORKSPACE.md` |
| `RZ-KPI-P1-001` | `07_rezultaty/RZ_KPI_WORKSPACE` | `P1` | `WAITING_P0` | `test/docs` | `RZ-KPI-P0-001` | route `/benefits`; component-level dedicated assertion for `scorecards` branch and KPI-mode transitions; API KPI report refresh path; targeted regression evidence | `functions/RZ_KPI_WORKSPACE.md` |
| `RZ-KPI-P2-001` | `07_rezultaty/RZ_KPI_WORKSPACE` | `P2` | `WAITING_P0` | `docs` | `RZ-KPI-P0-001`,`RZ-KPI-P1-001` | route/component/API/test lineage plus raw evidence links for degraded/fallback UX and governance approval posture | `functions/RZ_KPI_WORKSPACE.md` |

## 12. Open Risks and Change Log

- `P0`: none in docs closeout.
- `P1`: no hard blocker found for docs gate.
- `P2`: direct automated assertion for dedicated `scorecards` branch behavior is not explicit in current KPI workspace test strip and should be added.

## 15. Gate Verdict

- Function docs closeout verdict: `APPROVED_FOR_DOCS`.
- Runtime hardening remains tracked by `RZ-KPI-P1-001` and `RZ-KPI-P2-001`.

## 16. Strategy Cycle (gap -> raw -> initiatives -> plan -> approval)

### A) Gap Map (current baseline)

| Gap area | Current baseline | Required target | Evidence status |
| --- | --- | --- | --- |
| Source quality | V8-first and bounded fallback are defined, but trust posture is not fully explicit per KPI object. | Per-KPI trust posture (`trusted/stale/disputed`) and lineage visibility in workspace decisions. | `PASS_WITH_P2` |
| KPI lifecycle | Catalog/queue/overview runtime exists; `scorecards` semantics are not fully evidenced end-to-end. | Full lifecycle continuity (`definition -> expectation -> measurement -> interpretation -> actionability`) with scorecard continuity evidence. | `PASS_WITH_P2` |
| Approvals | Explicit user mutations exist; approval boundary for high-impact KPI review remains shallow in tests. | Explicit approval checkpoints for KPI high-impact decisions and scorecard commitments. | `PASS_WITH_P2` |
| Evidence trust | Route/component/API/test matrix exists, but premium trust claims are not fully depth-locked. | World-class evidence trust posture with direct tests for scorecards and lineage/degraded paths. | `PASS_WITH_P2` |

### B) RAW -> target interpretation (what client expects above baseline)

- RAW + SSOT expect KPI workspace to be a governed operating system, not only dashboard lane (`KPI_FULL_SYSTEM_CANON_V8.md`).
- Operator workspace must unify `Overview`, `Queue`, `Catalog`, scorecard posture, and explicit transitions without route fork.
- KPI truth must remain in Results; finance remains interpretation layer with governed linkage (no truth overwrite).
- Premium target requires deeper provenance, lifecycle continuity, review gates, and actionable deviation loop.

### C) KPI initiative backlog (P0/P1/P2)

| Task ID | Initiative | Priority | Scope anchor | Exit condition |
| --- | --- | --- | --- | --- |
| `RZ-KPI-P0-001` | Lock world-class KPI docs baseline (gap map + raw deltas + one plan + evidence gates). | `P0` | `07_rezultaty/RZ_KPI_WORKSPACE` | all critical claims have `route + component + API + test` mapping and docs gate is `APPROVED_FOR_DOCS` |
| `RZ-KPI-P1-001` | Close scorecards/lifecycle evidence depth with dedicated regression coverage. | `P1` | `07_rezultaty/RZ_KPI_WORKSPACE` | direct test evidence for scorecards branch and lifecycle transitions |
| `RZ-KPI-P2-001` | Harden trust posture (`lineage`, degraded mode, approval-ready evidence quality). | `P2` | `07_rezultaty/RZ_KPI_WORKSPACE` | explicit trust states and governance evidence matrix upgraded from `PASS_WITH_P2` to `PASS` |

### D) Unified one-plan development order

1. `P0` docs lock (`RZ-KPI-P0-001`) -> freeze gap map, raw-to-target deltas, and evidence gates.
2. `P1` lifecycle/scorecards closure (`RZ-KPI-P1-001`) -> add direct regression for scorecards and mode transitions.
3. `P2` trust hardening (`RZ-KPI-P2-001`) -> elevate lineage/degraded/approval trust evidence to production-grade audit readiness.

Dependencies:
- `RZ-KPI-P1-001` depends on `RZ-KPI-P0-001`.
- `RZ-KPI-P2-001` depends on `RZ-KPI-P0-001` and `RZ-KPI-P1-001`.

### E) Approval / unblock decision

- Current cycle decision: `APPROVED_FOR_DOCS`.
- Runtime unblock decision: `UNBLOCK_P1_WHEN_RZ-KPI-P0-001_ACCEPTED`.
- No `NO_GO` condition at docs layer; remaining gaps are controlled in `P1/P2` backlog.
