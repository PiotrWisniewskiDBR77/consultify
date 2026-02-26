import 'reactflow/dist/style.css';

import {
  Bot,
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

type PersistenceStatus = 'online' | 'no_route' | 'missing_table' | 'offline';

type AIMapProposal = {
  add: { nodes: Node[]; edges: Edge[] };
  remove: { nodeIds: string[]; edgeIds: string[] };
  reorder?: { note?: string; order?: string[] } | null;
  rationale?: string | null;
};

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
  problem: {
    bg: 'bg-rose-100 dark:bg-rose-900/25',
    border: 'border-rose-400/70',
    text: 'text-rose-700 dark:text-rose-300',
    ring: 'ring-rose-400',
    edge: '#fb7185',
  },
  goal: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/25',
    border: 'border-emerald-400/70',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-400',
    edge: '#34d399',
  },
  options: {
    bg: 'bg-amber-100 dark:bg-amber-900/25',
    border: 'border-amber-400/70',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-400',
    edge: '#fbbf24',
  },
  evidence: {
    bg: 'bg-sky-100 dark:bg-sky-900/25',
    border: 'border-sky-400/70',
    text: 'text-sky-700 dark:text-sky-300',
    ring: 'ring-sky-400',
    edge: '#38bdf8',
  },
  risks: {
    bg: 'bg-purple-100 dark:bg-purple-900/25',
    border: 'border-purple-400/70',
    text: 'text-purple-700 dark:text-purple-300',
    ring: 'ring-purple-400',
    edge: '#a78bfa',
  },
  experiments: {
    bg: 'bg-cyan-100 dark:bg-cyan-900/25',
    border: 'border-cyan-400/70',
    text: 'text-cyan-700 dark:text-cyan-300',
    ring: 'ring-cyan-400',
    edge: '#22d3ee',
  },
  plan: {
    bg: 'bg-blue-100 dark:bg-blue-900/25',
    border: 'border-blue-400/70',
    text: 'text-blue-700 dark:text-blue-300',
    ring: 'ring-blue-400',
    edge: '#60a5fa',
  },
  uncategorized: {
    bg: 'bg-slate-100 dark:bg-slate-800/40',
    border: 'border-slate-300/70',
    text: 'text-slate-600 dark:text-slate-400',
    ring: 'ring-slate-400',
    edge: '#94a3b8',
  },
};

// ─────── Node Types (keep the living feel) ───────
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
  const colors = BRANCH_COLORS[data.branchKey] || BRANCH_COLORS.uncategorized;
  return (
    <div
      className={`px-4 py-2.5 rounded-2xl border-2 ${colors.border} ${colors.bg} ${
        selected ? `ring-2 ${colors.ring}` : ''
      } shadow-md min-w-[120px] text-center`}
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
      <div
        className={`text-xs font-semibold ${colors.text} flex items-center gap-1 justify-center`}
      >
        <GitBranch size={12} />
        {data.label}
      </div>
      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
        {data.count || 0} {data.count === 1 ? 'node' : 'nodes'}
      </div>
    </div>
  );
});
BranchNodeComponent.displayName = 'RecommendationBranchNode';

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
      className={`group px-3 py-2 rounded-xl border-2 ${colors.border} bg-white dark:bg-navy-900 ${
        selected ? `ring-2 ${colors.ring}` : ''
      } shadow-sm hover:shadow-lg cursor-pointer max-w-[210px]`}
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
          {data.nodeType && (
            <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 uppercase tracking-wide">
              {String(data.nodeType).replace(/_/g, ' ')}
            </div>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-1">
        <div className="w-8 h-0.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
          <div
            className={`h-full rounded-full ${priorityColor}`}
            style={{ width: `${Math.max(10, p)}%` }}
          />
        </div>
      </div>
    </div>
  );
});
IdeaNodeComponent.displayName = 'RecommendationIdeaNode';

const nodeTypes = {
  center: CenterNodeComponent,
  branch: BranchNodeComponent,
  idea: IdeaNodeComponent,
};

type IdeaRecommendationMapProps = {
  ideaId: string;
  ideaTitle: string;
  onClose: () => void;
  onCenterEdit?: () => void;
  /** Default: 'overlay' (full-screen). Use 'embedded' inside a workspace split. */
  variant?: 'overlay' | 'embedded';
  /** Whether to show the close button in the top bar (default true). */
  showClose?: boolean;
  /** Extra classes applied to the container in embedded mode. */
  className?: string;
  /** When locked, map is read-only (challenge not accepted yet). */
  locked?: boolean;
};

