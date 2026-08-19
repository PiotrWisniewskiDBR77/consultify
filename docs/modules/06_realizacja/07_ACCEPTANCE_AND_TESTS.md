---
module_id: MODULE_EXECUTION
doc_kind: TESTS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-10
---

# Acceptance & Tests — Realizacja / Implementation & PMO

> The runtime paths below are AS-IS evidence. Target Menu 2 and acceptance direction are defined by `../INITIATIVES_EXECUTION_FUNCTIONS_CANON.md`; the historical Portfolio/Raporty/Manager split is not the current target IA.

## Acceptance Matrix (As-Is Runtime Paths)

| Path / flow | Current runtime evidence | Status |
| --- | --- | --- |
| Sidebar Execution -> route family | `menuConfig.ts` + `/execution`, `/implementation`, `/rollout` routes | pass |
| Core execution hub | `/implementation` -> `ExecutionHub` | pass |
| V8 execution data contracts | `src/services/api/v8/execution-control.ts` | pass |
| Governance write helpers | `executionWriteTruth` + lifecycle helper usage | pass |
| Module-local `ExecutionHub` frontend tests | no dedicated `ExecutionHub` regression found | gap (`code_gap`) |
| Execution-control API/client tests | `tests/unit/services/v8-execution-control-api.test.ts`, `server/src/routes/v8/__tests__/execution-control.routes.test.ts` | pass |
| Execution write refresh helper tests | `tests/unit/services/executionWriteTruth.test.ts` | pass |

## Function-Level Acceptance Matrix

| Function | Acceptance focus | Runtime/code evidence | Status |
| --- | --- | --- | --- |
| `RL_EXECUTION_PORTFOLIO` | Portfolio execution interactions are active | `ExecutionHub.tsx` list tab and view modes | pass |
| `RL_EXECUTION_REPORTS` | Report catalog and generation actions are active | `ExecutionHub.tsx` report catalog code paths | pass |
| `RL_EXECUTION_MANAGER` | Manager lane metrics and recommendations are active | `ExecutionHub.tsx` manager metrics/suggestions | pass |
| `RL_FULL_EXECUTION_VIEW` | `/execution` route is mounted | `AppRoutes.tsx`, `FullExecutionView.tsx` | pass |
| `RL_ROLLOUT_VIEW` | `/rollout` route is mounted and contract covers rollout baseline/schedule/forecast/conflict decisions | `AppRoutes.tsx`, `FullRolloutView.tsx`, `FullRolloutWorkspace.tsx` | pass with P1 evidence gaps |

## `RL_EXECUTION_PORTFOLIO` Evidence Matrix

| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| `/implementation` is the Portfolio route entry for this function. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/Execution/ExecutionHub.tsx` | n/a | route-specific smoke not found | `PASS_WITH_P2` |
| `ExecutionHub` list tab is the Portfolio surface. | `/implementation` route map | `ExecutionHub` `initialTab='list'`, tab id `list` labelled `Portfolio` | n/a | no dedicated `ExecutionHub` component test found | `PASS_WITH_P2` |
| Portfolio supports table, kanban and timeline only. | `/implementation` | `ExecutionHub` restricts list tab to `table`, `kanban`, `timeline` and renders `TableWithPreviewLayout`, `ExecutionInitiativesKanbanView`, `ExecutionTimelineView` | n/a | no dedicated view-mode regression found | `PASS_WITH_P2` |
| Portfolio uses shared execution-control truth for timeline/capacity/risk signals where available. | `/implementation` | `ExecutionHub` V8 control-tower loaders and fallback handling | `src/services/api/v8/execution-control.ts`, `server/src/routes/v8/execution-control.routes.ts`, legacy `/api/execution-control` bridge | `tests/unit/services/v8-execution-control-api.test.ts`, `server/src/routes/v8/__tests__/execution-control.routes.test.ts`, `server/src/services/__tests__/v8ExecutionControlTowerService.test.ts` | `PASS` |
| Portfolio mutations are explicit and visibly acknowledged. | `/implementation` | `ExecutionHub` status/task movement handlers, toast success/error feedback | `src/services/api.ts`, `src/services/executionWriteTruth.ts`, V8 org-scoped write endpoints where used | `tests/unit/services/executionWriteTruth.test.ts`, `server/src/routes/v8/__tests__/execution-control.routes.test.ts` | `PASS_WITH_P2` |
| AI actions are Menu 3/right-side or row-scoped only. | `/implementation` | `ExecutionHub` `rightControls`; preview/footer chat actions require placement audit | governed chat runtime outside this function | no placement regression found | `BLOCKED_P1` until UI evidence exists |
| Degraded states are not presented as success. | `/implementation` | `ExecutionHub` fallback handling, loaders, toasts and error states | `shouldFallbackToLegacyExecutionControl`, execution-control route envelopes | fallback behavior covered in `tests/unit/services/v8-execution-control-api.test.ts`; full UI degraded matrix missing | `PASS_WITH_P2` |

## Confirmed Automated Evidence (As-Is)

- No dedicated `ExecutionHub` list-tab regression was found in the current evidence scan.
- No dedicated `FullRolloutWorkspace` regression was found in the current evidence scan.
- `/rollout` unauthenticated route protection is covered in `tests/components/RouterSync.idea-artifact.test.tsx`.
- Execution-control client coverage exists in `tests/unit/services/v8-execution-control-api.test.ts`.
- Execution-control backend route coverage exists in `server/src/routes/v8/__tests__/execution-control.routes.test.ts`.
- Execution control tower service coverage exists in `server/src/services/__tests__/v8ExecutionControlTowerService.test.ts`.
- Execution write refresh helper coverage exists in `tests/unit/services/executionWriteTruth.test.ts`.

## `RL_ROLLOUT_VIEW` Evidence Matrix

| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| `/rollout` is an active route for the rollout view. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/views/FullRolloutView.tsx` | n/a | `tests/components/RouterSync.idea-artifact.test.tsx` protects `/rollout` for unauthenticated users | `PASS_WITH_P2` |
| The route renders the rollout workspace, not Portfolio/Reports/Manager as its primary surface. | `/rollout` route map | `FullRolloutView` renders `FullRolloutWorkspace` | session-local rollout state through `useAppStore` | no dedicated `FullRolloutWorkspace` regression found | `PASS_WITH_P2` |
| Rollout baseline/current/forecast decisions follow the V8 schedule-control doctrine. | `functions/RL_ROLLOUT_VIEW.md` | runtime completeness requires `/rollout` UI audit | V8 execution-control timeline, delay and capacity contracts where wired | `tests/unit/services/v8-execution-control-api.test.ts`, `server/src/routes/v8/__tests__/execution-control.routes.test.ts` | `PASS_WITH_P2` |
| Timeline warnings/conflicts can be traced to explicit data contracts when available. | `/rollout` plus execution lane route family | rollout workspace and adjacent execution signal components | `V8ExecutionControlApi.getTimelineWarnings`, delay/capacity/control-tower endpoints | execution-control client/backend tests cover endpoint contracts; `/rollout` conflict UI test not found | `PASS_WITH_P2` |
| Auto-schedule, optimizer and conflict resolution are explicit proposal/review actions. | `functions/RL_ROLLOUT_VIEW.md` | route-level high-impact action UI requires audit | `V8ExecutionControlApi.updateTimeline` for governed timeline writes; rebaseline uses shared proposal/approval doctrine | timeline update API/client tests exist; route-level approval UI test not found | `PASS_WITH_P2` |
| AI actions do not bypass Menu 3 placement or high-impact review. | `/rollout` | `FullRolloutView` currently renders `AIFeedbackButton` and `SplitLayout` chat; placement requires audit | AI route is recommendation/content, not governed write | no placement regression found | `BLOCKED_P1` until UI evidence exists |
| Degraded/partial data is explicit in the contract. | `functions/RL_ROLLOUT_VIEW.md` | runtime state audit required for missing baseline, missing estimate, stale capacity, missing dependency shape and fallback data | `shouldFallbackToLegacyExecutionControl`; execution-control route envelopes | fallback behavior covered in `tests/unit/services/v8-execution-control-api.test.ts`; full `/rollout` degraded UI matrix missing | `PASS_WITH_P2` |

