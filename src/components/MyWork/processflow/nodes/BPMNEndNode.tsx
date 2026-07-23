import React, { useEffect, useRef, useState } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

import { HANDLE_CLASS } from '../FlowNodeComponent';

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
      className={`group relative flex flex-col items-center ${selected ? 'drop-shadow-lg' : ''}`}
      onDoubleClick={() => {
        if (!data?.locked) {
          setEditValue(String(data?.label || ''));
          setEditing(true);
        }
      }}
    >
      {/* Z23 (Fala 7): 4-side magnetic handles (Z17 parity). Existing
          Left/target stays id-less (back-compat with pre-existing edges);
          Right/source did not exist before and is added id-less too. */}
      <Handle type="target" position={Position.Left} className={HANDLE_CLASS} />
      <Handle type="source" id="left" position={Position.Left} className={HANDLE_CLASS} />
      <Handle type="target" id="top" position={Position.Top} className={HANDLE_CLASS} />
      <Handle type="source" id="top-source" position={Position.Top} className={HANDLE_CLASS} />
      <Handle type="target" id="bottom" position={Position.Bottom} className={HANDLE_CLASS} />
      <Handle
        type="source"
        id="bottom-source"
        position={Position.Bottom}
        className={HANDLE_CLASS}
      />
      <svg
        width={36}
        height={36}
        viewBox="0 0 36 36"
        className={`${selected ? 'filter drop-shadow-[0_0_4px_rgba(99,102,241,0.6)]' : ''}`}
      >
        {/* stroke uses danger/rose token (SSOT: --c-danger). Was stock #f43f5e. */}
        <circle
          cx={18}
          cy={18}
          r={15}
          fill="transparent"
          stroke="var(--c-danger)"
          strokeWidth={3}
          className={selected ? 'stroke-[4]' : ''}
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
          <span className="text-xs font-medium text-c-text">{data?.label || 'End'}</span>
        )}
      </div>

      <Handle type="source" position={Position.Right} className={HANDLE_CLASS} />
      <Handle type="target" id="right" position={Position.Right} className={HANDLE_CLASS} />
    </div>
  );
};

export default BPMNEndNode;
