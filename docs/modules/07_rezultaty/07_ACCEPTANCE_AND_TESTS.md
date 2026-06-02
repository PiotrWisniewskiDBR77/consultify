---
module_id: MODULE_RESULTS
doc_kind: TESTS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-11
---

# Acceptance & Tests — Rezultaty / Results & Value Realization

## Acceptance Matrix (As-Is Runtime Paths)

| Path / flow | Current runtime evidence | Status |
| --- | --- | --- |
| Sidebar Results -> `/benefits` | `menuConfig.ts` + `AppRoutes.tsx` | pass |
| KPI alternative route `/kpi-okr` | mapped and mounted in routes | pass (`partial` lane split) |
| V8 results dashboard/catalog contracts | `src/services/api/v8/results.ts` | pass |
| Results runtime hub | `src/components/Results/ResultsHub.tsx` | pass |
| Results component regression suites | `tests/components/Results/*` | pass |

## Function-Level Acceptance Matrix

| Function | Acceptance focus | Runtime/code evidence | Status |
| --- | --- | --- | --- |
| `RZ_INITIATIVES_TRACKING` | Initiatives tracking tab is mounted and active | `ResultsHub.tsx` tab logic | pass |
| `RZ_KPI_WORKSPACE` | KPI tab with workspace modes is active | `ResultsHub.tsx` KPI branches + V8 KPI contracts | pass (`pass_with_p2`) |
| `RZ_REPORTS_WORKSPACE` | Reports tab is active/routable and uses explicit approval/evidence posture | `ResultsHub.tsx` reports branches + `ResultsKpiReportsView.tsx` actions | pass_with_p2 |
| `RZ_ROI_TRACKING` | ROI tracking tab is active with explicit Results/Finance ownership boundary | `ResultsHub.tsx` ROI branch + ROI views + linkage governance docs | pass (`pass_with_p2`) |
| `RZ_ROI_ANALYSIS` | ROI analysis tab is active | `ResultsHub.tsx` `roi_analysis` branch | pass |
| `RZ_KPI_OKR_ROUTE` | Parallel KPI route is mounted | `AppRoutes.tsx`, `KpiOkrView.tsx` | pass (`partial`) |

## Confirmed Automated Evidence (As-Is)

- Component-level regression files exist under `tests/components/Results/` (including `ResultsHub.v8-runtime-strip.test.tsx`, ROI and KPI suites).

## Known Gaps / Blockers

- `code_gap`: missing dedicated automated assertion for KPI `scorecards` branch behavior in current `ResultsHub` runtime strip tests.
- `code_gap`: initiatives-tab-specific assertion depth remains indirect in current `ResultsHub` tests.
- `code_gap`: broader KPI/ROI/reporting interaction coverage can be deepened beyond current runtime-strip baseline.

## Gate Vocabulary (Used For Reporting)

- `PASS`, `PASS_WITH_P2`, `BLOCKED_P1`, `INCONCLUSIVE`.

## Function Closeout Evidence — `RZ_INITIATIVES_TRACKING`

Scope anchor: `07_rezultaty/RZ_INITIATIVES_TRACKING`
Work type: `docs-only`

