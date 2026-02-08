/**
 * ReportBuilderCommentPanel
 *
 * Side panel for viewing and managing comments on report builder reports.
 * Supports section-level and fragment-level comments with anchor tracking.
 * Enforces workflow gates (no approval with open comments).
 */

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  Loader2,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  CommentPriority,
  CommentStatus,
  CommentSummary,
  CommentType,
  ReportComment,
} from './useReportBuilder';

// ==========================================
// TYPES
// ==========================================

interface ReportBuilderCommentPanelProps {
  reportId: string;
  reportStatus: string;
  sectionKey?: string | null;
  sectionName?: string;
  comments: ReportComment[];
  summary: CommentSummary | null;
  isLoading: boolean;
  onLoadComments: (sectionKey?: string | null) => Promise<void>;
  onCreateComment: (params: {
    sectionKey?: string;
    content: string;
    commentType?: CommentType;
    priority?: CommentPriority;
  }) => Promise<ReportComment | null>;
  onUpdateComment: (
    commentId: string,
    updates: { status?: CommentStatus; resolutionNotes?: string }
  ) => Promise<ReportComment | null>;
  onResolveComment: (commentId: string, resolutionNotes?: string) => Promise<ReportComment | null>;
  onDeleteComment: (commentId: string) => Promise<boolean>;
  onClose: () => void;
}

// ==========================================
// CONFIG
// ==========================================

const COMMENT_TYPE_CONFIG: Record<CommentType, { label: string; labelPl: string; color: string }> =
  {
    FEEDBACK: {
      label: 'Feedback',
      labelPl: 'Uwaga',
      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    },
    SUGGESTION: {
      label: 'Suggestion',
      labelPl: 'Sugestia',
      color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    },
    QUESTION: {
      label: 'Question',
      labelPl: 'Pytanie',
      color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    },
    APPROVAL: {
      label: 'Approval',
      labelPl: 'Zatwierdzenie',
      color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    },
    REJECTION: {
      label: 'Rejection',
      labelPl: 'Odrzucenie',
      color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    },
    CHANGE_REQUEST: {
      label: 'Change Request',
      labelPl: 'Prośba o zmianę',
      color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    },
  };

const STATUS_CONFIG: Record<
  CommentStatus,
  { label: string; labelPl: string; icon: React.ComponentType<any>; color: string }
> = {
  OPEN: { label: 'Open', labelPl: 'Otwarty', icon: Clock, color: 'text-amber-500' },
  IN_PROGRESS: {
    label: 'In Progress',
    labelPl: 'W trakcie',
    icon: RefreshCw,
    color: 'text-blue-500',
  },
  RESOLVED: {
    label: 'Resolved',
    labelPl: 'Rozwiązany',
    icon: CheckCircle2,
    color: 'text-green-500',
  },
  DISMISSED: { label: 'Dismissed', labelPl: 'Odrzucony', icon: X, color: 'text-slate-400' },
  WONT_FIX: {
    label: "Won't Fix",
    labelPl: 'Nie będzie naprawiane',
    icon: X,
    color: 'text-slate-400',
  },
};

// ==========================================
// COMPONENT
// ==========================================

