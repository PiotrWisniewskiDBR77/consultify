import { FolderKanban, Plus } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  FolderCreateDialog,
  type FolderCreateSubmitInput,
} from '@/components/shared/FolderCreateDialog';
import { StandardTable, type TableColumn, type TableRow } from '@/components/standard';
import { Api } from '@/services/api';

type Scope = 'user' | 'organization' | 'project';
interface FolderRow extends TableRow {
  name: string;
  scope: Scope;
  projectId: string | null;
  projectName?: string;
  documentCount: number;
  updatedAt: string | null;
}

export const VaultFoldersTable: React.FC<{ onOpenFolder: (folderId: string) => void }> = ({
  onOpenFolder,
}) => {
  const { t, i18n } = useTranslation();
  const pl = i18n.language.startsWith('pl');
  const [rows, setRows] = useState<FolderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mine, organization] = await Promise.all([
        Api.getVaultFolders({ scope: 'user' }),
        Api.getVaultFolders({ scope: 'organization' }),
      ]);
      setRows(
        [...mine, ...organization].map((folder: any) => ({
          ...folder,
          documentCount: Number(folder.documentCount ?? 0),
          updatedAt: folder.updatedAt ?? null,
        }))
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : pl
            ? 'Nie udało się pobrać folderów'
            : 'Failed to load folders'
      );
    } finally {
      setLoading(false);
    }
  }, [pl]);
  useEffect(() => {
    void load();
  }, [load]);

  const scopeLabel = (row: FolderRow) =>
    row.scope === 'user'
      ? pl
        ? 'Mój'
        : 'Mine'
      : row.scope === 'organization'
        ? pl
          ? 'Organizacji'
          : 'Organization'
        : `${pl ? 'Projektu' : 'Project'}${row.projectName ? ` · ${row.projectName}` : ''}`;
  const columns = useMemo<TableColumn[]>(
    () => [
      { id: 'name', label: pl ? 'Nazwa' : 'Name', sortable: true },
      {
        id: 'scope',
        label: pl ? 'Zakres' : 'Scope',
        sortable: true,
        sortAccessor: (row) => scopeLabel(row as FolderRow),
        render: (row) => <span>{scopeLabel(row as FolderRow)}</span>,
      },
      {
        id: 'documentCount',
        label: pl ? 'Dokumenty' : 'Documents',
        sortable: true,
        render: (row) => (
          <span aria-label={`${pl ? 'Dokumenty' : 'Documents'}: ${Number(row.documentCount) || 0}`}>
            {Number(row.documentCount) || 0}
          </span>
        ),
      },
      {
        id: 'updatedAt',
        label: pl ? 'Ostatnia zmiana' : 'Last modified',
        sortable: true,
        render: (row) => (
          <span>
            {row.updatedAt
              ? new Date(String(row.updatedAt)).toLocaleDateString(pl ? 'pl-PL' : 'en')
              : '—'}
          </span>
        ),
      },
    ],
    [pl]
  );

  const create = async (input: FolderCreateSubmitInput) => {
    if (input.scope === 'project' && !input.projectId) return;
    setBusy(true);
    try {
      await Api.createVaultFolder(input);
      setCreateOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text"
        >
          <Plus size={14} />
          {pl ? 'Nowy folder' : 'New folder'}
        </button>
      </div>
      <StandardTable
        columns={columns}
        data={rows}
        loading={loading}
        error={error}
        onRetry={load}
        onRowDoubleClick={(row) => onOpenFolder(String(row.id))}
        empty={{
          icon: FolderKanban,
          title: pl ? 'Brak folderów' : 'No folders',
          description: pl
            ? 'Foldery porządkują dokumenty przed otwarciem sejfu.'
            : 'Folders organize documents before opening a safe.',
        }}
        defaultSort={{ columnId: 'name', direction: 'asc' }}
        persistKey="vault.folders.list"
      />
      <FolderCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={create}
        busy={busy}
        projects={[]}
      />
    </div>
  );
};
