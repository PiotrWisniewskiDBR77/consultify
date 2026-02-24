/**
 * IdeasMindMap — Interactive mind map of ideas using React Flow.
 *
 * Groups ideas by branch/area/tags into a visual tree.
 * Supports drag-and-drop between branches (changes idea.branch).
 * Allows connecting ideas to each other (tree-like relationships).
 * Only shows titles — lightweight and fast.
 */

import 'reactflow/dist/style.css';

import { Bot, Flower2, GitBranch, Lightbulb, Link2, Minus, Plus, RotateCcw } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import ReactFlow, {
  addEdge,
  Background,
  type Connection,
  ConnectionMode,
  type Edge,
  Handle,
  type Node,
  type NodeProps,
  Panel,
  Position,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from 'reactflow';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

import type { MyIdea } from './MyIdeasListContent';

const BRANCH_COLORS: Record<
  string,
  { bg: string; border: string; text: string; ring: string; edge: string }
> = {
  strategy: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    border: 'border-blue-400',
    text: 'text-blue-700 dark:text-blue-300',
    ring: 'ring-blue-400',
    edge: '#60a5fa',
  },
  product: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    border: 'border-emerald-400',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-400',
    edge: '#34d399',
  },
  process: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    border: 'border-purple-400',
    text: 'text-purple-700 dark:text-purple-300',
    ring: 'ring-purple-400',
    edge: '#a78bfa',
  },
  culture: {
    bg: 'bg-rose-100 dark:bg-rose-900/30',
    border: 'border-rose-400',
    text: 'text-rose-700 dark:text-rose-300',
    ring: 'ring-rose-400',
    edge: '#fb7185',
  },
  tech: {
    bg: 'bg-cyan-100 dark:bg-cyan-900/30',
    border: 'border-cyan-400',
    text: 'text-cyan-700 dark:text-cyan-300',
    ring: 'ring-cyan-400',
    edge: '#22d3ee',
  },
  growth: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    border: 'border-amber-400',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-400',
    edge: '#fbbf24',
  },
  uncategorized: {
    bg: 'bg-slate-100 dark:bg-slate-800/50',
    border: 'border-slate-300',
    text: 'text-slate-600 dark:text-slate-400',
    ring: 'ring-slate-400',
    edge: '#94a3b8',
  },
};

function getBranchForIdea(idea: MyIdea): string {
  if (idea.branch) return idea.branch;
  if (idea.area) {
    const a = idea.area.toLowerCase();
    if (a.includes('strat')) return 'strategy';
    if (a.includes('prod') || a.includes('feature')) return 'product';
    if (a.includes('proc') || a.includes('ops')) return 'process';
    if (a.includes('cult') || a.includes('team') || a.includes('hr')) return 'culture';
    if (a.includes('tech') || a.includes('dev') || a.includes('infra')) return 'tech';
    if (a.includes('grow') || a.includes('market') || a.includes('sales')) return 'growth';
  }
  const tags = (idea.tags || []).map((t) => t.toLowerCase());
  for (const t of tags) {
    if (t.includes('strat')) return 'strategy';
    if (t.includes('prod') || t.includes('feature')) return 'product';
    if (t.includes('proc') || t.includes('ops')) return 'process';
    if (t.includes('cult') || t.includes('team')) return 'culture';
    if (t.includes('tech') || t.includes('dev')) return 'tech';
    if (t.includes('grow') || t.includes('market')) return 'growth';
  }
  return 'uncategorized';
}

const BRANCH_LABELS: Record<string, { en: string; pl: string }> = {
  strategy: { en: 'Strategy', pl: 'Strategia' },
  product: { en: 'Product', pl: 'Produkt' },
  process: { en: 'Process', pl: 'Proces' },
  culture: { en: 'Culture & Team', pl: 'Kultura i Zespół' },
  tech: { en: 'Technology', pl: 'Technologia' },
  growth: { en: 'Growth', pl: 'Wzrost' },
  uncategorized: { en: 'Uncategorized', pl: 'Bez kategorii' },
};

