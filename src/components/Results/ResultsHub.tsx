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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [kpiReportCreateNonce, setKpiReportCreateNonce] = useState(0);
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

  const { openDocuments, setOpenDocuments, activeDocumentId, setActiveDocumentId } =
    useModuleOpenDocuments('results');

  const fetchKPIs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadResultsKpis();
      setTrackedInitiatives(result.initiatives);
      setKpis(result.kpis);
    } catch {
      setTrackedInitiatives([]);
      setKpis([]);
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
          openKpiDrawer(kpi.id, 'settings');
          break;
        case 'links':
          openKpiDrawer(kpi.id, 'links');
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

  const governedRuntimeStrip = useMemo(() => {
    if (!v8Snapshot) {
      return null;
    }

    return (
      <>
        <div className="mx-1 h-5 w-px shrink-0 bg-slate-200/70 dark:bg-white/[0.08]" />
        <ResultsRuntimeChip
          label={t('results.runtime.governedKpis', 'Governed KPIs')}
          value={String(v8Snapshot.kpiScorecard.totalKpis || 0)}
          dotClassName="bg-emerald-400"
        />
        <ResultsRuntimeChip
          label={t('results.runtime.deviations', 'Deviations')}
          value={String(v8Snapshot.activeDeviationsCount || 0)}
          dotClassName="bg-amber-400"
        />
        <ResultsRuntimeChip
          label={t('results.runtime.realizedRoi', 'Realized ROI')}
          value={v8Snapshot.roiDashboard.totalRealized.toLocaleString()}
          dotClassName="bg-violet-400"
        />
        <ResultsRuntimeChip
          label={t('results.runtime.reconciliation', 'Reconciliation')}
          value={String(v8Snapshot.reconciliationHealth.unresolvedCount || 0)}
          dotClassName="bg-cyan-400"
        />
      </>
    );
  }, [t, v8Snapshot]);

  const setCatalogFilter = useCallback((filters: FilterChip[] = []) => {
    setActiveTab('results_kpi');
    setActiveFilters(filters);
  }, []);

  const commandRowContent = useMemo(() => {
    const chipBase =
      'h-8 inline-flex items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium border transition-colors whitespace-nowrap';
    const badgeBase =
      'px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums leading-none';
    const lifecycleChip = (value: ResultsLifecycleFilter, label: string) => (
      <button
        type="button"
        onClick={() => setLifecycleFilter(value)}
        className={`${chipBase} ${
          lifecycleFilter === value
            ? 'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40'
            : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50'
        }`}
      >
        <span>{label}</span>
      </button>
    );

    if (activeTab === 'results_initiatives') {
      return (
        <div className="flex items-center gap-2 overflow-x-auto">
          {lifecycleChip('all', t('common.all', 'All'))}
          {lifecycleChip('in-realization', t('results.lifecycle.inRealization', 'In realization'))}
          {lifecycleChip('realized', t('results.lifecycle.realized', 'Realized'))}
          <button
            type="button"
            onClick={() => setActiveTab('results_kpi')}
            className={`${chipBase} bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50`}
          >
            <Target size={14} className="text-emerald-400" />
            <span>{t('results.tabs.kpi', 'KPI')}</span>
          </button>
          {governedRuntimeStrip}
        </div>
      );
    }

    if (activeTab === 'results_kpi') {
      const base = (() => {
        let items = [...lifecycleScopedKpis];
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
        return items;
      })();

      const counts = base.reduce(
        (acc, k) => {
          acc.total += 1;
          if (k.needsEntry) acc.needsEntry += 1;
          acc.status[String(k.status)] = (acc.status[String(k.status)] || 0) + 1;
          return acc;
        },
        {
          total: 0,
          needsEntry: 0,
          status: {} as Record<string, number>,
        }
      );

      const setFilter = (col: string, value: string, label: string) => {
        setActiveFilters([{ id: `${col}:${value}`, column: col, value, label }]);
      };

      return (
        <div className="flex items-center gap-2 overflow-x-auto">
          {lifecycleChip('all', t('common.all', 'All'))}
          {lifecycleChip('in-realization', t('results.lifecycle.inRealization', 'In realization'))}
          {lifecycleChip('realized', t('results.lifecycle.realized', 'Realized'))}
          <button
            type="button"
            onClick={() => setActiveFilters([])}
            className={`${chipBase} ${
              activeFilters.length === 0
                ? 'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50'
            }`}
            title={t('common.all', 'All')}
          >
            <span>{t('common.all', 'All')}</span>
            <span
              className={`${badgeBase} ${
                activeFilters.length === 0
                  ? 'bg-purple-500/30 text-purple-700 dark:text-purple-200'
                  : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {counts.total}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setObservationPhaseFilter('all')}
            className={`${chipBase} ${
              observationPhaseFilter === 'all'
                ? 'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50'
            }`}
          >
            <span>{t('common.phase', 'Phase')}: {t('common.all', 'All')}</span>
          </button>
          <button
            type="button"
            onClick={() => setObservationPhaseFilter('realization')}
            className={`${chipBase} ${
              observationPhaseFilter === 'realization'
                ? 'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50'
            }`}
          >
            <span>{t('results.phase.realization', 'Realization')}</span>
          </button>
          <button
            type="button"
            onClick={() => setObservationPhaseFilter('post-implementation')}
            className={`${chipBase} ${
              observationPhaseFilter === 'post-implementation'
                ? 'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50'
            }`}
          >
            <span>{t('results.phase.postImplementation', 'Post-implementation')}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setFilter('needsEntry', 'true', t('results.filters.needsEntry', 'Needs entry'))
            }
            className={`${chipBase} ${
              activeFilters.some((f) => f.column === 'needsEntry' && f.value === 'true')
                ? 'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50'
            }`}
            title={t('results.filters.needsEntry', 'Needs entry')}
          >
            <span>{t('results.filters.needsEntry', 'Needs entry')}</span>
            <span
              className={`${badgeBase} ${
                activeFilters.some((f) => f.column === 'needsEntry' && f.value === 'true')
                  ? 'bg-purple-500/30 text-purple-700 dark:text-purple-200'
                  : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {counts.needsEntry}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilter('status', 'below', t('results.filters.below', 'Below'))}
            className={`${chipBase} ${
              activeFilters.some((f) => f.column === 'status' && f.value === 'below')
                ? 'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50'
            }`}
            title={t('results.filters.below', 'Below')}
          >
            <span>{t('results.filters.below', 'Below')}</span>
            <span
              className={`${badgeBase} ${
                activeFilters.some((f) => f.column === 'status' && f.value === 'below')
                  ? 'bg-purple-500/30 text-purple-700 dark:text-purple-200'
                  : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {counts.status['below'] || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setFilter('status', 'on-target', t('results.filters.onTarget', 'On target'))
            }
            className={`${chipBase} ${
              activeFilters.some((f) => f.column === 'status' && f.value === 'on-target')
                ? 'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50'
            }`}
            title={t('results.filters.onTarget', 'On target')}
          >
            <span>{t('results.filters.onTarget', 'On target')}</span>
            <span
              className={`${badgeBase} ${
                activeFilters.some((f) => f.column === 'status' && f.value === 'on-target')
                  ? 'bg-purple-500/30 text-purple-700 dark:text-purple-200'
                  : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {counts.status['on-target'] || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilter('status', 'no-data', t('results.filters.noData', 'No data'))}
            className={`${chipBase} ${
              activeFilters.some((f) => f.column === 'status' && f.value === 'no-data')
                ? 'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50'
            }`}
            title={t('results.filters.noData', 'No data')}
          >
            <span>{t('results.filters.noData', 'No data')}</span>
            <span
              className={`${badgeBase} ${
                activeFilters.some((f) => f.column === 'status' && f.value === 'no-data')
                  ? 'bg-purple-500/30 text-purple-700 dark:text-purple-200'
                  : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {counts.status['no-data'] || 0}
            </span>
          </button>
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
          {lifecycleChip('all', t('common.all', 'All'))}
          {lifecycleChip('in-realization', t('results.lifecycle.inRealization', 'In realization'))}
          {lifecycleChip('realized', t('results.lifecycle.realized', 'Realized'))}
          <button
            type="button"
            onClick={() => setKpiReportCreateNonce(Date.now())}
            className={`${chipBase} bg-primary-500/15 text-primary-300 border-primary-500/30 hover:bg-primary-500/20`}
            title={t('results.kpiReports.new', '+ New report')}
          >
            <Plus size={14} />
            <span>{t('results.kpiReports.new', '+ New report')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('results_kpi')}
            className={`${chipBase} bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50`}
          >
            <Target size={14} className="text-amber-400" />
            <span>{t('results.kpiReports.reviewQueue', 'Review KPI set')}</span>
          </button>
          {governedRuntimeStrip}
        </div>
      );
    }

    return governedRuntimeStrip ? (
      <div className="flex items-center gap-2 overflow-x-auto">{governedRuntimeStrip}</div>
    ) : null;
  }, [
    activeFilters,
    activeTab,
    governedRuntimeStrip,
    kpis,
    lifecycleFilter,
    lifecycleScopedKpis,
    observationPhaseFilter,
    openRoiPicker,
    searchQuery,
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
          activeTab === 'results_kpi'
            ? () => setShowCreateModal(true)
            : activeTab === 'roi'
                ? () => setRoiOpenModal(true)
                : undefined
        }
        newItemLabel={
          activeTab === 'results_kpi'
            ? t('results.addKpi', '+ Add KPI')
            : activeTab === 'roi'
                ? t('results.roi.add', '+ Record ROI')
                : undefined
        }
        availableViewModes={activeTab === 'results_kpi' ? ['table', 'grid'] : ['table']}
        commandRowContent={commandRowContent}
      >
        {activeTab === 'results_initiatives' ? (
          <ResultsInitiativesView
            initiatives={filteredInitiatives}
            onOpenInitiativeKpis={() => setActiveTab('results_kpi')}
          />
        ) : activeTab === 'roi_analysis' ? (
          <ROIAnalysisView />
        ) : activeTab === 'results_reports' ? (
          <ResultsKpiReportsView
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            createNonce={kpiReportCreateNonce}
            selectedLifecycleFilter={lifecycleFilter}
            selectedInitiatives={filteredInitiatives}
            selectedKpis={filteredKpis}
          />
        ) : activeTab === 'roi' ? (
          <ROITrackingView refreshNonce={roiRefreshNonce} />
        ) : loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex items-center gap-3 text-slate-400">
              <BarChart3 size={20} className="animate-pulse" />
              <span className="text-sm">{t('common.loading', 'Loading...')}</span>
            </div>
          </div>
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
