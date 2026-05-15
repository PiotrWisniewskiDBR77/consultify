import React, { useEffect, useRef, useState } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

const FOLD = 12;
const W = 60;
const H = 70;

const docPath = `M0 0 L${W - FOLD} 0 L${W} ${FOLD} L${W} ${H} L0 ${H} Z`;
const foldPath = `M${W - FOLD} 0 L${W - FOLD} ${FOLD} L${W} ${FOLD}`;

export const DataObjectNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
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
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className={`${selected ? 'filter drop-shadow-[0_0_4px_rgba(99,102,241,0.6)]' : ''}`}
      >
        <path
          d={docPath}
          fill="white"
          stroke="#64748b"
          strokeWidth={1.5}
          className="dark:fill-navy-800"
        />
        <path d={foldPath} fill="none" stroke="#64748b" strokeWidth={1.5} />
      </svg>

      {selected && (
        <div className="absolute top-0 left-0 w-[60px] h-[70px] ring-2 ring-primary-500/60 rounded-sm pointer-events-none" />
      )}

      <div className="mt-1 min-w-[50px] text-center">
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
            {data?.label || 'Document'}
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-slate-400" />
      <Handle
        type="target"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-slate-400"
        id="target-bottom"
      />
    </div>
  );
};

export default DataObjectNode;
