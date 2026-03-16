# Mindmap Module — Development Status

> **Date:** 2026-03-15
> **Status:** V1 COMPLETE + V2 AUTOMATION FEATURES IN PROGRESS
> **SSOT:** `docs/product/MINDMAP_V1_SSOT.md`
> **Implementation Plan:** `docs/product/MINDMAP_V1_IMPLEMENTATION_PLAN.md`

---

## 1) V1 Core — COMPLETE

All V1 requirements from SSOT are implemented and verified on Railway.

### 1.1 Graph & Persistence (MM-01, MM-02, MM-03)

| Feature | Status | Files |
|---------|--------|-------|
| Authoritative graph owner (ReactFlow as SSOT) | DONE | `IdeaRecommendationMap.tsx` |
| Conflict-safe persistence (POST /map/sync + baseVersion + 409) | DONE | `useMindMapPersistence.ts` |
| Deep-merge extensions (recursive, no clobber) | DONE | `workspaceGraphRuntime.ts` |
| Viewport persistence & restore | DONE | `useMindMapPersistence.ts`, `IdeaMapWorkspace.tsx` |
| Autosave debounce (60s server, 800ms draft, Ctrl+S manual) | DONE | `useIdeaMapSync.ts` |
| Transient field stripping (selected, dragging, _startEditing) | DONE | `useMindMapPersistence.ts` |
| Viewport changes don't trigger saves | DONE | `IdeaMapWorkspace.tsx` |

### 1.2 Tree Growth (MM-05)

| Feature | Status | Files |
|---------|--------|-------|
| Tab → add child (incremental positioning) | DONE | `useMindMapNodes.ts` |
| Enter → add sibling (incremental positioning) | DONE | `useMindMapNodes.ts` |
| Inline edit on creation (_startEditing) | DONE | `IdeaRecommendationMap.tsx` |
| Empty label → rollback (delete node) | DONE | `IdeaRecommendationMap.tsx` |
| No layout thrashing on add (autoLayout removed) | DONE | `useMindMapNodes.ts` |
| fitView focuses only on new node | DONE | `useMindMapNodes.ts` |

### 1.3 Edge Model (MM-06)

| Feature | Status | Files |
|---------|--------|-------|
| Structural edges (edgeRole: 'structural') | DONE | `useMindMapNodes.ts` |
| Relation edges (edgeRole: 'relation') for cross-links | DONE | `useMindMapNodes.ts` |
| All tree functions filter by structural edges | DONE | `useMindMapNodes.ts` |

### 1.4 Node Depth Model (MM-07)

| Feature | Status | Files |
|---------|--------|-------|
| 11 depth fields (notes, context, goal, rationale, tags, semanticType, status, riskNote, evidenceLinks, artifactLinks, aiExpansionHistory) | DONE | `useMindMapNodes.ts`, `mindMapNodeModel.ts` |
| Hydration from node.payload | DONE | `mindMapNodeModel.ts` |
| Backend normalization (status, tags in DEPTH_FIELDS) | DONE | `ideaWorkspaceGraph.validators.ts` |
| Canvas indicators (notes, risk, evidence count, semantic type, status) | DONE | `IdeaRecommendationMap.tsx` |

### 1.5 Node Detail Drawer (MM-09)

| Feature | Status | Files |
|---------|--------|-------|
| 4 collapsible sections (Basic, Notes, Tags, Evidence) | DONE | `IdeaNodeDetailDrawer.tsx` |
| All 11 fields editable | DONE | `IdeaNodeDetailDrawer.tsx` |
| Evidence links clickable (URL → tab, artifact → open) | DONE | `IdeaNodeDetailDrawer.tsx` |
| Artifact links navigable | DONE | `IdeaNodeDetailDrawer.tsx` |

### 1.6 Context Panel (MM-10)

| Feature | Status | Files |
|---------|--------|-------|
| Selected node info (label, type, status, notes, tags) | DONE | `IdeaContextPanel.tsx` |
| Map statistics (nodes, edges, by type/status) | DONE | `IdeaContextPanel.tsx` |
| Warnings (orphans, unlabeled, broken links) | DONE | `IdeaContextPanel.tsx` |

### 1.7 AI Governance (MM-12)

