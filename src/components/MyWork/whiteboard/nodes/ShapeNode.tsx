import React from 'react';
import { Handle, type NodeProps, NodeResizer, Position } from 'reactflow';

import { darkenHex, hexToGlow, useIsDark } from './whiteboardNodeHelpers';

export const ShapeNode: React.FC<NodeProps> = ({ data, selected }) => {
  const isDark = useIsDark();
  const shape = data?.shape || 'rectangle';
  const lightBg = data?.bgColor || '#e0e7ff';
  const darkBg = data?.bgColor ? darkenHex(data.bgColor, 0.7) : '#1e1b4b';
  const [editing, setEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(String(data?.label || ''));
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitEdit = () => {
    setEditing(false);
    if (data?.onLabelChange && editValue !== data?.label) data.onLabelChange(editValue);
  };

  const isDiamond = shape === 'diamond';
  const isCircle = shape === 'circle';
  const isHexagon = shape === 'hexagon';

  return (
    <>
      <NodeResizer
        isVisible={selected && !data?.locked}
        minWidth={40}
        minHeight={40}
        keepAspectRatio={isCircle}
      />
      <div
        className={`relative flex items-center justify-center transition-all ${selected ? 'ring-2 ring-slate-500/60 shadow-lg' : 'shadow-md shadow-slate-300/40 dark:shadow-navy-900/40'}`}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: isDark ? darkBg : lightBg,
          borderRadius: isCircle ? '50%' : isDiamond ? 8 : isHexagon ? 0 : 12,
          transform: isDiamond ? 'rotate(45deg)' : undefined,
          border: isHexagon
            ? 'none'
            : isDark
              ? `2px solid ${hexToGlow(lightBg)}`
              : '2px solid rgba(255,255,255,0.4)',
          boxShadow: isHexagon
            ? undefined
            : isDark
              ? `0 0 14px ${hexToGlow(lightBg)}, inset 0 1px 0 rgba(255,255,255,0.05)`
              : 'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 8px rgba(0,0,0,0.08)',
          clipPath: isHexagon
            ? 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)'
            : undefined,
        }}
        onDoubleClick={() => {
          if (!data?.locked) {
            setEditValue(String(data?.label || ''));
            setEditing(true);
          }
        }}
      >
        <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-slate-400 !-top-1" />
        <div
          style={{ transform: isDiamond ? 'rotate(-45deg)' : undefined }}
          className="px-2 text-center w-full"
        >
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
              className="w-full bg-transparent text-[11px] font-medium text-slate-800 dark:text-slate-200 text-center outline-none border-b border-slate-400 dark:border-slate-500"
            />
          ) : (
            <div className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate">
              {data?.label || ''}
            </div>
          )}
        </div>
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-2 !h-2 !bg-slate-400 !-bottom-1"
        />
      </div>
    </>
  );
};
