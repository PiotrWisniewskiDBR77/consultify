import { Shield, Trash2 } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import {
  createSecurityRole,
  deleteSecurityRole,
  getSecurityRoles,
  type SecurityRole,
  updateSecurityRole,
} from '../../services/adminRolesApi';
import { ConfirmDialog } from '../MyWork/shared/ConfirmDialog';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';
import { useTranslation } from 'react-i18next';
const buttonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm font-medium text-c-text hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 ring-[color:var(--c-focus)]';
export const AdminRolesPermissionsPanel: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<SecurityRole[]>([]),
    [name, setName] = useState(''),
    [permissions, setPermissions] = useState(''),
    [edit, setEdit] = useState<SecurityRole | null>(null),
    [del, setDel] = useState<SecurityRole | null>(null),
    [ownerOnly, setOwnerOnly] = useState(false),
    [error, setError] = useState<string | null>(null);
  const load = () =>
    getSecurityRoles()
      .then(setData)
      .catch((e: any) => {
        if (
          e?.code === 'PROJECT_ROLES_MANAGE_REQUIRED' ||
          String(e?.message).includes('PROJECT_ROLES_MANAGE_REQUIRED')
        )
          setOwnerOnly(true);
        else setError(e.message);
      });
  useEffect(() => {
    void load();
  }, []);
  const save = async () => {
    const p = permissions
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    try {
      setData(
        edit ? await updateSecurityRole(edit.id, name, p) : await createSecurityRole(name, p)
      );
      setName('');
      setPermissions('');
      setEdit(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.team.roles-permissions.day2Auto.text1'));
    }
  };
  const cols = useMemo<TableColumn[]>(
      () => [
        {
          id: 'name',
          label: t('admin.team.roles-permissions.day2Auto.text2'),
        },
        {
          id: 'permissions',
          label: 'Uprawnienia',
        },
        {
          id: 'updated',
          label: 'Aktualizacja',
        },
      ],
      []
    ),
    rows = useMemo<TableRow[]>(
      () =>
        data.map((r) => ({
          id: r.id,
          name: r.name,
          permissions:
            (r.permissions || []).join(', ') || t('admin.team.roles-permissions.day2Auto.text3'),
          updated: r.updated_at ? new Date(r.updated_at).toLocaleString() : '—',
        })),
      [data]
    );
  if (ownerOnly)
    return (
      <div role="alert" className="rounded-xl border border-c-border p-5">
        {t('admin.team.roles-permissions.day2Auto.text4')}
      </div>
    );
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-c-text">
        {t('admin.team.roles-permissions.day2Auto.text5')}
      </h2>
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-c-danger bg-c-surface p-4 text-sm text-c-danger"
        >
          {error}
        </div>
      )}
      <section className="flex flex-wrap gap-2 rounded-xl border border-c-border p-4">
        <input
          aria-label={t('admin.team.roles-permissions.day2Auto.text6')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border border-c-border bg-c-surface p-2"
          placeholder={t('admin.team.roles-permissions.day2Auto.text6')}
        />
        <input
          aria-label="Uprawnienia"
          value={permissions}
          onChange={(e) => setPermissions(e.target.value)}
          className="min-w-64 rounded border border-c-border bg-c-surface p-2"
          placeholder="permissions, po przecinku"
        />
        <button disabled={!name.trim()} onClick={() => void save()} className={buttonClass}>
          {edit
            ? t('admin.team.roles-permissions.day2Auto.text7')
            : t('admin.team.roles-permissions.day2Auto.text8')}
        </button>
      </section>
      <StandardTable
        columns={cols}
        data={rows}
        rowMenu={(row) => ({
          primary: [
            {
              id: 'edit',
              label: 'Edytuj',
              onClick: () => {
                const r = data.find((x) => x.id === row.id);
                if (r) {
                  setEdit(r);
                  setName(r.name);
                  setPermissions((r.permissions || []).join(', '));
                }
              },
            },
          ],
          destructive: {
            label: t('admin.team.roles-permissions.day2Auto.text9'),
            icon: Trash2,
            onClick: () => setDel(data.find((x) => x.id === row.id) || null),
          },
        })}
        empty={{
          icon: Shield,
          title: t('admin.team.roles-permissions.day2Auto.text10'),
          description: t('admin.team.roles-permissions.day2Auto.text11'),
        }}
        persistKey="admin.roles"
      />
      <ConfirmDialog
        isOpen={!!del}
        onCancel={() => setDel(null)}
        onConfirm={() => {
          if (del)
            void deleteSecurityRole(del.id)
              .then(setData)
              .finally(() => setDel(null));
        }}
        title={t('admin.team.roles-permissions.day2Auto.text12')}
        description={t('admin.team.roles-permissions.day2Auto.text13')}
        confirmLabel={t('admin.team.roles-permissions.day2Auto.text14')}
        variant="danger"
      />
    </div>
  );
};
