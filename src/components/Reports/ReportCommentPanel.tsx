/**
 * ReportCommentPanel
 *
 * Side panel for viewing and adding comments on report sections.
 * Supports AI-powered comment processing and section regeneration.
 */

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  MessageCircle,
  MessageSquare,
  MoreVertical,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
// Helper to get auth token from localStorage
const getAuthToken = () => localStorage.getItem('token');

interface Comment {
  id: string;
  sectionId: string;
  sectionType: string;
  userId: string;
  userName: string;
  userFullName?: string;
  content: string;
  commentType: 'FEEDBACK' | 'SUGGESTION' | 'QUESTION' | 'APPROVAL' | 'REJECTION';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED';
  aiResponse?: string;
  aiSuggestedEdits?: string[];
  aiProcessedAt?: string;
  parentCommentId?: string;
  threadPosition?: number;
  createdAt: string;
  updatedAt: string;
}

interface ReportCommentPanelProps {
  reportId: string;
  sectionId?: string;
  sectionName?: string;
  onClose: () => void;
  onRegenerateSection?: (sectionId: string, feedback: string) => void;
}

const COMMENT_TYPE_CONFIG = {
  FEEDBACK: {
    label: 'Feedback',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  SUGGESTION: {
    label: 'Suggestion',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  QUESTION: {
    label: 'Question',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
  APPROVAL: {
    label: 'Approval',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  REJECTION: {
    label: 'Rejection',
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
};

const STATUS_CONFIG = {
  OPEN: { label: 'Open', icon: Clock, color: 'text-amber-500' },
  IN_PROGRESS: { label: 'In Progress', icon: RefreshCw, color: 'text-blue-500' },
  RESOLVED: { label: 'Resolved', icon: CheckCircle2, color: 'text-green-500' },
  DISMISSED: { label: 'Dismissed', icon: X, color: 'text-slate-400 dark:text-slate-500' },
};

export const ReportCommentPanel: React.FC<ReportCommentPanelProps> = ({
  reportId,
  sectionId,
  sectionName,
  onClose,
  onRegenerateSection,
}) => {
  const token = getAuthToken();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [commentType, setCommentType] = useState<'FEEDBACK' | 'SUGGESTION' | 'QUESTION'>(
    'FEEDBACK'
  );
  const [submitting, setSubmitting] = useState(false);
  const [processingAI, setProcessingAI] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [showTypeSelector, setShowTypeSelector] = useState(false);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const url = sectionId
        ? `/api/report-comments/${reportId}?sectionId=${sectionId}`
        : `/api/report-comments/${reportId}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error('[ReportCommentPanel] Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [reportId, sectionId, token]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Submit new comment
  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/report-comments/${reportId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sectionId,
          content: newComment.trim(),
          commentType,
        }),
      });

      if (response.ok) {
        const created = await response.json();
        setComments((prev) => [created, ...prev]);
        setNewComment('');
      }
    } catch (error) {
      console.error('[ReportCommentPanel] Submit error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Process comment with AI
  const handleProcessWithAI = async (commentId: string) => {
    setProcessingAI(commentId);
    try {
      const response = await fetch(`/api/report-comments/${reportId}/${commentId}/process-ai`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const result = await response.json();
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  aiResponse: result.aiResponse,
                  aiSuggestedEdits: result.suggestedEdits,
                  aiProcessedAt: result.processedAt,
                }
              : c
          )
        );
        setExpandedComments((prev) => new Set([...prev, commentId]));
      }
    } catch (error) {
      console.error('[ReportCommentPanel] AI process error:', error);
    } finally {
      setProcessingAI(null);
    }
  };

  // Update comment status
  const handleUpdateStatus = async (commentId: string, status: string) => {
    try {
      const response = await fetch(`/api/report-comments/${reportId}/${commentId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, status: status as Comment['status'] } : c))
        );
      }
    } catch (error) {
      console.error('[ReportCommentPanel] Status update error:', error);
    }
  };

  // Delete comment
  const handleDelete = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;

    try {
      const response = await fetch(`/api/report-comments/${reportId}/${commentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      }
    } catch (error) {
      console.error('[ReportCommentPanel] Delete error:', error);
    }
  };

  // Toggle comment expansion
  const toggleExpanded = (commentId: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-navy-700">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-500" />
            <div>
              <h3 className="font-semibold text-navy-900 dark:text-white">Comments</h3>
              {sectionName && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{sectionName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3 text-xs">
          <span className="text-slate-500 dark:text-slate-400">{comments.length} comments</span>
          <span className="flex items-center gap-1 text-amber-500">
            <Clock size={12} />
            {comments.filter((c) => c.status === 'OPEN').length} open
          </span>
          <span className="flex items-center gap-1 text-green-500">
            <CheckCircle2 size={12} />
            {comments.filter((c) => c.status === 'RESOLVED').length} resolved
          </span>
        </div>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No comments yet</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Add a comment to start the discussion
            </p>
          </div>
        ) : (
          comments.map((comment) => {
            const isExpanded = expandedComments.has(comment.id);
            const StatusIcon = STATUS_CONFIG[comment.status]?.icon || Clock;
            const typeConfig =
              COMMENT_TYPE_CONFIG[comment.commentType] || COMMENT_TYPE_CONFIG.FEEDBACK;

            return (
              <div
                key={comment.id}
                className="bg-slate-50 dark:bg-navy-950 rounded-lg border border-slate-200 dark:border-navy-700 overflow-hidden"
              >
                {/* Comment header */}
                <div className="px-3 py-2 flex items-center justify-between border-b border-slate-200 dark:border-navy-700">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${typeConfig.color}`}>
                      {typeConfig.label}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {comment.userFullName || comment.userName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusIcon size={14} className={STATUS_CONFIG[comment.status]?.color} />
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {formatDate(comment.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Comment content */}
                <div className="p-3">
                  <p className="text-sm text-navy-900 dark:text-white whitespace-pre-wrap">
                    {comment.content}
                  </p>

                  {/* AI Response */}
                  {comment.aiResponse && (
                    <div className="mt-3 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-500/30">
                      <div className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 mb-1">
                        <Sparkles size={12} />
                        AI Response
                      </div>
                      <p className="text-sm text-purple-800 dark:text-purple-300">
                        {comment.aiResponse}
                      </p>
                      {comment.aiSuggestedEdits &&
                        comment.aiSuggestedEdits.length > 0 &&
                        isExpanded && (
                          <div className="mt-2 pt-2 border-t border-purple-200 dark:border-purple-500/30">
                            <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">
                              Suggested edits:
                            </p>
                            <ul className="text-xs text-purple-700 dark:text-purple-300 list-disc pl-4">
                              {comment.aiSuggestedEdits.map((edit, i) => (
                                <li key={i}>{edit}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                    </div>
                  )}
                </div>

                {/* Comment actions */}
                <div className="px-3 py-2 border-t border-slate-200 dark:border-navy-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {!comment.aiResponse && (
                      <button
                        onClick={() => handleProcessWithAI(comment.id)}
                        disabled={processingAI === comment.id}
                        className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 px-2 py-1 rounded transition-colors"
                      >
                        {processingAI === comment.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Sparkles size={12} />
                        )}
                        AI Analyze
                      </button>
                    )}
                    {comment.status === 'OPEN' && (
                      <button
                        onClick={() => handleUpdateStatus(comment.id, 'RESOLVED')}
                        className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 px-2 py-1 rounded transition-colors"
                      >
                        <CheckCircle2 size={12} />
                        Resolve
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {(comment.aiResponse || comment.aiSuggestedEdits?.length) && (
                      <button
                        onClick={() => toggleExpanded(comment.id)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:text-slate-400 rounded"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="p-1 text-slate-400 dark:text-slate-500 hover:text-red-500 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New comment form */}
      <div className="shrink-0 p-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950">
        <div className="flex items-start gap-2">
          <div className="relative">
            <button
              onClick={() => setShowTypeSelector(!showTypeSelector)}
              className={`px-2 py-1.5 text-xs rounded-lg ${COMMENT_TYPE_CONFIG[commentType].color}`}
            >
              {COMMENT_TYPE_CONFIG[commentType].label}
              <ChevronDown size={12} className="inline ml-1" />
            </button>
            {showTypeSelector && (
              <div className="absolute bottom-full left-0 mb-1 bg-white dark:bg-navy-900 rounded-lg shadow-lg border border-slate-200 dark:border-navy-700 py-1 z-10">
                {(['FEEDBACK', 'SUGGESTION', 'QUESTION'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setCommentType(type);
                      setShowTypeSelector(false);
                    }}
                    className={`w-full px-3 py-1.5 text-xs text-left hover:bg-slate-50 dark:hover:bg-white/5 ${
                      commentType === type ? 'bg-slate-100 dark:bg-white/10' : ''
                    }`}
                  >
                    {COMMENT_TYPE_CONFIG[type].label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-navy-900 dark:text-white resize-none"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!newComment.trim() || submitting}
            className={`p-2 rounded-lg transition-colors ${
              newComment.trim() && !submitting
                ? 'bg-purple-600 text-white hover:bg-purple-500'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            }`}
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>

        {/* Regenerate section button */}
        {onRegenerateSection && sectionId && (
          <button
            onClick={() => {
              const feedback = comments
                .filter((c) => c.status === 'OPEN')
                .map((c) => c.content)
                .join('\n');
              if (feedback) {
                onRegenerateSection(sectionId, feedback);
              }
            }}
            disabled={comments.filter((c) => c.status === 'OPEN').length === 0}
            className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={14} />
            Regenerate section with feedback
          </button>
        )}
      </div>
    </div>
  );
};

export default ReportCommentPanel;
