/**
 * SubmitForReviewModal
 * 
 * Modal for selecting reviewers when submitting an assessment for review.
 * Fetches list of users with review permissions and allows multiple selection.
 */

import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Send, X, User, Loader2, CheckCircle2, AlertCircle, Users } from 'lucide-react';

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
    onSubmitted
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
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    setUsers(data.users || []);
                } else {
                    // Fallback: fetch all users if canReview filter not implemented
                    const fallbackResponse = await fetch('/api/users', {
                        headers: { 'Authorization': `Bearer ${token}` }
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
        setSelectedReviewers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    }, []);

    // Select all reviewers
    const selectAll = useCallback(() => {
        setSelectedReviewers(users.map(u => u.id));
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
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reviewers: selectedReviewers })
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
    const groupedUsers = users.reduce((acc, user) => {
        const dept = user.department || 'Zespół';
        if (!acc[dept]) acc[dept] = [];
        acc[dept].push(user);
        return acc;
    }, {} as Record<string, Reviewer[]>);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-navy-900 rounded-xl w-full max-w-lg shadow-xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                                Wyślij do recenzji
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                {assessmentName}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-4 max-h-[400px] overflow-y-auto">
                    {success ? (
                        <div className="flex flex-col items-center justify-center py-8">
                            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                            </div>
                            <p className="text-lg font-medium text-navy-900 dark:text-white">
                                Wysłano do recenzji!
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Recenzenci otrzymają powiadomienie
                            </p>
                        </div>
                    ) : loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-8">
                            <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-500 dark:text-slate-400">
                                Brak użytkowników z uprawnieniami do recenzji
                            </p>
                        </div>
                    ) : (
                        <>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                Wybierz recenzentów, którzy ocenią ten assessment:
                            </p>

                            {/* Quick actions */}
                            <div className="flex items-center gap-2 mb-4">
                                <button
                                    onClick={selectAll}
                                    className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                                >
                                    Zaznacz wszystkich
                                </button>
                                <span className="text-slate-300 dark:text-slate-600">|</span>
                                <button
                                    onClick={clearSelection}
                                    className="text-xs text-slate-500 hover:underline"
                                >
                                    Wyczyść wybór
                                </button>
                                <span className="ml-auto text-xs text-slate-400">
                                    Wybrano: {selectedReviewers.length}
                                </span>
                            </div>

                            {/* Users list */}
                            <div className="space-y-4">
                                {Object.entries(groupedUsers).map(([dept, deptUsers]) => (
                                    <div key={dept}>
                                        {Object.keys(groupedUsers).length > 1 && (
                                            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                                                {dept}
                                            </p>
                                        )}
                                        <div className="space-y-2">
                                            {deptUsers.map(user => {
                                                const isSelected = selectedReviewers.includes(user.id);
                                                return (
                                                    <label
                                                        key={user.id}
                                                        className={`
                                                            flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                                                            ${isSelected
                                                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                                                : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                                                            }
                                                        `}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleReviewer(user.id)}
                                                            className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                                                        />
                                                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                                                            <User size={16} className="text-slate-500 dark:text-slate-400" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-navy-900 dark:text-white text-sm truncate">
                                                                {user.firstName} {user.lastName}
                                                            </p>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
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
                        <div className="flex items-center gap-2 p-3 mt-4 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg text-sm">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!success && (
                    <div className="px-6 py-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-950">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 rounded-lg font-medium hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                            >
                                Anuluj
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={selectedReviewers.length === 0 || submitting || loading}
                                className={`
                                    flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all
                                    ${selectedReviewers.length > 0 && !submitting
                                        ? 'bg-purple-600 hover:bg-purple-500 text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
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

