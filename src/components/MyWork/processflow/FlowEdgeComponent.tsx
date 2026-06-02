// @ts-ignore — getSmoothStepPath is exported at runtime but types re-export may not resolve
import { getSmoothStepPath } from '@reactflow/core';
import React from 'react';
import { EdgeProps } from 'reactflow';

export const CONDITION_TYPES = ['', 'yes', 'no', 'default', 'exception'] as const;

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

  const conditionType = data?.conditionType || '';
  const conditionColor =
    conditionType === 'yes'
      ? '#22c55e'
      : conditionType === 'no'
        ? '#f43f5e'
        : conditionType === 'exception'
          ? '#f59e0b'
          : undefined;
  const edgeStroke = conditionColor || data?.sourceLaneColor || style?.stroke;

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
              disabled={edgeLocked}
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
