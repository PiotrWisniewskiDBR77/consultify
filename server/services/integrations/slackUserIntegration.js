/**
 * SlackUserIntegration
 * 
 * User-level Slack integration service.
 * Handles OAuth flow and message sending for individual users.
 * 
 * Part of: User-Level Notifications & Integrations System
 */

import axios from 'axios';
import UserIntegrationService from '../userIntegrationService.js';

// Slack API endpoints
const SLACK_API = {
    OAUTH_ACCESS: 'https://slack.com/api/oauth.v2.access',
    CHAT_POST_MESSAGE: 'https://slack.com/api/chat.postMessage',
    USERS_INFO: 'https://slack.com/api/users.info',
    CONVERSATIONS_LIST: 'https://slack.com/api/conversations.list',
    AUTH_TEST: 'https://slack.com/api/auth.test'
};

const SlackUserIntegration = {
    /**
     * Generate OAuth authorization URL
     */
    getOAuthUrl: (userId, redirectUri) => {
        const clientId = process.env.SLACK_CLIENT_ID;
        if (!clientId) {
            throw new Error('SLACK_CLIENT_ID not configured');
        }

        const state = Buffer.from(JSON.stringify({ 
            userId, 
            provider: 'slack',
            ts: Date.now() 
        })).toString('base64url');

        // User scopes for user-level access
        const userScopes = [
            'chat:write',
            'channels:read',
            'groups:read',
            'im:write',
            'users:read'
        ].join(',');

        return `https://slack.com/oauth/v2/authorize?` +
            `client_id=${clientId}&` +
            `user_scope=${userScopes}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `state=${state}`;
    },

    /**
     * Handle OAuth callback - exchange code for tokens
     */
    handleCallback: async (userId, code, redirectUri) => {
        const clientId = process.env.SLACK_CLIENT_ID;
        const clientSecret = process.env.SLACK_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            throw new Error('Slack OAuth credentials not configured');
        }

        try {
            const response = await axios.post(SLACK_API.OAUTH_ACCESS, null, {
                params: {
                    client_id: clientId,
                    client_secret: clientSecret,
                    code,
                    redirect_uri: redirectUri
                }
            });

            if (!response.data.ok) {
                throw new Error(response.data.error || 'Slack OAuth failed');
            }

            const data = response.data;

            // Save connection with user token
            await UserIntegrationService.saveConnection(userId, 'slack', {
                access_token: data.authed_user?.access_token,
                refresh_token: data.authed_user?.refresh_token,
                expires_in: data.authed_user?.expires_in,
                external_user_id: data.authed_user?.id,
                external_workspace_id: data.team?.id,
                external_workspace_name: data.team?.name,
                config: {
                    bot_token: data.access_token,
                    scope: data.authed_user?.scope,
                    user_scope: data.authed_user?.scope,
                    team_name: data.team?.name,
                    incoming_webhook: data.incoming_webhook
                }
            });

            return {
                success: true,
                workspace: data.team?.name
            };
        } catch (error) {
            console.error('[SlackUserIntegration] OAuth callback error:', error);
            throw new Error('Failed to connect Slack: ' + (error.message || 'Unknown error'));
        }
    },

    /**
     * Send a message to Slack
     */
    sendMessage: async (userId, message, options = {}) => {
        const connection = await UserIntegrationService.getConnection(userId, 'slack');
        if (!connection || connection.status !== 'active') {
            throw new Error('Slack not connected');
        }

        const token = connection.accessToken;
        if (!token) {
            throw new Error('No Slack access token');
        }

        try {
            const response = await axios.post(
                SLACK_API.CHAT_POST_MESSAGE,
                {
                    channel: options.channel || connection.config?.default_channel || connection.externalUserId,
                    text: message.text,
                    blocks: message.blocks,
                    attachments: message.attachments,
                    unfurl_links: false,
                    unfurl_media: false
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.data.ok) {
                throw new Error(response.data.error || 'Failed to send message');
            }

            // Update last sync
            await UserIntegrationService.updateLastSync(userId, 'slack');

            return {
                success: true,
                messageTs: response.data.ts,
                channel: response.data.channel
            };
        } catch (error) {
            console.error('[SlackUserIntegration] Send message error:', error);
            
            // Update status if token is invalid
            if (error.response?.data?.error === 'invalid_auth' || 
                error.response?.data?.error === 'token_expired') {
                await UserIntegrationService.updateStatus(userId, 'slack', 'expired', error.message);
            }
            
            throw error;
        }
    },

    /**
     * Send a notification to Slack with interactive buttons
     */
    sendNotification: async (userId, notification) => {
        const blocks = SlackUserIntegration._buildNotificationBlocks(notification);
        
        return SlackUserIntegration.sendMessage(userId, {
            text: `${notification.title}: ${notification.message}`,
            blocks
        });
    },

    /**
     * Build Slack blocks for notification
     */
    _buildNotificationBlocks: (notification) => {
        const blocks = [];

        // Header
        blocks.push({
            type: 'header',
            text: {
                type: 'plain_text',
                text: notification.title,
                emoji: true
            }
        });

        // Context with severity
        const severityEmoji = {
            'CRITICAL': '🔴',
            'WARNING': '🟡',
            'INFO': '🔵'
        };

        blocks.push({
            type: 'context',
            elements: [
                {
                    type: 'mrkdwn',
                    text: `${severityEmoji[notification.severity] || '🔵'} *${notification.type}*`
                }
            ]
        });

        // Main message
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: notification.message
            }
        });

        // Action buttons if actionable
        if (notification.isActionable && notification.actionUrl) {
            blocks.push({
                type: 'actions',
                elements: [
                    {
                        type: 'button',
                        text: {
                            type: 'plain_text',
                            text: 'View in Consultify',
                            emoji: true
                        },
                        url: notification.actionUrl,
                        action_id: 'view_in_app'
                    }
                ]
            });
        }

        // Add task-specific actions
        if (notification.type.startsWith('TASK_')) {
            blocks.push({
                type: 'actions',
                elements: [
                    {
                        type: 'button',
                        text: {
                            type: 'plain_text',
                            text: '✓ Mark Complete',
                            emoji: true
                        },
                        style: 'primary',
                        action_id: `task_complete_${notification.relatedObjectId}`
                    },
                    {
                        type: 'button',
                        text: {
                            type: 'plain_text',
                            text: '⏰ Snooze 1h',
                            emoji: true
                        },
                        action_id: `task_snooze_${notification.relatedObjectId}`
                    }
                ]
            });
        }

        return blocks;
    },

    /**
     * Test connection
     */
    testConnection: async (userId) => {
        const connection = await UserIntegrationService.getConnection(userId, 'slack');
        if (!connection) {
            return { success: false, error: 'Not connected' };
        }

        const token = connection.accessToken;
        if (!token) {
            return { success: false, error: 'No access token' };
        }

        try {
            const response = await axios.post(
                SLACK_API.AUTH_TEST,
                {},
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.data.ok) {
                await UserIntegrationService.updateStatus(userId, 'slack', 'error', response.data.error);
                return { success: false, error: response.data.error };
            }

            return {
                success: true,
                user: response.data.user,
                team: response.data.team
            };
        } catch (error) {
            console.error('[SlackUserIntegration] Test connection error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Get available channels for the user
     */
    getChannels: async (userId) => {
        const connection = await UserIntegrationService.getConnection(userId, 'slack');
        if (!connection) {
            throw new Error('Slack not connected');
        }

        try {
            const response = await axios.get(SLACK_API.CONVERSATIONS_LIST, {
                headers: {
                    'Authorization': `Bearer ${connection.accessToken}`
                },
                params: {
                    types: 'public_channel,private_channel',
                    exclude_archived: true,
                    limit: 100
                }
            });

            if (!response.data.ok) {
                throw new Error(response.data.error);
            }

            return response.data.channels.map(ch => ({
                id: ch.id,
                name: ch.name,
                isPrivate: ch.is_private
            }));
        } catch (error) {
            console.error('[SlackUserIntegration] Get channels error:', error);
            throw error;
        }
    }
};

export default SlackUserIntegration;















