---
module_id: MODULE_EXECUTION
function_id: RL_EXECUTION_REPORTS
function_name: Execution — Reports
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Execution Reports

## 1. Function Identity
- Function ID: `RL_EXECUTION_REPORTS`
- Runtime anchor: `ExecutionHub` tab `reports`
- Feature state: `real`

## 2. User Job and Business Outcome
- Purpose: generate/inspect execution reporting catalog and outputs.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI footprint follows the mounted runtime anchor and standard module layout components.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: report definitions, execution metrics, degraded flags, data quality context.
- Risk: output trust can degrade if data quality warnings are ignored.

## 6. Outputs and Side Effects
- Outputs: report generation actions, Wordy handoff, export actions.

## 7. Ownership and Handoff Boundaries
- Boundaries: reporting is explicit and governed; no silent finalization.

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

## 9. AI, Source, Evidence, Approval
- Security/provenance: report source task/signal lineage required.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks: section maintained; explicit evidence mapping required for gate compliance.

- Route evidence: module route/view scope for `06_realizacja` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `06_realizacja` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `06_realizacja` user flows.

## 12. Open Risks and Change Log
- Risk: output trust can degrade if data quality warnings are ignored.