| Feature | Status | Files |
|---------|--------|-------|
| AI Activity Timeline (aiReplayLog) | DONE | `AIGovernancePanel.tsx` |
| Review controls (status, notes, reviewer) | DONE | `AIGovernancePanel.tsx` |
| AI Statistics | DONE | `AIGovernancePanel.tsx` |
| Unreviewed Changes Alert badge | DONE | `AIGovernancePanel.tsx` |

### 1.8 Subtree Conversion (MM-15)

| Feature | Status | Files |
|---------|--------|-------|
| Convert branch → Decision/Task/Initiative | DONE | `FloatingNodeToolbar.tsx`, `NodeContextMenu.tsx` |
| LinkGraph traceability | DONE | `IdeaMapWorkspace.tsx` |
| Converted node indicator | DONE | `IdeaRecommendationMap.tsx` |

### 1.9 Keyboard & Interaction

| Feature | Status | Files |
|---------|--------|-------|
| Alt+Up/Down/Left/Right → reparent node | DONE | `useMindMapNodes.ts` |
| Ctrl/Cmd+C/X/V → copy/cut/paste nodes | DONE | `useMindMapNodes.ts` |
| Alt+0/1/2/3/9 → fold levels | DONE | `useMindMapNodes.ts` |
| Drag-to-reparent with visual feedback | DONE | `IdeaRecommendationMap.tsx` |

### 1.10 Multiple Structures & Import/Export

| Feature | Status | Files |
|---------|--------|-------|
| 5 layout types (mindmap, org_chart, tree_right, fishbone, timeline) | DONE | `StructureLayouts.ts` |
| Structure picker popover | DONE | `StructurePickerPopover.tsx` |
| OPML import | DONE | `ImportExternalMap.tsx` |
| XMind import | DONE | `ImportExternalMap.tsx` |
| FreeMind import | DONE | `ImportExternalMap.tsx` |
| Markdown export | DONE | `useMapExport.ts` |

---

## 2) V2 Automation Features — COMPLETE (2026-03-15)

These features differentiate from Miro through intelligent automation.

### 2.1 Auto-suggest on Empty Nodes ✅

When a new node is created and the textarea is empty for 1.5s, contextual suggestion chips appear based on the branch type:
- `causes` → Market shift, Process gap, Resource constraint...
- `options` → Quick win, Strategic pivot, Partnership...
- `validation` → A/B test, User interview, Data analysis...
- `risks` → Timeline risk, Budget overrun, Skill gap...
- `next` → Research spike, Stakeholder review, Build prototype...

**Files:** `IdeaRecommendationMap.tsx` (EditableIdeaNodeComponent, lines 831-882, 1131-1150)

### 2.2 One-click AI Expand on Branch Nodes ✅

When a branch node is selected, a violet "AI Expand" / "More AI" button appears at the bottom. One click triggers `handleAIExpand(nodeId)` which calls `POST /map/expand` with ancestor context to generate 3-5 contextual children.

**Files:** `IdeaRecommendationMap.tsx` (BranchNodeComponent), `useMindMapQuickActions.ts`

### 2.3 Drag & Drop from Context Panel ✅

Context panel items (initiatives, gaps, insights, KPIs) can be dragged directly onto the mindmap canvas. The system:
- Creates a node at the drop position
- Connects to the nearest node within 300px (or root)
- Maps item type to semanticType and branchKey automatically

**Files:** `IdeaRecommendationMap.tsx` (onDragOver/onDrop on ReactFlow)

### 2.4 Smart Templates with AI Pre-fill ✅

When applying a template (SWOT, 5 Whys, OKR, etc.), the system automatically calls AI expand after template application to populate branches with content derived from the idea's title and seed text.

**Files:** `IdeaTemplateGallery.tsx` (applyIdeaTemplate), `IdeaMapWorkspace.tsx` (handleApplyTemplate)

### 2.5 Auto-clustering ✅

Right-click canvas → "Auto-cluster" groups orphan idea nodes (connected directly to root) into logical branches based on semanticType, labels, and tags. Creates branch nodes arranged radially with automatic reparenting.

Cluster categories: Risks, Hypotheses, Actions, Evidence, Questions, tag-based, Other.

**Files:** `useMindMapQuickActions.ts` (mm_auto_cluster), `PaneContextMenu.tsx`, `IdeaRecommendationMap.tsx`

### 2.6 AI Auto-suggest via API ✅