### Evidence Matrix (mandatory route + component + API + test)

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Result |
| --- | --- | --- | --- | --- | --- |
| Initiatives tracking is delivered in `/benefits`. | `src/routes/routeConfig.ts` (`ROUTES.BENEFITS`), `src/routes/AppRoutes.tsx` (`path={ROUTES.BENEFITS}` -> `ResultsHub`) | `src/components/Results/ResultsHub.tsx` mount point | n/a | `tests/navigation/routeMapping.test.ts`, `tests/e2e/smoke/sidebar-navigation.spec.ts` | `PASS` |
| Tab `results_initiatives` is runtime-valid and mapped to initiatives workspace. | `/benefits` route shell | `ResultsHub.tsx` (`VALID_TABS`, default tab fallback, `activeTab === 'results_initiatives'` -> `ResultsInitiativesView`) | `src/services/api/v8/results.ts` (`V8ResultsApi.getDashboard`) | `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` (hub runtime baseline, indirect for this tab) | `PASS_WITH_P2` |
| Initiative status mutation is explicit and read-back refreshed. | user action in `/benefits` tab `results_initiatives` | `ResultsHub.tsx` (`handleInitiativeStatusChange`, toast + refresh) | `src/services/initiativeWriteTruth.ts` (`Api.patch('/initiatives/:id/status')`) | `tests/unit/services/initiativeWriteTruth.test.ts`, `tests/e2e/full-flow.spec.ts` (`PATCH /api/initiatives/:id/status`) | `PASS` |
| Initiatives/value dataset uses governed results contracts with fallback boundaries. | `/benefits` results runtime | `ResultsHub.tsx` data loading and mapping before rendering initiatives lane | `src/services/api/v8/results.ts`, `src/services/initiativeWriteTruth.ts` | `tests/unit/services/v8-results-api.test.ts`, `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` | `PASS` |

### Findings (P0/P1/P2)

- `P0`: none.
- `P1`: none (docs gate not blocked).
- `P2`: dedicated automated assertion for `results_initiatives` tab branch behavior is indirect; current test signal comes from generic `ResultsHub` runtime tests.

### Task Row Readiness (RZ-INI)

| Task ID | Scope anchor | Priority | Status | Notes |
| --- | --- | --- | --- | --- |
| `RZ-INI-P0-001` | `07_rezultaty/RZ_INITIATIVES_TRACKING` | `P0` | `READY` | docs evidence lock for route/component/API/test |
| `RZ-INI-P1-001` | `07_rezultaty/RZ_INITIATIVES_TRACKING` | `P1` | `WAITING_P0` | add dedicated initiatives-tab regression |
| `RZ-INI-P2-001` | `07_rezultaty/RZ_INITIATIVES_TRACKING` | `P2` | `WAITING_P0` | extend lineage/degraded UI evidence depth |

### Gate Verdict

- Module acceptance gate for this function closeout: `APPROVED_FOR_DOCS`.

## KPI Strategy Cycle Output — `RZ_KPI_WORKSPACE` (`gap -> raw -> initiatives -> plan -> approval`)

### Gap map

| Gap area | Baseline evidence | Gap definition | Target state |
| --- | --- | --- | --- |
| Source quality | KPI V8-first + bounded fallback verified | trust posture is not explicit per KPI decision path | operator sees source trust before approval actions |
| KPI lifecycle | mode transitions verified in `ResultsHub` runtime strip | scorecards/lifecycle depth lacks direct dedicated assertion | full lifecycle continuity evidence in direct tests |
| Approvals | explicit user mutations are present | approval-readiness semantics for high-impact KPI actions remain shallow | explicit approval gate semantics with audit posture |
| Evidence trust | matrix exists for route/component/API/test | premium lineage/degraded depth still partial | `PASS` quality evidence depth across critical claims |

### RAW-to-target deltas

- RAW expects KPI workspace as governed operating system, not dashboard shelf.
- RAW expects visible continuity from KPI signal to corrective action and review.
- RAW expects explicit provenance/trust and finance linkage without truth overwrite.
- RAW expects one plan with hard evidence gates and approval decision.

### Initiative backlog (KPI only)

| Task ID | Priority | Initiative scope | Exit gate |
| --- | --- | --- | --- |
| `RZ-KPI-P0-001` | `P0` | docs lock for gap map + raw deltas + unified plan + evidence matrix | `APPROVED_FOR_DOCS` |
| `RZ-KPI-P1-001` | `P1` | direct scorecards/lifecycle regression depth closure | `UNBLOCK_AFTER_P0` |
| `RZ-KPI-P2-001` | `P2` | trust hardening for lineage/degraded/approval evidence depth | `UNBLOCK_AFTER_P1` |

### Unified plan (single sequence)

1. Execute `RZ-KPI-P0-001` (freeze strategy and evidence gates).
2. Execute `RZ-KPI-P1-001` (close direct scorecards/lifecycle evidence).
3. Execute `RZ-KPI-P2-001` (raise trust and governance evidence quality to premium bar).

