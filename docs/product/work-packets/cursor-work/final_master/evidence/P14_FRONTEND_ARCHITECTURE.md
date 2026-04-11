# P14 Process Flow — Frontend Architecture

> Generated: 2026-04-11
> Post-remediation architecture after R1–R3 phases

---

## 1. High-Level Component Hierarchy

```
IdeaMapWorkspace
└── IdeaProcessFlowTool (orchestrator, ~2430 LOC)
    ├── ProcessFlowToolbar
    │   ├── Flow mode selector (classic / automation / vsm)
    │   ├── Shape palette (BPMN / System / Org kits)
    │   ├── Analyze & Validate section
    │   └── Canvas management (undo/redo, layout, save)
    ├── ReactFlow Canvas
    │   ├── Node Types
    │   │   ├── flowNode → FlowNodeComponent (generic)
    │   │   ├── start_event → BPMNStartNode
    │   │   ├── end_event → BPMNEndNode
    │   │   ├── task → ActivityNode
    │   │   ├── decision_gateway → GatewayNode
    │   │   ├── parallel_gateway → GatewayNode
    │   │   ├── subprocess → SubprocessNode
    │   │   ├── annotation → DataObjectNode
    │   │   ├── data_object → DataObjectNode
    │   │   ├── pool → PoolNode
    │   │   └── vsm_* → vsmNodeTypes (9 types)
    │   ├── Edge Types
    │   │   ├── flowEdge → FlowEdgeComponent (sequence flow)
    │   │   └── messageFlow → MessageFlowEdge (inter-pool)
    │   └── Lane Backgrounds → LaneSystem
    ├── Panels (conditional rendering)
    │   ├── ValidationResultsPanel
    │   ├── AIProposalPanel
    │   ├── ReadbackPanel
    │   ├── ProcessFlowPropertiesPanel
    │   ├── ExportDialog (shared Dialog primitive)
    │   └── ProcessKPIDashboard
    ├── ProcessFlowContextMenu
    ├── CanvasZoomControls (shared)
    ├── CollaborationOverlay (shared)
    └── MiniMap (ReactFlow)

IdeaWorkspaceTools (right panel)
└── Process Inspector section
    └── ProcessFlowPropertiesPanel (full property editing)
```

---

## 2. Data Flow

```
┌──────────────────────────────────────────┐
│  IdeaMapWorkspace                        │
│  ┌─────────────────┐                     │
│  │ useIdeaMapSync   │◄── workspace DB    │
│  │ (persistence)    │──► auto-save       │
│  └────────┬────────┘                     │
│           │ nodes/edges/extensions        │
│  ┌────────▼────────────────────────────┐ │
│  │ IdeaProcessFlowTool                 │ │
│  │                                     │ │
│  │  state: nodes, edges, lanes,        │ │
│  │         flowMode, semanticKit       │ │
│  │                                     │ │
│  │  ┌───────────────────┐              │ │
│  │  │ useProcessFlowUndoRedo           │ │
│  │  │ (pushUndo/undo/redo/resetUndo)   │ │
│  │  └───────────────────┘              │ │
│  │                                     │ │
│  │  ┌─ V8 API Hooks ───────────────┐   │ │
│  │  │ useProcessFlowValidation     │   │ │
│  │  │ useProcessFlowAIProposal     │   │ │
│  │  │ useProcessFlowReadback       │   │ │
│  │  │ useProcessFlowExport         │   │ │
│  │  │ useProcessFlowDegraded       │   │ │
│  │  │ useProcessFlowCRUD (flagged) │   │ │
│  │  └──────────────────────────────┘   │ │
│  │                                     │ │
│  │  ┌─ Canvas Events ──────────────┐   │ │
│  │  │ IDEA_WORKSPACE_INSERT_EVENT  │   │ │
│  │  │ IDEA_WORKSPACE_THEME_EVENT   │   │ │
│  │  │ IDEA_WORKSPACE_FLOW_SEMANTIC │   │ │
│  │  └──────────────────────────────┘   │ │
│  └─────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

---

## 3. Canvas OS Integration

Process Flow participates in the shared Canvas OS contract:

| Event | Direction | Purpose |
|---|---|---|
| `IDEA_WORKSPACE_INSERT_EVENT` | Canvas → Tool | Insert node from sidebar/ghost card |
| `IDEA_WORKSPACE_THEME_EVENT` | Canvas → Tool | Apply theme preset to lanes |
| `IDEA_WORKSPACE_FLOW_SEMANTIC_EVENT` | Tool → Canvas | Notify semantic kit change |
| Selection events | Tool → Parent | Notify node/edge selection for right panel |
| `pf_undo` / `pf_redo` | CanvasLeftToolbar → Tool | Undo/redo via shared toolbar |

---

## 4. Validation Architecture

Two-layer validation operates at both local and backend levels:

### Local validation (`validateFlow()`)
- Inline in orchestrator (~180 LOC)
- Checks: missing start/end, dangling nodes, decision exit count
- Kit-specific: BPMN gateway/task presence, System actor/service, Org role/handoff
- VSM-specific: supplier/customer/process presence, cycle time

### Backend validation (`useProcessFlowValidation`)
- POST `/:id/validate`
- 2-layer: `semantic_first` → `structural_bounded`
- Returns typed `ValidationResult` with `issues[]`, each with `layer`, `severity`, `object_id`, `rule`, `message`
- Displayed in `ValidationResultsPanel`

---

## 5. Persistence Model

| Layer | Mechanism | Scope |
|---|---|---|
| **Primary** | `useIdeaMapSync` → workspace DB | Nodes, edges, extensions (incl. processFlow metadata) |
| **Undo/Redo** | `useProcessFlowUndoRedo` | Client-side JSON snapshot stacks (30 max) |
| **V8 API** | `useProcessFlowCRUD` (behind `enabled` flag) | Optional server-side CRUD via 12 endpoints |

---

## 6. Design System Compliance

| Component | Primitive Used | Source |
|---|---|---|
| ExportDialog | `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` | `@/components/ui/dialog.tsx` |
| Export format buttons | `Button` variant="ghost" | `@/components/ui/Button.tsx` |
| Validation "Run" button | `Button` variant="outline" | `@/components/ui/Button.tsx` |
| Readback "Generate" button | `Button` variant="outline" | `@/components/ui/Button.tsx` |
| Dark mode tokens | `dark:border-navy-*`, `dark:bg-navy-*` | Standardized across all panels |
| Panel borders | `border-slate-200 dark:border-navy-700` | Consistent pattern |
