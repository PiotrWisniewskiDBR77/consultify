/**
 * AI Cost Dashboard Component
 * Displays AI usage costs and token consumption metrics
 */

import { DollarSign, Loader2, RefreshCw, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

interface CostData {
  totalCost: number;
  currency: string;
  period: string;
  byProvider: Record<string, { tokens: number; cost: number }>;
}

interface CostMetric {
  label: string;
  value: string;
  change: number;
  trend: 'up' | 'down' | 'neutral';
}

export const AICostDashboard: React.FC = () => {
  const [costData, setCostData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCosts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/llm/costs', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Failed to fetch costs');
      const data = await response.json();
      setCostData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch cost data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCosts();
  }, [fetchCosts]);

  const totalTokens = costData
    ? Object.values(costData.byProvider).reduce((sum, p) => sum + p.tokens, 0)
    : 0;

  const providerCount = costData ? Object.keys(costData.byProvider).length : 0;
  const avgCostPerRequest =
    providerCount > 0 && totalTokens > 0 ? (costData?.totalCost || 0) / (totalTokens / 1000) : 0;

  const metrics: CostMetric[] = [
    {
      label: 'Total Cost (MTD)',
      value: `$${(costData?.totalCost || 0).toFixed(2)}`,
      change: 0,
      trend: 'neutral',
    },
    { label: 'Tokens Used', value: totalTokens.toLocaleString(), change: 0, trend: 'neutral' },
    {
      label: 'Avg Cost/Request',
      value: `$${avgCostPerRequest.toFixed(4)}`,
      change: 0,
      trend: 'neutral',
    },
    {
      label: 'Est. Monthly',
      value: `$${(((costData?.totalCost || 0) * 30) / new Date().getDate()).toFixed(2)}`,
      change: 0,
      trend: 'neutral',
    },
  ];

  const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-red-400" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-green-400" />;
      default:
        return <Zap className="w-4 h-4 text-slate-500 dark:text-slate-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary-400" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            AI Cost Analytics
          </h3>
        </div>
        <button
          onClick={fetchCosts}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800/40 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <div
            key={index}
            className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-600 dark:text-slate-400">{metric.label}</span>
              {getTrendIcon(metric.trend)}
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{metric.value}</div>
            {metric.change !== 0 && (
              <div
                className={`text-xs mt-1 ${metric.change > 0 ? 'text-red-400' : 'text-green-400'}`}
              >
                {metric.change > 0 ? '+' : ''}
                {metric.change}% vs last month
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-white/10 p-6">
        <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-4">
          Cost Breakdown by Provider
        </h4>
        {error ? (
          <div className="text-center py-8 text-red-400">
            <p>{error}</p>
            <button onClick={fetchCosts} className="mt-2 text-sm underline">
              Retry
            </button>
          </div>
        ) : Object.keys(costData?.byProvider || {}).length > 0 ? (
          <div className="space-y-3">
            {Object.entries(costData?.byProvider || {}).map(([provider, data]) => (
              <div
                key={provider}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-900/50 rounded-lg"
              >
                <div>
                  <span className="text-slate-900 dark:text-white font-medium capitalize">
                    {provider}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                    {data.tokens.toLocaleString()} tokens
                  </span>
                </div>
                <span className="text-green-400 font-semibold">${data.cost.toFixed(2)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500">
            <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No cost data available yet</p>
            <p className="text-xs mt-1">Start using AI features to see cost analytics</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AICostDashboard;
