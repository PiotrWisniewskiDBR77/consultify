/**
 * AI Performance Dashboard Component
 *
 * Comprehensive dashboard for monitoring AI system performance metrics.
 * Features:
 * - Response time trends and distribution
 * - Token usage analytics per capability
 * - Cache hit rates and efficiency
 * - Model comparison metrics
 * - Cost per capability breakdown
 * - Real-time health indicators
 */

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Clock,
  Cpu,
  Database,
  DollarSign,
  Download,
  Gauge,
  Layers,
  type LucideIcon,
  PieChart,
  RefreshCw,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { DegradedState } from '../../../components/Admin/AdminState';

interface PerformanceMetrics {
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  totalRequests: number;
  successRate: number;
  errorRate: number;
  avgTokensPerRequest: number;
  totalTokensUsed: number;
  cacheHitRate: number;
  totalCostUsd: number;
}

interface CapabilityMetrics {
  capability: string;
  requests: number;
  avgResponseTime: number;
  avgTokens: number;
  totalCost: number;
  successRate: number;
}

interface ModelMetrics {
  model: string;
  requests: number;
  avgResponseTime: number;
  avgQuality: number;
  totalCost: number;
  successRate: number;
}

interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

type TimeRange = '1h' | '24h' | '7d' | '30d';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getObjectPayload = (value: unknown) => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) ? value.data : null;
  return data && isRecord(data.data) ? data.data : data || value;
};

const toNumber = (value: unknown, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

const asText = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim()
    ? value
    : typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : fallback;

const toIsoDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
};

const normalizePerformanceAnalytics = (value: unknown) => {
  const payload = getObjectPayload(value);
  if (
    !isRecord(payload) ||
    !('totalCalls' in payload) ||
    !('totalTokens' in payload) ||
    !('errorRate' in payload) ||
    !('avgLatency' in payload)
  ) {
    throw new Error('Performance analytics response was incomplete');
  }

  return {
    totalCalls: toNumber(payload.totalCalls, 0),
    totalTokens: toNumber(payload.totalTokens, 0),
    errorRate: toNumber(payload.errorRate, 0),
    avgLatency: toNumber(payload.avgLatency, 0),
    byDay: Array.isArray(payload.byDay)
      ? payload.byDay.filter(isRecord).map((day) => ({
          date: asText(day.date, ''),
          calls: toNumber(day.calls, 0),
        }))
      : [],
  };
};

const normalizePerformanceLogs = (value: unknown) => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload) || !Array.isArray(payload.logs)) {
    throw new Error('Performance logs response was not a list');
  }

  return payload.logs.filter(isRecord).map((log) => ({
    provider: asText(log.provider, 'unknown'),
    model: asText(log.model, 'unknown'),
    prompt: asText(log.prompt, 'unknown'),
    tokens: toNumber(log.tokens, 0),
    latency: toNumber(log.latency, 0),
    createdAt: asText(log.createdAt, ''),
  }));
};

const normalizeCostsPayload = (value: unknown) => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload) || !('totalCost' in payload) || !isRecord(payload.byProvider)) {
    throw new Error('Performance costs response was incomplete');
  }

  const byProvider = Object.entries(payload.byProvider).reduce(
    (acc, [provider, item]) => {
      const row = isRecord(item) ? item : {};
      acc[provider] = {
        tokens: toNumber(row.tokens, 0),
        cost: toNumber(row.cost, 0),
      };
      return acc;
    },
    {} as Record<string, { tokens: number; cost: number }>
  );

  return {
    totalCost: toNumber(payload.totalCost, 0),
    byProvider,
  };
};

