/**
 * IdeaProcessFlowTool — V3 Process Flow canvas for Idea Workspace.
 *
 * Swimlane-based process flow editor built on React Flow.
 * Shapes: start, end, action, decision.
 * Connectors: directed edges with optional labels (yes/no) and condition types.
 * Validations: dangling nodes, missing start/end, decision without two exits.
 *
 * V3 enhancements:
 * - Undo/Redo (Ctrl+Z / Ctrl+Shift+Z)
 * - Custom edge with inline label editing + condition type
 * - Drag node between lanes (laneId auto-update)
 * - Lane reorder, delete, color picker
 * - Auto-layout via dagre
 * - MiniMap + keyboard shortcuts
 *
 * Data lives in the shared IdeaWorkspaceGraph (nodes/edges/extensions.processFlow).
 */
import 'reactflow/dist/style.css';

import * as dagre from 'dagre';
import {
  AlertTriangle,
  CheckCircle,
  GitMerge,
  Grid3x3,
  Lightbulb,
  Loader2,
  Magnet,
  Plus,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  type Connection,
  type Edge,
  type EdgeChange,
  type EdgeProps,
  MiniMap,
  type Node,
  type NodeChange,
  type NodeProps,
  ReactFlowProvider,
  useUpdateNodeInternals,
} from 'reactflow';

import { Api } from '@/services/api';
import {
  generateAIProposal,
  generateProcessSummary,
  runProcessCoach,
} from '@/services/ideaAIGenerator';
import { useAppStore } from '@/store/useAppStore';
import { withNormalizedArtifactLinks } from '@/utils/artifactLinks';

import { EmptyStateInline } from '../shared/NModeBlocks/EmptyStateInline';
import TeresaMark from '../shared/TeresaMark';
import { getCanvasBg } from './canvas/canvasBackground';
import { type ProcessFlowSemanticKit } from './canvas/canvasOsContract';
import { CanvasZoomControls } from './canvas/CanvasZoomControls';
import { formatIdeaMapSyncLabel, resolveIdeaMapHydration } from './canvas/useIdeaMapSync';
import { getIdeasToolInteractionProps } from './canvas/useIdeasToolDefaults';
import {
  type CanvasToolType,
  EMPTY_SELECTION,
  IDEA_WORKSPACE_FLOW_SEMANTIC_EVENT,
  IDEA_WORKSPACE_INSERT_EVENT,
  IDEA_WORKSPACE_THEME_EVENT,
  type IdeaWorkspaceInsertDetail,
  type IdeaWorkspaceSelection,
} from './ideaSelectionTypes';
import {
  CollaborationOverlay,
  type CollaborationSessionState,
} from './mindmap/CollaborationOverlay';
import { useIsDark } from './whiteboard/nodes/whiteboardNodeHelpers';
import { AIProposalPanel } from './processflow/AIProposalPanel';
import type { ApplyPatchResult } from './processflow/applyProposalPatch';
import { ExportDialog } from './processflow/ExportDialog';
import { FlowEdgeComponent } from './processflow/FlowEdgeComponent';
import {
  FlowNodeComponent,
  type FlowShape,
  LANE_HEIGHT,
  SHAPE_CONFIG,
} from './processflow/FlowNodeComponent';
import {
  DEFAULT_LANES,
  FLOW_THEME_PRESETS,
  type Lane,
  LANE_COLORS,
} from './processflow/LaneSystem';
import { LaneSystem } from './processflow/LaneSystem';
import { isNodeInCollapsedLane, setLaneHeight, toggleLaneCollapsed } from './processflow/laneState';
import { appendComment, removeComment, type ProcessFlowNodeComment } from './processflow/nodeComments';
import { ProcessFlowNodeCommentThread } from './processflow/ProcessFlowNodeCommentThread';
import {
  normalizeProcessFlowViewState,
  processFlowViewportStorageKey,
  resolveHydrationViewport,
} from './processflow/viewState';
import { ActivityNode } from './processflow/nodes/ActivityNode';
import { BPMNEndNode } from './processflow/nodes/BPMNEndNode';
import { BPMNStartNode } from './processflow/nodes/BPMNStartNode';
import { DataObjectNode } from './processflow/nodes/DataObjectNode';
import { GatewayNode } from './processflow/nodes/GatewayNode';
import { PoolNode } from './processflow/nodes/PoolNode';
import { SubprocessNode } from './processflow/nodes/SubprocessNode';
import {
  getCanvasContextActions,
  getNodeContextActions,
  ProcessFlowContextMenu,
} from './processflow/ProcessFlowContextMenu';
import { ProcessFlowFloatingToolbar } from './processflow/ProcessFlowFloatingToolbar';
import { ProcessFlowPropertiesPanel } from './processflow/ProcessFlowPropertiesPanel';
import {
  FLOW_MODE_GUIDANCE,
  FLOW_MODE_LABELS,
  type ProcessFlowMode,
  SHAPES_BY_MODE,
  SHAPES_BY_SEMANTIC_KIT,
} from './processflow/ProcessFlowToolbar';
import { ProcessFlowToolbar } from './processflow/ProcessFlowToolbar';
import { ReadbackPanel } from './processflow/ReadbackPanel';
import { useProcessFlowAIProposal } from './processflow/useProcessFlowAIProposal';
import { type ChangeOrigin, useProcessFlowCollab } from './processflow/useProcessFlowCollab';
import { useProcessFlowExport } from './processflow/useProcessFlowExport';
import { useProcessFlowNodes } from './processflow/useProcessFlowNodes';
import {
  type ProcessFlowExternalRuntime,
  useProcessFlowPersistence,
} from './processflow/useProcessFlowPersistence';
import { useConfirmDialog } from './shared/ConfirmDialog';
import { useCanvasKeyboard } from './canvas/useIdeasToolKeyboard';
import { useProcessFlowQuickActions } from './processflow/useProcessFlowQuickActions';
import { useProcessFlowReadback } from './processflow/useProcessFlowReadback';
import { useProcessFlowUndoRedo } from './processflow/useProcessFlowUndoRedo';
import { type ValidationWarning, validateFlowWarnings } from './processflow/validateFlow';
import { useProcessFlowValidation } from './processflow/useProcessFlowValidation';
import { ValidationResultsPanel } from './processflow/ValidationResultsPanel';
import { ProcessKPIDashboard } from './ProcessKPIDashboard';
import { vsmNodeTypes } from './VSMNodeComponent';
import { VSMTimelineBar } from './VSMTimelineBar';

type ReactFlowInstance = any;

// Types, constants, and components imported from extracted modules:
// Lane, LANE_COLORS, DEFAULT_LANES, FLOW_THEME_PRESETS from ./processflow/LaneSystem
// FlowShape, SHAPE_CONFIG, LANE_HEIGHT from ./processflow/FlowNodeComponent
// ProcessFlowMode, FLOW_MODE_LABELS, FLOW_MODE_GUIDANCE, SHAPES_BY_MODE, SHAPES_BY_SEMANTIC_KIT from ./processflow/ProcessFlowToolbar

function resolveSemanticInsertShape(
  value: string | undefined,
  flowMode: ProcessFlowMode,
  semanticKit: ProcessFlowSemanticKit
): FlowShape {
  const normalized = String(value || '').toLowerCase();
  if (semanticKit === 'bpmn') {
    if (normalized.includes('gateway') || normalized.includes('decision')) return 'bpmn_gateway';
    if (normalized.includes('event') || normalized.includes('start') || normalized.includes('end'))
      return 'bpmn_event';
    return 'bpmn_task';
  }
  if (semanticKit === 'system') {
    if (normalized.includes('db') || normalized.includes('data')) return 'system_db';
    if (normalized.includes('actor') || normalized.includes('role') || normalized.includes('user'))
      return 'system_actor';
    return 'system_service';
  }
  if (semanticKit === 'org') {
    if (normalized.includes('team') || normalized.includes('department')) return 'org_team';
    if (normalized.includes('handoff') || normalized.includes('transfer')) return 'org_handoff';
    return 'org_role';
  }
  if (normalized.includes('decision') || normalized.includes('gateway')) return 'decision';
  if (normalized.includes('start') || normalized.includes('trigger')) {
    return flowMode === 'automation' ? 'auto_trigger' : 'start';
  }
  if (normalized.includes('inventory') || normalized.includes('queue')) return 'vsm_inventory';
  if (normalized.includes('supplier')) return 'vsm_supplier';
  if (normalized.includes('customer')) return 'vsm_customer';
  if (normalized.includes('system')) {
    return flowMode === 'automation' ? 'auto_api' : 'action';
  }
  if (normalized.includes('kpi')) return 'decision';
  if (flowMode === 'vsm') return 'vsm_process';
  if (flowMode === 'automation') return 'auto_api';
  return 'action';
}

// FlowNodeComponent imported from ./processflow/FlowNodeComponent
// FlowEdgeComponent imported from ./processflow/FlowEdgeComponent

type RFNodeTypes = Record<string, React.ComponentType<NodeProps<any>>>;
type RFEdgeTypes = Record<string, React.ComponentType<EdgeProps<any>>>;

const baseNodeTypes: RFNodeTypes = {
  flowNode: FlowNodeComponent,
  start_event: BPMNStartNode,
  end_event: BPMNEndNode,
  task: ActivityNode,
  decision_gateway: GatewayNode,
  parallel_gateway: GatewayNode,
  subprocess: SubprocessNode,
  annotation: DataObjectNode,
  data_object: DataObjectNode,
  pool: PoolNode,
};

const edgeTypes: RFEdgeTypes = {
  flowEdge: FlowEdgeComponent,
};

/**
 * After the graph hydrates (nodes + edges set together on load), ReactFlow can
 * fail to render edges because the freshly-added nodes' handle bounds aren't yet
 * registered in its internal store — so persisted edges were invisible after a
 * reload even though they were in state. Force a handle-bounds recompute for each
 * node whenever the node-id set changes; this re-evaluates and draws the edges.
 * Must live inside <ReactFlowProvider>. (M07 live-debug 2026-06-20)
 */
