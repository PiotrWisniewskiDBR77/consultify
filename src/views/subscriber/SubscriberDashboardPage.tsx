/**
 * SubscriberDashboardPage
 *
 * Read-only, standalone dashboard the external HMAC alert subscriber
 * opens in their browser. Mounts at `/subscriber/dashboard` and is the
 * client-side counterpart to the Sprint 13 backend route
 * `GET /api/presentations/governance/subscriber/dashboard`.
 *
 * State machine (single component, four mutually exclusive views):
 *
 *   ┌────────────┐    paste / hash    ┌──────────┐  fetch ok    ┌────────┐
 *   │ NoToken    │ ─────────────────▶ │ Loading  │ ───────────▶ │ Loaded │
 *   └────────────┘                    └──────────┘              └────────┘
 *         ▲                                  │ fetch fail            │
 *         │ sign-out (401)                   ▼                       │ sign-out
 *         └──────────────────────  ┌──────────────────┐ ◀────────────┘
 *                                  │ Error (5 reasons)│
 *                                  └──────────────────┘
 *
 * Boot sequence:
 *   1. On mount, read `#token=…` from `window.location.hash`. If
 *      present and well-formed, save it to `sessionStorage` and
 *      `history.replaceState` the URL so the token never lingers.
 *   2. If `sessionTokenStore.hasToken()`, kick off the first fetch.
 *   3. Otherwise render the paste-in form.
 *
 * Privacy invariants enforced here:
 *   - Token NEVER read from / written to `localStorage` or cookies.
 *   - Token never echoed back to the DOM (the input is masked while
 *     typing — `type="password"` — and the value is cleared from
 *     state once handed off to the store).
 *   - No telemetry; the only `fetch` call goes to the dashboard path.
 *
 * Embeddable mode: `?embed=1` collapses chrome (no logo header, no
 * footer, no sign-out button) so the page can be iframed inside a
 * subscriber's own ops surface.
 */

import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCcw,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import SubscriberDashboardLayout from '../../components/Subscriber/SubscriberDashboardLayout';
import SubscriberDispatchTable from '../../components/Subscriber/SubscriberDispatchTable';
import SubscriberHealthBadge from '../../components/Subscriber/SubscriberHealthBadge';
import {
  ClientSubscriberSnapshot,
  extractTokenFromHash,
  fetchSubscriberDashboard,
  scrubTokenFromHash,
  sessionTokenStore,
  SubscriberFetchStatus,
} from '../../services/subscriberDashboardClient';

// ============================================================================
// COPY (centralized for future i18n; placeholder for translation layer)
// ============================================================================

const COPY = {
  title: 'Consultify Subscriber Dashboard',
  subtitle: 'Enter the dashboard token your Consultify operator gave you.',
  tokenLabel: 'Dashboard token',
  tokenPlaceholder: '64-character token from your operator',
  tokenHelp:
    'Your token is held only in this browser tab and is cleared when you close it. Never share this token publicly.',
  continueButton: 'Continue',
  signOut: 'Sign out',
  refresh: 'Refresh',
  loading: 'Loading dashboard…',
  manualLoading: 'Refreshing…',
  errorTryAgain: 'Try again',
  signatureCardTitle: 'Signing secret',
  signatureWhyTitle: 'Why this matters',
  signatureWhyBody:
    'HMAC signatures let you verify each webhook came from Consultify and was not tampered with in transit. Rotating the secret regularly limits the blast radius of a leak.',
  rotationOverdue: 'Your signing secret is overdue for rotation.',
  rotationDueSoon: 'Your signing secret should be rotated soon.',
  deliveryCardTitle: 'Delivery summary',
  deliverySent: 'Sent',
  deliveryFailed: 'Failed',
  deliverySuppressed: 'Suppressed',
  deliveryDryRun: 'Dry-run',
  consecutiveFailuresPrefix: 'Consecutive failures:',
  lastDispatchPrefix: 'Last dispatch:',
  lastFailurePrefix: 'Last failure:',
  warningsHeading: 'Warnings & reasons',
  noWarnings: 'No warnings reported.',
  invalidTokenInline:
    'That does not look like a valid dashboard token. Tokens are 64 lowercase hex characters.',
  errorTitles: {
    unauthorized: 'Token rejected',
    forbidden: 'Access denied',
    rate_limited: 'Too many requests',
    storage_unavailable: 'Service temporarily unavailable',
    network_error: 'Network error',
  } as Record<SubscriberFetchStatus, string>,
  errorBodies: {
    unauthorized:
      'The dashboard token was not accepted. It may have expired, been revoked, or been issued for a different subscription. Sign out and request a fresh token from your Consultify operator.',
    forbidden:
      'This token is valid but does not have permission to view the dashboard. Contact your Consultify operator.',
    rate_limited:
      'You have requested the dashboard too many times in a short period. Wait a minute and try again. We recommend polling no faster than once every 5 minutes.',
    storage_unavailable:
      'The dashboard backend is temporarily unable to reach its storage layer. This is usually transient — try again in a moment.',
    network_error: 'We could not reach the dashboard. Check your connection and try again.',
  } as Record<SubscriberFetchStatus, string>,
} as const;

