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
import './processflow/processflow-canvas.css';

import * as dagre from 'dagre';
import {
  AlertTriangle,
  CheckCircle,
  Copy,
  Edit3,
  GitMerge,
  Lightbulb,
  Loader2,
  MessageCircle,
  Minus,
  MoreHorizontal,
  MoveRight,
  Palette,
  Plus,
  GitBranch,
  Repeat,
  Tag,
  Trash2,
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

import { type ActionContext, runIdeaAction } from '@/actions/ideaActionRegistry';
import type { LaneOpOutcome } from '@/actions/quickActionAck';
import { ErrorState, SkeletonState } from '@/components/shared/states';
import { Api } from '@/services/api';
import {
  generateAIProposal,
  generateProcessSummary,
  runProcessCoach,
} from '@/services/ideaAIGenerator';
import { useAppStore } from '@/store/useAppStore';
import { withNormalizedArtifactLinks } from '@/utils/artifactLinks';
import { isCanvasObjectEditBarEnabled } from '@/utils/canvasObjectEditBarFlag';
import {
  IDEA_BOTTOM_BAR_MINIMAP_LIFT,
  isIdeaBottomBarUnifiedEnabled,
} from '@/utils/ideaBottomBarUnifiedFlag';
import { isVf1CanvasSpecAEnabled } from '@/utils/vf1CanvasSpecAFlag';

import { EmptyStateInline } from '../shared/NModeBlocks/EmptyStateInline';
import TeresaMark from '../shared/TeresaMark';
import { getCanvasBg } from './canvas/canvasBackground';
import { readCanvasObjectStyle } from './canvas/canvasObjectStyle';
import { type ProcessFlowSemanticKit } from './canvas/canvasOsContract';
import { CanvasSnapGuides } from './canvas/CanvasSnapGuides';
import { CanvasZoomControls } from './canvas/CanvasZoomControls';
import {
  getIdeaCanvasCursorClass,
  getIdeaCanvasCursorProps,
  type IdeaCanvasCursorMode,
  publishIdeaCanvasCursorMode,
} from './canvas/ideaCanvasCursorMode';
import { FOCUS_RING } from './canvas/motionTokens';
import { ObjectEditBar } from './canvas/ObjectEditBar';
import {
  buildStyleGroups,
  ObjectEditBarDock,
  useObjectEditBarSlot,
} from './canvas/objectEditBarDock';
import {
  ArrowDirectionPopover,
  ColorPalettePopover,
  MenuListPopover,
  TextInputPopover,
} from './canvas/ObjectEditBarPopovers';
import { publishProcessFlowGridState } from './canvas/processFlowGridState';
import { useCanvasSnappingRef } from './canvas/useCanvasSnapping';
import { formatIdeaMapSyncLabel, resolveIdeaMapHydration } from './canvas/useIdeaMapSync';
import { getIdeasToolInteractionProps } from './canvas/useIdeasToolDefaults';
import { useCanvasKeyboard } from './canvas/useIdeasToolKeyboard';
import {
  type CanvasToolType,
  EMPTY_SELECTION,
  IDEA_WORKSPACE_FLOW_SEMANTIC_EVENT,
  IDEA_WORKSPACE_INSERT_EVENT,
  IDEA_WORKSPACE_THEME_EVENT,
  type IdeaWorkspaceInsertDetail,
  type IdeaWorkspaceSelection,
} from './ideaSelectionTypes';
import { emitIdeaUndoState } from './ideaUndoStateBus';
import {
  CollaborationOverlay,
  type CollaborationSessionState,
} from './mindmap/CollaborationOverlay';
import { AIProposalPanel } from './processflow/AIProposalPanel';
import type { ApplyPatchResult } from './processflow/applyProposalPatch';
import { EdgeStylePopover } from './processflow/EdgeStylePopover';
import { ExportDialog } from './processflow/ExportDialog';
import { FlowEdgeComponent } from './processflow/FlowEdgeComponent';
import {
  FlowNodeComponent,
  type FlowShape,
  LANE_HEIGHT,
  SHAPE_CONFIG,
} from './processflow/FlowNodeComponent';
import {
  isNodeInCollapsedLane,
  laneBandLayout,
  laneIndexAtY,
  setLaneHeight,
  toggleLaneCollapsed,
} from './processflow/laneState';
import {
  DEFAULT_LANES,
  FLOW_THEME_PRESETS,
  type Lane,
  LANE_COLORS,
} from './processflow/LaneSystem';
import { LaneSystemViewportLayer } from './processflow/LaneSystem';
import {
  appendComment,
  type ProcessFlowNodeComment,
  removeComment,
} from './processflow/nodeComments';
import {
  checkProcessFlowNodeCap,
  PROCESS_FLOW_NODE_LIMIT,
  PROCESS_FLOW_NODE_WARN_THRESHOLD,
} from './processflow/nodeCap';
import { ActivityNode } from './processflow/nodes/ActivityNode';
import { BPMNEndNode } from './processflow/nodes/BPMNEndNode';
import { BPMNStartNode } from './processflow/nodes/BPMNStartNode';
import { DataObjectNode } from './processflow/nodes/DataObjectNode';
import { GatewayNode } from './processflow/nodes/GatewayNode';
import { PoolNode } from './processflow/nodes/PoolNode';
import { SubprocessNode } from './processflow/nodes/SubprocessNode';
import {
  EDGE_CONDITIONS,
  getCanvasContextActions,
  getEdgeContextActions,
  getNodeContextActions,
  ProcessFlowContextMenu,
} from './processflow/ProcessFlowContextMenu';
import { ProcessFlowFloatingToolbar } from './processflow/ProcessFlowFloatingToolbar';
import { ProcessFlowNodeCommentThread } from './processflow/ProcessFlowNodeCommentThread';
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
import { useProcessFlowQuickActions } from './processflow/useProcessFlowQuickActions';
import { useProcessFlowReadback } from './processflow/useProcessFlowReadback';
import { useProcessFlowUndoRedo } from './processflow/useProcessFlowUndoRedo';
import { useProcessFlowValidation } from './processflow/useProcessFlowValidation';
import { validateFlowWarnings, type ValidationWarning } from './processflow/validateFlow';
import { ValidationResultsPanel } from './processflow/ValidationResultsPanel';
import {
  computeLaneAwareFitBounds,
  normalizeProcessFlowViewState,
  processFlowViewportStorageKey,
  resolveHydrationViewport,
} from './processflow/viewState';
import { ProcessKPIDashboard } from './ProcessKPIDashboard';
import { useConfirmDialog } from './shared/ConfirmDialog';
import { vsmNodeTypes } from './VSMNodeComponent';
import { VSMTimelineBar } from './VSMTimelineBar';
import { useIsDark } from './whiteboard/nodes/whiteboardNodeHelpers';

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
    //
    // G4-PF-GUARDRAIL perf fix: `updateNodeInternals` accepts an array
    // (`useUpdateNodeInternals` in @reactflow/core does
    // `Array.isArray(id) ? id : [id]`), so pass the WHOLE id set in one call
    // instead of calling it once per id. This is not cosmetic: each
    // invocation schedules its own `requestAnimationFrame` → one
    // `store.updateNodeDimensions(updates)` → one
    // `updateAbsoluteNodePositions(nodeInternals, …)` sweep over the ENTIRE
    // nodeInternals map (@reactflow/core index.mjs, `updateNodeDimensions`
    // calling `updateAbsoluteNodePositions`, itself a `nodeInternals.forEach`
    // over every node regardless of how many were actually updated) plus a
    // fresh `new Map(nodeInternals)` copy and a store `set()`. Calling this
    // once per node turned a mount with N nodes into N separate O(N) sweeps
    // (O(N²)) at each of the 4 timer ticks below; batching into one call per
    // tick makes it O(N) per tick (measured — see
    // docs/qa/ideas-complete-transformation-2026-08-09/17_PERFORMANCE_MEASUREMENT.md
    // for the before numbers and the G4 stream's benchmark rerun for after).
    const timers = [60, 250, 600, 1200].map((ms) =>
      window.setTimeout(() => {
        if (idsRef.current.length) updateNodeInternals(idsRef.current);
      }, ms)
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

// Przyblizone gabaryty kafla kroku (te same, ktorych uzywa auto-uklad dagre
// nizej). Sluza wylacznie do centrowania nowego wezla w kadrze i do prostego
// omijania kolizji przy dodawaniu — nie sa zrodlem prawdy dla renderu.
const NODE_BOX_W = 160;
const NODE_BOX_H = 48;

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
  /** Z9: when true (mels canvas shell — Menu 1 shows the save indicator), the
   *  ProcessFlowToolbar hides its own Save button to avoid duplication. Default
   *  OFF → legacy layout unchanged. */
  hideSaveIndicator?: boolean;
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
  hideSaveIndicator = false,
  externalRuntime,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  // VF1 SPEC-A canvas states (loading/error) — default OFF, gated per rule #7.
  const vf1CanvasSpecAEnabled = isVf1CanvasSpecAEnabled();
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
  // PF-P2-02: id of the lane just created via `addLane` — LaneSystem uses this
  // to auto-enter inline naming (focus + select) for exactly one lane, then
  // clears it via `onAutoEditConsumed` once the edit session starts. Cleared
  // eagerly (not on commit/cancel) because it only gates the initial
  // auto-focus trigger; the lane's own local `editing` state carries the rest
  // of the session (Enter commits, Escape cancels — unchanged LaneSystem.tsx
  // behavior).
  const [newLaneId, setNewLaneId] = useState<string | null>(null);
  const [extensions, setExtensions] = useState<Record<string, unknown>>({});
  const [warnings, setWarnings] = useState<ValidationWarning[]>([]);

  // ── G4-PF-GUARDRAIL: node-count cap ──────────────────────────────────────
  // Process Flow had NO node cap of any kind (unlike Mind Map's soft 500-node
  // banner and Whiteboard's hard block at `nodes.length >= 500`), while its
  // mount cost is the worst of the four canvas tools (see nodeCap.ts header
  // + docs/qa/ideas-complete-transformation-2026-08-09/17_PERFORMANCE_MEASUREMENT.md
  // §4.3/§6). This checks the RESULTING count (current + addCount) so a bulk
  // add (AI-proposal accept, paste, cross-tool conversion/import) can't jump
  // straight past the ceiling in one step — every node-adding call site in
  // this file (manual add, insert-between, split-path, ghost-accept, AI
  // apply, and the cross-tool `idea-workspace-insert` bulk handler) calls
  // this before mutating `nodes`. Defined early (before `nodes` has any other
  // consumers below) so every later callback can list it as a dependency
  // without a temporal-dead-zone hazard. Returns `false` (and toasts) when
  // the add must be refused entirely — no silent refusal, no silent
  // truncation.
  const guardAddNodes = useCallback(
    (addCount: number): boolean => {
      const cap = checkProcessFlowNodeCap(nodes.length, addCount);
      if (!cap.allowed) {
        toast.error(
          t('myWorkIdeas.processFlowTool.nodeLimitReached', {
            defaultValue: `Step limit reached (${PROCESS_FLOW_NODE_LIMIT} maximum). Please delete some steps or split the process into multiple flows.`,
            limit: PROCESS_FLOW_NODE_LIMIT,
          }),
          { duration: 3000 }
        );
        return false;
      }
      if (cap.shouldWarn) {
        toast(
          t('myWorkIdeas.processFlowTool.nodeLimitWarning', {
            defaultValue: `You are approaching the step limit (${PROCESS_FLOW_NODE_WARN_THRESHOLD} steps). Consider splitting into multiple flows.`,
            warn: PROCESS_FLOW_NODE_WARN_THRESHOLD,
          }),
          { icon: '⚠️', duration: 3000 }
        );
      }
      return true;
    },
    [nodes, t]
  );

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
  // Z17 (Fala 3): true while the user is mid-drag on a connection line —
  // toggles the `pf-connecting` class (processflow-canvas.css) so every
  // node's 4-side handles light up as magnetic landing targets, not just
  // the one under the cursor.
  const [isConnectingEdge, setIsConnectingEdge] = useState(false);
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  // M07 F5b B1: real grid/snap view-state (previously a hardcoded stub that
  // was written on save but never reflected actual UI state or restored).
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGridEnabled, setSnapToGridEnabled] = useState(true);
  /**
   * Z1 (rozdz. 06 §3): tryb kursora płótna sterowany pstryczkiem lewego raila
   * (`mm_select_mode` / `mm_pan_mode`). Do 2026-07-23 Przepływ w ogóle nie
   * odczytywał trybu — pstryczek zmieniał wyłącznie własną etykietę na railu.
   */
  const [cursorMode, setCursorMode] = useState<IdeaCanvasCursorMode>('select');
  const [savedViewport, setSavedViewport] = useState<{ x: number; y: number; zoom: number } | null>(
    null
  );
  // Viewport read from the persisted blob/localStorage during hydrate, applied
  // to the live ReactFlow instance once it mounts (see onInit below).
  const pendingViewportRef = useRef<{ x: number; y: number; zoom: number } | null>(null);
  const flowContainerRef = useRef<HTMLDivElement>(null);
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);

  // Z14: neighbour-edge magnetic snapping while dragging. Grid is left to
  // ReactFlow's native snapToGrid (snapGrid 16px), so gridEnabled=false here.
  const getSnapInstance = useCallback(() => reactFlowInstanceRef.current, []);
  const { onNodeDrag: onSnapNodeDrag, onNodeDragStop: onSnapNodeDragStop } = useCanvasSnappingRef(
    getSnapInstance,
    { enabled: !locked, threshold: 6, gridEnabled: false }
  );

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
      toast.error(isPl ? t('myWorkIdeas.processFlowTool.validationFailedRetry') : message),
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
  // J26 (Kanał 2): when set, the AI panel's prompt drives `edit_step` (rewrite
  // this existing step in place) instead of the free-prompt generator.
  const [rewriteStepId, setRewriteStepId] = useState<string | null>(null);
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
  // #6p: minimal edge-properties popover — opens on a plain click on any
  // Process Flow edge (color/style/arrow/label), anchored at the click
  // point. Separate from `contextMenu` (right-click) so a left-click select
  // doesn't fight the existing selection/property-panel flow.
  const [edgeStylePopover, setEdgeStylePopover] = useState<{
    edgeId: string;
    x: number;
    y: number;
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
    return fullName || currentUser?.email || t('myWorkIdeas.processFlowTool.you');
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

  // Nadaj stan Cofnij/Ponów na wspólny autobus — lewy pasek czyta stąd, więc bez
  // tego jego przyciski były na Przepływie trwale wygaszone (mimo że sama akcja
  // `pf_undo`/`pf_redo` działała).
  useEffect(() => {
    emitIdeaUndoState('process_flow', canUndo, canRedo);
  }, [canUndo, canRedo]);
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
    (result: ApplyPatchResult): boolean => {
      if (locked) return false;
      // G4-PF-GUARDRAIL: AI generate/expand is a bulk add — check the WHOLE
      // batch before applying anything, not per-node (a per-node check here
      // would read a stale `nodes.length` across the batch and never catch
      // it). Blocked → the whole acceptance is refused (toast explains why);
      // `resolveProposal` (useProcessFlowAIProposal.ts) keeps the proposal
      // open on `false` so the user can reject/regenerate instead of it
      // silently vanishing.
      if (!guardAddNodes(result.addedNodeIds.length)) return false;
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
      toast.success(t('myWorkIdeas.processFlowTool.aiProposalApplied'), {
        duration: 1200,
      });
      return true;
    },
    [collab, guardAddNodes, isPl, locked, onNodeDetail, pushUndo, setEdges, setNodes]
  );

  const {
    activeProposal,
    isGenerating: isAIGenerating,
    error: aiError,
    createProposal,
    createStepRewriteProposal,
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

  // F-processflow-dead-actions: chat "stwórz proces X" (pf_create) — reuses
  // the real flow_generator AI pipeline above (same one the AI panel's
  // "Generate" button calls) instead of a no-op. Opens the panel so the
  // resulting proposal is visible/reviewable, matching the panel's own
  // accept/reject flow (Decision 5 in useProcessFlowAIProposal.ts).
  const createFromPrompt = useCallback(
    (prompt: string) => {
      if (locked || !prompt.trim()) return;
      setShowAIPanel(true);
      createProposal(prompt);
    },
    [locked, createProposal]
  );

  // J26 (Kanał 2): open the AI panel targeted at ONE step. The panel's prompt
  // becomes the rewrite instruction; `handleAIPanelGenerate` routes it to the
  // `edit_step` generator while `rewriteStepId` is set.
  const openStepRewrite = useCallback(
    (nodeId: string) => {
      if (locked || !nodeId) return;
      setRewriteStepId(nodeId);
      setShowAIPanel(true);
    },
    [locked]
  );

  const handleAIPanelGenerate = useCallback(
    (prompt: string) => {
      if (rewriteStepId) {
        createStepRewriteProposal({ nodeId: rewriteStepId, instruction: prompt });
        return;
      }
      createProposal(prompt);
    },
    [rewriteStepId, createStepRewriteProposal, createProposal]
  );

  // Clear the step-rewrite target after the proposal resolves or is dismissed,
  // so the next free-prompt generation is not mistargeted at a step.
  const handleAIPanelResolve = useCallback(
    (action: 'accept' | 'reject') => {
      resolveProposal(action);
      setRewriteStepId(null);
    },
    [resolveProposal]
  );

  const handleAIPanelDismiss = useCallback(() => {
    dismissProposal();
    setRewriteStepId(null);
  }, [dismissProposal]);

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

  // ── PASEK EDYCJI OBIEKTU (ff_canvasObjectEditBar) ──────────────────────
  // Zgłoszenie właściciela: „Wybór obiektu powinien uruchamiać pasek kontekstowy
  // z narzędziami do jego edycji, który z kolei powinien uruchamiać się w górnym
  // menu. Jak w innych narzędziach. Teraz nie mogę zmienić czcionek, kolorów
  // typu, koloru tła, kształtów obiektów, wielkości obiektów. Strzałek pomiędzy
  // obiektami. kierunku przepływu."
  //
  // UWAGA: w Procesie to NIE jest przeniesienie istniejących zdolności, tylko
  // ich BUDOWA — `ProcessFlowFloatingToolbar` nie miał ANI JEDNEJ kontrolki
  // stylu (tylko rename/duplicate/insert/links/comments/chat/delete), a
  // `FlowNodeComponent` w ogóle nie czytał kolorów z `node.data` (wygląd brał
  // wyłącznie z kształtu i toru). Krawędzie to jedyna część, która już istniała
  // (`EdgeStylePopover` po kliknięciu w krawędź) — tę pasek tylko WYSTAWIA.
  const handleFlowNodeStyleChange = useCallback(
    (patch: Record<string, unknown>) => {
      if (locked) return;
      const targetIds = (nodes as Node[]).filter((n) => n.selected).map((n) => n.id);
      if (targetIds.length === 0) return;
      pushUndo();
      setNodes((nds: Node[]) =>
        nds.map((n) => {
          if (!targetIds.includes(n.id)) return n;
          const nextData: Record<string, unknown> = { ...n.data };
          for (const [k, v] of Object.entries(patch)) {
            // `null` z palety = „skasuj mój wybór" i wróć do domyślnej barwy
            // kształtu/toru — kasujemy klucz zamiast zapisywać null.
            if (v === null) delete nextData[k];
            else nextData[k] = v;
          }
          const nextNode = { ...n, data: nextData };
          collab.broadcastNodeUpdate(nextNode);
          return nextNode;
        })
      );
    },
    [collab, locked, nodes, pushUndo, setNodes]
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

  // #6p: EdgeStylePopover handlers — color / stroke style / arrow direction.
  // Same shape as the handlers above (pushUndo → map → broadcast) so the new
  // fields ride the existing autosave/undo/collab plumbing untouched.
  const handleEdgeColorChange = useCallback(
    (edgeId: string, color: string | null) => {
      if (locked) return;
      pushUndo();
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== edgeId) return e;
          const nextEdge = { ...e, data: { ...e.data, edgeColor: color ?? undefined } };
          collab.broadcastEdgeUpdate(nextEdge);
          return nextEdge;
        })
      );
    },
    [collab, locked, pushUndo]
  );

  const handleEdgeStyleOverrideChange = useCallback(
    (edgeId: string, styleOverride: 'solid' | 'dashed') => {
      if (locked) return;
      pushUndo();
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== edgeId) return e;
          const nextEdge = { ...e, data: { ...e.data, strokeStyleOverride: styleOverride } };
          collab.broadcastEdgeUpdate(nextEdge);
          return nextEdge;
        })
      );
    },
    [collab, locked, pushUndo]
  );

  const handleEdgeArrowChange = useCallback(
    (edgeId: string, direction: 'none' | 'start' | 'end' | 'both') => {
      if (locked) return;
      pushUndo();
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== edgeId) return e;
          const nextEdge = { ...e, data: { ...e.data, arrowDirection: direction } };
          collab.broadcastEdgeUpdate(nextEdge);
          return nextEdge;
        })
      );
    },
    [collab, locked, pushUndo]
  );

  // P2-6 (menu krawedzi): odwroc kierunek = zamiana source<->target (i uchwytow).
  // Realna operacja strukturalna, odrebna od arrowDirection (ktory tylko rysuje
  // grot). Reszta danych krawedzi (etykieta/warunek/kolor/styl) bez zmian.
  const handleEdgeReverse = useCallback(
    (edgeId: string) => {
      if (locked) return;
      pushUndo();
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== edgeId) return e;
          const nextEdge: Edge = {
            ...e,
            source: e.target,
            target: e.source,
            sourceHandle: e.targetHandle ?? null,
            targetHandle: e.sourceHandle ?? null,
          };
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
            // B2 2026-07-27: `Math.floor(y / LANE_HEIGHT)` assumed every band is
            // exactly LANE_HEIGHT tall, so a collapsed (28px) or resized lane
            // made the drop land in a different lane than the one the user aimed
            // at. Now that the bands are painted where they really are, that
            // divergence would be plainly visible — use the same band walk the
            // painting uses (identical result for default-height lanes).
            const laneIdx = laneIndexAtY(lanes, n.position.y, LANE_HEIGHT);
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
            // B2 2026-07-27: same band walk as the drop above — the live
            // highlight must point at the band the drop will actually pick.
            const laneIdx = laneIndexAtY(lanes, dragNode.position.y, LANE_HEIGHT);
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
      const nextError = err?.message || t('myWorkIdeas.processFlowTool.failedLoad');
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
      if (!guardAddNodes(1)) return;
      pushUndo();

      // ── B1 (2026-07-27): „dodalem krok i nic sie nie stalo" ─────────────
      // Do dzis kazdy nowy wezel ladowal SZTYWNO w lanes[0], na pozycji
      // wyliczonej z liczby wezlow w tym torze — niezaleznie od zaznaczenia,
      // fokusu i kadru. Trzy mechanizmy potrafily go zjesc: zwiniety tor
      // (displayNodes odfiltrowuje — efekt TRWALY), przywrocony viewport
      // (pozycja poza kadrem) i tryb skupienia. Licznik „Kroki" rosl, plotno
      // stalo — stad zgloszenie „wszystkie przyciski martwe".
      const baseLanes = lanes.length > 0 ? lanes : DEFAULT_LANES;
      const laneById = (laneId: unknown) =>
        typeof laneId === 'string' ? baseLanes.find((l) => l.id === laneId) : undefined;

      const selectedNode = (nodes as Node[]).find((n) => n.selected);
      const focusNode = focusObjectId
        ? (nodes as Node[]).find((n) => n.id === focusObjectId)
        : undefined;

      // Gdy wolajacy zna miejsce (prawy klik, wstawka z czatu Teresy), tor
      // czytamy z TEGO miejsca — inaczej wezel mial etykiete jednego toru,
      // a lezal w pasie innego.
      const explicitPosition = overrides?.position;
      const laneFromPosition = explicitPosition
        ? baseLanes[laneIndexAtY(baseLanes, explicitPosition.y, LANE_HEIGHT)]
        : undefined;

      const lane =
        laneFromPosition ||
        laneById(selectedNode?.data?.laneId) ||
        laneById(focusNode?.data?.laneId) ||
        baseLanes.find((l) => !l.collapsed) ||
        baseLanes[0];

      // Nigdy nie wkladamy do zwinietego toru — rozwijamy go. To ta sama
      // migawka undo (pushUndo wyzej zrzuca rowniez `lanes`), wiec jeden
      // Ctrl+Z cofa i wezel, i rozwiniecie.
      const lanesAfter = lane.collapsed
        ? toggleLaneCollapsed(baseLanes, lane.id, false)
        : baseLanes;
      if (lane.collapsed) {
        setLanes(lanesAfter);
        collab.broadcastLanes?.(lanesAfter);
      }

      const bands = laneBandLayout(lanesAfter, LANE_HEIGHT);
      const band = bands[lane.id] ?? {
        top: Math.max(0, lanesAfter.indexOf(lane)) * LANE_HEIGHT,
        height: LANE_HEIGHT,
      };
      const laneY = band.top + Math.max(8, Math.round((band.height - NODE_BOX_H) / 2));

      // Srodek biezacego kadru zamiast wzoru „100 + N*200" — wezel ma sie
      // pojawic tam, GDZIE UZYTKOWNIK PATRZY.
      const rect = flowContainerRef.current?.getBoundingClientRect();
      let xBase: number;
      if (rect && rect.width > 0 && rect.height > 0) {
        const center = screenToFlow(rect.left + rect.width / 2, rect.top + rect.height / 2);
        xBase = Math.round(center.x - NODE_BOX_W / 2);
      } else {
        xBase = 100 + nodes.filter((n: Node) => n.data?.laneId === lane.id).length * 200;
      }
      const yBase = laneY;

      // Omijanie kolizji: szukamy wolnego miejsca w pasie toru, przesuwajac sie
      // co 40px NAPRZEMIENNIE w prawo i w lewo od srodka kadru. Samo „w prawo"
      // nie wystarcza — gesty rzad krokow (a taki jest typowy proces) wypychal
      // nowy wezel poza limit i konczyl sie nachodzeniem na istniejacy kafel.
      // Prog to pelna szerokosc kafla + luka: kafle rysuja sie szersze niz
      // NODE_BOX_W (etykieta rozciaga), wiec „srodki dalej niz polowa" bylo za malo.
      if (!explicitPosition) {
        const clearX = NODE_BOX_W + 20;
        const occupied = (x: number) =>
          (nodes as Node[]).some(
            (n) =>
              Math.abs((n.position?.x ?? 0) - x) < clearX &&
              Math.abs((n.position?.y ?? 0) - yBase) < NODE_BOX_H
          );
        if (occupied(xBase)) {
          const origin = xBase;
          for (let step = 1; step <= 20; step += 1) {
            const right = origin + step * 40;
            if (!occupied(right)) {
              xBase = right;
              break;
            }
            const left = origin - step * 40;
            if (!occupied(left)) {
              xBase = left;
              break;
            }
            if (step === 20) xBase = right;
          }
        }
      }

      const position = explicitPosition
        ? // Tor byl zwiniety → pas wlasnie urosl, wiec Y trzeba wciagnac do
          // nowego pasa; inaczej pozycje wolajacego zostawiamy nietkniete.
          lane.collapsed
          ? { x: explicitPosition.x, y: laneY }
          : explicitPosition
        : { x: xBase, y: yBase };

      const id = `pf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      // V5-IDEA-23: Use rich VSM node type when in VSM mode
      const isVsmShape = shape.startsWith('vsm_');
      const resolvedType = flowMode === 'vsm' && isVsmShape ? shape : 'flowNode';

      const newNode: Node = {
        id,
        type: resolvedType,
        position,
        // Nowy krok od razu zaznaczony: podswietlenie + plywajacy pasek i panel
        // wlasciwosci celuja we wlasciwy wezel bez dodatkowego klikniecia.
        selected: true,
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
      setNodes((prev: Node[]) => {
        const next = [
          ...prev.map((n: Node) => (n.selected ? { ...n, selected: false } : n)),
          newNode,
        ];
        // setNodes z zaznaczeniem nie przechodzi przez onNodesChange, wiec
        // pasek/panel trzeba powiadomic recznie — inaczej celowalyby w stary wybor.
        handleSelectionUpdate(next);
        return next;
      });
      collab.broadcastNodeAdd(newNode); // F3: realtime add

      // Kadr: viewport jest PERSYSTOWANY (extensions.processFlow.viewState), wiec
      // bezwarunkowe centrowanie skasowaloby zapisany widok uzytkownika.
      // Przesuwamy sie tylko wtedy, gdy nowy wezel wypadlby poza kadr — a to
      // realnie zdarza sie po przywroceniu zapisanego viewportu.
      if (rect && rect.width > 0 && rect.height > 0) {
        const topLeft = screenToFlow(rect.left, rect.top);
        const bottomRight = screenToFlow(rect.right, rect.bottom);
        const cx = position.x + NODE_BOX_W / 2;
        const cy = position.y + NODE_BOX_H / 2;
        const margin = 24;
        const outside =
          cx < topLeft.x + margin ||
          cx > bottomRight.x - margin ||
          cy < topLeft.y + margin ||
          cy > bottomRight.y - margin;
        if (outside) {
          const zoom = reactFlowInstanceRef.current?.getViewport?.()?.zoom ?? 1;
          reactFlowInstanceRef.current?.setCenter?.(cx, cy, { zoom, duration: 300 });
        }
      }

      toast.success(
        isPl
          ? `Dodano krok: ${String(newNode.data?.label ?? '')}`.trim()
          : `Step added: ${String(newNode.data?.label ?? '')}`.trim(),
        { duration: 2000 }
      );

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
                position: { x: position.x + 200 + i * 180, y: position.y },
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
      flowMode,
      focusObjectId,
      guardAddNodes,
      handleSelectionUpdate,
      i18n.language,
      ideaId,
      isPl,
      lanes,
      locked,
      nodes,
      onNodeDetail,
      pushUndo,
      screenToFlow,
      semanticKit,
      setLanes,
      setNodes,
    ]
  );

  // ── V5-IDEA-21: Insert step between two connected nodes ─────────────────
  const insertBetween = useCallback(() => {
    if (locked) return;
    // P1-4: akcja wymagala zaznaczonej KRAWEDZI, ale jej jedyny przycisk wisi na
    // plywajacym pasku WEZLA — a pasek pokazuje sie tylko przy zaznaczonym wezle.
    // Te dwa stany sie wykluczaja, wiec przycisk KAZDORAZOWO konczyl sie bledem.
    // Gdy krawedzi nie zaznaczono, wnioskujemy ja z zaznaczonego wezla — ale
    // tylko gdy wybor jest JEDNOZNACZNY (dokladnie jedno wyjscie). Przy wielu
    // wyjsciach nie zgadujemy, tylko mowimy, czego brakuje.
    let selectedEdge = (edges as Edge[]).find((e) => e.selected);
    if (!selectedEdge) {
      const zaznaczoneWezly = (nodes as Node[]).filter((n) => n.selected);
      if (zaznaczoneWezly.length === 1) {
        const wyjscia = (edges as Edge[]).filter((e) => e.source === zaznaczoneWezly[0].id);
        if (wyjscia.length === 1) {
          selectedEdge = wyjscia[0];
        } else if (wyjscia.length > 1) {
          toast.error(
            isPl
              ? 'Ten krok ma kilka wyjść — zaznacz połączenie, na którym mam wstawić krok.'
              : 'This step has several outgoing paths — select the connection to insert into.'
          );
          return;
        } else {
          toast.error(
            isPl
              ? 'Ten krok nie ma jeszcze połączenia wyjściowego — nie ma między czym wstawiać.'
              : 'This step has no outgoing connection yet — there is nothing to insert between.'
          );
          return;
        }
      }
    }
    if (!selectedEdge) {
      toast.error(t('myWorkIdeas.processFlowTool.selectEdgeFirst'));
      return;
    }
    if (!guardAddNodes(1)) return;
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
        label: t('myWorkIdeas.processFlowTool.newStep'),
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
    toast.success(t('myWorkIdeas.processFlowTool.stepInserted'), { duration: 800 });
  }, [
    collab,
    edges,
    flowMode,
    guardAddNodes,
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
      toast.error(t('myWorkIdeas.processFlowTool.selectDecisionNode'));
      return;
    }
    if (!guardAddNodes(1)) return;
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
        label: t('myWorkIdeas.processFlowTool.alternativePath'),
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
    toast.success(t('myWorkIdeas.processFlowTool.pathSplit'), { duration: 800 });
  }, [
    collab,
    flowMode,
    guardAddNodes,
    isPl,
    lanes,
    locked,
    nodes,
    onNodeDetail,
    pushUndo,
    setEdges,
    setNodes,
  ]);

  // ── Add lane ───────────────────────────────────────────────────────────

  const addLane = useCallback(() => {
    if (locked) return;
    pushUndo();
    const idx = lanes.length;
    const newLane: Lane = {
      id: `lane-${Date.now()}`,
      label: t('myWorkIdeas.processFlowTool.laneDefaultName', 'Lane {{index}}', {
        index: idx + 1,
      }),
      color: LANE_COLORS[idx % LANE_COLORS.length],
    };
    setLanes((prev: Lane[]) => {
      const nextLanes = [...prev, newLane];
      collab.broadcastLanes(nextLanes); // F3: full Lane[] replacement
      return nextLanes;
    });
    // PF-P2-02: hand focus straight to inline naming for the lane just created.
    setNewLaneId(newLane.id);
  }, [collab, lanes.length, locked, pushUndo, t]);

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
      toast.error(t('myWorkIdeas.processFlowTool.selectProcessStepFirst'));
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
    toast.success(t('myWorkIdeas.processFlowTool.stepMetricsSaved'), { duration: 900 });
  }, [collab, isPl, locked, metricsDraft, metricsEditorNodeId, pushUndo]);

  const runSavingsAnalysis = useCallback(async () => {
    if (locked || savingsLoading) return;
    if (nodes.length === 0) {
      toast.error(t('myWorkIdeas.processFlowTool.addProcessStepsFirst'));
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
        toast(t('myWorkIdeas.processFlowTool.noNewSavingsRecommendations'), {
          icon: '🤖',
        });
      }
    } catch (error: any) {
      toast.error(error?.message || t('myWorkIdeas.processFlowTool.failedRunSavingsAnalysis'));
    } finally {
      setSavingsLoading(false);
    }
  }, [edges, i18n.language, ideaId, isPl, lanes, locked, nodes, savingsLoading]);

  // ── Node CRUD + Lane management (extracted to useProcessFlowNodes) ─────
  const {
    deleteSelected,
    duplicateSelected,
    copySelected,
    copyNodeById,
    pasteClipboard,
    clipboardCount,
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
        title: t('myWorkIdeas.processFlowTool.deleteNodes'),
        description: t('myWorkIdeas.processFlowTool.deleteNodesConfirm', { value: count }),
        confirmLabel: t('myWorkIdeas.processFlowTool.delete'),
        cancelLabel: t('myWorkIdeas.processFlowTool.cancel'),
        variant: 'danger',
      }),
    // G4-LANE-DELETE: `handleLaneDelete` refuses (instead of silently doing
    // nothing) when asked to delete the only remaining lane. Surface that
    // refusal — same toast.error pattern as selectEdgeFirst/selectDecisionNode
    // above.
    onLaneDeleteBlocked: () =>
      toast.error(t('myWorkIdeas.processFlowTool.cannotDeleteLastLane')),
  });

  // ── F5a A3: lane collapse / resize (state in lanes[].{collapsed,height}) ──
  // RISK-30 (S5-TERESA, 2026-08-12): szósty handler toru — jedyny mieszkający
  // tutaj, a nie w `useProcessFlowNodes.ts`. Zwraca `LaneOpOutcome` z tego
  // samego powodu co pozostałe pięć: bez tego rejestr akcji meldował Teresie
  // sukces zwinięcia toru, którego nie było (blokada / nieznany `laneId`).
  const handleLaneToggleCollapse = useCallback(
    (laneId: string): LaneOpOutcome => {
      if (locked) return { ok: false, reason: 'locked' };
      if (!lanes.some((l) => l.id === laneId)) return { ok: false, reason: 'unknown_lane' };
      pushUndo();
      setLanes((prev) => {
        const next = toggleLaneCollapsed(prev, laneId);
        collab.broadcastLanes?.(next);
        return next;
      });
      return { ok: true };
    },
    [collab, lanes, locked, pushUndo, setLanes]
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
    toast.success(t('myWorkIdeas.processFlowTool.autoLayoutApplied'), {
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
      toast.error(err?.message || t('myWorkIdeas.processFlowTool.failed'));
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
      toast.error(err?.message || t('myWorkIdeas.processFlowTool.failed'));
    } finally {
      setSummaryLoading(false);
    }
  }, [edges, i18n.language, ideaId, isPl, lanes, locked, nodes, summaryLoading]);

  // ── Quick action listener (extracted to useProcessFlowQuickActions) ─────
  // Placed after handleAICoach/createFromPrompt so both are defined before
  // being referenced here.
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
      createFromPrompt,
      runProcessCoach: handleAICoach,
      // Action Registry — N6.4 (2026-08-10): „Podsumowanie" z menu „Więcej"
      // paska Przepływu (`idea.ai.pf_process_summary`, runtime `pf_summary`).
      // TA SAMA funkcja, którą dostaje prop `generateSummary` toolbaru niżej —
      // zero nowej ścieżki wykonania, tylko drugie (Teresy) wejście do niej.
      generateSummary: handleProcessSummary,
      // P1-1: „Auto-układ" z Menu 3 → realny układ Przepływu (wcześniej Menu 3
      // wysyłało zdarzenie Mapy myśli, więc w Przepływie klik nie robił nic).
      autoLayout: handleAutoLayout,
      // Z1: tryb kursora z lewego raila — realnie przestawia płótno (niżej,
      // spread getIdeaCanvasCursorProps na <ReactFlow>).
      setCursorMode: (mode) => setCursorMode(mode),
      // D2 2026-07-28: siatka i przyciąganie — te same dwie funkcje co przed
      // przeprowadzką, tylko wołane teraz z lewego raila zamiast z nakładki
      // zasłaniającej pstryczek toru.
      toggleGrid: () => setShowGrid((prev) => !prev),
      toggleSnap: () => setSnapToGridEnabled((prev) => !prev),
      // Action Registry — Process Flow edge menu (2026-08-09): bus path for
      // Teresa/non-UI callers of `idea.edge.pf_edit_props`/`idea.edge.reverse`/
      // `idea.edge.pf_condition_*` (see ideaActionRegistry.ts). The UI
      // right-click path (getEdgeContextActions call site below) is
      // untouched — it keeps calling these exact same functions directly.
      openEdgeStylePopover: (edgeId: string) => setEdgeStylePopover({ edgeId, x: 240, y: 240 }),
      reverseEdge: (edgeId: string) => handleEdgeReverse(edgeId),
      setEdgeCondition: (edgeId: string, condition: string) =>
        handleEdgeConditionChange(edgeId, condition),
      // Action Registry — Process Flow node menu (2026-08-09): bus path for
      // Teresa's `idea.node.pf_ai_rewrite_step`. UI click (`onAIRewriteStep`
      // in the getNodeContextActions call site below) still calls
      // `openStepRewrite(rewriteNodeId)` alone — untouched. Teresa supplies
      // the instruction up front, so this does both steps: open panel +
      // generate immediately.
      startAIRewriteStep: (nodeId: string, instruction: string) => {
        if (locked || !nodeId || !instruction.trim()) return;
        setRewriteStepId(nodeId);
        setShowAIPanel(true);
        createStepRewriteProposal({ nodeId, instruction });
      },
      // Action Registry — Process Flow LANE controls (2026-08-10): bus path
      // for Teresa's `idea.lane.pf_*` (see ideaActionRegistry.ts). The UI
      // path — `LaneSystem.tsx` header buttons via the `onRename`/`onMoveUp`/
      // `onMoveDown`/`onColorChange`/`onToggleCollapse`/`onDelete` props below
      // (`<LaneSystemViewportLayer>`) — is untouched, calling these exact
      // same functions directly.
      renameLane: handleLaneRename,
      moveLaneUp: handleLaneMoveUp,
      moveLaneDown: handleLaneMoveDown,
      setLaneColor: handleLaneColorChange,
      toggleLaneCollapse: handleLaneToggleCollapse,
      deleteLane: handleLaneDelete,
    },
    setters: {
      setFlowMode,
      setSemanticKit,
      setNodes,
    },
  });

  // Z1: rozgłoszenie realnego trybu płótna do lewego raila (rail trzyma stan
  // Mapy myśli i inaczej nie wie, czy Przepływ faktycznie go przyjął).
  useEffect(() => {
    if (!open) return;
    publishIdeaCanvasCursorMode('process_flow', cursorMode);
  }, [cursorMode, open]);

  // D2 2026-07-28: to samo dla siatki/przyciągania — rail rysuje stan włączenia
  // obu pstryczków, a stan mieszka tutaj (i wraca z hydracji, bug L-04).
  useEffect(() => {
    if (!open) return;
    publishProcessFlowGridState({ showGrid, snap: snapToGridEnabled });
  }, [open, showGrid, snapToGridEnabled]);

  // ── Accept ghost node → convert to real node ──────────────────────────

  const acceptGhostNode = useCallback(
    (ghostId: string) => {
      const ghost = ghostNodes.find((g) => g.id === ghostId);
      if (!ghost) return;
      if (!guardAddNodes(1)) return;
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
      toast.success(t('myWorkIdeas.processFlowTool.stepAccepted'), { duration: 800 });
    },
    [collab, ghostNodes, guardAddNodes, isPl, locked, onNodeDetail, pushUndo, setNodes]
  );

  // ── Save ───────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (locked) return;
    try {
      await persistSave(buildPersistPayload(), {
        reason: 'manual',
        createSnapshot: true,
        snapshotLabel: t('myWorkIdeas.processFlowTool.processFlowCheckpoint'),
      });
      toast.success(t('myWorkIdeas.processFlowTool.saved'), { duration: 900 });
      onSaved?.();
    } catch (err: any) {
      toast.error(err?.message || t('myWorkIdeas.processFlowTool.failedSave'));
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
    // E02-N6-NODE fix: accepts an optional explicit node-id list so a
    // right-clicked node (which PF does NOT auto-select — see onCopy's
    // "prawy klik go nie zaznacza" handling below) can be targeted precisely
    // instead of falling back to whatever happens to be selected elsewhere
    // in the workspace. The event field is `nodeIds` — matching the receiver
    // (IdeaMapWorkspace's CONVERT_PREFIX_MAP branch reads eventDetail.nodeIds)
    // and the same contract Whiteboard's wb_convert_* dispatches already use
    // (WhiteboardSelectionBar's `selectedNodeIds` → `nodeIds`). The previous
    // `selectedIds` key was never read by the receiver and was silently dead.
    (action: string, explicitNodeIds?: string[]) => {
      if (onQuickAction) {
        const nodeIds = explicitNodeIds?.length
          ? explicitNodeIds
          : nodes.filter((n) => n.selected).map((n) => n.id);
        onQuickAction(action, { nodeIds, activeTool: 'process_flow' });
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

  /** Domyslny ksztalt „nowego kroku" dla biezacego trybu przeplywu. */
  const addDefaultStep = useCallback(() => {
    const shape: FlowShape =
      flowMode === 'automation' ? 'auto_trigger' : flowMode === 'vsm' ? 'vsm_process' : 'action';
    addNode(shape);
  }, [addNode, flowMode]);

  // Reconciliacja z Rejestrem Akcji (2026-08-10, E02 DoD) — patrz analogiczny
  // komentarz w `IdeaMapWorkspace.tsx`/`IdeaWhiteboardTool.tsx`. `onDeselect`
  // i `onFitView` ŚWIADOMIE NIE przechodzą przez rejestr (stan
  // zaznaczenia/kamery, zero mutacji treści, ta sama kategoria co Mapy myśli
  // `onFocusSelection`). `onAddChild`/`onAddSibling` (Tab/Enter →
  // `addDefaultStep`) TEŻ ŚWIADOMIE NIE są routowane mimo że
  // `idea.element.add` istnieje z runtime `pf_add_step` dla Przepływu —
  // SPRAWDZONE w kodzie: `addDefaultStep` dobiera KSZTAŁT węzła wg
  // `flowMode` (auto_trigger/vsm_process/action), a odbiornik `pf_add_step`
  // (`useProcessFlowQuickActions.ts:158`) ZAWSZE tworzy `'action'` —
  // realna różnica zachowania w trybach automation/vsm, nie genuine reuse
  // (ta sama ostrożność co przy `idea.edge.insert_node`/`.delete`
  // nie-reużytych między Mapą myśli a Przepływem).
  const runPfKeyboardAction = useCallback(
    (actionId: string, run: () => void) => {
      const ctx: ActionContext = {
        ideaId,
        tool: 'process_flow',
        selection: EMPTY_SELECTION,
        surface: 'context',
        source: 'ui',
        language: isPl ? 'pl' : 'en',
        params: { run },
      };
      void runIdeaAction(actionId, ctx);
    },
    [ideaId, isPl]
  );

  /**
   * N-inventory-c4 (2026-08-10): empty-canvas CTA "Dodaj pierwszy krok" now
   * routes through the registry (`idea.view.pf_add_start`, NEW id — see
   * `RUNTIME_PF_ADD_START` comment in ideaActionRegistry.ts for why this is
   * NOT a reuse of `idea.element.add`: shape mismatch, same trap as
   * `addDefaultStep` above). `ctx.params.vsm` carries the mode branch the
   * handler needs (start vs vsm_process) since the registry has no notion of
   * Process Flow sub-modes.
   */
  const runPfAddStartAction = useCallback(() => {
    const ctx: ActionContext = {
      ideaId,
      tool: 'process_flow',
      selection: EMPTY_SELECTION,
      surface: 'inline',
      source: 'ui',
      language: isPl ? 'pl' : 'en',
      params: { vsm: flowMode === 'vsm' },
    };
    void runIdeaAction('idea.view.pf_add_start', ctx);
  }, [ideaId, isPl, flowMode]);

  /**
   * PF-P3-01: lane-aware "Fit view" — a plain `fitView()` only bounds actual
   * ReactFlow nodes, but Process Flow's swimlanes are painted OUTSIDE the
   * node graph (see `LaneSystem.tsx`), so it silently crops an empty or
   * over-tall lane. `computeLaneAwareFitBounds` unions the node bounds with
   * the FULL lane stack height so "Fit view" actually fits every lane and
   * node, not just the nodes. Shared by BOTH entry points — the corner
   * button (`CanvasZoomControls onFitView`) and the `Shift+1` keyboard
   * shortcut — so they agree instead of drifting apart again.
   */
  const handleFitAllLanesAndNodes = useCallback(() => {
    // Prefer the live instance's measured nodes (real rendered width/height
    // via ResizeObserver) over the raw `nodes` state, which does not carry
    // those dimensions — falls back to `nodes` before the instance mounts.
    const measuredNodes = reactFlowInstanceRef.current?.getNodes?.() ?? nodes;
    const bounds = computeLaneAwareFitBounds(measuredNodes, lanes, LANE_HEIGHT);
    reactFlowInstanceRef.current?.fitBounds(bounds, { padding: 0.2, duration: 300 });
  }, [nodes, lanes]);

  // P3: shared grammar (Tab/Enter/F2/Delete/Escape/Ctrl+Z/S/D/L/0)
  // F-K1 fix (G4-KBD-P0, 2026-08-11): `containerRef` scopes the grammar to
  // genuine focus within the canvas (see useIdeasToolKeyboard.ts) — this
  // call site never passed it before, so Tab was hijacked globally while
  // Process Flow was merely `open`, breaking keyboard navigation anywhere
  // else on the page.
  useCanvasKeyboard({
    toolType: 'processflow',
    enabled: open,
    locked: locked || false,
    containerRef: flowContainerRef as React.RefObject<HTMLElement | null>,
    callbacks: {
      onSave: () => runPfKeyboardAction('idea.canvas.pf_save', handleSave),
      onUndo: () => runPfKeyboardAction('idea.canvas.undo', undo),
      onRedo: () => runPfKeyboardAction('idea.canvas.redo', redo),
      onDuplicate: () => runPfKeyboardAction('idea.node.duplicate', duplicateSelected),
      onAutoLayout: () => runPfKeyboardAction('idea.view.auto_layout', handleAutoLayout),
      onFitView: handleFitAllLanesAndNodes,
      onEditSelected: () =>
        runPfKeyboardAction('idea.node.pf_properties', () => setShowPropertiesPanel(true)),
      onDeleteSelected: () => runPfKeyboardAction('idea.node.delete', deleteSelected),
      onDeselect: () => {
        setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
        setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
        onSelectionChange?.(EMPTY_SELECTION);
      },
      // Tab i Enter robia w Przeplywie to samo — nowy krok. Kontrakt skrotow
      // (useIdeasToolKeyboard) mapuje Tab na `onAddChild`, ktorego Przeplyw
      // NIGDY nie podawal, wiec Tab byl tu martwym klawiszem (w odroznieniu od
      // mapy mysli proces nie ma hierarchii rodzic-dziecko — jest nastepny krok).
      onAddChild: () => addDefaultStep(),
      onAddSibling: () => addDefaultStep(),
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

      // A6: Shift+1 = zoom to fit (layout-independent via e.code).
      // PF-P3-01: was calling the RAW `fitView()` here — the exact plain,
      // non-lane-aware call the corner button and Ctrl/Cmd+0 (both routed
      // through `handleFitAllLanesAndNodes`, see its own doc comment above)
      // were fixed to stop calling, because it crops an empty/over-tall
      // trailing lane. This third entry point had silently drifted back to
      // the buggy behavior — call the same lane-aware handler so all three
      // (button, Ctrl/Cmd+0, Shift+1) agree.
      if (e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && e.code === 'Digit1') {
        e.preventDefault();
        handleFitAllLanesAndNodes();
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
    handleFitAllLanesAndNodes,
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
        // G4-PF-GUARDRAIL: cross-tool conversion/import is a bulk add — check
        // the WHOLE batch up front. `addNode`'s own per-call guard below
        // reads `nodes.length` from a closure that this synchronous forEach
        // never lets React re-render, so it would see the SAME stale count
        // on every iteration and never catch a batch that blows past the
        // cap. Blocked → refuse the whole insert (toast explains why),
        // matching Whiteboard's all-or-nothing convention rather than a
        // partial/truncated insert.
        if (!guardAddNodes(detail.items.length)) return;
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
  }, [addNode, flowMode, guardAddNodes, ideaId, open, semanticKit]);

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

  // ── Model paska edycji obiektu ────────────────────────────────────────────
  const pfEditBarSlot = useObjectEditBarSlot();
  const pfEditBarTarget = selectedNode ? 'node' : selectedEdge ? 'edge' : null;
  const pfEditBarDocked =
    isCanvasObjectEditBarEnabled() && !!pfEditBarSlot && !!pfEditBarTarget && !locked;

  const pfEditBarModel = useMemo(() => {
    if (!pfEditBarDocked) return null;

    // ── KRAWĘDŹ: etykieta · typ · kolor linii · styl · strzałki · kierunek ───
    if (pfEditBarTarget === 'edge' && selectedEdge) {
      const edgeId = selectedEdge.id;
      const edgeData = (selectedEdge.data || {}) as Record<string, any>;
      // PF-P2-03: any selected edge must expose its CURRENT semantic label and
      // condition type here, not only inside the click-positioned
      // `EdgeStylePopover` (which only appears the instant you click — a
      // Teresa-driven or keyboard selection never triggers it). Same
      // underlying handlers as the right-click menu (`getEdgeContextActions`)
      // and `EdgeStylePopover` — one mutation path, three surfaces.
      const currentLabel = String(selectedEdge.label ?? edgeData.label ?? '');
      const currentCondition = String(edgeData.conditionType ?? '');
      const currentConditionEntry =
        EDGE_CONDITIONS.find((c) => c.id === currentCondition) ?? EDGE_CONDITIONS[0];
      const truncate = (s: string, max: number) =>
        s.length > max ? `${s.slice(0, max - 1)}…` : s;
      return {
        title: t('canvasEditBar.titleEdge', 'Połączenie'),
        groups: [
          {
            id: 'edge-semantics',
            controls: [
              {
                kind: 'popover' as const,
                id: 'edge-label',
                icon: Tag,
                label: t('canvasEditBar.edgeLabel', 'Etykieta'),
                text: currentLabel ? truncate(currentLabel, 14) : undefined,
                align: 'center' as const,
                render: (close: () => void) => (
                  <TextInputPopover
                    title={t('canvasEditBar.edgeLabel', 'Etykieta')}
                    value={currentLabel}
                    placeholder={t('processFlow.edgeStylePopover.label', 'Label')}
                    onCommit={(next) => handleEdgeLabelChange(edgeId, next)}
                    close={close}
                  />
                ),
              },
              {
                kind: 'popover' as const,
                id: 'edge-condition',
                icon: GitBranch,
                label: t('canvasEditBar.edgeCondition', 'Typ połączenia'),
                text: isPl ? currentConditionEntry.pl : currentConditionEntry.en,
                align: 'center' as const,
                render: (close: () => void) => (
                  <MenuListPopover
                    title={t('canvasEditBar.edgeCondition', 'Typ połączenia')}
                    close={close}
                    items={EDGE_CONDITIONS.map((c) => ({
                      id: c.id || 'none',
                      label: isPl ? c.pl : c.en,
                      active: (currentCondition ?? '') === c.id,
                      onClick: () => handleEdgeConditionChange(edgeId, c.id),
                    }))}
                  />
                ),
              },
            ],
          },
          {
            id: 'edge-look',
            controls: [
              {
                kind: 'popover' as const,
                id: 'line-color',
                icon: Palette,
                label: t('canvasEditBar.lineColor', 'Kolor linii'),
                swatch: (edgeData.edgeColor as string) ?? null,
                render: (close: () => void) => (
                  <ColorPalettePopover
                    title={t('canvasEditBar.lineColor', 'Kolor linii')}
                    resetLabel={t('canvasEditBar.resetDefault', 'Domyślny')}
                    value={edgeData.edgeColor}
                    onPick={(c) => handleEdgeColorChange(edgeId, c)}
                    close={close}
                  />
                ),
              },
              {
                kind: 'popover' as const,
                id: 'line-style',
                icon: Minus,
                label: t('canvasEditBar.lineStyle', 'Styl linii'),
                render: (close: () => void) => (
                  <MenuListPopover
                    title={t('canvasEditBar.lineStyle', 'Styl linii')}
                    close={close}
                    items={[
                      {
                        id: 'solid',
                        label: t('canvasEditBar.lineSolid', 'Ciągła'),
                        icon: Minus,
                        onClick: () => handleEdgeStyleOverrideChange(edgeId, 'solid'),
                      },
                      {
                        id: 'dashed',
                        label: t('canvasEditBar.lineDashed', 'Kreskowana'),
                        icon: MoreHorizontal,
                        onClick: () => handleEdgeStyleOverrideChange(edgeId, 'dashed'),
                      },
                    ]}
                  />
                ),
              },
            ],
          },
          {
            id: 'edge-flow',
            controls: [
              {
                kind: 'popover' as const,
                id: 'arrows',
                icon: MoveRight,
                label: t('canvasEditBar.arrowTitle', 'Strzałki i kierunek'),
                align: 'center' as const,
                render: (close: () => void) => (
                  <ArrowDirectionPopover
                    value={edgeData.arrowDirection}
                    onPick={(direction) => handleEdgeArrowChange(edgeId, direction)}
                    close={close}
                  />
                ),
              },
              {
                kind: 'button' as const,
                id: 'reverse',
                icon: Repeat,
                // Odwrócenie kierunku PRZEPŁYWU (zamiana źródła i celu) — to co
                // innego niż sam grot strzałki wyżej, dlatego osobny przycisk.
                label: t('canvasEditBar.reverseFlow', 'Odwróć kierunek przepływu'),
                onClick: () => handleEdgeReverse(edgeId),
              },
              {
                // PF-P2-03: safe delete for the selected edge, same
                // `deleteSelected()` the right-click menu's "Delete
                // connection" and Delete/Backspace already use — the edge is
                // the live selection (`selectedEdge`), so no id needs passing.
                kind: 'button' as const,
                id: 'delete',
                icon: Trash2,
                label: t('processFlow.contextMenu.edgeDelete', 'Delete connection'),
                tone: 'danger' as const,
                onClick: () => deleteSelected(),
              },
            ],
          },
        ],
      };
    }

    // ── WĘZEŁ: typografia · tło · ramka · kształt · akcje ────────────────────
    if (!selectedNode) return null;
    const nodeData = (selectedNode.data || {}) as Record<string, any>;
    const styleGroups = buildStyleGroups({
      style: readCanvasObjectStyle(nodeData),
      onPatch: handleFlowNodeStyleChange,
      t,
      disabled: locked,
      show: { shape: true },
    });

    return {
      title: t('canvasEditBar.titleNode', 'Węzeł'),
      groups: [
        ...styleGroups,
        {
          id: 'pf-actions',
          controls: [
            {
              kind: 'button' as const,
              id: 'rename',
              icon: Edit3,
              label: t('processFlow.floatingToolbar.rename', 'Rename'),
              onClick: () => setShowPropertiesPanel(true),
            },
            {
              kind: 'button' as const,
              id: 'duplicate',
              icon: Copy,
              label: t('processFlow.floatingToolbar.duplicate', 'Duplicate'),
              onClick: duplicateSelected,
            },
            {
              kind: 'button' as const,
              id: 'insert-between',
              icon: GitMerge,
              label: t('processFlow.floatingToolbar.insertBetween', 'Insert between'),
              onClick: insertBetween,
            },
            {
              kind: 'button' as const,
              id: 'comments',
              icon: MessageCircle,
              label: t('processFlow.floatingToolbar.comments', 'Comments'),
              badge: Array.isArray(nodeData.comments) ? nodeData.comments.length : 0,
              onClick: () => setCommentsPanelNodeId(selectedNode.id),
            },
            {
              kind: 'button' as const,
              id: 'delete',
              icon: Trash2,
              label: t('processFlow.floatingToolbar.delete', 'Delete'),
              tone: 'danger' as const,
              onClick: deleteSelected,
            },
          ],
        },
      ],
    };
  }, [
    pfEditBarDocked,
    pfEditBarTarget,
    selectedEdge,
    selectedNode,
    locked,
    t,
    isPl,
    handleEdgeLabelChange,
    handleEdgeConditionChange,
    handleEdgeColorChange,
    handleEdgeStyleOverrideChange,
    handleEdgeArrowChange,
    handleEdgeReverse,
    handleFlowNodeStyleChange,
    duplicateSelected,
    insertBetween,
    deleteSelected,
  ]);

  if (!open) return null;

  // Perf measurement (docs/qa/ideas-complete-transformation-2026-08-09/
  // 17_PERFORMANCE_MEASUREMENT.md): Process Flow mounted every node's DOM
  // unconditionally (no `onlyRenderVisibleElements`) AND — unlike Whiteboard
  // (500-node hard block in `addElement`) or Mind Map (500-node warning
  // banner) — has no product-level node-count ceiling at all. Threshold
  // matches Mind Map's (M06 Fala 3.3, mindmap/virtualization.ts) for
  // consistency. Deliberately NOT behind a new feature flag (kept inside
  // this file per the fix's scope) — per CLAUDE.md rule #7/#9 this still
  // needs a screenshot-acceptance pass before it ships to demo, since it
  // changes what's mounted in the DOM.
  const onlyRenderVisibleElements = nodes.length >= 300;

  return (
    <div
      className="w-full h-full flex flex-col bg-c-bg relative"
      role="region"
      aria-label={t('myWorkIdeas.processFlowTool.processFlowEditor')}
    >
      {/* Pasek trybu/ksztaltow to pasek chrome, wiec `z-sticky` (20) wg skali
          warstw z tailwind.config.

          Bylo tu surowe `z-[60]` — obejscie z 2026-06-20, zeby pasek nie chowal
          sie pod kartka odkrywania (IdeaCanvasDiscovery, z-[57]). Powod odpadl:
          IdeaCanvasDiscovery zostal usuniety jako martwy kod (P3-1). Obejscie
          zostalo i szkodzilo: 60 == `z-modal`, wiec pasek rysowal sie NAD oknem
          Eksport/Import i przecinal je w polowie. */}
      <div className="relative z-sticky">
        <ProcessFlowToolbar
          isPl={!!isPl}
          locked={locked}
          hideSaveIndicator={hideSaveIndicator}
          flowMode={flowMode}
          setFlowMode={setFlowMode}
          semanticKit={semanticKit}
          availableShapes={availableShapes}
          addNode={addNode}
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
        />
      </div>

      {loadError &&
        !loading &&
        nodes.length === 0 &&
        (vf1CanvasSpecAEnabled ? (
          // VF1 SPEC-A (flag OFF default): canonical full-surface canvas error
          // with retry EXIT; legacy inline block stays default.
          <div className="flex-1">
            <ErrorState
              compact
              title={t('myWorkIdeas.processFlowTool.processFlowTemporarilyUnavailable')}
              description={t('myWorkIdeas.processFlowTool.thisDoesMeanProcessEmptyRetry')}
              onRetry={hydrate}
              retryLabel={t('myWorkIdeas.processFlowTool.retry')}
            />
          </div>
        ) : (
          <div className="px-4 pt-3">
            <EmptyStateInline
              icon={AlertTriangle}
              dashed={false}
              message={t('myWorkIdeas.processFlowTool.processFlowTemporarilyUnavailable')}
              hint={t('myWorkIdeas.processFlowTool.thisDoesMeanProcessEmptyRetry')}
              action={{
                label: t('myWorkIdeas.processFlowTool.retry'),
                onClick: hydrate,
              }}
              className="mb-2"
            />
          </div>
        ))}

      {locked && (
        <div className="px-4 pt-3">
          <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-4 py-3 text-sm text-c-text-secondary">
            <div className="font-medium text-c-text">
              {t('myWorkIdeas.processFlowTool.readOnlyMode')}
            </div>
            <div className="mt-1 text-xs text-c-text-muted">
              {t('myWorkIdeas.processFlowTool.youCanReviewFlowButEditing')}
            </div>
          </div>
        </div>
      )}

      {/* Warnings panel */}
      {showWarnings && warnings.length > 0 && (
        <div className="px-4 py-2 bg-amber-50/80 dark:bg-amber-900/20 border-b border-amber-200/60 dark:border-amber-700/40 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              {t('myWorkIdeas.processFlowTool.warningsCount', { value: warnings.length })}
            </span>
            <button
              onClick={() => setShowWarnings(false)}
              className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline"
            >
              {t('myWorkIdeas.processFlowTool.close')}
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
              {t('myWorkIdeas.processFlowTool.aiCoachProcessAnalysis')}
            </div>
            <button
              type="button"
              onClick={() => setShowCoach(false)}
              className="text-slate-600 hover:text-slate-800 dark:hover:text-slate-300"
              aria-label={t('myWorkIdeas.processFlowTool.close')}
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
        <div className="mx-3 mb-2 rounded-xl border border-slate-200/60 dark:border-navy-700/40 bg-c-surface p-3">
          <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
            {t('myWorkIdeas.processFlowTool.structuredBrief')}
          </div>
          <div className="mt-1 text-[10px] text-slate-700 dark:text-slate-300">
            <span className="font-semibold">{t('myWorkIdeas.processFlowTool.objective')}</span>{' '}
            {processBriefData.objective}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div>
              <div className="text-[9px] font-bold text-slate-600 dark:text-slate-300">
                {t('myWorkIdeas.processFlowTool.gaps')}
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
                {t('myWorkIdeas.processFlowTool.moves')}
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
                {t('myWorkIdeas.processFlowTool.checkpoints')}
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
              {t('myWorkIdeas.processFlowTool.savingsAnalysis')}
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
              {t('myWorkIdeas.processFlowTool.processSummary')}
            </div>
            <button
              type="button"
              onClick={() => setShowSummary(false)}
              className="text-slate-600 hover:text-slate-800 dark:hover:text-slate-300"
              aria-label={t('myWorkIdeas.processFlowTool.close')}
            >
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            {summaryData.totalSteps != null && (
              <div className="text-center p-1.5 rounded-lg bg-c-surface-raised">
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {summaryData.totalSteps}
                </div>
                <div className="text-[8px] text-slate-500">
                  {t('myWorkIdeas.processFlowTool.steps')}
                </div>
              </div>
            )}
            {(summaryData.decisions ?? summaryData.totalDecisions) != null && (
              <div className="text-center p-1.5 rounded-lg bg-c-surface-raised">
                <div className="text-sm font-bold text-amber-600 dark:text-amber-400">
                  {summaryData.decisions ?? summaryData.totalDecisions}
                </div>
                <div className="text-[8px] text-slate-500">
                  {t('myWorkIdeas.processFlowTool.decisions')}
                </div>
              </div>
            )}
            {(summaryData.lanes ?? summaryData.totalLanes) != null && (
              <div className="text-center p-1.5 rounded-lg bg-c-surface-raised">
                <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {summaryData.lanes ?? summaryData.totalLanes}
                </div>
                <div className="text-[8px] text-slate-500">
                  {t('myWorkIdeas.processFlowTool.lanes')}
                </div>
              </div>
            )}
          </div>
          {summaryData.estimatedDuration && (
            <div className="text-[10px] text-slate-600 dark:text-slate-400 mb-1">
              <span className="font-semibold">{t('myWorkIdeas.processFlowTool.estDuration')}</span>{' '}
              {summaryData.estimatedDuration}
            </div>
          )}
          {summaryData.criticalPath && (
            <div className="text-[10px] text-slate-600 dark:text-slate-400 mb-1">
              <span className="font-semibold">{t('myWorkIdeas.processFlowTool.criticalPath')}</span>{' '}
              {Array.isArray(summaryData.criticalPath)
                ? summaryData.criticalPath.join(' → ')
                : summaryData.criticalPath}
            </div>
          )}
          {summaryData.risks?.length > 0 && (
            <div className="mt-1.5">
              <div className="text-[9px] font-bold text-danger-600 dark:text-danger-400 mb-0.5">
                {t('myWorkIdeas.processFlowTool.risks')}
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
                {t('myWorkIdeas.processFlowTool.recommendations')}
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
        vf1CanvasSpecAEnabled ? (
          // VF1 SPEC-A (flag OFF default): canonical A·Canvas skeleton.
          <div className="flex-1">
            <SkeletonState variant="canvas" />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin text-c-text-secondary" size={24} />
          </div>
        )
      ) : (
        <div
          ref={flowContainerRef}
          className="flex-1 relative"
          // F-K1 fix (G4-KBD-P0, 2026-08-11): ReactFlow nodes are not
          // natively focusable, so without this the browser's click-to-focus
          // ancestor walk had nothing to land on inside the canvas — a click
          // on a node left `document.activeElement` outside this container,
          // and `useCanvasKeyboard`'s new focus-containment check (see
          // `containerRef` above) would then wrongly treat the canvas as
          // unfocused right after the user clicked a node. tabIndex=-1
          // (focusable programmatically/via click, excluded from the
          // page's normal Tab order) mirrors the same pattern already used
          // by Mind Map's canvas root (IdeaRecommendationMap.tsx) and
          // Whiteboard's (`containerRef` there already carries tabIndex=0).
          tabIndex={-1}
        >
          {/* B2 2026-07-27: the provider now opens BEFORE the lane layer (DOM
              order and paint order are unchanged — ReactFlowProvider renders no
              element) so the swimlane bands can read the live viewport and
              travel with the nodes when the canvas is panned/zoomed. Before
              this, bands were positioned in raw container px and drifted off
              their nodes on the very first pan. `overflow-hidden` keeps a band
              that scrolls out of the canvas from painting over the toolbar. */}
          <ReactFlowProvider>
            <div className="absolute inset-0 overflow-hidden">
              <LaneSystemViewportLayer
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
                // N6.3 (2026-08-10): real bug found while wiring lane
                // controls to the Action Registry — `handleLaneResize` never
                // called `pushUndo()`, so Ctrl+Z could not undo a lane
                // resize. Fixed here (not just documented): one snapshot at
                // drag start (`LaneSystem.tsx`'s `startResize`, on
                // `pointerdown`), not one per `onResize` call (which fires
                // on every pointer move and would flood the undo stack).
                onResizeStart={() => pushUndo()}
                dragOverLaneId={dragOverLaneId}
                // PF-P2-02: the lane created by `addLane` above auto-enters
                // inline naming once, then this clears itself.
                autoEditLaneId={newLaneId}
                onAutoEditConsumed={() => setNewLaneId(null)}
              />
            </div>

            {/* D2 2026-07-28: pstryczki siatki i przyciągania NIE wiszą już jako
              bezpodpisowa nakładka `absolute top-2 left-2` nad płótnem. Powód
              podwójny: (a) właściciel nie wiedział, co robią („nie wiem co to są
              te dwa przyciski w ogóle"), (b) zasłaniały pstryczek zwijania
              PIERWSZEGO toru — zmierzone `elementFromPoint`: 58/225 punktów
              pstryczka klikalnych, w jego środku wypadała nakładka. Funkcja
              została, przeniosła się do wspólnego lewego raila
              (`CanvasLeftToolbar`, sloty `grid`/`snap` z `liveIn:
              ['process_flow']`), a stan jedzie w górę przez
              `publishProcessFlowGridState`. Tu zostaje sam stan i płótno. */}

            {/* V51-28: Empty state overlay */}
            {filteredNodes.length === 0 && filteredGhostNodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                <div className="text-center pointer-events-auto">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-c-surface-raised flex items-center justify-center">
                    <GitMerge size={24} className="text-c-info" />
                  </div>
                  <div className="text-sm font-semibold text-c-text-secondary mb-1">
                    {t('myWorkIdeas.processFlowTool.emptyProcessFlow')}
                  </div>
                  <div className="text-[11px] text-c-text-secondary mb-3 max-w-[220px]">
                    {t('myWorkIdeas.processFlowTool.addStepsFromToolbarPressEnter')}
                  </div>
                  {!locked && (
                    <button
                      onClick={runPfAddStartAction}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-c-info hover:brightness-110 transition-all ${FOCUS_RING}`}
                      style={{
                        backgroundColor: 'color-mix(in srgb, var(--c-info) 12%, transparent)',
                      }}
                    >
                      <Plus size={14} />
                      {t('myWorkIdeas.processFlowTool.addStart')}
                    </button>
                  )}
                </div>
              </div>
            )}

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
              // Z17 (Fala 3): magnetic connector parity with Lucidchart —
              // connectionMode="loose" already comes from
              // getIdeasToolInteractionProps (spread below); connectionRadius
              // widens the snap zone around each of the 4-side handles so
              // dropping *near* one closes the connection, not just exactly
              // on the 6px dot.
              connectionRadius={40}
              onConnectStart={() => setIsConnectingEdge(true)}
              onConnectEnd={() => setIsConnectingEdge(false)}
              // Z14 (Fala 3): snapping + alignment guides during node drag.
              onNodeDrag={locked ? undefined : onSnapNodeDrag}
              onNodeDragStop={locked ? undefined : onSnapNodeDragStop}
              {...(onlyRenderVisibleElements ? { onlyRenderVisibleElements: true } : {})}
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
              // P2-6: prawy klik na krawedzi → menu krawedzi. Wczesniej
              // `onEdgeContextMenu` nie bylo w ogole podpiete (prawy klik na
              // krawedzi robil nic). Zaznaczamy klietkta krawedz (odznaczajac
              // wezly i inne krawedzie), zeby akcje „Usuń"/„Wstaw węzeł" mogly
              // dzialac przez istniejace deleteSelected()/insertBetween(), ktore
              // operuja na zaznaczonej krawedzi — bez duplikowania ich logiki.
              onEdgeContextMenu={(event: React.MouseEvent, edge: Edge) => {
                event.preventDefault();
                setEdgeStylePopover(null);
                setNodes((prev) =>
                  prev.some((n) => n.selected)
                    ? prev.map((n) => (n.selected ? { ...n, selected: false } : n))
                    : prev
                );
                setEdges((prev) => prev.map((e) => ({ ...e, selected: e.id === edge.id })));
                setContextMenu({ x: event.clientX, y: event.clientY, edgeId: edge.id });
              }}
              onPaneContextMenu={(event: React.MouseEvent) => {
                event.preventDefault();
                setContextMenu({
                  x: event.clientX,
                  y: event.clientY,
                });
              }}
              // #6p: click an edge → EdgeStylePopover anchored at the click
              // point. ReactFlow's own onEdgesChange still runs first and
              // selects the edge (existing behaviour, drives
              // ProcessFlowPropertiesPanel too) — this just also surfaces the
              // quick popover for color/style/arrow/label.
              onEdgeClick={(event: React.MouseEvent, edge: Edge) => {
                if (locked) return;
                setEdgeStylePopover({ edgeId: edge.id, x: event.clientX, y: event.clientY });
              }}
              onPaneClick={() => setEdgeStylePopover(null)}
              onNodeClick={() => setEdgeStylePopover(null)}
              onMoveStart={() => setEdgeStylePopover(null)}
              {...getIdeasToolInteractionProps('processflow', { locked, connectMode: !locked })}
              // Z1 (rozdz. 06 §3): tryb kursora z lewego raila REALNIE
              // przestawia płótno. `select` = zero nadpisań (zachowanie Z10),
              // `pan` = rączka (nic nie da się ruszyć ani zaznaczyć). Spread
              // MUSI być po getIdeasToolInteractionProps, żeby wygrał.
              {...getIdeaCanvasCursorProps(cursorMode)}
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
              className={`bg-transparent ${isConnectingEdge ? 'pf-connecting' : ''} ${getIdeaCanvasCursorClass(cursorMode)}`}
              defaultEdgeOptions={{ type: 'flowEdge', animated: false }}
            >
              {(() => {
                const bg = getCanvasBg(
                  'process_flow',
                  isDarkFlow ? 'dark' : 'light',
                  showGrid ? undefined : 'blank'
                );
                return (
                  <Background
                    color={bg.color}
                    gap={bg.gap}
                    size={bg.size}
                    variant={bg.variant as any}
                  />
                );
              })()}
              {showMiniMap && (
                <MiniMap
                  nodeStrokeWidth={3}
                  zoomable
                  pannable
                  className="!bg-c-surface !border-slate-200/60 dark:!border-navy-700/60"
                  /**
                   * Wymaganie #6 dolnego paska: minimapa nie może wjeżdżać POD
                   * pasek (pasek `z-dropdown`, minimapa domyślnie `z-index:5`).
                   * Za flagą `ideaBottomBarUnified` — OFF zostawia dzisiejszy stan.
                   */
                  style={
                    isIdeaBottomBarUnifiedEnabled()
                      ? { marginBottom: IDEA_BOTTOM_BAR_MINIMAP_LIFT, zIndex: 10 }
                      : undefined
                  }
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
                onFitView={handleFitAllLanesAndNodes}
              />
              {!locked && <CanvasSnapGuides threshold={6} />}
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

          {/* Pasek edycji zadokowany w listwie Menu 3. Gdy jest — pływający
              pasek Procesu się nie renderuje; gdy slotu brak, wraca pływający. */}
          {pfEditBarDocked && pfEditBarModel ? (
            <ObjectEditBarDock slot={pfEditBarSlot}>
              <ObjectEditBar model={pfEditBarModel} />
            </ObjectEditBarDock>
          ) : null}

          {selectedNode && !locked && !pfEditBarDocked && (
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
                      ? {
                          ...n,
                          data: { ...n.data, comments: appendComment(n.data?.comments, comment) },
                        }
                      : n
                  )
                );
              }}
              onDeleteComment={(nodeId, commentId) => {
                setNodes((nds) =>
                  nds.map((n) =>
                    n.id === nodeId
                      ? {
                          ...n,
                          data: { ...n.data, comments: removeComment(n.data?.comments, commentId) },
                        }
                      : n
                  )
                );
              }}
            />
          );
        })()}

      {/* ── New panels: Validation, AI Proposal, Readback, Properties, Export, Context Menu ── */}

      {showValidationPanel && (
        <div className="absolute right-0 top-0 bottom-0 w-80 z-30 border-l border-slate-200/60 dark:border-navy-700/60 bg-c-bg overflow-y-auto shadow-lg">
          <div className="flex items-center justify-between p-3 border-b border-slate-200/60 dark:border-navy-700/60">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {t('myWorkIdeas.processFlowTool.validation')}
            </span>
            <button
              onClick={() => setShowValidationPanel(false)}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-800"
              aria-label={t('myWorkIdeas.processFlowTool.close')}
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
        <div className="absolute right-0 top-0 bottom-0 w-96 z-30 border-l border-slate-200/60 dark:border-navy-700/60 bg-c-bg overflow-y-auto shadow-lg">
          <div className="flex items-center justify-between p-3 border-b border-slate-200/60 dark:border-navy-700/60">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {rewriteStepId
                ? t('myWorkIdeas.processFlowTool.aiRewriteStep', 'AI: rewrite step')
                : t('myWorkIdeas.processFlowTool.aiProposal')}
            </span>
            <button
              onClick={() => {
                setShowAIPanel(false);
                setRewriteStepId(null);
              }}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-800"
              aria-label={t('myWorkIdeas.processFlowTool.close')}
            >
              <X size={14} className="text-slate-600" />
            </button>
          </div>
          <AIProposalPanel
            proposal={activeProposal}
            isGenerating={isAIGenerating}
            error={aiError}
            isPl={!!isPl}
            onAccept={() => handleAIPanelResolve('accept')}
            onReject={() => handleAIPanelResolve('reject')}
            onEditPrompt={() => {
              // Back to the prompt form (the panel keeps the previous prompt
              // in its draft); the user edits and regenerates explicitly.
              handleAIPanelDismiss();
            }}
            onDismiss={handleAIPanelDismiss}
            onGenerate={handleAIPanelGenerate}
          />
        </div>
      )}

      {showReadbackPanel && (
        <div className="absolute right-0 top-0 bottom-0 w-80 z-30 border-l border-slate-200/60 dark:border-navy-700/60 bg-c-bg overflow-y-auto shadow-lg">
          <div className="flex items-center justify-between p-3 border-b border-slate-200/60 dark:border-navy-700/60">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {t('myWorkIdeas.processFlowTool.semanticReadback')}
            </span>
            <button
              onClick={() => setShowReadbackPanel(false)}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-800"
              aria-label={t('myWorkIdeas.processFlowTool.close')}
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
        <div className="absolute right-0 top-0 bottom-0 w-80 z-30 border-l border-slate-200/60 dark:border-navy-700/60 bg-c-bg overflow-y-auto shadow-lg">
          <div className="flex items-center justify-between p-3 border-b border-slate-200/60 dark:border-navy-700/60">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {t('myWorkIdeas.processFlowTool.properties')}
            </span>
            <button
              onClick={() => setShowPropertiesPanel(false)}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-800"
              aria-label={t('myWorkIdeas.processFlowTool.close')}
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
                  onCopy: () => {
                    // Kopiujemy wezel, na ktorym otwarto menu — nie zaznaczenie,
                    // bo prawy klik go nie zaznacza. Jesli jest wieksze
                    // zaznaczenie i klikniety wezel do niego nalezy, kopiujemy
                    // cale zaznaczenie; w przeciwnym razie sam wezel.
                    const zazn = nodes.filter((n) => n.selected);
                    const klikniety = contextMenu.nodeId!;
                    const ile =
                      zazn.length > 1 && zazn.some((n) => n.id === klikniety)
                        ? copySelected()
                        : copyNodeById(klikniety);
                    if (ile > 0) {
                      toast.success(isPl ? `Skopiowano: ${ile}` : `Copied: ${ile}`);
                    }
                  },
                  onDelete: () => deleteSelected(),
                  onOpenProperties: () => {
                    setShowPropertiesPanel(true);
                  },
                  onAutoLayout: () => handleAutoLayout(),
                  onAIRewriteStep: () => openStepRewrite(contextMenu.nodeId!),
                  onConvertInitiative: onQuickAction
                    ? () => {
                        // Same "prawy klik go nie zaznacza" reasoning as onCopy
                        // above: convert the right-clicked node, or the whole
                        // multi-selection only if the clicked node is part of it.
                        const zazn = nodes.filter((n) => n.selected);
                        const klikniety = contextMenu.nodeId!;
                        const idsToConvert =
                          zazn.length > 1 && zazn.some((n) => n.id === klikniety)
                            ? zazn.map((n) => n.id)
                            : [klikniety];
                        handleConvert('pf_convert_initiative', idsToConvert);
                      }
                    : undefined,
                })
              : contextMenu.edgeId
                ? getEdgeContextActions({
                    edgeId: contextMenu.edgeId,
                    isPl: !!isPl,
                    locked,
                    currentCondition: String(
                      (edges as Edge[]).find((e) => e.id === contextMenu.edgeId)?.data
                        ?.conditionType ?? ''
                    ),
                    // Etykieta + styl: otwiera ten sam EdgeStylePopover co lewy
                    // klik (label/kolor/styl linii/strzalka) — jedno zrodlo prawdy.
                    onEditProps: () =>
                      setEdgeStylePopover({
                        edgeId: contextMenu.edgeId!,
                        x: contextMenu.x,
                        y: contextMenu.y,
                      }),
                    // Krawedz jest zaznaczona (patrz onEdgeContextMenu), wiec
                    // insertBetween/deleteSelected dzialaja na niej — bez duplikatu.
                    onInsertNode: () => insertBetween(),
                    onReverse: () => handleEdgeReverse(contextMenu.edgeId!),
                    onSetCondition: (cond) => handleEdgeConditionChange(contextMenu.edgeId!, cond),
                    onDelete: () => deleteSelected(),
                  })
                : getCanvasContextActions({
                    isPl: !!isPl,
                    locked,
                    // B1: menu kontekstowe zna dokladne miejsce prawego klika —
                    // do dzis je gubilo i wezel ladowal gdzie indziej.
                    onAddNode: (shape) =>
                      addNode(shape as FlowShape, {
                        position: screenToFlow(contextMenu.x, contextMenu.y),
                      }),
                    // P1-4: „Wklej" bylo podpiete pod duplicateSelected(), wiec
                    // duplikowalo zaznaczenie zamiast wkleic schowek — a w menu TLA
                    // zaznaczenia zwykle nie ma, wiec byl to martwy klik. Teraz
                    // wkleja realny schowek i mowi, gdy jest pusty.
                    onPaste: () => {
                      const ile = pasteClipboard();
                      if (ile === 0) {
                        toast(
                          isPl
                            ? 'Schowek jest pusty — najpierw skopiuj zaznaczone elementy.'
                            : 'Clipboard is empty — copy a selection first.'
                        );
                      }
                    },
                    pasteDisabled: clipboardCount() === 0,
                    onAutoLayout: () => handleAutoLayout(),
                  })
          }
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* #6p: minimal edge-properties popover — opens on a click on any
          Process Flow edge. `edges` (not edgesWithHandlers) is the live
          source of truth for the edge's persisted data. */}
      {edgeStylePopover &&
        (() => {
          const liveEdge = (edges as Edge[]).find((e) => e.id === edgeStylePopover.edgeId);
          if (!liveEdge) return null;
          return (
            <EdgeStylePopover
              isPl={!!isPl}
              edge={liveEdge}
              locked={locked}
              x={edgeStylePopover.x}
              y={edgeStylePopover.y}
              onLabelChange={handleEdgeLabelChange}
              onColorChange={handleEdgeColorChange}
              onStyleChange={handleEdgeStyleOverrideChange}
              onArrowChange={handleEdgeArrowChange}
              onClose={() => setEdgeStylePopover(null)}
            />
          );
        })()}

      {metricsEditorNode && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-900/30 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200/70 bg-c-surface p-4 shadow-2xl dark:border-navy-700/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {t('myWorkIdeas.processFlowTool.processStepMetrics')}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {metricsEditorNode.data?.label}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMetricsEditorNodeId(null)}
                className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-navy-800 dark:hover:text-slate-200"
                aria-label={t('myWorkIdeas.processFlowTool.close')}
              >
                <X size={14} />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-[11px] text-slate-600 dark:text-slate-300">
                <div className="mb-1">{t('myWorkIdeas.processFlowTool.duration')}</div>
                <input
                  value={metricsDraft.duration || ''}
                  onChange={(e) =>
                    setMetricsDraft((prev) => ({ ...prev, duration: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-c-surface-raised px-3 py-2 text-xs outline-none focus:border-c-focus dark:border-navy-700"
                />
              </label>
              <label className="text-[11px] text-slate-600 dark:text-slate-300">
                <div className="mb-1">{t('myWorkIdeas.processFlowTool.unit')}</div>
                <input
                  value={metricsDraft.durationUnit || ''}
                  onChange={(e) =>
                    setMetricsDraft((prev) => ({ ...prev, durationUnit: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-c-surface-raised px-3 py-2 text-xs outline-none focus:border-c-focus dark:border-navy-700"
                />
              </label>
              <label className="text-[11px] text-slate-600 dark:text-slate-300">
                <div className="mb-1">{t('myWorkIdeas.processFlowTool.cost')}</div>
                <input
                  value={metricsDraft.cost || ''}
                  onChange={(e) => setMetricsDraft((prev) => ({ ...prev, cost: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-c-surface-raised px-3 py-2 text-xs outline-none focus:border-c-focus dark:border-navy-700"
                />
              </label>
              <label className="text-[11px] text-slate-600 dark:text-slate-300">
                <div className="mb-1">{t('processFlow.propertiesPanel.fteField', 'FTE count')}</div>
                <input
                  value={metricsDraft.fteCount || ''}
                  onChange={(e) =>
                    setMetricsDraft((prev) => ({ ...prev, fteCount: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-c-surface-raised px-3 py-2 text-xs outline-none focus:border-c-focus dark:border-navy-700"
                />
              </label>
              <label className="text-[11px] text-slate-600 dark:text-slate-300">
                <div className="mb-1">{t('myWorkIdeas.processFlowTool.automationPotential')}</div>
                <select
                  value={metricsDraft.automationPotential || 'medium'}
                  onChange={(e) =>
                    setMetricsDraft((prev) => ({ ...prev, automationPotential: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-c-surface-raised px-3 py-2 text-xs outline-none focus:border-c-focus dark:border-navy-700"
                >
                  <option value="low">{t('myWorkIdeas.processFlowTool.low')}</option>
                  <option value="medium">{t('myWorkIdeas.processFlowTool.medium')}</option>
                  <option value="high">{t('myWorkIdeas.processFlowTool.high')}</option>
                </select>
              </label>
              <label className="text-[11px] text-slate-600 dark:text-slate-300">
                <div className="mb-1">{t('myWorkIdeas.processFlowTool.savingsEstimate')}</div>
                <input
                  value={metricsDraft.savingsEstimate || ''}
                  onChange={(e) =>
                    setMetricsDraft((prev) => ({ ...prev, savingsEstimate: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-c-surface-raised px-3 py-2 text-xs outline-none focus:border-c-focus dark:border-navy-700"
                />
              </label>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setMetricsEditorNodeId(null)}
                className="rounded-xl px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-800"
              >
                {t('myWorkIdeas.processFlowTool.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveMetrics}
                className="rounded-xl bg-c-text px-3 py-2 text-xs font-semibold text-c-surface hover:opacity-90"
              >
                {t('myWorkIdeas.processFlowTool.saveMetrics')}
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
