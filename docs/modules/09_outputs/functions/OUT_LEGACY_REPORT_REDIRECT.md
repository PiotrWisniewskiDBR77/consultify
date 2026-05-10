---
module_id: MODULE_OUTPUTS
function_id: OUT_LEGACY_REPORT_REDIRECT
function_name: Outputs — Legacy Reports Redirect Bridge
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Legacy Reports Redirect Bridge

## 1. Function Identity
- Function ID: `OUT_LEGACY_REPORT_REDIRECT`
- Routes: `/reports`, `/reports/management`
- Runtime anchor: redirect to `/presentations?tab=documents`
- Feature state: `partial` (migration bridge)

## 2. User Job and Business Outcome
- Purpose: preserve legacy entry points while enforcing outputs lane ownership.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI footprint follows the mounted runtime anchor and standard module layout components.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: legacy route access.

## 6. Outputs and Side Effects
- Outputs: deterministic redirect into canonical outputs tab.

## 7. Ownership and Handoff Boundaries
- Ownership and handoff boundaries remain explicit and do not bypass canonical owner modules.

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

## 9. AI, Source, Evidence, Approval
- AI actions, source visibility, and approval expectations follow Menu 3 placement and auditable review rules.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence
- Evidence: `AppRoutes.tsx` redirect mappings.

## 12. Open Risks and Change Log
- Risk: duplicate-lane confusion until migration bridge is removed.
