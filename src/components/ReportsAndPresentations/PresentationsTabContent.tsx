/**
 * PresentationsTabContent — "Prezentacje" tab
 * Triada standard (docs/ui-standards/CANON.md + 03-modules/TABLE_AND_PREVIEW_CANON.md):
 * 'table' view mode → StandardTable + StandardPreview, 1:1 with the
 * Assessment 'list' / Interview Inbox / Results KPI catalog adopters.
 * Grid view mode stays on GridView (out of scope for this pass).
 * Connected to /api/presentations/decks backend.
 */

import { Download, ExternalLink, MessageCircle } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { LoadingState } from '@/components/ui/primitives';
import { AssigneeCell } from '@/components/ui/primitives/cells';
import { EntityStatusChip, statusChipTone } from '@/components/ui/primitives/chips';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';

import { type FilterChip, type GridItem, GridView, type ViewMode } from '../shared/ModuleHub';
import {
  type MetaPill,
  StandardPreview,
  type StandardRowMenu,
  StandardTable,
  type TableColumn as StandardTableColumn,
} from '../standard';
import { appendArtifactOpenAction, resolveArtifactOpenPath } from './artifactNavigation';
import { displayLabel } from './TrustStatePreviewSection';
import { PRESENTATION_STATUS_META, type PresentationItem, SOURCE_TYPE_META } from './types';
import type { useRapActions } from './useRapData';
import { useTrustState } from './useTrustState';

interface PresentationsTabContentProps {
  viewMode: ViewMode;
  searchQuery: string;
  activeFilters: FilterChip[];
  onFilterChange: (filters: FilterChip[]) => void;
  presentations: PresentationItem[];
  loading: boolean;
  error?: string | null;
  onRefresh: () => void;
  actions: ReturnType<typeof useRapActions>;
  initialArtifactId?: string | null;
}

