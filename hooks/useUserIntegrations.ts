/**
 * useUserIntegrations Hook
 * 
 * React hook for managing user-level integrations (Slack, Teams, Jira, ClickUp).
 * Each user can connect/disconnect their own accounts independently.
 * 
 * Part of: User-Level Notifications & Integrations System
 */

import { useState, useEffect, useCallback } from 'react';

// Provider configuration
export interface Provider {
    id: string;
    name: string;
    capabilities: string[];
    isConnected: boolean;
    connection: UserIntegration | null;
}

// User integration connection
export interface UserIntegration {
    id: string;
    userId: string;
    provider: string;
    providerName: string;
    externalUserId?: string;
    externalWorkspaceId?: string;
    externalWorkspaceName?: string;
    config: Record<string, any>;
    status: 'active' | 'expired' | 'revoked' | 'error' | 'pending';
    lastSyncAt?: string;
    lastError?: string;
    capabilities: string[];
    createdAt: string;
    updatedAt: string;
}

// Connection status
export interface ConnectionStatus {
    provider: string;
    providerName: string;
    status: string;
    externalWorkspaceName?: string;
    lastSyncAt?: string;
    lastError?: string;
    isConnected: boolean;
}

// Sync log entry
export interface SyncLog {
    id: string;
    direction: 'inbound' | 'outbound';
    action: string;
    objectType?: string;
    objectId?: string;
    externalId?: string;
    status: string;
    errorMessage?: string;
    createdAt: string;
}

interface UseUserIntegrationsReturn {
    // Data
    integrations: UserIntegration[];
    providers: Provider[];
    connectedCount: number;
    loading: boolean;
    error: string | null;
    
    // Actions
    connect: (provider: string) => Promise<void>;
    disconnect: (provider: string) => Promise<boolean>;
    testConnection: (provider: string) => Promise<{ success: boolean; error?: string }>;
    refreshToken: (provider: string) => Promise<boolean>;
    updateConfig: (provider: string, config: Record<string, any>) => Promise<boolean>;
    
    // Status
    getConnectionStatus: (provider: string) => Promise<ConnectionStatus | null>;
    getSyncLogs: (provider: string, limit?: number) => Promise<SyncLog[]>;
    
    // Utilities
    refresh: () => Promise<void>;
    isConnected: (provider: string) => boolean;
    getIntegration: (provider: string) => UserIntegration | undefined;
}

export const useUserIntegrations = (): UseUserIntegrationsReturn => {
    const [integrations, setIntegrations] = useState<UserIntegration[]>([]);
    const [providers, setProviders] = useState<Provider[]>([]);
    const [connectedCount, setConnectedCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch integrations on mount
    const fetchIntegrations = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await fetch('/api/settings/integrations', {
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch integrations');
            }
            
            const data = await response.json();
            
            setIntegrations(data.integrations || []);
            setProviders(data.providers || []);
            setConnectedCount(data.connectedCount || 0);
        } catch (err) {
            console.error('[useUserIntegrations] Fetch error:', err);
            setError(err instanceof Error ? err.message : 'Failed to load integrations');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchIntegrations();
    }, [fetchIntegrations]);

    // Initiate OAuth connection
    const connect = useCallback(async (provider: string) => {
        try {
            setError(null);
            
            const response = await fetch(`/api/settings/integrations/${provider}/connect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to initiate connection');
            }
            
            const data = await response.json();
            
            if (data.authUrl) {
                // Redirect to OAuth provider
                window.location.href = data.authUrl;
            }
        } catch (err) {
            console.error('[useUserIntegrations] Connect error:', err);
            setError(err instanceof Error ? err.message : 'Failed to connect');
            throw err;
        }
    }, []);

    // Disconnect provider
    const disconnect = useCallback(async (provider: string): Promise<boolean> => {
        try {
            setError(null);
            
            const response = await fetch(`/api/settings/integrations/${provider}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to disconnect');
            }
            
            // Refresh the list
            await fetchIntegrations();
            
            return true;
        } catch (err) {
            console.error('[useUserIntegrations] Disconnect error:', err);
            setError(err instanceof Error ? err.message : 'Failed to disconnect');
            return false;
        }
    }, [fetchIntegrations]);

    // Test connection
    const testConnection = useCallback(async (provider: string): Promise<{ success: boolean; error?: string }> => {
        try {
            const response = await fetch(`/api/settings/integrations/${provider}/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to test connection');
            }
            
            return await response.json();
        } catch (err) {
            console.error('[useUserIntegrations] Test error:', err);
            return { 
                success: false, 
                error: err instanceof Error ? err.message : 'Test failed' 
            };
        }
    }, []);

    // Refresh token
    const refreshToken = useCallback(async (provider: string): Promise<boolean> => {
        try {
            const response = await fetch(`/api/settings/integrations/${provider}/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Failed to refresh token');
            }
            
            await fetchIntegrations();
            return true;
        } catch (err) {
            console.error('[useUserIntegrations] Refresh error:', err);
            return false;
        }
    }, [fetchIntegrations]);

    // Update integration config
    const updateConfig = useCallback(async (provider: string, config: Record<string, any>): Promise<boolean> => {
        try {
            const response = await fetch(`/api/settings/integrations/${provider}/config`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ config })
            });
            
            if (!response.ok) {
                throw new Error('Failed to update config');
            }
            
            await fetchIntegrations();
            return true;
        } catch (err) {
            console.error('[useUserIntegrations] Config update error:', err);
            return false;
        }
    }, [fetchIntegrations]);

    // Get connection status
    const getConnectionStatus = useCallback(async (provider: string): Promise<ConnectionStatus | null> => {
        try {
            const response = await fetch(`/api/settings/integrations/${provider}/status`, {
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                return null;
            }
            
            const data = await response.json();
            return data.status;
        } catch (err) {
            console.error('[useUserIntegrations] Status error:', err);
            return null;
        }
    }, []);

    // Get sync logs
    const getSyncLogs = useCallback(async (provider: string, limit: number = 50): Promise<SyncLog[]> => {
        try {
            const response = await fetch(`/api/settings/integrations/${provider}/logs?limit=${limit}`, {
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                return [];
            }
            
            const data = await response.json();
            return data.logs || [];
        } catch (err) {
            console.error('[useUserIntegrations] Logs error:', err);
            return [];
        }
    }, []);

    // Check if provider is connected
    const isConnected = useCallback((provider: string): boolean => {
        const integration = integrations.find(i => i.provider === provider);
        return integration?.status === 'active';
    }, [integrations]);

    // Get specific integration
    const getIntegration = useCallback((provider: string): UserIntegration | undefined => {
        return integrations.find(i => i.provider === provider);
    }, [integrations]);

    return {
        // Data
        integrations,
        providers,
        connectedCount,
        loading,
        error,
        
        // Actions
        connect,
        disconnect,
        testConnection,
        refreshToken,
        updateConfig,
        
        // Status
        getConnectionStatus,
        getSyncLogs,
        
        // Utilities
        refresh: fetchIntegrations,
        isConnected,
        getIntegration
    };
};

export default useUserIntegrations;

