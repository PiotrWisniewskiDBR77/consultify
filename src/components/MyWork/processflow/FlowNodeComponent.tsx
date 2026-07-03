import {
  ArrowLeftFromLine,
  ArrowRightFromLine,
  Box,
  Building2,
  CircleDot,
  Database,
  Diamond,
  GitMerge,
  ListOrdered,
  ShoppingCart,
  Square,
  StopCircle,
  Triangle,
  Truck,
  Users,
  UserSquare2,
  Zap,
} from 'lucide-react';
import React from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

export type FlowShape =
  | 'start'
  | 'end'
  | 'action'
  | 'decision'
  | 'bpmn_event'
  | 'bpmn_task'
  | 'bpmn_gateway'
  | 'system_service'
  | 'system_db'
  | 'system_actor'
  | 'org_role'
  | 'org_team'
  | 'org_handoff'
  | 'auto_trigger'
  | 'auto_api'
  | 'auto_condition'
  | 'vsm_process'
  | 'vsm_inventory'
  | 'vsm_supplier'
  | 'vsm_customer'
  | 'vsm_kaizen'
  | 'vsm_push_arrow'
  | 'vsm_pull_arrow'
  | 'vsm_supermarket'
  | 'vsm_fifo';

export const LANE_HEIGHT = 140;

// Default lane tint when a node has no assigned lane color.
// Resolved value of the `slate-200` design token (a structural neutral — NOT
// remapped by the HBS palette, so identical to the old literal). Kept in 6-digit
// hex form because lane colors are concatenated with an alpha suffix elsewhere
// (e.g. `${laneColor}08`). SSOT for the token: tailwind.config.js / slate scale.
export const DEFAULT_LANE_COLOR = '#e2e8f0'; // slate-200

export const SHAPE_CONFIG: Record<
  FlowShape,
  { icon: React.ComponentType<{ size?: number }>; label: string; labelPl: string }
> = {
  start: { icon: CircleDot, label: 'Start', labelPl: 'Start' },
  end: { icon: StopCircle, label: 'End', labelPl: 'Koniec' },
  action: { icon: Square, label: 'Action', labelPl: 'Akcja' },
  decision: { icon: Diamond, label: 'Decision', labelPl: 'Decyzja' },
  bpmn_event: { icon: CircleDot, label: 'BPMN Event', labelPl: 'Zdarzenie BPMN' },
  bpmn_task: { icon: Square, label: 'BPMN Task', labelPl: 'Zadanie BPMN' },
  bpmn_gateway: { icon: Diamond, label: 'BPMN Gateway', labelPl: 'Bramka BPMN' },
  system_service: { icon: Box, label: 'Service', labelPl: 'Serwis' },
  system_db: { icon: Database, label: 'Data Store', labelPl: 'Magazyn danych' },
  system_actor: { icon: Users, label: 'Actor', labelPl: 'Aktor' },
  org_role: { icon: UserSquare2, label: 'Role', labelPl: 'Rola' },
  org_team: { icon: Building2, label: 'Team', labelPl: 'Zespół' },
  org_handoff: { icon: GitMerge, label: 'Handoff', labelPl: 'Przekazanie' },
  auto_trigger: { icon: Zap, label: 'Trigger', labelPl: 'Wyzwalacz' },
  auto_api: { icon: GitMerge, label: 'API Call', labelPl: 'Wywołanie API' },
  auto_condition: { icon: Diamond, label: 'Condition', labelPl: 'Warunek' },
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

export const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-slate-300',
  in_progress: 'bg-blue-500',
  done: 'bg-green-500',
  blocked: 'bg-danger-500',
};

