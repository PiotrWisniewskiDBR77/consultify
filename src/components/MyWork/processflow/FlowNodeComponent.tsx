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
import { useTranslation } from 'react-i18next';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

import {
  canvasObjectSurfaceStyle,
  canvasObjectTextStyle,
  canvasShapeClasses,
  readCanvasObjectStyle,
} from '../canvas/canvasObjectStyle';

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

/** Kształty z palety wspólnej paska edycji — patrz `canvas/canvasObjectStyle`. */
const CANVAS_SHAPE_KEYS = new Set(['rounded', 'rect', 'pill', 'circle', 'diamond', 'hexagon']);

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
  todo: 'bg-c-border-strong',
  in_progress: 'bg-c-info',
  done: 'bg-success-500',
  blocked: 'bg-danger-500',
};

// Z17 (Fala 3): magnetic 4-side handles — Lucidchart-style connector parity.
// Shared class: dots are invisible by default and fade in only on node hover
// or while a connection is actively being dragged (see IdeaProcessFlowTool's
// `pf-connecting` wrapper class, toggled from onConnectStart/onConnectEnd).
// Interactivity (pointer-events) is left to react-flow's own
// `connectionindicator` class so locked/read-only canvases stay non-connectable.
// Z23 (Fala 7): exported so every BPMN node variant (ActivityNode,
// BPMNStartNode, BPMNEndNode, GatewayNode, SubprocessNode, DataObjectNode,
// PoolNode) can reuse the exact same handle look — one visual source of
// truth, no per-variant drift.
export const HANDLE_CLASS =
  '!w-2.5 !h-2.5 !bg-c-border-strong !border !border-c-bg opacity-0 group-hover:opacity-100 transition-opacity duration-150';

