---
module_id: MODULE_INTERVIEW
function_id: WY_MY_ASSIGNMENTS
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Function Execution Card — WY_MY_ASSIGNMENTS

## 1. Metadata

- scope_anchor: `03_wywiad/WY_MY_ASSIGNMENTS`
- primary_module: `03_wywiad`
- primary_function: `WY_MY_ASSIGNMENTS`
- parent_function: `WY_MY_ASSIGNMENTS`
- cycle: `Decision -> UI/UX -> Build contract -> Impact -> Done`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: function contract hardening and implementation backlog for `WY_MY_ASSIGNMENTS`.
- Out of scope: runtime code changes, any non-`WY_MY_ASSIGNMENTS` function contract rewrites, cross-module task creation.
- Allowed global documents: function dispatch protocol, function execution card template, module behavior/UI/acceptance contracts.
- Forbidden files: all runtime paths (`src/**`, `server/**`, `tests/**`) and non-deliverable function cards.
- Immutable rule: this cycle keeps one anchor only: `03_wywiad/WY_MY_ASSIGNMENTS`.

## 3. Dependency Scope

Dependency scope is read-only and impact-only.

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `WY_SESSIONS` | document handoff impact for "continue session" actions from assignment context | editing sessions contract/task rows as primary scope |
| `WY_PENDING_REVIEW` | document review-lane impact when assignment outcome enters review queue | editing review contract/task rows as primary scope |

## 4. Source Inputs

- RAW sources:
  - `docs/modules/03_wywiad/RAW_INPUT.md`
- module contracts:
  - `docs/modules/03_wywiad/03_BEHAVIOR.md`
  - `docs/modules/03_wywiad/04_UI_UX.md`
  - `docs/modules/03_wywiad/07_ACCEPTANCE_AND_TESTS.md`
- function contracts:
  - `docs/modules/03_wywiad/functions/WY_MY_ASSIGNMENTS.md`
  - `docs/modules/03_wywiad/functions/WY_SESSIONS.md`
  - `docs/modules/03_wywiad/functions/WY_PENDING_REVIEW.md`
- runtime evidence sources:
  - `src/components/Interview/InterviewHub.tsx`
  - `src/services/api/v8/interview.ts`
- previous decisions:
  - no runtime edits in this cycle (`docs-only`)

## 5. Decision Matrix

| Requirement | AS-IS | TARGET | DELTA | Decision | Rationale |
| --- | --- | --- | --- | --- | --- |
| Assignment tab identity and ownership | Function contract defines assignment queue identity in Interview hub. | Keep identity and ownership boundaries unchanged. | No functional gap in ownership statement. | `KEEP` | Existing contract is aligned with module behavior docs. |
| Deep-link behavior for `assignmentId` | Deep-link requirement exists but lacks explicit acceptance evidence plan per task. | Add task-level evidence and done-gate mapping for deep-link fidelity. | Need executable task rows tied to evidence. | `ENHANCE` | Reduces ambiguity between contract and implementation backlog. |
| Session/review downstream impact | Handoffs are stated but dependency scope lock is implicit. | Make impact-only dependency scope explicit for `WY_SESSIONS` and `WY_PENDING_REVIEW`. | Missing explicit forbidden-use boundaries. | `ENHANCE` | Prevents scope drift during execution. |
| Automated regression for assignment flow | Module acceptance notes test gap for InterviewHub coverage. | Add P1/P2 backlog rows for assignment-focused regression and dependency handoff checks. | Test backlog is not yet function-scoped in registry. | `NEW` | Needed for deployable progression after P0 closure. |

## 6. UI/UX Component Contract

- approved shell/component family: `InterviewHub` assignment table/cards + preview panel.
- Menu 2 surface: module shell `Wywiad`.
- Menu 3 actions: assignment filters, AI/context actions, row actions in command-row/right-side context.
- AI action placement: Menu 3/right-side or row/modal context only; no duplicated toolbar in canvas.
- runtime states:
  - `loading`: assignment list and preview load indicators visible.
  - `empty`: clear next action (`refresh`, `clear filters`, `open another tab`).
  - `error`: safe mapped error and explicit retry.
  - `degraded`: partial assignment/session data is labeled as degraded.
  - `success`: open/update/review transition confirms what changed.
