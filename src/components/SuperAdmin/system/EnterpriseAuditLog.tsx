/**
 * EnterpriseAuditLog - Comprehensive Audit Log Management
 *
 * Features:
 * - Advanced filtering and search
 * - Compliance tagging (GDPR, SOC2, ISO27001, HIPAA)
 * - Risk level classification
 * - Export to CSV/JSON
 * - Analytics dashboard
 * - Real-time log streaming
 */

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Globe,
  Info,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  Tag,
  User,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';
import { DegradedState } from '../../Admin/AdminState';
import { EmptyState, LoadingState } from '../../shared/states';

interface AuditLog {
  id: string;
  timestamp: string;
  user_id: string;
  user_email: string;
  ip_address: string;
  user_agent: string;
  action_type: string;
  resource_type: string;
  resource_id: string;
  before_data: any;
  after_data: any;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  compliance_tags: string[];
  request_id: string;
  organization_id: string;
  metadata: any;
}

interface AuditStats {
  total: number;
  low_risk: number;
  medium_risk: number;
  high_risk: number;
  critical_risk: number;
}

interface FilterState {
  search: string;
  riskLevel: string;
  actionType: string;
  resourceType: string;
  complianceTag: string;
  startDate: string;
  endDate: string;
  userId: string;
}

const RISK_LEVELS = {
  LOW: { color: 'bg-c-text-muted', text: 'text-c-text-muted', icon: Info },
  MEDIUM: { color: 'bg-c-warning', text: 'text-c-warning', icon: AlertTriangle },
  HIGH: { color: 'bg-c-warning', text: 'text-c-warning', icon: AlertCircle },
  CRITICAL: { color: 'bg-c-danger', text: 'text-c-danger', icon: Shield },
};

const COMPLIANCE_TAGS = [
  { id: 'GDPR', name: 'GDPR', color: 'bg-c-info/20 text-c-info' },
  { id: 'SOC2', name: 'SOC2', color: 'bg-c-accent/20 text-c-accent' },
  { id: 'ISO27001', name: 'ISO 27001', color: 'bg-c-success/20 text-c-success' },
  { id: 'HIPAA', name: 'HIPAA', color: 'bg-c-danger/20 text-c-danger' },
  { id: 'PMO', name: 'PMO Audit', color: 'bg-c-info/20 text-c-info' },
];

const ACTION_TYPES = [
  'LOGIN',
  'LOGOUT',
  'CREATE',
  'UPDATE',
  'DELETE',
  'VIEW',
  'EXPORT',
  'SHARE',
  'INVITE',
  'APPROVE',
  'REJECT',
  'ESCALATE',
  'CONFIG_CHANGE',
];

const RESOURCE_TYPES = [
  'USER',
  'ORGANIZATION',
  'PROJECT',
  'INITIATIVE',
  'TASK',
  'ASSESSMENT',
  'REPORT',
  'DOCUMENT',
  'SETTING',
  'API_KEY',
  'WEBHOOK',
  'INTEGRATION',
];

