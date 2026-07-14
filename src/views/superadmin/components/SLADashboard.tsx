/**
 * SLA Dashboard Component
 *
 * Monitors Service Level Agreement metrics for AI services.
 * Features:
 * - Uptime percentage (99.9% SLA target)
 * - Response time P50/P95/P99 vs targets
 * - Error rate tracking
 * - Historical availability chart
 * - SLA breach alerts and history
 * - Compliance status indicators
 */

import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Bell,
  CheckCircle,
  Clock,
  Download,
  Info,
  type LucideIcon,
  RefreshCw,
  Shield,
  Target,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { DegradedState } from '../../../components/Admin/AdminState';

interface SLAMetrics {
  uptimePercentage: number;
  uptimeTarget: number;
  responseTimeP50: number;
  responseTimeP95: number;
  responseTimeP99: number;
  responseTimeTargetP95: number;
  responseTimeTargetP99: number;
  errorRate: number;
  errorRateTarget: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  slaCompliant: boolean;
  lastCalculated: string;
}

interface SLABreach {
  id: string;
  timestamp: string;
  metric: string;
  threshold: number;
  actual: number;
  severity: 'warning' | 'critical';
  resolved: boolean;
  resolvedAt?: string;
  duration: number;
}

interface UptimeDataPoint {
  date: string;
  uptime: number;
  incidents: number;
}

type TimeRange = '24h' | '7d' | '30d' | '90d';

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

const normalizeAnalyticsPayload = (value: unknown) => {
  const payload = getObjectPayload(value);
  if (
    !isRecord(payload) ||
    !('totalCalls' in payload) ||
    !('errorRate' in payload) ||
    !('avgLatency' in payload)
  ) {
    throw new Error('SLA analytics response was incomplete');
  }

  return {
    totalCalls: toNumber(payload.totalCalls, 0),
    errorRate: toNumber(payload.errorRate, 0),
    avgLatency: toNumber(payload.avgLatency, 0),
    byDay: Array.isArray(payload.byDay)
      ? payload.byDay.filter(isRecord).map((day) => ({
          date: asText(day.date, ''),
        }))
      : [],
  };
};

const normalizeLogsPayload = (value: unknown) => {
  const payload = getObjectPayload(value);
  if (!isRecord(payload) || !Array.isArray(payload.logs)) {
    throw new Error('SLA logs response was not a list');
  }

  return payload.logs
    .filter(isRecord)
    .map((log) => ({
      latency: toNumber(log.latency, 0),
    }))
    .filter((log) => log.latency > 0);
};

