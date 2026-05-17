---
module_id: MODULE_EXECUTION
doc_kind: UI_UX
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-10
---

# UI/UX — Realizacja / Implementation & PMO

## 1. Main Screen

As-Is: the execution lane uses `FullExecutionView`, `ExecutionHub` and `FullRolloutView` under one sidebar module. `ExecutionHub` provides ModuleHub-style kanban/timeline/report/manager controls, table+preview, drag-and-drop task handling and execution signal components.

## 2. Runtime States

- Loading: task, rollout, report and signal loads must show explicit state flags or loaders.
- Empty: empty boards/tables/reports must say whether no execution work exists, no filter matches or data is unavailable.
- Error: guarded components/callouts and toast feedback must surface failures.
- Degraded: fallback service logic, disabled non-core modules or partial execution data must be visible as degraded, not success.
- Success: task moves, status updates or report generation must confirm the result and identify the next blocker/review/follow-up.

## 3. Menu 2 / Menu 3 Contract

Menu 2 keeps the execution module shell. Menu 3 is the active execution command row/filter/action zone for selected view, row, task or rollout context. Row actions may exist when scoped to one record.

## 4. AI Actions Placement

AI/chat contextual openers must be invoked through explicit Menu 3/right-side or row-scoped actions. No route wrapper may add a duplicate secondary AI toolbar under the canvas.

## 5. Next Action Guidance

Execution UX must tell the user whether to assign/advance a task, resolve a blocker, review a signal, retry failed data, open a rollout view or wait for gated access.

## 6. Source / Evidence / Provenance

Execution reports, blockers and signals must expose source tasks, initiatives, owners or data inputs. Generated summaries must identify evidence or disclose missing/partial evidence.

## 7. Approval / Diff / Review

Execution mutations are explicit authenticated actions. High-impact status changes, rollout decisions and generated report finalization require review/approval and must leave visible feedback/audit where supported.

## 8. Anti-Patterns

- Drag/drop or status mutation without visible confirmation.
- Fallback/degraded data presented as current truth.
- AI execution action duplicated in canvas and Menu 3.
- Hidden production gate or role denial.
- Report without source tasks/signals.

## 9. As-Is Gaps

- Existing docs confirm protected/gated wrappers and fallback states, but do not enumerate all task mutation review/diff patterns.
- Provenance rendering for each execution report/signal path needs runtime validation.

## 10. Acceptance Criteria

- Execution routes render the documented execution/rollout hub surfaces.
- Loading, empty, error, degraded and success states are explicit.
- AI/chat actions use Menu 3/right-side or row-scoped placement without duplication.
- Reports/signals show source/provenance.
- High-impact execution mutations require explicit review/approval.

## 11. Function Annex — Execution Functions

| Function ID | Function | Entry / Route | As-Is state | UI Component Footprint (key) | Contract |
| --- | --- | --- | --- | --- | --- |
| `RL_EXECUTION_PORTFOLIO` | Execution Portfolio Operations | `/implementation` (hub tab `list`) | real | `ExecutionHub` list modes (table/kanban/timeline) | `functions/RL_EXECUTION_PORTFOLIO.md` |
| `RL_EXECUTION_REPORTS` | Execution Reports | `ExecutionHub` tab `reports` | real | report catalog/report preview controls in `ExecutionHub` | `functions/RL_EXECUTION_REPORTS.md` |
| `RL_EXECUTION_MANAGER` | Manager Lane | `ExecutionHub` tab `people_change` | real | manager metrics/suggestions views in `ExecutionHub` | `functions/RL_EXECUTION_MANAGER.md` |
| `RL_FULL_EXECUTION_VIEW` | Full Execution Route | `/execution` | real | `FullExecutionView` | `functions/RL_FULL_EXECUTION_VIEW.md` |
| `RL_ROLLOUT_VIEW` | Rollout View | `/rollout` | real | `FullRolloutView` | `functions/RL_ROLLOUT_VIEW.md` |

## 11A. Integration UI/UX Gate Baseline

