import { FolderKanban, Plus } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  FolderCreateDialog,
  type FolderCreateSubmitInput,
} from '@/components/shared/FolderCreateDialog';
import {
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard';
import { ConfirmDialog } from '@/components/MyWork/shared/ConfirmDialog';
import { Modal } from '@/components/ui/primitives/Modal';
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

export const VaultFoldersTable: React.FC<{ onOpenFolder: (folder: FolderRow) => void }> = ({
  onOpenFolder,
}) => {
  const { t, i18n } = useTranslation();
  const pl = i18n.language.startsWith('pl');
  const [rows, setRows] = useState<FolderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [editing, setEditing] = useState<FolderRow | null>(null);
  const [editName, setEditName] = useState('');
  const [deleting, setDeleting] = useState<FolderRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const safes = await Api.getVaultSafes();
      const projectOptions = safes
        .filter((safe) => safe.type === 'project' && safe.projectId)
        .map((safe) => ({ id: safe.projectId!, name: safe.name }));
      setProjects(projectOptions);
      const [mine, organization, ...projectFolders] = await Promise.all([
        Api.getVaultFolders({ scope: 'user' }),
        Api.getVaultFolders({ scope: 'organization' }),
        ...projectOptions.map((project) =>
          Api.getVaultFolders({ scope: 'project', projectId: project.id })
        ),
      ]);
      const documentsByScope = await Promise.all([
        Api.getKnowledgeDocuments({ scope: 'user' }),
        Api.getKnowledgeDocuments({ scope: 'organization' }),
        ...projectOptions.map((project) =>
          Api.getKnowledgeDocuments({ scope: 'project', projectId: project.id })
        ),
      ]);
      const allFolders = [...mine, ...organization, ...projectFolders.flat()];
      const allDocuments = documentsByScope.flat();
      setRows(
        allFolders.map((folder: any) => ({
          ...folder,
          projectName: projectOptions.find((project) => project.id === folder.projectId)?.name,
          documentCount: allDocuments.filter((document: any) => document.folder_id === folder.id)
            .length,
          updatedAt: folder.updatedAt ?? null,
        }))
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t('vault.folders.loadFailed', 'Nie udało się pobrać folderów')
      );
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => {
    void load();
  }, [load]);

  const scopeLabel = (row: FolderRow) =>
    row.scope === 'user'
      ? t('vault.folders.scope.mine', 'Mój')
      : row.scope === 'organization'
        ? t('vault.folders.scope.organization', 'Organizacji')
        : `${t('vault.folders.scope.project', 'Projektu')}${row.projectName ? ` · ${row.projectName}` : ''}`;
  const columns = useMemo<TableColumn[]>(
    () => [
      { id: 'name', label: t('vault.folders.columns.name', 'Nazwa'), sortable: true },
      {
        id: 'scope',
        label: t('vault.folders.columns.scope', 'Zakres'),
        sortable: true,
        sortAccessor: (row) => scopeLabel(row as FolderRow),
        render: (row) => <span>{scopeLabel(row as FolderRow)}</span>,
      },
      {
        id: 'documentCount',
        label: t('vault.folders.columns.documents', 'Dokumenty'),
        sortable: true,
        render: (row) => (
          <span
            aria-label={`${t('vault.folders.columns.documents', 'Dokumenty')}: ${Number(row.documentCount) || 0}`}
          >
            {Number(row.documentCount) || 0}
          </span>
        ),
      },
      {
        id: 'updatedAt',
        label: t('vault.folders.columns.updatedAt', 'Ostatnia zmiana'),
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
    [t, pl]
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
          {t('vault.folders.newFolder', 'Nowy folder')}
        </button>
      </div>
      <StandardTable
        columns={columns}
        data={rows}
        loading={loading}
        error={error}
        onRetry={load}
        onRowDoubleClick={(row) => onOpenFolder(row as FolderRow)}
        rowMenu={(row): StandardRowMenu => ({
          primary: [
            {
              id: 'open',
              label: t('vault.folders.menu.open', 'Otwórz'),
              onClick: () => onOpenFolder(row as FolderRow),
            },
            {
              id: 'rename',
              label: t('vault.folders.menu.rename', 'Zmień nazwę'),
              onClick: () => {
                setEditing(row as FolderRow);
                setEditName(String(row.name));
              },
            },
          ],
          destructive: {
            label: t('vault.folders.menu.delete', 'Usuń'),
            onClick: () => setDeleting(row as FolderRow),
          },
        })}
        empty={{
          icon: FolderKanban,
          title: t('vault.folders.empty.title', 'Brak folderów'),
          description: t(
            'vault.folders.empty.description',
            'Foldery porządkują dokumenty przed otwarciem sejfu.'
          ),
        }}
        defaultSort={{ columnId: 'name', direction: 'asc' }}
        persistKey="vault.folders.list"
      />
      <FolderCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={create}
        busy={busy}
        projects={projects}
      />
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={t('vault.folders.rename.title', 'Zmień nazwę folderu')}
        footer={
          <button
            type="button"
            disabled={!editName.trim() || busy}
            className="rounded-lg bg-c-text px-3 py-2 text-sm text-c-surface disabled:opacity-50"
            onClick={async () => {
              if (!editing || !editName.trim()) return;
              setBusy(true);
              try {
                await Api.updateVaultFolder(editing.id, { name: editName.trim() });
                setEditing(null);
                await load();
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('vault.folders.rename.save', 'Zapisz')}
          </button>
        }
      >
        <input
          aria-label={t('vault.folders.rename.fieldLabel', 'Nazwa folderu')}
          value={editName}
          onChange={(event) => setEditName(event.target.value)}
          className="w-full rounded-lg border border-c-border bg-c-surface p-2 text-c-text"
        />
      </Modal>
      <ConfirmDialog
        isOpen={Boolean(deleting)}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          void Api.deleteVaultFolder(deleting.id).then(async () => {
            setDeleting(null);
            await load();
          });
        }}
        title={t('vault.folders.deleteConfirm.title', 'Usunąć folder?')}
        description={t(
          'vault.folders.deleteConfirm.description',
          'Dokumenty pozostaną w sejfie i zostaną odpięte od folderu.'
        )}
        confirmLabel={t('vault.folders.deleteConfirm.confirm', 'Usuń')}
        cancelLabel={t('vault.folders.deleteConfirm.cancel', 'Anuluj')}
        variant="danger"
      />
    </div>
  );
};
