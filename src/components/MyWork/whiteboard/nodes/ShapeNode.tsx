import React from 'react';
import { Handle, type NodeProps, NodeResizer, Position } from 'reactflow';

import { commentCountOf, CommentPinBadge } from './CommentPinBadge';
import {
  darkenHex,
  hexToGlow,
  resolveNodeFontStyle,
  resolveNodeSurfaceOverride,
  useIsDark,
  WB_HANDLE_CLASS,
} from './whiteboardNodeHelpers';

export const ShapeNode: React.FC<NodeProps> = ({ id: nodeId, data, selected }) => {
  const isDark = useIsDark();
  const shape = data?.shape || 'rectangle';
  // Z15: an explicit style-bar accent (c-tag token) wins over the legacy hex
  // bgColor and is theme-aware via color-mix (no darkenHex needed).
  const accent = typeof data?.accentColor === 'string' ? data.accentColor : null;
  const fontStyle = resolveNodeFontStyle(data);
  // Pasek edycji obiektu: TŁO i RAMKA osobno. Dotąd kształt miał JEDEN
  // `accentColor` sterujący i wypełnieniem, i obwódką (`hexToGlow(lightBg)`),
  // więc ramki w innym kolorze niż tło po prostu nie dało się zrobić.
  const surfaceOverride = resolveNodeSurfaceOverride(data, 26);
  // Default shape fill = periwinkle identity token (theme-aware); a user-picked
  // data.bgColor is still a raw hex, darkened for dark mode via darkenHex.
  const lightBg = accent
    ? `color-mix(in srgb, ${accent} 20%, transparent)`
    : data?.bgColor || 'color-mix(in srgb, var(--c-tag-2) 20%, transparent)';
  const darkBg = accent
    ? `color-mix(in srgb, ${accent} 28%, transparent)`
    : data?.bgColor
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
  // 'rect' (ostry prostokąt) i 'pill' (pigułka) dochodzą z WSPÓLNEJ palety
  // kształtów (`CANVAS_SHAPES`) — ten sam zestaw co w Mapie i Procesie.
  // Koło trzyma proporcję (`borderRadius: 50%`), pigułka NIE — to prostokąt o
  // maksymalnie zaokrąglonych końcach, więc `9999px`, nie `50%`.
  const cornerRadius = isCircle
    ? '50%'
    : shape === 'pill'
      ? 9999
      : shape === 'rect'
        ? 0
        : isDiamond
          ? 8
          : isHexagon
            ? 0
            : 12;

  return (
    <>
      <NodeResizer
        isVisible={selected && !data?.locked}
        minWidth={40}
        minHeight={40}
        keepAspectRatio={isCircle}
      />
      <div
        className={`group relative flex items-center justify-center transition-all ${selected ? 'ring-2 ring-c-border-strong shadow-lg' : 'shadow-md'}`}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: isDark ? darkBg : lightBg,
          borderRadius: cornerRadius,
          transform: isDiamond ? 'rotate(45deg)' : undefined,
          border: isHexagon
            ? 'none'
            : isDark
              ? `2px solid ${hexToGlow(lightBg)}`
              : '2px solid rgba(255,255,255,0.4)',
          ...(surfaceOverride || {}),
          ...(surfaceOverride?.borderColor ? { borderStyle: 'solid', borderWidth: 2 } : {}),
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
        {/* Fala 8: 4-side magnetic handles (Miro/FigJam parity) — see
            StickyNoteNode for the id-less-handle backward-compat rationale. */}
        <Handle type="target" position={Position.Top} className={WB_HANDLE_CLASS} />
        <Handle type="source" id="top-source" position={Position.Top} className={WB_HANDLE_CLASS} />
        <Handle type="target" id="left" position={Position.Left} className={WB_HANDLE_CLASS} />
        <Handle
          type="source"
          id="left-source"
          position={Position.Left}
          className={WB_HANDLE_CLASS}
        />
        <Handle type="target" id="right" position={Position.Right} className={WB_HANDLE_CLASS} />
        <Handle
          type="source"
          id="right-source"
          position={Position.Right}
          className={WB_HANDLE_CLASS}
        />
        <Handle type="target" id="bottom" position={Position.Bottom} className={WB_HANDLE_CLASS} />
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
              style={fontStyle}
            />
          ) : (
            <div className="text-[11px] font-medium text-c-text truncate" style={fontStyle}>
              {data?.label || ''}
            </div>
          )}
        </div>
        <Handle type="source" position={Position.Bottom} className={WB_HANDLE_CLASS} />
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
