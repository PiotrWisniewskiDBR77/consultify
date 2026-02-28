import { BarChart3, CheckCircle2, DollarSign, ExternalLink, Link2, Link2Off, Target } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Api } from '@/services/api';

import type { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import { FilterableTable, type TableColumn, type TableRow } from '../shared/ModuleHub/FilterableTable';
import { TableWithPreviewLayout, type PreviewableItem } from '../shared/TableWithPreviewLayout';
import { KPICreateModal } from './KPICreateModal';
import { ROIDetailDrawer } from './ROIDetailDrawer';

type InitiativeLike = {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  summary?: string;
  status?: string;
  priority?: string;
  ownerName?: string;
  updatedAt?: string;
  createdAt?: string;
  [key: string]: unknown;
};

type KpiMappingLike = {
  initiativeId?: string;
  initiative_id?: string;
  kpiId?: string;
  kpi_id?: string;
  [key: string]: unknown;
};

type RoiSummaryItemLike = {
  initiativeId?: string;
  hasRealized?: boolean;
  [key: string]: unknown;
};

export interface ResultsSummaryViewProps {
  searchQuery: string;
  activeFilters: FilterChip[];
  onFilterChange: (filters: FilterChip[]) => void;
}

interface SummaryInitiativeItem extends PreviewableItem {
  title: string;
  status: string;
  priority: string;
  updatedAt: string;
  description: string;
  kpiCount: number;
  hasKpiMonitoring: boolean;
  hasRoiPlan: boolean;
  hasRoiRealized: boolean;
  ownerName: string;
}

const MonitoringPills: React.FC<{
  hasKpi: boolean;
  kpiCount?: number;
  hasRoiPlan: boolean;
  hasRoiRealized: boolean;
}> = ({ hasKpi, kpiCount, hasRoiPlan, hasRoiRealized }) => {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className={[
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
          hasKpi ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400',
        ].join(' ')}
      >
        {hasKpi ? <Link2 size={12} /> : <Link2Off size={12} />}
        <span className="truncate">
          KPI{typeof kpiCount === 'number' ? ` · ${kpiCount}` : ''}
        </span>
      </span>
      <span
        className={[
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
          hasRoiPlan ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400',
        ].join(' ')}
      >
        <DollarSign size={12} />
        <span className="truncate">ROI plan</span>
      </span>
      <span
        className={[
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
          hasRoiRealized ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400',
        ].join(' ')}
      >
        <CheckCircle2 size={12} />
        <span className="truncate">ROI actual</span>
      </span>
    </div>
  );
};

