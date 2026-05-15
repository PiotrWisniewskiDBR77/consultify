---
module_id: MODULE_MY_WORK
function_id: MW_TASKS
doc_kind: FUNCTION_EXECUTION_CARD
owner_business: user
owner_tech: user
status: REVIEW
last_updated: 2026-05-10
---

# Function Execution Card — MW_TASKS

## 1. Metadata

- scope_anchor: `02_moja-praca/MW_TASKS`
- primary_module: `02_moja-praca`
- primary_function: `MW_TASKS`
- parent_function: `MW_TASKS`
- cycle: `Decision -> UI/UX -> Build contract -> Impact -> Done`
- work_type: `docs-only`

## 2. Scope Anchor

- In scope: contract hardening for Tasks (`MW_TASKS`), execution backlog rows `MW-TASKS-*`, dependency impact mapping for Inbox/Decisions/Realizacja, evidence and done-gate definition.
- Out of scope: runtime implementation, updates to non-Tasks function cards, edits outside `deliverables_exact`.
- Allowed global documents: function dispatch protocol, function execution card template, module behavior/UI/acceptance docs, Tasks function contract.
- Forbidden files: `src/**`, `server/**`, `tests/**`, non-Tasks function cards and non-listed module files.
- Immutable rule: this run is locked to `02_moja-praca/MW_TASKS`.

## 3. Dependency Scope

Dependency scope is read-only and impact-only.

| Dependency | Allowed use | Forbidden use |
| --- | --- | --- |
| `MW_INBOX` | define intake impact (`inbox -> task candidate`) and source provenance requirements | changing Inbox ownership contract or runtime behavior |
| `MW_DECISIONS` | define decision-to-execution impact (`decision outcome -> task`) and review/read-back boundary | mutating decision lifecycle from Tasks scope |
| `06_realizacja` | define handoff impact for execution chain and owner read-back expectations | treating `MW_TASKS` as PMO lifecycle owner |

## 4. Source Inputs

- RAW sources:
  - `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md`
- module contracts:
  - `docs/modules/02_moja-praca/03_BEHAVIOR.md`
  - `docs/modules/02_moja-praca/04_UI_UX.md`
  - `docs/modules/02_moja-praca/07_ACCEPTANCE_AND_TESTS.md`
  - `docs/modules/02_moja-praca/IMPLEMENTATION_TASK_BOARD.md`
- function contracts:
  - `docs/modules/02_moja-praca/functions/MW_TASKS.md`
  - `docs/modules/02_moja-praca/functions/MW_INBOX.md`
  - `docs/modules/02_moja-praca/functions/MW_DECISIONS.md`
- runtime evidence sources:
  - `src/components/MyWork/MyWorkHub.tsx`
  - `src/components/MyWork/MyTasksListContent.tsx`
  - `src/components/MyWork/TasksKanbanBoard.tsx`
  - `src/components/MyWork/TasksCalendarView.tsx`
  - `src/components/MyWork/TaskDetailView.tsx`
- previous decisions:
  - Tasks remains a My Work execution surface; canonical PMO lifecycle remains in `06_realizacja`.

## 5. Decision Matrix

| Requirement | AS-IS | TARGET | DELTA | Decision | Rationale |
| --- | --- | --- | --- | --- | --- |
| Function boundary | Tasks contract exists with basic ownership rule. | Explicitly lock Tasks as execution surface with candidate-only cross-module handoff. | Need stricter owner boundary versus `06_realizacja`. | `ENHANCE` | Prevent ownership drift and hidden lifecycle writes. |
| Dependency impact semantics | Inbox/Decisions dependencies are implicit. | Explicit intake and handoff impact semantics for `MW_INBOX` and `MW_DECISIONS`. | Add source and review boundary requirements. | `NEW` | Ensure traceable task origins and safe governance. |
| View-mode parity | List/Kanban/Calendar are listed in contract. | Add parity requirement for filters, bulk mode behavior, and detail context continuity across modes. | Clarify behavior invariants and non-goals. | `ENHANCE` | Reduce UX drift between task views. |
| AI/governance posture | Approval is noted broadly. | Lock `proposal -> approval -> execute` for high-impact transitions and preserve audit trail. | Add explicit high-impact boundary text. | `ENHANCE` | Align with security and tenancy guardrails. |
| Acceptance evidence depth | Route/component/API/test references exist. | Add concrete acceptance and test tasks for tri-view contract and cross-module handoff read-back. | Need taskized evidence completion plan. | `NEW` | Close known `code_gap` and doc-level ambiguity. |

## 6. UI/UX Component Contract

- approved shell/component family: `MyWorkHub` with `MyTasksListContent`, `TasksKanbanBoard`, `TasksCalendarView`, and `TaskDetailView`.
- Menu 2 surface: `Zadania` / `Tasks` tab under `02_moja-praca`.
- Menu 3 actions: contextual task actions and AI controls in right-side command row slot.
- AI action placement: Menu 3 only; no duplicated contextual AI toolbar in task canvas/content.
- runtime states:
  - `loading`: list/board/calendar loading is explicit and scoped to active mode.
  - `empty`: mode-specific empty guidance with create/reprioritize CTA.
  - `error`: recoverable error with retry/reopen, without internal payload leakage.
  - `degraded`: partial counts, stale data, or permission-limited actions are visible and non-silent.
  - `success`: create/edit/bulk/update confirms result and preserves current context.
