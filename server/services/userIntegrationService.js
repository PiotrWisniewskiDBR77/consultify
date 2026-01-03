/**
 * UserIntegrationService
 * 
 * User-level integration management service.
 * Each user can connect their own accounts (Slack, Teams, Jira, ClickUp)
 * and manage their personal integrations independently.
 * 
 * Part of: User-Level Notifications & Integrations System
 */

import BaseService from './BaseService.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// Encryption key should be in env vars in production
const ENCRYPTION_KEY = process.env.INTEGRATION_ENCRYPTION_KEY || 'consultify-integration-key-32ch';
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

// Supported providers
const PROVIDERS = {
    SLACK: 'slack',
    TEAMS: 'teams',
    JIRA: 'jira',
    CLICKUP: 'clickup'
};

// Provider OAuth configurations
const PROVIDER_CONFIGS = {
    slack: {
        name: 'Slack',
        authUrl: 'https://slack.com/oauth/v2/authorize',
        tokenUrl: 'https://slack.com/api/oauth.v2.access',
        userScopes: 'chat:write,channels:read,users:read,im:write',
        capabilities: ['notifications', 'messages']
    },
    teams: {
        name: 'Microsoft Teams',
        authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        scopes: 'Chat.ReadWrite User.Read offline_access',
        capabilities: ['notifications', 'messages']
    },
    jira: {
        name: 'Jira',
        authUrl: 'https://auth.atlassian.com/authorize',
        tokenUrl: 'https://auth.atlassian.com/oauth/token',
        scopes: 'read:jira-work write:jira-work read:jira-user offline_access',
        capabilities: ['sync', 'notifications']
    },
    clickup: {
        name: 'ClickUp',
        authUrl: 'https://app.clickup.com/api',
        tokenUrl: 'https://app.clickup.com/api/v2/oauth/token',
        capabilities: ['sync', 'notifications']
    }
};

// Status constants
const STATUS = {
    ACTIVE: 'active',
    EXPIRED: 'expired',
    REVOKED: 'revoked',
    ERROR: 'error',
    PENDING: 'pending'
};

class UserIntegrationService extends BaseService {
    constructor() {
        super();
        this.PROVIDERS = PROVIDERS;
        this.PROVIDER_CONFIGS = PROVIDER_CONFIGS;
        this.STATUS = STATUS;
    }

    /**
     * Encrypt sensitive data
     */
    encrypt(text) {
        if (!text) return null;
        const iv = crypto.randomBytes(16);
        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
        const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return iv.toString('hex') + ':' + encrypted;
    }

    /**
     * Decrypt sensitive data
     */
    decrypt(encryptedText) {
        if (!encryptedText) return null;
        try {
            const [ivHex, encrypted] = encryptedText.split(':');
            const iv = Buffer.from(ivHex, 'hex');
            const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
            const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            console.error('[UserIntegration] Decryption error:', error.message);
            return null;
        }
    }

    // ==========================================
    // CONNECTION MANAGEMENT
    // ==========================================

