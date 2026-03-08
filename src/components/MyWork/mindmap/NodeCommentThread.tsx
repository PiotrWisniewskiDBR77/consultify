/**
 * NodeCommentThread — Full comment threads per node with @mentions.
 * Persisted in node data.comments array.
 */
import { AtSign, MessageSquare, Send, Trash2, X } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface NodeComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  mentions?: string[];
}

interface NodeCommentThreadProps {
  open: boolean;
  onClose: () => void;
  nodeId: string;
  nodeLabel: string;
  comments: NodeComment[];
  locked: boolean;
  currentUser: string;
  onAddComment: (nodeId: string, comment: NodeComment) => void;
  onDeleteComment: (nodeId: string, commentId: string) => void;
}

function extractMentions(text: string): string[] {
  const matches = text.match(/@(\w+)/g);
  return matches ? matches.map((m) => m.slice(1)) : [];
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

export const NodeCommentThread: React.FC<NodeCommentThreadProps> = ({
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
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const comment: NodeComment = {
      id: `comment-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      author: currentUser,
      text: trimmed,
      createdAt: new Date().toISOString(),
      mentions: extractMentions(trimmed),
    };

    onAddComment(nodeId, comment);
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
    <div className="fixed top-0 right-0 bottom-0 z-[86] w-[360px] max-w-[85vw] bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl border-l border-slate-200/60 dark:border-navy-700/60 shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-200/40 dark:border-navy-700/40">
        <MessageSquare size={14} className="text-blue-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold text-slate-800 dark:text-white truncate">
            {isPl ? 'Komentarze' : 'Comments'}
          </div>
          <div className="text-[9px] text-slate-500 dark:text-slate-400 truncate">{nodeLabel}</div>
        </div>
        <span className="text-[10px] text-slate-400 font-medium">{comments.length}</span>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {comments.length === 0 && (
          <div className="text-center py-8 text-[11px] text-slate-400">
            {isPl ? 'Brak komentarzy. Napisz pierwszy!' : 'No comments yet. Write the first one!'}
          </div>
        )}

        {comments.map((c) => (
          <div key={c.id} className="group">
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                {c.author.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                    {c.author}
                  </span>
                  <span className="text-[8px] text-slate-400">{formatTime(c.createdAt)}</span>
                  {c.author === currentUser && (
                    <button
                      onClick={() => onDeleteComment(nodeId, c.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed whitespace-pre-wrap">
                  {c.text.split(/(@\w+)/g).map((part, idx) =>
                    part.startsWith('@') ? (
                      <span key={idx} className="text-blue-500 font-medium">
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
        <div className="px-4 py-3 border-t border-slate-200/40 dark:border-navy-700/40">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder={
                  isPl ? 'Napisz komentarz... (@wzmianka)' : 'Write a comment... (@mention)'
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white/50 dark:bg-navy-950/30 text-[11px] text-slate-800 dark:text-slate-200 placeholder:text-slate-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
              />
              <AtSign size={10} className="absolute right-2.5 bottom-2.5 text-slate-300" />
            </div>
            <button
              onClick={handleSubmit}
              disabled={!text.trim()}
              className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-30"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NodeCommentThread;