Dependencies:
- `RZ-KPI-P1-001` -> depends on `RZ-KPI-P0-001`.
- `RZ-KPI-P2-001` -> depends on `RZ-KPI-P0-001`, `RZ-KPI-P1-001`.

### Approval decision

- Docs-cycle decision: `APPROVED_FOR_DOCS`.
- Runtime unblock decision: `UNBLOCK_P1_AFTER_RZ-KPI-P0-001_ACCEPTANCE`.
- `NO_GO` condition: missing mandatory evidence on any critical claim (`route + component + API + test`) -> keep task state `NOT_DONE`.

### Full-Cycle Delivery Decision (gap->raw->initiatives->plan->approval)

| Step | Decision output | Evidence artifact |
| --- | --- | --- |
| A. Gap summary | `P0/P1/P2` gaps classified across behavior/UX/evidence/governance/ownership | `functions/RZ_INITIATIVES_TRACKING.md` sections `12A`, `14` |
| B. RAW analysis | As-Is vs RAW target vs delta mapped and normalized | `functions/RZ_INITIATIVES_TRACKING.md` sections `12`, `12A`; `RAW_TARGET_STATE_2_0_PACKET.md` |
| C. Initiative list | three workstreams bound to fixed IDs (`RZ-INI-P0/1/2`) | `IMPLEMENTATION_TASK_BOARD.md`, function section `13` |
| D. Unified plan | one ordered dependency plan (`P0 -> P1 -> P2`) with acceptance/evidence path | function section `14` + board dependency columns |
| E. Approval + unblock | docs verdict accepted and scope unblocked for docs continuation | function section `15`, board readiness status |

### Unblock Outcome

- Decision: `APPROVED_FOR_DOCS`.
- Unblock: `ENABLED_FOR_SCOPE_ANCHOR` (`07_rezultaty/RZ_INITIATIVES_TRACKING`, docs-only).
- Guard: runtime remains out of scope; `P1/P2` stay dependency-gated behind `RZ-INI-P0-001`.

## Function Closeout Evidence — `RZ_REPORTS_WORKSPACE`

Scope anchor: `07_rezultaty/RZ_REPORTS_WORKSPACE`
Work type: `docs-only`

### Evidence Matrix (mandatory route + component + API + test)

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Result |
| --- | --- | --- | --- | --- | --- |
| Reports workspace is delivered in `/benefits` and uses tab `results_reports`. | `src/routes/routeConfig.ts` (`ROUTES.BENEFITS`), `src/routes/AppRoutes.tsx` (`path={ROUTES.BENEFITS}` -> `ResultsHub`) | `src/components/Results/ResultsHub.tsx` (`VALID_TABS`, `activeTab === 'results_reports'`) | `src/services/api/v8/results.ts` (`getDashboard`) | `tests/navigation/routeMapping.test.ts`, `tests/e2e/smoke/sidebar-navigation.spec.ts`, `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` | `PASS` |
| Reports workspace switches tracked and schedules surfaces without route split. | `/benefits` route shell | `ResultsHub.tsx` (`reportWorkspaceMode`, `ResultsKpiReportsView`, `ResultsReportSchedulesView`) | report APIs consumed by reporting workspace | `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` | `PASS` |
| Report generation/refresh remains explicit and user-triggered (no hidden finalization). | user action path in `/benefits?tab=results_reports` | `src/components/Results/ResultsKpiReportsView.tsx` (explicit create + refresh actions, snapshot hint) | `src/services/api/v8/results.ts` (`createKpiReport`, `refreshKpiReport`) and compatibility refresh endpoint | no dedicated regression proving approval/finalization transition guard | `PASS_WITH_P2` |
| Missing evidence/source/provenance state is explicit before approval posture. | `/benefits` reporting lane | explicit runtime badge/state for `MISSING_EVIDENCE` not confirmed in current component evidence | `docs/product/REPORTING_CANONICAL_TEMPLATES.md` provides canonical source rules | dedicated automated assertion not found | `INCONCLUSIVE` |

