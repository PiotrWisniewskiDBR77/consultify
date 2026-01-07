/**
 * Base API Client
 * Core utilities for making API requests
 */

import { tokenService } from '../tokenService';

export const API_URL = '/api';

let correlationId = sessionStorage.getItem('correlationId');
if (!correlationId) {
    correlationId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
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
export const fetchWithRetry = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = { ...getHeaders(), ...((options.headers as Record<string, string>) || {}) };
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
 * Handle API response with error handling
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
        window.dispatchEvent(
            new CustomEvent('DEMO_ACTION_BLOCKED', {
                detail: {
                    message: data.message || data.error,
                    action: data.action,
                },
            }),
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

    throw new Error(data.error || defaultError);
};

/**
 * HTTP method helpers
 */
export const apiGet = async <T = unknown>(endpoint: string, defaultError = 'Request failed'): Promise<T> => {
    const res = await fetchWithRetry(`${API_URL}${endpoint}`);
    return handleResponse<T>(res, defaultError);
};

export const apiPost = async <T = unknown>(
    endpoint: string,
    body: unknown,
    defaultError = 'Request failed',
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
    defaultError = 'Request failed',
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
    defaultError = 'Request failed',
): Promise<T> => {
    const res = await fetchWithRetry(`${API_URL}${endpoint}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
    return handleResponse<T>(res, defaultError);
};

export const apiDelete = async <T = unknown>(endpoint: string, defaultError = 'Request failed'): Promise<T> => {
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
