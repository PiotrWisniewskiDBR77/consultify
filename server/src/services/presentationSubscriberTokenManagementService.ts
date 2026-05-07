/**
 * Presentation Subscriber Token Management Service (Sprint 14)
 *
 * Pure-logic + thin DB wrappers for the **admin token management** surface
 * over `presentation_governance_subscriber_tokens` (migration 765).
 *
 * Sprint 13 shipped the **issuance** half (one-time Bearer token bound to a
 * single subscription) and `validateToken` already honours
 * `revoked_at IS NOT NULL` as a 401. This service supplies the missing
 * admin-side **list** + **revoke** operations so the
 * `PresentationGovernanceAlertSubscriptionsView` can finally drive the
 * `revoked_at` / `revoked_reason` columns end-to-end.
 *
 * Two shapes leave this module:
 *
 *   1. `listSubscriberTokens` — read-only enumeration of the tokens issued
 *      against a single subscription, with a derived `status`
 *      (`active` | `expired` | `revoked`) computed via
 *      `classifyTokenStatus`. Token hashes are NEVER projected into the
 *      result; only the 8-char prefix appears.
 *   2. `revokeSubscriberToken` — irreversible flip of `revoked_at` +
 *      `revoked_reason`. Idempotent: revoking an already-revoked token
 *      returns `already_revoked` (with the existing row, not an error).
 *
 * Critical security invariants:
 *   - The service NEVER throws. Every code path returns a typed
 *     `{ status, ... }` envelope so the route layer can map outcomes to
 *     HTTP semantics deterministically.
 *   - The token `token_hash` column NEVER appears in any output; only
 *     `token_prefix` (first 8 chars of the raw token, recorded at
 *     issuance) is exposed for admin display.
 *   - Revocation is one-way. There is no `unrevoke`. Once a token has
 *     `revoked_at IS NOT NULL`, the subscriber endpoint already returns
 *     401 with `reason: 'token_revoked'` — see
 *     `presentationSubscriberDashboardService.validateToken`.
 *   - Reasons are validated (≥ 5 chars after trim, ≤ 500 chars) and
 *     persisted to `revoked_reason` so the audit trail records WHY the
 *     token was killed.
 */

import { all as dbAllReal, get as dbGetReal, run as dbRunReal } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface SubscriberTokenSummary {
  id: string;
  subscriptionId: string;
  organizationId: string;
  /** First 8 chars of the raw token (recorded at issuance). NOT the hash. */
  tokenPrefix: string;
  issuedBy: string | null;
  issuedAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  scope: Record<string, unknown>;
  status: 'active' | 'expired' | 'revoked';
}

export interface ListTokensInput {
  subscriptionId: string;
  organizationId: string;
  /** Default false — revoked rows are excluded unless explicitly requested. */
  includeRevoked?: boolean;
  /** Default 50, clamped to 1..200. */
  limit?: number;
}

export interface ListTokensOutput {
  status: 'ok' | 'subscription_not_found' | 'storage_error';
  tokens?: SubscriberTokenSummary[];
  reason?: string;
}

export interface RevokeTokenInput {
  tokenId: string;
  subscriptionId: string;
  organizationId: string;
  actorId?: string | null;
  /** Required. Trimmed; ≥ 5 chars and ≤ 500 chars after trim. */
  reason: string;
}

export interface RevokeTokenOutput {
  status: 'ok' | 'not_found' | 'already_revoked' | 'invalid_reason' | 'storage_error';
  token?: SubscriberTokenSummary;
  reason?: string;
}

/**
 * Optional dependency overrides for unit tests so the pure list/revoke
 * logic can run without a real Postgres/SQLite connection. The route
 * layer never passes overrides; production always uses the shared
 * `DbPromise` helpers.
 */
export interface ServiceOverrides {
  dbAll?: <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;
  dbGet?: <T = unknown>(sql: string, params?: unknown[]) => Promise<T | null>;
  dbRun?: (
    sql: string,
    params?: unknown[]
  ) => Promise<{ success: boolean; changes?: number; error?: string }>;
  now?: () => Date;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;
const MIN_REASON_LENGTH = 5;
const MAX_REASON_LENGTH = 500;

// ============================================================================
// PURE HELPERS
// ============================================================================

function isSchemaMissingError(error: unknown): boolean {
  const msg = String((error as { message?: unknown } | null)?.message ?? '').toLowerCase();
  return (
    msg.includes('does not exist') ||
    msg.includes('no such table') ||
    msg.includes('no such column') ||
    msg.includes('relation')
  );
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (value.length === 0) return null;
  return value;
}

function clampLimit(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_LIST_LIMIT;
  const n = Math.floor(value);
  if (n < 1) return 1;
  if (n > MAX_LIST_LIMIT) return MAX_LIST_LIMIT;
  return n;
}

function nowIsoFrom(overrides?: ServiceOverrides): string {
  const d = overrides?.now ? overrides.now() : new Date();
  return d.toISOString();
}

function safeParseScope(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string' && raw.length > 0) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Fall through — malformed JSON degrades to empty scope.
    }
  }
  return {};
}

