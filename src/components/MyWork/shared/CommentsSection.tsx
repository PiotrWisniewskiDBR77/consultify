/**
 * CommentsSection
 * Shared comments thread component for Task and Decision detail views
 * ClickUp-style design following Golden Standard
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  Loader2,
  MessageCircle,
  MoreVertical,
  Send,
  ThumbsUp,
  Trash2,
  User,
} from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

export interface Comment {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  createdAt: string;
  updatedAt?: string;
  likes: number;
  likedByMe: boolean;
  parentId?: string;
  replies?: Comment[];
}

interface CommentsSectionProps {
  comments: Comment[];
  onAddComment: (content: string, parentId?: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onLikeComment: (commentId: string) => Promise<void>;
  currentUserId?: string;
  readOnly?: boolean;
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({
  comments,
  onAddComment,
  onDeleteComment,
  onLikeComment,
  currentUserId,
  readOnly = false,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return isPolish ? 'Przed chwilą' : 'Just now';
    if (diffMins < 60) return isPolish ? `${diffMins} min temu` : `${diffMins}m ago`;
    if (diffHours < 24) return isPolish ? `${diffHours} godz. temu` : `${diffHours}h ago`;
    if (diffDays < 7) return isPolish ? `${diffDays} dni temu` : `${diffDays}d ago`;

    return date.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSubmit = useCallback(async () => {
    if (!newComment.trim()) return;

    try {
      setSubmitting(true);
      await onAddComment(newComment.trim());
      setNewComment('');
      toast.success(isPolish ? 'Komentarz dodany' : 'Comment added');
    } catch (error) {
      toast.error(isPolish ? 'Nie udało się dodać komentarza' : 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  }, [newComment, onAddComment, isPolish]);

  const handleReply = useCallback(
    async (parentId: string) => {
      if (!replyContent.trim()) return;

      try {
        setSubmitting(true);
        await onAddComment(replyContent.trim(), parentId);
        setReplyContent('');
        setReplyingTo(null);
        // Auto-expand replies
        setExpandedReplies((prev) => new Set([...prev, parentId]));
        toast.success(isPolish ? 'Odpowiedź dodana' : 'Reply added');
      } catch (error) {
        toast.error(isPolish ? 'Nie udało się dodać odpowiedzi' : 'Failed to add reply');
      } finally {
        setSubmitting(false);
      }
    },
    [replyContent, onAddComment, isPolish]
  );

  const handleDelete = useCallback(
    async (commentId: string) => {
      if (
        !confirm(
          isPolish
            ? 'Czy na pewno chcesz usunąć ten komentarz?'
            : 'Are you sure you want to delete this comment?'
        )
      ) {
        return;
      }

      try {
        await onDeleteComment(commentId);
        toast.success(isPolish ? 'Komentarz usunięty' : 'Comment deleted');
      } catch (error) {
        toast.error(isPolish ? 'Nie udało się usunąć komentarza' : 'Failed to delete comment');
      }
    },
    [onDeleteComment, isPolish]
  );

  const toggleReplies = (commentId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  // Get top-level comments (no parentId)
  const topLevelComments = comments.filter((c) => !c.parentId);

  const renderComment = (comment: Comment, isReply = false) => {
    const hasReplies = comment.replies && comment.replies.length > 0;
    const isExpanded = expandedReplies.has(comment.id);
    const canDelete = comment.authorId === currentUserId;

    return (
      <motion.div
        key={comment.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`group ${isReply ? 'ml-8 mt-3' : ''}`}
      >
        <div className="flex gap-3">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {comment.authorAvatar ? (
              <img
                src={comment.authorAvatar}
                alt={comment.authorName}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                <span className="text-xs font-medium text-white">
                  {comment.authorName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="bg-slate-50 dark:bg-navy-800 rounded-lg px-4 py-3">
              {/* Header */}
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-slate-800 dark:text-white">
                    {comment.authorName}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {formatDate(comment.createdAt)}
                  </span>
                  {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                      ({isPolish ? 'edytowano' : 'edited'})
                    </span>
                  )}
                </div>

                {/* Actions Menu */}
                {canDelete && !readOnly && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 dark:hover:bg-navy-700 transition-all"
                    title={isPolish ? 'Usuń' : 'Delete'}
                  >
                    <Trash2 size={14} className="text-slate-400 hover:text-red-500" />
                  </button>
                )}
              </div>

              {/* Content */}
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                {comment.content}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4 mt-2 ml-2">
              {/* Like */}
              <button
                onClick={() => onLikeComment(comment.id)}
                className={`flex items-center gap-1.5 text-xs transition-colors ${
                  comment.likedByMe
                    ? 'text-primary-500'
                    : 'text-slate-400 hover:text-primary-500 dark:text-slate-500'
                }`}
              >
                <ThumbsUp size={14} className={comment.likedByMe ? 'fill-current' : ''} />
                {comment.likes > 0 && <span>{comment.likes}</span>}
              </button>

              {/* Reply */}
              {!readOnly && !isReply && (
                <button
                  onClick={() => setReplyingTo(comment.id)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-primary-500 dark:text-slate-500 transition-colors"
                >
                  <CornerDownRight size={14} />
                  <span>{isPolish ? 'Odpowiedz' : 'Reply'}</span>
                </button>
              )}

              {/* Toggle Replies */}
              {hasReplies && (
                <button
                  onClick={() => toggleReplies(comment.id)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                >
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>
                    {comment.replies?.length}{' '}
                    {isPolish
                      ? comment.replies?.length === 1
                        ? 'odpowiedź'
                        : 'odpowiedzi'
                      : comment.replies?.length === 1
                      ? 'reply'
                      : 'replies'}
                  </span>
                </button>
              )}
            </div>

            {/* Reply Input */}
            <AnimatePresence>
              {replyingTo === comment.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 ml-4"
                >
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder={isPolish ? 'Napisz odpowiedź...' : 'Write a reply...'}
                      className="flex-1 px-3 py-2 rounded-lg text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 outline-none transition-all"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleReply(comment.id);
                        }
                        if (e.key === 'Escape') {
                          setReplyingTo(null);
                          setReplyContent('');
                        }
                      }}
                      autoFocus
                    />
                    <button
                      onClick={() => handleReply(comment.id)}
                      disabled={submitting || !replyContent.trim()}
                      className="px-3 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 transition-colors"
                    >
                      {submitting ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Send size={16} />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setReplyingTo(null);
                        setReplyContent('');
                      }}
                      className="px-3 py-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
                    >
                      {isPolish ? 'Anuluj' : 'Cancel'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Replies */}
            <AnimatePresence>
              {isExpanded && hasReplies && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2"
                >
                  {comment.replies?.map((reply) => renderComment(reply, true))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="bg-white dark:bg-navy-900 rounded-xl p-4 border border-slate-200 dark:border-navy-700">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 text-slate-700 dark:text-slate-300">
        <MessageCircle size={16} />
        <span className="text-sm font-medium">
          {isPolish ? 'Komentarze' : 'Comments'}
        </span>
        {comments.length > 0 && (
          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400">
            {comments.length}
          </span>
        )}
      </div>

      {/* Comments List */}
      {topLevelComments.length === 0 ? (
        <div className="text-center py-6 text-slate-400 dark:text-slate-500">
          <MessageCircle size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">{isPolish ? 'Brak komentarzy' : 'No comments yet'}</p>
        </div>
      ) : (
        <div className="space-y-4 mb-4">
          <AnimatePresence>
            {topLevelComments.map((comment) => renderComment(comment))}
          </AnimatePresence>
        </div>
      )}

      {/* New Comment Input */}
      {!readOnly && (
        <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-navy-700">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
              <User size={16} className="text-white" />
            </div>
          </div>
          <div className="flex-1 flex gap-2">
            <textarea
              ref={textareaRef}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={isPolish ? 'Napisz komentarz...' : 'Write a comment...'}
              rows={1}
              className="flex-1 px-4 py-2 rounded-lg text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 outline-none transition-all resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={submitting || !newComment.trim()}
              className="px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Send size={16} />
                  <span className="hidden sm:inline">
                    {isPolish ? 'Wyślij' : 'Send'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommentsSection;
