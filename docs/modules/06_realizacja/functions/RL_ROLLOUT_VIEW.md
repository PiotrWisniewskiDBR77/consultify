---
module_id: MODULE_EXECUTION
function_id: RL_ROLLOUT_VIEW
function_name: Execution — Rollout View
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Rollout View

## 1. Function Identity
- Function ID: `RL_ROLLOUT_VIEW`
- Route: `/rollout`
- Runtime anchor: `FullRolloutView`
- Feature state: `real`
- Scope anchor: `06_realizacja/RL_ROLLOUT_VIEW`
- Work type for this closeout: `docs-only`

## 2. User Job and Business Outcome
- Purpose: rollout-focused execution lane surface for baseline, schedule, forecast and intervention review.
- Business outcome: the operator can see whether rollout delivery is still credible, why confidence changed, which conflicts matter and what explicit intervention path is available.
- Canonical doctrine: this function follows `baseline -> current reality -> forecast -> intervention -> updated credible path` from `EXECUTION_ON_TIME_DELIVERY_FORECASTING_AND_BASELINE_CONTROL_V8.md`.
- Honesty rule: `/rollout` must never present rollout status as on-track when baseline, effort, dependency, capacity or conflict truth is missing.

## 3. Trigger and Entry Points
- Primary route: `/rollout`.
- Router evidence: `src/routes/routeConfig.ts` defines `ROLLOUT` path ownership through the route family, and `src/routes/AppRoutes.tsx` lazy-loads and mounts `FullRolloutView`.
- Adjacent surfaces: `/implementation` and `/execution` may provide shared execution context, but this function owns only the rollout route contract.
- Entry may come from sidebar execution navigation, action handler navigation (`rollout` action path) or adjacent execution-lane links.

## 4. UI Component Footprint
- Route component: `src/views/FullRolloutView.tsx`.
- Workspace component: `src/components/workspaces/FullRolloutWorkspace.tsx`.
- Layout shell: `SplitLayout` with embedded rollout workspace.
- Current AI/control footprint: `FullRolloutView` renders `AIFeedbackButton` in an absolute top-right slot and accepts chat through `SplitLayout`; this is real runtime evidence but remains a UI governance risk until Menu 3/right-side placement is validated or corrected.
- Component boundary: the function may render rollout planning, monitoring, closure and next-step panels, but must not redefine Portfolio, Reports or Manager lane ownership.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs:
  - rollout plan and phase data from `fullSession.rollout`;
  - initiative/task/dependency context from `fullSession.initiatives`;
  - baseline dates, milestones, dependency shape and capacity assumptions where available;
  - current execution reality: overdue work, blocked work, stale updates, pending decisions, missing estimates and overloaded owners;
  - forecast and warning signals from V8 execution-control contracts where wired through the execution lane.
- Data contracts:
  - timeline warning read model: `V8ExecutionTimelineWarning` in `src/services/api/v8/execution-control.ts`;
  - delay signal read model: `V8ExecutionDelaySignal` in `src/services/api/v8/execution-control.ts`;
  - capacity alert/timeline read models: `V8ExecutionCapacityAlert` and `V8ExecutionCapacityWeek` in `src/services/api/v8/execution-control.ts`;
  - timeline mutation payload: `V8ExecutionTimelineUpdatePayload` in `src/services/api/v8/execution-control.ts`.
- Dependencies:
  - `EXECUTION_ON_TIME_DELIVERY_FORECASTING_AND_BASELINE_CONTROL_V8.md` is the schedule-control doctrine for baseline, variance, critical path, confidence and recovery.
  - `03_BEHAVIOR.md`, `04_UI_UX.md`, `05_DATA_AND_INTEGRATIONS.md` and `07_ACCEPTANCE_AND_TESTS.md` define the module-level execution lane constraints.
- Degraded input rule: if any source is partial, stale, fallback-based or missing, the UI/contract state must be labelled as degraded or insufficient data, not success.