### Findings (P0/P1/P2)

- `P0`: none.
- `P1`: no direct automated evidence for approval/finalization guard in report workflow.
- `P2`: explicit runtime indicator for `MISSING_EVIDENCE` posture is not yet confirmed by test evidence.

### Task Row Readiness (RZ-REP)

| Task ID | Scope anchor | Priority | Status | Notes |
| --- | --- | --- | --- | --- |
| `RZ-REP-P0-001` | `07_rezultaty/RZ_REPORTS_WORKSPACE` | `P0` | `READY` | docs evidence lock for route/component/API/test + governance rules |
| `RZ-REP-P1-001` | `07_rezultaty/RZ_REPORTS_WORKSPACE` | `P1` | `WAITING_P0` | add dedicated approval/finalization regression guard |
| `RZ-REP-P2-001` | `07_rezultaty/RZ_REPORTS_WORKSPACE` | `P2` | `WAITING_P0` | add explicit missing-evidence UI/runtime evidence and lineage depth |

### Gate Verdict

- Module acceptance gate for this function closeout: `PASS_WITH_P2`.

### Full-Cycle Delivery Decision (gap->raw->initiatives->plan->approval)

| Step | Decision output | Evidence artifact |
| --- | --- | --- |
| A. Gap summary | ownership/assumptions/read-back/variance gaps classified with `P1/P2` priority | `functions/RZ_ROI_TRACKING.md` sections `12A`, `16`; `RAW_TARGET_STATE_2_0_PACKET.md` sections `3`, `4` |
| B. RAW delta summary | As-Is vs RAW target quality normalized for ROI tracking | `RAW_TARGET_STATE_2_0_PACKET.md` sections `2`, `4` |
| C. Initiative list | fixed 3-bucket initiatives bound to exact IDs (`RZ-ROI-P0/1/2`) | `functions/RZ_ROI_TRACKING.md` section `13`, `IMPLEMENTATION_TASK_BOARD.md` rows `RZ-ROI-*` |
| D. Unified plan | single dependency chain (`P0 -> P1 -> P2`) with gate checkpoints | `functions/RZ_ROI_TRACKING.md` section `14`, packet section `6` |
| E. Approval/unblock | docs approved; runtime hardening unblocked conditionally by task completion | `functions/RZ_ROI_TRACKING.md` section `15`, packet section `7` |

### Unblock Outcome

- Decision: `APPROVED_FOR_DOCS`.
- Unblock: `ENABLED_FOR_SCOPE_ANCHOR` (`07_rezultaty/RZ_ROI_TRACKING`, docs-only).
- Guard: runtime remains out of scope; `RZ-ROI-P1-001` and `RZ-ROI-P2-001` remain dependency-gated.

### Full-Cycle Audit Output — `RZ_ROI_ANALYSIS`

#### A) Audit findings (gap summary)
- `P0`: route/component/API/test baseline for ROI analysis exists and is evidence-backed.
- `P1`: explainability quality contract (mandatory confidence/source/rationale per high-impact deviation) is not yet explicit in acceptance gates.
- `P2`: approval/lock semantics are not yet evidenced as explicit runtime state in ROI analysis lane.

#### B) RAW target fit
- As-Is matches RAW on assumptions/deviation visibility and explicit user actions.
- As-Is is below RAW on explicit approval queues/lock semantics and premium explainability standardization.

#### C) Initiatives backlog (fixed IDs)
| Task ID | Priority | Focus | State |
| --- | --- | --- | --- |
| `RZ-RAN-P0-001` | `P0` | docs closeout + evidence lock | `READY` |
| `RZ-RAN-P1-001` | `P1` | explainability-quality acceptance uplift | `WAITING_P0` |
| `RZ-RAN-P2-001` | `P2` | approval/lock semantics and governance hardening | `WAITING_P0` |

#### D) Unified plan and acceptance
1. `RZ-RAN-P0-001`: complete (docs baseline locked).
2. `RZ-RAN-P1-001`: define and validate explainability acceptance contract.
3. `RZ-RAN-P2-001`: define approval-state contract and unblock checklist.

