/**
 * AI Cost Dashboard Component
 * Displays AI usage costs and token consumption metrics
 */

import { DollarSign, Loader2, RefreshCw, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { DegradedState } from '@/components/Admin/AdminState';
import { EmptyState } from '@/components/ui/composed/EmptyState';
import { LoadingState } from '@/components/ui/primitives';
import { Api } from '@/services/api';
import { normalizeApiErrorMessage } from '@/utils/apiError';

interface CostData {
  totalCost: number;
  currency: string;
  period: string;
  byProvider: Record<string, { tokens: number; cost: number }>;
}

interface FinOpsOverview {
  mtdSpendUsd: number;
  projectedMonthEndSpendUsd: number;
  budgetUtilizationPct: number;
  vendorConcentrationPct: number;
  topVendor: string | null;
  anomalies: Array<{
    key: string;
    deltaPct: number;
    severity: 'warning' | 'critical';
    scope: string;
  }>;
}

interface CostMetric {
  label: string;
  value: string;
  change: number;
  trend: 'up' | 'down' | 'neutral';
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getObjectPayload = (value: unknown) => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) ? value.data : null;
  return data && isRecord(data.data) ? data.data : data || value;
};

const asText = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim()
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : fallback;

const toNumber = (value: unknown, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

const normalizeCostData = (value: unknown): CostData => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload) || !('totalCost' in payload) || !isRecord(payload.byProvider)) {
    throw new Error('AI cost response was incomplete');
  }

  return {
    totalCost: toNumber(payload.totalCost, 0),
    currency: asText(payload.currency, 'USD'),
    period: asText(payload.period, 'mtd'),
    byProvider: Object.entries(payload.byProvider).reduce(
      (acc, [provider, item]) => {
        const row = isRecord(item) ? item : {};
        acc[provider] = {
          tokens: toNumber(row.tokens, 0),
          cost: toNumber(row.cost, 0),
        };
        return acc;
      },
      {} as Record<string, { tokens: number; cost: number }>
    ),
  };
};

const normalizeFinOpsOverview = (value: unknown): FinOpsOverview | null => {
  const payload = getObjectPayload(value);
  const overview = isRecord(payload) && isRecord(payload.overview) ? payload.overview : payload;
  if (!isRecord(overview)) return null;

  return {
    mtdSpendUsd: toNumber(overview.mtdSpendUsd, 0),
    projectedMonthEndSpendUsd: toNumber(overview.projectedMonthEndSpendUsd, 0),
    budgetUtilizationPct: toNumber(overview.budgetUtilizationPct, 0),
    vendorConcentrationPct: toNumber(overview.vendorConcentrationPct, 0),
    topVendor:
      overview.topVendor === null || overview.topVendor === undefined
        ? null
        : asText(overview.topVendor, ''),
    anomalies: Array.isArray(overview.anomalies)
      ? overview.anomalies.filter(isRecord).map((anomaly) => ({
          key: asText(anomaly.key, ''),
          deltaPct: toNumber(anomaly.deltaPct, 0),
          severity: anomaly.severity === 'critical' ? 'critical' : 'warning',
          scope: asText(anomaly.scope, ''),
        }))
      : [],
  };
};

export const AICostDashboard: React.FC = () => {
  const [costData, setCostData] = useState<CostData | null>(null);
  const [finOps, setFinOps] = useState<FinOpsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchCosts = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [costPayload, finOpsPayload] = await Promise.all([
        Api.getLLMCosts(),
        Api.getAIFinOpsOverview().catch(() => null),
      ]);
      setCostData(normalizeCostData(costPayload));
      setFinOps(normalizeFinOpsOverview(finOpsPayload));
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to fetch cost data');
      setCostData(null);
      setFinOps(null);
      setLoadError(message);
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
      value:
        finOps?.projectedMonthEndSpendUsd !== undefined
          ? `$${finOps.projectedMonthEndSpendUsd.toFixed(2)}`
          : 'n/a',
      change: 0,
      trend: 'neutral',
    },
  ];

  const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-danger-400" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-green-400" />;
      default:
        return <Zap className="w-4 h-4 text-slate-500 dark:text-slate-400" />;
    }
  };

  if (loading) {
    return <LoadingState variant="spinner" />;
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

      {loadError ? (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-c-border-subtle p-6">
          <DegradedState title="AI cost analytics unavailable" description={loadError} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metrics.map((metric, index) => (
              <div
                key={index}
                className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-c-border-subtle p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-600 dark:text-slate-400">{metric.label}</span>
                  {getTrendIcon(metric.trend)}
                </div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">
                  {metric.value}
                </div>
                {metric.change !== 0 && (
                  <div
                    className={`text-xs mt-1 ${metric.change > 0 ? 'text-danger-400' : 'text-green-400'}`}
                  >
                    {metric.change > 0 ? '+' : ''}
                    {metric.change}% vs last month
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-c-border-subtle p-6">
            <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-4">
              Cost Breakdown by Provider
            </h4>
            {Object.keys(costData?.byProvider || {}).length > 0 ? (
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
              <EmptyState
                icon={<DollarSign />}
                title="No cost data available yet"
                description="Start using AI features to see cost analytics"
              />
            )}
          </div>

          {finOps ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-c-border-subtle p-4">
                <div className="text-xs text-slate-600 dark:text-slate-400">Budget Utilization</div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                  {finOps.budgetUtilizationPct.toFixed(1)}%
                </div>
              </div>
              <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-c-border-subtle p-4">
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  Top Vendor Concentration
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                  {(finOps.topVendor || 'unknown').toUpperCase()}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {finOps.vendorConcentrationPct.toFixed(1)}% of MTD spend
                </div>
              </div>
              <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-c-border-subtle p-4">
                <div className="text-xs text-slate-600 dark:text-slate-400">Spend Anomalies</div>
                <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                  {finOps.anomalies.length}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {finOps.anomalies[0]
                    ? `${finOps.anomalies[0].scope}: ${finOps.anomalies[0].key} +${finOps.anomalies[0].deltaPct.toFixed(1)}%`
                    : 'No major spikes detected'}
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};

export default AICostDashboard;
