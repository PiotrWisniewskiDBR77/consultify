import React, { useEffect, useRef, useState } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

import { DEFAULT_LANE_COLOR } from '../FlowNodeComponent';

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-c-border-strong",
  in_progress: 'bg-blue-500',
  done: 'bg-green-500',
  blocked: 'bg-danger-500',
};

export const ActivityNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(data?.label || ''));
  const inputRef = useRef<HTMLInputElement>(null);
  const laneColor: string = data?.laneColor || DEFAULT_LANE_COLOR;

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitEdit = () => {
    setEditing(false);
    if (data?.onLabelChange && editValue !== data?.label) data.onLabelChange(editValue);
  };

  const hasMetrics = data?.duration || data?.cost || data?.fteCount;

  return (
    <div
      className={`relative flex flex-col items-center justify-center min-w-[120px] min-h-[56px] px-3 py-2 rounded-xl border border-c-border bg-c-surface shadow-sm transition-shadow ${
        selected ? 'ring-2 ring-c-border-strong' : ''
      }`}
      style={{
        borderLeftColor: laneColor,
        borderLeftWidth: 4,
        backgroundColor: `${laneColor}08`,
      }}
      onDoubleClick={() => {
        if (!data?.locked) {
          if (data?.onNodeDetail) {
            data.onNodeDetail(id, data);
          } else {
            setEditValue(String(data?.label || ''));
            setEditing(true);
          }
        }
      }}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-c-border-strong" />

      {data?.status && data.status !== 'todo' && (
        <div
          className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full ${STATUS_COLORS[data.status] || STATUS_COLORS.todo}`}
        />
      )}

      {data?.automationCandidate && (
        <div
          className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black ${
            data.automationPotential === 'high'
              ? 'bg-emerald-500 text-white'
              : data.automationPotential === 'medium'
                ? 'bg-amber-500 text-white'
                : 'bg-c-text-muted text-white'
          }`}
          title={`Automation: ${data.automationPotential || 'low'}`}
        >
          A
        </div>
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
          className="bg-transparent text-xs font-medium text-c-text text-center outline-none border-b border-primary-400 w-full"
        />
      ) : (
        <div className="text-xs font-medium text-c-text text-center">
          {data?.label || 'Activity'}
        </div>
      )}

      {hasMetrics && (
        <div className="flex items-center gap-1 mt-1">
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

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-c-border-strong" />
    </div>
  );
};

export default ActivityNode;