Completion rule per phase:
- keep `route + component + API + test` evidence for all critical claims.
- unresolved critical claim -> `INCONCLUSIVE` (no downgrade to `PASS` without evidence).

#### E) Approval / unblock
- Audit decision: `PASS_WITH_P2`.
- Unblock: `UNBLOCK_P1_PREP_ONLY`.
- Hard stop: runtime `GO` remains blocked until approval-state evidence exits `INCONCLUSIVE`.
- Runtime unblock posture: `UNBLOCK_P1_PREP_ONLY` (docs closed, runtime proof pending).

### Unified Roadmap Acceptance (RZ-REP)

| Milestone | Linked task | Required evidence (`route + component + API + test`) | Exit gate |
| --- | --- | --- | --- |
| M1: docs gap closure for source/provenance/approval | `RZ-REP-P0-001` | route `/benefits`; components `ResultsHub` + `ResultsKpiReportsView`; API report create/refresh seams; baseline tests for reports lane | `PASS` |
| M2: explicit approval/finalization guard proof | `RZ-REP-P1-001` | route-level report approval flow; component control contract; API approval/finalization seam; dedicated regression against hidden finalization | `PASS` |
| M3: explicit missing-evidence trust model + R1-R4 lineage depth | `RZ-REP-P2-001` | route/component evidence-state matrix; API lineage payload mapping; tests asserting `MISSING_EVIDENCE` visibility and non-approvable behavior | `PASS_WITH_P2` |

### Approval Decision Snapshot

- `RZ-REP-P0-001`: `APPROVED` (docs-only closeout complete).
- `RZ-REP-P1-001`: `APPROVED_TO_START_AFTER_P0` (implementation/proof phase).
- `RZ-REP-P2-001`: `QUEUED_AFTER_P1` (enrichment phase).

## Function Closeout Evidence — `RZ_KPI_WORKSPACE`

Scope anchor: `07_rezultaty/RZ_KPI_WORKSPACE`
Work type: `docs-only`

### Evidence Matrix (mandatory route + component + API + test)

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Result |
| --- | --- | --- | --- | --- | --- |
| KPI workspace is delivered in `/benefits` under tab `results_kpi`. | `src/routes/routeConfig.ts` (`ROUTES.BENEFITS`), `src/routes/AppRoutes.tsx` (`path={ROUTES.BENEFITS}`) | `src/components/Results/ResultsHub.tsx` (`VALID_TABS`, `setActiveTab('results_kpi')`) | `src/services/api/v8/results.ts` (`getDashboard`, `getKpiCatalog`) | `tests/navigation/routeMapping.test.ts`, `tests/e2e/smoke/wave1-module-closeout.spec.ts`, `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` | `PASS` |
| KPI workspace modes (`catalog`, `queue`, `overview`, `scorecards`) are switchable in one runtime surface. | `/benefits` route shell | `ResultsHub.tsx` `kpiWorkspaceMode` branches for KPI mode controls and views | `src/services/api/v8/results.ts` KPI catalog/dashboard contracts used by mode surfaces | `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` (`KPI List`, `Data / Signals`, `Overview` mode assertions) | `PASS` |
| KPI mutation flow is explicit and V8-first with bounded fallback. | user action flow in `/benefits?tab=results_kpi` | `ResultsHub.tsx` delete/create/value-record handlers and refresh read-back | `src/services/api/v8/results.ts` (`deleteKpi`, `createKpiTimeSeriesValue`), `src/services/api.ts` (`/benefits/kpis/:id` fallback) | `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx`, `tests/unit/services/v8-results-api.test.ts` | `PASS` |
| Governed KPI no-backfill and compatibility fallback behavior is enforced. | `/benefits` KPI lane runtime | `ResultsHub.tsx` guarded fallback and empty-state behavior for governed strip | `src/services/api/v8/results.ts`, fallback policy helper in runtime seam | `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` (`does not backfill demo KPI rows`, `falls back... only for bounded compatibility errors`) | `PASS_WITH_P2` |