## 6. Outputs and Side Effects
- Outputs:
  - rollout status summary with explicit timeliness state;
  - baseline/current/forecast comparison when enough data exists;
  - conflict list with affected phase/milestone/dependency/owner where available;
  - intervention options, including owner escalation, dependency resolution, capacity balancing, schedule recovery proposal and governed rebaseline proposal;
  - explicit next-step navigation toward reports/closure or adjacent execution context.
- Side effects:
  - Pure view/navigation and local rollout workspace updates are allowed only when user-triggered and visible.
  - High-impact rollout mutations are not automatic; timeline changes, rebaseline, critical-path rewrites, mass rescheduling, optimizer application and conflict-resolution writes require explicit review/approval.
  - AI may explain or propose but may not silently move deadlines, silently rebaseline or silently rewrite the critical path.

## 7. Ownership and Handoff Boundaries
- `RL_ROLLOUT_VIEW` owns route-level rollout visibility and intervention decision framing.
- It does not own canonical Portfolio task state, Reports generation, Manager lane triage, budget truth or organization-level capacity truth.
- Handoffs must preserve source/provenance: route/component/API/test evidence should remain traceable to the source task, initiative, milestone, dependency, owner or control signal.
- The view must not duplicate another module's canonical object as an independent source of truth.
- The rollout view does not silently mutate canonical objects.

## 8. Runtime States and UX Behavior
- Loading: route/workspace and data-dependent rollout panels show explicit loading or pending state.
- Empty: distinguish no rollout plan, no matching rollout context and unavailable data.
- Error: failed data/action paths surface visible error or toast/callout feedback.
- Degraded: fallback service logic, missing baseline, missing estimate, stale capacity, missing dependency shape, partial refresh, insufficient forecast inputs or unknown conflict source must be visibly marked as degraded/partial.
- Success: accepted navigation/local update/intervention completion must confirm the result and identify next blocker/review/follow-up.
- Partial data label: if the route can render only session-local rollout data without V8 execution-control confirmation, it must disclose `partial_data` or equivalent state in evidence/UX.

## 8A. Timeline / Baseline / Forecast / Conflict Contract

| Layer | Contract decision | Required visible state | Gate |
| --- | --- | --- | --- |
| Baseline | Baseline start/end, milestones, dependency shape and capacity assumptions are first-class schedule truth when present. | Show baseline present/missing/stale and variance against current reality. | Missing baseline => `no_baseline` or degraded, never `on_track`. |
| Current schedule | Current dates, progress, overdue work, blocked work, stale work and pending decisions form the execution reality layer. | Show affected phase/milestone/initiative and owner where available. | Partial current data => degraded with retry/source guidance. |
| Forecast | Forecast must include confidence class, not only a target date. | `high_confidence`, `medium_confidence`, `low_confidence` or `insufficient_data`. | Confidence cannot exceed critical-path data reliability. |
| Critical path | Schedule-driving dependency pressure must be distinguishable from local lateness. | Mark path-critical lateness separately from non-critical delay. | Missing dependency shape caps confidence and blocks high-confidence claims. |
| Conflicts | Dependency, owner/capacity, date and decision conflicts must be surfaced as reviewable blockers. | Show conflict type, affected object, source evidence and proposed next action. | Conflict resolution is explicit review, not silent write. |
| Intervention | Intervention is the bridge from red signal to updated credible path. | Show proposal, affected dates/owners/dependencies and approval requirement. | High-impact action requires explicit review. |

## 9. AI, Source, Evidence, Approval
- AI may explain delay root causes, compare intervention options and prepare recommendation packs.
- AI may not silently move deadlines, rebaseline, rewrite critical path, resolve conflicts or apply optimizer output.
- Source/provenance must identify source tasks, initiatives, milestones, dependencies, owners or execution-control signals where available.
- Missing or partial evidence must be disclosed in the generated/AI output.
- High-impact rollout actions require explicit operator review with visible affected-object diff before execution.
- Current placement risk: top-right `AIFeedbackButton` in `FullRolloutView` must be audited against the Menu 3/right-side rule; no duplicate canvas AI toolbar is allowed.

