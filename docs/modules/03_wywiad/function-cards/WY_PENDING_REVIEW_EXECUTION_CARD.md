---
module_id: MODULE_INTERVIEW
function_id: WY_PENDING_REVIEW
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Function Execution Card — WY_PENDING_REVIEW

## 1. Metadata

- scope_anchor: `03_wywiad/WY_PENDING_REVIEW`
- primary_module: `03_wywiad`
- primary_function: `WY_PENDING_REVIEW`
- parent_function: `WY_PENDING_REVIEW`
- cycle: `Decision -> UI/UX -> Build contract -> Impact -> Done`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: function contract hardening and implementation backlog definition for `WY_PENDING_REVIEW`.
- Out of scope: runtime code changes, non-`WY_PENDING_REVIEW` contract rewrites, and cross-module task creation.
- Allowed global documents: function dispatch protocol, function execution card template, module behavior/UI/acceptance contracts.
- Forbidden files: all runtime paths (`src/**`, `server/**`, `tests/**`) and non-deliverable function cards.
- Immutable rule: this cycle keeps one anchor only: `03_wywiad/WY_PENDING_REVIEW`.

## 3. Dependency Scope

Dependency scope is read-only and impact-only.

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `WY_INSIGHTS` | capture insight-to-review provenance and review queue admission rules | editing insights contract/task rows as primary scope |
| `WY_MY_ASSIGNMENTS` | capture assignment outcomes that enter review queue | editing my-assignments contract/task rows as primary scope |
| `WY_MANAGED_ASSIGNMENTS` | capture manager-lane outcomes that require review | editing managed-assignments contract/task rows as primary scope |

## 4. Source Inputs

- RAW sources:
  - `docs/modules/03_wywiad/RAW_INPUT.md`
- module contracts:
  - `docs/modules/03_wywiad/03_BEHAVIOR.md`
  - `docs/modules/03_wywiad/04_UI_UX.md`
  - `docs/modules/03_wywiad/07_ACCEPTANCE_AND_TESTS.md`
- function contracts:
  - `docs/modules/03_wywiad/functions/WY_PENDING_REVIEW.md`
  - `docs/modules/03_wywiad/functions/WY_INSIGHTS.md`
  - `docs/modules/03_wywiad/functions/WY_MY_ASSIGNMENTS.md`
  - `docs/modules/03_wywiad/functions/WY_MANAGED_ASSIGNMENTS.md`
- runtime evidence sources:
  - `src/components/Interview/InterviewHub.tsx`
  - `src/services/api/v8/interview.ts`
- previous decisions:
  - no runtime edits in this cycle (`docs-only`)

## 5. Decision Matrix

| Requirement | AS-IS | TARGET | DELTA | Decision | Rationale |
| --- | --- | --- | --- | --- | --- |
| Review-lane identity and ownership | Function contract defines `pending_review` lane but had no stable execution linkage in card/board. | Keep ownership and explicit review identity with one synchronized backlog. | Need clean, non-duplicated execution artifact. | `ENHANCE` | Removes registry ambiguity and enables deterministic rollout. |
| Explicit approval and no hidden writes | Contract states explicit review actions and approval boundaries. | Keep explicit approval requirement and reinforce in backlog/evidence mapping. | Need task-level gating tied to evidence. | `ENHANCE` | Reduces risk of implicit approval drift in future implementation. |
| Dependency-safe intake to review queue | Review lane depends on insights and assignment outcomes. | Keep dependencies impact-only with explicit forbidden-use boundaries. | Dependency boundaries were implicit in module docs. | `ENHANCE` | Prevents scope drift during runtime expansion. |

## 6. UI/UX Component Contract

- approved shell/component family: `InterviewHub` pending-review table/preview controls.
- Menu 2 surface: module shell `Wywiad`.
- Menu 3 actions: review filters, approve/reject/send-back actions, and contextual AI support in right-side command-row or row/modal context.
- AI action placement: Menu 3/right-side or row/modal context only; no duplicate toolbar under canvas.
- runtime states:
  - `loading`: pending queue and preview loads are explicit.
  - `empty`: clear next action (`adjust filters`, `switch tab`, `refresh`).
  - `error`: safe mapped error with explicit retry.
  - `degraded`: incomplete provenance or partial queue data is labeled honestly.
  - `success`: approve/reject/send-back confirms resulting state.
