---
module_id: MODULE_RESULTS
doc_kind: UI_UX
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-11
---

# UI/UX — Rezultaty / Results & Value Realization

## 1. Main Screen

As-Is: `/benefits` renders `ResultsHub` with module tabs for initiatives, KPI surfaces, reports and ROI. `/kpi-okr` remains available for KPI-focused entry. The screen job is value realization review through ModuleHub controls, KPI/ROI drawers and modals.

## 2. Runtime States

- Loading: results runtime must show loading/source-state chips while KPI, ROI or report data loads.
- Empty: no-KPI/no-result/filter-empty states must explain whether data is absent, filtered out or not yet linked.
- Error: toast-driven handling and guarded fallbacks must surface failed loads/mutations.
- Degraded: partial KPI/ROI/report data must be visible as degraded and not used as complete truth.
- Success: updates, linked status operations and report refreshes must confirm what changed and what to review next.

## 3. Menu 2 / Menu 3 Contract

Menu 2 keeps module-level navigation. Menu 3 is the Results command/filter bar or active view control row for the selected tab, KPI, ROI or report context.

## 4. AI Actions Placement

Contextual AI analysis for KPI, ROI or value realization must live in Menu 3/right-side command placement or selected record controls. The route/canvas must not duplicate the same AI action.

## 5. Next Action Guidance

Results UX must tell the user whether to connect data, inspect KPI evidence, update tracking, review ROI assumptions, retry loading or export/report approved results.

## 6. Source / Evidence / Provenance

KPI, ROI, value claims and reports must show source-state, linked initiative/report context, assumptions and evidence. Missing or partial evidence must be explicit.

## 7. Approval / Diff / Review

High-impact tracking updates, linked status operations and generated value reports must be explicit user actions. Final KPI/ROI claims require review/approval before presentation as approved truth.

## 8. Anti-Patterns

- KPI/ROI numbers without assumptions or source-state.
- Partial data presented as complete success.
- Duplicate AI controls in canvas and Menu 3.
- Silent linked status updates.
- Error hidden behind stale dashboards.

## 9. As-Is Gaps

- Existing docs confirm source-state chips, dedicated degraded branches and explicit operations, but not every KPI/ROI claim's provenance UI.
- Approval/diff behavior for generated reports and linked status operations needs runtime validation.

## 10. Acceptance Criteria

- `/benefits` renders `ResultsHub`; `/kpi-okr` remains KPI-focused.
- Loading, empty, error, degraded and success states are explicit and actionable.
- AI analysis uses Menu 3/right-side placement without duplication.
- KPI/ROI/reports expose sources, assumptions and evidence.
- High-impact results operations require review/approval.

## 11. Function Annex — Results Functions

| Function ID | Function | Entry / Route | As-Is state | UI Component Footprint (key) | Contract |
| --- | --- | --- | --- | --- | --- |
| `RZ_INITIATIVES_TRACKING` | Initiatives Tracking | `/benefits` (tab `results_initiatives`) | real | initiatives workspace in `ResultsHub` | `functions/RZ_INITIATIVES_TRACKING.md` |
| `RZ_KPI_WORKSPACE` | KPI Workspace | `/benefits` (tab `results_kpi`) | real | KPI catalog/overview/queue/scorecards in `ResultsHub` | `functions/RZ_KPI_WORKSPACE.md` |
| `RZ_REPORTS_WORKSPACE` | Reports Workspace | `/benefits` (tab `results_reports`) | real | reporting workspace in `ResultsHub` | `functions/RZ_REPORTS_WORKSPACE.md` |
| `RZ_ROI_TRACKING` | ROI Tracking | `/benefits` (tab `roi`) | real | ROI tracking views/drawers in results runtime | `functions/RZ_ROI_TRACKING.md` |
| `RZ_ROI_ANALYSIS` | ROI Analysis | `/benefits` (tab `roi_analysis`) | real | `ROIAnalysisView` in results runtime | `functions/RZ_ROI_ANALYSIS.md` |
| `RZ_KPI_OKR_ROUTE` | KPI/OKR Route Surface | `/kpi-okr` | partial | `KpiOkrView` route-level KPI surface | `functions/RZ_KPI_OKR_ROUTE.md` |

