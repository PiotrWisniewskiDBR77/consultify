import {
  Activity,
  Bot,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  DollarSign,
  Download,
  FileText,
  Loader2,
  Play,
  Plus,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '@/components/Admin/AdminState';
import { normalizeApiErrorMessage } from '@/utils/apiError';

import { Card } from '../../../components/ui/BaseCard';
import { LoadingState } from '../../../components/ui/primitives';
import Api from '../../../services/api';

interface Report {
  id: string;
  name: string;
  description?: string;
  report_type: string;
  filters_json: string;
  columns_json: string;
  schedule_json?: string;
  created_by_email?: string;
  execution_count?: number;
  last_executed_at?: string;
  created_at: string;
  updated_at: string;
}

interface Execution {
  id: string;
  report_id: string;
  status: string;
  executed_at: string;
  completed_at?: string;
  result_json?: string;
  error_message?: string;
}

interface ReportExecutionResult {
  data?: Array<Record<string, unknown>>;
  rowCount?: number;
  total_revenue?: number;
  total_tokens?: number;
  total_cost?: number;
}

interface ReportCreateExpectation {
  name: string;
  report_type: string;
  id?: string;
}

const REPORT_TYPES = [
  { id: 'users', label: 'Users Report', icon: Users, description: 'User accounts and activity' },
  {
    id: 'organizations',
    label: 'Organizations Report',
    icon: Building2,
    description: 'Organization metrics',
  },
  {
    id: 'revenue',
    label: 'Revenue Report',
    icon: DollarSign,
    description: 'Financial data and invoices',
  },
  { id: 'activity', label: 'Activity Report', icon: Activity, description: 'System activity logs' },
  { id: 'ai_usage', label: 'AI Usage Report', icon: Bot, description: 'AI model usage and costs' },
];

const DEFAULT_REPORT_QUERIES: Record<string, string> = {
  users: `SELECT id, email, role, created_at, last_login FROM users ORDER BY created_at DESC LIMIT 500`,
  organizations: `SELECT id, name, status, plan, created_at FROM organizations ORDER BY created_at DESC LIMIT 500`,
  revenue: `SELECT s.id, s.status, sp.name as plan_name, sp.price_monthly, s.created_at
            FROM subscriptions s
            JOIN subscription_plans sp ON s.plan_id = sp.id
            ORDER BY s.created_at DESC
            LIMIT 500`,
  activity: `SELECT id, organization_id, user_id, action, entity_type, entity_id, created_at
             FROM activity_logs
             ORDER BY created_at DESC
             LIMIT 500`,
  ai_usage: `SELECT id, organization_id, user_id, model, tokens, cost, created_at
             FROM ai_request_logs
             ORDER BY created_at DESC
             LIMIT 500`,
};

const reportMatchesCreate = (report: Report, expected: ReportCreateExpectation) =>
  expected.id
    ? report.id === expected.id
    : report.name === expected.name && report.report_type === expected.report_type;

const hasSchedule = (report: Report) => Boolean(report.schedule_json);

type JsonRecord = Record<string, unknown> & {
  data?: JsonRecord | unknown[];
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null;

const getObjectPayload = (value: unknown) => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) ? value.data : null;
  return data && isRecord(data.data) ? data.data : data || value;
};

const getListPayload = <T,>(value: unknown, keys: string[]): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (!isRecord(value)) return [];
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const candidates = [value, data, nestedData].filter(isRecord);
  for (const candidate of candidates) {
    if (Array.isArray(candidate.data)) return candidate.data as T[];
    for (const key of keys) {
      if (Array.isArray(candidate[key])) return candidate[key] as T[];
    }
  }
  return [];
};

const hasListShape = (value: unknown, keys: string[]) => {
  if (Array.isArray(value)) return true;
  if (!isRecord(value)) return false;
  const data = isRecord(value.data) ? value.data : null;

  return (
    'data' in value ||
    keys.some((key) => key in value) ||
    Boolean(data && keys.some((key) => key in data))
  );
};

