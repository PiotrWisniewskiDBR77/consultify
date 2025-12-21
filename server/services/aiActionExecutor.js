// AI Action Executor - Handles AI actions with approval workflow
// AI Core Layer — Enterprise PMO Brain

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const AIPolicyEngine = require('./aiPolicyEngine');
const AIRoleGuard = require('./aiRoleGuard');
const RegulatoryModeGuard = require('./regulatoryModeGuard');

// Dependency injection container (for deterministic unit tests)
const deps = {
    db,
    uuidv4,
    AIPolicyEngine,
    AIRoleGuard,
    RegulatoryModeGuard
};

const ACTION_TYPES = {
    CREATE_DRAFT_TASK: 'CREATE_DRAFT_TASK',
    CREATE_DRAFT_INITIATIVE: 'CREATE_DRAFT_INITIATIVE',
    SUGGEST_ROADMAP_CHANGE: 'SUGGEST_ROADMAP_CHANGE',
    GENERATE_REPORT: 'GENERATE_REPORT',
    PREPARE_DECISION_SUMMARY: 'PREPARE_DECISION_SUMMARY',
    EXPLAIN_CONTEXT: 'EXPLAIN_CONTEXT',
    ANALYZE_RISKS: 'ANALYZE_RISKS'
};

const ACTION_STATUS = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    EXECUTED: 'EXECUTED'
};

