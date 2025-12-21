/**
 * AI Integration Service
 * 
 * Prepares integration layer for task and communication tools.
 * AI suggests sync actions but NEVER pushes without approval.
 * Provider-agnostic architecture ready for Jira, ClickUp, Asana, Slack, Teams.
 */

// Dependency injection container (for deterministic unit tests)
const deps = {
    db: require('../database'),
    uuidv4: require('uuid').v4
};

// Integration types
const INTEGRATION_TYPES = {
    TASK_SYNC: 'task_sync',           // Jira, ClickUp, Asana, Monday
    NOTIFICATIONS: 'notifications',    // Slack, Teams, Email
    CALENDAR: 'calendar',             // Google Calendar, Outlook
    DOCUMENT: 'document'              // Confluence, SharePoint, Notion
};

// Supported providers by type
const SUPPORTED_PROVIDERS = {
    [INTEGRATION_TYPES.TASK_SYNC]: ['jira', 'clickup', 'asana', 'monday', 'trello'],
    [INTEGRATION_TYPES.NOTIFICATIONS]: ['slack', 'teams', 'email', 'webhook'],
    [INTEGRATION_TYPES.CALENDAR]: ['google_calendar', 'outlook'],
    [INTEGRATION_TYPES.DOCUMENT]: ['confluence', 'sharepoint', 'notion']
};

// Sync action types
const ACTION_TYPES = {
    CREATE_TASK: 'create_task',
    UPDATE_TASK: 'update_task',
    SYNC_STATUS: 'sync_status',
    SEND_NOTIFICATION: 'send_notification',
    CREATE_EVENT: 'create_event',
    SYNC_DOCUMENT: 'sync_document'
};

// Action statuses
const ACTION_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    EXECUTED: 'executed',
    EXPIRED: 'expired',
    FAILED: 'failed'
};

// Sync directions
const SYNC_DIRECTIONS = {
    INBOUND: 'inbound',
    OUTBOUND: 'outbound',
    BIDIRECTIONAL: 'bidirectional'
};

