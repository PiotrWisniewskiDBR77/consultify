---
module_id: MODULE_TOOLS
function_id: NZ_DISCOVERY_SESSIONS
function_name: Tools — Discovery Sessions
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Discovery Sessions

## 1. Function Identity
- Function ID: `NZ_DISCOVERY_SESSIONS`
- Scope: `DiscoveryToolsHub` tab `sessions`
- Feature state: `real`

## 2. User Job and Business Outcome
- User job: continue and manage tool/assessment sessions.
- Outcome: reusable session flow with status/filters and preview.

## 3. Trigger and Entry Points
- Entry: Tools hub tab `sessions`.

## 4. UI Component Footprint
- `DiscoveryToolsHub` session table/grid, status/view controls, preview panel.

## 5. Inputs, Data Contracts, and Dependencies
- Discovery sessions + assessment sessions dataset.
- APIs for sessions and status metadata.

## 6. Outputs and Side Effects
- Open session details, status updates, handoff readiness.

## 7. Ownership and Handoff Boundaries
- Owner: tool/assessment session records.

## 8. Runtime States and UX Behavior
- Explicit loading/empty/error/degraded/success.

## 9. AI, Source, Evidence, Approval
- Session outputs must keep source tool and context traceability.

## 10. Security, Roles, and Tenancy
- Tenant/license scope applied to session visibility and actions.

## 11. Acceptance Criteria and Test Evidence
- Sessions tab renders combined discovery + assessment sessions.
- Evidence: `DiscoveryToolsHub.tsx`.

## 12. Open Risks and Change Log
- Risk: mixed session types may blur ownership if labels drift.
- Change log: initial function contract created.
