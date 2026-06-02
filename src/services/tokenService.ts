/**
 * Token Service
 *
 * Handles automatic token management:
 * - Auto-refresh before expiration
 * - Auto-recovery on 401 errors
 * - Session persistence across page reloads
 * - Silent re-authentication
 */

import { clearPersonalTasksCache } from './personalTasksCache';

const API_URL = '/api';
const REFRESH_BACKOFF_STORAGE_KEY = 'consultify:authRefreshBackoff:v1';
const AUTH_LOOP_GUARD_STORAGE_KEY = 'consultify:authLoopGuard:v1';

interface TokenPayload {
  id: string;
  email: string;
  exp: number;
  iat: number;
}

interface RefreshResult {
  token: string;
  refreshToken?: string;
  expiresIn: number;
}

class TokenService {
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private isRefreshing = false;
  private refreshPromise: Promise<string | null> | null = null;
  private isInitialized = false;
  private refreshBackoffMs = 0;
  private refreshBlockedUntil = 0;
  private lastAuthErrorAt = 0;
  private lastImmediateRefreshAttemptAt = 0;
  private readonly authErrorCooldownMs = 5000;
  private readonly immediateRefreshCooldownMs = 10000;
  private readonly onAuthError = () => {
    this.handleAuthError();
  };
  private readonly onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      void this.checkAndRefreshToken();
    }
  };

  /**
   * Initialize token service - call on app startup
   */
  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    if (this.isAuthLoopGuardOpen()) {
      this.logAuthStabilityMarker('auth_loop_guard_init_skip');
      return;
    }
    this.hydrateRefreshBackoff();

    const token = this.getToken();
    if (token) {
      this.scheduleRefresh(token);
    }

    // Listen for 401 errors globally
    window.addEventListener('auth-error', this.onAuthError);

    // Check token on visibility change (user comes back to tab)
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  /**
   * Get current token from storage
   */
  getToken(): string | null {
    return localStorage.getItem('token');
  }

  /**
   * Get refresh token from storage
   */
  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  /**
   * Save tokens to storage
   */
  saveTokens(token: string, refreshToken?: string) {
    localStorage.setItem('token', token);
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
    clearPersonalTasksCache();
    this.scheduleRefresh(token);
  }

  /**
   * Clear all tokens
   */
  clearTokens() {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    clearPersonalTasksCache();
    this.refreshBackoffMs = 0;
    this.refreshBlockedUntil = 0;
    this.clearRefreshBackoff();
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Decode JWT token payload
   */
  decodeToken(token: string): TokenPayload | null {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error('[TokenService] Failed to decode token:', e);
      return null;
    }
  }

  /**
   * Check if token is expired or about to expire
   */
  isTokenExpired(token: string, bufferSeconds = 60): boolean {
    const payload = this.decodeToken(token);
    if (!payload) return true;

    const now = Math.floor(Date.now() / 1000);
    return payload.exp <= now + bufferSeconds;
  }

  /**
   * Get time until token expires (in milliseconds)
   */
  getTimeUntilExpiry(token: string): number {
    const payload = this.decodeToken(token);
    if (!payload) return 0;

    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, (payload.exp - now) * 1000);
  }

  /**
   * Schedule token refresh before expiration
   */
  private scheduleRefresh(token: string) {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    const timeUntilExpiry = this.getTimeUntilExpiry(token);
    // Refresh 5 minutes before expiry, or immediately if less than 5 min left
    const refreshIn = Math.max(0, timeUntilExpiry - 5 * 60 * 1000);

    if (refreshIn > 0) {
      this.refreshTimer = setTimeout(() => {
        void this.refreshToken();
      }, refreshIn);
    } else if (timeUntilExpiry > 0) {
      // Token expiring soon. Guard with cooldown so we don't spam refresh
      // when multiple listeners trigger around the same frame.
      const now = Date.now();
      if (now - this.lastImmediateRefreshAttemptAt < this.immediateRefreshCooldownMs) return;
      this.lastImmediateRefreshAttemptAt = now;
      void this.refreshToken();
    }
  }

  /**
   * Check and refresh token if needed
   */
  async checkAndRefreshToken(): Promise<boolean> {
    const token = this.getToken();
    if (!token) return false;

    if (this.isTokenExpired(token, 300)) {
      // 5 min buffer
      return (await this.refreshToken()) !== null;
    }
    return true;
  }

  /**
   * Refresh the access token using refresh token
   */
  async refreshToken(): Promise<string | null> {
    if (this.isAuthLoopGuardOpen()) {
      this.logAuthStabilityMarker('auth_loop_guard_refresh_skip');
      return null;
    }
    this.hydrateRefreshBackoff();
    const now = Date.now();
    if (this.refreshBlockedUntil > now) {
      this.logAuthStabilityMarker('auth_refresh_backoff_open', {
        blockedForMs: this.refreshBlockedUntil - now,
      });
      return null;
    }

    // Prevent multiple simultaneous refresh attempts
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this._doRefresh();

    try {
      return await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async _doRefresh(): Promise<string | null> {
    const refreshToken = this.getRefreshToken();

    try {
      // Prefer cookie-based refresh when available (httpOnly cookie set by backend).
      // Fallback to legacy localStorage refreshToken for older sessions.
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(refreshToken ? { refreshToken } : {}),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        console.error('[TokenService] Refresh failed:', res.status);
        // Clear invalid tokens
        if (res.status === 401) {
          this.clearTokens();
          this.notifyAuthError();
        } else {
          this.bumpRefreshBackoff();
        }
        return null;
      }

      const data: RefreshResult = await res.json();
      this.refreshBackoffMs = 0;
      this.refreshBlockedUntil = 0;
      this.clearRefreshBackoff();
      this.saveTokens(data.token, data.refreshToken);
      this.logAuthStabilityMarker('auth_refresh_backoff_close');
      return data.token;
    } catch (error) {
      console.error('[TokenService] Refresh error:', error);
      this.bumpRefreshBackoff();
      return null;
    }
  }

  /**
   * Handle authentication errors
   */
  private handleAuthError() {
    if (this.isAuthLoopGuardOpen()) return;
    if (!this.getToken() && !this.getRefreshToken()) return;
    const now = Date.now();
    if (this.isRefreshing) return;
    if (this.refreshBlockedUntil > now) return;
    if (now - this.lastAuthErrorAt < this.authErrorCooldownMs) {
      this.logAuthStabilityMarker('auth_error_debounced', {
        suppressedForMs: this.authErrorCooldownMs - (now - this.lastAuthErrorAt),
      });
      return;
    }
    this.lastAuthErrorAt = now;
    this.logAuthStabilityMarker('auth_error_recovery_attempt');
    void this.refreshToken();
  }

  private bumpRefreshBackoff() {
    const next = this.refreshBackoffMs > 0 ? Math.min(this.refreshBackoffMs * 2, 60_000) : 1_000;
    this.refreshBackoffMs = next;
    this.refreshBlockedUntil = Date.now() + next;
    this.persistRefreshBackoff();
    this.logAuthStabilityMarker('auth_refresh_backoff_open', {
      blockedForMs: next,
    });
  }

  private hydrateRefreshBackoff() {
    if (typeof window === 'undefined') return;
    if (this.refreshBlockedUntil > Date.now()) return;
    try {
      const raw = sessionStorage.getItem(REFRESH_BACKOFF_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.blockedUntil !== 'number') return;
      if (parsed.blockedUntil <= Date.now()) {
        sessionStorage.removeItem(REFRESH_BACKOFF_STORAGE_KEY);
        return;
      }
      this.refreshBackoffMs = Number(parsed.backoffMs || 1_000);
      this.refreshBlockedUntil = parsed.blockedUntil;
    } catch {
      // ignore storage errors
    }
  }

  private persistRefreshBackoff() {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(
        REFRESH_BACKOFF_STORAGE_KEY,
        JSON.stringify({
          backoffMs: this.refreshBackoffMs,
          blockedUntil: this.refreshBlockedUntil,
        })
      );
    } catch {
      // ignore storage errors
    }
  }

  private clearRefreshBackoff() {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.removeItem(REFRESH_BACKOFF_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }

  private logAuthStabilityMarker(marker: string, details: Record<string, unknown> = {}) {
    if (typeof console === 'undefined') return;
    console.info('[stability:auth]', { marker, ...details });
  }

  private isAuthLoopGuardOpen(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const raw = sessionStorage.getItem(AUTH_LOOP_GUARD_STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const blockedUntil = Number(parsed?.blockedUntil || 0);
      return blockedUntil > Date.now();
    } catch {
      return false;
    }
  }

  /**
   * Notify app of auth error - uses same event name as App.tsx expects
   */
  private notifyAuthError() {
    window.dispatchEvent(new CustomEvent('auth:token-expired'));
  }

  /**
   * Wrap fetch to automatically handle 401 and retry with refreshed token
   */
  async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const token = this.getToken();

    const headers = new Headers(options.headers);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    let res = await fetch(url, { ...options, headers });

    // If 401, try to refresh and retry once
    if (res.status === 401) {
      const newToken = await this.refreshToken();
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`);
        res = await fetch(url, { ...options, headers });
      }
    }

    return res;
  }
}

const TOKEN_SERVICE_SINGLETON_KEY = '__consultifyTokenServiceSingleton__';

type GlobalTokenServiceWindow = Window & {
  [TOKEN_SERVICE_SINGLETON_KEY]?: TokenService;
  __consultifyTokenServiceInitialized__?: boolean;
};

const resolveTokenServiceSingleton = (): TokenService => {
  if (typeof window === 'undefined') {
    return new TokenService();
  }
  const scopedWindow = window as GlobalTokenServiceWindow;
  if (!scopedWindow[TOKEN_SERVICE_SINGLETON_KEY]) {
    scopedWindow[TOKEN_SERVICE_SINGLETON_KEY] = new TokenService();
  }
  return scopedWindow[TOKEN_SERVICE_SINGLETON_KEY] as TokenService;
};

// Singleton instance (forced globally to avoid duplicate module copies in runtime)
export const tokenService = resolveTokenServiceSingleton();

export function initializeTokenServiceOnce() {
  if (typeof window === 'undefined') return;
  const scopedWindow = window as GlobalTokenServiceWindow;
  if (scopedWindow.__consultifyTokenServiceInitialized__) return;
  scopedWindow.__consultifyTokenServiceInitialized__ = true;

  window.setTimeout(() => {
    console.info('[stability:auth]', { marker: 'token_service_init_once' });
    tokenService.init();
  }, 0);
}

export default tokenService;
