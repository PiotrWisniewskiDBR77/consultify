/**
 * VaultDocumentsView — WNĘTRZE SEJFU (Client Vault → dokumenty).
 *
 * ZASTĘPUJE stary ekran administracyjny (`DocumentsRAGTab` w wariancie 'client'),
 * który był wklejony w kartę sejfu i wyglądał jak panel serwisowy: nagłówek
 * „Document Vault", pod nim WIELKI formularz „Upload Knowledge Document"
 * zajmujący pół widoku, a dopiero pod spodem kafelki „INDEXED DOCUMENTS".
 * Ocena właściciela 2026-07-24: „nadzwyczajnie tandetnie brzydkie".
 *
 * Ekran jest teraz zwykłym ekranem LISTOWYM aplikacji, osadzonym w JEDYNYM
 * pasku huba (`MyWorkHub`) przez `HubBarSlots` (2026-07-28, ★ HUBBARSLOTS
 * niżej) — Menu 1 (breadcrumb) NIE jest tu już renderowane (hub ma własny
 * breadcrumb globalny; powrót do listy sejfów zapewnia × karty w Menu 3 huba
 * / `onShowList`):
 *   Menu 2 (huba) — filtr Kategoria + kebab (Odśwież/Eksportuj CSV) + chipy
 *             statusu indeksowania (`filterControls`) · CTA „Dodaj dokument"
 *             (`primaryCta`).
 *   Menu 3 (huba) — karta otwartego sejfu doklejona do kart huba (`openItems`).
 *   Tabela  — <StandardTable> (pstryczek kolumn, sort, kebab wiersza, checkboxy)
 *   Preview — <StandardPreview> po kliknięciu wiersza
 * Formularz dodawania przeniesiony do panelu bocznego (`VaultDocumentPanel`).
 *
 * ROZDZIAŁ FILTRÓW (doktryna gęstości §1 „jedna akcja = jeden dom"): Kategoria
 * i status indeksowania mieszkają RAZEM w `filterControls` (patrz niżej), więc
 * kolumny Kategoria/Status NIE mają lejków (byłby ten sam filtr w dwóch
 * miejscach). Poziom nie ma filtra w ogóle: wewnątrz jednego sejfu jest z
 * definicji stały (GET leci z `?scope=`), więc filtr byłby martwą kontrolką —
 * zostaje jako KOLUMNA KONTEKSTU, tak jak prosi projekt.
 *
 * ★ HUBBARSLOTS (2026-07-28, sprzątanie chrome — audyt: sejf miał do 320px
 * (6 rzędów) nad obszarem roboczym, najgorzej w całej aplikacji; wzór 1:1
 * `AgentHubShell.tsx` + `src/components/shared/HubBarSlots.tsx`). Ten ekran
 * PRZESTAŁ rysować własny `StandardModuleBar` — hub (`MyWorkHub`, przez
 * `ClientDocumentsVault.tsx`) ma teraz JEDYNE Menu 2/3 na ekranie:
 *   - `filterControls` — select Kategorii + kebab (Odśwież/Eksportuj CSV,
 *     dawniej `breadcrumbExtra` Menu 1) + chipy statusu indeksowania (dawniej
 *     `chips`/`activeChip`/`onChipChange` Menu 3 tego komponentu) — WSZYSTKO
 *     RAZEM w jednym rzędzie Menu 2 huba.
 *   - `primaryCta` — „Dodaj dokument" (bez ikony — ten ekran świadomie jej nie
 *     podaje; kontrakt `HubBarPrimaryCta` NIESIE opcjonalną `icon` od AGT-015
 *     §6 D1, patrz `HubBarSlots.tsx` i `AgentHubShell.tsx` „Nowy agent").
 *   - `openItems`/`activeItemId`/`onSelectItem`/`onCloseItem`/`onShowList` —
 *     1:1 to samo, co szło wcześniej do `StandardModuleBar` (karta otwartego
 *     sejfu), teraz ląduje w Menu 3 huba.
 * ★ ZYSK UBOCZNY (VLT-007, naprawiony TU): stary kompromis „chipy statusu są
 * niewidoczne, dopóki karta jest w Menu 3" (bo `ModuleNavBar.commandRow` traktuje
 * `chips`+`openItems` jako tryby WYŁĄCZNE, patrz `ModuleNavBar.tsx` ok. linii 289)
 * PRZESTAJE dotyczyć tego ekranu — chipy status TERAZ mieszkają w `filterControls`
 * (Menu 2 huba), fizycznie w INNYM rzędzie niż `openItems` (Menu 3 huba prowadzony
 * przez `DynamicTabs`), więc oba są widoczne jednocześnie. Renderowane własnym
 * `Menu3Chip`/`Menu3Badge` (prymitywy z `ModuleMenu3`, nie przez prop `chips`
 * `StandardModuleBar`, bo `filterControls` przyjmuje `ReactNode`, nie kontrakt
 * chipów). Zweryfikowane w raporcie zadania (dev-render, jasny/ciemny motyw).
 *
 * ★ PUŁAPKA WSPÓŁDZIELONEGO SLOTU (dwa niezależne komponenty, `ClientDocumentsVault`
 * jako lista I `VaultDocumentsView` jako wnętrze, oba wołają `useHubBarSlot` —
 * inaczej niż `AgentHubShell`, gdzie jest to JEDEN komponent z warunkiem
 * wewnątrz): `register()` NADPISUJE cały slot („ostatni zapis wygrywa"), więc
 * `ClientDocumentsVault.handleBackToSafes` musi WYMUSIĆ ponowną rejestrację
 * listy PO zamknięciu tego ekranu (`resyncTick`, patrz komentarz tam) — bez
 * tego pole szukania sejfów zostawałoby puste po powrocie z sejfu.
 *
 * Kanon: `docs/ui-standards/TRIADA_KANON.md` (część B = lista odbioru).
 * Zero własnych tabel/menu/preview — wyłącznie `src/components/standard/`
 * + `useHubBarSlot` zamiast własnego paska.
 */

