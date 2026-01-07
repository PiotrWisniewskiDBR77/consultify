import React, { useEffect, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/BaseCard';
import { Api } from '../../../services/api';

interface SubscriptionChange {
    id: string;
    organization_id: string;
    organization_name?: string;
    from_plan_id: string;
    from_plan_name?: string;
    to_plan_id: string;
    to_plan_name?: string;
    change_type: 'upgrade' | 'downgrade' | 'cancel' | 'reactivate';
    effective_date: string;
    proration_amount: number;
    status: 'pending' | 'approved' | 'rejected' | 'completed';
    approved_by: string;
    approved_at: string;
    created_at: string;
    updated_at: string;
}

interface SubscriptionChangeStats {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    upgrades: number;
    downgrades: number;
    cancellations: number;
    totalProration: number;
}

export const SubscriptionChangesView: React.FC = () => {
    const [changes, setChanges] = useState<SubscriptionChange[]>([]);
    const [stats, setStats] = useState<SubscriptionChangeStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');

    useEffect(() => {
        fetchData();
    }, [statusFilter, typeFilter]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const filters: any = {};
            if (statusFilter !== 'all') filters.status = statusFilter;
            if (typeFilter !== 'all') filters.change_type = typeFilter;

            const [changesRes, statsRes] = await Promise.all([
                Api.getSubscriptionChanges(filters),
                Api.getSubscriptionChangeStats(),
            ]);

            setChanges(changesRes || []);
            setStats(statsRes as any);
        } catch (err: any) {
            setError(err.message || 'Failed to load subscription changes');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id: string) => {
        try {
            await Api.approveSubscriptionChange(id);
            fetchData();
        } catch (err: any) {
            setError(err.message || 'Failed to approve change');
        }
    };

    const handleReject = async (id: string, reason: string = 'Rejected by admin') => {
        try {
            await Api.rejectSubscriptionChange(id, reason);
            fetchData();
        } catch (err: any) {
            setError(err.message || 'Failed to reject change');
        }
    };

    const getChangeTypeBadge = (type: string) => {
        const badges: Record<string, { bg: string; text: string }> = {
            upgrade: { bg: 'bg-green-500/20', text: 'text-green-400' },
            downgrade: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
            cancel: { bg: 'bg-red-500/20', text: 'text-red-400' },
            reactivate: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
        };
        const badge = badges[type] || { bg: 'bg-gray-500/20', text: 'text-gray-400' };
        return (
            <span className={`px-2 py-0.5 text-xs rounded-full ${badge.bg} ${badge.text}`}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
            </span>
        );
    };

    const getStatusBadge = (status: string) => {
        const badges: Record<string, { bg: string; text: string }> = {
            pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
            approved: { bg: 'bg-green-500/20', text: 'text-green-400' },
            rejected: { bg: 'bg-red-500/20', text: 'text-red-400' },
            completed: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
        };
        const badge = badges[status] || { bg: 'bg-gray-500/20', text: 'text-gray-400' };
        return (
            <span className={`px-2 py-0.5 text-xs rounded-full ${badge.bg} ${badge.text}`}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        );
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Subscription Changes</h2>
                    <p className="text-gray-400 mt-1">Manage subscription upgrades, downgrades, and cancellations</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg">
                    {error}
                    <button onClick={() => setError(null)} className="float-right text-red-300 hover:text-red-100">
                        ×
                    </button>
                </div>
            )}

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    <Card className="bg-gray-800 border-gray-700">
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold text-white">{stats.total}</div>
                            <div className="text-sm text-gray-400">Total Changes</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gray-800 border-gray-700">
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
                            <div className="text-sm text-gray-400">Pending</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gray-800 border-gray-700">
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold text-green-400">{stats.upgrades}</div>
                            <div className="text-sm text-gray-400">Upgrades</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gray-800 border-gray-700">
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold text-orange-400">{stats.downgrades}</div>
                            <div className="text-sm text-gray-400">Downgrades</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gray-800 border-gray-700">
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold text-red-400">{stats.cancellations}</div>
                            <div className="text-sm text-gray-400">Cancellations</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gray-800 border-gray-700">
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold text-green-400">{stats.approved}</div>
                            <div className="text-sm text-gray-400">Approved</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gray-800 border-gray-700">
                        <CardContent className="pt-4">
                            <div className="text-lg font-bold text-indigo-400">
                                {formatCurrency(stats.totalProration || 0)}
                            </div>
                            <div className="text-sm text-gray-400">Total Proration</div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Filters */}
            <Card className="bg-gray-800 border-gray-700">
                <CardContent className="pt-4">
                    <div className="flex flex-wrap gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                            >
                                <option value="all">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                                <option value="completed">Completed</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Type</label>
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                            >
                                <option value="all">All Types</option>
                                <option value="upgrade">Upgrade</option>
                                <option value="downgrade">Downgrade</option>
                                <option value="cancel">Cancel</option>
                                <option value="reactivate">Reactivate</option>
                            </select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Changes List */}
            <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                    <CardTitle className="text-white">Recent Subscription Changes</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {changes.map((change) => (
                            <div key={change.id} className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <span className="text-white font-medium">
                                                {change.organization_name || change.organization_id}
                                            </span>
                                            {getChangeTypeBadge(change.change_type)}
                                            {getStatusBadge(change.status)}
                                        </div>
                                        <div className="mt-2 text-sm text-gray-400">
                                            <span className="text-gray-500">
                                                {change.from_plan_name || change.from_plan_id || 'No plan'}
                                            </span>
                                            <span className="mx-2">→</span>
                                            <span className="text-white">
                                                {change.to_plan_name || change.to_plan_id}
                                            </span>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
                                            <span>
                                                Effective: {new Date(change.effective_date).toLocaleDateString()}
                                            </span>
                                            {change.proration_amount !== 0 && (
                                                <span
                                                    className={
                                                        change.proration_amount > 0 ? 'text-green-400' : 'text-red-400'
                                                    }
                                                >
                                                    Proration: {formatCurrency(change.proration_amount)}
                                                </span>
                                            )}
                                            <span>Requested: {new Date(change.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    {change.status === 'pending' && (
                                        <div className="flex gap-2 ml-4">
                                            <button
                                                onClick={() => handleApprove(change.id)}
                                                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleReject(change.id)}
                                                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {changes.length === 0 && (
                        <div className="text-center py-8 text-gray-400">No subscription changes found</div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default SubscriptionChangesView;