## `RL_FULL_EXECUTION_VIEW` Evidence Matrix

| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| `/execution` is the full execution route for `AppView.FULL_STEP5_EXECUTION`. | `src/routes/routeConfig.ts` declares `ROUTES.EXECUTION`, maps `AppView.FULL_STEP5_EXECUTION` to `/execution`, and maps `/execution` back to that AppView. | n/a | n/a | `tests/e2e/smoke/wave1-module-closeout.spec.ts` includes `/execution` in protected route coverage; not rerun in this docs-only closeout. | `PASS_WITH_P2` |
| `/execution` renders inside the protected route shell. | `src/routes/AppRoutes.tsx` renders `FullExecutionView` under `MainLayout`, `ProductionModuleGate`, `RouteErrorBoundary` and `Suspense`. | `src/views/FullExecutionView.tsx` | n/a | no fresh protected/production-gate runtime evidence captured. | `PASS_WITH_P2` |
| `FullExecutionView` delegates to the shared execution runtime. | `/execution` route render map in `AppRoutes.tsx`. | `FullExecutionView` returns `ExecutionHub`; `ExecutionHub` owns the shared execution surface. | shared runtime uses `src/services/api.ts`, `src/services/api/v8/execution-control.ts` and `src/services/executionWriteTruth.ts` where applicable. | `tests/e2e/execution-center.spec.ts` targets `/execution`; current pass/fail not asserted here. | `PASS_WITH_P2` |
| `/execution` does not introduce a second execution truth. | route wrapper delegates to `ExecutionHub`. | `ExecutionHub` is shared with module execution surfaces. | V8 execution-control and write-truth helpers remain shared runtime dependencies. | no automated assertion for absence of duplicated route-local truth. | `PASS_WITH_P2` |
| Entry, loading, empty, error, degraded and success states are explicit. | route shell provides loading/error boundaries; gate state is explicit at shell level. | shared `ExecutionHub` owns runtime state UI. | V8 execution-control fallback/degraded contracts provide service-level evidence. | no full `/execution` state matrix evidence captured. | `PASS_WITH_P2` |
| AI/contextual actions obey Menu 3/right-side or row-scoped placement. | `FullExecutionView` wrapper adds no duplicate AI toolbar. | inherited `ExecutionHub` command row/row action placement must be validated on `/execution`. | governed chat runtime is outside route wrapper. | no `/execution` AI placement smoke evidence found. | `BLOCKED_P1` until UI evidence exists |
| High-impact writes remain explicit and governed. | route wrapper has no hidden writes. | writes occur only through shared runtime controls where present. | `src/services/executionWriteTruth.ts` and V8 execution-control write endpoints where used. | `tests/unit/services/executionWriteTruth.test.ts`; no `/execution` route write smoke captured. | `PASS_WITH_P2` |

## `RL_FULL_EXECUTION_VIEW` Evidence Binding

| Evidence type | Bound artifact | What it proves | Missing evidence |
| --- | --- | --- | --- |
| Route declaration | `src/routes/routeConfig.ts` | `/execution` exists and maps to `AppView.FULL_STEP5_EXECUTION`. | latest automated route map run. |
| Route render | `src/routes/AppRoutes.tsx` | `/execution` renders `FullExecutionView` behind route shell guards. | latest protected-route UI smoke output. |
| Runtime delegation | `src/views/FullExecutionView.tsx` | the route uses `ExecutionHub` instead of a duplicate runtime. | assertion that future wrapper changes keep one runtime. |
| Product canon | `docs/product/EXECUTION_SURFACES_PORTFOLIO_REPORTS_MANAGER_V8.md` | execution remains one operating system with Portfolio/Raporty/Manager surfaces. | product decision on long-term `/execution` vs `/implementation` identity. |
| Smoke/e2e references | `tests/e2e/smoke/wave1-module-closeout.spec.ts`, `tests/e2e/execution-center.spec.ts` | test assets exist for `/execution` route and execution-center UI. | fresh pass/fail output and reconciliation with current UI contract. |

