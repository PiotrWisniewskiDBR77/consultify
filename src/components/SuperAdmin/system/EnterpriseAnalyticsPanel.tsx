/**
 * EnterpriseAnalyticsPanel - System Analytics & Reporting
 *
 * Features:
 * - Real-time system metrics dashboards
 * - Custom report builder
 * - Scheduled reports
 * - Export capabilities (PDF, CSV, Excel)
 * - Trend analysis
 */

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  Clock,
  Database,
  Download,
  FileText,
  Globe,
  Mail,
  Plus,
  RefreshCw,
  Settings,
  Users,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { DegradedState, ReadOnlyState } from '../../Admin/AdminState';
import { LoadingState } from '../../shared/states';

interface MetricCard {
  id: string;
  title: string;
  value: string | number;
  change: number;
  changeLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color: string;
  }[];
}

interface ScheduledReport {
  id: string;
  name: string;
  type: string;
  schedule: string;
  recipients: string[];
  last_sent?: string;
  next_run?: string;
  is_active: boolean;
}

type AnalyticsTab = 'dashboard' | 'reports' | 'scheduled';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getList = (payload: unknown, keys: string[]) => {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
    if (isRecord(value)) {
      for (const nestedKey of keys) {
        const nested = value[nestedKey];
        if (Array.isArray(nested)) return nested;
      }
    }
  }
  return [];
};

const asText = (value: unknown, fallback = 'Unknown') => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
};

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();
};

const METRIC_COLOR_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  primary: { bg: 'bg-c-accent/10', border: 'border-c-accent/30', icon: 'text-c-accent' },
  purple: { bg: 'bg-c-accent/10', border: 'border-c-accent/30', icon: 'text-c-accent' },
  emerald: { bg: 'bg-c-success/10', border: 'border-c-success/30', icon: 'text-c-success' },
  amber: { bg: 'bg-c-warning/10', border: 'border-c-warning/30', icon: 'text-c-warning' },
};

const TIME_RANGES = [
  { id: '24h', label: 'Last 24 Hours' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: '90d', label: 'Last 90 Days' },
  { id: 'custom', label: 'Custom Range' },
];

const REPORT_TYPES = [
  { id: 'system_performance', label: 'System Performance', icon: Activity },
  { id: 'user_activity', label: 'User Activity', icon: Users },
  { id: 'ai_usage', label: 'AI Usage', icon: Zap },
  { id: 'security_events', label: 'Security Events', icon: Database },
  { id: 'api_metrics', label: 'API Metrics', icon: Globe },
];

export const EnterpriseAnalyticsPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('dashboard');
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [apiChartData, setApiChartData] = useState<ChartData | null>(null);
  const [aiChartData, setAiChartData] = useState<ChartData | null>(null);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scheduledLoadError, setScheduledLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const analyticsTabs: {
    id: AnalyticsTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'reports', label: 'Generate Report', icon: FileText },
    { id: 'scheduled', label: 'Scheduled Reports', icon: Clock },
  ];

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const analyticsData = await Api.getSystemAnalytics(timeRange);

      // Transform to metrics with real data
      setMetrics([
        {
          id: 'api_requests',
          title: 'API Requests',
          value: (analyticsData.metrics?.api?.total_requests || 0).toLocaleString(),
          change: analyticsData.metrics?.api?.change || 0,
          changeLabel: 'vs last period',
          icon: Globe,
          color: 'primary',
        },
        {
          id: 'ai_requests',
          title: 'AI Requests',
          value: (analyticsData.metrics?.ai?.total_requests || 0).toLocaleString(),
          change: analyticsData.metrics?.ai?.change || 0,
          changeLabel: 'vs last period',
          icon: Zap,
          color: 'purple',
        },
        {
          id: 'active_users',
          title: 'Active Users',
          value: String(analyticsData.metrics?.users?.active_today || 0),
          change: 0,
          changeLabel: 'vs last period',
          icon: Users,
          color: 'emerald',
        },
        {
          id: 'db_queries',
          title: 'DB Queries',
          value: (analyticsData.metrics?.database?.total_queries || 0).toLocaleString(),
          change: analyticsData.metrics?.api?.change || 0,
          changeLabel: 'vs last period',
          icon: Database,
          color: 'amber',
        },
      ]);

      // Use real chart data from API
      if (analyticsData.charts?.api?.labels?.length > 0) {
        setApiChartData({
          labels: analyticsData.charts.api.labels,
          datasets: [
            { label: 'Requests', data: analyticsData.charts.api.requests, color: '#3b82f6' },
            { label: 'Errors', data: analyticsData.charts.api.errors, color: '#f43f5e' },
          ],
        });
      } else {
        setApiChartData(null);
      }

      if (analyticsData.charts?.ai?.labels?.length > 0) {
        setAiChartData({
          labels: analyticsData.charts.ai.labels,
          datasets: [
            { label: 'Tokens (K)', data: analyticsData.charts.ai.tokens, color: '#6366f1' },
            { label: 'Requests', data: analyticsData.charts.ai.requests, color: '#10b981' },
          ],
        });
      } else {
        setAiChartData(null);
      }
      setLoading(false);
      return true;
    } catch (error) {
      setLoadError(normalizeApiErrorMessage(error, 'Failed to fetch analytics'));
      setMetrics([]);
      setApiChartData(null);
      setAiChartData(null);
      setLoading(false);
      return false;
    }
  }, [timeRange]);

  const fetchScheduledReports = useCallback(async () => {
    try {
      setScheduledLoadError(null);
      const reports = await Api.getAnalyticsReports();
      const normalizedReports = getList(reports, ['reports', 'items', 'data'])
        .filter(isRecord)
        .filter((report) => report.schedule)
        .map((report) => ({
          id: asText(report.id, ''),
          name: asText(report.name),
          type: asText(report.report_type || report.type, 'custom'),
          schedule:
            typeof report.schedule === 'string'
              ? report.schedule
              : isRecord(report.schedule)
                ? asText(report.schedule.frequency, 'scheduled')
                : 'scheduled',
          recipients: Array.isArray(report.recipients)
            ? report.recipients.map((recipient) => String(recipient))
            : [],
          last_sent:
            (report.last_sent || report.lastSent) === null ||
            (report.last_sent || report.lastSent) === undefined
              ? undefined
              : String(report.last_sent || report.lastSent),
          next_run:
            (report.next_run || report.nextRun) === null ||
            (report.next_run || report.nextRun) === undefined
              ? undefined
              : String(report.next_run || report.nextRun),
          is_active: report.status !== 'paused' && report.status !== 'disabled',
        }));
      setScheduledReports(normalizedReports);
    } catch (error) {
      const message = normalizeApiErrorMessage(error, 'Failed to load scheduled reports');
      setScheduledLoadError(message);
      setScheduledReports([]);
      toast.error(message);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    fetchScheduledReports();
  }, [fetchAnalytics, fetchScheduledReports]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const ok = await fetchAnalytics();
    setRefreshing(false);
    if (ok) {
      toast.success('Analytics refreshed');
    }
  };

  const handleExport = (format: 'pdf' | 'csv' | 'xlsx') => {
    if (loadError || metrics.length === 0) {
      toast.error('Analytics data is unavailable');
      return;
    }
    const payload = {
      exportedAt: new Date().toISOString(),
      timeRange,
      metrics,
      apiChartData,
      aiChartData,
    };
    const filename = `superadmin-analytics-${timeRange}.${format === 'pdf' ? 'json' : format}`;
    const content =
      format === 'csv'
        ? [
            'metric,value,change',
            ...metrics.map((metric) => `${metric.title},${metric.value},${metric.change}`),
          ].join('\n')
        : JSON.stringify(payload, null, 2);
    const blob = new Blob([content], {
      type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Report exported as ${filename}`);
  };

  // Note: All analytics data comes from real API endpoints
  // Empty states are handled gracefully when data is not available

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text">
            Analytics & Reporting
          </h2>
          <p className="text-c-text-secondary text-sm">
            Monitor system performance and generate insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 bg-c-surface hover:bg-c-surface-raised border border-c-border text-c-text-secondary rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <div className="relative">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 bg-c-surface border border-c-border rounded-lg text-c-text"
            >
              {TIME_RANGES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-c-text-secondary pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-c-border-subtle pb-1">
        {analyticsTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 font-medium rounded-t-lg transition-colors ${
              activeTab === id
                ? 'bg-c-surface-raised text-c-text border-b-2 border-c-accent'
                : 'text-c-text-secondary hover:bg-c-surface-raised'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState template="card" />
      ) : (
        <>
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {loadError ? (
                <div className="rounded-xl border border-c-border bg-c-surface p-6">
                  <DegradedState title="Analytics dashboard unavailable" description={loadError} />
                </div>
              ) : (
                <>
                  {/* Metric Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {metrics.map((metric) => {
                      const Icon = metric.icon;
                      const isPositive = metric.change >= 0;
                      const colorStyle =
                        METRIC_COLOR_STYLES[metric.color] || METRIC_COLOR_STYLES.primary;
                      return (
                        <div
                          key={metric.id}
                          className={`p-4 ${colorStyle.bg} rounded-xl border ${colorStyle.border}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <Icon className={`w-5 h-5 ${colorStyle.icon}`} />
                            <div
                              className={`flex items-center text-xs ${isPositive ? 'text-c-success' : 'text-c-danger'}`}
                            >
                              {isPositive ? (
                                <ArrowUpRight className="w-3 h-3" />
                              ) : (
                                <ArrowDownRight className="w-3 h-3" />
                              )}
                              {Math.abs(metric.change)}%
                            </div>
                          </div>
                          <div className="text-2xl font-bold text-c-text">
                            {metric.value}
                          </div>
                          <div className="text-xs text-c-text-muted">
                            {metric.title}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* API Chart */}
                    <div className="p-6 bg-c-surface-raised rounded-xl border border-c-border">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-c-text flex items-center gap-2">
                          <Globe className="w-5 h-5 text-c-accent" />
                          API Traffic
                        </h3>
                        <button
                          onClick={() => handleExport('csv')}
                          className="text-xs text-c-text-secondary hover:text-c-text flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          Export
                        </button>
                      </div>
                      {apiChartData ? (
                        <SimpleBarChart data={apiChartData} />
                      ) : (
                        <ReadOnlyState
                          title="API traffic chart unavailable"
                          description="The analytics endpoint did not return API chart data for this period."
                        />
                      )}
                    </div>

                    {/* AI Chart */}
                    <div className="p-6 bg-c-surface-raised rounded-xl border border-c-border">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-c-text flex items-center gap-2">
                          <Zap className="w-5 h-5 text-c-accent" />
                          AI Usage
                        </h3>
                        <button
                          onClick={() => handleExport('csv')}
                          className="text-xs text-c-text-secondary hover:text-c-text flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          Export
                        </button>
                      </div>
                      {aiChartData ? (
                        <SimpleBarChart data={aiChartData} />
                      ) : (
                        <ReadOnlyState
                          title="AI usage chart unavailable"
                          description="The analytics endpoint did not return AI chart data for this period."
                        />
                      )}
                    </div>
                  </div>

                  {/* Performance Breakdown */}
                  <div className="p-6 bg-c-surface-raised rounded-xl border border-c-border">
                    <ReadOnlyState
                      title="Performance breakdown unavailable"
                      description="Endpoint-level latency, top endpoints, and error-type distribution require backend analytics fields that are not provided to this panel yet."
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Generate Report Tab */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              {loadError ? (
                <div className="rounded-xl border border-c-border bg-c-surface p-6">
                  <DegradedState title="Report generation unavailable" description={loadError} />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {REPORT_TYPES.map((report) => {
                      const Icon = report.icon;
                      return (
                        <div
                          key={report.id}
                          className="p-6 bg-c-surface-raised rounded-xl border border-c-border hover:border-c-accent/50 transition-colors cursor-pointer"
                          onClick={() => handleExport('pdf')}
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-lg bg-c-accent/10 flex items-center justify-center">
                              <Icon className="w-5 h-5 text-c-accent" />
                            </div>
                            <h3 className="font-medium text-c-text">
                              {report.label}
                            </h3>
                          </div>
                          <p className="text-sm text-c-text-secondary mb-4">
                            Generate a comprehensive {report.label.toLowerCase()} report for the
                            selected time period.
                          </p>
                          <div className="flex items-center gap-2">
                            <button className="px-3 py-1.5 text-xs bg-c-surface hover:bg-c-surface text-white dark:bg-[#F4F7FB] dark:hover:bg-[#DDE5EF] rounded-lg">
                              PDF
                            </button>
                            <button className="px-3 py-1.5 text-xs bg-c-surface hover:bg-c-surface-raised text-c-text rounded-lg">
                              CSV
                            </button>
                            <button className="px-3 py-1.5 text-xs bg-c-surface hover:bg-c-surface-raised text-c-text rounded-lg">
                              Excel
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-6 bg-c-surface-raised rounded-xl border border-c-border">
                    <ReadOnlyState
                      title="Custom report builder unavailable"
                      description="The export buttons can download the currently loaded analytics snapshot, but the custom report builder workflow is not wired to an audited backend yet."
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Scheduled Reports Tab */}
          {activeTab === 'scheduled' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-c-text">
                  Scheduled Reports
                </h3>
                <button
                  disabled
                  title="Scheduled report creation requires an audited backend workflow"
                  className="flex items-center gap-2 px-4 py-2 bg-c-surface text-white rounded-lg hover:bg-c-surface dark:bg-[#F4F7FB] dark:hover:bg-[#DDE5EF] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  Schedule Report
                </button>
              </div>

              {!scheduledLoadError && (
                <ReadOnlyState
                  title="Scheduled report creation unavailable"
                  description="The reporting backend exposes scheduled report reads here, but no audited create/update workflow is wired to this panel yet."
                />
              )}

              {scheduledLoadError ? (
                <div className="rounded-xl border border-c-border bg-c-surface p-6">
                  <DegradedState
                    title="Scheduled reports unavailable"
                    description={scheduledLoadError}
                  />
                </div>
              ) : scheduledReports.length === 0 ? (
                <div className="text-center py-12 text-c-text-secondary">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No scheduled reports</p>
                  <p className="text-sm mt-1">
                    Create a scheduled report to receive automated insights
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {scheduledReports.map((report) => (
                    <div
                      key={report.id}
                      className={`p-4 rounded-xl border transition-colors ${
                        report.is_active
                          ? 'bg-c-surface-raised border-c-border hover:border-c-border-strong'
                          : 'bg-c-surface-raised/50 border-c-border-subtle'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-medium ${report.is_active ? 'text-c-text' : 'text-c-text-muted'}`}
                            >
                              {report.name}
                            </span>
                            {!report.is_active && (
                              <span className="px-2 py-0.5 text-xs bg-c-surface-raised text-c-text-secondary rounded">
                                Paused
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-c-text-muted mt-1">
                            <span className="capitalize">{report.schedule}</span>
                            <span>•</span>
                            <span>{report.recipients.length} recipients</span>
                            {report.next_run && (
                              <>
                                <span>•</span>
                                <span>Next: {formatDate(report.next_run)}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="p-2 hover:bg-c-surface-raised rounded-lg">
                            <Settings className="w-4 h-4 text-c-text-secondary" />
                          </button>
                          <button className="p-2 hover:bg-c-surface-raised rounded-lg">
                            <Mail className="w-4 h-4 text-c-text-secondary" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Simple Bar Chart Component
const SimpleBarChart: React.FC<{ data: ChartData }> = ({ data }) => {
  const maxValue = Math.max(...data.datasets.flatMap((d) => d.data));

  return (
    <div>
      {/* Legend */}
      <div className="flex items-center gap-4 mb-4">
        {data.datasets.map((dataset) => (
          <div key={dataset.label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: dataset.color }} />
            <span className="text-xs text-c-text-secondary">{dataset.label}</span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="flex items-end gap-1 h-32">
        {data.labels.map((label, i) => (
          <div key={label} className="flex-1 flex flex-col items-center">
            <div className="w-full flex items-end justify-center gap-px h-24">
              {data.datasets.map((dataset) => (
                <div
                  key={dataset.label}
                  className="w-full max-w-3 rounded-t transition-all hover:opacity-80"
                  style={{
                    backgroundColor: dataset.color,
                    height: `${(dataset.data[i] / maxValue) * 100}%`,
                  }}
                  title={`${dataset.label}: ${dataset.data[i]}`}
                />
              ))}
            </div>
            <span className="text-[10px] text-c-text-muted mt-1 truncate w-full text-center">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EnterpriseAnalyticsPanel;
