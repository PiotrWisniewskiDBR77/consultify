import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  User,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import type { ContentReview, ContentReviewPriority, ContentReviewStatus } from '../../types';

interface PlaybookTemplateReviewsProps {
  templateId: string;
  templateVersion: number;
  onReviewComplete?: () => void;
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export const PlaybookTemplateReviews: React.FC<PlaybookTemplateReviewsProps> = ({
  templateId,
  templateVersion,
  onReviewComplete,
}) => {
  const token = localStorage.getItem('token');

  const [reviews, setReviews] = useState<ContentReview[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewReview, setShowNewReview] = useState(false);
  const [expandedReview, setExpandedReview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // New review form
  const [newReview, setNewReview] = useState({
    reviewerId: '',
    priority: 'NORMAL' as ContentReviewPriority,
    dueDate: '',
    checklistItems: [] as Array<{ id: string; label: string; checked: boolean }>,
  });

  // Review action state
  const [reviewNotes, setReviewNotes] = useState('');

  const loadReviews = useCallback(async () => {
    try {
      const res = await fetch(`/api/content/playbooks/templates/${templateId}/reviews`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
      }
    } catch (err) {
      console.error('Failed to load reviews:', err);
    } finally {
      setLoading(false);
    }
  }, [token, templateId]);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || data || []);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }, [token]);

  useEffect(() => {
    loadReviews();
    loadUsers();
  }, [loadReviews, loadUsers]);

  const handleCreateReview = async () => {
    if (!newReview.reviewerId) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/content/playbooks/templates/${templateId}/reviews`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reviewerId: newReview.reviewerId,
          priority: newReview.priority,
          dueDate: newReview.dueDate || undefined,
          checklistItems: newReview.checklistItems,
        }),
      });

      if (res.ok) {
        setShowNewReview(false);
        setNewReview({
          reviewerId: '',
          priority: 'NORMAL',
          dueDate: '',
          checklistItems: [],
        });
        loadReviews();
      }
    } catch (err) {
      console.error('Failed to create review:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (reviewId: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/content/reviews/${reviewId}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reviewNotes }),
      });

      if (res.ok) {
        setReviewNotes('');
        loadReviews();
        onReviewComplete?.();
      }
    } catch (err) {
      console.error('Failed to approve review:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (reviewId: string) => {
    if (!reviewNotes.trim()) {
      alert('Please provide rejection notes');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/content/reviews/${reviewId}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reviewNotes }),
      });

      if (res.ok) {
        setReviewNotes('');
        loadReviews();
        onReviewComplete?.();
      }
    } catch (err) {
      console.error('Failed to reject review:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestChanges = async (reviewId: string) => {
    if (!reviewNotes.trim()) {
      alert('Please specify the requested changes');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/content/reviews/${reviewId}/request-changes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reviewNotes }),
      });

      if (res.ok) {
        setReviewNotes('');
        loadReviews();
      }
    } catch (err) {
      console.error('Failed to request changes:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const addChecklistItem = () => {
    const id = `check-${Date.now()}`;
    setNewReview((prev) => ({
      ...prev,
      checklistItems: [...prev.checklistItems, { id, label: '', checked: false }],
    }));
  };

  const updateChecklistItem = (id: string, label: string) => {
    setNewReview((prev) => ({
      ...prev,
      checklistItems: prev.checklistItems.map((item: any) =>
        item.id === id ? { ...item, label } : item
      ),
    }));
  };

  const removeChecklistItem = (id: string) => {
    setNewReview((prev) => ({
      ...prev,
      checklistItems: prev.checklistItems.filter((item: any) => item.id !== id),
    }));
  };

  const getStatusBadge = (status: ContentReviewStatus) => {
    const styles: Record<ContentReviewStatus, { bg: string; text: string; icon: React.ReactNode }> =
      {
        PENDING: { bg: 'bg-amber-500/10', text: 'text-amber-400', icon: <Clock size={12} /> },
        IN_REVIEW: {
          bg: 'bg-blue-500/10',
          text: 'text-blue-400',
          icon: <ClipboardCheck size={12} />,
        },
        APPROVED: {
          bg: 'bg-emerald-500/10',
          text: 'text-emerald-400',
          icon: <CheckCircle2 size={12} />,
        },
        REJECTED: { bg: 'bg-danger-500/10', text: 'text-danger-400', icon: <XCircle size={12} /> },
        CHANGES_REQUESTED: {
          bg: 'bg-amber-500/10',
          text: 'text-amber-400',
          icon: <AlertCircle size={12} />,
        },
      };

    const style = styles[status];
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style.bg} ${style.text} border border-current/20`}
      >
        {style.icon}
        {status.replace('_', ' ')}
      </span>
    );
  };

  const getPriorityBadge = (priority: ContentReviewPriority) => {
    const styles: Record<ContentReviewPriority, string> = {
      LOW: 'bg-slate-500/10 text-slate-600 dark:text-slate-500',
      NORMAL: 'bg-blue-500/10 text-blue-400',
      HIGH: 'bg-amber-500/10 text-amber-400',
      URGENT: 'bg-danger-500/10 text-danger-400',
    };

    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[priority]}`}>
        {priority}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 text-slate-600 dark:text-slate-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-primary-400" />
          <h3 className="font-semibold text-c-text">Reviews</h3>
          <span className="px-2 py-0.5 bg-c-surface-raised text-slate-600 text-xs rounded-full">
            {reviews.length}
          </span>
        </div>
        <button
          onClick={() => setShowNewReview(!showNewReview)}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary-500/10 text-primary-400 border border-primary-500/30 rounded-lg text-sm hover:bg-primary-500/20"
        >
          <Plus size={14} />
          Request Review
        </button>
      </div>

      {/* New Review Form */}
      {showNewReview && (
        <div className="bg-c-surface-raised/50 border border-c-border/50 rounded-lg p-4 space-y-4">
          <h4 className="font-medium text-c-text">Request New Review</h4>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Reviewer *</label>
              <select
                value={newReview.reviewerId}
                onChange={(e) => setNewReview((prev) => ({ ...prev, reviewerId: e.target.value }))}
                className="w-full px-3 py-2 bg-c-text text-c-bg border border-c-border rounded-lg focus:outline-none focus:ring-2 focus:ring-c-focus"
              >
                <option value="">Select reviewer...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName} ({user.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Priority</label>
              <select
                value={newReview.priority}
                onChange={(e) =>
                  setNewReview((prev) => ({
                    ...prev,
                    priority: e.target.value as ContentReviewPriority,
                  }))
                }
                className="w-full px-3 py-2 bg-c-text text-c-bg border border-c-border rounded-lg focus:outline-none focus:ring-2 focus:ring-c-focus"
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Due Date</label>
              <input
                type="date"
                value={newReview.dueDate}
                onChange={(e) => setNewReview((prev) => ({ ...prev, dueDate: e.target.value }))}
                className="w-full px-3 py-2 bg-c-text text-c-bg border border-c-border rounded-lg focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
            </div>
          </div>

          {/* Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-600">Review Checklist</label>
              <button
                onClick={addChecklistItem}
                className="text-xs text-primary-400 hover:text-primary-300"
              >
                + Add Item
              </button>
            </div>
            <div className="space-y-2">
              {newReview.checklistItems.map((item: any) => (
                <div key={item.id} className="flex gap-2">
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => updateChecklistItem(item.id, e.target.value)}
                    placeholder="Checklist item..."
                    className="flex-1 px-3 py-1.5 bg-c-text text-c-bg border border-c-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-c-focus"
                  />
                  <button
                    onClick={() => removeChecklistItem(item.id)}
                    className="px-2 text-danger-400 hover:text-danger-300"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowNewReview(false)}
              className="px-4 py-2 text-slate-600 dark:text-slate-500 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateReview}
              disabled={submitting || !newReview.reviewerId}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg font-medium hover:from-primary-600 hover:to-primary-700 disabled:opacity-50"
            >
              {submitting ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
              Send Request
            </button>
          </div>
        </div>
      )}

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div className="text-center py-8">
          <ClipboardCheck className="w-10 h-10 text-slate-600 dark:text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-slate-500">No reviews yet</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Request a review to get feedback
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => {
            const isExpanded = expandedReview === review.id;
            const isPending = review.status === 'PENDING' || review.status === 'IN_REVIEW';

            return (
              <div
                key={review.id}
                className="bg-c-surface-raised/50 border border-c-border/50 rounded-lg overflow-hidden"
              >
                {/* Header */}
                <button
                  onClick={() => setExpandedReview(isExpanded ? null : review.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-c-surface-raised/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                      {review.reviewer ? (
                        <span className="text-xs font-medium text-c-text">
                          {review.reviewer.firstName?.[0]}
                          {review.reviewer.lastName?.[0]}
                        </span>
                      ) : (
                        <User size={14} className="text-c-text" />
                      )}
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-c-text">
                        {review.reviewer
                          ? `${review.reviewer.firstName} ${review.reviewer.lastName}`
                          : 'Unknown Reviewer'}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Requested by{' '}
                        {review.requester
                          ? `${review.requester.firstName} ${review.requester.lastName}`
                          : 'Unknown'}
                        {' · '}
                        {new Date(review.requestedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {getStatusBadge(review.status)}
                    {getPriorityBadge(review.priority)}
                    {isExpanded ? (
                      <ChevronDown size={16} className="text-slate-600 dark:text-slate-500" />
                    ) : (
                      <ChevronRight size={16} className="text-slate-600 dark:text-slate-500" />
                    )}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-c-border/50">
                    <div className="pt-4 space-y-4">
                      {/* Review info */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-600 dark:text-slate-500">Version:</span>{' '}
                          <span className="text-c-text">v{review.versionAtReview || 'N/A'}</span>
                        </div>
                        {review.dueDate && (
                          <div>
                            <span className="text-slate-600 dark:text-slate-500">Due:</span>{' '}
                            <span className="text-c-text">
                              {new Date(review.dueDate).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {review.reviewedAt && (
                          <div>
                            <span className="text-slate-600 dark:text-slate-500">Reviewed:</span>{' '}
                            <span className="text-c-text">
                              {new Date(review.reviewedAt).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Checklist */}
                      {review.checklistItems && review.checklistItems.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-slate-600 dark:text-slate-500 mb-2">
                            Checklist
                          </div>
                          <div className="space-y-1">
                            {review.checklistItems.map((item: any) => (
                              <div key={item.id} className="flex items-center gap-2 text-sm">
                                {item.checked ? (
                                  <CheckCircle2 size={14} className="text-emerald-400" />
                                ) : (
                                  <div className="w-3.5 h-3.5 border border-slate-500 rounded" />
                                )}
                                <span
                                  className={
                                    item.checked
                                      ? 'text-slate-600 dark:text-slate-500 line-through'
                                      : 'text-slate-600'
                                  }
                                >
                                  {item.label}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Review notes */}
                      {review.reviewNotes && (
                        <div>
                          <div className="text-xs font-medium text-slate-600 dark:text-slate-500 mb-1">
                            Review Notes
                          </div>
                          <p className="text-sm text-slate-600 bg-c-surface/50 p-3 rounded-lg">
                            {review.reviewNotes}
                          </p>
                        </div>
                      )}

                      {/* Actions for pending reviews */}
                      {isPending && (
                        <div className="pt-2 border-t border-c-border/50 space-y-3">
                          <textarea
                            value={reviewNotes}
                            onChange={(e) => setReviewNotes(e.target.value)}
                            placeholder="Add review notes..."
                            rows={2}
                            className="w-full px-3 py-2 bg-c-text text-c-bg border border-c-border rounded-lg text-sm placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-c-focus"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(review.id)}
                              disabled={submitting}
                              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm hover:bg-emerald-500/20 disabled:opacity-50"
                            >
                              <CheckCircle2 size={14} />
                              Approve
                            </button>
                            <button
                              onClick={() => handleRequestChanges(review.id)}
                              disabled={submitting}
                              className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg text-sm hover:bg-amber-500/20 disabled:opacity-50"
                            >
                              <AlertCircle size={14} />
                              Request Changes
                            </button>
                            <button
                              onClick={() => handleReject(review.id)}
                              disabled={submitting}
                              className="flex items-center gap-2 px-3 py-1.5 bg-danger-500/10 text-danger-400 border border-danger-500/30 rounded-lg text-sm hover:bg-danger-500/20 disabled:opacity-50"
                            >
                              <XCircle size={14} />
                              Reject
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PlaybookTemplateReviews;
