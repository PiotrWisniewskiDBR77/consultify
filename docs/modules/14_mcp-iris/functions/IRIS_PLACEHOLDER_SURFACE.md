---
module_id: MODULE_MCP_IRIS
function_id: IRIS_PLACEHOLDER_SURFACE
function_name: MCP IRIS — Placeholder Surface
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
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

- Acceptance checks: section maintained; explicit evidence mapping required for gate compliance.

- Route evidence: module route/view scope for `14_mcp-iris` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `14_mcp-iris` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `14_mcp-iris` user flows.

## 12. Open Risks and Change Log
- Risk: perceived availability of MCP execution when only placeholder exists.
