/**
 * Presentation Governance Alert Service (Sprint 8 + Sprint 9 HMAC signing)
 *
 * Outbound dispatcher for Governance Watchlist transitions INTO `BLOCKED_P0`
 * or `BLOCKED_P1`. Splits cleanly into:
 *
 *   1. Pure helpers (`buildAlertPayload`, `shouldDispatch`, `maskTarget`,
 *      and the Sprint 9 HMAC primitives `generateSigningSecret`,
 *      `buildCanonicalSigningString`, `signWebhookBody`,
 *      `verifyWebhookSignature`, `buildSignedRequestHeaders`) —
 *      side-effect free, fully unit-testable, no DB / fetch concerns.
 *   2. Schema-tolerant DB wrappers (`listActiveSubscriptions`,
 *      `recordDispatch`) that swallow "table missing" / "column missing"
 *      errors so the governance surface stays online when migration 762
 *      (Sprint 8) or 763 (Sprint 9) has not run yet.
 *   3. The `dispatchAlertsForTransition` orchestrator that resolves
 *      subscriptions, applies severity gating, signs the outbound POST
 *      (when a per-subscription `signing_secret` is present), and records
 *      every attempt for audit. The HTTP send is intentionally skipped when
 *      the `PRESENTATION_GOVERNANCE_ALERTS_DRY_RUN` env var is `'true'` or
 *      when no `fetch` implementation is available.
 *
 * The frontend `presentationGovernanceWatchlistDiff` already encodes the
 * severity rank model. We deliberately replicate (not import) it here so the
 * server stays decoupled from the client bundle.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ============================================================================
// TYPES
// ============================================================================

export type AlertSeverity = 'BLOCKED_P0' | 'BLOCKED_P1';

export interface AlertTransitionInput {
  deckId: string;
  deckTitle: string;
  fromVerdict: string | null;
  toVerdict: AlertSeverity;
  organizationId: string;
  generatedAt: string; // ISO
}

export interface AlertSubscription {
  id: string;
  organizationId: string;
  channel: 'webhook' | 'email' | 'slack';
  target: string;
  minSeverity: AlertSeverity;
  active: boolean;
  /**
   * Per-subscription HMAC-SHA256 secret (hex). Optional — when missing,
   * outbound webhooks are NOT signed (Sprint 8 behavior). Persisted in the
   * `signing_secret` column added by migration 763.
   */
  signingSecret?: string | null;
}

/**
 * Headers attached to outbound POSTs. The four `x-consultify-*` headers are
 * present only when a `signingSecret` was available; otherwise just the
 * content type is sent. See `buildSignedRequestHeaders`.
 */
export interface SignedRequestHeaders {
  'content-type': 'application/json';
  'x-consultify-signature'?: string;
  'x-consultify-signature-algorithm'?: 'HMAC-SHA256';
  'x-consultify-timestamp'?: string;
  'x-consultify-event-id'?: string;
}

export interface AlertPayload {
  schema: 'consultify.governance.alert.v1';
  type: 'deck_blocked';
  organizationId: string;
  deckId: string;
  deckTitle: string;
  fromVerdict: string | null;
  toVerdict: AlertSeverity;
  generatedAt: string;
  severityRank: number;
  links?: { auditLogUrl?: string; deckUrl?: string };
}

export interface RecordDispatchInput {
  subscriptionId: string | null;
  organizationId: string;
  deckId: string;
  fromVerdict: string | null;
  toVerdict: AlertSeverity;
  channel: 'webhook' | 'email' | 'slack';
  targetRedacted: string;
  status: 'queued' | 'sent' | 'failed' | 'suppressed' | 'dry_run';
  httpStatus?: number | null;
  errorCategory?: string | null;
  payload?: AlertPayload | null;
  /**
   * Sprint 9 audit: which signing algorithm (if any) was used for the
   * outbound POST. `null`/undefined → unsigned. Schema-tolerant: when the
   * `signature_algorithm` column is missing, the dispatcher silently falls
   * back to the legacy INSERT without these columns.
   */
  signatureAlgorithm?: 'HMAC-SHA256' | null;
  signaturePresent?: boolean;
  /**
   * Optional pre-computed dispatch row id. When set, `recordDispatch` uses
   * this id verbatim instead of generating a new uuid. The worker pre-mints
   * the id so it can be embedded into `x-consultify-event-id` BEFORE the
   * fetch fires (signature is bound to the event id).
   */
  dispatchId?: string | null;
}