const getCreatedReportId = (value: unknown) => {
  if (!isRecord(value)) return '';
  const payload = getObjectPayload(value);
  const report = isRecord(value.report) ? value.report : null;
  const payloadReport = isRecord(payload) && isRecord(payload.report) ? payload.report : null;
  return String(
    value.id || report?.id || (isRecord(payload) ? payload.id : '') || payloadReport?.id || ''
  );
};

const getCreatedExecutionId = (value: unknown) => {
  if (!isRecord(value)) return '';
  const payload = getObjectPayload(value);
  const execution = isRecord(value.execution) ? value.execution : null;
  const payloadExecution =
    isRecord(payload) && isRecord(payload.execution) ? payload.execution : null;
  return String(
    value.id || execution?.id || (isRecord(payload) ? payload.id : '') || payloadExecution?.id || ''
  );
};

const SavedReportsView: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [executionResult, setExecutionResult] = useState<ReportExecutionResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [executionLoadError, setExecutionLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [filterType, setFilterType] = useState<string>('');

  const [newReport, setNewReport] = useState({
    name: '',
    description: '',
    reportType: 'users',
    filters: {} as Record<string, unknown>,
    columns: [] as string[],
  });

  const [schedule, setSchedule] = useState({
    frequency: 'daily',
    time: '09:00',
    is_active: true,
  });

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await Api.getAnalyticsReports(filterType || undefined);
      const reportsData = getListPayload<Report>(data, ['reports', 'items']);
      if (!hasListShape(data, ['reports', 'items'])) {
        throw new Error('Saved reports response was not a list');
      }
      setReports(reportsData);
      return reportsData;
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to load reports. Please try again.');
      setReports([]);
      setSelectedReport(null);
      setExecutions([]);
      setExecutionResult(null);
      setLoadError(message);
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [filterType]);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  const fetchExecutions = async (reportId: string): Promise<Execution[] | null> => {
    setExecutionLoadError(null);
    try {
      const data = await Api.getReportExecutions(reportId);
      const executionsData = getListPayload<Execution>(data, ['executions', 'items']);
      if (!hasListShape(data, ['executions', 'items'])) {
        throw new Error('Report executions response was not a list');
      }
      setExecutions(executionsData);
      return executionsData;
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to fetch executions');
      setExecutions([]);
      setExecutionLoadError(message);
      toast.error(message);
      return null;
    }
  };

  const handleSelectReport = (report: Report) => {
    setSelectedReport(report);
    setExecutionResult(null);
    void fetchExecutions(report.id);
  };

  const handleCreateReport = async () => {
    if (loadError) return;
    if (!newReport.name || !newReport.reportType) return;

    setActionError(null);
    try {
      const expected: ReportCreateExpectation = {
        name: newReport.name,
        report_type: newReport.reportType,
      };
      const created = await Api.createAnalyticsReport({
        name: expected.name,
        description: newReport.description,
        report_type: expected.report_type,
        query_sql: DEFAULT_REPORT_QUERIES[newReport.reportType] || 'SELECT 1 as ok',
        parameters: [],
        visualization_type: 'table',
      });
      expected.id = getCreatedReportId(created) || undefined;
      const refreshed = await fetchReports();
      if (!refreshed?.some((report) => reportMatchesCreate(report, expected))) {
        throw new Error('Report creation was not confirmed by the server');
      }
      setShowCreateModal(false);
      setNewReport({ name: '', description: '', reportType: 'users', filters: {}, columns: [] });
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to create report');
      setActionError(message);
      toast.error(message);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;

    setActionError(null);
    try {
      await Api.deleteAnalyticsReport(reportId);
      const refreshed = await fetchReports();
      if (!refreshed || refreshed.some((report) => report.id === reportId)) {
        throw new Error('Report deletion was not confirmed by the server');
      }
      if (selectedReport?.id === reportId) {
        setSelectedReport(null);
        setExecutions([]);
      }
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to delete report');
      setActionError(message);
      toast.error(message);
    }
  };

  const handleExecuteReport = async () => {
    if (!selectedReport) return;

    setIsExecuting(true);
    setActionError(null);
    try {
      const result = await Api.executeAnalyticsReport(selectedReport.id);
      const executionId = getCreatedExecutionId(result);
      const resultPayload = getObjectPayload(result);
      const refreshedExecutions = await fetchExecutions(selectedReport.id);
      await fetchReports();
      if (
        !refreshedExecutions ||
        (executionId && !refreshedExecutions.some((item) => item.id === executionId))
      ) {
        throw new Error('Report execution was not confirmed by the server');
      }
      setExecutionResult(resultPayload as ReportExecutionResult);
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to execute report');
      setActionError(message);
      toast.error(message);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleScheduleReport = async () => {
    if (!selectedReport) return;

    setActionError(null);
    try {
      await Api.scheduleAnalyticsReport(selectedReport.id, schedule);
      const refreshed = await fetchReports();
      const refreshedReport = refreshed?.find((report) => report.id === selectedReport.id);
      if (!refreshedReport || !hasSchedule(refreshedReport)) {
        throw new Error('Report schedule was not confirmed by the server');
      }
      setSelectedReport(refreshedReport);
      setShowScheduleModal(false);
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to schedule report');
      setActionError(message);
      toast.error(message);
    }
  };

  const exportToCSV = (rows: Array<Record<string, unknown>>) => {
    if (!rows || rows.length === 0) return;

    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((h) => {
            const val = row[h];
            if (val === null || val === undefined) return '';
            if (typeof val === 'string' && val.includes(',')) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return String(val);
          })
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `report-${selectedReport?.name || 'export'}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getReportTypeInfo = (type: string) => {
    return REPORT_TYPES.find((rt) => rt.id === type) || REPORT_TYPES[0];
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleString();
  };

  const controlsDisabled = !!loadError;

  if (isLoading) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Saved Reports</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Create, schedule, and export reports
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Filter by type */}
          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              disabled={controlsDisabled}
              title={loadError || undefined}
              className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm appearance-none pr-8"
            >
              <option value="">All Types</option>
              {REPORT_TYPES.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={controlsDisabled}
            title={loadError || undefined}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            New Report
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="p-4 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl">
          <DegradedState title="Saved reports unavailable" description={loadError} />
        </div>
      ) : null}

      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-danger-500/30 bg-danger-500/5 p-4 text-sm text-danger-600 dark:text-danger-300"
        >
          {actionError}
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Reports List */}
        <div className="col-span-4">
          <Card className="p-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Reports ({reports.length})
            </h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {loadError ? (
                <DegradedState title="Reports list unavailable" description={loadError} />
              ) : reports.length === 0 ? (
                <p className="text-slate-600 dark:text-slate-400 text-sm text-center py-8">
                  No reports yet. Create one to get started.
                </p>
              ) : (
                reports.map((report) => {
                  const typeInfo = getReportTypeInfo(report.report_type);
                  const TypeIcon = typeInfo.icon;
                  return (
                    <div
                      key={report.id}
                      onClick={() => handleSelectReport(report)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedReport?.id === report.id
                          ? 'bg-blue-600/10 border border-blue-400/60 dark:bg-blue-500/10 dark:border-blue-500/30'
                          : 'bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 border border-transparent'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-slate-200 dark:bg-white/10 rounded-lg">
                          <TypeIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-900 dark:text-white font-medium truncate">
                              {report.name}
                            </span>
                            {report.schedule_json && (
                              <span title="Scheduled">
                                <Clock className="w-3 h-3 text-green-400" />
                              </span>
                            )}
                          </div>
                          <p className="text-slate-600 dark:text-slate-400 text-xs mt-1">
                            {typeInfo.label}
                          </p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-slate-600 dark:text-slate-400">
                            <span>{report.execution_count || 0} runs</span>
                            <span>•</span>
                            <span>Last: {formatDate(report.last_executed_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* Report Details & Results */}
        <div className="col-span-8">
          {selectedReport ? (
            <div className="space-y-4">
              {/* Report Header */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      {selectedReport.name}
                    </h3>
                    {selectedReport.description && (
                      <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                        {selectedReport.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExecuteReport}
                      disabled={isExecuting}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                    >
                      {isExecuting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      Run Now
                    </button>
                    <button
                      onClick={() => setShowScheduleModal(true)}
                      className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-c-text px-3 py-2 rounded-lg text-sm transition-colors"
                    >
                      <Calendar className="w-4 h-4" />
                      Schedule
                    </button>
                    <button
                      onClick={() => handleDeleteReport(selectedReport.id)}
                      aria-label={`Delete report ${selectedReport.name}`}
                      className="p-2 text-danger-400 hover:bg-danger-600/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Report Info */}
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="bg-gray-700/50 rounded-lg p-3">
                    <span className="text-gray-600 dark:text-gray-500 dark:text-gray-400">
                      Type
                    </span>
                    <p className="text-c-text font-medium mt-1">
                      {getReportTypeInfo(selectedReport.report_type).label}
                    </p>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-3">
                    <span className="text-gray-600 dark:text-gray-500 dark:text-gray-400">
                      Created By
                    </span>
                    <p className="text-c-text font-medium mt-1">
                      {selectedReport.created_by_email || 'Unknown'}
                    </p>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-3">
                    <span className="text-slate-600 dark:text-slate-400">Schedule</span>
                    <p className="text-slate-900 dark:text-white font-medium mt-1">
                      {selectedReport.schedule_json ? (
                        <span className="text-green-400">Active</span>
                      ) : (
                        <span className="text-slate-600 dark:text-slate-400">Not scheduled</span>
                      )}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Execution Result */}
              {executionResult && (
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
                      Results
                    </h4>
                    <button
                      onClick={() => exportToCSV(executionResult.data || [])}
                      className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
                    >
                      <Download className="w-4 h-4" />
                      Export CSV
                    </button>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-navy-700 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {executionResult.rowCount ?? (executionResult.data?.length || 0)}
                      </p>
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        Total Records
                      </span>
                    </div>
                    {executionResult.total_revenue !== undefined && (
                      <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-navy-700 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-green-400">
                          ${executionResult.total_revenue?.toLocaleString()}
                        </p>
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          Total Revenue
                        </span>
                      </div>
                    )}
                    {executionResult.total_tokens !== undefined && (
                      <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-navy-700 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-blue-400">
                          {executionResult.total_tokens?.toLocaleString()}
                        </p>
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          Total Tokens
                        </span>
                      </div>
                    )}
                    {executionResult.total_cost !== undefined && (
                      <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-navy-700 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-yellow-400">
                          ${executionResult.total_cost?.toFixed(2)}
                        </p>
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          Total Cost
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Data Preview */}
                  {executionResult.data && executionResult.data.length > 0 && (
                    <div className="overflow-x-auto">
                      <table /* §27-exempt: render danych nie-listowy, nie spelnia definicji 1 (przegladana kolekcja encji z akcjami) */ className="w-full text-sm"
                      >
                        <thead>
                          <tr className="border-b border-gray-700">
                            {Object.keys(executionResult.data[0])
                              .slice(0, 6)
                              .map((key) => (
                                <th
                                  key={key}
                                  className="text-left py-2 px-3 text-gray-600 dark:text-gray-500 dark:text-gray-400 font-medium"
                                >
                                  {key}
                                </th>
                              ))}
                          </tr>
                        </thead>
                        <tbody>
                          {executionResult.data.slice(0, 10).map((row, idx) => (
                            <tr key={idx} className="border-b border-gray-700/50">
                              {Object.keys(row)
                                .slice(0, 6)
                                .map((key) => (
                                  <td
                                    key={key}
                                    className="py-2 px-3 text-c-text truncate max-w-[150px]"
                                  >
                                    {String(row[key] ?? '-')}
                                  </td>
                                ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {executionResult.data.length > 10 && (
                        <p className="text-center text-gray-600 dark:text-gray-500 dark:text-gray-400 text-xs mt-2">
                          Showing 10 of {executionResult.data.length} records
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              )}

              {/* Execution History */}
              <Card className="bg-gray-800 p-4">
                <h4 className="text-lg font-semibold text-c-text mb-4">Execution History</h4>
                {executionLoadError ? (
                  <DegradedState
                    title="Report executions unavailable"
                    description={executionLoadError}
                  />
                ) : executions.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">
                    No executions yet
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {executions.map((exec) => (
                      <div
                        key={exec.id}
                        className="flex items-center justify-between p-2 bg-gray-700/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {exec.status === 'completed' ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                          ) : exec.status === 'failed' ? (
                            <XCircle className="w-4 h-4 text-danger-400" />
                          ) : (
                            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                          )}
                          <span className="text-c-text text-sm">
                            {formatDate(exec.executed_at)}
                          </span>
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            exec.status === 'completed'
                              ? 'bg-green-500/20 text-green-400'
                              : exec.status === 'failed'
                                ? 'bg-danger-500/20 text-danger-400'
                                : 'bg-blue-500/20 text-blue-400'
                          }`}
                        >
                          {exec.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          ) : (
            <Card className="p-8">
              <div className="flex flex-col items-center justify-center h-64">
                <FileText className="w-16 h-16 text-slate-600 dark:text-slate-400 mb-4" />
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                  Select a Report
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-center">
                  Choose a report from the list or create a new one
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Create Report Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-navy-800 rounded-xl p-6 w-full max-w-lg border border-slate-200 dark:border-navy-700 shadow-xl">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              Create New Report
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Report Name
                </label>
                <input
                  type="text"
                  value={newReport.name}
                  onChange={(e) => setNewReport({ ...newReport, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                  placeholder="Monthly Users Report"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  Description
                </label>
                <textarea
                  value={newReport.description}
                  onChange={(e) => setNewReport({ ...newReport, description: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                  placeholder="Describe your report..."
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                  Report Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {REPORT_TYPES.map((rt) => (
                    <button
                      key={rt.id}
                      onClick={() => setNewReport({ ...newReport, reportType: rt.id })}
                      className={`p-3 rounded-lg flex items-center gap-2 transition-colors ${
                        newReport.reportType === rt.id
                          ? 'bg-blue-600/10 border border-blue-400/60 dark:bg-blue-500/10 dark:border-blue-500/30'
                          : 'bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 border border-transparent'
                      }`}
                    >
                      <rt.icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm text-slate-900 dark:text-white">{rt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-lg transition-colors dark:bg-navy-700 dark:hover:bg-navy-600 dark:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateReport}
                disabled={!newReport.name}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Create Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-c-text mb-4">Schedule Report</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Frequency</label>
                <select
                  value={schedule.frequency}
                  onChange={(e) => setSchedule({ ...schedule, frequency: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-c-text"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Time</label>
                <input
                  type="time"
                  value={schedule.time}
                  onChange={(e) => setSchedule({ ...schedule, time: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-c-text"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="schedule-active"
                  checked={schedule.is_active}
                  onChange={(e) => setSchedule({ ...schedule, is_active: e.target.checked })}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600"
                />
                <label htmlFor="schedule-active" className="text-sm text-gray-600">
                  Enable scheduled execution
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-c-text rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleReport}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedReportsView;
