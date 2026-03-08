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

// @ts-ignore — getSmoothStepPath is exported at runtime but types re-export may not resolve
import { getSmoothStepPath } from '@reactflow/core';
import * as dagre from 'dagre';
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowLeftFromLine,
  ArrowRightFromLine,
  BarChart3,
  Bot,
  Box,
  CheckCircle,
  CircleDot,
  Copy,
  Diamond,
  GitMerge,
  LayoutGrid,
  Lightbulb,
  ListOrdered,
  Loader2,
  Palette,
  Plus,
  Redo2,
  Save,
  ShoppingCart,
  Square,
  StopCircle,
  Trash2,
  Triangle,
  Truck,
  Undo2,
  Users,
  X,
  Zap,
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
  Controls,
  type Edge,
  type EdgeChange,
  type EdgeProps,
  Handle,
  MiniMap,
  type Node,
  type NodeChange,
  type NodeProps,
  Position,
  ReactFlowProvider,
} from 'reactflow';

import { Api } from '@/services/api';
import { generateProcessSummary, runProcessCoach } from '@/services/ideaAIGenerator';

import {
  type CanvasToolType,
  EMPTY_SELECTION,
  type IdeaWorkspaceSelection,
} from './ideaSelectionTypes';
import { ProcessKPIDashboard } from './ProcessKPIDashboard';
import { vsmNodeTypes } from './VSMNodeComponent';
import { VSMTimelineBar } from './VSMTimelineBar';

// ── Lane helpers ─────────────────────────────────────────────────────────────

type Lane = {
  id: string;
  label: string;
  color: string;
};

const LANE_COLORS = [
  '#e0e7ff',
  '#dbeafe',
  '#d1fae5',
  '#fef3c7',
  '#fce7f3',
  '#ede9fe',
  '#ccfbf1',
  '#fecaca',
  '#e2e8f0',
  '#c7d2fe',
];

const LANE_HEIGHT = 140;

const DEFAULT_LANES: Lane[] = [{ id: 'lane-1', label: 'Lane 1', color: LANE_COLORS[0] }];

// ── V5-IDEA-21: Process Flow modes ──────────────────────────────────────────
export type ProcessFlowMode = 'classic' | 'automation' | 'vsm';

export const FLOW_MODE_LABELS: Record<ProcessFlowMode, { en: string; pl: string }> = {
  classic: { en: 'Classic Flow', pl: 'Klasyczny przepływ' },
  automation: { en: 'Automation', pl: 'Automatyzacja' },
  vsm: { en: 'Value Stream', pl: 'Strumień wartości' },
};

// ── Shape types ──────────────────────────────────────────────────────────────

type FlowShape =
  | 'start'
  | 'end'
  | 'action'
  | 'decision'
  | 'vsm_process'
  | 'vsm_inventory'
  | 'vsm_supplier'
  | 'vsm_customer'
  | 'vsm_kaizen'
  | 'vsm_push_arrow'
  | 'vsm_pull_arrow'
  | 'vsm_supermarket'
  | 'vsm_fifo';

const SHAPE_CONFIG: Record<
  FlowShape,
  { icon: React.ComponentType<{ size?: number }>; label: string; labelPl: string }
> = {
  start: { icon: CircleDot, label: 'Start', labelPl: 'Start' },
  end: { icon: StopCircle, label: 'End', labelPl: 'Koniec' },
  action: { icon: Square, label: 'Action', labelPl: 'Akcja' },
  decision: { icon: Diamond, label: 'Decision', labelPl: 'Decyzja' },
  vsm_process: { icon: Box, label: 'VSM Process', labelPl: 'Proces VSM' },
  vsm_inventory: { icon: Triangle, label: 'Inventory', labelPl: 'Zapas' },
  vsm_supplier: { icon: Truck, label: 'Supplier', labelPl: 'Dostawca' },
  vsm_customer: { icon: Users, label: 'Customer', labelPl: 'Klient' },
  vsm_kaizen: { icon: Zap, label: 'Kaizen', labelPl: 'Kaizen' },
  vsm_push_arrow: { icon: ArrowRightFromLine, label: 'Push Arrow', labelPl: 'Strzałka Push' },
  vsm_pull_arrow: { icon: ArrowLeftFromLine, label: 'Pull Arrow', labelPl: 'Strzałka Pull' },
  vsm_supermarket: { icon: ShoppingCart, label: 'Supermarket', labelPl: 'Supermarket' },
  vsm_fifo: { icon: ListOrdered, label: 'FIFO Lane', labelPl: 'Kolejka FIFO' },
};

const CLASSIC_SHAPES: FlowShape[] = ['start', 'end', 'action', 'decision'];
const AUTOMATION_SHAPES: FlowShape[] = ['start', 'end', 'action', 'decision'];
const VSM_SHAPES: FlowShape[] = [
  'vsm_process',
  'vsm_inventory',
  'vsm_supplier',
  'vsm_customer',
  'vsm_kaizen',
  'vsm_push_arrow',
  'vsm_pull_arrow',
  'vsm_supermarket',
  'vsm_fifo',
];

const SHAPES_BY_MODE: Record<ProcessFlowMode, FlowShape[]> = {
  classic: CLASSIC_SHAPES,
  automation: AUTOMATION_SHAPES,
  vsm: VSM_SHAPES,
};

// ── Custom node component ────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-slate-300',
  in_progress: 'bg-blue-500',
  done: 'bg-green-500',
  blocked: 'bg-red-500',
};

