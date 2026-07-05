/**
 * AIUsageDashboard - AI Usage monitoring dashboard
 *
 * Features:
 * - Usage breakdown by feature (Chat, Summaries, Search, etc.)
 * - Current period stats
 * - Historical trend chart
 * - Token/cost estimation
 * - Usage limit indicators
 *
 * Inspired by ClickUp's AI usage dashboard.
 */

import {
  AlertCircle,
  Brain,
  Clock,
  DollarSign,
  FileText,
  MessageSquare,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DegradedState } from '../../components/Admin/AdminState';
import { cn } from '../../lib/utils';
import { Api } from '../../services/api';
import { User } from '../../types';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Select } from '../ui/select';
import { Skeleton } from '../ui/skeleton';

interface AIUsageDashboardProps {
  currentUser: User;
}

interface UsageStat {
  feature: string;
  icon: React.ElementType;
  count: number;
  tokens: number;
  cost: number;
}

interface PeriodStats {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  // The backend does not currently track these — null means "hide", never fake.
  avgResponseTime: number | null;
  successRate: number | null;
  limit: number | null;
  used: number;
}

interface DailyUsage {
  date: string;
  tokens: number;
  requests: number;
}

export const AIUsageDashboard: React.FC<AIUsageDashboardProps> = ({ currentUser }) => {
  const { t } = useTranslation();
  void currentUser;
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [periodStats, setPeriodStats] = useState<PeriodStats | null>(null);
  const [usageByFeature, setUsageByFeature] = useState<UsageStat[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);

  const toFiniteNumber = (value: unknown, fallback = 0) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;

  // Returns the numeric value only when the backend genuinely provided one,
  // otherwise null so the metric is hidden rather than shown as a fake 0/100.
  const toNullableNumber = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;

  const normalizeFeatureKey = (feature: unknown) =>
    String(feature || 'general')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'general';

  const formatFeatureFallback = (feature: string) =>
    feature
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  // Fetch usage data from backend API
  useEffect(() => {
    const fetchUsage = async () => {
      setLoading(true);
      try {
        setLoadError(null);
        const response = await Api.getAIUsageStats(period);

        if (!response?.stats) {
          throw new Error('AI usage stats response is missing usage totals');
        }

        const successRateRaw = toNullableNumber(response.stats.successRate);
        setPeriodStats({
          totalRequests: toFiniteNumber(response.stats.totalRequests),
          totalTokens: toFiniteNumber(response.stats.totalTokens),
          totalCost: toFiniteNumber(response.stats.totalCost),
          avgResponseTime: toNullableNumber(response.stats.avgResponseTime),
          successRate: successRateRaw === null ? null : Math.min(Math.max(successRateRaw, 0), 100),
          limit: toNullableNumber(response.stats.limit),
          used: toFiniteNumber(response.stats.used),
        });

        // Map usage by feature from API response
        if (response?.usageByFeature && response.usageByFeature.length > 0) {
          const iconMap: Record<string, React.ElementType> = {
            chat: MessageSquare,
            document: FileText,
            search: Search,
            autocomplete: Zap,
            summary: Brain,
            general: Sparkles,
          };

          setUsageByFeature(
            response.usageByFeature.map((item: Record<string, unknown>) => {
              const feature = normalizeFeatureKey(item.feature);
              return {
                feature,
                icon: iconMap[feature] || Sparkles,
                count: toFiniteNumber(item.count),
                tokens: toFiniteNumber(item.tokens),
                cost: toFiniteNumber(item.cost),
              };
            })
          );
        } else {
          setUsageByFeature([]);
        }

        // Set daily usage from API
        if (response?.dailyUsage && response.dailyUsage.length > 0) {
          setDailyUsage(
            response.dailyUsage.map((item: Record<string, unknown>) => ({
              date: String(item.date || ''),
              tokens: toFiniteNumber(item.tokens),
              requests: toFiniteNumber(item.requests),
            }))
          );
        } else {
          setDailyUsage([]);
        }
      } catch (error: unknown) {
        setLoadError(normalizeApiErrorMessage(error, 'Failed to load AI usage statistics'));
        setPeriodStats(null);
        setUsageByFeature([]);
        setDailyUsage([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, [period]);

  // Format numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Calculate usage percentage (only when a real limit is provided by the backend)
  const hasLimit = !!periodStats && periodStats.limit !== null && periodStats.limit > 0;
  const usagePercentage =
    hasLimit && periodStats ? (periodStats.used / (periodStats.limit as number)) * 100 : 0;
  const isNearLimit = hasLimit && usagePercentage >= 80;
  const isOverLimit = hasLimit && usagePercentage >= 100;
  const hasAvgResponseTime = !!periodStats && periodStats.avgResponseTime !== null;
  const hasSuccessRate = !!periodStats && periodStats.successRate !== null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <DegradedState
        title={t('settings.aiUsage.unavailableTitle', 'AI usage unavailable')}
        description={loadError}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-c-text">
            {t('settings.aiUsage.title', 'AI Usage Overview')}
          </h3>
          <p className="text-sm text-c-text-muted">
            {t('settings.aiUsage.subtitle', 'Monitor your AI usage and token consumption')}
          </p>
        </div>
        <Select
          value={period}
          onChange={(v) => setPeriod(v as typeof period)}
          options={[
            { value: '7d', label: t('settings.aiUsage.last7Days', 'Last 7 days') },
            { value: '30d', label: t('settings.aiUsage.last30Days', 'Last 30 days') },
            { value: '90d', label: t('settings.aiUsage.last90Days', 'Last 90 days') },
          ]}
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-c-accent-soft to-c-accent-soft border-c-accent">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-c-accent font-medium">
                  {t('settings.aiUsage.totalRequests', 'Total Requests')}
                </p>
                <p className="text-2xl font-bold text-c-accent mt-1">
                  {formatNumber(periodStats?.totalRequests || 0)}
                </p>
              </div>
              <div className="p-3 bg-c-accent-soft rounded-xl">
                <Sparkles className="w-6 h-6 text-c-accent" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                  {t('settings.aiUsage.tokensUsed', 'Tokens Used')}
                </p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">
                  {formatNumber(periodStats?.totalTokens || 0)}
                </p>
              </div>
              <div className="p-3 bg-emerald-100 dark:bg-emerald-800/50 rounded-xl">
                <Zap className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-50 dark:from-amber-900/20 dark:to-amber-900/20 border-amber-200 dark:border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                  {t('settings.aiUsage.estimatedCost', 'Est. Cost')}
                </p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100 mt-1">
                  {formatCurrency(periodStats?.totalCost || 0)}
                </p>
              </div>
              <div className="p-3 bg-amber-100 dark:bg-amber-800/50 rounded-xl">
                <DollarSign className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {hasAvgResponseTime && (
          <Card className="bg-gradient-to-br from-blue-50 to-blue-50 dark:from-blue-900/20 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                    {t('settings.aiUsage.avgResponseTime', 'Avg Response')}
                  </p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                    {periodStats?.avgResponseTime?.toFixed(1)}s
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-800/50 rounded-xl">
                  <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Usage Limit Progress — only when the backend reports a real limit */}
      {hasLimit && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {t('settings.aiUsage.usageLimit', 'Usage Limit')}
              </CardTitle>
              <span
                className={cn(
                  'text-sm font-medium',
                  isOverLimit
                    ? 'text-danger-600'
                    : isNearLimit
                      ? 'text-amber-600'
                      : 'text-c-text-secondary'
                )}
              >
                {formatNumber(periodStats?.used || 0)} / {formatNumber(periodStats?.limit || 0)}{' '}
                tokens
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <Progress
              value={Math.min(usagePercentage, 100)}
              className={cn(
                'h-3',
                isOverLimit
                  ? '[&>div]:bg-danger-500'
                  : isNearLimit
                    ? '[&>div]:bg-amber-500'
                    : '[&>div]:bg-navy-900'
              )}
            />
            {isNearLimit && !isOverLimit && (
              <div className="flex items-center gap-2 mt-3 text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">
                  {t('settings.aiUsage.nearLimit', 'You are approaching your usage limit')}
                </span>
              </div>
            )}
            {isOverLimit && (
              <div className="flex items-center gap-2 mt-3 text-danger-600 dark:text-danger-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">
                  {t('settings.aiUsage.overLimit', 'You have exceeded your usage limit')}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Usage by Feature */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.aiUsage.byFeature', 'Usage by Feature')}</CardTitle>
          <CardDescription>
            {t('settings.aiUsage.byFeatureDesc', 'Breakdown of AI usage across different features')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {usageByFeature.length === 0 ? (
              <div className="py-8 text-center text-sm text-c-text-muted">
                {t(
                  'settings.aiUsage.noFeatureUsage',
                  'No feature-level AI usage has been reported for this period.'
                )}
              </div>
            ) : (
              usageByFeature.map((stat) => {
                const Icon = stat.icon;
                const percentage =
                  periodStats && periodStats.totalTokens > 0
                    ? (stat.tokens / periodStats.totalTokens) * 100
                    : 0;

                return (
                  <div key={stat.feature} className="flex items-center gap-4">
                    <div className="p-2 bg-c-surface-raised rounded-lg">
                      <Icon className="w-5 h-5 text-c-text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-c-text">
                          {t(
                            `settings.aiUsage.features.${stat.feature}`,
                            formatFeatureFallback(stat.feature)
                          )}
                        </span>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-c-text-muted">
                            {formatNumber(stat.tokens)} tokens
                          </span>
                          <span className="text-c-text-secondary">•</span>
                          <span className="text-c-text-muted">
                            {stat.count} requests
                          </span>
                        </div>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Trend Chart (simplified) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('settings.aiUsage.usageTrend', 'Usage Trend')}</CardTitle>
              <CardDescription>
                {t('settings.aiUsage.usageTrendDesc', 'Daily token usage over time')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Simple bar chart visualization */}
          {dailyUsage.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-c-text-muted">
              {t(
                'settings.aiUsage.noDailyUsage',
                'No daily AI usage has been reported for this period.'
              )}
            </div>
          ) : (
            <div className="h-48 flex items-end gap-1">
              {dailyUsage.slice(-30).map((day) => {
                const maxTokens = Math.max(...dailyUsage.map((d) => d.tokens));
                const height = maxTokens > 0 ? (day.tokens / maxTokens) * 100 : 0;
                return (
                  <div
                    key={day.date}
                    className="flex-1 bg-c-accent-soft rounded-t hover:bg-c-accent-300 transition-colors cursor-pointer group relative"
                    style={{ height: `${height}%` }}
                    title={`${day.date}: ${formatNumber(day.tokens)} tokens`}
                  >
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-c-surface text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity pointer-events-none">
                      {formatNumber(day.tokens)} tokens
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex justify-between mt-2 text-xs text-c-text-secondary">
            <span>{dailyUsage[0]?.date}</span>
            <span>{dailyUsage[dailyUsage.length - 1]?.date}</span>
          </div>
        </CardContent>
      </Card>

      {/* Success Rate & Performance — only metrics genuinely tracked by the backend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {hasSuccessRate && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {t('settings.aiUsage.successRate', 'Success Rate')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-c-text-muted dark:text-navy-700"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${(periodStats?.successRate || 0) * 2.51} 251`}
                      className="text-emerald-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-c-text">
                      {periodStats?.successRate?.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="text-sm text-c-text-muted">
                  <p>
                    {t(
                      'settings.aiUsage.successRateDesc',
                      'Percentage of successful AI requests without errors'
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t('settings.aiUsage.performance', 'Performance Metrics')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {hasAvgResponseTime && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-c-text-muted">
                    Average response time
                  </span>
                  <span className="text-sm font-medium">
                    {periodStats?.avgResponseTime?.toFixed(2)}s
                  </span>
                </div>
              )}
              {hasSuccessRate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-c-text-muted">Error rate</span>
                  <span className="text-sm font-medium text-emerald-600">
                    {(100 - (periodStats?.successRate || 0)).toFixed(1)}%
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-c-text-muted">
                  Tokens per request
                </span>
                <span className="text-sm font-medium">
                  {periodStats
                    ? periodStats.totalRequests > 0
                      ? Math.round(periodStats.totalTokens / periodStats.totalRequests)
                      : 0
                    : 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AIUsageDashboard;
