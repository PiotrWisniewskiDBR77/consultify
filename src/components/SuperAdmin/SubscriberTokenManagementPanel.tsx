/**
 * SubscriberTokenManagementPanel (Sprint 14)
 *
 * Per-subscription panel embedded in
 * `PresentationGovernanceAlertSubscriptionsView` that renders the list of
 * dashboard tokens issued for a single subscription and lets an admin
 * revoke any active row.
 *
 * Behaviour:
 *   - Loads tokens on mount and after every refresh / revoke action.
 *   - Toggle "Show revoked" controls the `includeRevoked` query param.
 *   - Action column renders a `Revoke` button only on `active` rows
 *     (expired / revoked rows show `—` because the read path already
 *     treats both as 401).
 *   - Inline revoke flow asks for a required reason (5..500 chars) and
 *     a confirmation checkbox before firing the POST. The reason is
 *     persisted as `revoked_reason` server-side so the audit trail
 *     records WHY the token was killed.
 *   - `already_revoked` is treated as a non-error idempotent path: the
 *     row simply re-renders as revoked.
 *
 * SECURITY: this panel only ever displays the 8-char `tokenPrefix`. The
 * raw token / token_hash never reaches the client. The component never
 * logs the prefix or any other token field to the console.
 */

import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCcw,
  ShieldOff,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type ClientSubscriberTokenSummary,
  listDashboardTokens,
  revokeDashboardToken,
  type TokenFetchStatus,
  type TokenStatus,
} from '../../services/presentationSubscriberTokens';

const REASON_MIN = 5;
const REASON_MAX = 500;

const STATUS_PILL: Record<TokenStatus, string> = {
  active:
    'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-700',
  expired:
    'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-500/20 dark:text-slate-200 dark:border-slate-700',
  revoked:
    'bg-danger-100 text-danger-800 border-danger-300 dark:bg-danger-500/20 dark:text-danger-200 dark:border-danger-700',
};

const STATUS_LABEL: Record<TokenStatus, string> = {
  active: 'active',
  expired: 'expired',
  revoked: 'revoked',
};

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '—';
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return new Date(ts).toLocaleString();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}

function formatAbsolute(iso: string | null): string {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '—';
  return new Date(ts).toLocaleString();
}

function statusBanner(status: TokenFetchStatus | null): string | null {
  if (!status || status === 'ok') return null;
  if (status === 'forbidden') return 'Insufficient permission to manage dashboard tokens.';
  if (status === 'not_found') return 'Subscription not found.';
  if (status === 'unavailable') {
    return 'Dashboard token service is unavailable. The migration may not be applied yet.';
  }
  if (status === 'conflict') return 'Conflict — token state changed concurrently.';
  return 'Could not load dashboard tokens.';
}

interface RevokeFormState {
  tokenId: string;
  reason: string;
  confirmed: boolean;
  loading: boolean;
  outcome:
    | { kind: 'idle' }
    | { kind: 'success'; message: string }
    | { kind: 'error'; message: string };
}

interface SubscriberTokenManagementPanelProps {
  subscriptionId: string;
}

