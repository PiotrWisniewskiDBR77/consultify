---
module_id: MODULE_EXECUTION
function_id: RL_EXECUTION_REPORTS
function_name: Execution — Reports
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Execution Reports

## 1. Function Identity
- Function ID: `RL_EXECUTION_REPORTS`
- Runtime anchor: `ExecutionHub` tab `reports`
- Route scope: `/implementation`
- Feature state: `real`
- Scope anchor: `06_realizacja/RL_EXECUTION_REPORTS`
- Work type for this closeout: `docs-only`
- Canonical source documents:
  - `docs/modules/06_realizacja/03_BEHAVIOR.md`
  - `docs/modules/06_realizacja/04_UI_UX.md`
  - `docs/modules/06_realizacja/05_DATA_AND_INTEGRATIONS.md`
  - `docs/modules/06_realizacja/07_ACCEPTANCE_AND_TESTS.md`
  - `docs/product/DELIVERY_REPORTING_AND_EXECUTION_RISK_V8.md`
  - `docs/product/EXECUTION_REPORT_TEMPLATES_P03_V8.md`

## 2. User Job and Business Outcome
- Purpose: inspect, generate and export predefined execution/PMO reports built from live execution truth.
- Primary user question: "What reporting output explains current execution health, risk, blockers, cadence and follow-up actions?"
- Business outcome: PMO, sponsors and managers can review execution through honest, audience-specific reports without creating a second portfolio or hidden runtime.
- Non-goals:
  - Do not replace `RL_EXECUTION_PORTFOLIO` as the live execution object list.
  - Do not replace `RL_EXECUTION_MANAGER` as intervention/workload cockpit.
  - Do not create a generic BI/report builder inside Execution.
  - Do not silently finalize, approve or publish a report.
  - Do not mark a report as successful when its required source evidence is missing.

## 3. Trigger and Entry Points
- Primary route: `/implementation`.
- Primary component: `src/components/Execution/ExecutionHub.tsx`.
- Runtime entry state: `ExecutionHub` default tab is `list`; this function is reached by selecting the `reports` tab labelled `Raporty`.
- Report detail surface: `src/components/Execution/ReportDocumentView.tsx`.
- Report compact/preview surface: report table/grid and preview footer inside `ExecutionHub`; compact panel support exists in `src/components/Execution/ReportCompactPanel.tsx`.
- Adjacent impact only: global reports/output routes may receive exports or handoffs, but this function owns only the Execution reporting surface.

## 4. UI Component Footprint
- Required report views: `table` and `grid`.
- Table mode must use table + preview behavior for catalog inspection.
- Grid mode may show report cards, but each card must still preserve title, audience, cadence, scope, RAG/confidence cue and action entry.
- Report document view must expose:
  - header: title, audience, cadence, scope, last refresh and RAG/confidence;
  - highlights strip;
  - operational sections;
  - AI Executive Readout where generated from visible execution truth;
  - AI Recommended Actions where grounded in visible execution truth;
  - data quality / provenance footer.
- Menu 3 / command row:
  - filters for cadence and audience belong in the active command row;
  - contextual AI/report generation actions must use Menu 3/right-side, report-row or report-preview scoped controls;
  - no duplicate AI/report toolbar may appear in the main canvas.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs:
  - report catalog definitions,
  - execution initiatives,
  - tasks,
  - decisions,
  - blocked initiatives,
  - risk signals,
  - delay signals,
  - overdue decisions,
  - missing dates,
  - due-soon tasks,
  - overspend signals,
  - next milestones,
  - priority alerts,
  - timeline warnings,
  - capacity alerts,
  - capacity timeline,
  - progress percent,
  - last refresh timestamp.
- Runtime data context contract: `ReportDataContext` in `src/components/Execution/executionReports.ts`.
- Report definition contract: `ReportDef` in `src/components/Execution/executionReports.ts`.
- API/service evidence:
  - shared API boundary: `src/services/api.ts`;
  - V8 execution-control client: `src/services/api/v8/execution-control.ts`;
  - backend V8 route owner: `server/src/routes/v8/execution-control.routes.ts`;
  - fallback behavior remains visible and must not be presented as clean success.
