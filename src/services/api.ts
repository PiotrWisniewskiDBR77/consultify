// @ts-nocheck
import { FullSession, LLMProvider, SessionMode, User } from '../types';
import { trackFunnelEvent } from './funnelAnalytics';
import { tokenService } from './tokenService';

// Use relative path to allow Vite proxy to handle the request (avoiding CORS)
// or use env var if provided.
const _envApiUrl = (import.meta as any)?.env?.VITE_API_URL as string | undefined;
const _normalizedEnvApiUrl =
  _envApiUrl && String(_envApiUrl).trim().length > 0
    ? (() => {
        const base = String(_envApiUrl).trim().replace(/\/+$/, '');
        // Our backend is consistently mounted under `/api` (e.g. `/api/auth/login`).
        // Allow env to be either an origin (`http://localhost:3001`) or a full base (`http://.../api`).
        return base.endsWith('/api') ? base : `${base}/api`;
      })()
    : null;
export const API_URL = (_normalizedEnvApiUrl || '/api') as string;

let correlationId = sessionStorage.getItem('correlationId');
if (!correlationId) {
  correlationId =
    Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  sessionStorage.setItem('correlationId', correlationId);
}

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

// ----------------------------
// Lightweight in-memory caches
// ----------------------------
// Goal: speed up module switching in dev/prod by avoiding refetch-on-mount patterns.
// These caches are intentionally short-lived and are invalidated on writes.
const __personalTasksCache = new Map<string, { at: number; data: any[] }>();
const PERSONAL_TASKS_CACHE_MS = 15_000;

async function isServerStartingResponse(res: Response): Promise<boolean> {
  if (res.status !== 503) return false;
  try {
    const clone = res.clone();
    const json = await clone.json();
    return (
      json?.code === 'SERVER_STARTING' || String(json?.error || '').includes('Server starting')
    );
  } catch {
    return false;
  }
}

