/**
 * Base API Client
 * Enterprise SaaS Architecture - Core HTTP utilities
 * 
 * Provides: fetchWithRetry, handleResponse, getHeaders
 * Features: Token refresh, correlation IDs, error handling
 */

import { tokenService } from '../tokenService';

export const API_URL = '/api';

// Generate correlation ID for request tracing
let correlationId = typeof sessionStorage !== 'undefined' 
    ? sessionStorage.getItem('correlationId') 
    : null;

if (!correlationId) {
    correlationId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('correlationId', correlationId);
    }
}

/**
 * Get standard headers for API requests
 */
export const getHeaders = (): Record<string, string> => {
    const token = tokenService.getToken();
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        'X-Correlation-ID': correlationId as string
    };
};

/**
 * Get headers without Content-Type (for FormData uploads)
 */
export const getAuthHeaders = (): Record<string, string> => {
    const token = tokenService.getToken();
    return {
        'Authorization': token ? `Bearer ${token}` : '',
        'X-Correlation-ID': correlationId as string
    };
};

/**
 * Fetch wrapper with automatic token refresh on 401
 */
export const fetchWithRetry = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = { ...getHeaders(), ...(options.headers as Record<string, string> || {}) };
    let res = await fetch(url, { ...options, headers });

    // If 401, try to refresh token and retry once
    if (res.status === 401) {
        console.log('[Api] Got 401, attempting token refresh...');
        const newToken = await tokenService.refreshToken();
        if (newToken) {
            headers['Authorization'] = `Bearer ${newToken}`;
            res = await fetch(url, { ...options, headers });
        } else {
            // Token refresh failed, notify app
            window.dispatchEvent(new CustomEvent('auth:token-expired'));
        }
    }

    return res;
};

/**
 * Handle JSON response with error handling
 */
export const handleResponse = async <T = unknown>(res: Response, defaultError: string): Promise<T> => {
    if (res.ok) {
        // Some endpoints return 204 No Content
        if (res.status === 204) return null as T;
        return res.json();
    }

    const data = await res.json().catch(() => ({}));

    // Check for Demo Block
    if (res.status === 403 && (data.code === 'DEMO_BLOCKED' || data.errorCode === 'DEMO_ACTION_BLOCKED')) {
        window.dispatchEvent(new CustomEvent('DEMO_ACTION_BLOCKED', {
            detail: {
                message: data.message || data.error,
                action: data.action
            }
        }));
        return null as T;
    }

    // Check for AI Budget Freeze
    if (res.status === 403 && data.code === 'AI_BUDGET_EXHAUSTED') {
        const { useAppStore } = await import('../../store/useAppStore');
        const store = useAppStore.getState();
        store.setAiFreezeStatus({
            isFrozen: true,
            reason: data.error,
            scope: data.budgetStatus?.scope || 'Global'
        });
        throw new Error(data.error || 'AI Budget Exhausted');
    }

    throw new Error(data.error || data.message || defaultError);
};

/**
 * Handle Blob response for file downloads
 */
export const handleBlobResponse = async (res: Response, defaultError: string): Promise<Blob> => {
    if (res.ok) return res.blob();
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || data.message || defaultError);
};

/**
 * Generic HTTP methods for REST operations
 */
export const httpClient = {
    get: async <T = unknown>(url: string): Promise<T> => {
        const res = await fetchWithRetry(`${API_URL}${url}`);
        return handleResponse<T>(res, `GET ${url} failed`);
    },

    post: async <T = unknown>(url: string, data?: unknown): Promise<T> => {
        const res = await fetchWithRetry(`${API_URL}${url}`, {
            method: 'POST',
            body: data ? JSON.stringify(data) : undefined
        });
        return handleResponse<T>(res, `POST ${url} failed`);
    },

    put: async <T = unknown>(url: string, data?: unknown): Promise<T> => {
        const res = await fetchWithRetry(`${API_URL}${url}`, {
            method: 'PUT',
            body: data ? JSON.stringify(data) : undefined
        });
        return handleResponse<T>(res, `PUT ${url} failed`);
    },

    patch: async <T = unknown>(url: string, data?: unknown): Promise<T> => {
        const res = await fetchWithRetry(`${API_URL}${url}`, {
            method: 'PATCH',
            body: data ? JSON.stringify(data) : undefined
        });
        return handleResponse<T>(res, `PATCH ${url} failed`);
    },

    delete: async <T = unknown>(url: string): Promise<T> => {
        const res = await fetchWithRetry(`${API_URL}${url}`, {
            method: 'DELETE'
        });
        return handleResponse<T>(res, `DELETE ${url} failed`);
    },

    upload: async <T = unknown>(url: string, formData: FormData): Promise<T> => {
        const res = await fetch(`${API_URL}${url}`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: formData
        });
        return handleResponse<T>(res, `Upload to ${url} failed`);
    }
};


