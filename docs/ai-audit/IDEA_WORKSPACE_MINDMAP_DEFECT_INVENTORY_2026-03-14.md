# Idea Workspace / Mindmap Defect Inventory

**Date:** 2026-03-14  
**Scope:** active `Idea Workspace` path with emphasis on `Mindmap`  
**Severity:** `P0` blocker, `P1` major, `P2` secondary

## P0

### IW-001 — Active Mindmap path uses unsafe save semantics

**Severity:** `P0`

**Area:** persistence / trust

**Symptoms:**
- edits can be silently overwritten
- artifact-link updates can race with graph edits
- map trust differs by tool

**Root cause:**
- `Mindmap` autosaves through `PUT /map`
- conflict-aware `/map/sync` exists but is not used on this path

**Primary files:**
- `src/components/MyWork/mindmap/useMindMapPersistence.ts`
- `src/services/api.ts`
- `server/src/routes/my-work.routes.ts`

### IW-002 — Tree logic and cross-link logic share one edge model

**Severity:** `P0`

**Area:** graph integrity

**Symptoms:**
- sibling/parent resolution can break after normal connect actions
- collapse/drill-down can operate on wrong subtree
- keyboard navigation can become inconsistent

**Root cause:**
- tree helpers assume one parent
- runtime allows arbitrary edges, edge reversal, and additional inbound edges

**Primary files:**
- `src/components/MyWork/mindmap/useMindMapNodes.ts`
- `src/components/MyWork/IdeaRecommendationMap.tsx`

### IW-003 — “Add root” is semantically misleading

**Severity:** `P0`

**Area:** mindmap authoring

**Symptoms:**
- user chooses “New root topic”
- runtime creates disconnected orphan node
- map structure degrades immediately

**Root cause:**
- UI label promises structure
- implementation drops a free node with no structural relation

**Primary files:**
- `src/components/MyWork/mindmap/toolbar-popovers/AddNodePopover.tsx`
- `src/components/MyWork/mindmap/useMindMapQuickActions.ts`

### IW-004 — Empty or cancelled inline creation still mutates the map

**Severity:** `P0`

**Area:** editing trust

**Symptoms:**
- accidental add actions pollute the graph
- aborted edits become fallback-labeled nodes instead of rollback

**Root cause:**
- node is committed before edit is validated
- cancel/empty path does not remove tentative node

**Primary files:**
- `src/components/MyWork/mindmap/useMindMapNodes.ts`
- `src/components/MyWork/IdeaRecommendationMap.tsx`

### IW-005 — Shadow graph state in workspace can drift from live tool state

**Severity:** `P0`

**Area:** architecture / integration

**Symptoms:**
- shell panels and AI may read stale graph state
- unmount save and extension persistence can write partial truth
- tool-specific metadata can be lost

**Root cause:**
- workspace keeps `graphNodes/graphEdges/mapExtensions`
- mindmap keeps separate local `nodes/edges`
- shell performs partial saves on its own

**Primary files:**
- `src/components/MyWork/IdeaMapWorkspace.tsx`
- `src/components/MyWork/IdeaRecommendationMap.tsx`

## P1

### IW-010 — Idea nodes feel inactive unless the user already understands the mode model

**Severity:** `P1`

**Area:** mindmap interaction

**Symptoms:**
- single click on idea node feels passive
- connect handles are hidden outside connect mode
- add affordances require prior selection

**Root cause:**
- low discoverability combined with mode-gated affordances

**Primary files:**
- `src/components/MyWork/IdeaRecommendationMap.tsx`
- `src/components/MyWork/mindmap/CanvasLeftToolbar.tsx`

### IW-011 — AI governance is inconsistent by entry point

**Severity:** `P1`

**Area:** AI trust

**Symptoms:**
- some AI changes are reviewed through proposal overlay
- other AI suggestions insert directly into workspace

**Root cause:**
- governed and unguided AI flows coexist in the same module

**Primary files:**
- `src/components/MyWork/IdeaMapWorkspace.tsx`
- `src/components/MyWork/IdeaAISuggestionsPanel.tsx`
- `src/components/MyWork/IdeaRecommendationMap.tsx`

