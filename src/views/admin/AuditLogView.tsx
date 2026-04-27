/**
 * AuditLogView - Full Audit Log Viewer
 *
 * Features:
 * - View all organization activity
 * - Filter by user, action, date
 * - Export audit logs
 * - Real-time updates
 */

import {
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Edit,
  Eye,
  FileText,
  History,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { DegradedState } from '../../components/Admin/AdminState';
import { InfoButton } from '../../components/shared/InfoButton';
import { Api } from '../../services/api';
import { normalizeApiErrorMessage } from '../../utils/apiError';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'LOGIN' | 'LOGOUT' | 'SECURITY' | 'EXPORT';
  resource: string;
  resourceId?: string;
  resourceName?: string;
  details?: Record<string, unknown>;
  ipAddress: string;
  userAgent?: string;
}

type TenantAdminAuditLogRow = {
  id?: string;
  admin_id?: string;
  adminId?: string;
  action_type?: string;
  actionType?: string;
  metadata?: Record<string, unknown> | string;
  metadata_json?: string;
  metadataJson?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  ipAddress?: string;
  user_agent?: string;
  userAgent?: string;
  created_at?: string;
  createdAt?: string;
  timestamp?: string;
};

interface AuditLogViewProps {
  className?: string;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ className = '' }) => {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [dateRange, setDateRange] = useState('7d');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const parseMetadata = useCallback((row: TenantAdminAuditLogRow): Record<string, unknown> => {
    const raw = row.metadataJson ?? row.metadata_json ?? row.metadata;
    if (!raw) return row.details || {};
    if (typeof raw === 'object') return raw;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }, []);

  const toActionType = useCallback((actionType: string): AuditLogEntry['actionType'] => {
    const normalized = actionType.toUpperCase();
    if (
      normalized.includes('CREATE') ||
      normalized.includes('ADD') ||
      normalized.includes('ASSIGN')
    ) {
      return 'CREATE';
    }
    if (
      normalized.includes('DELETE') ||
      normalized.includes('REMOVE') ||
      normalized.includes('REVOKE')
    ) {
      return 'DELETE';
    }
    if (normalized.includes('LOGIN')) return 'LOGIN';
    if (normalized.includes('LOGOUT')) return 'LOGOUT';
    if (normalized.includes('EXPORT')) return 'EXPORT';
    if (
      normalized.includes('SECURITY') ||
      normalized.includes('SCIM') ||
      normalized.includes('IAM')
    ) {
      return 'SECURITY';
    }
    return 'UPDATE';
  }, []);

  const normalizeAuditLog = useCallback(
    (row: TenantAdminAuditLogRow): AuditLogEntry => {
      const metadata = parseMetadata(row);
      const actionType = String(
        row.action_type || row.actionType || metadata.actionType || 'UPDATE'
      );
      const adminId = String(row.admin_id || row.adminId || metadata.adminId || 'system');
      return {
        id: String(
          row.id ||
            `${actionType}-${row.created_at || row.createdAt || row.timestamp || Date.now()}`
        ),
        timestamp: String(
          row.created_at || row.createdAt || row.timestamp || new Date().toISOString()
        ),
        userId: adminId,
        userName: String(metadata.adminName || metadata.userName || adminId),
        userEmail: String(metadata.adminEmail || metadata.userEmail || adminId),
        action: String(metadata.description || metadata.action || actionType).replaceAll('_', ' '),
        actionType: toActionType(actionType),
        resource: String(metadata.resource || metadata.resourceType || 'Admin'),
        resourceId: metadata.resourceId ? String(metadata.resourceId) : undefined,
        resourceName: metadata.resourceName ? String(metadata.resourceName) : undefined,
        details: metadata,
        ipAddress: String(row.ip_address || row.ipAddress || metadata.ipAddress || 'unknown'),
        userAgent:
          row.user_agent || row.userAgent ? String(row.user_agent || row.userAgent) : undefined,
      };
    },
    [parseMetadata, toActionType]
  );

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      setLoadError(null);
      const data = await Api.getTenantAdminAuditLogs({
        actionType: actionFilter !== 'all' ? actionFilter : undefined,
        search: searchTerm || undefined,
        limit: 100,
        offset: 0,
      });
      const rows = Array.isArray(data?.logs) ? data.logs : [];
      setLogs(rows.map(normalizeAuditLog));
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to load audit logs');
      toast.error(message);
      setLogs([]);
      setLoadError(message);
    }
    setLoading(false);
  }, [actionFilter, normalizeAuditLog, searchTerm]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await Api.exportTenantAdminAuditLogs();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Audit log exported');
    } catch (error: unknown) {
      toast.error(normalizeApiErrorMessage(error, 'Audit log export failed'));
    }
    setExporting(false);
  };

  const getActionIcon = (actionType: AuditLogEntry['actionType']) => {
    switch (actionType) {
      case 'CREATE':
        return <Plus size={14} className="text-green-500" />;
      case 'UPDATE':
        return <Edit size={14} className="text-blue-500" />;
      case 'DELETE':
        return <Trash2 size={14} className="text-red-500" />;
      case 'VIEW':
        return <Eye size={14} className="text-slate-500 dark:text-slate-400" />;
      case 'LOGIN':
        return <LogIn size={14} className="text-violet-500" />;
      case 'LOGOUT':
        return <LogOut size={14} className="text-slate-500 dark:text-slate-400" />;
      case 'SECURITY':
        return <Shield size={14} className="text-amber-500" />;
      case 'EXPORT':
        return <Download size={14} className="text-cyan-500" />;
      default:
        return <FileText size={14} className="text-slate-500 dark:text-slate-400" />;
    }
  };

  const getActionBadgeColor = (actionType: AuditLogEntry['actionType']) => {
    switch (actionType) {
      case 'CREATE':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'UPDATE':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
      case 'DELETE':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      case 'LOGIN':
      case 'LOGOUT':
        return 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400';
      case 'SECURITY':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
      case 'EXPORT':
        return 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400';
      default:
        return 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown date';
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredLogs = logs.filter((log) => {
    if (actionFilter !== 'all' && log.actionType !== actionFilter) return false;
    if (resourceFilter !== 'all' && log.resource !== resourceFilter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        log.action.toLowerCase().includes(search) ||
        log.userName.toLowerCase().includes(search) ||
        log.userEmail.toLowerCase().includes(search) ||
        log.resource.toLowerCase().includes(search) ||
        log.resourceName?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <InfoButton cardId="admin-audit-log" position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <History size={24} />
            {t('admin.security.auditLog', 'Audit Log')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('admin.security.auditLogDesc', 'Track all activity in your organization')}
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || !!loadError}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium disabled:opacity-50"
        >
          {exporting ? <RefreshCw size={18} className="animate-spin" /> : <Download size={18} />}
          Export CSV
        </button>
      </div>

      {loadError && <DegradedState title="Audit logs unavailable" description={loadError} />}

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            size={18}
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search logs..."
            disabled={!!loadError}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          disabled={!!loadError}
          className="px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg"
        >
          <option value="all">All Actions</option>
          <option value="CREATE">Create</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
          <option value="LOGIN">Login</option>
          <option value="SECURITY">Security</option>
          <option value="EXPORT">Export</option>
        </select>
        <select
          value={resourceFilter}
          onChange={(e) => setResourceFilter(e.target.value)}
          disabled={!!loadError}
          className="px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg"
        >
          <option value="all">All Resources</option>
          <option value="User">Users</option>
          <option value="Project">Projects</option>
          <option value="Task">Tasks</option>
          <option value="Decision">Decisions</option>
          <option value="Security">Security</option>
          <option value="API Key">API Keys</option>
        </select>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          disabled={!!loadError}
          className="px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg"
        >
          <option value="1d">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </div>

      {/* Logs List */}
      {loadError ? (
        <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
          <DegradedState title="Audit activity unavailable" description={loadError} />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
          <History className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">No Activity Found</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-1">No logs match your filters</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <div className="divide-y divide-slate-200 dark:divide-navy-700">
            {filteredLogs.map((log) => (
              <div key={log.id}>
                <div
                  className="p-4 hover:bg-slate-50 dark:hover:bg-navy-700/50 cursor-pointer"
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-navy-700">
                      {getActionIcon(log.actionType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-900 dark:text-white">
                          {log.userName}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs ${getActionBadgeColor(log.actionType)}`}
                        >
                          {log.actionType}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                        {log.action}
                        {log.resourceName && (
                          <span className="font-medium"> • {log.resourceName}</span>
                        )}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {formatTimestamp(log.timestamp)}
                        </span>
                        <span>{log.ipAddress}</span>
                      </div>
                    </div>
                    <div className="text-slate-400 dark:text-slate-500">
                      {expandedLog === log.id ? (
                        <ChevronDown size={18} />
                      ) : (
                        <ChevronRight size={18} />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedLog === log.id && log.details && (
                  <div className="px-4 pb-4 ml-14">
                    <div className="p-3 bg-slate-50 dark:bg-navy-900 rounded-lg text-sm">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                        Details
                      </p>
                      <pre className="text-slate-700 dark:text-slate-300 overflow-x-auto">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                      {log.userAgent && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                          User Agent: {log.userAgent}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogView;
