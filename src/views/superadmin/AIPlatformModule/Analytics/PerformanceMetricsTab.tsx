/**
 * PerformanceMetricsTab - Analytics > Performance Metrics
 * Performance analytics and metrics aggregation view
 */

import {
  AlertTriangle,
  Cpu,
  Download,
  Gauge,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '@/components/Admin/AdminState';
import { Api } from '@/services/api';
import { normalizeApiErrorMessage } from '@/utils/apiError';

import { LoadingState } from '../../../../components/ui/primitives';

interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  change: number;
  changeType: 'positive' | 'negative' | 'neutral';
  target?: number;
  history: number[];
}

interface ProviderMetrics {
  provider: string;
  avgLatency: number;
  successRate: number | null;
  errorRate: number | null;
}

interface ProviderRow {
  name?: string;
  is_active?: boolean;
  health_status?: string;
  avg_latency_ms?: number;
}

interface HealthProvider {
  name?: string;
  status?: string;
  responseTime?: number;
}

interface PerformanceAlert {
  severity?: string;
  title?: string;
  description?: string;
  provider?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getObjectPayload = (value: unknown) => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) || Array.isArray(value.data) ? value.data : null;
  return isRecord(data) && isRecord(data.data) ? data.data : data || value;
};

const asText = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim()
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : fallback;

const toNumber = (value: unknown, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

const normalizeCurrentMetrics = (value: unknown) => {
  const payload = getObjectPayload(value);
  if (
    !isRecord(payload) ||
    !('avgLatency' in payload) ||
    !('successRate' in payload) ||
    !('avgTokens' in payload) ||
    !('totalRequests' in payload)
  ) {
    throw new Error('Performance metrics response was incomplete');
  }

  return {
    avgLatency: toNumber(payload.avgLatency, 0),
    successRate: toNumber(payload.successRate, 0),
    avgTokens: toNumber(payload.avgTokens, 0),
    totalRequests: toNumber(payload.totalRequests, 0),
  };
};

const normalizeTrends = (value: unknown) => {
  const payload = getObjectPayload(value);
  if (!Array.isArray(payload)) {
    throw new Error('Performance trends response was not a list');
  }

  return payload.filter(isRecord).map((trend) => ({
    timestamp: asText(trend.timestamp, ''),
    avgLatency: toNumber(trend.avgLatency, 0),
    requests: toNumber(trend.requests, 0),
    successRate: toNumber(trend.successRate, 0),
  }));
};

const normalizeProviderRows = (value: unknown): ProviderRow[] => {
  const payload = getObjectPayload(value);
  if (!Array.isArray(payload)) {
    throw new Error('Provider performance response was not a list');
  }

  return payload.filter(isRecord).map((provider) => ({
    name: asText(provider.name, 'Unknown'),
    is_active: provider.is_active === true,
    health_status: asText(provider.health_status, ''),
    avg_latency_ms: toNumber(provider.avg_latency_ms, 0),
  }));
};

const normalizeHealthPayload = (
  value: unknown
): {
  providers: HealthProvider[];
  alerts: PerformanceAlert[];
} => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload) || !Array.isArray(payload.providers) || !Array.isArray(payload.alerts)) {
    throw new Error('LLM health detail response was incomplete');
  }

  return {
    providers: payload.providers.filter(isRecord).map((provider) => ({
      name: asText(provider.name, 'Unknown'),
      status: asText(provider.status, 'unknown'),
      responseTime: toNumber(provider.responseTime, 0),
    })),
    alerts: payload.alerts.filter(isRecord).map((alert) => ({
      severity: asText(alert.severity, 'info'),
      title: asText(alert.title, 'Performance alert'),
      description: asText(alert.description, ''),
      provider: asText(alert.provider, ''),
    })),
  };
};