### Findings (P0/P1/P2)

- `P0`: none.
- `P1`: none (docs gate not blocked).
- `P2`: dedicated direct assertion for KPI `scorecards` branch behavior is not explicit in current test strip.

### Task Row Readiness (RZ-KPI)

| Task ID | Scope anchor | Priority | Status | Notes |
| --- | --- | --- | --- | --- |
| `RZ-KPI-P0-001` | `07_rezultaty/RZ_KPI_WORKSPACE` | `P0` | `READY` | docs evidence lock for route/component/API/test |
| `RZ-KPI-P1-001` | `07_rezultaty/RZ_KPI_WORKSPACE` | `P1` | `WAITING_P0` | add dedicated scorecards-branch regression and mode-depth evidence |
| `RZ-KPI-P2-001` | `07_rezultaty/RZ_KPI_WORKSPACE` | `P2` | `WAITING_P0` | extend degraded/fallback lineage and governance evidence depth |

### Gate Verdict

- Module acceptance gate for this function closeout: `APPROVED_FOR_DOCS`.

## Function Closeout Evidence — `RZ_ROI_ANALYSIS`

Scope anchor: `07_rezultaty/RZ_ROI_ANALYSIS`
Work type: `docs-only`

### Evidence Matrix (mandatory route + component + API + test)

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Result |
| --- | --- | --- | --- | --- | --- |
| ROI analysis is delivered in `/benefits` under tab `roi_analysis`. | `src/routes/routeConfig.ts` (`ROUTES.BENEFITS`), `src/routes/AppRoutes.tsx` (`path={ROUTES.BENEFITS}` -> `ResultsHub`) | `src/components/Results/ResultsHub.tsx` (`VALID_TABS`, `activeTab === 'roi_analysis'`, `ROIAnalysisView` branch) | n/a | `tests/navigation/routeMapping.test.ts`, `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` | `PASS` |
| Assumptions model is explicit and user-triggered (no hidden writes). | user action path in `/benefits?tab=roi_analysis` with detail drawer actions | `src/components/Results/ROIDetailDrawer.tsx` (assumptions editor and save callback) | `src/services/api/v8/results.ts` (`updateRoiInitiativeAssumptions`) with bounded fallback `Api.put('/benefits/roi/:id/assumptions')` | `tests/components/Results/ROIDetailDrawer.v8-assumptions-write.test.tsx` | `PASS` |
| Deviation model is explicit and inspectable through portfolio and initiative views. | `/benefits` ROI analysis lane | `src/components/Results/ROIAnalysisView.tsx` (`variance` totals, `deriveROIStatus`, variance chart/table) and `ROIDetailDrawer.tsx` variance detail | `src/services/api/v8/results.ts` (`getRoiPortfolioSummary`, `getRoiInitiativeDetail`) | `tests/components/Results/ROIViews.v8-portfolio-summary.test.tsx`, `tests/components/Results/ROIDetailDrawer.v8-detail.test.tsx` | `PASS` |
| Review/approval boundary is explicit before ROI claims are treated as approved truth. | ROI analysis review path in `/benefits` | review actions exist (`open detail`, `record actual`, `view history`), but no explicit approval/lock control found | no explicit approval endpoint evidence for ROI analysis lane | no dedicated automated assertion for ROI approval/lock boundary | `INCONCLUSIVE` |

### Findings (P0/P1/P2)

- `P0`: none.
- `P1`: none that block docs closeout.
- `P2`: approval/lock semantics for ROI claims are not yet evidenced in current ROI analysis UI/API/test mapping.

### Task Row Readiness (RZ-RAN)

| Task ID | Scope anchor | Priority | Status | Notes |
| --- | --- | --- | --- | --- |
| `RZ-RAN-P0-001` | `07_rezultaty/RZ_ROI_ANALYSIS` | `P0` | `READY` | docs evidence lock for assumptions/deviations/review model with route/component/API/test mapping |
| `RZ-RAN-P1-001` | `07_rezultaty/RZ_ROI_ANALYSIS` | `P1` | `WAITING_P0` | add dedicated ROI approval/lock boundary regression and explicit no-hidden-approval assertions |
| `RZ-RAN-P2-001` | `07_rezultaty/RZ_ROI_ANALYSIS` | `P2` | `WAITING_P0` | deepen provenance/evidence UI contract and manual review checklist evidence |

