import { BarChart3, DollarSign, FileText, ListChecks, Plus, Target } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import {
  shouldFallbackToLegacyResults,
  V8ResultsApi,
  type V8ResultsDashboardSnapshot,
} from '@/services/api/v8/results';

import { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import { ModuleHub } from '../shared/ModuleHub/ModuleHub';
import { ModuleTab, TabConfig, ViewMode } from '../shared/ModuleHub/types';
import { useModuleOpenDocuments } from '../shared/ModuleHub/useModuleOpenDocuments';
import { KPICreateModal } from './KPICreateModal';
import { KPITimeSeriesDrawer } from './KPITimeSeriesDrawer';
import { KpiOverviewView } from './KpiOverviewView';
import { KpiQueueView } from './KpiQueueView';
import { ResultsKpiScorecardsView } from './ResultsKpiScorecardsView';
import {
  ResultsKpiConnectorsView,
  ResultsReportSchedulesView,
  ResultsWallboardsView,
} from './ResultsReportingEnterpriseViews';
import { ResultsInitiativesView } from './ResultsInitiativesView';
import { ResultsKpiReportsView } from './ResultsKpiReportsView';
import { ResultsKpisTableV3 } from './ResultsKpisTableV3';
import { ResultsGridView } from './ResultsKPITable';
import { ROIAnalysisView } from './ROIAnalysisView';
import { ROIDetailDrawer } from './ROIDetailDrawer';
import { ROIOpenModal } from './ROIOpenModal';
import { ROITrackingView } from './ROITrackingView';
import {
  filterKpisByLifecycle,
  filterKpisByObservationPhase,
  filterTrackedInitiatives,
  type KpiDrawerSection,
  type ResultsKPI,
  type ResultsLifecycleFilter,
  type ResultsTrackedInitiative,
} from './kpiDomain';
import { loadResultsKpis } from './kpiRuntime';
import { createResultsShowcaseSnapshot } from './resultsShowcaseData';

interface ResultsRuntimeChipProps {
  label: string;
  value: string;
  dotClassName: string;
}

const ResultsRuntimeChip: React.FC<ResultsRuntimeChipProps> = ({ label, value, dotClassName }) => (
  <div className="h-8 inline-flex items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium border whitespace-nowrap bg-white/60 text-slate-600 border-slate-200/60 dark:bg-white/[0.02] dark:text-slate-300 dark:border-white/[0.06]">
    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${dotClassName}`} />
    <span>{label}</span>
    <span className="ml-0.5 px-1.5 py-0.5 text-[10px] rounded-md font-semibold tabular-nums leading-none bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-300">
      {value}
    </span>
  </div>
);

interface ResultsInfoChipProps {
  label: string;
  value: string | number;
  dotClassName?: string;
}

const ResultsInfoChip: React.FC<ResultsInfoChipProps> = ({ label, value, dotClassName = 'bg-slate-400' }) => (
  <div className="h-8 inline-flex items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium border whitespace-nowrap bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60">
    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${dotClassName}`} />
    <span>{label}</span>
    <span className="ml-0.5 px-1.5 py-0.5 text-[10px] rounded-md font-semibold tabular-nums leading-none bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-200">
      {value}
    </span>
  </div>
);

interface ResultsControlSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  ariaLabel: string;
}

const ResultsControlSelect: React.FC<ResultsControlSelectProps> = ({
  value,
  onChange,
  options,
  ariaLabel,
}) => (
  <div className="relative">
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 rounded-full border border-slate-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] px-3 pr-8 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

