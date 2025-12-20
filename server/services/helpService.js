/**
 * Help Service
 * 
 * Central service for the In-App Help + Training + Playbooks system.
 * Provides context-aware help based on AccessPolicy, user role, and current state.
 * 
 * Step 6: Enterprise+ Ready
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const MetricsCollector = require('./metricsCollector');

/**
 * Event types for help interactions (append-only)
 */
const EVENT_TYPES = {
    VIEWED: 'VIEWED',
    STARTED: 'STARTED',
    COMPLETED: 'COMPLETED',
    DISMISSED: 'DISMISSED'
};

/**
 * Valid roles for targeting playbooks
 */
const TARGET_ROLES = ['ADMIN', 'USER', 'SUPERADMIN', 'PARTNER', 'ANY'];

/**
 * Valid org types for targeting playbooks  
 */
const TARGET_ORG_TYPES = ['DEMO', 'TRIAL', 'PAID', 'ANY'];

const HelpService = {
    EVENT_TYPES,
    TARGET_ROLES,
    TARGET_ORG_TYPES,

    /**
     * Get available playbooks for a given context
     * Filters by org_type, role, and active status
     * 
     * @param {Object} context - Context object
     * @param {string} context.orgType - DEMO | TRIAL | PAID
     * @param {string} context.role - User role
     * @param {string} context.userId - User ID (for progress)
     * @param {string} context.organizationId - Organization ID
     * @returns {Promise<Array>} - Filtered playbooks
     */
    getAvailablePlaybooks: async ({ orgType, role, userId, organizationId }) => {
        return new Promise((resolve, reject) => {
            // Build SQL query to match org type and role
            // 'ANY' matches all, or specific match
            const sql = `
                SELECT p.*, 
                    (SELECT COUNT(*) FROM help_events e 
                     WHERE e.playbook_key = p.key 
                     AND e.user_id = ? 
                     AND e.organization_id = ?
                     AND e.event_type = 'COMPLETED') as completion_count,
                    (SELECT COUNT(*) FROM help_events e 
                     WHERE e.playbook_key = p.key 
                     AND e.user_id = ? 
                     AND e.organization_id = ?
                     AND e.event_type = 'DISMISSED') as dismiss_count
                FROM help_playbooks p
                WHERE p.is_active = 1
                AND (p.target_org_type = ? OR p.target_org_type = 'ANY')
                AND (p.target_role = ? OR p.target_role = 'ANY')
                ORDER BY p.priority ASC, p.created_at ASC
            `;

            db.all(sql, [userId, organizationId, userId, organizationId, orgType, role], (err, rows) => {
                if (err) return reject(err);

                // Transform rows and compute status
                const playbooks = (rows || []).map(row => ({
                    id: row.id,
                    key: row.key,
                    title: row.title,
                    description: row.description,
                    targetRole: row.target_role,
                    targetOrgType: row.target_org_type,
                    priority: row.priority,
                    isActive: !!row.is_active,
                    createdAt: row.created_at,
                    // User progress
                    isCompleted: row.completion_count > 0,
                    isDismissed: row.dismiss_count > 0,
                    status: row.completion_count > 0 ? 'COMPLETED' :
                        row.dismiss_count > 0 ? 'DISMISSED' : 'AVAILABLE'
                }));

                resolve(playbooks);
            });
        });
    },

    /**
     * Get a specific playbook by key with all its steps
     * 
     * @param {string} key - Playbook unique key
     * @returns {Promise<Object|null>} - Playbook with steps or null
     */
    getPlaybook: async (key) => {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM help_playbooks WHERE key = ?`,
                [key],
                async (err, playbook) => {
                    if (err) return reject(err);
                    if (!playbook) return resolve(null);

                    // Fetch steps
                    db.all(
                        `SELECT * FROM help_steps 
                         WHERE playbook_id = ? 
                         ORDER BY step_order ASC`,
                        [playbook.id],
                        (stepsErr, steps) => {
                            if (stepsErr) return reject(stepsErr);

                            resolve({
                                id: playbook.id,
                                key: playbook.key,
                                title: playbook.title,
                                description: playbook.description,
                                targetRole: playbook.target_role,
                                targetOrgType: playbook.target_org_type,
                                priority: playbook.priority,
                                isActive: !!playbook.is_active,
                                createdAt: playbook.created_at,
                                steps: (steps || []).map(step => ({
                                    id: step.id,
                                    stepOrder: step.step_order,
                                    title: step.title,
                                    contentMd: step.content_md,
                                    uiTarget: step.ui_target,
                                    actionType: step.action_type,
                                    actionPayload: JSON.parse(step.action_payload || '{}')
                                }))
                            });
                        }
                    );
                }
            );
        });
    },

    /**
     * Get playbook by ID
     * 
     * @param {string} id - Playbook ID (UUID)
     * @returns {Promise<Object|null>}
     */
    getPlaybookById: async (id) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM help_playbooks WHERE id = ?`, [id], (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);
                resolve({
                    id: row.id,
                    key: row.key,
                    title: row.title,
                    description: row.description,
                    targetRole: row.target_role,
                    targetOrgType: row.target_org_type,
                    priority: row.priority,
                    isActive: !!row.is_active,
                    createdAt: row.created_at
                });
            });
        });
    },

    /**
     * Mark an event (append-only - no updates or deletes)
     * 
     * @param {string} userId - User ID
     * @param {string} organizationId - Organization ID
     * @param {string} playbookKey - Playbook key
     * @param {string} eventType - VIEWED | STARTED | COMPLETED | DISMISSED
     * @param {Object} context - Additional context (route, feature, etc.)
     * @returns {Promise<Object>} - Created event
     */
    markEvent: async (userId, organizationId, playbookKey, eventType, context = {}) => {
        if (!Object.values(EVENT_TYPES).includes(eventType)) {
            throw new Error(`Invalid event type: ${eventType}`);
        }

        const id = uuidv4();
        const contextJson = JSON.stringify(context);

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO help_events (id, user_id, organization_id, playbook_key, event_type, context)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [id, userId, organizationId, playbookKey, eventType, contextJson],
                async function (err) {
                    if (err) return reject(err);

                    // Step 7: Record metrics event for conversion intelligence
                    try {
                        if (eventType === EVENT_TYPES.STARTED) {
                            await MetricsCollector.recordEvent(MetricsCollector.EVENT_TYPES.HELP_STARTED, {
                                userId,
                                organizationId,
                                source: MetricsCollector.SOURCE_TYPES.HELP,
                                context: { playbookKey, ...context }
                            });
                        } else if (eventType === EVENT_TYPES.COMPLETED) {
                            await MetricsCollector.recordEvent(MetricsCollector.EVENT_TYPES.HELP_COMPLETED, {
                                userId,
                                organizationId,
                                source: MetricsCollector.SOURCE_TYPES.HELP,
                                context: { playbookKey, ...context }
                            });
                        }
                    } catch (metricsErr) {
                        console.warn('[HelpService] Metrics recording failed:', metricsErr);
                    }

                    resolve({
                        id,
                        userId,
                        organizationId,
                        playbookKey,
                        eventType,
                        context,
                        createdAt: new Date().toISOString()
                    });
                }
            );
        });
    },

    /**
     * Get user progress for a specific playbook
     * 
     * @param {string} userId - User ID
     * @param {string} organizationId - Organization ID
     * @param {string} playbookKey - Playbook key
     * @returns {Promise<Object>} - Progress info
     */
    getUserProgress: async (userId, organizationId, playbookKey) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT event_type, COUNT(*) as count, MAX(created_at) as last_at
                 FROM help_events
                 WHERE user_id = ? AND organization_id = ? AND playbook_key = ?
                 GROUP BY event_type`,
                [userId, organizationId, playbookKey],
                (err, rows) => {
                    if (err) return reject(err);

                    const events = {};
                    (rows || []).forEach(row => {
                        events[row.event_type] = {
                            count: row.count,
                            lastAt: row.last_at
                        };
                    });

                    resolve({
                        playbookKey,
                        isViewed: !!events.VIEWED,
                        isStarted: !!events.STARTED,
                        isCompleted: !!events.COMPLETED,
                        isDismissed: !!events.DISMISSED,
                        events
                    });
                }
            );
        });
    },

    /**
     * Get playbook analytics (admin/superadmin)
     * 
     * @param {string} playbookKey - Optional filter by key
     * @param {Object} options - Query options
     * @returns {Promise<Array>} - Analytics data
     */
    getPlaybookStats: async (playbookKey = null, options = {}) => {
        const { days = 30 } = options;

        return new Promise((resolve, reject) => {
            let sql = `
                SELECT 
                    playbook_key,
                    event_type,
                    COUNT(*) as count,
                    COUNT(DISTINCT user_id) as unique_users,
                    COUNT(DISTINCT organization_id) as unique_orgs
                FROM help_events
                WHERE created_at >= datetime('now', '-${days} days')
            `;
            const params = [];

            if (playbookKey) {
                sql += ` AND playbook_key = ?`;
                params.push(playbookKey);
            }

            sql += ` GROUP BY playbook_key, event_type ORDER BY playbook_key, event_type`;

            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    // ==========================================
    // CRUD Operations (SuperAdmin)
    // ==========================================

    /**
     * Create a new playbook
     * 
     * @param {Object} data - Playbook data
     * @returns {Promise<Object>} - Created playbook
     */
    createPlaybook: async ({ key, title, description, targetRole = 'ANY', targetOrgType = 'ANY', priority = 3 }) => {
        if (!key || !title) {
            throw new Error('key and title are required');
        }

        if (!TARGET_ROLES.includes(targetRole)) {
            throw new Error(`Invalid target_role: ${targetRole}`);
        }

        if (!TARGET_ORG_TYPES.includes(targetOrgType)) {
            throw new Error(`Invalid target_org_type: ${targetOrgType}`);
        }

        const id = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO help_playbooks (id, key, title, description, target_role, target_org_type, priority)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [id, key, title, description, targetRole, targetOrgType, priority],
                function (err) {
                    if (err) {
                        if (err.message.includes('UNIQUE constraint failed')) {
                            return reject(new Error(`Playbook with key '${key}' already exists`));
                        }
                        return reject(err);
                    }

                    resolve({
                        id,
                        key,
                        title,
                        description,
                        targetRole,
                        targetOrgType,
                        priority,
                        isActive: true
                    });
                }
            );
        });
    },

    /**
     * Update an existing playbook
     * 
     * @param {string} id - Playbook ID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} - Updated playbook
     */
    updatePlaybook: async (id, updates) => {
        const allowedFields = ['title', 'description', 'target_role', 'target_org_type', 'priority', 'is_active'];
        const fieldMap = {
            title: 'title',
            description: 'description',
            targetRole: 'target_role',
            targetOrgType: 'target_org_type',
            priority: 'priority',
            isActive: 'is_active'
        };

        const setClauses = [];
        const values = [];

        Object.entries(updates).forEach(([key, value]) => {
            const dbField = fieldMap[key];
            if (dbField && allowedFields.includes(dbField)) {
                setClauses.push(`${dbField} = ?`);
                values.push(key === 'isActive' ? (value ? 1 : 0) : value);
            }
        });

        if (setClauses.length === 0) {
            throw new Error('No valid fields to update');
        }

        values.push(id);

        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE help_playbooks SET ${setClauses.join(', ')} WHERE id = ?`,
                values,
                async function (err) {
                    if (err) return reject(err);
                    if (this.changes === 0) {
                        return reject(new Error('Playbook not found'));
                    }

                    const updated = await HelpService.getPlaybookById(id);
                    resolve(updated);
                }
            );
        });
    },

    /**
     * Add a step to a playbook
     * 
     * @param {Object} data - Step data
     * @returns {Promise<Object>} - Created step
     */
    createStep: async ({ playbookId, stepOrder, title, contentMd, uiTarget = null, actionType = 'INFO', actionPayload = {} }) => {
        if (!playbookId || !title || !contentMd) {
            throw new Error('playbookId, title, and contentMd are required');
        }

        const validActionTypes = ['INFO', 'CTA', 'LINK'];
        if (!validActionTypes.includes(actionType)) {
            throw new Error(`Invalid action_type: ${actionType}`);
        }

        const id = uuidv4();
        const payloadJson = JSON.stringify(actionPayload);

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO help_steps (id, playbook_id, step_order, title, content_md, ui_target, action_type, action_payload)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, playbookId, stepOrder, title, contentMd, uiTarget, actionType, payloadJson],
                function (err) {
                    if (err) return reject(err);

                    resolve({
                        id,
                        playbookId,
                        stepOrder,
                        title,
                        contentMd,
                        uiTarget,
                        actionType,
                        actionPayload
                    });
                }
            );
        });
    },

    /**
     * List all playbooks (admin view)
     * 
     * @returns {Promise<Array>}
     */
    listAllPlaybooks: async () => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT p.*, 
                    (SELECT COUNT(*) FROM help_steps WHERE playbook_id = p.id) as step_count,
                    (SELECT COUNT(*) FROM help_events WHERE playbook_key = p.key) as event_count
                 FROM help_playbooks p
                 ORDER BY p.priority ASC, p.created_at DESC`,
                [],
                (err, rows) => {
                    if (err) return reject(err);
                    resolve((rows || []).map(row => ({
                        id: row.id,
                        key: row.key,
                        title: row.title,
                        description: row.description,
                        targetRole: row.target_role,
                        targetOrgType: row.target_org_type,
                        priority: row.priority,
                        isActive: !!row.is_active,
                        createdAt: row.created_at,
                        stepCount: row.step_count,
                        eventCount: row.event_count
                    })));
                }
            );
        });
    }
};

module.exports = HelpService;