const AIIntegrationService = {
    INTEGRATION_TYPES,
    SUPPORTED_PROVIDERS,
    ACTION_TYPES,
    ACTION_STATUS,
    SYNC_DIRECTIONS,

    // For testing: allow overriding dependencies
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },

    // ==========================================
    // INTEGRATION CONFIGURATION
    // ==========================================

    /**
     * Register an integration configuration
     */
    registerIntegration: async ({ organizationId, projectId, integrationType, provider, config, syncDirection = 'bidirectional' }) => {
        // Validate provider
        if (!SUPPORTED_PROVIDERS[integrationType]?.includes(provider)) {
            throw new Error(`Provider ${provider} not supported for ${integrationType}`);
        }

        const id = deps.uuidv4();

        return new Promise((resolve, reject) => {
            deps.db.run(`
                INSERT INTO integration_configs 
                (id, organization_id, project_id, integration_type, provider, config, sync_direction, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0)
            `, [id, organizationId, projectId, integrationType, provider, JSON.stringify(config), syncDirection], function (err) {
                if (err) reject(err);
                else resolve({ id, integrationType, provider, isActive: false });
            });
        });
    },

    /**
     * Activate/Deactivate an integration
     */
    setIntegrationActive: async (integrationId, isActive) => {
        return new Promise((resolve, reject) => {
            deps.db.run(`
                UPDATE integration_configs 
                SET is_active = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [isActive ? 1 : 0, integrationId], function (err) {
                if (err) reject(err);
                else resolve({ integrationId, isActive, changes: this.changes });
            });
        });
    },

    /**
     * Get integrations for an organization
     */
    getIntegrations: async (organizationId, projectId = null) => {
        return new Promise((resolve, reject) => {
            let sql = `
                SELECT * FROM integration_configs 
                WHERE organization_id = ?
            `;
            const params = [organizationId];

            if (projectId) {
                sql += ` AND (project_id = ? OR project_id IS NULL)`;
                params.push(projectId);
            }

            sql += ` ORDER BY integration_type, provider`;

            deps.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else {
                    resolve((rows || []).map(row => ({
                        ...row,
                        config: row.config ? JSON.parse(row.config) : {},
                        is_active: !!row.is_active
                    })));
                }
            });
        });
    },

    /**
     * Get active integration by type and project
     */
    getActiveIntegration: async (organizationId, integrationType, projectId = null) => {
        return new Promise((resolve) => {
            const sql = projectId
                ? `SELECT * FROM integration_configs WHERE organization_id = ? AND integration_type = ? AND (project_id = ? OR project_id IS NULL) AND is_active = 1 LIMIT 1`
                : `SELECT * FROM integration_configs WHERE organization_id = ? AND integration_type = ? AND is_active = 1 LIMIT 1`;
            const params = projectId ? [organizationId, integrationType, projectId] : [organizationId, integrationType];

            db.get(sql, params, (err, row) => {
                resolve(row ? {
                    ...row,
                    config: row.config ? JSON.parse(row.config) : {}
                } : null);
            });
        });
    },

    // ==========================================
    // AI-SUGGESTED SYNC ACTIONS
    // ==========================================

    /**
     * AI suggests a sync action (requires human approval)
     */
    suggestSync: async ({ organizationId, projectId, integrationId, actionType, targetEntityType, targetEntityId, payload, reason }) => {
        const id = deps.uuidv4();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

        return new Promise((resolve, reject) => {
            deps.db.run(`
                INSERT INTO integration_pending_actions 
                (id, organization_id, project_id, integration_id, action_type, target_entity_type, target_entity_id, 
                 payload, suggested_by, suggestion_reason, status, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ai', ?, 'pending', ?)
            `, [
                id, organizationId, projectId, integrationId, actionType,
                targetEntityType, targetEntityId, JSON.stringify(payload), reason, expiresAt.toISOString()
            ], function (err) {
                if (err) reject(err);
                else resolve({
                    id,
                    actionType,
                    status: 'pending',
                    requiresApproval: true,
                    expiresAt: expiresAt.toISOString(),
                    message: 'Action suggested. Awaiting human approval.'
                });
            });
        });
    },

    /**
     * Get pending actions for approval
     */
    getPendingActions: async (organizationId, projectId = null) => {
        return new Promise((resolve, reject) => {
            let sql = `
                SELECT a.*, i.provider, i.integration_type
                FROM integration_pending_actions a
                LEFT JOIN integration_configs i ON a.integration_id = i.id
                WHERE a.organization_id = ?
                AND a.status = 'pending'
                AND (a.expires_at IS NULL OR a.expires_at > datetime('now'))
            `;
            const params = [organizationId];

            if (projectId) {
                sql += ` AND a.project_id = ?`;
                params.push(projectId);
            }

            sql += ` ORDER BY a.created_at DESC`;

            deps.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else {
                    resolve((rows || []).map(row => ({
                        ...row,
                        payload: row.payload ? JSON.parse(row.payload) : {}
                    })));
                }
            });
        });
    },

    /**
     * Approve a pending action
     */
    approveAction: async (actionId, approvedBy) => {
        return new Promise((resolve, reject) => {
            deps.db.run(`
                UPDATE integration_pending_actions 
                SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP
                WHERE id = ? AND status = 'pending'
            `, [approvedBy, actionId], function (err) {
                if (err) reject(err);
                else if (this.changes === 0) {
                    reject(new Error('Action not found or already processed'));
                } else {
                    resolve({ actionId, status: 'approved', approvedBy });
                }
            });
        });
    },

    /**
     * Reject a pending action
     */
    rejectAction: async (actionId, rejectedBy, reason = null) => {
        return new Promise((resolve, reject) => {
            deps.db.run(`
                UPDATE integration_pending_actions 
                SET status = 'rejected', approved_by = ?, approved_at = CURRENT_TIMESTAMP, rejected_reason = ?
                WHERE id = ? AND status = 'pending'
            `, [rejectedBy, reason, actionId], function (err) {
                if (err) reject(err);
                else if (this.changes === 0) {
                    reject(new Error('Action not found or already processed'));
                } else {
                    resolve({ actionId, status: 'rejected', rejectedBy, reason });
                }
            });
        });
    },

    /**
     * Execute an approved action
     * NOTE: Actual execution is stubbed - requires provider-specific implementation
     */
    executeAction: async (actionId, executedBy) => {
        // 1. Get the action
        const action = await new Promise((resolve) => {
            deps.db.get(`
                SELECT a.*, i.provider, i.config
                FROM integration_pending_actions a
                JOIN integration_configs i ON a.integration_id = i.id
                WHERE a.id = ? AND a.status = 'approved'
            `, [actionId], (err, row) => {
                resolve(row);
            });
        });

        if (!action) {
            throw new Error('Action not found or not approved');
        }

        // 2. Execute based on provider (STUBBED - actual implementation per provider)
        let result;
        try {
            result = await AIIntegrationService._executeProviderAction(action);
        } catch (error) {
            // Log failure
            await AIIntegrationService._logSync({
                integrationId: action.integration_id,
                direction: 'outbound',
                actionType: action.action_type,
                internalEntityType: action.target_entity_type,
                internalEntityId: action.target_entity_id,
                status: 'failed',
                errorMessage: error.message
            });

            // Update action status
            await new Promise((resolve) => {
                deps.db.run(`
                    UPDATE integration_pending_actions 
                    SET status = 'failed', execution_result = ?, executed_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [JSON.stringify({ error: error.message }), actionId], resolve);
            });

            throw error;
        }

        // 3. Log success
        await AIIntegrationService._logSync({
            integrationId: action.integration_id,
            direction: 'outbound',
            actionType: action.action_type,
            externalId: result.externalId,
            externalUrl: result.externalUrl,
            internalEntityType: action.target_entity_type,
            internalEntityId: action.target_entity_id,
            status: 'success',
            syncData: result
        });

        // 4. Update action status
        await new Promise((resolve) => {
            deps.db.run(`
                UPDATE integration_pending_actions 
                SET status = 'executed', execution_result = ?, executed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [JSON.stringify(result), actionId], resolve);
        });

        return { actionId, status: 'executed', result };
    },

    /**
     * Stubbed provider action execution
     * To be implemented per provider
     */
    _executeProviderAction: async (action) => {
        const payload = action.payload ? JSON.parse(action.payload) : {};
        const provider = action.provider;

        // STUB: In production, this would call actual provider APIs
        console.log(`[AIIntegration] Would execute ${action.action_type} on ${provider}:`, payload);

        // Return mock result
        return {
            success: true,
            externalId: `${provider}-${deps.uuidv4().substring(0, 8)}`,
            externalUrl: `https://${provider}.example.com/item/${Date.now()}`,
            syncedAt: new Date().toISOString()
        };
    },

    // ==========================================
    // INBOUND WEBHOOK HANDLING
    // ==========================================

    /**
     * Handle incoming webhook from external system
     */
    handleWebhook: async (provider, webhookData, signature = null) => {
        // 1. Find matching integration
        const integration = await new Promise((resolve) => {
            deps.db.get(`
                SELECT * FROM integration_configs 
                WHERE provider = ? AND is_active = 1
                LIMIT 1
            `, [provider], (err, row) => resolve(row));
        });

        if (!integration) {
            return { handled: false, reason: 'No active integration found' };
        }

        // 2. Verify signature if configured (STUBBED)
        // In production, verify webhook signature with integration.webhook_secret

        // 3. Log inbound sync
        await AIIntegrationService._logSync({
            integrationId: integration.id,
            direction: 'inbound',
            actionType: 'webhook_received',
            externalId: webhookData.id || webhookData.key,
            status: 'success',
            syncData: webhookData
        });

        // 4. Process based on provider and event type (STUBBED)
        // In production, map webhook events to internal actions

        return {
            handled: true,
            integrationId: integration.id,
            message: 'Webhook processed'
        };
    },

    // ==========================================
    // SYNC LOGGING
    // ==========================================

    /**
     * Log a sync operation
     */
    _logSync: async ({ integrationId, direction, actionType, externalId, externalUrl, internalEntityType, internalEntityId, status, errorMessage, syncData }) => {
        const id = deps.uuidv4();

        return new Promise((resolve) => {
            deps.db.run(`
                INSERT INTO integration_sync_log 
                (id, integration_id, direction, action_type, external_id, external_url, 
                 internal_entity_type, internal_entity_id, status, error_message, sync_data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id, integrationId, direction, actionType, externalId, externalUrl,
                internalEntityType, internalEntityId, status, errorMessage,
                syncData ? JSON.stringify(syncData) : null
            ], (err) => {
                resolve({ id, logged: !err });
            });
        });
    },

    /**
     * Get sync history
     */
    getSyncHistory: async (integrationId, options = {}) => {
        const { direction, status, limit = 50 } = options;

        return new Promise((resolve, reject) => {
            let sql = `SELECT * FROM integration_sync_log WHERE integration_id = ?`;
            const params = [integrationId];

            if (direction) {
                sql += ` AND direction = ?`;
                params.push(direction);
            }
            if (status) {
                sql += ` AND status = ?`;
                params.push(status);
            }

            sql += ` ORDER BY created_at DESC LIMIT ?`;
            params.push(limit);

            deps.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else {
                    resolve((rows || []).map(row => ({
                        ...row,
                        sync_data: row.sync_data ? JSON.parse(row.sync_data) : null
                    })));
                }
            });
        });
    },

    // ==========================================
    // PROVIDER CAPABILITY CHECK
    // ==========================================

    /**
     * Get supported actions for a provider
     */
    getProviderCapabilities: (provider) => {
        const capabilities = {
            // Task sync providers
            jira: [ACTION_TYPES.CREATE_TASK, ACTION_TYPES.UPDATE_TASK, ACTION_TYPES.SYNC_STATUS],
            clickup: [ACTION_TYPES.CREATE_TASK, ACTION_TYPES.UPDATE_TASK, ACTION_TYPES.SYNC_STATUS],
            asana: [ACTION_TYPES.CREATE_TASK, ACTION_TYPES.UPDATE_TASK, ACTION_TYPES.SYNC_STATUS],
            monday: [ACTION_TYPES.CREATE_TASK, ACTION_TYPES.UPDATE_TASK, ACTION_TYPES.SYNC_STATUS],
            trello: [ACTION_TYPES.CREATE_TASK, ACTION_TYPES.UPDATE_TASK],

            // Notification providers
            slack: [ACTION_TYPES.SEND_NOTIFICATION],
            teams: [ACTION_TYPES.SEND_NOTIFICATION],
            email: [ACTION_TYPES.SEND_NOTIFICATION],
            webhook: [ACTION_TYPES.SEND_NOTIFICATION],

            // Calendar providers
            google_calendar: [ACTION_TYPES.CREATE_EVENT],
            outlook: [ACTION_TYPES.CREATE_EVENT],

            // Document providers
            confluence: [ACTION_TYPES.SYNC_DOCUMENT],
            sharepoint: [ACTION_TYPES.SYNC_DOCUMENT],
            notion: [ACTION_TYPES.SYNC_DOCUMENT]
        };

        return capabilities[provider] || [];
    },

    /**
     * Check if integration is ready for use
     */
    checkIntegrationHealth: async (integrationId) => {
        return new Promise((resolve) => {
            deps.db.get(`
                SELECT ic.*, 
                    (SELECT COUNT(*) FROM integration_sync_log WHERE integration_id = ic.id AND status = 'failed' AND created_at > datetime('now', '-24 hours')) as recent_failures
                FROM integration_configs ic
                WHERE ic.id = ?
            `, [integrationId], (err, row) => {
                if (!row) {
                    resolve({ healthy: false, reason: 'Integration not found' });
                    return;
                }

                const healthy = row.is_active && row.recent_failures < 5;
                resolve({
                    healthy,
                    isActive: !!row.is_active,
                    recentFailures: row.recent_failures,
                    lastSyncAt: row.last_sync_at,
                    provider: row.provider,
                    integrationTyp: row.integration_type
                });
            });
        });
    }
};

module.exports = AIIntegrationService;