| Function | Required UI states | Menu 3 / AI placement baseline | Evidence status | Gate |
| --- | --- | --- | --- | --- |
| `RL_EXECUTION_PORTFOLIO` | loading, empty, error, degraded, success for table/kanban/timeline | `ExecutionHub` has `rightControls`; preview/footer chat actions require row-scoped validation. | route/component/API/test baseline exists; no placement smoke attached. | `BLOCKED_P1` for runtime UI gate, `APPROVED_FOR_DOCS` |
| `RL_EXECUTION_REPORTS` | loading, empty, error, degraded, `missing_evidence`, success for table/grid/document | Report actions must be command-row/right-side, report-row, preview or document scoped. | catalog/provenance contract exists; no missing-evidence UI assertion attached. | `BLOCKED_P1` for runtime UI gate, `APPROVED_FOR_DOCS` |
| `RL_EXECUTION_MANAGER` | loading, empty, error, degraded, success for six manager lanes | Lane actions must use Menu 3/right-side, local action-zone or row-scoped placement. | manager lane/API evidence exists; UI provenance and approval evidence missing. | `BLOCKED_P1` for runtime UI gate, `APPROVED_FOR_DOCS` |
| `RL_FULL_EXECUTION_VIEW` | route shell loading/denial/error plus inherited hub states | Route wrapper must not add duplicate contextual AI toolbar; inherited `ExecutionHub` placement needs audit on `/execution`. | wrapper evidence exists; no fresh `/execution` placement smoke. | `BLOCKED_P1` for runtime UI gate, `APPROVED_FOR_DOCS` |
| `RL_ROLLOUT_VIEW` | loading, empty, error, degraded/partial, success for rollout baseline/current/forecast/conflict states | `FullRolloutView` currently renders `AIFeedbackButton` and `SplitLayout` chat; must be validated or moved to Menu 3/right-side equivalent. | route/component/API baseline exists; no rollout placement/state evidence attached. | `BLOCKED_P1` for runtime UI gate, `APPROVED_FOR_DOCS` |

Integration rule: no contextual AI action may be duplicated between Menu 3/right-side/local action-zone and canvas. Row-scoped actions are allowed only when the action acts on one selected execution object and does not duplicate a command-row action.

## 11B. Registry Sync Annex — `RL_EXECUTION_REPORTS`

Scope anchor: `06_realizacja/RL_EXECUTION_REPORTS`.

| Task ID | UI/UX obligation | Required UI states | Evidence gate | Status |
| --- | --- | --- | --- | --- |
| `RL-REP-P0-001` | Source-less reports must surface `missing_evidence` and must not show clean success/finalization. | degraded, `missing_evidence`, blocked success | screenshot/recording or automated assertion for reports tab/document showing source-less report is not success | `READY` |
| `RL-REP-P1-001` | Reports tab state matrix must distinguish data load, no execution data, filter-empty, failure, degraded inputs, missing evidence and success. | loading, empty, error, degraded, `missing_evidence`, success | UI state matrix linked in `07_ACCEPTANCE_AND_TESTS.md` | `WAITING_P0` |
| `RL-REP-P2-001` | Visual evidence must cover report table, grid and document states without creating extra canvas toolbars. | table, grid, document, provenance footer | screenshots/recordings or accepted manual evidence linked in acceptance docs | `WAITING_P0` |

Registry sync note: `RL_EXECUTION_REPORTS` UI/UX rows are normalized for the locked dispatch card. Adjacent Portfolio, Manager and Results scopes are impact-only and are not redefined here.

## 12. Function Annex — `RL_EXECUTION_PORTFOLIO`

### 12.1 Decision

`RL_EXECUTION_PORTFOLIO` is the Portfolio surface of the Execution operating system. Its promise is one reliable working list of active execution initiatives with immediate preview and standard execution views. It must not become a planning module, report generator, manager cockpit or custom dashboard builder.

### 12.2 UI/UX Contract

