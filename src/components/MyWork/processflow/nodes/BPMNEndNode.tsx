import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

export const BPMNEndNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
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
      className={`relative flex flex-col items-center ${selected ? 'drop-shadow-lg' : ''}`}
      onDoubleClick={() => {
        if (!data?.locked) {
          setEditValue(String(data?.label || ''));
          setEditing(true);
        }
      }}
    >
      <svg
        width={36}
        height={36}
        viewBox="0 0 36 36"
        className={`${selected ? 'filter drop-shadow-[0_0_4px_rgba(99,102,241,0.6)]' : ''}`}
      >
        <circle
          cx={18}
          cy={18}
          r={15}
          fill="transparent"
          stroke="#ef4444"
          strokeWidth={3}
          className={selected ? 'stroke-[4]' : ''}
        />
      </svg>

      {selected && (
        <div className="absolute inset-0 rounded-full ring-2 ring-primary-500/60 pointer-events-none" />
      )}

      <div className="mt-1 min-w-[40px] text-center">
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
            className="bg-transparent text-xs font-medium text-slate-800 dark:text-slate-200 text-center outline-none border-b border-primary-400 w-full"
          />
        ) : (
          <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
            {data?.label || 'End'}
          </span>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-slate-400"
      />
    </div>
  );
};

export default BPMNEndNode;
