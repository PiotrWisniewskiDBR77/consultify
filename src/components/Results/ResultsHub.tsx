import { BarChart3, BrainCircuit, DollarSign, FileText, Layers, ListChecks, Plus, Target } from 'lucide-react';
import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ROUTES } from '@/routes/routeConfig';
import { Api } from '@/services/api';
import {
  shouldFallbackToLegacyResults,
  V8ResultsApi,
  type V8ResultsDashboardSnapshot,
} from '@/services/api/v8/results';
import { updateInitiativeStatusWriteTruth } from '@/services/initiativeWriteTruth';
import { useAppStore } from '@/store/useAppStore';
import { mapHubLoadFailureToPresentation } from '@/utils/errors/mapHubLoadFailureToPresentation';

import { Banner } from '../shared/Banner';
import { HubWorkAreaLoadError } from '../shared/ModuleHub';
import { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import { ModuleHub } from '../shared/ModuleHub/ModuleHub';
import { ModuleTab, type OpenDocument, TabConfig, ViewMode } from '../shared/ModuleHub/types';
import { useModuleOpenDocuments } from '../shared/ModuleHub/useModuleOpenDocuments';
import {
  MENU_3_ACTION_NEUTRAL,
  MENU_3_BADGE_INACTIVE,
  MENU_3_CHIP_ACTIVE,
  MENU_3_CHIP_INACTIVE,
  MENU_3_LEFT_CLASS,
  MENU_3_RIGHT_CLASS,
} from '../shared/ModuleMenu3';
import { KPICreateModal } from './KPICreateModal';
import {
  filterKpisByLifecycle,
  filterKpisByObservationPhase,
  filterTrackedInitiatives,
  type KpiDrawerSection,
  type ResultsKPI,
  type ResultsLifecycleFilter,
  type ResultsTrackedInitiative,
} from './kpiDomain';
import { KpiOverviewView } from './KpiOverviewView';
import { KpiQueueView } from './KpiQueueView';
import { loadResultsKpis } from './kpiRuntime';
import type { SignalSheetRecord } from './kpiSignalSheetTypes';
import { KpiSignalSheetView } from './KpiSignalSheetView';
import { KPITimeSeriesDrawer } from './KPITimeSeriesDrawer';
import { ResultsInitiativesView } from './ResultsInitiativesView';
import M14HandoffInbox from './M14HandoffInbox';
import TransformationScorecard from './TransformationScorecard';
import ValueDriverTree from './ValueDriverTree';
import StrategicLayerPanel from './StrategicLayerPanel';
import AIInsightsPanel from './AIInsightsPanel';
import PortfolioInsightsPanel from './PortfolioInsightsPanel';
import { isResultsFlagEnabled } from './resultsFeatureFlags';
import { ResultsKpiReportsView } from './ResultsKpiReportsView';
import { ResultsKpiScorecardsView } from './ResultsKpiScorecardsView';
import { ResultsKpisTableV3 } from './ResultsKpisTableV3';
import { ResultsGridView } from './ResultsKPITable';
import {
  ResultsKpiConnectorsView,
  ResultsReportSchedulesView,
  ResultsWallboardsView,
} from './ResultsReportingEnterpriseViews';
import { createResultsShowcaseSnapshot } from './resultsShowcaseData';
import { ROIAnalysisView } from './ROIAnalysisView';
import { ROIDetailDrawer } from './ROIDetailDrawer';
import { ROIOpenModal } from './ROIOpenModal';
import { ROITrackingView } from './ROITrackingView';

const ResultsInitiativeDocumentView = React.lazy(async () => {
  const module = await import('../Initiatives/InitiativeDocumentView');
  return { default: module.InitiativeDocumentView };
});

const WATCHED_RESULTS_KPI_STORAGE_KEY = 'results.kpi.watched';

interface ResultsRuntimeChipProps {
  label: string;
  value: string;
  dotClassName: string;
}

const ResultsRuntimeChip: React.FC<ResultsRuntimeChipProps> = ({ label, value, dotClassName }) => (
  <div className={MENU_3_CHIP_INACTIVE}>
    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${dotClassName}`} />
    <span>{label}</span>
    <span className={MENU_3_BADGE_INACTIVE}>{value}</span>
  </div>
);

interface ResultsInfoChipProps {
  label: string;
  value: string | number;
  dotClassName?: string;
}

const ResultsInfoChip: React.FC<ResultsInfoChipProps> = ({
  label,
  value,
  dotClassName = 'bg-slate-400',
}) => (
  <div className={MENU_3_CHIP_INACTIVE}>
    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${dotClassName}`} />
    <span>{label}</span>
    <span className={MENU_3_BADGE_INACTIVE}>{value}</span>
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
      className="h-9 rounded-full border border-c-border bg-c-surface px-3 pr-8 text-sm text-c-text-secondary focus:outline-none focus:ring-2 focus:ring-c-focus"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

const VALID_TABS: ModuleTab[] = [
  'results_initiatives' as ModuleTab,
  'results_kpi' as ModuleTab,
  'results_reports' as ModuleTab,
  'roi' as ModuleTab,
  'roi_analysis' as ModuleTab,
  'results_strategic' as ModuleTab,
  'results_ai' as ModuleTab,
];
const VALID_KPI_MODES = ['overview', 'queue', 'catalog', 'scorecards'] as const;
const VALID_REPORT_MODES = ['tracked', 'reports', 'schedules', 'wallboards', 'connectors'] as const;

export const ResultsHub: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const [searchParams, setSearchParams] = useSearchParams();
  const scopedInitiativeId = String(searchParams.get('initiativeId') || '').trim() || undefined;

  const [activeTab, setActiveTabRaw] = useState<ModuleTab>(
    (VALID_TABS.includes(searchParams.get('tab') as ModuleTab)
      ? searchParams.get('tab')!
      : 'results_initiatives') as ModuleTab
  );
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [lifecycleFilter, setLifecycleFilter] = useState<ResultsLifecycleFilter>('all');
  const [observationPhaseFilter, setObservationPhaseFilter] = useState<
    'all' | 'realization' | 'post-implementation'
  >('all');
  const [initiativeStageFilter, setInitiativeStageFilter] = useState<string>('all');
  const [initiativeHealthFilter, setInitiativeHealthFilter] = useState<
    'all' | 'on-track' | 'at-risk'
  >('all');
  const [initiativeKpiLinkFilter, setInitiativeKpiLinkFilter] = useState<
    'all' | 'attached' | 'unattached'
  >('all');
  const [kpiWorkspaceMode, setKpiWorkspaceModeRaw] = useState<
    'overview' | 'queue' | 'catalog' | 'scorecards'
  >(
    (VALID_KPI_MODES as readonly string[]).includes(searchParams.get('mode') || '')
      ? (searchParams.get('mode') as 'overview' | 'queue' | 'catalog' | 'scorecards')
      : 'catalog'
  );
  const [reportWorkspaceMode, setReportWorkspaceModeRaw] = useState<
    'tracked' | 'reports' | 'schedules' | 'wallboards' | 'connectors'
  >(
    (VALID_REPORT_MODES as readonly string[]).includes(searchParams.get('rmode') || '')
      ? (searchParams.get('rmode') as
          | 'tracked'
          | 'reports'
          | 'schedules'
          | 'wallboards'
          | 'connectors')
      : 'tracked'
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [kpiReportCreateNonce, setKpiReportCreateNonce] = useState(0);
  const [kpiScorecardCreateNonce, setKpiScorecardCreateNonce] = useState(0);
  const [reportWorkspaceCreateNonce, setReportWorkspaceCreateNonce] = useState(0);
  const [signalSheetCreateNonce, setSignalSheetCreateNonce] = useState(0);
  const [drawerState, setDrawerState] = useState<{
    kpiId: string;
    section?: KpiDrawerSection;
  } | null>(null);
  const [activeSignalSheet, setActiveSignalSheet] = useState<SignalSheetRecord | null>(null);
  const [manualSignalSheets, setManualSignalSheets] = useState<SignalSheetRecord[]>([]);
  const [roiOpenModal, setRoiOpenModal] = useState(false);
  const [roiDrawer, setRoiDrawer] = useState<{ id: string; name: string } | null>(null);
  const [roiRefreshNonce, setRoiRefreshNonce] = useState(0);

  const [kpis, setKpis] = useState<ResultsKPI[]>([]);
  const [trackedInitiatives, setTrackedInitiatives] = useState<ResultsTrackedInitiative[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpiLoadError, setKpiLoadError] = useState<string | null>(null);
  const [kpiLoadErrorCode, setKpiLoadErrorCode] = useState<string | null>(null);
  const [v8Snapshot, setV8Snapshot] = useState<V8ResultsDashboardSnapshot | null>(null);
  const [resultsSource, setResultsSource] = useState<'v8' | 'legacy' | 'empty' | 'showcase'>(
    'empty'
  );
  const [watchedKpiIds, setWatchedKpiIds] = useState<Set<string>>(new Set());
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  const { openDocuments, setOpenDocuments, activeDocumentId, setActiveDocumentId } =
    useModuleOpenDocuments('results');
  const currentUserDisplayName = useMemo(
    () =>
      [(currentUser as any)?.firstName, (currentUser as any)?.lastName]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      (currentUser as any)?.name ||
      '',
    [currentUser]
  );

  const setActiveTab = useCallback(
    (tab: ModuleTab) => {
      setActiveTabRaw(tab);
      const next = new URLSearchParams(searchParams);
      next.set('tab', tab);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const setKpiWorkspaceMode = useCallback(
    (mode: 'overview' | 'queue' | 'catalog' | 'scorecards') => {
      setKpiWorkspaceModeRaw(mode);
      const next = new URLSearchParams(searchParams);
      next.set('mode', mode);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const setReportWorkspaceMode = useCallback(
    (mode: 'tracked' | 'reports' | 'schedules' | 'wallboards' | 'connectors') => {
      setReportWorkspaceModeRaw(mode);
      const next = new URLSearchParams(searchParams);
      next.set('rmode', mode);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    const tab = searchParams.get('tab') as ModuleTab | null;
    if (tab && VALID_TABS.includes(tab) && tab !== activeTab) {
      setActiveTabRaw(tab);
    }
    const mode = searchParams.get('mode') as typeof kpiWorkspaceMode | null;
    if (
      mode &&
      (VALID_KPI_MODES as readonly string[]).includes(mode) &&
      mode !== kpiWorkspaceMode
    ) {
      setKpiWorkspaceModeRaw(mode);
    }
    const rmode = searchParams.get('rmode') as typeof reportWorkspaceMode | null;
    if (
      rmode &&
      (VALID_REPORT_MODES as readonly string[]).includes(rmode) &&
      rmode !== reportWorkspaceMode
    ) {
      setReportWorkspaceModeRaw(rmode);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (deepLinkHandled) return;
    const openId = String(searchParams.get('open') || '').trim();
    const mode = String(searchParams.get('mode') || '')
      .trim()
      .toLowerCase();
    if (!openId || (mode !== 'initiative' && mode !== 'doc')) return;

    setActiveTabRaw('results_initiatives');
    setActiveDocumentId(openId);
    setDeepLinkHandled(true);
  }, [deepLinkHandled, searchParams, setActiveDocumentId]);

  useEffect(() => {
    if (!deepLinkHandled) return;
    const next = new URLSearchParams(searchParams);
    let changed = false;
    if (next.has('open')) {
      next.delete('open');
      changed = true;
    }
    if (next.has('mode')) {
      next.delete('mode');
      changed = true;
    }
    if (changed) setSearchParams(next, { replace: true });
  }, [deepLinkHandled, searchParams, setSearchParams]);

  const fetchKPIs = useCallback(async () => {
    setLoading(true);
    setKpiLoadError(null);
    setKpiLoadErrorCode(null);
    try {
      const result = await loadResultsKpis();
      setTrackedInitiatives(result.initiatives);
      setKpis(result.kpis);
      setResultsSource(result.source);
    } catch (error: any) {
      const { message, code } = mapHubLoadFailureToPresentation(
        error,
        'Failed to load KPI catalog.'
      );
      setKpiLoadError(message);
      setKpiLoadErrorCode(code);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadV8Snapshot = useCallback(async () => {
    try {
      const response = await V8ResultsApi.getDashboard({ initiativeId: scopedInitiativeId });
      setV8Snapshot(response.snapshot);
    } catch {
      setV8Snapshot(null);
    }
  }, [scopedInitiativeId]);

  useEffect(() => {
    fetchKPIs();
  }, [fetchKPIs]);

  useEffect(() => {
    void loadV8Snapshot();
  }, [loadV8Snapshot]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(WATCHED_RESULTS_KPI_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setWatchedKpiIds(new Set(parsed.filter((id) => typeof id === 'string')));
      }
    } catch {
      // ignore storage read failures
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        WATCHED_RESULTS_KPI_STORAGE_KEY,
        JSON.stringify(Array.from(watchedKpiIds))
      );
    } catch {
      // ignore storage write failures
    }
  }, [watchedKpiIds]);

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
      ...(isResultsFlagEnabled('strategicLayer') ? [{
        id: 'results_strategic' as ModuleTab,
        label: t('results.tabs.strategic', 'Strategic'),
        icon: <Layers size={16} />,
      }] : []),
      ...(isResultsFlagEnabled('aiInsights') || isResultsFlagEnabled('portfolioInsights') ? [{
        id: 'results_ai' as ModuleTab,
        label: t('results.tabs.ai', 'AI + Portfolio'),
        icon: <BrainCircuit size={16} />,
      }] : []),
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
          if (col === 'watched') {
            return vals.some((value) => value === 'true' && watchedKpiIds.has(k.id));
          }
          if (col === 'ownerScope') {
            return vals.some((value) => {
              if (value === 'me') {
                return (
                  Boolean(currentUserDisplayName) &&
                  String(k.ownerName || '').trim() === currentUserDisplayName
                );
              }
              if (value === 'unassigned') {
                return !String(k.ownerName || '').trim();
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
  }, [
    lifecycleScopedKpis,
    observationPhaseFilter,
    searchQuery,
    activeFilters,
    currentUserDisplayName,
    watchedKpiIds,
  ]);

  const filteredInitiatives = useMemo(() => {
    let items = [...trackedInitiatives];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (initiative) =>
          initiative.initiativeName.toLowerCase().includes(q) ||
          initiative.initiativeStatus.toLowerCase().includes(q)
      );
    }

    if (initiativeStageFilter !== 'all') {
      items = items.filter(
        (initiative) =>
          String(initiative.initiativeStatus || '').toUpperCase() === initiativeStageFilter
      );
    }

    if (initiativeHealthFilter !== 'all') {
      items = items.filter((initiative) => {
        const atRisk =
          Number(initiative.belowTargetCount || 0) > 0 ||
          Number(initiative.openDeviationCount || 0) > 0 ||
          Number(initiative.needsEntryCount || 0) > 0;
        return initiativeHealthFilter === 'at-risk' ? atRisk : !atRisk;
      });
    }

    if (initiativeKpiLinkFilter !== 'all') {
      items = items.filter((initiative) =>
        initiativeKpiLinkFilter === 'attached'
          ? Number(initiative.trackedKpiCount || 0) > 0
          : Number(initiative.trackedKpiCount || 0) === 0
      );
    }

    return items;
  }, [
    trackedInitiatives,
    searchQuery,
    initiativeStageFilter,
    initiativeHealthFilter,
    initiativeKpiLinkFilter,
  ]);

  const activeSignalFilter = useMemo(() => {
    const needsEntryFilter = activeFilters.find((filter) => filter.column === 'needsEntry');
    if (needsEntryFilter?.value === 'true') return 'needs-entry';

    const statusFilter = activeFilters.find((filter) => filter.column === 'status');
    if (statusFilter?.value) return statusFilter.value;

    const queueFilter = activeFilters.find((filter) => filter.column === 'queue');
    if (queueFilter?.value) return queueFilter.value;

    return 'all';
  }, [activeFilters]);

  const activeOwnerFilter = useMemo(() => {
    const ownerScope = activeFilters.find((filter) => filter.column === 'ownerScope');
    if (ownerScope?.value) return ownerScope.value;
    const ownerName = activeFilters.find((filter) => filter.column === 'ownerName');
    if (ownerName?.value) return ownerName.value;
    return 'all';
  }, [activeFilters]);

  const watchedOnly = useMemo(
    () => activeFilters.some((filter) => filter.column === 'watched' && filter.value === 'true'),
    [activeFilters]
  );
  const myKpiOnly = activeOwnerFilter === 'me';
  const unassignedOwnerOnly = activeOwnerFilter === 'unassigned';

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

  const applyOwnerFilter = useCallback(
    (value: string) => {
      if (value === 'all') {
        replaceResultsFilters(null, ['ownerName', 'ownerScope']);
        return;
      }
      if (value === '__me__') {
        replaceResultsFilters(
          {
            id: 'ownerScope:me',
            column: 'ownerScope',
            value: 'me',
            label: t('results.filters.ownerMine', 'Owner: My KPI'),
          },
          ['ownerName', 'ownerScope']
        );
        return;
      }
      if (value === '__unassigned__') {
        replaceResultsFilters(
          {
            id: 'ownerScope:unassigned',
            column: 'ownerScope',
            value: 'unassigned',
            label: t('results.filters.ownerUnassigned', 'Owner: Unassigned'),
          },
          ['ownerName', 'ownerScope']
        );
        return;
      }
      replaceResultsFilters(
        {
          id: `ownerName:${value}`,
          column: 'ownerName',
          value,
          label: `${t('common.owner', 'Owner')}: ${value}`,
        },
        ['ownerName', 'ownerScope']
      );
    },
    [replaceResultsFilters, t]
  );

  const toggleWatchedFilter = useCallback(() => {
    replaceResultsFilters(
      watchedOnly
        ? null
        : {
            id: 'watched:true',
            column: 'watched',
            value: 'true',
            label: t('results.filters.watched', 'Watched KPI'),
          },
      ['watched']
    );
  }, [replaceResultsFilters, t, watchedOnly]);

  const toggleMyKpiView = useCallback(() => {
    applyOwnerFilter(myKpiOnly ? 'all' : '__me__');
  }, [applyOwnerFilter, myKpiOnly]);

  const toggleUnassignedOwnerView = useCallback(() => {
    applyOwnerFilter(unassignedOwnerOnly ? 'all' : '__unassigned__');
  }, [applyOwnerFilter, unassignedOwnerOnly]);

  const toggleWatchKpi = useCallback((kpiId: string) => {
    setWatchedKpiIds((prev) => {
      const next = new Set(prev);
      if (next.has(kpiId)) next.delete(kpiId);
      else next.add(kpiId);
      return next;
    });
  }, []);

  useEffect(() => {
    const initiativeId = String(searchParams.get('initiativeId') || '').trim();
    if (!initiativeId || activeTab !== 'results_reports') return;
    const targetInitiative = trackedInitiatives.find((item) => item.initiativeId === initiativeId);
    if (!targetInitiative) return;
    replaceResultsFilters(
      {
        id: `initiativeName:${targetInitiative.initiativeName}`,
        column: 'initiativeName',
        value: targetInitiative.initiativeName,
        label: targetInitiative.initiativeName,
      },
      ['initiativeName']
    );
  }, [activeTab, replaceResultsFilters, searchParams, trackedInitiatives]);

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

  const openInitiativeReportsLane = useCallback(
    (initiative?: ResultsTrackedInitiative) => {
      setActiveTab('results_reports');
      setReportWorkspaceMode('reports');
      if (initiative?.initiativeId) {
        const next = new URLSearchParams(searchParams);
        next.set('initiativeId', initiative.initiativeId);
        setSearchParams(next, { replace: true });
      }
    },
    [searchParams, setSearchParams, setActiveTab, setReportWorkspaceMode]
  );

  const openScopedExecutionLane = useCallback(() => {
    if (!scopedInitiativeId) return;
    const query = new URLSearchParams();
    query.set('initiativeId', scopedInitiativeId);
    query.set('open', scopedInitiativeId);
    query.set('mode', 'doc');
    query.set('tab', 'list');
    query.set('view', 'table');
    navigate(`${ROUTES.IMPLEMENTATION}?${query.toString()}`);
  }, [navigate, scopedInitiativeId]);

  const openInitiativeDocument = useCallback(
    (initiative: ResultsTrackedInitiative) => {
      const existing = openDocuments.find(
        (document) => document.id === initiative.initiativeId && document.type === 'initiative'
      );
      if (!existing) {
        const newDoc: OpenDocument = {
          id: initiative.initiativeId,
          name: initiative.initiativeName,
          type: 'initiative',
          subType: 'results',
          status: String(initiative.initiativeStatus || 'DRAFT').toUpperCase() as any,
        };
        setOpenDocuments((prev) => [...prev, newDoc]);
      }
      setActiveDocumentId(initiative.initiativeId);
    },
    [openDocuments, setActiveDocumentId, setOpenDocuments]
  );

  const handleInitiativeStatusChange = useCallback(
    async (initiative: ResultsTrackedInitiative, newStatus: string) => {
      const currentStatus = String(initiative.initiativeStatus || '').toUpperCase();
      const targetStatus = String(newStatus || '').toUpperCase();
      if (!initiative.initiativeId || !targetStatus || currentStatus === targetStatus) return;

      try {
        await updateInitiativeStatusWriteTruth(initiative.initiativeId, targetStatus);
        setTrackedInitiatives((prev) =>
          prev.map((item) =>
            item.initiativeId === initiative.initiativeId
              ? { ...item, initiativeStatus: targetStatus }
              : item
          )
        );
        setOpenDocuments((prev) =>
          prev.map((document) =>
            document.id === initiative.initiativeId
              ? { ...document, status: targetStatus as any }
              : document
          )
        );
        toast.success(t('initiatives.toast.statusUpdated', 'Status zaktualizowany'));
        await refreshResultsTruth({ refreshRoi: false });
      } catch (error: any) {
        toast.error(
          error?.response?.data?.error ||
            t('initiatives.toast.statusUpdateFailed', 'Nie udało się zaktualizować statusu')
        );
      }
    },
    [refreshResultsTruth, t]
  );

  const handleShowList = useCallback(() => {
    setActiveDocumentId(null);
  }, [setActiveDocumentId]);

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

  const handleCreateSignalSheet = useCallback((sheet: SignalSheetRecord) => {
    setManualSignalSheets((prev) => [sheet, ...prev]);
  }, []);

  const openRoiPicker = useCallback(() => setRoiOpenModal(true), []);
  const openReportingWorkspace = useCallback(() => {
    setActiveTab('results_reports');
    setReportWorkspaceMode('tracked');
  }, []);
  const openFirstFilteredKpiRecord = useCallback(() => {
    const target = filteredKpis[0] ?? lifecycleScopedKpis[0];
    if (!target?.id) return;
    setKpiWorkspaceMode('catalog');
    setViewMode('table');
    openKpiDrawer(target.id, 'record');
  }, [filteredKpis, lifecycleScopedKpis, openKpiDrawer]);

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
        {resultsSource === 'legacy' && (
          <ResultsRuntimeChip
            label={t('results.runtime.legacy', 'Legacy data')}
            value={t('results.runtime.fallback', 'fallback')}
            dotClassName="bg-amber-400"
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
          dotClassName="bg-emerald-400"
        />
        <ResultsRuntimeChip
          label={t('results.runtime.reconciliation', 'Reconciliation')}
          value={String(runtimeSnapshot.reconciliationHealth.unresolvedCount || 0)}
          dotClassName="bg-blue-400"
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

    if (activeTab === 'results_initiatives') {
      const stageOptions = [
        { value: 'all', label: t('results.filters.stageAll', 'Stage: All') },
        ...Array.from(
          new Set(
            trackedInitiatives
              .map((initiative) => String(initiative.initiativeStatus || '').toUpperCase())
              .filter(Boolean)
          )
        ).map((status) => ({ value: status, label: status })),
      ];

      return (
        <div className="flex items-center gap-2">
          <ResultsControlSelect
            ariaLabel={t('results.filters.stage', 'Initiative stage filter')}
            value={initiativeStageFilter}
            onChange={setInitiativeStageFilter}
            options={stageOptions}
          />
          <ResultsControlSelect
            ariaLabel={t('results.filters.health', 'Health filter')}
            value={initiativeHealthFilter}
            onChange={(value) => setInitiativeHealthFilter(value as 'all' | 'on-track' | 'at-risk')}
            options={[
              { value: 'all', label: t('results.filters.healthAll', 'Health: All') },
              { value: 'on-track', label: t('results.filters.healthOnTrack', 'Health: On track') },
              { value: 'at-risk', label: t('results.filters.healthAtRisk', 'Health: At risk') },
            ]}
          />
          <ResultsControlSelect
            ariaLabel={t('results.filters.kpiLink', 'KPI link filter')}
            value={initiativeKpiLinkFilter}
            onChange={(value) =>
              setInitiativeKpiLinkFilter(value as 'all' | 'attached' | 'unattached')
            }
            options={[
              { value: 'all', label: t('results.filters.kpiLinkAll', 'KPI link: All') },
              { value: 'attached', label: t('results.filters.kpiAttached', 'KPI attached') },
              { value: 'unattached', label: t('results.filters.kpiUnattached', 'No KPI attached') },
            ]}
          />
        </div>
      );
    }

    if (
      activeTab === 'results_kpi' ||
      (activeTab === 'results_reports' && reportWorkspaceMode === 'tracked')
    ) {
      const ownerOptions = [
        { value: 'all', label: t('results.filters.ownerAll', 'Owner: All') },
        { value: '__me__', label: t('results.filters.ownerMine', 'Owner: My KPI') },
        {
          value: '__unassigned__',
          label: t('results.filters.ownerUnassigned', 'Owner: Unassigned'),
        },
        ...Array.from(
          new Set(
            lifecycleScopedKpis
              .map((kpi) => String(kpi.ownerName || '').trim())
              .filter(Boolean)
              .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
          )
        ).map((owner) => ({ value: owner, label: owner })),
      ];

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
            ariaLabel={t('results.filters.signal', 'Signal filter')}
            value={activeSignalFilter}
            onChange={applySignalFilter}
            options={[
              { value: 'all', label: t('results.filters.signalAll', 'Signal: All') },
              {
                value: 'needs-entry',
                label: t('results.filters.signalNeedsEntry', 'Signal: Needs entry'),
              },
              { value: 'below', label: t('results.filters.signalBelow', 'Signal: Below target') },
              {
                value: 'on-target',
                label: t('results.filters.signalOnTarget', 'Signal: On target'),
              },
              { value: 'no-data', label: t('results.filters.signalNoData', 'Signal: No data') },
              {
                value: 'discrepancy',
                label: t('results.filters.signalDiscrepancy', 'Signal: Discrepancy'),
              },
              {
                value: 'requires-review',
                label: t('results.filters.signalRequiresReview', 'Signal: Requires review'),
              },
            ]}
          />
          <ResultsControlSelect
            ariaLabel={t('results.filters.owner', 'Owner filter')}
            value={activeOwnerFilter}
            onChange={applyOwnerFilter}
            options={ownerOptions}
          />
        </div>
      );
    }

    if (activeTab === 'results_reports') {
      return (
        <ResultsControlSelect
          ariaLabel={t('results.filters.lifecycle', 'Lifecycle filter')}
          value={lifecycleFilter}
          onChange={(value) => setLifecycleFilter(value as ResultsLifecycleFilter)}
          options={lifecycleOptions}
        />
      );
    }

    return null;
  }, [
    activeSignalFilter,
    activeTab,
    applySignalFilter,
    initiativeHealthFilter,
    initiativeKpiLinkFilter,
    initiativeStageFilter,
    kpiWorkspaceMode,
    lifecycleFilter,
    observationPhaseFilter,
    scopedInitiativeId,
    t,
    trackedInitiatives,
  ]);

  // commandRowRightContent — canonical right slot (§3.4 MUST).
  // NOTE: ModuleNavBar intentionally voids the `commandRowRightContent` prop (deprecated).
  // We embed these actions inside commandRowContent using the canonical
  // `flex items-center justify-between` wrapper (Finance hub SSOT pattern §3.4).
  const commandRowRightActions = useMemo(() => {
    const scopedExecutionButton = scopedInitiativeId ? (
      <button type="button" onClick={openScopedExecutionLane} className={MENU_3_ACTION_NEUTRAL}>
        <span>{t('results.actions.openInExecution', 'Open in Execution')}</span>
      </button>
    ) : null;

    if (activeTab === 'results_kpi' && kpiWorkspaceMode === 'queue') {
      return (
        <div className={MENU_3_RIGHT_CLASS}>
          {scopedExecutionButton}
          <button
            type="button"
            onClick={() => setSignalSheetCreateNonce(Date.now())}
            className={MENU_3_ACTION_NEUTRAL}
          >
            <Plus size={14} />
            <span>{t('results.kpi.signals.addSheet', 'Add sheet')}</span>
          </button>
        </div>
      );
    }

    const viewInOutputsButton =
      activeTab === 'results_reports' ? (
        <button
          type="button"
          onClick={() => navigate('/outputs')}
          className={MENU_3_ACTION_NEUTRAL}
        >
          <span>{t('results.actions.viewInOutputs', 'View in Outputs')}</span>
        </button>
      ) : null;

    if (!scopedExecutionButton && !viewInOutputsButton) return null;
    return (
      <div className={MENU_3_RIGHT_CLASS}>
        {scopedExecutionButton}
        {viewInOutputsButton}
      </div>
    );
  }, [activeTab, kpiWorkspaceMode, navigate, openScopedExecutionLane, scopedInitiativeId, t]);

  const commandRowContent = useMemo(() => {
    const actionButton = (label: string, onClick: () => void, active = false) => (
      <button
        type="button"
        onClick={onClick}
        className={active ? MENU_3_CHIP_ACTIVE : MENU_3_CHIP_INACTIVE}
      >
        {label}
      </button>
    );

    // Canonical Menu 3 layout: justify-between — presets/chips left, actions right (§3.4).
    // commandRowRightActions embedded here because ModuleNavBar's command-row path
    // voids the commandRowRightContent prop.
    const wrapWithLayout = (leftContent: React.ReactNode) =>
      commandRowRightActions ? (
        <div className="flex items-center justify-between gap-2 w-full min-w-0">
          {leftContent}
          {commandRowRightActions}
        </div>
      ) : (
        leftContent
      );

    if (activeTab === 'results_initiatives') {
      const left = governedRuntimeStrip ? (
        <div className={MENU_3_LEFT_CLASS}>{governedRuntimeStrip}</div>
      ) : null;
      return commandRowRightActions
        ? wrapWithLayout(left ?? <div className={MENU_3_LEFT_CLASS} />)
        : left;
    }

    if (activeTab === 'results_kpi') {
      return wrapWithLayout(
        <div className={MENU_3_LEFT_CLASS}>
          {actionButton(
            t('results.kpi.workspace.catalog', 'KPI List'),
            () => setKpiWorkspaceMode('catalog'),
            kpiWorkspaceMode === 'catalog'
          )}
          {actionButton(
            t('results.kpi.workspace.queue', 'Data / Signals'),
            () => setKpiWorkspaceMode('queue'),
            kpiWorkspaceMode === 'queue'
          )}
          {actionButton(
            t('results.kpi.workspace.overview', 'Overview'),
            () => setKpiWorkspaceMode('overview'),
            kpiWorkspaceMode === 'overview'
          )}
          {actionButton(
            t('results.kpi.workspace.scorecards', 'Goals'),
            () => setKpiWorkspaceMode('scorecards'),
            kpiWorkspaceMode === 'scorecards'
          )}
          {actionButton(
            t('results.actions.recordValue', 'Record value'),
            openFirstFilteredKpiRecord
          )}
        </div>
      );
    }

    if (activeTab === 'roi') {
      return wrapWithLayout(
        <div className={MENU_3_LEFT_CLASS}>
          <button
            type="button"
            onClick={openRoiPicker}
            className={MENU_3_ACTION_NEUTRAL}
            title={t('results.roi.actions.recordActual', 'Record actual')}
          >
            <Plus size={14} />
            <span>{t('results.roi.actions.recordActual', 'Record actual')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('roi_analysis')}
            className={MENU_3_CHIP_INACTIVE}
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
      return wrapWithLayout(
        <div className={MENU_3_LEFT_CLASS}>
          <button
            type="button"
            onClick={() => setActiveTab('roi')}
            className={MENU_3_CHIP_INACTIVE}
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
      return wrapWithLayout(
        <div className={MENU_3_LEFT_CLASS}>
          {actionButton(
            t('results.reporting.workspace.trackedKpis', 'Tracked KPI'),
            () => {
              setActiveFilters([]);
              setReportWorkspaceMode('tracked');
            },
            reportWorkspaceMode === 'tracked'
          )}
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

    const fallbackLeft = governedRuntimeStrip ? (
      <div className={MENU_3_LEFT_CLASS}>{governedRuntimeStrip}</div>
    ) : null;
    return commandRowRightActions
      ? wrapWithLayout(fallbackLeft ?? <div className={MENU_3_LEFT_CLASS} />)
      : fallbackLeft;
  }, [
    activeTab,
    commandRowRightActions,
    governedRuntimeStrip,
    kpiWorkspaceMode,
    openFirstFilteredKpiRecord,
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
          setActiveSignalSheet(null);
          if (tab !== 'results_kpi') {
            setKpiWorkspaceMode('catalog');
          }
          if (tab !== 'results_reports') {
            setReportWorkspaceMode('tracked');
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
          activeTab === 'results_initiatives'
            ? () => {
                setActiveTab('results_kpi');
                setKpiWorkspaceMode('catalog');
                setViewMode('table');
                setShowCreateModal(true);
              }
            : activeTab === 'results_kpi'
              ? () => setShowCreateModal(true)
              : activeTab === 'results_reports'
                ? () =>
                    reportWorkspaceMode === 'tracked'
                      ? setShowCreateModal(true)
                      : reportWorkspaceMode === 'reports'
                        ? setKpiReportCreateNonce(Date.now())
                        : setReportWorkspaceCreateNonce(Date.now())
                : activeTab === 'roi'
                  ? () => setRoiOpenModal(true)
                  : undefined
        }
        newItemLabel={
          activeTab === 'results_initiatives' || activeTab === 'results_kpi'
            ? t('results.addKpi', 'Add KPI')
            : activeTab === 'results_reports'
              ? reportWorkspaceMode === 'tracked'
                ? t('results.addKpi', 'Add KPI')
                : reportWorkspaceMode === 'reports'
                  ? t('results.kpiReports.new', 'New report')
                  : reportWorkspaceMode === 'schedules'
                    ? t('results.reporting.addSchedule', 'Add schedule')
                    : reportWorkspaceMode === 'wallboards'
                      ? t('results.reporting.addWallboard', 'Add wallboard')
                      : t('results.reporting.addConnector', 'Add connector')
              : activeTab === 'roi'
                ? t('results.roi.add', 'Record ROI')
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
        {resultsSource === 'legacy' && (
          <Banner
            className="mb-3"
            variant="degraded"
            title={t(
              'results.runtime.degraded.title',
              'Showing legacy KPI data (V8 Results runtime unavailable)'
            )}
            message={t(
              'results.runtime.degraded.message',
              'The canonical V8 Results service could not be reached, so KPIs are loaded from the deprecated /api/benefits/* paths. Some governed metrics (ROI, deviations, reconciliation) may be incomplete until the V8 runtime is restored.'
            )}
            action={{
              label: t('results.hub.retry', 'Retry'),
              onClick: () => {
                void fetchKPIs();
                void loadV8Snapshot();
              },
            }}
          />
        )}
        {activeDocumentId ? (
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-24">
                <div className="flex items-center gap-3 text-slate-600">
                  <BarChart3 size={20} className="animate-pulse" />
                  <span className="text-sm text-slate-500 dark:text-slate-300">
                    {t('common.loading', 'Loading...')}
                  </span>
                </div>
              </div>
            }
          >
            <ResultsInitiativeDocumentView
              initiativeId={activeDocumentId}
              onBack={handleShowList}
              onStatusChange={() => void refreshResultsTruth({ refreshRoi: false })}
              sourceModule="execution"
            />
          </Suspense>
        ) : activeSignalSheet ? (
          <KpiSignalSheetView
            sheet={activeSignalSheet}
            onBack={() => setActiveSignalSheet(null)}
            onRecorded={() => void refreshResultsTruth()}
            onOpenKpi={openKpiDrawer}
          />
        ) : kpiLoadError ? (
          <HubWorkAreaLoadError
            title={t('results.hub.failedToLoadKpis', 'Failed to load KPI catalog.')}
            message={kpiLoadError}
            errorCode={kpiLoadErrorCode}
            retryLabel={t('results.hub.retry', 'Retry')}
            dismissLabel={t('results.hub.dismiss', 'Dismiss')}
            onRetry={() => {
              void fetchKPIs();
            }}
            onDismiss={() => {
              setKpiLoadError(null);
              setKpiLoadErrorCode(null);
            }}
          />
        ) : activeTab === 'results_initiatives' ? (
          isResultsFlagEnabled('transformationScorecard') ||
          isResultsFlagEnabled('m14Handoff') ? (
            <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto">
              {isResultsFlagEnabled('transformationScorecard') && (
                <div className="shrink-0 px-1 pt-1">
                  <TransformationScorecard projectId="all" />
                </div>
              )}
              {isResultsFlagEnabled('m14Handoff') && (
                <div className="shrink-0 px-1">
                  <M14HandoffInbox />
                </div>
              )}
              {isResultsFlagEnabled('valueDriverTree') && (
                <div className="shrink-0 px-1">
                  <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/40 dark:bg-white/[0.02] p-4">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                      {t('results.driverTree.title', 'Value Driver Tree')}
                    </h3>
                    <ValueDriverTree projectId="all" />
                  </div>
                </div>
              )}
              <div className="min-h-0 flex-1">
                <ResultsInitiativesView
                  initiatives={filteredInitiatives}
                  onOpenInitiativeKpis={openInitiativeKpiLane}
                  onOpenInitiativeReports={openInitiativeReportsLane}
                  onOpenInitiativeDocument={openInitiativeDocument}
                  onChangeInitiativeStatus={handleInitiativeStatusChange}
                />
              </div>
            </div>
          ) : (
            <ResultsInitiativesView
              initiatives={filteredInitiatives}
              onOpenInitiativeKpis={openInitiativeKpiLane}
              onOpenInitiativeReports={openInitiativeReportsLane}
              onOpenInitiativeDocument={openInitiativeDocument}
              onChangeInitiativeStatus={handleInitiativeStatusChange}
            />
          )
        ) : activeTab === 'roi_analysis' ? (
          <ROIAnalysisView />
        ) : activeTab === 'results_strategic' ? (
          <div className="p-4 overflow-auto space-y-6">
            {isResultsFlagEnabled('strategicLayer') ? (
              <StrategicLayerPanel projectId="all" />
            ) : (
              <div className="text-sm text-slate-400 py-8 text-center">
                {t('results.strategic.disabled', 'Warstwa strategiczna wyłączona — włącz flagę ff_strategicLayer.')}
              </div>
            )}
            {isResultsFlagEnabled('valueDriverTree') && (
              <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/40 dark:bg-white/[0.02] p-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                  {t('results.driverTree.title', 'Value Driver Tree')}
                </h3>
                <ValueDriverTree projectId="all" />
              </div>
            )}
          </div>
        ) : activeTab === 'results_ai' ? (
          <div className="p-4 overflow-auto space-y-6">
            {isResultsFlagEnabled('aiInsights') && <AIInsightsPanel projectId="all" />}
            {isResultsFlagEnabled('portfolioInsights') && <PortfolioInsightsPanel projectId="all" />}
            {!isResultsFlagEnabled('aiInsights') && !isResultsFlagEnabled('portfolioInsights') && (
              <div className="text-sm text-slate-400 py-8 text-center">
                {t('results.ai.disabled', 'Panel AI/Portfolio wyłączony — włącz ff_aiInsights lub ff_portfolioInsights.')}
              </div>
            )}
          </div>
        ) : activeTab === 'results_reports' ? (
          reportWorkspaceMode === 'tracked' ? (
            <ResultsKpisTableV3
              kpis={filteredKpis}
              activeFilters={activeFilters}
              onFilterChange={setActiveFilters}
              onOpenKpi={openKpiDrawer}
              onDeleteKpi={handleDeleteKpi}
              watchedKpiIds={watchedKpiIds}
              onToggleWatch={toggleWatchKpi}
            />
          ) : reportWorkspaceMode === 'reports' ? (
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
            <div className="flex items-center gap-3 text-slate-600">
              <BarChart3 size={20} className="animate-pulse" />
              <span className="text-sm text-slate-500 dark:text-slate-300">
                {t('common.loading', 'Loading...')}
              </span>
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
            onOpenReports={() => {
              setActiveTab('results_reports');
              setReportWorkspaceMode('tracked');
            }}
            onOpenKpi={(kpiId) => openKpiDrawer(kpiId, 'summary')}
          />
        ) : activeTab === 'results_kpi' && kpiWorkspaceMode === 'queue' ? (
          <KpiQueueView
            kpis={filteredKpis}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            onOpenKpi={openKpiDrawer}
            onOpenSheet={setActiveSignalSheet}
            createNonce={signalSheetCreateNonce}
            manualSheets={manualSignalSheets}
            onCreateSheet={handleCreateSignalSheet}
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
            watchedKpiIds={watchedKpiIds}
            onToggleWatch={toggleWatchKpi}
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
