---
module_id: MODULE_INTERVIEW
function_id: WY_MANAGED_ASSIGNMENTS
function_name: Interview — Managed Assignments
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Managed Assignments

## 1. Function Identity
- Function ID: `WY_MANAGED_ASSIGNMENTS`
- Module: `03_wywiad`
- UI labels: `Managed`, `Assigned by me` (manager surface)
- Route/AppView scope: Interview tab `managed` in `InterviewHub`
- Feature state: `real` (permission-dependent)

## 2. User Job and Business Outcome
- User job: oversee assigned interview workload and quality.
- Outcome: improved assignment governance and throughput.
- Non-goals: no hidden reassignment, no approval bypass.

## 3. Trigger and Entry Points
- Entry: `managed` tab in `InterviewHub`.
- Preconditions: managed-view permission.

## 4. UI Component Footprint
- `InterviewHub` managed table/cards + preview.
- Shared controls: filters, row actions, command row.

## 5. Inputs, Data Contracts, and Dependencies
- Data: managed assignments, overdue assignments, linked sessions.
- API: `V8InterviewApi.getManagedAssignments()`, `getOverdueAssignments()`.

## 6. Outputs and Side Effects
- Outputs: assignment updates, open-detail transitions, review routing.

## 7. Ownership and Handoff Boundaries
- Owner: interview assignment records.
- Must not silently write non-interview canonical entities.

## 8. Runtime States and UX Behavior
- Explicit loading/empty/error/degraded/success required.
- Next actions: open, reassign, review, retry.

## 9. AI, Source, Evidence, Approval
- AI assistance scoped to context controls.
- Source/session provenance must remain visible for decisions.

## 10. Security, Roles, and Tenancy
- Role-gated managed surface; deny on insufficient scope.

## 11. Acceptance Criteria and Test Evidence

- Managed tab loads and separates manager workload from personal queue.
- Gap: no dedicated automated manager-assignment test.
- Execution card: `function-cards/WY_MANAGED_ASSIGNMENTS_EXECUTION_CARD.md`
- Task ID families: `WY-MGA-P0-*`, `WY-MGA-P1-*`, `WY-MGA-P2-*`

- Route evidence: module route/view scope for `03_wywiad` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `03_wywiad` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `03_wywiad` user flows.

## 12. Open Risks and Change Log
- Risk: manager filters can drift from SLA expectations.
- Change log: execution-card and implementation-task-board linkage added for `WY-MGA-*` scope.

## 13. Execution Card and Task Board Linkage

- Scope anchor lock: `03_wywiad/WY_MANAGED_ASSIGNMENTS` (immutable for this cycle).
- Source execution card: `docs/modules/03_wywiad/function-cards/WY_MANAGED_ASSIGNMENTS_EXECUTION_CARD.md`.
- Source task board row set: `docs/modules/03_wywiad/IMPLEMENTATION_TASK_BOARD.md` (`WY-MGA-*` only).
- Active task IDs:
  - `WY-MGA-P0-001` .. `WY-MGA-P0-003` (`READY`)
  - `WY-MGA-P1-001` .. `WY-MGA-P1-004` (`WAITING_P0`)
  - `WY-MGA-P2-001` .. `WY-MGA-P2-004` (`WAITING_P0`)
- Dependency scope (`impact-only`): `WY_MY_ASSIGNMENTS`, `WY_PENDING_REVIEW`, `WY_SESSIONS`.