export interface DispatchSummary {
  attempted: number;
  sent: number;
  failed: number;
  suppressed: number;
  dryRun: number;
}

// ============================================================================
// PURE HELPERS
// ============================================================================

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  BLOCKED_P0: 4,
  BLOCKED_P1: 3,
};

function severityRank(severity: AlertSeverity): number {
  return SEVERITY_RANK[severity];
}

export function buildAlertPayload(transition: AlertTransitionInput): AlertPayload {
  return {
    schema: 'consultify.governance.alert.v1',
    type: 'deck_blocked',
    organizationId: transition.organizationId,
    deckId: transition.deckId,
    deckTitle: transition.deckTitle,
    fromVerdict: transition.fromVerdict,
    toVerdict: transition.toVerdict,
    generatedAt: transition.generatedAt,
    severityRank: severityRank(transition.toVerdict),
  };
}

export function shouldDispatch(
  subscription: AlertSubscription,
  transition: AlertTransitionInput
): boolean {
  if (!subscription || !transition) return false;
  if (!subscription.active) return false;
  if (subscription.organizationId !== transition.organizationId) return false;
  const transitionRank = severityRank(transition.toVerdict);
  const minRank = severityRank(subscription.minSeverity);
  return transitionRank >= minRank;
}

/**
 * Token-mask a delivery target for audit storage.
 *
 *   - URL  (https?://…) → keep `scheme://host` and the first 8 path chars,
 *                          everything else collapses to `***`.
 *   - email             → keep the first 2 chars of the local-part, append
 *                          `***@domain`.
 *   - bare string       → replace every non-newline char with `*`.
 */
export function maskTarget(target: string): string {
  if (typeof target !== 'string' || target.length === 0) return '';

  if (/^https?:\/\//i.test(target)) {
    try {
      const url = new URL(target);
      const path = url.pathname || '';
      const head = path.slice(0, 8);
      const masked = path.length > head.length || (url.search?.length ?? 0) > 0 ? '***' : '';
      return `${url.protocol}//${url.host}${head}${masked}`;
    } catch {
      // Fall through to bare-string masking on malformed URL.
    }
  }

  if (target.includes('@')) {
    const atIdx = target.lastIndexOf('@');
    const local = target.slice(0, atIdx);
    const domain = target.slice(atIdx + 1);
    if (local.length > 0 && domain.length > 0) {
      const visible = local.slice(0, Math.min(2, local.length));
      return `${visible}***@${domain}`;
    }
  }

  return target.replace(/[^\n]/g, '*');
}

// ============================================================================
// HMAC SIGNING (Sprint 9)
// ============================================================================

/**
 * Generate a fresh 32-byte HMAC secret encoded as 64 lowercase hex chars.
 * Returned value is suitable for direct storage in
 * `presentation_governance_alert_subscriptions.signing_secret`.
 */
