---
module_id: MODULE_EXECUTION
function_id: RL_EXECUTION_PORTFOLIO
function_name: Execution — Portfolio Operations
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Execution Portfolio Operations

## 1. Function Identity
- Function ID: `RL_EXECUTION_PORTFOLIO`
- Runtime anchor: `ExecutionHub` tab `list`
- Route scope: `/implementation`
- Feature state: `real`
- Scope anchor: `06_realizacja/RL_EXECUTION_PORTFOLIO`
- Work type for this closeout: `docs-only`
- Canonical source documents:
  - `docs/modules/06_realizacja/03_BEHAVIOR.md`
  - `docs/modules/06_realizacja/04_UI_UX.md`
  - `docs/modules/06_realizacja/07_ACCEPTANCE_AND_TESTS.md`
  - `docs/product/EXECUTION_SURFACES_PORTFOLIO_REPORTS_MANAGER_V8.md`
  - `docs/product/TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md`

## 2. User Job and Business Outcome
- Purpose: operate the live execution portfolio for active initiatives without creating a parallel planning, reporting or manager cockpit runtime.
- Primary user question: "What initiatives are currently in execution and what is their state?"
- Business outcome: one reliable working portfolio list with immediate preview, bounded execution actions and visible task/decision/blocker signals.
- Non-goals:
  - Do not replace `05_inicjatywy` as initiative planning owner.
  - Do not become `RL_EXECUTION_REPORTS`.
  - Do not become `RL_EXECUTION_MANAGER`.
  - Do not introduce a second task, decision, dependency, owner or deadline truth.

## 3. Trigger and Entry Points
- Primary route: `/implementation`.
- Primary component: `src/components/Execution/ExecutionHub.tsx`.
- Runtime entry state: `ExecutionHub` default `initialTab='list'`.
- Related route family, for impact only: `/execution` and `/rollout` remain adjacent execution-lane surfaces but are outside this function's operating scope.

## 4. UI Component Footprint
- Required UI modes for this function: `table`, `kanban`, `timeline`.
- Table mode uses canonical table plus preview behavior.
- Kanban mode may support bounded status movement where policy allows.
- Timeline mode must show schedule truth, deadlines, forecast windows and warnings, not decorative roadmap content.
- Menu 3 / command row:
  - filters, counters, scope controls and active view controls belong in the single command row.
  - contextual AI actions must live in Menu 3/right-side or row-scoped controls only.
  - no duplicated AI toolbar may be rendered under metadata, under a properties strip or inside the main canvas.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs:
  - active initiatives in execution,
  - linked tasks,
  - linked decisions,
  - blockers, risks and RAID signals,
  - baseline, forecast and variance signals,
  - capacity and timeline datasets where available.
- Contract rule: task and decision data are initiative-native execution objects, not a parallel truth.
- API/service evidence:
  - shared API boundary: `src/services/api.ts`.
  - V8 execution-control client: `src/services/api/v8/execution-control.ts`.
  - write/read-back refresh helper: `src/services/executionWriteTruth.ts`.
  - backend V8 route owner: `server/src/routes/v8/execution-control.routes.ts`.

## 6. Outputs and Side Effects
- Outputs:
  - initiative preview/open-full navigation,
  - filtered and sorted execution portfolio views,
  - bounded status/task movement where policy allows,
  - source-linked handoff to underlying initiative/work object,
  - visible success/error feedback after writes.
- Side-effect rule: every mutation must be user-triggered, authenticated and visibly acknowledged. Hidden writes and silent AI mutations are out of scope.

## 7. Ownership and Handoff Boundaries
- `RL_EXECUTION_PORTFOLIO` owns live execution portfolio operation.
- `05_inicjatywy` remains owner of broader initiative planning and shaping.
- `RL_EXECUTION_REPORTS` owns report definition/run/audience/cadence flows.
- `RL_EXECUTION_MANAGER` owns exception triage and interventions.
- `RL_EXECUTION_PORTFOLIO` may show rollups and bounded execution actions, but must not absorb planning, reporting or manager-cockpit ownership.

