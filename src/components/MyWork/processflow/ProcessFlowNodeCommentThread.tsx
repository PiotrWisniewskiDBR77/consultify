/**
 * ProcessFlowNodeCommentThread — comment thread panel for a Process Flow
 * node (M07 F5b B3).
 *
 * Local counterpart to Mind Map's `NodeCommentThread`. Persistence contract
 * differs (blob-only via `node.data.comments[]`, no server API — see
 * nodeComments.ts header), and this uses canon `var(--c-*)` tokens instead of
 * Mind Map's hardcoded blue/danger Tailwind classes (reżim wizualny: zero
 * nowych kolorów). Behaviour (mentions, Enter-to-send, delete-own-comment) is
 * otherwise the same shape.
 */
import { AtSign, Send, Trash2, X } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

import type { ProcessFlowNodeComment } from './nodeComments';
import { buildProcessFlowComment } from './nodeComments';

interface ProcessFlowNodeCommentThreadProps {
  open: boolean;
  onClose: () => void;
  nodeId: string;
  nodeLabel: string;
  comments: ProcessFlowNodeComment[];
  locked: boolean;
  currentUser: string;
  isPl: boolean;
  onAddComment: (nodeId: string, comment: ProcessFlowNodeComment) => void;
  onDeleteComment: (nodeId: string, commentId: string) => void;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const ProcessFlowNodeCommentThread: React.FC<ProcessFlowNodeCommentThreadProps> = ({
  open,
  onClose,
  nodeId,
  nodeLabel,
  comments,
  locked,
  currentUser,
  onAddComment,
  onDeleteComment,
}) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef: dialogRef, initialFocusRef: inputRef });

  const handleSubmit = useCallback(() => {
    if (!text.trim()) return;
    onAddComment(nodeId, buildProcessFlowComment(currentUser, text));
    setText('');
    inputRef.current?.focus();
  }, [currentUser, nodeId, onAddComment, text]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="processflow-node-comment-thread-title"
      tabIndex={-1}
      className="fixed top-0 right-0 bottom-0 z-[86] w-[360px] max-w-[85vw] bg-c-surface border-l border-c-border-subtle shadow-2xl flex flex-col overflow-hidden outline-none"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-c-border-subtle">
        <div className="min-w-0 flex-1">
          <div
            id="processflow-node-comment-thread-title"
            className="text-[11px] font-bold text-c-text truncate"
          >
            {t('processFlow.nodeCommentThread.title', 'Comments')}
          </div>
          <div className="text-[9px] text-c-text-muted truncate">{nodeLabel}</div>
        </div>
        <span className="text-[10px] text-c-text-muted font-medium">{comments.length}</span>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-c-text-muted hover:bg-c-surface-raised transition-colors"
          aria-label={t('processFlow.nodeCommentThread.close', 'Close')}
        >
          <X size={14} />
        </button>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {comments.length === 0 && (
          <div className="text-center py-8 text-[11px] text-c-text-muted">
            {t('processFlow.nodeCommentThread.empty', 'No comments yet. Write the first one!')}
          </div>
        )}

        {comments.map((c) => (
          <div key={c.id} className="group">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-c-surface-raised text-c-info flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                {c.author.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-c-text">{c.author}</span>
                  <span className="text-[8px] text-c-text-muted">{formatTime(c.createdAt)}</span>
                  {c.author === currentUser && !locked && (
                    <button
                      onClick={() => onDeleteComment(nodeId, c.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-c-text-muted hover:text-c-danger transition-all"
                      aria-label={t(
                        'processFlow.nodeCommentThread.deleteComment',
                        'Delete comment'
                      )}
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
                <div className="text-[11px] text-c-text-secondary mt-0.5 leading-relaxed whitespace-pre-wrap">
                  {c.text.split(/(@\w+)/g).map((part, idx) =>
                    part.startsWith('@') ? (
                      <span key={idx} className="text-c-info font-medium">
                        {part}
                      </span>
                    ) : (
                      <span key={idx}>{part}</span>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      {!locked && (
        <div className="px-4 py-3 border-t border-c-border-subtle">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder={t(
                  'processFlow.nodeCommentThread.placeholder',
                  'Write a comment... (@mention)'
                )}
                className="w-full px-3 py-2 rounded-xl border border-c-border-subtle bg-c-bg text-[11px] text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-focus resize-none"
              />
              <AtSign size={10} className="absolute right-2.5 bottom-2.5 text-c-text-muted" />
            </div>
            <button
              onClick={handleSubmit}
              disabled={!text.trim()}
              className="p-2.5 rounded-xl bg-c-surface-raised text-c-info hover:opacity-80 transition-opacity disabled:opacity-30"
              aria-label={t('processFlow.nodeCommentThread.send', 'Send')}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessFlowNodeCommentThread;