- source/provenance/evidence UI: task row/detail keeps origin context (Inbox/Decision/other source) visible for auditability.
- approval/review/diff behavior: high-impact transitions and downstream handoff require explicit approval and owner-module read-back.
- anti-patterns:
  - silent cross-module mutation from task UI,
  - claiming owner mutation success without read-back,
  - duplicate AI controls in canvas and Menu 3.

## 7. Contract Update Plan

| File | Required update | Reason | Status |
| --- | --- | --- | --- |
| `functions/MW_TASKS.md` | tighten ownership boundary, dependency impact semantics, view-mode invariants, and acceptance wording | align contract with `scope_anchor` and dependency scope | `DONE` |
| `03_BEHAVIOR.md` | no update in this cycle | module-level behavior already contains My Work function runtime map | `NOT_REQUIRED` |
| `04_UI_UX.md` | no update in this cycle | module-level UI contract already lists `MW_TASKS` surface; Tasks-specific hardening in function card/contract | `NOT_REQUIRED` |
| `07_ACCEPTANCE_AND_TESTS.md` | no update in this cycle | evidence references remain valid; task backlog captures missing tests as P1/P2 | `NOT_REQUIRED` |
| `RAW_TARGET_STATE_2_0_PACKET.md` | no update in this cycle | mixed-scope packet intentionally untouched for immutable scope discipline | `NOT_REQUIRED` |

## 8. Implementation Backlog

| Task ID | Priority | Change type | Description | Depends on | Acceptance evidence | Done gate |
| --- | --- | --- | --- | --- | --- | --- |
| `MW-TASKS-P0-001` | `P0` | `docs/runtime` | Lock contract and implementation mapping for `Task <-> ClickUp` core fields (`status`, `assignee`, `due`, `priority`). | owner docs acceptance | route/component/API/test | contract and mapping baseline complete |
| `MW-TASKS-P0-002` | `P0` | `docs/runtime` | Lock ingestion path to `Inbox` only: `external -> InboxItem -> triage -> Task/Decision`. | `MW-TASKS-P0-001` | route/component/API/test | governed intake path complete |
| `MW-TASKS-P0-003` | `P0` | `runtime/test` | Lock read-back gate: no success state without owner/sync confirmation. | `MW-TASKS-P0-001`,`MW-TASKS-P0-002` | route/component/API/test | read-back chain complete |
| `MW-TASKS-P0-004` | `P0` | `docs/runtime/test` | Add per-task sync status and base conflict classes (`field_authority`, `concurrent_edit`, `status_model`). | `MW-TASKS-P0-001`,`MW-TASKS-P0-002` | component/API/test | sync posture baseline complete |
| `MW-TASKS-P0-005` | `P0` | `docs/runtime` | Define authority matrix per field, configurable per workspace/project. | `MW-TASKS-P0-001`,`MW-TASKS-P0-004` | component/API/test | field authority contract complete |
| `MW-TASKS-P0-006` | `P0` | `runtime/test` | Define ClickUp webhook pipeline with retry and fallback polling model. | `MW-TASKS-P0-001`,`MW-TASKS-P0-004`,`MW-TASKS-P0-005` | API/test | connector transport baseline complete |
| `MW-TASKS-P0-007` | `P0` | `runtime/test` | Define minimal audit trail (`who/what/when/from where`) for task sync and handoff mutations. | `MW-TASKS-P0-003`,`MW-TASKS-P0-004`,`MW-TASKS-P0-006` | component/API/test | audit baseline complete |
| `MW-TASKS-P1-001` | `P1` | `runtime/test` | Add conflict queue UI with replay controls and dead-letter inspection. | `MW-TASKS-P0-*` | route/component/API/test | waiting for P0 close |
| `MW-TASKS-P1-002` | `P1` | `runtime/test` | Add comments/review callbacks as first-class flow for Tasks and Decisions. | `MW-TASKS-P0-*` | component/API/test | waiting for P0 close |
| `MW-TASKS-P1-003` | `P1` | `runtime/test` | Add deduplication and classification for external communication events. | `MW-TASKS-P0-*` | route/component/API/test | waiting for P0 close |
| `MW-TASKS-P1-004` | `P1` | `docs/runtime/test` | Add bulk action safety (`diff preview`, confirmation, partial-failure handling). | `MW-TASKS-P0-*` | component/API/test | waiting for P0 close |
| `MW-TASKS-P1-005` | `P1` | `docs/runtime` | Add honest connector labeling in settings and provider cards (`tier`, depth, limits). | `MW-TASKS-P0-*` | route/component/API/test | waiting for P0 close |
| `MW-TASKS-P1-006` | `P1` | `test` | Add E2E test pack for main communication chain including ClickUp. | `MW-TASKS-P0-*` | route/component/API/test | waiting for P0 close |
| `MW-TASKS-P2-001` | `P2` | `runtime/test` | Add advanced custom-field mapping and schema governance for ClickUp task model. | `MW-TASKS-P0-*`,`MW-TASKS-P1-*` | component/API/test | waiting for P0 close |
| `MW-TASKS-P2-002` | `P2` | `runtime/test` | Add AI-assisted conflict resolution as proposal-only (no silent apply). | `MW-TASKS-P0-*`,`MW-TASKS-P1-*` | route/component/API/test | waiting for P0 close |
| `MW-TASKS-P2-003` | `P2` | `runtime/test` | Add capacity/conflict overlays in Tasks powered by sync metadata. | `MW-TASKS-P0-*`,`MW-TASKS-P1-*` | route/component/test | waiting for P0 close |
| `MW-TASKS-P2-004` | `P2` | `runtime/test` | Add mobile/async continuation cards for approval and task follow-up. | `MW-TASKS-P0-*`,`MW-TASKS-P1-*` | route/component/test | waiting for P0 close |
| `MW-TASKS-P2-005` | `P2` | `runtime` | Expand provider depth to Linear Tier B after ClickUp stabilization. | `MW-TASKS-P0-*`,`MW-TASKS-P1-*` | route/API/test | waiting for P0 close |

