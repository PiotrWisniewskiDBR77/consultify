---
module_id: MODULE_INTERVIEW
function_id: WY_MANAGED_ASSIGNMENTS
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Function Execution Card - WY_MANAGED_ASSIGNMENTS

## 1. Metadata

- scope_anchor: `03_wywiad/WY_MANAGED_ASSIGNMENTS`
- primary_module: `03_wywiad`
- primary_function: `WY_MANAGED_ASSIGNMENTS`
- parent_function: `WY_MANAGED_ASSIGNMENTS`
- cycle: `Decision -> UI/UX -> Build contract -> Impact -> Done`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: function contract hardening and implementation backlog for `WY_MANAGED_ASSIGNMENTS`.
- Out of scope: runtime code changes, any non-`WY_MANAGED_ASSIGNMENTS` function contract rewrites, cross-module task creation.
- Allowed global documents: function dispatch protocol, function execution card template, module behavior/UI/acceptance contracts.
- Forbidden files: all runtime paths (`src/**`, `server/**`, `tests/**`) and non-deliverable function cards.
- Immutable rule: this cycle keeps one anchor only: `03_wywiad/WY_MANAGED_ASSIGNMENTS`.

## 3. Dependency Scope

Dependency scope is read-only and impact-only.

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `WY_MY_ASSIGNMENTS` | compare assignment-lane semantics and avoid ownership overlap | editing `WY_MY_ASSIGNMENTS` backlog as primary scope |
| `WY_PENDING_REVIEW` | define managed-to-review handoff impact and explicit approval guard | changing review-lane ownership or runtime behavior docs |
| `WY_SESSIONS` | define managed assignment to session-open continuity impact | changing sessions contract/task rows as primary scope |

## 4. Source Inputs

- RAW sources:
  - `docs/modules/03_wywiad/RAW_INPUT.md`
- module contracts:
  - `docs/modules/03_wywiad/03_BEHAVIOR.md`
  - `docs/modules/03_wywiad/04_UI_UX.md`
  - `docs/modules/03_wywiad/07_ACCEPTANCE_AND_TESTS.md`
- function contracts:
  - `docs/modules/03_wywiad/functions/WY_MANAGED_ASSIGNMENTS.md`
  - `docs/modules/03_wywiad/functions/WY_MY_ASSIGNMENTS.md`
  - `docs/modules/03_wywiad/functions/WY_PENDING_REVIEW.md`
  - `docs/modules/03_wywiad/functions/WY_SESSIONS.md`
- runtime evidence sources:
  - `src/components/Interview/InterviewHub.tsx`
  - `src/services/api/v8/interview.ts`
- previous decisions:
  - no runtime edits in this cycle (`docs-only`)

## 5. Decision Matrix

| Requirement | AS-IS | TARGET | DELTA | Decision | Rationale |
| --- | --- | --- | --- | --- | --- |
| Managed tab identity and permission gating | Contract identifies manager surface and permission dependency. | Keep managed lane identity and role-gated boundary unchanged. | No ownership gap, but needs execution linkage. | `KEEP` | Existing doctrine matches module behavior and UI contracts. |
| Managed and overdue assignment handling | Contract notes managed + overdue loaders without task-level evidence mapping. | Add evidence-backed execution tasks covering managed and overdue visibility flow. | Missing deployable backlog granularity for managed lane. | `ENHANCE` | Converts high-level contract to executable work units. |
| Managed productivity and prioritization tooling | Inspiration backlog exists but was not normalized into registry-ready tasks. | Normalize initiative backlog for SLA triage, WIP guardrails, bulk actions, and manager digest. | Needed stable P0/P1/P2 registration for future implementation. | `NEW` | Keeps planning auditable without runtime edits. |
| Cross-lane handoff from managed workload | Dependencies are implied, not explicitly impact-locked. | Lock impact-only dependency rules for `WY_MY_ASSIGNMENTS`, `WY_PENDING_REVIEW`, `WY_SESSIONS`. | Dependency boundaries are not explicit in current planning artifacts. | `ENHANCE` | Prevents scope drift and ownership confusion. |
| Automated regression depth for manager lane | Module acceptance indicates test-depth gap at InterviewHub level. | Add P1/P2 runtime-test backlog for managed filters, overdue, and handoff safety. | Missing manager-specific regression plan. | `NEW` | Required to advance evidence from doc-only to runtime-ready confidence. |