export const EnterpriseAuditLog: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'logs' | 'analytics'>('logs');
  const [showFilters, setShowFilters] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    riskLevel: 'ALL',
    actionType: '',
    resourceType: '',
    complianceTag: '',
    startDate: '',
    endDate: '',
    userId: '',
  });

  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    total: 0,
  });

  const getRiskLevelFromScore = (riskScore: any): AuditLog['risk_level'] => {
    const score = Number(riskScore);
    if (Number.isNaN(score)) return 'LOW';
    if (score >= 90) return 'CRITICAL';
    if (score >= 70) return 'HIGH';
    if (score >= 31) return 'MEDIUM';
    return 'LOW';
  };

  const normalizeLog = (row: any): AuditLog => {
    const metadata = row?.metadataJson ?? row?.metadata ?? {};
    const complianceTagsRaw =
      row?.compliance_tags ??
      row?.complianceTags ??
      metadata?.complianceTags ??
      metadata?.compliance_tags ??
      [];
    const complianceTags = Array.isArray(complianceTagsRaw)
      ? complianceTagsRaw
      : (() => {
          try {
            return JSON.parse(String(complianceTagsRaw || '[]'));
          } catch {
            return [];
          }
        })();

    const riskScore = row?.risk_score ?? row?.riskScore ?? metadata?.riskScore ?? null;
    return {
      id: String(row?.id ?? ''),
      timestamp: row?.timestamp ?? row?.created_at ?? row?.createdAt ?? null,
      user_id: row?.user_id ?? row?.admin_id ?? row?.adminId ?? null,
      user_email: row?.user_email ?? row?.admin_email ?? row?.admin?.email ?? null,
      ip_address: row?.ip_address ?? row?.ipAddress ?? null,
      user_agent: row?.user_agent ?? row?.userAgent ?? null,
      action_type: row?.action_type ?? row?.actionType ?? null,
      resource_type: row?.resource_type ?? row?.resourceType ?? row?.entity_type ?? null,
      resource_id: row?.resource_id ?? row?.resourceId ?? row?.entity_id ?? null,
      before_data: row?.before_data ?? metadata?.before_data ?? metadata?.beforeData ?? null,
      after_data: row?.after_data ?? metadata?.after_data ?? metadata?.afterData ?? null,
      risk_level: row?.risk_level ?? getRiskLevelFromScore(riskScore),
      compliance_tags: complianceTags,
      request_id: row?.request_id ?? metadata?.requestId ?? null,
      organization_id: row?.organization_id ?? row?.organizationId ?? null,
      metadata,
    } as any;
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      setLoadError(null);
      const queryFilters: any = {};
      if (filters.search) queryFilters.search = filters.search;
      if (filters.riskLevel !== 'ALL') queryFilters.riskLevel = filters.riskLevel;
      if (filters.actionType) queryFilters.actionType = filters.actionType;
      if (filters.resourceType) queryFilters.resourceType = filters.resourceType;
      if (filters.complianceTag) queryFilters.complianceTag = filters.complianceTag;
      if (filters.startDate) queryFilters.startDate = filters.startDate;
      if (filters.endDate) queryFilters.endDate = filters.endDate;
      if (filters.userId) queryFilters.userId = filters.userId;

      const data = await Api.getAuditLogs(queryFilters, {
        page: pagination.page,
        pageSize: pagination.pageSize,
      });

      const raw = Array.isArray(data) ? data : data.logs || [];
      setLogs((raw || []).map(normalizeLog));
      if (data.pagination) {
        setPagination((prev) => ({ ...prev, total: data.pagination.total }));
      }

      // Fetch stats
      const statsData = await Api.getAuditLogStats(queryFilters);
      setStats(statsData as any);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      setLoadError(error instanceof Error ? error.message : 'Failed to load audit logs');
      setLogs([]);
      setStats(null);
      setPagination((prev) => ({ ...prev, total: 0 }));
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.pageSize]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(true);
    setActionError(null);
    try {
      const queryFilters: any = {};
      if (filters.search) queryFilters.search = filters.search;
      if (filters.riskLevel !== 'ALL') queryFilters.riskLevel = filters.riskLevel;
      if (filters.actionType) queryFilters.actionType = filters.actionType;
      if (filters.resourceType) queryFilters.resourceType = filters.resourceType;
      if (filters.startDate) queryFilters.startDate = filters.startDate;
      if (filters.endDate) queryFilters.endDate = filters.endDate;

      const data = await Api.exportAuditLogs({ ...queryFilters, format });
      if (data === null || data === undefined) {
        throw new Error('Audit log export response was empty');
      }

      // Create download
      const blob = new Blob([format === 'json' ? JSON.stringify(data, null, 2) : data], {
        type: format === 'json' ? 'application/json' : 'text/csv',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${format.toUpperCase()} successfully`);
    } catch (error) {
      const message = normalizeApiErrorMessage(error, 'Failed to export audit logs');
      setActionError(message);
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      riskLevel: 'ALL',
      actionType: '',
      resourceType: '',
      complianceTag: '',
      startDate: '',
      endDate: '',
      userId: '',
    });
  };

  const analyticsActionCounts = (() => {
    const counts = new Map<string, number>();
    for (const l of logs) {
      const k = String((l as any)?.action_type || '').trim() || 'UNKNOWN';
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  })();
  const analyticsActionMax = Math.max(1, ...analyticsActionCounts.map((x) => x.count));

  const analyticsComplianceCounts = (() => {
    return COMPLIANCE_TAGS.map((tag) => {
      const count = logs.reduce((acc, l: any) => {
        const tags = Array.isArray(l?.compliance_tags) ? l.compliance_tags : [];
        return acc + (tags.includes(tag.id) ? 1 : 0);
      }, 0);
      return { ...tag, count };
    });
  })();

  const analyticsTimeline = (() => {
    // last 7 days (including today), local date buckets
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000);
      d.setHours(0, 0, 0, 0);
      return d;
    });
    const bucket = new Map<string, number>(days.map((d) => [d.toISOString().slice(0, 10), 0]));
    for (const l of logs as any[]) {
      const ts = l?.timestamp;
      if (!ts) continue;
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) continue;
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      if (bucket.has(key)) bucket.set(key, (bucket.get(key) || 0) + 1);
    }
    const series = days.map((d) => {
      const key = d.toISOString().slice(0, 10);
      return { date: d, count: bucket.get(key) || 0 };
    });
    const max = Math.max(1, ...series.map((s) => s.count));
    return { series, max };
  })();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-c-text">Audit Log</h2>
          <p className="text-c-text-secondary text-sm">
            Comprehensive activity tracking for compliance and security
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-c-surface-raised rounded-lg p-1">
            <button
              onClick={() => setActiveView('logs')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeView === 'logs'
                  ? 'bg-c-surface text-c-text'
                  : 'text-c-text-secondary hover:bg-c-surface-raised'
              }`}
            >
              Logs
            </button>
            <button
              onClick={() => setActiveView('analytics')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeView === 'analytics'
                  ? 'bg-c-surface text-c-text'
                  : 'text-c-text-secondary hover:bg-c-surface-raised'
              }`}
            >
              Analytics
            </button>
          </div>
          <div className="relative group">
            <button
              disabled={exporting || !!loadError}
              className="flex items-center gap-2 px-4 py-2 bg-c-success hover:bg-c-success/90 text-c-text rounded-lg transition-colors disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Export
              <ChevronDown className="w-4 h-4" />
            </button>
            <div className="absolute right-0 mt-2 w-40 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={() => handleExport('csv')}
                className="w-full px-4 py-2 text-sm text-left text-c-text-secondary hover:bg-c-surface-raised rounded-t-lg"
              >
                Export as CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                className="w-full px-4 py-2 text-sm text-left text-c-text-secondary hover:bg-c-surface-raised rounded-b-lg"
              >
                Export as JSON
              </button>
            </div>
          </div>
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-c-danger/30 bg-c-danger/5 p-4 text-sm text-c-danger"
        >
          {actionError}
        </div>
      )}

      {/* Stats Cards */}
      {loadError ? (
        <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-6">
          <DegradedState title="Audit log overview unavailable" description={loadError} />
        </div>
      ) : (
        stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03]">
              <div className="text-sm text-c-text-secondary">Total Events</div>
              <div className="text-2xl font-bold text-c-text mt-1">
                {stats.total || 0}
              </div>
            </div>
            <div className="p-4 bg-c-surface-raised rounded-xl border border-c-border-subtle">
              <div className="text-sm text-c-text-secondary">Low Risk</div>
              <div className="text-2xl font-bold text-c-text-secondary mt-1">
                {stats.low_risk || 0}
              </div>
            </div>
            <div className="p-4 bg-c-warning/10 rounded-xl border border-c-warning/30">
              <div className="text-sm text-c-text-secondary">Medium Risk</div>
              <div className="text-2xl font-bold text-c-warning mt-1">{stats.medium_risk || 0}</div>
            </div>
            <div className="p-4 bg-c-warning/10 rounded-xl border border-c-warning/30">
              <div className="text-sm text-c-text-secondary">High Risk</div>
              <div className="text-2xl font-bold text-c-warning mt-1">{stats.high_risk || 0}</div>
            </div>
            <div className="p-4 bg-c-danger/10 rounded-xl border border-c-danger/30">
              <div className="text-sm text-c-text-secondary">Critical</div>
              <div className="text-2xl font-bold text-c-danger mt-1">
                {stats.critical_risk || 0}
              </div>
            </div>
          </div>
        )
      )}

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-c-text-muted"
              size={16}
            />
            <input
              type="text"
              placeholder="Search by action, resource, user, request ID..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              disabled={!!loadError}
              className="w-full pl-10 pr-4 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg text-c-text placeholder-c-text-muted focus:outline-none focus:ring-2 ring-c-focus"
            />
          </div>
          <select
            value={filters.riskLevel}
            onChange={(e) => setFilters({ ...filters, riskLevel: e.target.value })}
            disabled={!!loadError}
            className="px-4 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg text-c-text focus:outline-none focus:ring-2 ring-c-focus"
          >
            <option value="ALL">All Risk Levels</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
          <button
            onClick={() => setShowFilters(!showFilters)}
            disabled={!!loadError}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              showFilters
                ? 'bg-c-surface border-c-border-subtle text-c-text'
                : 'bg-c-surface-raised border-c-border-subtle text-c-text-secondary hover:bg-c-surface-raised'
            }`}
          >
            <Filter size={16} />
            Filters
          </button>
          <button
            onClick={fetchLogs}
            disabled={loading || !!loadError}
            className="p-2 bg-c-surface hover:bg-c-surface-raised border border-c-border-subtle rounded-lg text-c-text-secondary"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="p-4 bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-c-text-secondary mb-1">
                  Action Type
                </label>
                <select
                  value={filters.actionType}
                  onChange={(e) => setFilters({ ...filters, actionType: e.target.value })}
                  disabled={!!loadError}
                  className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg text-c-text text-sm"
                >
                  <option value="">All Actions</option>
                  {ACTION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-c-text-secondary mb-1">
                  Resource Type
                </label>
                <select
                  value={filters.resourceType}
                  onChange={(e) => setFilters({ ...filters, resourceType: e.target.value })}
                  disabled={!!loadError}
                  className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg text-c-text text-sm"
                >
                  <option value="">All Resources</option>
                  {RESOURCE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-c-text-secondary mb-1">
                  Compliance Tag
                </label>
                <select
                  value={filters.complianceTag}
                  onChange={(e) => setFilters({ ...filters, complianceTag: e.target.value })}
                  disabled={!!loadError}
                  className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg text-c-text text-sm"
                >
                  <option value="">All Tags</option>
                  {COMPLIANCE_TAGS.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-c-text-secondary mb-1">
                  User ID
                </label>
                <input
                  type="text"
                  value={filters.userId}
                  onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                  placeholder="Filter by user"
                  disabled={!!loadError}
                  className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg text-c-text text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-c-text-secondary mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  disabled={!!loadError}
                  className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg text-c-text text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-c-text-secondary mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  disabled={!!loadError}
                  className="w-full px-3 py-2 bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg text-c-text text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={resetFilters}
                disabled={!!loadError}
                className="text-sm text-c-text-secondary hover:text-c-text transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Logs View */}
      {activeView === 'logs' && (
        <div className="space-y-2">
          {loading ? (
            <LoadingState template="list" />
          ) : loadError ? (
            <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-6">
              <DegradedState title="Audit logs unavailable" description={loadError} />
            </div>
          ) : logs.length === 0 ? (
            <EmptyState
              variant="new"
              icon={FileText}
              title="No audit logs yet"
              description="Try adjusting your filters to see more activity."
            />
          ) : (
            logs.map((log) => {
              const riskConfig = RISK_LEVELS[log.risk_level] || RISK_LEVELS.LOW;
              const RiskIcon = riskConfig.icon;
              const isExpanded = expandedLog === log.id;

              return (
                <div
                  key={log.id}
                  className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] overflow-hidden"
                >
                  <div
                    className="p-4 cursor-pointer hover:bg-c-surface-raised transition-colors"
                    onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${riskConfig.color}/20`}>
                          <RiskIcon className={`w-4 h-4 ${riskConfig.text}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-c-text">
                              {log.action_type}
                            </span>
                            {log.resource_type && (
                              <span className="text-c-text-secondary">
                                on {log.resource_type}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-c-text-muted mt-1">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {log.user_email || 'System'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {log.timestamp && !isNaN(new Date(log.timestamp).getTime())
                                ? new Date(log.timestamp).toLocaleString()
                                : 'Unknown date'}
                            </span>
                            {log.ip_address && (
                              <span className="flex items-center gap-1">
                                <Globe className="w-3 h-3" />
                                {log.ip_address}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {log.compliance_tags?.length > 0 && (
                          <div className="flex gap-1">
                            {log.compliance_tags.slice(0, 2).map((tag) => {
                              const tagConfig = COMPLIANCE_TAGS.find((t) => t.id === tag);
                              return (
                                <span
                                  key={tag}
                                  className={`px-2 py-0.5 text-xs rounded ${tagConfig?.color || 'bg-c-surface-raised text-c-text-muted'}`}
                                >
                                  {tagConfig?.name || tag}
                                </span>
                              );
                            })}
                            {log.compliance_tags.length > 2 && (
                              <span className="text-xs text-c-text-muted">
                                +{log.compliance_tags.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${riskConfig.color}/20 ${riskConfig.text}`}
                        >
                          {log.risk_level}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-c-text-muted" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-c-text-muted" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t border-c-border-subtle mt-0">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div>
                          <div className="text-xs text-c-text-muted">Log ID</div>
                          <div className="flex items-center gap-1 mt-1">
                            <code className="text-xs text-c-text-secondary font-mono">
                              {log.id.slice(0, 8)}...
                            </code>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyId(log.id);
                              }}
                              className="p-1 hover:bg-c-surface-raised rounded"
                            >
                              {copiedId === log.id ? (
                                <Check className="w-3 h-3 text-c-success" />
                              ) : (
                                <Copy className="w-3 h-3 text-c-text-muted" />
                              )}
                            </button>
                          </div>
                        </div>
                        {log.request_id && (
                          <div>
                            <div className="text-xs text-c-text-muted">
                              Request ID
                            </div>
                            <code className="text-xs text-c-text-secondary font-mono mt-1 block">
                              {log.request_id.slice(0, 12)}...
                            </code>
                          </div>
                        )}
                        {log.resource_id && (
                          <div>
                            <div className="text-xs text-c-text-muted">
                              Resource ID
                            </div>
                            <code className="text-xs text-c-text-secondary font-mono mt-1 block">
                              {log.resource_id.slice(0, 12)}...
                            </code>
                          </div>
                        )}
                        {log.organization_id && (
                          <div>
                            <div className="text-xs text-c-text-muted">
                              Organization
                            </div>
                            <code className="text-xs text-c-text-secondary font-mono mt-1 block">
                              {log.organization_id.slice(0, 12)}...
                            </code>
                          </div>
                        )}
                      </div>

                      {(log.before_data || log.after_data) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                          {log.before_data && (
                            <div>
                              <div className="text-xs text-c-text-muted mb-2">
                                Before
                              </div>
                              <pre className="p-2 bg-c-surface rounded-lg text-xs text-c-text overflow-x-auto max-h-32">
                                {JSON.stringify(log.before_data, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.after_data && (
                            <div>
                              <div className="text-xs text-c-text-muted mb-2">
                                After
                              </div>
                              <pre className="p-2 bg-c-surface rounded-lg text-xs text-c-text overflow-x-auto max-h-32">
                                {JSON.stringify(log.after_data, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                      {log.user_agent && (
                        <div className="mt-4">
                          <div className="text-xs text-c-text-muted mb-1">
                            User Agent
                          </div>
                          <div className="text-xs text-c-text-secondary truncate">
                            {log.user_agent}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Pagination */}
          {logs.length > 0 && (
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-c-text-secondary">
                Showing {logs.length} of {pagination.total || logs.length} entries
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                  }
                  disabled={pagination.page === 1}
                  className="px-3 py-1 bg-c-surface-raised hover:bg-c-surface-raised border border-c-border-subtle rounded text-sm text-c-text-secondary disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-c-text-secondary">
                  Page {pagination.page}
                </span>
                <button
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                  disabled={logs.length < pagination.pageSize}
                  className="px-3 py-1 bg-c-surface-raised hover:bg-c-surface-raised border border-c-border-subtle rounded text-sm text-c-text-secondary disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Analytics View */}
      {activeView === 'analytics' && (
        <div className="space-y-6">
          {loadError ? (
            <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-6">
              <DegradedState title="Audit analytics unavailable" description={loadError} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Activity by Action Type */}
              <div className="p-4 bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03]">
                <h3 className="text-sm font-medium text-c-text mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-c-info" />
                  Activity by Action Type
                </h3>
                <div className="space-y-3">
                  {analyticsActionCounts.length === 0 ? (
                    <div className="text-sm text-c-text-muted">No data</div>
                  ) : (
                    analyticsActionCounts.map(({ action, count }) => (
                      <div key={action} className="flex items-center gap-3">
                        <div className="w-24 text-sm text-c-text-secondary">
                          {action}
                        </div>
                        <div className="flex-1 h-2 bg-c-surface-raised rounded-full overflow-hidden">
                          <div
                            className="h-full bg-c-info rounded-full"
                            style={{ width: `${(count / analyticsActionMax) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Risk Distribution */}
              <div className="p-4 bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03]">
                <h3 className="text-sm font-medium text-c-text mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-c-accent" />
                  Risk Distribution
                </h3>
                <div className="space-y-3">
                  {Object.entries(RISK_LEVELS).map(([level, config]) => {
                    const count = stats?.[`${level.toLowerCase()}_risk` as keyof AuditStats] || 0;
                    const percent = stats?.total ? (Number(count) / Number(stats.total)) * 100 : 0;
                    return (
                      <div key={level} className="flex items-center gap-3">
                        <div className={`w-24 text-sm ${config.text}`}>{level}</div>
                        <div className="flex-1 h-2 bg-c-surface-raised rounded-full overflow-hidden">
                          <div
                            className={`h-full ${config.color} rounded-full`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="w-12 text-right text-sm text-c-text-secondary">
                          {Number(count)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Compliance Coverage */}
              <div className="p-4 bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03]">
                <h3 className="text-sm font-medium text-c-text mb-4 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-c-success" />
                  Compliance Coverage
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {analyticsComplianceCounts.map((tag) => (
                    <div
                      key={tag.id}
                      className={`p-3 rounded-lg ${tag.color.replace('text-', 'border-').replace('/20', '/30')} border`}
                    >
                      <div className={`text-sm font-medium ${tag.color.split(' ')[1]}`}>
                        {tag.name}
                      </div>
                      <div className="text-xs text-c-text-muted mt-1">
                        {tag.count} events
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity Timeline */}
              <div className="p-4 bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03]">
                <h3 className="text-sm font-medium text-c-text mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-c-warning" />
                  Activity Timeline (Last 7 Days)
                </h3>
                <div className="flex items-end gap-2 h-32">
                  {analyticsTimeline.series.map(({ date, count }, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-c-warning rounded-t-sm transition-all hover:opacity-80"
                        style={{ height: `${(count / analyticsTimeline.max) * 100}%` }}
                      />
                      <div className="text-xs text-c-text-muted mt-2">
                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnterpriseAuditLog;
