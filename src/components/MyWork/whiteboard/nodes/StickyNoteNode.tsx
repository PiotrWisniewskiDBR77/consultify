import React from 'react';
import { Handle, type NodeProps, Position } from 'reactflow';

import { CommentPinBadge, commentCountOf } from './CommentPinBadge';
import { WhiteboardNodeReactions } from './WhiteboardNodeReactions';
import { STICKY_COLORS, STICKY_SIZES, useIsDark } from './whiteboardNodeHelpers';

export const StickyNoteNode: React.FC<NodeProps> = ({ id: nodeId, data, selected }) => {
  const isDark = useIsDark();
  const colorIdx = (data?.colorIndex ?? 0) % STICKY_COLORS.length;
  const color = STICKY_COLORS[colorIdx];
  const sizeKey = (data?.size as string) || 'm';
  const size = STICKY_SIZES[sizeKey] || STICKY_SIZES.m;
  const [editing, setEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(String(data?.label || ''));
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }
  }, [editing]);

  const commitEdit = () => {
    setEditing(false);
    if (data?.onLabelChange && editValue !== data?.label) {
      data.onLabelChange(editValue);
    }
  };

  const commentCount = commentCountOf(data);
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
      }}
      onDoubleClick={() => {
        if (!data?.locked) {
          setEditValue(String(data?.label || ''));
          setEditing(true);
        }
      }}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-c-border-strong !-top-1" />
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
          style={{ minHeight: size.h - 40 }}
          rows={size.textRows}
        />
      ) : (
        <div>
          {data?.semanticLabel && (
            <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-c-text-muted">
              {String(data.semanticLabel)}
            </div>
          )}
          <div className="text-xs font-medium text-c-text whitespace-pre-wrap break-words">
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
          title={`${data.artifactLinks.length} linked artifact${data.artifactLinks.length !== 1 ? 's' : ''}`}
        >
          🔗
        </div>
      )}
      {/* Converted/promoted badge */}
      {data?._converted && (
        <div
          className="absolute top-1 right-1 z-10 flex items-center justify-center w-4 h-4 rounded-full bg-success-500 text-white text-[8px] shadow-sm"
          title="Converted"
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
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-c-border-strong !-bottom-1"
      />
    </div>
  );
};