## `RL_FULL_EXECUTION_VIEW` Task Board Items

| ID | Priority | Area | Ready task | Acceptance / evidence |
| --- | --- | --- | --- | --- |
| `RL-FULL-P0-001` | `P0` | UI governance | Validate `/execution` AI/action placement and remove any duplicate non-row-scoped contextual toolbar if found. | UI smoke screenshot/recording or Playwright evidence proving one placement only. |
| `RL-FULL-P1-001` | `P1` | Route coverage | Add or identify latest route smoke evidence that `/execution` renders `FullExecutionView` behind protected/production gates. | Route smoke output linked here. |
| `RL-FULL-P1-002` | `P1` | QA reconciliation | Reconcile `tests/e2e/execution-center.spec.ts` expectations with the current shared `ExecutionHub` contract. | Passing focused e2e or documented test update decision. |
| `RL-FULL-P2-001` | `P2` | State evidence | Capture loading, empty, error, degraded and success evidence for `/execution`. | State matrix evidence path or manual Anygravity record. |
| `RL-FULL-P2-002` | `P2` | Route identity | Decide whether `/execution` remains first-class or becomes compatibility/legacy alias to implementation identity. | Product decision reflected in meta/status/codemap. |

## `RL_FULL_EXECUTION_VIEW` Open Questions

1. Should `/execution` remain a primary full-step route or become a documented compatibility alias once `/implementation` is the canonical sidebar launch route?
2. Which evidence artifact is canonical for `/execution` route readiness: protected route smoke, `execution-center` e2e or a new route contract test?
3. Does inherited `ExecutionHub` AI/chat placement on `/execution` satisfy the Menu 3/right-side or row-scoped rule without UI changes?

## Known Gaps / Blockers

- `code_gap`: missing regression tests for `ExecutionHub` Portfolio interactive behaviors (table/kanban/timeline, command row, preview, degraded states).
- `code_gap`: missing regression tests for `FullRolloutWorkspace` baseline/current/forecast/conflict states.
- `doc_gap`: no in-file links to UI state recordings.
- `ui_gate_gap`: AI action placement for `RL_EXECUTION_PORTFOLIO` requires runtime UI evidence because preview/footer chat actions must be confirmed as row-scoped or moved to Menu 3/right-side.
- `ui_gate_gap`: AI action placement for `RL_ROLLOUT_VIEW` requires runtime UI evidence because `FullRolloutView` renders route-level AI controls that must be Menu 3/right-side or accepted row-scoped placement.
- `approval_gap`: approval/diff/read-back depth for high-impact Portfolio writes is not fully enumerated.
- `approval_gap`: approval/diff/read-back depth for rollout auto-schedule, optimizer apply, conflict resolution, timeline update and rebaseline must be validated before runtime done.
- `route_gate_gap`: `/execution` has code and test-reference evidence, but no fresh route-shell/runtime output attached to this docs-only closeout.
- `ui_gate_gap`: AI action placement for `RL_FULL_EXECUTION_VIEW` requires runtime UI evidence on `/execution`.
- `qa_alignment_gap`: existing `/execution` e2e expectations must be reconciled with the current shared `ExecutionHub` contract before final runtime signoff.

## Gate Vocabulary (Used For Reporting)

- `PASS`, `PASS_WITH_P2`, `BLOCKED_P1`, `INCONCLUSIVE`.

## `RL_EXECUTION_PORTFOLIO` Task Board Items

Registry-active rows for the locked `06_realizacja/RL_EXECUTION_PORTFOLIO` dispatch:

