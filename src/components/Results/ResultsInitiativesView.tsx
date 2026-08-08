import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronRight,
  FileText,
  ListChecks,
  Maximize2,
  Target,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  InitiativePreviewV3Footer,
  type InitiativePreviewV3Model,
} from '@/components/Initiatives/InitiativePreviewV3';
import {
  type ActionRow,
  type MetaPill,
  PreviewActionBar,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  type RelationItem,
} from '@/components/shared/PreviewPane';
import { type RowAction, RowActionsMenu } from '@/components/shared/RowActionsMenu';
import { CHIP_TONE_VAR, ChipDot } from '@/components/ui/primitives/chips/chipBase';
import { statusChipTone } from '@/components/ui/primitives/chips/EntityStatusChip';
// Neutral preview meta-pill keeps a status-colored signal dot (canon-allowed); chip bg stays neutral.
import { getStatusStyle } from '@/constants/statusColors';
import { getLocalizedStatusLabel } from '@/services/initiativeLifecycle';
import type { InitiativeStatus } from '@/types/core';
import { formatRelativeTime } from '@/utils/initiativeHelpers';

import { TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import type { ResultsTrackedInitiative } from './kpiDomain';

interface ResultsInitiativesViewProps {
  initiatives: ResultsTrackedInitiative[];
  onOpenInitiativeDocument: (initiative: ResultsTrackedInitiative) => void;
  onOpenInitiativeKpis: (initiative: ResultsTrackedInitiative) => void;
  onOpenInitiativeReports?: (initiative: ResultsTrackedInitiative) => void;
  onChangeInitiativeStatus?: (
    initiative: ResultsTrackedInitiative,
    newStatus: string
  ) => Promise<void> | void;
}

export const ResultsInitiativesView: React.FC<ResultsInitiativesViewProps> = ({
  initiatives,
  onOpenInitiativeDocument,
  onOpenInitiativeKpis,
  onOpenInitiativeReports,
  onChangeInitiativeStatus,
}) => {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const statusLabel = (status: string | null | undefined) =>
    status
      ? getLocalizedStatusLabel(status as InitiativeStatus, t)
      : t('common.unknown', 'Unknown');
  const statusOptions = useMemo(
    () => [
      'DRAFT',
      'REVIEW',
      'PROMOTED',
      'PLANNING',
      'APPROVED',
      'SCHEDULED',
      'EXECUTING',
      'BLOCKED',
      'DONE',
      'TRACKING',
      'CANCELLED',
      'ARCHIVED',
    ],
    []
  );

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
          initiative.belowTargetCount + initiative.needsEntryCount + initiative.openDeviationCount;
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
    () => (selectedId ? (previewItems.find((item) => item.id === selectedId) ?? null) : null),
    [previewItems, selectedId]
  );

  useEffect(() => {
    if (selectedIds.size === 0) return;
    const allowed = new Set(previewItems.map((item) => item.id));
    setSelectedIds((prev) => new Set(Array.from(prev).filter((id) => allowed.has(id))));
  }, [previewItems, selectedIds.size]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === previewItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(previewItems.map((item) => item.id)));
    }
  };

  const getAttentionTone = (initiative: PreviewInitiative) => {
    if (initiative.belowTargetCount > 0 || initiative.openDeviationCount > 0) {
      return 'text-danger-600 dark:text-danger-400';
    }
    if (initiative.needsEntryCount > 0) {
      return 'text-amber-600 dark:text-amber-300';
    }
    return 'text-emerald-600 dark:text-emerald-400';
  };

  const getAttentionLabel = (initiative: PreviewInitiative) => {
    if (initiative.belowTargetCount > 0 || initiative.openDeviationCount > 0) {
      return t('results.initiatives.healthAtRisk', 'At risk');
    }
    if (initiative.needsEntryCount > 0) {
      return t('results.initiatives.healthNeedsEntry', 'Needs update');
    }
    return t('results.initiatives.healthOnTrack', 'On track');
  };

  const getLifecycleNextStep = (initiative: PreviewInitiative) => {
    if (initiative.lifecycleBucket === 'in-realization') {
      return t('results.initiatives.nextStepReviewKpis', 'Review realization KPI');
    }
    return t('results.initiatives.nextStepPostReview', 'Review post-implementation KPI');
  };

  const rowActions = (initiative: PreviewInitiative): RowAction[] =>
    [
      {
        id: 'preview',
        label: t('common.preview', 'Open preview'),
        icon: ChevronRight,
        onClick: () => setSelectedId(initiative.id),
      },
      {
        id: 'open',
        label: t('common.open', 'Open'),
        icon: Maximize2,
        variant: 'primary',
        onClick: () => onOpenInitiativeDocument(initiative),
      },
      {
        id: 'open-kpi',
        label: t('results.initiatives.manageKpi', 'Manage KPI'),
        icon: BarChart3,
        onClick: () => onOpenInitiativeKpis(initiative),
      },
      {
        id: 'open-reports',
        label: t('results.initiatives.openReports', 'Open reports'),
        icon: FileText,
        onClick: () => onOpenInitiativeReports?.(initiative),
        disabled: !onOpenInitiativeReports,
      },
    ].filter((action) => !action.disabled) as RowAction[];

  const sortedItems = useMemo(
    () =>
      [...previewItems].sort((a, b) =>
        String(a.initiativeName || '').localeCompare(String(b.initiativeName || ''), undefined, {
          sensitivity: 'base',
        })
      ),
    [previewItems]
  );

  if (initiatives.length === 0) {
    return (
      <div className="p-4">
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-6">
          <div className="text-lg font-semibold text-c-text">
            {t('results.initiatives.emptyTitle', 'No tracked initiatives in this bucket')}
          </div>
          <div className="mt-2 text-sm text-c-text-secondary">
            {t(
              'results.initiatives.empty',
              'No tracked initiatives for the selected lifecycle bucket yet.'
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-c-text-muted">
            <span className="rounded-full bg-c-surface-raised px-3 py-1">
              {t('results.lifecycle.inRealization', 'In realization')}
            </span>
            <span className="rounded-full bg-c-surface-raised px-3 py-1">
              {t('results.lifecycle.realized', 'Realized')}
            </span>
            <span className="rounded-full bg-c-surface-raised px-3 py-1">
              {t('results.tabs.kpi', 'KPI')}
            </span>
            <span className="rounded-full bg-c-surface-raised px-3 py-1">
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
          if (initiative) onOpenInitiativeDocument(initiative);
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
              label: statusLabel(initiative.initiativeStatus),
              className: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
              dot: getStatusStyle(initiative.initiativeStatus).dot,
              editable: Boolean(onChangeInitiativeStatus),
              renderEditor: onChangeInitiativeStatus
                ? (onClose) => (
                    <div className="w-56 rounded-xl border border-c-border-subtle bg-c-surface-raised shadow-xl p-2">
                      <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                        {t('common.status', 'Status')}
                      </div>
                      <div className="max-h-64 overflow-auto space-y-1">
                        {statusOptions.map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => {
                              void onChangeInitiativeStatus(initiative, status);
                              onClose();
                            }}
                            className={`w-full rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                              status === initiative.initiativeStatus
                                ? 'bg-c-surface-raised text-c-text'
                                : 'text-c-text-secondary hover:bg-c-surface'
                            }`}
                          >
                            {statusLabel(status)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                : undefined,
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
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-c-text-muted">
                      {t('results.initiatives.lifecycle', 'Lifecycle')}
                    </div>
                    <div className="text-c-text">{initiative.lifecycleLabel}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-c-text-muted">{t('common.updated', 'Updated')}</div>
                    <div className="text-c-text">
                      {initiative.lastReportCreatedAt
                        ? new Date(initiative.lastReportCreatedAt).toLocaleDateString()
                        : '—'}
                    </div>
                  </div>
                </div>
              </PreviewMetaCard>

              <PreviewDetailsSection
                label={t('common.summary', 'Summary')}
                text={initiative.summaryText}
                compact
              >
                <div className="mt-3 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                    {t('results.initiatives.management', 'Initiative & KPI governance')}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-c-text-muted">
                    <div className="rounded-lg bg-c-surface-raised px-3 py-2">
                      {t('results.initiatives.status', 'Status')}:{' '}
                      {statusLabel(initiative.initiativeStatus)}
                    </div>
                    <div className="rounded-lg bg-c-surface-raised px-3 py-2">
                      {t('results.initiatives.kpis', 'Tracked KPI')}: {initiative.trackedKpiCount}
                    </div>
                    <div className="rounded-lg bg-c-surface-raised px-3 py-2">
                      {t('results.initiatives.realizationKpis', '{{count}} realization KPI', {
                        count: initiative.realizationKpiCount,
                      })}
                    </div>
                    <div className="rounded-lg bg-c-surface-raised px-3 py-2">
                      {t('results.initiatives.postImplementationKpis', '{{count}} post KPI', {
                        count: initiative.postImplementationKpiCount,
                      })}
                    </div>
                    <div className="rounded-lg bg-c-surface-raised px-3 py-2">
                      {t('results.initiatives.reports', 'Reports')}: {initiative.openReportCount}
                    </div>
                    <div className="rounded-lg bg-c-surface-raised px-3 py-2">
                      {t('results.runtime.reconciliation', 'Reconciliation')}:{' '}
                      {initiative.openDeviationCount}
                    </div>
                  </div>
                </div>
              </PreviewDetailsSection>

              <div>
                <div className="text-[11px] font-semibold text-c-text-muted uppercase tracking-wider">
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
          const initiativePreviewModel: InitiativePreviewV3Model = {
            id: initiative.initiativeId,
            name: initiative.initiativeName,
            title: initiative.initiativeName,
            status: initiative.initiativeStatus,
            summary: initiative.summaryText,
            updatedAt: initiative.lastReportCreatedAt || null,
          };
          const rows: ActionRow[] = [
            {
              columns: 2,
              buttons: [
                {
                  label: t('common.open', 'Open'),
                  icon: Maximize2,
                  colorScheme: 'primary',
                  onClick: () => onOpenInitiativeDocument(initiative),
                },
                {
                  label: t('results.initiatives.manageKpi', 'Manage KPI'),
                  icon: BarChart3,
                  colorScheme: 'neutral',
                  onClick: () => onOpenInitiativeKpis(initiative),
                },
              ],
            },
            {
              buttons: [
                {
                  label: t('results.initiatives.openReports', 'Open reports'),
                  icon: FileText,
                  colorScheme: 'neutral',
                  onClick: () => onOpenInitiativeReports?.(initiative),
                  disabled: !onOpenInitiativeReports,
                  flex: true,
                },
              ],
            },
          ];

          return (
            <InitiativePreviewV3Footer
              initiative={initiativePreviewModel}
              extraActionsSlot={<PreviewActionBar rows={rows} />}
            />
          );
        }}
      >
        <div className="pl-4 pr-1.5 pt-3 pb-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-xs text-c-text-muted">
              {t('portfolio.ai.selectionCount', '{{count}} selected', {
                count: selectedIds.size,
              })}
            </div>
          </div>

          {/* §27-exempt: TableWithPreviewLayout-coupled — checkbox selection drives the right-hand initiative preview pane; custom resizable columns + fixed minWidth layout */}
          <div className="bg-c-surface backdrop-blur border border-slate-200/60 dark:border-white/[0.03] rounded-xl overflow-x-auto">
            <table className="w-full table-fixed" style={{ minWidth: 1100 }}>
              <colgroup>
                <col className="w-10" />
                <col className="w-[320px]" />
                <col className="w-32" />
                <col className="w-28" />
                <col className="w-28" />
                <col className="w-28" />
                <col className="w-44" />
                <col className="w-28" />
                <col className="w-24" />
                <col className="w-10" />
              </colgroup>

              <thead className="sticky top-0 z-10 bg-c-surface-raised backdrop-blur-hig">
                <tr>
                  <th className="w-10 px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === sortedItems.length && sortedItems.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-c-border-subtle bg-c-surface text-c-focus-solid focus:ring-c-focus"
                    />
                  </th>
                  <th className="text-left px-4 py-2">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-c-text-muted uppercase tracking-wider">
                      {t('results.initiatives.name', 'Initiative')}
                    </div>
                  </th>
                  <th className="text-left px-4 py-2 w-32">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-c-text-muted uppercase tracking-wider">
                      {t('common.status', 'Status')}
                    </div>
                  </th>
                  <th className="text-left px-4 py-2 w-28">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-c-text-muted uppercase tracking-wider">
                      {t('results.initiatives.lifecycle', 'Lifecycle')}
                    </div>
                  </th>
                  <th className="text-left px-4 py-2 w-28">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-c-text-muted uppercase tracking-wider">
                      {t('results.initiatives.kpis', 'Tracked KPI')}
                    </div>
                  </th>
                  <th className="text-left px-4 py-2 w-28">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-c-text-muted uppercase tracking-wider">
                      {t('results.initiatives.health', 'Health')}
                    </div>
                  </th>
                  <th className="text-left px-4 py-2 w-44">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-c-text-muted uppercase tracking-wider">
                      {t('results.initiatives.nextStep', 'Next step')}
                    </div>
                  </th>
                  <th className="text-left px-4 py-2 w-28">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-c-text-muted uppercase tracking-wider">
                      {t('results.initiatives.alerts', 'Needs attention')}
                    </div>
                  </th>
                  <th className="text-left px-4 py-2 w-24">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-c-text-muted uppercase tracking-wider">
                      {t('common.updated', 'Updated')}
                    </div>
                  </th>
                  <th className="w-10 px-4 py-2" />
                </tr>
              </thead>

              <tbody className="divide-y divide-c-border-subtle">
                {sortedItems.map((initiative) => {
                  const statusTone = statusChipTone(initiative.initiativeStatus);
                  const statusDotVar =
                    statusTone === 'neutral' ? undefined : CHIP_TONE_VAR[statusTone];
                  return (
                    <tr
                      key={initiative.id}
                      className="group cursor-pointer transition-colors hover:bg-c-surface-raised"
                      onClick={() => setSelectedId(initiative.id)}
                      onDoubleClick={() => onOpenInitiativeDocument(initiative)}
                    >
                      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(initiative.id)}
                          onChange={() => toggleSelect(initiative.id)}
                          className="w-4 h-4 rounded border-c-border-subtle bg-c-surface text-c-focus-solid focus:ring-c-focus"
                        />
                      </td>

                      <td className="px-4 py-2">
                        <div className="font-medium text-sm text-c-text truncate whitespace-nowrap">
                          {initiative.initiativeName}
                        </div>
                      </td>

                      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="relative inline-flex items-center gap-1.5">
                          <ChipDot colorVar={statusDotVar} />
                          <select
                            value={initiative.initiativeStatus}
                            onChange={(e) =>
                              void onChangeInitiativeStatus?.(initiative, e.target.value)
                            }
                            className="appearance-none bg-transparent text-xs font-medium cursor-pointer pr-4 text-c-text-secondary focus:outline-none focus:ring-2 focus:ring-c-focus"
                          >
                            {statusOptions.map((status) => (
                              <option key={status} value={status}>
                                {statusLabel(status)}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={12}
                            className="absolute right-0 text-c-text-muted pointer-events-none"
                          />
                        </div>
                      </td>

                      <td className="px-4 py-2">
                        <span className="text-xs text-c-text-muted">
                          {initiative.lifecycleLabel}
                        </span>
                      </td>

                      <td className="px-4 py-2">
                        <div className="text-sm font-medium text-c-text">
                          {initiative.trackedKpiCount}
                        </div>
                        <div className="mt-1 text-xs text-c-text-muted truncate">
                          {initiative.realizationKpiCount}/{initiative.postImplementationKpiCount}{' '}
                          {t('results.initiatives.phaseSplit', 'realization/post')}
                        </div>
                      </td>

                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              initiative.attentionCount > 0
                                ? initiative.belowTargetCount > 0 ||
                                  initiative.openDeviationCount > 0
                                  ? 'bg-danger-500'
                                  : 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                          />
                          <span className="text-xs text-c-text-muted">
                            {getAttentionLabel(initiative)}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-2">
                        <div
                          className="text-xs text-c-text-muted truncate"
                          title={getLifecycleNextStep(initiative)}
                        >
                          <span className="font-medium text-c-text-secondary">
                            {getLifecycleNextStep(initiative)}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-2">
                        <div className="text-sm font-medium text-c-text">
                          {initiative.attentionCount}
                        </div>
                        <div className={`mt-1 text-xs truncate ${getAttentionTone(initiative)}`}>
                          {initiative.belowTargetCount} {t('results.filters.below', 'below')},{' '}
                          {initiative.needsEntryCount}{' '}
                          {t('results.filters.needsEntry', 'needs entry')}
                        </div>
                      </td>

                      <td className="px-4 py-2">
                        <span className="text-xs text-c-text-muted">
                          {formatRelativeTime(initiative.lastReportCreatedAt || undefined)}
                        </span>
                      </td>

                      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                        <RowActionsMenu
                          // #40 — pure-wiring bridge onto the sectional kebab contract (zero visible change).
                          iconVariant="vertical"
                          sections={[{ id: 'legacy', actions: rowActions(initiative) }]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </TableWithPreviewLayout>
    </div>
  );
};

export default ResultsInitiativesView;
