import React from 'react';
import { useTranslation } from 'react-i18next';
import { Handle, type NodeProps, Position } from 'reactflow';

import { commentCountOf, CommentPinBadge } from './CommentPinBadge';
import {
  resolveNodeAccentBg,
  resolveNodeFontStyle,
  resolveNodeSurfaceOverride,
  STICKY_COLORS,
  STICKY_SIZES,
  useIsDark,
  WB_HANDLE_CLASS,
} from './whiteboardNodeHelpers';
import { WhiteboardNodeReactions } from './WhiteboardNodeReactions';

export const StickyNoteNode: React.FC<NodeProps> = ({ id: nodeId, data, selected }) => {
  const { t } = useTranslation();
  const isDark = useIsDark();
  const colorIdx = (data?.colorIndex ?? 0) % STICKY_COLORS.length;
  const color = STICKY_COLORS[colorIdx];
  const sizeKey = (data?.size as string) || 'm';
  const size = STICKY_SIZES[sizeKey] || STICKY_SIZES.m;
  // Z15: per-element style overrides written by the floating style bar.
  const accentBg = resolveNodeAccentBg(data?.accentColor);
  const fontStyle = resolveNodeFontStyle(data);
  // WB-P2-01: a freshly-created note (`data._isNew`, set by
  // IdeaWhiteboardTool.addElement for a rail/toolbar "Add sticky" with no
  // caller-supplied label) opens straight into inline naming — a first-time
  // user should never need to already know about double-click. Lazy
  // initializer runs once per mount, so this only fires right after
  // creation, not on every re-render.
  const [editing, setEditing] = React.useState(() => Boolean(data?._isNew));
  const [editValue, setEditValue] = React.useState(String(data?.label || ''));
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }
  }, [editing]);

  // Clear `_isNew` once consumed so a later remount of this same node (e.g.
  // its parent frame collapsing then expanding) doesn't reopen the editor.
  React.useEffect(() => {
    if (data?._isNew && typeof data?.onConsumeAutoEdit === 'function') {
      data.onConsumeAutoEdit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commitEdit = () => {
    setEditing(false);
    if (data?.onLabelChange && editValue !== data?.label) {
      data.onLabelChange(editValue);
    }
  };

  const commentCount = commentCountOf(data);
  const surfaceOverride = resolveNodeSurfaceOverride(data, 26);
  const priority = typeof data?.priority === 'number' ? data.priority : 0;
  const priorityBorder =
    priority >= 80
      ? 'border-2 border-danger-400/70'
      : priority >= 50
        ? 'border-2 border-warning-400/60'
        : '';

  return (
    <div
      className={`group relative p-3 rounded-xl border shadow-lg transition-all ${color.bg} ${color.border} ${priorityBorder} ${selected ? 'ring-2 ring-c-border-strong shadow-xl' : ''} ${data?.isAI ? 'ring-1 ring-c-border-strong' : ''} ${data?._isNew ? 'animate-[pulse_1s_ease-in-out_1]' : ''}`}
      style={{
        width: size.w,
        minHeight: size.h,
        ...((color as { bgVar?: string }).bgVar
          ? {
              backgroundColor: `color-mix(in srgb, var(${(color as { bgVar?: string }).bgVar}) 16%, transparent)`,
            }
          : {}),
        ...(isDark
          ? { boxShadow: selected ? `${color.glow}, 0 0 24px rgba(168,85,247,0.2)` : color.glow }
          : {}),
        // Z15: explicit per-element accent wins over the random creation color.
        ...(accentBg || {}),
        // Pasek edycji obiektu: TŁO i RAMKA osobno — bije wszystko powyżej,
        // bo to jawny wybór właściciela, a nie kolor wylosowany przy tworzeniu.
        ...(surfaceOverride || {}),
      }}
      onDoubleClick={() => {
        if (!data?.locked) {
          setEditValue(String(data?.label || ''));
          setEditing(true);
        }
      }}
    >
      {/* Fala 8: 4-side magnetic handles (Miro/FigJam parity). The two
          UNNAMED handles (target/Top, source/Bottom) are kept id-less on
          purpose — pre-Fala-8 persisted edges have no sourceHandle/
          targetHandle and react-flow resolves an undefined handle id to the
          sole id-less handle of that type on the node, so this keeps every
          existing edge rendering unchanged. All new handles get an explicit
          id so they never collide with that fallback. */}
      <Handle type="target" position={Position.Top} className={WB_HANDLE_CLASS} />
      <Handle type="source" id="top-source" position={Position.Top} className={WB_HANDLE_CLASS} />
      <Handle type="target" id="left" position={Position.Left} className={WB_HANDLE_CLASS} />
      <Handle type="source" id="left-source" position={Position.Left} className={WB_HANDLE_CLASS} />
      <Handle type="target" id="right" position={Position.Right} className={WB_HANDLE_CLASS} />
      <Handle
        type="source"
        id="right-source"
        position={Position.Right}
        className={WB_HANDLE_CLASS}
      />
      <Handle type="target" id="bottom" position={Position.Bottom} className={WB_HANDLE_CLASS} />
      <CommentPinBadge nodeId={nodeId} count={commentCount} />
      {editing ? (
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false);
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              commitEdit();
            }
          }}
          className="w-full bg-transparent text-xs font-medium text-c-text outline-none resize-none border-b border-c-border-strong"
          style={{ minHeight: size.h - 40, ...fontStyle }}
          rows={size.textRows}
        />
      ) : (
        <div>
          {data?.semanticLabel && (
            <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-c-text-muted">
              {String(data.semanticLabel)}
            </div>
          )}
          <div
            className="text-xs font-medium text-c-text whitespace-pre-wrap break-words"
            style={fontStyle}
          >
            {data?.label || ''}
          </div>
        </div>
      )}
      {/* Artifact link indicator */}
      {Array.isArray(data?.artifactLinks) && data.artifactLinks.length > 0 && (
        <div
          className="absolute -bottom-2 -left-2 z-10 flex items-center justify-center w-5 h-5 rounded-full bg-c-tag-2 text-white text-[8px] font-bold shadow-sm cursor-pointer hover:bg-c-tag-2 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(
              new CustomEvent('idea-workspace-quick-action', {
                detail: { action: 'open_linked_artifacts', nodeId },
              })
            );
          }}
          title={t('myWork.whiteboard.linkedArtifactsCount', {
            count: data.artifactLinks.length,
          })}
        >
          🔗
        </div>
      )}
      {/* Converted/promoted badge */}
      {data?._converted && (
        <div
          className="absolute top-1 right-1 z-10 flex items-center justify-center w-4 h-4 rounded-full bg-success-500 text-white text-[8px] shadow-sm"
          title={t('myWork.whiteboard.convertedBadge', 'Converted')}
        >
          ✓
        </div>
      )}
      {data?.author && (
        <div className="absolute bottom-1.5 right-2 text-[8px] text-c-text-muted truncate max-w-[70%] text-right">
          {data.author}
        </div>
      )}
      <WhiteboardNodeReactions
        reactions={data?.reactions}
        currentUserId={String(data?.currentUserId || '')}
        enabled={Boolean(data?.reactionsEnabled)}
        selected={selected}
        onToggle={
          typeof data?.onToggleReaction === 'function'
            ? (emoji: string) => data.onToggleReaction(nodeId, emoji)
            : undefined
        }
      />
      <Handle type="source" position={Position.Bottom} className={WB_HANDLE_CLASS} />
    </div>
  );
};
