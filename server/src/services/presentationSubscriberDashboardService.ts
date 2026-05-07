/**
 * Presentation Subscriber Dashboard Service (Sprint 13)
 *
 * Pure-logic core for the read-only "subscriber dashboard" surface — the
 * dashboard external HMAC alert subscribers (clients of clients) see when
 * they authenticate against
 * `GET /api/presentations/governance/subscriber/dashboard` with a Bearer
 * subscriber token (see migration 765).
 *
 * Three concerns live here:
 *
 *   1. Token primitives — `generateRawToken`, `hashToken`. The raw token
 *      leaves the system exactly once (at issuance time); only the sha256
 *      hash is persisted on
 *      `presentation_governance_subscriber_tokens.token_hash`.
 *   2. PII masking — `maskTarget` and `maskDeckId`. The subscriber endpoint
 *      MUST NEVER echo the full webhook URL/email or full deck id back to
 *      the subscriber. The masks here are intentionally lossy.
 *   3. Snapshot assembly — `buildSubscriberDashboardSnapshot`. Pure
 *      reducer over the subscription row and the recent
 *      `presentation_governance_alert_dispatches` rows that produces the
 *      JSON shape the route returns. Health classification rules
 *      (consecutive-failure thresholds + signing-secret rotation
 *      pressure) live here so they can be unit-tested without a DB.
 *
 * Critical security invariants:
 *   - The subscriber endpoint NEVER reveals the `signing_secret`. Only a
 *     `signaturePreview` derived from a hash prefix may appear (and even
 *     that is opt-in; this service never generates it).
 *   - The snapshot is JSON-serializable: only plain objects, strings,
 *     numbers, booleans, arrays. No `Date` / `Map` / class instances.
 */

import { createHash, randomBytes } from 'node:crypto';

// ============================================================================
// TYPES
// ============================================================================

export interface IssueTokenInput {
  subscriptionId: string;
  organizationId: string;
  /** 1..90, default 30. Service clamps out-of-range values. */
  ttlDays?: number;
  issuedBy?: string;
}

export interface IssueTokenResult {
  status: 'ok' | 'subscription_not_found' | 'subscription_inactive' | 'rate_limit' | 'storage_error';
  /** 64 hex chars; ONLY returned on success and never echoed back later. */
  oneTimeToken?: string;
  tokenId?: string;
  expiresAt?: string;
  reason?: string;
}

export interface ValidateTokenInput {
  rawToken: string;
}

export interface ValidatedSubscriber {
  subscriptionId: string;
  organizationId: string;
  tokenId: string;
  channel: string;
  /** Already masked — never the raw URL/email. */
  target: string;
  signaturePreview?: string;
}

export interface ValidateTokenResult {
  status: 'ok' | 'invalid_format' | 'not_found' | 'expired' | 'revoked' | 'storage_error';
  subscriber?: ValidatedSubscriber;
  reason?: string;
}

export interface DispatchAggregate {
  sent: number;
  failed: number;
  suppressed: number;
  dryRun: number;
}

export interface RecentDispatchView {
  id: string;
  dispatchedAt: string;
  status: 'sent' | 'failed' | 'suppressed' | 'dry_run';
  httpStatus: number | null;
  toVerdict: string;
  deckIdMasked: string;
  signaturePresent: boolean;
  signatureAlgorithm: string | null;
}

export interface SubscriberDashboardSnapshot {
  subscription: {
    id: string;
    channel: string;
    /** Masked, e.g. `https://hooks.slack.****mnop`. */
    target: string;
    minSeverity: string;
    active: boolean;
    secretRotatedAt: string | null;
  };
  signature: {
    algorithm: 'HMAC-SHA256';
    secretLastRotatedAt: string | null;
    daysSinceRotation: number | null;
    /** When `daysSinceRotation > 60` we surface a soft warning window. */
    rotationDueWithinDays: number | null;
  };
  delivery: {
    last7Days: DispatchAggregate;
    last30Days: DispatchAggregate;
    lastDispatchAt: string | null;
    lastFailureAt: string | null;
    consecutiveFailures: number;
  };
  recentDispatches: RecentDispatchView[];
  health: {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    reasons: string[];
  };
  warnings: string[];
}

export interface BuildSnapshotDispatchInput {
  id: string;
  /** ISO-8601 timestamp string. Caller is responsible for normalization. */
  dispatchedAt: string;
  status: string;
  httpStatus: number | null;
  toVerdict: string;
  deckId: string | null;
  signaturePresent: boolean;
  signatureAlgorithm: string | null;
}

