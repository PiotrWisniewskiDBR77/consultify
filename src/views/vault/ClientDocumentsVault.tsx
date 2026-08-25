/**
 * ClientDocumentsVault (HP-22, Blok F Harvey-Parity — Client Vault)
 *
 * Org-scoped widok WŁASNYCH dokumentów klienta — klient przeszukuje własną
 * bazę bez superadmina. Reużywa `DocumentsRAGTab` w wariancie 'client'
 * (bez governance AI, które jest superadmin-only). Bezpieczeństwo: backend
 * `/knowledge/documents` filtruje po `organization_id` z tokenu (nie z
 * query/body) — patrz test HP-22 knowledgeOrgScope + fix SCIM 07-14.
 *
 * Powierzchnia wizualnie nowa → gejtowana `isClientVaultEnabled()` (default
 * OFF). Do akceptu Piotra na czystym zrzucie, nie „włącz i zobacz".
 *
 * ★ VLT-005 — warstwa tabeli sejfów PRZED narzędziem (cytat Piotra: „potrzebujemy
 * mieć poziom segregowania pomiędzy przyciskiem z menu głównego a samym
 * narzędziem"). Wejście w zakładkę pokazuje TABELĘ sejfów (`VaultSafesTable`,
 * kanon `StandardTable`) zamiast od razu uploadu; klik w wiersz otwiera wnętrze
 * sejfu, z breadcrumbem „Sejf klienta › [nazwa]" i powrotem do tabeli. Stan
 * lokalny (nie przeżywa odświeżenia strony, tak jak reszta nawigacji My Work).
 *
 * ★ 2026-07-24 — wnętrze sejfu to `VaultDocumentsView` (triada: Menu 1/2/3 +
 * StandardTable + StandardPreview + panel boczny dodawania), a NIE dawny
 * `DocumentsRAGTab` w wariancie 'client'. Powód: ten drugi był ekranem
 * administracyjnym wklejonym w kartę — wielki formularz uploadu zajmował pół
 * widoku, lista była kafelkami. `DocumentsRAGTab` zostaje wyłącznie panelem
 * superadmina (Knowledge → Documents/RAG), bez zmian.
 *
 * ★ SCALENIE 2026-07-26 (fix/triada-agent-sejfy + feat/sejf-redesign):
 * - Wnętrze sejfu = pełnoekranowy `VaultDocumentsView` (redesign wygrywa nad
 *   kartą z owiniętym `DocumentsRAGTab` — tamto było przyznanym w komentarzu
 *   półśrodkiem sprzed redesignu).
 * - Mechanizm karty w Menu 3 (`openItems`/`activeItemId`/`onSelectItem`/
 *   `onCloseItem`, wzór 1:1 `AgentHubShell.tsx`) — patrz `VaultDocumentsView`.
 *
 * ★ HUBBARSLOTS (2026-07-28, sprzątanie chrome — to samo zgłoszenie
 * właściciela co Run agent: „posprzątać w Client Vault tak samo"; audyt: do
 * 320px/6 rzędów chrome nad obszarem roboczym, najgorzej w całej aplikacji).
 * Ten ekran PRZESTAŁ rysować własny `StandardModuleBar` — hub (`MyWorkHub`)
 * ma teraz JEDYNE Menu 2/3, a lista sejfów tylko DEKLARUJE swój `filterControls`
 * przez `useHubBarSlot` (patrz `src/components/shared/HubBarSlots.tsx`):
 * - Lupa: kontrakt `HubBarSlotValue` NIE ma osobnego pola na wyszukiwanie
 *   (tylko `filterControls`/`primaryCta`/`openItems`), więc pole trafia do
 *   `filterControls` jako zwykły input (filtrowanie po nazwie sejfu — bez
 *   zmian funkcjonalnych, tylko inne miejsce w drzewie).
 * - `primaryCta` „Nowy sejf" POMINIĘTY ŚWIADOMIE: sejfy powstają automatycznie
 *   (mój/organizacji/po jednym na projekt, patrz `VaultSafesTable.tsx`), nie
 *   ma endpointu tworzenia — przycisk bez handlera byłby fasadą.
 * ★ PUŁAPKA WSPÓŁDZIELONEGO SLOTU: ta lista i `VaultDocumentsView` (wnętrze
 * sejfu) to DWA NIEZALEŻNE komponenty, oba wołają `useHubBarSlot` (inaczej niż
 * `AgentHubShell`, gdzie jeden komponent warunkuje zawartość slotu wewnątrz
 * siebie) — `register()` w `HubBarSlotsContext` NADPISUJE cały slot („ostatni
 * zapis wygrywa"). Otwarcie sejfu samo się domyka poprawnie (efekt tej listy
 * ma STABILNĄ referencję `filterControlsNode`, więc nie odpala się ponownie w
 * tym samym committcie co montowanie `VaultDocumentsView` — brak wyścigu).
 * Zamknięcie WYMAGA jawnego wymuszenia: `handleBackToSafes` inkrementuje
 * `resyncTick` (dep. `filterControlsNode`), żeby efekt tej listy odpalił się
 * PO odmontowaniu `VaultDocumentsView` (które czyści slot) i przywrócił pole
 * szukania — bez tego zostawałoby puste do najbliższej niepowiązanej zmiany.
 */

