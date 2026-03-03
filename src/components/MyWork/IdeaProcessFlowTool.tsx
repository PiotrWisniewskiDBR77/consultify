/**
 * IdeaProcessFlowTool — V3 Process Flow canvas for Idea Workspace.
 *
 * Swimlane-based process flow editor built on React Flow.
 * Shapes: start, end, action, decision.
 * Connectors: directed edges with optional labels (yes/no).
 * Validations: dangling nodes, missing start/end, decision without two exits.
 *
 * Data lives in the shared IdeaWorkspaceGraph (nodes/edges/extensions.processFlow).
 */
import {
  AlertTriangle,
  CircleDot,
  Diamond,
  Loader2,
  Plus,
  Save,
  Square,
  StopCircle,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  type Connection,
  Controls,
  type Edge,
  type EdgeChange,
  Handle,
  type Node,
  type NodeChange,
  type NodeProps,
  Position,
} from 'reactflow';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import type { CanvasToolType } from './IdeaCanvasToolSelector';

import 'reactflow/dist/style.css';

// ── Lane helpers ─────────────────────────────────────────────────────────────

type Lane = {
  id: string;
  label: string;
  color: string;
};

const LANE_COLORS = [
  '#e0e7ff', '#dbeafe', '#d1fae5', '#fef3c7', '#fce7f3', '#ede9fe',
  '#ccfbf1', '#fecaca', '#e2e8f0', '#c7d2fe',
];

const DEFAULT_LANES: Lane[] = [
  { id: 'lane-1', label: 'Lane 1', color: LANE_COLORS[0] },
];

// ── Shape types ──────────────────────────────────────────────────────────────

type FlowShape = 'start' | 'end' | 'action' | 'decision';

const SHAPE_CONFIG: Record<FlowShape, { icon: React.ComponentType<{ size?: number }>; label: string; labelPl: string }> = {
  start: { icon: CircleDot, label: 'Start', labelPl: 'Start' },
  end: { icon: StopCircle, label: 'End', labelPl: 'Koniec' },
  action: { icon: Square, label: 'Action', labelPl: 'Akcja' },
  decision: { icon: Diamond, label: 'Decision', labelPl: 'Decyzja' },
};

// ── Custom nodes ─────────────────────────────────────────────────────────────

const FlowNodeComponent: React.FC<NodeProps> = ({ data, selected }) => {
  const shape: FlowShape = data?.shape || 'action';
  const laneColor: string = data?.laneColor || '#e2e8f0';
  const [editing, setEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(String(data?.label || ''));
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitEdit = () => {
    setEditing(false);
    if (data?.onLabelChange && editValue !== data?.label) {
      data.onLabelChange(editValue);
    }
  };

  const shapeStyles: Record<FlowShape, string> = {
    start: 'rounded-full border-2 border-green-500 bg-green-50 dark:bg-green-900/30 dark:border-green-400',
    end: 'rounded-full border-2 border-red-500 bg-red-50 dark:bg-red-900/30 dark:border-red-400',
    action: 'rounded-xl border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800',
    decision: 'rotate-45 border-2 border-amber-500 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-400',
  };

  const innerRotate = shape === 'decision' ? '-rotate-45' : '';

  return (
    <div
      className={`relative flex items-center justify-center min-w-[80px] min-h-[48px] px-3 py-2 shadow-sm transition-shadow ${shapeStyles[shape]} ${selected ? 'ring-2 ring-primary-500/60' : ''}`}
      style={{ borderLeftColor: laneColor, borderLeftWidth: shape === 'action' ? 4 : undefined }}
      onDoubleClick={() => {
        if (!data?.locked) {
          setEditValue(String(data?.label || ''));
          setEditing(true);
        }
      }}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-slate-400" />
      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit();
            if (e.key === 'Escape') setEditing(false);
          }}
          className={`bg-transparent text-xs font-medium text-slate-800 dark:text-slate-200 text-center outline-none border-b border-primary-400 w-full ${innerRotate}`}
        />
      ) : (
        <div className={`text-xs font-medium text-slate-800 dark:text-slate-200 text-center ${innerRotate}`}>
          {data?.label || shape}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-slate-400" />
    </div>
  );
};

type RFNodeTypes = Record<string, React.ComponentType<NodeProps<any>>>;

const nodeTypes: RFNodeTypes = {
  flowNode: FlowNodeComponent,
};

