import { User, SessionMode, FullSession, FreeSession, LLMProvider, AIMessageHistory } from '../types';
// FAZA 5: Frontend Metrics
import { frontendMetrics } from '../utils/frontendMetrics';

// Use relative path to allow Vite proxy to handle the request (avoiding CORS)
// or use env var if provided.
const API_URL = '/api';

let correlationId = sessionStorage.getItem('correlationId');
if (!correlationId) {
    correlationId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('correlationId', correlationId);
}

const getHeaders = () => {
    const token = localStorage.getItem('token');

    // Check if token is expired (if expiry time is stored)
    const tokenExpiry = localStorage.getItem('tokenExpiry');
    if (tokenExpiry && parseInt(tokenExpiry) < Date.now()) {
        console.warn('[Auth] Token expired, will attempt refresh on next request');
    }

    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        'X-Correlation-ID': correlationId as string
    };
};

// FAZA 5: Wrapper for fetch with metrics tracking and automatic token refresh
const trackedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const startTime = Date.now();
    const method = options.method || 'GET';
    const headers = options.headers as Record<string, string> || {};
    const hasAuth = headers['Authorization'] || (options.headers && 'Authorization' in options.headers);

    try {
        let response = await fetch(url, options);
        const duration = Date.now() - startTime;

        // Track API call metrics
        frontendMetrics.trackApiCall(url, method, duration, response.status);

        // If unauthorized and we have auth headers, try to refresh token
        if (response.status === 401 && hasAuth) {
            const errorData = await response.clone().json().catch(() => ({}));
            if (errorData.error === 'Token expired' || errorData.error === 'Unauthorized') {
                const newToken = await refreshAccessToken();
                if (newToken) {
                    // Retry with new token
                    const retryHeaders = {
                        ...headers,
                        'Authorization': `Bearer ${newToken}`
                    };
                    const retryOptions = {
                        ...options,
                        headers: retryHeaders
                    };
                    response = await fetch(url, retryOptions);
                    const retryDuration = Date.now() - startTime;
                    frontendMetrics.trackApiCall(url, method, retryDuration, response.status);
                }
            }
        }

        return response;
    } catch (error) {
        const duration = Date.now() - startTime;

        // Track failed API calls
        frontendMetrics.trackApiCall(url, method, duration, 0);

        // Track error
        if (error instanceof Error) {
            frontendMetrics.trackError(error, { url, method });
        }

        throw error;
    }
};

const handleResponse = async (res: Response, defaultError: string) => {
    if (res.ok) {
        // Some endpoints return 204 No Content
        if (res.status === 204) return null;
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
        // We still throw to stop execution, but the UI will handle the modal
        throw new Error(data.message || data.error || 'Action blocked in Demo Mode');
    }

    // Check for AI Budget Freeze (Phase 8: Prestige)
    if (res.status === 403 && data.code === 'AI_BUDGET_EXHAUSTED') {
        const { useAppStore } = await import('../store/useAppStore');
        const store = useAppStore.getState();
        store.setAiFreezeStatus({
            isFrozen: true,
            reason: data.error,
            scope: data.budgetStatus?.scope || 'Global'
        });
        throw new Error(data.error || 'AI Budget Exhausted');
    }

    throw new Error(data.error || defaultError);
};