## 8. Runtime States and UX Behavior
- Loading: route and data loads must show explicit loading state.
- Empty: table/kanban/timeline must distinguish no execution work, no filter match and unavailable data.
- Error: failed route/data/mutation actions must surface visible error or toast feedback.
- Degraded: missing baseline, missing estimate, stale data, partial refresh failure and legacy fallback must be visible as degraded, not success.
- Success: task/status movement, filtering, opening and refresh actions must provide clear next action or confirmation.
- Next action guidance must tell the user whether to assign/advance work, resolve a blocker, review a signal, retry data, open the full object or wait for access.

## 9. AI, Source, Evidence, Approval
- AI actions:
  - must be Menu 3/right-side or row-scoped only.
  - may summarize or support execution understanding.
  - may not silently create, modify or approve execution truth.
- Source/evidence:
  - portfolio rows and previews must expose initiative, owner, tasks, decisions, blockers or source signal where available.
  - generated or AI-assisted summaries must identify evidence or disclose missing/partial evidence.
- Approval:
  - high-impact execution mutations require explicit user action and visible feedback.
  - approval/diff depth for each portfolio write remains an implementation validation point, not a docs assumption.

## 10. Security, Roles, and Tenancy
- Tenant, ACL, role and pilot gates are non-negotiable.
- Deny-by-default applies when authorization is uncertain.
- Production gating and protected route wrappers must remain visible rather than silently hiding failures.
- Sensitive internals, raw payloads and secrets must not be exposed in UI or logs.

## 11. Acceptance Criteria and Test Evidence

| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Gate |
| --- | --- | --- | --- | --- | --- |
| Portfolio entry is `/implementation` and renders `ExecutionHub`. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/components/Execution/ExecutionHub.tsx` | n/a | route smoke coverage not found for this exact function | `PASS_WITH_P2` |
| Portfolio surface is `ExecutionHub` tab `list`. | `/implementation` route map | `ExecutionHub` `initialTab='list'` and `tabs` includes `list` labelled `Portfolio` | n/a | no dedicated `ExecutionHub` component regression found | `PASS_WITH_P2` |
| Allowed Portfolio views are table, kanban and timeline. | `/implementation` | `ExecutionHub` constrains `activeTab === 'list'` to `table`, `kanban`, `timeline`; renders `TableWithPreviewLayout`, `ExecutionInitiativesKanbanView`, `ExecutionTimelineView` | n/a | no dedicated view-mode regression found | `PASS_WITH_P2` |
| Portfolio reads execution-control signals from shared V8/legacy boundary where available. | `/implementation` | `ExecutionHub` loads timeline/capacity control data | `src/services/api/v8/execution-control.ts`, `server/src/routes/v8/execution-control.routes.ts`, legacy `/api/execution-control` fallback | `tests/unit/services/v8-execution-control-api.test.ts`, `server/src/routes/v8/__tests__/execution-control.routes.test.ts` | `PASS` |
| Writes are explicit and have visible success/error feedback. | `/implementation` | `ExecutionHub` status/task movement calls and toast feedback | `src/services/api.ts`, `src/services/executionWriteTruth.ts`, V8 execution-control write endpoints where used | `tests/unit/services/executionWriteTruth.test.ts`, V8 route tests for org-scoped writes | `PASS_WITH_P2` |
| AI actions are constrained to Menu 3/right-side or row-scoped placement. | `/implementation` | `ExecutionHub` has `rightControls`; preview/footer chat actions require UI placement validation | governed chat APIs outside this function | no dedicated AI placement regression found | `BLOCKED_P1` for runtime compliance until validated |
| Portfolio does not own planning/reporting/manager runtime. | `/implementation` only for this function | `ExecutionHub` separates tabs `list`, `reports`, `people_change` | shared execution truth through V8 contracts | doc contract and route/component inspection only | `PASS_WITH_P2` |

## 12. Decision -> UI/UX -> Build Contract -> Impact -> Done

### Decision
- `RL_EXECUTION_PORTFOLIO` is the live execution portfolio surface under `/implementation`.
- It operates one execution truth shared with tasks, decisions, dependencies and signals.
- It is not a dashboard builder, report surface, planning module or manager cockpit.

### UI/UX
- Required views: table, kanban, timeline.
- Required behavior: canonical table plus preview, single click preview, double click or explicit open for detail, command-row filters/counters, visible degraded states.
- AI action placement: Menu 3/right-side or row-scoped only, with no duplicate canvas toolbar.

### Build Contract
- Runtime anchor remains `ExecutionHub` tab `list`.
- API integration remains through shared `Api` and V8 execution-control contracts.
- Mutations remain explicit user actions with visible feedback and read-back/refresh expectations.
- No runtime change is approved by this docs-only closeout.

### Impact
- Adjacent impacted functions: `RL_EXECUTION_REPORTS`, `RL_EXECUTION_MANAGER`, `RL_FULL_EXECUTION_VIEW`, `RL_ROLLOUT_VIEW`.
- Impact is dependency-only: those functions may consume or expose the same execution truth, but this contract does not redefine their surfaces.

### Done
- Docs contract is complete when this function file, `04_UI_UX.md` annex and `07_ACCEPTANCE_AND_TESTS.md` evidence matrix all map route/component/API/test evidence.
- Runtime done remains conditional on closing P0/P1 validation tasks below.

## 13. Task Board Ready Items

Registry sync source: locked dispatch card for `06_realizacja/RL_EXECUTION_PORTFOLIO`. Only the three task rows listed in that card are registry-active for this docs-only pass.

| Task ID | Scope anchor | Priority | Status | Change type | Depends on | Evidence | Source card |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `RL-PORT-P0-001` | `06_realizacja/RL_EXECUTION_PORTFOLIO` | `P0` | `READY` | `docs/test` | owner acceptance recommendation | route `/implementation`; component `ExecutionHub` / Menu 3-right controls; API governed chat/runtime boundary; test/UI smoke evidence for no duplicate AI toolbar | `functions/RL_EXECUTION_PORTFOLIO.md` |
| `RL-PORT-P1-001` | `06_realizacja/RL_EXECUTION_PORTFOLIO` | `P1` | `WAITING_P0` | `test` | `RL-PORT-P0-001` | route `/implementation`; component `ExecutionHub`; API n/a for route render; route smoke or Playwright evidence for protected/gated rendering | `functions/RL_EXECUTION_PORTFOLIO.md` |
| `RL-PORT-P2-001` | `06_realizacja/RL_EXECUTION_PORTFOLIO` | `P2` | `WAITING_P0` | `docs/test` | `RL-PORT-P0-001`, `RL-PORT-P1-001` | route `/implementation`; components `TableWithPreviewLayout`, `ExecutionInitiativesKanbanView`, `ExecutionTimelineView`; API V8 execution-control where signals appear; UI evidence links for table/kanban/timeline | `functions/RL_EXECUTION_PORTFOLIO.md` |

Registry sync completed: `2026-05-10`, docs-only. Owner acceptance recommendation: approve these three rows for future registry execution and keep additional Portfolio expansion rows out of the active registry until separately dispatched.

## 14. Open Questions

1. Do current preview/footer chat actions in `ExecutionHub` qualify as row-scoped AI actions under the Menu 3 rule, or must they be moved to `rightControls`?
2. Which automated route smoke standard should be canonical for `/implementation` in the current test suite?
3. What approval/diff depth is required for each portfolio write class beyond visible toast and read-back refresh?

## 15. Open Risks and Change Log
- Risk: interaction complexity (drag-and-drop, timeline, filters, preview and signals) lacks a dedicated `ExecutionHub` regression suite.
- Risk: AI action placement needs runtime UI validation before claiming full runtime compliance.
- Risk: high-impact mutation approval/diff depth is not fully enumerated in current docs.
- Change log: 2026-05-10 docs-only closeout added Decision -> UI/UX -> Build contract -> Impact -> Done, evidence matrix, open questions and P0/P1/P2 task-board items.

## 12. Open Risks and Change Log

Gate alias for the module-contract rerun checker. Canonical risk content is maintained in section 15 above.