## 9. Evidence Plan

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| ClickUp core field mapping is explicit (`status/assignee/due/priority`) | `/my-work/tasks` + connector settings routes | task row/detail mapping chips and sync controls | `Task <-> ClickUp` mapping contract payload | mapping assertion suite in P1/P2 | `PASS_WITH_P2` |
| External communication ingestion is governed via Inbox only | inbox-to-task route chain | Inbox triage + Tasks origin labels | ingestion classifier and promotion payload | E2E ingestion chain in `MW-TASKS-P1-006` | `MISSING` |
| Success state requires owner/sync read-back | task action and handoff route transitions | explicit pending/read-back status in task UI | read-back ack fields in sync payload | read-back test chain in `MW-TASKS-P1-006` | `MISSING` |
| Per-task sync status and baseline conflict classes are visible | task route with sync indicator context | sync state badges and conflict flags in task surfaces | conflict class payload (`field_authority`, `concurrent_edit`, `status_model`) | conflict queue tests in `MW-TASKS-P1-001` | `MISSING` |
| Field-level authority matrix is configurable and auditable | workspace/project settings routes | authority matrix editor and preview | authority-policy payload and validation | matrix policy tests in `MW-TASKS-P1-006` | `PASS_WITH_P2` |
| ClickUp connector transport is resilient | connector and task sync routes | retry/fallback state indicators | webhook + retry + polling contracts | resilience tests in `MW-TASKS-P1-006` | `MISSING` |
| Audit trail is complete for sync and handoff chain | task history route context | event timeline (`who/what/when/from where`) | audit event schema and immutable trace IDs | audit trace assertions in `MW-TASKS-P1-006` | `MISSING` |

## 10. Cross-Module Impact

- impacted modules:
  - `MW_INBOX` (intake and source provenance),
  - `MW_DECISIONS` (decision outcome handoff into execution tasks),
  - `06_realizacja` (owner-lane read-back boundary for execution lifecycle).
- handoff changes: none in runtime this cycle; only contract-level hardening.
- ownership impact: `MW_TASKS` remains execution surface in My Work, not canonical PMO owner.
- security/tenant impact: explicit approval/read-back and deny-by-default behavior preserved.
- E2E workflow impact: formalized chain `source intake -> task action -> explicit handoff -> owner review/read-back`.
- global contract updates needed: none.

## 11. Done Gate

- contract complete: `PASS`
- UI/UX complete: `PASS`
- evidence complete: `PASS_WITH_P2`
- implementation backlog ready: `PASS`
- impact complete: `PASS`
- owner acceptance: `ACCEPTED_FOR_DOCS_ON_2026-05-10`
- rerun gate: `NOT_RUN (docs-only function cycle)`

## 11A. Registry Sync Note

- registry sync completed: `2026-05-10`
- synchronized artifacts:
  - `docs/modules/02_moja-praca/function-cards/MW_TASKS_EXECUTION_CARD.md`
  - `docs/modules/02_moja-praca/IMPLEMENTATION_TASK_BOARD.md`
  - `docs/modules/02_moja-praca/functions/MW_TASKS.md`
- scope_anchor integrity: `02_moja-praca/MW_TASKS`

## 12. Open Questions

| Question | Owner | Due | Blocking? |
| --- | --- | --- | --- |
| Which task transitions are classified as high-impact by default policy in `MW_TASKS`? | user | 2026-05-24 | no |
| Should Tasks default view be role-based (`list` for operators, `kanban` for managers) or globally fixed? | user | 2026-05-24 | no |
| Which minimal read-back payload fields from `06_realizacja` are mandatory before success confirmation? | user | 2026-05-24 | no |
