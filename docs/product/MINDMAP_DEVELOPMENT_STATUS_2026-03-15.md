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

## 2) V2 Automation Features — IN PROGRESS (2026-03-15)

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

---

## 3) V2 Planned (Not Yet Implemented)

| Feature | Priority | Description |
|---------|----------|-------------|
| AI auto-suggest via API | P1 | Replace static suggestions with API-driven contextual suggestions using `getMyIdeaAISuggestions` |
| Semantic auto-layout | P1 | AI-driven layout that respects semantic relationships, not just tree hierarchy |
| Real-time collaboration | P2 | WebSocket-based multi-user editing with CRDT conflict resolution |
| Branch health scoring | P2 | Visual indicators showing branch completeness and quality |
| Auto-linking to artifacts | P2 | AI detects when a node should link to existing decisions/tasks/initiatives |
| Smart summarization | P2 | One-click branch summary that generates a narrative from the subtree |
| Presentation mode | P3 | Step-through presentation of the map for stakeholder reviews |

---

## 4) Quality Assurance

### 4.1 Smoke Test Script

`scripts/mindmap-smoke-test.mjs` verifies against Railway DB:
- All 5 showcase maps exist with correct node/edge counts
- Every map has a root node at (0,0) with semanticType 'problem'
- Every branch node has structural children
- No orphan nodes
- No duplicate IDs
- No stale viewport configs
- Cross-links have edgeRole 'relation'

**Last run:** 60 passed, 0 failed (2026-03-15)

### 4.2 Showcase Maps (Railway)

| Map | Nodes | Edges | Theme |
|-----|-------|-------|-------|
| Pricing Pivot Analysis | 11+ | 10+ | Pricing strategy |
| Product Discovery: Second Product Line | 18+ | 20+ | Product expansion |
| Platform Migration War Room | 18+ | 20+ | Technical migration |
| AI Governance Framework | 20+ | 25+ | AI policy |
| Q3 Personal OKR Planning | 12+ | 14+ | Personal goals |

---

## 5) Architecture Summary

```
IdeaMapWorkspace.tsx          — orchestrator, persistence, tool interactions
├── IdeaRecommendationMap.tsx — ReactFlow canvas, rendering, keyboard shortcuts
│   ├── EditableIdeaNodeComponent — inline editing + auto-suggest
│   ├── BranchNodeComponent      — branch display + AI expand button
│   └── FloatingNodeToolbar      — selected node actions
├── useMindMapPersistence.ts  — autosave, hydration, conflict resolution
├── useMindMapNodes.ts        — CRUD, reparent, copy/paste, fold levels
├── useMindMapQuickActions.ts — action dispatcher (AI, cluster, export, etc.)
├── useIdeaMapSync.ts         — sync engine (debounce, draft, manual save)
├── IdeaContextPanel.tsx      — context info, stats, warnings, drag source
├── AIGovernancePanel.tsx     — AI audit trail and review
├── StructureLayouts.ts       — layout algorithms (org_chart, fishbone, etc.)
├── ImportExternalMap.tsx      — OPML/XMind/FreeMind import
└── useMapExport.ts           — Markdown export
```

---

## 6) Key Design Decisions

1. **ReactFlow is the graph SSOT** — backend only persists snapshots, never modifies graph structure
2. **Structural vs relation edges** — tree hierarchy and cross-links are separate concerns
3. **Incremental positioning** — new nodes are placed relative to siblings, no full re-layout
4. **60s autosave debounce** — prevents save noise; Ctrl+S and page close trigger immediate save
5. **Transient field stripping** — UI state (selected, dragging) never reaches the server
6. **Deep merge for extensions** — prevents viewport/governance/template data from clobbering each other
7. **Propose → preview → accept for AI** — material AI changes always go through user approval