/**
 * Derive the lifecycle bucket for a token row.
 *
 *   - `revoked_at !== null` → `revoked` (highest precedence; even if
 *     also expired, we surface revocation because that is the operator
 *     intent).
 *   - `expires_at < nowIso` → `expired`.
 *   - Otherwise → `active`.
 *
 * Pure: takes only the relevant timestamps and an optional `nowIso`
 * override (defaults to `new Date().toISOString()`). Useful for
 * deterministic unit tests.
 */
export function classifyTokenStatus(
  token: { expiresAt: string; revokedAt: string | null },
  nowIso?: string
): 'active' | 'expired' | 'revoked' {
  if (token.revokedAt) return 'revoked';
  const expires = Date.parse(String(token.expiresAt || ''));
  if (Number.isNaN(expires)) return 'active';
  const now = Date.parse(nowIso ?? new Date().toISOString());
  if (Number.isNaN(now)) return 'active';
  if (expires < now) return 'expired';
  return 'active';
}

export interface NormalizedReason {
  ok: boolean;
  reason: string;
  errors: string[];
}

/**
 * Validate + canonicalize an operator-supplied revocation reason.
 *
 * Rules:
 *   - Must be a string. Anything else → `errors: ['reason_required']`.
 *   - Trimmed. Must be ≥ 5 chars after trim → otherwise
 *     `errors: ['reason_too_short']`.
 *   - Truncated to 500 chars after trim.
 *
 * On the happy path returns `{ ok: true, reason: <trimmed/truncated>,
 * errors: [] }`. On any failure returns `{ ok: false, reason: '',
 * errors: [...] }`.
 */
export function normalizeRevocationReason(raw: unknown): NormalizedReason {
  const errors: string[] = [];
  if (typeof raw !== 'string') {
    return { ok: false, reason: '', errors: ['reason_required'] };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    errors.push('reason_required');
    return { ok: false, reason: '', errors };
  }
  if (trimmed.length < MIN_REASON_LENGTH) {
    errors.push('reason_too_short');
    return { ok: false, reason: '', errors };
  }
  const reason = trimmed.length > MAX_REASON_LENGTH ? trimmed.slice(0, MAX_REASON_LENGTH) : trimmed;
  return { ok: true, reason, errors: [] };
}

interface TokenRow {
  id: unknown;
  subscription_id: unknown;
  organization_id: unknown;
  token_prefix: unknown;
  issued_by: unknown;
  issued_at: unknown;
  expires_at: unknown;
  last_used_at: unknown;
  revoked_at: unknown;
  revoked_reason: unknown;
  scope: unknown;
}

function mapRowToSummary(row: TokenRow, nowIso: string): SubscriberTokenSummary {
  const expiresAt = asString(row.expires_at, '');
  const revokedAt = asStringOrNull(row.revoked_at);
  const status = classifyTokenStatus({ expiresAt, revokedAt }, nowIso);
  return {
    id: asString(row.id, ''),
    subscriptionId: asString(row.subscription_id, ''),
    organizationId: asString(row.organization_id, ''),
    tokenPrefix: asString(row.token_prefix, '').slice(0, 8),
    issuedBy: asStringOrNull(row.issued_by),
    issuedAt: asString(row.issued_at, ''),
    expiresAt,
    lastUsedAt: asStringOrNull(row.last_used_at),
    revokedAt,
    revokedReason: asStringOrNull(row.revoked_reason),
    scope: safeParseScope(row.scope),
    status,
  };
}

// ============================================================================
// SHARED LOAD: subscription ownership check
// ============================================================================

interface SubscriptionRowMin {
  id: unknown;
  organization_id: unknown;
}

async function ensureSubscriptionOwnership(
  subscriptionId: string,
  organizationId: string,
  overrides?: ServiceOverrides
): Promise<{ exists: boolean; schemaMissing: boolean }> {
  const dbGet = overrides?.dbGet || dbGetReal;
  try {
    const row = (await dbGet(
      `SELECT id, organization_id
         FROM presentation_governance_alert_subscriptions
        WHERE id = ? AND organization_id = ?`,
      [subscriptionId, organizationId]
    )) as SubscriptionRowMin | null;
    return { exists: row !== null && row !== undefined, schemaMissing: false };
  } catch (error) {
    if (isSchemaMissingError(error)) {
      return { exists: false, schemaMissing: true };
    }
    logger.warn('[SubscriberTokenManagement] ensureSubscriptionOwnership failed', error);
    return { exists: false, schemaMissing: false };
  }
}

