/**
 * PerformanceMetricsTab - Analytics > Performance Metrics
 * Performance analytics and metrics aggregation view
 */

import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart2,
  Calendar,
  Clock,
  Cpu,
  Download,
  Gauge,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

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
  successRate: number;
  errorRate: number;
}

export const PerformanceMetricsTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'1d' | '7d' | '30d' | '90d'>('7d');
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [providerMetrics, setProviderMetrics] = useState<ProviderMetrics[]>([]);
  const [alerts, setAlerts] = useState<
    Array<{ severity?: string; title?: string; description?: string; provider?: string }>
  >([]);

  useEffect(() => {
    loadMetrics();
  }, [dateRange]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const periodMap: Record<typeof dateRange, string> = {
        '1d': '24h',
        '7d': '7d',
        '30d': '30d',
        '90d': '90d',
      };
      const period = periodMap[dateRange];

      const [metricsRes, trendsRes, providersRes, llmHealthRes] = await Promise.all([
        fetch(`/api/ai-operations/performance/metrics?period=${encodeURIComponent(period)}`, {
          headers,
        }),
        fetch(`/api/ai-operations/performance/trends?period=${encodeURIComponent(period)}`, {
          headers,
        }),
        fetch('/api/ai-operations/mission-control/providers', { headers }),
        fetch('/api/llm/health/detailed', { headers }),
      ]);

      const metricsPayload = await metricsRes.json().catch(() => ({}));
      const trendsPayload = await trendsRes.json().catch(() => ({}));
      const providersPayload = await providersRes.json().catch(() => ({}));
      const llmHealthPayload = await llmHealthRes.json().catch(() => ({}));

      const cur = metricsPayload?.data || {};
      const trends: Array<{
        timestamp?: string;
        avgLatency?: number;
        requests?: number;
        successRate?: string;
      }> = Array.isArray(trendsPayload?.data) ? trendsPayload.data : [];

      const historyLatency = trends.map((t) => Number(t?.avgLatency || 0)).slice(-12);
      const historyRequests = trends.map((t) => Number(t?.requests || 0)).slice(-12);
      const historySuccessRate = trends
        .map((t) => Number(String(t?.successRate || '0')))
        .slice(-12);

      const avgLatency = Number(cur?.avgLatency || 0);
      const successRate = Number(String(cur?.successRate || '0'));
      const errorRate = Math.max(0, 100 - successRate);
      const avgTokens = Number(cur?.avgTokens || 0);

      const prevLatency =
        historyLatency.length >= 2 ? historyLatency[historyLatency.length - 2] : avgLatency;
      const prevReq =
        historyRequests.length >= 2
          ? historyRequests[historyRequests.length - 2]
          : Number(cur?.totalRequests || 0);
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
          value: Number(cur?.totalRequests || 0),
          unit: '',
          change: parseFloat(pctChange(Number(cur?.totalRequests || 0), prevReq).toFixed(1)),
          changeType: Number(cur?.totalRequests || 0) >= prevReq ? 'positive' : 'negative',
          history: historyRequests.length ? historyRequests : [Number(cur?.totalRequests || 0)],
        },
      ];
      setMetrics(nextMetrics);

      const providersRows: Array<{
        name?: string;
        is_active?: boolean;
        health_status?: string;
        avg_latency_ms?: number;
      }> = Array.isArray(providersPayload?.data) ? providersPayload.data : [];

      // We can estimate provider-level error rate from detailed LLM health (healthy/unhealthy),
      // and use avg_latency_ms from mission-control/providers.
      const healthProviders: any[] = Array.isArray(llmHealthPayload?.providers)
        ? llmHealthPayload.providers
        : [];
      const healthByName = new Map(
        healthProviders.map((p) => [String(p?.name || '').toLowerCase(), p] as const)
      );

      const nextProviderMetrics: ProviderMetrics[] = providersRows.map((p) => {
        const name = String(p?.name || 'Unknown');
        const h = healthByName.get(name.toLowerCase());
        const status = String(h?.status || '').toLowerCase();
        const isUp = status === 'healthy' || status === 'degraded';
        return {
          provider: name,
          avgLatency: Number(p?.avg_latency_ms || h?.responseTime || 0),
          successRate: isUp ? 100 : 0,
          errorRate: isUp ? 0 : 100,
        };
      });
      setProviderMetrics(nextProviderMetrics);

      const nextAlerts: Array<{
        severity?: string;
        title?: string;
        description?: string;
        provider?: string;
      }> = Array.isArray(llmHealthPayload?.alerts) ? llmHealthPayload.alerts : [];
      setAlerts(nextAlerts);
    } catch (err) {
      toast.error('Failed to load performance metrics');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(num < 10 ? 2 : 0);
  };

  const getChangeIcon = (changeType: PerformanceMetric['changeType']) => {
    if (changeType === 'positive') return <TrendingUp size={14} className="text-emerald-500" />;
    if (changeType === 'negative') return <TrendingDown size={14} className="text-red-500" />;
    return null;
  };

  const getChangeColor = (changeType: PerformanceMetric['changeType']) => {
    if (changeType === 'positive') return 'text-emerald-500';
    if (changeType === 'negative') return 'text-red-500';
    return 'text-slate-400';
  };

  // Simple sparkline component
  const Sparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const height = 24;
    const width = 60;
    const points = data
      .map((v, i) => {
        const x = (i / (data.length - 1)) * width;
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
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
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
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors">
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

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
                color={metric.changeType === 'positive' ? '#10b981' : '#ef4444'}
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
                  <span className="text-slate-400">vs last period</span>
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
        <table className="w-full">
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
                  <span className="font-medium text-slate-900 dark:text-white">{pm.provider}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-slate-700 dark:text-slate-300">{pm.avgLatency}ms</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span
                    className={
                      pm.successRate >= 99.5
                        ? 'text-emerald-500'
                        : pm.successRate >= 99
                          ? 'text-amber-500'
                          : 'text-red-500'
                    }
                  >
                    {pm.successRate.toFixed(2)}%
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span
                    className={
                      pm.errorRate <= 0.2
                        ? 'text-emerald-500'
                        : pm.errorRate <= 0.5
                          ? 'text-amber-500'
                          : 'text-red-500'
                    }
                  >
                    {pm.errorRate.toFixed(2)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Performance Alerts */}
      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-500" />
          Performance Alerts
        </h3>
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">No active alerts.</div>
          ) : (
            alerts.slice(0, 10).map((a, idx) => {
              const sev = String(a?.severity || 'info').toLowerCase();
              const isErr = sev === 'error';
              return (
                <div
                  key={`${a?.provider || 'alert'}-${idx}`}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    isErr
                      ? 'bg-red-500/10 border-red-500/20'
                      : 'bg-amber-500/10 border-amber-500/20'
                  }`}
                >
                  {isErr ? (
                    <AlertTriangle size={16} className="text-red-500" />
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
                        ? 'bg-red-500/20 text-red-600 dark:text-red-400'
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
      </div>
    </div>
  );
};

export default PerformanceMetricsTab;