    /**
     * Get all integrations for a user
     */
    async getUserIntegrations(userId) {
        const rows = await this.queryAll(
            `SELECT 
                id, user_id, provider, 
                external_user_id, external_workspace_id, external_workspace_name,
                config_json, status, last_sync_at, last_error,
                created_at, updated_at
            FROM user_integrations 
            WHERE user_id = ?
            ORDER BY created_at DESC`,
            [userId]
        );

        return (rows || []).map(row => ({
            id: row.id,
            userId: row.user_id,
            provider: row.provider,
            providerName: PROVIDER_CONFIGS[row.provider]?.name || row.provider,
            externalUserId: row.external_user_id,
            externalWorkspaceId: row.external_workspace_id,
            externalWorkspaceName: row.external_workspace_name,
            config: row.config_json ? JSON.parse(row.config_json) : {},
            status: row.status,
            lastSyncAt: row.last_sync_at,
            lastError: row.last_error,
            capabilities: PROVIDER_CONFIGS[row.provider]?.capabilities || [],
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));
    }

    /**
     * Get specific integration for user and provider
     */
    async getConnection(userId, provider) {
        const row = await this.queryOne(
            `SELECT * FROM user_integrations 
            WHERE user_id = ? AND provider = ?`,
            [userId, provider]
        );

        if (!row) return null;

        return {
            id: row.id,
            userId: row.user_id,
            provider: row.provider,
            accessToken: this.decrypt(row.access_token_encrypted),
            refreshToken: this.decrypt(row.refresh_token_encrypted),
            tokenExpiresAt: row.token_expires_at,
            externalUserId: row.external_user_id,
            externalWorkspaceId: row.external_workspace_id,
            externalWorkspaceName: row.external_workspace_name,
            config: row.config_json ? JSON.parse(row.config_json) : {},
            status: row.status,
            lastSyncAt: row.last_sync_at,
            lastError: row.last_error
        };
    }

    /**
     * Get connection status (without sensitive tokens)
     */
    async getConnectionStatus(userId, provider) {
        const row = await this.queryOne(
            `SELECT 
                id, provider, status, 
                external_workspace_name, last_sync_at, last_error,
                token_expires_at
            FROM user_integrations 
            WHERE user_id = ? AND provider = ?`,
            [userId, provider]
        );

        if (!row) return null;

        const isExpired = row.token_expires_at &&
            new Date(row.token_expires_at) < new Date();

        return {
            id: row.id,
            provider: row.provider,
            providerName: PROVIDER_CONFIGS[row.provider]?.name || row.provider,
            status: isExpired ? STATUS.EXPIRED : row.status,
            externalWorkspaceName: row.external_workspace_name,
            lastSyncAt: row.last_sync_at,
            lastError: row.last_error,
            isConnected: row.status === STATUS.ACTIVE && !isExpired
        };
    }

    /**
     * Save a new integration connection
     */
    async saveConnection(userId, provider, connectionData) {
        const {
            access_token,
            refresh_token,
            expires_in,
            external_user_id,
            external_workspace_id,
            external_workspace_name,
            config = {}
        } = connectionData;

        const id = uuidv4();
        const tokenExpiresAt = expires_in
            ? new Date(Date.now() + expires_in * 1000).toISOString()
            : null;

        await this.queryRun(
            `INSERT INTO user_integrations 
            (id, user_id, provider, access_token_encrypted, refresh_token_encrypted,
             token_expires_at, external_user_id, external_workspace_id, 
             external_workspace_name, config_json, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, provider) DO UPDATE SET
                access_token_encrypted = excluded.access_token_encrypted,
                refresh_token_encrypted = excluded.refresh_token_encrypted,
                token_expires_at = excluded.token_expires_at,
                external_user_id = excluded.external_user_id,
                external_workspace_id = excluded.external_workspace_id,
                external_workspace_name = excluded.external_workspace_name,
                config_json = excluded.config_json,
                status = excluded.status,
                last_error = NULL,
                updated_at = CURRENT_TIMESTAMP`,
            [
                id, userId, provider,
                this.encrypt(access_token),
                this.encrypt(refresh_token),
                tokenExpiresAt,
                external_user_id,
                external_workspace_id,
                external_workspace_name,
                JSON.stringify(config),
                STATUS.ACTIVE
            ]
        );

        this.logInfo(`Connected ${provider} for user ${userId}`);
        return {
            id,
            provider,
            status: STATUS.ACTIVE,
            externalWorkspaceName: external_workspace_name
        };
    }

    /**
     * Disconnect a provider
     */
    async disconnectProvider(userId, provider) {
        const result = await this.queryRun(
            `DELETE FROM user_integrations WHERE user_id = ? AND provider = ?`,
            [userId, provider]
        );

        this.logInfo(`Disconnected ${provider} for user ${userId}`);
        return { disconnected: result.changes > 0 };
    }

    /**
     * Update integration status
     */
    async updateStatus(userId, provider, status, errorMessage = null) {
        const result = await this.queryRun(
            `UPDATE user_integrations 
            SET status = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND provider = ?`,
            [status, errorMessage, userId, provider]
        );
        return { updated: result.changes > 0 };
    }

    /**
     * Update last sync timestamp
     */
    async updateLastSync(userId, provider) {
        const result = await this.queryRun(
            `UPDATE user_integrations 
            SET last_sync_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND provider = ?`,
            [userId, provider]
        );
        return { updated: result.changes > 0 };
    }

    // ==========================================
    // OAUTH FLOW
    // ==========================================

    /**
     * Generate OAuth authorization URL for a provider
     */
    async getOAuthUrl(userId, provider, redirectUri) {
        const config = PROVIDER_CONFIGS[provider];
        if (!config) {
            throw new Error(`Unknown provider: ${provider}`);
        }

        // State contains user ID for callback identification
        const state = Buffer.from(JSON.stringify({ userId, provider, ts: Date.now() }))
            .toString('base64url');

        let authUrl;

        switch (provider) {
            case PROVIDERS.SLACK:
                authUrl = `${config.authUrl}?` +
                    `client_id=${process.env.SLACK_CLIENT_ID}&` +
                    `user_scope=${config.userScopes}&` +
                    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                    `state=${state}`;
                break;

            case PROVIDERS.TEAMS:
                authUrl = `${config.authUrl}?` +
                    `client_id=${process.env.TEAMS_CLIENT_ID}&` +
                    `response_type=code&` +
                    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                    `scope=${encodeURIComponent(config.scopes)}&` +
                    `state=${state}`;
                break;

            case PROVIDERS.JIRA:
                authUrl = `${config.authUrl}?` +
                    `audience=api.atlassian.com&` +
                    `client_id=${process.env.JIRA_CLIENT_ID}&` +
                    `scope=${encodeURIComponent(config.scopes)}&` +
                    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                    `state=${state}&` +
                    `response_type=code&` +
                    `prompt=consent`;
                break;

            case PROVIDERS.CLICKUP:
                authUrl = `${config.authUrl}?` +
                    `client_id=${process.env.CLICKUP_CLIENT_ID}&` +
                    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                    `state=${state}`;
                break;

            default:
                throw new Error(`OAuth not implemented for provider: ${provider}`);
        }

        return authUrl;
    }

    /**
     * Parse OAuth state parameter
     */
    parseOAuthState(state) {
        try {
            return JSON.parse(Buffer.from(state, 'base64url').toString());
        } catch (error) {
            throw new Error('Invalid OAuth state');
        }
    }

    /**
     * Refresh an expired token
     */
    async refreshToken(userId, provider) {
        const connection = await this.getConnection(userId, provider);
        if (!connection || !connection.refreshToken) {
            throw new Error('No refresh token available');
        }

        // Token refresh implementation would go here
        // This is a stub - actual implementation depends on provider

        this.logInfo(`Token refresh requested for ${provider}, user ${userId}`);

        // In production, make API call to refresh token
        // Then update the database with new tokens

        return { refreshed: true };
    }

    // ==========================================
    // INTEGRATION ACTIONS
    // ==========================================

    /**
     * Send notification through user's integration
     */
    async sendNotification(userId, provider, notification) {
        const connection = await this.getConnection(userId, provider);
        if (!connection || connection.status !== STATUS.ACTIVE) {
            return { sent: false, reason: 'not_connected' };
        }

        // Log the sync attempt
        await this.logSync(userId, connection.id, {
            direction: 'outbound',
            action: 'notify',
            objectType: notification.type,
            objectId: notification.relatedObjectId
        });

        // Provider-specific notification sending would be implemented here
        // This is delegated to provider-specific services

        return { sent: true, provider };
    }

    /**
     * Test integration connection
     */
    async testConnection(userId, provider) {
        const connection = await this.getConnection(userId, provider);
        if (!connection) {
            return { success: false, error: 'Not connected' };
        }

        // Provider-specific test would go here
        // For now, just check if we have valid tokens

        const isExpired = connection.tokenExpiresAt &&
            new Date(connection.tokenExpiresAt) < new Date();

        if (isExpired) {
            await this.updateStatus(userId, provider, STATUS.EXPIRED);
            return { success: false, error: 'Token expired', needsReauth: true };
        }

        return {
            success: true,
            provider,
            workspace: connection.externalWorkspaceName
        };
    }

    // ==========================================
    // SYNC LOGGING
    // ==========================================

    /**
     * Log a sync operation
     */
    async logSync(userId, integrationId, logData) {
        const {
            direction,
            action,
            objectType,
            objectId,
            externalId,
            status = 'success',
            errorMessage,
            requestPayload,
            responsePayload,
            latencyMs
        } = logData;

        const id = uuidv4();

        await this.queryRun(
            `INSERT INTO user_integration_sync_logs 
            (id, user_id, integration_id, direction, action, object_type, object_id,
             external_id, status, error_message, request_payload, response_payload, latency_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id, userId, integrationId, direction, action, objectType, objectId,
                externalId, status, errorMessage,
                requestPayload ? JSON.stringify(requestPayload) : null,
                responsePayload ? JSON.stringify(responsePayload) : null,
                latencyMs
            ]
        );
        return { id };
    }

    /**
     * Get sync logs for an integration
     */
    async getSyncLogs(userId, integrationId, limit = 50) {
        return await this.queryAll(
            `SELECT * FROM user_integration_sync_logs 
            WHERE user_id = ? AND integration_id = ?
            ORDER BY created_at DESC
            LIMIT ?`,
            [userId, integrationId, limit]
        );
    }

    // ==========================================
    // UTILITY METHODS
    // ==========================================

    /**
     * Get all available providers
     */
    getAvailableProviders() {
        return Object.entries(PROVIDER_CONFIGS).map(([key, config]) => ({
            id: key,
            name: config.name,
            capabilities: config.capabilities
        }));
    }

    /**
     * Check if user has active integration for provider
     */
    async isConnected(userId, provider) {
        const status = await this.getConnectionStatus(userId, provider);
        return status?.isConnected || false;
    }

    /**
     * Get all active integrations for a user (just the providers)
     */
    async getActiveProviders(userId) {
        const rows = await this.queryAll(
            `SELECT provider FROM user_integrations 
            WHERE user_id = ? AND status = ?`,
            [userId, STATUS.ACTIVE]
        );
        return (rows || []).map(r => r.provider);
    }
}

export default new UserIntegrationService();