| UX claim | Route evidence | Component evidence | API evidence | Test evidence | Gate |
| --- | --- | --- | --- | --- | --- |
| Entry surface is `/implementation` and opens `ExecutionHub`. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/Execution/ExecutionHub.tsx` | n/a | route-specific smoke evidence not found | `PASS_WITH_P2` |
| Portfolio is the `list` tab, not a separate runtime. | `/implementation` route | `ExecutionHub` `initialTab='list'`, `tabs` include `list`, `reports`, `people_change` | shared execution truth via V8 execution-control where used | doc/code inspection only | `PASS_WITH_P2` |
| Portfolio allowed views are table, kanban and timeline. | `/implementation` | `ExecutionHub` restricts `activeTab === 'list'` to `table`, `kanban`, `timeline`; renders `TableWithPreviewLayout`, `ExecutionInitiativesKanbanView`, `ExecutionTimelineView` | n/a | no dedicated `ExecutionHub` view-mode test found | `PASS_WITH_P2` |
| Table mode follows table + preview canon. | `/implementation` | `TableWithPreviewLayout`, `InitiativePreviewV3Body`, `InitiativePreviewV3Footer` | source objects through shared `Api` and initiative/task data | no dedicated component regression found | `PASS_WITH_P2` |
| Kanban movement is a bounded visible action. | `/implementation` | `ExecutionInitiativesKanbanView`, drag/drop handlers, toast feedback | `Api.patch('/tasks/:id')`; read-back helper `refreshExecutionWriteTruth` where applied | `tests/unit/services/executionWriteTruth.test.ts`; no end-to-end kanban movement test found | `PASS_WITH_P2` |
| Timeline mode surfaces schedule truth and warnings. | `/implementation` | `ExecutionTimelineView`, timeline warning state | `V8ExecutionControlApi.getTimelineWarnings`, legacy fallback `/api/execution-control/timeline-warnings` | `tests/unit/services/v8-execution-control-api.test.ts`, `server/src/routes/v8/__tests__/execution-control.routes.test.ts` | `PASS` |
| Loading, empty, error, degraded and success states are explicit. | `/implementation` | `ExecutionHub` loader/empty messages, guarded fallback, toasts | V8 execution-control fallback helpers and route envelopes | partial service/API tests; no full UI state matrix found | `PASS_WITH_P2` |
| AI actions appear only in Menu 3/right-side or row-scoped placement. | `/implementation` | `ExecutionHub` `rightControls`; preview/footer chat actions require runtime placement audit | governed chat runtime outside this function | no dedicated placement test found | `BLOCKED_P1` until UI placement evidence is captured |

### 12.3 Menu 3 / AI Placement Rules

- Portfolio filters, counters, view switching and scope controls must remain in the single command row.
- Contextual AI actions must use `rightControls`, Menu 3/right-side or row-scoped actions only.
- Preview/footer chat actions are allowed only if accepted as row-scoped actions; otherwise they must move to the right-side command row slot.
- The same AI action must not appear both in Menu 3 and in the canvas.

### 12.4 Runtime State Requirements

- Loading: show route/data loading state.
- Empty: distinguish no execution initiatives, no filter matches and data unavailable.
- Error: failed loads and failed mutations surface visible error or toast feedback.
- Degraded: missing baseline, missing estimate, stale data, partial refresh failure or legacy fallback is labelled as degraded.
- Success: status/task movement and refresh actions confirm completion and make the next action clear.

### 12.5 P0/P1/P2 Task Board Items

Registry-active rows for the locked `06_realizacja/RL_EXECUTION_PORTFOLIO` dispatch:

| Task ID | Scope anchor | Priority | Status | Change type | Depends on | Evidence | Source card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `RL-PORT-P0-001` | `06_realizacja/RL_EXECUTION_PORTFOLIO` | `P0` | `READY` | `docs/test` | owner acceptance recommendation | route `/implementation`; component `ExecutionHub` / Menu 3-right controls; API governed chat/runtime boundary; test/UI smoke evidence for no duplicate AI toolbar | `functions/RL_EXECUTION_PORTFOLIO.md` |
| `RL-PORT-P1-001` | `06_realizacja/RL_EXECUTION_PORTFOLIO` | `P1` | `WAITING_P0` | `test` | `RL-PORT-P0-001` | route `/implementation`; component `ExecutionHub`; API n/a for route render; route smoke or Playwright evidence for protected/gated rendering | `functions/RL_EXECUTION_PORTFOLIO.md` |
| `RL-PORT-P2-001` | `06_realizacja/RL_EXECUTION_PORTFOLIO` | `P2` | `WAITING_P0` | `docs/test` | `RL-PORT-P0-001`, `RL-PORT-P1-001` | route `/implementation`; components `TableWithPreviewLayout`, `ExecutionInitiativesKanbanView`, `ExecutionTimelineView`; API V8 execution-control where signals appear; UI evidence links for table/kanban/timeline | `functions/RL_EXECUTION_PORTFOLIO.md` |

Registry sync completed: `2026-05-10`, docs-only. Owner acceptance recommendation: approve these three rows as the active Portfolio UI/UX evidence backlog and dispatch any extra Portfolio rows separately.

### 12.6 Open Questions

1. Do preview/footer chat actions count as row-scoped under the Menu 3 rule, or must all Portfolio AI actions move into `rightControls`?
2. Which route smoke standard is canonical for `/implementation` in the current QA canon?
3. What approval/diff depth is required for each high-impact Portfolio write class?

## 13. Function Annex — `RL_EXECUTION_MANAGER`

### 13.1 Decision

`RL_EXECUTION_MANAGER` is the Manager/control-tower lane of the Execution operating system. Its promise is not another dashboard, but a scoped operator cockpit where decisions, risks, blockers, workload and people/change gaps become traceable action lanes with explicit approval for high-impact actions.

### 13.2 Manager-Lane Matrix

| Manager card / lane | UX promise | Action lane | Approval rule | Evidence expectation |
| --- | --- | --- | --- | --- |
| `Action Queue` / `action-queue` | Shows work requiring manager attention now. | open source object, follow-up/action plan, queue item execution | Required before task/owner/date/blocker state changes. | row shows source/affected entity and action result. |
| `Decisions & Approvals` / `decisions` | Shows decisions blocking downstream execution. | decision pack, approve/reject/defer, escalation | Required for every decision-state transition. | decision source, affected work and actor are visible. |
| `Blockers & Escalations` / `blockers` | Shows blocked work and recovery candidates. | recovery plan, escalation, unblock follow-up | Required for blocker closure, mitigation or escalation. | blocker source and recovery impact are visible. |
| `Execution Risk` / `risk` | Shows delivery risk, delay and early-warning pressure. | watchlist, mitigation update, escalation, recovery plan | Required for mitigation, risk-state change or deadline impact. | risk source, confidence and degraded state are visible. |
| `Resource & Workload` / `workload` | Shows overload, under-capacity and capacity-confidence gaps. | rebalance, reassignment, smoothing, replan | Required for owner, deadline, smoothing or capacity-assumption changes. | workload source and deadline impact are visible. |
| `People & Change` / `people-change` | Shows ownership, sponsor, stakeholder and change gaps. | ownership fix, communication follow-up, escalation | Required for accountability or stakeholder escalation changes. | people/change source is scoped and tenant-safe. |

### 13.3 UI/UX Contract

| UX claim | Route evidence | Component evidence | API evidence | Test evidence | Gate |
| --- | --- | --- | --- | --- | --- |
| Manager entry is `/implementation` through `ExecutionHub` tab `people_change`. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/Execution/ExecutionHub.tsx`, `src/components/Execution/ExecutionManagementView.tsx` | n/a | route-specific manager smoke not found | `PASS_WITH_P2` |
| Manager cards cover action queue, decisions, blockers, risk, workload and people/change. | `/implementation` route | `ExecutionManagementView` presets/tiles | `V8ExecutionControlApi.getManagerProblems` | `server/src/routes/v8/__tests__/p03-manager-routes.test.ts` | `PASS_WITH_P2` |
| Lane subviews use table + preview with row-scoped actions. | `/implementation` | `ManagerModuleView`, `ProblemTable`, `ProblemPreview` | `executeManagerProblemAction` | backend action-route evidence exists; UI regression missing | `PASS_WITH_P2` |
| AI/workspace actions assist, but do not approve high-impact actions. | `/implementation` Manager lanes | `AiRecommendationPanel`, local lane action registration | manager AI endpoints and mutation endpoints remain separate | manager route tests cover endpoint family; UI placement evidence missing | `PASS_WITH_P2` |
| High-impact actions require explicit approval and visible feedback. | `/implementation` Manager lanes | visible action handlers, toasts, refresh | manager problem action, suggestion, decision, execute and intervention endpoints | approval-dialog/read-back evidence missing | `PASS_WITH_P2` |
| Provenance is visible for rows, recommendations and action outputs. | `/implementation` Manager lanes | `ProblemPreview`, `AiRecommendationPanel` consume source/affected entity fields | manager problem/analysis payloads | no dedicated provenance UI regression found | `BLOCKED_P1` until UI evidence exists |

