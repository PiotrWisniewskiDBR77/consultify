// @ts-ignore — getSmoothStepPath is exported at runtime but types re-export may not resolve
import { getSmoothStepPath } from '@reactflow/core';
import React from 'react';
import { EdgeProps } from 'reactflow';

import {
  arrowMarkerAttrs,
  EdgeArrowMarkers,
  resolveArrowDirection,
} from '../canvas/edgeArrowMarkers';
import { pointsToPath, routeOrthogonal, type RoutePoint } from './edgeRouting';

export const CONDITION_TYPES = ['', 'yes', 'no', 'default', 'exception'] as const;

// F5a A2: semantic edge kinds. `sequence` = default solid connector, `conditional`
// = decision branch (Yes/No labelling via conditionType), `message` = dashed
// message flow (the removed standalone MessageFlowEdge, folded back in here as a
// data-driven variant per spec — NOT a resurrected separate component).
export const EDGE_KINDS = ['sequence', 'conditional', 'message'] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];

// Semantic edge colors via canonical design tokens (SSOT: tailwind.config.js
// + src/index.css --c-* vars; works in SVG stroke/fill, light/dark aware).
// Replaces stale stock-Tailwind hex frozen before the HBS color remap.
const EDGE_CONDITION_COLORS = {
  yes: 'var(--c-success)', // success / green — was #22c55e
  no: 'var(--c-danger)', // danger / rose — was #f43f5e
  exception: 'var(--c-warning)', // warning / amber — was #f59e0b
} as const;
// Neutral fallback stroke — theme-aware via canonical border token.
const EDGE_NEUTRAL_STROKE = 'var(--c-border-strong)';

function normalizeWaypoints(raw: unknown): RoutePoint[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (p): p is RoutePoint =>
        !!p && typeof (p as any).x === 'number' && typeof (p as any).y === 'number'
    )
    .map((p) => ({ x: (p as any).x, y: (p as any).y }));
}