// ============================================================================
// SMALL HELPERS (formatters)
// ============================================================================

function formatRelative(iso: string | null): string {
  if (!iso) return 'never';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return 'never';
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

function formatClock(date: Date | null): string {
  if (!date) return '—';
  try {
    return date.toLocaleTimeString();
  } catch {
    return date.toISOString();
  }
}

function isEmbedFromLocation(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  try {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('embed');
    return v === '1' || v === 'true';
  } catch {
    return false;
  }
}

// ============================================================================
// PAGE
// ============================================================================

const SubscriberDashboardPage: React.FC = () => {
  const [embed] = useState<boolean>(() => isEmbedFromLocation());
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<ClientSubscriberSnapshot | null>(null);
  const [errorStatus, setErrorStatus] = useState<SubscriberFetchStatus | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load the snapshot using the token currently held in sessionStorage.
  // Never throws; resets `errorStatus` only on success.
  const loadDashboard = useCallback(async () => {
    const token = sessionTokenStore.getToken();
    if (!token) {
      setHasToken(false);
      return;
    }
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    const result = await fetchSubscriberDashboard({
      token,
      signal: controller.signal,
    });
    if (controller.signal.aborted) return;
    setLoading(false);

    if (result.status === 'ok' && result.data) {
      setData(result.data);
      setErrorStatus(null);
      setLastRefreshAt(new Date());
    } else {
      setErrorStatus(result.status);
      setData(null);
    }
  }, []);

  // Boot: hash → store → fetch.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const fromHash = extractTokenFromHash(window.location.hash);
      if (fromHash) {
        sessionTokenStore.saveToken(fromHash);
        scrubTokenFromHash();
      }
    }
    const present = sessionTokenStore.hasToken();
    setHasToken(present);
    if (present) {
      void loadDashboard();
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [loadDashboard]);

  const handleSignOut = useCallback(() => {
    sessionTokenStore.clearToken();
    setHasToken(false);
    setData(null);
    setErrorStatus(null);
    setLastRefreshAt(null);
  }, []);

  const handleRetry = useCallback(() => {
    setErrorStatus(null);
    void loadDashboard();
  }, [loadDashboard]);

  const handleTokenSubmit = useCallback(
    (rawToken: string) => {
      sessionTokenStore.saveToken(rawToken);
      const present = sessionTokenStore.hasToken();
      setHasToken(present);
      if (present) {
        void loadDashboard();
      }
      return present;
    },
    [loadDashboard]
  );

  // Right-side header slot: refresh + sign-out (sign-out hidden in embed mode).
  const headerRight = useMemo(() => {
    if (!hasToken && !errorStatus) return null;
    return (
      <>
        {hasToken && (
          <button
            type="button"
            onClick={() => void loadDashboard()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-c-border bg-c-surface px-3 py-1.5 text-xs font-medium text-c-text-secondary shadow-sm transition-colors hover:bg-c-surface-raised focus:outline-none focus:ring-2 focus:ring-c-focus disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={COPY.refresh}
          >
            {loading ? (
              <Loader2 size={12} className="animate-spin" aria-hidden />
            ) : (
              <RefreshCcw size={12} aria-hidden />
            )}
            {loading ? COPY.manualLoading : COPY.refresh}
          </button>
        )}
        {!embed && hasToken && (
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 rounded-md border border-c-border bg-c-surface px-3 py-1.5 text-xs font-medium text-c-text-secondary shadow-sm transition-colors hover:bg-c-surface-raised focus:outline-none focus:ring-2 focus:ring-c-focus"
          >
            <LogOut size={12} aria-hidden />
            {COPY.signOut}
          </button>
        )}
      </>
    );
  }, [hasToken, errorStatus, loading, embed, loadDashboard, handleSignOut]);

  return (
    <SubscriberDashboardLayout embed={embed} rightHeaderContent={headerRight}>
      {renderBody({
        hasToken,
        loading,
        data,
        errorStatus,
        embed,
        lastRefreshAt,
        onSubmitToken: handleTokenSubmit,
        onSignOut: handleSignOut,
        onRetry: handleRetry,
      })}
    </SubscriberDashboardLayout>
  );
};

// ============================================================================
// BODY ROUTER
// ============================================================================

interface BodyProps {
  hasToken: boolean;
  loading: boolean;
  data: ClientSubscriberSnapshot | null;
  errorStatus: SubscriberFetchStatus | null;
  embed: boolean;
  lastRefreshAt: Date | null;
  onSubmitToken: (rawToken: string) => boolean;
  onSignOut: () => void;
  onRetry: () => void;
}

function renderBody(props: BodyProps): React.ReactElement {
  const {
    hasToken,
    loading,
    data,
    errorStatus,
    embed,
    lastRefreshAt,
    onSubmitToken,
    onSignOut,
    onRetry,
  } = props;

  if (errorStatus) {
    return <ErrorView status={errorStatus} onSignOut={onSignOut} onRetry={onRetry} embed={embed} />;
  }

  if (!hasToken) {
    return <TokenEntryView onSubmit={onSubmitToken} />;
  }

  if (loading && !data) {
    return <SkeletonView />;
  }

  if (data) {
    return <LoadedView data={data} lastRefreshAt={lastRefreshAt} />;
  }

  return <SkeletonView />;
}

// ============================================================================
// TOKEN ENTRY (State 1)
// ============================================================================

interface TokenEntryProps {
  onSubmit: (rawToken: string) => boolean;
}

const TokenEntryView: React.FC<TokenEntryProps> = ({ onSubmit }) => {
  const [value, setValue] = useState<string>('');
  const [touched, setTouched] = useState<boolean>(false);

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      setTouched(true);
      const trimmed = value.trim();
      const accepted = onSubmit(trimmed);
      if (accepted) setValue('');
    },
    [value, onSubmit]
  );

  const showInvalidHint = touched && value.length > 0;

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-xl border border-c-border-subtle bg-c-surface p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-c-accent-soft text-c-accent"
          >
            <KeyRound size={18} />
          </span>
          <h1 className="text-lg font-semibold text-c-text">{COPY.title}</h1>
        </div>
        <p className="mt-2 text-sm text-c-text-secondary">{COPY.subtitle}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <label
            htmlFor="subscriber-token"
            className="block text-xs font-semibold uppercase tracking-wide text-c-text-muted"
          >
            {COPY.tokenLabel}
          </label>
          <input
            id="subscriber-token"
            name="subscriberToken"
            type="password"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            placeholder={COPY.tokenPlaceholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => setTouched(true)}
            className="block w-full rounded-md border border-c-border bg-c-surface px-3 py-2 font-mono text-sm text-c-text shadow-sm focus:border-c-focus-solid focus:outline-none focus:ring-2 focus:ring-c-focus"
            aria-describedby="subscriber-token-help"
          />
          {showInvalidHint && (
            <p role="status" className="text-xs text-danger-600 dark:text-danger-300">
              {COPY.invalidTokenInline}
            </p>
          )}
          <p id="subscriber-token-help" className="text-xs text-c-text-muted">
            {COPY.tokenHelp}
          </p>
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-c-accent bg-c-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-c-focus sm:w-auto"
          >
            {COPY.continueButton}
          </button>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// SKELETON (State 2)