## 9A. Explicit Action Model

| Action family | Allowed in `/rollout` | Action type | Review rule | Evidence requirement |
| --- | --- | --- | --- | --- |
| View schedule/baseline/forecast | Yes | Read-only | No approval required. | Route/component plus source data status. |
| Detect warnings/conflicts | Yes when backed by execution-control data or visible local state. | Read-only or generated insight. | No hidden write. | API/source provenance and generated-at/fallback state where available. |
| Auto-schedule proposal | Yes as a proposal only. | Draft/proposal. | Operator review required before any write. | Proposed diff: affected milestones/tasks/owners/dependencies. |
| Optimizer recommendation | Yes as explanation/comparison only. | Draft/proposal. | Explicit review required before applying. | Confidence, assumptions and rejected alternatives. |
| Conflict resolution | Yes as a visible workflow. | Proposal or bounded mutation. | Required for dependency/date/owner changes. | Conflict source, selected resolution, affected entities and audit trail where supported. |
| Timeline update | Allowed only through governed execution-control write path when runtime supports it. | Mutation. | High-impact timeline changes require explicit review and reason. | `V8ExecutionControlApi.updateTimeline` / backend route evidence plus read-back when available. |
| Rebaseline | Proposal only in this function. | Governed proposal. | Uses shared proposal/approval spine; no local silent rebaseline. | Baseline diff, reason, approver and post-approval state. |
| AI intervention pack | Yes. | Recommendation content. | AI cannot execute high-impact writes. | Source evidence or missing-evidence disclosure. |

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.
- `/rollout` route protection is evidenced by router/auth guard coverage in `tests/components/RouterSync.idea-artifact.test.tsx`.
- API reads/writes must stay org-scoped and deny-by-default when authorization is uncertain.
- Raw sensitive payloads must not be exposed where source links, summarized evidence or bounded diffs are sufficient.
- High-impact rollout mutations require explicit approval before execution.

## 11. Acceptance Criteria and Test Evidence