export function SLADashboard() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [metrics, setMetrics] = useState<SLAMetrics>({
    uptimePercentage: 99.95,
    uptimeTarget: 99.9,
    responseTimeP50: 0.8,
    responseTimeP95: 2.1,
    responseTimeP99: 3.8,
    responseTimeTargetP95: 3.0,
    responseTimeTargetP99: 5.0,
    errorRate: 0.12,
    errorRateTarget: 1.0,
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageLatency: 0,
    slaCompliant: true,
    lastCalculated: new Date().toISOString(),
  });
  const [breaches, setBreaches] = useState<SLABreach[]>([]);
  const [uptimeHistory, setUptimeHistory] = useState<UptimeDataPoint[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSLAData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const daysBack =
        timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const [analyticsRes, logsRes] = await Promise.all([
        fetch(`/api/llm/analytics?days=${daysBack}`, { headers }),
        fetch(`/api/llm/logs?limit=1000&offset=0`, { headers }),
      ]);

      if (!analyticsRes.ok) throw new Error('Failed to load SLA analytics');
      if (!logsRes.ok) throw new Error('Failed to load SLA logs');
      const analytics = normalizeAnalyticsPayload(await analyticsRes.json());
      const logs = normalizeLogsPayload(await logsRes.json());

      const latenciesMs: number[] = logs
        .map((log) => log.latency)
        .sort((a: number, b: number) => a - b);

      const pct = (p: number) => {
        if (!latenciesMs.length) return 0;
        const idx = Math.min(
          latenciesMs.length - 1,
          Math.max(0, Math.floor(p * (latenciesMs.length - 1)))
        );
        return latenciesMs[idx];
      };

      const totalRequests = analytics.totalCalls;
      const errorRate = analytics.errorRate; // percent
      const successRate = Math.max(0, Math.min(100, 100 - errorRate));

      const p50 = pct(0.5) / 1000;
      const p95 = pct(0.95) / 1000;
      const p99 = pct(0.99) / 1000;

      const nextMetrics: SLAMetrics = {
        uptimePercentage: Math.round(successRate * 100) / 100,
        uptimeTarget: 99.9,
        responseTimeP50: Math.round(p50 * 100) / 100,
        responseTimeP95: Math.round(p95 * 100) / 100,
        responseTimeP99: Math.round(p99 * 100) / 100,
        responseTimeTargetP95: 3.0,
        responseTimeTargetP99: 5.0,
        errorRate: Math.round(errorRate * 100) / 100,
        errorRateTarget: 1.0,
        totalRequests,
        successfulRequests: Math.round((successRate / 100) * totalRequests),
        failedRequests: Math.round((errorRate / 100) * totalRequests),
        averageLatency: analytics.avgLatency / 1000,
        slaCompliant: successRate >= 99.9 && errorRate <= 1.0 && p95 <= 3.0 && p99 <= 5.0,
        lastCalculated: new Date().toISOString(),
      };
      setMetrics(nextMetrics);

      const b: SLABreach[] = [];
      const now = Date.now();
      const pushBreach = (
        metric: string,
        threshold: number,
        actual: number,
        severity: 'warning' | 'critical'
      ) => {
        b.push({
          id: `breach-${metric.replace(/\s+/g, '-').toLowerCase()}`,
          timestamp: new Date(now).toISOString(),
          metric,
          threshold,
          actual,
          severity,
          resolved: false,
          duration: 0,
        });
      };
      if (nextMetrics.uptimePercentage < nextMetrics.uptimeTarget) {
        pushBreach('Uptime', nextMetrics.uptimeTarget, nextMetrics.uptimePercentage, 'critical');
      }
      if (nextMetrics.responseTimeP95 > nextMetrics.responseTimeTargetP95) {
        pushBreach(
          'Response Time P95',
          nextMetrics.responseTimeTargetP95,
          nextMetrics.responseTimeP95,
          'warning'
        );
      }
      if (nextMetrics.responseTimeP99 > nextMetrics.responseTimeTargetP99) {
        pushBreach(
          'Response Time P99',
          nextMetrics.responseTimeTargetP99,
          nextMetrics.responseTimeP99,
          'critical'
        );
      }
      if (nextMetrics.errorRate > nextMetrics.errorRateTarget) {
        pushBreach('Error Rate', nextMetrics.errorRateTarget, nextMetrics.errorRate, 'critical');
      }
      setBreaches(b);

      const history: UptimeDataPoint[] = analytics.byDay.map((d) => ({
        date: d.date,
        uptime: Math.round(successRate * 100) / 100,
        incidents: 0,
      }));
      setUptimeHistory(history);
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to load SLA metrics');
      setLoadError(message);
      toast.error(message);
      setMetrics({
        uptimePercentage: 0,
        uptimeTarget: 99.9,
        responseTimeP50: 0,
        responseTimeP95: 0,
        responseTimeP99: 0,
        responseTimeTargetP95: 3.0,
        responseTimeTargetP99: 5.0,
        errorRate: 0,
        errorRateTarget: 1.0,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageLatency: 0,
        slaCompliant: false,
        lastCalculated: new Date().toISOString(),
      });
      setBreaches([]);
      setUptimeHistory([]);
    }
    setLoading(false);
  }, [timeRange]);

  useEffect(() => {
    loadSLAData();
  }, [loadSLAData]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => void loadSLAData(), 60000); // Refresh every 60s
      return () => clearInterval(interval);
    }
    return undefined;
  }, [autoRefresh, loadSLAData]);

  const handleExport = () => {
    if (loadError) {
      toast.error('SLA metrics are unavailable');
      return;
    }
    const data = {
      exportDate: new Date().toISOString(),
      timeRange,
      metrics,
      breaches,
      uptimeHistory,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sla-report-${timeRange}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('SLA report exported');
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return timeRange === '24h'
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleString();
  };

  const getComplianceStatus = (actual: number, target: number, isLowerBetter: boolean = true) => {
    if (isLowerBetter) {
      return actual <= target ? 'compliant' : 'breach';
    }
    return actual >= target ? 'compliant' : 'breach';
  };

  const activeBreaches = breaches.filter((b) => !b.resolved);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield size={24} className="text-emerald-400" />
            SLA Dashboard
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            Service Level Agreement monitoring and compliance
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time Range */}
          <div className="flex bg-slate-50 dark:bg-navy-800 rounded-lg p-1">
            {(['24h', '7d', '30d', '90d'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              autoRefresh
                ? 'bg-emerald-600 text-slate-900 dark:text-white'
                : 'bg-slate-50 dark:bg-navy-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700'
            }`}
          >
            <Zap size={14} />
            {autoRefresh ? 'Live' : 'Auto'}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={14} />
            Export
          </button>
          <button
            onClick={loadSLAData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
          <DegradedState title="SLA metrics unavailable" description={loadError} />
        </div>
      ) : (
        <>
          {/* Overall SLA Status */}
          <div
            className={`rounded-xl p-6 border ${
              metrics.slaCompliant
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-500/30'
                : 'bg-danger-50 dark:bg-danger-900/20 border-danger-200 dark:border-danger-500/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {metrics.slaCompliant ? (
                  <div className="p-3 bg-emerald-500/20 rounded-full">
                    <CheckCircle size={32} className="text-emerald-400" />
                  </div>
                ) : (
                  <div className="p-3 bg-danger-500/20 rounded-full">
                    <AlertOctagon size={32} className="text-danger-400" />
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {metrics.slaCompliant ? 'SLA Compliant' : 'SLA Breach Detected'}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {metrics.slaCompliant
                      ? 'All service level objectives are being met'
                      : `${activeBreaches.length} active breach(es) require attention`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-slate-900 dark:text-white">
                  {metrics.uptimePercentage.toFixed(3)}%
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Current Uptime (Target: {metrics.uptimeTarget}%)
                </div>
              </div>
            </div>
          </div>

          {/* Main Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Uptime */}
            <SLAMetricCard
              icon={Activity}
              label="Uptime"
              value={`${metrics.uptimePercentage.toFixed(3)}%`}
              target={`Target: ${metrics.uptimeTarget}%`}
              status={getComplianceStatus(metrics.uptimePercentage, metrics.uptimeTarget, false)}
              color="emerald"
            />

            {/* Response Time P95 */}
            <SLAMetricCard
              icon={Clock}
              label="Response Time P95"
              value={`${metrics.responseTimeP95.toFixed(2)}s`}
              target={`Target: <${metrics.responseTimeTargetP95}s`}
              status={getComplianceStatus(metrics.responseTimeP95, metrics.responseTimeTargetP95)}
              color="cyan"
            />

            {/* Response Time P99 */}
            <SLAMetricCard
              icon={Clock}
              label="Response Time P99"
              value={`${metrics.responseTimeP99.toFixed(2)}s`}
              target={`Target: <${metrics.responseTimeTargetP99}s`}
              status={getComplianceStatus(metrics.responseTimeP99, metrics.responseTimeTargetP99)}
              color="purple"
            />

            {/* Error Rate */}
            <SLAMetricCard
              icon={AlertTriangle}
              label="Error Rate"
              value={`${metrics.errorRate.toFixed(2)}%`}
              target={`Target: <${metrics.errorRateTarget}%`}
              status={getComplianceStatus(metrics.errorRate, metrics.errorRateTarget)}
              color="amber"
            />
          </div>

          {/* Detailed Stats and Uptime Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Request Statistics */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Target size={18} className="text-blue-400" />
                Request Statistics
              </h3>
              <div className="space-y-4">
                <StatRow label="Total Requests" value={metrics.totalRequests.toLocaleString()} />
                <StatRow
                  label="Successful"
                  value={metrics.successfulRequests.toLocaleString()}
                  color="text-emerald-400"
                />
                <StatRow
                  label="Failed"
                  value={metrics.failedRequests.toLocaleString()}
                  color="text-danger-400"
                />
                <StatRow
                  label="Avg Latency"
                  value={`${metrics.averageLatency.toFixed(2)}s`}
                  color="text-blue-400"
                />
                <div className="pt-3 border-t border-slate-200 dark:border-white/10">
                  <StatRow
                    label="Success Rate"
                    value={`${
                      metrics.totalRequests > 0
                        ? ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)
                        : '0.00'
                    }%`}
                    color="text-emerald-400"
                  />
                </div>
              </div>
            </div>

            {/* Uptime History Chart */}
            <div className="lg:col-span-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-emerald-400" />
                Uptime History
              </h3>
              {loading ? (
                <div className="h-40 flex items-center justify-center text-slate-500 dark:text-slate-400">
                  Loading chart...
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="h-40 flex items-end gap-1">
                    {uptimeHistory.map((point, idx) => {
                      const height = ((point.uptime - 95) / 5) * 100; // Scale 95-100% to 0-100%
                      const isGood = point.uptime >= 99.9;
                      return (
                        <div
                          key={idx}
                          className="flex-1 flex flex-col items-center gap-1 group cursor-pointer"
                          title={`${formatDate(point.date)}: ${point.uptime.toFixed(2)}% uptime${point.incidents > 0 ? `, ${point.incidents} incident(s)` : ''}`}
                        >
                          <div
                            className={`w-full rounded-t transition-all ${
                              isGood
                                ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 group-hover:from-emerald-500'
                                : 'bg-gradient-to-t from-amber-600 to-amber-400 group-hover:from-amber-500'
                            }`}
                            style={{ height: `${Math.max(height, 5)}%` }}
                          />
                          {point.incidents > 0 && (
                            <div className="absolute -top-1 w-2 h-2 bg-danger-500 rounded-full" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                    <span>{formatDate(uptimeHistory[0]?.date || '')}</span>
                    <span>99.9% SLA Target</span>
                    <span>{formatDate(uptimeHistory[uptimeHistory.length - 1]?.date || '')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SLA Breach Alerts */}
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Bell size={18} className="text-amber-400" />
              SLA Breach History
              {activeBreaches.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-danger-500/20 text-danger-400 text-xs rounded-full">
                  {activeBreaches.length} Active
                </span>
              )}
            </h3>

            {breaches.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-slate-500 dark:text-slate-400">
                <Info size={18} className="mr-2" />
                No SLA breaches recorded in this period
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {breaches.map((breach) => (
                  <div
                    key={breach.id}
                    className={`flex items-center gap-4 p-4 rounded-lg ${
                      breach.resolved
                        ? 'bg-slate-100 dark:bg-navy-950/50'
                        : breach.severity === 'critical'
                          ? 'bg-danger-900/20 border border-danger-500/30'
                          : 'bg-amber-900/20 border border-amber-500/30'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-full ${
                        breach.resolved
                          ? 'bg-slate-300 dark:bg-slate-700'
                          : breach.severity === 'critical'
                            ? 'bg-danger-500/20'
                            : 'bg-amber-500/20'
                      }`}
                    >
                      {breach.resolved ? (
                        <CheckCircle size={16} className="text-slate-600 dark:text-slate-500" />
                      ) : breach.severity === 'critical' ? (
                        <XCircle size={16} className="text-danger-400" />
                      ) : (
                        <AlertTriangle size={16} className="text-amber-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {breach.metric}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            breach.severity === 'critical'
                              ? 'bg-danger-500/20 text-danger-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {breach.severity}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-500 mt-1">
                        Threshold: {breach.threshold} | Actual: {breach.actual}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-600 dark:text-slate-500">
                        {formatDateTime(breach.timestamp)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Duration: {breach.duration} min
                      </div>
                    </div>
                    {breach.resolved && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                        Resolved
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SLA Targets Reference */}
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Target size={18} className="text-primary-400" />
              SLA Targets Reference
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <SLATargetCard
                metric="Uptime"
                target="≥ 99.9%"
                description="Monthly service availability"
              />
              <SLATargetCard
                metric="Response Time P95"
                target="< 3.0s"
                description="95th percentile latency"
              />
              <SLATargetCard
                metric="Response Time P99"
                target="< 5.0s"
                description="99th percentile latency"
              />
              <SLATargetCard
                metric="Error Rate"
                target="< 1.0%"
                description="Failed requests percentage"
              />
            </div>
          </div>

          {/* Last Updated */}
          <div className="text-center text-xs text-slate-500 dark:text-slate-400">
            Last calculated: {formatDateTime(metrics.lastCalculated)}
          </div>
        </>
      )}
    </div>
  );
}

// Helper Components
const SLAMetricCard: React.FC<{
  icon: LucideIcon;
  label: string;
  value: string;
  target: string;
  status: 'compliant' | 'breach';
  color: string;
}> = ({ icon: Icon, label, value, target, status, color }) => (
  <div
    className={`bg-white dark:bg-navy-900 border rounded-xl p-4 ${
      status === 'compliant' ? 'border-slate-200 dark:border-white/10' : 'border-danger-500/30'
    }`}
  >
    <div className="flex items-center justify-between mb-3">
      <div className={`p-2 rounded-lg bg-${color}-500/20`}>
        <Icon size={18} className={`text-${color}-400`} />
      </div>
      {status === 'compliant' ? (
        <CheckCircle size={16} className="text-emerald-400" />
      ) : (
        <XCircle size={16} className="text-danger-400" />
      )}
    </div>
    <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{value}</div>
    <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
      {label}
    </div>
    <div
      className={`text-xs mt-2 ${status === 'compliant' ? 'text-emerald-400' : 'text-danger-400'}`}
    >
      {target}
    </div>
  </div>
);

const StatRow: React.FC<{
  label: string;
  value: string;
  color?: string;
}> = ({ label, value, color = 'text-slate-900 dark:text-white' }) => (
  <div className="flex justify-between items-center">
    <span className="text-sm text-slate-600 dark:text-slate-500">{label}</span>
    <span className={`text-sm font-medium ${color}`}>{value}</span>
  </div>
);

const SLATargetCard: React.FC<{
  metric: string;
  target: string;
  description: string;
}> = ({ metric, target, description }) => (
  <div className="p-4 bg-slate-100 dark:bg-navy-950/50 rounded-lg">
    <div className="text-sm font-medium text-slate-900 dark:text-white">{metric}</div>
    <div className="text-lg font-bold text-primary-400 mt-1">{target}</div>
    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</div>
  </div>
);

export default SLADashboard;
