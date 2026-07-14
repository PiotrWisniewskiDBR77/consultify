import React, { useEffect, useRef, useState } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';

// warning / amber gateway accent — canonical design token (SSOT: --c-warning,
// tailwind.config.js). Replaces stale stock-Tailwind hex (#f59e0b) frozen
// before the HBS color remap. CSS var resolves in SVG stroke, light/dark aware.
const GATEWAY_ACCENT = 'var(--c-warning)';

const XorMarker = () => (
  <>
    <line x1={16} y1={16} x2={34} y2={34} stroke={GATEWAY_ACCENT} strokeWidth={2.5} />
    <line x1={34} y1={16} x2={16} y2={34} stroke={GATEWAY_ACCENT} strokeWidth={2.5} />
  </>
);

const AndMarker = () => (
  <>
    <line x1={25} y1={14} x2={25} y2={36} stroke={GATEWAY_ACCENT} strokeWidth={2.5} />
    <line x1={14} y1={25} x2={36} y2={25} stroke={GATEWAY_ACCENT} strokeWidth={2.5} />
  </>
);

export const GatewayNode: React.FC<NodeProps<any>> = ({ data, selected }) => {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(data?.label || ''));
  const inputRef = useRef<HTMLInputElement>(null);
  const kind: string = data?.gatewayKind || 'xor';

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
        width={50}
        height={50}
        viewBox="0 0 50 50"
        className={`${selected ? 'filter drop-shadow-[0_0_4px_rgba(99,102,241,0.6)]' : ''}`}
      >
        <path
          d="M25 2 L48 25 L25 48 L2 25 Z"
          fill="transparent"
          stroke={GATEWAY_ACCENT}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {kind === 'and' ? <AndMarker /> : <XorMarker />}
      </svg>

      {selected && (
        <div
          className="absolute top-0 left-0 w-[50px] h-[50px] ring-2 ring-c-accent pointer-events-none"
          style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}
        />
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
            className="bg-transparent text-xs font-medium text-c-text text-center outline-none border-b border-c-accent w-full"
          />
        ) : (
          <span className="text-xs font-medium text-c-text">{data?.label || ''}</span>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-c-border-strong"
        style={{ top: 25 }}
      />
      <Handle
        type="source"
        id="right"
        position={Position.Right}
        className="!w-2 !h-2 !bg-c-border-strong"
        style={{ top: 25 }}
      />
      <Handle
        type="source"
        id="top"
        position={Position.Top}
        className="!w-2 !h-2 !bg-c-border-strong"
        style={{ left: 25 }}
      />
      <Handle
        type="source"
        id="bottom"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-c-border-strong"
        style={{ left: 25 }}
      />
    </div>
  );
};

export default GatewayNode;
