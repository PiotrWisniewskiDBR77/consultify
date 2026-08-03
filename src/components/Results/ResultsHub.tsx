import {
  BarChart3,
  Bell,
  BellOff,
  Copy,
  DollarSign,
  FileText,
  Inbox,
  Layers,
  Pencil,
  Plus,
  Target,
  Trash2,
} from 'lucide-react';
import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { LoadingState as SharedLoadingState } from '@/components/shared/states';
import {
  type MetaPill,
  StandardPreview,
  type StandardPreviewActions,
  standardPreviewShortcuts,
  type StandardRowMenu,
  StandardTable,
  type TableColumn as StandardTableColumn,
} from '@/components/standard';
import { AssigneeCell } from '@/components/ui/primitives/cells';
import { StatusChip, type StatusTone } from '@/components/ui/primitives/chips';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
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
import { ModuleTab, type OpenDocument, TabConfig, ViewMode } from '../shared/ModuleHub/types';
import { useModuleOpenDocuments } from '../shared/ModuleHub/useModuleOpenDocuments';
import {
  MENU_3_ACTION_DANGER,
  MENU_3_ACTION_NEUTRAL,
  MENU_3_BADGE_INACTIVE,
  MENU_3_CHIP_ACTIVE,
  MENU_3_CHIP_INACTIVE,
  MENU_3_LEFT_CLASS,
  MENU_3_RIGHT_CLASS,
  Menu3Chip,
} from '../shared/ModuleMenu3';
import { StandardModuleBar } from '../standard/StandardModuleBar';
import AIInsightsPanel from './AIInsightsPanel';
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
import { M14HandoffInbox } from './M14HandoffInbox';
import PortfolioInsightsPanel from './PortfolioInsightsPanel';
import { isResultsFlagEnabled } from './resultsFeatureFlags';
import { ResultsInitiativesView } from './ResultsInitiativesView';
import { ResultsKpiReportsView } from './ResultsKpiReportsView';
import { ResultsKpiScorecardsView } from './ResultsKpiScorecardsView';
import { ResultsGridView } from './ResultsKPITable';
import {
  ResultsKpiConnectorsView,
  ResultsReportSchedulesView,
  ResultsWallboardsView,
} from './ResultsReportingEnterpriseViews';
import { createResultsShowcaseSnapshot } from './resultsShowcaseData';
import {
  ResultsThreePairsView,
  type ThreePairKpi,
  type ThreePairObjective,
  type ThreePairRoi,
} from './ResultsThreePairsView';
import { ROIAnalysisView, type ROIInitiativeItem } from './ROIAnalysisView';
import { ROIDetailDrawer } from './ROIDetailDrawer';
import { ROIOpenModal } from './ROIOpenModal';
import { ROITrackingView } from './ROITrackingView';
import StrategicLayerPanel from './StrategicLayerPanel';
import TransformationScorecard from './TransformationScorecard';
import ValueDriverTree from './ValueDriverTree';

const ResultsInitiativeDocumentView = React.lazy(async () => {
  const module = await import('../Initiatives/InitiativeDocumentView');
  return { default: module.InitiativeDocumentView };
});

const WATCHED_RESULTS_KPI_STORAGE_KEY = 'results.kpi.watched';

// Triada standard (canon §4.1/§4.0): KPI domain status → semantic chip tone.
// Historically mirrored ResultsKpisTableV3's KPI_STATUS_TONE (pre-triada
// FilterableTable component, now unused — see `renderKpiStandardTable`).
// EntityStatusChip's generic TONE_BY_STATUS map does not know the
// KPI-specific statuses ('on-target' / 'below' / 'no-data'), so this local
// map stays as the single source for both StandardTable KPI render sites.
const CATALOG_KPI_STATUS_TONE: Record<'on-target' | 'below' | 'no-data', StatusTone> = {
  'on-target': 'success',
  below: 'warning',
  'no-data': 'neutral',
};

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
      className="h-9 rounded-full border border-c-border-subtle bg-c-surface px-3 pr-8 text-sm text-c-text-secondary focus:outline-none focus:ring-2 focus:ring-c-focus"
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
  'results_kpi' as ModuleTab,
  'results_reports' as ModuleTab,
  'results_benefits_inbox' as ModuleTab,
  'roi' as ModuleTab,
  'roi_analysis' as ModuleTab,
  'results_strategic' as ModuleTab,
];
const VALID_KPI_MODES = ['overview', 'queue', 'catalog', 'scorecards'] as const;
const VALID_REPORT_MODES = ['tracked', 'reports', 'schedules', 'wallboards', 'connectors'] as const;

