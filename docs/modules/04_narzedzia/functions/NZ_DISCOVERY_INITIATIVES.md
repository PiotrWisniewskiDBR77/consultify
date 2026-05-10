---
module_id: MODULE_TOOLS
function_id: NZ_DISCOVERY_INITIATIVES
function_name: Tools — Initiatives Handoff
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Discovery Initiatives

## 1. Function Identity
- Function ID: `NZ_DISCOVERY_INITIATIVES`
- Scope: `DiscoveryToolsHub` tab `initiatives`
- Feature state: `real`

## 2. User Job and Business Outcome
- User job: review initiatives derived from tools/assessment context.
- Outcome: traceable transition from analysis to initiative pipeline.

## 3. Trigger and Entry Points
- Entry: tab `initiatives` in tools hub.

## 4. UI Component Footprint
- `DiscoveryToolsHub` initiatives table and preview actions.

## 5. Inputs, Data Contracts, and Dependencies
- Initiative rows filtered by tools/assessment-derived source types.
- APIs: initiatives listing and status transitions.

## 6. Outputs and Side Effects
- Explicit route to initiative owner modules and updates.

## 7. Ownership and Handoff Boundaries
- Tools module does not own initiative lifecycle canon.
- Handoff-only responsibility with source traceability.

## 8. Runtime States and UX Behavior
- Explicit loading/empty/error/degraded/success.

## 9. AI, Source, Evidence, Approval
- Handoffs require explicit user action; source lineage preserved.

## 10. Security, Roles, and Tenancy
- Initiative visibility and mutation scope by ACL/tenant controls.

## 11. Acceptance Criteria and Test Evidence
- Initiatives tab shows only traceable tool/assessment-derived items.
- Evidence: `DiscoveryToolsHub.tsx`, initiative lifecycle helpers.

## 12. Open Risks and Change Log
- Risk: source-type mapping drift can pollute initiative list.
- Change log: initial function contract created.
