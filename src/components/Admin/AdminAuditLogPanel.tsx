import { Download, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';

export const AdminAuditLogPanel: React.FC = () => {
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
  const [exporting, setExporting] = useState(false);
  const [riskSummary, setRiskSummary] = useState<any>(null);
  const [complianceSummary, setComplianceSummary] = useState<any>(null);
  const [retentionDays, setRetentionDays] = useState(730);

  const load = useCallback(async () => {
    try {
      setLoading(true);
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
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [search]);

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
      toast.success('Audit export ready');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to export audit logs');
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
      toast.success('Audit retention updated');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update retention');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Total logs
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            {stats.totalLogs}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Unresolved
          </p>
          <p className="mt-2 text-2xl font-semibold text-amber-600 dark:text-amber-400">
            {stats.unresolvedCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            High risk
          </p>
          <p className="mt-2 text-2xl font-semibold text-rose-600 dark:text-rose-400">
            {stats.highRiskCount}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Risk & incidents
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            LLM incidents tracked: {riskSummary?.incidents?.length || 0}
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            High-risk admin changes: {riskSummary?.audit?.highRiskCount || 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Compliance evidence
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            GDPR enabled: {complianceSummary?.gdpr?.enabled ? 'yes' : 'no'}
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Audit retention days: {complianceSummary?.dataRetention?.auditLogRetentionDays || 0}
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
              className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white"
            >
              Save retention
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Admin Audit Log
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Membership, security, collaboration, and integration changes emitted by P32 surfaces.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search action, actor, metadata..."
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-navy-900 dark:text-white"
            />
            <button
              onClick={() => void load()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 dark:border-white/10 dark:text-slate-300"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export CSV
            </button>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/10">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="py-3 pr-4">Action</th>
                <th className="py-3 pr-4">Actor</th>
                <th className="py-3 pr-4">Risk</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    Loading audit logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    No audit events found for this workspace.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-3 pr-4">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {String(log.action_type || '').replaceAll('_', ' ')}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {String(log.metadata_json || '').slice(0, 120)}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{log.admin_id}</td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-white/10 dark:text-slate-200">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        {log.risk_level} ({log.risk_score})
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{log.status}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-300">
                      {log.created_at ? new Date(log.created_at).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminAuditLogPanel;
