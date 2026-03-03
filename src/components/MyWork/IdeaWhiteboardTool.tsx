/**
 * IdeaWhiteboardTool — V3 Whiteboard canvas for Idea Workspace.
 *
 * Free-form canvas with sticky notes, text blocks, connectors.
 * Pan/zoom, lasso select, multi-move, grouping.
 * Data lives in shared IdeaWorkspaceGraph (nodes/edges/extensions.whiteboard).
 */
import {
  Group,
  Loader2,
  Save,
  StickyNote,
  Trash2,
  Type,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  MiniMap,
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

// ── Sticky colors ────────────────────────────────────────────────────────────

const STICKY_COLORS = [
  { bg: 'bg-yellow-100 dark:bg-yellow-900/40', border: 'border-yellow-300 dark:border-yellow-700', hex: '#fef9c3' },
  { bg: 'bg-blue-100 dark:bg-blue-900/40', border: 'border-blue-300 dark:border-blue-700', hex: '#dbeafe' },
  { bg: 'bg-green-100 dark:bg-green-900/40', border: 'border-green-300 dark:border-green-700', hex: '#dcfce7' },
  { bg: 'bg-pink-100 dark:bg-pink-900/40', border: 'border-pink-300 dark:border-pink-700', hex: '#fce7f3' },
  { bg: 'bg-purple-100 dark:bg-purple-900/40', border: 'border-purple-300 dark:border-purple-700', hex: '#f3e8ff' },
  { bg: 'bg-orange-100 dark:bg-orange-900/40', border: 'border-orange-300 dark:border-orange-700', hex: '#ffedd5' },
];

// ── Custom nodes ─────────────────────────────────────────────────────────────

const StickyNoteNode: React.FC<NodeProps> = ({ data, selected }) => {
  const colorIdx = (data?.colorIndex ?? 0) % STICKY_COLORS.length;
  const color = STICKY_COLORS[colorIdx];
  const [editing, setEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(String(data?.label || ''));
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }
  }, [editing]);

  const commitEdit = () => {
    setEditing(false);
    if (data?.onLabelChange && editValue !== data?.label) {
      data.onLabelChange(editValue);
    }
  };

  return (
    <div
      className={`relative w-[180px] min-h-[100px] p-3 rounded-lg border shadow-md transition-shadow ${color.bg} ${color.border} ${selected ? 'ring-2 ring-primary-500/60 shadow-lg' : ''}`}
      onDoubleClick={() => {
        if (!data?.locked) {
          setEditValue(String(data?.label || ''));
          setEditing(true);
        }
      }}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-slate-400 !-top-1" />
      {editing ? (
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false);
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
          }}
          className="w-full min-h-[60px] bg-transparent text-xs font-medium text-slate-800 dark:text-slate-200 outline-none resize-none border-b border-primary-400"
          rows={3}
        />
      ) : (
        <div className="text-xs font-medium text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
          {data?.label || ''}
        </div>
      )}
      {data?.author && (
        <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 truncate">{data.author}</div>
      )}
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-slate-400 !-bottom-1" />
    </div>
  );
};

const TextBlockNode: React.FC<NodeProps> = ({ data, selected }) => {
  const [editing, setEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(String(data?.label || ''));
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }
  }, [editing]);

  const commitEdit = () => {
    setEditing(false);
    if (data?.onLabelChange && editValue !== data?.label) {
      data.onLabelChange(editValue);
    }
  };

  return (
    <div
      className={`relative w-[220px] min-h-[60px] p-3 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 shadow-sm transition-shadow ${selected ? 'ring-2 ring-primary-500/60 shadow-lg' : ''}`}
      onDoubleClick={() => {
        if (!data?.locked) {
          setEditValue(String(data?.label || ''));
          setEditing(true);
        }
      }}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-slate-400 !-top-1" />
      {editing ? (
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false);
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
          }}
          className="w-full min-h-[40px] bg-transparent text-xs text-slate-800 dark:text-slate-200 outline-none resize-none border-b border-primary-400"
          rows={2}
        />
      ) : (
        <div className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
          {data?.label || ''}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-slate-400 !-bottom-1" />
    </div>
  );
};

const GroupNode: React.FC<NodeProps> = ({ data, selected }) => (
  <div
    className={`relative w-[300px] min-h-[200px] p-2 rounded-2xl border-2 border-dashed border-slate-300 dark:border-navy-600 bg-slate-50/50 dark:bg-navy-900/50 transition-shadow ${selected ? 'ring-2 ring-primary-500/60' : ''}`}
  >
    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
      {data?.label || 'Group'}
    </div>
  </div>
);

type RFNodeTypes = Record<string, React.ComponentType<NodeProps<any>>>;

const nodeTypes: RFNodeTypes = {
  stickyNote: StickyNoteNode,
  textBlock: TextBlockNode,
  groupNode: GroupNode,
};

// ── Main component ───────────────────────────────────────────────────────────

type WbNodeKind = 'sticky' | 'text' | 'group';

interface IdeaWhiteboardToolProps {
  open: boolean;
  ideaId: string;
  locked?: boolean;
  refreshToken?: number;
  onSaved?: () => void;
}