// ── Validation ───────────────────────────────────────────────────────────────

type ValidationWarning = { id: string; message: string; messagePl: string };

function validateFlow(nodes: Node[], edges: Edge[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const flowNodes = nodes.filter((n: Node) => n.type === 'flowNode');

  const hasStart = flowNodes.some((n: Node) => n.data?.shape === 'start');
  const hasEnd = flowNodes.some((n: Node) => n.data?.shape === 'end');

  if (!hasStart) {
    warnings.push({ id: 'no-start', message: 'Missing Start node', messagePl: 'Brak węzła Start' });
  }
  if (!hasEnd) {
    warnings.push({ id: 'no-end', message: 'Missing End node', messagePl: 'Brak węzła Koniec' });
  }

  for (const node of flowNodes) {
    const outgoing = edges.filter((e: Edge) => e.source === node.id);
    const incoming = edges.filter((e: Edge) => e.target === node.id);

    if (node.data?.shape === 'decision' && outgoing.length < 2) {
      warnings.push({
        id: `decision-exits-${node.id}`,
        message: `Decision "${node.data?.label || node.id}" needs at least 2 exits`,
        messagePl: `Decyzja "${node.data?.label || node.id}" wymaga min. 2 wyjść`,
      });
    }

    if (node.data?.shape !== 'start' && incoming.length === 0) {
      warnings.push({
        id: `dangling-${node.id}`,
        message: `"${node.data?.label || node.id}" has no incoming connections`,
        messagePl: `"${node.data?.label || node.id}" nie ma połączeń wejściowych`,
      });
    }

    if (node.data?.shape !== 'end' && outgoing.length === 0) {
      warnings.push({
        id: `no-exit-${node.id}`,
        message: `"${node.data?.label || node.id}" has no outgoing connections`,
        messagePl: `"${node.data?.label || node.id}" nie ma połączeń wyjściowych`,
      });
    }
  }

  return warnings;
}

// ── Lane background with editable label ──────────────────────────────────────

const LaneBackground: React.FC<{
  lane: Lane;
  idx: number;
  locked: boolean;
  onRename: (id: string, next: string) => void;
}> = ({ lane, idx, locked, onRename }) => {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(lane.label);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (value.trim() && value !== lane.label) onRename(lane.id, value.trim());
  };

  return (
    <div
      className="absolute left-0 right-0 border-b border-slate-200/40 dark:border-navy-700/40"
      style={{ top: idx * 140, height: 140, background: `${lane.color}15` }}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="absolute left-2 top-1 text-[10px] font-semibold text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-navy-800/80 rounded px-1 outline-none border border-primary-400 z-10"
        />
      ) : (
        <div
          className="absolute left-2 top-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 select-none cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 z-10"
          onDoubleClick={() => {
            if (!locked) {
              setValue(lane.label);
              setEditing(true);
            }
          }}
        >
          {lane.label}
        </div>
      )}
    </div>
  );
};

// ── Main component ───────────────────────────────────────────────────────────

interface IdeaProcessFlowToolProps {
  open: boolean;
  ideaId: string;
  locked?: boolean;
  refreshToken?: number;
  onSaved?: () => void;
}

