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
 * kanon `StandardTable`) zamiast od razu uploadu; klik w wiersz otwiera
 * `DocumentsRAGTab` przefiltrowany do tego sejfu (`initialScope`/
 * `initialProjectId`), z breadcrumbem „Sejf klienta › [nazwa]" i przyciskiem
 * powrotu do tabeli (`StandardModuleBar` breadcrumb, pierwszy człon klikalny).
 * Zakres uploadu/3 poziomów bez zmian (VLT-001..003) — to WYŁĄCZNIE warstwa
 * nawigacji, stan lokalny (nieprzeżywa odświeżenia strony, tak jak reszta
 * nawigacji w My Work).
 */

import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { StandardModuleBar } from '../../components/standard';
import { isClientVaultEnabled } from '../../utils/clientVaultFlag';
import { DocumentsRAGTab } from '../superadmin/AIPlatformModule/Knowledge/DocumentsRAGTab';
import { type VaultSafe, VaultSafesTable } from './VaultSafesTable';

export const ClientDocumentsVault: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const [openSafe, setOpenSafe] = useState<VaultSafe | null>(null);

  const handleOpenSafe = useCallback((safe: VaultSafe) => setOpenSafe(safe), []);
  const handleBackToSafes = useCallback(() => setOpenSafe(null), []);

  if (!isClientVaultEnabled()) return null;

  return (
    <div className="h-full flex flex-col">
      <StandardModuleBar
        breadcrumbs={
          openSafe
            ? [
                {
                  label: t('vault.breadcrumb.root', isPolish ? 'Sejf klienta' : 'Client Vault'),
                  onClick: handleBackToSafes,
                },
                { label: openSafe.name },
              ]
            : [{ label: t('vault.breadcrumb.root', isPolish ? 'Sejf klienta' : 'Client Vault') }]
        }
      />
      <div className="flex-1 min-h-0 overflow-auto">
        {openSafe ? (
          <DocumentsRAGTab
            variant="client"
            initialScope={openSafe.type}
            initialProjectId={openSafe.projectId || undefined}
          />
        ) : (
          <VaultSafesTable onOpenSafe={handleOpenSafe} />
        )}
      </div>
    </div>
  );
};

export default ClientDocumentsVault;