// Token refresh helper
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
    if (isRefreshing && refreshPromise) {
        return refreshPromise;
    }

    isRefreshing = true;
    refreshPromise = (async () => {
        try {
            const refreshToken = localStorage.getItem('refreshToken');
            if (!refreshToken) {
                console.warn('[Auth] No refresh token available');
                return null;
            }

            const res = await trackedFetch(`${API_URL}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });

            if (!res.ok) {
                // Refresh token expired or invalid - clear tokens and redirect to login
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                window.dispatchEvent(new CustomEvent('auth:token-expired'));
                return null;
            }

            const data = await res.json();
            if (data.token) {
                localStorage.setItem('token', data.token);
                if (data.refreshToken) {
                    localStorage.setItem('refreshToken', data.refreshToken);
                }
                return data.token;
            }
            return null;
        } catch (error) {
            console.error('[Auth] Token refresh failed:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            window.dispatchEvent(new CustomEvent('auth:token-expired'));
            return null;
        } finally {
            isRefreshing = false;
            refreshPromise = null;
        }
    })();

    return refreshPromise;
};


export const Api = {
    // --- AUTH ---
    login: async (email: string, password: string): Promise<User> => {
        console.log('Api.login called:', { email, url: `${API_URL}/auth/login` });

        try {
            const res = await trackedFetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await handleResponse(res, 'Login failed');

            // Validate response structure
            if (!data || !data.user || !data.token) {
                throw new Error('Invalid login response: missing user or token');
            }

            // Store tokens securely
            localStorage.setItem('token', data.token);
            if (data.refreshToken) {
                localStorage.setItem('refreshToken', data.refreshToken);
            }

            // Store token expiry if provided
            if (data.expiresIn) {
                const expiryTime = Date.now() + (data.expiresIn * 1000);
                localStorage.setItem('tokenExpiry', expiryTime.toString());
            }

            console.log('[Auth] Login successful, token stored');
            return data.user;
        } catch (error: any) {
            console.error('[Auth] Login error:', error);
            // Clear any partial tokens on error
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('tokenExpiry');
            throw error;
        }
    },

    register: async (userData: Record<string, unknown> & { email: string; password: string }): Promise<User | { status: string; message?: string }> => {
        const res = await trackedFetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        const data = await handleResponse(res, 'Registration failed');
        if (data.status === 'pending') return data;
        localStorage.setItem('token', data.token);
        return data.user;
    },

    logout: async (): Promise<void> => {
        try {
            await trackedFetch(`${API_URL}/auth/logout`, {
                method: 'POST',
                headers: getHeaders()
            });
        } catch (error) {
            console.warn('Logout API call failed, clearing token anyway:', error);
        } finally {
            // Always clear tokens on logout
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('tokenExpiry');
        }
    },

    // --- DEMO ---
    startDemo: async (language?: string): Promise<{ token: string; organizationId: string; userId: string; expiresAt: string }> => {
        const res = await trackedFetch(`${API_URL}/demo/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: language || 'en' })
        });
        const data = await handleResponse(res, 'Failed to start demo');
        if (data.token) {
            localStorage.setItem('token', data.token);
        }
        return data;
    },

    // --- USERS (Admin) ---
    getUsers: async (): Promise<User[]> => {
        const res = await trackedFetch(`${API_URL}/users`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch users');
    },

    addUser: async (user: Record<string, unknown>): Promise<User> => {
        const res = await trackedFetch(`${API_URL}/users`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(user)
        });
        return handleResponse(res, 'Failed to add user');
    },


    uploadAvatar: async (userId: string, file: File): Promise<{ avatarUrl: string }> => {
        const formData = new FormData();
        formData.append('avatar', file);

        const res = await trackedFetch(`${API_URL}/users/${userId}/avatar`, {
            method: 'POST',
            headers: {
                // Content-Type: multipart/form-data is set automatically with boundary by fetch when body is FormData
                'Authorization': getHeaders()['Authorization']
            },
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to upload avatar');
        return data;
    },

    updateUser: async (id: string, updates: Record<string, unknown>): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/users/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update user');
    },

    deleteUser: async (id: string): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/users/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete user');
    },

    checkSystemHealth: async (): Promise<{ status: string, latency: number }> => {
        const res = await trackedFetch(`${API_URL}/health`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Health check failed');
        return data;
    },

    // Session Management
    getSession: async (userId: string, type: SessionMode, projectId?: string): Promise<FullSession | FreeSession | null> => {
        let url = `${API_URL}/sessions/${userId}?type=${type}`;
        if (projectId) url += `&projectId=${projectId}`;

        const res = await trackedFetch(url, { headers: getHeaders() });
        if (!res.ok) return null;
        const json = await res.json();
        return json.data;
    },

    saveSession: async (userId: string, type: SessionMode, data: FullSession | FreeSession, projectId?: string): Promise<void> => {
        if (userId && projectId) {
            // We won't block session saves usually, but if we do:
            // Actually saveSession might be blocked.
        }
        const res = await trackedFetch(`${API_URL}/sessions`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ userId, type, data, projectId })
        });
        await handleResponse(res, `Failed to save session`);
    },

    // Assessment Reports
    generateAssessmentReport: async (projectId: string): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/sessions/${projectId}/reports`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to generate report');
    },

    getAssessmentReports: async (projectId: string): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/sessions/${projectId}/reports`, {
            headers: getHeaders()
        });
        const data = await handleResponse(res, 'Failed to fetch reports');
        return data.reports || [];
    },

    getAssessmentReport: async (reportId: string): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/sessions/reports/${reportId}`, {
            headers: getHeaders()
        });
        const data = await handleResponse(res, 'Failed to fetch report');
        return data.report;
    },

    updateAssessmentReport: async (reportId: string, updates: { title?: string; status?: string; assessment_snapshot?: object }): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/sessions/reports/${reportId}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        return handleResponse(res, 'Failed to update report');
    },

    deleteAssessmentReport: async (reportId: string): Promise<{ message: string }> => {
        const res = await trackedFetch(`${API_URL}/sessions/reports/${reportId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to delete report');
    },

    exportReportPDF: async (reportId: string, options?: { branding?: Record<string, unknown>; includeCharts?: boolean; includeSummary?: boolean }): Promise<{ pdfUrl: string; message: string }> => {
        const res = await trackedFetch(`${API_URL}/sessions/reports/${reportId}/export-pdf`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(options || {})
        });
        return handleResponse(res, 'Failed to export PDF');
    },

    exportReportExcel: async (reportId: string, options?: { includeCharts?: boolean; includeRawData?: boolean }): Promise<{ excelUrl: string; message: string }> => {
        const res = await trackedFetch(`${API_URL}/sessions/reports/${reportId}/export-excel`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(options || {})
        });
        return handleResponse(res, 'Failed to export Excel');
    },

    compareReports: async (reportIds: string[], saveName?: string): Promise<{ reports: Array<Record<string, unknown>>; comparisonData: Record<string, unknown> }> => {
        const res = await trackedFetch(`${API_URL}/sessions/reports/compare`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ reportIds, saveName })
        });
        return handleResponse(res, 'Failed to compare reports');
    },

    archiveReport: async (reportId: string, archive: boolean): Promise<{ message: string }> => {
        const res = await trackedFetch(`${API_URL}/sessions/reports/${reportId}/archive`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ archive })
        });
        return handleResponse(res, 'Failed to archive report');
    },

    addReportAnnotation: async (reportId: string, annotation: { annotationType?: string; section?: string; content: string; positionData?: Record<string, unknown> }): Promise<{ id: string; message: string }> => {
        const res = await trackedFetch(`${API_URL}/sessions/reports/${reportId}/annotations`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(annotation)
        });
        return handleResponse(res, 'Failed to add annotation');
    },

    getReportAnnotations: async (reportId: string): Promise<Array<{ id: string; annotationType?: string; section?: string; content: string; positionData?: Record<string, unknown>; createdAt?: string }>> => {
        const res = await trackedFetch(`${API_URL}/sessions/reports/${reportId}/annotations`, {
            headers: getHeaders()
        });
        const data = await handleResponse(res, 'Failed to fetch annotations');
        return data.annotations || [];
    },

    shareReport: async (reportId: string, options?: { expiresIn?: number; maxAccessCount?: number }): Promise<{ shareToken: string; shareUrl: string; expiresAt?: string; message: string }> => {
        const res = await trackedFetch(`${API_URL}/sessions/reports/${reportId}/share`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(options || {})
        });
        return handleResponse(res, 'Failed to create share link');
    },

    getSharedReport: async (shareToken: string): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/sessions/reports/shared/${shareToken}`, {
            method: 'GET'
            // No auth headers for public endpoint
        });
        const data = await handleResponse(res, 'Failed to access shared report');
        return data.report;
    },



    // --- AI ---
    // --- AI ---
    chatWithAI: async (message: string, history: AIMessageHistory[], systemInstruction?: string, roleName?: string): Promise<string> => {
        try {
            const response = await trackedFetch(`${API_URL}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, history, systemInstruction, roleName })
            });
            const data = await response.json();
            return data.text;
        } catch (error) {
            console.error('API Chat Error', error);
            throw error;
        }
    },

    chatWithAIStream: async (
        message: string,
        history: AIMessageHistory[],
        onChunk: (text: string) => void,
        onDone: () => void,
        systemInstruction?: string,
        context?: Record<string, unknown>,
        roleName?: string
    ): Promise<void> => {
        // #region agent log
        const token = localStorage.getItem('token');
        console.log('[DEBUG-A] chatWithAIStream entry:', { hasToken: !!token, tokenLength: token?.length || 0, historyLength: history?.length || 0, roleName });
        fetch('http://127.0.0.1:7242/ingest/690b8f02-96fa-4527-ae57-5d2b028e8181', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'api.ts:chatWithAIStream:entry', message: 'Stream request started', data: { hasToken: !!token, tokenLength: token?.length || 0, historyLength: history?.length || 0, hasContext: !!context, roleName }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'A' }) }).catch(() => { });
        // #endregion
        try {
            const response = await trackedFetch(`${API_URL}/ai/chat/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, history, systemInstruction, context, roleName })
            });

            // #region agent log
            console.log('[DEBUG-A,C] chatWithAIStream response:', { status: response.status, ok: response.ok, statusText: response.statusText });
            fetch('http://127.0.0.1:7242/ingest/690b8f02-96fa-4527-ae57-5d2b028e8181', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'api.ts:chatWithAIStream:response', message: 'Response received', data: { status: response.status, ok: response.ok, statusText: response.statusText }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'A,C' }) }).catch(() => { });
            // #endregion

            if (!response.body) throw new Error('ReadableStream not supported');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n\n');

                // Keep the last part in the buffer as it might be incomplete
                // If the buffer ended with \n\n, the last part will be empty string, which is fine to keep and append to
                buffer = parts.pop() || '';

                for (const part of parts) {
                    if (part.startsWith('data: ')) {
                        const dataStr = part.replace('data: ', '').trim();
                        if (dataStr === '[DONE]') {
                            onDone();
                            return;
                        }
                        try {
                            const data = JSON.parse(dataStr);
                            if (data.text) onChunk(data.text);
                            if (data.error) {
                                console.error('Stream error from server:', data.error);
                                if (data.code === 'AI_BUDGET_EXHAUSTED') {
                                    const { useAppStore } = await import('../store/useAppStore');
                                    useAppStore.getState().setAiFreezeStatus({
                                        isFrozen: true,
                                        reason: data.error,
                                        scope: data.budgetStatus?.scope || 'Global'
                                    });
                                }
                            }

                        } catch (e) {
                            console.error('Failed to parse SSE data:', e, dataStr);
                        }
                    }
                }
            }
            onDone();
        } catch (error) {
            console.error('API Chat Stream Error', error);
            throw error;
        }
    },
    // --- SETTINGS ---
    saveSetting: async (key: string, value: string): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/settings`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ key, value })
        });
        if (!res.ok) throw new Error('Failed to save setting');
    },

    // --- SUPER ADMIN ---
    getOrganizations: async (): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/superadmin/organizations`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch organizations');
        return res.json();
    },

    updateOrganization: async (id: string, updates: { plan?: string; status?: string; discount_percent?: number }): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/superadmin/organizations/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update organization');
    },

    deleteOrganization: async (id: string): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/superadmin/organizations/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete organization');
    },

    getOrganizationBillingDetails: async (orgId: string): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/superadmin/organizations/${orgId}/billing`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch organization billing details');
        return res.json();
    },

    getSuperAdminDashboard: async (): Promise<{
        activity: { total: number; last_hour: number; last_24h: number; last_7d: number };
        ai: { total_ai_calls: number; total_tokens: number; active_users: number };
        counts: { total_users: number; total_orgs: number; active_users_7d: number };
        live?: { total_active_connections: number };
    }> => {
        const res = await trackedFetch(`${API_URL}/superadmin/dashboard`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch dashboard');
        return res.json();
    },

    getActivities: async (limit: number = 50): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/superadmin/activities?limit=${limit}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch activities');
        return res.json();
    },

    getSuperAdminUsers: async (): Promise<User[]> => {
        const res = await trackedFetch(`${API_URL}/superadmin/users`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch users');
        return res.json();
    },

    updateSuperAdminUser: async (id: string, updates: { organizationId?: string; role?: string; status?: string }): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/superadmin/users/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update user');
    },

    createSuperAdminUser: async (user: Record<string, unknown>): Promise<User> => {
        const res = await trackedFetch(`${API_URL}/superadmin/users`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(user)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create super admin');
        return data;
    },

    inviteUser: async (email: string, role: string, organizationId: string): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/superadmin/users/invite`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ email, role, organizationId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to invite user');
        return data;
    },

    adminResetPassword: async (userId: string): Promise<{ resetLink: string, token: string }> => {
        const res = await trackedFetch(`${API_URL}/superadmin/users/${userId}/reset-password`, {
            method: 'POST',
            headers: getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to generate reset link');
        return data;
    },

    adminGetDatabaseTables: async (): Promise<string[]> => {
        const res = await trackedFetch(`${API_URL}/superadmin/database/tables`, {
            headers: getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch tables');
        return data;
    },

    adminGetTableRows: async (tableName: string): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/superadmin/database/rows/${tableName}`, {
            headers: getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch rows');
        return data;
    },

    adminGetStorageStats: async (): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/superadmin/storage/usage`, {
            headers: getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch storage stats');
        return data;
    },

    adminGetOrgFiles: async (orgId: string): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/superadmin/storage/files/${orgId}`, {
            headers: getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch files');
        return data;
    },

    adminDeleteFile: async (orgId: string, path: string): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/superadmin/storage/files`, {
            method: 'DELETE',
            headers: {
                ...getHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ orgId, path })
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
        const res = await trackedFetch(`${API_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, newPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to reset password');
    },

    revertImpersonation: async (): Promise<{ user: User; token: string }> => {
        const res = await trackedFetch(`${API_URL}/auth/revert-impersonation`, {
            method: 'POST',
            headers: getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to revert impersonation');
        return data;
    },

    impersonateUser: async (userId: string): Promise<{ user: User; token: string }> => {
        const res = await trackedFetch(`${API_URL}/superadmin/impersonate`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ userId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to impersonate user');
        return data;
    },

    getSystemSettings: async (): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/settings`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch settings');
        return res.json();
    },

    // --- PROJECTS ---
    getProjects: async (): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/projects`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch projects');
        return res.json();
    },

    createProject: async (data: { name: string; ownerId?: string }): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/projects`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to create project');
        return json;
    },

    deleteProject: async (id: string): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/projects/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete project');
    },

    // AI OBSERVATIONS
    generateGlobalBrainObservations: async () => {
        const response = await trackedFetch(`${API_URL}/knowledge/observations/generate`, {
            method: 'GET',
            headers: getHeaders()
        });
        if (!response.ok) throw new Error('Failed to generate observations');
        return response.json();
    },

    // --- LLM MANAGEMENT ---
    getLLMProviders: async (): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/llm/providers`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch LLM providers');
        return res.json();
    },

    addLLMProvider: async (provider: Partial<LLMProvider> & { name?: string; provider?: string;[key: string]: unknown }): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/llm/providers`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(provider)
        });
        if (!res.ok) throw new Error('Failed to add provider');
    },

    updateLLMProvider: async (id: string, data: Partial<LLMProvider>) => {
        const res = await trackedFetch(`${API_URL}/llm/providers/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to update provider');
        return res.json();
    },

    testLLMConnection: async (config: Partial<LLMProvider>): Promise<{ success: boolean; message: string; response?: string }> => {
        const res = await trackedFetch(`${API_URL}/llm/test`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(config)
        });
        const data = await res.json();
        if (!res.ok) return { success: false, message: data.error || 'Connection failed' };
        return data;
    },

    getOperationalCosts: async (startDate?: string, endDate?: string): Promise<{ items: any[]; totalCost: number }> => {
        let url = `${API_URL}/billing/admin/costs`;
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (params.toString()) url += `? ${params.toString()}`;

        const res = await trackedFetch(url, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch costs');
        return data.costs;
    },

    deleteLLMProvider: async (id: string): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/llm/providers/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete provider');
    },

    // LLM Self-Diagnostic - auto-repairs missing tables and default providers
    diagnoseLLM: async (): Promise<{ status: string; checks: any[]; repairs: string[]; error?: string }> => {
        try {
            const res = await trackedFetch(`${API_URL}/llm/diagnose`, { headers: getHeaders() });
            return res.json();
        } catch (error) {
            console.error('[LLM] Diagnose failed:', error);
            return { status: 'ERROR', checks: [], repairs: [], error: String(error) };
        }
    },

    getPublicLLMProviders: async (): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/llm/providers/public`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch public LLM providers');
        return res.json();
    },

    testOllamaConnection: async (endpoint: string): Promise<{ success: boolean; message?: string; models?: Array<{ name: string;[key: string]: unknown }>; error?: string }> => {
        const res = await trackedFetch(`${API_URL}/llm/test-ollama`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ endpoint })
        });
        return res.json();
    },

    getOllamaModels: async (endpoint: string): Promise<Array<{ name: string;[key: string]: unknown }>> => {
        const res = await trackedFetch(`${API_URL}/llm/ollama-models?endpoint=${encodeURIComponent(endpoint)}`, {
            headers: getHeaders()
        });
        if (!res.ok) return [];
        return res.json();
    },

    getOrganizationLLMConfig: async (orgId: string): Promise<{ activeProviderId: string | null; availableProviders: LLMProvider[] }> => {
        const res = await trackedFetch(`${API_URL}/llm/organization-config/${orgId}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch organization LLM config');
        return res.json();
    },

    updateOrganizationLLMConfig: async (orgId: string, providerId: string | null): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/llm/organization-config/${orgId}`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ providerId })
        });
        if (!res.ok) throw new Error('Failed to update organization LLM config');
    },

    // --- KNOWLEDGE BASE ---
    getKnowledgeFiles: async (): Promise<{ docs: any[], availableFiles: string[] }> => {
        const res = await trackedFetch(`${API_URL}/knowledge/files`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch knowledge files');
        return res.json();
    },

    indexKnowledgeFiles: async (): Promise<{ message: string; indexedCount: number }> => {
        const res = await trackedFetch(`${API_URL}/knowledge/index`, {
            method: 'POST',
            headers: getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Indexing failed');
        return data;
    },

    // ==========================================
    // PHASE 1: TASKS API
    // ==========================================
    getTasks: async (filters?: { projectId?: string; status?: string; assigneeId?: string; priority?: string; initiativeId?: string }): Promise<any[]> => {
        let url = `${API_URL}/tasks`;
        if (filters) {
            const params = new URLSearchParams();
            if (filters.projectId) params.append('projectId', filters.projectId);
            if (filters.status) params.append('status', filters.status);
            if (filters.assigneeId) params.append('assigneeId', filters.assigneeId);
            if (filters.priority) params.append('priority', filters.priority);
            if (filters.initiativeId) params.append('initiativeId', filters.initiativeId);
            if (params.toString()) url += `? ${params.toString()}`;
        }
        const res = await trackedFetch(url, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch tasks');
        return res.json();
    },

    getTask: async (id: string): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/tasks/${id}`, { headers: getHeaders() });
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
        const res = await trackedFetch(`${API_URL}/tasks`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(task)
        });
        return handleResponse(res, 'Failed to create task');
    },

    updateTask: async (id: string, updates: any): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/tasks/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        await handleResponse(res, 'Failed to update task');
    },

    deleteTask: async (id: string): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/tasks/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        await handleResponse(res, 'Failed to delete task');
    },

    getTaskComments: async (taskId: string): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/tasks/${taskId}/comments`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch comments');
        return res.json();
    },

    addTaskComment: async (taskId: string, content: string): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/tasks/${taskId}/comments`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ content })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to add comment');
        return data;
    },

    deleteTaskComment: async (taskId: string, commentId: string): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/tasks/${taskId}/comments/${commentId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete comment');
    },

    // ==========================================
    // PHASE 1: TEAMS API
    // ==========================================
    getTeams: async (): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/teams`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch teams');
        return res.json();
    },

    getTeam: async (id: string): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/teams/${id}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch team');
        return res.json();
    },

    createTeam: async (team: { name: string; description?: string; leadId?: string }): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/teams`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(team)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create team');
        return data;
    },

    updateTeam: async (id: string, updates: any): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/teams/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update team');
    },

    deleteTeam: async (id: string): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/teams/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete team');
    },

    addTeamMember: async (teamId: string, userId: string, role: string = 'member'): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/teams/${teamId}/members`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ userId, role })
        });
        if (!res.ok) throw new Error('Failed to add team member');
    },

    removeTeamMember: async (teamId: string, userId: string): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/teams/${teamId}/members/${userId}`, {
            method: 'DELETE',
            headers: getHeaders()
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
        const res = await trackedFetch(`${API_URL}/notifications?${params.toString()}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch notifications');
        return res.json();
    },

    getUnreadNotificationCount: async (): Promise<number> => {
        const res = await trackedFetch(`${API_URL}/notifications/unread-count`, { headers: getHeaders() });
        if (!res.ok) return 0;
        const data = await res.json();
        return data.count;
    },

    markNotificationRead: async (id: string): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/notifications/${id}/read`, {
            method: 'PUT',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to mark notification as read');
    },

    markAllNotificationsRead: async (): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/notifications/read-all`, {
            method: 'PUT',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to mark all as read');
    },

    deleteNotification: async (id: string): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/notifications/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete notification');
    },

    deleteReadNotifications: async (): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/notifications`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete read notifications');
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
        const res = await trackedFetch(`${API_URL}/notifications`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(notification)
        });
        if (!res.ok) throw new Error('Failed to create notification');
    },

    // ==========================================
    // PHASE 6: AI INTEGRATION
    // ==========================================
    // --- INITIATIVES (Phase 2) ---
    getInitiatives: async (projectId?: string): Promise<any[]> => {
        let url = `${API_URL}/initiatives`;
        if (projectId) url += `? projectId=${projectId}`;
        const res = await trackedFetch(url, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch initiatives');
        return res.json();
    },

    createInitiative: async (initiative: any): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/initiatives`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(initiative)
        });
        return handleResponse(res, 'Failed to create initiative');
    },

    updateInitiative: async (id: string, updates: any): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/initiatives/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        await handleResponse(res, 'Failed to update initiative');
    },

    validateInitiative: async (id: string) => {
        const response = await trackedFetch(`${API_URL}/initiatives/${id}/validate`, {
            method: 'POST',
            headers: getHeaders()
        });
        if (!response.ok) throw new Error('Validation failed');
        return response.json();
    },

    enrichInitiative: async (id: string) => {
        const response = await trackedFetch(`${API_URL}/initiatives/${id}/enrich`, {
            method: 'POST',
            headers: getHeaders()
        });
        if (!response.ok) throw new Error('Enrichment failed');
        return response.json();
    },

    // --- PROJECTS ---
    suggestInitiativeTasks: async (initiativeId: string): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/initiatives/${initiativeId}/tasks/suggest`, {
            method: 'POST',
            headers: getHeaders()
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
        const res = await trackedFetch(`${API_URL}/ai/diagnose`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ axis, input })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Diagnosis failed');
        return data;
    },

    // LAYER 2: RECOMMENDATION
    aiRecommend: async (diagnosisReport: any): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/ai/recommend`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ diagnosisReport })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Recommendation failed');
        return data;
    },

    // LAYER 3: ROADMAP
    aiRoadmap: async (initiatives: any[]): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/ai/roadmap`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ initiatives })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Roadmap generation failed');
        return data;
    },

    // LAYER 4: SIMULATION
    aiSimulate: async (initiatives: any[], revenue: number = 10000000): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/ai/simulate`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ initiatives, revenue })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Simulation failed');
        return data;
    },

    // VALIDATION & VERIFICATION
    aiValidate: async (initiative: any): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/ai/validate`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ initiative })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Validation failed');
        return data;
    },

    aiVerify: async (query: string): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/ai/verify`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ query })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Verification failed');
        return data;
    },

    // FEEDBACK & LEARNING
    aiFeedback: async (feedback: { context: string; prompt: string; response: string; rating: number; correction?: string }): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/ai/feedback`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(feedback)
        });
        if (!res.ok) throw new Error('Failed to save feedback');
    },

    // --- AI STRATEGIC BOARD ---
    getAIIdeas: async (): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/ai/ideas`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch AI ideas');
        return res.json();
    },

    createAIIdea: async (idea: any): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/ai/ideas`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(idea)
        });
        if (!res.ok) throw new Error('Failed to create AI idea');
        return res.json();
    },

    updateAIIdea: async (id: string, updates: any): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/ai/ideas/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update AI idea');
        return res.json();
    },

    deleteAIIdea: async (id: string): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/ai/ideas/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete AI idea');
    },

    // --- AI OBSERVATIONS ---
    getAIObservations: async (): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/ai/observations`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch observations');
        return res.json();
    },

    createAIObservation: async (observation: any): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/ai/observations`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(observation)
        });
        if (!res.ok) throw new Error('Failed to create observation');
        return res.json();
    },

    // --- AI REPORTS ---
    getAIDeepReports: async (): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/ai/reports/performance`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch AI reports');
        return res.json();
    },

    // AI Detail Feedback (for inline rating buttons)
    aiDetailFeedback: async (feedback: { action: string; rating: number; user_comment?: string; original_prompt?: string }): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/ai/feedback`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                context: feedback.action,
                prompt: feedback.original_prompt || '',
                response: '',
                rating: feedback.rating,
                correction: feedback.user_comment
            })
        });
        if (!res.ok) throw new Error('Failed to save feedback');
    },

    // ADMIN ANALYTICS & CONTROLS
    aiGetStats: async (): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/ai/stats`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch AI stats');
        return data;
    },

    getIndustryBenchmarks: async (industry: string = 'General'): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/ai/benchmarks?industry=${industry}`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch benchmarks');
        return data;
    },

    aiGetSystemPrompts: async (): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/ai/prompts`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch prompts');
        return data;
    },

    aiUpdateSystemPrompt: async (key: string, updates: any): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/ai/prompts/${key}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update prompt');
    },

    // --- AI LEARNING & KNOWLEDGE ---
    aiExtractInsights: async (text: string, source: string = 'chat'): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/ai/extract-insight`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ text, source })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to extract insights');
        return data;
    },

    getKnowledgeCandidates: async (status: string = 'pending'): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/knowledge/candidates?status=${status}`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch candidates');
        return data;
    },

    submitKnowledgeCandidate: async (content: string, reasoning: string, source: string, topic?: string): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/knowledge/candidates`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ content, reasoning, source, relatedAxis: topic })
        });
        if (!res.ok) throw new Error('Failed to submit candidate');
    },

    updateCandidateStatus: async (id: string, status: string, adminComment?: string): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/knowledge/candidates/${id}/status`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ status, adminComment })
        });
        if (!res.ok) throw new Error('Failed to update candidate status');
    },

    getGlobalStrategies: async (): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/knowledge/strategies`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch strategies');
        return data;
    },

    createGlobalStrategy: async (title: string, description: string): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/knowledge/strategies`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ title, description })
        });
        if (!res.ok) throw new Error('Failed to create strategy');
    },

    toggleGlobalStrategy: async (id: string, isActive: boolean): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/knowledge/strategies/${id}/toggle`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ isActive })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to toggle strategy');
        return data;
    },

    getKnowledgeDocuments: async (): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/knowledge/documents`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch docs');
        return data;
    },

    uploadKnowledgeDocument: async (file: File): Promise<any> => {
        const formData = new FormData();
        formData.append('file', file);

        // Content-Type header must NOT be set manually for FormData, browser sets it with boundary
        const headers = getHeaders();
        delete (headers as any)['Content-Type'];

        const res = await trackedFetch(`${API_URL}/knowledge/documents`, {
            method: 'POST',
            headers: headers,
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to upload document');
        return data;
    },

    // --- GENERIC DOCUMENT UPLOAD (For Context Builder) ---
    uploadDocument: async (file: File, context?: { tabName?: string, type?: string }): Promise<any> => {
        const formData = new FormData();
        formData.append('file', file);
        if (context) {
            formData.append('context', JSON.stringify(context));
        }

        const headers = getHeaders();
        delete (headers as any)['Content-Type']; // Let browser set boundary

        const res = await trackedFetch(`${API_URL}/documents/upload`, {
            method: 'POST',
            headers: headers,
            body: formData
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to upload document');
        return data;
    },
    // --- FEEDBACK ---
    sendFeedback: async (data: { user_id: string; type: string; message: string; screenshot?: string; url?: string }): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/feedback`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to submit feedback');
    },

    getFeedback: async (): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/feedback`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch feedback');
        return res.json();
    },

    updateFeedbackStatus: async (id: string, status: string): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/feedback/${id}/status`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({ status })
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
        const res = await trackedFetch(`${API_URL}/access-control/requests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to submit access request');
        return json;
    },

    // Verify access code (public)
    verifyAccessCode: async (code: string): Promise<{
        valid: boolean;
        organizationName?: string;
        role?: string;
        reason?: string;
    }> => {
        const res = await trackedFetch(`${API_URL}/access-control/codes/${code}/info`);
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
        const res = await trackedFetch(`${API_URL}/access-control/codes/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Registration failed');
        return json;
    },

    // --- ACCESS CONTROL (Super Admin) ---
    getAccessRequests: async (): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/superadmin/access-requests`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch access requests');
        return res.json();
    },

    approveAccessRequest: async (id: string): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/superadmin/access-requests/${id}/approve`, {
            method: 'POST',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to approve request');
    },

    rejectAccessRequest: async (id: string, reason: string): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/superadmin/access-requests/${id}/reject`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ reason })
        });
        if (!res.ok) throw new Error('Failed to reject request');
    },

    getAccessCodes: async (): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/superadmin/access-codes`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch access codes');
        return res.json();
    },

    generateAccessCode: async (data: { code?: string; role?: string; maxUses?: number; expiresAt?: string }): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/superadmin/access-codes`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to generate access code');
    },

    deactivateAccessCode: async (codeId: string): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/superadmin/access-codes/${codeId}/deactivate`, {
            method: 'POST',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to deactivate access code');
    },
    // ==========================================
    // BILLING & USAGE API
    // ==========================================

    // Generic HTTP methods for billing routes
    get: async (path: string): Promise<any> => {
        const res = await trackedFetch(`${API_URL}${path}`, {
            headers: getHeaders()
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Request failed');
        return json;
    },

    post: async (path: string, data: any): Promise<any> => {
        const res = await trackedFetch(`${API_URL}${path}`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Request failed');
        return json;
    },

    put: async (path: string, data: any): Promise<any> => {
        const res = await trackedFetch(`${API_URL}${path}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Request failed');
        return json;
    },

    delete: async (path: string): Promise<any> => {
        const res = await trackedFetch(`${API_URL}${path}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Request failed');
        return json;
    },

    // Get subscription plans
    getSubscriptionPlans: async (): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/billing/plans`, {
            headers: getHeaders()
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch plans');
        return json;
    },

    // Get user license plans
    getUserPlans: async (): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/billing/user-plans`, {
            headers: getHeaders()
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch user plans');
        return json;
    },

    // Get current billing info
    getCurrentBilling: async (): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/billing/current`, {
            headers: getHeaders()
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch billing');
        return json;
    },

    // Get current usage
    getUsage: async (): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/billing/usage`, {
            headers: getHeaders()
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch usage');
        return json;
    },

    // Subscribe to plan
    subscribeToPlan: async (planId: string, paymentMethodId?: string): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/billing/subscribe`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ planId, paymentMethodId })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Subscription failed');
        return json;
    },

    // Change subscription plan
    changePlan: async (newPlanId: string): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/billing/change-plan`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ newPlanId })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Plan change failed');
        return json;
    },

    // Cancel subscription
    cancelSubscription: async (): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/billing/cancel`, {
            method: 'POST',
            headers: getHeaders()
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Cancellation failed');
        return json;
    },

    // Get invoices
    getInvoices: async (): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/billing/invoices`, {
            headers: getHeaders()
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch invoices');
        return json;
    },

    // --- AI TASK GEN ---
    suggestTasks: async (initiative: any): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/ai/suggest-tasks`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ initiative })
        });
        if (!res.ok) throw new Error('Failed to suggest tasks');
        return res.json();
    },

    generateTaskInsight: async (task: any, initiative: any): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/ai/task-insight`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ task, initiative })
        });
        if (!res.ok) throw new Error('Failed to generate task insight');
        return res.json();
    },

    // --- TOKEN BILLING ---
    getTokenBalance: async () => {
        const res = await trackedFetch(`${API_URL}/token-billing/balance`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to get balance');
        return data.balance;
    },

    getTokenPackages: async () => {
        const res = await trackedFetch(`${API_URL}/token-billing/packages`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to get packages');
        return data.packages;
    },

    getTokenTransactions: async (limit = 50, offset = 0) => {
        const res = await trackedFetch(`${API_URL}/token-billing/transactions?limit=${limit} & offset=${offset}`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to get transactions');
        return data.transactions;
    },

    getApiKeys: async () => {
        const res = await trackedFetch(`${API_URL}/token-billing/api-keys`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to get API keys');
        return data.keys;
    },

    addApiKey: async (keyData: { provider: string, apiKey: string, displayName: string, modelPreference?: string }) => {
        const res = await trackedFetch(`${API_URL}/token-billing/api-keys`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(keyData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to add API key');
        return data.key;
    },

    deleteApiKey: async (keyId: string) => {
        const res = await trackedFetch(`${API_URL}/token-billing/api-keys/${keyId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete API key');
        return data;
    },

    purchaseTokens: async (packageId: string) => {
        const res = await trackedFetch(`${API_URL}/token-billing/purchase`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ packageId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Purchase failed');
        return data;
    },

    // --- TOKEN BILLING ADMIN ---
    getBillingMargins: async () => {
        const res = await trackedFetch(`${API_URL}/token-billing/margins`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to get margins');
        return data.margins;
    },

    updateBillingMargin: async (sourceType: string, marginData: any) => {
        const res = await trackedFetch(`${API_URL}/token-billing/margins/${sourceType}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(marginData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update margin');
        return data;
    },

    upsertTokenPackage: async (packageData: any) => {
        const res = await trackedFetch(`${API_URL}/token-billing/packages`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(packageData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save package');
        return data.package;
    },

    getTokenAnalytics: async (startDate?: string, endDate?: string) => {
        const query = startDate && endDate ? `? startDate=${startDate} & endDate=${endDate}` : '';
        const res = await trackedFetch(`${API_URL}/token-billing/analytics${query}`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to get analytics');
        return data.analytics;
    },

    // ==========================================
    // PMO CONTEXT API (UI Behavior Integration)
    // ==========================================
    getPMOContext: async (projectId: string): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/pmo-context/${projectId}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch PMO context');
        return res.json();
    },

    getPMOTaskLabels: async (projectId: string): Promise<{ taskLabels: Record<string, any[]> }> => {
        const res = await trackedFetch(`${API_URL}/pmo-context/${projectId}/task-labels`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch PMO task labels');
        return res.json();
    },

    // ==========================================
    // STEP 7: METRICS & CONVERSION INTELLIGENCE
    // ==========================================
    getMetricsOverview: async () => {
        const res = await trackedFetch(`${API_URL}/metrics/overview`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch metrics overview');
        return res.json();
    },

    getMetricsFunnels: async (days: number = 30) => {
        const res = await trackedFetch(`${API_URL}/metrics/funnels?days=${days}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch funnels');
        return res.json();
    },

    getMetricsCohorts: async (type: string = 'weekly', weeks: number = 12) => {
        const res = await trackedFetch(`${API_URL}/metrics/cohorts?type=${type}&weeks=${weeks}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch cohorts');
        return res.json();
    },

    getMetricsHelp: async (days: number = 30) => {
        const res = await trackedFetch(`${API_URL}/metrics/help?days=${days}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch help metrics');
        return res.json();
    },

    getMetricsAttribution: async (days: number = 30) => {
        const res = await trackedFetch(`${API_URL}/metrics/attribution?days=${days}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch attribution');
        return res.json();
    },

    getMetricsPartners: async (days: number = 90) => {
        const res = await trackedFetch(`${API_URL}/metrics/partners?days=${days}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch partner metrics');
        return res.json();
    },

    getMetricsWarnings: async () => {
        const res = await trackedFetch(`${API_URL}/metrics/warnings`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch warnings');
        return res.json();
    },

    getOrgMetricsOverview: async () => {
        const res = await trackedFetch(`${API_URL}/metrics/org/overview`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch organization metrics');
        return res.json();
    },

    getOrgMetricsHelp: async () => {
        const res = await trackedFetch(`${API_URL}/metrics/org/help`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch organization help metrics');
        return res.json();
    },

    getOrgMetricsTeam: async () => {
        const res = await trackedFetch(`${API_URL}/metrics/org/team`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch organization team metrics');
        return res.json();
    },

    // ==========================================
    // STEP 9: AI ADVISOR & ACTIONS
    // ==========================================
    getAIActionProposals: async (): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/ai/actions/proposals`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch AI action proposals');
        return res.json();
    },

    getAIActionAudit: async (): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/ai/actions/audit`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch AI action audit log');
        return res.json();
    },

    recordAIActionDecision: async (data: { proposal_id: string, decision: string, reason?: string }): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/ai/actions/decide`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
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
        const res = await trackedFetch(`${API_URL}/organizations/current`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch organizations').then(data => data || []);
    },

    getOrganization: async (orgId: string): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/organizations/${orgId}`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch organization details');
    },

    getOrganizationMembers: async (orgId: string): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/organizations/${orgId}/members`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch organization members').then(data => data || []);
    },

    addOrganizationMember: async (orgId: string, email: string, role: string): Promise<any> => {
        // NOTE: Backend currently expects targetUserId, but UI workflow implies email invite.
        // We will pass email as targetUserId/email field and update backend if needed, 
        // OR we just rely on ID if we have a picker. 
        // For MVP skeleton, we assume we might be adding by ID if we don't have invite flow,
        // BUT to be user friendly, we should probably implement invite.
        // I'll stick to passing the body as is, and update backend later if needed.
        const res = await trackedFetch(`${API_URL}/organizations/${orgId}/members`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ targetUserId: email, role })
        });
        return handleResponse(res, 'Failed to add member');
    },

    createOrganization: async (name: string): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/organizations`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ name })
        });
        return handleResponse(res, 'Failed to create organization');
    },

    activateBilling: async (orgId: string): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/organizations/${orgId}/billing/activate`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to activate billing');
    },

    // Token Ledger API
    getOrgTokenBalance: async (orgId: string): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/organizations/${orgId}/tokens/balance`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch token balance');
    },

    getOrgTokenLedger: async (orgId: string, limit = 50, offset = 0): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/organizations/${orgId}/tokens/ledger?limit=${limit}&offset=${offset}`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch token ledger').then(data => data?.ledger || []);
    },


    // ==========================================
    // PHASE C: CONSULTANT MODE
    // ==========================================
    getConsultantOrgs: async (): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/consultants/orgs`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch consultant organizations');
        return res.json();
    },

    getConsultantClients: async (orgId?: string): Promise<any[]> => {
        let url = `${API_URL}/consultants/clients`;
        if (orgId) url += `?orgId=${orgId}`;
        const res = await trackedFetch(url, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch consultant clients');
        return res.json();
    },

    createConsultantInvite: async (data: { email: string; invitationType: string; firmName?: string; projectName?: string }): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/consultants/invites`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to create invite');
        return json;
    },

    getConsultantInvites: async (): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/consultants/invites`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch invites');
        return res.json();
    },

    // Org Admin: Invite a user (Member or Consultant)
    createOrganizationInvitation: async (email: string, role: string): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/invitations`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ email, role })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to send invitation');
        return json;
    },

    // ==========================================
    // PHASE E: ONBOARDING API
    // ==========================================
    saveOnboardingContext: async (context: any): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/onboarding/context`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(context)
        });
        await handleResponse(res, 'Failed to save onboarding context');
    },

    generateFirstValuePlan: async (): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/onboarding/generate-plan`, {
            method: 'POST',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to generate plan');
    },

    acceptFirstValuePlan: async (acceptedInitiativeIds: string[], idempotencyKey: string): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/onboarding/accept-plan`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ acceptedInitiativeIds, idempotencyKey })
        });
        return handleResponse(res, 'Failed to accept plan');
    },

    getOnboardingStatus: async (): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/onboarding/status`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to get onboarding status');
    },

    getOnboardingPlan: async (): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/onboarding/plan`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to get onboarding plan');
    },

    // --- PHASE G: REFERRALS ---
    getUserReferrals: async (): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/referrals/my`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch user referrals');
    },

    getEcosystemStats: async (): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/referrals/stats`, { headers: getHeaders() });
        return handleResponse(res, 'Failed to fetch ecosystem stats');
    },

    generateReferralCode: async (expiresInDays: number = 90): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/referrals/generate`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ expiresInDays })
        });
        return handleResponse(res, 'Failed to generate referral code');
    },

    // --- ACCESS CODES ---
    validateAccessCode: async (code: string): Promise<{ valid: boolean; type?: string; requiresEmailMatch?: boolean }> => {
        const res = await trackedFetch(`${API_URL}/access-codes/validate/${code}`);
        return res.json();
    },

    acceptAccessCode: async (code: string, email?: string): Promise<{ ok: boolean; type?: string; outcome?: string; organizationId?: string; error?: string }> => {
        const res = await trackedFetch(`${API_URL}/access-codes/accept`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ code, email })
        });
        return res.json();
    },

    // --- DOCUMENTS LIBRARY ---
    uploadDocumentToLibrary: async (file: File, options: { scope: 'project' | 'user'; projectId?: string; description?: string; tags?: string[] }): Promise<any> => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('scope', options.scope);
        if (options.projectId) formData.append('projectId', options.projectId);
        if (options.description) formData.append('description', options.description);
        if (options.tags) formData.append('tags', JSON.stringify(options.tags));

        const token = localStorage.getItem('token');
        const res = await trackedFetch(`${API_URL}/documents/upload`, {
            method: 'POST',
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'X-Correlation-ID': correlationId as string
            },
            body: formData
        });
        return handleResponse(res, 'Failed to upload document');
    },

    getProjectDocuments: async (projectId: string): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/documents/project/${projectId}`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch project documents');
    },

    getUserDocuments: async (): Promise<any[]> => {
        const res = await trackedFetch(`${API_URL}/documents/user`, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch user documents');
    },

    getAllDocuments: async (projectId?: string): Promise<any[]> => {
        const url = projectId
            ? `${API_URL}/documents/all?projectId=${projectId}`
            : `${API_URL}/documents/all`;
        const res = await trackedFetch(url, {
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to fetch documents');
    },

    moveDocumentToProject: async (documentId: string, projectId: string): Promise<any> => {
        const res = await trackedFetch(`${API_URL}/documents/${documentId}/move-to-project`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ projectId })
        });
        return handleResponse(res, 'Failed to move document');
    },

    deleteDocument: async (documentId: string): Promise<void> => {
        const res = await trackedFetch(`${API_URL}/documents/${documentId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        await handleResponse(res, 'Failed to delete document');
    },

    downloadDocument: async (documentId: string): Promise<Blob> => {
        const res = await trackedFetch(`${API_URL}/documents/${documentId}/download`, {
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to download document');
        return res.blob();
    }
};
