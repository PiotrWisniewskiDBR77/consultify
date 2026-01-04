/**
 * JiraUserIntegration
 * 
 * User-level Jira integration service.
 * Handles OAuth flow and bi-directional sync for individual users.
 * 
 * Part of: User-Level Notifications & Integrations System
 */

import axios from 'axios';
import UserIntegrationService from '../userIntegrationService.js';

// Jira/Atlassian API endpoints
const ATLASSIAN_API = {
    OAUTH_TOKEN: 'https://auth.atlassian.com/oauth/token',
    ACCESSIBLE_RESOURCES: 'https://api.atlassian.com/oauth/token/accessible-resources',
    MYSELF: 'https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/myself',
    SEARCH: 'https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/search',
    ISSUE: 'https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/issue',
    ISSUE_TRANSITIONS: 'https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/issue/{issueKey}/transitions'
};

const JiraUserIntegration = {
    /**
     * Generate OAuth authorization URL
     */
    getOAuthUrl: (userId, redirectUri) => {
        const clientId = process.env.JIRA_CLIENT_ID;

        if (!clientId) {
            throw new Error('JIRA_CLIENT_ID not configured');
        }

        const state = Buffer.from(JSON.stringify({ 
            userId, 
            provider: 'jira',
            ts: Date.now() 
        })).toString('base64url');

        const scopes = [
            'read:jira-work',
            'write:jira-work',
            'read:jira-user',
            'offline_access'
        ].join(' ');

        return `https://auth.atlassian.com/authorize?` +
            `audience=api.atlassian.com&` +
            `client_id=${clientId}&` +
            `scope=${encodeURIComponent(scopes)}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `state=${state}&` +
            `response_type=code&` +
            `prompt=consent`;
    },

    /**
     * Handle OAuth callback - exchange code for tokens
     */
    handleCallback: async (userId, code, redirectUri) => {
        const clientId = process.env.JIRA_CLIENT_ID;
        const clientSecret = process.env.JIRA_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            throw new Error('Jira OAuth credentials not configured');
        }

        try {
            // Exchange code for tokens
            const tokenResponse = await axios.post(ATLASSIAN_API.OAUTH_TOKEN, {
                grant_type: 'authorization_code',
                client_id: clientId,
                client_secret: clientSecret,
                code,
                redirect_uri: redirectUri
            });

            const tokens = tokenResponse.data;

            // Get accessible resources (Jira sites)
            const resourcesResponse = await axios.get(ATLASSIAN_API.ACCESSIBLE_RESOURCES, {
                headers: { 'Authorization': `Bearer ${tokens.access_token}` }
            });

            const sites = resourcesResponse.data;
            const primarySite = sites[0]; // Use first site as primary

            if (!primarySite) {
                throw new Error('No accessible Jira sites found');
            }

            // Get user info from Jira
            const myselfUrl = ATLASSIAN_API.MYSELF.replace('{cloudId}', primarySite.id);
            const userResponse = await axios.get(myselfUrl, {
                headers: { 'Authorization': `Bearer ${tokens.access_token}` }
            });

            const user = userResponse.data;

            // Save connection
            await UserIntegrationService.saveConnection(userId, 'jira', {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_in: tokens.expires_in,
                external_user_id: user.accountId,
                external_workspace_id: primarySite.id,
                external_workspace_name: primarySite.name,
                config: {
                    cloud_id: primarySite.id,
                    site_url: primarySite.url,
                    available_sites: sites.map(s => ({ id: s.id, name: s.name, url: s.url })),
                    account_id: user.accountId,
                    email: user.emailAddress
                }
            });

            return {
                success: true,
                site: primarySite.name,
                user: user.displayName
            };
        } catch (error) {
            console.error('[JiraUserIntegration] OAuth callback error:', error);
            throw new Error('Failed to connect Jira: ' + (error.message || 'Unknown error'));
        }
    },

    /**
     * Refresh access token
     */
    refreshToken: async (userId) => {
        const connection = await UserIntegrationService.getConnection(userId, 'jira');
        if (!connection || !connection.refreshToken) {
            throw new Error('No refresh token available');
        }

        const clientId = process.env.JIRA_CLIENT_ID;
        const clientSecret = process.env.JIRA_CLIENT_SECRET;

        try {
            const response = await axios.post(ATLASSIAN_API.OAUTH_TOKEN, {
                grant_type: 'refresh_token',
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: connection.refreshToken
            });

            // Update tokens
            await UserIntegrationService.saveConnection(userId, 'jira', {
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token,
                expires_in: response.data.expires_in,
                external_user_id: connection.externalUserId,
                external_workspace_id: connection.externalWorkspaceId,
                external_workspace_name: connection.externalWorkspaceName,
                config: connection.config
            });

            return { success: true };
        } catch (error) {
            console.error('[JiraUserIntegration] Refresh token error:', error);
            await UserIntegrationService.updateStatus(userId, 'jira', 'expired', error.message);
            throw error;
        }
    },

    /**
     * Create issue in Jira
     */
    createIssue: async (userId, issueData) => {
        const connection = await UserIntegrationService.getConnection(userId, 'jira');
        if (!connection || connection.status !== 'active') {
            throw new Error('Jira not connected');
        }

        const cloudId = connection.config?.cloud_id;
        const issueUrl = ATLASSIAN_API.ISSUE.replace('{cloudId}', cloudId);

        try {
            const response = await axios.post(
                issueUrl,
                {
                    fields: {
                        project: { key: issueData.projectKey },
                        summary: issueData.title,
                        description: {
                            type: 'doc',
                            version: 1,
                            content: [{
                                type: 'paragraph',
                                content: [{ type: 'text', text: issueData.description || '' }]
                            }]
                        },
                        issuetype: { name: issueData.issueType || 'Task' },
                        priority: issueData.priority ? { name: issueData.priority } : undefined,
                        duedate: issueData.dueDate
                    }
                },
                {
                    headers: { 
                        'Authorization': `Bearer ${connection.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            await UserIntegrationService.updateLastSync(userId, 'jira');

            return {
                success: true,
                issueKey: response.data.key,
                issueId: response.data.id,
                issueUrl: `${connection.config.site_url}/browse/${response.data.key}`
            };
        } catch (error) {
            console.error('[JiraUserIntegration] Create issue error:', error);
            
            if (error.response?.status === 401) {
                await JiraUserIntegration.refreshToken(userId);
                return JiraUserIntegration.createIssue(userId, issueData);
            }
            
            throw error;
        }
    },

    /**
     * Update issue in Jira
     */
    updateIssue: async (userId, issueKey, updates) => {
        const connection = await UserIntegrationService.getConnection(userId, 'jira');
        if (!connection || connection.status !== 'active') {
            throw new Error('Jira not connected');
        }

        const cloudId = connection.config?.cloud_id;
        const issueUrl = `${ATLASSIAN_API.ISSUE.replace('{cloudId}', cloudId)}/${issueKey}`;

        try {
            const fields = {};
            
            if (updates.title) fields.summary = updates.title;
            if (updates.description) {
                fields.description = {
                    type: 'doc',
                    version: 1,
                    content: [{
                        type: 'paragraph',
                        content: [{ type: 'text', text: updates.description }]
                    }]
                };
            }
            if (updates.dueDate) fields.duedate = updates.dueDate;
            if (updates.priority) fields.priority = { name: updates.priority };

            await axios.put(
                issueUrl,
                { fields },
                {
                    headers: { 
                        'Authorization': `Bearer ${connection.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            await UserIntegrationService.updateLastSync(userId, 'jira');

            return { success: true };
        } catch (error) {
            console.error('[JiraUserIntegration] Update issue error:', error);
            throw error;
        }
    },

    /**
     * Transition issue (change status)
     */
    transitionIssue: async (userId, issueKey, transitionId) => {
        const connection = await UserIntegrationService.getConnection(userId, 'jira');
        if (!connection || connection.status !== 'active') {
            throw new Error('Jira not connected');
        }

        const cloudId = connection.config?.cloud_id;
        const transitionUrl = ATLASSIAN_API.ISSUE_TRANSITIONS
            .replace('{cloudId}', cloudId)
            .replace('{issueKey}', issueKey);

        try {
            await axios.post(
                transitionUrl,
                { transition: { id: transitionId } },
                {
                    headers: { 
                        'Authorization': `Bearer ${connection.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return { success: true };
        } catch (error) {
            console.error('[JiraUserIntegration] Transition issue error:', error);
            throw error;
        }
    },

    /**
     * Search issues
     */
    searchIssues: async (userId, jql, maxResults = 50) => {
        const connection = await UserIntegrationService.getConnection(userId, 'jira');
        if (!connection || connection.status !== 'active') {
            throw new Error('Jira not connected');
        }

        const cloudId = connection.config?.cloud_id;
        const searchUrl = ATLASSIAN_API.SEARCH.replace('{cloudId}', cloudId);

        try {
            const response = await axios.post(
                searchUrl,
                { jql, maxResults },
                {
                    headers: { 
                        'Authorization': `Bearer ${connection.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data.issues.map(issue => ({
                key: issue.key,
                id: issue.id,
                summary: issue.fields.summary,
                status: issue.fields.status?.name,
                priority: issue.fields.priority?.name,
                dueDate: issue.fields.duedate,
                assignee: issue.fields.assignee?.displayName
            }));
        } catch (error) {
            console.error('[JiraUserIntegration] Search issues error:', error);
            throw error;
        }
    },

    /**
     * Test connection
     */
    testConnection: async (userId) => {
        const connection = await UserIntegrationService.getConnection(userId, 'jira');
        if (!connection) {
            return { success: false, error: 'Not connected' };
        }

        try {
            const cloudId = connection.config?.cloud_id;
            const myselfUrl = ATLASSIAN_API.MYSELF.replace('{cloudId}', cloudId);

            const response = await axios.get(myselfUrl, {
                headers: { 'Authorization': `Bearer ${connection.accessToken}` }
            });

            return {
                success: true,
                user: response.data.displayName,
                site: connection.externalWorkspaceName
            };
        } catch (error) {
            if (error.response?.status === 401) {
                try {
                    await JiraUserIntegration.refreshToken(userId);
                    return JiraUserIntegration.testConnection(userId);
                } catch {
                    return { success: false, error: 'Token expired', needsReauth: true };
                }
            }
            return { success: false, error: error.message };
        }
    }
};

export default JiraUserIntegration;









