/**
 * Settings API Module
 * Enterprise SaaS Architecture - User & System Settings
 */

import { API_URL, fetchWithRetry, handleResponse, getHeaders } from './baseClient';

export interface Integration {
    id: string;
    name: string;
    type: string;
    status: 'active' | 'inactive' | 'error';
    config?: Record<string, unknown>;
    lastSyncAt?: string;
}

export interface Webhook {
    id: string;
    url: string;
    events: string[];
    status: 'active' | 'inactive';
    secret?: string;
    lastTriggeredAt?: string;
}

export const SettingsApi = {
    // ==========================================
    // SYSTEM SETTINGS
    // ==========================================
    
    getSystemSettings: async (): Promise<unknown> => {
        const res = await fetch(`${API_URL}/settings`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch settings');
        return res.json();
    },

    saveSetting: async (key: string, value: string): Promise<void> => {
        const res = await fetch(`${API_URL}/settings`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ key, value })
        });
        if (!res.ok) throw new Error('Failed to save setting');
    },

    // ==========================================
    // INTEGRATIONS
    // ==========================================
    
    getIntegrations: async (organizationId: string): Promise<Integration[]> => {
        const res = await fetchWithRetry(`${API_URL}/settings/integrations?organizationId=${organizationId}`, { headers: getHeaders() });
        if (!res.ok) return [];
        return res.json();
    },

    saveIntegration: async (integration: Partial<Integration>): Promise<Integration> => {
        const res = await fetchWithRetry(`${API_URL}/settings/integrations`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(integration)
        });
        return handleResponse(res, 'Failed to save integration');
    },

    deleteIntegration: async (id: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/settings/integrations/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete integration');
    },

    // ==========================================
    // WEBHOOKS
    // ==========================================
    
    getWebhooks: async (): Promise<Webhook[]> => {
        const res = await fetchWithRetry(`${API_URL}/integrations/webhooks`, { headers: getHeaders() });
        const data = await handleResponse<{ webhooks: Webhook[] }>(res, 'Failed to fetch webhooks');
        return data.webhooks || [];
    },

    createWebhook: async (webhook: Partial<Webhook>): Promise<Webhook> => {
        const res = await fetchWithRetry(`${API_URL}/integrations/webhooks`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(webhook)
        });
        return handleResponse(res, 'Failed to create webhook');
    },

    updateWebhook: async (id: string, updates: Partial<Webhook>): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/integrations/webhooks/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        await handleResponse(res, 'Failed to update webhook');
    },

    deleteWebhook: async (id: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/integrations/webhooks/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete webhook');
    },

    // ==========================================
    // API KEYS
    // ==========================================
    
    getUserApiKeys: async (): Promise<unknown[]> => {
        const res = await fetchWithRetry(`${API_URL}/user/api-keys`, { headers: getHeaders() });
        const data = await handleResponse<{ keys: unknown[] }>(res, 'Failed to fetch API keys');
        return data.keys || [];
    },

    createUserApiKey: async (name: string, scopes: string[] = []): Promise<unknown> => {
        const res = await fetchWithRetry(`${API_URL}/user/api-keys`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ name, scopes })
        });
        return handleResponse(res, 'Failed to create API key');
    },

    deleteUserApiKey: async (id: string): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/user/api-keys/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        await handleResponse(res, 'Failed to delete API key');
    },

    getApiKeyUsage: async (keyId: string): Promise<unknown> => {
        const res = await fetchWithRetry(`${API_URL}/user/api-keys/${keyId}/usage`, { headers: getHeaders() });
        const data = await handleResponse(res, 'Failed to fetch API key usage');
        return data || {};
    },

    rotateApiKey: async (keyId: string): Promise<unknown> => {
        const res = await fetchWithRetry(`${API_URL}/user/api-keys/${keyId}/rotate`, {
            method: 'PUT',
            headers: getHeaders()
        });
        return handleResponse(res, 'Failed to rotate API key');
    },

    updateApiKey: async (keyId: string, updates: unknown): Promise<void> => {
        const res = await fetchWithRetry(`${API_URL}/user/api-keys/${keyId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        await handleResponse(res, 'Failed to update API key');
    }
};


