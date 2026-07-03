/**
 * UsageAnalyticsDashboard - Advanced AI Usage Analytics
 *
 * Provides comprehensive analytics for AI usage including:
 * - Usage trends over time (7d/30d/90d)
 * - Model popularity heatmap
 * - Peak usage hours chart
 * - Cost per capability breakdown
 * - Period-over-period comparison
 * - Export to CSV/PDF
 */

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  Clock,
  Cpu,
  DollarSign,
  Download,
  Layers,
  type LucideIcon,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '@/components/Admin/AdminState';
import { normalizeApiErrorMessage } from '@/utils/apiError';

interface UsageTrend {
  date: string;
  requests: number;
  tokens: number;
  cost: number;
  uniqueUsers: number;
}

interface ModelUsage {
  model: string;
  requests: number;
  tokens: number;
  cost: number;
  avgResponseTime: number;
  percentage: number;
}

interface CapabilityUsage {
  capability: string;
  requests: number;
  tokens: number;
  cost: number;
  percentage: number;
}

interface HourlyUsage {
  hour: number;
  requests: number;
  intensity: number; // 0-100
}

interface PeriodComparison {
  metric: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
}

type TimeRange = '7d' | '30d' | '90d';

interface UsageSummary {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  uniqueUsers: number;
  avgRequestsPerDay: number;
  avgCostPerRequest: number;
  topModel: string;
  topCapability: string;
}

interface ProviderCost {
  tokens?: number;
  cost?: number;
}

const EMPTY_SUMMARY: UsageSummary = {
  totalRequests: 0,
  totalTokens: 0,
  totalCost: 0,
  uniqueUsers: 0,
  avgRequestsPerDay: 0,
  avgCostPerRequest: 0,
  topModel: '',
  topCapability: '',
};

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

const normalizeUsageAnalytics = (value: unknown) => {
  const payload = getObjectPayload(value);
  if (
    !isRecord(payload) ||
    !('totalTokens' in payload) ||
    !('totalCalls' in payload) ||
    !('avgLatency' in payload) ||
    !Array.isArray(payload.byDay)
  ) {
    throw new Error('AI usage analytics response was incomplete');
  }

  return {
    totalTokens: toNumber(payload.totalTokens, 0),
    totalCalls: toNumber(payload.totalCalls, 0),
    avgLatency: toNumber(payload.avgLatency, 0),
    byDay: payload.byDay.filter(isRecord).map((day) => ({
      date: asText(day.date, ''),
      calls: toNumber(day.calls, 0),
      tokens: toNumber(day.tokens, 0),
    })),
  };
};

const normalizeUsageLogs = (value: unknown) => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload) || !Array.isArray(payload.logs)) {
    throw new Error('AI usage logs response was not a list');
  }

  return payload.logs.filter(isRecord).map((log) => ({
    provider: asText(log.provider, 'unknown'),
    model: asText(log.model, 'unknown'),
    action: asText(log.action, 'unknown'),
    tokens: toNumber(log.tokens, 0),
    createdAt: asText(log.createdAt, ''),
  }));
};

const normalizeUsageCosts = (value: unknown) => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload) || !('totalCost' in payload) || !isRecord(payload.byProvider)) {
    throw new Error('AI usage cost response was incomplete');
  }

  return {
    totalCost: toNumber(payload.totalCost, 0),
    byProvider: Object.entries(payload.byProvider).reduce(
      (acc, [provider, item]) => {
        const row = isRecord(item) ? item : {};
        acc[provider] = {
          tokens: toNumber(row.tokens, 0),
          cost: toNumber(row.cost, 0),
        };
        return acc;
      },
      {} as Record<string, ProviderCost>
    ),
  };
};

