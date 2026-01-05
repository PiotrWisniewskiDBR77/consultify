/**
 * User Integrations Routes
 * 
 * API endpoints for user-level integration management.
 * Each user can connect/disconnect their own accounts (Slack, Teams, Jira, ClickUp).
 * 
 * Base path: /api/settings/integrations
 * 
 * Part of: User-Level Notifications & Integrations System
 */

import express from 'express';
import axios from 'axios';
const router = express.Router();
import authMiddleware from '../middleware/authMiddleware.js';
import UserIntegrationService from '../services/userIntegrationService.js';
import { getDatabase } from '../src/database/index.js';
const db = getDatabase();

// All routes require authentication
router.use(authMiddleware);

// Base URL for OAuth callbacks
const getBaseUrl = (req) => {
    return process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
};

// ==========================================
// LIST & STATUS
// ==========================================

/**
 * GET /api/settings/integrations
 * List all integrations for current user
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const integrations = await UserIntegrationService.getUserIntegrations(userId);

        // Get list of available providers
        const availableProviders = UserIntegrationService.getAvailableProviders();

        // Mark which are connected
        const providers = availableProviders.map(provider => {
            const connection = integrations.find(i => i.provider === provider.id);
            return {
                ...provider,
                isConnected: connection?.status === 'active',
                connection: connection || null
            };
        });

        res.json({
            integrations,
            providers,
            connectedCount: integrations.filter(i => i.status === 'active').length
        });
    } catch (error) {
        console.error('[UserIntegrations] List error:', error);
        res.status(500).json({ error: 'Failed to list integrations' });
    }
});

/**
 * GET /api/settings/integrations/providers
 * Get all available providers
 */
router.get('/providers', async (req, res) => {
    try {
        const providers = UserIntegrationService.getAvailableProviders();
        res.json({ providers });
    } catch (error) {
        console.error('[UserIntegrations] Providers error:', error);
        res.status(500).json({ error: 'Failed to get providers' });
    }
});

/**
 * GET /api/settings/integrations/:provider/status
 * Get connection status for specific provider
 */
router.get('/:provider/status', async (req, res) => {
    try {
        const userId = req.user.id;
        const { provider } = req.params;

        const status = await UserIntegrationService.getConnectionStatus(userId, provider);

        res.json({
            provider,
            status: status || { isConnected: false }
        });
    } catch (error) {
        console.error('[UserIntegrations] Status error:', error);
        res.status(500).json({ error: 'Failed to get status' });
    }
});

// ==========================================
// OAUTH FLOW
// ==========================================

/**
 * POST /api/settings/integrations/:provider/connect
 * Initiate OAuth flow for a provider
 */
router.post('/:provider/connect', async (req, res) => {
    try {
        const userId = req.user.id;
        const { provider } = req.params;

        // Validate provider
        const providers = UserIntegrationService.getAvailableProviders();
        if (!providers.find(p => p.id === provider)) {
            return res.status(400).json({ error: `Unknown provider: ${provider}` });
        }

        // Generate OAuth URL
        const redirectUri = `${getBaseUrl(req)}/api/settings/integrations/${provider}/callback`;
        const authUrl = await UserIntegrationService.getOAuthUrl(userId, provider, redirectUri);

        res.json({ authUrl });
    } catch (error) {
        console.error('[UserIntegrations] Connect error:', error);
        res.status(500).json({ error: 'Failed to initiate OAuth' });
    }
});

/**
 * GET /api/settings/integrations/:provider/callback
 * OAuth callback handler
 */
router.get('/:provider/callback', async (req, res) => {
    try {
        const { provider } = req.params;
        const { code, state, error: oauthError } = req.query;

        if (oauthError) {
            console.error(`[UserIntegrations] OAuth error for ${provider}:`, oauthError);
            return res.redirect(`/settings/integrations?error=${encodeURIComponent(oauthError)}&provider=${provider}`);
        }

        if (!code || !state) {
            return res.redirect('/settings/integrations?error=missing_params');
        }

        // Parse state to get user ID
        const stateData = UserIntegrationService.parseOAuthState(state);
        const userId = stateData.userId;

        // Exchange code for tokens (provider-specific)
        // This would call the appropriate provider service
        await handleOAuthCallback(provider, userId, code, req);

        res.redirect(`/settings/integrations?connected=${provider}`);
    } catch (error) {
        console.error('[UserIntegrations] Callback error:', error);
        res.redirect(`/settings/integrations?error=${encodeURIComponent(error.message)}`);
    }
});

