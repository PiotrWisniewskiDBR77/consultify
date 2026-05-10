---
module_id: MODULE_MY_WORK
function_id: MW_IDEAS
function_name: Ideas / Pomysly
doc_kind: FUNCTION_CONTRACT
status: active
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Ideas / Pomysly

## 1. Function Identity

- Function ID: `MW_IDEAS`
- Module: `02_moja-praca`
- UI labels/aliases: `Pomysly`, `Ideas`
- Route/AppView scope: `AppView.MY_WORK`, `"/my-work/ideas"`, `"/my-work/ideas/:ideaId"`
- Feature state: `real`

## 2. User Job and Business Outcome

- User job: capture, refine, and operationalize ideas.
- Business outcome: convert early thinking into actionable items (task/decision/initiative/report).
- Non-goals: no hidden conversion without explicit user action.

## 3. Trigger and Entry Points

- Entry points: Ideas tab, deep links (`ideaId` query/path), open-document events.
- Preconditions: My Work access; idea context selected for detailed workspace.
- Blocking conditions: pilot/feature constraints can reroute user to safe tab.

## 4. UI Component Footprint

- Top-level container/view components: `MyWorkHub`.
- List/workspace components: `MyIdeasListContent`, `IdeaMapWorkspace`.
- Command-row components: `WorkspacePanelStrip`, ideas view-mode toggle (`table`/`grid`).
- Tool-switching components inside workspace: `IdeaWorkspaceToolbar` with 4 systems (`mindmap`, `table`, `process_flow`, `whiteboard`).
- Component ownership notes: idea workspace components are module-local; shell controls are shared in hub.

### 4A. Subfunctions (separate contracts)

- `MW_IDEAS_MINDMAP` -> `MW_IDEAS_MINDMAP.md`
- `MW_IDEAS_TABLE` -> `MW_IDEAS_TABLE.md`
- `MW_IDEAS_PROCESS_FLOW` -> `MW_IDEAS_PROCESS_FLOW.md`
- `MW_IDEAS_WHITEBOARD` -> `MW_IDEAS_WHITEBOARD.md`

## 5. Inputs, Data Contracts, and Dependencies

- Input objects/fields: idea record, workspace state (tool/panel/selection), search and stage filter.
- Upstream modules/services: event bus intents and artifact routing.
- APIs/models: shared API in `src/services/api.ts`; workspace/entity types in My Work types.
- Data freshness assumptions: list and open-document state can be refreshed independently.

## 6. Outputs and Side Effects

- Produced objects/artifacts: updated idea state, linked artifacts, conversion intents.
- Downstream handoff: to Tasks/Decisions/Initiatives/Outputs via explicit action.
- Side effects visible to user: new idea creation, opened idea workspace, panel/tool state changes.

## 7. Ownership and Handoff Boundaries

- Canonical owner of mutated objects: idea/workspace records in My Work domain.
- Handoff contract (`from -> to`): explicit conversion action with source context preserved.
- Forbidden ownership: must not silently mutate canonical records in other module domains.

## 8. Runtime States and UX Behavior

- Loading: list/workspace lazy-loading with fallback UI.
- Empty: no-ideas state with creation CTA.
- Error: failed operations show safe messaging and retry path.
- Degraded: partial workspace tools can be unavailable without blocking list access.
- Success: save/create actions confirm and preserve active context.
- Next action guidance per state: create idea, open existing idea, convert to concrete downstream work.

## 9. AI, Source, Evidence, Approval

- AI action placement: Menu 3/right command-row; workspace AI context button in idea detail mode.
- Source/provenance visibility: conversions preserve origin idea context.
- Approval/diff/review requirements: cross-module high-impact writes require owner-module review.
- Audit trail/evidence: conversion event and resulting artifact linkage.

## 10. Security, Roles, and Tenancy

- Allowed roles: users with My Work access.
- Denied/restricted roles: denied by ACL at tenant/user scope.
- ACL/tenant scope: tenant-isolated idea data.
- Sensitive data masking/redaction: inherited from global policy and source object ACL.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks:
  - Ideas list opens in `"/my-work/ideas"` and supports table/grid view.
  - Idea detail opens in workspace mode with tool/panel control.
  - Conversion actions remain explicit and source-aware.
  - `src/components/MyWork/MyWorkHub.tsx`
  - `src/components/MyWork/MyIdeasListContent.tsx`
  - `src/components/MyWork/IdeaMapWorkspace.tsx`
  - `src/components/MyWork/IdeaWorkspaceToolbar.tsx`
- Known `doc_gap`: per-tool behavior matrix is not fully decomposed in docs.
- Known `code_gap`: no dedicated end-to-end test for full idea conversion chain.

- Route evidence: module route/view scope for `02_moja-praca` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `02_moja-praca` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `02_moja-praca` user flows.

## 12. Open Risks and Change Log

- Risks/assumptions: complex workspace state can drift from list state on heavy usage.
- Open decisions: finalize canonical naming of ideas tool families in docs.
- Change log: initial function contract created.
