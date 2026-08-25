import { Copy, Globe2, Plus, Trash2 } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  type AdminDomain,
  createAdminDomain,
  deleteAdminDomain,
  type DnsInstruction,
  type DomainVerificationOutcome,
  getAdminDomains,
  updateAdminDomain,
  verifyAdminDomain,
} from '../../services/adminDomainsApi';
import { ConfirmDialog } from '../MyWork/shared/ConfirmDialog';
import { StandardTable, type TableColumn, type TableRow } from '../standard/StandardTable';

const control =
  'rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text focus-visible:outline-none focus-visible:ring-2 ring-[color:var(--c-focus)] disabled:opacity-50';

const outcomeKeys: Record<DomainVerificationOutcome['status'], string> = {
  verified: 'verified',
  token_mismatch: 'tokenMismatch',
  no_record: 'noRecord',
  domain_not_found: 'domainNotFound',
  timeout: 'timeout',
  dns_error: 'dnsError',
};
export const AdminDomainsPanel: React.FC = () => {
  const { t } = useTranslation();
  const [domains, setDomains] = useState<AdminDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [instruction, setInstruction] = useState<DnsInstruction | null>(null);
  const [lastOutcome, setLastOutcome] = useState<DomainVerificationOutcome | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminDomain | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDomains(await getAdminDomains());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('admin.domains.errors.load'));
    } finally {
      setLoading(false);
    }
  }, [t]);
  React.useEffect(() => void load(), [load]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy('create');
    try {
      const created = await createAdminDomain({ domain: name.trim(), autoJoin: false });
      const readback = await getAdminDomains();
      if (!readback.some((item) => item.id === created.domain.id))
        throw new Error(t('admin.domains.errors.createReadback'));
      setDomains(readback);
      setInstruction(created.instruction);
      setName('');
      toast.success(t('admin.domains.created'));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : t('admin.domains.errors.create'));
    } finally {
      setBusy(null);
    }
  };

  const verify = async (domain: AdminDomain) => {
    setBusy(domain.id);
    try {
      const outcome = await verifyAdminDomain(domain.id);
      setDomains(await getAdminDomains());
      setLastOutcome(outcome);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : t('admin.domains.errors.verify'));
    } finally {
      setBusy(null);
    }
  };

  const toggleAutoJoin = async (domain: AdminDomain) => {
    setBusy(domain.id);
    try {
      await updateAdminDomain(domain.id, !domain.autoJoin);
      setDomains(await getAdminDomains());
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : t('admin.domains.errors.update'));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(deleteTarget.id);
    try {
      await deleteAdminDomain(deleteTarget.id);
      const readback = await getAdminDomains();
      if (readback.some((item) => item.id === deleteTarget.id))
        throw new Error(t('admin.domains.errors.deleteReadback'));
      setDomains(readback);
      setDeleteTarget(null);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : t('admin.domains.errors.delete'));
    } finally {
      setBusy(null);
    }
  };

  const rows = useMemo<TableRow[]>(() => domains.map((domain) => ({ ...domain })), [domains]);
  const columns = useMemo<TableColumn[]>(
    () => [
      { id: 'domain', label: t('admin.domains.columns.domain') },
      {
        id: 'autoJoin',
        label: t('admin.domains.columns.autoJoin'),
        render: (row) => (
          <button
            type="button"
            className={control}
            disabled={busy === row.id}
            onClick={() => void toggleAutoJoin(row as unknown as AdminDomain)}
          >
            {row.autoJoin ? t('common.enabled') : t('common.disabled')}
          </button>
        ),
      },
      {
        id: 'verified',
        label: t('admin.domains.columns.status'),
        render: (row) =>
          row.verified ? t('admin.domains.status.verified') : t('admin.domains.status.pending'),
      },
      {
        id: 'verifiedAt',
        label: t('admin.domains.columns.verifiedAt'),
        render: (row) => (row.verifiedAt ? new Date(String(row.verifiedAt)).toLocaleString() : '—'),
      },
      {
        id: 'actions',
        label: t('admin.domains.columns.actions'),
        render: (row) => (
          <button
            type="button"
            className={control}
            disabled={busy === row.id}
            onClick={() => void verify(row as unknown as AdminDomain)}
          >
            {row.verified ? t('admin.domains.actions.reverify') : t('admin.domains.actions.verify')}
          </button>
        ),
      },
    ],
    [busy, t]
  );

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-c-border bg-c-surface p-5">
        <h2 className="text-lg font-semibold text-c-text">{t('admin.domains.title')}</h2>
        <p className="mt-1 text-sm text-c-text-secondary">{t('admin.domains.description')}</p>
        <form className="mt-4 flex gap-2" onSubmit={create}>
          <label className="flex-1 text-sm text-c-text-secondary">
            {t('admin.domains.form.domain')}
            <input
              className={`${control} mt-1 w-full`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="example.com"
              required
            />
          </label>
          <button className={`${control} self-end`} disabled={!name.trim() || Boolean(busy)}>
            <Plus className="h-4 w-4" /> {t('admin.domains.actions.add')}
          </button>
        </form>
      </section>

      {instruction && (
        <section className="rounded-2xl border border-c-info bg-c-surface p-5">
          <h3 className="font-semibold text-c-text">{t('admin.domains.dns.title')}</h3>
          <dl className="mt-3 grid gap-2 text-sm">
            <div>
              <dt className="text-c-text-muted">{t('admin.domains.dns.name')}</dt>
              <dd className="break-all text-c-text">{instruction.name}</dd>
            </div>
            <div>
              <dt className="text-c-text-muted">{t('admin.domains.dns.type')}</dt>
              <dd className="text-c-text">{instruction.type}</dd>
            </div>
            <div>
              <dt className="text-c-text-muted">{t('admin.domains.dns.value')}</dt>
              <dd className="break-all text-c-text">{instruction.value}</dd>
            </div>
          </dl>
          <button
            type="button"
            className={`${control} mt-3 inline-flex items-center gap-2`}
            onClick={() => void navigator.clipboard.writeText(instruction.value)}
          >
            <Copy className="h-4 w-4" /> {t('admin.domains.actions.copy')}
          </button>
        </section>
      )}

      {lastOutcome && (
        <section
          role="status"
          className="rounded-2xl border border-c-border bg-c-surface p-4 text-sm text-c-text"
        >
          {t(`admin.domains.outcomes.${outcomeKeys[lastOutcome.status]}`)}
          {lastOutcome.status === 'dns_error' && lastOutcome.detail ? ` ${lastOutcome.detail}` : ''}
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
              label: t('admin.domains.actions.delete'),
              icon: Trash2,
              onClick: () => setDeleteTarget(domains.find((item) => item.id === row.id) ?? null),
            },
          })}
          empty={{
            icon: Globe2,
            title: t('admin.domains.empty.title'),
            description: t('admin.domains.empty.description'),
          }}
          persistKey="admin.domains"
        />
      </section>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void remove()}
        title={t('admin.domains.delete.title')}
        description={t('admin.domains.delete.description')}
        confirmLabel={t('common.delete')}
        variant="danger"
      />
    </div>
  );
};

export default AdminDomainsPanel;