// ============================================================================

const SkeletonView: React.FC = () => (
  <div className="space-y-4" aria-busy="true" aria-live="polite">
    <div className="flex items-center gap-2 text-sm text-c-text-secondary">
      <Loader2 size={14} className="animate-spin text-c-accent" aria-hidden />
      {COPY.loading}
    </div>
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className="h-24 animate-pulse rounded-lg border border-c-border-subtle bg-c-surface shadow-sm"
      />
    ))}
    <div className="h-48 animate-pulse rounded-lg border border-c-border-subtle bg-c-surface shadow-sm" />
  </div>
);

// ============================================================================
// LOADED (State 3)
// ============================================================================

interface LoadedProps {
  data: ClientSubscriberSnapshot;
  lastRefreshAt: Date | null;
}

const LoadedView: React.FC<LoadedProps> = ({ data, lastRefreshAt }) => {
  return (
    <div className="space-y-6">
      <HeaderStrip data={data} lastRefreshAt={lastRefreshAt} />
      <SignatureCard data={data} />
      <DeliverySummary data={data} />
      <SubscriberDispatchTable dispatches={data.recentDispatches} />
      <ReasonsAndWarnings data={data} />
    </div>
  );
};

const HeaderStrip: React.FC<LoadedProps> = ({ data, lastRefreshAt }) => {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-c-border-subtle bg-c-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-c-text">
            {data.subscription.target || '—'}
          </span>
          <span className="inline-flex items-center rounded-full bg-c-surface-raised px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-c-text-secondary">
            {data.subscription.channel || '—'}
          </span>
          {!data.subscription.active && (
            <span className="inline-flex items-center rounded-full bg-c-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-c-warning">
              Paused
            </span>
          )}
        </div>
        <p className="mt-1 text-[11px] text-c-text-muted">
          Min severity: {data.subscription.minSeverity || '—'}
        </p>
      </div>
      <div className="flex flex-col items-start gap-1 sm:items-end">
        <SubscriberHealthBadge overall={data.health.overall} reasons={data.health.reasons} />
        <p className="flex items-center gap-1 text-[11px] text-c-text-muted">
          <Clock size={11} aria-hidden />
          Last refreshed: {formatClock(lastRefreshAt)}
        </p>
      </div>
    </div>
  );
};

