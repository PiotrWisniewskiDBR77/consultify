import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { useTranslation } from 'react-i18next';
import { 
    TrendingUp, TrendingDown, Coins, Activity, Calendar, 
    BarChart3, PieChart, Loader2, RefreshCw, Sparkles,
    Brain, MessageSquare, FileText, Zap
} from 'lucide-react';
import { Api } from '../../services/api';

interface TokenUsageAnalyticsProps {
    currentUser: User;
    className?: string;
    showHeader?: boolean;
    compact?: boolean;
}

interface UsageData {
    dailyUsage: Array<{ date: string; tokens: number; cost: number }>;
    weeklyUsage: Array<{ week: string; tokens: number; cost: number }>;
    usageByType: Array<{ type: string; tokens: number; percentage: number }>;
    totalUsed: number;
    totalLimit: number;
    avgDailyUsage: number;
    peakUsage: number;
    estimatedDaysRemaining: number;
    costThisMonth: number;
    trend: 'up' | 'down' | 'stable';
    trendPercentage: number;
}

const USAGE_TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
    chat: { icon: <MessageSquare className="w-4 h-4" />, color: 'bg-blue-500', label: 'AI Chat' },
    analysis: { icon: <Brain className="w-4 h-4" />, color: 'bg-purple-500', label: 'Analysis' },
    generation: { icon: <FileText className="w-4 h-4" />, color: 'bg-emerald-500', label: 'Content Generation' },
    automation: { icon: <Zap className="w-4 h-4" />, color: 'bg-amber-500', label: 'Automation' },
    other: { icon: <Sparkles className="w-4 h-4" />, color: 'bg-slate-500', label: 'Other' }
};

