import React from 'react';
import { useTranslation } from 'react-i18next';
import { Handle, type NodeProps, NodeResizer, Position } from 'reactflow';

import { commentCountOf, CommentPinBadge } from './CommentPinBadge';
import {
  resolveNodeAccentBg,
  resolveNodeFontStyle,
  resolveNodeSurfaceOverride,
  WB_HANDLE_CLASS,
} from './whiteboardNodeHelpers';

export const TextBlockNode: React.FC<NodeProps> = ({ id: nodeId, data, selected }) => {
  const { t } = useTranslation();
  // Z15: per-element style overrides written by the floating style bar.
  const accentBg = resolveNodeAccentBg(data?.accentColor);
  const fontStyle = resolveNodeFontStyle(data);
  // WB-P2-01: same immediate-naming contract as StickyNoteNode — see its
  // comment for the `_isNew`/`onConsumeAutoEdit` rationale.
  const [editing, setEditing] = React.useState(() => Boolean(data?._isNew));
  const [editValue, setEditValue] = React.useState(String(data?.label || ''));
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }
  }, [editing]);

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

  return (
    <>
      <NodeResizer isVisible={selected && !data?.locked} minWidth={100} minHeight={40} />
      <div
        className={`group relative w-full h-full min-w-[100px] min-h-[40px] overflow-auto p-3 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface dark:backdrop-blur-md shadow-lg dark:shadow-[0_0_12px_rgba(148,163,184,0.15)] transition-shadow ${selected ? 'ring-2 ring-c-border-strong shadow-xl' : ''}`}
        style={{ ...(accentBg || {}), ...(resolveNodeSurfaceOverride(data, 22) || {}) }}
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
        <CommentPinBadge nodeId={nodeId} count={commentCount} positionClassName="top-1 left-1" />
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
            className="w-full min-h-[40px] bg-transparent text-xs text-c-text outline-none resize-none border-b border-c-border-strong"
            style={fontStyle}
            rows={2}
          />
        ) : (
          <div>
            {data?.semanticLabel && (
              <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-c-text-muted">
                {String(data.semanticLabel)}
              </div>
            )}
            <div className="text-xs text-c-text whitespace-pre-wrap break-words" style={fontStyle}>
              {data?.label || ''}
            </div>
          </div>
        )}
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
        {data?._converted && (
          <div
            className="absolute top-1 right-1 z-10 flex items-center justify-center w-4 h-4 rounded-full bg-success-500 text-white text-[8px] shadow-sm"
            title={t('myWork.whiteboard.convertedBadge', 'Converted')}
          >
            ✓
          </div>
        )}
        <Handle type="source" position={Position.Bottom} className={WB_HANDLE_CLASS} />
      </div>
    </>
  );
};
