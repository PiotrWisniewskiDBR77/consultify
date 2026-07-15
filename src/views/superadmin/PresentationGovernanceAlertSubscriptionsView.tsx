/**
 * PresentationGovernanceAlertSubscriptionsView (Sprint 11)
 *
 * SuperAdmin surface for the subscriber-onboarding flow that backs the
 * Governance Alert webhook pipeline. Provides:
 *
 *   1. List of active subscriptions with their channel, redacted target,
 *      minimum severity, and last-dispatch metadata.
 *   2. A short wizard for creating a new subscription (channel → target →
 *      min severity → review). On success, surfaces a "generate signing
 *      secret next?" prompt that calls the rotate-secret endpoint and
 *      reveals the secret ONCE in a copyable code block.
 *   3. Per-row `Rotate secret` action — inline confirmation with a required
 *      acknowledgment checkbox. The reveal panel auto-closes after 60s.
 *   4. Per-row `Test delivery` action — inline verdict picker, fires a
 *      synthetic signed POST so the subscriber can verify their HMAC
 *      pipeline. Result is colour-coded by `status` and shows the
 *      signature preview, payload preview, http status, and duration.
 *
 * SECURITY: the raw signing secret is NEVER displayed in any list/row
 * payload. It is shown ONLY in the rotate-response panel, only once per
 * rotate, and the panel auto-closes after 60s. Aligns with the
 * server-side rule that `signing_secret` only leaves the database via
 * the rotate-secret endpoint.
 */

import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Plus,
  RefreshCcw,
  Send,
  ShieldOff,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import AlertPlaygroundTester from '../../components/SuperAdmin/AlertPlaygroundTester';
import SubscriberTokenManagementPanel from '../../components/SuperAdmin/SubscriberTokenManagementPanel';
import {
  type AlertChannel,
  type AlertSeverity,
  type ClientSubscription,
  createAlertSubscription,
  deleteAlertSubscription,
  listAlertSubscriptions,
  rotateAlertSubscriptionSecret,
  sendAlertSubscriptionTestDelivery,
  type SubscriptionFetchStatus,
  type TestDeliveryResult,
  type TestDeliveryStatus,
} from '../../services/presentationGovernanceAlertSubscriptions';

const SECRET_REVEAL_AUTO_HIDE_MS = 60_000;

const TEST_STATUS_TONE: Record<TestDeliveryStatus, string> = {
  ok: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-700',
  unsigned:
    'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-700',
  http_error:
    'bg-danger-100 text-danger-800 border-danger-300 dark:bg-danger-500/20 dark:text-danger-200 dark:border-danger-700',
  network_error:
    'bg-danger-100 text-danger-800 border-danger-300 dark:bg-danger-500/20 dark:text-danger-200 dark:border-danger-700',
  fetch_unavailable:
    'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-500/20 dark:text-slate-200 dark:border-slate-700',
  inactive:
    'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-500/20 dark:text-slate-200 dark:border-slate-700',
  not_found:
    'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-500/20 dark:text-slate-200 dark:border-slate-700',
};

const TEST_STATUS_LABEL: Record<TestDeliveryStatus, string> = {
  ok: 'Delivered',
  unsigned: 'Unsigned (no secret yet)',
  http_error: 'HTTP error',
  network_error: 'Network error',
  fetch_unavailable: 'Fetch unavailable',
  inactive: 'Inactive',
  not_found: 'Not found',
};

const CHANNEL_LABEL: Record<AlertChannel, string> = {
  webhook: 'Webhook',
  email: 'Email',
  slack: 'Slack',
};

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  BLOCKED_P0: 'BLOCKED_P0',
  BLOCKED_P1: 'BLOCKED_P1',
};