Replaced static `branchSuggestions` map with live API call to `POST /map/ai-suggestions`. The system:
- Debounces 1.5s after empty textarea appears (same UX as before)
- Calls `Api.getMyIdeaAISuggestions()` with parent label, sibling context, branchKey, language
- Shows skeleton loading pills while waiting
- Caches results per branchKey for the session
- Falls back to static suggestions on API error or timeout

**Files:** `IdeaRecommendationMap.tsx` (EditableIdeaNodeComponent — suggestCacheRef, API call, skeleton UI)

### 2.7 Semantic Auto-layout ✅

New layout mode `'semantic'` that groups nodes by meaning rather than tree hierarchy:
- Groups by `semanticType` (primary), `branchKey` (secondary), first tag (tertiary)
- Positions clusters radially around root at radius 400px
- Nodes within cluster arranged in vertical stack with 80px spacing
- Available in Structure Picker popover (Brain icon)

**Files:** `StructureLayouts.ts` (applySemanticLayout), `StructurePickerPopover.tsx`, `ideaSelectionTypes.ts` (MapStructureType), `useMindMapQuickActions.ts` (LABELS)

### 2.8 Branch Health Scoring ✅

Per-branch health indicators on every branch node:
- Weighted score: childCount (30%), notes presence (20%), evidence links (20%), depth (30%)
- Color-coded dot: green (≥70), yellow (30-69), red (<30)
- `computeBranchHealth()` exported for reuse
- `BranchHealthDot` rendered in top-right corner of BranchNodeComponent
- Global `MapHealthScore` widget with 5 metrics (Balance, Depth, Coverage, Maturity, Connectivity)

**Files:** `MapHealthScore.tsx` (computeBranchHealth, BranchHealthDot), `IdeaRecommendationMap.tsx` (BranchNodeComponent integration)

### 2.9 Auto-linking to Artifacts ✅

AI-powered artifact link suggestions using the propose→accept flow:
- "AI: Suggest links" in NodeContextMenu and FloatingAIPopover
- Dispatches `mm_ai_suggest_links_execute` to workspace
- Calls `generateAIProposal` with `generatorType: 'ai_propose_attachments'`
- Results shown in `IdeaProposalReview` for user acceptance/rejection

**Files:** `NodeContextMenu.tsx`, `FloatingAIPopover.tsx`, `useMindMapQuickActions.ts`, `IdeaMapWorkspace.tsx` (handleQuickAction)

### 2.10 Smart Branch Summarization ✅

One-click branch summary with structured output:
- "Summarize" button (emerald) on BranchNodeComponent next to AI Expand
- `BranchSummaryPanel` slide-over panel (380px, right side)
- Collects all descendant nodes, calls `Api.getMyIdeaAISuggestions()` with summarization prompt
- Displays: narrative summary, key points (bullet list), recommendations (bullet list)
- "Copy to clipboard" exports as Markdown
- Handles loading, error, and empty states

**Files:** `BranchSummaryPanel.tsx` (new), `IdeaRecommendationMap.tsx` (BranchNodeComponent button, event listener, panel render), `useMindMapQuickActions.ts` (mm_ai_summarize_branch event dispatch)

### 2.11 Presentation Mode ✅

Full-screen branch-by-branch presentation with:
- Slide navigation (arrows, space, dots)
- Presenter timer (MM:SS elapsed, auto-starts on open)
- Presenter notes (collapsible section, toggled with 'n' key)
- Fullscreen toggle ('f' key)
- Branch color coding and progress bar
- Entry point: "Present" button in CanvasLeftToolbar (Play icon)

**Files:** `PresentationMode.tsx` (timer, notes, fullscreen), `CanvasLeftToolbar.tsx` (Present slot)

---

## 3) V2 Phase 3 — Final Features (2026-03-15)

### 3.1 Real-time Collaboration — Graph CRUD Broadcasting ✅

Extended the existing WebSocket gateway with graph mutation broadcasting:
- New message types: `graph_patch`, `graph_full_sync`, `graph_sync_response`, `graph_full_state`
- Operations: `add_node`, `remove_node`, `update_node`, `add_edge`, `remove_edge`, `update_edge`
- Patches broadcast to all other clients in the room (sender excluded)
- Full state sync on request for late-joining clients
- Last-writer-wins conflict resolution (REST save remains source of truth)
- `collabSendRef` + `broadcastGraphPatch` in IdeaRecommendationMap for sending local changes
- `idea-collab-graph-patch` event listener for applying remote changes

