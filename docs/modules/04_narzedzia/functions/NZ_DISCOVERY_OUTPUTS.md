---
module_id: MODULE_TOOLS
function_id: NZ_DISCOVERY_OUTPUTS
function_name: Tools — Reports and Presentations Outputs
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Discovery Outputs

## 1. Function Identity
- Function ID: `NZ_DISCOVERY_OUTPUTS`
- Scope: `DiscoveryToolsHub` tab `outputs` (`reports` alias handling)
- Feature state: `real`

## 2. User Job and Business Outcome
- User job: review generated reports/decks from tools/assessments.
- Outcome: output traceability and easy transition to output owners.

## 3. Trigger and Entry Points
- Entry: Tools hub tab `outputs`.

## 4. UI Component Footprint
- `DiscoveryToolsHub` outputs table/preview and navigation actions.

## 5. Inputs, Data Contracts, and Dependencies
- Assessment reports, report builder outputs, deck outputs merged in one surface.

## 6. Outputs and Side Effects
- Route handoffs to report/deck owner surfaces.

## 7. Ownership and Handoff Boundaries
- Tools lists outputs; canonical editing remains in owning modules.

## 8. Runtime States and UX Behavior
- Explicit loading/empty/error/degraded/success and next actions.

## 9. AI, Source, Evidence, Approval
- Output entries must show source context and trust/provenance cues.

## 10. Security, Roles, and Tenancy
- Output visibility follows tenant/object ACL.

## 11. Acceptance Criteria and Test Evidence

- Outputs tab renders merged output set with type labels.

- Route evidence: module route/view scope for `04_narzedzia` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `04_narzedzia` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `04_narzedzia` user flows.

## 12. Open Risks and Change Log
- Risk: mixed output kinds can hide provenance without strict labeling.
- Change log: initial function contract created.
