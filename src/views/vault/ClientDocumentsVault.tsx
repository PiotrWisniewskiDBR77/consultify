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
 * zapis wygrywa"). Ta lista rejestruje TYLKO lupę (`filterControls`) — bez
 * `primaryCta`/`openItems` (sejfy nie mają CTA tworzenia, patrz wyżej), więc
 * gdy `VaultDocumentsView` się odmontowuje (powrót do listy), jego własny
 * `clear()` (z `useHubBarSlot`) czyści slot i efekt TEJ listy (dep.
 * `filterControlsNode`, stabilna referencja) odpala się ponownie samoczynnie —
 * bez potrzeby jawnego licznika resync.
 *
 * ★ DEC-408b (06.09, słowo właściciela): pasek „Sejfy | Foldery" NAD tabelą
 * zniknął CAŁKOWICIE — foldery to Fala 2 (pozycja 3.11), ta zakładka pokazuje
 * WYŁĄCZNIE tabelę sejfów. Filtr zakresu (dawny `<select>`) zastąpiony
 * rzędem Menu 3 (`Menu3Chip`, kanon `ModuleMenu3.tsx`) z licznikami: Wszystkie
 * · Moje · Klientów · Z błędami indeksowania — renderowanym LOKALNIE nad
 * tabelą (ten sam wzór co `filterBarNode`/`renderBulkBar` w
 * `VaultDocumentsView.tsx`), bo `HubBarSlotValue` nie ma osobnego slotu na
 * trzeci, dynamiczny rząd (poza mandatem tego zadania). `VaultFoldersTable`
 * (przeglądarka WSZYSTKICH folderów) zostaje w kodzie nieużywana z tego
 * ekranu — logika/backend folderów nietknięte, Fala 2 dokłada wejście.
 */

import { AlertTriangle, Building2, Layers, Search, User } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { useHubBarSlot } from '../../components/shared/HubBarSlots';
import { Menu3Badge, Menu3Chip, MENU_3_INNER_CLASS, MENU_3_LEFT_CLASS, MENU_3_ROW_CLASS } from '../../components/shared/ModuleMenu3';
import { Api } from '../../services/api';
import { isClientVaultEnabled } from '../../utils/clientVaultFlag';
import { VaultDocumentsView } from './VaultDocumentsView';
import { type OtwarcieSejfu, type VaultSafe, VaultSafesTable } from './VaultSafesTable';

/** DEC-408b — filtr zakresu z Menu 3 (chipy zamiast dawnego `<select>`). */
type SafesFilterMode = 'all' | 'mine' | 'clients' | 'errors';

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
  // Intencja otwarcia z podglądu sejfu (pigułka „Dodaj dokument", klik w nazwę
  // dokumentu w bloku „Ostatnie dokumenty") — przekazywana raz, przy montowaniu
  // wnętrza sejfu; dalej stanem rządzi już `VaultDocumentsView`.
  const [otwarcieSejfu, setOtwarcieSejfu] = useState<OtwarcieSejfu | null>(null);
  const [isResolvingSafe, setIsResolvingSafe] = useState(false);
  const [safeResolutionDenied, setSafeResolutionDenied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<SafesFilterMode>('all');
  // DEC-408b — liczniki chipów Menu 3 (Wszystkie/Moje/Klientów/Błędy), dociągane
  // z `VaultSafesTable` (jedyne miejsce, które realnie woła `Api.getVaultSafes()`
  // — bez duplikowania fetcha tutaj).
  const [safesForCounts, setSafesForCounts] = useState<VaultSafe[]>([]);
  const handleSafesLoaded = useCallback((safes: VaultSafe[]) => setSafesForCounts(safes), []);

  const clearSafeIdParam = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(SAFE_ID_PARAM);
        next.delete('folderId');
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  const handleOpenSafe = useCallback(
    (safe: VaultSafe, opcje?: OtwarcieSejfu) => {
      setOpenSafe(safe);
      setOtwarcieSejfu(opcje ?? null);
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
    setOtwarcieSejfu(null);
    setSafeResolutionDenied(false);
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
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchQuery, t, isPolish]
  );

  useHubBarSlot({ filterControls: filterControlsNode });

  // ★ DEC-408b — Menu 3 lokalny (nie hub-slot, patrz nagłówek pliku): chipy
  // zakresu z licznikami, zastępują dawny `<select>`. Klik aktywnego chipu
  // (poza „Wszystkie") wraca do „Wszystkie" — wzór 1:1 `stagePresets` w
  // `MyWorkHub.tsx` (Menu 3 Pomysłów).
  const filterCounts = useMemo(
    () => ({
      all: safesForCounts.length,
      mine: safesForCounts.filter((s) => s.type === 'user').length,
      clients: safesForCounts.filter((s) => s.type !== 'user').length,
      errors: safesForCounts.filter((s) => s.errorCount > 0).length,
    }),
    [safesForCounts]
  );

  const filterChipDefs: Array<{
    id: SafesFilterMode;
    label: string;
    icon: React.ReactNode;
    count: number;
  }> = [
    {
      id: 'all',
      label: t('vault.safes.filterAll', isPolish ? 'Wszystkie' : 'All'),
      icon: <Layers size={14} />,
      count: filterCounts.all,
    },
    {
      id: 'mine',
      label: t('vault.safes.filterMine', isPolish ? 'Moje' : 'Mine'),
      icon: <User size={14} />,
      count: filterCounts.mine,
    },
    {
      id: 'clients',
      label: t('vault.safes.filterClients', isPolish ? 'Klientów' : 'Clients'),
      icon: <Building2 size={14} />,
      count: filterCounts.clients,
    },
    {
      id: 'errors',
      label: t(
        'vault.safes.filterErrors',
        isPolish ? 'Z błędami indeksowania' : 'With indexing errors'
      ),
      icon: <AlertTriangle size={14} />,
      count: filterCounts.errors,
    },
  ];

  const commandRowNode = (
    <div className={MENU_3_ROW_CLASS}>
      <div className={MENU_3_INNER_CLASS}>
        <div className={MENU_3_LEFT_CLASS}>
          {filterChipDefs.map((chip) => {
            const active = filterMode === chip.id;
            return (
              <Menu3Chip
                key={chip.id}
                active={active}
                onClick={() => setFilterMode(active && chip.id !== 'all' ? 'all' : chip.id)}
              >
                {chip.icon}
                <span>{chip.label}</span>
                <Menu3Badge count={chip.count} active={active} />
              </Menu3Chip>
            );
          })}
        </div>
        <div className="shrink-0" />
      </div>
    </div>
  );

  if (!isClientVaultEnabled()) return null;

  // Wnętrze sejfu rejestruje WŁASNY slot (patrz `VaultDocumentsView`), więc
  // renderuje się samodzielnie — ta lista tylko przestaje pokazywać swoją
  // tabelę (jej `filterControls` zostaje nadpisany przez wnętrze, dopóki jest
  // zamontowane).
  if (openSafe) {
    return (
      <VaultDocumentsView
        safe={openSafe}
        onBack={handleBackToSafes}
        initialFolderId={searchParams.get('folderId')}
        initialAction={otwarcieSejfu?.akcja ?? null}
        initialDocumentId={otwarcieSejfu?.dokumentId ?? null}
      />
    );
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
      {commandRowNode}
      <div className="flex-1 min-h-0 overflow-auto">
        <VaultSafesTable
          onOpenSafe={handleOpenSafe}
          searchQuery={searchQuery}
          filterMode={filterMode}
          onSafesLoaded={handleSafesLoaded}
        />
      </div>
    </div>
  );
};

export default ClientDocumentsVault;
