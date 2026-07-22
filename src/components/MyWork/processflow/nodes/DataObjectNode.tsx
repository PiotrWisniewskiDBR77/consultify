import React, { useEffect, useRef, useState } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

import { HANDLE_CLASS } from '../FlowNodeComponent';

const FOLD = 12;
const W = 60;
const H = 70;

const docPath = `M0 0 L${W - FOLD} 0 L${W} ${FOLD} L${W} ${H} L0 ${H} Z`;
const foldPath = `M${W - FOLD} 0 L${W - FOLD} ${FOLD} L${W} ${FOLD}`;

// Document outline stroke — theme-aware via the canonical muted-text token
// (SVG stroke accepts CSS custom properties; SSOT: src/index.css --c-* vars).
const DOC_STROKE = 'var(--c-text-muted)';

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
      className={`group relative flex flex-col items-center ${selected ? 'drop-shadow-lg' : ''}`}
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
          stroke={DOC_STROKE}
          strokeWidth={1.5}
          className="dark:fill-c-surface-raised"
        />
        <path d={foldPath} fill="none" stroke={DOC_STROKE} strokeWidth={1.5} />
      </svg>

      {selected && (
        <div className="absolute top-0 left-0 w-[60px] h-[70px] ring-2 ring-c-focus rounded-sm pointer-events-none" />
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
            className="bg-transparent text-xs font-medium text-c-text text-center outline-none border-b border-c-focus w-full"
          />
        ) : (
          <span className="text-xs font-medium text-c-text">{data?.label || 'Document'}</span>
        )}
      </div>

      {/* Z23 (Fala 7): 4-side magnetic handles (Z17 parity). Bottom pair
          predates this change and is untouched (unnamed source, named
          target "target-bottom" — both load-bearing for existing edges).
          Left/Top/Right did not exist before; Left/target is added id-less
          since it's the only id-less target on this node (matches the
          Z17 fallback-resolution convention), all other new handles get
          explicit ids to avoid a second id-less handle of the same type. */}
      <Handle type="source" position={Position.Bottom} className={HANDLE_CLASS} />
      <Handle
        type="target"
        position={Position.Bottom}
        className={HANDLE_CLASS}
        id="target-bottom"
      />
      <Handle type="target" position={Position.Left} className={HANDLE_CLASS} />
      <Handle type="source" id="left" position={Position.Left} className={HANDLE_CLASS} />
      <Handle type="target" id="top" position={Position.Top} className={HANDLE_CLASS} />
      <Handle type="source" id="top-source" position={Position.Top} className={HANDLE_CLASS} />
      <Handle type="source" id="right-source" position={Position.Right} className={HANDLE_CLASS} />
      <Handle type="target" id="right" position={Position.Right} className={HANDLE_CLASS} />
    </div>
  );
};

export default DataObjectNode;
