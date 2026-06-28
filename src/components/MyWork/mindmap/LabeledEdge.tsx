// @ts-ignore reactflow version mismatch
import { EdgeLabelRenderer, getSmoothStepPath } from '@reactflow/core';
import React, { useCallback, useState } from 'react';
import { type EdgeProps } from 'reactflow';

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
  const rawStroke = (style?.stroke as string) || '#6366f1';
  // Resolve CSS custom properties (e.g. var(--c-danger)) for SVG attributes
  // which only accept literal color values, not CSS expressions.
  const strokeColor = rawStroke.startsWith('var(')
    ? getComputedStyle(document.documentElement)
        .getPropertyValue(rawStroke.slice(4, -1).trim())
        .trim() || rawStroke
    : rawStroke;
  const strokeWidth = selected ? 3 : (style?.strokeWidth as number) || 2;

  return (
    <>
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
          data?.edgeStyle === 'dashed'
            ? '8 4'
            : data?.edgeStyle === 'dotted'
              ? '2 4'
              : data?.edgeStyle === 'wavy'
                ? '6 3 2 3'
                : undefined
        }
        markerEnd={markerEnd}
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
              className="px-1.5 py-0.5 text-[10px] rounded-md border border-slate-400/60 dark:border-navy-500/60 bg-white dark:bg-navy-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400/50 w-20 text-center"
            />
          ) : label ? (
            <div
              onDoubleClick={handleDoubleClick}
              className="px-1.5 py-0.5 text-[9px] font-medium text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-navy-900/80 rounded-md border border-slate-200/40 dark:border-navy-700/40 cursor-pointer hover:border-slate-400/40 transition-colors"
            >
              {label}
            </div>
          ) : (
            <div
              onDoubleClick={handleDoubleClick}
              className="w-4 h-4 rounded-full bg-transparent hover:bg-slate-400/10 cursor-pointer transition-colors"
              title="Double-click to add label"
            />
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default LabeledEdge;