export interface BuildSnapshotInput {
  subscription: {
    id: string;
    channel: string;
    target: string;
    minSeverity: string;
    active: boolean;
    signingSecretRotatedAt?: string | null;
  };
  /**
   * Dispatch rows ordered chronologically ASCENDING (oldest first). The
   * `consecutiveFailures` rule walks from the END of the array, so passing
   * the rows in DESC order will silently produce wrong counts. The route
   * layer reverses the DB DESC result before calling this.
   */
  dispatches: BuildSnapshotDispatchInput[];
  /** Defaults to `new Date().toISOString()`. */
  nowIso?: string;
}

// ============================================================================
// TOKEN PRIMITIVES
// ============================================================================

/**
 * Cryptographically random 32-byte token rendered as 64 lowercase hex
 * chars. Matches the format the `presentation_governance_subscriber_tokens`
 * table indexes via `token_hash` (sha256 hex of this value).
 */
export function generateRawToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Deterministic sha256 hex of a raw token. The DB only ever stores this
 * hash; comparing user-supplied bearer tokens against the table is done by
 * hashing the input and querying the unique `token_hash` index.
 */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(String(rawToken ?? ''), 'utf8').digest('hex');
}

// ============================================================================
// PII MASKING
// ============================================================================

/**
 * Mask a delivery target so we never echo the full webhook URL / email
 * back to the subscriber. Format:
 *
 *   - HTTP(S) URL → `${scheme}//${host[0..12]}****${last4-of-target}`
 *   - Anything else (email, slack token, bare string) →
 *       `${target[0..12]}****${last4-of-target}`
 *
 * The last-4 chars are kept so the subscriber can correlate which target
 * they registered (host suffix or TLD), without leaking the path or token
 * portion of a webhook URL.
 */
export function maskTarget(target: string): string {
  if (typeof target !== 'string' || target.length === 0) return '';
  const last4 = target.length > 4 ? target.slice(-4) : '';

  if (/^https?:\/\//i.test(target)) {
    try {
      const url = new URL(target);
      const scheme = `${url.protocol}//`;
      const hostPrefix = url.host.slice(0, 12);
      return `${scheme}${hostPrefix}****${last4}`;
    } catch {
      // Fall through to bare-string masking on malformed URL.
    }
  }

  const head = target.slice(0, Math.min(12, target.length));
  return `${head}****${last4}`;
}

/**
 * Mask a deck id. We keep the first 4 chars (enough to differentiate
 * decks the subscriber knows about) and mask the rest. Strings shorter
 * than 6 chars and `null` collapse to `****` so we never accidentally
 * leak short identifiers wholesale.
 */
export function maskDeckId(deckId: string | null): string {
  if (typeof deckId !== 'string') return '****';
  if (deckId.length < 6) return '****';
  return `${deckId.slice(0, 4)}****`;
}

// ============================================================================
// SNAPSHOT ASSEMBLY
// ============================================================================

const DAY_MS = 86_400_000;
const ROTATION_WARNING_DAYS = 60;
const ROTATION_OVERDUE_DAYS = 90;
const FAILURE_DEGRADED_THRESHOLD = 5;
const FAILURE_UNHEALTHY_THRESHOLD = 10;

const DISPATCH_STATUSES = new Set(['sent', 'failed', 'suppressed', 'dry_run']);

function emptyAggregate(): DispatchAggregate {
  return { sent: 0, failed: 0, suppressed: 0, dryRun: 0 };
}

function tallyStatus(agg: DispatchAggregate, status: string): void {
  switch (status) {
    case 'sent':
      agg.sent += 1;
      break;
    case 'failed':
      agg.failed += 1;
      break;
    case 'suppressed':
      agg.suppressed += 1;
      break;
    case 'dry_run':
      agg.dryRun += 1;
      break;
    default:
      break;
  }
}

