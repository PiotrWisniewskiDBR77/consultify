---
module_id: MODULE_TOOLS
function_id: NZ_MEGATRENDS_WORKSPACE
function_name: Tools — Megatrends Workspace
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Megatrends Workspace

## 1. Function Identity
- Function ID: `NZ_MEGATRENDS_WORKSPACE`
- Route scope: `/discovery-tools/strategic/megatrends`
- Feature state: `real`

## 2. User Job and Business Outcome
- User job: run strategic megatrend analysis in dedicated workspace.
- Outcome: strategic context artifacts and recommendations.

## 3. Trigger and Entry Points
- Entry: canonical megatrends route from tools strategic lane.

## 4. UI Component Footprint
- `MegatrendsWorkspace` and surrounding route shell components.

## 5. Inputs, Data Contracts, and Dependencies
- Strategic trend datasets, analysis context, scenario metadata.

## 6. Outputs and Side Effects
- Megatrend insights and potential handoff to initiatives/reports.

## 7. Ownership and Handoff Boundaries
- Owns megatrend analysis context; downstream output ownership stays explicit.

## 8. Runtime States and UX Behavior
- Explicit loading/empty/error/degraded/success and next action copy.

## 9. AI, Source, Evidence, Approval
- Insight claims require source/provenance visibility.

## 10. Security, Roles, and Tenancy
- Tenant-scoped strategic data and access controls.

## 11. Acceptance Criteria and Test Evidence
- Canonical megatrends route renders workspace and preserves tools context.
- Evidence: `AppRoutes.tsx`, `MegatrendsWorkspace.tsx`.

## 12. Open Risks and Change Log
- Risk: strategic outputs may look final without explicit review cues.
- Change log: initial function contract created.
