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
import { useSearchParams } from 'react-router-dom';

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
          title: 'Ryzyka wymagające przeglądu',
          source: 'GET /api/admin/risk/summary',
          freshness,
          severity: Number(risk?.highRiskCount ?? 0) > 0 ? 'critical' : 'info',
          href: '/admin/security/risk-summary',
          detail: `${Number(risk?.highRiskCount ?? 0)} wysokiego ryzyka`,
        });
      if (audit)
        next.push({
          id: 'audit',
          title: 'Nierozwiązane zdarzenia audytowe',
          source: 'GET /api/admin/audit-logs/stats',
          freshness,
          severity: Number(audit?.unresolvedCount ?? 0) > 0 ? 'warning' : 'info',
          href: '/admin/audit/events',
          detail: `${Number(audit?.unresolvedCount ?? 0)} nierozwiązanych`,
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
          title: 'Alerty budżetowe',
          source: 'GET /api/admin/billing/alerts',
          freshness,
          severity: billingItems.length > 0 ? 'warning' : 'info',
          href: '/admin/billing/budgets-alerts',
          detail: `${billingItems.length} aktywnych alertów`,
        });
      if (health)
        next.push({
          id: 'health',
          title: 'Stan usług organizacji',
          source: 'GET /api/admin/health-panel/summary',
          freshness,
          severity:
            Number(health?.summary?.failed ?? health?.failed ?? 0) > 0 ? 'critical' : 'info',
          href: '/admin/health/service-status',
          detail: `${Number(health?.summary?.failed ?? health?.failed ?? 0)} testów nieudanych`,
        });
      const rank = { critical: 0, warning: 1, info: 2 };
      setSignals(next.sort((a, b) => rank[a.severity] - rank[b.severity]));
      setError(next.length === 0 ? 'Nie udało się odczytać żadnego źródła sygnałów.' : null);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading)
    return (
      <div className="flex items-center gap-2 text-sm text-c-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" /> Ładowanie kolejki uwagi…
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
        <h2 className="text-lg font-semibold text-c-text">Kolejka uwagi</h2>
        <p className="mt-1 text-sm text-c-text-secondary">
          Sygnały z systemów kanonicznych; działania wykonuje się na ekranach źródłowych.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {signals.map((signal) => (
          <a
            key={signal.id}
            href={signal.href}
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
                <dt className="inline font-medium">Źródło: </dt>
                <dd className="inline">{signal.source}</dd>
              </div>
              <div>
                <dt className="inline font-medium">Świeżość: </dt>
                <dd className="inline">{signal.freshness}</dd>
              </div>
            </dl>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-c-text">
              Otwórz ekran kanoniczny <ArrowRight className="h-4 w-4" />
            </span>
          </a>
        ))}
      </div>
    </div>
  );
};