## 12. Closeout Delta — `RZ_INITIATIVES_TRACKING`

### As-Is
- `/benefits` renders `ResultsHub` and includes the `results_initiatives` tab branch.
- Initiatives lane renders `ResultsInitiativesView` with explicit status-change action.
- Status writes are explicit and user-triggered from the initiatives lane.

### Delta Closed (docs-only)
- Locked UI/UX contract for scope anchor `07_rezultaty/RZ_INITIATIVES_TRACKING`.
- Added route/component/API/test evidence alignment for initiative tracking claims.
- Synced task row readiness for `RZ-INI-P0-001`, `RZ-INI-P1-001`, `RZ-INI-P2-001`.

### Critical Evidence (route + component + API + test)

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Initiatives tracking is a `/benefits` lane and not a separate route. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/Results/ResultsHub.tsx` | n/a | `tests/navigation/routeMapping.test.ts`, `tests/e2e/smoke/sidebar-navigation.spec.ts` | `pass` |
| `results_initiatives` branch is rendered in `ResultsHub`. | `/benefits` mount in `AppRoutes` | `ResultsHub.tsx` (`VALID_TABS`, fallback tab, `ResultsInitiativesView` branch) | `src/services/api/v8/results.ts` (`getDashboard` snapshot inputs) | `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` (indirect ResultsHub runtime baseline) | `pass_with_p2` |
| Initiative status updates are explicit and visible. | `/benefits` user action flow | `ResultsHub.tsx` (`handleInitiativeStatusChange`, toast feedback) | `src/services/initiativeWriteTruth.ts` (`Api.patch('/initiatives/:id/status')`) | `tests/unit/services/initiativeWriteTruth.test.ts`, `tests/e2e/full-flow.spec.ts` | `pass` |

### Gate
- Docs closeout gate for this function in UI/UX layer: `APPROVED_FOR_DOCS`.

## 16. KPI Workspace Strategy Closeout (gap -> raw -> initiatives -> plan -> approval)

### Gap map (UI/UX perspective)

| Gap | Baseline | Target posture | Status |
| --- | --- | --- | --- |
| Source quality visibility | source-state exists but trust depth is limited in KPI workspace decisions | visible trust posture (`trusted/stale/disputed`) in key KPI operator surfaces | `PASS_WITH_P2` |
| Lifecycle continuity | mode transitions are present, scorecards branch depth is not fully test-locked | explicit continuity across `catalog -> queue -> overview -> scorecards` | `PASS_WITH_P2` |
| Approval readiness | explicit user writes are present, high-impact KPI approval posture is shallow | explicit review checkpoints before KPI claims become approved truth | `PASS_WITH_P2` |
| Evidence trust depth | baseline evidence exists for route/component/API/test | premium-grade evidence depth for degraded and lineage claims | `PASS_WITH_P2` |

### RAW-to-target delta (client expectation above baseline)

- RAW/SSOT expect KPI to run as governed operating layer, not passive dashboard.
- Operator must move from signal to action in one surface and keep provenance visible.
- Scorecards/goals semantics must be represented as explicit managed layer, not optional UI branch.
- Finance linkage remains visible and optional; KPI truth ownership stays in Results.

### Unified initiative sequence (KPI only)

| Initiative | Task ID | Priority | Objective | Gate |
| --- | --- | --- | --- | --- |
| Lock strategy docs baseline | `RZ-KPI-P0-001` | `P0` | freeze gap map + raw delta + one plan + evidence matrix | `APPROVED_FOR_DOCS` |
| Close lifecycle/scorecards test depth | `RZ-KPI-P1-001` | `P1` | add dedicated direct scorecards/lifecycle assertions | `UNBLOCK_AFTER_P0` |
| Harden trust/provenance UX evidence | `RZ-KPI-P2-001` | `P2` | upgrade lineage/degraded/approval posture evidence quality | `UNBLOCK_AFTER_P1` |

### Gap -> RAW -> Initiatives -> Plan -> Approval (RZ-INI full-cycle)

#### Gap Summary
- `P0`: required explicit doctrine binding for initiatives lane was missing before closeout.
- `P1`: no explicit function UX matrix for governance-risk rows (`without KPI`, `without evidence`) in this doc.
- `P2`: no premium operator-cockpit pattern documented for initiatives lane (world-class uplift target).

#### RAW Mapping (As-Is vs target)
- As-Is: initiatives tab renders and supports explicit status updates.
- RAW target: initiatives lane should behave as accountability cockpit with stage/health/benefit confidence and next-action framing.
- Delta: docs now lock mandatory evidence and governance posture; uplift and premium layers are queued in `RZ-INI-P1/P2`.

#### Development Initiatives
- `P0 must-have`: evidence-bound initiatives lane contract and approval gate lock.
- `P1 client expectation uplift`: governance-risk visibility and dedicated regression depth.
- `P2 premium differentiators`: premium lineage/explainability and closed-loop action storytelling.

#### Unified Plan
- Sequence: `RZ-INI-P0-001` -> `RZ-INI-P1-001` -> `RZ-INI-P2-001`.
- Dependency: `P1/P2` blocked until P0 acceptance.
- Acceptance/evidence source: function contract + acceptance matrix + task board rows.

#### Approval + Unblock
- Decision for docs scope: `APPROVED_FOR_DOCS`.
- Unblock status: docs continuation for scope anchor is open; queued uplift/premium rows remain dependency-gated.

## 15. Closeout Delta — `RZ_ROI_ANALYSIS`

### As-Is
- `/benefits` renders `ResultsHub` and includes active `roi_analysis` tab branch.
- ROI analysis surface shows portfolio-level planned/realized/variance context and initiative drill-in.
- Detail drawer supports assumptions + realized-entry actions with explicit user interaction.

### Delta Closed (docs-only)
- Locked UI/UX contract for scope anchor `07_rezultaty/RZ_ROI_ANALYSIS`.
- Added explicit assumptions -> deviations -> review/approval model for ROI analysis lane.
- Synced task row readiness for `RZ-RAN-P0-001`, `RZ-RAN-P1-001`, `RZ-RAN-P2-001`.

### Critical Evidence (route + component + API + test)

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| ROI analysis is a `/benefits` lane and not a separate route. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/Results/ResultsHub.tsx` (`roi_analysis` tab/branch) | n/a | `tests/navigation/routeMapping.test.ts`, `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` | `pass` |
| Assumptions model is explicit and user-driven (no hidden write). | `/benefits?tab=roi_analysis` interaction path | `src/components/Results/ROIDetailDrawer.tsx` (assumptions editor + save action) | `src/services/api/v8/results.ts` (`updateRoiInitiativeAssumptions`) + bounded legacy fallback | `tests/components/Results/ROIDetailDrawer.v8-assumptions-write.test.tsx` | `pass` |
| Deviations model is explicit and reviewable (portfolio + initiative variance). | `/benefits` ROI analysis lane | `src/components/Results/ROIAnalysisView.tsx` (variance summary, sorting, status badges) + `ROIDetailDrawer.tsx` variance detail | `src/services/api/v8/results.ts` (`getRoiPortfolioSummary`, `getRoiInitiativeDetail`) | `tests/components/Results/ROIViews.v8-portfolio-summary.test.tsx`, `tests/components/Results/ROIDetailDrawer.v8-detail.test.tsx` | `pass` |
| Review/approval boundary is explicit before ROI truth is presented as approved. | ROI analysis review path in `/benefits` | explicit review actions exist (`open detail`, `record actual`, `view history`) but no dedicated approval/lock control confirmed | no explicit approval endpoint mapping found for this lane | no dedicated regression asserting approval/lock boundary | `inconclusive` |