export function generateSigningSecret(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Build the canonical string the receiver must reproduce verbatim.
 * Format: `${timestamp}\n${eventId}\n${bodyJson}` — no JSON re-encoding,
 * no whitespace normalization. Exactly the same body bytes that travel on
 * the wire are hashed.
 */
export function buildCanonicalSigningString(input: {
  eventId: string;
  timestamp: string;
  bodyJson: string;
}): string {
  return `${input.timestamp}\n${input.eventId}\n${input.bodyJson}`;
}

/**
 * Compute the HMAC-SHA256 hex digest of `canonical` using the shared secret.
 * Caller is responsible for supplying the canonical string assembled with
 * `buildCanonicalSigningString`.
 */
export function signWebhookBody(secret: string, canonical: string): string {
  return createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');
}

/**
 * Timing-safe comparison of an expected and provided hex signature. Returns
 * `false` (never throws) on length mismatch or any decoding error so the
 * receiver can treat all verification failures uniformly.
 */
export function verifyWebhookSignature(
  secret: string,
  canonical: string,
  providedHex: string
): boolean {
  if (typeof secret !== 'string' || secret.length === 0) return false;
  if (typeof providedHex !== 'string' || providedHex.length === 0) return false;
  let expectedBuf: Buffer;
  let providedBuf: Buffer;
  try {
    expectedBuf = Buffer.from(signWebhookBody(secret, canonical), 'hex');
    providedBuf = Buffer.from(providedHex, 'hex');
  } catch {
    return false;
  }
  if (expectedBuf.length === 0 || providedBuf.length === 0) return false;
  if (expectedBuf.length !== providedBuf.length) return false;
  try {
    return timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}

/**
 * Assemble the exact header bag we send on outbound webhook POSTs.
 *
 *   - `secret` null/empty → only `content-type` is emitted (Sprint 8 path).
 *   - `secret` set        → adds the four `x-consultify-*` headers with
 *                            algorithm `HMAC-SHA256` and timestamp =
 *                            `nowIso ?? new Date().toISOString()`.
 *
 * The `bodyJson` argument MUST be the literal request body bytes — the
 * caller is responsible for using the SAME string for both signing and the
 * `fetch(..., { body })` payload to avoid hash drift from re-stringify.
 */
export function buildSignedRequestHeaders(input: {
  eventId: string;
  bodyJson: string;
  secret: string | null;
  nowIso?: string;
}): SignedRequestHeaders {
  if (typeof input.secret !== 'string' || input.secret.length === 0) {
    return { 'content-type': 'application/json' };
  }
  const timestamp = input.nowIso || new Date().toISOString();
  const canonical = buildCanonicalSigningString({
    eventId: input.eventId,
    timestamp,
    bodyJson: input.bodyJson,
  });
  const signature = signWebhookBody(input.secret, canonical);
  return {
    'content-type': 'application/json',
    'x-consultify-signature': signature,
    'x-consultify-signature-algorithm': 'HMAC-SHA256',
    'x-consultify-timestamp': timestamp,
    'x-consultify-event-id': input.eventId,
  };
}

// ============================================================================
// SCHEMA-TOLERANT GUARD
// ============================================================================

function isSchemaMissingError(error: unknown): boolean {
  const msg = String((error as any)?.message || '').toLowerCase();
  return (
    msg.includes('does not exist') ||
    msg.includes('no such table') ||
    msg.includes('no such column') ||
    msg.includes('relation')
  );
}

let warnedSubscriptionsTableMissing = false;
let warnedDispatchesTableMissing = false;

function warnSchemaOnce(table: 'subscriptions' | 'dispatches', error: unknown): void {
  if (table === 'subscriptions') {
    if (warnedSubscriptionsTableMissing) return;
    warnedSubscriptionsTableMissing = true;
    logger.warn(
      '[GovernanceAlerts] presentation_governance_alert_subscriptions table missing — alerts disabled until migration 762 runs',
      error
    );
  } else {
    if (warnedDispatchesTableMissing) return;
    warnedDispatchesTableMissing = true;
    logger.warn(
      '[GovernanceAlerts] presentation_governance_alert_dispatches table missing — dispatch audit disabled until migration 762 runs',
      error
    );
  }
}

// ============================================================================
// DB WRAPPERS
// ============================================================================

export async function listActiveSubscriptions(
  organizationId: string
): Promise<AlertSubscription[]> {
  if (!organizationId) return [];
  let rows: any[] | null = null;
  try {
    rows = (await dbAll(
      `SELECT id, organization_id, channel, target, min_severity, active, signing_secret
         FROM presentation_governance_alert_subscriptions
        WHERE organization_id = ? AND active = TRUE
        ORDER BY created_at ASC`,
      [organizationId]
    )) as any[];
  } catch (error) {
    if (isSchemaMissingError(error)) {
      // Either the table is missing (warn once + bail), or the
      // `signing_secret` column has not been added yet (migration 763
      // pending) — retry with the Sprint 8 column set.
      const msg = String((error as any)?.message || '').toLowerCase();
      if (msg.includes('signing_secret')) {
        try {
          rows = (await dbAll(
            `SELECT id, organization_id, channel, target, min_severity, active
               FROM presentation_governance_alert_subscriptions
              WHERE organization_id = ? AND active = TRUE
              ORDER BY created_at ASC`,
            [organizationId]
          )) as any[];
        } catch (retryError) {
          if (isSchemaMissingError(retryError)) {
            warnSchemaOnce('subscriptions', retryError);
            return [];
          }
          logger.warn('[GovernanceAlerts] listActiveSubscriptions retry failed', retryError);
          return [];
        }
      } else {
        warnSchemaOnce('subscriptions', error);
        return [];
      }
    } else {
      logger.warn('[GovernanceAlerts] listActiveSubscriptions failed', error);
      return [];
    }
  }
  return (rows || [])
    .map((row: any) => normalizeSubscriptionRow(row))
    .filter((sub): sub is AlertSubscription => sub !== null);
}

function normalizeSubscriptionRow(row: any): AlertSubscription | null {
  if (!row || typeof row.id !== 'string') return null;
  const channel = String(row.channel || '').toLowerCase();
  if (channel !== 'webhook' && channel !== 'email' && channel !== 'slack') return null;
  const minSeverity = String(row.min_severity || '');
  if (minSeverity !== 'BLOCKED_P0' && minSeverity !== 'BLOCKED_P1') return null;
  const signingSecret =
    typeof row.signing_secret === 'string' && row.signing_secret.length > 0
      ? row.signing_secret
      : null;
  return {
    id: String(row.id),
    organizationId: String(row.organization_id || ''),
    channel,
    target: String(row.target || ''),
    minSeverity,
    active: row.active === true || row.active === 1 || row.active === 'TRUE' || row.active === 't',
    signingSecret,
  };
}

export async function recordDispatch(
  input: RecordDispatchInput
): Promise<{ id: string }> {
  const id =
    typeof input.dispatchId === 'string' && input.dispatchId.length > 0
      ? input.dispatchId
      : uuidv4().replace(/-/g, '');
  const sentAt = input.status === 'sent' ? new Date().toISOString() : null;
  const signatureAlgorithm = input.signatureAlgorithm ?? null;
  const signaturePresent = input.signaturePresent === true;

  try {
    await dbRun(
      `INSERT INTO presentation_governance_alert_dispatches (
         id, subscription_id, organization_id, deck_id,
         from_verdict, to_verdict, channel, target_redacted,
         status, http_status, error_category, payload_json,
         signature_algorithm, signature_present,
         created_at, sent_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
      [
        id,
        input.subscriptionId,
        input.organizationId,
        input.deckId,
        input.fromVerdict,
        input.toVerdict,
        input.channel,
        input.targetRedacted,
        input.status,
        input.httpStatus ?? null,
        input.errorCategory ?? null,
        input.payload ? JSON.stringify(input.payload) : null,
        signatureAlgorithm,
        signaturePresent,
        sentAt,
      ]
    );
  } catch (error) {
    const msg = String((error as any)?.message || '').toLowerCase();
    const signatureColumnMissing =
      isSchemaMissingError(error) &&
      (msg.includes('signature_algorithm') || msg.includes('signature_present'));
    if (signatureColumnMissing) {
      // Migration 763 has not run yet — fall back to the Sprint 8 INSERT
      // shape so the dispatch audit row is still written.
      try {
        await dbRun(
          `INSERT INTO presentation_governance_alert_dispatches (
             id, subscription_id, organization_id, deck_id,
             from_verdict, to_verdict, channel, target_redacted,
             status, http_status, error_category, payload_json,
             created_at, sent_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
          [
            id,
            input.subscriptionId,
            input.organizationId,
            input.deckId,
            input.fromVerdict,
            input.toVerdict,
            input.channel,
            input.targetRedacted,
            input.status,
            input.httpStatus ?? null,
            input.errorCategory ?? null,
            input.payload ? JSON.stringify(input.payload) : null,
            sentAt,
          ]
        );
      } catch (fallbackError) {
        if (isSchemaMissingError(fallbackError)) {
          warnSchemaOnce('dispatches', fallbackError);
        } else {
          logger.warn('[GovernanceAlerts] recordDispatch fallback failed', fallbackError);
        }
      }
    } else if (isSchemaMissingError(error)) {
      warnSchemaOnce('dispatches', error);
    } else {
      logger.warn('[GovernanceAlerts] recordDispatch failed', error);
    }
  }

  // Best-effort subscription bookkeeping (ignore failures + missing columns).
  if (input.subscriptionId) {
    await touchSubscriptionLastDispatch(input.subscriptionId, input.status);
  }

  return { id };
}

let warnedSubscriptionTouchUnavailable = false;

async function touchSubscriptionLastDispatch(
  subscriptionId: string,
  status: RecordDispatchInput['status']
): Promise<void> {
  try {
    await dbRun(
      `UPDATE presentation_governance_alert_subscriptions
          SET last_dispatch_at = CURRENT_TIMESTAMP,
              last_dispatch_status = ?
        WHERE id = ?`,
      [status, subscriptionId]
    );
  } catch (error) {
    if (isSchemaMissingError(error)) {
      if (!warnedSubscriptionTouchUnavailable) {
        warnedSubscriptionTouchUnavailable = true;
        logger.warn(
          '[GovernanceAlerts] subscriptions.last_dispatch_* columns missing — skipping bookkeeping until migration 763 runs'
        );
      }
      return;
    }
    logger.warn('[GovernanceAlerts] touchSubscriptionLastDispatch failed', error);
  }
}

// ============================================================================
// ORCHESTRATOR
// ============================================================================

const FETCH_TIMEOUT_MS = 5_000;

function isDryRun(): boolean {
  return String(process.env.PRESENTATION_GOVERNANCE_ALERTS_DRY_RUN || '').toLowerCase() === 'true';
}

function hasFetch(): boolean {
  return typeof (globalThis as any).fetch === 'function';
}

function classifyFetchError(error: unknown): string {
  const msg = String((error as any)?.message || '').toLowerCase();
  if ((error as any)?.name === 'AbortError' || msg.includes('timeout') || msg.includes('aborted')) {
    return 'timeout';
  }
  if (msg.includes('network') || msg.includes('fetch failed')) return 'network';
  if (msg.includes('dns')) return 'dns';
  return 'unknown';
}

export async function dispatchAlertsForTransition(
  transition: AlertTransitionInput
): Promise<DispatchSummary> {
  const summary: DispatchSummary = {
    attempted: 0,
    sent: 0,
    failed: 0,
    suppressed: 0,
    dryRun: 0,
  };

  if (!transition || !transition.organizationId || !transition.toVerdict) return summary;

  const subscriptions = await listActiveSubscriptions(transition.organizationId);
  if (subscriptions.length === 0) return summary;

  const payload = buildAlertPayload(transition);
  const dryRun = isDryRun();
  const fetchAvailable = hasFetch();

  for (const sub of subscriptions) {
    summary.attempted += 1;
    const masked = maskTarget(sub.target);

    if (!shouldDispatch(sub, transition)) {
      summary.suppressed += 1;
      await recordDispatch({
        subscriptionId: sub.id,
        organizationId: transition.organizationId,
        deckId: transition.deckId,
        fromVerdict: transition.fromVerdict,
        toVerdict: transition.toVerdict,
        channel: sub.channel,
        targetRedacted: masked,
        status: 'suppressed',
        payload,
        signatureAlgorithm: null,
        signaturePresent: false,
      });
      continue;
    }

    // Pre-mint the dispatch row id so it can travel as
    // `x-consultify-event-id` AND be persisted on the audit row that
    // records this attempt.
    const dispatchId = uuidv4().replace(/-/g, '');

    if (sub.channel === 'email' || dryRun || !fetchAvailable) {
      summary.dryRun += 1;
      await recordDispatch({
        dispatchId,
        subscriptionId: sub.id,
        organizationId: transition.organizationId,
        deckId: transition.deckId,
        fromVerdict: transition.fromVerdict,
        toVerdict: transition.toVerdict,
        channel: sub.channel,
        targetRedacted: masked,
        status: 'dry_run',
        errorCategory:
          sub.channel === 'email'
            ? 'email_channel_stub_only'
            : !fetchAvailable
              ? 'fetch_unavailable'
              : 'env_dry_run',
        payload,
        signatureAlgorithm: null,
        signaturePresent: false,
      });
      continue;
    }

    const bodyJson = JSON.stringify(payload);
    const headers = buildSignedRequestHeaders({
      eventId: dispatchId,
      bodyJson,
      secret: sub.signingSecret ?? null,
    });
    const signed = typeof headers['x-consultify-signature'] === 'string';
    const signatureAlgorithm: 'HMAC-SHA256' | null = signed ? 'HMAC-SHA256' : null;

    try {
      const fetchFn = (globalThis as any).fetch as (
        input: any,
        init?: any
      ) => Promise<{ status: number; ok: boolean }>;
      const response = await fetchFn(sub.target, {
        method: 'POST',
        headers,
        body: bodyJson,
        signal:
          typeof (AbortSignal as any)?.timeout === 'function'
            ? (AbortSignal as any).timeout(FETCH_TIMEOUT_MS)
            : undefined,
      });
      const ok = response && response.status >= 200 && response.status < 300;
      if (ok) {
        summary.sent += 1;
        await recordDispatch({
          dispatchId,
          subscriptionId: sub.id,
          organizationId: transition.organizationId,
          deckId: transition.deckId,
          fromVerdict: transition.fromVerdict,
          toVerdict: transition.toVerdict,
          channel: sub.channel,
          targetRedacted: masked,
          status: 'sent',
          httpStatus: response.status,
          payload,
          signatureAlgorithm,
          signaturePresent: signed,
        });
      } else {
        summary.failed += 1;
        await recordDispatch({
          dispatchId,
          subscriptionId: sub.id,
          organizationId: transition.organizationId,
          deckId: transition.deckId,
          fromVerdict: transition.fromVerdict,
          toVerdict: transition.toVerdict,
          channel: sub.channel,
          targetRedacted: masked,
          status: 'failed',
          httpStatus: response?.status ?? null,
          errorCategory: 'non_2xx_status',
          payload,
          signatureAlgorithm,
          signaturePresent: signed,
        });
      }
    } catch (error) {
      summary.failed += 1;
      await recordDispatch({
        dispatchId,
        subscriptionId: sub.id,
        organizationId: transition.organizationId,
        deckId: transition.deckId,
        fromVerdict: transition.fromVerdict,
        toVerdict: transition.toVerdict,
        channel: sub.channel,
        targetRedacted: masked,
        status: 'failed',
        errorCategory: classifyFetchError(error),
        payload,
        signatureAlgorithm,
        signaturePresent: signed,
      });
    }
  }

  return summary;
}

// Re-export the schema guard so the route layer can share the same heuristics.
export const __internal = { isSchemaMissingError, normalizeSubscriptionRow };

// Silence unused-import warnings when only types are consumed.
void dbGet;
