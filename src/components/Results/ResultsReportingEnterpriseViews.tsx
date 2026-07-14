import { Cable, CalendarClock, LayoutDashboard, RadioTower, Send, ShieldCheck } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  type ActionRow,
  type MetaPill,
  PreviewActionBar,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  type RelationItem,
} from '@/components/shared/PreviewPane';
import { Api } from '@/services/api';

import type { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import {
  FilterableTable,
  type TableColumn,
  type TableRow,
} from '../shared/ModuleHub/FilterableTable';
import { type PreviewableItem, TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import type { ResultsKPI } from './kpiDomain';
import { loadResultsKpis } from './kpiRuntime';
import {
  createResultsShowcaseConnectors,
  createResultsShowcaseSchedules,
  createResultsShowcaseWallboards,
  type ResultsShowcaseConnectorRow,
  type ResultsShowcaseScheduleRow,
  type ResultsShowcaseWallboardRow,
  shouldUseResultsShowcaseData,
} from './resultsShowcaseData';

interface WorkspaceViewProps {
  activeFilters: FilterChip[];
  onFilterChange: (filters: FilterChip[]) => void;
  createNonce?: number;
  selectedKpis?: ResultsKPI[];
}

type KpiOption = {
  id: string;
  name: string;
  initiativeName?: string | null;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
};

/**
 * Approval-state chip for scheduled reports. The backend blocks dispatch when
 * `approval_required` is set and `approval_status !== 'approved'`
 * (resultsEnterpriseService); this surfaces that gated/blocked state in the UI
 * so users understand why a schedule is held.
 */
const ScheduleApprovalChip: React.FC<{ approval: string }> = ({ approval }) => {
  const { t } = useTranslation();
  const normalized = String(approval || '').toLowerCase();

  if (normalized === 'auto' || !normalized) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-c-surface-raised px-2 py-0.5 text-xs font-medium text-c-text-muted">
        {t('results.reportingSchedules.approvalAuto', 'Auto')}
      </span>
    );
  }
  if (normalized === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {t('results.reportingSchedules.approvalApproved', 'Approved')}
      </span>
    );
  }
  if (normalized === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger-500/10 px-2 py-0.5 text-xs font-medium text-danger-600 dark:text-danger-400">
        <span className="h-1.5 w-1.5 rounded-full bg-danger-500" />
        {t('results.reportingSchedules.approvalRejected', 'Rejected')}
      </span>
    );
  }
  // pending (or any other non-approved state) — dispatch is blocked.
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400"
      title={t(
        'results.reportingSchedules.approvalPendingHint',
        'Dispatch is blocked until this schedule is approved'
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      {t('results.reportingSchedules.approvalPending', 'Pending approval')}
    </span>
  );
};

const WorkspaceStatCard: React.FC<{
  label: string;
  value: string | number;
  helper: string;
  icon: React.ReactNode;
}> = ({ label, value, helper, icon }) => (
  <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-4 py-3">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
          {label}
        </div>
        <div className="mt-1 text-xl font-semibold text-c-text">{value}</div>
      </div>
      <div className="text-c-text-secondary">{icon}</div>
    </div>
    <div className="mt-1 text-xs text-c-text-muted">{helper}</div>
  </div>
);

const FieldShell: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <label className="space-y-1.5">
    <span className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">{label}</span>
    {children}
  </label>
);

const INPUT_CLASS =
  'w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus';

const TEXTAREA_CLASS = `${INPUT_CLASS} min-h-[88px]`;

