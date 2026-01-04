/**
 * AI Cost Dashboard Component
 *
 * Admin dashboard for monitoring AI usage, costs, and performance.
 */

import {
    Activity,
    AlertTriangle,
    BarChart3,
    Clock,
    DollarSign,
    PieChart,
    RefreshCw,
    TrendingUp,
    Users,
    Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import api from '../../services/api';

interface CostData {
    period: string;
    totals: {
        total_tokens: number;
        total_cost: number;
        total_requests: number;
        avg_latency: number;
        successRate: string;
    };
    budget: {
        monthly: number;
        used: number;
        remaining: number;
        utilization: string;
    } | null;
    data: any[];
}

interface UsageData {
    userUsage: any[];
    dailyTrends: any[];
    capabilityDistribution: any[];
}

interface QuotaData {
    userQuota: {
        dailyLimit: number;
        dailyUsed: number;
        dailyRemaining: number;
        monthlyLimit: number;
        monthlyUsed: number;
        monthlyRemaining: number;
    } | null;
    organizationQuota: {
        dailyLimit: number;
        dailyUsed: number;
        dailyRemaining: number;
        monthlyLimit: number;
        monthlyUsed: number;
        monthlyRemaining: number;
    } | null;
}

export function AICostDashboard() {
    const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
    const [costData, setCostData] = useState<CostData | null>(null);
    const [usageData, setUsageData] = useState<UsageData | null>(null);
    const [quotaData, setQuotaData] = useState<QuotaData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);

        try {
            const [costsRes, usageRes, quotasRes] = await Promise.all([
                api.get(`/ai-analytics/costs?period=${period}&groupBy=capability`),
                api.get(`/ai-analytics/usage?period=${period}`),
                api.get('/ai-analytics/quotas'),
            ]);

            if (costsRes.data.success) setCostData(costsRes.data);
            if (usageRes.data.success) setUsageData(usageRes.data);
            if (quotasRes.data.success) setQuotaData(quotasRes.data);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [period]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
        }).format(amount || 0);
    };

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat().format(num || 0);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg">
                <AlertTriangle className="w-5 h-5 inline mr-2" />
                {error}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">AI Cost Dashboard</h2>
                    <p className="text-sm text-gray-500">Monitor AI usage, costs, and performance</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value as any)}
                        className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800"
                    >
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                        <option value="90d">Last 90 days</option>
                    </select>
                    <button onClick={fetchData} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Cost */}
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-100 text-sm">Total Cost</p>
                            <p className="text-3xl font-bold mt-1">
                                {formatCurrency(costData?.totals?.total_cost || 0)}
                            </p>
                        </div>
                        <DollarSign className="w-10 h-10 text-blue-200" />
                    </div>
                    {costData?.budget && (
                        <div className="mt-4">
                            <div className="flex justify-between text-sm text-blue-100 mb-1">
                                <span>Budget utilization</span>
                                <span>{costData.budget.utilization}%</span>
                            </div>
                            <div className="w-full h-2 bg-blue-400 rounded-full">
                                <div
                                    className="h-full bg-white rounded-full"
                                    style={{ width: `${Math.min(parseFloat(costData.budget.utilization), 100)}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Total Tokens */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm">Total Tokens</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                {formatNumber(costData?.totals?.total_tokens || 0)}
                            </p>
                        </div>
                        <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                            <Zap className="w-6 h-6 text-purple-600" />
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-3">
                        {formatNumber(costData?.totals?.total_requests || 0)} requests
                    </p>
                </div>

                {/* Avg Latency */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm">Avg Latency</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                {Math.round(costData?.totals?.avg_latency || 0)}ms
                            </p>
                        </div>
                        <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                            <Clock className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-3">{costData?.totals?.successRate}% success rate</p>
                </div>

                {/* Active Users */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm">Active Users</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                {usageData?.userUsage?.length || 0}
                            </p>
                        </div>
                        <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                            <Users className="w-6 h-6 text-orange-600" />
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-3">using AI features</p>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Usage by Capability */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border">
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                        <PieChart className="w-5 h-5 text-blue-500" />
                        Usage by Capability
                    </h3>
                    <div className="space-y-3">
                        {usageData?.capabilityDistribution?.slice(0, 6).map((cap: any) => (
                            <div key={cap.capability} className="flex items-center gap-3">
                                <div className="w-24 text-sm text-gray-600 dark:text-gray-400 truncate">
                                    {cap.capability || 'other'}
                                </div>
                                <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                                        style={{
                                            width: `${(cap.count / (usageData?.capabilityDistribution?.[0]?.count || 1)) * 100}%`,
                                        }}
                                    />
                                </div>
                                <div className="w-16 text-right text-sm font-medium">{formatNumber(cap.count)}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Users */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border">
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                        <Users className="w-5 h-5 text-orange-500" />
                        Top Users by Usage
                    </h3>
                    <div className="space-y-3">
                        {usageData?.userUsage?.slice(0, 6).map((user: any, i: number) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                    {(user.user_name || user.email || '?')[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                        {user.user_name || user.email || 'Unknown'}
                                    </p>
                                    <p className="text-xs text-gray-500">{formatNumber(user.request_count)} requests</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-medium">{formatCurrency(user.total_cost)}</p>
                                    <p className="text-xs text-gray-500">{formatNumber(user.total_tokens)} tokens</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Quota Status */}
            {quotaData && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border">
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                        <Activity className="w-5 h-5 text-green-500" />
                        Quota Status
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* User Quota */}
                        {quotaData.userQuota && (
                            <div>
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Your Quota</p>
                                <div className="space-y-2">
                                    <div>
                                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                                            <span>
                                                Daily ({formatNumber(quotaData.userQuota.dailyUsed)} /{' '}
                                                {formatNumber(quotaData.userQuota.dailyLimit)})
                                            </span>
                                            <span>
                                                {Math.round(
                                                    (quotaData.userQuota.dailyUsed / quotaData.userQuota.dailyLimit) *
                                                        100,
                                                )}
                                                %
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                                            <div
                                                className="h-full bg-blue-500 rounded-full transition-all"
                                                style={{
                                                    width: `${Math.min((quotaData.userQuota.dailyUsed / quotaData.userQuota.dailyLimit) * 100, 100)}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                                            <span>
                                                Monthly ({formatNumber(quotaData.userQuota.monthlyUsed)} /{' '}
                                                {formatNumber(quotaData.userQuota.monthlyLimit)})
                                            </span>
                                            <span>
                                                {Math.round(
                                                    (quotaData.userQuota.monthlyUsed /
                                                        quotaData.userQuota.monthlyLimit) *
                                                        100,
                                                )}
                                                %
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                                            <div
                                                className="h-full bg-purple-500 rounded-full transition-all"
                                                style={{
                                                    width: `${Math.min((quotaData.userQuota.monthlyUsed / quotaData.userQuota.monthlyLimit) * 100, 100)}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Organization Quota */}
                        {quotaData.organizationQuota && (
                            <div>
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Organization Quota
                                </p>
                                <div className="space-y-2">
                                    <div>
                                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                                            <span>
                                                Daily ({formatNumber(quotaData.organizationQuota.dailyUsed)} /{' '}
                                                {formatNumber(quotaData.organizationQuota.dailyLimit)})
                                            </span>
                                            <span>
                                                {Math.round(
                                                    (quotaData.organizationQuota.dailyUsed /
                                                        quotaData.organizationQuota.dailyLimit) *
                                                        100,
                                                )}
                                                %
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                                            <div
                                                className="h-full bg-green-500 rounded-full transition-all"
                                                style={{
                                                    width: `${Math.min((quotaData.organizationQuota.dailyUsed / quotaData.organizationQuota.dailyLimit) * 100, 100)}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                                            <span>
                                                Monthly ({formatNumber(quotaData.organizationQuota.monthlyUsed)} /{' '}
                                                {formatNumber(quotaData.organizationQuota.monthlyLimit)})
                                            </span>
                                            <span>
                                                {Math.round(
                                                    (quotaData.organizationQuota.monthlyUsed /
                                                        quotaData.organizationQuota.monthlyLimit) *
                                                        100,
                                                )}
                                                %
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                                            <div
                                                className="h-full bg-orange-500 rounded-full transition-all"
                                                style={{
                                                    width: `${Math.min((quotaData.organizationQuota.monthlyUsed / quotaData.organizationQuota.monthlyLimit) * 100, 100)}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Budget Alert */}
            {costData?.budget && parseFloat(costData.budget.utilization) > 85 && (
                <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-medium text-amber-800 dark:text-amber-200">Budget Alert</p>
                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                            You've used {costData.budget.utilization}% of your monthly AI budget (
                            {formatCurrency(costData.budget.used)} of {formatCurrency(costData.budget.monthly)}).
                            Consider optimizing usage or upgrading your plan.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AICostDashboard;