| Task ID | Scope anchor | Priority | Status | Change type | Depends on | Evidence | Source card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `RL-PORT-P0-001` | `06_realizacja/RL_EXECUTION_PORTFOLIO` | `P0` | `READY` | `docs/test` | owner acceptance recommendation | route `/implementation`; component `ExecutionHub` / Menu 3-right controls; API governed chat/runtime boundary; test/UI smoke evidence for no duplicate AI toolbar | `functions/RL_EXECUTION_PORTFOLIO.md` |
| `RL-PORT-P1-001` | `06_realizacja/RL_EXECUTION_PORTFOLIO` | `P1` | `WAITING_P0` | `test` | `RL-PORT-P0-001` | route `/implementation`; component `ExecutionHub`; API n/a for route render; route smoke or Playwright evidence for protected/gated rendering | `functions/RL_EXECUTION_PORTFOLIO.md` |
| `RL-PORT-P2-001` | `06_realizacja/RL_EXECUTION_PORTFOLIO` | `P2` | `WAITING_P0` | `docs/test` | `RL-PORT-P0-001`, `RL-PORT-P1-001` | route `/implementation`; components `TableWithPreviewLayout`, `ExecutionInitiativesKanbanView`, `ExecutionTimelineView`; API V8 execution-control where signals appear; UI evidence links for table/kanban/timeline | `functions/RL_EXECUTION_PORTFOLIO.md` |

Registry sync completed: `2026-05-10`, docs-only. Owner acceptance recommendation: approve these rows for future execution; non-dispatched Portfolio expansion rows are intentionally not active in this registry pass.

## `RL_ROLLOUT_VIEW` Task Board Items

| ID | Priority | Area | Ready task | Acceptance / evidence |
| --- | --- | --- | --- | --- |
| `RL-ROLL-P0-001` | `P0` | UI governance | Validate `/rollout` AI action placement and move any duplicate/non-Menu-3 action to Menu 3/right-side or accepted row-scoped placement. | UI smoke screenshot/recording proving no duplicate AI toolbar and no hidden high-impact AI action. |
| `RL-ROLL-P0-002` | `P0` | Safety/governance | Validate high-impact rollout actions: auto-schedule, optimizer apply, conflict resolution, timeline update and rebaseline. | Evidence that each is proposal/reviewed mutation with affected-object diff and no silent write. |
| `RL-ROLL-P1-001` | `P1` | QA coverage | Add or identify `/rollout` component/regression coverage for loading, empty, error, degraded, partial and success states. | Test path or manual Anygravity evidence linked here. |
| `RL-ROLL-P1-002` | `P1` | Evidence docs | Capture baseline/current/forecast/conflict UI evidence for one healthy and one degraded rollout. | Evidence links proving degraded/partial data is labelled. |
| `RL-ROLL-P2-001` | `P2` | API traceability | Link concrete API/read-back paths used by rollout timeline and conflict data once runtime wiring is audited. | Route/component/API/test matrix updated from generic V8 execution-control evidence to exact route data flow. |

## `RL_EXECUTION_PORTFOLIO` Open Questions

1. Do preview/footer chat actions in Portfolio count as row-scoped actions under the Menu 3 rule?
2. Which automated route smoke style is canonical for `/implementation` in the current QA canon?
3. What exact approval/diff depth is required for each high-impact Portfolio write class?

## Gate Readiness

| Function | Docs contract | UI/UX annex | Acceptance evidence | Runtime code change | Gate |
| --- | --- | --- | --- | --- | --- |
| `RL_EXECUTION_PORTFOLIO` | complete for docs closeout | complete with P0/P1/P2 | route/component/API/test matrix present; UI placement and dedicated component regression remain gaps | none | `APPROVED_FOR_DOCS` |
| `RL_FULL_EXECUTION_VIEW` | complete for docs closeout | complete with P0/P1/P2 | route/component/API/test-reference matrix present; fresh runtime output and AI placement evidence remain gaps | none | `APPROVED_FOR_DOCS_WITH_P1_UI_GATE` |
| `RL_ROLLOUT_VIEW` | complete for docs closeout | complete with P0/P1/P2 | route/component/API/test matrix present; UI placement, high-impact action review and dedicated component regression remain gaps | none | `APPROVED_FOR_DOCS_WITH_P1_RISKS` |
| `RL_EXECUTION_MANAGER` | complete for docs closeout | complete with manager-lane matrix and anti-patterns | route/component/API/test matrix present; provenance, approval UI and dedicated component regression remain gaps | none | `APPROVED_FOR_DOCS` |

