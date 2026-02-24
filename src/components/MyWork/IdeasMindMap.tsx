/**
 * IdeasMindMap — Interactive mind map of ideas using React Flow.
 *
 * Groups ideas by branch/area/tags into a visual tree.
 * Supports drag-and-drop between branches (changes idea.branch).
 * Allows connecting ideas to each other (tree-like relationships).
 * Only shows titles — lightweight and fast.
 */

import {
  Bot,
  Flower2,
  GitBranch,
  Link2,
  Lightbulb,
  Minus,
  Plus,
  RotateCcw,
} from 'lucide-react';
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
  useEdgesState,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Api } from '@/services/api';

import type { MyIdea } from './MyIdeasListContent';

const BRANCH_COLORS: Record<string, { bg: string; border: string; text: string; ring: string; edge: string }> = {
  strategy:      { bg: 'bg-blue-100 dark:bg-blue-900/30',    border: 'border-blue-400',    text: 'text-blue-700 dark:text-blue-300',    ring: 'ring-blue-400',    edge: '#60a5fa' },
  product:       { bg: 'bg-emerald-100 dark:bg-emerald-900/30', border: 'border-emerald-400', text: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-400', edge: '#34d399' },
  process:       { bg: 'bg-purple-100 dark:bg-purple-900/30',  border: 'border-purple-400',  text: 'text-purple-700 dark:text-purple-300',  ring: 'ring-purple-400',  edge: '#a78bfa' },
  culture:       { bg: 'bg-rose-100 dark:bg-rose-900/30',    border: 'border-rose-400',    text: 'text-rose-700 dark:text-rose-300',    ring: 'ring-rose-400',    edge: '#fb7185' },
  tech:          { bg: 'bg-cyan-100 dark:bg-cyan-900/30',    border: 'border-cyan-400',    text: 'text-cyan-700 dark:text-cyan-300',    ring: 'ring-cyan-400',    edge: '#22d3ee' },
  growth:        { bg: 'bg-amber-100 dark:bg-amber-900/30',   border: 'border-amber-400',   text: 'text-amber-700 dark:text-amber-300',   ring: 'ring-amber-400',   edge: '#fbbf24' },
  uncategorized: { bg: 'bg-slate-100 dark:bg-slate-800/50',   border: 'border-slate-300',   text: 'text-slate-600 dark:text-slate-400',   ring: 'ring-slate-400',   edge: '#94a3b8' },
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
    <div className={`px-4 py-2.5 rounded-2xl border-2 ${colors.border} ${colors.bg} ${selected ? `ring-2 ${colors.ring}` : ''} shadow-md min-w-[100px] text-center`}>
      <Handle type="target" position={Position.Left} className="!opacity-0 !w-1 !h-1" />
      <Handle type="source" position={Position.Right} id="right" className="!opacity-0 !w-1 !h-1" />
      <Handle type="source" position={Position.Top} id="top" className="!opacity-0 !w-1 !h-1" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!opacity-0 !w-1 !h-1" />
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

// ─────── Custom Node: Idea (with connectable handles on all 4 sides) ───────
const IdeaNodeComponent: React.FC<NodeProps> = React.memo(({ data, selected }) => {
  const colors = BRANCH_COLORS[data.branchKey] || BRANCH_COLORS.uncategorized;
  const isAI = data.sourceType === 'ai_chat' || data.sourceType === 'ai_hint' || data.sourceType === 'ai_suggestion';
  const p = data.priority ?? 50;
  const priorityColor = p >= 75 ? 'bg-emerald-400' : p >= 50 ? 'bg-amber-400' : 'bg-slate-400';

  return (
    <div className={`group px-3 py-2 rounded-xl border-2 ${colors.border} bg-white dark:bg-navy-900 ${selected ? `ring-2 ${colors.ring}` : ''} shadow-sm hover:shadow-lg cursor-pointer max-w-[180px]`}>
      {/* Target handles (for incoming connections) */}
      <Handle type="target" position={Position.Left} id="target-left" className="!w-2 !h-2 !bg-slate-300 dark:!bg-slate-600 !border-slate-400 group-hover:!bg-emerald-400 group-hover:!border-emerald-500 !opacity-0 group-hover:!opacity-100 transition-opacity" />
      <Handle type="target" position={Position.Top} id="target-top" className="!w-2 !h-2 !bg-slate-300 dark:!bg-slate-600 !border-slate-400 group-hover:!bg-emerald-400 group-hover:!border-emerald-500 !opacity-0 group-hover:!opacity-100 transition-opacity" />
      {/* Source handles (for outgoing connections) */}
      <Handle type="source" position={Position.Right} id="source-right" className="!w-2 !h-2 !bg-slate-300 dark:!bg-slate-600 !border-slate-400 group-hover:!bg-amber-400 group-hover:!border-amber-500 !opacity-0 group-hover:!opacity-100 transition-opacity" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="!w-2 !h-2 !bg-slate-300 dark:!bg-slate-600 !border-slate-400 group-hover:!bg-amber-400 group-hover:!border-amber-500 !opacity-0 group-hover:!opacity-100 transition-opacity" />
      <div className="flex items-start gap-1.5">
        <div className="flex-shrink-0 mt-0.5">
          {isAI ? <Bot size={10} className="text-purple-500" /> : <Lightbulb size={10} className="text-amber-500" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className={`text-[11px] font-semibold ${colors.text} line-clamp-2 leading-tight`}>
            {data.label}
          </div>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-1">
        <div className="w-8 h-0.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
          <div className={`h-full rounded-full ${priorityColor}`} style={{ width: `${Math.max(10, p)}%` }} />
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

  const sortedBranches = Object.entries(branches).sort((a, b) => b[1].length - a[1].length);

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
  const branchRadius = 260;

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
      style: { stroke: colors.edge, strokeWidth: 2.5, opacity: 0.6 },
      animated: true,
    });

    const ideaRadius = 150;
    const ideaAngleSpan = Math.min(Math.PI * 0.8, branchIdeas.length * 0.35);
    const sortedIdeas = [...branchIdeas].sort((a, b) => (b.priority ?? 50) - (a.priority ?? 50));

    sortedIdeas.forEach((idea, iIdx) => {
      const ideaAngle = angle + (iIdx - (sortedIdeas.length - 1) / 2) * (ideaAngleSpan / Math.max(sortedIdeas.length - 1, 1));
      const ix = bx + Math.cos(ideaAngle) * ideaRadius;
      const iy = by + Math.sin(ideaAngle) * ideaRadius;
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

      const targetHandle = iIdx % 2 === 0 ? 'right' : (iIdx % 3 === 0 ? 'top' : 'bottom');
      edges.push({
        id: `${branchId}-${ideaNodeId}`,
        source: branchId,
        target: ideaNodeId,
        sourceHandle: targetHandle,
        targetHandle: 'target-left',
        type: 'smoothstep',
        style: { stroke: colors.edge, strokeWidth: 1.5, opacity: 0.4 },
      });
    });
  });

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

  const [connectMode, setConnectMode] = useState(false);

  const allBranchKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const idea of ideas) keys.add(getBranchForIdea(idea));
    return keys;
  }, [ideas]);

  const [activeBranches, setActiveBranches] = useState<Set<string>>(() => new Set(Object.keys(BRANCH_LABELS)));

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

  useEffect(() => {
    const hiddenBranches = new Set<string>();
    for (const key of Object.keys(BRANCH_LABELS)) {
      if (!activeBranches.has(key)) hiddenBranches.add(key);
    }

    const hiddenNodeIds = new Set<string>();
    for (const n of initNodes) {
      if (n.type === 'branch' && hiddenBranches.has(n.data.branchKey)) hiddenNodeIds.add(n.id);
      if (n.type === 'idea' && hiddenBranches.has(n.data.branchKey)) hiddenNodeIds.add(n.id);
    }

    const filteredNodes = initNodes.map((n: Node) =>
      hiddenNodeIds.has(n.id) ? { ...n, hidden: true } : { ...n, hidden: false }
    );
    const filteredEdges = initEdges.map((e: Edge) =>
      hiddenNodeIds.has(e.source) || hiddenNodeIds.has(e.target) ? { ...e, hidden: true } : { ...e, hidden: false }
    );

    setNodes(filteredNodes);
    setEdges(filteredEdges);
  }, [initNodes, initEdges, setNodes, setEdges, activeBranches]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (connectMode) return;
    if (!node.id.startsWith('idea-')) return;
    const ideaId = node.id.replace('idea-', '');
    const idea = ideas.find((i) => i.id === ideaId);
    onIdeaClickRef.current(ideaId, idea);
  }, [ideas, connectMode]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      const bothIdeas = connection.source.startsWith('idea-') && connection.target.startsWith('idea-');
      const ideaToBranch = connection.source.startsWith('idea-') || connection.target.startsWith('idea-');
      if (!bothIdeas && !ideaToBranch) return;

      const newEdge: Edge = {
        id: `user-${connection.source}-${connection.target}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle || undefined,
        targetHandle: connection.targetHandle || undefined,
        type: 'smoothstep',
        style: { stroke: '#8b5cf6', strokeWidth: 2, opacity: 0.7 },
        animated: true,
        data: { userCreated: true },
      };

      setEdges((prev: Edge[]) => addEdge(newEdge, prev));
      toast.success(isPolish ? 'Pomysły połączone!' : 'Ideas connected!', { duration: 1500, icon: '🔗' });
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
        const dx = (node.position.x + 90) - (bn.position.x + 50);
        const dy = (node.position.y + 15) - (bn.position.y + 20);
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
          const filtered = prev.filter((e: Edge) => !(e.target === node.id && !e.data?.userCreated));
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

  const removeUserEdge = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      if (!edge.data?.userCreated) return;
      setEdges((prev: Edge[]) => prev.filter((e: Edge) => e.id !== edge.id));
      toast.success(isPolish ? 'Połączenie usunięte' : 'Connection removed', { duration: 1500 });
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
        onEdgeClick={removeUserEdge}
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

        {/* ── Zoom & connect controls (top-right) ── */}
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
              onClick={() => setConnectMode((v) => !v)}
              className={`p-1.5 rounded-lg transition-colors ${
                connectMode
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 ring-1 ring-purple-400'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
              }`}
              title={isPolish ? 'Tryb łączenia pomysłów' : 'Connect ideas mode'}
            >
              <Link2 size={14} />
            </button>
          </div>
        </Panel>

        {/* ── Connect mode hint ── */}
        {connectMode && (
          <Panel position="top-center">
            <div className="px-3 py-1.5 bg-purple-50 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700 rounded-xl shadow-lg text-xs text-purple-700 dark:text-purple-300 font-medium flex items-center gap-2">
              <Link2 size={12} />
              {isPolish
                ? 'Przeciągnij z uchwytu jednego pomysłu do drugiego aby je połączyć'
                : 'Drag from one idea handle to another to connect them'}
            </div>
          </Panel>
        )}

        {/* ── Branch filter (top-left) ── */}
        <Panel position="top-left">
          <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 bg-white/90 dark:bg-navy-900/90 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-navy-700 shadow-lg">
            {activeBranches.size < Object.keys(BRANCH_LABELS).length && (
              <button
                onClick={showAll}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold border border-slate-400 bg-slate-50 dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
              >
                {isPolish ? 'Wszystkie' : 'All'}
              </button>
            )}
            {Object.entries(BRANCH_LABELS).map(([key, labels]) => {
              if (!allBranchKeys.has(key)) return null;
              const colors = BRANCH_COLORS[key];
              const isActive = activeBranches.has(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleBranch(key)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium border transition-all cursor-pointer ${
                    isActive
                      ? `${colors.border} ${colors.bg} ${colors.text} shadow-sm`
                      : 'border-slate-200 dark:border-navy-600 bg-slate-50 dark:bg-navy-800/50 text-slate-400 dark:text-slate-500 opacity-50'
                  }`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full transition-opacity"
                    style={{ backgroundColor: isActive ? colors.edge : '#94a3b8' }}
                  />
                  {isPolish ? labels.pl : labels.en}
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
