/**
 * IdeaWhiteboardTool — V3 Whiteboard canvas for Idea Workspace.
 *
 * Free-form canvas with sticky notes, text blocks, connectors.
 * Pan/zoom, lasso select, multi-move, grouping.
 * Data lives in shared IdeaWorkspaceGraph (nodes/edges/extensions.whiteboard).
 */
import 'reactflow/dist/style.css';

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  Diamond,
  ExternalLink,
  Frame,
  GitBranch,
  Grid3X3,
  Group,
  Hexagon,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  Loader2,
  Lock,
  Palette,
  Pen,
  Plus,
  Save,
  Shapes,
  Sparkles,
  StickyNote,
  ThumbsUp,
  Trash2,
  TrendingUp,
  Type,
  Ungroup,
  Workflow,
  Layers,
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
  // @ts-expect-error reactflow version mismatch
  getBezierPath,
  Handle,
  MiniMap,
  type Node,
  type NodeChange,
  type NodeProps,
  Position,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';

import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { withNormalizedArtifactLinks } from '@/utils/artifactLinks';

import {
  formatIdeaMapSyncLabel,
  resolveIdeaMapHydration,
  useIdeaMapSync,
} from './canvas/useIdeaMapSync';
import { CanvasZoomControls } from './canvas/CanvasZoomControls';
import { type DrawingPath, IdeaDrawingLayer } from './IdeaDrawingLayer';
import { KPIBadgeNode, ProgressNode, ScoreNode } from './IdeaMetricNodes';
import { IdeaScenesManager, type Scene } from './IdeaScenesManager';
import {
  type CanvasToolType,
  EMPTY_SELECTION,
  IDEA_WORKSPACE_THEME_EVENT,
  IDEA_WORKSPACE_INSERT_EVENT,
  type IdeaWorkspaceInsertDetail,
  type IdeaWorkspaceSelection,
} from './ideaSelectionTypes';
import { CollaborationOverlay } from './mindmap/CollaborationOverlay';
import { SummaryCardNode } from './IdeaSummaryCardNode';
import { applySmartLayout, type LayoutAlgorithm } from './layout/IdeaSmartLayout';
import { useWhiteboardNodes } from './whiteboard/useWhiteboardNodes';
import {
  createWhiteboardActivityEntry,
  createWhiteboardHistoryEntry,
  cycleWhiteboardClassification,
  cycleWhiteboardRole,
  getSemanticTypeLabel,
  inferWhiteboardSemanticType,
  type WhiteboardActivityEntry,
  type WhiteboardClassification,
  type WhiteboardHistoryEntry,
  type WhiteboardLibraryItem,
  type WhiteboardOutcomeRecord,
  type WhiteboardSessionState,
  type WhiteboardSharePolicy,
  type WhiteboardVoteEntry,
} from './whiteboard/whiteboardContracts';
import { useWhiteboardQuickActions } from './whiteboard/useWhiteboardQuickActions';

// ── Sticky colors ────────────────────────────────────────────────────────────

const STICKY_COLORS = [
  {
    bg: 'bg-yellow-100 dark:bg-yellow-900/40',
    border: 'border-yellow-300 dark:border-yellow-700',
    hex: '#fef9c3',
  },
  {
    bg: 'bg-blue-100 dark:bg-blue-900/40',
    border: 'border-blue-300 dark:border-blue-700',
    hex: '#dbeafe',
  },
  {
    bg: 'bg-green-100 dark:bg-green-900/40',
    border: 'border-green-300 dark:border-green-700',
    hex: '#dcfce7',
  },
  {
    bg: 'bg-pink-100 dark:bg-pink-900/40',
    border: 'border-pink-300 dark:border-pink-700',
    hex: '#fce7f3',
  },
  {
    bg: 'bg-purple-100 dark:bg-purple-900/40',
    border: 'border-purple-300 dark:border-purple-700',
    hex: '#f3e8ff',
  },
  {
    bg: 'bg-orange-100 dark:bg-orange-900/40',
    border: 'border-orange-300 dark:border-orange-700',
    hex: '#ffedd5',
  },
  {
    bg: 'bg-teal-100 dark:bg-teal-900/40',
    border: 'border-teal-300 dark:border-teal-700',
    hex: '#ccfbf1',
  },
  {
    bg: 'bg-rose-100 dark:bg-rose-900/40',
    border: 'border-rose-300 dark:border-rose-700',
    hex: '#ffe4e6',
  },
];

// ── Sticky note sizes ─────────────────────────────────────────────────────────

const STICKY_SIZES: Record<string, { w: number; h: number; textRows: number }> = {
  s: { w: 120, h: 80, textRows: 2 },
  m: { w: 180, h: 100, textRows: 3 },
  l: { w: 240, h: 140, textRows: 5 },
};

// ── Custom nodes ─────────────────────────────────────────────────────────────

const StickyNoteNode: React.FC<NodeProps> = ({ id: nodeId, data, selected }) => {
  const colorIdx = (data?.colorIndex ?? 0) % STICKY_COLORS.length;
  const color = STICKY_COLORS[colorIdx];
  const sizeKey = (data?.size as string) || 'm';
  const size = STICKY_SIZES[sizeKey] || STICKY_SIZES.m;
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

  const commentCount = Array.isArray(data?.comments) ? data.comments.length : 0;
  const priority = typeof data?.priority === 'number' ? data.priority : 0;
  const priorityBorder =
    priority >= 80
      ? 'border-2 border-red-400/70'
      : priority >= 50
        ? 'border-2 border-amber-400/60'
        : '';

  return (
    <div
      className={`relative p-3 rounded-lg border shadow-md transition-all ${color.bg} ${color.border} ${priorityBorder} ${selected ? 'ring-2 ring-primary-500/60 shadow-lg' : ''} ${data?.isAI ? 'ring-1 ring-violet-400/30' : ''} ${data?._isNew ? 'animate-[pulse_1s_ease-in-out_1]' : ''}`}
      style={{ width: size.w, minHeight: size.h }}
      onDoubleClick={() => {
        if (!data?.locked) {
          setEditValue(String(data?.label || ''));
          setEditing(true);
        }
      }}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-slate-400 !-top-1" />
      {/* Comment badge — click dispatches node-detail open */}
      {commentCount > 0 && (
        <div
          className="absolute -top-2 -right-2 z-10 flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-[8px] font-bold shadow-sm cursor-pointer hover:bg-blue-600 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('idea-node-open-detail', { detail: { nodeId } }));
          }}
          title={`${commentCount} comment${commentCount !== 1 ? 's' : ''}`}
        >
          {commentCount}
        </div>
      )}
      {editing ? (
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false);
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              commitEdit();
            }
          }}
          className="w-full bg-transparent text-xs font-medium text-slate-800 dark:text-slate-200 outline-none resize-none border-b border-primary-400"
          style={{ minHeight: size.h - 40 }}
          rows={size.textRows}
        />
      ) : (
        <div>
          {data?.semanticLabel && (
            <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              {String(data.semanticLabel)}
            </div>
          )}
          <div className="text-xs font-medium text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
            {data?.label || ''}
          </div>
        </div>
      )}
      {data?.author && (
        <div className="absolute bottom-1.5 right-2 text-[8px] text-slate-500 dark:text-slate-400 truncate max-w-[70%] text-right">
          {data.author}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-slate-400 !-bottom-1"
      />
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
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              commitEdit();
            }
          }}
          className="w-full min-h-[40px] bg-transparent text-xs text-slate-800 dark:text-slate-200 outline-none resize-none border-b border-primary-400"
          rows={2}
        />
      ) : (
        <div>
          {data?.semanticLabel && (
            <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              {String(data.semanticLabel)}
            </div>
          )}
          <div
            className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words"
            style={typeof data?.fontSize === 'number' ? { fontSize: data.fontSize } : undefined}
          >
            {data?.label || ''}
          </div>
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-slate-400 !-bottom-1"
      />
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

// ── Shape Node (Rectangle / Circle / Diamond / Hexagon) ───────────────────

const SHAPE_STYLES: Record<string, { className: string; svgPath?: string }> = {
  rectangle: { className: 'rounded-lg' },
  circle: { className: 'rounded-full aspect-square' },
  diamond: { className: 'rotate-45' },
  hexagon: { className: 'clip-path-hexagon' },
};

const ShapeNode: React.FC<NodeProps> = ({ data, selected }) => {
  const shape = data?.shape || 'rectangle';
  const bgColor = data?.bgColor || '#e0e7ff';
  const [editing, setEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(String(data?.label || ''));
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitEdit = () => {
    setEditing(false);
    if (data?.onLabelChange && editValue !== data?.label) data.onLabelChange(editValue);
  };

  const isDiamond = shape === 'diamond';
  const isCircle = shape === 'circle';
  const isHexagon = shape === 'hexagon';

  return (
    <div
      className={`relative flex items-center justify-center transition-shadow ${selected ? 'ring-2 ring-primary-500/60 shadow-lg' : 'shadow-sm'}`}
      style={{
        width: isCircle ? 120 : isDiamond ? 100 : isHexagon ? 140 : 160,
        height: isCircle ? 120 : isDiamond ? 100 : isHexagon ? 120 : 80,
        backgroundColor: bgColor,
        borderRadius: isCircle ? '50%' : isDiamond ? 8 : isHexagon ? 0 : 12,
        transform: isDiamond ? 'rotate(45deg)' : undefined,
        border: isHexagon ? 'none' : '2px solid rgba(0,0,0,0.1)',
        clipPath: isHexagon ? 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' : undefined,
      }}
      onDoubleClick={() => {
        if (!data?.locked) {
          setEditValue(String(data?.label || ''));
          setEditing(true);
        }
      }}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-slate-400 !-top-1" />
      <div
        style={{ transform: isDiamond ? 'rotate(-45deg)' : undefined }}
        className="px-2 text-center w-full"
      >
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
            className="w-full bg-transparent text-[11px] font-medium text-slate-800 text-center outline-none border-b border-primary-400"
          />
        ) : (
          <div className="text-[11px] font-medium text-slate-800 truncate">{data?.label || ''}</div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-slate-400 !-bottom-1"
      />
    </div>
  );
};

// ── Frame Node (section container with title and background) ──────────────

const FrameNode: React.FC<NodeProps> = ({ data, selected }) => {
  const bgColor = data?.bgColor || 'rgba(241,245,249,0.6)';
  const collapsed = Boolean(data?.collapsed);
  const [editing, setEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(String(data?.label || ''));
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitEdit = () => {
    setEditing(false);
    if (data?.onLabelChange && editValue !== data?.label) data.onLabelChange(editValue);
  };

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data?.onCollapseToggle) data.onCollapseToggle(!collapsed);
  };

  const childCount = data?.childCount ?? 0;

  return (
    <div
      className={`relative p-3 rounded-2xl border-2 transition-shadow ${selected ? 'ring-2 ring-primary-500/60 border-primary-400' : 'border-slate-300 dark:border-navy-600'}`}
      style={{
        width: data?.width || 400,
        minHeight: collapsed ? 'auto' : data?.height || 300,
        backgroundColor: bgColor,
      }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        {data?.semanticLabel && (
          <span className="px-1.5 py-0.5 rounded-full bg-white/70 dark:bg-navy-800/60 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            {String(data.semanticLabel)}
          </span>
        )}
        {!data?.locked && (
          <button
            type="button"
            onClick={toggleCollapse}
            className="flex items-center justify-center w-5 h-5 rounded hover:bg-slate-200/60 dark:hover:bg-navy-700/60 transition-colors shrink-0"
          >
            {collapsed ? (
              <ChevronRight size={12} className="text-slate-500 dark:text-slate-400" />
            ) : (
              <ChevronDown size={12} className="text-slate-500 dark:text-slate-400" />
            )}
          </button>
        )}
        <div
          className="flex-1 cursor-text min-w-0"
          onDoubleClick={() => {
            if (!data?.locked) {
              setEditValue(String(data?.label || ''));
              setEditing(true);
            }
          }}
        >
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
              className="w-full bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none border-b border-primary-400 uppercase tracking-wider"
            />
          ) : (
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 truncate">
              {data?.label || 'Frame'}
            </div>
          )}
        </div>
        {collapsed && childCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-slate-200 dark:bg-navy-700 text-[9px] font-semibold text-slate-600 dark:text-slate-300 px-1 shrink-0">
            {childCount}
          </span>
        )}
      </div>
      {collapsed && (
        <div className="text-[10px] text-slate-400 dark:text-slate-500 italic">
          {childCount > 0 ? `${childCount} item${childCount !== 1 ? 's' : ''} hidden` : 'Empty'}
        </div>
      )}
    </div>
  );
};

// ── Image Node (supports data.src, data.imageUrl for pasted base64, and width resize) ──

