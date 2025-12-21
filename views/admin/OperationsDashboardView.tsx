import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../store';
import { useTranslation } from 'react-i18next';
import {
    ChartBarIcon,
    ExclamationTriangleIcon,
    ClockIcon,
    XCircleIcon,
    ArrowPathIcon,
    CheckCircleIcon,
    BellAlertIcon
} from '@heroicons/react/24/outline';

interface AlertSummary {
    overdueApprovals: number;
    deadLetterJobs: number;
    stuckPlaybooks: number;
}

interface SlaHealth {
    total: number;
    pending: number;
    acknowledged: number;
    completed: number;
    expired: number;
    overdue: number;
    escalated: number;
}

interface StuckPlaybook {
    id: string;
    templateTitle: string;
    status: string;
    stuckSince: string;
}

interface DashboardData {
    alerts: AlertSummary;
    details: {
        slaHealth: SlaHealth;
        deadLetterStats: { count: number; byType?: Record<string, number> };
        stuckPlaybooks: StuckPlaybook[];
        outboxStats: { total: number; queued: number; sent: number; failed: number };
    };
}

const OperationsDashboardView: React.FC = () => {
    const { t } = useTranslation();
    const { token, currentUser } = useStore();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchDashboard = useCallback(async () => {
        if (!token) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/workqueue/alerts', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error('Admin access required');
                }
                throw new Error('Failed to fetch dashboard data');
            }

            const result = await response.json();
            setData(result);
            setLastUpdated(new Date());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchDashboard();
        // Auto-refresh every 2 minutes
        const interval = setInterval(fetchDashboard, 2 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchDashboard]);

    const getAlertLevel = (alerts: AlertSummary): 'critical' | 'warning' | 'healthy' => {
        const total = alerts.overdueApprovals + alerts.deadLetterJobs + alerts.stuckPlaybooks;
        if (total > 10 || alerts.deadLetterJobs > 0) return 'critical';
        if (total > 3) return 'warning';
        return 'healthy';
    };

    const alertLevelColors = {
        critical: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-400' },
        warning: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800', text: 'text-yellow-700 dark:text-yellow-400' },
        healthy: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-400' }
    };

    const formatTimeSince = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffHours = Math.round((now.getTime() - date.getTime()) / (1000 * 60 * 60));

        if (diffHours < 24) return `${diffHours}h ago`;
        const days = Math.floor(diffHours / 24);
        return `${days}d ago`;
    };

    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'SUPERADMIN')) {
        return (
            <div className="p-6 max-w-7xl mx-auto">
                <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl text-center">
                    <ExclamationTriangleIcon className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
                    <h2 className="text-lg font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
                        Admin Access Required
                    </h2>
                    <p className="text-yellow-700 dark:text-yellow-400">
                        This dashboard is only available to administrators.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <ChartBarIcon className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Operations Dashboard
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Monitor approvals, jobs, and system health
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {lastUpdated && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            Updated {lastUpdated.toLocaleTimeString()}
                        </span>
                    )}
                    <button
                        onClick={fetchDashboard}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                        <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="p-4 mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
                    {error}
                </div>
            )}

            {/* Loading State */}
            {loading && !data && (
                <div className="flex items-center justify-center py-12">
                    <ArrowPathIcon className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
            )}

            {data && (
                <>
                    {/* Alert Summary Banner */}
                    {(() => {
                        const level = getAlertLevel(data.alerts);
                        const colors = alertLevelColors[level];
                        const total = data.alerts.overdueApprovals + data.alerts.deadLetterJobs + data.alerts.stuckPlaybooks;

                        return (
                            <div className={`p-4 mb-6 rounded-xl border ${colors.bg} ${colors.border}`}>
                                <div className="flex items-center gap-3">
                                    {level === 'healthy' ? (
                                        <CheckCircleIcon className={`w-6 h-6 ${colors.text}`} />
                                    ) : (
                                        <ExclamationTriangleIcon className={`w-6 h-6 ${colors.text}`} />
                                    )}
                                    <span className={`font-medium ${colors.text}`}>
                                        {level === 'healthy'
                                            ? 'All systems healthy - No alerts'
                                            : `${total} active alert${total !== 1 ? 's' : ''} requiring attention`
                                        }
                                    </span>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Alert Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        {/* Overdue Approvals */}
                        <div className={`p-4 rounded-xl border ${data.alerts.overdueApprovals > 0
                                ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                            }`}>
                            <div className="flex items-center gap-3 mb-2">
                                <ClockIcon className={`w-5 h-5 ${data.alerts.overdueApprovals > 0
                                        ? 'text-yellow-600 dark:text-yellow-400'
                                        : 'text-gray-400'
                                    }`} />
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                    Overdue Approvals
                                </span>
                            </div>
                            <div className={`text-3xl font-bold ${data.alerts.overdueApprovals > 0
                                    ? 'text-yellow-700 dark:text-yellow-400'
                                    : 'text-gray-900 dark:text-white'
                                }`}>
                                {data.alerts.overdueApprovals}
                            </div>
                        </div>

                        {/* Dead Letter Jobs */}
                        <div className={`p-4 rounded-xl border ${data.alerts.deadLetterJobs > 0
                                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                            }`}>
                            <div className="flex items-center gap-3 mb-2">
                                <XCircleIcon className={`w-5 h-5 ${data.alerts.deadLetterJobs > 0
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-gray-400'
                                    }`} />
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                    Dead Letter Jobs
                                </span>
                            </div>
                            <div className={`text-3xl font-bold ${data.alerts.deadLetterJobs > 0
                                    ? 'text-red-700 dark:text-red-400'
                                    : 'text-gray-900 dark:text-white'
                                }`}>
                                {data.alerts.deadLetterJobs}
                            </div>
                        </div>

                        {/* Stuck Playbooks */}
                        <div className={`p-4 rounded-xl border ${data.alerts.stuckPlaybooks > 0
                                ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                            }`}>
                            <div className="flex items-center gap-3 mb-2">
                                <ExclamationTriangleIcon className={`w-5 h-5 ${data.alerts.stuckPlaybooks > 0
                                        ? 'text-orange-600 dark:text-orange-400'
                                        : 'text-gray-400'
                                    }`} />
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                                    Stuck Playbooks
                                </span>
                            </div>
                            <div className={`text-3xl font-bold ${data.alerts.stuckPlaybooks > 0
                                    ? 'text-orange-700 dark:text-orange-400'
                                    : 'text-gray-900 dark:text-white'
                                }`}>
                                {data.alerts.stuckPlaybooks}
                            </div>
                        </div>
                    </div>

                    {/* SLA Health */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            SLA Health
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                            {Object.entries(data.details.slaHealth).map(([key, value]) => (
                                <div key={key} className="text-center">
                                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                        {value}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                        {key}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Notification Outbox */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
                        <div className="flex items-center gap-2 mb-4">
                            <BellAlertIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Notification Outbox (7 days)
                            </h2>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {data.details.outboxStats.total}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                    {data.details.outboxStats.queued}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Queued</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                    {data.details.outboxStats.sent}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Sent</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                                    {data.details.outboxStats.failed}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Failed</div>
                            </div>
                        </div>
                    </div>

                    {/* Stuck Playbooks List */}
                    {data.details.stuckPlaybooks.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Stuck Playbooks
                            </h2>
                            <div className="space-y-3">
                                {data.details.stuckPlaybooks.map((playbook) => (
                                    <div
                                        key={playbook.id}
                                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                                    >
                                        <div>
                                            <div className="font-medium text-gray-900 dark:text-white">
                                                {playbook.templateTitle || playbook.id.slice(0, 12)}
                                            </div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                                Status: {playbook.status}
                                            </div>
                                        </div>
                                        <div className="text-sm text-orange-600 dark:text-orange-400">
                                            Stuck {formatTimeSince(playbook.stuckSince)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default OperationsDashboardView;