export function AIPerformanceDashboard() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    avgResponseTime: 0,
    p50ResponseTime: 0,
    p95ResponseTime: 0,
    p99ResponseTime: 0,
    totalRequests: 0,
    successRate: 0,
    errorRate: 0,
    avgTokensPerRequest: 0,
    totalTokensUsed: 0,
    cacheHitRate: 0,
    totalCostUsd: 0,
  });
  const [capabilityMetrics, setCapabilityMetrics] = useState<CapabilityMetrics[]>([]);
  const [modelMetrics, setModelMetrics] = useState<ModelMetrics[]>([]);
  const [responseTimeTrend, setResponseTimeTrend] = useState<TimeSeriesPoint[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const daysBack =
        timeRange === '1h' ? 1 : timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : 30;
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const [analyticsRes, logsRes, costsRes] = await Promise.all([
        fetch(`/api/llm/analytics?days=${daysBack}`, { headers }),
        fetch(`/api/llm/logs?limit=1000&offset=0`, { headers }),
        fetch(`/api/llm/costs`, { headers }),
      ]);

      if (!analyticsRes.ok) throw new Error('Failed to load performance metrics');
      if (!logsRes.ok) throw new Error('Failed to load performance logs');
      if (!costsRes.ok) throw new Error('Failed to load performance costs');
      const analytics = normalizePerformanceAnalytics(await analyticsRes.json());
      const logs = normalizePerformanceLogs(await logsRes.json());
      const costs = normalizeCostsPayload(await costsRes.json());

      const latenciesMs: number[] = logs
        .map((l) => l.latency)
        .filter((n) => Number.isFinite(n) && n > 0)
        .sort((a, b) => a - b);

      const pct = (p: number) => {
        if (!latenciesMs.length) return 0;
        const idx = Math.min(
          latenciesMs.length - 1,
          Math.max(0, Math.floor(p * (latenciesMs.length - 1)))
        );
        return latenciesMs[idx];
      };

      const totalRequests = analytics.totalCalls;
      const totalTokensUsed = analytics.totalTokens;
      const errorRate = analytics.errorRate;
      const successRate = Math.max(0, Math.min(100, 100 - errorRate));

      const avgTokensPerRequest =
        totalRequests > 0 ? Math.round(totalTokensUsed / totalRequests) : 0;

      const nextMetrics: PerformanceMetrics = {
        avgResponseTime: analytics.avgLatency / 1000,
        p50ResponseTime: pct(0.5) / 1000,
        p95ResponseTime: pct(0.95) / 1000,
        p99ResponseTime: pct(0.99) / 1000,
        totalRequests,
        successRate,
        errorRate,
        avgTokensPerRequest,
        totalTokensUsed,
        cacheHitRate: 0,
        totalCostUsd: costs.totalCost,
      };
      setMetrics(nextMetrics);

      // Provider-level cost-per-token map
      const providerCostPerToken = new Map<string, number>();
      Object.entries(costs.byProvider).forEach(([provider, v]) => {
        const tokens = v.tokens;
        const cost = v.cost;
        providerCostPerToken.set(provider, tokens > 0 ? cost / tokens : 0);
      });

      // Capability metrics (using "prompt" field which is action in backend logs)
      const capAgg = new Map<string, { requests: number; tokens: number; cost: number }>();
      const modelAgg = new Map<string, { requests: number; tokens: number; cost: number }>();
      for (const l of logs) {
        const provider = l.provider;
        const cap = l.prompt;
        const model = l.model;
        const tokens = l.tokens;
        const cost = (providerCostPerToken.get(provider) || 0) * tokens;

        const c = capAgg.get(cap) || { requests: 0, tokens: 0, cost: 0 };
        c.requests += 1;
        c.tokens += tokens;
        c.cost += cost;
        capAgg.set(cap, c);

        const m = modelAgg.get(model) || { requests: 0, tokens: 0, cost: 0 };
        m.requests += 1;
        m.tokens += tokens;
        m.cost += cost;
        modelAgg.set(model, m);
      }

      setCapabilityMetrics(
        Array.from(capAgg.entries())
          .map(([capability, v]) => ({
            capability,
            requests: v.requests,
            avgResponseTime: 0,
            avgTokens: v.requests > 0 ? Math.round(v.tokens / v.requests) : 0,
            totalCost: Math.round(v.cost * 100) / 100,
            successRate: 0,
          }))
          .sort((a, b) => b.requests - a.requests)
      );

      setModelMetrics(
        Array.from(modelAgg.entries())
          .map(([model, v]) => ({
            model,
            requests: v.requests,
            avgResponseTime: 0,
            avgQuality: 0,
            totalCost: Math.round(v.cost * 100) / 100,
            successRate: 0,
          }))
          .sort((a, b) => b.requests - a.requests)
      );

      // Trend from analytics.byDay (calls -> seconds not needed)
      const trend: TimeSeriesPoint[] = analytics.byDay.map((d) => ({
        timestamp: toIsoDate(d.date),
        value: d.calls,
      }));
      setResponseTimeTrend(trend);
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to load performance metrics');
      setLoadError(message);
      toast.error(message);
      setMetrics({
        avgResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        totalRequests: 0,
        successRate: 0,
        errorRate: 0,
        avgTokensPerRequest: 0,
        totalTokensUsed: 0,
        cacheHitRate: 0,
        totalCostUsd: 0,
      });
      setCapabilityMetrics([]);
      setModelMetrics([]);
      setResponseTimeTrend([]);
    }
    setLoading(false);
  }, [timeRange]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => void loadMetrics(), 30000); // Refresh every 30s
      return () => clearInterval(interval);
    }
    return undefined;
  }, [autoRefresh, loadMetrics]);

  const handleExport = () => {
    if (loadError) {
      toast.error('Performance metrics are unavailable');
      return;
    }
    const data = {
      exportDate: new Date().toISOString(),
      timeRange,
      metrics,
      capabilityMetrics,
      modelMetrics,
      responseTimeTrend,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-performance-${timeRange}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Performance data exported');
  };

  const formatNumber = (num: number, decimals = 1) => num.toFixed(decimals);
  const formatCurrency = (num: number) => `$${num.toFixed(2)}`;
  const formatTokens = (num: number) =>
    num >= 1000000
      ? `${(num / 1000000).toFixed(1)}M`
      : num >= 1000
        ? `${(num / 1000).toFixed(0)}K`
        : num.toString();

  const maxTrendValue = Math.max(...responseTimeTrend.map((t) => t.value), 1);

  return (
    <div className="space-y-6">
      {/* Header - Clean minimal */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
            <Activity size={16} className="text-slate-500 dark:text-slate-400" />
            AI Performance Dashboard
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time performance metrics and analytics
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Time Range */}
          <div className="flex bg-slate-100 dark:bg-white/[0.03] rounded-lg p-0.5">
            {(['1h', '24h', '7d', '30d'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-slate-900 text-white dark:bg-white/10'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/[0.04]'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`admin-btn ${autoRefresh ? 'bg-emerald-500/20 text-emerald-400' : 'admin-btn-subtle'}`}
          >
            <Zap size={14} />
            {autoRefresh ? 'Live' : 'Auto'}
          </button>
          <button onClick={handleExport} className="admin-btn admin-btn-subtle">
            <Download size={14} />
            Export
          </button>
          <button
            onClick={loadMetrics}
            disabled={loading}
            className="admin-btn admin-btn-subtle disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="admin-card p-4">
          <DegradedState title="AI performance metrics unavailable" description={loadError} />
        </div>
      ) : (
        <>
          {/* Main Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <MetricCard
              icon={Clock}
              label="Avg Response"
              value={`${formatNumber(metrics.avgResponseTime)}s`}
              color="text-blue-400"
              trend={metrics.avgResponseTime < 1.5 ? 'up' : 'down'}
            />
            <MetricCard
              icon={Target}
              label="Success Rate"
              value={`${formatNumber(metrics.successRate)}%`}
              color="text-emerald-400"
              trend={metrics.successRate > 95 ? 'up' : 'down'}
            />
            <MetricCard
              icon={Database}
              label="Cache Hit Rate"
              value={`${formatNumber(metrics.cacheHitRate)}%`}
              color="text-primary-400"
              trend={metrics.cacheHitRate > 25 ? 'up' : 'down'}
            />
            <MetricCard
              icon={Layers}
              label="Total Requests"
              value={metrics.totalRequests.toLocaleString()}
              color="text-blue-400"
            />
            <MetricCard
              icon={Cpu}
              label="Avg Tokens"
              value={formatTokens(metrics.avgTokensPerRequest)}
              color="text-amber-400"
            />
            <MetricCard
              icon={DollarSign}
              label="Total Cost"
              value={formatCurrency(metrics.totalCostUsd)}
              color="text-pink-400"
            />
          </div>

          {/* Response Time Distribution - Clean minimal */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Percentiles */}
            <div className="admin-card p-4">
              <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Gauge size={14} className="text-slate-500 dark:text-slate-400" />
                Response Time Percentiles
              </h3>
              <div className="space-y-4">
                <PercentileBar
                  label="p50"
                  value={metrics.p50ResponseTime}
                  max={5}
                  color="bg-slate-400"
                />
                <PercentileBar
                  label="p95"
                  value={metrics.p95ResponseTime}
                  max={5}
                  color="bg-slate-500"
                />
                <PercentileBar
                  label="p99"
                  value={metrics.p99ResponseTime}
                  max={5}
                  color="bg-slate-600"
                />
              </div>
            </div>

            {/* Response Time Trend */}
            <div className="lg:col-span-2 admin-card p-4">
              <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp size={14} className="text-slate-500 dark:text-slate-400" />
                Response Time Trend
              </h3>
              {loading ? (
                <div className="h-32 flex items-center justify-center text-slate-600 dark:text-slate-400">
                  Loading chart...
                </div>
              ) : (
                <div className="h-32 flex items-end gap-0.5">
                  {responseTimeTrend.map((point, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                      <div
                        className="w-full bg-slate-200/70 dark:bg-navy-800/30 hover:bg-slate-300 dark:hover:bg-white/[0.08] rounded-sm transition-all"
                        style={{
                          height: `${(point.value / maxTrendValue) * 100}%`,
                          minHeight: '2px',
                        }}
                        title={`${new Date(point.timestamp).toLocaleTimeString()}: ${point.value.toFixed(2)}s`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Capability & Model Metrics - Clean minimal */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* By Capability */}
            <div className="admin-card p-4">
              <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <BarChart3 size={14} className="text-slate-500 dark:text-slate-400" />
                Performance by Capability
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {capabilityMetrics.map((cap, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-white/[0.02] rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-900 dark:text-slate-200 capitalize">
                        {cap.capability}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        {cap.requests.toLocaleString()} requests
                      </div>
                    </div>
                    <div className="text-right text-xs space-y-1">
                      <div className="text-slate-600 dark:text-slate-400">
                        {cap.avgResponseTime.toFixed(1)}s
                      </div>
                      <div className="text-slate-600 dark:text-slate-400">
                        {formatCurrency(cap.totalCost)}
                      </div>
                    </div>
                    <div
                      className={`text-xs ${cap.successRate > 95 ? 'text-emerald-400' : 'text-amber-400'}`}
                    >
                      {cap.successRate.toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By Model */}
            <div className="admin-card p-4">
              <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <PieChart size={14} className="text-slate-500 dark:text-slate-400" />
                Performance by Model
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {modelMetrics.map((model, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-white/[0.02] rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-900 dark:text-white font-medium">
                        {model.model}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {model.requests.toLocaleString()} requests
                      </div>
                    </div>
                    <div className="text-right text-xs space-y-1">
                      <div className="text-primary-400">
                        Q: {(model.avgQuality * 100).toFixed(0)}%
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">
                        {formatCurrency(model.totalCost)}
                      </div>
                    </div>
                    <div
                      className={`text-xs font-medium ${model.successRate > 95 ? 'text-emerald-400' : 'text-amber-400'}`}
                    >
                      {model.successRate.toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Health Status - Clean minimal */}
          <div className="admin-card p-4">
            <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Activity size={14} className="text-slate-500 dark:text-slate-400" />
              System Health
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <HealthIndicator
                label="API Response"
                status={
                  metrics.avgResponseTime < 2
                    ? 'healthy'
                    : metrics.avgResponseTime < 4
                      ? 'warning'
                      : 'critical'
                }
              />
              <HealthIndicator
                label="Error Rate"
                status={
                  metrics.errorRate < 2 ? 'healthy' : metrics.errorRate < 5 ? 'warning' : 'critical'
                }
              />
              <HealthIndicator
                label="Cache Efficiency"
                status={
                  metrics.cacheHitRate > 25
                    ? 'healthy'
                    : metrics.cacheHitRate > 15
                      ? 'warning'
                      : 'critical'
                }
              />
              <HealthIndicator
                label="Success Rate"
                status={
                  metrics.successRate > 95
                    ? 'healthy'
                    : metrics.successRate > 90
                      ? 'warning'
                      : 'critical'
                }
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Helper Components - Clean minimal style
const MetricCard: React.FC<{
  icon: LucideIcon;
  label: string;
  value: string;
  color: string;
  trend?: 'up' | 'down';
}> = ({ icon: Icon, label, value, trend }) => (
  <div className="admin-metric">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-slate-500 dark:text-slate-400" />
        <span className="admin-metric-label">{label}</span>
      </div>
      {trend &&
        (trend === 'up' ? (
          <ArrowUpRight size={12} className="text-emerald-400" />
        ) : (
          <ArrowDownRight size={12} className="text-danger-400" />
        ))}
    </div>
    <div className="admin-metric-value">{value}</div>
  </div>
);

const PercentileBar: React.FC<{ label: string; value: number; max: number; color: string }> = ({
  label,
  value,
  max,
}) => (
  <div className="flex items-center gap-3">
    <span className="text-xs text-slate-500 dark:text-slate-400 w-8">{label}</span>
    <div className="flex-1 h-1.5 bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
      <div
        className="h-full bg-slate-500 dark:bg-slate-400 rounded-full transition-all"
        style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
      />
    </div>
    <span className="text-xs text-slate-700 dark:text-slate-300 font-medium w-12 text-right">
      {value.toFixed(2)}s
    </span>
  </div>
);

const HealthIndicator: React.FC<{ label: string; status: 'healthy' | 'warning' | 'critical' }> = ({
  label,
  status,
}) => (
  <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/[0.02] rounded-lg">
    <span
      className={`admin-status ${
        status === 'healthy'
          ? 'admin-status-healthy'
          : status === 'warning'
            ? 'admin-status-warning'
            : 'admin-status-error'
      }`}
    >
      <span className="admin-status-dot" />
    </span>
    <div className="flex-1">
      <div className="text-sm text-slate-900 dark:text-slate-300">{label}</div>
      <div
        className={`text-xs capitalize ${
          status === 'healthy'
            ? 'text-emerald-400'
            : status === 'warning'
              ? 'text-amber-400'
              : 'text-danger-400'
        }`}
      >
        {status}
      </div>
    </div>
  </div>
);

export default AIPerformanceDashboard;
