import {
  BarChart3,
  ClipboardList,
  DollarSign,
  FileText,
  Plus,
  Target,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import {
  V8ResultsApi,
  shouldFallbackToLegacyResults,
  type V8ResultsDashboardSnapshot,
} from '@/services/api/v8/results';
import { InitiativeKPI } from '@/types/core';

import { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import { ModuleHub } from '../shared/ModuleHub/ModuleHub';
import { ModuleTab, TabConfig, ViewMode } from '../shared/ModuleHub/types';
import { useModuleOpenDocuments } from '../shared/ModuleHub/useModuleOpenDocuments';
import { KPICreateModal } from './KPICreateModal';
import { KPITimeSeriesDrawer } from './KPITimeSeriesDrawer';
import { OperationalAnalysisView } from './OperationalAnalysisView';
import { ResultsKpiReportsView } from './ResultsKpiReportsView';
import { ResultsKpisTableV3 } from './ResultsKpisTableV3';
import { ResultsGridView } from './ResultsKPITable';
import { ResultsSummaryView } from './ResultsSummaryView';
import { ROIAnalysisView } from './ROIAnalysisView';
import { ROIDetailDrawer } from './ROIDetailDrawer';
import { ROIOpenModal } from './ROIOpenModal';
import { ROITrackingView } from './ROITrackingView';

export type KPIStatus = 'on-target' | 'below' | 'no-data';
export type KPITrend = 'up' | 'down' | 'stable';

export interface ResultsKPI extends InitiativeKPI {
  initiativeName?: string;
  ownerName?: string;
  ownerAvatar?: string;
  baselineValue?: number | null;
  openDeviationCase?: { id: string; severity: 'AMBER' | 'RED'; status: string } | null;
  linkedInitiatives?: Array<{ id: string; name: string }>;
  linkedInitiativesCount?: number;
  status: KPIStatus;
  trend: KPITrend;
  needsEntry: boolean;
}

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

function deriveStatus(kpi: InitiativeKPI): KPIStatus {
  if (kpi.latestValue == null) return 'no-data';
  return kpi.isOnTarget ? 'on-target' : 'below';
}

function deriveTrend(kpi: InitiativeKPI): KPITrend {
  const prev = (kpi as any).prevValue;
  const latest = kpi.latestValue;
  if (latest == null || prev == null) return 'stable';
  const a = Number(latest);
  const b = Number(prev);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 'stable';
  if (a > b) return 'up';
  if (a < b) return 'down';
  return 'stable';
}

function deriveNeedsEntry(kpi: InitiativeKPI): boolean {
  const latest = kpi.latestMeasurementDate;
  if (!latest) return true;
  const d = new Date(latest);
  if (Number.isNaN(d.getTime())) return true;

  const now = new Date();
  const freq = kpi.measurementFrequency || 'MONTHLY';

  const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
  if (freq === 'DAILY') return diffDays > 2;
  if (freq === 'WEEKLY') return diffDays > 8;
  if (freq === 'MONTHLY')
    return d.getFullYear() < now.getFullYear() || d.getMonth() < now.getMonth();

  // QUARTERLY
  const q = (dt: Date) => Math.floor(dt.getMonth() / 3) + 1;
  if (d.getFullYear() !== now.getFullYear()) return d.getFullYear() < now.getFullYear();
  return q(d) < q(now);
}

export const ResultsHub: React.FC = () => {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<ModuleTab>('summary');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [kpiReportCreateNonce, setKpiReportCreateNonce] = useState(0);
  const [drawerKpiId, setDrawerKpiId] = useState<string | null>(null);
  const [roiOpenModal, setRoiOpenModal] = useState(false);
  const [roiDrawer, setRoiDrawer] = useState<{ id: string; name: string } | null>(null);
  const [roiRefreshNonce, setRoiRefreshNonce] = useState(0);

  const [kpis, setKpis] = useState<ResultsKPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [v8Snapshot, setV8Snapshot] = useState<V8ResultsDashboardSnapshot | null>(null);

  const { openDocuments, setOpenDocuments, activeDocumentId, setActiveDocumentId } =
    useModuleOpenDocuments('results');

  const fetchKPIs = useCallback(async () => {
    setLoading(true);
    try {
      let kpisList: any[] = [];
      let mappingsList: any[] = [];

      try {
        const catalog = await V8ResultsApi.getKpiCatalog();
        kpisList = Array.isArray(catalog?.kpis) ? catalog.kpis : [];
        mappingsList = Array.isArray(catalog?.mappings) ? catalog.mappings : [];
      } catch (error) {
        if (!shouldFallbackToLegacyResults(error)) {
          throw error;
        }
        const [kpisRes, mappingsRes] = await Promise.allSettled([
          Api.get('/benefits/kpis'),
          Api.get('/benefits/kpi-mappings'),
        ]);

        const kpisPayload: any = kpisRes.status === 'fulfilled' ? (kpisRes.value as any) : null;
        kpisList = (kpisPayload?.data || []) as any[];

        const mappingsPayload: any =
          mappingsRes.status === 'fulfilled' ? (mappingsRes.value as any) : null;
        mappingsList = (mappingsPayload?.data || []) as any[];
      }

      const byKpi = new Map<string, Array<{ id: string; name: string }>>();
      for (const m of mappingsList || []) {
        const kpiId = String(m.kpi_id ?? m.kpiId ?? '').trim();
        const initiativeId = String(m.initiative_id ?? m.initiativeId ?? '').trim();
        const initiativeName = String(m.initiative_name ?? m.initiativeName ?? '').trim();
        if (!kpiId || !initiativeId) continue;
        const arr = byKpi.get(kpiId) || [];
        if (!arr.some((x) => x.id === initiativeId)) {
          arr.push({ id: initiativeId, name: initiativeName || initiativeId });
        }
        byKpi.set(kpiId, arr);
      }

      const mapped: ResultsKPI[] = (kpisList || []).map((k: any) => {
        const kpiId = String(k?.id ?? '').trim();
        const linked = kpiId ? byKpi.get(kpiId) || [] : [];
        const legacyInitiativeName = k?.initiativeName || k?.initiative_name || null;
        const derivedInitiativeName =
          legacyInitiativeName ||
          (linked.length === 1
            ? linked[0]?.name
            : linked.length > 1
              ? `${linked[0]?.name} +${linked.length - 1}`
              : null);

        return {
          ...k,
          initiativeName: derivedInitiativeName || undefined,
          linkedInitiatives: linked,
          linkedInitiativesCount: linked.length,
          status: deriveStatus(k),
          trend: deriveTrend(k),
          needsEntry: deriveNeedsEntry(k),
        } as ResultsKPI;
      });
      setKpis(mapped);
    } catch {
      setKpis([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKPIs();
  }, [fetchKPIs]);

  useEffect(() => {
    let cancelled = false;
    const loadV8Snapshot = async () => {
      try {
        const response = await V8ResultsApi.getDashboard();
        if (!cancelled) {
          setV8Snapshot(response.snapshot);
        }
      } catch {
        if (!cancelled) {
          setV8Snapshot(null);
        }
      }
    };
    void loadV8Snapshot();
    return () => {
      cancelled = true;
    };
  }, []);

  const tabs: TabConfig[] = useMemo(
    () => [
      {
        id: 'summary' as ModuleTab,
        label: t('results.tabs.summary', 'Zestawienie'),
        icon: <ClipboardList size={16} />,
      },
      {
        id: 'kpis' as ModuleTab,
        label: t('results.tabs.kpis', 'KPI'),
        icon: <Target size={16} />,
        count: kpis.length,
      },
      {
        id: 'kpi_reports' as ModuleTab,
        label: t('results.tabs.kpiReports', 'Raporty KPI'),
        icon: <FileText size={16} />,
      },
      {
        id: 'roi' as ModuleTab,
        label: t('results.tabs.roi', 'ROI'),
        icon: <DollarSign size={16} />,
      },
      {
        id: 'operational' as ModuleTab,
        label: t('results.tabs.operational', 'KPI Analysis'),
        icon: <BarChart3 size={16} />,
      },
      {
        id: 'roi_analysis' as ModuleTab,
        label: t('results.tabs.roiAnalysis', 'ROI Analysis'),
        icon: <DollarSign size={16} />,
      },
    ],
    [t, kpis]
  );

  const filteredKpis = useMemo(() => {
    let items = [...kpis];

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
          const v = (k as any)[col];
          return vals.includes(String(v));
        });
      });
    }

    return items;
  }, [kpis, searchQuery, activeFilters]);

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
        await Api.delete(`/benefits/kpis/${kpiId}`);
      } catch {
        // silent
      } finally {
        setDrawerKpiId((prev) => (prev === kpiId ? null : prev));
        fetchKPIs();
      }
    },
    [fetchKPIs, t]
  );

  const handleRowAction = useCallback(
    (action: string, kpi: ResultsKPI) => {
      switch (action) {
        case 'open':
        case 'preview':
        case 'record':
        case 'edit':
        case 'links':
          setDrawerKpiId(kpi.id);
          break;
        case 'delete':
          void handleDeleteKpi(kpi.id);
          break;
        default:
          break;
      }
    },
    [handleDeleteKpi]
  );

  const handleCreateSuccess = useCallback(() => {
    setShowCreateModal(false);
    fetchKPIs();
  }, [fetchKPIs]);

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

  const commandRowContent = useMemo(() => {
    const chipBase =
      'h-8 inline-flex items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium border transition-colors whitespace-nowrap';
    const badgeBase =
      'px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums leading-none';

    if (activeTab === 'summary') {
      return (
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('kpis')}
            className={`${chipBase} bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50`}
            title={t('results.tabs.kpis', 'KPI')}
          >
            <Target size={14} className="text-emerald-400" />
            <span>{t('results.tabs.kpis', 'KPI')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('kpi_reports')}
            className={`${chipBase} bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50`}
            title={t('results.tabs.kpiReports', 'Raporty KPI')}
          >
            <FileText size={14} className="text-slate-400" />
            <span>{t('results.tabs.kpiReports', 'Raporty KPI')}</span>
          </button>
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

    if (activeTab === 'kpis') {
      const base = (() => {
        let items = [...kpis];
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

    if (activeTab === 'kpi_reports') {
      return (
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setKpiReportCreateNonce(Date.now())}
            className={`${chipBase} bg-primary-500/15 text-primary-300 border-primary-500/30 hover:bg-primary-500/20`}
            title={t('results.kpiReports.new', '+ New KPI report')}
          >
            <Plus size={14} />
            <span>{t('results.kpiReports.new', '+ New KPI report')}</span>
          </button>
          {governedRuntimeStrip}
        </div>
      );
    }

    if (activeTab === 'operational') {
      return <div className="flex items-center gap-2 overflow-x-auto">{governedRuntimeStrip}</div>;
    }

    return governedRuntimeStrip ? (
      <div className="flex items-center gap-2 overflow-x-auto">{governedRuntimeStrip}</div>
    ) : null;
  }, [
    activeFilters,
    activeTab,
    governedRuntimeStrip,
    kpis,
    openRoiPicker,
    searchQuery,
    setKpiReportCreateNonce,
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
          activeTab === 'kpis'
            ? () => setShowCreateModal(true)
            : activeTab === 'kpi_reports'
              ? () => setKpiReportCreateNonce(Date.now())
              : activeTab === 'roi'
                ? () => setRoiOpenModal(true)
                : undefined
        }
        newItemLabel={
          activeTab === 'kpis'
            ? t('results.addKpi', '+ Add KPI')
            : activeTab === 'kpi_reports'
              ? t('results.kpiReports.new', '+ New KPI report')
              : activeTab === 'roi'
                ? t('results.roi.add', '+ Record ROI')
                : undefined
        }
        // A03 canon: Results hub uses the canonical subset order (table→grid).
        // Non-KPI tabs can ignore viewMode; we keep the toggle consistent across the hub.
        availableViewModes={['table', 'grid']}
        commandRowContent={commandRowContent}
      >
        {activeTab === 'summary' ? (
          <ResultsSummaryView
            searchQuery={searchQuery}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
          />
        ) : activeTab === 'operational' ? (
          <OperationalAnalysisView />
        ) : activeTab === 'roi_analysis' ? (
          <ROIAnalysisView />
        ) : activeTab === 'kpi_reports' ? (
          <ResultsKpiReportsView
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            createNonce={kpiReportCreateNonce}
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
        ) : activeTab === 'kpis' && viewMode === 'table' ? (
          <ResultsKpisTableV3
            kpis={filteredKpis}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            onOpenKpi={(id) => setDrawerKpiId(id)}
            onDeleteKpi={handleDeleteKpi}
          />
        ) : activeTab === 'kpis' ? (
          <ResultsGridView
            kpis={filteredKpis}
            onItemClick={(kpi) => setDrawerKpiId(kpi.id)}
            onItemAction={handleRowAction}
            onNewItem={() => setShowCreateModal(true)}
          />
        ) : null}
      </ModuleHub>

      {showCreateModal && (
        <KPICreateModal onClose={() => setShowCreateModal(false)} onSuccess={handleCreateSuccess} />
      )}

      {drawerKpiId && (
        <KPITimeSeriesDrawer
          kpiId={drawerKpiId}
          onClose={() => setDrawerKpiId(null)}
          onValueRecorded={fetchKPIs}
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
            setRoiRefreshNonce(Date.now());
          }}
        />
      )}
    </>
  );
};

export default ResultsHub;