### 13.4 Menu 3 / AI Placement Rules

- Manager lane selectors and counters remain in the active Manager command/filter row.
- Lane-level AI/workspace actions must use the local action-zone registered by `onRegisterActions`, `ModuleHub.rightControls` or another Menu 3/right-side equivalent.
- Row-level AI recommendation is allowed only when scoped to one problem/source entity.
- The same AI triage/recommend/action-plan control must not appear both in Menu 3/local action-zone and as a duplicate canvas toolbar.

### 13.5 Runtime State Requirements

- Loading: show lane/problem/action/AI loading state.
- Empty: distinguish no executing initiatives, no lane problems and no search/filter match.
- Error: failed manager problem loads, AI calls and mutations surface visible error or toast feedback.
- Degraded: missing source, missing baseline/estimate, weak capacity data, low AI confidence and partial evidence are labelled degraded/low-confidence.
- Success: action result must state what changed or was queued and refresh/read back lane state where supported.

### 13.6 Anti-Patterns

- Hidden mutation: AI or manager action changes owner, timing, risk, blocker, capacity or decision state without visible approval.
- No provenance: problem row, recommendation or lane count lacks source entity/evidence lineage.
- Fake success: UI reports success when API failed, skipped affected entities, returned partial data or could not verify the result.

### 13.7 P0/P1/P2 Task Board Items

