# P14 Process Flow — Frontend Implementation Evidence

> Generated: 2026-04-11
> Status: Post-remediation (R1–R3 complete)

---

## 1. Semantic Object Types → Frontend Component Mapping

| # | Canon Semantic Type | Frontend Node Type Key | Component File | Status |
|---|---|---|---|---|
| 1 | `start_event` | `start_event` | `nodes/BPMNStartNode.tsx` | ✅ Implemented |
| 2 | `end_event` | `end_event` | `nodes/BPMNEndNode.tsx` | ✅ Implemented |
| 3 | `activity` (task) | `task` | `nodes/ActivityNode.tsx` | ✅ Implemented |
| 4 | `gateway_xor` | `decision_gateway` | `nodes/GatewayNode.tsx` | ✅ Implemented |
| 5 | `gateway_and` | `parallel_gateway` | `nodes/GatewayNode.tsx` | ✅ Implemented |
| 6 | `data_object` | `data_object` | `nodes/DataObjectNode.tsx` | ✅ Implemented |
| 7 | `lane` | Lane system | `LaneSystem.tsx` (background strips) | ✅ Implemented |
| 8 | `subprocess` | `subprocess` | `nodes/SubprocessNode.tsx` | ✅ Implemented |
| 9 | `pool` | `pool` | `nodes/PoolNode.tsx` | ✅ Implemented (R2) |
| 10 | `annotation` | `annotation` | `nodes/DataObjectNode.tsx` (shared) | ✅ Implemented |
| 11 | `sequence_flow` | `flowEdge` | `FlowEdgeComponent.tsx` | ✅ Implemented |
| 12 | `message_flow` | `messageFlow` | `MessageFlowEdge.tsx` | ✅ Implemented (R2) |

Additional non-canon types (mode-specific):
- `flowNode` — classic generic node (`FlowNodeComponent.tsx`)
- VSM nodes — 9 types via `VSMNodeComponent.tsx`

---

## 2. Backend Endpoint Coverage by Frontend Hooks

| Endpoint | Method | Frontend Hook | Status |
|---|---|---|---|
| `/contract` | GET | `useProcessFlowCRUD.fetchContract` | ✅ Wired (R2, behind flag) |
| `/:id/objects` | GET | `useProcessFlowCRUD.fetchObjects` | ✅ Wired (R2, behind flag) |
| `/:id/nodes` | POST | `useProcessFlowCRUD.createNode` | ✅ Wired (R2, behind flag) |
| `/nodes/:id/label` | PUT | `useProcessFlowCRUD.updateNodeLabel` | ✅ Wired (R2, behind flag) |
| `/nodes/:id/move` | PUT | `useProcessFlowCRUD.moveNode` | ✅ Wired (R2, behind flag) |
| `/nodes/:id/gateway-kind` | PUT | `useProcessFlowCRUD.updateGatewayKind` | ✅ Wired (R2, behind flag) |
| `/nodes/:id/lane` | PUT | `useProcessFlowCRUD.updateNodeLane` | ✅ Wired (R2, behind flag) |
| `/nodes/:id` | DELETE | `useProcessFlowCRUD.deleteNode` | ✅ Wired (R2, behind flag) |
| `/:id/edges` | POST | `useProcessFlowCRUD.createEdge` | ✅ Wired (R2, behind flag) |
| `/edges/:id/label` | PUT | `useProcessFlowCRUD.updateEdgeLabel` | ✅ Wired (R2, behind flag) |
| `/edges/:id` | DELETE | `useProcessFlowCRUD.deleteEdge` | ✅ Wired (R2, behind flag) |
| `/:id/validate` | POST | `useProcessFlowValidation.validate` | ✅ Active |
| `/:id/readback` | GET | `useProcessFlowReadback.fetchReadback` | ✅ Active |
| `/:id/export/:format` | GET | `useProcessFlowExport.exportAs` | ✅ Active |
| `/:id/health` | GET | `useProcessFlowDegraded.checkHealth` | ✅ Active |
| `/:id/ai-proposals` | POST | `useProcessFlowAIProposal.createProposal` | ✅ Active |
| `/ai-proposals/:id/resolve` | POST | `useProcessFlowAIProposal.resolveProposal` | ✅ Active |
| `/ai-proposals/:id` | GET | `useProcessFlowCRUD.fetchProposal` | ✅ Wired (R2, behind flag) |