### Gate
- Docs closeout gate for this function in UI/UX layer: `PASS_WITH_P2`.

### Full-Cycle Delivery (gap -> raw -> initiatives -> plan -> approval)

#### A) Gap summary
| Area | Current posture | Gap | Severity |
| --- | --- | --- | --- |
| Assumptions model | assumptions edits are explicit in detail flow | scenario-quality and confidence semantics are not normalized in acceptance contract | `P1` |
| Analysis quality | variance and status are visible | explainability bar (`why`, `confidence`, `source`) is not locked as mandatory for every critical deviation | `P1` |
| Approval semantics | review actions are explicit | explicit `approved/locked` state in ROI analysis lane is not evidenced | `P2` |
| Evidence posture | route/component/API/test baseline exists | premium lineage/readiness signals remain shallow | `P2` |

#### B) RAW target mapping
- RAW expects ROI analysis to run as a governed decision lane: assumptions + confidence + deviations + explanation + approvals.
- RAW requires explicit pending approvals/evidence queues and no silent promotion of claims to approved truth.
- RAW requires explainability tied to source references and confidence.

#### C) Initiatives backlog
| Task ID | Priority | Initiative | Exit condition |
| --- | --- | --- | --- |
| `RZ-RAN-P0-001` | `P0` | lock ROI analysis contract and full-cycle evidence matrix | `PASS` docs gate with complete evidence map |
| `RZ-RAN-P1-001` | `P1` | uplift explainability quality (`source + confidence + rationale`) for major deviations | direct acceptance criteria and regression targets defined |
| `RZ-RAN-P2-001` | `P2` | harden approval/lock semantics and review queue posture | explicit approval-state contract + unblock checklist |

