import { AlertTriangle, TrendingUp, Zap } from 'lucide-react';
import React, { useCallback, useState } from 'react';

import { usePageAwarePolling } from '@/hooks/usePageAwarePolling';
import { Api } from '@/services/api';

interface UsageData {
  daily: number;
  monthly: number;
  dailyLimit: number;
  monthlyLimit: number;
  percentage: number;
  recentUsage?: Array<{ date: string; tokens: number; requests: number }>;
}

interface AIUsageIndicatorProps {
  compact?: boolean;
  showTrend?: boolean;
}

/**
 * Shows user's AI token usage with visual progress bar
 * Uses /api/llm/user/usage endpoint
 */
export const AIUsageIndicator: React.FC<AIUsageIndicatorProps> = ({
  compact = false,
  showTrend = false,
}) => {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    try {
      setLoading(true);
      const data = await Api.getUserAIUsage();
      setUsage({
        daily: data.tokensUsed,
        monthly: data.tokensUsed,
        dailyLimit: data.tokensLimit,
        monthlyLimit: data.tokensLimit * 30,
        percentage: (data.tokensUsed / data.tokensLimit) * 100,
      });
      setError(null);
    } catch (err) {
      console.error('Failed to fetch AI usage:', err);
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  }, []);

  usePageAwarePolling(fetchUsage, {
    intervalMs: 120_000,
    runImmediately: true,
  });

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-danger-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 animate-pulse">
        <div className="w-16 h-2 bg-slate-700 rounded-full" />
      </div>
    );
  }

  if (error || !usage) {
    return compact ? null : (
      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
        <AlertTriangle size={12} />
        <span>Usage unavailable</span>
      </div>
    );
  }

  const percentage = Math.min(100, usage.percentage);
  const isNearLimit = percentage >= 80;

  if (compact) {
    return (
      <div
        className="flex items-center gap-1.5 cursor-help"
        title={`${formatNumber(usage.daily)} / ${formatNumber(usage.dailyLimit)} tokens today`}
      >
        <Zap
          size={12}
          className={isNearLimit ? 'text-yellow-500' : 'text-slate-600 dark:text-slate-500'}
        />
        <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${getProgressColor(percentage)}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-navy-800/50 rounded-lg p-3 border border-c-border-subtle">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-primary-400" />
          <span className="text-xs font-medium text-slate-600">AI Usage Today</span>
        </div>
        {showTrend && usage.recentUsage && usage.recentUsage.length > 1 && (
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <TrendingUp size={12} />
            <span>{usage.recentUsage.length}d trend</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${getProgressColor(percentage)}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
        <span className="text-xs text-slate-600 dark:text-slate-500 whitespace-nowrap">
          {formatNumber(usage.daily)} / {formatNumber(usage.dailyLimit)}
        </span>
      </div>

      {isNearLimit && (
        <div className="mt-2 flex items-center gap-1 text-xs text-yellow-400">
          <AlertTriangle size={12} />
          <span>Approaching daily limit ({percentage.toFixed(0)}% used)</span>
        </div>
      )}

      {showTrend && usage.recentUsage && usage.recentUsage.length > 0 && (
        <div className="mt-3 pt-3 border-t border-c-border-subtle">
          <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Last 7 days
          </div>
          <div className="flex gap-1 h-8 items-end">
            {usage.recentUsage
              .slice(0, 7)
              .reverse()
              .map((day, idx) => {
                const height = Math.max(10, (day.tokens / usage.dailyLimit) * 100);
                return (
                  <div
                    key={idx}
                    className={`flex-1 rounded-sm ${getProgressColor((day.tokens / usage.dailyLimit) * 100)}`}
                    style={{ height: `${Math.min(100, height)}%` }}
                    title={`${day.date}: ${formatNumber(day.tokens)} tokens`}
                  />
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIUsageIndicator;