| Critical claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| `/rollout` is an active route for this function. | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx` | `src/views/FullRolloutView.tsx` | n/a | `tests/components/RouterSync.idea-artifact.test.tsx` protects `/rollout` for unauthenticated users | `PASS_WITH_P2` |
| Rollout route renders the rollout workspace. | `/rollout` route map | `FullRolloutView` renders `FullRolloutWorkspace` | session-local rollout state through `useAppStore` | no dedicated `FullRolloutWorkspace` regression found | `PASS_WITH_P2` |
| Baseline/current/forecast doctrine is defined for rollout decisions. | `/rollout` contract | `FullRolloutWorkspace` surface; runtime completeness requires audit | V8 execution-control timeline, delay and capacity contracts where wired | `tests/unit/services/v8-execution-control-api.test.ts`, `server/src/routes/v8/__tests__/execution-control.routes.test.ts` | `PASS_WITH_P2` |
| Timeline warnings and conflicts use explicit source/evidence when available. | `/rollout` plus adjacent execution-control route family | rollout workspace and adjacent execution lane signal components | `V8ExecutionControlApi.getTimelineWarnings`, control-tower queues/items, delay/capacity endpoints | execution-control client/backend tests cover endpoint contracts; `/rollout` UI conflict test not found | `PASS_WITH_P2` |
| High-impact actions are proposals/reviewed mutations, not silent writes. | `/rollout` contract | `FullRolloutView` local update handlers; governed write evidence is in execution-control API | `V8ExecutionControlApi.updateTimeline`, shared proposal/approval doctrine for rebaseline | timeline update client/backend evidence exists; route-level approval UI test not found | `PASS_WITH_P2` |
| AI actions do not bypass review or placement governance. | `/rollout` | `AIFeedbackButton` and `SplitLayout` chat in `FullRolloutView` require Menu 3 placement audit | AI call path `sendMessageToAI` is content/recommendation, not governed write | no placement regression found | `BLOCKED_P1` until UI placement evidence exists |
| Degraded/partial data is explicit. | `/rollout` contract | runtime state audit required for session-local vs V8-backed panels | fallback guard `shouldFallbackToLegacyExecutionControl`; execution-control envelopes | fallback behavior tested in `tests/unit/services/v8-execution-control-api.test.ts`; full `/rollout` degraded UI matrix missing | `PASS_WITH_P2` |

Acceptance criteria:
- `/rollout` renders the documented rollout surface behind route protection.
- Baseline, current schedule, forecast confidence and conflict state are distinguishable.
- Missing baseline, missing estimate, missing dependency shape, stale capacity and fallback data are labelled as degraded/partial.
- Auto-schedule, optimizer and conflict resolution are proposal/review flows unless routed through an explicitly approved governed write.
- AI-generated rollout recommendations include source evidence or missing-evidence disclosure and cannot execute high-impact writes.

## 14. P0/P1/P2 Task Board Items

| ID | Priority | Area | Ready task | Acceptance / evidence |
| --- | --- | --- | --- | --- |
| `RL-ROLL-P0-001` | `P0` | UI governance | Validate `/rollout` AI action placement and move any duplicate/non-Menu-3 action to Menu 3/right-side or accepted row-scoped placement. | UI smoke screenshot/recording proving no duplicate AI toolbar and no hidden high-impact AI action. |
| `RL-ROLL-P0-002` | `P0` | Safety/governance | Validate high-impact rollout actions: auto-schedule, optimizer apply, conflict resolution, timeline update and rebaseline. | Evidence that each is proposal/reviewed mutation with affected-object diff and no silent write. |
| `RL-ROLL-P1-001` | `P1` | QA coverage | Add or identify `/rollout` component/regression coverage for loading, empty, error, degraded, partial and success states. | Test path or manual Anygravity evidence linked in `07_ACCEPTANCE_AND_TESTS.md`. |
| `RL-ROLL-P1-002` | `P1` | Evidence docs | Capture baseline/current/forecast/conflict UI evidence for one healthy and one degraded rollout. | Evidence links proving degraded/partial data is labelled. |
| `RL-ROLL-P2-001` | `P2` | API traceability | Link concrete API/read-back paths used by rollout timeline and conflict data once runtime wiring is audited. | Route/component/API/test matrix updated from generic V8 execution-control evidence to exact route data flow. |

## 15. Open Risks and Change Log
- Decision: baseline/forecast/conflict model is now explicit and aligned to `EXECUTION_ON_TIME_DELIVERY_FORECASTING_AND_BASELINE_CONTROL_V8.md`.
- Decision: auto-schedule, optimizer, conflict resolution, timeline update and rebaseline are explicit proposal/review action families; high-impact actions cannot execute silently.
- Decision: degraded/partial data is a first-class contract state for `/rollout`.
- Risk: rollout state drift if not aligned with execution hub updates.
- Risk: runtime placement of `AIFeedbackButton` may violate Menu 3/right-side governance until audited.
- Risk: dedicated `/rollout` UI regression evidence is missing; current evidence is route guard plus shared execution-control API tests.
- Gate verdict for docs-only closeout: `APPROVED_FOR_DOCS_WITH_P1_RISKS`; runtime implementation remains unchanged.

## 12. Open Risks and Change Log

Gate alias for the module-contract rerun checker. Canonical risk content is maintained in section 15 above.

## RAW Hard Gate Trace — 2026-05-11

- RAW source: `docs/RAW/implementation-pmo/107_RAW_IMPLEMENTATION_PMO_ENGINE_2026-05-09.md`, `docs/RAW/execution-hub/103_RAW_EXECUTION_HUB_AI_EXECUTION_MANAGEMENT_ENGINE_2026-05-09.md`.
- Contract decision: `KEEP` rollout as proposal/review/rebaseline surface; `REJECT` silent optimizer or hidden schedule mutation.
- Evidence: route/component/API baseline exists; high-impact approval/read-back and Menu 3 placement proof remain `NOT_DONE`.
