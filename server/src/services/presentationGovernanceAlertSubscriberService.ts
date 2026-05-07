/**
 * Presentation Governance Alert Subscriber Service (Sprint 11)
 *
 * Pure-logic + thin DB wrappers around the **subscriber-onboarding** flow for
 * `presentation_governance_alert_subscriptions`:
 *
 *   1. `rotateSubscriptionSecret` — generates a fresh HMAC-SHA256 secret,
 *      persists it (rotated_at + updated_at), and returns it ONCE so the
 *      SuperAdmin UI can present it to the operator. Subsequent reads of the
 *      subscription NEVER echo the secret back. The list/get endpoints
 *      (Sprint 8/9) only ever expose `targetRedacted`, never the raw target
 *      and never the secret.
 *
 *   2. `sendTestDelivery` — fires a synthetic `BLOCKED_P0`/`BLOCKED_P1`
 *      transition payload at the subscription's webhook with a fully signed
 *      body so the subscriber can verify their HMAC pipeline end-to-end. By
 *      design we DO NOT write a row to `presentation_governance_alert_dispatches`
 *      for these test fires — keeping the audit trail clean of synthetic
 *      data. The result is returned in-memory.
 *
 * Both functions never throw. They return a typed `{ status, ... }` envelope
 * so the route layer can map outcomes to HTTP semantics deterministically.
 *
 * DB access is dependency-injectable via the `_overrides` parameter so unit
 * tests can run without booting the real Postgres connection. In production
 * the service falls back to the shared `DbPromise` helpers used by the rest
 * of the alert subsystem.
 */

import { randomUUID } from 'node:crypto';

import { get as dbGetReal, run as dbRunReal } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

import {
  buildAlertPayload,
  buildSignedRequestHeaders,
  generateSigningSecret,
  maskTarget,
  type AlertSeverity,
} from './presentationGovernanceAlertService.js';
import {
  generateRawToken,
  hashToken,
} from './presentationSubscriberDashboardService.js';

// ============================================================================
// TYPES
// ============================================================================

export interface RotateSecretInput {
  subscriptionId: string;
  organizationId: string;
}

export interface RotateSecretSubscriptionView {
  id: string;
  organizationId: string;
  channel: 'webhook' | 'email' | 'slack';
  targetRedacted: string;
  minSeverity: AlertSeverity;
}

export interface RotateSecretResult {
  status: 'ok' | 'not_found' | 'inactive';
  subscription?: RotateSecretSubscriptionView;
  /** 64 hex chars; ONLY returned on success. */
  oneTimeSecret?: string;
}

export interface TestDeliveryInput {
  subscriptionId: string;
  organizationId: string;
  syntheticDeckId?: string;
  syntheticVerdict?: AlertSeverity;
}

export interface TestDeliveryPayloadPreview {
  eventId: string;
  toVerdict: AlertSeverity;
  deckId: string;
  generatedAt: string;
}

export type TestDeliveryStatus =
  | 'ok'
  | 'not_found'
  | 'unsigned'
  | 'fetch_unavailable'
  | 'http_error'
  | 'network_error'
  | 'inactive';

export interface TestDeliveryResult {
  status: TestDeliveryStatus;
  attempted: boolean;
  signed: boolean;
  httpStatus?: number;
  errorCategory?: string;
  /** First 12 hex chars of the HMAC + `'...'` — never the full signature. */
  signaturePreview?: string;
  payloadPreview?: TestDeliveryPayloadPreview;
  durationMs?: number;
}

/**
 * Minimal row shape returned by the subscription SELECT used here. We
 * intentionally do NOT depend on the `AlertSubscription` interface from the
 * Sprint 8 service because that type masks the active flag (it filters out
 * inactive rows server-side); we need to distinguish `not_found` from
 * `inactive` at this layer.
 */
interface SubscriptionRow {
  id: string;
  organization_id: string;
  channel: string;
  target: string;
  min_severity: string;
  active: unknown;
  signing_secret: string | null;
}

/**
 * Optional overrides used by unit tests so the pure rotate/test logic can
 * run without a real DB or live network. The route layer never passes
 * overrides; production always uses the real `DbPromise` + global `fetch`.
 */
export interface ServiceOverrides {
  dbGet?: <T = unknown>(sql: string, params?: unknown[]) => Promise<T | null>;
  dbRun?: (
    sql: string,
    params?: unknown[]
  ) => Promise<{ success: boolean; changes?: number; error?: string }>;
  fetch?: typeof fetch;
  now?: () => Date;
}

// ============================================================================
// PURE HELPERS
// ============================================================================