## Integration Evidence Baseline — 2026-05-10

| Function | Route evidence | Component evidence | API/service evidence | Test evidence | Integrated gate |
| --- | --- | --- | --- | --- | --- |
| `RL_EXECUTION_PORTFOLIO` | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`, `/implementation` | `ExecutionHub`, `TableWithPreviewLayout`, `ExecutionInitiativesKanbanView`, `ExecutionTimelineView` | `src/services/api.ts`, `src/services/api/v8/execution-control.ts`, `src/services/executionWriteTruth.ts` | V8 client/backend tests and write-truth helper tests; no dedicated list-tab UI state regression found | `APPROVED_FOR_DOCS`, runtime `BLOCKED_P1` |
| `RL_EXECUTION_REPORTS` | `/implementation`, `ExecutionHub` reports tab | `ExecutionHub`, `ReportDocumentView`, `executionReports.ts` | V8 execution-control and shared report data context | API tests only; no full reports UI state or `missing_evidence` assertion found | `APPROVED_FOR_DOCS`, runtime `BLOCKED_P1` |
| `RL_EXECUTION_MANAGER` | `/implementation`, `ExecutionHub` manager tab | `ExecutionManagementView`, `ManagerModuleView`, `AiRecommendationPanel` | V8 manager problem/action/AI routes | `server/src/routes/v8/__tests__/p03-manager-routes.test.ts`; no dedicated provenance/approval UI regression found | `APPROVED_FOR_DOCS`, runtime `BLOCKED_P1` |
| `RL_FULL_EXECUTION_VIEW` | `/execution` route | `FullExecutionView` delegates to `ExecutionHub` | shared execution runtime APIs | e2e/smoke references exist; no fresh route-shell output attached | `APPROVED_FOR_DOCS`, runtime `BLOCKED_P1` |
| `RL_ROLLOUT_VIEW` | `/rollout` route | `FullRolloutView`, `FullRolloutWorkspace`, `SplitLayout`, `AIFeedbackButton` | V8 timeline/delay/capacity/update contracts where wired | route protection and V8 API tests; no dedicated rollout workspace regression found | `APPROVED_FOR_DOCS`, runtime `BLOCKED_P1` |

## Integrated P1 Runtime Evidence Required Before DONE

| ID | Function | Evidence required | Reason |
| --- | --- | --- | --- |
| `RL-INT-P1-001` | all | UI smoke or automated assertion proving contextual AI actions are Menu 3/right-side, local action-zone or row-scoped with no duplicates. | Required by UI/UX and AI actions Menu 3 rules. |
| `RL-INT-P1-002` | `RL_EXECUTION_REPORTS` | Automated or accepted manual evidence that source-less reports are `missing_evidence`, not success/finalized. | Prevents false reporting trust. |
| `RL-INT-P1-003` | `RL_EXECUTION_MANAGER` | Before/after evidence for high-impact manager action approval, source entity, affected entities, actor, API result and verification/read-back posture. | Prevents hidden mutation and fake success. |
| `RL-INT-P1-004` | `RL_ROLLOUT_VIEW` | Evidence that auto-schedule, optimizer, conflict resolution, timeline update and rebaseline are proposal/review flows before mutation. | Prevents silent schedule rewrites. |
| `RL-INT-P1-005` | all | Loading/empty/error/degraded/success state matrix for Portfolio, Reports, Manager, `/execution` and `/rollout`. | Required before runtime DONE. |

## `RL_EXECUTION_REPORTS` Registry Rows

Scope anchor: `06_realizacja/RL_EXECUTION_REPORTS`.

| Task ID | Scope anchor | Priority | Status | Change type | Depends on | Evidence (route/component/API/test) | Source card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `RL-REP-P0-001` | `06_realizacja/RL_EXECUTION_REPORTS` | `P0` | `READY` | `runtime/test` | none | route `/implementation`; components `ExecutionHub` reports tab, `ReportDocumentView`, `executionReports.ts`; APIs `src/services/api.ts`, `src/services/api/v8/execution-control.ts`, `server/src/routes/v8/execution-control.routes.ts`; test or accepted manual evidence that source-less report is `missing_evidence`, not success/finalized | `functions/RL_EXECUTION_REPORTS.md` |
| `RL-REP-P1-001` | `06_realizacja/RL_EXECUTION_REPORTS` | `P1` | `WAITING_P0` | `test` | `RL-REP-P0-001` | route `/implementation`; components reports table/grid/document; APIs shared report source context and V8 execution-control fallback envelopes; test or accepted manual state matrix for loading, empty, error, degraded, `missing_evidence` and success | `functions/RL_EXECUTION_REPORTS.md` |
| `RL-REP-P2-001` | `06_realizacja/RL_EXECUTION_REPORTS` | `P2` | `WAITING_P0` | `docs/test` | `RL-REP-P0-001`, `RL-REP-P1-001` | route `/implementation`; components reports table/grid/document; API/source context preserved; screenshot/recording links or manual evidence references for table, grid and document states | `functions/RL_EXECUTION_REPORTS.md` |

Registry sync note: the locked dispatch card registered only `RL-REP-P0-001`, `RL-REP-P1-001` and `RL-REP-P2-001`. Previously listed adjacent report rows are not duplicated here unless the owner dispatches them in a later card.

## `RL_EXECUTION_MANAGER` Evidence Matrix

| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Manager Lane entry is `/implementation` through `ExecutionHub` tab `people_change`. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/Execution/ExecutionHub.tsx`, `src/components/Execution/ExecutionManagementView.tsx` | n/a | route-specific manager smoke not found | `PASS_WITH_P2` |
| Manager cards cover action queue, decisions, blockers, risk, workload and people/change. | `/implementation` | `ExecutionManagementView` presets/tiles | `src/services/api/v8/execution-control.ts` manager problem helpers | `server/src/routes/v8/__tests__/p03-manager-routes.test.ts` | `PASS_WITH_P2` |
| Lane subviews use table + preview and row-scoped actions. | `/implementation` | `src/components/Execution/ManagerModuleView.tsx`, `ProblemTable`, `ProblemPreview` | manager problem-action execute endpoint | backend route tests cover action endpoint; UI regression missing | `PASS_WITH_P2` |
| Manager AI assists recommendation, triage and action planning without approval authority. | `/implementation` Manager lanes | `src/components/Execution/Manager/AiRecommendationPanel.tsx` | `getAiRecommendation`, `getAiTriage`, `getAiManageAll` endpoints | `server/src/routes/v8/__tests__/p03-manager-routes.test.ts` | `PASS_WITH_P2` |
| High-impact manager actions are explicit mutation calls. | `/implementation` Manager lanes | visible action handlers in `ManagerModuleView` and lane workspaces | problem action, suggestion apply, lane decision, lane execute and intervention endpoints | backend route evidence exists; approval-dialog/read-back UI evidence missing | `PASS_WITH_P2` |
| Workload lane uses capacity-control truth where available. | `/implementation` Manager workload lane | `ExecutionManagementView` workload card and manager lane problem views | `getCapacityLevelingAlerts`, `getCapacityTimeline`, manager problem APIs | `tests/unit/services/v8-execution-control-api.test.ts`, `server/src/routes/v8/__tests__/execution-control.routes.test.ts` | `PASS` for API evidence, `PASS_WITH_P2` for UI evidence |
| Provenance is visible for rows, recommendations and action outputs. | `/implementation` Manager lanes | `ProblemPreview`, `AiRecommendationPanel` consume source/affected entity fields | manager problem/analysis payloads | no dedicated provenance UI regression found | `BLOCKED_P1` until UI evidence validates source rendering |
| Security/tenancy is deny-by-default. | protected route family | protected execution runtime plus Manager lane UI | manager routes derive `organizationId` and `userId` from V8 context and reject invalid lanes | `server/src/routes/v8/__tests__/p03-manager-routes.test.ts` auth-context harness | `PASS_WITH_P2` |