const AIActionExecutor = {
    ACTION_TYPES,
    ACTION_STATUS,

    // For testing: allow overriding dependencies
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },

    /**
     * Request an AI action
     */
    requestAction: async (actionType, payload, userId, organizationId, projectId = null) => {
        // 0. REGULATORY MODE: Block ALL mutation actions (highest priority)
        if (projectId) {
            const regulatoryCheck = await deps.RegulatoryModeGuard.enforceRegulatoryMode(
                { userId, organizationId, projectId },
                actionType
            );

            if (regulatoryCheck.blocked) {
                return {
                    success: false,
                    blocked: true,
                    error: regulatoryCheck.message || 'Action blocked by Regulatory Mode',
                    reason: regulatoryCheck.reason,
                    regulatoryModeEnabled: true,
                    suggestion: 'Regulatory Mode is enabled. AI can only explain and advise. Disable Regulatory Mode in Project Governance settings to allow AI actions.'
                };
            }
        }

        // AI Roles Model: Check if action is blocked by project role
        if (projectId) {
            const roleCheck = await deps.AIRoleGuard.isActionBlocked(projectId, actionType);
            if (roleCheck.blocked) {
                return {
                    success: false,
                    blocked: true,
                    error: roleCheck.reason,
                    currentRole: roleCheck.currentRole,
                    requiredRole: roleCheck.roleRequired,
                    suggestion: roleCheck.suggestion
                };
            }

            // For MANAGER role, force requiresApproval regardless of policy level
            if (roleCheck.requiresApproval) {
                payload._forceApproval = true;
            }
        }

        // Check if action is allowed by policy level
        const permission = await deps.AIPolicyEngine.canPerformAction(actionType, organizationId, projectId, userId);

        if (!permission.allowed) {
            return {
                success: false,
                error: permission.reason,
                requiresUpgrade: true
            };
        }

        // AI Roles Model: MANAGER role always requires approval for draft actions
        // Normalize to boolean (avoid `false || undefined` => undefined)
        const requiresApproval = Boolean(permission.requiresApproval || payload._forceApproval);

        const id = deps.uuidv4();

        return new Promise((resolve, reject) => {
            deps.db.run(`INSERT INTO ai_actions 
                (id, user_id, organization_id, project_id, action_type, payload, 
                 required_policy_level, current_policy_level, requires_approval, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, userId, organizationId, projectId, actionType,
                    JSON.stringify(payload),
                    permission.requiredLevel, permission.currentLevel,
                    requiresApproval ? 1 : 0,
                    requiresApproval ? ACTION_STATUS.PENDING : ACTION_STATUS.APPROVED
                ], function (err) {
                    if (err) return reject(err);

                    resolve({
                        success: true,
                        actionId: id,
                        requiresApproval: requiresApproval,
                        status: requiresApproval ? ACTION_STATUS.PENDING : ACTION_STATUS.APPROVED
                    });
                });
        });
    },

    /**
     * Create a draft (task/initiative)
     */
    createDraft: async (draftType, draftContent, userId, organizationId, projectId) => {
        const actionType = draftType === 'task'
            ? ACTION_TYPES.CREATE_DRAFT_TASK
            : ACTION_TYPES.CREATE_DRAFT_INITIATIVE;

        const result = await AIActionExecutor.requestAction(
            actionType,
            { draftType, content: draftContent },
            userId, organizationId, projectId
        );

        if (result.success) {
            // Store draft content
            await new Promise((resolve, reject) => {
                deps.db.run(`UPDATE ai_actions SET draft_content = ? WHERE id = ?`,
                    [JSON.stringify(draftContent), result.actionId], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
            });
        }

        return result;
    },

    /**
     * Approve an action
     */
    approveAction: async (actionId, userId) => {
        return new Promise((resolve, reject) => {
            deps.db.run(`UPDATE ai_actions 
                    SET status = 'APPROVED', approved_at = CURRENT_TIMESTAMP, approved_by = ?
                    WHERE id = ? AND status = 'PENDING'`,
                [userId, actionId], function (err) {
                    if (err) return reject(err);

                    if (this.changes === 0) {
                        return resolve({ success: false, error: 'Action not found or already processed' });
                    }

                    resolve({ success: true, actionId, status: ACTION_STATUS.APPROVED });
                });
        });
    },

    /**
     * Reject an action
     */
    rejectAction: async (actionId, userId, reason = null) => {
        return new Promise((resolve, reject) => {
            deps.db.run(`UPDATE ai_actions 
                    SET status = 'REJECTED', approved_at = CURRENT_TIMESTAMP, approved_by = ?
                    WHERE id = ? AND status = 'PENDING'`,
                [userId, actionId], function (err) {
                    if (err) return reject(err);

                    if (this.changes === 0) {
                        return resolve({ success: false, error: 'Action not found or already processed' });
                    }

                    // Log audit
                    AIActionExecutor._logAudit(actionId, userId, 'REJECTED', reason);

                    resolve({ success: true, actionId, status: ACTION_STATUS.REJECTED });
                });
        });
    },

    /**
     * Execute an approved action
     */
    executeAction: async (actionId, userId) => {
        // Get action
        const action = await new Promise((resolve, reject) => {
            deps.db.get(`SELECT * FROM ai_actions WHERE id = ?`, [actionId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!action) {
            return { success: false, error: 'Action not found' };
        }

        if (action.status !== ACTION_STATUS.APPROVED) {
            return { success: false, error: `Action is ${action.status}, not APPROVED` };
        }

        // Execute based on type
        let result = null;
        try {
            const payload = JSON.parse(action.payload || '{}');
            const draftContent = action.draft_content ? JSON.parse(action.draft_content) : null;

            switch (action.action_type) {
                case ACTION_TYPES.CREATE_DRAFT_TASK:
                    result = await AIActionExecutor._executeCreateTask(draftContent, action);
                    break;
                case ACTION_TYPES.CREATE_DRAFT_INITIATIVE:
                    result = await AIActionExecutor._executeCreateInitiative(draftContent, action);
                    break;
                case ACTION_TYPES.GENERATE_REPORT:
                    result = { reportGenerated: true, content: draftContent };
                    break;
                default:
                    result = { executed: true, actionType: action.action_type };
            }

            // Mark as executed
            await new Promise((resolve, reject) => {
                deps.db.run(`UPDATE ai_actions SET status = 'EXECUTED', executed_at = CURRENT_TIMESTAMP WHERE id = ?`,
                    [actionId], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
            });

            return { success: true, actionId, result };
        } catch (err) {
            return { success: false, error: err.message };
        }
    },

    /**
     * Get pending actions for user/project
     */
    getPendingActions: async (userId = null, projectId = null, organizationId = null) => {
        return new Promise((resolve, reject) => {
            let sql = `SELECT * FROM ai_actions WHERE status = 'PENDING'`;
            const params = [];

            if (userId) {
                sql += ` AND user_id = ?`;
                params.push(userId);
            }
            if (projectId) {
                sql += ` AND project_id = ?`;
                params.push(projectId);
            }
            if (organizationId) {
                sql += ` AND organization_id = ?`;
                params.push(organizationId);
            }

            sql += ` ORDER BY created_at DESC`;

            deps.db.all(sql, params, (err, rows) => {
                if (err) return reject(err);

                const result = (rows || []).map(row => {
                    try {
                        row.payload = JSON.parse(row.payload || '{}');
                        row.draftContent = row.draft_content ? JSON.parse(row.draft_content) : null;
                    } catch { }
                    return row;
                });

                resolve(result);
            });
        });
    },

    // ==================== INTERNAL EXECUTORS ====================

    _executeCreateTask: async (draftContent, action) => {
        const taskId = deps.uuidv4();
        const { title, description, assigneeId, dueDate } = draftContent;

        await new Promise((resolve, reject) => {
            deps.db.run(`INSERT INTO tasks (id, project_id, title, description, assignee_id, due_date, status, created_by)
                    VALUES (?, ?, ?, ?, ?, ?, 'TODO', ?)`,
                [taskId, action.project_id, title, description, assigneeId, dueDate, action.user_id], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
        });

        return { taskId, title, created: true };
    },

    _executeCreateInitiative: async (draftContent, action) => {
        const initiativeId = deps.uuidv4();
        const { name, description, ownerId, priority } = draftContent;

        await new Promise((resolve, reject) => {
            deps.db.run(`INSERT INTO initiatives (id, project_id, name, description, owner_business_id, priority, status)
                    VALUES (?, ?, ?, ?, ?, ?, 'DRAFT')`,
                [initiativeId, action.project_id, name, description, ownerId, priority || 'MEDIUM'], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
        });

        return { initiativeId, name, created: true };
    },

    _logAudit: async (actionId, userId, decision, feedback = null) => {
        // Get action for context
        const action = await new Promise((resolve, reject) => {
            deps.db.get(`SELECT * FROM ai_actions WHERE id = ?`, [actionId], (err, row) => {
                if (err) reject(err);
                else resolve(row || {});
            });
        });

        const auditId = deps.uuidv4();

        return new Promise((resolve, reject) => {
            deps.db.run(`INSERT INTO ai_audit_logs 
                (id, user_id, organization_id, project_id, action_type, action_description, 
                 ai_role, policy_level, user_decision, user_feedback)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    auditId, userId, action.organization_id, action.project_id,
                    action.action_type, `AI action: ${action.action_type}`,
                    'EXECUTOR', action.current_policy_level,
                    decision, feedback
                ], (err) => {
                    if (err) reject(err);
                    else resolve({ auditId });
                });
        });
    }
};

module.exports = AIActionExecutor;