**Coverage: 18/18 endpoints (100%)**

---

## 3. Component Architecture

```
IdeaProcessFlowTool.tsx (2430 LOC — orchestrator)
├── ProcessFlowToolbar (./processflow/ProcessFlowToolbar.tsx)
├── LaneSystem (./processflow/LaneSystem.tsx)
├── FlowNodeComponent (./processflow/FlowNodeComponent.tsx)
├── FlowEdgeComponent (./processflow/FlowEdgeComponent.tsx)
├── MessageFlowEdge (./processflow/MessageFlowEdge.tsx)
├── BPMN Nodes (./processflow/nodes/)
│   ├── BPMNStartNode.tsx
│   ├── BPMNEndNode.tsx
│   ├── ActivityNode.tsx
│   ├── GatewayNode.tsx
│   ├── DataObjectNode.tsx
│   ├── SubprocessNode.tsx
│   └── PoolNode.tsx
├── Panels
│   ├── ValidationResultsPanel.tsx
│   ├── AIProposalPanel.tsx
│   ├── ReadbackPanel.tsx
│   ├── ProcessFlowPropertiesPanel.tsx
│   └── ExportDialog.tsx (uses shared Dialog/Button)
├── ProcessFlowContextMenu.tsx
├── Hooks
│   ├── useProcessFlowUndoRedo.ts
│   ├── useProcessFlowValidation.ts
│   ├── useProcessFlowAIProposal.ts
│   ├── useProcessFlowReadback.ts
│   ├── useProcessFlowExport.ts
│   ├── useProcessFlowDegraded.ts
│   ├── useProcessFlowCRUD.ts
│   ├── useProcessFlowNodes.ts
│   └── useProcessFlowQuickActions.ts
└── Shared
    ├── CanvasZoomControls
    ├── CollaborationOverlay
    └── CanvasLeftToolbar (undo/redo routing: pf_undo/pf_redo)
```

---

## 4. Test Coverage Matrix

| Test File | Tests | Coverage Area |
|---|---|---|
| `processflow-nodes.test.tsx` | 20 | BPMN node components (Start, End, Activity, Gateway, DataObject, Subprocess, Pool) |
| `processflow-hooks.test.ts` | 8 | Validation, AI Proposal, Readback, Export hooks |
| `processflow-panels.test.tsx` | 20 | ValidationResultsPanel, AIProposalPanel, ReadbackPanel, ContextMenu |
| `processflow-undo-degraded.test.ts` | 7 | UndoRedo hook (push, undo, redo, reset, cap) + Degraded hook |
| `p14-processflow-canon.test.ts` | 68 | Backend canon (semantic types, rules, validation) |
| `p14-processflow-service.test.ts` | 57 | Backend service (CRUD, validation, readback, export, AI) |
| `useProcessFlowNodes.test.tsx` | varies | Node CRUD operations hook |
| `IdeaProcessFlowTool.error-state.test.tsx` | varies | Error state, loading, degraded banner |
| `canvasOsContract.test.ts` | varies | Cross-tool Canvas OS events |

**Total: ~180+ tests across frontend and backend**

---

## 5. UI/UX Compliance

| Aspect | Status | Notes |
|---|---|---|
| Shared Dialog primitive | ✅ | ExportDialog refactored to `@/components/ui/dialog.tsx` |
| Shared Button primitive | ✅ | ValidationResultsPanel, ReadbackPanel use `Button` from design system |
| Dark mode token consistency | ✅ | Standardized to `dark:border-navy-*` / `dark:bg-navy-*` |
| Process inspector in right panel | ✅ | Full `ProcessFlowPropertiesPanel` integrated into `IdeaWorkspaceTools` |
| CanvasLeftToolbar undo/redo | ✅ | Tool-aware routing (`pf_undo`/`pf_redo`) |
| Ghost cards support | ✅ | `process_flow` added to rendering condition |
| Canvas OS integration | ✅ | Semantic events, collaboration overlay, zoom controls |
