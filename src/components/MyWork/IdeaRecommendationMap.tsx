import 'reactflow/dist/style.css';
import './mindmap/mindmap-effects.css';

import {
  Bot,
  ChevronDown,
  ChevronRight,
  Flower2,
  GitBranch,
  Lightbulb,
  Link2,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import ReactFlow, {
  addEdge,
  Background,
  type Connection,
  ConnectionMode,
  type Edge,
  Handle,
  MiniMap,
  type Node,
  type NodeProps,
  Panel,
  Position,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from 'reactflow';

import { Callout, EmptyStateInline } from '@/components/shared/NModeBlocks';
import { Api } from '@/services/api';
import type { CanvasToolType } from './ideaSelectionTypes';
import { LabeledEdge } from './mindmap/LabeledEdge';
import { NodeContextMenu } from './mindmap/NodeContextMenu';
import { AIBlindSpotsDetector } from './mindmap/AIBlindSpotsDetector';
import { AIBranchBalancer } from './mindmap/AIBranchBalancer';
import { AIWhatIfScenarios } from './mindmap/AIWhatIfScenarios';
import { GradientEdge } from './mindmap/GradientEdge';
import { BatchConvertModal } from './mindmap/BatchConvertModal';
import { ClusterBubbles } from './mindmap/ClusterBubbles';
import { DocumentToMap } from './mindmap/DocumentToMap';
import { InterviewToMap } from './mindmap/InterviewToMap';
import { GlowWrapper, MaturityRing, StatusDot, VoteStars, type NodeStatusType } from './mindmap/NodeEnhancements';
import { PresentationMode } from './mindmap/PresentationMode';
import { SnapshotHistory } from './mindmap/SnapshotHistory';
import { TimelineView } from './mindmap/TimelineView';
import { VoiceToNode } from './mindmap/VoiceToNode';
import { NodeDetailDrawer, type NodeDetailData, type NodeStatus } from './mindmap/NodeDetailDrawer';
import { SubMapBreadcrumb, type BreadcrumbItem } from './mindmap/SubMapBreadcrumb';
import { AIDependencyDetector, type DetectedDependency } from './mindmap/AIDependencyDetector';
import { AIPriorityRecommender } from './mindmap/AIPriorityRecommender';
import { AIAutoClustering, type Cluster } from './mindmap/AIAutoClustering';
import { AISentimentOverlay, type SentimentResult } from './mindmap/AISentimentOverlay';
import { NodeCommentThread, type NodeComment } from './mindmap/NodeCommentThread';
import { ActivityFeed, pushActivity } from './mindmap/ActivityFeed';
import { MapHealthScore } from './mindmap/MapHealthScore';
import { IdeaFunnelAnalytics } from './mindmap/IdeaFunnelAnalytics';
import { applyRadialLayout } from './mindmap/RadialTreeLayout';
import { ExportPowerPoint } from './mindmap/ExportPowerPoint';
import { EmbedInReports } from './mindmap/EmbedInReports';
import { AICompetitiveLandscape } from './mindmap/AICompetitiveLandscape';
import { BranchComparison } from './mindmap/BranchComparison';
import { TimeHeatmap } from './mindmap/TimeHeatmap';
import { ExportDiagramCode } from './mindmap/ExportDiagramCode';
import { applyForceLayout } from './mindmap/ForceDirectedLayout';
import { ImportExternalMap } from './mindmap/ImportExternalMap';
import { MindMap3DView } from './mindmap/MindMap3DView';
import { CollaborationOverlay } from './mindmap/CollaborationOverlay';
import { WebhookSettings, triggerWebhooks } from './mindmap/WebhookSettings';
import { useAutoLayout } from './mindmap/useAutoLayout';
import { useMapExport } from './mindmap/useMapExport';

type PersistenceStatus = 'online' | 'no_route' | 'missing_table' | 'offline';

type AIMapProposal = {
  add: { nodes: Node[]; edges: Edge[] };
  remove: { nodeIds: string[]; edgeIds: string[] };
  reorder?: { note?: string; order?: string[] } | null;
  rationale?: string | null;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function buildLocalDefaultIdeaMap(
  ideaId: string,
  ideaTitle: string,
  isPl: boolean
): { nodes: Node[]; edges: Edge[] } {
  const centerId = 'root';
  const branchRadius = 320;
  const branches = [
    { key: 'problem', label: isPl ? 'Problem' : 'Problem', angle: -Math.PI / 2 },
    { key: 'goal', label: isPl ? 'Cel / KPI' : 'Goal / KPI', angle: -Math.PI / 6 },
    { key: 'options', label: isPl ? 'Opcje' : 'Options', angle: Math.PI / 6 },
    { key: 'evidence', label: isPl ? 'Dowody' : 'Evidence', angle: Math.PI / 2 },
    { key: 'risks', label: isPl ? 'Ryzyka' : 'Risks', angle: (5 * Math.PI) / 6 },
    { key: 'experiments', label: isPl ? 'Eksperymenty' : 'Experiments', angle: (7 * Math.PI) / 6 },
  ];

  const nodes: Node[] = [
    {
      id: centerId,
      type: 'center',
      position: { x: 0, y: 0 },
      data: {
        label: ideaTitle || (isPl ? 'Mój pomysł' : 'My idea'),
        hint: isPl ? 'Kliknij, aby edytować' : 'Click to edit',
        ideaId,
      },
      draggable: false,
    } as any,
  ];
  const edges: Edge[] = [];

  for (const b of branches) {
    const bx = Math.cos(b.angle) * branchRadius;
    const by = Math.sin(b.angle) * branchRadius;
    const branchId = `branch-${b.key}`;
    nodes.push({
      id: branchId,
      type: 'branch',
      position: { x: bx - 50, y: by - 20 },
      data: { label: b.label, branchKey: b.key, count: 0 },
      draggable: false,
    } as any);
    edges.push({
      id: `edge-${centerId}-${branchId}`,
      source: centerId,
      target: branchId,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#94a3b8', strokeWidth: 2.5, opacity: 0.35 },
      data: { system: true, kind: 'frames' },
    } as any);
  }

  return { nodes, edges };
}

const BRANCH_COLORS: Record<
  string,
  { bg: string; border: string; text: string; ring: string; edge: string }
> = {
  problem: { bg: 'bg-rose-100 dark:bg-rose-900/25', border: 'border-rose-400/70', text: 'text-rose-700 dark:text-rose-300', ring: 'ring-rose-400', edge: '#fb7185' },
  goal: { bg: 'bg-emerald-100 dark:bg-emerald-900/25', border: 'border-emerald-400/70', text: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-400', edge: '#34d399' },
  options: { bg: 'bg-amber-100 dark:bg-amber-900/25', border: 'border-amber-400/70', text: 'text-amber-700 dark:text-amber-300', ring: 'ring-amber-400', edge: '#fbbf24' },
  evidence: { bg: 'bg-sky-100 dark:bg-sky-900/25', border: 'border-sky-400/70', text: 'text-sky-700 dark:text-sky-300', ring: 'ring-sky-400', edge: '#38bdf8' },
  risks: { bg: 'bg-purple-100 dark:bg-purple-900/25', border: 'border-purple-400/70', text: 'text-purple-700 dark:text-purple-300', ring: 'ring-purple-400', edge: '#a78bfa' },
  experiments: { bg: 'bg-cyan-100 dark:bg-cyan-900/25', border: 'border-cyan-400/70', text: 'text-cyan-700 dark:text-cyan-300', ring: 'ring-cyan-400', edge: '#22d3ee' },
  plan: { bg: 'bg-blue-100 dark:bg-blue-900/25', border: 'border-blue-400/70', text: 'text-blue-700 dark:text-blue-300', ring: 'ring-blue-400', edge: '#60a5fa' },
  // Consulting templates
  strengths: { bg: 'bg-emerald-100 dark:bg-emerald-900/25', border: 'border-emerald-400/70', text: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-400', edge: '#34d399' },
  weaknesses: { bg: 'bg-rose-100 dark:bg-rose-900/25', border: 'border-rose-400/70', text: 'text-rose-700 dark:text-rose-300', ring: 'ring-rose-400', edge: '#fb7185' },
  opportunities: { bg: 'bg-amber-100 dark:bg-amber-900/25', border: 'border-amber-400/70', text: 'text-amber-700 dark:text-amber-300', ring: 'ring-amber-400', edge: '#fbbf24' },
  threats: { bg: 'bg-purple-100 dark:bg-purple-900/25', border: 'border-purple-400/70', text: 'text-purple-700 dark:text-purple-300', ring: 'ring-purple-400', edge: '#a78bfa' },
  uncategorized: { bg: 'bg-slate-100 dark:bg-slate-800/40', border: 'border-slate-300/70', text: 'text-slate-600 dark:text-slate-400', ring: 'ring-slate-400', edge: '#94a3b8' },
};

function branchColor(key: string) {
  return BRANCH_COLORS[key] || BRANCH_COLORS.uncategorized;
}

// ─────── Node Types ───────

const CenterNodeComponent: React.FC<NodeProps> = React.memo(({ data }) => (
  <div className="flex items-center justify-center w-28 h-28 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-xl shadow-amber-500/25 border-4 border-white dark:border-navy-800">
    <Handle type="source" position={Position.Top} id="top" className="!opacity-0 !w-1 !h-1" />
    <Handle type="source" position={Position.Right} id="right" className="!opacity-0 !w-1 !h-1" />
    <Handle type="source" position={Position.Bottom} id="bottom" className="!opacity-0 !w-1 !h-1" />
    <Handle type="source" position={Position.Left} id="left" className="!opacity-0 !w-1 !h-1" />
    <div className="text-center px-2">
      <Flower2 size={28} className="text-white mx-auto" />
      <div className="text-[10px] font-semibold text-white mt-1 line-clamp-2">{data.label}</div>
      <div className="text-[9px] text-white/80 mt-0.5">{data.hint}</div>
    </div>
  </div>
));
CenterNodeComponent.displayName = 'RecommendationCenterNode';

const BranchNodeComponent: React.FC<NodeProps> = React.memo(({ data, selected }) => {
  const colors = branchColor(data.branchKey);
  const collapsed = data._collapsed;
  const childCount = data.count || 0;
  return (
    <div
      className={`px-4 py-2.5 rounded-2xl border-2 ${colors.border} ${colors.bg} ${
        selected ? `ring-2 ${colors.ring}` : ''
      } shadow-md min-w-[120px] text-center`}
    >
      <Handle type="target" position={Position.Left} className="!opacity-0 !w-1 !h-1" />
      <Handle type="source" position={Position.Right} id="right" className="!opacity-0 !w-1 !h-1" />
      <Handle type="source" position={Position.Top} id="top" className="!opacity-0 !w-1 !h-1" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!opacity-0 !w-1 !h-1" />
      <div className={`text-xs font-semibold ${colors.text} flex items-center gap-1 justify-center`}>
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        <GitBranch size={12} />
        {data.label}
      </div>
      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
        {childCount} {childCount === 1 ? 'node' : 'nodes'}
        {collapsed ? ` (${collapsed ? '...' : ''})` : ''}
      </div>
    </div>
  );
});
BranchNodeComponent.displayName = 'RecommendationBranchNode';

const handleBase = '!w-2.5 !h-2.5 !border-2 transition-all duration-150';
const handleTarget = `${handleBase} !bg-emerald-300 dark:!bg-emerald-600 !border-emerald-500 hover:!bg-emerald-400 hover:!scale-150`;
const handleSource = `${handleBase} !bg-amber-300 dark:!bg-amber-600 !border-amber-500 hover:!bg-amber-400 hover:!scale-150`;

const EditableIdeaNodeComponent: React.FC<NodeProps> = React.memo(({ id, data, selected }) => {
  const colors = branchColor(data.branchKey);
  const isAI = data.sourceType === 'ai_chat' || data.sourceType === 'ai_hint' || data.sourceType === 'ai_suggestion';
  const isNew = data._isNew;
  const nodeStatus: NodeStatusType = data.status || 'idea';
  const p = data.priority ?? 50;
  const priorityColor = p >= 75 ? 'bg-emerald-400' : p >= 50 ? 'bg-amber-400' : 'bg-slate-400';
  const votes = data.votes ?? 0;
  const maturityScore = nodeStatus === 'converted' ? 100 : nodeStatus === 'ready_to_convert' ? 80 : nodeStatus === 'validated' ? 60 : nodeStatus === 'exploring' ? 35 : 10;

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(data.label || ''));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (data._startEditing) {
      setEditValue(String(data.label || ''));
      setEditing(true);
    }
  }, [data._startEditing, data.label]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  const confirmEdit = useCallback(() => {
    setEditing(false);
    const trimmed = editValue.trim();
    window.dispatchEvent(
      new CustomEvent('idea-mindmap-node-edit', {
        detail: { nodeId: id, label: trimmed, cancelled: false },
      })
    );
  }, [editValue, id]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    window.dispatchEvent(
      new CustomEvent('idea-mindmap-node-edit', {
        detail: { nodeId: id, label: data.label, cancelled: true },
      })
    );
  }, [data.label, id]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(String(data.label || ''));
    setEditing(true);
  }, [data.label]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        confirmEdit();
      }
      if (e.key === 'Escape') {
        cancelEdit();
      }
    },
    [cancelEdit, confirmEdit]
  );

  const shape = data.shape || 'default';
  const shapeClass =
    shape === 'circle' ? 'rounded-full aspect-square flex items-center justify-center' :
    shape === 'diamond' ? 'rotate-45' :
    shape === 'hexagon' ? '[clip-path:polygon(25%_0%,75%_0%,100%_50%,75%_100%,25%_100%,0%_50%)]' :
    'rounded-xl';

  const innerRotate = shape === 'diamond' ? '-rotate-45' : '';

  return (
    <GlowWrapper isNew={isNew} isAI={isAI}>
      <div
        onDoubleClick={handleDoubleClick}
        className={`group px-3 py-2 ${shapeClass} border-2 ${colors.border} bg-white dark:bg-navy-900 ${
          selected ? `ring-2 ${colors.ring}` : ''
        } shadow-sm hover:shadow-lg cursor-pointer max-w-[210px] relative`}
      >
        <Handle type="target" position={Position.Left} id="target-left" className={handleTarget} />
        <Handle type="target" position={Position.Top} id="target-top" className={handleTarget} />
        <Handle type="source" position={Position.Right} id="source-right" className={handleSource} />
        <Handle type="source" position={Position.Bottom} id="source-bottom" className={handleSource} />

        {/* Status dot */}
        {nodeStatus !== 'idea' && (
          <div className="absolute -top-1 -right-1">
            <StatusDot status={nodeStatus} size={8} />
          </div>
        )}

        <div className={innerRotate}>
          {/* Image thumbnail (R3.5) */}
          {data.imageUrl && !editing && (
            <div className="mb-1.5 -mx-1 -mt-1 rounded-lg overflow-hidden">
              <img src={data.imageUrl} alt="" className="w-full h-16 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          )}

          {editing ? (
            <textarea
              ref={textareaRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={confirmEdit}
              onKeyDown={handleKeyDown}
              rows={2}
              className="w-full text-[11px] font-semibold text-slate-800 dark:text-slate-200 bg-transparent border-none outline-none resize-none p-0 leading-tight nodrag"
              placeholder="..."
            />
          ) : (
            <>
              <div className="flex items-start gap-1.5">
                <div className="flex-shrink-0 mt-0.5">
                  {isAI ? <Bot size={10} className="text-purple-500" /> : <Lightbulb size={10} className="text-amber-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-[11px] font-semibold ${colors.text} line-clamp-2 leading-tight`}>
                    {data.label || '...'}
                  </div>
                  {data.nodeType && (
                    <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 uppercase tracking-wide">
                      {String(data.nodeType).replace(/_/g, ' ')}
                    </div>
                  )}
                </div>
                {/* Maturity ring */}
                {nodeStatus !== 'idea' && (
                  <div className="shrink-0">
                    <MaturityRing score={maturityScore} size={16} strokeWidth={2} />
                  </div>
                )}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <div className="w-8 h-0.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                  <div className={`h-full rounded-full ${priorityColor}`} style={{ width: `${Math.max(10, p)}%` }} />
                </div>
                {votes > 0 && <VoteStars votes={votes} compact disabled />}
                {data.assignee && (
                  <div
                    className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[7px] font-bold"
                    title={data.assignee}
                  >
                    {String(data.assignee).charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </GlowWrapper>
  );
});
EditableIdeaNodeComponent.displayName = 'EditableRecommendationIdeaNode';

const nodeTypes = {
  center: CenterNodeComponent,
  branch: BranchNodeComponent,
  idea: EditableIdeaNodeComponent,
};

const edgeTypes = {
  labeled: LabeledEdge,
  gradient: GradientEdge,
};

type IdeaRecommendationMapProps = {
  ideaId: string;
  ideaTitle: string;
  onClose: () => void;
  onCenterEdit?: () => void;
  preferredTool?: CanvasToolType;
  extensions?: Record<string, unknown>;
  onPreferredToolLoaded?: (tool: CanvasToolType | null) => void;
  variant?: 'overlay' | 'embedded';
  showClose?: boolean;
  className?: string;
  locked?: boolean;
  onSelectionChange?: (sel: import('./ideaSelectionTypes').IdeaWorkspaceSelection) => void;
};

// ─────── Undo/Redo for map state ───────
type MapSnapshot = { nodes: Node[]; edges: Edge[] };

function MindMapInner({
  ideaId,
  ideaTitle,
  onClose,
  onCenterEdit,
  preferredTool,
  extensions,
  onPreferredToolLoaded,
  variant = 'overlay',
  showClose = true,
  className,
  locked = false,
  onSelectionChange,
}: IdeaRecommendationMapProps) {
  const { i18n } = useTranslation();
  const isPolish = useMemo(() => i18n.language?.startsWith('pl'), [i18n.language]);
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { autoLayout } = useAutoLayout();
  const { exportAsPNG, exportAsSVG, exportAsJSON } = useMapExport();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [persistence, setPersistence] = useState<PersistenceStatus>('online');

  const [nodes, setNodes, baseOnNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);

  // ── Collapse/Expand ──────────────────────────────────────────────────────
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());

  const toggleCollapse = useCallback(
    (nodeId: string) => {
      setCollapsedNodeIds((prev) => {
        const next = new Set(prev);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        return next;
      });
    },
    []
  );

  // Apply collapse visibility + drill-down filtering
  const visibleNodes = useMemo(() => {
    const childrenOf = new Map<string, string[]>();
    for (const e of edges) {
      if (!childrenOf.has(e.source)) childrenOf.set(e.source, []);
      childrenOf.get(e.source)!.push(e.target);
    }

    // Drill-down: only show the focused node and its descendants
    let drillVisibleIds: Set<string> | null = null;
    if (drillFocusId) {
      drillVisibleIds = new Set<string>();
      drillVisibleIds.add(drillFocusId);
      function collectDescendants(parentId: string) {
        const children = childrenOf.get(parentId) || [];
        for (const cid of children) {
          drillVisibleIds!.add(cid);
          collectDescendants(cid);
        }
      }
      collectDescendants(drillFocusId);
    }

    // Collapse: hide descendants of collapsed nodes
    const hiddenIds = new Set<string>();
    function hideDescendants(parentId: string) {
      const children = childrenOf.get(parentId) || [];
      for (const cid of children) {
        if (cid === 'root' || cid.startsWith('branch-')) continue;
        hiddenIds.add(cid);
        hideDescendants(cid);
      }
    }
    for (const nid of collapsedNodeIds) hideDescendants(nid);

    return nodes.map((n) => {
      const isCollapsed = collapsedNodeIds.has(n.id);
      const childCount = (childrenOf.get(n.id) || []).filter((c) => !c.startsWith('branch-') && c !== 'root').length;
      const hiddenByDrill = drillVisibleIds ? !drillVisibleIds.has(n.id) : false;
      return {
        ...n,
        hidden: hiddenIds.has(n.id) || hiddenByDrill,
        data: {
          ...n.data,
          _collapsed: isCollapsed,
          count: n.id.startsWith('branch-') ? childCount : (n.data?.count ?? 0),
        },
      };
    });
  }, [collapsedNodeIds, drillFocusId, edges, nodes]);

  const visibleEdges = useMemo(() => {
    const hiddenNodeIds = new Set(visibleNodes.filter((n) => n.hidden).map((n) => n.id));
    if (hiddenNodeIds.size === 0) return edges;
    return edges.map((e) => ({
      ...e,
      hidden: hiddenNodeIds.has(e.source) || hiddenNodeIds.has(e.target),
    }));
  }, [edges, visibleNodes]);

  // ── Undo/Redo ────────────────────────────────────────────────────────────
  const undoStackRef = useRef<MapSnapshot[]>([]);
  const redoStackRef = useRef<MapSnapshot[]>([]);
  const MAX_UNDO = 50;

  const pushUndo = useCallback(() => {
    undoStackRef.current = [
      ...undoStackRef.current.slice(-(MAX_UNDO - 1)),
      { nodes: [...nodes], edges: [...edges] },
    ];
    redoStackRef.current = [];
  }, [nodes, edges]);

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const prev = undoStackRef.current[undoStackRef.current.length - 1];
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [{ nodes: [...nodes], edges: [...edges] }, ...redoStackRef.current];
    setNodes(prev.nodes);
    setEdges(prev.edges);
  }, [edges, nodes, setEdges, setNodes]);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current[0];
    redoStackRef.current = redoStackRef.current.slice(1);
    undoStackRef.current = [...undoStackRef.current, { nodes: [...nodes], edges: [...edges] }];
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [edges, nodes, setEdges, setNodes]);

  // ── Context menu ─────────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; nodeType: string; x: number; y: number } | null>(null);

  // ── Node Detail Drawer ──────────────────────────────────────────────────
  const [drawerNodeId, setDrawerNodeId] = useState<string | null>(null);
  const [nodeMetaMap, setNodeMetaMap] = useState<Record<string, { notes?: string; status?: NodeStatus }>>({});

  const drawerNodeData = useMemo((): NodeDetailData | null => {
    if (!drawerNodeId) return null;
    const node = nodes.find((n) => n.id === drawerNodeId);
    if (!node) return null;
    const meta = nodeMetaMap[drawerNodeId] || {};
    return {
      nodeId: node.id,
      label: node.data?.label || '',
      branchKey: node.data?.branchKey || 'uncategorized',
      sourceType: node.data?.sourceType,
      nodeType: node.data?.nodeType || node.type,
      priority: node.data?.priority,
      notes: meta.notes || node.data?.notes || '',
      status: meta.status || node.data?.status || 'idea',
      childNodeIds: edges.filter((e) => e.source === node.id).map((e) => e.target),
      parentNodeId: edges.find((e) => e.target === node.id)?.source,
    };
  }, [drawerNodeId, edges, nodeMetaMap, nodes]);

  const handleUpdateNode = useCallback((nodeId: string, patch: Partial<NodeDetailData>) => {
    if (patch.notes !== undefined || patch.status !== undefined) {
      setNodeMetaMap((prev) => ({
        ...prev,
        [nodeId]: { ...prev[nodeId], ...patch },
      }));
    }
    if (patch.status) {
      setNodes((prev: Node[]) =>
        prev.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, status: patch.status } } : n)
      );
    }
  }, [setNodes]);

  const handleConvertNode = useCallback((nodeId: string, target: 'initiative' | 'decision') => {
    const action = target === 'initiative' ? 'convert_initiative' : 'convert_decision';
    setNodes((prev: Node[]) => prev.map((n) => ({ ...n, selected: n.id === nodeId })));
    window.dispatchEvent(new CustomEvent('idea-workspace-quick-action', { detail: { action } }));
    setDrawerNodeId(null);
  }, [setNodes]);

  const handleNavigateToNode = useCallback((nodeId: string) => {
    setNodes((prev: Node[]) => prev.map((n) => ({ ...n, selected: n.id === nodeId })));
    setDrawerNodeId(nodeId);
    setTimeout(() => {
      try { fitView({ nodes: [{ id: nodeId } as any], padding: 0.5, duration: 400 }); } catch { /* ignore */ }
    }, 100);
  }, [fitView, setNodes]);

  // ── Sub-map / Drill-down ────────────────────────────────────────────────
  const [drillPath, setDrillPath] = useState<BreadcrumbItem[]>([]);
  const drillFocusId = drillPath.length > 0 ? drillPath[drillPath.length - 1].nodeId : null;

  const handleDrillDown = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setDrillPath((prev) => {
      const existingIdx = prev.findIndex((p) => p.nodeId === nodeId);
      if (existingIdx >= 0) return prev.slice(0, existingIdx + 1);
      return [...prev, { nodeId, label: node.data?.label || nodeId }];
    });
    setDrawerNodeId(null);
    setTimeout(() => {
      try { fitView({ padding: 0.3, duration: 400 }); } catch { /* ignore */ }
    }, 100);
  }, [fitView, nodes]);

  const handleBreadcrumbNavigate = useCallback((nodeId: string | null) => {
    if (!nodeId) {
      setDrillPath([]);
    } else {
      setDrillPath((prev) => {
        const idx = prev.findIndex((p) => p.nodeId === nodeId);
        return idx >= 0 ? prev.slice(0, idx + 1) : prev;
      });
    }
    setTimeout(() => {
      try { fitView({ padding: 0.3, duration: 400 }); } catch { /* ignore */ }
    }, 100);
  }, [fitView]);

  // ── Selection ────────────────────────────────────────────────────────────
  const editingNodeIdRef = useRef<string | null>(null);

  const onNodesChange = useCallback(
    (changes: import('reactflow').NodeChange[]) => {
      baseOnNodesChange(changes);
      const hasSelectionChange = changes.some((c) => c.type === 'select');
      if (hasSelectionChange && onSelectionChange) {
        setNodes((current: Node[]) => {
          const selected = current.filter((n: Node) => n.selected);
          if (selected.length === 0) {
            onSelectionChange({ type: 'none', count: 0, ids: [] });
          } else {
            onSelectionChange({
              type: 'node',
              count: selected.length,
              ids: selected.map((n: Node) => n.id),
              primaryId: selected[0]?.id,
              meta: { nodeType: selected[0]?.type, label: selected[0]?.data?.label },
            });
          }
          return current;
        });
      }
    },
    [baseOnNodesChange, onSelectionChange, setNodes]
  );

  const saveTimerRef = useRef<number | null>(null);
  const isHydratingRef = useRef(true);

  // ── Hydrate ──────────────────────────────────────────────────────────────
  const hydrate = useCallback(async () => {
    setLoading(true);
    try {
      setPersistence('online');
      const res = await Api.getMyIdeaMap(ideaId, { language: i18n.language });
      const map = res?.map || {};
      const nextNodes = Array.isArray(map.nodes) ? map.nodes : [];
      const nextEdges = Array.isArray(map.edges) ? map.edges : [];
      const loadedPreferred = map?.preferredTool ? String(map.preferredTool) : null;
      const loadedPreferredSafe =
        loadedPreferred && ['mindmap', 'process_flow', 'table', 'whiteboard'].includes(loadedPreferred)
          ? (loadedPreferred as CanvasToolType) : null;
      onPreferredToolLoaded?.(loadedPreferredSafe);

      const patchedNodes = nextNodes.map((n: any) => {
        if (String(n?.id) !== 'root') return n;
        return { ...n, data: { ...(n.data || {}), label: ideaTitle || (isPolish ? 'Mój pomysł' : 'My idea'), hint: isPolish ? 'Kliknij, aby edytować' : 'Click to edit' } };
      });

      // Restore collapsed state from extensions
      const savedCollapsed = (map.extensions as any)?.mindmap?.viewState?.collapsedNodeIds;
      if (Array.isArray(savedCollapsed)) setCollapsedNodeIds(new Set(savedCollapsed));

      isHydratingRef.current = true;
      setNodes(patchedNodes);
      setEdges(nextEdges);
      undoStackRef.current = [];
      redoStackRef.current = [];
      setTimeout(() => {
        isHydratingRef.current = false;
        try { fitView({ padding: 0.3, duration: 300 }); } catch { /* ignore */ }
      }, 50);
    } catch (err: any) {
      const msg = String(err?.message || '');
      const isNoRoute = msg.toLowerCase().includes('route get') && msg.toLowerCase().includes('/my-work/my-ideas') && msg.toLowerCase().includes('/map');
      const isMissingTable = msg.toLowerCase().includes('database table missing') && msg.toLowerCase().includes('my_idea_maps');

      if (isNoRoute) {
        setPersistence('no_route');
        toast((isPolish ? 'Backend wymaga restartu (route mapy jeszcze nie działa).' : 'Backend needs restart (map route not active).') as any);
      } else if (isMissingTable) {
        setPersistence('missing_table');
        toast((isPolish ? 'Brakuje tabeli mapy — uruchom migracje DB.' : 'Map table missing — run DB migrations.') as any);
      } else {
        setPersistence('offline');
        toast.error(msg || (isPolish ? 'Nie udało się wczytać mapy' : 'Failed to load map'));
      }

      const def = buildLocalDefaultIdeaMap(ideaId, ideaTitle, isPolish);
      isHydratingRef.current = true;
      setNodes(def.nodes);
      setEdges(def.edges);
      setTimeout(() => {
        isHydratingRef.current = false;
        try { fitView({ padding: 0.3, duration: 250 }); } catch { /* ignore */ }
      }, 30);
    } finally {
      setLoading(false);
    }
  }, [fitView, i18n.language, ideaId, ideaTitle, isPolish, onPreferredToolLoaded, setEdges, setNodes]);

  useEffect(() => { hydrate(); }, [ideaId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const label = ideaTitle || (isPolish ? 'Mój pomysł' : 'My idea');
    setNodes((prev: Node[]) =>
      (prev || []).map((n: any) => {
        if (String(n?.id) !== 'root') return n;
        return { ...n, data: { ...(n.data || {}), label, hint: isPolish ? 'Kliknij, aby edytować' : 'Click to edit' } };
      })
    );
  }, [ideaTitle, isPolish, setNodes]);

  // ── URL deep link: ?focusNode=<id> ────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    const params = new URLSearchParams(window.location.search);
    const focusId = params.get('focusNode');
    if (!focusId) return;
    const target = nodes.find((n) => n.id === focusId);
    if (target) {
      setNodes((prev: Node[]) => prev.map((n) => ({ ...n, selected: n.id === focusId })));
      setTimeout(() => {
        try { fitView({ nodes: [{ id: focusId } as any], padding: 0.5, duration: 400 }); } catch { /* ignore */ }
      }, 100);
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save ─────────────────────────────────────────────────────────────────
  const scheduleSave = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      if (isHydratingRef.current) return;
      if (persistence !== 'online') return;
      if (locked) return;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(async () => {
        setSaving(true);
        try {
          const ext = {
            ...(extensions || {}),
            mindmap: {
              ...((extensions as any)?.mindmap || {}),
              viewState: {
                collapsedNodeIds: Array.from(collapsedNodeIds),
              },
            },
          };
          await Api.saveMyIdeaMap(ideaId, {
            nodes: nextNodes,
            edges: nextEdges,
            preferredTool: preferredTool || undefined,
            extensions: ext,
          });
          setLastSavedAt(Date.now());
        } catch (err: any) {
          toast.error(err?.message || (isPolish ? 'Nie udało się zapisać mapy' : 'Failed to save map'));
        } finally {
          setSaving(false);
        }
      }, 700);
    },
    [collapsedNodeIds, extensions, ideaId, isPolish, locked, persistence, preferredTool]
  );

  useEffect(() => { scheduleSave(nodes as any, edges as any); }, [nodes, edges, scheduleSave]);

  // ── Node operations ──────────────────────────────────────────────────────

  const getSelectedNode = useCallback((): Node | undefined => {
    return nodes.find((n: any) => n?.selected);
  }, [nodes]);

  const findParentId = useCallback(
    (nodeId: string): string | undefined => {
      const parentEdge = edges.find((e) => e.target === nodeId);
      return parentEdge?.source;
    },
    [edges]
  );

  const findChildrenIds = useCallback(
    (nodeId: string): string[] => {
      return edges.filter((e) => e.source === nodeId).map((e) => e.target);
    },
    [edges]
  );

  const addChildNode = useCallback(() => {
    if (locked) return;
    const selected = getSelectedNode();
    if (!selected) {
      toast(isPolish ? 'Zaznacz węzeł' : 'Select a node');
      return;
    }
    pushUndo();

    const branchKey = selected.data?.branchKey || 'options';
    const children = findChildrenIds(selected.id);
    const lastChild = children.length > 0 ? nodes.find((n) => n.id === children[children.length - 1]) : null;
    const newX = (lastChild?.position?.x ?? selected.position.x + 220);
    const newY = (lastChild?.position?.y ?? selected.position.y) + (lastChild ? 70 : 0);

    const newId = `node-${uid()}`;
    const newNode: Node = {
      id: newId,
      type: 'idea',
      position: { x: newX, y: newY },
      data: { label: '', branchKey, sourceType: 'manual', priority: 50, _startEditing: Date.now() },
    } as any;

    const colors = branchColor(branchKey);
    const newEdge: Edge = {
      id: `edge-${uid()}`,
      source: selected.id,
      target: newId,
      type: 'smoothstep',
      style: { stroke: colors.edge, strokeWidth: 1.5, opacity: 0.5 },
      animated: true,
      data: { userCreated: true },
    } as any;

    editingNodeIdRef.current = newId;
    setNodes((prev: Node[]) => [...prev.map((n) => ({ ...n, selected: false })), { ...newNode, selected: true }]);
    setEdges((prev: Edge[]) => [...prev, newEdge]);
  }, [edges, findChildrenIds, getSelectedNode, isPolish, locked, nodes, pushUndo, setEdges, setNodes]);

  const addSiblingNode = useCallback(() => {
    if (locked) return;
    const selected = getSelectedNode();
    if (!selected || selected.id === 'root') {
      toast(isPolish ? 'Zaznacz węzeł' : 'Select a node');
      return;
    }
    pushUndo();

    const parentId = findParentId(selected.id);
    if (!parentId) return;

    const branchKey = selected.data?.branchKey || 'options';
    const newId = `node-${uid()}`;
    const newNode: Node = {
      id: newId,
      type: 'idea',
      position: { x: selected.position.x, y: selected.position.y + 70 },
      data: { label: '', branchKey, sourceType: 'manual', priority: 50, _startEditing: Date.now() },
    } as any;

    const colors = branchColor(branchKey);
    const newEdge: Edge = {
      id: `edge-${uid()}`,
      source: parentId,
      target: newId,
      type: 'smoothstep',
      style: { stroke: colors.edge, strokeWidth: 1.5, opacity: 0.5 },
      animated: true,
      data: { userCreated: true },
    } as any;

    editingNodeIdRef.current = newId;
    setNodes((prev: Node[]) => [...prev.map((n) => ({ ...n, selected: false })), { ...newNode, selected: true }]);
    setEdges((prev: Edge[]) => [...prev, newEdge]);
  }, [findParentId, getSelectedNode, isPolish, locked, pushUndo, setEdges, setNodes]);

  const deleteSelected = useCallback(() => {
    if (locked) return;
    pushUndo();
    let removedIds: Set<string>;
    setNodes((prev: Node[]) => {
      removedIds = new Set(
        prev.filter((n: Node) => n.selected && n.id !== 'root' && !n.id.startsWith('branch-')).map((n: Node) => n.id)
      );
      return prev.filter((n: Node) => !removedIds.has(n.id));
    });
    setEdges((prev: Edge[]) =>
      prev.filter((e: Edge) => !e.selected && !removedIds!.has(e.source) && !removedIds!.has(e.target))
    );
  }, [locked, pushUndo, setEdges, setNodes]);

  const duplicateSelected = useCallback(() => {
    if (locked) return;
    const selected = getSelectedNode();
    if (!selected || selected.id === 'root' || selected.id.startsWith('branch-')) return;
    pushUndo();

    const parentId = findParentId(selected.id);
    if (!parentId) return;

    const newId = `node-${uid()}`;
    const newNode: Node = {
      ...selected,
      id: newId,
      position: { x: selected.position.x + 30, y: selected.position.y + 30 },
      selected: false,
      data: { ...selected.data, _startEditing: undefined },
    };

    const colors = branchColor(selected.data?.branchKey || 'uncategorized');
    const newEdge: Edge = {
      id: `edge-${uid()}`,
      source: parentId,
      target: newId,
      type: 'smoothstep',
      style: { stroke: colors.edge, strokeWidth: 1.5, opacity: 0.5 },
      animated: true,
      data: { userCreated: true },
    } as any;

    setNodes((prev: Node[]) => [...prev, newNode]);
    setEdges((prev: Edge[]) => [...prev, newEdge]);
  }, [findParentId, getSelectedNode, locked, pushUndo, setEdges, setNodes]);

  const startEditingSelected = useCallback(() => {
    const selected = getSelectedNode();
    if (!selected || selected.id === 'root' || selected.id.startsWith('branch-')) return;
    editingNodeIdRef.current = selected.id;
    setNodes((prev: Node[]) =>
      prev.map((n) => n.id === selected.id ? { ...n, data: { ...n.data, _startEditing: Date.now() } } : n)
    );
  }, [getSelectedNode, setNodes]);

  // ── Handle inline edit completion ────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { nodeId, label, cancelled } = (e as CustomEvent).detail;
      editingNodeIdRef.current = null;
      if (cancelled) {
        // If it was a new empty node, remove it
        setNodes((prev: Node[]) => {
          const node = prev.find((n) => n.id === nodeId);
          if (node && !node.data?.label) {
            setEdges((pe: Edge[]) => pe.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
            return prev.filter((n) => n.id !== nodeId);
          }
          return prev.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, _startEditing: undefined } } : n);
        });
        return;
      }
      if (!label) {
        // Empty label on confirm = delete node
        setNodes((prev: Node[]) => prev.filter((n) => n.id !== nodeId));
        setEdges((prev: Edge[]) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
        return;
      }
      setNodes((prev: Node[]) =>
        prev.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, label, _startEditing: undefined } } : n)
      );
    };
    window.addEventListener('idea-mindmap-node-edit', handler);
    return () => window.removeEventListener('idea-mindmap-node-edit', handler);
  }, [setEdges, setNodes]);

  // ── Handle edge label edits ──────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { edgeId, label } = (e as CustomEvent).detail;
      setEdges((prev: Edge[]) =>
        prev.map((edge) => edge.id === edgeId ? { ...edge, data: { ...edge.data, label } } : edge)
      );
    };
    window.addEventListener('idea-mindmap-edge-label', handler);
    return () => window.removeEventListener('idea-mindmap-edge-label', handler);
  }, [setEdges]);

  // ── Quick action listener (from Tools panel) ─────────────────────────────
  const quickActionRef = useRef<(action: string) => void>(() => {});
  quickActionRef.current = (action: string) => {
    if (action === 'mm_add_child') addChildNode();
    if (action === 'mm_add_sibling') addSiblingNode();
    if (action === 'mm_toggle_collapse') {
      const sel = getSelectedNode();
      if (sel) toggleCollapse(sel.id);
    }
    if (action === 'mm_delete') deleteSelected();
    if (action === 'mm_undo') undo();
    if (action === 'mm_redo') redo();
    if (action === 'mm_auto_layout') {
      pushUndo();
      const laid = autoLayout(nodes, edges);
      setNodes(laid);
      setTimeout(() => { try { fitView({ padding: 0.3, duration: 400 }); } catch { /* ignore */ } }, 50);
    }
    if (action === 'mm_ai_expand_branch') handleAIExpand();
    if (action === 'mm_toggle_bubbles') setShowClusterBubbles((p) => !p);
    if (action === 'mm_toggle_heatmap') setHeatmapMode((p) => !p);
    if (action === 'mm_toggle_particles') setParticleFlow((p) => !p);
    if (action === 'mm_what_if') setShowWhatIf(true);
    if (action === 'mm_batch_convert') setShowBatchConvert(true);
    if (action === 'mm_timeline') setShowTimeline(true);
    if (action === 'mm_presentation') setShowPresentation(true);
    if (action === 'mm_snapshots') setShowSnapshots(true);
    if (action === 'mm_voice') setShowVoiceToNode(true);
    if (action === 'mm_doc_to_map') setShowDocToMap(true);
    if (action === 'mm_interview_to_map') setShowInterviewToMap(true);
    if (action === 'mm_dependency_detect') setShowDependencyDetector(true);
    if (action === 'mm_priority_recommender') setShowPriorityRecommender(true);
    if (action === 'mm_auto_clustering') setShowAutoClustering(true);
    if (action === 'mm_sentiment_analysis') setShowSentimentOverlay(true);
    if (action === 'mm_activity_feed') setShowActivityFeed(true);
    if (action === 'mm_toggle_health') setShowHealthScore((p) => !p);
    if (action === 'mm_funnel_analytics') setShowFunnelAnalytics(true);
    if (action === 'mm_radial_layout') {
      pushUndo();
      const newMode = layoutMode === 'radial' ? 'tree' : 'radial';
      setLayoutMode(newMode);
      if (newMode === 'radial') {
        const laid = applyRadialLayout(nodes, edges);
        setNodes(laid);
      } else {
        const laid = autoLayout(nodes, edges);
        setNodes(laid);
      }
      setTimeout(() => { try { fitView({ padding: 0.3, duration: 400 }); } catch { /* ignore */ } }, 50);
    }
    if (action === 'mm_comments') {
      const sel = getSelectedNode();
      if (sel && sel.type === 'idea') setCommentNodeId(sel.id);
    }
    if (action === 'mm_export_pptx') setShowExportPPTX(true);
    if (action === 'mm_embed_report') setShowEmbedInReports(true);
    if (action === 'mm_competitive_landscape') setShowCompetitiveLandscape(true);
    if (action === 'mm_branch_comparison') setShowBranchComparison(true);
    if (action === 'mm_time_heatmap') setShowTimeHeatmap(true);
    if (action === 'mm_export_diagram') setShowExportDiagramCode(true);
    if (action === 'mm_force_layout') {
      pushUndo();
      const newMode = layoutMode === 'force' ? 'tree' : 'force';
      setLayoutMode(newMode);
      if (newMode === 'force') {
        const laid = applyForceLayout(nodes, edges);
        setNodes(laid);
      } else {
        const laid = autoLayout(nodes, edges);
        setNodes(laid);
      }
      setTimeout(() => { try { fitView({ padding: 0.3, duration: 400 }); } catch { /* ignore */ } }, 50);
    }
    if (action === 'mm_import_external') setShowImportExternalMap(true);
    if (action === 'mm_3d_view') setShowMindMap3D(true);
    if (action === 'mm_webhooks') setShowWebhookSettings(true);
    if (action === 'mm_export') {
      const format = window.prompt(isPolish ? 'Format eksportu: png, svg, json' : 'Export format: png, svg, json', 'png');
      if (format === 'svg') exportAsSVG(`${ideaTitle || 'mindmap'}.svg`);
      else if (format === 'json') exportAsJSON(nodes, edges, extensions, `${ideaTitle || 'mindmap'}.json`);
      else exportAsPNG(`${ideaTitle || 'mindmap'}.png`);
    }
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.action) quickActionRef.current(detail.action);
    };
    window.addEventListener('idea-workspace-quick-action', handler);
    return () => window.removeEventListener('idea-workspace-quick-action', handler);
  }, []);

  // ── Insert from AI Suggestions panel ─────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { items, ideaId: evtIdeaId } = (e as CustomEvent).detail || {};
      if (evtIdeaId && evtIdeaId !== ideaId) return;
      if (!Array.isArray(items) || items.length === 0) return;
      pushUndo();

      const branchMap: Record<string, string> = {
        topics: 'options',
        findings: 'evidence',
        next_steps: 'experiments',
      };

      for (const item of items) {
        const branchKey = branchMap[item.type] || 'options';
        const branchNode = nodes.find((n) => n.data?.branchKey === branchKey);
        const childrenOfBranch = edges.filter((e) => e.source === branchNode?.id);
        const yOffset = childrenOfBranch.length * 70;

        const newId = `node-${uid()}`;
        const newNode: Node = {
          id: newId,
          type: 'idea',
          position: {
            x: (branchNode?.position?.x ?? 0) + 220,
            y: (branchNode?.position?.y ?? 0) + yOffset,
          },
          data: { label: item.text, branchKey, sourceType: 'ai_suggestion', priority: 50 },
        } as any;

        const colors = branchColor(branchKey);
        const newEdge: Edge = {
          id: `edge-${uid()}`,
          source: branchNode?.id || `branch-${branchKey}`,
          target: newId,
          type: 'smoothstep',
          style: { stroke: colors.edge, strokeWidth: 1.5, opacity: 0.5 },
          animated: true,
          data: { userCreated: false },
        } as any;

        setNodes((prev: Node[]) => [...prev, newNode]);
        setEdges((prev: Edge[]) => [...prev, newEdge]);
      }
      toast.success(isPolish ? 'Wstawiono do mapy' : 'Inserted into map', { duration: 1000 });
    };
    window.addEventListener('idea-workspace-insert', handler);
    return () => window.removeEventListener('idea-workspace-insert', handler);
  }, [edges, ideaId, isPolish, nodes, pushUndo, setEdges, setNodes]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isEditing = editingNodeIdRef.current !== null;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        scheduleSave(nodes as any, edges as any);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      // V4-IDEA-07: Select all (Ctrl+A)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a' && !e.shiftKey) {
        e.preventDefault();
        setNodes((prev: Node[]) => prev.map((n) => ({ ...n, selected: n.id !== 'root' })));
        return;
      }
      // V4-IDEA-07: Clear selection (Ctrl+D)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setNodes((prev: Node[]) => prev.map((n) => ({ ...n, selected: false })));
        return;
      }

      if (isEditing || isInput) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        addChildNode();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        addSiblingNode();
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        startEditingSelected();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (e.key === 'Escape') {
        setNodes((prev: Node[]) => prev.map((n) => ({ ...n, selected: false })));
        setContextMenu(null);
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        const sel = getSelectedNode();
        if (sel) toggleCollapse(sel.id);
        return;
      }

      // Arrow key navigation
      const sel = getSelectedNode();
      if (!sel) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const children = findChildrenIds(sel.id);
        if (children.length > 0) {
          setNodes((prev: Node[]) => prev.map((n) => ({ ...n, selected: n.id === children[0] })));
        }
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const parentId = findParentId(sel.id);
        if (parentId) {
          setNodes((prev: Node[]) => prev.map((n) => ({ ...n, selected: n.id === parentId })));
        }
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const parentId = findParentId(sel.id);
        if (!parentId) return;
        const siblings = findChildrenIds(parentId);
        const idx = siblings.indexOf(sel.id);
        const nextIdx = e.key === 'ArrowDown' ? Math.min(idx + 1, siblings.length - 1) : Math.max(idx - 1, 0);
        if (nextIdx !== idx) {
          setNodes((prev: Node[]) => prev.map((n) => ({ ...n, selected: n.id === siblings[nextIdx] })));
        }
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [addChildNode, addSiblingNode, deleteSelected, edges, findChildrenIds, findParentId, getSelectedNode, nodes, redo, scheduleSave, setNodes, startEditingSelected, toggleCollapse, undo]);

  // ── Connect ──────────────────────────────────────────────────────────────
  const onConnect = useCallback(
    (connection: Connection) => {
      if (locked) return;
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      pushUndo();
      const id = `edge-${uid()}`;
      const newEdge: Edge = {
        id,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle || undefined,
        targetHandle: connection.targetHandle || undefined,
        type: 'labeled',
        style: { stroke: '#8b5cf6', strokeWidth: 2, opacity: 0.7 },
        animated: true,
        data: { userCreated: true, flowState: 'forward', label: '' },
      };
      setEdges((prev: Edge[]) => addEdge(newEdge, prev));
    },
    [locked, pushUndo, setEdges]
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      if (locked) return;
      const isUser = !!edge.data?.userCreated;
      const currentState = edge.data?.flowState || 'forward';

      if (currentState === 'reversed' && isUser) {
        pushUndo();
        setEdges((prev: Edge[]) => (prev || []).filter((e: Edge) => e.id !== edge.id));
        toast.success(isPolish ? 'Połączenie usunięte' : 'Connection removed', { duration: 1200 });
        return;
      }

      setEdges((prev: Edge[]) =>
        (prev || []).map((e: Edge) => {
          if (e.id !== edge.id) return e;
          if (currentState === 'forward') {
            return { ...e, animated: false, style: { ...e.style, opacity: 0.8, strokeDasharray: '5 5' }, data: { ...e.data, flowState: 'stopped' } };
          }
          if (currentState === 'stopped') {
            return { ...e, source: e.target, target: e.source, sourceHandle: e.targetHandle, targetHandle: e.sourceHandle, animated: true, style: { ...e.style, opacity: 0.7, strokeDasharray: undefined }, data: { ...e.data, flowState: 'reversed' } };
          }
          if (currentState === 'reversed') {
            return { ...e, source: e.target, target: e.source, sourceHandle: e.targetHandle, targetHandle: e.sourceHandle, animated: true, style: { ...e.style, opacity: 0.6, strokeDasharray: undefined }, data: { ...e.data, flowState: 'forward' } };
          }
          return e;
        }).filter(Boolean)
      );
    },
    [isPolish, locked, pushUndo, setEdges]
  );

  const selectedBranchKey = useMemo(() => {
    const selected = nodes.find((n: any) => n?.selected);
    if (!selected) return 'options';
    if (selected.type === 'branch') return String((selected as any).data?.branchKey || 'options');
    if (selected.type === 'idea') return String((selected as any).data?.branchKey || 'options');
    return 'options';
  }, [nodes]);

  // ── Visual modes ─────────────────────────────────────────────────────────
  const [showClusterBubbles, setShowClusterBubbles] = useState(false);
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [particleFlow, setParticleFlow] = useState(false);

  // ── P4 modals ───────────────────────────────────────────────────────────
  const [showBatchConvert, setShowBatchConvert] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showPresentation, setShowPresentation] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);

  // ── P6 modals ───────────────────────────────────────────────────────────
  const [showVoiceToNode, setShowVoiceToNode] = useState(false);
  const [showDocToMap, setShowDocToMap] = useState(false);
  const [showInterviewToMap, setShowInterviewToMap] = useState(false);

  // ── What-If Scenarios ────────────────────────────────────────────────────
  const [showWhatIf, setShowWhatIf] = useState(false);

  // ── R1: AI Deep Intelligence ──────────────────────────────────────────
  const [showDependencyDetector, setShowDependencyDetector] = useState(false);
  const [showPriorityRecommender, setShowPriorityRecommender] = useState(false);
  const [showAutoClustering, setShowAutoClustering] = useState(false);
  const [showSentimentOverlay, setShowSentimentOverlay] = useState(false);

  // ── R2: Collaboration ─────────────────────────────────────────────────
  const [commentNodeId, setCommentNodeId] = useState<string | null>(null);
  const [nodeComments, setNodeComments] = useState<Record<string, NodeComment[]>>({});
  const [showActivityFeed, setShowActivityFeed] = useState(false);

  // ── R5: Analytics ─────────────────────────────────────────────────────
  const [showHealthScore, setShowHealthScore] = useState(true);
  const [showFunnelAnalytics, setShowFunnelAnalytics] = useState(false);

  // ── R4: Export & Embed ──────────────────────────────────────────────
  const [showExportPPTX, setShowExportPPTX] = useState(false);
  const [showEmbedInReports, setShowEmbedInReports] = useState(false);

  // ── R1.2: Competitive Landscape ──────────────────────────────────────
  const [showCompetitiveLandscape, setShowCompetitiveLandscape] = useState(false);

  // ── R5.3: Branch Comparison ────────────────────────────────────────
  const [showBranchComparison, setShowBranchComparison] = useState(false);

  // ── R5.4: Time Heatmap ─────────────────────────────────────────────
  const [showTimeHeatmap, setShowTimeHeatmap] = useState(false);

  // ── R4.2: Export Diagram Code ──────────────────────────────────────
  const [showExportDiagramCode, setShowExportDiagramCode] = useState(false);

  // ── R3.1+R3: Layout modes ──────────────────────────────────────────
  const [layoutMode, setLayoutMode] = useState<'tree' | 'radial' | 'force'>('tree');

  // ── R4.3: Import External Map ──────────────────────────────────────
  const [showImportExternalMap, setShowImportExternalMap] = useState(false);

  // ── R3.3: 3D Mind Map ──────────────────────────────────────────────
  const [showMindMap3D, setShowMindMap3D] = useState(false);

  // ── R4.5: Webhook Settings ─────────────────────────────────────────
  const [showWebhookSettings, setShowWebhookSettings] = useState(false);

  // ── AI expand ────────────────────────────────────────────────────────────
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiProposal, setAiProposal] = useState<AIMapProposal | null>(null);
  const [selectedAddIdx, setSelectedAddIdx] = useState<Record<number, boolean>>({});
  const [applySuggestedOrder, setApplySuggestedOrder] = useState(false);

  const closeAIModal = useCallback(() => {
    setShowAIModal(false);
    setAiProposal(null);
    setSelectedAddIdx({});
    setApplySuggestedOrder(false);
  }, []);

  const selectedAddCount = useMemo(() => {
    if (!aiProposal) return 0;
    return (aiProposal.add?.nodes || []).reduce((sum, _n, idx) => sum + (selectedAddIdx[idx] ? 1 : 0), 0);
  }, [aiProposal, selectedAddIdx]);

  const applyAIProposal = useCallback(async () => {
    if (!aiProposal) return;
    if (locked) { toast((isPolish ? 'Najpierw zaakceptuj wyzwanie.' : 'Accept the challenge first.') as any); return; }
    const toAddNodes = (aiProposal.add?.nodes || []).filter((_n, idx) => selectedAddIdx[idx]);
    const toAddEdges = aiProposal.add?.edges || [];

    if (toAddNodes.length === 0) { toast((isPolish ? 'Brak wybranych zmian' : 'No selected changes') as any); return; }

    pushUndo();
    setSaving(true);
    try {
      const nextNodes = (() => {
        const byId = new Map<string, Node>();
        for (const n of nodes as any) byId.set(String((n as any)?.id), n as any);
        for (const n of toAddNodes as any) byId.set(String((n as any)?.id), n as any);
        return Array.from(byId.values());
      })();
      const nextEdges = (() => {
        const byId = new Map<string, Edge>();
        for (const e of edges as any) byId.set(String((e as any)?.id), e as any);
        for (const e of toAddEdges as any) byId.set(String((e as any)?.id), e as any);
        return Array.from(byId.values());
      })();

      setNodes(nextNodes as any);
      setEdges(nextEdges as any);

      if (persistence === 'online') {
        await Api.saveMyIdeaMap(ideaId, { nodes: nextNodes as any, edges: nextEdges as any, preferredTool: preferredTool || undefined, extensions: extensions || undefined, fromAI: true });
        setLastSavedAt(Date.now());
      }

      toast.success(isPolish ? `Zastosowano propozycje AI (${toAddNodes.length} dodano)` : `Applied AI proposals (${toAddNodes.length} added)`, { duration: 1200 });
      closeAIModal();
    } catch (err: any) {
      toast.error(err?.message || (isPolish ? 'Nie udało się zastosować propozycji' : 'Failed to apply proposals'));
    } finally {
      setSaving(false);
    }
  }, [aiProposal, closeAIModal, edges, extensions, ideaId, isPolish, locked, nodes, persistence, preferredTool, pushUndo, selectedAddIdx, setEdges, setNodes]);

  const handleAIExpand = useCallback(async (targetNodeId?: string) => {
    if (locked) { toast((isPolish ? 'Najpierw zaakceptuj wyzwanie.' : 'Accept the challenge first.') as any); return; }
    if (persistence !== 'online') { toast((isPolish ? 'AI wymaga działającego backendu.' : 'AI requires backend.') as any); return; }
    setSaving(true);
    try {
      const anchor = targetNodeId
        ? nodes.find((n: any) => n?.id === targetNodeId)
        : (nodes.find((n: any) => n?.selected) || nodes.find((n: any) => String(n?.id) === 'root'));
      const anchorLabel = anchor?.data?.label || '';
      const anchorBranch = anchor?.data?.branchKey || selectedBranchKey;

      // Gather ancestor context for node-specific generation
      const ancestorLabels: string[] = [];
      if (anchor && anchor.id !== 'root') {
        let currentId = anchor.id;
        for (let depth = 0; depth < 5; depth++) {
          const parentEdge = edges.find((e) => e.target === currentId);
          if (!parentEdge) break;
          const parentNode = nodes.find((n) => n.id === parentEdge.source);
          if (parentNode?.data?.label) ancestorLabels.unshift(parentNode.data.label);
          currentId = parentEdge.source;
        }
      }

      const res = await Api.expandMyIdeaMap(ideaId, {
        anchorNodeId: String(anchor?.id || 'root'),
        branchKey: anchorBranch,
        count: 5,
        language: i18n.language,
        proposeOnly: true,
        context: anchorLabel ? `Node: "${anchorLabel}"${ancestorLabels.length > 0 ? ` | Path: ${ancestorLabels.join(' → ')} → ${anchorLabel}` : ''}` : undefined,
      });
      const proposedNodes = (() => {
        if (Array.isArray(res?.proposal?.add?.nodes)) return res.proposal.add.nodes;
        if (Array.isArray(res?.proposal?.add)) return res.proposal.add;
        return [];
      })();
      const proposedEdges = (() => {
        if (Array.isArray(res?.proposal?.add?.edges)) return res.proposal.add.edges;
        if (Array.isArray(res?.proposal?.edges)) return res.proposal.edges;
        return [];
      })();
      if (!proposedNodes.length) { toast((isPolish ? 'Brak nowych propozycji' : 'No new suggestions') as any); return; }

      setAiProposal({ add: { nodes: proposedNodes, edges: proposedEdges }, remove: { nodeIds: [], edgeIds: [] }, reorder: null, rationale: null });
      setSelectedAddIdx(Object.fromEntries(proposedNodes.map((_: any, idx: number) => [idx, true])) as Record<number, boolean>);
      setApplySuggestedOrder(false);
      setShowAIModal(true);
    } catch (err: any) {
      toast.error(err?.message || (isPolish ? 'AI nie zadziałało' : 'AI failed'));
    } finally {
      setSaving(false);
    }
  }, [edges, i18n.language, ideaId, isPolish, locked, nodes, persistence, selectedBranchKey]);

  // ── Node click / context menu ────────────────────────────────────────────
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'center') onCenterEdit?.();
    if (node.type === 'branch') toggleCollapse(node.id);
  }, [onCenterEdit, toggleCollapse]);

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'idea') {
      setDrawerNodeId(node.id);
    }
  }, []);

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    setContextMenu({ nodeId: node.id, nodeType: node.type || 'idea', x: e.clientX, y: e.clientY });
  }, []);

  const handleContextAction = useCallback((action: string) => {
    if (action === 'ctx_edit') startEditingSelected();
    if (action === 'ctx_open_detail') {
      const sel = getSelectedNode();
      if (sel && sel.type === 'idea') setDrawerNodeId(sel.id);
    }
    if (action === 'ctx_drill_down') {
      const sel = getSelectedNode();
      if (sel) handleDrillDown(sel.id);
    }
    if (action === 'ctx_add_child') addChildNode();
    if (action === 'ctx_add_sibling') addSiblingNode();
    if (action === 'ctx_ai_expand' || action === 'ctx_ai_deepen') {
      const sel = getSelectedNode();
      handleAIExpand(sel?.id);
    }
    if (action === 'ctx_what_if') setShowWhatIf(true);
    if (action === 'ctx_vote_up') {
      const sel = getSelectedNode();
      if (sel && sel.type === 'idea') {
        const currentVotes = sel.data?.votes ?? 0;
        const newVotes = currentVotes >= 5 ? 0 : currentVotes + 1;
        setNodes((prev: Node[]) =>
          prev.map((n) => n.id === sel.id ? { ...n, data: { ...n.data, votes: newVotes } } : n)
        );
      }
    }
    if (action === 'ctx_assign') {
      const sel = getSelectedNode();
      if (sel && sel.type === 'idea') {
        const name = window.prompt(isPolish ? 'Przypisz osobę:' : 'Assign person:');
        if (name) {
          setNodes((prev: Node[]) =>
            prev.map((n) => n.id === sel.id ? { ...n, data: { ...n.data, assignee: name } } : n)
          );
          toast.success(isPolish ? `Przypisano: ${name}` : `Assigned: ${name}`, { duration: 1000 });
        }
      }
    }
    if (action === 'ctx_comments') {
      const sel = getSelectedNode();
      if (sel && sel.type === 'idea') setCommentNodeId(sel.id);
    }
    if (action === 'ctx_dependencies') setShowDependencyDetector(true);
    if (action === 'ctx_priority') setShowPriorityRecommender(true);
    if (action === 'ctx_competitive') setShowCompetitiveLandscape(true);
    if (action === 'ctx_change_shape') {
      const sel = getSelectedNode();
      if (sel && sel.type === 'idea') {
        const shapes = ['default', 'circle', 'diamond', 'hexagon'];
        const current = sel.data?.shape || 'default';
        const nextIdx = (shapes.indexOf(current) + 1) % shapes.length;
        setNodes((prev: Node[]) =>
          prev.map((n) => n.id === sel.id ? { ...n, data: { ...n.data, shape: shapes[nextIdx] } } : n)
        );
        toast.success(`Shape: ${shapes[nextIdx]}`, { duration: 800 });
      }
    }
    if (action === 'ctx_add_image') {
      const sel = getSelectedNode();
      if (sel && sel.type === 'idea') {
        const url = window.prompt(isPolish ? 'URL obrazka:' : 'Image URL:');
        if (url) {
          setNodes((prev: Node[]) =>
            prev.map((n) => n.id === sel.id ? { ...n, data: { ...n.data, imageUrl: url } } : n)
          );
          toast.success(isPolish ? 'Obraz dodany' : 'Image added', { duration: 800 });
        }
      }
    }
    if (action === 'ctx_share_branch') {
      const sel = getSelectedNode();
      if (sel) {
        const url = `${window.location.origin}${window.location.pathname}?focusNode=${sel.id}`;
        navigator.clipboard.writeText(url).then(() => {
          toast.success(isPolish ? 'Link skopiowany!' : 'Link copied!', { duration: 1200 });
        }).catch(() => {
          window.prompt(isPolish ? 'Skopiuj link:' : 'Copy link:', url);
        });
      }
    }
    if (action === 'ctx_duplicate') duplicateSelected();
    if (action === 'ctx_delete') deleteSelected();
    if (action === 'ctx_convert_initiative') {
      window.dispatchEvent(new CustomEvent('idea-workspace-quick-action', { detail: { action: 'convert_initiative' } }));
    }
    if (action === 'ctx_convert_decision') {
      window.dispatchEvent(new CustomEvent('idea-workspace-quick-action', { detail: { action: 'convert_decision' } }));
    }
  }, [addChildNode, addSiblingNode, deleteSelected, duplicateSelected, getSelectedNode, handleAIExpand, handleDrillDown, startEditingSelected]);

  const savedLabel = useMemo(() => {
    if (persistence !== 'online') return isPolish ? 'Tryb lokalny (bez zapisu)' : 'Local mode (not saved)';
    if (saving) return isPolish ? 'Zapisuję...' : 'Saving...';
    if (!lastSavedAt) return isPolish ? 'Nie zapisano' : 'Not saved yet';
    const sec = Math.max(1, Math.round((Date.now() - lastSavedAt) / 1000));
    return isPolish ? `Zapisano ${sec}s temu` : `Saved ${sec}s ago`;
  }, [isPolish, lastSavedAt, persistence, saving]);

  const containerClassName = variant === 'overlay'
    ? 'fixed inset-0 z-[80] bg-slate-50 dark:bg-navy-950'
    : `relative w-full h-full bg-slate-50 dark:bg-navy-950 ${className || ''}`;

  return (
    <div className={containerClassName}>
      {/* Context menu */}
      {contextMenu && (
        <NodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          nodeType={contextMenu.nodeType}
          isLocked={locked}
          isPl={isPolish}
          onClose={() => setContextMenu(null)}
          onAction={handleContextAction}
        />
      )}

      {/* AI suggestions modal */}
      {showAIModal && aiProposal && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-3xl rounded-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                  {isPolish ? 'Proponowane zmiany mapy (AI)' : 'Proposed map changes (AI)'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {isPolish ? 'Zaznacz elementy do dodania, a następnie kliknij „Zastosuj".' : 'Select items to add, then click "Apply".'}
                </p>
              </div>
              <button onClick={closeAIModal} className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors" title={isPolish ? 'Zamknij' : 'Close'}>
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 max-h-[65vh] overflow-y-auto space-y-5">
              <div className="rounded-xl bg-slate-50/50 dark:bg-navy-950/20 p-3 space-y-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {isPolish ? 'Do wywalenia' : 'To remove'} (0)
                </span>
                <EmptyStateInline icon={GitBranch} dashed={false} className="p-5" message={isPolish ? 'Brak sugestii usunięć.' : 'No removal suggestions.'} />
              </div>

              <div className="rounded-xl bg-slate-50/50 dark:bg-navy-950/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {isPolish ? 'Do dodania' : 'To add'} ({aiProposal.add.nodes.length})
                  </span>
                  {aiProposal.add.nodes.length > 0 && (
                    <button onClick={() => setSelectedAddIdx(Object.fromEntries(aiProposal.add.nodes.map((_, idx) => [idx, true])) as Record<number, boolean>)} className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                      {isPolish ? 'Zaznacz wszystko' : 'Select all'}
                    </button>
                  )}
                </div>
                {aiProposal.add.nodes.length === 0 ? (
                  <EmptyStateInline icon={Plus} dashed={false} className="p-5" message={isPolish ? 'Brak propozycji do dodania.' : 'No additions proposed.'} />
                ) : (
                  <div className="space-y-1.5">
                    {aiProposal.add.nodes.map((n, idx) => (
                      <label key={String((n as any)?.id || idx)} className="flex items-start gap-2 p-2 rounded-xl bg-white/60 dark:bg-navy-900/30 hover:bg-white/80 dark:hover:bg-navy-900/40 transition-colors">
                        <input type="checkbox" checked={!!selectedAddIdx[idx]} onChange={(e) => setSelectedAddIdx((prev) => ({ ...prev, [idx]: e.target.checked }))} className="mt-1" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-800 dark:text-white">{String((n as any)?.data?.label || (n as any)?.id || 'Node')}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{isPolish ? 'Gałąź' : 'Branch'}: {String((n as any)?.data?.branchKey || selectedBranchKey)}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-slate-50/50 dark:bg-navy-950/20 p-3 space-y-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{isPolish ? 'Proponowana kolejność' : 'Suggested order'} (0)</span>
                <EmptyStateInline icon={Sparkles} dashed={false} className="p-5" message={isPolish ? 'Brak sugestii kolejności.' : 'No ordering suggestion.'} />
              </div>

              <Callout variant="purple" title={isPolish ? 'Plan' : 'Plan'} compact className="rounded-xl">
                <ul className="list-disc pl-4 space-y-1">
                  <li>{isPolish ? `Dodaj zaznaczone węzły: ${selectedAddCount}.` : `Add selected nodes: ${selectedAddCount}.`}</li>
                </ul>
              </Callout>
            </div>

            <div className="px-5 py-4 border-t border-slate-200/60 dark:border-navy-700/60 flex items-center justify-end gap-2">
              <button onClick={closeAIModal} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors">
                {isPolish ? 'Anuluj' : 'Cancel'}
              </button>
              <button onClick={() => void applyAIProposal()} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-400/50 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 transition-colors">
                {isPolish ? 'Zastosuj' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb for drill-down */}
      {drillPath.length > 0 && (
        <div className="absolute top-14 left-3 z-[91]">
          <SubMapBreadcrumb path={drillPath} onNavigate={handleBreadcrumbNavigate} isPl={isPolish} />
        </div>
      )}

      {/* Top bar */}
      <div className="absolute top-3 left-3 right-3 z-[90] flex items-center justify-between">
        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/85 dark:bg-navy-900/80 backdrop-blur-sm border border-slate-200/60 dark:border-white/[0.06] shadow-2xl">
          {showClose && (
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors" title={isPolish ? 'Zamknij mapę' : 'Close map'}>
              <X size={16} />
            </button>
          )}
          <div className="w-px h-5 bg-slate-200 dark:bg-white/[0.06]" />
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[520px]">
            {isPolish ? 'Mapa rekomendacji' : 'Recommendation map'} — {ideaTitle}
          </div>
          <div className="ml-2 text-[10px] text-slate-500 dark:text-slate-400">{savedLabel}</div>
        </div>

        <div className="flex items-center gap-1 px-2 py-1.5 bg-white/85 dark:bg-navy-900/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 dark:border-white/[0.06] shadow-2xl">
          <button onClick={() => zoomIn({ duration: 250 })} className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors" title={isPolish ? 'Przybliż' : 'Zoom in'}>
            <Plus size={16} />
          </button>
          <button onClick={() => zoomOut({ duration: 250 })} className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors" title={isPolish ? 'Oddal' : 'Zoom out'}>
            <Minus size={16} />
          </button>
          <div className="w-px h-5 bg-slate-200 dark:bg-white/[0.06] mx-0.5" />
          <button onClick={() => fitView({ padding: 0.3, duration: 300 })} className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors" title={isPolish ? 'Dopasuj widok' : 'Fit view'}>
            <RotateCcw size={14} />
          </button>
          <div className="w-px h-5 bg-slate-200 dark:bg-white/[0.06] mx-0.5" />
          <button onClick={handleAIExpand} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/15 transition-colors" title={isPolish ? 'AI: rozbuduj wybraną gałąź' : 'AI: expand selected branch'} disabled={locked || saving || persistence !== 'online'}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            AI
          </button>
          <div className="w-px h-5 bg-slate-200 dark:bg-white/[0.06] mx-0.5" />
          <div className="text-[10px] text-slate-500 dark:text-slate-400 px-1">
            {isPolish ? 'Tab=child Enter=sibling Space=collapse' : 'Tab=child Enter=sibling Space=collapse'}
          </div>
        </div>
      </div>

      {/* Canvas */}
      {loading ? (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="animate-spin text-amber-500" size={34} />
        </div>
      ) : (
        <ReactFlow
          nodes={visibleNodes}
          edges={visibleEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeContextMenu={onNodeContextMenu}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesConnectable={!locked}
          nodesFocusable
          edgesFocusable
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.1}
          maxZoom={3}
          proOptions={{ hideAttribution: true }}
          className="bg-slate-50 dark:bg-navy-950"
          aria-label={isPolish ? 'Mapa rekomendacji pomysłu — nawigacja strzałkami, Enter/Tab dodawanie węzłów' : 'Idea recommendation map — arrow navigation, Enter/Tab add nodes'}
          defaultEdgeOptions={{
            type: 'gradient',
            style: { stroke: '#8b5cf6', strokeWidth: 2, opacity: 0.7 },
            animated: true,
            data: { animated: true, showParticles: true },
          }}
        >
          <Background color="#1e293b" gap={22} size={1} />
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            className="rounded-xl border border-slate-200/40 dark:border-navy-700/40"
          />

          {/* Cluster Bubbles overlay */}
          {showClusterBubbles && (
            <ClusterBubbles
              nodes={visibleNodes.filter((n) => !n.hidden).map((n) => ({ id: n.id, position: n.position, data: n.data }))}
              edges={visibleEdges.filter((e) => !e.hidden).map((e) => ({ source: e.source, target: e.target }))}
              enabled={showClusterBubbles}
            />
          )}

          <Panel position="bottom-left">
            <div className="px-3 py-2 rounded-2xl bg-white/80 dark:bg-navy-900/75 backdrop-blur-sm border border-slate-200/60 dark:border-white/[0.06] shadow-2xl text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <Link2 size={14} className="text-slate-400" />
              <span className="font-semibold">{isPolish ? 'Aktywna gałąź' : 'Active branch'}:</span>
              <span className="text-slate-500 dark:text-slate-400">{selectedBranchKey}</span>
              <span className="text-slate-400">·</span>
              <span>
                {locked
                  ? isPolish ? 'Zaakceptuj wyzwanie, aby odblokować edycję' : 'Accept the challenge to unlock editing'
                  : isPolish ? 'Prawy klik = menu kontekstowe' : 'Right-click = context menu'}
              </span>
            </div>
          </Panel>
        </ReactFlow>
      )}

      {/* AI Branch Balancer */}
      <AIBranchBalancer
        nodes={nodes.map((n) => ({ id: n.id, data: n.data, type: n.type }))}
        edges={edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))}
        locked={locked}
        onFocusBranch={(branchKey) => {
          const branchNode = nodes.find((n) => n.data?.branchKey === branchKey && n.id.startsWith('branch-'));
          if (branchNode) {
            setNodes((prev: Node[]) => prev.map((n) => ({ ...n, selected: n.id === branchNode.id })));
            setTimeout(() => { try { fitView({ nodes: [{ id: branchNode.id } as any], padding: 0.5, duration: 400 }); } catch { /* ignore */ } }, 100);
          }
        }}
      />

      {/* AI What-If Scenarios */}
      {showWhatIf && (() => {
        const sel = nodes.find((n: any) => n?.selected);
        return (
          <AIWhatIfScenarios
            open={showWhatIf}
            onClose={() => setShowWhatIf(false)}
            ideaId={ideaId}
            ideaTitle={ideaTitle}
            selectedNodeLabel={sel?.data?.label || ideaTitle}
            selectedNodeId={sel?.id || 'root'}
            branchKey={sel?.data?.branchKey || 'options'}
            allNodes={nodes.map((n) => ({ id: n.id, data: n.data }))}
            locked={locked}
            onApplyScenario={(scenario) => {
              pushUndo();
              window.dispatchEvent(
                new CustomEvent('idea-workspace-insert', {
                  detail: {
                    items: [{ text: scenario.title, type: scenario.type === 'risk' ? 'risk_flags' : 'topics' }],
                    ideaId,
                  },
                })
              );
            }}
          />
        );
      })()}

      {/* AI Blind Spots Detector */}
      <AIBlindSpotsDetector
        ideaId={ideaId}
        ideaTitle={ideaTitle}
        nodes={nodes.map((n) => ({ id: n.id, data: n.data }))}
        edges={edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))}
        persistence={persistence}
        locked={locked}
        onAddBlindSpot={(spot) => {
          pushUndo();
          window.dispatchEvent(
            new CustomEvent('idea-workspace-insert', {
              detail: {
                items: [{ text: spot.area, type: 'topics' }],
                ideaId,
              },
            })
          );
        }}
      />

      {/* Batch Convert Modal */}
      <BatchConvertModal
        open={showBatchConvert}
        onClose={() => setShowBatchConvert(false)}
        nodes={nodes
          .filter((n) => n.type === 'idea')
          .map((n) => ({ id: n.id, label: n.data?.label || '', branchKey: n.data?.branchKey || '', status: n.data?.status }))}
        locked={locked}
        onConvert={(nodeIds, target) => {
          for (const nid of nodeIds) {
            setNodes((prev: Node[]) => prev.map((n) => n.id === nid ? { ...n, data: { ...n.data, status: 'converted' } } : n));
          }
          window.dispatchEvent(new CustomEvent('idea-workspace-quick-action', { detail: { action: target === 'initiative' ? 'convert_initiative' : 'convert_decision', nodeIds } }));
        }}
      />

      {/* Timeline View */}
      <TimelineView
        open={showTimeline}
        onClose={() => setShowTimeline(false)}
        nodes={nodes
          .filter((n) => n.type === 'idea')
          .map((n) => ({ id: n.id, label: n.data?.label || '', branchKey: n.data?.branchKey || '', status: n.data?.status || 'idea' }))}
        onSelectNode={(nodeId) => {
          setShowTimeline(false);
          setNodes((prev: Node[]) => prev.map((n) => ({ ...n, selected: n.id === nodeId })));
          setTimeout(() => { try { fitView({ nodes: [{ id: nodeId } as any], padding: 0.5, duration: 400 }); } catch { /* ignore */ } }, 100);
        }}
      />

      {/* Presentation Mode */}
      <PresentationMode
        open={showPresentation}
        onClose={() => setShowPresentation(false)}
        ideaTitle={ideaTitle}
        branches={nodes
          .filter((n) => n.id.startsWith('branch-'))
          .map((bn) => ({
            branchKey: bn.data?.branchKey || '',
            label: bn.data?.label || '',
            nodes: edges
              .filter((e) => e.source === bn.id)
              .map((e) => {
                const child = nodes.find((n) => n.id === e.target);
                return child ? { id: child.id, label: child.data?.label || '', status: child.data?.status } : null;
              })
              .filter(Boolean) as Array<{ id: string; label: string; status?: string }>,
          }))}
        onFocusBranch={(branchKey) => {
          setShowPresentation(false);
          const branchNode = nodes.find((n) => n.data?.branchKey === branchKey && n.id.startsWith('branch-'));
          if (branchNode) {
            setNodes((prev: Node[]) => prev.map((n) => ({ ...n, selected: n.id === branchNode.id })));
            setTimeout(() => { try { fitView({ nodes: [{ id: branchNode.id } as any], padding: 0.5, duration: 400 }); } catch { /* ignore */ } }, 100);
          }
        }}
      />

      {/* Voice to Node */}
      <VoiceToNode
        open={showVoiceToNode}
        onClose={() => setShowVoiceToNode(false)}
        locked={locked}
        onAddNodes={(labels) => {
          pushUndo();
          for (const label of labels) {
            window.dispatchEvent(
              new CustomEvent('idea-workspace-insert', {
                detail: { items: [{ text: label, type: 'topics' }], ideaId },
              })
            );
          }
        }}
      />

      {/* Document to Map */}
      <DocumentToMap
        open={showDocToMap}
        onClose={() => setShowDocToMap(false)}
        ideaId={ideaId}
        ideaTitle={ideaTitle}
        locked={locked}
        onAddNodes={(labels) => {
          pushUndo();
          for (const label of labels) {
            window.dispatchEvent(
              new CustomEvent('idea-workspace-insert', {
                detail: { items: [{ text: label, type: 'topics' }], ideaId },
              })
            );
          }
        }}
      />

      {/* Interview to Map */}
      <InterviewToMap
        open={showInterviewToMap}
        onClose={() => setShowInterviewToMap(false)}
        ideaId={ideaId}
        ideaTitle={ideaTitle}
        locked={locked}
        onAddNodes={(items) => {
          pushUndo();
          const branchMap: Record<string, string> = {
            problem: 'topics',
            goal: 'topics',
            options: 'topics',
            evidence: 'findings',
            risks: 'risk_flags',
            experiments: 'next_steps',
          };
          for (const item of items) {
            window.dispatchEvent(
              new CustomEvent('idea-workspace-insert', {
                detail: { items: [{ text: item.text, type: branchMap[item.branchKey] || 'topics' }], ideaId },
              })
            );
          }
        }}
      />

      {/* Snapshot History */}
      <SnapshotHistory
        open={showSnapshots}
        onClose={() => setShowSnapshots(false)}
        ideaId={ideaId}
        currentNodes={nodes}
        currentEdges={edges}
        onRestore={(restoredNodes, restoredEdges) => {
          pushUndo();
          setNodes(restoredNodes);
          setEdges(restoredEdges);
        }}
      />

      {/* Node Detail Drawer */}
      <NodeDetailDrawer
        open={!!drawerNodeId}
        onClose={() => setDrawerNodeId(null)}
        nodeData={drawerNodeData}
        ideaId={ideaId}
        ideaTitle={ideaTitle}
        locked={locked}
        allNodes={nodes.map((n) => ({ id: n.id, data: n.data }))}
        allEdges={edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))}
        onUpdateNode={handleUpdateNode}
        onAIExpandNode={(nodeId) => {
          setNodes((prev: Node[]) => prev.map((n) => ({ ...n, selected: n.id === nodeId })));
          handleAIExpand();
        }}
        onConvertNode={handleConvertNode}
        onNavigateToNode={handleNavigateToNode}
        onDrillDown={handleDrillDown}
      />

      {/* R1.3: AI Dependency Detection */}
      <AIDependencyDetector
        open={showDependencyDetector}
        onClose={() => setShowDependencyDetector(false)}
        ideaId={ideaId}
        ideaTitle={ideaTitle}
        nodes={nodes.map((n) => ({ id: n.id, data: n.data }))}
        edges={edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))}
        locked={locked}
        onAddDependency={(dep) => {
          pushUndo();
          const edgeId = `dep-edge-${uid()}`;
          const depType = dep.type || 'related_to';
          const color = depType === 'depends_on' ? '#ef4444' : depType === 'enables' ? '#22c55e' : depType === 'conflicts_with' ? '#f59e0b' : '#8b5cf6';
          const newEdge: Edge = {
            id: edgeId,
            source: dep.sourceNodeId,
            target: dep.targetNodeId,
            type: 'labeled',
            animated: true,
            style: { stroke: color, strokeWidth: 2, opacity: 0.7, strokeDasharray: depType === 'conflicts_with' ? '5 5' : undefined },
            data: { label: dep.relationship, depType, userCreated: true },
          };
          setEdges((prev: Edge[]) => addEdge(newEdge, prev));
          pushActivity(ideaId, { type: 'node_edited', actor: 'You', nodeLabel: dep.sourceLabel, nodeId: dep.sourceNodeId, detail: `Dependency → ${dep.targetLabel}` });
        }}
        onAddAll={(deps) => {
          pushUndo();
          for (const dep of deps) {
            const edgeId = `dep-edge-${uid()}`;
            const depType = dep.type || 'related_to';
            const color = depType === 'depends_on' ? '#ef4444' : depType === 'enables' ? '#22c55e' : depType === 'conflicts_with' ? '#f59e0b' : '#8b5cf6';
            const newEdge: Edge = {
              id: edgeId,
              source: dep.sourceNodeId,
              target: dep.targetNodeId,
              type: 'labeled',
              animated: true,
              style: { stroke: color, strokeWidth: 2, opacity: 0.7, strokeDasharray: depType === 'conflicts_with' ? '5 5' : undefined },
              data: { label: dep.relationship, depType, userCreated: true },
            };
            setEdges((prev: Edge[]) => addEdge(newEdge, prev));
          }
          pushActivity(ideaId, { type: 'node_edited', actor: 'You', detail: `Added ${deps.length} dependencies` });
        }}
      />

      {/* R1.5: AI Priority Recommender */}
      <AIPriorityRecommender
        open={showPriorityRecommender}
        onClose={() => setShowPriorityRecommender(false)}
        ideaId={ideaId}
        ideaTitle={ideaTitle}
        nodes={nodes.map((n) => ({ id: n.id, data: n.data }))}
        locked={locked}
        onApplyPriorities={(updates) => {
          pushUndo();
          setNodes((prev: Node[]) =>
            prev.map((n) => {
              const upd = updates.find((u) => u.nodeId === n.id);
              if (!upd) return n;
              return { ...n, data: { ...n.data, priority: upd.priority } };
            })
          );
          pushActivity(ideaId, { type: 'ai_suggestion', actor: 'AI', detail: `Updated ${updates.length} node priorities` });
        }}
      />

      {/* R1.1: AI Auto-Clustering */}
      <AIAutoClustering
        open={showAutoClustering}
        onClose={() => setShowAutoClustering(false)}
        ideaId={ideaId}
        ideaTitle={ideaTitle}
        nodes={nodes.map((n) => ({ id: n.id, data: n.data }))}
        locked={locked}
        onApplyClusters={(clusters) => {
          pushUndo();
          setNodes((prev: Node[]) =>
            prev.map((n) => {
              const cluster = clusters.find((c) => c.nodeIds.includes(n.id));
              if (!cluster) return n;
              return { ...n, data: { ...n.data, clusterColor: cluster.color, clusterName: cluster.name } };
            })
          );
          pushActivity(ideaId, { type: 'ai_suggestion', actor: 'AI', detail: `Applied ${clusters.length} clusters` });
        }}
      />

      {/* R1.4: AI Sentiment Analysis */}
      <AISentimentOverlay
        open={showSentimentOverlay}
        onClose={() => setShowSentimentOverlay(false)}
        ideaId={ideaId}
        ideaTitle={ideaTitle}
        nodes={nodes.map((n) => ({ id: n.id, data: n.data }))}
        locked={locked}
        onApplySentiment={(results) => {
          pushUndo();
          setNodes((prev: Node[]) =>
            prev.map((n) => {
              const r = results.find((s) => s.nodeId === n.id);
              if (!r) return n;
              const sentimentColor = r.sentiment === 'positive' ? '#22c55e' : r.sentiment === 'negative' ? '#ef4444' : '#94a3b8';
              return { ...n, data: { ...n.data, sentimentColor, sentiment: r.sentiment } };
            })
          );
          pushActivity(ideaId, { type: 'ai_suggestion', actor: 'AI', detail: `Sentiment analysis applied to ${results.length} nodes` });
        }}
      />

      {/* R2.3: Comment Threads */}
      {commentNodeId && (() => {
        const node = nodes.find((n) => n.id === commentNodeId);
        return (
          <NodeCommentThread
            open={!!commentNodeId}
            onClose={() => setCommentNodeId(null)}
            nodeId={commentNodeId}
            nodeLabel={node?.data?.label || commentNodeId}
            comments={nodeComments[commentNodeId] || []}
            locked={locked}
            currentUser="You"
            onAddComment={(nid, comment) => {
              setNodeComments((prev) => ({
                ...prev,
                [nid]: [...(prev[nid] || []), comment],
              }));
              pushActivity(ideaId, { type: 'comment', actor: comment.author, nodeLabel: node?.data?.label, nodeId: nid, detail: comment.text.slice(0, 60) });
            }}
            onDeleteComment={(nid, commentId) => {
              setNodeComments((prev) => ({
                ...prev,
                [nid]: (prev[nid] || []).filter((c) => c.id !== commentId),
              }));
            }}
          />
        );
      })()}

      {/* R2.4: Activity Feed */}
      <ActivityFeed
        open={showActivityFeed}
        onClose={() => setShowActivityFeed(false)}
        ideaId={ideaId}
        onNavigateToNode={handleNavigateToNode}
      />

      {/* R5.1: Map Health Score */}
      <MapHealthScore
        nodes={nodes.map((n) => ({ id: n.id, data: n.data, type: n.type }))}
        edges={edges.map((e) => ({ source: e.source, target: e.target }))}
        visible={showHealthScore}
      />

      {/* R5.2: Idea Funnel Analytics */}
      <IdeaFunnelAnalytics
        open={showFunnelAnalytics}
        onClose={() => setShowFunnelAnalytics(false)}
        nodes={nodes.map((n) => ({ id: n.id, data: n.data }))}
      />

      {/* R4.1: Export to PowerPoint */}
      <ExportPowerPoint
        open={showExportPPTX}
        onClose={() => setShowExportPPTX(false)}
        ideaTitle={ideaTitle}
        branches={nodes
          .filter((n) => n.id.startsWith('branch-'))
          .map((bn) => ({
            branchKey: bn.data?.branchKey || '',
            label: bn.data?.label || '',
            nodes: edges
              .filter((e) => e.source === bn.id)
              .map((e) => {
                const child = nodes.find((n) => n.id === e.target);
                return child ? { id: child.id, label: child.data?.label || '', status: child.data?.status } : null;
              })
              .filter(Boolean) as Array<{ id: string; label: string; status?: string }>,
          }))}
      />

      {/* R4.4: Embed in Reports */}
      <EmbedInReports
        open={showEmbedInReports}
        onClose={() => setShowEmbedInReports(false)}
        ideaId={ideaId}
        ideaTitle={ideaTitle}
        nodes={nodes.map((n) => ({ id: n.id, data: n.data }))}
        edges={edges.map((e) => ({ source: e.source, target: e.target }))}
      />

      {/* R1.2: AI Competitive Landscape */}
      <AICompetitiveLandscape
        open={showCompetitiveLandscape}
        onClose={() => setShowCompetitiveLandscape(false)}
        ideaId={ideaId}
        ideaTitle={ideaTitle}
        nodes={nodes.map((n) => ({ id: n.id, data: n.data }))}
        locked={locked}
        onAddToMap={(items) => {
          for (const item of items) {
            window.dispatchEvent(
              new CustomEvent('idea-workspace-insert', {
                detail: { items: [item], ideaId },
              })
            );
          }
          pushActivity(ideaId, { type: 'ai_suggestion', actor: 'AI', detail: `Competitive landscape: ${items.length} items` });
        }}
      />

      {/* R5.3: Branch Comparison */}
      <BranchComparison
        open={showBranchComparison}
        onClose={() => setShowBranchComparison(false)}
        nodes={nodes.map((n) => ({ id: n.id, data: n.data }))}
        edges={edges.map((e) => ({ source: e.source, target: e.target }))}
      />

      {/* R5.4: Time Heatmap */}
      <TimeHeatmap
        open={showTimeHeatmap}
        onClose={() => setShowTimeHeatmap(false)}
        ideaId={ideaId}
      />

      {/* R4.2: Export Diagram Code */}
      <ExportDiagramCode
        open={showExportDiagramCode}
        onClose={() => setShowExportDiagramCode(false)}
        ideaTitle={ideaTitle}
        nodes={nodes.map((n) => ({ id: n.id, data: n.data }))}
        edges={edges.map((e) => ({ source: e.source, target: e.target }))}
      />

      {/* R4.3: Import External Map */}
      <ImportExternalMap
        open={showImportExternalMap}
        onClose={() => setShowImportExternalMap(false)}
        locked={locked}
        onImport={(items) => {
          pushUndo();
          for (const item of items) {
            window.dispatchEvent(
              new CustomEvent('idea-workspace-insert', {
                detail: { items: [{ text: item.label, type: 'topics' }], ideaId },
              })
            );
          }
          pushActivity(ideaId, { type: 'node_added', actor: 'You', detail: `Imported ${items.length} nodes from external file` });
        }}
      />

      {/* R3.3: 3D Mind Map View */}
      <MindMap3DView
        open={showMindMap3D}
        onClose={() => setShowMindMap3D(false)}
        ideaTitle={ideaTitle}
        nodes={nodes.map((n) => ({ id: n.id, data: n.data, position: n.position }))}
        edges={edges.map((e) => ({ source: e.source, target: e.target }))}
      />

      {/* R2.1+R2.2: Collaboration Overlay (auto-hides when no connection) */}
      <CollaborationOverlay
        ideaId={ideaId}
        currentUserId="current-user"
        currentUserName="You"
      />

      {/* R4.5: Webhook Settings */}
      <WebhookSettings
        open={showWebhookSettings}
        onClose={() => setShowWebhookSettings(false)}
        ideaId={ideaId}
      />
    </div>
  );
}

export const IdeaRecommendationMap: React.FC<IdeaRecommendationMapProps> = (props) => (
  <ReactFlowProvider>
    <MindMapInner {...props} />
  </ReactFlowProvider>
);

export default IdeaRecommendationMap;