import {
  CheckCircle2,
  Download,
  FileText,
  Folder,
  Info,
  Layers,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useHubBarSlot } from '@/components/shared/HubBarSlots';
import { Menu3DropdownChip } from '@/components/shared/Menu3DropdownChip';
import type { FilterChip } from '@/components/shared/ModuleHub/ActiveFilters';
import type { OpenDocument } from '@/components/shared/ModuleHub/types';
import {
  MENU_3_ACTION_DANGER,
  MENU_3_ACTION_NEUTRAL,
  MENU_3_INNER_CLASS,
  MENU_3_LEFT_CLASS,
  MENU_3_RIGHT_CLASS,
  Menu3Badge,
  Menu3Chip,
} from '@/components/shared/ModuleMenu3';
import { RowActionsMenu } from '@/components/shared/RowActionsMenu';
import {
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
import { cn } from '@/utils/cn';

import { Api } from '../../services/api';
import { VaultDocumentPanel } from './VaultDocumentPanel';
import {
  applyVaultBulkActionWithReceipts,
  deleteVaultDocumentsWithReceipts,
  type VaultBulkReceipt,
} from './deleteVaultDocumentsWithReceipts';
import {
  DOCUMENT_CATEGORIES,
  formatBytes,
  formatDate,
  indexStatusLabel,
  indexStatusTone,
  normalizeVaultDocuments,
  normalizeVaultProjects,
  safeDisplayName,
  scopeLabel,
  scopeMeta,
  type VaultDocument,
  type VaultProject,
  type VaultScope,
} from './vaultDocuments';
import { shouldAutoRefreshVaultIndex } from './vaultIndexRefreshPolicy';

export interface VaultDocumentsViewProps {
  /** Sejf, w którym stoimy (wiersz z tabeli sejfów). */
  safe: { id: string; name: string; type: VaultScope; projectId: string | null };
  /** Powrót do tabeli sejfów (pierwszy człon breadcrumbu). */
  onBack: () => void;
  initialFolderId?: string | null;
}

type StatusChipId = 'all' | 'indexed' | 'processing' | 'failed';

const STATUS_GROUP = (status: string): Exclude<StatusChipId, 'all'> => {
  const tone = indexStatusTone(status);
  if (tone === 'success') return 'indexed';
  if (tone === 'danger') return 'failed';
  if (tone === 'warning') return 'processing';
  // Unknown backend states need attention but must not create endless polling.
  return 'failed';
};

// Kształt 1:1 z pigułkami filtrów obok (Folder / Wszystkie / Zindeksowane…) —
// uwaga Piotra 2026-07-28: w jednym rzędzie filtrów wszystkie kontrolki mają
// mieć ten sam kształt, inaczej rząd wygląda na sklejony z dwóch systemów.
const SELECT_CLASS =
  'h-9 rounded-full border border-c-border bg-c-surface px-3.5 text-sm text-c-text transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

export const VaultDocumentsView: React.FC<VaultDocumentsViewProps> = ({
  safe,
  onBack,
  initialFolderId = null,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const currentUserId = useAppStore((s) => s.currentUser?.id);

  // FIX-19 (Day 3 layer-2 acceptance): system safes (`user`/`organization`)
  // ship a neutral English `name` from the server on purpose — this screen
  // must localize it the same way `VaultSafesTable` already does, or the
  // breadcrumb card / "Sejf: …" line show literal "My safe" in a Polish UI.
  const displaySafeName = safeDisplayName(safe, isPolish, t);

  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [projects, setProjects] = useState<VaultProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backgroundRefreshError, setBackgroundRefreshError] = useState<string | null>(null);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);
  const loadSequenceRef = useRef(0);
  const pollInFlightRef = useRef(false);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusChip, setStatusChip] = useState<StatusChipId>('all');
  // Lejek kolumny TAGI (kanon B.9). Tagi to jedyny wymiar, którego NIE obsługuje
  // ani Menu 2 (Kategoria), ani Menu 3 (status) — więc lejek nie dubluje niczego.
  const [tagFilters, setTagFilters] = useState<FilterChip[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  // MYW-CV-REC-003 — dynamiczny kwit per element po akcji zbiorczej (usuń /
  // dodaj do wiedzy AI), zamiast wyłącznie zbiorczego toasta.
  const [bulkReceipts, setBulkReceipts] = useState<{
    label: string;
    items: VaultBulkReceipt[];
  } | null>(null);

  const [panelMode, setPanelMode] = useState<'add' | 'edit' | null>(null);
  const [editedDocument, setEditedDocument] = useState<VaultDocument | null>(null);

  const load = useCallback(
    async (options?: { background?: boolean }) => {
      const background = options?.background === true;
      const sequence = ++loadSequenceRef.current;
      if (!background) {
        setLoading(true);
        setError(null);
      }
      try {
        const data = await Api.getKnowledgeDocuments({
          scope: safe.type,
          projectId: safe.type === 'project' ? safe.projectId || undefined : undefined,
        });
        if (sequence !== loadSequenceRef.current) return;
        setDocuments(normalizeVaultDocuments(data));
        setBackgroundRefreshError(null);
      } catch (err: unknown) {
        if (sequence !== loadSequenceRef.current) return;
        const message =
          err instanceof Error
            ? err.message
            : t(
                'vault.docs.loadError',
                isPolish ? 'Nie udało się wczytać dokumentów' : 'Failed to load documents'
              );
        if (background) {
          setBackgroundRefreshError(message);
        } else {
          setError(message);
          setDocuments([]);
        }
      } finally {
        if (!background && sequence === loadSequenceRef.current) setLoading(false);
      }
    },
    [safe.type, safe.projectId, t, isPolish]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const refreshInBackground = useCallback(async () => {
    if (pollInFlightRef.current) return;
    pollInFlightRef.current = true;
    setBackgroundRefreshing(true);
    try {
      await load({ background: true });
    } finally {
      pollInFlightRef.current = false;
      setBackgroundRefreshing(false);
    }
  }, [load]);

  // MYW-CV-REC-008 — an opened safe refreshes index progress itself. Poll only
  // while a document is genuinely in-flight; settled lists make no background
  // requests. The user no longer has to discover a manual Refresh command.
  useEffect(() => {
    const hasProcessingDocument = shouldAutoRefreshVaultIndex(
      documents.map((document) => document.status)
    );
    if (!hasProcessingDocument) return;
    const timer = window.setInterval(() => void refreshInBackground(), 5000);
    return () => window.clearInterval(timer);
  }, [documents, refreshInBackground]);

  useEffect(() => {
    Api.getMyProjectMemberships()
      .then((data) => setProjects(normalizeVaultProjects(data)))
      .catch(() => setProjects([]));
  }, []);

  // ── Foldery WEWNĄTRZ tego sejfu (★ VLT-FOLDERS) ─────────────────────────
  // Wzór 1:1 `MyIdeasListContent.tsx` §"Load folders": endpoint może jeszcze
  // nie mieć migracji na danej bazie — `foldersAvailable` chroni UI, nic się
  // nie psuje wcześniej (fail-soft, tak jak `my_idea_folders`).
  const [folders, setFolders] = useState<Array<{ id: string; name: string }>>([]);
  const [foldersAvailable, setFoldersAvailable] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(initialFolderId);

  const loadFolders = useCallback(async () => {
    try {
      const list = await Api.getVaultFolders({
        scope: safe.type,
        projectId: safe.type === 'project' ? safe.projectId : undefined,
      });
      setFolders(list.map((f) => ({ id: f.id, name: f.name })));
      setFoldersAvailable(true);
    } catch {
      setFoldersAvailable(false);
    }
  }, [safe.type, safe.projectId]);

  useEffect(() => {
    setActiveFolderId(null);
    void loadFolders();
  }, [loadFolders]);

  const handleDeleteFolder = useCallback(
    async (folderId: string) => {
      try {
        await Api.deleteVaultFolder(folderId);
        setFolders((prev) => prev.filter((f) => f.id !== folderId));
        if (activeFolderId === folderId) setActiveFolderId(null);
        await load(); // dokumenty z tego folderu wracają jako "bez folderu"
      } catch (err: unknown) {
        toast.error(
          err instanceof Error
            ? err.message
            : t(
                'vault.docs.folderDeleteFailed',
                isPolish ? 'Nie udało się usunąć folderu' : 'Failed to delete folder'
              )
        );
      }
    },
    [activeFolderId, load, t, isPolish]
  );

  const handleMoveToFolder = useCallback(
    async (doc: VaultDocument, folderId: string | null) => {
      setDocuments((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, folder_id: folderId } : d))
      );
      try {
        await Api.updateKnowledgeDocument(doc.id, { folderId });
        toast.success(t('vault.docs.folderMoved', isPolish ? 'Przeniesiono' : 'Moved'), {
          duration: 800,
        });
      } catch (err: unknown) {
        toast.error(
          err instanceof Error
            ? err.message
            : t(
                'vault.docs.folderMoveFailed',
                isPolish ? 'Nie udało się przenieść dokumentu' : 'Failed to move document'
              )
        );
        await load();
      }
    },
    [load, t, isPolish]
  );

  const folderNameById = useMemo(() => {
    const map = new Map<string, string>();
    folders.forEach((f) => map.set(f.id, f.name));
    return map;
  }, [folders]);

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
      const matchesFolder = !activeFolderId || doc.folder_id === activeFolderId;
      return matchesCategory && matchesTags && matchesSearch && matchesFolder;
    });
  }, [documents, search, categoryFilter, tagFilters, activeFolderId]);

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
      const receipts = await deleteVaultDocumentsWithReceipts(ids, (id) =>
        Api.deleteKnowledgeDocument(id)
      );
      const deleted = receipts.filter((receipt) => receipt.status === 'deleted');
      const failed = receipts.filter((receipt) => receipt.status === 'failed');
      if (deleted.length > 0) {
        toast.success(
          t('vault.docs.deleted', {
            defaultValue: isPolish
              ? 'Usunięto {{count}} dokument(y)'
              : 'Deleted {{count}} document(s)',
            count: deleted.length,
          })
        );
      }
      if (failed.length > 0) {
        toast.error(
          t('vault.docs.deletePartial', {
            defaultValue: isPolish
              ? 'Usunięto {{deleted}} z {{total}}. Nie udało się: {{failedIds}}'
              : 'Deleted {{deleted}} of {{total}}. Failed: {{failedIds}}',
            deleted: deleted.length,
            total: ids.length,
            failedIds: failed.map((receipt) => receipt.id).join(', '),
          })
        );
      }
      // MYW-CV-REC-003 — kwit per element widoczny bezpośrednio na listwie,
      // nie tylko w toaście, dopóki użytkownik go nie zamknie.
      setBulkReceipts({
        label: t('vault.docs.bulkReceiptsDelete', isPolish ? 'Usuwanie' : 'Delete'),
        items: receipts,
      });
      setSelectedRowIds(new Set(failed.map((receipt) => receipt.id)));
      if (selectedId && deleted.some((receipt) => receipt.id === selectedId)) setSelectedId(null);
      if (deleted.length > 0) await load();
    },
    [t, isPolish, load, selectedId]
  );

  // MYW-CV-REC-003 — druga akcja zbiorcza (prototyp: "Dodaj do wiedzy AI"),
  // nie tylko delete — z tym samym rejestrem kwitów per element.
  const addDocumentsToAiKnowledge = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const receipts = await applyVaultBulkActionWithReceipts(
        ids,
        (id) => Api.updateKnowledgeDocument(id, { ai_visibility: 'allowed' }),
        'applied'
      );
      const applied = receipts.filter((receipt) => receipt.status === 'applied');
      const failed = receipts.filter((receipt) => receipt.status === 'failed');
      if (applied.length > 0) {
        toast.success(
          t('vault.docs.addedToAiKnowledge', {
            defaultValue: isPolish
              ? 'Dodano {{count}} dokument(y) do wiedzy AI'
              : 'Added {{count}} document(s) to AI knowledge',
            count: applied.length,
          })
        );
      }
      if (failed.length > 0) {
        toast.error(
          t('vault.docs.addToAiKnowledgePartial', {
            defaultValue: isPolish
              ? 'Dodano {{applied}} z {{total}}. Nie udało się: {{failedIds}}'
              : 'Added {{applied}} of {{total}}. Failed: {{failedIds}}',
            applied: applied.length,
            total: ids.length,
            failedIds: failed.map((receipt) => receipt.id).join(', '),
          })
        );
      }
      setBulkReceipts({
        label: t('vault.docs.bulkReceiptsAiKnowledge', isPolish ? 'Dodawanie do wiedzy AI' : 'Add to AI knowledge'),
        items: receipts,
      });
      if (applied.length > 0) await load();
    },
    [t, isPolish, load]
  );

  const exportCsv = useCallback(() => {
    const header = [
      t('vault.docs.colName', isPolish ? 'Nazwa' : 'Name'),
      t('vault.docs.colCategory', isPolish ? 'Kategoria' : 'Category'),
      t('vault.docs.colTags', isPolish ? 'Tagi' : 'Tags'),
      t('vault.docs.colFolder', isPolish ? 'Folder' : 'Folder'),
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
        (doc.folder_id && folderNameById.get(doc.folder_id)) || '',
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
  }, [rows, safe.name, t, isPolish, folderNameById]);

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
      // ★ VLT-FOLDERS — kolumna KONTEKSTU (jak "Poziom"/"W wiedzy AI"): pokazuje
      // W KTÓRYM folderze tego sejfu żyje dokument. Bez lejka — filtr folderu
      // mieszka w pasku nad tabelą (dropdown "Folder"), nie tu (kanon gęstości
      // §"jedna akcja = jeden dom" — patrz `filterBarNode`).
      {
        id: 'folder',
        label: t('vault.docs.colFolder', isPolish ? 'Folder' : 'Folder'),
        width: '150px',
        sortable: true,
        sortAccessor: (row: TableRow) =>
          (row.folder_id && folderNameById.get(row.folder_id as string)) || '',
        render: (row: TableRow) => {
          const name = row.folder_id ? folderNameById.get(row.folder_id as string) : null;
          return name ? (
            <span className="inline-flex min-w-0 items-center gap-1.5 text-sm text-c-text-secondary">
              <Folder size={13} className="shrink-0 text-c-text-muted" />
              <span className="truncate">{name}</span>
            </span>
          ) : (
            <span className="text-sm text-c-text-muted">—</span>
          );
        },
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
      // ★ Kolumna kontekstu — gotowość RAG (chunk_count już wraca z API, zero
      // kosztu backendu). Odpowiada na pytanie biznesowe „czy AI faktycznie
      // z tego korzysta", nie tylko techniczne "ile fragmentów": 0 przy
      // statusie „Zindeksowany" = dokument NIE wszedł do wiedzy mimo statusu
      // (sygnał widoczny jako „—" + tooltip, bez czerwieni-stanu). Decyzja CTO
      // 2026-07-28 (przycięcie z 3 do 1 nowej kolumny): jedyna z trzech, która
      // niesie realną informację — „Projekt"/„Dodane przez" usunięte (patrz
      // historia gita), bo w tym widoku były stałe/nieczytelne (surowe ID).
      {
        id: 'chunk_count',
        label: t('vault.docs.colChunks', isPolish ? 'W wiedzy AI' : 'In AI knowledge'),
        width: '110px',
        align: 'right',
        sortable: true,
        sortAccessor: (row: TableRow) => Number(row.chunk_count) || 0,
        render: (row: TableRow) => {
          const count = Number(row.chunk_count) || 0;
          if (count === 0) {
            return (
              <span
                className="text-sm tabular-nums text-c-text-muted"
                title={t(
                  'vault.docs.chunksZeroTooltip',
                  isPolish ? 'Dokument nie wszedł jeszcze do wiedzy AI' : 'Not in AI knowledge yet'
                )}
              >
                —
              </span>
            );
          }
          return <span className="text-sm tabular-nums text-c-text-secondary">{count}</span>;
        },
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
    [t, isPolish, tagOptions, folderNameById]
  );

  // ── Kebab wiersza (kontrakt 5 bloków; bloki 4/5 dokłada StandardTable) ───
  const buildRowMenu = useCallback(
    (doc: VaultDocument): StandardRowMenu => ({
      primary: [
        {
          id: 'move-folder',
          label: t('vault.docs.moveToFolder', isPolish ? 'Przenieś do folderu' : 'Move to folder'),
          icon: Folder,
          disabled: folders.length === 0,
          note:
            folders.length === 0
              ? t(
                  'vault.docs.moveToFolderNote',
                  isPolish
                    ? 'Brak dostępnych folderów na tym poziomie'
                    : 'No folders are available at this level'
                )
              : undefined,
          submenu: [
            {
              id: 'folder-none',
              label: t('vault.docs.noFolder', isPolish ? 'Bez folderu' : 'No folder'),
              icon: Layers,
              disabled: !doc.folder_id,
              onClick: () => void handleMoveToFolder(doc, null),
            },
            ...folders.map((f) => ({
              id: `folder-${f.id}`,
              label: f.name,
              icon: Folder,
              disabled: doc.folder_id === f.id,
              onClick: () => void handleMoveToFolder(doc, f.id),
            })),
          ],
        },
      ],
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
    [openEdit, deleteDocuments, handleMoveToFolder, folders, t, isPolish]
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

  // ── Karta w Menu 3 (wzór AgentHubShell.tsx §"Karta w Menu 3") ────────────
  // Ten ekran istnieje TYLKO gdy sejf jest otwarty (nie ma tu stanu
  // "lista + karty" w jednym komponencie jak w AgentHubShell) — więc karta
  // jest zawsze dokładnie jedna i zawsze aktywna. `onSelectItem` nie ma
  // drugiego stanu do przełączenia (jedyna karta = już aktywna), więc jest
  // no-opem; `onCloseItem` (×) i `onShowList` ("Lista") oba wracają do
  // tabeli sejfów — jedyne dostępne "zamknięcie" tego ekranu.
  const openItems: OpenDocument[] = useMemo(
    () => [
      { id: safe.id, type: 'tool', subType: 'vault-safe', name: displaySafeName, status: 'DONE' },
    ],
    [safe.id, displaySafeName]
  );
  const handleSelectItem = useCallback(() => undefined, []);

  // Etykiety chipów statusu — memoizowane osobno (zależą tylko od t/isPolish),
  // żeby `filterControlsNode` niżej nie tracił referencji przy każdej zmianie
  // statusCounts (patrz pułapka `useHubBarSlot`: stabilne referencje albo pętla
  // render→register→render, komentarz w `HubBarSlots.tsx`).
  const statusChipDefs: Array<{ id: StatusChipId; label: string; dot?: string }> = useMemo(
    () => [
      {
        id: 'all' as StatusChipId,
        label: t('vault.docs.chipAll', isPolish ? 'Wszystkie' : 'All'),
        dot: undefined,
      },
      {
        id: 'indexed' as StatusChipId,
        label: t('vault.docs.chipIndexed', isPolish ? 'Zindeksowane' : 'Indexed'),
        dot: 'bg-emerald-400',
      },
      {
        id: 'processing' as StatusChipId,
        label: t('vault.docs.chipProcessing', isPolish ? 'W trakcie' : 'Processing'),
        dot: 'bg-amber-400',
      },
      {
        id: 'failed' as StatusChipId,
        label: t('vault.docs.chipFailed', isPolish ? 'Błąd' : 'Failed'),
        dot: 'bg-red-400',
      },
    ],
    [t, isPolish]
  );

  // ── Pasek filtrów DOKUMENTÓW — renderowany LOKALNIE nad tabelą ───────────
  //
  // ★ KOREKTA WŁAŚCICIELA (2026-07-27, po pierwszym wdrożeniu): pierwotnie te
  // kontrolki szły do `filterControls` slotu huba (Menu 2). Piotr odrzucił to
  // na żywym demo: „to, co się pojawiło w menu drugim po prawej stronie, nie
  // jest w ogóle tu potrzebne […] jak się otworzy karta, to tego po prostu nie
  // widać, bo nie widzimy teraz przecież konkretnej listy".
  //
  // ZASADA (do stosowania w całej aplikacji): pasek huba to NAWIGACJA —
  // co jest otwarte i czym się przełączam. Filtry listy należą do TREŚCI, więc
  // gdy lista jest zawartością OTWARTEJ KARTY (jak dokumenty wewnątrz sejfu),
  // jej filtry siedzą w obszarze roboczym nad tą listą, a nie w pasku
  // gospodarza. Do slotu huba idą tylko: karta obiektu (Menu 3) i CTA.
  //
  // Zawartość bez zmian względem poprzedniej wersji: lupa + Kategoria + chipy
  // statusu indeksowania (VLT-007 — nadal widoczne, bo nie konkurują już z
  // kartą o ten sam rząd) + kebab (Odśwież / Eksportuj CSV).
  const filterBarNode = useMemo(
    () => (
      <div className="flex flex-wrap items-center gap-2 pb-2">
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-c-text-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(
              'vault.docs.searchPlaceholder',
              isPolish ? 'Szukaj dokumentu…' : 'Search documents…'
            )}
            aria-label={t('vault.docs.colName', isPolish ? 'Nazwa' : 'Name')}
            className="h-9 w-44 rounded-full border border-c-border bg-c-surface pl-8 pr-3.5 text-sm text-c-text placeholder:text-c-text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          />
        </div>
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
        {foldersAvailable ? (
          <Menu3DropdownChip
            data-testid="vault-docs-folder-chip"
            icon={<Folder size={14} className="text-c-text-muted" />}
            label={
              activeFolderId
                ? folderNameById.get(activeFolderId) || t('vault.docs.folder', 'Folder')
                : t('vault.docs.folder', 'Folder')
            }
            active={Boolean(activeFolderId)}
            ariaLabel={t('vault.docs.folder', 'Folder')}
            items={[
              {
                id: 'all',
                label: t(
                  'vault.docs.allFolders',
                  isPolish ? 'Wszystkie dokumenty' : 'All documents'
                ),
                icon: <Layers size={14} />,
                active: !activeFolderId,
                onSelect: () => setActiveFolderId(null),
              },
              ...folders.map((f) => ({
                id: f.id,
                label: f.name,
                icon: <Folder size={14} />,
                active: activeFolderId === f.id,
                trailing: activeFolderId === f.id ? '✓' : undefined,
                onSelect: () => setActiveFolderId(f.id),
              })),
              ...(activeFolderId
                ? [
                    {
                      id: 'delete-folder',
                      label: t(
                        'vault.docs.deleteFolder',
                        isPolish ? 'Usuń ten folder' : 'Delete this folder'
                      ),
                      icon: <Trash2 size={14} />,
                      danger: true,
                      onSelect: () => void handleDeleteFolder(activeFolderId),
                    },
                  ]
                : []),
            ]}
          />
        ) : null}
        <div className="flex items-center gap-1">
          {statusChipDefs.map(({ id, label, dot }) => (
            <Menu3Chip key={id} active={statusChip === id} onClick={() => setStatusChip(id)}>
              {dot ? <span className={cn('h-1.5 w-1.5 rounded-full', dot)} /> : null}
              {label}
              <Menu3Badge count={statusCounts[id]} active={statusChip === id} />
            </Menu3Chip>
          ))}
        </div>
        <RowActionsMenu
          size="sm"
          sections={[
            {
              id: 'safe',
              kind: 'context',
              actions: [
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
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      search,
      categoryFilter,
      statusChip,
      statusCounts,
      statusChipDefs,
      rows.length,
      exportCsv,
      t,
      isPolish,
      foldersAvailable,
      folders,
      activeFolderId,
      folderNameById,
      handleDeleteFolder,
    ]
  );

  const primaryCtaValue = useMemo(
    () => ({
      label: t('vault.docs.add', isPolish ? 'Dodaj dokument' : 'Add document'),
      onClick: () => {
        setEditedDocument(null);
        setPanelMode('add');
      },
      testId: 'vault-docs-add',
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, isPolish]
  );

  // Do paska huba idzie WYŁĄCZNIE nawigacja (karta otwartego sejfu w Menu 3)
  // i jeden CTA. Filtry dokumentów — patrz `filterBarNode` wyżej — zostają
  // w obszarze roboczym, bo dotyczą treści karty, nie huba.
  useHubBarSlot({
    primaryCta: primaryCtaValue,
    openItems,
    activeItemId: safe.id,
    onSelectItem: handleSelectItem,
    onCloseItem: onBack,
    onShowList: onBack,
  });

  // Pasek zaznaczenia — RENDEROWANY LOKALNIE nad tabelą (wzór 1:1
  // `AgentHubShell.tsx` §"Pasek zaznaczenia"): `HubBarSlotValue` nie ma slotu
  // na `bulk` (poza mandatem tego zadania — zgłoszone w raporcie), więc
  // dublujemy TYLKO wygląd dawnego `StandardModuleBar.bulk` (te same klasy
  // `MENU_3_*`/`Menu3Chip`) bezpośrednio nad tabelą.
  const renderBulkBar = () => {
    if (selectedRowIds.size === 0 && !bulkReceipts) return null;
    const nameById = new Map(documents.map((doc) => [doc.id, doc.filename]));
    return (
      <div className="pb-2">
        {selectedRowIds.size > 0 ? (
          <div className={MENU_3_INNER_CLASS}>
            <div className={MENU_3_LEFT_CLASS}>
              <span className="inline-flex h-7 items-center rounded-full px-2.5 text-[11px] font-semibold text-c-text whitespace-nowrap">
                {t('vault.docs.selected', {
                  defaultValue: isPolish ? 'Zaznaczono: {{count}}' : '{{count}} selected',
                  count: selectedRowIds.size,
                })}
              </span>
              <Menu3Chip
                onClick={() => {
                  setSelectedRowIds(new Set());
                  setBulkReceipts(null);
                }}
              >
                {t('common.clear', isPolish ? 'Wyczyść' : 'Clear')}
              </Menu3Chip>
            </div>
            <div className={MENU_3_RIGHT_CLASS}>
              {/* MYW-CV-REC-003 — dynamiczna listwa: druga akcja zbiorcza obok
                  Delete, nie tylko all-or-nothing. */}
              <button
                type="button"
                onClick={() => void addDocumentsToAiKnowledge(Array.from(selectedRowIds))}
                className={MENU_3_ACTION_NEUTRAL}
              >
                <Sparkles size={12} />
                {t('vault.docs.addToAiKnowledge', isPolish ? 'Dodaj do wiedzy AI' : 'Add to AI knowledge')}
              </button>
              <button
                type="button"
                onClick={() => void deleteDocuments(Array.from(selectedRowIds))}
                className={MENU_3_ACTION_DANGER}
              >
                <Trash2 size={12} />
                {t('common.delete', isPolish ? 'Usuń' : 'Delete')}
              </button>
            </div>
          </div>
        ) : null}
        {/* MYW-CV-REC-003 — kwit per element: co dokładnie zostało
            potwierdzone/odrzucone, nie tylko zbiorczy toast. */}
        {bulkReceipts ? (
          <div
            data-testid="vault-bulk-receipts"
            className="mt-2 overflow-hidden rounded-xl border border-c-border-subtle bg-c-surface"
          >
            <div className="flex items-center gap-2 border-b border-c-border-subtle px-3.5 py-2.5">
              <span className="text-xs font-semibold text-c-text">{bulkReceipts.label}</span>
              <span className="text-[11px] text-c-text-muted">
                {t('vault.docs.bulkReceiptsCount', {
                  defaultValue: isPolish
                    ? '{{count}} element(y)'
                    : '{{count}} item(s)',
                  count: bulkReceipts.items.length,
                })}
              </span>
              <button
                type="button"
                onClick={() => setBulkReceipts(null)}
                aria-label={t('common.close', isPolish ? 'Zamknij' : 'Close')}
                className="ml-auto rounded-md p-1 text-c-text-muted hover:bg-c-surface-raised hover:text-c-text"
              >
                <X size={13} />
              </button>
            </div>
            <ul>
              {bulkReceipts.items.map((receipt) => (
                <li
                  key={receipt.id}
                  className="flex items-center gap-2.5 border-b border-c-border-subtle px-3.5 py-2 text-[12.5px] last:border-b-0"
                >
                  {receipt.status === 'failed' ? (
                    <XCircle size={14} className="shrink-0 text-c-danger" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 size={14} className="shrink-0 text-c-success" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-c-text">
                    {nameById.get(receipt.id) || receipt.id}
                  </span>
                  <span
                    className={
                      receipt.status === 'failed' ? 'text-c-danger' : 'text-c-text-muted'
                    }
                  >
                    {receipt.status === 'failed'
                      ? receipt.reason ||
                        t('vault.docs.bulkReceiptFailed', isPolish ? 'Nie udało się' : 'Failed')
                      : t('vault.docs.bulkReceiptOk', isPolish ? 'Gotowe' : 'Done')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-c-bg">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-auto pb-4 pl-4 pr-1.5 pt-3">
          {filterBarNode}
          {renderBulkBar()}
          {backgroundRefreshError ? (
            <div
              role="alert"
              data-testid="vault-background-refresh-error"
              className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
            >
              <span>
                {t(
                  'vault.docs.backgroundRefreshError',
                  isPolish
                    ? 'Nie udało się odświeżyć statusu indeksowania. Pokazujemy ostatnie poprawne dane.'
                    : 'Index status could not be refreshed. Showing the last successful data.'
                )}
              </span>
              <button
                type="button"
                disabled={backgroundRefreshing}
                className="shrink-0 rounded-md border border-current px-2 py-1 text-xs font-semibold"
                onClick={() => void refreshInBackground()}
              >
                {backgroundRefreshing
                  ? t('common.loading', isPolish ? 'Odświeżanie…' : 'Refreshing…')
                  : t('common.retry', isPolish ? 'Ponów' : 'Retry')}
              </button>
            </div>
          ) : null}
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
        safeName={displaySafeName}
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