- Provenance rule: every generated report must name its runtime source families through `dataSources`, expose data-quality posture and preserve enough source linkage for review.
- Missing evidence rule: if a report cannot be grounded in at least one required runtime source family, the report state is `missing_evidence`, not `success`.

## 6. Outputs and Side Effects
- Outputs:
  - fixed report catalog,
  - enriched report definitions,
  - report preview,
  - report document view,
  - markdown/PDF-style browser export,
  - presentation/Wordy handoff where explicitly triggered,
  - AI generation handoff where explicitly triggered.
- Side-effect rule: generation/export/handoff must be visible user actions. No hidden finalization, hidden approval, hidden report publishing or silent mutation of execution truth is allowed.
- Completion rule: a generated or exported report may be treated as review-ready only when source/provenance and data-quality posture are visible.

## 7. Ownership and Handoff Boundaries
- `RL_EXECUTION_REPORTS` owns report catalog, cadence, report sections, provenance requirements and report output review.
- `RL_EXECUTION_PORTFOLIO` owns live execution initiatives/tasks/decisions/blockers that reports summarize.
- `RL_EXECUTION_MANAGER` owns intervention and workload management actions.
- `09_outputs` / global report routes may store or expose generated artifacts after explicit handoff, but they do not redefine the Execution report catalog.
- Boundary rule: reports summarize and package execution truth; they must not become a second live initiative table or a separate source of execution truth.

## 8. Runtime States and UX Behavior
- Loading:
  - route/module suspense and report data loading must show a loader or pending state;
  - report generation/export/handoff must show progress feedback.
- Empty:
  - no execution initiatives must show "No execution data yet" and explain that reports populate once execution work exists;
  - filtered catalog empty must say no report matches the active cadence/audience/search filter;
  - source-empty report sections must show empty source rows, not invented narrative.
- Error:
  - failed source loads, report generation, copy/export or AI handoff must show visible error/toast feedback;
  - error must not be collapsed into an empty catalog.
- Degraded:
  - missing baseline, missing dates, missing estimates, stale/snapshot-only refresh, fallback data, partial API failure or low completeness must be visible as degraded;
  - degraded reports may be opened for review, but must not be labelled as clean success.
- Missing evidence:
  - if `dataSources` are absent, source arrays are all unavailable, or required report sections cannot cite execution inputs, the report status is `missing_evidence`;
  - `missing_evidence` blocks success/finalization and requires source repair or explicit review note.
- Success:
  - report catalog renders;
  - selected report opens with header, sections, source/provenance and data-quality footer;
  - generation/export/handoff confirms completion and identifies next review/follow-up action.
- Next action guidance must tell the user whether to add execution data, clear filters, retry loading, repair provenance, review degraded flags, generate AI readout or export/handoff.

## 9. AI, Source, Evidence, Approval
- AI actions:
  - may summarize, prioritize and convert visible execution inputs into readout/actions;
  - must not invent missing facts, hide degraded posture, rewrite source truth or silently finalize a report;
  - must be invoked from scoped report controls, not hidden automation.
- Source/evidence:
  - every report must expose source families through `dataSources`;
  - generated summaries must disclose missing/partial evidence;
  - report exports must preserve source list and data-quality posture.
- Approval/finalization:
  - report generation is not finalization;
  - final review/publish/approval, if implemented later, must be explicit, auditable and user-triggered;
  - no current docs-only closeout approves hidden report finalization.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.
- Reports must never expose raw sensitive payloads where source links, counts or summarized rows are sufficient.
- Cross-module handoff must preserve tenant/ACL boundaries and provenance.
- Governance/high-impact output sharing requires explicit user action.

## 11. Acceptance Criteria and Test Evidence

| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Gate |
| --- | --- | --- | --- | --- | --- |
| Reports are reached from `/implementation` via `ExecutionHub`. | `src/routes/AppRoutes.tsx`, `src/routes/routeConfig.ts` | `src/components/Execution/ExecutionHub.tsx` `initialTab='list'`, `tabs` includes `reports` labelled `Raporty` | n/a | `tests/navigation/routeMapping.test.ts`, `tests/e2e/smoke/sidebar-navigation.spec.ts` cover `/implementation`, not the reports tab | `PASS_WITH_P2` |
| Reports tab is a catalog, not a second portfolio runtime. | `/implementation` route only | `ExecutionHub` separates tabs `list`, `reports`, `people_change`; reports allow `table` and `grid` only | shared execution truth via `ReportDataContext`, not independent writes | no dedicated catalog boundary regression found | `PASS_WITH_P2` |
| Fixed catalog contains the 11 canonical execution reports. | `/implementation` reports tab | `ExecutionHub` `reportCatalog` includes Weekly Execution Pack, Monthly PMO Review, Program Health Summary, Blockers & Recovery Report, Milestone Slippage Report, Capacity Utilization Report, Budget Variance Report, Decision Backlog & Approval Aging, Cross-Initiative Dependency Report, Delivery Confidence Report, Sponsor-Ready One-Pager | n/a | doc/code inspection only; no catalog count test found | `PASS_WITH_P2` |
| Every catalog report declares audience, cadence, scope, sections, sources and follow-up actions. | `/implementation` reports tab | `ReportDef` fields and `reportCatalog` definitions | n/a | no schema-level unit test found for all report definitions | `PASS_WITH_P2` |
| Report runtime uses execution source context and provenance. | `/implementation` reports tab/document | `ReportDataContext`, `enrichExecutionReport`, `ReportDocumentView`, `QualityFooter` | `src/services/api/v8/execution-control.ts`, `server/src/routes/v8/execution-control.routes.ts`, `src/services/api.ts` | `tests/unit/services/v8-execution-control-api.test.ts`, `server/src/routes/v8/__tests__/execution-control.routes.test.ts` cover source APIs, not full report provenance UI | `PASS_WITH_P2` |
| Loading, empty, error, degraded, missing-evidence and success states are explicit. | `/implementation` | `ExecutionHub` route suspense/no-data callout/toasts; `executionReports.ts` data-quality and degraded flags; `ReportDocumentView` quality footer | V8 execution-control fallback and error envelopes where used | partial service/route evidence only; no full reports UI state matrix found | `BLOCKED_P1` until reports state-matrix evidence exists |
| Report without sources is not success. | `/implementation` reports tab/document/export | Required by this contract; runtime must map absent/empty required sources to `missing_evidence` | source families defined by V8 execution-control and shared API inputs | no automated assertion found for `missing_evidence` state | `BLOCKED_P1` |
| Generation/export/handoff are explicit user actions and not hidden finalization. | `/implementation` reports tab/document | report preview/document action buttons, copy/export/presentation/generate handlers | chat/handoff/global report APIs are downstream and explicit | no dedicated hidden-finalization regression found | `PASS_WITH_P2` |
| Reports preserve source/provenance in exports. | `/implementation` report document/export | `buildReportMarkdown` emits `Data Sources`; `ReportDocumentView` shows data quality footer | n/a | no export snapshot test found | `PASS_WITH_P2` |

## 12. Report Contract Decisions

### Catalog

| Report | Audience | Cadence | Required source families | Required sections summary |
| --- | --- | --- | --- | --- |
| Weekly Execution Pack | PMO, team leads, delivery leads | Weekly | initiatives, tasks, decisions, overdue decisions, due-soon tasks, next milestones, missing dates | this week at a glance, next 7 days focus, decision queue, hygiene gaps |
| Monthly PMO Review | PMO director, sponsors, portfolio governance | Monthly | initiatives, milestones/timeline warnings, overspend, capacity, blockers, overdue decisions, missing dates | portfolio control, schedule exceptions, budget/staffing exceptions, governance exceptions |
| Program Health Summary | steering committee, PMO leadership | Bi-weekly | initiatives, risk signals, delay signals, blocked work, priority alerts, overdue decisions | health register, risk/delay drivers, turning red, steering implications |
| Blockers & Recovery Report | PMO, delivery managers, operators | On demand | blocked initiatives, tasks, decisions, overdue decisions, priority alerts | blocked recovery board, stalled tasks, escalation path, recovery options |
| Milestone Slippage Report | PMO, sponsors | Weekly | next milestones, delay signals, timeline warnings, missing dates, initiatives | slippage register, baseline vs forecast gaps, next milestones at risk, recovery timeline |
| Capacity Utilization Report | resource managers, PMO, delivery leads | Monthly | tasks, capacity alerts, capacity timeline, due-soon tasks | governed capacity alerts, task load, 4-week horizon, tasks to reassign |
| Budget Variance Report | finance, sponsors, PMO | Monthly | overspend signals, initiatives, tasks, blocked work, overdue decisions | overspend register, execution impact, work items in overspending initiatives, finance actions |
| Decision Backlog & Approval Aging | PMO, decision owners, sponsors | Weekly | decisions, overdue decisions, initiatives, blocked work | pending decisions, aging buckets, initiatives waiting, escalation candidates |
| Cross-Initiative Dependency Report | PMO, architects, delivery leadership | Bi-weekly | timeline warnings, next milestones, initiatives, tasks, decisions, blocked work | dependency conflicts, critical chains, broken links, upstream/downstream impact |
| Delivery Confidence Report | steering committee, sponsors, PMO | Monthly | initiatives, priority alerts, risk signals, delay signals, blocked work, missing dates, overdue decisions | confidence register, erosion drivers, scenario outlook |
| Sponsor-Ready One-Pager | executive sponsors | On demand | initiatives, blocked work, overdue decisions, overspend signals, next milestones, progress percent | sponsor summary, sponsor-attention initiatives, achievements, sponsor asks |

