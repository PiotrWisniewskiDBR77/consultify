/**
 * Token Service
 * 
 * Handles automatic token management:
 * - Auto-refresh before expiration
 * - Auto-recovery on 401 errors
 * - Session persistence across page reloads
 * - Silent re-authentication
 */

const API_URL = '/api';

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

    /**
     * Initialize token service - call on app startup
     */
    init() {
        const token = this.getToken();
        if (token) {
            this.scheduleRefresh(token);
        }

        // Listen for 401 errors globally
        window.addEventListener('auth-error', this.handleAuthError.bind(this));
        
        // Check token on visibility change (user comes back to tab)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.checkAndRefreshToken();
            }
        });

        console.log('[TokenService] Initialized');
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
        this.scheduleRefresh(token);
    }

    /**
     * Clear all tokens
     */
    clearTokens() {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
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
                    .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
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
            console.log(`[TokenService] Scheduling refresh in ${Math.round(refreshIn / 1000 / 60)} minutes`);
            this.refreshTimer = setTimeout(() => {
                this.refreshToken();
            }, refreshIn);
        } else if (timeUntilExpiry > 0) {
            // Token expiring soon, refresh now
            this.refreshToken();
        }
    }

    /**
     * Check and refresh token if needed
     */
    async checkAndRefreshToken(): Promise<boolean> {
        const token = this.getToken();
        if (!token) return false;

        if (this.isTokenExpired(token, 300)) { // 5 min buffer
            return await this.refreshToken() !== null;
        }
        return true;
    }

    /**
     * Refresh the access token using refresh token
     */
    async refreshToken(): Promise<string | null> {
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
        
        if (!refreshToken) {
            console.log('[TokenService] No refresh token available');
            return null;
        }

        try {
            console.log('[TokenService] Refreshing token...');
            const res = await fetch(`${API_URL}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });

            if (!res.ok) {
                console.error('[TokenService] Refresh failed:', res.status);
                // Clear invalid tokens
                if (res.status === 401) {
                    this.clearTokens();
                    this.notifyAuthError();
                }
                return null;
            }

            const data: RefreshResult = await res.json();
            this.saveTokens(data.token, data.refreshToken);
            console.log('[TokenService] Token refreshed successfully');
            return data.token;
        } catch (error) {
            console.error('[TokenService] Refresh error:', error);
            return null;
        }
    }

    /**
     * Handle authentication errors
     */
    private handleAuthError() {
        console.log('[TokenService] Auth error detected, attempting recovery...');
        this.refreshToken();
    }

    /**
     * Notify app of auth error - uses same event name as App.tsx expects
     */
    private notifyAuthError() {
        console.log('[TokenService] Notifying app of token expiration');
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

// Singleton instance
export const tokenService = new TokenService();

// Initialize on module load
if (typeof window !== 'undefined') {
    // Delay init to ensure localStorage is available
    setTimeout(() => tokenService.init(), 0);
}

export default tokenService;