export const PerformanceMetricsTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'1d' | '7d' | '30d' | '90d'>('7d');
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [providerMetrics, setProviderMetrics] = useState<ProviderMetrics[]>([]);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [providerLoadError, setProviderLoadError] = useState<string | null>(null);
  const [alertsLoadError, setAlertsLoadError] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setProviderLoadError(null);
    setAlertsLoadError(null);
    try {
      const periodMap: Record<typeof dateRange, string> = {
        '1d': '24h',
        '7d': '7d',
        '30d': '30d',
        '90d': '90d',
      };
      const period = periodMap[dateRange];

      const settled = await Promise.allSettled([
        Api.getAIOperationsPerformanceMetrics(period),
        Api.getAIOperationsPerformanceTrends(period),
        Api.getMissionControlProviders(),
        Api.getLLMHealthDetailed(),
      ]);

      const metricsResult = settled[0];
      const trendsResult = settled[1];
      const providersResult = settled[2];
      const llmHealthResult = settled[3];

      // Hard requirements: without these the view is meaningless.
      if (metricsResult.status === 'rejected' || trendsResult.status === 'rejected') {
        const err =
          metricsResult.status === 'rejected'
            ? metricsResult.reason
            : trendsResult.status === 'rejected'
              ? trendsResult.reason
              : null;
        throw err instanceof Error ? err : new Error('Failed to load performance metrics');
      }

      let providersRows: ProviderRow[] = [];
      let healthProviders: HealthProvider[] = [];
      let healthAlerts: PerformanceAlert[] = [];
      let providerSourceError: string | null = null;

      if (providersResult.status === 'fulfilled') {
        try {
          providersRows = normalizeProviderRows(providersResult.value);
        } catch (error: unknown) {
          providerSourceError = normalizeApiErrorMessage(
            error,
            'Provider performance source unavailable'
          );
        }
      } else {
        providerSourceError = normalizeApiErrorMessage(
          providersResult.reason,
          'Provider performance source unavailable'
        );
      }

      if (llmHealthResult.status === 'fulfilled') {
        try {
          const normalizedHealth = normalizeHealthPayload(llmHealthResult.value);
          healthProviders = normalizedHealth.providers;
          healthAlerts = normalizedHealth.alerts;
        } catch (error: unknown) {
          const message = normalizeApiErrorMessage(error, 'Performance alerts unavailable');
          setAlertsLoadError(message);
          if (!providerSourceError) providerSourceError = message;
        }
      } else {
        const message = normalizeApiErrorMessage(
          llmHealthResult.reason,
          'Performance alerts unavailable'
        );
        setAlertsLoadError(message);
        if (!providerSourceError) providerSourceError = message;
      }

      if (providerSourceError && providersRows.length === 0 && healthProviders.length === 0) {
        setProviderLoadError(providerSourceError);
      }

      const cur = normalizeCurrentMetrics(metricsResult.value);
      const trends = normalizeTrends(trendsResult.value);

      const historyLatency = trends.map((t) => t.avgLatency).slice(-12);
      const historyRequests = trends.map((t) => t.requests).slice(-12);
      const historySuccessRate = trends.map((t) => t.successRate).slice(-12);

      const avgLatency = cur.avgLatency;
      const successRate = cur.successRate;
      const errorRate = Math.max(0, 100 - successRate);
      const avgTokens = cur.avgTokens;

      const prevLatency =
        historyLatency.length >= 2 ? historyLatency[historyLatency.length - 2] : avgLatency;
      const prevReq =
        historyRequests.length >= 2
          ? historyRequests[historyRequests.length - 2]
          : cur.totalRequests;
      const prevErr =
        historySuccessRate.length >= 2
          ? 100 - historySuccessRate[historySuccessRate.length - 2]
          : errorRate;

      const pctChange = (current: number, prev: number) => {
        if (!Number.isFinite(prev) || prev === 0) return 0;
        return ((current - prev) / prev) * 100;
      };

      const nextMetrics: PerformanceMetric[] = [
        {
          id: 'avg-latency',
          name: 'Average Response Time',
          value: avgLatency,
          unit: 'ms',
          change: parseFloat(pctChange(avgLatency, prevLatency).toFixed(1)),
          changeType: avgLatency <= prevLatency ? 'positive' : 'negative',
          target: 2000,
          history: historyLatency.length ? historyLatency : [avgLatency],
        },
        {
          id: 'success-rate',
          name: 'Success Rate',
          value: successRate,
          unit: '%',
          change: parseFloat(pctChange(successRate, 100 - prevErr).toFixed(1)),
          changeType: successRate >= 100 - prevErr ? 'positive' : 'negative',
          target: 99.9,
          history: historySuccessRate.length ? historySuccessRate : [successRate],
        },
        {
          id: 'error-rate',
          name: 'Error Rate',
          value: parseFloat(errorRate.toFixed(2)),
          unit: '%',
          change: parseFloat(pctChange(errorRate, prevErr).toFixed(1)),
          changeType: errorRate <= prevErr ? 'positive' : 'negative',
          target: 1,
          history: historySuccessRate.length ? historySuccessRate.map((s) => 100 - s) : [errorRate],
        },
        {
          id: 'avg-tokens',
          name: 'Average Tokens / Request',
          value: avgTokens,
          unit: 'tokens',
          change: 0,
          changeType: 'neutral',
          history: [avgTokens],
        },
        {
          id: 'requests',
          name: 'Total Requests',
          value: cur.totalRequests,
          unit: '',
          change: parseFloat(pctChange(cur.totalRequests, prevReq).toFixed(1)),
          changeType: cur.totalRequests >= prevReq ? 'positive' : 'negative',
          history: historyRequests.length ? historyRequests : [cur.totalRequests],
        },
      ];
      setMetrics(nextMetrics);

      // We can estimate provider-level error rate from detailed LLM health (healthy/unhealthy),
      // and use avg_latency_ms from mission-control/providers.
      const healthByName = new Map(
        healthProviders.map((p) => [String(p?.name || '').toLowerCase(), p] as const)
      );

      const nextProviderMetrics: ProviderMetrics[] =
        providersRows.length > 0
          ? providersRows.map((p) => {
              const name = String(p?.name || 'Unknown');
              const h = healthByName.get(name.toLowerCase());
              const status = String(h?.status || '').toLowerCase();
              const isUp = status === 'healthy' || status === 'degraded';
              const hasHealth = !!h?.status;
              return {
                provider: name,
                avgLatency: Number(p?.avg_latency_ms || h?.responseTime || 0),
                successRate: hasHealth ? (isUp ? 100 : 0) : null,
                errorRate: hasHealth ? (isUp ? 0 : 100) : null,
              };
            })
          : healthProviders.map((h) => {
              const name = String(h?.name || 'Unknown');
              const status = String(h?.status || '').toLowerCase();
              const isUp = status === 'healthy' || status === 'degraded';
              return {
                provider: name,
                avgLatency: Number(h?.responseTime || 0),
                successRate: isUp ? 100 : 0,
                errorRate: isUp ? 0 : 100,
              };
            });
      setProviderMetrics(nextProviderMetrics);

      setAlerts(healthAlerts);
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to load performance metrics');
      setMetrics([]);
      setProviderMetrics([]);
      setAlerts([]);
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(num < 10 ? 2 : 0);
  };

  const getChangeIcon = (changeType: PerformanceMetric['changeType']) => {
    if (changeType === 'positive') return <TrendingUp size={14} className="text-emerald-500" />;
    if (changeType === 'negative') return <TrendingDown size={14} className="text-danger-500" />;
    return null;
  };

  const getChangeColor = (changeType: PerformanceMetric['changeType']) => {
    if (changeType === 'positive') return 'text-emerald-500';
    if (changeType === 'negative') return 'text-danger-500';
    return 'text-slate-600';
  };

  // Simple sparkline component
  const Sparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
    const values = data.length > 1 ? data : [data[0] || 0, data[0] || 0];
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    const height = 24;
    const width = 60;
    const points = values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * width;
        const y = height - ((v - min) / range) * height;
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <svg width={width} height={height} className="inline-block">
        <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
      </svg>
    );
  };

  if (loading) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Gauge size={24} className="text-indigo-500" />
            Performance Metrics
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monitor AI system performance and latency metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-navy-800 rounded-lg p-1">
            {(['1d', '7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  dateRange === range
                    ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          <button
            onClick={loadMetrics}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            disabled
            title="Performance export is not connected to a generated file yet"
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
          <DegradedState title="Performance metrics unavailable" description={loadError} />
        </div>
      ) : (
        <>
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-3 gap-4">
            {metrics.map((metric) => (
              <div
                key={metric.id}
                className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-sm text-slate-500 dark:text-slate-400">{metric.name}</div>
                  <Sparkline
                    data={metric.history}
                    color={metric.changeType === 'positive' ? '#10b981' : '#f43f5e'}
                  />
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                      {formatNumber(metric.value)}
                      <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-1">
                        {metric.unit}
                      </span>
                    </div>
                    <div
                      className={`flex items-center gap-1 text-sm ${getChangeColor(metric.changeType)}`}
                    >
                      {getChangeIcon(metric.changeType)}
                      <span>
                        {metric.change > 0 ? '+' : ''}
                        {metric.change}%
                      </span>
                      <span className="text-slate-600">vs last period</span>
                    </div>
                  </div>
                  {metric.target && (
                    <div className="text-right">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Target</div>
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {formatNumber(metric.target)} {metric.unit}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Provider Performance Table */}
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Cpu size={18} className="text-slate-500" />
                Provider Performance
              </h3>
            </div>
            {providerLoadError ? (
              <div className="p-6">
                <DegradedState
                  title="Provider performance unavailable"
                  description={providerLoadError}
                />
              </div>
            ) : providerMetrics.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                No provider performance data for this period.
              </div>
            ) : (
              <table /* §27-exempt: data-viz/render analityczny read-only, nie lista encji */ className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-navy-700">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Provider
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Avg Latency
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Success Rate
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Error Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-navy-700">
                  {providerMetrics.map((pm) => (
                    <tr key={pm.provider} className="hover:bg-slate-50 dark:hover:bg-navy-900/50">
                      <td className="px-6 py-4">
                        <span className="font-medium text-slate-900 dark:text-white">
                          {pm.provider}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-slate-700 dark:text-slate-300">
                          {pm.avgLatency}ms
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span
                          className={
                            pm.successRate === null
                              ? 'text-slate-500 dark:text-slate-400'
                              : pm.successRate >= 99.5
                                ? 'text-emerald-500'
                                : pm.successRate >= 99
                                  ? 'text-amber-500'
                                  : 'text-danger-500'
                          }
                        >
                          {pm.successRate === null ? 'n/a' : `${pm.successRate.toFixed(2)}%`}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span
                          className={
                            pm.errorRate === null
                              ? 'text-slate-500 dark:text-slate-400'
                              : pm.errorRate <= 0.2
                                ? 'text-emerald-500'
                                : pm.errorRate <= 0.5
                                  ? 'text-amber-500'
                                  : 'text-danger-500'
                          }
                        >
                          {pm.errorRate === null ? 'n/a' : `${pm.errorRate.toFixed(2)}%`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Performance Alerts */}
          <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" />
              Performance Alerts
            </h3>
            {alertsLoadError ? (
              <DegradedState title="Performance alerts unavailable" description={alertsLoadError} />
            ) : (
              <div className="space-y-3">
                {alerts.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    No active alerts.
                  </div>
                ) : (
                  alerts.slice(0, 10).map((a, idx) => {
                    const sev = String(a?.severity || 'info').toLowerCase();
                    const isErr = sev === 'error';
                    return (
                      <div
                        key={`${a?.provider || 'alert'}-${idx}`}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          isErr
                            ? 'bg-danger-500/10 border-danger-500/20'
                            : 'bg-amber-500/10 border-amber-500/20'
                        }`}
                      >
                        {isErr ? (
                          <AlertTriangle size={16} className="text-danger-500" />
                        ) : (
                          <AlertTriangle size={16} className="text-amber-500" />
                        )}
                        <div className="flex-1">
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            {a?.title || 'Alert'}
                            {a?.provider ? ` • ${a.provider}` : ''}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {a?.description || '—'}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs rounded ${
                            isErr
                              ? 'bg-danger-500/20 text-danger-600 dark:text-danger-400'
                              : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {isErr ? 'Error' : 'Warning'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PerformanceMetricsTab;