export const IdeaWhiteboardTool: React.FC<IdeaWhiteboardToolProps> = ({
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
  const [extensions, setExtensions] = useState<Record<string, unknown>>({});

  const didPersistRef = useRef(false);
  const stickyColorCounter = useRef(0);

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

      const hydratedNodes = rawNodes
        .filter((n: any) => n?.id)
        .map((n: any) => {
          const nid = String(n.id);
          return {
            id: nid,
            type: n?.type || 'stickyNote',
            position: n?.position || { x: 100, y: 100 },
            data: {
              ...(n?.data || { label: '' }),
              locked,
              onLabelChange: (next: string) => {
                setNodes((nds: Node[]) =>
                  nds.map((nd: Node) => (nd.id === nid ? { ...nd, data: { ...nd.data, label: next } } : nd))
                );
              },
            },
            ...(n?.style ? { style: n.style } : {}),
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
        if (preferred !== 'whiteboard') {
          Api.saveMyIdeaMap(ideaId, {
            nodes: rawNodes as any,
            edges: rawEdges as any,
            preferredTool: 'whiteboard',
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
      setEdges((eds: Edge[]) => addEdge({ ...connection, type: 'smoothstep' }, eds));
    },
    [locked, setEdges]
  );

  // ── Add elements ─────────────────────────────────────────────────────────

  const addElement = useCallback(
    (kind: WbNodeKind) => {
      if (locked) return;
      const id = `wb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const offset = nodes.length * 30;

      const typeMap: Record<WbNodeKind, string> = {
        sticky: 'stickyNote',
        text: 'textBlock',
        group: 'groupNode',
      };

      const colorIndex = kind === 'sticky' ? stickyColorCounter.current++ : 0;

      const newNode: Node = {
        id,
        type: typeMap[kind],
        position: { x: 100 + offset, y: 100 + offset },
        data: {
          label: kind === 'sticky'
            ? (isPl ? 'Nowa notatka' : 'New note')
            : kind === 'text'
            ? (isPl ? 'Tekst' : 'Text')
            : (isPl ? 'Grupa' : 'Group'),
          colorIndex: kind === 'sticky' ? colorIndex % STICKY_COLORS.length : undefined,
          locked,
          onLabelChange: (next: string) => {
            setNodes((nds: Node[]) =>
              nds.map((nd: Node) => (nd.id === id ? { ...nd, data: { ...nd.data, label: next } } : nd))
            );
          },
        },
        ...(kind === 'group' ? { style: { width: 300, height: 200 } } : {}),
      };
      setNodes((prev: Node[]) => [...prev, newNode]);
    },
    [isPl, locked, nodes.length, setNodes]
  );

  // ── Delete selected ──────────────────────────────────────────────────────

  const deleteSelected = useCallback(() => {
    if (locked) return;
    const removedIds = new Set(nodes.filter((n: Node) => n.selected).map((n: Node) => n.id));
    setNodes((prev: Node[]) => prev.filter((n: Node) => !n.selected));
    setEdges((prev: Edge[]) => prev.filter((e: Edge) => !e.selected && !removedIds.has(e.source) && !removedIds.has(e.target)));
  }, [locked, nodes, setEdges, setNodes]);

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (locked) return;
    setSaving(true);
    try {
      await Api.saveMyIdeaMap(ideaId, {
        nodes: nodes as any,
        edges: edges as any,
        preferredTool: 'whiteboard' as CanvasToolType,
        extensions,
      });
      toast.success(isPl ? 'Zapisano' : 'Saved', { duration: 900 });
      onSaved?.();
    } catch (err: any) {
      toast.error(err?.message || (isPl ? 'Nie udało się zapisać' : 'Failed to save'));
    } finally {
      setSaving(false);
    }
  }, [edges, extensions, ideaId, isPl, locked, nodes, onSaved]);

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
          {isPl ? 'Tablica' : 'Whiteboard'}
        </div>

        <button
          type="button"
          onClick={() => addElement('sticky')}
          disabled={locked}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-40"
          title={isPl ? 'Dodaj notatkę' : 'Add sticky note'}
        >
          <StickyNote size={14} />
          {isPl ? 'Notatka' : 'Sticky'}
        </button>

        <button
          type="button"
          onClick={() => addElement('text')}
          disabled={locked}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-40"
          title={isPl ? 'Dodaj tekst' : 'Add text'}
        >
          <Type size={14} />
          {isPl ? 'Tekst' : 'Text'}
        </button>

        <button
          type="button"
          onClick={() => addElement('group')}
          disabled={locked}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-40"
          title={isPl ? 'Dodaj grupę' : 'Add group'}
        >
          <Group size={14} />
          {isPl ? 'Grupa' : 'Group'}
        </button>

        <div className="w-px h-5 bg-slate-200 dark:bg-navy-700 mx-1" />

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

      {/* Canvas */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>
      ) : (
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={locked ? undefined : onNodesChange}
            onEdgesChange={locked ? undefined : onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            selectionOnDrag
            panOnDrag={[1, 2]}
            deleteKeyCode={locked ? null : 'Delete'}
            className="bg-slate-50/50 dark:bg-navy-950"
            defaultEdgeOptions={{ type: 'smoothstep' }}
          >
            <Background gap={24} size={1} color="rgba(148,163,184,0.12)" />
            <Controls showInteractive={!locked} />
            <MiniMap
              nodeColor={(n: Node) => {
                if (n.type === 'stickyNote') {
                  const idx = (n.data?.colorIndex ?? 0) % STICKY_COLORS.length;
                  return STICKY_COLORS[idx].hex;
                }
                return '#e2e8f0';
              }}
              maskColor="rgba(0,0,0,0.08)"
              className="!bg-white/80 dark:!bg-navy-900/80 !border-slate-200 dark:!border-navy-700 !rounded-xl"
            />
          </ReactFlow>
        </div>
      )}
    </div>
  );
};

export default IdeaWhiteboardTool;