| ID | Priority | Task | Acceptance evidence |
| --- | --- | --- | --- |
| `RL-MGR-P0-001` | `P0` | Validate Manager AI/action placement across six lanes and remove any duplicate canvas toolbar. | UI smoke evidence for `/implementation` Manager tab showing one placement only. |
| `RL-MGR-P0-002` | `P0` | Validate explicit approval for high-impact manager actions. | Before/after evidence with actor, source, affected entities and visible feedback. |
| `RL-MGR-P1-001` | `P1` | Cover Manager cards, lane subviews, table/preview and loading/empty/error/degraded states. | Automated test or manual UI smoke evidence linked in `07_ACCEPTANCE_AND_TESTS.md`. |
| `RL-MGR-P1-002` | `P1` | Validate provenance rendering for rows, previews and AI recommendations. | UI evidence showing source/affected entities and confidence/degraded states. |
| `RL-MGR-P2-001` | `P2` | Capture screenshots/recordings for all six Manager cards and lane states. | Evidence links in acceptance matrix. |
| `RL-MGR-P2-002` | `P2` | Add client API helper coverage for manager endpoints if missing. | Unit-test evidence for V8 manager helper calls. |

### 13.8 Open Questions

1. Which approval UI depth is canonical for Manager high-impact actions: confirm dialog, diff panel or approval workflow object?
2. Do local lane action buttons registered by `onRegisterActions` count as the accepted Menu 3/local command-row slot?
3. What read-back/verification status is mandatory before final success for each high-impact action class?

## 14. Function Annex — `RL_FULL_EXECUTION_VIEW`

### 14.1 Decision

`RL_FULL_EXECUTION_VIEW` is the full-step `/execution` entry into the execution lane. Its UI promise is route continuity: users who enter through `/execution` must land in the same governed execution operating surface, not in a second execution product.

`FullExecutionView` currently delegates to `ExecutionHub`, so the route inherits the shared Portfolio/Raporty/Manager runtime. This is allowed only while it preserves one execution truth and does not create duplicate route-local controls, status models or AI toolbars.

### 14.2 Route / Navigation Contract

| UX claim | Route evidence | Component evidence | API evidence | Test evidence | Gate |
| --- | --- | --- | --- | --- | --- |
| `/execution` is an active full execution route. | `src/routes/routeConfig.ts` declares `ROUTES.EXECUTION` and maps `AppView.FULL_STEP5_EXECUTION` to it. | n/a | n/a | `tests/e2e/smoke/wave1-module-closeout.spec.ts` includes `/execution`; not rerun for this docs-only closeout. | `PASS_WITH_P2` |
| `/execution` renders through the protected execution route shell. | `src/routes/AppRoutes.tsx` wraps `FullExecutionView` in `MainLayout`, `ProductionModuleGate`, `RouteErrorBoundary`, `Suspense`. | `src/views/FullExecutionView.tsx` | n/a | no fresh route-shell runtime evidence captured. | `PASS_WITH_P2` |
| `/execution` uses the shared execution runtime, not a duplicate product. | `/execution` route render map. | `FullExecutionView` returns `ExecutionHub`; `ExecutionHub` owns active execution UI. | shared execution-control services where used by `ExecutionHub` | `tests/e2e/execution-center.spec.ts` targets `/execution`; current pass/fail not asserted here. | `PASS_WITH_P2` |
| Navigation keeps `/execution`, `/implementation` and `/rollout` as related lane routes with separate function ownership. | `routeConfig.ts` maps route family; module codemap documents all three. | `FullExecutionView`, `ImplementationView`, `FullRolloutView` | n/a | no focused route-family navigation regression found. | `PASS_WITH_P2` |
| Entry denial/loading/error states are explicit. | `ProductionModuleGate`, `RouteErrorBoundary`, `Suspense` route shell. | shared `ExecutionHub` state handling | n/a | protected route smoke references `/execution`; no denial/error matrix captured. | `PASS_WITH_P2` |
| Degraded execution truth is disclosed. | route delegates to shared runtime. | `ExecutionHub` fallback/degraded state expectations | V8 execution-control/fallback contracts | no route-specific degraded UI evidence captured. | `PASS_WITH_P2` |
| AI actions appear only in Menu 3/right-side or row-scoped placement. | route wrapper adds no AI toolbar. | `ExecutionHub` command row/row action placement must be audited on `/execution`. | governed chat runtime outside this function | no `/execution` AI placement smoke evidence found. | `BLOCKED_P1` until UI evidence exists |

