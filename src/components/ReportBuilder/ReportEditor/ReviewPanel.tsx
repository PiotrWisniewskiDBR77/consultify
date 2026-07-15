/**
 * ReviewPanel v4
 *
 * Compact vertical workflow with premium styling:
 * - Tight vertical stepper with thin connector lines
 * - Small colored dots: green=done, amber=current, red=blocked, gray=future
 * - Inline action buttons
 * - Reviewer picker
 * - Collapsible comments
 */

import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Globe,
  Loader2,
  Lock,
  MessageSquare,
  Plus,
  Send,
  ThumbsUp,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

interface OrgUser {
  id: string;
  name?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
}

interface ReviewPanelProps {
  reportId: string;
  reportStatus: ReportStatus;
  onStatusChange: (newStatus: ReportStatus) => void;
  isPl?: boolean;
}

// ==========================================
// WORKFLOW STEPS
// ==========================================

type StepState = 'done' | 'active' | 'pending' | 'blocked';

interface WStep {
  key: ReportStatus;
  en: string;
  pl: string;
}

const STEPS: WStep[] = [
  { key: 'DRAFT', en: 'Draft', pl: 'Szkic' },
  { key: 'GENERATED', en: 'Generated', pl: 'Wygenerowany' },
  { key: 'IN_REVIEW', en: 'In Review', pl: 'Recenzja' },
  { key: 'APPROVED', en: 'Approved', pl: 'Zatwierdzony' },
];

const DIST_STEPS: WStep[] = [
  { key: 'SENT_INTERNAL', en: 'Sent internally', pl: 'Wysłany wewn.' },
  { key: 'SENT_EXTERNAL', en: 'Sent to client', pl: 'Wysłany do klienta' },
  { key: 'UTILIZED', en: 'Utilized', pl: 'Wykorzystany' },
];

