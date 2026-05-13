---
module_id: MODULE_EXECUTION
function_id: RL_EXECUTION_MANAGER
function_name: Execution — Manager Lane
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Manager Lane

## 1. Function Identity
- Function ID: `RL_EXECUTION_MANAGER`
- Runtime anchor: `ExecutionHub` tab `people_change` (`Manager`)
- Route scope: `/implementation`
- Feature state: `real`
- Scope anchor: `06_realizacja/RL_EXECUTION_MANAGER`
- Work type for this closeout: `docs-only`
- Canonical source documents:
  - `docs/modules/06_realizacja/03_BEHAVIOR.md`
  - `docs/modules/06_realizacja/04_UI_UX.md`
  - `docs/modules/06_realizacja/06_PERMISSIONS_AND_SECURITY.md`
  - `docs/modules/06_realizacja/07_ACCEPTANCE_AND_TESTS.md`
  - `docs/product/EXECUTION_CONTROL_TOWER_AND_OPERATOR_RUNTIME_V8.md`
  - `docs/product/EXECUTION_RESOURCE_BALANCING_AND_CAPACITY_OPERATIONS_V8.md`

## 2. User Job and Business Outcome
- Purpose: manager/control-tower lane for decisions, risks, workload, people/change gaps and governed intervention actions.
- Primary user question: "What requires manager intervention now, why, and what approved action should happen next?"
- Business outcome: one operator cockpit that turns execution signals into traceable, scoped and reviewable management actions without creating a second execution truth.
- Non-goals:
  - Do not replace `RL_EXECUTION_PORTFOLIO` as the working execution portfolio.
  - Do not replace `RL_EXECUTION_REPORTS` as the reporting/output lane.
  - Do not silently mutate tasks, owners, deadlines, risks, blockers or capacity assumptions.
  - Do not present AI recommendations, degraded data or partial evidence as approved execution truth.

## 3. Trigger and Entry Points
- Primary route: `/implementation`.
- Primary hub tab: `ExecutionHub` tab `people_change`.
- Primary components:
  - `src/components/Execution/ExecutionHub.tsx`
  - `src/components/Execution/ExecutionManagementView.tsx`
  - `src/components/Execution/ManagerModuleView.tsx`
  - `src/components/Execution/Manager/AiRecommendationPanel.tsx`
- Manager lane cards open subviews for six action lanes: `action-queue`, `decisions`, `blockers`, `risk`, `workload`, `people-change`.
- Related route family, for impact only: `/execution` and `/rollout` remain adjacent execution-lane surfaces but are outside this function's operating scope.

## 4. UI Component Footprint
- Manager cards:
  - `Action Queue`: tasks, decisions and escalations requiring manager attention.
  - `Decisions & Approvals`: pending or overdue decisions blocking downstream work.
  - `Blockers & Escalations`: blocked initiatives, critical risks and recovery actions.
  - `Execution Risk`: risk signals, delay detection and intervention suggestions.
  - `Resource & Workload`: per-person task load, utilization and capacity gaps.
  - `People & Change`: ownership gaps, stakeholder/accountability issues and change-readiness gaps.
- Action lane layout:
  - each lane opens a table plus preview workspace through `ManagerModuleView`;
  - lane-level AI/workspace actions are registered into the local action zone through `onRegisterActions`;
  - row actions must remain scoped to the selected problem and source entity;
  - AI recommendation panels may assist diagnosis, triage and action planning, but do not approve or execute high-impact actions by themselves.
- Menu 3 / command row:
  - Manager lane selectors, counters and lane-level AI/workspace actions must stay in the active command row/local action zone.
  - Contextual AI controls must be Menu 3/right-side, local lane action-zone or row-scoped only.
  - The same AI action must not be duplicated in a canvas toolbar and Menu 3.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs:
  - manager lane counts by severity,
  - active execution problems by lane,
  - pending decisions and approval aging,
  - blockers, risk signals and delay signals,
  - due-soon work and stale/overdue work,
  - workload/capacity alerts and timeline pressure,
  - ownership, sponsor, stakeholder and change-readiness gaps.
- Contract rule: Manager Lane consumes canonical execution objects and signal rollups. It does not create a second task, decision, risk, owner, deadline or capacity truth.
- API/service evidence:
  - shared API boundary: `src/services/api.ts`.
  - V8 execution-control client: `src/services/api/v8/execution-control.ts`.
  - manager lane routes: `server/src/routes/v8/execution-control.routes.ts`.
  - problem generation and action services: `server/src/services/v8/managerProblemsService.ts`, `server/src/services/v8/managerActionExecutionService.ts`, `server/src/services/v8/managerLaneAnalysisService.ts`, `server/src/services/v8/managerAiService.ts`.
