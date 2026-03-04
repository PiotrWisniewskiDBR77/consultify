/**
 * IdeaWhiteboardTool — V3 Whiteboard canvas for Idea Workspace.
 *
 * Free-form canvas with sticky notes, text blocks, connectors.
 * Pan/zoom, lasso select, multi-move, grouping.
 * Data lives in shared IdeaWorkspaceGraph (nodes/edges/extensions.whiteboard).
 */
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Circle,
  Diamond,
  Frame,
  Group,
  GitBranch,
  Grid3X3,
  Hexagon,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  Loader2,
  Lock,
  Palette,
  Pen,
  Save,
  Sparkles,
  TrendingUp,
  Workflow,
  Shapes,
  StickyNote,
  Trash2,
  Type,
  Undo2,
  Redo2,
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
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { EMPTY_SELECTION, type CanvasToolType, type IdeaWorkspaceSelection } from './ideaSelectionTypes';
import { IdeaDrawingLayer, type DrawingPath } from './IdeaDrawingLayer';
import { KPIBadgeNode, ProgressNode, ScoreNode } from './IdeaMetricNodes';
import { IdeaScenesManager, type Scene } from './IdeaScenesManager';
import { SummaryCardNode } from './IdeaSummaryCardNode';
import { applySmartLayout, type LayoutAlgorithm } from './layout/IdeaSmartLayout';

import 'reactflow/dist/style.css';

// ── Sticky colors ────────────────────────────────────────────────────────────

const STICKY_COLORS = [
  { bg: 'bg-yellow-100 dark:bg-yellow-900/40', border: 'border-yellow-300 dark:border-yellow-700', hex: '#fef9c3' },
  { bg: 'bg-blue-100 dark:bg-blue-900/40', border: 'border-blue-300 dark:border-blue-700', hex: '#dbeafe' },
  { bg: 'bg-green-100 dark:bg-green-900/40', border: 'border-green-300 dark:border-green-700', hex: '#dcfce7' },
  { bg: 'bg-pink-100 dark:bg-pink-900/40', border: 'border-pink-300 dark:border-pink-700', hex: '#fce7f3' },
  { bg: 'bg-purple-100 dark:bg-purple-900/40', border: 'border-purple-300 dark:border-purple-700', hex: '#f3e8ff' },
  { bg: 'bg-orange-100 dark:bg-orange-900/40', border: 'border-orange-300 dark:border-orange-700', hex: '#ffedd5' },
  { bg: 'bg-teal-100 dark:bg-teal-900/40', border: 'border-teal-300 dark:border-teal-700', hex: '#ccfbf1' },
  { bg: 'bg-rose-100 dark:bg-rose-900/40', border: 'border-rose-300 dark:border-rose-700', hex: '#ffe4e6' },
];

// ── Sticky note sizes ─────────────────────────────────────────────────────────

const STICKY_SIZES: Record<string, { w: number; h: number; textRows: number }> = {
  s: { w: 120, h: 80, textRows: 2 },
  m: { w: 180, h: 100, textRows: 3 },
  l: { w: 240, h: 140, textRows: 5 },
};

// ── Custom nodes ─────────────────────────────────────────────────────────────

