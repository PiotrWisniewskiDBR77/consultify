import { FileText, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Api } from '@/services/api';
import { shouldFallbackToLegacyResults, V8ResultsApi } from '@/services/api/v8/results';

import type { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import {
  FilterableTable,
  type TableColumn,
  type TableRow,
} from '../shared/ModuleHub/FilterableTable';
import { type RowAction } from '../shared/RowActionsMenu';
import { buildKpiQueueGroups } from './kpiDomain';
import { loadResultsKpis } from './kpiRuntime';
import type { ResultsKPI, ResultsLifecycleFilter, ResultsTrackedInitiative } from './kpiDomain';

export interface ResultsKpiReportsViewProps {
  activeFilters: FilterChip[];
  onFilterChange: (filters: FilterChip[]) => void;
  createNonce?: number;
  selectedLifecycleFilter?: ResultsLifecycleFilter;
  selectedInitiatives?: ResultsTrackedInitiative[];
  selectedKpis?: ResultsKPI[];
}

export const ResultsKpiReportsView: React.FC<ResultsKpiReportsViewProps> = ({
  activeFilters,
  onFilterChange,
  createNonce,
  selectedLifecycleFilter = 'all',
  selectedInitiatives = [],
  selectedKpis = [],
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  type ActionItem = {
    key: string;
    title: string;
    kpiId: string;
    kpiName?: string;
    severity: 'AMBER' | 'RED';
    dueDate?: string | null;
    status?: string;
    selected: boolean;
    ownerUserId?: string | null;
  };

  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [availableKpis, setAvailableKpis] = useState<
    Array<{ id: string; name: string; initiativeName?: string | null }>
  >([]);
  const [availableInitiatives, setAvailableInitiatives] = useState<
    Array<{ id: string; name: string; status?: string | null }>
  >([]);
  const [kpisLoading, setKpisLoading] = useState(false);
  const [kpiSearch, setKpiSearch] = useState('');
  const [selectedKpiIds, setSelectedKpiIds] = useState<string[]>([]);
  const [selectedInitiativeIds, setSelectedInitiativeIds] = useState<string[]>([]);
  const [reviewContext, setReviewContext] = useState({
    requiresReview: 0,
    discrepancy: 0,
    needsEntry: 0,
  });

  const [tasksModalOpen, setTasksModalOpen] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksCreating, setTasksCreating] = useState(false);
  const [tasksReportRow, setTasksReportRow] = useState<TableRow | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);

  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    return start.toISOString().slice(0, 10);
  });
  const [periodEnd, setPeriodEnd] = useState(() => {
    const d = new Date();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return end.toISOString().slice(0, 10);
  });
  const [title, setTitle] = useState('');

  const columns: TableColumn[] = useMemo(
    () => [
      { id: 'type', label: t('common.type', 'Type'), width: '12%' },
      { id: 'name', label: t('common.name', 'Name'), width: '44%' },
      { id: 'period', label: t('common.period', 'Period'), width: '16%' },
      { id: 'status', label: t('common.status', 'Status'), width: '16%' },
      { id: 'updatedAt', label: t('common.updated', 'Updated'), width: '18%' },
    ],
    [t]
  );

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await Api.get('/results/kpi-reports');
      const list = (res?.data || []) as any[];
      setRows(
        (list || []).map((r: any) => ({
          id: r.reportId || r.id,
          reportId: r.reportId || r.id,
          snapshotId: r.snapshotId,
          type: 'KPI',
          name: r.title,
          period:
            r.periodStart && r.periodEnd
              ? `${r.periodStart} → ${r.periodEnd}`
              : r.periodStart || '—',
          status: r.status || 'DRAFT',
          updatedAt: r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : '—',
        }))
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    if (!createNonce) return;
    setCreateOpen(true);
  }, [createNonce]);

  useEffect(() => {
    if (!createOpen) return;
    let cancelled = false;
    (async () => {
      setKpisLoading(true);
      try {
        const runtime = await loadResultsKpis();
        const items = runtime.kpis
          .map((k) => ({
            id: String(k.id || '').trim(),
            name: String(k.name || '').trim(),
            initiativeName: (k.initiativeName || null) as string | null,
          }))
          .filter((k) => k.id && k.name)
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        const queue = buildKpiQueueGroups(runtime.kpis);
        if (cancelled) return;
        setAvailableKpis(items);
        setSelectedKpiIds(items.map((k) => k.id));
        const scopedInitiatives = (selectedInitiatives || []).map((initiative) => ({
          id: initiative.initiativeId,
          name: initiative.initiativeName,
          status: initiative.initiativeStatus,
        }));
        setAvailableInitiatives(scopedInitiatives);
        setSelectedInitiativeIds(scopedInitiatives.map((initiative) => initiative.id));
        setReviewContext({
          requiresReview: queue.requiresReview.length,
          discrepancy: queue.discrepancy.length,
          needsEntry: queue.needsEntry.length,
        });
      } catch {
        if (cancelled) return;
        setAvailableKpis([]);
        setSelectedKpiIds([]);
        setAvailableInitiatives([]);
        setSelectedInitiativeIds([]);
        setReviewContext({ requiresReview: 0, discrepancy: 0, needsEntry: 0 });
      } finally {
        if (!cancelled) setKpisLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [createOpen, selectedInitiatives]);

  const filteredKpis = useMemo(() => {
    const q = kpiSearch.trim().toLowerCase();
    if (!q) return availableKpis;
    return availableKpis.filter((k) => {
      const a = (k.name || '').toLowerCase();
      const b = (k.initiativeName || '').toLowerCase();
      return a.includes(q) || b.includes(q);
    });
  }, [availableKpis, kpiSearch]);

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!periodStart) return;
      setCreating(true);
      try {
        const payload = {
          periodStart,
          periodEnd: periodEnd || null,
          title: title.trim() || undefined,
          filters: {
            lifecycleFilter: selectedLifecycleFilter,
            initiativeIds: selectedInitiativeIds,
          },
          initiativeIds: selectedInitiativeIds.length ? selectedInitiativeIds : undefined,
          kpiIds: selectedKpiIds.length ? selectedKpiIds : undefined,
        };
        let res: any;
        try {
          res = await V8ResultsApi.createKpiReport(payload);
        } catch (error) {
          if (!shouldFallbackToLegacyResults(error)) {
            throw error;
          }
          res = await Api.post('/results/kpi-reports', payload);
        }
        const reportId = res?.data?.reportId;
        const resolvedReportId = reportId || res?.reportId;
        setCreateOpen(false);
        setTitle('');
        setKpiSearch('');
        await fetchReports();
        if (resolvedReportId) navigate(`/reports/builder/${resolvedReportId}`);
      } finally {
        setCreating(false);
      }
    },
    [
      periodStart,
      periodEnd,
      title,
      selectedInitiativeIds,
      selectedKpiIds,
      fetchReports,
      navigate,
      selectedLifecycleFilter,
    ]
  );

  const inputCls =
    'w-full h-9 px-3 text-sm rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-colors';
  const labelCls = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1';

  const loadActionsForRow = useCallback(
    async (row: TableRow) => {
      if (!row?.snapshotId) {
        toast.error(
          t('results.kpiReports.tasks.noSnapshot', 'This report has no snapshot linked.')
        );
        return;
      }
      setTasksReportRow(row);
      setTasksModalOpen(true);
      setTasksLoading(true);
      try {
        const res: any = await Api.get(`/results/kpi-reports/${row.snapshotId}`);
        const snap = res?.data?.snapshot;
        const plan = (snap?.actionPlan || []) as any[];
        const items: ActionItem[] = plan.map((a: any): ActionItem => {
          const due = a.dueDate ? String(a.dueDate).slice(0, 10) : null;
          const done = String(a.status || '').toUpperCase() === 'DONE';
          const kpiId = String(a.kpiId || a.relatedObjectId || '');
          return {
            key: `${a.id || a.title}-${kpiId}`,
            title: String(a.title || '').trim() || '(untitled)',
            kpiId,
            kpiName: a.kpiName || undefined,
            severity: a.severity === 'RED' ? 'RED' : 'AMBER',
            dueDate: due,
            status: a.status,
            selected: !done,
            ownerUserId: a.ownerUserId ?? null,
          };
        });
        setActionItems(items);
      } catch {
        toast.error(t('common.loadFailed', 'Load failed'));
        setActionItems([]);
      } finally {
        setTasksLoading(false);
      }
    },
    [t]
  );

  const createTasksFromSelected = useCallback(async () => {
    const selected = actionItems.filter((a) => a.selected);
    if (selected.length === 0) return;
    setTasksCreating(true);
    try {
      for (const a of selected) {
        const dueIso = a.dueDate ? new Date(`${a.dueDate}T00:00:00.000Z`).toISOString() : undefined;
        await Api.post('/tasks', {
          title: `[KPI] ${a.title}`,
          description: tasksReportRow?.reportId
            ? `Created from KPI report: /reports/builder/${tasksReportRow.reportId}`
            : 'Created from KPI report',
          dueDate: dueIso,
          priority: a.severity === 'RED' ? 'high' : 'medium',
          taskType: 'execution',
          source: 'manual',
          assigneeId: a.ownerUserId || undefined,
          kpiId: a.kpiId || undefined,
          why: 'Deviation action plan materialization',
        });
      }
      toast.success(t('results.kpiReports.tasks.created', 'Tasks created'), { duration: 2500 });
      setTasksModalOpen(false);
      setActionItems([]);
      setTasksReportRow(null);
    } catch {
      toast.error(t('results.kpiReports.tasks.createFailed', 'Failed to create tasks'));
    } finally {
      setTasksCreating(false);
    }
  }, [actionItems, tasksReportRow, t]);

  const getRowActions = useCallback(
    (row: TableRow): RowAction[] => [
      {
        id: 'open',
        label: t('common.open', 'Open'),
        onClick: () => navigate(`/reports/builder/${row.reportId}`),
      },
      {
        id: 'tasks',
        label: t('results.kpiReports.tasks.create', 'Create tasks from action plan'),
        onClick: () => void loadActionsForRow(row),
        divider: true,
      },
    ],
    [navigate, t, loadActionsForRow]
  );

  return (
    <>
      <FilterableTable
        columns={columns}
        data={rows}
        activeFilters={activeFilters}
        onFilterChange={onFilterChange}
        density="compact"
        canvasClassName="pl-4 pr-1.5 pt-3 pb-4"
        getRowActions={getRowActions}
        onRowClick={(row) => navigate(`/reports/builder/${row.reportId}`)}
        emptyMessage={
          loading
            ? t('common.loading', 'Loading...')
            : t(
                'results.kpiReports.empty',
                'No KPI reports yet. Create a report to review performance and corrective actions.'
              )
        }
      />

      <div className="px-4 pb-4">
        <div className="rounded-2xl border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('results.kpiReports.scorecardFlow', 'Scorecard and reconciliation flow')}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t(
                  'results.kpiReports.scorecardFlowHint',
                  'Reports should package signal review, discrepancy evidence, and next actions into one artifact.'
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                {t('results.kpi.queue.requiresReview', 'Requires review')}: {reviewContext.requiresReview}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-1 text-red-500">
                {t('results.kpi.queue.discrepancy', 'Discrepancy')}: {reviewContext.discrepancy}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-amber-600 dark:text-amber-300">
                {t('results.filters.needsEntry', 'Needs entry')}: {reviewContext.needsEntry}
              </span>
            </div>
          </div>
        </div>
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm"
            onClick={() => setCreateOpen(false)}
          />
          <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary-500/10">
                  <FileText size={16} className="text-primary-400" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {t('results.kpiReports.create.title', 'New KPI report')}
                </h2>
              </div>
              <button
                onClick={() => setCreateOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className={labelCls}>{t('common.name', 'Name')}</label>
                <input
                  className={inputCls}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t(
                    'results.kpiReports.create.titlePlaceholder',
                    'e.g. Monthly KPI Review'
                  )}
                />
              </div>

              <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.03] p-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('results.kpiReports.create.workflow', 'Closed-loop content')}
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-600 dark:text-slate-300 md:grid-cols-3">
                  <div className="rounded-lg border border-slate-200/70 dark:border-white/[0.06] px-3 py-2">
                    {t('results.kpiReports.create.workflowSignal', 'Signal snapshot and KPI selection')}
                  </div>
                  <div className="rounded-lg border border-slate-200/70 dark:border-white/[0.06] px-3 py-2">
                    {t('results.kpiReports.create.workflowReconcile', 'Discrepancy and reconciliation evidence')}
                  </div>
                  <div className="rounded-lg border border-slate-200/70 dark:border-white/[0.06] px-3 py-2">
                    {t('results.kpiReports.create.workflowActions', 'Next actions ready for execution')}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.03] p-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('results.kpiReports.create.initiatives', 'Observed initiatives')}
                </div>
                <div className="mt-2 max-h-32 overflow-auto rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50/40 dark:bg-navy-800/40">
                  {availableInitiatives.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500">
                      {t('results.initiatives.empty', 'No tracked initiatives selected.')}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200 dark:divide-navy-700">
                      {availableInitiatives.map((initiative) => {
                        const checked = selectedInitiativeIds.includes(initiative.id);
                        return (
                          <label
                            key={initiative.id}
                            className="flex items-start gap-2 p-3 cursor-pointer hover:bg-white/60 dark:hover:bg-navy-800/70 transition-colors"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked;
                                setSelectedInitiativeIds((prev) =>
                                  next
                                    ? Array.from(new Set([...prev, initiative.id]))
                                    : prev.filter((id) => id !== initiative.id)
                                );
                              }}
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                {initiative.name}
                              </div>
                              {initiative.status ? (
                                <div className="text-xs text-slate-500 truncate">
                                  {initiative.status}
                                </div>
                              ) : null}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t('common.periodStart', 'Period start')}</label>
                  <input
                    className={inputCls}
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>{t('common.periodEnd', 'Period end')}</label>
                  <input
                    className={inputCls}
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-1">
                <div className="flex items-center justify-between mb-1">
                  <label className={labelCls}>{t('results.kpiReports.create.kpis', 'KPIs')}</label>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedKpiIds(availableKpis.map((k) => k.id))}
                      className="text-primary-500 hover:text-primary-400 transition-colors"
                      disabled={kpisLoading || availableKpis.length === 0}
                    >
                      {t('common.selectAll', 'Select all')}
                    </button>
                    <span className="text-slate-300 dark:text-navy-600">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedKpiIds([])}
                      className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                      disabled={kpisLoading || availableKpis.length === 0}
                    >
                      {t('common.clear', 'Clear')}
                    </button>
                  </div>
                </div>

                <input
                  className={inputCls}
                  value={kpiSearch}
                  onChange={(e) => setKpiSearch(e.target.value)}
                  placeholder={t('common.search', 'Search')}
                />

                <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50/40 dark:bg-navy-800/40">
                  {kpisLoading ? (
                    <div className="p-3 text-sm text-slate-500">
                      {t('common.loading', 'Loading...')}
                    </div>
                  ) : filteredKpis.length === 0 ? (
                    <div className="p-3 text-sm text-slate-500">
                      {t('results.kpiReports.create.noKpis', 'No KPIs found.')}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200 dark:divide-navy-700">
                      {filteredKpis.map((k) => {
                        const checked = selectedKpiIds.includes(k.id);
                        return (
                          <label
                            key={k.id}
                            className="flex items-start gap-2 p-3 cursor-pointer hover:bg-white/60 dark:hover:bg-navy-800/70 transition-colors"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked;
                                setSelectedKpiIds((prev) =>
                                  next
                                    ? Array.from(new Set([...prev, k.id]))
                                    : prev.filter((id) => id !== k.id)
                                );
                              }}
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                {k.name}
                              </div>
                              {k.initiativeName ? (
                                <div className="text-xs text-slate-500 truncate">
                                  {k.initiativeName}
                                </div>
                              ) : null}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  {t('results.kpiReports.create.selectedCount', 'Selected')}:{' '}
                  {selectedKpiIds.length}/{availableKpis.length}
                </div>
              </div>

              <button
                type="submit"
                disabled={!periodStart || creating || selectedKpiIds.length === 0}
                className="w-full h-9 text-sm font-medium rounded-full bg-primary-500 text-white hover:bg-primary-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creating ? t('common.creating', 'Creating...') : t('common.create', 'Create')}
              </button>
            </form>
          </div>
        </div>
      )}

      {tasksModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm"
            onClick={() => (tasksCreating ? null : setTasksModalOpen(false))}
          />
          <div className="relative w-full max-w-2xl mx-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {t('results.kpiReports.tasks.title', 'Create tasks from action plan')}
              </h2>
              <button
                onClick={() => (tasksCreating ? null : setTasksModalOpen(false))}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {tasksLoading ? (
                <div className="text-sm text-slate-500">{t('common.loading', 'Loading...')}</div>
              ) : actionItems.length === 0 ? (
                <div className="text-sm text-slate-500">
                  {t('results.kpiReports.tasks.empty', 'No actions found in this report snapshot.')}
                </div>
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {actionItems.map((a) => (
                    <label
                      key={a.key}
                      className="flex items-start gap-3 p-3 rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.06] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={a.selected}
                        onChange={() =>
                          setActionItems((prev) =>
                            prev.map((x) => (x.key === a.key ? { ...x, selected: !x.selected } : x))
                          )
                        }
                        className="mt-1 rounded border-navy-600 bg-slate-200 dark:bg-navy-700 text-primary-500 focus:ring-primary-500"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {a.title}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {a.kpiName || a.kpiId}
                          {a.dueDate ? ` · ${t('common.due', 'Due')}: ${a.dueDate}` : ''}
                          {a.severity ? ` · ${a.severity}` : ''}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={tasksCreating}
                  onClick={() => setTasksModalOpen(false)}
                  className="h-9 px-4 rounded-full text-sm font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-white/[0.05] transition-colors disabled:opacity-60"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="button"
                  disabled={tasksCreating || actionItems.filter((a) => a.selected).length === 0}
                  onClick={() => void createTasksFromSelected()}
                  className="h-9 px-4 rounded-full text-sm font-medium bg-primary-500 text-white hover:bg-primary-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {tasksCreating
                    ? t('common.creating', 'Creating...')
                    : t('results.kpiReports.tasks.createCta', 'Create tasks')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ResultsKpiReportsView;
