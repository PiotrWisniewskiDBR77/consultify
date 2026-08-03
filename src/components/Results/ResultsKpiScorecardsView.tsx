/**
 * ResultsKpiScorecardsView — RES-10 canonical Results scorecard screen.
 *
 * OWNERSHIP: reads/writes ONLY the Results-owned scorecard contract
 * (`V8ResultsApi.*Scorecard*`, backed by `kpi_scorecards`/`kpi_scorecard_items` —
 * see `server/src/services/results/kpiScorecardService.ts`). Before RES-10 this
 * component was wired to `Api.goals*` — the Initiatives-owned goals/OKR
 * contract — and merely relabeled as "Scorecards". That wiring is gone: this
 * screen must never call `Api.goals*`, and Initiatives goals now have their
 * own screen (`src/components/Initiatives/InitiativeGoalsView.tsx`).
 *
 * A scorecard is a department x period "card" (per Piotr's spec, see the
 * KARTY KPI comment on the backend routes) that groups existing KPIs from the
 * Results KPI catalog (`V8ResultsApi.getKpiCatalog`) — it does not define new
 * KPIs, only curates which existing ones sit on which card.
 */
import { Link2, Target, Trash2 } from 'lucide-react';
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
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import {
  type V8ResultsKpiCatalogEntry,
  type V8ResultsScorecard,
  type V8ResultsScorecardKpi,
  V8ResultsApi,
} from '@/services/api/v8/results';

