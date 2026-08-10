// @ts-ignore reactflow version mismatch
import { EdgeLabelRenderer, getSmoothStepPath } from '@reactflow/core';
import React, { useCallback, useState } from 'react';
import { type EdgeProps } from 'reactflow';

import {
  arrowMarkerAttrs,
  EdgeArrowMarkers,
  resolveArrowDirection,
} from '../canvas/edgeArrowMarkers';

export const LabeledEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
}) => {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(data?.label || ''));
  const label = String(data?.label || '');

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditValue(label);
      setEditing(true);
    },
    [label]
  );

  const handleConfirm = useCallback(() => {
    setEditing(false);
    if (editValue !== label) {
      window.dispatchEvent(
        new CustomEvent('idea-mindmap-edge-label', {
          detail: { edgeId: id, label: editValue },
        })
      );
    }
  }, [editValue, id, label]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm();
      }
      if (e.key === 'Escape') {
        setEditing(false);
        setEditValue(label);
      }
    },
    [handleConfirm, label]
  );

  const gradientId = `edge-gradient-${id}`;
  const rawStroke = (style?.stroke as string) || 'var(--c-tag-2)';
  // Resolve CSS custom properties (e.g. var(--c-danger)) for SVG attributes
  // which only accept literal color values, not CSS expressions.
  const strokeColor = rawStroke.startsWith('var(')
    ? getComputedStyle(document.documentElement)
        .getPropertyValue(rawStroke.slice(4, -1).trim())
        .trim() || rawStroke
    : rawStroke;
  const strokeWidth = selected ? 3 : (style?.strokeWidth as number) || 2;
  // Canonical line-style source is data.edgeStyle (set by
  // useMindMapQuickActions.ts's mm_edge_cycle_style). Edges saved before that
  // mutation was fixed may carry only the legacy style.strokeDasharray shape
  // — accept it as a migration-safe fallback so already-persisted maps still
  // render their chosen style instead of silently reverting to solid.
  const legacyDasharray = (style as { strokeDasharray?: string } | undefined)?.strokeDasharray;
  const effectiveEdgeStyle =
    typeof data?.edgeStyle === 'string'
      ? data.edgeStyle
      : legacyDasharray
        ? legacyDasharray === '2 2'
          ? 'dotted'
          : 'dashed'
        : undefined;
  // Strzałka kierunku — wspólny model (canvas/edgeArrowMarkers.tsx). Kolor
  // grotu = już rozwiązany `strokeColor` (literał), nie gradient krawędzi.
  const arrowDirection = resolveArrowDirection(data?.arrowDirection, 'none');
  const arrowAttrs = arrowMarkerAttrs(id, arrowDirection);

  return (
    <>
      <EdgeArrowMarkers edgeId={id} direction={arrowDirection} color={strokeColor} />
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
          <stop offset="50%" stopColor={strokeColor} stopOpacity={0.9} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0.3} />
        </linearGradient>
      </defs>

      {/* Glow effect on selection */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth + 4}
          strokeOpacity={0.15}
          style={{ filter: 'blur(4px)' }}
        />
      )}

      {/* Invisible wide hit area for right-click */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.dispatchEvent(
            new CustomEvent('mindmap-edge-contextmenu', {
              detail: {
                edgeId: id,
                isUserCreated: !!data?.userCreated,
                x: e.clientX,
                y: e.clientY,
              },
            })
          );
        }}
      />

      {/* Main edge with gradient */}
      <path
        d={edgePath}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={
          effectiveEdgeStyle === 'dashed'
            ? '8 4'
            : effectiveEdgeStyle === 'dotted'
              ? '2 4'
              : effectiveEdgeStyle === 'wavy'
                ? '6 3 2 3'
                : undefined
        }
        markerStart={arrowAttrs.markerStart}
        markerEnd={arrowAttrs.markerEnd ?? markerEnd}
      />

      {/* Animated flowing dot */}
      <circle r={selected ? 3 : 2} fill={strokeColor} opacity={0.8}>
        <animateMotion dur="3s" repeatCount="indefinite" path={edgePath} />
      </circle>

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          {editing ? (
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleConfirm}
              onKeyDown={handleKeyDown}
              className="px-1.5 py-0.5 text-[10px] rounded-md border border-c-border-subtle dark:border-c-border-subtle bg-c-surface-raised dark:bg-c-surface text-c-text dark:text-c-text focus:outline-none focus:ring-1 focus:ring-c-border w-20 text-center"
            />
          ) : label ? (
            <div
              onDoubleClick={handleDoubleClick}
              className="px-1.5 py-0.5 text-[9px] font-medium text-c-text-secondary dark:text-c-text-muted bg-c-surface-raised dark:bg-c-surface rounded-md border border-c-border-subtle dark:border-c-border-subtle cursor-pointer hover:border-c-border-subtle transition-colors"
            >
              {label}
            </div>
          ) : (
            <div
              onDoubleClick={handleDoubleClick}
              className="w-4 h-4 rounded-full bg-transparent hover:bg-c-surface-raised cursor-pointer transition-colors"
              title="Double-click to add label"
            />
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default LabeledEdge;
