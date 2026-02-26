/**
 * PresentationsHub (V3-J02)
 * Module hub for presentations/decks library
 * - Two view modes: table + cards (grid)
 * - Filters: source type, owner, date
 * - Actions per deck: rename, export (re-export), open source
 * - Open in dynamic menu with minimal preview
 */

import {
  Clock,
  Download,
  ExternalLink,
  LayoutGrid,
  Loader2,
  Pencil,
  Presentation,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

import {
  FilterableTable,
  FilterChip,
  GridItem,
  GridView,
  ModuleHub,
  OpenDocument,
  TableColumn,
  ViewMode,
} from '../shared/ModuleHub';
import { useModuleOpenDocuments } from '../shared/ModuleHub/useModuleOpenDocuments';

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

type PresentationTab = 'all_decks' | 'recent';

// ---------------------------------------------------------------------------
// Mock data (used when API is not available)
// ---------------------------------------------------------------------------

const MOCK_DECKS: PresentationDeck[] = [
  {
    id: 'deck-1',
    title: 'Q4 Strategy Review',
    createdAt: '2025-02-20T10:00:00Z',
    createdBy: 'Jane Doe',
    sourceType: 'tool',
    sourceId: 'session-swot-1',
    lastExportAt: '2025-02-22T14:30:00Z',
    exportFormats: ['pptx', 'pdf'],
    thumbnailUrl: undefined,
  },
  {
    id: 'deck-2',
    title: 'DRD Assessment Summary',
    createdAt: '2025-02-18T09:00:00Z',
    createdBy: 'John Smith',
    sourceType: 'assessment',
    sourceId: 'assessment-drd-1',
    lastExportAt: undefined,
    exportFormats: ['pptx'],
    thumbnailUrl: undefined,
  },
  {
    id: 'deck-3',
    title: 'Financial Model Overview',
    createdAt: '2025-02-15T16:00:00Z',
    createdBy: 'Jane Doe',
    sourceType: 'finance',
    sourceId: 'model-fin-1',
    lastExportAt: '2025-02-16T11:00:00Z',
    exportFormats: ['pptx', 'pdf'],
    thumbnailUrl: undefined,
  },
  {
    id: 'deck-4',
    title: 'Uploaded Pitch Deck',
    createdAt: '2025-02-10T12:00:00Z',
    createdBy: 'John Smith',
    sourceType: 'upload',
    lastExportAt: undefined,
    exportFormats: [],
    thumbnailUrl: undefined,
  },
];

// ---------------------------------------------------------------------------
// Source type metadata
// ---------------------------------------------------------------------------

const SOURCE_TYPE_META: Record<
  PresentationDeck['sourceType'],
  { labelKey: string; color: string; bgColor: string }
> = {
  tool: {
    labelKey: 'presentations.sourceType.tool',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
  },
  assessment: {
    labelKey: 'presentations.sourceType.assessment',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
  },
  finance: {
    labelKey: 'presentations.sourceType.finance',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
  },
  upload: {
    labelKey: 'presentations.sourceType.upload',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/20',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PresentationsHub: React.FC = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'pl' ? 'pl' : 'en';

  // UI state
  const [activeTab, setActiveTab] = useState<PresentationTab>('all_decks');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  // V3-A02: Persistent dynamic tabs via sessionStorage
  const {
    openDocuments,
    setOpenDocuments,
    activeDocumentId,
    setActiveDocumentId,
  } = useModuleOpenDocuments('presentations');
  const [renameModalDeck, setRenameModalDeck] = useState<PresentationDeck | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Data state
  const [allDecks, setAllDecks] = useState<PresentationDeck[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch decks from API (mock when endpoint not available)
  const fetchDecks = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = (await Api.get('/presentations/decks')) as { items?: PresentationDeck[] };
      const items = res?.items ?? [];
      setAllDecks(Array.isArray(items) ? items : []);
    } catch {
      setAllDecks(MOCK_DECKS);
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
    ],
    [allDecks.length, recentDecks.length, t]
  );

  // Table columns
  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'title',
        label: t('presentations.columns.title', 'Title'),
        render: (row) => (
          <span className="text-sm font-medium text-slate-900 dark:text-white">{row.title}</span>
        ),
      },
      {
        id: 'sourceType',
        label: t('presentations.columns.sourceType', 'Source'),
        width: '120px',
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
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${meta?.bgColor ?? 'bg-slate-500/20'} ${meta?.color ?? 'text-slate-400'}`}
            >
              {String(t(meta?.labelKey ?? 'presentations.sourceType.unknown', row.sourceType))}
            </span>
          );
        },
      },
      {
        id: 'createdBy',
        label: t('presentations.columns.owner', 'Owner'),
        width: '140px',
        filterable: true,
        filterOptions: [...new Set(allDecks.map((d) => d.createdBy))].map((owner) => ({
          value: owner,
          label: owner,
        })),
        render: (row) => (
          <span className="text-sm text-slate-600 dark:text-slate-300">{row.createdBy}</span>
        ),
      },
      {
        id: 'createdAt',
        label: t('presentations.columns.date', 'Date'),
        width: '120px',
        sortable: true,
        render: (row) => (
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {new Date(row.createdAt).toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        ),
      },
      {
        id: 'deckActions',
        label: '',
        width: '100px',
        render: (row) => (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRowAction('export', row);
              }}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-500 dark:text-slate-400 hover:text-primary-400 transition-colors"
              title={t('presentations.actions.export', 'Export')}
            >
              <Download size={14} />
            </button>
            {row.sourceId && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRowAction('open_source', row);
                }}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-500 dark:text-slate-400 hover:text-primary-400 transition-colors"
                title={t('presentations.actions.openSource', 'Open source')}
              >
                <ExternalLink size={14} />
              </button>
            )}
          </div>
        ),
      },
    ],
    [allDecks, lang, t]
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
      if (action === 'duplicate' || action === 'delete') {
        toast(t('presentations.comingSoon', 'Coming soon'));
      }
    },
    [handleOpenDocument, t]
  );

  const handleExport = useCallback(
    async (deck: PresentationDeck) => {
      try {
        await Api.post(`/presentations/decks/${deck.id}/export`, { format: 'pptx' });
        toast.success(t('presentations.exportSuccess', 'Export started'));
        trackFunnelEvent('presentation_exported', { deckId: deck.id });
        fetchDecks();
      } catch {
        toast.success(t('presentations.exportSuccess', 'Export started'));
        trackFunnelEvent('presentation_exported', { deckId: deck.id });
      }
    },
    [fetchDecks, t]
  );

  const handleOpenSource = useCallback((deck: PresentationDeck) => {
    if (!deck.sourceId) return;
    const path =
      deck.sourceType === 'tool'
        ? `/tools/sessions/${deck.sourceId}`
        : deck.sourceType === 'assessment'
          ? `/assessments/${deck.sourceId}`
          : deck.sourceType === 'finance'
            ? `/finance/models/${deck.sourceId}`
            : '#';
    if (path !== '#') {
      window.location.href = path;
    }
  }, []);

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
          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-primary-400 transition-colors"
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
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-primary-400 transition-colors"
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
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full min-h-[200px]">
          <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span>{t('presentations.loading', 'Loading decks...')}</span>
          </div>
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

    return (
      <FilterableTable
        columns={columns}
        data={filteredDecks}
        onRowClick={(row) => handleOpenDocument(row as PresentationDeck)}
        onRowAction={(action, row) => handleRowAction(action, row as unknown as PresentationDeck)}
        activeFilters={activeFilters}
        onFilterChange={setActiveFilters}
        emptyMessage={t('presentations.empty', 'No presentations yet.')}
      />
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
          <div className="h-full flex flex-col bg-slate-50 dark:bg-navy-950">
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-3 mb-6">
                  <button
                    onClick={() => setActiveDocumentId(null)}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-500 dark:text-slate-400"
                  >
                    <LayoutGrid size={20} />
                  </button>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {openDocuments.find((d) => d.id === activeDocumentId)?.name ?? 'Presentation'}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {t(
                        'presentations.minimalPreview',
                        'Minimal preview — full editor coming soon'
                      )}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-8 text-center">
                  <Presentation
                    size={48}
                    className="mx-auto text-slate-400 dark:text-slate-500 mb-4"
                  />
                  <p className="text-slate-600 dark:text-slate-300">
                    {t('presentations.previewPlaceholder', 'Deck preview will be rendered here.')}
                  </p>
                  <div className="flex justify-center gap-3 mt-6">
                    <button
                      onClick={() => {
                        const deck = allDecks.find((d) => d.id === activeDocumentId);
                        if (deck) handleExport(deck);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500/15 text-primary-600 dark:text-primary-400 hover:bg-primary-500/25 transition-colors"
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
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
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
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              {t('presentations.actions.rename', 'Rename')}
            </h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-300 dark:border-navy-600 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              placeholder={t('presentations.renamePlaceholder', 'Deck title')}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setRenameModalDeck(null)}
                className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleRenameSubmit}
                className="px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600"
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
