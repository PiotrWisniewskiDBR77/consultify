/**
 * AI Audit Log Viewer Component
 *
 * Super Admin dashboard for viewing AI audit logs, security events, and compliance.
 * Features:
 * - Searchable audit log table
 * - Filters by user, date, risk level, action type
 * - Export to CSV/PDF
 * - Risk-flagged entries highlighting
 * - PII redaction display
 */

import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileText,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  User,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  user_id: string;
  user_email?: string;
  organization_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  request_summary: string;
  response_summary: string;
  model_used: string;
  tokens_used: number;
  cost_usd: number;
  ip_address?: string;
  user_agent?: string;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  flagged: boolean;
  flag_reason?: string;
}

interface AuditLogFilters {
  search: string;
  riskLevel: 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW';
  flaggedOnly: boolean;
  startDate: string;
  endDate: string;
  userId: string;
  action: string;
}

interface AuditLogStats {
  total_requests: number;
  flagged_requests: number;
  high_risk: number;
  medium_risk: number;
  low_risk: number;
  period: string;
}

type AuditLogRequestFilters = Partial<AuditLogFilters> & {
  actionType?: string;
  page?: number;
  pageSize?: number;
};

type AuditLogResponse = {
  logs?: AuditLogEntry[];
  pagination?: { totalPages?: number };
};

type AuditLogExportResult = Blob | { url?: string } | AuditLogEntry[];

const defaultFilters: AuditLogFilters = {
  search: '',
  riskLevel: 'ALL',
  flaggedOnly: false,
  startDate: '',
  endDate: '',
  userId: '',
  action: '',
};

