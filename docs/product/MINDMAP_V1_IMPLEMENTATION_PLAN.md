# Mindmap V1 Implementation Plan

> **Status:** WORKING DELIVERY PLAN
> **Date:** 2026-03-12
> **Owner:** Product / Platform / CTO
> **Scope:** `My Work -> Idea Workspace -> Mind Map system`
> **Purpose:** turn `docs/product/MINDMAP_V1_SSOT.md` into an implementation sequence with concrete delivery streams, file anchors, QA gates, and acceptance criteria.

> This document is an implementation plan, not the product SSOT.
> Product truth remains in `docs/product/MINDMAP_V1_SSOT.md`.

---

## 0) References

Canonical product truth:
- `docs/product/MINDMAP_V1_SSOT.md`
- `docs/product/IDEA_WORKSPACE_V5_SSOT.md`
- `docs/product/ARTIFACT_LINKING_V5_SSOT.md`
- `docs/product/MINDMAP_COMPLETION_FINDINGS_2026-03-12.md`

Likely implementation anchors:
- `src/components/MyWork/IdeaMapWorkspace.tsx`
- `src/components/MyWork/IdeaRecommendationMap.tsx`
- `src/components/MyWork/mindmap/useMindMapNodes.ts`
- `src/components/MyWork/mindmap/useMindMapQuickActions.ts`
- `src/components/MyWork/mindmap/CanvasLeftToolbar.tsx`
- `src/components/MyWork/mindmap/FloatingNodeToolbar.tsx`
- `src/components/MyWork/mindmap/NodeContextMenu.tsx`
- `src/components/MyWork/mindmap/PaneContextMenu.tsx`
- `src/components/MyWork/mindmap/EdgeContextMenu.tsx`
- `src/components/MyWork/IdeaWorkspaceTools.tsx`
- `src/components/MyWork/IdeaNodeDetailDrawer.tsx`
- `src/components/MyWork/mindmap/NodeDetailDrawer.tsx`

---

## 1) Executive summary

The implementation goal is not to add more disconnected mindmap features.

The goal is to turn the existing engine into a coherent mindmap product by delivering:
- direct node growth through inline plus controls
- real interaction states
- semantic node properties with artifact grounding
- contextual AI expansion
- a proper mindmap inspector inside the existing `Tools` panel
- calmer, more consistent menu grammar

---

## 2) Delivery principles

- Ship the primary growth gesture first.
- Prefer direct manipulation over menu-first flows.
- Keep all new mindmap controls inside existing workspace architecture.
- Do not add a new right-side strip.
- Reuse existing drawers, quick actions, and persistence where possible.
- Extend existing primitives before inventing new systems.

---

## 3) Workstreams

## Stream A: Interaction Model

Goal:
- make `Select`, `Pan`, and optional `Connect` real first-class states

Primary files:
- `src/components/MyWork/IdeaRecommendationMap.tsx`
- `src/components/MyWork/mindmap/useMindMapQuickActions.ts`
- `src/components/MyWork/mindmap/CanvasLeftToolbar.tsx`

Deliverables:
- explicit interaction state model
- visible active state in toolbar and canvas
- no toast-only mode switching
- predictable behavior for click, drag, pan, and connect

Acceptance:
- switching mode changes actual canvas behavior
- user can tell current mode without guessing

## Stream B: Direct Node Growth

Goal:
- make branch creation happen on the selected node itself

Primary files:
- `src/components/MyWork/IdeaRecommendationMap.tsx`
- `src/components/MyWork/mindmap/useMindMapNodes.ts`

Deliverables:
- inline plus affordance on selected node
- primary child-add gesture
- secondary sibling-add gesture where relevant
- immediate text edit on created node

Acceptance:
- user can create `node -> child -> sub-child` without opening a menu
- newly created node gets focus immediately

## Stream C: Connection UX

Goal:
- make line / connection creation obvious and distinct from tree growth

