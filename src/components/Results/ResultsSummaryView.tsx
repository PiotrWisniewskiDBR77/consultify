import {
  BarChart3,
  CheckCircle2,
  Copy,
  DollarSign,
  ExternalLink,
  Link2,
  Link2Off,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  type ActionRow,
  type MetaPill,
  PreviewActionBar,
  PreviewAIHintStrip,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  type RelationItem,
} from '@/components/shared/PreviewPane';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { Api } from '@/services/api';
import {
  V8ResultsApi,
  shouldFallbackToLegacyResults,
  type V8ResultsDashboardSnapshot,
} from '@/services/api/v8/results';
import { useConversationStore } from '@/store/useConversationStore';

import type { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import {
  FilterableTable,
  type TableColumn,
  type TableRow,
} from '../shared/ModuleHub/FilterableTable';
import { type PreviewableItem, TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
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

export interface ResultsSummaryViewProps {
  searchQuery: string;
  activeFilters: FilterChip[];
  onFilterChange: (filters: FilterChip[]) => void;
}

interface SnapshotStatCardProps {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
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

const formatDate = (value: unknown): string => {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const SnapshotStatCard: React.FC<SnapshotStatCardProps> = ({ label, value, helper, icon }) => (
  <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/90 dark:bg-white/[0.03] px-4 py-3">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </div>
        <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{value}</div>
      </div>
      <div className="text-slate-400 dark:text-slate-300">{icon}</div>
    </div>
    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helper}</div>
  </div>
);

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
        <span className="truncate">KPI{typeof kpiCount === 'number' ? ` · ${kpiCount}` : ''}</span>
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
  const openChatWithContext = useOpenChatWithContext();
  const addChatMessage = useConversationStore((s) => s.addMessage);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SummaryInitiativeItem[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = useMemo(
    () => (selectedId ? (items.find((i) => i.id === selectedId) ?? null) : null),
    [items, selectedId]
  );

  const [showCreateKpi, setShowCreateKpi] = useState(false);
  const [createKpiInitiativeId, setCreateKpiInitiativeId] = useState<string | null>(null);
  const [roiDrawerInitiativeId, setRoiDrawerInitiativeId] = useState<string | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [v8Snapshot, setV8Snapshot] = useState<V8ResultsDashboardSnapshot | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [initiativesRes, v8SnapshotRes, catalogRes] = await Promise.allSettled([
        Api.getInitiativesByStatus('DONE'),
        V8ResultsApi.getDashboard(),
        V8ResultsApi.getKpiCatalog(),
      ]);

      const initiativesRaw: InitiativeLike[] =
        initiativesRes.status === 'fulfilled' ? (initiativesRes.value as any) : [];

      const v8Payload = v8SnapshotRes.status === 'fulfilled' ? (v8SnapshotRes.value as any) : null;
      const snapshot = v8Payload?.snapshot ?? null;
      setV8Snapshot(snapshot);

      let kpiRows: KpiMappingLike[] = [];
      if (catalogRes.status === 'fulfilled') {
        kpiRows = Array.isArray(catalogRes.value?.mappings) ? (catalogRes.value.mappings as any) : [];
      } else if (shouldFallbackToLegacyResults(catalogRes.reason)) {
        const kpiRes = await Api.get('/benefits/kpi-mappings');
        const kpiPayload = (kpiRes as any) ?? null;
        const kpiData = (kpiPayload as any)?.data ?? kpiPayload;
        kpiRows = Array.isArray((kpiData as any)?.data)
          ? (kpiData as any).data
          : Array.isArray(kpiData)
            ? kpiData
            : [];
      } else {
        throw catalogRes.reason;
      }

      const kpiCountByInitiative = new Map<string, number>();
      for (const r of kpiRows) {
        const id = String(r.initiativeId ?? r.initiative_id ?? '').trim();
        if (!id) continue;
        kpiCountByInitiative.set(id, (kpiCountByInitiative.get(id) ?? 0) + 1);
      }

      const roiPlanIds = new Set<string>();
      const roiRealizedIds = new Set<string>();
      const roiByInitiative = Array.isArray(snapshot?.roiDashboard?.byInitiative)
        ? snapshot.roiDashboard.byInitiative
        : [];
      for (const r of roiByInitiative) {
        const id = String(r.initiativeId ?? '').trim();
        if (!id) continue;
        if ((r.entryCount ?? 0) > 0) {
          roiPlanIds.add(id);
        }
        if ((r.realizedSum ?? 0) > 0) {
          roiRealizedIds.add(id);
        }
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
    } catch {
      setItems([]);
      setV8Snapshot(null);
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

  useEffect(() => {
    setDetailsExpanded(false);
  }, [selectedId]);

  const openAiChat = useCallback(
    async (i: SummaryInitiativeItem, promptText: string) => {
      try {
        const convId = await openChatWithContext({
          entityType: 'initiative',
          entityId: i.id,
          entityName: i.title,
          contextData: i as unknown as Record<string, unknown>,
          pmoContext: { initiativeIds: [i.id] },
        });
        await addChatMessage({ conversationId: convId, role: 'user', content: promptText } as any);
        toast.success(t('common.chatOpened', 'Chat opened'), { duration: 1500 });
      } catch {
        toast.error(t('common.chatOpenError', 'Failed to open chat'));
      }
    },
    [addChatMessage, openChatWithContext, t]
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
      <div className="space-y-4">
        {v8Snapshot && (
          <div className="grid grid-cols-1 gap-3 px-4 pt-4 md:grid-cols-2 xl:grid-cols-4">
            <SnapshotStatCard
              label={t('results.summary.snapshot.totalKpis', 'Governed KPIs')}
              value={String(v8Snapshot.kpiScorecard.totalKpis || 0)}
              helper={t(
                'results.summary.snapshot.totalKpisHelper',
                'Total KPIs tracked by the V8 results dashboard'
              )}
              icon={<Target size={18} />}
            />
            <SnapshotStatCard
              label={t('results.summary.snapshot.activeDeviations', 'Active deviations')}
              value={String(v8Snapshot.activeDeviationsCount || 0)}
              helper={t(
                'results.summary.snapshot.activeDeviationsHelper',
                'Open deviation records requiring monitoring attention'
              )}
              icon={<BarChart3 size={18} />}
            />
            <SnapshotStatCard
              label={t('results.summary.snapshot.realizedRoi', 'Realized ROI')}
              value={v8Snapshot.roiDashboard.totalRealized.toLocaleString()}
              helper={t(
                'results.summary.snapshot.realizedRoiHelper',
                'Aggregated realized value from governed ROI entries'
              )}
              icon={<DollarSign size={18} />}
            />
            <SnapshotStatCard
              label={t(
                'results.summary.snapshot.unresolvedReconciliations',
                'Unresolved reconciliations'
              )}
              value={String(v8Snapshot.reconciliationHealth.unresolvedCount || 0)}
              helper={t(
                'results.summary.snapshot.unresolvedReconciliationsHelper',
                'KPI-finance mismatches still waiting for reconciliation'
              )}
              icon={<TrendingUp size={18} />}
            />
          </div>
        )}

        <TableWithPreviewLayout<SummaryInitiativeItem>
          selectedId={selectedId}
          selectedItem={selectedItem}
          onSelect={setSelectedId}
          onOpenFull={(id) => openInitiative(id)}
          itemIds={itemIds}
          getItemById={(id) => filtered.find((x) => x.id === id) ?? null}
          renderPreview={(i) => {
            const detailsText = [
              `${t('common.status', 'Status')}: ${i.status || '—'}`,
              `${t('common.priority', 'Priority')}: ${i.priority || '—'}`,
              `${t('common.owner', 'Owner')}: ${i.ownerName || '—'}`,
              '',
              i.description?.trim() || t('common.noDescription', 'No description'),
            ].join('\n');
            const metaPills: MetaPill[] = [
              {
                label: t('results.summary.preview.type', 'Initiative'),
                className:
                  'border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-700 dark:text-slate-200',
              },
              {
                label: String(i.status || '—').toUpperCase(),
                className: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300',
              },
              {
                label: `${t('common.priority', 'Priority')}: ${i.priority || '—'}`,
                className: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300',
              },
            ];
            return (
              <div className="space-y-4">
                <PreviewMetaCard
                  pills={metaPills}
                  trailing={
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {formatDate(i.updatedAt)}
                    </span>
                  }
                >
                  <div className="mt-2 space-y-1">
                    <p className="text-slate-500 dark:text-slate-400">
                      {t(
                        'results.summary.preview.subtitle',
                        'Completion summary and monitoring coverage'
                      )}
                    </p>
                    <MonitoringPills
                      hasKpi={i.hasKpiMonitoring}
                      kpiCount={i.kpiCount}
                      hasRoiPlan={i.hasRoiPlan}
                      hasRoiRealized={i.hasRoiRealized}
                    />
                  </div>
                </PreviewMetaCard>

                <PreviewDetailsSection
                  text={detailsText}
                  expanded={detailsExpanded}
                  onToggleExpanded={() => setDetailsExpanded((v) => !v)}
                  customActions={[
                    {
                      id: 'toggle',
                      label: detailsExpanded
                        ? t('common.collapse', 'Collapse')
                        : t('common.expand', 'Expand'),
                      onClick: () => setDetailsExpanded((v) => !v),
                    },
                    {
                      id: 'summarize',
                      label: t('common.summarize', 'Summarize'),
                      icon: Sparkles,
                      onClick: () =>
                        void openAiChat(
                          i,
                          t(
                            'results.summary.ai.summarizePrompt',
                            'Summarize this initiative in 5 bullets and propose 3 next steps.'
                          )
                        ),
                    },
                    {
                      id: 'copy',
                      label: t('common.copy', 'Copy'),
                      icon: Copy,
                      onClick: async () => {
                        try {
                          await navigator.clipboard.writeText(
                            [i.title, '', i.description || ''].filter(Boolean).join('\n')
                          );
                          toast.success(t('common.copied', 'Copied'));
                        } catch {
                          toast.error(t('common.copyFailed', 'Copy failed'));
                        }
                      },
                    },
                  ]}
                />
              </div>
            );
          }}
          renderPreviewFooter={(i) => {
            const aiHints = [
              {
                label: t('common.summarize', 'Summarize'),
                prompt: t(
                  'results.summary.ai.summarizePrompt',
                  'Summarize this initiative in 5 bullets and propose 3 next steps.'
                ),
              },
              {
                label: t('common.risks', 'Risks'),
                prompt: t(
                  'results.summary.ai.risksPrompt',
                  'List 5 risks for this initiative (delivery + benefit realization) and propose mitigations.'
                ),
              },
              {
                label: t('common.nextSteps', 'Next steps'),
                prompt: t(
                  'results.summary.ai.nextStepsPrompt',
                  'Propose 3 next steps to improve KPI/ROI monitoring for this initiative.'
                ),
              },
            ];
            const kpiTone = i.hasKpiMonitoring
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-slate-500 dark:text-slate-400';
            const roiPlanTone = i.hasRoiPlan
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-slate-500 dark:text-slate-400';
            const roiActualTone = i.hasRoiRealized
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-slate-500 dark:text-slate-400';
            const relationItems: RelationItem[] = [
              {
                label: `KPI: ${i.hasKpiMonitoring ? i.kpiCount : '—'}`,
                tone: kpiTone,
              },
              {
                label: `ROI plan: ${i.hasRoiPlan ? '✓' : '—'}`,
                tone: roiPlanTone,
              },
              {
                label: `ROI actual: ${i.hasRoiRealized ? '✓' : '—'}`,
                tone: roiActualTone,
              },
            ];
            const actionRows: ActionRow[] = [
              {
                buttons: [
                  {
                    label: t('common.open', 'Open'),
                    icon: ExternalLink,
                    onClick: () => openInitiative(i.id),
                    colorScheme: 'primary',
                    shortcut: 'O',
                  },
                  {
                    label: t('results.summary.actions.connectKpi', 'Connect KPI'),
                    icon: Target,
                    onClick: () => {
                      setCreateKpiInitiativeId(i.id);
                      setShowCreateKpi(true);
                    },
                    colorScheme: 'neutral',
                    shortcut: 'K',
                  },
                  {
                    label: t('results.summary.actions.connectRoi', 'Connect ROI'),
                    icon: DollarSign,
                    onClick: () => setRoiDrawerInitiativeId(i.id),
                    colorScheme: 'neutral',
                  },
                  {
                    label: t('results.summary.actions.economics', 'Finanse'),
                    icon: TrendingUp,
                    onClick: () => navigate('/economics?tab=valuation'),
                    colorScheme: 'neutral',
                  },
                ],
              },
            ];
            return (
              <div className="space-y-0">
                <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.03] p-2.5">
                  <PreviewAIHintStrip
                    hints={aiHints.map((h) => h.label)}
                    onRunHint={(hint) => {
                      const match = aiHints.find((h) => h.label === hint);
                      if (match) void openAiChat(i, match.prompt);
                    }}
                  />
                </div>
                <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />
                <PreviewRelations items={relationItems} />
                <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />
                <PreviewActionBar rows={actionRows} />
              </div>
            );
          }}
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
      </div>

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