const SignatureCard: React.FC<{ data: ClientSubscriberSnapshot }> = ({ data }) => {
  const [open, setOpen] = useState<boolean>(false);
  const overdue =
    data.signature.daysSinceRotation !== null && data.signature.daysSinceRotation > 90;
  const dueSoon =
    !overdue &&
    data.signature.rotationDueWithinDays !== null &&
    data.signature.rotationDueWithinDays <= 30;

  return (
    <div className="rounded-lg border border-c-border-subtle bg-c-surface p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <ShieldCheck size={14} className="text-c-text-muted" aria-hidden />
        <h3 className="text-sm font-semibold text-c-text-secondary">{COPY.signatureCardTitle}</h3>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-c-text-secondary">
        <span className="inline-flex items-center rounded-full bg-c-accent-soft px-2 py-0.5 font-mono text-[10px] font-semibold text-c-accent">
          {data.signature.algorithm}
        </span>
        <span>
          Last rotated:{' '}
          <strong className="font-medium">
            {formatRelative(data.signature.secretLastRotatedAt)}
          </strong>
          {data.signature.daysSinceRotation !== null && (
            <span className="ml-1 text-c-text-muted">({data.signature.daysSinceRotation}d)</span>
          )}
        </span>
      </div>
      {(overdue || dueSoon) && (
        <div
          role="status"
          className={`mt-3 flex items-start gap-2 rounded-md border p-3 text-xs ${
            overdue
              ? 'border-danger-200 bg-danger-50 text-danger-800 dark:border-danger-800 dark:bg-danger-900/30 dark:text-danger-200'
              : 'border-c-warning/30 bg-c-warning/10 text-c-warning'
          }`}
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          <span>{overdue ? COPY.rotationOverdue : COPY.rotationDueSoon}</span>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-c-accent hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-c-focus"
      >
        {COPY.signatureWhyTitle}
        {open ? <ChevronUp size={12} aria-hidden /> : <ChevronDown size={12} aria-hidden />}
      </button>
      {open && <p className="mt-2 text-xs text-c-text-secondary">{COPY.signatureWhyBody}</p>}
    </div>
  );
};

const DeliverySummary: React.FC<{ data: ClientSubscriberSnapshot }> = ({ data }) => {
  const { delivery } = data;
  return (
    <div className="rounded-lg border border-c-border-subtle bg-c-surface p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-c-text-secondary">{COPY.deliveryCardTitle}</h3>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DeliveryColumn label="Last 7 days" agg={delivery.last7Days} />
        <DeliveryColumn label="Last 30 days" agg={delivery.last30Days} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-c-text-muted">
        <span>
          {COPY.lastDispatchPrefix} {formatRelative(delivery.lastDispatchAt)}
        </span>
        <span>·</span>
        <span>
          {COPY.lastFailurePrefix} {formatRelative(delivery.lastFailureAt)}
        </span>
        {delivery.consecutiveFailures > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-c-warning/10 px-2 py-0.5 text-[10px] font-semibold text-c-warning">
            <AlertTriangle size={10} aria-hidden />
            {COPY.consecutiveFailuresPrefix} {delivery.consecutiveFailures}
          </span>
        )}
      </div>
    </div>
  );
};

interface DeliveryColumnProps {
  label: string;
  agg: ClientSubscriberSnapshot['delivery']['last7Days'];
}

const DeliveryColumn: React.FC<DeliveryColumnProps> = ({ label, agg }) => {
  return (
    <div className="rounded-md border border-c-border-subtle bg-c-surface-raised p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
        {label}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-c-text-secondary sm:grid-cols-4">
        <DeliveryStat label={COPY.deliverySent} value={agg.sent} tone="emerald" />
        <DeliveryStat label={COPY.deliveryFailed} value={agg.failed} tone="rose" />
        <DeliveryStat label={COPY.deliverySuppressed} value={agg.suppressed} tone="slate" />
        <DeliveryStat label={COPY.deliveryDryRun} value={agg.dryRun} tone="sky" />
      </div>
    </div>
  );
};

interface DeliveryStatProps {
  label: string;
  value: number;
  tone: 'emerald' | 'rose' | 'slate' | 'sky';
}

const STAT_TONE: Record<DeliveryStatProps['tone'], string> = {
  emerald: 'text-c-success',
  rose: 'text-c-danger',
  slate: 'text-c-text-secondary',
  sky: 'text-c-info',
};

const DeliveryStat: React.FC<DeliveryStatProps> = ({ label, value, tone }) => {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
        {label}
      </div>
      <div className={`tabular-nums text-base font-semibold ${STAT_TONE[tone]}`}>
        {Number.isFinite(value) ? value.toLocaleString() : '—'}
      </div>
    </div>
  );
};