function useKpiOptions(selectedKpis: ResultsKPI[] = [], openTrigger: boolean) {
  const [availableKpis, setAvailableKpis] = useState<KpiOption[]>([]);

  useEffect(() => {
    if (!openTrigger) return;
    let cancelled = false;
    (async () => {
      try {
        const runtime = await loadResultsKpis();
        const source = selectedKpis.length > 0 ? selectedKpis : runtime.kpis;
        const next = source
          .map((kpi) => ({
            id: String(kpi.id || '').trim(),
            name: kpi.name || 'Untitled KPI',
            initiativeName: kpi.initiativeName || null,
          }))
          .filter((kpi) => kpi.id)
          .sort((a, b) => a.name.localeCompare(b.name));
        if (!cancelled) {
          setAvailableKpis(next);
        }
      } catch {
        if (!cancelled) {
          const fallback = selectedKpis
            .map((kpi) => ({
              id: String(kpi.id || '').trim(),
              name: kpi.name || 'Untitled KPI',
              initiativeName: kpi.initiativeName || null,
            }))
            .filter((kpi) => kpi.id);
          setAvailableKpis(fallback);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [openTrigger, selectedKpis]);

  return availableKpis;
}

const KpiMultiSelect: React.FC<{
  options: KpiOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}> = ({ options, selectedIds, onChange }) => {
  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]
    );
  };

  return (
    <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3">
      <div className="max-h-44 overflow-y-auto space-y-2">
        {options.length === 0 ? (
          <div className="text-sm text-c-text-muted">No KPI available in current scope.</div>
        ) : (
          options.map((option) => (
            <label
              key={option.id}
              className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-c-surface-raised cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(option.id)}
                onChange={() => toggle(option.id)}
                className="mt-0.5 rounded border-c-border-strong"
              />
              <span className="min-w-0">
                <span className="block text-sm text-c-text-secondary">{option.name}</span>
                <span className="block text-xs text-c-text-muted">
                  {option.initiativeName || 'Standalone KPI'}
                </span>
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
};

type ScheduleItem = ResultsShowcaseScheduleRow & PreviewableItem;
type WallboardItem = ResultsShowcaseWallboardRow & PreviewableItem;
type ConnectorItem = ResultsShowcaseConnectorRow & PreviewableItem;

export const ResultsReportSchedulesView: React.FC<WorkspaceViewProps> = ({
  activeFilters,
  onFilterChange,
  createNonce,
  selectedKpis = [],
}) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [reportName, setReportName] = useState('');
  const [scheduleCron, setScheduleCron] = useState('0 8 * * MON');
  const [sendAt, setSendAt] = useState('08:00');
  const [recipientChannel, setRecipientChannel] = useState('email');
  const [recipientAudience, setRecipientAudience] = useState('ops-review');
  const [recipientEmails, setRecipientEmails] = useState('');
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [selectedKpiIds, setSelectedKpiIds] = useState<string[]>([]);

  const availableKpis = useKpiOptions(selectedKpis, createOpen);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const response: any = await Api.resultsGetReportSchedules();
      const schedules = (response?.schedules || []) as ResultsShowcaseScheduleRow[];
      const source =
        schedules.length === 0 && shouldUseResultsShowcaseData()
          ? createResultsShowcaseSchedules()
          : schedules;
      setItems(
        source.map((item) => ({
          ...item,
          title: item.reportName,
        }))
      );
    } catch {
      setItems(
        shouldUseResultsShowcaseData()
          ? createResultsShowcaseSchedules().map((item) => ({ ...item, title: item.reportName }))
          : []
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSchedules();
  }, [fetchSchedules]);

  useEffect(() => {
    if (!createNonce) return;
    setCreateOpen(true);
  }, [createNonce]);

  useEffect(() => {
    if (!createOpen) return;
    const preferredIds = selectedKpis.map((item) => item.id).filter(Boolean);
    setSelectedKpiIds(preferredIds);
    setReportName('');
    setScheduleCron('0 8 * * MON');
    setSendAt('08:00');
    setRecipientChannel('email');
    setRecipientAudience('ops-review');
    setRecipientEmails('');
    setApprovalRequired(true);
  }, [createOpen, selectedKpis]);

  const selectedItem = useMemo(
    () => (selectedId ? (items.find((item) => item.id === selectedId) ?? null) : null),
    [items, selectedId]
  );

  const rows: TableRow[] = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        name: item.reportName,
        cadence: item.scheduleCron,
        audience: item.recipientPolicy?.audience || '—',
        approval: item.approvalRequired ? item.approvalStatus || 'pending' : 'auto',
        lastSentAt: item.lastSentAt,
        status: item.status,
        kpiCount: item.kpiIds.length,
        _raw: item,
      })),
    [items]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'name',
        label: t('results.reportingSchedules.name', 'Schedule'),
        width: '34%',
        render: (row) => {
          const item = row._raw as ScheduleItem;
          return (
            <div>
              <div className="text-sm font-medium text-c-text">{item.reportName}</div>
              <div className="mt-1 text-xs text-c-text-muted">
                {item.kpiIds.length} KPI · {item.sendAt || 'No send time'}
              </div>
            </div>
          );
        },
      },
      { id: 'cadence', label: t('common.period', 'Cadence'), width: '20%' },
      { id: 'audience', label: t('results.kpiReports.recipients', 'Audience'), width: '18%' },
      {
        id: 'approval',
        label: t('results.kpiReports.approval', 'Approval'),
        width: '14%',
        render: (row) => <ScheduleApprovalChip approval={String(row.approval ?? 'auto')} />,
      },
      {
        id: 'lastSentAt',
        label: t('results.kpiReports.lastSent', 'Last sent'),
        width: '14%',
        render: (row) => formatDateTime(row.lastSentAt),
      },
    ],
    [t]
  );

  const stats = useMemo(
    () => ({
      total: items.length,
      gated: items.filter((item) => item.approvalRequired).length,
      awaiting: items.filter((item) => item.approvalRequired && item.approvalStatus !== 'approved')
        .length,
    }),
    [items]
  );

  const handleCreate = async () => {
    if (!reportName.trim() || selectedKpiIds.length === 0) {
      toast.error('Provide a schedule name and select at least one KPI.');
      return;
    }
    setCreating(true);
    try {
      await Api.resultsCreateReportSchedule({
        reportName: reportName.trim(),
        kpiIds: selectedKpiIds,
        recipientPolicy: {
          channel: recipientChannel,
          audience: recipientAudience.trim() || 'results-review',
          recipients: recipientEmails
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        },
        scheduleCron: scheduleCron.trim() || undefined,
        sendAt: sendAt.trim() || undefined,
        approvalRequired,
      });
      toast.success('Schedule created');
      setCreateOpen(false);
      await fetchSchedules();
    } catch {
      toast.error('Failed to create schedule');
    } finally {
      setCreating(false);
    }
  };

  const handleApprove = async (item: ScheduleItem) => {
    setApprovingId(item.id);
    try {
      await Api.resultsApproveReportSchedule(item.id);
      toast.success('Schedule approved');
      await fetchSchedules();
    } catch {
      toast.error('Failed to approve schedule');
    } finally {
      setApprovingId(null);
    }
  };

  const handleRunNow = async (item: ScheduleItem) => {
    setRunningId(item.id);
    try {
      await Api.resultsRunReportSchedule(item.id);
      toast.success('Schedule executed');
      await fetchSchedules();
    } catch {
      toast.error('Failed to run schedule');
    } finally {
      setRunningId(null);
    }
  };

  const actions = (item: ScheduleItem): ActionRow[] => [
    {
      id: 'run-now',
      label:
        runningId === item.id ? t('common.loading', 'Loading...') : t('common.runNow', 'Run now'),
      onClick: () => void handleRunNow(item),
      variant: 'secondary' as const,
    },
    ...(item.approvalRequired && item.approvalStatus !== 'approved'
      ? [
          {
            id: 'approve',
            label:
              approvingId === item.id
                ? t('common.loading', 'Loading...')
                : t('results.kpiReports.approve', 'Approve'),
            onClick: () => void handleApprove(item),
            variant: 'primary' as const,
          },
        ]
      : []),
  ];

  const meta = (item: ScheduleItem): MetaPill[] => [
    { label: t('common.status', 'Status'), value: item.status || 'active', tone: 'info' },
    {
      label: t('results.kpiReports.approval', 'Approval'),
      value: item.approvalRequired ? item.approvalStatus || 'pending' : 'auto',
      tone: item.approvalRequired && item.approvalStatus !== 'approved' ? 'warning' : 'success',
    },
    { label: 'KPI scope', value: item.kpiIds.length, tone: 'neutral' },
  ];

  const relations = (item: ScheduleItem): RelationItem[] => [
    {
      id: `${item.id}-recipients`,
      label: t('results.kpiReports.recipients', 'Recipients'),
      value: String(item.recipientPolicy?.audience || 'results-review'),
      icon: <Send size={14} />,
    },
    {
      id: `${item.id}-channel`,
      label: t('results.kpiReports.channel', 'Channel'),
      value: String(item.recipientPolicy?.channel || 'email'),
      icon: <RadioTower size={14} />,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <WorkspaceStatCard
          label={t('results.reportingSchedules.total', 'Schedules')}
          value={stats.total}
          helper={t(
            'results.reportingSchedules.totalHint',
            'Recurring reporting artifacts in Results.'
          )}
          icon={<CalendarClock size={18} />}
        />
        <WorkspaceStatCard
          label={t('results.reportingSchedules.gated', 'Approval gates')}
          value={stats.gated}
          helper={t(
            'results.reportingSchedules.gatedHint',
            'Schedules that require explicit review approval.'
          )}
          icon={<ShieldCheck size={18} />}
        />
        <WorkspaceStatCard
          label={t('results.reportingSchedules.awaiting', 'Awaiting approval')}
          value={stats.awaiting}
          helper={t(
            'results.reportingSchedules.awaitingHint',
            'Schedules blocked until approval is granted.'
          )}
          icon={<Send size={18} />}
        />
      </div>

      {createOpen && (
        <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-c-text">
                {t('results.reportingSchedules.createTitle', 'Create recurring KPI schedule')}
              </h3>
              <p className="mt-1 text-sm text-c-text-muted">
                {t(
                  'results.reportingSchedules.createHint',
                  'Scheduled delivery consumes governed KPI truth and keeps review cadence explicit.'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="text-sm text-c-text-muted hover:text-c-text"
            >
              {t('common.close', 'Close')}
            </button>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <FieldShell label={t('common.name', 'Name')}>
              <input
                value={reportName}
                onChange={(event) => setReportName(event.target.value)}
                placeholder={t('results.reportingSchedules.namePlaceholder', 'Weekly control pack')}
                className={INPUT_CLASS}
              />
            </FieldShell>
            <FieldShell label={t('common.period', 'Cadence cron')}>
              <input
                value={scheduleCron}
                onChange={(event) => setScheduleCron(event.target.value)}
                placeholder="0 8 * * MON"
                className={INPUT_CLASS}
              />
            </FieldShell>
            <FieldShell label={t('results.kpiReports.sendAt', 'Send at')}>
              <input
                value={sendAt}
                onChange={(event) => setSendAt(event.target.value)}
                className={INPUT_CLASS}
              />
            </FieldShell>
            <FieldShell label={t('results.kpiReports.channel', 'Channel')}>
              <select
                value={recipientChannel}
                onChange={(event) => setRecipientChannel(event.target.value)}
                className={INPUT_CLASS}
              >
                <option value="email">Email</option>
                <option value="teams">Teams</option>
                <option value="slack">Slack</option>
              </select>
            </FieldShell>
            <FieldShell label={t('results.kpiReports.recipients', 'Audience')}>
              <input
                value={recipientAudience}
                onChange={(event) => setRecipientAudience(event.target.value)}
                placeholder="ops-review"
                className={INPUT_CLASS}
              />
            </FieldShell>
            <FieldShell label={t('results.kpiReports.recipientEmails', 'Recipient emails')}>
              <input
                value={recipientEmails}
                onChange={(event) => setRecipientEmails(event.target.value)}
                placeholder="ops@example.com, owner@example.com"
                className={INPUT_CLASS}
              />
            </FieldShell>
            <label className="flex items-center gap-2 rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-sm text-c-text-secondary">
              <input
                type="checkbox"
                checked={approvalRequired}
                onChange={(event) => setApprovalRequired(event.target.checked)}
                className="rounded border-c-border-strong"
              />
              <span>
                {t('results.kpiReports.approvalRequired', 'Approval required before send')}
              </span>
            </label>
          </div>

          <div className="mt-4">
            <FieldShell label={t('results.kpiReports.kpiScope', 'KPI scope')}>
              <KpiMultiSelect
                options={availableKpis}
                selectedIds={selectedKpiIds}
                onChange={setSelectedKpiIds}
              />
            </FieldShell>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-xl border border-c-border-subtle px-4 py-2 text-sm text-c-text-secondary"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              disabled={creating}
              onClick={() => void handleCreate()}
              className="rounded-xl bg-c-text px-4 py-2 text-sm font-medium text-c-bg disabled:opacity-60 hover:opacity-90"
            >
              {creating ? t('common.loading', 'Loading...') : t('common.create', 'Create')}
            </button>
          </div>
        </div>
      )}

      <TableWithPreviewLayout
        selectedId={selectedId}
        selectedItem={selectedItem}
        onSelect={setSelectedId}
        itemIds={items.map((item) => item.id)}
        getItemById={(id) => items.find((item) => item.id === id) ?? null}
        renderPreview={(item) => (
          <div className="space-y-4">
            <PreviewMetaCard
              title={item.reportName}
              subtitle={t(
                'results.reportingSchedules.previewSubtitle',
                'Recurring report delivery for governed KPI review.'
              )}
              metaPills={meta(item)}
            />
            <PreviewDetailsSection
              title={t('common.details', 'Details')}
              detailsText={[
                `Cron: ${item.scheduleCron || '—'}`,
                `Send time: ${item.sendAt || '—'}`,
                `Audience: ${String(item.recipientPolicy?.audience || 'results-review')}`,
                `Channel: ${String(item.recipientPolicy?.channel || 'email')}`,
                `Next run: ${formatDateTime((item as any).nextRunAt)}`,
                `Run status: ${String((item as any).lastRunStatus || '—')}`,
                `Last sent: ${formatDateTime(item.lastSentAt)}`,
              ]}
            />
            <PreviewRelations title={t('common.relations', 'Relations')} items={relations(item)} />
          </div>
        )}
        renderPreviewFooter={(item) => <PreviewActionBar actions={actions(item)} />}
      >
        <FilterableTable
          columns={columns}
          data={rows}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId(row.id)}
          activeFilters={activeFilters}
          onFilterChange={onFilterChange}
          emptyMessage={
            loading
              ? t('common.loading', 'Loading...')
              : t('results.reportingSchedules.empty', 'No report schedules yet.')
          }
          hideRowActions
        />
      </TableWithPreviewLayout>
    </div>
  );
};

export const ResultsWallboardsView: React.FC<WorkspaceViewProps> = ({
  activeFilters,
  onFilterChange,
  createNonce,
  selectedKpis = [],
}) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<WallboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [refreshInterval, setRefreshInterval] = useState('60');
  const [rotationInterval, setRotationInterval] = useState('30');
  const [alertConfig, setAlertConfig] = useState('belowTarget, staleEntry');
  const [selectedKpiIds, setSelectedKpiIds] = useState<string[]>([]);

  const availableKpis = useKpiOptions(selectedKpis, createOpen);

  const fetchWallboards = useCallback(async () => {
    setLoading(true);
    try {
      const response: any = await Api.resultsGetWallboards();
      const wallboards = (response?.wallboards || []) as ResultsShowcaseWallboardRow[];
      const source =
        wallboards.length === 0 && shouldUseResultsShowcaseData()
          ? createResultsShowcaseWallboards()
          : wallboards;
      setItems(source.map((item) => ({ ...item, title: item.name })));
    } catch {
      setItems(
        shouldUseResultsShowcaseData()
          ? createResultsShowcaseWallboards().map((item) => ({ ...item, title: item.name }))
          : []
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWallboards();
  }, [fetchWallboards]);

  useEffect(() => {
    if (!createNonce) return;
    setCreateOpen(true);
  }, [createNonce]);

  useEffect(() => {
    if (!createOpen) return;
    setName('');
    setRefreshInterval('60');
    setRotationInterval('30');
    setAlertConfig('belowTarget, staleEntry');
    setSelectedKpiIds(selectedKpis.map((item) => item.id).filter(Boolean));
  }, [createOpen, selectedKpis]);

  const selectedItem = useMemo(
    () => (selectedId ? (items.find((item) => item.id === selectedId) ?? null) : null),
    [items, selectedId]
  );

  const rows: TableRow[] = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        name: item.name,
        scope: item.kpiIds.length,
        refresh: `${item.refreshIntervalSeconds}s`,
        rotation: `${item.autoRotationSeconds}s`,
        status: item.isActive ? 'ACTIVE' : 'INACTIVE',
        _raw: item,
      })),
    [items]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'name',
        label: t('results.wallboards.name', 'Wallboard'),
        width: '36%',
        render: (row) => {
          const item = row._raw as WallboardItem;
          return (
            <div>
              <div className="text-sm font-medium text-c-text">{item.name}</div>
              <div className="mt-1 text-xs text-c-text-muted">
                {item.kpiIds.length} KPI · {Object.keys(item.alertThresholds || {}).length} alert
                cues
              </div>
            </div>
          );
        },
      },
      { id: 'scope', label: t('results.kpiReports.kpiScope', 'KPI scope'), width: '16%' },
      { id: 'refresh', label: t('results.wallboards.refresh', 'Refresh'), width: '16%' },
      { id: 'rotation', label: t('results.wallboards.rotation', 'Rotation'), width: '16%' },
      { id: 'status', label: t('common.status', 'Status'), width: '16%' },
    ],
    [t]
  );

  const stats = useMemo(
    () => ({
      total: items.length,
      active: items.filter((item) => item.isActive).length,
      scope: items.reduce((sum, item) => sum + item.kpiIds.length, 0),
    }),
    [items]
  );

  const handleCreate = async () => {
    if (!name.trim() || selectedKpiIds.length === 0) {
      toast.error('Provide a wallboard name and select at least one KPI.');
      return;
    }
    setCreating(true);
    try {
      const alertThresholds = alertConfig
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .reduce<Record<string, boolean>>((acc, key) => {
          acc[key] = true;
          return acc;
        }, {});
      await Api.resultsCreateWallboard({
        name: name.trim(),
        kpiIds: selectedKpiIds,
        refreshIntervalSeconds: Number(refreshInterval) || 60,
        autoRotationSeconds: Number(rotationInterval) || 30,
        alertThresholds,
      });
      toast.success('Wallboard created');
      setCreateOpen(false);
      await fetchWallboards();
    } catch {
      toast.error('Failed to create wallboard');
    } finally {
      setCreating(false);
    }
  };

  const meta = (item: WallboardItem): MetaPill[] => [
    {
      label: t('common.status', 'Status'),
      value: item.isActive ? 'active' : 'inactive',
      tone: item.isActive ? 'success' : 'warning',
    },
    { label: 'KPI scope', value: item.kpiIds.length, tone: 'neutral' },
    { label: 'Refresh', value: `${item.refreshIntervalSeconds}s`, tone: 'info' },
  ];

  const relations = (item: WallboardItem): RelationItem[] => [
    {
      id: `${item.id}-rotation`,
      label: t('results.wallboards.rotation', 'Rotation'),
      value: `${item.autoRotationSeconds}s`,
      icon: <LayoutDashboard size={14} />,
    },
    {
      id: `${item.id}-alerts`,
      label: t('results.wallboards.alerts', 'Alert cues'),
      value: Object.keys(item.alertThresholds || {}).join(', ') || 'none',
      icon: <RadioTower size={14} />,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <WorkspaceStatCard
          label={t('results.wallboards.total', 'Wallboards')}
          value={stats.total}
          helper={t(
            'results.wallboards.totalHint',
            'TV and executive surfaces backed by KPI truth.'
          )}
          icon={<LayoutDashboard size={18} />}
        />
        <WorkspaceStatCard
          label={t('results.wallboards.active', 'Active')}
          value={stats.active}
          helper={t('results.wallboards.activeHint', 'Currently active broadcasting surfaces.')}
          icon={<RadioTower size={18} />}
        />
        <WorkspaceStatCard
          label={t('results.wallboards.scope', 'KPI in broadcast')}
          value={stats.scope}
          helper={t(
            'results.wallboards.scopeHint',
            'Total KPI tiles distributed across wallboards.'
          )}
          icon={<Cable size={18} />}
        />
      </div>

      {createOpen && (
        <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-c-text">
                {t('results.wallboards.createTitle', 'Create wallboard')}
              </h3>
              <p className="mt-1 text-sm text-c-text-muted">
                {t(
                  'results.wallboards.createHint',
                  'Wallboards should amplify governed KPI truth for TV and operational visibility.'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="text-sm text-c-text-muted hover:text-c-text"
            >
              {t('common.close', 'Close')}
            </button>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <FieldShell label={t('common.name', 'Name')}>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('results.wallboards.namePlaceholder', 'Shopfloor KPI wallboard')}
                className={INPUT_CLASS}
              />
            </FieldShell>
            <FieldShell label={t('results.wallboards.refresh', 'Refresh interval (s)')}>
              <input
                value={refreshInterval}
                onChange={(event) => setRefreshInterval(event.target.value)}
                className={INPUT_CLASS}
              />
            </FieldShell>
            <FieldShell label={t('results.wallboards.rotation', 'Auto rotation (s)')}>
              <input
                value={rotationInterval}
                onChange={(event) => setRotationInterval(event.target.value)}
                className={INPUT_CLASS}
              />
            </FieldShell>
            <FieldShell label={t('results.wallboards.alerts', 'Alert cues')}>
              <input
                value={alertConfig}
                onChange={(event) => setAlertConfig(event.target.value)}
                placeholder="belowTarget, staleEntry"
                className={INPUT_CLASS}
              />
            </FieldShell>
          </div>

          <div className="mt-4">
            <FieldShell label={t('results.kpiReports.kpiScope', 'KPI scope')}>
              <KpiMultiSelect
                options={availableKpis}
                selectedIds={selectedKpiIds}
                onChange={setSelectedKpiIds}
              />
            </FieldShell>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-xl border border-c-border-subtle px-4 py-2 text-sm text-c-text-secondary"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              disabled={creating}
              onClick={() => void handleCreate()}
              className="rounded-xl bg-c-text px-4 py-2 text-sm font-medium text-c-bg disabled:opacity-60 hover:opacity-90"
            >
              {creating ? t('common.loading', 'Loading...') : t('common.create', 'Create')}
            </button>
          </div>
        </div>
      )}

      <TableWithPreviewLayout
        selectedId={selectedId}
        selectedItem={selectedItem}
        onSelect={setSelectedId}
        itemIds={items.map((item) => item.id)}
        getItemById={(id) => items.find((item) => item.id === id) ?? null}
        renderPreview={(item) => (
          <div className="space-y-4">
            <PreviewMetaCard
              title={item.name}
              subtitle={t(
                'results.wallboards.previewSubtitle',
                'Broadcast KPI surface for executive or TV mode.'
              )}
              metaPills={meta(item)}
            />
            <PreviewDetailsSection
              title={t('common.details', 'Details')}
              detailsText={[
                `Refresh: ${item.refreshIntervalSeconds}s`,
                `Rotation: ${item.autoRotationSeconds}s`,
                `Alert cues: ${Object.keys(item.alertThresholds || {}).join(', ') || 'none'}`,
                `Scope size: ${item.kpiIds.length} KPI`,
              ]}
            />
            <PreviewRelations title={t('common.relations', 'Relations')} items={relations(item)} />
          </div>
        )}
      >
        <FilterableTable
          columns={columns}
          data={rows}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId(row.id)}
          activeFilters={activeFilters}
          onFilterChange={onFilterChange}
          emptyMessage={
            loading
              ? t('common.loading', 'Loading...')
              : t('results.wallboards.empty', 'No wallboards yet.')
          }
          hideRowActions
        />
      </TableWithPreviewLayout>
    </div>
  );
};