### Cadence Rules

- Weekly reports answer short-horizon execution control and decision debt.
- Bi-weekly reports answer steering health and cross-initiative dependency posture.
- Monthly reports answer PMO, capacity, budget and confidence review.
- On-demand reports answer acute blocker/recovery or sponsor communication needs.
- Cadence filters must not hide degraded or missing-evidence posture.

### Provenance Rules

- `dataSources` is mandatory for every report definition.
- Report body sections must be grounded in `ReportDataContext` source families or show source-empty/missing-evidence state.
- AI readout and AI actions may only summarize visible source data.
- Exported markdown/PDF-style output must retain `Data Sources` and data-quality flags.
- Missing source evidence is a blocking report-quality state, not a clean report outcome.

## 13. Decision -> UI/UX -> Build Contract -> Impact -> Done

### Decision
- `RL_EXECUTION_REPORTS` is the predefined reporting layer for Execution/PMO.
- The catalog is fixed at 11 reports and inherits report template doctrine from `docs/product/EXECUTION_REPORT_TEMPLATES_P03_V8.md`.
- A report without sources, provenance or data-quality disclosure is `missing_evidence`, not `success`.

### UI/UX
- Required views: table catalog, grid catalog and report document.
- Required states: loading, empty, error, degraded, missing evidence and success.
- Required trust posture: every report shows source families, degraded flags/data quality and follow-up expectations.
- AI/report actions must be scoped to Menu 3/right-side, report row, report preview or report document controls.

### Build Contract
- Runtime anchor remains `ExecutionHub` tab `reports`.
- Report definitions remain typed by `ReportDef`; live inputs remain typed by `ReportDataContext`.
- Source APIs remain shared execution-control/runtime sources; this function does not own canonical execution writes.
- No runtime change is approved by this docs-only closeout.

### Impact
- Adjacent impacted functions: `RL_EXECUTION_PORTFOLIO`, `RL_EXECUTION_MANAGER`, `OUT_REPORT_BUILDER`, `OUT_LIBRARY_HUB`.
- Impact is dependency-only: reports consume execution truth and may hand off artifacts, but this contract does not redefine adjacent function surfaces.

### Done
- Docs contract is complete when this file maps catalog, cadence, sections, provenance, runtime states, acceptance and evidence.
- Runtime readiness remains conditional on closing P1 validation for report state matrix and missing-evidence behavior.

## 14. Task Board Ready Items

Registry source for this docs-only sync: locked dispatch card for `06_realizacja/RL_EXECUTION_REPORTS`.

