/**
 * ReportsTabContent — "Documents" tab (rap.outputs.tabs.documents)
 * Triada standard (docs/ui-standards/TRIADA_KANON.md A4-A7): table view →
 * StandardTable + StandardPreview, 1:1 with the Assessment 'list' / Interview
 * Inbox / Results KPI catalog adopters. Grid view keeps GridView (unchanged).
 * Connected to /api/report-builder backend.
 */

import { Download, ExternalLink, FileText, MessageCircle, Share2 } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  StandardPreview,
  type StandardPreviewActions,
  standardPreviewShortcuts,
  type StandardRowMenu,
  StandardTable,
  type TableColumn as StandardTableColumn,
} from '@/components/standard';
import { LoadingState, StatusChip } from '@/components/ui/primitives';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';

import { type FilterChip, type GridItem, GridView, type ViewMode } from '../shared/ModuleHub';
import { appendArtifactOpenAction, resolveArtifactOpenPath } from './artifactNavigation';
import { MATERIAL_FILE_FORMATS } from './materialFileFormat';
import { TrustStatePreviewSection } from './TrustStatePreviewSection';
import { REPORT_STATUS_META, REPORT_TYPE_META, type ReportItem } from './types';
import type { useRapActions } from './useRapData';
import { useTrustState } from './useTrustState';

interface ReportsTabContentProps {
  viewMode: ViewMode;
  searchQuery: string;
  activeFilters: FilterChip[];
  onFilterChange: (filters: FilterChip[]) => void;
  reports: ReportItem[];
  loading: boolean;
  error?: string | null;
  onRefresh: () => void;
  actions: ReturnType<typeof useRapActions>;
  initialArtifactId?: string | null;
  /**
   * Same handler as the tab's topbar "Nowy raport" (Hub's `handleNewItem` for
   * `outputs_documents`). Without this, the empty-state button rendered by
   * GridView/StandardTable when a search/filter clears the list has a label
   * but no `onNewItem`/`onAction` — StandardTable/GridView don't render a
   * button at all without one, so it silently disappeared.
   */
  onNewItem?: () => void;
}

