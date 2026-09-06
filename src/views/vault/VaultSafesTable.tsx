/**
 * VaultSafesTable (VLT-005 — Client Vault: warstwa tabeli sejfów)
 *
 * Ekran wejściowy zakładki Vault — TABELA sejfów zamiast od razu narzędzia
 * (wzór: `case 'decisions'` w MyWorkHub.tsx pokazuje tabelę pozycji przed
 * wejściem w szczegóły). Decyzja Piotra (DEC-003 / DZIENNIK VLT-005): sejf =
 * klient/projekt, zero nowej tabeli w bazie — reużywa `knowledge_docs.scope`
 * + `project_members` przez jeden lekki endpoint `GET /knowledge/vault-safes`
 * (patrz server/src/routes/knowledge.routes.ts).
 *
 * Wiersze: [Mój sejf] (scope=user, tylko własne) + [Sejf organizacji]
 * (scope=organization) + po jednym na projekt, w którym wołający jest
 * członkiem. Kolumny: nazwa, liczba dokumentów, ostatnia zmiana. Klik w
 * wiersz → PREVIEW (poprawka odbioru triady 2026-07-24, patrz niżej);
 * "Otwórz" → `onOpenSafe` (wrapper `ClientDocumentsVault` przełącza na
 * `DocumentsRAGTab` przefiltrowany do tego sejfu, jako karta w Menu 3).
 *
 * ★ POPRAWKA ODBIORU TRIADY (2026-07-24, zrzuty demo Piotra: "cała ta
 * tabela jest super biedna — nie mamy preview, nie mamy prawego przycisku
 * menu / hamburgera z prawej strony linii"):
 * - Kebab (wcześniej brak w ogóle) — kontrakt `rowMenu`: Otwórz (primary) +
 *   Otwórz podgląd (universalHandlers.preview); Edytuj/Archiwizuj/Usuń
 *   pozostają disabled z dopiskiem — sejfy powstają automatycznie (mój/
 *   organizacji/po jednym na projekt), nie da się ich edytować/usuwać z tego
 *   poziomu (zgłoszone w raporcie, nie wymyślone akcje bez backendu).
 * - Preview (StandardPreview przez `TableWithPreviewLayout`, ta sama fasada
 *   co My Work Decisions): nazwa, poziom, liczba dokumentów, ostatnie
 *   dokumenty (dociągnięte leniwie `Api.getKnowledgeDocuments` per sejf).
 * - Pstryczek kolumn (Settings2/"VISIBLE COLUMNS") już istniał — `StandardTable`
 *   ma `enableColumnSettings` zawsze włączone (patrz `StandardTable.tsx`);
 *   nie było go widać, bo tabela nie miała żadnej innej struktury Menu wokół
 *   niej (naprawione w `ClientDocumentsVault.tsx`).
 *
 * Kanon Triada: WYŁĄCZNIE `StandardTable`/`TableWithPreviewLayout`/
 * `StandardPreview` (zakaz bespoke tabeli/preview per ekran) — skill
 * `consultify-triada`.
 */

