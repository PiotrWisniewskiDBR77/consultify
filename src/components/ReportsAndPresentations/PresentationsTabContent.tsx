/**
 * PresentationsTabContent — "Prezentacje" tab
 * Golden standard: FilterableTable (6 columns) + GridView cards + Preview pane
 * Connected to /api/presentations/decks backend
 */

import {
  Archive,
  ChevronRight,
  Download,
  Edit,
  ExternalLink,
  MessageCircle,
  Share2,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useConfirmDialog } from '@/components/MyWork/shared/ConfirmDialog';
import { LoadingState, StatusChip } from '@/components/ui/primitives';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';

import {
  type BulkAction,
  BulkActionBar,
  FilterableTable,
  type FilterChip,
  type GridItem,
  GridView,
  type TableColumn,
  useTableSelection,
  type ViewMode,
} from '../shared/ModuleHub';
import type { RowAction } from '../shared/RowActionsMenu';
import { TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import { appendArtifactOpenAction, resolveArtifactOpenPath } from './artifactNavigation';
import { PresentationPreviewBody, PresentationPreviewFooter } from './previews/PresentationPreview';
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

  const columns: TableColumn[] = useMemo(
    () => [
      // canon §3.5 — leading selection column.
      { id: 'select', label: '', type: 'select', width: '44px' },
      {
        id: 'title',
        label: t('rap.columns.title', 'Tytuł'),
        width: '300px',
        render: (row: PresentationItem) => (
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-6 rounded bg-c-surface-raised border border-c-border-subtle shrink-0 flex items-center justify-center">
              <span className="text-[8px] font-bold text-c-text-muted">PPT</span>
            </div>
            <span className="text-sm font-medium text-c-text truncate">
              {row.title}
            </span>
          </div>
        ),
      },
      {
        id: 'sourceType',
        label: t('rap.columns.source', 'Źródło'),
        width: '130px',
        filterable: true,
        filterOptions: [
          { value: 'tool', label: t('reports.tool'), color: 'bg-emerald-400' },
          { value: 'assessment', label: t('reports.assessment'), color: 'bg-blue-400' },
          { value: 'finance', label: t('reports.finance'), color: 'bg-blue-400' },
          { value: 'upload', label: t('reports.upload'), color: 'bg-amber-400' },
        ],
        render: (row: PresentationItem) => {
          const meta = SOURCE_TYPE_META[row.sourceType] || SOURCE_TYPE_META.tool;
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
      },
      {
        id: 'status',
        label: t('rap.columns.status', 'Status'),
        width: '120px',
        filterable: true,
        filterOptions: [
          { value: 'draft', label: t('reports.draft'), color: 'bg-slate-400' },
          {
            value: 'generated',
            label: t('reports.generated'),
            color: 'bg-blue-400',
          },
          { value: 'editing', label: t('reports.editing'), color: 'bg-amber-400' },
          { value: 'ready', label: t('reports.ready2'), color: 'bg-emerald-400' },
          { value: 'shared', label: t('reports.shared2'), color: 'bg-blue-400' },
          {
            value: 'archived',
            label: t('reports.archived2'),
            color: 'bg-slate-500',
          },
        ],
        render: (row: PresentationItem) => {
          const meta = PRESENTATION_STATUS_META[row.status] || PRESENTATION_STATUS_META.draft;
          return <StatusChip label={isPolish ? meta.labelPl : meta.label} tone={meta.tone} />;
        },
      },
      {
        id: 'presentationMode',
        label: t('rap.columns.mode', 'Tryb'),
        width: '120px',
        filterable: true,
        filterOptions: [
          { value: 'show', label: 'Show', color: 'bg-blue-400' },
          { value: 'document', label: 'Document', color: 'bg-emerald-400' },
          { value: 'briefing', label: 'Briefing', color: 'bg-amber-400' },
          { value: 'workshop', label: 'Workshop', color: 'bg-blue-400' },
        ],
        render: (row: PresentationItem) => (
          <span className="text-xs font-medium text-c-text-secondary capitalize">
            {row.presentationMode || 'briefing'}
          </span>
        ),
      },
      {
        id: 'createdAt',
        label: t('rap.columns.date', 'Data'),
        width: '130px',
        sortable: true,
        render: (row: PresentationItem) => {
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
        id: 'slideCount',
        label: t('rap.columns.slides', 'Slajdy'),
        width: '90px',
        render: (row: PresentationItem) => (
          <span className="text-sm text-c-text-secondary">{row.slideCount}</span>
        ),
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

  const getRowActions = (row: PresentationItem): RowAction[] => [
    // canon §9.2 FIXED BOTTOM MANIFEST position 1
    {
      id: 'open_preview',
      label: t('rap.actions.openPreview', 'Otwórz podgląd'),
      icon: ChevronRight,
      onClick: () => setSelectedId(row.id),
    },
    {
      id: 'open',
      label: t('rap.actions.open', 'Otwórz'),
      icon: ExternalLink,
      variant: 'primary',
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
      icon: Share2,
      onClick: () => {
        const sharePath = appendArtifactOpenAction(
          resolveArtifactOpenPath({
            kind: 'presentation',
            originRecordId: row.id,
            governance: row.governance,
          }),
          'share'
        );
        if (sharePath) navigate(sharePath);
      },
    },
    {
      id: 'rename',
      label: t('rap.actions.rename', 'Zmień nazwę'),
      icon: Edit,
      onClick: () => {
        const renamePath = appendArtifactOpenAction(
          resolveArtifactOpenPath({
            kind: 'presentation',
            originRecordId: row.id,
            governance: row.governance,
          }),
          'rename'
        );
        if (renamePath) navigate(renamePath);
      },
    },
    {
      // canon §14: Archive = soft-delete (reversible) — label "Archiwizuj", NOT "Usuń"
      id: 'archive',
      label: t('rap.actions.archive', 'Archiwizuj'),
      icon: Archive,
      divider: true,
      onClick: async () => {
        const ok = await actions.archiveDeck(row);
        if (ok) onRefresh();
      },
    },
  ];

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
  const itemIds = filteredData.map((i) => i.id);

  // canon §3.5 — row selection + bulk archive (loops existing archiveDeck).
  const selection = useTableSelection(itemIds);
  const { dialog: bulkConfirmDialog, confirm: confirmBulk } = useConfirmDialog();
  const bulkActions = useMemo<BulkAction[]>(() => {
    const rowById = new Map(filteredData.map((r) => [String(r.id), r]));
    return [
      {
        id: 'archive',
        label: t('rap.actions.archive', 'Archiwizuj'),
        icon: Archive,
        variant: 'danger',
        onRun: async (sel) => {
          const ok = await confirmBulk({
            title: t('rap.bulk.confirmArchiveDecksTitle', 'Zarchiwizować zaznaczone prezentacje?'),
            description: t(
              'rap.bulk.confirmArchiveDecksDesc',
              'Zarchiwizujesz {{count}} prezentacji. Operacja jest odwracalna.',
              { count: sel.count }
            ),
            confirmLabel: t('rap.actions.archive', 'Archiwizuj'),
            cancelLabel: t('common.cancel', 'Anuluj'),
            variant: 'warning',
          });
          if (!ok) return;
          await sel.runBulk(
            async (id) => {
              const row = rowById.get(id);
              if (!row) throw new Error('missing row');
              const done = await actions.archiveDeck(row);
              if (!done) throw new Error('archive failed');
            },
            { silent: true }
          );
          onRefresh();
        },
      },
    ];
  }, [filteredData, actions, confirmBulk, onRefresh, t]);

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

  return (
    <div className="h-full overflow-hidden">
      <TableWithPreviewLayout<PresentationItem & { title: string }>
        selectedId={selectedId}
        selectedItem={previewItem}
        onSelect={setSelectedId}
        onOpenFull={(id) => {
          const row = filteredData.find((x) => x.id === id);
          if (row) openPresentation(row);
        }}
        itemIds={itemIds}
        getItemById={(id) => filteredData.find((x) => x.id === id) ?? null}
        renderPreview={(item) => (
          <PresentationPreviewBody
            presentation={item}
            trustProps={{
              governance: item.governance,
              artifactId: item.artifactId,
              exportFormats: item.exportFormats,
            }}
          />
        )}
        renderPreviewFooter={(item) => (
          <PresentationPreviewFooter
            presentation={item}
            onStartReview={
              item.artifactId
                ? async () => {
                    const aid = item.artifactId as string;
                    setReviewBusyArtifactId(aid);
                    const ok = await actions.startArtifactReview(aid);
                    setReviewBusyArtifactId(null);
                    if (ok) onRefresh();
                  }
                : undefined
            }
            reviewActionDisabled={item.id === previewItem?.id ? reviewDisabled : !item.artifactId}
            onExport={() => {
              actions.exportDeckPptx(item);
            }}
          />
        )}
      >
        <div className="flex h-full min-h-0 flex-col">
          <BulkActionBar selection={selection} actions={bulkActions} />
          {bulkConfirmDialog}
          <div className="min-h-0 flex-1">
            <FilterableTable
              columns={columns}
              data={filteredData}
              selectedRowId={selectedId}
              selection={selection.selectionProp}
              onRowClick={(row) => setSelectedId(row.id)}
              onRowDoubleClick={(row) => openPresentation(row as PresentationItem)}
              getRowActions={(row) => getRowActions(row as unknown as PresentationItem)}
              activeFilters={activeFilters}
              onFilterChange={onFilterChange}
              emptyMessage={t('rap.empty.presentations', 'Brak prezentacji')}
              canvasClassName="pl-4 pr-1.5 pt-3 pb-4"
            />
          </div>
        </div>
      </TableWithPreviewLayout>
    </div>
  );
};
