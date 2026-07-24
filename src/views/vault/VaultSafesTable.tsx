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
 * wiersz → `onOpenSafe` (wrapper `ClientDocumentsVault` przełącza na
 * `DocumentsRAGTab` przefiltrowany do tego sejfu, z breadcrumbem powrotu).
 *
 * Kanon Triada: WYŁĄCZNIE `StandardTable` (zakaz bespoke tabeli per ekran) —
 * skill `consultify-triada`.
 */

import { Building2, FolderKanban, User } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { StandardTable, type TableColumn, type TableRow } from '../../components/standard';
import { Api } from '../../services/api';

export interface VaultSafe {
  id: string;
  type: 'user' | 'organization' | 'project';
  projectId: string | null;
  name: string;
  documentCount: number;
  lastModified: string | null;
}

export interface VaultSafesTableProps {
  onOpenSafe: (safe: VaultSafe) => void;
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

export const VaultSafesTable: React.FC<VaultSafesTableProps> = ({ onOpenSafe }) => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const [safes, setSafes] = useState<VaultSafe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            {safe.name}
          </span>
        );
      },
    },
    {
      id: 'documentCount',
      label: t('vault.safes.documents', isPolish ? 'Dokumenty' : 'Documents'),
      width: '140px',
      align: 'right',
      sortable: true,
      sortAccessor: (row: TableRow) => Number(row.documentCount) || 0,
      render: (row: TableRow) => (
        <span className="text-sm text-c-text-secondary">{Number(row.documentCount) || 0}</span>
      ),
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

  return (
    <StandardTable
      columns={columns}
      data={safes as unknown as TableRow[]}
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
      onRowClick={(row) => onOpenSafe(row as unknown as VaultSafe)}
      defaultSort={{ columnId: 'name', direction: 'asc' }}
      persistKey="vault.safes.list"
    />
  );
};

export default VaultSafesTable;