/**
 * Handle OAuth callback for each provider
 */
async function handleOAuthCallback(provider, userId, code, req) {
    const redirectUri = `${getBaseUrl(req)}/api/settings/integrations/${provider}/callback`;

    switch (provider) {
        case 'slack':
            return handleSlackCallback(userId, code, redirectUri);
        case 'teams':
            return handleTeamsCallback(userId, code, redirectUri);
        case 'jira':
            return handleJiraCallback(userId, code, redirectUri);
        case 'clickup':
            return handleClickUpCallback(userId, code, redirectUri);
        default:
            throw new Error(`OAuth handler not implemented for ${provider}`);
    }
}

/**
 * Slack OAuth callback handler
 */
async function handleSlackCallback(userId, code, redirectUri) {

    try {
        const response = await axios.post('https://slack.com/api/oauth.v2.access', null, {
            params: {
                client_id: process.env.SLACK_CLIENT_ID,
                client_secret: process.env.SLACK_CLIENT_SECRET,
                code,
                redirect_uri: redirectUri
            }
        });

        if (!response.data.ok) {
            throw new Error(response.data.error || 'Slack OAuth failed');
        }

        await UserIntegrationService.saveConnection(userId, 'slack', {
            access_token: response.data.authed_user?.access_token,
            refresh_token: response.data.authed_user?.refresh_token,
            external_user_id: response.data.authed_user?.id,
            external_workspace_id: response.data.team?.id,
            external_workspace_name: response.data.team?.name,
            config: {
                bot_token: response.data.access_token,
                scope: response.data.authed_user?.scope
            }
        });
    } catch (error) {
        console.error('[UserIntegrations] Slack OAuth error:', error);
        throw new Error('Failed to connect Slack');
    }
}

/**
 * Teams OAuth callback handler
 */
