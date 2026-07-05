import React from 'react';
import { Handle, type NodeProps, NodeResizer, Position } from 'reactflow';

import { CommentPinBadge, commentCountOf } from './CommentPinBadge';
import { darkenHex, hexToGlow, useIsDark } from './whiteboardNodeHelpers';

export const ShapeNode: React.FC<NodeProps> = ({ id: nodeId, data, selected }) => {
  const isDark = useIsDark();
  const shape = data?.shape || 'rectangle';
  // Default shape fill = periwinkle identity token (theme-aware); a user-picked
  // data.bgColor is still a raw hex, darkened for dark mode via darkenHex.
  const lightBg = data?.bgColor || 'color-mix(in srgb, var(--c-tag-2) 20%, transparent)';
  const darkBg = data?.bgColor
    ? darkenHex(data.bgColor, 0.7)
    : 'color-mix(in srgb, var(--c-tag-2) 24%, transparent)';
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
        className={`relative flex items-center justify-center transition-all ${selected ? 'ring-2 ring-c-border-strong shadow-lg' : 'shadow-md'}`}
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
        <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-c-border-strong !-top-1" />
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
              className="w-full bg-transparent text-[11px] font-medium text-c-text text-center outline-none border-b border-c-border-strong"
            />
          ) : (
            <div className="text-[11px] font-medium text-c-text truncate">
              {data?.label || ''}
            </div>
          )}
        </div>
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-2 !h-2 !bg-c-border-strong !-bottom-1"
        />
      </div>
      {/* Comment badge lives in a non-transformed overlay so shape rotation
          (diamond) and clipPath (hexagon) never rotate or clip it. */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="pointer-events-auto">
          <CommentPinBadge nodeId={nodeId} count={commentCountOf(data)} />
        </div>
      </div>
    </>
  );
};
