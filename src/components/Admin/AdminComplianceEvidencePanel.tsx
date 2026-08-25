import { Download, ShieldCheck } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Api } from '../../services/api';
import {
  getAiPolicy,
  getDataResidency,
  getRetentionSchedules,
} from '../../services/enterpriseComplianceApi';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';
const button =
  'inline-flex items-center gap-2 rounded-lg border border-c-border px-3 py-2 text-sm font-medium text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 ring-[color:var(--c-focus)] disabled:opacity-50';
export const AdminComplianceEvidencePanel: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<any>({
    logs: [],
    stats: null,
    compliance: null,
    residency: null,
    retention: [],
    aiPolicy: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [freshness, setFreshness] = useState('');
  const [exporting, setExporting] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [logs, stats, compliance, residency, retention, aiPolicy] = await Promise.all([
        Api.getTenantAdminAuditLogs({
          limit: 50,
        }),
        Api.getTenantAdminAuditStats(),
        Api.getAdminComplianceSummary(),
        getDataResidency(),
        getRetentionSchedules(),
        getAiPolicy(),
      ]);
      setData({
        logs: Array.isArray(logs?.logs) ? logs.logs : [],
        stats,
        compliance: compliance?.summary ?? compliance,
        residency,
        retention,
        aiPolicy,
      });
      setFreshness(new Date().toLocaleString());
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.audit.compliance-evidence.errors.load'));
    } finally {
      setLoading(false);
    }
  }, [t]);
  React.useEffect(() => void load(), [load]);
  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await Api.exportTenantAdminAuditLogs();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `admin-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t('admin.audit.compliance-evidence.notifications.exportReady'));
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t('admin.audit.compliance-evidence.errors.export')
      );
    } finally {
      setExporting(false);
    }
  };
  const rows = useMemo<TableRow[]>(
    () =>
      data.logs.map((log: any, index: number) => ({
        ...log,
        id: log.id ?? `log-${index}`,
      })),
    [data.logs]
  );
  const columns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'action',
        label: t('admin.audit.compliance-evidence.columns.event'),
      },
      {
        id: 'actor',
        label: t('admin.audit.compliance-evidence.columns.actor'),
      },
      {
        id: 'risk',
        label: t('admin.audit.compliance-evidence.columns.risk'),
      },
      {
        id: 'createdAt',
        label: t('admin.audit.compliance-evidence.columns.time'),
        render: (row) => row.createdAt ?? row.created_at ?? '—',
      },
    ],
    [t]
  );
  const cards = [
    {
      label: t('admin.audit.compliance-evidence.cards.dataResidency'),
      value:
        data.residency?.dataResidencyRegion ?? t('admin.audit.compliance-evidence.values.notSet'),
      href: '/admin/command/compliance-posture?tab=residency',
      source: '/enterprise-compliance/data-residency',
    },
    {
      label: t('admin.audit.compliance-evidence.cards.retentionSchedules'),
      value: t('admin.audit.compliance-evidence.cards.retentionScheduleCount', {
        count: data.retention.length,
      }),
      href: '/admin/command/compliance-posture?tab=retention',
      source: '/enterprise-compliance/retention/schedules',
    },
    {
      label: t('admin.audit.compliance-evidence.cards.aiPolicy'),
      value:
        data.aiPolicy?.requiredCitationMode ?? t('admin.audit.compliance-evidence.values.notSet'),
      href: '/admin/command/compliance-posture?tab=ai-policy',
      source: '/enterprise-compliance/ai-policy',
    },
  ];
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-c-border bg-c-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-c-text">
              {t('admin.audit.compliance-evidence.title')}
            </h2>
            <p className="mt-1 text-sm text-c-text-secondary">
              {t('admin.audit.compliance-evidence.description')}
            </p>
            {freshness && (
              <p className="mt-1 text-xs text-c-text-muted">
                {t('admin.audit.compliance-evidence.freshness', { value: freshness })}
              </p>
            )}
          </div>
          <button className={button} disabled={exporting} onClick={() => void exportCsv()}>
            <Download className="h-4 w-4" />
            {t('admin.audit.compliance-evidence.actions.exportCsv')}
          </button>
        </div>
      </section>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-c-danger bg-c-surface p-4 text-sm text-c-danger"
        >
          {error}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [t('admin.audit.compliance-evidence.metrics.totalEvents'), data.stats?.totalLogs ?? 0],
          [
            t('admin.audit.compliance-evidence.metrics.unresolved'),
            data.stats?.unresolvedCount ?? 0,
          ],
          [t('admin.audit.compliance-evidence.metrics.highRisk'), data.stats?.highRiskCount ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-c-border bg-c-surface p-4">
            <p className="text-xs text-c-text-secondary">{label}</p>
            <p className="mt-1 text-xl font-semibold text-c-text">{value}</p>
            <p className="mt-2 text-[10px] text-c-text-muted">
              {t('admin.audit.compliance-evidence.sources.auditStats')}
            </p>
          </div>
        ))}
      </div>
      <section className="rounded-2xl border border-c-border bg-c-surface p-2">
        <StandardTable
          columns={columns}
          data={rows}
          loading={loading}
          error={error}
          onRetry={() => void load()}
          empty={{
            icon: ShieldCheck,
            title: t('admin.audit.compliance-evidence.empty.title'),
            description: t('admin.audit.compliance-evidence.empty.description'),
          }}
          persistKey="admin.complianceEvidence"
        />
      </section>
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.label}
            to={card.href}
            className="rounded-xl border border-c-border bg-c-surface p-4 focus-visible:outline-none focus-visible:ring-2 ring-[color:var(--c-focus)]"
          >
            <p className="text-xs text-c-text-secondary">{card.label}</p>
            <p className="mt-1 font-semibold text-c-text">{card.value}</p>
            <p className="mt-2 text-[10px] text-c-text-muted">
              {t('admin.audit.compliance-evidence.source', { path: card.source })}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
};
export default AdminComplianceEvidencePanel;
