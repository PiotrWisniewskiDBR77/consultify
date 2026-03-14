# Idea Workspace Mindmap Runtime Handoff 2026-03-14

## Scope

This handoff captures the runtime and test-environment work completed on the `Recommendation map`
surface for the canonical route:

- `/my-work/ideas/:ideaId/workspace/mindmap`

The goal of this wave was to stabilize the runtime, remove the render loop, restore starter
scaffold behavior, and verify the first-node creation contract.

## What Was Fixed

### 1. Runtime feedback loop

The loop caused by `selection -> surfaceState patch -> runtime update -> rerender` was cut by:

- removing `selectedNodeIds` from persisted `surfaceState`
- treating selection as ephemeral UI state
- adding no-op guards in `workspaceGraphRuntime.ts` so identical graph/extension payloads no longer
  queue syncs

### 2. Canonical graph vs transient UI props

Transient props were removed from canonical nodes:

- `_interactionMode`
- `_canAddSibling`

`interactionMode` now flows through React context, and sibling eligibility is derived at render
time.

### 3. Fresh-map scaffold bootstrap

Fresh maps now bootstrap into the shared runtime instead of staying empty locally:

- full starter scaffold is synthesized for empty or root-only version-1 graphs
- the scaffold is captured into runtime immediately
- autosave bounce after hydrate is suppressed

### 4. Branch interaction model

Branch interaction was cleaned up:

- single click selects the branch
- branch collapse moved away from single click
- mindmap surface now explicitly takes keyboard focus
- local key capture was added on the surface so map shortcuts do not depend on browser focus

### 5. Mock DB stability for isolated E2E

The isolated `3100/3101` environment had two blockers in the mock DB layer:

- `my_ideas` create/list did not round-trip correctly
- `my_idea_maps` filtering/versioning produced false conflicts and missing-map reads

The mock DB filter logic in `server/src/database/Database.ts` was tightened so parameterized
`WHERE id/idea_id/user_id/organization_id = ?` lookups no longer match unrelated rows.

## Verified Improvements

The following is now verified in the isolated environment:

- no `Maximum update depth exceeded`
- canonical route opens successfully
- starter scaffold renders with root + 5 branches
- branch selection works on click
- mock gateway returns stable `ideaId` for new ideas
- initial `map/sync` no longer fails with false `409 IDEA_MAP_CONFLICT`

## Remaining Blocker

The last unresolved issue is still the first-node persistence contract:

- `Tab` reaches the add-child flow
- a temporary `node-*` selection appears in logs
- but the visible canvas returns to the 6-node starter scaffold

Important evidence from the final debugging pass:

- the regression is no longer caused by runtime conflict handling
- it is not the old render loop
- it is not a simple branch-collapse-on-click issue
- repeated `GET /api/my-work/my-ideas/:id/map` calls in the isolated environment still return the
  backend default map (`root` only), not the persisted scaffold/map state
- this stale server read is still capable of reintroducing scaffold state over local graph progress

## Best Next Step For The New Agent

Start from the backend read path before touching more UI code:

1. Validate why `GET /api/my-work/my-ideas/:id/map` still returns default/root-only data in the
   mock environment after successful `POST /map/sync`.
2. Confirm whether the issue is:
   - mock DB insert/select shape for `my_idea_maps`
   - alias handling for `nodes_json as "nodesJson"` / `edges_json as "edgesJson"`
   - another read path repeatedly bypassing the just-synced record
3. Only after the backend read path is correct, re-run the canonical route check:
   - open fresh idea
   - click `branch-options`
   - press `Tab`
   - confirm visible node count grows from `6` to `7`
   - confirm node survives refresh/runtime sync

## Files Touched In This Wave

- `server/src/database/Database.ts`
- `server/src/routes/my-work.routes.ts`
- `src/components/MyWork/canvas/workspaceGraphRuntime.ts`
- `src/components/MyWork/IdeaMapWorkspace.tsx`
- `src/components/MyWork/IdeaRecommendationMap.tsx`
- `src/components/MyWork/mindmap/useMindMapPersistence.ts`
- `src/components/MyWork/mindmap/useMindMapNodes.ts`

## Notes For Commit Review

This wave is worth keeping even though the final `Tab -> first node persists` check is not yet
green, because it removed the main runtime instability and isolated the remaining defect to a much
smaller backend/read-path + persistence interaction surface.
