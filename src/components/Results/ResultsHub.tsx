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

const DEMO_KPIS: ResultsKPI[] = [
  { id: 'demo-k1', name: 'Revenue Growth YoY', description: 'Year-over-year revenue growth rate', targetValue: 15, unit: '%', measurementFrequency: 'QUARTERLY', alertDirection: 'BELOW', isPrimary: true, sortOrder: 1, latestValue: 12.4, latestMeasurementDate: '2026-03-01', isOnTarget: false, createdAt: '2025-01-01T00:00:00Z', status: 'below', trend: 'up', needsEntry: false, initiativeName: 'Digital Transformation', linkedInitiatives: [{ id: 'i1', name: 'Digital Transformation' }], linkedInitiativesCount: 1 },
  { id: 'demo-k2', name: 'Customer Satisfaction (NPS)', description: 'Net Promoter Score from quarterly surveys', targetValue: 60, unit: 'pts', measurementFrequency: 'QUARTERLY', alertDirection: 'BELOW', isPrimary: true, sortOrder: 2, latestValue: 64, latestMeasurementDate: '2026-02-15', isOnTarget: true, createdAt: '2025-01-01T00:00:00Z', status: 'on-target', trend: 'up', needsEntry: false, initiativeName: 'CX Improvement Program', linkedInitiatives: [{ id: 'i2', name: 'CX Improvement Program' }], linkedInitiativesCount: 1 },
  { id: 'demo-k3', name: 'Process Automation Rate', description: 'Percentage of key processes automated', targetValue: 40, unit: '%', measurementFrequency: 'MONTHLY', alertDirection: 'BELOW', isPrimary: false, sortOrder: 3, latestValue: 38, latestMeasurementDate: '2026-03-10', isOnTarget: false, createdAt: '2025-03-01T00:00:00Z', status: 'below', trend: 'up', needsEntry: false, initiativeName: 'RPA Implementation', linkedInitiatives: [{ id: 'i3', name: 'RPA Implementation' }], linkedInitiativesCount: 1 },
  { id: 'demo-k4', name: 'Employee Engagement Score', description: 'Annual engagement survey result', targetValue: 4.2, unit: '/5', measurementFrequency: 'QUARTERLY', alertDirection: 'BELOW', isPrimary: false, sortOrder: 4, latestValue: 4.3, latestMeasurementDate: '2026-01-20', isOnTarget: true, createdAt: '2025-01-01T00:00:00Z', status: 'on-target', trend: 'stable', needsEntry: true, initiativeName: 'Culture & Talent', linkedInitiatives: [{ id: 'i4', name: 'Culture & Talent' }], linkedInitiativesCount: 1 },
  { id: 'demo-k5', name: 'Time-to-Market (days)', description: 'Average days from concept to launch', targetValue: 45, unit: 'days', measurementFrequency: 'MONTHLY', alertDirection: 'ABOVE', isPrimary: true, sortOrder: 5, latestValue: 52, latestMeasurementDate: '2026-03-05', isOnTarget: false, createdAt: '2025-06-01T00:00:00Z', status: 'below', trend: 'down', needsEntry: false, initiativeName: 'Agile Transformation', linkedInitiatives: [{ id: 'i5', name: 'Agile Transformation' }], linkedInitiativesCount: 1 },
  { id: 'demo-k6', name: 'Cloud Migration Progress', description: 'Percentage of workloads migrated to cloud', targetValue: 80, unit: '%', measurementFrequency: 'MONTHLY', alertDirection: 'BELOW', isPrimary: false, sortOrder: 6, latestValue: 72, latestMeasurementDate: '2026-03-12', isOnTarget: false, createdAt: '2025-07-01T00:00:00Z', status: 'below', trend: 'up', needsEntry: false, initiativeName: 'Cloud Migration', linkedInitiatives: [{ id: 'i6', name: 'Cloud Migration' }], linkedInitiativesCount: 1 },
  { id: 'demo-k7', name: 'Cost Savings (cumulative)', description: 'Total cost savings from optimization initiatives', targetValue: 2500000, unit: 'PLN', measurementFrequency: 'MONTHLY', alertDirection: 'BELOW', isPrimary: true, sortOrder: 7, latestValue: 2180000, latestMeasurementDate: '2026-02-28', isOnTarget: false, createdAt: '2025-01-01T00:00:00Z', status: 'below', trend: 'up', needsEntry: true, initiativeName: 'Cost Optimization +2', linkedInitiatives: [{ id: 'i7', name: 'Cost Optimization' }, { id: 'i8', name: 'Procurement Reform' }, { id: 'i9', name: 'Energy Efficiency' }], linkedInitiativesCount: 3 },
  { id: 'demo-k8', name: 'Data Quality Index', description: 'Composite score of data completeness and accuracy', targetValue: 90, unit: '%', measurementFrequency: 'MONTHLY', alertDirection: 'BELOW', isPrimary: false, sortOrder: 8, latestValue: 91, latestMeasurementDate: '2026-03-08', isOnTarget: true, createdAt: '2025-04-01T00:00:00Z', status: 'on-target', trend: 'up', needsEntry: false, initiativeName: 'Data Governance', linkedInitiatives: [{ id: 'i10', name: 'Data Governance' }], linkedInitiativesCount: 1 },
  { id: 'demo-k9', name: 'Security Incidents (monthly)', description: 'Number of security incidents per month', targetValue: 2, unit: 'count', measurementFrequency: 'MONTHLY', alertDirection: 'ABOVE', isPrimary: false, sortOrder: 9, latestValue: null as any, latestMeasurementDate: undefined as any, isOnTarget: false, createdAt: '2025-09-01T00:00:00Z', status: 'no-data', trend: 'stable', needsEntry: true, initiativeName: 'Cybersecurity Enhancement', linkedInitiatives: [{ id: 'i11', name: 'Cybersecurity Enhancement' }], linkedInitiativesCount: 1 },
];

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

  const { openDocuments, setOpenDocuments, activeDocumentId, setActiveDocumentId } =
    useModuleOpenDocuments('results');

  const fetchKPIs = useCallback(async () => {
    setLoading(true);
    try {
      const [kpisRes, mappingsRes] = await Promise.allSettled([
        Api.get('/benefits/kpis'),
        Api.get('/benefits/kpi-mappings'),
      ]);

      const kpisPayload: any = kpisRes.status === 'fulfilled' ? (kpisRes.value as any) : null;
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
      setKpis(mapped.length > 0 ? mapped : DEMO_KPIS);
    } catch {
      setKpis(DEMO_KPIS);
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

  const commandRowContent = useMemo(() => {
    const chipBase =
      'h-8 inline-flex items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium border transition-colors whitespace-nowrap';
    const badgeBase =
      'px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums leading-none';

    if (activeTab === 'summary') {
      return (
        <div className="flex items-center gap-2">
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
        <div className="flex items-center gap-2">
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
        </div>
      );
    }

    if (activeTab === 'roi') {
      return (
        <div className="flex items-center gap-2">
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
        </div>
      );
    }

    if (activeTab === 'roi_analysis') {
      return (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('roi')}
            className={`${chipBase} bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-navy-700/60 hover:bg-white/60 dark:hover:bg-navy-900/50`}
            title={t('results.tabs.roi', 'ROI')}
          >
            <DollarSign size={14} className="text-amber-400" />
            <span>{t('results.tabs.roi', 'ROI')}</span>
          </button>
        </div>
      );
    }

    if (activeTab === 'kpi_reports') {
      return (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setKpiReportCreateNonce(Date.now())}
            className={`${chipBase} bg-primary-500/15 text-primary-300 border-primary-500/30 hover:bg-primary-500/20`}
            title={t('results.kpiReports.new', '+ New KPI report')}
          >
            <Plus size={14} />
            <span>{t('results.kpiReports.new', '+ New KPI report')}</span>
          </button>
        </div>
      );
    }

    return null;
  }, [activeFilters, activeTab, kpis, openRoiPicker, searchQuery, setKpiReportCreateNonce, t]);

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
