---
module_id: MODULE_MY_WORK
function_id: MW_TASKS
function_name: Tasks / Zadania
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Tasks / Zadania

> Kompletny kontrakt implementacyjny: [`TASKS_COMPLETE_PRODUCT_CONTRACT.md`](../../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/TASKS_COMPLETE_PRODUCT_CONTRACT.md). Wspólny system z Decisions: [`MY_WORK_TASKS_AND_DECISIONS_OPERATING_SYSTEM.md`](../../../program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/MY_WORK_TASKS_AND_DECISIONS_OPERATING_SYSTEM.md).

## 1. Function Identity

- Function ID: `MW_TASKS`
- Module: `02_moja-praca`
- UI labels/aliases: `Zadania`, `Tasks`
- Route/AppView scope: `AppView.MY_WORK`, `"/my-work/tasks"`, `"/my-work/tasks/:taskId"`
- Feature state: `real`

## 2. User Job and Business Outcome

- User job: manage execution tasks, priorities, and completion flow.
- Business outcome: higher throughput and clearer execution focus.
- Non-goals: task function must not hide approval/security checks for high-impact changes.

## 3. Trigger and Entry Points

- Entry points: Tasks tab, deep-link path/query, open-document events.
- Preconditions: My Work access.
- Blocking conditions: none beyond ACL/tenant controls.

## 4. UI Component Footprint

- Top-level container/view components: `MyWorkHub`.
- Function runtime components: `MyTasksListContent`, `TasksKanbanBoard`, `TasksCalendarView`, `TaskDetailView`.
- Command-row controls: task filter chips, bulk-action pills, view-mode toggle (`table/kanban/calendar`).
- Component ownership notes: task tab controls are module-local in shared hub shell.

## 5. Inputs, Data Contracts, and Dependencies

- Input objects/fields: task list, filter/search state, due date/priority metadata, bulk selection state.
- Upstream modules/services: task producers across modules, event bus refresh, Inbox triage sources, and decision-outcome follow-ups.
- APIs/models: shared API client and task domain types.
- Data freshness assumptions: counts and list may update independently from detail panel state.
- Dependency scope (impact-only):
  - `MW_INBOX`: intake source and routing context for task candidates.
  - `MW_DECISIONS`: decision outcome context that can create/reshape tasks.
  - `06_realizacja`: owner read-back boundary for execution lifecycle visibility.

## 6. Outputs and Side Effects

- Produced objects/artifacts: task updates (status/priority/due date), created tasks.
- Downstream handoff: explicit candidate handoff to owner lanes; no hidden canonical mutation outside task domain.
- Side effects visible to user: bulk updates, create/open task, view-mode transitions.

## 7. Ownership and Handoff Boundaries

- Canonical owner of mutated objects: task domain.
- Handoff contract (`from -> to`): `Inbox/Decisions context -> Tasks action -> explicit owner handoff/read-back` when lifecycle spans modules.
- Forbidden ownership:
  - task tab cannot directly mutate decisions/initiatives canonical state,
  - task tab cannot claim `06_realizacja` canonical lifecycle success without owner read-back.

## 8. Runtime States and UX Behavior

- Loading: visible loading state for list/board/calendar modes.
- Empty: no-task state with clear create/reprioritize CTA.
- Error: recoverable error state without exposing internals.
- Degraded: partial data (for example counters) must be visible as degraded, not success.
- Success: create/edit/bulk actions confirm completion and keep context.
- Next action guidance per state: create, reprioritize, delegate, complete, or retry.
- View-mode parity invariant:
  - filters and bulk intent must remain explicit in `list`, `kanban`, and `calendar`,
  - detail open from each mode must preserve origin context and safe return path.

## 9. AI, Source, Evidence, Approval

- AI action placement: command row/Menu 3 conventions only.
- Source/provenance visibility: task links keep originating context visible.
- Approval/diff/review requirements: high-impact transitions require owner-review when policy requires.
- Audit trail/evidence: bulk and single task mutations are traceable in runtime behavior.

## 10. Security, Roles, and Tenancy

- Allowed roles: users with My Work task access.
- Denied/restricted roles: ACL denied users.
- ACL/tenant scope: tenant-scoped task operations.
- Sensitive data masking/redaction: follows role/tenant policy.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks:
  - Tasks tab supports list/kanban/calendar with parity of filter and bulk behavior.
  - Bulk actions are available only in explicit bulk mode.
  - Task detail opens from list/board/calendar and preserves context.
  - Cross-module context from `MW_INBOX` and `MW_DECISIONS` remains visible and traceable in task detail.
  - Handoff to `06_realizacja` follows explicit review/read-back and never implies hidden success.
  - `src/components/MyWork/MyWorkHub.tsx`
  - `src/components/MyWork/MyTasksListContent.tsx`
  - `src/components/MyWork/TasksKanbanBoard.tsx`
  - `src/components/MyWork/TasksCalendarView.tsx`
  - `src/components/MyWork/TaskDetailView.tsx`
- Known `doc_gap`: full filter semantics/copy matrix and bulk safety microcopy still need explicit catalog.
- Known `code_gap`: no dedicated integration suite covering tri-view parity + handoff read-back chain.

- Route evidence: module route/view scope for `02_moja-praca` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `02_moja-praca` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `02_moja-praca` user flows.

## 12. Open Risks and Change Log

- Risks/assumptions:
  - many controls in one row can reduce discoverability without guidance copy,
  - cross-module context can be misread if provenance labels are too subtle.
- Open decisions:
  - final default task view mode policy,
  - minimal read-back payload required from `06_realizacja` before success confirmation.
- Change log: contract hardened for dependency impact, ownership boundary, and tri-view acceptance parity.
