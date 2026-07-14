/**
 * Admin Audit Logs View
 *
 * Displays admin audit logs with risk scoring and filtering capabilities.
 */

import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle,
  Clock,
  Download,
  Filter,
  Loader2,
  RefreshCw,
  Shield,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../../components/Admin/AdminState';
import { Card, CardWithHeader } from '../../../components/Admin/shared/Card';
import { LoadingState } from '../../../components/ui/primitives';
import { Api } from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';

interface AuditLog {
  id: string;
  admin_id: string;
  action_type: string;
  resource_type: string;
  resource_id: string;
  ip_address: string;
  user_agent: string;
  risk_score: number;
  status: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
  admin: {
    email: string;
    firstName: string;
    lastName: string;
  };
}

interface AuditStats {
  total_logs: number;
  unresolved_count: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  avg_risk_score: number;
}

interface AuditLogsIntegrity {
  degraded: boolean;
  reason: string | null;
  malformedMetadataCount: number;
}

interface AuditLogsSnapshot {
  logs: AuditLog[];
  stats: AuditStats;
  integrity: AuditLogsIntegrity;
}

const EMPTY_INTEGRITY: AuditLogsIntegrity = {
  degraded: false,
  reason: null,
  malformedMetadataCount: 0,
};

function formatDateTime(value?: string | null): string {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return date.toLocaleString();
}

const safeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asText = (value: unknown, fallback: string) => {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

const getObjectPayload = (value: unknown) => {
  if (!isRecord(value)) return value;
  const data = isRecord(value.data) ? value.data : null;
  return data && isRecord(data.data) ? data.data : data || value;
};

const reconstructAdminFromFlatFields = (raw: any): AuditLog['admin'] => {
  const nested = isRecord(raw?.admin) ? (raw.admin as Record<string, unknown>) : null;
  const email =
    asText(nested?.email, '') || asText(raw?.admin_email, '') || asText(raw?.adminEmail, '');
  const firstName =
    asText(nested?.firstName, '') ||
    asText(raw?.first_name, '') ||
    asText(raw?.firstName, '') ||
    '';
  const lastName =
    asText(nested?.lastName, '') || asText(raw?.last_name, '') || asText(raw?.lastName, '') || '';
  return {
    email: email || '',
    firstName: firstName || '',
    lastName: lastName || '',
  };
};

const normalizeLog = (log: AuditLog): AuditLog => ({
  ...log,
  status: asText(log.status, 'unresolved').toLowerCase(),
  admin: reconstructAdminFromFlatFields(log),
});

const normalizeLogs = (value: unknown): AuditLog[] => {
  if (Array.isArray(value)) return (value as AuditLog[]).map(normalizeLog);
  if (isRecord(value)) {
    const payload = getObjectPayload(value);
    const candidates = [value, isRecord(value.data) ? value.data : null, payload].filter(isRecord);
    for (const candidate of candidates) {
      if (Array.isArray(candidate.logs)) return (candidate.logs as AuditLog[]).map(normalizeLog);
      if (Array.isArray(candidate.items)) return (candidate.items as AuditLog[]).map(normalizeLog);
      if (Array.isArray(candidate.data)) return (candidate.data as AuditLog[]).map(normalizeLog);
    }
  }
  throw new Error('Admin audit logs response was not a list');
};

const normalizeIntegrity = (value: unknown): AuditLogsIntegrity => {
  const candidates = [value];
  if (isRecord(value)) {
    if (isRecord(value.integrity)) candidates.push(value.integrity);
    if (isRecord(value.data) && isRecord((value.data as any).integrity)) {
      candidates.push((value.data as any).integrity);
    }
  }
  for (const candidate of candidates) {
    if (isRecord(candidate) && 'degraded' in candidate) {
      return {
        degraded: Boolean((candidate as any).degraded),
        reason: typeof (candidate as any).reason === 'string' ? (candidate as any).reason : null,
        malformedMetadataCount: safeNumber((candidate as any).malformedMetadataCount),
      };
    }
  }
  return EMPTY_INTEGRITY;
};

const normalizeStats = (value: unknown): AuditStats => {
  const statsValue = isRecord(getObjectPayload(value))
    ? (getObjectPayload(value) as Partial<AuditStats>)
    : {};
  return {
    total_logs: safeNumber(statsValue.total_logs),
    unresolved_count: safeNumber(statsValue.unresolved_count),
    high_risk_count: safeNumber(statsValue.high_risk_count),
    medium_risk_count: safeNumber(statsValue.medium_risk_count),
    low_risk_count: safeNumber(statsValue.low_risk_count),
    avg_risk_score: safeNumber(statsValue.avg_risk_score),
  };
};

const AdminAuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [integrity, setIntegrity] = useState<AuditLogsIntegrity>(EMPTY_INTEGRITY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    actionType: '',
    status: '',
    riskScoreMin: '',
    fromDate: '',
    toDate: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [showResolveModal, setShowResolveModal] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      setError(null);

      const params: {
        limit: number;
        actionType?: string;
        status?: string;
        riskScoreMin?: number;
        fromDate?: string;
        toDate?: string;
      } = { limit: 100 };
      if (filters.actionType) params.actionType = filters.actionType;
      if (filters.status) params.status = filters.status;
      if (filters.riskScoreMin) params.riskScoreMin = parseInt(filters.riskScoreMin);
      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate) params.toDate = filters.toDate;

      const [logsData, statsData] = await Promise.all([
        Api.getAdminAuditLogs(params),
        Api.getAdminAuditStats(),
      ]);

      const nextLogs = normalizeLogs(logsData);
      const nextStats = normalizeStats(statsData);
      const nextIntegrity = normalizeIntegrity(logsData);
      setLogs(nextLogs);
      setStats(nextStats);
      setIntegrity(nextIntegrity);
      return {
        logs: nextLogs,
        stats: nextStats,
        integrity: nextIntegrity,
      } satisfies AuditLogsSnapshot;
    } catch (err: unknown) {
      setLoadError(normalizeApiErrorMessage(err, 'Failed to load audit logs'));
      setLogs([]);
      setStats(null);
      setIntegrity(EMPTY_INTEGRITY);
      return null;
    } finally {
      setLoading(false);
    }
  }, [filters.actionType, filters.fromDate, filters.riskScoreMin, filters.status, filters.toDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleResolve = async (logId: string) => {
    try {
      setResolving(logId);
      setError(null);
      await Api.resolveAdminAuditLog(logId, resolutionNotes);
      const refreshed = await loadData();
      if (
        !refreshed ||
        refreshed.logs.some((log) => log.id === logId && log.status !== 'resolved')
      ) {
        throw new Error('Audit log resolution was not confirmed by the server');
      }
      setShowResolveModal(null);
      setResolutionNotes('');
      toast.success('Audit log resolved successfully');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to resolve audit log');
      setError(message);
      toast.error(message);
    } finally {
      setResolving(null);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      setError(null);
      const result = await Api.exportAdminAuditLogs({
        ...filters,
        riskScoreMin: filters.riskScoreMin ? parseInt(filters.riskScoreMin) : undefined,
        format: 'csv',
      });

      // Create download link - handle either blob or url response
      const objectUrl = result instanceof Blob ? URL.createObjectURL(result) : null;
      const exportPayload = getObjectPayload(result);
      const url =
        objectUrl ||
        (isRecord(exportPayload) ? String((exportPayload as { url?: unknown }).url || '') : '');
      if (!url) {
        throw new Error('Audit log export did not return a downloadable file');
      }
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (objectUrl) URL.revokeObjectURL(objectUrl);

      toast.success('Export downloaded successfully');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to export audit logs');
      setError(message);
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      actionType: '',
      status: '',
      riskScoreMin: '',
      fromDate: '',
      toDate: '',
    });
  };

  const getRiskBadge = (score: number) => {
    const riskScore = safeNumber(score);
    if (riskScore >= 80) {
      return (
        <span className="flex items-center gap-1 px-2 py-1 bg-danger-600/20 text-danger-400 rounded text-xs font-medium animate-pulse">
          <AlertCircle className="w-3 h-3" />
          CRITICAL ({riskScore})
        </span>
      );
    }
    if (riskScore >= 60) {
      return (
        <span className="flex items-center gap-1 px-2 py-1 bg-danger-500/10 text-danger-400 rounded text-xs font-medium">
          <AlertCircle className="w-3 h-3" />
          HIGH ({riskScore})
        </span>
      );
    }
    if (riskScore >= 30) {
      return (
        <span className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 text-amber-400 rounded text-xs font-medium">
          <AlertTriangle className="w-3 h-3" />
          MEDIUM ({riskScore})
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-xs font-medium">
        <CheckCircle className="w-3 h-3" />
        LOW ({riskScore})
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    if (status === 'resolved') {
      return (
        <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-xs">
          Resolved
        </span>
      );
    }
    return (
      <span className="px-2 py-1 bg-amber-500/10 text-amber-400 rounded text-xs">Unresolved</span>
    );
  };

  if (loading && logs.length === 0) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {loadError ? (
        <Card variant="bordered" className="p-6">
          <DegradedState title="Admin audit logs unavailable" description={loadError} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-lg">
                <Shield className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Logs</p>
                <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {stats?.total_logs || 0}
                </p>
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Unresolved</p>
                <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {stats?.unresolved_count || 0}
                </p>
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-danger-500/10 rounded-lg">
                <AlertCircle className="w-5 h-5 text-danger-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">High Risk</p>
                <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {stats?.high_risk_count || 0}
                </p>
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Medium Risk</p>
                <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {stats?.medium_risk_count || 0}
                </p>
              </div>
            </div>
          </Card>

          <Card variant="bordered" className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Low Risk</p>
                <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {stats?.low_risk_count || 0}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <Card variant="bordered" className="p-4 border-danger-500/30 bg-danger-500/5">
          <div role="alert" className="flex items-center gap-2 text-danger-400">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-sm hover:text-danger-300"
            >
              Dismiss
            </button>
          </div>
        </Card>
      )}

      {/* Honest integrity banner (degraded backend but not a hard failure) */}
      {!loadError && integrity.degraded && (
        <Card variant="bordered" className="p-4 border-amber-500/30 bg-amber-500/5">
          <div role="status" className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="w-5 h-5" />
            <span data-testid="audit-integrity-banner">
              {integrity.reason || 'Audit data is currently degraded.'}
              {integrity.malformedMetadataCount > 0
                ? ` (${integrity.malformedMetadataCount} malformed metadata payloads)`
                : ''}
            </span>
          </div>
        </Card>
      )}
      {!loadError && !integrity.degraded && integrity.malformedMetadataCount > 0 && (
        <Card variant="bordered" className="p-4 border-amber-500/30 bg-amber-500/5">
          <div role="status" className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="w-5 h-5" />
            <span data-testid="audit-integrity-banner">
              {integrity.malformedMetadataCount} audit log
              {integrity.malformedMetadataCount === 1 ? ' has' : 's have'} malformed metadata; raw
              payload preserved.
            </span>
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Audit Logs</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            disabled={!!loadError}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
              showFilters
                ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {Object.values(filters).some((v) => v) && (
              <span className="w-2 h-2 bg-indigo-500 rounded-full" />
            )}
          </button>
          <button
            onClick={handleExport}
            disabled={!!loadError || exporting}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Export CSV
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <Card variant="bordered" className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Filter Audit Logs
            </h3>
            {Object.values(filters).some((v) => v) && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              >
                <X className="w-3 h-3" />
                Clear Filters
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">
                Action Type
              </label>
              <select
                value={filters.actionType}
                onChange={(e) => setFilters({ ...filters, actionType: e.target.value })}
                disabled={!!loadError}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="">All Actions</option>
                <option value="login">Login</option>
                <option value="logout">Logout</option>
                <option value="create">Create</option>
                <option value="modify">Modify</option>
                <option value="delete">Delete</option>
                <option value="export_data">Export Data</option>
                <option value="bulk_action">Bulk Action</option>
                <option value="session_revoke">Session Revoke</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                disabled={!!loadError}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="">All Statuses</option>
                <option value="unresolved">Unresolved</option>
                <option value="resolved">Resolved</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">
                Risk Level
              </label>
              <select
                value={filters.riskScoreMin}
                onChange={(e) => setFilters({ ...filters, riskScoreMin: e.target.value })}
                disabled={!!loadError}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="">Any Risk</option>
                <option value="80">Critical (80+)</option>
                <option value="60">High+ (60+)</option>
                <option value="30">Medium+ (30+)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">
                From Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-400" />
                <input
                  type="date"
                  value={filters.fromDate}
                  onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
                  disabled={!!loadError}
                  className="w-full pl-10 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1">
                To Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-slate-400" />
                <input
                  type="date"
                  value={filters.toDate}
                  onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
                  disabled={!!loadError}
                  className="w-full pl-10 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Logs Table */}
      <CardWithHeader title="Audit Logs" subtitle={`${logs.length} logs`}>
        {loadError ? (
          <div className="p-6">
            <DegradedState title="Admin audit log list unavailable" description={loadError} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */ className="w-full"
            >
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    Admin
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    Action
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    Resource
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    IP Address
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    Risk
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    Time
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-600 dark:text-slate-400">
                      No audit logs found
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">
                            {asText(log.admin?.firstName, 'Unknown')}{' '}
                            {asText(log.admin?.lastName, '')}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {asText(log.admin?.email, 'Unknown admin')}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm font-mono bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 px-2 py-1 rounded">
                          {asText(log.action_type, 'Unknown action')}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-sm">{asText(log.resource_type, '-')}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[150px]">
                            {asText(log.resource_id, '-')}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm">{asText(log.ip_address, 'Unknown')}</td>
                      <td className="py-3 px-4">{getRiskBadge(log.risk_score)}</td>
                      <td className="py-3 px-4">{getStatusBadge(log.status)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300">
                          <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                          {formatDateTime(log.created_at)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {log.status !== 'resolved' && (
                            <button
                              onClick={() => setShowResolveModal(log.id)}
                              aria-label={`Resolve audit log ${log.id}`}
                              className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                              title="Resolve"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardWithHeader>

      {/* Resolve Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card variant="elevated" className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Resolve Audit Log</h3>
            <textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Resolution notes..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 mb-4 h-24 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowResolveModal(null);
                  setResolutionNotes('');
                }}
                className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResolve(showResolveModal)}
                disabled={resolving === showResolveModal}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-600 rounded-lg disabled:opacity-50"
              >
                {resolving === showResolveModal ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Resolve
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminAuditLogsView;