// ============================================================================
// LIST TOKENS
// ============================================================================

/**
 * Enumerate the subscriber dashboard tokens issued for a given
 * subscription. The result is ordered to favour the operational view:
 *
 *   1. Revoked rows first, most-recently-revoked at the top
 *      (so abuse investigations land near the top).
 *   2. Then active/expired rows ordered by `issued_at` DESC (newest first).
 *
 * Behaviour:
 *   - Subscription must exist for the calling org → otherwise
 *     `subscription_not_found`.
 *   - `includeRevoked` defaults to `false`. Revoked rows are filtered
 *     server-side when omitted/false.
 *   - `limit` defaults to 50 and is clamped to `1..200`.
 *   - Schema-tolerant: a missing migration 765 returns
 *     `{ status: 'storage_error', reason: 'migration_pending' }` so the
 *     route layer can map it to a 503 with a helpful hint instead of a
 *     generic 500.
 *
 * Never throws. Token hashes are NEVER projected into the SELECT — only
 * `token_prefix` reaches the result.
 */
export async function listSubscriberTokens(
  input: ListTokensInput,
  overrides?: ServiceOverrides
): Promise<ListTokensOutput> {
  if (!input || !input.subscriptionId || !input.organizationId) {
    return { status: 'subscription_not_found' };
  }

  const ownership = await ensureSubscriptionOwnership(
    input.subscriptionId,
    input.organizationId,
    overrides
  );
  if (ownership.schemaMissing) {
    return { status: 'storage_error', reason: 'migration_pending' };
  }
  if (!ownership.exists) {
    return { status: 'subscription_not_found' };
  }

  const includeRevoked = input.includeRevoked === true;
  const limit = clampLimit(input.limit);
  const dbAll = overrides?.dbAll || dbAllReal;
  const nowIso = nowIsoFrom(overrides);

  let rows: TokenRow[] = [];
  try {
    rows = (await dbAll(
      `SELECT id, subscription_id, organization_id, token_prefix, issued_by,
              issued_at, expires_at, last_used_at, revoked_at, revoked_reason,
              scope
         FROM presentation_governance_subscriber_tokens
        WHERE subscription_id = ? AND organization_id = ?`,
      [input.subscriptionId, input.organizationId]
    )) as TokenRow[];
  } catch (error) {
    if (isSchemaMissingError(error)) {
      return { status: 'storage_error', reason: 'migration_pending' };
    }
    logger.warn('[SubscriberTokenManagement] listSubscriberTokens select failed', error);
    return { status: 'storage_error', reason: 'load_failed' };
  }

  if (!Array.isArray(rows)) rows = [];

  const filtered = includeRevoked
    ? rows
    : rows.filter((r) => asStringOrNull(r.revoked_at) === null);

  const summaries = filtered
    .map((row) => mapRowToSummary(row, nowIso))
    .sort((a, b) => {
      const aRevoked = a.status === 'revoked';
      const bRevoked = b.status === 'revoked';
      if (aRevoked !== bRevoked) return aRevoked ? -1 : 1;
      if (aRevoked && bRevoked) {
        return (Date.parse(b.revokedAt || '') || 0) - (Date.parse(a.revokedAt || '') || 0);
      }
      return (Date.parse(b.issuedAt || '') || 0) - (Date.parse(a.issuedAt || '') || 0);
    })
    .slice(0, limit);

  return { status: 'ok', tokens: summaries };
}

// ============================================================================
// REVOKE TOKEN
// ============================================================================

/**
 * Mark a single subscriber dashboard token as revoked.
 *
 * Behaviour:
 *   1. Validate `reason` via `normalizeRevocationReason`. Otherwise
 *      `invalid_reason`.
 *   2. Look up the row by `(id, subscription_id, organization_id)` —
 *      this is the ownership check; a token belonging to a different
 *      org/subscription must surface as `not_found`.
 *   3. If `revoked_at IS NOT NULL` → `already_revoked` (idempotent —
 *      the existing row summary is returned so the UI can render the
 *      current state without flashing an error).
 *   4. Otherwise UPDATE `revoked_at = now`, `revoked_reason = <trimmed>`,
 *      and best-effort merge `revoked_by = <actorId>` into the `scope`
 *      JSON envelope so the audit trail keeps a record of who killed
 *      the token.
 *
 * Never throws. The mutation is irreversible: there is no `unrevoke`
 * counterpart. The subscriber endpoint already enforces the read-side
 * 401 via `validateToken`'s `revoked_at IS NOT NULL` check; this
 * function is purely the write-side counterpart.
 */