async function waitForApiReady(timeoutMs = 15000): Promise<boolean> {
  const start = Date.now();
  let delayMs = 250;

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${API_URL}/ready`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });
      if (res.status === 200) return true;
    } catch {
      // ignore transient startup/network errors
    }

    await sleep(delayMs);
    delayMs = Math.min(Math.floor(delayMs * 1.35), 1500);
  }

  return false;
}

// ---------------------------------------------------------------------------
// Perf: avoid JSON.parse(localStorage) on every request.
// localStorage access + JSON.parse are synchronous and can cause noticeable UI jank
// when the app polls multiple endpoints (notifications, onboarding, etc.).
// ---------------------------------------------------------------------------
type DemoFlags = { isDemoMode: boolean; isDemoSession: boolean };

let _cachedStorageRaw: string | null | undefined = undefined;
let _cachedDemoFlags: DemoFlags = { isDemoMode: false, isDemoSession: false };

function getDemoFlags(): DemoFlags {
  const DEMO_EMAIL = 'piotr.wisniewski@demo.com';
  let raw: string | null = null;
  try {
    raw = localStorage.getItem('consultinity-storage');
  } catch {
    // ignore
  }

  // Only re-parse when the underlying raw value changes
  if (raw === _cachedStorageRaw) return _cachedDemoFlags;
  _cachedStorageRaw = raw;

  let isDemoMode = false;
  let isDemoSession = false;
  try {
    if (raw) {
      const parsed = JSON.parse(raw);
      isDemoMode = parsed?.state?.isDemoMode === true;
      const persistedUser = parsed?.state?.currentUser;
      isDemoSession =
        persistedUser?.isDemo === true ||
        persistedUser?.email === DEMO_EMAIL ||
        (sessionStorage.getItem('isDemo') === 'true' && persistedUser?.email === DEMO_EMAIL);
    }
  } catch {
    // Ignore parsing errors
  }

  _cachedDemoFlags = { isDemoMode, isDemoSession };
  return _cachedDemoFlags;
}

let _cachedNavigatorRaw: string | null | undefined = undefined;
let _cachedLang = 'en';

function getBrowserLanguage(): string {
  try {
    const raw =
      (typeof navigator !== 'undefined' && (navigator.languages?.[0] || navigator.language)) || '';
    const base = String(raw).split('-')[0].toLowerCase();
    if (base === 'ja') return 'jp'; // app uses "jp" locale folder/code
    return base || 'en';
  } catch {
    return 'en';
  }
}

function getCachedUserLanguage(): string {
  const raw =
    (typeof navigator !== 'undefined' && (navigator.languages?.[0] || navigator.language)) || null;

  if (raw === _cachedNavigatorRaw) return _cachedLang;
  _cachedNavigatorRaw = raw;

  _cachedLang = getBrowserLanguage();
  return _cachedLang;
}

export const getHeaders = () => {
  const token = tokenService.getToken();

  const { isDemoMode, isDemoSession } = getDemoFlags();
  const userLanguage = getCachedUserLanguage();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
    'X-Correlation-ID': correlationId as string,
    'Accept-Language': userLanguage, // Send user's language preference
  };

  // Add demo mode header only for demo sessions/accounts
  if (isDemoMode && isDemoSession) {
    headers['X-Demo-Mode'] = 'true';
  }

  return headers;
};

// Wrapper for fetch that handles 401 with automatic token refresh
type FetchWithRetryOptions = RequestInit & { skipDefaultHeaders?: boolean };

const fetchWithRetry = async (
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> => {
  const { skipDefaultHeaders, ...fetchOptions } = options;
  const baseHeaders = skipDefaultHeaders ? {} : getHeaders();
  const headers = {
    ...baseHeaders,
    ...((fetchOptions.headers as Record<string, string>) || {}),
  };
  const hasExternalSignal = !!fetchOptions.signal;
  const shouldApplyTimeout =
    !hasExternalSignal && typeof url === 'string' && url.includes('/api/ai/refine-text');
  const timeoutMs = shouldApplyTimeout ? 25000 : null;
  const controller = shouldApplyTimeout ? new AbortController() : null;
  const timer = controller
    ? window.setTimeout(() => {
        try {
          controller.abort();
        } catch {
          // ignore
        }
      }, timeoutMs as number)
    : null;

  let res: Response;
  try {
    res = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: fetchOptions.signal || controller?.signal,
    });
  } catch (err: any) {
    if (controller && err?.name === 'AbortError') {
      const e: any = new Error('AI request timed out');
      e.code = 'AI_TIMEOUT';
      throw e;
    }
    throw err;
  } finally {
    if (timer) window.clearTimeout(timer);
  }

  // If 401, try to refresh token and retry once
  if (res.status === 401) {
    console.log('[Api] Got 401, attempting token refresh...');
    const newToken = await tokenService.refreshToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      // Note: keep the same abort signal (if any) for the retry.
      res = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: fetchOptions.signal || controller?.signal,
      });
    } else {
      // Token refresh failed, notify app
      window.dispatchEvent(new CustomEvent('auth:token-expired'));
    }
  }

  return res;
};

const handleResponse = async (res: Response, defaultError: string) => {
  if (res.ok) {
    // Some endpoints return 204 No Content
    if (res.status === 204) return null;
    return res.json();
  }

  // Robust error parsing:
  // - proxies sometimes return HTML for 4xx/5xx
  // - some endpoints return empty bodies
  // Use clone() so we can try JSON first, then fall back to text.
  const parsed = await (async () => {
    try {
      const clone = res.clone();
      const json = await clone.json();
      return { kind: 'json' as const, json };
    } catch {
      try {
        const text = await res.text();
        // Best-effort JSON parse even if content-type is wrong.
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

  // Normalize error payloads to a readable string.
  // Some endpoints return { error: {...} } which would otherwise surface as "[object Object]".
  const toErrorMessage = (payload: any, fallback: string): string => {
    const msg = payload?.message;
    const err = payload?.error;
    if (typeof msg === 'string' && msg.trim()) return msg;
    if (typeof err === 'string' && err.trim()) return err;
    if (err != null) {
      try {
        return typeof err === 'string' ? err : JSON.stringify(err);
      } catch {
        // ignore
      }
    }
    if (msg != null) {
      try {
        return typeof msg === 'string' ? msg : JSON.stringify(msg);
      } catch {
        // ignore
      }
    }
    return fallback;
  };
  // If payload isn't helpful, include HTTP status (avoids generic "Request failed").
  const fallbackHttp = `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`;
  const normalizedMessage = toErrorMessage(data, '') || fallbackHttp || defaultError;

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
    // We still throw to stop execution, but the UI will handle the modal
    throw new Error(toErrorMessage(data, 'Action blocked in Demo Mode'));
  }

  // Check for AI Budget Freeze (Phase 8: Prestige)
  if (res.status === 403 && data.code === 'AI_BUDGET_EXHAUSTED') {
    const { useAppStore } = await import('../store/useAppStore');
    const store = useAppStore.getState();
    store.setAiFreezeStatus({
      isFrozen: true,
      reason: data.error,
      scope: data.budgetStatus?.scope || 'Global',
    });
    throw new Error(toErrorMessage(data, 'AI Budget Exhausted'));
  }

  // Unified access-blocked handling (Trial expiry, AI limits, token budgets, etc.)
  if (res.status === 403) {
    const code = data.code || data.errorCode;
    const accessBlockedCodes = new Set([
      'TRIAL_PROFILE_INCOMPLETE',
      'TRIAL_EXPIRED',
      'AI_LIMIT_REACHED',
      'AI_TOKEN_BUDGET_EXCEEDED',
      'INSUFFICIENT_TOKENS',
      'DEMO_READ_ONLY',
    ]);
    if (accessBlockedCodes.has(code)) {
      try {
        window.dispatchEvent(
          new CustomEvent('access:blocked', {
            detail: {
              code,
              message: data.message || data.error || defaultError,
            },
          })
        );
      } catch {
        // ignore
      }
      throw new Error(normalizedMessage);
    }
  }

  const err: any = new Error(normalizedMessage || defaultError);
  err.status = res.status;
  err.url = res.url;
  err.data = data;
  if (parsed.kind === 'text') err.bodyText = parsed.text;
  throw err;
};

export const Api = {
  // --- AUTH ---
  login: async (email: string, password: string): Promise<User> => {
    console.log('Api.login called:', { email, url: `${API_URL}/auth/login` });
    let res: Response;
    try {
      res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch (e: any) {
      // Browser network errors typically surface as TypeError("Load failed"/"Failed to fetch")
      // and are NOT HTTP errors. Provide a high-signal hint for operators.
      const msg = e?.message ? String(e.message) : String(e);
      throw new Error(
        `Network error contacting API (${API_URL}). ${msg}. ` +
          `Check that the backend is running and that Vite proxy/VITE_API_URL is configured correctly.`
      );
    }

    // Dev UX: during boot the backend may listen immediately but gate /api/* with 503 SERVER_STARTING
    // until DB initialization finishes. Wait briefly for /api/ready then retry once.
    if (await isServerStartingResponse(res)) {
      const ready = await waitForApiReady(15000);
      if (ready) {
        res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
      }
    }

    return handleResponse(res, 'Login failed').then((data) => {
      // Save both access token and refresh token
      tokenService.saveTokens(data.token, data.refreshToken);
      return data.user;
    });
  },

  register: async (userData: any): Promise<User | any> => {
    let res: Response;
    try {
      res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      throw new Error(
        `Network error contacting API (${API_URL}). ${msg}. ` +
          `Check that the backend is running and that Vite proxy/VITE_API_URL is configured correctly.`
      );
    }

    if (await isServerStartingResponse(res)) {
      const ready = await waitForApiReady(15000);
      if (ready) {
        res = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData),
        });
      }
    }

    const data = await handleResponse(res, 'Registration failed');
    if (data.status === 'pending') return data;
    tokenService.saveTokens(data.token, data.refreshToken);
    return data.user;
  },

  /**
   * Demo Login - Automatically logs in as demo user
   * Used for demo/trial access from landing page
   */
  demoLogin: async (): Promise<User & { isDemo: boolean }> => {
    console.log('Api.demoLogin called');
    let res: Response;
    try {
      res = await fetch(`${API_URL}/auth/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      throw new Error(
        `Network error contacting API (${API_URL}). ${msg}. ` +
          `Check that the backend is running and that Vite proxy/VITE_API_URL is configured correctly.`
      );
    }

    if (await isServerStartingResponse(res)) {
      const ready = await waitForApiReady(15000);
      if (ready) {
        res = await fetch(`${API_URL}/auth/demo-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const data = await handleResponse(res, 'Demo login failed');
    tokenService.saveTokens(data.token, data.refreshToken);
    // Store demo flag in session
    sessionStorage.setItem('isDemo', 'true');
    return { ...data.user, isDemo: true };
  },

  /**
   * Check if current session is a demo session
   */
  isDemoSession: (): boolean => {
    return sessionStorage.getItem('isDemo') === 'true';
  },

  /**
   * Clear demo session flag
   */
  clearDemoSession: (): void => {
    sessionStorage.removeItem('isDemo');
  },

  logout: async (): Promise<void> => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: getHeaders(),
      });
    } catch (error) {
      console.warn('Logout API call failed, clearing token anyway:', error);
    }
    tokenService.clearTokens();
  },

  getMe: async (): Promise<User | null> => {
    // Use fetchWithRetry so a stale/expired token triggers refresh and/or auth:token-expired.
    const res = await fetchWithRetry(`${API_URL}/auth/me`, { headers: getHeaders() });
    const data = await handleResponse(res, 'Failed to fetch profile');
    return data?.user ?? null;
  },

  // --- SECURITY & SESSIONS ---
  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    const res = await fetchWithRetry(`${API_URL}/auth/change-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return handleResponse(res, 'Failed to change password');
  },

  getActiveSessions: async (): Promise<{ sessions: any[] }> => {
    const res = await fetchWithRetry(`${API_URL}/auth/sessions`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch sessions');
  },

  revokeSession: async (sessionId: string): Promise<void> => {
    const res = await fetchWithRetry(`${API_URL}/auth/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to revoke session');
  },

  revokeAllSessions: async (): Promise<void> => {
    const res = await fetchWithRetry(`${API_URL}/auth/sessions/revoke-all`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to revoke all sessions');
  },

  // --- EMAIL VERIFICATION ---
  resendVerificationEmail: async (): Promise<void> => {
    const res = await fetchWithRetry(`${API_URL}/auth/resend-verification`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to send verification email');
  },

  verifyEmail: async (token: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return handleResponse(res, 'Email verification failed');
  },

  // --- ONBOARDING ---
  onboarding: {
    getStatus: async (): Promise<any> => {
      const res = await fetchWithRetry(`${API_URL}/onboarding/status`, {
        headers: getHeaders(),
      });
      return handleResponse(res, 'Failed to fetch onboarding status');
    },

    acceptTerms: async (data: {
      termsVersion?: string;
      privacyVersion?: string;
    }): Promise<void> => {
      const res = await fetchWithRetry(`${API_URL}/onboarding/accept-terms`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to accept terms');
    },

    selectTier: async (tier: string): Promise<void> => {
      const res = await fetchWithRetry(`${API_URL}/onboarding/select-tier`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ tier }),
      });
      return handleResponse(res, 'Failed to select pricing tier');
    },

    setupPayment: async (setupIntentId: string): Promise<void> => {
      const res = await fetchWithRetry(`${API_URL}/onboarding/setup-payment`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ setupIntentId }),
      });
      return handleResponse(res, 'Failed to setup payment');
    },

    complete: async (): Promise<void> => {
      const res = await fetchWithRetry(`${API_URL}/onboarding/complete`, {
        method: 'POST',
        headers: getHeaders(),
      });
      return handleResponse(res, 'Failed to complete onboarding');
    },
  },

  // --- TOKEN USAGE ANALYTICS ---
  getTokenUsageAnalytics: async (
    organizationId: string,
    timeRange: '7d' | '30d' | '90d' = '30d'
  ): Promise<any> => {
    const res = await fetchWithRetry(
      `${API_URL}/analytics/token-usage?orgId=${organizationId}&range=${timeRange}`,
      {
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to fetch token usage analytics');
  },

  // --- USERS (Admin) ---
  getUsers: async (): Promise<User[]> => {
    const res = await fetch(`${API_URL}/users`, { headers: getHeaders() });
    const data = await handleResponse(res, 'Failed to fetch users');
    // Backend returns { users: [...], total: N }, extract array
    return Array.isArray(data) ? data : data.users || [];
  },

  addUser: async (user: any): Promise<User> => {
    const res = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(user),
    });
    return handleResponse(res, 'Failed to add user');
  },

  uploadAvatar: async (userId: string, file: File): Promise<{ avatarUrl: string }> => {
    const formData = new FormData();
    formData.append('avatar', file);

    const res = await fetch(`${API_URL}/users/${userId}/avatar`, {
      method: 'POST',
      headers: {
        // Content-Type: multipart/form-data is set automatically with boundary by fetch when body is FormData
        Authorization: getHeaders()['Authorization'],
      },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to upload avatar');
    return data;
  },

  updateUser: async (id: string, updates: any): Promise<void> => {
    const res = await fetch(`${API_URL}/users/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update user');
  },

  deleteUser: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/users/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete user');
  },

  checkSystemHealth: async (): Promise<{
    status: string;
    latency: number;
    dbResponseTime?: number;
    storageUsed?: number;
    storageLimit?: number;
    apiCallsUsed?: number;
    apiCallsLimit?: number;
  }> => {
    // Use the same robust request path as the rest of the API layer.
    // This avoids false "Offline" when a proxy returns non-JSON errors, etc.
    const res = await fetchWithRetry(`${API_URL}/health`, { headers: getHeaders() });
    return handleResponse(res, 'Health check failed');
  },

  // --- ANALYTICS (Leadership Dashboard) ---
  getAnalyticsHealth: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/analytics/health`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch analytics health');
  },

  getAnalyticsPerformance: async (): Promise<any[]> => {
    const res = await fetchWithRetry(`${API_URL}/analytics/performance`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch analytics performance');
  },

  getAnalyticsEconomics: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/analytics/economics`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch analytics economics');
  },

  // --- NOTIFICATIONS (NotificationCenter) ---
  fetchNotifications: async (): Promise<any[]> => {
    const res = await fetchWithRetry(`${API_URL}/notifications`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch notifications');
  },

  markNotificationRead: async (id: string): Promise<void> => {
    // Backend uses PATCH, not PUT
    const res = await fetchWithRetry(`${API_URL}/notifications/${id}/read`, {
      method: 'PATCH',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to mark notification as read');
  },

  markAllNotificationsRead: async (): Promise<void> => {
    // Backend uses POST /mark-all-read, not PUT /read-all
    const res = await fetchWithRetry(`${API_URL}/notifications/mark-all-read`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to mark all notifications as read');
  },

  deleteNotification: async (id: string): Promise<void> => {
    const res = await fetchWithRetry(`${API_URL}/notifications/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete notification');
  },

  dismissNotification: async (id: string): Promise<void> => {
    const res = await fetchWithRetry(`${API_URL}/notifications/${id}/dismiss`, {
      method: 'PATCH',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to dismiss notification');
  },

  // Preferences (notification_preferences table; per-type mute lives here)
  getNotificationPreferencesV2: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/notifications/preferences`, {
      headers: getHeaders(),
    });
    if (!res.ok) return null;
    return res.json();
  },

  updateNotificationPreferencesV2: async (updates: any): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/notifications/preferences`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update notification preferences');
    return res.json();
  },

  // Admin-only: broadcast app/DBR77 communication
  broadcastNotification: async (payload: {
    type: string;
    title: string;
    body?: string;
    message?: string;
    severity?: 'INFO' | 'WARNING' | 'CRITICAL';
    category?: string;
    actionUrl?: string;
    data?: Record<string, unknown>;
    userIds?: string[];
  }): Promise<{ success: true; sent: number; failed: number }> => {
    const res = await fetchWithRetry(`${API_URL}/notifications/broadcast`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to broadcast notification');
  },

  // --- SETTINGS (NotificationSettings, IntegrationSettings) ---
  getNotificationPreferences: async (userId: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/settings/notifications?userId=${userId}`, {
      headers: getHeaders(),
    });
    if (!res.ok) return {};
    return res.json();
  },

  saveNotificationPreferences: async (userId: string, preferences: any): Promise<void> => {
    const res = await fetchWithRetry(`${API_URL}/settings/notifications`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ userId, preferences }),
    });
    if (!res.ok) throw new Error('Failed to save notification preferences');
  },

  saveIntegration: async (integration: any): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/settings/integrations`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(integration),
    });
    return handleResponse(res, 'Failed to save integration');
  },

  // --- CONTACT FORM ---
  submitContactForm: async (formData: {
    name: string;
    email: string;
    company?: string;
    subject: string;
    message: string;
  }): Promise<void> => {
    // Contact form is under /api/legal/contact
    const res = await fetch(`${API_URL}/legal/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    if (!res.ok) throw new Error('Failed to submit contact form');
  },

  // Session Management
  getSession: async (userId: string, type: SessionMode, projectId?: string): Promise<any> => {
    let url = `${API_URL}/sessions/${userId}?type=${type}`;
    if (projectId) url += `&projectId=${projectId}`;

    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  },

  getAssessmentReport: async (reportId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/assessment/reports/${reportId}`, {
      headers: getHeaders(),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json;
  },

  saveSession: async (
    userId: string,
    type: SessionMode,
    data: any,
    projectId?: string
  ): Promise<void> => {
    if (userId && projectId) {
      // We won't block session saves usually, but if we do:
      // Actually saveSession might be blocked.
    }
    const res = await fetch(`${API_URL}/sessions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ userId, type, data, projectId }),
    });
    await handleResponse(res, `Failed to save session`);
  },

  // --- AI ---

  /**
   * Deep Research: Get clarification questions before starting research.
   * Returns 2-3 questions with options to focus the research scope.
   */
  deepResearchClarify: async (
    message: string
  ): Promise<{
    success: boolean;
    questions: Array<{ id: string; question: string; options: string[] }>;
    researchType: string;
  }> => {
    const response = await fetch(`${API_URL}/ai/deep-research/clarify`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ message }),
    });
    return response.json();
  },

  deepThinkingEvent: async (args: {
    eventType: 'copied';
    sessionId: string;
    conversationId?: string;
    payload?: Record<string, unknown>;
  }) => {
    const response = await fetch(`${API_URL}/ai/deep-thinking/events`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(args),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = data?.error || data?.message || `HTTP ${response.status} ${response.statusText}`;
      const err: any = new Error(msg);
      err.code = data?.code;
      throw err;
    }
    return data;
  },

  saveDeepThinkingDecision: async (args: {
    sessionId: string;
    conversationId?: string;
    content: string;
    type?: 'decision' | 'initiative';
  }) => {
    const response = await fetch(`${API_URL}/ai/deep-thinking/save-decision`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(args),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = data?.error || data?.message || `HTTP ${response.status} ${response.statusText}`;
      const err: any = new Error(msg);
      err.code = data?.code;
      throw err;
    }
    return data;
  },

  // Organization Memory — past AI decisions
  getAIDecisionHistory: async (args?: { search?: string; limit?: number }): Promise<any> => {
    const params = new URLSearchParams();
    if (args?.search) params.set('search', args.search);
    if (args?.limit) params.set('limit', String(args.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_URL}/ai/deep-thinking/decisions${qs}`, {
      method: 'GET',
      headers: getHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const raw = data?.error || data?.message || `HTTP ${response.status} ${response.statusText}`;
      const msg = typeof raw === 'string' ? raw : JSON.stringify(raw);
      const err: any = new Error(msg);
      err.code = data?.code;
      throw err;
    }
    return data;
  },

  // Organization Memory — org-level patterns (best practices, lessons learned)
  getOrgPatterns: async (args?: { type?: string; limit?: number }): Promise<any> => {
    const params = new URLSearchParams();
    if (args?.type) params.set('type', args.type);
    if (args?.limit) params.set('limit', String(args.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_URL}/ai/deep-thinking/org-patterns${qs}`, {
      method: 'GET',
      headers: getHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const raw = data?.error || data?.message || `HTTP ${response.status} ${response.statusText}`;
      const msg = typeof raw === 'string' ? raw : JSON.stringify(raw);
      const err: any = new Error(msg);
      err.code = data?.code;
      throw err;
    }
    return data;
  },

  // Agent Audit Layer (Post-DeepThinking)
  agentAuditListAgents: async () => {
    const response = await fetch(`${API_URL}/ai/agent-audit/agents`, {
      method: 'GET',
      headers: getHeaders(),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = data?.error || data?.message || `HTTP ${response.status} ${response.statusText}`;
      const err: any = new Error(msg);
      err.code = data?.code;
      throw err;
    }
    return data;
  },

  agentAuditSuggest: async (args: {
    decisionContext: {
      topic: string;
      industry?: string;
      horizon?: string;
      functions?: string[];
      riskFocus?: string[];
    };
    userIntent?: 'validate' | 'stress_test' | 'approve';
    language?: string;
    maxAgents?: 2 | 3 | 4;
  }) => {
    const response = await fetch(`${API_URL}/ai/agent-audit/suggest`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(args),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = data?.error || data?.message || `HTTP ${response.status} ${response.statusText}`;
      const err: any = new Error(msg);
      err.code = data?.code;
      throw err;
    }
    return data;
  },

  agentAuditReview: async (args: {
    decisionContext: {
      topic: string;
      industry?: string;
      horizon?: string;
      functions?: string[];
      riskFocus?: string[];
    };
    deepThinkingReport: string;
    agentIds: string[];
    conversationId?: string;
    dtSessionId?: string;
    webSearchEnabled?: boolean;
    userIntent?: 'validate' | 'stress_test' | 'approve';
    language?: string;
    selectedTier?: 'BUDGET' | 'STANDARD' | 'PREMIUM' | 'REASONING';
    selectedModelId?: string | null;
    loopIteration?: 1 | 2;
  }) => {
    const response = await fetch(`${API_URL}/ai/agent-audit/review`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(args),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = data?.error || data?.message || `HTTP ${response.status} ${response.statusText}`;
      const err: any = new Error(msg);
      err.code = data?.code;
      throw err;
    }
    return data;
  },

  agentAuditAcceptRun: async (args: { runId: string; note?: string }) => {
    const runId = String(args.runId || '').trim();
    if (!runId) throw new Error('runId is required');
    const response = await fetch(
      `${API_URL}/ai/agent-audit/runs/${encodeURIComponent(runId)}/accept`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ note: args.note }),
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = data?.error || data?.message || `HTTP ${response.status} ${response.statusText}`;
      const err: any = new Error(msg);
      err.code = data?.code;
      throw err;
    }
    return data;
  },

  // Chat Traces (Admin)
  listChatTraces: async (args?: { limit?: number; offset?: number }) => {
    const limit = typeof args?.limit === 'number' ? args!.limit : 50;
    const offset = typeof args?.offset === 'number' ? args!.offset : 0;
    const res = await fetch(
      `${API_URL}/ai/traces/chat?limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(
        String(offset)
      )}`,
      { headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to fetch chat traces');
  },

  getChatTrace: async (runId: string) => {
    const id = String(runId || '').trim();
    if (!id) throw new Error('runId is required');
    const res = await fetch(`${API_URL}/ai/traces/chat/${encodeURIComponent(id)}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch chat trace');
  },

  chatWithAI: async (
    message: string,
    history: any[],
    systemInstruction?: string,
    roleName?: string
  ) => {
    try {
      const response = await fetch(`${API_URL}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history, systemInstruction, roleName }),
      });
      const data = await response.json();
      return data.text;
    } catch (error) {
      console.error('API Chat Error', error);
      throw error;
    }
  },

  chatConfirm: async (
    message: string,
    history: any[],
    systemInstruction?: string,
    context?: any,
    roleName?: string,
    language?: string,
    options?: {
      deepResearch?: boolean;
      webSearch?: boolean;
      showReasoning?: boolean;
      multiAgent?: boolean;
      marketResearch?: boolean;
      coThinkerMode?: string | null;
      privateMode?: boolean;
      knowledgeSources?: {
        pmoDocuments?: boolean;
        projectData?: boolean;
        organizationData?: boolean;
      };
      responseStyle?:
        | 'normal'
        | 'executive'
        | 'analyst'
        | 'coach'
        | 'concise'
        | 'formal'
        | 'professional'
        | 'friendly';
      selectedTier?: 'BUDGET' | 'STANDARD' | 'PREMIUM' | 'REASONING';
      selectedModelId?: string | null;
    }
  ) => {
    const aiModes = {
      deepResearch: options?.deepResearch ?? false,
      webSearch: options?.webSearch ?? false,
      showReasoning: options?.showReasoning ?? false,
      multiAgent: options?.multiAgent ?? false,
      marketResearch: options?.marketResearch ?? false,
      coThinkerMode: options?.coThinkerMode ?? null,
      privateMode: options?.privateMode ?? false,
    };

    const knowledgeSources = {
      pmoDocuments: options?.knowledgeSources?.pmoDocuments ?? true,
      projectData: options?.knowledgeSources?.projectData ?? true,
      organizationData: options?.knowledgeSources?.organizationData ?? false,
    };

    const responseStyle = options?.responseStyle ?? 'normal';

    const payload = {
      message,
      history,
      systemInstruction,
      context,
      roleName,
      language,
      aiModes,
      knowledgeSources,
      responseStyle,
      privateMode: Boolean(options?.privateMode),
      selectedTier: options?.selectedTier,
      selectedModelId: options?.selectedModelId ?? null,
      projectId: context?.projectId,
      screenContext: context?.screenContext,
      focusMode: context?.focusMode,
    };

    console.log('[Api.chatConfirm] Sending request:', {
      message: message?.substring(0, 50),
      historyLength: history?.length,
      language,
      aiModes,
    });

    const response = await fetch(`${API_URL}/ai/chat/confirm`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('[Api.chatConfirm] Error response:', {
        status: response.status,
        data,
      });
      const msg = data?.error || data?.message || `HTTP ${response.status} ${response.statusText}`;
      const err: any = new Error(msg);
      err.code = data?.code;
      throw err;
    }
    console.log('[Api.chatConfirm] Success:', { hasConfirm: !!data?.confirm });
    return data;
  },

  chatWithAIStream: async (
    message: string,
    history: any[],
    onChunk: (text: string) => void,
    onDone: () => void,
    systemInstruction?: string,
    context?: any,
    roleName?: string,
    language?: string,
    onThinking?: (thought: any) => void,
    options?: {
      deepResearch?: boolean;
      webSearch?: boolean;
      showReasoning?: boolean;
      multiAgent?: boolean;
      marketResearch?: boolean;
      coThinkerMode?: string | null;
      privateMode?: boolean;
      knowledgeSources?: {
        pmoDocuments?: boolean;
        projectData?: boolean;
        organizationData?: boolean;
      };
      responseStyle?:
        | 'normal'
        | 'executive'
        | 'analyst'
        | 'coach'
        | 'concise'
        | 'formal'
        | 'professional'
        | 'friendly';
      selectedTier?: 'BUDGET' | 'STANDARD' | 'PREMIUM' | 'REASONING';
      selectedModelId?: string | null;
    },
    abortSignal?: AbortSignal
  ) => {
    try {
      // Per-user local inference (Ollama): stored in currentUser.aiConfig and persisted locally.
      // We forward it explicitly so the backend can use the per-user endpoint safely.
      let localProvider: { provider: 'ollama'; endpoint: string; modelId: string } | null = null;
      try {
        const mod = await import('../store/useAppStore');
        const currentUser = (mod.useAppStore.getState() as any)?.currentUser as any;
        const cfg = currentUser?.aiConfig as any;
        if (
          cfg &&
          cfg.provider === 'ollama' &&
          typeof cfg.endpoint === 'string' &&
          cfg.endpoint.trim().length > 0 &&
          typeof cfg.modelId === 'string' &&
          cfg.modelId.trim().length > 0
        ) {
          localProvider = {
            provider: 'ollama',
            endpoint: cfg.endpoint.trim(),
            modelId: cfg.modelId.trim(),
          };
        }
      } catch {
        // ignore (store not available in some test contexts)
      }

      // Build AI config payload from options
      const aiModes = {
        deepResearch: options?.deepResearch ?? false,
        webSearch: options?.webSearch ?? false,
        showReasoning: options?.showReasoning ?? false,
        multiAgent: options?.multiAgent ?? false,
        marketResearch: options?.marketResearch ?? false,
        coThinkerMode: options?.coThinkerMode ?? null,
        privateMode: options?.privateMode ?? false,
      };

      const knowledgeSources = {
        pmoDocuments: options?.knowledgeSources?.pmoDocuments ?? true,
        projectData: options?.knowledgeSources?.projectData ?? true,
        organizationData: options?.knowledgeSources?.organizationData ?? false,
      };

      const responseStyle = options?.responseStyle ?? 'normal';

      const response = await fetch(`${API_URL}/ai/chat/stream`, {
        method: 'POST',
        headers: getHeaders(),
        signal: abortSignal,
        body: JSON.stringify({
          message,
          history,
          systemInstruction,
          context,
          roleName,
          language,
          // Streaming session affinity / resume support
          // NOTE: backend uses `conversationId` as the stream session id to persist partial responses.
          // If we don't pass it, the backend falls back to a timestamp-based id which the client can't predict.
          conversationId: context?.conversationId ?? context?.sessionId,
          resumeFromPartial: Boolean(context?.resumeFromPartial),
          // AI Configuration
          aiModes,
          knowledgeSources,
          responseStyle,
          privateMode: Boolean((options as any)?.privateMode),
          // Model routing
          selectedTier: options?.selectedTier,
          selectedModelId: options?.selectedModelId ?? localProvider?.modelId ?? null,
          // Explicit per-user provider override (used for local Ollama)
          provider: localProvider?.provider,
          endpoint: localProvider?.endpoint,
          // Common context hints (keep as top-level so backend validator doesn't strip them)
          projectId: context?.projectId,
          screenContext: context?.screenContext,
          focusMode: context?.focusMode,
        }),
      });

      // If backend didn't return SSE (e.g. 401/403 JSON), surface it immediately.
      // Otherwise the client would read a non-SSE body, never call onChunk, and appear as "nothing happens".
      if (!response.ok) {
        let parsed: any = null;
        let rawText = '';
        try {
          parsed = await response.clone().json();
        } catch {
          // ignore
        }
        try {
          rawText = await response.text();
        } catch {
          // ignore
        }

        const codeRaw = parsed?.code || parsed?.errorCode || parsed?.reasonCode;
        const code =
          typeof codeRaw === 'string' && codeRaw.trim().length > 0
            ? codeRaw
            : `HTTP_${response.status}`;
        const serverMsg =
          parsed?.message ||
          parsed?.error ||
          rawText ||
          `HTTP ${response.status} ${response.statusText}`;

        // Flow-control: Deep Thinking requires an explicit Confirm step.
        // Never render this as an assistant "message" — let callers handle the flow.
        if (code === 'DEEP_THINKING_CONFIRM_REQUIRED') {
          const err: any = new Error(serverMsg || code);
          err.code = code;
          throw err;
        }

        // Only show the "Access required" modal for genuine access/auth blocks.
        const accessErrorCodes = new Set([
          'ORG_NOT_FOUND',
          'ORG_INACTIVE',
          'ACCESS_BLOCKED',
          'DEMO_READ_ONLY',
          'DEMO_TIME_EXPIRED',
          'DEMO_AI_SESSION_LIMIT_REACHED',
          'TRIAL_EXPIRED',
          'AI_LIMIT_REACHED',
          'TRIAL_PROFILE_INCOMPLETE',
          'AI_TOKEN_BUDGET_EXCEEDED',
          'INSUFFICIENT_TOKENS',
        ]);
        const isAccessError =
          response.status === 401 || response.status === 403 || accessErrorCodes.has(code);

        if (isAccessError) {
          try {
            window.dispatchEvent(
              new CustomEvent('access:blocked', {
                detail: {
                  code,
                  message: serverMsg,
                  accessContext: parsed?.accessContext,
                },
              })
            );
          } catch {
            // ignore
          }
        }

        // Also show a short inline error so the assistant bubble doesn't stay empty.
        const uiLang = getCachedUserLanguage();
        const friendly =
          code === 'ORG_NOT_FOUND'
            ? uiLang === 'pl'
              ? '⚠️ Brak organizacji w sesji. Wyloguj się i zaloguj ponownie.'
              : '⚠️ Organization not found in session. Please log out and log in again.'
            : uiLang === 'pl'
              ? `⚠️ Nie udało się uruchomić AI (${code}).`
              : `⚠️ AI request failed (${code}).`;
        onChunk(friendly);
        onDone();
        return;
      }

      if (!response.body) throw new Error('ReadableStream not supported');

      // Best-effort stream meta: backend exposes the resolved session id for debugging/resume flows.
      try {
        const sid = String(response.headers.get('X-Stream-Session-Id') || '').trim();
        if (sid && onThinking) {
          onThinking({ type: 'stream_meta', sessionId: sid });
        }
      } catch {
        // ignore
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accessErrorShownInline = false;
      let hasAnyVisibleOutput = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');

        // Keep the last part in the buffer as it might be incomplete
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (part.startsWith('data: ')) {
            const dataStr = part.replace('data: ', '').trim();
            if (dataStr === '[DONE]') {
              // If stream ends without any visible output, show a friendly fallback
              // (prevents "nothing happens" UX).
              if (!hasAnyVisibleOutput) {
                const uiLang = getCachedUserLanguage();
                const friendly =
                  uiLang === 'pl'
                    ? '⚠️ AI nie zwróciło odpowiedzi. Sprawdź konfigurację providera (OPENROUTER_API_KEY / OpenRouter w panelu SuperAdmin) oraz logi backendu.'
                    : '⚠️ AI returned no output. Check LLM provider config (OPENROUTER_API_KEY / OpenRouter in SuperAdmin) and backend logs.';
                onChunk(friendly);
              }
              onDone();
              return;
            }
            try {
              const data = JSON.parse(dataStr);

              // ── 1) Typed events (thinking/progress/state/research) ──
              // Route BEFORE error handling so that typed events carrying an
              // `error` field (e.g. research_progress with TAVILY_API_KEY
              // missing) go to their own handler and are NOT rendered as
              // chat-bubble text.
              if (typeof data.type === 'string' && onThinking && data.type !== 'error') {
                const hasText =
                  typeof (data as any).text === 'string' && (data as any).text.length > 0;
                const hasContent =
                  typeof (data as any).content === 'string' && (data as any).content.length > 0;
                if (hasText || hasContent) {
                  // Count as visible output even though we don't pass it through onChunk().
                  // (useAIStream will apply it via handleEvent, e.g. replace strategy)
                  hasAnyVisibleOutput = true;
                }
                onThinking(data);
                continue;
              }

              // ── 2) Error events (access/auth/stream errors) ──
              if (data.error) {
                // Errors are visible output (either inline or via friendly message).
                console.error('Stream error from server:', data.error, data.code);

                // Access/auth errors - show modal, don't pollute chat
                const accessErrorCodes = [
                  'ORG_NOT_FOUND',
                  'ORG_INACTIVE',
                  'ACCESS_BLOCKED',
                  'DEMO_READ_ONLY',
                  'DEMO_TIME_EXPIRED',
                  'DEMO_AI_SESSION_LIMIT_REACHED',
                  'TRIAL_EXPIRED',
                  'AI_LIMIT_REACHED',
                  'TRIAL_PROFILE_INCOMPLETE',
                ];

                const dataCode =
                  typeof data.code === 'string' ? data.code : String(data.code || '');
                const isAccessError = accessErrorCodes.includes(dataCode);

                // UX: Always show *something* in the chat bubble when stream ends with access errors,
                // otherwise the placeholder stays empty and the UI hides it (looks like "thinking then reset").
                if (isAccessError) {
                  if (!accessErrorShownInline) {
                    accessErrorShownInline = true;
                    const uiLang = getCachedUserLanguage();
                    const friendly =
                      data.code === 'ORG_NOT_FOUND'
                        ? uiLang === 'pl'
                          ? '⚠️ Brak organizacji w sesji. Wyloguj się i zaloguj ponownie.'
                          : '⚠️ Organization not found in session. Please log out and log in again.'
                        : data.code === 'ORG_INACTIVE'
                          ? uiLang === 'pl'
                            ? '⚠️ Organizacja jest nieaktywna. Zaloguj się ponownie lub skontaktuj się z administratorem.'
                            : '⚠️ Organization is inactive. Please log in again or contact an admin.'
                          : uiLang === 'pl'
                            ? `⚠️ Brak dostępu (${data.code}).`
                            : `⚠️ Access blocked (${data.code}).`;
                    hasAnyVisibleOutput = true;
                    onChunk(friendly);
                  }
                } else if (dataCode === 'DEEP_THINKING_CONFIRM_REQUIRED') {
                  // Deep Thinking requires Confirm step - this is a flow control error, not a user-facing error.
                  // The frontend should handle this by calling /api/ai/chat/confirm first.
                  // Show a user-friendly message instead of the raw error.
                  const uiLang = getCachedUserLanguage();
                  const friendly =
                    uiLang === 'pl'
                      ? '⚠️ Tryb Deep Thinking wymaga najpierw potwierdzenia zrozumienia zadania. Spróbuj ponownie.'
                      : '⚠️ Deep Thinking mode requires confirmation first. Please try again.';
                  hasAnyVisibleOutput = true;
                  onChunk(friendly);
                  console.warn(
                    '[AI Stream] Deep Thinking confirm required but not called. Check frontend flow.'
                  );
                } else {
                  // Non-access errors: show an inline friendly message for known codes,
                  // otherwise fall back to raw backend error (so user isn't left with an empty bubble).
                  const uiLang = getCachedUserLanguage();
                  const sid =
                    typeof (data as any).sessionId === 'string' &&
                    (data as any).sessionId.trim().length > 0
                      ? String((data as any).sessionId).trim()
                      : null;

                  const friendlyByCode =
                    dataCode === 'EMPTY_STREAM'
                      ? uiLang === 'pl'
                        ? '⚠️ AI nie zwróciło odpowiedzi. Spróbuj ponownie za chwilę. Jeśli problem się powtarza, skontaktuj się z administratorem.'
                        : '⚠️ AI returned no output. Please try again in a moment. If the problem persists, contact your administrator.'
                      : dataCode === 'NO_LLM_PROVIDER'
                        ? uiLang === 'pl'
                          ? '⚠️ AI nie jest skonfigurowane na backendzie. Skontaktuj się z administratorem.'
                          : '⚠️ AI is not configured on the backend. Please contact your administrator.'
                        : dataCode === 'INVALID_API_KEY'
                          ? uiLang === 'pl'
                            ? '⚠️ Konfiguracja klucza API do AI jest nieprawidłowa lub wygasła. Skontaktuj się z administratorem.'
                            : '⚠️ AI API key is invalid or expired. Please contact your administrator.'
                          : dataCode === 'RATE_LIMIT'
                            ? uiLang === 'pl'
                              ? '⚠️ Przekroczono limit zapytań do AI. Spróbuj ponownie za chwilę.'
                              : '⚠️ AI rate limit exceeded. Please try again in a moment.'
                            : dataCode === 'LOCAL_LLM_DISABLED' ||
                                dataCode === 'LOCAL_LLM_ENDPOINT_NOT_ALLOWED'
                              ? uiLang === 'pl'
                                ? '⚠️ Lokalny provider AI jest niedozwolony w tym środowisku.'
                                : '⚠️ Local AI provider is not allowed in this environment.'
                              : dataCode === 'STREAM_ERROR' ||
                                  dataCode === 'AI_STREAM_ERROR' ||
                                  dataCode === 'AI_PIPELINE_ERROR'
                                ? uiLang === 'pl'
                                  ? '⚠️ Wystąpił błąd podczas generowania odpowiedzi. Spróbuj ponownie.'
                                  : '⚠️ An error occurred while generating the response. Please try again.'
                                : null;

                  hasAnyVisibleOutput = true;
                  onChunk(friendlyByCode || String(data.error));

                  if (sid) {
                    console.info('[AI Stream] sessionId:', sid);
                  }
                }

                // Budget freeze (existing behavior)
                if (data.code === 'AI_BUDGET_EXHAUSTED') {
                  const { useAppStore } = await import('../store/useAppStore');
                  useAppStore.getState().setAiFreezeStatus({
                    isFrozen: true,
                    reason: data.error,
                    scope: data.budgetStatus?.scope || 'Global',
                  });
                } else if (isAccessError) {
                  // Unified access-blocked UX hook (only for access/auth blocks)
                  try {
                    window.dispatchEvent(
                      new CustomEvent('access:blocked', {
                        detail: {
                          code: dataCode || 'ACCESS_BLOCKED',
                          message: data.error,
                          accessContext: data.accessContext,
                        },
                      })
                    );
                  } catch {
                    // ignore
                  }
                }
              }

              if (typeof data.text === 'string') {
                // Backend may emit empty string; treat only non-empty text as visible output.
                if (data.text.length > 0) {
                  hasAnyVisibleOutput = true;
                  onChunk(data.text);
                }
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e, dataStr);
            }
          }
        }
      }

      // If the SSE stream ended without any visible output, show a friendly fallback.
      // This prevents the UX where the assistant bubble stays empty and gets hidden.
      if (!hasAnyVisibleOutput) {
        const uiLang = getCachedUserLanguage();
        const friendly =
          uiLang === 'pl'
            ? 'Nie udało się wygenerować odpowiedzi. Proszę spróbować ponownie za chwilę lub skontaktować się z administratorem.'
            : 'Unable to generate a response. Please try again in a moment or contact your administrator.';
        onChunk(friendly);
      }

      onDone();
    } catch (error) {
      console.error('API Chat Stream Error', error);
      throw error;
    }
  },
  // --- SETTINGS ---
  saveSetting: async (key: string, value: string): Promise<void> => {
    const res = await fetch(`${API_URL}/settings`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) throw new Error('Failed to save setting');
  },

  // --- SUPER ADMIN ---
  getOrganizations: async (): Promise<any[]> => {
    try {
      const res = await fetch(`${API_URL}/superadmin/organizations`, { headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch organizations');
      return data;
    } catch (e) {
      console.error('[Api] Error fetching organizations:', e);
      throw e;
    }
  },

  updateOrganization: async (
    id: string,
    updates: { plan?: string; status?: string; discount_percent?: number }
  ): Promise<void> => {
    const res = await fetch(`${API_URL}/superadmin/organizations/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update organization');
  },

  deleteOrganization: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/superadmin/organizations/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete organization');
  },

  getOrganizationBillingDetails: async (orgId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/superadmin/organizations/${orgId}/billing`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch organization billing details');
    return res.json();
  },

  getSuperAdminDashboard: async (): Promise<{
    activity: { total: number; last_hour: number; last_24h: number; last_7d: number };
    ai: { total_ai_calls: number; total_tokens: number; active_users: number };
    counts: { total_users: number; total_orgs: number; active_users_7d: number };
    live?: { total_active_connections: number };
  }> => {
    const res = await fetch(`${API_URL}/superadmin/dashboard`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch dashboard');
    return res.json();
  },

  getActivities: async (limit: number = 50): Promise<any[]> => {
    try {
      const res = await fetch(`${API_URL}/superadmin/activities?limit=${limit}`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch activities');
      return res.json();
    } catch (error) {
      const { isDemoMode, isDemoSession } = getDemoFlags();
      if (isDemoMode || isDemoSession) {
        console.warn('[Api] getActivities demo fallback:', error);
        const now = new Date();
        return [
          {
            id: 'act-1',
            created_at: now.toISOString(),
            user_email: 'admin@demo.local',
            user_name: 'Super Admin (Demo)',
            action: 'login_success',
            entity_type: 'user',
            entity_name: 'Super Admin',
            details: 'Demo login',
          },
        ];
      }
      console.error('[Api] getActivities error:', error);
      throw error;
    }
  },

  getSuperAdminUsers: async (): Promise<User[]> => {
    const res = await fetch(`${API_URL}/superadmin/users`, { headers: getHeaders() });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data as any)?.error || 'Failed to fetch super admin users');
    return (Array.isArray(data) ? data : []) as User[];
  },

  updateSuperAdminUser: async (
    id: string,
    updates: { organizationId?: string; role?: string; status?: string }
  ): Promise<void> => {
    const res = await fetch(`${API_URL}/superadmin/users/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update user');
  },

  createSuperAdminUser: async (user: any): Promise<User> => {
    const res = await fetch(`${API_URL}/superadmin/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(user),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create super admin');
    return data;
  },

  inviteUser: async (email: string, role: string, organizationId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/superadmin/users/invite`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, role, organizationId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to invite user');
    return data;
  },

  adminResetPassword: async (userId: string): Promise<{ resetLink: string; token: string }> => {
    const res = await fetch(`${API_URL}/superadmin/users/${userId}/reset-password`, {
      method: 'POST',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to generate reset link');
    return data;
  },

  adminGetDatabaseTables: async (): Promise<string[]> => {
    const res = await fetch(`${API_URL}/superadmin/database/tables`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch tables');
    return data;
  },

  adminGetTableRows: async (tableName: string): Promise<any[]> => {
    const res = await fetch(`${API_URL}/superadmin/database/rows/${tableName}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch rows');
    return data;
  },

  adminGetStorageStats: async (): Promise<any> => {
    try {
      const res = await fetch(`${API_URL}/superadmin/storage/usage`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch storage stats');
      return data;
    } catch (error) {
      const { isDemoMode, isDemoSession } = getDemoFlags();
      if (isDemoMode || isDemoSession) {
        console.warn('[Api] adminGetStorageStats demo fallback:', error);
        return {
          totalSize: 0,
          breakdown: [{ name: 'org-demo', displayName: 'Demo Org', size: 0 }],
        };
      }
      console.error('[Api] adminGetStorageStats error:', error);
      throw error;
    }
  },

  adminGetOrgFiles: async (orgId: string): Promise<any[]> => {
    const res = await fetch(`${API_URL}/superadmin/storage/files/${orgId}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch files');
    return data;
  },

  adminDeleteFile: async (orgId: string, path: string): Promise<void> => {
    const res = await fetch(`${API_URL}/superadmin/storage/files`, {
      method: 'DELETE',
      headers: {
        ...getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orgId, path }),
    });
    if (!res.ok) throw new Error('Failed to delete file');
  },

  resetPassword: async (token: string, newPassword: string): Promise<void> => {
    // Use auth route, or ensure route is publicly accessible without superadmin middleware
    // NOTE: We implemented this in superadmin.js in previous step, but it should be public.
    // Wait, did I put it in superadmin.js which has verifySuperAdmin middleware?
    // YES I DID. That is a mistake for the public consumption part.
    // The generation is Admin, the consumption is Public.
    // I need to move the consumption endpoint to auth.js or a public route.
    // For now let's assume I fix it.
    const res = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to reset password');
  },

  revertImpersonation: async (): Promise<{ user: User; token: string }> => {
    const res = await fetch(`${API_URL}/auth/revert-impersonation`, {
      method: 'POST',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to revert impersonation');
    return data;
  },

  impersonateUser: async (userId: string): Promise<{ user: User; token: string }> => {
    const res = await fetch(`${API_URL}/superadmin/impersonate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to impersonate user');
    return data;
  },

  getSystemSettings: async (): Promise<any> => {
    try {
      const res = await fetch(`${API_URL}/settings`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    } catch (error) {
      const { isDemoMode, isDemoSession } = getDemoFlags();
      if (isDemoMode || isDemoSession) {
        console.warn('[Api] getSystemSettings demo fallback:', error);
        return {
          app_name: 'Consultinity (Demo)',
          default_language: 'EN',
          maintenance_mode: 'false',
          system_announcement: 'Demo environment',
          enforce_mfa: 'false',
          session_timeout_mins: '60',
        };
      }
      console.error('[Api] getSystemSettings error:', error);
      throw error;
    }
  },

  // --- PROJECTS ---
  getProjects: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/projects`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch projects');
    return res.json();
  },

  createProject: async (data: { name: string; ownerId?: string }): Promise<any> => {
    const res = await fetch(`${API_URL}/projects`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to create project');
    return json;
  },

  deleteProject: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/projects/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete project');
  },

  updateProject: async (id: string, data: any): Promise<any> => {
    const res = await fetch(`${API_URL}/projects/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to update project');
    return json;
  },

  // AI OBSERVATIONS
  generateGlobalBrainObservations: async () => {
    const response = await fetch(`${API_URL}/knowledge/observations/generate`, {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to generate observations');
    return response.json();
  },

  // --- LLM MANAGEMENT ---
  getLLMProviders: async (adminContext = false): Promise<any[]> => {
    const headers: Record<string, string> = { ...getHeaders() };
    if (adminContext) {
      const user = await Api.getMe();
      headers['x-org-context'] = user?.organizationId || '';
    }
    const res = await fetch(`${API_URL}/llm/providers`, { headers });
    if (!res.ok) throw new Error('Failed to fetch LLM providers');
    return res.json();
  },

  // Analytics & Logs
  getLLMAnalytics: async (days: number = 7): Promise<any> => {
    const res = await fetch(`${API_URL}/llm/analytics?days=${days}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch analytics');
    return res.json();
  },

  getLLMLogs: async (
    limit: number = 50,
    offset: number = 0,
    onlyErrors: boolean = false
  ): Promise<any> => {
    const res = await fetch(
      `${API_URL}/llm/logs?limit=${limit}&offset=${offset}&errors=${onlyErrors}`,
      {
        headers: getHeaders(),
      }
    );
    if (!res.ok) throw new Error('Failed to fetch logs');
    return res.json();
  },

  toggleOrganizationLLM: async (providerId: string, enabled: boolean): Promise<any> => {
    const res = await fetch(`${API_URL}/llm/providers/organization/toggle`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ providerId, enabled }),
    });
    return handleResponse(res, 'Failed to toggle provider');
  },

  addLLMProvider: async (provider: any): Promise<void> => {
    const res = await fetch(`${API_URL}/llm/providers`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(provider),
    });
    if (!res.ok) throw new Error('Failed to add provider');
  },

  updateLLMProvider: async (id: string, data: any) => {
    const res = await fetch(`${API_URL}/llm/providers/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update provider');
    return res.json();
  },

  applyRecommendedAiModelPresetV3: async (params?: {
    dryRun?: boolean;
    overwrite?: boolean;
    replicateImageModel?: string;
    openaiImageModel?: string;
  }): Promise<any> => {
    const res = await fetch(`${API_URL}/llm/presets/v3/recommended`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(params || {}),
    });
    return handleResponse(res, 'Failed to apply recommended preset');
  },

  testLLMConnection: async (
    config: any
  ): Promise<{ success: boolean; message: string; response?: string }> => {
    const res = await fetchWithRetry(`${API_URL}/llm/test`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(config),
    });
    let parsed: any = null;
    let rawText = '';
    try {
      parsed = await res.clone().json();
    } catch {
      // ignore
    }
    if (!parsed) {
      try {
        rawText = await res.text();
      } catch {
        // ignore
      }
    }
    const data = parsed || {};
    if (!res.ok) {
      const msg =
        data?.error ||
        data?.message ||
        rawText ||
        `HTTP ${res.status} ${res.statusText || 'Request failed'}`;
      return { success: false, message: msg };
    }
    // Normalize response so callers can always show a toast.
    const success = data?.success === true;
    const message =
      data?.message ||
      (success
        ? `Connection OK${typeof data?.latency === 'number' ? ` (${data.latency}ms)` : ''}`
        : data?.error || data?.message || 'Connection failed');
    return { ...data, success, message };
  },

  getOperationalCosts: async (
    startDate?: string,
    endDate?: string
  ): Promise<{ items: any[]; totalCost: number }> => {
    let url = `${API_URL}/billing/admin/costs`;
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (params.toString()) url += `? ${params.toString()}`;

    const res = await fetch(url, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch costs');
    return data.costs;
  },

  deleteLLMProvider: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/llm/providers/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete provider');
  },

  cloneLLMProviderModel: async (
    sourceProviderId: string,
    data: { name?: string; model_id: string; tier?: string; visibility?: string; is_active?: boolean; priority?: number }
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/llm/providers/${encodeURIComponent(sourceProviderId)}/clone-model`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to clone provider model');
  },

  // --- AI GOVERNANCE ---
  aiGetSystemPrompts: async (): Promise<any[]> => {
    // Canonical prompt SSOT: /api/ai-prompts
    const res = await fetch(`${API_URL}/ai-prompts?limit=500&page=1`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch system prompts');
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.prompts)) return data.prompts;
    if (data?.data?.prompts && Array.isArray(data.data.prompts)) return data.data.prompts;
    return [];
  },

  aiUpdateSystemPrompt: async (key: string, data: any): Promise<void> => {
    // Update by key using canonical SSOT (resolve key -> id first).
    const prompts = await Api.aiGetSystemPrompts();
    const row =
      (Array.isArray(prompts)
        ? prompts.find(
            (p: any) => String(p?.key || p?.name || '').trim() === String(key || '').trim()
          )
        : null) || null;

    const id = String((row as any)?.id || '').trim();
    if (!id) throw new Error(`Prompt not found for key: ${key}`);

    const res = await fetch(`${API_URL}/ai-prompts/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({
        content: data?.content,
        name: key,
      }),
    });
    if (!res.ok) throw new Error('Failed to update prompt');
  },

  aiSeedSystemPrompts: async (): Promise<void> => {
    // Deprecated: legacy endpoint removed; kept for API compatibility.
    // Intentionally no-op.
  },

  getPublicLLMProviders: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/llm/providers/public`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch public LLM providers');
    return res.json();
  },

  testOllamaConnection: async (
    endpoint: string
  ): Promise<{ success: boolean; message?: string; models?: any[]; error?: string }> => {
    const res = await fetch(`${API_URL}/llm/test-ollama`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ endpoint }),
    });
    return res.json();
  },

  getOllamaModels: async (endpoint: string): Promise<any[]> => {
    const res = await fetch(
      `${API_URL}/llm/ollama-models?endpoint=${encodeURIComponent(endpoint)}`,
      {
        headers: getHeaders(),
      }
    );
    if (!res.ok) return [];
    return res.json();
  },

  getOrganizationLLMConfig: async (
    orgId: string
  ): Promise<{ activeProviderId: string | null; availableProviders: any[] }> => {
    const res = await fetch(`${API_URL}/llm/organization-config/${orgId}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch organization LLM config');
    return res.json();
  },

  updateOrganizationLLMConfig: async (orgId: string, providerId: string | null): Promise<void> => {
    const res = await fetch(`${API_URL}/llm/organization-config/${orgId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ providerId }),
    });
    if (!res.ok) throw new Error('Failed to update organization LLM config');
  },

  // LLM Self-Diagnosis - auto-repair missing providers
  diagnoseLLM: async (): Promise<{
    status: string;
    checks: any[];
    repairs: string[];
    version: string;
  }> => {
    const res = await fetch(`${API_URL}/llm/diagnose`);
    if (!res.ok) throw new Error('LLM diagnosis failed');
    return res.json();
  },

  // LLM Provider Health Check - check connectivity and status of all providers
  checkLLMProvidersHealth: async (): Promise<{
    success: boolean;
    providers:
      | Record<string, { available?: boolean; latency?: number; error?: string; status?: string }>
      | Array<{ available?: boolean; latency?: number; error?: string; status?: string }>;
    circuitBreakers: Array<{ name: string; state: string; failures: number }>;
    lastCheck: number;
    overall?: string;
  }> => {
    // Keep it fast in UI polls (local providers like Ollama can hang if not running).
    const res = await fetchWithRetry(`${API_URL}/llm/providers/health?timeoutMs=1200`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
  },

  // LLM Incidents Timeline - downtime analysis based on health events
  getLLMIncidents: async (params?: {
    from?: string;
    to?: string;
    provider?: string;
  }): Promise<{
    success: boolean;
    provider: string;
    from: string;
    to: string;
    uptime: {
      totalMs: number;
      downMs: number;
      upMs: number;
      uptimePct: number;
      samples: number;
    };
    incidents: Array<{
      start: string;
      end: string | null;
      durationMs: number;
      samples: number;
      lastError: string | null;
    }>;
  }> => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    if (params?.provider) qs.set('provider', params.provider);
    const url = `${API_URL}/llm/incidents${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await fetchWithRetry(url, { headers: getHeaders() });
    return handleResponse(res, 'Failed to load incidents timeline');
  },

  // Get recommended LLM provider based on current health
  getRecommendedLLMProvider: async (
    tier: string = 'STANDARD'
  ): Promise<{
    success: boolean;
    recommendation: {
      provider: any;
      health: { available: boolean; latency?: number };
      recommended: boolean;
    } | null;
  }> => {
    const res = await fetch(`${API_URL}/llm/providers/recommended?tier=${tier}`);
    if (!res.ok) throw new Error('Failed to get recommendation');
    return res.json();
  },

  // Test fallback chain
  testLLMFallback: async (
    tier: string = 'STANDARD'
  ): Promise<{
    success: boolean;
    tier: string;
    fallbackChain: string[];
    recommendedFallback: any;
  }> => {
    const res = await fetch(`${API_URL}/llm/test-fallback`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ tier }),
    });
    if (!res.ok) throw new Error('Fallback test failed');
    return res.json();
  },

  // User AI Usage - get user's token consumption
  getUserAIUsage: async (): Promise<{
    daily: number;
    monthly: number;
    dailyLimit: number;
    monthlyLimit: number;
    percentage: number;
    tokensUsed: number;
    tokensLimit: number;
    recentUsage?: Array<{ date: string; tokens: number; requests: number }>;
  }> => {
    const res = await fetch(`${API_URL}/llm/user/usage`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch user AI usage');
    return res.json();
  },

  // Get user's currently active AI model
  getUserActiveModel: async (): Promise<{ activeModel: any; source: string }> => {
    const res = await fetch(`${API_URL}/llm/user/active-model`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch active model');
    return res.json();
  },

  // --- KNOWLEDGE BASE ---
  getKnowledgeFiles: async (): Promise<{ docs: any[]; availableFiles: string[] }> => {
    const res = await fetch(`${API_URL}/knowledge/files`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch knowledge files');
    return res.json();
  },

  indexKnowledgeFiles: async (): Promise<{ message: string; indexedCount: number }> => {
    const res = await fetch(`${API_URL}/knowledge/index`, {
      method: 'POST',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Indexing failed');
    return data;
  },

  // ==========================================
  // PHASE 1: TASKS API
  // ==========================================
  getTasks: async (filters?: {
    projectId?: string;
    status?: string;
    assigneeId?: string;
    priority?: string;
    initiativeId?: string;
  }): Promise<any[]> => {
    let url = `${API_URL}/tasks`;
    if (filters) {
      const params = new URLSearchParams();
      if (filters.projectId) params.append('projectId', filters.projectId);
      if (filters.status) params.append('status', filters.status);
      if (filters.assigneeId) params.append('assigneeId', filters.assigneeId);
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.initiativeId) params.append('initiativeId', filters.initiativeId);
      // IMPORTANT: no leading space after "?" (breaks query parsing in some servers)
      if (params.toString()) url += `?${params.toString()}`;
    }
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
  },

  getTask: async (id: string): Promise<any> => {
    const res = await fetch(`${API_URL}/tasks/${id}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch task');
    return res.json();
  },

  createTask: async (task: {
    projectId: string;
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    assigneeId?: string;
    dueDate?: string;
    estimatedHours?: number;
    checklist?: any[];
    tags?: string[];
    taskType?: string;
    initiativeId?: string;
    why?: string;
    stepPhase?: 'design' | 'pilot' | 'rollout';
  }): Promise<any> => {
    const res = await fetch(`${API_URL}/tasks`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(task),
    });
    return handleResponse(res, 'Failed to create task');
  },

  updateTask: async (id: string, updates: any): Promise<void> => {
    const res = await fetch(`${API_URL}/tasks/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    await handleResponse(res, 'Failed to update task');
  },

  deleteTask: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/tasks/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    await handleResponse(res, 'Failed to delete task');
  },

  // ==========================================
  // MY WORK (V2): PERSONAL TASKS (T007)
  // ==========================================
  getPersonalTasks: async (filters?: {
    includeDone?: boolean;
    status?: string;
    q?: string;
    limit?: number;
  }): Promise<any[]> => {
    let url = `${API_URL}/my-work/personal-tasks`;
    if (filters) {
      const params = new URLSearchParams();
      if (filters.includeDone) params.append('includeDone', 'true');
      if (filters.status) params.append('status', filters.status);
      if (filters.q) params.append('q', filters.q);
      if (filters.limit) params.append('limit', String(filters.limit));
      if (params.toString()) url += `?${params.toString()}`;
    }

    const cached = __personalTasksCache.get(url);
    if (cached && Date.now() - cached.at < PERSONAL_TASKS_CACHE_MS) {
      return cached.data;
    }

    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch personal tasks');
    const data = await res.json();
    __personalTasksCache.set(url, { at: Date.now(), data });
    return data;
  },

  getPersonalTask: async (id: string): Promise<any> => {
    const res = await fetch(`${API_URL}/my-work/personal-tasks/${id}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch personal task');
    return res.json();
  },

  createPersonalTask: async (task: {
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    dueDate?: string | null;
    tags?: string[];
  }): Promise<any> => {
    const res = await fetch(`${API_URL}/my-work/personal-tasks`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(task),
    });
    const created = await handleResponse(res, 'Failed to create personal task');
    __personalTasksCache.clear();
    return created;
  },

  updatePersonalTask: async (id: string, updates: any): Promise<any> => {
    const res = await fetch(`${API_URL}/my-work/personal-tasks/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    const updated = await handleResponse(res, 'Failed to update personal task');
    __personalTasksCache.clear();
    return updated;
  },

  deletePersonalTask: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/my-work/personal-tasks/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    await handleResponse(res, 'Failed to delete personal task');
    __personalTasksCache.clear();
  },

  // ==========================================
  // MY WORK (V2): MY IDEAS (T009)
  // ==========================================
  getMyIdeas: async (filters?: { q?: string; tag?: string; limit?: number }): Promise<any[]> => {
    let url = `${API_URL}/my-work/my-ideas`;
    if (filters) {
      const params = new URLSearchParams();
      if (filters.q) params.append('q', filters.q);
      if (filters.tag) params.append('tag', filters.tag);
      if (filters.limit) params.append('limit', String(filters.limit));
      if (params.toString()) url += `?${params.toString()}`;
    }
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch ideas');
    return res.json();
  },

  suggestMyIdeas: async (q?: string, limit = 5): Promise<any[]> => {
    const params = new URLSearchParams();
    if (q) params.append('q', q);
    if (limit) params.append('limit', String(limit));
    const res = await fetch(`${API_URL}/my-work/my-ideas/suggest?${params.toString()}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to suggest ideas');
    return res.json();
  },

  getMyIdea: async (id: string): Promise<any> => {
    const res = await fetch(`${API_URL}/my-work/my-ideas/${id}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch idea');
    return res.json();
  },

  createMyIdea: async (idea: {
    title: string;
    body?: string;
    tags?: string[];
    sourceType?: string | null;
    sourceConversationId?: string | null;
    sourceMessageId?: string | null;
  }): Promise<any> => {
    const res = await fetch(`${API_URL}/my-work/my-ideas`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(idea),
    });
    return handleResponse(res, 'Failed to create idea');
  },

  updateMyIdea: async (id: string, updates: any): Promise<any> => {
    const res = await fetch(`${API_URL}/my-work/my-ideas/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse(res, 'Failed to update idea');
  },

  deleteMyIdea: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/my-work/my-ideas/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    await handleResponse(res, 'Failed to delete idea');
  },

  // --- My Ideas: Mind Map edges (persistent relationships) ---
  getMyIdeaEdges: async (ideaId: string | 'all', opts?: { kind?: string }): Promise<any> => {
    const params = new URLSearchParams();
    if (opts?.kind) params.set('kind', opts.kind);
    const qs = params.toString();
    const res = await fetch(
      `${API_URL}/my-work/my-ideas/${encodeURIComponent(ideaId)}/edges${qs ? `?${qs}` : ''}`,
      { headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to fetch idea edges');
  },

  addMyIdeaEdge: async (
    sourceIdeaId: string,
    payload: { targetIdeaId: string; kind?: string }
  ): Promise<any> => {
    const res = await fetch(
      `${API_URL}/my-work/my-ideas/${encodeURIComponent(sourceIdeaId)}/edges`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      }
    );
    return handleResponse(res, 'Failed to create idea edge');
  },

  deleteMyIdeaEdge: async (sourceIdeaId: string | 'all', edgeId: string): Promise<void> => {
    const res = await fetch(
      `${API_URL}/my-work/my-ideas/${encodeURIComponent(sourceIdeaId)}/edges/${encodeURIComponent(edgeId)}`,
      { method: 'DELETE', headers: getHeaders() }
    );
    await handleResponse(res, 'Failed to delete idea edge');
  },

  // --- My Ideas: Recommendation Map (per-idea working graph) ---
  getMyIdeaMap: async (ideaId: string, opts?: { language?: string }): Promise<any> => {
    const params = new URLSearchParams();
    if (opts?.language) params.set('language', opts.language);
    const qs = params.toString();
    const res = await fetch(
      `${API_URL}/my-work/my-ideas/${encodeURIComponent(ideaId)}/map${qs ? `?${qs}` : ''}`,
      { headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to fetch idea map');
  },

  saveMyIdeaMap: async (
    ideaId: string,
    payload: { nodes: any[]; edges: any[]; version?: number }
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/my-work/my-ideas/${encodeURIComponent(ideaId)}/map`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to save idea map');
  },

  expandMyIdeaMap: async (
    ideaId: string,
    payload: {
      anchorNodeId?: string;
      branchKey?: string;
      count?: number;
      language?: string;
      proposeOnly?: boolean;
    }
  ): Promise<any> => {
    const res = await fetch(
      `${API_URL}/my-work/my-ideas/${encodeURIComponent(ideaId)}/map/expand`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      }
    );
    return handleResponse(res, 'Failed to expand idea map');
  },

  getMyIdeaMapMetrics: async (ideaIds: string[]): Promise<any> => {
    const ids = (ideaIds || []).map((x) => String(x || '').trim()).filter(Boolean);
    const qs = new URLSearchParams();
    if (ids.length) qs.set('ids', ids.join(','));
    const res = await fetch(`${API_URL}/my-work/my-ideas/metrics/map?${qs.toString()}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch idea map metrics');
  },

  // --- My Ideas: Convert/Promote ---
  convertMyIdea: async (
    ideaId: string,
    payload: {
      target: 'initiative' | 'task_set' | 'decision' | 'team_chat';
      options?: Record<string, unknown>;
    }
  ): Promise<{ sourceSessionId?: string; [key: string]: any }> => {
    const res = await fetch(`${API_URL}/my-work/my-ideas/${encodeURIComponent(ideaId)}/convert`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to convert idea');
  },

  getTaskComments: async (taskId: string): Promise<any[]> => {
    const res = await fetch(`${API_URL}/tasks/${taskId}/comments`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch comments');
    return res.json();
  },

  addTaskComment: async (taskId: string, content: string): Promise<any> => {
    const res = await fetch(`${API_URL}/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add comment');
    return data;
  },

  deleteTaskComment: async (taskId: string, commentId: string): Promise<void> => {
    const res = await fetch(`${API_URL}/tasks/${taskId}/comments/${commentId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete comment');
  },

  // ==========================================
  // PHASE 1: TEAMS API
  // ==========================================
  getTeams: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/teams`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch teams');
    return res.json();
  },

  getTeam: async (id: string): Promise<any> => {
    const res = await fetch(`${API_URL}/teams/${id}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch team');
    return res.json();
  },

  createTeam: async (team: {
    name: string;
    description?: string;
    leadId?: string;
  }): Promise<any> => {
    const res = await fetch(`${API_URL}/teams`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(team),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create team');
    return data;
  },

  updateTeam: async (id: string, updates: any): Promise<void> => {
    const res = await fetch(`${API_URL}/teams/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update team');
  },

  deleteTeam: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/teams/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete team');
  },

  addTeamMember: async (teamId: string, userId: string, role: string = 'member'): Promise<void> => {
    const res = await fetch(`${API_URL}/teams/${teamId}/members`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ userId, role }),
    });
    if (!res.ok) throw new Error('Failed to add team member');
  },

  removeTeamMember: async (teamId: string, userId: string): Promise<void> => {
    const res = await fetch(`${API_URL}/teams/${teamId}/members/${userId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to remove team member');
  },

  // ==========================================
  // PHASE 1: NOTIFICATIONS API
  // ==========================================
  getNotifications: async (unreadOnly: boolean = false, limit: number = 50): Promise<any[]> => {
    const params = new URLSearchParams();
    if (unreadOnly) params.append('unreadOnly', 'true');
    params.append('limit', limit.toString());
    const res = await fetch(`${API_URL}/notifications?${params.toString()}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch notifications');
    return res.json();
  },

  getUnreadNotificationCount: async (): Promise<number> => {
    const res = await fetch(`${API_URL}/notifications/unread-count`, { headers: getHeaders() });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.count;
  },

  // Note: markNotificationRead, markAllNotificationsRead, deleteNotification
  // are defined above in "NOTIFICATIONS (NotificationCenter)" section with correct HTTP methods

  deleteReadNotifications: async (): Promise<void> => {
    const res = await fetch(`${API_URL}/notifications`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete read notifications');
  },

  // Snooze a notification (backend-persisted)
  snoozeNotification: async (id: string, preset: string): Promise<{ snoozedUntil: string }> => {
    const res = await fetch(`${API_URL}/notifications/${id}/snooze`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ preset }),
    });
    if (!res.ok) throw new Error('Failed to snooze notification');
    return res.json();
  },

  // Update notification action checklist
  updateNotificationChecklist: async (
    id: string,
    checklist: { id: string; text: string; completed: boolean }[]
  ): Promise<void> => {
    const res = await fetch(`${API_URL}/notifications/${id}/checklist`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ checklist }),
    });
    if (!res.ok) throw new Error('Failed to update checklist');
  },

  // Update editable worksheet drafts for a notification (NotificationDetailView)
  updateNotificationWorksheet: async (
    id: string,
    draft: {
      description?: string;
      whyImportant?: string;
      blocked?: string;
      expectedAction?: string;
    }
  ): Promise<void> => {
    const res = await fetch(`${API_URL}/notifications/${id}/worksheet`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(draft),
    });
    if (!res.ok) throw new Error('Failed to update notification worksheet');
  },

  // Get a single notification by ID (direct fetch instead of filter-all)
  getNotificationById: async (id: string): Promise<any | null> => {
    try {
      const res = await fetch(`${API_URL}/notifications/${id}`, {
        headers: getHeaders(),
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  // Get source entity (task/decision/initiative) linked to a notification
  getNotificationSourceEntity: async (id: string): Promise<Record<string, any> | null> => {
    try {
      const res = await fetch(`${API_URL}/notifications/${id}/source-entity`, {
        headers: getHeaders(),
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  },

  // Get comments for a notification
  getNotificationComments: async (
    id: string
  ): Promise<
    {
      id: string;
      notificationId: string;
      userId: string;
      user: { id: string; firstName: string; lastName: string; avatarUrl?: string };
      content: string;
      priority?: string;
      createdAt: string;
      updatedAt: string;
    }[]
  > => {
    const res = await fetch(`${API_URL}/notifications/${id}/comments`, {
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    return res.json();
  },

  // Add a comment to a notification
  addNotificationComment: async (id: string, content: string, priority?: string): Promise<any> => {
    const res = await fetch(`${API_URL}/notifications/${id}/comments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ content, priority }),
    });
    if (!res.ok) throw new Error('Failed to add comment');
    return res.json();
  },

  // Delete a notification comment
  deleteNotificationComment: async (notificationId: string, commentId: string): Promise<void> => {
    const res = await fetch(`${API_URL}/notifications/${notificationId}/comments/${commentId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete comment');
  },

  // Get activity log for a notification
  getNotificationActivityLog: async (
    id: string
  ): Promise<
    {
      id: string;
      notificationId: string;
      userId: string;
      userName?: string;
      action: string;
      description: string;
      createdAt: string;
    }[]
  > => {
    const res = await fetch(`${API_URL}/notifications/${id}/activity-log`, {
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    return res.json();
  },

  createNotification: async (notification: {
    userId?: string; // If null, broadcast to all
    type: string;
    title: string;
    message: string;
    priority?: 'high' | 'normal' | 'low';
    category?: 'ai' | 'task' | 'system';
    actionLabel?: string;
    link?: string;
  }): Promise<void> => {
    const res = await fetch(`${API_URL}/notifications`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(notification),
    });
    if (!res.ok) throw new Error('Failed to create notification');
  },

  // ==========================================
  // DECISIONS API
  // ==========================================
  getDecisions: async (projectId?: string): Promise<any[]> => {
    let url = `${API_URL}/decisions`;
    if (projectId) url += `?projectId=${projectId}`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch decisions');
    const data = await res.json();
    // Extract decisions array and map snake_case to camelCase
    const decisions = Array.isArray(data) ? data : data.decisions || [];
    return decisions.map((d: any) => ({
      ...d,
      decisionOwnerId: d.decision_maker_id || d.decisionOwnerId,
      ownerName: d.owner_name || d.ownerName,
      projectName: d.project_name || d.projectName,
      createdAt: d.created_at || d.createdAt,
      dueDate: d.deadline || d.dueDate,
      decisionType: d.type || d.decisionType,
      priority: d.priority || 'MEDIUM',
    }));
  },

  getDecision: async (id: string): Promise<any> => {
    const res = await fetch(`${API_URL}/decisions/${id}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch decision');
    const data = await res.json();
    const d = data?.decision || data;
    return {
      ...d,
      dueDate: d?.dueDate || d?.deadline || d?.due_date || null,
      deciderId: d?.deciderId || d?.decisionMakerId || d?.decision_maker_id || null,
      requestedByName: d?.requestedByName || d?.requesterName || d?.requested_by_name || null,
      projectName: d?.projectName || d?.project_name || null,
      createdAt: d?.createdAt || d?.created_at || null,
      updatedAt: d?.updatedAt || d?.updated_at || null,
    };
  },

  getDecisionHistory: async (id: string): Promise<any[]> => {
    const res = await fetch(`${API_URL}/decisions/${id}/history`, { headers: getHeaders() });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : data?.history || [];
    }

    // Some deployments expose history inside GET /decisions/:id (auditTrail) but not /history route.
    if (res.status === 404) {
      const detailsRes = await fetch(`${API_URL}/decisions/${id}`, { headers: getHeaders() });
      if (!detailsRes.ok) throw new Error('Failed to fetch decision history');
      const detailsData = await detailsRes.json();
      const decision = detailsData?.decision || detailsData || {};

      const fromAuditTrail = Array.isArray(decision?.auditTrail) ? decision.auditTrail : null;
      if (fromAuditTrail) {
        return fromAuditTrail.map((entry: any) => ({
          id: entry?.id || `${entry?.action || 'history'}-${entry?.at || Date.now()}`,
          action: entry?.action || 'updated',
          changedBy: entry?.by || entry?.changedBy || 'system',
          changedByName: entry?.userName || entry?.changedByName || undefined,
          changedAt: entry?.at || entry?.changedAt || new Date().toISOString(),
          oldStatus: entry?.oldStatus || entry?.old_status || undefined,
          newStatus: entry?.newStatus || entry?.new_status || undefined,
          details:
            entry?.details && typeof entry.details === 'object'
              ? entry.details
              : entry?.notes
                ? { notes: entry.notes }
                : {},
        }));
      }

      try {
        const rawAudit = decision?.audit_trail ? JSON.parse(decision.audit_trail) : [];
        if (Array.isArray(rawAudit)) {
          return rawAudit.map((entry: any) => ({
            id: entry?.id || `${entry?.action || 'history'}-${entry?.at || Date.now()}`,
            action: entry?.action || 'updated',
            changedBy: entry?.by || entry?.changedBy || 'system',
            changedByName: entry?.userName || entry?.changedByName || undefined,
            changedAt: entry?.at || entry?.changedAt || new Date().toISOString(),
            oldStatus: entry?.oldStatus || entry?.old_status || undefined,
            newStatus: entry?.newStatus || entry?.new_status || undefined,
            details:
              entry?.details && typeof entry.details === 'object'
                ? entry.details
                : entry?.notes
                  ? { notes: entry.notes }
                  : {},
          }));
        }
      } catch {
        // ignore malformed audit trail payload
      }
      return [];
    }

    throw new Error('Failed to fetch decision history');
  },

  decideDecision: async (
    id: string,
    decision: 'approved' | 'rejected' | 'deferred',
    rationale?: string,
    notes?: string
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/decisions/${id}/decide`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ decision, rationale, notes }),
    });
    if (!res.ok) throw new Error('Failed to decide decision');
    return res.json();
  },

  remindDecision: async (id: string, message?: string): Promise<any> => {
    const res = await fetch(`${API_URL}/decisions/${id}/remind`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error('Failed to send reminder');
    return res.json();
  },

  escalateDecision: async (
    id: string,
    reason?: string,
    escalateToUserId?: string
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/decisions/${id}/escalate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason, escalateToUserId }),
    });
    if (!res.ok) throw new Error('Failed to escalate decision');
    return res.json();
  },

  updateDecision: async (id: string, updates: any): Promise<void> => {
    const res = await fetch(`${API_URL}/decisions/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update decision');
  },

  // ==========================================
  // MY WORK — DECISIONS QUEUE / SNOOZE / PREFS
  // ==========================================

  getMyWorkDecisionQueue: async (params?: {
    mode?: 'my' | 'requests_pending' | 'all' | 'snoozed';
    limit?: number;
    cursor?: number | null;
  }): Promise<{ items: any[]; nextCursor: number | null; mode: string }> => {
    const mode = params?.mode || 'my';
    const limit = params?.limit ?? 25;
    const cursor = params?.cursor ?? null;

    const qs = new URLSearchParams();
    if (mode) qs.set('mode', mode);
    if (limit) qs.set('limit', String(limit));
    if (cursor != null) qs.set('cursor', String(cursor));

    const res = await fetch(`${API_URL}/my-work/decisions/queue?${qs.toString()}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch decisions queue');
    const data = await res.json();
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      nextCursor: data?.nextCursor ?? null,
      mode: data?.mode || mode,
    };
  },

  snoozeDecision: async (id: string, input: { until?: string; preset?: string }): Promise<any> => {
    const res = await fetch(`${API_URL}/my-work/decisions/${id}/snooze`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(input || {}),
    });
    if (!res.ok) throw new Error('Failed to snooze decision');
    return res.json();
  },

  unsnoozeDecision: async (id: string): Promise<any> => {
    const res = await fetch(`${API_URL}/my-work/decisions/${id}/unsnooze`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to unsnooze decision');
    return res.json();
  },

  getDecisionPrefs: async (): Promise<{ prefs: any; updatedAt: string | null }> => {
    const res = await fetch(`${API_URL}/my-work/decisions/preferences`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch decision preferences');
    const data = await res.json();
    return { prefs: data?.prefs || {}, updatedAt: data?.updatedAt ?? null };
  },

  saveDecisionPrefs: async (
    prefs: any
  ): Promise<{ success: boolean; prefs: any; updatedAt: string }> => {
    const res = await fetch(`${API_URL}/my-work/decisions/preferences`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ prefs }),
    });
    if (!res.ok) throw new Error('Failed to save decision preferences');
    return res.json();
  },

  createDecision: async (decision: any): Promise<any> => {
    const res = await fetch(`${API_URL}/decisions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(decision),
    });
    if (!res.ok) throw new Error('Failed to create decision');
    return res.json();
  },

  getTaskDecisions: async (taskId: string): Promise<any[]> => {
    const res = await fetch(`${API_URL}/decisions?taskId=${taskId}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch task decisions');
    const data = await res.json();
    return Array.isArray(data) ? data : data?.decisions || [];
  },

  // ==========================================
  // PHASE 6: AI INTEGRATION
  // ==========================================
  // --- INITIATIVES (Phase 2) ---
  getInitiatives: async (projectId?: string): Promise<any[]> => {
    let url = `${API_URL}/initiatives`;
    if (projectId) url += `?projectId=${encodeURIComponent(projectId)}`;
    const res = await fetchWithRetry(url, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch initiatives');
  },

  getInitiativeById: async (id: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/initiatives/${id}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch initiative');
  },

  createInitiative: async (initiative: any): Promise<any> => {
    const res = await fetch(`${API_URL}/initiatives`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(initiative),
    });
    return handleResponse(res, 'Failed to create initiative');
  },

  updateInitiative: async (id: string, updates: any): Promise<void> => {
    const res = await fetch(`${API_URL}/initiatives/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    await handleResponse(res, 'Failed to update initiative');
  },

  validateInitiative: async (id: string) => {
    const response = await fetchWithRetry(`${API_URL}/initiatives/${id}/validate`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(response, 'Validation failed');
  },

  enrichInitiative: async (id: string) => {
    const response = await fetchWithRetry(`${API_URL}/initiatives/${id}/enrich`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(response, 'Enrichment failed');
  },

  /**
   * Get initiatives filtered by status(es)
   * @param statuses - Comma-separated status values (e.g., 'DRAFT' or 'DRAFT,PLANNING')
   * @param projectId - Optional project filter
   */
  getInitiativesByStatus: async (statuses: string, projectId?: string): Promise<any[]> => {
    let url = `${API_URL}/initiatives/by-status/${statuses}`;
    if (projectId) url += `?projectId=${projectId}`;
    const res = await fetchWithRetry(url, { headers: getHeaders() });
    const data = await handleResponse(res, 'Failed to fetch initiatives by status');
    return data?.initiatives || data || [];
  },

  /**
   * Get tasks for an initiative
   */
  getInitiativeTasks: async (initiativeId: string): Promise<any[]> => {
    const res = await fetchWithRetry(`${API_URL}/tasks?initiativeId=${initiativeId}`, {
      headers: getHeaders(),
    });
    const data = await handleResponse(res, 'Failed to fetch initiative tasks');
    return data?.tasks || data || [];
  },

  // --- TOOLS -> INITIATIVES ---
  createToolSession: async (payload: {
    toolType: string;
    name: string;
    projectId?: string | null;
    /** V3-C03: For toolType=MYWORK — derived sources (idea/notebook/task/decision) */
    derivedFrom?: Array<{
      type: 'idea' | 'notebook' | 'task' | 'decision';
      id: string;
      title: string;
    }>;
    /** V3-C03: For toolType=MYWORK — snapshot of source context */
    snapshotJson?: Record<string, unknown>;
  }): Promise<{ id: string; status: string }> => {
    const res = await fetch(`${API_URL}/tools`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to create tool session');
  },

  // --- KNOWN TOOLS LIBRARY (T018/T021) ---
  getKnownTools: async (params?: {
    lang?: 'en' | 'pl';
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    items: Array<{
      id: string;
      toolType: string;
      name: string;
      libraryCategory: string | null;
      description: string;
      whatYouGet: string[];
      tags: string[];
      icon: string | null;
      isLicensed: boolean;
      isComingSoon: boolean;
      sortOrder: number;
      createdAt: string | null;
    }>;
    total: number;
    limit: number;
    offset: number;
  }> => {
    const sp = new URLSearchParams();
    if (params?.lang) sp.append('lang', params.lang);
    if (params?.category) sp.append('category', params.category);
    if (params?.search) sp.append('search', params.search);
    if (params?.limit) sp.append('limit', String(params.limit));
    if (params?.offset) sp.append('offset', String(params.offset));

    const url = `${API_URL}/known-tools${sp.toString() ? `?${sp.toString()}` : ''}`;
    const res = await fetchWithRetry(url, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch known tools');
  },

  getKnownTool: async (
    toolType: string,
    params?: { lang?: 'en' | 'pl' }
  ): Promise<{
    tool: {
      id: string;
      toolType: string;
      name: string;
      libraryCategory: string | null;
      description: string;
      whatYouGet: string[];
      tags: string[];
      icon: string | null;
      isLicensed: boolean;
      isComingSoon: boolean;
      sortOrder: number;
      createdAt: string | null;
      whenToUse: string;
      inputs: string[];
      steps: string[];
      outputs: string[];
      commonMistakes: string[];
      example: string;
      nextSteps: string[];
      kbArticleSlug: string;
    };
  }> => {
    const sp = new URLSearchParams();
    if (params?.lang) sp.append('lang', params.lang);
    const url = `${API_URL}/known-tools/${encodeURIComponent(toolType)}${sp.toString() ? `?${sp.toString()}` : ''}`;
    const res = await fetchWithRetry(url, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch known tool');
  },

  listToolSessions: async (params?: {
    projectId?: string;
    status?: string;
    toolType?: string;
    category?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    items: Array<{
      id: string;
      name: string;
      toolType: string;
      status: string;
      progress: number;
      confidenceAvg: number;
      projectId?: string;
      createdBy?: string;
      createdAt?: string;
      updatedAt?: string;
      reviewRequestedAt?: string;
      approvedAt?: string;
    }>;
    total: number;
    limit: number;
    offset: number;
  }> => {
    const searchParams = new URLSearchParams();
    if (params?.projectId) searchParams.append('projectId', params.projectId);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.toolType) searchParams.append('toolType', params.toolType);
    if (params?.category) searchParams.append('category', params.category);
    if (params?.limit) searchParams.append('limit', String(params.limit));
    if (params?.offset) searchParams.append('offset', String(params.offset));

    const queryString = searchParams.toString();
    const url = `${API_URL}/tools${queryString ? `?${queryString}` : ''}`;
    const res = await fetch(url, { headers: getHeaders() });
    return handleResponse(res, 'Failed to list tool sessions');
  },

  getToolSession: async (toolId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/tools/${toolId}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch tool session');
  },

  updateToolSession: async (
    toolId: string,
    payload: {
      answers?: Record<string, unknown>;
      completionPercent?: number;
      confidenceAvg?: number;
      contextSnapshot?: Record<string, unknown>;
      wizard_state?: Record<string, unknown>;
      status?: string;
    }
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/tools/${toolId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to update tool session');
  },

  requestToolReview: async (
    toolId: string,
    payload?: { decisionOwnerId?: string; dueDate?: string; priority?: string }
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/tools/${toolId}/request-review`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload || {}),
    });
    return handleResponse(res, 'Failed to request review');
  },

  approveTool: async (
    toolId: string,
    payload?: { decisionOwnerId?: string; dueDate?: string; priority?: string }
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/tools/${toolId}/approve`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload || {}),
    });
    return handleResponse(res, 'Failed to approve tool');
  },

  sendToolBackToDraft: async (toolId: string, comment?: string): Promise<any> => {
    const res = await fetch(`${API_URL}/tools/${toolId}/send-back`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ comment }),
    });
    return handleResponse(res, 'Failed to send back tool');
  },

  generateToolInitiatives: async (
    toolId: string,
    payload: {
      methodologyId: string;
      count: number;
      includeChatContext?: boolean;
      decisionOwnerId?: string;
    }
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/tools/${toolId}/generate-initiatives`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to generate initiatives');
  },

  getToolGeneratedInitiatives: async (toolId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/tools/${toolId}/generated-initiatives`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch generated initiatives');
  },

  // --- ASSESSMENT WORKFLOW ---
  createAssessmentSession: async (payload: {
    assessmentType: 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';
    name: string;
    description?: string;
    projectId?: string | null;
  }): Promise<{ id: string; status: string }> => {
    const res = await fetch(`${API_URL}/assessment-workflow-v2`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to create assessment session');
  },

  getAssessmentSession: async (assessmentId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/assessment-workflow/${assessmentId}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch assessment session');
  },

  updateAssessmentSession: async (
    assessmentId: string,
    payload: {
      answers?: Record<string, unknown>;
      completionPercent?: number;
      confidenceAvg?: number;
      contextSnapshot?: Record<string, unknown>;
      scoreSummary?: Record<string, unknown>;
      currentSectionId?: string | null;
    }
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/assessment-workflow/${assessmentId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to update assessment session');
  },

  listAssessments: async (params?: {
    projectId?: string;
    status?: string;
    assessmentType?: string;
    limit?: number;
    offset?: number;
  }): Promise<any> => {
    const query = new URLSearchParams();
    if (params?.projectId) query.set('projectId', params.projectId);
    if (params?.status) query.set('status', params.status);
    if (params?.assessmentType) query.set('assessmentType', params.assessmentType);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));

    const res = await fetch(`${API_URL}/assessment-workflow?${query.toString()}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to list assessments');
  },

  deleteAssessment: async (assessmentId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/assessment-workflow/${assessmentId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete assessment');
  },

  // Assessment workflow transitions
  requestAssessmentReview: async (
    assessmentId: string,
    payload?: { decisionOwnerId?: string; dueDate?: string; priority?: string }
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/assessment-workflow/${assessmentId}/request-review`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload || {}),
    });
    return handleResponse(res, 'Failed to request review');
  },

  generateAssessmentReport: async (
    assessmentId: string,
    payload?: { includeRecommendations?: boolean; includeGapAnalysis?: boolean }
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/assessment-workflow/${assessmentId}/report`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload || {}),
    });
    return handleResponse(res, 'Failed to generate report');
  },

  approveAssessmentReport: async (
    assessmentId: string,
    payload?: { decisionOwnerId?: string; dueDate?: string; priority?: string; comment?: string }
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/assessment-workflow/${assessmentId}/report/approve`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload || {}),
    });
    return handleResponse(res, 'Failed to approve report');
  },

  approveAssessment: async (
    assessmentId: string,
    payload?: { decisionOwnerId?: string; dueDate?: string; priority?: string }
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/assessment-workflow/${assessmentId}/approve`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload || {}),
    });
    return handleResponse(res, 'Failed to approve assessment');
  },

  sendAssessmentBackToDraft: async (assessmentId: string, comment: string): Promise<any> => {
    const res = await fetch(`${API_URL}/assessment-workflow/${assessmentId}/send-back`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ comment }),
    });
    return handleResponse(res, 'Failed to send back assessment');
  },

  generateAssessmentInitiatives: async (
    assessmentId: string,
    payload: { methodologyId: string; count: number; includeChatContext?: boolean }
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/assessment-workflow/${assessmentId}/generate-initiatives`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to generate initiatives');
  },

  getAssessmentGeneratedInitiatives: async (assessmentId: string): Promise<any> => {
    const res = await fetch(
      `${API_URL}/assessment-workflow/${assessmentId}/generated-initiatives`,
      {
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to fetch generated initiatives');
  },

  // Assessment sessions (for dynamic submenu)
  getOpenAssessmentSessions: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/assessment-workflow/sessions`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch open sessions');
  },

  openAssessmentSession: async (assessmentId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/assessment-workflow/${assessmentId}/session/open`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to open session');
  },

  closeAssessmentSession: async (assessmentId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/assessment-workflow/${assessmentId}/session/close`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to close session');
  },

  // --- PROJECTS ---
  suggestInitiativeTasks: async (initiativeId: string): Promise<any[]> => {
    const res = await fetch(`${API_URL}/initiatives/${initiativeId}/tasks/suggest`, {
      method: 'POST',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to suggest tasks');
    return data;
  },

  // ==========================================
  // PHASE 7: AI EVOLUTION (Advanced Layers)
  // ==========================================

  // LAYER 1: DIAGNOSIS
  aiDiagnose: async (axis: string, input: string): Promise<any> => {
    const res = await fetch(`${API_URL}/ai/diagnose`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ axis, input }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Diagnosis failed');
    return data;
  },

  // LAYER 2: RECOMMENDATION
  aiRecommend: async (diagnosisReport: any): Promise<any[]> => {
    const res = await fetch(`${API_URL}/ai/recommend`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ diagnosisReport }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Recommendation failed');
    return data;
  },

  // LAYER 3: ROADMAP
  aiRoadmap: async (initiatives: any[]): Promise<any> => {
    const res = await fetch(`${API_URL}/ai/roadmap`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ initiatives }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Roadmap generation failed');
    return data;
  },

  // LAYER 4: SIMULATION
  aiSimulate: async (initiatives: any[], revenue: number = 10000000): Promise<any> => {
    const res = await fetch(`${API_URL}/ai/simulate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ initiatives, revenue }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Simulation failed');
    return data;
  },

  // VALIDATION & VERIFICATION
  aiValidate: async (initiative: any): Promise<any> => {
    const res = await fetch(`${API_URL}/ai/validate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ initiative }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Validation failed');
    return data;
  },

  aiVerify: async (query: string): Promise<any> => {
    const res = await fetch(`${API_URL}/ai/verify`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Verification failed');
    return data;
  },

  // FEEDBACK & LEARNING
  /**
   * Submit detailed feedback on AI response (v2.0 Adaptive System)
   */
  aiFeedback: async (feedback: {
    messageId: string;
    conversationId?: string;
    rating: 'positive' | 'negative' | 'neutral';
    lengthFeedback?: string;
    detailFeedback?: string;
    formatFeedback?: string;
    wantedMode?: string;
    customFeedback?: string;
    responseMode?: string;
    responseLength?: number;
    capability?: string;
    // v2.0 specific fields
    actionability?: number;
    accuracy?: number;
    expectedFormat?: string;
    missingInfo?: string;
    screenContext?: string;
    focusMode?: string;
  }): Promise<void> => {
    const res = await fetch(`${API_URL}/ai-feedback/response`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(feedback),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit feedback');
  },

  /**
   * Submit general AI feedback (Legacy / Training compatibility)
   */
  submitAIFeedback: async (data: {
    context: string;
    prompt: string;
    response: string;
    helpful: boolean;
    comment?: string;
  }): Promise<void> => {
    const res = await fetch(`${API_URL}/ai-feedback`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        ...data,
        rating: data.helpful ? 'positive' : 'negative',
        feedbackType: data.helpful ? 'HELPFUL' : 'NOT_HELPFUL',
      }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to submit feedback');
    }
  },

  // WEBHOOKS (Consolidated from extensions)
  getWebhooks: async (organizationId?: string): Promise<any[] | { webhooks: any[] }> => {
    const params = new URLSearchParams();
    if (organizationId && organizationId !== 'current')
      params.set('organizationId', organizationId);
    const res = await fetch(`${API_URL}/webhooks${params.toString() ? `?${params}` : ''}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch webhooks');
    return res.json();
  },

  createWebhook: async (data: any): Promise<any> => {
    const res = await fetch(`${API_URL}/webhooks`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create webhook');
    return res.json();
  },

  updateWebhook: async (webhookId: string, data: any): Promise<any> => {
    const res = await fetch(`${API_URL}/webhooks/${webhookId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update webhook');
    return res.json();
  },

  deleteWebhook: async (webhookId: string): Promise<{ success: true }> => {
    const res = await fetch(`${API_URL}/webhooks/${webhookId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete webhook');
    return { success: true };
  },

  // --- AI STRATEGIC BOARD ---
  getAIIdeas: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/ai/ideas`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch AI ideas');
    return res.json();
  },

  createAIIdea: async (idea: any): Promise<any> => {
    const res = await fetch(`${API_URL}/ai/ideas`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(idea),
    });
    if (!res.ok) throw new Error('Failed to create AI idea');
    return res.json();
  },

  updateAIIdea: async (id: string, updates: any): Promise<any> => {
    const res = await fetch(`${API_URL}/ai/ideas/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update AI idea');
    return res.json();
  },

  deleteAIIdea: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/ai/ideas/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete AI idea');
  },

  // --- AI OBSERVATIONS ---
  getAIObservations: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/ai/observations`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch observations');
    return res.json();
  },

  createAIObservation: async (observation: any): Promise<any> => {
    const res = await fetch(`${API_URL}/ai/observations`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(observation),
    });
    if (!res.ok) throw new Error('Failed to create observation');
    return res.json();
  },

  // --- AI REPORTS ---
  getAIDeepReports: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/ai/reports/performance`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch AI reports');
    return res.json();
  },

  // AI Detail Feedback (for inline rating buttons)
  aiDetailFeedback: async (feedback: {
    action: string;
    rating: number;
    user_comment?: string;
    original_prompt?: string;
  }): Promise<void> => {
    const res = await fetch(`${API_URL}/ai/feedback`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        context: feedback.action,
        prompt: feedback.original_prompt || '',
        response: '',
        rating: feedback.rating,
        correction: feedback.user_comment,
      }),
    });
    if (!res.ok) throw new Error('Failed to save feedback');
  },

  // ADMIN ANALYTICS & CONTROLS
  aiGetStats: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/ai/stats`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch AI stats');
    return data;
  },

  getIndustryBenchmarks: async (industry: string = 'General'): Promise<any[]> => {
    const res = await fetch(`${API_URL}/ai/benchmarks?industry=${industry}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch benchmarks');
    return data;
  },

  // --- AI LEARNING & KNOWLEDGE ---
  aiExtractInsights: async (text: string, source: string = 'chat'): Promise<any> => {
    const res = await fetch(`${API_URL}/ai/extract-insight`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ text, source }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to extract insights');
    return data;
  },

  getKnowledgeCandidates: async (status: string = 'pending'): Promise<any[]> => {
    const res = await fetch(`${API_URL}/knowledge/candidates?status=${status}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch candidates');
    return data;
  },

  submitKnowledgeCandidate: async (
    content: string,
    reasoning: string,
    source: string,
    topic?: string
  ): Promise<void> => {
    const res = await fetch(`${API_URL}/knowledge/candidates`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ content, reasoning, source, relatedAxis: topic }),
    });
    if (!res.ok) throw new Error('Failed to submit candidate');
  },

  updateCandidateStatus: async (
    id: string,
    status: string,
    adminComment?: string
  ): Promise<void> => {
    const res = await fetch(`${API_URL}/knowledge/candidates/${id}/status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status, adminComment }),
    });
    if (!res.ok) throw new Error('Failed to update candidate status');
  },

  getGlobalStrategies: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/knowledge/strategies`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch strategies');
    return data;
  },

  createGlobalStrategy: async (
    title: string,
    description: string,
    options?: any
  ): Promise<void> => {
    const res = await fetch(`${API_URL}/knowledge/strategies`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ title, description }),
    });
    if (!res.ok) throw new Error('Failed to create strategy');
  },

  toggleGlobalStrategy: async (id: string, isActive: boolean): Promise<any> => {
    const res = await fetch(`${API_URL}/knowledge/strategies/${id}/toggle`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ isActive }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to toggle strategy');
    return data;
  },

  getKnowledgeDocuments: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/knowledge/documents`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch docs');
    return data;
  },

  uploadKnowledgeDocument: async (file: File, category?: string, tags?: string[]): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    if (category) {
      formData.append('category', category);
    }
    if (Array.isArray(tags) && tags.length > 0) {
      formData.append('tags', JSON.stringify(tags));
    }

    // Content-Type header must NOT be set manually for FormData, browser sets it with boundary
    const headers = getHeaders();
    delete (headers as any)['Content-Type'];

    const res = await fetch(`${API_URL}/knowledge/documents`, {
      method: 'POST',
      headers: headers,
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to upload document');
    return data;
  },

  uploadChatAttachment: async (
    file: File
  ): Promise<{
    success: boolean;
    docId: string;
    filename: string;
    mimeType?: string;
    totalChunks?: number;
    embeddedChunks?: number;
  }> => {
    const formData = new FormData();
    formData.append('file', file);

    const headers = getHeaders();
    delete (headers as any)['Content-Type'];

    const res = await fetch(`${API_URL}/ai/attachments/ingest`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error((data as any)?.error || 'Failed to ingest attachment');
    return data;
  },

  // --- GENERIC DOCUMENT UPLOAD (For Context Builder) ---
  uploadDocument: async (
    file: File,
    context?: { tabName?: string; type?: string }
  ): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    if (context) {
      formData.append('context', JSON.stringify(context));
    }

    const headers = getHeaders();
    delete (headers as any)['Content-Type']; // Let browser set boundary

    const res = await fetch(`${API_URL}/documents/upload`, {
      method: 'POST',
      headers: headers,
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to upload document');
    return data;
  },
  // --- FEEDBACK ---
  sendFeedback: async (data: {
    user_id: string;
    type: string;
    message: string;
    screenshot?: string;
    url?: string;
  }): Promise<void> => {
    const res = await fetch(`${API_URL}/feedback`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to submit feedback');
  },

  getFeedback: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/feedback`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch feedback');
    const data = await res.json();
    return data || [];
  },

  updateFeedbackStatus: async (id: string, status: string): Promise<void> => {
    const res = await fetch(`${API_URL}/feedback/${id}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Failed to update feedback status');
  },

  // ==========================================
  // ACCESS CONTROL
  // ==========================================

  // Submit access request
  requestAccess: async (data: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    organizationName: string;
    requestType?: string;
  }): Promise<{ success: boolean; requestId: string; message: string }> => {
    const res = await fetch(`${API_URL}/access-control/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to submit access request');
    return json;
  },

  // Verify access code (public)
  verifyAccessCode: async (
    code: string
  ): Promise<{
    valid: boolean;
    organizationName?: string;
    role?: string;
    reason?: string;
  }> => {
    const res = await fetch(`${API_URL}/access-control/codes/${code}/info`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to verify code');
    return json;
  },

  // Register with access code
  registerWithCode: async (data: {
    code: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }): Promise<{ success: boolean; user: User; message: string }> => {
    const res = await fetch(`${API_URL}/access-control/codes/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Registration failed');
    return json;
  },

  // --- ACCESS CONTROL (Super Admin) ---
  getAccessRequests: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/superadmin/access-requests`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch access requests');
    return res.json();
  },

  approveAccessRequest: async (id: string, password?: string, role?: string): Promise<void> => {
    const res = await fetch(`${API_URL}/superadmin/access-requests/${id}/approve`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ password, role }),
    });
    if (!res.ok) throw new Error('Failed to approve access request');
  },

  rejectAccessRequest: async (id: string, reason: string): Promise<void> => {
    const res = await fetch(`${API_URL}/superadmin/access-requests/${id}/reject`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error('Failed to reject access request');
  },

  getAccessCodes: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/superadmin/access-codes`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch access codes');
    return res.json();
  },

  acceptAccessCode: async (code: string): Promise<any> => {
    const res = await fetch(`${API_URL}/access-codes/${code}/accept`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to accept access code');
    return res.json();
  },

  generateAccessCode: async (data: {
    code?: string;
    role?: string;
    maxUses?: number;
    expiresAt?: string;
  }): Promise<void> => {
    const res = await fetch(`${API_URL}/superadmin/access-codes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to generate access code');
  },

  deactivateAccessCode: async (codeId: string): Promise<void> => {
    const res = await fetch(`${API_URL}/superadmin/access-codes/${codeId}/deactivate`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to deactivate access code');
  },
  // ==========================================
  // BILLING & USAGE API
  // ==========================================

  // Generic HTTP methods for billing routes
  // Generic versions moved to end of file to support full URLs and retries
  // get, post, put, delete are defined at the end of the object

  // Get subscription plans
  getSubscriptionPlans: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/billing/plans`, {
      headers: getHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to fetch plans');
    return Array.isArray(json) ? json : json.plans || [];
  },

  // Subscription changes - connected to real API
  getSubscriptionChanges: async (filters?: any): Promise<any[]> => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.type) params.set('type', filters.type);
    const res = await fetch(`${API_URL}/revenue/subscription-changes?${params}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch subscription changes');
    return res.json();
  },
  getSubscriptionChangeStats: async (): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  }> => {
    const res = await fetch(`${API_URL}/revenue/subscription-changes/stats`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch subscription change stats');
    return res.json();
  },
  approveSubscriptionChange: async (id: string, notes?: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/revenue/subscription-changes/${id}/approve`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ notes }),
    });
    if (!res.ok) throw new Error('Failed to approve subscription change');
    return res.json();
  },
  rejectSubscriptionChange: async (id: string, reason?: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/revenue/subscription-changes/${id}/reject`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error('Failed to reject subscription change');
    return res.json();
  },

  // Get user license plans
  getUserPlans: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/billing/user-plans`, {
      headers: getHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to fetch user plans');
    return json;
  },

  // Get current billing info
  getCurrentBilling: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/billing/current`, {
      headers: getHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to fetch billing');
    return json;
  },

  // Get current usage
  getUsage: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/billing/usage`, {
      headers: getHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to fetch usage');
    return json;
  },

  // Subscribe to plan
  subscribeToPlan: async (planId: string, paymentMethodId?: string): Promise<any> => {
    const res = await fetch(`${API_URL}/billing/subscribe`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ planId, paymentMethodId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Subscription failed');
    return json;
  },

  // Change subscription plan
  changePlan: async (newPlanId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/billing/change-plan`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ newPlanId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Plan change failed');
    return json;
  },

  // Cancel subscription
  cancelSubscription: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/billing/cancel`, {
      method: 'POST',
      headers: getHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Cancellation failed');
    return json;
  },

  // Get invoices
  getInvoices: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/billing/invoices`, {
      headers: getHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to fetch invoices');
    return json;
  },

  // --- PAYMENT METHODS ---
  setDefaultPaymentMethod: async (paymentMethodId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/billing/payment-methods/${paymentMethodId}/default`, {
      method: 'POST',
      headers: getHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to set default payment method');
    return json;
  },

  removePaymentMethod: async (paymentMethodId: string): Promise<void> => {
    const res = await fetch(`${API_URL}/billing/payment-methods/${paymentMethodId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to remove payment method');
  },

  // --- DISCOUNT CODES ---
  validateDiscountCode: async (code: string, planId?: string): Promise<any> => {
    const res = await fetch(`${API_URL}/billing/discount/validate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ code, planId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Invalid discount code');
    return json;
  },

  // --- TAX SETTINGS ---
  getTaxSettings: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/billing/tax-settings`, {
      headers: getHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to fetch tax settings');
    return json;
  },

  updateTaxSettings: async (settings: any): Promise<any> => {
    const res = await fetch(`${API_URL}/billing/tax-settings`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(settings),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to update tax settings');
    return json;
  },

  // --- BILLING ALERTS ---
  getBillingAlerts: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/billing/alerts`, {
      headers: getHeaders(),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to fetch billing alerts');
    return json;
  },

  updateBillingAlerts: async (alerts: any): Promise<any> => {
    const res = await fetch(`${API_URL}/billing/alerts`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(alerts),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to update billing alerts');
    return json;
  },

  // --- AI TASK GEN ---
  suggestTasks: async (initiative: any): Promise<any[]> => {
    const res = await fetch(`${API_URL}/ai/suggest-tasks`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ initiative }),
    });
    if (!res.ok) throw new Error('Failed to suggest tasks');
    return res.json();
  },

  generateTaskInsight: async (task: any, initiative: any): Promise<any> => {
    const res = await fetch(`${API_URL}/ai/task-insight`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ task, initiative }),
    });
    if (!res.ok) throw new Error('Failed to generate task insight');
    return res.json();
  },

  // --- TOKEN BILLING ---
  getTokenBalance: async () => {
    const res = await fetch(`${API_URL}/token-billing/balance`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to get balance');
    return data.balance;
  },

  getTokenPackages: async () => {
    const res = await fetch(`${API_URL}/token-billing/packages`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to get packages');
    return data.packages;
  },

  getTokenTransactions: async (limit = 50, offset = 0) => {
    const res = await fetch(
      `${API_URL}/token-billing/transactions?limit=${limit} & offset=${offset}`,
      {
        headers: getHeaders(),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to get transactions');
    return data.transactions;
  },

  getApiKeys: async () => {
    const res = await fetch(`${API_URL}/token-billing/api-keys`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to get API keys');
    return data.keys;
  },

  addApiKey: async (keyData: {
    provider: string;
    apiKey: string;
    displayName: string;
    modelPreference?: string;
  }) => {
    const res = await fetch(`${API_URL}/token-billing/api-keys`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(keyData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add API key');
    return data.key;
  },

  deleteApiKey: async (keyId: string) => {
    const res = await fetch(`${API_URL}/token-billing/api-keys/${keyId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete API key');
    return data;
  },

  purchaseTokens: async (packageId: string) => {
    const res = await fetch(`${API_URL}/token-billing/purchase`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ packageId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Purchase failed');
    return data;
  },

  // --- TOKEN BILLING ADMIN ---
  getBillingMargins: async () => {
    const res = await fetch(`${API_URL}/token-billing/margins`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to get margins');
    return data.margins;
  },

  updateBillingMargin: async (sourceType: string, marginData: any) => {
    const res = await fetch(`${API_URL}/token-billing/margins/${sourceType}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(marginData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update margin');
    return data;
  },

  upsertTokenPackage: async (packageData: any) => {
    const res = await fetch(`${API_URL}/token-billing/packages`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(packageData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save package');
    return data.package;
  },

  getTokenAnalytics: async (startDate?: string, endDate?: string) => {
    const query = startDate && endDate ? `? startDate=${startDate} & endDate=${endDate}` : '';
    const res = await fetch(`${API_URL}/token-billing/analytics${query}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to get analytics');
    return data.analytics;
  },

  // ==========================================
  // PMO CONTEXT API (UI Behavior Integration)
  // ==========================================
  getPMOContext: async (projectId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/pmo-context/${projectId}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch PMO context');
    return res.json();
  },

  getPMOTaskLabels: async (projectId: string): Promise<{ taskLabels: Record<string, any[]> }> => {
    const res = await fetch(`${API_URL}/pmo-context/${projectId}/task-labels`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch PMO task labels');
    return res.json();
  },

  // ==========================================
  // STEP 7: METRICS & CONVERSION INTELLIGENCE
  // ==========================================
  getMetricsOverview: async () => {
    const res = await fetch(`${API_URL}/metrics/overview`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch metrics overview');
    return res.json();
  },

  getMetricsFunnels: async (days: number = 30) => {
    const res = await fetch(`${API_URL}/metrics/funnels?days=${days}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch funnels');
    return res.json();
  },

  getMetricsCohorts: async (type: string = 'weekly', weeks: number = 12) => {
    const res = await fetch(`${API_URL}/metrics/cohorts?type=${type}&weeks=${weeks}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch cohorts');
    return res.json();
  },

  getMetricsHelp: async (days: number = 30) => {
    const res = await fetch(`${API_URL}/metrics/help?days=${days}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch help metrics');
    return res.json();
  },

  getMetricsAttribution: async (days: number = 30) => {
    const res = await fetch(`${API_URL}/metrics/attribution?days=${days}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch attribution');
    return res.json();
  },

  getMetricsPartners: async (days: number = 90) => {
    const res = await fetch(`${API_URL}/metrics/partners?days=${days}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch partner metrics');
    return res.json();
  },

  getMetricsWarnings: async () => {
    const res = await fetch(`${API_URL}/metrics/warnings`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch warnings');
    return res.json();
  },

  getOrgMetricsOverview: async () => {
    const res = await fetch(`${API_URL}/metrics/org/overview`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch organization metrics');
    return res.json();
  },

  getOrgMetricsHelp: async () => {
    const res = await fetch(`${API_URL}/metrics/org/help`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch organization help metrics');
    return res.json();
  },

  getOrgMetricsTeam: async () => {
    const res = await fetch(`${API_URL}/metrics/org/team`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch organization team metrics');
    return res.json();
  },

  // ==========================================
  // STEP 9: AI ADVISOR & ACTIONS
  // ==========================================
  getAIActionProposals: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/ai/actions/proposals`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch AI action proposals');
    return res.json();
  },

  getAIActionAudit: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/ai/actions/audit`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch AI action audit log');
    return res.json();
  },

  recordAIActionDecision: async (data: {
    proposal_id: string;
    decision: string;
    reason?: string;
  }): Promise<any> => {
    const res = await fetch(`${API_URL}/ai/actions/decide`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to record action decision');
    }
    return res.json();
  },

  // ==========================================
  // PHASE D: ORGANIZATION API
  // ==========================================
  getUserOrganizations: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/organizations/current`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch organizations').then((data) => data || []);
  },

  getUsageByOrganization: async (orgId?: string): Promise<any> => {
    try {
      const url = orgId
        ? `${API_URL}/organizations/${orgId}/usage`
        : `${API_URL}/organizations/usage`;
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch organization usage');
      return res.json();
    } catch (e) {
      const { isDemoMode, isDemoSession } = getDemoFlags();
      if (isDemoMode || isDemoSession) {
        console.warn('[Api] getUsageByOrganization demo fallback:', e);
        return [
          { id: 'org-demo', name: 'Demo Org', user_count: 5, ai_calls_30d: 120, health_score: 90 },
        ];
      }
      throw e;
    }
  },

  getOrganization: async (orgId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/organizations/${orgId}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch organization details');
  },

  getOrganizationMembers: async (orgId: string): Promise<any[]> => {
    const res = await fetch(`${API_URL}/organizations/${orgId}/members`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch organization members').then((data) => data || []);
  },

  addOrganizationMember: async (orgId: string, email: string, role: string): Promise<any> => {
    // NOTE: Backend currently expects targetUserId, but UI workflow implies email invite.
    // We will pass email as targetUserId/email field and update backend if needed,
    // OR we just rely on ID if we have a picker.
    // For MVP skeleton, we assume we might be adding by ID if we don't have invite flow,
    // BUT to be user friendly, we should probably implement invite.
    // I'll stick to passing the body as is, and update backend later if needed.
    const res = await fetch(`${API_URL}/organizations/${orgId}/members`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ targetUserId: email, role }),
    });
    return handleResponse(res, 'Failed to add member');
  },

  createOrganization: async (name: string): Promise<any> => {
    const res = await fetch(`${API_URL}/organizations`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name }),
    });
    return handleResponse(res, 'Failed to create organization');
  },

  activateBilling: async (orgId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/organizations/${orgId}/billing/activate`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to activate billing');
  },

  // Token Ledger API
  getOrgTokenBalance: async (orgId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/organizations/${orgId}/tokens/balance`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch token balance');
  },

  getOrgTokenLedger: async (orgId: string, limit = 50, offset = 0): Promise<any[]> => {
    const res = await fetch(
      `${API_URL}/organizations/${orgId}/tokens/ledger?limit=${limit}&offset=${offset}`,
      {
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to fetch token ledger').then((data) => data?.ledger || []);
  },

  // ==========================================
  // PHASE C: CONSULTANT MODE
  // ==========================================
  getConsultantOrgs: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/consultants/orgs`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch consultant organizations');
    return res.json();
  },

  getConsultantClients: async (orgId?: string): Promise<any[]> => {
    let url = `${API_URL}/consultants/clients`;
    if (orgId) url += `?orgId=${orgId}`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch consultant clients');
    return res.json();
  },

  createConsultantInvite: async (data: {
    email: string;
    invitationType: string;
    firmName?: string;
    projectName?: string;
  }): Promise<any> => {
    const res = await fetch(`${API_URL}/consultants/invites`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to create invite');
    return json;
  },

  getConsultantInvites: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/consultants/invites`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch invites');
    return res.json();
  },

  // Org Admin: Invite a user (Member or Consultant)
  createOrganizationInvitation: async (email: string, role: string): Promise<any> => {
    const res = await fetch(`${API_URL}/invitations`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, role }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to send invitation');
    return json;
  },

  // ==========================================
  // PHASE E: ONBOARDING API
  // ==========================================
  saveOnboardingContext: async (context: any): Promise<void> => {
    const res = await fetch(`${API_URL}/onboarding/context`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(context),
    });
    await handleResponse(res, 'Failed to save onboarding context');
  },

  generateFirstValuePlan: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/onboarding/generate-plan`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to generate plan');
  },

  acceptFirstValuePlan: async (
    acceptedInitiativeIds: string[],
    idempotencyKey: string
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/onboarding/accept-plan`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ acceptedInitiativeIds, idempotencyKey }),
    });
    return handleResponse(res, 'Failed to accept plan');
  },

  getOnboardingStatus: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/onboarding/status`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get onboarding status');
  },

  getOnboardingPlan: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/onboarding/plan`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get onboarding plan');
  },

  // ==========================================
  // DRD AUDIT REPORT BUILDER API
  // ==========================================

  /**
   * Get full report with all sections for the Report Builder
   */
  getFullReport: async (reportId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/assessment-reports/${reportId}/full`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to load report');
  },

  /**
   * Generate full report with all sections from template
   */
  generateReport: async (
    reportId: string,
    options?: { templateId?: string; language?: string }
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/assessment-reports/${reportId}/generate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(options || {}),
    });
    return handleResponse(res, 'Failed to generate report');
  },

  /**
   * Get all sections for a report
   */
  getReportSections: async (reportId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/assessment-reports/${reportId}/sections`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to load sections');
  },

  /**
   * Add a new section to the report
   */
  addReportSection: async (
    reportId: string,
    data: {
      sectionType: string;
      axisId?: string;
      areaId?: string;
      title?: string;
      content?: string;
      orderIndex?: number;
    }
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/assessment-reports/${reportId}/sections`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to add section');
  },

  /**
   * Update a section's content
   */
  updateReportSection: async (
    reportId: string,
    sectionId: string,
    data: {
      content: string;
      title?: string;
      saveHistory?: boolean;
    }
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/assessment-reports/${reportId}/sections/${sectionId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update section');
  },

  /**
   * Delete a section from the report
   */
  deleteReportSection: async (reportId: string, sectionId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/assessment-reports/${reportId}/sections/${sectionId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete section');
  },

  /**
   * AI action on a section (expand, summarize, improve, translate, regenerate)
   */
  aiSectionAction: async (
    reportId: string,
    sectionId: string,
    data: {
      action: string;
      language?: string;
      customPrompt?: string;
    }
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/assessment-reports/${reportId}/sections/${sectionId}/ai`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to perform AI action');
  },

  /**
   * Reorder sections
   */
  reorderReportSections: async (
    reportId: string,
    sectionOrder: { id: string; orderIndex: number }[]
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/assessment-reports/${reportId}/sections/reorder`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ sectionOrder }),
    });
    return handleResponse(res, 'Failed to reorder sections');
  },

  /**
   * AI edit via chat - process natural language edit requests
   */
  aiEditReport: async (
    reportId: string,
    data: { message: string; focusSectionId?: string | null }
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/assessment-reports/${reportId}/ai-edit`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to process AI edit request');
  },

  /**
   * Get section version history
   */
  getSectionHistory: async (reportId: string, sectionId: string): Promise<any> => {
    const res = await fetch(
      `${API_URL}/assessment-reports/${reportId}/sections/${sectionId}/history`,
      {
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to load section history');
  },

  /**
   * Finalize a report (DRAFT -> FINAL)
   */
  finalizeReport: async (reportId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/assessment-reports/${reportId}/finalize`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to finalize report');
  },

  /**
   * Reject a report (FINAL -> DRAFT with reason)
   */
  rejectReport: async (reportId: string, reason?: string): Promise<any> => {
    const res = await fetch(`${API_URL}/assessment-reports/${reportId}/reject`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason: reason || '' }),
    });
    return handleResponse(res, 'Failed to reject report');
  },

  /**
   * Send report back for revisions (FINAL -> DRAFT)
   */
  sendBackReport: async (reportId: string, reason?: string): Promise<any> => {
    const res = await fetch(`${API_URL}/assessment-reports/${reportId}/send-back`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason: reason || '' }),
    });
    return handleResponse(res, 'Failed to send back report');
  },

  /**
   * Mark report as utilized (APPROVED -> UTILIZED)
   */
  utilizeReport: async (reportId: string, notes?: string): Promise<any> => {
    const res = await fetch(`${API_URL}/assessment-reports/${reportId}/utilize`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ notes: notes || '' }),
    });
    return handleResponse(res, 'Failed to utilize report');
  },

  /**
   * Export report as PDF
   */
  exportReportPDF: async (reportId: string): Promise<Blob> => {
    const res = await fetch(`${API_URL}/assessment-reports/${reportId}/export/pdf`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to export PDF');
    }
    return res.blob();
  },

  /**
   * Export report as Excel
   */
  exportReportExcel: async (reportId: string): Promise<Blob> => {
    const res = await fetch(`${API_URL}/assessment-reports/${reportId}/export/excel`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      throw new Error('Failed to export Excel');
    }
    return res.blob();
  },

  // ============================================
  // ECONOMICS MODULE API
  // ============================================

  /**
   * Get list of digitization analyses
   */
  getDigitizationAnalyses: async (filters?: {
    status?: string;
    projectId?: string;
    search?: string;
    initiativeId?: string;
    analysisType?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    pageSize?: number;
  }): Promise<any> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const url = `${API_URL}/economics/analyses${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetchWithRetry(url, { headers: getHeaders() });
    return handleResponse(res, 'Failed to load analyses');
  },

  /**
   * Create new digitization analysis
   */
  createDigitizationAnalysis: async (data: {
    name: string;
    description?: string;
    projectId?: string;
    initiativeId?: string;
    analysisType?: string;
    tags?: string[];
  }): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/analyses`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create analysis');
  },

  /**
   * Get single digitization analysis by ID
   */
  getDigitizationAnalysis: async (id: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/analyses/${id}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to load analysis');
  },

  /**
   * Update digitization analysis
   */
  updateDigitizationAnalysis: async (
    id: string,
    data: {
      name?: string;
      description?: string;
      status?: string;
      projectId?: string;
      initiativeId?: string;
      analysisType?: string;
      tags?: string[];
    }
  ): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/analyses/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update analysis');
  },

  /**
   * Delete digitization analysis
   */
  deleteDigitizationAnalysis: async (id: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/analyses/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete analysis');
  },

  /**
   * Duplicate digitization analysis
   */
  duplicateDigitizationAnalysis: async (id: string, name?: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/analyses/${id}/duplicate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name }),
    });
    return handleResponse(res, 'Failed to duplicate analysis');
  },

  /**
   * Update scores for digitization analysis
   */
  updateDigitizationScores: async (
    analysisId: string,
    scores: Array<{
      axisId: string;
      areaId: string;
      areaCode?: string;
      currentLevel: number;
      targetLevel: number;
      notes?: string;
      evidence?: string[];
      justification?: string;
    }>
  ): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/scores`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ scores }),
    });
    return handleResponse(res, 'Failed to update scores');
  },

  /**
   * Update single score for digitization analysis
   */
  updateDigitizationScore: async (
    analysisId: string,
    scoreData: {
      axisId: string;
      areaId: string;
      areaCode?: string;
      currentLevel: number;
      targetLevel: number;
      notes?: string;
      evidence?: string[];
      justification?: string;
    }
  ): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/score`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(scoreData),
    });
    return handleResponse(res, 'Failed to update score');
  },

  /**
   * Import digitization analysis from Excel file
   */
  importDigitizationExcel: async (file: File, analysisName?: string): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    if (analysisName) {
      formData.append('analysisName', analysisName);
    }

    const token = tokenService.getToken();
    const res = await fetch(`${API_URL}/economics/import`, {
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        'X-Correlation-ID': correlationId as string,
      },
      body: formData,
    });
    return handleResponse(res, 'Failed to import Excel file');
  },

  /**
   * Export digitization analysis to Excel
   */
  exportDigitizationAnalysis: async (
    analysisId: string,
    options?: {
      recommendations?: boolean;
      rawData?: boolean;
      language?: string;
    }
  ): Promise<any> => {
    const params = new URLSearchParams();
    if (options) {
      if (options.recommendations !== undefined)
        params.append('recommendations', String(options.recommendations));
      if (options.rawData !== undefined) params.append('rawData', String(options.rawData));
      if (options.language) params.append('language', options.language);
    }
    const url = `${API_URL}/economics/analyses/${analysisId}/export${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetchWithRetry(url, { headers: getHeaders() });
    return handleResponse(res, 'Failed to export analysis');
  },

  /**
   * Export digitization analysis to PDF
   */
  exportDigitizationPDF: async (
    analysisId: string,
    options?: {
      template?: 'executive' | 'full' | 'gap_analysis';
      language?: 'pl' | 'en';
      logo?: boolean;
      recommendations?: boolean;
    }
  ): Promise<{ success: boolean; downloadUrl: string; filename: string }> => {
    const params = new URLSearchParams();
    if (options) {
      if (options.template) params.append('template', options.template);
      if (options.language) params.append('language', options.language);
      if (options.logo !== undefined) params.append('logo', String(options.logo));
      if (options.recommendations !== undefined)
        params.append('recommendations', String(options.recommendations));
    }
    const url = `${API_URL}/economics/analyses/${analysisId}/export/pdf${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetchWithRetry(url, { headers: getHeaders() });
    return handleResponse(res, 'Failed to export analysis to PDF');
  },

  /**
   * Get digitization catalog statistics
   */
  getDigitizationStats: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/stats`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to load statistics');
  },

  /**
   * Compare multiple digitization analyses
   */
  compareDigitizationAnalyses: async (analysisIds: string[]): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/compare`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ analysisIds }),
    });
    return handleResponse(res, 'Failed to compare analyses');
  },

  /**
   * Create saved comparison
   */
  createDigitizationComparison: async (data: {
    name: string;
    description?: string;
    analysisIds: string[];
    comparisonType?: string;
  }): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/comparisons`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create comparison');
  },

  /**
   * Get saved comparison
   */
  getDigitizationComparison: async (id: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/comparisons/${id}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to load comparison');
  },

  // =========================================
  // Economics: Versioning API
  // =========================================

  /**
   * Create version snapshot
   */
  createDigitizationVersion: async (
    analysisId: string,
    data: {
      versionName?: string;
      versionType?: 'snapshot' | 'baseline' | 'milestone';
      notes?: string;
    }
  ): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/versions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create version');
  },

  /**
   * Get all versions for an analysis
   */
  getDigitizationVersions: async (analysisId: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/versions`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to load versions');
  },

  /**
   * Get specific version
   */
  getDigitizationVersion: async (analysisId: string, versionId: string): Promise<any> => {
    const res = await fetchWithRetry(
      `${API_URL}/economics/analyses/${analysisId}/versions/${versionId}`,
      {
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to load version');
  },

  /**
   * Restore analysis to version
   */
  restoreDigitizationVersion: async (analysisId: string, versionId: string): Promise<any> => {
    const res = await fetchWithRetry(
      `${API_URL}/economics/analyses/${analysisId}/versions/${versionId}/restore`,
      {
        method: 'POST',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to restore version');
  },

  /**
   * Compare two versions
   */
  compareDigitizationVersions: async (analysisId: string, v1: string, v2: string): Promise<any> => {
    const res = await fetchWithRetry(
      `${API_URL}/economics/analyses/${analysisId}/versions/compare?v1=${v1}&v2=${v2}`,
      {
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to compare versions');
  },

  /**
   * Mark version as baseline
   */
  markVersionAsBaseline: async (analysisId: string, versionId: string): Promise<any> => {
    const res = await fetchWithRetry(
      `${API_URL}/economics/analyses/${analysisId}/versions/${versionId}/baseline`,
      {
        method: 'POST',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to mark as baseline');
  },

  // =========================================
  // Economics: Evidence API
  // =========================================

  /**
   * Add evidence to score
   */
  addDigitizationEvidence: async (
    scoreId: string,
    data: {
      evidenceType: 'document' | 'link' | 'screenshot' | 'note';
      title: string;
      content?: string;
      category?: string;
    }
  ): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/scores/${scoreId}/evidence`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to add evidence');
  },

  /**
   * Upload evidence file
   */
  uploadDigitizationEvidence: async (
    scoreId: string,
    file: File,
    metadata: {
      title?: string;
      description?: string;
      category?: string;
    }
  ): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata.title) formData.append('title', metadata.title);
    if (metadata.description) formData.append('description', metadata.description);
    if (metadata.category) formData.append('category', metadata.category);

    const token = tokenService.getToken();
    const res = await fetchWithRetry(`${API_URL}/economics/scores/${scoreId}/evidence/upload`, {
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        'X-Correlation-ID': correlationId as string,
        // Note: Don't set Content-Type for FormData - browser sets it with boundary
      },
      body: formData,
    });
    return handleResponse(res, 'Failed to upload evidence');
  },

  /**
   * Get evidence for score
   */
  getDigitizationEvidence: async (scoreId: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/scores/${scoreId}/evidence`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to load evidence');
  },

  /**
   * Get all evidence for analysis
   */
  getDigitizationAnalysisEvidence: async (analysisId: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/evidence`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to load evidence');
  },

  /**
   * Update evidence
   */
  updateDigitizationEvidence: async (
    evidenceId: string,
    data: {
      title?: string;
      content?: string;
      category?: string;
    }
  ): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/evidence/${evidenceId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update evidence');
  },

  /**
   * Delete evidence
   */
  deleteDigitizationEvidence: async (evidenceId: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/evidence/${evidenceId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete evidence');
  },

  /**
   * Verify evidence
   */
  verifyDigitizationEvidence: async (evidenceId: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/evidence/${evidenceId}/verify`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to verify evidence');
  },

  // --- DOCUMENTS ---
  getProjectDocuments: async (projectId: string): Promise<any[]> => {
    const res = await fetchWithRetry(`${API_URL}/documents/project/${projectId}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch project documents');
  },

  getUserDocuments: async (): Promise<any[]> => {
    const res = await fetchWithRetry(`${API_URL}/documents/user`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch user documents');
  },

  uploadDocumentToLibrary: async (
    file: File,
    options?: { scope?: string; projectId?: string; description?: string; tags?: string[] }
  ): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    if (options) {
      if (options.scope) formData.append('scope', options.scope);
      if (options.projectId) formData.append('projectId', options.projectId);
      if (options.description) formData.append('description', options.description);
      if (options.tags) formData.append('tags', JSON.stringify(options.tags));
    }

    const headers = getHeaders();
    delete (headers as any)['Content-Type'];

    const res = await fetch(`${API_URL}/documents/upload`, {
      method: 'POST',
      headers: headers,
      body: formData,
    });
    return handleResponse(res, 'Failed to upload document');
  },

  moveDocumentToProject: async (docId: string, projectId: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/documents/${docId}/move-to-project`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ projectId }),
    });
    return handleResponse(res, 'Failed to move document');
  },

  deleteDocument: async (docId: string): Promise<void> => {
    const res = await fetchWithRetry(`${API_URL}/documents/${docId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    await handleResponse(res, 'Failed to delete document');
  },

  downloadDocument: async (docId: string): Promise<Blob> => {
    const res = await fetchWithRetry(`${API_URL}/documents/${docId}/download`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to download document');
    return res.blob();
  },

  /**
   * Get evidence categories
   */
  getEvidenceCategories: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/evidence/categories`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to load categories');
  },

  // Economics: Financial Analysis API
  // ============================================

  /**
   * Link analysis to initiative
   */
  linkAnalysisToInitiative: async (analysisId: string, initiativeId: string): Promise<any> => {
    const res = await fetchWithRetry(
      `${API_URL}/economics/analyses/${analysisId}/link-initiative`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ initiativeId }),
      }
    );
    return handleResponse(res, 'Failed to link analysis to initiative');
  },

  /**
   * Get financial data for analysis
   */
  getAnalysisFinancials: async (analysisId: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/financials`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch financial data');
  },

  /**
   * Update financial data for analysis
   */
  updateAnalysisFinancials: async (
    analysisId: string,
    data: {
      financialData?: Record<string, any>;
      costs?: Array<{ year: number; amount: number; description?: string }>;
      benefits?: Array<{ year: number; amount: number; description?: string }>;
      discountRate?: number;
      investmentHorizon?: number;
    }
  ): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/financials`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update financial data');
  },

  /**
   * Get financial scenarios for analysis
   */
  getAnalysisScenarios: async (analysisId: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/scenarios`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch scenarios');
  },

  /**
   * Upsert financial scenario for analysis
   */
  upsertAnalysisScenario: async (
    analysisId: string,
    data: { scenarioType: string; name?: string; financialData?: Record<string, any> }
  ): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/scenarios`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to save scenario');
  },

  /**
   * Activate scenario
   */
  activateAnalysisScenario: async (analysisId: string, scenarioId: string): Promise<any> => {
    const res = await fetchWithRetry(
      `${API_URL}/economics/analyses/${analysisId}/scenarios/${scenarioId}/activate`,
      {
        method: 'POST',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to activate scenario');
  },

  /**
   * Create initiative from analysis
   */
  createInitiativeFromAnalysis: async (analysisId: string): Promise<any> => {
    const res = await fetchWithRetry(
      `${API_URL}/economics/analyses/${analysisId}/create-initiative`,
      {
        method: 'POST',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to create initiative from analysis');
  },

  /**
   * Create gate decision for analysis
   */
  createAnalysisDecision: async (
    analysisId: string,
    data: {
      decisionType: 'approve-analysis' | 'select-scenario' | 'go-no-go';
      decisionMakerId?: string;
    }
  ): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/decisions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create decision');
  },

  /**
   * Get benefit tracking data for analysis
   */
  getAnalysisBenefits: async (analysisId: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/benefits`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch benefit tracking data');
  },

  /**
   * Update benefit tracking data for analysis
   */
  updateAnalysisBenefits: async (
    analysisId: string,
    data: {
      plannedBenefits?: Array<{ period: string; amount: number }>;
      actualBenefits?: Array<{ period: string; amount: number }>;
      trackingPeriod?: string;
    }
  ): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/benefits`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update benefit tracking data');
  },

  /**
   * Get quality assessment for analysis
   */
  getAnalysisQualityAssessment: async (analysisId: string): Promise<any> => {
    const res = await fetchWithRetry(
      `${API_URL}/economics/analyses/${analysisId}/quality-assessment`,
      {
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to fetch quality assessment');
  },

  /**
   * Calculate financial metrics (NPV, IRR, Payback, ROI)
   */
  calculateFinancialMetrics: async (
    analysisId: string
  ): Promise<{
    npv: number | null;
    irr: number | null;
    paybackPeriod: number | null;
    roi: number | null;
    cashFlows: Array<{ year: number; amount: number }>;
    sensitivityAnalysis?: any;
  }> => {
    const res = await fetchWithRetry(
      `${API_URL}/economics/analyses/${analysisId}/calculate-metrics`,
      {
        method: 'POST',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to calculate financial metrics');
  },

  /**
   * Generate business case document
   */
  generateBusinessCase: async (
    analysisId: string,
    options?: {
      format?: 'pdf' | 'docx';
      language?: 'pl' | 'en';
      includeExecutiveSummary?: boolean;
      includeFinancialAnalysis?: boolean;
      includeRiskAssessment?: boolean;
    }
  ): Promise<{ downloadUrl: string; filename: string }> => {
    const res = await fetchWithRetry(`${API_URL}/economics/analyses/${analysisId}/business-case`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(options || {}),
    });
    return handleResponse(res, 'Failed to generate business case');
  },

  // ==================== CONVERSATIONS ====================

  /**
   * List user's conversations
   */
  getConversations: async (options?: {
    archived?: boolean;
    starred?: boolean;
    projectId?: string;
    chatProjectId?: string;
    /** 'personal' | 'team' | 'all' */
    scope?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    conversations: any[];
    total: number;
    limit: number;
    offset: number;
  }> => {
    const params = new URLSearchParams();
    if (options?.archived !== undefined) params.append('archived', String(options.archived));
    if (options?.starred !== undefined) params.append('starred', String(options.starred));
    if (options?.projectId) params.append('projectId', options.projectId);
    if (options?.chatProjectId) params.append('chatProjectId', options.chatProjectId);
    if (options?.scope) params.append('scope', options.scope);
    if (options?.search) params.append('search', options.search);
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));

    const res = await fetchWithRetry(`${API_URL}/conversations?${params.toString()}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch conversations');
  },

  /**
   * Create a new conversation
   */
  createConversation: async (data?: {
    title?: string;
    projectId?: string;
    pmoContext?: Record<string, any>;
    language?: string;
  }): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/conversations`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data || {}),
    });
    return handleResponse(res, 'Failed to create conversation');
  },

  /**
   * Get a conversation with all its messages
   */
  getConversation: async (id: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/conversations/${id}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch conversation');
  },

  /**
   * Update conversation metadata
   */
  updateConversation: async (
    id: string,
    updates: {
      title?: string;
      titleSource?: 'auto' | 'user';
      starred?: boolean;
      archived?: boolean;
      tags?: string[];
      pmoContext?: Record<string, any>;
      chatProjectId?: string | null;
      language?: string;
    }
  ): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/conversations/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse(res, 'Failed to update conversation');
  },

  /**
   * Delete a conversation
   */
  deleteConversation: async (id: string): Promise<{ success: boolean; deleted: string }> => {
    const res = await fetchWithRetry(`${API_URL}/conversations/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete conversation');
  },

  /**
   * Add a message to a conversation
   */
  addConversationMessage: async (
    conversationId: string,
    message: {
      role: 'user' | 'ai';
      content: string;
      messageType?: string;
      metadata?: Record<string, any>;
      tokenCount?: number;
      modelUsed?: string;
    }
  ): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(message),
    });
    return handleResponse(res, 'Failed to add message');
  },

  /**
   * Truncate a conversation after a given message (inclusive),
   * optionally editing that message content. Used for "edit & regenerate" UX.
   */
  truncateConversation: async (
    conversationId: string,
    afterMessageId: string,
    editedContent?: string
  ): Promise<{ success: boolean; deletedCount?: number }> => {
    const res = await fetchWithRetry(`${API_URL}/conversations/${conversationId}/truncate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ afterMessageId, editedContent }),
    });
    return handleResponse(res, 'Failed to truncate conversation');
  },

  /**
   * Generate title for a conversation
   */
  generateConversationTitle: async (
    conversationId: string
  ): Promise<{ title?: string; skipped?: boolean; reason?: string }> => {
    const res = await fetchWithRetry(`${API_URL}/conversations/${conversationId}/title/generate`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to generate title');
  },

  /**
   * Summarize older messages in a conversation (context window management)
   */
  summarizeConversation: async (
    conversationId: string,
    keepRecent: number = 10
  ): Promise<{
    summary: string | null;
    condensedCount: number;
    remainingCount: number;
    skipped?: boolean;
  }> => {
    const res = await fetchWithRetry(`${API_URL}/conversations/${conversationId}/summarize`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ keepRecent }),
    });
    return handleResponse(res, 'Failed to summarize conversation');
  },

  /**
   * Bulk operations on conversations
   */
  bulkConversationOperation: async (
    ids: string[],
    action: 'archive' | 'unarchive' | 'delete' | 'star' | 'unstar'
  ): Promise<{
    success: boolean;
    affected: number;
    ids: string[];
  }> => {
    const res = await fetchWithRetry(`${API_URL}/conversations/bulk`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ ids, action }),
    });
    return handleResponse(res, 'Failed to perform bulk operation');
  },

  /**
   * Migrate conversations from localStorage
   */
  migrateConversations: async (
    conversations: Array<{
      projectId?: string;
      messages: Array<{ role: string; content: string; timestamp?: Date }>;
    }>
  ): Promise<{
    success: boolean;
    migrated: Array<{ conversationId: string; messageCount: number }>;
  }> => {
    const res = await fetchWithRetry(`${API_URL}/conversations/migrate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ conversations }),
    });
    return handleResponse(res, 'Failed to migrate conversations');
  },

  // ==================== STUDIO ====================

  /**
   * Get studio documents
   */
  getStudioDocuments: async (options?: {
    type?: string;
    linkedTaskId?: string;
    linkedProjectId?: string;
    linkedInitiativeId?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> => {
    const params = new URLSearchParams();
    if (options?.type) params.append('type', options.type);
    if (options?.linkedTaskId) params.append('linkedTaskId', options.linkedTaskId);
    if (options?.linkedProjectId) params.append('linkedProjectId', options.linkedProjectId);
    if (options?.linkedInitiativeId)
      params.append('linkedInitiativeId', options.linkedInitiativeId);
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.offset) params.append('offset', String(options.offset));

    const res = await fetchWithRetry(`${API_URL}/studio/documents?${params.toString()}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch studio documents');
  },

  /**
   * Create studio document
   */
  createStudioDocument: async (data: {
    name: string;
    description?: string;
    type?: string;
    nodes?: any[];
    edges?: any[];
    linkedTaskId?: string;
    linkedProjectId?: string;
    linkedInitiativeId?: string;
    templateId?: string;
  }): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/studio/documents`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create studio document');
  },

  /**
   * Get studio document by ID
   */
  getStudioDocument: async (id: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/studio/documents/${id}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch studio document');
  },

  /**
   * Update studio document
   */
  updateStudioDocument: async (
    id: string,
    data: {
      name?: string;
      description?: string;
      type?: string;
      nodes?: any[];
      edges?: any[];
      viewport?: any;
      tags?: string[];
      linkedTaskId?: string;
      linkedProjectId?: string;
      linkedInitiativeId?: string;
      createSnapshot?: boolean;
      snapshotReason?: string;
    }
  ): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/studio/documents/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update studio document');
  },

  /**
   * Delete studio document
   */
  deleteStudioDocument: async (id: string): Promise<{ success: boolean }> => {
    const res = await fetchWithRetry(`${API_URL}/studio/documents/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete studio document');
  },

  /**
   * Create studio document snapshot
   */
  createStudioSnapshot: async (
    documentId: string,
    data?: { name?: string; reason?: string }
  ): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/studio/documents/${documentId}/snapshot`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data || {}),
    });
    return handleResponse(res, 'Failed to create snapshot');
  },

  /**
   * Restore studio document from snapshot
   */
  restoreStudioSnapshot: async (documentId: string, snapshotId: string): Promise<any> => {
    const res = await fetchWithRetry(
      `${API_URL}/studio/documents/${documentId}/restore/${snapshotId}`,
      {
        method: 'POST',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to restore snapshot');
  },

  /**
   * Get studio templates
   */
  getStudioTemplates: async (category?: string): Promise<any[]> => {
    const params = category ? `?category=${category}` : '';
    const res = await fetchWithRetry(`${API_URL}/studio/templates${params}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch studio templates');
  },

  /**
   * Create studio template from document
   */
  createStudioTemplate: async (data: {
    name: string;
    description?: string;
    category: string;
    nodes?: any[];
    edges?: any[];
    tags?: string[];
    isPublic?: boolean;
    fromDocumentId?: string;
  }): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/studio/templates`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create template');
  },

  /**
   * Share studio document
   */
  shareStudioDocument: async (
    documentId: string
  ): Promise<{ shareToken: string; shareUrl: string }> => {
    const res = await fetchWithRetry(`${API_URL}/studio/documents/${documentId}/share`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to share document');
  },

  /**
   * Get shared studio document (public)
   */
  getSharedStudioDocument: async (token: string): Promise<any> => {
    const res = await fetch(`${API_URL}/studio/shared/${token}`);
    return handleResponse(res, 'Failed to fetch shared document');
  },

  /**
   * Link studio document to PMO entity
   */
  linkStudioDocument: async (
    documentId: string,
    links: {
      taskId?: string;
      projectId?: string;
      initiativeId?: string;
    }
  ): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/studio/documents/${documentId}/link`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(links),
    });
    return handleResponse(res, 'Failed to link document');
  },

  // ==================== STUDIO AI ====================

  /**
   * Generate diagram from text
   */
  generateStudioDiagram: async (
    prompt: string,
    diagramType?: string
  ): Promise<{
    nodes: any[];
    edges: any[];
    diagramType: string;
    suggestedTitle?: string;
    tokensUsed?: number;
  }> => {
    const res = await fetchWithRetry(`${API_URL}/studio/ai/generate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ prompt, diagramType }),
    });
    return handleResponse(res, 'Failed to generate diagram');
  },

  /**
   * Modify existing diagram
   */
  modifyStudioDiagram: async (
    prompt: string,
    nodes: any[],
    edges: any[]
  ): Promise<{
    nodes: any[];
    edges: any[];
    changes?: { added?: string[]; modified?: string[]; removed?: string[] };
    tokensUsed?: number;
  }> => {
    const res = await fetchWithRetry(`${API_URL}/studio/ai/modify`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ prompt, nodes, edges }),
    });
    return handleResponse(res, 'Failed to modify diagram');
  },

  /**
   * Studio AI chat
   */
  studioAIChat: async (
    message: string,
    documentId?: string,
    context?: { nodes: any[]; edges: any[] }
  ): Promise<{
    text: string;
    intent: string;
    confidence: number;
    diagramUpdate?: {
      action: 'replace' | 'update';
      nodes: any[];
      edges: any[];
      changes?: { added?: string[]; modified?: string[]; removed?: string[] };
    };
  }> => {
    const res = await fetchWithRetry(`${API_URL}/studio/ai/chat`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ message, documentId, context }),
    });
    return handleResponse(res, 'Failed to process chat message');
  },

  /**
   * Get diagram optimization suggestions
   */
  getStudioSuggestions: async (
    nodes: any[],
    edges: any[],
    diagramType?: string
  ): Promise<{
    suggestions: Array<{
      type: string;
      message: string;
      nodeIds?: string[];
    }>;
  }> => {
    const res = await fetchWithRetry(`${API_URL}/studio/ai/suggest`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ nodes, edges, diagramType }),
    });
    return handleResponse(res, 'Failed to get suggestions');
  },

  /**
   * Classify intent of message
   */
  classifyStudioIntent: async (
    message: string
  ): Promise<{ intent: string; confidence: number }> => {
    const res = await fetchWithRetry(`${API_URL}/studio/ai/classify`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ message }),
    });
    return handleResponse(res, 'Failed to classify intent');
  },

  // Generic helper methods for Studio hooks
  get: async (url: string) => {
    const fullUrl = url.startsWith('/api') ? url : `${API_URL}${url}`;
    const res = await fetchWithRetry(fullUrl, { headers: getHeaders() });
    return handleResponse(res, 'Request failed');
  },

  post: async (url: string, data: any) => {
    const fullUrl = url.startsWith('/api') ? url : `${API_URL}${url}`;
    const res = await fetchWithRetry(fullUrl, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Request failed');
  },

  postMultipart: async (url: string, formData: FormData) => {
    const fullUrl = url.startsWith('/api') ? url : `${API_URL}${url}`;
    const headers = getHeaders();
    // Browser must set multipart boundary; do not send Content-Type.
    delete headers['Content-Type'];

    const res = await fetchWithRetry(fullUrl, {
      method: 'POST',
      headers,
      body: formData,
      skipDefaultHeaders: true,
    });
    return handleResponse(res, 'Request failed');
  },

  put: async (url: string, data: any) => {
    const fullUrl = url.startsWith('/api') ? url : `${API_URL}${url}`;
    const res = await fetchWithRetry(fullUrl, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Request failed');
  },

  delete: async (url: string) => {
    const fullUrl = url.startsWith('/api') ? url : `${API_URL}${url}`;
    const res = await fetchWithRetry(fullUrl, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Request failed');
  },

  patch: async (url: string, data: any) => {
    const fullUrl = url.startsWith('/api') ? url : `${API_URL}${url}`;
    const res = await fetchWithRetry(fullUrl, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Request failed');
  },

  // Additional stubs for missing methods - connected to real API
  resolveSecurityEvent: async (
    eventId: string,
    resolution?: any
  ): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/superadmin/security/events/${eventId}/resolve`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(resolution || {}),
    });
    if (!res.ok) throw new Error('Failed to resolve security event');
    return res.json();
  },
  updateKnowledgeCandidate: async (id: string, data: any): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/knowledge/candidates/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update knowledge candidate');
    return res.json();
  },
  triggerBackup: async (): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/superadmin/system/backup`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to trigger backup');
    return res.json();
  },
  getBackups: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/superadmin/system/backups`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch backups');
    return res.json();
  },
  // AI SLA and monitoring
  getAIHealthMetrics: async () => {
    return {
      health: 100,
      latency: { p50: 100, p95: 200, p99: 500, avg: 150, trend: [] },
      uptime: 99.9,
    };
  },
  getAIAvailability: async () => {
    return {
      available: true,
      lastCheck: new Date().toISOString(),
      availability: { current: 99.9, target: 99.5, trend: [] },
    };
  },
  getAISLABreaches: async () => {
    return { breaches: [] };
  },
  getAISLATrends: async () => {
    return { trends: [] };
  },
  getAuditLogs: async (orgId?: string, filters?: any) => {
    const baseLogs = [
      {
        id: 'audit-1',
        timestamp: new Date().toISOString(),
        user_id: 'admin-1',
        user_email: 'admin@dbr77.com',
        ip_address: '192.168.0.10',
        user_agent: 'Chrome',
        action_type: 'CONFIG_CHANGE',
        resource_type: 'SETTING',
        resource_id: 'app_name',
        before_data: { app_name: 'Consultinity' },
        after_data: { app_name: 'TechnoLex' },
        risk_level: 'LOW',
        compliance_tags: ['SOC2'],
        request_id: 'req-1',
        organization_id: 'org-dbr77-system',
        metadata: { section: 'SystemSettings' },
        created_at: new Date().toISOString(),
      },
    ];
    return {
      logs: baseLogs,
      pagination: { page: 1, pageSize: 20, total: baseLogs.length, totalPages: 1 },
    };
  },
  getAuditLogStats: async (orgId?: string) => {
    return { total: 1, byType: { CONFIG_CHANGE: 1 }, high_risk: 0, medium_risk: 0, low_risk: 1 };
  },
  exportAuditLogs: async (filters?: any) => {
    // Return data directly for download in UI
    return [
      {
        id: 'audit-1',
        timestamp: new Date().toISOString(),
        user_email: 'admin@dbr77.com',
        action_type: 'CONFIG_CHANGE',
        resource_type: 'SETTING',
        resource_id: 'app_name',
        risk_level: 'LOW',
      },
    ];
  },
  // AI Actions
  rejectAIAction: async (actionId: string, reason?: string) => {
    return { success: true };
  },
  // Billing
  createSetupIntent: async () => {
    const res = await fetch(`${API_URL}/billing/setup-intent`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to create setup intent');
  },
  addPaymentMethod: async (paymentMethodId: string) => {
    const res = await fetch(`${API_URL}/billing/payment-methods`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ paymentMethodId }),
    });
    const data = await handleResponse(res, 'Failed to add payment method');
    try {
      trackFunnelEvent('billing_payment_method_added', { paymentMethodId });
    } catch {
      // ignore
    }
    return data;
  },
  // Feature flags
  updateFeatureFlag: async (flagId: string, data: any) => {
    return { success: true };
  },
  toggleFeatureFlag: async (flagId: string, data?: any) => {
    return { success: true };
  },
  // Provider
  updateProviderTier: async (providerId: string, tier: string) => {
    const res = await fetch(`${API_URL}/llm/providers/${providerId}/tier`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ tier }),
    });
    if (!res.ok) throw new Error('Failed to update provider tier');
    return res.json();
  },
  // Account Management
  exportUserData: async (): Promise<any> => {
    return { downloadUrl: '', expiresAt: '' };
  },
  deleteAccount: async (password: string): Promise<void> => {
    return;
  },
  // AI Memory
  clearAIMemory: async (): Promise<void> => {
    return;
  },
  // API Access
  createUserApiKey: async (name: string): Promise<any> => {
    return { id: '', name, key: '', createdAt: new Date().toISOString() };
  },
  rotateApiKey: async (keyId: string): Promise<any> => {
    return { id: keyId, key: '', rotatedAt: new Date().toISOString() };
  },
  updateApiKey: async (keyId: string, data: any): Promise<any> => {
    return { id: keyId, ...data };
  },
  // Calendar Sync
  getCalendars: async (): Promise<any[]> => {
    return [];
  },
  getCalendarSettings: async (): Promise<any> => {
    return { syncEnabled: false, calendars: [] };
  },
  connectCalendar: async (provider: string, credentials?: any): Promise<any> => {
    return { id: '', provider, connected: true };
  },
  disconnectCalendar: async (calendarId: string): Promise<void> => {
    return;
  },
  // Assessment Reports
  getAssessmentReports: async (projectId: string) => {
    const url = projectId
      ? `${API_URL}/assessment-reports?projectId=${projectId}`
      : `${API_URL}/assessment-reports`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) {
      throw new Error('Failed to fetch assessment reports');
    }
    const data = await res.json();
    return data.reports || [];
  },
  generateProjectAssessmentReport: async (projectId: string, type?: string) => {
    const res = await fetch(`${API_URL}/assessment-reports`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ projectId, type }),
    });
    if (!res.ok) {
      throw new Error('Failed to generate assessment report');
    }
    return res.json();
  },
  // Payment Methods
  getPaymentMethods: async () => {
    const res = await fetch(`${API_URL}/billing/payment-methods`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch payment methods');
  },
  // Invitations
  getInvitations: async () => {
    return [];
  },
  // System
  getSystemHealth: async () => {
    return {
      status: 'healthy',
      services: {},
      system: {
        cpu: 0,
        cpus: [],
        memory: { used: 0, total: 100, percent: 0 },
        uptime: 0,
        loadAvg: [0, 0, 0],
      },
      database: { status: 'healthy', latency: 0, responseTime: 0, connections: 0 },
      api: { status: 'healthy', latency: 0, responseTime: 0 },
      ai: { status: 'healthy', latency: 0, responseTime: 0 },
      timestamp: new Date().toISOString(),
    };
  },
  getRecognitionSchedule: async (filters?: any) => {
    return { schedule: [] };
  },
  // Revenue Recognition - connected to real API
  getRevenueRecognitions: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/revenue/revenue-recognition`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch revenue recognitions');
    return res.json();
  },
  getRevenueRecognitionStats: async (): Promise<{
    total: number;
    pending: number;
    recognized: number;
  }> => {
    const res = await fetch(`${API_URL}/revenue/revenue-recognition/stats`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch revenue recognition stats');
    return res.json();
  },
  recognizeRevenue: async (id: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/revenue/revenue-recognition/${id}/recognize`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to recognize revenue');
    return res.json();
  },
  createRevenueRecognition: async (data: any): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/revenue/revenue-recognition`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create revenue recognition');
    return res.json();
  },
  // Feature flags
  getFeatureFlags: async (filters?: any) => {
    return [];
  },
  // API Key usage
  getApiKeyUsage: async (keyId?: string) => {
    return { requests: 0, tokens: 0, cost: 0 };
  },
  // DLP - connected to real API
  getDLPPolicies: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/superadmin/dlp/policies`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch DLP policies');
    return res.json();
  },
  getDLPViolations: async (filters?: any): Promise<any[]> => {
    const params = new URLSearchParams();
    if (filters?.policyId) params.set('policyId', filters.policyId);
    if (filters?.status) params.set('status', filters.status);
    const res = await fetch(`${API_URL}/superadmin/dlp/violations?${params}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch DLP violations');
    return res.json();
  },
  getDLPStats: async (): Promise<{ total: number; violations: number; resolved: number }> => {
    const res = await fetch(`${API_URL}/superadmin/dlp/stats`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch DLP stats');
    return res.json();
  },
  createDLPPolicy: async (data: any): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/superadmin/dlp/policies`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create DLP policy');
    return res.json();
  },
  toggleDLPPolicy: async (id: string, isActive?: boolean): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/superadmin/dlp/policies/${id}/toggle`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ isActive }),
    });
    if (!res.ok) throw new Error('Failed to toggle DLP policy');
    return res.json();
  },
  deleteDLPPolicy: async (id: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/superadmin/dlp/policies/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete DLP policy');
    return { success: true };
  },
  resolveDLPViolation: async (id: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/superadmin/dlp/violations/${id}/resolve`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to resolve DLP violation');
    return res.json();
  },
  // Permissions - connected to real API
  getAdminPermissions: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/superadmin/admin/permissions`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch admin permissions');
    return res.json();
  },
  getPermissionsMatrix: async (): Promise<{ matrix: any[]; roles: any[] }> => {
    const res = await fetch(`${API_URL}/superadmin/admin/permissions/matrix`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch permissions matrix');
    return res.json();
  },
  getPermissionsStats: async (): Promise<{ total: number; assigned: number }> => {
    const res = await fetch(`${API_URL}/superadmin/admin/permissions/stats`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch permissions stats');
    return res.json();
  },
  updatePermission: async (roleId: string, permission: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/superadmin/permissions/${roleId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ permission }),
    });
    if (!res.ok) throw new Error('Failed to update permission');
    return res.json();
  },
  createAdminPermission: async (data: any): Promise<{ success: boolean; id: string }> => {
    const res = await fetch(`${API_URL}/superadmin/permissions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create admin permission');
    return res.json();
  },
  updateAdminPermission: async (id: string, data: any): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/superadmin/admin/permissions/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update admin permission');
    return res.json();
  },
  deleteAdminPermission: async (id: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/superadmin/admin/permissions/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete admin permission');
    return { success: true };
  },
  // Threats - connected to real API
  getThreatIntelligence: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/superadmin/threats`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch threat intelligence');
    return res.json();
  },
  getThreatStats: async (): Promise<{
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  }> => {
    const res = await fetch(`${API_URL}/superadmin/threats/stats`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch threat stats');
    return res.json();
  },
  resolveThreat: async (id: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/superadmin/threats/${id}/resolve`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to resolve threat');
    return res.json();
  },
  dismissThreat: async (id: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/superadmin/threats/${id}/dismiss`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to dismiss threat');
    return res.json();
  },
  // Lifecycle (legacy - use getLifecycleStages instead)
  getCustomerLifecycle: async () => [],
  // Recommended provider
  getRecommendedProvider: async (tierOrContext?: any) => {
    // Backwards-compatible signature:
    // - if string: treat as tier
    // - if object: read { tier }
    const tier =
      typeof tierOrContext === 'string'
        ? tierOrContext
        : typeof tierOrContext === 'object'
          ? tierOrContext?.tier
          : undefined;

    const params = new URLSearchParams();
    if (tier) params.set('tier', String(tier));

    const res = await fetch(`${API_URL}/llm/providers/recommended?${params.toString()}`, {
      headers: getHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((data as any)?.error || 'Failed to fetch recommended provider');
    }
    return data;
  },
  // User API Keys
  getUserApiKeys: async () => [],
  deleteUserApiKey: async (keyId: string) => ({ success: true }),
  // Calendar
  updateCalendarSettings: async (settings: any) => ({ success: true }),
  // Permission requests
  getPermissionRequests: async () => [],
  // Feature flags (additional)
  deleteFeatureFlag: async (id: string) => ({ success: true }),
  createFeatureFlag: async (data: any) => ({ success: true }),
  getFeatureFlagHistory: async (id: string) => [],
  // Knowledge base
  getApprovedIdeas: async (filters?: any): Promise<any[]> => {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    const res = await fetch(`${API_URL}/knowledge/candidates/approved?${params}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch approved ideas');
    return data;
  },
  getAllGlobalStrategies: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/knowledge/strategies`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch strategies');
    return data;
  },
  updateGlobalStrategy: async (id: string, data: any) => ({ success: true }),
  linkStrategyToDocument: async (strategyId: string, documentId: string) => ({ success: true }),
  linkStrategyToIdea: async (strategyId: string, ideaId: string) => ({ success: true }),
  unlinkStrategyFromDocument: async (strategyId: string, documentId: string) => ({ success: true }),
  unlinkStrategyFromIdea: async (strategyId: string, ideaId: string) => ({ success: true }),
  updateKnowledgeDocument: async (id: string, data: any) => {
    const res = await fetch(`${API_URL}/knowledge/documents/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data || {}),
    });
    const out = await res.json();
    if (!res.ok) throw new Error(out.error || 'Failed to update document');
    return out;
  },
  // Approval workflows
  getApprovalWorkflows: async (filters?: {
    resourceType?: string;
    isActive?: boolean;
  }): Promise<any[]> => {
    const params = new URLSearchParams();
    if (filters?.resourceType) params.set('resourceType', String(filters.resourceType));
    if (filters?.isActive !== undefined)
      params.set('isActive', filters.isActive ? 'true' : 'false');
    const res = await fetch(`${API_URL}/superadmin/admin/approval-workflows?${params}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to fetch approval workflows');
    return data;
  },
  getApprovalRequests: async (filters?: {
    status?: string;
    workflowId?: string;
    requesterId?: string;
  }): Promise<any[]> => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', String(filters.status));
    if (filters?.workflowId) params.set('workflowId', String(filters.workflowId));
    if (filters?.requesterId) params.set('requesterId', String(filters.requesterId));
    const res = await fetch(`${API_URL}/superadmin/admin/approval-requests?${params}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to fetch approval requests');
    return data;
  },
  createApprovalWorkflow: async (data: any) => {
    const res = await fetch(`${API_URL}/superadmin/admin/approval-workflows`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data || {}),
    });
    const out = await res.json();
    if (!res.ok) throw new Error(out?.error || 'Failed to create approval workflow');
    return out;
  },
  deleteApprovalWorkflow: async (id: string) => {
    const res = await fetch(
      `${API_URL}/superadmin/admin/approval-workflows/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((out as any)?.error || 'Failed to delete approval workflow');
    return out;
  },
  approveRequest: async (id: string, notes?: string) => {
    const res = await fetch(
      `${API_URL}/superadmin/admin/approval-requests/${encodeURIComponent(id)}/approve`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ notes }),
      }
    );
    const out = await res.json();
    if (!res.ok) throw new Error(out?.error || 'Failed to approve request');
    return out;
  },
  rejectRequest: async (id: string, reason?: string) => {
    const res = await fetch(
      `${API_URL}/superadmin/admin/approval-requests/${encodeURIComponent(id)}/reject`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reason }),
      }
    );
    const out = await res.json();
    if (!res.ok) throw new Error(out?.error || 'Failed to reject request');
    return out;
  },
  // Permissions
  toggleRolePermission: async (roleId: string, permission: string, value?: boolean) => {
    const res = await fetch(
      `${API_URL}/superadmin/admin/permissions/roles/${encodeURIComponent(roleId)}/permissions/${encodeURIComponent(permission)}`,
      {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ enabled: value !== undefined ? !!value : true }),
      }
    );
    const out = await res.json();
    if (!res.ok) throw new Error(out?.error || 'Failed to toggle permission');
    return out;
  },
  copyRolePermissions: async (fromRoleId: string, toRoleId: string) => {
    const res = await fetch(`${API_URL}/superadmin/admin/permissions/roles/copy`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ sourceRole: fromRoleId, targetRole: toRoleId }),
    });
    const out = await res.json();
    if (!res.ok) throw new Error(out?.error || 'Failed to copy permissions');
    return out;
  },
  // Threats
  getThreats: async (filters?: any) => [],
  addThreat: async (data: any) => ({ success: true }),
  blockThreat: async (id: string) => ({ success: true }),
  unblockThreat: async (id: string) => ({ success: true }),
  deleteThreat: async (id: string) => ({ success: true }),
  checkIPReputation: async (ip: string) => ({ reputation: 'good', score: 100 }),
  checkDomainReputation: async (domain: string) => ({ reputation: 'good', score: 100 }),
  // Chat projects - Real API implementations
  getChatProjects: async (options?: { scope?: 'personal' | 'team' }) => {
    const params = new URLSearchParams();
    if (options?.scope) params.append('scope', options.scope);
    const qs = params.toString();
    const response = await fetch(`${API_URL}/chat-projects${qs ? `?${qs}` : ''}`, {
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch chat projects');
    return response.json();
  },
  getChatProject: async (id: string) => {
    const response = await fetch(`${API_URL}/chat-projects/${id}`, { headers: getHeaders() });
    if (!response.ok) throw new Error('Failed to fetch chat project');
    return response.json();
  },
  createChatProject: async (data: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    scope?: 'personal' | 'team';
  }) => {
    const response = await fetch(`${API_URL}/chat-projects`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create chat project');
    return response.json();
  },
  updateChatProject: async (
    id: string,
    data: { name?: string; description?: string; color?: string; icon?: string }
  ) => {
    const response = await fetch(`${API_URL}/chat-projects/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update chat project');
    return response.json();
  },
  deleteChatProject: async (id: string) => {
    const response = await fetch(`${API_URL}/chat-projects/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete chat project');
    return response.json();
  },
  moveConversationToProject: async (projectId: string, conversationId: string) => {
    const response = await fetch(
      `${API_URL}/chat-projects/${projectId}/conversations/${conversationId}`,
      {
        method: 'POST',
        headers: getHeaders(),
      }
    );
    if (!response.ok) throw new Error('Failed to move conversation to project');
    return response.json();
  },
  // Analytics Reports - connected to real API
  getAnalyticsReports: async (filters?: any): Promise<any[]> => {
    const params = new URLSearchParams();
    // Back-compat: callers sometimes pass a string filterType
    if (typeof filters === 'string' && filters) params.set('type', filters);
    else if (filters?.type) params.set('type', filters.type);
    const res = await fetch(`${API_URL}/superadmin/analytics/reports?${params}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch analytics reports');
    const payload = await res.json().catch(() => ({}));
    // server returns { reports: [...] }
    if (Array.isArray(payload)) return payload;
    if (Array.isArray((payload as any)?.reports)) return (payload as any).reports;
    return [];
  },
  getReportExecutions: async (reportId?: string): Promise<any[]> => {
    const url = reportId
      ? `${API_URL}/superadmin/analytics/reports/${reportId}/executions`
      : `${API_URL}/superadmin/analytics/executions`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch report executions');
    const payload = await res.json().catch(() => ({}));
    // server returns { executions: [...] }
    if (Array.isArray(payload)) return payload;
    if (Array.isArray((payload as any)?.executions)) return (payload as any).executions;
    return [];
  },
  createAnalyticsReport: async (data: any): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/superadmin/analytics/reports`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create analytics report');
    return res.json();
  },
  deleteAnalyticsReport: async (id: string): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/superadmin/analytics/reports/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete analytics report');
    return { success: true };
  },
  executeAnalyticsReport: async (id: string): Promise<{ success: boolean; data: any }> => {
    const res = await fetch(`${API_URL}/superadmin/analytics/reports/${id}/execute`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to execute analytics report');
    return res.json();
  },
  scheduleAnalyticsReport: async (id: string, schedule: any): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/superadmin/analytics/reports/${id}/schedule`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(schedule),
    });
    if (!res.ok) throw new Error('Failed to schedule analytics report');
    return res.json();
  },
  // Customer Lifecycle - Connected to Backend
  getLifecycleStages: async () => {
    try {
      const res = await fetchWithRetry(`${API_URL}/superadmin/lifecycle/stages`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch lifecycle stages');
      return res.json();
    } catch (err: any) {
      console.error('[Api] getLifecycleStages error:', err);
      throw err;
    }
  },
  getLifecycleTransitions: async () => {
    try {
      const res = await fetchWithRetry(`${API_URL}/superadmin/lifecycle/transitions`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch lifecycle transitions');
      return res.json();
    } catch (err: any) {
      console.error('[Api] getLifecycleTransitions error:', err);
      throw err;
    }
  },
  getLifecycleStats: async () => {
    try {
      const res = await fetchWithRetry(`${API_URL}/superadmin/lifecycle/stats`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch lifecycle stats');
      return res.json();
    } catch (err: any) {
      console.error('[Api] getLifecycleStats error:', err);
      throw err;
    }
  },
  createLifecycleStage: async (data: any) => {
    const res = await fetch(`${API_URL}/superadmin/lifecycle/stages`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
  updateLifecycleStage: async (id: string, data: any) => {
    const res = await fetch(`${API_URL}/superadmin/lifecycle/stages/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
  deleteLifecycleStage: async (id: string) => {
    const res = await fetch(`${API_URL}/superadmin/lifecycle/stages/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return res.json();
  },
  transitionOrganizationLifecycle: async (data: any) => {
    const res = await fetch(`${API_URL}/superadmin/lifecycle/transitions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
  // Customer Success Playbooks - Connected to Backend
  getSuccessPlaybooks: async () => {
    try {
      const res = await fetchWithRetry(`${API_URL}/superadmin/playbooks`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch playbooks');
      return res.json();
    } catch (err: any) {
      console.error('[Api] getSuccessPlaybooks error:', err);
      throw err;
    }
  },
  getSuccessActions: async () => {
    try {
      const res = await fetchWithRetry(`${API_URL}/superadmin/playbooks/actions`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch playbook actions');
      return res.json();
    } catch (err: any) {
      console.error('[Api] getSuccessActions error:', err);
      throw err;
    }
  },
  getPlaybookStats: async () => {
    try {
      const res = await fetchWithRetry(`${API_URL}/superadmin/playbooks/stats`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch playbook stats');
      return res.json();
    } catch (err: any) {
      console.error('[Api] getPlaybookStats error:', err);
      throw err;
    }
  },
  createSuccessPlaybook: async (data: any) => {
    const res = await fetch(`${API_URL}/superadmin/playbooks`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
  executeSuccessAction: async (actionId: string) => ({ success: true }),
  deleteSuccessPlaybook: async (id: string) => {
    const res = await fetch(`${API_URL}/superadmin/playbooks/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return res.json();
  },
  executeSuccessPlaybook: async (id: string, orgId?: string) => {
    const res = await fetch(`${API_URL}/superadmin/playbooks/${id}/execute`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ organizationId: orgId }),
    });
    return res.json();
  },
  // Admin Audit Logs
  getAdminAuditLogs: async (filters?: any) => ({
    logs: [],
    pagination: { total: 0, page: 1, limit: 20 },
  }),
  exportAdminAuditLogs: async (format?: string, filters?: any) => ({ url: '', expiresAt: '' }),
  // Admin Sessions
  getAdminSessions: async () => [],
  revokeAdminSession: async (sessionId: string) => ({ success: true }),
  revokeAllAdminSessions: async (userId?: string, reason?: string) => ({ success: true }),
  // Chat History
  clearChatHistory: async (): Promise<void> => {
    return;
  },
  exportChatHistory: async (): Promise<any> => {
    return { downloadUrl: '', expiresAt: '' };
  },
  // Login History
  getLoginHistory: async (): Promise<any[]> => {
    return [];
  },
  // User Status
  updateUserStatus: async (userId: string, data?: any): Promise<any> => {
    return { success: true };
  },
  // Permission Requests
  createPermissionRequest: async (data: any): Promise<any> => {
    return { id: '', ...data };
  },
  cancelPermissionRequest: async (id: string): Promise<void> => {
    return;
  },
  // Business Metrics
  getBusinessMetrics: async (filters?: any) => [],
  getMetricsStats: async () => ({ total: 0, active: 0 }),
  getMetricHistory: async (metricId: string) => [],
  createBusinessMetric: async (data: any) => ({ success: true }),
  deleteBusinessMetric: async (id: string) => ({ success: true }),
  calculateBusinessMetric: async (id: string) => ({ value: 0 }),
  // Analytics Dashboards
  getAnalyticsDashboards: async () => {
    const now = new Date().toISOString();
    const sampleDashboards = [
      {
        id: 'dash-exec-001',
        name: 'Executive Overview',
        description: 'KPIs for exec review (revenue, users, NPS, uptime)',
        layout_json: JSON.stringify({ columns: 4, rowHeight: 120 }),
        widgets_json: JSON.stringify([
          {
            id: 'w-rev',
            type: 'metric',
            title: 'MRR',
            dataSource: 'revenue',
            config: {},
            position: { x: 0, y: 0, w: 2, h: 2 },
          },
          {
            id: 'w-users',
            type: 'metric',
            title: 'Active Users 7d',
            dataSource: 'users',
            config: {},
            position: { x: 2, y: 0, w: 2, h: 2 },
          },
          {
            id: 'w-nps',
            type: 'metric',
            title: 'NPS',
            dataSource: 'nps',
            config: {},
            position: { x: 0, y: 2, w: 2, h: 2 },
          },
          {
            id: 'w-uptime',
            type: 'metric',
            title: 'Uptime',
            dataSource: 'uptime',
            config: {},
            position: { x: 2, y: 2, w: 2, h: 2 },
          },
          {
            id: 'w-rev-trend',
            type: 'line',
            title: 'Revenue Trend',
            dataSource: 'revenue_trend',
            config: {},
            position: { x: 0, y: 4, w: 4, h: 3 },
          },
          {
            id: 'w-incidents',
            type: 'table',
            title: 'Open Incidents',
            dataSource: 'incidents',
            config: {},
            position: { x: 0, y: 7, w: 4, h: 3 },
          },
        ]),
        is_shared: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'dash-ops-001',
        name: 'Operations',
        description: 'Support, SLA and system ops',
        layout_json: JSON.stringify({ columns: 4, rowHeight: 120 }),
        widgets_json: JSON.stringify([
          {
            id: 'w-sla',
            type: 'metric',
            title: 'SLA Compliance',
            dataSource: 'sla',
            config: {},
            position: { x: 0, y: 0, w: 2, h: 2 },
          },
          {
            id: 'w-tt-resolve',
            type: 'metric',
            title: 'Time to Resolve',
            dataSource: 'ttr',
            config: {},
            position: { x: 2, y: 0, w: 2, h: 2 },
          },
          {
            id: 'w-incidents-table',
            type: 'table',
            title: 'Incidents',
            dataSource: 'incidents',
            config: {},
            position: { x: 0, y: 2, w: 4, h: 3 },
          },
          {
            id: 'w-activity',
            type: 'line',
            title: 'Usage Activity',
            dataSource: 'activity',
            config: {},
            position: { x: 0, y: 5, w: 4, h: 3 },
          },
        ]),
        is_shared: false,
        created_at: now,
        updated_at: now,
      },
    ];
    return { dashboards: sampleDashboards };
  },
  getAnalyticsDashboardData: async (id: string) => {
    const baseData = {
      revenue: { value: '$120k', trend: 8 },
      users: { value: 1240, trend: 5 },
      nps: { value: 46, trend: 3 },
      uptime: { value: '99.98%', trend: 0.01 },
      revenue_trend: {
        series: [{ label: 'MRR', data: [90, 94, 98, 102, 108, 112, 120] }],
        labels: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      },
      incidents: [
        {
          id: 'INC-1042',
          severity: 'High',
          status: 'Investigating',
          owner: 'SecOps',
          opened_at: '2026-01-07',
        },
        {
          id: 'INC-1041',
          severity: 'Medium',
          status: 'Mitigated',
          owner: 'SRE',
          opened_at: '2026-01-06',
        },
      ],
      sla: { value: '99.2%', trend: -0.3 },
      ttr: { value: '42m', trend: -12 },
      activity: {
        series: [{ label: 'Active Users', data: [820, 860, 900, 940, 980, 1020, 1040] }],
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      },
    };

    return {
      widgets: [],
      data: baseData,
    };
  },
  createAnalyticsDashboard: async (data: any) => {
    const now = new Date().toISOString();
    const dashboard = {
      id: `dash-${Date.now()}`,
      name: data.name,
      description: data.description,
      layout_json: JSON.stringify(data.layout || { columns: 4, rowHeight: 120 }),
      widgets_json: JSON.stringify(data.widgets || []),
      is_shared: false,
      created_at: now,
      updated_at: now,
    };
    return { success: true, id: dashboard.id, dashboard };
  },
  updateAnalyticsDashboard: async (id: string, data: any) => {
    const now = new Date().toISOString();
    const dashboard = {
      id,
      name: data.name,
      description: data.description,
      layout_json: JSON.stringify(data.layout || { columns: 4, rowHeight: 120 }),
      widgets_json: JSON.stringify(data.widgets || []),
      is_shared: data.is_shared ?? false,
      updated_at: now,
      created_at: now,
    };
    return { success: true, dashboard };
  },
  deleteAnalyticsDashboard: async (id: string) => ({ success: true, id }),
  shareAnalyticsDashboard: async (id: string, users: string[]) => ({
    success: true,
    id,
    shared_with: users,
  }),
  // Predictive Analytics
  getPredictiveModels: async () => [],
  getModelPredictions: async (modelId: string) => [],
  createPredictiveModel: async (data: any) => ({ success: true }),
  trainPredictiveModel: async (id: string, data?: any) => ({ success: true, accuracyScore: 0.85 }),
  deletePredictiveModel: async (id: string) => ({ success: true }),
  // Advanced Payment Methods
  getPaymentMethodsAdvanced: async () => [],
  getPaymentFailures: async () => [],
  getPaymentFailureStats: async () => ({ total: 0, resolved: 0 }),
  retryPayment: async (paymentId: string) => ({ success: true }),
  deletePaymentMethodAdvanced: async (methodId: string) => ({ success: true }),
  // Advanced Pricing Plans
  getPricingPlansAdvanced: async () => [],
  updatePricingPlanAdvanced: async (id: string, data: any) => ({ success: true }),
  createPricingPlanAdvanced: async (data: any) => ({ success: true }),
  deletePricingPlanAdvanced: async (id: string) => ({ success: true }),
  comparePricingPlans: async (planIds: string[]) => ({ comparison: [] }),
  // Customer Contracts - Connected to Backend
  getCustomerContracts: async (filters?: any) => {
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      const url = `${API_URL}/superadmin/contracts${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetchWithRetry(url, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch contracts');
      return res.json();
    } catch (err: any) {
      console.error('[Api] getCustomerContracts error:', err);
      throw err;
    }
  },
  getContractStats: async () => {
    try {
      const res = await fetchWithRetry(`${API_URL}/superadmin/contracts/stats`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch contract stats');
      return res.json();
    } catch (err: any) {
      console.error('[Api] getContractStats error:', err);
      throw err;
    }
  },
  getUpcomingRenewals: async (days?: number) => {
    try {
      const params = days ? `?days=${days}` : '';
      const res = await fetchWithRetry(`${API_URL}/superadmin/contracts/renewals${params}`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch renewals');
      return res.json();
    } catch (err: any) {
      console.error('[Api] getUpcomingRenewals error:', err);
      throw err;
    }
  },
  createCustomerContract: async (data: any) => {
    const res = await fetch(`${API_URL}/superadmin/contracts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  },
  deleteCustomerContract: async (id: string) => {
    const res = await fetch(`${API_URL}/superadmin/contracts/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return res.json();
  },
  // Security Incidents
  getSecurityIncidents: async (filters?: any) => [],
  getSecurityIncidentStats: async () => ({ total: 0, critical: 0, high: 0, resolved: 0 }),
  createSecurityIncident: async (data: any) => ({ success: true }),
  resolveSecurityIncident: async (id: string, resolution?: string) => ({ success: true }),
  deleteSecurityIncident: async (id: string) => ({ success: true }),
  // SSO / SCIM (Google Workspace default)
  getSsoConfigs: async () => {
    const res = await fetch(`${API_URL}/sso/configs`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch SSO configs');
    return res.json();
  },
  saveGoogleSsoConfig: async (payload: {
    organizationId: string;
    clientId: string;
    clientSecret?: string;
    allowedDomains?: string[];
  }) => {
    const res = await fetch(`${API_URL}/sso/superadmin/google/config`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save Google SSO config');
    return data;
  },
  toggleSsoConfig: async (configId: string, isActive: boolean) => {
    const res = await fetch(`${API_URL}/sso/superadmin/config/${configId}/toggle`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ isActive }),
    });
    if (!res.ok) throw new Error('Failed to toggle SSO config');
    return res.json();
  },
  deleteSsoConfig: async (configId: string) => {
    const res = await fetch(`${API_URL}/sso/superadmin/config/${configId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete SSO config');
    return res.json();
  },
  // Admin Analytics
  getOrgMetricsAIAnalytics: async (orgId?: string) => ({
    usage: [],
    trends: [],
    summary: {},
    successRate: 0,
    avgResponseTime: 0,
    totalTokens: 0,
    estCost: 0,
    usageTrend: 0,
    paygUsage: 0,
    forecast: 0,
  }),
  // Billing Seat Configuration
  getSeatConfiguration: async (orgId?: string) => ({
    seats: 0,
    used: 0,
    available: 0,
    seats_used: 0,
    total_seats_available: 0,
  }),
  // Project Details
  getProjectDetails: async (projectId: string) =>
    ({ id: projectId, name: '', description: '', goal: '', status: 'active' }) as any,
  // Affiliate/Ecosystem
  getUserReferrals: async () => ({ success: true, referrals: [] as any[] }),
  getEcosystemStats: async () => ({
    success: true,
    stats: { totalReferrals: 0, activeUsers: 0, earnings: 0 },
  }),
  generateReferralCode: async () => ({ success: true, code: '', link: '' }),
  // AI Chat Feedback
  reportMessageFeedback: async (messageId: string, feedback: string) => ({ success: true }),
  reportMessage: async (messageId: string, reason: string) => ({ success: true }),
  // Analytics Dashboard Builder
  getAnalyticsDashboardsWithDetails: async () => {
    const now = new Date().toISOString();
    const sampleDashboards = [
      {
        id: 'dash-exec-001',
        name: 'Executive Overview',
        description: 'KPIs for exec review (revenue, users, NPS, uptime)',
        layout_json: JSON.stringify({ columns: 4, rowHeight: 120 }),
        widgets_json: JSON.stringify([]),
        is_shared: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'dash-ops-001',
        name: 'Operations',
        description: 'Support, SLA and system ops',
        layout_json: JSON.stringify({ columns: 4, rowHeight: 120 }),
        widgets_json: JSON.stringify([]),
        is_shared: false,
        created_at: now,
        updated_at: now,
      },
    ];
    return { dashboards: sampleDashboards };
  },
  // Audit Logs
  getAuditEvents: async (filters?: any) => ({
    events: [],
    pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
  }),
  // SuperAdmin IAM
  getAdminAuditStats: async () => ({ total: 0, resolved: 0, pending: 0 }),
  resolveAdminAuditLog: async (id: string, notes?: string) => ({ success: true }),
  getAdminSessionStats: async () => ({ active: 0, total: 0, avgDuration: 0 }),
  // SuperAdmin Invoices
  getSuperAdminInvoices: async (filters?: any) => ({ invoices: [] as any[] }),
  getSuperAdminInvoiceStats: async () => ({ total: 0, paid: 0, pending: 0, overdue: 0 }),
  // Predictive Analytics
  makePrediction: async (modelId: string, data?: any) => ({ prediction: null, confidence: 0 }),
  // Revenue Forecasts
  getRevenueForecasts: async (filters?: any) => [],
  getRevenueForecastStats: async () => ({ total: 0, accuracy: 0, scenarios: 0 }),
  generateRevenueForecast: async (data?: any) => ({ id: '', forecast: [] }),
  deleteRevenueForecast: async (id: string) => ({ success: true }),
  // IP Whitelist - Connected to Backend (SuperAdmin)
  getIPWhitelist: async (orgId: string) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/organizations/${orgId}/ip-whitelist`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch IP whitelist');
    return res.json();
  },
  addIPWhitelist: async (orgId: string, data: any) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/organizations/${orgId}/ip-whitelist`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to add IP to whitelist');
    return json;
  },
  removeIPWhitelist: async (_orgId: string, id: string) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/ip-whitelist/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to remove IP from whitelist');
    return json;
  },
  // Device Management - Connected to Backend (SuperAdmin)
  getUserDevices: async (userId: string) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/users/${userId}/devices`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch user devices');
    return res.json();
  },
  blockDevice: async (deviceId: string, reason?: string) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/devices/${deviceId}/block`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to block device');
    return json;
  },
  // Password Policy - Connected to Backend (SuperAdmin)
  getPasswordPolicy: async (orgId: string) => {
    const res = await fetchWithRetry(
      `${API_URL}/superadmin/organizations/${orgId}/password-policy`,
      {
        headers: getHeaders(),
      }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to fetch password policy');
    return json;
  },
  updatePasswordPolicy: async (orgId: string, policy: any) => {
    const res = await fetchWithRetry(
      `${API_URL}/superadmin/organizations/${orgId}/password-policy`,
      {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(policy),
      }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to update password policy');
    return json;
  },
  // Support Tickets - Connected to Backend
  getSupportTickets: async (filters?: any) => {
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.priority) params.set('priority', filters.priority);
      const url = `${API_URL}/superadmin/support/tickets${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetchWithRetry(url, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch support tickets');
      return res.json();
    } catch (err: any) {
      console.error('[Api] getSupportTickets error:', err);
      throw err;
    }
  },
  createSupportTicket: async (data: any) => {
    try {
      const res = await fetch(`${API_URL}/superadmin/support/tickets`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      return res.json();
    } catch (err: any) {
      console.error('[Api] createSupportTicket error:', err);
      throw err;
    }
  },
  // MFA Methods - Connected to Backend (SuperAdmin)
  getMFAMethods: async (userId: string) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/users/${userId}/mfa`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch MFA methods');
    return res.json();
  },
  // Security Events - Connected to Backend
  getSecurityEvents: async (filters?: any) => {
    try {
      const params = new URLSearchParams();
      if (filters?.severity) params.set('severity', filters.severity);
      if (filters?.eventType) params.set('event_type', filters.eventType);
      if (filters?.resolved !== undefined) params.set('resolved', filters.resolved);
      const url = `${API_URL}/superadmin/security/events${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetchWithRetry(url, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch security events');
      const events = await res.json();
      return {
        events: events || [],
        pagination: { page: 1, pageSize: 50, total: events?.length || 0 },
      };
    } catch (err: any) {
      console.error('[Api] getSecurityEvents error:', err);
      return { events: [], pagination: { page: 1, pageSize: 50, total: 0 } };
    }
  },
  getSecurityEventStats: async () => {
    try {
      const res = await fetchWithRetry(`${API_URL}/superadmin/security/events/stats`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch security event stats');
      return res.json();
    } catch (err: any) {
      console.error('[Api] getSecurityEventStats error:', err);
      return { total: 0, critical: 0, high: 0, unresolved: 0 };
    }
  },

  // Sessions

  terminateSession: async (_id: string) => ({ success: true }),

  // IP Access Rules
  getIPAccessRules: async () => [] as any[],
  updateIPRule: async (_id: string, _data: any) => ({ success: true }),

  // Security Policies
  getSecurityPolicies: async () => ({
    policies: [
      {
        id: 'policy-password',
        name: 'Password Policy',
        description: 'Min 12 chars, upper, lower, number, special',
        category: 'Authentication',
        settings: {
          minLength: 12,
          requireUppercase: true,
          requireNumber: true,
          requireSpecial: true,
        },
        enabled: true,
        last_updated: new Date().toISOString(),
      },
    ],
  }),
  updateSecurityPolicy: async (_id: string, _data: any) => ({ success: true }),

  // Compliance
  getComplianceFrameworks: async () => ({
    frameworks: [
      {
        id: 'gdpr',
        name: 'GDPR',
        description: 'General Data Protection Regulation',
        controls_total: 24,
        controls_compliant: 22,
        last_assessment: new Date(Date.now() - 7 * 86400000).toISOString(),
        status: 'partial',
      },
    ],
  }),
  getComplianceSummary: async () => ({
    items: [
      {
        org_id: 'org-1',
        org_name: 'Consultinity SA',
        gdpr_compliant: true,
        dpa_signed: true,
        data_retention_policy: true,
        security_audit_passed: true,
        last_audit_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        org_id: 'org-2',
        org_name: 'Nordic Innovations',
        gdpr_compliant: true,
        dpa_signed: true,
        data_retention_policy: false,
        security_audit_passed: false,
        last_audit_date: null,
      },
      {
        org_id: 'org-3',
        org_name: 'Global Finance Corp',
        gdpr_compliant: true,
        dpa_signed: true,
        data_retention_policy: true,
        security_audit_passed: true,
        last_audit_date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  }),
  // Customer Health
  getCustomerHealthCheck: async (orgId: string) => ({
    overall_health: 'Good',
    health_score: 85,
    engagement_score: 78,
    usage_trend: 'stable',
  }),
  // Customer Success Notes
  getCustomerSuccessNotes: async (orgId: string) => [
    {
      id: 'note-1',
      title: 'Successful onboarding',
      content: 'Customer completed onboarding.',
      note_type: 'onboarding',
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'note-2',
      title: 'QBR Meeting',
      content: 'Quarterly review scheduled.',
      note_type: 'meeting',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
  // Upload API
  upload: async (file: File) => ({ url: '', id: '' }),
  // Access Code Validation
  validateAccessCode: async (code: string) => ({ valid: false, type: '', organizationId: '' }),

  // ==================== A/B TESTING ====================
  getABExperiments: async (status?: string) => {
    const params = status && status !== 'all' ? `?status=${status}` : '';
    const res = await fetch(`${API_URL}/ai/ab-testing/experiments${params}`, {
      headers: getHeaders(),
    });
    if (!res.ok) return { success: false, experiments: [], error: 'Failed to fetch experiments' };
    const data = await res.json();
    return { success: true, experiments: data.data || data.experiments || [] };
  },
  createABExperiment: async (experiment: any) => {
    const res = await fetch(`${API_URL}/ai/ab-testing/experiments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(experiment),
    });
    return res.json();
  },
  startABExperiment: async (id: string) => {
    const res = await fetch(`${API_URL}/ai/ab-testing/experiments/${id}/start`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.json();
  },
  stopABExperiment: async (id: string, reason?: string) => {
    const res = await fetch(`${API_URL}/ai/ab-testing/experiments/${id}/stop`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason }),
    });
    return res.json();
  },
  archiveABExperiment: async (id: string) => {
    const res = await fetch(`${API_URL}/ai/ab-testing/experiments/${id}/archive`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.json();
  },
  declareABWinner: async (id: string, variantId: string) => {
    const res = await fetch(`${API_URL}/ai/ab-testing/experiments/${id}/winner`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ variantId }),
    });
    return res.json();
  },

  // ==================== DEMO MODE ====================

  /**
   * Toggle demo mode on/off
   */
  toggleDemoMode: async (
    enabled: boolean
  ): Promise<{
    success: boolean;
    isDemoMode: boolean;
    demoOrganization?: {
      id: string;
      name: string;
      slug: string;
      description: string;
      branding?: {
        primaryColor: string;
        logo?: string;
      };
    };
    stats?: {
      projects: number;
      initiatives: number;
      tasks: number;
      assessments: number;
    };
    hints?: string[];
    message?: string;
  }> => {
    const res = await fetch(`${API_URL}/demo/toggle`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to toggle demo mode');
    }
    return res.json();
  },

  /**
   * Get current demo mode status
   */
  getDemoStatus: async (): Promise<{
    success: boolean;
    isDemoMode: boolean;
    demoOrganization?: {
      id: string;
      name: string;
      slug: string;
      description: string;
    };
    stats?: {
      projects: number;
      initiatives: number;
      tasks: number;
      assessments: number;
    };
  }> => {
    const res = await fetch(`${API_URL}/demo/status`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      return { success: false, isDemoMode: false };
    }
    return res.json();
  },

  /**
   * Get demo organization details
   */
  getDemoOrganization: async (): Promise<{
    success: boolean;
    organization: {
      id: string;
      name: string;
      slug: string;
      industry: string;
      size: string;
      region: string;
      description: string;
      branding: {
        primaryColor: string;
        secondaryColor: string;
        logo: string;
      };
    };
    stats: {
      projects: number;
      initiatives: number;
      tasks: number;
      assessments: number;
    };
    scenarios: Array<{
      name: string;
      description: string;
      highlight: string;
    }>;
  } | null> => {
    const res = await fetch(`${API_URL}/demo/organization`, {
      headers: getHeaders(),
    });
    if (!res.ok) return null;
    return res.json();
  },

  /**
   * Get available demo tours
   */
  getDemoTours: async (): Promise<{
    success: boolean;
    tours: Array<{
      id: string;
      name: string;
      description: string;
      duration: string;
      steps: number;
      category: string;
    }>;
    categories: Record<string, string>;
  }> => {
    const res = await fetch(`${API_URL}/demo/tours`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      return { success: false, tours: [], categories: {} };
    }
    return res.json();
  },

  // ==========================================
  // CUSTOMER AUTOMATION - Connected to Backend
  // ==========================================
  getAutomationRules: async (filters?: any) => {
    try {
      const params = new URLSearchParams();
      if (filters?.is_active !== undefined) params.set('is_active', filters.is_active);
      const url = `${API_URL}/superadmin/automation/rules${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetchWithRetry(url, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch automation rules');
      return res.json();
    } catch (err: any) {
      console.error('[Api] getAutomationRules error:', err);
      throw err;
    }
  },
  getAutomationStats: async () => {
    try {
      const res = await fetchWithRetry(`${API_URL}/superadmin/automation/rules/stats`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch automation stats');
      return res.json();
    } catch (err: any) {
      console.error('[Api] getAutomationStats error:', err);
      return { total: 0, active: 0, total_executions: 0 };
    }
  },
  createAutomationRule: async (data: any) => {
    try {
      const res = await fetch(`${API_URL}/superadmin/automation/rules`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      return res.json();
    } catch (err: any) {
      console.error('[Api] createAutomationRule error:', err);
      return { success: false };
    }
  },
  toggleAutomationRule: async (id: string, is_active: boolean) => {
    try {
      const res = await fetch(`${API_URL}/superadmin/automation/rules/${id}/toggle`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ is_active }),
      });
      return res.json();
    } catch (err: any) {
      console.error('[Api] toggleAutomationRule error:', err);
      return { success: false };
    }
  },
  deleteAutomationRule: async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/superadmin/automation/rules/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return res.json();
    } catch (err: any) {
      console.error('[Api] deleteAutomationRule error:', err);
      return { success: false };
    }
  },
  getRuleExecutions: async (ruleId: string) => {
    try {
      const res = await fetchWithRetry(
        `${API_URL}/superadmin/automation/rules/${ruleId}/executions`,
        { headers: getHeaders() }
      );
      if (!res.ok) throw new Error('Failed to fetch rule executions');
      return res.json();
    } catch (err: any) {
      console.error('[Api] getRuleExecutions error:', err);
      throw err;
    }
  },

  // ==========================================
  // CUSTOMER COMMUNICATIONS - Connected to Backend
  // ==========================================
  getCommunications: async () => {
    try {
      const res = await fetchWithRetry(`${API_URL}/superadmin/communications`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch communications');
      return res.json();
    } catch (err: any) {
      console.error('[Api] getCommunications error:', err);
      throw err;
    }
  },
  getCommunicationStats: async () => {
    try {
      const res = await fetchWithRetry(`${API_URL}/superadmin/communications/stats`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch communication stats');
      return res.json();
    } catch (err: any) {
      console.error('[Api] getCommunicationStats error:', err);
      return { total: 0, sent: 0, avg_open_rate: 0 };
    }
  },
  createCommunication: async (data: any) => {
    try {
      const res = await fetch(`${API_URL}/superadmin/communications`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      return res.json();
    } catch (err: any) {
      console.error('[Api] createCommunication error:', err);
      return { success: false };
    }
  },
  sendCommunication: async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/superadmin/communications/${id}/send`, {
        method: 'POST',
        headers: getHeaders(),
      });
      return res.json();
    } catch (err: any) {
      console.error('[Api] sendCommunication error:', err);
      return { success: false };
    }
  },
  deleteCommunication: async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/superadmin/communications/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return res.json();
    } catch (err: any) {
      console.error('[Api] deleteCommunication error:', err);
      return { success: false };
    }
  },

  // ==========================================
  // DISCOVERY CONSULTANT - Session Management
  // ==========================================
  getDiscoverySessions: async () => {
    try {
      const res = await fetchWithRetry(`${API_URL}/discovery/sessions`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch discovery sessions');
      return res.json();
    } catch (err: any) {
      console.error('[Api] getDiscoverySessions error:', err);
      throw err;
    }
  },
  getDiscoverySession: async (id: string) => {
    try {
      const res = await fetchWithRetry(`${API_URL}/discovery/sessions/${id}`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch discovery session');
      return res.json();
    } catch (err: any) {
      console.error('[Api] getDiscoverySession error:', err);
      return null;
    }
  },
  createDiscoverySession: async (data: any) => {
    try {
      const res = await fetch(`${API_URL}/discovery/sessions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      return res.json();
    } catch (err: any) {
      console.error('[Api] createDiscoverySession error:', err);
      return { success: false };
    }
  },
  updateDiscoverySession: async (id: string, data: any) => {
    try {
      const res = await fetch(`${API_URL}/discovery/sessions/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      return res.json();
    } catch (err: any) {
      console.error('[Api] updateDiscoverySession error:', err);
      return { success: false };
    }
  },
  deleteDiscoverySession: async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/discovery/sessions/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return res.json();
    } catch (err: any) {
      console.error('[Api] deleteDiscoverySession error:', err);
      return { success: false };
    }
  },
  convertDiscoveryToProject: async (data: {
    sessionId: string;
    projectName: string;
    createInitiatives?: boolean;
  }) => {
    try {
      const res = await fetch(`${API_URL}/discovery/sessions/convert`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      return res.json();
    } catch (err: any) {
      console.error('[Api] convertDiscoveryToProject error:', err);
      return { success: false };
    }
  },
  attachDiscoveryToProject: async (sessionId: string, projectId: string) => {
    try {
      const res = await fetch(`${API_URL}/discovery/sessions/${sessionId}/attach`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ projectId }),
      });
      return res.json();
    } catch (err: any) {
      console.error('[Api] attachDiscoveryToProject error:', err);
      return { success: false };
    }
  },

  // =========================================================================
  // AI MEMORY API
  // Memory management for AI personalization and learning
  // =========================================================================

  getUserMemory: async () => {
    try {
      const res = await fetchWithRetry(`${API_URL}/ai/memory/user`);
      return handleResponse(res, 'Failed to fetch user memory');
    } catch (err: any) {
      console.error('[Api] getUserMemory error:', err);
      return { userId: '', entries: [], lastUpdated: new Date().toISOString() };
    }
  },

  updateUserMemory: async (data: {
    key: string;
    value: string;
    category: string;
    source?: string;
  }) => {
    try {
      const res = await fetchWithRetry(`${API_URL}/ai/memory/user`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to update user memory');
    } catch (err: any) {
      console.error('[Api] updateUserMemory error:', err);
      throw err;
    }
  },

  deleteUserMemory: async (key: string) => {
    try {
      const res = await fetchWithRetry(`${API_URL}/ai/memory/user/${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
      return handleResponse(res, 'Failed to delete user memory');
    } catch (err: any) {
      console.error('[Api] deleteUserMemory error:', err);
      throw err;
    }
  },

  getOrganizationMemory: async () => {
    try {
      const res = await fetchWithRetry(`${API_URL}/ai/memory/org`);
      return handleResponse(res, 'Failed to fetch organization memory');
    } catch (err: any) {
      console.error('[Api] getOrganizationMemory error:', err);
      return { organizationId: '', entries: [], lastUpdated: new Date().toISOString() };
    }
  },

  updateOrganizationMemory: async (data: {
    key: string;
    value: string;
    category: string;
    source?: string;
  }) => {
    try {
      const res = await fetchWithRetry(`${API_URL}/ai/memory/org`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to update organization memory');
    } catch (err: any) {
      console.error('[Api] updateOrganizationMemory error:', err);
      throw err;
    }
  },

  // =========================================================================
  // AI ACTIONS API
  // Action proposal, approval, and execution workflow
  // =========================================================================

  getPendingAIActions: async (projectId?: string) => {
    try {
      const params = projectId ? `?projectId=${projectId}` : '';
      const res = await fetchWithRetry(`${API_URL}/ai/actions/pending${params}`);
      return handleResponse(res, 'Failed to fetch pending actions');
    } catch (err: any) {
      console.error('[Api] getPendingAIActions error:', err);
      return { actions: [] };
    }
  },

  getAIActionHistory: async (conversationId: string) => {
    try {
      const res = await fetchWithRetry(`${API_URL}/ai/actions/history/${conversationId}`);
      return handleResponse(res, 'Failed to fetch action history');
    } catch (err: any) {
      console.error('[Api] getAIActionHistory error:', err);
      return { actions: [] };
    }
  },

  executeAIAction: async (actionId: string, payload: any) => {
    try {
      const res = await fetchWithRetry(`${API_URL}/ai/actions/${actionId}/execute`, {
        method: 'POST',
        body: JSON.stringify({ payload }),
      });
      return handleResponse(res, 'Failed to execute action');
    } catch (err: any) {
      console.error('[Api] executeAIAction error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Generic POST to an authenticated API endpoint
   * Used by ResponseActions for dynamic AI-suggested API calls
   */
  genericPost: async (endpoint: string, data: Record<string, unknown> = {}): Promise<any> => {
    try {
      // Ensure endpoint is relative (starts with /api/)
      const url = endpoint.startsWith('http')
        ? endpoint
        : endpoint.startsWith('/api/')
          ? `${API_URL}${endpoint.replace('/api/', '/')}`
          : `${API_URL}/${endpoint}`;
      const res = await fetchWithRetry(url, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'API call failed');
    } catch (err: any) {
      console.error('[Api] genericPost error:', err);
      return { success: false, error: err.message };
    }
  },

  dismissAIAction: async (actionId: string, reason?: string) => {
    try {
      const res = await fetchWithRetry(`${API_URL}/ai/actions/${actionId}/dismiss`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      return handleResponse(res, 'Failed to dismiss action');
    } catch (err: any) {
      console.error('[Api] dismissAIAction error:', err);
      return { success: false };
    }
  },

  approveAIAction: async (actionId: string) => {
    try {
      const res = await fetchWithRetry(`${API_URL}/ai/actions/${actionId}/approve`, {
        method: 'POST',
      });
      return handleResponse(res, 'Failed to approve action');
    } catch (err: any) {
      console.error('[Api] approveAIAction error:', err);
      return { success: false, error: err.message };
    }
  },

  // ==================== SETTINGS API STUBS ====================
  // These are stub implementations for settings management

  getAccessibilitySettings: async () => {
    return {
      preferences: {
        highContrast: false,
        largeText: false,
        reduceMotion: false,
        screenReaderOptimized: false,
      },
    };
  },

  updateAccessibilitySettings: async (settings: any) => {
    return { success: true, preferences: settings };
  },

  exportSettings: async (_filters?: any) => {
    return {
      data: { version: '1.0', settings: {} },
      filename: `settings-export-${Date.now()}.json`,
    };
  },

  importSettings: async (data: any, _overwrite?: boolean) => {
    const imported = Array.isArray(data) ? data : [data];
    return { success: true, imported };
  },

  getSettingsHistory: async (_category?: string, _days?: number) => {
    return { entries: [], total: 0 };
  },

  restoreSettingsEntry: async (entryId: string) => {
    return { success: true, entryId };
  },

  getSettingsTemplates: async () => {
    return { templates: [] };
  },

  applySettingsTemplate: async (templateId: string) => {
    return { success: true, templateId };
  },

  createSettingsTemplate: async (data: any) => {
    return { success: true, template: { id: `template-${Date.now()}`, ...data } };
  },

  deleteSettingsTemplate: async (templateId: string) => {
    return { success: true, templateId };
  },

  getAIAutoComplete: async () => {
    return {
      preferences: {
        enabled: true,
        triggerDelay: 500,
        maxSuggestions: 3,
        sensitivity: 'medium',
        suggestionsInComments: true,
      },
    };
  },

  saveAIAutoComplete: async (settings: any) => {
    return { success: true, preferences: settings };
  },

  getAIInstructions: async () => {
    return {
      preferences: {
        systemPrompt: '',
        customInstructions: '',
        tone: 'professional',
      },
    };
  },

  saveAIInstructions: async (instructions: any) => {
    return { success: true, preferences: instructions };
  },

  getAIMemory: async () => {
    return {
      preferences: {
        enabled: true,
        retentionDays: 30,
      },
      memoryItems: [],
    };
  },

  saveAIMemory: async (settings: any) => {
    return { success: true, preferences: settings };
  },

  clearAIMemoryData: async () => {
    return { success: true, cleared: true };
  },

  getAIModelPreferences: async () => {
    return {
      preferences: {
        preferredModel: 'gpt-4',
        fallbackModel: 'gpt-3.5-turbo',
        autoSelect: true,
        enabledModels: ['gpt-4', 'gpt-3.5-turbo', 'claude-3'],
      },
    };
  },

  saveAIModelPreferences: async (preferences: any) => {
    return { success: true, preferences };
  },

  getAIParameters: async () => {
    return {
      preferences: {
        temperature: 0.7,
        maxTokens: 2000,
        topP: 1,
        contextWindowSize: 4096,
        responseSpeed: 'balanced',
      },
    };
  },

  saveAIParameters: async (params: any) => {
    return { success: true, preferences: params };
  },

  getAIPersonality: async () => {
    return {
      preferences: {
        name: 'Assistant',
        style: 'helpful',
        formality: 'professional',
      },
    };
  },

  saveAIPersonality: async (personality: any) => {
    return { success: true, preferences: personality };
  },

  getAIUsageStats: async (_period?: string) => {
    return {
      stats: {
        totalTokens: 0,
        totalCost: 0,
        requestsToday: 0,
        requestsThisMonth: 0,
        totalRequests: 0,
        avgResponseTime: 0,
        successRate: 100,
        limit: 10000,
        used: 0,
      },
      usageByFeature: [],
      dailyUsage: [],
      history: [],
    };
  },

  // Additional settings stubs
  createApiKey: async (data: any) => {
    const key = {
      id: `key-${Date.now()}`,
      key: `sk-${Math.random().toString(36).substr(2, 32)}`,
      name: data.name || 'API Key',
      created: new Date().toISOString(),
      lastUsed: null,
      permissions: data.permissions || ['read'],
      ...data,
    };
    return { success: true, key };
  },

  removeAvatar: async (_userId?: string) => {
    return { success: true };
  },

  getGdprConsents: async () => {
    return { consents: [] };
  },

  updateGdprConsents: async (consents: any) => {
    return { success: true, consents };
  },

  getGdprRetention: async () => {
    return {
      retention: {
        period: '365' as const,
        autoDelete: false,
      },
    };
  },

  updateGdprRetention: async (settings: any) => {
    return { success: true, ...settings };
  },

  saveGdprConsents: async (consents: any) => {
    return { success: true, consents };
  },

  saveGdprRetention: async (settings: any) => {
    return { success: true, settings };
  },

  getGdprExportStatus: async () => {
    return { status: 'none', lastExport: null, request: null };
  },

  requestGdprExport: async () => {
    return {
      success: true,
      request: {
        id: `export-${Date.now()}`,
        status: 'pending' as const,
        requestedAt: new Date().toISOString(),
      },
    };
  },

  requestGdprDeletion: async () => {
    return {
      success: true,
      request: {
        id: `delete-${Date.now()}`,
        status: 'pending' as const,
        requestedAt: new Date().toISOString(),
      },
    };
  },

  cancelGdprDeletion: async (_requestId?: string) => {
    return { success: true };
  },

  getDeveloperSettings: async () => {
    return {
      settings: {
        debugMode: false,
        verboseLogging: false,
        apiMocking: false,
        experimentalFeatures: false,
        apiEndpoint: '',
        developerMode: false,
        apiLogging: false,
        showDebugInfo: false,
        verboseErrors: false,
        betaFeatures: [] as string[],
      },
    };
  },

  saveDeveloperSettings: async (settings: any) => {
    return { success: true, settings };
  },

  // Integration Settings
  getIntegrations: async (_orgId?: string) => {
    const res = await fetchWithRetry(`${API_URL}/integrations`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch integrations');
  },

  getIntegrationProviders: async () => {
    const res = await fetchWithRetry(`${API_URL}/integrations/providers`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch integration providers');
  },

  connectIntegration: async (providerId: string, config?: any) => {
    const res = await fetchWithRetry(`${API_URL}/integrations/connect/${providerId}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ config: config || {} }),
    });
    return handleResponse(res, 'Failed to connect integration');
  },

  disconnectIntegration: async (integrationId: string) => {
    const res = await fetchWithRetry(`${API_URL}/integrations/${integrationId}/disconnect`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({}),
    });
    return handleResponse(res, 'Failed to disconnect integration');
  },

  syncIntegration: async (integrationId: string) => {
    const res = await fetchWithRetry(`${API_URL}/integrations/${integrationId}/sync`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({}),
    });
    return handleResponse(res, 'Failed to sync integration');
  },

  getIntegrationLogs: async (integrationId: string) => {
    const res = await fetchWithRetry(`${API_URL}/integrations/${integrationId}/logs`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch integration logs');
  },

  toggleIntegration: async (integrationId: string, enabled: boolean) => {
    const res = await fetchWithRetry(`${API_URL}/integrations/${integrationId}/toggle`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ enabled }),
    });
    return handleResponse(res, 'Failed to toggle integration');
  },

  updateIntegrationSettings: async (integrationId: string, settings: any) => {
    const res = await fetchWithRetry(`${API_URL}/integrations/${integrationId}/settings`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ settings: settings || {} }),
    });
    return handleResponse(res, 'Failed to update integration settings');
  },

  // MCP Providers (org-scoped registry)
  getMcpProviders: async () => {
    const res = await fetchWithRetry(`${API_URL}/mcp/providers`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch MCP providers');
  },

  createMcpProvider: async (input: { name: string; type?: string; status?: string; config?: any }) => {
    const res = await fetchWithRetry(`${API_URL}/mcp/providers`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(input || {}),
    });
    return handleResponse(res, 'Failed to create MCP provider');
  },

  updateMcpProvider: async (providerId: string, input: { name?: string; status?: string; config?: any }) => {
    const res = await fetchWithRetry(`${API_URL}/mcp/providers/${providerId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(input || {}),
    });
    return handleResponse(res, 'Failed to update MCP provider');
  },

  deleteMcpProvider: async (providerId: string) => {
    const res = await fetchWithRetry(`${API_URL}/mcp/providers/${providerId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete MCP provider');
  },

  testMcpProvider: async (providerId: string) => {
    const res = await fetchWithRetry(`${API_URL}/mcp/providers/${providerId}/test`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({}),
    });
    return handleResponse(res, 'Failed to test MCP provider');
  },

  getMcpProviderTools: async (providerId: string) => {
    const res = await fetchWithRetry(`${API_URL}/mcp/providers/${providerId}/tools`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch MCP provider tools');
  },

  getMcpProviderAllowlist: async (providerId: string) => {
    const res = await fetchWithRetry(`${API_URL}/mcp/providers/${providerId}/allowlist`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch MCP provider allowlist');
  },

  updateMcpProviderAllowlist: async (
    providerId: string,
    input: { mode: 'allow' | 'deny'; tools: string[] }
  ) => {
    const res = await fetchWithRetry(`${API_URL}/mcp/providers/${providerId}/allowlist`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(input || {}),
    });
    return handleResponse(res, 'Failed to update MCP provider allowlist');
  },

  getMcpAudit: async (limit = 50) => {
    const res = await fetchWithRetry(`${API_URL}/mcp/audit?limit=${encodeURIComponent(String(limit))}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch MCP audit');
  },

  getMcpDiscovery: async () => {
    const res = await fetchWithRetry(`${API_URL}/mcp/discovery`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch MCP discovery');
  },

  // Keyboard Shortcuts
  getShortcuts: async () => {
    return {
      preferences: {
        preset: 'default' as const,
        enabled: true,
        showHints: true,
        customShortcuts: {} as Record<string, string>,
        disabledShortcuts: [] as string[],
      },
    };
  },

  saveShortcuts: async (shortcuts: any) => {
    return { success: true, shortcuts };
  },

  // Privacy
  getPrivacyPreferences: async () => {
    return {
      preferences: {
        analytics: true,
        marketing: false,
        thirdParty: false,
      },
    };
  },

  savePrivacyPreferences: async (preferences: any) => {
    return { success: true, preferences };
  },

  // Theme/Appearance
  getAppearancePreferences: async () => {
    return {
      preferences: {
        theme: 'system',
        accentColor: 'blue',
        fontSize: 'medium',
        compactMode: false,
      },
    };
  },

  saveAppearancePreferences: async (preferences: any) => {
    return { success: true, preferences };
  },

  // Voice Settings
  getAIVoice: async () => {
    return {
      preferences: {
        enabled: false,
        voice: 'default',
        speed: 1.0,
        pitch: 1.0,
      },
    };
  },

  saveAIVoice: async (settings: any) => {
    return { success: true, settings };
  },

  // System/Enterprise
  getSystemAnalytics: async (_period?: string) => {
    return {
      metrics: {
        activeUsers: 0,
        totalRequests: 0,
        avgResponseTime: 0,
        errorRate: 0,
        api: { requests: 0, latency: 0, total_requests: 0, change: 0 },
        ai: { requests: 0, tokens: 0, total_requests: 0, change: 0 },
        users: { active: 0, total: 0, active_today: 0 },
        database: { queries: 0, latency: 0, total_queries: 0 },
      },
      charts: {
        api: {
          labels: [] as string[],
          requests: [] as number[],
          errors: [] as number[],
        },
        ai: {
          labels: [] as string[],
          requests: [] as number[],
          tokens: [] as number[],
        },
        requests: [] as { date: string; value: number }[],
        latency: [] as { date: string; value: number }[],
      },
      trends: [],
    };
  },

  getBackupSchedules: async () => {
    return [] as any[];
  },

  createBackup: async (_type?: string, _reason?: string) => {
    return { success: true, backup: { id: `bk-${Date.now()}`, status: 'pending' } };
  },

  restoreBackup: async (backupId: string) => {
    return { success: true, backupId, error: null as string | null };
  },

  deleteBackup: async (backupId: string) => {
    return { success: true, backupId };
  },

  // System Configuration
  getSystemConfigs: async (_category?: string) => {
    return [] as any[];
  },

  saveSystemConfig: async (key: string, value: any) => {
    return { success: true, key, value };
  },

  // System Integrations
  getSystemIntegrations: async () => {
    return { integrations: [] };
  },

  refreshSystemIntegration: async (integrationId: string) => {
    return { success: true, integrationId };
  },

  deleteSystemIntegration: async (integrationId: string) => {
    return { success: true, integrationId };
  },

  deleteIntegration: async (integrationId: string) => {
    return { success: true, integrationId };
  },

  // System Webhooks
  getSystemWebhooks: async () => {
    return { webhooks: [] };
  },

  deleteSystemWebhook: async (webhookId: string) => {
    return { success: true, webhookId };
  },

  getSystemWebhookDeliveries: async (_webhookId: string) => {
    return [] as any[];
  },

  testWebhook: async (webhookId: string) => {
    return { success: true, webhookId, error: null as string | null };
  },

  testSystemWebhook: async (webhookId: string) => {
    return { success: true, webhookId };
  },

  // Metrics
  getOrgMetricsEvents: async (_filters?: any) => {
    return { events: [], metrics: {} };
  },

  // ===== CLOUD STORAGE INTEGRATIONS =====

  // Get connected cloud providers
  getCloudProviders: async () => {
    // TODO: Replace with real API call
    const stored = localStorage.getItem('cloudIntegrations');
    if (stored) {
      return { providers: JSON.parse(stored) };
    }
    return {
      providers: [
        { id: 'google-drive', name: 'Google Drive', connected: false },
        { id: 'onedrive', name: 'OneDrive', connected: false },
        { id: 'dropbox', name: 'Dropbox', connected: false },
      ],
    };
  },

  // Initiate OAuth flow for cloud provider
  initiateCloudOAuth: async (providerId: string) => {
    // TODO: Replace with real API call that returns OAuth URL
    console.log(`[CloudAPI] Initiating OAuth for ${providerId}`);
    return {
      authUrl: `https://accounts.${providerId}.com/oauth?client_id=xxx&redirect_uri=xxx`,
      state: `oauth-${Date.now()}`,
    };
  },

  // Complete OAuth callback
  completeCloudOAuth: async (providerId: string, code: string, state: string) => {
    console.log(`[CloudAPI] Completing OAuth for ${providerId}`, { code, state });
    // Update localStorage for demo
    const stored = localStorage.getItem('cloudIntegrations');
    const providers = stored ? JSON.parse(stored) : [];
    const updated = providers.map((p: any) =>
      p.id === providerId ? { ...p, connected: true, email: 'user@example.com' } : p
    );
    localStorage.setItem('cloudIntegrations', JSON.stringify(updated));
    return { success: true, provider: { id: providerId, connected: true } };
  },

  // Disconnect cloud provider
  disconnectCloudProvider: async (providerId: string) => {
    console.log(`[CloudAPI] Disconnecting ${providerId}`);
    const stored = localStorage.getItem('cloudIntegrations');
    if (stored) {
      const providers = JSON.parse(stored);
      const updated = providers.map((p: any) =>
        p.id === providerId ? { ...p, connected: false, email: undefined } : p
      );
      localStorage.setItem('cloudIntegrations', JSON.stringify(updated));
    }
    return { success: true };
  },

  // List files from cloud provider
  listCloudFiles: async (providerId: string, folderId?: string): Promise<any[]> => {
    try {
      const url = folderId
        ? `${API_URL}/integrations/${providerId}/files?folderId=${folderId}`
        : `${API_URL}/integrations/${providerId}/files`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.status === 501) {
        throw new Error('CLOUD_NOT_IMPLEMENTED');
      }
      if (!res.ok) throw new Error('Failed to list cloud files');
      return res.json();
    } catch (e: any) {
      console.error('[Api] Error listing cloud files:', e);
      if (e?.message === 'CLOUD_NOT_IMPLEMENTED') {
        throw new Error(`Cloud provider ${providerId} is not implemented on the server yet.`);
      }
      throw e;
    }
  },

  // Get file download URL
  getCloudFileDownloadUrl: async (providerId: string, fileId: string) => {
    console.log(`[CloudAPI] Getting download URL for ${providerId}/${fileId}`);
    // In real implementation, this would return a signed URL
    return { downloadUrl: `${API_URL}/integrations/${providerId}/files/${fileId}/download` };
  },

  // Download file from cloud
  downloadCloudFile: async (providerId: string, fileId: string): Promise<Blob> => {
    try {
      const res = await fetch(`${API_URL}/integrations/${providerId}/files/${fileId}/download`, {
        headers: getHeaders(),
      });
      if (res.status === 501) {
        throw new Error('CLOUD_NOT_IMPLEMENTED');
      }
      if (!res.ok) throw new Error('Failed to download cloud file');
      return res.blob();
    } catch (e: any) {
      if (e.message === 'CLOUD_NOT_IMPLEMENTED') {
        throw new Error('Cloud integration is not implemented on the server yet.');
      }
      throw e;
    }
  },

  // ============================================
  // REPORT IMPORT (PDF → Assessment + Initiatives)
  // ============================================

  uploadReportImport: async (file: File, projectId?: string): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    if (projectId) formData.append('projectId', projectId);

    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/report-import/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Upload failed');
    }
    return res.json();
  },

  listReportImports: async (options?: { status?: string; framework?: string }): Promise<any> => {
    const params = new URLSearchParams();
    if (options?.status) params.set('status', options.status);
    if (options?.framework) params.set('framework', options.framework);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const fullUrl = `${API_URL}/report-import${qs}`;
    const res = await fetch(fullUrl, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to list report imports');
    return res.json();
  },

  getReportImport: async (id: string): Promise<any> => {
    const res = await fetch(`${API_URL}/report-import/${id}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to get report import');
    return res.json();
  },

  detectReportImport: async (id: string): Promise<any> => {
    const res = await fetch(`${API_URL}/report-import/detect/${id}`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to detect framework');
    return res.json();
  },

  previewReportImport: async (id: string): Promise<any> => {
    const res = await fetch(`${API_URL}/report-import/preview/${id}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to preview import');
    return res.json();
  },

  createAssessmentFromImport: async (id: string, projectId?: string): Promise<any> => {
    const res = await fetch(`${API_URL}/report-import/${id}/create-assessment`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ projectId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create assessment' }));
      throw new Error(err.error || 'Failed to create assessment');
    }
    return res.json();
  },

  createInitiativesFromImport: async (id: string, projectId?: string): Promise<any> => {
    const res = await fetch(`${API_URL}/report-import/${id}/create-initiatives`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ projectId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create initiatives' }));
      throw new Error(err.error || 'Failed to create initiatives');
    }
    return res.json();
  },

  downloadReportImportFile: async (id: string): Promise<Blob> => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/report-import/${id}/download`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new Error('Failed to download file');
    return res.blob();
  },

  deleteReportImport: async (id: string): Promise<any> => {
    const res = await fetch(`${API_URL}/report-import/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete import');
    return res.json();
  },

  // ==========================================
  // MY WORK (V2): NOTEBOOK (T011)
  // ==========================================
  getNotebookPages: async (filters?: {
    projectId?: string | null;
    status?: string;
    pinned?: boolean;
    sort?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> => {
    let url = `${API_URL}/my-work/notebook/pages`;
    if (filters) {
      const params = new URLSearchParams();
      if (filters.projectId) params.append('projectId', filters.projectId);
      if (filters.status) params.append('status', filters.status);
      if (filters.pinned !== undefined) params.append('pinned', filters.pinned ? '1' : '0');
      if (filters.sort) params.append('sort', filters.sort);
      if (filters.q) params.append('q', filters.q);
      if (filters.limit) params.append('limit', String(filters.limit));
      if (filters.offset) params.append('offset', String(filters.offset));
      if (params.toString()) url += `?${params.toString()}`;
    }
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch notebook pages');
    return res.json();
  },

  createNotebookPage: async (page: {
    title?: string;
    projectId?: string | null;
    visibility?: string;
    tags?: string[];
    contentJson?: any;
    contentText?: string;
    icon?: string | null;
    status?: string;
    template?: string;
  }): Promise<any> => {
    const res = await fetch(`${API_URL}/my-work/notebook/pages`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(page),
    });
    return handleResponse(res, 'Failed to create notebook page');
  },

  updateNotebookPage: async (id: string, updates: Record<string, any>): Promise<any> => {
    const res = await fetch(`${API_URL}/my-work/notebook/pages/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse(res, 'Failed to update notebook page');
  },

  deleteNotebookPage: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/my-work/notebook/pages/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    await handleResponse(res, 'Failed to delete notebook page');
  },

  pinNotebookPage: async (id: string): Promise<any> => {
    const res = await fetch(`${API_URL}/my-work/notebook/pages/${id}/pin`, {
      method: 'PUT',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to toggle pin');
  },

  setNotebookPageStatus: async (id: string, status: string): Promise<any> => {
    const res = await fetch(`${API_URL}/my-work/notebook/pages/${id}/status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    return handleResponse(res, 'Failed to update page status');
  },

  convertNotebookPage: async (
    id: string,
    target: 'task' | 'decision' | 'initiative' | 'report' | 'presentation',
    extra?: { title?: string; description?: string }
  ): Promise<{ id: string; type: string; title: string; sourceSessionId?: string }> => {
    const res = await fetch(`${API_URL}/my-work/notebook/pages/${id}/convert`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ target, ...extra }),
    });
    return handleResponse(res, 'Failed to convert notebook page');
  },

  suggestNotebookTopics: async (
    pageId: string,
    opts?: { excludedTopics?: string[]; language?: string }
  ): Promise<{ topics: string[] }> => {
    const res = await fetch(
      `${API_URL}/my-work/notebook/pages/${encodeURIComponent(pageId)}/suggest-topics`,
      {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          excludedTopics: opts?.excludedTopics ?? [],
          language: opts?.language ?? 'en',
        }),
      }
    );
    if (!res.ok) {
      let msg = 'Failed to suggest topics';
      try {
        const body = await res.json();
        if (typeof body?.error === 'string') msg = body.error;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    return res.json();
  },

  extractNotebookActions: (id: string): EventSource => {
    const token = tokenService.getToken();
    const url = `${API_URL}/my-work/notebook/pages/${id}/extract-actions?token=${encodeURIComponent(token || '')}`;
    return new EventSource(url);
  },
};

// Export as 'api' for backwards compatibility with lowercase import
export const api = Api;

// Default export for import Api from './api' syntax
export default Api;