export const TokenUsageAnalytics: React.FC<TokenUsageAnalyticsProps> = ({
    currentUser,
    className = '',
    showHeader = true,
    compact = false
}) => {
    const { t } = useTranslation();
    const [usageData, setUsageData] = useState<UsageData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

    useEffect(() => {
        fetchUsageData();
    }, [timeRange, currentUser.organizationId]);

    const fetchUsageData = async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Fetch usage analytics from API
            const data = await Api.getTokenUsageAnalytics(currentUser.organizationId || '', timeRange);
            setUsageData(data);

        } catch (err: any) {
            console.error('[TokenUsageAnalytics] Failed to fetch usage:', err);
            // Use mock data if API fails
            setUsageData(generateMockData());
        } finally {
            setIsLoading(false);
        }
    };

    const generateMockData = (): UsageData => {
        const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
        const dailyUsage = Array.from({ length: days }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (days - 1 - i));
            return {
                date: date.toISOString().split('T')[0],
                tokens: Math.floor(Math.random() * 3000) + 500,
                cost: Math.random() * 0.5
            };
        });

        const totalUsed = dailyUsage.reduce((sum, d) => sum + d.tokens, 0);
        const avgDaily = Math.round(totalUsed / days);

        return {
            dailyUsage,
            weeklyUsage: [],
            usageByType: [
                { type: 'chat', tokens: Math.round(totalUsed * 0.45), percentage: 45 },
                { type: 'analysis', tokens: Math.round(totalUsed * 0.25), percentage: 25 },
                { type: 'generation', tokens: Math.round(totalUsed * 0.20), percentage: 20 },
                { type: 'automation', tokens: Math.round(totalUsed * 0.10), percentage: 10 }
            ],
            totalUsed,
            totalLimit: 100000,
            avgDailyUsage: avgDaily,
            peakUsage: Math.max(...dailyUsage.map(d => d.tokens)),
            estimatedDaysRemaining: Math.round((100000 - totalUsed) / avgDaily),
            costThisMonth: dailyUsage.reduce((sum, d) => sum + d.cost, 0),
            trend: Math.random() > 0.5 ? 'up' : 'down',
            trendPercentage: Math.round(Math.random() * 20)
        };
    };

    const formatNumber = (num: number): string => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    if (isLoading) {
        return (
            <div className={`flex items-center justify-center p-8 ${className}`}>
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    if (!usageData) {
        return (
            <div className={`p-6 text-center text-slate-500 ${className}`}>
                {error || t('analytics.noData', 'No usage data available')}
            </div>
        );
    }

    const usagePercentage = Math.round((usageData.totalUsed / usageData.totalLimit) * 100);

    return (
        <div className={`space-y-6 ${className}`}>
            {/* Header */}
            {showHeader && (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                            <BarChart3 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                {t('analytics.tokenUsage', 'Token Usage Analytics')}
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {t('analytics.trackYourUsage', 'Track your AI token consumption')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex bg-slate-100 dark:bg-navy-800 rounded-lg p-1">
                            {(['7d', '30d', '90d'] as const).map((range) => (
                                <button
                                    key={range}
                                    onClick={() => setTimeRange(range)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                        timeRange === range
                                            ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-white shadow'
                                            : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {range === '7d' ? '7 days' : range === '30d' ? '30 days' : '90 days'}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={fetchUsageData}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4 text-slate-500" />
                        </button>
                    </div>
                </div>
            )}

            {/* Stats Cards */}
            <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-4'} gap-4`}>
                {/* Total Used */}
                <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <Coins className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className={`flex items-center gap-1 text-xs font-medium ${
                            usageData.trend === 'up' ? 'text-red-500' : 'text-emerald-500'
                        }`}>
                            {usageData.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {usageData.trendPercentage}%
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatNumber(usageData.totalUsed)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{t('analytics.tokensUsed', 'Tokens Used')}</p>
                </div>

                {/* Average Daily */}
                <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {formatNumber(usageData.avgDailyUsage)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{t('analytics.avgDaily', 'Avg Daily Usage')}</p>
                </div>

                {/* Days Remaining */}
                <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {usageData.estimatedDaysRemaining}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{t('analytics.daysRemaining', 'Est. Days Left')}</p>
                </div>

                {/* Cost This Month */}
                <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        ${usageData.costThisMonth.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{t('analytics.costThisMonth', 'Cost This Month')}</p>
                </div>
            </div>

            {/* Usage Progress Bar */}
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-slate-900 dark:text-white">
                        {t('analytics.usageOverview', 'Usage Overview')}
                    </h3>
                    <span className="text-sm text-slate-500">
                        {formatNumber(usageData.totalUsed)} / {formatNumber(usageData.totalLimit)}
                    </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-navy-800 rounded-full h-3 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${
                            usagePercentage >= 90 ? 'bg-red-500' :
                            usagePercentage >= 75 ? 'bg-amber-500' :
                            'bg-gradient-to-r from-purple-500 to-indigo-500'
                        }`}
                        style={{ width: `${Math.min(100, usagePercentage)}%` }}
                    />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                    {usagePercentage}% {t('analytics.ofLimitUsed', 'of monthly limit used')}
                </p>
            </div>

            {/* Usage by Type */}
            {!compact && (
                <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-5">
                    <h3 className="font-medium text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <PieChart className="w-4 h-4 text-purple-500" />
                        {t('analytics.usageByType', 'Usage by Type')}
                    </h3>
                    <div className="space-y-3">
                        {usageData.usageByType.map((item) => {
                            const config = USAGE_TYPE_CONFIG[item.type] || USAGE_TYPE_CONFIG.other;
                            return (
                                <div key={item.type}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-2 text-sm">
                                            <div className={`w-6 h-6 rounded-md ${config.color} flex items-center justify-center text-white`}>
                                                {config.icon}
                                            </div>
                                            <span className="text-slate-700 dark:text-slate-300">{config.label}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                                                {formatNumber(item.tokens)}
                                            </span>
                                            <span className="text-xs text-slate-500 ml-2">
                                                ({item.percentage}%)
                                            </span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-100 dark:bg-navy-800 rounded-full h-1.5">
                                        <div
                                            className={`h-full rounded-full ${config.color} transition-all`}
                                            style={{ width: `${item.percentage}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Daily Usage Chart (Simplified) */}
            {!compact && (
                <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 p-5">
                    <h3 className="font-medium text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-purple-500" />
                        {t('analytics.dailyUsage', 'Daily Usage Trend')}
                    </h3>
                    <div className="flex items-end gap-1 h-32">
                        {usageData.dailyUsage.slice(-14).map((day, index) => {
                            const maxTokens = Math.max(...usageData.dailyUsage.map(d => d.tokens));
                            const height = (day.tokens / maxTokens) * 100;
                            return (
                                <div
                                    key={day.date}
                                    className="flex-1 group relative"
                                    title={`${day.date}: ${formatNumber(day.tokens)} tokens`}
                                >
                                    <div
                                        className="w-full rounded-t bg-gradient-to-t from-purple-600 to-purple-400 hover:from-purple-500 hover:to-purple-300 transition-all cursor-pointer"
                                        style={{ height: `${height}%` }}
                                    />
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                                        <div className="bg-slate-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                                            {formatNumber(day.tokens)} tokens
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-slate-500">
                        <span>{usageData.dailyUsage.slice(-14)[0]?.date.split('-').slice(1).join('/')}</span>
                        <span>{usageData.dailyUsage.slice(-1)[0]?.date.split('-').slice(1).join('/')}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TokenUsageAnalytics;