#### D) Unified plan
1. Close `RZ-RAN-P0-001` (baseline freeze and full-cycle lock).
2. Start `RZ-RAN-P1-001` (quality uplift) only after P0 acceptance.
3. Start `RZ-RAN-P2-001` (approval hardening) only after P1 readiness.

Acceptance gates:
- Every critical claim keeps `route + component + API + test`.
- No claim reaches `PASS` without evidence reference.

Risks:
- Missing explicit approval-state control in lane (`P2` risk).
- Explainability inconsistency across insights (`P1` risk).

#### E) Approval + unblock
- Docs decision: `PASS_WITH_P2`.
- Unblock state: `UNBLOCK_P1_PREP_ONLY` (P0 completed, P1 planning/unblock allowed, P2 gated by P1 output).

### Roadmap UI Contract (Gap -> Raw -> Initiatives)

- Source/provenance strip for reports must show at least: source scope, snapshot age, evidence completeness, and confidence posture.
- `MISSING_EVIDENCE` must be visually blocking for approval/finalization posture (no neutral/success styling).
- Approval/finalization controls must remain explicit and role-scoped; refresh CTA cannot change approval status.
- Review queue should expose pending approvals, missing evidence, and source conflicts as first-class report states.
- Client-ready mode may hide internal notes, but must not hide evidence posture or approval state.

## 13. Closeout Delta — `RZ_REPORTS_WORKSPACE`

### As-Is
- `/benefits` renders `ResultsHub` and includes the `results_reports` tab branch.
- Reporting lane switches tracked KPI reports and enterprise schedules/reports surfaces in one runtime.
- Report create/refresh actions are explicit user interactions in reporting workspace.

### Delta Closed (docs-only)
- Locked UI/UX contract for scope anchor `07_rezultaty/RZ_REPORTS_WORKSPACE`.
- Hardened UI rules for source/provenance/approval with explicit `MISSING_EVIDENCE` posture.
- Synced task row readiness for `RZ-REP-P0-001`, `RZ-REP-P1-001`, `RZ-REP-P2-001`.

