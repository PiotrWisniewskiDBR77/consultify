import React, { useEffect, useRef, useState } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

export const BPMNStartNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
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
        {/* stroke uses success/green token (SSOT: --c-success). Was stock #22c55e. */}
        <circle
          cx={18}
          cy={18}
          r={16}
          fill="transparent"
          stroke="var(--c-success)"
          strokeWidth={1.5}
          className={selected ? 'stroke-[2.5]' : ''}
        />
      </svg>

      {selected && (
        <div className="absolute inset-0 rounded-full ring-2 ring-c-focus pointer-events-none" />
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
            className="bg-transparent text-xs font-medium text-c-text text-center outline-none border-b border-c-focus w-full"
          />
        ) : (
          <span className="text-xs font-medium text-c-text">{data?.label || 'Start'}</span>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-c-border-strong" />
    </div>
  );
};

export default BPMNStartNode;