export function AuditLogViewer() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<AuditLogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AuditLogFilters>(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [exporting, setExporting] = useState(false);
  const pageSize = 20;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const apiFilters: AuditLogRequestFilters = {
        riskLevel: filters.riskLevel,
        startDate: filters.startDate,
        endDate: filters.endDate,
        userId: filters.userId,
        actionType: filters.action,
        search: filters.search,
        page,
        pageSize,
      };

      const response = (await Api.getAuditLogs(
        undefined,
        apiFilters
      )) as unknown as AuditLogResponse;

      setLogs(response.logs ?? []);
      setTotalPages(response.pagination?.totalPages ?? 1);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch audit logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, filters, pageSize]);

  const fetchStats = useCallback(async () => {
    try {
      const statsData = await Api.getAuditLogStats();
      setStats({
        total_requests: statsData.total || 0,
        flagged_requests: 0, // TODO: Add flagged count to stats
        high_risk: statsData.high_risk || 0,
        medium_risk: statsData.medium_risk || 0,
        low_risk: statsData.low_risk || 0,
        period: 'Last 30 days',
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [fetchLogs, fetchStats]);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const exportFilters: AuditLogRequestFilters = {
        riskLevel: filters.riskLevel !== 'ALL' ? filters.riskLevel : undefined,
        startDate: filters.startDate,
        endDate: filters.endDate,
        userId: filters.userId,
        actionType: filters.action,
      };

      const result = (await Api.exportAuditLogs(exportFilters)) as AuditLogExportResult;
      const url =
        result instanceof Blob
          ? window.URL.createObjectURL(result)
          : Array.isArray(result)
            ? `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(result))}`
            : result.url;
      if (!url) {
        throw new Error('No export URL returned');
      }
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      if (result instanceof Blob) window.URL.revokeObjectURL(url);
      toast.success('Audit log exported successfully');
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Failed to export audit log');
    } finally {
      setExporting(false);
    }
  };

  const getRiskBadge = (riskLevel: string, flagged: boolean) => {
    const base = 'px-2 py-1 rounded-full text-xs font-medium';
    if (flagged) {
      return (
        <span
          className={`${base} bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400 flex items-center gap-1`}
        >
          <AlertTriangle size={12} />
          FLAGGED
        </span>
      );
    }
    switch (riskLevel) {
      case 'HIGH':
        return (
          <span
            className={`${base} bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400`}
          >
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span
            className={`${base} bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400`}
          >
            MEDIUM
          </span>
        );
      default:
        return (
          <span
            className={`${base} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400`}
          >
            LOW
          </span>
        );
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncateText = (text: string, maxLength: number = 50) => {
    if (!text) return '-';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-500/10 rounded-xl">
              <Shield size={24} className="text-primary-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">AI Audit Log</h1>
              <p className="text-slate-500 dark:text-slate-400">
                Security monitoring and compliance tracking
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                fetchLogs();
                fetchStats();
              }}
              className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
            >
              <RefreshCw size={20} />
            </button>
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Export CSV
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <FileText size={18} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Total Requests</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">
                    {stats.total_requests?.toLocaleString() || 0}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-danger-500/10 rounded-lg">
                  <AlertTriangle size={18} className="text-danger-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Flagged</p>
                  <p className="text-xl font-bold text-danger-600 dark:text-danger-400">
                    {stats.flagged_requests || 0}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-danger-500/10 rounded-lg">
                  <AlertCircle size={18} className="text-danger-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">High Risk</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">
                    {stats.high_risk || 0}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <AlertCircle size={18} className="text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Medium Risk</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">
                    {stats.medium_risk || 0}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <CheckCircle size={18} className="text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Low Risk</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">
                    {stats.low_risk || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                />
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400"
                />
              </div>
            </div>

            {/* Risk Level Filter */}
            <select
              value={filters.riskLevel}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  riskLevel: e.target.value as AuditLogFilters['riskLevel'],
                })
              }
              className="px-4 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="HIGH">High Risk</option>
              <option value="MEDIUM">Medium Risk</option>
              <option value="LOW">Low Risk</option>
            </select>

            {/* Flagged Only Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.flaggedOnly}
                onChange={(e) => setFilters({ ...filters, flaggedOnly: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">Flagged Only</span>
            </label>

            {/* Toggle More Filters */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
            >
              <Filter size={16} />
              More Filters
            </button>

            {/* Clear Filters */}
            {(filters.search ||
              filters.riskLevel !== 'ALL' ||
              filters.flaggedOnly ||
              filters.startDate ||
              filters.endDate) && (
              <button
                onClick={() => setFilters(defaultFilters)}
                className="flex items-center gap-1 px-3 py-2 text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-colors text-sm"
              >
                <X size={14} />
                Clear
              </button>
            )}
          </div>

          {/* Extended Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-navy-700 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                  User ID
                </label>
                <input
                  type="text"
                  placeholder="Enter user ID..."
                  value={filters.userId}
                  onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Action Type
                </label>
                <input
                  type="text"
                  placeholder="e.g., ai_request"
                  value={filters.action}
                  onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Logs Table */}
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={32} className="animate-spin text-primary-500" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-danger-500">
              <AlertTriangle size={32} className="mb-2" />
              <p>{error}</p>
              <button
                onClick={fetchLogs}
                className="mt-4 px-4 py-2 bg-danger-100 dark:bg-danger-900/20 text-danger-600 rounded-lg hover:bg-danger-200 dark:hover:bg-danger-900/30 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-slate-400">
              <FileText size={48} className="mb-4 opacity-50" />
              <p>No audit logs found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table
                /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */ className="w-full"
              >
                <thead className="bg-slate-50 dark:bg-navy-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Request Summary
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Model
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Tokens
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Risk
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className={`hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${
                        log.flagged ? 'bg-danger-50/50 dark:bg-danger-900/10' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock size={14} className="text-slate-400 dark:text-slate-500" />
                          {formatDate(log.timestamp)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-slate-400 dark:text-slate-500" />
                          {log.user_email || log.user_id?.slice(0, 8) || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 bg-slate-100 dark:bg-white/10 rounded text-slate-700 dark:text-slate-300">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300 max-w-xs truncate">
                        {truncateText(log.request_summary, 60)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {log.model_used || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {log.tokens_used?.toLocaleString() || '-'}
                      </td>
                      <td className="px-4 py-3">{getRiskBadge(log.risk_level, log.flagged)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && logs.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 dark:border-navy-700 flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-navy-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Audit Log Details
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Timestamp</p>
                  <p className="text-slate-900 dark:text-white font-medium">
                    {formatDate(selectedLog.timestamp)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Risk Level</p>
                  <div className="mt-1">
                    {getRiskBadge(selectedLog.risk_level, selectedLog.flagged)}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">User ID</p>
                  <p className="text-slate-900 dark:text-white font-mono text-sm">
                    {selectedLog.user_id}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Organization ID</p>
                  <p className="text-slate-900 dark:text-white font-mono text-sm">
                    {selectedLog.organization_id}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Action</p>
                  <p className="text-slate-900 dark:text-white">{selectedLog.action}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Model Used</p>
                  <p className="text-slate-900 dark:text-white">{selectedLog.model_used || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Tokens Used</p>
                  <p className="text-slate-900 dark:text-white">
                    {selectedLog.tokens_used?.toLocaleString() || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Cost (USD)</p>
                  <p className="text-slate-900 dark:text-white">
                    ${selectedLog.cost_usd?.toFixed(4) || '0'}
                  </p>
                </div>
              </div>

              {selectedLog.flagged && selectedLog.flag_reason && (
                <div className="p-4 bg-danger-50 dark:bg-danger-900/20 rounded-lg border border-danger-200 dark:border-danger-800">
                  <div className="flex items-center gap-2 text-danger-700 dark:text-danger-400 font-medium mb-1">
                    <AlertTriangle size={16} />
                    Flag Reason
                  </div>
                  <p className="text-danger-600 dark:text-danger-300">{selectedLog.flag_reason}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Request Summary</p>
                <div className="p-3 bg-slate-50 dark:bg-navy-900 rounded-lg text-sm text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap break-words">
                  {selectedLog.request_summary || '-'}
                </div>
              </div>

              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Response Summary</p>
                <div className="p-3 bg-slate-50 dark:bg-navy-900 rounded-lg text-sm text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                  {selectedLog.response_summary || '-'}
                </div>
              </div>

              {selectedLog.ip_address && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">IP Address</p>
                    <p className="text-slate-900 dark:text-white font-mono text-sm">
                      {selectedLog.ip_address}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">User Agent</p>
                    <p className="text-slate-600 dark:text-slate-400 text-xs truncate">
                      {selectedLog.user_agent || '-'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditLogViewer;