export const ReportsTabContent: React.FC<ReportsTabContentProps> = ({
  viewMode,
  searchQuery,
  activeFilters,
  onFilterChange,
  reports,
  loading,
  error,
  onRefresh,
  actions,
  initialArtifactId,
  onNewItem,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const navigate = useNavigate();
  const openChatWithContext = useOpenChatWithContext();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const deepLinkConsumed = useRef(false);
  const [reviewBusyArtifactId, setReviewBusyArtifactId] = useState<string | null>(null);
  // Triada standard MUST #7 (StandardTable): checkbox selection → bulk mode.
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  const filteredData = useMemo(() => {
    let data = reports;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          (item.fileFormat || 'Unknown').toLowerCase().includes(q)
      );
    }
    for (const f of activeFilters) {
      if (f.column === 'reportType') data = data.filter((item) => item.reportType === f.value);
      if (f.column === 'status') data = data.filter((item) => item.status === f.value);
      if (f.column === 'fileFormat') {
        data = data.filter((item) => (item.fileFormat || 'Unknown') === f.value);
      }
    }
    return data;
  }, [reports, searchQuery, activeFilters]);

  const columns: StandardTableColumn[] = useMemo(
    () => [
      {
        id: 'title',
        label: t('rap.columns.title', 'Tytuł'),
        width: '280px',
        render: (row: ReportItem) => {
          const meta = REPORT_TYPE_META[row.reportType] || REPORT_TYPE_META.custom;
          return (
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${meta.color} bg-current/10`}
              >
                {row.reportType}
              </span>
              <span className="text-sm font-medium text-c-text truncate">{row.title}</span>
            </div>
          );
        },
      },
      {
        id: 'reportType',
        label: t('rap.columns.reportType', 'Typ'),
        width: '130px',
        filterable: true,
        filterOptions: [
          { value: 'R1', label: 'R1 — Weekly', color: 'bg-blue-400' },
          { value: 'R2', label: 'R2 — Steering', color: 'bg-blue-400' },
          { value: 'R3', label: 'R3 — Benefits', color: 'bg-emerald-400' },
          { value: 'R4', label: 'R4 — Portfolio', color: 'bg-amber-400' },
          { value: 'custom', label: 'Custom', color: 'bg-slate-400' },
        ],
        render: (row: ReportItem) => {
          const meta = REPORT_TYPE_META[row.reportType] || REPORT_TYPE_META.custom;
          return (
            <span className="text-xs font-medium text-c-text-secondary">
              {isPolish ? meta.labelPl : meta.label}
            </span>
          );
        },
      },
      {
        id: 'fileFormat',
        label: t('rap.outputs.columns.format', 'Format'),
        width: '110px',
        sortable: true,
        sortAccessor: (rawRow: Record<string, unknown>) =>
          MATERIAL_FILE_FORMATS.indexOf((rawRow as unknown as ReportItem).fileFormat || 'Unknown'),
        filterable: true,
        filterOptions: MATERIAL_FILE_FORMATS.map((format) => ({ value: format, label: format })),
        render: (rawRow: Record<string, unknown>) => (
          <span className="text-xs font-medium text-c-text-secondary">
            {(rawRow as unknown as ReportItem).fileFormat || 'Unknown'}
          </span>
        ),
      },
      {
        id: 'status',
        label: t('rap.columns.status', 'Status'),
        width: '120px',
        filterable: true,
        filterOptions: [
          { value: 'draft', label: t('reports.draft'), color: 'bg-slate-400' },
          { value: 'ready', label: t('reports.ready'), color: 'bg-emerald-400' },
          {
            value: 'exported',
            label: t('reports.exported'),
            color: 'bg-blue-400',
          },
          {
            value: 'archived',
            label: t('reports.archived'),
            color: 'bg-slate-500',
          },
        ],
        render: (row: ReportItem) => {
          const meta = REPORT_STATUS_META[row.status] || REPORT_STATUS_META.draft;
          return <StatusChip label={isPolish ? meta.labelPl : meta.label} tone={meta.tone} />;
        },
      },
      {
        id: 'owner',
        label: t('rap.columns.owner', 'Właściciel'),
        width: '160px',
      },
      {
        id: 'period',
        label: t('rap.columns.period', 'Okres'),
        width: '160px',
        render: (row: ReportItem) => {
          if (!row.periodFrom) return <span className="text-sm text-c-text-muted">—</span>;
          const from = new Date(row.periodFrom).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
            day: 'numeric',
            month: 'short',
          });
          const to = row.periodTo
            ? new Date(row.periodTo).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : '...';
          return (
            <span className="text-sm text-c-text-secondary">
              {from} — {to}
            </span>
          );
        },
      },
      {
        id: 'createdAt',
        label: t('rap.columns.date', 'Data'),
        width: '130px',
        sortable: true,
        render: (row: ReportItem) => {
          const d = new Date(row.createdAt);
          return (
            <span className="text-sm text-c-text-muted">
              {d.toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          );
        },
      },
      {
        id: 'exportFormats',
        label: t('rap.columns.exports', 'Eksporty'),
        width: '140px',
        render: (row: ReportItem) => {
          if (!row.exportFormats?.length)
            return <span className="text-sm text-c-text-muted">—</span>;
          return (
            <div className="flex items-center gap-1">
              {row.exportFormats.map((fmt) => (
                <span
                  key={fmt}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-c-surface-raised text-c-text-secondary"
                >
                  {fmt}
                </span>
              ))}
            </div>
          );
        },
      },
    ],
    [t, isPolish]
  );

  const openReport = (row: ReportItem) => {
    const openPath = resolveArtifactOpenPath({
      kind: 'document',
      originRecordId: row.id,
      governance: row.governance,
    });
    if (openPath) navigate(openPath);
  };

  // Triada standard (StandardTable rowMenu contract, ANEKS #4): moduł deklaruje
  // TYLKO bloki 1-3 (primary/statusTransitions/timeActions); StandardTable SAM
  // dokłada bloki 4 (Open preview · Edit · Archive) i 5 (Delete, disabled — brak
  // API delete dla raportów, tylko archive = soft-delete, canon §14).
  const buildRowMenu = (row: ReportItem): StandardRowMenu => ({
    primary: [
      {
        id: 'open',
        label: t('rap.actions.open', 'Otwórz'),
        icon: ExternalLink,
        onClick: () => openReport(row),
      },
      {
        id: 'discuss',
        label: t('rap.actions.discuss', 'Discuss'),
        icon: MessageCircle,
        onClick: () => {
          void openChatWithContext({
            entityType: 'report',
            entityId: row.id,
            entityName: row.title,
            pmoContext: { reportId: row.id },
          });
        },
      },
      {
        id: 'export',
        label: t('rap.actions.exportPdf', 'Eksportuj PDF'),
        icon: Download,
        onClick: () => actions.exportReportPdf(row),
      },
      {
        id: 'share',
        label: t('rap.actions.share', 'Udostępnij'),
        icon: Share2,
        onClick: () => {
          const sharePath = appendArtifactOpenAction(
            resolveArtifactOpenPath({
              kind: 'document',
              originRecordId: row.id,
              governance: row.governance,
            }),
            'share'
          );
          if (sharePath) navigate(sharePath);
        },
      },
    ],
    universalHandlers: {
      preview: () => setSelectedId(row.id),
      edit: () => openReport(row),
      // canon §14: Archive = soft-delete (reversible) — real API (archiveReport).
      archive: () => {
        void (async () => {
          const ok = await actions.archiveReport(row);
          if (ok) onRefresh();
        })();
      },
    },
    // Blok 5 (Delete): brak endpointu usuwania raportów (tylko archive) —
    // disabled z notą, StandardTable dokłada ją sama (brak destructive.onClick).
  });

  useEffect(() => {
    if (!initialArtifactId || deepLinkConsumed.current || filteredData.length === 0) return;
    const match = filteredData.find((r) => r.artifactId === initialArtifactId);
    if (match) {
      setSelectedId(match.id);
      deepLinkConsumed.current = true;
    }
  }, [initialArtifactId, filteredData]);

  const selectedItem = selectedId ? filteredData.find((i) => i.id === selectedId) || null : null;
  const selectedGovernance = useTrustState(selectedItem?.artifactId, selectedItem?.governance);
  const previewItem = selectedItem
    ? {
        ...selectedItem,
        title: selectedItem.title,
        governance: selectedGovernance || selectedItem.governance,
      }
    : null;
  const reviewDisabled =
    !previewItem?.artifactId ||
    reviewBusyArtifactId === previewItem?.artifactId ||
    (!!previewItem?.governance?.validationState &&
      previewItem.governance.validationState !== 'validated') ||
    (!!previewItem?.governance?.publishState &&
      previewItem.governance.publishState !== 'private_draft');

  // Triada standard (StandardPreview blok 6, ANEKS #5): rząd 1 = rozstrzygnięcia
  // (Start review), rząd 2 = informacyjne (Export PDF).
  const previewActions: StandardPreviewActions | undefined = previewItem
    ? {
        resolutions: previewItem.artifactId
          ? [
              {
                id: 'start-review',
                variant: 'positive',
                label: t('rap.actions.startReview', 'Rozpocznij przegląd'),
                icon: FileText,
                disabled: reviewDisabled,
                onClick: () => {
                  void (async () => {
                    const aid = previewItem.artifactId as string;
                    setReviewBusyArtifactId(aid);
                    const ok = await actions.startArtifactReview(aid);
                    setReviewBusyArtifactId(null);
                    if (ok) onRefresh();
                  })();
                },
              },
            ]
          : undefined,
      }
    : undefined;

  // Esc closes preview; single-key shortcuts active while preview open (kanon B.24/B.31,
  // 1:1 with AssessmentHub 'list' / ResultsHub KPI catalog).
  useEffect(() => {
    if (viewMode !== 'table' || !selectedId) return;
    const shortcuts = standardPreviewShortcuts(previewActions);
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable)
        return;
      if (e.key === 'Escape') {
        setSelectedId(null);
        return;
      }
      const handler = shortcuts[e.key.toUpperCase()];
      if (handler) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewMode, selectedId, previewActions]);

  if (loading) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  if (error && reports.length === 0 && !searchQuery && activeFilters.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="w-full max-w-3xl rounded-2xl border border-amber-200/70 dark:border-amber-400/20 bg-amber-50/80 dark:bg-amber-500/10 p-6">
          <div className="text-lg font-semibold text-c-text">
            {t('rap.errors.realReportsTitle', 'Real reports source needs attention')}
          </div>
          <div className="mt-2 text-sm text-c-text-secondary">{error}</div>
          <div className="mt-4 text-xs uppercase tracking-wide text-c-text-muted">
            {t(
              'rap.errors.realSourceHint',
              'No synthetic demo fallback was injected. Verify active DB, organization scope, and data-context before retrying.'
            )}
          </div>
        </div>
      </div>
    );
  }

  if (reports.length === 0 && !searchQuery && activeFilters.length === 0) {
    const canon = [
      ['R1', t('reports.weeklyExecution')],
      ['R2', t('reports.steeringCommittee')],
      ['R3', t('reports.benefitsTracking')],
      ['R4', t('reports.portfolioOverview')],
    ];

    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="w-full max-w-4xl rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-6">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-300">
              <FileText size={20} />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-semibold text-c-text">
                {t('rap.empty.reportsTitle', 'Canonical management reports')}
              </div>
              <div className="mt-1 text-sm text-c-text-secondary">
                {t(
                  'rap.empty.reportsBody',
                  'This library is organized around the V3 report canon. Start from one of the four sponsor-ready report types below.'
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            {canon.map(([code, label]) => (
              <div key={code} className="rounded-xl border border-c-border-subtle bg-c-bg p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
                  {code}
                </div>
                <div className="mt-1 text-sm font-medium text-c-text">{label}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 text-xs uppercase tracking-wide text-c-text-muted">
            {t(
              'rap.empty.reportsHint',
              'Use the topbar quick chips or create a new report to enter R1, R2, R3, or R4 flow.'
            )}
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'grid') {
    const gridItems: GridItem[] = filteredData.map((item) => ({
      id: item.id,
      name: item.title,
      type: item.reportType,
      typeColor: item.reportType === 'custom' ? 'operational' : 'strategic',
      status: item.status.toUpperCase(),
      progress: 0,
      updatedAt: item.updatedAt,
      owner: item.owner,
    }));

    return (
      <GridView
        items={gridItems}
        selectedItemId={selectedId}
        onItemClick={(item) => setSelectedId(item.id)}
        emptyMessage={t('rap.empty.reports', 'Brak raportów')}
        newItemLabel={t('rap.actions.newReport', 'Nowy raport')}
        onNewItem={onNewItem}
      />
    );
  }

  // Triada standard (docs/ui-standards/TRIADA_KANON.md A4-A7): Documents tab
  // table view → StandardTable + StandardPreview, 1:1 with the Assessment
  // 'list' / Interview Inbox / Results KPI catalog adopters (plain flex split,
  // NOT TableWithPreviewLayout — matches the established pattern).
  return (
    <div className="h-full flex overflow-hidden">
      <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
        <StandardTable
          columns={columns}
          data={filteredData as unknown as Array<Record<string, unknown> & { id: string }>}
          selectedRowId={selectedId}
          onRowClick={(row) => setSelectedId(String((row as unknown as ReportItem).id))}
          onRowDoubleClick={(row) => openReport(row as unknown as ReportItem)}
          rowDescription={() => null}
          defaultSort={{ columnId: 'createdAt', direction: 'desc' }}
          persistKey="reports.documents.list"
          activeFilters={activeFilters}
          onFilterChange={onFilterChange}
          selection={{ selectedIds: selectedRowIds, onChange: setSelectedRowIds }}
          empty={{
            icon: FileText,
            title: t('rap.empty.reportsTitle', 'Canonical management reports'),
            description: t('rap.empty.reports', 'Brak raportów'),
            actionLabel: t('rap.actions.newReport', 'Nowy raport'),
            onAction: onNewItem,
          }}
          rowMenu={(row) => buildRowMenu(row as unknown as ReportItem)}
        />
      </div>

      {previewItem ? (
        <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
          <StandardPreview
            title={previewItem.title || 'Report'}
            onClose={() => setSelectedId(null)}
            onOpenFull={() => openReport(previewItem)}
            meta={{
              pills: [
                {
                  label: isPolish
                    ? REPORT_STATUS_META[previewItem.status]?.labelPl
                    : REPORT_STATUS_META[previewItem.status]?.label,
                  tone: REPORT_STATUS_META[previewItem.status]?.tone ?? 'neutral',
                },
                {
                  label: isPolish
                    ? REPORT_TYPE_META[previewItem.reportType]?.labelPl
                    : REPORT_TYPE_META[previewItem.reportType]?.label,
                  tone: 'neutral',
                },
              ],
              trailing: (
                <span className="text-[11px] font-semibold text-c-text-secondary">
                  {previewItem.updatedAt
                    ? new Date(previewItem.updatedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '—'}
                </span>
              ),
            }}
            details={{
              showWordCount: false,
              text: [
                `${t('rap.columns.owner', 'Właściciel')}: ${previewItem.owner || '—'}`,
                `${t('rap.columns.exports', 'Eksporty')}: ${
                  previewItem.exportFormats?.length
                    ? previewItem.exportFormats.join(', ').toUpperCase()
                    : '—'
                }`,
              ].join('\n'),
              onCopy: () => {
                void navigator.clipboard?.writeText(
                  `${previewItem.title} — ${previewItem.status} (${previewItem.owner || '—'})`
                );
              },
              // canon A7.3: eksporty TYLKO w Details kebab (nie w gridzie akcji).
              onExport: () => actions.exportReportPdf(previewItem),
              exportLabel: t('rap.actions.exportPdf', 'Eksportuj PDF'),
            }}
            ai={{
              hints: [
                t('rap.preview.aiSummarize', 'Summarize report'),
                t('rap.preview.aiNextSteps', 'Suggest next steps'),
              ],
              disabled: true,
              disabledTooltip: t('common.comingSoon', 'Coming soon'),
            }}
            relations={[]}
            actions={previewActions}
          >
            <TrustStatePreviewSection
              governance={previewItem.governance}
              artifactId={previewItem.artifactId}
              exportFormats={previewItem.exportFormats}
            />
          </StandardPreview>
        </aside>
      ) : null}
    </div>
  );
};
