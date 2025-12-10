import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Users, BarChart3, PieChart, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Api } from '../../services/api';

interface RevenueStats {
    mrr: number;
    arr: number;
    activeSubscriptions: number;
    planDistribution: {
        name: string;
        price_monthly: number;
        count: number;
    }[];
}

interface UsageStats {
    totalTokensThisMonth: number;
    totalStorageGB: number;
    activeOrganizations: number;
    periodStart: string;
}

export const SuperAdminRevenueView: React.FC = () => {
    const [revenueStats, setRevenueStats] = useState<RevenueStats | null>(null);
    const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [revenue, usage] = await Promise.all([
                Api.get('/billing/admin/revenue'),
                Api.get('/billing/admin/usage')
            ]);
            setRevenueStats(revenue);
            setUsageStats(usage);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    const totalPlanSubscriptions = revenueStats?.planDistribution.reduce((sum, p) => sum + p.count, 0) || 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-emerald-600" />
                    Revenue Dashboard
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Financial metrics and usage analytics
                </p>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* MRR Card */}
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <DollarSign className="w-8 h-8 opacity-80" />
                        <span className="flex items-center gap-1 text-sm text-emerald-100">
                            <ArrowUpRight className="w-4 h-4" />
                            MRR
                        </span>
                    </div>
                    <p className="text-3xl font-bold mt-4">
                        {formatCurrency(revenueStats?.mrr || 0)}
                    </p>
                    <p className="text-emerald-100 text-sm mt-1">Monthly Recurring Revenue</p>
                </div>

                {/* ARR Card */}
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <BarChart3 className="w-8 h-8 opacity-80" />
                        <span className="flex items-center gap-1 text-sm text-blue-100">
                            <ArrowUpRight className="w-4 h-4" />
                            ARR
                        </span>
                    </div>
                    <p className="text-3xl font-bold mt-4">
                        {formatCurrency(revenueStats?.arr || 0)}
                    </p>
                    <p className="text-blue-100 text-sm mt-1">Annual Recurring Revenue</p>
                </div>

                {/* Active Subscriptions */}
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <Users className="w-8 h-8 opacity-80" />
                        <span className="text-sm text-purple-100">Active</span>
                    </div>
                    <p className="text-3xl font-bold mt-4">
                        {revenueStats?.activeSubscriptions || 0}
                    </p>
                    <p className="text-purple-100 text-sm mt-1">Active Subscriptions</p>
                </div>

                {/* Token Usage */}
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                        <Activity className="w-8 h-8 opacity-80" />
                        <span className="text-sm text-orange-100">This Month</span>
                    </div>
                    <p className="text-3xl font-bold mt-4">
                        {formatNumber(usageStats?.totalTokensThisMonth || 0)}
                    </p>
                    <p className="text-orange-100 text-sm mt-1">Tokens Consumed</p>
                </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Plan Distribution */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
                        <PieChart className="w-5 h-5 text-indigo-600" />
                        Plan Distribution
                    </h3>

                    <div className="space-y-4">
                        {revenueStats?.planDistribution.map((plan, idx) => {
                            const percentage = totalPlanSubscriptions > 0
                                ? Math.round((plan.count / totalPlanSubscriptions) * 100)
                                : 0;
                            const colors = [
                                'bg-indigo-500',
                                'bg-emerald-500',
                                'bg-orange-500',
                                'bg-pink-500',
                                'bg-cyan-500'
                            ];

                            return (
                                <div key={plan.name} className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-700 dark:text-gray-300">
                                            {plan.name}
                                        </span>
                                        <span className="text-gray-500 dark:text-gray-400">
                                            {plan.count} ({percentage}%)
                                        </span>
                                    </div>
                                    <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${colors[idx % colors.length]} transition-all duration-500`}
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}

                        {(!revenueStats?.planDistribution || revenueStats.planDistribution.length === 0) && (
                            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                                No subscriptions yet
                            </p>
                        )}
                    </div>
                </div>

                {/* Usage Overview */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
                        <Activity className="w-5 h-5 text-indigo-600" />
                        Usage Overview
                    </h3>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total Tokens</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                {formatNumber(usageStats?.totalTokensThisMonth || 0)}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">This month</p>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Storage Used</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                {(usageStats?.totalStorageGB || 0).toFixed(2)} GB
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Across all orgs</p>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Active Orgs</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                {usageStats?.activeOrganizations || 0}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">With usage</p>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Avg/Org</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                {usageStats?.activeOrganizations
                                    ? formatNumber(Math.round((usageStats?.totalTokensThisMonth || 0) / usageStats.activeOrganizations))
                                    : '0'
                                }
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Tokens/org</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Revenue Breakdown Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
                    <DollarSign className="w-5 h-5 text-indigo-600" />
                    Revenue by Plan
                </h3>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                <th className="pb-3 font-medium">Plan</th>
                                <th className="pb-3 font-medium">Price</th>
                                <th className="pb-3 font-medium">Subscribers</th>
                                <th className="pb-3 font-medium text-right">Monthly Revenue</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {revenueStats?.planDistribution.map(plan => (
                                <tr key={plan.name} className="text-gray-900 dark:text-white">
                                    <td className="py-3 font-medium">{plan.name}</td>
                                    <td className="py-3">{formatCurrency(plan.price_monthly)}/mo</td>
                                    <td className="py-3">{plan.count}</td>
                                    <td className="py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                                        {formatCurrency(plan.price_monthly * plan.count)}
                                    </td>
                                </tr>
                            ))}
                            {(!revenueStats?.planDistribution || revenueStats.planDistribution.length === 0) && (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-gray-500 dark:text-gray-400">
                                        No revenue data available
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        {revenueStats?.planDistribution && revenueStats.planDistribution.length > 0 && (
                            <tfoot>
                                <tr className="border-t-2 border-gray-200 dark:border-gray-600">
                                    <td colSpan={3} className="py-3 font-bold text-gray-900 dark:text-white">
                                        Total
                                    </td>
                                    <td className="py-3 text-right font-bold text-xl text-emerald-600 dark:text-emerald-400">
                                        {formatCurrency(revenueStats.mrr)}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SuperAdminRevenueView;
