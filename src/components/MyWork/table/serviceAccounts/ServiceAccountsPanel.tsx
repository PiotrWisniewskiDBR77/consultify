/**
 * ServiceAccountsPanel — org-admin panel for Table Platform service accounts
 * (PAT tokens, `tp_sa_*`) used by the REST API gateway (Zapier / Make / scripts).
 *
 * Backed by `POST/GET /admin/service-accounts` and `DELETE
 * /admin/service-accounts/:id` (server guard: `requireOrgRole('admin')` — org
 * OWNER/ADMIN only). This panel does not re-check the role client-side; a
 * non-admin viewing it will simply see the list/create calls 403 (server is
 * the enforcement point).
 *
 * Security-sensitive UX: the raw token is only ever returned once, from the
 * create call. It is shown in a one-time reveal card with a copy affordance
 * and an explicit "you will not see this again" warning, then discarded from
 * local state as soon as the panel is closed/unmounted — the API never
 * returns it again (ServiceAccountService only persists a SHA-256 hash).
 */

import { AlertTriangle, Check, ClipboardCopy, KeyRound, Loader2, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import {
  createServiceAccount,
  getServiceAccounts,
  revokeServiceAccount,
  type TpServiceAccount,
  type TpServiceAccountCreateResult,
} from '@/services/api/tablePlatform.api';

const SCOPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'records:read', label: 'Records — read' },
  { value: 'records:write', label: 'Records — write' },
  { value: 'metadata:read', label: 'Metadata — read' },
];