- source/provenance/evidence UI: assignment actions preserve session and source lineage.
- approval/review/diff behavior: high-impact outcomes route to explicit review flow; no hidden approval.
- anti-patterns:
  - assignment actions bypassing tenant/ACL boundaries,
  - hidden downstream mutation in sessions/review lane,
  - duplicated AI controls outside Menu 3 scope.

## 7. Contract Update Plan

| File | Required update | Reason | Status |
| --- | --- | --- | --- |
| `functions/WY_MY_ASSIGNMENTS.md` | add execution-card and task-board linkage with scoped task IDs | keep contract and registry synchronized | `DONE` |
| `03_BEHAVIOR.md` | no update required | existing behavior lane already covers assignment lane ownership | `NOT_REQUIRED` |
| `04_UI_UX.md` | no update required | module-level Menu 3 and AI placement already define required doctrine | `NOT_REQUIRED` |
| `07_ACCEPTANCE_AND_TESTS.md` | no update required | function acceptance row exists; backlog now carries execution IDs | `NOT_REQUIRED` |
| `RAW_TARGET_STATE_2_0_PACKET.md` | no update required in this cycle | docs-only function cycle, no packet rewrite requested | `NOT_REQUIRED` |

## 8. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `WY-MYA-P0-001` | `P0` | `docs` | Lock scope anchor, dependency impact rules, and execution evidence mapping for `WY_MY_ASSIGNMENTS` (including deep-link behavior). | owner docs acceptance | route/component/API/test | contract/UI/impact complete |
| `WY-MYA-P0-002` | `P0` | `docs/runtime` | Define canonical `AssignmentItem` payload with owner, priority, due date, provenance, and risk attributes. | `WY-MYA-P0-001` | component/API/test | canonical payload complete |
| `WY-MYA-P0-003` | `P0` | `docs/runtime` | Lock read-back contract: no final success state without confirmation from downstream lane (`WY_SESSIONS` or `WY_PENDING_REVIEW`). | `WY-MYA-P0-002` | route/component/API/test | read-back guarantee active |
| `WY-MYA-P0-004` | `P0` | `docs/runtime` | Define per-item assignment health states (`synced/syncing/stale/conflict/error/not_linked`) and degraded handling. | `WY-MYA-P0-002` | component/API/test | health-state contract complete |
| `WY-MYA-P0-005` | `P0` | `test` | Define baseline E2E chain: assignment action -> session/review transition -> read-back -> confirmation. | `WY-MYA-P0-003`,`WY-MYA-P0-004` | route/component/API/test | e2e contract complete |
| `WY-MYA-P1-001` | `P1` | `runtime/test` | Define assignment-flow regression package for tab rendering, `assignmentId` deep-link open, and preview consistency. | `WY-MYA-P0-001` | route/component/test | waiting for P0 close |
| `WY-MYA-P1-002` | `P1` | `docs/runtime` | Define SLA/aging/escalation contract for overdue assignments and response windows. | `WY-MYA-P0-*` | component/API/test | waiting for P0 close |
| `WY-MYA-P1-003` | `P1` | `runtime/test` | Define conflict resolution and replay flow for assignment transition conflicts. | `WY-MYA-P0-*` | route/component/API/test | waiting for P0 close |
| `WY-MYA-P1-004` | `P1` | `docs/runtime` | Define dependency handoff matrix (`MY_ASSIGNMENTS -> SESSIONS/PENDING_REVIEW`) with audit trail invariants. | `WY-MYA-P0-*` | route/component/API/test | waiting for P0 close |
| `WY-MYA-P1-005` | `P1` | `runtime/test` | Define Menu 3 sync-health indicators and next-action guidance for assignment operations. | `WY-MYA-P0-*` | component/test | waiting for P0 close |
| `WY-MYA-P2-001` | `P2` | `runtime/test` | Define cross-lane handoff regression from assignment actions to `WY_SESSIONS` and `WY_PENDING_REVIEW` with explicit provenance and review guards. | `WY-MYA-P0-001`,`WY-MYA-P1-001` | route/component/API/test | waiting for P0 close |
| `WY-MYA-P2-002` | `P2` | `runtime/test` | Add bulk triage operations with mandatory review/diff before apply. | `WY-MYA-P1-002`,`WY-MYA-P1-003` | component/API/test | waiting for P0 close |
| `WY-MYA-P2-003` | `P2` | `runtime/test` | Add workload balancing heuristics based on SLA pressure, risk, and assignee load. | `WY-MYA-P1-004`,`WY-MYA-P1-005` | route/component/test | waiting for P0 close |
| `WY-MYA-P2-004` | `P2` | `runtime/test` | Add predictive routing suggestions (next-best-action) with explicit approval boundaries and no hidden writes. | `WY-MYA-P1-*` | route/component/API/test | waiting for P0 close |
| `WY-MYA-P2-005` | `P2` | `runtime/test` | Add aging-intelligence dashboard contract for trend detection and escalation recommendations. | `WY-MYA-P1-002`,`WY-MYA-P1-005` | route/component/test | waiting for P0 close |

