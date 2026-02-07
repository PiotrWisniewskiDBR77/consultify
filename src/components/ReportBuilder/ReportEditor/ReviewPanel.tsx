/**
 * ReviewPanel
 *
 * Panel for managing report review workflow:
 * - Comments list with add/resolve functionality
 * - Status transitions (finalize, approve, send-back, reject)
 */

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  ThumbsUp,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';
import type { ReportStatus } from '../useReportBuilder';

// ==========================================
// TYPES
// ==========================================

interface Comment {
  id: string;
  reportId: string;
  sectionKey?: string;
  content: string;
  commentType: 'GENERAL' | 'SUGGESTION' | 'QUESTION' | 'ISSUE' | 'APPROVAL';
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  authorId: string;
  authorName?: string;
  createdAt: string;
  updatedAt?: string;
  resolutionNotes?: string;
}

interface CommentSummary {
  total: number;
  open: number;
  resolved: number;
  dismissed: number;
  byType: Record<string, number>;
}

interface ReviewPanelProps {
  reportId: string;
  reportStatus: ReportStatus;
  onStatusChange: (newStatus: ReportStatus) => void;
  isPl?: boolean;
}

// ==========================================
// COMPONENT
// ==========================================

export const ReviewPanel: React.FC<ReviewPanelProps> = ({
  reportId,
  reportStatus,
  onStatusChange,
  isPl = false,
}) => {
  const { i18n } = useTranslation();
  const isPolish = isPl || i18n.language?.startsWith('pl');

  // State
  const [comments, setComments] = useState<Comment[]>([]);
  const [summary, setSummary] = useState<CommentSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddComment, setShowAddComment] = useState(false);
  const [newCommentContent, setNewCommentContent] = useState('');
  const [newCommentType, setNewCommentType] = useState<Comment['commentType']>('GENERAL');
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());

  // Load comments
  const loadComments = useCallback(async () => {
    if (!reportId) return;
    setIsLoading(true);
    try {
      const resp = await Api.get(`/report-builder/${reportId}/comments`);
      setComments(resp?.comments || []);
      setSummary(resp?.summary || null);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Add comment
  const handleAddComment = async () => {
    if (!newCommentContent.trim()) return;
    setIsSubmitting(true);
    try {
      const resp = await Api.post(`/report-builder/${reportId}/comments`, {
        content: newCommentContent.trim(),
        commentType: newCommentType,
      });
      if (resp?.comment) {
        setComments((prev) => [resp.comment, ...prev]);
        setSummary((prev) =>
          prev ? { ...prev, total: prev.total + 1, open: prev.open + 1 } : prev
        );
        setNewCommentContent('');
        setShowAddComment(false);
        toast.success(isPolish ? 'Komentarz dodany' : 'Comment added');
      }
    } catch (err: any) {
      toast.error(err?.message || (isPolish ? 'Błąd dodawania komentarza' : 'Failed to add comment'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resolve comment
  const handleResolveComment = async (commentId: string) => {
    try {
      await Api.post(`/report-builder/${reportId}/comments/${commentId}/resolve`, {});
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, status: 'RESOLVED' } : c))
      );
      setSummary((prev) =>
        prev ? { ...prev, open: prev.open - 1, resolved: prev.resolved + 1 } : prev
      );
      toast.success(isPolish ? 'Komentarz rozwiązany' : 'Comment resolved');
    } catch (err: any) {
      toast.error(err?.message || (isPolish ? 'Błąd' : 'Error'));
    }
  };

  // Delete comment
  const handleDeleteComment = async (commentId: string) => {
    try {
      await Api.delete(`/report-builder/${reportId}/comments/${commentId}`);
      const deleted = comments.find((c) => c.id === commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      if (deleted && summary) {
        const newSummary = { ...summary, total: summary.total - 1 };
        if (deleted.status === 'OPEN') newSummary.open--;
        else if (deleted.status === 'RESOLVED') newSummary.resolved--;
        else if (deleted.status === 'DISMISSED') newSummary.dismissed--;
        setSummary(newSummary);
      }
      toast.success(isPolish ? 'Komentarz usunięty' : 'Comment deleted');
    } catch (err: any) {
      toast.error(err?.message || (isPolish ? 'Błąd' : 'Error'));
    }
  };

  // Status transitions
  const handleFinalize = async () => {
    setIsSubmitting(true);
    try {
      await Api.post(`/report-builder/${reportId}/finalize`, {});
      onStatusChange('IN_REVIEW');
      toast.success(isPolish ? 'Raport przekazany do recenzji' : 'Report sent for review');
    } catch (err: any) {
      toast.error(err?.error || err?.message || (isPolish ? 'Błąd finalizacji' : 'Finalize failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await Api.post(`/report-builder/${reportId}/approve`, {});
      onStatusChange('APPROVED');
      toast.success(isPolish ? 'Raport zatwierdzony' : 'Report approved');
    } catch (err: any) {
      toast.error(err?.error || err?.message || (isPolish ? 'Błąd zatwierdzania' : 'Approve failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendBack = async () => {
    setIsSubmitting(true);
    try {
      await Api.post(`/report-builder/${reportId}/send-back`, {});
      onStatusChange('DRAFT');
      toast.success(isPolish ? 'Raport odesłany do poprawy' : 'Report sent back for revision');
    } catch (err: any) {
      toast.error(err?.error || err?.message || (isPolish ? 'Błąd' : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt(isPolish ? 'Powód odrzucenia (opcjonalnie):' : 'Rejection reason (optional):');
    setIsSubmitting(true);
    try {
      await Api.post(`/report-builder/${reportId}/reject`, { reason: reason || '' });
      onStatusChange('DRAFT');
      toast.success(isPolish ? 'Raport odrzucony' : 'Report rejected');
    } catch (err: any) {
      toast.error(err?.error || err?.message || (isPolish ? 'Błąd' : 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle comment expansion
  const toggleComment = (id: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Status badge
  const getStatusBadge = () => {
    const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
      DRAFT: {
        label: isPolish ? 'Szkic' : 'Draft',
        color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        icon: <Clock className="w-3 h-3" />,
      },
      GENERATED: {
        label: isPolish ? 'Wygenerowany' : 'Generated',
        color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        icon: <CheckCircle className="w-3 h-3" />,
      },
      IN_REVIEW: {
        label: isPolish ? 'W recenzji' : 'In Review',
        color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
        icon: <MessageSquare className="w-3 h-3" />,
      },
      APPROVED: {
        label: isPolish ? 'Zatwierdzony' : 'Approved',
        color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
        icon: <ThumbsUp className="w-3 h-3" />,
      },
      UTILIZED: {
        label: isPolish ? 'Wykorzystany' : 'Utilized',
        color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
        icon: <Check className="w-3 h-3" />,
      },
    };
    const config = statusConfig[reportStatus] || statusConfig.DRAFT;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  const openCount = summary?.open || 0;
  const canApprove = reportStatus === 'IN_REVIEW' && openCount === 0;

  return (
    <div className="space-y-6">
      {/* Status Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
            {isPolish ? 'Status raportu' : 'Report Status'}
          </span>
          {getStatusBadge()}
        </div>

        {/* Status Actions */}
        <div className="space-y-2">
          {reportStatus === 'GENERATED' && (
            <button
              onClick={handleFinalize}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isPolish ? 'Przekaż do recenzji' : 'Send for Review'}
            </button>
          )}

          {reportStatus === 'IN_REVIEW' && (
            <>
              <button
                onClick={handleApprove}
                disabled={isSubmitting || !canApprove}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-sm"
                title={!canApprove ? (isPolish ? 'Rozwiąż wszystkie komentarze' : 'Resolve all comments first') : ''}
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                {isPolish ? 'Zatwierdź' : 'Approve'}
              </button>
              {!canApprove && openCount > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {isPolish
                    ? `${openCount} otwartych komentarzy do rozwiązania`
                    : `${openCount} open comment(s) to resolve`}
                </p>
              )}
              <button
                onClick={handleSendBack}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                {isPolish ? 'Odeślij do poprawy' : 'Send Back'}
              </button>
            </>
          )}

          {reportStatus === 'APPROVED' && (
            <button
              onClick={handleReject}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-red-600 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-sm"
            >
              <XCircle className="w-4 h-4" />
              {isPolish ? 'Odrzuć' : 'Reject'}
            </button>
          )}
        </div>
      </div>

      {/* Comments Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
            {isPolish ? 'Komentarze' : 'Comments'}
            {summary && ` (${summary.open} ${isPolish ? 'otwartych' : 'open'})`}
          </span>
          <button
            onClick={() => setShowAddComment(!showAddComment)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
          >
            {showAddComment ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>

        {/* Add Comment Form */}
        {showAddComment && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg space-y-3">
            <select
              value={newCommentType}
              onChange={(e) => setNewCommentType(e.target.value as Comment['commentType'])}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
            >
              <option value="GENERAL">{isPolish ? 'Ogólny' : 'General'}</option>
              <option value="SUGGESTION">{isPolish ? 'Sugestia' : 'Suggestion'}</option>
              <option value="QUESTION">{isPolish ? 'Pytanie' : 'Question'}</option>
              <option value="ISSUE">{isPolish ? 'Problem' : 'Issue'}</option>
            </select>
            <textarea
              value={newCommentContent}
              onChange={(e) => setNewCommentContent(e.target.value)}
              placeholder={isPolish ? 'Treść komentarza...' : 'Comment content...'}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 resize-none"
            />
            <button
              onClick={handleAddComment}
              disabled={isSubmitting || !newCommentContent.trim()}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
              {isPolish ? 'Dodaj komentarz' : 'Add Comment'}
            </button>
          </div>
        )}

        {/* Comments List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-6 text-sm text-slate-500">
            {isPolish ? 'Brak komentarzy' : 'No comments yet'}
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {comments.map((comment) => {
              const isExpanded = expandedComments.has(comment.id);
              const isOpen = comment.status === 'OPEN';
              return (
                <div
                  key={comment.id}
                  className={`p-3 rounded-lg border ${
                    isOpen
                      ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={() => toggleComment(comment.id)}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                          comment.commentType === 'ISSUE'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                            : comment.commentType === 'QUESTION'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : comment.commentType === 'SUGGESTION'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                          {comment.commentType}
                        </span>
                        <span className={`text-xs ${isOpen ? 'text-amber-600' : 'text-green-600'}`}>
                          {isOpen ? (isPolish ? 'Otwarty' : 'Open') : (isPolish ? 'Rozwiązany' : 'Resolved')}
                        </span>
                      </div>
                      <p className={`text-sm text-slate-700 dark:text-slate-300 mt-1 ${!isExpanded ? 'line-clamp-1' : ''}`}>
                        {comment.content}
                      </p>
                    </button>
                    <div className="flex items-center gap-1">
                      {isOpen && (
                        <button
                          onClick={() => handleResolveComment(comment.id)}
                          className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                          title={isPolish ? 'Rozwiąż' : 'Resolve'}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        title={isPolish ? 'Usuń' : 'Delete'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500">
                      <span>{new Date(comment.createdAt).toLocaleString()}</span>
                      {comment.authorName && <span> • {comment.authorName}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewPanel;
