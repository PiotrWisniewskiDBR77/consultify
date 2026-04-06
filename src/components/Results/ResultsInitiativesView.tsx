import {
  AlertTriangle,
  BarChart3,
  FileText,
  ListChecks,
  Target,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type ActionRow,
  type MetaPill,
  PreviewActionBar,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  type RelationItem,
} from '@/components/shared/PreviewPane';

import {
  FilterableTable,
  type TableColumn,
  type TableRow,
} from '../shared/ModuleHub/FilterableTable';
import { TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import type { ResultsTrackedInitiative } from './kpiDomain';

interface ResultsInitiativesViewProps {
  initiatives: ResultsTrackedInitiative[];
  onOpenInitiativeKpis: (initiative: ResultsTrackedInitiative) => void;
  onOpenInitiativeReports?: (initiative: ResultsTrackedInitiative) => void;
}

export const ResultsInitiativesView: React.FC<ResultsInitiativesViewProps> = ({
  initiatives,
  onOpenInitiativeKpis,
  onOpenInitiativeReports,
}) => {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const getStatusStyle = (status: string) => {
    const normalized = String(status || '').toUpperCase();
    if (['EXECUTING', 'SCHEDULED', 'APPROVED'].includes(normalized)) {
      return {
        dot: normalized === 'EXECUTING' ? 'bg-blue-500' : 'bg-emerald-500',
        text: 'text-slate-700 dark:text-slate-300',
      };
    }
    if (['TRACKING', 'DONE'].includes(normalized)) {
      return { dot: 'bg-emerald-400', text: 'text-slate-700 dark:text-slate-300' };
    }
    return { dot: 'bg-slate-400', text: 'text-slate-700 dark:text-slate-300' };
  };

  type PreviewInitiative = ResultsTrackedInitiative & {
    id: string;
    title: string;
    attentionCount: number;
    lifecycleLabel: string;
    summaryText: string;
  };

  const previewItems = useMemo<PreviewInitiative[]>(
    () =>
      initiatives.map((initiative) => {
        const attentionCount =
          initiative.belowTargetCount +
          initiative.needsEntryCount +
          initiative.openDeviationCount;
        const lifecycleLabel =
          initiative.lifecycleBucket === 'in-realization'
            ? t('results.lifecycle.inRealization', 'In realization')
            : t('results.lifecycle.realized', 'Realized');

        const summaryText =
          initiative.openReportCount > 0
            ? t(
                'results.initiatives.preview.summaryWithReport',
                '{{initiative}} is currently in {{lifecycle}} with {{tracked}} KPI in observation. {{below}} KPI are below target, {{needsEntry}} need fresh entries, and the latest review artifact is "{{reportTitle}}".',
                {
                  initiative: initiative.initiativeName,
                  lifecycle: lifecycleLabel,
                  tracked: initiative.trackedKpiCount,
                  below: initiative.belowTargetCount,
                  needsEntry: initiative.needsEntryCount,
                  reportTitle: initiative.lastReportTitle || '—',
                }
              )
            : t(
                'results.initiatives.preview.summaryNoReport',
                '{{initiative}} is currently in {{lifecycle}} with {{tracked}} KPI in observation. {{below}} KPI are below target, {{needsEntry}} need fresh entries, and no KPI report has been created yet.',
                {
                  initiative: initiative.initiativeName,
                  lifecycle: lifecycleLabel,
                  tracked: initiative.trackedKpiCount,
                  below: initiative.belowTargetCount,
                  needsEntry: initiative.needsEntryCount,
                }
              );

        return {
          ...initiative,
          id: initiative.initiativeId,
          title: initiative.initiativeName,
          attentionCount,
          lifecycleLabel,
          summaryText,
        };
      }),
    [initiatives, t]
  );

  const selectedItem = useMemo(
    () => (selectedId ? previewItems.find((item) => item.id === selectedId) ?? null : null),
    [previewItems, selectedId]
  );

  const rows: TableRow[] = useMemo(
    () =>
      previewItems.map((initiative) => ({
        id: initiative.id,
        initiative: initiative.initiativeName,
        status: initiative.initiativeStatus,
        trackedKpi: initiative.trackedKpiCount,
        attention: initiative.attentionCount,
        reports: initiative.openReportCount,
        updatedAt: initiative.lastReportCreatedAt || undefined,
        _raw: initiative,
      })),
    [previewItems]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'initiative',
        label: t('results.initiatives.name', 'Initiative'),
        width: '320px',
        render: (row: TableRow) => {
          const initiative = row._raw as PreviewInitiative;
          return (
            <div className="min-w-0">
              <div className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">
                {initiative.initiativeName}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {initiative.lifecycleLabel}
              </div>
            </div>
          );
        },
      },
      {
        id: 'status',
        label: t('common.status', 'Status'),
        width: '150px',
        render: (row: TableRow) => {
          const initiative = row._raw as PreviewInitiative;
          const statusStyle = getStatusStyle(initiative.initiativeStatus);
          return (
            <div className="inline-flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusStyle.dot}`} />
              <span className={`text-xs font-medium ${statusStyle.text}`}>
                {initiative.initiativeStatus}
              </span>
            </div>
          );
        },
      },
      {
        id: 'trackedKpi',
        label: t('results.initiatives.kpis', 'Tracked KPI'),
        width: '150px',
        render: (row: TableRow) => {
          const initiative = row._raw as PreviewInitiative;
          return (
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {initiative.trackedKpiCount}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {initiative.realizationKpiCount}/{initiative.postImplementationKpiCount}{' '}
                {t('results.initiatives.phaseSplit', 'realization/post')}
              </div>
            </div>
          );
        },
      },
      {
        id: 'attention',
        label: t('results.initiatives.alerts', 'Needs attention'),
        width: '190px',
        render: (row: TableRow) => {
          const initiative = row._raw as PreviewInitiative;
          return (
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {initiative.attentionCount}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                {initiative.belowTargetCount} {t('results.filters.below', 'below')},{' '}
                {initiative.needsEntryCount} {t('results.filters.needsEntry', 'needs entry')}
              </div>
            </div>
          );
        },
      },
      {
        id: 'reports',
        label: t('results.initiatives.reports', 'Reports'),
        width: '240px',
        render: (row: TableRow) => {
          const initiative = row._raw as PreviewInitiative;
          return (
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {initiative.openReportCount}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate">
                {initiative.lastReportTitle || '—'}
              </div>
            </div>
          );
        },
      },
      {
        id: 'updatedAt',
        label: t('common.updated', 'Updated'),
        width: '120px',
      },
    ],
    [t]
  );

  if (initiatives.length === 0) {
    return (
      <div className="p-4">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] p-6">
          <div className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('results.initiatives.emptyTitle', 'No tracked initiatives in this bucket')}
          </div>
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {t(
              'results.initiatives.empty',
              'No tracked initiatives for the selected lifecycle bucket yet.'
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="rounded-full bg-slate-100 dark:bg-white/[0.06] px-3 py-1">
              {t('results.lifecycle.inRealization', 'In realization')}
            </span>
            <span className="rounded-full bg-slate-100 dark:bg-white/[0.06] px-3 py-1">
              {t('results.lifecycle.realized', 'Realized')}
            </span>
            <span className="rounded-full bg-slate-100 dark:bg-white/[0.06] px-3 py-1">
              {t('results.tabs.kpi', 'KPI')}
            </span>
            <span className="rounded-full bg-slate-100 dark:bg-white/[0.06] px-3 py-1">
              {t('results.tabs.kpiReports', 'Reports')}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const itemIds = previewItems.map((item) => item.id);

  return (
    <div className="p-4">
      <TableWithPreviewLayout<PreviewInitiative>
        selectedId={selectedId}
        selectedItem={selectedItem}
        onSelect={setSelectedId}
        onOpenFull={(id) => {
          const initiative = previewItems.find((item) => item.id === id);
          if (initiative) onOpenInitiativeKpis(initiative);
        }}
        itemIds={itemIds}
        getItemById={(id) => previewItems.find((item) => item.id === id) ?? null}
        renderPreview={(initiative) => {
          const metaPills: MetaPill[] = [
            {
              label: initiative.lifecycleLabel,
              className: 'bg-blue-500/10 text-blue-500 dark:text-blue-300',
              icon: ListChecks,
            },
            {
              label: initiative.initiativeStatus,
              className: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
              dot: getStatusStyle(initiative.initiativeStatus).dot,
            },
            {
              label: t('results.initiatives.kpiCount', '{{count}} KPI', {
                count: initiative.trackedKpiCount,
              }),
              className: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-300',
              icon: Target,
            },
            {
              label: t('results.initiatives.attentionCount', '{{count}} attention', {
                count: initiative.attentionCount,
              }),
              className: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
              icon: AlertTriangle,
            },
          ];

          const relations: RelationItem[] = [
            {
              label: t('results.initiatives.realizationKpis', '{{count}} realization KPI', {
                count: initiative.realizationKpiCount,
              }),
              type: 'kpi',
            },
            {
              label: t('results.initiatives.postImplementationKpis', '{{count}} post KPI', {
                count: initiative.postImplementationKpiCount,
              }),
              type: 'kpi',
            },
            {
              label: t('results.initiatives.belowTarget', '{{count}} below target', {
                count: initiative.belowTargetCount,
              }),
              type: 'signal',
            },
            {
              label: t('results.initiatives.needsEntryCount', '{{count}} needs entry', {
                count: initiative.needsEntryCount,
              }),
              type: 'signal',
            },
            {
              label: t('results.initiatives.reportsCount', '{{count}} reports', {
                count: initiative.openReportCount,
              }),
              type: 'report',
            },
          ].filter((item) => !item.label.startsWith('0 '));

          return (
            <div className="space-y-4">
              <PreviewMetaCard pills={metaPills}>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <div className="rounded-lg bg-slate-50/80 dark:bg-white/[0.03] px-3 py-2">
                    {t('results.initiatives.reports', 'Reports')}: {initiative.openReportCount}
                  </div>
                  <div className="rounded-lg bg-slate-50/80 dark:bg-white/[0.03] px-3 py-2">
                    {t('results.runtime.reconciliation', 'Reconciliation')}: {initiative.openDeviationCount}
                  </div>
                </div>
              </PreviewMetaCard>

              <PreviewDetailsSection
                label={t('common.summary', 'Summary')}
                text={initiative.summaryText}
                compact
              />

              <div>
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t('common.relations', 'Relations')}
                </div>
                <PreviewRelations
                  items={relations}
                  emptyLabel={t('common.noRelations', 'No relations')}
                />
              </div>
            </div>
          );
        }}
        renderPreviewFooter={(initiative) => {
          const rows: ActionRow[] = [
            {
              columns: 2,
              buttons: [
                {
                  label: t('results.initiatives.openKpis', 'Open KPI'),
                  icon: BarChart3,
                  colorScheme: 'primary',
                  onClick: () => onOpenInitiativeKpis(initiative),
                },
                {
                  label: t('results.initiatives.openReports', 'Open reports'),
                  icon: FileText,
                  colorScheme: 'neutral',
                  onClick: () => onOpenInitiativeReports?.(initiative),
                  disabled: !onOpenInitiativeReports,
                },
              ],
            },
          ];

          return <PreviewActionBar rows={rows} />;
        }}
      >
        <FilterableTable
          columns={columns}
          data={rows}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId(row.id)}
          onRowDoubleClick={(row) => {
            const initiative = row._raw as PreviewInitiative;
            onOpenInitiativeKpis(initiative);
          }}
          activeFilters={[]}
          onFilterChange={() => undefined}
          density="compact"
          canvasClassName="pl-4 pr-1.5 pt-3 pb-4"
          getRowActions={(row) => {
            const initiative = row._raw as PreviewInitiative;
            return [
              {
                id: 'open-kpi',
                label: t('results.initiatives.openKpis', 'Open KPI'),
                onClick: () => onOpenInitiativeKpis(initiative),
              },
              {
                id: 'open-reports',
                label: t('results.initiatives.openReports', 'Open reports'),
                onClick: () => onOpenInitiativeReports?.(initiative),
                divider: true,
              },
            ];
          }}
          emptyMessage={t('results.initiatives.empty', 'No tracked initiatives for the selected lifecycle bucket yet.')}
        />
      </TableWithPreviewLayout>
    </div>
  );
};

export default ResultsInitiativesView;
