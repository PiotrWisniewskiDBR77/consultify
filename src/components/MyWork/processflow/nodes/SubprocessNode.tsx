import React, { useEffect, useRef, useState } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

export const SubprocessNode: React.FC<NodeProps<any>> = ({ id, data, selected }) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(data?.label || ''));
  const inputRef = useRef<HTMLInputElement>(null);
  const laneColor: string = data?.laneColor || '#e2e8f0';
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
      className={`relative flex flex-col items-center justify-center min-w-[120px] min-h-[56px] px-3 py-2 rounded-xl border-2 border-dashed border-slate-400 dark:border-navy-500 bg-white dark:bg-navy-800 shadow-sm transition-shadow ${
        selected ? 'ring-2 ring-primary-500/60' : ''
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
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-slate-400" />

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
        <div className="text-xs font-medium text-slate-800 dark:text-slate-200 text-center">
          {data?.label || 'Subprocess'}
        </div>
      )}

      {/* [+] / [-] collapse marker at bottom center */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-5 h-5 rounded border border-slate-400 dark:border-navy-500 bg-white dark:bg-navy-800 flex items-center justify-center">
        <svg width={12} height={12} viewBox="0 0 12 12">
          <line
            x1={2}
            y1={6}
            x2={10}
            y2={6}
            stroke="currentColor"
            strokeWidth={1.5}
            className="text-slate-600 dark:text-slate-300"
          />
          {collapsed && (
            <line
              x1={6}
              y1={2}
              x2={6}
              y2={10}
              stroke="currentColor"
              strokeWidth={1.5}
              className="text-slate-600 dark:text-slate-300"
            />
          )}
        </svg>
      </div>

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-slate-400" />
    </div>
  );
};

export default SubprocessNode;
