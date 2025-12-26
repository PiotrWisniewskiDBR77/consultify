/**
 * AssessmentDashboard
 * Overview dashboard for Assessment Module with stats and quick actions
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    FileText,
    Clock,
    CheckCircle2,
    AlertTriangle,
    Plus,
    ArrowRight,
    Bell,
    TrendingUp,
    Activity,
    RefreshCw,
    Loader2,
    Eye,
    Edit,
    Sparkles
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { AppView, WorkflowState } from '../../types';

interface DashboardStats {
    total: number;
    drafts: number;
    inReview: number;
    approved: number;
    rejected: number;
    pendingReviews: number;
    pendingApprovals: number;
}

interface RecentAssessment {
    id: string;
    name: string;
    projectName: string;
    status: WorkflowState;
    progress: number;
    updatedAt: string;
}

interface PendingAction {
    id: string;
    type: 'review' | 'approval' | 'revision';
    assessmentName: string;
    requestedBy: string;
    dueDate?: string;
    isOverdue: boolean;
}

interface AssessmentDashboardProps {
    onNavigate: (view: AppView, params?: any) => void;
    onNewAssessment: () => void;
}

export const AssessmentDashboard: React.FC<AssessmentDashboardProps> = ({
    onNavigate,
    onNewAssessment
}) => {
    const { currentUser } = useAppStore();

    // State
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [recentAssessments, setRecentAssessments] = useState<RecentAssessment[]>([]);
    const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Fetch dashboard data
    const fetchDashboardData = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');

            // Fetch stats and recent assessments
            const [statsRes, recentRes, actionsRes] = await Promise.all([
                fetch('/api/assessments/stats', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }).catch(() => null),
                fetch('/api/assessments/recent?limit=5', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }).catch(() => null),
                fetch('/api/assessment-workflow/pending-actions', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }).catch(() => null)
            ]);

            // Parse responses with fallbacks
            const statsData = statsRes?.ok ? await statsRes.json() : {
                total: 0,
                drafts: 0,
                inReview: 0,
                approved: 0,
                rejected: 0,
                pendingReviews: 0,
                pendingApprovals: 0
            };

            const recentData = recentRes?.ok ? await recentRes.json() : { assessments: [] };
            const actionsData = actionsRes?.ok ? await actionsRes.json() : { actions: [] };

            setStats(statsData);
            setRecentAssessments(recentData.assessments || []);
            setPendingActions(actionsData.actions || []);

        } catch (err) {
            console.error('[AssessmentDashboard] Error:', err);
            // Set fallback data
            setStats({
                total: 0,
                drafts: 0,
                inReview: 0,
                approved: 0,
                rejected: 0,
                pendingReviews: 0,
                pendingApprovals: 0
            });
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        fetchDashboardData();
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const getStatusColor = (status: WorkflowState) => {
        switch (status) {
            case 'DRAFT':
                return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
            case 'IN_REVIEW':
                return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
            case 'AWAITING_APPROVAL':
                return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
            case 'APPROVED':
                return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'REJECTED':
                return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
            default:
                return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-7xl mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-navy-900 dark:text-white">
                            Assessment Dashboard
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            Overview of your digital maturity assessments
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={onNewAssessment}
                            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors"
                        >
                            <Plus size={18} />
                            New Assessment
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                    <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-navy-900 dark:text-white">{stats.total}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                    <Edit className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-navy-900 dark:text-white">{stats.drafts}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Drafts</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                                    <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-navy-900 dark:text-white">{stats.inReview}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">In Review</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-navy-900 dark:text-white">{stats.approved}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Approved</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                                    <Eye className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-navy-900 dark:text-white">{stats.pendingReviews}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">To Review</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-navy-900 dark:text-white">{stats.rejected}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Rejected</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Pending Actions */}
                    <div className="lg:col-span-1 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                        <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Bell className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                <h3 className="font-semibold text-navy-900 dark:text-white">
                                    Pending Actions
                                </h3>
                            </div>
                            {pendingActions.length > 0 && (
                                <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-medium rounded-full">
                                    {pendingActions.length}
                                </span>
                            )}
                        </div>
                        <div className="divide-y divide-slate-200 dark:divide-white/10">
                            {pendingActions.length === 0 ? (
                                <div className="p-6 text-center">
                                    <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                                        All caught up! No pending actions.
                                    </p>
                                </div>
                            ) : (
                                pendingActions.slice(0, 5).map((action) => (
                                    <div 
                                        key={action.id}
                                        className={`p-4 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors ${
                                            action.isOverdue ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`p-1.5 rounded-lg ${
                                                action.type === 'review' ? 'bg-amber-100 dark:bg-amber-900/30' :
                                                action.type === 'approval' ? 'bg-purple-100 dark:bg-purple-900/30' :
                                                'bg-red-100 dark:bg-red-900/30'
                                            }`}>
                                                {action.type === 'review' && <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                                                {action.type === 'approval' && <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />}
                                                {action.type === 'revision' && <Edit className="w-4 h-4 text-red-600 dark:text-red-400" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-navy-900 dark:text-white truncate">
                                                    {action.assessmentName}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {action.type === 'review' && 'Review requested'}
                                                    {action.type === 'approval' && 'Needs approval'}
                                                    {action.type === 'revision' && 'Needs revision'}
                                                    {' by '}{action.requestedBy}
                                                </p>
                                                {action.isOverdue && (
                                                    <span className="text-xs text-red-500 font-medium">Overdue</span>
                                                )}
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-slate-400" />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        {pendingActions.length > 5 && (
                            <div className="p-3 border-t border-slate-200 dark:border-white/10">
                                <button
                                    onClick={() => onNavigate(AppView.REVIEWER_DASHBOARD)}
                                    className="w-full text-center text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
                                >
                                    View all ({pendingActions.length})
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Recent Assessments */}
                    <div className="lg:col-span-2 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                        <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                <h3 className="font-semibold text-navy-900 dark:text-white">
                                    Recent Assessments
                                </h3>
                            </div>
                            <button
                                onClick={() => onNavigate(AppView.MY_ASSESSMENTS)}
                                className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
                            >
                                View all
                            </button>
                        </div>
                        <div className="divide-y divide-slate-200 dark:divide-white/10">
                            {recentAssessments.length === 0 ? (
                                <div className="p-8 text-center">
                                    <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                                    <p className="text-slate-500 dark:text-slate-400 mb-4">
                                        No assessments yet. Start your first assessment!
                                    </p>
                                    <button
                                        onClick={onNewAssessment}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors"
                                    >
                                        <Plus size={16} />
                                        New Assessment
                                    </button>
                                </div>
                            ) : (
                                recentAssessments.map((assessment) => (
                                    <div 
                                        key={assessment.id}
                                        className="p-4 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="font-medium text-navy-900 dark:text-white truncate">
                                                        {assessment.name}
                                                    </p>
                                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(assessment.status)}`}>
                                                        {assessment.status.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                                    {assessment.projectName} • Updated {formatDate(assessment.updatedAt)}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-4 shrink-0">
                                                {/* Progress */}
                                                <div className="w-24">
                                                    <div className="flex items-center justify-between text-xs mb-1">
                                                        <span className="text-slate-500 dark:text-slate-400">Progress</span>
                                                        <span className="text-slate-700 dark:text-slate-300 font-medium">{assessment.progress}%</span>
                                                    </div>
                                                    <div className="h-1.5 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-purple-500 rounded-full"
                                                            style={{ width: `${assessment.progress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-slate-400" />
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold mb-1">
                                Ready to transform your digital maturity?
                            </h3>
                            <p className="text-purple-200 text-sm">
                                Complete your assessment and generate AI-powered initiatives for your transformation roadmap.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => onNavigate(AppView.GAP_MAP)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 rounded-lg font-medium transition-colors"
                            >
                                <TrendingUp size={18} />
                                View Gap Map
                            </button>
                            <button
                                onClick={() => onNavigate(AppView.INITIATIVE_GENERATOR)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white text-purple-600 hover:bg-purple-50 rounded-lg font-semibold transition-colors"
                            >
                                <Sparkles size={18} />
                                Generate Initiatives
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