- Dependency modules are impact-only:
  - `RL_EXECUTION_PORTFOLIO` provides the working portfolio context and source objects.
  - `RL_EXECUTION_REPORTS` may report manager-lane signals but does not own manager actions.
  - `RL_FULL_EXECUTION_VIEW` and `RL_ROLLOUT_VIEW` may surface adjacent execution context but must not bypass this function's approval rules.

## 6. Outputs and Side Effects
- Outputs:
  - prioritized manager problem rows,
  - lane cards and lane counts by severity,
  - row preview with source entity, affected entities and available actions,
  - AI-supported recommendation, triage, action-plan, decision-pack, recovery-plan, watchlist, rebalance and ownership-fix workspaces,
  - explicit management action execution result with visible success/error feedback.
- Side-effect rule: every write-class action must be user-triggered, authenticated, tenant-scoped and visibly acknowledged. Hidden mutation, silent AI execution and fake success states are out of scope.
- High-impact action classes:
  - execute manager problem action,
  - apply manager suggestion,
  - submit lane decision,
  - execute lane plan,
  - reassign owner,
  - smooth workload,
  - replan deadline,
  - escalate entity or blocker.

## 7. Ownership and Handoff Boundaries
- `RL_EXECUTION_MANAGER` owns exception triage and manager interventions.
- `RL_EXECUTION_PORTFOLIO` remains owner of list/kanban/timeline portfolio operation.
- `RL_EXECUTION_REPORTS` remains owner of report catalog, report generation and output handoff.
- Planning, staffing, decision and risk source records remain owned by their canonical modules/services.
- Manager Lane may recommend, coordinate and execute governed actions through approved APIs, but must not bypass source ownership, tenant boundaries or explicit approval.

## 8. Runtime States and UX Behavior
- Loading: lane cards, problem rows, AI panels and action execution must show loading state or disabled pending state.
- Empty: distinguish no executing initiatives, no lane problems and no filter/search match.
- Error: failed problem loads, AI calls and manager actions must show visible error or toast feedback.
- Degraded: missing baseline, missing estimate, weak workload/capacity data, low AI confidence, missing source entity or partial evidence must be labelled as degraded or low-confidence, not success.
- Success: action execution must confirm what changed or what was queued and refresh/read back the lane state where supported.
- Next action guidance must tell the manager whether to open source object, approve/reject a decision, escalate, rebalance, replan, assign owner, create recovery plan, retry data or wait for access.

## 9. AI, Source, Evidence, Approval
- AI actions:
  - may summarize lane problems, produce triage, recommend next steps, draft recovery plans, prepare decision packs and explain workload/risk patterns.
  - may not silently reassign work, change timing, close blockers, approve decisions, adjust capacity assumptions or apply execution changes.
  - must expose confidence and must disclose degraded/missing evidence.
- Source/evidence:
  - every problem row must identify source entity type/id where available.
  - affected entities, observations, suggestions, decisions and execution-plan steps must preserve lineage back to task, decision, initiative, risk, owner, milestone or capacity signal.
  - generated recommendations must identify evidence or explicitly state when evidence is partial, missing or low-confidence.
- Explicit approval for high-impact actions:
  - high-impact action must require an intentional user action from the lane/row/action panel.
  - approval UI must show action type, source entity, affected entities, expected impact and available before/after state when supported.
  - API execution must include authenticated user and organization context.
  - mutation response must expose success/failure and changed entities or verification status where supported.
  - deny-by-default applies when approval, authorization, tenancy, source provenance or impact scope is uncertain.
- Anti-patterns:
  - hidden mutation: applying owner, timing, risk, blocker, capacity or decision changes without a visible user-triggered approval.
  - no provenance: recommendation, lane count or problem row without source entity/evidence lineage.
  - fake success: toast or "done" state when API failed, returned partial data, skipped affected entities or could not verify read-back.

## 10. Security, Roles, and Tenancy
- Tenant, project, ACL, role and pilot gates are non-negotiable.
- Deny-by-default applies when authorization is uncertain.
- Managers see only scoped workload and source objects they are permitted to access.
- High-impact mutations require explicit approval and audit/metadata where supported.
- Sensitive internals, raw payloads, stack traces and secrets must not be exposed in manager UI, AI output or logs.
- Cross-project/PMO rollups must preserve tenant/project boundaries and must not leak people/workload data across scopes.

## 11. Acceptance Criteria and Test Evidence

| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Gate |
| --- | --- | --- | --- | --- | --- |
| Manager Lane entry is `/implementation` through `ExecutionHub` tab `people_change`. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/Execution/ExecutionHub.tsx` renders `ExecutionManagementView` when active tab is `people_change` | n/a | route-specific manager smoke not found | `PASS_WITH_P2` |
| Manager cards map to six action lanes. | `/implementation` route map | `src/components/Execution/ExecutionManagementView.tsx` presets/tiles for `action-queue`, `decisions`, `blockers`, `risk`, `workload`, `people-change` | `V8ExecutionControlApi.getManagerProblems` per lane | `server/src/routes/v8/__tests__/p03-manager-routes.test.ts` covers manager lane route family | `PASS_WITH_P2` |
| Lane subviews use table + preview and row-scoped actions. | `/implementation` | `src/components/Execution/ManagerModuleView.tsx`, `ProblemTable`, `ProblemPreview` | `executeManagerProblemAction` endpoint | route tests cover action execution; no dedicated UI regression found | `PASS_WITH_P2` |
| Manager AI assists triage/recommendation/action planning without approval authority. | `/implementation` Manager subviews | `src/components/Execution/Manager/AiRecommendationPanel.tsx` | `getAiRecommendation`, `getAiTriage`, `getAiManageAll` | `server/src/routes/v8/__tests__/p03-manager-routes.test.ts` covers AI endpoints; UI placement/regression evidence missing | `PASS_WITH_P2` |
| High-impact manager writes are explicit mutation endpoints. | `/implementation` Manager row/lane actions | `ManagerModuleView` calls action APIs from visible handlers; intervention helpers exist in V8 client | manager routes for problem actions, suggestions, decisions, execution and interventions; `executionControlMutationMeta()` | backend route tests exist; approval-dialog/read-back depth not fully validated | `PASS_WITH_P2` |
| Workload/capacity lane uses capacity-control truth where available. | `/implementation` Manager workload lane | `ExecutionManagementView` workload card; Manager lane problems | `getCapacityLevelingAlerts`, `getCapacityTimeline`, manager problem APIs | `tests/unit/services/v8-execution-control-api.test.ts`, `server/src/routes/v8/__tests__/execution-control.routes.test.ts` | `PASS` for API evidence, `PASS_WITH_P2` for UI evidence |
| Security and tenancy are deny-by-default. | protected route family | guarded execution runtime and V8 context usage | manager routes read `organizationId`/`userId` from `getV8Context`; invalid lane rejected | `server/src/routes/v8/__tests__/p03-manager-routes.test.ts` includes auth-context route harness | `PASS_WITH_P2` |
| Provenance is visible for recommendations/actions. | `/implementation` Manager lanes | `ProblemPreview` and `AiRecommendationPanel` consume source/affected entity fields | manager problem/analysis payloads include source and affected entities where available | no dedicated provenance UI regression found | `BLOCKED_P1` until UI evidence validates source rendering |
| Fake success is prevented. | `/implementation` Manager lanes | action handler shows success/error toasts and refreshes rows | mutation result includes message/changed entities where supported | backend route tests cover successful responses; failed/partial verification UI evidence missing | `PASS_WITH_P2` |

## 12. Manager-Lane Matrix

| Manager card / lane | Control question | Primary evidence inputs | Allowed action lane | Explicit approval requirement | Anti-pattern guard |
| --- | --- | --- | --- | --- | --- |
| `Action Queue` / `action-queue` | What needs manager attention now? | due-soon tasks, stale work, pending escalation, action queue items | open source object, create/execute scoped follow-up, queue action plan | Required for any write to task, owner, date, blocker or escalation state | No hidden queue clearing or fake "handled" status. |
| `Decisions & Approvals` / `decisions` | Which decisions block downstream execution? | pending decisions, overdue approvals, dependency chains | decision pack, approve/reject/defer through governed decision endpoint | Required for every approval state transition; show source and affected work | No silent approval or missing decision provenance. |
| `Blockers & Escalations` / `blockers` | What is blocked and who must unblock it? | blocked initiatives/tasks, critical blockers, recovery proposals | recovery plan, escalation, unblock follow-up | Required for escalation, blocker closure, mitigation or recovery action | No silent blocker closure or success without verification. |
| `Execution Risk` / `risk` | Which risks threaten delivery credibility? | risk signals, delay signals, critical-path pressure, KPI deviations | watchlist, mitigation update, escalation, recovery plan | Required for mitigation, risk-state change, escalation or deadline impact | No degraded risk data presented as current truth. |
| `Resource & Workload` / `workload` | Where is capacity unrealistic or overloaded? | workload counts, capacity alerts, due-soon pressure, missing estimates | rebalance proposal, reassignment, smoothing, replan | Required for owner reassignment, schedule change, capacity assumption change or smoothing | No silent rebalance or hidden deadline impact. |
| `People & Change` / `people-change` | Where are ownership, sponsor or change gaps blocking adoption? | owner gaps, sponsor gaps, stakeholder/change readiness signals | ownership fix, communication follow-up, escalation | Required for ownership/accountability changes or stakeholder escalation | No unscoped people data exposure or fabricated change readiness. |

## 13. Decision -> UI/UX -> Build Contract -> Impact -> Done

### Decision
- `RL_EXECUTION_MANAGER` is the manager/control-tower lane under `/implementation`.
- It converts delivery signals into traceable, scoped and approval-aware management actions.
- It is not a planning owner, report generator or autonomous mutation engine.

### UI/UX
- Required cards: Action Queue, Decisions & Approvals, Blockers & Escalations, Execution Risk, Resource & Workload, People & Change.
- Required behavior: lane cards with counts, lane table + preview, row-scoped actions, local action zone for AI/workspace helpers, visible loading/empty/error/degraded/success states.
- AI placement: Menu 3/right-side, local lane action-zone or row-scoped only, with no duplicate canvas toolbar.

### Build Contract
- Runtime anchor remains `ExecutionHub` tab `people_change`.
- Manager subviews remain lane-based through `ExecutionManagementView` and `ManagerModuleView`.
- API integration remains through V8 execution-control manager routes.
- High-impact actions remain explicit, authenticated, tenant-scoped mutation endpoints with visible feedback.
- No runtime change is approved by this docs-only closeout.

### Impact
- Adjacent impacted functions: `RL_EXECUTION_PORTFOLIO`, `RL_EXECUTION_REPORTS`, `RL_FULL_EXECUTION_VIEW`, `RL_ROLLOUT_VIEW`.
- Impact is dependency-only: adjacent functions may expose the same execution truth, but this contract does not redefine their surfaces or authorize runtime edits.

### Done
- Docs contract is complete when this function file, `04_UI_UX.md` annex and `07_ACCEPTANCE_AND_TESTS.md` evidence matrix all map manager cards, action lanes, approval, route/component/API/test evidence and anti-patterns.
- Runtime done remains conditional on closing P0/P1 validation tasks below.

## 14. Registry Sync Rows — Locked Dispatch 2026-05-10

Registry sync completed for immutable `scope_anchor: 06_realizacja/RL_EXECUTION_MANAGER`. This sync normalizes only the locked rows listed in the dispatch card and does not authorize runtime edits.

| Task ID | Scope anchor | Priority | Status | Change type | Depends on | Evidence | Source card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `RL-MGR-P0-001` | `06_realizacja/RL_EXECUTION_MANAGER` | `P0` | `READY` | `docs/test` | owner acceptance | route/component/API/test | `functions/RL_EXECUTION_MANAGER.md` |
| `RL-MGR-P1-001` | `06_realizacja/RL_EXECUTION_MANAGER` | `P1` | `WAITING_P0` | `docs/test` | `RL-MGR-P0-001` | route/component/API/test | `functions/RL_EXECUTION_MANAGER.md` |
| `RL-MGR-P2-001` | `06_realizacja/RL_EXECUTION_MANAGER` | `P2` | `WAITING_P0` | `docs/test` | `RL-MGR-P0-001`,`RL-MGR-P1-001` | route/component/API/test | `functions/RL_EXECUTION_MANAGER.md` |

Owner acceptance recommendation: approve these registry rows for future implementation planning only after confirming the Manager lane remains the sole primary scope and `RL_EXECUTION_PORTFOLIO`, `RL_EXECUTION_REPORTS` and `MW_MANAGER` remain impact-only dependencies.

## 15. Open Questions

1. Which approval UI depth is canonical for Manager high-impact actions: confirm dialog, diff panel, or approval workflow object?
2. Do local lane action buttons registered by `onRegisterActions` count as the accepted Menu 3/local command-row slot for Manager Lane, or must all AI actions move to `ModuleHub.rightControls`?
3. What read-back/verification status is mandatory before an action may display final success for each high-impact action class?

## 16. Open Risks and Change Log
- Risk: management recommendations without review can create false certainty.
- Risk: high-impact approval depth is documented but not fully proven by UI evidence.
- Risk: source/provenance rendering for every lane needs UI regression or manual smoke evidence before full runtime compliance can be claimed.
- Risk: client-side manager API helpers are only partially represented in the known client unit-test evidence scan.
- Change log: 2026-05-10 docs-only closeout added manager-card/action-lane contract, explicit approval rules, anti-patterns, evidence matrix, P0/P1/P2 tasks and dependency-only impact boundaries.

## 12. Open Risks and Change Log

Gate alias for the module-contract rerun checker. Canonical risk content is maintained in section 16 above.