### Gate Verdict

- Module acceptance gate for this function closeout: `PASS_WITH_P2`.

## Function Closeout Evidence — `RZ_ROI_TRACKING`

Scope anchor: `07_rezultaty/RZ_ROI_TRACKING`
Work type: `docs-only`

### Evidence Matrix (mandatory route + component + API + test)

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Result |
| --- | --- | --- | --- | --- | --- |
| ROI tracking is delivered in `/benefits` under tab `roi`. | `src/routes/routeConfig.ts` (`ROUTES.BENEFITS`), `src/routes/AppRoutes.tsx` (`path={ROUTES.BENEFITS}` -> `ResultsHub`) | `src/components/Results/ResultsHub.tsx` (`VALID_TABS` includes `roi`, ROI branch mount) | `src/services/api/v8/results.ts` (`getRoiPortfolioSummary`, `getRoiInitiativeDetail`) | `tests/navigation/routeMapping.test.ts`, `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` | `PASS` |
| ROI detail and assumptions/realized workflow are explicit Results runtime actions. | user path in `/benefits?tab=roi` | `ResultsHub.tsx`, `ROITrackingView.tsx`, `ROIDetailDrawer.tsx`, `ROIOpenModal.tsx` | `src/services/api/v8/results.ts` (`updateRoiInitiativeAssumptions`, `createRoiInitiativeRealizedEntry`) | `tests/components/Results/ROIViews.v8-portfolio-summary.test.tsx`, `tests/components/Results/ROIDetailDrawer.v8-detail.test.tsx`, `tests/components/Results/ROIDetailDrawer.v8-assumptions-write.test.tsx` | `PASS` |
| ROI writes are V8-first with bounded fallback only for compatibility errors. | `/benefits` ROI lane runtime context | ROI components keep explicit write actions and fallback-safe behavior | V8 ROI routes + bounded legacy `/benefits/roi/**` fallback in compatibility branch | `tests/components/Results/ROIViews.v8-portfolio-summary.test.tsx`, `tests/components/Results/ROIDetailDrawer.v8-assumptions-write.test.tsx` | `PASS` |
| Results vs Finance ownership boundary is explicit (no ownership leak / no hidden write). | ROI tracking remains under Results route domain (`/benefits`) | ROI components live in Results runtime; no Finance module component mount for writes | ownership split documented in `docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md` (`Results starts reconciliation, Finance resolves finance-side meaning`) | dedicated automated test proving "no direct write to Finance-owned objects" not found | `PASS_WITH_P2` |

### Findings (P0/P1/P2)

- `P0`: none.
- `P1`: none (docs closeout not blocked).
- `P2`: dedicated automated ownership-leak guard (`Results ROI write cannot mutate Finance-owned truth`) is not yet explicit in test suite.

### Task Row Readiness (RZ-ROI)

| Task ID | Scope anchor | Priority | Status | Notes |
| --- | --- | --- | --- | --- |
| `RZ-ROI-P0-001` | `07_rezultaty/RZ_ROI_TRACKING` | `P0` | `READY` | docs evidence lock for route/component/API/test + ownership boundary contract |
| `RZ-ROI-P1-001` | `07_rezultaty/RZ_ROI_TRACKING` | `P1` | `WAITING_P0` | add explicit automated guard for no hidden write / no ownership leak to Finance |
| `RZ-ROI-P2-001` | `07_rezultaty/RZ_ROI_TRACKING` | `P2` | `WAITING_P0` | expand linkage-state evidence matrix (`linked`, `stale`, `unreconciled`) in ROI runtime UX docs/tests |

### Gate Verdict

- Module acceptance gate for this function closeout: `PASS_WITH_P2`.