const ImageNode: React.FC<NodeProps> = ({ data, selected }) => {
  const imgSrc = data?.imageUrl || data?.src;
  const [nodeWidth, setNodeWidth] = React.useState<number>(data?.width || 200);
  const resizing = React.useRef(false);
  const startX = React.useRef(0);
  const startW = React.useRef(0);

  const onResizeStart = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      resizing.current = true;
      startX.current = e.clientX;
      startW.current = nodeWidth;

      const onMove = (ev: MouseEvent) => {
        if (!resizing.current) return;
        const delta = ev.clientX - startX.current;
        const next = Math.max(80, startW.current + delta);
        setNodeWidth(next);
        if (data?.onWidthChange) data.onWidthChange(next);
      };
      const onUp = () => {
        resizing.current = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [nodeWidth, data]
  );

  return (
    <div
      className={`relative rounded-xl overflow-hidden border border-slate-200 dark:border-navy-700 shadow-sm transition-shadow ${selected ? 'ring-2 ring-primary-500/60 shadow-lg' : ''}`}
      style={{ width: nodeWidth }}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-slate-400 !-top-1" />
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={data?.label || 'Image'}
          className="w-full object-contain"
          draggable={false}
        />
      ) : (
        <div
          className="w-full flex flex-col items-center justify-center bg-slate-100 dark:bg-navy-800 text-slate-400"
          style={{ height: data?.height || 150 }}
        >
          <ImageIcon size={24} />
          <div className="text-[10px] mt-1">{data?.label || 'Image'}</div>
        </div>
      )}
      {data?.label && imgSrc && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[10px] px-2 py-1 truncate">
          {data.label}
        </div>
      )}
      {/* Resize handle (right edge) */}
      {!data?.locked && (
        <div
          className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-primary-400/20 transition-colors"
          onMouseDown={onResizeStart}
        />
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-slate-400 !-bottom-1"
      />
    </div>
  );
};

// ── Link Node ─────────────────────────────────────────────────────────────

const LinkNode: React.FC<NodeProps> = ({ data, selected }) => {
  const [meta, setMeta] = React.useState<{
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    favicon?: string;
  }>({});
  const fetched = React.useRef(false);

  React.useEffect(() => {
    if (fetched.current || !data?.url || data?.ogTitle) return;
    fetched.current = true;
    const url = String(data.url);
    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setMeta(d);
      })
      .catch(() => undefined);
  }, [data?.url, data?.ogTitle]);

  const ogTitle = data?.ogTitle || meta.ogTitle;
  const ogDesc = data?.ogDescription || meta.ogDescription;
  const ogImage = data?.ogImage || meta.ogImage;
  const favicon = data?.favicon || meta.favicon;

  const handleClick = React.useCallback(() => {
    if (data?.url) window.open(String(data.url), '_blank', 'noopener');
  }, [data?.url]);

  return (
    <div
      className={`relative w-[220px] rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 shadow-sm transition-shadow overflow-hidden cursor-pointer hover:shadow-md ${selected ? 'ring-2 ring-primary-500/60 shadow-lg' : ''}`}
      onClick={handleClick}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-slate-400 !-top-1" />
      {ogImage && (
        <div className="w-full h-[100px] bg-slate-100 dark:bg-navy-700 overflow-hidden">
          <img src={ogImage} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-slate-100 dark:bg-navy-700 flex items-center justify-center shrink-0">
            {favicon ? (
              <img src={favicon} alt="" className="w-3.5 h-3.5" />
            ) : (
              <Link2 size={10} className="text-slate-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate">
              {ogTitle || data?.label || data?.url || 'Link'}
            </div>
            {ogDesc && (
              <div className="text-[9px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                {ogDesc}
              </div>
            )}
            {data?.url && (
              <div className="text-[8px] text-slate-400 truncate mt-0.5">{data.url}</div>
            )}
          </div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-slate-400 !-bottom-1"
      />
    </div>
  );
};

// ── Labeled Edge ──────────────────────────────────────────────────────────

const LabeledEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  style,
  markerEnd,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const [editing, setEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(String(data?.label || ''));
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitEdit = () => {
    setEditing(false);
    if (data?.onLabelChange && editValue !== data?.label) data.onLabelChange(editValue);
  };

  const gradientId = `edge-gradient-${id}`;
  const animId = `edge-flow-${id}`;
  const edgeColor = data?.color || (selected ? '#8b5cf6' : '#94a3b8');
  const edgeColorEnd = data?.colorEnd || (selected ? '#6366f1' : '#cbd5e1');

  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={edgeColor} />
          <stop offset="100%" stopColor={edgeColorEnd} />
        </linearGradient>
      </defs>
      {/* Glow layer */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke={edgeColor}
          strokeWidth={6}
          strokeOpacity={0.15}
          style={{ filter: 'blur(4px)' }}
        />
      )}
      {/* Main edge with gradient */}
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={selected ? 2.5 : 1.8}
        strokeLinecap="round"
        strokeDasharray={
          data?.edgeStyle === 'dashed'
            ? '8 4'
            : data?.edgeStyle === 'dotted'
              ? '2 4'
              : data?.edgeStyle === 'wavy'
                ? '6 3 2 3'
                : undefined
        }
        markerEnd={markerEnd}
        style={style}
      />
      {/* Animated flow dots */}
      <circle r={selected ? 3 : 2} fill={edgeColor} opacity={0.7}>
        <animateMotion dur="3s" repeatCount="indefinite" path={edgePath} />
      </circle>
      {(data?.label || editing) && (
        <foreignObject
          x={labelX - 50}
          y={labelY - 12}
          width={100}
          height={24}
          className="overflow-visible"
        >
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
              className="w-full bg-white dark:bg-navy-800 text-[10px] text-center border border-primary-400 rounded px-1 py-0.5 outline-none"
            />
          ) : (
            <div
              className="text-[10px] text-center text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-navy-900/80 rounded px-1.5 py-0.5 cursor-pointer hover:bg-white dark:hover:bg-navy-800 transition-colors"
              onDoubleClick={() => {
                setEditValue(String(data?.label || ''));
                setEditing(true);
              }}
            >
              {data?.label}
            </div>
          )}
        </foreignObject>
      )}
    </>
  );
};

type RFNodeTypes = Record<string, React.ComponentType<NodeProps<any>>>;

const nodeTypes: RFNodeTypes = {
  stickyNote: StickyNoteNode,
  textBlock: TextBlockNode,
  groupNode: GroupNode,
  shapeNode: ShapeNode,
  frameNode: FrameNode,
  imageNode: ImageNode,
  linkNode: LinkNode,
  summaryCard: SummaryCardNode,
  kpiBadge: KPIBadgeNode,
  scoreNode: ScoreNode,
  progressNode: ProgressNode,
};

const edgeTypes = {
  labeled: LabeledEdge,
};

// ── Inner canvas (needs useReactFlow context) ────────────────────────────────

export type CanvasBgPattern = 'dots' | 'grid' | 'lines' | 'blank';

interface WhiteboardCanvasProps {
  nodes: Node[];
  edges: Edge[];
  locked: boolean;
  isPolish?: boolean;
  onNodesChange?: (changes: NodeChange[]) => void;
  onEdgesChange?: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onNodeDoubleClick?: (nodeId: string, nodeData: any) => void;
  bgPattern?: CanvasBgPattern;
  onViewportChange?: (vp: { x: number; y: number; zoom: number }) => void;
  onExternalInsert?: (items: WhiteboardExternalInsert[]) => void;
  onFullscreenToggle?: () => void;
  isFullscreen?: boolean;
}