export const ResultsKpiConnectorsView: React.FC<WorkspaceViewProps> = ({
  activeFilters,
  onFilterChange,
  createNonce,
  selectedKpis = [],
}) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<ConnectorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [runningConnectorId, setRunningConnectorId] = useState<string | null>(null);
  const [connectorName, setConnectorName] = useState('');
  const [connectorType, setConnectorType] = useState('api');
  const [scheduleCron, setScheduleCron] = useState('*/30 * * * *');
  const [note, setNote] = useState('');
  const [defaultValue, setDefaultValue] = useState('');
  const [selectedKpiIds, setSelectedKpiIds] = useState<string[]>([]);

  const availableKpis = useKpiOptions(selectedKpis, createOpen);

  const fetchConnectors = useCallback(async () => {
    setLoading(true);
    try {
      const response: any = await Api.resultsGetKPIConnectors();
      const connectors = (response?.connectors || []) as ResultsShowcaseConnectorRow[];
      const source =
        connectors.length === 0 && shouldUseResultsShowcaseData()
          ? createResultsShowcaseConnectors()
          : connectors;
      setItems(source.map((item) => ({ ...item, title: item.connectorName })));
    } catch {
      setItems(
        shouldUseResultsShowcaseData()
          ? createResultsShowcaseConnectors().map((item) => ({
              ...item,
              title: item.connectorName,
            }))
          : []
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConnectors();
  }, [fetchConnectors]);

  useEffect(() => {
    if (!createNonce) return;
    setCreateOpen(true);
  }, [createNonce]);

  useEffect(() => {
    if (!createOpen) return;
    setConnectorName('');
    setConnectorType('api');
    setScheduleCron('*/30 * * * *');
    setNote('');
    setDefaultValue('');
    setSelectedKpiIds(selectedKpis.map((item) => item.id).filter(Boolean));
  }, [createOpen, selectedKpis]);

  const selectedItem = useMemo(
    () => (selectedId ? (items.find((item) => item.id === selectedId) ?? null) : null),
    [items, selectedId]
  );

  const rows: TableRow[] = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        name: item.connectorName,
        type: item.connectorType,
        scope: item.targetKpiIds.length,
        cadence: item.scheduleCron || 'manual',
        lastRun: formatDateTime(item.lastRunAt),
        status: item.lastRunStatus || (item.isActive ? 'active' : 'inactive'),
        _raw: item,
      })),
    [items]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'name',
        label: t('results.connectors.name', 'Connector'),
        width: '34%',
        render: (row) => {
          const item = row._raw as ConnectorItem;
          return (
            <div>
              <div className="text-sm font-medium text-c-text">{item.connectorName}</div>
              <div className="mt-1 text-xs text-c-text-muted">
                {item.targetKpiIds.length} KPI · {item.connectorType}
              </div>
            </div>
          );
        },
      },
      { id: 'type', label: t('common.type', 'Type'), width: '14%' },
      { id: 'scope', label: t('results.kpiReports.kpiScope', 'KPI scope'), width: '14%' },
      { id: 'cadence', label: t('common.period', 'Cadence'), width: '18%' },
      { id: 'lastRun', label: t('results.connectors.lastRun', 'Last run'), width: '20%' },
    ],
    [t]
  );

  const stats = useMemo(
    () => ({
      total: items.length,
      active: items.filter((item) => item.isActive).length,
      healthy: items.filter((item) => (item.lastRunStatus || '').toLowerCase() === 'success')
        .length,
    }),
    [items]
  );

  const handleCreate = async () => {
    if (!connectorName.trim() || selectedKpiIds.length === 0) {
      toast.error('Provide a connector name and select at least one KPI.');
      return;
    }
    setCreating(true);
    try {
      await Api.resultsCreateKPIConnector({
        connectorName: connectorName.trim(),
        connectorType,
        targetKpiIds: selectedKpiIds,
        scheduleCron: scheduleCron.trim() || undefined,
        config: {
          note: note.trim(),
          source: 'results-enterprise-ui',
          ...(defaultValue.trim() ? { defaultValue: Number(defaultValue) } : {}),
        },
      });
      toast.success('Connector created');
      setCreateOpen(false);
      await fetchConnectors();
    } catch {
      toast.error('Failed to create connector');
    } finally {
      setCreating(false);
    }
  };

  const handleRunConnector = async (item: ConnectorItem) => {
    setRunningConnectorId(item.id);
    try {
      await Api.resultsRunKPIConnector(item.id);
      toast.success('Connector executed');
      await fetchConnectors();
    } catch {
      toast.error('Failed to run connector');
    } finally {
      setRunningConnectorId(null);
    }
  };

  const meta = (item: ConnectorItem): MetaPill[] => [
    { label: t('common.type', 'Type'), value: item.connectorType, tone: 'info' },
    {
      label: t('common.status', 'Status'),
      value: item.lastRunStatus || (item.isActive ? 'active' : 'inactive'),
      tone: (item.lastRunStatus || '').toLowerCase() === 'success' ? 'success' : 'warning',
    },
    { label: 'KPI scope', value: item.targetKpiIds.length, tone: 'neutral' },
  ];

  const relations = (item: ConnectorItem): RelationItem[] => [
    {
      id: `${item.id}-cadence`,
      label: t('common.period', 'Cadence'),
      value: item.scheduleCron || 'manual',
      icon: <CalendarClock size={14} />,
    },
    {
      id: `${item.id}-provenance`,
      label: t('results.connectors.provenance', 'Provenance'),
      value: String(item.config?.source || item.config?.mode || 'governed-ingest'),
      icon: <Cable size={14} />,
    },
  ];

  const actions = (item: ConnectorItem): ActionRow[] => [
    {
      id: 'run-now',
      label:
        runningConnectorId === item.id
          ? t('common.loading', 'Loading...')
          : t('common.runNow', 'Run now'),
      onClick: () => void handleRunConnector(item),
      variant: 'secondary' as const,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <WorkspaceStatCard
          label={t('results.connectors.total', 'Connectors')}
          value={stats.total}
          helper={t('results.connectors.totalHint', 'Ingest paths that feed governed KPI truth.')}
          icon={<Cable size={18} />}
        />
        <WorkspaceStatCard
          label={t('results.connectors.active', 'Active')}
          value={stats.active}
          helper={t('results.connectors.activeHint', 'Currently enabled connectors in Results.')}
          icon={<RadioTower size={18} />}
        />
        <WorkspaceStatCard
          label={t('results.connectors.healthy', 'Healthy runs')}
          value={stats.healthy}
          helper={t('results.connectors.healthyHint', 'Connectors with recent successful runs.')}
          icon={<ShieldCheck size={18} />}
        />
      </div>

      {createOpen && (
        <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-c-text">
                {t('results.connectors.createTitle', 'Create KPI connector')}
              </h3>
              <p className="mt-1 text-sm text-c-text-muted">
                {t(
                  'results.connectors.createHint',
                  'Connectors expose source posture and cadence, but they do not redefine KPI truth.'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="text-sm text-c-text-muted hover:text-c-text"
            >
              {t('common.close', 'Close')}
            </button>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <FieldShell label={t('common.name', 'Name')}>
              <input
                value={connectorName}
                onChange={(event) => setConnectorName(event.target.value)}
                placeholder={t('results.connectors.namePlaceholder', 'MES production feed')}
                className={INPUT_CLASS}
              />
            </FieldShell>
            <FieldShell label={t('common.type', 'Type')}>
              <select
                value={connectorType}
                onChange={(event) => setConnectorType(event.target.value)}
                className={INPUT_CLASS}
              >
                <option value="api">API</option>
                <option value="csv">CSV</option>
                <option value="database">Database</option>
                <option value="webhook">Webhook</option>
                <option value="manual">Manual</option>
              </select>
            </FieldShell>
            <FieldShell label={t('common.period', 'Cadence cron')}>
              <input
                value={scheduleCron}
                onChange={(event) => setScheduleCron(event.target.value)}
                placeholder="*/30 * * * *"
                className={INPUT_CLASS}
              />
            </FieldShell>
            <FieldShell label={t('results.connectors.note', 'Integration note')}>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t(
                  'results.connectors.notePlaceholder',
                  'Source system, auth posture, mapping note...'
                )}
                className={TEXTAREA_CLASS}
              />
            </FieldShell>
            <FieldShell label={t('results.connectors.defaultValue', 'Default seeded value')}>
              <input
                value={defaultValue}
                onChange={(event) => setDefaultValue(event.target.value)}
                placeholder="100"
                type="number"
                step="any"
                className={INPUT_CLASS}
              />
            </FieldShell>
          </div>

          <div className="mt-4">
            <FieldShell label={t('results.kpiReports.kpiScope', 'KPI scope')}>
              <KpiMultiSelect
                options={availableKpis}
                selectedIds={selectedKpiIds}
                onChange={setSelectedKpiIds}
              />
            </FieldShell>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-xl border border-c-border-subtle px-4 py-2 text-sm text-c-text-secondary"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              disabled={creating}
              onClick={() => void handleCreate()}
              className="rounded-xl bg-c-text px-4 py-2 text-sm font-medium text-c-bg disabled:opacity-60 hover:opacity-90"
            >
              {creating ? t('common.loading', 'Loading...') : t('common.create', 'Create')}
            </button>
          </div>
        </div>
      )}

      <TableWithPreviewLayout
        selectedId={selectedId}
        selectedItem={selectedItem}
        onSelect={setSelectedId}
        itemIds={items.map((item) => item.id)}
        getItemById={(id) => items.find((item) => item.id === id) ?? null}
        renderPreview={(item) => (
          <div className="space-y-4">
            <PreviewMetaCard
              title={item.connectorName}
              subtitle={t(
                'results.connectors.previewSubtitle',
                'Governed ingest surface for KPI measurements.'
              )}
              metaPills={meta(item)}
            />
            <PreviewDetailsSection
              title={t('common.details', 'Details')}
              detailsText={[
                `Cadence: ${item.scheduleCron || 'manual'}`,
                `Next run: ${formatDateTime((item as any).nextRunAt)}`,
                `Last run: ${formatDateTime(item.lastRunAt)}`,
                `Run status: ${item.lastRunStatus || '—'}`,
                `Run note: ${String((item as any).lastRunMessage || '—')}`,
                `Target KPI: ${item.targetKpiIds.length}`,
                `Note: ${String(item.config?.note || item.config?.mode || '—')}`,
              ]}
            />
            <PreviewRelations title={t('common.relations', 'Relations')} items={relations(item)} />
          </div>
        )}
        renderPreviewFooter={(item) => <PreviewActionBar actions={actions(item)} />}
      >
        <FilterableTable
          columns={columns}
          data={rows}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId(row.id)}
          activeFilters={activeFilters}
          onFilterChange={onFilterChange}
          emptyMessage={
            loading
              ? t('common.loading', 'Loading...')
              : t('results.connectors.empty', 'No KPI connectors yet.')
          }
          hideRowActions
        />
      </TableWithPreviewLayout>
    </div>
  );
};
