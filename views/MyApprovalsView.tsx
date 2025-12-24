import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ClipboardList,
    CheckCircle2,
    Clock,
    AlertTriangle,
    RefreshCw,
    Filter
} from 'lucide-react';

interface Approval {
    id: string;
    proposal_id: string;
    assigned_to_user_id: string;
    status: 'PENDING' | 'ACKED' | 'DONE' | 'EXPIRED';
    sla_due_at: string;
    action_type?: string;
    scope?: string;
    isOverdue: boolean;
    acked_at?: string;
    created_at: string;
}

interface MyApprovalsViewProps {
    onSelectProposal?: (proposalId: string) => void;
}

const MyApprovalsView: React.FC<MyApprovalsViewProps> = ({ onSelectProposal }) => {
    // Note: 't' and 'currentUser' are available from useAppStore/useTranslation but not currently used
    const [approvals, setApprovals] = useState<Approval[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('PENDING');

    const token = localStorage.getItem('token');

    const fetchApprovals = useCallback(async () => {
        if (!token) return;

        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            if (statusFilter && statusFilter !== 'ALL') {
                params.append('status', statusFilter);
            }

            const response = await fetch(`/api/workqueue/approvals?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch approvals');
            }

            const data = await response.json();
            setApprovals(data.approvals || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [token, statusFilter]);

    useEffect(() => {
        fetchApprovals();
    }, [fetchApprovals]);

    const handleAcknowledge = async (proposalId: string) => {
        try {
            const response = await fetch(`/api/workqueue/approvals/${proposalId}/ack`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to acknowledge approval');
            }

            fetchApprovals();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
    };

    const handleComplete = async (proposalId: string) => {
        try {
            const response = await fetch(`/api/workqueue/approvals/${proposalId}/complete`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to complete approval');
            }

            fetchApprovals();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
    };

    const getStatusBadge = (status: string, isOverdue: boolean) => {
        if (isOverdue && (status === 'PENDING' || status === 'ACKED')) {
            return (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    Overdue
                </span>
            );
        }

        const configs: Record<string, { bg: string; text: string; icon?: React.ElementType }> = {
            PENDING: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-400', icon: Clock },
            ACKED: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-400' },
            DONE: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-400', icon: CheckCircle2 },
            EXPIRED: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' }
        };

        const config = configs[status] || configs.PENDING;
        const Icon = config.icon;

        return (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
                {Icon && <Icon className="w-3 h-3 inline mr-1" />}
                {status}
            </span>
        );
    };

    const formatDueDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = date.getTime() - now.getTime();
        const diffHours = Math.round(diffMs / (1000 * 60 * 60));

        if (diffHours < 0) {
            return `${Math.abs(diffHours)}h overdue`;
        } else if (diffHours < 24) {
            return `${diffHours}h left`;
        } else {
            return date.toLocaleDateString();
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <ClipboardList className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            My Approvals
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Action proposals assigned to you for review
                        </p>
                    </div>
                </div>

                <button
                    onClick={fetchApprovals}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="PENDING">Pending</option>
                        <option value="ACKED">Acknowledged</option>
                        <option value="DONE">Completed</option>
                        <option value="EXPIRED">Expired</option>
                    </select>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="p-4 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
                    {error}
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
            )}

            {/* Empty State */}
            {!loading && approvals.length === 0 && (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <ClipboardList className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        No approvals found
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400">
                        {statusFilter !== 'ALL'
                            ? `No ${statusFilter.toLowerCase()} approvals assigned to you.`
                            : 'No approvals are currently assigned to you.'}
                    </p>
                </div>
            )}

            {/* Approvals List */}
            {!loading && approvals.length > 0 && (
                <div className="space-y-4">
                    {approvals.map((approval) => (
                        <div
                            key={approval.id}
                            className={`p-4 bg-white dark:bg-gray-800 rounded-xl border ${approval.isOverdue
                                ? 'border-red-300 dark:border-red-700'
                                : 'border-gray-200 dark:border-gray-700'
                                } hover:shadow-md transition-shadow`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        {getStatusBadge(approval.status, approval.isOverdue)}
                                        {approval.action_type && (
                                            <span className="px-2 py-1 text-xs font-medium rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400">
                                                {approval.action_type}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                                        Proposal: {approval.proposal_id.slice(0, 12)}...
                                    </h3>
                                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-4 h-4" />
                                            Due: {formatDueDate(approval.sla_due_at)}
                                        </span>
                                        {approval.scope && (
                                            <span>Scope: {approval.scope}</span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {approval.status === 'PENDING' && (
                                        <button
                                            onClick={() => handleAcknowledge(approval.proposal_id)}
                                            className="px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50"
                                        >
                                            Acknowledge
                                        </button>
                                    )}
                                    {(approval.status === 'PENDING' || approval.status === 'ACKED') && (
                                        <button
                                            onClick={() => handleComplete(approval.proposal_id)}
                                            className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                                        >
                                            Complete
                                        </button>
                                    )}
                                    {onSelectProposal && (
                                        <button
                                            onClick={() => onSelectProposal(approval.proposal_id)}
                                            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                                        >
                                            View
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MyApprovalsView;