**Files:** `ideaCollabWs.gateway.ts` (3 new message types), `CollaborationOverlay.tsx` (dispatch events), `IdeaRecommendationMap.tsx` (send/receive patches)

### 3.2 Server-side Version History + Restore UI ✅

Enhanced `SnapshotHistory.tsx` with:
- Visual timeline with colored dots (green=recent, yellow=older, gray=old)
- Relative timestamps ("2 min ago", "1 hour ago")
- Snapshot diff preview (added/removed nodes and edges vs previous snapshot)
- Inline label editing (click to rename)
- Auto-snapshot on significant changes (threshold: 10 node delta, max once per 5 min)
- Preview mode (temporary view without saving, reverts on close)
- Keyboard shortcut: Ctrl+Shift+H to toggle
- "Version History" option in ImportExportPopover

**Files:** `SnapshotHistory.tsx` (full rewrite), `ImportExportPopover.tsx`, `useMindMapQuickActions.ts` (mm_snapshot_history), `IdeaRecommendationMap.tsx` (state + keyboard + render)

### 3.3 Persistent Comments/Activity per Node ✅

Server-side comment storage with dedicated API:
- `POST /my-ideas/:id/map/nodes/:nodeId/comments` — add comment
- `GET /my-ideas/:id/map/nodes/:nodeId/comments` — list comments
- `DELETE /my-ideas/:id/map/nodes/:nodeId/comments/:commentId` — delete comment
- Migration `720_idea_node_comments.sql` — `idea_node_comments` table with indexes
- `NodeCommentThread.tsx` now fetches from API, falls back to prop-based comments
- `Api.getNodeComments`, `Api.addNodeComment`, `Api.deleteNodeComment` frontend methods
- `ActivityFeed.tsx` updated to show comment activity

**Files:** `my-work.routes.ts` (3 endpoints), `720_idea_node_comments.sql`, `api.ts` (3 methods), `NodeCommentThread.tsx` (API integration), `ActivityFeed.tsx`

### 3.4 Performance Optimization for Large Maps ✅

Virtualization and simplified rendering for maps with >200 nodes:
- `LargeMapOptimizer.tsx` — monitors node count, shows warning at 150+, auto-simplifies at 500+
- Simplified rendering mode: minimal node display, no indicators, no animations, default edge types
- `_simplified` flag passed through node data
- `BranchNodeComponent` health computation optimized (nodeCount/edgeCount as deps proxy)
- `edgeTypes` switches to ReactFlow defaults in simplified mode
- User-toggleable via floating indicator

**Files:** `LargeMapOptimizer.tsx` (new), `IdeaRecommendationMap.tsx` (simplifiedMode state, simplified rendering, optimized deps)

---

## V2 Remaining

All planned V2 features have been implemented. No remaining items.

---

## 4) V2 Phase 2 — DoD Completion (2026-03-15)

Features added in this batch to close remaining Definition-of-Done gaps.

### 4.1 Inline Plus Affordance

Visible "+" button on node hover for quick child creation without keyboard shortcuts.

### 4.2 Mindmap Inspector (Style/Layout/Theme)

`MindmapInspector.tsx` — side panel for per-node style overrides, layout mode selection, and theme application.

### 4.3 Tag → Color Canonical Mapping

`tagColorMapping.ts` — deterministic color assignment for tags across the entire map, ensuring visual consistency.

### 4.4 Contextual AI Sidekick

`aiSidekickContext.ts` — intent detection and context building for AI actions scoped to the current branch/selection.

### 4.5 Select/Pan Visual Indicator

`CanvasLeftToolbar.tsx` — pointer toggle button now shows a SEL/PAN badge next to the cursor icon, making the current interaction mode visible at a glance.

### 4.6 Lightweight Node Popovers

`FloatingNodeToolbar.tsx` — semantic controls, quick task creation, and branch theme dropdowns accessible from the floating toolbar without opening the full detail drawer.

### 4.7 Command Palette (Cmd+K)

`MindmapCommandPalette.tsx` + `CommandPalette.tsx` — fuzzy-search command palette for quick access to all mindmap actions.

### 4.8 PDF Export

`useMapExportPdf.ts` — captures the ReactFlow viewport as a high-resolution PNG via `html-to-image`, opens a print-ready window with landscape layout. No additional dependencies required.

