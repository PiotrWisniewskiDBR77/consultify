/**
 * SubmitForReviewModal
 *
 * Modal for selecting reviewers when submitting an assessment for review.
 * Fetches list of users with review permissions and allows multiple selection.
 */

import { AlertCircle, CheckCircle2, Loader2, Send, User, Users, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface Reviewer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role?: string;
  department?: string;
}

interface SubmitForReviewModalProps {
  assessmentId: string;
  assessmentName?: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export const SubmitForReviewModal: React.FC<SubmitForReviewModalProps> = ({
  assessmentId,
  assessmentName = 'Assessment',
  onClose,
  onSubmitted,
}) => {
  const [users, setUsers] = useState<Reviewer[]>([]);
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch users with review permissions
  useEffect(() => {
    const fetchReviewers = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/users?canReview=true', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setUsers(data.users || []);
        } else {
          // Fallback: fetch all users if canReview filter not implemented
          const fallbackResponse = await fetch('/api/users', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            setUsers(fallbackData.users || []);
          } else {
            setError('Nie udało się pobrać listy użytkowników');
          }
        }
      } catch (err) {
        console.error('[SubmitForReviewModal] Error fetching reviewers:', err);
        setError('Błąd połączenia');
      } finally {
        setLoading(false);
      }
    };

    fetchReviewers();
  }, []);

  // Toggle reviewer selection
  const toggleReviewer = useCallback((userId: string) => {
    setSelectedReviewers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }, []);

  // Select all reviewers
  const selectAll = useCallback(() => {
    setSelectedReviewers(users.map((u) => u.id));
  }, [users]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedReviewers([]);
  }, []);

  // Submit for review
  const handleSubmit = async () => {
    if (selectedReviewers.length === 0) {
      setError('Wybierz co najmniej jednego recenzenta');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/assessment-workflow/${assessmentId}/submit-for-review`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reviewers: selectedReviewers }),
      });

      if (response.ok) {
        setSuccess(true);
        toast.success('Wysłano do recenzji');
        setTimeout(() => {
          onSubmitted();
          onClose();
        }, 1500);
      } else {
        const data = await response.json();
        setError(data.error || 'Nie udało się wysłać do recenzji');
        toast.error('Nie udało się wysłać do recenzji');
      }
    } catch (err) {
      console.error('[SubmitForReviewModal] Submit error:', err);
      setError('Błąd połączenia');
      toast.error('Błąd połączenia');
    } finally {
      setSubmitting(false);
    }
  };

  // Group users by department if available
  const groupedUsers = users.reduce(
    (acc, user) => {
      const dept = user.department || 'Zespół';
      if (!acc[dept]) acc[dept] = [];
      acc[dept].push(user);
      return acc;
    },
    {} as Record<string, Reviewer[]>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-overlay p-4">
      <div className="bg-c-surface rounded-xl w-full max-w-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-c-border-subtle">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-c-text">Wyślij do recenzji</h3>
              <p className="text-sm text-c-text-muted mt-0.5">{assessmentName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-c-text-muted hover:text-c-text-secondary dark:hover:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[400px] overflow-y-auto">
          {success ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 rounded-full bg-[color-mix(in_srgb,var(--c-success)_15%,transparent)] flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-c-success" />
              </div>
              <p className="text-lg font-medium text-c-text">Wysłano do recenzji!</p>
              <p className="text-sm text-c-text-muted mt-1">Recenzenci otrzymają powiadomienie</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-c-accent animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-c-text-secondary dark:text-c-text-muted mx-auto mb-3" />
              <p className="text-c-text-muted">Brak użytkowników z uprawnieniami do recenzji</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-c-text-muted mb-4">
                Wybierz recenzentów, którzy ocenią ten assessment:
              </p>

              {/* Quick actions */}
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={selectAll}
                  className="text-xs text-c-accent dark:text-c-accent hover:underline"
                >
                  Zaznacz wszystkich
                </button>
                <span className="text-c-text-muted">|</span>
                <button
                  onClick={clearSelection}
                  className="text-xs text-c-text-muted hover:underline"
                >
                  Wyczyść wybór
                </button>
                <span className="ml-auto text-xs text-c-text-muted">
                  Wybrano: {selectedReviewers.length}
                </span>
              </div>

              {/* Users list */}
              <div className="space-y-4">
                {Object.entries(groupedUsers).map(([dept, deptUsers]) => (
                  <div key={dept}>
                    {Object.keys(groupedUsers).length > 1 && (
                      <p className="text-xs font-medium text-c-text-muted uppercase tracking-wider mb-2">
                        {dept}
                      </p>
                    )}
                    <div className="space-y-2">
                      {deptUsers.map((user) => {
                        const isSelected = selectedReviewers.includes(user.id);
                        return (
                          <label
                            key={user.id}
                            className={`
                                                            flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                                                            ${
                                                              isSelected
                                                                ? 'border-c-accent bg-c-accent-soft'
                                                                : 'border-c-border-subtle hover:bg-c-surface-raised dark:hover:bg-white/5'
                                                            }
                                                        `}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleReviewer(user.id)}
                              className="w-4 h-4 text-c-accent rounded border-c-border-subtle focus:ring-c-focus"
                            />
                            <div className="w-8 h-8 rounded-full bg-c-surface-raised flex items-center justify-center">
                              <User size={16} className="text-c-text-muted" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-c-text text-sm truncate">
                                {user.firstName} {user.lastName}
                              </p>
                              <p className="text-xs text-c-text-muted truncate">
                                {user.role || user.email}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 mt-4 bg-danger-50 dark:bg-danger-500/10 text-danger-600 dark:text-danger-400 rounded-lg text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="px-6 py-4 border-t border-c-border-subtle bg-c-surface-raised dark:bg-c-bg">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-c-border-subtle text-c-text-secondary dark:text-c-text-muted rounded-lg font-medium hover:bg-c-surface-raised dark:hover:bg-white/5 transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={handleSubmit}
                disabled={selectedReviewers.length === 0 || submitting || loading}
                className={`
                                    flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all
                                    ${
                                      selectedReviewers.length > 0 && !submitting
                                        ? 'bg-c-text text-c-surface hover:opacity-90'
                                        : 'bg-c-surface-raised text-c-text-secondary dark:text-c-text-muted cursor-not-allowed'
                                    }
                                `}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Wysyłam...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Wyślij ({selectedReviewers.length})
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
