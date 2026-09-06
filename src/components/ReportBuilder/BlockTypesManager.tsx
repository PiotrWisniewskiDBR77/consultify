/**
 * BlockTypesManager
 *
 * Full CRUD management for Report Builder block types (library).
 * Lista encji Block — kanon TRIADA: StandardModuleBar + StandardTable +
 * StandardPreview (SSOT: docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md,
 * Harvard/wdrozenie-100/_STANDARD_TRIADA_NOTATKA.md). Moduł deklaruje wyłącznie
 * dane + akcje; chrome (menu/tabela/preview) pochodzi z fasad standard/*.
 * Create/Edit pozostaje modalem (poza zakresem kanonu list — to edytor formularza).
 */

import {
  Blocks,
  Building2,
  Calendar,
  Copy,
  Edit3,
  Loader2,
  Package,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import toast from 'react-hot-toast';

import {
  StandardModuleBar,
  StandardPreview,
  type StandardPreviewActions,
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard';
import { categoryTone } from '@/components/ui/primitives/chips';
import { JedenPrawyPanel } from '@/components/shared/PreviewPane/JedenPrawyPanel';
import { useJedenPanel } from '@/components/shared/PreviewPane/useJedenPanel';
import { Api } from '@/services/api';

// ==========================================
// TYPES
// ==========================================

type BlockRenderKind = 'markdown' | 'callout' | 'table' | 'chart' | 'matrix' | 'json';
type SectionLength = 'short' | 'medium' | 'long';
type SectionLanguage = 'technical' | 'business' | 'general';
type BlockCategory = 'content' | 'data' | 'visual';

export interface BlockType {
  id: string;
  name: string;
  description?: string | null;
  sourceTypes?: string[] | null;
  renderKind: BlockRenderKind;
  promptTemplate?: string | null;
  inputSchema?: Record<string, unknown> | null;
  defaultLength?: SectionLength;
  defaultLanguage?: SectionLanguage;
  isSystem?: boolean;
  isActive?: boolean;
  category?: BlockCategory;
  displayOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface BlockTypesManagerProps {
  onBack?: () => void;
  embedded?: boolean;
}

// ==========================================
// HELPERS (i18n — prefix reportBuilder.blockTypesManager)
// ==========================================

const NS = 'reportBuilder.blockTypesManager';

const getCategoryLabel = (t: TFunction, category: BlockCategory): string => {
  const fallback: Record<BlockCategory, string> = {
    content: 'Content',
    data: 'Data',
    visual: 'Visual',
  };
  return t(`${NS}.category.${category}`, fallback[category]);
};

const getRenderLabel = (t: TFunction, kind: BlockRenderKind): string => {
  const fallback: Record<BlockRenderKind, string> = {
    markdown: 'Markdown',
    callout: 'Callout',
    table: 'Table',
    chart: 'Chart',
    matrix: 'Matrix',
    json: 'JSON',
  };
  return t(`${NS}.render.${kind}`, fallback[kind]);
};

const getTypeLabel = (t: TFunction, isSystem: boolean): string =>
  isSystem ? t(`${NS}.type.app`, 'App') : t(`${NS}.type.org`, 'Org');

const formatDate = (t: TFunction, lang: string, dateStr?: string): string => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '—';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((dateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return t(`${NS}.date.today`, 'Today');
  if (diffDays === -1) return t(`${NS}.date.yesterday`, 'Yesterday');
  if (diffDays > -7 && diffDays < 0)
    return t(`${NS}.date.daysAgo`, '{{count}}d ago', { count: Math.abs(diffDays) });
  const locale = lang?.startsWith('pl') ? 'pl-PL' : 'en-US';
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
};

const TagChip: React.FC<{ label: string; tone?: string | null }> = ({ label, tone }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-c-border bg-c-surface-raised px-2 py-0.5 text-[11px] font-medium text-c-text-secondary">
    {tone ? (
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: tone }}
      />
    ) : null}
    {label}
  </span>
);

// ==========================================
// MAIN COMPONENT
// ==========================================

export const BlockTypesManager: React.FC<BlockTypesManagerProps> = () => {
  const { t, i18n } = useTranslation();
  const [blocks, setBlocks] = useState<BlockType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'app' | 'org'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // DEC-397b (1.1-K6): klik wiersza / kebab „Podgląd" po zamknięciu panelu
  // (X) mają go ponownie otworzyć — patrz InboxContent.tsx (K5, 2f5161f3b4).
  const jedenPanel = useJedenPanel();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<
    { id: string; column: string; value: string; label: string }[]
  >([]);

  // Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<BlockType | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [renderKind, setRenderKind] = useState<BlockRenderKind>('markdown');
  const [sourceTypesText, setSourceTypesText] = useState('ASSESSMENT');
  const [promptTemplate, setPromptTemplate] = useState('');
  const [defaultLength, setDefaultLength] = useState<SectionLength>('medium');
  const [defaultLanguage, setDefaultLanguage] = useState<SectionLanguage>('business');

  const CATEGORY_LABELS = useMemo<Record<BlockCategory, string>>(
    () => ({
      content: getCategoryLabel(t, 'content'),
      data: getCategoryLabel(t, 'data'),
      visual: getCategoryLabel(t, 'visual'),
    }),
    [t]
  );

  const RENDER_LABELS = useMemo<Record<BlockRenderKind, string>>(
    () => ({
      markdown: getRenderLabel(t, 'markdown'),
      callout: getRenderLabel(t, 'callout'),
      table: getRenderLabel(t, 'table'),
      chart: getRenderLabel(t, 'chart'),
      matrix: getRenderLabel(t, 'matrix'),
      json: getRenderLabel(t, 'json'),
    }),
    [t]
  );

  const TYPE_FILTER_OPTIONS = useMemo(
    () => [
      { value: 'app', label: getTypeLabel(t, true) },
      { value: 'org', label: getTypeLabel(t, false) },
    ],
    [t]
  );

  const CATEGORY_FILTER_OPTIONS = useMemo(
    () => (Object.keys(CATEGORY_LABELS) as BlockCategory[]).map((v) => ({
      value: v,
      label: CATEGORY_LABELS[v],
    })),
    [CATEGORY_LABELS]
  );

  const RENDER_FILTER_OPTIONS = useMemo(
    () => (Object.keys(RENDER_LABELS) as BlockRenderKind[]).map((v) => ({
      value: v,
      label: RENDER_LABELS[v],
    })),
    [RENDER_LABELS]
  );

  const resetForm = useCallback(() => {
    setName('');
    setDescription('');
    setRenderKind('markdown');
    setSourceTypesText('ASSESSMENT');
    setPromptTemplate('');
    setDefaultLength('medium');
    setDefaultLanguage('business');
  }, []);

  const openCreate = () => {
    setEditing(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEdit = useCallback((b: BlockType) => {
    setEditing(b);
    setName(b.name);
    setDescription(b.description || '');
    setRenderKind((b.renderKind || 'markdown') as BlockRenderKind);
    setSourceTypesText((b.sourceTypes || ['ASSESSMENT']).join(', '));
    setPromptTemplate(b.promptTemplate || '');
    setDefaultLength((b.defaultLength || 'medium') as SectionLength);
    setDefaultLanguage((b.defaultLanguage || 'business') as SectionLanguage);
    setIsModalOpen(true);
  }, []);

  const parsedSourceTypes = useMemo(() => {
    const items = sourceTypesText
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    return Array.from(new Set(items));
  }, [sourceTypesText]);

  const fetchBlocks = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await Api.get('/report-builder/block-types');
      setBlocks(res?.blocks || []);
    } catch (e: any) {
      console.error('[BlockTypesManager] Error fetching blocks:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  const save = async () => {
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      sourceTypes: parsedSourceTypes,
      renderKind,
      promptTemplate: promptTemplate.trim() || undefined,
      defaultLength,
      defaultLanguage,
    };

    try {
      if (editing?.id) {
        await Api.put(`/report-builder/block-types/${editing.id}`, payload);
        toast.success(t(`${NS}.toast.updated`, 'Block updated'));
      } else {
        await Api.post('/report-builder/block-types', payload);
        toast.success(t(`${NS}.toast.created`, 'Block created'));
      }
      setIsModalOpen(false);
      await fetchBlocks();
    } catch (err: any) {
      toast.error(err?.error || t(`${NS}.toast.saveFailed`, 'Failed to save'));
    }
  };

  const deactivate = useCallback(
    async (b: BlockType) => {
      if (b.isSystem) return;
      if (!confirm(t(`${NS}.toast.confirmDeactivate`, 'Deactivate this block type?'))) return;
      try {
        await Api.delete(`/report-builder/block-types/${b.id}`);
        toast.success(t(`${NS}.toast.deactivated`, 'Block deactivated'));
        setPreviewId((prev) => (prev === b.id ? null : prev));
        await fetchBlocks();
      } catch (err: any) {
        toast.error(err?.error || t(`${NS}.toast.deactivateFailed`, 'Failed to deactivate'));
      }
    },
    [fetchBlocks, t]
  );

  // ── Filtrowanie: chip App/Org (Menu 3) + lupa (Menu 2) ───────────────────
  const filteredBlocks = useMemo(() => {
    let result = blocks;

    if (filter === 'app') result = result.filter((b) => b.isSystem);
    else if (filter === 'org') result = result.filter((b) => !b.isSystem);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(query) ||
          b.description?.toLowerCase().includes(query) ||
          b.renderKind.toLowerCase().includes(query)
      );
    }

    return result;
  }, [blocks, filter, searchQuery]);

  const appCount = blocks.filter((b) => b.isSystem).length;
  const orgCount = blocks.filter((b) => !b.isSystem).length;

  // ── Wiersze StandardTable (pochodne pola do filtrów/sortu kolumnowego) ───
  const rows = useMemo<TableRow[]>(
    () =>
      filteredBlocks.map((b) => ({
        ...b,
        id: b.id,
        type: b.isSystem ? 'app' : 'org',
        category: b.category || 'content',
        description: b.description || null,
      })),
    [filteredBlocks]
  );

  const previewBlock = previewId ? (blocks.find((b) => b.id === previewId) ?? null) : null;

  // ── Kolumny StandardTable ─────────────────────────────────────────────────
  const columns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'name',
        label: t(`${NS}.columns.block`, 'Block'),
        sortable: true,
      },
      {
        id: 'type',
        label: t(`${NS}.columns.type`, 'Type'),
        width: '110px',
        sortable: true,
        filterable: true,
        filterOptions: TYPE_FILTER_OPTIONS,
        render: (row: TableRow) => {
          const isSystem = row.type === 'app';
          const Icon = isSystem ? Package : Building2;
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-c-border bg-c-surface-raised px-2 py-0.5 text-[11px] font-medium text-c-text-secondary">
              <Icon size={11} className="shrink-0 text-c-text-muted" />
              {getTypeLabel(t, isSystem)}
            </span>
          );
        },
      },
      {
        id: 'category',
        label: t(`${NS}.columns.category`, 'Category'),
        width: '130px',
        sortable: true,
        filterable: true,
        filterOptions: CATEGORY_FILTER_OPTIONS,
        render: (row: TableRow) => (
          <TagChip
            label={CATEGORY_LABELS[(row.category as BlockCategory) || 'content']}
            tone={categoryTone(String(row.category || 'content'))}
          />
        ),
      },
      {
        id: 'renderKind',
        label: t(`${NS}.columns.render`, 'Render'),
        width: '160px',
        sortable: true,
        filterable: true,
        filterOptions: RENDER_FILTER_OPTIONS,
        render: (row: TableRow) => (
          <TagChip
            label={RENDER_LABELS[row.renderKind as BlockRenderKind] || String(row.renderKind)}
            tone={categoryTone(String(row.renderKind || ''))}
          />
        ),
      },
      {
        id: 'sourceTypes',
        label: t(`${NS}.columns.sources`, 'Sources'),
        width: '220px',
        render: (row: TableRow) => {
          const sources = (row.sourceTypes as string[]) || [];
          if (!sources.length) return <span className="text-xs text-c-text-muted">—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {sources.map((st) => (
                <TagChip key={st} label={st} tone={categoryTone(st)} />
              ))}
            </div>
          );
        },
      },
      {
        id: 'updatedAt',
        label: t(`${NS}.columns.updated`, 'Updated'),
        width: '170px',
        sortable: true,
        sortAccessor: (row: TableRow) => String(row.updatedAt || row.createdAt || ''),
        render: (row: TableRow) => (
          <div className="flex items-center gap-1.5 text-sm text-c-text-secondary">
            <Calendar size={12} className="text-c-text-secondary" />
            {formatDate(t, i18n.language, (row.updatedAt as string) || (row.createdAt as string))}
          </div>
        ),
      },
    ],
    [
      t,
      i18n.language,
      TYPE_FILTER_OPTIONS,
      CATEGORY_FILTER_OPTIONS,
      CATEGORY_LABELS,
      RENDER_FILTER_OPTIONS,
      RENDER_LABELS,
    ]
  );

  // ── Kebab — kontrakt 5 bloków (moduł deklaruje TYLKO bloki 1-3) ──────────
  const rowMenu = useCallback(
    (row: TableRow): StandardRowMenu => {
      const block = row as unknown as BlockType;
      return {
        primary: [
          {
            id: 'edit',
            label: t(`${NS}.rowMenu.edit`, 'Edit'),
            icon: Edit3,
            onClick: () => openEdit(block),
          },
          ...(block.isSystem
            ? [
                {
                  id: 'duplicate',
                  label: t(`${NS}.rowMenu.duplicateToOrg`, 'Duplicate to organization'),
                  icon: Copy,
                  note: t(`${NS}.rowMenu.comingSoon`, 'Coming soon (backend)'),
                },
              ]
            : []),
        ],
        universalHandlers: {
          preview: () => {
            jedenPanel.otworz();
            setPreviewId(block.id);
          },
          edit: () => openEdit(block),
        },
        destructive: block.isSystem
          ? { note: t(`${NS}.rowMenu.systemCannotDeactivate`, 'System blocks cannot be deactivated') }
          : {
              label: t(`${NS}.rowMenu.deactivate`, 'Deactivate'),
              icon: Trash2,
              onClick: () => deactivate(block),
            },
      };
    },
    [openEdit, deactivate, t, jedenPanel]
  );

  // ── Preview actions (StandardPreview) ────────────────────────────────────
  const previewActions: StandardPreviewActions | undefined = previewBlock
    ? {
        // canon §7.3 — "Edit" usunięte z resolutions: dublowało onOpenFull
        // przekazywane do StandardPreview w tym samym renderze (header ma już Open).
        resolutions: [
          ...(!previewBlock.isSystem
            ? [
                {
                  id: 'deactivate',
                  variant: 'destructive' as const,
                  label: t(`${NS}.rowMenu.deactivate`, 'Deactivate'),
                  icon: Trash2,
                  onClick: () => deactivate(previewBlock),
                },
              ]
            : []),
        ],
      }
    : undefined;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-c-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-c-surface-raised">
      {/* MENU 2/3 — wyłącznie przez fasadę (embedded: bez Menu 1 breadcrumb) */}
      <StandardModuleBar
        onSearch={setSearchQuery}
        searchValue={searchQuery}
        primaryCta={{ label: t(`${NS}.moduleBar.newBlock`, 'New Block'), icon: Plus, onClick: openCreate }}
        chips={[
          { id: 'all', label: t(`${NS}.moduleBar.all`, 'All'), count: blocks.length },
          { id: 'app', label: getTypeLabel(t, true), count: appCount },
          { id: 'org', label: getTypeLabel(t, false), count: orgCount },
        ]}
        activeChip={filter}
        onChipChange={(id) => setFilter(id as typeof filter)}
        bulk={
          selectedIds.size > 0
            ? {
                count: selectedIds.size,
                selectedLabel: t(`${NS}.moduleBar.selected`, '{{count}} selected', {
                  count: selectedIds.size,
                }),
                onSelectAll: () => setSelectedIds(new Set(rows.map((r) => String(r.id)))),
                selectAllLabel: t(`${NS}.moduleBar.selectAll`, 'Select all'),
                onClear: () => setSelectedIds(new Set()),
                clearLabel: t(`${NS}.moduleBar.clear`, 'Clear'),
                actions: [],
              }
            : null
        }
        activeFilters={activeFilters}
        onRemoveFilter={(id) => setActiveFilters((prev) => prev.filter((f) => f.id !== id))}
        onClearFilters={() => setActiveFilters([])}
      />

      {/* TABELA + PREVIEW */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-w-0 overflow-auto">
          <StandardTable
            columns={columns}
            data={rows}
            empty={{
              icon: Blocks,
              title: searchQuery
                ? t(`${NS}.empty.noMatchTitle`, 'No blocks match your search')
                : t(`${NS}.empty.noneTitle`, 'No blocks found'),
              description: searchQuery
                ? t(`${NS}.empty.tryAdjusting`, 'Try adjusting your search terms')
                : t(`${NS}.empty.createToStart`, 'Create a new block to get started'),
              actionLabel: searchQuery ? undefined : t(`${NS}.moduleBar.newBlock`, 'New Block'),
              onAction: searchQuery ? undefined : openCreate,
            }}
            selectedRowId={previewId}
            onRowClick={(row) => {
              jedenPanel.otworz();
              setPreviewId(String(row.id));
            }}
            onRowDoubleClick={(row) => openEdit(row as unknown as BlockType)}
            rowMenu={rowMenu}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            persistKey="reportBuilder.blockTypes"
            selection={{ selectedIds, onChange: setSelectedIds }}
          />
        </div>

        <JedenPrawyPanel rekord={previewBlock ? (
            <StandardPreview
              title={previewBlock.name}
              onClose={() => setPreviewId(null)}
              onOpenFull={() => openEdit(previewBlock)}
              meta={{
                pills: [
                  { label: getTypeLabel(t, Boolean(previewBlock.isSystem)), tone: 'neutral' },
                  { label: CATEGORY_LABELS[previewBlock.category || 'content'], tone: 'neutral' },
                  { label: RENDER_LABELS[previewBlock.renderKind], tone: 'neutral' },
                ],
                trailing: (
                  <span className="text-[11px] font-semibold text-c-text-secondary">
                    {formatDate(t, i18n.language, previewBlock.updatedAt || previewBlock.createdAt)}
                  </span>
                ),
              }}
              details={{
                text: [
                  previewBlock.description || '',
                  t(`${NS}.preview.sources`, 'Sources: {{sources}}', {
                    sources: (previewBlock.sourceTypes || []).join(', ') || '—',
                  }),
                  t(`${NS}.preview.defaultLength`, 'Default length: {{length}}', {
                    length: previewBlock.defaultLength || 'medium',
                  }),
                  t(`${NS}.preview.defaultStyle`, 'Default style: {{style}}', {
                    style: previewBlock.defaultLanguage || 'business',
                  }),
                  previewBlock.promptTemplate
                    ? `${t(`${NS}.preview.promptTemplate`, 'Prompt template:')}\n${previewBlock.promptTemplate}`
                    : '',
                ]
                  .filter(Boolean)
                  .join('\n\n'),
                onCopy: () => {
                  void navigator.clipboard?.writeText(
                    `${previewBlock.name} — ${previewBlock.renderKind}`
                  );
                },
              }}
              actions={previewActions}
            />
        ) : null} />
      </div>

      {/* Edit/Create Modal — poza zakresem kanonu list (edytor formularza) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-c-surface rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-c-border-subtle">
              <h3 className="font-semibold text-c-text">
                {editing ? t(`${NS}.modal.editTitle`, 'Edit Block') : t(`${NS}.modal.newTitle`, 'New Block')}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded hover:bg-c-surface-raised text-c-text-secondary hover:text-c-text-secondary transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-c-text mb-1">
                    {t(`${NS}.modal.name`, 'Name')}
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200/60 dark:border-white/[0.03] rounded-lg bg-c-surface text-c-text focus:border-c-accent focus:ring-1 focus:ring-c-focus transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-c-text mb-1">
                    {t(`${NS}.modal.renderKind`, 'Render Kind')}
                  </label>
                  <select
                    value={renderKind}
                    onChange={(e) => setRenderKind(e.target.value as BlockRenderKind)}
                    className="w-full px-3 py-2 border border-slate-200/60 dark:border-white/[0.03] rounded-lg bg-c-surface text-c-text focus:border-c-accent focus:ring-1 focus:ring-c-focus transition"
                  >
                    <option value="markdown">markdown</option>
                    <option value="callout">callout</option>
                    <option value="table">table</option>
                    <option value="chart">chart</option>
                    <option value="matrix">matrix</option>
                    <option value="json">json</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-c-text mb-1">
                  {t(`${NS}.modal.description`, 'Description')}
                </label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200/60 dark:border-white/[0.03] rounded-lg bg-c-surface text-c-text focus:border-c-accent focus:ring-1 focus:ring-c-focus transition"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-c-text mb-1">
                    {t(`${NS}.modal.sourcesCsv`, 'Sources (CSV)')}
                  </label>
                  <input
                    value={sourceTypesText}
                    onChange={(e) => setSourceTypesText(e.target.value)}
                    placeholder={t(`${NS}.modal.sourcesPlaceholder`, 'ASSESSMENT, TOOL')}
                    className="w-full px-3 py-2 border border-slate-200/60 dark:border-white/[0.03] rounded-lg bg-c-surface text-c-text focus:border-c-accent focus:ring-1 focus:ring-c-focus transition"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-c-text mb-1">
                      {t(`${NS}.modal.length`, 'Length')}
                    </label>
                    <select
                      value={defaultLength}
                      onChange={(e) => setDefaultLength(e.target.value as SectionLength)}
                      className="w-full px-3 py-2 border border-slate-200/60 dark:border-white/[0.03] rounded-lg bg-c-surface text-c-text focus:border-c-accent focus:ring-1 focus:ring-c-focus transition"
                    >
                      <option value="short">{t(`${NS}.modal.lengthShort`, 'Short')}</option>
                      <option value="medium">{t(`${NS}.modal.lengthMedium`, 'Medium')}</option>
                      <option value="long">{t(`${NS}.modal.lengthLong`, 'Long')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-c-text mb-1">
                      {t(`${NS}.modal.style`, 'Style')}
                    </label>
                    <select
                      value={defaultLanguage}
                      onChange={(e) => setDefaultLanguage(e.target.value as SectionLanguage)}
                      className="w-full px-3 py-2 border border-slate-200/60 dark:border-white/[0.03] rounded-lg bg-c-surface text-c-text focus:border-c-accent focus:ring-1 focus:ring-c-focus transition"
                    >
                      <option value="business">{t(`${NS}.modal.styleBusiness`, 'Business')}</option>
                      <option value="technical">{t(`${NS}.modal.styleTechnical`, 'Technical')}</option>
                      <option value="general">{t(`${NS}.modal.styleGeneral`, 'General')}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-c-text mb-1">
                  {t(`${NS}.modal.promptTemplate`, 'Prompt Template')}
                </label>
                <textarea
                  value={promptTemplate}
                  onChange={(e) => setPromptTemplate(e.target.value)}
                  rows={6}
                  placeholder={t(
                    `${NS}.modal.promptPlaceholder`,
                    'E.g. "Write a section about ... using data: {{exampleVar}}"',
                    { exampleVar: '{{facts}}' }
                  )}
                  className="w-full px-3 py-2 border border-slate-200/60 dark:border-white/[0.03] rounded-lg bg-c-surface text-c-text font-mono text-xs focus:border-c-accent focus:ring-1 focus:ring-c-focus transition"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-c-border-subtle">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-c-text-secondary hover:bg-c-surface-raised rounded-lg transition-colors"
              >
                {t(`${NS}.modal.cancel`, 'Cancel')}
              </button>
              <button
                onClick={save}
                disabled={!name.trim()}
                className="px-4 py-2 text-sm font-medium bg-c-text text-c-surface rounded-lg hover:brightness-110 shadow-lg disabled:opacity-50 transition"
              >
                {editing ? t(`${NS}.modal.saveChanges`, 'Save Changes') : t(`${NS}.modal.createBlock`, 'Create Block')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlockTypesManager;