**Files:** `useMapExportPdf.ts`, `ImportExportPopover.tsx` (PDF option), `useMindMapQuickActions.ts` (mm_export_pdf handler), `IdeaRecommendationMap.tsx` (event listener)

### 4.9 i18n & Accessibility Improvements

- All icon-only buttons in `CanvasLeftToolbar.tsx` and `FloatingNodeToolbar.tsx` now have `aria-label` attributes matching their `title` text.
- `CanvasToolErrorBoundary` error messages and retry button are now bilingual (PL/EN) based on `navigator.language`.

---

## 5) Quality Assurance

### 5.1 Smoke Test Script

`scripts/mindmap-smoke-test.mjs` verifies against Railway DB:
- All 5 showcase maps exist with correct node/edge counts
- Every map has a root node at (0,0) with semanticType 'problem'
- Every branch node has structural children
- No orphan nodes
- No duplicate IDs
- No stale viewport configs
- Cross-links have edgeRole 'relation'

**Last run:** 60 passed, 0 failed (2026-03-15)

### 5.2 Showcase Maps (Railway)

| Map | Nodes | Edges | Theme |
|-----|-------|-------|-------|
| Pricing Pivot Analysis | 11+ | 10+ | Pricing strategy |
| Product Discovery: Second Product Line | 18+ | 20+ | Product expansion |
| Platform Migration War Room | 18+ | 20+ | Technical migration |
| AI Governance Framework | 20+ | 25+ | AI policy |
| Q3 Personal OKR Planning | 12+ | 14+ | Personal goals |

---

## 6) Architecture Summary

```
IdeaMapWorkspace.tsx          — orchestrator, persistence, tool interactions, artifact linking
├── IdeaRecommendationMap.tsx — ReactFlow canvas, rendering, keyboard shortcuts
│   ├── EditableIdeaNodeComponent — inline editing + API-driven auto-suggest + cache
│   ├── BranchNodeComponent      — branch display + AI expand + summarize + health dot
│   └── FloatingNodeToolbar      — selected node actions (with aria-labels)
├── CanvasLeftToolbar.tsx     — left toolbar with pointer toggle + tool slots (with aria-labels)
├── useMindMapPersistence.ts  — autosave, hydration, conflict resolution
├── useMindMapNodes.ts        — CRUD, reparent, copy/paste, fold levels
├── useMindMapQuickActions.ts — action dispatcher (AI, cluster, export, summarize, links, PDF)
├── useIdeaMapSync.ts         — sync engine (debounce, draft, manual save)
├── useMapExport.ts           — PNG/SVG/JSON/Markdown export
├── useMapExportPdf.ts        — PDF export via print dialog (no extra deps)
├── IdeaContextPanel.tsx      — context info, stats, warnings, drag source
├── AIGovernancePanel.tsx     — AI audit trail and review
├── StructureLayouts.ts       — layout algorithms (org_chart, fishbone, timeline, semantic)
├── StructurePickerPopover.tsx — UI for selecting structure type (6 options)
├── MapHealthScore.tsx        — global health widget + per-branch computeBranchHealth + BranchHealthDot
├── BranchSummaryPanel.tsx    — slide-over panel for AI branch summarization
├── PresentationMode.tsx      — full-screen presentation with timer, notes, fullscreen
├── MindmapInspector.tsx      — style/layout/theme inspector panel
├── MindmapCommandPalette.tsx — fuzzy-search command palette (Cmd+K)
├── aiSidekickContext.ts      — contextual AI intent detection
├── tagColorMapping.ts        — deterministic tag → color mapping
├── ImportExternalMap.tsx      — OPML/XMind/FreeMind import
└── ImportExportPopover.tsx   — import/export menu (includes PDF option)
```

---

## 7) Key Design Decisions

1. **ReactFlow is the graph SSOT** — backend only persists snapshots, never modifies graph structure
2. **Structural vs relation edges** — tree hierarchy and cross-links are separate concerns
3. **Incremental positioning** — new nodes are placed relative to siblings, no full re-layout
4. **60s autosave debounce** — prevents save noise; Ctrl+S and page close trigger immediate save
5. **Transient field stripping** — UI state (selected, dragging) never reaches the server
6. **Deep merge for extensions** — prevents viewport/governance/template data from clobbering each other
7. **Propose → preview → accept for AI** — material AI changes always go through user approval