const SubscriberTokenManagementPanel: React.FC<SubscriberTokenManagementPanelProps> = ({
  subscriptionId,
}) => {
  const [tokens, setTokens] = useState<ClientSubscriberTokenSummary[]>([]);
  const [status, setStatus] = useState<TokenFetchStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [includeRevoked, setIncludeRevoked] = useState<boolean>(true);
  const [revokeForm, setRevokeForm] = useState<RevokeFormState | null>(null);

  const handleLoad = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listDashboardTokens(subscriptionId, { includeRevoked });
      setStatus(result.status);
      setTokens(result.status === 'ok' ? result.tokens || [] : []);
    } finally {
      setLoading(false);
    }
  }, [subscriptionId, includeRevoked]);

  useEffect(() => {
    void handleLoad();
  }, [handleLoad]);

  const banner = useMemo(() => statusBanner(status), [status]);

  const counts = useMemo(() => {
    let active = 0;
    let expired = 0;
    let revoked = 0;
    for (const t of tokens) {
      if (t.status === 'active') active += 1;
      else if (t.status === 'expired') expired += 1;
      else if (t.status === 'revoked') revoked += 1;
    }
    return { active, expired, revoked };
  }, [tokens]);

  const handleStartRevoke = useCallback((tokenId: string) => {
    setRevokeForm({
      tokenId,
      reason: '',
      confirmed: false,
      loading: false,
      outcome: { kind: 'idle' },
    });
  }, []);

  const handleCancelRevoke = useCallback(() => {
    setRevokeForm(null);
  }, []);

  const handleSubmitRevoke = useCallback(async () => {
    if (!revokeForm) return;
    const trimmed = revokeForm.reason.trim();
    if (trimmed.length < REASON_MIN || !revokeForm.confirmed) return;

    setRevokeForm((prev) => (prev ? { ...prev, loading: true, outcome: { kind: 'idle' } } : prev));

    const result = await revokeDashboardToken(
      subscriptionId,
      revokeForm.tokenId,
      revokeForm.reason
    );

    if (result.status === 'ok') {
      setRevokeForm((prev) =>
        prev
          ? {
              ...prev,
              loading: false,
              outcome: {
                kind: 'success',
                message:
                  'Token revoked. The subscriber will receive 401 on the next dashboard call.',
              },
            }
          : prev
      );
      await handleLoad();
      return;
    }

    if (result.status === 'conflict') {
      // 409 = already_revoked. Idempotent — refresh and surface a soft notice.
      setRevokeForm((prev) =>
        prev
          ? {
              ...prev,
              loading: false,
              outcome: {
                kind: 'success',
                message: 'Token was already revoked.',
              },
            }
          : prev
      );
      await handleLoad();
      return;
    }

    const message =
      result.status === 'forbidden'
        ? 'Insufficient permission to revoke this token.'
        : result.status === 'not_found'
          ? 'Token not found. It may have been deleted.'
          : result.status === 'unavailable'
            ? 'Token revocation service is unavailable.'
            : result.error || 'Revocation failed. Please retry.';

    setRevokeForm((prev) =>
      prev ? { ...prev, loading: false, outcome: { kind: 'error', message } } : prev
    );
  }, [revokeForm, subscriptionId, handleLoad]);

  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ShieldOff size={14} className="text-slate-500 dark:text-slate-400" />
          <div>
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Dashboard tokens
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px]">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-mono text-emerald-800 dark:border-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
                {counts.active} active
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 font-mono text-slate-700 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
                {counts.expired} expired
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-danger-300 bg-danger-50 px-2 py-0.5 font-mono text-danger-800 dark:border-danger-700 dark:bg-danger-500/10 dark:text-danger-200">
                {counts.revoked} revoked
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1 text-[11px] text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={includeRevoked}
              onChange={(e) => setIncludeRevoked(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Show revoked
          </label>
          <button
            type="button"
            onClick={() => void handleLoad()}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCcw size={11} />}
            Refresh
          </button>
        </div>
      </div>

      {banner && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
        >
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>{banner}</span>
        </div>
      )}

      {!banner && tokens.length === 0 && !loading && (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
          No dashboard tokens issued yet for this subscription.
        </div>
      )}

      {tokens.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
          <table
            /* §27-exempt: panel konfiguracyjny/billingowy, mala tabela ustawien poza zakresem listowym */ className="min-w-full divide-y divide-slate-200 text-[11px] dark:divide-slate-800"
          >
            <thead className="bg-slate-50 dark:bg-slate-900/60">
              <tr>
                <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Prefix
                </th>
                <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Issued at
                </th>
                <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Issued by
                </th>
                <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Expires
                </th>
                <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Last used
                </th>
                <th className="px-2 py-1.5 text-left font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Status
                </th>
                <th className="px-2 py-1.5 text-right font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {tokens.map((token) => {
                const revokeOpen = revokeForm?.tokenId === token.id;
                return (
                  <React.Fragment key={token.id}>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-2 py-1.5 font-mono text-slate-800 dark:text-slate-200">
                        {token.tokenPrefix.slice(0, 8)}…
                      </td>
                      <td className="px-2 py-1.5 text-slate-700 dark:text-slate-300">
                        <div title={formatAbsolute(token.issuedAt)}>
                          {formatRelative(token.issuedAt)}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 font-mono text-slate-700 dark:text-slate-300">
                        {token.issuedBy ?? '—'}
                      </td>
                      <td className="px-2 py-1.5 text-slate-700 dark:text-slate-300">
                        <div title={formatAbsolute(token.expiresAt)}>
                          {formatRelative(token.expiresAt)}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-slate-700 dark:text-slate-300">
                        {formatRelative(token.lastUsedAt)}
                      </td>
                      <td className="px-2 py-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            STATUS_PILL[token.status]
                          }`}
                        >
                          {token.status === 'revoked' && <Ban size={10} />}
                          {token.status === 'expired' && <Clock size={10} />}
                          {token.status === 'active' && <CheckCircle2 size={10} />}
                          {STATUS_LABEL[token.status]}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {token.status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => handleStartRevoke(token.id)}
                            disabled={revokeOpen}
                            className="inline-flex items-center gap-1 rounded-md border border-danger-200 bg-white px-2 py-0.5 font-medium text-danger-700 shadow-sm hover:bg-danger-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-danger-900 dark:bg-slate-900 dark:text-danger-300 dark:hover:bg-danger-900/20"
                          >
                            <Ban size={10} /> Revoke
                          </button>
                        ) : (
                          <span className="text-slate-600 dark:text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                    {revokeOpen && revokeForm && (
                      <tr className="bg-slate-50 dark:bg-slate-900/60">
                        <td colSpan={7} className="px-2 py-2">
                          <RevokePanel
                            state={revokeForm}
                            onChangeReason={(reason) =>
                              setRevokeForm((prev) => (prev ? { ...prev, reason } : prev))
                            }
                            onChangeConfirm={(confirmed) =>
                              setRevokeForm((prev) => (prev ? { ...prev, confirmed } : prev))
                            }
                            onSubmit={() => void handleSubmitRevoke()}
                            onCancel={handleCancelRevoke}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

interface RevokePanelProps {
  state: RevokeFormState;
  onChangeReason: (reason: string) => void;
  onChangeConfirm: (confirmed: boolean) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

const RevokePanel: React.FC<RevokePanelProps> = ({
  state,
  onChangeReason,
  onChangeConfirm,
  onSubmit,
  onCancel,
}) => {
  const trimmedLength = state.reason.trim().length;
  const reasonValid = trimmedLength >= REASON_MIN && trimmedLength <= REASON_MAX;
  const submittable = reasonValid && state.confirmed && !state.loading;
  const disabled = state.outcome.kind === 'success';

  return (
    <div className="space-y-2 rounded-md border border-danger-200 bg-white p-2 dark:border-danger-900 dark:bg-slate-900">
      <div className="flex items-start gap-2">
        <Ban size={12} className="mt-0.5 text-danger-600 dark:text-danger-400" />
        <div className="flex-1">
          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            Revoke dashboard token
          </div>
          <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
            Revocation is irreversible. The subscriber will receive 401 on the next dashboard call.
            Issue a fresh token via the issuance flow if continued access is needed.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          aria-label="Cancel"
        >
          <X size={12} />
        </button>
      </div>

      <div className="space-y-1">
        <label
          htmlFor={`revoke-reason-${state.tokenId}`}
          className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
        >
          Operator-facing reason ({REASON_MIN}–{REASON_MAX} chars)
        </label>
        <textarea
          id={`revoke-reason-${state.tokenId}`}
          value={state.reason}
          onChange={(e) => onChangeReason(e.target.value.slice(0, REASON_MAX))}
          rows={2}
          maxLength={REASON_MAX}
          disabled={disabled}
          placeholder="e.g. Subscriber rotated personnel; old token must be killed"
          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        />
        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
          <span>
            {trimmedLength < REASON_MIN
              ? `${REASON_MIN - trimmedLength} more char${REASON_MIN - trimmedLength === 1 ? '' : 's'} required`
              : 'OK'}
          </span>
          <span className="font-mono">
            {trimmedLength} / {REASON_MAX}
          </span>
        </div>
      </div>

      <label className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          checked={state.confirmed}
          onChange={(e) => onChangeConfirm(e.target.checked)}
          disabled={disabled}
          className="h-3.5 w-3.5 rounded border-slate-300 text-danger-600 focus:ring-danger-500"
        />
        Confirm revocation — this token will be permanently invalidated.
      </label>

      {state.outcome.kind === 'success' && (
        <div className="flex items-start gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
          <CheckCircle2 size={12} className="mt-0.5 shrink-0" />
          <span>{state.outcome.message}</span>
        </div>
      )}

      {state.outcome.kind === 'error' && (
        <div className="flex items-start gap-1.5 rounded border border-danger-200 bg-danger-50 px-2 py-1.5 text-[11px] text-danger-700 dark:border-danger-800 dark:bg-danger-900/30 dark:text-danger-300">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>{state.outcome.message}</span>
        </div>
      )}

      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Close
        </button>
        {state.outcome.kind !== 'success' && (
          <button
            type="button"
            onClick={onSubmit}
            disabled={!submittable}
            className="inline-flex items-center gap-1 rounded-md border border-danger-600 bg-danger-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-danger-700 focus:outline-none focus:ring-2 focus:ring-danger-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state.loading ? <Loader2 size={11} className="animate-spin" /> : <Ban size={11} />}
            Revoke token
          </button>
        )}
      </div>
    </div>
  );
};

export default SubscriberTokenManagementPanel;
