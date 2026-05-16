---
module_id: MODULE_INTERVIEW
function_id: WY_MY_ASSIGNMENTS
function_name: Interview — My Assignments
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — My Assignments

## 1. Function Identity
- Function ID: `WY_MY_ASSIGNMENTS`
- Module: `03_wywiad`
- UI labels/aliases: `My Assignments`, `Inbox`
- Route/AppView scope: Interview hub tab in `InterviewHub`
- Feature state: `real`

## 2. User Job and Business Outcome
- User job: process interviews assigned to current user.
- Business outcome: faster interview throughput and SLA compliance.
- Non-goals: no hidden reassignment or approval bypass.

## 3. Trigger and Entry Points
- Entry points: default Interview tab (`my_assignments`), deep link via `assignmentId`.
- Preconditions: authenticated user with interview access.
- Blocking conditions: no assignment access or tenant restrictions.

## 4. UI Component Footprint
- Core: `InterviewHub`.
- Function components: assignment table/cards and preview panel runtime in hub.
- Shared components: `RowActionsMenu`, command-row controls.
- Ownership notes: assignment UI is Interview-owned.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: assignment records, session linkage, status/priority metadata.
- Integrations: `V8InterviewApi.getMyAssignments()` / fallback API calls.
- Data freshness: refresh can be manual/event-driven.

## 6. Outputs and Side Effects
- Outputs: assignment status changes, open session/insight context.
- Side effects: toasts, preview changes, tab/document updates.
- Handoffs: explicit open to session/insight work.

## 7. Ownership and Handoff Boundaries
- Canonical owner: interview assignment domain.
- Handoff: assignment -> session/insight review path.
- Forbidden ownership: cannot directly finalize downstream initiatives/artifacts.

## 8. Runtime States and UX Behavior
- Loading, empty, error, degraded, success states must be explicit.
- Next actions: open assignment, continue session, retry, escalate.

## 9. AI, Source, Evidence, Approval
- AI actions only in command-row/context controls.
- Assignment-derived insight actions must preserve source/session provenance.
- High-impact conclusions require explicit review.

## 10. Security, Roles, and Tenancy
- Role/tenant scoped visibility enforced by shared auth + API contracts.
- Deny-by-default on uncertain scope.

## 11. Acceptance Criteria and Test Evidence

- Assignment tab renders and supports open/preview flows.
- Deep links with `assignmentId` resolve to the right tab/context.
- Gaps: missing dedicated InterviewHub automated regression tests.

- Route evidence: module route/view scope for `03_wywiad` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `03_wywiad` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `03_wywiad` user flows.

## 12. Open Risks and Change Log
- Risk: assignment filter complexity can hide urgent items.
- Change log: initial function contract created; execution-card/task-board linkage added for scoped delivery.

## 13. Execution Card and Task Board Linkage

- Scope anchor lock: `03_wywiad/WY_MY_ASSIGNMENTS` (immutable for this cycle).
- Source execution card: `docs/modules/03_wywiad/function-cards/WY_MY_ASSIGNMENTS_EXECUTION_CARD.md`.
- Source task board row set: `docs/modules/03_wywiad/IMPLEMENTATION_TASK_BOARD.md` (`WY-MYA-*` only).
- Active task IDs:
  - `WY-MYA-P0-001` .. `WY-MYA-P0-005` (`READY`)
  - `WY-MYA-P1-001` .. `WY-MYA-P1-005` (`WAITING_P0`)
  - `WY-MYA-P2-001` .. `WY-MYA-P2-005` (`WAITING_P0`)
- Dependency scope (`impact-only`): `WY_SESSIONS`, `WY_PENDING_REVIEW`.