export interface ServiceAccountsPanelProps {
  /** Test seam: skip the initial network call and seed the list directly. */
  testInitialAccounts?: TpServiceAccount[];
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export const ServiceAccountsPanel: React.FC<ServiceAccountsPanelProps> = ({
  testInitialAccounts,
}) => {
  const useNetwork = testInitialAccounts === undefined;

  const [accounts, setAccounts] = useState<TpServiceAccount[]>(testInitialAccounts ?? []);
  const [loading, setLoading] = useState(useNetwork);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [expiresInDays, setExpiresInDays] = useState<string>('');
  const [creating, setCreating] = useState(false);

  const [justCreated, setJustCreated] = useState<TpServiceAccountCreateResult | null>(null);
  const [copied, setCopied] = useState(false);

  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!useNetwork) return;
    setLoading(true);
    setError(null);
    try {
      const list = await getServiceAccounts();
      setAccounts(Array.isArray(list) ? list : []);
    } catch (e) {
      setError((e as Error)?.message ?? 'Failed to load service accounts');
    } finally {
      setLoading(false);
    }
  }, [useNetwork]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleScope = useCallback((value: string) => {
    setScopes((prev) => (prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]));
  }, []);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (scopes.length === 0) {
      toast.error('Select at least one scope');
      return;
    }
    const parsedExpiry = expiresInDays.trim() ? Number(expiresInDays.trim()) : undefined;
    if (parsedExpiry !== undefined && (!Number.isFinite(parsedExpiry) || parsedExpiry <= 0)) {
      toast.error('Expiry must be a positive number of days');
      return;
    }

    setCreating(true);
    try {
      const result = await createServiceAccount({
        name: name.trim(),
        scopes,
        ...(parsedExpiry !== undefined ? { expiresInDays: parsedExpiry } : {}),
      });
      setJustCreated(result);
      setCopied(false);
      setAccounts((prev) => [result.account, ...prev]);
      setName('');
      setScopes([]);
      setExpiresInDays('');
      toast.success('Service account created');
    } catch (e) {
      toast.error(`Failed to create service account: ${(e as Error)?.message ?? 'unknown'}`);
    } finally {
      setCreating(false);
    }
  }, [name, scopes, expiresInDays]);

  const handleCopyToken = useCallback(async () => {
    if (!justCreated) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(justCreated.token);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  }, [justCreated]);

  const handleRevoke = useCallback(
    async (id: string) => {
      setRevokingId(id);
      try {
        await revokeServiceAccount(id);
        setAccounts((prev) => prev.filter((a) => a.id !== id));
        setConfirmRevokeId(null);
        toast.success('Service account revoked');
      } catch (e) {
        toast.error(`Failed to revoke service account: ${(e as Error)?.message ?? 'unknown'}`);
      } finally {
        setRevokingId(null);
      }
    },
    []
  );

  return (
    <section
      className="flex flex-col gap-4 text-sm"
      aria-label="Service accounts"
      data-testid="service-accounts-panel"
    >
      <header>
        <h2 className="text-sm font-semibold text-c-text">Service accounts (API tokens)</h2>
        <p className="mt-1 text-xs text-c-text-muted">
          Personal access tokens (<code className="font-mono">tp_sa_*</code>) for scripts,
          Zapier/Make, and other machine clients calling the Table Platform REST API. Only org
          admins can create or revoke these.
        </p>
      </header>

      {/* ── Create form ─────────────────────────────────────────────────── */}
      <section
        className="rounded-md border border-c-border-subtle p-3"
        aria-label="Create service account"
      >
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
          New service account
        </h3>

        <label className="block">
          <span className="text-[11px] text-c-text-muted">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Zapier integration"
            className="mt-1 w-full rounded-md border border-c-border bg-c-surface px-2 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
            data-testid="sa-create-name"
            aria-label="Service account name"
          />
        </label>

        <fieldset className="mt-2">
          <legend className="text-[11px] text-c-text-muted">Scopes</legend>
          <div className="mt-1 flex flex-col gap-1">
            {SCOPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 text-xs text-c-text"
              >
                <input
                  type="checkbox"
                  checked={scopes.includes(opt.value)}
                  onChange={() => toggleScope(opt.value)}
                  className="h-3.5 w-3.5 focus:outline-none focus:ring-2 focus:ring-c-focus"
                  data-testid={`sa-create-scope-${opt.value}`}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="mt-2 block">
          <span className="text-[11px] text-c-text-muted">Expires in (days, optional)</span>
          <input
            type="number"
            min={1}
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
            placeholder="Never"
            className="mt-1 w-full rounded-md border border-c-border bg-c-surface px-2 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
            data-testid="sa-create-expiry"
            aria-label="Expires in days"
          />
        </label>

        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={creating}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-c-surface-raised px-3 py-1.5 text-xs font-semibold text-c-text hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-c-focus"
          data-testid="sa-create-submit"
        >
          {creating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <KeyRound className="h-3 w-3" />
          )}
          Create service account
        </button>

        {justCreated ? (
          <div
            className="mt-3 space-y-2 rounded-md border border-c-warning bg-[color-mix(in_srgb,var(--c-warning)_12%,transparent)] p-2 text-xs text-c-text"
            data-testid="sa-created-result"
          >
            <div className="flex items-center gap-1.5 font-semibold text-c-warning">
              <AlertTriangle className="h-3.5 w-3.5" />
              Copy this token now — you will not see it again.
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-[10px]" data-testid="sa-created-token">
                {justCreated.token}
              </span>
              <button
                type="button"
                onClick={() => void handleCopyToken()}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-c-border bg-c-surface px-2 py-0.5 text-[10px] text-c-text hover:bg-c-surface-raised focus:outline-none focus:ring-2 focus:ring-c-focus"
                data-testid="sa-created-copy"
              >
                {copied ? <Check className="h-3 w-3" /> : <ClipboardCopy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy token'}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* ── List ────────────────────────────────────────────────────────── */}
      <section aria-label="Existing service accounts">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
          Existing service accounts
        </h3>

        {loading ? (
          <div className="flex items-center gap-2 text-c-text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading service accounts…
          </div>
        ) : error ? (
          <div
            className="rounded-md border border-c-danger bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] px-3 py-2 text-c-danger"
            data-testid="sa-list-error"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-xs text-c-text-muted" data-testid="sa-list-empty">
            No service accounts yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="sa-list">
            {accounts.map((account) => (
              <li
                key={account.id}
                className="rounded-md border border-c-border-subtle p-2"
                data-testid={`sa-row-${account.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-c-text">{account.name}</div>
                    <div className="mt-0.5 truncate font-mono text-[10px] text-c-text-muted">
                      {account.token_prefix}…
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {account.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="rounded-full bg-c-surface-raised px-1.5 py-0.5 text-[10px] text-c-text-secondary"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                    <dl className="mt-1 grid grid-cols-2 gap-x-2 text-[10px] text-c-text-muted">
                      <dt>Created</dt>
                      <dd>{formatDate(account.created_at)}</dd>
                      <dt>Last used</dt>
                      <dd>{formatDate(account.last_used_at)}</dd>
                      <dt>Expires</dt>
                      <dd>{formatDate(account.expires_at)}</dd>
                    </dl>
                  </div>

                  {confirmRevokeId === account.id ? (
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[10px] text-c-text-muted">Revoke this token?</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => void handleRevoke(account.id)}
                          disabled={revokingId === account.id}
                          className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-c-focus"
                          data-testid={`sa-revoke-confirm-${account.id}`}
                        >
                          {revokingId === account.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          Confirm revoke
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRevokeId(null)}
                          className="rounded-md border border-c-border px-2 py-1 text-[10px] text-c-text-secondary hover:bg-c-surface-raised focus:outline-none focus:ring-2 focus:ring-c-focus"
                          data-testid={`sa-revoke-cancel-${account.id}`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmRevokeId(account.id)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-c-border px-2 py-1 text-[10px] text-c-danger hover:bg-[color-mix(in_srgb,var(--c-danger)_10%,transparent)] focus:outline-none focus:ring-2 focus:ring-c-focus"
                      data-testid={`sa-revoke-${account.id}`}
                      aria-label={`Revoke ${account.name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                      Revoke
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
};

export default ServiceAccountsPanel;
