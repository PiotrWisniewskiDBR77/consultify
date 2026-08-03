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
  Sparkles,
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
  likedByMe?: boolean;
  parentId?: string;
  replies?: Comment[];
  isAIGenerated?: boolean;
}

interface CommentsSectionProps {
  comments: Comment[];
  onAddComment: (content: string, parentId?: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onLikeComment: (commentId: string) => Promise<void>;
  onGenerateAIComment?: () => Promise<void>;
  isGeneratingAI?: boolean;
  currentUserId?: string;
  readOnly?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({
  comments,
  onAddComment,
  onDeleteComment,
  onLikeComment,
  onGenerateAIComment,
  isGeneratingAI = false,
  currentUserId,
  readOnly = false,
  expanded = false,
  onToggleExpand,
}) => {
  const { t } = useTranslation();
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

    if (diffMins < 1) return t('myWork.comments.justNow', 'Just now');
    if (diffMins < 60) return t('myWork.comments.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('myWork.comments.hoursAgo', { count: diffHours });
    if (diffDays < 7) return t('myWork.comments.daysAgo', { count: diffDays });

    return date.toLocaleDateString(t('myWork.comments.dateToLocaleDateString', 'en-US'), {
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
      toast.success(t('myWork.comments.toastSuccess', 'Comment added'));
    } catch (error) {
      toast.error(t('myWork.comments.toastError', 'Failed to add comment'));
    } finally {
      setSubmitting(false);
    }
  }, [newComment, onAddComment]);

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
        toast.success(t('myWork.comments.toastSuccess2', 'Reply added'));
      } catch (error) {
        toast.error(t('myWork.comments.toastError2', 'Failed to add reply'));
      } finally {
        setSubmitting(false);
      }
    },
    [replyContent, onAddComment]
  );

  const handleDelete = useCallback(
    async (commentId: string) => {
      if (
        !confirm(
          t('myWork.comments.areYouSureYou', 'Are you sure you want to delete this comment?')
        )
      ) {
        return;
      }

      try {
        await onDeleteComment(commentId);
        toast.success(t('myWork.comments.toastSuccess3', 'Comment deleted'));
      } catch (error) {
        toast.error(t('myWork.comments.toastError3', 'Failed to delete comment'));
      }
    },
    [onDeleteComment]
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
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                <span className="text-xs font-medium text-slate-900 dark:text-white">
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
                  <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">
                    {formatDate(comment.createdAt)}
                  </span>
                  {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 italic">
                      ({t('myWork.comments.edited', 'edited')})
                    </span>
                  )}
                </div>

                {/* Actions Menu */}
                {canDelete && !readOnly && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 dark:hover:bg-navy-700 transition-all"
                    title={t('myWork.comments.title', 'Delete')}
                  >
                    <Trash2
                      size={14}
                      className="text-slate-500 dark:text-slate-400 hover:text-danger-500"
                    />
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
                    ? 'text-c-info'
                    : 'text-slate-500 dark:text-slate-400 hover:text-c-info dark:text-slate-500'
                }`}
              >
                <ThumbsUp size={14} className={comment.likedByMe ? 'fill-current' : ''} />
                {comment.likes > 0 && <span>{comment.likes}</span>}
              </button>

              {/* Reply */}
              {!readOnly && !isReply && (
                <button
                  onClick={() => setReplyingTo(comment.id)}
                  className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-c-info dark:text-slate-500 transition-colors"
                >
                  <CornerDownRight size={14} />
                  <span>{t('myWork.comments.reply', 'Reply')}</span>
                </button>
              )}

              {/* Toggle Replies */}
              {hasReplies && (
                <button
                  onClick={() => toggleReplies(comment.id)}
                  className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                >
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>
                    {t('myWork.comments.repliesCount', { count: comment.replies?.length ?? 0 })}
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
                      placeholder={t('myWork.comments.placeholder', 'Write a reply...')}
                      className="flex-1 px-3 py-2 rounded-lg text-sm bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-c-focus-solid focus:ring-1 focus:ring-c-focus outline-none transition-all"
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
                      className="px-3 py-2 rounded-lg bg-c-text text-c-bg hover:bg-c-text-secondary disabled:opacity-50 transition-colors"
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
                      {t('myWork.comments.cancel', 'Cancel')}
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/50 shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden"
    >
      {/* Collapsible Header */}
      <motion.button
        whileHover={{ backgroundColor: 'rgba(148, 163, 184, 0.1)' }}
        whileTap={{ scale: 0.98 }}
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-navy-800/50 transition-colors duration-200"
      >
        <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
          <div className="p-2 rounded-xl bg-c-info/10 dark:bg-c-info/20">
            <MessageCircle size={18} className="text-c-info dark:text-c-info" />
          </div>
          <span className="text-sm font-semibold">{t('myWork.comments.comments', 'Comments')}</span>
        </div>
        <div className="flex items-center gap-2">
          {comments.length > 0 && (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 dark:text-slate-500">
              {comments.length}
            </span>
          )}
          {/* AI Button - visible only when expanded */}
          <AnimatePresence>
            {expanded && onGenerateAIComment && !readOnly && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onGenerateAIComment();
                }}
                disabled={isGeneratingAI}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-c-info/10 dark:bg-c-info/20 text-c-info dark:text-c-info hover:bg-c-info/20 dark:hover:bg-c-info/30 text-xs font-medium transition-all disabled:opacity-50"
                title={t('myWork.comments.title2', 'Generate AI comment')}
              >
                {isGeneratingAI ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                <span>AI</span>
              </motion.button>
            )}
          </AnimatePresence>
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={18} className="text-slate-500 dark:text-slate-400" />
          </motion.div>
        </div>
      </motion.button>

      {/* Collapsible Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="border-t border-slate-200 dark:border-navy-700 overflow-hidden"
          >
            <div className="p-4">
              {/* Comments List */}
              {topLevelComments.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-10 text-slate-500 dark:text-slate-400 dark:text-slate-500"
                >
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                    className="inline-block mb-3 p-4 rounded-2xl bg-gradient-to-br from-c-info/10 to-c-info/5 dark:from-c-info/20 dark:to-c-info/10"
                  >
                    <MessageCircle size={40} className="text-c-info opacity-60" />
                  </motion.div>
                  <p className="text-sm font-medium">
                    {t('myWork.comments.noCommentsYet', 'No comments yet')}
                  </p>
                  <p className="text-xs mt-1 text-slate-500 dark:text-slate-400 dark:text-slate-500">
                    {t('myWork.comments.startTheConversation', 'Start the conversation...')}
                  </p>
                </motion.div>
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
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                      <User size={16} className="text-slate-900 dark:text-white" />
                    </div>
                  </div>
                  <div className="flex-1 flex gap-2">
                    <textarea
                      ref={textareaRef}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder={t('myWork.comments.placeholder2', 'Write a comment...')}
                      rows={1}
                      className="flex-1 px-4 py-2 rounded-lg text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-c-focus-solid focus:ring-1 focus:ring-c-focus outline-none transition-all resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit();
                        }
                      }}
                    />
                    {/* Send Button */}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSubmit}
                      disabled={submitting || !newComment.trim()}
                      className="px-5 py-2.5 rounded-xl bg-c-text text-c-bg font-semibold hover:bg-c-text-secondary disabled:opacity-50 transition-all duration-200 flex items-center gap-2 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <>
                          <Send size={18} />
                          <span className="hidden sm:inline">
                            {t('myWork.comments.send', 'Send')}
                          </span>
                        </>
                      )}
                    </motion.button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CommentsSection;
