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
 * kanon `StandardTable`) zamiast od razu uploadu.
 *
 * ★ POPRAWKA ODBIORU TRIADY (2026-07-24, zrzuty demo Piotra: „cała ta tabela
 * jest super biedna [...] Nie ma struktury menu 1, 2, 3. [...] Po wejściu
 * powinna się otwierać karta w menu dynamicznym"):
 * - Menu 1: breadcrumb stały „Client Vault" (identyczny niezależnie od stanu —
 *   nawigacja wewnątrz zakładki teraz idzie przez Menu 3, nie przez podmianę
 *   breadcrumbu).
 * - Menu 2: lupa wpięta (`onSearch`/`searchValue`) — filtruje `VaultSafesTable`
 *   po nazwie sejfu (poprzednio samotna ikona bez działania).
 * - Menu 3: otwarcie sejfu (`onOpenSafe`) NIE podmienia całego widoku —
 *   dokłada KARTĘ do Menu 3 (`openItems`/`activeItemId`/`onSelectItem`/
 *   `onCloseItem`, ten sam mechanizm co w `AgentHubShell.tsx` — patrz tamten
 *   komentarz dla pełnego opisu `StandardModuleBar`→`ModuleNavBar`→
 *   `DynamicTabs`). Zamknięcie karty (×) wraca do tabeli sejfów.
 * - Treść otwartego sejfu (`DocumentsRAGTab`) owinięta w lekką kartę
 *   (bordered/rounded), żeby czytać się jako "to jest karta w hubie", nie
 *   "cały ekran się podmienił". To NIE jest pełna migracja `DocumentsRAGTab`
 *   do `StandardTable`/`StandardArtifactShell` (SPEC-A) — ten komponent ma
 *   własny, bespoke toolbar/listę sprzed kanonu (HP-22, poza zakresem tego
 *   zadania) — zgłoszone w raporcie jako osobny, większy temat.
 * - Kebab/preview/pstryczek samego sejfu → `VaultSafesTable.tsx`.
 *
 * "No alerts"/samotna lupa bez paska (zgłoszenie Piotra, punkt 8): nie
 * znaleziono źródła "No alerts" w tej ścieżce (grep `src/` — jedyne
 * wystąpienie jest w `MyWorkHub.tsx`, niezwiązane z Vault); samotna lupa
 * była realnym defektem — naprawiona przez pełne Menu 2 wyżej.
 */

import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { OpenDocument } from '../../components/shared/ModuleHub/types';
import { StandardModuleBar } from '../../components/standard';
import { isClientVaultEnabled } from '../../utils/clientVaultFlag';
import { DocumentsRAGTab } from '../superadmin/AIPlatformModule/Knowledge/DocumentsRAGTab';
import { type VaultSafe, VaultSafesTable } from './VaultSafesTable';

export const ClientDocumentsVault: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const [openSafe, setOpenSafe] = useState<VaultSafe | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleOpenSafe = useCallback((safe: VaultSafe) => setOpenSafe(safe), []);
  const handleBackToSafes = useCallback(() => setOpenSafe(null), []);

  if (!isClientVaultEnabled()) return null;

  const openItems: OpenDocument[] = openSafe
    ? [
        {
          id: openSafe.id,
          type: 'tool',
          subType: 'vault-safe',
          name: openSafe.name,
          status: 'DONE',
        },
      ]
    : [];

  return (
    <div className="h-full flex flex-col">
      <StandardModuleBar
        breadcrumbs={[
          { label: t('vault.breadcrumb.root', isPolish ? 'Sejf klienta' : 'Client Vault') },
        ]}
        onSearch={setSearchQuery}
        searchValue={searchQuery}
        openItems={openItems}
        activeItemId={openSafe?.id ?? null}
        onSelectItem={() => undefined}
        onCloseItem={handleBackToSafes}
        onShowList={handleBackToSafes}
      />
      <div className="flex-1 min-h-0 overflow-auto">
        {openSafe ? (
          <div className="h-full p-4">
            <div className="h-full min-h-full overflow-auto rounded-xl border border-c-border-subtle bg-c-surface">
              <DocumentsRAGTab
                variant="client"
                initialScope={openSafe.type}
                initialProjectId={openSafe.projectId || undefined}
              />
            </div>
          </div>
        ) : (
          <VaultSafesTable onOpenSafe={handleOpenSafe} searchQuery={searchQuery} />
        )}
      </div>
    </div>
  );
};

export default ClientDocumentsVault;
