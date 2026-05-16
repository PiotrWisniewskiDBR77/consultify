/**
 * presentationSubscriberTokens
 *
 * Read/write client for the Sprint 14 admin-side subscriber-dashboard
 * token management surface. Wraps:
 *
 *   GET  /api/presentations/governance/alert-subscriptions/:id/dashboard-tokens
 *   POST /api/presentations/governance/alert-subscriptions/:id/dashboard-tokens/:tokenId/revoke
 *
 * Mirrors the Api/fetch fallback envelope used by
 * `presentationGovernanceAlertSubscriptions.ts` and ALWAYS resolves with
 * a `{ status, ... }` shape — never throws — so the SuperAdmin view can
 * render honest forbidden / unavailable / not_found / conflict banners.
 *
 * SECURITY: the server response NEVER includes a `token_hash`; only an
 * 8-char `tokenPrefix`. This client mirrors that contract strictly: any
 * `token_hash`/`tokenHash`-shaped field in the wire response is dropped
 * during normalization so it cannot accidentally reach a render path.
 */

import { Api } from '@/services/api';

export type TokenFetchStatus =
  | 'ok'
  | 'error'
  | 'forbidden'
  | 'unavailable'
  | 'not_found'
  | 'conflict';

export type TokenStatus = 'active' | 'expired' | 'revoked';

export interface ClientSubscriberTokenSummary {
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
  status: TokenStatus;
}

export interface ListDashboardTokensOptions {
  includeRevoked?: boolean;
  limit?: number;
}

export interface ListDashboardTokensResult {
  status: TokenFetchStatus;
  tokens?: ClientSubscriberTokenSummary[];
  error?: string;
}

export interface RevokeDashboardTokenResult {
  status: TokenFetchStatus;
  token?: ClientSubscriberTokenSummary;
  error?: string;
}

const VALID_TOKEN_STATUSES = new Set<TokenStatus>(['active', 'expired', 'revoked']);

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asTokenStatus(value: unknown): TokenStatus {
  const s = String(value || '');
  return VALID_TOKEN_STATUSES.has(s as TokenStatus) ? (s as TokenStatus) : 'active';
}

function normalizeScope(value: unknown): Record<string, unknown> {
  if (isRecord(value)) {
    // Defensive: drop any `token_hash`/`tokenHash`-shaped key if a future
    // backend regression accidentally surfaced it inside `scope`.
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'token_hash' || k === 'tokenHash') continue;
      out[k] = v;
    }
    return out;
  }
  return {};
}

function normalizeTokenSummary(raw: unknown): ClientSubscriberTokenSummary | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  return {
    id,
    subscriptionId: asString(raw.subscriptionId),
    organizationId: asString(raw.organizationId),
    tokenPrefix: asString(raw.tokenPrefix).slice(0, 8),
    issuedBy: asStringOrNull(raw.issuedBy),
    issuedAt: asString(raw.issuedAt),
    expiresAt: asString(raw.expiresAt),
    lastUsedAt: asStringOrNull(raw.lastUsedAt),
    revokedAt: asStringOrNull(raw.revokedAt),
    revokedReason: asStringOrNull(raw.revokedReason),
    scope: normalizeScope(raw.scope),
    status: asTokenStatus(raw.status),
  };
}

function statusFromHttp(code: number): TokenFetchStatus {
  if (code === 401) return 'error';
  if (code === 403) return 'forbidden';
  if (code === 404) return 'not_found';
  if (code === 409) return 'conflict';
  if (code === 503) return 'unavailable';
  return 'error';
}

function statusFromError(err: unknown): TokenFetchStatus {
  if (isRecord(err) && typeof err.status === 'number') {
    return statusFromHttp(err.status as number);
  }
  return 'unavailable';
}

function safeMessage(err: unknown): string | undefined {
  if (isRecord(err) && typeof err.message === 'string') return err.message;
  return undefined;
}

function unwrapData(payload: unknown): unknown {
  if (isRecord(payload) && 'data' in payload) {
    const inner = (payload as { data: unknown }).data;
    if (isRecord(inner) && 'data' in inner) {
      return (inner as { data: unknown }).data;
    }
    return inner;
  }
  return payload;
}

