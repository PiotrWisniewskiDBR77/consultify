/**
 * Admin Command Center Panel (F-CC1 fundament + F-CC2 pierwsze wiring +
 * F-CC3/F-CC4 domknięcie zakładek, blok Harvey-Parity HP-10…13).
 *
 * Sekcja `command` w hubie org-admina (`AdminSettingsModule`) — "Trust &
 * Control": przegląd posture spinający istniejące panele (role/SSO/audyt,
 * reużyte 1:1, NIE przepisane) + wiring 16 endpointów
 * `/api/admin/enterprise-compliance/*` (SOC2 export, DLP, data residency,
 * retencja, polityka AI).
 *
 * Zakładka "Przegląd": kafle-linki do people/security/audit (reuse) + 5
 * read-only kafli podpiętych pod realne endpointy (residency, AI policy,
 * DLP count, retention count, ostatni eksport SOC2). Pozostałe zakładki
 * (Audyt SOC2 / DLP / Residency / Retencja / AI-policy) mają pełny wiring —
 * patrz `./commandCenter/*Tab.tsx`.
 */
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  ClipboardCheck,
  Clock,
  Globe,
  Loader2,
  Lock,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';

import { Api } from '../../services/api';
import {
  type AuditExportResult,
  type DataResidencyPolicy,
  getAiPolicy,
  getComplianceAuditExport,
  getComplianceCostAttribution,
  getDataResidency,
  getDlpRules,
  getRetentionSchedules,
  type OrgAiPolicy,
  type RetentionSchedule,
} from '../../services/enterpriseComplianceApi';
import { cn } from '../../utils/cn';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';
import type { AdminSettingsSection } from './AdminSettingsSidebar';
import { CommandCenterAgentTraceTab } from './commandCenter/CommandCenterAgentTraceTab';
import { CommandCenterAiPolicyTab } from './commandCenter/CommandCenterAiPolicyTab';
import { CommandCenterAuditTab } from './commandCenter/CommandCenterAuditTab';
import { CommandCenterBenchmarkTab } from './commandCenter/CommandCenterBenchmarkTab';
import { CommandCenterDlpTab } from './commandCenter/CommandCenterDlpTab';
import { CommandCenterResidencyTab } from './commandCenter/CommandCenterResidencyTab';
import { CommandCenterRetentionTab } from './commandCenter/CommandCenterRetentionTab';
type TabId =
  | 'overview'
  | 'agent-trace'
  | 'audit'
  | 'dlp'
  | 'residency'
  | 'retention'
  | 'ai-policy'
  | 'benchmark';
