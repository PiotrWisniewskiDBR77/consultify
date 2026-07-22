import React, { useEffect, useRef, useState } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

import { HANDLE_CLASS } from '../FlowNodeComponent';

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
      className={`group relative flex items-stretch min-w-[200px] min-h-[80px] rounded-lg border-2 border-c-border-strong bg-c-surface shadow-sm transition-shadow ${
        selected ? 'ring-2 ring-c-border-strong' : ''
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
      {/* Z23 (Fala 7): 4-side magnetic handles (Z17 parity). Both existing
          unnamed handles (Left/target, Right/source) preserved id-less for
          back-compat with pre-existing L→R edges. */}
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

      <div className="w-7 flex-shrink-0 border-r border-c-border-strong bg-c-surface-raised flex items-center justify-center rounded-l-lg">
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
            className="bg-transparent text-[10px] font-bold text-c-text-secondary text-center outline-none border-b border-c-focus w-full [writing-mode:vertical-rl] rotate-180"
          />
        ) : (
          <span className="text-[10px] font-bold text-c-text-secondary [writing-mode:vertical-rl] rotate-180 select-none whitespace-nowrap px-0.5">
            {data?.label || 'Pool'}
          </span>
        )}
      </div>

      <div className="flex-1 p-2 flex items-center justify-center">
        <span className="text-[9px] text-c-text-secondary italic select-none">
          {data?.participantCount ? `${data.participantCount} participants` : ''}
        </span>
      </div>

      <Handle type="source" position={Position.Right} className={HANDLE_CLASS} />
      <Handle type="target" id="right" position={Position.Right} className={HANDLE_CLASS} />
    </div>
  );
};

export default PoolNode;
