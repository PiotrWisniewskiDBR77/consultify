---
module_id: MODULE_MCP_IRIS
function_id: IRIS_PLACEHOLDER_SURFACE
function_name: MCP IRIS — Placeholder Surface
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — MCP IRIS Placeholder Surface

## 1. Function Identity
- Function ID: `IRIS_PLACEHOLDER_SURFACE`
- Route: `/mcp/iris`
- Runtime anchor: `V4ComingSoonView`
- Feature state: `stub`

## 2. User Job and Business Outcome
- Purpose: expose coming-soon state for MCP IRIS integration lane.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI footprint follows the mounted runtime anchor and standard module layout components.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: route entry context only.

## 6. Outputs and Side Effects
- Outputs: explicit non-ready messaging and no hidden execution path.

## 7. Ownership and Handoff Boundaries
- Ownership and handoff boundaries remain explicit and do not bypass canonical owner modules.

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

## 9. AI, Source, Evidence, Approval
- AI actions, source visibility, and approval expectations follow Menu 3 placement and auditable review rules.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence
- Evidence: `AppRoutes.tsx` -> `ROUTES.MCP_IRIS` placeholder mapping.

## 12. Open Risks and Change Log
- Risk: perceived availability of MCP execution when only placeholder exists.