interface AdminCommandCenterPanelProps {
  onSectionChange?: (section: AdminSettingsSection) => void;
  aggregationOnly?: boolean;
  screen?: 'attention-queue' | 'cost-capacity';
}
interface AttentionSignal {
  id: string;
  title: string;
  source: string;
  freshness: string;
  severity: 'critical' | 'warning' | 'info';
  href: string;
  detail: string;
}
const CommandCenterAttentionQueue: React.FC = () => {
  const { t } = useTranslation();
  const [signals, setSignals] = useState<AttentionSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const freshness = new Date().toLocaleString();
      const results = await Promise.allSettled([
        Api.getAdminRiskSummary(),
        Api.getTenantAdminAuditStats(),
        Api.getAdminBillingAlerts(),
        Api.getHealthPanelSummary(),
      ]);
      if (!alive) return;
      const [risk, audit, billing, health] = results.map((item) =>
        item.status === 'fulfilled' ? item.value : null
      );
      const next: AttentionSignal[] = [];
      if (risk)
        next.push({
          id: 'risk',
          title: t('admin.command.attention-queue.signals.riskTitle'),
          source: 'GET /api/admin/risk/summary',
          freshness,
          severity: Number(risk?.highRiskCount ?? 0) > 0 ? 'critical' : 'info',
          href: '/admin/security/risk-summary',
          detail: t('admin.command.attention-queue.signals.riskDetail', {
            count: Number(risk?.highRiskCount ?? 0),
          }),
        });
      if (audit)
        next.push({
          id: 'audit',
          title: t('admin.command.attention-queue.signals.auditTitle'),
          source: 'GET /api/admin/audit-logs/stats',
          freshness,
          severity: Number(audit?.unresolvedCount ?? 0) > 0 ? 'warning' : 'info',
          href: '/admin/audit/events',
          detail: t('admin.command.attention-queue.signals.auditDetail', {
            v0: Number(audit?.unresolvedCount ?? 0),
          }),
        });
      const billingItems = billing
        ? Array.isArray(billing?.alerts)
          ? billing.alerts
          : Array.isArray(billing)
            ? billing
            : []
        : null;
      if (billingItems)
        next.push({
          id: 'billing',
          title: t('admin.command.attention-queue.signals.billingTitle'),
          source: 'GET /api/admin/billing/alerts',
          freshness,
          severity: billingItems.length > 0 ? 'warning' : 'info',
          href: '/admin/billing/budgets-alerts',
          detail: t('admin.command.attention-queue.signals.billingDetail', {
            v0: billingItems.length,
          }),
        });
      if (health)
        next.push({
          id: 'health',
          title: t('admin.command.attention-queue.signals.healthTitle'),
          source: 'GET /api/admin/health-panel/summary',
          freshness,
          severity:
            Number(health?.summary?.failed ?? health?.failed ?? 0) > 0 ? 'critical' : 'info',
          href: '/admin/health/service-status',
          detail: t('admin.command.attention-queue.signals.healthDetail', {
            v0: Number(health?.summary?.failed ?? health?.failed ?? 0),
          }),
        });
      const rank = {
        critical: 0,
        warning: 1,
        info: 2,
      };
      setSignals(next.sort((a, b) => rank[a.severity] - rank[b.severity]));
      setError(next.length === 0 ? t('admin.command.attention-queue.allSourcesError') : null);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [t]);
  if (loading)
    return (
      <div className="flex items-center gap-2 text-sm text-c-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('admin.command.attention-queue.loading')}
      </div>
    );
  if (error)
    return (
      <div
        role="alert"
        className="rounded-xl border border-c-danger bg-c-surface p-4 text-sm text-c-danger"
      >
        {error}
      </div>
    );
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-c-text">
          {t('admin.command.attention-queue.title')}
        </h2>
        <p className="mt-1 text-sm text-c-text-secondary">
          {t('admin.command.attention-queue.description')}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {signals.map((signal) => (
          <Link
            key={signal.id}
            to={signal.href}
            className="rounded-xl border border-c-border bg-c-surface p-4 hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 ring-[color:var(--c-focus)]"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-c-text">{signal.title}</h3>
              <span
                className={
                  signal.severity === 'critical'
                    ? 'text-xs font-medium text-c-danger'
                    : 'text-xs font-medium text-c-text-secondary'
                }
              >
                {signal.severity}
              </span>
            </div>
            <p className="mt-2 text-sm text-c-text-secondary">{signal.detail}</p>
            <dl className="mt-3 space-y-1 text-xs text-c-text-muted">
              <div>
                <dt className="inline font-medium">
                  {t('admin.command.attention-queue.sourceLabel')}
                </dt>
                <dd className="inline">{signal.source}</dd>
              </div>
              <div>
                <dt className="inline font-medium">
                  {t('admin.command.attention-queue.freshnessLabel')}
                </dt>
                <dd className="inline">{signal.freshness}</dd>
              </div>
            </dl>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-c-text">
              {t('admin.command.attention-queue.actions.openCanonical')}
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
};
const CommandCenterCostCapacity: React.FC = () => {
  const { t } = useTranslation();
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    billing: any;
    usage: any;
    alerts: any[];
    health: any;
    attribution: any;
  }>({
    loading: true,
    error: null,
    billing: null,
    usage: null,
    alerts: [],
    health: null,
    attribution: null,
  });
  const [freshness, setFreshness] = useState('');
  useEffect(() => {
    let alive = true;
    void (async () => {
      const result = await Promise.allSettled([
        Api.getAdminBillingSummary(),
        Api.getAdminBillingUsageDetails(),
        Api.getAdminBillingAlerts(),
        Api.getHealthPanelSummary(),
        getComplianceCostAttribution(),
      ]);
      if (!alive) return;
      const values = result.map((item) => (item.status === 'fulfilled' ? item.value : null));
      const alerts = Array.isArray(values[2]?.alerts)
        ? values[2].alerts
        : Array.isArray(values[2])
          ? values[2]
          : [];
      setState({
        loading: false,
        error:
          values.filter(Boolean).length < 4
            ? t('admin.command.cost-capacity.partialSourcesWarning')
            : null,
        billing: values[0],
        usage: values[1],
        alerts,
        health: values[3],
        attribution: values[4],
      });
      setFreshness(new Date().toLocaleString());
    })();
    return () => {
      alive = false;
    };
  }, [t]);
  const rows = useMemo<TableRow[]>(
    () =>
      (state.attribution?.byUser ?? []).map((item: any) => ({
        id: item.userId,
        userId: item.userId,
        cost: item.cost,
        messageCount: item.messageCount,
      })),
    [state.attribution]
  );
  const columns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'userId',
        label: t('admin.command.cost-capacity.columns.user'),
      },
      {
        id: 'cost',
        label: t('admin.command.cost-capacity.columns.cost'),
        render: (row) => Number(row.cost ?? 0).toFixed(2),
      },
      {
        id: 'messageCount',
        label: t('admin.command.cost-capacity.columns.messages'),
      },
    ],
    [t]
  );
  if (state.loading)
    return (
      <div className="flex items-center gap-2 text-sm text-c-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('admin.command.cost-capacity.loading')}
      </div>
    );
  const currentCost = Number(
    state.billing?.currentCost ?? state.billing?.totalCost ?? state.attribution?.totalCost ?? 0
  );
  const forecast = Number(state.billing?.forecast ?? state.billing?.projectedCost ?? 0);
  const utilization = Number(state.usage?.utilizationPercent ?? state.usage?.utilization ?? 0);
  const seats = Number(state.billing?.seatsUsed ?? state.usage?.seatsUsed ?? 0);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-c-text">
          {t('admin.command.cost-capacity.title')}
        </h2>
        <p className="mt-1 text-sm text-c-text-secondary">
          {t('admin.command.cost-capacity.description')}
        </p>
        <p className="mt-1 text-xs text-c-text-muted">
          {t('admin.command.cost-capacity.freshnessLabel')}
          {freshness}
        </p>
      </div>
      {state.error && (
        <div
          role="alert"
          className="rounded-xl border border-c-info bg-c-surface p-3 text-sm text-c-text-secondary"
        >
          {state.error}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [
            t('admin.command.cost-capacity.metrics.currentCost'),
            currentCost.toFixed(2),
            'billing/summary',
          ],
          [
            t('admin.command.cost-capacity.metrics.forecast'),
            forecast.toFixed(2),
            'billing/summary',
          ],
          [
            t('admin.command.cost-capacity.metrics.utilization'),
            `${utilization}%`,
            'billing/usage-details',
          ],
          [t('admin.command.cost-capacity.metrics.usedSeats'), String(seats), 'billing/summary'],
        ].map(([label, value, source]) => (
          <div key={label} className="rounded-xl border border-c-border bg-c-surface p-4">
            <p className="text-xs text-c-text-secondary">{label}</p>
            <p className="mt-1 text-xl font-semibold text-c-text">{value}</p>
            <p className="mt-2 text-[10px] text-c-text-muted">
              {t('admin.command.cost-capacity.source', {
                source,
              })}
            </p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-c-border bg-c-surface p-2">
        <StandardTable
          columns={columns}
          data={rows}
          empty={{
            title: t('admin.command.cost-capacity.empty.title'),
            description: t('admin.command.cost-capacity.empty.description'),
          }}
          persistKey="admin.costCapacity"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          to="/admin/billing/budgets-alerts"
          className="rounded-lg border border-c-border px-3 py-2 text-sm font-medium text-c-text focus-visible:outline-none focus-visible:ring-2 ring-[color:var(--c-focus)]"
        >
          {t('admin.command.cost-capacity.budgetAlerts', {
            count: state.alerts.length,
          })}
        </Link>
        <Link
          to="/admin/billing/usage-costs"
          className="rounded-lg border border-c-border px-3 py-2 text-sm font-medium text-c-text focus-visible:outline-none focus-visible:ring-2 ring-[color:var(--c-focus)]"
        >
          {t('admin.command.cost-capacity.actions.usageDetails')}
        </Link>
        <span className="px-3 py-2 text-xs text-c-text-muted">
          {t('admin.command.cost-capacity.healthStatus', {
            count: Number(state.health?.summary?.failed ?? 0),
          })}
        </span>
      </div>
    </div>
  );
};
interface LinkTile {
  id: string;
  section: AdminSettingsSection;
  icon: React.ElementType;
  labelKey: string;
  descriptionKey: string;
}
const LINK_TILES: LinkTile[] = [
  {
    id: 'people',
    section: 'people',
    icon: Users,
    labelKey: 'commandCenter.overview.tiles.people.label',
    descriptionKey: 'commandCenter.overview.tiles.people.description',
  },
  {
    id: 'security',
    section: 'security',
    icon: ShieldCheck,
    labelKey: 'commandCenter.overview.tiles.security.label',
    descriptionKey: 'commandCenter.overview.tiles.security.description',
  },
  {
    id: 'audit',
    section: 'audit',
    icon: ScrollText,
    labelKey: 'commandCenter.overview.tiles.audit.label',
    descriptionKey: 'commandCenter.overview.tiles.audit.description',
  },
];
const LinkTileCard: React.FC<{
  tile: LinkTile;
  onOpen?: (section: AdminSettingsSection) => void;
}> = ({ tile, onOpen }) => {
  const { t } = useTranslation();
  const Icon = tile.icon;
  return (
    <button
      type="button"
      onClick={() => onOpen?.(tile.section)}
      className="group flex w-full flex-col items-start gap-3 rounded-xl border border-c-border bg-c-surface p-4 text-left transition hover:border-c-focus hover:bg-c-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-c-focus"
    >
      <div className="flex w-full items-start justify-between">
        <div className="rounded-lg bg-c-surface-raised p-2 text-c-text-secondary">
          <Icon className="h-4 w-4" />
        </div>
        <ArrowRight className="h-4 w-4 text-c-text-muted transition group-hover:translate-x-0.5 group-hover:text-c-text-secondary" />
      </div>
      <div>
        <p className="text-sm font-semibold text-c-text">{t(tile.labelKey)}</p>
        <p className="mt-1 text-xs text-c-text-secondary">{t(tile.descriptionKey)}</p>
      </div>
      <span className="text-xs font-medium text-c-text-secondary group-hover:text-c-text">
        {t('commandCenter.overview.tiles.open')}
      </span>
    </button>
  );
};
interface DataTileState<T> {
  loading: boolean;
  error: string | null;
  value: T | null;
}
const DataTileShell: React.FC<{
  icon: React.ElementType;
  label: string;
  loading: boolean;
  error: string | null;
  children: React.ReactNode;
}> = ({ icon: Icon, label, loading, error, children }) => {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-c-border bg-c-surface p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-c-text-secondary">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-[10px] text-c-text-muted">
        {t('admin.command.attention-queue.currentSource')}
      </p>
      <div className="mt-2">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-c-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-c-danger">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};
const CommandCenterOverviewTab: React.FC<{
  onSectionChange?: (section: AdminSettingsSection) => void;
}> = ({ onSectionChange }) => {
  const { t } = useTranslation();
  const [residency, setResidency] = useState<DataTileState<DataResidencyPolicy>>({
    loading: true,
    error: null,
    value: null,
  });
  const [aiPolicy, setAiPolicy] = useState<DataTileState<OrgAiPolicy>>({
    loading: true,
    error: null,
    value: null,
  });
  const [dlp, setDlp] = useState<
    DataTileState<{
      active: number;
      total: number;
    }>
  >({
    loading: true,
    error: null,
    value: null,
  });
  const [retention, setRetention] = useState<
    DataTileState<{
      count: number;
      nextCleanupAt: string | null;
    }>
  >({
    loading: true,
    error: null,
    value: null,
  });
  const [auditExport, setAuditExport] = useState<DataTileState<AuditExportResult>>({
    loading: true,
    error: null,
    value: null,
  });
  const loadResidency = useCallback(async () => {
    setResidency((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));
    try {
      const value = await getDataResidency();
      setResidency({
        loading: false,
        error: null,
        value,
      });
    } catch (error: any) {
      setResidency({
        loading: false,
        error: error?.message || t('commandCenter.overview.tiles.residency.error'),
        value: null,
      });
    }
  }, [t]);
  const loadAiPolicy = useCallback(async () => {
    setAiPolicy((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));
    try {
      const value = await getAiPolicy();
      setAiPolicy({
        loading: false,
        error: null,
        value,
      });
    } catch (error: any) {
      setAiPolicy({
        loading: false,
        error: error?.message || t('commandCenter.overview.tiles.aiPolicy.error'),
        value: null,
      });
    }
  }, [t]);
  const loadDlp = useCallback(async () => {
    setDlp((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));
    try {
      const rules = await getDlpRules();
      setDlp({
        loading: false,
        error: null,
        value: {
          active: rules.filter((r) => r.isActive).length,
          total: rules.length,
        },
      });
    } catch (error: any) {
      setDlp({
        loading: false,
        error: error?.message || t('commandCenter.overview.tiles.dlp.error'),
        value: null,
      });
    }
  }, [t]);
  const loadRetention = useCallback(async () => {
    setRetention((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));
    try {
      const schedules = await getRetentionSchedules();
      const upcoming = schedules
        .map((s: RetentionSchedule) => s.nextCleanupAt)
        .filter((d): d is string => !!d)
        .sort();
      setRetention({
        loading: false,
        error: null,
        value: {
          count: schedules.length,
          nextCleanupAt: upcoming[0] || null,
        },
      });
    } catch (error: any) {
      setRetention({
        loading: false,
        error: error?.message || t('commandCenter.overview.tiles.retention.error'),
        value: null,
      });
    }
  }, [t]);
  const loadAuditExport = useCallback(async () => {
    setAuditExport((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));
    try {
      const value = await getComplianceAuditExport({});
      setAuditExport({
        loading: false,
        error: null,
        value,
      });
    } catch (error: any) {
      setAuditExport({
        loading: false,
        error: error?.message || t('commandCenter.overview.tiles.auditExport.error'),
        value: null,
      });
    }
  }, [t]);
  useEffect(() => {
    void loadResidency();
    void loadAiPolicy();
    void loadDlp();
    void loadRetention();
    void loadAuditExport();
  }, [loadResidency, loadAiPolicy, loadDlp, loadRetention, loadAuditExport]);
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-semibold text-c-text">
          {t('commandCenter.overview.linksTitle')}
        </h4>
        <p className="mt-1 text-xs text-c-text-secondary">
          {t('commandCenter.overview.linksSubtitle')}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {LINK_TILES.map((tile) => (
            <LinkTileCard key={tile.id} tile={tile} onOpen={onSectionChange} />
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-c-text">
          {t('commandCenter.overview.complianceTitle')}
        </h4>
        <p className="mt-1 text-xs text-c-text-secondary">
          {t('commandCenter.overview.complianceSubtitle')}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <DataTileShell
            icon={Globe}
            label={t('commandCenter.overview.tiles.residency.label')}
            loading={residency.loading}
            error={residency.error}
          >
            {residency.value && (
              <div>
                <p className="text-lg font-semibold text-c-text">
                  {residency.value.dataResidencyRegion ||
                    t('commandCenter.overview.tiles.residency.notSet')}
                </p>
                <p className="mt-1 text-xs text-c-text-secondary">
                  {residency.value.enforceEuOnly
                    ? t('commandCenter.overview.tiles.residency.euEnforced')
                    : t('commandCenter.overview.tiles.residency.euNotEnforced')}
                </p>
              </div>
            )}
          </DataTileShell>

          <DataTileShell
            icon={Sparkles}
            label={t('commandCenter.overview.tiles.aiPolicy.label')}
            loading={aiPolicy.loading}
            error={aiPolicy.error}
          >
            {aiPolicy.value && (
              <div>
                <p className="text-lg font-semibold text-c-text">
                  {t('commandCenter.overview.tiles.aiPolicy.citationMode', {
                    mode: aiPolicy.value.requiredCitationMode,
                  })}
                </p>
                <p className="mt-1 text-xs text-c-text-secondary">
                  {t('commandCenter.overview.tiles.aiPolicy.maxTokens', {
                    tokens: aiPolicy.value.maxTokensPerMessage,
                  })}
                </p>
              </div>
            )}
          </DataTileShell>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <DataTileShell
          icon={Lock}
          label={t('commandCenter.overview.tiles.dlp.label')}
          loading={dlp.loading}
          error={dlp.error}
        >
          {dlp.value &&
            (dlp.value.total === 0 ? (
              <p className="text-sm text-c-text-secondary">
                {t('commandCenter.overview.tiles.dlp.empty')}
              </p>
            ) : (
              <p className="text-lg font-semibold text-c-text">
                {t('commandCenter.overview.tiles.dlp.activeCount', {
                  active: dlp.value.active,
                  total: dlp.value.total,
                })}
              </p>
            ))}
        </DataTileShell>

        <DataTileShell
          icon={Clock}
          label={t('commandCenter.overview.tiles.retention.label')}
          loading={retention.loading}
          error={retention.error}
        >
          {retention.value &&
            (retention.value.count === 0 ? (
              <p className="text-sm text-c-text-secondary">
                {t('commandCenter.overview.tiles.retention.empty')}
              </p>
            ) : (
              <div>
                <p className="text-lg font-semibold text-c-text">
                  {t('commandCenter.overview.tiles.retention.scheduleCount', {
                    count: retention.value.count,
                  })}
                </p>
                {retention.value.nextCleanupAt && (
                  <p className="mt-1 text-xs text-c-text-secondary">
                    {t('commandCenter.overview.tiles.retention.nextCleanup', {
                      date: new Date(retention.value.nextCleanupAt).toLocaleDateString(),
                    })}
                  </p>
                )}
              </div>
            ))}
        </DataTileShell>

        <DataTileShell
          icon={ScrollText}
          label={t('commandCenter.overview.tiles.auditExport.label')}
          loading={auditExport.loading}
          error={auditExport.error}
        >
          {auditExport.value && (
            <div>
              <p className="text-lg font-semibold text-c-text">
                {t('commandCenter.overview.tiles.auditExport.entries', {
                  count: auditExport.value.totalCount,
                })}
              </p>
              <p className="mt-1 text-xs text-c-text-secondary">
                {t('commandCenter.overview.tiles.auditExport.generatedAt', {
                  time: new Date(auditExport.value.exportedAt).toLocaleString(),
                })}
              </p>
            </div>
          )}
        </DataTileShell>
      </div>
    </div>
  );
};
export const AdminCommandCenterPanel: React.FC<AdminCommandCenterPanelProps> = ({
  onSectionChange,
  aggregationOnly = false,
  screen,
}) => {
  const { t } = useTranslation();
  const tabs: Array<{
    id: TabId;
    label: string;
    icon: React.ElementType;
  }> = useMemo(
    () => [
      {
        id: 'overview',
        label: t('commandCenter.tabs.overview'),
        icon: ShieldCheck,
      },
      {
        id: 'agent-trace',
        label: t('commandCenter.tabs.agentTrace'),
        icon: Bot,
      },
      {
        id: 'audit',
        label: t('commandCenter.tabs.audit'),
        icon: ScrollText,
      },
      {
        id: 'dlp',
        label: t('commandCenter.tabs.dlp'),
        icon: Lock,
      },
      {
        id: 'residency',
        label: t('commandCenter.tabs.residency'),
        icon: Globe,
      },
      {
        id: 'retention',
        label: t('commandCenter.tabs.retention'),
        icon: Clock,
      },
      {
        id: 'ai-policy',
        label: t('commandCenter.tabs.aiPolicy'),
        icon: Sparkles,
      },
      {
        id: 'benchmark',
        label: t('commandCenter.tabs.benchmark'),
        icon: ClipboardCheck,
      },
    ],
    [t]
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = useMemo(() => {
    const raw = searchParams.get('tab');
    return tabs.some((tab) => tab.id === raw) ? (raw as TabId) : 'overview';
  }, [searchParams, tabs]);
  const [activeTab, setActiveTab] = useState<TabId>(requestedTab);
  useEffect(() => {
    setActiveTab(requestedTab);
  }, [requestedTab]);
  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', tab);
    setSearchParams(nextParams, {
      replace: true,
    });
  };
  if (screen === 'attention-queue') return <CommandCenterAttentionQueue />;
  if (screen === 'cost-capacity') return <CommandCenterCostCapacity />;
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-c-border bg-c-surface p-5">
        <h3 className="text-lg font-semibold text-c-text">{t('commandCenter.title')}</h3>
        <p className="mt-1 text-sm text-c-text-secondary">{t('commandCenter.description')}</p>
      </div>

      {!aggregationOnly && (
        <div className="rounded-2xl border border-c-border bg-c-surface p-2">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition',
                    activeTab === tab.id
                      ? 'bg-c-text text-c-bg'
                      : 'bg-transparent text-c-text-secondary hover:bg-c-surface-raised'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(aggregationOnly || activeTab === 'overview') && (
        <CommandCenterOverviewTab onSectionChange={onSectionChange} />
      )}
      {!aggregationOnly && activeTab === 'agent-trace' && <CommandCenterAgentTraceTab />}
      {!aggregationOnly && activeTab === 'audit' && <CommandCenterAuditTab />}
      {!aggregationOnly && activeTab === 'dlp' && <CommandCenterDlpTab />}
      {!aggregationOnly && activeTab === 'residency' && <CommandCenterResidencyTab />}
      {!aggregationOnly && activeTab === 'retention' && <CommandCenterRetentionTab />}
      {!aggregationOnly && activeTab === 'ai-policy' && <CommandCenterAiPolicyTab />}
      {!aggregationOnly && activeTab === 'benchmark' && <CommandCenterBenchmarkTab />}
    </div>
  );
};
export default AdminCommandCenterPanel;
