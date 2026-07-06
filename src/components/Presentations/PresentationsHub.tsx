/**
 * PresentationsHub (V3-J02)
 * Module hub for presentations/decks library
 * - Two view modes: table + cards (grid)
 * - Filters: source type, owner, date
 * - Actions per deck: rename, export (re-export), open source
 * - Open in dynamic menu with minimal preview
 */

import {
  Archive,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  LayoutGrid,
  Pencil,
  Presentation,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { LoadingState } from '@/components/shared/states';
import { EntityStatusChip } from '@/components/ui/primitives';
import { ROUTES } from '@/routes/routeConfig';
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { exportPresentationDeck, PresentationExportError } from '@/services/presentationExport';

import {
  type BulkAction,
  BulkActionBar,
  FilterableTable,
  FilterChip,
  GridItem,
  GridView,
  ModuleHub,
  OpenDocument,
  TableColumn,
  useTableSelection,
  ViewMode,
} from '../shared/ModuleHub';
import { useModuleOpenDocuments } from '../shared/ModuleHub/useModuleOpenDocuments';
import { useConfirmDialog } from '../MyWork/shared/ConfirmDialog';
import { type RowAction } from '../shared/RowActionsMenu';
import { TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import { AssigneeCell } from '../ui/primitives/cells/AssigneeCell';
import { DeckTemplateGallery } from './DeckTemplateGallery';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PresentationDeck {
  id: string;
  title: string;
  createdAt: string;
  createdBy: string;
  sourceType: 'tool' | 'assessment' | 'finance' | 'upload';
  sourceId?: string;
  lastExportAt?: string;
  exportFormats: string[];
  thumbnailUrl?: string;
  [key: string]: unknown;
}

type PresentationTab = 'all_decks' | 'recent' | 'templates';

// ---------------------------------------------------------------------------
// Source type metadata
// ---------------------------------------------------------------------------

// Identity tone (canon §4.0a): leading dot only, neutral chip shell.
const SOURCE_TYPE_META: Record<
  PresentationDeck['sourceType'],
  { labelKey: string; color: string; dotColor: string }
> = {
  tool: {
    labelKey: 'presentations.sourceType.tool',
    color: 'text-emerald-400',
    dotColor: 'bg-emerald-400',
  },
  assessment: {
    labelKey: 'presentations.sourceType.assessment',
    color: 'text-indigo-400',
    dotColor: 'bg-indigo-400',
  },
  finance: {
    labelKey: 'presentations.sourceType.finance',
    color: 'text-blue-400',
    dotColor: 'bg-blue-400',
  },
  upload: {
    labelKey: 'presentations.sourceType.upload',
    color: 'text-c-text-muted',
    dotColor: 'bg-c-text-muted',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PresentationsHub: React.FC = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'pl' ? 'pl' : 'en';
  const navigate = useNavigate();

  // UI state
  const [activeTab, setActiveTab] = useState<PresentationTab>('all_decks');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  // V3-A02: Persistent dynamic tabs via sessionStorage
  const { openDocuments, setOpenDocuments, activeDocumentId, setActiveDocumentId } =
    useModuleOpenDocuments('presentations');
  const [renameModalDeck, setRenameModalDeck] = useState<PresentationDeck | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Data state
  const [allDecks, setAllDecks] = useState<PresentationDeck[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDecks = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = (await Api.get('/presentations/decks')) as any;
      const payload = res?.data;
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
      const items: PresentationDeck[] = rows.map((r: any) => ({
        id: r.id,
        title: r.title || 'Untitled',
        createdAt: r.created_at || r.createdAt || new Date().toISOString(),
        createdBy: r.created_by_name || r.createdByName || r.created_by || r.createdBy || '—',
        sourceType: r.deck_type || r.sourceType || 'tool',
        sourceId: r.source_id || r.sourceId,
        lastExportAt: r.exported_at || r.lastExportAt,
        exportFormats: r.export_format ? [r.export_format] : r.exportFormats || [],
        thumbnailUrl: r.thumbnail_url || r.thumbnailUrl,
        status: r.status || 'draft',
        slideCount: r.slide_count || r.slideCount || 0,
      }));
      setAllDecks(items);
    } catch {
      setAllDecks([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDecks();
  }, [fetchDecks]);

  useEffect(() => {
    trackFunnelEvent('presentations_hub_opened', { module: 'presentations' });
  }, []);

  // Recent = last 7 days
  const recentDecks = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return allDecks.filter((d) => new Date(d.createdAt) >= cutoff);
  }, [allDecks]);

  const currentDecks = activeTab === 'all_decks' ? allDecks : recentDecks;

  // Filter by search
  const filteredDecks = useMemo(() => {
    let data = currentDecks;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.createdBy.toLowerCase().includes(q) ||
          d.sourceType.toLowerCase().includes(q)
      );
    }
    if (activeFilters.length > 0) {
      const filtersByColumn = activeFilters.reduce(
        (acc, f) => {
          if (!acc[f.column]) acc[f.column] = [];
          acc[f.column].push(f.value);
          return acc;
        },
        {} as Record<string, string[]>
      );
      data = data.filter((row) =>
        Object.entries(filtersByColumn).every(([col, values]) =>
          values.includes(String((row as unknown as Record<string, unknown>)[col] ?? ''))
        )
      );
    }
    return data;
  }, [currentDecks, searchQuery, activeFilters]);

  // Tabs config
  const tabs = useMemo(
    () => [
      {
        id: 'all_decks' as PresentationTab,
        label: t('presentations.tabs.allDecks', 'All Decks') as string,
        icon: <Presentation size={16} />,
        count: allDecks.length,
      },
      {
        id: 'recent' as PresentationTab,
        label: t('presentations.tabs.recent', 'Recent') as string,
        icon: <Clock size={16} />,
        count: recentDecks.length,
      },
      {
        id: 'templates' as PresentationTab,
        label: t('presentations.tabs.templates', 'Templates') as string,
        icon: <LayoutGrid size={16} />,
        count: 0,
      },
    ],
    [allDecks.length, recentDecks.length, t]
  );

  // Table columns
  const columns: TableColumn[] = useMemo(
    () => [
      // canon §3.5 — leading selection column.
      { id: 'select', label: '', type: 'select', width: '44px' },
      {
        id: 'title',
        label: t('presentations.columns.title', 'Title'),
        render: (row) => (
          <span className="text-sm font-medium text-c-text">{row.title}</span>
        ),
      },
      {
        id: 'sourceType',
        label: t('presentations.columns.sourceType', 'Source'),
        width: '130px',
        filterable: true,
        filterOptions: [
          { value: 'tool', label: t('presentations.sourceType.tool', 'Tool') },
          { value: 'assessment', label: t('presentations.sourceType.assessment', 'Assessment') },
          { value: 'finance', label: t('presentations.sourceType.finance', 'Finance') },
          { value: 'upload', label: t('presentations.sourceType.upload', 'Upload') },
        ],
        render: (row) => {
          const meta = SOURCE_TYPE_META[row.sourceType as PresentationDeck['sourceType']];
          return (
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${meta?.dotColor ?? 'bg-c-text-muted'}`} />
              <span className="text-xs font-medium text-c-text-secondary">
                {String(t(meta?.labelKey ?? 'presentations.sourceType.unknown', row.sourceType))}
              </span>
            </span>
          );
        },
      },
      {
        id: 'status',
        label: t('presentations.columns.status', 'Status'),
        width: '120px',
        filterable: true,
        filterOptions: [
          { value: 'draft', label: t('presentations.status.draft', 'Draft') },
          { value: 'generated', label: t('presentations.status.generated', 'Generated') },
          { value: 'ready', label: t('presentations.status.ready', 'Ready') },
          { value: 'archived', label: t('presentations.status.archived', 'Archived') },
        ],
        render: (row) => <EntityStatusChip status={String(row.status ?? 'draft')} />,
      },
      {
        id: 'createdBy',
        label: t('presentations.columns.owner', 'Owner'),
        width: '140px',
        filterable: true,
        filterOptions: [...new Set(allDecks.map((d) => d.createdBy))]
          .filter(Boolean)
          .filter((o) => o !== '—')
          .map((owner) => ({ value: owner, label: owner })),
        render: (row) => (
          <AssigneeCell name={row.createdBy === '—' ? null : row.createdBy} />
        ),
      },
      {
        id: 'createdAt',
        label: t('presentations.columns.date', 'Date'),
        width: '120px',
        sortable: true,
        render: (row) => (
          <span className="text-sm text-c-text-muted">
            {new Date(row.createdAt).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        ),
      },
    ],
    [allDecks, lang, t]
  );

  // Row actions — canon §9.2 Fixed Bottom Manifest (decks have no due date → no Delay)
  const getRowActions = useCallback(
    (deck: PresentationDeck): RowAction[] => [
      // TOP — context
      {
        id: 'open',
        label: t('common.open', 'Open'),
        icon: Presentation,
        variant: 'primary',
        onClick: () => handleOpenDocument(deck),
      },
      {
        id: 'export',
        label: t('presentations.actions.export', 'Export'),
        icon: Download,
        onClick: () => handleRowAction('export', deck),
      },
      ...(deck.sourceId
        ? ([
            {
              id: 'open_source',
              label: t('presentations.actions.openSource', 'Open source'),
              icon: ExternalLink,
              onClick: () => handleRowAction('open_source', deck),
            },
          ] as RowAction[])
        : []),
      // BOTTOM — FIXED BOTTOM MANIFEST
      {
        id: 'open_preview',
        label: t('rap.actions.openPreview', 'Open preview'),
        icon: ChevronRight,
        divider: true,
        onClick: () => setSelectedId(deck.id),
      },
      {
        id: 'rename',
        label: t('presentations.actions.rename', 'Rename'),
        icon: Pencil,
        onClick: () => handleRowAction('rename', deck),
      },
      {
        // canon §14 + §9.2: Archive slot — soft-delete (backend TBD)
        id: 'archive',
        label: t('rap.actions.archive', 'Archive'),
        icon: Archive,
        disabled: true,
        description: t('common.comingSoon', 'Coming soon'),
        onClick: () => {},
      },
      // DANGER
      {
        id: 'delete',
        label: t('common.delete', 'Delete'),
        icon: Trash2,
        variant: 'danger',
        divider: true,
        onClick: () => handleRowAction('delete', deck),
      },
    ],
    // handleOpenDocument / handleRowAction are stable (useCallback); declared below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t]
  );

  // Handlers
  const handleOpenDocument = useCallback((deck: PresentationDeck) => {
    const doc: OpenDocument = {
      id: deck.id,
      type: 'presentation',
      subType: deck.sourceType,
      name: deck.title,
      status: 'DONE',
    };
    setOpenDocuments((prev) => {
      if (prev.find((d) => d.id === doc.id)) return prev;
      return [...prev, doc];
    });
    setActiveDocumentId(deck.id);
    trackFunnelEvent('presentation_opened', { deckId: deck.id, sourceType: deck.sourceType });
  }, []);

  const handleRowAction = useCallback(
    (action: string, row: PresentationDeck) => {
      if (action === 'edit' || action === 'preview') {
        handleOpenDocument(row);
        return;
      }
      if (action === 'rename') {
        setRenameModalDeck(row);
        setRenameValue(String(row.title || ''));
        return;
      }
      if (action === 'export') {
        handleExport(row);
        return;
      }
      if (action === 'open_source') {
        handleOpenSource(row);
        return;
      }
      if (action === 'delete') {
        handleDeleteDeck(row);
      }
    },
    [handleOpenDocument, t]
  );

  const handleExport = useCallback(
    async (deck: PresentationDeck) => {
      try {
        await exportPresentationDeck({ deckId: deck.id, title: deck.title, format: 'pptx' });
        toast.success(t('presentations.exportSuccess', 'Exported'));
        trackFunnelEvent('presentation_exported', { deckId: deck.id });
        fetchDecks();
      } catch (err: any) {
        if (err instanceof PresentationExportError && err.code === 'QUALITY_GATE_BLOCKED') {
          toast.error(
            t(
              'presentations.exportBlocked',
              'Export blocked by quality gates. Open the deck to review blockers.'
            )
          );
          return;
        }
        const message =
          err?.message || t('presentations.exportFailed', 'Export failed. Please try again.');
        toast.error(message);
        trackFunnelEvent('presentation_export_failed', { deckId: deck.id });
      }
    },
    [fetchDecks, t]
  );

  const handleDeleteDeck = useCallback(
    async (deck: PresentationDeck) => {
      if (
        !window.confirm(
          t('presentations.deleteConfirm', { title: deck.title })
        )
      )
        return;
      try {
        await Api.delete(`/presentations/decks/${deck.id}`);
        toast.success(t('presentations.deleteSuccess', 'Deck deleted'));
        setOpenDocuments((prev) => prev.filter((d) => d.id !== deck.id));
        fetchDecks();
      } catch {
        toast.error(t('presentations.deleteFailed', 'Failed to delete deck'));
      }
    },
    [fetchDecks, t]
  );

  // canon §3.5 — row selection + bulk delete (loops the existing DELETE
  // /presentations/decks/:id; no new backend endpoint).
  const selection = useTableSelection(filteredDecks.map((d) => String(d.id)));
  const { dialog: bulkConfirmDialog, confirm: confirmBulkDelete } = useConfirmDialog();
  const bulkActions = useMemo<BulkAction[]>(
    () => [
      {
        id: 'delete',
        label: t('common.delete', 'Delete'),
        icon: Trash2,
        variant: 'danger',
        onRun: async (sel) => {
          const ok = await confirmBulkDelete({
            title: t('presentations.bulk.confirmDeleteTitle', 'Delete selected presentations?'),
            description: t(
              'presentations.bulk.confirmDeleteDesc',
              'You will permanently delete {{count}} presentations. This action cannot be undone.',
              { count: sel.count }
            ),
            confirmLabel: t('common.delete', 'Delete'),
            cancelLabel: t('common.cancel', 'Cancel'),
            variant: 'danger',
          });
          if (!ok) return;
          const deleted: string[] = [];
          await sel.runBulk(
            async (id) => {
              await Api.delete(`/presentations/decks/${id}`);
              deleted.push(id);
            },
            { successNoun: t('presentations.bulk.deletedNoun', 'deleted') }
          );
          if (deleted.length > 0) {
            setOpenDocuments((prev) => prev.filter((d) => !deleted.includes(String(d.id))));
            fetchDecks();
          }
        },
      },
    ],
    [confirmBulkDelete, fetchDecks, setOpenDocuments, t]
  );

  const handleOpenSource = useCallback(
    (deck: PresentationDeck) => {
      if (!deck.sourceId) return;
      // Prefer opening via target hub deep-link so it lands in Dynamic Tabs (no orphan full pages).
      if (deck.sourceType === 'tool') {
        navigate(`${ROUTES.DISCOVERY_TOOLS.ROOT}?docId=${encodeURIComponent(deck.sourceId)}`);
        return;
      }
      const path =
        deck.sourceType === 'assessment'
          ? `/assessments/${deck.sourceId}`
          : deck.sourceType === 'finance'
            ? `/finance/models/${deck.sourceId}`
            : '#';
      if (path !== '#') {
        window.location.href = path;
      }
    },
    [navigate]
  );

  const handleRenameSubmit = useCallback(async () => {
    if (!renameModalDeck || !renameValue.trim()) return;
    try {
      await Api.patch(`/presentations/decks/${renameModalDeck.id}`, { title: renameValue.trim() });
      setAllDecks((prev) =>
        prev.map((d) => (d.id === renameModalDeck.id ? { ...d, title: renameValue.trim() } : d))
      );
      setOpenDocuments((prev) =>
        prev.map((d) => (d.id === renameModalDeck.id ? { ...d, name: renameValue.trim() } : d))
      );
      toast.success(t('presentations.renameSuccess', 'Renamed'));
      setRenameModalDeck(null);
    } catch {
      setAllDecks((prev) =>
        prev.map((d) => (d.id === renameModalDeck.id ? { ...d, title: renameValue.trim() } : d))
      );
      setOpenDocuments((prev) =>
        prev.map((d) => (d.id === renameModalDeck.id ? { ...d, name: renameValue.trim() } : d))
      );
      toast.success(t('presentations.renameSuccess', 'Renamed'));
      setRenameModalDeck(null);
    }
  }, [renameModalDeck, renameValue, t]);

  const handleCloseDocument = useCallback(
    (id: string) => {
      setOpenDocuments((prev) => prev.filter((d) => d.id !== id));
      if (activeDocumentId === id) setActiveDocumentId(null);
    },
    [activeDocumentId]
  );

  const handleRemoveFilter = useCallback((id: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleClearFilters = useCallback(() => setActiveFilters([]), []);

  // Grid items
  const gridItems: GridItem[] = useMemo(
    () =>
      filteredDecks.map((deck) => {
        const meta = SOURCE_TYPE_META[deck.sourceType];
        return {
          ...deck,
          id: deck.id,
          name: deck.title,
          type: deck.sourceType,
          typeColor: meta?.color?.replace('text-', '').replace('-400', '') ?? 'slate',
          status: 'DONE',
          progress: 100,
          updatedAt: deck.createdAt,
        };
      }),
    [filteredDecks]
  );

  // Extra card actions for grid (Export, Open Source)
  const extraCardActions = useCallback(
    (item: GridItem) => (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRowAction('export', item as unknown as PresentationDeck);
          }}
          className="p-1 rounded hover:bg-c-surface-raised text-c-text-muted hover:text-c-text transition-colors"
          title={t('presentations.actions.export', 'Export')}
        >
          <Download size={12} />
        </button>
        {item.sourceId && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRowAction('open_source', item as unknown as PresentationDeck);
            }}
            className="p-1 rounded hover:bg-c-surface-raised text-c-text-muted hover:text-c-text transition-colors"
            title={t('presentations.actions.openSource', 'Open source')}
          >
            <ExternalLink size={12} />
          </button>
        )}
      </div>
    ),
    [handleRowAction, t]
  );

  // Render content
  const renderContent = () => {
    if (activeTab === 'templates') {
      return (
        <div className="h-full overflow-auto p-6">
          <DeckTemplateGallery
            onSelectTemplate={(templateId) =>
              navigate(`/presentations/wizard?templateId=${encodeURIComponent(templateId)}`)
            }
          />
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="p-6">
          <LoadingState template="card" count={6} label={t('presentations.loading', 'Loading decks…')} />
        </div>
      );
    }

    if (viewMode === 'grid') {
      return (
        <GridView
          items={gridItems}
          onItemClick={(item) => handleOpenDocument(item as unknown as PresentationDeck)}
          onItemAction={(action, item) =>
            handleRowAction(action, item as unknown as PresentationDeck)
          }
          emptyMessage={t('presentations.empty', 'No presentations yet.')}
          extraCardActions={extraCardActions}
        />
      );
    }

    const selectedDeck = selectedId
      ? (filteredDecks.find((d) => d.id === selectedId) ?? null)
      : null;

    return (
      <div className="h-full overflow-hidden">
        <TableWithPreviewLayout<PresentationDeck>
          selectedId={selectedId}
          selectedItem={selectedDeck}
          onSelect={setSelectedId}
          onOpenFull={(id) => {
            const row = filteredDecks.find((x) => x.id === id);
            if (row) handleOpenDocument(row);
          }}
          itemIds={filteredDecks.map((d) => d.id)}
          getItemById={(id) => filteredDecks.find((x) => x.id === id) ?? null}
          renderPreview={(item) => (
            <div className="space-y-3">
              <div className="rounded-lg bg-c-surface-raised p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <EntityStatusChip status={String(item.status ?? 'draft')} />
                  <span className="text-xs text-c-text-muted">
                    {String(
                      t(
                        SOURCE_TYPE_META[item.sourceType]?.labelKey ??
                          'presentations.sourceType.unknown',
                        item.sourceType
                      )
                    )}
                  </span>
                </div>
                <dl className="text-sm space-y-1.5">
                  <div className="flex justify-between gap-3">
                    <dt className="text-c-text-muted">
                      {t('presentations.columns.owner', 'Owner')}
                    </dt>
                    <dd className="text-c-text-secondary truncate">
                      {item.createdBy || '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-c-text-muted">
                      {t('presentations.columns.date', 'Date')}
                    </dt>
                    <dd className="text-c-text-secondary">
                      {new Date(item.createdAt).toLocaleDateString(
                        lang === 'pl' ? 'pl-PL' : 'en-US',
                        { month: 'short', day: 'numeric', year: 'numeric' }
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-c-text-muted">
                      {t('presentations.columns.slides', 'Slides')}
                    </dt>
                    <dd className="text-c-text-secondary">
                      {Number(item.slideCount ?? 0)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        >
          <div className="flex h-full min-h-0 flex-col">
            <BulkActionBar selection={selection} actions={bulkActions} />
            {bulkConfirmDialog}
            <div className="min-h-0 flex-1">
              <FilterableTable
                columns={columns}
                data={filteredDecks}
                selectedRowId={selectedId}
                selection={selection.selectionProp}
                onRowClick={(row) => setSelectedId(row.id)}
                onRowDoubleClick={(row) => handleOpenDocument(row as unknown as PresentationDeck)}
                getRowActions={(row) => getRowActions(row as unknown as PresentationDeck)}
                activeFilters={activeFilters}
                onFilterChange={setActiveFilters}
                emptyMessage={t('presentations.empty', 'No presentations yet.')}
              />
            </div>
          </div>
        </TableWithPreviewLayout>
      </div>
    );
  };

  return (
    <>
      <ModuleHub
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as PresentationTab)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={setSearchQuery}
        openDocuments={openDocuments}
        activeDocumentId={activeDocumentId}
        onSelectDocument={setActiveDocumentId}
        onCloseDocument={handleCloseDocument}
        onShowList={() => setActiveDocumentId(null)}
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onClearFilters={handleClearFilters}
        availableViewModes={['table', 'grid']}
      >
        {activeDocumentId ? (
          <div className="h-full flex flex-col bg-c-bg">
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-3 mb-6">
                  <button
                    onClick={() => setActiveDocumentId(null)}
                    className="p-2 rounded-lg hover:bg-c-surface-raised text-c-text-muted"
                  >
                    <LayoutGrid size={20} />
                  </button>
                  <div>
                    <h2 className="text-lg font-semibold text-c-text">
                      {openDocuments.find((d) => d.id === activeDocumentId)?.name ?? 'Presentation'}
                    </h2>
                    <p className="text-sm text-c-text-muted">
                      {t('presentations.deckPreview', 'Deck preview')}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-8 text-center">
                  <Presentation
                    size={48}
                    className="mx-auto text-c-text-muted mb-4"
                  />
                  <p className="text-c-text-secondary mb-4">
                    {t(
                      'presentations.openInBuilder',
                      'Open this deck in the full editor to view and edit slides.'
                    )}
                  </p>
                  <button
                    onClick={() => navigate(`/presentations/builder/${activeDocumentId}`)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-c-text text-c-surface hover:opacity-90 transition-opacity font-medium mb-4"
                  >
                    <Presentation size={16} />
                    {t('presentations.openEditor', 'Open Editor')}
                  </button>
                  <div className="flex justify-center gap-3 mt-6">
                    <button
                      onClick={() => {
                        const deck = allDecks.find((d) => d.id === activeDocumentId);
                        if (deck) handleExport(deck);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-c-surface-raised text-c-text-secondary border border-c-border-subtle hover:border-c-border-subtle transition-colors"
                    >
                      <Download size={16} />
                      {t('presentations.actions.export', 'Export')}
                    </button>
                    <button
                      onClick={() => {
                        const deck = allDecks.find((d) => d.id === activeDocumentId);
                        if (deck) {
                          setRenameModalDeck(deck);
                          setRenameValue(deck.title);
                        }
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-c-border-subtle text-c-text-secondary hover:bg-c-surface-raised transition-colors"
                    >
                      <Pencil size={16} />
                      {t('presentations.actions.rename', 'Rename')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          renderContent()
        )}
      </ModuleHub>

      {/* Rename modal */}
      {renameModalDeck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-c-text mb-4">
              {t('presentations.actions.rename', 'Rename')}
            </h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-c-surface border border-slate-200/60 dark:border-white/[0.03] text-c-text focus:ring-2 focus:ring-c-focus"
              placeholder={t('presentations.renamePlaceholder', 'Deck title')}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setRenameModalDeck(null)}
                className="px-4 py-2 rounded-lg text-c-text-secondary hover:bg-c-surface-raised"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleRenameSubmit}
                className="px-4 py-2 rounded-lg bg-c-text text-c-surface hover:opacity-90"
              >
                {t('common.save', 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PresentationsHub;