function parseIso(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

/**
 * Produce the dashboard snapshot. Never throws — malformed inputs degrade
 * gracefully (unknown statuses skip the aggregate, unparseable timestamps
 * are excluded from the windows).
 */
export function buildSubscriberDashboardSnapshot(
  input: BuildSnapshotInput
): SubscriberDashboardSnapshot {
  const nowIso = input.nowIso || new Date().toISOString();
  const nowMs = parseIso(nowIso) ?? Date.now();
  const sevenDaysCutoff = nowMs - 7 * DAY_MS;
  const thirtyDaysCutoff = nowMs - 30 * DAY_MS;

  const dispatches = Array.isArray(input.dispatches) ? input.dispatches : [];

  const last7Days = emptyAggregate();
  const last30Days = emptyAggregate();
  for (const d of dispatches) {
    const t = parseIso(d.dispatchedAt);
    if (t === null) continue;
    if (t >= thirtyDaysCutoff) tallyStatus(last30Days, d.status);
    if (t >= sevenDaysCutoff) tallyStatus(last7Days, d.status);
  }

  // Most-recent-first view used for `lastDispatchAt`, `lastFailureAt`,
  // and `recentDispatches`. The original input order is preserved for the
  // `consecutiveFailures` walk because the spec ties that count to "end
  // of array".
  const sortedDesc = [...dispatches]
    .filter((d) => parseIso(d.dispatchedAt) !== null)
    .sort((a, b) => (parseIso(b.dispatchedAt) ?? 0) - (parseIso(a.dispatchedAt) ?? 0));

  const lastDispatchAt = sortedDesc[0]?.dispatchedAt ?? null;
  const lastFailureAt =
    sortedDesc.find((d) => d.status === 'failed')?.dispatchedAt ?? null;

  let consecutiveFailures = 0;
  for (let i = dispatches.length - 1; i >= 0; i--) {
    if (dispatches[i]?.status === 'failed') {
      consecutiveFailures += 1;
    } else {
      break;
    }
  }

  const recentDispatches: RecentDispatchView[] = sortedDesc
    .filter((d) => DISPATCH_STATUSES.has(d.status))
    .slice(0, 5)
    .map((d) => ({
      id: String(d.id ?? ''),
      dispatchedAt: d.dispatchedAt,
      status: d.status as RecentDispatchView['status'],
      httpStatus: typeof d.httpStatus === 'number' ? d.httpStatus : null,
      toVerdict: String(d.toVerdict ?? ''),
      deckIdMasked: maskDeckId(d.deckId),
      signaturePresent: d.signaturePresent === true,
      signatureAlgorithm:
        typeof d.signatureAlgorithm === 'string' && d.signatureAlgorithm.length > 0
          ? d.signatureAlgorithm
          : null,
    }));

  // ----- Signing rotation pressure -----
  const secretRotatedAt = input.subscription.signingSecretRotatedAt ?? null;
  const rotatedMs = parseIso(secretRotatedAt);
  const daysSinceRotation =
    rotatedMs !== null ? Math.floor((nowMs - rotatedMs) / DAY_MS) : null;
  const rotationDueWithinDays =
    daysSinceRotation !== null && daysSinceRotation > ROTATION_WARNING_DAYS
      ? Math.max(0, ROTATION_OVERDUE_DAYS - daysSinceRotation)
      : null;

  // ----- Health classification -----
  const reasons: string[] = [];
  let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  if (consecutiveFailures >= FAILURE_DEGRADED_THRESHOLD) {
    reasons.push('5+ consecutive failures');
    overall =
      consecutiveFailures >= FAILURE_UNHEALTHY_THRESHOLD ? 'unhealthy' : 'degraded';
  }

  if (daysSinceRotation !== null && daysSinceRotation > ROTATION_OVERDUE_DAYS) {
    reasons.push('Signing secret overdue (>90 days since rotation)');
    if (overall === 'healthy') overall = 'degraded';
  }

  if (
    input.subscription.active &&
    last7Days.sent === 0 &&
    last7Days.failed === 0
  ) {
    reasons.push('No recent dispatches');
  }

  // ----- Warnings (informational, do not flip health) -----
  const warnings: string[] = [];
  if (daysSinceRotation !== null && daysSinceRotation > ROTATION_WARNING_DAYS) {
    warnings.push('Signing secret should be rotated within 30 days');
  }

  return {
    subscription: {
      id: String(input.subscription.id),
      channel: String(input.subscription.channel),
      target: maskTarget(input.subscription.target),
      minSeverity: String(input.subscription.minSeverity),
      active: input.subscription.active === true,
      secretRotatedAt,
    },
    signature: {
      algorithm: 'HMAC-SHA256',
      secretLastRotatedAt: secretRotatedAt,
      daysSinceRotation,
      rotationDueWithinDays,
    },
    delivery: {
      last7Days,
      last30Days,
      lastDispatchAt,
      lastFailureAt,
      consecutiveFailures,
    },
    recentDispatches,
    health: {
      overall,
      reasons,
    },
    warnings,
  };
}

// ============================================================================
// INTERNAL EXPORTS (test-only)
// ============================================================================

export const __internal = {
  ROTATION_WARNING_DAYS,
  ROTATION_OVERDUE_DAYS,
  FAILURE_DEGRADED_THRESHOLD,
  FAILURE_UNHEALTHY_THRESHOLD,
};
