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
 */

import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { StandardModuleBar } from '../../components/standard';
import { isClientVaultEnabled } from '../../utils/clientVaultFlag';
import { VaultDocumentsView } from './VaultDocumentsView';
import { type VaultSafe, VaultSafesTable } from './VaultSafesTable';

export const ClientDocumentsVault: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
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

  return (
    <div className="h-full flex flex-col">
      <StandardModuleBar
        breadcrumbs={[
          { label: t('vault.breadcrumb.root', isPolish ? 'Sejf klienta' : 'Client Vault') },
        ]}
      />
      <div className="flex-1 min-h-0 overflow-auto">
        <VaultSafesTable onOpenSafe={handleOpenSafe} />
      </div>
    </div>
  );
};

export default ClientDocumentsVault;
