import { Copy, ExternalLink, Link2, Pencil, Sparkles, Target, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { type RowAction, RowActionsMenu } from '@/components/shared/RowActionsMenu';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { useConversationStore } from '@/store/useConversationStore';

import type { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import {
  FilterableTable,
  type TableColumn,
  type TableRow,
} from '../shared/ModuleHub/FilterableTable';
import { TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import type { KPIStatus, KPITrend, ResultsKPI } from './ResultsHub';

const STATUS_STYLES: Record<KPIStatus, { bg: string; text: string; dot: string }> = {
  'on-target': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  below: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-500' },
  'no-data': { bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-400' },
};

const TREND_LABELS: Record<KPITrend, string> = {
  up: 'Up',
  down: 'Down',
  stable: 'Stable',
};

const StatusPill: React.FC<{ status: KPIStatus; label: string }> = ({ status, label }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES['no-data'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${s.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      <span className={`text-xs font-medium ${s.text}`}>{label}</span>
    </span>
  );
};

const DeviationPill: React.FC<{ severity: 'AMBER' | 'RED'; label: string }> = ({
  severity,
  label,
}) => {
  const isRed = severity === 'RED';
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full',
        isRed ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400 dark:text-amber-300',
      ].join(' ')}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isRed ? 'bg-red-500' : 'bg-amber-500'}`} />
      <span className="text-xs font-medium">{label}</span>
    </span>
  );
};

const ValueCell: React.FC<{ value?: number | null; unit?: string; status?: KPIStatus }> = ({
  value,
  unit,
  status,
}) => {
  if (value == null) return <span className="text-sm text-slate-500">—</span>;
  const color =
    status === 'on-target'
      ? 'text-emerald-400'
      : status === 'below'
        ? 'text-red-400'
        : 'text-slate-300';
  return (
    <span className={`text-sm font-medium ${color}`}>
      {value.toLocaleString()}
      {unit ? <span className="ml-0.5 text-xs text-slate-500">{unit}</span> : null}
    </span>
  );
};

export interface ResultsKpisTableV3Props {
  kpis: ResultsKPI[];
  activeFilters: FilterChip[];
  onFilterChange: (filters: FilterChip[]) => void;
  onOpenKpi: (kpiId: string) => void;
  onDeleteKpi?: (kpiId: string) => void | Promise<void>;
}

type PreviewKpi = ResultsKPI & { title: string };

export const ResultsKpisTableV3: React.FC<ResultsKpisTableV3Props> = ({
  kpis,
  activeFilters,
  onFilterChange,
  onOpenKpi,
  onDeleteKpi,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const openChatWithContext = useOpenChatWithContext();
  const addChatMessage = useConversationStore((s) => s.addMessage);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const list: PreviewKpi[] = useMemo(() => {
    // Keep it stable and “clean” by default.
    return [...kpis]
      .map((k) => ({ ...k, title: k.name }))
      .sort((a, b) =>
        String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
      );
  }, [kpis]);

  const selectedItem = useMemo(
    () => (selectedId ? (list.find((k) => k.id === selectedId) ?? null) : null),
    [list, selectedId]
  );

  const itemIds = useMemo(() => list.map((k) => k.id), [list]);

  const rows: TableRow[] = useMemo(() => {
    return list.map((k) => ({
      id: k.id,
      type: 'KPI',
      name: k.name,
      initiativeName:
        k.initiativeName ||
        (k.linkedInitiativesCount && k.linkedInitiatives?.length
          ? k.linkedInitiativesCount === 1
            ? k.linkedInitiatives[0]?.name
            : `${k.linkedInitiatives[0]?.name} +${k.linkedInitiativesCount - 1}`
          : '—'),
      current: k.latestValue,
      target: k.targetValue,
      status: k.status,
      trend: k.trend,
      needsEntry: k.needsEntry ? 'yes' : 'no',
      measurementFrequency: k.measurementFrequency,
      updatedAt: k.latestMeasurementDate || k.createdAt,
      _raw: k,
    }));
  }, [list]);

  const statusFilterOptions = useMemo(
    () => [
      {
        value: 'on-target',
        label: t('results.status.onTarget', 'On target'),
        color: 'bg-emerald-500',
      },
      { value: 'below', label: t('results.status.below', 'Below target'), color: 'bg-red-500' },
      { value: 'no-data', label: t('results.status.noData', 'No data'), color: 'bg-slate-400' },
    ],
    [t]
  );

  const freqFilterOptions = useMemo(
    () => [
      { value: 'DAILY', label: t('common.daily', 'Daily') },
      { value: 'WEEKLY', label: t('common.weekly', 'Weekly') },
      { value: 'MONTHLY', label: t('common.monthly', 'Monthly') },
      { value: 'QUARTERLY', label: t('common.quarterly', 'Quarterly') },
    ],
    [t]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'type',
        label: t('common.type', 'Type'),
        width: '8%',
        render: () => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400">
            KPI
          </span>
        ),
      },
      {
        id: 'name',
        label: t('results.columns.name', 'Name'),
        width: '24%',
        render: (row: TableRow) => (
          <span className="text-sm font-medium text-slate-900 dark:text-white truncate block max-w-[520px]">
            {row.name || '—'}
          </span>
        ),
      },
      {
        id: 'initiativeName',
        label: t('results.columns.initiative', 'Initiative'),
        width: '18%',
        filterable: true,
        filterOptions: [
          ...new Set(
            list
              .flatMap((k) => [k.initiativeName, ...(k.linkedInitiatives || []).map((i) => i.name)])
              .filter(Boolean) as string[]
          ),
        ].map((n) => ({ value: n, label: n })),
        render: (row: TableRow) => (
          <span className="text-sm text-primary-400 truncate block max-w-[260px]">
            {row.initiativeName || '—'}
          </span>
        ),
      },
      {
        id: 'current',
        label: t('results.columns.current', 'Current'),
        width: '12%',
        render: (row: TableRow) => {
          const k = row._raw as ResultsKPI;
          return <ValueCell value={k.latestValue} unit={k.unit} status={k.status} />;
        },
      },
      {
        id: 'target',
        label: t('results.columns.target', 'Target'),
        width: '12%',
        render: (row: TableRow) => {
          const k = row._raw as ResultsKPI;
          return <ValueCell value={k.targetValue} unit={k.unit} status="no-data" />;
        },
      },
      {
        id: 'status',
        label: t('results.columns.status', 'Status'),
        width: '12%',
        filterable: true,
        filterOptions: statusFilterOptions,
        render: (row: TableRow) => {
          const k = row._raw as ResultsKPI;
          const label =
            k.status === 'on-target'
              ? t('results.status.onTarget', 'On target')
              : k.status === 'below'
                ? t('results.status.below', 'Below target')
                : t('results.status.noData', 'No data');
          return <StatusPill status={k.status} label={label} />;
        },
      },
      {
        id: 'trend',
        label: t('results.columns.trend', 'Trend'),
        width: '10%',
        filterable: true,
        filterOptions: [
          { value: 'up', label: t('results.trend.up', 'Up') },
          { value: 'down', label: t('results.trend.down', 'Down') },
          { value: 'stable', label: t('results.trend.stable', 'Stable') },
        ],
        render: (row: TableRow) => {
          const k = row._raw as ResultsKPI;
          return (
            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-slate-500/10 text-slate-400">
              {TREND_LABELS[k.trend] || '—'}
            </span>
          );
        },
      },
      {
        id: 'needsEntry',
        label: t('results.columns.needsEntry', 'Needs entry'),
        width: '12%',
        filterable: true,
        filterOptions: [
          { value: 'yes', label: t('common.yes', 'Yes') },
          { value: 'no', label: t('common.no', 'No') },
        ],
        render: (row: TableRow) => {
          const k = row._raw as ResultsKPI;
          const v = Boolean(k.needsEntry);
          return v ? (
            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-amber-500/10 text-amber-300">
              {t('results.needsEntry.badge', 'Needs entry')}
            </span>
          ) : (
            <span className="text-slate-500">—</span>
          );
        },
      },
      {
        id: 'measurementFrequency',
        label: t('results.columns.frequency', 'Frequency'),
        width: '12%',
        filterable: true,
        filterOptions: freqFilterOptions,
        render: (row: TableRow) => (
          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-slate-500/10 text-slate-400">
            {String(row.measurementFrequency || '—')
              .toLowerCase()
              .replace(/^\w/, (c) => c.toUpperCase())}
          </span>
        ),
      },
      {
        id: 'updatedAt',
        label: t('common.updated', 'Updated'),
        width: '12%',
      },
    ],
    [t, list, statusFilterOptions, freqFilterOptions]
  );

  const openAiChat = async (kpi: PreviewKpi, promptText: string) => {
    try {
      const convId = await openChatWithContext({
        entityType: 'kpi',
        entityId: kpi.id,
        entityName: kpi.name,
        contextData: kpi as unknown as Record<string, unknown>,
        pmoContext: {},
      });
      await addChatMessage({ conversationId: convId, role: 'user', content: promptText } as any);
      toast.success(t('common.chatOpened', 'Chat opened'), { duration: 1500 });
    } catch {
      toast.error(t('common.chatOpenError', 'Failed to open chat'));
    }
  };

  return (
    <TableWithPreviewLayout<PreviewKpi>
      selectedId={selectedId}
      selectedItem={selectedItem}
      onSelect={(id) => {
        setSelectedId(id);
        setDetailsExpanded(false);
      }}
      onOpenFull={(id) => onOpenKpi(id)}
      itemIds={itemIds}
      renderPreview={(kpi) => (
        <div className="space-y-4">
          {/* Brief / meta card (KANON v3) */}
          <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-700 dark:text-slate-200">
                  KPI
                </span>
                {kpi.openDeviationCase?.severity ? (
                  <DeviationPill
                    severity={kpi.openDeviationCase.severity}
                    label={
                      kpi.openDeviationCase.severity === 'RED'
                        ? t('results.deviation.red', 'Deviation (Red)')
                        : t('results.deviation.amber', 'Deviation (Amber)')
                    }
                  />
                ) : null}
                <StatusPill
                  status={kpi.status}
                  label={
                    kpi.status === 'on-target'
                      ? t('results.status.onTarget', 'On target')
                      : kpi.status === 'below'
                        ? t('results.status.below', 'Below target')
                        : t('results.status.noData', 'No data')
                  }
                />
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                  {t('results.columns.trend', 'Trend')}: {TREND_LABELS[kpi.trend] || '—'}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                  {t('results.columns.frequency', 'Frequency')}: {kpi.measurementFrequency || '—'}
                </span>
              </div>
              <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                {kpi.latestMeasurementDate
                  ? new Date(kpi.latestMeasurementDate).toLocaleDateString()
                  : kpi.createdAt
                    ? new Date(kpi.createdAt).toLocaleDateString()
                    : '—'}
              </div>
            </div>
            {kpi.initiativeName ? (
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {t('results.columns.initiative', 'Initiative')}:&nbsp;
                {(() => {
                  const singleMapped =
                    (kpi.linkedInitiativesCount || 0) === 1 ? kpi.linkedInitiatives?.[0] : null;
                  const targetId = kpi.initiativeId || singleMapped?.id || null;
                  if (!targetId) return <span>{kpi.initiativeName}</span>;
                  return (
                    <button
                      className="text-primary-400 hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/initiatives?open=${targetId}&mode=doc`);
                      }}
                    >
                      {kpi.initiativeName}
                    </button>
                  );
                })()}
              </div>
            ) : null}
          </div>

          {/* Details (with kebab) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('common.details', 'Details')}
              </div>
              <RowActionsMenu
                iconVariant="vertical"
                actions={
                  [
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
                          kpi,
                          t(
                            'results.kpi.ai.summarizePrompt',
                            'Summarize this KPI: meaning, current status, and suggested next actions.'
                          )
                        ),
                    },
                    {
                      id: 'copy',
                      label: t('common.copy', 'Copy'),
                      icon: Copy,
                      divider: true,
                      onClick: async () => {
                        try {
                          await navigator.clipboard.writeText(
                            [
                              kpi.name,
                              '',
                              `${t('results.columns.current', 'Current')}: ${kpi.latestValue ?? '—'}`,
                              `${t('results.columns.target', 'Target')}: ${kpi.targetValue ?? '—'}`,
                              kpi.description
                                ? `${t('common.details', 'Details')}: ${kpi.description}`
                                : '',
                            ]
                              .filter(Boolean)
                              .join('\n')
                          );
                          toast.success(t('common.copied', 'Copied'));
                        } catch {
                          toast.error(t('common.copyFailed', 'Copy failed'));
                        }
                      },
                    },
                  ] as RowAction[]
                }
              />
            </div>

            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <span className="text-slate-500 dark:text-slate-400">
                {t('results.columns.current', 'Current')}
              </span>
              <span className="text-slate-900 dark:text-white">
                {kpi.latestValue != null
                  ? `${kpi.latestValue.toLocaleString()}${kpi.unit ? ` ${kpi.unit}` : ''}`
                  : '—'}
              </span>

              <span className="text-slate-500 dark:text-slate-400">
                {t('results.columns.target', 'Target')}
              </span>
              <span className="text-slate-700 dark:text-slate-200">
                {kpi.targetValue != null
                  ? `${kpi.targetValue.toLocaleString()}${kpi.unit ? ` ${kpi.unit}` : ''}`
                  : '—'}
              </span>

              <span className="text-slate-500 dark:text-slate-400">
                {t('results.columns.baseline', 'Baseline')}
              </span>
              <span className="text-slate-700 dark:text-slate-200">
                {kpi.baselineValue != null
                  ? `${kpi.baselineValue.toLocaleString()}${kpi.unit ? ` ${kpi.unit}` : ''}`
                  : '—'}
              </span>

              <span className="text-slate-500 dark:text-slate-400">
                {t('results.columns.owner', 'Owner')}
              </span>
              <span className="text-slate-700 dark:text-slate-200">{kpi.ownerName || '—'}</span>
            </div>

            <div
              className={[
                'text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap',
                detailsExpanded ? '' : 'line-clamp-6',
              ].join(' ')}
            >
              {kpi.description?.trim() || t('common.noDescription', 'No description')}
            </div>
          </div>
        </div>
      )}
      renderPreviewFooter={(kpi) => (
        <div className="space-y-0">
          {/* AI zone */}
          <div className="py-1">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                <Sparkles size={12} />
                <span className="text-[10px] font-medium uppercase tracking-wider">AI</span>
              </div>
              <RowActionsMenu
                iconVariant="vertical"
                actions={[
                  {
                    id: 'why',
                    label: t('results.kpi.ai.why', 'Why off target?'),
                    onClick: () =>
                      void openAiChat(
                        kpi,
                        t(
                          'results.kpi.ai.whyPrompt',
                          'Explain why this KPI may be off target and list 3 likely root causes.'
                        )
                      ),
                  },
                  {
                    id: 'plan',
                    label: t('results.kpi.ai.plan', 'Action plan'),
                    onClick: () =>
                      void openAiChat(
                        kpi,
                        t(
                          'results.kpi.ai.planPrompt',
                          'Create a 3-step action plan to improve this KPI, including owners and first measurement checkpoint.'
                        )
                      ),
                  },
                  {
                    id: 'measurement',
                    label: t('results.kpi.ai.measurement', 'Measurement plan'),
                    onClick: () =>
                      void openAiChat(
                        kpi,
                        t(
                          'results.kpi.ai.measurementPrompt',
                          'Propose a measurement plan: data sources, cadence, definition, and common pitfalls.'
                        )
                      ),
                  },
                ]}
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                {
                  label: t('results.kpi.ai.why', 'Why off target?'),
                  prompt: t(
                    'results.kpi.ai.whyPrompt',
                    'Explain why this KPI may be off target and list 3 likely root causes.'
                  ),
                },
                {
                  label: t('results.kpi.ai.plan', 'Action plan'),
                  prompt: t(
                    'results.kpi.ai.planPrompt',
                    'Create a 3-step action plan to improve this KPI, including owners and first measurement checkpoint.'
                  ),
                },
                {
                  label: t('results.kpi.ai.measurement', 'Measurement plan'),
                  prompt: t(
                    'results.kpi.ai.measurementPrompt',
                    'Propose a measurement plan: data sources, cadence, definition, and common pitfalls.'
                  ),
                },
              ].map((h) => (
                <button
                  key={h.label}
                  type="button"
                  onClick={() => void openAiChat(kpi, h.prompt)}
                  className="inline-flex items-center h-7 px-2.5 rounded-full text-[11px] font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-500 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors active:scale-[0.98]"
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

          {/* Relations (2 rows reserved) */}
          <div className="min-h-[4.5rem] flex flex-wrap items-start content-start gap-2 py-1">
            {kpi.initiativeName ? (
              <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-700 dark:text-slate-200">
                <span className="text-slate-500 dark:text-slate-400">
                  {t('results.columns.initiative', 'Initiative')}
                </span>
                <span className="truncate max-w-[220px] text-primary-400">
                  {kpi.initiativeName}
                </span>
              </span>
            ) : (
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {t('common.noRelations', 'No relations')}
              </span>
            )}
          </div>

          <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

          {/* Actions */}
          <div className="space-y-2.5 py-1">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => onOpenKpi(kpi.id)}
                className="inline-flex items-center justify-center gap-2 h-9 rounded-full border px-3 text-xs font-medium border-primary-500/30 bg-primary-500/10 text-primary-700 dark:text-primary-300 hover:bg-primary-500/15 transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
              >
                <ExternalLink size={14} />
                {t('common.open', 'Open')}
              </button>
              <button
                onClick={() => onOpenKpi(kpi.id)}
                className="inline-flex items-center justify-center gap-2 h-9 rounded-full border px-3 text-xs font-medium border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
              >
                <Target size={14} />
                {t('results.actions.recordValue', 'Record value')}
              </button>
            </div>
          </div>
        </div>
      )}
    >
      <FilterableTable
        columns={columns}
        data={rows}
        activeFilters={activeFilters}
        onFilterChange={onFilterChange}
        density="compact"
        canvasClassName="pl-4 pr-1.5 pt-3 pb-4"
        emptyMessage={t('results.emptyState', 'No KPIs found')}
        onRowClick={(row) => setSelectedId(row.id)}
        onRowDoubleClick={(row) => onOpenKpi(row.id)}
        getRowActions={(row) => [
          {
            id: 'open',
            label: t('common.open', 'Open'),
            icon: ExternalLink,
            variant: 'primary',
            onClick: () => onOpenKpi(row.id),
          },
          {
            id: 'record',
            label: t('results.actions.recordValue', 'Record value'),
            icon: Target,
            onClick: () => onOpenKpi(row.id),
          },
          {
            id: 'edit',
            label: t('common.edit', 'Edit'),
            icon: Pencil,
            onClick: () => onOpenKpi(row.id),
          },
          {
            id: 'links',
            label: t('results.actions.manageLinks', 'Manage links'),
            icon: Link2,
            onClick: () => onOpenKpi(row.id),
          },
          ...(onDeleteKpi
            ? ([
                {
                  id: 'delete',
                  label: t('common.delete', 'Delete'),
                  icon: Trash2,
                  variant: 'danger',
                  onClick: () => void onDeleteKpi(row.id),
                },
              ] as RowAction[])
            : []),
        ]}
      />
    </TableWithPreviewLayout>
  );
};

export default ResultsKpisTableV3;
