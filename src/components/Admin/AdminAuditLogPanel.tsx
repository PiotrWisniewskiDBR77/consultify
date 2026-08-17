import { Download, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import type { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import type { TableColumn } from '../shared/ModuleHub/FilterableTable';
import { FilterableTable } from '../shared/ModuleHub/FilterableTable';

export const AdminAuditLogPanel: React.FC = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<{
    totalLogs: number;
    unresolvedCount: number;
    highRiskCount: number;
  }>({
    totalLogs: 0,
    unresolvedCount: 0,
    highRiskCount: 0,
  });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [riskSummary, setRiskSummary] = useState<any>(null);
  const [complianceSummary, setComplianceSummary] = useState<any>(null);
  const [retentionDays, setRetentionDays] = useState(730);
  const [auditFilters, setAuditFilters] = useState<FilterChip[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [logResult, statsResult, riskResult, complianceResult] = await Promise.all([
        Api.getTenantAdminAuditLogs({ limit: 100, search }),
        Api.getTenantAdminAuditStats(),
        Api.getAdminRiskSummary(),
        Api.getAdminComplianceSummary(),
      ]);
      setLogs(Array.isArray(logResult?.logs) ? logResult.logs : []);
      setStats({
        totalLogs: Number(statsResult?.totalLogs || 0),
        unresolvedCount: Number(statsResult?.unresolvedCount || 0),
        highRiskCount: Number(statsResult?.highRiskCount || 0),
      });
      setRiskSummary(riskResult?.summary || null);
      setComplianceSummary(complianceResult?.summary || null);
      setRetentionDays(
        Number(complianceResult?.summary?.dataRetention?.auditLogRetentionDays || 730)
      );
      setHasLoaded(true);
    } catch (error: any) {
      const message =
        error?.message || t('admin.security.auditLog.errors.load', 'Failed to load audit logs');
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [search, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = await Api.exportTenantAdminAuditLogs();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `admin-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(t('admin.security.auditLog.toasts.exportReady', 'Audit export ready'));
    } catch (error: any) {
      toast.error(
        error?.message || t('admin.security.auditLog.errors.export', 'Failed to export audit logs')
      );
    } finally {
      setExporting(false);
    }
  };

  const saveRetention = async () => {
    try {
      await Api.updateAdminComplianceDataRetention({
        ...(complianceSummary?.dataRetention || {}),
        auditLogRetentionDays: retentionDays,
      });
      setComplianceSummary((current: any) => ({
        ...(current || {}),
        dataRetention: {
          ...(current?.dataRetention || {}),
          auditLogRetentionDays: retentionDays,
        },
      }));
      toast.success(
        t('admin.security.auditLog.toasts.retentionUpdated', 'Audit retention updated')
      );
    } catch (error: any) {
      toast.error(
        error?.message ||
          t('admin.security.auditLog.errors.retention', 'Failed to update retention')
      );
    }
  };

  const auditColumns: TableColumn[] = [
    {
      id: 'action',
      label: t('admin.security.auditLog.columns.action', 'Action'),
      width: '260px',
      render: (row) => (
        <div>
          <div className="font-medium text-slate-900 dark:text-white">{row.action}</div>
          {row.metadata ? (
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{row.metadata}</div>
          ) : null}
        </div>
      ),
    },
    {
      id: 'actor',
      label: t('admin.security.auditLog.columns.actor', 'Actor'),
      width: '180px',
      render: (row) => <span className="text-slate-600 dark:text-slate-300">{row.actor}</span>,
    },
    {
      id: 'risk',
      label: t('admin.security.auditLog.columns.risk', 'Risk'),
      width: '160px',
      filterable: true,
      filterOptions: [
        { value: 'low', label: t('admin.security.auditLog.risk.low', 'Low') },
        { value: 'medium', label: t('admin.security.auditLog.risk.medium', 'Medium') },
        { value: 'high', label: t('admin.security.auditLog.risk.high', 'High') },
        { value: 'critical', label: t('admin.security.auditLog.risk.critical', 'Critical') },
      ],
      render: (row) => (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-white/10 dark:text-slate-200">
          <ShieldAlert className="h-3.5 w-3.5" />
          {row.risk}
        </span>
      ),
    },
    {
      id: 'logStatus',
      label: t('admin.security.auditLog.columns.status', 'Status'),
      width: '120px',
      filterable: true,
      filterOptions: [
        { value: 'RESOLVED', label: t('admin.security.auditLog.status.resolved', 'Resolved') },
        { value: 'OPEN', label: t('admin.security.auditLog.status.open', 'Open') },
        { value: 'PENDING', label: t('admin.security.auditLog.status.pending', 'Pending') },
      ],
      render: (row) => <span className="text-slate-600 dark:text-slate-300">{row.logStatus}</span>,
    },
    {
      id: 'createdAt',
      label: t('admin.security.auditLog.columns.created', 'Created'),
      width: '180px',
      render: (row) => <span className="text-slate-600 dark:text-slate-300">{row.createdAt}</span>,
    },
  ];

  if (!hasLoaded && loadError && !loading) {
    return (
      <div
        className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
        role="alert"
      >
        <p>{loadError}</p>
        <button type="button" onClick={() => void load()} className="mt-3 font-medium underline">
          {t('common.retry', 'Retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {loadError ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
          role="alert"
        >
          <span>{loadError}</span>
          <button type="button" onClick={() => void load()} className="font-medium underline">
            {t('common.retry', 'Retry')}
          </button>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('admin.security.auditLog.stats.totalLogs', 'Total logs')}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            {stats.totalLogs}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('admin.security.auditLog.stats.unresolved', 'Unresolved')}
          </p>
          <p className="mt-2 text-2xl font-semibold text-amber-600 dark:text-amber-400">
            {stats.unresolvedCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('admin.security.auditLog.stats.highRisk', 'High risk')}
          </p>
          <p className="mt-2 text-2xl font-semibold text-danger-600 dark:text-danger-400">
            {stats.highRiskCount}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('admin.security.auditLog.riskIncidents.title', 'Risk & incidents')}
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {t(
              'admin.security.auditLog.riskIncidents.tracked',
              'LLM incidents tracked: {{count}}',
              {
                count: riskSummary?.incidents?.length || 0,
              }
            )}
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {t(
              'admin.security.auditLog.riskIncidents.highRiskChanges',
              'High-risk admin changes: {{count}}',
              {
                count: riskSummary?.audit?.highRiskCount || 0,
              }
            )}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('admin.security.auditLog.compliance.title', 'Compliance evidence')}
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {t('admin.security.auditLog.compliance.gdprEnabled', 'GDPR enabled: {{value}}', {
              value: complianceSummary?.gdpr?.enabled
                ? t('admin.security.auditLog.compliance.yes', 'yes')
                : t('admin.security.auditLog.compliance.no', 'no'),
            })}
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {t(
              'admin.security.auditLog.compliance.retentionDays',
              'Audit retention days: {{count}}',
              {
                count: complianceSummary?.dataRetention?.auditLogRetentionDays || 0,
              }
            )}
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="number"
              min={30}
              value={retentionDays}
              onChange={(event) => setRetentionDays(Number(event.target.value || 730))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-navy-900 dark:text-white"
            />
            <button
              onClick={() => void saveRetention()}
              className="rounded-lg bg-c-text text-c-bg px-3 py-2 text-sm font-medium hover:bg-c-text-secondary"
            >
              {t('admin.security.auditLog.actions.saveRetention', 'Save retention')}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('admin.security.auditLog.title', 'Admin Audit Log')}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t(
                'admin.security.auditLog.description',
                'Membership, security, collaboration, and integration changes emitted by P32 surfaces.'
              )}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t(
                'admin.security.auditLog.searchPlaceholder',
                'Search action, actor, metadata...'
              )}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-navy-900 dark:text-white"
            />
            <button
              onClick={() => void load()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 dark:border-white/10 dark:text-slate-300"
            >
              <RefreshCw className="h-4 w-4" />
              {t('admin.security.auditLog.actions.refresh', 'Refresh')}
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-c-text text-c-bg px-4 py-2 text-sm font-medium hover:bg-c-text-secondary disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {t('admin.security.auditLog.actions.exportCsv', 'Export CSV')}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {t('admin.security.auditLog.loading', 'Loading audit logs...')}
          </div>
        ) : (
          <div className="mt-5">
            <FilterableTable
              columns={auditColumns}
              data={logs.map((log) => ({
                id: log.id,
                action: String(log.action_type || '').replaceAll('_', ' '),
                metadata: String(log.metadata_json || '').slice(0, 120),
                actor: log.admin_id,
                risk: log.risk_level ? `${log.risk_level} (${log.risk_score})` : '-',
                logStatus: log.status || '-',
                createdAt: log.created_at ? new Date(log.created_at).toLocaleString() : '-',
              }))}
              hideRowActions
              activeFilters={auditFilters}
              onFilterChange={setAuditFilters}
              emptyMessage={t(
                'admin.security.auditLog.emptyMessage',
                'No audit events found for this workspace.'
              )}
              persistKey="admin-audit-table"
              canvasClassName=""
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAuditLogPanel;