export const FlowNodeComponent: React.FC<NodeProps> = ({ id, data, selected }) => {
  const shape: FlowShape = data?.shape || 'action';
  const laneColor: string = data?.laneColor || DEFAULT_LANE_COLOR;
  const isGhost = Boolean(data?._isGhost);
  const [editing, setEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(String(data?.label || ''));
  const [showTooltip, setShowTooltip] = React.useState(false);
  const tooltipTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Context-menu "Edit label" → parent bumps data.editSignal to start inline edit
  // from outside the node (double-click is the only other trigger). Fixes the U8 no-op.
  const editSignalRef = React.useRef(data?.editSignal);
  React.useEffect(() => {
    if (data?.editSignal !== undefined && data.editSignal !== editSignalRef.current) {
      editSignalRef.current = data.editSignal;
      setEditValue(String(data?.label || ''));
      setEditing(true);
    }
  }, [data?.editSignal, data?.label]);

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
    end: 'rounded-full border-2 border-danger-500 bg-danger-50 dark:bg-danger-900/30 dark:border-danger-400',
    action: 'rounded-xl border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800',
    decision:
      'rotate-45 border-2 border-amber-500 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-400',
    bpmn_event:
      'rounded-full border-2 border-sky-500 bg-sky-50 dark:bg-sky-900/30 dark:border-sky-400',
    bpmn_task:
      'rounded-xl border-2 border-sky-600 bg-sky-50 dark:bg-sky-900/30 dark:border-sky-400',
    bpmn_gateway:
      'rotate-45 border-2 border-sky-600 bg-sky-50 dark:bg-sky-900/30 dark:border-sky-400',
    system_service:
      'rounded-xl border-2 border-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400',
    system_db:
      'rounded-2xl border-2 border-blue-700 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400',
    system_actor:
      'rounded-xl border-2 border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-400',
    org_role:
      'rounded-xl border-2 border-primary-600 bg-primary-50 dark:bg-primary-900/30 dark:border-primary-400',
    org_team:
      'rounded-xl border-2 border-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-900/30 dark:border-fuchsia-400',
    org_handoff:
      'rounded-lg border-2 border-primary-700 bg-primary-50 dark:bg-primary-900/30 dark:border-primary-400',
    auto_trigger:
      'rounded-xl border-2 border-dashed border-primary-500 bg-primary-50 dark:bg-primary-900/30 dark:border-primary-400',
    auto_api:
      'rounded-xl border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400',
    auto_condition:
      'rotate-45 border-2 border-dashed border-amber-500 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-400',
    vsm_process:
      'rounded-lg border-2 border-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400',
    vsm_inventory:
      'border-2 border-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-400',
    vsm_supplier:
      'rounded-xl border-2 border-slate-600 bg-slate-50 dark:bg-slate-800 dark:border-slate-400',
    vsm_customer:
      'rounded-xl border-2 border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:border-emerald-400',
    vsm_kaizen:
      'rounded-full border-2 border-danger-500 bg-danger-50 dark:bg-danger-900/30 dark:border-danger-400',
    vsm_push_arrow:
      'rounded-lg border-2 border-amber-500 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-400',
    vsm_pull_arrow:
      'rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400',
    vsm_supermarket:
      'rounded-lg border-2 border-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400',
    vsm_fifo:
      'rounded-lg border-2 border-primary-500 bg-primary-50 dark:bg-primary-900/30 dark:border-primary-400',
  };

  const innerRotate =
    shape === 'decision' || shape === 'auto_condition' || shape === 'bpmn_gateway'
      ? '-rotate-45'
      : '';

  return (
    <div
      className={`relative flex flex-col items-center justify-center min-w-[80px] min-h-[48px] px-3 py-2 shadow-sm transition-shadow ${shapeStyles[shape]} ${selected ? 'ring-2 ring-slate-500/60 dark:ring-white/30' : ''}`}
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
          className={`bg-transparent text-xs font-medium text-slate-800 dark:text-slate-200 text-center outline-none border-b border-slate-400 w-full ${innerRotate}`}
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
            <span className="px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-[8px] font-bold text-primary-700 dark:text-primary-300">
              {data.fteCount} FTE
            </span>
          )}
        </div>
      )}

      {/* Automation mode indicators */}
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

export default FlowNodeComponent;
