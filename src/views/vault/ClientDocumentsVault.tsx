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
 */

import React from 'react';

import { isClientVaultEnabled } from '../../utils/clientVaultFlag';
import { DocumentsRAGTab } from '../superadmin/AIPlatformModule/Knowledge/DocumentsRAGTab';

export const ClientDocumentsVault: React.FC = () => {
  if (!isClientVaultEnabled()) return null;
  return <DocumentsRAGTab variant="client" />;
};

export default ClientDocumentsVault;
