// @ts-ignore reactflow version mismatch
import { getBezierPath } from '@reactflow/core';
import React from 'react';
import { type EdgeProps } from 'reactflow';

import {
  arrowMarkerAttrs,
  EdgeArrowMarkers,
  resolveArrowDirection,
} from '../../canvas/edgeArrowMarkers';

export const LabeledEdge: React.FC<EdgeProps> = ({
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

  // Selected edges use the periwinkle identity token; idle edges use neutral
  // border tokens. CSS vars resolve inside SVG stroke/gradient, theme-aware.
  const edgeColor = data?.color || (selected ? 'var(--c-tag-2)' : 'var(--c-border-strong)');
  const edgeColorEnd = data?.colorEnd || (selected ? 'var(--c-tag-2)' : 'var(--c-border)');
  const gradientId = `edge-gradient-${id}`;
  // Strzałka kierunku — wspólny model (canvas/edgeArrowMarkers.tsx). Grot na
  // końcu bierze kolor końca gradientu, na początku — kolor początku, więc
  // przy `both` każda strzałka zgadza się z barwą swojego końca linii.
  const arrowDirection = resolveArrowDirection(data?.arrowDirection, 'none');
  const arrowAttrs = arrowMarkerAttrs(id, arrowDirection);

  return (
    <>
      <EdgeArrowMarkers
        edgeId={id}
        direction={arrowDirection}
        color={edgeColorEnd}
        colorStart={edgeColor}
      />
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={edgeColor} />
          <stop offset="100%" stopColor={edgeColorEnd} />
        </linearGradient>
      </defs>
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
        markerStart={arrowAttrs.markerStart}
        markerEnd={arrowAttrs.markerEnd ?? markerEnd}
        style={style}
      />
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
              className="w-full bg-c-surface text-[10px] text-center border border-c-border-strong rounded px-1 py-0.5 outline-none"
            />
          ) : (
            <div
              className="text-[10px] text-center text-c-text-muted bg-c-surface rounded px-1.5 py-0.5 cursor-pointer hover:bg-c-surface transition-colors"
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
