---
module_id: MODULE_MCP_IRIS
function_id: IRIS_RUNTIME_TARGET
function_name: MCP IRIS — Runtime Target
doc_kind: FUNCTION_CONTRACT
status: draft
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — MCP IRIS Runtime Target

## 1. Function Identity
- Function ID: `IRIS_RUNTIME_TARGET`
- Intended runtime anchor: MCP IRIS execution/control panel
- Current mounted status: `partial` (planned, no dedicated route-mounted runtime component)

## 2. User Job and Business Outcome
- Purpose: preserve target contract for authenticated, audited MCP tool execution.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI footprint follows the mounted runtime anchor and standard module layout components.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: connector config, allowlisted tool selection, execution request payloads (target-state).
- Outputs: explicit reviewed executions with audit/provenance metadata (target-state).

## 6. Outputs and Side Effects
- Outputs and side effects are explicit user-driven actions; no hidden mutations are implied.

## 7. Ownership and Handoff Boundaries
- Ownership and handoff boundaries remain explicit and do not bypass canonical owner modules.

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

## 9. AI, Source, Evidence, Approval
- AI actions, source visibility, and approval expectations follow Menu 3 placement and auditable review rules.

## 10. Security, Roles, and Tenancy
- Security: admin/policy gating and deny-by-default enforcement required.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks: section maintained; explicit evidence mapping required for gate compliance.

- Route evidence: module route/view scope for `14_mcp-iris` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `14_mcp-iris` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `14_mcp-iris` user flows.

## 12. Open Risks and Change Log
- Risk: any future runtime can drift into unsafe hidden execution patterns.
