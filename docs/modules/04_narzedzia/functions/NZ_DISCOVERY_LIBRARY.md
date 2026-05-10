---
module_id: MODULE_TOOLS
function_id: NZ_DISCOVERY_LIBRARY
function_name: Tools — Discovery Library
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
last_updated: 2026-05-10
---

# Function Contract — Discovery Library

## 1. Function Identity
- Function ID: `NZ_DISCOVERY_LIBRARY`
- Scope: `DiscoveryToolsHub` tab `library`
- Feature state: `real`

## 2. User Job and Business Outcome
- User job: browse/select tools and assessment entries.
- Outcome: correct tool/session start from one canonical library surface.

## 3. Trigger and Entry Points
- Entry route: `/discovery-tools` (default tab/library context).

## 4. UI Component Footprint
- `DiscoveryToolsHub`, module tabs, library table/grid and preview pane.

## 5. Inputs, Data Contracts, and Dependencies
- Known tools catalog + framework metadata.
- APIs: tools/bootstrap endpoints via shared `Api`.

## 6. Outputs and Side Effects
- Selected tool context, opened previews, transitions into sessions.

## 7. Ownership and Handoff Boundaries
- Owner: tools catalog/session-intent context.
- No hidden initiative/output mutations from browse action alone.

## 8. Runtime States and UX Behavior
- Loading/empty/error/degraded/success states explicit by tab.

## 9. AI, Source, Evidence, Approval
- AI assist only via contextual controls; source tool identity preserved.

## 10. Security, Roles, and Tenancy
- Licensed/tenant-based availability and ACL constraints apply.

## 11. Acceptance Criteria and Test Evidence
- Library renders with tool + assessment catalog.
- Evidence: `DiscoveryToolsHub.tsx`, route wiring.

## 12. Open Risks and Change Log
- Risk: catalog breadth can drift without explicit category contracts.
- Change log: initial function contract created.