export async function revokeSubscriberToken(
  input: RevokeTokenInput,
  overrides?: ServiceOverrides
): Promise<RevokeTokenOutput> {
  if (!input || !input.tokenId || !input.subscriptionId || !input.organizationId) {
    return { status: 'not_found' };
  }

  const normalized = normalizeRevocationReason(input.reason);
  if (!normalized.ok) {
    return {
      status: 'invalid_reason',
      reason: normalized.errors[0] || 'invalid_reason',
    };
  }

  const dbGet = overrides?.dbGet || dbGetReal;
  const dbRun = overrides?.dbRun || dbRunReal;
  const nowIso = nowIsoFrom(overrides);

  let row: TokenRow | null = null;
  try {
    row = (await dbGet(
      `SELECT id, subscription_id, organization_id, token_prefix, issued_by,
              issued_at, expires_at, last_used_at, revoked_at, revoked_reason,
              scope
         FROM presentation_governance_subscriber_tokens
        WHERE id = ? AND subscription_id = ? AND organization_id = ?`,
      [input.tokenId, input.subscriptionId, input.organizationId]
    )) as TokenRow | null;
  } catch (error) {
    if (isSchemaMissingError(error)) {
      return { status: 'storage_error', reason: 'migration_pending' };
    }
    logger.warn('[SubscriberTokenManagement] revokeSubscriberToken load failed', error);
    return { status: 'storage_error', reason: 'load_failed' };
  }

  if (!row) return { status: 'not_found' };

  if (asStringOrNull(row.revoked_at) !== null) {
    return {
      status: 'already_revoked',
      token: mapRowToSummary(row, nowIso),
    };
  }

  const actorId =
    typeof input.actorId === 'string' && input.actorId.length > 0 ? input.actorId : null;
  const scopePatchJson = JSON.stringify({ revoked_by: actorId });

  let runResult: { success: boolean; error?: string } = { success: false };
  try {
    runResult = await dbRun(
      `UPDATE presentation_governance_subscriber_tokens
          SET revoked_at = ?,
              revoked_reason = ?,
              scope = COALESCE(scope, '{}'::jsonb) || ?::jsonb
        WHERE id = ?
          AND subscription_id = ?
          AND organization_id = ?
          AND revoked_at IS NULL`,
      [
        nowIso,
        normalized.reason,
        scopePatchJson,
        input.tokenId,
        input.subscriptionId,
        input.organizationId,
      ]
    );
  } catch (error) {
    if (isSchemaMissingError(error)) {
      return { status: 'storage_error', reason: 'migration_pending' };
    }
    logger.warn('[SubscriberTokenManagement] revokeSubscriberToken update failed', error);
    return { status: 'storage_error', reason: 'update_failed' };
  }

  if (!runResult || runResult.success !== true) {
    if (
      runResult?.error &&
      /does not exist|no such table|no such column|relation/i.test(runResult.error)
    ) {
      return { status: 'storage_error', reason: 'migration_pending' };
    }
    return { status: 'storage_error', reason: runResult?.error || 'update_failed' };
  }

  // Compose the resulting summary in-memory so we don't need a second
  // round-trip. The `scope` merge is best-effort: if the DB driver
  // dialect does not understand the `||`/`::jsonb` syntax we still
  // return the canonical revoked view based on what we wrote.
  const updatedScope = {
    ...safeParseScope(row.scope),
    revoked_by: actorId,
  } as Record<string, unknown>;

  const summary: SubscriberTokenSummary = {
    id: asString(row.id, ''),
    subscriptionId: asString(row.subscription_id, ''),
    organizationId: asString(row.organization_id, ''),
    tokenPrefix: asString(row.token_prefix, '').slice(0, 8),
    issuedBy: asStringOrNull(row.issued_by),
    issuedAt: asString(row.issued_at, ''),
    expiresAt: asString(row.expires_at, ''),
    lastUsedAt: asStringOrNull(row.last_used_at),
    revokedAt: nowIso,
    revokedReason: normalized.reason,
    scope: updatedScope,
    status: 'revoked',
  };

  return { status: 'ok', token: summary };
}

// ============================================================================
// INTERNAL EXPORTS (test-only)
// ============================================================================

export const __internal = {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MIN_REASON_LENGTH,
  MAX_REASON_LENGTH,
  clampLimit,
  isSchemaMissingError,
  mapRowToSummary,
  safeParseScope,
};