### 14.3 Menu 3 / AI Placement Rules

- `/execution` may inherit contextual actions from `ExecutionHub`, but the route wrapper must not add its own duplicate contextual AI toolbar.
- Filters, view controls and route-level actions must remain in the one command row/Menu 3 pattern used by the active shared runtime surface.
- Row-specific actions may remain row-scoped when they act on one execution object and do not duplicate the same action in the command row.
- Any future route-local AI action must be added through the right-side command-row slot or a documented row-scoped action.

### 14.4 Runtime State Requirements

- Loading: route shell and shared runtime loaders must make loading visible.
- Empty: no work, no filter matches and unavailable data must not be conflated.
- Error: route-level render failures and shared runtime load/action failures must surface safe feedback.
- Degraded: missing baseline, stale data, partial refresh and fallback execution data must be marked as degraded.
- Success: user-triggered writes or generated outputs must show visible completion and next action.

### 14.5 P0/P1/P2 Task Board Items

| ID | Priority | Task | Acceptance evidence |
| --- | --- | --- | --- |
| `RL-FULL-P0-001` | `P0` | Capture `/execution` UI placement evidence proving no duplicate AI toolbar and all contextual actions are Menu 3/right-side or row-scoped. | Screenshot/recording or Playwright assertion linked in `07_ACCEPTANCE_AND_TESTS.md`. |
| `RL-FULL-P1-001` | `P1` | Add or identify focused route smoke evidence for `/execution` rendering `FullExecutionView` behind protected/production gates. | Route smoke output or test path with latest run evidence. |
| `RL-FULL-P1-002` | `P1` | Reconcile `/execution` e2e expectations with the current shared `ExecutionHub` surface contract. | Updated QA note or passing test evidence for current route UI. |
| `RL-FULL-P2-001` | `P2` | Capture state-matrix evidence for loading, empty, error, degraded and success states on `/execution`. | Manual Anygravity evidence or automated state coverage references. |
| `RL-FULL-P2-002` | `P2` | Decide long-term route identity between `/execution` and `/implementation`. | Product decision added to module meta/status/codemap. |

### 14.6 Open Questions

1. Should `/execution` remain a primary full-step route or become a documented compatibility alias once `/implementation` is treated as the sidebar launch identity?
2. Which QA artifact is canonical evidence for `/execution`: protected route smoke, `execution-center` e2e, or a new route contract test?
3. Does the current inherited `ExecutionHub` AI/chat placement pass the Menu 3 rule on `/execution` without UI changes?

## 18. RAW Depth UI/UX Annex

| RAW source | UX decision | Evidence state |
| --- | --- | --- |
| `docs/RAW/implementation-pmo/107_RAW_IMPLEMENTATION_PMO_ENGINE_2026-05-09.md` | Execution UX must show stage/gate, RAID, decisions, blockers, PMO reports and source quality. | `PASS_DOC`; state-matrix evidence `NOT_DONE`. |
| `docs/RAW/execution-hub/103_RAW_EXECUTION_HUB_AI_EXECUTION_MANAGEMENT_ENGINE_2026-05-09.md` | AI execution actions must be triage/proposal/review flows, not silent mutation. | `PASS_DOC`; placement/read-back proof `NOT_DONE`. |
| `docs/RAW/calendar/109_RAW_CALENDAR_AI_WORKDAY_PROJECT_ENGINE_2026-05-09.md` | Calendar/workday signals are impact context for execution rhythm; no new ownership edge. | `IMPACT_ONLY`. |
