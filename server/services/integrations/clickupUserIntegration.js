/**
 * ClickUpUserIntegration
 * 
 * User-level ClickUp integration service.
 * Handles OAuth flow and task sync for individual users.
 * 
 * Part of: User-Level Notifications & Integrations System
 */

const axios = require('axios');
const UserIntegrationService = require('../userIntegrationService');

// ClickUp API endpoints
const CLICKUP_API = {
    OAUTH_TOKEN: 'https://app.clickup.com/api/v2/oauth/token',
    USER: 'https://api.clickup.com/api/v2/user',
    TEAMS: 'https://api.clickup.com/api/v2/team',
    SPACES: 'https://api.clickup.com/api/v2/team/{team_id}/space',
    LISTS: 'https://api.clickup.com/api/v2/folder/{folder_id}/list',
    TASKS: 'https://api.clickup.com/api/v2/list/{list_id}/task',
    TASK: 'https://api.clickup.com/api/v2/task/{task_id}'
};

const ClickUpUserIntegration = {
    /**
     * Generate OAuth authorization URL
     */
    getOAuthUrl: (userId, redirectUri) => {
        const clientId = process.env.CLICKUP_CLIENT_ID;

        if (!clientId) {
            throw new Error('CLICKUP_CLIENT_ID not configured');
        }

        const state = Buffer.from(JSON.stringify({ 
            userId, 
            provider: 'clickup',
            ts: Date.now() 
        })).toString('base64url');

        return `https://app.clickup.com/api?` +
            `client_id=${clientId}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `state=${state}`;
    },

    /**
     * Handle OAuth callback - exchange code for tokens
     */
    handleCallback: async (userId, code, redirectUri) => {
        const clientId = process.env.CLICKUP_CLIENT_ID;
        const clientSecret = process.env.CLICKUP_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            throw new Error('ClickUp OAuth credentials not configured');
        }

        try {
            // Exchange code for token
            const tokenResponse = await axios.post(CLICKUP_API.OAUTH_TOKEN, null, {
                params: {
                    client_id: clientId,
                    client_secret: clientSecret,
                    code
                }
            });

            const accessToken = tokenResponse.data.access_token;

            // Get user info
            const userResponse = await axios.get(CLICKUP_API.USER, {
                headers: { 'Authorization': accessToken }
            });

            const user = userResponse.data.user;

            // Get teams (workspaces)
            const teamsResponse = await axios.get(CLICKUP_API.TEAMS, {
                headers: { 'Authorization': accessToken }
            });

            const teams = teamsResponse.data.teams;
            const primaryTeam = teams[0];

            // Save connection
            await UserIntegrationService.saveConnection(userId, 'clickup', {
                access_token: accessToken,
                external_user_id: user.id.toString(),
                external_workspace_id: primaryTeam?.id?.toString(),
                external_workspace_name: user.username,
                config: {
                    email: user.email,
                    username: user.username,
                    color: user.color,
                    teams: teams.map(t => ({ id: t.id, name: t.name })),
                    primary_team_id: primaryTeam?.id
                }
            });

            return {
                success: true,
                user: user.username,
                team: primaryTeam?.name
            };
        } catch (error) {
            console.error('[ClickUpUserIntegration] OAuth callback error:', error);
            throw new Error('Failed to connect ClickUp: ' + (error.message || 'Unknown error'));
        }
    },

    /**
     * Create task in ClickUp
     */
    createTask: async (userId, taskData) => {
        const connection = await UserIntegrationService.getConnection(userId, 'clickup');
        if (!connection || connection.status !== 'active') {
            throw new Error('ClickUp not connected');
        }

        const listId = taskData.listId || connection.config?.default_list_id;
        if (!listId) {
            throw new Error('No ClickUp list specified');
        }

        const taskUrl = CLICKUP_API.TASKS.replace('{list_id}', listId);

        try {
            const response = await axios.post(
                taskUrl,
                {
                    name: taskData.title,
                    description: taskData.description,
                    priority: ClickUpUserIntegration._mapPriority(taskData.priority),
                    due_date: taskData.dueDate ? new Date(taskData.dueDate).getTime() : undefined,
                    status: taskData.status
                },
                {
                    headers: { 
                        'Authorization': connection.accessToken,
                        'Content-Type': 'application/json'
                    }
                }
            );

            await UserIntegrationService.updateLastSync(userId, 'clickup');

            return {
                success: true,
                taskId: response.data.id,
                taskUrl: response.data.url
            };
        } catch (error) {
            console.error('[ClickUpUserIntegration] Create task error:', error);
            throw error;
        }
    },

    /**
     * Update task in ClickUp
     */
    updateTask: async (userId, taskId, updates) => {
        const connection = await UserIntegrationService.getConnection(userId, 'clickup');
        if (!connection || connection.status !== 'active') {
            throw new Error('ClickUp not connected');
        }

        const taskUrl = CLICKUP_API.TASK.replace('{task_id}', taskId);

        try {
            const updateData = {};
            
            if (updates.title) updateData.name = updates.title;
            if (updates.description) updateData.description = updates.description;
            if (updates.priority) updateData.priority = ClickUpUserIntegration._mapPriority(updates.priority);
            if (updates.dueDate) updateData.due_date = new Date(updates.dueDate).getTime();
            if (updates.status) updateData.status = updates.status;

            await axios.put(
                taskUrl,
                updateData,
                {
                    headers: { 
                        'Authorization': connection.accessToken,
                        'Content-Type': 'application/json'
                    }
                }
            );

            await UserIntegrationService.updateLastSync(userId, 'clickup');

            return { success: true };
        } catch (error) {
            console.error('[ClickUpUserIntegration] Update task error:', error);
            throw error;
        }
    },

    /**
     * Get task from ClickUp
     */
    getTask: async (userId, taskId) => {
        const connection = await UserIntegrationService.getConnection(userId, 'clickup');
        if (!connection || connection.status !== 'active') {
            throw new Error('ClickUp not connected');
        }

        const taskUrl = CLICKUP_API.TASK.replace('{task_id}', taskId);

        try {
            const response = await axios.get(taskUrl, {
                headers: { 'Authorization': connection.accessToken }
            });

            return ClickUpUserIntegration._mapTaskFromClickUp(response.data);
        } catch (error) {
            console.error('[ClickUpUserIntegration] Get task error:', error);
            throw error;
        }
    },

    /**
     * Get tasks from a list
     */
    getTasks: async (userId, listId, options = {}) => {
        const connection = await UserIntegrationService.getConnection(userId, 'clickup');
        if (!connection || connection.status !== 'active') {
            throw new Error('ClickUp not connected');
        }

        const taskUrl = CLICKUP_API.TASKS.replace('{list_id}', listId);

        try {
            const response = await axios.get(taskUrl, {
                headers: { 'Authorization': connection.accessToken },
                params: {
                    archived: false,
                    ...options
                }
            });

            return response.data.tasks.map(ClickUpUserIntegration._mapTaskFromClickUp);
        } catch (error) {
            console.error('[ClickUpUserIntegration] Get tasks error:', error);
            throw error;
        }
    },

    /**
     * Get available teams/workspaces
     */
    getTeams: async (userId) => {
        const connection = await UserIntegrationService.getConnection(userId, 'clickup');
        if (!connection) {
            throw new Error('ClickUp not connected');
        }

        try {
            const response = await axios.get(CLICKUP_API.TEAMS, {
                headers: { 'Authorization': connection.accessToken }
            });

            return response.data.teams.map(team => ({
                id: team.id,
                name: team.name,
                members: team.members?.length || 0
            }));
        } catch (error) {
            console.error('[ClickUpUserIntegration] Get teams error:', error);
            throw error;
        }
    },

    /**
     * Get spaces in a team
     */
    getSpaces: async (userId, teamId) => {
        const connection = await UserIntegrationService.getConnection(userId, 'clickup');
        if (!connection) {
            throw new Error('ClickUp not connected');
        }

        const spacesUrl = CLICKUP_API.SPACES.replace('{team_id}', teamId);

        try {
            const response = await axios.get(spacesUrl, {
                headers: { 'Authorization': connection.accessToken }
            });

            return response.data.spaces.map(space => ({
                id: space.id,
                name: space.name,
                private: space.private
            }));
        } catch (error) {
            console.error('[ClickUpUserIntegration] Get spaces error:', error);
            throw error;
        }
    },

    /**
     * Test connection
     */
    testConnection: async (userId) => {
        const connection = await UserIntegrationService.getConnection(userId, 'clickup');
        if (!connection) {
            return { success: false, error: 'Not connected' };
        }

        try {
            const response = await axios.get(CLICKUP_API.USER, {
                headers: { 'Authorization': connection.accessToken }
            });

            return {
                success: true,
                user: response.data.user.username,
                email: response.data.user.email
            };
        } catch (error) {
            console.error('[ClickUpUserIntegration] Test connection error:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Map priority from Consultify to ClickUp
     * ClickUp: 1 = Urgent, 2 = High, 3 = Normal, 4 = Low
     */
    _mapPriority: (priority) => {
        const map = {
            'urgent': 1,
            'high': 2,
            'medium': 3,
            'normal': 3,
            'low': 4
        };
        return map[priority?.toLowerCase()] || 3;
    },

    /**
     * Map priority from ClickUp to Consultify
     */
    _mapPriorityFromClickUp: (priority) => {
        const map = {
            1: 'urgent',
            2: 'high',
            3: 'medium',
            4: 'low'
        };
        return map[priority] || 'medium';
    },

    /**
     * Map task from ClickUp format to Consultify format
     */
    _mapTaskFromClickUp: (task) => {
        return {
            id: task.id,
            title: task.name,
            description: task.description,
            status: task.status?.status,
            priority: ClickUpUserIntegration._mapPriorityFromClickUp(task.priority?.id),
            dueDate: task.due_date ? new Date(parseInt(task.due_date)).toISOString() : null,
            url: task.url,
            creator: task.creator?.username,
            assignees: task.assignees?.map(a => a.username) || [],
            tags: task.tags?.map(t => t.name) || [],
            createdAt: task.date_created ? new Date(parseInt(task.date_created)).toISOString() : null,
            updatedAt: task.date_updated ? new Date(parseInt(task.date_updated)).toISOString() : null
        };
    }
};

export default ClickUpUserIntegration;