const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  nodes,
  edges,
  locked,
  isPolish = false,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeDoubleClick,
  bgPattern = 'dots',
  onViewportChange,
  onExternalInsert,
  onFullscreenToggle: externalOnFullscreenToggle,
  isFullscreen: externalIsFullscreen = false,
}) => {
  const { screenToFlowPosition, setViewport } = useReactFlow();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [showMiniMap, setShowMiniMap] = React.useState(false);
  const [internalFullscreen, setInternalFullscreen] = React.useState(false);

  const toggleInternalFullscreen = React.useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().then(() => setInternalFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setInternalFullscreen(false)).catch(() => {});
    }
  }, []);

  React.useEffect(() => {
    if (externalOnFullscreenToggle) return;
    const handler = () => setInternalFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, [externalOnFullscreenToggle]);

  const onFullscreenToggle = externalOnFullscreenToggle ?? toggleInternalFullscreen;
  const isFullscreen = externalOnFullscreenToggle ? externalIsFullscreen : internalFullscreen;

  const selectedNodeId = React.useMemo(
    () => nodes.find((node) => node.selected)?.id ?? null,
    [nodes]
  );

  React.useEffect(() => {
    const rfEl = containerRef.current?.closest('.react-flow');
    if (!rfEl) return;
    const handler = (e: Event) => {
      const vp = (e as CustomEvent).detail;
      if (
        vp &&
        typeof vp.x === 'number' &&
        typeof vp.y === 'number' &&
        typeof vp.zoom === 'number'
      ) {
        setViewport(vp, { duration: 600 });
      }
    };
    rfEl.addEventListener('idea-whiteboard-set-viewport', handler);
    return () => rfEl.removeEventListener('idea-whiteboard-set-viewport', handler);
  }, [setViewport]);

  const getCenter = React.useCallback(() => {
    return screenToFlowPosition({
      x: (containerRef.current?.clientWidth ?? 400) / 2,
      y: (containerRef.current?.clientHeight ?? 300) / 2,
    });
  }, [screenToFlowPosition]);

  const handlePaste = React.useCallback(
    (e: ClipboardEvent) => {
      if (locked) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) return;

          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            if (!dataUrl) return;
            const center = getCenter();
            onExternalInsert?.([
              {
                kind: 'image',
                label: file.name || 'Pasted image',
                src: dataUrl,
                width: 300,
                position: center,
              },
            ]);
          };
          reader.readAsDataURL(file);
          return;
        }
      }

      const text = e.clipboardData?.getData('text/plain')?.trim();
      if (text) {
        e.preventDefault();
        const center = getCenter();
        const isUrl = /^https?:\/\//i.test(text);
        onExternalInsert?.([
          isUrl
            ? { kind: 'link', label: text, url: text, position: center }
            : {
                kind: 'text',
                label: text,
                position: center,
                colorIndex: Math.floor(Math.random() * STICKY_COLORS.length),
              },
        ]);
      }
    },
    [getCenter, locked, onExternalInsert]
  );

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      if (locked) return;
      e.preventDefault();

      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const files = e.dataTransfer.files;

      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const id = `wb-drop-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;

          if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const dataUrl = ev.target?.result as string;
              if (!dataUrl) return;
              onExternalInsert?.([
                {
                  kind: 'image',
                  label: file.name,
                  src: dataUrl,
                  width: 250,
                  position: { x: pos.x + i * 30, y: pos.y + i * 30 },
                },
              ]);
            };
            reader.readAsDataURL(file);
          } else {
            onExternalInsert?.([
              {
                kind: 'link',
                label: file.name,
                url: '',
                position: { x: pos.x + i * 30, y: pos.y + i * 30 },
              },
            ]);
          }
        }
        return;
      }

      const text = e.dataTransfer.getData('text/plain')?.trim();
      if (text) {
        const isUrl = /^https?:\/\//i.test(text);
        onExternalInsert?.([
          isUrl
            ? { kind: 'link', label: text, url: text, position: pos }
            : {
                kind: 'text',
                label: text,
                position: pos,
                colorIndex: Math.floor(Math.random() * STICKY_COLORS.length),
              },
        ]);
      }
    },
    [locked, onExternalInsert, screenToFlowPosition]
  );

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('paste', handlePaste);
    return () => el.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      tabIndex={0}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={locked ? undefined : onNodesChange}
        onEdgesChange={locked ? undefined : onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeDoubleClick={(_event: any, node: any) => {
          if (onNodeDoubleClick) onNodeDoubleClick(node.id, node.data);
        }}
        fitView
        selectionOnDrag
        panOnDrag={[1, 2]}
        deleteKeyCode={locked ? null : 'Delete'}
        className="bg-slate-50/50 dark:bg-navy-950"
        defaultEdgeOptions={{ type: 'labeled' }}
        onMoveEnd={(_event: unknown, viewport: { x: number; y: number; zoom: number }) =>
          onViewportChange?.(viewport)
        }
      >
        {bgPattern !== 'blank' && (
          <Background
            gap={bgPattern === 'lines' ? 48 : 24}
            size={bgPattern === 'grid' ? 24 : 1}
            color="rgba(148,163,184,0.12)"
            variant={
              bgPattern === 'grid'
                ? ('cross' as any)
                : bgPattern === 'lines'
                  ? ('lines' as any)
                  : ('dots' as any)
            }
          />
        )}
        {showMiniMap && (
          <MiniMap
            nodeColor={(n: Node) => {
              if (n.type === 'stickyNote') {
                const idx = (n.data?.colorIndex ?? 0) % STICKY_COLORS.length;
                return STICKY_COLORS[idx].hex;
              }
              if (n.type === 'kpiBadge') {
                const s = n.data?.status;
                return s === 'on_track'
                  ? '#34d399'
                  : s === 'off_track'
                    ? '#f87171'
                    : s === 'at_risk'
                      ? '#fbbf24'
                      : '#94a3b8';
              }
              if (n.type === 'scoreNode') return '#8b5cf6';
              if (n.type === 'progressNode') return '#60a5fa';
              if (n.type === 'summaryCard') return '#a78bfa';
              if (n.type === 'frameNode') return '#f1f5f9';
              if (n.type === 'shapeNode') return n.data?.bgColor || '#e0e7ff';
              if (n.type === 'groupNode') return '#f8fafc';
              return '#e2e8f0';
            }}
            maskColor="rgba(0,0,0,0.08)"
            className="!bg-white/80 dark:!bg-navy-900/80 !border-slate-200 dark:!border-navy-700 !rounded-xl"
          />
        )}
        <CanvasZoomControls
          isPolish={isPolish}
          selectedNodeId={selectedNodeId}
          showMiniMap={showMiniMap}
          onToggleMiniMap={() => setShowMiniMap((prev) => !prev)}
          onFullscreenToggle={onFullscreenToggle}
          isFullscreen={isFullscreen}
        />
      </ReactFlow>
    </div>
  );
};

// ── Main component ───────────────────────────────────────────────────────────

type WbNodeKind =
  | 'sticky'
  | 'text'
  | 'group'
  | 'shape_rectangle'
  | 'shape_circle'
  | 'shape_diamond'
  | 'shape_hexagon'
  | 'frame'
  | 'image'
  | 'link'
  | 'kpi_badge'
  | 'score'
  | 'progress'
  | 'summary';

const WB_NODE_KINDS: WbNodeKind[] = [
  'sticky',
  'text',
  'group',
  'shape_rectangle',
  'shape_circle',
  'shape_diamond',
  'shape_hexagon',
  'frame',
  'image',
  'link',
  'kpi_badge',
  'score',
  'progress',
  'summary',
];

function isWbNodeKind(value: unknown): value is WbNodeKind {
  return typeof value === 'string' && WB_NODE_KINDS.includes(value as WbNodeKind);
}

type WhiteboardQuickStart = 'brainstorm' | 'affinity' | 'workshop';

type WhiteboardCanvasSnapshot = {
  nodes: Node[];
  edges: Edge[];
  drawingPaths: DrawingPath[];
  scenes: Scene[];
};

type WhiteboardExternalInsert =
  | {
      kind: 'image';
      label: string;
      src: string;
      width?: number;
      position?: { x: number; y: number };
    }
  | {
      kind: 'link';
      label: string;
      url: string;
      position?: { x: number; y: number };
    }
  | {
      kind: 'text';
      label: string;
      position?: { x: number; y: number };
      colorIndex?: number;
    };

function cloneCanvasSnapshot(snapshot: WhiteboardCanvasSnapshot): WhiteboardCanvasSnapshot {
  return {
    nodes: snapshot.nodes.map((node) => ({ ...node, data: { ...(node.data || {}) } })),
    edges: snapshot.edges.map((edge) => ({ ...edge, data: { ...(edge.data || {}) } })),
    drawingPaths: snapshot.drawingPaths.map((path) => ({ ...path })),
    scenes: snapshot.scenes.map((scene) => ({ ...scene })),
  };
}

function isNodeDataLocked(node: Node | null | undefined): boolean {
  return Boolean(node?.data?.locked);
}

function normalizeVoteSummary(
  summary: Array<{ vote_target_id?: string; total?: number | string; count?: number | string }>
): Record<string, number> {
  return summary.reduce<Record<string, number>>((acc, entry) => {
    const nodeId = String(entry.vote_target_id || '').trim();
    if (!nodeId) return acc;
    const total = Number(entry.total ?? entry.count ?? 0);
    acc[nodeId] = Number.isFinite(total) ? total : 0;
    return acc;
  }, {});
}

const DEFAULT_SESSION_STATE: WhiteboardSessionState = {
  active: false,
  role: 'facilitator',
  sessionId: null,
  toolSessionId: null,
  timerSeconds: 300,
  timerEndsAt: null,
  votingOpen: false,
  followMe: false,
  spotlightNodeId: null,
  reactionsEnabled: true,
  updatedAt: 0,
};

const DEFAULT_SHARE_POLICY: WhiteboardSharePolicy = {
  classification: 'internal',
  watermark: 'Consultify Whiteboard',
  exportAllowed: true,
  shareAllowed: true,
};

interface IdeaWhiteboardToolProps {
  open: boolean;
  ideaId: string;
  locked?: boolean;
  refreshToken?: number;
  onSaved?: () => void;
  onSelectionChange?: (sel: IdeaWorkspaceSelection) => void;
  onNodeDetail?: (nodeId: string, nodeData: any) => void;
  drillFocusNodeId?: string | null;
  focusMode?: 'system' | 'object' | null;
  focusObjectId?: string | null;
  onFullscreenToggle?: () => void;
  isFullscreen?: boolean;
  onGraphChange?: (graph: {
    nodes: any[];
    edges: any[];
    extensions?: Record<string, unknown>;
  }) => void;
}

export const IdeaWhiteboardTool: React.FC<IdeaWhiteboardToolProps> = ({
  open,
  ideaId,
  locked = false,
  refreshToken,
  onSaved,
  onSelectionChange,
  onNodeDetail,
  drillFocusNodeId,
  focusMode,
  focusObjectId,
  onFullscreenToggle: externalOnFullscreenToggle,
  isFullscreen: externalIsFullscreen,
  onGraphChange,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const currentUser = useAppStore((state) => state.currentUser);
  const currentUserId = String(currentUser?.id || 'current-user');
  const currentUserName = useMemo(() => {
    const fullName = [currentUser?.firstName, currentUser?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return fullName || currentUser?.email || (isPl ? 'Ty' : 'You');
  }, [currentUser?.email, currentUser?.firstName, currentUser?.lastName, isPl]);

  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [whiteboardMode, setWhiteboardMode] = useState<'board' | 'draw'>('board');
  const [drawingPaths, setDrawingPaths] = useState<DrawingPath[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [sessionState, setSessionState] = useState<WhiteboardSessionState>(DEFAULT_SESSION_STATE);
  const [sharePolicy, setSharePolicy] = useState<WhiteboardSharePolicy>(DEFAULT_SHARE_POLICY);
  const [libraryItems, setLibraryItems] = useState<WhiteboardLibraryItem[]>([]);
  const [outcomeRegistry, setOutcomeRegistry] = useState<WhiteboardOutcomeRecord[]>([]);
  const [activityLog, setActivityLog] = useState<WhiteboardActivityEntry[]>([]);
  const [historyLog, setHistoryLog] = useState<WhiteboardHistoryEntry[]>([]);
  const [sessionVotes, setSessionVotes] = useState<Record<string, number>>({});
  const [myVoteCounts, setMyVoteCounts] = useState<Record<string, number>>({});
  const [presenceUsers, setPresenceUsers] = useState<
    Array<{
      userId: string;
      userName?: string;
      cursorState?: Record<string, unknown>;
      activeBlockId?: string | null;
    }>
  >([]);
  const [outlineImportOpen, setOutlineImportOpen] = useState(false);
  const [outlineImportValue, setOutlineImportValue] = useState('');
  const [bgPattern, setBgPattern] = useState<CanvasBgPattern>('dots');
  const [viewportTransform, setViewportTransform] = useState<{
    x: number;
    y: number;
    zoom: number;
  }>({ x: 0, y: 0, zoom: 1 });
  const selectedNodeIds = useMemo(
    () => nodes.filter((node) => node.selected).map((node) => node.id),
    [nodes]
  );
  const {
    saving,
    syncState,
    lastSavedAt,
    queueSync,
    flushNow,
    primeServerVersion,
  } = useIdeaMapSync({
    ideaId,
    tool: 'whiteboard',
    open,
    locked,
  });
  const lastSnapshotRef = useRef<WhiteboardCanvasSnapshot | null>(null);
  const undoStackRef = useRef<WhiteboardCanvasSnapshot[]>([]);
  const redoStackRef = useRef<WhiteboardCanvasSnapshot[]>([]);
  const toolSessionId = useMemo(() => `whiteboard:${ideaId}`, [ideaId]);
  const appendActivity = useCallback(
    (entry: WhiteboardActivityEntry) => {
      setActivityLog((prev) => [entry, ...prev].slice(0, 40));
    },
    [setActivityLog]
  );
  const pushUndoSnapshot = useCallback(() => {
    const snapshot = cloneCanvasSnapshot({ nodes, edges, drawingPaths, scenes });
    undoStackRef.current = [...undoStackRef.current.slice(-24), snapshot];
    redoStackRef.current = [];
    lastSnapshotRef.current = snapshot;
  }, [drawingPaths, edges, nodes, scenes]);

  const restoreSnapshot = useCallback(
    (snapshot: WhiteboardCanvasSnapshot) => {
      const cloned = cloneCanvasSnapshot(snapshot);
      setNodes(cloned.nodes);
      setEdges(cloned.edges);
      setDrawingPaths(cloned.drawingPaths);
      setScenes(cloned.scenes);
      lastSnapshotRef.current = cloned;
    },
    [setEdges, setNodes]
  );

  const undoWhiteboard = useCallback(() => {
    const previous = undoStackRef.current[undoStackRef.current.length - 1];
    if (!previous) return;
    const current = cloneCanvasSnapshot({ nodes, edges, drawingPaths, scenes });
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [current, ...redoStackRef.current.slice(0, 24)];
    restoreSnapshot(previous);
    appendActivity(
      createWhiteboardActivityEntry('history', isPl ? 'Cofnięto zmianę' : 'Undid change', currentUserId)
    );
  }, [appendActivity, currentUserId, drawingPaths, edges, isPl, nodes, restoreSnapshot, scenes]);

  const redoWhiteboard = useCallback(() => {
    const next = redoStackRef.current[0];
    if (!next) return;
    const current = cloneCanvasSnapshot({ nodes, edges, drawingPaths, scenes });
    redoStackRef.current = redoStackRef.current.slice(1);
    undoStackRef.current = [...undoStackRef.current.slice(-24), current];
    restoreSnapshot(next);
    appendActivity(
      createWhiteboardActivityEntry('history', isPl ? 'Ponowiono zmianę' : 'Redid change', currentUserId)
    );
  }, [appendActivity, currentUserId, drawingPaths, edges, isPl, nodes, restoreSnapshot, scenes]);
  const handleSelectionUpdate = useCallback(
    (nds: Node[]) => {
      const selected = nds.filter((n: Node) => n.selected);
      if (selected.length === 0) {
        onSelectionChange?.(EMPTY_SELECTION);
      } else {
        onSelectionChange?.({
          type: 'node',
          count: selected.length,
          ids: selected.map((n: Node) => n.id),
          primaryId: selected[0]?.id,
          meta: {
            nodeType: selected[0]?.type,
            label: selected[0]?.data?.label,
            description: selected[0]?.data?.description,
            owner: selected[0]?.data?.owner,
            status: selected[0]?.data?.status,
            tags: Array.isArray(selected[0]?.data?.tags) ? selected[0]?.data?.tags : undefined,
            artifactRef: selected[0]?.data?.artifactRef,
            attachments: Array.isArray(selected[0]?.data?.attachments)
              ? selected[0]?.data?.attachments
              : undefined,
            shape: typeof selected[0]?.data?.shape === 'string' ? selected[0]?.data?.shape : undefined,
            semanticType: inferWhiteboardSemanticType(selected[0]),
          },
        });
      }
    },
    [onSelectionChange]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const mutatingChange = changes.some(
        (change) => change.type !== 'select' && change.type !== 'dimensions'
      );
      if (mutatingChange) pushUndoSnapshot();
      setNodes((nds) => {
        const filteredChanges = changes.filter((change) => {
          if (change.type === 'select') return true;
          const targetNode = nds.find((node) => node.id === change.id);
          return !isNodeDataLocked(targetNode);
        });
        const next = applyNodeChanges(filteredChanges, nds);
        const hasSelectionChange = changes.some((c: NodeChange) => c.type === 'select');
        if (hasSelectionChange) handleSelectionUpdate(next);
        return next;
      });
    },
    [handleSelectionUpdate, pushUndoSnapshot]
  );
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (changes.some((change) => change.type !== 'select')) pushUndoSnapshot();
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, [pushUndoSnapshot]);
  const [extensions, setExtensions] = useState<Record<string, unknown>>({});

  useEffect(() => {
    onGraphChange?.({
      nodes: nodes as any[],
      edges: edges as any[],
      extensions,
    });
  }, [edges, extensions, nodes, onGraphChange]);

  const frameCollapseKey = nodes
    .filter((n) => n.type === 'frameNode')
    .map((n) => `${n.id}:${n.data?.collapsed ? 1 : 0}`)
    .join(',');

  useEffect(() => {
    setNodes((nds) => {
      const frames = nds.filter((n) => n.type === 'frameNode');
      if (frames.length === 0) return nds;

      const childCounts = new Map<string, number>();
      for (const n of nds) {
        const pid = (n as any).parentNode || (n as any).parentId;
        if (pid) childCounts.set(pid, (childCounts.get(pid) || 0) + 1);
      }

      let changed = false;
      const next = nds.map((n) => {
        if (n.type === 'frameNode') {
          const count = childCounts.get(n.id) || 0;
          if (n.data?.childCount !== count) {
            changed = true;
            return { ...n, data: { ...n.data, childCount: count } };
          }
        }
        const pid = (n as any).parentNode || (n as any).parentId;
        if (pid) {
          const parent = frames.find((f) => f.id === pid);
          if (parent && Boolean(parent.data?.collapsed) !== Boolean(n.hidden)) {
            changed = true;
            return { ...n, hidden: Boolean(parent.data?.collapsed) };
          }
        }
        return n;
      });
      return changed ? next : nds;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameCollapseKey, setNodes]);

  const didPersistRef = useRef(false);
  const stickyColorCounter = useRef(0);


  // ── Hydrate ──────────────────────────────────────────────────────────────

  const hydrate = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const res = await Api.getMyIdeaMap(ideaId, { language: i18n.language });
      const hydration = resolveIdeaMapHydration(ideaId, res?.map || {});
      const map = hydration.map || {};
      primeServerVersion(Number(map?.version || 1));
      const rawNodes = Array.isArray(map.nodes) ? (map.nodes as any[]) : [];
      const rawEdges = Array.isArray(map.edges) ? (map.edges as any[]) : [];
      const rawExt =
        map?.extensions && typeof map.extensions === 'object'
          ? (map.extensions as Record<string, unknown>)
          : {};

      const hydratedNodes = rawNodes
        .filter((n: any) => n?.id)
        .map((n: any) => {
          const normalizedNode = withNormalizedArtifactLinks(n);
          const nid = String(normalizedNode.id);
          const nodeData: Record<string, unknown> = {
            ...(normalizedNode?.data || { label: '' }),
            locked,
            semanticLabel: getSemanticTypeLabel(
              inferWhiteboardSemanticType(normalizedNode),
              Boolean(isPl)
            ),
            onLabelChange: (next: string) => {
              setNodes((nds: Node[]) =>
                nds.map((nd: Node) =>
                  nd.id === nid ? { ...nd, data: { ...nd.data, label: next } } : nd
                )
              );
            },
          };
          if (normalizedNode?.type === 'frameNode') {
            nodeData.onCollapseToggle = (next: boolean) => {
              setNodes((nds: Node[]) =>
                nds.map((nd: Node) =>
                  nd.id === nid ? { ...nd, data: { ...nd.data, collapsed: next } } : nd
                )
              );
            };
          }
          return {
            id: nid,
            type: normalizedNode?.type || 'stickyNote',
            position: normalizedNode?.position || { x: 100, y: 100 },
            data: nodeData,
            ...(normalizedNode?.parentNode || normalizedNode?.parentId || normalizedNode?.data?.parentId
              ? {
                  parentNode:
                    normalizedNode?.parentNode ||
                    normalizedNode?.parentId ||
                    normalizedNode?.data?.parentId,
                  parentId:
                    normalizedNode?.parentId ||
                    normalizedNode?.parentNode ||
                    normalizedNode?.data?.parentId,
                }
              : {}),
            ...(normalizedNode?.style ? { style: normalizedNode.style } : {}),
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
            type: e?.type || 'labeled',
            animated: Boolean(e?.animated),
            label: e?.label || e?.data?.label || '',
            data: e?.data || {},
          }))
      );
      setExtensions(rawExt);

      const wbExt =
        rawExt?.whiteboard && typeof rawExt.whiteboard === 'object'
          ? (rawExt.whiteboard as Record<string, any>)
          : {};
      if (Array.isArray(wbExt.drawingPaths)) setDrawingPaths(wbExt.drawingPaths);
      if (Array.isArray(wbExt.scenes)) setScenes(wbExt.scenes);
      if (wbExt.mode === 'board' || wbExt.mode === 'draw') {
        setWhiteboardMode(wbExt.mode);
      }
      if (wbExt.sessionState && typeof wbExt.sessionState === 'object') {
        setSessionState({
          ...DEFAULT_SESSION_STATE,
          toolSessionId,
          ...(wbExt.sessionState as Partial<WhiteboardSessionState>),
        });
      } else {
        setSessionState({ ...DEFAULT_SESSION_STATE, toolSessionId });
      }
      if (wbExt.sharePolicy && typeof wbExt.sharePolicy === 'object') {
        setSharePolicy({
          ...DEFAULT_SHARE_POLICY,
          ...(wbExt.sharePolicy as Partial<WhiteboardSharePolicy>),
        });
      } else {
        setSharePolicy(DEFAULT_SHARE_POLICY);
      }
      setLibraryItems(Array.isArray(wbExt.libraryItems) ? wbExt.libraryItems : []);
      setOutcomeRegistry(Array.isArray(wbExt.outcomeRegistry) ? wbExt.outcomeRegistry : []);
      setActivityLog(Array.isArray(wbExt.activityLog) ? wbExt.activityLog : []);
      setHistoryLog(Array.isArray(wbExt.historyLog) ? wbExt.historyLog : []);
      setSessionVotes(
        wbExt.sessionVotes && typeof wbExt.sessionVotes === 'object' ? wbExt.sessionVotes : {}
      );
      if (wbExt.bgPattern && ['dots', 'grid', 'lines', 'blank'].includes(wbExt.bgPattern)) {
        setBgPattern(wbExt.bgPattern as CanvasBgPattern);
      }
      if (wbExt.latestSnapshot && typeof wbExt.latestSnapshot === 'object') {
        lastSnapshotRef.current = wbExt.latestSnapshot as WhiteboardCanvasSnapshot;
      }

      if (!didPersistRef.current) {
        didPersistRef.current = true;
        const preferred = map?.preferredTool ? String(map.preferredTool) : null;
        if (preferred !== 'whiteboard') {
          Api.syncMyIdeaMap(ideaId, {
            nodes: rawNodes as any,
            edges: rawEdges as any,
            baseVersion: Number(map?.version || 1),
            preferredTool: 'whiteboard',
            extensions: rawExt,
          }).catch(() => undefined);
        }
      }
    } catch (err: any) {
      toast.error(err?.message || (isPl ? 'Nie udało się wczytać' : 'Failed to load'));
      setNodes([]);
      setEdges([]);
      setExtensions({});
    } finally {
      setLoading(false);
    }
  }, [i18n.language, ideaId, isPl, open, setEdges, setNodes, toolSessionId]);

  useEffect(() => {
    if (!open) return;
    didPersistRef.current = false;
    hydrate();
  }, [hydrate, open, refreshToken]);

  const rememberSnapshot = useCallback(
    (label: string) => {
      lastSnapshotRef.current = cloneCanvasSnapshot({
        nodes,
        edges,
        drawingPaths,
        scenes,
      });
      setHistoryLog((prev) => [createWhiteboardHistoryEntry(label), ...prev].slice(0, 20));
    },
    [drawingPaths, edges, nodes, scenes]
  );

  const buildWhiteboardExtensions = useCallback(() => {
    return {
      ...(extensions?.whiteboard && typeof extensions.whiteboard === 'object'
        ? extensions.whiteboard
        : {}),
      mode: whiteboardMode,
      viewState: { snap: false, showGrid: true },
      drawingPaths,
      scenes,
      bgPattern,
      sessionState: {
        ...sessionState,
        updatedAt: Date.now(),
      },
      sharePolicy,
      libraryItems,
      outcomeRegistry,
      activityLog,
      historyLog,
      sessionVotes,
      myVoteCounts,
      latestSnapshot: lastSnapshotRef.current,
    };
  }, [
    activityLog,
    bgPattern,
    drawingPaths,
    extensions,
    historyLog,
    libraryItems,
    myVoteCounts,
    outcomeRegistry,
    scenes,
    sessionState,
    sessionVotes,
    sharePolicy,
    whiteboardMode,
  ]);
  const saveStatusLabel = useMemo(
    () => formatIdeaMapSyncLabel(syncState, lastSavedAt, isPl),
    [isPl, lastSavedAt, syncState]
  );
  const buildPersistPayload = useCallback(
    () => ({
      nodes: nodes as any,
      edges: edges as any,
      preferredTool: 'whiteboard' as CanvasToolType,
      extensions: {
        ...extensions,
        whiteboard: buildWhiteboardExtensions(),
      },
    }),
    [buildWhiteboardExtensions, edges, extensions, nodes]
  );

  const ensureFacilitationSession = useCallback(async () => {
    if (sessionState.sessionId) return sessionState.sessionId;
    const created = await Api.facilitationCreateSession({
      toolSessionId,
      settings: { tool: 'whiteboard', ideaId },
    });
    const sessionId = String(created?.id || '');
    if (!sessionId) throw new Error(isPl ? 'Brak sessionId' : 'Missing sessionId');
    setSessionState((prev) => ({
      ...prev,
      active: true,
      sessionId,
      toolSessionId,
      updatedAt: Date.now(),
    }));
    await Api.facilitationAssignRole(sessionId, {
      userId: currentUserId,
      roleName: sessionState.role,
      permissions: sessionState.role === 'facilitator' ? ['timer', 'voting', 'follow'] : [],
    }).catch(() => undefined);
    return sessionId;
  }, [currentUserId, ideaId, isPl, sessionState.role, sessionState.sessionId, toolSessionId]);

  const syncFacilitationVotes = useCallback(
    async (sessionId: string) => {
      const [summaryRes, votesRes] = await Promise.all([
        Api.facilitationGetVoteSummary(sessionId),
        Api.facilitationGetVotes(sessionId),
      ]);
      const summary = Array.isArray(summaryRes?.summary) ? summaryRes.summary : [];
      const votes = Array.isArray(votesRes?.votes) ? votesRes.votes : [];
      setSessionVotes(normalizeVoteSummary(summary));
      setMyVoteCounts(
        (votes as Array<Record<string, unknown>>).reduce((acc: Record<string, number>, vote) => {
          if (String(vote.voter_id || vote.voterId || '') !== currentUserId) return acc;
          const nodeId = String(vote.vote_target_id || vote.voteTargetId || '');
          if (!nodeId) return acc;
          acc[nodeId] = (acc[nodeId] || 0) + Number(vote.vote_value ?? vote.voteValue ?? 1);
          return acc;
        }, {})
      );
    },
    [currentUserId]
  );

  const setBoardMode = useCallback(
    (mode: 'board' | 'draw') => {
      setWhiteboardMode(mode);
      appendActivity(
        createWhiteboardActivityEntry(
          'session',
          mode === 'draw'
            ? isPl
              ? 'Włączono tryb rysowania'
              : 'Draw mode enabled'
            : isPl
              ? 'Włączono tryb board'
              : 'Board mode enabled',
          currentUserId
        )
      );
    },
    [appendActivity, currentUserId, isPl]
  );

  const cycleSessionRole = useCallback(() => {
    const nextRole = cycleWhiteboardRole(sessionState.role);
    setSessionState((prev) => ({
      ...prev,
      active: true,
      role: nextRole,
      updatedAt: Date.now(),
    }));
    appendActivity(
      createWhiteboardActivityEntry(
        'session',
        isPl ? `Rola sesji: ${nextRole}` : `Session role: ${nextRole}`,
        currentUserId
      )
    );
    ensureFacilitationSession()
      .then((sessionId) =>
        Api.facilitationAssignRole(sessionId, {
          userId: currentUserId,
          roleName: nextRole,
          permissions: nextRole === 'facilitator' ? ['timer', 'voting', 'follow'] : [],
        })
      )
      .catch(() => undefined);
  }, [appendActivity, currentUserId, ensureFacilitationSession, isPl, sessionState.role]);

  const toggleSessionTimer = useCallback(() => {
    const timerEndsAt = sessionState.timerEndsAt ? null : Date.now() + sessionState.timerSeconds * 1000;
    const nextState = {
      ...sessionState,
      active: true,
      timerEndsAt,
      updatedAt: Date.now(),
    };
    setSessionState(nextState);
    appendActivity(
      createWhiteboardActivityEntry(
        'session',
        timerEndsAt
          ? isPl
            ? 'Uruchomiono timer warsztatu'
            : 'Workshop timer started'
          : isPl
            ? 'Zatrzymano timer warsztatu'
            : 'Workshop timer stopped',
        currentUserId
      )
    );
    ensureFacilitationSession()
      .then((sessionId) =>
        Api.facilitationUpdateTimer(sessionId, {
          timerEndsAt,
          timerSeconds: sessionState.timerSeconds,
          updatedBy: currentUserId,
        })
      )
      .catch(() => undefined);
  }, [appendActivity, currentUserId, ensureFacilitationSession, isPl, sessionState]);

  const toggleSessionVoting = useCallback(() => {
    const votingOpen = !sessionState.votingOpen;
    setSessionState((prev) => ({
      ...prev,
      active: true,
      votingOpen,
      updatedAt: Date.now(),
    }));
    window.dispatchEvent(
      new CustomEvent('idea-whiteboard-toggle-voting-overlay', {
        detail: { open: votingOpen, ideaId },
      })
    );
    appendActivity(
      createWhiteboardActivityEntry(
        'session',
        votingOpen
          ? isPl
            ? 'Otworzono głosowanie'
            : 'Voting opened'
          : isPl
            ? 'Zamknięto głosowanie'
            : 'Voting closed',
        currentUserId
      )
    );
    ensureFacilitationSession()
      .then(async (sessionId) => {
        await Api.facilitationUpdatePhase(sessionId, votingOpen ? 'voting' : 'board');
        if (votingOpen) {
          await syncFacilitationVotes(sessionId);
        }
      })
      .catch(() => undefined);
  }, [
    appendActivity,
    currentUserId,
    ensureFacilitationSession,
    ideaId,
    isPl,
    sessionState.votingOpen,
    syncFacilitationVotes,
  ]);

  const toggleSessionFollow = useCallback(() => {
    const followMe = !sessionState.followMe;
    setSessionState((prev) => ({ ...prev, active: true, followMe, updatedAt: Date.now() }));
    appendActivity(
      createWhiteboardActivityEntry(
        'session',
        followMe
          ? isPl
            ? 'Włączono follow-me'
            : 'Follow-me enabled'
          : isPl
            ? 'Wyłączono follow-me'
            : 'Follow-me disabled',
        currentUserId
      )
    );
    ensureFacilitationSession()
      .then((sessionId) =>
        Api.facilitationUpdatePhase(sessionId, followMe ? 'follow_me' : 'board')
      )
      .catch(() => undefined);
  }, [appendActivity, currentUserId, ensureFacilitationSession, isPl, sessionState.followMe]);

  const toggleSpotlightSelection = useCallback(() => {
    const selectedId = nodes.find((node) => node.selected)?.id || null;
    const spotlightNodeId = sessionState.spotlightNodeId === selectedId ? null : selectedId;
    setSessionState((prev) => ({ ...prev, active: true, spotlightNodeId, updatedAt: Date.now() }));
    appendActivity(
      createWhiteboardActivityEntry(
        'session',
        spotlightNodeId
          ? isPl
            ? 'Ustawiono spotlight na zaznaczeniu'
            : 'Spotlight set to selection'
          : isPl
            ? 'Wyczyszczono spotlight'
            : 'Spotlight cleared',
        currentUserId,
        selectedId ? [selectedId] : undefined
      )
    );
  }, [appendActivity, currentUserId, isPl, nodes]);

  const importOutline = useCallback(() => {
    if (!locked) setOutlineImportOpen(true);
  }, [appendActivity, currentUserId, isPl, locked, rememberSnapshot]);

  const saveSelectionToLibrary = useCallback(() => {
    const selected = nodes.filter((node) => node.selected);
    if (selected.length === 0) {
      toast(isPl ? 'Najpierw zaznacz elementy' : 'Select elements first');
      return;
    }
    const selectedIds = new Set(selected.map((node) => node.id));
    const item: WhiteboardLibraryItem = {
      id: `wb-library-${Date.now()}`,
      name:
        selected.length === 1
          ? String(selected[0]?.data?.label || (isPl ? 'Fragment' : 'Fragment'))
          : isPl
            ? `Fragment (${selected.length})`
            : `Fragment (${selected.length})`,
      createdAt: Date.now(),
      nodes: selected.map((node) => ({
        ...node,
        selected: false,
      })),
      edges: edges.filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target)),
    };
    setLibraryItems((prev) => [item, ...prev].slice(0, 12));
    appendActivity(
      createWhiteboardActivityEntry(
        'library',
        isPl ? 'Zapisano fragment do biblioteki' : 'Saved fragment to library',
        currentUserId,
        selected.map((node) => node.id)
      )
    );
  }, [appendActivity, currentUserId, edges, isPl, nodes]);

  const insertLatestLibraryItem = useCallback(() => {
    const item = libraryItems[0];
    if (!item) {
      toast(isPl ? 'Biblioteka jest pusta' : 'Library is empty');
      return;
    }
    pushUndoSnapshot();
    const idMap = new Map<string, string>();
    const insertedNodes = item.nodes.map((rawNode, index) => {
      const originalId = String(rawNode.id || '');
      const nextId = `wb-lib-${Date.now()}-${index}`;
      idMap.set(originalId, nextId);
      return {
        ...rawNode,
        id: nextId,
        position: {
          x: Number((rawNode.position as any)?.x || 0) + 80,
          y: Number((rawNode.position as any)?.y || 0) + 80,
        },
        selected: false,
        data: {
          ...((rawNode.data as Record<string, unknown>) || {}),
          onLabelChange: (label: string) => {
            setNodes((prev) =>
              prev.map((node) =>
                node.id === nextId ? { ...node, data: { ...node.data, label } } : node
              )
            );
          },
        },
      } as Node;
    });
    const insertedEdges = item.edges.map((rawEdge, index) => ({
      ...rawEdge,
      id: `wb-edge-lib-${Date.now()}-${index}`,
      source: idMap.get(String(rawEdge.source || '')) || String(rawEdge.source || ''),
      target: idMap.get(String(rawEdge.target || '')) || String(rawEdge.target || ''),
    })) as Edge[];
    setNodes((prev) => [...prev, ...insertedNodes]);
    setEdges((prev) => [...prev, ...insertedEdges]);
    appendActivity(
      createWhiteboardActivityEntry(
        'library',
        isPl ? 'Wstawiono fragment z biblioteki' : 'Inserted library fragment',
        currentUserId,
        insertedNodes.map((node) => node.id)
      )
    );
    rememberSnapshot(isPl ? 'Insert library fragment' : 'Inserted library fragment');
  }, [appendActivity, currentUserId, isPl, libraryItems, pushUndoSnapshot, rememberSnapshot]);

  const restoreLatestHistory = useCallback(() => {
    if (!lastSnapshotRef.current) {
      toast(isPl ? 'Brak snapshotu do przywrócenia' : 'No snapshot to restore');
      return;
    }
    const snapshot = lastSnapshotRef.current;
    pushUndoSnapshot();
    restoreSnapshot(snapshot);
    appendActivity(
      createWhiteboardActivityEntry(
        'history',
        isPl ? 'Przywrócono ostatni snapshot' : 'Restored latest snapshot',
        currentUserId
      )
    );
  }, [appendActivity, currentUserId, isPl, pushUndoSnapshot, restoreSnapshot]);

  const cycleGovernance = useCallback(() => {
    setSharePolicy((prev) => {
      const classification = cycleWhiteboardClassification(prev.classification);
      appendActivity(
        createWhiteboardActivityEntry(
          'governance',
          isPl ? `Klasyfikacja: ${classification}` : `Classification: ${classification}`,
          currentUserId
        )
      );
      return {
        ...prev,
        classification,
        watermark: `${classification.toUpperCase()} • ${
          String(prev.watermark || 'Consultify Whiteboard').split(' • ').slice(-1)[0]
        }`,
      };
    });
  }, [appendActivity, currentUserId, isPl]);

  // ── Connections ──────────────────────────────────────────────────────────

  const onConnect = useCallback(
    (connection: Connection) => {
      if (locked) return;
      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);
      if (isNodeDataLocked(sourceNode) || isNodeDataLocked(targetNode)) return;
      pushUndoSnapshot();
      setEdges((eds: Edge[]) => addEdge({ ...connection, type: 'labeled' }, eds));
    },
    [locked, nodes, pushUndoSnapshot, setEdges]
  );

  // ── Add elements ─────────────────────────────────────────────────────────

  const createNode = useCallback(
    (kind: WbNodeKind, extraData?: Record<string, unknown>, index = 0): Node => {
      const id = `wb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const offset = index * 30;
      const explicitPosition = extraData?.position as { x: number; y: number } | undefined;

      const typeMap: Record<WbNodeKind, string> = {
        sticky: 'stickyNote',
        text: 'textBlock',
        group: 'frameNode',
        shape_rectangle: 'shapeNode',
        shape_circle: 'shapeNode',
        shape_diamond: 'shapeNode',
        shape_hexagon: 'shapeNode',
        frame: 'frameNode',
        image: 'imageNode',
        link: 'linkNode',
        kpi_badge: 'kpiBadge',
        score: 'scoreNode',
        progress: 'progressNode',
        summary: 'summaryCard',
      };

      const shapeMap: Record<string, string> = {
        shape_rectangle: 'rectangle',
        shape_circle: 'circle',
        shape_diamond: 'diamond',
        shape_hexagon: 'hexagon',
      };

      const defaultLabels: Record<WbNodeKind, [string, string]> = {
        sticky: ['Nowa notatka', 'New note'],
        text: ['Tekst', 'Text'],
        group: ['Grupa', 'Group'],
        shape_rectangle: ['Kształt', 'Shape'],
        shape_circle: ['Kształt', 'Shape'],
        shape_diamond: ['Kształt', 'Shape'],
        shape_hexagon: ['Kształt', 'Shape'],
        frame: ['Sekcja', 'Section'],
        image: ['Obraz', 'Image'],
        link: ['Link', 'Link'],
        kpi_badge: ['KPI', 'KPI'],
        score: ['Wynik', 'Score'],
        progress: ['Postęp', 'Progress'],
        summary: ['Podsumowanie', 'Summary'],
      };

      const colorIndex = kind === 'sticky' ? stickyColorCounter.current++ : 0;
      const labels = defaultLabels[kind] || ['', ''];

      const nodeData: Record<string, unknown> = {
        label: labels[isPl ? 0 : 1],
        locked: Boolean(extraData?.locked ?? locked),
        semanticType:
          typeof extraData?.semanticType === 'string'
            ? extraData.semanticType
            : kind === 'sticky'
              ? 'note'
              : kind === 'image'
                ? 'image'
                : kind === 'link'
                  ? 'link'
                  : undefined,
        semanticLabel:
          typeof extraData?.semanticType === 'string'
            ? getSemanticTypeLabel(extraData.semanticType as any, Boolean(isPl))
            : undefined,
        onLabelChange: (next: string) => {
          setNodes((nds: Node[]) =>
            nds.map((nd: Node) =>
              nd.id === id ? { ...nd, data: { ...nd.data, label: next } } : nd
            )
          );
        },
        ...(extraData || {}),
      };
      delete nodeData.position;

      if (kind === 'sticky') nodeData.colorIndex = colorIndex % STICKY_COLORS.length;
      if (shapeMap[kind]) nodeData.shape = shapeMap[kind];
      if (kind === 'frame') {
        nodeData.width = 400;
        nodeData.height = 300;
        nodeData.collapsed = false;
        nodeData.childCount = 0;
        nodeData.onCollapseToggle = (next: boolean) => {
          setNodes((nds: Node[]) =>
            nds.map((nd: Node) =>
              nd.id === id ? { ...nd, data: { ...nd.data, collapsed: next } } : nd
            )
          );
        };
      }

      const newNode: Node = {
        id,
        type: typeMap[kind],
        position: explicitPosition || { x: 100 + offset, y: 100 + offset },
        data: nodeData,
        draggable: !Boolean(nodeData.locked),
        connectable: !Boolean(nodeData.locked),
        deletable: !Boolean(nodeData.locked),
        ...(kind === 'group' || kind === 'frame'
          ? {
              style: {
                width: Number(extraData?.width || 400),
                height: Number(extraData?.height || 300),
              },
            }
          : {}),
      };
      if (extraData?.semanticType === 'theme') {
        newNode.type = 'summaryCard';
      }
      if (extraData?.semanticType === 'outcome') {
        newNode.type = 'summaryCard';
      }
      if (extraData?.semanticType === 'decision') {
        newNode.type = 'textBlock';
        newNode.data = {
          ...newNode.data,
          artifactRef: {
            type: 'decision',
            id: String((extraData as Record<string, unknown>)?.linkedOutcomeId || id),
          },
        };
      }
      if (extraData?.semanticType === 'action') {
        newNode.type = 'stickyNote';
        newNode.data = {
          ...newNode.data,
          colorIndex: 2,
          status: 'todo',
        };
      }
      return newNode;
    },
    [isPl, locked]
  );

  const createOutcomeRecord = useCallback(
    (
      type: WhiteboardOutcomeRecord['type'],
      node: Node,
      sourceNodeIds?: string[],
      exportInfo?: { exportedToType?: string; exportedToId?: string }
    ): WhiteboardOutcomeRecord => ({
      id: `wb-outcome-${node.id}`,
      type,
      title: String(node.data?.label || getSemanticTypeLabel(type, Boolean(isPl))),
      nodeId: node.id,
      sourceNodeIds: sourceNodeIds?.length ? sourceNodeIds : [node.id],
      exportedToType: exportInfo?.exportedToType,
      exportedToId: exportInfo?.exportedToId,
      linkedOutcomeId: typeof node.data?.linkedOutcomeId === 'string' ? node.data.linkedOutcomeId : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
    [isPl]
  );

  const registerOutcomeRecord = useCallback(
    (record: WhiteboardOutcomeRecord) => {
      setOutcomeRegistry((prev) => {
        const next = prev.filter((item) => item.id !== record.id);
        return [record, ...next].slice(0, 40);
      });
    },
    [setOutcomeRegistry]
  );

  const handleExternalInsert = useCallback(
    (items: WhiteboardExternalInsert[]) => {
      if (locked || items.length === 0) return;
      pushUndoSnapshot();
      const created = items.map((item, index) => {
        if (item.kind === 'image') {
          return createNode(
            'image',
            {
              label: item.label,
              src: item.src,
              width: item.width ?? 300,
              position: item.position,
              semanticType: 'image',
            },
            index
          );
        }
        if (item.kind === 'link') {
          return createNode(
            'link',
            {
              label: item.label,
              url: item.url,
              position: item.position,
              semanticType: 'link',
            },
            index
          );
        }
        return createNode(
          item.label.length > 100 ? 'text' : 'sticky',
          {
            label: item.label,
            position: item.position,
            colorIndex: item.colorIndex,
            semanticType: item.label.length > 100 ? undefined : 'note',
          },
          index
        );
      });
      setNodes((prev) => [...prev, ...created]);
      appendActivity(
        createWhiteboardActivityEntry(
          'import',
          isPl ? 'Dodano elementy z wklejania/importu' : 'Inserted items from paste/import',
          currentUserId,
          created.map((node) => node.id)
        )
      );
      rememberSnapshot(isPl ? 'Import external items' : 'Imported external items');
    },
    [appendActivity, createNode, currentUserId, isPl, locked, pushUndoSnapshot, rememberSnapshot]
  );

  const applyOutlineImport = useCallback(() => {
    const lines = outlineImportValue
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 24);
    if (lines.length === 0) {
      setOutlineImportOpen(false);
      setOutlineImportValue('');
      return;
    }
    handleExternalInsert(
      lines.map((line, index) => ({
        kind: 'text' as const,
        label: line,
        position: { x: 120 + (index % 4) * 190, y: 120 + Math.floor(index / 4) * 130 },
        colorIndex: index % STICKY_COLORS.length,
      }))
    );
    setOutlineImportOpen(false);
    setOutlineImportValue('');
    appendActivity(
      createWhiteboardActivityEntry(
        'import',
        isPl ? `Zaimportowano ${lines.length} notatek` : `Imported ${lines.length} notes`,
        currentUserId
      )
    );
  }, [appendActivity, currentUserId, handleExternalInsert, isPl, outlineImportValue]);

  const addElement = useCallback(
    (kind: WbNodeKind, extraData?: Record<string, unknown>) => {
      if (locked) return;
      pushUndoSnapshot();
      const newNode = createNode(kind, extraData, nodes.length);
      setNodes((prev: Node[]) => [...prev, newNode]);
      const semanticType =
        typeof newNode.data?.semanticType === 'string' ? newNode.data.semanticType : undefined;
      if (
        semanticType === 'cluster' ||
        semanticType === 'theme' ||
        semanticType === 'outcome' ||
        semanticType === 'decision' ||
        semanticType === 'action'
      ) {
        registerOutcomeRecord(createOutcomeRecord(semanticType, newNode));
      }
      appendActivity(
        createWhiteboardActivityEntry(
          'create',
          isPl ? `Dodano element: ${kind}` : `Added element: ${kind}`,
          currentUserId,
          [newNode.id]
        )
      );
    },
    [
      appendActivity,
      createNode,
      createOutcomeRecord,
      currentUserId,
      isPl,
      locked,
      nodes.length,
      pushUndoSnapshot,
      registerOutcomeRecord,
      setNodes,
    ]
  );

  const seedQuickStart = useCallback(
    (mode: WhiteboardQuickStart) => {
      if (locked) return;
      pushUndoSnapshot();

      setBgPattern('dots');
      setNodes((prev: Node[]) => {
        if (prev.length > 0) return prev;

        const created: Node[] = [];
        const make = (kind: WbNodeKind, extraData: Record<string, unknown>) => {
          const node = createNode(kind, extraData, prev.length + created.length);
          created.push(node);
        };

        if (mode === 'brainstorm') {
          make('frame', {
            label: isPl ? 'Temat sesji' : 'Session topic',
            position: { x: 120, y: 80 },
            width: 540,
            height: 250,
            bgColor: 'rgba(245, 158, 11, 0.08)',
          });
          make('sticky', { label: isPl ? 'Pomysł 1' : 'Idea 1', position: { x: 180, y: 150 } });
          make('sticky', { label: isPl ? 'Pomysł 2' : 'Idea 2', position: { x: 360, y: 150 } });
          make('sticky', { label: isPl ? 'Pomysł 3' : 'Idea 3', position: { x: 240, y: 290 } });
          make('sticky', { label: isPl ? 'Pomysł 4' : 'Idea 4', position: { x: 430, y: 290 } });
        }

        if (mode === 'affinity') {
          make('frame', {
            label: isPl ? 'Temat A' : 'Theme A',
            position: { x: 120, y: 80 },
            width: 260,
            height: 320,
            bgColor: 'rgba(139, 92, 246, 0.08)',
          });
          make('frame', {
            label: isPl ? 'Temat B' : 'Theme B',
            position: { x: 420, y: 80 },
            width: 260,
            height: 320,
            bgColor: 'rgba(59, 130, 246, 0.08)',
          });
          make('sticky', { label: isPl ? 'Wrzutka 1' : 'Input 1', position: { x: 165, y: 145 } });
          make('sticky', { label: isPl ? 'Wrzutka 2' : 'Input 2', position: { x: 165, y: 265 } });
          make('sticky', { label: isPl ? 'Wrzutka 3' : 'Input 3', position: { x: 470, y: 145 } });
          make('sticky', { label: isPl ? 'Wrzutka 4' : 'Input 4', position: { x: 470, y: 265 } });
        }

        if (mode === 'workshop') {
          make('text', {
            label: isPl ? 'Cele warsztatu' : 'Workshop goals',
            position: { x: 140, y: 65 },
          });
          make('frame', {
            label: isPl ? 'Do omówienia' : 'Discuss',
            position: { x: 120, y: 110 },
            width: 220,
            height: 300,
            bgColor: 'rgba(245, 158, 11, 0.08)',
          });
          make('frame', {
            label: isPl ? 'Decyzje' : 'Decisions',
            position: { x: 380, y: 110 },
            width: 220,
            height: 300,
            bgColor: 'rgba(16, 185, 129, 0.08)',
          });
          make('frame', {
            label: isPl ? 'Parking lot' : 'Parking lot',
            position: { x: 640, y: 110 },
            width: 220,
            height: 300,
            bgColor: 'rgba(148, 163, 184, 0.12)',
          });
        }

        return [...prev, ...created];
      });

      toast.success(
        mode === 'brainstorm'
          ? isPl
            ? 'Utworzono start do brainstormu'
            : 'Brainstorm starter created'
          : mode === 'affinity'
            ? isPl
              ? 'Utworzono start do affinity map'
              : 'Affinity map starter created'
            : isPl
              ? 'Utworzono workshop wall'
              : 'Workshop wall created',
        { duration: 900 }
      );
      appendActivity(
        createWhiteboardActivityEntry(
          'create',
          isPl ? `Uruchomiono quick start: ${mode}` : `Quick start: ${mode}`,
          currentUserId
        )
      );
      rememberSnapshot(isPl ? `Quick start: ${mode}` : `Quick start: ${mode}`);
    },
    [appendActivity, createNode, currentUserId, isPl, locked, pushUndoSnapshot, rememberSnapshot]
  );

  // ── Node CRUD, grouping, distribution (extracted to useWhiteboardNodes) ──
  const {
    deleteSelected,
    duplicateSelected,
    groupSelected,
    ungroupSelected,
    distributeNodes,
  } = useWhiteboardNodes({
    nodes,
    setNodes,
    setEdges,
    locked: locked || false,
    isPl,
    pushSnapshot: pushUndoSnapshot,
  });

  // ── Quick action listener (extracted to useWhiteboardQuickActions) ───────
  useWhiteboardQuickActions({
    open,
    handlers: {
      addElement,
      deleteSelected,
      duplicateSelected,
      groupSelected,
      ungroupSelected,
      distributeNodes,
      setMode: setBoardMode,
      cycleSessionRole,
      toggleSessionTimer,
      toggleSessionVoting,
      toggleSessionFollow,
      toggleSpotlightSelection,
      importOutline,
      saveSelectionToLibrary,
      insertLatestLibraryItem,
      restoreLatestHistory,
      cycleGovernance,
      undo: undoWhiteboard,
      redo: redoWhiteboard,
    },
  });

  useEffect(() => {
    if (!open) return;
    const handler = async (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (detail.ideaId && detail.ideaId !== ideaId) return;
      const nodeId = String(detail.nodeId || detail.voteTargetId || '');
      if (!nodeId) return;
      try {
        const sessionId = await ensureFacilitationSession();
        await Api.facilitationCastVote(sessionId, {
          voteTargetId: nodeId,
          voteType: 'upvote',
          voteValue: 1,
        });
        await syncFacilitationVotes(sessionId);
        appendActivity(
          createWhiteboardActivityEntry(
            'vote',
            isPl ? 'Zapisano głos w sesji' : 'Vote persisted to session',
            currentUserId,
            [nodeId]
          )
        );
      } catch (error: any) {
        toast.error(error?.message || (isPl ? 'Nie udało się zapisać głosu' : 'Failed to save vote'));
      }
    };
    window.addEventListener('idea-whiteboard-cast-vote', handler);
    return () => window.removeEventListener('idea-whiteboard-cast-vote', handler);
  }, [
    appendActivity,
    currentUserId,
    ensureFacilitationSession,
    ideaId,
    isPl,
    open,
    syncFacilitationVotes,
  ]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const nodeId = String(detail.nodeId || '');
      if (!nodeId || !detail.data || typeof detail.data !== 'object') return;
      setNodes((prev) =>
        prev.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...detail.data } } : node
        )
      );
      appendActivity(
        createWhiteboardActivityEntry(
          'update',
          isPl ? 'Zmieniono właściwości obiektu' : 'Updated object properties',
          currentUserId,
          [nodeId]
        )
      );
    };
    window.addEventListener('idea-workspace-node-update', handler);
    return () => window.removeEventListener('idea-workspace-node-update', handler);
  }, [appendActivity, currentUserId, isPl, open]);

  useEffect(() => {
    if (!open || !sessionState.timerEndsAt) return;
    const msLeft = sessionState.timerEndsAt - Date.now();
    if (msLeft <= 0) {
      setSessionState((prev) => ({ ...prev, timerEndsAt: null, updatedAt: Date.now() }));
      appendActivity(
        createWhiteboardActivityEntry(
          'session',
          isPl ? 'Timer warsztatu zakończony' : 'Workshop timer completed',
          currentUserId
        )
      );
      if (sessionState.sessionId) {
        Api.facilitationUpdateTimer(sessionState.sessionId, {
          timerEndsAt: null,
          timerSeconds: sessionState.timerSeconds,
          updatedBy: currentUserId,
        }).catch(() => undefined);
      }
      return;
    }
    const timer = window.setTimeout(() => {
      setSessionState((prev) => ({ ...prev, timerEndsAt: null, updatedAt: Date.now() }));
      appendActivity(
        createWhiteboardActivityEntry(
          'session',
          isPl ? 'Timer warsztatu zakończony' : 'Workshop timer completed',
          currentUserId
        )
      );
      if (sessionState.sessionId) {
        Api.facilitationUpdateTimer(sessionState.sessionId, {
          timerEndsAt: null,
          timerSeconds: sessionState.timerSeconds,
          updatedBy: currentUserId,
        }).catch(() => undefined);
      }
    }, msLeft);
    return () => window.clearTimeout(timer);
  }, [
    appendActivity,
    currentUserId,
    isPl,
    open,
    sessionState.sessionId,
    sessionState.timerEndsAt,
    sessionState.timerSeconds,
  ]);

  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(
      new CustomEvent('idea-whiteboard-facilitation-state', {
        detail: {
          ideaId,
          sessionState,
          voteSummary: sessionVotes,
          myVoteCounts,
        },
      })
    );
  }, [ideaId, myVoteCounts, open, sessionState, sessionVotes]);

  useEffect(() => {
    if (!open || !sessionState.sessionId || !sessionState.votingOpen) return;
    syncFacilitationVotes(sessionState.sessionId).catch(() => undefined);
    const interval = window.setInterval(() => {
      syncFacilitationVotes(sessionState.sessionId as string).catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [open, sessionState.sessionId, sessionState.votingOpen, syncFacilitationVotes]);

  useEffect(() => {
    if (!open) return;
    const syncPresence = async () => {
      try {
        await Api.toolSessionJoinPresence(toolSessionId, {
          userName: currentUserName,
          cursorState: {
            viewport: viewportTransform,
            spotlightNodeId: sessionState.spotlightNodeId,
            role: sessionState.role,
          },
          activeBlockId: selectedNodeIds[0],
        });
        const presenceRes = await Api.toolSessionListPresence(toolSessionId);
        setPresenceUsers(Array.isArray(presenceRes?.presence) ? presenceRes.presence : []);
      } catch {
        /* best-effort */
      }
    };
    syncPresence();
    const heartbeat = window.setInterval(() => {
      Api.toolSessionHeartbeat(toolSessionId, {
        viewport: viewportTransform,
        spotlightNodeId: sessionState.spotlightNodeId,
        role: sessionState.role,
      }).catch(() => undefined);
      Api.toolSessionListPresence(toolSessionId)
        .then((presenceRes) => {
          setPresenceUsers(Array.isArray(presenceRes?.presence) ? presenceRes.presence : []);
        })
        .catch(() => undefined);
    }, 5000);
    return () => {
      window.clearInterval(heartbeat);
      Api.toolSessionDisconnect(toolSessionId).catch(() => undefined);
    };
  }, [
    currentUserName,
    open,
    selectedNodeIds,
    sessionState.role,
    sessionState.spotlightNodeId,
    toolSessionId,
    viewportTransform,
  ]);

  useEffect(() => {
    if (!open || !sessionState.followMe) return;
    const facilitator = presenceUsers.find((entry) => {
      const role = String((entry.cursorState as Record<string, unknown> | undefined)?.role || '');
      return role === 'facilitator' && String(entry.userId || '') !== currentUserId;
    });
    const viewport = (facilitator?.cursorState as Record<string, unknown> | undefined)?.viewport as
      | { x?: number; y?: number; zoom?: number }
      | undefined;
    if (
      viewport &&
      typeof viewport.x === 'number' &&
      typeof viewport.y === 'number' &&
      typeof viewport.zoom === 'number'
    ) {
      window.dispatchEvent(
        new CustomEvent('idea-whiteboard-navigate', {
          detail: { viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom }, ideaId },
        })
      );
    }
  }, [currentUserId, ideaId, open, presenceUsers, sessionState.followMe]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (detail.ideaId && detail.ideaId !== ideaId) return;
      const outputId = String(detail.outputId || '');
      const target = String(detail.target || '');
      const nodeIds = Array.isArray(detail.nodeIds) ? detail.nodeIds.map(String) : [];
      if (!outputId || nodeIds.length === 0) return;
      const linkedNodes = nodes.filter((node) => nodeIds.includes(node.id));
      linkedNodes.forEach((node) => {
        const semanticType = String(node.data?.semanticType || '') as WhiteboardOutcomeRecord['type'];
        if (
          semanticType === 'cluster' ||
          semanticType === 'theme' ||
          semanticType === 'outcome' ||
          semanticType === 'decision' ||
          semanticType === 'action'
        ) {
          registerOutcomeRecord(
            createOutcomeRecord(semanticType, node, nodeIds, {
              exportedToId: outputId,
              exportedToType: target,
            })
          );
        }
      });
    };
    window.addEventListener('idea-whiteboard-register-output', handler);
    return () => window.removeEventListener('idea-whiteboard-register-output', handler);
  }, [createOutcomeRecord, ideaId, nodes, open, registerOutcomeRecord]);

  // ── Ghost card materialization (idea-workspace-insert) ─────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      const detail = ((e as CustomEvent).detail || {}) as IdeaWorkspaceInsertDetail;
      if (!detail) return;
      if (Array.isArray(detail.items)) {
        for (const item of detail.items) {
          const label = item.text || item.label || '';
          const position = item.position || detail.position;
          addElement('sticky', { label, position, ...(item.data || {}) });
        }
        return;
      }
      const kind = isWbNodeKind(detail.nodeType) ? detail.nodeType : 'sticky';
      const label = detail.label || detail.text || '';
      const color = detail.color;
      addElement(kind, {
        label,
        position: detail.position,
        colorIndex: color ? STICKY_COLORS.findIndex((c) => c.hex === color) : undefined,
      });
    };
    window.addEventListener(IDEA_WORKSPACE_INSERT_EVENT, handler);
    return () => window.removeEventListener(IDEA_WORKSPACE_INSERT_EVENT, handler);
  }, [open, addElement]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (detail.ideaId && detail.ideaId !== ideaId) return;
      const themeId = String(detail.themeId || '');
      if (themeId === 'ops') setBgPattern('grid');
      if (themeId === 'workshop') setBgPattern('dots');
      if (themeId === 'strategy') setBgPattern('lines');
    };
    window.addEventListener(IDEA_WORKSPACE_THEME_EVENT, handler);
    return () => window.removeEventListener(IDEA_WORKSPACE_THEME_EVENT, handler);
  }, [ideaId, open]);

  // ── Scene navigation (idea-whiteboard-navigate) ────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.viewport) return;
      const rfContainer = document.querySelector('.react-flow');
      if (rfContainer) {
        const evt = new CustomEvent('idea-whiteboard-set-viewport', { detail: detail.viewport });
        rfContainer.dispatchEvent(evt);
      }
    };
    window.addEventListener('idea-whiteboard-navigate', handler);
    return () => window.removeEventListener('idea-whiteboard-navigate', handler);
  }, [open]);

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (locked) return;
    try {
      await flushNow(buildPersistPayload(), {
        reason: 'manual',
        createSnapshot: true,
        snapshotLabel: isPl ? 'Whiteboard checkpoint' : 'Whiteboard checkpoint',
      });
      rememberSnapshot(isPl ? 'Ręczny zapis' : 'Manual save');
      toast.success(isPl ? 'Zapisano' : 'Saved', { duration: 900 });
      onSaved?.();
    } catch (err: any) {
      toast.error(err?.message || (isPl ? 'Nie udało się zapisać' : 'Failed to save'));
    }
  }, [buildPersistPayload, flushNow, isPl, locked, onSaved, rememberSnapshot]);

  // ── Align selected nodes ─────────────────────────────────────────────────

  const alignNodes = useCallback(
    (direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
      pushUndoSnapshot();
      setNodes((nds: Node[]) => {
        const selected = nds.filter((n: Node) => n.selected && !isNodeDataLocked(n));
        if (selected.length < 2) return nds;

        const positions = selected.map((n: Node) => n.position);
        let ref: number;

        switch (direction) {
          case 'left':
            ref = Math.min(...positions.map((p) => p.x));
            break;
          case 'right':
            ref = Math.max(...positions.map((p) => p.x));
            break;
          case 'center':
            ref = positions.reduce((s, p) => s + p.x, 0) / positions.length;
            break;
          case 'top':
            ref = Math.min(...positions.map((p) => p.y));
            break;
          case 'bottom':
            ref = Math.max(...positions.map((p) => p.y));
            break;
          case 'middle':
            ref = positions.reduce((s, p) => s + p.y, 0) / positions.length;
            break;
        }

        const ids = new Set(selected.map((n: Node) => n.id));
        return nds.map((n: Node) => {
          if (!ids.has(n.id)) return n;
          const pos = { ...n.position };
          if (['left', 'center', 'right'].includes(direction)) pos.x = ref;
          else pos.y = ref;
          return { ...n, position: pos };
        });
      });
    },
    [pushUndoSnapshot, setNodes]
  );

  // ── Lock selected nodes ─────────────────────────────────────────────────

  const lockSelected = useCallback(() => {
    pushUndoSnapshot();
    setNodes((nds: Node[]) =>
      nds.map((n: Node) =>
        n.selected
          ? {
              ...n,
              draggable: Boolean(n.data?.locked),
              connectable: Boolean(n.data?.locked),
              deletable: Boolean(n.data?.locked),
              data: { ...n.data, locked: !n.data?.locked },
            }
          : n
      )
    );
  }, [pushUndoSnapshot, setNodes]);

  // ── Smart layout ─────────────────────────────────────────────────────────
  const handleLayout = useCallback(
    (algorithm: LayoutAlgorithm) => {
      if (locked) return;
      pushUndoSnapshot();
      const { nodes: laid } = applySmartLayout(nodes, edges, { algorithm, spacing: 200 });
      setNodes(laid);
    },
    [edges, locked, nodes, pushUndoSnapshot, setNodes]
  );

  useEffect(() => {
    if (!open || locked || loading) return;
    if (nodes.length === 0 && edges.length === 0) return;
    queueSync(buildPersistPayload(), { reason: 'draft' });
  }, [buildPersistPayload, loading, locked, nodes.length, edges.length, open, queueSync]);

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

  // ── Focus-mode filtering (nodes + edges) ───────────────────────────────────
  const { nodes: displayNodes, edges: displayEdges } = useMemo(() => {
    const effectiveFocusId =
      focusMode === 'object' && focusObjectId
        ? focusObjectId
        : focusMode == null && drillFocusNodeId
          ? drillFocusNodeId
          : null;

    if (!effectiveFocusId || focusMode === 'system') {
      return { nodes, edges };
    }

    const visibleIds = new Set<string>();
    visibleIds.add(effectiveFocusId);

    const focusNode = nodes.find((n) => n.id === effectiveFocusId);
    const parentId = focusNode
      ? (focusNode as any).parentNode || (focusNode as any).parentId || focusNode.data?.parentId
      : undefined;

    if (parentId) {
      visibleIds.add(parentId);
      for (const n of nodes) {
        const pid = (n as any).parentNode || (n as any).parentId || n.data?.parentId;
        if (pid === parentId) visibleIds.add(n.id);
      }
    } else {
      for (const n of nodes) {
        const pid = (n as any).parentNode || (n as any).parentId || n.data?.parentId;
        if (pid === effectiveFocusId) visibleIds.add(n.id);
      }
    }

    const filteredNodes = nodes.filter((n: Node) => visibleIds.has(n.id));
    const filteredEdges = edges.filter(
      (e: Edge) => visibleIds.has(e.source) && visibleIds.has(e.target)
    );
    return { nodes: filteredNodes, edges: filteredEdges };
  }, [nodes, edges, focusMode, focusObjectId, drillFocusNodeId]);

  const selectedNodes = useMemo(
    () => nodes.filter((node: Node) => node.selected),
    [nodes]
  );
  const canvasNodes = useMemo(
    () =>
      displayNodes.map((node) => ({
        ...node,
        draggable: !locked && !isNodeDataLocked(node),
        connectable: !locked && !isNodeDataLocked(node),
        deletable: !locked && !isNodeDataLocked(node),
      })),
    [displayNodes, locked]
  );
  const selectedCount = selectedNodes.length;
  const hasSelectedFrame = selectedNodes.some(
    (node: Node) => node.type === 'frameNode' || node.type === 'groupNode'
  );

  if (!open) return null;

  return (
    <div
      className="w-full h-full flex flex-col bg-white dark:bg-navy-950"
      role="region"
      aria-label={
        isPl ? 'Tablica idei z elementami swobodnymi' : 'Idea whiteboard with freeform elements'
      }
    >
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-200/60 dark:border-navy-700/60 bg-slate-50/80 dark:bg-navy-900/80 flex-shrink-0 overflow-x-auto">
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mr-1.5 shrink-0">
          {isPl ? 'Tablica' : 'Whiteboard'}
        </div>

        <ToolbarDropdown
          icon={Plus}
          label={isPl ? 'Utwórz' : 'Create'}
          disabled={locked}
          items={[
            ...STICKY_COLORS.map((c, i) => ({
              id: `sticky-${i}`,
              label: isPl ? 'Notatka' : 'Sticky',
              icon: StickyNote,
              swatch: c.hex,
              onClick: () => addElement('sticky', { colorIndex: i }),
            })),
            {
              id: 'text',
              label: isPl ? 'Tekst' : 'Text',
              icon: Type,
              onClick: () => addElement('text'),
            },
            {
              id: 'frame',
              label: isPl ? 'Rama' : 'Frame',
              icon: Frame,
              onClick: () => addElement('frame'),
            },
            {
              id: 'shape',
              label: isPl ? 'Kształt' : 'Shape',
              icon: Shapes,
              onClick: () => addElement('shape_rectangle'),
            },
            {
              id: 'image',
              label: isPl ? 'Obraz' : 'Image',
              icon: ImageIcon,
              onClick: () => addElement('image'),
            },
            {
              id: 'link',
              label: 'Link',
              icon: Link2,
              onClick: () => addElement('link'),
            },
          ]}
          onMainClick={() => addElement('sticky')}
        />
        <ToolbarBtn
          icon={Pen}
          label={whiteboardMode === 'draw' ? (isPl ? 'Canvas' : 'Canvas') : isPl ? 'Rysuj' : 'Draw'}
          onClick={() => setBoardMode(whiteboardMode === 'draw' ? 'board' : 'draw')}
          disabled={locked}
          active={whiteboardMode === 'draw'}
        />
        <ToolbarBtn
          icon={ThumbsUp}
          label={sessionState.votingOpen ? (isPl ? 'Voting on' : 'Voting on') : 'Voting'}
          onClick={toggleSessionVoting}
          disabled={locked}
          active={sessionState.votingOpen}
        />
        <ToolbarBtn
          icon={Workflow}
          label={isPl ? 'Rola' : 'Role'}
          onClick={cycleSessionRole}
          disabled={locked}
        />
        <ToolbarBtn
          icon={TrendingUp}
          label={isPl ? 'Follow' : 'Follow'}
          onClick={toggleSessionFollow}
          disabled={locked}
          active={sessionState.followMe}
        />
        <ToolbarBtn
          icon={ExternalLink}
          label={isPl ? 'Eksport' : 'Export'}
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent('idea-workspace-open-export-menu', { detail: { ideaId } })
            )
          }
        />

        <ToolbarDropdown
          icon={Grid3X3}
          label={isPl ? 'Widok' : 'View'}
          disabled={false}
          items={[
            {
              id: 'dots',
              label: isPl ? 'Kropki' : 'Dots',
              icon: Circle,
              onClick: () => setBgPattern('dots'),
            },
            {
              id: 'grid',
              label: isPl ? 'Siatka' : 'Grid',
              icon: Grid3X3,
              onClick: () => setBgPattern('grid'),
            },
            {
              id: 'lines',
              label: isPl ? 'Linie' : 'Lines',
              icon: LayoutGrid,
              onClick: () => setBgPattern('lines'),
            },
            {
              id: 'blank',
              label: isPl ? 'Puste' : 'Blank',
              icon: Shapes,
              onClick: () => setBgPattern('blank'),
            },
          ]}
          onMainClick={() =>
            setBgPattern(
              bgPattern === 'dots'
                ? 'grid'
                : bgPattern === 'grid'
                  ? 'lines'
                  : bgPattern === 'lines'
                    ? 'blank'
                    : 'dots'
            )
          }
        />

        <div className="px-2 py-1 rounded-xl bg-white/70 dark:bg-navy-800/70 border border-slate-200/60 dark:border-navy-700/60 shrink-0">
          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            {sharePolicy.classification}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">
            {sharePolicy.watermark}
          </div>
        </div>
        <div className="px-2 py-1 rounded-xl bg-white/70 dark:bg-navy-800/70 border border-slate-200/60 dark:border-navy-700/60 shrink-0">
          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            {isPl ? 'Presence' : 'Presence'}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">
            {presenceUsers.length} {isPl ? 'aktywnych' : 'active'}
          </div>
        </div>

        <div className="flex-1" />

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading || locked}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors shrink-0 ${
            saving || loading || locked
              ? 'bg-slate-200/60 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'
              : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
          }`}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? (isPl ? 'Zapisuję…' : 'Saving…') : isPl ? 'Zapisz' : 'Save'}
        </button>
        <span className="text-[11px] text-slate-500 dark:text-slate-400">{saveStatusLabel}</span>
      </div>

      {/* Canvas */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>
      ) : (
        <div className="flex-1 relative">
          <div className="absolute top-3 left-3 z-20 flex flex-col gap-2 max-w-[280px]">
            <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm shadow-lg px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    {isPl ? 'Session layer' : 'Session layer'}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">
                    {sessionState.role === 'facilitator'
                      ? isPl
                        ? 'Facylitator'
                        : 'Facilitator'
                      : sessionState.role === 'participant'
                        ? isPl
                          ? 'Uczestnik'
                          : 'Participant'
                        : isPl
                          ? 'Obserwator'
                          : 'Observer'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                    {whiteboardMode === 'draw' ? (isPl ? 'Draw mode' : 'Draw mode') : 'Board mode'}
                  </div>
                  <div className="text-[9px] text-slate-400 dark:text-slate-500">
                    {sessionState.timerEndsAt
                      ? `${Math.max(0, Math.ceil((sessionState.timerEndsAt - Date.now()) / 1000))}s`
                      : isPl
                        ? 'Timer off'
                        : 'Timer off'}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-navy-800 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                  {sessionState.votingOpen
                    ? isPl
                      ? 'Voting open'
                      : 'Voting open'
                    : isPl
                      ? 'Voting closed'
                      : 'Voting closed'}
                </span>
                <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-navy-800 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                  {sessionState.followMe ? 'Follow-me on' : 'Follow-me off'}
                </span>
                {sessionState.spotlightNodeId && (
                  <span className="px-2 py-1 rounded-full bg-amber-500/10 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                    {isPl ? 'Spotlight aktywny' : 'Spotlight active'}
                  </span>
                )}
              </div>
            </div>

            {(activityLog.length > 0 || libraryItems.length > 0 || historyLog.length > 0) && (
              <div className="rounded-2xl border border-slate-200/60 dark:border-navy-700/60 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm shadow-lg px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    {isPl ? 'Ops + governance' : 'Ops + governance'}
                  </div>
                  <button
                    type="button"
                    onClick={cycleGovernance}
                    className="text-[10px] font-semibold text-primary-600 dark:text-primary-400"
                  >
                    {isPl ? 'Zmień policy' : 'Cycle policy'}
                  </button>
                </div>
                {libraryItems[0] && (
                  <div className="text-[10px] text-slate-600 dark:text-slate-300">
                    {isPl ? 'Biblioteka:' : 'Library:'} {libraryItems[0].name}
                  </div>
                )}
                {historyLog[0] && (
                  <button
                    type="button"
                    onClick={restoreLatestHistory}
                    className="w-full text-left px-2 py-1.5 rounded-xl bg-slate-100/80 dark:bg-navy-800/80 text-[10px] font-medium text-slate-700 dark:text-slate-200"
                  >
                    {isPl ? 'Przywróć:' : 'Restore:'} {historyLog[0].label}
                  </button>
                )}
                {activityLog.slice(0, 3).map((entry) => (
                  <div key={entry.id} className="text-[10px] text-slate-500 dark:text-slate-400">
                    {entry.label}
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedCount > 0 && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg px-2 py-1.5">
              <span className="px-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {isPl
                  ? `${selectedCount} zazn.`
                  : `${selectedCount} selected`}
              </span>
              <ToolbarBtn
                icon={Link2}
                label={isPl ? 'Dołącz' : 'Attach'}
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent('idea-workspace-quick-action', {
                      detail: { action: 'attach_artifact', ideaId },
                    })
                  )
                }
                disabled={locked}
              />
              <ToolbarBtn
                icon={ExternalLink}
                label={isPl ? 'Powiązane' : 'Linked'}
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent('idea-workspace-quick-action', {
                      detail: { action: 'open_linked_artifacts', ideaId },
                    })
                  )
                }
                disabled={false}
              />
              <ToolbarDropdown
                icon={AlignCenter}
                label={isPl ? 'Wyrównaj' : 'Align'}
                disabled={locked || selectedCount < 2}
                items={[
                  {
                    id: 'left',
                    label: isPl ? 'Do lewej' : 'Left',
                    icon: AlignLeft,
                    onClick: () => alignNodes('left'),
                  },
                  {
                    id: 'center',
                    label: isPl ? 'Środek H' : 'Center H',
                    icon: AlignCenter,
                    onClick: () => alignNodes('center'),
                  },
                  {
                    id: 'right',
                    label: isPl ? 'Do prawej' : 'Right',
                    icon: AlignRight,
                    onClick: () => alignNodes('right'),
                  },
                  {
                    id: 'top',
                    label: isPl ? 'Do góry' : 'Top',
                    icon: ArrowUp,
                    onClick: () => alignNodes('top'),
                  },
                  {
                    id: 'middle',
                    label: isPl ? 'Środek V' : 'Middle V',
                    icon: AlignCenter,
                    onClick: () => alignNodes('middle'),
                  },
                  {
                    id: 'bottom',
                    label: isPl ? 'Do dołu' : 'Bottom',
                    icon: ArrowDown,
                    onClick: () => alignNodes('bottom'),
                  },
                ]}
                onMainClick={() => alignNodes('left')}
              />
              <ToolbarDropdown
                icon={ArrowLeftRight}
                label={isPl ? 'Rozłóż' : 'Distribute'}
                disabled={locked || selectedCount < 3}
                items={[
                  {
                    id: 'dist_h',
                    label: isPl ? 'Poziomo' : 'Horizontal',
                    icon: ArrowLeftRight,
                    onClick: () => distributeNodes('horizontal'),
                  },
                  {
                    id: 'dist_v',
                    label: isPl ? 'Pionowo' : 'Vertical',
                    icon: ArrowUpDown,
                    onClick: () => distributeNodes('vertical'),
                  },
                ]}
                onMainClick={() => distributeNodes('horizontal')}
              />
              <ToolbarBtn
                icon={Group}
                label={isPl ? 'Grupuj' : 'Group'}
                onClick={groupSelected}
                disabled={locked || selectedCount < 2}
              />
              <ToolbarBtn
                icon={Ungroup}
                label={isPl ? 'Rozgrupuj' : 'Ungroup'}
                onClick={ungroupSelected}
                disabled={locked || !hasSelectedFrame}
              />
              <ToolbarBtn
                icon={Copy}
                label={isPl ? 'Duplikuj' : 'Duplicate'}
                onClick={duplicateSelected}
                disabled={locked}
              />
              <ToolbarBtn
                icon={Lock}
                label={isPl ? 'Lock' : 'Lock'}
                onClick={() => lockSelected()}
                disabled={locked}
              />
              <ToolbarBtn
                icon={Trash2}
                label={isPl ? 'Usuń' : 'Delete'}
                onClick={deleteSelected}
                disabled={locked}
                danger
              />
            </div>
          )}

          <ReactFlowProvider>
            <WhiteboardCanvas
              nodes={canvasNodes}
              edges={displayEdges}
              locked={locked || whiteboardMode === 'draw'}
              isPolish={isPl}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeDoubleClick={onNodeDetail}
              bgPattern={bgPattern}
              onViewportChange={setViewportTransform}
              onExternalInsert={handleExternalInsert}
              onFullscreenToggle={externalOnFullscreenToggle}
              isFullscreen={externalIsFullscreen}
            />
          </ReactFlowProvider>

          {/* V51-27: Empty state overlay */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="text-center pointer-events-auto">
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-violet-500/10 flex items-center justify-center">
                  <StickyNote size={24} className="text-violet-500" />
                </div>
                <div className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  {isPl ? 'Pusta tablica' : 'Empty whiteboard'}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500 mb-3 max-w-[200px]">
                  {isPl
                    ? 'Dodaj notatki, kształty lub tekst z paska narzędzi'
                    : 'Add sticky notes, shapes, or text from the toolbar'}
                </div>
                {!locked && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        onClick={() => seedQuickStart('brainstorm')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 transition-colors"
                      >
                        <Sparkles size={14} />
                        {isPl ? 'Brainstorm' : 'Brainstorm'}
                      </button>
                      <button
                        onClick={() => seedQuickStart('affinity')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors"
                      >
                        <Layers size={14} />
                        {isPl ? 'Affinity map' : 'Affinity map'}
                      </button>
                      <button
                        onClick={() => seedQuickStart('workshop')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                      >
                        <LayoutGrid size={14} />
                        {isPl ? 'Workshop wall' : 'Workshop wall'}
                      </button>
                    </div>
                    <button
                      onClick={() => addElement('sticky')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 transition-colors"
                    >
                      <Plus size={14} />
                      {isPl ? 'Dodaj pustą notatkę' : 'Add blank sticky'}
                    </button>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 max-w-[260px]">
                      {isPl
                        ? 'Więcej akcji organizacji i AI znajdziesz w panelu Tools po prawej stronie.'
                        : 'More organize and AI actions are available in the Tools panel on the right.'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {outlineImportOpen && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/20 backdrop-blur-[1px]">
              <div className="w-full max-w-lg rounded-2xl border border-slate-200/70 bg-white p-4 shadow-2xl dark:border-navy-700/70 dark:bg-navy-900">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {isPl ? 'Import outline' : 'Import outline'}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {isPl
                    ? 'Wklej punkty, po jednym w linii. Zostaną dodane jako notatki lub krótkie bloki tekstu.'
                    : 'Paste one item per line. They will be added as notes or short text blocks.'}
                </div>
                <textarea
                  value={outlineImportValue}
                  onChange={(event) => setOutlineImportValue(event.target.value)}
                  rows={8}
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary-400 dark:border-navy-700 dark:bg-navy-950 dark:text-slate-100"
                  placeholder={isPl ? 'Punkt 1\nPunkt 2\nPunkt 3' : 'Item 1\nItem 2\nItem 3'}
                />
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOutlineImportOpen(false);
                      setOutlineImportValue('');
                    }}
                    className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-800"
                  >
                    {isPl ? 'Anuluj' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={applyOutlineImport}
                    className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                  >
                    {isPl ? 'Importuj' : 'Import'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Drawing layer overlay */}
          <IdeaDrawingLayer
            active={whiteboardMode === 'draw'}
            onClose={() => setBoardMode('board')}
            paths={drawingPaths}
            onPathsChange={setDrawingPaths}
            viewportTransform={viewportTransform}
          />

          {/* Scenes manager */}
          <IdeaScenesManager
            scenes={scenes}
            onScenesChange={setScenes}
            currentViewport={viewportTransform}
            onNavigateToScene={(viewport) => {
              window.dispatchEvent(
                new CustomEvent('idea-whiteboard-navigate', { detail: { viewport, ideaId } })
              );
            }}
          />

          <CollaborationOverlay
            ideaId={ideaId}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            selectedNodeIds={selectedNodeIds}
          />
        </div>
      )}
    </div>
  );
};

// ── Toolbar helper components ─────────────────────────────────────────────

const ToolbarBtn: React.FC<{
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
}> = ({ icon: Icon, label, onClick, disabled, danger, active }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-40 shrink-0 ${
      danger
        ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
        : active
          ? 'bg-primary-500/10 text-primary-700 dark:text-primary-300'
          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
    }`}
    title={label}
  >
    <Icon size={14} />
    {label && <span className="hidden sm:inline">{label}</span>}
  </button>
);

interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ size?: number }>;
  swatch?: string;
  onClick: () => void;
}

const ToolbarDropdown: React.FC<{
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  disabled?: boolean;
  items: DropdownItem[];
  onMainClick: () => void;
}> = ({ icon: Icon, label, disabled, items, onMainClick }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <div className="flex items-center">
        <button
          type="button"
          onClick={onMainClick}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-l-lg px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-40"
          title={label}
        >
          <Icon size={14} />
          <span className="hidden sm:inline">{label}</span>
        </button>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          disabled={disabled}
          className="inline-flex items-center rounded-r-lg px-0.5 py-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-40"
        >
          <ChevronDown size={10} />
        </button>
      </div>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-lg py-1 min-w-[140px]">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
            >
              {item.swatch && (
                <span
                  className="w-4 h-4 rounded border border-slate-200 dark:border-navy-600 shrink-0"
                  style={{ backgroundColor: item.swatch }}
                />
              )}
              {item.icon && <item.icon size={12} />}
              {item.label && <span>{item.label}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default IdeaWhiteboardTool;