## `RL_EXECUTION_MANAGER` Manager-Lane Matrix

| Manager card / lane | Control question | Evidence inputs | High-impact approval cases | Anti-pattern to test against |
| --- | --- | --- | --- | --- |
| `Action Queue` / `action-queue` | What needs manager attention now? | due-soon tasks, stale work, escalations, queue items | task/owner/date/blocker updates | hidden queue clearing or fake handled state |
| `Decisions & Approvals` / `decisions` | Which decisions block execution? | pending decisions, overdue approvals, dependency chains | approve/reject/defer, decision escalation | silent approval or missing decision provenance |
| `Blockers & Escalations` / `blockers` | What is blocked and who must unblock it? | blocked initiatives/tasks, critical blockers, recovery proposals | blocker closure, mitigation, escalation | silent blocker closure or success without verification |
| `Execution Risk` / `risk` | Which risks threaten delivery credibility? | risk signals, delay signals, critical-path pressure, KPI deviations | mitigation update, risk-state change, escalation, deadline impact | degraded risk data presented as current truth |
| `Resource & Workload` / `workload` | Where is capacity unrealistic? | workload counts, capacity alerts, due-soon pressure, missing estimates | reassignment, smoothing, deadline or capacity-assumption change | silent rebalance or hidden deadline impact |
| `People & Change` / `people-change` | Where are ownership/change gaps blocking adoption? | owner gaps, sponsor gaps, stakeholder/change-readiness signals | ownership/accountability change, stakeholder escalation | unscoped people data exposure or fabricated readiness |