export const FlowNodeComponent: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { t } = useTranslation();
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
      'rounded-full border-2 border-success-500 bg-success-50 dark:bg-success-900/30 dark:border-success-400',
    end: 'rounded-full border-2 border-danger-500 bg-danger-50 dark:bg-danger-900/30 dark:border-danger-400',
    action: 'rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface',
    // Category node types — shape/border-radius only. Border + soft fill come
    // from the identity token map (SHAPE_TOKENS) applied via inline color-mix,
    // so no forbidden alpha on c-* utilities. Blue-first categorical palette.
    decision: 'rotate-45 border-2',
    bpmn_event: 'rounded-full border-2',
    bpmn_task: 'rounded-xl border-2',
    bpmn_gateway: 'rotate-45 border-2',
    system_service: 'rounded-xl border-2',
    system_db: 'rounded-2xl border-2',
    system_actor: 'rounded-xl border-2',
    org_role: 'rounded-xl border-2',
    org_team: 'rounded-xl border-2',
    org_handoff: 'rounded-lg border-2',
    auto_trigger: 'rounded-xl border-2 border-dashed',
    auto_api: 'rounded-xl border-2',
    auto_condition: 'rotate-45 border-2 border-dashed',
    vsm_process: 'rounded-lg border-2',
    vsm_inventory: 'border-2',
    vsm_supplier: 'rounded-xl border-2 border-c-border-strong bg-c-surface-raised',
    vsm_customer: 'rounded-xl border-2',
    vsm_kaizen: 'rounded-full border-2',
    vsm_push_arrow: 'rounded-lg border-2',
    vsm_pull_arrow: 'rounded-lg border-2',
    vsm_supermarket: 'rounded-lg border-2',
    vsm_fifo: 'rounded-lg border-2',
  };

  // Identity token per shape (CSS var name). Categorical, blue-first; explicit
  // semantics kept for decision (warning) and kaizen (danger).
  const SHAPE_TOKENS: Partial<Record<FlowShape, string>> = {
    decision: '--c-warning',
    bpmn_event: '--c-tag-1',
    bpmn_task: '--c-tag-1',
    bpmn_gateway: '--c-tag-1',
    system_service: '--c-tag-10',
    system_db: '--c-tag-10',
    system_actor: '--c-tag-2',
    org_role: '--c-tag-3',
    org_team: '--c-tag-4',
    org_handoff: '--c-tag-11',
    auto_trigger: '--c-tag-3',
    auto_api: '--c-tag-10',
    auto_condition: '--c-warning',
    vsm_process: '--c-tag-10',
    vsm_inventory: '--c-warning',
    vsm_customer: '--c-success',
    vsm_kaizen: '--c-danger',
    vsm_push_arrow: '--c-warning',
    vsm_pull_arrow: '--c-tag-10',
    vsm_supermarket: '--c-tag-10',
    vsm_fifo: '--c-tag-3',
  };
  const shapeToken = SHAPE_TOKENS[shape];

  // ── PASEK EDYCJI OBIEKTU (ff_canvasObjectEditBar) ────────────────────────
  // NOWA ZDOLNOŚĆ, nie przeniesienie: do tej pory wygląd węzła Procesu brał się
  // WYŁĄCZNIE z `shape` i koloru toru — `node.data` nie niosło ani tła, ani
  // ramki, ani typografii, więc właściciel „nie mógł zmienić czcionek, kolorów
  // typu, koloru tła, kształtów obiektów".
  const objectStyle = readCanvasObjectStyle(data);
  const objectSurface = canvasObjectSurfaceStyle(objectStyle, { bgOpacityPct: 16 });
  const objectText = canvasObjectTextStyle(objectStyle);
  // Kształt z palety (`rounded/rect/pill/circle/diamond/hexagon`) ma
  // pierwszeństwo nad kształtem WYNIKAJĄCYM Z TYPU kroku (action/decision/BPMN),
  // ale tylko wtedy, gdy właściciel jawnie go wybrał — inaczej diagram BPMN
  // straciłby swoją semantykę kształtów.
  const overrideShape = objectStyle.shape && CANVAS_SHAPE_KEYS.has(objectStyle.shape);
  const overrideShapeClasses = overrideShape ? canvasShapeClasses(objectStyle.shape) : null;

  const innerRotate = overrideShapeClasses
    ? overrideShapeClasses.inner
    : shape === 'decision' || shape === 'auto_condition' || shape === 'bpmn_gateway'
      ? '-rotate-45'
      : '';

  return (
    <div
      className={`group relative flex flex-col items-center justify-center min-w-[80px] min-h-[48px] px-3 py-2 shadow-sm transition-shadow ${
        overrideShapeClasses ? `border-2 ${overrideShapeClasses.box}` : shapeStyles[shape]
      } ${selected ? 'ring-2 ring-c-border-strong' : ''}`}
      style={{
        borderLeftColor: laneColor,
        borderLeftWidth: shape === 'action' ? 4 : undefined,
        backgroundColor:
          shape === 'action'
            ? `${laneColor}08`
            : shapeToken
              ? `color-mix(in srgb, var(${shapeToken}) 12%, transparent)`
              : undefined,
        borderColor: shapeToken ? `var(${shapeToken})` : undefined,
        // Wybór właściciela na końcu — bije kolor toru i token kształtu.
        ...(objectSurface || {}),
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
      {/* Z17 (Fala 3): 4-side magnetic handles (Lucidchart parity). The two
          UNNAMED handles below (Left/target, Right/source further down) are
          kept id-less on purpose — old persisted edges have no
          sourceHandle/targetHandle and react-flow resolves an undefined
          handle id to the sole id-less handle of that type on the node, so
          this is what keeps every pre-Z17 edge rendering unchanged. All new
          handles get an explicit id so they never collide with that
          fallback. */}
      <Handle type="target" position={Position.Left} className={HANDLE_CLASS} />
      <Handle type="source" id="left" position={Position.Left} className={HANDLE_CLASS} />
      <Handle type="target" id="top" position={Position.Top} className={HANDLE_CLASS} />
      <Handle type="source" id="top-source" position={Position.Top} className={HANDLE_CLASS} />
      <Handle type="target" id="bottom" position={Position.Bottom} className={HANDLE_CLASS} />
      <Handle
        type="source"
        id="bottom-source"
        position={Position.Bottom}
        className={HANDLE_CLASS}
      />

      {/* Status dot */}
      {data?.status && data.status !== 'todo' && !isGhost && (
        <div
          className={`absolute top-1 right-1 w-2 h-2 rounded-full ${STATUS_COLORS[data.status] || STATUS_COLORS.todo}`}
        />
      )}

      {/* Attachment badge */}
      {hasAttachments && !isGhost && (
        <div className="absolute top-1 left-1 flex items-center gap-0.5 px-1 py-0.5 rounded bg-c-surface-raised text-[7px] font-bold text-c-text-muted">
          📎 {data.attachments.length}
        </div>
      )}

      {/* Ghost node Accept button (M07 F2: proposal-preview ghosts have no
          onAcceptGhost — they are accepted/rejected as a whole in the panel) */}
      {isGhost && typeof data?.onAcceptGhost === 'function' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            data?.onAcceptGhost?.(id);
          }}
          className="absolute -top-2 -right-2 z-10 w-5 h-5 rounded-full bg-c-success text-white flex items-center justify-center shadow-md hover:brightness-110 transition-all text-[10px] font-bold"
          title={t('processFlow.aiProposalPanel.accept', 'Accept')}
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
          style={objectText}
          className={`bg-transparent text-xs font-medium text-c-text text-center outline-none border-b border-c-border-strong w-full ${innerRotate}`}
        />
      ) : (
        <div
          style={objectText}
          className={`text-xs font-medium text-c-text text-center ${innerRotate}`}
        >
          {data?.label || shape}
        </div>
      )}

      {/* Metrics badges */}
      {hasMetrics && shape !== 'decision' && !isGhost && (
        <div className={`flex items-center gap-1 mt-1 ${innerRotate}`}>
          {data?.duration && (
            <span
              className="px-1.5 py-0.5 rounded-full text-[8px] font-bold text-c-info"
              style={{ backgroundColor: 'color-mix(in srgb, var(--c-info) 16%, transparent)' }}
            >
              {data.duration}
              {data.durationUnit || 'h'}
            </span>
          )}
          {data?.cost && (
            <span
              className="px-1.5 py-0.5 rounded-full text-[8px] font-bold text-c-success"
              style={{ backgroundColor: 'color-mix(in srgb, var(--c-success) 16%, transparent)' }}
            >
              ${data.cost}
            </span>
          )}
          {data?.fteCount && (
            <span
              className="px-1.5 py-0.5 rounded-full text-[8px] font-bold text-c-tag-3"
              style={{ backgroundColor: 'color-mix(in srgb, var(--c-tag-3) 16%, transparent)' }}
            >
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
              ? 'bg-c-success text-white'
              : data.automationPotential === 'medium'
                ? 'bg-c-warning text-white'
                : 'bg-c-text-muted text-white'
          }`}
          title={`Automation: ${data.automationPotential || 'low'}`}
        >
          A
        </div>
      )}
      {data?.savingsEstimate && !isGhost && (
        <div
          className={`px-1.5 py-0.5 rounded-full text-[7px] font-bold text-c-success mt-0.5 ${innerRotate}`}
          style={{ backgroundColor: 'color-mix(in srgb, var(--c-success) 16%, transparent)' }}
        >
          {data.savingsEstimate}
        </div>
      )}

      {/* VSM-specific data fields */}
      {shape === 'vsm_process' &&
        (data?.cycleTime || data?.changeoverTime || data?.uptimePercent) && (
          <div className={`text-[8px] text-c-text-muted mt-1 space-y-0.5 ${innerRotate}`}>
            {data.cycleTime && <div>C/T: {data.cycleTime}</div>}
            {data.changeoverTime && <div>C/O: {data.changeoverTime}</div>}
            {data.uptimePercent != null && <div>Up: {data.uptimePercent}%</div>}
            {data.operators != null && <div>Ops: {data.operators}</div>}
          </div>
        )}
      {shape === 'vsm_inventory' && data?.inventory != null && (
        <div className={`text-[8px] font-bold text-c-warning mt-0.5 ${innerRotate}`}>
          {data.inventory} pcs
        </div>
      )}

      <Handle type="source" position={Position.Right} className={HANDLE_CLASS} />
      <Handle type="target" id="right" position={Position.Right} className={HANDLE_CLASS} />

      {/* Context tooltip on hover */}
      {showTooltip && !editing && !isGhost && (data?.owner || data?.description || hasMetrics) && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-50 pointer-events-none">
          <div className="bg-c-text text-c-bg rounded-lg px-2.5 py-1.5 shadow-lg text-[9px] max-w-[200px] whitespace-normal">
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
