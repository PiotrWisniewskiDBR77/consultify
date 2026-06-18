/**
 * AlertPlaygroundTester (Sprint 12)
 *
 * Self-contained "Webhook Playground" surface that lets a brand-new alert
 * subscriber verify their HMAC verifier code without touching the real
 * subscription table or the dispatch audit trail.
 *
 * Step 1 — `Generate signed dispatch`
 *   Calls `/api/presentations/governance/alerts/playground/dispatch`. The
 *   server returns the canonical request bytes (headers, body JSON,
 *   canonical signing string, hex signature) plus the signing secret
 *   ONCE so the operator can copy it into their subscriber app.
 *
 * Step 2 — `Verify inbox`
 *   Calls `/api/presentations/governance/alerts/playground/inbox` with the
 *   plan from step 1. Provides a `Tamper` toggle (mutates the last hex
 *   char of the signature) and an `Algorithm override` dropdown so the
 *   operator can prove that `invalid_signature` and `missing_headers`
 *   error paths trigger as documented.
 *
 * SECURITY: the playground secret is held in component state only. We
 *   - never persist it to localStorage or any other storage,
 *   - clear it from state automatically after 60 seconds,
 *   - mask it by default in the reveal panel,
 *   - require the "I have copied this" checkbox before unlocking step 2.
 */

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  RotateCcw,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type ClientPlaygroundDispatchPlan,
  type ClientPlaygroundInboxResult,
  generatePlaygroundDispatch,
  type PlaygroundFetchStatus,
  type PlaygroundSeverity,
  verifyPlaygroundInbox,
} from '../../services/presentationAlertPlayground';

// 60-second auto-clear matches the secret-reveal contract used by the
// rotate-secret panel — once the timer fires we drop the secret from
// memory entirely so it cannot be re-rendered later.
const SECRET_AUTO_CLEAR_MS = 60_000;

const VERIFIER_DOCS_HREF = '/docs/operations/PRESENTATION_GOVERNANCE_ALERTS.md#hmac-signing';

type AlgorithmOverride = 'HMAC-SHA256' | 'HMAC-SHA1' | 'BLANK';

interface DispatchUiState {
  loading: boolean;
  plan: ClientPlaygroundDispatchPlan | null;
  status: PlaygroundFetchStatus | null;
  errorMessage: string | null;
  acknowledged: boolean;
}

interface InboxUiState {
  loading: boolean;
  result: ClientPlaygroundInboxResult | null;
  fetchStatus: PlaygroundFetchStatus | null;
  errorMessage: string | null;
  tamper: boolean;
  algorithmOverride: AlgorithmOverride;
}

const DEFAULT_DISPATCH_STATE: DispatchUiState = {
  loading: false,
  plan: null,
  status: null,
  errorMessage: null,
  acknowledged: false,
};

const DEFAULT_INBOX_STATE: InboxUiState = {
  loading: false,
  result: null,
  fetchStatus: null,
  errorMessage: null,
  tamper: false,
  algorithmOverride: 'HMAC-SHA256',
};

function tamperSignature(signature: string): string {
  if (!signature) return signature;
  // Replace the last hex char with `'0'` (or `'1'` if already `'0'`) so
  // the resulting hex string is the same length but no longer matches.
  const last = signature.slice(-1);
  return signature.slice(0, -1) + (last === '0' ? '1' : '0');
}

function fetchStatusReason(status: PlaygroundFetchStatus | null): string | null {
  if (!status || status === 'ok') return null;
  if (status === 'forbidden') {
    return 'Insufficient permission. Webhook playground requires presentation_edit.';
  }
  if (status === 'unavailable') {
    return 'Playground endpoint is unavailable. The backend may be offline.';
  }
  return 'Playground request failed. Please retry.';
}

interface AlertPlaygroundTesterProps {
  className?: string;
}

