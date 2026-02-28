import { BarChart3, ClipboardList, DollarSign, FileText, Target } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { API_URL, getHeaders } from '@/services/api';
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

export type KPIStatus = 'on-target' | 'below' | 'no-data';
export type KPITrend = 'up' | 'down' | 'stable';

export interface ResultsKPI extends InitiativeKPI {
  initiativeName?: string;
  ownerName?: string;
  ownerAvatar?: string;
  baselineValue?: number | null;
  status: KPIStatus;
  trend: KPITrend;
}

function deriveStatus(kpi: InitiativeKPI): KPIStatus {
  if (kpi.latestValue == null) return 'no-data';
  return kpi.isOnTarget ? 'on-target' : 'below';
}

function deriveTrend(_kpi: InitiativeKPI): KPITrend {
  return 'stable';
}

export const ResultsHub: React.FC = () => {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<ModuleTab>('summary');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [drawerKpiId, setDrawerKpiId] = useState<string | null>(null);

  const [kpis, setKpis] = useState<ResultsKPI[]>([]);
  const [loading, setLoading] = useState(true);

  const { openDocuments, setOpenDocuments, activeDocumentId, setActiveDocumentId } =
    useModuleOpenDocuments('results');

  const fetchKPIs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/benefits/kpi-mappings`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const mapped: ResultsKPI[] = (data || []).map((k: any) => ({
          ...k,
          status: deriveStatus(k),
          trend: deriveTrend(k),
        }));
        setKpis(mapped);
      }
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
        onNewItem={activeTab === 'kpis' ? () => setShowCreateModal(true) : undefined}
        newItemLabel={activeTab === 'kpis' ? t('results.addKpi', '+ Add KPI') : undefined}
        availableViewModes={activeTab === 'kpis' ? ['table', 'grid'] : ['table']}
      >
        {activeTab === 'summary' ? (
          <ResultsSummaryView
            searchQuery={searchQuery}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
          />
        ) : activeTab === 'kpi_reports' ? (
          <ResultsKpiReportsView activeFilters={activeFilters} onFilterChange={setActiveFilters} />
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
