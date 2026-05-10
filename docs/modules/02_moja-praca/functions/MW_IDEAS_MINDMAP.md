---
module_id: MODULE_MY_WORK
function_id: MW_IDEAS_MINDMAP
function_name: Ideas — Mindmap / Mapa rekomendacji
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Ideas / Mindmap

## 1. Function Identity

- Function ID: `MW_IDEAS_MINDMAP`
- Module: `02_moja-praca`
- Parent function: `MW_IDEAS`
- UI labels/aliases: `Mapa rekomendacji`, `Recommendation map`, `mindmap`
- Route/AppView scope: `AppView.MY_WORK`, `"/my-work/ideas/:ideaId"` (tool mode in idea workspace)
- Feature state: `real`

## 2. User Job and Business Outcome

- User job: model idea logic as nodes/relations and structure a recommendation map.
- Business outcome: better clarity of problem structure, evidence links, and conversion readiness.
- Non-goals: mindmap mode does not own downstream execution entities directly.

## 3. Trigger and Entry Points

- Entry points: `Ideas` detail workspace + tool switcher selection `mindmap`.
- Preconditions: an idea workspace is open (`ideaId` context).
- Blocking conditions: none beyond regular tenant/ACL access.

## 4. UI Component Footprint

- Top-level container/view components: `IdeaMapWorkspace`.
- Tool-specific runtime: `IdeaRecommendationMap`.
- Supporting components: `IdeaWorkspaceToolbar`, `CanvasLeftToolbar`, `AIGovernanceBadge`, `AIGovernancePanel`.
- Component ownership notes: map canvas is tool-local; toolbar/panels are shared workspace controls.

## 5. Inputs, Data Contracts, and Dependencies

- Input objects/fields: idea title, stage, graph nodes/edges, selection context, map extensions.
- Upstream modules/services: workspace graph runtime and AI proposal pipeline.
- APIs/models: idea record updates through shared API (`Api.updateMyIdea`) and graph runtime.
- Data freshness assumptions: graph state and metadata can sync asynchronously.

## 6. Outputs and Side Effects

- Produced objects/artifacts: updated map graph and selection metadata.
- Downstream handoff: explicit convert actions to tasks/decisions/initiatives/reports/presentations.
- Side effects visible to user: graph edits, stage changes, AI proposal accept/reject, focused navigation.

## 7. Ownership and Handoff Boundaries

- Canonical owner of mutated objects: idea workspace graph for the idea context.
- Handoff contract (`from -> to`): convert/export action with source trace preserved.
- Forbidden ownership: no hidden writes to canonical objects in other modules.

## 8. Runtime States and UX Behavior

- Loading: map runtime loads graph and workspace metadata.
- Empty: starter state for blank map with build guidance.
- Error: tool error boundary with retry.
- Degraded: partial AI or extension state can degrade while map remains editable.
- Success: persisted graph with clear next actions (refine/convert/share).
- Next action guidance per state: build map, review AI suggestions, convert selected structure.

## 9. AI, Source, Evidence, Approval

- AI action placement: workspace command row/Menu 3 and context panels only.
- Source/provenance visibility: node families and evidence links remain visible in map context.
- Approval/diff/review requirements: cross-module conversion requires owner-module governance.
- Audit trail/evidence: proposal acceptance/rejection and conversion events are traceable.

## 10. Security, Roles, and Tenancy

- Allowed roles: users with idea workspace access in tenant scope.
- Denied/restricted roles: ACL denied users.
- ACL/tenant scope: all graph operations stay tenant-bounded.
- Sensitive data masking/redaction: inherited from workspace/object permission policies.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks:
  - mindmap tool opens and renders recommendation map for active idea.
  - retry path exists via tool error boundary.
  - convert actions remain explicit and source-aware.
  - `src/components/MyWork/IdeaMapWorkspace.tsx`
  - `src/components/MyWork/IdeaRecommendationMap.tsx`
  - `src/components/MyWork/IdeaWorkspaceToolbar.tsx`
- Known `doc_gap`: exact map node-family governance matrix needs separate deep spec.
- Known `code_gap`: no dedicated end-to-end mindmap governance flow test linked in module docs.

- Route evidence: module route/view scope for `02_moja-praca` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `02_moja-praca` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `02_moja-praca` user flows.

## 12. Open Risks and Change Log

- Risks/assumptions: high map complexity can reduce readability without strict guidance.
- Open decisions: final default interaction mode and stage progression hints.
- Change log: initial subfunction contract created.