// ─────── Custom Node: Center Hub ───────
const CenterNodeComponent: React.FC<NodeProps> = React.memo(({ data }) => (
  <div className="flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-xl shadow-amber-500/30 border-4 border-white dark:border-navy-800">
    <Handle type="source" position={Position.Top} id="top" className="!opacity-0 !w-1 !h-1" />
    <Handle type="source" position={Position.Right} id="right" className="!opacity-0 !w-1 !h-1" />
    <Handle type="source" position={Position.Bottom} id="bottom" className="!opacity-0 !w-1 !h-1" />
    <Handle type="source" position={Position.Left} id="left" className="!opacity-0 !w-1 !h-1" />
    <div className="text-center">
      <Flower2 size={28} className="text-white mx-auto" />
      <div className="text-[10px] font-bold text-white mt-1">{data.label}</div>
    </div>
  </div>
));
CenterNodeComponent.displayName = 'CenterNode';

// ─────── Custom Node: Branch ───────
const BranchNodeComponent: React.FC<NodeProps> = React.memo(({ data, selected }) => {
  const colors = BRANCH_COLORS[data.branchKey] || BRANCH_COLORS.uncategorized;
  return (
    <div
      className={`px-4 py-2.5 rounded-2xl border-2 ${colors.border} ${colors.bg} ${selected ? `ring-2 ${colors.ring}` : ''} shadow-md min-w-[100px] text-center`}
    >
      <Handle type="target" position={Position.Left} className="!opacity-0 !w-1 !h-1" />
      <Handle type="source" position={Position.Right} id="right" className="!opacity-0 !w-1 !h-1" />
      <Handle type="source" position={Position.Top} id="top" className="!opacity-0 !w-1 !h-1" />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!opacity-0 !w-1 !h-1"
      />
      <div className={`text-xs font-bold ${colors.text} flex items-center gap-1 justify-center`}>
        <GitBranch size={12} />
        {data.label}
      </div>
      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
        {data.count} {data.count === 1 ? 'idea' : 'ideas'}
      </div>
    </div>
  );
});
BranchNodeComponent.displayName = 'BranchNode';

// ─────── Custom Node: Idea (with connectable handles on all 4 sides, always visible) ───────
const handleBase = '!w-2.5 !h-2.5 !border-2 transition-all duration-150';
const handleTarget = `${handleBase} !bg-emerald-300 dark:!bg-emerald-600 !border-emerald-500 hover:!bg-emerald-400 hover:!scale-150`;
const handleSource = `${handleBase} !bg-amber-300 dark:!bg-amber-600 !border-amber-500 hover:!bg-amber-400 hover:!scale-150`;

