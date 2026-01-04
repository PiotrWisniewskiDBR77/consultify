/**
 * TeamsUserIntegration
 * 
 * User-level Microsoft Teams integration service.
 * Handles OAuth flow and message sending for individual users.
 * 
 * Part of: User-Level Notifications & Integrations System
 */

import axios from 'axios';
import UserIntegrationService from '../userIntegrationService.js';

// Microsoft Graph API endpoints
const GRAPH_API = {
    ME: 'https://graph.microsoft.com/v1.0/me',
    SEND_CHAT: 'https://graph.microsoft.com/v1.0/me/chats',
    TEAMS: 'https://graph.microsoft.com/v1.0/me/joinedTeams',
    CHANNELS: 'https://graph.microsoft.com/v1.0/teams/{team-id}/channels'
};

const TeamsUserIntegration = {
    /**
     * Generate OAuth authorization URL
     */
    getOAuthUrl: (userId, redirectUri) => {
        const clientId = process.env.TEAMS_CLIENT_ID;
        const tenantId = process.env.TEAMS_TENANT_ID || 'common';

        if (!clientId) {
            throw new Error('TEAMS_CLIENT_ID not configured');
        }

        const state = Buffer.from(JSON.stringify({ 
            userId, 
            provider: 'teams',
            ts: Date.now() 
        })).toString('base64url');

        const scopes = [
            'User.Read',
            'Chat.ReadWrite',
            'ChannelMessage.Send',
            'Team.ReadBasic.All',
            'offline_access'
        ].join(' ');

        return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
            `client_id=${clientId}&` +
            `response_type=code&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `scope=${encodeURIComponent(scopes)}&` +
            `state=${state}`;
    },

    /**
     * Handle OAuth callback - exchange code for tokens
     */
    handleCallback: async (userId, code, redirectUri) => {
        const clientId = process.env.TEAMS_CLIENT_ID;
        const clientSecret = process.env.TEAMS_CLIENT_SECRET;
        const tenantId = process.env.TEAMS_TENANT_ID || 'common';

        if (!clientId || !clientSecret) {
            throw new Error('Teams OAuth credentials not configured');
        }

        try {
            // Exchange code for tokens
            const tokenResponse = await axios.post(
                `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
                new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    code,
                    redirect_uri: redirectUri,
                    grant_type: 'authorization_code'
                }),
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                }
            );

            const tokens = tokenResponse.data;

            // Get user info from Microsoft Graph
            const userResponse = await axios.get(GRAPH_API.ME, {
                headers: { 'Authorization': `Bearer ${tokens.access_token}` }
            });

            const user = userResponse.data;

            // Save connection
            await UserIntegrationService.saveConnection(userId, 'teams', {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_in: tokens.expires_in,
                external_user_id: user.id,
                external_workspace_name: user.displayName,
                config: {
                    email: user.mail || user.userPrincipalName,
                    tenant_id: tenantId
                }
            });

            return {
                success: true,
                user: user.displayName
            };
        } catch (error) {
            console.error('[TeamsUserIntegration] OAuth callback error:', error);
            throw new Error('Failed to connect Teams: ' + (error.message || 'Unknown error'));
        }
    },

    /**
     * Refresh access token
     */
    refreshToken: async (userId) => {
        const connection = await UserIntegrationService.getConnection(userId, 'teams');
        if (!connection || !connection.refreshToken) {
            throw new Error('No refresh token available');
        }

        const clientId = process.env.TEAMS_CLIENT_ID;
        const clientSecret = process.env.TEAMS_CLIENT_SECRET;
        const tenantId = process.env.TEAMS_TENANT_ID || 'common';

        try {
            const response = await axios.post(
                `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
                new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    refresh_token: connection.refreshToken,
                    grant_type: 'refresh_token'
                }),
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                }
            );

            // Update tokens
            await UserIntegrationService.saveConnection(userId, 'teams', {
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token,
                expires_in: response.data.expires_in,
                external_user_id: connection.externalUserId,
                external_workspace_name: connection.externalWorkspaceName,
                config: connection.config
            });

            return { success: true };
        } catch (error) {
            console.error('[TeamsUserIntegration] Refresh token error:', error);
            await UserIntegrationService.updateStatus(userId, 'teams', 'expired', error.message);
            throw error;
        }
    },

    /**
     * Send notification via Adaptive Card
     */
    sendNotification: async (userId, notification) => {
        const connection = await UserIntegrationService.getConnection(userId, 'teams');
        if (!connection || connection.status !== 'active') {
            throw new Error('Teams not connected');
        }

        // Build adaptive card
        const adaptiveCard = TeamsUserIntegration._buildAdaptiveCard(notification);

        try {
            // For now, we'll use webhook if configured, otherwise this is a placeholder
            // Full implementation would use Teams Bot or Graph API for proactive messaging
            
            if (connection.config?.webhook_url) {
                const response = await axios.post(connection.config.webhook_url, {
                    type: 'message',
                    attachments: [{
                        contentType: 'application/vnd.microsoft.card.adaptive',
                        content: adaptiveCard
                    }]
                });
                
                await UserIntegrationService.updateLastSync(userId, 'teams');
                
                return { success: true };
            }

            // Log that we couldn't send (no webhook configured)
            console.log('[TeamsUserIntegration] No webhook configured, notification not sent');
            return { success: false, reason: 'no_webhook' };
        } catch (error) {
            console.error('[TeamsUserIntegration] Send notification error:', error);
            throw error;
        }
    },

    /**
     * Build Adaptive Card for notification
     */
    _buildAdaptiveCard: (notification) => {
        const severityColor = {
            'CRITICAL': 'attention',
            'WARNING': 'warning',
            'INFO': 'accent'
        };

        return {
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "type": "AdaptiveCard",
            "version": "1.4",
            "body": [
                {
                    "type": "Container",
                    "items": [
                        {
                            "type": "TextBlock",
                            "text": notification.title,
                            "weight": "bolder",
                            "size": "large",
                            "color": severityColor[notification.severity] || 'default'
                        },
                        {
                            "type": "TextBlock",
                            "text": notification.type,
                            "isSubtle": true,
                            "size": "small"
                        },
                        {
                            "type": "TextBlock",
                            "text": notification.message,
                            "wrap": true
                        }
                    ]
                }
            ],
            "actions": notification.isActionable && notification.actionUrl ? [
                {
                    "type": "Action.OpenUrl",
                    "title": "View in Consultify",
                    "url": notification.actionUrl
                }
            ] : []
        };
    },

    /**
     * Test connection
     */
    testConnection: async (userId) => {
        const connection = await UserIntegrationService.getConnection(userId, 'teams');
        if (!connection) {
            return { success: false, error: 'Not connected' };
        }

        try {
            const response = await axios.get(GRAPH_API.ME, {
                headers: { 'Authorization': `Bearer ${connection.accessToken}` }
            });

            return {
                success: true,
                user: response.data.displayName,
                email: response.data.mail
            };
        } catch (error) {
            // Try to refresh token
            if (error.response?.status === 401) {
                try {
                    await TeamsUserIntegration.refreshToken(userId);
                    return TeamsUserIntegration.testConnection(userId);
                } catch {
                    return { success: false, error: 'Token expired', needsReauth: true };
                }
            }
            return { success: false, error: error.message };
        }
    },

    /**
     * Get joined teams
     */
    getTeams: async (userId) => {
        const connection = await UserIntegrationService.getConnection(userId, 'teams');
        if (!connection) {
            throw new Error('Teams not connected');
        }

        try {
            const response = await axios.get(GRAPH_API.TEAMS, {
                headers: { 'Authorization': `Bearer ${connection.accessToken}` }
            });

            return response.data.value.map(team => ({
                id: team.id,
                name: team.displayName,
                description: team.description
            }));
        } catch (error) {
            console.error('[TeamsUserIntegration] Get teams error:', error);
            throw error;
        }
    }
};

export default TeamsUserIntegration;