### IW-012 — Artifact linking uses two conflicting truth models

**Severity:** `P1`

**Area:** artifact linking

**Symptoms:**
- some links are persisted through API + `LinkGraph`
- other links are local node mutations only
- remove/open behavior is inconsistent

**Root cause:**
- node-local artifact linking and API-backed object attachment are not unified

**Primary files:**
- `src/components/MyWork/IdeaRecommendationMap.tsx`
- `src/components/MyWork/IdeaMapWorkspace.tsx`
- `src/components/MyWork/IdeaContextPanel.tsx`
- `server/src/routes/my-work.routes.ts`

### IW-013 — `Context / Links` is semantically overloaded

**Severity:** `P1`

**Area:** shell compliance

**Symptoms:**
- context panel mixes backlinks, artifact links, canvas inserts, notes/evidence authoring, and node properties

**Root cause:**
- one panel is serving both “links/context” and secondary editing responsibilities

**Primary files:**
- `src/components/MyWork/IdeaContextPanel.tsx`
- `docs/ui-standards/02-components/workspace-3-tools-strip.md`

### IW-014 — `extensions` are vulnerable to partial overwrite

**Severity:** `P1`

**Area:** persistence integrity

**Symptoms:**
- surface state can overwrite tool-specific metadata
- nested extension buckets are not safely merged

**Root cause:**
- shallow merge on backend
- partial `extensions` writes in workspace shell

**Primary files:**
- `src/components/MyWork/IdeaMapWorkspace.tsx`
- `server/src/routes/my-work.routes.ts`

### IW-015 — Shared Canvas OS is still scaffold-level

**Severity:** `P1`

**Area:** module architecture

**Symptoms:**
- shell suggests one integrated SuperCanvas
- runtime still behaves as active-tool switching with event-based interop

**Root cause:**
- shared persistence envelope exists
- shared semantic runtime model does not

**Primary files:**
- `src/components/MyWork/IdeaMapWorkspace.tsx`
- `src/components/MyWork/canvas/useIdeaMapSync.ts`
- `server/src/validators/ideaWorkspaceGraph.validators.ts`

## P2

### IW-020 — Selection parity across tools is incomplete

**Severity:** `P2`

**Area:** cross-canvas integration

**Symptoms:**
- `node` and `row` are surfaced
- edge/lane parity is weak or absent in shared strip workflows

**Primary files:**
- `src/components/MyWork/ideaSelectionTypes.ts`
- `src/components/MyWork/IdeaRecommendationMap.tsx`
- `src/components/MyWork/IdeaProcessFlowTool.tsx`
- `src/components/MyWork/IdeaTableTool.tsx`

### IW-021 — Insert/transform parity is incomplete across target canvases

**Severity:** `P2`

**Area:** cross-canvas integration

**Symptoms:**
- insert event is consumed by mindmap, whiteboard, process flow
- table parity is missing

**Primary files:**
- `src/components/MyWork/IdeaMapWorkspace.tsx`
- `src/components/MyWork/IdeaRecommendationMap.tsx`
- `src/components/MyWork/IdeaWhiteboardTool.tsx`
- `src/components/MyWork/IdeaProcessFlowTool.tsx`
- `src/components/MyWork/IdeaTableTool.tsx`

### IW-022 — Refresh parity is inconsistent after shell-level graph updates

**Severity:** `P2`

**Area:** runtime consistency

**Symptoms:**
- process flow listens explicitly to `idea-workspace-graph-update`
- parity across other tools is weaker

**Primary files:**
- `src/components/MyWork/IdeaMapWorkspace.tsx`
- `src/components/MyWork/IdeaProcessFlowTool.tsx`
- `src/components/MyWork/IdeaWhiteboardTool.tsx`
- `src/components/MyWork/IdeaTableTool.tsx`

## Summary

Most important takeaway:

- the biggest blockers are not visual polish bugs
- they are graph-authority, persistence, and contract-coherence problems

That means the repair plan should start from:
1. graph authority and safe sync
2. Mindmap P0 recovery
3. artifact-link truth unification
4. cross-canvas parity