export const ResultsHub: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const currentUser = useAppStore((state) => state.currentUser);
  const currentOrganization = useAppStore((state) => state.currentOrganization);
  const openChatWithContext = useOpenChatWithContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const scopedInitiativeId = String(searchParams.get('initiativeId') || '').trim() || undefined;

  const [activeTab, setActiveTabRaw] = useState<ModuleTab>(
    (VALID_TABS.includes(searchParams.get('tab') as ModuleTab)
      ? searchParams.get('tab')!
      : 'results_kpi') as ModuleTab
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

  // #81/OC2 — ResultsThreePairsView data (flag-gated, see resultsFeatureFlags).
  const threePairsOn = isResultsFlagEnabled('threePairs');
  const [threePairRoiItems, setThreePairRoiItems] = useState<ROIInitiativeItem[]>([]);
  const [threePairObjectivesRaw, setThreePairObjectivesRaw] = useState<ThreePairObjective[]>([]);
  const [showOkrManage, setShowOkrManage] = useState(false);

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
  // Triada standard (canon A3/A6): checkbox selection on the KPI catalog list
  // switches Menu 3 into bulk mode (1:1 markup with Assessment/Interview 'list').
  const [selectedKpiIds, setSelectedKpiIds] = useState<Set<string>>(new Set());
  // Triada standard (StandardTable/StandardPreview, canon A4-A7): local previewId
  // for the KPI catalog list tab (separate from the full drawerState).
  const [selectedCatalogKpiId, setSelectedCatalogKpiId] = useState<string | null>(null);

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

    setActiveTabRaw('results_kpi');
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

  // #81/OC2 — ROI portfolio for the "para 2" table. Mirrors ROIAnalysisView's
  // fetchData 1:1 (same services: V8ResultsApi.getRoiPortfolioSummary with
  // legacy fallback to /benefits/roi/portfolio/summary), reused here rather
  // than re-deriving from a different endpoint.
  const fetchThreePairRoi = useCallback(async () => {
    if (!threePairsOn) return;
    try {
      let items: ROIInitiativeItem[] = [];
      try {
        const payload = await V8ResultsApi.getRoiPortfolioSummary();
        items = (payload.items || []) as ROIInitiativeItem[];
      } catch (error) {
        if (!shouldFallbackToLegacyResults(error)) throw error;
        const res = await Api.get('/benefits/roi/portfolio/summary');
        const data = (res as any)?.data || res;
        items = Array.isArray(data?.items) ? data.items : [];
      }
      setThreePairRoiItems(items);
    } catch {
      setThreePairRoiItems([]);
    }
  }, [threePairsOn]);

  useEffect(() => {
    void fetchThreePairRoi();
  }, [fetchThreePairRoi, roiRefreshNonce]);

  // #81/OC2 — OKR objectives for "para 3". Same endpoint StrategicLayerPanel
  // uses (/results-strategic/:projectId/okr, projectId="all"); response shape
  // (Objective { id, label, rollupScore, keyResults[{id,label,baseline,
  // target,current}] }) already matches ThreePairObjective 1:1.
  const fetchThreePairObjectives = useCallback(async () => {
    if (!threePairsOn) return;
    try {
      const res = await Api.get('/results-strategic/all/okr');
      const data: any = (res as any)?.data ?? res;
      const objectives = Array.isArray(data?.objectives) ? data.objectives : [];
      setThreePairObjectivesRaw(
        objectives.map((o: any) => ({
          id: o.id,
          label: o.label,
          rollupScore: o.rollupScore ?? o.score ?? 0,
          keyResults: Array.isArray(o.keyResults)
            ? o.keyResults.map((kr: any) => ({
                id: kr.id,
                label: kr.label,
                baseline: kr.baseline ?? 0,
                target: kr.target ?? 0,
                current: kr.current ?? 0,
              }))
            : [],
        }))
      );
    } catch {
      setThreePairObjectivesRaw([]);
    }
  }, [threePairsOn]);

  useEffect(() => {
    void fetchThreePairObjectives();
  }, [fetchThreePairObjectives, showOkrManage]);

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
        id: 'results_benefits_inbox' as ModuleTab,
        label: t('results.tabs.benefitsInbox', 'Incoming benefits'),
        icon: <Inbox size={16} />,
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
      ...(isResultsFlagEnabled('strategicLayer')
        ? [
            {
              id: 'results_strategic' as ModuleTab,
              label: t('results.tabs.strategic', 'Strategic'),
              icon: <Layers size={16} />,
            },
          ]
        : []),
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
    navigate(`${ROUTES.EXECUTION}?${query.toString()}`);
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
        toast.success(t('initiatives.toast.statusUpdated', 'Status updated'));
        await refreshResultsTruth({ refreshRoi: false });
      } catch (error: any) {
        toast.error(
          error?.response?.data?.error ||
            t('initiatives.toast.statusUpdateFailed', 'Failed to update the status')
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

  // Triada standard (canon A3/A6): bulk delete for the KPI catalog list tab
  // checkbox selection (delete IS a real, wired API — V8ResultsApi.deleteKpi).
  const handleBulkDeleteCatalogKpis = useCallback(async () => {
    if (selectedKpiIds.size === 0) return;
    if (
      !window.confirm(
        t(
          'results.bulkDeleteConfirm',
          `Delete ${selectedKpiIds.size} KPI(s)? This will remove their measurements, mappings, and deviation cases.`
        )
      )
    )
      return;
    for (const id of Array.from(selectedKpiIds)) {
      try {
        await V8ResultsApi.deleteKpi(id);
      } catch (error) {
        if (shouldFallbackToLegacyResults(error)) {
          await Api.delete(`/benefits/kpis/${id}`).catch(() => undefined);
        }
      }
    }
    setSelectedKpiIds(new Set());
    void refreshResultsTruth();
  }, [selectedKpiIds, refreshResultsTruth, t]);

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
        <div className="mx-1 h-5 w-px shrink-0 bg-c-border-subtle" />
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
            t('results.kpi.workspace.scorecards', 'Scorecards'),
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

  // Triada standard (canon A3/A6): checkbox selection on the KPI catalog list
  // tab switches Menu 3 into bulk mode (1:1 markup with Assessment 'list').
  // Also covers the `results_reports`+`tracked` sibling (same StandardTable
  // inline render, same `filteredKpis` source, same selection/preview state).
  const isCatalogListView =
    (activeTab === 'results_kpi' && kpiWorkspaceMode === 'catalog' && viewMode === 'table') ||
    (activeTab === 'results_reports' && reportWorkspaceMode === 'tracked');
  const catalogBulkCommandRowContent =
    isCatalogListView && selectedKpiIds.size > 0 ? (
      <div className={MENU_3_LEFT_CLASS + ' w-full justify-between flex'}>
        <div className={MENU_3_LEFT_CLASS}>
          <span className="inline-flex h-7 items-center rounded-full px-2.5 text-[11px] font-semibold text-c-text whitespace-nowrap">
            {`${selectedKpiIds.size} ${t('common.selected', 'selected')}`}
          </span>
          <Menu3Chip onClick={() => setSelectedKpiIds(new Set(filteredKpis.map((k) => k.id)))}>
            {t('common.selectAll', 'Select all')}
          </Menu3Chip>
          <Menu3Chip onClick={() => setSelectedKpiIds(new Set())}>
            {t('common.clear', 'Clear')}
          </Menu3Chip>
        </div>
        <div className={MENU_3_RIGHT_CLASS}>
          <button
            type="button"
            onClick={() => void handleBulkDeleteCatalogKpis()}
            className={MENU_3_ACTION_DANGER}
          >
            <Trash2 size={12} />
            {t('common.delete', 'Delete')}
          </button>
        </div>
      </div>
    ) : null;

  const effectiveCommandRowContent = catalogBulkCommandRowContent ?? commandRowContent;

  // Triada standard (StandardPreview, canon A7): selected row + actions for the
  // KPI catalog list tab preview pane.
  const selectedCatalogKpi: ResultsKPI | null = selectedCatalogKpiId
    ? (filteredKpis.find((k) => k.id === selectedCatalogKpiId) ?? null)
    : null;

  const catalogPreviewActions: StandardPreviewActions | undefined = useMemo(
    () =>
      selectedCatalogKpi
        ? {
            informational: [
              {
                id: 'record',
                variant: 'neutral',
                label: t('results.actions.recordValue', 'Record value'),
                icon: Target,
                shortcut: 'V',
                onClick: () => openKpiDrawer(selectedCatalogKpi.id, 'record'),
              },
              {
                id: 'watch',
                variant: 'neutral',
                label: watchedKpiIds.has(selectedCatalogKpi.id)
                  ? t('results.watch.unfollow', 'Unfollow KPI')
                  : t('results.watch.follow', 'Follow KPI'),
                icon: watchedKpiIds.has(selectedCatalogKpi.id) ? BellOff : Bell,
                onClick: () => toggleWatchKpi(selectedCatalogKpi.id),
              },
            ],
            resolutions: [
              {
                id: 'delete',
                variant: 'destructive',
                label: t('common.delete', 'Delete'),
                icon: Trash2,
                onClick: () => void handleDeleteKpi(selectedCatalogKpi.id),
              },
            ],
          }
        : undefined,
    [selectedCatalogKpi, t, openKpiDrawer, watchedKpiIds, toggleWatchKpi, handleDeleteKpi]
  );

  // Esc closes preview; single-key shortcuts (O/V) active while preview open (kanon B.24/B.31).
  useEffect(() => {
    if (!isCatalogListView || !selectedCatalogKpiId) return;
    const shortcuts = standardPreviewShortcuts(catalogPreviewActions);
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable)
        return;
      if (e.key === 'Escape') {
        setSelectedCatalogKpiId(null);
        return;
      }
      const handler = shortcuts[e.key.toUpperCase()];
      if (handler) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isCatalogListView, selectedCatalogKpiId, catalogPreviewActions]);

  // Triada standard (docs/ui-standards/TRIADA_KANON.md A4-A7): shared
  // StandardTable + StandardPreview render for the KPI list, used verbatim by
  // BOTH the `results_kpi`+`catalog` tab and the `results_reports`+`tracked`
  // sibling (same `filteredKpis` source, same selection/preview state via
  // `isCatalogListView`). Factored into one function so the two tabs cannot
  // drift apart — only `persistKey` differs (independent column width/sort
  // persistence per tab).
  const renderKpiStandardTable = (persistKey: string) => {
    const catalogRows = filteredKpis.map((k) => ({ ...k, id: k.id }));
    const catalogColumns: StandardTableColumn[] = [
      {
        id: 'name',
        label: t('results.columns.name', 'Name'),
        render: (row: Record<string, unknown>) => (
          <span className="text-sm font-semibold text-c-text truncate block max-w-[420px]">
            {String(row.name || '—')}
          </span>
        ),
      },
      {
        id: 'initiativeName',
        label: t('results.columns.initiative', 'Initiative'),
        width: '200px',
        filterable: true,
        filterOptions: [
          ...new Set(
            filteredKpis
              .flatMap((k) => [k.initiativeName, ...(k.linkedInitiatives || []).map((i) => i.name)])
              .filter(Boolean) as string[]
          ),
        ].map((n) => ({ value: n, label: n })),
        render: (row: Record<string, unknown>) => (
          <span className="text-sm text-c-text-muted truncate block max-w-[220px]">
            {String(row.initiativeName || '—')}
          </span>
        ),
      },
      {
        id: 'current',
        label: t('results.columns.current', 'Current'),
        width: '110px',
        align: 'right' as const,
        render: (row: Record<string, unknown>) => {
          const k = row as unknown as ResultsKPI;
          return k.latestValue == null ? (
            <span className="text-sm text-c-text-muted">—</span>
          ) : (
            <span className="text-sm tabular-nums text-c-text">
              {k.latestValue.toLocaleString()}
              {k.unit ? <span className="ml-0.5 text-xs text-c-text-muted">{k.unit}</span> : null}
            </span>
          );
        },
      },
      {
        id: 'target',
        label: t('results.columns.target', 'Target'),
        width: '110px',
        align: 'right' as const,
        render: (row: Record<string, unknown>) => {
          const k = row as unknown as ResultsKPI;
          return k.targetValue == null ? (
            <span className="text-sm text-c-text-muted">—</span>
          ) : (
            <span className="text-sm tabular-nums text-c-text">
              {k.targetValue.toLocaleString()}
              {k.unit ? <span className="ml-0.5 text-xs text-c-text-muted">{k.unit}</span> : null}
            </span>
          );
        },
      },
      {
        id: 'ownerName',
        label: t('results.columns.owner', 'Owner'),
        width: '160px',
        filterable: true,
        filterOptions: Array.from(
          new Set(filteredKpis.map((k) => String(k.ownerName || '').trim()).filter(Boolean))
        ).map((owner) => ({ value: owner, label: owner })),
        render: (row: Record<string, unknown>) => (
          <AssigneeCell
            name={(row.ownerName as string) || null}
            unassignedLabel={t('common.unassigned', 'Unassigned')}
          />
        ),
      },
      {
        id: 'status',
        label: t('results.columns.status', 'Status'),
        width: '140px',
        filterable: true,
        filterOptions: [
          {
            value: 'on-target',
            label: t('results.status.onTarget', 'On target'),
          },
          { value: 'below', label: t('results.status.below', 'Below target') },
          { value: 'no-data', label: t('results.status.noData', 'No data') },
        ],
        render: (row: Record<string, unknown>) => {
          const k = row as unknown as ResultsKPI;
          const label =
            k.status === 'on-target'
              ? t('results.status.onTarget', 'On target')
              : k.status === 'below'
                ? t('results.status.below', 'Below target')
                : t('results.status.noData', 'No data');
          return <StatusChip tone={CATALOG_KPI_STATUS_TONE[k.status] ?? 'neutral'} label={label} />;
        },
      },
      {
        id: 'needsEntry',
        label: t('results.columns.needsEntry', 'Needs entry'),
        width: '140px',
        filterable: true,
        filterOptions: [
          { value: 'yes', label: t('common.yes', 'Yes') },
          { value: 'no', label: t('common.no', 'No') },
        ],
        render: (row: Record<string, unknown>) => {
          const k = row as unknown as ResultsKPI;
          return k.needsEntry ? (
            <StatusChip tone="warning" label={t('results.needsEntry.badge', 'Needs entry')} />
          ) : (
            <span className="text-c-text-muted">—</span>
          );
        },
      },
      {
        id: 'updatedAt',
        label: t('common.updated', 'Updated'),
        width: '130px',
        sortable: true,
        sortAccessor: (row: Record<string, unknown>) => {
          const k = row as unknown as ResultsKPI;
          const raw = k.latestMeasurementDate || k.createdAt;
          return raw ? new Date(raw).getTime() : 0;
        },
        render: (row: Record<string, unknown>) => {
          const k = row as unknown as ResultsKPI;
          const raw = k.latestMeasurementDate || k.createdAt;
          return raw ? (
            <span className="text-[11px] text-c-text-muted">
              {new Date(raw).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          ) : (
            <span className="text-c-text-muted">—</span>
          );
        },
      },
    ];

    return (
      <div className="h-full flex overflow-hidden">
        <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
          <StandardTable
            columns={catalogColumns}
            data={catalogRows as unknown as Array<Record<string, unknown> & { id: string }>}
            selectedRowId={selectedCatalogKpiId}
            onRowClick={(row) => setSelectedCatalogKpiId(String((row as any).id))}
            onRowDoubleClick={(row) => openKpiDrawer(String((row as any).id), 'summary')}
            rowDescription={() => null}
            defaultSort={{ columnId: 'updatedAt', direction: 'desc' }}
            persistKey={persistKey}
            selection={{ selectedIds: selectedKpiIds, onChange: setSelectedKpiIds }}
            empty={{
              icon: Target,
              title: t('results.emptyState', 'No KPIs found'),
              description: t(
                'results.emptyState.description',
                'Add your first KPI to start tracking results.'
              ),
              actionLabel: t('results.emptyState.createFirst', 'Add KPI'),
              onAction: () => setShowCreateModal(true),
            }}
            rowMenu={(row): StandardRowMenu => {
              const k = row as unknown as ResultsKPI;
              return {
                primary: [
                  {
                    id: 'record',
                    label: t('results.actions.recordValue', 'Record value'),
                    icon: Target,
                    onClick: () => openKpiDrawer(k.id, 'record'),
                  },
                  {
                    id: 'watch',
                    label: watchedKpiIds.has(k.id)
                      ? t('results.watch.unfollow', 'Unfollow KPI')
                      : t('results.watch.follow', 'Follow KPI'),
                    icon: watchedKpiIds.has(k.id) ? BellOff : Bell,
                    onClick: () => toggleWatchKpi(k.id),
                  },
                ],
                // Brak API zmiany statusu KPI (status jest derived, nie ma
                // endpointu przejścia) — brak statusTransitions celowo.
                universalHandlers: {
                  preview: () => setSelectedCatalogKpiId(k.id),
                  edit: () => openKpiDrawer(k.id, 'definition'),
                  // Brak API archiwizacji KPI (nie istnieje w ogóle) —
                  // disabled z notą (StandardTable dokłada ją sama).
                },
                destructive: {
                  onClick: () => void handleDeleteKpi(k.id),
                },
              };
            }}
          />
        </div>

        {selectedCatalogKpi ? (
          <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
            <StandardPreview
              title={selectedCatalogKpi.name || 'KPI'}
              onClose={() => setSelectedCatalogKpiId(null)}
              onOpenFull={() => openKpiDrawer(selectedCatalogKpi.id, 'summary')}
              meta={{
                pills: [
                  {
                    label:
                      selectedCatalogKpi.status === 'on-target'
                        ? t('results.status.onTarget', 'On target')
                        : selectedCatalogKpi.status === 'below'
                          ? t('results.status.below', 'Below target')
                          : t('results.status.noData', 'No data'),
                    tone: CATALOG_KPI_STATUS_TONE[selectedCatalogKpi.status] ?? 'neutral',
                  },
                  ...(selectedCatalogKpi.needsEntry
                    ? [
                        {
                          label: t('results.needsEntry.badge', 'Needs entry'),
                          tone: 'warning',
                        } as MetaPill,
                      ]
                    : []),
                  ...(watchedKpiIds.has(selectedCatalogKpi.id)
                    ? [
                        {
                          label: t('results.filters.watched', 'Watched KPI'),
                          tone: 'info',
                        } as MetaPill,
                      ]
                    : []),
                ] as MetaPill[],
                trailing: (
                  <span className="text-[11px] font-semibold text-c-text-secondary">
                    {selectedCatalogKpi.latestMeasurementDate
                      ? new Date(selectedCatalogKpi.latestMeasurementDate).toLocaleDateString(
                          undefined,
                          { month: 'short', day: 'numeric', year: 'numeric' }
                        )
                      : '—'}
                  </span>
                ),
              }}
              details={{
                text: [
                  `${t('results.columns.current', 'Current')}: ${
                    selectedCatalogKpi.latestValue != null
                      ? `${selectedCatalogKpi.latestValue.toLocaleString()}${selectedCatalogKpi.unit ? ` ${selectedCatalogKpi.unit}` : ''}`
                      : '—'
                  }`,
                  `${t('results.columns.target', 'Target')}: ${
                    selectedCatalogKpi.targetValue != null
                      ? `${selectedCatalogKpi.targetValue.toLocaleString()}${selectedCatalogKpi.unit ? ` ${selectedCatalogKpi.unit}` : ''}`
                      : '—'
                  }`,
                  `${t('results.columns.owner', 'Owner')}: ${selectedCatalogKpi.ownerName || '—'}`,
                  `${t('results.columns.frequency', 'Frequency')}: ${selectedCatalogKpi.measurementFrequency || '—'}`,
                  '',
                  selectedCatalogKpi.description?.trim() ||
                    t('common.noDescription', 'No description'),
                ].join('\n'),
                onCopy: () => {
                  void navigator.clipboard?.writeText(
                    `${selectedCatalogKpi.name} — ${selectedCatalogKpi.status} (${selectedCatalogKpi.latestValue ?? '—'})`
                  );
                },
              }}
              ai={{
                hints: [
                  t('results.kpi.ai.why', 'Why off target?'),
                  t('results.kpi.ai.plan', 'Action plan'),
                ],
                disabled: true,
                disabledTooltip: t('common.comingSoon', 'Coming soon'),
              }}
              relations={
                selectedCatalogKpi.initiativeName
                  ? [
                      {
                        label: `${t('results.columns.initiative', 'Initiative')}: ${selectedCatalogKpi.initiativeName}`,
                      },
                    ]
                  : []
              }
              actions={catalogPreviewActions}
            />
          </aside>
        ) : null}
      </div>
    );
  };

  // #81/OC2 — domain → ResultsThreePairsView prop adapters. Reuse existing
  // types 1:1 (ResultsKPI/InitiativeKPI, ROIInitiativeItem, OKR objective
  // shape from /results-strategic/:id/okr) — zero new endpoints.
  const threePairKpis: ThreePairKpi[] = useMemo(
    () =>
      kpis.map((k) => ({
        id: k.id,
        name: k.name,
        initiativeName: k.initiativeName ?? null,
        unit: k.unit ?? null,
        baseline: k.baselineValue ?? null,
        target: k.targetValue ?? null,
        current: k.latestValue ?? null,
        status: k.status,
        trend: k.trend,
      })),
    [kpis]
  );

  const threePairRoi: ThreePairRoi[] = useMemo(
    () =>
      threePairRoiItems.map((r) => ({
        initiativeId: r.initiativeId,
        initiativeName: r.initiativeName,
        projectedBenefit: r.projectedBenefit,
        realizedBenefit: r.realizedBenefit,
        hasRealized: r.hasRealized,
        ownerName: r.ownerName ?? null,
      })),
    [threePairRoiItems]
  );

  if (threePairsOn) {
    return (
      <>
        <ResultsThreePairsView
          kpis={threePairKpis}
          roi={threePairRoi}
          objectives={threePairObjectivesRaw}
          isPolish={i18n.language?.startsWith('pl') ?? true}
          onAddKpi={() => setShowCreateModal(true)}
          onNewRoi={openRoiPicker}
          onManageOkr={() => setShowOkrManage(true)}
          onOpenKpi={(id) => openKpiDrawer(id, 'summary')}
          onOpenRoi={(initiativeId) => {
            const item = threePairRoiItems.find((r) => r.initiativeId === initiativeId);
            setRoiDrawer({ id: initiativeId, name: item?.initiativeName || initiativeId });
          }}
          onOpenObjective={() => setShowOkrManage(true)}
        />

        {showCreateModal && (
          <KPICreateModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={handleCreateSuccess}
          />
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

        {/* onManageOkr / onOpenObjective: full OKR CRUD lives in StrategicLayerPanel
            (cycles, check-ins, objective/KR modals) — not yet re-modeled into a
            dedicated "manage" surface for the 3-pary layout, so it opens as an
            overlay on top of para 3 rather than duplicating that logic. */}
        {showOkrManage && (
          <div
            className="fixed inset-0 z-50 flex items-stretch justify-end bg-navy-950/40"
            onClick={() => setShowOkrManage(false)}
          >
            <div
              className="flex h-full w-full max-w-4xl flex-col overflow-y-auto border-l border-c-border-subtle bg-c-surface shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-c-border-subtle px-4 py-3">
                <h2 className="text-sm font-semibold text-c-text">
                  {t('results.okr.manageTitle', 'Manage OKR')}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowOkrManage(false)}
                  className="rounded-full border border-c-border-subtle bg-c-surface-raised px-3 py-1 text-sm font-medium text-c-text hover:bg-c-surface focus:outline-none focus:ring-2 focus:ring-c-focus"
                >
                  {t('common.close', 'Close')}
                </button>
              </div>
              <div className="flex-1">
                <StrategicLayerPanel projectId="all" />
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <StandardModuleBar
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
        openItems={openDocuments}
        activeItemId={activeDocumentId}
        onSelectItem={setActiveDocumentId}
        onCloseItem={(id) => {
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
        viewModes={
          activeTab === 'results_kpi' && kpiWorkspaceMode === 'catalog'
            ? ['table', 'grid']
            : ['table']
        }
        filterControls={rightControls}
        commandRowContent={effectiveCommandRowContent}
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
              <div className="p-4">
                <SharedLoadingState template="panel" />
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
          isResultsFlagEnabled('transformationScorecard') || isResultsFlagEnabled('m14Handoff') ? (
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
                  <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface/40 p-4">
                    <h3 className="text-sm font-semibold text-c-text mb-3">
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
        ) : activeTab === 'results_benefits_inbox' ? (
          <M14HandoffInbox onPromoted={() => void refreshResultsTruth()} />
        ) : activeTab === 'results_strategic' ? (
          <div className="p-4 overflow-auto space-y-6">
            {isResultsFlagEnabled('strategicLayer') ? (
              <StrategicLayerPanel projectId="all" />
            ) : (
              <div className="text-sm text-c-text-muted py-8 text-center">
                {t(
                  'results.strategic.disabled',
                  'Strategic layer disabled — enable the ff_strategicLayer flag.'
                )}
              </div>
            )}
            {isResultsFlagEnabled('valueDriverTree') && (
              <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface/40 p-4">
                <h3 className="text-sm font-semibold text-c-text mb-3">
                  {t('results.driverTree.title', 'Value Driver Tree')}
                </h3>
                <ValueDriverTree projectId="all" />
              </div>
            )}
          </div>
        ) : activeTab === 'results_ai' ? (
          <div className="p-4 overflow-auto space-y-6">
            {isResultsFlagEnabled('aiInsights') && <AIInsightsPanel projectId="all" />}
            {isResultsFlagEnabled('portfolioInsights') && (
              <PortfolioInsightsPanel projectId="all" />
            )}
            {!isResultsFlagEnabled('aiInsights') && !isResultsFlagEnabled('portfolioInsights') && (
              <div className="text-sm text-c-text-muted py-8 text-center">
                {t(
                  'results.ai.disabled',
                  'AI/Portfolio panel disabled — enable ff_aiInsights or ff_portfolioInsights.'
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'results_reports' ? (
          reportWorkspaceMode === 'tracked' ? (
            // Triada standard (docs/ui-standards/TRIADA_KANON.md A4-A7): same
            // StandardTable + StandardPreview render as the `results_kpi`
            // catalog tab (see `renderKpiStandardTable`, shared function
            // defined above `return`). `ResultsKpisTableV3` (FilterableTable,
            // pre-triada) has no other consumers left — kept as a file for
            // now but no longer rendered anywhere in this hub.
            renderKpiStandardTable('results.kpi.tracked.list')
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
          <div className="p-4">
            <SharedLoadingState template="list" rows={6} />
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
          // Triada standard (docs/ui-standards/TRIADA_KANON.md A4-A7): KPI
          // catalog tab → StandardTable + StandardPreview, 1:1 with the
          // Assessment 'list' / Interview Inbox adopters. Shared render fn
          // `renderKpiStandardTable` (defined above `return`) is reused
          // verbatim by the `results_reports`+`tracked` sibling above.
          renderKpiStandardTable('results.kpi.catalog.list')
        ) : activeTab === 'results_kpi' ? (
          <ResultsGridView
            kpis={filteredKpis}
            onItemClick={(kpi) => openKpiDrawer(kpi.id, 'summary')}
            onItemAction={handleRowAction}
            onNewItem={() => setShowCreateModal(true)}
          />
        ) : null}
      </StandardModuleBar>

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