## 6. UI/UX Component Contract

- approved shell/component family: `InterviewHub` managed table/cards + preview panel.
- Menu 2 surface: module shell `Wywiad`.
- Menu 3 actions: managed filters, assignment controls, row actions, AI/context controls in command-row right context.
- AI action placement: Menu 3/right-side or row/modal context only; no duplicate toolbar in canvas.
- runtime states:
  - `loading`: managed list and overdue indicators are explicit.
  - `empty`: clear next action (`clear filters`, `switch queue`, `refresh`).
  - `error`: safe mapped error and explicit retry.
  - `degraded`: partial managed/overdue/session linkage is labeled as degraded.
  - `success`: reassignment/open/review routing confirms outcome.
- source/provenance/evidence UI: manager decisions must preserve assignment source and linked session provenance.
- approval/review/diff behavior: review routing and high-impact outcomes require explicit user action; no hidden approval path.
- anti-patterns:
  - manager actions bypassing tenant or role boundaries,
  - hidden mutation of review/session state without explicit action,
  - duplicate AI controls outside Menu 3 scope.

## 7. Contract Update Plan

| File | Required update | Reason | Status |
| --- | --- | --- | --- |
| `functions/WY_MANAGED_ASSIGNMENTS.md` | add execution-card and task-board linkage with scoped task IDs | keep function contract and execution backlog synchronized | `DONE` |
| `03_BEHAVIOR.md` | no update required | assignment lane behavior already covers managed function at module level | `NOT_REQUIRED` |
| `04_UI_UX.md` | no update required | Menu 3 + AI placement doctrine already canonical and sufficient | `NOT_REQUIRED` |
| `07_ACCEPTANCE_AND_TESTS.md` | no update required | function acceptance row exists and stays valid for this docs cycle | `NOT_REQUIRED` |
| `RAW_TARGET_STATE_2_0_PACKET.md` | no update required in this cycle | docs-only function cycle, no packet rewrite requested | `NOT_REQUIRED` |

## 8. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `WY-MGA-P0-001` | `P0` | `docs` | Lock scope anchor, managed-lane ownership boundaries, and evidence mapping for managed + overdue assignment handling. | owner docs acceptance | route/component/API/test | contract/UI/impact complete |
| `WY-MGA-P0-002` | `P0` | `docs` | Define managed-lane KPI canon (`overdue_rate`, `assignment_aging`, `throughput`) and reporting semantics for future implementation. | `WY-MGA-P0-001` | route/component/API/test | contract/evidence complete |
| `WY-MGA-P0-003` | `P0` | `docs` | Define guardrails for role gating, tenant boundaries, and explicit mutation policy for manager actions. | `WY-MGA-P0-001` | route/component/API/test | security/impact complete |
| `WY-MGA-P1-001` | `P1` | `runtime/test` | Define SLA triage lane (`0-2`, `3-5`, `6+ days`) with manager-facing risk filters. | `WY-MGA-P0-001`,`WY-MGA-P0-002`,`WY-MGA-P0-003` | route/component/API/test | waiting for P0 close |
| `WY-MGA-P1-002` | `P1` | `runtime/test` | Define WIP limit controls per owner/team with overload warning behavior. | `WY-MGA-P0-001`,`WY-MGA-P0-002`,`WY-MGA-P0-003` | route/component/API/test | waiting for P0 close |
| `WY-MGA-P1-003` | `P1` | `runtime/test` | Define bulk action flow (`reassign`, `priority`) with mandatory preview and explicit confirm. | `WY-MGA-P0-001`,`WY-MGA-P0-002`,`WY-MGA-P0-003` | route/component/API/test | waiting for P0 close |
| `WY-MGA-P1-004` | `P1` | `runtime/test` | Define "next best action" guidance contract for empty/error/degraded/success states in managed view. | `WY-MGA-P0-001`,`WY-MGA-P0-002`,`WY-MGA-P0-003` | route/component/API/test | waiting for P0 close |
| `WY-MGA-P2-001` | `P2` | `runtime/test` | Define cross-lane handoff checklist to `WY_SESSIONS` and `WY_PENDING_REVIEW` with provenance and review gates. | `WY-MGA-P0-001`,`WY-MGA-P1-001` | route/component/API/test | waiting for P0 close |
| `WY-MGA-P2-002` | `P2` | `runtime/test` | Define manager digest contract (weekly bottlenecks, overdue drift, lead-time trends). | `WY-MGA-P0-002`,`WY-MGA-P1-001`,`WY-MGA-P1-002` | route/component/API/test | waiting for P0 close |
| `WY-MGA-P2-003` | `P2` | `runtime/test` | Define reassignment recommendation heuristics as explicit suggestions (no hidden auto-mutations). | `WY-MGA-P0-003`,`WY-MGA-P1-003` | route/component/API/test | waiting for P0 close |
| `WY-MGA-P2-004` | `P2` | `runtime/test` | Define E2E regression package for manager flows: visibility, overdue handling, bulk safety, and handoff integrity. | `WY-MGA-P0-001`,`WY-MGA-P1-001`,`WY-MGA-P1-002`,`WY-MGA-P1-003`,`WY-MGA-P1-004` | route/component/API/test | waiting for P0 close |

