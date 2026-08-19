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
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useHubBarSlot } from '../../components/shared/HubBarSlots';
import { isClientVaultEnabled } from '../../utils/clientVaultFlag';
import { VaultDocumentsView } from './VaultDocumentsView';
import { type VaultSafe, VaultSafesTable } from './VaultSafesTable';

export const ClientDocumentsVault: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const [openSafe, setOpenSafe] = useState<VaultSafe | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Patrz „★ PUŁAPKA WSPÓŁDZIELONEGO SLOTU" w nagłówku pliku.
  const [resyncTick, setResyncTick] = useState(0);

  const handleOpenSafe = useCallback((safe: VaultSafe) => setOpenSafe(safe), []);
  const handleBackToSafes = useCallback(() => {
    setOpenSafe(null);
    setResyncTick((v) => v + 1);
  }, []);

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
    [searchQuery, t, isPolish, resyncTick]
  );

  useHubBarSlot({ searchControl: filterControlsNode });

  if (!isClientVaultEnabled()) return null;

  // Wnętrze sejfu rejestruje WŁASNY slot (patrz `VaultDocumentsView`), więc
  // renderuje się samodzielnie — ta lista tylko przestaje pokazywać swoją
  // tabelę (jej `filterControls` zostaje nadpisany przez wnętrze, dopóki jest
  // zamontowane).
  if (openSafe) {
    return <VaultDocumentsView safe={openSafe} onBack={handleBackToSafes} />;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-auto">
        <VaultSafesTable onOpenSafe={handleOpenSafe} searchQuery={searchQuery} />
      </div>
    </div>
  );
};

export default ClientDocumentsVault;
