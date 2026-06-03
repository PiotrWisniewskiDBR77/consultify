import {
  Bell,
  BellOff,
  Copy,
  ExternalLink,
  Link2,
  Pencil,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
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
import { type RowAction } from '@/components/shared/RowActionsMenu';
import { useOrganizationContext } from '@/hooks/discovery/useOrganizationContext';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { useConversationStore } from '@/store/useConversationStore';

import type { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import {
  FilterableTable,
  type TableColumn,
  type TableRow,
} from '../shared/ModuleHub/FilterableTable';
import { TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import type { KpiDrawerSection, KPIStatus, KPITrend, ResultsKPI } from './kpiDomain';

const STATUS_STYLES: Record<KPIStatus, { bg: string; text: string; dot: string }> = {
  'on-target': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  below: { bg: 'bg-rose-500/10', text: 'text-rose-400', dot: 'bg-rose-500' },
  'no-data': { bg: 'bg-slate-500/10', text: 'text-slate-600', dot: 'bg-slate-400' },
};

const TREND_LABELS: Record<KPITrend, string> = {
  up: 'Up',
  down: 'Down',
  stable: 'Stable',
};

const formatObservationPhase = (
  phase?: ResultsKPI['observationPhase'],
  t?: (key: string, defaultValue: string) => string
) => {
  if (phase === 'realization')
    return t?.('results.phase.realization', 'Realization') || 'Realization';
  if (phase === 'both') return t?.('results.phase.both', 'Both phases') || 'Both phases';
  return t?.('results.phase.postImplementation', 'Post-implementation') || 'Post-implementation';
};

const formatDefinitionSource = (
  source?: ResultsKPI['definitionSource'],
  t?: (key: string, defaultValue: string) => string
) =>
  source === 'library'
    ? t?.('results.kpi.source.linked', 'Linked KPI') || 'Linked KPI'
    : t?.('results.kpi.source.manual', 'Manual KPI') || 'Manual KPI';

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
        isRed
          ? 'bg-rose-500/10 text-rose-400'
          : 'bg-amber-500/10 text-amber-400 dark:text-amber-300',
      ].join(' ')}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isRed ? 'bg-rose-500' : 'bg-amber-500'}`} />
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
        ? 'text-rose-400'
        : 'text-slate-500 dark:text-slate-300';
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
  onOpenKpi: (kpiId: string, section?: KpiDrawerSection) => void;
  onDeleteKpi?: (kpiId: string) => void | Promise<void>;
  watchedKpiIds?: Set<string>;
  onToggleWatch?: (kpiId: string) => void;
}

type PreviewKpi = ResultsKPI & { title: string };

export const ResultsKpisTableV3: React.FC<ResultsKpisTableV3Props> = ({
  kpis,
  activeFilters,
  onFilterChange,
  onOpenKpi,
  onDeleteKpi,
  watchedKpiIds,
  onToggleWatch,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const openChatWithContext = useOpenChatWithContext();
  const { formatForPrompt: formatOrgContext } = useOrganizationContext();
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
      ownerName: k.ownerName || '—',
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
      { value: 'below', label: t('results.status.below', 'Below target'), color: 'bg-rose-500' },
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
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-600">
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
        width: '11%',
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
        id: 'ownerName',
        label: t('results.columns.owner', 'Owner'),
        width: '14%',
        filterable: true,
        filterOptions: Array.from(
          new Set(list.map((k) => String(k.ownerName || '').trim()).filter(Boolean))
        ).map((owner) => ({ value: owner, label: owner })),
        render: (row: TableRow) => (
          <span className="text-sm text-slate-500 dark:text-slate-400 truncate block max-w-[220px]">
            {String(row.ownerName || '—')}
          </span>
        ),
      },
      {
        id: 'status',
        label: t('results.columns.status', 'Status'),
        width: '11%',
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
        width: '9%',
        filterable: true,
        filterOptions: [
          { value: 'up', label: t('results.trend.up', 'Up') },
          { value: 'down', label: t('results.trend.down', 'Down') },
          { value: 'stable', label: t('results.trend.stable', 'Stable') },
        ],
        render: (row: TableRow) => {
          const k = row._raw as ResultsKPI;
          return (
            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-slate-500/10 text-slate-600">
              {TREND_LABELS[k.trend] || '—'}
            </span>
          );
        },
      },
      {
        id: 'needsEntry',
        label: t('results.columns.needsEntry', 'Needs entry'),
        width: '11%',
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
        width: '10%',
        filterable: true,
        filterOptions: freqFilterOptions,
        render: (row: TableRow) => (
          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-slate-500/10 text-slate-600">
            {String(row.measurementFrequency || '—')
              .toLowerCase()
              .replace(/^\w/, (c) => c.toUpperCase())}
          </span>
        ),
      },
      {
        id: 'updatedAt',
        label: t('common.updated', 'Updated'),
        width: '10%',
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
        contextData: {
          ...(kpi as unknown as Record<string, unknown>),
          organizationContext: formatOrgContext(),
        },
        pmoContext: { kpiId: kpi.id },
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
      onOpenFull={(id) => onOpenKpi(id, 'summary')}
      itemIds={itemIds}
      getItemById={(id) => list.find((x) => x.id === id) ?? null}
      renderPreview={(kpi) => {
        const statusLabel =
          kpi.status === 'on-target'
            ? t('results.status.onTarget', 'On target')
            : kpi.status === 'below'
              ? t('results.status.below', 'Below target')
              : t('results.status.noData', 'No data');
        const statusStyle = STATUS_STYLES[kpi.status] || STATUS_STYLES['no-data'];
        const metaPills: MetaPill[] = [
          {
            label: 'KPI',
            className:
              'border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-700 dark:text-slate-200',
          },
          ...(kpi.openDeviationCase?.severity
            ? [
                {
                  label:
                    kpi.openDeviationCase.severity === 'RED'
                      ? t('results.deviation.red', 'Deviation (Red)')
                      : t('results.deviation.amber', 'Deviation (Amber)'),
                  dot: kpi.openDeviationCase.severity === 'RED' ? 'bg-rose-500' : 'bg-amber-500',
                  className:
                    kpi.openDeviationCase.severity === 'RED'
                      ? 'bg-rose-500/10 text-rose-400'
                      : 'bg-amber-500/10 text-amber-400 dark:text-amber-300',
                } as MetaPill,
              ]
            : []),
          {
            label: statusLabel,
            dot: statusStyle.dot,
            className: `${statusStyle.bg} ${statusStyle.text}`,
          },
          {
            label: `${t('results.columns.trend', 'Trend')}: ${TREND_LABELS[kpi.trend] || '—'}`,
            className: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300',
          },
          {
            label: `${t('results.columns.frequency', 'Frequency')}: ${kpi.measurementFrequency || '—'}`,
            className: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300',
          },
          {
            label: formatDefinitionSource(kpi.definitionSource, t),
            className: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300',
          },
          {
            label: formatObservationPhase(kpi.observationPhase, t),
            className: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300',
          },
          ...(kpi.needsEntry
            ? [
                {
                  label: t('results.needsEntry.badge', 'Needs entry'),
                  dot: 'bg-amber-500',
                  className: 'bg-amber-500/10 text-amber-400 dark:text-amber-300',
                } as MetaPill,
              ]
            : []),
          ...(watchedKpiIds?.has(kpi.id)
            ? [
                {
                  label: t('results.filters.watched', 'Watched KPI'),
                  dot: 'bg-fuchsia-500',
                  className: 'bg-fuchsia-500/10 text-fuchsia-400 dark:text-fuchsia-300',
                } as MetaPill,
              ]
            : []),
        ];
        const metaTrailing = (
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            {kpi.latestMeasurementDate
              ? new Date(kpi.latestMeasurementDate).toLocaleDateString()
              : kpi.createdAt
                ? new Date(kpi.createdAt).toLocaleDateString()
                : '—'}
          </span>
        );
        const detailsText = [
          `${t('results.columns.current', 'Current')}: ${
            kpi.latestValue != null
              ? `${kpi.latestValue.toLocaleString()}${kpi.unit ? ` ${kpi.unit}` : ''}`
              : '—'
          }`,
          `${t('results.columns.target', 'Target')}: ${
            kpi.targetValue != null
              ? `${kpi.targetValue.toLocaleString()}${kpi.unit ? ` ${kpi.unit}` : ''}`
              : '—'
          }`,
          `${t('results.columns.baseline', 'Baseline')}: ${
            kpi.baselineValue != null
              ? `${kpi.baselineValue.toLocaleString()}${kpi.unit ? ` ${kpi.unit}` : ''}`
              : '—'
          }`,
          `${t('results.columns.phase', 'Phase')}: ${formatObservationPhase(kpi.observationPhase, t)}`,
          `${t('results.columns.source', 'Source')}: ${formatDefinitionSource(kpi.definitionSource, t)}`,
          `${t('results.kpi.realizationTarget', 'Realization target')}: ${
            kpi.realizationExpectation?.targetValue != null
              ? `${kpi.realizationExpectation.targetValue.toLocaleString()}${kpi.unit ? ` ${kpi.unit}` : ''}`
              : '—'
          }`,
          `${t('results.kpi.postImplementationTarget', 'Post-implementation target')}: ${
            kpi.postImplementationExpectation?.targetValue != null
              ? `${kpi.postImplementationExpectation.targetValue.toLocaleString()}${kpi.unit ? ` ${kpi.unit}` : ''}`
              : '—'
          }`,
          `${t('results.columns.owner', 'Owner')}: ${kpi.ownerName || '—'}`,
          '',
          kpi.description?.trim() || t('common.noDescription', 'No description'),
        ].join('\n');
        const singleMapped =
          (kpi.linkedInitiativesCount || 0) === 1 ? kpi.linkedInitiatives?.[0] : null;
        const initiativeTargetId = kpi.initiativeId || singleMapped?.id || null;
        return (
          <div className="space-y-4">
            <PreviewMetaCard pills={metaPills} trailing={metaTrailing}>
              {kpi.initiativeName ? (
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {t('results.columns.initiative', 'Initiative')}:{' '}
                  {initiativeTargetId ? (
                    <button
                      type="button"
                      className="text-primary-400 hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/initiatives?open=${initiativeTargetId}&mode=doc`);
                      }}
                    >
                      {kpi.initiativeName}
                    </button>
                  ) : (
                    <span>{kpi.initiativeName}</span>
                  )}
                </div>
              ) : null}
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
              ]}
            />
          </div>
        );
      }}
      renderPreviewFooter={(kpi) => {
        const aiHints = [
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
        ];
        const singleMapped =
          (kpi.linkedInitiativesCount || 0) === 1 ? kpi.linkedInitiatives?.[0] : null;
        const initiativeTargetId = kpi.initiativeId || singleMapped?.id;
        const relationItems: RelationItem[] = kpi.initiativeName
          ? [
              {
                label: `${t('results.columns.initiative', 'Initiative')}: ${kpi.initiativeName}`,
                tone: 'text-slate-700 dark:text-slate-200',
                onClick: initiativeTargetId
                  ? () => navigate(`/initiatives?open=${initiativeTargetId}&mode=doc`)
                  : undefined,
              },
              {
                label: `${t('results.columns.phase', 'Phase')}: ${formatObservationPhase(kpi.observationPhase, t)}`,
                tone: 'text-slate-600 dark:text-slate-300',
              },
              {
                label: `${t('results.columns.source', 'Source')}: ${formatDefinitionSource(kpi.definitionSource, t)}`,
                tone: 'text-slate-600 dark:text-slate-300',
              },
              {
                label: watchedKpiIds?.has(kpi.id)
                  ? t('results.watch.following', 'Following')
                  : t('results.watch.notFollowing', 'Not followed'),
                tone: watchedKpiIds?.has(kpi.id)
                  ? 'text-fuchsia-500 dark:text-fuchsia-300'
                  : 'text-slate-600 dark:text-slate-300',
              },
              {
                label: `${t('results.kpi.realizationTarget', 'Realization target')}: ${
                  kpi.realizationExpectation?.targetValue ?? '—'
                }${kpi.unit ? ` ${kpi.unit}` : ''}`,
                tone: 'text-slate-600 dark:text-slate-300',
              },
              {
                label: `${t('results.kpi.postImplementationTarget', 'Post-implementation target')}: ${
                  kpi.postImplementationExpectation?.targetValue ?? '—'
                }${kpi.unit ? ` ${kpi.unit}` : ''}`,
                tone: 'text-slate-600 dark:text-slate-300',
              },
            ]
          : [
              {
                label: `${t('results.columns.phase', 'Phase')}: ${formatObservationPhase(kpi.observationPhase, t)}`,
                tone: 'text-slate-600 dark:text-slate-300',
              },
              {
                label: `${t('results.columns.source', 'Source')}: ${formatDefinitionSource(kpi.definitionSource, t)}`,
                tone: 'text-slate-600 dark:text-slate-300',
              },
            ];
        const actionRows: ActionRow[] = [
          {
            buttons: [
              {
                label: t('common.open', 'Open'),
                icon: ExternalLink,
                onClick: () => onOpenKpi(kpi.id, 'summary'),
                colorScheme: 'primary',
                shortcut: 'O',
              },
              {
                label: t('results.actions.recordValue', 'Record value'),
                icon: Target,
                onClick: () => onOpenKpi(kpi.id, 'record'),
                colorScheme: 'neutral',
                shortcut: 'V',
              },
              ...(onToggleWatch
                ? [
                    {
                      label: watchedKpiIds?.has(kpi.id)
                        ? t('results.watch.unfollow', 'Unfollow KPI')
                        : t('results.watch.follow', 'Follow KPI'),
                      icon: watchedKpiIds?.has(kpi.id) ? BellOff : Bell,
                      onClick: () => onToggleWatch(kpi.id),
                      colorScheme: 'neutral' as const,
                    },
                  ]
                : []),
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
                  if (match) void openAiChat(kpi, match.prompt);
                }}
              />
            </div>
            <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />
            <PreviewRelations
              items={relationItems}
              emptyLabel={t('common.noRelations', 'No relations')}
            />
            <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />
            <PreviewActionBar rows={actionRows} />
          </div>
        );
      }}
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
        onRowDoubleClick={(row) => onOpenKpi(row.id, 'summary')}
        getRowActions={(row) => [
          {
            id: 'open',
            label: t('common.open', 'Open'),
            icon: ExternalLink,
            variant: 'primary',
            onClick: () => onOpenKpi(row.id, 'summary'),
          },
          {
            id: 'record',
            label: t('results.actions.recordValue', 'Record value'),
            icon: Target,
            onClick: () => onOpenKpi(row.id, 'record'),
          },
          ...(onToggleWatch
            ? ([
                {
                  id: 'watch',
                  label: watchedKpiIds?.has(row.id)
                    ? t('results.watch.unfollow', 'Unfollow KPI')
                    : t('results.watch.follow', 'Follow KPI'),
                  icon: watchedKpiIds?.has(row.id) ? BellOff : Bell,
                  onClick: () => onToggleWatch(row.id),
                },
              ] as RowAction[])
            : []),
          {
            id: 'edit',
            label: t('results.drawer.definitionTitle', 'Definition'),
            icon: Pencil,
            onClick: () => onOpenKpi(row.id, 'definition'),
          },
          {
            id: 'links',
            label: t('results.drawer.lineageTitle', 'Lineage'),
            icon: Link2,
            onClick: () => onOpenKpi(row.id, 'lineage'),
          },
          {
            id: 'targets',
            label: t('results.drawer.targetsTitle', 'Targets'),
            icon: Target,
            onClick: () => onOpenKpi(row.id, 'targets'),
          },
          {
            id: 'history',
            label: t('results.drawer.history', 'History'),
            icon: Copy,
            onClick: () => onOpenKpi(row.id, 'history'),
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