function stepState(
  stepKey: ReportStatus,
  current: ReportStatus,
  steps: WStep[],
  openComments: number
): StepState {
  const si = steps.findIndex((s) => s.key === stepKey);
  const ci = steps.findIndex((s) => s.key === current);
  if (ci < 0) return 'done'; // current not in list = all done
  if (si < ci) return 'done';
  if (si === ci) return 'active';
  if (stepKey === 'APPROVED' && current === 'IN_REVIEW' && openComments > 0) return 'blocked';
  return 'pending';
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
  const { t, i18n } = useTranslation();
  const isPolish = isPl || i18n.language?.startsWith('pl');

  const [comments, setComments] = useState<Comment[]>([]);
  const [summary, setSummary] = useState<CommentSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddComment, setShowAddComment] = useState(false);
  const [newCommentContent, setNewCommentContent] = useState('');
  const [newCommentType, setNewCommentType] = useState<Comment['commentType']>('GENERAL');
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([]);
  const [showReviewerPicker, setShowReviewerPicker] = useState(false);
  const [reviewerSearch, setReviewerSearch] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');
  const [commentsOpen, setCommentsOpen] = useState(true);

  // Data
  const loadComments = useCallback(async () => {
    if (!reportId) return;
    setIsLoading(true);
    try {
      const r = await Api.get(`/report-builder/${reportId}/comments`);
      setComments(r?.comments || []);
      setSummary(r?.summary || null);
    } catch {
      /* */
    } finally {
      setIsLoading(false);
    }
  }, [reportId]);

  const loadOrgUsers = useCallback(async () => {
    try {
      const r = await Api.get('/users');
      setOrgUsers(Array.isArray(r) ? r : r?.users || []);
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    loadComments();
    loadOrgUsers();
  }, [loadComments, loadOrgUsers]);

  const openCount = summary?.open || 0;
  const canApprove = reportStatus === 'IN_REVIEW' && openCount === 0;
  const isPost = ['SENT_INTERNAL', 'SENT_EXTERNAL', 'UTILIZED'].includes(reportStatus);

  const filteredUsers = useMemo(() => {
    if (!reviewerSearch.trim()) return orgUsers;
    const q = reviewerSearch.toLowerCase();
    return orgUsers.filter((u) => {
      const n = u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim();
      return n.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    });
  }, [orgUsers, reviewerSearch]);

  const userName = (u: OrgUser) =>
    u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || u.id;

  // Actions
  const handleAddComment = async () => {
    if (!newCommentContent.trim()) return;
    setIsSubmitting(true);
    try {
      const r = await Api.post(`/report-builder/${reportId}/comments`, {
        content: newCommentContent.trim(),
        commentType: newCommentType,
      });
      if (r?.comment) {
        setComments((p) => [r.comment, ...p]);
        setSummary((p) => (p ? { ...p, total: p.total + 1, open: p.open + 1 } : p));
        setNewCommentContent('');
        setShowAddComment(false);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resolveComment = async (id: string) => {
    try {
      await Api.post(`/report-builder/${reportId}/comments/${id}/resolve`, {});
      setComments((p) => p.map((c) => (c.id === id ? { ...c, status: 'RESOLVED' } : c)));
      setSummary((p) => (p ? { ...p, open: p.open - 1, resolved: p.resolved + 1 } : p));
    } catch (e: any) {
      toast.error(e?.message || 'Error');
    }
  };

  const deleteComment = async (id: string) => {
    try {
      await Api.delete(`/report-builder/${reportId}/comments/${id}`);
      const d = comments.find((c) => c.id === id);
      setComments((p) => p.filter((c) => c.id !== id));
      if (d && summary) {
        const s = { ...summary, total: summary.total - 1 };
        if (d.status === 'OPEN') s.open--;
        else if (d.status === 'RESOLVED') s.resolved--;
        else if (d.status === 'DISMISSED') s.dismissed--;
        setSummary(s);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Error');
    }
  };

  const doFinalize = async () => {
    setIsSubmitting(true);
    try {
      await Api.post(`/report-builder/${reportId}/finalize`, {
        reviewers: selectedReviewers.length > 0 ? selectedReviewers : undefined,
        message: reviewMessage.trim() || undefined,
      });
      onStatusChange('IN_REVIEW');
      setShowReviewerPicker(false);
      setSelectedReviewers([]);
      setReviewMessage('');
      toast.success(t('reportBuilder.reviewPanel.sentForReview', 'Sent for review'));
    } catch (e: any) {
      toast.error(e?.error || e?.message || 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const doApprove = async () => {
    setIsSubmitting(true);
    try {
      await Api.post(`/report-builder/${reportId}/approve`, {});
      onStatusChange('APPROVED');
      toast.success(t('reportBuilder.reviewPanel.approved', 'Approved'));
    } catch (e: any) {
      toast.error(e?.error || e?.message || 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };
  const doSendBack = async () => {
    setIsSubmitting(true);
    try {
      await Api.post(`/report-builder/${reportId}/send-back`, {});
      onStatusChange('DRAFT');
      toast.success(t('reportBuilder.reviewPanel.sentBack', 'Sent back'));
    } catch (e: any) {
      toast.error(e?.error || e?.message || 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };
  const doReject = async () => {
    const r = prompt(t('reportBuilder.reviewPanel.reason', 'Reason:'));
    if (r === null) return;
    setIsSubmitting(true);
    try {
      await Api.post(`/report-builder/${reportId}/reject`, { reason: r });
      onStatusChange('DRAFT');
      toast.success(t('reportBuilder.reviewPanel.rejected', 'Rejected'));
    } catch (e: any) {
      toast.error(e?.error || e?.message || 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };
  const doSendInt = async () => {
    setIsSubmitting(true);
    try {
      await Api.post(`/report-builder/${reportId}/mark-sent-internal`, {});
      onStatusChange('SENT_INTERNAL');
    } catch (e: any) {
      toast.error(e?.error || 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };
  const doSendExt = async () => {
    setIsSubmitting(true);
    try {
      await Api.post(`/report-builder/${reportId}/mark-sent-external`, {});
      onStatusChange('SENT_EXTERNAL');
    } catch (e: any) {
      toast.error(e?.error || 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };
  const doUtilize = async () => {
    setIsSubmitting(true);
    try {
      await Api.post(`/report-builder/${reportId}/utilize`, {});
      onStatusChange('UTILIZED');
    } catch (e: any) {
      toast.error(e?.error || 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleReviewer = (uid: string) =>
    setSelectedReviewers((p) => (p.includes(uid) ? p.filter((i) => i !== uid) : [...p, uid]));
  const toggleComment = (id: string) =>
    setExpandedComments((p) => {
      const n = new Set(p);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
      }
      return n;
    });

  // ==========================================
  // RENDER HELPERS
  // ==========================================

  const Dot: React.FC<{ state: StepState; small?: boolean }> = ({ state, small }) => {
    const sz = small ? 'w-3 h-3' : 'w-[14px] h-[14px]';
    const icsz = small ? 'w-2 h-2' : 'w-2.5 h-2.5';
    if (state === 'done')
      return (
        <div
          className={`${sz} rounded-full bg-emerald-500/90 flex items-center justify-center flex-shrink-0`}
        >
          <Check className={`${icsz} text-c-text`} strokeWidth={3} />
        </div>
      );
    if (state === 'active')
      return (
        <div
          className={`${sz} rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.4)]`}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-amber-800" />
        </div>
      );
    if (state === 'blocked')
      return (
        <div
          className={`${sz} rounded-full bg-danger-500/80 flex items-center justify-center flex-shrink-0`}
        >
          <Lock className="w-2 h-2 text-c-text" />
        </div>
      );
    return <div className={`${sz} rounded-full border border-c-border-strong flex-shrink-0`} />;
  };

  const Line: React.FC<{ done: boolean }> = ({ done }) => (
    <div
      className={`w-[1.5px] h-3 ml-[6px] ${done ? 'bg-emerald-500/60' : 'bg-c-surface-raised'}`}
    />
  );

  const renderSteps = (steps: WStep[], overrideAllDone = false) => (
    <>
      {steps.map((step, idx) => {
        const st = overrideAllDone
          ? ('done' as StepState)
          : stepState(step.key, reportStatus, steps, openCount);
        const isCurrent = step.key === reportStatus;
        const isLast = idx === steps.length - 1;

        // Determine action for this step row
        let action: React.ReactNode = null;
        if (isCurrent && step.key === 'GENERATED' && !showReviewerPicker) {
          action = (
            <button
              onClick={() => setShowReviewerPicker(true)}
              className="ml-auto px-2 py-0.5 text-[9px] font-semibold bg-blue-600 text-c-text rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
            >
              <Send className="w-2.5 h-2.5" /> {t('reportBuilder.reviewPanel.review', 'Review')}
            </button>
          );
        }
        if (isCurrent && step.key === 'IN_REVIEW' && canApprove) {
          action = (
            <button
              onClick={doApprove}
              disabled={isSubmitting}
              className="ml-auto px-2 py-0.5 text-[9px] font-semibold bg-emerald-600 text-c-text rounded hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              {isSubmitting ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : (
                <ThumbsUp className="w-2.5 h-2.5" />
              )}{' '}
              {t('reportBuilder.reviewPanel.approve', 'Approve')}
            </button>
          );
        }
        // Distribution actions
        if (reportStatus === 'APPROVED' && step.key === 'SENT_INTERNAL') {
          action = (
            <button
              onClick={doSendInt}
              disabled={isSubmitting}
              className="ml-auto px-2 py-0.5 text-[9px] font-semibold bg-indigo-600 text-c-text rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              {isSubmitting ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : (
                <Building2 className="w-2.5 h-2.5" />
              )}{' '}
              {t('reportBuilder.reviewPanel.send', 'Send')}
            </button>
          );
        }
        if (isCurrent && step.key === 'SENT_INTERNAL') {
          action = (
            <button
              onClick={doSendExt}
              disabled={isSubmitting}
              className="ml-auto px-2 py-0.5 text-[9px] font-semibold bg-c-text text-c-bg rounded hover:opacity-90 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              {isSubmitting ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : (
                <Globe className="w-2.5 h-2.5" />
              )}{' '}
              {t('reportBuilder.reviewPanel.client', 'Client')}
            </button>
          );
        }
        if (reportStatus === 'SENT_EXTERNAL' && step.key === 'UTILIZED') {
          action = (
            <button
              onClick={doUtilize}
              disabled={isSubmitting}
              className="ml-auto px-2 py-0.5 text-[9px] font-semibold bg-emerald-600 text-c-text rounded hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              {isSubmitting ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : (
                <CheckCircle className="w-2.5 h-2.5" />
              )}{' '}
              {t('reportBuilder.reviewPanel.close', 'Close')}
            </button>
          );
        }

        return (
          <React.Fragment key={step.key}>
            <div className="flex items-center gap-2 min-h-[22px]">
              <Dot state={st} />
              <span
                className={`text-[11px] font-medium leading-none ${
                  st === 'done'
                    ? 'text-emerald-400/80'
                    : st === 'active'
                      ? 'text-amber-300'
                      : st === 'blocked'
                        ? 'text-danger-400/80'
                        : 'text-c-text-secondary'
                }`}
              >
                {t(`reportBuilder.reviewPanel.status.${step.key}`, step.en)}
              </span>
              {st === 'blocked' && step.key === 'APPROVED' && (
                <span className="text-[8px] text-danger-400/70 flex items-center gap-0.5">
                  <AlertTriangle className="w-2 h-2" />
                  {openCount}
                </span>
              )}
              {action}
            </div>
            {!isLast && <Line done={st === 'done'} />}
          </React.Fragment>
        );
      })}
    </>
  );

  // ==========================================
  // MAIN RENDER
  // ==========================================

  return (
    <div className="space-y-3">
      {/* ===== WORKFLOW ===== */}
      <div className="p-3 bg-c-surface rounded-lg border border-slate-200/60 dark:border-white/[0.03]">
        <div className="text-[8px] font-bold text-c-text-secondary uppercase tracking-[0.15em] mb-2.5">
          {t('reportBuilder.reviewPanel.workflow', 'Workflow')}
        </div>
        {renderSteps(STEPS, isPost)}

        {/* Distribution */}
        {(reportStatus === 'APPROVED' || isPost) && (
          <div className="mt-3 pt-2.5 border-t border-c-border-subtle">
            <div className="text-[8px] font-bold text-c-text-secondary uppercase tracking-[0.15em] mb-2">
              {t('reportBuilder.reviewPanel.distribution', 'Distribution')}
            </div>
            {renderSteps(DIST_STEPS)}
          </div>
        )}
      </div>

      {/* ===== REVIEW ACTIONS ===== */}
      {reportStatus === 'IN_REVIEW' && (
        <div className="flex gap-1.5">
          <button
            onClick={doSendBack}
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium text-c-text-secondary border border-c-border-subtle rounded-md hover:bg-c-surface hover:text-c-text transition-all"
          >
            <ArrowLeft className="w-3 h-3" /> {t('reportBuilder.reviewPanel.revise', 'Revise')}
          </button>
          <button
            onClick={doReject}
            disabled={isSubmitting}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium text-danger-400/80 border border-danger-800/40 rounded-md hover:bg-danger-900/30 hover:text-danger-300 transition-all"
          >
            <XCircle className="w-3 h-3" /> {t('reportBuilder.reviewPanel.reject', 'Reject')}
          </button>
        </div>
      )}

      {reportStatus === 'APPROVED' && (
        <button
          onClick={doReject}
          disabled={isSubmitting}
          className="w-full py-1.5 text-[10px] font-medium text-danger-400/70 border border-danger-800/30 rounded-md hover:bg-danger-900/20 hover:text-danger-300 transition-all flex items-center justify-center gap-1"
        >
          <XCircle className="w-3 h-3" /> {t('reportBuilder.reviewPanel.revoke', 'Revoke')}
        </button>
      )}

      {reportStatus === 'UTILIZED' && (
        <div className="py-2 text-center">
          <CheckCircle className="w-5 h-5 text-emerald-500/70 mx-auto mb-1" />
          <p className="text-[10px] text-emerald-400/60 font-medium">
            {t('reportBuilder.reviewPanel.complete', 'Complete')}
          </p>
        </div>
      )}

      {/* ===== REVIEWER PICKER ===== */}
      {showReviewerPicker && reportStatus === 'GENERATED' && (
        <div className="p-2.5 bg-blue-950/30 rounded-lg border border-blue-800/40 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
              <Send className="w-3 h-3" /> {t('reportBuilder.reviewPanel.sendForReview', 'Send for Review')}
            </span>
            <button
              onClick={() => {
                setShowReviewerPicker(false);
                setSelectedReviewers([]);
              }}
              className="p-0.5 text-blue-400 hover:text-blue-300"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <input
            type="text"
            value={reviewerSearch}
            onChange={(e) => setReviewerSearch(e.target.value)}
            placeholder={t('reportBuilder.reviewPanel.search', 'Search...')}
            className="w-full px-2 py-1 text-[11px] border border-blue-800/40 rounded bg-c-bg text-c-text outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-c-text-muted"
          />

          {selectedReviewers.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedReviewers.map((uid) => {
                const u = orgUsers.find((x) => x.id === uid);
                return (
                  <span
                    key={uid}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-900/40 text-blue-300 rounded text-[9px] font-medium"
                  >
                    {u ? userName(u) : uid}
                    <button onClick={() => toggleReviewer(uid)} className="hover:text-c-text">
                      <X className="w-2 h-2" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <div className="max-h-24 overflow-y-auto space-y-0.5">
            {filteredUsers.slice(0, 6).map((u) => {
              const sel = selectedReviewers.includes(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => toggleReviewer(u.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1 rounded text-[10px] transition-colors ${sel ? 'bg-blue-900/40 text-blue-300' : 'hover:bg-c-text text-c-bg-secondary'}`}
                >
                  <div className="w-4 h-4 rounded-full bg-c-border flex items-center justify-center text-c-text text-[7px] font-bold flex-shrink-0">
                    {userName(u).charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate flex-1">{userName(u)}</span>
                  {sel && <Check className="w-2.5 h-2.5 text-blue-400 flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          <textarea
            value={reviewMessage}
            onChange={(e) => setReviewMessage(e.target.value)}
            placeholder={t('reportBuilder.reviewPanel.message', 'Message...')}
            rows={2}
            className="w-full px-2 py-1 text-[10px] border border-blue-800/40 rounded bg-c-bg text-c-text outline-none resize-none placeholder:text-c-text-muted"
          />

          <button
            onClick={doFinalize}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-blue-600 text-c-text rounded hover:bg-blue-700 disabled:opacity-50 text-[10px] font-semibold transition-colors"
          >
            {isSubmitting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Send className="w-3 h-3" />
            )}
            {selectedReviewers.length > 0
              ? `${t('reportBuilder.reviewPanel.sendTo', 'Send to')} ${selectedReviewers.length}`
              : t('reportBuilder.reviewPanel.send', 'Send')}
          </button>
        </div>
      )}

      {/* ===== COMMENTS ===== */}
      <div>
        <button
          onClick={() => setCommentsOpen((v) => !v)}
          className="w-full flex items-center justify-between py-1 group"
        >
          <span className="text-[9px] font-bold text-c-text-secondary uppercase tracking-wider flex items-center gap-1.5">
            <MessageSquare className="w-3 h-3" />
            {t('reportBuilder.reviewPanel.comments', 'Comments')}
            {summary && (
              <span
                className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                  openCount > 0 ? 'bg-amber-900/30 text-amber-400' : 'bg-c-text text-c-bg-secondary'
                }`}
              >
                {openCount > 0 ? openCount : summary.total}
              </span>
            )}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAddComment(!showAddComment);
              }}
              className="p-0.5 text-blue-500 hover:bg-blue-900/20 rounded"
            >
              {showAddComment ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            </button>
            {commentsOpen ? (
              <ChevronDown className="w-3 h-3 text-c-text-secondary" />
            ) : (
              <ChevronRight className="w-3 h-3 text-c-text-secondary" />
            )}
          </div>
        </button>

        {commentsOpen && (
          <div className="mt-1 space-y-1.5">
            {showAddComment && (
              <div className="p-2 bg-c-surface rounded border border-c-border-subtle space-y-1.5">
                <div className="flex gap-1">
                  {[
                    { v: 'GENERAL' as const, l: t('reportBuilder.reviewPanel.general', 'General') },
                    { v: 'ISSUE' as const, l: t('reportBuilder.reviewPanel.issue', 'Issue') },
                    { v: 'QUESTION' as const, l: t('reportBuilder.reviewPanel.q', 'Q') },
                    { v: 'SUGGESTION' as const, l: t('reportBuilder.reviewPanel.suggest', 'Suggest') },
                  ].map((t) => (
                    <button
                      key={t.v}
                      onClick={() => setNewCommentType(t.v)}
                      className={`px-1.5 py-0.5 text-[8px] rounded font-semibold ${newCommentType === t.v ? 'bg-blue-600 text-c-text' : 'bg-c-surface-raised text-c-text-secondary hover:text-c-text-secondary'}`}
                    >
                      {t.l}
                    </button>
                  ))}
                </div>
                <textarea
                  value={newCommentContent}
                  onChange={(e) => setNewCommentContent(e.target.value)}
                  placeholder={t('reportBuilder.reviewPanel.comment', 'Comment...')}
                  rows={2}
                  className="w-full px-2 py-1 text-[10px] border border-c-border-subtle rounded bg-c-bg text-c-text resize-none outline-none placeholder:text-c-text-muted"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddComment();
                  }}
                />
                <button
                  onClick={handleAddComment}
                  disabled={isSubmitting || !newCommentContent.trim()}
                  className="w-full py-1 bg-blue-600 text-c-text rounded text-[9px] font-semibold disabled:opacity-40 hover:bg-blue-700"
                >
                  {t('reportBuilder.reviewPanel.add', 'Add')}
                </button>
              </div>
            )}

            {isLoading ? (
              <div className="flex justify-center py-3">
                <Loader2 className="w-4 h-4 animate-spin text-c-text-secondary" />
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-3">
                <MessageSquare className="w-5 h-5 text-c-text mx-auto mb-0.5" />
                <p className="text-[9px] text-c-text-secondary">
                  {t('reportBuilder.reviewPanel.noCommentsYet', 'No comments yet')}
                </p>
              </div>
            ) : (
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {comments.map((c) => {
                  const exp = expandedComments.has(c.id);
                  const open = c.status === 'OPEN';
                  const tc: Record<string, string> = {
                    ISSUE: 'text-danger-400 bg-danger-900/20',
                    QUESTION: 'text-blue-400 bg-blue-900/20',
                    SUGGESTION: 'text-c-accent bg-c-accent-soft',
                    GENERAL: 'text-c-text-secondary bg-c-surface-raised',
                    APPROVAL: 'text-emerald-400 bg-emerald-900/20',
                  };
                  return (
                    <div
                      key={c.id}
                      className={`p-1.5 rounded border ${open ? 'bg-c-surface border-c-border-subtle' : 'bg-c-surface border-c-border-subtle opacity-50'}`}
                    >
                      <div className="flex items-start gap-1">
                        <button
                          onClick={() => toggleComment(c.id)}
                          className="flex-1 text-left min-w-0"
                        >
                          <div className="flex items-center gap-1">
                            <span
                              className={`text-[7px] font-bold px-1 py-0.5 rounded ${tc[c.commentType] || tc.GENERAL}`}
                            >
                              {c.commentType}
                            </span>
                            {open && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                            )}
                          </div>
                          <p
                            className={`text-[10px] text-c-text-secondary mt-0.5 leading-snug ${!exp ? 'line-clamp-1' : ''}`}
                          >
                            {c.content}
                          </p>
                        </button>
                        <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
                          {open && (
                            <button
                              onClick={() => resolveComment(c.id)}
                              className="p-0.5 text-emerald-500 hover:bg-emerald-900/20 rounded"
                            >
                              <Check className="w-2.5 h-2.5" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteComment(c.id)}
                            className="p-0.5 text-c-text-secondary hover:text-danger-400 rounded"
                          >
                            <Trash2 className="w-2 h-2" />
                          </button>
                        </div>
                      </div>
                      {exp && (
                        <div className="mt-1 text-[8px] text-c-text-secondary flex items-center gap-1">
                          <Clock className="w-2 h-2" />
                          {new Date(c.createdAt).toLocaleString()}
                          {c.authorName && ` · ${c.authorName}`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewPanel;