function getApiClient(): {
  get?: (url: string) => Promise<unknown>;
  post?: (url: string, data: unknown) => Promise<unknown>;
} {
  return Api as unknown as {
    get?: (url: string) => Promise<unknown>;
    post?: (url: string, data: unknown) => Promise<unknown>;
  };
}

// ----------------------------------------------------------------------------
// LIST
// ----------------------------------------------------------------------------

export async function listDashboardTokens(
  subscriptionId: string,
  opts: ListDashboardTokensOptions = {}
): Promise<ListDashboardTokensResult> {
  const safeId = encodeURIComponent(String(subscriptionId || '').trim());
  if (!safeId) return { status: 'error', error: 'subscription_id_required' };

  const params: string[] = [];
  if (opts.includeRevoked === true) params.push('includeRevoked=true');
  if (typeof opts.limit === 'number' && Number.isFinite(opts.limit)) {
    params.push(`limit=${Math.floor(opts.limit)}`);
  }
  const qs = params.length > 0 ? `?${params.join('&')}` : '';
  const path = `/presentations/governance/alert-subscriptions/${safeId}/dashboard-tokens${qs}`;
  const api = getApiClient();

  if (typeof api.get === 'function') {
    try {
      const res = await api.get(path);
      const data = unwrapData(res);
      if (!isRecord(data)) return { status: 'error', error: 'invalid_payload' };
      const rawTokens = Array.isArray(data.tokens) ? data.tokens : [];
      const tokens = rawTokens
        .map(normalizeTokenSummary)
        .filter((t): t is ClientSubscriberTokenSummary => t !== null);
      return { status: 'ok', tokens };
    } catch (err) {
      return { status: statusFromError(err), error: safeMessage(err) };
    }
  }

  try {
    const res = await fetch(`/api${path}`, { credentials: 'include' });
    if (!res.ok) {
      return { status: statusFromHttp(res.status), error: `http_${res.status}` };
    }
    const json: unknown = await res.json().catch(() => null);
    const data = unwrapData(json);
    if (!isRecord(data)) return { status: 'error', error: 'invalid_payload' };
    const rawTokens = Array.isArray(data.tokens) ? data.tokens : [];
    const tokens = rawTokens
      .map(normalizeTokenSummary)
      .filter((t): t is ClientSubscriberTokenSummary => t !== null);
    return { status: 'ok', tokens };
  } catch {
    return { status: 'unavailable', error: 'network_error' };
  }
}

// ----------------------------------------------------------------------------
// REVOKE
// ----------------------------------------------------------------------------

export async function revokeDashboardToken(
  subscriptionId: string,
  tokenId: string,
  reason: string
): Promise<RevokeDashboardTokenResult> {
  const safeSubId = encodeURIComponent(String(subscriptionId || '').trim());
  const safeTokenId = encodeURIComponent(String(tokenId || '').trim());
  if (!safeSubId || !safeTokenId) {
    return { status: 'error', error: 'id_required' };
  }
  const path = `/presentations/governance/alert-subscriptions/${safeSubId}/dashboard-tokens/${safeTokenId}/revoke`;
  const body = { reason: typeof reason === 'string' ? reason : '', confirm: true };
  const api = getApiClient();

  if (typeof api.post === 'function') {
    try {
      const res = await api.post(path, body);
      const data = unwrapData(res);
      if (!isRecord(data)) return { status: 'error', error: 'invalid_payload' };
      const token = normalizeTokenSummary(data.token);
      return { status: 'ok', ...(token ? { token } : {}) };
    } catch (err) {
      const status = statusFromError(err);
      return { status, error: safeMessage(err) };
    }
  }

  try {
    const res = await fetch(`/api${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return { status: statusFromHttp(res.status), error: `http_${res.status}` };
    }
    const json: unknown = await res.json().catch(() => null);
    const data = unwrapData(json);
    if (!isRecord(data)) return { status: 'error', error: 'invalid_payload' };
    const token = normalizeTokenSummary(data.token);
    return { status: 'ok', ...(token ? { token } : {}) };
  } catch {
    return { status: 'unavailable', error: 'network_error' };
  }
}