export const ResultsSummaryView: React.FC<ResultsSummaryViewProps> = ({
  searchQuery,
  activeFilters,
  onFilterChange,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SummaryInitiativeItem[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = useMemo(
    () => (selectedId ? items.find((i) => i.id === selectedId) ?? null : null),
    [items, selectedId]
  );

  const [showCreateKpi, setShowCreateKpi] = useState(false);
  const [createKpiInitiativeId, setCreateKpiInitiativeId] = useState<string | null>(null);
  const [roiDrawerInitiativeId, setRoiDrawerInitiativeId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [initiativesRes, kpiRes, roiRes] = await Promise.allSettled([
        Api.getInitiativesByStatus('DONE'),
        Api.get('/benefits/kpi-mappings'),
        Api.get('/benefits/roi/portfolio/summary'),
      ]);

      const initiativesRaw: InitiativeLike[] =
        initiativesRes.status === 'fulfilled' ? (initiativesRes.value as any) : [];

      const kpiPayload = kpiRes.status === 'fulfilled' ? (kpiRes.value as any) : null;
      const kpiData = (kpiPayload as any)?.data ?? kpiPayload;
      const kpiRows: KpiMappingLike[] = Array.isArray((kpiData as any)?.data)
        ? (kpiData as any).data
        : Array.isArray(kpiData)
          ? kpiData
          : [];

      const roiPayload = roiRes.status === 'fulfilled' ? (roiRes.value as any) : null;
      const roiData = (roiPayload as any)?.data ?? roiPayload;
      const roiItems: RoiSummaryItemLike[] = Array.isArray((roiData as any)?.items)
        ? (roiData as any).items
        : [];

      const kpiCountByInitiative = new Map<string, number>();
      for (const r of kpiRows) {
        const id = String(r.initiativeId ?? r.initiative_id ?? '').trim();
        if (!id) continue;
        kpiCountByInitiative.set(id, (kpiCountByInitiative.get(id) ?? 0) + 1);
      }

      const roiPlanIds = new Set<string>();
      const roiRealizedIds = new Set<string>();
      for (const r of roiItems) {
        const id = String(r.initiativeId ?? '').trim();
        if (!id) continue;
        roiPlanIds.add(id);
        if (r.hasRealized) roiRealizedIds.add(id);
      }

      const mapped: SummaryInitiativeItem[] = (initiativesRaw || []).map((i) => {
        const title = String(i.name || i.title || '—');
        const status = String(i.status || 'DONE');
        const updatedAt = String(i.updatedAt || i.updated_at || i.createdAt || i.created_at || '');
        const description = String(i.description || i.summary || '');
        const ownerName = String(i.ownerName || i.owner || '—');
        const priority = String(i.priority || '—');

        const kpiCount = kpiCountByInitiative.get(i.id) ?? 0;
        const hasKpiMonitoring = kpiCount > 0;
        const hasRoiPlan = roiPlanIds.has(i.id);
        const hasRoiRealized = roiRealizedIds.has(i.id);

        return {
          id: String(i.id),
          title,
          status,
          updatedAt,
          description,
          ownerName,
          priority,
          kpiCount,
          hasKpiMonitoring,
          hasRoiPlan,
          hasRoiRealized,
        };
      });

      setItems(mapped);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    let list = [...items];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((i) => i.title.toLowerCase().includes(q));
    }
    return list;
  }, [items, searchQuery]);

  const tableRows: TableRow[] = useMemo(() => {
    return filtered.map((i) => ({
      id: i.id,
      type: 'INIT',
      name: i.title,
      monitoring: i.hasKpiMonitoring ? 'KPI' : '—',
      status: i.status,
      priority: i.priority,
      ownerName: i.ownerName,
      updatedAt: i.updatedAt,
      _raw: i,
    }));
  }, [filtered]);

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'type',
        label: t('common.type', 'Type'),
        width: '8%',
        render: () => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400">
            INIT
          </span>
        ),
      },
      {
        id: 'name',
        label: t('results.summary.columns.initiative', 'Initiative'),
        width: '28%',
        render: (row: TableRow) => (
          <span className="text-sm font-medium text-slate-900 dark:text-white truncate block max-w-[520px]">
            {row.name || '—'}
          </span>
        ),
      },
      {
        id: 'monitoring',
        label: t('results.summary.columns.monitoring', 'Monitoring'),
        width: '26%',
        render: (row: TableRow) => {
          const i = row._raw as SummaryInitiativeItem;
          return (
            <MonitoringPills
              hasKpi={i.hasKpiMonitoring}
              kpiCount={i.kpiCount}
              hasRoiPlan={i.hasRoiPlan}
              hasRoiRealized={i.hasRoiRealized}
            />
          );
        },
      },
      {
        id: 'ownerName',
        label: t('results.summary.columns.owner', 'Owner'),
        width: '16%',
        render: (row: TableRow) => (
          <span className="text-sm text-slate-700 dark:text-slate-200 truncate block max-w-[220px]">
            {row.ownerName || '—'}
          </span>
        ),
      },
      {
        id: 'status',
        label: t('common.status', 'Status'),
        width: '10%',
      },
      {
        id: 'updatedAt',
        label: t('common.updated', 'Updated'),
        width: '12%',
      },
    ],
    [t]
  );

  const itemIds = useMemo(() => filtered.map((i) => i.id), [filtered]);

  const openInitiative = useCallback(
    (initiativeId: string) => {
      navigate(`/initiatives?open=${encodeURIComponent(initiativeId)}&mode=doc`);
    },
    [navigate]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex items-center gap-3 text-slate-400">
          <BarChart3 size={20} className="animate-pulse" />
          <span className="text-sm">{t('common.loading', 'Loading...')}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <TableWithPreviewLayout<SummaryInitiativeItem>
        selectedId={selectedId}
        selectedItem={selectedItem}
        onSelect={setSelectedId}
        onOpenFull={(id) => openInitiative(id)}
        itemIds={itemIds}
        renderKicker={(_i) => t('results.summary.preview.kicker', 'Results monitoring')}
        renderPreview={(i) => {
          const desc = i.description?.trim();
          return (
            <div className="space-y-4 text-sm">
              <div className="space-y-1">
                <p className="text-slate-500 dark:text-slate-400">
                  {t('results.summary.preview.subtitle', 'Completion summary and monitoring coverage')}
                </p>
                <MonitoringPills
                  hasKpi={i.hasKpiMonitoring}
                  kpiCount={i.kpiCount}
                  hasRoiPlan={i.hasRoiPlan}
                  hasRoiRealized={i.hasRoiRealized}
                />
              </div>

              {desc ? (
                <p className="text-slate-700 dark:text-slate-200 line-clamp-6">{desc}</p>
              ) : (
                <p className="text-slate-500 dark:text-slate-400">
                  {t('common.noDescription', 'No description')}
                </p>
              )}

              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <span className="text-slate-500 dark:text-slate-400">{t('common.status', 'Status')}</span>
                <span className="text-slate-900 dark:text-white">{i.status || '—'}</span>

                <span className="text-slate-500 dark:text-slate-400">
                  {t('common.priority', 'Priority')}
                </span>
                <span className="text-slate-700 dark:text-slate-200">{i.priority || '—'}</span>

                <span className="text-slate-500 dark:text-slate-400">{t('common.owner', 'Owner')}</span>
                <span className="text-slate-700 dark:text-slate-200">{i.ownerName || '—'}</span>
              </div>
            </div>
          );
        }}
        renderPreviewFooter={(i) => (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => openInitiative(i.id)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-primary-500/15 text-primary-600 dark:text-primary-400 hover:bg-primary-500/25 transition-colors"
            >
              <ExternalLink size={14} />
              {t('common.open', 'Open')}
            </button>
            <button
              onClick={() => {
                setCreateKpiInitiativeId(i.id);
                setShowCreateKpi(true);
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
            >
              <Target size={14} />
              {t('results.summary.actions.connectKpi', 'Connect KPI')}
            </button>
            <button
              onClick={() => setRoiDrawerInitiativeId(i.id)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
            >
              <DollarSign size={14} />
              {t('results.summary.actions.connectRoi', 'Connect ROI')}
            </button>
          </div>
        )}
      >
        <FilterableTable
          columns={columns}
          data={tableRows}
          activeFilters={activeFilters}
          onFilterChange={onFilterChange}
          density="compact"
          canvasClassName="pl-4 pr-1.5 pt-3 pb-4"
          emptyMessage={t(
            'results.summary.empty',
            'No completed initiatives. Finish an initiative to review results monitoring.'
          )}
          onRowClick={(row) => setSelectedId(row.id)}
          onRowDoubleClick={(row) => openInitiative(row.id)}
          getRowActions={(row) => {
            const i = row._raw as SummaryInitiativeItem;
            return [
              {
                id: 'open',
                label: t('common.open', 'Open'),
                icon: ExternalLink,
                variant: 'primary',
                onClick: () => openInitiative(i.id),
              },
              {
                id: 'connect_kpi',
                label: t('results.summary.actions.connectKpi', 'Connect KPI'),
                icon: Target,
                onClick: () => {
                  setCreateKpiInitiativeId(i.id);
                  setShowCreateKpi(true);
                },
              },
              {
                id: 'connect_roi',
                label: t('results.summary.actions.connectRoi', 'Connect ROI'),
                icon: DollarSign,
                onClick: () => setRoiDrawerInitiativeId(i.id),
              },
            ];
          }}
        />
      </TableWithPreviewLayout>

      {showCreateKpi && (
        <KPICreateModal
          initialInitiativeId={createKpiInitiativeId || undefined}
          onClose={() => {
            setShowCreateKpi(false);
            setCreateKpiInitiativeId(null);
          }}
          onSuccess={() => {
            setShowCreateKpi(false);
            setCreateKpiInitiativeId(null);
            fetchData();
          }}
        />
      )}

      {roiDrawerInitiativeId && (
        <ROIDetailDrawer
          initiativeId={roiDrawerInitiativeId}
          initiativeName={items.find((x) => x.id === roiDrawerInitiativeId)?.title || ''}
          onClose={() => setRoiDrawerInitiativeId(null)}
          onSaved={fetchData}
        />
      )}
    </>
  );
};

export default ResultsSummaryView;

