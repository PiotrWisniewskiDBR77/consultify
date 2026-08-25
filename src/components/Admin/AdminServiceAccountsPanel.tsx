import { KeyRound, Plus, Trash2 } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  createServiceAccount,
  getServiceAccounts,
  revokeServiceAccount,
  type ServiceAccount,
} from '../../services/adminServiceAccountsApi';
import { ConfirmDialog } from '../MyWork/shared/ConfirmDialog';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';
import { useTranslation } from 'react-i18next';
const input =
  'w-full rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 ring-[color:var(--c-focus)]';
const button =
  'inline-flex items-center gap-2 rounded-lg border border-c-border px-3 py-2 text-sm font-medium text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 ring-[color:var(--c-focus)] disabled:opacity-50';
const DEFAULT_SCOPES = ['records:read', 'records:write', 'metadata:read'];
export const AdminServiceAccountsPanel: React.FC = () => {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<ServiceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<ServiceAccount | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAccounts(await getServiceAccounts());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : t('admin.security.service-accounts.day2Auto.text1')
      );
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => void load(), [load]);
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const created = await createServiceAccount({
        name: name.trim(),
        scopes: DEFAULT_SCOPES,
      });
      const readback = await getServiceAccounts();
      if (!readback.some((item) => item.id === created.account.id))
        throw new Error(t('admin.security.service-accounts.day2Auto.text2'));
      setAccounts(readback);
      setSecret(created.token);
      setName('');
      toast.success(t('admin.security.service-accounts.day2Auto.text3'));
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t('admin.security.service-accounts.day2Auto.text4')
      );
    } finally {
      setBusy(false);
    }
  };
  const revoke = async () => {
    if (!target || busy) return;
    setBusy(true);
    try {
      await revokeServiceAccount(target.id);
      const readback = await getServiceAccounts();
      if (readback.some((item) => item.id === target.id))
        throw new Error(t('admin.security.service-accounts.day2Auto.text5'));
      setAccounts(readback);
      setTarget(null);
      toast.success(t('admin.security.service-accounts.day2Auto.text6'));
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : t('admin.security.service-accounts.day2Auto.text7')
      );
    } finally {
      setBusy(false);
    }
  };
  const rows = useMemo<TableRow[]>(
    () =>
      accounts.map((account) => ({
        ...account,
        id: account.id,
      })),
    [accounts]
  );
  const columns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'name',
        label: t('admin.security.service-accounts.day2Auto.text8'),
      },
      {
        id: 'token_prefix',
        label: 'Prefiks tokenu',
      },
      {
        id: 'scopes',
        label: 'Zakresy',
        render: (row) => (Array.isArray(row.scopes) ? row.scopes.join(', ') : '—'),
      },
      {
        id: 'last_used_at',
        label: t('admin.security.service-accounts.day2Auto.text9'),
        render: (row) =>
          row.last_used_at
            ? new Date(String(row.last_used_at)).toLocaleString()
            : t('admin.security.service-accounts.day2Auto.text10'),
      },
      {
        id: 'expires_at',
        label: t('admin.security.service-accounts.day2Auto.text11'),
        render: (row) =>
          row.expires_at ? new Date(String(row.expires_at)).toLocaleString() : 'Bez terminu',
      },
    ],
    []
  );
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-c-border bg-c-surface p-5">
        <h2 className="text-lg font-semibold text-c-text">
          {t('admin.security.service-accounts.day2Auto.text12')}
        </h2>
        <p className="mt-1 text-sm text-c-text-secondary">
          {t('admin.security.service-accounts.day2Auto.text13')}
        </p>
        <form onSubmit={create} className="mt-4 flex gap-2">
          <label className="flex-1 text-sm text-c-text-secondary">
            {t('admin.security.service-accounts.day2Auto.text8')}
            <input
              className={`${input} mt-1`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <button className={`${button} self-end`} disabled={!name.trim() || busy}>
            <Plus className="h-4 w-4" />
            {t('admin.security.service-accounts.day2Auto.text14')}
          </button>
        </form>
      </section>
      {secret && (
        <section role="alert" className="rounded-2xl border border-c-info bg-c-surface p-5">
          <h3 className="font-semibold text-c-text">
            {t('admin.security.service-accounts.day2Auto.text15')}
          </h3>
          <code className="mt-2 block break-all rounded-lg bg-c-surface-raised p-3 text-sm text-c-text">
            {secret}
          </code>
          <button className={`${button} mt-3`} onClick={() => setSecret(null)} type="button">
            {t('admin.security.service-accounts.day2Auto.text16')}
          </button>
        </section>
      )}
      <section className="rounded-2xl border border-c-border bg-c-surface p-2">
        <StandardTable
          columns={columns}
          data={rows}
          loading={loading}
          error={error}
          onRetry={() => void load()}
          rowMenu={(row) => ({
            destructive: {
              label: t('admin.security.service-accounts.day2Auto.text17'),
              icon: Trash2,
              onClick: () => setTarget(accounts.find((item) => item.id === row.id) || null),
            },
          })}
          empty={{
            icon: KeyRound,
            title: t('admin.security.service-accounts.day2Auto.text18'),
            description: t('admin.security.service-accounts.day2Auto.text19'),
          }}
          persistKey="admin.serviceAccounts"
        />
      </section>
      <ConfirmDialog
        isOpen={Boolean(target)}
        onCancel={() => setTarget(null)}
        onConfirm={() => void revoke()}
        title={t('admin.security.service-accounts.day2Auto.text20')}
        description={t('admin.security.service-accounts.day2Auto.text21')}
        confirmLabel={t('admin.security.service-accounts.day2Auto.text22')}
        variant="danger"
      />
    </div>
  );
};
export default AdminServiceAccountsPanel;