export const IdeaProcessFlowTool: React.FC<IdeaProcessFlowToolProps> = ({
  open,
  ideaId,
  locked = false,
  refreshToken,
  onSaved,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);
  const [lanes, setLanes] = useState<Lane[]>(DEFAULT_LANES);
  const [extensions, setExtensions] = useState<Record<string, unknown>>({});
  const [warnings, setWarnings] = useState<ValidationWarning[]>([]);
  const [showWarnings, setShowWarnings] = useState(false);

  const didPersistRef = useRef(false);

  // ── Hydrate ──────────────────────────────────────────────────────────────

  const hydrate = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const res = await Api.getMyIdeaMap(ideaId, { language: i18n.language });
      const map = res?.map || {};
      const rawNodes = Array.isArray(map.nodes) ? (map.nodes as any[]) : [];
      const rawEdges = Array.isArray(map.edges) ? (map.edges as any[]) : [];
      const rawExt = map?.extensions && typeof map.extensions === 'object' ? (map.extensions as Record<string, unknown>) : {};

      const pfExt = (rawExt?.processFlow || {}) as Record<string, unknown>;
      const savedLanes = Array.isArray(pfExt?.lanes) ? (pfExt.lanes as Lane[]) : DEFAULT_LANES;
      setLanes(savedLanes);

      const hydratedNodes = rawNodes
        .filter((n: any) => n?.id)
        .map((n: any) => {
          const nid = String(n.id);
          return {
            id: nid,
            type: n?.type || 'flowNode',
            position: n?.position || { x: 100, y: 100 },
            data: {
              ...(n?.data || { label: '', shape: 'action' }),
              locked,
              onLabelChange: (next: string) => {
                setNodes((nds: Node[]) =>
                  nds.map((nd: Node) => (nd.id === nid ? { ...nd, data: { ...nd.data, label: next } } : nd))
                );
              },
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
            type: 'smoothstep',
            animated: Boolean(e?.animated),
            label: e?.label || e?.data?.label || '',
            data: e?.data || {},
          }))
      );
      setExtensions(rawExt);

      if (!didPersistRef.current) {
        didPersistRef.current = true;
        const preferred = map?.preferredTool ? String(map.preferredTool) : null;
        if (preferred !== 'process_flow') {
          Api.saveMyIdeaMap(ideaId, {
            nodes: rawNodes as any,
            edges: rawEdges as any,
            preferredTool: 'process_flow',
            extensions: rawExt,
          }).catch(() => undefined);
        }
      }
    } catch (err: any) {
      toast.error(err?.message || (isPl ? 'Nie udało się wczytać' : 'Failed to load'));
    } finally {
      setLoading(false);
    }
  }, [i18n.language, ideaId, isPl, open, setEdges, setNodes]);

  useEffect(() => {
    if (!open) return;
    didPersistRef.current = false;
    hydrate();
  }, [hydrate, open, refreshToken]);

  // ── Connections ──────────────────────────────────────────────────────────

  const onConnect = useCallback(
    (connection: Connection) => {
      if (locked) return;
      setEdges((eds: Edge[]) =>
        addEdge(
          {
            ...connection,
            type: 'smoothstep',
            animated: false,
            data: {},
          },
          eds
        )
      );
    },
    [locked, setEdges]
  );

  // ── Add node ─────────────────────────────────────────────────────────────

  const addNode = useCallback(
    (shape: FlowShape) => {
      if (locked) return;
      const lane = lanes[0] || DEFAULT_LANES[0];
      const id = `pf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const yBase = 60 + lanes.indexOf(lane) * 140;
      const xBase = 100 + nodes.filter((n: Node) => n.data?.laneId === lane.id).length * 200;

      const newNode: Node = {
        id,
        type: 'flowNode',
        position: { x: xBase, y: yBase },
        data: {
          label: isPl ? SHAPE_CONFIG[shape].labelPl : SHAPE_CONFIG[shape].label,
          shape,
          laneId: lane.id,
          laneColor: lane.color,
          locked,
          onLabelChange: (next: string) => {
            setNodes((nds: Node[]) =>
              nds.map((n: Node) => (n.id === id ? { ...n, data: { ...n.data, label: next } } : n))
            );
          },
        },
      };
      setNodes((prev: Node[]) => [...prev, newNode]);
    },
    [isPl, lanes, locked, nodes, setNodes]
  );

  // ── Add lane ─────────────────────────────────────────────────────────────

  const addLane = useCallback(() => {
    if (locked) return;
    const idx = lanes.length;
    const newLane: Lane = {
      id: `lane-${Date.now()}`,
      label: `Lane ${idx + 1}`,
      color: LANE_COLORS[idx % LANE_COLORS.length],
    };
    setLanes((prev: Lane[]) => [...prev, newLane]);
  }, [lanes.length, locked]);

  // ── Delete selected ──────────────────────────────────────────────────────

  const deleteSelected = useCallback(() => {
    if (locked) return;
    setNodes((prev: Node[]) => prev.filter((n: Node) => !n.selected));
    setEdges((prev: Edge[]) => {
      const removedNodeIds = new Set(nodes.filter((n: Node) => n.selected).map((n: Node) => n.id));
      return prev.filter((e: Edge) => !e.selected && !removedNodeIds.has(e.source) && !removedNodeIds.has(e.target));
    });
  }, [locked, nodes, setEdges, setNodes]);

  // ── Validate ─────────────────────────────────────────────────────────────

  const runValidation = useCallback(() => {
    const w = validateFlow(nodes, edges);
    setWarnings(w);
    setShowWarnings(true);
  }, [edges, nodes]);

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (locked) return;
    setSaving(true);
    try {
      const nextExt = {
        ...extensions,
        processFlow: {
          ...(extensions?.processFlow && typeof extensions.processFlow === 'object' ? extensions.processFlow : {}),
          lanes,
        },
      };
      await Api.saveMyIdeaMap(ideaId, {
        nodes: nodes as any,
        edges: edges as any,
        preferredTool: 'process_flow' as CanvasToolType,
        extensions: nextExt,
      });
      toast.success(isPl ? 'Zapisano' : 'Saved', { duration: 900 });
      onSaved?.();
    } catch (err: any) {
      toast.error(err?.message || (isPl ? 'Nie udało się zapisać' : 'Failed to save'));
    } finally {
      setSaving(false);
    }
  }, [edges, extensions, ideaId, isPl, lanes, locked, nodes, onSaved]);

  // ── Lane backgrounds ────────────────────────────────────────────────────

  const handleLaneRename = useCallback(
    (laneId: string, next: string) => {
      if (locked) return;
      setLanes((prev: Lane[]) =>
        prev.map((l: Lane) => (l.id === laneId ? { ...l, label: next } : l))
      );
    },
    [locked]
  );

  const laneBackgrounds = useMemo(
    () =>
      lanes.map((lane, idx) => (
        <LaneBackground key={lane.id} lane={lane} idx={idx} locked={locked} onRename={handleLaneRename} />
      )),
    [handleLaneRename, lanes, locked]
  );

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave, open]);

  if (!open) return null;

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-navy-950">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200/60 dark:border-navy-700/60 bg-slate-50/80 dark:bg-navy-900/80 flex-shrink-0">
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mr-2">
          {isPl ? 'Przepływ procesu' : 'Process Flow'}
        </div>

        <div className="flex items-center gap-1">
          {(Object.keys(SHAPE_CONFIG) as FlowShape[]).map((shape) => {
            const cfg = SHAPE_CONFIG[shape];
            const Icon = cfg.icon;
            return (
              <button
                key={shape}
                type="button"
                onClick={() => addNode(shape)}
                disabled={locked}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-40"
                title={isPl ? cfg.labelPl : cfg.label}
              >
                <Icon size={14} />
                {isPl ? cfg.labelPl : cfg.label}
              </button>
            );
          })}
        </div>

        <div className="w-px h-5 bg-slate-200 dark:bg-navy-700 mx-1" />

        <button
          type="button"
          onClick={addLane}
          disabled={locked}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-40"
          title={isPl ? 'Dodaj lane' : 'Add lane'}
        >
          <Plus size={14} />
          Lane
        </button>

        <button
          type="button"
          onClick={deleteSelected}
          disabled={locked}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
          title={isPl ? 'Usuń zaznaczone' : 'Delete selected'}
        >
          <Trash2 size={14} />
        </button>

        <div className="flex-1" />

        <button
          type="button"
          onClick={runValidation}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
          title={isPl ? 'Waliduj przepływ' : 'Validate flow'}
        >
          <AlertTriangle size={14} />
          {isPl ? 'Waliduj' : 'Validate'}
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading || locked}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
            saving || loading || locked
              ? 'bg-slate-200/60 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'
              : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
          }`}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? (isPl ? 'Zapisuję…' : 'Saving…') : isPl ? 'Zapisz' : 'Save'}
        </button>
      </div>

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
              <li key={w.id} className="text-[11px] text-amber-700 dark:text-amber-300 flex items-start gap-1">
                <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                {isPl ? w.messagePl : w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Canvas */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>
      ) : (
        <div className="flex-1 relative">
          <div className="absolute inset-0">{laneBackgrounds}</div>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={locked ? undefined : onNodesChange}
            onEdgesChange={locked ? undefined : onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode={locked ? null : 'Delete'}
            className="bg-transparent"
            defaultEdgeOptions={{ type: 'smoothstep', animated: false }}
          >
            <Background gap={20} size={1} color="rgba(148,163,184,0.15)" />
            <Controls showInteractive={!locked} />
          </ReactFlow>
        </div>
      )}
    </div>
  );
};

export default IdeaProcessFlowTool;