const AlertPlaygroundTester: React.FC<AlertPlaygroundTesterProps> = ({ className }) => {
  const [dispatchState, setDispatchState] = useState<DispatchUiState>(DEFAULT_DISPATCH_STATE);
  const [inboxState, setInboxState] = useState<InboxUiState>(DEFAULT_INBOX_STATE);
  const [secretVisible, setSecretVisible] = useState<boolean>(false);
  const [headersOpen, setHeadersOpen] = useState<boolean>(false);

  // Inputs (step 1)
  const [verdict, setVerdict] = useState<PlaygroundSeverity>('BLOCKED_P0');
  const [deckId, setDeckId] = useState<string>('');
  const [autoSecret, setAutoSecret] = useState<boolean>(true);
  const [providedSecret, setProvidedSecret] = useState<string>('');

  // Auto-clear the playground secret 60s after generation. Once the
  // timer fires we wipe both `plan.signingSecret` and the user-typed
  // `providedSecret` so the operator cannot accidentally re-use them.
  useEffect(() => {
    if (!dispatchState.plan?.signingSecret) return;
    if (typeof window === 'undefined') return;
    const id = window.setTimeout(() => {
      setDispatchState((prev) => {
        if (!prev.plan) return prev;
        return {
          ...prev,
          plan: { ...prev.plan, signingSecret: '' },
        };
      });
      setProvidedSecret('');
      setSecretVisible(false);
    }, SECRET_AUTO_CLEAR_MS);
    return () => window.clearTimeout(id);
  }, [dispatchState.plan?.signingSecret]);

  const handleGenerate = useCallback(async () => {
    setDispatchState((prev) => ({ ...prev, loading: true, errorMessage: null, status: null }));
    setInboxState(DEFAULT_INBOX_STATE);
    const result = await generatePlaygroundDispatch({
      syntheticVerdict: verdict,
      syntheticDeckId: deckId.trim() || undefined,
      signingSecret: !autoSecret && providedSecret ? providedSecret : undefined,
    });
    setDispatchState({
      loading: false,
      plan: result.data ?? null,
      status: result.status,
      errorMessage:
        result.status !== 'ok' ? result.error || fetchStatusReason(result.status) : null,
      acknowledged: false,
    });
    setSecretVisible(false);
  }, [verdict, deckId, autoSecret, providedSecret]);

  const handleVerify = useCallback(async () => {
    if (!dispatchState.plan) return;
    const plan = dispatchState.plan;
    const signature = inboxState.tamper ? tamperSignature(plan.signature) : plan.signature;
    const algorithm =
      inboxState.algorithmOverride === 'BLANK' ? undefined : inboxState.algorithmOverride;
    setInboxState((prev) => ({ ...prev, loading: true, errorMessage: null, fetchStatus: null }));
    const result = await verifyPlaygroundInbox({
      bodyJson: plan.bodyJson,
      signature,
      signatureAlgorithm: algorithm,
      timestamp: plan.generatedAt,
      eventId: plan.eventId,
      signingSecret: plan.signingSecret,
    });
    setInboxState((prev) => ({
      ...prev,
      loading: false,
      result: result.data ?? null,
      fetchStatus: result.status,
      errorMessage:
        result.status !== 'ok' ? result.error || fetchStatusReason(result.status) : null,
    }));
  }, [dispatchState.plan, inboxState.tamper, inboxState.algorithmOverride]);

  const handleReset = useCallback(() => {
    setDispatchState(DEFAULT_DISPATCH_STATE);
    setInboxState(DEFAULT_INBOX_STATE);
    setSecretVisible(false);
    setHeadersOpen(false);
    setProvidedSecret('');
    setDeckId('');
    setVerdict('BLOCKED_P0');
    setAutoSecret(true);
  }, []);

  const handleOpenDocs = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const w = window.open(VERIFIER_DOCS_HREF, '_blank', 'noopener,noreferrer');
      if (!w) {
        window.alert(
          'Verifier code samples live in docs/operations/PRESENTATION_GOVERNANCE_ALERTS.md (#hmac-signing)'
        );
      }
    } catch {
      window.alert(
        'Verifier code samples live in docs/operations/PRESENTATION_GOVERNANCE_ALERTS.md (#hmac-signing)'
      );
    }
  }, []);

  const step1FetchReason = useMemo(
    () => fetchStatusReason(dispatchState.status),
    [dispatchState.status]
  );
  const step2FetchReason = useMemo(
    () => fetchStatusReason(inboxState.fetchStatus),
    [inboxState.fetchStatus]
  );

  const verifyDisabled =
    !dispatchState.plan ||
    dispatchState.plan.signingSecret.length === 0 ||
    !dispatchState.acknowledged ||
    inboxState.loading;

  return (
    <div
      className={`space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className ?? ''}`}
    >
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <ShieldCheck size={14} className="text-indigo-600 dark:text-indigo-400" />
            Webhook Playground
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Verify your HMAC verifier without affecting real subscriptions or audit trail.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleOpenDocs}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ExternalLink size={11} /> Open verifier code samples
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RotateCcw size={11} /> Reset
          </button>
        </div>
      </header>

      {/* ============================== STEP 1 ============================== */}
      <section className="rounded-md border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-semibold text-white">
            1
          </span>
          <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            Generate signed dispatch
          </h4>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Severity
            <select
              value={verdict}
              onChange={(e) => setVerdict(e.target.value as PlaygroundSeverity)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-normal capitalize text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="BLOCKED_P0">BLOCKED_P0</option>
              <option value="BLOCKED_P1">BLOCKED_P1</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Deck id (optional)
            <input
              type="text"
              value={deckId}
              onChange={(e) => setDeckId(e.target.value.slice(0, 128))}
              placeholder="playground_deck"
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-normal text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </label>

          <div className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Signing secret
            <label className="flex items-center gap-1.5 text-[11px] font-normal normal-case text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={autoSecret}
                onChange={(e) => setAutoSecret(e.target.checked)}
                className="h-3 w-3 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Autogenerate
            </label>
            {!autoSecret && (
              <input
                type="text"
                value={providedSecret}
                onChange={(e) => setProvidedSecret(e.target.value.trim())}
                placeholder="64 hex chars"
                className="rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] font-normal text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={dispatchState.loading}
            className="inline-flex items-center gap-1 rounded-md border border-indigo-600 bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {dispatchState.loading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Send size={12} />
            )}
            Generate signed dispatch
          </button>
          {dispatchState.plan && (
            <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
              Plan ready — see fields below.
            </span>
          )}
        </div>

        {dispatchState.errorMessage && (
          <div className="mt-2 rounded border border-danger-200 bg-danger-50 px-2 py-1.5 text-[11px] text-danger-700 dark:border-danger-800 dark:bg-danger-900/30 dark:text-danger-300">
            {step1FetchReason || dispatchState.errorMessage}
          </div>
        )}

        {dispatchState.plan && (
          <DispatchPlanPanel
            plan={dispatchState.plan}
            secretVisible={secretVisible}
            onToggleSecretVisibility={() => setSecretVisible((v) => !v)}
            headersOpen={headersOpen}
            onToggleHeaders={() => setHeadersOpen((v) => !v)}
            acknowledged={dispatchState.acknowledged}
            onAcknowledge={(ack) => setDispatchState((prev) => ({ ...prev, acknowledged: ack }))}
          />
        )}
      </section>

      {/* ============================== STEP 2 ============================== */}
      <section
        className={`rounded-md border p-3 ${
          dispatchState.plan
            ? 'border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40'
            : 'border-dashed border-slate-300 bg-slate-50/30 opacity-70 dark:border-slate-700 dark:bg-slate-900/20'
        }`}
      >
        <div className="mb-2 flex items-center gap-2">
          <span
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white ${
              dispatchState.plan ? 'bg-indigo-600' : 'bg-slate-400'
            }`}
          >
            2
          </span>
          <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100">Verify inbox</h4>
        </div>

        {!dispatchState.plan ? (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Run step 1 first to populate the inbox request.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Algorithm override
                <select
                  value={inboxState.algorithmOverride}
                  onChange={(e) =>
                    setInboxState((prev) => ({
                      ...prev,
                      algorithmOverride: e.target.value as AlgorithmOverride,
                    }))
                  }
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-normal text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="HMAC-SHA256">HMAC-SHA256 (default)</option>
                  <option value="HMAC-SHA1">HMAC-SHA1 (rejected)</option>
                  <option value="BLANK">(blank)</option>
                </select>
              </label>

              <label className="flex items-center gap-2 self-end pb-1 text-[11px] text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={inboxState.tamper}
                  onChange={(e) => setInboxState((prev) => ({ ...prev, tamper: e.target.checked }))}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Tamper signature (last hex char)
              </label>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleVerify()}
                disabled={verifyDisabled}
                className="inline-flex items-center gap-1 rounded-md border border-indigo-600 bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {inboxState.loading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <ShieldCheck size={12} />
                )}
                Verify inbox
              </button>
              {!dispatchState.acknowledged && dispatchState.plan.signingSecret && (
                <span className="text-[11px] text-amber-700 dark:text-amber-300">
                  Acknowledge the secret reveal in step 1 first.
                </span>
              )}
              {dispatchState.plan.signingSecret.length === 0 && (
                <span className="text-[11px] text-amber-700 dark:text-amber-300">
                  Secret expired (60s) — generate a new dispatch.
                </span>
              )}
            </div>

            {inboxState.errorMessage && (
              <div className="mt-2 rounded border border-danger-200 bg-danger-50 px-2 py-1.5 text-[11px] text-danger-700 dark:border-danger-800 dark:bg-danger-900/30 dark:text-danger-300">
                {step2FetchReason || inboxState.errorMessage}
              </div>
            )}

            {inboxState.result && <InboxResultBanner result={inboxState.result} />}
          </>
        )}
      </section>
    </div>
  );
};

// ============================================================================
// DISPATCH PLAN PANEL
// ============================================================================

interface DispatchPlanPanelProps {
  plan: ClientPlaygroundDispatchPlan;
  secretVisible: boolean;
  onToggleSecretVisibility: () => void;
  headersOpen: boolean;
  onToggleHeaders: () => void;
  acknowledged: boolean;
  onAcknowledge: (ack: boolean) => void;
}

const DispatchPlanPanel: React.FC<DispatchPlanPanelProps> = ({
  plan,
  secretVisible,
  onToggleSecretVisibility,
  headersOpen,
  onToggleHeaders,
  acknowledged,
  onAcknowledge,
}) => {
  return (
    <div className="mt-3 space-y-3">
      <CopyableField label="Body JSON" value={plan.bodyJson} previewLines={6} mono />

      <div className="rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <button
          type="button"
          onClick={onToggleHeaders}
          className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <span className="inline-flex items-center gap-1">
            {headersOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            Headers ({Object.keys(plan.headers).length})
          </span>
          <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
            collapsed by default
          </span>
        </button>
        {headersOpen && (
          <div className="space-y-1 border-t border-slate-200 px-2 py-2 dark:border-slate-800">
            {Object.entries(plan.headers).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <code className="min-w-[14ch] font-mono text-[10px] text-slate-500 dark:text-slate-400">
                  {k}:
                </code>
                <code className="flex-1 select-all break-all font-mono text-[10px] text-slate-800 dark:text-slate-200">
                  {v}
                </code>
                <CopyButton value={v} ariaLabel={`Copy ${k}`} />
              </div>
            ))}
          </div>
        )}
      </div>

      <CopyableField label="Canonical signing string" value={plan.canonicalString} mono />

      <CopyableField label="Signature (HMAC-SHA256 hex)" value={plan.signature} mono />

      {/* One-time secret reveal */}
      <div className="rounded-md border border-amber-300 bg-amber-50 p-2 dark:border-amber-800 dark:bg-amber-900/20">
        <div className="flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" />
          <div className="flex-1">
            <div className="text-[11px] font-semibold text-amber-900 dark:text-amber-100">
              Signing secret (one-time reveal)
            </div>
            <p className="mt-0.5 text-[10px] text-amber-800 dark:text-amber-200">
              This secret is also fed back into step 2 so you can prove the loop closes. The reveal
              panel auto-clears in 60 seconds.
            </p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <code className="flex-1 select-all break-all rounded border border-amber-200 bg-white px-2 py-1 font-mono text-[11px] text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            {plan.signingSecret.length === 0
              ? '(secret cleared — generate a new dispatch)'
              : secretVisible
                ? plan.signingSecret
                : plan.signingSecret.replace(/./g, '•')}
          </code>
          <button
            type="button"
            onClick={onToggleSecretVisibility}
            disabled={plan.signingSecret.length === 0}
            className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-[10px] font-medium text-amber-800 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-900/40"
          >
            {secretVisible ? <EyeOff size={10} /> : <Eye size={10} />}
            {secretVisible ? 'Hide' : 'Show'}
          </button>
          <CopyButton value={plan.signingSecret} ariaLabel="Copy signing secret" />
        </div>
        <label className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-900 dark:text-amber-100">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => onAcknowledge(e.target.checked)}
            disabled={plan.signingSecret.length === 0}
            className="h-3 w-3 rounded border-amber-400 text-amber-600 focus:ring-amber-500 disabled:cursor-not-allowed"
          />
          I&apos;ve copied this secret. Continue to step 2.
        </label>
      </div>
    </div>
  );
};

// ============================================================================
// INBOX RESULT BANNER
// ============================================================================

interface InboxResultBannerProps {
  result: ClientPlaygroundInboxResult;
}

const InboxResultBanner: React.FC<InboxResultBannerProps> = ({ result }) => {
  const isVerified = result.status === 'verified';
  const isAmber =
    result.status === 'unsigned' ||
    result.status === 'missing_headers' ||
    result.status === 'parse_error';
  const tone = isVerified
    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-100'
    : isAmber
      ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100'
      : 'border-danger-300 bg-danger-50 text-danger-900 dark:border-danger-700 dark:bg-danger-900/20 dark:text-danger-100';
  const Icon = isVerified ? CheckCircle2 : isAmber ? AlertTriangle : XCircle;
  const headline = isVerified
    ? 'Signature verified — your verifier code can use the same approach.'
    : result.reason || 'Verification failed.';
  return (
    <div className={`mt-2 flex items-start gap-2 rounded-md border px-3 py-2 text-[11px] ${tone}`}>
      <Icon size={14} className="mt-0.5 shrink-0" />
      <div className="flex-1 space-y-1">
        <div className="font-semibold">
          {result.status.toUpperCase()} — {headline}
        </div>
        {result.payloadPreview && (
          <div className="font-mono opacity-80">
            payload: eventId={result.payloadPreview.eventId || '(none in body)'} · toVerdict=
            {result.payloadPreview.toVerdict || '—'} · deckId={result.payloadPreview.deckId || '—'}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// COPYABLE FIELD
// ============================================================================

interface CopyableFieldProps {
  label: string;
  value: string;
  mono?: boolean;
  previewLines?: number;
}

const CopyableField: React.FC<CopyableFieldProps> = ({ label, value, mono, previewLines }) => {
  const lineClamp = previewLines ? `line-clamp-${previewLines}` : '';
  return (
    <div className="rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-2 py-1 dark:border-slate-800">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <CopyButton value={value} ariaLabel={`Copy ${label}`} />
      </div>
      <pre
        className={`max-h-40 overflow-auto px-2 py-1.5 text-[10px] text-slate-800 dark:text-slate-200 ${
          mono ? 'font-mono' : ''
        } ${lineClamp}`}
      >
        {value}
      </pre>
    </div>
  );
};

// ============================================================================
// COPY BUTTON
// ============================================================================

interface CopyButtonProps {
  value: string;
  ariaLabel: string;
}

const CopyButton: React.FC<CopyButtonProps> = ({ value, ariaLabel }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const handleCopy = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // best-effort
    }
  }, [value]);
  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      <Copy size={10} />
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
};

export default AlertPlaygroundTester;