const StickyNoteNode: React.FC<NodeProps> = ({ data, selected }) => {
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
  const priorityBorder = priority >= 80 ? 'border-2 border-red-400/70' : priority >= 50 ? 'border-2 border-amber-400/60' : '';

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
            window.dispatchEvent(new CustomEvent('idea-node-open-detail', { detail: { nodeId: data?._nodeId } }));
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
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
          }}
          className="w-full bg-transparent text-xs font-medium text-slate-800 dark:text-slate-200 outline-none resize-none border-b border-primary-400"
          style={{ minHeight: size.h - 40 }}
          rows={size.textRows}
        />
      ) : (
        <div className="text-xs font-medium text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
          {data?.label || ''}
        </div>
      )}
      {data?.author && (
        <div className="absolute bottom-1.5 right-2 text-[8px] text-slate-500 dark:text-slate-400 truncate max-w-[70%] text-right">
          {data.author}
        </div>
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

  React.useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commitEdit = () => {
    setEditing(false);
    if (data?.onLabelChange && editValue !== data?.label) data.onLabelChange(editValue);
  };

  const isDiamond = shape === 'diamond';
  const isCircle = shape === 'circle';

  return (
    <div
      className={`relative flex items-center justify-center transition-shadow ${selected ? 'ring-2 ring-primary-500/60 shadow-lg' : 'shadow-sm'}`}
      style={{
        width: isCircle ? 120 : isDiamond ? 100 : 160,
        height: isCircle ? 120 : isDiamond ? 100 : 80,
        backgroundColor: bgColor,
        borderRadius: isCircle ? '50%' : isDiamond ? 8 : 12,
        transform: isDiamond ? 'rotate(45deg)' : undefined,
        border: '2px solid rgba(0,0,0,0.1)',
      }}
      onDoubleClick={() => { if (!data?.locked) { setEditValue(String(data?.label || '')); setEditing(true); } }}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-slate-400 !-top-1" />
      <div style={{ transform: isDiamond ? 'rotate(-45deg)' : undefined }} className="px-2 text-center w-full">
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
            className="w-full bg-transparent text-[11px] font-medium text-slate-800 text-center outline-none border-b border-primary-400"
          />
        ) : (
          <div className="text-[11px] font-medium text-slate-800 truncate">{data?.label || ''}</div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-slate-400 !-bottom-1" />
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

  React.useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

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
        minHeight: collapsed ? 'auto' : (data?.height || 300),
        backgroundColor: bgColor,
      }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        {!data?.locked && (
          <button
            type="button"
            onClick={toggleCollapse}
            className="flex items-center justify-center w-5 h-5 rounded hover:bg-slate-200/60 dark:hover:bg-navy-700/60 transition-colors shrink-0"
          >
            {collapsed ? <ChevronRight size={12} className="text-slate-500 dark:text-slate-400" /> : <ChevronDown size={12} className="text-slate-500 dark:text-slate-400" />}
          </button>
        )}
        <div
          className="flex-1 cursor-text min-w-0"
          onDoubleClick={() => { if (!data?.locked) { setEditValue(String(data?.label || '')); setEditing(true); } }}
        >
          {editing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
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

  const onResizeStart = React.useCallback((e: React.MouseEvent) => {
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
  }, [nodeWidth, data]);

  return (
    <div
      className={`relative rounded-xl overflow-hidden border border-slate-200 dark:border-navy-700 shadow-sm transition-shadow ${selected ? 'ring-2 ring-primary-500/60 shadow-lg' : ''}`}
      style={{ width: nodeWidth }}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-slate-400 !-top-1" />
      {imgSrc ? (
        <img src={imgSrc} alt={data?.label || 'Image'} className="w-full object-contain" draggable={false} />
      ) : (
        <div className="w-full flex flex-col items-center justify-center bg-slate-100 dark:bg-navy-800 text-slate-400" style={{ height: data?.height || 150 }}>
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
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-slate-400 !-bottom-1" />
    </div>
  );
};

// ── Link Node ─────────────────────────────────────────────────────────────

const LinkNode: React.FC<NodeProps> = ({ data, selected }) => {
  const [meta, setMeta] = React.useState<{ ogTitle?: string; ogDescription?: string; ogImage?: string; favicon?: string }>({});
  const fetched = React.useRef(false);

  React.useEffect(() => {
    if (fetched.current || !data?.url || data?.ogTitle) return;
    fetched.current = true;
    const url = String(data.url);
    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setMeta(d); })
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
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-slate-400 !-bottom-1" />
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
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });
  const [editing, setEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(String(data?.label || ''));
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

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
        strokeDasharray={data?.edgeStyle === 'dashed' ? '8 4' : data?.edgeStyle === 'dotted' ? '2 4' : data?.edgeStyle === 'wavy' ? '6 3 2 3' : undefined}
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
              onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
              className="w-full bg-white dark:bg-navy-800 text-[10px] text-center border border-primary-400 rounded px-1 py-0.5 outline-none"
            />
          ) : (
            <div
              className="text-[10px] text-center text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-navy-900/80 rounded px-1.5 py-0.5 cursor-pointer hover:bg-white dark:hover:bg-navy-800 transition-colors"
              onDoubleClick={() => { setEditValue(String(data?.label || '')); setEditing(true); }}
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
  onNodesChange?: (changes: NodeChange[]) => void;
  onEdgesChange?: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onNodeDoubleClick?: (nodeId: string, nodeData: any) => void;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  bgPattern?: CanvasBgPattern;
  onViewportChange?: (vp: { x: number; y: number; zoom: number }) => void;
}

const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({
  nodes, edges, locked, onNodesChange, onEdgesChange, onConnect, onNodeDoubleClick, setNodes, bgPattern = 'dots', onViewportChange,
}) => {
  const { screenToFlowPosition, setViewport } = useReactFlow();
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const rfEl = containerRef.current?.closest('.react-flow');
    if (!rfEl) return;
    const handler = (e: Event) => {
      const vp = (e as CustomEvent).detail;
      if (vp && typeof vp.x === 'number' && typeof vp.y === 'number' && typeof vp.zoom === 'number') {
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

  const handlePaste = React.useCallback((e: ClipboardEvent) => {
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
          const id = `wb-img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const newNode: Node = {
            id,
            type: 'imageNode',
            position: center,
            data: { src: dataUrl, label: file.name || 'Pasted image', width: 300, locked },
          };
          setNodes((prev: Node[]) => [...prev, newNode]);
        };
        reader.readAsDataURL(file);
        return;
      }
    }

    const text = e.clipboardData?.getData('text/plain')?.trim();
    if (text) {
      e.preventDefault();
      const center = getCenter();
      const id = `wb-paste-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const isUrl = /^https?:\/\//i.test(text);

      if (isUrl) {
        const newNode: Node = {
          id,
          type: 'linkNode',
          position: center,
          data: { label: text, url: text, locked },
        };
        setNodes((prev: Node[]) => [...prev, newNode]);
      } else {
        const newNode: Node = {
          id,
          type: text.length > 100 ? 'textBlock' : 'stickyNote',
          position: center,
          data: { label: text, locked, colorIndex: Math.floor(Math.random() * 6), _isNew: true },
        };
        setNodes((prev: Node[]) => [...prev, newNode]);
      }
    }
  }, [getCenter, locked, setNodes]);

  const handleDrop = React.useCallback((e: React.DragEvent) => {
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
            const newNode: Node = {
              id,
              type: 'imageNode',
              position: { x: pos.x + i * 30, y: pos.y + i * 30 },
              data: { src: dataUrl, label: file.name, width: 250, locked },
            };
            setNodes((prev: Node[]) => [...prev, newNode]);
          };
          reader.readAsDataURL(file);
        } else {
          const newNode: Node = {
            id,
            type: 'linkNode',
            position: { x: pos.x + i * 30, y: pos.y + i * 30 },
            data: { label: file.name, url: '', locked },
          };
          setNodes((prev: Node[]) => [...prev, newNode]);
        }
      }
      return;
    }

    const text = e.dataTransfer.getData('text/plain')?.trim();
    if (text) {
      const id = `wb-drop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const isUrl = /^https?:\/\//i.test(text);
      const newNode: Node = {
        id,
        type: isUrl ? 'linkNode' : 'stickyNote',
        position: pos,
        data: isUrl
          ? { label: text, url: text, locked }
          : { label: text, locked, colorIndex: Math.floor(Math.random() * 6), _isNew: true },
      };
      setNodes((prev: Node[]) => [...prev, newNode]);
    }
  }, [locked, screenToFlowPosition, setNodes]);

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
    <div ref={containerRef} className="w-full h-full" tabIndex={0} onDrop={handleDrop} onDragOver={handleDragOver}>
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
        onMoveEnd={(_event, viewport) => onViewportChange?.(viewport)}
      >
        {bgPattern !== 'blank' && (
          <Background
            gap={bgPattern === 'lines' ? 48 : 24}
            size={bgPattern === 'grid' ? 24 : 1}
            color="rgba(148,163,184,0.12)"
            variant={bgPattern === 'grid' ? 'cross' as any : bgPattern === 'lines' ? 'lines' as any : 'dots' as any}
          />
        )}
        <Controls showInteractive={!locked} />
        <MiniMap
          nodeColor={(n: Node) => {
            if (n.type === 'stickyNote') {
              const idx = (n.data?.colorIndex ?? 0) % STICKY_COLORS.length;
              return STICKY_COLORS[idx].hex;
            }
            if (n.type === 'kpiBadge') {
              const s = n.data?.status;
              return s === 'on_track' ? '#34d399' : s === 'off_track' ? '#f87171' : s === 'at_risk' ? '#fbbf24' : '#94a3b8';
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
      </ReactFlow>
    </div>
  );
};

// ── Main component ───────────────────────────────────────────────────────────

type WbNodeKind = 'sticky' | 'text' | 'group' | 'shape_rectangle' | 'shape_circle' | 'shape_diamond' | 'shape_hexagon' | 'frame' | 'image' | 'link' | 'kpi_badge' | 'score' | 'progress' | 'summary';

interface IdeaWhiteboardToolProps {
  open: boolean;
  ideaId: string;
  locked?: boolean;
  refreshToken?: number;
  onSaved?: () => void;
  onSelectionChange?: (sel: IdeaWorkspaceSelection) => void;
  onNodeDetail?: (nodeId: string, nodeData: any) => void;
  drillFocusNodeId?: string | null;
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
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [drawingActive, setDrawingActive] = useState(false);
  const [drawingPaths, setDrawingPaths] = useState<DrawingPath[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [bgPattern, setBgPattern] = useState<CanvasBgPattern>('dots');
  const [viewportTransform, setViewportTransform] = useState<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 });
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
          },
        });
      }
    },
    [onSelectionChange]
  );

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => {
      const next = applyNodeChanges(changes, nds);
      const hasSelectionChange = changes.some((c: NodeChange) => c.type === 'select');
      if (hasSelectionChange) handleSelectionUpdate(next);
      return next;
    });
  }, [handleSelectionUpdate]);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);
  const [extensions, setExtensions] = useState<Record<string, unknown>>({});

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

  const quickActionRef = useRef<(action: string) => void>(() => {});

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
          const nodeData: Record<string, unknown> = {
            ...(n?.data || { label: '' }),
            locked,
            onLabelChange: (next: string) => {
              setNodes((nds: Node[]) =>
                nds.map((nd: Node) => (nd.id === nid ? { ...nd, data: { ...nd.data, label: next } } : nd))
              );
            },
          };
          if (n?.type === 'frameNode') {
            nodeData.onCollapseToggle = (next: boolean) => {
              setNodes((nds: Node[]) =>
                nds.map((nd: Node) => (nd.id === nid ? { ...nd, data: { ...nd.data, collapsed: next } } : nd))
              );
            };
          }
          return {
            id: nid,
            type: n?.type || 'stickyNote',
            position: n?.position || { x: 100, y: 100 },
            data: nodeData,
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
            type: e?.type || 'labeled',
            animated: Boolean(e?.animated),
            label: e?.label || e?.data?.label || '',
            data: e?.data || {},
          }))
      );
      setExtensions(rawExt);

      const wbExt = rawExt?.whiteboard && typeof rawExt.whiteboard === 'object' ? (rawExt.whiteboard as Record<string, any>) : {};
      if (Array.isArray(wbExt.drawingPaths)) setDrawingPaths(wbExt.drawingPaths);
      if (Array.isArray(wbExt.scenes)) setScenes(wbExt.scenes);
      if (wbExt.bgPattern && ['dots', 'grid', 'lines', 'blank'].includes(wbExt.bgPattern)) {
        setBgPattern(wbExt.bgPattern as CanvasBgPattern);
      }

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
      setNodes([]);
      setEdges([]);
      setExtensions({});
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
      setEdges((eds: Edge[]) => addEdge({ ...connection, type: 'labeled' }, eds));
    },
    [locked, setEdges]
  );

  // ── Add elements ─────────────────────────────────────────────────────────

  const addElement = useCallback(
    (kind: WbNodeKind, extraData?: Record<string, unknown>) => {
      if (locked) return;
      const id = `wb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const offset = nodes.length * 30;

      const typeMap: Record<WbNodeKind, string> = {
        sticky: 'stickyNote',
        text: 'textBlock',
        group: 'groupNode',
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
        locked,
        onLabelChange: (next: string) => {
          setNodes((nds: Node[]) =>
            nds.map((nd: Node) => (nd.id === id ? { ...nd, data: { ...nd.data, label: next } } : nd))
          );
        },
        ...extraData,
      };

      if (kind === 'sticky') nodeData.colorIndex = colorIndex % STICKY_COLORS.length;
      if (shapeMap[kind]) nodeData.shape = shapeMap[kind];
      if (kind === 'frame') {
        nodeData.width = 400;
        nodeData.height = 300;
        nodeData.collapsed = false;
        nodeData.childCount = 0;
        nodeData.onCollapseToggle = (next: boolean) => {
          setNodes((nds: Node[]) =>
            nds.map((nd: Node) => (nd.id === id ? { ...nd, data: { ...nd.data, collapsed: next } } : nd))
          );
        };
      }

      const newNode: Node = {
        id,
        type: typeMap[kind],
        position: { x: 100 + offset, y: 100 + offset },
        data: nodeData,
        ...(kind === 'group' ? { style: { width: 300, height: 200 } } : {}),
        ...(kind === 'frame' ? { style: { width: 400, height: 300 } } : {}),
      };
      setNodes((prev: Node[]) => [...prev, newNode]);
    },
    [isPl, locked, nodes.length, setNodes]
  );

  // ── Quick action listener (after addElement is defined) ─────────────────
  quickActionRef.current = (action: string) => {
    if (action === 'wb_add_sticky') addElement('sticky');
    if (action === 'wb_add_text') addElement('text');
    if (action === 'wb_add_group') addElement('group');
    if (action === 'wb_add_shape_rectangle') addElement('shape_rectangle');
    if (action === 'wb_add_shape_circle') addElement('shape_circle');
    if (action === 'wb_add_shape_diamond') addElement('shape_diamond');
    if (action === 'wb_add_shape_hexagon') addElement('shape_hexagon');
    if (action === 'wb_add_frame') addElement('frame');
    if (action === 'wb_add_image') addElement('image');
    if (action === 'wb_add_link') addElement('link');
    if (action === 'wb_add_kpi') addElement('kpi_badge');
    if (action === 'wb_add_score') addElement('score');
    if (action === 'wb_add_progress') addElement('progress');
    if (action === 'wb_add_summary') addElement('summary');
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.action) quickActionRef.current(detail.action);
    };
    window.addEventListener('idea-workspace-quick-action', handler);
    return () => window.removeEventListener('idea-workspace-quick-action', handler);
  }, [open]);

  // ── Ghost card materialization (idea-workspace-insert) ─────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      if (Array.isArray(detail.items)) {
        for (const item of detail.items) {
          const label = item.text || item.label || '';
          const position = item.position as { x: number; y: number } | undefined;
          addElement('sticky', { label, position });
        }
        return;
      }
      const kind = detail.nodeType || 'sticky';
      const label = detail.label || detail.text || '';
      const color = detail.color;
      addElement(kind, { label, colorIndex: color ? STICKY_COLORS.findIndex((c) => c.hex === color) : undefined });
    };
    window.addEventListener('idea-workspace-insert', handler);
    return () => window.removeEventListener('idea-workspace-insert', handler);
  }, [open, addElement]);

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

  // ── Delete selected ──────────────────────────────────────────────────────

  const deleteSelected = useCallback(() => {
    if (locked) return;
    let removedIds: Set<string>;
    setNodes((prev: Node[]) => {
      removedIds = new Set(prev.filter((n: Node) => n.selected).map((n: Node) => n.id));
      return prev.filter((n: Node) => !n.selected);
    });
    setEdges((prev: Edge[]) =>
      prev.filter((e: Edge) => !e.selected && !removedIds!.has(e.source) && !removedIds!.has(e.target))
    );
  }, [locked, setEdges, setNodes]);

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (locked) return;
    setSaving(true);
    try {
      const nextExt = {
        ...extensions,
        whiteboard: {
          ...(extensions?.whiteboard && typeof extensions.whiteboard === 'object' ? extensions.whiteboard : {}),
          viewState: { snap: false, showGrid: true },
          drawingPaths,
          scenes,
          bgPattern,
        },
      };
      await Api.saveMyIdeaMap(ideaId, {
        nodes: nodes as any,
        edges: edges as any,
        preferredTool: 'whiteboard' as CanvasToolType,
        extensions: nextExt,
      });
      toast.success(isPl ? 'Zapisano' : 'Saved', { duration: 900 });
      onSaved?.();
    } catch (err: any) {
      toast.error(err?.message || (isPl ? 'Nie udało się zapisać' : 'Failed to save'));
    } finally {
      setSaving(false);
    }
  }, [edges, extensions, ideaId, isPl, locked, nodes, onSaved]);

  // ── Align selected nodes ─────────────────────────────────────────────────

  const alignNodes = useCallback((direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    setNodes((nds: Node[]) => {
      const selected = nds.filter((n: Node) => n.selected);
      if (selected.length < 2) return nds;

      const positions = selected.map((n: Node) => n.position);
      let ref: number;

      switch (direction) {
        case 'left': ref = Math.min(...positions.map((p) => p.x)); break;
        case 'right': ref = Math.max(...positions.map((p) => p.x)); break;
        case 'center': ref = positions.reduce((s, p) => s + p.x, 0) / positions.length; break;
        case 'top': ref = Math.min(...positions.map((p) => p.y)); break;
        case 'bottom': ref = Math.max(...positions.map((p) => p.y)); break;
        case 'middle': ref = positions.reduce((s, p) => s + p.y, 0) / positions.length; break;
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
  }, [setNodes]);

  // ── Lock selected nodes ─────────────────────────────────────────────────

  const lockSelected = useCallback(() => {
    setNodes((nds: Node[]) =>
      nds.map((n: Node) =>
        n.selected ? { ...n, data: { ...n.data, locked: !n.data?.locked } } : n
      )
    );
  }, [setNodes]);

  // ── Smart layout ─────────────────────────────────────────────────────────
  const handleLayout = useCallback((algorithm: LayoutAlgorithm) => {
    if (locked) return;
    const { nodes: laid } = applySmartLayout(nodes, edges, { algorithm, spacing: 200 });
    setNodes(laid);
  }, [edges, locked, nodes, setNodes]);

  // ── Auto-save (debounced, 3s after last change) ──────────────────────────

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  useEffect(() => {
    if (!open || locked || loading) return;
    if (nodes.length === 0 && edges.length === 0) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      const nextExt = {
        ...extensions,
        whiteboard: {
          ...(extensions?.whiteboard && typeof extensions.whiteboard === 'object' ? extensions.whiteboard : {}),
          viewState: { snap: false, showGrid: true },
          drawingPaths,
          scenes,
          bgPattern,
        },
      };
      Api.saveMyIdeaMap(ideaId, {
        nodes: nodesRef.current as any,
        edges: edgesRef.current as any,
        preferredTool: 'whiteboard' as CanvasToolType,
        extensions: nextExt,
      }).catch(() => undefined);
    }, 3000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, open, locked, loading, ideaId]);

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
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-200/60 dark:border-navy-700/60 bg-slate-50/80 dark:bg-navy-900/80 flex-shrink-0 overflow-x-auto">
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mr-1.5 shrink-0">
          {isPl ? 'Tablica' : 'Whiteboard'}
        </div>

        {/* Sticky with color dropdown */}
        <ToolbarDropdown
          icon={StickyNote}
          label={isPl ? 'Notatka' : 'Sticky'}
          disabled={locked}
          items={STICKY_COLORS.map((c, i) => ({
            id: `sticky-${i}`,
            label: '',
            swatch: c.hex,
            onClick: () => addElement('sticky', { colorIndex: i }),
          }))}
          onMainClick={() => addElement('sticky')}
        />

        {/* Shape dropdown */}
        <ToolbarDropdown
          icon={Shapes}
          label={isPl ? 'Kształt' : 'Shape'}
          disabled={locked}
          items={[
            { id: 'rect', label: isPl ? 'Prostokąt' : 'Rectangle', icon: Shapes, onClick: () => addElement('shape_rectangle') },
            { id: 'circle', label: isPl ? 'Koło' : 'Circle', icon: Circle, onClick: () => addElement('shape_circle') },
            { id: 'diamond', label: isPl ? 'Romb' : 'Diamond', icon: Diamond, onClick: () => addElement('shape_diamond') },
            { id: 'hexagon', label: isPl ? 'Sześciokąt' : 'Hexagon', icon: Hexagon, onClick: () => addElement('shape_hexagon') },
          ]}
          onMainClick={() => addElement('shape_rectangle')}
        />

        <ToolbarBtn icon={Type} label={isPl ? 'Tekst' : 'Text'} onClick={() => addElement('text')} disabled={locked} />
        <ToolbarBtn icon={Frame} label={isPl ? 'Rama' : 'Frame'} onClick={() => addElement('frame')} disabled={locked} />
        <ToolbarBtn icon={ImageIcon} label={isPl ? 'Obraz' : 'Image'} onClick={() => addElement('image')} disabled={locked} />
        <ToolbarBtn icon={Link2} label="Link" onClick={() => addElement('link')} disabled={locked} />

        {/* Metrics dropdown */}
        <ToolbarDropdown
          icon={TrendingUp}
          label={isPl ? 'Metryki' : 'Metrics'}
          disabled={locked}
          items={[
            { id: 'kpi', label: 'KPI Badge', icon: TrendingUp, onClick: () => addElement('kpi_badge') },
            { id: 'score', label: isPl ? 'Wynik' : 'Score', icon: Circle, onClick: () => addElement('score') },
            { id: 'progress', label: isPl ? 'Postęp' : 'Progress', icon: LayoutGrid, onClick: () => addElement('progress') },
            { id: 'summary', label: isPl ? 'Podsumowanie' : 'Summary', icon: Sparkles, onClick: () => addElement('summary') },
          ]}
          onMainClick={() => addElement('kpi_badge')}
        />

        <div className="w-px h-5 bg-slate-200 dark:bg-navy-700 mx-0.5 shrink-0" />

        {/* Align dropdown */}
        <ToolbarDropdown
          icon={AlignCenter}
          label={isPl ? 'Wyrównaj' : 'Align'}
          disabled={locked}
          items={[
            { id: 'left', label: isPl ? 'Do lewej' : 'Left', icon: AlignLeft, onClick: () => alignNodes('left') },
            { id: 'center', label: isPl ? 'Środek H' : 'Center H', icon: AlignCenter, onClick: () => alignNodes('center') },
            { id: 'right', label: isPl ? 'Do prawej' : 'Right', icon: AlignRight, onClick: () => alignNodes('right') },
            { id: 'top', label: isPl ? 'Do góry' : 'Top', icon: ArrowUp, onClick: () => alignNodes('top') },
            { id: 'middle', label: isPl ? 'Środek V' : 'Middle V', icon: AlignCenter, onClick: () => alignNodes('middle') },
            { id: 'bottom', label: isPl ? 'Do dołu' : 'Bottom', icon: ArrowDown, onClick: () => alignNodes('bottom') },
          ]}
          onMainClick={() => alignNodes('left')}
        />

        {/* Layout dropdown */}
        <ToolbarDropdown
          icon={LayoutGrid}
          label="Layout"
          disabled={locked}
          items={[
            { id: 'auto', label: 'Auto', icon: LayoutGrid, onClick: () => handleLayout('auto') },
            { id: 'tree', label: isPl ? 'Drzewo' : 'Tree', icon: GitBranch, onClick: () => handleLayout('tree') },
            { id: 'radial', label: isPl ? 'Promieniowy' : 'Radial', icon: Circle, onClick: () => handleLayout('radial') },
            { id: 'force', label: isPl ? 'Siłowy' : 'Force', icon: Workflow, onClick: () => handleLayout('force') },
            { id: 'grid', label: isPl ? 'Siatka' : 'Grid', icon: Grid3X3, onClick: () => handleLayout('grid') },
            { id: 'horizontal', label: isPl ? 'Poziomy' : 'Horizontal', icon: LayoutGrid, onClick: () => handleLayout('horizontal') },
          ]}
          onMainClick={() => handleLayout('auto')}
        />

        <ToolbarBtn icon={Lock} label={isPl ? 'Zablokuj' : 'Lock'} onClick={() => lockSelected()} disabled={locked} />
        <ToolbarBtn icon={Pen} label={isPl ? 'Rysuj' : 'Draw'} onClick={() => setDrawingActive(!drawingActive)} disabled={locked} />

        {/* Background pattern */}
        <ToolbarDropdown
          icon={Grid3X3}
          label={isPl ? 'Tło' : 'Background'}
          disabled={false}
          items={[
            { id: 'dots', label: isPl ? 'Kropki' : 'Dots', icon: Circle, onClick: () => setBgPattern('dots') },
            { id: 'grid', label: isPl ? 'Siatka' : 'Grid', icon: Grid3X3, onClick: () => setBgPattern('grid') },
            { id: 'lines', label: isPl ? 'Linie' : 'Lines', icon: LayoutGrid, onClick: () => setBgPattern('lines') },
            { id: 'blank', label: isPl ? 'Puste' : 'Blank', icon: Shapes, onClick: () => setBgPattern('blank') },
          ]}
          onMainClick={() => setBgPattern(bgPattern === 'dots' ? 'grid' : bgPattern === 'grid' ? 'lines' : bgPattern === 'lines' ? 'blank' : 'dots')}
        />

        <ToolbarBtn icon={Trash2} label="" onClick={deleteSelected} disabled={locked} danger />

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
      </div>

      {/* Canvas */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>
      ) : (
        <div className="flex-1 relative">
          <ReactFlowProvider>
            <WhiteboardCanvas
              nodes={drillFocusNodeId ? nodes.filter((n: Node) => {
                if (n.id === drillFocusNodeId) return true;
                const pid = (n as any).parentNode || (n as any).parentId || n.data?.parentId;
                return pid === drillFocusNodeId;
              }) : nodes}
              edges={drillFocusNodeId ? edges.filter((e: Edge) => {
                const visibleIds = new Set(nodes.filter((n: Node) => {
                  if (n.id === drillFocusNodeId) return true;
                  const pid = (n as any).parentNode || (n as any).parentId || n.data?.parentId;
                  return pid === drillFocusNodeId;
                }).map((n: Node) => n.id));
                return visibleIds.has(e.source) && visibleIds.has(e.target);
              }) : edges}
              locked={locked || drawingActive}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeDoubleClick={onNodeDetail}
              setNodes={setNodes}
              bgPattern={bgPattern}
              onViewportChange={setViewportTransform}
            />
          </ReactFlowProvider>

          {/* Drawing layer overlay */}
          <IdeaDrawingLayer
            active={drawingActive}
            onClose={() => setDrawingActive(false)}
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
}> = ({ icon: Icon, label, onClick, disabled, danger }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-40 shrink-0 ${
      danger
        ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
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
              onClick={() => { item.onClick(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
            >
              {item.swatch && (
                <span className="w-4 h-4 rounded border border-slate-200 dark:border-navy-600 shrink-0" style={{ backgroundColor: item.swatch }} />
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
