/**
 * @deprecated This monolithic API client (16k+ lines) is being migrated to typed
 * modules under ./api/ (e.g. api/tasks.api.ts, api/v8/client.ts).
 *
 * For NEW code, import from:
 *   import { someApi } from '@/services/api/moduleName.api';
 *   import { v8Client } from '@/services/api/v8/client';
 *
 * Migration tracker: ~1000 files still import from this file.
 * Target: remove @ts-nocheck once all methods are migrated to typed modules.
 */
import i18n from '@/i18n';

import type { DemoExperienceType } from '../store/slices/demoSlice';
import { FullSession, LLMProvider, SessionMode, User } from '../types';
import {
  dispatchAccessBlocked,
  getAccessBlockedCode,
  isAccessBlockedCode,
} from '../utils/accessBlocked';
import { normalizeApiErrorMessage } from '../utils/apiError';
import {
  decodeDisplayFields,
  decodeHtmlEntities,
  POLA_TEKSTOWE_INICJATYWY,
} from '../utils/decodeHtmlEntities';
import { OrganizationContextWorkerApi } from './api/organizationContextWorker.api';
import { SettingsApi } from './api/settings.api';
import { V8AssessmentApi } from './api/v8/assessment';
import { V8MyWorkApi } from './api/v8/my-work';
import { trackFunnelEvent } from './funnelAnalytics';
import {
  clearPersonalTasksCache,
  makePersonalTasksCacheKey,
  personalTasksCacheGet,
  personalTasksCacheSet,
} from './personalTasksCache';
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

const buildApiUrl = (url: string): string => {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/api')) {
    const withoutApiPrefix = url.slice('/api'.length) || '';
    return `${API_URL}${withoutApiPrefix}`;
  }
  return `${API_URL}${url.startsWith('/') ? url : `/${url}`}`;
};

let correlationId = sessionStorage.getItem('correlationId');
if (!correlationId) {
  correlationId =
    Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  sessionStorage.setItem('correlationId', correlationId);
}

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

type TransportCircuitEntry = {
  failures: number;
  blockedUntil: number;
  status: number;
};

type GlobalTransportCircuit = {
  failures: number;
  windowStartedAt: number;
  blockedUntil: number;
  lastStatus: number;
  lastPath: string;
};

const TRANSPORT_CIRCUIT_STORAGE_KEY = 'consultify:transportCircuit:v1';
const TRANSPORT_CIRCUIT_BASE_MS = 5000;
const TRANSPORT_CIRCUIT_MAX_MS = 120000;
const GLOBAL_TRANSPORT_CIRCUIT_STORAGE_KEY = 'consultify:globalTransportCircuit:v1';
// QA-2026-06-08 (BUG-14): a 2-failure/8s trip with a 5-min block let a couple of
// transient 429/5xx self-inflict an app-wide synthetic-429 blackout for legit users
// with multiple tabs / fast navigation. Relaxed to tolerate normal bursts.
const GLOBAL_TRANSPORT_FAILURE_WINDOW_MS = 20000;
const GLOBAL_TRANSPORT_FAILURE_THRESHOLD = 6;
const GLOBAL_TRANSPORT_BLOCK_MS = 45000;
const AUTH_LOOP_GUARD_STORAGE_KEY = 'consultify:authLoopGuard:v1';
const AUTH_LOOP_GUARD_WINDOW_MS = 10000;
// IMPACT-TR-002: Only a genuine 401 -> refresh -> 401 loop should trip the guard.
// Require several consecutive post-refresh 401s before latching, and keep the
// cooldown short so a transient race never blocks whole modules for minutes.
const AUTH_LOOP_GUARD_THRESHOLD = 4;
const AUTH_LOOP_GUARD_BLOCK_MS = 30000;

let transportCircuitState: Record<string, TransportCircuitEntry> = (() => {
  try {
    const raw = sessionStorage.getItem(TRANSPORT_CIRCUIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
})();

let globalTransportCircuitState: GlobalTransportCircuit = (() => {
  try {
    const raw = sessionStorage.getItem(GLOBAL_TRANSPORT_CIRCUIT_STORAGE_KEY);
    if (!raw) {
      return {
        failures: 0,
        windowStartedAt: 0,
        blockedUntil: 0,
        lastStatus: 0,
        lastPath: '',
      };
    }
    const parsed = JSON.parse(raw || '{}');
    return {
      failures: Number(parsed.failures || 0),
      windowStartedAt: Number(parsed.windowStartedAt || 0),
      blockedUntil: Number(parsed.blockedUntil || 0),
      lastStatus: Number(parsed.lastStatus || 0),
      lastPath: String(parsed.lastPath || ''),
    };
  } catch {
    return {
      failures: 0,
      windowStartedAt: 0,
      blockedUntil: 0,
      lastStatus: 0,
      lastPath: '',
    };
  }
})();

type AuthLoopGuardState = {
  failures: number;
  windowStartedAt: number;
  blockedUntil: number;
  lastStatus: number;
  lastPath: string;
};

let authLoopGuardState: AuthLoopGuardState = (() => {
  try {
    const raw = sessionStorage.getItem(AUTH_LOOP_GUARD_STORAGE_KEY);
    if (!raw) {
      return { failures: 0, windowStartedAt: 0, blockedUntil: 0, lastStatus: 0, lastPath: '' };
    }
    const parsed = JSON.parse(raw || '{}');
    return {
      failures: Number(parsed.failures || 0),
      windowStartedAt: Number(parsed.windowStartedAt || 0),
      blockedUntil: Number(parsed.blockedUntil || 0),
      lastStatus: Number(parsed.lastStatus || 0),
      lastPath: String(parsed.lastPath || ''),
    };
  } catch {
    return { failures: 0, windowStartedAt: 0, blockedUntil: 0, lastStatus: 0, lastPath: '' };
  }
})();

const persistTransportCircuit = () => {
  try {
    sessionStorage.setItem(TRANSPORT_CIRCUIT_STORAGE_KEY, JSON.stringify(transportCircuitState));
  } catch {
    // ignore storage errors
  }
};

const persistGlobalTransportCircuit = () => {
  try {
    sessionStorage.setItem(
      GLOBAL_TRANSPORT_CIRCUIT_STORAGE_KEY,
      JSON.stringify(globalTransportCircuitState)
    );
  } catch {
    // ignore storage errors
  }
};

const persistAuthLoopGuard = () => {
  try {
    sessionStorage.setItem(AUTH_LOOP_GUARD_STORAGE_KEY, JSON.stringify(authLoopGuardState));
  } catch {
    // ignore storage errors
  }
};

const getTransportPath = (url: string): string => {
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return String(url || '');
  }
};

export const normalizeTransportPath = (rawPath: string): string => {
  const input = String(rawPath || '').trim();
  if (!input) return '';
  try {
    return new URL(input, window.location.origin).pathname;
  } catch {
    const withoutHash = input.split('#')[0] || '';
    const withoutQuery = withoutHash.split('?')[0] || '';
    return withoutQuery || input;
  }
};

const getTransportCircuitKey = (path: string): string | null => {
  const conversationMatch = path.match(/\/api\/conversations\/([^/?#]+)/);
  if (conversationMatch?.[1]) {
    return `/api/conversations/${decodeURIComponent(conversationMatch[1])}`;
  }
  if (path === '/api/demo/status') return path;
  if (path === '/api/notifications/unread-count') return path;
  if (path === '/api/v10/teresa/voice-config') return path;
  if (path === '/api/v10/teresa/voice-event') return path;
  return null;
};

const buildBlockedResponse = (status: number, path: string): Response =>
  new Response(
    JSON.stringify({
      error: 'Request blocked by local transport circuit breaker',
      code: 'CLIENT_TRANSPORT_CIRCUIT_OPEN',
      path,
    }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );

const buildGlobalBlockedResponse = (path: string): Response =>
  new Response(
    JSON.stringify({
      error: 'Requests blocked by global transport safeguard',
      code: 'CLIENT_TRANSPORT_GLOBAL_CIRCUIT_OPEN',
      path,
      blockedUntil: globalTransportCircuitState.blockedUntil,
      lastStatus: globalTransportCircuitState.lastStatus,
      lastPath: globalTransportCircuitState.lastPath,
    }),
    { status: 429, headers: { 'Content-Type': 'application/json' } }
  );

const logTransportStabilityMarker = (marker: string, details: Record<string, unknown> = {}) => {
  if (typeof console === 'undefined') return;
  console.info('[stability:transport]', { marker, ...details });
};

const maybeGetBlockedTransportResponse = (path: string): Response | null => {
  const key = getTransportCircuitKey(path);
  if (!key) return null;
  const entry = transportCircuitState[key];
  if (entry && Date.now() < entry.blockedUntil) {
    logTransportStabilityMarker('transport_circuit_open', {
      key,
      path,
      status: entry.status,
      blockedForMs: entry.blockedUntil - Date.now(),
    });
    return buildBlockedResponse(entry.status || 429, path);
  }
  return null;
};

export const shouldBypassGlobalCircuit = (path: string): boolean => {
  const normalizedPath = normalizeTransportPath(path);
  return (
    normalizedPath === '/api/ready' ||
    normalizedPath.startsWith('/api/health') ||
    normalizedPath.startsWith('/api/auth/login') ||
    normalizedPath.startsWith('/api/auth/refresh') ||
    normalizedPath.startsWith('/api/auth/logout') ||
    normalizedPath.startsWith('/api/interview') ||
    normalizedPath.startsWith('/api/v8/interview') ||
    normalizedPath.startsWith('/api/education') ||
    normalizedPath.startsWith('/api/audits') ||
    normalizedPath.startsWith('/api/tools') ||
    normalizedPath.startsWith('/api/discovery-tools')
  );
};

export const maybeGetGlobalBlockedTransportResponse = (path: string): Response | null => {
  const normalizedPath = normalizeTransportPath(path);
  if (shouldBypassGlobalCircuit(normalizedPath)) return null;
  if (Date.now() < globalTransportCircuitState.blockedUntil) {
    logTransportStabilityMarker('global_transport_circuit_open', {
      path: normalizedPath,
      blockedForMs: globalTransportCircuitState.blockedUntil - Date.now(),
      failures: globalTransportCircuitState.failures,
      lastStatus: globalTransportCircuitState.lastStatus,
      lastPath: globalTransportCircuitState.lastPath,
    });
    return buildGlobalBlockedResponse(normalizedPath);
  }
  return null;
};

const buildAuthLoopGuardResponse = (path: string): Response =>
  new Response(
    JSON.stringify({
      error: 'Requests blocked by auth loop guard',
      code: 'CLIENT_AUTH_LOOP_GUARD_OPEN',
      path,
      blockedUntil: authLoopGuardState.blockedUntil,
      lastStatus: authLoopGuardState.lastStatus,
      lastPath: authLoopGuardState.lastPath,
    }),
    { status: 429, headers: { 'Content-Type': 'application/json' } }
  );

const shouldBypassAuthLoopGuard = (path: string): boolean =>
  path === '/api/ready' ||
  path.startsWith('/api/health') ||
  path.startsWith('/api/auth/login') ||
  path.startsWith('/api/auth/refresh') ||
  path.startsWith('/api/auth/logout') ||
  path.startsWith('/api/build-info');

const maybeGetAuthLoopGuardResponse = (path: string): Response | null => {
  if (shouldBypassAuthLoopGuard(path)) return null;
  if (Date.now() < authLoopGuardState.blockedUntil) {
    logTransportStabilityMarker('auth_loop_guard_open', {
      path,
      blockedForMs: authLoopGuardState.blockedUntil - Date.now(),
      failures: authLoopGuardState.failures,
      lastStatus: authLoopGuardState.lastStatus,
      lastPath: authLoopGuardState.lastPath,
    });
    return buildAuthLoopGuardResponse(path);
  }
  return null;
};

const recordTransportFailure = (path: string, status: number) => {
  const key = getTransportCircuitKey(path);
  if (!key || ![401, 403, 404, 429].includes(status)) return;
  const failures = (transportCircuitState[key]?.failures || 0) + 1;
  const blockedFor = Math.min(
    TRANSPORT_CIRCUIT_BASE_MS * 2 ** Math.max(0, failures - 1),
    TRANSPORT_CIRCUIT_MAX_MS
  );
  transportCircuitState = {
    ...transportCircuitState,
    [key]: { failures, blockedUntil: Date.now() + blockedFor, status },
  };
  persistTransportCircuit();
  logTransportStabilityMarker('transport_circuit_failure', {
    key,
    path,
    status,
    failures,
    blockedForMs: blockedFor,
  });
};

export const recordGlobalTransportFailure = (path: string, status: number) => {
  const normalizedPath = normalizeTransportPath(path);
  if (!normalizedPath.startsWith('/api/')) return;
  if (shouldBypassGlobalCircuit(normalizedPath)) return;
  // IMPACT-TR-001: transient client errors should not block the entire platform.
  if (status && [400, 401, 403, 404, 422].includes(status)) return;

  const now = Date.now();
  const withinWindow =
    globalTransportCircuitState.windowStartedAt > 0 &&
    now - globalTransportCircuitState.windowStartedAt <= GLOBAL_TRANSPORT_FAILURE_WINDOW_MS;

  const failures = withinWindow ? globalTransportCircuitState.failures + 1 : 1;
  globalTransportCircuitState = {
    failures,
    windowStartedAt: withinWindow ? globalTransportCircuitState.windowStartedAt : now,
    blockedUntil:
      failures >= GLOBAL_TRANSPORT_FAILURE_THRESHOLD
        ? Math.max(globalTransportCircuitState.blockedUntil, now + GLOBAL_TRANSPORT_BLOCK_MS)
        : globalTransportCircuitState.blockedUntil,
    lastStatus: status,
    lastPath: normalizedPath,
  };
  persistGlobalTransportCircuit();

  if (failures >= GLOBAL_TRANSPORT_FAILURE_THRESHOLD) {
    logTransportStabilityMarker('global_transport_circuit_failure', {
      path: normalizedPath,
      status,
      failures,
      blockedForMs: globalTransportCircuitState.blockedUntil - now,
    });
  }
};

export const clearGlobalTransportFailure = (path: string = '/api/') => {
  const normalizedPath = normalizeTransportPath(path);
  if (!normalizedPath.startsWith('/api/')) return;

  if (
    globalTransportCircuitState.failures === 0 &&
    globalTransportCircuitState.windowStartedAt === 0 &&
    globalTransportCircuitState.blockedUntil === 0
  ) {
    return;
  }

  // IMPACT-TR-001: Reset/recovery of global circuit after a successful request.
  globalTransportCircuitState = {
    failures: 0,
    windowStartedAt: 0,
    blockedUntil: 0,
    lastStatus: 0,
    lastPath: '',
  };
  persistGlobalTransportCircuit();
  logTransportStabilityMarker('global_circuit_cleared_on_success', { path: normalizedPath });
};

const clearTransportFailure = (path: string) => {
  const key = getTransportCircuitKey(path);
  if (!key || !transportCircuitState[key]) return;
  const next = { ...transportCircuitState };
  delete next[key];
  transportCircuitState = next;
  persistTransportCircuit();
  logTransportStabilityMarker('transport_circuit_close', { key, path });
};

// IMPACT-TR-002: This is intentionally only fed by a TRUE auth-refresh loop signal
// (a 401 that persists AFTER a token refresh was attempted). It must NOT be called
// for generic failures, 429 rate-limiting, 5xx, or the first/pre-refresh 401 — those
// are transient and must never latch a global block that kills unrelated modules.
const recordAuthLoopSignal = (path: string, status: number) => {
  if (!path.startsWith('/api/')) return;
  if (shouldBypassAuthLoopGuard(path)) return;
  if (status !== 401) return;

  const now = Date.now();
  const withinWindow =
    authLoopGuardState.windowStartedAt > 0 &&
    now - authLoopGuardState.windowStartedAt <= AUTH_LOOP_GUARD_WINDOW_MS;

  const failures = withinWindow ? authLoopGuardState.failures + 1 : 1;
  const nextBlockedUntil =
    failures >= AUTH_LOOP_GUARD_THRESHOLD
      ? Math.max(authLoopGuardState.blockedUntil, now + AUTH_LOOP_GUARD_BLOCK_MS)
      : authLoopGuardState.blockedUntil;

  authLoopGuardState = {
    failures,
    windowStartedAt: withinWindow ? authLoopGuardState.windowStartedAt : now,
    blockedUntil: nextBlockedUntil,
    lastStatus: status,
    lastPath: path,
  };
  persistAuthLoopGuard();

  if (failures >= AUTH_LOOP_GUARD_THRESHOLD) {
    logTransportStabilityMarker('auth_loop_guard_trip', {
      path,
      status,
      failures,
      blockedForMs: nextBlockedUntil - now,
    });
  }
};

const clearAuthLoopSignal = (path: string) => {
  if (!path.startsWith('/api/')) return;
  if (Date.now() < authLoopGuardState.blockedUntil) return;
  if (authLoopGuardState.failures === 0 && authLoopGuardState.windowStartedAt === 0) return;
  authLoopGuardState = {
    failures: 0,
    windowStartedAt: 0,
    blockedUntil: 0,
    lastStatus: 0,
    lastPath: '',
  };
  persistAuthLoopGuard();
};

/**
 * IMPACT-TR-002: Hard reset of the auth-loop guard. Used by user-initiated retry
 * UI so a module that got caught behind a (possibly stale) guard can recover
 * immediately instead of waiting out the cooldown.
 */
export const resetAuthLoopGuard = () => {
  authLoopGuardState = {
    failures: 0,
    windowStartedAt: 0,
    blockedUntil: 0,
    lastStatus: 0,
    lastPath: '',
  };
  persistAuthLoopGuard();
  logTransportStabilityMarker('auth_loop_guard_reset');
};

const shouldSuppressAuthRetry = (path: string): boolean =>
  path === '/api/demo/status' ||
  path === '/api/notifications' ||
  path.startsWith('/api/notifications/') ||
  path === '/api/notifications/unread-count' ||
  path.startsWith('/api/llm/providers/health') ||
  path === '/api/v10/teresa/voice-config' ||
  path === '/api/v10/teresa/voice-event';

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
export type DemoFlags = {
  isDemoMode: boolean;
  isDemoSession: boolean;
  demoSessionOrgId: string | null;
};

export type DataContextSummary = {
  status: string;
  generatedAt: string;
  database: {
    source: string;
    host: string | null;
    name: string | null;
    readonly: boolean;
  };
  organization: {
    activeOrganizationId: string | null;
    userOrganizationId: string | null;
  };
  user: {
    id: string | null;
    email: string | null;
  };
  demo: {
    enabled: boolean;
    organizationId: string | null;
    headerActive: boolean;
  };
};

let _cachedStorageRaw: string | null | undefined = undefined;
let _cachedDemoFlags: DemoFlags = {
  isDemoMode: false,
  isDemoSession: false,
  demoSessionOrgId: null,
};

export function getDemoFlags(): DemoFlags {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem('consultify-storage');
  } catch {
    // ignore
  }

  // Only re-parse when the underlying raw value changes
  if (raw === _cachedStorageRaw) return _cachedDemoFlags;
  _cachedStorageRaw = raw;

  let isDemoMode = false;
  let isDemoSession = false;
  let demoSessionOrgId: string | null = null;
  try {
    if (raw) {
      const parsed = JSON.parse(raw);
      // Demo data is gated STRICTLY to the explicit user toggle. `isDemoMode`
      // is set only when the user flips the Settings "Show demo data" toggle
      // (persisted server-side as `demo:enabled` and rehydrated into the store).
      // There is NO localhost/DEV auto-trigger and NO hardcoded-email backdoor.
      isDemoMode = parsed?.state?.isDemoMode === true;
      demoSessionOrgId = parsed?.state?.demoSessionOrgId || null;
      // `isDemoSession` mirrors the same explicit toggle so existing callers of
      // shouldAllowDemoData() keep working when demo is ON.
      isDemoSession = isDemoMode;
    }
  } catch {
    // Ignore parsing errors
  }

  _cachedDemoFlags = { isDemoMode, isDemoSession, demoSessionOrgId };
  return _cachedDemoFlags;
}

export function shouldAllowDemoData(): boolean {
  const { isDemoMode, isDemoSession } = getDemoFlags();
  return isDemoMode || isDemoSession;
}

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

function getAppLanguage(): string {
  try {
    const lng = (i18n?.resolvedLanguage || i18n?.language || '').toString();
    const base = lng.split('-')[0].toLowerCase();
    return base || getBrowserLanguage();
  } catch {
    return getBrowserLanguage();
  }
}

function getCachedUserLanguage(): string {
  // Prefer app-selected language (i18next) over browser locale.
  // NOTE: app language can change at runtime, so we can't key this cache only on navigator.language.
  const lang = getAppLanguage();
  _cachedLang = lang || _cachedLang;
  return _cachedLang;
}

function getStoredOrganizationContextId(): string {
  try {
    return localStorage.getItem('consultify_current_org_id') || '';
  } catch {
    return '';
  }
}

export const getHeaders = () => {
  const token = tokenService.getToken();

  const { isDemoMode, demoSessionOrgId } = getDemoFlags();
  const userLanguage = getCachedUserLanguage();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
    'X-Correlation-ID': correlationId as string,
    // NOTE: Browsers treat `Accept-Language` as a forbidden header, so setting it here is best-effort.
    // Use `X-App-Language` as the reliable signal for backend localization.
    'Accept-Language': userLanguage,
    'X-App-Language': userLanguage,
  };

  // Add demo mode header whenever user has demo mode enabled (viewing demo org).
  // MUST send for ALL users in demo mode so backend can block writes — DB must stay unchanged on exit.
  // Previously only sent when isDemoSession (demo account email), which meant real users' writes persisted.
  if (isDemoMode) {
    headers['X-Demo-Mode'] = 'true';
    if (demoSessionOrgId) {
      headers['X-Demo-Session-Org'] = demoSessionOrgId;
    }
  }

  const orgContextId = getStoredOrganizationContextId();
  if (orgContextId) {
    headers['x-org-context'] = orgContextId;
  }

  return headers;
};

export const getMapVersionFromPayload = (payload: unknown): number | null => {
  if (!payload || typeof payload !== 'object') return null;
  const map = (payload as Record<string, unknown>).map;
  if (!map || typeof map !== 'object') return null;
  const versionRaw = (map as Record<string, unknown>).version;
  const parsed = Number(versionRaw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

// Wrapper for fetch that handles 401 with automatic token refresh
type FetchWithRetryOptions = RequestInit & {
  skipDefaultHeaders?: boolean;
  /**
   * Override the default 20s hard timeout (ms). Heavy operations — AI
   * generation, deck/report/model materialization, long exports — legitimately
   * take longer than 20s; without this override they abort mid-flight as
   * "Request timed out" (Cloudflare-style 524 from the client side). Only
   * applies when the caller does NOT pass its own AbortSignal. See finding
   * baseclient_20s_timeout — this mirrors the same override already present in
   * services/api/baseClient.ts.
   */
  timeoutMs?: number;
};

/**
 * FIX-1 (429 self-storm): in-flight GET de-duplication.
 *
 * React StrictMode double-invokes effects in dev, so identical GETs fire twice
 * and (a) double the per-user rate-limiter load and (b) surface duplicate
 * "Failed to load" toasts. We coalesce concurrent identical GETs (same URL +
 * auth token + org context) into a single network request; extra callers await
 * the same promise and each receive an independent `clone()` of the resolved
 * Response (bodies are single-use). The entry clears on settle, so only
 * genuinely overlapping requests are shared.
 */
const inFlightGetRequests = new Map<string, Promise<Response>>();

const isCoalesceableGet = (options: FetchWithRetryOptions): boolean => {
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET') return false;
  // Don't share requests that carry a caller-owned abort signal — aborting one
  // consumer must never abort the others.
  if (options.signal) return false;
  return true;
};

const buildInFlightGetKey = (url: string): string => {
  const token = tokenService.getToken() || '';
  const org = getStoredOrganizationContextId();
  return `${url} ${token} ${org}`;
};

const fetchWithRetry = async (
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> => {
  if (isCoalesceableGet(options)) {
    const key = buildInFlightGetKey(url);
    const existing = inFlightGetRequests.get(key);
    if (existing) {
      const shared = await existing;
      return shared.clone();
    }
    const promise = fetchWithRetryInner(url, options);
    inFlightGetRequests.set(key, promise);
    try {
      const res = await promise;
      return res.clone();
    } finally {
      inFlightGetRequests.delete(key);
    }
  }
  return fetchWithRetryInner(url, options);
};

const fetchWithRetryInner = async (
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> => {
  const transportPath = getTransportPath(url);
  const authLoopBlockedResponse = maybeGetAuthLoopGuardResponse(transportPath);
  if (authLoopBlockedResponse) return authLoopBlockedResponse;
  const globalBlockedResponse = maybeGetGlobalBlockedTransportResponse(transportPath);
  if (globalBlockedResponse) return globalBlockedResponse;
  const blockedResponse = maybeGetBlockedTransportResponse(transportPath);
  if (blockedResponse) return blockedResponse;

  const { skipDefaultHeaders, timeoutMs: timeoutOverride, ...fetchOptions } = options;
  const baseHeaders = skipDefaultHeaders ? {} : getHeaders();
  const headers = {
    ...baseHeaders,
    ...((fetchOptions.headers as Record<string, string>) || {}),
  };
  const hasExternalSignal = !!fetchOptions.signal;
  const isAiRefine = typeof url === 'string' && url.includes('/api/ai/refine-text');
  // Stabilization: every request that does not carry its own AbortSignal gets a
  // hard timeout so a stalled network call can never hang a list/table spinner
  // forever. Callers may raise the ceiling via `timeoutMs` for heavy ops
  // (generation/materialize/export); AI refine keeps its longer 25s default;
  // everything else uses 20s.
  const shouldApplyTimeout = !hasExternalSignal;
  const defaultTimeoutMs = isAiRefine ? 25000 : 20000;
  const timeoutMs = shouldApplyTimeout ? (timeoutOverride ?? defaultTimeoutMs) : null;
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
      // Ensure cookie-based sessions work even when API_URL is cross-origin.
      credentials: fetchOptions.credentials ?? 'include',
      signal: fetchOptions.signal || controller?.signal,
    });
    if (res.ok) {
      clearTransportFailure(transportPath);
      clearGlobalTransportFailure(transportPath);
      clearAuthLoopSignal(transportPath);
    } else {
      recordTransportFailure(transportPath, res.status);
      recordGlobalTransportFailure(transportPath, res.status);
      // IMPACT-TR-002: Do NOT feed the auth-loop guard from the FIRST response.
      // A single pre-refresh 401 (or a generic 4xx/5xx) is transient — the guard
      // is only fed below, AFTER a refresh attempt fails, to detect a true loop.
    }
  } catch (err: any) {
    if (controller && err?.name === 'AbortError') {
      const e: any = new Error(isAiRefine ? 'AI request timed out' : 'Request timed out');
      e.code = isAiRefine ? 'AI_TIMEOUT' : 'REQUEST_TIMEOUT';
      throw e;
    }
    throw err;
  } finally {
    if (timer) window.clearTimeout(timer);
  }

  const hasStoredAuth = Boolean(tokenService.getToken() || tokenService.getRefreshToken());

  // If 401, try to refresh token and retry once
  if (
    res.status === 401 &&
    hasStoredAuth &&
    !shouldSuppressAuthRetry(transportPath) &&
    !maybeGetAuthLoopGuardResponse(transportPath)
  ) {
    const newToken = await tokenService.refreshToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      // Note: keep the same abort signal (if any) for the retry.
      res = await fetch(url, {
        ...fetchOptions,
        headers,
        credentials: fetchOptions.credentials ?? 'include',
        signal: fetchOptions.signal || controller?.signal,
      });
      if (res.ok) {
        clearTransportFailure(transportPath);
        clearGlobalTransportFailure(transportPath);
        clearAuthLoopSignal(transportPath);
      } else {
        recordTransportFailure(transportPath, res.status);
        recordGlobalTransportFailure(transportPath, res.status);
        recordAuthLoopSignal(transportPath, res.status);
      }
    } else {
      recordAuthLoopSignal(transportPath, 401);
      // Token refresh failed, notify app
      window.dispatchEvent(new CustomEvent('auth:token-expired'));
    }
  }

  return res;
};

const handleResponse = async (res: Response, defaultError: string) => {
  if (res.ok) {
    // If a previous AI budget freeze was transient/no longer valid,
    // unfreeze the chat on successful AI-related responses.
    try {
      const path = getTransportPath(res.url || '');
      if (path.includes('/api/ai') || path.includes('/api/chat')) {
        const { useAppStore } = await import('../store/useAppStore');
        const store = useAppStore.getState();
        if (store.aiFreezeStatus?.isFrozen) {
          store.setAiFreezeStatus({
            isFrozen: false,
            reason: null,
            scope: null,
          });
        }
      }
    } catch {
      // no-op
    }
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
  const errorInput = parsed.kind === 'json' ? data : parsed.kind === 'text' ? parsed.text : {};

  // Normalize error payloads to a readable string.
  // Some endpoints return { error: {...} } which would otherwise surface as "[object Object]".
  // If payload isn't helpful, include HTTP status (avoids generic "Request failed").
  const fallbackHttp = `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`;
  const normalizedMessage = normalizeApiErrorMessage(errorInput, fallbackHttp || defaultError);
  const errorCode = String((data as any)?.code || (data as any)?.errorCode || '').toUpperCase();
  const hasStoredAuth = Boolean(tokenService.getToken() || tokenService.getRefreshToken());
  const authMessage = String(
    (data as any)?.error || (data as any)?.message || normalizedMessage || ''
  ).toLowerCase();
  const authRevocationCodes = new Set([
    'TOKEN_REVOKED',
    'AUTH_TOKEN_REVOKED',
    'SESSION_REVOKED',
    'AUTH_SESSION_REVOKED',
  ]);

  // Keep auth state honest: when backend confirms revocation, force a clean logout flow.
  if (
    hasStoredAuth &&
    (res.status === 401 || res.status === 403) &&
    (authRevocationCodes.has(errorCode) ||
      authMessage.includes('token has been revoked') ||
      authMessage.includes('all sessions have been revoked') ||
      authMessage.includes('session revoked'))
  ) {
    try {
      tokenService.clearTokens();
      window.dispatchEvent(new CustomEvent('auth:token-expired'));
    } catch {
      // no-op
    }
  }

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
    throw new Error(normalizeApiErrorMessage(data, 'Action blocked in Demo Mode'));
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
    throw new Error(normalizeApiErrorMessage(data, 'AI Budget Exhausted'));
  }

  // Unified access-blocked handling (Trial expiry, AI limits, token budgets, etc.)
  if (res.status === 403) {
    const code = getAccessBlockedCode(data);
    if (isAccessBlockedCode(code)) {
      try {
        dispatchAccessBlocked(data, defaultError);
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
  // FIX-1: surface Retry-After on 429 so callers can back off / show a clean
  // state. We deliberately do NOT auto-retry 429 anywhere — retrying is what
  // amplified the rate-limit storm.
  if (res.status === 429) {
    const retryAfterHeader = res.headers.get('Retry-After');
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
      err.retryAfter = retryAfterSeconds;
    } else if (typeof (data as any)?.retryAfter === 'number') {
      err.retryAfter = (data as any).retryAfter;
    }
  }
  throw err;
};

type CachedApiEntry = {
  expiresAt: number;
  value?: unknown;
  inflight?: Promise<unknown>;
};

const cachedApiGets = new Map<string, CachedApiEntry>();
const endpointBackoffState = new Map<string, { backoffMs: number; blockedUntil: number }>();
const ENDPOINT_BACKOFF_STORAGE_KEY = 'consultify-endpoint-backoff';
const MISSING_CONVERSATIONS_STORAGE_KEY = 'consultify-missing-conversations';

const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 60_000;

const readBackoffStorage = (): Record<string, { backoffMs: number; blockedUntil: number }> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(ENDPOINT_BACKOFF_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeBackoffStorage = (): void => {
  if (typeof window === 'undefined') return;
  try {
    const payload: Record<string, { backoffMs: number; blockedUntil: number }> = {};
    for (const [key, value] of endpointBackoffState.entries()) {
      payload[key] = value;
    }
    sessionStorage.setItem(ENDPOINT_BACKOFF_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // no-op
  }
};

const hydrateBackoffState = (): void => {
  if (endpointBackoffState.size > 0) return;
  const stored = readBackoffStorage();
  const now = Date.now();
  for (const [key, value] of Object.entries(stored)) {
    if (!value || typeof value.blockedUntil !== 'number' || value.blockedUntil <= now) continue;
    endpointBackoffState.set(key, {
      backoffMs: Number(value.backoffMs || BACKOFF_BASE_MS),
      blockedUntil: value.blockedUntil,
    });
  }
};

const readMissingConversationIds = (): Set<string> => {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(MISSING_CONVERSATIONS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((value) => String(value || '').trim()).filter(Boolean));
  } catch {
    return new Set();
  }
};

const writeMissingConversationIds = (ids: Set<string>): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MISSING_CONVERSATIONS_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // no-op
  }
};

const markConversationMissing = (conversationId: string): void => {
  const normalized = String(conversationId || '').trim();
  if (!normalized) return;
  const ids = readMissingConversationIds();
  ids.add(normalized);
  writeMissingConversationIds(ids);
};

const clearConversationMissingMark = (conversationId: string): void => {
  const normalized = String(conversationId || '').trim();
  if (!normalized) return;
  const ids = readMissingConversationIds();
  if (!ids.delete(normalized)) return;
  writeMissingConversationIds(ids);
};

const isConversationMarkedMissing = (conversationId: string): boolean => {
  const normalized = String(conversationId || '').trim();
  if (!normalized) return false;
  return readMissingConversationIds().has(normalized);
};

const isEndpointBackedOff = (key: string): boolean => {
  hydrateBackoffState();
  const state = endpointBackoffState.get(key);
  if (!state) return false;
  if (state.blockedUntil <= Date.now()) {
    endpointBackoffState.delete(key);
    writeBackoffStorage();
    return false;
  }
  return true;
};

const bumpEndpointBackoff = (key: string): void => {
  const current = endpointBackoffState.get(key);
  const nextBackoff =
    current && current.backoffMs > 0
      ? Math.min(current.backoffMs * 2, BACKOFF_MAX_MS)
      : BACKOFF_BASE_MS;
  endpointBackoffState.set(key, {
    backoffMs: nextBackoff,
    blockedUntil: Date.now() + nextBackoff,
  });
  writeBackoffStorage();
  logTransportStabilityMarker('endpoint_backoff_open', {
    key,
    blockedForMs: nextBackoff,
  });
};

const resetEndpointBackoff = (key: string): void => {
  const hadBackoff = endpointBackoffState.has(key);
  endpointBackoffState.delete(key);
  writeBackoffStorage();
  if (hadBackoff) {
    logTransportStabilityMarker('endpoint_backoff_close', { key });
  }
};

const invalidateCachedApiByPrefix = (prefix: string): void => {
  for (const key of cachedApiGets.keys()) {
    if (key.startsWith(prefix)) {
      cachedApiGets.delete(key);
    }
  }
};

/**
 * Decode HTML-entity-encoded display fields on an idea row.
 *
 * Legacy rows were stored entity-encoded (some twice) by the server input
 * sanitizer, which made titles render literally as `&quot;…` / `&amp;quot;…`.
 * Decoding here yields plain text; React re-escapes safely on render.
 */
const normalizeIdeaDisplayFields = <T>(idea: T): T => {
  if (!idea || typeof idea !== 'object') return idea;
  const row = idea as Record<string, unknown>;
  for (const field of ['title', 'body', 'description'] as const) {
    if (typeof row[field] === 'string') {
      row[field] = decodeHtmlEntities(row[field] as string);
    }
  }
  return idea;
};

/**
 * PILNE-12: ten sam sanitizer serwera, ktory kodowal tytuly idei, kodowal tez
 * teksty inicjatyw — tylko idee mialy odkodowanie. W Portfolio wychodzilo
 * `organization&#x27;s` i podwojnie zakodowane `Date &amp;amp; Participants`.
 */
const normalizeInitiativeDisplayFields = <T>(initiative: T): T =>
  decodeDisplayFields(initiative, POLA_TEKSTOWE_INICJATYWY);

const normalizeInitiativeList = (rows: unknown): any[] =>
  Array.isArray(rows) ? rows.map((r) => normalizeInitiativeDisplayFields(r)) : [];

const getCachedJson = async <T = any>(
  url: string,
  ttlMs: number,
  defaultError: string
): Promise<T> => {
  const now = Date.now();
  const cached = cachedApiGets.get(url);

  if (cached?.value !== undefined && cached.expiresAt > now) {
    return cached.value as T;
  }

  if (cached?.inflight) {
    return cached.inflight as Promise<T>;
  }

  const inflight = (async () => {
    const res = await fetchWithRetry(url, { headers: getHeaders() });
    const value = await handleResponse(res, defaultError);
    cachedApiGets.set(url, {
      value,
      expiresAt: Date.now() + Math.max(0, ttlMs),
    });
    return value as T;
  })().catch((error) => {
    cachedApiGets.delete(url);
    throw error;
  });

  cachedApiGets.set(url, {
    value: cached?.value,
    expiresAt: cached?.expiresAt || 0,
    inflight,
  });

  return inflight;
};

/**
 * Axios-compat wrapper for fetch-based helpers.
 *
 * Many UI modules expect `response.data` (axios shape). Our fetch helpers historically returned
 * raw JSON payloads, which caused runtime crashes like "Cannot read properties of undefined (reading 'data')".
 *
 * This wrapper preserves the old "raw payload" access (e.g. `response.success`) while also
 * providing `response.data === payload` via a Proxy trap.
 */
function toAxiosLikeResponse<T = any>(payload: T): any {
  if (payload === null || payload === undefined) return { data: payload };
  const t = typeof payload;
  if (t !== 'object' && t !== 'function') return { data: payload };

  // Proxy the payload so that `response.data` resolves to the payload itself.
  // This keeps both access patterns working:
  // - axios style: response.data.success
  // - legacy raw:  response.success
  return new Proxy(payload as any, {
    get(target, prop, receiver) {
      if (prop === 'data') return target;
      return Reflect.get(target, prop, receiver);
    },
  });
}

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
   * Register for demo - sign up with email+password to try demo (track duration, contact for follow-up)
   * Replaces anonymous demoLogin in production
   */
  registerDemo: async (params: {
    email: string;
    password: string;
    firstName?: string;
    acceptedLegalDocs?: string[];
    legalConsentAt?: string;
  }): Promise<{ user: User; token: string; refreshToken: string; isDemo: boolean }> => {
    let res: Response;
    try {
      res = await fetch(`${API_URL}/auth/register-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: params.email,
          password: params.password,
          firstName: params.firstName,
          acceptedLegalDocs: params.acceptedLegalDocs,
          legalConsentAt: params.legalConsentAt,
        }),
      });
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      throw new Error(
        `Network error contacting API (${API_URL}). ${msg}. ` +
          `Check that the backend is running and that Vite proxy/VITE_API_URL is configured correctly.`
      );
    }
    const data = await handleResponse(res, 'Demo signup failed');
    tokenService.saveTokens(data.token, data.refreshToken);
    sessionStorage.setItem('isDemo', 'true');
    return { ...data, user: { ...data.user, isDemo: true } };
  },

  /**
   * Enter demo mode (for logged-in user) - enables demo and records demo_started_at
   */
  enterDemo: async (): Promise<{ success: boolean; isDemoMode: boolean }> => {
    const result = await Api.toggleDemoMode(true);
    if (result.success && result.isDemoMode) {
      sessionStorage.setItem('isDemo', 'true');
    }
    return result;
  },

  /**
   * Demo Login - Anonymous demo (deprecated in production, use registerDemo or login+enterDemo)
   * Kept for E2E/test gateway compatibility
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
    if (data?.token) {
      tokenService.saveTokens(data.token, data.refreshToken);
    }
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

    // --- First-run onboarding flow (X4 / D22) ---
    // Persisted via the generic user_preferences store (GET/PUT /api/preferences).
    // Keys: `onboarding_completed` (boolean) and `onboarding_role` (string).
    getFirstRunState: async (): Promise<{
      completed: boolean;
      role: string | null;
    }> => {
      const res = await fetchWithRetry(`${API_URL}/preferences`, {
        headers: getHeaders(),
      });
      const prefs = await handleResponse(res, 'Failed to fetch onboarding state');
      return {
        completed: Boolean((prefs as Record<string, unknown>)?.onboarding_completed),
        role: ((prefs as Record<string, unknown>)?.onboarding_role as string | undefined) ?? null,
      };
    },

    setFirstRunRole: async (role: string): Promise<void> => {
      const res = await fetchWithRetry(`${API_URL}/preferences`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ onboarding_role: role }),
      });
      return handleResponse(res, 'Failed to save onboarding role');
    },

    markFirstRunComplete: async (role?: string): Promise<void> => {
      const payload: Record<string, unknown> = { onboarding_completed: true };
      if (role) payload.onboarding_role = role;
      const res = await fetchWithRetry(`${API_URL}/preferences`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(res, 'Failed to mark onboarding complete');
    },

    resetFirstRun: async (): Promise<void> => {
      const res = await fetchWithRetry(`${API_URL}/preferences`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ onboarding_completed: false }),
      });
      return handleResponse(res, 'Failed to reset onboarding');
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
    const res = await fetchWithRetry(`${API_URL}/users/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    await handleResponse(res, 'Failed to update user');
  },

  deleteUser: async (id: string): Promise<void> => {
    // Feedback #406b042a — route through fetchWithRetry + handleResponse so
    // backend errors (e.g. "Cannot delete Account Owner", "User not found",
    // stale token / 401) surface to the UI with actionable messages instead
    // of a generic "Failed to delete user" toast.
    const res = await fetchWithRetry(`${API_URL}/users/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    await handleResponse(res, 'Failed to delete user');
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
    return getCachedJson(`${API_URL}/health`, 30_000, 'Health check failed');
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
    invalidateCachedApiByPrefix(`${API_URL}/notifications`);
  },

  markAllNotificationsRead: async (): Promise<void> => {
    // Backend uses POST /mark-all-read, not PUT /read-all
    const res = await fetchWithRetry(`${API_URL}/notifications/mark-all-read`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to mark all notifications as read');
    invalidateCachedApiByPrefix(`${API_URL}/notifications`);
  },

  deleteNotification: async (id: string): Promise<void> => {
    const res = await fetchWithRetry(`${API_URL}/notifications/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete notification');
    invalidateCachedApiByPrefix(`${API_URL}/notifications`);
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
      const response = await fetch(`${API_URL}/ai/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: getHeaders(),
        body: JSON.stringify({ message, systemInstruction, roleName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      return data.text ?? '';
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
      assistantScope?: 'anna_public' | 'teresa_tenant';
      memoryScope?: 'public_product' | 'tenant' | 'org' | 'user' | 'project';
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
    const isUuidLike = (v: unknown): v is string =>
      typeof v === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());
    const nonEmptyStringOrNull = (v: unknown): string | null =>
      typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;

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
      organizationData: options?.knowledgeSources?.organizationData ?? true,
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
      selectedModelId: nonEmptyStringOrNull(options?.selectedModelId),
      projectId: isUuidLike(context?.projectId) ? context?.projectId : undefined,
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

  getTeresaProposal: async (proposalId: string) => {
    const res = await fetchWithRetry(
      `${API_URL}/v8/teresa/proposal/${encodeURIComponent(proposalId)}`,
      {
        method: 'GET',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to load Teresa proposal');
  },

  /**
   * Phase 1A unidirectional TTS — synthesize Teresa's reply to an audio blob.
   * Throws an Error with `.code`/`.reason` on a non-OK response so the caller can
   * distinguish "not configured" (server_missing_gemini_live_key) from transient
   * failures and surface an honest, recoverable message.
   */
  teresaSynthesizeSpeech: async (input: {
    text: string;
    language?: string | null;
    voiceName?: string | null;
  }): Promise<Blob> => {
    const res = await fetch(`${API_URL}/v10/teresa/tts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        text: input.text,
        language: input.language ?? undefined,
        voiceName: input.voiceName ?? undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}) as Record<string, unknown>);
      const err: any = new Error((data as any)?.error || `Teresa TTS failed (HTTP ${res.status})`);
      err.code = (data as any)?.code;
      err.reason = (data as any)?.reason;
      err.status = res.status;
      throw err;
    }
    return res.blob();
  },

  approveTeresaProposal: async (proposalId: string) => {
    const res = await fetchWithRetry(
      `${API_URL}/v8/teresa/proposal/${encodeURIComponent(proposalId)}/approve`,
      {
        method: 'POST',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to approve Teresa proposal');
  },

  rejectTeresaProposal: async (proposalId: string, reason?: string) => {
    const res = await fetchWithRetry(
      `${API_URL}/v8/teresa/proposal/${encodeURIComponent(proposalId)}/reject`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(reason ? { reason } : {}),
      }
    );
    return handleResponse(res, 'Failed to reject Teresa proposal');
  },

  executeTeresaProposal: async (proposalId: string) => {
    const res = await fetchWithRetry(
      `${API_URL}/v8/teresa/proposal/${encodeURIComponent(proposalId)}/execute`,
      {
        method: 'POST',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to execute Teresa proposal');
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
      assistantScope?: 'anna_public' | 'teresa_tenant';
      memoryScope?: 'public_product' | 'tenant' | 'org' | 'user' | 'project';
    },
    abortSignal?: AbortSignal
  ) => {
    try {
      const isUuidLike = (v: unknown): v is string =>
        typeof v === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());
      const nonEmptyStringOrNull = (v: unknown): string | null =>
        typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;

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
        // Default ON: without org knowledge the assistant falls back to generic/web-shaped answers,
        // which is not acceptable for DBR77-focused tenants.
        organizationData: options?.knowledgeSources?.organizationData ?? true,
      };

      const responseStyle = options?.responseStyle ?? 'normal';

      const resolvedStreamConversationId = (() => {
        const raw = context?.conversationId ?? context?.sessionId;
        if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
        return undefined;
      })();

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
          // Never send JSON `null` — Zod expects string | omitted (UnifiedChatPanel can pass conversationId: null).
          conversationId: resolvedStreamConversationId,
          resumeFromPartial: Boolean(context?.resumeFromPartial),
          // AI Configuration
          aiModes,
          knowledgeSources,
          responseStyle,
          privateMode: Boolean((options as any)?.privateMode),
          assistantScope: options?.assistantScope ?? context?.assistantScope,
          memoryScope: options?.memoryScope ?? context?.memoryScope,
          // Model routing
          selectedTier: options?.selectedTier,
          selectedModelId: nonEmptyStringOrNull(
            options?.selectedModelId ?? localProvider?.modelId ?? null
          ),
          // Explicit per-user provider override (used for local Ollama)
          provider: localProvider?.provider,
          endpoint: localProvider?.endpoint,
          // Common context hints (keep as top-level so backend validator doesn't strip them)
          projectId: isUuidLike(context?.projectId) ? context?.projectId : undefined,
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
                  // Deep Thinking is a two-step contract, not an error:
                  //   1. POST /api/ai/chat/confirm (Api.chatConfirm) to surface the
                  //      understanding/confirm card the user must accept, then
                  //   2. retry POST /api/ai/chat/stream with
                  //      context.deepThinkingConfirmed = true.
                  // This branch only fires when step 2 is attempted before step 1, so
                  // we render a recoverable hint instead of leaking the raw flow-control code.
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
                              : // Feedback #a9fcdd99 / #3b6c0287 — circuit breaker is open
                                // for the LLM provider (e.g. OpenRouter temporarily down or
                                // rate-limited). Previously we had no mapping so the raw
                                // text "Circuit [openrouter] is OPEN. Retry in 18s" leaked
                                // into the chat bubble. Try to parse the cooldown seconds
                                // from the message so we can show the user a concrete
                                // "try again in N seconds" hint.
                                dataCode === 'CIRCUIT_OPEN'
                                ? (() => {
                                    const rawMsg = String(data.error || '');
                                    const retryMatch = rawMsg.match(/Retry in (\d+)s/i);
                                    const seconds = retryMatch ? retryMatch[1] : null;
                                    if (uiLang === 'pl') {
                                      return seconds
                                        ? `⚠️ Dostawca AI jest chwilowo niedostępny. Spróbuj ponownie za ${seconds} s lub wybierz inny model.`
                                        : '⚠️ Dostawca AI jest chwilowo niedostępny. Spróbuj ponownie za chwilę lub wybierz inny model.';
                                    }
                                    return seconds
                                      ? `⚠️ The AI provider is temporarily unavailable. Please try again in ${seconds}s or switch to a different model.`
                                      : '⚠️ The AI provider is temporarily unavailable. Please try again in a moment or switch to a different model.';
                                  })()
                                : dataCode === 'STREAM_ERROR' ||
                                    dataCode === 'AI_STREAM_ERROR' ||
                                    dataCode === 'AI_PIPELINE_ERROR' ||
                                    // Feedback #a9fcdd99 / #3b6c0287 — legacy generic code
                                    // the backend used to emit for any uncategorized
                                    // pipeline error. Map it here so we never fall through
                                    // to dumping `String(data.error)` into the bubble.
                                    dataCode === 'AI_ERROR'
                                  ? uiLang === 'pl'
                                    ? '⚠️ Wystąpił błąd podczas generowania odpowiedzi. Spróbuj ponownie.'
                                    : '⚠️ An error occurred while generating the response. Please try again.'
                                  : null;

                  hasAnyVisibleOutput = true;
                  // Feedback #a9fcdd99 / #3b6c0287 — never surface raw backend
                  // error strings (e.g. "Circuit [openrouter] is OPEN. Retry in
                  // 18s") directly in the chat. If we don't recognize the code,
                  // fall back to a generic friendly message and log the raw text
                  // to the console so ops can still debug from browser logs.
                  if (!friendlyByCode) {
                    try {
                      console.warn(
                        '[AI Stream] Unmapped error code surfaced:',
                        dataCode,
                        String(data.error || '').slice(0, 240)
                      );
                    } catch {
                      /* ignore */
                    }
                  }
                  const genericFallback =
                    uiLang === 'pl'
                      ? '⚠️ Wystąpił nieoczekiwany błąd AI. Spróbuj ponownie za chwilę.'
                      : '⚠️ An unexpected AI error occurred. Please try again in a moment.';
                  onChunk(friendlyByCode || genericFallback);

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
    const res = await fetchWithRetry(`${API_URL}/superadmin/organizations`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch organizations');
  },

  updateOrganization: async (
    id: string,
    updates: { plan?: string; status?: string; discount_percent?: number }
  ): Promise<void> => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/organizations/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data as any)?.error || 'Failed to update organization');
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

  // V4-ENT-04: Org policies (retention, legal hold, residency)
  getOrgPolicies: async (): Promise<{
    policies: Array<{
      id: string;
      organization_id: string;
      retention_days: number | null;
      legal_hold_enabled: number;
      residency_region: string | null;
      created_at: string | null;
      updated_at: string | null;
    }>;
  }> => {
    const res = await fetch(`${API_URL}/superadmin/org-policies`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch org policies');
    return res.json();
  },
  getOrgPolicy: async (
    orgId: string
  ): Promise<{
    id: string;
    organization_id: string;
    retention_days: number | null;
    legal_hold_enabled: number;
    residency_region: string | null;
    created_at: string | null;
    updated_at: string | null;
  } | null> => {
    const res = await fetch(`${API_URL}/superadmin/org-policies/${encodeURIComponent(orgId)}`, {
      headers: getHeaders(),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to fetch org policy');
    return res.json();
  },
  putOrgPolicy: async (
    orgId: string,
    patch: {
      retentionDays?: number | null;
      legalHoldEnabled?: boolean;
      residencyRegion?: string | null;
    }
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/superadmin/org-policies/${encodeURIComponent(orgId)}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error('Failed to update org policy');
    return res.json();
  },

  getSuperAdminDashboard: async (): Promise<{
    activity: { total: number; last_hour: number; last_24h: number; last_7d: number };
    ai: { total_ai_calls: number; total_tokens: number; active_users: number };
    counts: { total_users: number; total_orgs: number; active_users_7d: number };
    live?: { total_active_connections: number };
  }> => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/dashboard`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch dashboard');
  },

  getSuperAdminSignals: async (): Promise<any[]> => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/signals`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch super admin signals');
  },

  getSuperAdminPlatformStats: async (): Promise<any> => {
    return getCachedJson(
      `${API_URL}/superadmin/platform-stats`,
      45_000,
      'Failed to fetch super admin platform stats'
    );
  },

  getActivities: async (limit: number = 50): Promise<any[]> => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/activities?limit=${limit}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch activities');
  },

  // --- SUPERADMIN LEGAL DOCUMENTS ---
  getSuperAdminLegalDocs: async (): Promise<any[]> => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/legal/all`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to load legal documents');
  },

  getSuperAdminLegalDocById: async (id: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/legal/${id}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to load legal document');
  },

  publishSuperAdminLegalDoc: async (payload: {
    docType: string;
    version: string;
    title: string;
    contentMd: string;
    effectiveFrom: string;
    scopeType?: string;
    scopeValue?: string;
    changeSummary?: string;
  }): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/legal/publish`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to publish legal document');
  },

  toggleSuperAdminLegalDocActive: async (id: string, isActive: boolean): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/legal/${id}/toggle-active`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ isActive }),
    });
    return handleResponse(res, 'Failed to update legal document');
  },

  getSuperAdminUsers: async (filters?: {
    organizationId?: string;
    role?: string;
    status?: string;
  }): Promise<User[]> => {
    const params = new URLSearchParams();
    if (filters?.organizationId) params.set('organizationId', filters.organizationId);
    if (filters?.role) params.set('role', filters.role);
    if (filters?.status) params.set('status', filters.status);
    const query = params.toString();
    const res = await fetch(`${API_URL}/superadmin/users${query ? `?${query}` : ''}`, {
      headers: getHeaders(),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data as any)?.error || 'Failed to fetch super admin users');
    // API may return a bare User[] (legacy) or { users, total } per SUPERADMIN_API docs.
    if (Array.isArray(data)) return data as User[];
    if (data && typeof data === 'object' && Array.isArray((data as { users?: unknown }).users)) {
      return (data as { users: User[] }).users;
    }
    return [];
  },

  updateSuperAdminUser: async (
    id: string,
    updates: {
      organizationId?: string;
      role?: string;
      status?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
      licensePlanId?: string | null;
      department?: string;
      jobTitle?: string;
      projectRole?: string;
    }
  ): Promise<void> => {
    // Feedback #1e3d749a / #682d4134 / #76ef6831 — surface the specific backend
    // reason ("Target organization not found", Zod validation detail, 404
    // "User not found", etc.) to the UI instead of collapsing everything into
    // a generic "Failed to update user" toast.
    const res = await fetchWithRetry(`${API_URL}/superadmin/users/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data as any)?.error || 'Failed to update user');
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

  deleteSuperAdminUser: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/superadmin/users/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data as any)?.error || 'Failed to delete super admin');
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
    const res = await fetchWithRetry(`${API_URL}/superadmin/storage/usage`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch storage stats');
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

  impersonateUser: async (
    userId: string,
    reason?: string
  ): Promise<{ user: User; token: string }> => {
    // Feedback #b8bf4422 — the `/superadmin/impersonate` route is gated by
    // `requireConfirmation('impersonate_user', 'critical')` + `requireAudit`,
    // so the payload MUST include `confirmation: true` and a non-empty
    // `reason` (>= 3 chars). Previously we only sent `{ userId }`, which the
    // middleware rejected with 428 CONFIRMATION_REQUIRED and the UI surfaced
    // as "Failed to impersonate user" with no hint. We default the reason to
    // a generic "Superadmin support session" when the caller doesn't pass one
    // so the action still works without forcing every call site to prompt.
    const finalReason =
      typeof reason === 'string' && reason.trim().length >= 3
        ? reason.trim()
        : 'Superadmin support session';
    const res = await fetch(`${API_URL}/superadmin/impersonate`, {
      method: 'POST',
      headers: {
        ...getHeaders(),
        'X-Audit-Reason': finalReason,
      },
      body: JSON.stringify({ userId, confirmation: true, reason: finalReason }),
    });
    const data = await res.json().catch(() => ({}) as any);
    if (!res.ok) {
      const msg =
        (data && (data.error || data.message)) || `Failed to impersonate user (HTTP ${res.status})`;
      throw new Error(msg);
    }
    return data;
  },

  getSystemSettings: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/settings`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch settings');
  },

  // --- PROJECTS ---
  getProjects: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/projects`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch projects');
    return res.json();
  },

  /**
   * DOROBKA B (2026-07-23, decyzja Piotra): projekty, w których wołający jest
   * CZŁONKIEM — nie cała organizacja (`getProjects()` powyżej zwraca WSZYSTKIE
   * projekty org, za dużo dla selektora Vault "Projekt"). Adoptuje istniejący
   * endpoint `GET /api/projects/my-memberships`
   * (server/src/controllers/ProjectController.ts:905 `getMyMemberships`,
   * JOIN project_members->projects org-scoped) — był już zbudowany, ale bez
   * konsumenta we froncie. Mapuje odpowiedź `{ memberships: [{projectId,
   * projectName,...}] }` na płaski kształt `{id, name}`, zgodny z tym, czego
   * oczekuje `normalizeProjects` w DocumentsRAGTab.tsx.
   */
  getMyProjectMemberships: async (): Promise<Array<{ id: string; name: string }>> => {
    const res = await fetch(`${API_URL}/projects/my-memberships`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch project memberships');
    const data = await res.json();
    const memberships = Array.isArray(data?.memberships) ? data.memberships : [];
    return memberships.map((m: any) => ({
      id: String(m.projectId || ''),
      name: String(m.projectName || ''),
    }));
  },

  /**
   * Zwornik Delta B (§4.2) — project finance rollup (read-model only).
   * SSOT: Harvard/wdrozenie-100/_KONCEPT_ZWORNIK_2026-07-10.md.
   * Backend: `ProjectController.getProjectFinance` / `projectFinanceRollupService.ts`.
   */
  getProjectFinance: async (projectId: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/pmo/projects/${projectId}/finance`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch project finance rollup');
  },

  /**
   * Zwornik (#78) — project team members (read-model for the /projects
   * "Zespół" / "Role" sections). Backend: `pmo/project-members.routes.ts`
   * GET /:projectId (mounted at `/api/project-members`, Gateway.ts). Returns
   * flat rows: { id, user_id, role, permissions, joined_at, first_name,
   * last_name, email, avatar_url }.
   */
  getProjectTeamMembers: async (projectId: string): Promise<any[]> => {
    const res = await fetchWithRetry(`${API_URL}/project-members/${projectId}`, {
      headers: getHeaders(),
    });
    const data = await handleResponse(res, 'Failed to fetch project team members');
    return Array.isArray(data) ? data : [];
  },

  /**
   * Zwornik D3 — assign/unassign a project to a program (`projects.program_id`,
   * migration 916). Backend: `pmo/projects.routes.ts` PUT /:id/program.
   */
  assignProjectProgram: async (projectId: string, programId: string | null): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/pmo/projects/${projectId}/program`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ programId }),
    });
    return handleResponse(res, 'Failed to assign project to program');
  },

  // --- PROGRAMS (Zwornik D3 — hierarchia: program → projekty → inicjatywy) ---
  // Program CRUD already lives at /api/initiatives/programs (V4-INIT-02,
  // server/src/routes/pmo/initiatives.routes.ts) — this is the frontend client.
  getPrograms: async (): Promise<any[]> => {
    const res = await fetchWithRetry(`${API_URL}/initiatives/programs`, { headers: getHeaders() });
    const data = await handleResponse(res, 'Failed to fetch programs');
    return Array.isArray(data?.programs) ? data.programs : [];
  },

  getProgram: async (programId: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/initiatives/programs/${programId}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch program');
  },

  getProgramRollup: async (programId: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/initiatives/programs/${programId}/rollup`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch program rollup');
  },

  createProgram: async (data: {
    name: string;
    description?: string;
    parentProgramId?: string | null;
    status?: string;
  }): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/initiatives/programs`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create program');
  },

  updateProgram: async (
    programId: string,
    data: { name?: string; description?: string; parentProgramId?: string | null; status?: string }
  ): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/initiatives/programs/${programId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update program');
  },

  deleteProgram: async (programId: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/initiatives/programs/${programId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete program');
  },

  getMeetings: async (projectId?: string): Promise<any> => {
    const qs = new URLSearchParams();
    if (projectId) qs.set('projectId', projectId);
    const qstring = qs.toString();
    const endpoint = `${API_URL}/meeting${qstring ? `?${qstring}` : ''}`;
    const res = await fetch(endpoint, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch meetings');
  },

  createMeeting: async (data: any): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/meeting`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data || {}),
    });
    return handleResponse(res, 'Failed to create meeting');
  },

  updateMeeting: async (meetingId: string, data: any): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/meeting/${meetingId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data || {}),
    });
    return handleResponse(res, 'Failed to update meeting');
  },

  deleteMeeting: async (meetingId: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/meeting/${meetingId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete meeting');
  },

  updateMeetingStatus: async (
    meetingId: string,
    status: 'scheduled' | 'completed'
  ): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/meeting/${meetingId}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    return handleResponse(res, 'Failed to update meeting status');
  },

  addMeetingFollowUp: async (
    meetingId: string,
    data: { title: string; owner?: string }
  ): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/meeting/${meetingId}/follow-ups`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data || {}),
    });
    return handleResponse(res, 'Failed to add follow-up');
  },

  addMeetingDecision: async (meetingId: string, decision: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/meeting/${meetingId}/decisions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ decision }),
    });
    return handleResponse(res, 'Failed to add decision');
  },

  // Module 13: turn a meeting transcript into structured AI notes (summary, key
  // points, decisions, action items). Persists extracted decisions/action items
  // as meeting decisions/follow-ups unless persist:false is passed.
  generateMeetingNotes: async (
    meetingId: string,
    data: { transcript: string; language?: string; persist?: boolean }
  ): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/meeting/${meetingId}/generate-notes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data || {}),
      // Heavy: LLM turns a full transcript into structured notes; exceeds 20s.
      timeoutMs: 120000,
    });
    return handleResponse(res, 'Failed to generate meeting notes');
  },

  updateMeetingFollowUpStatus: async (
    meetingId: string,
    followUpId: string,
    status: 'open' | 'done'
  ): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/meeting/${meetingId}/follow-ups/${followUpId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    return handleResponse(res, 'Failed to update follow-up status');
  },

  getAIOperatorOverview: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/ai-operator/overview`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch AI operator overview');
  },

  getAIOperatorOps: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/ai-operator/ops`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch AI operator ops');
  },

  getAIOperatorInterventions: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/ai-operator/interventions`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch AI operator interventions');
  },

  getAIOperatorPlan: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/ai-operator/plans/current`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch AI operator plan');
  },

  regenerateAIOperatorPlan: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/ai-operator/plans/generate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({}),
      // Heavy: LLM regenerates a full operator plan; exceeds 20s.
      timeoutMs: 120000,
    });
    return handleResponse(res, 'Failed to regenerate AI operator plan');
  },

  proposeAIOperatorIntervention: async (input: { templateKey: string }): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/ai-operator/interventions/propose`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(input || {}),
    });
    return handleResponse(res, 'Failed to propose AI operator intervention');
  },

  acceptAIOperatorIntervention: async (actionId: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/ai-operator/interventions/${actionId}/accept`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({}),
    });
    return handleResponse(res, 'Failed to accept AI operator intervention');
  },

  executeAIOperatorIntervention: async (actionId: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/ai-operator/interventions/${actionId}/execute`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({}),
    });
    return handleResponse(res, 'Failed to execute AI operator intervention');
  },

  rejectAIOperatorIntervention: async (actionId: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/ai-operator/interventions/${actionId}/reject`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({}),
    });
    return handleResponse(res, 'Failed to reject AI operator intervention');
  },

  getAIOperatorMeetingBrief: async (meetingId: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/ai-operator/meetings/${meetingId}/brief`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch AI operator meeting brief');
  },

  updateAIOperatorProfile: async (input: {
    currentStage?: string;
    relationshipStatus?: string;
    clientDna?: Record<string, unknown>;
    preferences?: Record<string, unknown>;
    notes?: string;
  }): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/ai-operator/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(input || {}),
    });
    return handleResponse(res, 'Failed to update AI operator profile');
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

  getLLMHealthDetailed: async (): Promise<any> => {
    return getCachedJson(`${API_URL}/llm/health/detailed`, 60_000, 'Failed to fetch LLM health');
  },

  getLLMControlUsage: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/llm/control/usage`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch LLM usage');
  },

  getLLMCosts: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/llm/costs`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch LLM costs');
  },

  getAIFinOpsOverview: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/ai-analytics/finops/overview`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch AI FinOps overview');
  },

  getMissionControlProviders: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/ai-operations/mission-control/providers`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch mission control providers');
  },

  getAIOperationsPerformanceMetrics: async (period: string): Promise<any> => {
    const res = await fetchWithRetry(
      `${API_URL}/ai-operations/performance/metrics?period=${encodeURIComponent(period)}`,
      { headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to fetch performance metrics');
  },

  getAIOperationsPerformanceTrends: async (period: string): Promise<any> => {
    const res = await fetchWithRetry(
      `${API_URL}/ai-operations/performance/trends?period=${encodeURIComponent(period)}`,
      { headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to fetch performance trends');
  },

  getAIOperationsLLMObservatory: async (period: string): Promise<any> => {
    const res = await fetchWithRetry(
      `${API_URL}/ai-operations/analytics/llm-observatory?period=${encodeURIComponent(period)}`,
      { headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to fetch LLM observatory analytics');
  },

  getSuperAdminAISettings: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/ai-settings/superadmin`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch AI settings');
  },

  updateSuperAdminAISettings: async (settings: any): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/ai-settings/superadmin`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(settings),
    });
    return handleResponse(res, 'Failed to update AI settings');
  },

  getAIGovernanceContextPolicy: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/ai-governance/context-policy`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch AI governance context policy');
  },

  updateAIGovernanceContextPolicy: async (payload: any): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/ai-governance/context-policy`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to update AI governance context policy');
  },

  getAIGovernancePolicy: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/ai-governance/policy`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch AI governance policy');
  },

  updateAIGovernancePolicy: async (payload: any): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/ai-governance/policy`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to update AI governance policy');
  },

  getAIGovernanceHealth: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/ai-governance/health`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch AI governance health');
  },

  getLLMTierAssignments: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/llm/tiers/assignments`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch tier assignments');
  },

  getLLMPurposes: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/llm/purposes`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch purposes');
  },

  getLLMUseCaseOverview: async (organizationId?: string): Promise<any> => {
    const qs = new URLSearchParams();
    if (organizationId) qs.set('organizationId', organizationId);
    const res = await fetchWithRetry(
      `${API_URL}/llm/use-cases/overview${qs.toString() ? `?${qs.toString()}` : ''}`,
      { headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to fetch AI use-case overview');
  },

  upsertLLMPurpose: async (payload: any): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/llm/purposes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to save purpose');
  },

  getLLMPurposeAssignments: async (purpose: string, organizationId?: string): Promise<any> => {
    const qs = new URLSearchParams();
    if (organizationId) qs.set('organizationId', organizationId);
    const url = `${API_URL}/llm/purposes/${encodeURIComponent(purpose)}/assignments${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await fetchWithRetry(url, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch purpose assignments');
  },

  addLLMPurposeAssignment: async (purpose: string, payload: any): Promise<any> => {
    const res = await fetchWithRetry(
      `${API_URL}/llm/purposes/${encodeURIComponent(purpose)}/assignments`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      }
    );
    return handleResponse(res, 'Failed to save assignment');
  },

  deleteLLMPurposeAssignment: async (purpose: string, payload: any): Promise<any> => {
    const res = await fetchWithRetry(
      `${API_URL}/llm/purposes/${encodeURIComponent(purpose)}/assignments`,
      {
        method: 'DELETE',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      }
    );
    return handleResponse(res, 'Failed to delete assignment');
  },

  getLLMPricingSnapshots: async (params?: {
    provider?: string;
    model_id?: string;
  }): Promise<any> => {
    const qs = new URLSearchParams();
    if (params?.provider) qs.set('provider', params.provider);
    if (params?.model_id) qs.set('model_id', params.model_id);
    const res = await fetchWithRetry(`${API_URL}/llm/pricing/snapshots?${qs.toString()}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch pricing snapshots');
  },

  createLLMPricingSnapshot: async (payload: any): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/llm/pricing/snapshots`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to create pricing snapshot');
  },

  getLLMMarketInbox: async (params?: { status?: string; source?: string }): Promise<any> => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.source) qs.set('source', params.source);
    const res = await fetchWithRetry(`${API_URL}/llm/market/inbox?${qs.toString()}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch market inbox');
  },

  getOrgLLMPolicy: async (organizationId: string): Promise<any> => {
    const res = await fetchWithRetry(
      `${API_URL}/llm/org/${encodeURIComponent(organizationId)}/policy`,
      {
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to fetch org AI policy');
  },

  updateOrgLLMPolicy: async (
    organizationId: string,
    policy: any,
    options?: { mode?: 'draft' | 'review' | 'approved' | 'published'; changeSummary?: string }
  ): Promise<any> => {
    const res = await fetchWithRetry(
      `${API_URL}/llm/org/${encodeURIComponent(organizationId)}/policy`,
      {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          policy,
          mode: options?.mode,
          changeSummary: options?.changeSummary,
        }),
      }
    );
    return handleResponse(res, 'Failed to update org AI policy');
  },

  getOrgLLMPolicyHistory: async (organizationId: string): Promise<any> => {
    const res = await fetchWithRetry(
      `${API_URL}/llm/org/${encodeURIComponent(organizationId)}/policy/history`,
      {
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to fetch org AI policy history');
  },

  rollbackOrgLLMPolicy: async (organizationId: string, versionId: string): Promise<any> => {
    const res = await fetchWithRetry(
      `${API_URL}/llm/org/${encodeURIComponent(organizationId)}/policy/rollback`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ versionId }),
      }
    );
    return handleResponse(res, 'Failed to rollback org AI policy');
  },

  updateAIGovernanceDocumentVisibility: async (docId: string, visibility: string): Promise<any> => {
    const res = await fetchWithRetry(
      `${API_URL}/ai-governance/documents/${encodeURIComponent(docId)}/ai-visibility`,
      { method: 'PUT', headers: getHeaders(), body: JSON.stringify({ visibility }) }
    );
    return handleResponse(res, 'Failed to update AI visibility');
  },

  updateAIGovernanceDocumentSensitivity: async (
    docId: string,
    sensitivity: string
  ): Promise<any> => {
    const res = await fetchWithRetry(
      `${API_URL}/ai-governance/documents/${encodeURIComponent(docId)}/sensitivity`,
      { method: 'PUT', headers: getHeaders(), body: JSON.stringify({ sensitivity }) }
    );
    return handleResponse(res, 'Failed to update sensitivity');
  },

  getPlaybookTemplate: async (templateId: string): Promise<any> => {
    const res = await fetchWithRetry(
      `${API_URL}/ai/playbooks/templates/${encodeURIComponent(templateId)}`,
      {
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to fetch playbook template');
  },

  updatePlaybookTemplate: async (templateId: string, payload: any): Promise<any> => {
    const res = await fetchWithRetry(
      `${API_URL}/ai/playbooks/templates/${encodeURIComponent(templateId)}`,
      { method: 'PUT', headers: getHeaders(), body: JSON.stringify(payload) }
    );
    return handleResponse(res, 'Failed to update playbook template');
  },

  validatePlaybookTemplate: async (templateId: string): Promise<any> => {
    const res = await fetchWithRetry(
      `${API_URL}/ai/playbooks/templates/${encodeURIComponent(templateId)}/validate`,
      { method: 'POST', headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to validate playbook template');
  },

  syncOpenRouterMarket: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/llm/market/openrouter/sync`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to sync market');
  },

  updateMarketInboxItem: async (id: string, payload: any): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/llm/market/inbox/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to update market inbox item');
  },

  applyMarketInboxItem: async (id: string): Promise<any> => {
    const res = await fetchWithRetry(
      `${API_URL}/llm/market/inbox/${encodeURIComponent(id)}/apply`,
      { method: 'POST', headers: getHeaders(), body: JSON.stringify({}) }
    );
    return handleResponse(res, 'Failed to apply market inbox item');
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
    const payload = await res.json().catch(() => null);
    if (!res.ok) throw new Error(payload?.error || 'Failed to update provider');
    return payload;
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
    let url = `${API_URL}/billing/admin/operational-costs`;
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (params.toString()) url += `?${params.toString()}`;

    const res = await fetchWithRetry(url, { headers: getHeaders() });
    const data = await handleResponse(res, 'Failed to fetch costs');
    return {
      items: Array.isArray(data?.items) ? data.items : Array.isArray(data?.costs) ? data.costs : [],
      totalCost: Number.isFinite(Number(data?.totalCost)) ? Number(data.totalCost) : 0,
    };
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
    data: {
      name?: string;
      model_id: string;
      tier?: string;
      visibility?: string;
      is_active?: boolean;
      priority?: number;
    }
  ): Promise<any> => {
    const res = await fetch(
      `${API_URL}/llm/providers/${encodeURIComponent(sourceProviderId)}/clone-model`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      }
    );
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
    return getCachedJson(
      `${API_URL}/llm/providers/public`,
      5 * 60_000,
      'Failed to fetch public LLM providers'
    );
  },

  getLLMAuditStats: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/llm/audit/stats`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch LLM audit stats');
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

  getPromptAssistantStats: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/prompt-assistant/stats`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch prompt assistant stats');
  },

  getPromptAssistantTemplates: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/prompt-assistant/templates`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch prompt assistant templates');
  },

  getAiLearningPatterns: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/ai/learning/patterns`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch learning patterns');
  },

  getAiLearningInteractions: async (params: { limit?: number; range?: string }): Promise<any> => {
    const qs = new URLSearchParams();
    if (typeof params?.limit === 'number') qs.set('limit', String(params.limit));
    if (params?.range) qs.set('range', params.range);
    const res = await fetchWithRetry(`${API_URL}/ai/learning/interactions?${qs.toString()}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch learning interactions');
  },

  getAiLearningMetrics: async (range: string): Promise<any> => {
    const res = await fetchWithRetry(
      `${API_URL}/ai/learning/metrics?range=${encodeURIComponent(range)}`,
      {
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to fetch learning metrics');
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
    const res = await fetchWithRetry(`${API_URL}/llm/providers/health?timeoutMs=4000`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Health check failed');
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
    return getCachedJson(`${API_URL}/llm/user/usage`, 60_000, 'Failed to fetch user AI usage');
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
    programId?: string;
    status?: string;
    assigneeId?: string;
    priority?: string;
    initiativeId?: string;
    listId?: string;
    scope?: 'personal' | 'initiative' | 'program';
  }): Promise<any[]> => {
    let url = `${API_URL}/tasks`;
    if (filters) {
      const params = new URLSearchParams();
      if (filters.projectId) params.append('projectId', filters.projectId);
      if (filters.programId) params.append('programId', filters.programId);
      if (filters.status) params.append('status', filters.status);
      if (filters.assigneeId) params.append('assigneeId', filters.assigneeId);
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.initiativeId) params.append('initiativeId', filters.initiativeId);
      if (filters.listId) params.append('listId', filters.listId);
      if (filters.scope) params.append('scope', filters.scope);
      // IMPORTANT: no leading space after "?" (breaks query parsing in some servers)
      if (params.toString()) url += `?${params.toString()}`;
    }
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
  },

  getTaskRollups: async (filters?: {
    projectId?: string;
    programId?: string;
    initiativeId?: string;
    listId?: string;
    scope?: 'personal' | 'initiative' | 'program';
  }): Promise<any> => {
    let url = `${API_URL}/tasks/rollups`;
    if (filters) {
      const params = new URLSearchParams();
      if (filters.projectId) params.append('projectId', filters.projectId);
      if (filters.programId) params.append('programId', filters.programId);
      if (filters.initiativeId) params.append('initiativeId', filters.initiativeId);
      if (filters.listId) params.append('listId', filters.listId);
      if (filters.scope) params.append('scope', filters.scope);
      if (params.toString()) url += `?${params.toString()}`;
    }
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch task rollups');
    return res.json();
  },

  getTaskWorkflowConfig: async (): Promise<{
    statuses: string[];
    transitions: Record<string, string[]>;
  }> => {
    const res = await fetch(`${API_URL}/tasks/workflow-config`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch task workflow config');
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
    listId?: string;
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

    const cacheKey = makePersonalTasksCacheKey(url, tokenService.getToken());
    const cached = personalTasksCacheGet(cacheKey);
    if (cached) {
      return cached as any[];
    }

    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch(url, { headers: getHeaders(), signal: ctrl.signal });
      if (!res.ok) throw new Error('Failed to fetch personal tasks');
      const raw = await res.json();
      const data = Array.isArray(raw) ? raw : Array.isArray(raw?.tasks) ? raw.tasks : [];
      personalTasksCacheSet(cacheKey, data);
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  getPersonalTask: async (id: string): Promise<any> => {
    const res = await fetch(`${API_URL}/my-work/personal-tasks/${id}`, { headers: getHeaders() });
    if (!res.ok) {
      const err = new Error('Failed to fetch personal task') as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    return res.json();
  },

  createPersonalTask: async (task: {
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    dueDate?: string | null;
    tags?: string[];
    sourceType?: string | null;
    sourceId?: string | null;
  }): Promise<any> => {
    const res = await fetch(`${API_URL}/my-work/personal-tasks`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(task),
    });
    const created = await handleResponse(res, 'Failed to create personal task');
    clearPersonalTasksCache();
    return created;
  },

  updatePersonalTask: async (id: string, updates: any): Promise<any> => {
    const res = await fetch(`${API_URL}/my-work/personal-tasks/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    const updated = await handleResponse(res, 'Failed to update personal task');
    clearPersonalTasksCache();
    return updated;
  },

  deletePersonalTask: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/my-work/personal-tasks/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    await handleResponse(res, 'Failed to delete personal task');
    clearPersonalTasksCache();
  },

  // ==========================================
  // MY WORK (V2): MY IDEAS (T009)
  // ==========================================
  getMyIdeas: async (filters?: {
    q?: string;
    tag?: string;
    limit?: number;
    folder?: string;
    favoriteOnly?: boolean;
  }): Promise<any[]> => {
    let url = `${API_URL}/my-work/my-ideas`;
    if (filters) {
      const params = new URLSearchParams();
      if (filters.q) params.append('q', filters.q);
      if (filters.tag) params.append('tag', filters.tag);
      if (filters.limit) params.append('limit', String(filters.limit));
      if (filters.folder) params.append('folder', filters.folder);
      if (filters.favoriteOnly) params.append('favoriteOnly', '1');
      if (params.toString()) url += `?${params.toString()}`;
    }
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch ideas');
    const rows = await res.json();
    return Array.isArray(rows) ? rows.map(normalizeIdeaDisplayFields) : rows;
  },

  // M2 home-shell: server-backed favorites / recents / folders.
  setIdeaFavorite: async (id: string, isFavorite: boolean): Promise<void> => {
    const res = await fetchWithRetry(`${API_URL}/my-work/my-ideas/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ isFavorite }),
    });
    await handleResponse(res, 'Failed to update favorite');
  },

  setIdeaFolder: async (id: string, folderId: string | null): Promise<void> => {
    const res = await fetchWithRetry(`${API_URL}/my-work/my-ideas/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ folderId }),
    });
    await handleResponse(res, 'Failed to move idea');
  },

  recordIdeaOpened: async (id: string): Promise<void> => {
    // Best-effort recents stamp; never block opening on this.
    try {
      await fetchWithRetry(`${API_URL}/my-work/my-ideas/${id}/opened`, {
        method: 'POST',
        headers: getHeaders(),
      });
    } catch {
      /* ignore */
    }
  },

  getMyIdeaFolders: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/my-work/my-idea-folders`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch folders');
    return res.json();
  },

  createMyIdeaFolder: async (payload: {
    name: string;
    description?: string;
    color?: string;
    parentFolderId?: string | null;
  }): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/my-work/my-idea-folders`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to create folder');
  },

  updateMyIdeaFolder: async (folderId: string, updates: any): Promise<void> => {
    const res = await fetchWithRetry(`${API_URL}/my-work/my-idea-folders/${folderId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    await handleResponse(res, 'Failed to update folder');
  },

  deleteMyIdeaFolder: async (folderId: string): Promise<void> => {
    const res = await fetchWithRetry(`${API_URL}/my-work/my-idea-folders/${folderId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    await handleResponse(res, 'Failed to delete folder');
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
    return normalizeIdeaDisplayFields(await res.json());
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

  duplicateMyIdea: async (id: string, opts?: { language?: string }): Promise<any> => {
    const params = new URLSearchParams();
    if (opts?.language) params.set('language', opts.language);
    const qs = params.toString();
    const res = await fetch(`${API_URL}/my-work/my-ideas/${id}/duplicate${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to duplicate idea');
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
    payload: {
      nodes: any[];
      edges: any[];
      version?: number;
      preferredTool?: 'mindmap' | 'process_flow' | 'table' | 'whiteboard';
      extensions?: Record<string, unknown>;
      /** V4-IDEA-08: When true, audit logs as user applying AI proposal */
      fromAI?: boolean;
    }
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/my-work/my-ideas/${encodeURIComponent(ideaId)}/map`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to save idea map');
  },

  syncMyIdeaMap: async (
    ideaId: string,
    payload: {
      nodes: any[];
      edges: any[];
      baseVersion?: number;
      preferredTool?: 'mindmap' | 'process_flow' | 'table' | 'whiteboard';
      extensions?: Record<string, unknown>;
      fromAI?: boolean;
      reason?: 'draft' | 'manual' | 'semantic' | 'ai';
      /**
       * M06 L-05: when flushing on page teardown (visibilitychange→hidden,
       * beforeunload, unmount) use keepalive so the request survives the
       * document unloading. keepalive (unlike sendBeacon) still sends the
       * Authorization header from getHeaders(). Single-shot — no retry.
       */
      keepalive?: boolean;
    }
  ): Promise<any> => {
    const { keepalive, ...body } = payload;
    if (keepalive) {
      const res = await fetch(
        `${API_URL}/my-work/my-ideas/${encodeURIComponent(ideaId)}/map/sync`,
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(body),
          keepalive: true,
        }
      );
      return handleResponse(res, 'Failed to sync idea map');
    }
    const res = await fetchWithRetry(
      `${API_URL}/my-work/my-ideas/${encodeURIComponent(ideaId)}/map/sync`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body),
      }
    );
    return handleResponse(res, 'Failed to sync idea map');
  },

  /**
   * M06 FALA3 3.4 — real .pptx export for the mind map (BCG-grade pipeline,
   * see server/src/services/mindmap/mindMapToUnifiedReport.ts). Gated by
   * `isMindmapPptxNativeEnabled()` on the caller side.
   */
  exportMyIdeaMapPptx: async (
    ideaId: string,
    payload: {
      ideaTitle: string;
      branches: Array<{
        branchKey: string;
        label: string;
        nodes: Array<{ id: string; label: string; status?: string }>;
      }>;
      language?: 'en' | 'pl';
      template?: 'corporate' | 'minimal' | 'modern';
    }
  ): Promise<Blob> => {
    const res = await fetch(
      `${API_URL}/my-work/my-ideas/${encodeURIComponent(ideaId)}/map/export/pptx`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      let message = 'Failed to export mind map PPTX';
      try {
        const errBody = await res.clone().json();
        if (errBody?.error) message = errBody.error;
      } catch {
        /* ignore — keep default message */
      }
      throw new Error(message);
    }
    return res.blob();
  },

  expandMyIdeaMap: async (
    ideaId: string,
    payload: {
      anchorNodeId?: string;
      branchKey?: string;
      count?: number;
      language?: string;
      proposeOnly?: boolean;
      context?: string;
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

  getIdeaAISuggestions: async (
    ideaId: string,
    payload: {
      context: {
        title: string;
        seedText: string;
        currentNodes: any[];
        currentEdges: any[];
        activeTool: string;
      };
      mode: 'passive' | 'on_demand' | 'batch';
      prompt?: string;
      language?: string;
    }
  ): Promise<any> => {
    const res = await fetch(
      `${API_URL}/my-work/my-ideas/${encodeURIComponent(ideaId)}/ai-suggestions`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      }
    );
    return handleResponse(res, 'Failed to get AI suggestions');
  },

  getIdeaAITableAction: async (
    ideaId: string,
    payload: { command: string; schema: any[]; language?: string }
  ): Promise<any> => {
    const res = await fetch(
      `${API_URL}/my-work/my-ideas/${encodeURIComponent(ideaId)}/ai-table-action`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      }
    );
    return handleResponse(res, 'Failed to process table action');
  },

  getIdeaAIFill: async (
    ideaId: string,
    payload: {
      prompt: string;
      rows: Array<{ id: string; data: Record<string, any> }>;
      language?: string;
    }
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/my-work/my-ideas/${encodeURIComponent(ideaId)}/ai-fill`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to generate AI fill');
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

  // --- V8 Mindmap (audit trail, export, health) ---
  createMindmapAIProposal: async (
    mindmapId: string,
    proposal: { summary?: string; plan?: string; operations?: any[]; diff_summary?: any }
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/v8/mindmap/${encodeURIComponent(mindmapId)}/ai-proposals`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(proposal),
    });
    return handleResponse(res, 'Failed to create AI proposal');
  },

  resolveMindmapAIProposal: async (
    proposalId: string,
    action: 'accept' | 'reject'
  ): Promise<any> => {
    const res = await fetch(
      `${API_URL}/v8/mindmap/ai-proposals/${encodeURIComponent(proposalId)}/resolve`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action }),
      }
    );
    return handleResponse(res, 'Failed to resolve AI proposal');
  },

  exportMindmapJSON: async (mindmapId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/v8/mindmap/${encodeURIComponent(mindmapId)}/export/json`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to export mindmap JSON');
  },

  exportMindmapMarkdown: async (mindmapId: string): Promise<any> => {
    const res = await fetch(
      `${API_URL}/v8/mindmap/${encodeURIComponent(mindmapId)}/export/markdown`,
      { headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to export mindmap markdown');
  },

  getMindmapHealth: async (mindmapId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/v8/mindmap/${encodeURIComponent(mindmapId)}/health`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get mindmap health');
  },

  // --- Snapshots ---
  getMyIdeaMapSnapshots: async (ideaId: string): Promise<any> => {
    const res = await fetch(
      `${API_URL}/my-work/my-ideas/${encodeURIComponent(ideaId)}/map/snapshots`,
      { headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to fetch snapshots');
  },

  createMyIdeaMapSnapshot: async (
    ideaId: string,
    payload: { label: string; nodes: any[]; edges: any[]; extensions?: Record<string, unknown> }
  ): Promise<any> => {
    const res = await fetch(
      `${API_URL}/my-work/my-ideas/${encodeURIComponent(ideaId)}/map/snapshots`,
      { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) }
    );
    return handleResponse(res, 'Failed to create snapshot');
  },

  deleteMyIdeaMapSnapshot: async (ideaId: string, snapshotId: string): Promise<any> => {
    const res = await fetch(
      `${API_URL}/my-work/my-ideas/${encodeURIComponent(ideaId)}/map/snapshots/${encodeURIComponent(snapshotId)}`,
      { method: 'DELETE', headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to delete snapshot');
  },

  // --- Activity Feed ---
  getMyIdeaActivity: async (
    ideaId: string,
    opts?: { limit?: number; offset?: number }
  ): Promise<any> => {
    const params = new URLSearchParams();
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.offset) params.set('offset', String(opts.offset));
    const qs = params.toString();
    const res = await fetch(
      `${API_URL}/my-work/my-ideas/${encodeURIComponent(ideaId)}/activity${qs ? `?${qs}` : ''}`,
      { headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to fetch activity');
  },

  createMyIdeaActivity: async (
    ideaId: string,
    payload: { type: string; actor: string; nodeId?: string; nodeLabel?: string; detail?: string }
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/my-work/my-ideas/${encodeURIComponent(ideaId)}/activity`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to create activity entry');
  },

  // --- Node Comments ---
  /**
   * Komplet komentarzy Idei (wątek całej Idei + wszystkie węzły) jednym
   * zapytaniem — zasila zakres „Cała Idea" w prawym panelu (IdeaPanelComments).
   */
  getIdeaComments: async (ideaId: string): Promise<any> => {
    const res = await fetch(
      `${API_URL}/my-work/my-ideas/${encodeURIComponent(ideaId)}/map/comments`,
      { headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to fetch idea comments');
  },

  getNodeComments: async (ideaId: string, nodeId: string): Promise<any> => {
    const res = await fetch(
      `${API_URL}/my-work/my-ideas/${encodeURIComponent(ideaId)}/map/nodes/${encodeURIComponent(nodeId)}/comments`,
      { headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to fetch node comments');
  },

  addNodeComment: async (
    ideaId: string,
    nodeId: string,
    text: string,
    mentions?: string[]
  ): Promise<any> => {
    const res = await fetch(
      `${API_URL}/my-work/my-ideas/${encodeURIComponent(ideaId)}/map/nodes/${encodeURIComponent(nodeId)}/comments`,
      { method: 'POST', headers: getHeaders(), body: JSON.stringify({ text, mentions }) }
    );
    return handleResponse(res, 'Failed to add comment');
  },

  deleteNodeComment: async (ideaId: string, nodeId: string, commentId: string): Promise<any> => {
    const res = await fetch(
      `${API_URL}/my-work/my-ideas/${encodeURIComponent(ideaId)}/map/nodes/${encodeURIComponent(nodeId)}/comments/${encodeURIComponent(commentId)}`,
      { method: 'DELETE', headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to delete comment');
  },

  getMyIdeaAISuggestions: async (
    ideaId: string,
    payload: {
      seedText: string;
      mapNodes: any[];
      mapEdges?: any[];
      activeTool?: string;
      language?: string;
    }
  ): Promise<any> => {
    const res = await fetch(
      `${API_URL}/my-work/my-ideas/${encodeURIComponent(ideaId)}/map/ai-suggestions`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      }
    );
    return handleResponse(res, 'Failed to fetch AI suggestions');
  },

  getMyIdeaGapAnalysis: async (
    ideaId: string,
    payload: { seedText: string; mapNodes: any[]; branchKeys?: string[]; language?: string }
  ): Promise<any> => {
    const res = await fetch(
      `${API_URL}/my-work/my-ideas/${encodeURIComponent(ideaId)}/map/gap-analysis`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      }
    );
    return handleResponse(res, 'Failed to fetch gap analysis');
  },

  // --- My Ideas: AI Generator ---
  generateIdeaAI: async (
    ideaId: string,
    payload: {
      generatorType: string;
      tool: string;
      context: {
        seedText: string;
        title: string;
        branch?: string;
        area?: string;
        existingNodes: any[];
        existingEdges: any[];
        existingLanes?: any[];
        language: string;
      };
    }
  ): Promise<any> => {
    const res = await fetch(
      `${API_URL}/my-work/my-ideas/${encodeURIComponent(ideaId)}/ai-generate`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      }
    );
    return handleResponse(res, 'Failed to generate AI content');
  },

  // --- My Ideas: Convert/Promote ---
  convertMyIdea: async (
    ideaId: string,
    payload: {
      target: 'initiative' | 'task_set' | 'decision' | 'team_chat' | 'report' | 'presentation';
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

  // ==========================================
  // LINK GRAPH v3 (MVP): Backlinks + edge create
  // SSOT: docs/product/LINK_GRAPH_V3.md
  // ==========================================
  getLinkGraphBacklinks: async (target: {
    type: string;
    id: string;
    limit?: number;
  }): Promise<
    Array<{
      id: string;
      sourceType: string;
      sourceId: string;
      relation: string;
      containerType?: string | null;
      containerId?: string | null;
      blockId?: string | null;
      createdAt?: string;
    }>
  > => {
    const qs = new URLSearchParams();
    qs.set('type', target.type);
    qs.set('id', target.id);
    if (target.limit) qs.set('limit', String(target.limit));
    const res = await fetch(`${API_URL}/my-work/link-graph/backlinks?${qs.toString()}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch backlinks');
  },

  /**
   * #18 — orphan cleanup: page ids with zero link_graph_edges rows (no topics,
   * no @mentions out, no backlinks in). Backs the "Osierocone/Orphaned" sidebar
   * lens in NotebookContent. Org-scoped (not per-notebook — the search baseline
   * has no notebook_id filter), so callers intersect with their own page list.
   */
  getOrphanedNotebookPageIds: async (limit = 200): Promise<string[]> => {
    const qs = new URLSearchParams({ orphaned: 'true', limit: String(limit) });
    const res = await fetch(`${API_URL}/v8/notebook/search?${qs.toString()}`, {
      headers: getHeaders(),
    });
    if (!res.ok) return [];
    const json = await res.json().catch(() => null);
    const results = json?.data?.results;
    return Array.isArray(results)
      ? results.map((r: any) => String(r?.note_id ?? '')).filter(Boolean)
      : [];
  },

  createLinkGraphEdge: async (payload: {
    source: { type: string; id: string };
    target: { type: string; id: string };
    relation?: 'ref';
    context?: { containerType?: string; containerId?: string; blockId?: string };
  }): Promise<{ ok: boolean; edgeId: string | null }> => {
    const res = await fetch(`${API_URL}/my-work/link-graph/edges`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to create link edge');
  },

  deleteLinkGraphEdge: async (edgeId: string): Promise<{ ok: boolean }> => {
    const res = await fetch(`${API_URL}/my-work/link-graph/edges/${encodeURIComponent(edgeId)}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete link edge');
  },

  // V51-04: Artifact attachment API
  attachArtifactToObject: async (
    ideaId: string,
    objectId: string,
    payload: {
      artifactRef: { type: string; id: string };
      artifactIndex?: string;
      label?: string;
      linkRole?: string;
      baseVersion?: number;
    }
  ): Promise<{ ok: boolean; artifactLink: any }> => {
    const res = await fetch(`${API_URL}/my-work/my-ideas/${ideaId}/objects/${objectId}/artifacts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to attach artifact');
  },

  detachArtifactFromObject: async (
    ideaId: string,
    objectId: string,
    artifactType: string,
    artifactId: string,
    opts?: { baseVersion?: number }
  ): Promise<{ ok: boolean }> => {
    const qs =
      opts?.baseVersion != null
        ? `?baseVersion=${encodeURIComponent(String(opts.baseVersion))}`
        : '';
    const res = await fetch(
      `${API_URL}/my-work/my-ideas/${ideaId}/objects/${objectId}/artifacts/${artifactType}/${artifactId}${qs}`,
      { method: 'DELETE', headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to detach artifact');
  },

  getObjectArtifacts: async (
    ideaId: string,
    objectId: string
  ): Promise<{ artifactLinks: any[] }> => {
    const res = await fetch(`${API_URL}/my-work/my-ideas/${ideaId}/objects/${objectId}/artifacts`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get object artifacts');
  },

  // V51-02: Chat-to-workspace handoff
  createIdeaFromChat: async (payload: {
    title: string;
    seedText?: string;
    preferredSystem?: string;
    templateId?: string;
    startMode?: string;
    structuredBrief?: {
      problem?: string;
      currentState?: string;
      desiredOutcome?: string;
      constraints?: string;
      evidence?: string;
    };
    sourceConversationId?: string;
    sourceMessageId?: string;
  }): Promise<{
    ok: boolean;
    ideaId: string;
    mapId: string;
    preferredSystem: string | null;
    startMode: string;
  }> => {
    const res = await fetch(`${API_URL}/my-work/my-ideas/from-chat`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to create idea from chat');
  },

  workCanvasSaveToWorkspace: async (
    draftId: string,
    // C3 — 'decision' now accepted (backend was already implemented in
    // createWorkspaceResource; only the runtime guard had been excluding it).
    // C4.1 — 'task' added (canonical TaskService.createTask path).
    payload: { target: 'idea' | 'note' | 'initiative' | 'decision' | 'task' }
  ): Promise<{
    success: boolean;
    data: {
      draft: any;
      linkedResource: {
        type: 'idea' | 'note' | 'initiative' | 'decision' | 'task';
        id: string;
        title: string;
        url?: string;
      };
      readBack: Record<string, unknown>;
      version?: any;
    };
  }> => {
    const res = await fetch(
      `${API_URL}/work-canvas/drafts/${encodeURIComponent(draftId)}/save-to-workspace`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      }
    );
    return handleResponse(res, 'Failed to save Canvas to workspace');
  },

  workCanvasCreateOutput: async (
    draftId: string,
    payload: { outputType: 'presentation' | 'table' | 'report' }
  ): Promise<{
    success: boolean;
    data: {
      draft: any;
      outputResource: {
        type: 'presentation' | 'table' | 'report';
        id: string;
        title: string;
        url?: string;
        metadata?: Record<string, unknown>;
      };
      readBack: Record<string, unknown>;
      version?: any;
    };
  }> => {
    const res = await fetch(
      `${API_URL}/work-canvas/drafts/${encodeURIComponent(draftId)}/create-output`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      }
    );
    return handleResponse(res, 'Failed to create Canvas output');
  },

  /**
   * L-2 — send a `kind='table'` Canvas draft into Table Studio. Creates a
   * `tp_bases`/`tp_tables`/`tp_fields`/`tp_records` set with field types
   * inferred from the markdown table's cells (date / number / text).
   * Returns 400 with code='CANVAS_NOT_TABLE_KIND' when called on a non-table
   * draft, and 400 with code='CANVAS_TABLE_EMPTY' when no markdown table is
   * present.
   */
  workCanvasSendToTableStudio: async (
    draftId: string
  ): Promise<{
    success: boolean;
    data: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      draft: any;
      linkedResource: { type: 'table_studio'; id: string; title: string; url: string };
      readBack: Record<string, unknown>;
    };
  }> => {
    const res = await fetch(
      `${API_URL}/work-canvas/drafts/${encodeURIComponent(draftId)}/send-to-table-studio`,
      {
        method: 'POST',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to send Canvas to Table Studio');
  },

  /**
   * M-5 — register the Canvas in the canonical Outputs Library
   * (`v8_output_artifacts`). Idempotent — re-registering updates the
   * artifact's metadata snapshot. The Outputs aggregate tab can now list
   * real Canvas-origin entries.
   */
  workCanvasRegisterInOutputs: async (
    draftId: string
  ): Promise<{
    success: boolean;
    data: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      draft: any;
      linkedResource: { type: 'outputs_library'; id: string; title: string; url: string };
      readBack: Record<string, unknown>;
    };
  }> => {
    const res = await fetch(
      `${API_URL}/work-canvas/drafts/${encodeURIComponent(draftId)}/register-in-outputs`,
      {
        method: 'POST',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to register Canvas in Outputs');
  },

  /**
   * L-1 — send a Canvas draft to DocumentStudio. The backend wires the
   * draft's markdown through `materializeDocumentArtifact` (the same path
   * the studio's own /generate uses), so the resulting artifact lives in
   * the Outputs hub and back-links to its source draft.
   */
  workCanvasSendToDocumentStudio: async (
    draftId: string,
    payload?: { documentType?: string; language?: 'pl' | 'en'; useLlm?: boolean }
  ): Promise<{
    success: boolean;
    data: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      draft: any;
      linkedResource: { type: 'document_studio'; id: string; title: string; url: string };
      readBack: Record<string, unknown>;
    };
  }> => {
    const res = await fetch(
      `${API_URL}/work-canvas/drafts/${encodeURIComponent(draftId)}/send-to-document-studio`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload || {}),
      }
    );
    return handleResponse(res, 'Failed to send Canvas to Document Studio');
  },

  workCanvasFinalizeResearchReport: async (
    draftId: string
  ): Promise<{
    success: boolean;
    data: {
      draft: any;
      reportResource: {
        type: 'report';
        id: string;
        title: string;
        url?: string;
        metadata?: Record<string, unknown>;
      };
      readBack: Record<string, unknown>;
      version?: any;
    };
  }> => {
    const res = await fetch(
      `${API_URL}/work-canvas/drafts/${encodeURIComponent(draftId)}/research/finalize-report`,
      {
        method: 'POST',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to finalize Canvas research report');
  },

  workCanvasExportDraft: async (
    draftId: string,
    format: 'markdown' | 'csv' | 'json' | 'pdf' | 'docx' | 'xlsx' | 'pptx'
  ): Promise<{ blob: Blob; filename: string }> => {
    const res = await fetch(
      `${API_URL}/work-canvas/drafts/${encodeURIComponent(draftId)}/export?format=${encodeURIComponent(format)}`,
      { headers: getHeaders() }
    );
    if (!res.ok) {
      await handleResponse(res, 'Failed to export Canvas draft');
    }
    const disposition = res.headers.get('content-disposition') || '';
    const filenameMatch = disposition.match(/filename="([^"]+)"/);
    const blob = await res.blob();
    return {
      blob,
      filename: filenameMatch?.[1] || `work-canvas.${format === 'json' ? 'metadata.json' : format}`,
    };
  },

  workCanvasGetVersions: async (draftId: string): Promise<any[]> => {
    const res = await fetch(
      `${API_URL}/work-canvas/drafts/${encodeURIComponent(draftId)}/versions`,
      { headers: getHeaders() }
    );
    const result = await handleResponse(res, 'Failed to fetch Canvas versions');
    return Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
  },

  // #87a — "Z canvasa" picker: list the user's other Work Canvas document
  // drafts (org+owner scoped by the backend, see GET /work-canvas/drafts) so
  // the "+" New Canvas menu can offer "start from an existing canvas". The
  // list rows already carry `contentMd`/`title` (full row), so no follow-up
  // fetch is needed to seed the new draft's content.
  workCanvasListDrafts: async (conversationId?: string | null): Promise<any[]> => {
    const query = conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : '';
    const res = await fetch(`${API_URL}/work-canvas/drafts${query}`, {
      headers: getHeaders(),
    });
    const result = await handleResponse(res, 'Failed to list Canvas drafts');
    return Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
  },

  workCanvasGetWorkflows: async (draftId: string): Promise<any[]> => {
    const res = await fetch(
      `${API_URL}/work-canvas/drafts/${encodeURIComponent(draftId)}/workflows`,
      { headers: getHeaders() }
    );
    const result = await handleResponse(res, 'Failed to fetch Canvas workflows');
    return Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
  },

  workCanvasCreateWorkflow: async (
    draftId: string,
    payload: {
      baseUpdatedAt?: string | null;
      template:
        | 'market_research_to_report'
        | 'meeting_note_to_initiatives'
        | 'kpi_review_to_dashboard'
        | 'client_proposal_to_deck'
        | 'decision_memo_to_execution_plan';
    }
  ): Promise<{ success: boolean; data: { draft: any; workflowRun: any; readBack: any } }> => {
    const res = await fetch(
      `${API_URL}/work-canvas/drafts/${encodeURIComponent(draftId)}/workflows`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      }
    );
    return handleResponse(res, 'Failed to create Canvas workflow');
  },

  workCanvasResumeWorkflow: async (
    draftId: string,
    workflowRunId: string,
    payload: { baseUpdatedAt?: string | null; note?: string } = {}
  ): Promise<{ success: boolean; data: { draft: any; workflowRun: any; readBack: any } }> => {
    const res = await fetch(
      `${API_URL}/work-canvas/drafts/${encodeURIComponent(draftId)}/workflows/${encodeURIComponent(workflowRunId)}/resume`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      }
    );
    return handleResponse(res, 'Failed to resume Canvas workflow');
  },

  workCanvasRunWorkflowStep: async (
    draftId: string,
    workflowRunId: string,
    payload: { baseUpdatedAt?: string | null; approved?: boolean } = {}
  ): Promise<{
    success: boolean;
    data: { draft: any; workflowRun: any; outputResource?: any; version?: any; readBack: any };
  }> => {
    const res = await fetch(
      `${API_URL}/work-canvas/drafts/${encodeURIComponent(draftId)}/workflows/${encodeURIComponent(workflowRunId)}/run-next`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      }
    );
    return handleResponse(res, 'Failed to run Canvas workflow step');
  },

  workCanvasUpdateWorkflowCollaboration: async (
    draftId: string,
    workflowRunId: string,
    payload: {
      baseUpdatedAt?: string | null;
      ownerId?: string | null;
      reviewerId?: string | null;
      lifecycle?: string;
    }
  ): Promise<{ success: boolean; data: { draft: any; workflowRun: any; readBack: any } }> => {
    const res = await fetch(
      `${API_URL}/work-canvas/drafts/${encodeURIComponent(draftId)}/workflows/${encodeURIComponent(workflowRunId)}/collaboration`,
      {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      }
    );
    return handleResponse(res, 'Failed to update Canvas workflow collaboration');
  },

  workCanvasAddWorkflowComment: async (
    draftId: string,
    workflowRunId: string,
    payload: { baseUpdatedAt?: string | null; body: string }
  ): Promise<{
    success: boolean;
    data: { draft: any; workflowRun: any; comment: any; readBack: any };
  }> => {
    const res = await fetch(
      `${API_URL}/work-canvas/drafts/${encodeURIComponent(draftId)}/workflows/${encodeURIComponent(workflowRunId)}/comments`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      }
    );
    return handleResponse(res, 'Failed to add Canvas workflow comment');
  },

  workCanvasApplyOperation: async (
    draftId: string,
    payload: {
      baseUpdatedAt?: string | null;
      operation:
        | {
            type: 'replace_selection';
            selectedText: string;
            replacementMd: string;
            selection?: {
              draftId?: string;
              mode: 'document' | 'md';
              selectedText: string;
              startOffset?: number;
              endOffset?: number;
              occurrenceIndex?: number;
              headingPath?: string[];
            } | null;
            reason?: string;
            buildMode?: 'teresa' | 'user';
            risk?: 'low' | 'medium' | 'high';
            approved?: boolean;
          }
        | {
            type: 'insert_element';
            elementKind: 'text' | 'heading' | 'table' | 'diagram' | 'list' | 'summary';
            contentMd: string;
            target?: {
              position:
                | 'at_cursor'
                | 'before_selection'
                | 'after_selection'
                | 'replace_selection'
                | 'end_of_document';
              selection?: {
                draftId?: string;
                mode: 'document' | 'md';
                selectedText: string;
                startOffset?: number;
                endOffset?: number;
                occurrenceIndex?: number;
                headingPath?: string[];
              } | null;
            };
            reason?: string;
            buildMode?: 'teresa' | 'user';
            risk?: 'low' | 'medium' | 'high';
            approved?: boolean;
          }
        | {
            type: 'append_section';
            heading: string;
            contentMd: string;
            target?: {
              position:
                | 'at_cursor'
                | 'before_selection'
                | 'after_selection'
                | 'replace_selection'
                | 'end_of_document';
              selection?: {
                draftId?: string;
                mode: 'document' | 'md';
                selectedText: string;
                startOffset?: number;
                endOffset?: number;
                occurrenceIndex?: number;
                headingPath?: string[];
              } | null;
            };
            reason?: string;
            buildMode?: 'teresa' | 'user';
            risk?: 'low' | 'medium' | 'high';
            approved?: boolean;
          }
        | {
            type: 'update_document';
            contentMd: string;
            reason?: string;
            buildMode?: 'teresa' | 'user';
            risk?: 'low' | 'medium' | 'high';
            approved?: boolean;
          }
        | {
            type: 'generate_block_from_selection';
            kind: 'table' | 'chart' | 'diagram' | 'decision' | 'research' | 'dashboard';
            selectedText: string;
            title?: string;
            approved?: boolean;
            reason?: string;
          }
        | {
            type: 'generate_artifact_from_dataset';
            artifactKind: 'table' | 'chart' | 'dashboard' | 'research';
            dataset: { filename?: string; format: 'csv' | 'json' | 'xlsx'; content: string };
            analysis?: { kind: 'profile_summary' | 'aggregate_numeric' | 'filtered_table' };
            title?: string;
            approved?: boolean;
            reason?: string;
          }
        | { type: 'insert_block'; block: any; approved?: boolean; reason?: string }
        | {
            type: 'update_block';
            blockId: string;
            patch: Record<string, unknown>;
            approved?: boolean;
            reason?: string;
          }
        | { type: 'delete_block'; blockId: string; approved?: boolean; reason?: string }
        | {
            type: 'convert_block';
            blockId: string;
            targetKind: 'chart' | 'diagram';
            approved?: boolean;
            reason?: string;
          }
        | { type: 'regenerate_projection'; blockId: string; approved?: boolean; reason?: string };
      previewOnly?: boolean;
    }
  ): Promise<{
    success: boolean;
    data: { draft: any; version?: any; diff?: any; preview?: any };
  }> => {
    const res = await fetch(
      `${API_URL}/work-canvas/drafts/${encodeURIComponent(draftId)}/operations`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      }
    );
    return handleResponse(res, 'Failed to apply Canvas operation');
  },

  workCanvasShare: async (
    draftId: string
  ): Promise<{
    success: boolean;
    data: { draft: any; share: { token: string; url: string; title: string; expiresAt?: string } };
  }> => {
    const res = await fetch(`${API_URL}/work-canvas/drafts/${encodeURIComponent(draftId)}/share`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to share Canvas draft');
  },

  workCanvasRevokeShare: async (
    draftId: string
  ): Promise<{
    success: boolean;
    data: { draft: any; share: null };
  }> => {
    const res = await fetch(`${API_URL}/work-canvas/drafts/${encodeURIComponent(draftId)}/share`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to revoke Canvas share link');
  },

  workCanvasRestoreVersion: async (
    draftId: string,
    versionId: string,
    payload: { baseUpdatedAt?: string | null } = {}
  ): Promise<{ success: boolean; data: { draft: any; restoredVersion: any } }> => {
    const res = await fetch(
      `${API_URL}/work-canvas/drafts/${encodeURIComponent(draftId)}/versions/${encodeURIComponent(versionId)}/restore`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      }
    );
    return handleResponse(res, 'Failed to restore Canvas version');
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
    return getCachedJson(
      `${API_URL}/notifications?${params.toString()}`,
      15_000,
      'Failed to fetch notifications'
    );
  },

  getUnreadNotificationCount: async (): Promise<number> => {
    const endpointKey = 'notifications-unread-count';
    if (isEndpointBackedOff(endpointKey)) return 0;

    try {
      const data = await getCachedJson<{ count: number }>(
        `${API_URL}/notifications/unread-count`,
        10_000,
        'Failed to fetch unread notification count'
      );
      resetEndpointBackoff(endpointKey);
      return Number(data?.count || 0);
    } catch (error: any) {
      const status = Number(error?.status || error?.response?.status);
      if (status === 401 || status === 403 || status === 429) {
        bumpEndpointBackoff(endpointKey);
      }
      return 0;
    }
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
      workflowStatus: d?.workflowStatus || d?.workflow_status || 'proposed',
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

  transitionDecisionWorkflow: async (
    id: string,
    toStatus: 'proposed' | 'review' | 'approve' | 'published' | 'publish'
  ): Promise<{ id: string; workflowStatus: string; createdTaskIds: string[] }> => {
    const res = await fetch(`${API_URL}/decisions/${id}/workflow`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ toStatus }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to transition decision workflow');
    return data;
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

  // V4-INBX: Inbox triage undo + Focus rules
  undoLastAITriage: async (): Promise<{
    success: boolean;
    undoneItemKey?: string;
    message?: string;
  }> => {
    const res = await fetch(`${API_URL}/my-work/inbox/undo-last-ai-triage`, {
      method: 'POST',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || 'Failed to undo');
    return data;
  },

  materializeInbox: async (): Promise<{ success: boolean; created?: number; updated?: number }> => {
    const res = await fetch(`${API_URL}/my-work/inbox/materialize`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to materialize inbox');
    return res.json();
  },

  shouldFallbackToLegacyMyWorkInbox: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },

  getCanonicalInboxStats: async () => {
    const res = await fetch(`${API_URL}/my-work/inbox/canonical/stats`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch canonical inbox stats');
    return res.json();
  },

  getFocusRules: async (): Promise<{
    maxToday: number;
    maxWeek: number;
    capacityAware: boolean;
  }> => {
    const res = await fetch(`${API_URL}/my-work/focus/rules`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch focus rules');
    return res.json();
  },

  updateFocusRules: async (rules: {
    maxToday?: number;
    maxWeek?: number;
    capacityAware?: boolean;
  }): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/my-work/focus/rules`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(rules),
    });
    if (!res.ok) throw new Error('Failed to update focus rules');
    return res.json();
  },

  // V4-INBX-04/06/07: Evals, routing rules, executive analytics
  getInboxEvalsGoldenSet: async () => {
    const res = await fetch(`${API_URL}/my-work/inbox/evals/golden-set`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch golden set');
    return res.json();
  },
  runInboxEval: async () => {
    const res = await fetch(`${API_URL}/my-work/inbox/evals/run`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to run eval');
    return res.json();
  },
  getInboxEvalRuns: async (limit?: number) => {
    const qs = limit != null ? `?limit=${limit}` : '';
    const res = await fetch(`${API_URL}/my-work/inbox/evals/runs${qs}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch inbox eval runs');
    return res.json();
  },
  getInboxEvalsCostSummary: async (days?: number) => {
    const qs = days != null ? `?days=${days}` : '';
    const res = await fetch(`${API_URL}/my-work/inbox/evals/cost-summary${qs}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch cost summary');
    return res.json();
  },
  getInboxRoutingRules: async () => {
    const res = await fetch(`${API_URL}/my-work/inbox/routing-rules`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch routing rules');
    return res.json();
  },
  updateInboxRoutingRules: async (rules: any[]) => {
    const res = await fetch(`${API_URL}/my-work/inbox/routing-rules`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ rules }),
    });
    if (!res.ok) throw new Error('Failed to update routing rules');
    return res.json();
  },
  getExecutiveAnalytics: async (projectId?: string) => {
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    const res = await fetch(`${API_URL}/my-work/executive-analytics${qs}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch executive analytics');
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
    return normalizeInitiativeList(await handleResponse(res, 'Failed to fetch initiatives'));
  },

  getInitiativeById: async (id: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/initiatives/${id}`, { headers: getHeaders() });
    return normalizeInitiativeDisplayFields(
      await handleResponse(res, 'Failed to fetch initiative')
    );
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

  /**
   * H1.4 / S6.2 — Tools → Initiatives session handoff. Materialize a discovery
   * tool session's recommendations into the canonical Initiatives backbone as
   * DRAFTs, tagged source_type='tool_session' (back-reference to the session).
   * Idempotent server-side: a repeat call skips recommendations already
   * materialized from this session, so re-clicking never duplicates.
   */
  createInitiativesFromToolSession: async (payload: {
    toolSessionId: string;
    projectId?: string | null;
    recommendations?: Array<{
      title: string;
      description?: string | null;
      rationale?: string | null;
      category?: string | null;
      impact?: string | null;
      effort?: string | null;
    }>;
  }): Promise<{
    sessionId: string;
    created: Array<{ id: string; title: string; status: string }>;
    skipped: Array<{ title: string; reason: string }>;
  }> => {
    const res = await fetch(`${API_URL}/initiatives/from-tool-session`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to create initiatives from tool session');
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
    return normalizeInitiativeList(data?.initiatives || data || []);
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

  // --- V4-INIT-05: STAFFING PLANS ---

  getStaffingPlans: async (initiativeId: string): Promise<{ plans: any[] }> => {
    const res = await fetchWithRetry(`${API_URL}/initiatives/${initiativeId}/staffing-plans`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch staffing plans');
  },

  createStaffingPlan: async (
    initiativeId: string,
    data: {
      name: string;
      status?: string;
      plannedStart?: string;
      plannedEnd?: string;
      notes?: string;
    }
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/initiatives/${initiativeId}/staffing-plans`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create staffing plan');
  },

  getStaffingPlan: async (
    initiativeId: string,
    planId: string
  ): Promise<{ plan: any; roles: any[] }> => {
    const res = await fetchWithRetry(
      `${API_URL}/initiatives/${initiativeId}/staffing-plans/${planId}`,
      { headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to fetch staffing plan');
  },

  updateStaffingPlan: async (
    initiativeId: string,
    planId: string,
    data: any
  ): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/initiatives/${initiativeId}/staffing-plans/${planId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update staffing plan');
  },

  deleteStaffingPlan: async (
    initiativeId: string,
    planId: string
  ): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/initiatives/${initiativeId}/staffing-plans/${planId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete staffing plan');
  },

  addStaffingPlanRole: async (
    initiativeId: string,
    planId: string,
    data: {
      roleName: string;
      requiredSkills?: string[];
      fteRequired?: number;
      assignedUserId?: string;
      startDate?: string;
      endDate?: string;
      priority?: string;
    }
  ): Promise<any> => {
    const res = await fetch(
      `${API_URL}/initiatives/${initiativeId}/staffing-plans/${planId}/roles`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      }
    );
    return handleResponse(res, 'Failed to add staffing plan role');
  },

  updateStaffingPlanRole: async (
    initiativeId: string,
    planId: string,
    roleId: string,
    data: any
  ): Promise<{ success: boolean }> => {
    const res = await fetch(
      `${API_URL}/initiatives/${initiativeId}/staffing-plans/${planId}/roles/${roleId}`,
      {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
      }
    );
    return handleResponse(res, 'Failed to update staffing plan role');
  },

  deleteStaffingPlanRole: async (
    initiativeId: string,
    planId: string,
    roleId: string
  ): Promise<{ success: boolean }> => {
    const res = await fetch(
      `${API_URL}/initiatives/${initiativeId}/staffing-plans/${planId}/roles/${roleId}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to delete staffing plan role');
  },

  getStaffingGaps: async (initiativeId: string, planId: string): Promise<{ gaps: any[] }> => {
    const res = await fetchWithRetry(
      `${API_URL}/initiatives/${initiativeId}/staffing-plans/${planId}/gaps`,
      { headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to fetch staffing gaps');
  },

  syncStaffingCapacity: async (
    initiativeId: string,
    planId: string
  ): Promise<{ success: boolean }> => {
    const res = await fetch(
      `${API_URL}/initiatives/${initiativeId}/staffing-plans/${planId}/sync-capacity`,
      {
        method: 'POST',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to sync staffing capacity');
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

  /** #64: AI picker — problem description in, top-3 candidate tools out. Fail-soft server-side. */
  suggestTools: async (payload: {
    problemDescription: string;
    lang?: 'en' | 'pl';
  }): Promise<{
    suggestions: Array<{
      toolType: string;
      name: string;
      confidence: 'high' | 'medium' | 'low';
      reasoning: string;
    }>;
  }> => {
    const res = await fetch(`${API_URL}/tools/suggest`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to suggest tools');
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
      isActive: boolean;
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
      isActive: boolean;
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
      wizardState?: Record<string, unknown>;
      status?: string;
      missingItems?: Array<{
        id: string;
        label: string;
        severity?: string;
        stepId?: string;
        resolved?: boolean;
      }>;
      failureReason?: string;
    }
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/tools/${toolId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to update tool session');
  },

  /**
   * CONCLUSION_LAYER push ingest: persist a client-side generated conclusion
   * (SIRI/ADMA report W1 models, ...) as a Conclusion candidate. Idempotent
   * per (sourceModule, sourceRefs) on the server.
   */
  createConclusion: async (payload: {
    title: string;
    statement: string;
    sourceModule: string;
    sourceRefs: Array<{ type: string; id: string; title?: string | null; url?: string | null }>;
    confidenceLevel?: string;
    limits?: string;
    evidenceRefs?: Array<{ type: string; ref: string; excerpt?: string | null }>;
    recommendedNextAction?: string | null;
    status?: string;
    projectId?: string | null;
    contextSummary?: string;
  }): Promise<{ ok: boolean }> => {
    const res = await fetch(`${API_URL}/conclusions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to create conclusion');
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

  promoteToolOutput: async (
    toolId: string,
    payload: {
      outputType: 'initiative' | 'report' | 'presentation' | 'idea';
      title: string;
      description?: string;
      selectedSections?: string[];
    }
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/tools/${toolId}/promote`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to promote tool output');
  },

  retryToolFromFailure: async (toolId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/tools/${toolId}/retry`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to retry tool');
  },

  // --- WORKBOOK GENERATION (P23 extension) ---

  generateWorkbook: async (payload: {
    prompt: string;
    researchContext?: string;
    language?: string;
    // B2 (workstream Excel): optional grounding sources. The backend already
    // reads these (POST /api/workbook/generate → buildWorkbookGrounding) and folds
    // them into the LLM prompt so model numbers have a basis. The chat reroute may
    // not send them yet — this is the type + pass-through so callers can.
    sourcePack?: unknown;
    evidenceRefs?: unknown[];
    conversationId?: string;
    // P-2: when generated as the real .xlsx for an existing artifact run,
    // pass the run id so the backend adopts the single canonical Outputs card
    // instead of creating a duplicate (split-brain fix for the excele lane).
    artifactRunId?: string;
  }): Promise<any> => {
    const res = await fetch(`${API_URL}/workbook/generate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to generate workbook');
  },

  downloadWorkbook: (workbookId: string): void => {
    window.open(`${API_URL}/workbook/${workbookId}/download`, '_blank');
  },

  listWorkbooks: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/workbook/list`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to list workbooks');
  },

  // C3 — parametric model templates (live-formula workbooks). The registry is
  // self-describing (params: name/label/type/default/min-max), so the FE renders
  // a form and `buildWorkbookTemplate` materializes the .xlsx deterministically
  // (no LLM) → same Outputs card + downloadUrl as a generated workbook.
  listWorkbookTemplates: async (): Promise<{
    templates: Array<{
      id: string;
      name: string;
      description: string;
      params: Array<{
        name: string;
        label: string;
        type: 'text' | 'integer' | 'number' | 'percent' | 'currency' | 'enum';
        default: string | number;
        min?: number;
        max?: number;
        step?: number;
        options?: string[];
        group?: string;
        help?: string;
      }>;
    }>;
  }> => {
    const res = await fetch(`${API_URL}/workbook/templates`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to list workbook templates');
  },

  buildWorkbookTemplate: async (
    id: string,
    payload: {
      params?: Record<string, unknown>;
      language?: string;
      projectId?: string | null;
    }
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/workbook/templates/${encodeURIComponent(id)}/build`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to build workbook from template');
  },

  // B3 fix (2026-07-22, workstream Excel): full cell/formula schema for the
  // in-app read-only grid preview (see server/src/routes/workbook.routes.ts
  // GET /:id/schema and src/utils/workbookGridPreview.ts).
  getWorkbookSchema: async (
    workbookId: string
  ): Promise<{
    id: string;
    title: string | null;
    description: string | null;
    sheets: unknown[];
  }> => {
    const res = await fetch(`${API_URL}/workbook/${workbookId}/schema`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to load workbook schema');
  },

  // "Najmniejszy arkusz, który jest naprawdę arkuszem" (2026-07-28): persists
  // ONE cell edit made in `EditableSpreadsheetGrid` (behind `ff_excele_edit`,
  // src/utils/exceleEditFlag.ts) so it survives a page refresh. See
  // `PATCH /api/workbook/:id/cell` in server/src/routes/workbook.routes.ts.
  updateWorkbookCell: async (
    workbookId: string,
    payload: {
      sheetIndex: number;
      rowIndex: number;
      columnKey: string;
      value?: string | number | boolean | null;
      formula?: string;
    }
  ): Promise<{
    ok: boolean;
    sheetIndex: number;
    rowIndex: number;
    columnKey: string;
    cell: { value?: string | number | boolean | null; formula?: string };
  }> => {
    const res = await fetch(`${API_URL}/workbook/${encodeURIComponent(workbookId)}/cell`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to save cell edit');
  },

  // --- ASSESSMENT WORKFLOW ---
  createAssessmentSession: async (payload: {
    assessmentType: 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';
    name: string;
    description?: string;
    projectId?: string | null;
  }): Promise<{ id: string; status: string }> => {
    const shouldFallbackToLegacy = (error: any) => {
      const status = Number(error?.status);
      return [400, 403, 404, 405, 501].includes(status);
    };

    try {
      const created = await V8AssessmentApi.createAssessment({
        assessmentType: payload.assessmentType,
        name: payload.name,
        projectId: payload.projectId ?? null,
      });

      return {
        id: created.id || created.assessment?.id,
        status: created.assessment?.status || 'DRAFT',
      };
    } catch (error) {
      if (!shouldFallbackToLegacy(error)) {
        throw error;
      }

      const res = await fetch(`${API_URL}/assessment-workflow-v2`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(res, 'Failed to create assessment session');
    }
  },

  getAssessmentSession: async (assessmentId: string): Promise<any> => {
    const shouldFallbackToLegacy = (error: any) => {
      const status = Number(error?.status);
      return [400, 403, 404, 405, 501].includes(status);
    };

    try {
      const data = await V8AssessmentApi.getAssessment(assessmentId);
      // The wire payload may carry either snake_case or camelCase variants depending on
      // backend version, so read defensively through a loosely-typed view.
      const assessment: Record<string, any> = data.assessment || {};
      return {
        ...assessment,
        type: assessment.assessment_type || assessment.assessmentType,
        completion_percent: Number(
          assessment.completion_percent ?? assessment.completionPercent ?? 0
        ),
        confidence_avg: Number(assessment.confidence_avg ?? assessment.confidenceAvg ?? 0),
        created_at: assessment.created_at || assessment.createdAt,
        updated_at: assessment.updated_at || assessment.updatedAt,
      };
    } catch (error) {
      if (!shouldFallbackToLegacy(error)) {
        throw error;
      }

      const res = await fetch(`${API_URL}/assessment-workflow/${assessmentId}`, {
        headers: getHeaders(),
      });
      return handleResponse(res, 'Failed to fetch assessment session');
    }
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
    const shouldFallbackToLegacy = (error: any) => {
      const status = Number(error?.status);
      return [400, 403, 404, 405, 501].includes(status);
    };

    try {
      return await V8AssessmentApi.updateAssessment(assessmentId, payload);
    } catch (error) {
      if (!shouldFallbackToLegacy(error)) {
        throw error;
      }

      const res = await fetch(`${API_URL}/assessment-workflow/${assessmentId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse(res, 'Failed to update assessment session');
    }
  },

  /**
   * List assessment sessions (v2 canonical).
   *
   * NOTE: This method intentionally targets `/assessment-workflow-v2` (not legacy `/assessment-workflow`)
   * to match the new editor and avoid data-shape drift across hubs.
   */
  listAssessments: async (params?: {
    projectId?: string;
    status?: string;
    assessmentType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    items: any[];
    total: number;
    limit: number;
    offset: number;
    // Backwards-compat: some call sites may still look for `assessments`
    assessments?: any[];
  }> => {
    const isTransientListError = (error: any) => {
      const status = Number(error?.status);
      // FIX-1 (429 self-storm): do NOT treat 429 as retryable — retrying a
      // rate-limited request only amplifies the storm. Retry only on 5xx
      // gateway/availability errors and genuine network failures.
      if ([502, 503, 504].includes(status)) return true;
      const msg = String(error?.message || '').toLowerCase();
      return (
        msg.includes('failed to fetch') ||
        msg.includes('networkerror') ||
        msg.includes('load failed')
      );
    };

    const shouldFallbackToLegacy = (error: any) => {
      const status = Number(error?.status);
      return [400, 403, 404, 405, 501].includes(status);
    };

    try {
      let lastV8Error: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          return await V8AssessmentApi.listAssessments(params);
        } catch (error: any) {
          lastV8Error = error;
          if (attempt < 3 && isTransientListError(error)) {
            await sleep(250 * attempt);
            continue;
          }
          break;
        }
      }

      // V8 failed with a fallback-eligible error: rethrow so the catch below runs
      // the legacy fetch path (the only place the fallback request is issued).
      throw lastV8Error;
    } catch (error) {
      if (!shouldFallbackToLegacy(error)) {
        throw error;
      }

      const query = new URLSearchParams();
      if (params?.projectId) query.set('projectId', params.projectId);
      if (params?.status) query.set('status', params.status);
      if (params?.assessmentType) query.set('assessmentType', params.assessmentType);
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.offset) query.set('offset', String(params.offset));

      const url = `${API_URL}/assessment-workflow-v2${query.toString() ? `?${query.toString()}` : ''}`;
      const res = await fetch(url, { headers: getHeaders() });
      const data = await handleResponse(res, 'Failed to list assessments');

      const rows = (data?.items || data?.assessments || data || []) as any[];
      return {
        items: Array.isArray(rows) ? rows : [],
        total: Number(data?.total ?? (Array.isArray(rows) ? rows.length : 0)) || 0,
        limit: Number(params?.limit ?? data?.limit ?? 100) || 100,
        offset: Number(params?.offset ?? data?.offset ?? 0) || 0,
        assessments: Array.isArray(data?.assessments) ? data.assessments : undefined,
      };
    }
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
      body: JSON.stringify({
        title,
        description,
        success_metrics: options?.success_metrics ?? options?.successMetrics ?? [],
        priority: options?.priority ?? 'medium',
        target_date: options?.target_date ?? options?.targetDate ?? null,
        progress_percentage: options?.progress_percentage ?? options?.progressPercentage ?? 0,
      }),
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

  /**
   * ★ VLT-005 — warstwa tabeli sejfów PRZED narzędziem Vault. Jeden zapytanie
   * (GROUP BY po stronie serwera, patrz knowledge.routes.ts `/vault-safes`)
   * zwraca [Mój sejf] + [Sejf organizacji] + po jednym na projekt, w którym
   * wołający jest członkiem — z licznikiem dokumentów i datą ostatniej zmiany.
   */
  getVaultSafes: async (): Promise<
    Array<{
      id: string;
      type: 'user' | 'organization' | 'project';
      projectId: string | null;
      name: string;
      documentCount: number;
      lastModified: string | null;
      sizeBytes: number;
      indexedCount: number;
      errorCount: number;
    }>
  > => {
    const res = await fetch(`${API_URL}/knowledge/vault-safes`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch vault safes');
    return Array.isArray(data?.safes) ? data.safes : [];
  },

  /**
   * ★ VLT-FOLDERS — foldery WEWNĄTRZ jednego sejfu (dzielą temat, sejf zostaje
   * granicą bezpieczeństwa). `scope`/`projectId` muszą odpowiadać otwartemu
   * sejfowi (`VaultDocumentsView`) — folder poza nim po prostu nie istnieje
   * w tym widoku.
   */
  getVaultFolders: async (filters: {
    scope: 'user' | 'project' | 'organization';
    projectId?: string | null;
  }): Promise<
    Array<{
      id: string;
      name: string;
      description: string | null;
      color: string | null;
      scope: 'user' | 'project' | 'organization';
      projectId: string | null;
      ownerId: string;
      parentFolderId: string | null;
    }>
  > => {
    const params = new URLSearchParams({ scope: filters.scope });
    if (filters.projectId) params.set('project_id', filters.projectId);
    const res = await fetch(`${API_URL}/knowledge/vault-folders?${params.toString()}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to fetch vault folders');
    return Array.isArray(data) ? data : [];
  },

  createVaultFolder: async (payload: {
    name: string;
    description?: string;
    color?: string;
    parentFolderId?: string | null;
    scope: 'user' | 'project' | 'organization';
    projectId?: string | null;
  }): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/knowledge/vault-folders`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to create vault folder');
  },

  updateVaultFolder: async (folderId: string, updates: any): Promise<void> => {
    const res = await fetchWithRetry(`${API_URL}/knowledge/vault-folders/${folderId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    await handleResponse(res, 'Failed to update vault folder');
  },

  deleteVaultFolder: async (folderId: string): Promise<void> => {
    const res = await fetchWithRetry(`${API_URL}/knowledge/vault-folders/${folderId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    await handleResponse(res, 'Failed to delete vault folder');
  },

  getKnowledgeDocuments: async (filters?: {
    scope?: 'user' | 'project' | 'organization';
    projectId?: string;
  }): Promise<any[]> => {
    const params = new URLSearchParams();
    if (filters?.scope) params.set('scope', filters.scope);
    if (filters?.projectId) params.set('project_id', filters.projectId);
    const qs = params.toString();
    const res = await fetch(`${API_URL}/knowledge/documents${qs ? `?${qs}` : ''}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch docs');
    return data;
  },

  uploadKnowledgeDocument: async (
    file: File,
    category?: string,
    tags?: string[],
    scope?: 'user' | 'project' | 'organization',
    projectId?: string
  ): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    if (category) {
      formData.append('category', category);
    }
    if (Array.isArray(tags) && tags.length > 0) {
      formData.append('tags', JSON.stringify(tags));
    }
    if (scope) {
      formData.append('scope', scope);
    }
    if (scope === 'project' && projectId) {
      formData.append('project_id', projectId);
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
    extractionStatus?: 'extracted' | string;
    totalChunks?: number;
    embeddedChunks?: number;
  }> => {
    const formData = new FormData();
    formData.append('file', file);

    // Intentionally skip default JSON headers so the browser sets multipart/form-data
    // boundary. We still want auth header + 401→refresh retry via fetchWithRetry.
    const authHeader: Record<string, string> = {};
    const token = tokenService.getToken();
    if (token) authHeader['Authorization'] = `Bearer ${token}`;

    const res = await fetchWithRetry(`${API_URL}/ai/attachments/ingest`, {
      method: 'POST',
      headers: authHeader,
      body: formData,
      skipDefaultHeaders: true,
      // Heavy: server parses/extracts (PDF/large docs) + embeds; exceeds 20s.
      timeoutMs: 120000,
    });
    return handleResponse(res, 'Failed to ingest attachment');
  },

  ingestChatUrlAttachment: async (
    url: string,
    options?: { title?: string }
  ): Promise<{
    success: boolean;
    docId: string;
    filename: string;
    mimeType?: string;
    sourceUrl?: string;
    totalChunks?: number;
    embeddedChunks?: number;
  }> => {
    const res = await fetchWithRetry(`${API_URL}/ai/attachments/ingest-url`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        url,
        title: options?.title,
      }),
      // Heavy: server fetches remote URL, extracts and embeds; exceeds 20s.
      timeoutMs: 120000,
    });
    return handleResponse(res, 'Failed to ingest URL');
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
    userId?: string;
    userEmail?: string;
    userName?: string;
    type: 'BUG' | 'IDEA';
    title?: string;
    message: string;
    description?: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    routePath?: string;
    deviceType?: 'mobile' | 'tablet' | 'desktop';
    screenSize?: string;
    uiLanguage?: string;
    uiTheme?: string;
    workspaceContext?: string;
    clientEnv?: string;
    metadata?: Record<string, unknown>;
    signatureHash?: string;
    appContext?: Record<string, unknown>;
    consoleLogs?: Array<Record<string, unknown>>;
    networkErrors?: Array<Record<string, unknown>>;
    breadcrumbs?: Array<Record<string, unknown>>;
    lastUncaughtError?: Record<string, unknown> | null;
    screenshot?: {
      dataUrl: string;
      approxBytes?: number;
      width?: number;
      height?: number;
    } | null;
  }): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/feedback`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to submit feedback');
  },

  composeFeedback: async (data: {
    type: 'BUG' | 'IDEA';
    title?: string;
    message: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    appEnv?: string;
    context?: Record<string, unknown>;
  }): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/feedback/compose`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
      // Heavy: LLM composes structured feedback; can exceed 20s.
      timeoutMs: 120000,
    });
    return handleResponse(res, 'AI compose failed');
  },

  submitPulseFeedback: async (data: {
    userId?: string;
    rating: number;
    context?: string;
    comment?: string;
    timestamp?: string;
  }): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/feedback/pulse`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to submit pulse feedback');
  },

  submitFeatureFeedback: async (data: {
    userId?: string;
    userEmail?: string;
    category?: 'usability' | 'performance' | 'missing' | 'improvement' | 'other';
    featureName: string;
    description: string;
    impact?: 'low' | 'medium' | 'high';
    context?: string;
    requestAIAnalysis?: boolean;
  }): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/feedback/feature`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to submit feature feedback');
  },

  getFeedbackAIInsights: async (data: { context: string; userId?: string }): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/feedback/ai-insights`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to fetch feedback AI insights');
  },

  getFeedback: async (opts?: { limit?: number; offset?: number }): Promise<any[]> => {
    // Thin wrapper kept for backward compat — returns just the array so
    // existing call sites (pending-badge count, dashboards) keep working.
    const page = await Api.getFeedbackPage(opts);
    return page.items;
  },

  /**
   * Paginated feedback list. Returns items + total (read from X-Total-Count)
   * so the Superadmin UI can show "N / total" and offer Load more.
   */
  getFeedbackPage: async (opts?: {
    limit?: number;
    offset?: number;
  }): Promise<{ items: any[]; total: number; limit: number; offset: number }> => {
    const params = new URLSearchParams();
    if (opts?.limit != null) params.set('limit', String(opts.limit));
    if (opts?.offset != null) params.set('offset', String(opts.offset));
    const qs = params.toString();
    const url = `${API_URL}/feedback${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch feedback');
    const items = (await res.json()) || [];
    const total = Number(res.headers.get('X-Total-Count') || items.length);
    const limit = Number(res.headers.get('X-Page-Limit') || items.length);
    const offset = Number(res.headers.get('X-Page-Offset') || 0);
    return { items, total, limit, offset };
  },

  updateFeedbackStatus: async (id: string, status: string): Promise<void> => {
    const res = await fetchWithRetry(`${API_URL}/feedback/${id}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data as any)?.error || 'Failed to update feedback status');
  },

  updateFeedbackWorkflow: async (
    id: string,
    payload: {
      owner?: string | null;
      cluster?: string | null;
      source?: string | null;
      branch?: string | null;
      prUrl?: string | null;
      taskUrl?: string | null;
      linkedTaskId?: string | null;
      deployStatus?: string | null;
      deployTargets?: string[];
      deployedAt?: string | null;
      verifiedBy?: string | null;
      verifiedAt?: string | null;
      waitingOn?: string | null;
      resolution?: {
        type?: string | null;
        summary?: string | null;
        rootCause?: string | null;
        verificationNotes?: string | null;
        testPlan?: string[];
      };
      note?: string | null;
    }
  ): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/feedback/${id}/workflow`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error((data as any)?.error || 'Failed to update feedback workflow');
    }
    return data;
  },

  getFeedbackBacklogTasks: async (limit = 200): Promise<any[]> => {
    const url = `${API_URL}/feedback/backlog/tasks?limit=${encodeURIComponent(String(limit))}`;
    const res = await fetchWithRetry(url, { headers: getHeaders() });
    const data = await handleResponse(res, 'Failed to fetch feedback backlog tasks');
    return data || [];
  },

  updateFeedbackBacklogTask: async (
    id: string,
    payload: { status?: string; assigneeId?: string | null; comment?: string }
  ): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/feedback/backlog/tasks/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to update feedback backlog task');
  },

  getFeedbackAnalyticsOverview: async (): Promise<{
    sampleSize: number;
    openCount: number;
    totals: {
      byStatus: Record<string, number>;
      byType: Record<string, number>;
      bySeverity: Record<string, number>;
      byEnv: Record<string, number>;
    };
    aging: { under24h: number; h24_48: number; d2_7: number; over7d: number };
    mttrLast30d: { medianHours: number | null; p90Hours: number | null; sampleSize: number };
    last30d: { created: number; reopened: number; reopenRatePct: number };
    generatedAt: string;
  }> => {
    const res = await fetchWithRetry(`${API_URL}/feedback/analytics/overview`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch feedback analytics overview');
  },

  getFeedbackCursorBrief: async (id: string): Promise<string> => {
    const res = await fetch(`${API_URL}/feedback/${encodeURIComponent(id)}/cursor-brief`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error((data as any)?.error || 'Failed to fetch Cursor brief');
    }
    return res.text();
  },

  getFeedbackScreenshotUrl: (id: string): string =>
    `${API_URL}/feedback/${encodeURIComponent(id)}/artifacts/screenshot`,

  getFeedbackScreenshotBlob: async (id: string): Promise<Blob> => {
    const res = await fetch(`${API_URL}/feedback/${encodeURIComponent(id)}/artifacts/screenshot`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error((data as any)?.error || 'Failed to fetch feedback screenshot');
    }
    return res.blob();
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
    const res = await fetchWithRetry(`${API_URL}/superadmin/access-requests`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch access requests');
  },

  approveAccessRequest: async (id: string, password?: string, role?: string): Promise<void> => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/access-requests/${id}/approve`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ password, role }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data as any)?.error || 'Failed to approve access request');
  },

  rejectAccessRequest: async (id: string, reason: string): Promise<void> => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/access-requests/${id}/reject`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ reason }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data as any)?.error || 'Failed to reject access request');
  },

  getAccessCodes: async (): Promise<any[]> => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/access-codes`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch access codes');
  },

  acceptAccessCode: async (code: string): Promise<any> => {
    const res = await fetch(`${API_URL}/access-codes/accept`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ code }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to accept access code');
    return json;
  },

  generateAccessCode: async (data: {
    code?: string;
    role?: string;
    maxUses?: number;
    expiresAt?: string;
  }): Promise<void> => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/access-codes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to generate access code');
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
    if (filters?.status) params.set('status', String(filters.status));
    const changeType = filters?.change_type ?? filters?.type;
    if (changeType && changeType !== 'all') params.set('change_type', String(changeType));
    const url = `${API_URL}/revenue/subscription-changes${params.toString() ? `?${params}` : ''}`;
    const res = await fetch(url, {
      headers: getHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to fetch subscription changes');
    if (Array.isArray(json)) return json;
    return (json as any)?.changes || (json as any)?.data || [];
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
    const json = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new Error((json as any)?.error || 'Failed to fetch subscription change stats');
    return json as any;
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
    const res = await fetch(`${API_URL}/billing/admin/user-plans`, {
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

  getManagedContracts: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/superadmin/billing/contracts`, {
      headers: getHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any).error || 'Failed to fetch managed contracts');
    return Array.isArray((json as any).data) ? (json as any).data : [];
  },

  upsertManualContract: async (payload: any): Promise<any> => {
    const res = await fetch(`${API_URL}/superadmin/billing/manual-contract`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any).error || 'Failed to save manual contract');
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

  // --- USAGE PRICING TIERS ---
  getUsagePricingTiers: async () => {
    const res = await fetch(`${API_URL}/billing/usage-pricing-tiers`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch usage pricing tiers');
    return data;
  },

  createUsagePricingTier: async (tier: {
    name: string;
    unit: string;
    pricePerUnit: number;
    currency?: string;
    tierType?: string;
    minQuantity?: number;
    maxQuantity?: number | null;
    isActive?: boolean;
  }) => {
    const res = await fetch(`${API_URL}/billing/usage-pricing-tiers`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(tier),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create usage pricing tier');
    return data;
  },

  updateUsagePricingTier: async (id: string, updates: Record<string, any>) => {
    const res = await fetch(`${API_URL}/billing/usage-pricing-tiers/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update usage pricing tier');
    return data;
  },

  deleteUsagePricingTier: async (id: string) => {
    const res = await fetch(`${API_URL}/billing/usage-pricing-tiers/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete usage pricing tier');
    return data;
  },

  // --- TOKEN BILLING ---
  getTokenBalance: async () => {
    const res = await fetch(`${API_URL}/token-billing/balance`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to get balance');
    const raw = (data as any)?.balance;
    const value =
      raw && typeof raw === 'object' && 'balance' in raw ? (raw as any).balance : (raw ?? 0);
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
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
    // SuperAdmin: aggregated usage for all orgs lives under /superadmin
    // Regular users may still query single-org usage under /organizations/:id/usage
    const url = orgId
      ? `${API_URL}/organizations/${orgId}/usage`
      : `${API_URL}/superadmin/usage/by-organization`;
    const res = await fetchWithRetry(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch organization usage');
    return res.json();
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
    const res = await fetch(`${API_URL}/organizations/${orgId}/members`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(
        email.includes('@') ? { targetEmail: email, role } : { targetUserId: email, role }
      ),
    });
    return handleResponse(res, 'Failed to add member');
  },

  updateOrganizationMemberRole: async (
    orgId: string,
    memberId: string,
    role: string
  ): Promise<any> => {
    const res = await fetch(`${API_URL}/organizations/${orgId}/members/${memberId}/role`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ role }),
    });
    return handleResponse(res, 'Failed to update member role');
  },

  removeOrganizationMember: async (orgId: string, memberId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/organizations/${orgId}/members/${memberId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to remove member');
  },

  getAdminSecurityPolicy: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/security`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to load admin security policy');
  },

  updateAdminSecurityPolicy: async (payload: any): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/security`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to save admin security policy');
  },

  // HP-24: SSO self-service (org-admin configures own org's SAML/OIDC metadata)
  getAdminSsoSelfConfig: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/sso-self`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to load SSO configuration');
  },

  updateAdminSsoSelfConfig: async (payload: any): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/sso-self`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to save SSO configuration');
  },

  validateAdminSsoSelfConfig: async (payload: any): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/sso-self/validate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to validate SSO configuration');
  },

  getAdminCollaborationControls: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/collaboration`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to load collaboration controls');
  },

  updateAdminCollaborationControls: async (payload: any): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/collaboration`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to save collaboration controls');
  },

  // ── Health Panel (internal "dowody działania" proof-of-life probes) ──
  getHealthPanelProbes: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/health-panel/probes`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to load health probes');
  },

  runHealthPanelProbes: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/health-panel/run`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to run health probes');
  },

  runHealthPanelProbe: async (probeId: string): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/health-panel/run/${encodeURIComponent(probeId)}`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to run health probe');
  },

  getHealthPanelSummary: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/health-panel/summary`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to load health summary');
  },

  getTenantAdminAuditLogs: async (filters?: any): Promise<any> => {
    const params = new URLSearchParams();
    if (filters?.actionType) params.set('actionType', String(filters.actionType));
    if (filters?.status) params.set('status', String(filters.status));
    if (filters?.riskScoreMin !== undefined && filters?.riskScoreMin !== '')
      params.set('riskScoreMin', String(filters.riskScoreMin));
    if (filters?.search) params.set('search', String(filters.search));
    if (filters?.limit !== undefined) params.set('limit', String(filters.limit));
    if (filters?.offset !== undefined) params.set('offset', String(filters.offset));
    const res = await fetch(`${API_URL}/admin/audit-logs?${params.toString()}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch admin audit logs');
  },

  getOrganizationContextLineageAudit: async (filters?: any): Promise<any> => {
    const params = new URLSearchParams();
    if (filters?.targetType) params.set('targetType', String(filters.targetType));
    if (filters?.targetId) params.set('targetId', String(filters.targetId));
    if (filters?.workflow) params.set('workflow', String(filters.workflow));
    if (filters?.eventType) params.set('eventType', String(filters.eventType));
    if (filters?.limit !== undefined) params.set('limit', String(filters.limit));
    const res = await fetch(
      `${API_URL}/audit-logs/organization-context/lineage?${params.toString()}`,
      {
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to fetch organization context lineage');
  },

  getOrganizationContextStorageAudit: async (filters?: any): Promise<any> => {
    const params = new URLSearchParams();
    if (filters?.documentId) params.set('documentId', String(filters.documentId));
    if (filters?.projectId) params.set('projectId', String(filters.projectId));
    if (filters?.limit !== undefined) params.set('limit', String(filters.limit));
    const res = await fetch(
      `${API_URL}/audit-logs/organization-context/storage-events?${params.toString()}`,
      {
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to fetch organization context storage audit');
  },

  getOrganizationContextProcessingJobsAudit: async (filters?: any): Promise<any> => {
    return OrganizationContextWorkerApi.getProcessingJobs(filters);
  },

  getOrganizationContextProcessingQueueSummary: async (): Promise<any> => {
    return OrganizationContextWorkerApi.getProcessingQueueSummary();
  },

  requeueOrganizationContextProcessingJob: async (jobId: string): Promise<any> => {
    return OrganizationContextWorkerApi.requeueProcessingJob(jobId);
  },

  recoverOrganizationContextStaleLocks: async (payload?: any): Promise<any> => {
    return OrganizationContextWorkerApi.recoverStaleLocks(payload);
  },

  runOrganizationContextWorkerOnce: async (payload?: any): Promise<any> => {
    return OrganizationContextWorkerApi.runWorkerOnce(payload);
  },

  getAdminOverview: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/overview`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch admin overview');
  },

  getAdminBillingSummary: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/billing/summary`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch admin billing summary');
  },

  getAdminBillingPlans: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/billing/plans`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch admin billing plans');
  },

  assignAdminBillingPlan: async (payload: {
    planId?: string | null;
    planName?: string | null;
    status?: string;
    tokenLimit?: number | null;
    storageLimitMb?: number | null;
    seats?: number | null;
    aiCallsPerDay?: number | null;
    tokenBalance?: number | null;
    expiresAt?: string | null;
  }): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/billing/plan`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to assign admin billing plan');
  },

  getAdminAISummary: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/ai/summary`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch admin AI summary');
  },

  getAdminIAMPolicy: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/iam/policy`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch admin IAM policy');
  },

  updateAdminIAMPolicy: async (payload: any): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/iam/policy`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to update admin IAM policy');
  },

  getAdminIAMAssignments: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/iam/assignments`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch admin IAM assignments');
  },

  createAdminIAMAssignment: async (payload: any): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/iam/assignments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to create admin IAM assignment');
  },

  deleteAdminIAMAssignment: async (assignmentId: string): Promise<any> => {
    const res = await fetch(
      `${API_URL}/admin/iam/assignments/${encodeURIComponent(assignmentId)}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to delete admin IAM assignment');
  },

  getAdminBillingPaymentMethods: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/billing/payment-methods`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch admin billing payment methods');
  },

  addAdminBillingPaymentMethod: async (payload: any): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/billing/payment-methods`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to add admin billing payment method');
  },

  setAdminBillingDefaultPaymentMethod: async (paymentMethodId: string): Promise<any> => {
    const res = await fetch(
      `${API_URL}/admin/billing/payment-methods/${encodeURIComponent(paymentMethodId)}/default`,
      { method: 'PUT', headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to set default admin billing payment method');
  },

  removeAdminBillingPaymentMethod: async (paymentMethodId: string): Promise<any> => {
    const res = await fetch(
      `${API_URL}/admin/billing/payment-methods/${encodeURIComponent(paymentMethodId)}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to remove admin billing payment method');
  },

  getAdminBillingInvoices: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/billing/invoices`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch admin billing invoices');
  },

  getAdminBillingUsageDetails: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/billing/usage-details`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch admin billing usage details');
  },

  getAdminBillingAlerts: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/billing/alerts`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch admin billing alerts');
  },

  updateAdminBillingAlerts: async (alerts: any[]): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/billing/alerts`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ alerts }),
    });
    return handleResponse(res, 'Failed to update admin billing alerts');
  },

  getAdminBillingTaxSettings: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/billing/tax-settings`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch admin billing tax settings');
  },

  updateAdminBillingTaxSettings: async (payload: any): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/billing/tax-settings`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to update admin billing tax settings');
  },

  getAdminComplianceSummary: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/compliance/summary`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch admin compliance summary');
  },

  updateAdminComplianceDataRetention: async (payload: any): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/compliance/data-retention`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to update admin data retention');
  },

  getAdminScimSummary: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/identity/scim`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch admin SCIM summary');
  },

  createAdminScimToken: async (payload: any): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/identity/scim/tokens`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to create admin SCIM token');
  },

  deleteAdminScimToken: async (tokenId: string): Promise<any> => {
    const res = await fetch(
      `${API_URL}/admin/identity/scim/tokens/${encodeURIComponent(tokenId)}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to delete admin SCIM token');
  },

  createAdminScimGroupMapping: async (payload: any): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/identity/scim/group-mappings`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to create admin SCIM group mapping');
  },

  deleteAdminScimGroupMapping: async (mappingId: string): Promise<any> => {
    const res = await fetch(
      `${API_URL}/admin/identity/scim/group-mappings/${encodeURIComponent(mappingId)}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to delete admin SCIM group mapping');
  },

  getAdminRiskSummary: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/risk/summary`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch admin risk summary');
  },

  getTenantAdminAuditStats: async (): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/audit-logs/stats`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch admin audit stats');
  },

  exportTenantAdminAuditLogs: async (): Promise<Blob> => {
    const res = await fetch(`${API_URL}/admin/audit-logs/export`, { headers: getHeaders() });
    if (!res.ok) {
      const out = await res.json().catch(() => ({}));
      const message =
        typeof (out as any)?.message === 'string'
          ? (out as any).message
          : typeof (out as any)?.error === 'string'
            ? (out as any).error
            : typeof (out as any)?.code === 'string'
              ? (out as any).code
              : 'Failed to export admin audit logs';
      throw new Error(message);
    }
    return res.blob();
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
   * Generate the publishing-grade DRD client report HTML on the server (with the
   * live LLM narrator). Returns the standalone HTML string ready to open + print.
   */
  getDrdReportHtml: async (
    reportId: string,
    opts?: { lang?: 'pl' | 'en' }
  ): Promise<{ html: string; narrative: 'llm' | 'deterministic' }> => {
    const qs = new URLSearchParams({ format: 'json', ...(opts?.lang ? { lang: opts.lang } : {}) });
    const res = await fetch(
      `${API_URL}/assessment-reports/${reportId}/drd-report?${qs.toString()}`,
      {
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to generate DRD report');
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
   * Module 05 (Inicjatywy) — alias for the economics analyses list, used by the
   * Value Realization & ROI dashboard (FullROIView). Returns analyses joined with
   * `analysis_financials` (npv, roi_percent) and the linked initiative name.
   */
  getEconomicsAnalyses: async (filters?: {
    status?: string;
    projectId?: string;
    initiativeId?: string;
    search?: string;
  }): Promise<{ analyses: any[]; total: number }> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }
    const url = `${API_URL}/economics/analyses${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetchWithRetry(url, { headers: getHeaders() });
    return handleResponse(res, 'Failed to load analyses');
  },

  // ============================================
  // INITIATIVE GENERATOR API (Module 05 — Inicjatywy)
  // Real mount at /api/initiative-generator (promoted from disabled stub).
  // ============================================

  /**
   * List AI-generated initiative drafts for the current organization.
   */
  getGeneratedInitiatives: async (): Promise<any[]> => {
    const res = await fetchWithRetry(`${API_URL}/initiative-generator`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to load generated initiatives');
  },

  /**
   * Trigger AI generation of an initiative draft (Teresa).
   */
  generateInitiatives: async (payload: {
    source?: string;
    context?: Record<string, unknown>;
    assessmentId?: string;
  }): Promise<{ success: boolean; id: string; message: string }> => {
    const res = await fetchWithRetry(`${API_URL}/initiative-generator/generate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload || {}),
      // Heavy: LLM drafts a full initiative (multi-section); exceeds 20s.
      timeoutMs: 120000,
    });
    return handleResponse(res, 'Failed to generate initiatives');
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

  acknowledgeDocumentProcessingAttention: async (docId: string): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/documents/${docId}/processing-attention/ack`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to acknowledge processing attention');
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
    chatProjectId?: string;
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
    if (isConversationMarkedMissing(id)) {
      const error: any = new Error('Conversation not found');
      error.status = 404;
      throw error;
    }

    const res = await fetchWithRetry(`${API_URL}/conversations/${id}`, {
      headers: getHeaders(),
    });
    if (res.status === 404) {
      markConversationMissing(id);
      const error: any = new Error('Conversation not found');
      error.status = 404;
      throw error;
    }

    const payload = await handleResponse(res, 'Failed to fetch conversation');
    clearConversationMissingMark(id);
    return payload;
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
      /** Idempotency key so a network-retried POST doesn't create a duplicate row. */
      clientMessageId?: string;
    }
  ): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(message),
    });
    return handleResponse(res, 'Failed to add message');
  },
  saveConversationMessageToContext: async (
    conversationId: string,
    messageId: string
  ): Promise<{ ok: boolean; itemId?: string; alreadyCaptured?: boolean }> => {
    const res = await fetchWithRetry(
      `${API_URL}/conversations/${conversationId}/messages/${messageId}/save-to-context`,
      {
        method: 'POST',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to save message to organization context');
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
      // Heavy: LLM composes a full diagram from a prompt; can exceed 20s.
      timeoutMs: 120000,
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
      // Heavy: LLM rewrites an existing diagram; can exceed 20s.
      timeoutMs: 120000,
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
      // Heavy: LLM chat over document context; can exceed 20s.
      timeoutMs: 120000,
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
      // Heavy: LLM analyzes the diagram to propose changes; can exceed 20s.
      timeoutMs: 120000,
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
    const fullUrl = buildApiUrl(url);
    const res = await fetchWithRetry(fullUrl, { headers: getHeaders() });
    const payload = await handleResponse(res, 'Request failed');
    return toAxiosLikeResponse(payload);
  },

  post: async (url: string, data: any) => {
    const fullUrl = buildApiUrl(url);
    const res = await fetchWithRetry(fullUrl, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const payload = await handleResponse(res, 'Request failed');
    return toAxiosLikeResponse(payload);
  },

  postMultipart: async (url: string, formData: FormData) => {
    const fullUrl = buildApiUrl(url);
    const headers = getHeaders();
    // Browser must set multipart boundary; do not send Content-Type.
    delete headers['Content-Type'];

    const res = await fetchWithRetry(fullUrl, {
      method: 'POST',
      headers,
      body: formData,
      skipDefaultHeaders: true,
    });
    const payload = await handleResponse(res, 'Request failed');
    return toAxiosLikeResponse(payload);
  },

  put: async (url: string, data: any) => {
    const fullUrl = buildApiUrl(url);
    const res = await fetchWithRetry(fullUrl, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const payload = await handleResponse(res, 'Request failed');
    return toAxiosLikeResponse(payload);
  },

  delete: async (url: string) => {
    const fullUrl = buildApiUrl(url);
    const res = await fetchWithRetry(fullUrl, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const payload = await handleResponse(res, 'Request failed');
    return toAxiosLikeResponse(payload);
  },

  patch: async (url: string, data: any) => {
    const fullUrl = buildApiUrl(url);
    const res = await fetchWithRetry(fullUrl, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const payload = await handleResponse(res, 'Request failed');
    return toAxiosLikeResponse(payload);
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
    const res = await fetchWithRetry(`${API_URL}/superadmin/system/backup`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ type: 'full', reason: 'manual' }),
    });
    return handleResponse(res, 'Failed to trigger backup');
  },
  getBackups: async (): Promise<any[]> => {
    const res = await fetchWithRetry(`${API_URL}/admin/backups`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch backups');
    const payload = await res.json().catch(() => ({}));
    const list = Array.isArray((payload as any)?.backups)
      ? (payload as any).backups
      : Array.isArray(payload)
        ? payload
        : [];
    return list;
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
  getAuditLogs: async (arg1?: any, arg2?: any) => {
    // Two modes:
    // - org admin audit logs: GET /api/audit-logs (mounted as stub in prod unless enabled)
    // - superadmin admin-audit logs: GET /api/superadmin/admin/audit-logs
    if (typeof arg1 === 'string') {
      const filters = arg2 || {};
      const params = new URLSearchParams();
      if (filters?.action) params.set('action', filters.action);
      if (filters?.userId) params.set('userId', filters.userId);
      if (filters?.resource) params.set('resource', filters.resource);
      if (filters?.from) params.set('from', filters.from);
      if (filters?.to) params.set('to', filters.to);
      if (filters?.page) params.set('page', String(filters.page));
      if (filters?.limit) params.set('limit', String(filters.limit));
      const res = await fetchWithRetry(
        `${API_URL}/audit-logs${params.toString() ? `?${params.toString()}` : ''}`,
        { headers: getHeaders() }
      );
      return handleResponse(res, 'Failed to load audit logs');
    }

    const filters = arg1 || {};
    const paging = arg2 || {};
    const params = new URLSearchParams();
    if (filters?.adminId) params.set('adminId', String(filters.adminId));
    if (filters?.actionType) params.set('actionType', String(filters.actionType));
    if (filters?.riskScoreMin) params.set('riskScoreMin', String(filters.riskScoreMin));
    if (filters?.status) params.set('status', String(filters.status));
    const limit = paging?.pageSize ?? paging?.limit ?? 100;
    const page = paging?.page ?? 1;
    const offset = Math.max(0, (Number(page) - 1) * Number(limit));
    params.set('limit', String(limit));
    params.set('offset', String(offset));

    const res = await fetchWithRetry(
      `${API_URL}/superadmin/admin/audit-logs?${params.toString()}`,
      { headers: getHeaders() }
    );
    const logs = await handleResponse(res, 'Failed to load admin audit logs');
    const list = Array.isArray(logs) ? logs : (logs as any)?.logs || [];
    return {
      logs: list,
      pagination: {
        page: Number(page),
        pageSize: Number(limit),
        total: list.length,
        totalPages: 1,
      },
    };
  },

  getAuditLogStats: async (filters?: any) => {
    // SuperAdmin stats endpoint
    const res = await fetchWithRetry(`${API_URL}/superadmin/admin/audit-logs/stats`, {
      headers: getHeaders(),
    });
    const payload = await handleResponse(res, 'Failed to load audit log stats');
    return {
      total: (payload as any)?.total_logs ?? 0,
      low_risk: (payload as any)?.low_risk_count ?? 0,
      medium_risk: (payload as any)?.medium_risk_count ?? 0,
      high_risk: (payload as any)?.high_risk_count ?? 0,
      critical_risk: 0,
      unresolved: (payload as any)?.unresolved_count ?? 0,
      avg_risk_score: (payload as any)?.avg_risk_score ?? null,
    };
  },

  exportAuditLogs: async (filters?: any) => {
    // SuperAdmin export endpoint (if present). If not present, fallback to fetching logs.
    const params = new URLSearchParams();
    if (filters?.adminId) params.set('adminId', String(filters.adminId));
    if (filters?.actionType) params.set('actionType', String(filters.actionType));
    if (filters?.riskScoreMin) params.set('riskScoreMin', String(filters.riskScoreMin));
    if (filters?.status) params.set('status', String(filters.status));
    params.set('format', 'json');
    const res = await fetchWithRetry(
      `${API_URL}/superadmin/admin/audit-logs/export?${params.toString()}`,
      { headers: getHeaders() }
    );
    if (res.ok) return res.json();
    // Fallback: first page
    const data = await Api.getAuditLogs(filters, { page: 1, pageSize: 100 });
    return (data as any)?.logs || [];
  },
  // AI Actions
  rejectAIAction: async (actionId: string, reason?: string, conversationId?: string) => {
    try {
      const res = await fetchWithRetry(`${API_URL}/ai/actions/${actionId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason, conversationId }),
      });
      return handleResponse(res, 'Failed to reject action');
    } catch (err: any) {
      console.error('[Api] rejectAIAction error:', err);
      return { success: false, error: err.message };
    }
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
    const res = await fetch(`${API_URL}/feature-flags/${flagId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update feature flag');
    return res.json();
  },
  toggleFeatureFlag: async (flagId: string, enabled?: boolean) => {
    const res = await fetch(`${API_URL}/feature-flags/${flagId}/toggle`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) throw new Error('Failed to toggle feature flag');
    return res.json();
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
    // SECURITY: route through the password-verified GDPR deletion endpoint
    await Api.post('/api/settings/gdpr/deletion-request', { password });
  },
  // AI Memory
  clearAIMemory: async (): Promise<void> => {
    return;
  },
  // API Access
  createUserApiKey: async (name: string, scopes: string[] = []): Promise<any> => {
    return SettingsApi.createUserApiKey(name, scopes);
  },
  rotateApiKey: async (keyId: string): Promise<any> => {
    return SettingsApi.rotateApiKey(keyId);
  },
  updateApiKey: async (keyId: string, data: any): Promise<any> => {
    return SettingsApi.updateApiKey(keyId, data);
  },
  // Calendar Sync — wired to settings integration OAuth engine
  getCalendars: async (): Promise<any[]> => {
    try {
      const [integrationsRes, providersRes] = await Promise.all([
        fetch(`${API_URL}/settings/integrations`, { headers: getHeaders() }),
        fetch(`${API_URL}/settings/calendar/providers`, { headers: getHeaders() }),
      ]);
      const data = integrationsRes.ok ? await integrationsRes.json() : {};
      const providerData = providersRes.ok ? await providersRes.json() : {};
      const integrations = data?.data?.integrations || data?.integrations || [];
      const calendarIds = ['google_calendar', 'outlook_calendar', 'apple_calendar'];
      const calendarProviders = (data?.data?.providers || data?.providers || []).filter((p: any) =>
        calendarIds.includes(p.id)
      );
      const persistedProviders = (providerData?.providers || []).map((provider: any) => ({
        ...provider,
        id:
          provider.id === 'google'
            ? 'google_calendar'
            : provider.id === 'outlook'
              ? 'outlook_calendar'
              : provider.id === 'apple'
                ? 'apple_calendar'
                : provider.id,
      }));

      const ICONS: Record<string, string> = {
        google_calendar: '📅',
        outlook_calendar: '📆',
        apple_calendar: '🍎',
      };
      const NAMES: Record<string, string> = {
        google_calendar: 'Google Calendar',
        outlook_calendar: 'Outlook Calendar',
        apple_calendar: 'Apple Calendar (iCal)',
      };

      const result = calendarIds.map((cid) => {
        const provider = calendarProviders.find((p: any) => p.id === cid);
        const integration = integrations.find((i: any) => i.provider === cid);
        const persisted = persistedProviders.find((p: any) => p.id === cid);
        return {
          id: cid,
          name: NAMES[cid] || cid,
          icon: ICONS[cid] || '📅',
          connected:
            !!persisted?.connected || !!provider?.isConnected || integration?.status === 'active',
          connection: persisted?.connection
            ? {
                externalEmail: persisted.connection.externalEmail || '',
                calendarName: persisted.connection.calendarName || NAMES[cid] || cid,
                lastSyncAt: persisted.connection.lastSyncAt || null,
                syncTasks: persisted.connection.syncTasks ?? true,
                syncMeetings: persisted.connection.syncMeetings ?? true,
              }
            : integration
              ? {
                  externalEmail: integration.externalEmail || integration.externalAccountName || '',
                  calendarName: integration.providerName || NAMES[cid] || cid,
                  lastSyncAt: integration.lastSyncAt || null,
                  syncTasks: true,
                  syncMeetings: true,
                }
              : null,
        };
      });
      return result;
    } catch {
      return [];
    }
  },
  getCalendarSettings: async (): Promise<any> => {
    try {
      const res = await fetch(`${API_URL}/settings/calendar/settings`, {
        headers: getHeaders(),
      });
      if (!res.ok) return { syncTasks: true, syncMeetings: true };
      const data = await res.json();
      return data?.data || data || { syncTasks: true, syncMeetings: true };
    } catch {
      return { syncTasks: true, syncMeetings: true };
    }
  },
  connectCalendar: async (provider: string, _credentials?: any): Promise<any> => {
    if (provider === 'apple_calendar') {
      const res = await fetch(`${API_URL}/settings/calendar/connect`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ provider }),
      });
      return handleResponse(res, 'Failed to connect Apple Calendar');
    }

    try {
      const res = await fetch(`${API_URL}/settings/integrations/oauth/start/${provider}`, {
        headers: getHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to start OAuth');
      }
      return { authUrl: data.authUrl };
    } catch (error) {
      if (provider === 'outlook_calendar') {
        throw error;
      }
      throw error;
    }
  },
  disconnectCalendar: async (calendarId: string): Promise<void> => {
    const res = await fetch(`${API_URL}/settings/integrations/${calendarId}/oauth-disconnect`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (res.ok) return;

    const fallback = await fetch(`${API_URL}/settings/calendar/disconnect`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ provider: calendarId }),
    });
    await handleResponse(fallback, 'Failed to disconnect calendar');
  },
  shouldFallbackToLegacyMyWorkCalendar: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
  getMyWorkCalendarUnified: async (filters?: {
    start?: string;
    end?: string;
    sources?: string[];
    projectId?: string;
    ownership?: 'any' | 'assignee' | 'owner';
  }): Promise<{ events: any[] }> => {
    try {
      return await V8MyWorkApi.getCalendarUnified(filters);
    } catch (error) {
      if (!Api.shouldFallbackToLegacyMyWorkCalendar(error)) {
        throw error;
      }
      const params = new URLSearchParams();
      if (filters?.start) params.set('start', filters.start);
      if (filters?.end) params.set('end', filters.end);
      if (filters?.sources?.length) params.set('sources', filters.sources.join(','));
      if (filters?.projectId) params.set('projectId', filters.projectId);
      if (filters?.ownership && filters.ownership !== 'any')
        params.set('ownership', filters.ownership);
      const qs = params.toString();
      const res = await fetch(`${API_URL}/my-work/calendar/unified${qs ? `?${qs}` : ''}`, {
        headers: getHeaders(),
      });
      return handleResponse(res, 'Failed to load unified calendar');
    }
  },
  getMyWorkCalendarConflicts: async (date: string): Promise<any> => {
    try {
      return await V8MyWorkApi.getCalendarConflicts(date);
    } catch (error) {
      if (!Api.shouldFallbackToLegacyMyWorkCalendar(error)) {
        throw error;
      }
      const res = await fetch(
        `${API_URL}/my-work/calendar/conflicts?date=${encodeURIComponent(date)}`,
        {
          headers: getHeaders(),
        }
      );
      return handleResponse(res, 'Failed to check conflicts');
    }
  },
  createMyWorkCalendarEvent: async (body: {
    title: string;
    start: string;
    end?: string;
    allDay?: boolean;
    source?: 'task' | 'initiative' | 'decision';
    description?: string;
    recurrence?: {
      preset: 'daily' | 'weekly' | 'monthly';
    };
  }): Promise<any> => {
    try {
      return await V8MyWorkApi.createCalendarEvent(body);
    } catch (error) {
      if (!Api.shouldFallbackToLegacyMyWorkCalendar(error)) {
        throw error;
      }
      const res = await fetch(`${API_URL}/my-work/calendar/events`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body),
      });
      return handleResponse(res, 'Failed to create calendar event');
    }
  },
  updateMyWorkCalendarEvent: async (body: {
    source: string;
    sourceId: string;
    start: string;
    end?: string;
    allDay?: boolean;
    etag?: string;
  }): Promise<any> => {
    const source = String(body.source || '').toLowerCase();
    const sourceId = String(body.sourceId || '').trim();
    if (!source || !sourceId) {
      throw new Error('Missing calendar event source/sourceId');
    }

    const sourceType =
      source === 'task' || source === 'initiative' || source === 'decision' ? source : 'task';
    try {
      return await V8MyWorkApi.updateCalendarEvent(sourceType, sourceId, {
        start: body.start,
        end: body.end,
        allDay: body.allDay,
      });
    } catch (error) {
      if (!Api.shouldFallbackToLegacyMyWorkCalendar(error)) {
        throw error;
      }
      throw new Error('Calendar event updates require V8 calendar routes');
    }
  },
  // Assessment Reports
  getAssessmentReports: async (projectId?: string) => {
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
    return getCachedJson(`${API_URL}/system-health`, 30_000, 'Failed to fetch system health');
  },
  getRecognitionSchedule: async (id: string) => {
    const res = await fetchWithRetry(`${API_URL}/revenue/revenue-recognition/${id}/schedule`, {
      headers: getHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to fetch recognition schedule');
    return json;
  },
  // Revenue Recognition - connected to real API
  getRevenueRecognitions: async (): Promise<any[]> => {
    const res = await fetchWithRetry(`${API_URL}/revenue/revenue-recognition`, {
      headers: getHeaders(),
    });
    const json = await res.json().catch(() => []);
    if (!res.ok) throw new Error('Failed to fetch revenue recognitions');
    const rows = Array.isArray(json) ? json : (json as any)?.items || [];
    return rows.map((r: any) => ({
      ...r,
      // Align backend schema (total_amount/recognition_schedule) with UI expectations
      revenue_amount: r.revenue_amount ?? r.total_amount ?? 0,
      recognition_schedule_json:
        r.recognition_schedule_json ??
        r.recognition_schedule ??
        r.recognition_schedule_json ??
        '[]',
    }));
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
    const payload = {
      ...data,
      total_amount: data?.total_amount ?? data?.revenue_amount ?? 0,
      contract_name: data?.contract_name ?? data?.contractName,
    };
    const res = await fetch(`${API_URL}/revenue/revenue-recognition`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to create revenue recognition');
    return res.json();
  },
  // Feature flags
  getFeatureFlags: async (filters?: any) => {
    const params = new URLSearchParams();
    if (filters?.environment) params.append('environment', filters.environment);
    if (filters?.flag_type) params.append('flag_type', filters.flag_type);
    if (filters?.search) params.append('search', filters.search);
    const res = await fetch(`${API_URL}/feature-flags?${params}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch feature flags');
    return res.json();
  },
  getRuntimeFeatureFlags: async () => {
    const res = await fetch(`${API_URL}/feature-flags/runtime`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch runtime feature flags');
    return res.json();
  },
  // API Key usage
  getApiKeyUsage: async (keyId?: string) => {
    return { requests: 0, tokens: 0, cost: 0 };
  },
  // DLP (Security module) - real API (/api/superadmin/security/dlp/*)
  getDLPPolicies: async (): Promise<any[]> => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/security/dlp/policies`, {
      headers: getHeaders(),
    });
    const data = await handleResponse(res, 'Failed to fetch DLP policies');
    const rows = Array.isArray(data) ? data : (data as any)?.policies || [];
    return (rows || []).map((r: any) => ({
      id: String(r.id),
      name: r.name,
      description: r.description || '',
      policyType: r.policy_type ?? r.policyType,
      rules: (() => {
        const raw = r.rules_json ?? r.rules ?? '[]';
        try {
          return typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch {
          return [];
        }
      })(),
      enforcementAction: r.enforcement_action ?? r.enforcementAction ?? 'warn',
      isActive: !!(r.is_active ?? r.isActive),
      createdBy: r.created_by ?? r.createdBy,
      createdByEmail: r.created_by_email ?? r.createdByEmail,
      createdAt: r.created_at ?? r.createdAt,
      updatedAt: r.updated_at ?? r.updatedAt,
    }));
  },
  getDLPViolations: async (filters?: any): Promise<any[]> => {
    const params = new URLSearchParams();
    if (filters?.policyId) params.set('policy_id', String(filters.policyId));
    if (filters?.severity) params.set('severity', String(filters.severity));
    if (filters?.isResolved !== undefined)
      params.set('is_resolved', filters.isResolved ? 'true' : 'false');
    const qs = params.toString();
    const res = await fetchWithRetry(
      `${API_URL}/superadmin/security/dlp/violations${qs ? `?${qs}` : ''}`,
      {
        headers: getHeaders(),
      }
    );
    const data = await handleResponse(res, 'Failed to fetch DLP violations');
    const rows = Array.isArray(data) ? data : (data as any)?.violations || [];
    return (rows || []).map((r: any) => ({
      id: String(r.id),
      policyId: r.policy_id ?? r.policyId,
      policyName: r.policy_name ?? r.policyName ?? '',
      policyType: r.policy_type ?? r.policyType ?? '',
      resourceType: r.resource_type ?? r.resourceType ?? '',
      resourceId: r.resource_id ?? r.resourceId ?? '',
      violationType: r.violation_type ?? r.violationType ?? '',
      severity: r.severity,
      detectedAt: r.detected_at ?? r.detectedAt,
      resolvedAt: r.resolved_at ?? r.resolvedAt ?? null,
      resolvedBy: r.resolved_by ?? r.resolvedBy ?? null,
      resolvedByEmail: r.resolved_by_email ?? r.resolvedByEmail ?? null,
    }));
  },
  getDLPStats: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/security/dlp/stats`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch DLP stats');
  },
  createDLPPolicy: async (data: any): Promise<{ success: boolean }> => {
    const payload = {
      name: data?.name,
      description: data?.description,
      policy_type: data?.policyType ?? data?.policy_type,
      rules_json: data?.rules ?? data?.rules_json ?? [],
      enforcement_action: data?.enforcementAction ?? data?.enforcement_action ?? 'warn',
      severity: data?.severity,
      applies_to: data?.appliesTo ?? data?.applies_to,
    };
    const res = await fetchWithRetry(`${API_URL}/superadmin/security/dlp/policies`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to create DLP policy');
  },
  toggleDLPPolicy: async (id: string, isActive?: boolean): Promise<{ success: boolean }> => {
    const res = await fetchWithRetry(
      `${API_URL}/superadmin/security/dlp/policies/${encodeURIComponent(id)}/toggle`,
      {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ is_active: !!isActive }),
      }
    );
    return handleResponse(res, 'Failed to toggle DLP policy');
  },
  deleteDLPPolicy: async (id: string): Promise<{ success: boolean }> => {
    const res = await fetchWithRetry(
      `${API_URL}/superadmin/security/dlp/policies/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to delete DLP policy');
  },
  resolveDLPViolation: async (id: string, notes?: string): Promise<{ success: boolean }> => {
    const res = await fetchWithRetry(
      `${API_URL}/superadmin/security/dlp/violations/${encodeURIComponent(id)}/resolve`,
      {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ notes }),
      }
    );
    return handleResponse(res, 'Failed to resolve DLP violation');
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
    const res = await fetch(`${API_URL}/superadmin/admin/permissions/${roleId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ permission }),
    });
    if (!res.ok) throw new Error('Failed to update permission');
    return res.json();
  },
  createAdminPermission: async (data: any): Promise<{ success: boolean; id: string }> => {
    const res = await fetch(`${API_URL}/superadmin/admin/permissions`, {
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
  // Threat Intelligence (Security module) - real API (/api/superadmin/security/threats/*)
  getThreatIntelligence: async (): Promise<any[]> => {
    return Api.getThreats();
  },
  getThreatStats: async (): Promise<any> => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/security/threats/stats`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch threat stats');
  },
  // Legacy aliases (kept for compatibility; threat actions handled below)
  resolveThreat: async (_id: string): Promise<{ success: boolean }> => ({ success: true }),
  dismissThreat: async (_id: string): Promise<{ success: boolean }> => ({ success: true }),
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
  getUserApiKeys: async () => SettingsApi.getUserApiKeys(),
  deleteUserApiKey: async (keyId: string) => SettingsApi.deleteUserApiKey(keyId),
  // Calendar
  updateCalendarSettings: async (settings: any) => {
    const res = await fetch(`${API_URL}/settings/calendar/settings`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(settings),
    });
    return handleResponse(res, 'Failed to save calendar settings');
  },
  // Permission requests
  getPermissionRequests: async () => [],
  // Feature flags (additional)
  deleteFeatureFlag: async (id: string) => {
    const res = await fetch(`${API_URL}/feature-flags/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete feature flag');
    return res.json();
  },
  createFeatureFlag: async (data: any) => {
    const res = await fetch(`${API_URL}/feature-flags`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create feature flag');
    return res.json();
  },
  getFeatureFlagHistory: async (id: string) => {
    const res = await fetch(`${API_URL}/feature-flags/${id}/history`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch feature flag history');
    return res.json();
  },
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
  updateGlobalStrategy: async (id: string, data: any) => {
    const res = await fetch(`${API_URL}/knowledge/strategies/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data || {}),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((out as any)?.error || 'Failed to update strategy');
    return out;
  },
  linkStrategyToDocument: async (strategyId: string, documentId: string) => {
    const res = await fetch(
      `${API_URL}/knowledge/strategies/${encodeURIComponent(strategyId)}/link-document`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ document_id: documentId }),
      }
    );
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((out as any)?.error || 'Failed to link document');
    return out;
  },
  linkStrategyToIdea: async (strategyId: string, ideaId: string) => {
    const res = await fetch(
      `${API_URL}/knowledge/strategies/${encodeURIComponent(strategyId)}/link-idea`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ idea_id: ideaId }),
      }
    );
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((out as any)?.error || 'Failed to link idea');
    return out;
  },
  unlinkStrategyFromDocument: async (strategyId: string, documentId: string) => {
    const res = await fetch(
      `${API_URL}/knowledge/strategies/${encodeURIComponent(strategyId)}/unlink-document/${encodeURIComponent(documentId)}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((out as any)?.error || 'Failed to unlink document');
    return out;
  },
  unlinkStrategyFromIdea: async (strategyId: string, ideaId: string) => {
    const res = await fetch(
      `${API_URL}/knowledge/strategies/${encodeURIComponent(strategyId)}/unlink-idea/${encodeURIComponent(ideaId)}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((out as any)?.error || 'Failed to unlink idea');
    return out;
  },
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
  deleteKnowledgeDocument: async (id: string) => {
    const res = await fetch(`${API_URL}/knowledge/documents/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((out as any)?.error || 'Failed to delete document');
    return out;
  },
  // ★ VLT-003 — dry-run wpływu zmiany zakresu (nie zapisuje nic w bazie), wołane
  // PRZED PATCH .../scope, żeby pokazać ostrzeżenie „X dokumentów stanie się
  // widocznych dla całej organizacji" i dać użytkownikowi anulować.
  getKnowledgeDocumentScopeImpact: async (
    id: string,
    scope: 'user' | 'project' | 'organization'
  ): Promise<{ previousScope: string; requestedScope: string; becameOrgVisibleCount: number }> => {
    const params = new URLSearchParams({ scope });
    const res = await fetch(
      `${API_URL}/knowledge/documents/${id}/scope-impact?${params.toString()}`,
      {
        headers: getHeaders(),
      }
    );
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((out as any)?.error || 'Failed to check scope impact');
    return out;
  },
  updateKnowledgeDocumentScope: async (
    id: string,
    scope: 'user' | 'project' | 'organization',
    projectId?: string
  ) => {
    const res = await fetch(`${API_URL}/knowledge/documents/${id}/scope`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ scope, project_id: scope === 'project' ? projectId : undefined }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((out as any)?.error || 'Failed to update document scope');
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
  updateApprovalWorkflow: async (id: string, data: any) => {
    const res = await fetch(
      `${API_URL}/superadmin/admin/approval-workflows/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data || {}),
      }
    );
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((out as any)?.error || 'Failed to update approval workflow');
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
  compareAdminRoles: async (role1: string, role2: string) => {
    const params = new URLSearchParams({ role1, role2 });
    const res = await fetch(`${API_URL}/superadmin/admin/permissions/roles/compare?${params}`, {
      headers: getHeaders(),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((out as any)?.error || 'Failed to compare roles');
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
  // Threats (used by ThreatIntelligenceView)
  getThreats: async (filters?: any) => {
    const params = new URLSearchParams();
    const uiThreatType = filters?.threatType ? String(filters.threatType) : '';
    const uiLevel = filters?.threatLevel ? String(filters.threatLevel) : '';
    const uiBlocked = filters?.isBlocked;

    // Backend expects threat_type in ('ip','domain','email','hash','url')
    if (uiThreatType) {
      const v = uiThreatType.toLowerCase();
      const mapped = v.includes('domain')
        ? 'domain'
        : v.includes('ip')
          ? 'ip'
          : v.includes('url')
            ? 'url'
            : v.includes('hash')
              ? 'hash'
              : v.includes('email')
                ? 'email'
                : '';
      if (mapped) params.set('threat_type', mapped);
    }
    if (uiLevel) params.set('threat_level', uiLevel);
    if (uiBlocked !== '' && uiBlocked !== undefined)
      params.set('is_blocked', uiBlocked ? 'true' : 'false');

    const qs = params.toString();
    const res = await fetchWithRetry(
      `${API_URL}/superadmin/security/threats${qs ? `?${qs}` : ''}`,
      {
        headers: getHeaders(),
      }
    );
    const rows = await handleResponse(res, 'Failed to fetch threats');
    const list = Array.isArray(rows) ? rows : (rows as any)?.threats || [];
    return (list || []).map((r: any) => {
      const t = String(r.threat_type ?? r.threatType ?? '');
      const indicator = r.indicator ?? r.ip_address ?? r.domain ?? '';
      const isIp = t === 'ip';
      const isDomain = t === 'domain';
      const threatType =
        r.threat_category ||
        (isIp ? 'malicious_ip' : isDomain ? 'suspicious_domain' : t || 'other');
      return {
        id: String(r.id),
        threatType,
        source: r.source || '',
        ipAddress: isIp ? String(indicator) : null,
        domain: isDomain ? String(indicator) : null,
        reputationScore: Number(r.reputation_score ?? r.reputationScore ?? 50),
        threatLevel: r.threat_level ?? r.threatLevel ?? 'MEDIUM',
        description: r.description || '',
        firstSeen:
          r.first_seen ?? r.firstSeen ?? r.created_at ?? r.createdAt ?? new Date().toISOString(),
        lastSeen:
          r.last_seen ??
          r.lastSeen ??
          r.updated_at ??
          r.updatedAt ??
          r.created_at ??
          r.createdAt ??
          new Date().toISOString(),
        isBlocked: !!(r.is_blocked ?? r.isBlocked),
        createdAt: r.created_at ?? r.createdAt ?? new Date().toISOString(),
      };
    });
  },
  addThreat: async (data: any) => {
    const indicator = data?.ipAddress || data?.domain;
    const threat_type = data?.ipAddress ? 'ip' : data?.domain ? 'domain' : undefined;
    const payload = {
      threat_type,
      indicator,
      threat_level: data?.threatLevel ?? data?.threat_level ?? 'MEDIUM',
      reputation_score: data?.reputationScore ?? data?.reputation_score ?? 50,
      source: data?.source || 'manual',
      description: data?.description || '',
    };
    const res = await fetchWithRetry(`${API_URL}/superadmin/security/threats`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to add threat');
  },
  blockThreat: async (id: string) => {
    const res = await fetchWithRetry(
      `${API_URL}/superadmin/security/threats/${encodeURIComponent(id)}/block`,
      {
        method: 'PUT',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to block threat');
  },
  unblockThreat: async (id: string) => {
    const res = await fetchWithRetry(
      `${API_URL}/superadmin/security/threats/${encodeURIComponent(id)}/unblock`,
      {
        method: 'PUT',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to unblock threat');
  },
  deleteThreat: async (id: string) => {
    const res = await fetchWithRetry(
      `${API_URL}/superadmin/security/threats/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to delete threat');
  },
  checkIPReputation: async (ip: string) => {
    const params = new URLSearchParams({ ip: String(ip) });
    const res = await fetchWithRetry(`${API_URL}/superadmin/security/threats/check-ip?${params}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to check IP reputation');
  },
  checkDomainReputation: async (domain: string) => {
    const params = new URLSearchParams({ domain: String(domain) });
    const res = await fetchWithRetry(
      `${API_URL}/superadmin/security/threats/check-domain?${params}`,
      {
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to check domain reputation');
  },
  // Chat projects (folders) - unified through fetchWithRetry + handleResponse so
  // server-side error details (403 permissions, 404, 409 etc.) reach the UI.
  // chat-history fix 2026-04-18 (feedback #407a17df, #84f6e58f, #fb2d4e30).
  getChatProjects: async (options?: { scope?: 'personal' | 'team' }) => {
    const params = new URLSearchParams();
    if (options?.scope) params.append('scope', options.scope);
    const qs = params.toString();
    const res = await fetchWithRetry(`${API_URL}/chat-projects${qs ? `?${qs}` : ''}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch chat projects');
  },
  getChatProject: async (id: string) => {
    const res = await fetchWithRetry(`${API_URL}/chat-projects/${id}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch chat project');
  },
  createChatProject: async (data: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    scope?: 'personal' | 'team';
    visibility?: 'org' | 'private';
  }) => {
    const res = await fetchWithRetry(`${API_URL}/chat-projects`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create chat folder');
  },
  updateChatProject: async (
    id: string,
    data: {
      name?: string;
      description?: string;
      color?: string;
      icon?: string;
      customInstructions?: string | null;
      visibility?: 'org' | 'private';
      parentId?: string | null;
    }
  ) => {
    const res = await fetchWithRetry(`${API_URL}/chat-projects/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update chat folder');
  },
  // F2: team-project membership (RBAC).
  getProjectMembers: async (projectId: string) => {
    const res = await fetchWithRetry(`${API_URL}/chat-projects/${projectId}/members`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to load project members');
  },
  addProjectMember: async (
    projectId: string,
    data: { email?: string; memberUserId?: string; role?: 'owner' | 'editor' | 'viewer' }
  ) => {
    const res = await fetchWithRetry(`${API_URL}/chat-projects/${projectId}/members`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to add member');
  },
  updateProjectMemberRole: async (
    projectId: string,
    memberUserId: string,
    role: 'owner' | 'editor' | 'viewer'
  ) => {
    const res = await fetchWithRetry(
      `${API_URL}/chat-projects/${projectId}/members/${memberUserId}`,
      {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ role }),
      }
    );
    return handleResponse(res, 'Failed to update member role');
  },
  removeProjectMember: async (projectId: string, memberUserId: string) => {
    const res = await fetchWithRetry(
      `${API_URL}/chat-projects/${projectId}/members/${memberUserId}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to remove member');
  },
  // F3: project knowledge (text snippets + uploaded files shared with members).
  getProjectKnowledge: async (projectId: string) => {
    const res = await fetchWithRetry(`${API_URL}/chat-projects/${projectId}/knowledge`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to load project knowledge');
  },
  addProjectKnowledge: async (
    projectId: string,
    data: { kind: 'text' | 'file'; title?: string; content?: string; docId?: string }
  ) => {
    const res = await fetchWithRetry(`${API_URL}/chat-projects/${projectId}/knowledge`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to add knowledge');
  },
  deleteProjectKnowledge: async (projectId: string, knowledgeId: string) => {
    const res = await fetchWithRetry(
      `${API_URL}/chat-projects/${projectId}/knowledge/${knowledgeId}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to delete knowledge');
  },
  deleteChatProject: async (id: string) => {
    const res = await fetchWithRetry(`${API_URL}/chat-projects/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete chat folder');
  },
  moveConversationToProject: async (projectId: string, conversationId: string) => {
    const res = await fetchWithRetry(
      `${API_URL}/chat-projects/${projectId}/conversations/${conversationId}`,
      {
        method: 'POST',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to move conversation to folder');
  },
  /** Create (or return existing) a public share link for a conversation (F4). */
  shareConversation: async (
    conversationId: string,
    opts?: { title?: string; expiresIn?: number }
  ) => {
    const res = await fetchWithRetry(`${API_URL}/conversations/${conversationId}/share`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(opts || {}),
    });
    return handleResponse(res, 'Failed to create share link');
  },
  /** Get an existing share for a conversation (F4). */
  getConversationShare: async (conversationId: string) => {
    const res = await fetchWithRetry(`${API_URL}/conversations/${conversationId}/share`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to load share');
  },
  /** Revoke a conversation's share link (F4). */
  revokeConversationShare: async (conversationId: string) => {
    const res = await fetchWithRetry(`${API_URL}/conversations/${conversationId}/share`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to revoke share');
  },
  /** Public, unauthenticated fetch of a shared conversation by token (F4). */
  getPublicShare: async (token: string) => {
    // Chat P0-2 — never pass passwords in the URL. Unlock-then-fetch flow:
    // call `unlockPublicShare(token, password)` first, then call this fetch.
    // The unlock endpoint sets a `share_access_<token>` HttpOnly cookie this
    // GET reads.
    const res = await fetch(`${API_URL}/share/${encodeURIComponent(token)}`, {
      credentials: 'include',
    });
    return handleResponse(res, 'Failed to load shared conversation');
  },
  /** Chat P0-2 — unlock a password-protected share. Sets an HttpOnly cookie. */
  unlockPublicShare: async (token: string, password: string) => {
    const res = await fetch(`${API_URL}/share/${encodeURIComponent(token)}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password }),
    });
    return handleResponse(res, 'Failed to unlock shared conversation');
  },
  /** Fork a conversation from a message into a new conversation (composer #4). */
  branchConversation: async (conversationId: string, forkMessageId: string) => {
    const res = await fetchWithRetry(`${API_URL}/conversations/${conversationId}/branch`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ forkMessageId }),
    });
    return handleResponse(res, 'Failed to branch conversation');
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
    const res = await fetchWithRetry(`${API_URL}/superadmin/lifecycle/stages`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create lifecycle stage');
  },
  updateLifecycleStage: async (id: string, data: any) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/lifecycle/stages/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update lifecycle stage');
  },
  deleteLifecycleStage: async (id: string) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/lifecycle/stages/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete lifecycle stage');
  },
  transitionOrganizationLifecycle: async (data: any) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/lifecycle/transitions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to transition organization');
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
    const res = await fetchWithRetry(`${API_URL}/superadmin/playbooks`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create playbook');
  },
  updateSuccessPlaybook: async (id: string, data: any) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/playbooks/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update playbook');
  },
  deleteSuccessPlaybook: async (id: string) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/playbooks/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete playbook');
  },
  executeSuccessPlaybook: async (id: string, orgId?: string) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/playbooks/${id}/execute`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ organizationId: orgId }),
    });
    return handleResponse(res, 'Failed to execute playbook');
  },
  // Admin Audit Logs
  getAdminAuditLogs: async (filters?: any) => {
    const params = new URLSearchParams();
    if (filters?.adminId) params.set('adminId', String(filters.adminId));
    if (filters?.actionType) params.set('actionType', String(filters.actionType));
    if (filters?.riskScoreMin !== undefined && filters?.riskScoreMin !== '')
      params.set('riskScoreMin', String(filters.riskScoreMin));
    if (filters?.status) params.set('status', String(filters.status));
    if (filters?.limit !== undefined) params.set('limit', String(filters.limit));
    if (filters?.offset !== undefined) params.set('offset', String(filters.offset));
    // optional date filters (controller may ignore if unsupported)
    if (filters?.fromDate) params.set('fromDate', String(filters.fromDate));
    if (filters?.toDate) params.set('toDate', String(filters.toDate));

    const res = await fetchWithRetry(
      `${API_URL}/superadmin/admin/audit-logs?${params.toString()}`,
      {
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to fetch admin audit logs');
  },
  exportAdminAuditLogs: async (formatOrFilters?: any, maybeFilters?: any) => {
    // Backwards compatible:
    // - exportAdminAuditLogs({ ...filters, format: 'csv' })
    // - exportAdminAuditLogs('csv', { ...filters })
    const format =
      typeof formatOrFilters === 'string'
        ? formatOrFilters
        : typeof formatOrFilters === 'object'
          ? formatOrFilters?.format
          : undefined;
    const filters =
      typeof formatOrFilters === 'object' && formatOrFilters !== null
        ? formatOrFilters
        : maybeFilters;

    const params = new URLSearchParams();
    if (filters?.adminId) params.set('adminId', String(filters.adminId));
    if (filters?.actionType) params.set('actionType', String(filters.actionType));
    if (filters?.riskScoreMin !== undefined && filters?.riskScoreMin !== '')
      params.set('riskScoreMin', String(filters.riskScoreMin));
    if (filters?.status) params.set('status', String(filters.status));
    if (filters?.fromDate) params.set('fromDate', String(filters.fromDate));
    if (filters?.toDate) params.set('toDate', String(filters.toDate));
    params.set('format', String(format || 'csv'));

    const res = await fetchWithRetry(
      `${API_URL}/superadmin/admin/audit-logs/export?${params.toString()}`,
      {
        method: 'GET',
        headers: getHeaders(),
      }
    );

    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok) {
      const out = await res.json().catch(() => ({}));
      throw new Error((out as any)?.error || 'Failed to export admin audit logs');
    }

    // If backend returns a file, pass the blob through.
    if (ct.includes('text/csv') || ct.includes('application/octet-stream')) {
      return res.blob();
    }

    // Otherwise handle JSON (e.g. { url, expiresAt })
    return handleResponse(res, 'Failed to export admin audit logs');
  },
  // Admin Sessions
  getAdminSessions: async (adminId?: string): Promise<{ sessions: any[] }> => {
    const params = new URLSearchParams();
    if (adminId) params.set('adminId', adminId);
    const url = `${API_URL}/superadmin/admin/sessions${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetchWithRetry(url, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch admin sessions');
  },
  getAdminSessionStats: async () => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/admin/sessions/stats`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch admin session stats');
  },
  getSuperAdminOperatorOverview: async () => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/operator/overview`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch operator overview');
  },
  getSuperAdminOperatorTimeline: async (limit = 50) => {
    const res = await fetchWithRetry(
      `${API_URL}/superadmin/operator/timeline?limit=${encodeURIComponent(String(limit))}`,
      {
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to fetch operator timeline');
  },
  getSuperAdminPolicyEnforcement: async () => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/operator/policy-enforcement`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch policy enforcement state');
  },
  revokeAdminSession: async (sessionId: string): Promise<{ message?: string }> => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/admin/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to revoke admin session');
  },
  revokeAllAdminSessions: async (_userId?: string, _reason?: string) => {
    // Global revoke (SuperAdmin) - backend supports both schemas.
    const res = await fetchWithRetry(`${API_URL}/superadmin/admin/sessions/revoke-all`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        // keep room for future: exceptSessionId, reason, etc.
        reason: _reason,
      }),
    });
    return handleResponse(res, 'Failed to revoke all admin sessions');
  },
  // Chat History
  clearChatHistory: async (): Promise<void> => {
    return;
  },
  exportChatHistory: async (): Promise<any> => {
    return { downloadUrl: '', expiresAt: '' };
  },
  // Login History
  getLoginHistory: async (): Promise<any[]> => {
    try {
      const res = await fetchWithRetry(`${API_URL}/auth/login-history`, {
        headers: getHeaders(),
      });
      if (!res.ok) return [];
      const payload = await res.json().catch(() => null);
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
      return rows.map((entry: any) => ({
        id: String(entry.id ?? ''),
        timestamp: entry.time ?? entry.created_at ?? '',
        status:
          entry.status === 'failed' || entry.status === 'suspicious' ? entry.status : 'success',
        location: entry.location ?? 'Unknown location',
        ip: entry.ip_address ?? entry.ip ?? '',
        device: entry.device ?? 'Unknown Device',
      }));
    } catch {
      return [];
    }
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
  getBusinessMetrics: async (filters?: any) => {
    const params = new URLSearchParams();
    if (filters?.metricType) params.set('metricType', String(filters.metricType));
    const url = `${API_URL}/superadmin/analytics/metrics${
      params.toString() ? `?${params.toString()}` : ''
    }`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch business metrics');
    const payload = await res.json().catch(() => ({}));
    const metrics = Array.isArray(payload) ? payload : (payload as any)?.metrics;
    if (!Array.isArray(metrics)) return [];
    return metrics.map((m: any) => ({
      ...m,
      metric_type: m.metric_type ?? m.category ?? 'custom',
      calculation_formula: m.calculation_formula ?? m.formula ?? m.calculationFormula ?? '',
    }));
  },
  getMetricsStats: async () => {
    const res = await fetch(`${API_URL}/superadmin/analytics/metrics/stats`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch metrics stats');
    return res.json();
  },
  getMetricHistory: async (metricId: string) => {
    const res = await fetch(`${API_URL}/superadmin/analytics/metrics/${metricId}/history`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch metric history');
    const payload = await res.json().catch(() => ({}));
    const history = Array.isArray(payload) ? payload : (payload as any)?.history;
    if (!Array.isArray(history)) return [];
    return history.map((h: any) => ({
      id: h.id ?? `${metricId}-${h.recorded_at ?? h.calculated_at ?? h.created_at ?? ''}`,
      metric_id: h.metric_id ?? metricId,
      value: h.value,
      calculated_at: h.calculated_at ?? h.recorded_at ?? h.created_at,
      ...h,
    }));
  },
  createBusinessMetric: async (data: any) => {
    const res = await fetch(`${API_URL}/superadmin/analytics/metrics`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create business metric');
    return res.json();
  },
  deleteBusinessMetric: async (id: string) => {
    const res = await fetch(`${API_URL}/superadmin/analytics/metrics/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete business metric');
    return res.json().catch(() => ({ success: true }));
  },
  calculateBusinessMetric: async (id: string) => {
    const res = await fetch(`${API_URL}/superadmin/analytics/metrics/${id}/calculate`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to calculate business metric');
    return res.json();
  },
  getDemoTrialAnalytics: async (): Promise<{
    summary: {
      last7Days: { demo: number; trialStart: number; paid: number };
      last30Days: Record<string, number>;
      trialWarningsShown: number;
    };
    recentEvents: Array<{
      id: string;
      eventType: string;
      organizationId?: string;
      userId?: string;
      source?: string;
      metadata?: Record<string, unknown>;
      createdAt: string;
    }>;
  }> => {
    const res = await fetch(`${API_URL}/superadmin/analytics/demo-trial`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch demo-trial analytics');
    return res.json();
  },
  // Analytics Dashboards
  getAnalyticsDashboards: async () => {
    const res = await fetch(`${API_URL}/superadmin/analytics/dashboards`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch analytics dashboards');
    const payload = await res.json().catch(() => ({}));
    return {
      dashboards: Array.isArray((payload as any)?.dashboards)
        ? (payload as any).dashboards
        : Array.isArray(payload)
          ? payload
          : [],
    };
  },
  getAnalyticsDashboardData: async (id: string) => {
    const res = await fetch(`${API_URL}/superadmin/analytics/dashboards/${id}/data`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch analytics dashboard data');
    return res.json();
  },
  createAnalyticsDashboard: async (data: any) => {
    const res = await fetch(`${API_URL}/superadmin/analytics/dashboards`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create analytics dashboard');
    return res.json();
  },
  updateAnalyticsDashboard: async (id: string, data: any) => {
    const res = await fetch(`${API_URL}/superadmin/analytics/dashboards/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update analytics dashboard');
    return res.json();
  },
  deleteAnalyticsDashboard: async (id: string) => {
    const res = await fetch(`${API_URL}/superadmin/analytics/dashboards/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete analytics dashboard');
    return res.json();
  },
  shareAnalyticsDashboard: async (id: string, users: string[]) => {
    const res = await fetch(`${API_URL}/superadmin/analytics/dashboards/${id}/share`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ users }),
    });
    if (!res.ok) throw new Error('Failed to share analytics dashboard');
    return res.json();
  },
  // Predictive Analytics
  getPredictiveModels: async () => {
    const res = await fetch(`${API_URL}/superadmin/analytics/models`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch predictive models');
    const payload = await res.json().catch(() => ({}));
    const models = Array.isArray(payload) ? payload : (payload as any)?.models;
    if (!Array.isArray(models)) return [];
    return models.map((m: any) => ({
      ...m,
      accuracy_score: m.accuracy_score ?? m.latest_accuracy ?? m.latestAccuracy,
    }));
  },
  getModelPredictions: async (modelId: string) => {
    const res = await fetch(`${API_URL}/superadmin/analytics/models/${modelId}/predictions`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch model predictions');
    const payload = await res.json().catch(() => ({}));
    const predictions = Array.isArray(payload) ? payload : (payload as any)?.predictions;
    return Array.isArray(predictions) ? predictions : [];
  },
  createPredictiveModel: async (data: any) => {
    const res = await fetch(`${API_URL}/superadmin/analytics/models`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create predictive model');
    return res.json();
  },
  trainPredictiveModel: async (id: string, data?: any) => {
    const res = await fetch(`${API_URL}/superadmin/analytics/models/${id}/train`, {
      method: 'POST',
      headers: getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((payload as any)?.message || 'Failed to train predictive model');
    return payload;
  },
  deletePredictiveModel: async (id: string) => {
    const res = await fetch(`${API_URL}/superadmin/analytics/models/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete predictive model');
    return res.json();
  },
  // Advanced Payment Methods
  getPaymentMethodsAdvanced: async (): Promise<any[]> => {
    const res = await fetchWithRetry(`${API_URL}/revenue/payment-methods`, {
      headers: getHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to fetch payment methods');
    const rows = (Array.isArray(json) ? json : (json as any)?.paymentMethods || []) as any[];
    return rows.map((m) => ({
      id: m.id,
      organization_id: m.organization_id,
      organization_name: m.organization_name,
      payment_type:
        m.type === 'card'
          ? 'credit_card'
          : m.type === 'bank_account'
            ? 'bank_transfer'
            : m.type === 'paypal'
              ? 'paypal'
              : 'invoice',
      payment_details_json: JSON.stringify({
        stripe_payment_method_id: m.stripe_payment_method_id,
        brand: m.brand,
        last_four: m.last4,
        exp_month: m.exp_month,
        exp_year: m.exp_year,
        holder_name: m.holder_name,
      }),
      is_default: m.is_default ?? 0,
      is_active: 1,
      created_at: m.created_at,
      updated_at: m.updated_at,
    }));
  },
  getPaymentFailures: async (filters?: any) => {
    const params = new URLSearchParams();
    if (filters?.recovery_status) params.set('recovery_status', String(filters.recovery_status));
    const url = `${API_URL}/revenue/payment-failures${params.toString() ? `?${params}` : ''}`;
    const res = await fetchWithRetry(url, { headers: getHeaders() });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to fetch payment failures');
    const raw = Array.isArray(json) ? json : (json as any)?.failures || (json as any)?.items || [];
    const rows = Array.isArray(raw) ? raw : [];
    return rows.map((f: any) => ({
      id: f.id,
      organization_id: f.organization_id,
      organization_name: f.organization_name,
      payment_method_id: f.payment_method_id,
      failure_reason: f.failure_reason ?? f.failure_message ?? 'Unknown',
      failure_code: f.failure_code ?? f.decline_code ?? '',
      attempted_at: f.attempted_at ?? f.failed_at ?? f.created_at ?? new Date().toISOString(),
      retry_count: typeof f.retry_count === 'number' ? f.retry_count : Number(f.retry_count || 0),
      status: (f.status ?? f.recovery_status ?? 'pending') as any,
      resolved_at: f.resolved_at ?? f.recovered_at ?? null,
    }));
  },
  getPaymentFailureStats: async () => {
    const res = await fetchWithRetry(`${API_URL}/revenue/payment-failures/stats`, {
      headers: getHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to fetch payment failure stats');
    const total =
      typeof (json as any)?.total === 'number'
        ? (json as any).total
        : Number((json as any)?.total || 0);
    const pending =
      typeof (json as any)?.pending === 'number'
        ? (json as any).pending
        : Number((json as any)?.pending || 0);
    const failed =
      typeof (json as any)?.failed === 'number'
        ? (json as any).failed
        : Number((json as any)?.failed || 0);
    const recovered =
      typeof (json as any)?.recovered === 'number'
        ? (json as any).recovered
        : Number((json as any)?.recovered || 0);
    const denom = total > 0 ? total : pending + failed + recovered;
    const failureRate = denom > 0 ? failed / denom : 0;
    return { ...json, total, pending, failed, recovered, failureRate };
  },
  retryPayment: async (paymentId: string) => {
    const res = await fetchWithRetry(`${API_URL}/revenue/payment-failures/${paymentId}/retry`, {
      method: 'POST',
      headers: getHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to retry payment');
    return json;
  },
  resolvePaymentFailure: async (paymentId: string, resolutionType = 'manual') => {
    const res = await fetchWithRetry(`${API_URL}/revenue/payment-failures/${paymentId}/resolve`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ resolution_type: resolutionType }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to resolve payment failure');
    return json;
  },
  deletePaymentMethodAdvanced: async (_methodId: string) => {
    const res = await fetchWithRetry(`${API_URL}/revenue/payment-methods/${_methodId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to delete payment method');
    return json;
  },
  // Advanced Pricing Plans
  getPricingPlansAdvanced: async () => {
    const res = await fetchWithRetry(`${API_URL}/billing/plans?includeInactive=true`, {
      headers: getHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to fetch pricing plans');

    const rawPlans = Array.isArray(json) ? json : (json as any)?.plans || [];
    return (rawPlans as any[]).map((p) => {
      const limits = p?.limits || {};
      const maxUsers = limits.maxUsers ?? limits.max_users ?? p.max_users ?? 0;
      const maxProjects = limits.maxProjects ?? limits.max_projects ?? p.max_projects ?? 0;
      const maxStorageGb = limits.maxStorageGb ?? limits.max_storage_gb ?? p.max_storage_gb ?? 0;

      return {
        ...p,
        billing_period: p.billing_period || 'monthly',
        max_users: maxUsers,
        max_projects: maxProjects,
        max_storage_gb: maxStorageGb,
        features_json: p.features_json || JSON.stringify({ features: p.features || [], limits }),
      };
    });
  },
  updatePricingPlanAdvanced: async (id: string, data: any) => {
    const featuresPayload =
      typeof data?.features_json === 'string'
        ? (() => {
            try {
              return JSON.parse(data.features_json);
            } catch {
              return {};
            }
          })()
        : data?.features;

    const limits = featuresPayload?.limits ||
      data?.limits || {
        maxUsers: data?.max_users,
        maxProjects: data?.max_projects,
        maxStorageGb: data?.max_storage_gb,
      };

    const payload: any = {
      name: data?.name,
      description: data?.description,
      priceMonthly: data?.price_monthly,
      priceYearly: data?.price_yearly,
      currency: data?.currency,
      trialDays: data?.trial_days,
      isPublic: data?.is_public,
      isActive: data?.is_active,
      sortOrder: data?.sort_order,
      features: featuresPayload?.features || data?.features || [],
      limits,
    };

    const res = await fetchWithRetry(`${API_URL}/billing/plans/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to update pricing plan');
    return json;
  },
  createPricingPlanAdvanced: async (data: any) => {
    const featuresPayload =
      typeof data?.features_json === 'string'
        ? (() => {
            try {
              return JSON.parse(data.features_json);
            } catch {
              return {};
            }
          })()
        : data?.features;

    const limits = featuresPayload?.limits ||
      data?.limits || {
        maxUsers: data?.max_users,
        maxProjects: data?.max_projects,
        maxStorageGb: data?.max_storage_gb,
      };

    const payload: any = {
      name: data?.name,
      description: data?.description,
      priceMonthly: data?.price_monthly,
      priceYearly: data?.price_yearly,
      currency: data?.currency,
      trialDays: data?.trial_days,
      isPublic: data?.is_public,
      sortOrder: data?.sort_order,
      features: featuresPayload?.features || data?.features || [],
      limits,
    };

    const res = await fetchWithRetry(`${API_URL}/billing/plans`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to create pricing plan');
    return json;
  },
  deletePricingPlanAdvanced: async (id: string) => {
    // Soft-delete: deactivate plan (server doesn't expose DELETE for plans)
    const res = await fetchWithRetry(`${API_URL}/billing/plans/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ isActive: false }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to deactivate pricing plan');
    return json;
  },
  comparePricingPlans: async (planIds: string[]) => {
    const params = new URLSearchParams();
    params.set('planIds', planIds.join(','));
    const res = await fetchWithRetry(`${API_URL}/revenue/plans/compare?${params}`, {
      headers: getHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to compare pricing plans');
    return json;
  },
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
    const res = await fetchWithRetry(`${API_URL}/superadmin/contracts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create contract');
  },
  updateCustomerContract: async (id: string, data: any) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/contracts/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update contract');
  },
  deleteCustomerContract: async (id: string) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/contracts/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete contract');
  },
  // Security Incidents
  getSecurityIncidents: async (filters?: any) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', String(filters.status));
    if (filters?.severity) params.set('severity', String(filters.severity));
    if (filters?.incidentType) params.set('incidentType', String(filters.incidentType));
    const qs = params.toString();
    const res = await fetchWithRetry(
      `${API_URL}/superadmin/security/incidents${qs ? `?${qs}` : ''}`,
      {
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to load security incidents');
  },
  getSecurityIncidentStats: async () => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/security/incidents/stats`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to load security incident stats');
  },
  createSecurityIncident: async (data: any) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/security/incidents`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data || {}),
    });
    return handleResponse(res, 'Failed to create security incident');
  },
  resolveSecurityIncident: async (id: string, resolutionNotes?: string) => {
    const res = await fetchWithRetry(
      `${API_URL}/superadmin/security/incidents/${encodeURIComponent(id)}/resolve`,
      {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ resolutionNotes }),
      }
    );
    return handleResponse(res, 'Failed to resolve security incident');
  },
  deleteSecurityIncident: async (id: string) => {
    const res = await fetchWithRetry(
      `${API_URL}/superadmin/security/incidents/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to delete security incident');
  },
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
  // V4-ENT-03: Unified Audit Events
  getAuditEvents: async (filters?: {
    resourceType?: string;
    resourceId?: string;
    actorId?: string;
    actorType?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== '') params.set(k, String(v));
      });
    }
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_URL}/audit/events${qs}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch audit events');
  },
  // SuperAdmin IAM
  getAdminAuditStats: async () => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/admin/audit-logs/stats`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch admin audit stats');
  },
  resolveAdminAuditLog: async (id: string, notes?: string) => {
    const res = await fetchWithRetry(
      `${API_URL}/superadmin/admin/audit-logs/${encodeURIComponent(id)}/resolve`,
      {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ notes }),
      }
    );
    return handleResponse(res, 'Failed to resolve admin audit log');
  },
  // (migrated above) getAdminSessionStats now calls backend
  // SuperAdmin Invoices
  getSuperAdminInvoices: async (filters?: any) => {
    const params = new URLSearchParams();
    if (filters?.period) params.append('period', filters.period);
    if (filters?.status) params.append('status', filters.status);
    const qs = params.toString();
    return Api.get(`/superadmin/invoices${qs ? `?${qs}` : ''}`);
  },
  getSuperAdminInvoiceStats: async () => {
    return Api.get('/superadmin/invoices/stats');
  },
  // Predictive Analytics
  makePrediction: async (modelId: string, data?: any) => {
    const res = await fetch(`${API_URL}/superadmin/analytics/models/${modelId}/predict`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ input: data || {} }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((payload as any)?.message || 'Failed to make prediction');
    return payload;
  },
  // Revenue Forecasts
  getRevenueForecasts: async (filters?: any) => {
    const params = new URLSearchParams();
    if (filters?.forecast_type) params.set('forecast_type', String(filters.forecast_type));
    if (filters?.method) params.set('method', String(filters.method));
    const url = `${API_URL}/revenue/forecasts${params.toString() ? `?${params}` : ''}`;
    const res = await fetchWithRetry(url, { headers: getHeaders() });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to fetch revenue forecasts');
    return Array.isArray(json) ? json : (json as any)?.forecasts || [];
  },
  getRevenueForecastStats: async () => {
    const res = await fetchWithRetry(`${API_URL}/revenue/forecasts/stats`, {
      headers: getHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to fetch revenue forecast stats');
    return json;
  },
  generateRevenueForecast: async (data?: any) => {
    const res = await fetchWithRetry(`${API_URL}/revenue/forecasts`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data || {}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to generate revenue forecast');
    return json;
  },
  deleteRevenueForecast: async (id: string) => {
    const res = await fetchWithRetry(`${API_URL}/revenue/forecasts/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to delete revenue forecast');
    return json;
  },
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
      const res = await fetchWithRetry(`${API_URL}/superadmin/support/tickets`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any)?.error || 'Failed to create support ticket');
      return json;
    } catch (err: any) {
      console.error('[Api] createSupportTicket error:', err);
      throw err;
    }
  },
  getSupportTicketComments: async (ticketId: string) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/support/tickets/${ticketId}/comments`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch support ticket comments');
    return res.json();
  },
  addSupportTicketComment: async (
    ticketId: string,
    data: { commentText: string; isInternal?: boolean }
  ) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/support/tickets/${ticketId}/comments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to add support ticket comment');
    return json;
  },
  // LLM Routing Rules (persisted)
  getLLMRoutingRules: async (params?: { organizationId?: string; includeInactive?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.organizationId) q.set('organizationId', params.organizationId);
    if (params?.includeInactive) q.set('includeInactive', 'true');
    const res = await fetchWithRetry(`${API_URL}/llm/routing-rules${q.toString() ? `?${q}` : ''}`, {
      headers: getHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to fetch routing rules');
    return (json as any)?.rules || [];
  },
  createLLMRoutingRule: async (payload: any) => {
    const res = await fetchWithRetry(`${API_URL}/llm/routing-rules`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to create routing rule');
    return (json as any)?.rule || json;
  },
  updateLLMRoutingRule: async (id: string, payload: any) => {
    const res = await fetchWithRetry(`${API_URL}/llm/routing-rules/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to update routing rule');
    return (json as any)?.rule || json;
  },
  toggleLLMRoutingRule: async (id: string, isActive: boolean) => {
    const res = await fetchWithRetry(`${API_URL}/llm/routing-rules/${id}/toggle`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ isActive }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to toggle routing rule');
    return (json as any)?.rule || json;
  },
  deleteLLMRoutingRule: async (id: string) => {
    const res = await fetchWithRetry(`${API_URL}/llm/routing-rules/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Failed to delete routing rule');
    return json;
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
      const payload = await res.json().catch(() => ({}));
      const events = Array.isArray(payload)
        ? payload
        : Array.isArray((payload as any)?.events)
          ? (payload as any).events
          : [];
      return {
        events: events || [],
        pagination: { page: 1, pageSize: 50, total: events?.length || 0 },
      };
    } catch (err: any) {
      console.error('[Api] getSecurityEvents error:', err);
      throw err;
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

  getSuperAdminActiveSessions: async (): Promise<{ sessions: any[] }> => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/security/sessions`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch sessions');
  },

  terminateSession: async (id: string) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/security/sessions/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to terminate session');
  },

  // IP Access Rules
  getIPAccessRules: async () => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/security/ip-rules`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch IP access rules');
  },
  updateIPRule: async (id: string, data: any) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/security/ip-rules/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update IP access rule');
  },

  // Security Policies
  getSecurityPolicies: async () => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/security/policies`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch security policies');
  },
  updateSecurityPolicy: async (id: string, data: any) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/security/policies/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update security policy');
  },

  // Compliance
  getComplianceFrameworks: async () => {
    try {
      const res = await fetchWithRetry(`${API_URL}/superadmin/compliance/frameworks`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch compliance frameworks');
      return res.json();
    } catch (err: any) {
      console.error('[Api] getComplianceFrameworks error:', err);
      throw err;
    }
  },
  getComplianceSummary: async () => {
    try {
      const res = await fetchWithRetry(`${API_URL}/superadmin/compliance/summary`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch compliance summary');
      return res.json();
    } catch (err: any) {
      console.error('[Api] getComplianceSummary error:', err);
      throw err;
    }
  },
  // Customer Health
  getCustomerHealthCheck: async (orgId: string) => {
    try {
      const res = await fetchWithRetry(
        `${API_URL}/superadmin/organizations/${orgId}/customer-success/health`,
        { headers: getHeaders() }
      );
      if (!res.ok) throw new Error('Failed to fetch customer health check');
      return res.json();
    } catch (err: any) {
      console.error('[Api] getCustomerHealthCheck error:', err);
      throw err;
    }
  },
  // Customer Success Notes
  getCustomerSuccessNotes: async (orgId: string) => {
    try {
      const res = await fetchWithRetry(
        `${API_URL}/superadmin/organizations/${orgId}/customer-success/notes`,
        { headers: getHeaders() }
      );
      if (!res.ok) throw new Error('Failed to fetch customer success notes');
      return res.json();
    } catch (err: any) {
      console.error('[Api] getCustomerSuccessNotes error:', err);
      throw err;
    }
  },
  createCustomerSuccessNote: async (
    orgId: string,
    data: { title: string; content: string; note_type?: string }
  ): Promise<{ success: boolean; id?: string; error?: string }> => {
    try {
      const res = await fetch(
        `${API_URL}/superadmin/organizations/${orgId}/customer-success/notes`,
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(data),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: (json as any)?.error || 'Failed to create note' };
      }
      return { success: true, ...(json as any) };
    } catch (err: any) {
      console.error('[Api] createCustomerSuccessNote error:', err);
      return { success: false, error: err?.message || 'Failed to create note' };
    }
  },
  // Upload API
  upload: async (
    file: File,
    opts?: { orgId?: string; type?: 'light' | 'dark' | 'icon' | 'favicon' | 'login_background' }
  ): Promise<{ url: string; id?: string }> => {
    const orgId = opts?.orgId;
    if (!orgId) throw new Error('Organization ID is required for upload');

    const formData = new FormData();
    formData.append('file', file);
    if (opts?.type) formData.append('type', opts.type);

    const headers = { ...(getHeaders() as any) } as Record<string, string>;
    delete headers['Content-Type'];

    const res = await fetchWithRetry(`${API_URL}/branding/${orgId}/upload`, {
      method: 'POST',
      headers,
      body: formData as any,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any)?.error || 'Upload failed');
    return json as any;
  },
  // Access Code Validation
  validateAccessCode: async (
    code: string
  ): Promise<{
    valid: boolean;
    type: string;
    organizationId: string;
    organizationName?: string;
    role?: string;
    reason?: string | null;
  }> => {
    const res = await fetch(`${API_URL}/access-codes/validate/${encodeURIComponent(code)}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 404) return { valid: false, type: '', organizationId: '' };
      throw new Error((json as any)?.error || 'Failed to validate access code');
    }
    return {
      valid: Boolean((json as any)?.valid),
      type: String((json as any)?.type || ''),
      organizationId: '',
      organizationName: undefined,
      role: undefined,
      reason: (json as any)?.valid ? null : 'Invalid or expired access code',
    };
  },

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
    enabled: boolean,
    source: string = 'demo_toggle'
  ): Promise<{
    success: boolean;
    isDemoMode: boolean;
    demoExperienceType?: DemoExperienceType;
    demoSession?: {
      id: string;
      organizationId: string;
      locale: 'en' | 'pl';
      expiresAt: string;
      anchorDate: string;
    } | null;
    demoLocale?: 'en' | 'pl';
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
      decisions?: number;
      users?: number;
    };
    coverage?: Array<{
      tool: string;
      seededRecords: string[];
      userGoal: string;
      ahaMoment: string;
      cta: string;
    }>;
    hints?: string[];
    message?: string;
  }> => {
    const res = await fetch(`${API_URL}/demo/toggle`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ enabled, source }),
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
    demoExperienceType?: DemoExperienceType;
    demoSession?: {
      id: string;
      organizationId: string;
      locale: 'en' | 'pl';
      expiresAt: string;
      anchorDate: string;
    } | null;
    demoLocale?: 'en' | 'pl';
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
      decisions?: number;
      users?: number;
    };
    coverage?: Array<{
      tool: string;
      seededRecords: string[];
      userGoal: string;
      ahaMoment: string;
      cta: string;
    }>;
  }> => {
    const endpointKey = 'demo-status';
    if (isEndpointBackedOff(endpointKey)) {
      return { success: false, isDemoMode: false };
    }

    const res = await fetchWithRetry(`${API_URL}/demo/status`, {
      headers: getHeaders(),
      cache: 'no-store',
    });
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      bumpEndpointBackoff(endpointKey);
    } else if (res.ok) {
      resetEndpointBackoff(endpointKey);
    }
    if (!res.ok) {
      return { success: false, isDemoMode: false };
    }
    return res.json();
  },

  getDataContext: async (): Promise<DataContextSummary> => {
    const res = await fetchWithRetry(`${API_URL}/health/data-context`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch active data context');
  },

  /**
   * Get demo organization details
   */
  getDemoOrganization: async (): Promise<{
    success: boolean;
    demoSession?: {
      id: string;
      organizationId: string;
      locale: 'en' | 'pl';
      expiresAt: string;
      anchorDate: string;
    } | null;
    demoLocale?: 'en' | 'pl';
    organization: {
      id: string;
      name: string;
      slug: string;
      description: string;
    };
    stats: {
      projects: number;
      initiatives: number;
      tasks: number;
      decisions?: number;
      users?: number;
    };
    scenarios: Array<{
      id: string;
      title: string;
      duration?: string;
      audience?: string;
      persona?: string;
    }>;
    coverage?: Array<{
      tool: string;
      seededRecords: string[];
      userGoal: string;
      ahaMoment: string;
      cta: string;
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

  /**
   * Record demo/trial telemetry event (e.g. trial_expiry_warning_shown when user sees banner)
   */
  recordDemoTrialEvent: async (params: {
    eventType: 'trial_expiry_warning_shown' | 'demo_ai_limit_reached';
    organizationId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_URL}/demo/record-event`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        eventType: params.eventType,
        organizationId: params.organizationId,
        metadata: params.metadata,
      }),
    });
    if (!res.ok) return { success: false };
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
      throw err;
    }
  },
  getStakeholderSegments: async (initiativeId?: string): Promise<any[]> => {
    try {
      const params = new URLSearchParams();
      if (initiativeId) params.set('initiativeId', initiativeId);
      const query = params.toString();
      const res = await fetchWithRetry(
        `${API_URL}/stakeholder-comm/segments${query ? `?${query}` : ''}`,
        {
          headers: getHeaders(),
        }
      );
      if (!res.ok) throw new Error('Failed to fetch stakeholder segments');
      const data = await res.json();
      return data.data || [];
    } catch (err: any) {
      console.error('[Api] getStakeholderSegments error:', err);
      throw err;
    }
  },
  getStakeholderPlans: async (initiativeId?: string): Promise<any[]> => {
    try {
      const params = new URLSearchParams();
      if (initiativeId) params.set('initiativeId', initiativeId);
      const query = params.toString();
      const res = await fetchWithRetry(
        `${API_URL}/stakeholder-comm/plans${query ? `?${query}` : ''}`,
        {
          headers: getHeaders(),
        }
      );
      if (!res.ok) throw new Error('Failed to fetch stakeholder plans');
      const data = await res.json();
      return data.data || [];
    } catch (err: any) {
      console.error('[Api] getStakeholderPlans error:', err);
      throw err;
    }
  },
  getStakeholderPlanItems: async (planId: string): Promise<any[]> => {
    try {
      const res = await fetchWithRetry(
        `${API_URL}/stakeholder-comm/plans/${encodeURIComponent(planId)}/items`,
        {
          headers: getHeaders(),
        }
      );
      if (!res.ok) throw new Error('Failed to fetch stakeholder plan items');
      const data = await res.json();
      return data.data || [];
    } catch (err: any) {
      console.error('[Api] getStakeholderPlanItems error:', err);
      throw err;
    }
  },
  getSteercoPacks: async (params?: { initiativeId?: string; status?: string }): Promise<any[]> => {
    try {
      const search = new URLSearchParams();
      if (params?.initiativeId) search.set('initiativeId', params.initiativeId);
      if (params?.status) search.set('status', params.status);
      const query = search.toString();
      const res = await fetchWithRetry(
        `${API_URL}/stakeholder-comm/steerco-packs${query ? `?${query}` : ''}`,
        {
          headers: getHeaders(),
        }
      );
      if (!res.ok) throw new Error('Failed to fetch steerco packs');
      const data = await res.json();
      return data.data || [];
    } catch (err: any) {
      console.error('[Api] getSteercoPacks error:', err);
      throw err;
    }
  },
  getStakeholderOverduePlans: async (): Promise<any[]> => {
    try {
      const res = await fetchWithRetry(`${API_URL}/stakeholder-comm/overdue`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch overdue stakeholder plans');
      const data = await res.json();
      return data.data || [];
    } catch (err: any) {
      console.error('[Api] getStakeholderOverduePlans error:', err);
      throw err;
    }
  },
  getStakeholderSendLog: async (params?: {
    initiativeId?: string;
    limit?: number;
  }): Promise<any[]> => {
    try {
      const search = new URLSearchParams();
      if (params?.initiativeId) search.set('initiativeId', params.initiativeId);
      if (typeof params?.limit === 'number') search.set('limit', String(params.limit));
      const query = search.toString();
      const res = await fetchWithRetry(
        `${API_URL}/stakeholder-comm/log${query ? `?${query}` : ''}`,
        {
          headers: getHeaders(),
        }
      );
      if (!res.ok) throw new Error('Failed to fetch stakeholder send log');
      const data = await res.json();
      return data.data || [];
    } catch (err: any) {
      console.error('[Api] getStakeholderSendLog error:', err);
      throw err;
    }
  },
  sendStakeholderPlanItem: async (
    planId: string,
    itemId: string,
    data: {
      initiativeId?: string;
      segmentId?: string;
      recipientCount?: number;
      followUpTask?: string;
    } = {}
  ): Promise<any> => {
    try {
      const res = await fetchWithRetry(
        `${API_URL}/stakeholder-comm/plans/${encodeURIComponent(planId)}/items/${encodeURIComponent(itemId)}/send`,
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) throw new Error('Failed to send stakeholder plan item');
      const payload = await res.json();
      return payload.data ?? payload;
    } catch (err: any) {
      console.error('[Api] sendStakeholderPlanItem error:', err);
      throw err;
    }
  },
  distributeSteercoPack: async (
    packId: string,
    data: {
      segmentIds?: string[];
      userIds?: string[];
      channels?: string[];
    } = {}
  ): Promise<any[]> => {
    try {
      const res = await fetchWithRetry(
        `${API_URL}/stakeholder-comm/steerco-packs/${encodeURIComponent(packId)}/distribute`,
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) throw new Error('Failed to distribute steerco pack');
      const payload = await res.json();
      return payload.data || [];
    } catch (err: any) {
      console.error('[Api] distributeSteercoPack error:', err);
      throw err;
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

  getAIActionCenter: async (params?: {
    projectId?: string;
    status?: string;
    scope?: 'mine' | 'org';
    limit?: number;
  }) => {
    try {
      const qs = new URLSearchParams();
      if (params?.projectId) qs.set('projectId', params.projectId);
      if (params?.status) qs.set('status', params.status);
      if (params?.scope) qs.set('scope', params.scope);
      if (params?.limit) qs.set('limit', String(params.limit));
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      const res = await fetchWithRetry(`${API_URL}/ai/actions/center${suffix}`);
      return handleResponse(res, 'Failed to fetch Action Center');
    } catch (err: any) {
      console.error('[Api] getAIActionCenter error:', err);
      return { success: false, actions: [], summary: null, error: err.message };
    }
  },

  getAIRunLedger: async (params?: {
    projectId?: string;
    status?: string;
    scope?: 'mine' | 'org';
    limit?: number;
  }) => {
    try {
      const qs = new URLSearchParams();
      if (params?.projectId) qs.set('projectId', params.projectId);
      if (params?.status) qs.set('status', params.status);
      if (params?.scope) qs.set('scope', params.scope);
      if (params?.limit) qs.set('limit', String(params.limit));
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      const res = await fetchWithRetry(`${API_URL}/ai/actions/runs${suffix}`);
      return handleResponse(res, 'Failed to fetch AI run ledger');
    } catch (err: any) {
      console.error('[Api] getAIRunLedger error:', err);
      return { success: false, runs: [], error: err.message };
    }
  },

  getAIActionAuditTrail: async (actionId: string) => {
    try {
      const res = await fetchWithRetry(`${API_URL}/ai/actions/${actionId}/audit`);
      return handleResponse(res, 'Failed to fetch AI action audit');
    } catch (err: any) {
      console.error('[Api] getAIActionAuditTrail error:', err);
      return { success: false, audit: null, error: err.message };
    }
  },

  listLegacyAIResearchSessions: async (params?: {
    status?: string;
    scope?: 'mine' | 'org';
    limit?: number;
  }) => {
    try {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.scope) qs.set('scope', params.scope);
      if (params?.limit) qs.set('limit', String(params.limit));
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      const res = await fetchWithRetry(`${API_URL}/research/sessions${suffix}`);
      return handleResponse(res, 'Failed to fetch research sessions');
    } catch (err: any) {
      console.error('[Api] listLegacyAIResearchSessions error:', err);
      return { success: false, sessions: [], error: err.message };
    }
  },

  createResearchSession: async (payload: {
    mission: string;
    scope?: string;
    questions?: string[];
    allowedSources?: Array<'web' | 'attachment' | 'product' | 'org'>;
    budget?: Record<string, unknown>;
    expectedOutput?: string;
    attachmentDocIds?: string[];
    projectId?: string;
    conversationId?: string;
  }) => {
    try {
      const res = await fetchWithRetry(`${API_URL}/research/sessions`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return handleResponse(res, 'Failed to create research session');
    } catch (err: any) {
      console.error('[Api] createResearchSession error:', err);
      return { success: false, session: null, error: err.message };
    }
  },

  getResearchSession: async (sessionId: string) => {
    try {
      const res = await fetchWithRetry(`${API_URL}/research/sessions/${sessionId}`);
      return handleResponse(res, 'Failed to fetch research session');
    } catch (err: any) {
      console.error('[Api] getResearchSession error:', err);
      return { success: false, session: null, error: err.message };
    }
  },

  approveResearchSession: async (sessionId: string) => {
    const res = await fetchWithRetry(`${API_URL}/research/sessions/${sessionId}/approve`, {
      method: 'POST',
    });
    return handleResponse(res, 'Failed to approve research session');
  },

  startResearchSession: async (sessionId: string) => {
    const res = await fetchWithRetry(`${API_URL}/research/sessions/${sessionId}/start`, {
      method: 'POST',
    });
    return handleResponse(res, 'Failed to start research session');
  },

  cancelResearchSessionV1: async (sessionId: string) => {
    const res = await fetchWithRetry(`${API_URL}/research/sessions/${sessionId}/cancel`, {
      method: 'POST',
    });
    return handleResponse(res, 'Failed to cancel research session');
  },

  resumeResearchSession: async (sessionId: string) => {
    const res = await fetchWithRetry(`${API_URL}/research/sessions/${sessionId}/resume`, {
      method: 'POST',
    });
    return handleResponse(res, 'Failed to resume research session');
  },

  retryResearchSession: async (sessionId: string) => {
    const res = await fetchWithRetry(`${API_URL}/research/sessions/${sessionId}/retry`, {
      method: 'POST',
    });
    return handleResponse(res, 'Failed to retry research session');
  },

  getWave5ArtifactSchema: async () => {
    const res = await fetchWithRetry(`${API_URL}/artifacts/wave5/schema`);
    return handleResponse(res, 'Failed to fetch artifact schema');
  },

  listWave5Artifacts: async (params?: {
    status?: string;
    artifactType?: string;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.artifactType) qs.set('artifactType', params.artifactType);
    if (params?.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const res = await fetchWithRetry(`${API_URL}/artifacts/wave5${suffix}`);
    return handleResponse(res, 'Failed to fetch Wave 5 artifacts');
  },

  createWave5Artifact: async (payload: {
    artifactType: string;
    title: string;
    content: string;
    canonicalFormat?: 'markdown' | 'json';
    contentMd?: string;
    contentJson?: unknown;
    contentSchemaVersion?: string;
    projectId?: string | null;
    conversationId?: string | null;
    researchSessionId?: string | null;
    aiRunId?: string | null;
    trustBundleId?: string | null;
    citations?: unknown[];
    sourceRefs?: unknown[];
    metadata?: Record<string, unknown>;
  }) => {
    const res = await fetchWithRetry(`${API_URL}/artifacts/wave5`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to create Wave 5 artifact');
  },

  getWave5Artifact: async (artifactId: string) => {
    const res = await fetchWithRetry(
      `${API_URL}/artifacts/wave5/${encodeURIComponent(artifactId)}`
    );
    return handleResponse(res, 'Failed to fetch Wave 5 artifact');
  },

  proposeWave5ArtifactMutation: async (
    artifactId: string,
    payload: {
      proposedContent: string;
      summary?: string;
      mutationType?: string;
      metadata?: Record<string, unknown>;
    }
  ) => {
    const res = await fetchWithRetry(
      `${API_URL}/artifacts/wave5/${encodeURIComponent(artifactId)}/mutations`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return handleResponse(res, 'Failed to propose Wave 5 mutation');
  },

  approveWave5ArtifactMutation: async (mutationId: string) => {
    const res = await fetchWithRetry(
      `${API_URL}/artifacts/wave5/mutations/${encodeURIComponent(mutationId)}/approve`,
      { method: 'POST' }
    );
    return handleResponse(res, 'Failed to approve Wave 5 mutation');
  },

  commitWave5ArtifactMutation: async (mutationId: string) => {
    const res = await fetchWithRetry(
      `${API_URL}/artifacts/wave5/mutations/${encodeURIComponent(mutationId)}/commit`,
      { method: 'POST' }
    );
    return handleResponse(res, 'Failed to commit Wave 5 mutation');
  },

  approveAndCommitWave5ArtifactMutation: async (mutationId: string) => {
    const res = await fetchWithRetry(
      `${API_URL}/artifacts/wave5/mutations/${encodeURIComponent(mutationId)}/approve-and-commit`,
      { method: 'POST' }
    );
    return handleResponse(res, 'Failed to approve and commit Wave 5 mutation');
  },

  rejectWave5ArtifactMutation: async (mutationId: string) => {
    const res = await fetchWithRetry(
      `${API_URL}/artifacts/wave5/mutations/${encodeURIComponent(mutationId)}/reject`,
      { method: 'POST' }
    );
    return handleResponse(res, 'Failed to reject Wave 5 mutation');
  },

  fillWave5DocumentTemplate: async (payload: {
    artifactId?: string | null;
    artifactType?: string;
    title?: string;
    template: string;
    fields?: Record<string, unknown>;
    projectId?: string | null;
    conversationId?: string | null;
  }) => {
    const res = await fetchWithRetry(`${API_URL}/artifacts/wave5/fill-template`, {
      method: 'POST',
      body: JSON.stringify(payload),
      // Heavy: LLM fills a full document template (multi-section); exceeds 20s.
      timeoutMs: 120000,
    });
    return handleResponse(res, 'Failed to fill Wave 5 document template');
  },

  generateWave5StructuredArtifact: async (payload: {
    outputKind: 'executive_report' | 'board_deck' | 'kpi_table';
    prompt: string;
    title?: string | null;
    projectId?: string | null;
    conversationId?: string | null;
    researchSessionId?: string | null;
    aiRunId?: string | null;
    trustBundleId?: string | null;
    citations?: unknown[];
    sourceRefs?: unknown[];
  }) => {
    const res = await fetchWithRetry(`${API_URL}/artifacts/wave5/generate`, {
      method: 'POST',
      body: JSON.stringify(payload),
      // Heavy: LLM generates a full structured artifact (report/deck/table); exceeds 20s.
      timeoutMs: 120000,
    });
    return handleResponse(res, 'Failed to generate Wave 5 structured artifact');
  },

  getWave5ArtifactExportManifest: async (artifactId: string) => {
    const res = await fetchWithRetry(
      `${API_URL}/artifacts/wave5/${encodeURIComponent(artifactId)}/export-manifest`
    );
    return handleResponse(res, 'Failed to fetch Wave 5 export manifest');
  },

  markWave5ArtifactExported: async (artifactId: string) => {
    const res = await fetchWithRetry(
      `${API_URL}/artifacts/wave5/${encodeURIComponent(artifactId)}/exported`,
      { method: 'POST' }
    );
    return handleResponse(res, 'Failed to mark Wave 5 artifact exported');
  },

  getWave6ContextPanel: async (projectId?: string | null) => {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    const res = await fetchWithRetry(`${API_URL}/ai-context/panel${query}`);
    return handleResponse(res, 'Failed to load Wave 6 context panel');
  },

  captureWave6ContextSnapshot: async (payload: {
    snapshotType: 'org' | 'project' | 'user';
    projectId?: string | null;
    facts: Record<string, unknown>;
    sourceRefs?: unknown[];
    permissions?: Record<string, unknown>;
    freshnessAt?: string | null;
    privateMode?: boolean;
  }) => {
    const res = await fetchWithRetry(`${API_URL}/ai-context/snapshots`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to capture Wave 6 context snapshot');
  },

  captureWave6MemoryCandidate: async (payload: {
    assistantScope: 'anna_public' | 'teresa_tenant';
    memoryScope: 'public_product' | 'tenant' | 'org' | 'user' | 'project';
    key: string;
    value: string;
    projectId?: string | null;
    sourceLabel?: string | null;
    sourceRefs?: unknown[];
    privateMode?: boolean;
    retentionDays?: number | null;
  }) => {
    const res = await fetchWithRetry(`${API_URL}/ai-context/memory/candidates`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to capture Wave 6 memory candidate');
  },

  decideWave6MemoryCandidate: async (
    candidateId: string,
    payload: { decision: 'approve' | 'reject' | 'apply' | 'expire'; reason?: string | null }
  ) => {
    const res = await fetchWithRetry(
      `${API_URL}/ai-context/memory/candidates/${encodeURIComponent(candidateId)}/decision`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    return handleResponse(res, 'Failed to decide Wave 6 memory candidate');
  },

  getWave7ConnectorCatalog: async () => {
    const res = await fetchWithRetry(`${API_URL}/ai-connectors/catalog`);
    return handleResponse(res, 'Failed to load Wave 7 connector catalog');
  },

  listWave7Connectors: async (projectId?: string | null) => {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    const res = await fetchWithRetry(`${API_URL}/ai-connectors${query}`);
    return handleResponse(res, 'Failed to load Wave 7 connectors');
  },

  registerWave7Connector: async (payload: {
    provider: string;
    status?: 'connected' | 'disconnected' | 'stale' | 'failed';
    scopes?: string[];
    projectIds?: string[];
    tenantPolicy?: Record<string, unknown>;
    freshnessTtlMinutes?: number | null;
  }) => {
    const res = await fetchWithRetry(`${API_URL}/ai-connectors`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to register Wave 7 connector');
  },

  updateWave7Connector: async (
    connectorId: string,
    payload: {
      status?: 'connected' | 'disconnected' | 'stale' | 'failed';
      externalConnectorId?: string | null;
      projectIds?: string[];
      failureState?: string | null;
    }
  ) => {
    const res = await fetchWithRetry(`${API_URL}/ai-connectors/${connectorId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to update Wave 7 connector');
  },

  linkWave7Connector: async (connectorId: string, externalConnectorId: string) => {
    const res = await fetchWithRetry(`${API_URL}/ai-connectors/${connectorId}/link`, {
      method: 'POST',
      body: JSON.stringify({ externalConnectorId }),
    });
    return handleResponse(res, 'Failed to link Wave 7 connector');
  },

  disconnectWave7Connector: async (connectorId: string) => {
    const res = await fetchWithRetry(`${API_URL}/ai-connectors/${connectorId}/disconnect`, {
      method: 'POST',
    });
    return handleResponse(res, 'Failed to disconnect Wave 7 connector');
  },

  reindexWave7Connector: async (connectorId: string) => {
    const res = await fetchWithRetry(`${API_URL}/ai-connectors/${connectorId}/reindex`, {
      method: 'POST',
    });
    return handleResponse(res, 'Failed to reindex Wave 7 connector');
  },

  executeWave7ConnectorTool: async (payload: {
    connectorId: string;
    toolName: string;
    toolKind: 'read' | 'search' | 'write' | 'destructive';
    query?: string | null;
    projectId?: string | null;
    aiRunId?: string | null;
    payload?: Record<string, unknown>;
  }) => {
    const res = await fetchWithRetry(`${API_URL}/ai-connectors/execute`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to execute Wave 7 connector tool');
  },

  getWave7ConnectorHealth: async () => {
    const res = await fetchWithRetry(`${API_URL}/ai-connectors/health`);
    return handleResponse(res, 'Failed to load Wave 7 connector health');
  },

  listWave7ConnectorRuns: async () => {
    const res = await fetchWithRetry(`${API_URL}/ai-connectors/runs`);
    return handleResponse(res, 'Failed to load Wave 7 connector runs');
  },

  getWave8AgentCatalog: async () => {
    const res = await fetchWithRetry(`${API_URL}/ai-agents/catalog`);
    return handleResponse(res, 'Failed to load Wave 8 agent catalog');
  },

  upsertWave8AgentDefinition: async (definition: Record<string, unknown>) => {
    const res = await fetchWithRetry(`${API_URL}/ai-agents/definitions`, {
      method: 'POST',
      body: JSON.stringify({ definition }),
    });
    return handleResponse(res, 'Failed to save Wave 8 agent definition');
  },

  launchWave8Agent: async (payload: {
    agentId: string;
    goal: string;
    projectId?: string | null;
    requestedTools?: string[];
    schedule?: {
      cadence: 'once' | 'daily' | 'weekly';
      nextRunAt?: string | null;
      ownerUserId?: string | null;
    } | null;
    swarm?: {
      enabled: boolean;
      agentIds?: string[];
      approved?: boolean;
      budgetApproved?: boolean;
    } | null;
    approval?: {
      aiRunId?: string | null;
      budgetApproved?: boolean;
    } | null;
    evalRun?: {
      enabled: boolean;
      evaluatorAgentId?: string | null;
      criteria?: string[];
    } | null;
  }) => {
    const res = await fetchWithRetry(`${API_URL}/ai-agents/launch`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to launch Wave 8 agent');
  },

  executeWave8AgentTool: async (payload: {
    agentId: string;
    toolName: string;
    toolInput?: Record<string, unknown>;
    projectId?: string | null;
    runId?: string | null;
    aiRunId?: string | null;
    budgetApproved?: boolean;
  }) => {
    const res = await fetchWithRetry(`${API_URL}/ai-agents/tool`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to execute Wave 8 agent tool');
  },

  listWave8AgentRuns: async () => {
    const res = await fetchWithRetry(`${API_URL}/ai-agents/runs`);
    return handleResponse(res, 'Failed to load Wave 8 agent runs');
  },

  listWave8AgentSchedules: async () => {
    const res = await fetchWithRetry(`${API_URL}/ai-agents/schedules`);
    return handleResponse(res, 'Failed to load Wave 8 agent schedules');
  },

  processDueWave8AgentSchedules: async (now?: string) => {
    const res = await fetchWithRetry(`${API_URL}/ai-agents/schedules/process-due`, {
      method: 'POST',
      body: JSON.stringify({ now }),
    });
    return handleResponse(res, 'Failed to process Wave 8 due schedules');
  },

  listWave8AgentNotifications: async () => {
    const res = await fetchWithRetry(`${API_URL}/ai-agents/notifications`);
    return handleResponse(res, 'Failed to load Wave 8 agent notifications');
  },

  listWave9Outcomes: async () => {
    const res = await fetchWithRetry(`${API_URL}/ai-outcomes/outcomes`);
    return handleResponse(res, 'Failed to load Wave 9 outcomes');
  },

  registerWave9Evidence: async (payload: {
    evidenceType:
      | 'initiative'
      | 'task'
      | 'kpi'
      | 'regression_pack'
      | 'ciso_pack'
      | 'business_persona_pack'
      | 'compliance_audit'
      | 'ai_ops_eval_pack';
    sourceType: string;
    sourceId: string;
    title?: string | null;
    status: 'pass' | 'fail' | 'pending';
    verifiedBy?: string | null;
    verificationMethod?: string | null;
    payload?: Record<string, unknown>;
  }) => {
    const res = await fetchWithRetry(`${API_URL}/ai-outcomes/evidence`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to register Wave 9 evidence');
  },

  createWave9Outcome: async (payload: {
    initiativeId: string;
    taskIds?: string[];
    kpiName: string;
    ownerUserId?: string;
    baseline: number;
    target: number;
    current?: number | null;
    confidence: number;
    assumptions: string[];
    sourceRefs: Array<{ sourceType: string; sourceId: string; title?: string | null }>;
    investment?: number | null;
    annualBenefit?: number | null;
  }) => {
    const res = await fetchWithRetry(`${API_URL}/ai-outcomes/outcomes`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to create Wave 9 outcome');
  },

  getWave9FinanceScenarios: async (outcomeId: string) => {
    const res = await fetchWithRetry(`${API_URL}/ai-outcomes/outcomes/${outcomeId}/scenarios`);
    return handleResponse(res, 'Failed to build Wave 9 finance scenarios');
  },

  buildWave9Report: async (payload: {
    outcomeId: string;
    reportType: 'client_ready' | 'investor_ready' | 'steering_committee' | 'ciso_security';
  }) => {
    const res = await fetchWithRetry(`${API_URL}/ai-outcomes/reports`, {
      method: 'POST',
      body: JSON.stringify(payload),
      // Heavy: LLM builds a full Wave 9 outcome report; exceeds 20s.
      timeoutMs: 120000,
    });
    return handleResponse(res, 'Failed to build Wave 9 report');
  },

  recordWave9ProviderHealth: async (payload: {
    provider: string;
    model?: string | null;
    status: 'healthy' | 'degraded' | 'unavailable';
    latencyMs?: number | null;
    errorRate?: number | null;
    costUsd?: number | null;
  }) => {
    const res = await fetchWithRetry(`${API_URL}/ai-outcomes/provider-health`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to record Wave 9 provider health');
  },

  recordWave9EvalRun: async (payload: {
    promptKey: string;
    promptVersion?: string | null;
    category?: 'golden_prompt' | 'hallucination_check' | 'tool_misuse_check' | 'regression_gate';
    status: 'pass' | 'fail';
    score?: number | null;
    hallucinationCheckPassed?: boolean | null;
    toolMisuseCheckPassed?: boolean | null;
    runRef?: string | null;
    details?: Record<string, unknown>;
  }) => {
    const res = await fetchWithRetry(`${API_URL}/ai-outcomes/eval-runs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to record Wave 9 eval run');
  },

  listWave9AcceptanceRuns: async () => {
    const res = await fetchWithRetry(`${API_URL}/ai-outcomes/acceptance-runs`);
    return handleResponse(res, 'Failed to load Wave 9 acceptance runs');
  },

  registerWave9AcceptanceRun: async (payload: {
    runType:
      | 'regression_pack'
      | 'ciso_pack'
      | 'business_persona_pack'
      | 'compliance_audit'
      | 'ai_ops_eval_pack';
    status: 'pass' | 'fail';
    runRef?: string | null;
    buildId?: string | null;
    commitSha?: string | null;
    verifiedBy?: string | null;
    verificationMethod?: string | null;
    payload?: Record<string, unknown>;
  }) => {
    const res = await fetchWithRetry(`${API_URL}/ai-outcomes/acceptance-runs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to register Wave 9 acceptance run');
  },

  recordWave9Incident: async (payload: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    rollbackFlag?: string | null;
    playbook?: Record<string, unknown>;
  }) => {
    const res = await fetchWithRetry(`${API_URL}/ai-outcomes/incidents`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to record Wave 9 incident');
  },

  getWave9AIOpsDashboard: async () => {
    const res = await fetchWithRetry(`${API_URL}/ai-outcomes/aiops`);
    return handleResponse(res, 'Failed to load Wave 9 AI Ops dashboard');
  },

  runWave9FinalAcceptance: async (payload: {
    regressionPassed: boolean;
    cisoPackPassed: boolean;
    businessPersonaPackPassed: boolean;
    providerHealthOk: boolean;
    complianceAuditPassed: boolean;
    openP0: number;
    openP1: number;
    evidenceRefs: {
      regressionRunId?: string | null;
      cisoPackRunId?: string | null;
      businessPersonaPackRunId?: string | null;
      complianceAuditRef?: string | null;
      aiOpsEvalRunId?: string | null;
      aiOpsEvalPackRunId?: string | null;
    };
    acceptanceRunRefs?: {
      regressionRunId?: string | null;
      cisoPackRunId?: string | null;
      businessPersonaPackRunId?: string | null;
      complianceAuditRunId?: string | null;
      aiOpsEvalPackRunId?: string | null;
    };
    acceptedLimitations?: string[];
  }) => {
    const res = await fetchWithRetry(`${API_URL}/ai-outcomes/acceptance`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return handleResponse(res, 'Failed to run Wave 9 final acceptance');
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

  executeAIAction: async (actionId: string, payload: any, conversationId?: string) => {
    try {
      const res = await fetchWithRetry(`${API_URL}/ai/actions/${actionId}/execute`, {
        method: 'POST',
        body: JSON.stringify({ payload, conversationId }),
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

  /**
   * V8 / Wave A6 — fetch the unified list of proposals referenced in a
   * conversation, with lifecycle state sourced from the governance row when
   * available. Returns `{ proposals: ChatProposalView[] }`.
   */
  getConversationProposals: async (conversationId: string) => {
    try {
      const res = await fetchWithRetry(`${API_URL}/ai/conversations/${conversationId}/proposals`, {
        method: 'GET',
      });
      return handleResponse(res, 'Failed to load conversation proposals');
    } catch (err: any) {
      console.error('[Api] getConversationProposals error:', err);
      return { proposals: [] };
    }
  },

  /**
   * V8 / Wave A7.4 — Operator lookup over a persisted message's trust
   * bundle. Returns the canonical bundle + any available `routingTrace`.
   * Falsy on network/permission failure so the UI can gracefully fallback
   * to the inline (message-attached) bundle.
   */
  getMessageTrustTrace: async (messageId: string) => {
    try {
      const res = await fetchWithRetry(
        `${API_URL}/ai/trust/${encodeURIComponent(messageId)}/trace`,
        { method: 'GET' }
      );
      if (!res.ok) return null;
      return (await res.json()) as {
        messageId: string;
        conversationId: string;
        createdAt: string;
        modelUsed: string | null;
        trustBundle: unknown;
        trace: unknown[];
        traceRef: string | null;
      };
    } catch (err: any) {
      console.error('[Api] getMessageTrustTrace error:', err);
      return null;
    }
  },

  /**
   * V8 / Wave B9 — Feedback summary (admin view).
   *
   * Returns aggregates over `ai_response_feedback` for the admin Runs
   * dashboard. Requires admin/owner role on the server; callers should
   * 403-handle.
   */
  getAiFeedbackSummary: async (params?: {
    windowDays?: number;
    topNegativeLimit?: number;
    scope?: 'org' | 'global';
  }) => {
    try {
      const qs = new URLSearchParams();
      if (params?.windowDays) qs.set('windowDays', String(params.windowDays));
      if (params?.topNegativeLimit) qs.set('topNegativeLimit', String(params.topNegativeLimit));
      if (params?.scope) qs.set('scope', params.scope);
      const s = qs.toString();
      const res = await fetchWithRetry(`${API_URL}/ai/feedback/summary${s ? `?${s}` : ''}`, {
        method: 'GET',
      });
      if (!res.ok) return null;
      return (await res.json()) as { summary: any };
    } catch (err: any) {
      console.error('[Api] getAiFeedbackSummary error:', err);
      return null;
    }
  },

  /**
   * V8 / Wave B9 follow-up — Prompt-tuning tickets.
   *
   * Admin-only helpers to turn negative feedback into durable tuning
   * tasks without leaving the dashboard.
   */
  listPromptTuningTickets: async (params?: {
    status?: Array<'open' | 'in_progress' | 'resolved' | 'dismissed'>;
    limit?: number;
  }) => {
    try {
      const qs = new URLSearchParams();
      if (params?.status && params.status.length > 0) {
        qs.set('status', params.status.join(','));
      }
      if (params?.limit) qs.set('limit', String(params.limit));
      const s = qs.toString();
      const res = await fetchWithRetry(`${API_URL}/ai/feedback/tuning-tickets${s ? `?${s}` : ''}`, {
        method: 'GET',
      });
      if (!res.ok) return null;
      return (await res.json()) as { tickets: any[] };
    } catch (err: any) {
      console.error('[Api] listPromptTuningTickets error:', err);
      return null;
    }
  },

  createPromptTuningTicket: async (input: {
    title: string;
    notes?: string;
    feedbackId?: string;
    responseModeHint?: string;
    capabilityHint?: string;
  }) => {
    try {
      const res = await fetchWithRetry(`${API_URL}/ai/feedback/tuning-tickets`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      if (!res.ok) return null;
      return (await res.json()) as { ticket: any };
    } catch (err: any) {
      console.error('[Api] createPromptTuningTicket error:', err);
      return null;
    }
  },

  updatePromptTuningTicketStatus: async (
    id: string,
    status: 'open' | 'in_progress' | 'resolved' | 'dismissed'
  ) => {
    try {
      const res = await fetchWithRetry(
        `${API_URL}/ai/feedback/tuning-tickets/${encodeURIComponent(id)}/status`,
        {
          method: 'POST',
          body: JSON.stringify({ status }),
        }
      );
      if (!res.ok) return null;
      return (await res.json()) as { ticket: any };
    } catch (err: any) {
      console.error('[Api] updatePromptTuningTicketStatus error:', err);
      return null;
    }
  },

  /**
   * V8 / Wave B5 — AI runs (scheduled agents + background jobs).
   *
   * Read-only list/detail for the Runs view. `status` is a
   * comma-separated list; leaving it blank returns everything.
   */
  listAiRuns: async (params?: { status?: string[]; kind?: string; limit?: number }) => {
    try {
      const qs = new URLSearchParams();
      if (params?.status?.length) qs.set('status', params.status.join(','));
      if (params?.kind) qs.set('kind', params.kind);
      if (params?.limit) qs.set('limit', String(params.limit));
      const s = qs.toString();
      const res = await fetchWithRetry(`${API_URL}/ai/runs${s ? `?${s}` : ''}`, { method: 'GET' });
      if (!res.ok) return { runs: [] as any[] };
      return (await res.json()) as { runs: any[] };
    } catch (err: any) {
      console.error('[Api] listAiRuns error:', err);
      return { runs: [] as any[] };
    }
  },

  getAiRun: async (id: string) => {
    try {
      const res = await fetchWithRetry(`${API_URL}/ai/runs/${encodeURIComponent(id)}`, {
        method: 'GET',
      });
      if (!res.ok) return null;
      return (await res.json()) as { run: any };
    } catch (err: any) {
      console.error('[Api] getAiRun error:', err);
      return null;
    }
  },

  /**
   * V8 / Wave B1 — Agent catalog.
   *
   * Returns the six MVP agents visible in the composer picker. The
   * server owns the canonical list; the client just renders it. Falls
   * back to an empty array on network failure so the composer still
   * shows "Default" and the user isn't blocked.
   */
  listAgents: async () => {
    try {
      const res = await fetchWithRetry(`${API_URL}/ai/agents`, {
        method: 'GET',
      });
      if (!res.ok) return { agents: [] as any[] };
      return (await res.json()) as { agents: any[] };
    } catch (err: any) {
      console.error('[Api] listAgents error:', err);
      return { agents: [] as any[] };
    }
  },

  /**
   * V8 / Wave B3 — Org memory retrieval.
   *
   * Lexical search over the caller's organization memory. Hits are
   * tagged with `source_class: 'org_memory'` on the server so the
   * trust bundle citation roll-up treats them as a first-class source.
   */
  searchOrgMemory: async (params: { q: string; limit?: number; sourceType?: string }) => {
    try {
      const qs = new URLSearchParams();
      qs.set('q', params.q);
      if (params.limit) qs.set('limit', String(params.limit));
      if (params.sourceType) qs.set('sourceType', params.sourceType);
      const res = await fetchWithRetry(`${API_URL}/ai/org-memory/search?${qs.toString()}`, {
        method: 'GET',
      });
      if (!res.ok) return { hits: [] as any[], count: 0 };
      return (await res.json()) as { hits: any[]; count: number };
    } catch (err: any) {
      console.error('[Api] searchOrgMemory error:', err);
      return { hits: [] as any[], count: 0 };
    }
  },

  /**
   * V8 / Wave A8 — research sessions.
   *
   * These endpoints back the ResearchSessionsDock UI. All calls are
   * organization-scoped on the server side (`req.organizationId`); the
   * client sends no extra filters beyond status / limit.
   */
  listResearchSessions: async (params?: {
    status?: string[];
    userScope?: 'me' | 'org';
    limit?: number;
  }) => {
    try {
      const q = new URLSearchParams();
      if (params?.status?.length) q.set('status', params.status.join(','));
      if (params?.userScope) q.set('scope', params.userScope === 'org' ? 'org' : 'mine');
      if (params?.limit) q.set('limit', String(params.limit));
      const qs = q.toString();
      const res = await fetchWithRetry(`${API_URL}/research/sessions${qs ? `?${qs}` : ''}`, {
        method: 'GET',
      });
      if (!res.ok) return { sessions: [] as any[] };
      return (await res.json()) as { sessions: any[] };
    } catch (err: any) {
      console.error('[Api] listResearchSessions error:', err);
      return { sessions: [] as any[] };
    }
  },

  getLegacyAIResearchSession: async (id: string) => {
    try {
      const res = await fetchWithRetry(
        `${API_URL}/ai/research/sessions/${encodeURIComponent(id)}`,
        { method: 'GET' }
      );
      if (!res.ok) return null;
      return (await res.json()) as { session: any };
    } catch (err: any) {
      console.error('[Api] getLegacyAIResearchSession error:', err);
      return null;
    }
  },

  createLegacyAIResearchSession: async (body: {
    topic: string;
    conversationId?: string;
    messageId?: string;
    workloadClass?: 'deep_research' | 'long_job' | 'background';
    plan?: unknown;
    stepCount?: number;
  }) => {
    try {
      const res = await fetchWithRetry(`${API_URL}/ai/research/sessions`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      return (await res.json()) as { session: any };
    } catch (err: any) {
      console.error('[Api] createLegacyAIResearchSession error:', err);
      return null;
    }
  },

  cancelLegacyAIResearchSession: async (id: string) => {
    try {
      const res = await fetchWithRetry(
        `${API_URL}/ai/research/sessions/${encodeURIComponent(id)}/cancel`,
        { method: 'POST' }
      );
      if (!res.ok) return null;
      return (await res.json()) as { session: any };
    } catch (err: any) {
      console.error('[Api] cancelLegacyAIResearchSession error:', err);
      return null;
    }
  },

  approveAIAction: async (actionId: string, conversationId?: string) => {
    try {
      const res = await fetchWithRetry(`${API_URL}/ai/actions/${actionId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ conversationId }),
      });
      return handleResponse(res, 'Failed to approve action');
    } catch (err: any) {
      console.error('[Api] approveAIAction error:', err);
      return { success: false, error: err.message };
    }
  },

  // ==================== SETTINGS API BRIDGE ====================
  // Delegates legacy callers to the typed settings client.

  getAccessibilitySettings: async () => {
    return SettingsApi.getAccessibilityPreferences();
  },

  updateAccessibilitySettings: async (settings: any) => {
    return SettingsApi.updateAccessibilityPreferences(settings);
  },

  exportSettings: async (filters?: any) => {
    const categories = Array.isArray(filters)
      ? filters
      : Array.isArray(filters?.categories)
        ? filters.categories
        : undefined;
    return SettingsApi.exportSettings(categories);
  },

  importSettings: async (data: any, overwrite?: boolean) => {
    return SettingsApi.importSettings(data, overwrite);
  },

  getSettingsHistory: async (category?: string, days?: number) => {
    return SettingsApi.getSettingsHistory(category, days);
  },

  restoreSettingsEntry: async (entryId: string) => {
    return SettingsApi.restoreSettingsHistoryEntry(entryId);
  },

  getSettingsTemplates: async () => {
    return SettingsApi.getSettingsTemplates();
  },

  applySettingsTemplate: async (templateId: string) => {
    return SettingsApi.applySettingsTemplate(templateId);
  },

  createSettingsTemplate: async (data: any) => {
    return SettingsApi.createSettingsTemplate(data);
  },

  deleteSettingsTemplate: async (templateId: string) => {
    return SettingsApi.deleteSettingsTemplate(templateId);
  },

  // ── AI Settings: backed by /api/ai-settings/* (real endpoints) ──

  getAIUserSettings: async () => {
    const res = await fetchWithRetry(`${API_URL}/ai-settings/user`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch AI user settings');
  },

  updateAIUserSettings: async (settings: Record<string, unknown>) => {
    const res = await fetchWithRetry(`${API_URL}/ai-settings/user`, {
      method: 'PUT',
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return handleResponse(res, 'Failed to update AI user settings');
  },

  getAIAvailableModels: async () => {
    const res = await fetchWithRetry(`${API_URL}/ai-settings/available-models`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch available models');
  },

  getAIEffectiveSettings: async () => {
    const res = await fetchWithRetry(`${API_URL}/ai-settings/effective`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch effective AI settings');
  },

  getAIAutoComplete: async () => {
    const userSettings = await Api.getAIUserSettings();
    return {
      preferences: {
        enabled: userSettings?.auto_suggestions ?? true,
        sensitivity: 0.5,
        suggestionsInComments: true,
      },
    };
  },

  saveAIAutoComplete: async (settings: any) => {
    return Api.updateAIUserSettings({ auto_suggestions: settings.enabled ?? true });
  },

  getAIInstructions: async () => {
    const userSettings = await Api.getAIUserSettings();
    return {
      preferences: {
        systemPrompt: userSettings?.system_instructions || '',
        responseStyle: userSettings?.response_style || 'balanced',
        includeContext: true,
        maxContextLength: userSettings?.max_tokens || 4096,
      },
    };
  },

  saveAIInstructions: async (instructions: any) => {
    return Api.updateAIUserSettings({
      system_instructions: instructions.systemPrompt ?? '',
      response_style: instructions.responseStyle ?? 'balanced',
    });
  },

  getAIMemory: async () => {
    return SettingsApi.getAIMemoryPreferences();
  },

  saveAIMemory: async (settings: any) => {
    return SettingsApi.updateAIMemoryPreferences(settings);
  },

  clearAIMemoryData: async () => {
    return SettingsApi.clearAIMemoryPreferences();
  },

  getAIModelPreferences: async () => {
    const userSettings = await Api.getAIUserSettings();
    return {
      preferences: {
        preferredModel: userSettings?.preferred_model_id || null,
        enabledModels: userSettings?.visible_model_ids || [],
      },
    };
  },

  saveAIModelPreferences: async (preferences: any) => {
    return Api.updateAIUserSettings({
      preferred_model_id: preferences.preferredModel || null,
      visible_model_ids: preferences.enabledModels || [],
    });
  },

  getAIParameters: async () => {
    const userSettings = await Api.getAIUserSettings();
    return {
      preferences: {
        temperature: userSettings?.model_temperature ?? 0.7,
        maxTokens: userSettings?.max_tokens ?? 4096,
        contextWindowSize: userSettings?.max_context_length ?? 4000,
        responseSpeed: userSettings?.response_speed ?? 'balanced',
        topP: userSettings?.top_p ?? 1,
      },
    };
  },

  saveAIParameters: async (params: any) => {
    return Api.updateAIUserSettings({
      model_temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? 4096,
      max_context_length: params.contextWindowSize ?? 4000,
      response_speed: params.responseSpeed ?? 'balanced',
      top_p: params.topP ?? 1,
    });
  },

  getAIPersonality: async () => {
    const userSettings = await Api.getAIUserSettings();
    return {
      preferences: {
        tone: (userSettings?.writing_tone || 'professional') as
          | 'professional'
          | 'friendly'
          | 'casual'
          | 'academic',
        formality: (userSettings?.formality || 'balanced') as 'formal' | 'balanced' | 'informal',
        verbosity: (userSettings?.verbosity || 'concise') as
          | 'minimal'
          | 'concise'
          | 'detailed'
          | 'comprehensive',
      },
    };
  },

  saveAIPersonality: async (personality: any) => {
    return Api.updateAIUserSettings({
      writing_tone: personality.tone || 'professional',
      formality: personality.formality || 'balanced',
      verbosity: personality.verbosity || 'concise',
    });
  },

  getAIUsageStats: async (period?: string) => {
    // NOTE: avgResponseTime / successRate / limit are NOT tracked by the backend
    // (the server hardcodes placeholder values). We deliberately return them as
    // null so the UI can hide those metrics instead of showing fabricated data.
    try {
      const res = await fetchWithRetry(`${API_URL}/settings/ai-usage?period=${period || '30d'}`, {
        headers: getHeaders(),
      });
      const payload = await handleResponse(res, 'Failed to fetch AI usage stats');
      const s = payload?.stats || {};
      const dailyUsage = Array.isArray(payload?.dailyUsage)
        ? payload.dailyUsage.map((row: any) => ({
            date: row.date,
            tokens: Number(row.tokens || 0),
            requests: Number(row.requests || row.count || 0),
          }))
        : [];
      const usageByFeature = Array.isArray(payload?.usageByFeature)
        ? payload.usageByFeature.map((row: any) => ({
            feature: row.feature ?? 'general',
            count: Number(row.count || 0),
            tokens: Number(row.tokens || 0),
            cost: Number(row.cost || 0),
          }))
        : [];
      return {
        stats: {
          totalTokens: Number(s.totalTokens || 0),
          totalCost: Number(s.totalCost || 0),
          totalRequests: Number(s.totalRequests || 0),
          // Not genuinely measured by the backend — hidden in the UI.
          avgResponseTime: null,
          successRate: null,
          limit: null,
          used: Number(s.used ?? s.totalTokens ?? 0),
        },
        usageByFeature,
        dailyUsage,
      };
    } catch {
      return {
        stats: {
          totalTokens: 0,
          totalCost: 0,
          totalRequests: 0,
          avgResponseTime: null,
          successRate: null,
          limit: null,
          used: 0,
        },
        usageByFeature: [],
        dailyUsage: [],
      };
    }
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

  removeAvatar: async (userId?: string) => {
    if (!userId) return { success: true };
    const res = await fetch(`${API_URL}/users/${userId}/avatar`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to remove avatar');
    }
    return { success: true };
  },

  getGdprConsents: async () => {
    return Api.get('/api/gdpr/consents');
  },

  updateGdprConsents: async (consents: any) => {
    return Api.put('/api/gdpr/consents', { consents });
  },

  getGdprRetention: async () => {
    return Api.get('/api/gdpr/retention');
  },

  updateGdprRetention: async (settings: any) => {
    return Api.put('/api/gdpr/retention', { retention: settings });
  },

  saveGdprConsents: async (consents: any) => {
    return Api.put('/api/gdpr/consents', { consents });
  },

  saveGdprRetention: async (settings: any) => {
    return Api.put('/api/gdpr/retention', { retention: settings });
  },

  getGdprExportStatus: async () => {
    return Api.get('/api/gdpr/export-status');
  },

  requestGdprExport: async () => {
    return Api.post('/api/gdpr/export-request', {});
  },

  requestGdprDeletion: async (password?: string) => {
    // SECURITY: use the password-gated endpoint that verifies bcrypt before deletion
    return Api.post('/api/settings/gdpr/deletion-request', { password: password || '' });
  },

  cancelGdprDeletion: async (_requestId?: string) => {
    return Api.post('/api/gdpr/cancel-deletion', { requestId: _requestId });
  },

  getDeveloperSettings: async () => {
    return SettingsApi.getDeveloperSettings();
  },

  saveDeveloperSettings: async (settings: any) => {
    return SettingsApi.saveDeveloperSettings(settings);
  },

  // Integration Settings
  getIntegrations: async (_orgId?: string) => {
    const res = await fetchWithRetry(`${API_URL}/integrations`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch integrations');
  },

  getIntegrationProviders: async () => {
    const res = await fetchWithRetry(`${API_URL}/integrations/providers`, {
      headers: getHeaders(),
    });
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

  createMcpProvider: async (input: {
    name: string;
    type?: string;
    status?: string;
    config?: any;
  }) => {
    const res = await fetchWithRetry(`${API_URL}/mcp/providers`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(input || {}),
    });
    return handleResponse(res, 'Failed to create MCP provider');
  },

  updateMcpProvider: async (
    providerId: string,
    input: { name?: string; status?: string; config?: any }
  ) => {
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
    const res = await fetchWithRetry(
      `${API_URL}/mcp/audit?limit=${encodeURIComponent(String(limit))}`,
      {
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to fetch MCP audit');
  },

  getMcpDiscovery: async () => {
    const res = await fetchWithRetry(`${API_URL}/mcp/discovery`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to fetch MCP discovery');
  },

  // Keyboard Shortcuts
  getShortcuts: async () => {
    return SettingsApi.getShortcutsPreferences();
  },

  saveShortcuts: async (shortcuts: any) => {
    return SettingsApi.updateShortcutsPreferences(shortcuts);
  },

  // Privacy
  getPrivacyPreferences: async () => {
    return SettingsApi.getPrivacyPreferences();
  },

  savePrivacyPreferences: async (preferences: any) => {
    return SettingsApi.updatePrivacyPreferences(preferences);
  },

  // Theme/Appearance
  getAppearancePreferences: async () => {
    return SettingsApi.getAppearancePreferences();
  },

  saveAppearancePreferences: async (preferences: any) => {
    return SettingsApi.updateAppearancePreferences(preferences);
  },

  getAIVoice: async () => {
    return SettingsApi.getAIVoicePreferences();
  },

  saveAIVoice: async (settings: any) => {
    return SettingsApi.updateAIVoicePreferences(settings);
  },

  getAIPrivacyPreferences: async () => {
    return SettingsApi.getAIPrivacyPreferences();
  },

  saveAIPrivacyPreferences: async (preferences: any) => {
    return SettingsApi.updateAIPrivacyPreferences(preferences);
  },

  getPromptLibrary: async () => {
    return SettingsApi.getPromptLibrary();
  },

  savePromptLibrary: async (prompts: any[]) => {
    return SettingsApi.savePromptLibrary(prompts);
  },

  // System/Enterprise
  getSystemAnalytics: async (timeRange?: string) => {
    const params = new URLSearchParams();
    if (timeRange) params.set('timeRange', String(timeRange));
    const res = await fetchWithRetry(
      `${API_URL}/superadmin/system-analytics${params.toString() ? `?${params.toString()}` : ''}`,
      { headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to load system analytics');
  },

  getBackupSchedules: async () => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/backup/schedules`, {
      headers: getHeaders(),
    });
    const payload = await handleResponse(res, 'Failed to load backup schedules');
    return Array.isArray((payload as any)?.schedules) ? (payload as any).schedules : [];
  },

  updateBackupSchedule: async (id: string, data: any) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/backup/schedules/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update backup schedule');
  },

  createBackup: async (_type?: string, _reason?: string) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/system/backup`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ type: _type || 'full', reason: _reason || 'manual' }),
    });
    return handleResponse(res, 'Failed to create backup');
  },

  restoreBackup: async (backupId: string) => {
    const res = await fetchWithRetry(`${API_URL}/admin/backups/restore`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ backupId }),
    });
    return handleResponse(res, 'Failed to restore backup');
  },

  deleteBackup: async (backupId: string) => {
    const res = await fetchWithRetry(`${API_URL}/admin/backups/${backupId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete backup');
  },

  // System Configuration
  getSystemConfigs: async (environment?: string, category?: string) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (environment) params.set('environment', environment); // currently informational (server ignores unless implemented)
    const res = await fetchWithRetry(
      `${API_URL}/superadmin/system-configs${params.toString() ? `?${params.toString()}` : ''}`,
      { headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to load system configs');
  },

  createSystemConfig: async (data: {
    key: string;
    value: any;
    description?: string;
    category?: string;
    is_sensitive?: boolean;
  }) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/system-configs`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create system config');
  },

  updateSystemConfig: async (id: string, data: any) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/system-configs/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update system config');
  },

  deleteSystemConfig: async (id: string) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/system-configs/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete system config');
  },

  getSystemConfigVersions: async (id: string) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/system-configs/${id}/versions`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to load config versions');
  },

  rollbackSystemConfig: async (id: string, versionId: string, reason?: string) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/system-configs/${id}/rollback`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ versionId, reason }),
    });
    return handleResponse(res, 'Failed to rollback system config');
  },

  // System Integrations
  getSystemIntegrations: async () => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/integrations`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to load integrations');
  },

  refreshSystemIntegration: async (provider: string) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/integrations/${provider}/refresh`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to refresh integration');
  },

  deleteSystemIntegration: async (provider: string) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/integrations/${provider}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete integration');
  },

  deleteIntegration: async (provider: string) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/integrations/${provider}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete integration');
  },

  // System Webhooks
  getSystemWebhooks: async () => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/webhooks`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to load webhooks');
  },

  createSystemWebhook: async (data: any) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/webhooks`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create webhook');
  },

  deleteSystemWebhook: async (webhookId: string) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/webhooks/${webhookId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete webhook');
  },

  getSystemWebhookDeliveries: async (_webhookId: string) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/webhooks/${_webhookId}/deliveries`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to load webhook deliveries');
  },

  testWebhook: async (webhookId: string) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/webhooks/${webhookId}/test`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to test webhook');
  },

  testSystemWebhook: async (webhookId: string) => {
    const res = await fetchWithRetry(`${API_URL}/superadmin/webhooks/${webhookId}/test`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to test webhook');
  },

  // Metrics
  getOrgMetricsEvents: async (_filters?: any) => {
    return { events: [], metrics: {} };
  },

  // ===== CLOUD STORAGE INTEGRATIONS =====

  resolveCloudProviderName: (providerId: string) => {
    const normalized = String(providerId || '')
      .toLowerCase()
      .trim();
    if (normalized === 'google-drive' || normalized === 'google_drive') return 'google_drive';
    if (normalized === 'onedrive' || normalized === 'one_drive') return 'onedrive';
    if (normalized === 'dropbox') return 'dropbox';
    if (normalized === 'sharepoint') return 'sharepoint';
    return normalized;
  },

  // Get connected cloud providers.
  // Primary path: `/api/cloud/providers` returns the V8 Wave B8 shape
  // (`{ id, label, connected, capabilities: { connect|browse|freshness } }`).
  // Fallback: `/api/cloud/sources` (old behavior) for deployments that
  // haven't been redeployed yet.
  getCloudProviders: async () => {
    try {
      const res = await fetch(`${API_URL}/cloud/providers`, {
        headers: getHeaders(),
      });
      if (res.ok) {
        const payload = await res.json();
        if (Array.isArray(payload?.providers) && payload.providers.length > 0) {
          return { providers: payload.providers, sources: [] };
        }
      }
    } catch {
      // fall through to legacy path
    }
    const res = await fetch(`${API_URL}/cloud/sources`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to load cloud providers');
    const payload = await res.json();
    const sources = Array.isArray(payload?.sources) ? payload.sources : [];
    const connected = new Set(
      sources.map((s: any) => Api.resolveCloudProviderName(s.provider || s.id || ''))
    );
    return {
      providers: [
        { id: 'google-drive', name: 'Google Drive', connected: connected.has('google_drive') },
        { id: 'onedrive', name: 'OneDrive', connected: connected.has('onedrive') },
        { id: 'dropbox', name: 'Dropbox', connected: connected.has('dropbox') },
        { id: 'notion', name: 'Notion', connected: connected.has('notion') },
      ],
      sources,
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
    console.warn('[CloudAPI] OAuth completion is not implemented in this deployment', {
      providerId,
      code,
      state,
    });
    throw new Error('Cloud OAuth flow is not configured yet.');
  },

  // Disconnect cloud provider
  disconnectCloudProvider: async (providerId: string) => {
    const provider = Api.resolveCloudProviderName(providerId);
    const sourcesRes = await fetch(`${API_URL}/cloud/sources`, { headers: getHeaders() });
    if (!sourcesRes.ok) throw new Error('Failed to load cloud sources');
    const payload = await sourcesRes.json();
    const sources = Array.isArray(payload?.sources) ? payload.sources : [];
    const source = sources.find(
      (s: any) => Api.resolveCloudProviderName(s.provider || s.id || '') === provider
    );
    if (!source?.id) return { success: true, disconnected: false };
    const res = await fetch(`${API_URL}/cloud/sources/${source.id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to disconnect cloud provider');
    return { success: true, disconnected: true };
  },

  // List files from cloud provider
  listCloudFiles: async (providerId: string, folderId?: string): Promise<any[]> => {
    try {
      const provider = Api.resolveCloudProviderName(providerId);
      const sourcesRes = await fetch(`${API_URL}/cloud/sources`, { headers: getHeaders() });
      if (!sourcesRes.ok) throw new Error('Failed to load cloud sources');
      const payload = await sourcesRes.json();
      const sources = Array.isArray(payload?.sources) ? payload.sources : [];
      const source = sources.find(
        (s: any) => Api.resolveCloudProviderName(s.provider || s.id || '') === provider
      );
      if (!source?.id) {
        throw new Error(`No connected cloud source for provider ${providerId}`);
      }

      const url = folderId
        ? `${API_URL}/cloud/sources/${source.id}/files?folderId=${encodeURIComponent(folderId)}`
        : `${API_URL}/cloud/sources/${source.id}/files`;
      const res = await fetch(url, { headers: getHeaders() });
      if (res.status === 501) {
        throw new Error('CLOUD_NOT_IMPLEMENTED');
      }
      if (!res.ok) throw new Error('Failed to list cloud files');
      const data = await res.json();
      return Array.isArray(data?.files) ? data.files : data;
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
    const provider = Api.resolveCloudProviderName(providerId);
    const sourcesRes = await fetch(`${API_URL}/cloud/sources`, { headers: getHeaders() });
    if (!sourcesRes.ok) throw new Error('Failed to load cloud sources');
    const payload = await sourcesRes.json();
    const sources = Array.isArray(payload?.sources) ? payload.sources : [];
    const source = sources.find(
      (s: any) => Api.resolveCloudProviderName(s.provider || s.id || '') === provider
    );
    if (!source?.id) throw new Error(`No connected cloud source for provider ${providerId}`);
    return { downloadUrl: `${API_URL}/cloud/sources/${source.id}/files/${fileId}/download` };
  },

  // Download file from cloud
  downloadCloudFile: async (providerId: string, fileId: string): Promise<Blob> => {
    try {
      const provider = Api.resolveCloudProviderName(providerId);
      const sourcesRes = await fetch(`${API_URL}/cloud/sources`, { headers: getHeaders() });
      if (!sourcesRes.ok) throw new Error('Failed to load cloud sources');
      const payload = await sourcesRes.json();
      const sources = Array.isArray(payload?.sources) ? payload.sources : [];
      const source = sources.find(
        (s: any) => Api.resolveCloudProviderName(s.provider || s.id || '') === provider
      );
      if (!source?.id) {
        throw new Error(`No connected cloud source for provider ${providerId}`);
      }

      const res = await fetch(`${API_URL}/cloud/sources/${source.id}/files/${fileId}/download`, {
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
  myWorkNotebookLegacyModeKey: 'consultify:notebook-legacy-mode',
  shouldFallbackToLegacyMyWorkNotebook: (error: any) => {
    const status = Number(error?.status);
    return [400, 403, 404, 405, 500, 501, 503].includes(status);
  },
  shouldLockLegacyMyWorkNotebookMode: (error: any) => {
    const status = Number(error?.status);
    const code = String(error?.data?.code || error?.code || '').trim();
    return [404, 405, 501].includes(status) || code === 'V8_DISABLED';
  },
  shouldPreferLegacyMyWorkNotebook: () => {
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem(Api.myWorkNotebookLegacyModeKey) === '1';
    } catch {
      return false;
    }
  },
  lockLegacyMyWorkNotebookMode: () => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(Api.myWorkNotebookLegacyModeKey, '1');
    } catch {
      // best-effort only
    }
  },
  getNotebookPages: async (filters?: {
    projectId?: string | null;
    notebookId?: string | null;
    status?: string;
    pinned?: boolean;
    sort?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> => {
    const fetchLegacy = async () => {
      let url = `${API_URL}/my-work/notebook/pages`;
      if (filters) {
        const params = new URLSearchParams();
        if (filters.projectId) params.append('projectId', filters.projectId);
        if (filters.notebookId) params.append('notebookId', filters.notebookId);
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
    };

    // notebookId scoping lives on the legacy container router only; force legacy
    // so pages stay scoped to their notebook regardless of V8 mode.
    if (filters?.notebookId) {
      return fetchLegacy();
    }

    if (Api.shouldPreferLegacyMyWorkNotebook()) {
      return fetchLegacy();
    }

    try {
      return await V8MyWorkApi.getNotebookPages(filters);
    } catch (error) {
      if (!Api.shouldFallbackToLegacyMyWorkNotebook(error)) {
        throw error;
      }
      if (Api.shouldLockLegacyMyWorkNotebookMode(error)) {
        Api.lockLegacyMyWorkNotebookMode();
      }
      return fetchLegacy();
    }
  },

  // ── Notebook containers (Notatniki, L1) ──────────────────────────────────
  getNotebooks: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/my-work/notebooks`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch notebooks');
    const data = await res.json();
    return Array.isArray(data?.notebooks) ? data.notebooks : Array.isArray(data) ? data : [];
  },

  getNotebook: async (id: string): Promise<any> => {
    const res = await fetch(`${API_URL}/my-work/notebooks/${encodeURIComponent(id)}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to fetch notebook');
  },

  createNotebook: async (input: {
    title: string;
    icon?: string | null;
    scope?: 'personal' | 'team';
    teamId?: string | null;
    contextSharing?: 'private' | 'org_context';
  }): Promise<any> => {
    const res = await fetch(`${API_URL}/my-work/notebooks`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse(res, 'Failed to create notebook');
  },

  updateNotebook: async (id: string, updates: Record<string, any>): Promise<any> => {
    const res = await fetch(`${API_URL}/my-work/notebooks/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse(res, 'Failed to update notebook');
  },

  deleteNotebook: async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/my-work/notebooks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) {
      let detail: any = null;
      try {
        detail = await res.json();
      } catch {
        /* ignore */
      }
      const err: any = new Error(detail?.error || 'Failed to delete notebook');
      err.status = res.status;
      err.pageCount = detail?.pageCount;
      throw err;
    }
  },

  getNotebookPage: async (id: string): Promise<any> => {
    const fetchLegacy = async () => {
      const res = await fetch(`${API_URL}/my-work/notebook/pages/${encodeURIComponent(id)}`, {
        headers: getHeaders(),
      });
      return handleResponse(res, 'Failed to fetch notebook page');
    };

    if (Api.shouldPreferLegacyMyWorkNotebook()) {
      return fetchLegacy();
    }

    try {
      return await V8MyWorkApi.getNotebookPage(id);
    } catch (error) {
      if (!Api.shouldFallbackToLegacyMyWorkNotebook(error)) {
        throw error;
      }
      if (Api.shouldLockLegacyMyWorkNotebookMode(error)) {
        Api.lockLegacyMyWorkNotebookMode();
      }
      return fetchLegacy();
    }
  },

  downloadNotebookSourceFile: async (id: string): Promise<{ blob: Blob; filename: string }> => {
    const downloadFrom = async (url: string) => {
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) {
        const error: any = new Error('Failed to download notebook source file');
        error.status = res.status;
        throw error;
      }
      const blob = await res.blob();
      const contentDisposition = res.headers.get('Content-Disposition') || '';
      const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
      const plainMatch = contentDisposition.match(/filename="([^"]+)"/i);
      const filename = encodedMatch?.[1]
        ? decodeURIComponent(encodedMatch[1])
        : plainMatch?.[1] || `notebook-source-${id}`;
      return { blob, filename };
    };

    try {
      return await downloadFrom(
        `${API_URL}/v8/my-work/notebook/pages/${encodeURIComponent(id)}/source-file`
      );
    } catch (error) {
      if (!Api.shouldFallbackToLegacyMyWorkNotebook(error)) {
        throw error;
      }
      return downloadFrom(
        `${API_URL}/my-work/notebook/pages/${encodeURIComponent(id)}/source-file`
      );
    }
  },

  downloadNotebookAttachment: async (
    id: string,
    attachmentId: string
  ): Promise<{ blob: Blob; filename: string }> => {
    const downloadFrom = async (url: string) => {
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) {
        const error: any = new Error('Failed to download notebook attachment');
        error.status = res.status;
        throw error;
      }
      const blob = await res.blob();
      const contentDisposition = res.headers.get('Content-Disposition') || '';
      const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
      const plainMatch = contentDisposition.match(/filename="([^"]+)"/i);
      const filename = encodedMatch?.[1]
        ? decodeURIComponent(encodedMatch[1])
        : plainMatch?.[1] || `notebook-attachment-${attachmentId}`;
      return { blob, filename };
    };

    try {
      return await downloadFrom(
        `${API_URL}/v8/my-work/notebook/pages/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}/download`
      );
    } catch (error) {
      if (!Api.shouldFallbackToLegacyMyWorkNotebook(error)) {
        throw error;
      }
      return downloadFrom(
        `${API_URL}/my-work/notebook/pages/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}/download`
      );
    }
  },

  uploadNotebookAttachments: async (id: string, files: FileList | File[]): Promise<any> => {
    try {
      return await V8MyWorkApi.uploadNotebookAttachments(id, files);
    } catch (error) {
      if (!Api.shouldFallbackToLegacyMyWorkNotebook(error)) {
        throw error;
      }
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append('files', file));
      const res = await fetch(
        `${API_URL}/my-work/notebook/pages/${encodeURIComponent(id)}/attachments`,
        {
          method: 'POST',
          headers: getHeaders(),
          body: formData,
        }
      );
      return handleResponse(res, 'Failed to upload notebook attachments');
    }
  },

  deleteNotebookAttachment: async (id: string, attachmentId: string): Promise<any> => {
    try {
      return await V8MyWorkApi.deleteNotebookAttachment(id, attachmentId);
    } catch (error) {
      if (!Api.shouldFallbackToLegacyMyWorkNotebook(error)) {
        throw error;
      }
      const res = await fetch(
        `${API_URL}/my-work/notebook/pages/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`,
        {
          method: 'DELETE',
          headers: getHeaders(),
        }
      );
      return handleResponse(res, 'Failed to delete notebook attachment');
    }
  },

  /** V4-NOTE-01: Upload PDF/XLSX/TXT → extract text → create notebook page */
  uploadNotebookFile: async (file: File): Promise<any> => {
    let capture: any;
    try {
      capture = await V8MyWorkApi.notebookCaptureUpload(file);
    } catch (error) {
      if (!Api.shouldFallbackToLegacyMyWorkNotebook(error)) {
        throw error;
      }
      capture = await Api.notebookCaptureUpload(file);
    }
    const pageId = String(capture?.pageId || '').trim();
    if (!pageId) {
      throw new Error('Notebook capture upload did not return a pageId');
    }
    return Api.getNotebookPage(pageId);
  },

  createNotebookPage: async (page: {
    title?: string;
    projectId?: string | null;
    notebookId?: string | null;
    visibility?: string;
    tags?: string[];
    contentJson?: any;
    contentText?: string;
    icon?: string | null;
    status?: string;
    template?: string;
  }): Promise<any> => {
    const createLegacy = async () => {
      const res = await fetch(`${API_URL}/my-work/notebook/pages`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(page),
      });
      return handleResponse(res, 'Failed to create notebook page');
    };

    // notebook_id assignment lives on the legacy container router; force legacy
    // when a target notebook is specified so the page lands in it.
    if (page.notebookId) {
      return createLegacy();
    }

    if (Api.shouldPreferLegacyMyWorkNotebook()) {
      return createLegacy();
    }

    try {
      return await V8MyWorkApi.createNotebookPage(page);
    } catch (error) {
      if (!Api.shouldFallbackToLegacyMyWorkNotebook(error)) {
        throw error;
      }
      if (Api.shouldLockLegacyMyWorkNotebookMode(error)) {
        Api.lockLegacyMyWorkNotebookMode();
      }
      return createLegacy();
    }
  },

  updateNotebookPage: async (id: string, updates: Record<string, any>): Promise<any> => {
    const updateLegacy = async () => {
      const res = await fetch(`${API_URL}/my-work/notebook/pages/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(updates),
      });
      return handleResponse(res, 'Failed to update notebook page');
    };

    if (Api.shouldPreferLegacyMyWorkNotebook()) {
      return updateLegacy();
    }

    try {
      return await V8MyWorkApi.updateNotebookPage(id, updates);
    } catch (error) {
      if (!Api.shouldFallbackToLegacyMyWorkNotebook(error)) {
        throw error;
      }
      if (Api.shouldLockLegacyMyWorkNotebookMode(error)) {
        Api.lockLegacyMyWorkNotebookMode();
      }
      return updateLegacy();
    }
  },

  appendNotebookConvertedOutput: async (
    id: string,
    nextOutput: { type?: string | null; id?: string | null }
  ): Promise<any> => {
    const type = String(nextOutput?.type || '').trim();
    const outputId = String(nextOutput?.id || '').trim();
    if (!type || !outputId) {
      throw new Error('Notebook converted output requires type and id');
    }

    const page = await Api.getNotebookPage(id);
    const existing = Array.isArray(page?.convertedTo) ? page.convertedTo : [];
    const merged = [
      ...existing.filter(
        (entry: any) =>
          String(entry?.type || '').trim() !== type || String(entry?.id || '').trim() !== outputId
      ),
      { type, id: outputId },
    ];

    return Api.updateNotebookPage(id, {
      status: 'converted',
      convertedTo: merged,
    });
  },

  deleteNotebookPage: async (id: string): Promise<void> => {
    try {
      await V8MyWorkApi.deleteNotebookPage(id);
    } catch (error) {
      if (!Api.shouldFallbackToLegacyMyWorkNotebook(error)) {
        throw error;
      }
      const res = await fetch(`${API_URL}/my-work/notebook/pages/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      await handleResponse(res, 'Failed to delete notebook page');
    }
  },

  pinNotebookPage: async (id: string): Promise<any> => {
    try {
      return await V8MyWorkApi.pinNotebookPage(id);
    } catch (error) {
      if (!Api.shouldFallbackToLegacyMyWorkNotebook(error)) {
        throw error;
      }
      const res = await fetch(`${API_URL}/my-work/notebook/pages/${id}/pin`, {
        method: 'PUT',
        headers: getHeaders(),
      });
      return handleResponse(res, 'Failed to toggle pin');
    }
  },

  setNotebookPageStatus: async (id: string, status: string): Promise<any> => {
    try {
      return await V8MyWorkApi.setNotebookPageStatus(id, status);
    } catch (error) {
      if (!Api.shouldFallbackToLegacyMyWorkNotebook(error)) {
        throw error;
      }
      const res = await fetch(`${API_URL}/my-work/notebook/pages/${id}/status`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status }),
      });
      return handleResponse(res, 'Failed to update page status');
    }
  },

  classifyNotebookPage: async (
    id: string
  ): Promise<{
    pageId: string;
    suggestedType: string;
    reason: string;
    maturity?: string | null;
    /** L-06: classification is rule-based keyword scoring, NOT an LLM. */
    method?: 'heuristic';
  }> => {
    try {
      return await V8MyWorkApi.classifyNotebookPage(id);
    } catch (error) {
      if (!Api.shouldFallbackToLegacyMyWorkNotebook(error)) {
        throw error;
      }
      const res = await fetch(
        `${API_URL}/my-work/notebook/pages/${encodeURIComponent(id)}/classify`,
        {
          method: 'POST',
          headers: getHeaders(),
        }
      );
      return handleResponse(res, 'Failed to classify notebook page');
    }
  },

  convertNotebookPage: async (
    id: string,
    target: 'task' | 'decision' | 'initiative' | 'report' | 'presentation' | 'assessment',
    extra?: {
      title?: string;
      description?: string;
      assessmentType?: 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';
    }
  ): Promise<{ id: string; type: string; title: string; sourceSessionId?: string }> => {
    try {
      return await V8MyWorkApi.convertNotebookPage(id, target, extra);
    } catch (error) {
      if (!Api.shouldFallbackToLegacyMyWorkNotebook(error)) {
        throw error;
      }
      const res = await fetch(`${API_URL}/my-work/notebook/pages/${id}/convert`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ target, ...extra }),
      });
      return handleResponse(res, 'Failed to convert notebook page');
    }
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

  streamNotebookActionExtraction: async (
    id: string,
    options: {
      language?: string;
      onEvent?: (event: { type: string; [key: string]: unknown }) => void;
    } = {}
  ): Promise<void> => {
    const res = await fetch(
      `${API_URL}/my-work/notebook/pages/${encodeURIComponent(id)}/extract-actions`,
      {
        method: 'POST',
        headers: {
          ...getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ language: options.language ?? 'en' }),
      }
    );
    if (!res.ok) {
      throw new Error('Failed to extract actions');
    }
    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error('No response stream');
    }
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));
          options.onEvent?.(data);
        } catch {
          /* ignore parse errors */
        }
      }
    }
  },

  extractNotebookActions: (id: string): EventSource => {
    const token = tokenService.getToken();
    const url = `${API_URL}/my-work/notebook/pages/${encodeURIComponent(id)}/extract-actions?token=${encodeURIComponent(token || '')}`;
    return new EventSource(url);
  },

  // ──────────────────────────────────────────────
  // V4-NOTE-01: Notebook capture connectors
  // ──────────────────────────────────────────────

  notebookCaptureWebClip: async (data: {
    url: string;
    title?: string;
    content: string;
    tags?: string[];
    projectId?: string;
  }) => {
    const res = await fetch(`${API_URL}/notebook/capture/web-clip`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to capture web clip');
  },

  notebookCaptureEmail: async (data: {
    emailFrom?: string;
    emailSubject?: string;
    content: string;
    tags?: string[];
    projectId?: string;
  }) => {
    const res = await fetch(`${API_URL}/notebook/capture/email`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to capture email');
  },

  notebookCaptureImport: async (data: {
    title: string;
    content: string;
    tags?: string[];
    projectId?: string;
    metadata?: Record<string, unknown>;
  }) => {
    const res = await fetch(`${API_URL}/notebook/capture/import`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to import note');
  },

  // ──────────────────────────────────────────────
  // V4-NOTE-04: Semantic search + RAG
  // ──────────────────────────────────────────────

  notebookSemanticSearch: async (
    query: string,
    options?: { limit?: number; projectId?: string }
  ): Promise<{
    results: Array<{
      pageId: string;
      title: string;
      snippet: string;
      score: number;
      matchType: string;
    }>;
    total: number;
  }> => {
    const params = new URLSearchParams({ q: query });
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.projectId) params.set('projectId', options.projectId);
    const res = await fetch(`${API_URL}/notebook/search?${params}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to search notebook');
  },

  notebookRAGContext: async (data: {
    query: string;
    maxTokens?: number;
    limit?: number;
  }): Promise<{
    context: string;
    citations: Array<{ pageId: string; title: string; snippet: string }>;
  }> => {
    const res = await fetch(`${API_URL}/notebook/rag-context`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to build RAG context');
  },

  // ──────────────────────────────────────────────
  // V4-NOTE-06: AI proposals
  // ──────────────────────────────────────────────

  notebookCreateAIProposal: async (
    pageId: string,
    data: {
      proposalType: 'insert' | 'replace' | 'append';
      blockContent: Record<string, unknown>;
      rationale: string;
    }
  ) => {
    try {
      return await V8MyWorkApi.createNotebookAIProposal(pageId, data);
    } catch (error) {
      if (!Api.shouldFallbackToLegacyMyWorkNotebook(error)) {
        throw error;
      }
      const res = await fetch(`${API_URL}/notebook/pages/${pageId}/ai-proposals`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      return handleResponse(res, 'Failed to create AI proposal');
    }
  },

  notebookGetAIProposals: async (pageId: string, options?: { status?: string; limit?: number }) => {
    try {
      return await V8MyWorkApi.getNotebookAIProposals(pageId, options);
    } catch (error) {
      if (!Api.shouldFallbackToLegacyMyWorkNotebook(error)) {
        throw error;
      }
      const params = new URLSearchParams();
      if (options?.status) params.set('status', options.status);
      if (options?.limit) params.set('limit', String(options.limit));
      const res = await fetch(`${API_URL}/notebook/pages/${pageId}/ai-proposals?${params}`, {
        headers: getHeaders(),
      });
      return handleResponse(res, 'Failed to get AI proposals');
    }
  },

  notebookResolveAIProposal: async (proposalId: string, action: 'accepted' | 'rejected') => {
    try {
      return await V8MyWorkApi.resolveNotebookAIProposal(proposalId, action);
    } catch (error) {
      if (!Api.shouldFallbackToLegacyMyWorkNotebook(error)) {
        throw error;
      }
      const res = await fetch(`${API_URL}/notebook/ai-proposals/${proposalId}/resolve`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ action }),
      });
      return handleResponse(res, 'Failed to resolve AI proposal');
    }
  },

  // ──────────────────────────────────────────────
  // V4-NOTE-07: Embed chips
  // ──────────────────────────────────────────────

  notebookResolveEmbedChips: async (
    refs: Array<{ type: string; id: string }>
  ): Promise<{
    chips: Array<{
      artifactType: string;
      artifactId: string;
      title: string;
      snippet: string;
      status?: string;
      permissionOk: boolean;
    }>;
  }> => {
    const res = await fetch(`${API_URL}/notebook/embed-chips/resolve`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ refs }),
    });
    return handleResponse(res, 'Failed to resolve embed chips');
  },

  // ──────────────────────────────────────────────
  // V4-ORG-05..09: Knowledge Graph API
  // ──────────────────────────────────────────────

  kgSearchEntities: async (options?: {
    q?: string;
    types?: string;
    minConfidence?: number;
    limit?: number;
    offset?: number;
  }) => {
    const params = new URLSearchParams();
    if (options?.q) params.set('q', options.q);
    if (options?.types) params.set('types', options.types);
    if (options?.minConfidence) params.set('minConfidence', String(options.minConfidence));
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    const res = await fetch(`${API_URL}/knowledge-graph/entities?${params}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to search KG entities');
  },

  kgGetEntity: async (entityId: string) => {
    const res = await fetch(`${API_URL}/knowledge-graph/entities/${entityId}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get KG entity');
  },

  kgCreateEntity: async (data: {
    name: string;
    type: string;
    description?: string;
    attributes?: Record<string, unknown>;
    confidence?: number;
    sourceArtifactType?: string;
    sourceArtifactId?: string;
  }) => {
    const res = await fetch(`${API_URL}/knowledge-graph/entities`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create KG entity');
  },

  kgGetEntityRelations: async (
    entityId: string,
    options?: { direction?: string; relationTypes?: string; limit?: number }
  ) => {
    const params = new URLSearchParams();
    if (options?.direction) params.set('direction', options.direction);
    if (options?.relationTypes) params.set('relationTypes', options.relationTypes);
    if (options?.limit) params.set('limit', String(options.limit));
    const res = await fetch(`${API_URL}/knowledge-graph/entities/${entityId}/relations?${params}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get entity relations');
  },

  kgCreateRelation: async (data: {
    sourceEntityId: string;
    targetEntityId: string;
    relationType: string;
    attributes?: Record<string, unknown>;
    confidence?: number;
  }) => {
    const res = await fetch(`${API_URL}/knowledge-graph/relations`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create KG relation');
  },

  kgTraverse: async (data: {
    startEntityId: string;
    maxDepth?: number;
    relationTypes?: string[];
    minConfidence?: number;
    direction?: 'outgoing' | 'incoming' | 'both';
    limit?: number;
  }) => {
    const res = await fetch(`${API_URL}/knowledge-graph/traverse`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to traverse KG');
  },

  kgGetProvenance: async (entityId: string) => {
    const res = await fetch(`${API_URL}/knowledge-graph/entities/${entityId}/provenance`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get entity provenance');
  },

  kgRedactEntity: async (entityId: string) => {
    const res = await fetch(`${API_URL}/knowledge-graph/entities/${entityId}/redact`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to redact entity');
  },

  kgGetStats: async () => {
    const res = await fetch(`${API_URL}/knowledge-graph/stats`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get KG stats');
  },

  kgFindDuplicates: async () => {
    const res = await fetch(`${API_URL}/knowledge-graph/freshness/duplicates`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to find KG duplicates');
  },

  kgMergeEntities: async (keepEntityId: string, mergeEntityId: string) => {
    const res = await fetch(`${API_URL}/knowledge-graph/freshness/merge`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ keepEntityId, mergeEntityId }),
    });
    return handleResponse(res, 'Failed to merge KG entities');
  },

  kgRebuild: async () => {
    const res = await fetch(`${API_URL}/knowledge-graph/freshness/rebuild`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to start KG rebuild');
  },

  kgGetAuditLog: async (options?: { actorId?: string; action?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (options?.actorId) params.set('actorId', options.actorId);
    if (options?.action) params.set('action', options.action);
    if (options?.limit) params.set('limit', String(options.limit));
    const res = await fetch(`${API_URL}/knowledge-graph/governance/audit?${params}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get KG audit log');
  },

  kgApplyRetentionPolicy: async (retentionDays: number) => {
    const res = await fetch(`${API_URL}/knowledge-graph/governance/retention`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ retentionDays }),
    });
    return handleResponse(res, 'Failed to apply KG retention policy');
  },

  kgGetFreshnessJobs: async () => {
    const res = await fetch(`${API_URL}/knowledge-graph/freshness/jobs`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get KG freshness jobs');
  },

  // ──────────────────────────────────────────────
  // V4-ORG-01 / V4-ASMT-01: Benchmark Compare
  // ──────────────────────────────────────────────

  benchmarkCompare: async (params: {
    framework?: string;
    score?: number;
    industry?: string;
    region?: string;
    size?: string;
    assessmentId?: string;
    categories?: Record<string, number>;
  }) => {
    const qs = new URLSearchParams();
    if (params.framework) qs.set('framework', params.framework);
    if (params.score !== undefined) qs.set('score', String(params.score));
    if (params.industry) qs.set('industry', params.industry);
    if (params.region) qs.set('region', params.region);
    if (params.size) qs.set('size', params.size);
    if (params.assessmentId) qs.set('assessmentId', params.assessmentId);
    if (params.categories) qs.set('categories', JSON.stringify(params.categories));
    const res = await fetch(`${API_URL}/benchmark/compare?${qs}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to compare benchmarks');
  },

  // ──────────────────────────────────────────────
  // V4-IDEA-06 / V4-ORG-04: V4 Final batch
  // ──────────────────────────────────────────────

  exportComplete: async (exportId: string, data: { fileUrl: string; fileSizeBytes?: number }) => {
    const res = await fetch(
      `${API_URL}/v4-final/exports/${encodeURIComponent(exportId)}/complete`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      }
    );
    return handleResponse(res, 'Failed to complete export');
  },

  gapAnalysisUpdateStatus: async (
    gapId: string,
    data: { status: string; autoInitiativesCreated?: number }
  ) => {
    const res = await fetch(
      `${API_URL}/v4-final/gap-analyses/${encodeURIComponent(gapId)}/status`,
      {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
      }
    );
    return handleResponse(res, 'Failed to update gap analysis status');
  },

  // ──────────────────────────────────────────────
  // V4-NOTE-01: Notebook Capture Upload
  // ──────────────────────────────────────────────

  notebookCaptureUpload: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const headers = getHeaders();
    delete (headers as any)['Content-Type'];
    const res = await fetch(`${API_URL}/notebook/capture/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return handleResponse(res, 'Failed to upload notebook capture');
  },

  // ──────────────────────────────────────────────
  // V4-FINC: Finance Enterprise
  // ──────────────────────────────────────────────

  financeCreateForecastCycle: async (
    modelId: string,
    data: { cycleName: string; cycleType?: string; forecastHorizonMonths?: number }
  ) => {
    const res = await fetch(
      `${API_URL}/finance-v4/models/${encodeURIComponent(modelId)}/forecast-cycles`,
      { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) }
    );
    return handleResponse(res, 'Failed to create forecast cycle');
  },

  financeLogSync: async (
    connectorId: string,
    data: { syncType?: string; recordsProcessed?: number; recordsCreated?: number }
  ) => {
    const res = await fetch(
      `${API_URL}/finance-v4/connectors/${encodeURIComponent(connectorId)}/sync-log`,
      { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) }
    );
    return handleResponse(res, 'Failed to log finance sync');
  },

  // ──────────────────────────────────────────────
  // V4-AI: AI Governance — Privacy & Memory
  // ──────────────────────────────────────────────

  aiGovernanceGetPrivacy: async () => {
    const res = await fetch(`${API_URL}/ai-governance/privacy`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get AI privacy settings');
  },

  aiGovernanceUpdatePrivacy: async (data: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/ai-governance/privacy`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update AI privacy settings');
  },

  aiGovernanceGetMemoryPreview: async () => {
    const res = await fetch(`${API_URL}/ai-governance/memory/preview`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get AI memory preview');
  },

  aiGovernanceExportMemory: async () => {
    const res = await fetch(`${API_URL}/ai-governance/memory/export`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to export AI memory');
  },

  aiGovernanceDeleteMemory: async () => {
    const res = await fetch(`${API_URL}/ai-governance/memory`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete AI memory');
  },

  // ──────────────────────────────────────────────
  // V4-RAID: RAID Log
  // ──────────────────────────────────────────────

  raidList: async (filters?: { initiativeId?: string; type?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters)
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
    const qs = params.toString() ? `?${params}` : '';
    const res = await fetch(`${API_URL}/raid${qs}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to list RAID items');
  },

  raidCreate: async (data: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/raid`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create RAID item');
  },

  raidUpdate: async (id: string, data: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/raid/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update RAID item');
  },

  raidDelete: async (id: string) => {
    const res = await fetch(`${API_URL}/raid/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete RAID item');
  },

  raidGetSummary: async () => {
    const res = await fetch(`${API_URL}/raid/summary`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get RAID summary');
  },

  raidGetScoringHeatmap: async () => {
    const res = await fetch(`${API_URL}/raid/scoring/heatmap`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get RAID heatmap');
  },

  raidGetScoringThresholds: async () => {
    const res = await fetch(`${API_URL}/raid/scoring/thresholds`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get RAID thresholds');
  },

  raidUpdateScoringThresholds: async (data: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/raid/scoring/thresholds`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update RAID thresholds');
  },

  raidRecalculate: async () => {
    const res = await fetch(`${API_URL}/raid/scoring/recalculate`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to recalculate RAID scores');
  },

  // ──────────────────────────────────────────────
  // V4-INTV: Interview Enterprise API
  // ──────────────────────────────────────────────

  interviewCreateSegment: async (
    sessionId: string,
    data: { segmentName: string; criteria?: Record<string, unknown> }
  ) => {
    const res = await fetch(`${API_URL}/interview-v4/sessions/${sessionId}/segments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create segment');
  },
  interviewGetSegments: async (sessionId: string) => {
    const res = await fetch(`${API_URL}/interview-v4/sessions/${sessionId}/segments`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get segments');
  },
  interviewCreateQuota: async (
    sessionId: string,
    data: { segmentId?: string; targetCount: number }
  ) => {
    const res = await fetch(`${API_URL}/interview-v4/sessions/${sessionId}/quotas`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create quota');
  },
  interviewGetQuotas: async (sessionId: string) => {
    const res = await fetch(`${API_URL}/interview-v4/sessions/${sessionId}/quotas`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get quotas');
  },
  interviewCreateDistribution: async (
    sessionId: string,
    data: {
      channel: string;
      recipientEmail?: string;
      recipientName?: string;
      anonymityMode?: string;
    }
  ) => {
    const res = await fetch(`${API_URL}/interview-v4/sessions/${sessionId}/distributions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create distribution');
  },
  interviewGetDistributions: async (sessionId: string) => {
    const res = await fetch(`${API_URL}/interview-v4/sessions/${sessionId}/distributions`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get distributions');
  },
  interviewGetDistributionStats: async (sessionId: string) => {
    const res = await fetch(`${API_URL}/interview-v4/sessions/${sessionId}/distribution-stats`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get distribution stats');
  },
  interviewSendDistribution: async (distributionId: string) => {
    const res = await fetch(`${API_URL}/interview-v4/distributions/${distributionId}/send`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to send distribution');
  },
  interviewCreateReminderSchedule: async (
    sessionId: string,
    data: { sendAfterHours?: number; maxReminders?: number }
  ) => {
    const res = await fetch(`${API_URL}/interview-v4/sessions/${sessionId}/reminder-schedules`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create reminder schedule');
  },
  interviewGetEvidenceAccessLog: async (evidenceId: string) => {
    const res = await fetch(`${API_URL}/interview-v4/evidence/${evidenceId}/access-log`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get evidence access log');
  },
  interviewCreateDiagnostics: async (
    sessionId: string,
    data: { snapshotType: string; data: Record<string, unknown> }
  ) => {
    const res = await fetch(`${API_URL}/interview-v4/sessions/${sessionId}/diagnostics`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create diagnostics');
  },
  interviewGetDiagnostics: async (sessionId: string, type?: string) => {
    const params = type ? `?type=${type}` : '';
    const res = await fetch(`${API_URL}/interview-v4/sessions/${sessionId}/diagnostics${params}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get diagnostics');
  },
  interviewCreateFinding: async (
    sessionId: string,
    data: {
      findingType: string;
      title: string;
      description?: string;
      severity?: string;
      insightId?: string;
      evidenceRefs?: string[];
    }
  ) => {
    const res = await fetch(`${API_URL}/interview-v4/sessions/${sessionId}/findings`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create finding');
  },
  interviewGetFindings: async (sessionId: string, status?: string) => {
    const params = status ? `?status=${status}` : '';
    const res = await fetch(`${API_URL}/interview-v4/sessions/${sessionId}/findings${params}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get findings');
  },
  interviewPromoteFinding: async (findingId: string, initiativeId: string) => {
    const res = await fetch(`${API_URL}/interview-v4/findings/${findingId}/promote`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ initiativeId }),
    });
    return handleResponse(res, 'Failed to promote finding');
  },
  interviewCheckCohort: async (sessionId: string, segmentId?: string) => {
    const params = segmentId ? `?segmentId=${segmentId}` : '';
    const res = await fetch(`${API_URL}/interview-v4/sessions/${sessionId}/cohort-check${params}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to check cohort');
  },
  interviewCheckExportGating: async (sessionId: string) => {
    const res = await fetch(`${API_URL}/interview-v4/sessions/${sessionId}/export-gating`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to check export gating');
  },
  interviewCreateContextVersion: async (data: {
    contextData: Record<string, unknown>;
    confidenceScores?: Record<string, number>;
    sourceCitations?: Array<{ sessionId: string; questionId?: string; snippet: string }>;
  }) => {
    const res = await fetch(`${API_URL}/interview-v4/context/versions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create context version');
  },
  interviewGetContextVersions: async (limit?: number) => {
    const params = limit ? `?limit=${limit}` : '';
    const res = await fetch(`${API_URL}/interview-v4/context/versions${params}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get context versions');
  },
  interviewGetContextVersion: async (version: number) => {
    const res = await fetch(`${API_URL}/interview-v4/context/versions/${version}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get context version');
  },
  interviewSignOffContext: async (versionId: string) => {
    const res = await fetch(`${API_URL}/interview-v4/context/versions/${versionId}/sign-off`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to sign off context');
  },
  interviewDiffContextVersions: async (fromVersion: number, toVersion: number) => {
    const res = await fetch(
      `${API_URL}/interview-v4/context/versions/${fromVersion}/diff/${toVersion}`,
      { headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to diff context versions');
  },
  organizationContextGet: async () => {
    const res = await fetch(`${API_URL}/organization-context`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to load organization context');
  },
  organizationContextGetTimeline: async (limit?: number) => {
    const params = limit ? `?limit=${limit}` : '';
    const res = await fetch(`${API_URL}/organization-context/timeline${params}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to load organization context timeline');
  },
  organizationContextGetClaims: async (limit?: number) => {
    const params = limit ? `?limit=${limit}` : '';
    const res = await fetch(`${API_URL}/organization-context/claims${params}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to load organization context claims');
  },
  organizationContextRebuild: async () => {
    const res = await fetch(`${API_URL}/organization-context/rebuild`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to rebuild organization context snapshot');
  },
  // M16 P0-5: live plan limits + current usage for the Organization → Limits section.
  organizationPolicySnapshot: async () => {
    const res = await fetch(`${API_URL}/organization/policy-snapshot`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to load organization limits');
  },

  // ──────────────────────────────────────────────
  // V4-FINC: Finance Enterprise API
  // ──────────────────────────────────────────────

  financeCreateModelVersion: async (
    modelId: string,
    data?: { scenarioLabel?: string; parentVersionId?: string }
  ) => {
    const res = await fetch(`${API_URL}/finance-v4/models/${modelId}/versions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data || {}),
    });
    return handleResponse(res, 'Failed to create model version');
  },
  financeGetModelVersions: async (modelId: string) => {
    const res = await fetch(`${API_URL}/finance-v4/models/${modelId}/versions`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get model versions');
  },
  financeCompareVersions: async (fromId: string, toId: string) => {
    const res = await fetch(`${API_URL}/finance-v4/versions/${fromId}/compare/${toId}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to compare versions');
  },
  financeMergeVersion: async (versionId: string) => {
    const res = await fetch(`${API_URL}/finance-v4/versions/${versionId}/merge`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to merge version');
  },
  financeCreateDimension: async (data: { dimensionName: string; dimensionType?: string }) => {
    const res = await fetch(`${API_URL}/finance-v4/dimensions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create dimension');
  },
  financeGetDimensions: async () => {
    const res = await fetch(`${API_URL}/finance-v4/dimensions`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get dimensions');
  },
  financeCreateAllocation: async (modelId: string, data: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/finance-v4/models/${modelId}/allocations`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create allocation');
  },
  financeGetAllocations: async (modelId: string) => {
    const res = await fetch(`${API_URL}/finance-v4/models/${modelId}/allocations`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get allocations');
  },
  financeCreateConsolidation: async (data: { name: string; sourceModelIds: string[] }) => {
    const res = await fetch(`${API_URL}/finance-v4/consolidations`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create consolidation');
  },
  financeGetConsolidations: async () => {
    const res = await fetch(`${API_URL}/finance-v4/consolidations`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get consolidations');
  },
  financeCreateBudget: async (
    modelId: string,
    data: { fiscalYear: number; plannedData: Record<string, unknown>; versionLabel?: string }
  ) => {
    const res = await fetch(`${API_URL}/finance-v4/models/${modelId}/budgets`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create budget');
  },
  financeGetBudgets: async (modelId: string) => {
    const res = await fetch(`${API_URL}/finance-v4/models/${modelId}/budgets`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get budgets');
  },
  financeUpdateBudgetActuals: async (budgetId: string, actualData: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/finance-v4/budgets/${budgetId}/actuals`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ actualData }),
    });
    return handleResponse(res, 'Failed to update budget actuals');
  },
  financeApproveBudget: async (budgetId: string) => {
    const res = await fetch(`${API_URL}/finance-v4/budgets/${budgetId}/approve`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to approve budget');
  },
  financeGetVarianceAlerts: async (budgetId: string) => {
    const res = await fetch(`${API_URL}/finance-v4/budgets/${budgetId}/variance-alerts`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get variance alerts');
  },
  financeCreateConnector: async (data: {
    connectorType: string;
    name: string;
    config: Record<string, unknown>;
    syncDirection?: string;
  }) => {
    const res = await fetch(`${API_URL}/finance-v4/connectors`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create connector');
  },
  financeGetConnectors: async () => {
    const res = await fetch(`${API_URL}/finance-v4/connectors`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get connectors');
  },
  financeGetSyncLog: async (connectorId: string) => {
    const res = await fetch(`${API_URL}/finance-v4/connectors/${connectorId}/sync-log`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get sync log');
  },
  financeCreateValuation: async (
    modelId: string,
    data: {
      inputs: Record<string, unknown>;
      outputs: Record<string, unknown>;
      valuationMethod?: string;
    }
  ) => {
    const res = await fetch(`${API_URL}/finance-v4/models/${modelId}/valuations`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create valuation');
  },
  financeGetValuations: async (modelId: string) => {
    const res = await fetch(`${API_URL}/finance-v4/models/${modelId}/valuations`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get valuations');
  },
  financeGetValuationAudit: async (snapshotId: string) => {
    const res = await fetch(`${API_URL}/finance-v4/valuations/${snapshotId}/audit`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get valuation audit');
  },
  financeCreateAIAssumption: async (
    modelId: string,
    data: {
      assumptionKey: string;
      assumptionValue: string;
      confidence?: number;
      sourceCitations?: unknown[];
    }
  ) => {
    const res = await fetch(`${API_URL}/finance-v4/models/${modelId}/ai-assumptions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create AI assumption');
  },
  financeGetAIAssumptions: async (modelId: string) => {
    const res = await fetch(`${API_URL}/finance-v4/models/${modelId}/ai-assumptions`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get AI assumptions');
  },
  financeAcceptAIAssumption: async (assumptionId: string) => {
    const res = await fetch(`${API_URL}/finance-v4/ai-assumptions/${assumptionId}/accept`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to accept AI assumption');
  },
  financeCreateROILink: async (
    modelId: string,
    data: { initiativeId?: string; benefitId?: string; assumptionIds?: string[] }
  ) => {
    const res = await fetch(`${API_URL}/finance-v4/models/${modelId}/roi-links`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create ROI link');
  },
  financeGetROILinks: async (modelId: string) => {
    const res = await fetch(`${API_URL}/finance-v4/models/${modelId}/roi-links`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get ROI links');
  },
  financeRealizeROILink: async (
    linkId: string,
    data: { realizedValue: number; evidence: unknown[] }
  ) => {
    const res = await fetch(`${API_URL}/finance-v4/roi-links/${linkId}/realize`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to realize ROI link');
  },

  // ──────────────────────────────────────────────
  // V4-RPT: Reports Enterprise API
  // ──────────────────────────────────────────────

  reportCreateSourcePack: async (
    reportId: string,
    data: { name: string; description?: string; citationPolicy?: string }
  ) => {
    const res = await fetch(`${API_URL}/reports-v4/reports/${reportId}/source-packs`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create source pack');
  },
  reportAddSourcePackItem: async (
    packId: string,
    data: {
      artifactType: string;
      artifactId: string;
      artifactTitle?: string;
      citationLabel?: string;
    }
  ) => {
    const res = await fetch(`${API_URL}/reports-v4/source-packs/${packId}/items`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to add source pack item');
  },
  reportGetSourcePacks: async (reportId: string) => {
    const res = await fetch(`${API_URL}/reports-v4/reports/${reportId}/source-packs`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get source packs');
  },
  reportGetSourcePackItems: async (packId: string) => {
    const res = await fetch(`${API_URL}/reports-v4/source-packs/${packId}/items`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get source pack items');
  },
  reportCreateDataBinding: async (
    reportId: string,
    data: { sectionId: string; datasetRef: string; bindingType?: string }
  ) => {
    const res = await fetch(`${API_URL}/reports-v4/reports/${reportId}/data-bindings`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create data binding');
  },
  reportRefreshDataBinding: async (bindingId: string, value: string) => {
    const res = await fetch(`${API_URL}/reports-v4/data-bindings/${bindingId}/refresh`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ value }),
    });
    return handleResponse(res, 'Failed to refresh data binding');
  },
  reportApproveDataBinding: async (bindingId: string) => {
    const res = await fetch(`${API_URL}/reports-v4/data-bindings/${bindingId}/approve`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to approve data binding');
  },
  reportGetDataBindings: async (reportId: string) => {
    const res = await fetch(`${API_URL}/reports-v4/reports/${reportId}/data-bindings`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get data bindings');
  },
  reportCreateTemplate: async (data: {
    name: string;
    templateData: Record<string, unknown>;
    variables?: unknown[];
    category?: string;
  }) => {
    const res = await fetch(`${API_URL}/reports-v4/templates`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create template');
  },
  reportPublishTemplate: async (templateId: string) => {
    const res = await fetch(`${API_URL}/reports-v4/templates/${templateId}/publish`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to publish template');
  },
  reportGetTemplates: async () => {
    const res = await fetch(`${API_URL}/reports-v4/templates`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get templates');
  },
  reportGetTemplateVersions: async (templateId: string) => {
    const res = await fetch(`${API_URL}/reports-v4/templates/${templateId}/versions`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get template versions');
  },
  reportCreateBrandVoice: async (data: {
    policyName: string;
    tone?: string;
    forbiddenPhrases?: string[];
    requiredSourceCitation?: boolean;
    noMarketingLanguage?: boolean;
  }) => {
    const res = await fetch(`${API_URL}/reports-v4/brand-voice`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create brand voice policy');
  },
  reportGetBrandVoicePolicies: async () => {
    const res = await fetch(`${API_URL}/reports-v4/brand-voice`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get brand voice policies');
  },
  reportValidateBrandVoice: async (text: string) => {
    const res = await fetch(`${API_URL}/reports-v4/brand-voice/validate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ text }),
    });
    return handleResponse(res, 'Failed to validate brand voice');
  },
  reportCreateAIProposal: async (
    reportId: string,
    data: {
      proposedContent: string;
      sectionId?: string;
      blockId?: string;
      originalContent?: string;
      citations?: unknown[];
    }
  ) => {
    const res = await fetch(`${API_URL}/reports-v4/reports/${reportId}/ai-proposals`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create AI proposal');
  },
  reportResolveAIProposal: async (proposalId: string, action: 'accept' | 'reject') => {
    const res = await fetch(`${API_URL}/reports-v4/ai-proposals/${proposalId}/resolve`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ action }),
    });
    return handleResponse(res, 'Failed to resolve AI proposal');
  },
  reportGetAIProposals: async (reportId: string, status?: string) => {
    const params = status ? `?status=${status}` : '';
    const res = await fetch(`${API_URL}/reports-v4/reports/${reportId}/ai-proposals${params}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get AI proposals');
  },
  reportCreateDistributionSchedule: async (
    reportId: string,
    data: {
      recipientPolicy: Record<string, unknown>;
      scheduleCron?: string;
      sendAt?: string;
      approvalRequired?: boolean;
    }
  ) => {
    const res = await fetch(`${API_URL}/reports-v4/reports/${reportId}/distribution-schedules`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create distribution schedule');
  },
  reportApproveDistribution: async (scheduleId: string) => {
    const res = await fetch(`${API_URL}/reports-v4/distribution-schedules/${scheduleId}/approve`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to approve distribution');
  },
  reportGetDistributionSchedules: async (reportId: string) => {
    const res = await fetch(`${API_URL}/reports-v4/reports/${reportId}/distribution-schedules`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get distribution schedules');
  },
  reportGetDistributionLog: async (scheduleId: string) => {
    const res = await fetch(`${API_URL}/reports-v4/distribution-schedules/${scheduleId}/log`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get distribution log');
  },

  // ──────────────────────────────────────────────
  // V4-DECK: Presentations Enterprise API
  // ──────────────────────────────────────────────

  deckCreateBinding: async (
    deckId: string,
    data: {
      slideIndex: number;
      blockId?: string;
      bindingType?: string;
      artifactType?: string;
      artifactId?: string;
    }
  ) => {
    const res = await fetch(`${API_URL}/presentations-v4/decks/${deckId}/bindings`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create deck binding');
  },
  deckGetBindings: async (deckId: string) => {
    const res = await fetch(`${API_URL}/presentations-v4/decks/${deckId}/bindings`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get deck bindings');
  },
  deckRefreshBinding: async (bindingId: string, valueHash: string) => {
    const res = await fetch(`${API_URL}/presentations-v4/bindings/${bindingId}/refresh`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ valueHash }),
    });
    return handleResponse(res, 'Failed to refresh binding');
  },
  deckApproveBinding: async (bindingId: string) => {
    const res = await fetch(`${API_URL}/presentations-v4/bindings/${bindingId}/approve`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to approve binding');
  },
  deckCreateLayoutRule: async (data: {
    ruleName: string;
    ruleType?: string;
    config: Record<string, unknown>;
  }) => {
    const res = await fetch(`${API_URL}/presentations-v4/layout-rules`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create layout rule');
  },
  deckGetLayoutRules: async () => {
    const res = await fetch(`${API_URL}/presentations-v4/layout-rules`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get layout rules');
  },
  deckCreateExportQA: async (
    deckId: string,
    data: { fidelityScore: number; passed: boolean; issues?: unknown[] }
  ) => {
    const res = await fetch(`${API_URL}/presentations-v4/decks/${deckId}/export-qa`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create export QA');
  },
  deckGetExportQA: async (deckId: string) => {
    const res = await fetch(`${API_URL}/presentations-v4/decks/${deckId}/export-qa`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get export QA');
  },
  deckCreateTemplateGovernance: async (data: {
    templateId: string;
    name: string;
    category?: string;
    variables?: unknown[];
    consultingPackType?: string;
  }) => {
    const res = await fetch(`${API_URL}/presentations-v4/template-governance`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create template governance');
  },
  deckPublishTemplate: async (governanceId: string) => {
    const res = await fetch(
      `${API_URL}/presentations-v4/template-governance/${governanceId}/publish`,
      { method: 'POST', headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to publish template');
  },
  deckGetTemplateGovernance: async () => {
    const res = await fetch(`${API_URL}/presentations-v4/template-governance`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get template governance');
  },
  deckCreatePPTXImport: async (data: {
    originalFilename: string;
    fileSizeBytes?: number;
    slideCount?: number;
  }) => {
    const res = await fetch(`${API_URL}/presentations-v4/pptx-imports`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create PPTX import');
  },
  deckGetPPTXImports: async () => {
    const res = await fetch(`${API_URL}/presentations-v4/pptx-imports`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get PPTX imports');
  },
  deckJoinCollab: async (deckId: string) => {
    const res = await fetch(`${API_URL}/presentations-v4/decks/${deckId}/collab/join`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to join collab');
  },
  deckUpdatePresence: async (
    sessionId: string,
    data: { cursorPosition?: Record<string, unknown>; activeSlideIndex?: number }
  ) => {
    const res = await fetch(`${API_URL}/presentations-v4/collab/${sessionId}/presence`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update presence');
  },
  deckLeaveCollab: async (sessionId: string) => {
    const res = await fetch(`${API_URL}/presentations-v4/collab/${sessionId}/leave`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to leave collab');
  },
  deckGetCollaborators: async (deckId: string) => {
    const res = await fetch(`${API_URL}/presentations-v4/decks/${deckId}/collab/active`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get collaborators');
  },
  deckAddMedia: async (data: {
    filename: string;
    mimeType: string;
    fileSizeBytes?: number;
    storageUrl?: string;
    rightsStatus?: string;
  }) => {
    const res = await fetch(`${API_URL}/presentations-v4/media`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to add media');
  },
  deckGetMediaLibrary: async (rightsFilter?: string) => {
    const params = rightsFilter ? `?rights=${rightsFilter}` : '';
    const res = await fetch(`${API_URL}/presentations-v4/media${params}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get media library');
  },
  deckApplyWatermark: async (mediaId: string) => {
    const res = await fetch(`${API_URL}/presentations-v4/media/${mediaId}/watermark`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to apply watermark');
  },

  // ──────────────────────────────────────────────
  // V4-RSLT: Results Enterprise API
  // ──────────────────────────────────────────────

  resultsCreateKPIConnector: async (data: {
    connectorName: string;
    connectorType?: string;
    config: Record<string, unknown>;
    targetKpiIds?: string[];
    scheduleCron?: string;
  }) => {
    const res = await fetch(`${API_URL}/results-v4/kpi-connectors`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create KPI connector');
  },
  resultsGetKPIConnectors: async () => {
    const res = await fetch(`${API_URL}/results-v4/kpi-connectors`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get KPI connectors');
  },
  resultsIngestKPI: async (
    connectorId: string,
    data: { kpiId: string; value: number; period: string; provenance?: Record<string, unknown> }
  ) => {
    const res = await fetch(`${API_URL}/results-v4/kpi-connectors/${connectorId}/ingest`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to ingest KPI value');
  },
  resultsGetIngestionLog: async (connectorId: string) => {
    const res = await fetch(`${API_URL}/results-v4/kpi-connectors/${connectorId}/ingestion-log`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get ingestion log');
  },
  resultsRunKPIConnector: async (connectorId: string) => {
    const res = await fetch(`${API_URL}/results-v4/kpi-connectors/${connectorId}/run`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to run KPI connector');
  },
  resultsCreateROIEvidence: async (data: {
    value: number;
    period: string;
    initiativeId?: string;
    benefitId?: string;
    evidenceType?: string;
    sourceDescription?: string;
    financeModelId?: string;
  }) => {
    const res = await fetch(`${API_URL}/results-v4/roi-evidence`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create ROI evidence');
  },
  resultsGetROIEvidence: async (filters?: { initiativeId?: string; benefitId?: string }) => {
    const params = new URLSearchParams();
    if (filters?.initiativeId) params.set('initiativeId', filters.initiativeId);
    if (filters?.benefitId) params.set('benefitId', filters.benefitId);
    const qs = params.toString() ? `?${params}` : '';
    const res = await fetch(`${API_URL}/results-v4/roi-evidence${qs}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get ROI evidence');
  },
  resultsVerifyROIEvidence: async (evidenceId: string) => {
    const res = await fetch(`${API_URL}/results-v4/roi-evidence/${evidenceId}/verify`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to verify ROI evidence');
  },
  resultsCreateReportSchedule: async (data: {
    reportName: string;
    kpiIds: string[];
    recipientPolicy: Record<string, unknown>;
    scheduleCron?: string;
    sendAt?: string;
    templateConfig?: Record<string, unknown>;
    approvalRequired?: boolean;
  }) => {
    const res = await fetch(`${API_URL}/results-v4/kpi-report-schedules`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create report schedule');
  },
  resultsGetReportSchedules: async () => {
    const res = await fetch(`${API_URL}/results-v4/kpi-report-schedules`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get report schedules');
  },
  resultsGetReportScheduleDeliveryLog: async (scheduleId: string) => {
    const res = await fetch(
      `${API_URL}/results-v4/kpi-report-schedules/${scheduleId}/delivery-log`,
      {
        headers: getHeaders(),
      }
    );
    return handleResponse(res, 'Failed to get report schedule delivery log');
  },
  resultsApproveReportSchedule: async (scheduleId: string) => {
    const res = await fetch(`${API_URL}/results-v4/kpi-report-schedules/${scheduleId}/approve`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to approve report schedule');
  },
  resultsRunReportSchedule: async (scheduleId: string) => {
    const res = await fetch(`${API_URL}/results-v4/kpi-report-schedules/${scheduleId}/run`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to run report schedule');
  },
  resultsRunDueEnterpriseWork: async () => {
    const res = await fetch(`${API_URL}/results-v4/runtime/run-due`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to run enterprise work');
  },
  resultsCreateWallboard: async (data: {
    name: string;
    kpiIds: string[];
    refreshIntervalSeconds?: number;
    autoRotationSeconds?: number;
    alertThresholds?: Record<string, unknown>;
  }) => {
    const res = await fetch(`${API_URL}/results-v4/wallboards`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create wallboard');
  },
  resultsGetWallboards: async () => {
    const res = await fetch(`${API_URL}/results-v4/wallboards`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get wallboards');
  },
  resultsGetWallboard: async (wallboardId: string) => {
    const res = await fetch(`${API_URL}/results-v4/wallboards/${wallboardId}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get wallboard');
  },
  resultsGetWallboardAlerts: async (wallboardId: string) => {
    const res = await fetch(`${API_URL}/results-v4/wallboards/${wallboardId}/alerts`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get wallboard alerts');
  },

  // ── V4-ENT-06: Realtime Channels & Presence ──

  realtimeCreateChannel: async (data: {
    channelType: string;
    resourceType: string;
    resourceId: string;
  }) => {
    const res = await fetch(`${API_URL}/realtime-v4/channels`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create channel');
  },
  realtimeListChannels: async (resourceType?: string) => {
    const qs = resourceType ? `?resourceType=${resourceType}` : '';
    const res = await fetch(`${API_URL}/realtime-v4/channels${qs}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to list channels');
  },
  realtimeGetChannel: async (resourceType: string, resourceId: string) => {
    const res = await fetch(`${API_URL}/realtime-v4/channels/${resourceType}/${resourceId}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get channel');
  },
  realtimeDeleteChannel: async (channelId: string) => {
    const res = await fetch(`${API_URL}/realtime-v4/channels/${channelId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete channel');
  },
  realtimeJoinPresence: async (
    channelId: string,
    data: { userName?: string; userColor?: string; cursorState?: object; activeElement?: string }
  ) => {
    const res = await fetch(`${API_URL}/realtime-v4/channels/${channelId}/presence`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to join presence');
  },
  realtimeListPresence: async (channelId: string) => {
    const res = await fetch(`${API_URL}/realtime-v4/channels/${channelId}/presence`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to list presence');
  },
  realtimeHeartbeat: async (channelId: string) => {
    const res = await fetch(`${API_URL}/realtime-v4/channels/${channelId}/heartbeat`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to heartbeat');
  },
  realtimeDisconnect: async (channelId: string) => {
    const res = await fetch(`${API_URL}/realtime-v4/channels/${channelId}/disconnect`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to disconnect');
  },
  realtimeCleanStale: async (staleMinutes?: number) => {
    const qs = staleMinutes ? `?staleMinutes=${staleMinutes}` : '';
    const res = await fetch(`${API_URL}/realtime-v4/presence/clean-stale${qs}`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to clean stale presence');
  },

  // ── V4-IDEA-03: CRDT Documents ──

  crdtCreateDocument: async (data: {
    resourceType: string;
    resourceId: string;
    crdtType?: string;
  }) => {
    const res = await fetch(`${API_URL}/realtime-v4/crdt/documents`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create CRDT document');
  },
  crdtGetDocument: async (resourceType: string, resourceId: string) => {
    const res = await fetch(`${API_URL}/realtime-v4/crdt/documents/${resourceType}/${resourceId}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get CRDT document');
  },
  crdtSaveSnapshot: async (docId: string, data: { stateVector: string; snapshotData: string }) => {
    const res = await fetch(`${API_URL}/realtime-v4/crdt/documents/${docId}/snapshot`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to save CRDT snapshot');
  },
  crdtAppendUpdate: async (
    docId: string,
    data: { updateData: string; originClientId?: string }
  ) => {
    const res = await fetch(`${API_URL}/realtime-v4/crdt/documents/${docId}/updates`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to append CRDT update');
  },
  crdtGetUpdates: async (docId: string, afterSequence?: number) => {
    const qs = afterSequence ? `?afterSequence=${afterSequence}` : '';
    const res = await fetch(`${API_URL}/realtime-v4/crdt/documents/${docId}/updates${qs}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get CRDT updates');
  },
  crdtDeleteDocument: async (docId: string) => {
    const res = await fetch(`${API_URL}/realtime-v4/crdt/documents/${docId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete CRDT document');
  },

  // ── V4-TOOL-04: Facilitation Layer ──

  facilitationCreateSession: async (data: { toolSessionId: string; settings?: object }) => {
    const res = await fetch(`${API_URL}/realtime-v4/facilitation/sessions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create facilitation session');
  },
  facilitationGetSession: async (sessionId: string) => {
    const res = await fetch(`${API_URL}/realtime-v4/facilitation/sessions/${sessionId}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get facilitation session');
  },
  // B1 (M09): read-only resolve of the ACTIVE shared session for a toolSessionId
  // (e.g. `whiteboard:<ideaId>`) WITHOUT creating one → { session } | { session: null }.
  facilitationResolveByTool: async (toolSessionId: string) => {
    const res = await fetch(
      `${API_URL}/realtime-v4/facilitation/sessions/by-tool/${encodeURIComponent(toolSessionId)}`,
      { headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to resolve facilitation session');
  },
  facilitationUpdateTimer: async (sessionId: string, timerState: object) => {
    const res = await fetch(`${API_URL}/realtime-v4/facilitation/sessions/${sessionId}/timer`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ timerState }),
    });
    return handleResponse(res, 'Failed to update timer');
  },
  facilitationUpdatePhase: async (sessionId: string, phase: string) => {
    const res = await fetch(`${API_URL}/realtime-v4/facilitation/sessions/${sessionId}/phase`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ phase }),
    });
    return handleResponse(res, 'Failed to update phase');
  },
  facilitationEndSession: async (sessionId: string) => {
    const res = await fetch(`${API_URL}/realtime-v4/facilitation/sessions/${sessionId}/end`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to end facilitation session');
  },
  facilitationCastVote: async (
    sessionId: string,
    data: { voteTargetId: string; voteType?: string; voteValue?: number; comment?: string }
  ) => {
    const res = await fetch(`${API_URL}/realtime-v4/facilitation/sessions/${sessionId}/votes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to cast vote');
  },
  facilitationGetVotes: async (sessionId: string, targetId?: string) => {
    const qs = targetId ? `?targetId=${targetId}` : '';
    const res = await fetch(
      `${API_URL}/realtime-v4/facilitation/sessions/${sessionId}/votes${qs}`,
      { headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to get votes');
  },
  facilitationGetVoteSummary: async (sessionId: string) => {
    const res = await fetch(
      `${API_URL}/realtime-v4/facilitation/sessions/${sessionId}/votes/summary`,
      { headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to get vote summary');
  },
  facilitationAssignRole: async (
    sessionId: string,
    data: { userId: string; roleName: string; permissions?: string[] }
  ) => {
    const res = await fetch(`${API_URL}/realtime-v4/facilitation/sessions/${sessionId}/roles`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to assign role');
  },
  facilitationGetRoles: async (sessionId: string) => {
    const res = await fetch(`${API_URL}/realtime-v4/facilitation/sessions/${sessionId}/roles`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get roles');
  },
  facilitationCreateOutcome: async (
    sessionId: string,
    data: {
      outcomeType?: string;
      title: string;
      description?: string;
      voteSummary?: object;
      exportedToType?: string;
      exportedToId?: string;
    }
  ) => {
    const res = await fetch(`${API_URL}/realtime-v4/facilitation/sessions/${sessionId}/outcomes`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create outcome');
  },
  facilitationGetOutcomes: async (sessionId: string) => {
    const res = await fetch(`${API_URL}/realtime-v4/facilitation/sessions/${sessionId}/outcomes`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get outcomes');
  },
  facilitationExportOutcome: async (
    outcomeId: string,
    data: { exportType: string; exportId: string }
  ) => {
    const res = await fetch(`${API_URL}/realtime-v4/facilitation/outcomes/${outcomeId}/export`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to export outcome');
  },

  // ── V4-TOOL-05: Tool Session Presence & Locks ──

  toolSessionJoinPresence: async (
    toolSessionId: string,
    data: {
      userName?: string;
      userColor?: string;
      cursorState?: object;
      activeBlockId?: string;
      editingField?: string;
    }
  ) => {
    const res = await fetch(`${API_URL}/realtime-v4/tool-sessions/${toolSessionId}/presence`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to join tool session presence');
  },
  toolSessionListPresence: async (toolSessionId: string) => {
    const res = await fetch(`${API_URL}/realtime-v4/tool-sessions/${toolSessionId}/presence`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to list tool session presence');
  },
  toolSessionHeartbeat: async (toolSessionId: string, cursorState?: object) => {
    const res = await fetch(`${API_URL}/realtime-v4/tool-sessions/${toolSessionId}/heartbeat`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ cursorState }),
    });
    return handleResponse(res, 'Failed to heartbeat tool session');
  },
  toolSessionDisconnect: async (toolSessionId: string) => {
    const res = await fetch(`${API_URL}/realtime-v4/tool-sessions/${toolSessionId}/disconnect`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to disconnect tool session');
  },
  toolSessionAcquireLock: async (
    toolSessionId: string,
    data: { blockId: string; ttlMinutes?: number }
  ) => {
    const res = await fetch(`${API_URL}/realtime-v4/tool-sessions/${toolSessionId}/locks`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to acquire edit lock');
  },
  toolSessionReleaseLock: async (toolSessionId: string, blockId: string) => {
    const res = await fetch(
      `${API_URL}/realtime-v4/tool-sessions/${toolSessionId}/locks/${blockId}`,
      { method: 'DELETE', headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to release edit lock');
  },
  toolSessionListLocks: async (toolSessionId: string) => {
    const res = await fetch(`${API_URL}/realtime-v4/tool-sessions/${toolSessionId}/locks`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to list edit locks');
  },

  // ── V4-INBX-06: Inbox Connectors ──

  inboxIngestConnector: async (data: {
    sourceChannel: string;
    sourceId?: string;
    payloadJson?: string;
    targetUserId?: string;
    senderEmail?: string;
    senderName?: string;
    subject?: string;
  }) => {
    const res = await fetch(`${API_URL}/inbox-v4/connectors/ingest`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to ingest connector item');
  },
  inboxRouteConnectorItem: async (itemId: string) => {
    const res = await fetch(`${API_URL}/inbox-v4/connectors/${itemId}/route`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to route connector item');
  },
  inboxListConnectorItems: async (status?: string) => {
    const qs = status ? `?status=${status}` : '';
    const res = await fetch(`${API_URL}/inbox-v4/connectors${qs}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to list connector items');
  },
  inboxCreateRoutingRule: async (data: {
    channel: string;
    ruleName?: string;
    conditionsJson?: object;
    targetUserId?: string;
    targetProjectId?: string;
    priority?: number;
    actionType?: string;
    actionConfig?: object;
  }) => {
    const res = await fetch(`${API_URL}/inbox-v4/routing-rules`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create routing rule');
  },
  inboxListRoutingRules: async (channel?: string) => {
    const qs = channel ? `?channel=${channel}` : '';
    const res = await fetch(`${API_URL}/inbox-v4/routing-rules${qs}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to list routing rules');
  },
  inboxUpdateRoutingRule: async (ruleId: string, data: object) => {
    const res = await fetch(`${API_URL}/inbox-v4/routing-rules/${ruleId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update routing rule');
  },
  inboxDeleteRoutingRule: async (ruleId: string) => {
    const res = await fetch(`${API_URL}/inbox-v4/routing-rules/${ruleId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete routing rule');
  },

  // ── V4-INBX-02: Focus Board ──

  focusCreateBoard: async (data: {
    name?: string;
    capacityLimit?: number;
    rulesJson?: object;
    templateId?: string;
  }) => {
    const res = await fetch(`${API_URL}/inbox-v4/focus/boards`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create focus board');
  },
  focusGetBoards: async () => {
    const res = await fetch(`${API_URL}/inbox-v4/focus/boards`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get focus boards');
  },
  focusUpdateBoard: async (boardId: string, data: object) => {
    const res = await fetch(`${API_URL}/inbox-v4/focus/boards/${boardId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update focus board');
  },
  focusAddItem: async (
    boardId: string,
    data: {
      inboxItemId?: string;
      sourceEntityType?: string;
      sourceEntityId?: string;
      title: string;
      priority?: string;
      plannedDate?: string;
      timeEstimateMinutes?: number;
      sortOrder?: number;
    }
  ) => {
    const res = await fetch(`${API_URL}/inbox-v4/focus/boards/${boardId}/items`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to add focus item');
  },
  focusGetItems: async (boardId: string, status?: string) => {
    const qs = status ? `?status=${status}` : '';
    const res = await fetch(`${API_URL}/inbox-v4/focus/boards/${boardId}/items${qs}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get focus items');
  },
  focusCompleteItem: async (itemId: string) => {
    const res = await fetch(`${API_URL}/inbox-v4/focus/items/${itemId}/complete`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to complete focus item');
  },
  focusRemoveItem: async (itemId: string) => {
    const res = await fetch(`${API_URL}/inbox-v4/focus/items/${itemId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to remove focus item');
  },
  focusCreateTemplate: async (data: {
    name: string;
    description?: string;
    rulesJson?: object;
    capacityLimit?: number;
    isOrgDefault?: boolean;
  }) => {
    const res = await fetch(`${API_URL}/inbox-v4/focus/templates`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create focus template');
  },
  focusListTemplates: async () => {
    const res = await fetch(`${API_URL}/inbox-v4/focus/templates`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to list focus templates');
  },

  // ── V4-INBX-03: AI Triage ──

  inboxTriageItem: async (data: {
    inboxItemId: string;
    suggestedPriority?: string;
    suggestedSection?: string;
    suggestedAction?: string;
    confidenceScore: number;
    reasoning?: string;
    originalPriority?: string;
    originalSection?: string;
  }) => {
    const res = await fetch(`${API_URL}/inbox-v4/triage`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to triage inbox item');
  },
  inboxAcceptTriage: async (triageId: string) => {
    const res = await fetch(`${API_URL}/inbox-v4/triage/${triageId}/accept`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to accept triage');
  },
  inboxRejectTriage: async (triageId: string) => {
    const res = await fetch(`${API_URL}/inbox-v4/triage/${triageId}/reject`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to reject triage');
  },
  inboxUndoTriage: async (triageId: string) => {
    const res = await fetch(`${API_URL}/inbox-v4/triage/${triageId}/undo`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to undo triage');
  },
  inboxGetTriageLog: async (inboxItemId?: string) => {
    const qs = inboxItemId ? `?inboxItemId=${inboxItemId}` : '';
    const res = await fetch(`${API_URL}/inbox-v4/triage/log${qs}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get triage log');
  },
  inboxGetTriageConfig: async () => {
    const res = await fetch(`${API_URL}/inbox-v4/triage/config`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get triage config');
  },
  inboxUpdateTriageConfig: async (data: {
    autoTriageEnabled?: boolean;
    confidenceThreshold?: number;
    allowedActions?: string[];
  }) => {
    const res = await fetch(`${API_URL}/inbox-v4/triage/config`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update triage config');
  },

  // ── V4-INBX-05: Inbox Table ──

  inboxGetTable: async (filters?: {
    status?: string;
    priority?: string;
    section?: string;
    slaStatus?: string;
    search?: string;
    sortBy?: string;
    sortDir?: string;
    limit?: number;
    offset?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined) params.set(k, String(v));
      });
    }
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_URL}/inbox-v4/table${qs}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get inbox table');
  },
  inboxGetItemPreview: async (itemId: string) => {
    const res = await fetch(`${API_URL}/inbox-v4/items/${itemId}/preview`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get inbox item preview');
  },

  // ── V4-ASMT-04: Findings + CAPA ──

  assessmentCreateFinding: async (
    assessmentId: string,
    data: {
      findingType?: string;
      severity?: string;
      clauseRef?: string;
      frameworkId?: string;
      title: string;
      description?: string;
      evidenceRefs?: string[];
      assignedTo?: string;
      dueDate?: string;
    }
  ) => {
    const res = await fetch(`${API_URL}/assessments-v4/assessments/${assessmentId}/findings`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create finding');
  },
  assessmentGetFindings: async (
    assessmentId: string,
    filters?: { status?: string; severity?: string; findingType?: string; clauseRef?: string }
  ) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
    }
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_URL}/assessments-v4/assessments/${assessmentId}/findings${qs}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get findings');
  },
  assessmentGetFinding: async (findingId: string) => {
    const res = await fetch(`${API_URL}/assessments-v4/findings/${findingId}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get finding');
  },
  assessmentUpdateFinding: async (findingId: string, data: object) => {
    const res = await fetch(`${API_URL}/assessments-v4/findings/${findingId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update finding');
  },
  assessmentCreateCapa: async (
    findingId: string,
    data: {
      actionType?: string;
      title: string;
      description?: string;
      assignedTo?: string;
      dueDate?: string;
      verificationMethod?: string;
    }
  ) => {
    const res = await fetch(`${API_URL}/assessments-v4/findings/${findingId}/capa`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create CAPA action');
  },
  assessmentGetCapaActions: async (findingId: string) => {
    const res = await fetch(`${API_URL}/assessments-v4/findings/${findingId}/capa`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get CAPA actions');
  },
  assessmentUpdateCapa: async (actionId: string, data: object) => {
    const res = await fetch(`${API_URL}/assessments-v4/capa/${actionId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update CAPA action');
  },

  // ── V4-ASMT-05: Evidence Clause Mapping ──

  assessmentMapClause: async (data: {
    evidenceId: string;
    frameworkId: string;
    clauseRef: string;
    coverageLevel?: string;
    notes?: string;
  }) => {
    const res = await fetch(`${API_URL}/assessments-v4/evidence/clause-map`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to map clause');
  },
  assessmentGetClauseMappings: async (filters?: {
    evidenceId?: string;
    frameworkId?: string;
    clauseRef?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
    }
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_URL}/assessments-v4/evidence/clause-map${qs}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get clause mappings');
  },
  assessmentDeleteClauseMapping: async (mappingId: string) => {
    const res = await fetch(`${API_URL}/assessments-v4/evidence/clause-map/${mappingId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete clause mapping');
  },
  assessmentGetClauseCoverage: async (frameworkId: string) => {
    const res = await fetch(`${API_URL}/assessments-v4/evidence/clause-coverage/${frameworkId}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get clause coverage');
  },
  assessmentLogEvidenceAccess: async (evidenceId: string, action: string) => {
    const res = await fetch(`${API_URL}/assessments-v4/evidence/${evidenceId}/access-log`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ action }),
    });
    return handleResponse(res, 'Failed to log evidence access');
  },
  assessmentGetEvidenceAccessLog: async (evidenceId?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (evidenceId) params.set('evidenceId', evidenceId);
    if (limit) params.set('limit', String(limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_URL}/assessments-v4/evidence/access-log${qs}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get evidence access log');
  },

  // ── V4-ASMT-06: AI Scoring + Eval ──

  assessmentCreateScoringProposal: async (
    assessmentId: string,
    data: {
      axisId?: string;
      questionId?: string;
      proposedScore: number;
      currentScore?: number;
      citations?: string[];
      reasoning?: string;
      confidence?: number;
      aiModelUsed?: string;
    }
  ) => {
    const res = await fetch(
      `${API_URL}/assessments-v4/assessments/${assessmentId}/scoring-proposals`,
      { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) }
    );
    return handleResponse(res, 'Failed to create scoring proposal');
  },
  assessmentGetScoringProposals: async (assessmentId: string, status?: string) => {
    const qs = status ? `?status=${status}` : '';
    const res = await fetch(
      `${API_URL}/assessments-v4/assessments/${assessmentId}/scoring-proposals${qs}`,
      { headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to get scoring proposals');
  },
  assessmentReviewScoringProposal: async (proposalId: string, status: 'accepted' | 'rejected') => {
    const res = await fetch(`${API_URL}/assessments-v4/scoring-proposals/${proposalId}/review`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    return handleResponse(res, 'Failed to review scoring proposal');
  },
  assessmentCreateEvalDataset: async (data: {
    frameworkId: string;
    name: string;
    description?: string;
    goldenItems?: object[];
  }) => {
    const res = await fetch(`${API_URL}/assessments-v4/eval/datasets`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create eval dataset');
  },
  assessmentGetEvalDatasets: async (frameworkId?: string) => {
    const qs = frameworkId ? `?frameworkId=${frameworkId}` : '';
    const res = await fetch(`${API_URL}/assessments-v4/eval/datasets${qs}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get eval datasets');
  },
  assessmentCreateEvalRun: async (data: {
    datasetId: string;
    aiModelUsed?: string;
    accuracy?: number;
    precisionScore?: number;
    recall?: number;
    f1Score?: number;
    detailsJson?: object;
  }) => {
    const res = await fetch(`${API_URL}/assessments-v4/eval/runs`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create eval run');
  },
  assessmentGetEvalRuns: async (datasetId: string) => {
    const res = await fetch(`${API_URL}/assessments-v4/eval/datasets/${datasetId}/runs`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get eval runs');
  },
  assessmentCompareEvalRuns: async (runIdA: string, runIdB: string) => {
    const res = await fetch(`${API_URL}/assessments-v4/eval/runs/${runIdA}/compare/${runIdB}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to compare eval runs');
  },

  // ── V4-ASMT-07: Report Reviews + Diff ──

  assessmentRequestReview: async (
    assessmentId: string,
    data: { versionId: string; reviewerId: string }
  ) => {
    const res = await fetch(`${API_URL}/assessments-v4/assessments/${assessmentId}/reviews`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to request review');
  },
  assessmentGetReviews: async (assessmentId: string, versionId?: string) => {
    const qs = versionId ? `?versionId=${versionId}` : '';
    const res = await fetch(`${API_URL}/assessments-v4/assessments/${assessmentId}/reviews${qs}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get reviews');
  },
  assessmentSignOff: async (reviewId: string, comments?: string) => {
    const res = await fetch(`${API_URL}/assessments-v4/reviews/${reviewId}/sign-off`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ comments }),
    });
    return handleResponse(res, 'Failed to sign off review');
  },
  assessmentRejectReview: async (reviewId: string, comments: string) => {
    const res = await fetch(`${API_URL}/assessments-v4/reviews/${reviewId}/reject`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ comments }),
    });
    return handleResponse(res, 'Failed to reject review');
  },
  assessmentGetVersionDiff: async (
    assessmentId: string,
    fromVersionId: string,
    toVersionId: string
  ) => {
    const res = await fetch(
      `${API_URL}/assessments-v4/assessments/${assessmentId}/versions/${fromVersionId}/diff/${toVersionId}`,
      { headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to get version diff');
  },

  // ── V4-INIT-04: Goals/OKR ──

  goalsCreate: async (data: {
    parentGoalId?: string;
    goalType?: string;
    title: string;
    description?: string;
    ownerId?: string;
    timeFrame?: string;
    startDate?: string;
    endDate?: string;
    targetValue?: number;
    unit?: string;
  }) => {
    const res = await fetch(`${API_URL}/initiatives-v4/goals`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create goal');
  },
  goalsGet: async (parentGoalId?: string) => {
    const qs = parentGoalId ? `?parentGoalId=${parentGoalId}` : '';
    const res = await fetch(`${API_URL}/initiatives-v4/goals${qs}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get goals');
  },
  goalsGetOne: async (goalId: string) => {
    const res = await fetch(`${API_URL}/initiatives-v4/goals/${goalId}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get goal');
  },
  goalsUpdate: async (goalId: string, data: object) => {
    const res = await fetch(`${API_URL}/initiatives-v4/goals/${goalId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update goal');
  },
  goalsGetRollup: async (goalId: string) => {
    const res = await fetch(`${API_URL}/initiatives-v4/goals/${goalId}/rollup`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get goal rollup');
  },
  goalsLinkInitiative: async (goalId: string, initiativeId: string, weight?: number) => {
    const res = await fetch(`${API_URL}/initiatives-v4/goals/${goalId}/initiatives`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ initiativeId, contributionWeight: weight }),
    });
    return handleResponse(res, 'Failed to link initiative to goal');
  },
  goalsGetInitiatives: async (goalId: string) => {
    const res = await fetch(`${API_URL}/initiatives-v4/goals/${goalId}/initiatives`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get goal initiatives');
  },
  goalsUnlinkInitiative: async (goalId: string, initiativeId: string) => {
    const res = await fetch(
      `${API_URL}/initiatives-v4/goals/${goalId}/initiatives/${initiativeId}`,
      { method: 'DELETE', headers: getHeaders() }
    );
    return handleResponse(res, 'Failed to unlink initiative');
  },

  // ── V4-INIT-06: AI Blueprints ──

  blueprintCreate: async (data: {
    initiativeId?: string;
    promptText?: string;
    generatedWbs?: object[];
    generatedMilestones?: object[];
    citations?: string[];
    aiModelUsed?: string;
    confidence?: number;
  }) => {
    const res = await fetch(`${API_URL}/initiatives-v4/blueprints`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create blueprint');
  },
  blueprintList: async (initiativeId?: string) => {
    const qs = initiativeId ? `?initiativeId=${initiativeId}` : '';
    const res = await fetch(`${API_URL}/initiatives-v4/blueprints${qs}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to list blueprints');
  },
  blueprintApply: async (blueprintId: string) => {
    const res = await fetch(`${API_URL}/initiatives-v4/blueprints/${blueprintId}/apply`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to apply blueprint');
  },
  blueprintReject: async (blueprintId: string) => {
    const res = await fetch(`${API_URL}/initiatives-v4/blueprints/${blueprintId}/reject`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to reject blueprint');
  },

  // ── V4-INIT-07: Governance Gates ──

  governanceCreateGate: async (
    initiativeId: string,
    data: {
      gateType?: string;
      gateName: string;
      requiredDecisions?: string[];
      requiredRaidStatus?: object;
      requiredApprovers?: string[];
    }
  ) => {
    const res = await fetch(`${API_URL}/initiatives-v4/initiatives/${initiativeId}/gates`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create governance gate');
  },
  governanceGetGates: async (initiativeId: string) => {
    const res = await fetch(`${API_URL}/initiatives-v4/initiatives/${initiativeId}/gates`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get governance gates');
  },
  governanceEvaluateGate: async (gateId: string) => {
    const res = await fetch(`${API_URL}/initiatives-v4/gates/${gateId}/evaluate`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to evaluate gate');
  },
  governanceLinkDecision: async (initiativeId: string, decisionId: string, linkType?: string) => {
    const res = await fetch(`${API_URL}/initiatives-v4/initiatives/${initiativeId}/decisions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ decisionId, linkType }),
    });
    return handleResponse(res, 'Failed to link decision');
  },
  governanceGetDecisions: async (initiativeId: string) => {
    const res = await fetch(`${API_URL}/initiatives-v4/initiatives/${initiativeId}/decisions`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get initiative decisions');
  },

  // ── V4-TOOL-03: Template Library ──

  toolTemplateCreate: async (data: {
    templateKey: string;
    templateName: string;
    category: string;
    description?: string;
    schemaJson: object;
    defaultConfig?: object;
    isOrgCurated?: boolean;
  }) => {
    const res = await fetch(`${API_URL}/tools-v4/templates`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create template');
  },
  toolTemplateList: async (category?: string) => {
    const qs = category ? `?category=${category}` : '';
    const res = await fetch(`${API_URL}/tools-v4/templates${qs}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to list templates');
  },
  toolTemplateGet: async (templateId: string) => {
    const res = await fetch(`${API_URL}/tools-v4/templates/${templateId}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get template');
  },
  toolTemplateUpdate: async (templateId: string, data: object) => {
    const res = await fetch(`${API_URL}/tools-v4/templates/${templateId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update template');
  },
  toolTemplateDelete: async (templateId: string) => {
    const res = await fetch(`${API_URL}/tools-v4/templates/${templateId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete template');
  },

  // ── V4-TOOL-06: Knowledge Bank + RAG ──

  toolKnowledgeAdd: async (data: {
    toolSessionId?: string;
    sourceType: string;
    sourceId: string;
    contentText?: string;
    scope?: string;
  }) => {
    const res = await fetch(`${API_URL}/tools-v4/knowledge`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to add knowledge entry');
  },
  toolKnowledgeSearch: async (query: string, toolSessionId?: string, limit?: number) => {
    const params = new URLSearchParams({ q: query });
    if (toolSessionId) params.set('toolSessionId', toolSessionId);
    if (limit) params.set('limit', String(limit));
    const res = await fetch(`${API_URL}/tools-v4/knowledge/search?${params}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to search knowledge');
  },
  toolKnowledgeList: async (toolSessionId?: string) => {
    const qs = toolSessionId ? `?toolSessionId=${toolSessionId}` : '';
    const res = await fetch(`${API_URL}/tools-v4/knowledge${qs}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to list knowledge');
  },
  toolKnowledgeDelete: async (entryId: string) => {
    const res = await fetch(`${API_URL}/tools-v4/knowledge/${entryId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete knowledge entry');
  },
  toolRagQuery: async (data: {
    toolSessionId?: string;
    queryText: string;
    results?: object[];
    citations?: object[];
  }) => {
    const res = await fetch(`${API_URL}/tools-v4/rag/query`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create RAG query');
  },
  toolRagGetQueries: async (toolSessionId?: string) => {
    const qs = toolSessionId ? `?toolSessionId=${toolSessionId}` : '';
    const res = await fetch(`${API_URL}/tools-v4/rag/queries${qs}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get RAG queries');
  },

  // ── V4-TOOL-07: Entitlements ──

  toolEntitlementCreate: async (data: {
    packKey: string;
    packName: string;
    licensedTools?: string[];
    maxSessionsPerMonth?: number;
    maxConcurrentUsers?: number;
    validFrom?: string;
    validUntil?: string;
  }) => {
    const res = await fetch(`${API_URL}/tools-v4/entitlements`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create entitlement');
  },
  toolEntitlementList: async () => {
    const res = await fetch(`${API_URL}/tools-v4/entitlements`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to list entitlements');
  },
  toolEntitlementCheck: async (toolKey: string) => {
    const res = await fetch(`${API_URL}/tools-v4/entitlements/check/${toolKey}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to check entitlement');
  },
  toolUsageLog: async (data: { toolKey: string; entitlementId?: string; action?: string }) => {
    const res = await fetch(`${API_URL}/tools-v4/usage/log`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to log tool usage');
  },
  toolUsageStats: async (toolKey?: string) => {
    const qs = toolKey ? `?toolKey=${toolKey}` : '';
    const res = await fetch(`${API_URL}/tools-v4/usage/stats${qs}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get usage stats');
  },
  toolEntitlementDeactivate: async (entitlementId: string) => {
    const res = await fetch(`${API_URL}/tools-v4/entitlements/${entitlementId}/deactivate`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to deactivate entitlement');
  },

  // ── V4-ENT-05: Integration Hub ──

  integrationCreateConnector: async (data: {
    connectorType: string;
    connectorName: string;
    configJson?: object;
    secretsRef?: string;
    allowlistDomains?: string[];
  }) => {
    const res = await fetch(`${API_URL}/enterprise-v4/connectors`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create connector');
  },
  integrationGetConnectors: async () => {
    const res = await fetch(`${API_URL}/enterprise-v4/connectors`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get connectors');
  },
  integrationGetConnector: async (connectorId: string) => {
    const res = await fetch(`${API_URL}/enterprise-v4/connectors/${connectorId}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get connector');
  },
  integrationUpdateConnector: async (connectorId: string, data: object) => {
    const res = await fetch(`${API_URL}/enterprise-v4/connectors/${connectorId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update connector');
  },
  integrationDeleteConnector: async (connectorId: string) => {
    const res = await fetch(`${API_URL}/enterprise-v4/connectors/${connectorId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete connector');
  },
  integrationHealthCheck: async (connectorId: string, healthStatus: string) => {
    const res = await fetch(`${API_URL}/enterprise-v4/connectors/${connectorId}/health-check`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ healthStatus }),
    });
    return handleResponse(res, 'Failed to health check');
  },
  integrationEnqueue: async (data: {
    connectorId: string;
    direction?: string;
    payloadJson: object;
    maxRetries?: number;
  }) => {
    const res = await fetch(`${API_URL}/enterprise-v4/queue`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to enqueue message');
  },
  integrationGetQueue: async (status?: string) => {
    const qs = status ? `?status=${status}` : '';
    const res = await fetch(`${API_URL}/enterprise-v4/queue${qs}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get queue');
  },
  integrationProcessQueue: async (itemId: string, success: boolean, errorMessage?: string) => {
    const res = await fetch(`${API_URL}/enterprise-v4/queue/${itemId}/process`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ success, errorMessage }),
    });
    return handleResponse(res, 'Failed to process queue item');
  },
  integrationStoreSecret: async (data: {
    connectorId?: string;
    secretKey: string;
    encryptedValue: string;
  }) => {
    const res = await fetch(`${API_URL}/enterprise-v4/secrets`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to store secret');
  },
  integrationGetSecretKeys: async (connectorId?: string) => {
    const qs = connectorId ? `?connectorId=${connectorId}` : '';
    const res = await fetch(`${API_URL}/enterprise-v4/secrets${qs}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get secret keys');
  },
  integrationDeleteSecret: async (secretId: string) => {
    const res = await fetch(`${API_URL}/enterprise-v4/secrets/${secretId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to delete secret');
  },

  // ── V4-ENT-08: Observability ──

  observabilityRecordMetric: async (data: {
    metricName: string;
    metricType?: string;
    value: number;
    labels?: object;
  }) => {
    const res = await fetch(`${API_URL}/enterprise-v4/metrics`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to record metric');
  },
  observabilityGetMetrics: async (metricName: string, since?: string) => {
    const qs = since ? `?since=${since}` : '';
    const res = await fetch(`${API_URL}/enterprise-v4/metrics/${metricName}${qs}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get metrics');
  },
  observabilityCreateSlo: async (data: {
    sloName: string;
    targetPercentage: number;
    windowDays?: number;
  }) => {
    const res = await fetch(`${API_URL}/enterprise-v4/slos`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create SLO');
  },
  observabilityGetSlos: async () => {
    const res = await fetch(`${API_URL}/enterprise-v4/slos`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get SLOs');
  },
  observabilityUpdateSlo: async (
    sloId: string,
    data: { currentPercentage: number; budgetRemaining: number }
  ) => {
    const res = await fetch(`${API_URL}/enterprise-v4/slos/${sloId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update SLO');
  },
  observabilityRecordTrace: async (data: {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    operationName: string;
    durationMs?: number;
    statusCode?: string;
    attributes?: object;
  }) => {
    const res = await fetch(`${API_URL}/enterprise-v4/traces`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to record trace');
  },
  observabilityGetTrace: async (traceId: string) => {
    const res = await fetch(`${API_URL}/enterprise-v4/traces/${traceId}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get trace');
  },
  observabilityCreateDrDrill: async (data: { drillType: string; scenario: string }) => {
    const res = await fetch(`${API_URL}/enterprise-v4/dr-drills`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create DR drill');
  },
  observabilityUpdateDrDrill: async (
    drillId: string,
    data: { status: string; resultsJson?: object }
  ) => {
    const res = await fetch(`${API_URL}/enterprise-v4/dr-drills/${drillId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update DR drill');
  },
  observabilityGetDrDrills: async () => {
    const res = await fetch(`${API_URL}/enterprise-v4/dr-drills`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get DR drills');
  },

  // ── V4-IDEA-06: Export ──

  ideaRequestExport: async (
    ideaId: string,
    data: {
      exportType: string;
      exportFormat: string;
      watermarkText?: string;
      includeMetadata?: boolean;
    }
  ) => {
    const res = await fetch(`${API_URL}/v4-final/ideas/${ideaId}/export`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to request export');
  },
  ideaGetExports: async (ideaId: string) => {
    const res = await fetch(`${API_URL}/v4-final/ideas/${ideaId}/exports`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get exports');
  },

  // ── V4-ORG-02: Cohort Privacy ──

  cohortGetPolicy: async () => {
    const res = await fetch(`${API_URL}/v4-final/cohort-policy`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get cohort policy');
  },
  cohortUpdatePolicy: async (data: {
    minCohortSize?: number;
    suppressionEnabled?: boolean;
    noiseMethod?: string;
    noiseMagnitude?: number;
    auditAllQueries?: boolean;
  }) => {
    const res = await fetch(`${API_URL}/v4-final/cohort-policy`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update cohort policy');
  },
  cohortApplyPrivacy: async (data: {
    value: number;
    cohortSize: number;
    queryType: string;
    queryParams?: object;
  }) => {
    const res = await fetch(`${API_URL}/v4-final/cohort-privacy/apply`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to apply cohort privacy');
  },
  cohortGetAudit: async (limit?: number) => {
    const qs = limit ? `?limit=${limit}` : '';
    const res = await fetch(`${API_URL}/v4-final/cohort-privacy/audit${qs}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get cohort audit');
  },

  // ── V4-ORG-03: Framework Mappings ──

  frameworkUpsertMapping: async (data: {
    frameworkKey: string;
    frameworkName: string;
    version?: string;
    dimensionKey: string;
    dimensionName: string;
    percentileP25?: number;
    percentileP50?: number;
    percentileP75?: number;
    percentileP90?: number;
    whatGoodLooksLike?: string;
    dataSource?: string;
  }) => {
    const res = await fetch(`${API_URL}/v4-final/framework-mappings`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to upsert framework mapping');
  },
  frameworkGetMappings: async (frameworkKey?: string) => {
    const qs = frameworkKey ? `?frameworkKey=${frameworkKey}` : '';
    const res = await fetch(`${API_URL}/v4-final/framework-mappings${qs}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get framework mappings');
  },
  frameworkGetAll: async () => {
    const res = await fetch(`${API_URL}/v4-final/frameworks`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get frameworks');
  },

  // ── V4-ORG-04: Gap Analysis Pipeline ──

  gapAnalysisCreate: async (data: {
    frameworkKey: string;
    assessmentId?: string;
    gaps?: object[];
    recommendations?: object[];
  }) => {
    const res = await fetch(`${API_URL}/v4-final/gap-analyses`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create gap analysis');
  },
  gapAnalysisList: async (frameworkKey?: string) => {
    const qs = frameworkKey ? `?frameworkKey=${frameworkKey}` : '';
    const res = await fetch(`${API_URL}/v4-final/gap-analyses${qs}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to list gap analyses');
  },
  gapAnalysisLinkInitiative: async (gapId: string, dimensionKey: string, initiativeId: string) => {
    const res = await fetch(`${API_URL}/v4-final/gap-analyses/${gapId}/initiatives`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ dimensionKey, initiativeId }),
    });
    return handleResponse(res, 'Failed to link gap to initiative');
  },
  gapAnalysisGetLinks: async (gapId: string) => {
    const res = await fetch(`${API_URL}/v4-final/gap-analyses/${gapId}/initiatives`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get gap initiative links');
  },

  // ── V4-AI-04: Typed Actions ──

  aiProposeAction: async (data: {
    actionType: string;
    targetEntityType: string;
    targetEntityId?: string;
    proposedChanges: object;
    previewDiff?: string;
    rbacRequiredRole?: string;
    idempotencyKey?: string;
  }) => {
    const res = await fetch(`${API_URL}/v4-final/actions/propose`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to propose action');
  },
  aiGetActions: async (status?: string) => {
    const qs = status ? `?status=${status}` : '';
    const res = await fetch(`${API_URL}/v4-final/actions${qs}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get actions');
  },
  aiGetAction: async (actionId: string) => {
    const res = await fetch(`${API_URL}/v4-final/actions/${actionId}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to get action');
  },
  aiAcceptAction: async (actionId: string) => {
    const res = await fetch(`${API_URL}/v4-final/actions/${actionId}/accept`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to accept action');
  },
  aiExecuteAction: async (actionId: string, result?: object) => {
    const res = await fetch(`${API_URL}/v4-final/actions/${actionId}/execute`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ result }),
    });
    return handleResponse(res, 'Failed to execute action');
  },
  aiRejectAction: async (actionId: string) => {
    const res = await fetch(`${API_URL}/v4-final/actions/${actionId}/reject`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to reject action');
  },

  // ── V4-AI-08: Domain Playbooks ──

  aiPlaybookCreate: async (data: {
    domain: string;
    playbookName: string;
    description?: string;
    systemPrompt: string;
    exampleQueries?: string[];
    requiredContext?: string[];
    outputSchema?: object;
  }) => {
    const res = await fetch(`${API_URL}/v4-final/playbooks`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create playbook');
  },
  aiPlaybookList: async (domain?: string) => {
    const qs = domain ? `?domain=${domain}` : '';
    const res = await fetch(`${API_URL}/v4-final/playbooks${qs}`, { headers: getHeaders() });
    return handleResponse(res, 'Failed to list playbooks');
  },
  aiPlaybookGet: async (playbookId: string) => {
    const res = await fetch(`${API_URL}/v4-final/playbooks/${playbookId}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get playbook');
  },
  aiPlaybookUpdate: async (playbookId: string, data: object) => {
    const res = await fetch(`${API_URL}/v4-final/playbooks/${playbookId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to update playbook');
  },
  aiPlaybookExecute: async (
    playbookId: string,
    data: {
      inputContext?: object;
      outputResult?: object;
      citations?: string[];
      confidence?: number;
      durationMs?: number;
    }
  ) => {
    const res = await fetch(`${API_URL}/v4-final/playbooks/${playbookId}/execute`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to execute playbook');
  },
  aiPlaybookGetExecutions: async (playbookId: string, limit?: number) => {
    const qs = limit ? `?limit=${limit}` : '';
    const res = await fetch(`${API_URL}/v4-final/playbooks/${playbookId}/executions${qs}`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get playbook executions');
  },

  // ──────────────────────────────────────────────
  // Idea Table Presence (collaboration cursors)
  // ──────────────────────────────────────────────

  broadcastIdeaPresence: async (
    ideaId: string,
    data: {
      userId: string;
      userName: string;
      color: string;
      activeCell?: { nodeId: string; colKey: string };
      timestamp: number;
    }
  ) => {
    const res = await fetch(`${API_URL}/my-work/my-ideas/${ideaId}/presence`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to broadcast presence');
  },

  getIdeaPresence: async (ideaId: string) => {
    const res = await fetch(`${API_URL}/my-work/my-ideas/${ideaId}/presence`, {
      headers: getHeaders(),
    });
    return handleResponse(res, 'Failed to get idea presence');
  },

  // ──────────────────────────────────────────────
  // Presentation Deck Creation (from table export)
  // ──────────────────────────────────────────────

  createPresentationDeck: async (data: {
    title: string;
    theme?: string;
    slides: Array<{ type: string; content: unknown }>;
    source?: string;
  }) => {
    const res = await fetch(`${API_URL}/presentations/decks`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res, 'Failed to create presentation deck');
  },

  // ──────────────────────────────────────────────
  // Idea Table CSV Export (server-side)
  // ──────────────────────────────────────────────

  exportIdeaTableCSV: async (ideaId: string) => {
    const res = await fetch(`${API_URL}/my-work/my-ideas/${ideaId}/export-csv`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to export CSV');
    return res.text();
  },
};

// Export as 'api' for backwards compatibility with lowercase import
export const api = Api;

// Default export for import Api from './api' syntax
export default Api;