const EdgeRehydrateFix: React.FC<{ nodeIdsKey: string; nodeIds: string[] }> = ({
  nodeIdsKey,
  nodeIds,
}) => {
  const updateNodeInternals = useUpdateNodeInternals();
  const idsRef = useRef(nodeIds);
  idsRef.current = nodeIds;
  useEffect(() => {
    if (!idsRef.current.length) return;
    // Re-measure after the nodes are actually laid out in the DOM. A single rAF
    // fires too early (dimensions not yet recorded → edges stay hidden), so retry
    // across a few frames/timeouts until ReactFlow has measured them.
    const timers = [60, 250, 600, 1200].map((ms) =>
      window.setTimeout(() => idsRef.current.forEach((id) => updateNodeInternals(id)), ms)
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
    // Keyed on the node-id set so it fires on hydrate / structural changes, not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeIdsKey]);
  return null;
};

// ── Validation ───────────────────────────────────────────────────────────────
// validateFlow (warnings list) extracted to ./processflow/validateFlow
// (validateFlowWarnings) — same rule set, now shared with useProcessFlowValidation.

// LaneBackground replaced by LaneSystem import (./processflow/LaneSystem)
// Undo/Redo replaced by useProcessFlowUndoRedo hook (./processflow/useProcessFlowUndoRedo)

// ── Auto-layout with dagre ───────────────────────────────────────────────────

function autoLayout(nodes: Node[], edges: Edge[], lanes: Lane[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 120, marginx: 40, marginy: 40 });

  for (const node of nodes) {
    g.setNode(node.id, { width: 160, height: 48 });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const laneMap = new Map(lanes.map((l, i) => [l.id, i]));

  return nodes.map((node) => {
    const pos = g.node(node.id);
    if (!pos) return node;
    const laneIdx = laneMap.get(node.data?.laneId) ?? 0;
    const yInLane = laneIdx * LANE_HEIGHT + LANE_HEIGHT / 2 - 24;
    return {
      ...node,
      position: { x: pos.x - 80, y: yInLane },
    };
  });
}

// ── Main component ───────────────────────────────────────────────────────────

interface IdeaProcessFlowToolProps {
  open: boolean;
  ideaId: string;
  locked?: boolean;
  refreshToken?: number;
  onSaved?: () => void;
  onSelectionChange?: (sel: IdeaWorkspaceSelection) => void;
  onNodeDetail?: (nodeId: string, data: any) => void;
  focusMode?: 'system' | 'object' | null;
  focusObjectId?: string | null;
  onFullscreenToggle?: () => void;
  isFullscreen?: boolean;
  onOpenChat?: (prefill?: string) => void;
  onQuickAction?: (action: string, detail?: Record<string, any>) => void;
  onGraphChange?: (graph: {
    nodes: any[];
    edges: any[];
    extensions?: Record<string, unknown>;
  }) => void;
  /** M07 F4: shared workspace graph runtime. When supplied, persistence is
   *  delegated to it (one runtime per ideaId across tools). When absent, the
   *  adapter falls back to the legacy per-tool useIdeaMapSync. */
  externalRuntime?: ProcessFlowExternalRuntime;
}

export const IdeaProcessFlowTool: React.FC<IdeaProcessFlowToolProps> = ({
  open,
  ideaId,
  locked = false,
  refreshToken,
  onSaved,
  onSelectionChange,
  onNodeDetail,
  focusMode,
  focusObjectId,
  onFullscreenToggle: externalOnFullscreenToggle,
  isFullscreen: externalIsFullscreen,
  onOpenChat,
  onQuickAction,
  onGraphChange,
  externalRuntime,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const currentUser = useAppStore((state) => state.currentUser);
  const isDarkFlow = useIsDark();
  const { dialog: bulkDeleteDialog, confirm: confirmBulkDelete } = useConfirmDialog();

  // Start loading=true so the autosave effect (gated on !loading) cannot fire with
  // the initial empty state before hydrate runs. With the old default (false), a
  // slow hydrate (>2.5s autosave debounce) let an EMPTY payload flush first, which
  // overwrote the idea's saved nodes/edges and 409'd the real save. (M07 2026-06-20)
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [lanes, setLanes] = useState<Lane[]>(DEFAULT_LANES);
  const [extensions, setExtensions] = useState<Record<string, unknown>>({});
  const [warnings, setWarnings] = useState<ValidationWarning[]>([]);

  useEffect(() => {
    onGraphChange?.({
      nodes: nodes as any[],
      edges: edges as any[],
      extensions: {
        ...extensions,
        processFlow: {
          ...(extensions?.processFlow && typeof extensions.processFlow === 'object'
            ? extensions.processFlow
            : {}),
          lanes,
        },
      },
    });
  }, [edges, extensions, lanes, nodes, onGraphChange]);
  const [showWarnings, setShowWarnings] = useState(false);
  const [coachInsights, setCoachInsights] = useState<any[]>([]);
  const [showCoach, setShowCoach] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);
  const [ghostNodes, setGhostNodes] = useState<Node[]>([]);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showKPIDashboard, setShowKPIDashboard] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  // M07 F5b B1: real grid/snap view-state (previously a hardcoded stub that
  // was written on save but never reflected actual UI state or restored).
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGridEnabled, setSnapToGridEnabled] = useState(true);
  const [savedViewport, setSavedViewport] = useState<{ x: number; y: number; zoom: number } | null>(
    null
  );
  // Viewport read from the persisted blob/localStorage during hydrate, applied
  // to the live ReactFlow instance once it mounts (see onInit below).
  const pendingViewportRef = useRef<{ x: number; y: number; zoom: number } | null>(null);
  const flowContainerRef = useRef<HTMLDivElement>(null);
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);

  const toggleInternalFullscreen = useCallback(() => {
    if (!flowContainerRef.current) return;
    if (!document.fullscreenElement) {
      flowContainerRef.current
        .requestFullscreen?.()
        .then(() => setInternalFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen?.()
        .then(() => setInternalFullscreen(false))
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (externalOnFullscreenToggle) return;
    const handler = () => setInternalFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, [externalOnFullscreenToggle]);

  const onFullscreenToggle = externalOnFullscreenToggle ?? toggleInternalFullscreen;
  const isFullscreen = externalOnFullscreenToggle ? externalIsFullscreen : internalFullscreen;

  const [metricsEditorNodeId, setMetricsEditorNodeId] = useState<string | null>(null);
  const [metricsDraft, setMetricsDraft] = useState<Record<string, string>>({});
  const [savingsLoading, setSavingsLoading] = useState(false);
  const [dragOverLaneId, setDragOverLaneId] = useState<string | null>(null);
  // M07 F4: `hydrate` is defined below; the persistence adapter's onExternalChange
  // (peer save / conflict) needs it, so route through a ref to avoid TDZ.
  const hydrateRef = useRef<() => void>(() => {});
  const {
    saving,
    syncState,
    lastSavedAt,
    save: persistSave,
    scheduleSave,
    primeServerVersion,
  } = useProcessFlowPersistence({
    ideaId,
    open,
    locked,
    externalRuntime,
    onExternalChange: () => hydrateRef.current(),
  });

  // V5-IDEA-21: Flow mode
  const [flowMode, setFlowMode] = useState<ProcessFlowMode>('classic');
  const [semanticKit, setSemanticKit] = useState<ProcessFlowSemanticKit>('classic');
  const availableShapes = SHAPES_BY_SEMANTIC_KIT[semanticKit] || SHAPES_BY_MODE[flowMode];

  // V5-IDEA-23: Dynamic node types — use rich VSM nodes in VSM mode
  const nodeTypes = useMemo<RFNodeTypes>(
    () => (flowMode === 'vsm' ? { ...baseNodeTypes, ...vsmNodeTypes } : baseNodeTypes),
    [flowMode]
  );

  // ── New hooks: validation, AI proposal, readback, export ────────────────
  // Client-side since DP-7 (V8 process-flow routes cut) — no fetch involved.
  const processId = ideaId;
  const {
    result: validationResult,
    isValidating: isBackendValidating,
    validate: runBackendValidation,
    issuesForObject,
  } = useProcessFlowValidation({
    processId,
    nodes,
    edges,
    semanticKit,
    autoValidate: false,
    onError: (message) =>
      toast.error(isPl ? 'Walidacja przepływu nie powiodła się. Spróbuj ponownie.' : message),
  });
  // (M07 F2: useProcessFlowAIProposal moved below useProcessFlowUndoRedo —
  // its onApply handler needs pushUndo for the single-undo-step acceptance.)
  const {
    result: readbackResult,
    isLoading: isReadbackLoading,
    fetchReadback,
  } = useProcessFlowReadback({ processId, nodes, edges, lanes, isPl: !!isPl });
  const { isExporting, exportAs } = useProcessFlowExport({
    processId,
    canvasRef: flowContainerRef as React.RefObject<HTMLDivElement | null>,
    nodes,
    edges,
    lanes,
    flowMode,
    semanticKit,
    isPl: !!isPl,
  });

  // ── New UI state: panels, context menu, export dialog ─────────────────
  const [showValidationPanel, setShowValidationPanel] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showReadbackPanel, setShowReadbackPanel] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showPropertiesPanel, setShowPropertiesPanel] = useState(false);
  // M07 F5b B3: node comment threads — comments live in `node.data.comments[]`
  // and ride the existing graph blob (no new API, no F4 save-layer change).
  const [commentsPanelNodeId, setCommentsPanelNodeId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId?: string;
    edgeId?: string;
  } | null>(null);

  const didPersistRef = useRef(false);
  const selectedNodeId = useMemo(() => nodes.find((node) => node.selected)?.id ?? null, [nodes]);
  const selectedNodeIds = useMemo(
    () => nodes.filter((node) => node.selected).map((node) => node.id),
    [nodes]
  );
  const selectedNode = useMemo(() => nodes.find((node) => node.selected) ?? null, [nodes]);
  const selectedEdge = useMemo(() => (edges as Edge[]).find((e) => e.selected) ?? null, [edges]);
  const metricsEditorNode = useMemo(
    () => nodes.find((node) => node.id === metricsEditorNodeId) || null,
    [metricsEditorNodeId, nodes]
  );
  const processBriefData = useMemo(() => {
    const pf = extensions?.processFlow;
    return pf && typeof pf === 'object' ? (pf as Record<string, any>).processBrief || null : null;
  }, [extensions]);
  const savingsAnalysisData = useMemo(() => {
    const pf = extensions?.processFlow;
    return pf && typeof pf === 'object'
      ? (pf as Record<string, any>).savingsAnalysis || null
      : null;
  }, [extensions]);
  const currentUserName = useMemo(() => {
    const fullName = [currentUser?.firstName, currentUser?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return fullName || currentUser?.email || (isPl ? 'Ty' : 'You');
  }, [currentUser?.email, currentUser?.firstName, currentUser?.lastName, isPl]);
  const saveStatusLabel = useMemo(
    () => formatIdeaMapSyncLabel(syncState, lastSavedAt, isPl),
    [isPl, lastSavedAt, syncState]
  );
  const buildPersistPayload = useCallback(() => {
    // M07 F5b B1 (bug L-04): persist the REAL grid/snap/viewport state
    // instead of the previous hardcoded stub, so hydration can restore it.
    const currentViewport = reactFlowInstanceRef.current?.getViewport?.() ?? null;
    if (currentViewport) {
      try {
        localStorage.setItem(
          processFlowViewportStorageKey(ideaId),
          JSON.stringify(currentViewport)
        );
      } catch {
        /* ignore (private mode / disabled storage) */
      }
    }
    return {
      nodes: nodes as any,
      edges: edges as any,
      preferredTool: 'process_flow' as CanvasToolType,
      extensions: {
        ...extensions,
        processFlow: {
          ...(extensions?.processFlow && typeof extensions.processFlow === 'object'
            ? extensions.processFlow
            : {}),
          lanes,
          flowMode,
          semanticKit,
          viewState: {
            layoutMode: 'horizontal' as const,
            showGrid,
            snap: snapToGridEnabled,
            ...(currentViewport ? { viewport: currentViewport } : {}),
          },
        },
      },
    };
  }, [edges, extensions, flowMode, ideaId, lanes, nodes, semanticKit, showGrid, snapToGridEnabled]);

  useEffect(() => {
    if (flowMode === 'classic' || flowMode === 'automation' || flowMode === 'vsm') {
      setSemanticKit((prev) =>
        prev === 'bpmn' || prev === 'system' || prev === 'org' ? prev : flowMode
      );
    }
  }, [flowMode]);

  // ── Undo/Redo (via extracted hook) ──────────────────────────────────
  const {
    pushUndo,
    undo: undoRaw,
    redo: redoRaw,
    resetUndo,
    canUndo,
    canRedo,
    undoRedoTick,
  } = useProcessFlowUndoRedo({
    nodes,
    edges,
    lanes,
    setNodes,
    setEdges,
    setLanes,
  });
  const dragSnapshotTakenRef = useRef(false);
  // Latest state mirror — lets undo/redo (which setState async) read the just-
  // restored snapshot on the next tick to broadcast it as a graph_snapshot.
  const latestStateRef = useRef({ nodes, edges, lanes });
  useEffect(() => {
    latestStateRef.current = { nodes, edges, lanes };
  }, [nodes, edges, lanes]);

  // ── M07 F3: realtime edit-sync (org-scoped WS, mirrors whiteboard model) ──
  // Origin of the last state change: 'remote' means a peer's patch produced it,
  // so the autosave effect must NOT re-persist it (the author persists via its
  // own runtime). The collab receive handler flips this to 'remote' before
  // mutating; the scheduleSave effect below resets it to 'local'.
  const lastChangeOriginRef = useRef<ChangeOrigin>('local');
  const collab = useProcessFlowCollab({
    currentUserId: currentUser?.id || 'anonymous',
    setNodes,
    setEdges,
    setLanes,
    lastChangeOriginRef,
    // A peer's mass change (graph_snapshot) — record the CURRENT state as one
    // undo step before it is overwritten, so the local user can consciously
    // undo a collaborator's bulk change.
    onRemoteSnapshot: () => {
      pushUndo();
    },
  });
  const lockedByOthers = collab.lockedByOthers;

  // Undo/redo restore the whole state → mass change → emit graph_snapshot. The
  // hook applies via setState, so we read the settled state on the next tick.
  const undo = useCallback(() => {
    undoRaw();
    setTimeout(() => collab.broadcastSnapshot(latestStateRef.current), 0);
  }, [collab, undoRaw]);
  const redo = useCallback(() => {
    redoRaw();
    setTimeout(() => collab.broadcastSnapshot(latestStateRef.current), 0);
  }, [collab, redoRaw]);

  // ── M07 F2: AI proposal (real backend via /my-ideas/:id/ai-generate) ────
  // Decision 5: accepting a proposal applies the whole patch as ONE undo
  // step, then persists via the autosave effect (scheduleSave fires from the
  // nodes/edges/lanes → buildPersistPayload → scheduleSave effect below).
  const handleApplyAIProposal = useCallback(
    (result: ApplyPatchResult) => {
      if (locked) return;
      pushUndo();
      const added = new Set(result.addedNodeIds);
      setNodes(
        result.nodes.map((n) =>
          added.has(String(n.id))
            ? {
                ...n,
                data: {
                  ...n.data,
                  locked,
                  onLabelChange: (next: string) => {
                    setNodes((nds: Node[]) =>
                      nds.map((x: Node) =>
                        x.id === n.id ? { ...x, data: { ...x.data, label: next } } : x
                      )
                    );
                  },
                  onNodeDetail: onNodeDetail || undefined,
                },
              }
            : n
        )
      );
      setEdges(result.edges);
      setLanes(result.lanes);
      // F3: AI-accept is a mass change — emit the full state as a snapshot so
      // peers converge without a per-node diff (Decision 5 + F3 spec §Snapshot).
      collab.broadcastSnapshot({
        nodes: result.nodes,
        edges: result.edges,
        lanes: result.lanes,
      });
      toast.success(isPl ? 'Zastosowano propozycję AI' : 'AI proposal applied', {
        duration: 1200,
      });
    },
    [collab, isPl, locked, onNodeDetail, pushUndo, setEdges, setNodes]
  );

  const {
    activeProposal,
    isGenerating: isAIGenerating,
    error: aiError,
    createProposal,
    resolveProposal,
    dismiss: dismissProposal,
  } = useProcessFlowAIProposal({
    ideaId,
    nodes,
    edges,
    lanes,
    semanticKit,
    isPl: !!isPl,
    language: i18n.language,
    selectedNodeIds,
    onApply: handleApplyAIProposal,
  });

  // ── Selection tracking ─────────────────────────────────────────────────
  const handleSelectionUpdate = useCallback(
    (nds: Node[]) => {
      const selected = nds.filter((n: Node) => n.selected);
      if (selected.length === 0) {
        onSelectionChange?.(EMPTY_SELECTION);
      } else {
        const primary = selected[0];
        onSelectionChange?.({
          type: 'node',
          count: selected.length,
          ids: selected.map((n: Node) => n.id),
          primaryId: primary?.id,
          meta: {
            nodeType: primary?.type,
            shape: primary?.data?.shape,
            laneId: primary?.data?.laneId,
            label: primary?.data?.label,
            description: primary?.data?.description,
            owner: primary?.data?.owner,
            duration: primary?.data?.duration,
            durationUnit: primary?.data?.durationUnit,
            cost: primary?.data?.cost,
            fteCount: primary?.data?.fteCount,
            status: primary?.data?.status,
            tags: primary?.data?.tags,
            artifactRef: primary?.data?.artifactRef,
            attachments: primary?.data?.attachments,
          },
        });
      }
    },
    [onSelectionChange]
  );

  // ── Edge label/condition change handlers ───────────────────────────────
  const handleEdgeLabelChange = useCallback(
    (edgeId: string, newLabel: string) => {
      if (locked) return;
      pushUndo();
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== edgeId) return e;
          const nextEdge = { ...e, label: newLabel, data: { ...e.data, label: newLabel } };
          collab.broadcastEdgeUpdate(nextEdge);
          return nextEdge;
        })
      );
    },
    [collab, locked, pushUndo]
  );

  const handleEdgeConditionChange = useCallback(
    (edgeId: string, conditionType: string) => {
      if (locked) return;
      pushUndo();
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== edgeId) return e;
          const nextEdge = { ...e, data: { ...e.data, conditionType } };
          collab.broadcastEdgeUpdate(nextEdge);
          return nextEdge;
        })
      );
    },
    [collab, locked, pushUndo]
  );

  // ── F5a A1: waypoint editing ───────────────────────────────────────────
  // Waypoints live in edge.data.waypoints[] and persist through the existing
  // graph blob (edges in the payload) — no persistence-layer change (F4 stands).
  const screenToFlow = useCallback((clientX: number, clientY: number) => {
    const inst = reactFlowInstanceRef.current as any;
    if (inst?.screenToFlowPosition) return inst.screenToFlowPosition({ x: clientX, y: clientY });
    if (inst?.project) {
      const rect = flowContainerRef.current?.getBoundingClientRect();
      return inst.project({ x: clientX - (rect?.left || 0), y: clientY - (rect?.top || 0) });
    }
    return { x: clientX, y: clientY };
  }, []);

  const handleEdgeAddWaypoint = useCallback(
    (edgeId: string, info: { clientX: number; clientY: number }) => {
      if (locked) return;
      const pos = screenToFlow(info.clientX, info.clientY);
      pushUndo();
      setEdges((prev) =>
        prev.map((e) => {
          if (e.id !== edgeId) return e;
          const existing = Array.isArray(e.data?.waypoints) ? e.data.waypoints : [];
          const nextEdge = {
            ...e,
            data: {
              ...e.data,
              orthogonal: true,
              waypoints: [...existing, { x: pos.x, y: pos.y }],
            },
          };
          collab.broadcastEdgeUpdate(nextEdge);
          return nextEdge;
        })
      );
    },
    [collab, locked, pushUndo, screenToFlow]
  );

  const handleEdgeWaypointDrag = useCallback(
    (edgeId: string, index: number, ev: React.PointerEvent) => {
      if (locked) return;
      ev.preventDefault();
      let moved = false;
      const onMove = (moveEv: PointerEvent) => {
        const pos = screenToFlow(moveEv.clientX, moveEv.clientY);
        if (!moved) {
          moved = true;
          pushUndo();
        }
        setEdges((prev) =>
          prev.map((e) => {
            if (e.id !== edgeId) return e;
            const wps = Array.isArray(e.data?.waypoints) ? [...e.data.waypoints] : [];
            if (!wps[index]) return e;
            wps[index] = { x: pos.x, y: pos.y };
            return { ...e, data: { ...e.data, waypoints: wps } };
          })
        );
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        // Broadcast the committed edge once, at drag end (avoids flooding peers).
        setEdges((prev) => {
          const edge = prev.find((e) => e.id === edgeId);
          if (edge) collab.broadcastEdgeUpdate(edge);
          return prev;
        });
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [collab, locked, pushUndo, screenToFlow]
  );

  const handleEdgeRemoveWaypoint = useCallback(
    (edgeId: string, index: number) => {
      if (locked) return;
      pushUndo();
      setEdges((prev) =>
        prev.map((e) => {
          if (e.id !== edgeId) return e;
          const wps = Array.isArray(e.data?.waypoints) ? [...e.data.waypoints] : [];
          wps.splice(index, 1);
          const nextEdge = { ...e, data: { ...e.data, waypoints: wps } };
          collab.broadcastEdgeUpdate(nextEdge);
          return nextEdge;
        })
      );
    },
    [collab, locked, pushUndo]
  );

  // ── Inject edge handlers into edge data ────────────────────────────────
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const edgesWithHandlers = useMemo(
    () =>
      edges.map((e) => {
        const sourceNode = nodeMap.get(e.source);
        return {
          ...e,
          type: 'flowEdge',
          data: {
            ...e.data,
            sourceLaneColor: sourceNode?.data?.laneColor,
            locked,
            onLabelChange: handleEdgeLabelChange,
            onConditionChange: handleEdgeConditionChange,
            onAddWaypoint: handleEdgeAddWaypoint,
            onWaypointDrag: handleEdgeWaypointDrag,
            onRemoveWaypoint: handleEdgeRemoveWaypoint,
          },
        };
      }),
    [
      edges,
      nodeMap,
      locked,
      handleEdgeLabelChange,
      handleEdgeConditionChange,
      handleEdgeAddWaypoint,
      handleEdgeWaypointDrag,
      handleEdgeRemoveWaypoint,
    ]
  );

  // ── Focus mode: filter nodes/edges for display ──────────────────────────
  const { filteredNodes, filteredEdgesWithHandlers, filteredGhostNodes } = useMemo(() => {
    const noFilter =
      !focusMode || focusMode === 'system' || (focusMode === 'object' && !focusObjectId);

    if (noFilter) {
      return {
        filteredNodes: nodes,
        filteredEdgesWithHandlers: edgesWithHandlers,
        filteredGhostNodes: ghostNodes,
      };
    }

    // focusMode === 'object' && focusObjectId is set
    const focusNode = nodes.find((n) => n.id === focusObjectId);
    const laneId = focusNode?.data?.laneId;
    if (!laneId) {
      return {
        filteredNodes: nodes,
        filteredEdgesWithHandlers: edgesWithHandlers,
        filteredGhostNodes: ghostNodes,
      };
    }

    const laneNodes = nodes.filter((n) => n.data?.laneId === laneId);
    const filteredIds = new Set(laneNodes.map((n) => n.id));
    const filteredEdges = edgesWithHandlers.filter(
      (e) => filteredIds.has(e.source) && filteredIds.has(e.target)
    );
    const filteredGhosts = ghostNodes.filter((g) => g.data?.laneId === laneId);

    return {
      filteredNodes: laneNodes,
      filteredEdgesWithHandlers: filteredEdges,
      filteredGhostNodes: filteredGhosts,
    };
  }, [nodes, ghostNodes, edgesWithHandlers, focusMode, focusObjectId]);

  // ── F3 soft locks: nodes locked by other collaborators are non-draggable
  // and get a subtle advisory ring + locker avatar. Tokens only (var(--c-*));
  // ZERO new colors per Piotr's visual-acceptance protocol. Server does not
  // enforce these (advisory) — accepted per F3 spec §Locki.
  const displayNodes = useMemo(() => {
    // F5a A3: hide nodes whose lane is collapsed.
    const anyCollapsed = lanes.some((l) => l.collapsed);
    const visible = anyCollapsed
      ? filteredNodes.filter((n) => !isNodeInCollapsedLane(n.data?.laneId, lanes))
      : filteredNodes;
    if (lockedByOthers.size === 0) return visible;
    return visible.map((n) => {
      if (!lockedByOthers.has(n.id)) return n;
      return {
        ...n,
        draggable: false,
        style: {
          ...(n.style || {}),
          outline: '2px solid var(--c-info)',
          outlineOffset: '2px',
          borderRadius: '10px',
        },
        data: { ...n.data, _lockedByOther: true, locked: true },
      };
    });
  }, [filteredNodes, lockedByOthers, lanes]);

  // ── Node/Edge change handlers ──────────────────────────────────────────
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const startedDragging = changes.some(
        (c: NodeChange) => c.type === 'position' && (c as any).dragging === true
      );
      const finishedDragging = changes.some(
        (c: NodeChange) => c.type === 'position' && (c as any).dragging === false
      );
      if (startedDragging && !dragSnapshotTakenRef.current) {
        pushUndo();
        dragSnapshotTakenRef.current = true;
      }
      if (finishedDragging) {
        dragSnapshotTakenRef.current = false;
      }
      setNodes((nds) => {
        const next = applyNodeChanges(changes, nds);
        const hasSelectionChange = changes.some((c: NodeChange) => c.type === 'select');
        if (hasSelectionChange) handleSelectionUpdate(next);

        // Drag between lanes: update laneId based on Y position
        const posChanges = changes.filter(
          (c: NodeChange) => c.type === 'position' && (c as any).dragging === false
        );
        if (posChanges.length > 0) {
          const updated = next.map((n: Node) => {
            const posChange = posChanges.find((c: NodeChange) => (c as any).id === n.id);
            if (!posChange) return n;
            const laneIdx = Math.max(
              0,
              Math.min(lanes.length - 1, Math.floor(n.position.y / LANE_HEIGHT))
            );
            const targetLane = lanes[laneIdx];
            if (targetLane && n.data?.laneId !== targetLane.id) {
              return {
                ...n,
                data: { ...n.data, laneId: targetLane.id, laneColor: targetLane.color },
              };
            }
            return n;
          });
          // F3: broadcast final positions (+ cross-lane laneId in node.data) and
          // any removals from this batch. `updated` carries the resolved state.
          collab.broadcastNodeChanges(changes, updated);
          return updated;
        }

        // Removals (delete via React Flow) with no accompanying position change.
        if (changes.some((c: NodeChange) => c.type === 'remove')) {
          collab.broadcastNodeChanges(changes, next);
        }

        // Live drag: show target lane highlight
        const dragging = changes.filter(
          (c: NodeChange) => c.type === 'position' && (c as any).dragging === true
        );
        if (dragging.length > 0) {
          const dragNode = next.find((n: Node) => n.id === (dragging[0] as any).id);
          if (dragNode) {
            const laneIdx = Math.max(
              0,
              Math.min(lanes.length - 1, Math.floor(dragNode.position.y / LANE_HEIGHT))
            );
            const targetLane = lanes[laneIdx];
            setDragOverLaneId(targetLane?.id || null);
          }
        } else {
          setDragOverLaneId(null);
        }

        return next;
      });
    },
    [collab, handleSelectionUpdate, lanes, pushUndo]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const mutating = changes.some((change) => change.type !== 'select');
      if (mutating) pushUndo();
      // F3: propagate edge removals (add/update flow through their own handlers).
      collab.broadcastEdgeChanges(changes);
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [collab, pushUndo]
  );

  // ── Hydrate ────────────────────────────────────────────────────────────

  // M07 F4: keep a stable ref to the runtime graph so hydrate (in runtime mode)
  // reads the latest snapshot without re-creating its identity every save cycle.
  const externalRuntimeRef = useRef(externalRuntime);
  externalRuntimeRef.current = externalRuntime;

  const hydrate = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setLoadError(null);
    try {
      // M07 F4: in runtime mode read from the shared workspace graph runtime
      // instead of a second Api.getMyIdeaMap round-trip. The runtime is the
      // single owner of hydration for this ideaId; the parent's refresh() primes
      // it. Fallback (no runtime) keeps the legacy per-tool API path — with the
      // M07 reload-race fix (2026-06-24) preserved on that path.
      const runtime = externalRuntimeRef.current;
      let map: any;
      if (runtime) {
        map = {
          version: runtime.version,
          nodes: Array.isArray(runtime.nodes) ? runtime.nodes : [],
          edges: Array.isArray(runtime.edges) ? runtime.edges : [],
          extensions:
            runtime.extensions && typeof runtime.extensions === 'object' ? runtime.extensions : {},
          // Runtime does not carry preferredTool; skip the preferred-tool
          // back-write below (the workspace runtime owns preferredTool).
          preferredTool: 'process_flow',
        };
      } else {
        // M07 reload-race fix (2026-06-24): retry the map GET on transient failure.
        // The nodes ARE on the server (the autosave already landed — useIdeaMapSync is
        // single-flight + 409-self-healing), so a reload that lands during caboose
        // latency / cold-start must NOT blank the canvas to [] on the first timeout
        // (that was the "0 nodes after reload" symptom). Fetch-with-backoff, then hydrate.
        let res: any = null;
        let lastErr: any = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            res = await Api.getMyIdeaMap(ideaId, { language: i18n.language });
            lastErr = null;
            break;
          } catch (e) {
            lastErr = e;
            if (attempt < 2) {
              await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
            }
          }
        }
        if (lastErr) throw lastErr;
        const hydration = resolveIdeaMapHydration(ideaId, res?.map || {});
        map = hydration.map || {};
      }
      primeServerVersion(Number(map?.version || 1));
      const rawNodes = Array.isArray(map.nodes) ? (map.nodes as any[]) : [];
      const rawEdges = Array.isArray(map.edges) ? (map.edges as any[]) : [];
      const rawExt =
        map?.extensions && typeof map.extensions === 'object'
          ? (map.extensions as Record<string, unknown>)
          : {};

      const pfExt = (rawExt?.processFlow || {}) as Record<string, unknown>;
      const savedLanes = Array.isArray(pfExt?.lanes) ? (pfExt.lanes as Lane[]) : DEFAULT_LANES;
      setLanes(savedLanes);

      // V5-IDEA-21: Restore flow mode
      const savedMode = pfExt?.flowMode;
      if (savedMode === 'classic' || savedMode === 'automation' || savedMode === 'vsm') {
        setFlowMode(savedMode);
      }
      const savedSemantic = pfExt?.semanticKit;
      if (
        savedSemantic === 'classic' ||
        savedSemantic === 'automation' ||
        savedSemantic === 'vsm' ||
        savedSemantic === 'bpmn' ||
        savedSemantic === 'system' ||
        savedSemantic === 'org'
      ) {
        setSemanticKit(savedSemantic);
      }

      // M07 F5b B1 (bug L-04): viewState was written on every save but never
      // read back — restore the user's own grid/snap/viewport prefs here.
      // The viewport itself needs the live ReactFlow instance (not mounted
      // yet on first hydrate), so stash it and apply post-mount below.
      const restoredViewState = normalizeProcessFlowViewState(pfExt?.viewState);
      setShowGrid(restoredViewState.showGrid);
      setSnapToGridEnabled(restoredViewState.snap);
      let localViewportRaw: string | null = null;
      try {
        localViewportRaw = localStorage.getItem(processFlowViewportStorageKey(ideaId));
      } catch {
        /* ignore (private mode / disabled storage) */
      }
      const resolvedViewport = resolveHydrationViewport(
        restoredViewState.viewport,
        localViewportRaw
      );
      pendingViewportRef.current = resolvedViewport;
      setSavedViewport(resolvedViewport);

      const hydratedNodes = rawNodes
        .filter((n: any) => n?.id)
        .map((n: any) => {
          const normalizedNode = withNormalizedArtifactLinks(n);
          const nid = String(normalizedNode.id);
          return {
            id: nid,
            type: normalizedNode?.type || 'flowNode',
            position: normalizedNode?.position || { x: 100, y: 100 },
            // Preserve persisted dimensions. ReactFlow only draws an edge once BOTH
            // endpoint nodes have width/height in its store; on hydrate it does not
            // re-measure reliably, so dropping these left reloaded edges invisible.
            ...(Number.isFinite(normalizedNode?.width) ? { width: normalizedNode.width } : {}),
            ...(Number.isFinite(normalizedNode?.height) ? { height: normalizedNode.height } : {}),
            data: {
              ...(normalizedNode?.data || { label: '', shape: 'action' }),
              locked,
              onLabelChange: (next: string) => {
                setNodes((nds: Node[]) =>
                  nds.map((nd: Node) =>
                    nd.id === nid ? { ...nd, data: { ...nd.data, label: next } } : nd
                  )
                );
              },
              onNodeDetail: onNodeDetail || undefined,
            },
          };
        });
      setNodes(hydratedNodes);
      setEdges(
        rawEdges
          .filter((e: any) => e?.id && e?.source && e?.target)
          .map((e: any) => ({
            id: String(e.id),
            source: String(e.source),
            target: String(e.target),
            type: 'flowEdge',
            animated: Boolean(e?.animated),
            label: e?.label || e?.data?.label || '',
            data: e?.data || {},
          }))
      );
      setExtensions(rawExt);

      resetUndo();

      // NOTE (M07 fix 2026-06-21 + F4): the old eager preferredTool stamp here did a SECOND,
      // independent `Api.syncMyIdeaMap` on hydrate — carrying the just-loaded (often empty)
      // graph with its own baseVersion. It raced the user's first autosave on the same
      // baseVersion → one 200, the other 409, and the user's freshly-added nodes were dropped
      // (data loss after reload). Removed: the autosave already stamps
      // `preferredTool: 'process_flow'` (buildPersistPayload) on the first edit, so the only
      // cost is that an idea OPENED-but-not-edited won't persist process_flow as its default —
      // and the /workspace/process_flow URL already forces the tool on open. In runtime mode
      // the shared workspace runtime owns preferredTool anyway. One sync path = no race.
      didPersistRef.current = true;
    } catch (err: any) {
      const nextError = err?.message || (isPl ? 'Nie udało się wczytać' : 'Failed to load');
      toast.error(nextError);
      setLoadError(nextError);
      setNodes([]);
      setEdges([]);
      setExtensions({});
      setLanes(DEFAULT_LANES);
    } finally {
      setLoading(false);
    }
  }, [i18n.language, ideaId, isPl, locked, open, setEdges, setNodes]);

  // Keep the ref current so the persistence adapter's onExternalChange (peer
  // save / conflict) can re-hydrate without a TDZ on `hydrate`.
  hydrateRef.current = hydrate;

  useEffect(() => {
    if (!open) return;
    didPersistRef.current = false;
    hydrate();
  }, [hydrate, open, refreshToken]);

  // ── Connections ────────────────────────────────────────────────────────

  const onConnect = useCallback(
    (connection: Connection) => {
      if (locked) return;
      pushUndo();
      setEdges((eds: Edge[]) => {
        const nextEdges = addEdge(
          {
            ...connection,
            type: 'flowEdge',
            animated: false,
            data: {},
          },
          eds
        );
        // F3: the new edge is the one addEdge appended that wasn't in eds.
        const prevIds = new Set(eds.map((e) => e.id));
        const added = (nextEdges as Edge[]).filter((e: Edge) => !prevIds.has(e.id));
        if (added.length > 0) collab.broadcastEdgeAdd(added);
        return nextEdges;
      });
    },
    [collab, locked, pushUndo, setEdges]
  );

  // ── Add node ───────────────────────────────────────────────────────────

  const addNode = useCallback(
    (
      shape: FlowShape,
      overrides?: {
        label?: string;
        position?: { x: number; y: number };
        data?: Record<string, unknown>;
      }
    ) => {
      if (locked) return;
      pushUndo();
      const lane = lanes[0] || DEFAULT_LANES[0];
      const id = `pf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const yBase = 60 + lanes.indexOf(lane) * LANE_HEIGHT;
      const xBase = 100 + nodes.filter((n: Node) => n.data?.laneId === lane.id).length * 200;

      // V5-IDEA-23: Use rich VSM node type when in VSM mode
      const isVsmShape = shape.startsWith('vsm_');
      const resolvedType = flowMode === 'vsm' && isVsmShape ? shape : 'flowNode';

      const newNode: Node = {
        id,
        type: resolvedType,
        position: overrides?.position || { x: xBase, y: yBase },
        data: {
          label:
            overrides?.label || (isPl ? SHAPE_CONFIG[shape].labelPl : SHAPE_CONFIG[shape].label),
          shape,
          laneId: lane.id,
          laneColor: lane.color,
          locked,
          semanticKit,
          onLabelChange: (next: string) => {
            setNodes((nds: Node[]) =>
              nds.map((n: Node) => (n.id === id ? { ...n, data: { ...n.data, label: next } } : n))
            );
          },
          onNodeDetail: onNodeDetail || undefined,
          ...(overrides?.data || {}),
        },
      };
      setNodes((prev: Node[]) => [...prev, newNode]);
      collab.broadcastNodeAdd(newNode); // F3: realtime add

      // Ghost nodes: AI suggests next steps
      if (!locked && shape !== 'end') {
        (async () => {
          try {
            const { generateAIProposal } = await import('@/services/ideaAIGenerator');
            const result = await generateAIProposal({
              ideaId,
              generatorType: 'next_step',
              tool: 'process_flow',
              context: {
                seedText: `Added step: ${isPl ? SHAPE_CONFIG[shape].labelPl : SHAPE_CONFIG[shape].label}`,
                title: '',
                existingNodes: [...nodes, newNode].map((n: Node) => ({
                  id: n.id,
                  data: { label: n.data?.label, shape: n.data?.shape },
                })),
                existingEdges: edges as any[],
                language: i18n.language || 'en',
              },
            });
            const steps = result?.proposals?.[0]?.patch?.addNodes || [];
            if (steps.length > 0) {
              const ghosts: Node[] = steps.slice(0, 3).map((s: any, i: number) => ({
                id: `ghost-${Date.now()}-${i}`,
                type: 'flowNode',
                position: { x: xBase + 200 + i * 180, y: yBase },
                data: {
                  label: s.label || `Step ${i + 1}`,
                  shape: s.data?.shape || 'action',
                  laneId: lane.id,
                  laneColor: lane.color,
                  _isGhost: true,
                  locked: true,
                },
              }));
              setGhostNodes(ghosts);
              setTimeout(() => setGhostNodes([]), 15000);
            }
          } catch {
            /* silent */
          }
        })();
      }
    },
    [
      collab,
      edges,
      i18n.language,
      ideaId,
      isPl,
      lanes,
      locked,
      nodes,
      onNodeDetail,
      pushUndo,
      semanticKit,
      setNodes,
    ]
  );

  // ── V5-IDEA-21: Insert step between two connected nodes ─────────────────
  const insertBetween = useCallback(() => {
    if (locked) return;
    const selectedEdge = (edges as Edge[]).find((e) => e.selected);
    if (!selectedEdge) {
      toast.error(isPl ? 'Zaznacz krawędź' : 'Select an edge first');
      return;
    }
    pushUndo();
    const sourceNode = (nodes as Node[]).find((n) => n.id === selectedEdge.source);
    const targetNode = (nodes as Node[]).find((n) => n.id === selectedEdge.target);
    if (!sourceNode || !targetNode) return;

    const midX = (sourceNode.position.x + targetNode.position.x) / 2;
    const midY = (sourceNode.position.y + targetNode.position.y) / 2;
    const newId = `pf-ins-${Date.now()}`;
    const lane =
      lanes.find((l) => l.id === sourceNode.data?.laneId) || lanes[0] || DEFAULT_LANES[0];

    const insertShape: FlowShape =
      flowMode === 'automation' ? 'auto_api' : flowMode === 'vsm' ? 'vsm_process' : 'action';
    const isVsmShape = insertShape.startsWith('vsm_');
    const resolvedType = flowMode === 'vsm' && isVsmShape ? insertShape : 'flowNode';
    const newNode: Node = {
      id: newId,
      type: resolvedType,
      position: { x: midX, y: midY },
      data: {
        label: isPl ? 'Nowy krok' : 'New step',
        shape: insertShape,
        laneId: lane.id,
        laneColor: lane.color,
        locked,
        onLabelChange: (next: string) => {
          setNodes((nds: Node[]) =>
            nds.map((n: Node) => (n.id === newId ? { ...n, data: { ...n.data, label: next } } : n))
          );
        },
        onNodeDetail: onNodeDetail || undefined,
      },
    };

    const edgeA: Edge = { ...selectedEdge, id: `e-${selectedEdge.source}-${newId}`, target: newId };
    const edgeB: Edge = {
      id: `e-${newId}-${selectedEdge.target}`,
      source: newId,
      target: selectedEdge.target,
      type: 'flowEdge',
      data: {},
    };
    setNodes((prev: Node[]) => [...prev, newNode]);
    setEdges((prev: Edge[]) => {
      const filtered = prev.filter((e) => e.id !== selectedEdge.id);
      return [...filtered, edgeA, edgeB];
    });
    // F3: emit the whole rewire as one batch (add node, drop old edge, add two).
    collab.broadcastOps([
      { op: 'add_node', data: newNode },
      { op: 'remove_edge', data: { id: selectedEdge.id } },
      { op: 'add_edge', data: edgeA },
      { op: 'add_edge', data: edgeB },
    ]);
    toast.success(isPl ? 'Wstawiono krok' : 'Step inserted', { duration: 800 });
  }, [
    collab,
    edges,
    flowMode,
    isPl,
    lanes,
    locked,
    nodes,
    onNodeDetail,
    pushUndo,
    setEdges,
    setNodes,
  ]);

  // ── V5-IDEA-21: Split path (add parallel decision branch) ─────────────
  const splitPath = useCallback(() => {
    if (locked) return;
    const selected = (nodes as Node[]).find(
      (n: Node) => n.selected && n.data?.shape === 'decision'
    );
    if (!selected) {
      toast.error(isPl ? 'Zaznacz decyzję' : 'Select a decision node');
      return;
    }
    pushUndo();
    const newId = `pf-split-${Date.now()}`;
    const lane = lanes.find((l) => l.id === selected.data?.laneId) || lanes[0] || DEFAULT_LANES[0];

    const splitShape: FlowShape =
      flowMode === 'automation' ? 'auto_api' : flowMode === 'vsm' ? 'vsm_process' : 'action';
    const isVsmSplitShape = splitShape.startsWith('vsm_');
    const resolvedSplitType = flowMode === 'vsm' && isVsmSplitShape ? splitShape : 'flowNode';
    const newNode: Node = {
      id: newId,
      type: resolvedSplitType,
      position: { x: selected.position.x + 250, y: selected.position.y + 80 },
      data: {
        label: isPl ? 'Alternatywna ścieżka' : 'Alternative path',
        shape: splitShape,
        laneId: lane.id,
        laneColor: lane.color,
        locked,
        onLabelChange: (next: string) => {
          setNodes((nds: Node[]) =>
            nds.map((n: Node) => (n.id === newId ? { ...n, data: { ...n.data, label: next } } : n))
          );
        },
        onNodeDetail: onNodeDetail || undefined,
      },
    };

    const splitEdge: Edge = {
      id: `e-${selected.id}-${newId}`,
      source: selected.id,
      target: newId,
      type: 'flowEdge',
      data: { conditionType: 'no' },
      label: 'No',
    };
    setNodes((prev: Node[]) => [...prev, newNode]);
    setEdges((prev: Edge[]) => [...prev, splitEdge]);
    // F3: emit the added branch node + its edge as one batch.
    collab.broadcastOps([
      { op: 'add_node', data: newNode },
      { op: 'add_edge', data: splitEdge },
    ]);
    toast.success(isPl ? 'Ścieżka rozdzielona' : 'Path split', { duration: 800 });
  }, [collab, flowMode, isPl, lanes, locked, nodes, onNodeDetail, pushUndo, setEdges, setNodes]);

  // ── Add lane ───────────────────────────────────────────────────────────

  const addLane = useCallback(() => {
    if (locked) return;
    pushUndo();
    const idx = lanes.length;
    const newLane: Lane = {
      id: `lane-${Date.now()}`,
      label: `Lane ${idx + 1}`,
      color: LANE_COLORS[idx % LANE_COLORS.length],
    };
    setLanes((prev: Lane[]) => {
      const nextLanes = [...prev, newLane];
      collab.broadcastLanes(nextLanes); // F3: full Lane[] replacement
      return nextLanes;
    });
  }, [collab, lanes.length, locked, pushUndo]);

  const insertAutomationTrigger = useCallback(() => {
    if (locked) return;
    setFlowMode('automation');
    setSemanticKit('automation');
    addNode('auto_trigger', {
      data: {
        semanticKit: 'automation',
        automationCandidate: true,
        automationPotential: 'high',
      },
    });
  }, [addNode, locked]);

  const openMetricsEditor = useCallback(() => {
    const selected = nodes.find((node) => node.selected);
    if (!selected) {
      toast.error(isPl ? 'Najpierw zaznacz krok procesu' : 'Select a process step first');
      return;
    }
    setMetricsEditorNodeId(selected.id);
    setMetricsDraft({
      duration: selected.data?.duration != null ? String(selected.data.duration) : '',
      durationUnit: selected.data?.durationUnit != null ? String(selected.data.durationUnit) : 'h',
      cost: selected.data?.cost != null ? String(selected.data.cost) : '',
      fteCount: selected.data?.fteCount != null ? String(selected.data.fteCount) : '',
      automationPotential:
        selected.data?.automationPotential != null
          ? String(selected.data.automationPotential)
          : 'medium',
      savingsEstimate:
        selected.data?.savingsEstimate != null ? String(selected.data.savingsEstimate) : '',
    });
  }, [isPl, nodes]);

  const handleSaveMetrics = useCallback(() => {
    if (locked || !metricsEditorNodeId) return;
    pushUndo();
    setNodes((prev) =>
      prev.map((node) => {
        if (node.id !== metricsEditorNodeId) return node;
        const nextNode = {
          ...node,
          data: {
            ...node.data,
            duration: metricsDraft.duration.trim() || undefined,
            durationUnit: metricsDraft.durationUnit.trim() || 'h',
            cost: metricsDraft.cost.trim() ? Number(metricsDraft.cost) : undefined,
            fteCount: metricsDraft.fteCount.trim() ? Number(metricsDraft.fteCount) : undefined,
            automationCandidate: metricsDraft.automationPotential.trim() !== 'low',
            automationPotential: metricsDraft.automationPotential.trim() || undefined,
            savingsEstimate: metricsDraft.savingsEstimate.trim() || undefined,
          },
        };
        collab.broadcastNodeUpdate(nextNode); // F3: metrics edit → update_node
        return nextNode;
      })
    );
    setMetricsEditorNodeId(null);
    toast.success(isPl ? 'Zapisano metryki kroku' : 'Step metrics saved', { duration: 900 });
  }, [collab, isPl, locked, metricsDraft, metricsEditorNodeId, pushUndo]);

  const runSavingsAnalysis = useCallback(async () => {
    if (locked || savingsLoading) return;
    if (nodes.length === 0) {
      toast.error(isPl ? 'Najpierw dodaj kroki procesu' : 'Add process steps first');
      return;
    }
    setSavingsLoading(true);
    try {
      const batch = await generateAIProposal({
        ideaId,
        generatorType: 'process_savings',
        tool: 'process_flow',
        context: {
          seedText: '',
          title: '',
          existingNodes: nodes.map((node) => ({
            id: node.id,
            data: {
              label: node.data?.label,
              shape: node.data?.shape,
              laneId: node.data?.laneId,
              duration: node.data?.duration,
              durationUnit: node.data?.durationUnit,
              cost: node.data?.cost,
              automationCandidate: node.data?.automationCandidate,
              automationPotential: node.data?.automationPotential,
            },
          })),
          existingEdges: edges as any[],
          existingLanes: lanes,
          language: i18n.language || 'en',
        },
      });
      if (batch?.proposals?.length) {
        window.dispatchEvent(new CustomEvent('idea-workspace-ai-proposal', { detail: { batch } }));
      } else {
        toast(isPl ? 'Brak nowych rekomendacji savings' : 'No new savings recommendations', {
          icon: '🤖',
        });
      }
    } catch (error: any) {
      toast.error(
        error?.message ||
          (isPl ? 'Nie udało się uruchomić analizy savings' : 'Failed to run savings analysis')
      );
    } finally {
      setSavingsLoading(false);
    }
  }, [edges, i18n.language, ideaId, isPl, lanes, locked, nodes, savingsLoading]);

  // ── Node CRUD + Lane management (extracted to useProcessFlowNodes) ─────
  const {
    deleteSelected,
    duplicateSelected,
    handleLaneRename,
    handleLaneDelete,
    handleLaneColorChange,
    handleLaneMoveUp,
    handleLaneMoveDown,
  } = useProcessFlowNodes({
    nodes,
    edges,
    setNodes,
    setEdges,
    lanes,
    setLanes,
    locked: locked || false,
    isPl,
    pushUndo,
    onNodeDetail,
    collab: {
      broadcastNodeRemove: collab.broadcastNodeRemove,
      broadcastEdgeRemove: collab.broadcastEdgeRemove,
      broadcastOps: collab.broadcastOps,
      broadcastLanes: collab.broadcastLanes,
    },
    confirmBulkDelete: (count: number) =>
      confirmBulkDelete({
        title: isPl ? 'Usunąć węzły?' : 'Delete nodes?',
        description: isPl
          ? `Zostaną usunięte ${count} węzły i ich połączenia. Możesz cofnąć przez Ctrl+Z.`
          : `${count} nodes and their connections will be deleted. You can undo with Ctrl+Z.`,
        confirmLabel: isPl ? 'Usuń' : 'Delete',
        cancelLabel: isPl ? 'Anuluj' : 'Cancel',
        variant: 'danger',
      }),
  });

  // ── F5a A3: lane collapse / resize (state in lanes[].{collapsed,height}) ──
  const handleLaneToggleCollapse = useCallback(
    (laneId: string) => {
      if (locked) return;
      pushUndo();
      setLanes((prev) => {
        const next = toggleLaneCollapsed(prev, laneId);
        collab.broadcastLanes?.(next);
        return next;
      });
    },
    [collab, locked, pushUndo, setLanes]
  );

  const handleLaneResize = useCallback(
    (laneId: string, height: number) => {
      if (locked) return;
      setLanes((prev) => {
        const next = setLaneHeight(prev, laneId, height);
        collab.broadcastLanes?.(next);
        return next;
      });
    },
    [collab, locked, setLanes]
  );

  // ── Quick action listener (extracted to useProcessFlowQuickActions) ─────
  useProcessFlowQuickActions({
    open,
    ideaId,
    isPl,
    nodes,
    handlers: {
      addNode,
      insertAutomationTrigger,
      addLane,
      insertBetween,
      splitPath,
      deleteSelected,
      duplicateSelected,
      undo,
      redo,
      openMetricsEditor,
      runSavingsAnalysis,
    },
    setters: {
      setFlowMode,
      setSemanticKit,
      setNodes,
    },
  });

  // ── Validate ───────────────────────────────────────────────────────────

  const runValidation = useCallback(() => {
    const w = validateFlowWarnings(nodes, edges, semanticKit);
    setWarnings(w);
    setShowWarnings(true);
  }, [edges, nodes, semanticKit]);

  // ── Auto-layout ────────────────────────────────────────────────────────

  const handleAutoLayout = useCallback(() => {
    if (locked || nodes.length === 0) return;
    pushUndo();
    const layouted = autoLayout(nodes, edges, lanes);
    setNodes(layouted);
    // F3: auto-layout moves every node → mass change → graph_snapshot.
    collab.broadcastSnapshot({ nodes: layouted, edges, lanes });
    toast.success(isPl ? 'Układ automatyczny zastosowany' : 'Auto-layout applied', {
      duration: 900,
    });
  }, [collab, edges, isPl, lanes, locked, nodes, pushUndo]);

  // ── AI Coach ──────────────────────────────────────────────────────────

  const handleAICoach = useCallback(async () => {
    if (locked || coachLoading) return;
    setCoachLoading(true);
    try {
      const result = await runProcessCoach({
        ideaId,
        context: {
          seedText: '',
          title: '',
          existingNodes: nodes.map((n: Node) => ({
            id: n.id,
            data: { label: n.data?.label, shape: n.data?.shape, laneId: n.data?.laneId },
          })),
          existingEdges: edges.map((e: Edge) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label,
          })),
          existingLanes: lanes,
          language: i18n.language || 'en',
        },
      });
      const insights =
        result?.insights ||
        result?.proposals?.map((p: any) => ({
          type: p.patch?.type || 'bottleneck',
          message: p.rationale,
          suggestion: p.patch?.suggestion || p.patch?.recommendation || '',
          confidence: p.confidence,
        })) ||
        [];
      setCoachInsights(insights);
      setShowCoach(true);
    } catch (err: any) {
      toast.error(err?.message || (isPl ? 'Nie udało się' : 'Failed'));
    } finally {
      setCoachLoading(false);
    }
  }, [coachLoading, edges, i18n.language, ideaId, isPl, lanes, locked, nodes]);

  // ── Process Summary ───────────────────────────────────────────────────

  const handleProcessSummary = useCallback(async () => {
    if (locked || summaryLoading) return;
    setSummaryLoading(true);
    try {
      const result = await generateProcessSummary({
        ideaId,
        context: {
          seedText: '',
          title: '',
          existingNodes: nodes.map((n: Node) => ({
            id: n.id,
            data: { label: n.data?.label, shape: n.data?.shape },
          })),
          existingEdges: edges.map((e: Edge) => ({ id: e.id, source: e.source, target: e.target })),
          existingLanes: lanes,
          language: i18n.language || 'en',
        },
      });
      setSummaryData(result?.summary || result);
      setShowSummary(true);
    } catch (err: any) {
      toast.error(err?.message || (isPl ? 'Nie udało się' : 'Failed'));
    } finally {
      setSummaryLoading(false);
    }
  }, [edges, i18n.language, ideaId, isPl, lanes, locked, nodes, summaryLoading]);

  // ── Accept ghost node → convert to real node ──────────────────────────

  const acceptGhostNode = useCallback(
    (ghostId: string) => {
      const ghost = ghostNodes.find((g) => g.id === ghostId);
      if (!ghost) return;
      pushUndo();
      const realId = `pf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const realNode: Node = {
        ...ghost,
        id: realId,
        data: {
          ...ghost.data,
          _isGhost: false,
          locked,
          onLabelChange: (next: string) => {
            setNodes((nds: Node[]) =>
              nds.map((nd: Node) =>
                nd.id === realId ? { ...nd, data: { ...nd.data, label: next } } : nd
              )
            );
          },
          onNodeDetail: onNodeDetail || undefined,
          onAcceptGhost: undefined,
        },
      };
      setNodes((prev: Node[]) => [...prev, realNode]);
      setGhostNodes((prev) => prev.filter((g) => g.id !== ghostId));
      collab.broadcastNodeAdd(realNode); // F3: accepted ghost → real add
      toast.success(isPl ? 'Krok zaakceptowany' : 'Step accepted', { duration: 800 });
    },
    [collab, ghostNodes, isPl, locked, onNodeDetail, pushUndo, setNodes]
  );

  // ── Save ───────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (locked) return;
    try {
      await persistSave(buildPersistPayload(), {
        reason: 'manual',
        createSnapshot: true,
        snapshotLabel: isPl ? 'Process flow checkpoint' : 'Process flow checkpoint',
      });
      toast.success(isPl ? 'Zapisano' : 'Saved', { duration: 900 });
      onSaved?.();
    } catch (err: any) {
      toast.error(err?.message || (isPl ? 'Nie udało się zapisać' : 'Failed to save'));
    }
  }, [buildPersistPayload, persistSave, isPl, locked, onSaved]);

  useEffect(() => {
    if (!open || locked || loading) return;
    // F3 autosave styk (binding decision, preserved verbatim through F4): a
    // remote patch must NOT trigger the recipient's autosave — the author
    // persists it via their own runtime. The collab receive handler flips
    // lastChangeOriginRef to 'remote' before mutating; here we skip the sync and
    // reset to 'local' so the NEXT genuine local edit persists normally.
    // Known v1 limitation: if the recipient then makes their own edit, their
    // autosave sends the merged state under their baseVersion — last-writer-wins
    // blob semantics, identical to the whiteboard.
    if (lastChangeOriginRef.current === 'remote') {
      lastChangeOriginRef.current = 'local';
      return;
    }
    scheduleSave(buildPersistPayload(), { reason: 'draft' });
  }, [buildPersistPayload, loading, locked, open, scheduleSave]);

  // ── Lane backgrounds ──────────────────────────────────────────────────

  // Lane rendering delegated to LaneSystem component

  // ── Chat integration ───────────────────────────────────────────────────

  const handleConvert = useCallback(
    (action: string) => {
      if (onQuickAction) {
        const selectedIds = nodes.filter((n) => n.selected).map((n) => n.id);
        onQuickAction(action, { selectedIds, activeTool: 'process_flow' });
      }
    },
    [nodes, onQuickAction]
  );

  const handleOpenChatWithContext = useCallback(() => {
    if (!onOpenChat) return;
    const selectedNodes = nodes.filter((n) => n.selected);
    const flowNodeCount = nodes.filter((n) => n.type === 'flowNode').length;
    const modeLabelObj = FLOW_MODE_LABELS[flowMode];
    const modeLabel = isPl ? modeLabelObj.pl : modeLabelObj.en;
    const parts: string[] = [];

    if (isPl) {
      parts.push(
        `Analizuję przepływ procesu (tryb: ${modeLabel}, ${flowNodeCount} kroków, ${lanes.length} torów).`
      );
      if (selectedNodes.length > 0) {
        const names = selectedNodes.map((n) => n.data?.label || n.id).join(', ');
        parts.push(`Zaznaczone elementy: ${names}.`);
      }
      if (warnings.length > 0) {
        parts.push(`Walidacja wykryła ${warnings.length} ostrzeżeń.`);
      }
      parts.push('Pomóż mi ulepszyć ten proces.');
    } else {
      parts.push(
        `I'm working on a process flow (mode: ${modeLabel}, ${flowNodeCount} steps, ${lanes.length} lanes).`
      );
      if (selectedNodes.length > 0) {
        const names = selectedNodes.map((n) => n.data?.label || n.id).join(', ');
        parts.push(`Selected elements: ${names}.`);
      }
      if (warnings.length > 0) {
        parts.push(`Validation found ${warnings.length} warning(s).`);
      }
      parts.push('Help me improve this process.');
    }

    onOpenChat(parts.join(' '));
  }, [flowMode, isPl, lanes.length, nodes, onOpenChat, warnings]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────

  // P3: shared grammar (Tab/Enter/F2/Delete/Escape/Ctrl+Z/S/D/L/0)
  useCanvasKeyboard({
    toolType: 'processflow',
    enabled: open,
    locked: locked || false,
    callbacks: {
      onSave: handleSave,
      onUndo: undo,
      onRedo: redo,
      onDuplicate: duplicateSelected,
      onAutoLayout: handleAutoLayout,
      onFitView: () => reactFlowInstanceRef.current?.fitView({ padding: 0.15, duration: 300 }),
      onEditSelected: () => setShowPropertiesPanel(true),
      onDeleteSelected: deleteSelected,
      onDeselect: () => {
        setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
        setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
        onSelectionChange?.(EMPTY_SELECTION);
      },
      onAddSibling: () => {
        const shape: FlowShape =
          flowMode === 'automation'
            ? 'auto_trigger'
            : flowMode === 'vsm'
              ? 'vsm_process'
              : 'action';
        addNode(shape);
      },
    },
  });

  // PF-specific shortcuts + typing-safe fallbacks for Ctrl+S/Z/D
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const isInput =
        (e.target as HTMLElement)?.tagName === 'INPUT' ||
        (e.target as HTMLElement)?.tagName === 'TEXTAREA' ||
        (e.target as HTMLElement)?.isContentEditable;

      // Normalize single-character keys: when Shift is held the browser reports the UPPERCASE
      // letter (e.key === 'V'/'Z'), so `e.key === 'v'` style checks silently never match —
      // Ctrl+Shift+V (validation) and Ctrl+Shift+Z (redo) were dead shortcuts. Compare lowercased.
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      // Typing-safe fallbacks: fire even when focus is in an input
      if ((e.metaKey || e.ctrlKey) && k === 's') {
        e.preventDefault();
        handleSave();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && k === 'z') {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && k === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && k === 'd') {
        e.preventDefault();
        duplicateSelected();
        return;
      }

      // PF-specific
      if ((e.metaKey || e.ctrlKey) && k === 'e') {
        e.preventDefault();
        setShowExportDialog(true);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && k === 'v') {
        e.preventDefault();
        runBackendValidation();
        setShowValidationPanel(true);
        return;
      }

      if (isInput) return;

      // A6: Shift+1 = zoom to fit (layout-independent via e.code)
      if (e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && e.code === 'Digit1') {
        e.preventDefault();
        reactFlowInstanceRef.current?.fitView({ padding: 0.15, duration: 300 });
        return;
      }

      // Shift+Enter: add alt-shape node (PF-specific; plain Enter is handled by useCanvasKeyboard)
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        const altShape: FlowShape =
          flowMode === 'automation'
            ? 'auto_condition'
            : flowMode === 'vsm'
              ? 'vsm_inventory'
              : 'decision';
        addNode(altShape);
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    addNode,
    duplicateSelected,
    flowMode,
    handleSave,
    open,
    redo,
    runBackendValidation,
    undo,
  ]);

  // ── Graph update listener (from workspace proposals) ───────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.ideaId === ideaId) {
        hydrate();
      }
    };
    window.addEventListener('idea-workspace-graph-update', handler);
    return () => window.removeEventListener('idea-workspace-graph-update', handler);
  }, [hydrate, ideaId, open]);

  // ── Node properties update listener (from Tools panel) ─────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.nodeId || !detail?.data) return;
      setNodes((nds) =>
        nds.map((n) => (n.id === detail.nodeId ? { ...n, data: { ...n.data, ...detail.data } } : n))
      );
    };
    window.addEventListener('idea-workspace-node-update', handler);
    return () => window.removeEventListener('idea-workspace-node-update', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      const detail = ((e as CustomEvent).detail || {}) as IdeaWorkspaceInsertDetail & {
        edges?: any[];
      };
      if (detail.ideaId && detail.ideaId !== ideaId) return;

      if (Array.isArray(detail.items) && detail.items.length > 0) {
        detail.items.forEach((item) => {
          const shape = resolveSemanticInsertShape(
            item.type || item.label || item.text,
            flowMode,
            semanticKit
          );
          addNode(shape, {
            label: item.label || item.text,
            position: item.position || detail.position,
            data: { ...item.data, artifactLinks: item.data?.artifactLinks },
          });
        });

        if (Array.isArray(detail.edges) && detail.edges.length > 0) {
          setEdges((prev) => [
            ...prev,
            ...detail.edges!.map((edge: any) => ({
              id: edge.id || `e-${edge.source}-${edge.target}-${Date.now()}`,
              source: edge.source,
              target: edge.target,
              type: 'flowEdge',
              data: { label: edge.label || edge.data?.label || '', ...edge.data },
            })),
          ]);
        }
        return;
      }

      const shape = resolveSemanticInsertShape(
        detail.nodeType || detail.label || detail.text,
        flowMode,
        semanticKit
      );
      addNode(shape, {
        label: detail.label || detail.text,
        position: detail.position,
      });
    };

    window.addEventListener(IDEA_WORKSPACE_INSERT_EVENT, handler);
    return () => window.removeEventListener(IDEA_WORKSPACE_INSERT_EVENT, handler);
  }, [addNode, flowMode, ideaId, open, semanticKit]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (detail.ideaId && detail.ideaId !== ideaId) return;
      if (locked) return;
      const semantic = detail.semantic as ProcessFlowSemanticKit | undefined;
      if (!semantic) return;
      setSemanticKit(semantic);
      if (semantic === 'classic' || semantic === 'automation' || semantic === 'vsm') {
        setFlowMode(semantic);
      } else {
        setFlowMode('classic');
      }
      setExtensions((prev) => ({
        ...prev,
        processFlow: {
          ...(prev?.processFlow && typeof prev.processFlow === 'object' ? prev.processFlow : {}),
          semanticKit: semantic,
        },
      }));
    };

    window.addEventListener(IDEA_WORKSPACE_FLOW_SEMANTIC_EVENT, handler);
    return () => window.removeEventListener(IDEA_WORKSPACE_FLOW_SEMANTIC_EVENT, handler);
  }, [ideaId, locked, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (detail.ideaId && detail.ideaId !== ideaId) return;
      if (locked) return;
      const themeId = String(detail.themeId || '');
      const palette = FLOW_THEME_PRESETS[themeId];
      if (!palette) return;
      pushUndo();
      setLanes((prev) =>
        prev.map((lane, idx) => ({
          ...lane,
          color: palette[idx % palette.length],
        }))
      );
      setExtensions((prev) => ({
        ...prev,
        processFlow: {
          ...(prev?.processFlow && typeof prev.processFlow === 'object' ? prev.processFlow : {}),
          themeId,
        },
      }));
    };

    window.addEventListener(IDEA_WORKSPACE_THEME_EVENT, handler);
    return () => window.removeEventListener(IDEA_WORKSPACE_THEME_EVENT, handler);
  }, [ideaId, locked, open, pushUndo]);

  if (!open) return null;

  return (
    <div
      className="w-full h-full flex flex-col bg-white dark:bg-navy-950 relative"
      role="region"
      aria-label={isPl ? 'Edytor przepływu procesu' : 'Process flow editor'}
    >
      {/* z-[60] wrapper: keep the FLOW MODE / shape toolbar above the workspace
          breadcrumb card (IdeaMapWorkspace, z-57) which otherwise overlaps and
          blocks the Start / End / Action buttons. (M07 live-debug 2026-06-20) */}
      <div className="relative z-[60]">
      <ProcessFlowToolbar
        isPl={!!isPl}
        locked={locked}
        flowMode={flowMode}
        setFlowMode={setFlowMode}
        semanticKit={semanticKit}
        availableShapes={availableShapes}
        addNode={addNode}
        addLane={addLane}
        insertBetween={insertBetween}
        splitPath={splitPath}
        runValidation={runValidation}
        showWarnings={showWarnings}
        warnings={warnings}
        showCoach={showCoach}
        setShowCoach={setShowCoach}
        coachLoading={coachLoading}
        runProcessCoach={handleAICoach}
        showSummary={showSummary}
        setShowSummary={setShowSummary}
        summaryLoading={summaryLoading}
        generateSummary={handleProcessSummary}
        showKPIDashboard={showKPIDashboard}
        setShowKPIDashboard={setShowKPIDashboard}
        showReadbackPanel={showReadbackPanel}
        onOpenReadback={() => {
          setShowReadbackPanel(true);
          void fetchReadback();
        }}
        showAIPanel={showAIPanel}
        onOpenAIProposal={() => setShowAIPanel(true)}
        canUndo={canUndo}
        canRedo={canRedo}
        undo={undo}
        redo={redo}
        handleAutoLayout={handleAutoLayout}
        duplicateSelected={duplicateSelected}
        deleteSelected={deleteSelected}
        saving={saving}
        syncLabel={saveStatusLabel}
        handleSave={handleSave}
        stepCount={nodes.length}
        laneCount={lanes.length}
        guidance={FLOW_MODE_GUIDANCE[flowMode]}
        onOpenChat={onOpenChat ? handleOpenChatWithContext : undefined}
        onConvert={onQuickAction ? handleConvert : undefined}
        onAIProposal={() => setShowAIPanel(true)}
        onReadback={() => {
          setShowReadbackPanel(true);
          // Readback reads the existing graph (no user prompt needed) — fetch on open
          // so the panel shows content immediately instead of an empty "fetch" prompt.
          fetchReadback();
        }}
      />
      </div>

      {loadError && !loading && nodes.length === 0 && (
        <div className="px-4 pt-3">
          <EmptyStateInline
            icon={AlertTriangle}
            dashed={false}
            message={
              isPl
                ? 'Widok procesu jest chwilowo niedostępny.'
                : 'Process flow is temporarily unavailable.'
            }
            hint={
              isPl
                ? 'To nie oznacza pustego procesu. Spróbuj ponownie wczytać mapę i sprawdź jeszcze raz.'
                : 'This does not mean the process is empty. Retry loading the map and check again.'
            }
            action={{
              label: isPl ? 'Ponów' : 'Retry',
              onClick: hydrate,
            }}
            className="mb-2"
          />
        </div>
      )}

      {locked && (
        <div className="px-4 pt-3">
          <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-slate-300">
            <div className="font-medium text-slate-900 dark:text-slate-100">
              {isPl ? 'Tryb tylko do odczytu' : 'Read-only mode'}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {isPl
                ? 'Możesz przeglądać przepływ, ale edycja i zapis są obecnie zablokowane.'
                : 'You can review the flow, but editing and saving are currently disabled.'}
            </div>
          </div>
        </div>
      )}

      {/* Warnings panel */}
      {showWarnings && warnings.length > 0 && (
        <div className="px-4 py-2 bg-amber-50/80 dark:bg-amber-900/20 border-b border-amber-200/60 dark:border-amber-700/40 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              {isPl ? `${warnings.length} ostrzeżeń` : `${warnings.length} warning(s)`}
            </span>
            <button
              onClick={() => setShowWarnings(false)}
              className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline"
            >
              {isPl ? 'Zamknij' : 'Close'}
            </button>
          </div>
          <ul className="space-y-0.5">
            {warnings.map((w) => (
              <li
                key={w.id}
                className="text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-1"
              >
                <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                {isPl ? w.messagePl : w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Coach Insights Panel */}
      {showCoach && coachInsights.length > 0 && (
        <div className="mx-3 mb-2 rounded-xl border border-indigo-200/60 dark:border-indigo-800/40 bg-indigo-50/50 dark:bg-indigo-950/20 p-3 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
              <TeresaMark size={14} />
              {isPl ? 'AI Coach — Analiza procesu' : 'AI Coach — Process Analysis'}
            </div>
            <button
              type="button"
              onClick={() => setShowCoach(false)}
              className="text-slate-600 hover:text-slate-800 dark:hover:text-slate-300"
              aria-label={isPl ? 'Zamknij' : 'Close'}
            >
              <X size={14} />
            </button>
          </div>
          <ul className="space-y-1.5">
            {coachInsights.map((insight: any, idx: number) => (
              <li key={idx} className="flex items-start gap-2 text-[11px]">
                <span
                  className={`mt-0.5 flex-shrink-0 ${insight.type === 'bottleneck' ? 'text-danger-500' : insight.type === 'improvement' ? 'text-emerald-500' : 'text-indigo-500'}`}
                >
                  {insight.type === 'bottleneck' ? (
                    <AlertTriangle size={12} />
                  ) : (
                    <Lightbulb size={12} />
                  )}
                </span>
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {insight.message}
                  </span>
                  {insight.suggestion && (
                    <span className="block text-slate-500 dark:text-slate-400 mt-0.5">
                      {insight.suggestion}
                    </span>
                  )}
                  {insight.confidence != null && (
                    <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-[8px] font-bold text-indigo-600 dark:text-indigo-300">
                      {Math.round(insight.confidence * 100)}%
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {processBriefData && (
        <div className="mx-3 mb-2 rounded-xl border border-slate-200/60 dark:border-navy-700/40 bg-slate-50/50 dark:bg-navy-900/20 p-3">
          <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
            {isPl ? 'Structured brief' : 'Structured brief'}
          </div>
          <div className="mt-1 text-[10px] text-slate-700 dark:text-slate-300">
            <span className="font-semibold">{isPl ? 'Cel:' : 'Objective:'}</span>{' '}
            {processBriefData.objective}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div>
              <div className="text-[9px] font-bold text-slate-600 dark:text-slate-300">
                {isPl ? 'Luki' : 'Gaps'}
              </div>
              <ul className="mt-1 space-y-0.5">
                {(processBriefData.currentGaps || [])
                  .slice(0, 3)
                  .map((item: string, idx: number) => (
                    <li key={idx} className="text-[9px] text-slate-500 dark:text-slate-400">
                      {item}
                    </li>
                  ))}
              </ul>
            </div>
            <div>
              <div className="text-[9px] font-bold text-slate-600 dark:text-slate-300">
                {isPl ? 'Ruchy' : 'Moves'}
              </div>
              <ul className="mt-1 space-y-0.5">
                {(processBriefData.nextMoves || []).slice(0, 3).map((item: string, idx: number) => (
                  <li key={idx} className="text-[9px] text-slate-500 dark:text-slate-400">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[9px] font-bold text-slate-600 dark:text-slate-300">
                {isPl ? 'Checkpointy' : 'Checkpoints'}
              </div>
              <ul className="mt-1 space-y-0.5">
                {(processBriefData.reviewCheckpoints || [])
                  .slice(0, 3)
                  .map((item: string, idx: number) => (
                    <li key={idx} className="text-[9px] text-slate-500 dark:text-slate-400">
                      {item}
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {savingsAnalysisData && (
        <div className="mx-3 mb-2 rounded-xl border border-amber-200/60 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
              {isPl ? 'Savings analysis' : 'Savings analysis'}
            </div>
            <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
              {savingsAnalysisData.totalSavingsEstimate}
            </div>
          </div>
          {(savingsAnalysisData.notes || []).length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {(savingsAnalysisData.notes || []).slice(0, 3).map((item: string, idx: number) => (
                <li key={idx} className="text-[9px] text-slate-600 dark:text-slate-400">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Summary Panel */}
      {showSummary && summaryData && (
        <div className="mx-3 mb-2 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 max-h-56 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <CheckCircle size={14} />
              {isPl ? 'Podsumowanie procesu' : 'Process Summary'}
            </div>
            <button
              type="button"
              onClick={() => setShowSummary(false)}
              className="text-slate-600 hover:text-slate-800 dark:hover:text-slate-300"
              aria-label={isPl ? 'Zamknij' : 'Close'}
            >
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            {summaryData.totalSteps != null && (
              <div className="text-center p-1.5 rounded-lg bg-white/60 dark:bg-navy-800/40">
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {summaryData.totalSteps}
                </div>
                <div className="text-[8px] text-slate-500">{isPl ? 'Kroków' : 'Steps'}</div>
              </div>
            )}
            {(summaryData.decisions ?? summaryData.totalDecisions) != null && (
              <div className="text-center p-1.5 rounded-lg bg-white/60 dark:bg-navy-800/40">
                <div className="text-sm font-bold text-amber-600 dark:text-amber-400">
                  {summaryData.decisions ?? summaryData.totalDecisions}
                </div>
                <div className="text-[8px] text-slate-500">{isPl ? 'Decyzji' : 'Decisions'}</div>
              </div>
            )}
            {(summaryData.lanes ?? summaryData.totalLanes) != null && (
              <div className="text-center p-1.5 rounded-lg bg-white/60 dark:bg-navy-800/40">
                <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {summaryData.lanes ?? summaryData.totalLanes}
                </div>
                <div className="text-[8px] text-slate-500">{isPl ? 'Ścieżek' : 'Lanes'}</div>
              </div>
            )}
          </div>
          {summaryData.estimatedDuration && (
            <div className="text-[10px] text-slate-600 dark:text-slate-400 mb-1">
              <span className="font-semibold">{isPl ? 'Szacowany czas:' : 'Est. duration:'}</span>{' '}
              {summaryData.estimatedDuration}
            </div>
          )}
          {summaryData.criticalPath && (
            <div className="text-[10px] text-slate-600 dark:text-slate-400 mb-1">
              <span className="font-semibold">
                {isPl ? 'Ścieżka krytyczna:' : 'Critical path:'}
              </span>{' '}
              {Array.isArray(summaryData.criticalPath)
                ? summaryData.criticalPath.join(' → ')
                : summaryData.criticalPath}
            </div>
          )}
          {summaryData.risks?.length > 0 && (
            <div className="mt-1.5">
              <div className="text-[9px] font-bold text-danger-600 dark:text-danger-400 mb-0.5">
                {isPl ? 'Ryzyka:' : 'Risks:'}
              </div>
              <ul className="space-y-0.5">
                {summaryData.risks.map((r: string, i: number) => (
                  <li
                    key={i}
                    className="text-[9px] text-danger-600/80 dark:text-danger-400/80 flex items-start gap-1"
                  >
                    <AlertTriangle size={10} className="mt-0.5 flex-shrink-0" /> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {summaryData.recommendations?.length > 0 && (
            <div className="mt-1.5">
              <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 mb-0.5">
                {isPl ? 'Rekomendacje:' : 'Recommendations:'}
              </div>
              <ul className="space-y-0.5">
                {summaryData.recommendations.map((r: string, i: number) => (
                  <li
                    key={i}
                    className="text-[9px] text-emerald-600/80 dark:text-emerald-400/80 flex items-start gap-1"
                  >
                    <Lightbulb size={10} className="mt-0.5 flex-shrink-0" /> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Canvas */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-slate-600" size={24} />
        </div>
      ) : (
        <div ref={flowContainerRef} className="flex-1 relative">
          <div className="absolute inset-0">
            <LaneSystem
              lanes={lanes}
              isPl={!!isPl}
              locked={locked}
              onRename={handleLaneRename}
              onDelete={handleLaneDelete}
              onColorChange={handleLaneColorChange}
              onMoveUp={handleLaneMoveUp}
              onMoveDown={handleLaneMoveDown}
              onToggleCollapse={handleLaneToggleCollapse}
              onResize={handleLaneResize}
              dragOverLaneId={dragOverLaneId}
            />
          </div>

          {/* M07 F5b B1: grid/snap toggle — real, user-controllable, and now
              round-trips through hydration (bug L-04). Solid c-* tokens only
              (no /alpha suffix — those don't emit rules for hex-valued c-*
              tokens, see finding_c_token_alpha_colormix). */}
          <div className="absolute top-2 left-2 z-20 flex items-center gap-0.5 rounded-xl border border-c-border bg-c-surface shadow-sm px-1 py-0.5">
            <button
              type="button"
              onClick={() => setShowGrid((prev) => !prev)}
              className={`inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                showGrid ? 'text-c-info bg-c-surface-raised' : 'text-c-text-muted hover:bg-c-surface-raised'
              }`}
              title={isPl ? 'Pokaż/ukryj siatkę' : 'Toggle grid'}
              aria-label={isPl ? 'Pokaż/ukryj siatkę' : 'Toggle grid'}
              aria-pressed={showGrid}
            >
              <Grid3x3 size={14} />
            </button>
            <button
              type="button"
              onClick={() => setSnapToGridEnabled((prev) => !prev)}
              className={`inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                snapToGridEnabled
                  ? 'text-c-info bg-c-surface-raised'
                  : 'text-c-text-muted hover:bg-c-surface-raised'
              }`}
              title={isPl ? 'Przyciąganie do siatki' : 'Snap to grid'}
              aria-label={isPl ? 'Przyciąganie do siatki' : 'Snap to grid'}
              aria-pressed={snapToGridEnabled}
            >
              <Magnet size={14} />
            </button>
          </div>

          {/* V51-28: Empty state overlay */}
          {filteredNodes.length === 0 && filteredGhostNodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="text-center pointer-events-auto">
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                  <GitMerge size={24} className="text-indigo-500" />
                </div>
                <div className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  {isPl ? 'Pusty przepływ' : 'Empty process flow'}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-500 mb-3 max-w-[220px]">
                  {isPl
                    ? 'Dodaj kroki z paska narzędzi lub naciśnij Enter'
                    : 'Add steps from the toolbar or press Enter'}
                </div>
                {!locked && (
                  <button
                    onClick={() => addNode(flowMode === 'vsm' ? 'vsm_process' : 'start')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-colors"
                  >
                    <Plus size={14} />
                    {isPl ? 'Dodaj start' : 'Add start'}
                  </button>
                )}
              </div>
            </div>
          )}

          <ReactFlowProvider>
            <EdgeRehydrateFix
              nodeIdsKey={nodes.map((n) => n.id).join(',')}
              nodeIds={nodes.map((n) => n.id)}
            />
            <ReactFlow
              nodes={[
                ...displayNodes,
                ...filteredGhostNodes.map((g) => ({
                  ...g,
                  style: { opacity: 0.4 },
                  data: { ...g.data, onAcceptGhost: acceptGhostNode },
                })),
                // M07 F2 decision 6: pending AI proposal → added nodes shown
                // as ghosts (no per-node accept; the whole proposal is
                // accepted/rejected in the panel). Cleared with the proposal.
                ...(activeProposal?.status === 'pending' && activeProposal.previewNodes
                  ? activeProposal.previewNodes.map((g) => ({
                      ...g,
                      style: { opacity: 0.4 },
                    }))
                  : []),
              ]}
              edges={filteredEdgesWithHandlers}
              onNodesChange={locked ? undefined : onNodesChange}
              onEdgesChange={locked ? undefined : onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              // react-flow v11 prop names (v12 renamed these to edgesReconnectable/onReconnect).
              // Using the v12 names on v11 left edgesReconnectable unrecognized → leaked to the
              // DOM (React "does not recognize prop" warning) AND onReconnect never fired
              // (edge-reconnect was silently dead). Correct v11 API = edgesUpdatable/onEdgeUpdate.
              edgesUpdatable={!locked}
              onEdgeUpdate={(oldEdge: Edge, newConnection: Connection) => {
                if (locked) return;
                pushUndo();
                setEdges((prev) => {
                  const filtered = prev.filter((e) => e.id !== oldEdge.id);
                  return addEdge({ ...newConnection, type: 'flowEdge' }, filtered);
                });
              }}
              onNodeContextMenu={(event: React.MouseEvent, node: Node) => {
                event.preventDefault();
                setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
              }}
              onPaneContextMenu={(event: React.MouseEvent) => {
                event.preventDefault();
                setContextMenu({
                  x: event.clientX,
                  y: event.clientY,
                });
              }}
              {...getIdeasToolInteractionProps('processflow', { locked, connectMode: !locked })}
              snapToGrid={snapToGridEnabled}
              snapGrid={[16, 16]}
              onInit={(instance: ReactFlowInstance) => {
                reactFlowInstanceRef.current = instance;
                // M07 F5b B1: restore the user's own last viewport (bug L-04
                // — viewState was persisted but never read back). Applied
                // after the initial `fitView` pass settles so it wins.
                const pending = pendingViewportRef.current;
                if (pending) {
                  window.setTimeout(() => {
                    try {
                      instance.setViewport(pending, { duration: 300 });
                    } catch {
                      /* ignore */
                    }
                  }, 50);
                }
              }}
              fitView={!pendingViewportRef.current}
              className="bg-transparent"
              defaultEdgeOptions={{ type: 'flowEdge', animated: false }}
            >
              {(() => { const bg = getCanvasBg('process_flow', isDarkFlow ? 'dark' : 'light', showGrid ? undefined : 'blank'); return <Background color={bg.color} gap={bg.gap} size={bg.size} variant={bg.variant as any} />; })()}
              {showMiniMap && (
                <MiniMap
                  nodeStrokeWidth={3}
                  zoomable
                  pannable
                  className="!bg-white/80 dark:!bg-navy-900/80 !border-slate-200/60 dark:!border-navy-700/60"
                />
              )}
              <CanvasZoomControls
                isPolish={isPl}
                savedViewport={savedViewport}
                selectedNodeId={selectedNodeId}
                showMiniMap={showMiniMap}
                onToggleMiniMap={() => setShowMiniMap((prev) => !prev)}
                onFullscreenToggle={onFullscreenToggle}
                isFullscreen={isFullscreen}
              />
            </ReactFlow>
          </ReactFlowProvider>

          {/* VSM Timeline Bar — shown when VSM nodes exist */}
          {nodes.some((n: Node) => String(n.data?.shape || '').startsWith('vsm_')) && (
            <div className="absolute bottom-0 left-0 right-0 z-10">
              <VSMTimelineBar nodes={nodes} isPl={isPl} />
            </div>
          )}

          {/* Process KPI Dashboard */}
          {showKPIDashboard && (
            <div className="absolute top-2 right-2 z-20">
              <ProcessKPIDashboard
                nodes={nodes}
                edges={edges}
                lanes={lanes}
                isPl={isPl}
                onClose={() => setShowKPIDashboard(false)}
              />
            </div>
          )}

          <CollaborationOverlay
            ideaId={ideaId}
            currentUserId={currentUser?.id || 'anonymous'}
            currentUserName={currentUserName}
            selectedNodeIds={selectedNodeIds}
            onRegisterSend={collab.registerCollabSend}
            onSessionStateChange={(state: CollaborationSessionState | null) =>
              collab.onSessionState(state)
            }
          />

          {selectedNode && !locked && (
            <ProcessFlowFloatingToolbar
              nodeId={selectedNode.id}
              nodeData={selectedNode.data}
              position={{
                x: (selectedNode.position?.x ?? 0) + (selectedNode.width ?? 140) / 2,
                y: selectedNode.position?.y ?? 0,
              }}
              locked={locked}
              isPl={isPl}
              onRename={() => setShowPropertiesPanel(true)}
              onDuplicate={duplicateSelected}
              onDelete={deleteSelected}
              onInsertBetween={insertBetween}
              onOpenChat={onOpenChat ? handleOpenChatWithContext : undefined}
              artifactLinks={selectedNode.data?.artifactLinks}
              onArtifactLinksChange={(links) => {
                setNodes((nds) =>
                  nds.map((n) =>
                    n.id === selectedNode.id
                      ? { ...n, data: { ...n.data, artifactLinks: links } }
                      : n
                  )
                );
              }}
              onOpenComments={() => setCommentsPanelNodeId(selectedNode.id)}
              commentCount={
                Array.isArray(selectedNode.data?.comments) ? selectedNode.data.comments.length : 0
              }
            />
          )}
        </div>
      )}

      {commentsPanelNodeId &&
        (() => {
          const node = nodes.find((n) => n.id === commentsPanelNodeId);
          if (!node) return null;
          const nodeComments: ProcessFlowNodeComment[] = Array.isArray(node.data?.comments)
            ? node.data.comments
            : [];
          return (
            <ProcessFlowNodeCommentThread
              open
              onClose={() => setCommentsPanelNodeId(null)}
              nodeId={commentsPanelNodeId}
              nodeLabel={node.data?.label || commentsPanelNodeId}
              comments={nodeComments}
              locked={locked}
              currentUser={currentUserName}
              isPl={!!isPl}
              onAddComment={(nodeId, comment) => {
                setNodes((nds) =>
                  nds.map((n) =>
                    n.id === nodeId
                      ? { ...n, data: { ...n.data, comments: appendComment(n.data?.comments, comment) } }
                      : n
                  )
                );
              }}
              onDeleteComment={(nodeId, commentId) => {
                setNodes((nds) =>
                  nds.map((n) =>
                    n.id === nodeId
                      ? { ...n, data: { ...n.data, comments: removeComment(n.data?.comments, commentId) } }
                      : n
                  )
                );
              }}
            />
          );
        })()}

      {/* ── New panels: Validation, AI Proposal, Readback, Properties, Export, Context Menu ── */}

      {showValidationPanel && (
        <div className="absolute right-0 top-0 bottom-0 w-80 z-30 border-l border-slate-200/60 dark:border-navy-700/60 bg-white dark:bg-navy-950 overflow-y-auto shadow-lg">
          <div className="flex items-center justify-between p-3 border-b border-slate-200/60 dark:border-navy-700/60">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {isPl ? 'Walidacja' : 'Validation'}
            </span>
            <button
              onClick={() => setShowValidationPanel(false)}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-800"
              aria-label={isPl ? 'Zamknij' : 'Close'}
            >
              <X size={14} className="text-slate-600" />
            </button>
          </div>
          <ValidationResultsPanel
            result={validationResult}
            isValidating={isBackendValidating}
            isPl={!!isPl}
            onClickIssue={(objectId) => {
              setNodes((prev) => prev.map((n) => ({ ...n, selected: n.id === objectId })));
              setShowValidationPanel(false);
            }}
            onValidate={runBackendValidation}
          />
        </div>
      )}

      {showAIPanel && (
        <div className="absolute right-0 top-0 bottom-0 w-96 z-30 border-l border-slate-200/60 dark:border-navy-700/60 bg-white dark:bg-navy-950 overflow-y-auto shadow-lg">
          <div className="flex items-center justify-between p-3 border-b border-slate-200/60 dark:border-navy-700/60">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {isPl ? 'Propozycja AI' : 'AI Proposal'}
            </span>
            <button
              onClick={() => setShowAIPanel(false)}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-800"
              aria-label={isPl ? 'Zamknij' : 'Close'}
            >
              <X size={14} className="text-slate-600" />
            </button>
          </div>
          <AIProposalPanel
            proposal={activeProposal}
            isGenerating={isAIGenerating}
            error={aiError}
            isPl={!!isPl}
            onAccept={() => resolveProposal('accept')}
            onReject={() => resolveProposal('reject')}
            onEditPrompt={() => {
              // Back to the prompt form (the panel keeps the previous prompt
              // in its draft); the user edits and regenerates explicitly.
              dismissProposal();
            }}
            onDismiss={dismissProposal}
            onGenerate={createProposal}
          />
        </div>
      )}

      {showReadbackPanel && (
        <div className="absolute right-0 top-0 bottom-0 w-80 z-30 border-l border-slate-200/60 dark:border-navy-700/60 bg-white dark:bg-navy-950 overflow-y-auto shadow-lg">
          <div className="flex items-center justify-between p-3 border-b border-slate-200/60 dark:border-navy-700/60">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {isPl ? 'Odczyt semantyczny' : 'Semantic Readback'}
            </span>
            <button
              onClick={() => setShowReadbackPanel(false)}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-800"
              aria-label={isPl ? 'Zamknij' : 'Close'}
            >
              <X size={14} className="text-slate-600" />
            </button>
          </div>
          <ReadbackPanel
            result={readbackResult}
            isLoading={isReadbackLoading}
            isPl={!!isPl}
            onFetchReadback={fetchReadback}
            onClickStep={(objectId) => {
              setNodes((prev) => prev.map((n) => ({ ...n, selected: n.id === objectId })));
            }}
          />
        </div>
      )}

      {showPropertiesPanel && (
        <div className="absolute right-0 top-0 bottom-0 w-80 z-30 border-l border-slate-200/60 dark:border-navy-700/60 bg-white dark:bg-navy-950 overflow-y-auto shadow-lg">
          <div className="flex items-center justify-between p-3 border-b border-slate-200/60 dark:border-navy-700/60">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {isPl ? 'Właściwości' : 'Properties'}
            </span>
            <button
              onClick={() => setShowPropertiesPanel(false)}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-800"
              aria-label={isPl ? 'Zamknij' : 'Close'}
            >
              <X size={14} className="text-slate-600" />
            </button>
          </div>
          <ProcessFlowPropertiesPanel
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            lanes={lanes}
            isPl={!!isPl}
            locked={locked}
            onNodeLabelChange={(nodeId, label) => {
              setNodes((prev) =>
                prev.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, label } } : n))
              );
            }}
            onGatewayKindChange={(nodeId, kind) => {
              setNodes((prev) =>
                prev.map((n) =>
                  n.id === nodeId ? { ...n, data: { ...n.data, gatewayKind: kind } } : n
                )
              );
            }}
            onLaneChange={(nodeId, laneId) => {
              const lane = lanes.find((l) => l.id === laneId);
              if (lane) {
                setNodes((prev) =>
                  prev.map((n) =>
                    n.id === nodeId
                      ? { ...n, data: { ...n.data, laneId, laneColor: lane.color } }
                      : n
                  )
                );
              }
            }}
            onEdgeLabelChange={(edgeId, label) => {
              setEdges((prev) =>
                prev.map((e) => (e.id === edgeId ? { ...e, label, data: { ...e.data, label } } : e))
              );
            }}
            onEdgeConditionChange={(edgeId, conditionType) =>
              handleEdgeConditionChange(edgeId, conditionType)
            }
            onEdgeKindChange={(edgeId, kind) => {
              if (locked) return;
              pushUndo();
              setEdges((prev) =>
                prev.map((e) => {
                  if (e.id !== edgeId) return e;
                  const nextEdge = { ...e, data: { ...e.data, edgeKind: kind } };
                  collab.broadcastEdgeUpdate(nextEdge);
                  return nextEdge;
                })
              );
            }}
            onEdgeOrthogonalToggle={(edgeId, orthogonal) => {
              if (locked) return;
              pushUndo();
              setEdges((prev) =>
                prev.map((e) => {
                  if (e.id !== edgeId) return e;
                  const nextEdge = { ...e, data: { ...e.data, orthogonal } };
                  collab.broadcastEdgeUpdate(nextEdge);
                  return nextEdge;
                })
              );
            }}
            onNodeMetricsChange={(nodeId, metrics) => {
              setNodes((prev) =>
                prev.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...metrics } } : n))
              );
            }}
          />
        </div>
      )}

      <ExportDialog
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onExport={exportAs}
        isExporting={isExporting}
        isPl={!!isPl}
      />

      {/* M07 F5b B2 decision: KEEP this own ProcessFlowContextMenu, do NOT
          adopt the shared `IdeaCanvasContextMenu` (src/components/MyWork/
          IdeaCanvasContextMenu.tsx). That component is a different tool
          entirely — an AI-actions menu (expand/challenge/find-evidence/
          brainstorm via generateAIProposal), not a structural editing menu.
          It has zero PF-shaped actions (no add-node-per-shape, no lane ops,
          no auto-layout/paste/duplicate/delete) and would need real feature
          additions to the shared file to cover them — out of budget per the
          spec's "minimal risk, don't grow someone else's shared component"
          guidance. Leaving PF's own menu as-is. */}
      {contextMenu && (
        <ProcessFlowContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={
            contextMenu.nodeId
              ? getNodeContextActions({
                  nodeId: contextMenu.nodeId,
                  isPl: !!isPl,
                  locked,
                  onEditLabel: () => {
                    // Bump editSignal on the node → FlowNodeComponent starts inline edit
                    // (fixes U8: previously this only selected, never opened the editor).
                    setNodes((prev) =>
                      prev.map((n) =>
                        n.id === contextMenu.nodeId
                          ? {
                              ...n,
                              selected: true,
                              data: {
                                ...n.data,
                                editSignal: (Number(n.data?.editSignal) || 0) + 1,
                              },
                            }
                          : n
                      )
                    );
                  },
                  onDuplicate: () => duplicateSelected(),
                  onDelete: () => deleteSelected(),
                  onOpenProperties: () => {
                    setShowPropertiesPanel(true);
                  },
                  onAutoLayout: () => handleAutoLayout(),
                  onConvertInitiative: onQuickAction
                    ? () => handleConvert('pf_convert_initiative')
                    : undefined,
                })
              : getCanvasContextActions({
                  isPl: !!isPl,
                  locked,
                  onAddNode: (shape) => addNode(shape as FlowShape),
                  onPaste: () => duplicateSelected(),
                  onAutoLayout: () => handleAutoLayout(),
                })
          }
          onClose={() => setContextMenu(null)}
        />
      )}

      {metricsEditorNode && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-900/30 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200/70 bg-white p-4 shadow-2xl dark:border-navy-700/70 dark:bg-navy-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {isPl ? 'Metryki kroku procesu' : 'Process step metrics'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {metricsEditorNode.data?.label}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMetricsEditorNodeId(null)}
                className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-navy-800 dark:hover:text-slate-200"
                aria-label={isPl ? 'Zamknij' : 'Close'}
              >
                <X size={14} />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-[11px] text-slate-600 dark:text-slate-300">
                <div className="mb-1">{isPl ? 'Czas' : 'Duration'}</div>
                <input
                  value={metricsDraft.duration || ''}
                  onChange={(e) =>
                    setMetricsDraft((prev) => ({ ...prev, duration: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none dark:border-navy-700 dark:bg-navy-950"
                />
              </label>
              <label className="text-[11px] text-slate-600 dark:text-slate-300">
                <div className="mb-1">{isPl ? 'Jednostka' : 'Unit'}</div>
                <input
                  value={metricsDraft.durationUnit || ''}
                  onChange={(e) =>
                    setMetricsDraft((prev) => ({ ...prev, durationUnit: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none dark:border-navy-700 dark:bg-navy-950"
                />
              </label>
              <label className="text-[11px] text-slate-600 dark:text-slate-300">
                <div className="mb-1">{isPl ? 'Koszt' : 'Cost'}</div>
                <input
                  value={metricsDraft.cost || ''}
                  onChange={(e) => setMetricsDraft((prev) => ({ ...prev, cost: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none dark:border-navy-700 dark:bg-navy-950"
                />
              </label>
              <label className="text-[11px] text-slate-600 dark:text-slate-300">
                <div className="mb-1">FTE</div>
                <input
                  value={metricsDraft.fteCount || ''}
                  onChange={(e) =>
                    setMetricsDraft((prev) => ({ ...prev, fteCount: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none dark:border-navy-700 dark:bg-navy-950"
                />
              </label>
              <label className="text-[11px] text-slate-600 dark:text-slate-300">
                <div className="mb-1">
                  {isPl ? 'Potencjał automatyzacji' : 'Automation potential'}
                </div>
                <select
                  value={metricsDraft.automationPotential || 'medium'}
                  onChange={(e) =>
                    setMetricsDraft((prev) => ({ ...prev, automationPotential: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none dark:border-navy-700 dark:bg-navy-950"
                >
                  <option value="low">{isPl ? 'Niski' : 'Low'}</option>
                  <option value="medium">{isPl ? 'Średni' : 'Medium'}</option>
                  <option value="high">{isPl ? 'Wysoki' : 'High'}</option>
                </select>
              </label>
              <label className="text-[11px] text-slate-600 dark:text-slate-300">
                <div className="mb-1">{isPl ? 'Szacowane oszczędności' : 'Savings estimate'}</div>
                <input
                  value={metricsDraft.savingsEstimate || ''}
                  onChange={(e) =>
                    setMetricsDraft((prev) => ({ ...prev, savingsEstimate: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none dark:border-navy-700 dark:bg-navy-950"
                />
              </label>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setMetricsEditorNodeId(null)}
                className="rounded-xl px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-800"
              >
                {isPl ? 'Anuluj' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveMetrics}
                className="rounded-xl bg-slate-900 dark:bg-white px-3 py-2 text-xs font-semibold text-white dark:text-navy-900 hover:bg-slate-800 dark:hover:bg-slate-100"
              >
                {isPl ? 'Zapisz metryki' : 'Save metrics'}
              </button>
            </div>
          </div>
        </div>
      )}
      {bulkDeleteDialog}
    </div>
  );
};

export default IdeaProcessFlowTool;
