---
module_id: MODULE_MCP_MARKETPLACE
function_id: MCPM_RUNTIME_TARGET
function_name: MCP Marketplace — Runtime Target
doc_kind: FUNCTION_CONTRACT
status: draft
owner: user
last_updated: 2026-05-10
---

# Function Contract — Marketplace Runtime Target

## 1. Function Identity
- Function ID: `MCPM_RUNTIME_TARGET`
- Intended runtime anchor: marketplace catalog/review/install panel
- Current mounted status: `partial` (planned, no dedicated mounted runtime component)

## 2. User Job and Business Outcome
- Purpose: preserve target contract for governed catalog discovery and install workflow.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI footprint follows the mounted runtime anchor and standard module layout components.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: provider catalog metadata, permission scopes, listing recommendations.

## 6. Outputs and Side Effects
- Outputs: explicit reviewed installation/configuration actions with audit.

## 7. Ownership and Handoff Boundaries
- Ownership and handoff boundaries remain explicit and do not bypass canonical owner modules.

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

## 9. AI, Source, Evidence, Approval
- Security: tenant/ACL + approval gates for high-impact install actions.
- Risk: hidden mutation risk if future install actions bypass review/audit.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence
- Evidence: codemap confirms no dedicated mounted marketplace runtime.

## 12. Open Risks and Change Log
- Risk: hidden mutation risk if future install actions bypass review/audit.