### Critical Evidence (route + component + API + test)

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Reports workspace is a `/benefits` lane and not a separate route. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/Results/ResultsHub.tsx` (`results_reports` tab map/branch) | n/a | `tests/navigation/routeMapping.test.ts`, `tests/e2e/smoke/sidebar-navigation.spec.ts`, `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` | `pass` |
| `results_reports` branch switches tracked and schedules/enterprise surfaces in runtime. | `/benefits` route shell | `ResultsHub.tsx` (`reportWorkspaceMode`, `ResultsKpiReportsView`, `ResultsReportSchedulesView`) | report list/refresh endpoints consumed by reporting view | `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` | `pass` |
| Report create/refresh requires explicit user action and cannot imply hidden finalization. | `/benefits` reporting interaction path | `src/components/Results/ResultsKpiReportsView.tsx` (explicit create + refresh buttons, snapshot hint) | `src/services/api/v8/results.ts` (`createKpiReport`, `refreshKpiReport`) | no dedicated test assertion for approval/finalization transition | `pass_with_p2` |
| Missing source/provenance/evidence must be explicit before approval posture. | `/benefits` reporting lane | explicit `MISSING_EVIDENCE` badge/state not yet confirmed in component evidence | canonical source rules in `docs/product/REPORTING_CANONICAL_TEMPLATES.md` | dedicated automated assertion not found | `inconclusive` |

### Gate
- Docs closeout gate for this function in UI/UX layer: `PASS_WITH_P2`.

## 14. Closeout Delta — `RZ_KPI_WORKSPACE`

### As-Is
- `/benefits` renders `ResultsHub` with an active `results_kpi` tab branch.
- KPI lane supports mode transitions in one runtime (`catalog`, `queue`, `overview`, `scorecards`).
- KPI mutations and read-back refreshes are executed from explicit user actions.

### Delta Closed (docs-only)
- Locked UI/UX contract for scope anchor `07_rezultaty/RZ_KPI_WORKSPACE`.
- Added mandatory route/component/API/test evidence binding for KPI workspace claims.
- Synced task row readiness for `RZ-KPI-P0-001`, `RZ-KPI-P1-001`, `RZ-KPI-P2-001`.

### Critical Evidence (route + component + API + test)

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| KPI workspace is a `/benefits` lane (`results_kpi`) and not a separate route surface. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/Results/ResultsHub.tsx` (`VALID_TABS`, KPI tab switch) | `src/services/api/v8/results.ts` (`getDashboard`, `getKpiCatalog`) | `tests/navigation/routeMapping.test.ts`, `tests/e2e/smoke/wave1-module-closeout.spec.ts`, `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` | `pass` |
| KPI operator modes are available in one runtime workspace. | `/benefits` remains active while mode switches happen | `ResultsHub.tsx` branches for `kpiWorkspaceMode` (`catalog`/`queue`/`overview`/`scorecards`) | `src/services/api/v8/results.ts` KPI contracts feeding mode data | `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` (mode transition assertions) | `pass` |
| KPI mutations are explicit and governed by V8-first seam with bounded fallback. | user flow in `/benefits?tab=results_kpi` | `ResultsHub.tsx` explicit delete/create/value-record handlers + refresh sequencing | `src/services/api/v8/results.ts` (`deleteKpi`, `createKpiTimeSeriesValue`), legacy fallback via `src/services/api.ts` | `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx`, `tests/unit/services/v8-results-api.test.ts` | `pass` |
| Governed empty/fallback posture is explicit (no silent KPI demo backfill). | `/benefits` KPI lane runtime context | `ResultsHub.tsx` governed-strip and fallback handling | `src/services/api/v8/results.ts`, bounded compatibility fallback boundary | `tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx` (`empty no-backfill`, compatibility fallback assertions) | `pass_with_p2` |

### Gate
- Docs closeout gate for this function in UI/UX layer: `APPROVED_FOR_DOCS`.