export const PresentationsTabContent: React.FC<PresentationsTabContentProps> = ({
  viewMode,
  searchQuery,
  activeFilters,
  onFilterChange,
  presentations,
  loading,
  error,
  onRefresh,
  actions,
  initialArtifactId,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const navigate = useNavigate();
  const openChatWithContext = useOpenChatWithContext();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const deepLinkConsumed = useRef(false);
  const [reviewBusyArtifactId, setReviewBusyArtifactId] = useState<string | null>(null);

  const filteredData = useMemo(() => {
    let data = presentations;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((item) => item.title.toLowerCase().includes(q));
    }
    for (const f of activeFilters) {
      if (f.column === 'sourceType') data = data.filter((item) => item.sourceType === f.value);
      if (f.column === 'status') data = data.filter((item) => item.status === f.value);
      if (f.column === 'presentationMode')
        data = data.filter((item) => (item.presentationMode || 'briefing') === f.value);
    }
    return data;
  }, [presentations, searchQuery, activeFilters]);

  const columns: StandardTableColumn[] = useMemo(
    () => [
      {
        id: 'title',
        label: t('rap.columns.title', 'Tytuł'),
        width: '300px',
        render: (row: Record<string, unknown>) => {
          const item = row as unknown as PresentationItem;
          return (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-6 rounded bg-c-surface-raised border border-c-border-subtle shrink-0 flex items-center justify-center">
                <span className="text-[8px] font-bold text-c-text-muted">PPT</span>
              </div>
              <span className="text-sm font-semibold text-c-text truncate">{item.title}</span>
            </div>
          );
        },
      },
      {
        id: 'sourceType',
        label: t('rap.columns.source', 'Źródło'),
        width: '130px',
        filterable: true,
        filterOptions: [
          { value: 'tool', label: t('reports.tool') },
          { value: 'assessment', label: t('reports.assessment') },
          { value: 'finance', label: t('reports.finance') },
          { value: 'upload', label: t('reports.upload') },
        ],
        render: (row: Record<string, unknown>) => {
          const item = row as unknown as PresentationItem;
          const meta = SOURCE_TYPE_META[item.sourceType] || SOURCE_TYPE_META.tool;
          return (
            <span className="text-xs font-medium text-c-text-secondary">
              {isPolish ? meta.labelPl : meta.label}
            </span>
          );
        },
      },
      {
        id: 'owner',
        label: t('rap.columns.owner', 'Właściciel'),
        width: '160px',
        render: (row: Record<string, unknown>) => {
          const item = row as unknown as PresentationItem;
          return (
            <AssigneeCell
              name={item.owner || null}
              unassignedLabel={t('common.unassigned', 'Unassigned')}
            />
          );
        },
      },
      {
        id: 'status',
        label: t('rap.columns.status', 'Status'),
        width: '120px',
        filterable: true,
        filterOptions: [
          { value: 'draft', label: t('reports.draft') },
          { value: 'generated', label: t('reports.generated') },
          { value: 'editing', label: t('reports.editing') },
          { value: 'ready', label: t('reports.ready2') },
          { value: 'shared', label: t('reports.shared2') },
          { value: 'archived', label: t('reports.archived2') },
        ],
        render: (row: Record<string, unknown>) => {
          const item = row as unknown as PresentationItem;
          const meta = PRESENTATION_STATUS_META[item.status] || PRESENTATION_STATUS_META.draft;
          return (
            <EntityStatusChip status={item.status} label={isPolish ? meta.labelPl : meta.label} />
          );
        },
      },
      {
        id: 'presentationMode',
        label: t('rap.columns.mode', 'Mode'),
        width: '120px',
        filterable: true,
        filterOptions: [
          { value: 'show', label: 'Show' },
          { value: 'document', label: 'Document' },
          { value: 'briefing', label: 'Briefing' },
          { value: 'workshop', label: 'Workshop' },
        ],
        render: (row: Record<string, unknown>) => {
          const item = row as unknown as PresentationItem;
          return (
            <span className="text-xs font-medium text-c-text-secondary capitalize">
              {item.presentationMode || 'briefing'}
            </span>
          );
        },
      },
      {
        id: 'createdAt',
        label: t('rap.columns.date', 'Data'),
        width: '130px',
        sortable: true,
        sortAccessor: (row: Record<string, unknown>) => {
          const item = row as unknown as PresentationItem;
          return item.createdAt ? new Date(item.createdAt).getTime() : 0;
        },
        render: (row: Record<string, unknown>) => {
          const item = row as unknown as PresentationItem;
          const d = new Date(item.createdAt);
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
        id: 'slideCount',
        label: t('rap.columns.slides', 'Slajdy'),
        width: '90px',
        align: 'right' as const,
        render: (row: Record<string, unknown>) => {
          const item = row as unknown as PresentationItem;
          return (
            <span className="text-sm tabular-nums text-c-text-secondary">
              {item.slideCount ?? '—'}
            </span>
          );
        },
      },
    ],
    [t, isPolish]
  );

  const openPresentation = (row: PresentationItem) => {
    const openPath = resolveArtifactOpenPath({
      kind: 'presentation',
      originRecordId: row.id,
      governance: row.governance,
    });
    if (openPath) navigate(openPath);
  };

  const openShare = (row: PresentationItem) => {
    const sharePath = appendArtifactOpenAction(
      resolveArtifactOpenPath({
        kind: 'presentation',
        originRecordId: row.id,
        governance: row.governance,
      }),
      'share'
    );
    if (sharePath) navigate(sharePath);
  };

  const openRename = (row: PresentationItem) => {
    const renamePath = appendArtifactOpenAction(
      resolveArtifactOpenPath({
        kind: 'presentation',
        originRecordId: row.id,
        governance: row.governance,
      }),
      'rename'
    );
    if (renamePath) navigate(renamePath);
  };

  // Triada standard (StandardTable rowMenu contract, ANEKS #4): module declares
  // ONLY blocks 1-3 (primary/statusTransitions/timeActions); StandardTable
  // itself appends block 4 (Open preview · Edit · Archive) and block 5
  // (Delete, danger, always last).
  const getRowMenu = (row: PresentationItem): StandardRowMenu => ({
    primary: [
      {
        id: 'open',
        label: t('rap.actions.open', 'Otwórz'),
        icon: ExternalLink,
        onClick: () => openPresentation(row),
      },
      {
        id: 'discuss',
        label: t('rap.actions.discuss', 'Discuss'),
        icon: MessageCircle,
        onClick: () => {
          void openChatWithContext({
            entityType: 'presentation',
            entityId: row.id,
            entityName: row.title,
          });
        },
      },
      {
        id: 'export',
        label: t('rap.actions.exportPptx', 'Eksportuj PPTX'),
        icon: Download,
        onClick: () => actions.exportDeckPptx(row),
      },
      {
        id: 'share',
        label: t('rap.actions.share', 'Udostępnij'),
        onClick: () => openShare(row),
      },
    ],
    universalHandlers: {
      preview: () => setSelectedId(row.id),
      // Rename = closest live analog to "Edit" for a presentation record
      // (no in-place field editor; opens the editor with rename UI armed).
      edit: () => openRename(row),
      // canon §14: Archive = soft-delete (reversible) — real endpoint
      // (`archiveDeck`, DELETE /presentations/decks/:id).
      archive: async () => {
        const ok = await actions.archiveDeck(row);
        if (ok) onRefresh();
      },
    },
    // No separate hard-delete endpoint exists beyond archive/DELETE above —
    // destructive stays disabled with "Coming soon (backend)" note (StandardTable
    // default) rather than wiring the same call twice under two labels.
  });

  useEffect(() => {
    if (!initialArtifactId || deepLinkConsumed.current || filteredData.length === 0) return;
    const match = filteredData.find(
      (r) => r.artifactId === initialArtifactId || r.id === initialArtifactId
    );
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

  if (loading) {
    return <LoadingState variant="spinner" className="h-64" />;
  }

  if (error && presentations.length === 0 && !searchQuery && activeFilters.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="w-full max-w-3xl rounded-2xl border border-amber-200/70 dark:border-amber-400/20 bg-amber-50/80 dark:bg-amber-500/10 p-6">
          <div className="text-lg font-semibold text-c-text">
            {t('rap.errors.realPresentationsTitle', 'Real presentations source needs attention')}
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

  if (viewMode === 'grid') {
    const gridItems: GridItem[] = filteredData.map((item) => ({
      id: item.id,
      name: item.title,
      type: item.sourceType,
      typeColor:
        item.sourceType === 'tool'
          ? 'strategic'
          : item.sourceType === 'assessment'
            ? 'digital'
            : 'operational',
      status: item.status.toUpperCase(),
      progress: 0,
      updatedAt: item.updatedAt,
      description: `${item.slideCount} ${t('reports.slides')}`,
      owner: item.owner,
    }));

    return (
      <GridView
        items={gridItems}
        selectedItemId={selectedId}
        onItemClick={(item) => setSelectedId(item.id)}
        emptyMessage={t('rap.empty.presentations', 'Brak prezentacji')}
        newItemLabel={t('rap.actions.newPresentation', 'Nowa prezentacja')}
      />
    );
  }

  // Triada standard (docs/ui-standards/CANON.md + 03-modules/TABLE_AND_PREVIEW_CANON.md):
  // 'table' view → StandardTable + StandardPreview, 1:1 with the Assessment
  // 'list' / Interview Inbox / Results KPI catalog adopters. Module declares
  // ONLY data + rowMenu/preview contract; all chrome comes from Standard* facades.
  const previewMeta: MetaPill[] | undefined = previewItem
    ? [
        {
          label: isPolish
            ? (PRESENTATION_STATUS_META[previewItem.status] || PRESENTATION_STATUS_META.draft)
                .labelPl
            : (PRESENTATION_STATUS_META[previewItem.status] || PRESENTATION_STATUS_META.draft)
                .label,
          tone: statusChipTone(previewItem.status),
        },
        {
          label: isPolish
            ? SOURCE_TYPE_META[previewItem.sourceType]?.labelPl || previewItem.sourceType
            : SOURCE_TYPE_META[previewItem.sourceType]?.label || previewItem.sourceType,
          tone: 'neutral',
        },
        // FALA 1 / „surowe identyfikatory w UI" (2026-07-27): ta pigułka
        // wypisywała goły enum `attention_required`, podczas gdy zakładki
        // All/Documents/Sheets renderują ten sam stan przez
        // TrustStatePreviewSection → „Attention Required". Powód rozjazdu:
        // dwie niezależne drogi renderowania tej samej wartości. Teraz obie
        // korzystają z `displayLabel` z TrustStatePreviewSection.
        ...(previewItem.governance?.validationState
          ? [
              {
                label: displayLabel(previewItem.governance.validationState),
                tone:
                  previewItem.governance.validationState === 'validated'
                    ? ('success' as const)
                    : previewItem.governance.validationState === 'attention_required'
                      ? ('danger' as const)
                      : ('warning' as const),
              },
            ]
          : []),
      ]
    : undefined;

  return (
    <div className="h-full overflow-hidden">
      <div className="h-full flex overflow-hidden">
        <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
          <StandardTable
            columns={columns}
            data={filteredData as unknown as Array<Record<string, unknown> & { id: string }>}
            selectedRowId={selectedId}
            onRowClick={(row) => setSelectedId(String((row as unknown as PresentationItem).id))}
            onRowDoubleClick={(row) => openPresentation(row as unknown as PresentationItem)}
            rowDescription={() => null}
            defaultSort={{ columnId: 'createdAt', direction: 'desc' }}
            persistKey="rap.presentations.list"
            activeFilters={activeFilters}
            onFilterChange={onFilterChange}
            empty={{
              title: t('rap.empty.presentations', 'Brak prezentacji'),
            }}
            rowMenu={(row) => getRowMenu(row as unknown as PresentationItem)}
          />
        </div>

        {previewItem ? (
          <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
            <StandardPreview
              title={previewItem.title || t('rap.columns.title', 'Prezentacja')}
              onClose={() => setSelectedId(null)}
              onOpenFull={() => openPresentation(previewItem)}
              meta={previewMeta ? { pills: previewMeta } : undefined}
              details={{
                showWordCount: false,
                text: [
                  `${t('rap.columns.owner', 'Właściciel')}: ${previewItem.owner || '—'}`,
                  `${t('rap.columns.slides', 'Slajdy')}: ${previewItem.slideCount ?? '—'}`,
                  `${t('common.updated', 'Updated')}: ${
                    previewItem.updatedAt
                      ? new Date(previewItem.updatedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '—'
                  }`,
                ].join('\n'),
                onCopy: () => {
                  void navigator.clipboard?.writeText(
                    `${previewItem.title} — ${previewItem.status} (${previewItem.slideCount ?? '—'} slides)`
                  );
                },
                onExport: () => actions.exportDeckPptx(previewItem),
                exportLabel: t('rap.actions.exportPptx', 'Eksportuj PPTX'),
              }}
              ai={{
                hints: [t('rap.actions.discuss', 'Discuss')],
                disabled: true,
                disabledTooltip: t('common.comingSoon', 'Coming soon'),
              }}
              relations={
                previewItem.sourceId
                  ? [{ label: `${t('rap.columns.source', 'Źródło')}: ${previewItem.sourceId}` }]
                  : []
              }
              actions={{
                resolutions: previewItem.artifactId
                  ? [
                      {
                        id: 'start-review',
                        variant: 'positive',
                        label: t('rap.actions.startReview', 'Start review'),
                        onClick: async () => {
                          const aid = previewItem.artifactId as string;
                          setReviewBusyArtifactId(aid);
                          const ok = await actions.startArtifactReview(aid);
                          setReviewBusyArtifactId(null);
                          if (ok) onRefresh();
                        },
                        disabled: reviewDisabled,
                      },
                    ]
                  : undefined,
                informational: [
                  {
                    id: 'share',
                    variant: 'neutral',
                    label: t('rap.actions.share', 'Udostępnij'),
                    onClick: () => openShare(previewItem),
                  },
                ],
              }}
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
};