export const FlowEdgeComponent: React.FC<EdgeProps> = ({
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

  const edgeKind: EdgeKind =
    (EDGE_KINDS.includes(data?.edgeKind) ? data?.edgeKind : undefined) ??
    (data?.conditionType ? 'conditional' : 'sequence');

  const waypoints = React.useMemo(() => normalizeWaypoints(data?.waypoints), [data?.waypoints]);
  // F5a A1: orthogonal routing when the user opts in (edge.data.orthogonal) or
  // has placed waypoints; otherwise keep the smooth-step default so existing
  // flows render unchanged.
  const useOrthogonal = Boolean(data?.orthogonal) || waypoints.length > 0;

  let edgePath: string;
  let labelX: number;
  let labelY: number;
  if (useOrthogonal) {
    const route = routeOrthogonal(
      { x: sourceX, y: sourceY },
      { x: targetX, y: targetY },
      { waypoints }
    );
    edgePath = route.path;
    labelX = route.labelPoint.x;
    labelY = route.labelPoint.y;
  } else {
    const [p, lx, ly] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
    edgePath = p;
    labelX = lx;
    labelY = ly;
  }

  const commitEdit = () => {
    setEditing(false);
    if (data?.onLabelChange) data.onLabelChange(id, editValue);
  };
  const edgeLocked = Boolean(data?.locked);

  const conditionType = data?.conditionType || '';
  const conditionColor =
    EDGE_CONDITION_COLORS[conditionType as keyof typeof EDGE_CONDITION_COLORS] || undefined;
  // #6p: explicit user color override (EdgeStylePopover, `--c-tag-*` swatch)
  // wins over the semantic condition color / lane color / raw style prop.
  const edgeStroke = data?.edgeColor || conditionColor || data?.sourceLaneColor || style?.stroke;

  const baseW = selected ? 2.5 : 1.5;
  // A2: message flows read as static dashed lines (no marching-ants animation);
  // sequence/conditional keep the animated primary stroke.
  const isMessage = edgeKind === 'message';
  // #6p: explicit style override (solid/dashed) from the edge popover wins
  // over the edgeKind-based default; 'solid' forces the dash off even for
  // message edges, 'dashed' forces it on for sequence/conditional edges.
  const strokeStyleOverride = data?.strokeStyleOverride as 'solid' | 'dashed' | undefined;
  const isDashed = strokeStyleOverride ? strokeStyleOverride === 'dashed' : isMessage;
  // #6p/F8: arrow direction (none/start/end/both) — rendered via per-edge SVG
  // markers below. Default 'end' (Lucidchart-parity: flow direction must read
  // at a glance without opening the popover). Edges only stay arrow-less when
  // the user explicitly picks "None" in the popover (data.arrowDirection ===
  // 'none' is then persisted and respected) — unset/legacy edges (no field at
  // all) pick up the new default automatically.
  // 2026-07-28: geometria grotów przeniesiona do WSPÓLNEGO `canvas/edgeArrowMarkers`
  // (ten sam grot rysuje teraz Mapa myśli i Tablica). Domyślne 'end' zostaje —
  // to nadal diagram procesu. Przy okazji naprawiony grot startowy: miał
  // JEDNOCZEŚNIE odwróconą ścieżkę i `orient="auto-start-reverse"`, co znosiło
  // się nawzajem — przy 'both' obie strzałki pokazywały w tę samą stronę.
  const arrowDirection = resolveArrowDirection(data?.arrowDirection, 'end');
  const markerColor = edgeStroke || EDGE_NEUTRAL_STROKE;
  const arrowAttrs = arrowMarkerAttrs(id, arrowDirection);

  const handleAddWaypoint = (e: React.MouseEvent) => {
    // F5a A1: double-click on the edge inserts a waypoint at the pointer.
    if (edgeLocked || !data?.onAddWaypoint) return;
    e.stopPropagation();
    const svg = (e.currentTarget as SVGElement).ownerSVGElement;
    // Fall back to raw client coords when we can't resolve the flow transform;
    // the parent handler is responsible for mapping screen→flow space.
    data.onAddWaypoint(id, { clientX: e.clientX, clientY: e.clientY, svg });
  };

  return (
    <g className="group/flowedge">
      <style>{`@keyframes flowEdgeDash { to { stroke-dashoffset: -12; } }`}</style>
      {/* Groty kierunku — wspólny komponent dla wszystkich trzech płócien. */}
      <EdgeArrowMarkers edgeId={id} direction={arrowDirection} color={markerColor} />
      {/* Invisible wide hit area — also the double-click target for waypoints */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={14}
        onDoubleClick={handleAddWaypoint}
        style={{ cursor: data?.onAddWaypoint && !edgeLocked ? 'copy' : undefined }}
      />
      {/* Selection pulse */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke={edgeStroke || EDGE_NEUTRAL_STROKE}
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
        markerEnd={arrowAttrs.markerEnd}
        markerStart={arrowAttrs.markerStart}
        style={{
          ...style,
          stroke: edgeStroke,
          strokeWidth: baseW,
          // Message flows are dashed by default; the popover's explicit
          // style override (#6p) wins when the user has set one.
          strokeDasharray: isDashed ? '6 5' : (style?.strokeDasharray as any),
        }}
      />
      {/* Marching-ants overlay — sequence/conditional only */}
      {!isMessage && (
        <path
          d={edgePath}
          fill="none"
          strokeDasharray="8 4"
          stroke={edgeStroke || EDGE_NEUTRAL_STROKE}
          strokeWidth={baseW}
          strokeOpacity={selected ? 0.55 : 0.45}
          style={{ animation: 'flowEdgeDash 0.6s linear infinite' }}
        />
      )}
      {/* Directional particle on selected edge */}
      {selected && (
        <circle r="3" fill={edgeStroke || EDGE_NEUTRAL_STROKE} opacity={0.7}>
          <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
      {/* F5a A1: draggable waypoint handles (visible when selected) */}
      {selected &&
        !edgeLocked &&
        waypoints.map((w, i) => (
          <circle
            key={`wp-${i}`}
            cx={w.x}
            cy={w.y}
            r={4}
            fill="var(--c-bg)"
            stroke={edgeStroke || 'var(--c-info)'}
            strokeWidth={1.5}
            style={{ cursor: 'grab' }}
            onPointerDown={(ev) => {
              if (!data?.onWaypointDrag) return;
              ev.stopPropagation();
              data.onWaypointDrag(id, i, ev);
            }}
            onDoubleClick={(ev) => {
              if (!data?.onRemoveWaypoint) return;
              ev.stopPropagation();
              data.onRemoveWaypoint(id, i);
            }}
          />
        ))}
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
              className="w-full text-[9px] font-medium text-center bg-c-surface border border-c-focus rounded px-1 outline-none"
            />
            <select
              value={conditionType}
              onChange={(e) => {
                if (data?.onConditionChange) data.onConditionChange(id, e.target.value);
              }}
              disabled={edgeLocked}
              className="text-[8px] bg-c-surface border border-c-border-subtle rounded"
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
            className="text-[9px] font-medium text-c-text-secondary text-center cursor-pointer hover:text-c-text truncate"
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (edgeLocked) return;
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
