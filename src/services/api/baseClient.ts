/**
 * Base API Client
 * Core utilities for making API requests
 */

import { tokenService } from '../tokenService';

export const API_URL = '/api';

let correlationId = sessionStorage.getItem('correlationId');
if (!correlationId) {
  correlationId =
    Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  sessionStorage.setItem('correlationId', correlationId);
}

export const getHeaders = (): Record<string, string> => {
  const token = tokenService.getToken();
  return {
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
    'X-Correlation-ID': correlationId as string,
  };
};

/**
 * Wrapper for fetch that handles 401 with automatic token refresh
 */
export interface ApiRequestInit extends RequestInit {
  skipDefaultHeaders?: boolean;
}

export const fetchWithRetry = async (
  url: string,
  options: ApiRequestInit = {}
): Promise<Response> => {
  const { skipDefaultHeaders = false, ...requestOptions } = options;
  const headers = skipDefaultHeaders
    ? { ...((requestOptions.headers as Record<string, string>) || {}) }
    : { ...getHeaders(), ...((requestOptions.headers as Record<string, string>) || {}) };

  const doFetch = () =>
    fetch(url, { ...requestOptions, headers, credentials: options.credentials ?? 'include' });

  let res: Response;
  try {
    res = await doFetch();
  } catch (networkError: any) {
    // Retry once on network errors (e.g., proxy down, ECONNREFUSED)
    if (networkError?.name === 'TypeError' || networkError?.message?.includes('Failed to fetch')) {
      await new Promise((r) => setTimeout(r, 1500));
      res = await doFetch();
    } else {
      throw networkError;
    }
  }

  const hasStoredAuth = Boolean(tokenService.getToken() || tokenService.getRefreshToken());

  // If 401, try to refresh token and retry once
  if (res.status === 401 && hasStoredAuth) {
    console.log('[Api] Got 401, attempting token refresh...');
    const newToken = await tokenService.refreshToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, {
        ...requestOptions,
        headers,
        credentials: options.credentials ?? 'include',
      });
    } else {
      window.dispatchEvent(new CustomEvent('auth:token-expired'));
    }
  }

  return res;
};

/**
 * Handle API response with error handling
 */
export const handleResponse = async <T = unknown>(
  res: Response,
  defaultError: string
): Promise<T> => {
  if (res.ok) {
    // Some endpoints return 204 No Content
    if (res.status === 204) return null as T;
    return res.json();
  }

  // Robust error parsing (some proxies return HTML / empty bodies for errors).
  const parsed = await (async () => {
    try {
      const clone = res.clone();
      const json = await clone.json();
      return { kind: 'json' as const, json };
    } catch {
      try {
        const text = await res.text();
        try {
          const json = JSON.parse(text);
          return { kind: 'json' as const, json };
        } catch {
          return { kind: 'text' as const, text };
        }
      } catch {
        return { kind: 'none' as const };
      }
    }
  })();

  const data = parsed.kind === 'json' ? parsed.json : {};

  // Check for Demo Block
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
    throw new Error(data.message || data.error || 'Action blocked in Demo Mode');
  }

  // Check for AI Budget Freeze
  if (res.status === 403 && data.code === 'AI_BUDGET_EXHAUSTED') {
    const { useAppStore } = await import('../../store/useAppStore');
    const store = useAppStore.getState();
    store.setAiFreezeStatus({
      isFrozen: true,
      reason: data.error,
      scope: data.budgetStatus?.scope || 'Global',
    });
    throw new Error(data.error || 'AI Budget Exhausted');
  }

  const fallbackHttp = `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`;
  const message = (data as any)?.error || (data as any)?.message || fallbackHttp || defaultError;

  const err: any = new Error(message);
  err.status = res.status;
  err.url = res.url;
  err.data = data;
  if (parsed.kind === 'text') err.bodyText = parsed.text;
  throw err;
};

/**
 * HTTP method helpers
 */
export const apiGet = async <T = unknown>(
  endpoint: string,
  defaultError = 'Request failed'
): Promise<T> => {
  const res = await fetchWithRetry(`${API_URL}${endpoint}`);
  return handleResponse<T>(res, defaultError);
};

type CachedGetEntry = {
  expiresAt: number;
  value?: unknown;
  inflight?: Promise<unknown>;
};

const cachedGetStore = new Map<string, CachedGetEntry>();

export const invalidateApiCacheByPrefix = (prefix: string): void => {
  for (const key of cachedGetStore.keys()) {
    if (key.startsWith(prefix)) {
      cachedGetStore.delete(key);
    }
  }
};

export const apiGetCached = async <T = unknown>(
  endpoint: string,
  ttlMs: number,
  defaultError = 'Request failed'
): Promise<T> => {
  const key = `${API_URL}${endpoint}`;
  const now = Date.now();
  const cached = cachedGetStore.get(key);

  if (cached?.value !== undefined && cached.expiresAt > now) {
    return cached.value as T;
  }

  if (cached?.inflight) {
    return cached.inflight as Promise<T>;
  }

  const inflight = (async () => {
    const res = await fetchWithRetry(key);
    const value = await handleResponse<T>(res, defaultError);
    cachedGetStore.set(key, {
      value,
      expiresAt: Date.now() + Math.max(0, ttlMs),
    });
    return value;
  })().catch((error) => {
    cachedGetStore.delete(key);
    throw error;
  });

  cachedGetStore.set(key, {
    value: cached?.value,
    expiresAt: cached?.expiresAt || 0,
    inflight,
  });

  return inflight;
};

export const apiPost = async <T = unknown>(
  endpoint: string,
  body: unknown,
  defaultError = 'Request failed'
): Promise<T> => {
  const res = await fetchWithRetry(`${API_URL}${endpoint}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res, defaultError);
};

export const apiPut = async <T = unknown>(
  endpoint: string,
  body: unknown,
  defaultError = 'Request failed'
): Promise<T> => {
  const res = await fetchWithRetry(`${API_URL}${endpoint}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res, defaultError);
};

export const apiPatch = async <T = unknown>(
  endpoint: string,
  body: unknown,
  defaultError = 'Request failed'
): Promise<T> => {
  const res = await fetchWithRetry(`${API_URL}${endpoint}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res, defaultError);
};

export const apiDelete = async <T = unknown>(
  endpoint: string,
  defaultError = 'Request failed'
): Promise<T> => {
  const res = await fetchWithRetry(`${API_URL}${endpoint}`, {
    method: 'DELETE',
  });
  return handleResponse<T>(res, defaultError);
};

// HTTP Client for convenience
export const httpClient = {
  get: apiGet,
  post: apiPost,
  put: apiPut,
  patch: apiPatch,
  delete: apiDelete,
};
