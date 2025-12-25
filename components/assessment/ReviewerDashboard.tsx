/**
 * ReviewerDashboard
 * Dashboard for assessment reviewers showing pending, in-progress, and completed reviews
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
    ClipboardCheck, 
    Clock, 
    CheckCircle2, 
    AlertTriangle,
    ChevronRight,
    Star,
    MessageSquare,
    User,
    Calendar,
    Timer,
    Loader2,
    RefreshCw,
    Filter,
    BarChart3,
    AlertCircle
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

interface Review {
    id: string;
    workflowId: string;
    assessmentId: string;
    assessmentName: string;
    projectName: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
    assignedAt: string;
    startedAt?: string;
    completedAt?: string;
    dueDate?: string;
    isOverdue: boolean;
    requestedBy: string;
    requestedByName: string;
    feedback?: string;
    rating?: number;
}

interface ReviewerStats {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    overdue: number;
    avgCompletionTime: number; // hours
}

interface ReviewerDashboardProps {
    onNavigateToReview?: (assessmentId: string, reviewId: string) => void;
}

type TabType = 'pending' | 'in_progress' | 'completed';

export const ReviewerDashboard: React.FC<ReviewerDashboardProps> = ({
    onNavigateToReview
}) => {
    const { currentUser, setCurrentView } = useAppStore();
    
    // State
    const [reviews, setReviews] = useState<Review[]>([]);
    const [stats, setStats] = useState<ReviewerStats | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('pending');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Fetch reviews
    const fetchReviews = useCallback(async () => {
        try {
            const response = await fetch('/api/assessment-workflow/pending-reviews', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch reviews');
            }

            const data = await response.json();
            setReviews(data.reviews || []);
            
            // Calculate stats
            const allReviews = data.reviews || [];
            const pending = allReviews.filter((r: Review) => r.status === 'PENDING');
            const inProgress = allReviews.filter((r: Review) => r.status === 'IN_PROGRESS');
            const completed = allReviews.filter((r: Review) => r.status === 'COMPLETED');
            const overdue = allReviews.filter((r: Review) => r.isOverdue && r.status !== 'COMPLETED');

            // Calculate avg completion time
            const completedWithTime = completed.filter((r: Review) => r.assignedAt && r.completedAt);
            const avgTime = completedWithTime.length > 0
                ? completedWithTime.reduce((sum: number, r: Review) => {
                    const assigned = new Date(r.assignedAt).getTime();
                    const done = new Date(r.completedAt!).getTime();
                    return sum + (done - assigned) / (1000 * 60 * 60);
                }, 0) / completedWithTime.length
                : 0;

            setStats({
                total: allReviews.length,
                pending: pending.length,
                inProgress: inProgress.length,
                completed: completed.length,
                overdue: overdue.length,
                avgCompletionTime: Math.round(avgTime)
            });

        } catch (err: any) {
            console.error('[ReviewerDashboard] Error:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchReviews();
    }, [fetchReviews]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchReviews();
    };

    const handleStartReview = async (review: Review) => {
        try {
            // Update review status to IN_PROGRESS
            await fetch(`/api/assessment-workflow/reviews/${review.id}/start`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            // Navigate to assessment
            if (onNavigateToReview) {
                onNavigateToReview(review.assessmentId, review.id);
            } else {
                // Default navigation
                setCurrentView(AppView.FULL_STEP1_ASSESSMENT);
            }
        } catch (err) {
            console.error('Failed to start review:', err);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('pl-PL', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getTimeAgo = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
        
        if (diffHours < 1) return 'przed chwilą';
        if (diffHours < 24) return `${diffHours}h temu`;
        const days = Math.floor(diffHours / 24);
        return `${days} dni temu`;
    };

    const filteredReviews = reviews.filter(review => {
        switch (activeTab) {
            case 'pending':
                return review.status === 'PENDING';
            case 'in_progress':
                return review.status === 'IN_PROGRESS';
            case 'completed':
                return review.status === 'COMPLETED' || review.status === 'SKIPPED';
            default:
                return true;
        }
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                        <ClipboardCheck className="w-8 h-8 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-navy-900 dark:text-white">
                            Panel Recenzenta
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            Zarządzaj przypisanymi recenzjami ocen
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Odśwież
                </button>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-navy-900 dark:text-white">{stats.total}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Wszystkie</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-navy-900 dark:text-white">{stats.pending}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Oczekujące</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                <Timer className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-navy-900 dark:text-white">{stats.inProgress}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">W trakcie</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-navy-900 dark:text-white">{stats.completed}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Ukończone</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-navy-900 dark:text-white">{stats.overdue}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Przeterminowane</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200 dark:border-white/10">
                {[
                    { id: 'pending' as TabType, label: 'Oczekujące', icon: Clock, count: stats?.pending },
                    { id: 'in_progress' as TabType, label: 'W trakcie', icon: Timer, count: stats?.inProgress },
                    { id: 'completed' as TabType, label: 'Ukończone', icon: CheckCircle2, count: stats?.completed }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                            activeTab === tab.id
                                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        <span className="font-medium">{tab.label}</span>
                        {tab.count !== undefined && tab.count > 0 && (
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                activeTab === tab.id
                                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                                    : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400'
                            }`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Reviews List */}
            <div className="space-y-4">
                {error && (
                    <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-lg text-red-700 dark:text-red-300">
                        <AlertCircle className="w-5 h-5" />
                        <span>{error}</span>
                    </div>
                )}

                {filteredReviews.length === 0 ? (
                    <div className="text-center py-12">
                        <ClipboardCheck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-500 dark:text-slate-400">
                            {activeTab === 'pending' && 'Brak oczekujących recenzji'}
                            {activeTab === 'in_progress' && 'Brak recenzji w trakcie'}
                            {activeTab === 'completed' && 'Brak ukończonych recenzji'}
                        </p>
                    </div>
                ) : (
                    filteredReviews.map(review => (
                        <div
                            key={review.id}
                            className={`bg-white dark:bg-navy-900 rounded-xl border p-4 transition-all hover:shadow-lg ${
                                review.isOverdue && review.status !== 'COMPLETED'
                                    ? 'border-red-300 dark:border-red-500/30'
                                    : 'border-slate-200 dark:border-white/10'
                            }`}
                        >
                            <div className="flex items-start gap-4">
                                {/* Status Icon */}
                                <div className={`p-3 rounded-xl ${
                                    review.status === 'COMPLETED'
                                        ? 'bg-green-100 dark:bg-green-900/30'
                                        : review.isOverdue
                                            ? 'bg-red-100 dark:bg-red-900/30'
                                            : review.status === 'IN_PROGRESS'
                                                ? 'bg-purple-100 dark:bg-purple-900/30'
                                                : 'bg-amber-100 dark:bg-amber-900/30'
                                }`}>
                                    {review.status === 'COMPLETED' ? (
                                        <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                                    ) : review.isOverdue ? (
                                        <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                                    ) : review.status === 'IN_PROGRESS' ? (
                                        <Timer className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                    ) : (
                                        <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h3 className="font-semibold text-navy-900 dark:text-white">
                                                {review.assessmentName || 'Ocena DRD'}
                                            </h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                {review.projectName}
                                            </p>
                                        </div>

                                        {review.isOverdue && review.status !== 'COMPLETED' && (
                                            <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-medium rounded-full">
                                                Przeterminowane
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-slate-500 dark:text-slate-400">
                                        <span className="flex items-center gap-1">
                                            <User className="w-3.5 h-3.5" />
                                            {review.requestedByName}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3.5 h-3.5" />
                                            Przypisano: {formatDate(review.assignedAt)}
                                        </span>
                                        {review.dueDate && (
                                            <span className={`flex items-center gap-1 ${
                                                review.isOverdue ? 'text-red-500' : ''
                                            }`}>
                                                <Timer className="w-3.5 h-3.5" />
                                                Termin: {formatDate(review.dueDate)}
                                            </span>
                                        )}
                                    </div>

                                    {/* Completed review details */}
                                    {review.status === 'COMPLETED' && (
                                        <div className="mt-3 p-3 bg-slate-50 dark:bg-navy-950/50 rounded-lg">
                                            <div className="flex items-center gap-4">
                                                {review.rating && (
                                                    <div className="flex items-center gap-1">
                                                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                                        <span className="font-medium text-navy-900 dark:text-white">
                                                            {review.rating}/5
                                                        </span>
                                                    </div>
                                                )}
                                                {review.feedback && (
                                                    <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                                                        <MessageSquare className="w-4 h-4" />
                                                        <span className="truncate max-w-md">
                                                            "{review.feedback}"
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            {review.completedAt && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                                    Ukończono: {formatDate(review.completedAt)}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Action Button */}
                                {review.status !== 'COMPLETED' && review.status !== 'SKIPPED' && (
                                    <button
                                        onClick={() => handleStartReview(review)}
                                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors shrink-0"
                                    >
                                        {review.status === 'PENDING' ? 'Rozpocznij' : 'Kontynuuj'}
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ReviewerDashboard;

