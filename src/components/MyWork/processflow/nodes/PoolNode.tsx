import React, { useEffect, useRef, useState } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

/**
 * PoolNode — BPMN-style pool container (P14 semantic type: pool).
 * Rendered as a bordered rectangle with a vertical header bar showing
 * the pool name. Contains lanes visually but does not act as a
 * React Flow parent node (lanes are managed separately).
 */
export const PoolNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(data?.label || ''));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitEdit = () => {
    setEditing(false);
    if (data?.onLabelChange && editValue !== data?.label) data.onLabelChange(editValue);
  };

  return (
    <div
      className={`relative flex items-stretch min-w-[200px] min-h-[80px] rounded-lg border-2 border-slate-500 dark:border-navy-400 bg-white/50 dark:bg-navy-900/40 shadow-sm transition-shadow ${
        selected ? 'ring-2 ring-primary-500/60' : ''
      }`}
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
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-slate-400" />

      <div className="w-7 flex-shrink-0 border-r border-slate-500 dark:border-navy-400 bg-slate-100 dark:bg-navy-800 flex items-center justify-center rounded-l-lg">
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
            className="bg-transparent text-[10px] font-bold text-slate-700 dark:text-slate-200 text-center outline-none border-b border-primary-400 w-full [writing-mode:vertical-rl] rotate-180"
          />
        ) : (
          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 [writing-mode:vertical-rl] rotate-180 select-none whitespace-nowrap px-0.5">
            {data?.label || 'Pool'}
          </span>
        )}
      </div>

      <div className="flex-1 p-2 flex items-center justify-center">
        <span className="text-[9px] text-slate-400 dark:text-slate-500 italic select-none">
          {data?.participantCount ? `${data.participantCount} participants` : ''}
        </span>
      </div>

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-slate-400" />
    </div>
  );
};

export default PoolNode;
