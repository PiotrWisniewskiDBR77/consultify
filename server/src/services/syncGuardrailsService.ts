/**
 * Sync Guardrails Service (T008)
 *
 * Rate limiting, error handling, retry policy, and health monitoring
 * for integration sync operations.
 */
import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';
import _logger from '../utils/Logger.js';

// ── Types ──────────────────────────────────────────────────────

export type SyncErrorType =
  | 'AUTH'
  | 'RATE_LIMIT'
  | 'NETWORK'
  | 'VALIDATION'
  | 'PROVIDER'
  | 'UNKNOWN';

export interface RateLimitStatus {
  integrationId: string;
  provider: string;
  requestCount: number;
  maxRequests: number;
  isThrottled: boolean;
  windowMinutes: number;
  resetAt: string;
}

export interface SyncError {
  id: string;
  integrationId: string;
  errorType: SyncErrorType;
  errorCode: string | null;
  errorMessage: string;
  isRetryable: boolean;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: string | null;
  createdAt: string;
}

export interface GuardrailCheckResult {
  allowed: boolean;
  reason?: string;
  retryAfterMs?: number;
  warnings: string[];
}

// Provider-specific rate limits (requests per hour)
const PROVIDER_RATE_LIMITS: Record<string, number> = {
  slack: 120,
  jira: 100,
  asana: 150,
  google_calendar: 100,
  google_drive: 100,
  gmail: 50,
  teams: 120,
  monday: 200,
  hubspot: 100,
  salesforce: 100,
  default: 60,
};

const RETRY_BACKOFF_BASE_MS = 5000;
const MAX_RETRY_DELAY_MS = 300000; // 5 minutes

// ── Rate Limiting ──────────────────────────────────────────────

export async function checkRateLimit(
  organizationId: string,
  integrationId: string,
  provider: string
): Promise<GuardrailCheckResult> {
  const maxRequests = PROVIDER_RATE_LIMITS[provider] || PROVIDER_RATE_LIMITS.default;
  const warnings: string[] = [];

  try {
    const windowStart = new Date(Date.now() - 60 * 60 * 1000); // 1 hour window

    const rows = (await dbAll(
      `SELECT request_count, max_requests, is_throttled, window_start
       FROM sync_rate_limits
       WHERE integration_id = ? AND window_start > ?
       ORDER BY window_start DESC LIMIT 1`,
      [integrationId, windowStart.toISOString()]
    )) as Array<{
      request_count: number;
      max_requests: number;
      is_throttled: boolean;
      window_start: string;
    }> | null;

    const current = rows?.[0];

    if (current && current.is_throttled) {
      return {
        allowed: false,
        reason: `Rate limited: ${current.request_count}/${maxRequests} requests in current window`,
        retryAfterMs: 60000,
        warnings: ['Rate limit exceeded. Wait before retrying.'],
      };
    }

    if (current && current.request_count >= maxRequests) {
      await dbRun(
        `UPDATE sync_rate_limits SET is_throttled = TRUE WHERE integration_id = ? AND window_start = ?`,
        [integrationId, current.window_start]
      );
      return {
        allowed: false,
        reason: `Rate limit reached: ${maxRequests} requests/hour for ${provider}`,
        retryAfterMs: 60000,
        warnings: [`Rate limit: ${current.request_count}/${maxRequests}`],
      };
    }

    if (current && current.request_count >= maxRequests * 0.8) {
      warnings.push(
        `Approaching rate limit: ${current.request_count}/${maxRequests} (${Math.round((current.request_count / maxRequests) * 100)}%)`
      );
    }

    return { allowed: true, warnings };
  } catch (err) {
    _logger.error('Rate limit check failed', err);
    return { allowed: true, warnings: ['Rate limit check unavailable'] };
  }
}