const ReasonsAndWarnings: React.FC<{ data: ClientSubscriberSnapshot }> = ({ data }) => {
  const items: string[] = [...data.health.reasons, ...data.warnings].filter(
    (s) => typeof s === 'string' && s.length > 0
  );
  return (
    <div className="rounded-lg border border-c-border-subtle bg-c-surface p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-c-text-secondary">{COPY.warningsHeading}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-c-text-muted">{COPY.noWarnings}</p>
      ) : (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-c-text-secondary">
          {items.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ============================================================================
// ERROR (State 4)
// ============================================================================

interface ErrorViewProps {
  status: SubscriberFetchStatus;
  embed: boolean;
  onSignOut: () => void;
  onRetry: () => void;
}

const ERROR_TONE: Record<SubscriberFetchStatus, string> = {
  ok: 'border-c-success/30 bg-c-success/10 text-c-success',
  unauthorized:
    'border-danger-200 bg-danger-50 text-danger-800 dark:border-danger-800 dark:bg-danger-900/30 dark:text-danger-200',
  forbidden:
    'border-danger-200 bg-danger-50 text-danger-800 dark:border-danger-800 dark:bg-danger-900/30 dark:text-danger-200',
  rate_limited: 'border-c-warning/30 bg-c-warning/10 text-c-warning',
  storage_unavailable: 'border-c-warning/30 bg-c-warning/10 text-c-warning',
  network_error: 'border-c-border-subtle bg-c-surface-raised text-c-text-secondary',
};

const ERROR_ICON: Record<
  SubscriberFetchStatus,
  React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>
> = {
  ok: ShieldCheck,
  unauthorized: KeyRound,
  forbidden: KeyRound,
  rate_limited: Clock,
  storage_unavailable: AlertTriangle,
  network_error: Wifi,
};

const ErrorView: React.FC<ErrorViewProps> = ({ status, embed, onSignOut, onRetry }) => {
  const Icon = ERROR_ICON[status];
  const isAuthError = status === 'unauthorized' || status === 'forbidden';
  return (
    <div role="alert" className={`rounded-lg border p-6 shadow-sm ${ERROR_TONE[status]}`}>
      <div className="flex items-start gap-3">
        <Icon size={20} className="mt-0.5 shrink-0" aria-hidden />
        <div className="flex-1">
          <h2 className="text-base font-semibold">{COPY.errorTitles[status] || 'Error'}</h2>
          <p className="mt-1 text-sm opacity-90">
            {COPY.errorBodies[status] || 'An unexpected error occurred.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-md border border-current bg-c-surface/40 px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors hover:bg-c-surface/70 focus:outline-none focus:ring-2 focus:ring-current"
            >
              <RefreshCcw size={12} aria-hidden />
              {COPY.errorTryAgain}
            </button>
            {!embed && isAuthError && (
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-1.5 rounded-md border border-current bg-c-surface/40 px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors hover:bg-c-surface/70 focus:outline-none focus:ring-2 focus:ring-current"
              >
                <LogOut size={12} aria-hidden />
                {COPY.signOut}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriberDashboardPage;