async function handleTeamsCallback(userId, code, redirectUri) {

    try {
        const response = await axios.post(
            'https://login.microsoftonline.com/common/oauth2/v2.0/token',
            new URLSearchParams({
                client_id: process.env.TEAMS_CLIENT_ID,
                client_secret: process.env.TEAMS_CLIENT_SECRET,
                code,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code'
            }),
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }
        );

        // Get user info from Microsoft Graph
        const userResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${response.data.access_token}` }
        });

        await UserIntegrationService.saveConnection(userId, 'teams', {
            access_token: response.data.access_token,
            refresh_token: response.data.refresh_token,
            expires_in: response.data.expires_in,
            external_user_id: userResponse.data.id,
            external_workspace_name: userResponse.data.displayName,
            config: {
                email: userResponse.data.mail || userResponse.data.userPrincipalName
            }
        });
    } catch (error) {
        console.error('[UserIntegrations] Teams OAuth error:', error);
        throw new Error('Failed to connect Teams');
    }
}

/**
 * Jira OAuth callback handler
 */
async function handleJiraCallback(userId, code, redirectUri) {

    try {
        const response = await axios.post('https://auth.atlassian.com/oauth/token', {
            grant_type: 'authorization_code',
            client_id: process.env.JIRA_CLIENT_ID,
            client_secret: process.env.JIRA_CLIENT_SECRET,
            code,
            redirect_uri: redirectUri
        });

        // Get accessible resources (Jira sites)
        const resourcesResponse = await axios.get(
            'https://api.atlassian.com/oauth/token/accessible-resources',
            {
                headers: { Authorization: `Bearer ${response.data.access_token}` }
            }
        );

        const site = resourcesResponse.data[0]; // Use first site

        await UserIntegrationService.saveConnection(userId, 'jira', {
            access_token: response.data.access_token,
            refresh_token: response.data.refresh_token,
            expires_in: response.data.expires_in,
            external_workspace_id: site?.id,
            external_workspace_name: site?.name,
            config: {
                cloud_id: site?.id,
                site_url: site?.url
            }
        });
    } catch (error) {
        console.error('[UserIntegrations] Jira OAuth error:', error);
        throw new Error('Failed to connect Jira');
    }
}

/**
 * ClickUp OAuth callback handler
 */
async function handleClickUpCallback(userId, code, redirectUri) {

    try {
        const response = await axios.post('https://app.clickup.com/api/v2/oauth/token', null, {
            params: {
                client_id: process.env.CLICKUP_CLIENT_ID,
                client_secret: process.env.CLICKUP_CLIENT_SECRET,
                code
            }
        });

        // Get user info
        const userResponse = await axios.get('https://api.clickup.com/api/v2/user', {
            headers: { Authorization: response.data.access_token }
        });

        await UserIntegrationService.saveConnection(userId, 'clickup', {
            access_token: response.data.access_token,
            external_user_id: userResponse.data.user?.id?.toString(),
            external_workspace_name: userResponse.data.user?.username,
            config: {
                email: userResponse.data.user?.email
            }
        });
    } catch (error) {
        console.error('[UserIntegrations] ClickUp OAuth error:', error);
        throw new Error('Failed to connect ClickUp');
    }
}

// ==========================================
// DISCONNECT & MANAGE
// ==========================================

/**
 * DELETE /api/settings/integrations/:provider
 * Disconnect a provider
 */
router.delete('/:provider', async (req, res) => {
    try {
        const userId = req.user.id;
        const { provider } = req.params;

        const result = await UserIntegrationService.disconnectProvider(userId, provider);

        res.json({
            success: true,
            disconnected: result.disconnected,
            provider
        });
    } catch (error) {
        console.error('[UserIntegrations] Disconnect error:', error);
        res.status(500).json({ error: 'Failed to disconnect' });
    }
});

/**
 * POST /api/settings/integrations/:provider/test
 * Test integration connection
 */
router.post('/:provider/test', async (req, res) => {
    try {
        const userId = req.user.id;
        const { provider } = req.params;

        const result = await UserIntegrationService.testConnection(userId, provider);

        res.json(result);
    } catch (error) {
        console.error('[UserIntegrations] Test error:', error);
        res.status(500).json({ error: 'Failed to test connection' });
    }
});

/**
 * POST /api/settings/integrations/:provider/refresh
 * Refresh OAuth token
 */
router.post('/:provider/refresh', async (req, res) => {
    try {
        const userId = req.user.id;
        const { provider } = req.params;

        const result = await UserIntegrationService.refreshToken(userId, provider);

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[UserIntegrations] Refresh error:', error);
        res.status(500).json({ error: 'Failed to refresh token' });
    }
});

/**
 * PUT /api/settings/integrations/:provider/config
 * Update integration configuration
 */
router.put('/:provider/config', async (req, res) => {
    try {
        const userId = req.user.id;
        const { provider } = req.params;
        const { config } = req.body;

        // Get current connection
        const connection = await UserIntegrationService.getConnection(userId, provider);
        if (!connection) {
            return res.status(404).json({ error: 'Integration not found' });
        }

        // Update config (re-save with merged config)
        const mergedConfig = { ...connection.config, ...config };

        // Update in database
        await new Promise((resolve, reject) => {
            
            db.run(
                `UPDATE user_integrations 
                SET config_json = ?, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ? AND provider = ?`,
                [JSON.stringify(mergedConfig), userId, provider],
                function (err) {
                    if (err) return reject(err);
                    resolve({ updated: this.changes > 0 });
                }
            );
        });

        res.json({ success: true, config: mergedConfig });
    } catch (error) {
        console.error('[UserIntegrations] Config update error:', error);
        res.status(500).json({ error: 'Failed to update config' });
    }
});

// ==========================================
// SYNC LOGS
// ==========================================

/**
 * GET /api/settings/integrations/:provider/logs
 * Get sync logs for an integration
 */
router.get('/:provider/logs', async (req, res) => {
    try {
        const userId = req.user.id;
        const { provider } = req.params;
        const { limit = 50 } = req.query;

        // Get integration ID
        const connection = await UserIntegrationService.getConnection(userId, provider);
        if (!connection) {
            return res.status(404).json({ error: 'Integration not found' });
        }

        const logs = await UserIntegrationService.getSyncLogs(userId, connection.id, parseInt(limit));

        res.json({ logs });
    } catch (error) {
        console.error('[UserIntegrations] Logs error:', error);
        res.status(500).json({ error: 'Failed to get logs' });
    }
});

export default router;