export async function recordRequest(
  organizationId: string,
  integrationId: string,
  provider: string
): Promise<void> {
  const maxRequests = PROVIDER_RATE_LIMITS[provider] || PROVIDER_RATE_LIMITS.default;
  const windowStart = new Date();
  windowStart.setMinutes(0, 0, 0); // Align to hour boundary

  try {
    await dbRun(
      `INSERT INTO sync_rate_limits (id, organization_id, integration_id, provider, window_start, window_minutes, request_count, max_requests, last_request_at)
       VALUES (gen_random_uuid()::TEXT, ?, ?, ?, ?, 60, 1, ?, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [organizationId, integrationId, provider, windowStart.toISOString(), maxRequests]
    );

    await dbRun(
      `UPDATE sync_rate_limits
       SET request_count = request_count + 1, last_request_at = NOW()
       WHERE integration_id = ? AND window_start = ?`,
      [integrationId, windowStart.toISOString()]
    );
  } catch {
    // non-blocking
  }
}

// ── Error Handling & Retry ─────────────────────────────────────

export function classifyError(error: Error | string): {
  type: SyncErrorType;
  isRetryable: boolean;
} {
  const msg = typeof error === 'string' ? error : error.message;
  const lower = msg.toLowerCase();

  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('invalid token')) {
    return { type: 'AUTH', isRetryable: false };
  }
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('too many')) {
    return { type: 'RATE_LIMIT', isRetryable: true };
  }
  if (lower.includes('timeout') || lower.includes('econnrefused') || lower.includes('network')) {
    return { type: 'NETWORK', isRetryable: true };
  }
  if (lower.includes('validation') || lower.includes('invalid') || lower.includes('400')) {
    return { type: 'VALIDATION', isRetryable: false };
  }
  if (lower.includes('500') || lower.includes('503') || lower.includes('server error')) {
    return { type: 'PROVIDER', isRetryable: true };
  }
  return { type: 'UNKNOWN', isRetryable: true };
}

export function calculateRetryDelay(retryCount: number): number {
  return Math.min(RETRY_BACKOFF_BASE_MS * Math.pow(2, retryCount), MAX_RETRY_DELAY_MS);
}

export async function logSyncError(
  organizationId: string,
  integrationId: string,
  error: Error | string,
  syncRunId?: string
): Promise<SyncError> {
  const { type, isRetryable } = classifyError(error);
  const msg = typeof error === 'string' ? error : error.message;

  const existing = (await dbAll(
    `SELECT id, retry_count FROM sync_error_log
     WHERE integration_id = ? AND error_type = ? AND resolved_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [integrationId, type]
  )) as Array<{ id: string; retry_count: number }> | null;

  const retryCount = existing?.[0]?.retry_count ? existing[0].retry_count + 1 : 0;
  const nextRetryAt =
    isRetryable && retryCount < 3
      ? new Date(Date.now() + calculateRetryDelay(retryCount)).toISOString()
      : null;

  const id = `se-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await dbRun(
    `INSERT INTO sync_error_log
       (id, organization_id, integration_id, sync_run_id, error_type, error_message, is_retryable, retry_count, max_retries, next_retry_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 3, ?)`,
    [
      id,
      organizationId,
      integrationId,
      syncRunId || null,
      type,
      msg,
      isRetryable,
      retryCount,
      nextRetryAt,
    ]
  );

  // Increment error count on integration
  await dbRun(
    `UPDATE integrations SET error_count = COALESCE(error_count, 0) + 1, updated_at = NOW() WHERE id = ?`,
    [integrationId]
  );

  return {
    id,
    integrationId,
    errorType: type,
    errorCode: null,
    errorMessage: msg,
    isRetryable,
    retryCount,
    maxRetries: 3,
    nextRetryAt,
    createdAt: new Date().toISOString(),
  };
}

export async function getUnresolvedErrors(
  organizationId: string,
  integrationId?: string
): Promise<SyncError[]> {
  let query = `
    SELECT id, integration_id, error_type, error_code, error_message,
           is_retryable, retry_count, max_retries, next_retry_at, created_at
    FROM sync_error_log
    WHERE organization_id = ? AND resolved_at IS NULL
  `;
  const params: unknown[] = [organizationId];

  if (integrationId) {
    query += ' AND integration_id = ?';
    params.push(integrationId);
  }
  query += ' ORDER BY created_at DESC LIMIT 50';

  const rows = ((await dbAll(query, params)) || []) as Array<{
    id: string;
    integration_id: string;
    error_type: string;
    error_code: string | null;
    error_message: string;
    is_retryable: boolean;
    retry_count: number;
    max_retries: number;
    next_retry_at: string | null;
    created_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    integrationId: r.integration_id,
    errorType: r.error_type as SyncErrorType,
    errorCode: r.error_code,
    errorMessage: r.error_message,
    isRetryable: r.is_retryable,
    retryCount: r.retry_count,
    maxRetries: r.max_retries,
    nextRetryAt: r.next_retry_at,
    createdAt: r.created_at,
  }));
}

export async function resolveError(errorId: string): Promise<void> {
  await dbRun(`UPDATE sync_error_log SET resolved_at = NOW() WHERE id = ?`, [errorId]);
}

// ── Health Check ───────────────────────────────────────────────

export interface IntegrationHealth {
  integrationId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  unresolvedErrors: number;
  lastSyncStatus: string | null;
  lastSyncAt: string | null;
  isThrottled: boolean;
  errorRate: number;
}

export async function getIntegrationHealth(
  organizationId: string,
  integrationId: string
): Promise<IntegrationHealth> {
  const errors = await getUnresolvedErrors(organizationId, integrationId);
  const rateCheck = await checkRateLimit(organizationId, integrationId, 'default');

  const recentRuns = (await dbAll(
    `SELECT status, started_at FROM integration_sync_runs
     WHERE integration_id = ? ORDER BY started_at DESC LIMIT 5`,
    [integrationId]
  )) as Array<{ status: string; started_at: string }> | null;

  const failedRecent = recentRuns?.filter((r) => r.status === 'failed').length || 0;
  const totalRecent = recentRuns?.length || 0;
  const errorRate = totalRecent > 0 ? failedRecent / totalRecent : 0;

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (errors.length > 3 || errorRate > 0.5) status = 'unhealthy';
  else if (errors.length > 0 || errorRate > 0.2) status = 'degraded';

  return {
    integrationId,
    status,
    unresolvedErrors: errors.length,
    lastSyncStatus: recentRuns?.[0]?.status || null,
    lastSyncAt: recentRuns?.[0]?.started_at || null,
    isThrottled: !rateCheck.allowed,
    errorRate: Math.round(errorRate * 100),
  };
}