import { Search } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { useHubBarSlot } from '../../components/shared/HubBarSlots';
import { Api } from '../../services/api';
import { isClientVaultEnabled } from '../../utils/clientVaultFlag';
import { VaultDocumentsView } from './VaultDocumentsView';
import { VaultFoldersTable } from './VaultFoldersTable';
import { type VaultSafe, VaultSafesTable } from './VaultSafesTable';

// RB-029/RV-010 (CB-02) — the opened safe is now canonical route state
// (`?safeId=`), not just local component state, so direct entry, refresh,
// and browser back/forward restore it instead of silently returning to the
// safe list. Scoped to its own param so it composes with whatever tab/other
// query state the host route (MyWorkHub) already owns.
const SAFE_ID_PARAM = 'safeId';

export const ClientDocumentsVault: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const [searchParams, setSearchParams] = useSearchParams();
  const safeIdParam = searchParams.get(SAFE_ID_PARAM);
  const [openSafe, setOpenSafe] = useState<VaultSafe | null>(null);
  const [isResolvingSafe, setIsResolvingSafe] = useState(false);
  const [safeResolutionDenied, setSafeResolutionDenied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [listMode, setListMode] = useState<'safes' | 'folders'>('safes');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'user' | 'organization' | 'project'>(
    'all'
  );
  // Patrz „★ PUŁAPKA WSPÓŁDZIELONEGO SLOTU" w nagłówku pliku.
  const [resyncTick, setResyncTick] = useState(0);

  const clearSafeIdParam = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(SAFE_ID_PARAM);
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  const handleOpenSafe = useCallback(
    (safe: VaultSafe) => {
      setOpenSafe(safe);
      setSafeResolutionDenied(false);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(SAFE_ID_PARAM, safe.id);
          return next;
        },
        { replace: false }
      );
    },
    [setSearchParams]
  );
  const handleBackToSafes = useCallback(() => {
    setOpenSafe(null);
    setSafeResolutionDenied(false);
    setResyncTick((v) => v + 1);
    clearSafeIdParam();
  }, [clearSafeIdParam]);

  // URL -> state: direct entry / refresh / back-forward restores the
  // selected safe by re-resolving `safeId` against the real safes list
  // (permission-safe: `Api.getVaultSafes()` only ever returns safes this org
  // member can read, so a deleted/denied id simply won't be found).
  useEffect(() => {
    if (!safeIdParam) {
      setOpenSafe(null);
      // Deliberately NOT resetting `safeResolutionDenied` here: this branch
      // also runs right after `clearSafeIdParam()` removes an unresolvable
      // id, and resetting it here would erase the "denied/deleted" message
      // before the user ever sees it. It only clears on a fresh open attempt.
      return;
    }
    if (openSafe?.id === safeIdParam) return;
    let cancelled = false;
    setIsResolvingSafe(true);
    setSafeResolutionDenied(false);
    Api.getVaultSafes()
      .then((safes: VaultSafe[]) => {
        if (cancelled) return;
        const match = (safes || []).find((s) => s.id === safeIdParam);
        if (match) {
          setOpenSafe(match);
        } else {
          // Deleted or denied safe: honest fallback to the safe list rather
          // than a stale URL that permanently claims an unopenable safe.
          setSafeResolutionDenied(true);
          setOpenSafe(null);
          clearSafeIdParam();
        }
      })
      .catch(() => {
        if (cancelled) return;
        setSafeResolutionDenied(true);
        setOpenSafe(null);
        clearSafeIdParam();
      })
      .finally(() => {
        if (!cancelled) setIsResolvingSafe(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeIdParam]);

  const filterControlsNode = useMemo(
    () => (
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-c-text-muted"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t(
              'vault.safes.searchPlaceholder',
              isPolish ? 'Szukaj sejfu…' : 'Search safes…'
            )}
            aria-label={t('vault.breadcrumb.root', isPolish ? 'Sejf klienta' : 'Client Vault')}
            className="h-9 w-48 rounded-lg border border-c-border bg-c-surface pl-8 pr-3 text-sm text-c-text placeholder:text-c-text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          />
        </div>
        <select
          aria-label={isPolish ? 'Filtr zakresu' : 'Scope filter'}
          value={scopeFilter}
          onChange={(event) => setScopeFilter(event.target.value as typeof scopeFilter)}
          className="h-9 rounded-lg border border-c-border bg-c-surface px-2 text-sm text-c-text"
        >
          <option value="all">{isPolish ? 'Wszystkie zakresy' : 'All scopes'}</option>
          <option value="user">{isPolish ? 'Mój' : 'Mine'}</option>
          <option value="organization">{isPolish ? 'Organizacji' : 'Organization'}</option>
          <option value="project">{isPolish ? 'Projektu' : 'Project'}</option>
        </select>
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchQuery, scopeFilter, t, isPolish, resyncTick]
  );

  useHubBarSlot({ filterControls: filterControlsNode });

  if (!isClientVaultEnabled()) return null;

  // Wnętrze sejfu rejestruje WŁASNY slot (patrz `VaultDocumentsView`), więc
  // renderuje się samodzielnie — ta lista tylko przestaje pokazywać swoją
  // tabelę (jej `filterControls` zostaje nadpisany przez wnętrze, dopóki jest
  // zamontowane).
  if (openSafe) {
    return <VaultDocumentsView safe={openSafe} onBack={handleBackToSafes} />;
  }

  // RB-029/RV-010: resolving `?safeId=` from a direct entry/refresh — show a
  // neutral loading state rather than flashing the safe list first.
  if (isResolvingSafe) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-c-text-muted">
        {t('vault.safes.resolving', isPolish ? 'Otwieranie sejfu…' : 'Opening safe…')}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex gap-1 border-b border-c-border px-4 py-2" role="tablist">
        {(['safes', 'folders'] as const).map((mode) => (
          <button
            key={mode}
            role="tab"
            aria-selected={listMode === mode}
            onClick={() => setListMode(mode)}
            className="rounded px-3 py-1.5 text-sm text-c-text hover:bg-c-surface-raised"
          >
            {mode === 'safes' ? (isPolish ? 'Sejfy' : 'Safes') : isPolish ? 'Foldery' : 'Folders'}
          </button>
        ))}
      </div>
      {safeResolutionDenied && (
        <div className="mx-4 mt-4 rounded-lg border border-c-border bg-c-surface-raised px-4 py-3 text-sm text-c-text-secondary">
          {t(
            'vault.safes.notFound',
            isPolish
              ? 'Ten sejf nie istnieje lub nie masz do niego dostępu. Wróciliśmy do listy sejfów.'
              : "This safe doesn't exist or you don't have access to it. Returned to the safe list."
          )}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto">
        {listMode === 'safes' ? (
          <VaultSafesTable
            onOpenSafe={handleOpenSafe}
            searchQuery={searchQuery}
            scopeFilter={scopeFilter}
          />
        ) : (
          <VaultFoldersTable
            onOpenFolder={(folderId) =>
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set('folderId', folderId);
                return next;
              })
            }
          />
        )}
      </div>
    </div>
  );
};

export default ClientDocumentsVault;
