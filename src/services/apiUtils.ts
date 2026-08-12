import {
  dispatchAccessBlocked,
  getAccessBlockedCode,
  isAccessBlockedCode,
} from '../utils/accessBlocked';
import { tokenService } from './tokenService';

export const API_URL = '/api';

// RN-G6 P0 fix (F1): this header is sent to Results Next KPI/ROI/OKR write
// endpoints, which pass it through to `PlatformEventEnvelope.correlationId`
// and from there into `rvn_platform_events.correlation_id` — a Postgres
// `UUID NOT NULL` column (server/migrations/20260809_rvn_platform_events_outbox.sql).
// The previous generator (`Math.random().toString(36)...`) produced a token
// like "k3j9x2..." that is NOT a UUID, so every write on a fresh browser
// session failed with "invalid input syntax for type uuid" (500). Use the
// same UUID generator already used throughout this codebase (see
// `createIdempotencyKey.ts`, `kpiApi.ts`, `roiApi.ts`, `okrAdminApi.ts`, ...)
// instead of inventing a second one.
//
// A stored value from BEFORE this fix is still sitting in `sessionStorage`
// for any tab/session that was already open — reusing the old generator's
// output silently would keep those sessions broken forever. RESULTS_UUID_RE
// rejects anything that isn't UUID-shaped so a stale non-UUID value is
// discarded and replaced, not trusted.
const RESULTS_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function generateCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Defensive fallback for the rare environment without crypto.randomUUID
  // (e.g. non-HTTPS/non-localhost context) — still UUID-shaped, unlike the
  // generator this replaces.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let correlationId = sessionStorage.getItem('correlationId');
if (!correlationId || !RESULTS_UUID_RE.test(correlationId)) {
  correlationId = generateCorrelationId();
  sessionStorage.setItem('correlationId', correlationId);
}

export const getHeaders = () => {
  const token = tokenService.getToken();
  return {
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
    'X-Correlation-ID': correlationId as string,
  };
};

export const fetchWithRetry = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const headers = { ...getHeaders(), ...((options.headers as Record<string, string>) || {}) };
  let res = await fetch(url, { ...options, headers });
  const hasStoredAuth = Boolean(tokenService.getToken() || tokenService.getRefreshToken());

  if (res.status === 401 && hasStoredAuth) {
    console.log('[Api] Got 401, attempting token refresh...');
    const newToken = await tokenService.refreshToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, { ...options, headers });
    } else {
      window.dispatchEvent(new CustomEvent('auth:token-expired'));
    }
  }

  return res;
};

export const handleResponse = async (res: Response, defaultError: string) => {
  if (res.ok) {
    if (res.status === 204) return null;
    return res.json();
  }

  const data = await res.json().catch(() => ({}));

  if (
    res.status === 403 &&
    (data.code === 'DEMO_BLOCKED' || data.errorCode === 'DEMO_ACTION_BLOCKED')
  ) {
    window.dispatchEvent(
      new CustomEvent('DEMO_ACTION_BLOCKED', {
        detail: {
          message: data.message || data.error,
          action: data.action,
        },
      })
    );
    return null;
  }

  if (res.status === 403 && data.code === 'AI_BUDGET_EXHAUSTED') {
    const { useAppStore } = await import('../store/useAppStore');
    const store = useAppStore.getState();
    store.setAiFreezeStatus({
      isFrozen: true,
      reason: data.error,
      scope: data.budgetStatus?.scope || 'Global',
    });
    throw new Error(data.error || 'AI Budget Exhausted');
  }

  if (res.status === 403) {
    const code = getAccessBlockedCode(data);
    if (isAccessBlockedCode(code)) {
      dispatchAccessBlocked(data, data.error || data.message || defaultError);
      throw new Error(data.error || data.message || defaultError);
    }
  }

  const err = new Error(data.error || data.message || defaultError) as Error & {
    status?: number;
    code?: string;
    data?: unknown;
  };
  // Preserve HTTP status/code so callers can branch (e.g. 409 optimistic-lock
  // conflict) instead of only seeing a generic message.
  err.status = res.status;
  if (data?.code) err.code = data.code;
  if (data?.data !== undefined) err.data = data.data;
  throw err;
};

export const handleBlobResponse = async (res: Response, defaultError: string) => {
  if (res.ok) return res.blob();
  const data = await res.json().catch(() => ({}));
  throw new Error(data.error || data.message || defaultError);
};
