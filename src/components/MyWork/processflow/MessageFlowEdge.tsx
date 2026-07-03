// @ts-ignore — getSmoothStepPath is exported at runtime but types re-export may not resolve
import { getSmoothStepPath } from '@reactflow/core';
import React from 'react';
import type { EdgeProps } from 'reactflow';

/**
 * MessageFlowEdge — BPMN-style message flow (dashed, different color).
 * Used for inter-pool/inter-participant communication as opposed to
 * sequence flow within a single pool.
 */
export const MessageFlowEdge: React.FC<EdgeProps> = ({
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
  const edgeLocked = Boolean(data?.locked);

  // info / indigo — canonical design token (SSOT: src/index.css --c-info,
  // tailwind.config.js). Works in SVG stroke/fill, light/dark aware.
  // Replaces stale stock-Tailwind hex (#6366f1) frozen before the HBS remap.
  const strokeColor = 'var(--c-info)';
  const baseW = selected ? 2.5 : 1.5;

  return (
    <g className="group/messageedge">
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={14} />
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke={strokeColor}
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
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth: baseW,
          strokeDasharray: '6 4',
        }}
      />
      {/* Open circle at source (BPMN message flow convention) */}
      <circle cx={sourceX} cy={sourceY} r={4} fill="white" stroke={strokeColor} strokeWidth={1.5} />
      {/* Filled circle at target */}
      <circle
        cx={targetX}
        cy={targetY}
        r={4}
        fill={strokeColor}
        stroke={strokeColor}
        strokeWidth={1.5}
      />
      <foreignObject
        x={labelX - 50}
        y={labelY - 12}
        width={100}
        height={24}
        requiredExtensions="http://www.w3.org/1999/xhtml"
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
            className="w-full text-[9px] font-medium text-center bg-c-surface border border-c-tag-2 rounded px-1 outline-none"
          />
        ) : (
          <div
            className="text-[9px] font-medium text-c-tag-2 text-center cursor-pointer hover:text-c-tag-2 truncate"
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