import { AlertTriangle, Building2, FolderKanban, Plus, User } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  PreviewActionBar,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewWhatsNextCard,
} from '../../components/shared/PreviewPane';
import { TableWithPreviewLayout } from '../../components/shared/TableWithPreviewLayout';
import {
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '../../components/standard';
import { StatusChip } from '../../components/ui/primitives';
import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import {
  czytelnaNazwaPliku,
  formatBytes,
  ikonaTypuPliku,
  indexStatusLabel,
  indexStatusTone,
  normalizeVaultDocuments,
  safeDisplayName,
  safeLevelLabel,
  type VaultDocument,
} from './vaultDocuments';

export interface VaultSafe {
  id: string;
  type: 'user' | 'organization' | 'project';
  /**
   * M02-016 — true for the two safes the platform creates for every tenant
   * (`user`, `organization`). Their display name is a UI label and must be
   * localized here; `name` from the server is only a neutral English
   * fallback. False for project safes, whose `name` IS user data.
   */
  isSystem?: boolean;
  projectId: string | null;
  name: string;
  documentCount: number;
  lastModified: string | null;
  /** Suma `file_size_bytes` dokumentów sejfu — „ile tu materiału" (research Harvey Vault). */
  sizeBytes: number;
  /** Ile dokumentów ma `chunk_count > 0` — gotowość do pracy z AI, ta sama etykieta
   *  co kolumna „W wiedzy AI" w tabeli dokumentów wewnątrz sejfu (VaultDocumentsView). */
  indexedCount: number;
  /** Ile dokumentów ma `status = 'error'` — sygnał „coś się nie zaindeksowało". */
  errorCount: number;
}

/**
 * Otwarcie sejfu z INTENCJĄ — podgląd sejfu (blok 3/5/„Co dalej") musi umieć
 * zaprowadzić dokładnie tam, co obiecuje pigułka: „Dodaj dokument" ma otworzyć
 * panel dodawania, a klik w nazwę dokumentu — podgląd TEGO dokumentu wewnątrz
 * sejfu. Bez tego pola przycisk byłby fasadą („otwiera sejf i zostawia").
 */
export interface OtwarcieSejfu {
  /** `dodaj` → po otwarciu sejfu od razu panel boczny dodawania dokumentu. */
  akcja?: 'dodaj';
  /** Zaznacz ten dokument po otwarciu sejfu (podgląd dokumentu). */
  dokumentId?: string;
}

export interface VaultSafesTableProps {
  onOpenSafe: (safe: VaultSafe, opcje?: OtwarcieSejfu) => void;
  /** Lupa Menu 2 (ClientDocumentsVault) — filtruje sejfy po nazwie. */
  searchQuery?: string;
  /**
   * DEC-408b — chipy Menu 3 (`all`/`mine`/`clients`/`errors`) zastępują dawny
   * `scopeFilter` `<select>`. `clients` = organization + project (wszystko,
   * co NIE jest „moim" sejfem); `errors` = sejfy z `errorCount > 0`.
   */
  filterMode?: 'all' | 'mine' | 'clients' | 'errors';
  /** DEC-408b — dociąga załadowaną listę do liczników chipów w rodzicu. */
  onSafesLoaded?: (safes: VaultSafe[]) => void;
}

/**
 * Chip „Co dalej" — klasy 1:1 z `StandardPreview.tsx` (blok whatsNext). Ten
 * ekran komponuje stopkę z prymitywów przez `renderPreviewFooter`, więc nie ma
 * gdzie osadzić gotowego chipu; ramkę bierze `PreviewWhatsNextCard`, a to jest
 * jedyna rzecz, która musi być tu powtórzona — świadomie, z odsyłaczem.
 */
const WHATS_NEXT_CHIP =
  'inline-flex h-7 items-center gap-1.5 rounded-full border border-c-border bg-c-surface px-2.5 text-xs font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

const SAFE_ICON: Record<VaultSafe['type'], typeof User> = {
  user: User,
  organization: Building2,
  project: FolderKanban,
};

const formatDate = (value: unknown, isPolish: boolean): string => {
  if (!value || typeof value !== 'string') return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(isPolish ? 'pl-PL' : undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// FIX-19 (Day 3 layer-2 acceptance): `safeLevelLabel`/`safeDisplayName` moved
// to `vaultDocuments.ts` (shared with `VaultDocumentsView.tsx`/
// `VaultDocumentPanel.tsx`, which were still rendering the server's raw,
// deliberately-English `safe.name` fallback once a safe was opened — "Mój
// sejf" in this table next to literal "My safe" in the breadcrumb/panel for
// the very same safe) and now go through real i18n keys instead of a bare
// PL/EN record with no translation entry.

export const VaultSafesTable: React.FC<VaultSafesTableProps> = ({
  onOpenSafe,
  searchQuery,
  filterMode = 'all',
  onSafesLoaded,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const [safes, setSafes] = useState<VaultSafe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [previewSafeId, setPreviewSafeId] = useState<string | null>(null);
  const [recentDocs, setRecentDocs] = useState<VaultDocument[] | null>(null);
  const [recentDocsLoading, setRecentDocsLoading] = useState(false);
  // Plakietka zakresu bloku 1 — dla sejfu organizacji pokazuje NAZWĘ KLIENTA,
  // nie neutralne „Sejf organizacji" (zgłoszenie: podgląd nie mówi, czyj to sejf).
  const organizationName = useAppStore((state) => state.currentOrganization?.name);

  /**
   * Plakietka zakresu bloku 1: „Mój" · „Klient: <organizacja>" · „Projekt: <nazwa>".
   * Gdy nazwy organizacji nie ma w sesji, spada do neutralnej etykiety poziomu —
   * nie zmyślamy nazwy klienta.
   */
  const plakietkaZakresu = useCallback(
    (safe: VaultSafe): string => {
      if (safe.type === 'user') return t('vault.safes.scopeMine', isPolish ? 'Mój' : 'Mine');
      if (safe.type === 'organization') {
        return organizationName
          ? `${t('vault.safes.scopeClient', isPolish ? 'Klient' : 'Client')}: ${organizationName}`
          : safeLevelLabel(safe.type, isPolish, t);
      }
      return `${t('vault.safes.levelProject', isPolish ? 'Sejf projektu' : 'Project safe')}: ${safe.name}`;
    },
    [organizationName, isPolish, t]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await Api.getVaultSafes();
      setSafes(data);
      onSafesLoaded?.(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : t('vault.safes.loadError', 'Failed to load vault safes')
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // DEC-408b — `clients` grupuje organization+project (wszystko poza „moim"
  // sejfem); `errors` to szybki filtr sejfów z `errorCount > 0`.
  const matchesFilterMode = useCallback(
    (safe: VaultSafe): boolean => {
      if (filterMode === 'mine') return safe.type === 'user';
      if (filterMode === 'clients') return safe.type !== 'user';
      if (filterMode === 'errors') return safe.errorCount > 0;
      return true;
    },
    [filterMode]
  );

  const filteredSafes = useMemo(() => {
    const q = (searchQuery ?? '').trim().toLowerCase();
    if (!q && filterMode === 'all') return safes;
    // Search what the user can actually read on screen (localized label for
    // system safes), not the server's neutral fallback — otherwise typing
    // "sejf" in a Polish UI would match nothing. Keep the raw name in the
    // haystack too, so a project safe still matches its own name.
    return safes.filter(
      (s) =>
        matchesFilterMode(s) &&
        (safeDisplayName(s, isPolish, t).toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q))
    );
  }, [safes, searchQuery, isPolish, filterMode, matchesFilterMode]);

  const previewSafe = useMemo(
    () => filteredSafes.find((s) => s.id === previewSafeId) ?? null,
    [filteredSafes, previewSafeId]
  );

  // Dociąga "ostatnie dokumenty" leniwie — dopiero gdy user otwiera preview
  // konkretnego sejfu (kanon preview §punkt 3: nazwa/poziom/liczba/ostatnie).
  useEffect(() => {
    if (!previewSafe) {
      setRecentDocs(null);
      return;
    }
    let cancelled = false;
    setRecentDocsLoading(true);
    Api.getKnowledgeDocuments({
      scope: previewSafe.type === 'project' ? 'project' : previewSafe.type,
      projectId: previewSafe.projectId || undefined,
    })
      .then((docs: unknown) => {
        if (cancelled) return;
        // Ten sam normalizator co wnętrze sejfu (`VaultDocumentsView`) — podgląd
        // potrzebuje statusu indeksowania i rozmiaru, nie tylko nazwy z datą.
        const sorted = normalizeVaultDocuments(docs).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setRecentDocs(sorted.slice(0, 5));
      })
      .catch(() => {
        if (!cancelled) setRecentDocs([]);
      })
      .finally(() => {
        if (!cancelled) setRecentDocsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [previewSafe]);

  const columns: TableColumn[] = [
    {
      id: 'name',
      label: t('vault.safes.name', isPolish ? 'Nazwa' : 'Name'),
      sortable: true,
      render: (row: TableRow) => {
        const safe = row as unknown as VaultSafe;
        const Icon = SAFE_ICON[safe.type] || FolderKanban;
        const name = safeDisplayName(safe, isPolish, t);
        return (
          // GRAFIKA 20-tabele-szerokosc (2026-08-30): `truncate` + `min-w-0`,
          // sama nazwa łamała się na 2 linie dla dłuższych sejfów projektowych
          // (kanon: wiersz = jedna linia).
          <span
            className="inline-flex min-w-0 items-center gap-2 text-sm font-medium text-c-text"
            title={name}
          >
            <Icon size={14} className="text-c-text-muted shrink-0" />
            <span className="truncate">{name}</span>
          </span>
        );
      },
    },
    {
      id: 'scope',
      label: t('vault.safes.scope', isPolish ? 'Zakres' : 'Scope'),
      // GRAFIKA 20-tabele-szerokosc (2026-08-30): kolumna bez `width` dostawała
      // domyślne 140px (FilterableTable.tsx:657), a treść „Sejf projektu · <pełna
      // nazwa projektu>" łamała się na 2-3 linie (kanon: wiersz = jedna linia).
      // `truncate` (1:1 z name/author w ReportsManagementPanel) + szerszy budżet
      // bazowy, żeby kolumna nie padała ofiarą proporcjonalnego rozciągania
      // `table-fixed` do węższego pasa niż sąsiednie kolumny.
      width: '220px',
      sortable: true,
      sortAccessor: (row: TableRow) =>
        safeLevelLabel((row as unknown as VaultSafe).type, isPolish, t),
      render: (row: TableRow) => {
        const safe = row as unknown as VaultSafe;
        return (
          <span className="block truncate text-sm text-c-text-secondary" title={`${safeLevelLabel(safe.type, isPolish, t)}${safe.type === 'project' ? ` · ${safe.name}` : ''}`}>
            {safeLevelLabel(safe.type, isPolish, t)}
            {safe.type === 'project' ? ` · ${safe.name}` : ''}
          </span>
        );
      },
    },
    {
      id: 'documentCount',
      label: t('vault.safes.documents', isPolish ? 'Dokumenty' : 'Documents'),
      width: '120px',
      align: 'right',
      sortable: true,
      sortAccessor: (row: TableRow) => Number(row.documentCount) || 0,
      render: (row: TableRow) => (
        <span className="text-sm tabular-nums text-c-text-secondary">
          {Number(row.documentCount) || 0}
        </span>
      ),
    },
    {
      id: 'sizeBytes',
      // ★ Research Harvey (developers.harvey.ai/guides/vault): lista projektów
      // Vault pokazuje `files_count` na poziomie repozytorium, ale nie sam rozmiar —
      // dodajemy go, bo „ile dokumentów" nie mówi „ile materiału" (pytanie
      // konsultanta: czy jest tu w ogóle coś do pracy, czy to 2 skany czy 200 stron).
      label: t('vault.safes.size', isPolish ? 'Rozmiar' : 'Size'),
      width: '100px',
      align: 'right',
      sortable: true,
      sortAccessor: (row: TableRow) => Number(row.sizeBytes) || 0,
      render: (row: TableRow) => (
        <span className="text-sm tabular-nums text-c-text-secondary">
          {formatBytes(Number(row.sizeBytes) || 0)}
        </span>
      ),
    },
    {
      id: 'indexedCount',
      // ★ Ta sama etykieta co „W wiedzy AI" w tabeli dokumentów wewnątrz sejfu
      // (VaultDocumentsView.tsx colChunks) — odpowiada na pytanie „czy ten
      // sejf jest w ogóle gotowy do pracy z AI", nie tylko „ile plików wgrano".
      label: t('vault.safes.inAiKnowledge', isPolish ? 'W wiedzy AI' : 'In AI knowledge'),
      width: '120px',
      align: 'right',
      sortable: true,
      sortAccessor: (row: TableRow) => Number(row.indexedCount) || 0,
      render: (row: TableRow) => {
        const indexed = Number(row.indexedCount) || 0;
        const total = Number(row.documentCount) || 0;
        if (total === 0) {
          return <span className="text-sm tabular-nums text-c-text-muted">—</span>;
        }
        return (
          <span className="text-sm tabular-nums text-c-text-secondary">
            {indexed}/{total}
          </span>
        );
      },
    },
    {
      id: 'errorCount',
      // ★ Sygnał „coś się nie zaindeksowało" — chip TYLKO gdy > 0 (danger — jedyny
      // dopuszczalny czerwony stan, kanon §3: crimson wyłącznie semantyka krytyczna).
      // Pusty sejf lub sejf bez błędów nie dostaje ozdoby, żeby nie zaszumiać wiersza.
      label: t('vault.safes.indexingErrors', isPolish ? 'Błędy indeksowania' : 'Indexing errors'),
      width: '130px',
      sortable: true,
      sortAccessor: (row: TableRow) => Number(row.errorCount) || 0,
      render: (row: TableRow) => {
        const errors = Number(row.errorCount) || 0;
        if (errors === 0) {
          return <span className="text-sm text-c-text-muted">—</span>;
        }
        return (
          <StatusChip
            label={String(
              t('vault.safes.indexingErrorsCount', {
                defaultValue: isPolish ? 'Błędy: {{count}}' : '{{count}} error(s)',
                count: errors,
              })
            )}
            tone="danger"
          />
        );
      },
    },
    {
      id: 'lastModified',
      label: t('vault.safes.lastModified', isPolish ? 'Ostatnia zmiana' : 'Last modified'),
      width: '160px',
      sortable: true,
      sortAccessor: (row: TableRow) => String(row.lastModified || ''),
      render: (row: TableRow) => (
        <span className="text-xs text-c-text-secondary">
          {formatDate(row.lastModified, isPolish)}
        </span>
      ),
    },
  ];

  if (loading || error || (filteredSafes.length === 0 && safes.length === 0)) {
    return (
      <StandardTable
        columns={columns}
        data={[]}
        loading={loading}
        error={error}
        onRetry={load}
        empty={{
          icon: FolderKanban,
          title: t('vault.safes.emptyTitle', isPolish ? 'Brak sejfów' : 'No safes yet'),
          description: t(
            'vault.safes.emptyDescription',
            isPolish
              ? 'Sejfy pojawiają się automatycznie — mój, organizacji i po jednym na projekt.'
              : 'Safes appear automatically — yours, the organization’s, and one per project.'
          ),
        }}
        defaultSort={{ columnId: 'name', direction: 'asc' }}
        persistKey="vault.safes.list"
      />
    );
  }

  const tableRows = filteredSafes as unknown as TableRow[];

  return (
    <TableWithPreviewLayout<{ id: string; title: string }>
      selectedId={previewSafeId}
      selectedItem={
        previewSafe
          ? { id: previewSafe.id, title: safeDisplayName(previewSafe, isPolish, t) }
          : null
      }
      onSelect={setPreviewSafeId}
      onOpenFull={(id) => {
        const safe = filteredSafes.find((s) => s.id === id);
        if (safe) onOpenSafe(safe);
      }}
      itemIds={tableRows.map((r) => String(r.id))}
      renderPreview={() => {
        if (!previewSafe) return null;
        // ★ Uwaga (jak w AgentHubShell.tsx): `TableWithPreviewLayout` renderuje
        // WŁASNY `PreviewPaneShell` (tytuł/Otwórz/× — blok 1 kanonu) wokół
        // tego, co zwróci `renderPreview` — pełny `StandardPreview` dawał tu
        // PODWÓJNY nagłówek. Treść składamy z tych samych prymitywów.
        return (
          <div className="space-y-4">
            {/* Blok 1 (dopełnienie nagłówka powłoki): plakietka zakresu +
                data ostatniej zmiany. Nazwa sejfu jest w nagłówku powłoki,
                więc TU jej nie powtarzamy (kanon: jedno „Otwórz", jeden tytuł). */}
            <div className="flex items-center justify-between gap-2">
              <StatusChip label={plakietkaZakresu(previewSafe)} tone="neutral" />
              <span className="text-[11px] text-c-text-secondary">
                {t('vault.safes.lastModified', isPolish ? 'Ostatnia zmiana' : 'Last modified')}:{' '}
                {formatDate(previewSafe.lastModified, isPolish)}
              </span>
            </div>

            {/* Blok 2 — META (stan, nie treść). */}
            <PreviewMetaCard
              pills={[
                {
                  label: t('vault.safes.documents', isPolish ? 'Dokumenty' : 'Documents'),
                  value: previewSafe.documentCount,
                },
                {
                  label: t('vault.safes.size', isPolish ? 'Rozmiar' : 'Size'),
                  value: formatBytes(previewSafe.sizeBytes),
                },
                {
                  label: t(
                    'vault.safes.inAiKnowledge',
                    isPolish ? 'W wiedzy AI' : 'In AI knowledge'
                  ),
                  value:
                    previewSafe.documentCount > 0
                      ? `${previewSafe.indexedCount}/${previewSafe.documentCount}`
                      : '—',
                },
                {
                  label: t(
                    'vault.safes.indexingErrors',
                    isPolish ? 'Błędy indeksowania' : 'Indexing errors'
                  ),
                  value: previewSafe.errorCount,
                  // Kanon §3: crimson WYŁĄCZNIE semantyka krytyczna — zero
                  // błędów zostaje neutralne, nie „zielone na zachętę".
                  tone: previewSafe.errorCount > 0 ? 'danger' : 'neutral',
                },
              ]}
            />

            {/* Blok 3 — TREŚĆ: ostatnie 5 dokumentów, CZYTELNE nazwy. */}
            <PreviewDetailsSection
              label={t(
                'vault.safes.previewRecentDocuments',
                isPolish ? 'Ostatnie dokumenty' : 'Recent documents'
              )}
              // PILNE-8: to jest LISTA PLIKÓW, nie proza — licznik słów
              // pokazywał tu „~30 words" nad pięcioma nazwami dokumentów.
              showWordCount={false}
              loading={recentDocsLoading}
              onCopy={() => {
                const tekst = (recentDocs ?? [])
                  .map((d) => czytelnaNazwaPliku(d.filename).tytul)
                  .join('\n');
                void navigator.clipboard?.writeText(tekst);
              }}
            >
              {recentDocs && recentDocs.length > 0 ? (
                <ul className="space-y-1">
                  {recentDocs.map((doc) => {
                    const nazwa = czytelnaNazwaPliku(doc.filename);
                    const Ikona = ikonaTypuPliku(nazwa.rozszerzenie);
                    // Status NIE wchodzi do tej linii — niesie go chip po prawej.
                    // Zrzut 01 pokazał go dwa razy w jednym wierszu, a data przez
                    // to nie mieściła się w 376 px panelu („6…").
                    const meta = [
                      nazwa.rozszerzenie || null,
                      formatBytes(doc.file_size_bytes),
                      formatDate(doc.created_at, isPolish),
                    ]
                      .filter((part) => part && part !== '—')
                      .join(' · ');
                    return (
                      <li key={doc.id}>
                        <button
                          type="button"
                          // Klik → podgląd TEGO dokumentu na istniejącym ekranie
                          // dokumentów sejfu (nie nowy ekran, nie martwy link).
                          onClick={() => onOpenSafe(previewSafe, { dokumentId: doc.id })}
                          title={nazwa.oryginal}
                          className="flex w-full items-start gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                        >
                          <Ikona size={14} className="mt-0.5 shrink-0 text-c-text-muted" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-c-text">
                              {nazwa.tytul}
                            </span>
                            <span className="block truncate text-[11px] text-c-text-muted">
                              {meta}
                            </span>
                          </span>
                          <StatusChip
                            label={indexStatusLabel(doc.status, isPolish)}
                            tone={indexStatusTone(doc.status)}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="text-sm italic text-c-text-muted">
                  {t(
                    'vault.safes.previewNoDocuments',
                    isPolish ? 'Brak dokumentów w tym sejfie.' : 'No documents in this safe yet.'
                  )}
                </div>
              )}
            </PreviewDetailsSection>
          </div>
        );
      }}
      renderPreviewFooter={() => {
        if (!previewSafe) return null;
        const safe = previewSafe;
        return (
          // Kanon §7.3 — karty stopki jedna pod drugą, bez separatorów.
          <div className="space-y-2.5">
            {/* Blok 6 — AKCJE (pill). „Otwórz" ŚWIADOMIE POMINIĘTE: renderuje
                je nagłówek powłoki, a kanon zabrania drugiego „Otwórz" w
                podglądzie (pułapka #36 / anty-duplikacja). */}
            <PreviewActionBar
              rows={[
                {
                  buttons: [
                    {
                      label: t(
                        'vault.safes.previewAddDocument',
                        isPolish ? 'Dodaj dokument' : 'Add document'
                      ),
                      icon: Plus,
                      onClick: () => onOpenSafe(safe, { akcja: 'dodaj' }),
                      colorScheme: 'neutral',
                      flex: true,
                    },
                  ],
                },
              ]}
            />

            {/* „Co dalej" — POZA numeracją, ZAWSZE PO bloku 6. Renderuje się
                tylko wtedy, gdy sejf faktycznie czegoś potrzebuje. */}
            {safe.errorCount > 0 || safe.documentCount === 0 ? (
              <PreviewWhatsNextCard isPolish={isPolish}>
                <div className="flex flex-wrap gap-1.5">
                  {safe.errorCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => onOpenSafe(safe)}
                      className={WHATS_NEXT_CHIP}
                    >
                      <AlertTriangle size={12} />
                      {t(
                        'vault.safes.whatsNextFixErrors',
                        isPolish ? 'Pokaż błędy indeksowania' : 'Show indexing errors'
                      )}
                    </button>
                  ) : null}
                  {safe.documentCount === 0 ? (
                    <button
                      type="button"
                      onClick={() => onOpenSafe(safe, { akcja: 'dodaj' })}
                      className={WHATS_NEXT_CHIP}
                    >
                      <Plus size={12} />
                      {t(
                        'vault.docs.emptyCta',
                        isPolish ? 'Dodaj pierwszy dokument' : 'Add the first document'
                      )}
                    </button>
                  ) : null}
                </div>
              </PreviewWhatsNextCard>
            ) : null}
          </div>
        );
      }}
    >
      <StandardTable
        columns={columns}
        data={tableRows}
        selectedRowId={previewSafeId}
        onRowClick={(row) => setPreviewSafeId(String(row.id))}
        onRowDoubleClick={(row) => {
          const safe = filteredSafes.find((s) => s.id === row.id);
          if (safe) onOpenSafe(safe);
        }}
        rowMenu={(row): StandardRowMenu => {
          const safe = row as unknown as VaultSafe;
          return {
            primary: [
              {
                id: 'open',
                label: t('vault.safes.rowOpen', isPolish ? 'Otwórz' : 'Open'),
                onClick: () => onOpenSafe(safe),
              },
            ],
            universalHandlers: {
              preview: () => setPreviewSafeId(safe.id),
              // Edytuj/Archiwizuj/Usuń: sejfy powstają automatycznie (mój/
              // organizacji/po jednym na projekt) — brak endpointu edycji/
              // usuwania na tym poziomie, disabled z dopiskiem (nie ukryte).
            },
            destructive: {
              note: t(
                'vault.safes.rowDeleteNote',
                isPolish
                  ? 'Sejfy są automatyczne — nie da się ich usunąć'
                  : 'Safes are automatic — cannot be deleted'
              ),
            },
          };
        }}
        defaultSort={{ columnId: 'name', direction: 'asc' }}
        persistKey="vault.safes.list"
      />
    </TableWithPreviewLayout>
  );
};

export default VaultSafesTable;
