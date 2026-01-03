/**
 * MCP Server - Model Context Protocol Implementation
 * 
 * User-scoped MCP server for AI integrations (Claude, Cursor, etc.)
 * Provides tools, resources, and prompts for Consultify data.
 * 
 * Based on Anthropic MCP Specification:
 * https://modelcontextprotocol.io/docs
 * 
 * Part of: User-Level Notifications & Integrations System
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// MCP Protocol Version
const MCP_VERSION = '2024-11-05';

// Available tools for MCP clients
const TOOLS = {
    // Task Management
    'consultify.tasks.list': {
        name: 'consultify.tasks.list',
        description: 'List tasks assigned to the user or in their projects',
        inputSchema: {
            type: 'object',
            properties: {
                status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'all'] },
                priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
                projectId: { type: 'string' },
                limit: { type: 'number', default: 20 }
            }
        }
    },
    'consultify.tasks.create': {
        name: 'consultify.tasks.create',
        description: 'Create a new task',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Task title' },
                description: { type: 'string' },
                priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
                dueDate: { type: 'string', format: 'date-time' },
                projectId: { type: 'string' },
                assigneeId: { type: 'string' }
            },
            required: ['title']
        }
    },
    'consultify.tasks.update': {
        name: 'consultify.tasks.update',
        description: 'Update an existing task',
        inputSchema: {
            type: 'object',
            properties: {
                taskId: { type: 'string' },
                title: { type: 'string' },
                status: { type: 'string' },
                priority: { type: 'string' },
                dueDate: { type: 'string' }
            },
            required: ['taskId']
        }
    },
    'consultify.tasks.get': {
        name: 'consultify.tasks.get',
        description: 'Get details of a specific task',
        inputSchema: {
            type: 'object',
            properties: {
                taskId: { type: 'string' }
            },
            required: ['taskId']
        }
    },

    // Initiatives
    'consultify.initiatives.list': {
        name: 'consultify.initiatives.list',
        description: 'List initiatives in the organization',
        inputSchema: {
            type: 'object',
            properties: {
                status: { type: 'string' },
                limit: { type: 'number', default: 10 }
            }
        }
    },
    'consultify.initiatives.get': {
        name: 'consultify.initiatives.get',
        description: 'Get details of a specific initiative',
        inputSchema: {
            type: 'object',
            properties: {
                initiativeId: { type: 'string' }
            },
            required: ['initiativeId']
        }
    },

    // Notifications
    'consultify.notifications.list': {
        name: 'consultify.notifications.list',
        description: 'List notifications for the user',
        inputSchema: {
            type: 'object',
            properties: {
                unreadOnly: { type: 'boolean', default: false },
                limit: { type: 'number', default: 20 }
            }
        }
    },
    'consultify.notifications.send': {
        name: 'consultify.notifications.send',
        description: 'Send a notification to a user',
        inputSchema: {
            type: 'object',
            properties: {
                userId: { type: 'string' },
                title: { type: 'string' },
                message: { type: 'string' },
                type: { type: 'string' }
            },
            required: ['title', 'message']
        }
    },

    // Projects
    'consultify.projects.list': {
        name: 'consultify.projects.list',
        description: 'List projects the user has access to',
        inputSchema: {
            type: 'object',
            properties: {
                status: { type: 'string' },
                limit: { type: 'number', default: 20 }
            }
        }
    },

    // Search
    'consultify.search': {
        name: 'consultify.search',
        description: 'Search across tasks, initiatives, and projects',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string' },
                types: { 
                    type: 'array', 
                    items: { type: 'string', enum: ['tasks', 'initiatives', 'projects'] },
                    default: ['tasks', 'initiatives', 'projects']
                },
                limit: { type: 'number', default: 10 }
            },
            required: ['query']
        }
    }
};

// Available resources
const RESOURCES = {
    'consultify://user/profile': {
        uri: 'consultify://user/profile',
        name: 'User Profile',
        description: 'Current user profile information',
        mimeType: 'application/json'
    },
    'consultify://user/tasks/today': {
        uri: 'consultify://user/tasks/today',
        name: 'Today\'s Tasks',
        description: 'Tasks due today for the current user',
        mimeType: 'application/json'
    },
    'consultify://user/tasks/overdue': {
        uri: 'consultify://user/tasks/overdue',
        name: 'Overdue Tasks',
        description: 'Overdue tasks for the current user',
        mimeType: 'application/json'
    },
    'consultify://user/notifications/unread': {
        uri: 'consultify://user/notifications/unread',
        name: 'Unread Notifications',
        description: 'Unread notifications for the current user',
        mimeType: 'application/json'
    },
    'consultify://organization/initiatives': {
        uri: 'consultify://organization/initiatives',
        name: 'Organization Initiatives',
        description: 'Active initiatives in the organization',
        mimeType: 'application/json'
    }
};

// Available prompts
const PROMPTS = {
    'consultify.daily_standup': {
        name: 'consultify.daily_standup',
        description: 'Generate a daily standup summary',
        arguments: [
            { name: 'includeYesterday', description: 'Include yesterday\'s completed tasks', required: false }
        ]
    },
    'consultify.task_breakdown': {
        name: 'consultify.task_breakdown',
        description: 'Break down a task into subtasks',
        arguments: [
            { name: 'taskId', description: 'ID of the task to break down', required: true }
        ]
    },
    'consultify.initiative_summary': {
        name: 'consultify.initiative_summary',
        description: 'Generate an executive summary for an initiative',
        arguments: [
            { name: 'initiativeId', description: 'ID of the initiative', required: true }
        ]
    }
};

/**
 * MCP Server Implementation
 */
