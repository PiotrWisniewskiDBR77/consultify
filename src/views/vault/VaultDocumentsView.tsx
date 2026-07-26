/**
 * VaultDocumentsView — WNĘTRZE SEJFU (Client Vault → dokumenty).
 *
 * ZASTĘPUJE stary ekran administracyjny (`DocumentsRAGTab` w wariancie 'client'),
 * który był wklejony w kartę sejfu i wyglądał jak panel serwisowy: nagłówek
 * „Document Vault", pod nim WIELKI formularz „Upload Knowledge Document"
 * zajmujący pół widoku, a dopiero pod spodem kafelki „INDEXED DOCUMENTS".
 * Ocena właściciela 2026-07-24: „nadzwyczajnie tandetnie brzydkie".
 *
 * Ekran jest teraz zwykłym ekranem LISTOWYM aplikacji, czyli triadą:
 *   Menu 1  — breadcrumb „Sejf klienta › [nazwa sejfu]" + kebab karty
 *   Menu 2  — lupa · filtr Kategoria · CTA „Dodaj dokument"
 *   Menu 3  — chipy licznikowe statusu indeksowania / pasek bulk przy zaznaczeniu
 *   Tabela  — <StandardTable> (pstryczek kolumn, sort, kebab wiersza, checkboxy)
 *   Preview — <StandardPreview> po kliknięciu wiersza
 * Formularz dodawania przeniesiony do panelu bocznego (`VaultDocumentPanel`).
 *
 * ROZDZIAŁ FILTRÓW (doktryna gęstości §1 „jedna akcja = jeden dom"): Kategoria
 * mieszka w Menu 2, status indeksowania w chipach Menu 3 — dlatego kolumny
 * Kategoria/Status NIE mają lejków (byłby ten sam filtr w dwóch miejscach).
 * Poziom nie ma filtra w ogóle: wewnątrz jednego sejfu jest z definicji stały
 * (GET leci z `?scope=`), więc filtr byłby martwą kontrolką — zostaje jako
 * KOLUMNA KONTEKSTU, tak jak prosi projekt.
 *
 * Kanon: `docs/ui-standards/TRIADA_KANON.md` (część B = lista odbioru).
 * Zero własnych tabel/menu/preview — wyłącznie `src/components/standard/`.
 */

