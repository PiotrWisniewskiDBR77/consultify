import React, { useEffect, useRef, useState } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

import { DEFAULT_LANE_COLOR, HANDLE_CLASS } from '../FlowNodeComponent';

export const SubprocessNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(data?.label || ''));
  const inputRef = useRef<HTMLInputElement>(null);
  const laneColor: string = data?.laneColor || DEFAULT_LANE_COLOR;
  const collapsed = data?.collapsed ?? true;

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitEdit = () => {
    setEditing(false);
    if (data?.onLabelChange && editValue !== data?.label) data.onLabelChange(editValue);
  };

  return (
    <div
      className={`group relative flex flex-col items-center justify-center min-w-[120px] min-h-[56px] px-3 py-2 rounded-xl border-2 border-dashed border-c-border-strong bg-c-surface shadow-sm transition-shadow ${
        selected ? 'ring-2 ring-c-border-strong' : ''
      }`}
      style={{
        borderLeftColor: laneColor,
        borderLeftWidth: 4,
        borderLeftStyle: 'solid',
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
        <div className="text-xs font-medium text-c-text text-center">
          {data?.label || 'Subprocess'}
        </div>
      )}

      {/* [+] / [-] collapse marker at bottom center */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-5 h-5 rounded border border-c-border-strong bg-c-surface flex items-center justify-center">
        <svg width={12} height={12} viewBox="0 0 12 12">
          <line
            x1={2}
            y1={6}
            x2={10}
            y2={6}
            stroke="currentColor"
            strokeWidth={1.5}
            className="text-c-text-secondary"
          />
          {collapsed && (
            <line
              x1={6}
              y1={2}
              x2={6}
              y2={10}
              stroke="currentColor"
              strokeWidth={1.5}
              className="text-c-text-secondary"
            />
          )}
        </svg>
      </div>

      <Handle type="source" position={Position.Right} className={HANDLE_CLASS} />
      <Handle type="target" id="right" position={Position.Right} className={HANDLE_CLASS} />
    </div>
  );
};

export default SubprocessNode;