function formatRelativeTime(iso: string | null): string {
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

function statusReason(status: SubscriptionFetchStatus | null): string | null {
  if (!status || status === 'ok') return null;
  if (status === 'forbidden') {
    return 'Insufficient permission to manage governance alert subscriptions.';
  }
  if (status === 'not_found') {
    return 'Alert subscriptions endpoint not found. The backend may need to be redeployed.';
  }
  if (status === 'unavailable') {
    return 'Alert subscriptions service is unavailable. The backend may be offline.';
  }
  if (status === 'conflict') {
    return 'Conflict — the request was rejected by the server.';
  }
  return 'Could not load alert subscriptions.';
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validateTarget(channel: AlertChannel, target: string): string | null {
  const trimmed = target.trim();
  if (!trimmed) return 'Target is required.';
  if (channel === 'email') {
    if (!looksLikeEmail(trimmed)) return 'Enter a valid email address.';
  } else if (!looksLikeUrl(trimmed)) {
    return 'Enter an https:// URL for the webhook/Slack endpoint.';
  }
  return null;
}

interface RotateRowState {
  subscriptionId: string;
  acknowledged: boolean;
  loading: boolean;
  oneTimeSecret: string | null;
  visible: boolean;
  rotatedAt: number | null;
  error: string | null;
}

interface TestRowState {
  subscriptionId: string;
  verdict: AlertSeverity;
  loading: boolean;
  result: TestDeliveryResult | null;
  error: string | null;
}

const PresentationGovernanceAlertSubscriptionsView: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<ClientSubscription[]>([]);
  const [status, setStatus] = useState<SubscriptionFetchStatus | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasAttempted, setHasAttempted] = useState<boolean>(false);

  const [wizardOpen, setWizardOpen] = useState<boolean>(false);
  const [rotateState, setRotateState] = useState<RotateRowState | null>(null);
  const [testState, setTestState] = useState<TestRowState | null>(null);
  const [deletePending, setDeletePending] = useState<string | null>(null);
  const [playgroundOpen, setPlaygroundOpen] = useState<boolean>(false);
  const [tokensOpenId, setTokensOpenId] = useState<string | null>(null);

  const handleLoad = useCallback(async () => {
    setLoading(true);
    setHasAttempted(true);
    try {
      const result = await listAlertSubscriptions();
      setStatus(result.status);
      setWarnings(result.warnings || []);
      if (result.status === 'ok') {
        setSubscriptions(result.subscriptions);
      } else {
        setSubscriptions([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void handleLoad();
  }, [handleLoad]);

  // Auto-hide a revealed secret after 60s. The new-secret value is held in
  // local state only; once the timer fires we drop it from memory entirely
  // so it cannot be re-rendered later.
  useEffect(() => {
    if (!rotateState?.visible || !rotateState.oneTimeSecret) return;
    if (typeof window === 'undefined') return;
    const id = window.setTimeout(() => {
      setRotateState((prev) =>
        prev && prev.subscriptionId === rotateState.subscriptionId
          ? { ...prev, visible: false, oneTimeSecret: null }
          : prev
      );
    }, SECRET_REVEAL_AUTO_HIDE_MS);
    return () => window.clearTimeout(id);
  }, [rotateState?.visible, rotateState?.oneTimeSecret, rotateState?.subscriptionId]);

  const reasonBanner = useMemo(() => statusReason(status), [status]);

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletePending(id);
      try {
        const result = await deleteAlertSubscription(id);
        if (result.status === 'ok') {
          await handleLoad();
        }
      } finally {
        setDeletePending(null);
      }
    },
    [handleLoad]
  );

  const handleRotate = useCallback(async (id: string) => {
    setRotateState((prev) =>
      prev && prev.subscriptionId === id ? { ...prev, loading: true, error: null } : prev
    );
    const result = await rotateAlertSubscriptionSecret(id);
    setRotateState((prev) => {
      if (!prev || prev.subscriptionId !== id) return prev;
      if (result.status === 'ok' && result.oneTimeSecret) {
        return {
          ...prev,
          loading: false,
          oneTimeSecret: result.oneTimeSecret,
          visible: true,
          rotatedAt: Date.now(),
          error: null,
        };
      }
      return {
        ...prev,
        loading: false,
        error:
          result.status === 'conflict'
            ? 'Subscription is inactive — re-create it before rotating.'
            : result.status === 'forbidden'
              ? 'Insufficient permission to rotate this secret.'
              : result.status === 'not_found'
                ? 'Subscription not found.'
                : 'Rotation failed. Please retry.',
      };
    });
  }, []);

  const handleSendTest = useCallback(async (id: string, verdict: AlertSeverity) => {
    setTestState((prev) =>
      prev && prev.subscriptionId === id
        ? { ...prev, loading: true, result: null, error: null }
        : prev
    );
    const result = await sendAlertSubscriptionTestDelivery(id, {
      syntheticVerdict: verdict,
    });
    setTestState((prev) => {
      if (!prev || prev.subscriptionId !== id) return prev;
      if (result.status === 'ok' && result.data) {
        return { ...prev, loading: false, result: result.data, error: null };
      }
      return {
        ...prev,
        loading: false,
        result: null,
        error:
          result.status === 'forbidden'
            ? 'Insufficient permission to fire a test delivery.'
            : result.status === 'not_found'
              ? 'Subscription not found.'
              : 'Test delivery failed. Please retry.',
      };
    });
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Governance Alert Subscriptions
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Configure webhook/Slack/email targets that receive{' '}
            <code className="font-mono text-[11px] text-danger-700 dark:text-danger-300">
              BLOCKED_P0
            </code>{' '}
            /{' '}
            <code className="font-mono text-[11px] text-orange-700 dark:text-orange-300">
              BLOCKED_P1
            </code>{' '}
            transitions.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-indigo-600 bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <Plus size={12} /> New subscription
          </button>
          <button
            type="button"
            onClick={() => void handleLoad()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
            Reload
          </button>
        </div>
      </header>

      {warnings.length > 0 && <WarningsPanel warnings={warnings} />}

      {reasonBanner && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Alert subscriptions unavailable</div>
            <div className="mt-1 text-xs opacity-80">{reasonBanner}</div>
          </div>
        </div>
      )}

      {!reasonBanner && (
        <SubscriptionsTable
          subscriptions={subscriptions}
          loading={loading}
          hasAttempted={hasAttempted}
          rotateState={rotateState}
          testState={testState}
          deletePending={deletePending}
          tokensOpenId={tokensOpenId}
          onStartRotate={(id) =>
            setRotateState({
              subscriptionId: id,
              acknowledged: false,
              loading: false,
              oneTimeSecret: null,
              visible: false,
              rotatedAt: null,
              error: null,
            })
          }
          onCancelRotate={() => setRotateState(null)}
          onAcknowledgeRotate={(ack) =>
            setRotateState((prev) => (prev ? { ...prev, acknowledged: ack } : prev))
          }
          onConfirmRotate={(id) => void handleRotate(id)}
          onToggleSecretVisibility={() =>
            setRotateState((prev) => (prev ? { ...prev, visible: !prev.visible } : prev))
          }
          onStartTest={(id) =>
            setTestState({
              subscriptionId: id,
              verdict: 'BLOCKED_P0',
              loading: false,
              result: null,
              error: null,
            })
          }
          onCancelTest={() => setTestState(null)}
          onChangeTestVerdict={(verdict) =>
            setTestState((prev) => (prev ? { ...prev, verdict } : prev))
          }
          onSendTest={(id, verdict) => void handleSendTest(id, verdict)}
          onDelete={(id) => void handleDelete(id)}
          onToggleTokens={(id) => setTokensOpenId((prev) => (prev === id ? null : id))}
        />
      )}

      {wizardOpen && (
        <NewSubscriptionWizard
          onClose={() => setWizardOpen(false)}
          onCreated={async () => {
            setWizardOpen(false);
            await handleLoad();
          }}
        />
      )}

      {/* Sprint 12: Webhook Playground (collapsible, closed by default). */}
      <details
        className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
        open={playgroundOpen}
        onToggle={(e) => setPlaygroundOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800/40">
          <span className="inline-flex items-center gap-2">
            {playgroundOpen ? (
              <ChevronDown size={14} className="text-slate-500" />
            ) : (
              <ChevronRight size={14} className="text-slate-500" />
            )}
            Webhook Playground (advanced)
          </span>
          <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
            Verify your HMAC verifier without affecting subscriptions or audit trail
          </span>
        </summary>
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <AlertPlaygroundTester />
        </div>
      </details>
    </div>
  );
};

interface WarningsPanelProps {
  warnings: string[];
}

const WarningsPanel: React.FC<WarningsPanelProps> = ({ warnings }) => (
  <div
    role="status"
    className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
  >
    <AlertCircle size={14} className="mt-0.5 shrink-0" />
    <div>
      <div className="font-semibold">Some inputs were degraded</div>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 opacity-80">
        {warnings.slice(0, 6).map((w) => (
          <li key={w} className="font-mono">
            {w}
          </li>
        ))}
        {warnings.length > 6 && <li className="opacity-70">… and {warnings.length - 6} more</li>}
      </ul>
    </div>
  </div>
);

interface SubscriptionsTableProps {
  subscriptions: ClientSubscription[];
  loading: boolean;
  hasAttempted: boolean;
  rotateState: RotateRowState | null;
  testState: TestRowState | null;
  deletePending: string | null;
  tokensOpenId: string | null;
  onStartRotate: (id: string) => void;
  onCancelRotate: () => void;
  onAcknowledgeRotate: (ack: boolean) => void;
  onConfirmRotate: (id: string) => void;
  onToggleSecretVisibility: () => void;
  onStartTest: (id: string) => void;
  onCancelTest: () => void;
  onChangeTestVerdict: (verdict: AlertSeverity) => void;
  onSendTest: (id: string, verdict: AlertSeverity) => void;
  onDelete: (id: string) => void;
  onToggleTokens: (id: string) => void;
}

const SubscriptionsTable: React.FC<SubscriptionsTableProps> = ({
  subscriptions,
  loading,
  hasAttempted,
  rotateState,
  testState,
  deletePending,
  tokensOpenId,
  onStartRotate,
  onCancelRotate,
  onAcknowledgeRotate,
  onConfirmRotate,
  onToggleSecretVisibility,
  onStartTest,
  onCancelTest,
  onChangeTestVerdict,
  onSendTest,
  onDelete,
  onToggleTokens,
}) => {
  if (loading && subscriptions.length === 0 && !hasAttempted) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <Loader2 size={16} className="animate-spin text-indigo-500" />
        Loading subscriptions…
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
        No alert subscriptions yet. Click <span className="font-semibold">New subscription</span> to
        create one.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <table
        /* §27-exempt: lista encji z per-row expansion panels (Rotate/Test/Tokens jako <tr colSpan=7>) — StandardTable/FilterableTable nie wspiera wierszy-paneli; migracja 1:1 niemozliwa bez redesignu flow rotacji sekretu (panel→preview/modal), wymaga pelnej przebudowy — deferred m27-canon-rest 07-15 */ className="min-w-full divide-y divide-slate-200 dark:divide-slate-800"
      >
        <thead className="bg-slate-50 dark:bg-slate-900/60">
          <tr>
            <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Target
            </th>
            <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Channel
            </th>
            <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Min severity
            </th>
            <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Active
            </th>
            <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Last rotated
            </th>
            <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Last dispatch
            </th>
            <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {subscriptions.map((sub) => {
            const rotateOpen = rotateState?.subscriptionId === sub.id;
            const testOpen = testState?.subscriptionId === sub.id;
            const tokensOpen = tokensOpenId === sub.id;
            return (
              <React.Fragment key={sub.id}>
                <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2 font-mono text-xs text-slate-800 dark:text-slate-200">
                    {sub.targetRedacted}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-700 dark:text-slate-300">
                    {CHANNEL_LABEL[sub.channel]}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        sub.minSeverity === 'BLOCKED_P0'
                          ? 'bg-danger-100 text-danger-700 dark:bg-danger-500/20 dark:text-danger-300'
                          : 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
                      }`}
                    >
                      {SEVERITY_LABEL[sub.minSeverity]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-700 dark:text-slate-300">
                    {sub.active ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                        <Check size={12} /> Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <X size={12} /> No
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-700 dark:text-slate-300">
                    {formatRelativeTime(sub.signingSecretRotatedAt)}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-700 dark:text-slate-300">
                    <div>{formatRelativeTime(sub.lastDispatchAt)}</div>
                    {sub.lastDispatchStatus && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {sub.lastDispatchStatus}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onStartRotate(sub.id)}
                        disabled={rotateOpen}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Key size={11} /> Rotate secret
                      </button>
                      <button
                        type="button"
                        onClick={() => onStartTest(sub.id)}
                        disabled={testOpen}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <Send size={11} /> Test delivery
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleTokens(sub.id)}
                        aria-expanded={tokensOpen}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        {tokensOpen ? (
                          <ChevronDown size={11} className="text-slate-500" />
                        ) : (
                          <ChevronRight size={11} className="text-slate-500" />
                        )}
                        <ShieldOff size={11} /> Tokens
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(sub.id)}
                        disabled={deletePending === sub.id}
                        className="inline-flex items-center gap-1 rounded-md border border-danger-200 bg-white px-2 py-1 text-[11px] font-medium text-danger-700 shadow-sm hover:bg-danger-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-danger-900 dark:bg-slate-900 dark:text-danger-300 dark:hover:bg-danger-900/20"
                      >
                        {deletePending === sub.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Trash2 size={11} />
                        )}
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                {rotateOpen && rotateState && (
                  <tr className="bg-slate-50 dark:bg-slate-900/60">
                    <td colSpan={7} className="px-4 py-3">
                      <RotatePanel
                        state={rotateState}
                        onCancel={onCancelRotate}
                        onAcknowledge={onAcknowledgeRotate}
                        onConfirm={onConfirmRotate}
                        onToggleVisibility={onToggleSecretVisibility}
                      />
                    </td>
                  </tr>
                )}
                {testOpen && testState && (
                  <tr className="bg-slate-50 dark:bg-slate-900/60">
                    <td colSpan={7} className="px-4 py-3">
                      <TestDeliveryPanel
                        state={testState}
                        onCancel={onCancelTest}
                        onChangeVerdict={onChangeTestVerdict}
                        onSend={onSendTest}
                      />
                    </td>
                  </tr>
                )}
                {tokensOpen && (
                  <tr className="bg-slate-50 dark:bg-slate-900/60">
                    <td colSpan={7} className="px-4 py-3">
                      <SubscriberTokenManagementPanel subscriptionId={sub.id} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

interface RotatePanelProps {
  state: RotateRowState;
  onCancel: () => void;
  onAcknowledge: (ack: boolean) => void;
  onConfirm: (id: string) => void;
  onToggleVisibility: () => void;
}

const RotatePanel: React.FC<RotatePanelProps> = ({
  state,
  onCancel,
  onAcknowledge,
  onConfirm,
  onToggleVisibility,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = useCallback(async () => {
    if (!state.oneTimeSecret) return;
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(state.oneTimeSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // best-effort copy
    }
  }, [state.oneTimeSecret]);

  if (state.oneTimeSecret) {
    return (
      <div className="space-y-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-900/20">
        <div className="flex items-start gap-2">
          <CheckCircle2 size={14} className="mt-0.5 text-emerald-700 dark:text-emerald-300" />
          <div className="flex-1">
            <div className="text-xs font-semibold text-emerald-900 dark:text-emerald-100">
              New signing secret generated
            </div>
            <p className="mt-1 text-[11px] text-emerald-800 dark:text-emerald-200">
              This is the only time you will see this secret. Store it in your subscriber app now.
              The reveal panel auto-closes in 60s.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 select-all break-all rounded border border-emerald-200 bg-white px-2 py-1.5 font-mono text-[11px] text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-100">
            {state.visible ? state.oneTimeSecret : state.oneTimeSecret.replace(/./g, '•')}
          </code>
          <button
            type="button"
            onClick={onToggleVisibility}
            className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-white px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
          >
            {state.visible ? <EyeOff size={11} /> : <Eye size={11} />}
            {state.visible ? 'Hide' : 'Show'}
          </button>
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex items-center gap-1 rounded-md border border-emerald-600 bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <Copy size={11} /> {copied ? 'Copied!' : 'Copy secret'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start gap-2">
        <Key size={14} className="mt-0.5 text-amber-600 dark:text-amber-400" />
        <div className="flex-1">
          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            Rotate signing secret
          </div>
          <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
            Rotation immediately invalidates the previous secret. Outbound traffic uses the new
            secret on the next dispatch.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          aria-label="Cancel"
        >
          <X size={14} />
        </button>
      </div>
      <label className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          checked={state.acknowledged}
          onChange={(e) => onAcknowledge(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        I understand the previous secret will be invalidated.
      </label>
      {state.error && (
        <div className="rounded border border-danger-200 bg-danger-50 px-2 py-1.5 text-[11px] text-danger-700 dark:border-danger-800 dark:bg-danger-900/30 dark:text-danger-300">
          {state.error}
        </div>
      )}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(state.subscriptionId)}
          disabled={!state.acknowledged || state.loading}
          className="inline-flex items-center gap-1 rounded-md border border-amber-600 bg-amber-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state.loading ? <Loader2 size={11} className="animate-spin" /> : <Key size={11} />}
          Rotate now
        </button>
      </div>
    </div>
  );
};

interface TestDeliveryPanelProps {
  state: TestRowState;
  onCancel: () => void;
  onChangeVerdict: (verdict: AlertSeverity) => void;
  onSend: (id: string, verdict: AlertSeverity) => void;
}

const TestDeliveryPanel: React.FC<TestDeliveryPanelProps> = ({
  state,
  onCancel,
  onChangeVerdict,
  onSend,
}) => {
  return (
    <div className="space-y-3 rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start gap-2">
        <Send size={14} className="mt-0.5 text-indigo-600 dark:text-indigo-400" />
        <div className="flex-1">
          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            Send signed test delivery
          </div>
          <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
            Fires a synthetic transition payload signed with the current subscription secret. Test
            deliveries are NOT recorded in the dispatch audit log.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          aria-label="Cancel"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col">
          <label
            htmlFor={`test-verdict-${state.subscriptionId}`}
            className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
          >
            Synthetic verdict
          </label>
          <select
            id={`test-verdict-${state.subscriptionId}`}
            value={state.verdict}
            onChange={(e) => onChangeVerdict(e.target.value as AlertSeverity)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="BLOCKED_P0">BLOCKED_P0</option>
            <option value="BLOCKED_P1">BLOCKED_P1</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => onSend(state.subscriptionId, state.verdict)}
          disabled={state.loading}
          className="inline-flex items-center gap-1 rounded-md border border-indigo-600 bg-indigo-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state.loading ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
          Fire signed test
        </button>
      </div>
      {state.error && (
        <div className="rounded border border-danger-200 bg-danger-50 px-2 py-1.5 text-[11px] text-danger-700 dark:border-danger-800 dark:bg-danger-900/30 dark:text-danger-300">
          {state.error}
        </div>
      )}
      {state.result && <TestDeliveryResultCard result={state.result} />}
    </div>
  );
};

interface TestDeliveryResultCardProps {
  result: TestDeliveryResult;
}

const TestDeliveryResultCard: React.FC<TestDeliveryResultCardProps> = ({ result }) => {
  const tone = TEST_STATUS_TONE[result.status];
  const label = TEST_STATUS_LABEL[result.status];
  return (
    <div className={`space-y-1.5 rounded-md border px-3 py-2 text-[11px] ${tone}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <span className="font-semibold uppercase tracking-wide">{label}</span>
        {typeof result.httpStatus === 'number' && (
          <span>
            HTTP <span className="tabular-nums">{result.httpStatus}</span>
          </span>
        )}
        {typeof result.durationMs === 'number' && (
          <span>
            <span className="tabular-nums">{result.durationMs}</span> ms
          </span>
        )}
        {result.signed && <span>Signed: yes</span>}
        {!result.signed && <span>Signed: no</span>}
        {result.errorCategory && <span>Error: {result.errorCategory}</span>}
      </div>
      {result.signaturePreview && (
        <div className="font-mono opacity-80">
          x-consultify-signature: {result.signaturePreview}
        </div>
      )}
      {result.payloadPreview && (
        <div className="font-mono opacity-80">
          payload: eventId={result.payloadPreview.eventId} · toVerdict=
          {result.payloadPreview.toVerdict} · deckId={result.payloadPreview.deckId}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// WIZARD
// ============================================================================

type WizardStep = 'channel' | 'target' | 'severity' | 'review' | 'rotate';

interface NewSubscriptionWizardProps {
  onClose: () => void;
  onCreated: () => void;
}

const NewSubscriptionWizard: React.FC<NewSubscriptionWizardProps> = ({ onClose, onCreated }) => {
  const [step, setStep] = useState<WizardStep>('channel');
  const [channel, setChannel] = useState<AlertChannel>('webhook');
  const [target, setTarget] = useState<string>('');
  const [minSeverity, setMinSeverity] = useState<AlertSeverity>('BLOCKED_P1');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [secretLoading, setSecretLoading] = useState<boolean>(false);
  const [oneTimeSecret, setOneTimeSecret] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const targetError = useMemo(() => validateTarget(channel, target), [channel, target]);

  const handleCreate = useCallback(async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await createAlertSubscription({
        channel,
        target: target.trim(),
        minSeverity,
      });
      if (result.status === 'ok' && result.subscription) {
        setCreatedId(result.subscription.id);
        setStep('rotate');
      } else if (result.status === 'forbidden') {
        setErrorMessage('Insufficient permission to create a subscription.');
      } else {
        setErrorMessage(result.error || 'Failed to create subscription.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [channel, target, minSeverity]);

  const handleRotateNow = useCallback(async () => {
    if (!createdId) return;
    setSecretLoading(true);
    setErrorMessage(null);
    try {
      const result = await rotateAlertSubscriptionSecret(createdId);
      if (result.status === 'ok' && result.oneTimeSecret) {
        setOneTimeSecret(result.oneTimeSecret);
      } else {
        setErrorMessage(result.error || 'Failed to generate signing secret.');
      }
    } finally {
      setSecretLoading(false);
    }
  }, [createdId]);

  const stepIndex: Record<WizardStep, number> = {
    channel: 1,
    target: 2,
    severity: 3,
    review: 4,
    rotate: 5,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-c-surface/60 p-4">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              New subscription
            </h3>
            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Step {stepIndex[step]} of 5
            </div>
          </div>
          <button
            type="button"
            onClick={createdId ? onCreated : onClose}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          {step === 'channel' && (
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Choose channel
              </legend>
              {(['webhook', 'slack', 'email'] as AlertChannel[]).map((c) => (
                <label
                  key={c}
                  className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <input
                    type="radio"
                    name="channel"
                    value={c}
                    checked={channel === c}
                    onChange={() => setChannel(c)}
                    className="h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-medium">{CHANNEL_LABEL[c]}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {c === 'webhook'
                      ? 'Generic HTTPS webhook (recommended)'
                      : c === 'slack'
                        ? 'Slack incoming webhook URL'
                        : 'Email address (delivery is currently a stub)'}
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          {step === 'target' && (
            <div className="space-y-2">
              <label
                htmlFor="wizard-target"
                className="text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                Target {channel === 'email' ? 'email address' : 'URL'}
              </label>
              <input
                id="wizard-target"
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={
                  channel === 'email'
                    ? 'alerts@example.com'
                    : 'https://hooks.example.com/webhook/abc123'
                }
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
              {targetError && (
                <div className="text-[11px] text-danger-700 dark:text-danger-300">
                  {targetError}
                </div>
              )}
            </div>
          )}

          {step === 'severity' && (
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Minimum severity
              </legend>
              {(['BLOCKED_P0', 'BLOCKED_P1'] as AlertSeverity[]).map((s) => (
                <label
                  key={s}
                  className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <input
                    type="radio"
                    name="severity"
                    value={s}
                    checked={minSeverity === s}
                    onChange={() => setMinSeverity(s)}
                    className="h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-mono">{s}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {s === 'BLOCKED_P0'
                      ? 'Only fire on critical (P0) blockers'
                      : 'Fire on P1 + P0 blockers (recommended)'}
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          {step === 'review' && (
            <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-900/40">
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">Channel:</span>{' '}
                <span className="text-slate-700 dark:text-slate-300">{CHANNEL_LABEL[channel]}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">Target:</span>{' '}
                <code className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                  {target.trim()}
                </code>
              </div>
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Min severity:
                </span>{' '}
                <span className="font-mono text-slate-700 dark:text-slate-300">{minSeverity}</span>
              </div>
              {errorMessage && (
                <div className="rounded border border-danger-200 bg-danger-50 px-2 py-1.5 text-[11px] text-danger-700 dark:border-danger-800 dark:bg-danger-900/30 dark:text-danger-300">
                  {errorMessage}
                </div>
              )}
            </div>
          )}

          {step === 'rotate' && (
            <div className="space-y-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-xs dark:border-emerald-800 dark:bg-emerald-900/20">
              <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
                <CheckCircle2 size={14} />
                <span className="font-semibold">Subscription created</span>
              </div>
              {!oneTimeSecret ? (
                <>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-200">
                    Generate a signing secret next? Without one, outbound webhooks for this
                    subscription will be unsigned.
                  </p>
                  {errorMessage && (
                    <div className="rounded border border-danger-200 bg-danger-50 px-2 py-1.5 text-[11px] text-danger-700 dark:border-danger-800 dark:bg-danger-900/30 dark:text-danger-300">
                      {errorMessage}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRotateNow()}
                      disabled={secretLoading}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-600 bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {secretLoading ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Key size={11} />
                      )}
                      Rotate now
                    </button>
                    <button
                      type="button"
                      onClick={onCreated}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Skip for now
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-200">
                    This is the only time you will see this secret. Store it in your subscriber app
                    now.
                  </p>
                  <code className="block select-all break-all rounded border border-emerald-200 bg-white px-2 py-1.5 font-mono text-[11px] text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-100">
                    {oneTimeSecret}
                  </code>
                  <button
                    type="button"
                    onClick={onCreated}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-600 bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              if (step === 'target') setStep('channel');
              else if (step === 'severity') setStep('target');
              else if (step === 'review') setStep('severity');
            }}
            disabled={step === 'channel' || step === 'rotate' || submitting}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Back
          </button>
          {step !== 'rotate' && step !== 'review' && (
            <button
              type="button"
              onClick={() => {
                if (step === 'channel') setStep('target');
                else if (step === 'target') setStep('severity');
                else if (step === 'severity') setStep('review');
              }}
              disabled={step === 'target' && !!targetError}
              className="inline-flex items-center gap-1 rounded-md border border-indigo-600 bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Next <ChevronRight size={11} />
            </button>
          )}
          {step === 'review' && (
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={submitting || !!targetError}
              className="inline-flex items-center gap-1 rounded-md border border-indigo-600 bg-indigo-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
              Create subscription
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PresentationGovernanceAlertSubscriptionsView;
