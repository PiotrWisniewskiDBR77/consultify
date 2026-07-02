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
  HardDrive,
  History,
  LogIn,
  LogOut,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  EmptyState as SharedEmptyState,
  LoadingState as SharedLoadingState,
} from '@/components/shared/states';
import { DegradedState } from '../../components/Admin/AdminState';
import { InfoButton } from '../../components/shared/InfoButton';
import { Api } from '../../services/api';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { OrganizationContextWorkerOperationsPanel } from './OrganizationContextWorkerOperationsPanel';

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

type ContextLineageAuditEvent = {
  id: string;
  targetId: string;
  eventType: string;
  selectedDocumentIds?: string[];
  degraded?: boolean;
  degradedReasons?: string[];
  usedChunks?: Array<Record<string, unknown>>;
  createdAt: string;
};

type ContextStorageAuditEvent = {
  id: string;
  documentId: string;
  projectId?: string | null;
  bytesDelta: number;
  eventType: string;
  sourceUpload?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

type ContextProcessingJob = {
  id: string;
  documentId: string;
  status: string;
  attemptCount: number;
  pipelineType?: string;
  errorCode?: string | null;
  lockedAt?: string | null;
  lockedBy?: string | null;
  createdAt: string;
};

type ContextProcessingQueueSummary = {
  adapter: string;
  configuredBackend?: string;
  queueBackendReady?: boolean;
  queueBackendReason?: string | null;
  externalQueueName?: string | null;
  schedulerEnabled?: boolean;
  statusCounts?: Record<string, number>;
  pendingCount: number;
  blockedCount: number;
  claimedCount?: number;
  staleClaimedCount?: number;
  oldestClaimedAt?: string | null;
  deadLetterCount?: number;
  latestDeadLetterAt?: string | null;
  staleLockMs?: number;
  generatedAt: string;
};

type ContextWorkerRunResult = {
  processed?: number;
  retried?: number;
  deadLettered?: number;
  recoveredLocks?: number;
  claimSkipped?: number;
  pulledMessages?: number;
  ackedMessages?: number;
  backoffMessages?: number;
  queueActionReason?: string | null;
  runId?: string | null;
  auditEventId?: string | null;
  auditRecorded?: boolean;
  processedJobs?: Array<{ jobId: string; documentId: string }>;
  retriedJobs?: Array<{ jobId: string; documentId: string }>;
  deadLetteredJobs?: Array<{ jobId: string; documentId: string }>;
  claimSkippedJobs?: Array<{ jobId: string; documentId: string }>;
};

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
  const [contextAuditLoading, setContextAuditLoading] = useState(true);
  const [contextAuditError, setContextAuditError] = useState<string | null>(null);
  const [contextLineage, setContextLineage] = useState<ContextLineageAuditEvent[]>([]);
  const [contextStorageEvents, setContextStorageEvents] = useState<ContextStorageAuditEvent[]>([]);
  const [contextProcessingJobs, setContextProcessingJobs] = useState<ContextProcessingJob[]>([]);
  const [contextProcessingSummary, setContextProcessingSummary] =
    useState<ContextProcessingQueueSummary | null>(null);
  const [lastWorkerRunResult, setLastWorkerRunResult] = useState<ContextWorkerRunResult | null>(
    null
  );
  const [contextWorkerRunning, setContextWorkerRunning] = useState(false);

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

  const loadContextAudit = useCallback(async () => {
    setContextAuditLoading(true);
    try {
      setContextAuditError(null);
      const [lineageResponse, storageResponse, processingJobsResponse, queueSummaryResponse] =
        await Promise.all([
          Api.getOrganizationContextLineageAudit({ limit: 8 }),
          Api.getOrganizationContextStorageAudit({ limit: 8 }),
          Api.getOrganizationContextProcessingJobsAudit({ limit: 8 }),
          Api.getOrganizationContextProcessingQueueSummary(),
        ]);
      setContextLineage(Array.isArray(lineageResponse?.data) ? lineageResponse.data : []);
      setContextStorageEvents(Array.isArray(storageResponse?.data) ? storageResponse.data : []);
      setContextProcessingJobs(
        Array.isArray(processingJobsResponse?.data) ? processingJobsResponse.data : []
      );
      setContextProcessingSummary(queueSummaryResponse?.data || null);
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Organization context audit unavailable');
      setContextAuditError(message);
      setContextLineage([]);
      setContextStorageEvents([]);
      setContextProcessingJobs([]);
      setContextProcessingSummary(null);
    } finally {
      setContextAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    loadContextAudit();
  }, [loadContextAudit]);

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

  const handleRunContextWorkerOnce = async () => {
    const confirmed = window.confirm(
      'Run the organization context worker once? This will claim queued document processing jobs and write an audit event.'
    );
    if (!confirmed) return;

    setContextWorkerRunning(true);
    try {
      const response = await Api.runOrganizationContextWorkerOnce({ limit: 5 });
      const result = response?.data || {};
      setLastWorkerRunResult(result);
      toast.success(
        `Context worker completed: ${Number(result.processed || 0)} processed, ${Number(
          result.retried || 0
        )} retried, ${Number(result.deadLettered || 0)} dead-lettered.`
      );
      await loadContextAudit();
    } catch (error: unknown) {
      toast.error(normalizeApiErrorMessage(error, 'Context worker run failed'));
    } finally {
      setContextWorkerRunning(false);
    }
  };

  const getActionIcon = (actionType: AuditLogEntry['actionType']) => {
    switch (actionType) {
      case 'CREATE':
        return <Plus size={14} className="text-green-500" />;
      case 'UPDATE':
        return <Edit size={14} className="text-blue-500" />;
      case 'DELETE':
        return <Trash2 size={14} className="text-danger-500" />;
      case 'VIEW':
        return <Eye size={14} className="text-slate-500 dark:text-slate-400" />;
      case 'LOGIN':
        return <LogIn size={14} className="text-primary-500" />;
      case 'LOGOUT':
        return <LogOut size={14} className="text-slate-500 dark:text-slate-400" />;
      case 'SECURITY':
        return <Shield size={14} className="text-amber-500" />;
      case 'EXPORT':
        return <Download size={14} className="text-blue-500" />;
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
        return 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-400';
      case 'LOGIN':
      case 'LOGOUT':
        return 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400';
      case 'SECURITY':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
      case 'EXPORT':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
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

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
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
      <div className={`space-y-6 ${className}`}>
        <SharedLoadingState template="list" rows={8} />
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
          className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium disabled:opacity-50"
        >
          {exporting ? <RefreshCw size={18} className="animate-spin" /> : <Download size={18} />}
          Export CSV
        </button>
      </div>

      {loadError && <DegradedState title="Audit logs unavailable" description={loadError} />}

      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield size={18} />
              Organization Context Audit
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Trace AI document lineage and storage events for organization context.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleRunContextWorkerOnce}
              disabled={contextAuditLoading || contextWorkerRunning}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg disabled:opacity-50"
            >
              {contextWorkerRunning ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <PlayCircle size={14} />
              )}
              Run worker once
            </button>
            <button
              type="button"
              onClick={loadContextAudit}
              disabled={contextAuditLoading}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 dark:border-navy-600 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-700 disabled:opacity-50"
            >
              <RefreshCw size={14} className={contextAuditLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {contextAuditError ? (
          <DegradedState
            title="Organization context audit unavailable"
            description={contextAuditError}
          />
        ) : contextAuditLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <RefreshCw size={16} className="animate-spin" />
            Loading context audit...
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-lg border border-slate-200 dark:border-navy-700 overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <FileText size={14} />
                  AI Lineage Events
                </p>
              </div>
              {contextLineage.length === 0 ? (
                <p className="p-3 text-sm text-slate-500 dark:text-slate-400">
                  No context lineage events found.
                </p>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-navy-700">
                  {contextLineage.map((event) => (
                    <div key={event.id} className="p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-slate-900 dark:text-white">
                          {event.eventType.replaceAll('_', ' ')}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {formatTimestamp(event.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-600 dark:text-slate-300">
                        Insight: <span className="font-mono">{event.targetId}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Documents: {(event.selectedDocumentIds || []).length} · Chunks:{' '}
                        {(event.usedChunks || []).length}
                        {event.degraded ? ' · Degraded' : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-navy-700 overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <HardDrive size={14} />
                  Storage Events
                </p>
              </div>
              {contextStorageEvents.length === 0 ? (
                <p className="p-3 text-sm text-slate-500 dark:text-slate-400">
                  No context storage events found.
                </p>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-navy-700">
                  {contextStorageEvents.map((event) => (
                    <div key={event.id} className="p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-slate-900 dark:text-white">
                          {event.eventType.replaceAll('_', ' ')}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {formatTimestamp(event.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-600 dark:text-slate-300">
                        Document: <span className="font-mono">{event.documentId}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {formatBytes(event.bytesDelta)} · {event.sourceUpload || 'unknown source'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <OrganizationContextWorkerOperationsPanel
              jobs={contextProcessingJobs}
              summary={contextProcessingSummary}
              lastRunResult={lastWorkerRunResult}
              formatTimestamp={formatTimestamp}
            />
          </div>
        )}
      </div>

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
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
          <SharedEmptyState
            variant="filter"
            icon={History}
            title={t('admin.audit.noActivity', 'No activity found')}
            description={t(
              'admin.audit.noActivityDesc',
              'No audit entries match the current filters. Try a wider action type or clear the search.'
            )}
            primaryAction={{
              label: t('common.clearFilters', 'Clear filters'),
              onClick: () => {
                setSearchTerm('');
                setActionFilter('all');
                setResourceFilter('all');
              },
            }}
          />
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
