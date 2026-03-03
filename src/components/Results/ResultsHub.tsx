import { BarChart3, ClipboardList, DollarSign, FileText, Target } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { InitiativeKPI } from '@/types/core';

import { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import { ModuleHub } from '../shared/ModuleHub/ModuleHub';
import { ModuleTab, TabConfig, ViewMode } from '../shared/ModuleHub/types';
import { useModuleOpenDocuments } from '../shared/ModuleHub/useModuleOpenDocuments';
import { KPICreateModal } from './KPICreateModal';
import { KPITimeSeriesDrawer } from './KPITimeSeriesDrawer';
import { ResultsGridView } from './ResultsKPITable';
import { ResultsKpisTableV3 } from './ResultsKpisTableV3';
import { ROITrackingView } from './ROITrackingView';
import { ResultsKpiReportsView } from './ResultsKpiReportsView';
import { ResultsSummaryView } from './ResultsSummaryView';
import { OperationalAnalysisView } from './OperationalAnalysisView';
import { ROIAnalysisView } from './ROIAnalysisView';

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

  const [kpis, setKpis] = useState<ResultsKPI[]>([]);
  const [loading, setLoading] = useState(true);

  const { openDocuments, setOpenDocuments, activeDocumentId, setActiveDocumentId } =
    useModuleOpenDocuments('results');

  const fetchKPIs = useCallback(async () => {
    setLoading(true);
    try {
      const [kpisRes, mappingsRes] = await Promise.allSettled([
        Api.get('/benefits/kpis'),
        Api.get('/benefits/kpi-mappings'),
      ]);

      const kpisPayload: any =
        kpisRes.status === 'fulfilled' ? (kpisRes.value as any) : null;
      const kpisList = (kpisPayload?.data || []) as any[];

      const mappingsPayload: any =
        mappingsRes.status === 'fulfilled' ? (mappingsRes.value as any) : null;
      const mappingsList = (mappingsPayload?.data || []) as any[];

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
          (linked.length === 1 ? linked[0]?.name : linked.length > 1 ? `${linked[0]?.name} +${linked.length - 1}` : null);

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
      // silently fail — table will show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKPIs();
  }, [fetchKPIs]);

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

  const handleRowAction = useCallback((action: string, kpi: ResultsKPI) => {
    switch (action) {
      case 'open':
      case 'preview':
        setDrawerKpiId(kpi.id);
        break;
      case 'record':
        setDrawerKpiId(kpi.id);
        break;
      case 'delete':
        break;
      default:
        break;
    }
  }, []);

  const handleCreateSuccess = useCallback(() => {
    setShowCreateModal(false);
    fetchKPIs();
  }, [fetchKPIs]);

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
              : undefined
        }
        newItemLabel={
          activeTab === 'kpis'
            ? t('results.addKpi', '+ Add KPI')
            : activeTab === 'kpi_reports'
              ? t('results.kpiReports.new', '+ New KPI report')
              : undefined
        }
        // A03 canon: Results hub uses the canonical subset order (table→grid).
        // Non-KPI tabs can ignore viewMode; we keep the toggle consistent across the hub.
        availableViewModes={['table', 'grid']}
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
          <ROITrackingView />
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
    </>
  );
};

export default ResultsHub;