## `RL_EXECUTION_MANAGER` Registry Sync Rows — Locked Dispatch 2026-05-10

| Task ID | Scope anchor | Priority | Status | Change type | Depends on | Evidence | Source card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `RL-MGR-P0-001` | `06_realizacja/RL_EXECUTION_MANAGER` | `P0` | `READY` | `docs/test` | owner acceptance | route/component/API/test | `functions/RL_EXECUTION_MANAGER.md` |
| `RL-MGR-P1-001` | `06_realizacja/RL_EXECUTION_MANAGER` | `P1` | `WAITING_P0` | `docs/test` | `RL-MGR-P0-001` | route/component/API/test | `functions/RL_EXECUTION_MANAGER.md` |
| `RL-MGR-P2-001` | `06_realizacja/RL_EXECUTION_MANAGER` | `P2` | `WAITING_P0` | `docs/test` | `RL-MGR-P0-001`,`RL-MGR-P1-001` | route/component/API/test | `functions/RL_EXECUTION_MANAGER.md` |

Registry sync completed without promoting dependency scope. Owner acceptance recommendation: approve for future implementation planning after the P0 row is accepted and Manager lane remains the only primary scope.

## `RL_EXECUTION_MANAGER` Open Questions

1. Which approval UI depth is canonical for high-impact manager actions: confirm dialog, diff panel or approval workflow object?
2. Do local lane action buttons registered by `onRegisterActions` count as the accepted Menu 3/local command-row slot?
3. What read-back/verification status is mandatory before final success for each high-impact action class?

## RAW Evidence Trace Annex — 2026-05-11

| Critical thesis | RAW source | Contract decision | Evidence / closure |
| --- | --- | --- | --- |
| Execution reports cannot show clean success/finalization without source/provenance. | `docs/RAW/implementation-pmo/107_RAW_IMPLEMENTATION_PMO_ENGINE_2026-05-09.md`; `docs/RAW/execution-hub/103_RAW_EXECUTION_HUB_AI_EXECUTION_MANAGEMENT_ENGINE_2026-05-09.md` | `ENHANCE` missing-evidence report guard. | `RL-REP-P0-001` evidence `NOT_DONE`. |
| Rollout/manager high-impact actions must be proposal/review/read-back flows. | same RAW sources | `KEEP` no hidden approval/rebaseline/mutation. | route/component/API baseline exists; approval/read-back tests `NOT_DONE`. |