Primary files:
- `src/components/MyWork/IdeaRecommendationMap.tsx`
- `src/components/MyWork/mindmap/EdgeContextMenu.tsx`
- `src/components/MyWork/mindmap/CanvasLeftToolbar.tsx`

Deliverables:
- one clear connection creation model
- visible handles or connect mode with real state
- understandable edge editing flow
- better separation between tree branch creation and cross-link creation

Acceptance:
- user can create non-tree connection intentionally
- user does not confuse branch growth with generic graph linking

## Stream D: Node Properties and Semantic Layer

Goal:
- turn node properties into the semantic control center

Primary files:
- `src/components/MyWork/IdeaNodeDetailDrawer.tsx`
- `src/components/MyWork/mindmap/NodeDetailDrawer.tsx`
- `src/components/MyWork/IdeaRecommendationMap.tsx`

Deliverables:
- clear node-properties entry
- linked internal artifact authoring
- first-class tags
- semantic type clarity
- visible relationship between tags, color, and meaning

Acceptance:
- user can open node properties quickly
- user can attach internal artifacts from that flow
- user understands that tags and color define meaning

## Stream E: Quick Node Utilities

Goal:
- avoid forcing the user into the full drawer for small actions

Primary files:
- `src/components/MyWork/IdeaRecommendationMap.tsx`
- `src/components/MyWork/mindmap/NodeContextMenu.tsx`
- optional new popover components under `src/components/MyWork/mindmap/`

Deliverables:
- lightweight notes popup
- lightweight tags popup
- lightweight link popup
- lightweight task popup or clearly defined node-to-task micro-flow

Acceptance:
- small edits happen inline or near-inline
- drawer remains for depth, not for every tiny action

## Stream F: Mindmap Inspector Inside Tools

Goal:
- expose `Style / Layout / Theme` in the existing `Tools` panel

Primary files:
- `src/components/MyWork/IdeaWorkspaceTools.tsx`
- possible new mindmap inspector components under `src/components/MyWork/mindmap/`
- `src/components/MyWork/IdeaMapWorkspace.tsx`

Deliverables:
- inspector tabs:
  - Style
  - Layout
  - Theme
- selection-aware controls
- map-wide controls where appropriate
- no architecture break of the `Tools | Context | AI Suggestions` strip

Acceptance:
- user can find styling without hunting through multiple menus
- inspector feels native to the workspace, not bolted on

## Stream G: Menu Grammar Unification

Goal:
- make node, edge, and object menus feel like one product language

Primary files:
- `src/components/MyWork/mindmap/NodeContextMenu.tsx`
- `src/components/MyWork/mindmap/EdgeContextMenu.tsx`
- whiteboard object menu surfaces

Deliverables:
- shared base action set
- type-specific deltas only where necessary
- calmer pane background menu

Acceptance:
- users recognize menu structure across object types
- common actions stay in predictable places

## Stream H: AI Contextual Expansion

Goal:
- make AI branch growth semantic and grounded

Primary files:
- `src/components/MyWork/IdeaMapWorkspace.tsx`
- `src/components/MyWork/IdeaAISuggestionsPanel.tsx`
- `src/components/MyWork/IdeaRecommendationMap.tsx`
- server-side idea / AI handlers as needed

Deliverables:
- node-aware AI prompts
- branch-aware AI prompts
- use tags, semantic type, linked artifacts, and nearby context as grounding inputs
- better distinction between:
  - blank-canvas build
  - expand selected node
  - gap analysis

Acceptance:
- AI suggestions clearly reflect local node semantics
- AI does not feel generic when expanding a tagged node

## Stream I: Stability and Persistence

Goal:
- preserve trust while interaction complexity increases

Primary files:
- `src/components/MyWork/mindmap/useMindMapPersistence.ts`
- `src/components/MyWork/IdeaRecommendationMap.tsx`

Deliverables:
- safe autosave after new creation flows
- stable restore with new node metadata
- no remount / reset regressions