const CommandCenterCostCapacity: React.FC = () => {
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
            ? 'Część źródeł kosztu lub pojemności jest niedostępna.'
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
  }, []);
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
      { id: 'userId', label: 'Użytkownik' },
      { id: 'cost', label: 'Koszt', render: (row) => Number(row.cost ?? 0).toFixed(2) },
      { id: 'messageCount', label: 'Wiadomości' },
    ],
    []
  );
  if (state.loading)
    return (
      <div className="flex items-center gap-2 text-sm text-c-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" /> Ładowanie kosztu i pojemności…
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
        <h2 className="text-lg font-semibold text-c-text">Koszt i pojemność</h2>
        <p className="mt-1 text-sm text-c-text-secondary">
          Agregacja tylko do odczytu. Budżety edytuje ekran kanoniczny.
        </p>
        <p className="mt-1 text-xs text-c-text-muted">Świeżość: {freshness}</p>
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
          ['Koszt bieżący', currentCost.toFixed(2), 'billing/summary'],
          ['Prognoza', forecast.toFixed(2), 'billing/summary'],
          ['Wykorzystanie limitu', `${utilization}%`, 'billing/usage-details'],
          ['Miejsca zajęte', String(seats), 'billing/summary'],
        ].map(([label, value, source]) => (
          <div key={label} className="rounded-xl border border-c-border bg-c-surface p-4">
            <p className="text-xs text-c-text-secondary">{label}</p>
            <p className="mt-1 text-xl font-semibold text-c-text">{value}</p>
            <p className="mt-2 text-[10px] text-c-text-muted">Źródło: GET /api/admin/{source}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-c-border bg-c-surface p-2">
        <StandardTable
          columns={columns}
          data={rows}
          empty={{
            title: 'Brak atrybucji kosztów',
            description: 'Brak kosztów przypisanych użytkownikom w wybranym okresie.',
          }}
          persistKey="admin.costCapacity"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href="/admin/billing/budgets-alerts"
          className="rounded-lg border border-c-border px-3 py-2 text-sm font-medium text-c-text focus-visible:outline-none focus-visible:ring-2 ring-[color:var(--c-focus)]"
        >
          Alerty budżetowe ({state.alerts.length})
        </a>
        <a
          href="/admin/billing/usage-costs"
          className="rounded-lg border border-c-border px-3 py-2 text-sm font-medium text-c-text focus-visible:outline-none focus-visible:ring-2 ring-[color:var(--c-focus)]"
        >
          Szczegóły wykorzystania
        </a>
        <span className="px-3 py-2 text-xs text-c-text-muted">
          Stan: {Number(state.health?.summary?.failed ?? 0)} nieudanych prób
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
  labelDefault: string;
  descriptionKey: string;
  descriptionDefault: string;
}

const LINK_TILES: LinkTile[] = [
  {
    id: 'people',
    section: 'people',
    icon: Users,
    labelKey: 'commandCenter.overview.tiles.people.label',
    labelDefault: 'Team & Access',
    descriptionKey: 'commandCenter.overview.tiles.people.description',
    descriptionDefault: 'Roles, ownership, and permissions for this organization.',
  },
  {
    id: 'security',
    section: 'security',
    icon: ShieldCheck,
    labelKey: 'commandCenter.overview.tiles.security.label',
    labelDefault: 'SSO & Identity',
    descriptionKey: 'commandCenter.overview.tiles.security.description',
    descriptionDefault: 'Authentication policy, SCIM lifecycle, and delegated IAM.',
  },
  {
    id: 'audit',
    section: 'audit',
    icon: ScrollText,
    labelKey: 'commandCenter.overview.tiles.audit.label',
    labelDefault: 'Audit Log',
    descriptionKey: 'commandCenter.overview.tiles.audit.description',
    descriptionDefault: 'High-risk admin events and compliance evidence.',
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
        <p className="text-sm font-semibold text-c-text">
          {t(tile.labelKey, { defaultValue: tile.labelDefault })}
        </p>
        <p className="mt-1 text-xs text-c-text-secondary">
          {t(tile.descriptionKey, { defaultValue: tile.descriptionDefault })}
        </p>
      </div>
      <span className="text-xs font-medium text-c-text-secondary group-hover:text-c-text">
        {t('commandCenter.overview.tiles.open', { defaultValue: 'Open' })}
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
}> = ({ icon: Icon, label, loading, error, children }) => (
  <div className="rounded-xl border border-c-border bg-c-surface p-4">
    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-c-text-secondary">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
    <p className="mt-1 text-[10px] text-c-text-muted">Źródło: tenant admin API · odczyt bieżący</p>
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
  const [dlp, setDlp] = useState<DataTileState<{ active: number; total: number }>>({
    loading: true,
    error: null,
    value: null,
  });
  const [retention, setRetention] = useState<
    DataTileState<{ count: number; nextCleanupAt: string | null }>
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
    setResidency((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const value = await getDataResidency();
      setResidency({ loading: false, error: null, value });
    } catch (error: any) {
      setResidency({
        loading: false,
        error:
          error?.message ||
          t('commandCenter.overview.tiles.residency.error', 'Failed to load data residency policy'),
        value: null,
      });
    }
  }, [t]);

  const loadAiPolicy = useCallback(async () => {
    setAiPolicy((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const value = await getAiPolicy();
      setAiPolicy({ loading: false, error: null, value });
    } catch (error: any) {
      setAiPolicy({
        loading: false,
        error:
          error?.message ||
          t('commandCenter.overview.tiles.aiPolicy.error', 'Failed to load AI policy'),
        value: null,
      });
    }
  }, [t]);

  const loadDlp = useCallback(async () => {
    setDlp((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const rules = await getDlpRules();
      setDlp({
        loading: false,
        error: null,
        value: { active: rules.filter((r) => r.isActive).length, total: rules.length },
      });
    } catch (error: any) {
      setDlp({
        loading: false,
        error:
          error?.message || t('commandCenter.overview.tiles.dlp.error', 'Failed to load DLP rules'),
        value: null,
      });
    }
  }, [t]);

  const loadRetention = useCallback(async () => {
    setRetention((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const schedules = await getRetentionSchedules();
      const upcoming = schedules
        .map((s: RetentionSchedule) => s.nextCleanupAt)
        .filter((d): d is string => !!d)
        .sort();
      setRetention({
        loading: false,
        error: null,
        value: { count: schedules.length, nextCleanupAt: upcoming[0] || null },
      });
    } catch (error: any) {
      setRetention({
        loading: false,
        error:
          error?.message ||
          t('commandCenter.overview.tiles.retention.error', 'Failed to load retention schedules'),
        value: null,
      });
    }
  }, [t]);

  const loadAuditExport = useCallback(async () => {
    setAuditExport((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const value = await getComplianceAuditExport({});
      setAuditExport({ loading: false, error: null, value });
    } catch (error: any) {
      setAuditExport({
        loading: false,
        error:
          error?.message ||
          t('commandCenter.overview.tiles.auditExport.error', 'Failed to load audit export'),
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
          {t('commandCenter.overview.linksTitle', 'Trust surfaces')}
        </h4>
        <p className="mt-1 text-xs text-c-text-secondary">
          {t(
            'commandCenter.overview.linksSubtitle',
            'These live in their own sections — Command Center only links to them.'
          )}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {LINK_TILES.map((tile) => (
            <LinkTileCard key={tile.id} tile={tile} onOpen={onSectionChange} />
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-c-text">
          {t('commandCenter.overview.complianceTitle', 'Compliance posture')}
        </h4>
        <p className="mt-1 text-xs text-c-text-secondary">
          {t(
            'commandCenter.overview.complianceSubtitle',
            'Live from /api/admin/enterprise-compliance — org-scoped by token.'
          )}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <DataTileShell
            icon={Globe}
            label={t('commandCenter.overview.tiles.residency.label', 'Data residency')}
            loading={residency.loading}
            error={residency.error}
          >
            {residency.value && (
              <div>
                <p className="text-lg font-semibold text-c-text">
                  {residency.value.dataResidencyRegion ||
                    t('commandCenter.overview.tiles.residency.notSet', 'Not set')}
                </p>
                <p className="mt-1 text-xs text-c-text-secondary">
                  {residency.value.enforceEuOnly
                    ? t('commandCenter.overview.tiles.residency.euEnforced', 'EU-only enforced')
                    : t(
                        'commandCenter.overview.tiles.residency.euNotEnforced',
                        'EU-only not enforced'
                      )}
                </p>
              </div>
            )}
          </DataTileShell>

          <DataTileShell
            icon={Sparkles}
            label={t('commandCenter.overview.tiles.aiPolicy.label', 'Org AI policy')}
            loading={aiPolicy.loading}
            error={aiPolicy.error}
          >
            {aiPolicy.value && (
              <div>
                <p className="text-lg font-semibold text-c-text">
                  {t('commandCenter.overview.tiles.aiPolicy.citationMode', {
                    defaultValue: 'Citations: {{mode}}',
                    mode: aiPolicy.value.requiredCitationMode,
                  })}
                </p>
                <p className="mt-1 text-xs text-c-text-secondary">
                  {t('commandCenter.overview.tiles.aiPolicy.maxTokens', {
                    defaultValue: 'Max {{tokens}} tokens / message',
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
          label={t('commandCenter.overview.tiles.dlp.label', 'DLP rules')}
          loading={dlp.loading}
          error={dlp.error}
        >
          {dlp.value &&
            (dlp.value.total === 0 ? (
              <p className="text-sm text-c-text-secondary">
                {t('commandCenter.overview.tiles.dlp.empty', 'No DLP rules configured')}
              </p>
            ) : (
              <p className="text-lg font-semibold text-c-text">
                {t(
                  'commandCenter.overview.tiles.dlp.activeCount',
                  '{{active}} active / {{total}} total',
                  {
                    active: dlp.value.active,
                    total: dlp.value.total,
                  }
                )}
              </p>
            ))}
        </DataTileShell>

        <DataTileShell
          icon={Clock}
          label={t('commandCenter.overview.tiles.retention.label', 'Retention')}
          loading={retention.loading}
          error={retention.error}
        >
          {retention.value &&
            (retention.value.count === 0 ? (
              <p className="text-sm text-c-text-secondary">
                {t(
                  'commandCenter.overview.tiles.retention.empty',
                  'No retention schedules configured'
                )}
              </p>
            ) : (
              <div>
                <p className="text-lg font-semibold text-c-text">
                  {t(
                    'commandCenter.overview.tiles.retention.scheduleCount',
                    '{{count}} schedule(s)',
                    {
                      count: retention.value.count,
                    }
                  )}
                </p>
                {retention.value.nextCleanupAt && (
                  <p className="mt-1 text-xs text-c-text-secondary">
                    {t(
                      'commandCenter.overview.tiles.retention.nextCleanup',
                      'Next cleanup {{date}}',
                      {
                        date: new Date(retention.value.nextCleanupAt).toLocaleDateString(),
                      }
                    )}
                  </p>
                )}
              </div>
            ))}
        </DataTileShell>

        <DataTileShell
          icon={ScrollText}
          label={t('commandCenter.overview.tiles.auditExport.label', 'Last SOC2 export')}
          loading={auditExport.loading}
          error={auditExport.error}
        >
          {auditExport.value && (
            <div>
              <p className="text-lg font-semibold text-c-text">
                {t('commandCenter.overview.tiles.auditExport.entries', '{{count}} entries (30d)', {
                  count: auditExport.value.totalCount,
                })}
              </p>
              <p className="mt-1 text-xs text-c-text-secondary">
                {t('commandCenter.overview.tiles.auditExport.generatedAt', 'as of {{time}}', {
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
  const tabs: Array<{ id: TabId; label: string; icon: React.ElementType }> = useMemo(
    () => [
      {
        id: 'overview',
        label: t('commandCenter.tabs.overview', 'Overview'),
        icon: ShieldCheck,
      },
      {
        id: 'agent-trace',
        label: t('commandCenter.tabs.agentTrace', 'Agent trace'),
        icon: Bot,
      },
      {
        id: 'audit',
        label: t('commandCenter.tabs.audit', 'SOC2 audit'),
        icon: ScrollText,
      },
      {
        id: 'dlp',
        label: t('commandCenter.tabs.dlp', 'DLP'),
        icon: Lock,
      },
      {
        id: 'residency',
        label: t('commandCenter.tabs.residency', 'Data residency'),
        icon: Globe,
      },
      {
        id: 'retention',
        label: t('commandCenter.tabs.retention', 'Retention'),
        icon: Clock,
      },
      {
        id: 'ai-policy',
        label: t('commandCenter.tabs.aiPolicy', 'AI policy'),
        icon: Sparkles,
      },
      {
        id: 'benchmark',
        label: t('commandCenter.tabs.benchmark', 'Consulting Bench'),
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
    setSearchParams(nextParams, { replace: true });
  };

  if (screen === 'attention-queue') return <CommandCenterAttentionQueue />;
  if (screen === 'cost-capacity') return <CommandCenterCostCapacity />;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-c-border bg-c-surface p-5">
        <h3 className="text-lg font-semibold text-c-text">
          {t('commandCenter.title', 'Command Center')}
        </h3>
        <p className="mt-1 text-sm text-c-text-secondary">
          {t(
            'commandCenter.description',
            'One trust & control surface — SOC2 audit export, DLP, data residency, retention, and org AI policy. Roles, SSO, and the audit log live in their own sections and are only linked from here.'
          )}
        </p>
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
