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

import { Building2, FolderKanban, User } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PreviewDetailsSection, PreviewMetaCard } from '../../components/shared/PreviewPane';
import { TableWithPreviewLayout } from '../../components/shared/TableWithPreviewLayout';
import {
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '../../components/standard';
import { StatusChip } from '../../components/ui/primitives';
import { Api } from '../../services/api';
import { formatBytes } from './vaultDocuments';

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

export interface VaultSafesTableProps {
  onOpenSafe: (safe: VaultSafe) => void;
  /** Lupa Menu 2 (ClientDocumentsVault) — filtruje sejfy po nazwie. */
  searchQuery?: string;
}

interface RecentDoc {
  id: string;
  filename: string;
  created_at: string;
}

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

const safeLevelLabel = (type: VaultSafe['type'], isPolish: boolean): string => {
  const pl: Record<VaultSafe['type'], string> = {
    user: 'Mój sejf',
    organization: 'Sejf organizacji',
    project: 'Sejf projektu',
  };
  const en: Record<VaultSafe['type'], string> = {
    user: 'My safe',
    organization: 'Organization safe',
    project: 'Project safe',
  };
  return (isPolish ? pl : en)[type];
};

/**
 * M02-016 — what the user reads in the NAME column.
 *
 * System safes (`user`, `organization`) are platform concepts, so their label
 * follows the UI locale. Project safes carry `projects.name`, which is user
 * data and is never translated. Before this split the server sent Polish
 * strings for the system safes, so an English account saw "Mój sejf" next to
 * an otherwise English screen, and `safeLevelLabel()`'s EN branch was dead.
 *
 * `isSystem` is preferred; the `type` check keeps older payloads (which do not
 * carry the flag yet) rendering correctly.
 */
const safeDisplayName = (safe: VaultSafe, isPolish: boolean): string => {
  const isSystem = safe.isSystem ?? safe.type !== 'project';
  return isSystem ? safeLevelLabel(safe.type, isPolish) : safe.name;
};

export const VaultSafesTable: React.FC<VaultSafesTableProps> = ({ onOpenSafe, searchQuery }) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const [safes, setSafes] = useState<VaultSafe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [previewSafeId, setPreviewSafeId] = useState<string | null>(null);
  const [recentDocs, setRecentDocs] = useState<RecentDoc[] | null>(null);
  const [recentDocsLoading, setRecentDocsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await Api.getVaultSafes();
      setSafes(data);
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

  const filteredSafes = useMemo(() => {
    const q = (searchQuery ?? '').trim().toLowerCase();
    if (!q) return safes;
    // Search what the user can actually read on screen (localized label for
    // system safes), not the server's neutral fallback — otherwise typing
    // "sejf" in a Polish UI would match nothing. Keep the raw name in the
    // haystack too, so a project safe still matches its own name.
    return safes.filter(
      (s) =>
        safeDisplayName(s, isPolish).toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );
  }, [safes, searchQuery, isPolish]);

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
      .then((docs: RecentDoc[]) => {
        if (cancelled) return;
        const sorted = [...(docs || [])].sort(
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
        return (
          <span className="inline-flex items-center gap-2 text-sm font-medium text-c-text">
            <Icon size={14} className="text-c-text-muted shrink-0" />
            {safeDisplayName(safe, isPolish)}
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
                defaultValue: isPolish ? '{{count}} błąd(y)' : '{{count}} error(s)',
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
        previewSafe ? { id: previewSafe.id, title: safeDisplayName(previewSafe, isPolish) } : null
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
            <PreviewMetaCard
              pills={[
                {
                  label: isPolish ? 'Poziom' : 'Level',
                  value: safeLevelLabel(previewSafe.type, isPolish),
                },
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
              ]}
            />
            <PreviewDetailsSection
              label={isPolish ? 'Ostatnie dokumenty' : 'Recent documents'}
              // PILNE-8: to jest LISTA PLIKÓW, nie proza — licznik słów
              // pokazywał tu „~30 words" nad pięcioma nazwami dokumentów.
              showWordCount={false}
              loading={recentDocsLoading}
              text={
                recentDocs && recentDocs.length > 0
                  ? recentDocs
                      .map((d) => `- ${d.filename} — ${formatDate(d.created_at, isPolish)}`)
                      .join('\n')
                  : isPolish
                    ? 'Brak dokumentów w tym sejfie.'
                    : 'No documents in this safe yet.'
              }
            />
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