function MindMapInner({
  ideaId,
  ideaTitle,
  onClose,
  onCenterEdit,
  variant = 'overlay',
  showClose = true,
  className,
  locked = false,
}: IdeaRecommendationMapProps) {
  const { i18n } = useTranslation();
  const isPolish = useMemo(() => i18n.language?.startsWith('pl'), [i18n.language]);
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [persistence, setPersistence] = useState<PersistenceStatus>('online');

  // Some environments type `reactflow` as `any` — avoid generic calls and cast the initial state.
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);

  const saveTimerRef = useRef<number | null>(null);
  const isHydratingRef = useRef(true);

  const hydrate = useCallback(async () => {
    setLoading(true);
    try {
      setPersistence('online');
      const res = await Api.getMyIdeaMap(ideaId, { language: i18n.language });
      const map = res?.map || {};
      const nextNodes = Array.isArray(map.nodes) ? map.nodes : [];
      const nextEdges = Array.isArray(map.edges) ? map.edges : [];

      // Keep center label consistent with current title (map stores a snapshot)
      const patchedNodes = nextNodes.map((n: any) => {
        if (String(n?.id) !== 'root') return n;
        return {
          ...n,
          data: {
            ...(n.data || {}),
            label: ideaTitle || (isPolish ? 'Mój pomysł' : 'My idea'),
            hint: isPolish ? 'Kliknij, aby edytować' : 'Click to edit',
          },
        };
      });

      isHydratingRef.current = true;
      setNodes(patchedNodes);
      setEdges(nextEdges);
      setTimeout(() => {
        isHydratingRef.current = false;
        try {
          fitView({ padding: 0.3, duration: 300 });
        } catch {
          // ignore
        }
      }, 50);
    } catch (err: any) {
      const msg = String(err?.message || '');
      const isNoRoute =
        msg.toLowerCase().includes('route get') &&
        msg.toLowerCase().includes('/my-work/my-ideas') &&
        msg.toLowerCase().includes('/map');
      const isMissingTable =
        msg.toLowerCase().includes('database table missing') &&
        msg.toLowerCase().includes('my_idea_maps');

      if (isNoRoute) {
        setPersistence('no_route');
        toast(
          (isPolish
            ? 'Backend wymaga restartu (route mapy jeszcze nie działa).'
            : 'Backend needs restart (map route not active).') as any
        );
      } else if (isMissingTable) {
        setPersistence('missing_table');
        toast(
          (isPolish
            ? 'Brakuje tabeli mapy — uruchom migracje DB.'
            : 'Map table missing — run DB migrations.') as any
        );
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
        try {
          fitView({ padding: 0.3, duration: 250 });
        } catch {
          // ignore
        }
      }, 30);
    } finally {
      setLoading(false);
    }
  }, [fitView, i18n.language, ideaId, ideaTitle, isPolish, setEdges, setNodes]);

  useEffect(() => {
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideaId]);

  // Keep center label consistent with current title (map stores a snapshot)
  useEffect(() => {
    const label = ideaTitle || (isPolish ? 'Mój pomysł' : 'My idea');
    setNodes((prev: Node[]) =>
      (prev || []).map((n: any) => {
        if (String(n?.id) !== 'root') return n;
        return {
          ...n,
          data: {
            ...(n.data || {}),
            label,
            hint: isPolish ? 'Kliknij, aby edytować' : 'Click to edit',
          },
        };
      })
    );
  }, [ideaTitle, isPolish, setNodes]);

  const scheduleSave = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      if (isHydratingRef.current) return;
      if (persistence !== 'online') return;
      if (locked) return;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(async () => {
        setSaving(true);
        try {
          await Api.saveMyIdeaMap(ideaId, { nodes: nextNodes, edges: nextEdges });
          setLastSavedAt(Date.now());
        } catch (err: any) {
          toast.error(
            err?.message || (isPolish ? 'Nie udało się zapisać mapy' : 'Failed to save map')
          );
        } finally {
          setSaving(false);
        }
      }, 700);
    },
    [ideaId, isPolish, locked, persistence]
  );

  // Persist on changes (debounced)
  useEffect(() => {
    scheduleSave(nodes as any, edges as any);
  }, [nodes, edges, scheduleSave]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (locked) return;
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      const id = `edge-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const newEdge: Edge = {
        id,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle || undefined,
        targetHandle: connection.targetHandle || undefined,
        type: 'smoothstep',
        style: { stroke: '#8b5cf6', strokeWidth: 2, opacity: 0.7 },
        animated: true,
        data: { userCreated: true, flowState: 'forward' },
      };
      setEdges((prev: Edge[]) => addEdge(newEdge, prev));
    },
    [locked, setEdges]
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      if (locked) return;
      const isUser = !!edge.data?.userCreated;
      const currentState = edge.data?.flowState || 'forward'; // forward | stopped | reversed

      if (currentState === 'reversed' && isUser) {
        setEdges((prev: Edge[]) => (prev || []).filter((e: Edge) => e.id !== edge.id));
        toast.success(isPolish ? 'Połączenie usunięte' : 'Connection removed', { duration: 1200 });
        return;
      }

      setEdges((prev: Edge[]) =>
        (prev || [])
          .map((e: Edge) => {
            if (e.id !== edge.id) return e;
            if (currentState === 'forward') {
              return {
                ...e,
                animated: false,
                style: { ...e.style, opacity: 0.8, strokeDasharray: '5 5' },
                data: { ...e.data, flowState: 'stopped' },
              };
            }
            if (currentState === 'stopped') {
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
    },
    [isPolish, locked, setEdges]
  );

  const selectedBranchKey = useMemo(() => {
    const selected = nodes.find((n: any) => n?.selected);
    if (!selected) return 'options';
    if (selected.type === 'branch') return String((selected as any).data?.branchKey || 'options');
    if (selected.type === 'idea') return String((selected as any).data?.branchKey || 'options');
    return 'options';
  }, [nodes]);

  // AI suggestions modal state (propose → accept/reject)
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
    const list = aiProposal.add?.nodes || [];
    return list.reduce((sum, _n, idx) => sum + (selectedAddIdx[idx] ? 1 : 0), 0);
  }, [aiProposal, selectedAddIdx]);

  const applyAIProposal = useCallback(async () => {
    if (!aiProposal) return;
    if (locked) {
      toast((isPolish ? 'Najpierw zaakceptuj wyzwanie.' : 'Accept the challenge first.') as any);
      return;
    }
    const toAddNodes = (aiProposal.add?.nodes || []).filter((_n, idx) => selectedAddIdx[idx]);
    const toAddEdges = aiProposal.add?.edges || [];
    const hasOrder = !!aiProposal.reorder?.order?.length;

    if (toAddNodes.length === 0 && !(applySuggestedOrder && hasOrder)) {
      toast((isPolish ? 'Brak wybranych zmian' : 'No selected changes') as any);
      return;
    }

    setSaving(true);
    try {
      // Append selected nodes/edges (dedupe by id)
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

      // Persist immediately (modal apply should be explicit)
      if (persistence === 'online') {
        await Api.saveMyIdeaMap(ideaId, { nodes: nextNodes as any, edges: nextEdges as any });
        setLastSavedAt(Date.now());
      }

      toast.success(
        isPolish
          ? `Zastosowano propozycje AI (${toAddNodes.length} dodano)`
          : `Applied AI proposals (${toAddNodes.length} added)`,
        { duration: 1200 }
      );
      closeAIModal();
    } catch (err: any) {
      toast.error(
        err?.message ||
          (isPolish ? 'Nie udało się zastosować propozycji' : 'Failed to apply proposals')
      );
    } finally {
      setSaving(false);
    }
  }, [
    aiProposal,
    applySuggestedOrder,
    closeAIModal,
    edges,
    ideaId,
    isPolish,
    locked,
    nodes,
    persistence,
    selectedAddIdx,
    setEdges,
    setNodes,
  ]);

  const handleAIExpand = useCallback(async () => {
    if (locked) {
      toast((isPolish ? 'Najpierw zaakceptuj wyzwanie.' : 'Accept the challenge first.') as any);
      return;
    }
    if (persistence !== 'online') {
      toast(
        (isPolish
          ? 'AI wymaga działającego backendu (restart/migracje).'
          : 'AI requires backend (restart/migrations).') as any
      );
      return;
    }
    setSaving(true);
    try {
      const anchor =
        nodes.find((n: any) => n?.selected) || nodes.find((n: any) => String(n?.id) === 'root');
      const res = await Api.expandMyIdeaMap(ideaId, {
        anchorNodeId: String(anchor?.id || 'root'),
        branchKey: selectedBranchKey,
        count: 5,
        language: i18n.language,
        proposeOnly: true,
      });
      const proposedNodes = (() => {
        // New shape: proposal.add.nodes
        if (Array.isArray(res?.proposal?.add?.nodes)) return res.proposal.add.nodes;
        // Back-compat: proposal.add is nodes[]
        if (Array.isArray(res?.proposal?.add)) return res.proposal.add;
        return [];
      })();
      const proposedEdges = (() => {
        if (Array.isArray(res?.proposal?.add?.edges)) return res.proposal.add.edges;
        // Back-compat: proposal.edges (older draft)
        if (Array.isArray(res?.proposal?.edges)) return res.proposal.edges;
        return [];
      })();
      if (!proposedNodes.length) {
        toast((isPolish ? 'Brak nowych propozycji' : 'No new suggestions') as any);
        return;
      }

      setAiProposal({
        add: { nodes: proposedNodes, edges: proposedEdges },
        remove: { nodeIds: [], edgeIds: [] },
        reorder: null,
        rationale: null,
      });
      setSelectedAddIdx(
        Object.fromEntries(proposedNodes.map((_: any, idx: number) => [idx, true])) as Record<
          number,
          boolean
        >
      );
      setApplySuggestedOrder(false);
      setShowAIModal(true);
    } catch (err: any) {
      toast.error(err?.message || (isPolish ? 'AI nie zadziałało' : 'AI failed'));
    } finally {
      setSaving(false);
    }
  }, [
    i18n.language,
    ideaId,
    isPolish,
    locked,
    nodes,
    persistence,
    selectedBranchKey,
    setEdges,
    setNodes,
  ]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === 'center') {
        onCenterEdit?.();
      }
    },
    [onCenterEdit]
  );

  const savedLabel = useMemo(() => {
    if (persistence !== 'online') {
      return isPolish ? 'Tryb lokalny (bez zapisu)' : 'Local mode (not saved)';
    }
    if (saving) return isPolish ? 'Zapisuję...' : 'Saving...';
    if (!lastSavedAt) return isPolish ? 'Nie zapisano' : 'Not saved yet';
    const sec = Math.max(1, Math.round((Date.now() - lastSavedAt) / 1000));
    return isPolish ? `Zapisano ${sec}s temu` : `Saved ${sec}s ago`;
  }, [isPolish, lastSavedAt, persistence, saving]);

  const containerClassName =
    variant === 'overlay'
      ? 'fixed inset-0 z-[80] bg-slate-50 dark:bg-navy-950'
      : `relative w-full h-full bg-slate-50 dark:bg-navy-950 ${className || ''}`;

  return (
    <div className={containerClassName}>
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
                  {isPolish
                    ? 'Zaznacz elementy do dodania, a następnie kliknij „Zastosuj”.'
                    : 'Select items to add, then click “Apply”.'}
                </p>
              </div>
              <button
                onClick={closeAIModal}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                title={isPolish ? 'Zamknij' : 'Close'}
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 max-h-[65vh] overflow-y-auto space-y-5">
              {/* To remove (not used yet) */}
              <div className="rounded-xl bg-slate-50/50 dark:bg-navy-950/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {isPolish ? 'Do wywalenia' : 'To remove'} (0)
                  </span>
                </div>
                <EmptyStateInline
                  icon={GitBranch}
                  dashed={false}
                  className="p-5"
                  message={isPolish ? 'Brak sugestii usunięć.' : 'No removal suggestions.'}
                />
              </div>

              {/* To add */}
              <div className="rounded-xl bg-slate-50/50 dark:bg-navy-950/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {isPolish ? 'Do dodania' : 'To add'} ({aiProposal.add.nodes.length})
                  </span>
                  {aiProposal.add.nodes.length > 0 && (
                    <button
                      onClick={() =>
                        setSelectedAddIdx(
                          Object.fromEntries(
                            aiProposal.add.nodes.map((_, idx) => [idx, true])
                          ) as Record<number, boolean>
                        )
                      }
                      className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      {isPolish ? 'Zaznacz wszystko' : 'Select all'}
                    </button>
                  )}
                </div>
                {aiProposal.add.nodes.length === 0 ? (
                  <EmptyStateInline
                    icon={Plus}
                    dashed={false}
                    className="p-5"
                    message={isPolish ? 'Brak propozycji do dodania.' : 'No additions proposed.'}
                  />
                ) : (
                  <div className="space-y-1.5">
                    {aiProposal.add.nodes.map((n, idx) => (
                      <label
                        key={String((n as any)?.id || idx)}
                        className="flex items-start gap-2 p-2 rounded-xl bg-white/60 dark:bg-navy-900/30 hover:bg-white/80 dark:hover:bg-navy-900/40 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={!!selectedAddIdx[idx]}
                          onChange={(e) =>
                            setSelectedAddIdx((prev) => ({ ...prev, [idx]: e.target.checked }))
                          }
                          className="mt-1"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-800 dark:text-white">
                            {String((n as any)?.data?.label || (n as any)?.id || 'Node')}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {isPolish ? 'Gałąź' : 'Branch'}:{' '}
                            {String((n as any)?.data?.branchKey || selectedBranchKey)}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Suggested order (not used yet) */}
              <div className="rounded-xl bg-slate-50/50 dark:bg-navy-950/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {isPolish ? 'Proponowana kolejność' : 'Suggested order'} (0)
                  </span>
                  <label className="inline-flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 select-none">
                    <input
                      type="checkbox"
                      checked={applySuggestedOrder}
                      onChange={(e) => setApplySuggestedOrder(e.target.checked)}
                      disabled
                    />
                    {isPolish ? 'Zastosuj kolejność' : 'Apply order'}
                  </label>
                </div>
                <EmptyStateInline
                  icon={Sparkles}
                  dashed={false}
                  className="p-5"
                  message={isPolish ? 'Brak sugestii kolejności.' : 'No ordering suggestion.'}
                />
              </div>

              {/* Plan */}
              <Callout
                variant="purple"
                title={isPolish ? 'Plan' : 'Plan'}
                compact
                className="rounded-xl"
              >
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    {isPolish
                      ? `Dodaj zaznaczone węzły: ${selectedAddCount}.`
                      : `Add selected nodes: ${selectedAddCount}.`}
                  </li>
                </ul>
              </Callout>
            </div>

            <div className="px-5 py-4 border-t border-slate-200/60 dark:border-navy-700/60 flex items-center justify-end gap-2">
              <button
                onClick={closeAIModal}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
              >
                {isPolish ? 'Anuluj' : 'Cancel'}
              </button>
              <button
                onClick={() => void applyAIProposal()}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-400/50 text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 transition-colors"
              >
                {isPolish ? 'Zastosuj' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar (floating) */}
      <div className="absolute top-3 left-3 right-3 z-[90] flex items-center justify-between">
        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/85 dark:bg-navy-900/80 backdrop-blur-sm border border-slate-200/60 dark:border-white/[0.06] shadow-2xl">
          {showClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
              title={isPolish ? 'Zamknij mapę' : 'Close map'}
            >
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
          <button
            onClick={() => zoomIn({ duration: 250 })}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            title={isPolish ? 'Przybliż' : 'Zoom in'}
          >
            <Plus size={16} />
          </button>
          <button
            onClick={() => zoomOut({ duration: 250 })}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            title={isPolish ? 'Oddal' : 'Zoom out'}
          >
            <Minus size={16} />
          </button>
          <div className="w-px h-5 bg-slate-200 dark:bg-white/[0.06] mx-0.5" />
          <button
            onClick={() => fitView({ padding: 0.3, duration: 300 })}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            title={isPolish ? 'Dopasuj widok' : 'Fit view'}
          >
            <RotateCcw size={14} />
          </button>
          <div className="w-px h-5 bg-slate-200 dark:bg-white/[0.06] mx-0.5" />
          <button
            onClick={handleAIExpand}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/15 transition-colors"
            title={isPolish ? 'AI: rozbuduj wybraną gałąź' : 'AI: expand selected branch'}
            disabled={locked || saving || persistence !== 'online'}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            AI
          </button>
          <div className="w-px h-5 bg-slate-200 dark:bg-white/[0.06] mx-0.5" />
          <div className="text-[10px] text-slate-500 dark:text-slate-400 px-1">
            {isPolish ? 'Kliknij linię: stop→reverse→usuń' : 'Click edge: stop→reverse→remove'}
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
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          nodesConnectable={!locked}
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
          <Background color="#1e293b" gap={22} size={1} />

          {/* Branch key hint */}
          <Panel position="bottom-left">
            <div className="px-3 py-2 rounded-2xl bg-white/80 dark:bg-navy-900/75 backdrop-blur-sm border border-slate-200/60 dark:border-white/[0.06] shadow-2xl text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <Link2 size={14} className="text-slate-400" />
              <span className="font-semibold">{isPolish ? 'Aktywna gałąź' : 'Active branch'}:</span>
              <span className="text-slate-500 dark:text-slate-400">{selectedBranchKey}</span>
              <span className="text-slate-400">·</span>
              <span>
                {locked
                  ? isPolish
                    ? 'Zaakceptuj wyzwanie, aby odblokować edycję'
                    : 'Accept the challenge to unlock editing'
                  : isPolish
                    ? 'AI dopina propozycje do tej gałęzi'
                    : 'AI adds to this branch'}
              </span>
            </div>
          </Panel>
        </ReactFlow>
      )}
    </div>
  );
}

export const IdeaRecommendationMap: React.FC<IdeaRecommendationMapProps> = (props) => (
  <ReactFlowProvider>
    <MindMapInner {...props} />
  </ReactFlowProvider>
);

export default IdeaRecommendationMap;