## 9. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| My Assignments tab is canonical personal queue in Interview hub | `/interview`, `/discovery`, and hub `my_assignments` tab route context | `InterviewHub` assignment table/cards and preview panel | assignment loading/mutation boundary in interview API client | assignment tab render/open regression | `PASS` |
| `assignmentId` deep-link opens correct context | deep-link route state to Interview hub | selected-row/preview synchronization behavior | assignment lookup/open endpoint contract | deep-link open and fallback tests | `PASS_WITH_P2` |
| Assignment transitions preserve dependency-safe handoff | route transition from assignment context to sessions/review context | row actions and next-action controls | API payload fields preserving source/session identifiers | cross-lane handoff regression tests | `PASS_WITH_P2` |
| Assignment health and sync posture is explicit per row | assignment route state and filters for health groups | state badges and conflict/error indicators in assignment list | health-state enum and read-back status fields | health-state and conflict replay tests | `PASS_WITH_P2` |
| SLA/aging and bulk triage recommendations remain auditable | assignment queue route with SLA/aging segments | bulk action and escalation controls with review step | audit/event payload for triage and escalation decisions | bulk triage + escalation regression suite | `MISSING` |

## 10. Cross-Module Impact

- impacted modules:
  - `03_wywiad/WY_SESSIONS` (impact-only): assignment "continue session" handoff path.
  - `03_wywiad/WY_PENDING_REVIEW` (impact-only): assignment outcomes entering review queue.
- handoff changes: none in runtime for this cycle; documentation locks expected handoff behavior only.
- ownership impact: `WY_MY_ASSIGNMENTS` remains owner of assignment queue semantics.
- security/tenant impact: deny-by-default and role/tenant boundaries stay mandatory.
- E2E workflow impact: assignment open/update path now explicitly maps into session/review dependency lanes without ownership transfer.
- global contract updates needed: none.

## 11. Done Gate

- contract complete: `PASS`
- UI/UX complete: `PASS`
- evidence complete: `PASS_WITH_P2`
- implementation backlog ready: `PASS`
- impact complete: `PASS`
- owner acceptance: `APPROVED_FOR_IMPLEMENTATION`
- rerun gate: `NOT_RUN (docs-only function cycle)`

## 12. Open Questions

| Question | Owner | Due | Blocking? |
| --- | --- | --- | --- |
| Should `assignmentId` deep-link failure always fall back to `my_assignments`, or to last active interview tab when access is denied? | user | 2026-05-24 | no |
| Is a dedicated assignment-to-review audit event required before moving `WY-MYA-P2-001` from design to runtime? | user | 2026-05-24 | no |
| Which minimum test set is required to move assignment flow evidence from `PASS_WITH_P2` to `PASS`? | user | 2026-05-24 | no |

## 13. Registry Sync Note

- registry sync completed: `2026-05-10`
- registry sync note: `P0-P2 backlog normalized and aligned with task board rows`
- synchronized artifacts:
  - `docs/modules/03_wywiad/function-cards/WY_MY_ASSIGNMENTS_EXECUTION_CARD.md`
  - `docs/modules/03_wywiad/IMPLEMENTATION_TASK_BOARD.md`
  - `docs/modules/03_wywiad/functions/WY_MY_ASSIGNMENTS.md`
- scope_anchor integrity: `03_wywiad/WY_MY_ASSIGNMENTS`