const MCPServer = {
    VERSION: MCP_VERSION,
    TOOLS,
    RESOURCES,
    PROMPTS,

    // ==========================================
    // SERVER INFO
    // ==========================================

    /**
     * Get server information (capabilities)
     */
    getServerInfo: () => ({
        protocolVersion: MCP_VERSION,
        capabilities: {
            tools: { listChanged: true },
            resources: { subscribe: true, listChanged: true },
            prompts: { listChanged: true },
            logging: {}
        },
        serverInfo: {
            name: 'consultify-mcp',
            version: '1.0.0'
        }
    }),

    // ==========================================
    // TOOLS
    // ==========================================

    /**
     * List available tools
     */
    listTools: () => {
        return {
            tools: Object.values(TOOLS)
        };
    },

    /**
     * Execute a tool
     */
    executeTool: async (toolName, args, userContext) => {
        const { userId, organizationId } = userContext;

        // Log MCP audit
        await MCPServer._logAudit(userId, organizationId, {
            toolName,
            request: args
        });

        const startTime = Date.now();

        try {
            let result;

            switch (toolName) {
                case 'consultify.tasks.list':
                    result = await MCPServer._getTasksList(userId, organizationId, args);
                    break;
                case 'consultify.tasks.create':
                    result = await MCPServer._createTask(userId, organizationId, args);
                    break;
                case 'consultify.tasks.update':
                    result = await MCPServer._updateTask(userId, organizationId, args);
                    break;
                case 'consultify.tasks.get':
                    result = await MCPServer._getTask(userId, organizationId, args);
                    break;
                case 'consultify.initiatives.list':
                    result = await MCPServer._getInitiativesList(userId, organizationId, args);
                    break;
                case 'consultify.initiatives.get':
                    result = await MCPServer._getInitiative(userId, organizationId, args);
                    break;
                case 'consultify.notifications.list':
                    result = await MCPServer._getNotificationsList(userId, args);
                    break;
                case 'consultify.notifications.send':
                    result = await MCPServer._sendNotification(userId, organizationId, args);
                    break;
                case 'consultify.projects.list':
                    result = await MCPServer._getProjectsList(userId, organizationId, args);
                    break;
                case 'consultify.search':
                    result = await MCPServer._search(userId, organizationId, args);
                    break;
                default:
                    throw new Error(`Unknown tool: ${toolName}`);
            }

            const latency = Date.now() - startTime;
            await MCPServer._logAudit(userId, organizationId, {
                toolName,
                response: result,
                latency
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }
                ]
            };
        } catch (error) {
            console.error(`[MCP] Tool ${toolName} error:`, error);
            throw error;
        }
    },

    // ==========================================
    // RESOURCES
    // ==========================================

    /**
     * List available resources
     */
    listResources: () => {
        return {
            resources: Object.values(RESOURCES)
        };
    },

    /**
     * Read a resource
     */
    readResource: async (uri, userContext) => {
        const { userId, organizationId } = userContext;

        await MCPServer._logAudit(userId, organizationId, {
            resourcePath: uri
        });

        let content;

        switch (uri) {
            case 'consultify://user/profile':
                content = await MCPServer._getUserProfile(userId);
                break;
            case 'consultify://user/tasks/today':
                content = await MCPServer._getTodaysTasks(userId, organizationId);
                break;
            case 'consultify://user/tasks/overdue':
                content = await MCPServer._getOverdueTasks(userId, organizationId);
                break;
            case 'consultify://user/notifications/unread':
                content = await MCPServer._getUnreadNotifications(userId);
                break;
            case 'consultify://organization/initiatives':
                content = await MCPServer._getOrgInitiatives(organizationId);
                break;
            default:
                throw new Error(`Unknown resource: ${uri}`);
        }

        return {
            contents: [
                {
                    uri,
                    mimeType: 'application/json',
                    text: JSON.stringify(content, null, 2)
                }
            ]
        };
    },

    // ==========================================
    // PROMPTS
    // ==========================================

    /**
     * List available prompts
     */
    listPrompts: () => {
        return {
            prompts: Object.values(PROMPTS)
        };
    },

    /**
     * Get a prompt with arguments filled in
     */
    getPrompt: async (promptName, args, userContext) => {
        const { userId, organizationId } = userContext;

        await MCPServer._logAudit(userId, organizationId, {
            promptName,
            request: args
        });

        let messages;

        switch (promptName) {
            case 'consultify.daily_standup':
                messages = await MCPServer._buildStandupPrompt(userId, organizationId, args);
                break;
            case 'consultify.task_breakdown':
                messages = await MCPServer._buildTaskBreakdownPrompt(userId, organizationId, args);
                break;
            case 'consultify.initiative_summary':
                messages = await MCPServer._buildInitiativeSummaryPrompt(userId, organizationId, args);
                break;
            default:
                throw new Error(`Unknown prompt: ${promptName}`);
        }

        return { messages };
    },

    // ==========================================
    // INTERNAL IMPLEMENTATIONS
    // ==========================================

    _getTasksList: async (userId, organizationId, args) => {
        const { status, priority, projectId, limit = 20 } = args;

        let sql = `SELECT * FROM tasks WHERE assignee_id = ?`;
        const params = [userId];

        if (status && status !== 'all') {
            sql += ` AND status = ?`;
            params.push(status);
        }

        if (priority) {
            sql += ` AND priority = ?`;
            params.push(priority);
        }

        if (projectId) {
            sql += ` AND project_id = ?`;
            params.push(projectId);
        }

        sql += ` ORDER BY due_date ASC LIMIT ?`;
        params.push(limit);

        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve({ tasks: rows || [] });
            });
        });
    },

    _createTask: async (userId, organizationId, args) => {
        const { title, description, priority, dueDate, projectId, assigneeId } = args;
        const id = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO tasks (id, title, description, priority, due_date, project_id, assignee_id, created_by, organization_id, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
                [id, title, description, priority || 'medium', dueDate, projectId, assigneeId || userId, userId, organizationId],
                function(err) {
                    if (err) return reject(err);
                    resolve({ taskId: id, created: true });
                }
            );
        });
    },

    _updateTask: async (userId, organizationId, args) => {
        const { taskId, ...updates } = args;
        const setClauses = [];
        const params = [];

        if (updates.title) { setClauses.push('title = ?'); params.push(updates.title); }
        if (updates.status) { setClauses.push('status = ?'); params.push(updates.status); }
        if (updates.priority) { setClauses.push('priority = ?'); params.push(updates.priority); }
        if (updates.dueDate) { setClauses.push('due_date = ?'); params.push(updates.dueDate); }

        if (setClauses.length === 0) {
            return { updated: false, reason: 'no_updates' };
        }

        params.push(taskId);

        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE tasks SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                params,
                function(err) {
                    if (err) return reject(err);
                    resolve({ updated: this.changes > 0 });
                }
            );
        });
    },

    _getTask: async (userId, organizationId, args) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM tasks WHERE id = ?`, [args.taskId], (err, row) => {
                if (err) return reject(err);
                resolve({ task: row || null });
            });
        });
    },

    _getInitiativesList: async (userId, organizationId, args) => {
        const { status, limit = 10 } = args;

        let sql = `SELECT * FROM initiatives WHERE organization_id = ?`;
        const params = [organizationId];

        if (status) {
            sql += ` AND status = ?`;
            params.push(status);
        }

        sql += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(limit);

        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve({ initiatives: rows || [] });
            });
        });
    },

    _getInitiative: async (userId, organizationId, args) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM initiatives WHERE id = ?`, [args.initiativeId], (err, row) => {
                if (err) return reject(err);
                resolve({ initiative: row || null });
            });
        });
    },

    _getNotificationsList: async (userId, args) => {
        const { unreadOnly, limit = 20 } = args;

        let sql = `SELECT * FROM notifications WHERE user_id = ?`;
        const params = [userId];

        if (unreadOnly) {
            sql += ` AND is_read = 0`;
        }

        sql += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(limit);

        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve({ notifications: rows || [] });
            });
        });
    },

    _sendNotification: async (userId, organizationId, args) => {
        const NotificationService = require('../services/notificationService');
        
        const notification = {
            userId: args.userId || userId,
            organizationId,
            type: args.type || 'AI_MESSAGE',
            severity: 'INFO',
            title: args.title,
            message: args.message
        };

        const result = await NotificationService.deliverNotification(
            notification.userId,
            notification
        );

        return { sent: result.delivered, ...result };
    },

    _getProjectsList: async (userId, organizationId, args) => {
        const { status, limit = 20 } = args;

        let sql = `SELECT * FROM projects WHERE organization_id = ?`;
        const params = [organizationId];

        if (status) {
            sql += ` AND status = ?`;
            params.push(status);
        }

        sql += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(limit);

        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve({ projects: rows || [] });
            });
        });
    },

    _search: async (userId, organizationId, args) => {
        const { query, types = ['tasks', 'initiatives', 'projects'], limit = 10 } = args;
        const results = { query, results: [] };
        const searchPattern = `%${query}%`;

        if (types.includes('tasks')) {
            const tasks = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT id, title, status, 'task' as type FROM tasks 
                     WHERE assignee_id = ? AND (title LIKE ? OR description LIKE ?) LIMIT ?`,
                    [userId, searchPattern, searchPattern, limit],
                    (err, rows) => err ? reject(err) : resolve(rows || [])
                );
            });
            results.results.push(...tasks);
        }

        if (types.includes('initiatives')) {
            const initiatives = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT id, name as title, status, 'initiative' as type FROM initiatives 
                     WHERE organization_id = ? AND (name LIKE ? OR description LIKE ?) LIMIT ?`,
                    [organizationId, searchPattern, searchPattern, limit],
                    (err, rows) => err ? reject(err) : resolve(rows || [])
                );
            });
            results.results.push(...initiatives);
        }

        if (types.includes('projects')) {
            const projects = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT id, name as title, status, 'project' as type FROM projects 
                     WHERE organization_id = ? AND name LIKE ? LIMIT ?`,
                    [organizationId, searchPattern, limit],
                    (err, rows) => err ? reject(err) : resolve(rows || [])
                );
            });
            results.results.push(...projects);
        }

        return results;
    },

    // Resource implementations
    _getUserProfile: async (userId) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT id, email, name, role, organization_id FROM users WHERE id = ?`, [userId], (err, row) => {
                if (err) return reject(err);
                resolve(row || null);
            });
        });
    },

    _getTodaysTasks: async (userId, organizationId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM tasks 
                 WHERE assignee_id = ? AND DATE(due_date) = DATE('now') 
                 ORDER BY priority DESC, due_date ASC`,
                [userId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve({ tasks: rows || [], date: new Date().toISOString().split('T')[0] });
                }
            );
        });
    },

    _getOverdueTasks: async (userId, organizationId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM tasks 
                 WHERE assignee_id = ? AND due_date < DATE('now') AND status != 'completed'
                 ORDER BY due_date ASC`,
                [userId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve({ tasks: rows || [], count: (rows || []).length });
                }
            );
        });
    },

    _getUnreadNotifications: async (userId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC`,
                [userId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve({ notifications: rows || [], count: (rows || []).length });
                }
            );
        });
    },

    _getOrgInitiatives: async (organizationId) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM initiatives WHERE organization_id = ? ORDER BY created_at DESC LIMIT 10`,
                [organizationId],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve({ initiatives: rows || [] });
                }
            );
        });
    },

    // Prompt builders
    _buildStandupPrompt: async (userId, organizationId, args) => {
        const todayTasks = await MCPServer._getTodaysTasks(userId, organizationId);
        const overdueTasks = await MCPServer._getOverdueTasks(userId, organizationId);

        let contextData = {
            todaysTasks: todayTasks.tasks,
            overdueTasks: overdueTasks.tasks
        };

        if (args.includeYesterday) {
            // Get yesterday's completed tasks
            const yesterday = await new Promise((resolve, reject) => {
                db.all(
                    `SELECT * FROM tasks 
                     WHERE assignee_id = ? AND status = 'completed' 
                     AND DATE(updated_at) = DATE('now', '-1 day')`,
                    [userId],
                    (err, rows) => err ? reject(err) : resolve(rows || [])
                );
            });
            contextData.yesterdayCompleted = yesterday;
        }

        return [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: `Generate a daily standup summary based on the following data:\n\n${JSON.stringify(contextData, null, 2)}\n\nFormat the response as:\n1. What I did yesterday (if data provided)\n2. What I'm doing today\n3. Any blockers`
                }
            }
        ];
    },

    _buildTaskBreakdownPrompt: async (userId, organizationId, args) => {
        const task = await MCPServer._getTask(userId, organizationId, { taskId: args.taskId });

        return [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: `Break down this task into smaller, actionable subtasks:\n\nTask: ${task.task?.title || 'Unknown'}\nDescription: ${task.task?.description || 'No description'}\n\nProvide 3-7 subtasks with estimated effort for each.`
                }
            }
        ];
    },

    _buildInitiativeSummaryPrompt: async (userId, organizationId, args) => {
        const initiative = await MCPServer._getInitiative(userId, organizationId, { initiativeId: args.initiativeId });

        return [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: `Generate an executive summary for this initiative:\n\n${JSON.stringify(initiative.initiative, null, 2)}\n\nInclude: Overview, Key Metrics, Risks, and Recommendations.`
                }
            }
        ];
    },

    // Audit logging
    _logAudit: async (userId, organizationId, data) => {
        const id = uuidv4();

        return new Promise((resolve) => {
            db.run(
                `INSERT INTO mcp_audit_logs 
                 (id, user_id, organization_id, tool_name, resource_path, prompt_name, request_json, response_json, latency_ms)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, userId, organizationId,
                    data.toolName || null,
                    data.resourcePath || null,
                    data.promptName || null,
                    data.request ? JSON.stringify(data.request) : null,
                    data.response ? JSON.stringify(data.response) : null,
                    data.latency || null
                ],
                (err) => {
                    if (err) console.error('[MCP] Audit log error:', err);
                    resolve();
                }
            );
        });
    }
};

module.exports = MCPServer;





