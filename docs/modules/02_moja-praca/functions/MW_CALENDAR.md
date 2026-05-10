---
module_id: MODULE_MY_WORK
function_id: MW_CALENDAR
function_name: Calendar / Kalendarz
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Calendar / Kalendarz

## 1. Function Identity

- Function ID: `MW_CALENDAR`
- Module: `02_moja-praca`
- UI labels/aliases: `Kalendarz`, `Calendar`
- Route/AppView scope: `AppView.MY_WORK`, `"/my-work/calendar"`
- Feature state: `real`

## 2. User Job and Business Outcome

- User job: plan and inspect time-linked execution work.
- Business outcome: reduce scheduling conflicts and improve execution cadence.
- Non-goals: calendar is not the canonical owner of task/decision/initiative records.

## 3. Trigger and Entry Points

- Entry points: Calendar tab and deep-link path.
- Preconditions: My Work access.
- Blocking conditions: none beyond ACL.

## 4. UI Component Footprint

- Top-level container/view components: `MyWorkHub`.
- Function runtime components: `CalendarView`.
- Shared shell behavior: command row and My Work layout/overflow rules for calendar mode.
- Component ownership notes: calendar content component is module-local.

## 5. Inputs, Data Contracts, and Dependencies

- Input objects/fields: time-based tasks/decisions/initiatives, create request id, refresh trigger.
- Upstream modules/services: task and decision domains, initiative links.
- APIs/models: shared API and artifact routing helpers.
- Data freshness assumptions: calendar view refreshes based on trigger and local interactions.

## 6. Outputs and Side Effects

- Produced objects/artifacts: no new canonical type; emits open-item navigation and optional create intent.
- Downstream handoff: `onTaskClick`, `onDecisionClick`, initiative navigation.
- Side effects visible to user: opened detail contexts and route transitions.

## 7. Ownership and Handoff Boundaries

- Canonical owner of mutated objects: source domains (tasks/decisions/initiatives).
- Handoff contract (`from -> to`): `CalendarView -> MyWorkHub handlers -> owner detail/workflow`.
- Forbidden ownership: calendar must not bypass owner-module mutation contracts.

## 8. Runtime States and UX Behavior

- Loading: calendar waits for schedule dataset with visible loading state.
- Empty: no-events state explains next steps.
- Error: recoverable error state with retry.
- Degraded: partial event sources can fail while view remains usable.
- Success: selecting events routes user to actionable detail.
- Next action guidance per state: add/schedule/open owner item, or retry sync.

## 9. AI, Source, Evidence, Approval

- AI action placement: Menu 3/right command-row conventions only.
- Source/provenance visibility: events must expose source object type and id.
- Approval/diff/review requirements: any high-impact change must happen in owner workflow.
- Audit trail/evidence: route hops and linked source item context are visible evidence.

## 10. Security, Roles, and Tenancy

- Allowed roles: users with My Work access.
- Denied/restricted roles: ACL denied users.
- ACL/tenant scope: tenant-bounded calendar entries.
- Sensitive data masking/redaction: inherited from source permissions.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks:
  - Calendar tab renders and supports event-to-detail navigation.
  - Events preserve source context.
  - Calendar does not take ownership over source entities.
  - `src/components/MyWork/MyWorkHub.tsx`
  - `src/components/MyWork/TasksCalendarView.tsx`
- Known `doc_gap`: full event type matrix is not yet documented.
- Known `code_gap`: missing dedicated module-level calendar contract test.

- Route evidence: module route/view scope for `02_moja-praca` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `02_moja-praca` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `02_moja-praca` user flows.

## 12. Open Risks and Change Log

- Risks/assumptions: cross-module timing data drift may affect planning quality.
- Open decisions: harmonize calendar semantics with tasks calendar mode.
- Change log: initial function contract created.
