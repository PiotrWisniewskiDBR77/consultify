import {
  AtSign,
  Check,
  CheckCircle2,
  Edit,
  MessageSquare,
  MoreVertical,
  RefreshCw,
  Reply,
  Send,
  Trash2,
  User,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import type { ContentComment } from '../../types';

interface PlaybookTemplateCommentsProps {
  templateId: string;
  onCommentCountChange?: (count: number) => void;
}

export const PlaybookTemplateComments: React.FC<PlaybookTemplateCommentsProps> = ({
  templateId,
  onCommentCountChange,
}) => {
  const token = localStorage.getItem('token');

  const [comments, setComments] = useState<ContentComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/content/playbooks/templates/${templateId}/comments?includeResolved=${showResolved}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.ok) {
        const data = await res.json();
        setComments(data.comments || []);

        // Count total comments including replies
        const countComments = (items: ContentComment[]): number => {
          return items.reduce((sum, item) => {
            return sum + 1 + (item.replies ? countComments(item.replies) : 0);
          }, 0);
        };
        onCommentCountChange?.(countComments(data.comments || []));
      }
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoading(false);
    }
  }, [token, templateId, showResolved, onCommentCountChange]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/content/playbooks/templates/${templateId}/comments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ commentText: newComment.trim() }),
      });

      if (res.ok) {
        setNewComment('');
        loadComments();
      }
    } catch (err) {
      console.error('Failed to submit comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!replyText.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/content/playbooks/templates/${templateId}/comments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commentText: replyText.trim(),
          parentCommentId: parentId,
        }),
      });

      if (res.ok) {
        setReplyText('');
        setReplyingTo(null);
        loadComments();
      }
    } catch (err) {
      console.error('Failed to submit reply:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editText.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/content/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ commentText: editText.trim() }),
      });

      if (res.ok) {
        setEditingId(null);
        setEditText('');
        loadComments();
      }
    } catch (err) {
      console.error('Failed to edit comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveComment = async (commentId: string) => {
    try {
      await fetch(`/api/content/comments/${commentId}/resolve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      loadComments();
    } catch (err) {
      console.error('Failed to resolve comment:', err);
    }
    setMenuOpen(null);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      await fetch(`/api/content/comments/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      loadComments();
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
    setMenuOpen(null);
  };

  const renderComment = (comment: ContentComment, depth = 0) => (
    <div
      key={comment.id}
      className={`${depth > 0 ? 'ml-8 border-l-2 border-c-border-subtle/50 pl-4' : ''}`}
    >
      <div
        className={`p-4 rounded-lg ${comment.isResolved ? 'bg-c-surface-raised/30' : 'bg-c-surface-raised/50'} border border-slate-700/50`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
              {comment.user ? (
                <span className="text-xs font-medium text-c-text">
                  {comment.user.firstName?.[0]}
                  {comment.user.lastName?.[0]}
                </span>
              ) : (
                <User size={14} className="text-c-text" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-c-text text-sm">
                  {comment.user
                    ? `${comment.user.firstName} ${comment.user.lastName}`
                    : 'Unknown User'}
                </span>
                {comment.isResolved && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs rounded-full">
                    <CheckCircle2 size={10} />
                    Resolved
                  </span>
                )}
                {comment.isEdited && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">(edited)</span>
                )}
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(comment.createdAt).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setMenuOpen(menuOpen === comment.id ? null : comment.id)}
              className="p-1 text-slate-600 dark:text-slate-500 hover:text-white rounded"
            >
              <MoreVertical size={16} />
            </button>

            {menuOpen === comment.id && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-c-surface-raised border border-c-border-subtle rounded-lg shadow-xl z-10 py-1">
                <button
                  onClick={() => {
                    setEditingId(comment.id);
                    setEditText(comment.commentText);
                    setMenuOpen(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-c-surface-raised/50"
                >
                  <Edit size={14} />
                  Edit
                </button>
                {!comment.isResolved && (
                  <button
                    onClick={() => handleResolveComment(comment.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10"
                  >
                    <CheckCircle2 size={14} />
                    Resolve
                  </button>
                )}
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger-400 hover:bg-danger-500/10"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {editingId === comment.id ? (
          <div className="mt-3 space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full px-3 py-2 bg-c-text text-c-bg border border-c-border-subtle rounded-lg text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setEditingId(null);
                  setEditText('');
                }}
                className="px-3 py-1.5 text-slate-600 dark:text-slate-500 hover:text-white text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleEditComment(comment.id)}
                disabled={submitting}
                className="px-3 py-1.5 bg-c-text text-c-bg text-sm rounded-lg hover:bg-c-text-secondary disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-slate-600 text-sm whitespace-pre-wrap">{comment.commentText}</p>
        )}

        {/* Actions */}
        {!editingId && (
          <div className="mt-3 flex items-center gap-4">
            <button
              onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
              className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-500 hover:text-primary-400"
            >
              <Reply size={14} />
              Reply
            </button>
          </div>
        )}

        {/* Reply form */}
        {replyingTo === comment.id && (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              className="flex-1 px-3 py-2 bg-c-text text-c-bg border border-c-border-subtle rounded-lg text-sm placeholder-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              onKeyPress={(e) => e.key === 'Enter' && handleSubmitReply(comment.id)}
            />
            <button
              onClick={() => handleSubmitReply(comment.id)}
              disabled={submitting || !replyText.trim()}
              className="px-3 py-2 bg-c-text text-c-bg rounded-lg hover:bg-c-text-secondary disabled:opacity-50"
            >
              <Send size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {comment.replies.map((reply) => renderComment(reply, depth + 1))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary-400" />
          <h3 className="font-semibold text-c-text">Comments</h3>
          <span className="px-2 py-0.5 bg-c-surface-raised text-slate-600 text-xs rounded-full">
            {comments.length}
          </span>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-500 cursor-pointer">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="rounded border-slate-600 bg-c-surface-raised text-primary-500 focus:ring-primary-500/50"
          />
          Show resolved
        </label>
      </div>

      {/* New comment form */}
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0">
          <User size={14} className="text-c-text" />
        </div>
        <div className="flex-1">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={3}
            className="w-full px-3 py-2 bg-c-surface-raised/50 border border-c-border-subtle/50 rounded-lg text-c-text placeholder-slate-500 resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleSubmitComment}
              disabled={submitting || !newComment.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg font-medium hover:from-primary-600 hover:to-primary-700 disabled:opacity-50"
            >
              {submitting ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
              Comment
            </button>
          </div>
        </div>
      </div>

      {/* Comments list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 text-slate-600 dark:text-slate-500 animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8">
          <MessageSquare className="w-10 h-10 text-slate-600 dark:text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-slate-500">No comments yet</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Be the first to leave a comment
          </p>
        </div>
      ) : (
        <div className="space-y-4">{comments.map((comment) => renderComment(comment))}</div>
      )}

      {/* Click away handler */}
      {menuOpen && <div className="fixed inset-0 z-0" onClick={() => setMenuOpen(null)} />}
    </div>
  );
};

export default PlaybookTemplateComments;