const IdeaNodeComponent: React.FC<NodeProps> = React.memo(({ data, selected }) => {
  const colors = BRANCH_COLORS[data.branchKey] || BRANCH_COLORS.uncategorized;
  const isAI =
    data.sourceType === 'ai_chat' ||
    data.sourceType === 'ai_hint' ||
    data.sourceType === 'ai_suggestion';
  const p = data.priority ?? 50;
  const priorityColor = p >= 75 ? 'bg-emerald-400' : p >= 50 ? 'bg-amber-400' : 'bg-slate-400';

  return (
    <div
      className={`group px-3 py-2 rounded-xl border-2 ${colors.border} bg-white dark:bg-navy-900 ${selected ? `ring-2 ${colors.ring}` : ''} shadow-sm hover:shadow-lg cursor-pointer max-w-[180px]`}
    >
      <Handle type="target" position={Position.Left} id="target-left" className={handleTarget} />
      <Handle type="target" position={Position.Top} id="target-top" className={handleTarget} />
      <Handle type="source" position={Position.Right} id="source-right" className={handleSource} />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        className={handleSource}
      />
      <div className="flex items-start gap-1.5">
        <div className="flex-shrink-0 mt-0.5">
          {isAI ? (
            <Bot size={10} className="text-purple-500" />
          ) : (
            <Lightbulb size={10} className="text-amber-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className={`text-[11px] font-semibold ${colors.text} line-clamp-2 leading-tight`}>
            {data.label}
          </div>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-1">
        <div className="w-8 h-0.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
          <div
            className={`h-full rounded-full ${priorityColor}`}
            style={{ width: `${Math.max(10, p)}%` }}
          />
        </div>
        {data.area && (
          <span className="text-[8px] text-slate-400 truncate max-w-[60px]">{data.area}</span>
        )}
      </div>
    </div>
  );
});
IdeaNodeComponent.displayName = 'IdeaNode';

const nodeTypes = {
  center: CenterNodeComponent,
  branch: BranchNodeComponent,
  idea: IdeaNodeComponent,
};

interface IdeasMindMapProps {
  ideas: MyIdea[];
  onIdeaClick: (ideaId: string, ideaData?: MyIdea) => void;
  onCreateIdea: () => void;
  isPolish: boolean;
}

function buildMindMapLayout(ideas: MyIdea[], isPolish: boolean): { nodes: Node[]; edges: Edge[] } {
  const branches: Record<string, MyIdea[]> = {};
  for (const idea of ideas) {
    const b = getBranchForIdea(idea);
    if (!branches[b]) branches[b] = [];
    branches[b].push(idea);
  }

  // Always show all branch keys so users can drag ideas to empty branches
  const allKeys = Object.keys(BRANCH_LABELS);
  const sortedBranches: [string, MyIdea[]][] = allKeys.map((k) => [k, branches[k] || []]);

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  nodes.push({
    id: 'center',
    type: 'center',
    position: { x: 0, y: 0 },
    data: { label: isPolish ? 'Moje Pomysły' : 'My Ideas' },
    draggable: false,
  });

  const branchCount = sortedBranches.length;
  const angleStep = (2 * Math.PI) / Math.max(branchCount, 1);
  const branchRadius = 320;

  sortedBranches.forEach(([branchKey, branchIdeas], bIdx) => {
    const angle = angleStep * bIdx - Math.PI / 2;
    const bx = Math.cos(angle) * branchRadius;
    const by = Math.sin(angle) * branchRadius;
    const branchId = `branch-${branchKey}`;
    const labels = BRANCH_LABELS[branchKey] || { en: branchKey, pl: branchKey };
    const colors = BRANCH_COLORS[branchKey] || BRANCH_COLORS.uncategorized;

    nodes.push({
      id: branchId,
      type: 'branch',
      position: { x: bx - 50, y: by - 20 },
      data: {
        label: isPolish ? labels.pl : labels.en,
        branchKey,
        count: branchIdeas.length,
      },
    });

    const handleIds = ['top', 'right', 'bottom', 'left'];
    edges.push({
      id: `center-${branchId}`,
      source: 'center',
      target: branchId,
      sourceHandle: handleIds[bIdx % 4],
      type: 'smoothstep',
      style: {
        stroke: colors.edge,
        strokeWidth: 2.5,
        opacity: branchIdeas.length > 0 ? 0.6 : 0.2,
      },
      animated: branchIdeas.length > 0,
    });

    if (branchIdeas.length === 0) return;

    const sortedIdeas = [...branchIdeas].sort((a, b) => (b.priority ?? 50) - (a.priority ?? 50));
    const ideaCount = sortedIdeas.length;

    // Adaptive layout: grid for many ideas, radial fan for few
    if (ideaCount <= 5) {
      // Radial fan with generous spacing
      const ideaRadius = 200;
      const ideaAngleSpan = Math.min(Math.PI * 1.2, ideaCount * 0.5);
      sortedIdeas.forEach((idea, iIdx) => {
        const ideaAngle =
          angle + (iIdx - (ideaCount - 1) / 2) * (ideaAngleSpan / Math.max(ideaCount - 1, 1));
        const ix = bx + Math.cos(ideaAngle) * ideaRadius;
        const iy = by + Math.sin(ideaAngle) * ideaRadius;
        addIdeaNode(idea, branchKey, branchId, ix, iy, colors, iIdx);
      });
    } else {
      // Grid layout radiating outward from branch — 3 columns
      const cols = 3;
      const colWidth = 200;
      const rowHeight = 65;
      const outwardAngle = angle;
      const baseX = bx + Math.cos(outwardAngle) * 180;
      const baseY = by + Math.sin(outwardAngle) * 180;
      // Offset so grid is centered on the outward direction
      const perpX = -Math.sin(outwardAngle);
      const perpY = Math.cos(outwardAngle);
      const radX = Math.cos(outwardAngle);
      const radY = Math.sin(outwardAngle);

      sortedIdeas.forEach((idea, iIdx) => {
        const col = iIdx % cols;
        const row = Math.floor(iIdx / cols);
        const colOffset = (col - (cols - 1) / 2) * colWidth;
        const rowOffset = row * rowHeight;
        const ix = baseX + perpX * colOffset + radX * rowOffset;
        const iy = baseY + perpY * colOffset + radY * rowOffset;
        addIdeaNode(idea, branchKey, branchId, ix, iy, colors, iIdx);
      });
    }
  });

  function addIdeaNode(
    idea: MyIdea,
    branchKey: string,
    branchId: string,
    ix: number,
    iy: number,
    colors: (typeof BRANCH_COLORS)[string],
    iIdx: number
  ) {
    const ideaNodeId = `idea-${idea.id}`;
    nodes.push({
      id: ideaNodeId,
      type: 'idea',
      position: { x: ix - 90, y: iy - 15 },
      data: {
        label: idea.title,
        branchKey,
        sourceType: idea.sourceType,
        priority: idea.priority,
        area: idea.area,
        ideaId: idea.id,
      },
      draggable: true,
    });

    const sourceHandles = ['right', 'top', 'bottom'];
    edges.push({
      id: `${branchId}-${ideaNodeId}`,
      source: branchId,
      target: ideaNodeId,
      sourceHandle: sourceHandles[iIdx % 3],
      targetHandle: 'target-left',
      type: 'smoothstep',
      style: { stroke: colors.edge, strokeWidth: 1.5, opacity: 0.4 },
    });
  }

  return { nodes, edges };
}

function MindMapInner({ ideas, onIdeaClick, onCreateIdea, isPolish }: IdeasMindMapProps) {
  const onIdeaClickRef = useRef(onIdeaClick);
  onIdeaClickRef.current = onIdeaClick;

  const { zoomIn, zoomOut, fitView } = useReactFlow();

  const ideasKey = useMemo(() => ideas.map((i) => i.id).join(','), [ideas]);

  const { nodes: initNodes, edges: initEdges } = useMemo(
    () => buildMindMapLayout(ideas, isPolish),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ideasKey, isPolish]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);

  const [showHelp, setShowHelp] = useState(false);

  const allBranchKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const idea of ideas) keys.add(getBranchForIdea(idea));
    return keys;
  }, [ideas]);

  const [activeBranches, setActiveBranches] = useState<Set<string>>(
    () => new Set(Object.keys(BRANCH_LABELS))
  );

  const ideaIdSet = useMemo(() => new Set(ideas.map((i) => String(i.id))), [ideas]);

  const toggleBranch = useCallback((key: string) => {
    setActiveBranches((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const showAll = useCallback(() => {
    setActiveBranches(new Set(Object.keys(BRANCH_LABELS)));
  }, []);

  const applyBranchVisibility = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      const hiddenBranches = new Set<string>();
      for (const key of Object.keys(BRANCH_LABELS)) {
        if (!activeBranches.has(key)) hiddenBranches.add(key);
      }

      const hiddenNodeIds = new Set<string>();
      for (const n of nextNodes) {
        if (n.type === 'branch' && hiddenBranches.has(n.data.branchKey)) hiddenNodeIds.add(n.id);
        if (n.type === 'idea' && hiddenBranches.has(n.data.branchKey)) hiddenNodeIds.add(n.id);
      }

      const nodesWithHidden = nextNodes.map((n: Node) =>
        hiddenNodeIds.has(n.id) ? { ...n, hidden: true } : { ...n, hidden: false }
      );

      const edgesWithHidden = nextEdges.map((e: Edge) =>
        hiddenNodeIds.has(e.source) || hiddenNodeIds.has(e.target)
          ? { ...e, hidden: true }
          : { ...e, hidden: false }
      );

      return { nodes: nodesWithHidden, edges: edgesWithHidden };
    },
    [activeBranches]
  );

  // Keep layout nodes/edges in sync when ideas change, but preserve user edges.
  useEffect(() => {
    const { nodes: nextNodes } = applyBranchVisibility(initNodes, []);
    setNodes(nextNodes);

    setEdges((prev) => {
      const userEdges = (prev || []).filter((e: Edge) => Boolean(e.data?.userCreated));
      const validUserEdges = userEdges.filter((e: Edge) => {
        const s = String(e.source || '');
        const t = String(e.target || '');
        const sOk = s.startsWith('idea-') ? ideaIdSet.has(s.replace('idea-', '')) : true;
        const tOk = t.startsWith('idea-') ? ideaIdSet.has(t.replace('idea-', '')) : true;
        return sOk && tOk;
      });

      const combined = [...initEdges, ...validUserEdges];
      return applyBranchVisibility(initNodes, combined).edges;
    });
  }, [initNodes, initEdges, setNodes, setEdges, applyBranchVisibility, ideaIdSet]);

  // Fetch persisted user edges and merge them into the edge state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = (await Api.getMyIdeaEdges('all')) as any;
        const rows = Array.isArray(res?.edges) ? res.edges : [];

        const persistedEdges: Edge[] = rows
          .map((r: any) => {
            const persistedId = String(r?.id || '').trim();
            const sourceIdeaId = String(r?.sourceIdeaId || '').trim();
            const targetIdeaId = String(r?.targetIdeaId || '').trim();
            if (!persistedId || !sourceIdeaId || !targetIdeaId) return null;
            if (!ideaIdSet.has(sourceIdeaId) || !ideaIdSet.has(targetIdeaId)) return null;

            return {
              id: `edge-${persistedId}`,
              source: `idea-${sourceIdeaId}`,
              target: `idea-${targetIdeaId}`,
              type: 'smoothstep',
              style: { stroke: '#8b5cf6', strokeWidth: 2, opacity: 0.75 },
              animated: true,
              data: {
                userCreated: true,
                persistedId,
                kind: String(r?.kind || 'relates_to'),
                flowState: 'forward',
                originalSourceIdeaId: sourceIdeaId,
                originalTargetIdeaId: targetIdeaId,
              },
            } as Edge;
          })
          .filter(Boolean);

        if (cancelled) return;

        setEdges((prev) => {
          const prevUser = (prev || []).filter((e: Edge) => Boolean(e.data?.userCreated));
          const prevTemp = prevUser.filter((e: Edge) => !e.data?.persistedId);
          const prevPersistedById = new Map<string, Edge>();
          for (const e of prevUser) {
            const pid = e.data?.persistedId ? String(e.data.persistedId) : '';
            if (pid) prevPersistedById.set(pid, e);
          }

          const mergedPersisted = persistedEdges.map((e) => {
            const pid = String(e.data?.persistedId || '');
            const existing = pid ? prevPersistedById.get(pid) : null;
            // Preserve user toggles like flowState/animated state
            return existing
              ? {
                  ...e,
                  animated: existing.animated,
                  style: existing.style,
                  data: { ...e.data, ...existing.data },
                }
              : e;
          });

          const combined = [...initEdges, ...mergedPersisted, ...prevTemp];
          return applyBranchVisibility(initNodes, combined).edges;
        });
      } catch {
        // best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ideasKey, ideaIdSet, initEdges, initNodes, applyBranchVisibility, setEdges]);

  useEffect(() => {
    // Re-apply visibility (do not reset user edges)
    const next = applyBranchVisibility(nodes as any, edges as any);
    setNodes(next.nodes);
    setEdges((prev) => applyBranchVisibility(next.nodes, prev as any).edges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranches]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (!node.id.startsWith('idea-')) return;
      const ideaId = node.id.replace('idea-', '');
      const idea = ideas.find((i) => i.id === ideaId);
      onIdeaClickRef.current(ideaId, idea);
    },
    [ideas]
  );

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      const bothIdeas =
        connection.source.startsWith('idea-') && connection.target.startsWith('idea-');
      const ideaToBranch =
        connection.source.startsWith('idea-') || connection.target.startsWith('idea-');
      if (!bothIdeas && !ideaToBranch) return;

      const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const newEdge: Edge = {
        id: tempId,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle || undefined,
        targetHandle: connection.targetHandle || undefined,
        type: 'smoothstep',
        style: { stroke: '#8b5cf6', strokeWidth: 2, opacity: 0.7 },
        animated: true,
        data: {
          userCreated: true,
          flowState: 'forward',
          // PersistedId is filled after backend confirms.
          persistedId: null,
          originalSourceIdeaId: connection.source.startsWith('idea-')
            ? connection.source.replace('idea-', '')
            : null,
          originalTargetIdeaId: connection.target.startsWith('idea-')
            ? connection.target.replace('idea-', '')
            : null,
        },
      };

      setEdges((prev: Edge[]) => addEdge(newEdge, prev));

      if (bothIdeas) {
        const sourceIdeaId = connection.source.replace('idea-', '');
        const targetIdeaId = connection.target.replace('idea-', '');
        try {
          const res = (await Api.addMyIdeaEdge(sourceIdeaId, { targetIdeaId, kind: 'relates_to' })) as any;
          const persistedId = String(res?.edge?.id || '').trim();
          if (persistedId) {
            setEdges((prev) =>
              (prev || []).map((e: Edge) =>
                e.id === tempId
                  ? {
                      ...e,
                      id: `edge-${persistedId}`,
                      data: {
                        ...e.data,
                        persistedId,
                        originalSourceIdeaId: sourceIdeaId,
                        originalTargetIdeaId: targetIdeaId,
                      },
                    }
                  : e
              )
            );
            trackFunnelEvent('idea_edge_created', { sourceIdeaId, targetIdeaId, kind: 'relates_to' });
          }
          toast.success(isPolish ? 'Pomysły połączone!' : 'Ideas connected!', {
            duration: 1500,
            icon: '🔗',
          });
        } catch {
          // rollback optimistic edge
          setEdges((prev) => (prev || []).filter((e: Edge) => e.id !== tempId));
          toast.error(isPolish ? 'Nie udało się zapisać połączenia' : 'Failed to save connection');
        }
      } else {
        toast.success(isPolish ? 'Połączenie dodane' : 'Connection added', { duration: 1000 });
      }
    },
    [setEdges, isPolish]
  );

  const onNodeDragStop = useCallback(
    (_: any, node: Node) => {
      if (!node.id.startsWith('idea-')) return;

      const branchNodes = nodes.filter((n: Node) => n.id.startsWith('branch-'));
      let nearestBranch: Node | null = null;
      let nearestDist = Infinity;

      for (const bn of branchNodes) {
        const dx = node.position.x + 90 - (bn.position.x + 50);
        const dy = node.position.y + 15 - (bn.position.y + 20);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestBranch = bn;
        }
      }

      if (nearestBranch && nearestDist < 250) {
        const newBranch = nearestBranch.data.branchKey;
        const ideaId = node.id.replace('idea-', '');
        const colors = BRANCH_COLORS[newBranch] || BRANCH_COLORS.uncategorized;

        setNodes((prev: Node[]) =>
          prev.map((n: Node) =>
            n.id === node.id ? { ...n, data: { ...n.data, branchKey: newBranch } } : n
          )
        );

        setEdges((prev: Edge[]) => {
          const filtered = prev.filter(
            (e: Edge) => !(e.target === node.id && !e.data?.userCreated)
          );
          return [
            ...filtered,
            {
              id: `${nearestBranch!.id}-${node.id}`,
              source: nearestBranch!.id,
              target: node.id,
              targetHandle: 'target-left',
              type: 'smoothstep',
              style: { stroke: colors.edge, strokeWidth: 1.5, opacity: 0.4 },
            },
          ];
        });

        Api.updateMyIdea(ideaId, { branch: newBranch }).catch(() => {
          toast.error(isPolish ? 'Nie udało się zapisać' : 'Failed to save');
        });
      }
    },
    [nodes, setNodes, setEdges, isPolish]
  );

  // Edge click cycles: animated→static→reversed→remove (user edges) or animated→static→reversed (system edges)
  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      const isUser = !!edge.data?.userCreated;
      const currentState = edge.data?.flowState || 'forward'; // forward | stopped | reversed

      if (currentState === 'reversed' && isUser) {
        // Remove user edge (and delete persisted edge if needed)
        setEdges((prev: Edge[]) => prev.filter((e: Edge) => e.id !== edge.id));

        const persistedId = edge.data?.persistedId ? String(edge.data.persistedId) : '';
        const originalSourceIdeaId = edge.data?.originalSourceIdeaId
          ? String(edge.data.originalSourceIdeaId)
          : '';

        if (persistedId && originalSourceIdeaId) {
          Api.deleteMyIdeaEdge(originalSourceIdeaId, persistedId)
            .then(() => {
              trackFunnelEvent('idea_edge_deleted', {
                persistedId,
                sourceIdeaId: originalSourceIdeaId,
              });
            })
            .catch(() => {
              toast.error(isPolish ? 'Nie udało się usunąć połączenia' : 'Failed to delete connection');
              // best-effort restore
              setEdges((prev: Edge[]) => [edge, ...prev]);
            });
        }

        toast.success(isPolish ? 'Połączenie usunięte' : 'Connection removed', {
          duration: 1200,
          icon: '🗑',
        });
        return;
      }

      setEdges((prev: Edge[]) =>
        prev
          .map((e: Edge) => {
            if (e.id !== edge.id) return e;

            if (currentState === 'forward') {
              // Stop the animation
              return {
                ...e,
                animated: false,
                style: { ...e.style, opacity: 0.8, strokeDasharray: '5 5' },
                data: { ...e.data, flowState: 'stopped' },
              };
            }
            if (currentState === 'stopped') {
              // Reverse: swap source↔target and animate again
              return {
                ...e,
                source: e.target,
                target: e.source,
                sourceHandle: e.targetHandle,
                targetHandle: e.sourceHandle,
                animated: true,
                style: { ...e.style, opacity: 0.7, strokeDasharray: undefined },
                data: { ...e.data, flowState: 'reversed' },
              };
            }
            if (currentState === 'reversed') {
              // System edges go back to forward
              return {
                ...e,
                source: e.target,
                target: e.source,
                sourceHandle: e.targetHandle,
                targetHandle: e.sourceHandle,
                animated: true,
                style: { ...e.style, opacity: 0.6, strokeDasharray: undefined },
                data: { ...e.data, flowState: 'forward' },
              };
            }
            return e;
          })
          .filter(Boolean)
      );

      const labels = {
        forward: { en: 'Flow stopped', pl: 'Przepływ zatrzymany' },
        stopped: { en: 'Flow reversed', pl: 'Przepływ odwrócony' },
        reversed: { en: 'Flow restored', pl: 'Przepływ przywrócony' },
      };
      const msg = labels[currentState as keyof typeof labels];
      toast.success(isPolish ? msg.pl : msg.en, {
        duration: 1200,
        icon: currentState === 'forward' ? '⏸' : '🔄',
      });
    },
    [setEdges, isPolish]
  );

  if (ideas.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full p-8">
        <GitBranch size={48} className="text-emerald-400 mb-4" />
        <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
          {isPolish ? 'Twoja mapa myśli jest pusta' : 'Your mind map is empty'}
        </h3>
        <p className="text-sm text-slate-500 mb-4 max-w-md text-center">
          {isPolish
            ? 'Zasiej pomysły, aby zobaczyć je w formie mapy myśli.'
            : 'Plant some ideas to see them as a mind map.'}
        </p>
        <button
          onClick={onCreateIdea}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl shadow-lg shadow-amber-500/25"
        >
          <Plus size={16} />
          {isPolish ? 'Zasiej pomysł' : 'Plant an idea'}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.1}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
        className="bg-slate-50 dark:bg-navy-950"
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: '#8b5cf6', strokeWidth: 2, opacity: 0.7 },
          animated: true,
        }}
      >
        <Background color="#e2e8f0" gap={20} size={1} />

        {/* ── Zoom & help controls (top-right) ── */}
        <Panel position="top-right">
          <div className="flex items-center gap-1 px-2 py-1.5 bg-white/90 dark:bg-navy-900/90 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-navy-700 shadow-lg">
            <button
              onClick={() => zoomIn({ duration: 300 })}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
              title={isPolish ? 'Przybliż' : 'Zoom in'}
            >
              <Plus size={16} />
            </button>
            <button
              onClick={() => zoomOut({ duration: 300 })}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
              title={isPolish ? 'Oddal' : 'Zoom out'}
            >
              <Minus size={16} />
            </button>
            <div className="w-px h-5 bg-slate-200 dark:bg-navy-600 mx-0.5" />
            <button
              onClick={() => fitView({ padding: 0.3, duration: 400 })}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
              title={isPolish ? 'Dopasuj widok' : 'Fit view'}
            >
              <RotateCcw size={14} />
            </button>
            <div className="w-px h-5 bg-slate-200 dark:bg-navy-600 mx-0.5" />
            <button
              onClick={() => setShowHelp((v) => !v)}
              className={`p-1.5 rounded-lg transition-colors ${
                showHelp
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 ring-1 ring-purple-400'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
              }`}
              title={isPolish ? 'Pomoc' : 'Help'}
            >
              <Link2 size={14} />
            </button>
          </div>
        </Panel>

        {/* ── Interaction hints ── */}
        {showHelp && (
          <Panel position="top-center">
            <div className="px-4 py-3 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm border border-slate-200 dark:border-navy-700 rounded-xl shadow-lg text-[11px] text-slate-600 dark:text-slate-300 space-y-1.5 max-w-[320px]">
              <div className="font-bold text-slate-800 dark:text-white text-xs mb-1">
                {isPolish ? 'Jak korzystać z mapy' : 'How to use the map'}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
                {isPolish
                  ? 'Przeciągnij z żółtego uchwytu → do zielonego = nowe połączenie'
                  : 'Drag from amber handle → to green = new connection'}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 flex-shrink-0" />
                {isPolish
                  ? 'Kliknij linię: zatrzymaj → odwróć → usuń'
                  : 'Click edge: stop → reverse → remove'}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0" />
                {isPolish
                  ? 'Przeciągnij pomysł na inną gałąź = zmień kategorię'
                  : 'Drag idea to another branch = change category'}
              </div>
            </div>
          </Panel>
        )}

        {/* ── Branch filter (top-left) ── */}
        <Panel position="top-left">
          <div className="flex flex-col gap-1.5 px-3 py-2 bg-white/90 dark:bg-navy-900/90 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-navy-700 shadow-lg max-w-[220px]">
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">
              {isPolish ? 'Obszary pomysłów' : 'Idea Areas'}
            </div>
            {activeBranches.size < Object.keys(BRANCH_LABELS).length && (
              <button
                onClick={showAll}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border border-slate-300 dark:border-navy-600 bg-slate-50 dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors w-full justify-center"
              >
                {isPolish ? 'Pokaż wszystkie' : 'Show all'}
              </button>
            )}
            {Object.entries(BRANCH_LABELS).map(([key, labels]) => {
              const colors = BRANCH_COLORS[key];
              const isActive = activeBranches.has(key);
              const count = ideas.filter((i) => getBranchForIdea(i) === key).length;
              return (
                <button
                  key={key}
                  onClick={() => toggleBranch(key)}
                  className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all cursor-pointer w-full ${
                    isActive
                      ? `${colors.border} ${colors.bg} ${colors.text} shadow-sm`
                      : 'border-slate-200 dark:border-navy-600 bg-slate-50/50 dark:bg-navy-800/30 text-slate-400 dark:text-slate-500 opacity-60'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isActive ? colors.edge : '#94a3b8' }}
                  />
                  <span className="flex-1 text-left">{isPolish ? labels.pl : labels.en}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full ${count > 0 ? 'bg-white/60 dark:bg-navy-800/60' : 'opacity-30'}`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export const IdeasMindMap: React.FC<IdeasMindMapProps> = (props) => (
  <ReactFlowProvider>
    <MindMapInner {...props} />
  </ReactFlowProvider>
);

export default IdeasMindMap;