export const ResultsHub: React.FC = () => {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<ModuleTab>('results_initiatives');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [lifecycleFilter, setLifecycleFilter] = useState<ResultsLifecycleFilter>('all');
  const [observationPhaseFilter, setObservationPhaseFilter] = useState<
    'all' | 'realization' | 'post-implementation'
  >('all');
  const [kpiWorkspaceMode, setKpiWorkspaceMode] = useState<'overview' | 'queue' | 'catalog' | 'scorecards'>(
    'overview'
  );
  const [reportWorkspaceMode, setReportWorkspaceMode] = useState<
    'reports' | 'schedules' | 'wallboards' | 'connectors'
  >('reports');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [kpiReportCreateNonce, setKpiReportCreateNonce] = useState(0);
  const [kpiScorecardCreateNonce, setKpiScorecardCreateNonce] = useState(0);
  const [reportWorkspaceCreateNonce, setReportWorkspaceCreateNonce] = useState(0);
  const [drawerState, setDrawerState] = useState<{ kpiId: string; section?: KpiDrawerSection } | null>(
    null
  );
  const [roiOpenModal, setRoiOpenModal] = useState(false);
  const [roiDrawer, setRoiDrawer] = useState<{ id: string; name: string } | null>(null);
  const [roiRefreshNonce, setRoiRefreshNonce] = useState(0);

  const [kpis, setKpis] = useState<ResultsKPI[]>([]);
  const [trackedInitiatives, setTrackedInitiatives] = useState<ResultsTrackedInitiative[]>([]);
  const [loading, setLoading] = useState(true);
  const [v8Snapshot, setV8Snapshot] = useState<V8ResultsDashboardSnapshot | null>(null);
  const [resultsSource, setResultsSource] = useState<'v8' | 'legacy' | 'empty' | 'showcase'>('empty');

  const { openDocuments, setOpenDocuments, activeDocumentId, setActiveDocumentId } =
    useModuleOpenDocuments('results');

  const fetchKPIs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadResultsKpis();
      setTrackedInitiatives(result.initiatives);
      setKpis(result.kpis);
      setResultsSource(result.source);
    } catch {
      setTrackedInitiatives([]);
      setKpis([]);
      setResultsSource('empty');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadV8Snapshot = useCallback(async () => {
    try {
      const response = await V8ResultsApi.getDashboard();
      setV8Snapshot(response.snapshot);
    } catch {
      setV8Snapshot(null);
    }
  }, []);

  useEffect(() => {
    fetchKPIs();
  }, [fetchKPIs]);

  useEffect(() => {
    void loadV8Snapshot();
  }, [loadV8Snapshot]);

  const refreshResultsTruth = useCallback(
    async (options?: { refreshRoi?: boolean }) => {
      await Promise.allSettled([fetchKPIs(), loadV8Snapshot()]);
      if (options?.refreshRoi !== false) {
        setRoiRefreshNonce(Date.now());
      }
    },
    [fetchKPIs, loadV8Snapshot]
  );

  const tabs: TabConfig[] = useMemo(
    () => [
      {
        id: 'results_initiatives' as ModuleTab,
        label: t('results.tabs.initiatives', 'Initiatives'),
        icon: <ListChecks size={16} />,
        count: trackedInitiatives.length,
      },
      {
        id: 'results_kpi' as ModuleTab,
        label: t('results.tabs.kpi', 'KPI'),
        icon: <Target size={16} />,
        count: kpis.length,
      },
      {
        id: 'results_reports' as ModuleTab,
        label: t('results.tabs.kpiReports', 'Reports'),
        icon: <FileText size={16} />,
      },
      {
        id: 'roi' as ModuleTab,
        label: t('results.tabs.roi', 'ROI'),
        icon: <DollarSign size={16} />,
      },
      {
        id: 'roi_analysis' as ModuleTab,
        label: t('results.tabs.roiAnalysis', 'ROI Analysis'),
        icon: <DollarSign size={16} />,
      },
    ],
    [t, kpis.length, trackedInitiatives.length]
  );

  const lifecycleScopedKpis = useMemo(
    () => filterKpisByLifecycle(kpis, lifecycleFilter),
    [kpis, lifecycleFilter]
  );

  const filteredKpis = useMemo(() => {
    let items = filterKpisByObservationPhase(lifecycleScopedKpis, observationPhaseFilter);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (k) =>
          k.name.toLowerCase().includes(q) ||
          k.initiativeName?.toLowerCase().includes(q) ||
          (k.linkedInitiatives || []).some((i) => i.name.toLowerCase().includes(q)) ||
          k.description?.toLowerCase().includes(q)
      );
    }

    if (activeFilters.length > 0) {
      const byColumn: Record<string, string[]> = {};
      activeFilters.forEach((f) => {
        if (!byColumn[f.column]) byColumn[f.column] = [];
        byColumn[f.column].push(f.value);
      });

      Object.entries(byColumn).forEach(([col, vals]) => {
        items = items.filter((k) => {
          if (col === 'queue') {
            return vals.some((value) => {
              if (value === 'needs-entry') return k.needsEntry;
              if (value === 'below-target') return k.status === 'below';
              if (value === 'discrepancy') return Boolean(k.openDeviationCase);
              if (value === 'requires-review') {
                return k.needsEntry || k.status === 'below' || Boolean(k.openDeviationCase);
              }
              return false;
            });
          }
          const v = (k as any)[col];
          return vals.includes(String(v));
        });
      });
    }

    return items;
  }, [lifecycleScopedKpis, observationPhaseFilter, searchQuery, activeFilters]);

  const filteredInitiatives = useMemo(() => {
    let items = filterTrackedInitiatives(trackedInitiatives, lifecycleFilter);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (initiative) =>
          initiative.initiativeName.toLowerCase().includes(q) ||
          initiative.initiativeStatus.toLowerCase().includes(q)
      );
    }

    return items;
  }, [trackedInitiatives, lifecycleFilter, searchQuery]);

  const activeSignalFilter = useMemo(() => {
    const needsEntryFilter = activeFilters.find((filter) => filter.column === 'needsEntry');
    if (needsEntryFilter?.value === 'true') return 'needs-entry';

    const statusFilter = activeFilters.find((filter) => filter.column === 'status');
    if (statusFilter?.value) return statusFilter.value;

    const queueFilter = activeFilters.find((filter) => filter.column === 'queue');
    if (queueFilter?.value) return queueFilter.value;

    return 'all';
  }, [activeFilters]);

  const replaceResultsFilters = useCallback((nextFilter: FilterChip | null, columns: string[]) => {
    setActiveFilters((previous) => {
      const rest = previous.filter((filter) => !columns.includes(filter.column));
      return nextFilter ? [...rest, nextFilter] : rest;
    });
  }, []);

  const applySignalFilter = useCallback(
    (value: string) => {
      if (value === 'all') {
        replaceResultsFilters(null, ['needsEntry', 'status', 'queue']);
        return;
      }

      if (value === 'needs-entry') {
        replaceResultsFilters(
          {
            id: 'needsEntry:true',
            column: 'needsEntry',
            value: 'true',
            label: t('results.filters.needsEntry', 'Needs entry'),
          },
          ['needsEntry', 'status', 'queue']
        );
        return;
      }

      if (value === 'discrepancy' || value === 'requires-review') {
        replaceResultsFilters(
          {
            id: `queue:${value}`,
            column: 'queue',
            value,
            label:
              value === 'discrepancy'
                ? t('results.kpi.queue.discrepancy', 'Discrepancy')
                : t('results.kpi.queue.requiresReview', 'Requires review'),
          },
          ['needsEntry', 'status', 'queue']
        );
        return;
      }

      replaceResultsFilters(
        {
          id: `status:${value}`,
          column: 'status',
          value,
          label:
            value === 'below'
              ? t('results.filters.below', 'Below')
              : value === 'on-target'
                ? t('results.filters.onTarget', 'On target')
                : t('results.filters.noData', 'No data'),
        },
        ['needsEntry', 'status', 'queue']
      );
    },
    [replaceResultsFilters, t]
  );

  const openInitiativeKpiLane = useCallback(
    (initiative: ResultsTrackedInitiative) => {
      setActiveTab('results_kpi');
      setKpiWorkspaceMode('catalog');
      setViewMode('table');
      replaceResultsFilters(
        {
          id: `initiativeName:${initiative.initiativeName}`,
          column: 'initiativeName',
          value: initiative.initiativeName,
          label: initiative.initiativeName,
        },
        ['initiativeName']
      );
    },
    [replaceResultsFilters]
  );

  const openInitiativeReportsLane = useCallback(() => {
    setActiveTab('results_reports');
  }, []);

  const handleDeleteKpi = useCallback(
    async (kpiId: string) => {
      const ok = window.confirm(
        t(
          'results.deleteConfirm',
          'Delete this KPI? This will remove its measurements, mappings, and deviation cases.'
        )
      );
      if (!ok) return;
      try {
        try {
          await V8ResultsApi.deleteKpi(kpiId);
        } catch (error) {
          if (!shouldFallbackToLegacyResults(error)) {
            throw error;
          }
          await Api.delete(`/benefits/kpis/${kpiId}`);
        }
      } catch {
        // silent
      } finally {
        setDrawerState((prev) => (prev?.kpiId === kpiId ? null : prev));
        void refreshResultsTruth();
      }
    },
    [refreshResultsTruth, t]
  );

  const openKpiDrawer = useCallback((kpiId: string, section?: KpiDrawerSection) => {
    setDrawerState({ kpiId, section });
  }, []);

  const handleRowAction = useCallback(
    (action: string, kpi: ResultsKPI) => {
      switch (action) {
        case 'open':
        case 'preview':
          openKpiDrawer(kpi.id, 'summary');
          break;
        case 'record':
          openKpiDrawer(kpi.id, 'record');
          break;
        case 'edit':
          openKpiDrawer(kpi.id, 'definition');
          break;
        case 'links':
          openKpiDrawer(kpi.id, 'lineage');
          break;
        case 'history':
          openKpiDrawer(kpi.id, 'history');
          break;
        case 'delete':
          void handleDeleteKpi(kpi.id);
          break;
        default:
          break;
      }
    },
    [handleDeleteKpi, openKpiDrawer]
  );

  const handleCreateSuccess = useCallback(() => {
    setShowCreateModal(false);
    void refreshResultsTruth();
  }, [refreshResultsTruth]);

  const openRoiPicker = useCallback(() => setRoiOpenModal(true), []);

  const runtimeSnapshot = useMemo(() => {
    if (
      resultsSource === 'showcase' &&
      (!v8Snapshot || (v8Snapshot.kpiScorecard.totalKpis || 0) === 0)
    ) {
      return createResultsShowcaseSnapshot();
    }
    return v8Snapshot;
  }, [resultsSource, v8Snapshot]);

  const governedRuntimeStrip = useMemo(() => {
    if (!runtimeSnapshot) {
      return null;
    }

    return (
      <>
        {resultsSource === 'showcase' && (
          <ResultsRuntimeChip
            label={t('results.runtime.showcase', 'Showcase data')}
            value={t('results.runtime.local', 'local')}
            dotClassName="bg-sky-400"
          />
        )}
        <div className="mx-1 h-5 w-px shrink-0 bg-slate-200/70 dark:bg-white/[0.08]" />
        <ResultsRuntimeChip
          label={t('results.runtime.governedKpis', 'Governed KPIs')}
          value={String(runtimeSnapshot.kpiScorecard.totalKpis || 0)}
          dotClassName="bg-emerald-400"
        />
        <ResultsRuntimeChip
          label={t('results.runtime.deviations', 'Deviations')}
          value={String(runtimeSnapshot.activeDeviationsCount || 0)}
          dotClassName="bg-amber-400"
        />
        <ResultsRuntimeChip
          label={t('results.runtime.realizedRoi', 'Realized ROI')}
          value={runtimeSnapshot.roiDashboard.totalRealized.toLocaleString()}
          dotClassName="bg-violet-400"
        />
        <ResultsRuntimeChip
          label={t('results.runtime.reconciliation', 'Reconciliation')}
          value={String(runtimeSnapshot.reconciliationHealth.unresolvedCount || 0)}
          dotClassName="bg-cyan-400"
        />
      </>
    );
  }, [resultsSource, runtimeSnapshot, t]);

  const setQueueFilter = useCallback((filters: FilterChip[] = []) => {
    setActiveTab('results_kpi');
    setKpiWorkspaceMode('queue');
    setActiveFilters(filters);
  }, []);

  const rightControls = useMemo(() => {
    const lifecycleOptions = [
      { value: 'all', label: t('results.filters.lifecycleAll', 'Lifecycle: All') },
      {
        value: 'in-realization',
        label: t('results.filters.lifecycleInRealization', 'Lifecycle: In realization'),
      },
      { value: 'realized', label: t('results.filters.lifecycleRealized', 'Lifecycle: Realized') },
    ];

    if (activeTab === 'results_initiatives' || activeTab === 'results_reports') {
      return (
        <ResultsControlSelect
          ariaLabel={t('results.filters.lifecycle', 'Lifecycle filter')}
          value={lifecycleFilter}
          onChange={(value) => setLifecycleFilter(value as ResultsLifecycleFilter)}
          options={lifecycleOptions}
        />
      );
    }

    if (activeTab === 'results_kpi') {
      if (kpiWorkspaceMode === 'scorecards') {
        return (
          <ResultsControlSelect
            ariaLabel={t('results.filters.lifecycle', 'Lifecycle filter')}
            value={lifecycleFilter}
            onChange={(value) => setLifecycleFilter(value as ResultsLifecycleFilter)}
            options={lifecycleOptions}
          />
        );
      }

      return (
        <div className="flex items-center gap-2">
          <ResultsControlSelect
            ariaLabel={t('results.filters.lifecycle', 'Lifecycle filter')}
            value={lifecycleFilter}
            onChange={(value) => setLifecycleFilter(value as ResultsLifecycleFilter)}
            options={lifecycleOptions}
          />
          <ResultsControlSelect
            ariaLabel={t('results.filters.phase', 'Observation phase filter')}
            value={observationPhaseFilter}
            onChange={(value) =>
              setObservationPhaseFilter(value as 'all' | 'realization' | 'post-implementation')
            }
            options={[
              { value: 'all', label: t('results.filters.phaseAll', 'Phase: All') },
              { value: 'realization', label: t('results.filters.phaseRealization', 'Phase: Realization') },
              {
                value: 'post-implementation',
                label: t('results.filters.phasePostImplementation', 'Phase: Post-implementation'),
              },
            ]}
          />
          <ResultsControlSelect
            ariaLabel={t('results.filters.signal', 'Signal filter')}
            value={activeSignalFilter}
            onChange={applySignalFilter}
            options={[
              { value: 'all', label: t('results.filters.signalAll', 'Signal: All') },
              { value: 'needs-entry', label: t('results.filters.signalNeedsEntry', 'Signal: Needs entry') },
              { value: 'below', label: t('results.filters.signalBelow', 'Signal: Below target') },
              { value: 'on-target', label: t('results.filters.signalOnTarget', 'Signal: On target') },
              { value: 'no-data', label: t('results.filters.signalNoData', 'Signal: No data') },
              { value: 'discrepancy', label: t('results.filters.signalDiscrepancy', 'Signal: Discrepancy') },
              {
                value: 'requires-review',
                label: t('results.filters.signalRequiresReview', 'Signal: Requires review'),
              },
            ]}
          />
        </div>
      );
    }

    return null;
  }, [activeSignalFilter, activeTab, applySignalFilter, kpiWorkspaceMode, lifecycleFilter, observationPhaseFilter, t]);

  const commandRowContent = useMemo(() => {
    const chipBase =
      'h-8 inline-flex items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium border transition-colors whitespace-nowrap';
    const actionButton = (label: string, onClick: () => void, active = false) => (
      <button
        type="button"
        onClick={onClick}
        className={`${chipBase} ${
          active
            ? 'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40'
            : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50'
        }`}
      >
        {label}
      </button>
    );

    if (activeTab === 'results_initiatives') {
      return governedRuntimeStrip ? (
        <div className="flex items-center gap-2 overflow-x-auto">{governedRuntimeStrip}</div>
      ) : null;
    }

    if (activeTab === 'results_kpi') {
      const scopeKpis = filterKpisByObservationPhase(lifecycleScopedKpis, observationPhaseFilter);
      const queueCounts = scopeKpis.reduce(
        (acc, k) => {
          acc.total += 1;
          if (k.needsEntry) acc.needsEntry += 1;
          if (k.status === 'below') acc.below += 1;
          if (k.status === 'on-target') acc.onTarget += 1;
          if (k.status === 'no-data') acc.noData += 1;
          if (k.openDeviationCase) acc.discrepancy += 1;
          if (k.needsEntry || k.status === 'below' || k.openDeviationCase) acc.requiresReview += 1;
          return acc;
        },
        {
          total: 0,
          needsEntry: 0,
          below: 0,
          onTarget: 0,
          noData: 0,
          discrepancy: 0,
          requiresReview: 0,
        }
      );

      return (
        <div className="flex items-center gap-2 overflow-x-auto">
          {actionButton(
            t('results.kpi.workspace.overview', 'Overview'),
            () => setKpiWorkspaceMode('overview'),
            kpiWorkspaceMode === 'overview'
          )}
          {actionButton(
            t('results.kpi.workspace.queue', 'Queue'),
            () => setKpiWorkspaceMode('queue'),
            kpiWorkspaceMode === 'queue'
          )}
          {actionButton(
            t('results.kpi.workspace.catalog', 'Catalog'),
            () => setKpiWorkspaceMode('catalog'),
            kpiWorkspaceMode === 'catalog'
          )}
          {actionButton(
            t('results.kpi.workspace.scorecards', 'Scorecards'),
            () => {
              setActiveFilters([]);
              setKpiWorkspaceMode('scorecards');
            },
            kpiWorkspaceMode === 'scorecards'
          )}
          {actionButton(
            t('results.actions.createReport', 'Create KPI report'),
            () => {
              setActiveTab('results_reports');
              setKpiReportCreateNonce(Date.now());
            }
          )}
          <ResultsInfoChip
            label={t('results.runtime.kpiSet', 'KPI set')}
            value={queueCounts.total}
            dotClassName="bg-sky-400"
          />
          <ResultsInfoChip
            label={t('results.filters.needsEntry', 'Needs entry')}
            value={queueCounts.needsEntry}
            dotClassName="bg-amber-400"
          />
          <ResultsInfoChip
            label={t('results.filters.below', 'Below')}
            value={queueCounts.below}
            dotClassName="bg-red-400"
          />
          <ResultsInfoChip
            label={t('results.kpi.queue.discrepancy', 'Discrepancy')}
            value={queueCounts.discrepancy}
            dotClassName="bg-rose-400"
          />
          <ResultsInfoChip
            label={t('results.kpi.queue.requiresReview', 'Requires review')}
            value={queueCounts.requiresReview}
            dotClassName="bg-violet-400"
          />
          {governedRuntimeStrip}
        </div>
      );
    }

    if (activeTab === 'roi') {
      return (
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={openRoiPicker}
            className={`${chipBase} bg-primary-500/15 text-primary-300 border-primary-500/30 hover:bg-primary-500/20`}
            title={t('results.roi.actions.recordActual', 'Record actual')}
          >
            <Plus size={14} />
            <span>{t('results.roi.actions.recordActual', 'Record actual')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('roi_analysis')}
            className={`${chipBase} bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50`}
            title={t('results.tabs.roiAnalysis', 'ROI Analysis')}
          >
            <DollarSign size={14} className="text-amber-400" />
            <span>{t('results.tabs.roiAnalysis', 'ROI Analysis')}</span>
          </button>
          {governedRuntimeStrip}
        </div>
      );
    }

    if (activeTab === 'roi_analysis') {
      return (
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('roi')}
            className={`${chipBase} bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50`}
            title={t('results.tabs.roi', 'ROI')}
          >
            <DollarSign size={14} className="text-amber-400" />
            <span>{t('results.tabs.roi', 'ROI')}</span>
          </button>
          {governedRuntimeStrip}
        </div>
      );
    }

    if (activeTab === 'results_reports') {
      return (
        <div className="flex items-center gap-2 overflow-x-auto">
          {actionButton(
            t('results.reporting.workspace.reports', 'Reports'),
            () => {
              setActiveFilters([]);
              setReportWorkspaceMode('reports');
            },
            reportWorkspaceMode === 'reports'
          )}
          {actionButton(
            t('results.reporting.workspace.schedules', 'Schedules'),
            () => {
              setActiveFilters([]);
              setReportWorkspaceMode('schedules');
            },
            reportWorkspaceMode === 'schedules'
          )}
          {actionButton(
            t('results.reporting.workspace.wallboards', 'Wallboards'),
            () => {
              setActiveFilters([]);
              setReportWorkspaceMode('wallboards');
            },
            reportWorkspaceMode === 'wallboards'
          )}
          {actionButton(
            t('results.reporting.workspace.connectors', 'Connectors'),
            () => {
              setActiveFilters([]);
              setReportWorkspaceMode('connectors');
            },
            reportWorkspaceMode === 'connectors'
          )}
          {governedRuntimeStrip}
        </div>
      );
    }

    return governedRuntimeStrip ? (
      <div className="flex items-center gap-2 overflow-x-auto">{governedRuntimeStrip}</div>
    ) : null;
  }, [
    activeTab,
    governedRuntimeStrip,
    kpiWorkspaceMode,
    lifecycleScopedKpis,
    observationPhaseFilter,
    openRoiPicker,
    reportWorkspaceMode,
    t,
  ]);

  return (
    <>
      <ModuleHub
        persistViewModeKey="results"
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setSearchQuery('');
          setActiveFilters([]);
          setActiveDocumentId(null);
          if (tab !== 'results_kpi') {
            setKpiWorkspaceMode('overview');
          }
          if (tab !== 'results_reports') {
            setReportWorkspaceMode('reports');
          }
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={setSearchQuery}
        openDocuments={openDocuments}
        activeDocumentId={activeDocumentId}
        onSelectDocument={setActiveDocumentId}
        onCloseDocument={(id) => {
          setOpenDocuments((prev) => prev.filter((d) => d.id !== id));
          if (activeDocumentId === id) setActiveDocumentId(null);
        }}
        onShowList={() => setActiveDocumentId(null)}
        activeFilters={activeFilters}
        onRemoveFilter={(id) => setActiveFilters((prev) => prev.filter((f) => f.id !== id))}
        onClearFilters={() => setActiveFilters([])}
        onNewItem={
          activeTab === 'results_kpi' && kpiWorkspaceMode === 'catalog'
            ? () => setShowCreateModal(true)
            : activeTab === 'results_kpi' && kpiWorkspaceMode === 'scorecards'
              ? () => setKpiScorecardCreateNonce(Date.now())
            : activeTab === 'results_reports'
                ? () =>
                    reportWorkspaceMode === 'reports'
                      ? setKpiReportCreateNonce(Date.now())
                      : setReportWorkspaceCreateNonce(Date.now())
            : activeTab === 'roi'
                ? () => setRoiOpenModal(true)
                : undefined
        }
        newItemLabel={
          activeTab === 'results_kpi' && kpiWorkspaceMode === 'catalog'
            ? t('results.addKpi', '+ Add KPI')
            : activeTab === 'results_kpi' && kpiWorkspaceMode === 'scorecards'
              ? t('results.kpi.scorecards.add', '+ Add scorecard')
            : activeTab === 'results_reports'
                ? reportWorkspaceMode === 'reports'
                  ? t('results.kpiReports.new', '+ New report')
                  : reportWorkspaceMode === 'schedules'
                    ? t('results.reporting.addSchedule', '+ Add schedule')
                    : reportWorkspaceMode === 'wallboards'
                      ? t('results.reporting.addWallboard', '+ Add wallboard')
                      : t('results.reporting.addConnector', '+ Add connector')
            : activeTab === 'roi'
                ? t('results.roi.add', '+ Record ROI')
                : undefined
        }
        availableViewModes={
          activeTab === 'results_kpi' && kpiWorkspaceMode === 'catalog'
            ? ['table', 'grid']
            : ['table']
        }
        rightControls={rightControls}
        commandRowContent={commandRowContent}
      >
        {activeTab === 'results_initiatives' ? (
          <ResultsInitiativesView
            initiatives={filteredInitiatives}
            onOpenInitiativeKpis={openInitiativeKpiLane}
            onOpenInitiativeReports={openInitiativeReportsLane}
          />
        ) : activeTab === 'roi_analysis' ? (
          <ROIAnalysisView />
        ) : activeTab === 'results_reports' ? (
          reportWorkspaceMode === 'reports' ? (
            <ResultsKpiReportsView
              activeFilters={activeFilters}
              onFilterChange={setActiveFilters}
              createNonce={kpiReportCreateNonce}
              selectedLifecycleFilter={lifecycleFilter}
              selectedInitiatives={filteredInitiatives}
              selectedKpis={filteredKpis}
            />
          ) : reportWorkspaceMode === 'schedules' ? (
            <ResultsReportSchedulesView
              activeFilters={activeFilters}
              onFilterChange={setActiveFilters}
              createNonce={reportWorkspaceCreateNonce}
              selectedKpis={filteredKpis}
            />
          ) : reportWorkspaceMode === 'wallboards' ? (
            <ResultsWallboardsView
              activeFilters={activeFilters}
              onFilterChange={setActiveFilters}
              createNonce={reportWorkspaceCreateNonce}
              selectedKpis={filteredKpis}
            />
          ) : (
            <ResultsKpiConnectorsView
              activeFilters={activeFilters}
              onFilterChange={setActiveFilters}
              createNonce={reportWorkspaceCreateNonce}
              selectedKpis={filteredKpis}
            />
          )
        ) : activeTab === 'roi' ? (
          <ROITrackingView refreshNonce={roiRefreshNonce} />
        ) : loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex items-center gap-3 text-slate-400">
              <BarChart3 size={20} className="animate-pulse" />
              <span className="text-sm">{t('common.loading', 'Loading...')}</span>
            </div>
          </div>
        ) : activeTab === 'results_kpi' && kpiWorkspaceMode === 'overview' ? (
          <KpiOverviewView
            kpis={filteredKpis}
            governedSnapshot={runtimeSnapshot}
            onOpenCatalog={(filters) => {
              setKpiWorkspaceMode('catalog');
              setActiveFilters(filters || []);
              setViewMode('table');
            }}
            onOpenQueue={(filters) => {
              setQueueFilter(filters || []);
            }}
            onOpenScorecards={() => {
              setActiveFilters([]);
              setKpiWorkspaceMode('scorecards');
              setViewMode('table');
            }}
            onOpenReports={() => setActiveTab('results_reports')}
            onOpenKpi={(kpiId) => openKpiDrawer(kpiId, 'summary')}
          />
        ) : activeTab === 'results_kpi' && kpiWorkspaceMode === 'queue' ? (
          <KpiQueueView
            kpis={filteredKpis}
            onOpenKpi={(kpiId) => openKpiDrawer(kpiId, 'summary')}
          />
        ) : activeTab === 'results_kpi' && kpiWorkspaceMode === 'scorecards' ? (
          <ResultsKpiScorecardsView
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            createNonce={kpiScorecardCreateNonce}
            initiatives={filteredInitiatives}
          />
        ) : activeTab === 'results_kpi' && viewMode === 'table' ? (
          <ResultsKpisTableV3
            kpis={filteredKpis}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            onOpenKpi={openKpiDrawer}
            onDeleteKpi={handleDeleteKpi}
          />
        ) : activeTab === 'results_kpi' ? (
          <ResultsGridView
            kpis={filteredKpis}
            onItemClick={(kpi) => openKpiDrawer(kpi.id, 'summary')}
            onItemAction={handleRowAction}
            onNewItem={() => setShowCreateModal(true)}
          />
        ) : null}
      </ModuleHub>

      {showCreateModal && (
        <KPICreateModal onClose={() => setShowCreateModal(false)} onSuccess={handleCreateSuccess} />
      )}

      {drawerState && (
        <KPITimeSeriesDrawer
          kpiId={drawerState.kpiId}
          initialSection={drawerState.section}
          onClose={() => setDrawerState(null)}
          onValueRecorded={() => {
            void refreshResultsTruth();
          }}
        />
      )}

      {roiOpenModal && (
        <ROIOpenModal
          title={t('results.roi.add', '+ Record ROI')}
          onClose={() => setRoiOpenModal(false)}
          onSelect={(i) => {
            setRoiOpenModal(false);
            setRoiDrawer({ id: i.id, name: i.name });
          }}
        />
      )}

      {roiDrawer && (
        <ROIDetailDrawer
          initiativeId={roiDrawer.id}
          initiativeName={roiDrawer.name}
          onClose={() => setRoiDrawer(null)}
          onSaved={() => {
            void refreshResultsTruth();
          }}
        />
      )}
    </>
  );
};

export default ResultsHub;