/**
 * Truncate a hex signature to a safe preview. Returns the original string if
 * it is shorter than 12 chars (so we never reveal the full short signature
 * by accident — but in practice HMAC-SHA256 hex is always 64 chars).
 */
export function previewSignature(hex: string): string {
  if (typeof hex !== 'string') return '';
  if (hex.length < 12) return hex;
  return hex.slice(0, 12) + '...';
}

const VALID_SEVERITIES = new Set<AlertSeverity>(['BLOCKED_P0', 'BLOCKED_P1']);

function normalizeActive(value: unknown): boolean {
  return value === true || value === 1 || value === 'TRUE' || value === 't' || value === 'true';
}

function normalizeChannel(value: unknown): 'webhook' | 'email' | 'slack' | null {
  const lc = String(value || '').toLowerCase();
  if (lc === 'webhook' || lc === 'email' || lc === 'slack') return lc;
  return null;
}

function normalizeSeverity(value: unknown): AlertSeverity {
  const s = String(value || '');
  if (VALID_SEVERITIES.has(s as AlertSeverity)) return s as AlertSeverity;
  return 'BLOCKED_P0';
}

function isSchemaMissingError(error: unknown): boolean {
  const msg = String((error as any)?.message || '').toLowerCase();
  return (
    msg.includes('does not exist') ||
    msg.includes('no such table') ||
    msg.includes('no such column') ||
    msg.includes('relation')
  );
}

function nowIso(overrides?: ServiceOverrides): string {
  const d = overrides?.now ? overrides.now() : new Date();
  return d.toISOString();
}

// ============================================================================
// SHARED LOAD
// ============================================================================

async function loadSubscriptionRow(
  subscriptionId: string,
  organizationId: string,
  overrides?: ServiceOverrides
): Promise<SubscriptionRow | null> {
  const dbGet = overrides?.dbGet || dbGetReal;
  try {
    const row = (await dbGet(
      `SELECT id, organization_id, channel, target, min_severity, active, signing_secret
         FROM presentation_governance_alert_subscriptions
        WHERE id = ? AND organization_id = ?`,
      [subscriptionId, organizationId]
    )) as SubscriptionRow | null;
    return row || null;
  } catch (error) {
    // Schema not yet migrated → treat as not_found (caller maps to 404). We
    // intentionally swallow here so the SuperAdmin UI shows an honest
    // "subscription not found" instead of a 500.
    if (isSchemaMissingError(error)) return null;
    logger.warn('[GovAlertSubscriber] loadSubscriptionRow failed', error);
    return null;
  }
}

// ============================================================================
// ROTATE SECRET
// ============================================================================

/**
 * Generate a fresh HMAC-SHA256 secret, persist it on the subscription row,
 * and return it ONCE. This is the only place in the system the raw secret
 * leaves the database — every other read path (list, get, watchlist) emits
 * `targetRedacted` but never the secret.
 *
 * Inactive subscriptions deliberately cannot be rotated: deactivating is
 * an archival action and we don't want stale secrets lingering on rows the
 * operator has already turned off.
 */
export async function rotateSubscriptionSecret(
  input: RotateSecretInput,
  overrides?: ServiceOverrides
): Promise<RotateSecretResult> {
  if (!input || !input.subscriptionId || !input.organizationId) {
    return { status: 'not_found' };
  }
  const dbRun = overrides?.dbRun || dbRunReal;

  const row = await loadSubscriptionRow(
    input.subscriptionId,
    input.organizationId,
    overrides
  );
  if (!row) return { status: 'not_found' };
  if (!normalizeActive(row.active)) return { status: 'inactive' };

  const channel = normalizeChannel(row.channel);
  if (!channel) return { status: 'not_found' };

  const oneTimeSecret = generateSigningSecret();
  const rotatedAt = nowIso(overrides);

  try {
    await dbRun(
      `UPDATE presentation_governance_alert_subscriptions
          SET signing_secret = ?,
              signing_secret_rotated_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND organization_id = ?`,
      [oneTimeSecret, input.subscriptionId, input.organizationId]
    );
  } catch (error) {
    logger.warn('[GovAlertSubscriber] rotateSubscriptionSecret update failed', error);
    return { status: 'not_found' };
  }

  return {
    status: 'ok',
    subscription: {
      id: row.id,
      organizationId: row.organization_id,
      channel,
      targetRedacted: maskTarget(row.target),
      minSeverity: normalizeSeverity(row.min_severity),
    },
    oneTimeSecret,
  };
}

// ============================================================================
// TEST DELIVERY
// ============================================================================

const TEST_DELIVERY_TIMEOUT_MS = 5_000;

