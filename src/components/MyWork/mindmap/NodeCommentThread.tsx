/**
 * NodeCommentThread — Full comment threads per node with @mentions.
 * Fetches from server API when available, falls back to prop-based comments.
 */
import { AtSign, Loader2, MessageSquare, Send, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import {
  insertMentionIntoText,
  renderMentionText,
  useMentionAutocomplete,
} from '../mentionAutocomplete';

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
  ideaId: string;
  nodeId: string;
  nodeLabel: string;
  comments: NodeComment[];
  locked: boolean;
  currentUser: string;
  onAddComment: (nodeId: string, comment: NodeComment) => void;
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

export const NodeCommentThread: React.FC<NodeCommentThreadProps> = ({
  open,
  onClose,
  ideaId,
  nodeId,
  nodeLabel,
  comments: propComments,
  locked,
  currentUser,
  onAddComment,
  onDeleteComment,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [text, setText] = useState('');
  const [localComments, setLocalComments] = useState<NodeComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiAvailable, setApiAvailable] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // @mention org-member autocomplete (shared with IdeaNodeDetailDrawer, B2b).
  const {
    mentionPool,
    mentionQuery,
    mentionSuggestions,
    resolveMentionIds,
    handleMentionInput,
    closeMentionMenu,
  } = useMentionAutocomplete(open);

  const comments = apiAvailable ? localComments : propComments;

  useEffect(() => {
    if (!open || !ideaId || !nodeId) return;
    let cancelled = false;
    setLoading(true);

    Api.getNodeComments(ideaId, nodeId)
      .then((res) => {
        if (!cancelled && Array.isArray(res?.comments)) {
          setLocalComments(res.comments);
          setApiAvailable(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLocalComments(propComments);
          setApiAvailable(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, ideaId, nodeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!apiAvailable) setLocalComments(propComments);
  }, [propComments, apiAvailable]);

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Prefer resolved org-member user ids; fall back to bare name tokens.
    const mentions = resolveMentionIds(trimmed);
    closeMentionMenu();

    if (apiAvailable && ideaId) {
      try {
        const res = await Api.addNodeComment(ideaId, nodeId, trimmed, mentions);
        if (res?.comment) {
          setLocalComments((prev) => [...prev, res.comment]);
          onAddComment(nodeId, res.comment);
          setText('');
          inputRef.current?.focus();
          return;
        }
      } catch {
        toast.error(isPl ? 'Nie udało się dodać komentarza' : 'Failed to add comment');
      }
    }

    const comment: NodeComment = {
      id: `comment-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      author: currentUser,
      text: trimmed,
      createdAt: new Date().toISOString(),
      mentions,
    };
    onAddComment(nodeId, comment);
    setLocalComments((prev) => [...prev, comment]);
    setText('');
    inputRef.current?.focus();
  }, [
    apiAvailable,
    closeMentionMenu,
    currentUser,
    ideaId,
    isPl,
    nodeId,
    onAddComment,
    resolveMentionIds,
    text,
  ]);

  const handleDelete = useCallback(
    async (commentId: string) => {
      if (apiAvailable && ideaId) {
        try {
          await Api.deleteNodeComment(ideaId, nodeId, commentId);
          setLocalComments((prev) => prev.filter((c) => c.id !== commentId));
          onDeleteComment(nodeId, commentId);
          return;
        } catch {
          toast.error(isPl ? 'Nie udało się usunąć komentarza' : 'Failed to delete comment');
        }
      }
      onDeleteComment(nodeId, commentId);
      setLocalComments((prev) => prev.filter((c) => c.id !== commentId));
    },
    [apiAvailable, ideaId, isPl, nodeId, onDeleteComment]
  );

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setText(val);
      const caret = e.target.selectionStart ?? val.length;
      handleMentionInput(val, caret);
    },
    [handleMentionInput]
  );

  const insertMention = useCallback(
    (user: { id: string; name: string }) => {
      const ta = inputRef.current;
      const body = text || '';
      const caretPos = ta?.selectionStart ?? body.length;
      const result = insertMentionIntoText(body, caretPos, user);
      if (!result) return;
      setText(result.text);
      closeMentionMenu();
      requestAnimationFrame(() => {
        if (ta) {
          ta.focus();
          ta.setSelectionRange(result.caret, result.caret);
        }
      });
    },
    [closeMentionMenu, text]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && mentionQuery !== null) {
        e.preventDefault();
        closeMentionMenu();
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [closeMentionMenu, handleSubmit, mentionQuery]
  );

  if (!open) return null;

  return (
    <div className="fixed top-0 right-0 bottom-0 z-[86] w-[360px] max-w-[85vw] bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl border-l border-c-border-subtle dark:border-c-border-subtle shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
        <MessageSquare size={14} className="text-c-info shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold text-c-text dark:text-c-text truncate">
            {isPl ? 'Komentarze' : 'Comments'}
          </div>
          <div className="text-[9px] text-c-text-secondary dark:text-c-text-muted truncate">
            {nodeLabel}
          </div>
        </div>
        <span className="text-[10px] text-c-text-secondary font-medium">{comments.length}</span>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-c-text-secondary hover:text-c-text-secondary dark:hover:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading && (
          <div className="flex justify-center py-6">
            <Loader2 size={18} className="animate-spin text-c-info" />
          </div>
        )}

        {!loading && comments.length === 0 && (
          <div className="text-center py-8 text-[11px] text-c-text-secondary">
            {isPl ? 'Brak komentarzy. Napisz pierwszy!' : 'No comments yet. Write the first one!'}
          </div>
        )}

        {!loading &&
          comments.map((c) => (
            <div key={c.id} className="group">
              <div className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-c-surface-raised text-c-info dark:text-c-info flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                  {c.author.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-c-text-secondary dark:text-c-text">
                      {c.author}
                    </span>
                    <span className="text-[8px] text-c-text-secondary">
                      {formatTime(c.createdAt)}
                    </span>
                    {c.author === currentUser && (
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-c-text-secondary hover:text-c-danger transition-all"
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                  <div className="text-[11px] text-c-text-secondary dark:text-c-text-muted mt-0.5 leading-relaxed whitespace-pre-wrap">
                    {renderMentionText(c.text, mentionPool)}
                  </div>
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Input */}
      {!locked && (
        <div className="px-4 py-3 border-t border-c-border-subtle dark:border-c-border-subtle">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              {mentionQuery !== null && mentionSuggestions.length > 0 && (
                <div
                  role="listbox"
                  aria-label={isPl ? 'Wspomnij osobę' : 'Mention a teammate'}
                  className="absolute bottom-full left-0 mb-1 w-64 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-lg max-h-40 overflow-y-auto z-overlay"
                >
                  {mentionSuggestions.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      role="option"
                      className="w-full text-left px-3 py-2 text-[11px] hover:bg-c-surface-raised flex items-center gap-2"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        insertMention(user);
                      }}
                    >
                      <div className="h-6 w-6 rounded-full bg-c-surface-raised text-c-info flex items-center justify-center text-[9px] font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-c-text-secondary truncate">{user.name}</span>
                    </button>
                  ))}
                </div>
              )}
              <textarea
                ref={inputRef}
                value={text}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder={
                  isPl ? 'Napisz komentarz... (@wzmianka)' : 'Write a comment... (@mention)'
                }
                className="w-full px-3 py-2 rounded-xl border border-c-border-subtle dark:border-c-border-subtle bg-c-surface-raised dark:bg-c-surface text-[11px] text-c-text dark:text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-info resize-none"
              />
              <AtSign size={10} className="absolute right-2.5 bottom-2.5 text-c-text-secondary" />
            </div>
            <button
              onClick={handleSubmit}
              disabled={!text.trim()}
              className="p-2.5 rounded-xl bg-c-surface-raised text-c-info dark:text-c-info hover:bg-c-surface-raised transition-colors disabled:opacity-30"
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