import { Download, FileText, Info, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import type { FilterChip } from '@/components/shared/ModuleHub/ActiveFilters';
import { RowActionsMenu } from '@/components/shared/RowActionsMenu';
import {
  StandardModuleBar,
  StandardPreview,
  type StandardPreviewActions,
  standardPreviewShortcuts,
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard';
import { MetaChip, StatusChip } from '@/components/ui/primitives';
import { useAppStore } from '@/store/useAppStore';

import { Api } from '../../services/api';
import { VaultDocumentPanel } from './VaultDocumentPanel';
import {
  DOCUMENT_CATEGORIES,
  formatBytes,
  formatDate,
  indexStatusLabel,
  indexStatusTone,
  normalizeVaultDocuments,
  normalizeVaultProjects,
  scopeLabel,
  scopeMeta,
  type VaultDocument,
  type VaultProject,
  type VaultScope,
} from './vaultDocuments';

export interface VaultDocumentsViewProps {
  /** Sejf, w którym stoimy (wiersz z tabeli sejfów). */
  safe: { id: string; name: string; type: VaultScope; projectId: string | null };
  /** Powrót do tabeli sejfów (pierwszy człon breadcrumbu). */
  onBack: () => void;
}

type StatusChipId = 'all' | 'indexed' | 'processing' | 'failed';

const STATUS_GROUP = (status: string): Exclude<StatusChipId, 'all'> => {
  const tone = indexStatusTone(status);
  if (tone === 'success') return 'indexed';
  if (tone === 'danger') return 'failed';
  return 'processing';
};

const SELECT_CLASS =
  'h-9 rounded-lg border border-c-border bg-c-surface px-3 text-sm text-c-text transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

export const VaultDocumentsView: React.FC<VaultDocumentsViewProps> = ({ safe, onBack }) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const currentUserId = useAppStore((s) => s.currentUser?.id);

  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [projects, setProjects] = useState<VaultProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusChip, setStatusChip] = useState<StatusChipId>('all');
  // Lejek kolumny TAGI (kanon B.9). Tagi to jedyny wymiar, którego NIE obsługuje
  // ani Menu 2 (Kategoria), ani Menu 3 (status) — więc lejek nie dubluje niczego.
  const [tagFilters, setTagFilters] = useState<FilterChip[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  const [panelMode, setPanelMode] = useState<'add' | 'edit' | null>(null);
  const [editedDocument, setEditedDocument] = useState<VaultDocument | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await Api.getKnowledgeDocuments({
        scope: safe.type,
        projectId: safe.type === 'project' ? safe.projectId || undefined : undefined,
      });
      setDocuments(normalizeVaultDocuments(data));
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t(
              'vault.docs.loadError',
              isPolish ? 'Nie udało się wczytać dokumentów' : 'Failed to load documents'
            )
      );
      setDocuments([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safe.type, safe.projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    Api.getMyProjectMemberships()
      .then((data) => setProjects(normalizeVaultProjects(data)))
      .catch(() => setProjects([]));
  }, []);

  // ── Filtrowanie ──────────────────────────────────────────────────────────
  const tagOptions = useMemo(() => {
    const all = new Set<string>();
    documents.forEach((doc) => doc.tags.forEach((tag) => all.add(tag)));
    return [...all].sort((a, b) => a.localeCompare(b)).map((tag) => ({ value: tag, label: tag }));
  }, [documents]);

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    const wantedTags = tagFilters.filter((f) => f.column === 'tags').map((f) => f.value);
    return documents.filter((doc) => {
      const matchesCategory = !categoryFilter || doc.category === categoryFilter;
      const matchesTags =
        wantedTags.length === 0 || wantedTags.some((tag) => doc.tags.includes(tag));
      const matchesSearch =
        !q ||
        doc.filename.toLowerCase().includes(q) ||
        doc.tags.some((tag) => tag.toLowerCase().includes(q));
      return matchesCategory && matchesTags && matchesSearch;
    });
  }, [documents, search, categoryFilter, tagFilters]);

  const statusCounts = useMemo(() => {
    const counts = { all: searched.length, indexed: 0, processing: 0, failed: 0 };
    for (const doc of searched) counts[STATUS_GROUP(doc.status)] += 1;
    return counts;
  }, [searched]);

  const rows = useMemo(
    () =>
      statusChip === 'all'
        ? searched
        : searched.filter((d) => STATUS_GROUP(d.status) === statusChip),
    [searched, statusChip]
  );

  const selectedDocument = selectedId ? rows.find((d) => d.id === selectedId) || null : null;

  // Mirror backendu (`canEditOwnPrivateDocument`): poziom zmienia tylko właściciel
  // własnego prywatnego dokumentu — reszta to uprawnienie superadmina.
  const canChangeScope = useCallback(
    (doc: VaultDocument | null) =>
      !!doc && doc.scope === 'user' && !!currentUserId && doc.owner_id === currentUserId,
    [currentUserId]
  );

  // ── Akcje ────────────────────────────────────────────────────────────────
  const openEdit = useCallback((doc: VaultDocument) => {
    setEditedDocument(doc);
    setPanelMode('edit');
  }, []);

  const deleteDocuments = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const confirmed =
        typeof window === 'undefined'
          ? true
          : window.confirm(
              t('vault.docs.confirmDelete', {
                defaultValue: isPolish
                  ? 'Usunąć {{count}} dokument(y) z sejfu? Zniknie też z indeksu AI.'
                  : 'Delete {{count}} document(s)? They will also leave the AI index.',
                count: ids.length,
              })
            );
      if (!confirmed) return;
      try {
        await Promise.all(ids.map((id) => Api.deleteKnowledgeDocument(id)));
        toast.success(
          t('vault.docs.deleted', {
            defaultValue: isPolish
              ? 'Usunięto {{count}} dokument(y)'
              : 'Deleted {{count}} document(s)',
            count: ids.length,
          })
        );
        setSelectedRowIds(new Set());
        if (selectedId && ids.includes(selectedId)) setSelectedId(null);
        await load();
      } catch (err: unknown) {
        toast.error(
          err instanceof Error
            ? err.message
            : t('vault.docs.deleteFailed', isPolish ? 'Nie udało się usunąć' : 'Delete failed')
        );
      }
    },
    [t, isPolish, load, selectedId]
  );

  const exportCsv = useCallback(() => {
    const header = [
      t('vault.docs.colName', isPolish ? 'Nazwa' : 'Name'),
      t('vault.docs.colCategory', isPolish ? 'Kategoria' : 'Category'),
      t('vault.docs.colTags', isPolish ? 'Tagi' : 'Tags'),
      t('vault.docs.colLevel', isPolish ? 'Poziom' : 'Level'),
      t('vault.docs.colSize', isPolish ? 'Rozmiar' : 'Size'),
      t('vault.docs.colAdded', isPolish ? 'Dodano' : 'Added'),
      t('vault.docs.colStatus', isPolish ? 'Status indeksowania' : 'Index status'),
    ];
    const escape = (value: string) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const body = rows.map((doc) =>
      [
        doc.filename,
        doc.category || '',
        doc.tags.join(' | '),
        scopeLabel(doc.scope, isPolish),
        formatBytes(doc.file_size_bytes),
        formatDate(doc.created_at, isPolish),
        indexStatusLabel(doc.status, isPolish),
      ]
        .map(escape)
        .join(',')
    );
    const csv = [header.map(escape).join(','), ...body].join('\n');
    // BOM na starcie — bez niego Excel psuje polskie znaki w CSV.
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `${safe.name.replace(/[^\p{L}\p{N}-]+/gu, '-')}-dokumenty.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [rows, safe.name, t, isPolish]);

  // ── Kolumny tabeli ───────────────────────────────────────────────────────
  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'filename',
        label: t('vault.docs.colName', isPolish ? 'Nazwa' : 'Name'),
        width: '300px',
        sortable: true,
        render: (row: TableRow) => (
          <span className="flex min-w-0 items-center gap-2">
            <FileText size={14} className="shrink-0 text-c-text-muted" />
            <span className="truncate text-sm font-semibold text-c-text">
              {String(row.filename || '—')}
            </span>
          </span>
        ),
      },
      {
        id: 'category',
        label: t('vault.docs.colCategory', isPolish ? 'Kategoria' : 'Category'),
        width: '150px',
        sortable: true,
        render: (row: TableRow) =>
          row.category ? (
            <span className="text-sm text-c-text-secondary">{String(row.category)}</span>
          ) : (
            <span className="text-sm text-c-text-muted">—</span>
          ),
      },
      {
        id: 'tags',
        label: t('vault.docs.colTags', isPolish ? 'Tagi' : 'Tags'),
        width: '190px',
        filterable: true,
        filterOptions: tagOptions,
        render: (row: TableRow) => {
          const tags = (row.tags as string[]) || [];
          if (tags.length === 0) return <span className="text-sm text-c-text-muted">—</span>;
          return (
            <span className="flex min-w-0 flex-wrap items-center gap-1">
              {tags.slice(0, 2).map((tag) => (
                <MetaChip key={tag} label={tag} size="sm" />
              ))}
              {tags.length > 2 ? (
                <span className="text-[11px] text-c-text-muted">+{tags.length - 2}</span>
              ) : null}
            </span>
          );
        },
      },
      {
        id: 'scope',
        label: t('vault.docs.colLevel', isPolish ? 'Poziom' : 'Level'),
        width: '150px',
        render: (row: TableRow) => {
          const meta = scopeMeta(row.scope as VaultScope);
          const Icon = meta.icon;
          return (
            <span className="inline-flex items-center gap-1.5 text-sm text-c-text-secondary">
              <Icon size={13} className="shrink-0 text-c-text-muted" />
              {scopeLabel(row.scope as VaultScope, isPolish)}
            </span>
          );
        },
      },
      {
        id: 'file_size_bytes',
        label: t('vault.docs.colSize', isPolish ? 'Rozmiar' : 'Size'),
        width: '110px',
        align: 'right',
        sortable: true,
        sortAccessor: (row: TableRow) => Number(row.file_size_bytes) || 0,
        render: (row: TableRow) => (
          <span className="text-sm tabular-nums text-c-text-secondary">
            {formatBytes(row.file_size_bytes as number | null)}
          </span>
        ),
      },
      {
        id: 'created_at',
        label: t('vault.docs.colAdded', isPolish ? 'Dodano' : 'Added'),
        width: '130px',
        sortable: true,
        sortAccessor: (row: TableRow) => String(row.created_at || ''),
        render: (row: TableRow) => (
          <span className="text-sm text-c-text-muted">
            {formatDate(row.created_at as string, isPolish)}
          </span>
        ),
      },
      {
        id: 'status',
        label: t('vault.docs.colStatus', isPolish ? 'Status indeksowania' : 'Index status'),
        width: '160px',
        sortable: true,
        render: (row: TableRow) => (
          <StatusChip
            label={indexStatusLabel(String(row.status || ''), isPolish)}
            tone={indexStatusTone(String(row.status || ''))}
          />
        ),
      },
    ],
    [t, isPolish, tagOptions]
  );

  // ── Kebab wiersza (kontrakt 5 bloków; bloki 4/5 dokłada StandardTable) ───
  const buildRowMenu = useCallback(
    (doc: VaultDocument): StandardRowMenu => ({
      universalHandlers: {
        preview: () => setSelectedId(doc.id),
        edit: () => openEdit(doc),
        // Brak endpointu archiwizacji dokumentów wiedzy — pozycja zostaje
        // widoczna i wyłączona z powodem (kanon A6 blok 4: nigdy nie ukrywamy).
        archiveNote: t(
          'vault.docs.noArchive',
          isPolish ? 'Brak archiwum w Vault — użyj „Usuń”' : 'Vault has no archive — use “Delete”'
        ),
      },
      destructive: {
        label: t('common.delete', isPolish ? 'Usuń' : 'Delete'),
        icon: Trash2,
        onClick: () => void deleteDocuments([doc.id]),
      },
    }),
    [openEdit, deleteDocuments, t, isPolish]
  );

  // ── Preview (6 bloków fasady) ────────────────────────────────────────────
  const previewActions: StandardPreviewActions | undefined = useMemo(
    () =>
      selectedDocument
        ? {
            informational: [
              {
                id: 'edit-meta',
                variant: 'neutral',
                label: t('common.edit', isPolish ? 'Edytuj' : 'Edit'),
                icon: Pencil,
                shortcut: 'E',
                onClick: () => openEdit(selectedDocument),
              },
            ],
          }
        : undefined,
    [selectedDocument, openEdit, t, isPolish]
  );

  // Esc zamyka preview; skróty akcji działają przy otwartym preview (B.24/B.31).
  useEffect(() => {
    if (!selectedId) return;
    const shortcuts = standardPreviewShortcuts(previewActions);
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      if (panelMode) return; // panel boczny jest bardziej lokalny — on obsługuje Esc
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
  }, [selectedId, previewActions, panelMode]);

  // PreviewDetailsSection renderuje treść jako Markdown — pojedyncze `\n` by się
  // skleiły w jeden akapit, więc metadane idą listą punktowaną (czytelne pary
  // etykieta → wartość, jedna pod drugą).
  const previewDetailsRows: Array<[string, string]> = selectedDocument
    ? [
        [
          t('vault.docs.colCategory', isPolish ? 'Kategoria' : 'Category'),
          selectedDocument.category || '—',
        ],
        [
          t('vault.docs.colTags', isPolish ? 'Tagi' : 'Tags'),
          selectedDocument.tags.length > 0 ? selectedDocument.tags.join(', ') : '—',
        ],
        [
          t('vault.docs.colSize', isPolish ? 'Rozmiar' : 'Size'),
          formatBytes(selectedDocument.file_size_bytes),
        ],
        [
          t('vault.docs.chunks', isPolish ? 'Fragmenty w indeksie' : 'Indexed chunks'),
          String(selectedDocument.chunk_count),
        ],
        [
          t('vault.docs.colAdded', isPolish ? 'Dodano' : 'Added'),
          formatDate(selectedDocument.created_at, isPolish),
        ],
        [
          t('vault.docs.colLevel', isPolish ? 'Poziom' : 'Level'),
          scopeLabel(selectedDocument.scope, isPolish),
        ],
      ]
    : [];

  const previewDetails = previewDetailsRows
    .map(([label, value]) => `- **${label}:** ${value}`)
    .join('\n');

  const safeContextLabel = scopeLabel(safe.type, isPolish);

  return (
    <div className="flex h-full min-h-0 flex-col bg-c-bg">
      <StandardModuleBar
        breadcrumbs={[
          {
            label: t('vault.breadcrumb.root', isPolish ? 'Sejf klienta' : 'Client Vault'),
            onClick: onBack,
          },
          { label: safe.name },
        ]}
        breadcrumbExtra={
          <RowActionsMenu
            sections={[
              {
                id: 'safe',
                kind: 'context',
                actions: [
                  {
                    id: 'refresh',
                    label: t('common.refresh', isPolish ? 'Odśwież' : 'Refresh'),
                    icon: RefreshCw,
                    onClick: () => void load(),
                  },
                  {
                    id: 'export-csv',
                    label: t(
                      'vault.docs.exportCsv',
                      isPolish ? 'Eksportuj listę (CSV)' : 'Export list (CSV)'
                    ),
                    icon: Download,
                    onClick: exportCsv,
                    disabled: rows.length === 0,
                  },
                ],
              },
            ]}
          />
        }
        onSearch={setSearch}
        searchValue={search}
        filterControls={
          <select
            data-testid="vault-docs-category-filter"
            aria-label={t('vault.docs.colCategory', isPolish ? 'Kategoria' : 'Category')}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">
              {t('vault.docs.allCategories', isPolish ? 'Wszystkie kategorie' : 'All categories')}
            </option>
            {DOCUMENT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        }
        primaryCta={{
          label: t('vault.docs.add', isPolish ? 'Dodaj dokument' : 'Add document'),
          icon: Plus,
          onClick: () => {
            setEditedDocument(null);
            setPanelMode('add');
          },
          testId: 'vault-docs-add',
        }}
        chips={[
          {
            id: 'all',
            label: t('vault.docs.chipAll', isPolish ? 'Wszystkie' : 'All'),
            count: statusCounts.all,
          },
          {
            id: 'indexed',
            label: t('vault.docs.chipIndexed', isPolish ? 'Zindeksowane' : 'Indexed'),
            count: statusCounts.indexed,
            dot: 'bg-emerald-400',
          },
          {
            id: 'processing',
            label: t('vault.docs.chipProcessing', isPolish ? 'W trakcie' : 'Processing'),
            count: statusCounts.processing,
            dot: 'bg-amber-400',
          },
          {
            id: 'failed',
            label: t('vault.docs.chipFailed', isPolish ? 'Błąd' : 'Failed'),
            count: statusCounts.failed,
            dot: 'bg-red-400',
          },
        ]}
        activeChip={statusChip}
        onChipChange={(id) => setStatusChip(id as StatusChipId)}
        activeFilters={tagFilters}
        onRemoveFilter={(id) => setTagFilters((prev) => prev.filter((f) => f.id !== id))}
        onClearFilters={() => setTagFilters([])}
        bulk={
          selectedRowIds.size > 0
            ? {
                count: selectedRowIds.size,
                selectedLabel: t('vault.docs.selected', {
                  defaultValue: isPolish ? 'Zaznaczono: {{count}}' : '{{count}} selected',
                  count: selectedRowIds.size,
                }),
                onClear: () => setSelectedRowIds(new Set()),
                clearLabel: t('common.clear', isPolish ? 'Wyczyść' : 'Clear'),
                actions: [
                  {
                    id: 'bulk-delete',
                    label: t('common.delete', isPolish ? 'Usuń' : 'Delete'),
                    icon: Trash2,
                    variant: 'danger',
                    onClick: () => void deleteDocuments(Array.from(selectedRowIds)),
                  },
                ],
              }
            : null
        }
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-auto pb-4 pl-4 pr-1.5 pt-3">
          <StandardTable
            columns={columns}
            data={rows as unknown as TableRow[]}
            loading={loading}
            error={error}
            onRetry={() => void load()}
            selectedRowId={selectedId}
            onRowClick={(row) => setSelectedId(String(row.id))}
            onRowDoubleClick={(row) => openEdit(row as unknown as VaultDocument)}
            rowDescription={(row) =>
              t('vault.docs.rowDescription', {
                defaultValue: isPolish
                  ? '{{count}} fragmentów w indeksie AI'
                  : '{{count}} chunks in the AI index',
                count: Number(row.chunk_count) || 0,
              })
            }
            rowMenu={(row) => buildRowMenu(row as unknown as VaultDocument)}
            selection={{ selectedIds: selectedRowIds, onChange: setSelectedRowIds }}
            activeFilters={tagFilters}
            onFilterChange={setTagFilters}
            defaultSort={{ columnId: 'created_at', direction: 'desc' }}
            persistKey="vault.safe.documents"
            empty={{
              icon: FileText,
              title: t(
                'vault.docs.emptyTitle',
                isPolish ? 'Sejf jest pusty' : 'This safe is empty'
              ),
              description: t('vault.docs.emptyDescription', {
                defaultValue: isPolish
                  ? 'Dodaj pierwszy dokument — zostanie zindeksowany i AI będzie z niego korzystać w tym sejfie ({{level}}).'
                  : 'Add the first document — it gets indexed and AI will use it inside this safe ({{level}}).',
                level: safeContextLabel,
              }),
              actionLabel: t(
                'vault.docs.emptyCta',
                isPolish ? 'Dodaj pierwszy dokument' : 'Add the first document'
              ),
              onAction: () => {
                setEditedDocument(null);
                setPanelMode('add');
              },
            }}
          />
        </div>

        {selectedDocument ? (
          <aside className="w-[400px] shrink-0 overflow-hidden bg-slate-50 p-3 dark:bg-navy-950">
            <StandardPreview
              title={selectedDocument.filename}
              onClose={() => setSelectedId(null)}
              meta={{
                pills: [
                  {
                    label: indexStatusLabel(selectedDocument.status, isPolish),
                    tone: indexStatusTone(selectedDocument.status),
                  },
                  { label: scopeLabel(selectedDocument.scope, isPolish), tone: 'neutral' },
                  ...(selectedDocument.category
                    ? [{ label: selectedDocument.category, tone: 'neutral' as const }]
                    : []),
                ],
                trailing: (
                  <span className="text-[11px] font-semibold text-c-text-secondary">
                    {formatDate(selectedDocument.created_at, isPolish)}
                  </span>
                ),
                recommendation: (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-c-text-muted">
                    <Info size={12} />
                    {t('vault.docs.previewNote', {
                      defaultValue: isPolish
                        ? 'Dokument zasila odpowiedzi AI w tym sejfie ({{count}} fragmentów).'
                        : 'This document feeds AI answers inside this safe ({{count}} chunks).',
                      count: selectedDocument.chunk_count,
                    })}
                  </span>
                ),
              }}
              details={{
                text: previewDetails,
                label: t('vault.docs.detailsLabel', isPolish ? 'Metadane' : 'Metadata'),
                onCopy: () => {
                  const plain = previewDetailsRows
                    .map(([label, value]) => `${label}: ${value}`)
                    .join('\n');
                  void navigator.clipboard?.writeText(`${selectedDocument.filename}\n${plain}`);
                },
              }}
              ai={{
                hints: [
                  t('vault.docs.aiSummarize', isPolish ? 'Streść dokument' : 'Summarize document'),
                  t('vault.docs.aiFindings', isPolish ? 'Wyciągnij wnioski' : 'Extract findings'),
                ],
                disabled: true,
                disabledTooltip: t(
                  'common.comingSoonBackend',
                  isPolish ? 'Wkrótce (backend)' : 'Coming soon (backend)'
                ),
              }}
              relations={[]}
              relationsEmptyLabel={t(
                'vault.docs.noRelations',
                isPolish ? 'Brak powiązań' : 'No relations'
              )}
              actions={previewActions}
            />
          </aside>
        ) : null}
      </div>

      <VaultDocumentPanel
        open={panelMode !== null}
        mode={panelMode ?? 'add'}
        safeName={safe.name}
        safeScope={safe.type}
        safeProjectId={safe.projectId}
        document={editedDocument}
        canChangeScope={canChangeScope(editedDocument)}
        projects={projects}
        onClose={() => {
          setPanelMode(null);
          setEditedDocument(null);
        }}
        onSaved={() => void load()}
      />
    </div>
  );
};

export default VaultDocumentsView;