| Task ID | Scope anchor | Priority | Status | Change type | Depends on | Evidence (route/component/API/test) | Source card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `RL-REP-P0-001` | `06_realizacja/RL_EXECUTION_REPORTS` | `P0` | `READY` | `runtime/test` | none | route `/implementation`; component `ExecutionHub` reports tab, `ReportDocumentView`, `executionReports.ts`; API `src/services/api.ts`, `src/services/api/v8/execution-control.ts`, `server/src/routes/v8/execution-control.routes.ts`; test or accepted manual evidence that source-less report is `missing_evidence`, not success/finalized | `functions/RL_EXECUTION_REPORTS.md` |
| `RL-REP-P1-001` | `06_realizacja/RL_EXECUTION_REPORTS` | `P1` | `WAITING_P0` | `test` | `RL-REP-P0-001` | route `/implementation`; component reports table/grid/document; API source/fallback envelopes; test or accepted manual state matrix for loading, empty, error, degraded, `missing_evidence` and success | `functions/RL_EXECUTION_REPORTS.md` |
| `RL-REP-P2-001` | `06_realizacja/RL_EXECUTION_REPORTS` | `P2` | `WAITING_P0` | `docs/test` | `RL-REP-P0-001`, `RL-REP-P1-001` | route `/implementation`; component reports table/grid/document; API/source context preserved; screenshot/recording links or manual evidence references for table, grid and document states added to acceptance docs | `functions/RL_EXECUTION_REPORTS.md` |

Rows intentionally not registered in this sync because they were not present in the locked input: `RL-REP-P1-002`, `RL-REP-P1-003`, `RL-REP-P2-002`.

## 14A. Registry Sync Dependencies

| Dependency scope | Allowed use | Forbidden use |
| --- | --- | --- |
| `06_realizacja/RL_EXECUTION_PORTFOLIO` | source execution objects and report input context only | redefine Portfolio task registry or mutate portfolio runtime |
| `06_realizacja/RL_EXECUTION_MANAGER` | manager signal impact context only | redefine Manager approval/action registry |
| `07_rezultaty/RE_RESULTS_HUB` | downstream impact note for results evidence handoff only | edit Results contracts or promote Results to primary scope |

## 14B. Registry Sync Completed

- Registry sync completed for locked rows: `RL-REP-P0-001`, `RL-REP-P1-001`, `RL-REP-P2-001`.
- No runtime files are authorized by this docs-only sync.
- No separate `function-cards/RL_EXECUTION_REPORTS_EXECUTION_CARD.md` was created because the locked `in_scope_files` list did not include `function-cards/**`; this function contract is the source card for this sync.
- Owner acceptance recommendation: `APPROVE_REGISTRY_SYNC_FOR_RL_EXECUTION_REPORTS`; runtime delivery remains `BLOCKED_P1` until evidence for `RL-REP-P0-001` and `RL-REP-P1-001` exists.

## 15. Readiness Verdict

- Docs readiness: `PASS`.
- Runtime readiness: `BLOCKED_P1`.
- Registry readiness: `PASS`.
- Reason: contract, catalog and evidence map are explicit, and the locked `RL-REP-*` rows are normalized. Full runtime readiness still needs proof that missing sources produce `missing_evidence` rather than success and that reports state-matrix behavior is covered by automated or accepted manual evidence.

## 16. Open Questions
1. Which UI evidence format is canonical for this module closeout: Playwright trace, screenshot pack or manual QA note?
2. Should `missing_evidence` be a persisted report status, a UI-only trust state or both?
3. Which downstream output surface is canonical for explicit report final review/publish if Execution hands off an artifact?

## 17. Open Risks and Change Log
- Risk: output trust can degrade if data quality warnings are ignored.
- Risk: current runtime evidence confirms catalog/source structure, but does not yet prove source-less reports are blocked from success.
- Risk: report action placement needs UI validation for Menu 3/right-side or report-scoped compliance.
- Change log: 2026-05-10 docs-only closeout added fixed catalog/cadence/sections/provenance decisions, runtime state requirements, missing-evidence rule, evidence map, task-board items and readiness verdict.

## 12. Open Risks and Change Log

Gate alias for the module-contract rerun checker. Canonical risk content is maintained in section 17 above.

## RAW Hard Gate Trace — 2026-05-11

- RAW source: `docs/RAW/implementation-pmo/107_RAW_IMPLEMENTATION_PMO_ENGINE_2026-05-09.md`, `docs/RAW/execution-hub/103_RAW_EXECUTION_HUB_AI_EXECUTION_MANAGEMENT_ENGINE_2026-05-09.md`.
- Contract decision: `ENHANCE` PMO report source/provenance and `missing_evidence` guard; `REJECT` hidden finalization.
- Evidence: route/component/API baseline exists; dedicated missing-evidence/finalization assertion remains `NOT_DONE`.
