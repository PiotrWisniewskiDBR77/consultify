/**
 * IntegrationAnalyticsSettings - Analytics Dashboard for Integrations
 *
 * Features:
 * - Usage statistics with charts
 * - Error logs with filtering
 * - Performance metrics
 * - Historical data visualization
 * - Export to CSV
 */

import {
  AlertCircle,
  BarChart3,
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  Filter,
  Loader2,
  RefreshCw,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EmptyState } from '@/components/ui/composed';
import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../services/api';

interface IntegrationAnalyticsSettingsProps {
  className?: string;
  currentUser?: any;
}

interface UsageStats {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  total_tokens: number;
  total_cost: number;
  avg_response_time_ms: number;
  max_response_time_ms: number;
  min_response_time_ms: number;
  success_rate: string;
}

interface PerformanceMetric {
  date: string;
  requests: number;
  avg_latency: number;
  max_latency: number;
  successes: number;
  failures: number;
}

interface LogEntry {
  id: string;
  endpoint: string;
  method: string;
  status_code: number;
  error_message?: string;
  response_time_ms: number;
  tokens_used?: number;
  cost?: number;
  created_at: string;
  logType: 'success' | 'error';
}

export const IntegrationAnalyticsSettings: React.FC<IntegrationAnalyticsSettingsProps> = ({
  className = '',
  currentUser,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [period, setPeriod] = useState<'1d' | '7d' | '30d' | '90d'>('7d');
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<'all' | 'errors' | 'success'>('all');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchIntegrations();
  }, []);

  useEffect(() => {
    if (selectedIntegration) {
      fetchAnalytics();
    }
  }, [selectedIntegration, period]);

  const fetchIntegrations = async () => {
    try {
      if (!currentUser?.organizationId) return;

      const data = await Api.get(
        `/api/settings/integrations?organizationId=${currentUser.organizationId}`
      );
      setIntegrations(data || []);

      if (data && data.length > 0 && !selectedIntegration) {
        setSelectedIntegration(data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
      toast.error(t('settings.analytics.fetchError', 'Failed to load integrations'));
    }
  };

  const fetchAnalytics = async () => {
    if (!selectedIntegration) return;

    setLoading(true);
    try {
      const [analyticsData, logsData] = await Promise.all([
        Api.get(
          `/api/settings/integrations/analytics?integrationId=${selectedIntegration}&period=${period}`
        ),
        Api.get(
          `/api/settings/integrations/${selectedIntegration}/logs?limit=100&type=${logFilter}`
        ),
      ]);

      if (analyticsData?.stats) {
        setStats(analyticsData.stats);
      }
      if (analyticsData?.metrics) {
        setMetrics(analyticsData.metrics);
      }
      if (logsData?.logs) {
        setLogs(logsData.logs);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      toast.error(t('settings.analytics.fetchError', 'Failed to load analytics'));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!selectedIntegration || !logs.length) {
      toast.error(t('settings.analytics.noData', 'No data to export'));
      return;
    }

    setExporting(true);
    try {
      const csv = [
        [
          'Timestamp',
          'Endpoint',
          'Method',
          'Status',
          'Response Time (ms)',
          'Tokens',
          'Cost',
          'Error',
        ].join(','),
        ...logs.map((log) =>
          [
            log.created_at,
            log.endpoint,
            log.method,
            log.status_code,
            log.response_time_ms,
            log.tokens_used || 0,
            log.cost || 0,
            log.error_message || '',
          ]
            .map((field) => `"${field}"`)
            .join(',')
        ),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `integration-analytics-${selectedIntegration}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success(t('settings.analytics.exported', 'Data exported successfully'));
    } catch (error) {
      toast.error(t('settings.analytics.exportError', 'Failed to export data'));
    } finally {
      setExporting(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading && !stats) {
    return <LoadingState variant="spinner" className={className} />;
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-c-text flex items-center gap-2">
            <BarChart3 size={20} />
            {t('settings.analytics.title', 'Integration Analytics')}
          </h3>
          <p className="text-sm text-c-text-muted mt-1">
            {t(
              'settings.analytics.description',
              'Monitor usage, performance, and errors for your integrations'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAnalytics}
            className="p-2 text-c-text-secondary hover:text-brand rounded-lg hover:bg-c-surface-raised dark:hover:bg-navy-700 transition-colors"
            title={t('common.refresh', 'Refresh')}
          >
            <RefreshCw size={18} />
          </button>
          {logs.length > 0 && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-c-text-secondary hover:text-brand border border-c-border-subtle dark:border-navy-700 rounded-lg hover:bg-c-surface-raised dark:hover:bg-navy-700 transition-colors disabled:opacity-50"
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {t('settings.analytics.export', 'Export CSV')}
            </button>
          )}
        </div>
      </div>

      {/* Integration Selector */}
      {integrations.length > 0 && (
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-c-text-secondary">
            {t('settings.analytics.integration', 'Integration')}:
          </label>
          <select
            value={selectedIntegration || ''}
            onChange={(e) => setSelectedIntegration(e.target.value)}
            className="px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text focus:outline-none focus:ring-2 focus:ring-[color:var(--c-focus)]"
          >
            {integrations.map((int) => (
              <option key={int.id} value={int.id}>
                {int.provider} {int.name ? `- ${int.name}` : ''}
              </option>
            ))}
          </select>

          <label className="text-sm font-medium text-c-text-secondary ml-4">
            {t('settings.analytics.period', 'Period')}:
          </label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="px-3 py-2 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-lg text-c-text focus:outline-none focus:ring-2 focus:ring-[color:var(--c-focus)]"
          >
            <option value="1d">{t('settings.analytics.periods.1d', 'Last 24 hours')}</option>
            <option value="7d">{t('settings.analytics.periods.7d', 'Last 7 days')}</option>
            <option value="30d">{t('settings.analytics.periods.30d', 'Last 30 days')}</option>
            <option value="90d">{t('settings.analytics.periods.90d', 'Last 90 days')}</option>
          </select>
        </div>
      )}

      {!selectedIntegration && integrations.length === 0 && (
        <EmptyState
          icon={<BarChart3 />}
          title={t(
            'settings.analytics.noIntegrations',
            'No integrations available. Connect an integration to see analytics.'
          )}
        />
      )}

      {selectedIntegration && stats && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-c-surface rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-c-text-muted">
                  {t('settings.analytics.totalRequests', 'Total Requests')}
                </span>
                <TrendingUp size={16} className="text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-c-text">
                {formatNumber(stats.total_requests)}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                {stats.success_rate}% {t('settings.analytics.successRate', 'success rate')}
              </p>
            </div>

            <div className="p-4 bg-c-surface rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-c-text-muted">
                  {t('settings.analytics.avgLatency', 'Avg Latency')}
                </span>
                <Clock size={16} className="text-c-accent" />
              </div>
              <p className="text-2xl font-bold text-c-text">
                {Math.round(stats.avg_response_time_ms)}ms
              </p>
              <p className="text-xs text-c-text-muted mt-1">
                {t('settings.analytics.range', 'Range')}: {stats.min_response_time_ms}ms -{' '}
                {stats.max_response_time_ms}ms
              </p>
            </div>

            <div className="p-4 bg-c-surface rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-c-text-muted">
                  {t('settings.analytics.totalCost', 'Total Cost')}
                </span>
                <DollarSign size={16} className="text-green-500" />
              </div>
              <p className="text-2xl font-bold text-c-text">
                {formatCurrency(stats.total_cost)}
              </p>
              <p className="text-xs text-c-text-muted mt-1">
                {formatNumber(stats.total_tokens)} {t('settings.analytics.tokens', 'tokens')}
              </p>
            </div>

            <div className="p-4 bg-c-surface rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-c-text-muted">
                  {t('settings.analytics.errors', 'Errors')}
                </span>
                <AlertCircle size={16} className="text-rose-500" />
              </div>
              <p className="text-2xl font-bold text-c-text">
                {formatNumber(stats.failed_requests)}
              </p>
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                {stats.total_requests > 0
                  ? ((stats.failed_requests / stats.total_requests) * 100).toFixed(1)
                  : 0}
                % {t('settings.analytics.failureRate', 'failure rate')}
              </p>
            </div>
          </div>

          {/* Charts */}
          {metrics.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Requests Over Time */}
              <div className="p-6 bg-c-surface rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700">
                <h4 className="text-sm font-semibold text-c-text mb-4">
                  {t('settings.analytics.requestsOverTime', 'Requests Over Time')}
                </h4>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border-subtle)" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--c-text-muted)" />
                    <YAxis tick={{ fontSize: 12 }} stroke="var(--c-text-muted)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--c-surface)',
                        border: '1px solid var(--c-border-subtle)',
                        borderRadius: '8px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="requests"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Latency Over Time */}
              <div className="p-6 bg-c-surface rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700">
                <h4 className="text-sm font-semibold text-c-text mb-4">
                  {t('settings.analytics.latencyOverTime', 'Latency Over Time')}
                </h4>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border-subtle)" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--c-text-muted)" />
                    <YAxis tick={{ fontSize: 12 }} stroke="var(--c-text-muted)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--c-surface)',
                        border: '1px solid var(--c-border-subtle)',
                        borderRadius: '8px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avg_latency"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="max_latency"
                      stroke="#f43f5e"
                      strokeWidth={1}
                      strokeDasharray="5 5"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Success vs Failures */}
              <div className="p-6 bg-c-surface rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 lg:col-span-2">
                <h4 className="text-sm font-semibold text-c-text mb-4">
                  {t('settings.analytics.successVsFailures', 'Success vs Failures')}
                </h4>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border-subtle)" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--c-text-muted)" />
                    <YAxis tick={{ fontSize: 12 }} stroke="var(--c-text-muted)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--c-surface)',
                        border: '1px solid var(--c-border-subtle)',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="successes"
                      fill="#10b981"
                      name={t('settings.analytics.successes', 'Successes')}
                    />
                    <Bar
                      dataKey="failures"
                      fill="#f43f5e"
                      name={t('settings.analytics.failures', 'Failures')}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Logs Table */}
          <div className="bg-c-surface rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700">
            <div className="p-4 border-b border-c-border-subtle dark:border-navy-700 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-c-text">
                {t('settings.analytics.recentLogs', 'Recent Logs')}
              </h4>
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-c-text-secondary" />
                <select
                  value={logFilter}
                  onChange={(e) => {
                    setLogFilter(e.target.value as any);
                    // Refetch logs with new filter
                    setTimeout(() => {
                      fetchAnalytics();
                    }, 100);
                  }}
                  className="text-xs px-2 py-1 bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded text-c-text"
                >
                  <option value="all">{t('settings.analytics.filterAll', 'All')}</option>
                  <option value="success">
                    {t('settings.analytics.filterSuccess', 'Success')}
                  </option>
                  <option value="errors">{t('settings.analytics.filterErrors', 'Errors')}</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-c-surface-raised">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted">
                      {t('settings.analytics.timestamp', 'Timestamp')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted">
                      {t('settings.analytics.endpoint', 'Endpoint')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted">
                      {t('settings.analytics.method', 'Method')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted">
                      {t('settings.analytics.status', 'Status')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted">
                      {t('settings.analytics.responseTime', 'Response Time')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted">
                      {t('settings.analytics.error', 'Error')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-c-border-subtle dark:divide-white/5">
                  {logs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-sm text-c-text-muted"
                      >
                        {t('settings.analytics.noLogs', 'No logs found')}
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-c-surface-raised dark:hover:bg-navy-800/50">
                        <td className="px-4 py-3 text-xs text-c-text-secondary">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-c-text-secondary">
                          {log.endpoint}
                        </td>
                        <td className="px-4 py-3 text-xs text-c-text-secondary">
                          <span
                            className={`px-2 py-0.5 rounded ${
                              log.method === 'GET'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : log.method === 'POST'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-c-accent-soft text-c-accent'
                            }`}
                          >
                            {log.method}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className="flex items-center gap-1">
                            {log.status_code >= 200 && log.status_code < 300 ? (
                              <CheckCircle size={14} className="text-green-500" />
                            ) : (
                              <XCircle size={14} className="text-rose-500" />
                            )}
                            <span
                              className={`font-medium ${
                                log.status_code >= 200 && log.status_code < 300
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {log.status_code}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-c-text-secondary">
                          {log.response_time_ms}ms
                        </td>
                        <td className="px-4 py-3 text-xs text-rose-600 dark:text-rose-400 max-w-xs truncate">
                          {log.error_message || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default IntegrationAnalyticsSettings;
