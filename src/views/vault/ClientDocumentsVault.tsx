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
 * - Z triady zachowana lupa Menu 2 (`onSearch`/`searchValue` → filtr
 *   `VaultSafesTable` po nazwie sejfu; poprzednio samotna ikona bez działania).
 * - Wnętrze sejfu = pełnoekranowy `VaultDocumentsView` (redesign wygrywa nad
 *   kartą z owiniętym `DocumentsRAGTab` — tamto było przyznanym w komentarzu
 *   półśrodkiem sprzed redesignu).
 * - Mechanizm karty w Menu 3 (`openItems`/`activeItemId`/`onSelectItem`/
 *   `onCloseItem`, wzór 1:1 `AgentHubShell.tsx`) DOPIĘTY na własnym
 *   `StandardModuleBar` `VaultDocumentsView` (patrz komentarz „KARTA W MENU 3"
 *   tamże): otwarty sejf = jedna zawsze-aktywna karta (`type:'tool',
 *   subType:'vault-safe'`); × karty i „Lista" oba wołają `onBack` — dokładnie
 *   ten sam `handleBackToSafes` co breadcrumb „Sejf klienta" niżej. Efekt
 *   uboczny (opisany tamże): dopóki karta jest widoczna, chipy statusu
 *   indeksowania w Menu 3 są wizualnie zastąpione tabem (tryby wyłączne we
 *   wspólnym `ModuleNavBar`) — zgłoszone jako wątpliwość do decyzji, nie
 *   naprawiane tutaj (wymagałoby zmiany pliku wspólnego, poza mandatem).
 */

import React, { useCallback, useState } from 'react';

import { isClientVaultEnabled } from '../../utils/clientVaultFlag';
import { VaultDocumentsView } from './VaultDocumentsView';
import { type VaultSafe, VaultSafesTable } from './VaultSafesTable';

export interface ClientDocumentsVaultProps {
  /**
   * Fraza z lupy Menu 2 hosta (My Work). Sejf nie ma własnej wyszukiwarki —
   * patrz komentarz P-17 niżej.
   */
  searchQuery?: string;
}

export const ClientDocumentsVault: React.FC<ClientDocumentsVaultProps> = ({
  searchQuery = '',
}) => {
  const [openSafe, setOpenSafe] = useState<VaultSafe | null>(null);

  const handleOpenSafe = useCallback((safe: VaultSafe) => setOpenSafe(safe), []);
  const handleBackToSafes = useCallback(() => setOpenSafe(null), []);

  if (!isClientVaultEnabled()) return null;

  // Wnętrze sejfu ma WŁASNĄ pełną triadę (Menu 1 z breadcrumbem i kebabem karty
  // + Menu 2 + Menu 3 + tabela + preview), więc renderuje się samodzielnie —
  // wrapper nie dokłada drugiego paska (byłyby dwa Menu 1 nad sobą).
  if (openSafe) {
    return <VaultDocumentsView safe={openSafe} onBack={handleBackToSafes} />;
  }

  /**
   * P-17 (Piotr, OBR-40…43, 2026-07-27): „Zwróć uwagę na menu drugie, trzecie,
   * idą robione jakieś dziwne czwarte. Trzeba wdrożyć wszystkie narzędzia
   * i standardy."
   *
   * Lista sejfów jest ZAKŁADKĄ My Work, a ta ma już komplet: Menu 1
   * (breadcrumb „My Work › Sejf klienta"), Menu 2 (pigułki modułu + lupa)
   * i Menu 3. Ten komponent dokładał do tego WŁASNY `StandardModuleBar` —
   * czyli czwartą warstwę nagłówkową z drugim breadcrumbem „Client Vault"
   * i DRUGĄ wyszukiwarką na tym samym ekranie (kanon zna wyłącznie Menu 1/2/3).
   * Pasek zniknął; fraza przychodzi teraz z lupy Menu 2 hosta przez `searchQuery`,
   * więc jedno pole filtruje to, co widać.
   */
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-auto">
        <VaultSafesTable onOpenSafe={handleOpenSafe} searchQuery={searchQuery} />
      </div>
    </div>
  );
};

export default ClientDocumentsVault;