export const UsageAnalyticsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [loadError, setLoadError] = useState<string | null>(null);

  // Analytics data state
  const [trends, setTrends] = useState<UsageTrend[]>([]);
  const [modelUsage, setModelUsage] = useState<ModelUsage[]>([]);
  const [capabilityUsage, setCapabilityUsage] = useState<CapabilityUsage[]>([]);
  const [hourlyUsage, setHourlyUsage] = useState<HourlyUsage[]>([]);
  const [comparison, setComparison] = useState<PeriodComparison[]>([]);
  const [summary, setSummary] = useState<UsageSummary>(EMPTY_SUMMARY);

  const getDays = (range: TimeRange) => (range === '7d' ? 7 : range === '30d' ? 30 : 90);

  const resetAnalyticsState = () => {
    setTrends([]);
    setModelUsage([]);
    setCapabilityUsage([]);
    setHourlyUsage([]);
    setComparison([]);
    setSummary(EMPTY_SUMMARY);
  };

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const days = getDays(timeRange);
      const windowDays = days * 2; // for period-over-period comparison

      const [analyticsRes, logsRes, costsRes] = await Promise.all([
        fetch(`/api/llm/analytics?days=${windowDays}`, { headers }),
        fetch(`/api/llm/logs?limit=500&offset=0`, { headers }),
        fetch(`/api/llm/costs`, { headers }),
      ]);

      if (!analyticsRes.ok) throw new Error('Failed to load AI analytics');
      if (!logsRes.ok) throw new Error('Failed to load AI usage logs');
      if (!costsRes.ok) throw new Error('Failed to load AI cost analytics');

      const analytics = normalizeUsageAnalytics(await analyticsRes.json());
      const logs = normalizeUsageLogs(await logsRes.json());
      const costs = normalizeUsageCosts(await costsRes.json());

      const byDay = analytics.byDay;
      const totalTokensAll = analytics.totalTokens;
      const totalCallsAll = analytics.totalCalls;
      const totalCostAll = costs.totalCost;

      const lastDays = byDay.slice(-days);
      const prevDays = byDay.slice(
        Math.max(0, byDay.length - days * 2),
        Math.max(0, byDay.length - days)
      );

      const currentTotals = lastDays.reduce(
        (acc, d) => {
          acc.requests += Number(d.calls || 0);
          acc.tokens += Number(d.tokens || 0);
          return acc;
        },
        { requests: 0, tokens: 0 }
      );
      const previousTotals = prevDays.reduce(
        (acc, d) => {
          acc.requests += Number(d.calls || 0);
          acc.tokens += Number(d.tokens || 0);
          return acc;
        },
        { requests: 0, tokens: 0 }
      );

      // Estimate per-day costs by distributing totalCost by tokens
      const trendsData: UsageTrend[] = lastDays.map((d) => {
        const tokens = Number(d.tokens || 0);
        const cost = totalTokensAll > 0 ? (totalCostAll * tokens) / totalTokensAll : 0;
        return {
          date: d.date,
          requests: Number(d.calls || 0),
          tokens,
          cost: Math.round(cost * 100) / 100,
          uniqueUsers: 0,
        };
      });
      setTrends(trendsData);

      // Build provider-level cost-per-token map (best-effort, current month)
      const providerCostPerToken = new Map<string, number>();
      const byProviderCosts = costs.byProvider;
      Object.entries(byProviderCosts).forEach(([provider, v]) => {
        const tokens = toNumber(v?.tokens, 0);
        const cost = toNumber(v?.cost, 0);
        providerCostPerToken.set(provider, tokens > 0 ? cost / tokens : 0);
      });

      const modelAgg = new Map<
        string,
        { requests: number; tokens: number; cost: number; avgResponseTime: number }
      >();
      const capAgg = new Map<string, { requests: number; tokens: number; cost: number }>();
      const hourlyAgg = new Array<number>(24).fill(0);

      for (const l of logs) {
        const provider = l.provider;
        const model = l.model;
        const capability = l.action;
        const tokens = l.tokens;
        const cost = (providerCostPerToken.get(provider) || 0) * tokens;

        const m = modelAgg.get(model) || { requests: 0, tokens: 0, cost: 0, avgResponseTime: 0 };
        m.requests += 1;
        m.tokens += tokens;
        m.cost += cost;
        modelAgg.set(model, m);

        const c = capAgg.get(capability) || { requests: 0, tokens: 0, cost: 0 };
        c.requests += 1;
        c.tokens += tokens;
        c.cost += cost;
        capAgg.set(capability, c);

        if (l.createdAt) {
          const hour = new Date(l.createdAt).getHours();
          if (hour >= 0 && hour <= 23) hourlyAgg[hour] += 1;
        }
      }

      const totalModelReq =
        Array.from(modelAgg.values()).reduce((sum, v) => sum + v.requests, 0) || 1;
      const modelUsageData: ModelUsage[] = Array.from(modelAgg.entries())
        .map(([model, v]) => ({
          model,
          requests: v.requests,
          tokens: v.tokens,
          cost: Math.round(v.cost * 100) / 100,
          avgResponseTime: 0,
          percentage: Math.round((v.requests / totalModelReq) * 1000) / 10,
        }))
        .sort((a, b) => b.requests - a.requests);
      setModelUsage(modelUsageData);

      const totalCapReq = Array.from(capAgg.values()).reduce((sum, v) => sum + v.requests, 0) || 1;
      const capUsageData: CapabilityUsage[] = Array.from(capAgg.entries())
        .map(([capability, v]) => ({
          capability,
          requests: v.requests,
          tokens: v.tokens,
          cost: Math.round(v.cost * 100) / 100,
          percentage: Math.round((v.requests / totalCapReq) * 1000) / 10,
        }))
        .sort((a, b) => b.requests - a.requests);
      setCapabilityUsage(capUsageData);

      const maxHourly = Math.max(...hourlyAgg, 1);
      const hourlyData: HourlyUsage[] = hourlyAgg.map((requests, hour) => ({
        hour,
        requests,
        intensity: Math.round((requests / maxHourly) * 100),
      }));
      setHourlyUsage(hourlyData);

      const mkComparison = (
        metric: string,
        current: number,
        previous: number
      ): PeriodComparison => {
        const change = current - previous;
        const changePercent = previous > 0 ? (change / previous) * 100 : current > 0 ? 100 : 0;
        return {
          metric,
          current,
          previous,
          change,
          changePercent: Math.round(changePercent * 10) / 10,
        };
      };

      setComparison([
        mkComparison('Requests', currentTotals.requests, previousTotals.requests),
        mkComparison('Tokens Used', currentTotals.tokens, previousTotals.tokens),
        mkComparison('Total Cost', totalCostAll, totalCostAll), // month-level, no period split available here
        mkComparison('Unique Users', 0, 0),
        mkComparison('Avg Response Time', analytics.avgLatency, analytics.avgLatency),
      ]);

      const topModel = modelUsageData[0]?.model || '';
      const topCapability = capUsageData[0]?.capability || '';
      const avgRequestsPerDay = days > 0 ? Math.round(currentTotals.requests / days) : 0;
      const avgCostPerRequest =
        currentTotals.requests > 0 ? totalCostAll / currentTotals.requests : 0;

      setSummary({
        totalRequests: currentTotals.requests || totalCallsAll,
        totalTokens: currentTotals.tokens || totalTokensAll,
        totalCost: Math.round(totalCostAll * 100) / 100,
        uniqueUsers: 0,
        avgRequestsPerDay,
        avgCostPerRequest: Math.round(avgCostPerRequest * 1000) / 1000,
        topModel,
        topCapability,
      });
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to load AI usage analytics');
      resetAnalyticsState();
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleExport = (format: 'csv' | 'pdf') => {
    if (loadError) return;

    if (format === 'csv') {
      // Export CSV
      const headers = ['Date', 'Requests', 'Tokens', 'Cost', 'Unique Users'];
      const rows = trends.map((t) => [t.date, t.requests, t.tokens, t.cost, t.uniqueUsers]);
      const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-usage-analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exported');
    } else {
      toast.error('PDF export is not connected to a generated report yet');
    }
  };

  const formatNumber = (num: number) =>
    num >= 1000000
      ? `${(num / 1000000).toFixed(1)}M`
      : num >= 1000
        ? `${(num / 1000).toFixed(1)}k`
        : num.toString();

  const formatCurrency = (num: number) => `$${num.toFixed(2)}`;

  const getIntensityColor = (intensity: number) => {
    if (intensity >= 80) return 'bg-primary-500';
    if (intensity >= 60) return 'bg-primary-400';
    if (intensity >= 40) return 'bg-primary-300/70';
    if (intensity >= 20) return 'bg-primary-200/50';
    return 'bg-primary-100/30';
  };

  const maxTrendValue = Math.max(...trends.map((t) => t.requests), 1);
  const peakHour = hourlyUsage.reduce<HourlyUsage | null>(
    (peak, hour) => (!peak || hour.requests > peak.requests ? hour : peak),
    null
  );
  const hasPeakHour = !!peakHour && peakHour.requests > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart2 size={24} className="text-primary-400" />
            AI Usage Analytics
          </h2>
          <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-sm mt-1">
            Comprehensive insights into AI usage patterns and costs
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time Range */}
          <div className="flex bg-slate-50 dark:bg-navy-800 rounded-lg p-1">
            {(['7d', '30d', '90d'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                disabled={!!loadError}
                title={loadError || undefined}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-500 dark:text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Export */}
          <div className="flex gap-2">
            <button
              onClick={() => handleExport('csv')}
              disabled={!!loadError || trends.length === 0}
              title={loadError || (trends.length === 0 ? 'No usage data to export' : undefined)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={16} />
              CSV
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled
              title="PDF export is not connected to a generated report yet"
              className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={16} />
              PDF Report
            </button>
          </div>

          <button
            onClick={loadAnalytics}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
          <DegradedState title="AI usage analytics unavailable" description={loadError} />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <SummaryCard
              icon={Zap}
              label="Total Requests"
              value={formatNumber(summary.totalRequests)}
              color="text-blue-400"
            />
            <SummaryCard
              icon={Layers}
              label="Total Tokens"
              value={formatNumber(summary.totalTokens)}
              color="text-primary-400"
            />
            <SummaryCard
              icon={DollarSign}
              label="Total Cost"
              value={formatCurrency(summary.totalCost)}
              color="text-emerald-400"
            />
            <SummaryCard
              icon={Users}
              label="Unique Users"
              value={summary.uniqueUsers.toString()}
              color="text-blue-400"
            />
            <SummaryCard
              icon={Activity}
              label="Avg Requests/Day"
              value={summary.avgRequestsPerDay.toString()}
              color="text-amber-400"
            />
            <SummaryCard
              icon={Target}
              label="Avg Cost/Request"
              value={formatCurrency(summary.avgCostPerRequest)}
              color="text-pink-400"
            />
          </div>

          {/* Period Comparison */}
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-emerald-400" />
              Period Comparison (vs Previous {timeRange})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {comparison.map((item) => (
                <div key={item.metric} className="p-4 bg-slate-50 dark:bg-navy-950/50 rounded-lg">
                  <div className="text-xs text-slate-500 dark:text-slate-400 uppercase mb-1">
                    {item.metric}
                  </div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                    {item.metric.includes('Cost')
                      ? formatCurrency(item.current)
                      : item.metric.includes('Time')
                        ? `${item.current}s`
                        : formatNumber(item.current)}
                  </div>
                  <div
                    className={`flex items-center gap-1 text-sm ${
                      item.changePercent > 0
                        ? item.metric.includes('Time')
                          ? 'text-danger-400'
                          : 'text-emerald-400'
                        : item.metric.includes('Time')
                          ? 'text-emerald-400'
                          : 'text-danger-400'
                    }`}
                  >
                    {item.changePercent > 0 ? (
                      <ArrowUpRight size={14} />
                    ) : (
                      <ArrowDownRight size={14} />
                    )}
                    {Math.abs(item.changePercent).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trends Chart */}
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Activity size={18} className="text-primary-400" />
              Usage Trends
            </h3>
            {loading ? (
              <div className="h-48 flex items-center justify-center text-slate-500 dark:text-slate-400">
                <RefreshCw className="animate-spin mr-2" size={20} />
                Loading...
              </div>
            ) : trends.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
                No usage trend data for this period
              </div>
            ) : (
              <div className="h-48 flex items-end gap-1">
                {trends.map((point, idx) => (
                  <div key={idx} className="flex-1 group relative">
                    <div
                      className="w-full bg-gradient-to-t from-primary-600 to-primary-400 rounded-t transition-all hover:from-primary-500 hover:to-primary-300"
                      style={{
                        height: `${(point.requests / maxTrendValue) * 100}%`,
                        minHeight: '4px',
                      }}
                    />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                      <div className="bg-c-surface border border-slate-200 dark:border-white/10 rounded-lg p-2 text-xs whitespace-nowrap">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {point.date}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 dark:text-slate-500">
                          {point.requests} requests
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 dark:text-slate-500">
                          {formatNumber(point.tokens)} tokens
                        </div>
                        <div className="text-emerald-400">{formatCurrency(point.cost)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-2 px-1">
              <span>{trends[0]?.date || ''}</span>
              <span>{trends[trends.length - 1]?.date || ''}</span>
            </div>
          </div>

          {/* Model Usage & Capability Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Model Usage */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Cpu size={18} className="text-blue-400" />
                Model Popularity
              </h3>
              <div className="space-y-3">
                {modelUsage.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    No model usage recorded in this period
                  </div>
                ) : (
                  modelUsage.map((model) => (
                    <div key={model.model} className="flex items-center gap-4">
                      <div
                        className="w-28 text-sm text-slate-900 dark:text-white font-medium truncate"
                        title={model.model}
                      >
                        {model.model}
                      </div>
                      <div className="flex-1">
                        <div className="h-6 bg-slate-50 dark:bg-navy-950 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all flex items-center justify-end pr-2"
                            style={{ width: `${model.percentage}%` }}
                          >
                            <span className="text-xs font-medium text-slate-900 dark:text-white">
                              {model.percentage}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="w-24 text-right">
                        <div className="text-sm text-slate-900 dark:text-white">
                          {formatNumber(model.requests)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {formatCurrency(model.cost)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Capability Usage */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Target size={18} className="text-amber-400" />
                Usage by Capability
              </h3>
              <div className="space-y-3">
                {capabilityUsage.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    No capability usage recorded in this period
                  </div>
                ) : (
                  capabilityUsage.map((cap) => (
                    <div key={cap.capability} className="flex items-center gap-4">
                      <div
                        className="w-32 text-sm text-slate-900 dark:text-white font-medium truncate"
                        title={cap.capability}
                      >
                        {cap.capability}
                      </div>
                      <div className="flex-1">
                        <div className="h-6 bg-slate-50 dark:bg-navy-950 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all flex items-center justify-end pr-2"
                            style={{ width: `${cap.percentage}%` }}
                          >
                            <span className="text-xs font-medium text-slate-900 dark:text-white">
                              {cap.percentage}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="w-24 text-right">
                        <div className="text-sm text-slate-900 dark:text-white">
                          {formatNumber(cap.requests)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {formatCurrency(cap.cost)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Hourly Usage Heatmap */}
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Clock size={18} className="text-blue-400" />
              Peak Usage Hours
            </h3>
            <div className="flex gap-1">
              {hourlyUsage.map((hour) => (
                <div key={hour.hour} className="flex-1 group relative">
                  <div
                    className={`h-16 rounded ${getIntensityColor(hour.intensity)} transition-all hover:opacity-80`}
                    title={`${hour.hour}:00 - ${hour.requests} requests`}
                  />
                  <div className="text-center text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {hour.hour % 4 === 0 ? `${hour.hour}:00` : ''}
                  </div>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                    <div className="bg-c-surface border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-xs whitespace-nowrap">
                      <div className="text-slate-900 dark:text-white">
                        {hour.hour}:00 - {hour.hour + 1}:00
                      </div>
                      <div className="text-blue-400">{hour.requests} requests</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 mt-4 text-xs text-slate-500 dark:text-slate-400">
              <span>Low</span>
              <div className="flex gap-0.5">
                <div className="w-4 h-3 bg-primary-100/30 rounded-sm" />
                <div className="w-4 h-3 bg-primary-200/50 rounded-sm" />
                <div className="w-4 h-3 bg-primary-300/70 rounded-sm" />
                <div className="w-4 h-3 bg-primary-400 rounded-sm" />
                <div className="w-4 h-3 bg-c-surface rounded-sm" />
              </div>
              <span>High</span>
            </div>
          </div>

          {/* Top Insights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InsightCard
              title="Most Popular Model"
              value={summary.topModel}
              description="Based on request volume"
              icon={Cpu}
              color="text-blue-400"
            />
            <InsightCard
              title="Top Capability"
              value={summary.topCapability}
              description="Most used AI feature"
              icon={Target}
              color="text-amber-400"
            />
            <InsightCard
              title="Peak Hour"
              value={hasPeakHour ? `${peakHour.hour}:00 - ${peakHour.hour + 1}:00` : 'n/a'}
              description={
                hasPeakHour
                  ? 'Highest daily activity from loaded logs'
                  : 'No hourly activity available'
              }
              icon={Clock}
              color="text-blue-400"
            />
          </div>
        </>
      )}
    </div>
  );
};

// Helper Components
const SummaryCard: React.FC<{
  icon: LucideIcon;
  label: string;
  value: string;
  color: string;
}> = ({ icon: Icon, label, value, color }) => (
  <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-4">
    <div className="flex items-center gap-2 mb-2">
      <Icon size={16} className={color} />
      <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        {label}
      </span>
    </div>
    <div className="text-xl font-bold text-slate-900 dark:text-white">{value}</div>
  </div>
);

const InsightCard: React.FC<{
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  color: string;
}> = ({ title, value, description, icon: Icon, color }) => (
  <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-4">
    <div className="flex items-center gap-3 mb-3">
      <div className={`p-2 rounded-lg bg-slate-50 dark:bg-navy-800`}>
        <Icon size={20} className={color} />
      </div>
      <div>
        <h4 className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">{title}</h4>
        <div className="text-lg font-bold text-slate-900 dark:text-white">{value}</div>
      </div>
    </div>
    <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
  </div>
);

export default UsageAnalyticsDashboard;
