declare const _default: UserIntegrationService;
export default _default;
declare class UserIntegrationService extends BaseService {
    PROVIDERS: {
        SLACK: string;
        TEAMS: string;
        JIRA: string;
        CLICKUP: string;
    };
    PROVIDER_CONFIGS: {
        slack: {
            name: string;
            authUrl: string;
            tokenUrl: string;
            userScopes: string;
            capabilities: string[];
        };
        teams: {
            name: string;
            authUrl: string;
            tokenUrl: string;
            scopes: string;
            capabilities: string[];
        };
        jira: {
            name: string;
            authUrl: string;
            tokenUrl: string;
            scopes: string;
            capabilities: string[];
        };
        clickup: {
            name: string;
            authUrl: string;
            tokenUrl: string;
            capabilities: string[];
        };
    };
    STATUS: {
        ACTIVE: string;
        EXPIRED: string;
        REVOKED: string;
        ERROR: string;
        PENDING: string;
    };
    /**
     * Encrypt sensitive data
     */
    encrypt(text: any): string | null;
    /**
     * Decrypt sensitive data
     */
    decrypt(encryptedText: any): string | null;
    /**
     * Get all integrations for a user
     */
    getUserIntegrations(userId: any): Promise<any>;
    /**
     * Get specific integration for user and provider
     */
    getConnection(userId: any, provider: any): Promise<{
        id: any;
        userId: any;
        provider: any;
        accessToken: string | null;
        refreshToken: string | null;
        tokenExpiresAt: any;
        externalUserId: any;
        externalWorkspaceId: any;
        externalWorkspaceName: any;
        config: any;
        status: any;
        lastSyncAt: any;
        lastError: any;
    } | null>;
    /**
     * Get connection status (without sensitive tokens)
     */
    getConnectionStatus(userId: any, provider: any): Promise<{
        id: any;
        provider: any;
        providerName: any;
        status: any;
        externalWorkspaceName: any;
        lastSyncAt: any;
        lastError: any;
        isConnected: boolean;
    } | null>;
    /**
     * Save a new integration connection
     */
    saveConnection(userId: any, provider: any, connectionData: any): Promise<{
        id: string;
        provider: any;
        status: string;
        externalWorkspaceName: any;
    }>;
    /**
     * Disconnect a provider
     */
    disconnectProvider(userId: any, provider: any): Promise<{
        disconnected: boolean;
    }>;
    /**
     * Update integration status
     */
    updateStatus(userId: any, provider: any, status: any, errorMessage?: null): Promise<{
        updated: boolean;
    }>;
    /**
     * Update last sync timestamp
     */
    updateLastSync(userId: any, provider: any): Promise<{
        updated: boolean;
    }>;
    /**
     * Generate OAuth authorization URL for a provider
     */
    getOAuthUrl(userId: any, provider: any, redirectUri: any): Promise<string>;
    /**
     * Parse OAuth state parameter
     */
    parseOAuthState(state: any): any;
    /**
     * Refresh an expired token
     */
    refreshToken(userId: any, provider: any): Promise<{
        refreshed: boolean;
    }>;
    /**
     * Send notification through user's integration
     */
    sendNotification(userId: any, provider: any, notification: any): Promise<{
        sent: boolean;
        reason: string;
        provider?: undefined;
    } | {
        sent: boolean;
        provider: any;
        reason?: undefined;
    }>;
    /**
     * Test integration connection
     */
    testConnection(userId: any, provider: any): Promise<{
        success: boolean;
        error: string;
        needsReauth?: undefined;
        provider?: undefined;
        workspace?: undefined;
    } | {
        success: boolean;
        error: string;
        needsReauth: boolean;
        provider?: undefined;
        workspace?: undefined;
    } | {
        success: boolean;
        provider: any;
        workspace: any;
        error?: undefined;
        needsReauth?: undefined;
    }>;
    /**
     * Log a sync operation
     */
    logSync(userId: any, integrationId: any, logData: any): Promise<{
        id: string;
    }>;
    /**
     * Get sync logs for an integration
     */
    getSyncLogs(userId: any, integrationId: any, limit?: number): Promise<any>;
    /**
     * Get all available providers
     */
    getAvailableProviders(): {
        id: string;
        name: string;
        capabilities: string[];
    }[];
    /**
     * Check if user has active integration for provider
     */
    isConnected(userId: any, provider: any): Promise<boolean>;
    /**
     * Get all active integrations for a user (just the providers)
     */
    getActiveProviders(userId: any): Promise<any>;
}
import BaseService from './BaseService.js';
//# sourceMappingURL=userIntegrationService.d.ts.map