Acceptance:
- no data loss during normal editing
- node growth + metadata flows persist reliably

---

## 4) Recommended implementation order

## Phase 1: Foundations

1. Stream A: Interaction Model
2. Stream B: Direct Node Growth
3. Stream C: Connection UX

Why first:
- this defines the core creation gesture
- without this, the map still feels menu-driven

## Phase 2: Semantic Node System

4. Stream D: Node Properties and Semantic Layer
5. Stream E: Quick Node Utilities
6. Stream H: AI Contextual Expansion

Why second:
- once growth is fast, meaning must become structured
- this is where artifact grounding and semantic AI start paying off

## Phase 3: Product Surface Coherence

7. Stream F: Mindmap Inspector Inside Tools
8. Stream G: Menu Grammar Unification

Why third:
- after the interaction engine is right, product surfaces can be cleaned up coherently

## Phase 4: Hardening

9. Stream I: Stability and Persistence

Why last:
- stability needs to verify the final shape of the interactions

---

## 5) Concrete backlog by feature

## 5.1 Inline plus controls

Tasks:
- define where plus appears on selected node
- define child vs sibling affordance
- define hover / selected / touch behavior
- ensure immediate edit mode on create
- ensure behavior works with auto layout

## 5.2 Real connect behavior

Tasks:
- choose final connection model
- clarify handles vs connect mode
- remove toast-only semantics
- refine edge creation affordance
- refine edge edit / delete / reverse flows

## 5.3 Node properties

Tasks:
- normalize node property contract
- define canonical fields
- ensure artifact linking is reachable from the node
- define tag -> color semantics
- define AI grounding fields

## 5.4 Quick node popovers

Tasks:
- notes popover
- tags popover
- link popover
- task micro-flow

## 5.5 Mindmap inspector

Tasks:
- design `Style` tab
- design `Layout` tab
- design `Theme` tab
- map each control to existing data model or add required model support

## 5.6 AI branch growth

Tasks:
- define prompt contracts for node expansion
- include tags and artifacts in grounding
- support branch-local gap analysis
- keep propose / accept semantics for meaningful insertions

---

## 6) Data/model updates likely required

Likely node fields to normalize or strengthen:
- `label`
- `notes`
- `tags`
- `semanticType`
- `artifactLinks`
- `color`
- `branchTheme`
- `shape`
- `fontSize`
- `bold`
- optional tag-derived semantic color token

Likely derived semantics to add:
- `semanticColor`
- `aiContextSummary`
- `tagGroups` or canonical normalized tags

Rule:
- styling data and semantic data must not become incoherent duplicates

---

## 7) QA gates

## Gate 1: Core gesture

Verify:
- create child from node-adjacent plus
- create deeper child from new node
- create sibling where allowed
- immediate edit after creation

## Gate 2: Connection logic

Verify:
- create cross-link intentionally
- edge editing remains understandable
- edge deletion does not break tree flows

## Gate 3: Semantic layer

Verify:
- tags persist
- artifact links persist
- tag-color relation is visible
- node properties reopen with correct state

## Gate 4: AI grounding

Verify:
- expansion of tagged node is context-aware
- linked artifacts influence AI suggestions
- generic output rate is lower than before

## Gate 5: Stability

Verify:
- reload restores new nodes and metadata
- autosave works during rapid branch growth
- no accidental remounts on common interactions

---

## 8) Completion criteria

The implementation is successful when:
- the main branch-growth gesture happens directly on the node
- menus become secondary instead of primary
- node properties define meaning, not just decoration
- AI uses node semantics and linked artifacts when expanding
- styling and layout become discoverable inside the existing `Tools` panel
- the product feels like one coherent mindmap app, not a bundle of partial features

---

## 9) Explicitly deferred

- device-import parity
- reminder sync
- plugin-like extensions
- deep export permutations
- advanced collaboration parity