const FlowNodeComponent: React.FC<NodeProps> = ({ id, data, selected }) => {
  const shape: FlowShape = data?.shape || 'action';
  const laneColor: string = data?.laneColor || '#e2e8f0';
  const isGhost = Boolean(data?._isGhost);
  const [editing, setEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(String(data?.label || ''));
  const [showTooltip, setShowTooltip] = React.useState(false);
  const tooltipTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const hasMetrics =
    data?.duration || data?.cost || data?.fteCount || (data?.status && data.status !== 'todo');
  const hasAttachments = data?.attachments?.length > 0;

  const shapeStyles: Record<FlowShape, string> = {
    start:
      'rounded-full border-2 border-green-500 bg-green-50 dark:bg-green-900/30 dark:border-green-400',
    end: 'rounded-full border-2 border-red-500 bg-red-50 dark:bg-red-900/30 dark:border-red-400',
    action: 'rounded-xl border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800',
    decision:
      'rotate-45 border-2 border-amber-500 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-400',
    vsm_process:
      'rounded-lg border-2 border-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400',
    vsm_inventory:
      'border-2 border-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-400',
    vsm_supplier:
      'rounded-xl border-2 border-slate-600 bg-slate-50 dark:bg-slate-800 dark:border-slate-400',
    vsm_customer:
      'rounded-xl border-2 border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:border-emerald-400',
    vsm_kaizen:
      'rounded-full border-2 border-red-500 bg-red-50 dark:bg-red-900/30 dark:border-red-400',
    vsm_push_arrow:
      'rounded-lg border-2 border-orange-500 bg-orange-50 dark:bg-orange-900/30 dark:border-orange-400',
    vsm_pull_arrow:
      'rounded-lg border-2 border-teal-500 bg-teal-50 dark:bg-teal-900/30 dark:border-teal-400',
    vsm_supermarket:
      'rounded-lg border-2 border-cyan-600 bg-cyan-50 dark:bg-cyan-900/30 dark:border-cyan-400',
    vsm_fifo:
      'rounded-lg border-2 border-violet-500 bg-violet-50 dark:bg-violet-900/30 dark:border-violet-400',
  };

  const innerRotate = shape === 'decision' ? '-rotate-45' : '';

  return (
    <div
      className={`relative flex flex-col items-center justify-center min-w-[80px] min-h-[48px] px-3 py-2 shadow-sm transition-shadow ${shapeStyles[shape]} ${selected ? 'ring-2 ring-primary-500/60' : ''}`}
      style={{
        borderLeftColor: laneColor,
        borderLeftWidth: shape === 'action' ? 4 : undefined,
        backgroundColor: shape === 'action' ? `${laneColor}08` : undefined,
      }}
      onDoubleClick={() => {
        if (isGhost) return;
        if (!data?.locked && data?.onNodeDetail) {
          data.onNodeDetail(id, data);
        } else if (!data?.locked) {
          setEditValue(String(data?.label || ''));
          setEditing(true);
        }
      }}
      onMouseEnter={() => {
        tooltipTimer.current = setTimeout(() => setShowTooltip(true), 400);
      }}
      onMouseLeave={() => {
        if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
        setShowTooltip(false);
      }}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-slate-400" />

      {/* Status dot */}
      {data?.status && data.status !== 'todo' && !isGhost && (
        <div
          className={`absolute top-1 right-1 w-2 h-2 rounded-full ${STATUS_COLORS[data.status] || STATUS_COLORS.todo}`}
        />
      )}

      {/* Attachment badge */}
      {hasAttachments && !isGhost && (
        <div className="absolute top-1 left-1 flex items-center gap-0.5 px-1 py-0.5 rounded bg-slate-100/80 dark:bg-navy-700/80 text-[7px] font-bold text-slate-500 dark:text-slate-400">
          📎 {data.attachments.length}
        </div>
      )}

      {/* Ghost node Accept button */}
      {isGhost && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            data?.onAcceptGhost?.(id);
          }}
          className="absolute -top-2 -right-2 z-10 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md hover:bg-emerald-600 transition-colors text-[10px] font-bold"
          title="Accept"
        >
          +
        </button>
      )}

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
        <div
          className={`text-xs font-medium text-slate-800 dark:text-slate-200 text-center ${innerRotate}`}
        >
          {data?.label || shape}
        </div>
      )}

      {/* Metrics badges */}
      {hasMetrics && shape !== 'decision' && !isGhost && (
        <div className={`flex items-center gap-1 mt-1 ${innerRotate}`}>
          {data?.duration && (
            <span className="px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-[8px] font-bold text-blue-700 dark:text-blue-300">
              {data.duration}
              {data.durationUnit || 'h'}
            </span>
          )}
          {data?.cost && (
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-[8px] font-bold text-emerald-700 dark:text-emerald-300">
              ${data.cost}
            </span>
          )}
          {data?.fteCount && (
            <span className="px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-[8px] font-bold text-violet-700 dark:text-violet-300">
              {data.fteCount} FTE
            </span>
          )}
        </div>
      )}

      {/* V5-IDEA-22: Automation mode indicators */}
      {data?.automationCandidate && !isGhost && (
        <div
          className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black ${
            data.automationPotential === 'high'
              ? 'bg-emerald-500 text-white'
              : data.automationPotential === 'medium'
                ? 'bg-amber-500 text-white'
                : 'bg-slate-400 text-white'
          }`}
          title={`Automation: ${data.automationPotential || 'low'}`}
        >
          A
        </div>
      )}
      {data?.savingsEstimate && !isGhost && (
        <div
          className={`px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-[7px] font-bold text-emerald-700 dark:text-emerald-300 mt-0.5 ${innerRotate}`}
        >
          {data.savingsEstimate}
        </div>
      )}

      {/* VSM-specific data fields */}
      {shape === 'vsm_process' &&
        (data?.cycleTime || data?.changeoverTime || data?.uptimePercent) && (
          <div
            className={`text-[8px] text-slate-500 dark:text-slate-400 mt-1 space-y-0.5 ${innerRotate}`}
          >
            {data.cycleTime && <div>C/T: {data.cycleTime}</div>}
            {data.changeoverTime && <div>C/O: {data.changeoverTime}</div>}
            {data.uptimePercent != null && <div>Up: {data.uptimePercent}%</div>}
            {data.operators != null && <div>Ops: {data.operators}</div>}
          </div>
        )}
      {shape === 'vsm_inventory' && data?.inventory != null && (
        <div
          className={`text-[8px] font-bold text-amber-600 dark:text-amber-400 mt-0.5 ${innerRotate}`}
        >
          {data.inventory} pcs
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-slate-400" />

      {/* Context tooltip on hover */}
      {showTooltip && !editing && !isGhost && (data?.owner || data?.description || hasMetrics) && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-50 pointer-events-none">
          <div className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg px-2.5 py-1.5 shadow-lg text-[9px] max-w-[200px] whitespace-normal">
            {data?.owner && (
              <div>
                <span className="font-bold">Owner:</span> {data.owner}
              </div>
            )}
            {data?.duration && (
              <div>
                <span className="font-bold">Duration:</span> {data.duration}
                {data.durationUnit || 'h'}
              </div>
            )}
            {data?.cost && (
              <div>
                <span className="font-bold">Cost:</span> ${data.cost}
              </div>
            )}
            {data?.status && data.status !== 'todo' && (
              <div>
                <span className="font-bold">Status:</span> {data.status.replace('_', ' ')}
              </div>
            )}
            {data?.description && (
              <div className="mt-0.5 opacity-80 line-clamp-2">{data.description}</div>
            )}
            {hasAttachments && (
              <div className="mt-0.5 opacity-60">{data.attachments.length} attachment(s)</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Custom edge component with inline label editing ──────────────────────────

const CONDITION_TYPES = ['', 'yes', 'no', 'default', 'exception'] as const;

const FlowEdgeComponent: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  label,
  selected,
  style,
}) => {
  const [editing, setEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(String(label || data?.label || ''));
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const commitEdit = () => {
    setEditing(false);
    if (data?.onLabelChange) data.onLabelChange(id, editValue);
  };

  const conditionType = data?.conditionType || '';
  const conditionColor =
    conditionType === 'yes'
      ? '#22c55e'
      : conditionType === 'no'
        ? '#ef4444'
        : conditionType === 'exception'
          ? '#f59e0b'
          : undefined;
  const edgeStroke = conditionColor || data?.sourceLaneColor || style?.stroke;

  // V5-IDEA-44: Living edge behavior
  const baseW = selected ? 2.5 : 1.5;

  return (
    <g className="group/flowedge">
      <style>{`@keyframes flowEdgeDash { to { stroke-dashoffset: -12; } }`}</style>
      {/* Invisible wide hit area */}
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={14} />
      {/* Selection pulse */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke={edgeStroke || '#94a3b8'}
          strokeWidth={baseW + 4}
          strokeOpacity={0.12}
          strokeLinecap="round"
          className="animate-pulse"
        />
      )}
      <path
        id={id}
        className="react-flow__edge-path transition-all duration-200"
        d={edgePath}
        style={{ ...style, stroke: edgeStroke, strokeWidth: baseW }}
      />
      <path
        d={edgePath}
        fill="none"
        strokeDasharray="8 4"
        stroke={edgeStroke || '#94a3b8'}
        strokeWidth={baseW}
        strokeOpacity={selected ? 0.55 : 0.45}
        style={{ animation: 'flowEdgeDash 0.6s linear infinite' }}
      />
      {/* Directional particle on selected edge */}
      {selected && (
        <circle r="3" fill={edgeStroke || '#94a3b8'} opacity={0.7}>
          <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
      <foreignObject
        x={labelX - 50}
        y={labelY - 12}
        width={100}
        height={24}
        requiredExtensions="http://www.w3.org/1999/xhtml"
      >
        {editing ? (
          <div className="flex items-center gap-0.5">
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="w-full text-[9px] font-medium text-center bg-white dark:bg-navy-800 border border-primary-400 rounded px-1 outline-none"
            />
            <select
              value={conditionType}
              onChange={(e) => {
                if (data?.onConditionChange) data.onConditionChange(id, e.target.value);
              }}
              className="text-[8px] bg-white dark:bg-navy-800 border border-slate-300 rounded"
            >
              {CONDITION_TYPES.map((ct) => (
                <option key={ct} value={ct}>
                  {ct || '—'}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div
            className="text-[9px] font-medium text-slate-600 dark:text-slate-300 text-center cursor-pointer hover:text-primary-600 truncate"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditValue(String(label || data?.label || ''));
              setEditing(true);
            }}
          >
            {label || data?.label || ''}
          </div>
        )}
      </foreignObject>
    </g>
  );
};

type RFNodeTypes = Record<string, React.ComponentType<NodeProps<any>>>;
type RFEdgeTypes = Record<string, React.ComponentType<EdgeProps<any>>>;

const baseNodeTypes: RFNodeTypes = {
  flowNode: FlowNodeComponent,
};

const edgeTypes: RFEdgeTypes = {
  flowEdge: FlowEdgeComponent,
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

  // V5-IDEA-23: VSM-specific validation
  const vsmNodes = nodes.filter(
    (n: Node) => n.data?.shape?.startsWith('vsm_') || n.type?.startsWith('vsm_')
  );
  if (vsmNodes.length > 0) {
    const hasSupplier = vsmNodes.some(
      (n) => n.data?.shape === 'vsm_supplier' || n.type === 'vsm_supplier'
    );
    const hasCustomer = vsmNodes.some(
      (n) => n.data?.shape === 'vsm_customer' || n.type === 'vsm_customer'
    );
    const hasProcess = vsmNodes.some(
      (n) => n.data?.shape === 'vsm_process' || n.type === 'vsm_process'
    );

    if (!hasSupplier) {
      warnings.push({
        id: 'vsm-no-supplier',
        message: 'VSM: Missing Supplier node',
        messagePl: 'VSM: Brak węzła Dostawca',
      });
    }
    if (!hasCustomer) {
      warnings.push({
        id: 'vsm-no-customer',
        message: 'VSM: Missing Customer node',
        messagePl: 'VSM: Brak węzła Klient',
      });
    }
    if (!hasProcess) {
      warnings.push({
        id: 'vsm-no-process',
        message: 'VSM: Missing Process node',
        messagePl: 'VSM: Brak węzła Proces',
      });
    }

    const processNodes = vsmNodes.filter(
      (n) => n.data?.shape === 'vsm_process' || n.type === 'vsm_process'
    );
    for (const pn of processNodes) {
      if (!pn.data?.cycleTime) {
        warnings.push({
          id: `vsm-no-ct-${pn.id}`,
          message: `VSM: "${pn.data?.label || pn.id}" missing Cycle Time`,
          messagePl: `VSM: "${pn.data?.label || pn.id}" brak Czasu Cyklu`,
        });
      }
    }
  }

  return warnings;
}

// ── Lane background with editable label + delete + color picker ──────────────

const LaneBackground: React.FC<{
  lane: Lane;
  idx: number;
  locked: boolean;
  onRename: (id: string, next: string) => void;
  onDelete?: (id: string) => void;
  onColorChange?: (id: string, color: string) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  isFirst?: boolean;
  isLast?: boolean;
  laneCount: number;
}> = ({
  lane,
  idx,
  locked,
  onRename,
  onDelete,
  onColorChange,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  laneCount,
}) => {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(lane.label);
  const [showColorPicker, setShowColorPicker] = React.useState(false);
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
      style={{ top: idx * LANE_HEIGHT, height: LANE_HEIGHT, background: `${lane.color}15` }}
    >
      <div className="absolute left-2 top-1 z-10 flex items-center gap-1">
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
            className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-navy-800/80 rounded px-1 outline-none border border-primary-400"
          />
        ) : (
          <div
            className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 select-none cursor-pointer hover:text-slate-700 dark:hover:text-slate-200"
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

        {!locked && (
          <div
            className="flex items-center gap-0.5 opacity-0 hover:opacity-100 transition-opacity group-hover:opacity-100"
            style={{ opacity: undefined }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.opacity = '0';
            }}
          >
            {!isFirst && (
              <button
                onClick={() => onMoveUp?.(lane.id)}
                className="p-0.5 rounded hover:bg-white/60 dark:hover:bg-navy-700/60"
                title="Move up"
              >
                <ArrowDownUp size={9} className="text-slate-400 rotate-180" />
              </button>
            )}
            {!isLast && (
              <button
                onClick={() => onMoveDown?.(lane.id)}
                className="p-0.5 rounded hover:bg-white/60 dark:hover:bg-navy-700/60"
                title="Move down"
              >
                <ArrowDownUp size={9} className="text-slate-400" />
              </button>
            )}
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="p-0.5 rounded hover:bg-white/60 dark:hover:bg-navy-700/60"
              title="Change color"
            >
              <Palette size={9} className="text-slate-400" />
            </button>
            {laneCount > 1 && (
              <button
                onClick={() => onDelete?.(lane.id)}
                className="p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                title="Delete lane"
              >
                <X size={9} className="text-red-400" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Color picker popover */}
      {showColorPicker && !locked && (
        <div className="absolute left-2 top-5 z-20 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg p-1.5 shadow-lg flex flex-wrap gap-1 w-[120px]">
          {LANE_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                onColorChange?.(lane.id, c);
                setShowColorPicker(false);
              }}
              className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${c === lane.color ? 'border-primary-500 scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Undo/Redo types ──────────────────────────────────────────────────────────

interface UndoEntry {
  nodes: Node[];
  edges: Edge[];
  lanes: Lane[];
}

const MAX_UNDO_STEPS = 30;

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
}

export const IdeaProcessFlowTool: React.FC<IdeaProcessFlowToolProps> = ({
  open,
  ideaId,
  locked = false,
  refreshToken,
  onSaved,
  onSelectionChange,
  onNodeDetail,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [lanes, setLanes] = useState<Lane[]>(DEFAULT_LANES);
  const [extensions, setExtensions] = useState<Record<string, unknown>>({});
  const [warnings, setWarnings] = useState<ValidationWarning[]>([]);
  const [showWarnings, setShowWarnings] = useState(false);
  const [coachInsights, setCoachInsights] = useState<any[]>([]);
  const [showCoach, setShowCoach] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);
  const [ghostNodes, setGhostNodes] = useState<Node[]>([]);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showKPIDashboard, setShowKPIDashboard] = useState(false);
  const [dragOverLaneId, setDragOverLaneId] = useState<string | null>(null);

  // V5-IDEA-21: Flow mode
  const [flowMode, setFlowMode] = useState<ProcessFlowMode>('classic');
  const availableShapes = SHAPES_BY_MODE[flowMode];

  // V5-IDEA-23: Dynamic node types — use rich VSM nodes in VSM mode
  const nodeTypes = useMemo<RFNodeTypes>(
    () => (flowMode === 'vsm' ? { ...baseNodeTypes, ...vsmNodeTypes } : baseNodeTypes),
    [flowMode]
  );

  const didPersistRef = useRef(false);
  const quickActionRef = useRef<(action: string) => void>(() => {});

  // ── Undo/Redo ──────────────────────────────────────────────────────────
  const undoStackRef = useRef<UndoEntry[]>([]);
  const redoStackRef = useRef<UndoEntry[]>([]);
  const [undoRedoTick, setUndoRedoTick] = useState(0);

  const pushUndo = useCallback(() => {
    undoStackRef.current.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      lanes: JSON.parse(JSON.stringify(lanes)),
    });
    if (undoStackRef.current.length > MAX_UNDO_STEPS) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
    setUndoRedoTick((v) => v + 1);
  }, [nodes, edges, lanes]);

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const entry = undoStackRef.current.pop()!;
    redoStackRef.current.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      lanes: JSON.parse(JSON.stringify(lanes)),
    });
    setNodes(entry.nodes);
    setEdges(entry.edges);
    setLanes(entry.lanes);
    setUndoRedoTick((v) => v + 1);
  }, [nodes, edges, lanes]);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const entry = redoStackRef.current.pop()!;
    undoStackRef.current.push({
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      lanes: JSON.parse(JSON.stringify(lanes)),
    });
    setNodes(entry.nodes);
    setEdges(entry.edges);
    setLanes(entry.lanes);
    setUndoRedoTick((v) => v + 1);
  }, [nodes, edges, lanes]);

  const canUndo = undoStackRef.current.length > 0;
  const canRedo = redoStackRef.current.length > 0;

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
      pushUndo();
      setEdges((eds) =>
        eds.map((e) =>
          e.id === edgeId ? { ...e, label: newLabel, data: { ...e.data, label: newLabel } } : e
        )
      );
    },
    [pushUndo]
  );

  const handleEdgeConditionChange = useCallback(
    (edgeId: string, conditionType: string) => {
      pushUndo();
      setEdges((eds) =>
        eds.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data, conditionType } } : e))
      );
    },
    [pushUndo]
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
            onLabelChange: handleEdgeLabelChange,
            onConditionChange: handleEdgeConditionChange,
          },
        };
      }),
    [edges, nodeMap, handleEdgeLabelChange, handleEdgeConditionChange]
  );

  // ── Node/Edge change handlers ──────────────────────────────────────────
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
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
          return updated;
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
    [handleSelectionUpdate, lanes]
  );

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  // ── Hydrate ────────────────────────────────────────────────────────────

  const hydrate = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const res = await Api.getMyIdeaMap(ideaId, { language: i18n.language });
      const map = res?.map || {};
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

      undoStackRef.current = [];
      redoStackRef.current = [];
      setUndoRedoTick(0);

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
      setNodes([]);
      setEdges([]);
      setExtensions({});
      setLanes(DEFAULT_LANES);
    } finally {
      setLoading(false);
    }
  }, [i18n.language, ideaId, isPl, locked, open, setEdges, setNodes]);

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
      setEdges((eds: Edge[]) =>
        addEdge(
          {
            ...connection,
            type: 'flowEdge',
            animated: false,
            data: {},
          },
          eds
        )
      );
    },
    [locked, pushUndo, setEdges]
  );

  // ── Add node ───────────────────────────────────────────────────────────

  const addNode = useCallback(
    (shape: FlowShape) => {
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
          onNodeDetail: onNodeDetail || undefined,
        },
      };
      setNodes((prev: Node[]) => [...prev, newNode]);

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
    [edges, i18n.language, ideaId, isPl, lanes, locked, nodes, pushUndo, setNodes]
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

    const newNode: Node = {
      id: newId,
      type: 'flowNode',
      position: { x: midX, y: midY },
      data: {
        label: isPl ? 'Nowy krok' : 'New step',
        shape: 'action' as FlowShape,
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

    setNodes((prev: Node[]) => [...prev, newNode]);
    setEdges((prev: Edge[]) => {
      const filtered = prev.filter((e) => e.id !== selectedEdge.id);
      return [
        ...filtered,
        { ...selectedEdge, id: `e-${selectedEdge.source}-${newId}`, target: newId },
        {
          id: `e-${newId}-${selectedEdge.target}`,
          source: newId,
          target: selectedEdge.target,
          type: 'flowEdge',
          data: {},
        },
      ];
    });
    toast.success(isPl ? 'Wstawiono krok' : 'Step inserted', { duration: 800 });
  }, [edges, isPl, lanes, locked, nodes, onNodeDetail, pushUndo, setEdges, setNodes]);

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

    const newNode: Node = {
      id: newId,
      type: 'flowNode',
      position: { x: selected.position.x + 250, y: selected.position.y + 80 },
      data: {
        label: isPl ? 'Alternatywna ścieżka' : 'Alternative path',
        shape: 'action' as FlowShape,
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

    setNodes((prev: Node[]) => [...prev, newNode]);
    setEdges((prev: Edge[]) => [
      ...prev,
      {
        id: `e-${selected.id}-${newId}`,
        source: selected.id,
        target: newId,
        type: 'flowEdge',
        data: { conditionType: 'no' },
        label: 'No',
      },
    ]);
    toast.success(isPl ? 'Ścieżka rozdzielona' : 'Path split', { duration: 800 });
  }, [isPl, lanes, locked, nodes, onNodeDetail, pushUndo, setEdges, setNodes]);

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
    setLanes((prev: Lane[]) => [...prev, newLane]);
  }, [lanes.length, locked, pushUndo]);

  // ── Quick action listener ──────────────────────────────────────────────
  quickActionRef.current = (action: string) => {
    if (action === 'pf_add_action') addNode('action');
    if (action === 'pf_add_decision') addNode('decision');
    if (action === 'pf_add_start') addNode('start');
    if (action === 'pf_add_end') addNode('end');
    if (action === 'pf_add_lane') addLane();
    if (action === 'pf_insert_between') insertBetween();
    if (action === 'pf_split_path') splitPath();
    if (action === 'pf_mode_classic') setFlowMode('classic');
    if (action === 'pf_mode_automation') setFlowMode('automation');
    if (action === 'pf_mode_vsm') setFlowMode('vsm');

    // V5-IDEA-23: VSM quick actions
    if (action === 'pf_add_vsm_process') addNode('vsm_process');
    if (action === 'pf_add_vsm_inventory') addNode('vsm_inventory');
    if (action === 'pf_add_vsm_supplier') addNode('vsm_supplier');
    if (action === 'pf_add_vsm_customer') addNode('vsm_customer');
    if (action === 'pf_add_vsm_kaizen') addNode('vsm_kaizen');

    // V5-IDEA-22: Automation mode actions
    if (action === 'pf_mark_automation') {
      setNodes((nds: Node[]) =>
        nds.map((n: Node) =>
          n.selected
            ? {
                ...n,
                data: {
                  ...n.data,
                  automationCandidate: !n.data?.automationCandidate,
                  automationPotential: n.data?.automationCandidate ? undefined : 'medium',
                },
              }
            : n
        )
      );
    }
    if (action === 'pf_add_metrics') {
      const selected = nodes.find((n: Node) => n.selected);
      if (selected) {
        const duration = window.prompt(isPl ? 'Czas trwania (np. 2h):' : 'Duration (e.g. 2h):');
        if (duration) {
          setNodes((nds: Node[]) =>
            nds.map((n: Node) =>
              n.id === selected.id ? { ...n, data: { ...n.data, duration } } : n
            )
          );
        }
      }
    }
    if (action === 'pf_savings_analysis') {
      window.dispatchEvent(
        new CustomEvent('idea-workspace-chat-prompt', {
          detail: {
            prompt: isPl
              ? 'Przeanalizuj przepływ procesu i zidentyfikuj potencjał automatyzacji. Dla każdego kroku oceń: czas, koszt, potencjał automatyzacji (wysoki/średni/niski), szacowane oszczędności.'
              : 'Analyze the process flow and identify automation potential. For each step evaluate: time, cost, automation potential (high/medium/low), estimated savings.',
            ideaId,
          },
        })
      );
    }
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

  // ── Delete selected ────────────────────────────────────────────────────

  const deleteSelected = useCallback(() => {
    if (locked) return;
    pushUndo();
    let removedNodeIds: Set<string>;
    setNodes((prev: Node[]) => {
      removedNodeIds = new Set(prev.filter((n: Node) => n.selected).map((n: Node) => n.id));
      return prev.filter((n: Node) => !n.selected);
    });
    setEdges((prev: Edge[]) =>
      prev.filter(
        (e: Edge) => !e.selected && !removedNodeIds!.has(e.source) && !removedNodeIds!.has(e.target)
      )
    );
  }, [locked, pushUndo, setEdges, setNodes]);

  // ── Duplicate selected ─────────────────────────────────────────────────

  const duplicateSelected = useCallback(() => {
    if (locked) return;
    pushUndo();
    const selected = nodes.filter((n) => n.selected);
    if (selected.length === 0) return;

    const newNodes: Node[] = selected.map((n) => {
      const newId = `pf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      return {
        ...n,
        id: newId,
        position: { x: n.position.x + 40, y: n.position.y + 40 },
        selected: false,
        data: {
          ...n.data,
          onLabelChange: (next: string) => {
            setNodes((nds: Node[]) =>
              nds.map((nd: Node) =>
                nd.id === newId ? { ...nd, data: { ...nd.data, label: next } } : nd
              )
            );
          },
          onNodeDetail: onNodeDetail || undefined,
        },
      };
    });
    setNodes((prev) => [...prev, ...newNodes]);
  }, [locked, nodes, pushUndo, setNodes]);

  // ── Lane management ────────────────────────────────────────────────────

  const handleLaneRename = useCallback(
    (laneId: string, next: string) => {
      if (locked) return;
      pushUndo();
      setLanes((prev: Lane[]) =>
        prev.map((l: Lane) => (l.id === laneId ? { ...l, label: next } : l))
      );
    },
    [locked, pushUndo]
  );

  const handleLaneDelete = useCallback(
    (laneId: string) => {
      if (locked || lanes.length <= 1) return;
      pushUndo();
      const fallbackLane = lanes.find((l) => l.id !== laneId) || lanes[0];
      setNodes((prev) =>
        prev.map((n) =>
          n.data?.laneId === laneId
            ? { ...n, data: { ...n.data, laneId: fallbackLane.id, laneColor: fallbackLane.color } }
            : n
        )
      );
      setLanes((prev) => prev.filter((l) => l.id !== laneId));
    },
    [locked, lanes, pushUndo]
  );

  const handleLaneColorChange = useCallback(
    (laneId: string, color: string) => {
      if (locked) return;
      pushUndo();
      setLanes((prev) => prev.map((l) => (l.id === laneId ? { ...l, color } : l)));
      setNodes((prev) =>
        prev.map((n) =>
          n.data?.laneId === laneId ? { ...n, data: { ...n.data, laneColor: color } } : n
        )
      );
    },
    [locked, pushUndo]
  );

  const handleLaneMoveUp = useCallback(
    (laneId: string) => {
      if (locked) return;
      pushUndo();
      setLanes((prev) => {
        const idx = prev.findIndex((l) => l.id === laneId);
        if (idx <= 0) return prev;
        const next = [...prev];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        return next;
      });
    },
    [locked, pushUndo]
  );

  const handleLaneMoveDown = useCallback(
    (laneId: string) => {
      if (locked) return;
      pushUndo();
      setLanes((prev) => {
        const idx = prev.findIndex((l) => l.id === laneId);
        if (idx < 0 || idx >= prev.length - 1) return prev;
        const next = [...prev];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        return next;
      });
    },
    [locked, pushUndo]
  );

  // ── Validate ───────────────────────────────────────────────────────────

  const runValidation = useCallback(() => {
    const w = validateFlow(nodes, edges);
    setWarnings(w);
    setShowWarnings(true);
  }, [edges, nodes]);

  // ── Auto-layout ────────────────────────────────────────────────────────

  const handleAutoLayout = useCallback(() => {
    if (locked || nodes.length === 0) return;
    pushUndo();
    const layouted = autoLayout(nodes, edges, lanes);
    setNodes(layouted);
    toast.success(isPl ? 'Układ automatyczny zastosowany' : 'Auto-layout applied', {
      duration: 900,
    });
  }, [edges, isPl, lanes, locked, nodes, pushUndo]);

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
      toast.success(isPl ? 'Krok zaakceptowany' : 'Step accepted', { duration: 800 });
    },
    [ghostNodes, isPl, locked, onNodeDetail, pushUndo, setNodes]
  );

  // ── Save ───────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (locked) return;
    setSaving(true);
    try {
      const nextExt = {
        ...extensions,
        processFlow: {
          ...(extensions?.processFlow && typeof extensions.processFlow === 'object'
            ? extensions.processFlow
            : {}),
          lanes,
          flowMode,
          viewState: { layoutMode: 'horizontal', showGrid: true, snap: true },
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

  // ── Lane backgrounds ──────────────────────────────────────────────────

  const laneBackgrounds = useMemo(
    () =>
      lanes.map((lane, idx) => (
        <LaneBackground
          key={lane.id}
          lane={lane}
          idx={idx}
          locked={locked}
          onRename={handleLaneRename}
          onDelete={handleLaneDelete}
          onColorChange={handleLaneColorChange}
          onMoveUp={handleLaneMoveUp}
          onMoveDown={handleLaneMoveDown}
          isFirst={idx === 0}
          isLast={idx === lanes.length - 1}
          laneCount={lanes.length}
        />
      )),
    [
      handleLaneColorChange,
      handleLaneDelete,
      handleLaneMoveDown,
      handleLaneMoveUp,
      handleLaneRename,
      lanes,
      locked,
    ]
  );

  // ── Keyboard shortcuts ─────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const isInput =
        (e.target as HTMLElement)?.tagName === 'INPUT' ||
        (e.target as HTMLElement)?.tagName === 'TEXTAREA' ||
        (e.target as HTMLElement)?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        redo();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        duplicateSelected();
        return;
      }

      if (isInput) return;

      if (e.key === 'Escape') {
        setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
        setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
        onSelectionChange?.(EMPTY_SELECTION);
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        addNode('action');
        return;
      }

      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        addNode('decision');
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [addNode, duplicateSelected, handleSave, onSelectionChange, open, redo, undo]);

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

  if (!open) return null;

  return (
    <div
      className="w-full h-full flex flex-col bg-white dark:bg-navy-950"
      role="region"
      aria-label={isPl ? 'Edytor przepływu procesu' : 'Process flow editor'}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200/60 dark:border-navy-700/60 bg-slate-50/80 dark:bg-navy-900/80 flex-shrink-0 overflow-x-auto">
        {/* V5-IDEA-21: Mode selector */}
        <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-navy-800 rounded-lg p-0.5 mr-1 shrink-0">
          {(['classic', 'automation', 'vsm'] as ProcessFlowMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFlowMode(mode)}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                flowMode === mode
                  ? 'bg-white dark:bg-navy-700 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {isPl ? FLOW_MODE_LABELS[mode].pl : FLOW_MODE_LABELS[mode].en}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {availableShapes.map((shape) => {
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

        {/* V5-IDEA-21: Insert between & Split path */}
        <button
          type="button"
          onClick={insertBetween}
          disabled={locked}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-40"
          title={isPl ? 'Wstaw krok między' : 'Insert between'}
        >
          <Plus size={14} />
          {isPl ? 'Wstaw' : 'Insert'}
        </button>
        <button
          type="button"
          onClick={splitPath}
          disabled={locked}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-40"
          title={isPl ? 'Rozdziel ścieżkę' : 'Split path'}
        >
          <GitMerge size={14} />
          {isPl ? 'Rozdziel' : 'Split'}
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

        <button
          type="button"
          onClick={duplicateSelected}
          disabled={locked}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-40"
          title={isPl ? 'Duplikuj (Ctrl+D)' : 'Duplicate (Ctrl+D)'}
        >
          <Copy size={14} />
        </button>

        <div className="w-px h-5 bg-slate-200 dark:bg-navy-700 mx-1" />

        {/* Undo/Redo */}
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo || locked}
          className="inline-flex items-center rounded-lg px-1.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-30"
          title={isPl ? 'Cofnij (Ctrl+Z)' : 'Undo (Ctrl+Z)'}
        >
          <Undo2 size={14} />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo || locked}
          className="inline-flex items-center rounded-lg px-1.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-30"
          title={isPl ? 'Ponów (Ctrl+Shift+Z)' : 'Redo (Ctrl+Shift+Z)'}
        >
          <Redo2 size={14} />
        </button>

        {/* Auto-layout */}
        <button
          type="button"
          onClick={handleAutoLayout}
          disabled={locked || nodes.length === 0}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-40"
          title={isPl ? 'Auto układ' : 'Auto arrange'}
        >
          <LayoutGrid size={14} />
          {isPl ? 'Auto' : 'Auto'}
        </button>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setShowKPIDashboard((v) => !v)}
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
            showKPIDashboard
              ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
          }`}
          title={isPl ? 'KPI Dashboard' : 'KPI Dashboard'}
        >
          <BarChart3 size={14} />
          KPI
        </button>

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
          onClick={handleAICoach}
          disabled={locked || nodes.length < 2 || coachLoading}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors disabled:opacity-40"
          title={isPl ? 'AI Coach' : 'AI Coach'}
        >
          {coachLoading ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
          {isPl ? 'AI Coach' : 'AI Coach'}
        </button>

        <button
          type="button"
          onClick={handleProcessSummary}
          disabled={locked || nodes.length < 2 || summaryLoading}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-40"
          title={isPl ? 'Podsumowanie' : 'Summary'}
        >
          {summaryLoading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <BarChart3 size={14} />
          )}
          {isPl ? 'Podsumuj' : 'Summary'}
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
              <Bot size={14} />
              {isPl ? 'AI Coach — Analiza procesu' : 'AI Coach — Process Analysis'}
            </div>
            <button
              type="button"
              onClick={() => setShowCoach(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X size={14} />
            </button>
          </div>
          <ul className="space-y-1.5">
            {coachInsights.map((insight: any, idx: number) => (
              <li key={idx} className="flex items-start gap-2 text-[11px]">
                <span
                  className={`mt-0.5 flex-shrink-0 ${insight.type === 'bottleneck' ? 'text-red-500' : insight.type === 'improvement' ? 'text-emerald-500' : 'text-indigo-500'}`}
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
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
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
              <div className="text-[9px] font-bold text-red-600 dark:text-red-400 mb-0.5">
                {isPl ? 'Ryzyka:' : 'Risks:'}
              </div>
              <ul className="space-y-0.5">
                {summaryData.risks.map((r: string, i: number) => (
                  <li
                    key={i}
                    className="text-[9px] text-red-600/80 dark:text-red-400/80 flex items-start gap-1"
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
          <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>
      ) : (
        <div className="flex-1 relative">
          <div className="absolute inset-0">
            {laneBackgrounds}
            {/* Drag-over lane highlight */}
            {dragOverLaneId && (
              <div
                className="absolute left-0 right-0 pointer-events-none border-2 border-primary-400/40 rounded-lg"
                style={{
                  top: lanes.findIndex((l) => l.id === dragOverLaneId) * LANE_HEIGHT,
                  height: LANE_HEIGHT,
                  background: 'rgba(99, 102, 241, 0.05)',
                }}
              />
            )}
          </div>
          <ReactFlowProvider>
            <ReactFlow
              nodes={[
                ...nodes,
                ...ghostNodes.map((g) => ({
                  ...g,
                  style: { opacity: 0.4 },
                  data: { ...g.data, onAcceptGhost: acceptGhostNode },
                })),
              ]}
              edges={edgesWithHandlers}
              onNodesChange={locked ? undefined : onNodesChange}
              onEdgesChange={locked ? undefined : onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              deleteKeyCode={locked ? null : 'Delete'}
              className="bg-transparent"
              defaultEdgeOptions={{ type: 'flowEdge', animated: false }}
            >
              <Background gap={20} size={1} color="rgba(148,163,184,0.15)" />
              <Controls showInteractive={!locked} />
              <MiniMap
                nodeStrokeWidth={3}
                zoomable
                pannable
                className="!bg-white/80 dark:!bg-navy-900/80 !border-slate-200/60 dark:!border-navy-700/60"
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
        </div>
      )}
    </div>
  );
};

export default IdeaProcessFlowTool;
