---
module_id: MODULE_INITIATIVES
function_id: IN_PORTFOLIO_HUB
function_name: Initiatives — Portfolio Hub
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Portfolio Hub

## 1. Function Identity
- Function ID: `IN_PORTFOLIO_HUB`
- Entry route: `/initiatives`
- Runtime anchor: `InitiativesHub` tab `list`
- Feature state: `real`

## 2. User Job and Business Outcome
- Manage initiative portfolio in one operational surface.
- Drive status transitions and prioritization with traceability.

## 3. Trigger and Entry Points
- Sidebar initiatives entry and direct route `/initiatives`.

## 4. UI Component Footprint
- `InitiativesHub` table/kanban/timeline/grid view modes, preview panel, filter chips.

## 5. Inputs, Data Contracts, and Dependencies
- Initiative records, lifecycle metadata, planning snapshots, filter/scope state.

## 6. Outputs and Side Effects
- Initiative updates, opens, and explicit downstream handoff actions.

## 7. Ownership and Handoff Boundaries
- Owns initiative portfolio runtime, not execution/results canonical records.

## 8. Runtime States and UX Behavior
- Explicit loading/empty/error/degraded/success with next-action guidance.

## 9. AI, Source, Evidence, Approval
- AI actions in Menu 3/context controls only; source/evidence required.

## 10. Security, Roles, and Tenancy
- Tenant/ACL checks and governance-aware write paths.

## 11. Acceptance Criteria and Test Evidence

- `/initiatives` renders `InitiativesHub` and supports documented view modes.

- Route evidence: module route/view scope for `05_inicjatywy` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `05_inicjatywy` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `05_inicjatywy` user flows.

## 12. Open Risks and Change Log
- Risk: high view-mode complexity without regression automation.
- Change log: initial function contract created.