- source/provenance/evidence UI: each review item must expose insight/session/assignment lineage.
- approval/review/diff behavior: review actions are explicit and auditable; no hidden finalization.

## 7. Contract Update Plan

| File | Required update | Reason | Status |
| --- | --- | --- | --- |
| `functions/WY_PENDING_REVIEW.md` | keep execution-card/task-board linkage synchronized with current rows | preserve single source of truth for registry IDs | `DONE` |
| `03_BEHAVIOR.md` | no update required | review lane behavior already documented | `NOT_REQUIRED` |
| `04_UI_UX.md` | no update required | Menu 3 and explicit review action doctrine already canonical | `NOT_REQUIRED` |
| `07_ACCEPTANCE_AND_TESTS.md` | no update required | function acceptance row exists and remains valid | `NOT_REQUIRED` |

## 8. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `WY-PRV-P0-001` | `P0` | `docs` | Normalize review-lane registry baseline: explicit approval gates, provenance requirements, and immutable scope governance for `WY_PENDING_REVIEW`. | owner docs acceptance | route/component/API/test | contract/UI/impact complete |
| `WY-PRV-P1-001` | `P1` | `runtime/test` | Define review execution package: queue filters, explicit approve/reject/send-back transitions, and evidence checklist enforcement. | `WY-PRV-P0-001` | route/component/API/test | waiting for P0 close |
| `WY-PRV-P2-001` | `P2` | `runtime/test` | Define scale-up package: cross-lane review handoff hardening, audit trace guarantees, and retrospective governance loop. | `WY-PRV-P0-001`,`WY-PRV-P1-001` | route/component/API/test | waiting for P0 close |

## 9. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Pending Review lane is explicit and permission-gated | `/interview`, `/discovery` + `pending_review` tab route context | `InterviewHub` pending review table and preview controls | review queue and transition endpoints in interview API client | review tab visibility + role-gate regressions | `PASS` |
| Review actions remain explicit and auditable | review route context with user-triggered actions only | approve/reject/send-back controls with visible confirmation | explicit transition payload boundaries | action + retry + error-state regressions | `PASS_WITH_P2` |
| Review queue preserves dependency-safe provenance | transitions from insights/assignments into review context | row/context rendering with source/session linkage | payload continuity for provenance identifiers | cross-lane handoff regression suite | `PASS_WITH_P2` |

## 10. Cross-Module Impact

- impacted modules:
  - `03_wywiad/WY_INSIGHTS` (impact-only): insights entering review queue.
  - `03_wywiad/WY_MY_ASSIGNMENTS` (impact-only): assignment outcomes requiring review.
  - `03_wywiad/WY_MANAGED_ASSIGNMENTS` (impact-only): manager-routed review outcomes.
- handoff changes: none in runtime for this cycle; documentation locks expected handoff behavior only.
- ownership impact: `WY_PENDING_REVIEW` remains owner of review-state semantics.
- security/tenant impact: role/tenant boundaries remain mandatory; deny-by-default on uncertain scope.

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
| Should review queue default sorting prioritize SLA risk, freshness, or source criticality when all are present? | user | 2026-05-24 | no |
| Is mandatory reviewer comment required for `send-back` before runtime rollout to P1? | user | 2026-05-24 | no |
| Which minimum regression set is required to move review-lane evidence from `PASS_WITH_P2` to `PASS`? | user | 2026-05-24 | no |

## 13. Registry Sync Note

- registry sync completed: `2026-05-10` (`module-readiness`)
- synchronized artifacts:
  - `docs/modules/03_wywiad/function-cards/WY_PENDING_REVIEW_EXECUTION_CARD.md`
  - `docs/modules/03_wywiad/IMPLEMENTATION_TASK_BOARD.md`
  - `docs/modules/03_wywiad/functions/WY_PENDING_REVIEW.md`
- scope_anchor integrity: `03_wywiad/WY_PENDING_REVIEW`