import type { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import {
  FilterableTable,
  type TableColumn,
  type TableRow,
} from '../shared/ModuleHub/FilterableTable';
import { type PreviewableItem, TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import type { ResultsTrackedInitiative } from './kpiDomain';

interface ResultsKpiScorecardsViewProps {
  activeFilters: FilterChip[];
  onFilterChange: (filters: FilterChip[]) => void;
  createNonce?: number;
  initiatives?: ResultsTrackedInitiative[];
}

type ScorecardItem = V8ResultsScorecard & PreviewableItem;

const toScorecardItem = (scorecard: V8ResultsScorecard): ScorecardItem => ({
  ...scorecard,
  title: scorecard.name,
});

const INPUT_CLASS =
  'w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-3 py-2 text-sm text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus';

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
};

export const ResultsKpiScorecardsView: React.FC<ResultsKpiScorecardsViewProps> = ({
  activeFilters,
  onFilterChange,
  createNonce,
}) => {
  const { t } = useTranslation();
  const openChatWithContext = useOpenChatWithContext();
  const [items, setItems] = useState<ScorecardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedKpis, setSelectedKpis] = useState<V8ResultsScorecardKpi[]>([]);
  const [kpisLoading, setKpisLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [periodLabel, setPeriodLabel] = useState('Q2 2026');

  const [catalog, setCatalog] = useState<V8ResultsKpiCatalogEntry[]>([]);
  const [attachKpiId, setAttachKpiId] = useState('');
  const [attaching, setAttaching] = useState(false);
  const [detachingId, setDetachingId] = useState<string | null>(null);

  const fetchScorecards = useCallback(async () => {
    setLoading(true);
    try {
      const response = await V8ResultsApi.getScorecards();
      setItems(response.scorecards.map(toScorecardItem));
    } catch {
      toast.error(t('results.kpiScorecards.loadError', 'Failed to load scorecards'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchScorecards();
  }, [fetchScorecards]);

  useEffect(() => {
    V8ResultsApi.getKpiCatalog()
      .then((res) => setCatalog(res.kpis || []))
      .catch(() => setCatalog([]));
  }, []);

  useEffect(() => {
    if (!createNonce) return;
    setCreateOpen(true);
  }, [createNonce]);

  useEffect(() => {
    if (!createOpen) return;
    setName('');
    setDepartment('');
    setPeriodLabel('Q2 2026');
  }, [createOpen]);

  const loadKpisForSelection = useCallback(async (scorecardId: string) => {
    setKpisLoading(true);
    try {
      const response = await V8ResultsApi.getScorecardKpis(scorecardId);
      setSelectedKpis(response.kpis);
    } catch {
      setSelectedKpis([]);
    } finally {
      setKpisLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelectedKpis([]);
      return;
    }
    void loadKpisForSelection(selectedId);
  }, [selectedId, loadKpisForSelection]);

  const selectedItem = useMemo(
    () => (selectedId ? (items.find((item) => item.id === selectedId) ?? null) : null),
    [items, selectedId]
  );

  const attachableKpis = useMemo(
    () => catalog.filter((kpi) => !selectedKpis.some((attached) => attached.id === kpi.id)),
    [catalog, selectedKpis]
  );

  const rows: TableRow[] = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        name: item.name,
        department: item.department || '—',
        period: item.periodLabel || '—',
        kpiCount: item.kpiCount,
        onTargetCount: item.onTargetCount,
        status: item.status,
        _raw: item,
      })),
    [items]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'name',
        label: t('results.kpiScorecards.name', 'Scorecard'),
        width: '32%',
        render: (row) => {
          const item = row._raw as ScorecardItem;
          return (
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">{item.name}</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {item.department || t('common.none', 'No department')}
              </div>
            </div>
          );
        },
      },
      { id: 'period', label: t('common.period', 'Period'), width: '18%' },
      {
        id: 'kpiCount',
        label: t('results.kpiScorecards.kpiCount', 'KPIs'),
        width: '16%',
        render: (row) => `${row.onTargetCount ?? 0} / ${row.kpiCount ?? 0} ${t('results.kpiScorecards.onTarget', 'on target')}`,
      },
      { id: 'status', label: t('common.status', 'Status'), width: '16%' },
    ],
    [t]
  );

  const stats = useMemo(
    () => ({
      total: items.length,
      active: items.filter((item) => item.status.toLowerCase() === 'active').length,
      totalKpis: items.reduce((sum, item) => sum + item.kpiCount, 0),
    }),
    [items]
  );

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error(t('results.kpiScorecards.nameRequired', 'Provide a scorecard name.'));
      return;
    }
    setCreating(true);
    try {
      await V8ResultsApi.createScorecard({
        name: name.trim(),
        department: department.trim() || undefined,
        periodLabel: periodLabel.trim() || undefined,
      });
      toast.success(t('results.kpiScorecards.created', 'Scorecard created'));
      setCreateOpen(false);
      await fetchScorecards();
    } catch {
      toast.error(t('results.kpiScorecards.createError', 'Failed to create scorecard'));
    } finally {
      setCreating(false);
    }
  };

  const handleAttachKpi = async () => {
    if (!selectedId || !attachKpiId) return;
    setAttaching(true);
    try {
      await V8ResultsApi.addKpiToScorecard(selectedId, attachKpiId);
      setAttachKpiId('');
      await loadKpisForSelection(selectedId);
      await fetchScorecards();
    } catch {
      toast.error(t('results.kpiScorecards.attachError', 'Failed to attach KPI'));
    } finally {
      setAttaching(false);
    }
  };

  const handleDetachKpi = async (kpiId: string) => {
    if (!selectedId) return;
    setDetachingId(kpiId);
    try {
      await V8ResultsApi.removeKpiFromScorecard(selectedId, kpiId);
      await loadKpisForSelection(selectedId);
      await fetchScorecards();
    } catch {
      toast.error(t('results.kpiScorecards.detachError', 'Failed to remove KPI'));
    } finally {
      setDetachingId(null);
    }
  };

  const actions = (item: ScorecardItem): ActionRow[] => [
    {
      id: 'discuss',
      label: t('results.kpiScorecards.discuss', 'Discuss scorecard'),
      onClick: async () => {
        try {
          await openChatWithContext({
            entityType: 'kpi',
            entityId: item.id,
            entityName: item.name,
            contextData: item as unknown as Record<string, unknown>,
          });
          toast.success(t('common.chatOpened', 'Chat opened'), { duration: 1500 });
        } catch {
          toast.error(t('common.chatOpenError', 'Failed to open chat'));
        }
      },
      variant: 'secondary',
    },
  ];

  const metaPills = (item: ScorecardItem): MetaPill[] => [
    { label: t('common.department', 'Department'), value: item.department || '—', tone: 'info' },
    { label: t('common.period', 'Period'), value: item.periodLabel || '—', tone: 'neutral' },
    { label: t('common.status', 'Status'), value: item.status, tone: 'success' },
  ];

  const relationItems = (item: ScorecardItem): RelationItem[] => [
    {
      id: `${item.id}-kpis`,
      label: t('results.kpiScorecards.kpiCount', 'KPIs'),
      value: String(item.kpiCount),
      icon: <Link2 size={14} />,
    },
    {
      id: `${item.id}-on-target`,
      label: t('results.kpiScorecards.onTargetCount', 'On target'),
      value: String(item.onTargetCount),
      icon: <Target size={14} />,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/90 dark:bg-white/[0.03] px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('results.kpiScorecards.total', 'Scorecards')}
          </div>
          <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
            {stats.total}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('results.kpiScorecards.totalHint', 'Department x period cards curated from the KPI catalog.')}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/90 dark:bg-white/[0.03] px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('common.active', 'Active')}
          </div>
          <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
            {stats.active}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('results.kpiScorecards.activeHint', 'Scorecards currently tracking delivery or benefits.')}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/90 dark:bg-white/[0.03] px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('results.kpiScorecards.totalKpis', 'KPIs on cards')}
          </div>
          <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
            {stats.totalKpis}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('results.kpiScorecards.totalKpisHint', 'KPIs can appear on more than one card.')}
          </div>
        </div>
      </div>

      {createOpen && (
        <div className="rounded-2xl border border-slate-200/70 dark:border-white/[0.08] bg-white/95 dark:bg-navy-900/95 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {t('results.kpiScorecards.createTitle', 'Create scorecard')}
              </h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t(
                  'results.kpiScorecards.createHint',
                  'A card groups existing KPIs by department and period.'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
            >
              {t('common.close', 'Close')}
            </button>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('common.name', 'Name')}
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={INPUT_CLASS}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('common.department', 'Department')}
              </span>
              <input
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                className={INPUT_CLASS}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('common.period', 'Period')}
              </span>
              <input
                value={periodLabel}
                onChange={(event) => setPeriodLabel(event.target.value)}
                className={INPUT_CLASS}
              />
            </label>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] px-4 py-2 text-sm text-slate-600 dark:text-slate-300"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              disabled={creating}
              onClick={() => void handleCreate()}
              className="rounded-xl bg-navy-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-navy-800"
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
                'results.kpiScorecards.previewSubtitle',
                'Governed scorecard built on the Results KPI catalog.'
              )}
              metaPills={metaPills(item)}
            />
            <PreviewDetailsSection
              title={t('common.details', 'Details')}
              detailsText={[
                `${t('common.department', 'Department')}: ${item.department || '—'}`,
                `${t('common.period', 'Period')}: ${item.periodLabel || '—'}`,
                `${t('common.period', 'Period')} (start/end): ${formatDate(item.periodStart)} → ${formatDate(item.periodEnd)}`,
              ]}
            />
            <PreviewRelations
              title={t('common.relations', 'Relations')}
              items={relationItems(item)}
            />

            <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {t('results.kpiScorecards.kpisOnCard', 'KPIs on this card')}
              </div>
              <div className="mt-2 space-y-1.5">
                {kpisLoading ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {t('common.loading', 'Loading...')}
                  </div>
                ) : selectedKpis.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {t('results.kpiScorecards.noKpisYet', 'No KPIs attached yet.')}
                  </div>
                ) : (
                  selectedKpis.map((kpi) => (
                    <div
                      key={kpi.id}
                      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm text-slate-700 dark:text-slate-200">
                          {kpi.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {kpi.currentValue ?? '—'}
                          {kpi.unit ? ` ${kpi.unit}` : ''} / {kpi.targetValue ?? '—'}
                          {kpi.unit ? ` ${kpi.unit}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDetachKpi(kpi.id)}
                        disabled={detachingId === kpi.id}
                        className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/[0.06] disabled:opacity-50"
                        aria-label={t('common.remove', 'Remove')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <select
                  value={attachKpiId}
                  onChange={(event) => setAttachKpiId(event.target.value)}
                  className={INPUT_CLASS}
                >
                  <option value="">
                    {t('results.kpiScorecards.pickKpi', 'Pick a KPI to attach…')}
                  </option>
                  {attachableKpis.map((kpi) => (
                    <option key={kpi.id} value={kpi.id}>
                      {kpi.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!attachKpiId || attaching}
                  onClick={() => void handleAttachKpi()}
                  className="shrink-0 rounded-xl bg-navy-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-navy-800"
                >
                  {attaching ? t('common.loading', 'Loading...') : t('common.add', 'Add')}
                </button>
              </div>
            </div>
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
              : t('results.kpiScorecards.empty', 'No scorecards yet.')
          }
          hideRowActions
        />
      </TableWithPreviewLayout>
    </div>
  );
};
