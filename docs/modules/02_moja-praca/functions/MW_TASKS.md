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
- Upstream modules/services: task producers across modules and event bus refresh.
- APIs/models: shared API client and task domain types.
- Data freshness assumptions: counts and list may update independently from detail panel state.

## 6. Outputs and Side Effects

- Produced objects/artifacts: task updates (status/priority/due date), created tasks.
- Downstream handoff: task detail and owner flows for related artifacts.
- Side effects visible to user: bulk updates, create/open task, view-mode transitions.

## 7. Ownership and Handoff Boundaries

- Canonical owner of mutated objects: task domain.
- Handoff contract (`from -> to`): task actions update task records; linked object edits defer to owner modules.
- Forbidden ownership: task tab cannot directly mutate decisions/initiatives canonical state.

## 8. Runtime States and UX Behavior

- Loading: visible loading state for list/board/calendar modes.
- Empty: no-task state with clear create/reprioritize CTA.
- Error: recoverable error state without exposing internals.
- Degraded: partial data (for example counters) must be visible as degraded, not success.
- Success: create/edit/bulk actions confirm completion and keep context.
- Next action guidance per state: create, reprioritize, delegate, complete, or retry.

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
  - Tasks tab supports list/kanban/calendar and filter modes.
  - Bulk actions are available only in explicit bulk mode.
  - Task detail opens from list/board/calendar and preserves context.
  - `src/components/MyWork/MyWorkHub.tsx`
  - `src/components/MyWork/MyTasksListContent.tsx`
  - `src/components/MyWork/TasksKanbanBoard.tsx`
  - `src/components/MyWork/TasksCalendarView.tsx`
  - `src/components/MyWork/TaskDetailView.tsx`
- Known `doc_gap`: complete filter semantics and copy set are not fully listed.
- Known `code_gap`: no dedicated contract-level test for all three tasks view modes.

- Route evidence: module route/view scope for `02_moja-praca` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `02_moja-praca` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `02_moja-praca` user flows.

## 12. Open Risks and Change Log

- Risks/assumptions: many controls in one row can reduce discoverability without guidance copy.
- Open decisions: final default task view mode policy.
- Change log: initial function contract created.