## 9. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Managed tab is canonical manager queue in Interview hub | `/interview`, `/discovery` route context with managed tab gating | `InterviewHub` managed table/cards, filters, preview | managed and overdue assignment loading boundaries in interview API client | managed tab render and role-gate regression | `PASS` |
| Managed + overdue visibility is explicit and actionable | managed tab state and filter route context | overdue chips/filters and row actions in managed view | overdue payload boundary in interview API contracts | overdue display and filter behavior tests | `PASS_WITH_P2` |
| Managed transitions preserve safe handoff to session/review lanes | assignment-to-session/review route transition context | row actions and next-action controls | payload continuity for source/session/review identifiers | cross-lane handoff regression tests | `MISSING` |
| Managed prioritization initiatives are registry-ready | managed tab routing and priority-context entry points | command-row/right-context affordances for triage/WIP/bulk flows | API contract fields for assignment priority/ownership/aging and audit context | initiative-level regression package scoped to `WY-MGA-P1-*` and `WY-MGA-P2-*` | `PASS_WITH_P2` |

## 10. Cross-Module Impact

- impacted modules:
  - `03_wywiad/WY_MY_ASSIGNMENTS` (impact-only): assignment-lane semantic alignment without ownership transfer.
  - `03_wywiad/WY_PENDING_REVIEW` (impact-only): managed outcomes entering explicit review queue.
  - `03_wywiad/WY_SESSIONS` (impact-only): managed assignment open/continue-session transitions.
- handoff changes: none in runtime for this cycle; documentation locks expected handoff behavior only.
- ownership impact: `WY_MANAGED_ASSIGNMENTS` remains owner of manager queue semantics only.
- security/tenant impact: permission-gated managed surface and deny-by-default behavior remain mandatory.
- E2E workflow impact: manager assignment workflows are now explicitly mapped to session/review dependency lanes.
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
| Should managed overdue defaults prefer "all overdue" or preserve the user's last managed filter when reopening the tab? | user | 2026-05-24 | no |
| Is explicit audit trail evidence required before promoting managed-to-review handoff checks from P2 to P1? | user | 2026-05-24 | no |
| Which minimum managed-lane regression set is required to move evidence status from `PASS_WITH_P2` to `PASS`? | user | 2026-05-24 | no |

## 13. Registry Sync Note

- registry sync completed: `2026-05-10` (initiative backlog normalized P0/P1/P2)
- synchronized artifacts:
  - `docs/modules/03_wywiad/function-cards/WY_MANAGED_ASSIGNMENTS_EXECUTION_CARD.md`
  - `docs/modules/03_wywiad/IMPLEMENTATION_TASK_BOARD.md`
  - `docs/modules/03_wywiad/functions/WY_MANAGED_ASSIGNMENTS.md`
- scope_anchor integrity: `03_wywiad/WY_MANAGED_ASSIGNMENTS`