export const ReportBuilderCommentPanel: React.FC<ReportBuilderCommentPanelProps> = ({
  reportId,
  reportStatus,
  sectionKey,
  sectionName,
  comments,
  summary,
  isLoading,
  onLoadComments,
  onCreateComment,
  onUpdateComment,
  onResolveComment,
  onDeleteComment,
  onClose,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [newComment, setNewComment] = useState('');
  const [commentType, setCommentType] = useState<CommentType>('FEEDBACK');
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'resolved'>('all');
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());

  // Load comments on mount
  useEffect(() => {
    onLoadComments(sectionKey);
  }, [sectionKey, onLoadComments]);

  // Filter comments
  const filteredComments = comments.filter((c) => {
    // Filter by section if specified
    if (sectionKey !== undefined && c.sectionKey !== sectionKey) return false;

    // Filter by status
    if (filterStatus === 'open') return c.status === 'OPEN' || c.status === 'IN_PROGRESS';
    if (filterStatus === 'resolved')
      return c.status === 'RESOLVED' || c.status === 'DISMISSED' || c.status === 'WONT_FIX';
    return true;
  });

  // Calculate counts
  const openCount = comments.filter(
    (c) =>
      (sectionKey === undefined || c.sectionKey === sectionKey) &&
      (c.status === 'OPEN' || c.status === 'IN_PROGRESS')
  ).length;
  const resolvedCount = comments.filter(
    (c) =>
      (sectionKey === undefined || c.sectionKey === sectionKey) &&
      (c.status === 'RESOLVED' || c.status === 'DISMISSED' || c.status === 'WONT_FIX')
  ).length;

  // Submit new comment
  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const result = await onCreateComment({
        sectionKey: sectionKey || undefined,
        content: newComment.trim(),
        commentType,
      });
      if (result) {
        setNewComment('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(isPl ? 'pl-PL' : 'en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
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

  return (
    <div className="h-full flex flex-col bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-navy-700">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-500" />
            <div>
              <h3 className="font-semibold text-navy-900 dark:text-white">
                {isPl ? 'Komentarze' : 'Comments'}
              </h3>
              {sectionName && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{sectionName}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            {filteredComments.length} {isPl ? 'komentarzy' : 'comments'}
          </span>
          <span className="flex items-center gap-1 text-amber-500">
            <Clock size={12} />
            {openCount} {isPl ? 'otwartych' : 'open'}
          </span>
          <span className="flex items-center gap-1 text-green-500">
            <CheckCircle2 size={12} />
            {resolvedCount} {isPl ? 'rozwiązanych' : 'resolved'}
          </span>
        </div>

        {/* Gate warning */}
        {reportStatus === 'IN_REVIEW' && openCount > 0 && (
          <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {isPl
                  ? `Raport nie może być zatwierdzony dopóki ${openCount} komentarz(y) pozostaje otwartych.`
                  : `Report cannot be approved until ${openCount} open comment(s) are resolved.`}
              </p>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex items-center gap-2 mt-3">
          <Filter size={14} className="text-slate-400" />
          <div className="flex gap-1">
            {(['all', 'open', 'resolved'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                className={`px-2 py-1 text-xs rounded ${
                  filterStatus === f
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
              >
                {f === 'all'
                  ? isPl
                    ? 'Wszystkie'
                    : 'All'
                  : f === 'open'
                    ? isPl
                      ? 'Otwarte'
                      : 'Open'
                    : isPl
                      ? 'Rozwiązane'
                      : 'Resolved'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
          </div>
        ) : filteredComments.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isPl ? 'Brak komentarzy' : 'No comments yet'}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {isPl
                ? 'Dodaj komentarz, aby rozpocząć dyskusję'
                : 'Add a comment to start the discussion'}
            </p>
          </div>
        ) : (
          filteredComments.map((comment) => {
            const isExpanded = expandedComments.has(comment.id);
            const StatusIcon = STATUS_CONFIG[comment.status]?.icon || Clock;
            const typeConfig =
              COMMENT_TYPE_CONFIG[comment.commentType] || COMMENT_TYPE_CONFIG.FEEDBACK;
            const statusConfig = STATUS_CONFIG[comment.status];

            return (
              <div
                key={comment.id}
                className="bg-slate-50 dark:bg-navy-950 rounded-lg border border-slate-200 dark:border-navy-700 overflow-hidden"
              >
                {/* Comment header */}
                <div className="px-3 py-2 flex items-center justify-between border-b border-slate-200 dark:border-navy-700">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${typeConfig.color}`}>
                      {isPl ? typeConfig.labelPl : typeConfig.label}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {comment.userName || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusIcon size={14} className={statusConfig?.color} />
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

                  {/* Section indicator */}
                  {comment.sectionKey && sectionKey === undefined && (
                    <div className="mt-2 text-xs text-slate-400">
                      {isPl ? 'Sekcja:' : 'Section:'} {comment.sectionKey}
                    </div>
                  )}

                  {/* Resolution notes */}
                  {comment.resolutionNotes && isExpanded && (
                    <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-700">
                      <p className="text-xs text-green-600 dark:text-green-400 mb-1">
                        {isPl ? 'Rozwiązanie:' : 'Resolution:'}
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {comment.resolutionNotes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Comment actions */}
                <div className="px-3 py-2 border-t border-slate-200 dark:border-navy-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {comment.status === 'OPEN' && (
                      <>
                        <button
                          onClick={() => onUpdateComment(comment.id, { status: 'IN_PROGRESS' })}
                          className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 px-2 py-1 rounded transition-colors"
                        >
                          <RefreshCw size={12} />
                          {isPl ? 'W trakcie' : 'In Progress'}
                        </button>
                        <button
                          onClick={() => onResolveComment(comment.id)}
                          className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 px-2 py-1 rounded transition-colors"
                        >
                          <CheckCircle2 size={12} />
                          {isPl ? 'Rozwiąż' : 'Resolve'}
                        </button>
                      </>
                    )}
                    {comment.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => onResolveComment(comment.id)}
                        className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 px-2 py-1 rounded transition-colors"
                      >
                        <CheckCircle2 size={12} />
                        {isPl ? 'Rozwiąż' : 'Resolve'}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {comment.resolutionNotes && (
                      <button
                        onClick={() => toggleExpanded(comment.id)}
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteComment(comment.id)}
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
              {isPl
                ? COMMENT_TYPE_CONFIG[commentType].labelPl
                : COMMENT_TYPE_CONFIG[commentType].label}
              <ChevronDown size={12} className="inline ml-1" />
            </button>
            {showTypeSelector && (
              <div className="absolute bottom-full left-0 mb-1 bg-white dark:bg-navy-900 rounded-lg shadow-lg border border-slate-200 dark:border-navy-700 py-1 z-10 min-w-[140px]">
                {(['FEEDBACK', 'SUGGESTION', 'QUESTION', 'CHANGE_REQUEST'] as CommentType[]).map(
                  (type) => (
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
                      {isPl ? COMMENT_TYPE_CONFIG[type].labelPl : COMMENT_TYPE_CONFIG[type].label}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
          <div className="flex-1">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={isPl ? 'Dodaj komentarz...' : 'Add a comment...'}
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-navy-900 dark:text-white resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSubmit();
                }
              }}
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
        <p className="text-xs text-slate-400 mt-2">
          {isPl ? 'Cmd+Enter aby wysłać' : 'Cmd+Enter to submit'}
        </p>
      </div>
    </div>
  );
};

export default ReportBuilderCommentPanel;