/**
 * Fire a one-shot signed POST at the subscription's target so the operator
 * can verify the receiving end's signature pipeline. We never mutate the
 * dispatch audit table for these synthetic fires — the audit log stays
 * clean of test traffic. We ALSO refuse to fire when the subscription has
 * no signing secret yet (returns `'unsigned'`): an unsigned test would
 * mislead the subscriber into trusting a payload that production traffic
 * would never produce.
 */
export async function sendTestDelivery(
  input: TestDeliveryInput,
  overrides?: ServiceOverrides
): Promise<TestDeliveryResult> {
  if (!input || !input.subscriptionId || !input.organizationId) {
    return { status: 'not_found', attempted: false, signed: false };
  }

  const row = await loadSubscriptionRow(
    input.subscriptionId,
    input.organizationId,
    overrides
  );
  if (!row) return { status: 'not_found', attempted: false, signed: false };
  if (!normalizeActive(row.active)) {
    return { status: 'inactive', attempted: false, signed: false };
  }

  const generatedAt = nowIso(overrides);
  const toVerdict: AlertSeverity = VALID_SEVERITIES.has(
    (input.syntheticVerdict as AlertSeverity) || ('' as AlertSeverity)
  )
    ? (input.syntheticVerdict as AlertSeverity)
    : 'BLOCKED_P0';
  const deckId =
    typeof input.syntheticDeckId === 'string' && input.syntheticDeckId.trim().length > 0
      ? input.syntheticDeckId.trim()
      : 'test-deck';

  const payload = buildAlertPayload({
    deckId,
    deckTitle: 'Synthetic Test',
    fromVerdict: 'PASS',
    toVerdict,
    organizationId: input.organizationId,
    generatedAt,
  });
  const bodyJson = JSON.stringify(payload);
  const eventId = `test_${Date.now()}`;

  if (!row.signing_secret || row.signing_secret.length === 0) {
    return {
      status: 'unsigned',
      attempted: false,
      signed: false,
      payloadPreview: { eventId, toVerdict, deckId, generatedAt },
    };
  }

  const headers = buildSignedRequestHeaders({
    eventId,
    bodyJson,
    secret: row.signing_secret,
    nowIso: generatedAt,
  });
  const signature = headers['x-consultify-signature'] || '';
  const signaturePreview = previewSignature(signature);
  const payloadPreview: TestDeliveryPayloadPreview = {
    eventId,
    toVerdict,
    deckId,
    generatedAt,
  };

  const fetchFn = overrides?.fetch || (globalThis as any).fetch;
  if (typeof fetchFn !== 'function') {
    return {
      status: 'fetch_unavailable',
      attempted: false,
      signed: true,
      signaturePreview,
      payloadPreview,
    };
  }

  // Email/slack channels currently piggyback on the same outbound fetch
  // path here because we want admins to be able to verify webhook-shaped
  // payloads even when the subscription is registered as a future-channel.
  // The production dispatcher in `presentationGovernanceAlertService`
  // handles channel-specific gating; this is a SuperAdmin-only diagnostic.
  const startedAt = Date.now();
  try {
    const response = await fetchFn(row.target, {
      method: 'POST',
      headers,
      body: bodyJson,
      signal:
        typeof (AbortSignal as any)?.timeout === 'function'
          ? (AbortSignal as any).timeout(TEST_DELIVERY_TIMEOUT_MS)
          : undefined,
    });
    const durationMs = Date.now() - startedAt;
    const httpStatus =
      typeof (response as any)?.status === 'number' ? (response as any).status : undefined;
    const ok = httpStatus !== undefined && httpStatus >= 200 && httpStatus < 300;

    if (ok) {
      return {
        status: 'ok',
        attempted: true,
        signed: true,
        httpStatus,
        signaturePreview,
        payloadPreview,
        durationMs,
      };
    }
    return {
      status: 'http_error',
      attempted: true,
      signed: true,
      httpStatus,
      errorCategory: 'non_2xx_status',
      signaturePreview,
      payloadPreview,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    return {
      status: 'network_error',
      attempted: true,
      signed: true,
      errorCategory:
        (error as any)?.name === 'AbortError' || /timeout|aborted/i.test(String((error as any)?.message || ''))
          ? 'timeout'
          : 'fetch_failed',
      signaturePreview,
      payloadPreview,
      durationMs,
    };
  }
}

// ============================================================================
// SUBSCRIBER DASHBOARD TOKEN ISSUANCE (Sprint 13)
// ============================================================================

export interface IssueDashboardTokenInput {
  subscriptionId: string;
  organizationId: string;
  /** Clamped to 1..90 inclusive. Defaults to 30. */
  ttlDays?: number;
  issuedBy?: string;
}

export interface IssueDashboardTokenOutput {
  status: 'ok' | 'subscription_not_found' | 'subscription_inactive' | 'storage_error';
  /** 64 hex chars; ONLY returned on success. Never re-derivable. */
  oneTimeToken?: string;
  tokenId?: string;
  expiresAt?: string;
  reason?: string;
}

const DEFAULT_TOKEN_TTL_DAYS = 30;
const MIN_TOKEN_TTL_DAYS = 1;
const MAX_TOKEN_TTL_DAYS = 90;

function clampTtlDays(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_TOKEN_TTL_DAYS;
  const rounded = Math.round(value);
  if (rounded < MIN_TOKEN_TTL_DAYS) return MIN_TOKEN_TTL_DAYS;
  if (rounded > MAX_TOKEN_TTL_DAYS) return MAX_TOKEN_TTL_DAYS;
  return rounded;
}

/**
 * Issue a one-time subscriber dashboard token.
 *
 * Behaviour:
 *   1. Verify the subscription exists and is active for `organizationId`.
 *   2. Generate a 64-hex raw token, hash it (sha256), and INSERT a row in
 *      `presentation_governance_subscriber_tokens` with `expires_at = now()
 *      + ttlDays days` (default 30, clamped 1..90).
 *   3. Return the raw token EXACTLY ONCE. The hash is never exposed
 *      externally. The route layer is responsible for handing the raw
 *      token to the admin out-of-band.
 *   4. On any DB error → `storage_error`. On missing/inactive subscription
 *      → `subscription_not_found` / `subscription_inactive`. The function
 *      never throws.
 */
export async function issueSubscriberDashboardToken(
  input: IssueDashboardTokenInput,
  overrides?: ServiceOverrides
): Promise<IssueDashboardTokenOutput> {
  if (!input || !input.subscriptionId || !input.organizationId) {
    return { status: 'subscription_not_found' };
  }
  const dbRun = overrides?.dbRun || dbRunReal;
  const dbGet = overrides?.dbGet || dbGetReal;

  let row: SubscriptionRow | null = null;
  try {
    row = (await dbGet(
      `SELECT id, organization_id, channel, target, min_severity, active, signing_secret
         FROM presentation_governance_alert_subscriptions
        WHERE id = ? AND organization_id = ?`,
      [input.subscriptionId, input.organizationId]
    )) as SubscriptionRow | null;
  } catch (error) {
    if (isSchemaMissingError(error)) {
      return { status: 'storage_error', reason: 'schema_missing' };
    }
    logger.warn('[GovAlertSubscriber] issueSubscriberDashboardToken load failed', error);
    return { status: 'storage_error', reason: 'load_failed' };
  }

  if (!row) return { status: 'subscription_not_found' };
  if (!normalizeActive(row.active)) return { status: 'subscription_inactive' };

  const ttlDays = clampTtlDays(input.ttlDays);
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const tokenPrefix = rawToken.slice(0, 8);
  const tokenId = randomUUID();
  const issuedBy = input.issuedBy || null;
  const issuedAtDate = overrides?.now ? overrides.now() : new Date();
  const expiresAtDate = new Date(issuedAtDate.getTime() + ttlDays * 24 * 60 * 60 * 1000);
  const expiresAt = expiresAtDate.toISOString();

  let runResult: { success: boolean; error?: string } = { success: false };
  try {
    runResult = await dbRun(
      `INSERT INTO presentation_governance_subscriber_tokens (
         id, subscription_id, organization_id, token_hash, token_prefix,
         issued_by, expires_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        tokenId,
        input.subscriptionId,
        input.organizationId,
        tokenHash,
        tokenPrefix,
        issuedBy,
        expiresAt,
      ]
    );
  } catch (error) {
    if (isSchemaMissingError(error)) {
      return { status: 'storage_error', reason: 'schema_missing' };
    }
    logger.warn('[GovAlertSubscriber] issueSubscriberDashboardToken insert failed', error);
    return { status: 'storage_error', reason: 'insert_failed' };
  }

  if (!runResult || runResult.success !== true) {
    if (
      runResult?.error &&
      /does not exist|no such table|no such column|relation/i.test(runResult.error)
    ) {
      return { status: 'storage_error', reason: 'schema_missing' };
    }
    return { status: 'storage_error', reason: runResult?.error || 'insert_failed' };
  }

  return {
    status: 'ok',
    oneTimeToken: rawToken,
    tokenId,
    expiresAt,
  };
}

// ============================================================================
// INTERNAL EXPORTS (test-only, do not consume from production code)
// ============================================================================

export const __internal = {
  normalizeActive,
  normalizeChannel,
  normalizeSeverity,
  isSchemaMissingError,
  clampTtlDays,
};
