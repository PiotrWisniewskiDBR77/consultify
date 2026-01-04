// AI Action Executor - Handles AI actions with approval workflow
// AI Core Layer — Enterprise PMO Brain
// Enhanced with HITL Learning System - learns from user approval/rejection patterns

// Dependency injection container (for deterministic unit tests)
const deps = {
    _db: null,
    _uuidv4: null,
    _AIPolicyEngine: null,
    _AIRoleGuard: null,
    _RegulatoryModeGuard: null,
    _ApprovalPatternService: null,
    _NotificationService: null,

    get db() { return this._db; },
    set db(val) { this._db = val; },

    get uuidv4() { return this._uuidv4; },
    set uuidv4(val) { this._uuidv4 = val; },

    get AIPolicyEngine() { return this._AIPolicyEngine; },
    set AIPolicyEngine(val) { this._AIPolicyEngine = val; },

    get AIRoleGuard() { return this._AIRoleGuard; },
    set AIRoleGuard(val) { this._AIRoleGuard = val; },

    get RegulatoryModeGuard() { return this._RegulatoryModeGuard; },
    set RegulatoryModeGuard(val) { this._RegulatoryModeGuard = val; },

    get ApprovalPatternService() { return this._ApprovalPatternService; },
    set ApprovalPatternService(val) { this._ApprovalPatternService = val; },

    getNotificationService: async () => {
        if (!deps._NotificationService) {
            try {
                const { default: service } = await import('./notificationService.js');
                deps._NotificationService = service;
            } catch (e) {
                console.warn('[AIActionExecutor] NotificationService not available');
            }
        }
        return deps._NotificationService;
    }
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps._db) {
        const { default: db } = await import('../src/database/Database.ts');
        deps._db = db;
    }
    if (!deps._uuidv4) {
        const { v4 } = await import('uuid');
        deps._uuidv4 = v4;
    }
    if (!deps._AIPolicyEngine) {
        const { default: service } = await import('./aiPolicyEngine.js');
        deps._AIPolicyEngine = service;
    }
    if (!deps._AIRoleGuard) {
        const { default: service } = await import('./aiRoleGuard.js');
        deps._AIRoleGuard = service;
    }
    if (!deps._RegulatoryModeGuard) {
        const { default: service } = await import('./regulatoryModeGuard.js');
        deps._RegulatoryModeGuard = service;
    }
    if (!deps._ApprovalPatternService) {
        const { default: service } = await import('./approvalPatternService.js');
        deps._ApprovalPatternService = service;
    }
}

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
        if (newDeps.db) deps.db = newDeps.db;
        if (newDeps.uuidv4) deps.uuidv4 = newDeps.uuidv4;
        if (newDeps.AIPolicyEngine) deps.AIPolicyEngine = newDeps.AIPolicyEngine;
        if (newDeps.AIRoleGuard) deps.AIRoleGuard = newDeps.AIRoleGuard;
        if (newDeps.RegulatoryModeGuard) deps.RegulatoryModeGuard = newDeps.RegulatoryModeGuard;
        if (newDeps.ApprovalPatternService) deps.ApprovalPatternService = newDeps.ApprovalPatternService;
        if (newDeps.NotificationService) deps._NotificationService = newDeps.NotificationService;
    },

    /**
     * Request an AI action
     */
    requestAction: async (actionType, payload, userId, organizationId, projectId = null) => {
        await initDeps();
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
        let requiresApproval = Boolean(permission.requiresApproval || payload._forceApproval);

        // HITL Learning System: Check if we can auto-decide based on learned patterns
        let autoDecided = false;
        let autoDecision = null;
        let patternInfo = null;
        
        if (requiresApproval) {
            const riskLevel = payload.riskLevel || 'LOW';
            const autoDecideCheck = await deps.ApprovalPatternService.canAutoDecide(
                userId, actionType, payload, riskLevel
            );
            
            if (autoDecideCheck.canAutoDecide) {
                autoDecided = true;
                autoDecision = autoDecideCheck.decision;
                patternInfo = {
                    patternId: autoDecideCheck.pattern?.id,
                    confidence: autoDecideCheck.confidence,
                    decisionCount: autoDecideCheck.pattern?.decision_count,
                    reason: autoDecideCheck.reason
                };
                
                console.log(`[AIActionExecutor] Auto-decided ${actionType}: ${autoDecision} (confidence: ${Math.round(autoDecideCheck.confidence * 100)}%)`);
                
                // If auto-rejected, don't create the action
                if (autoDecision === 'REJECTED') {
                    return {
                        success: false,
                        autoRejected: true,
                        blocked: true,
                        reason: `Auto-rejected based on learned pattern (${patternInfo.decisionCount} previous rejections)`,
                        patternInfo
                    };
                }
                
                // If auto-approved, skip the pending state
                requiresApproval = false;
            }
        }

        await initDeps();
        const id = deps.uuidv4();
        const finalStatus = requiresApproval ? ACTION_STATUS.PENDING : ACTION_STATUS.APPROVED;

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
                    finalStatus
                ], function (err) {
                    if (err) return reject(err);

                    const result = {
                        success: true,
                        actionId: id,
                        requiresApproval: requiresApproval,
                        status: finalStatus
                    };
                    
                    // Include auto-decision info in response
                    if (autoDecided) {
                        result.autoApproved = true;
                        result.patternInfo = patternInfo;
                    }
                    
                    // Send notification for pending actions
                    if (requiresApproval && finalStatus === ACTION_STATUS.PENDING) {
                        AIActionExecutor._sendPendingActionNotification(
                            id, userId, organizationId, projectId, actionType, payload
                        ).catch(err => {
                            console.warn('[AIActionExecutor] Failed to send notification:', err.message);
                        });
                    }

                    resolve(result);
                });
        });
    },

    /**
     * Create a draft (task/initiative)
     */
    createDraft: async (draftType, draftContent, userId, organizationId, projectId) => {
        await initDeps();
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
     * @param {string} actionId - Action ID to approve
     * @param {string} userId - User ID approving the action
     * @param {object} options - Options: { alwaysApprove: boolean } - Enable auto-apply for similar actions
     */
    approveAction: async (actionId, userId, options = {}) => {
        await initDeps();
        // First, get the action details for pattern learning
        const action = await AIActionExecutor.getAction(actionId);
        if (!action) {
            return { success: false, error: 'Action not found' };
        }
        if (action.status !== ACTION_STATUS.PENDING) {
            return { success: false, error: 'Action already processed' };
        }

        return new Promise((resolve, reject) => {
            deps.db.run(`UPDATE ai_actions 
                    SET status = 'APPROVED', approved_at = CURRENT_TIMESTAMP, approved_by = ?
                    WHERE id = ? AND status = 'PENDING'`,
                [userId, actionId], async function (err) {
                    if (err) return reject(err);

                    if (this.changes === 0) {
                        return resolve({ success: false, error: 'Action not found or already processed' });
                    }

                    // HITL Learning: Record the approval decision for pattern learning
                    try {
                        const patternResult = await deps.ApprovalPatternService.recordDecision(
                            userId,
                            action.organization_id,
                            action.action_type,
                            action.payload,
                            'APPROVED',
                            action.payload?.riskLevel || 'LOW',
                            options.alwaysApprove || false
                        );
                        
                        console.log(`[AIActionExecutor] Pattern learned for ${action.action_type}: APPROVED`, 
                            patternResult.created ? '(new pattern)' : `(${patternResult.decision_count} decisions)`);
                        
                        resolve({ 
                            success: true, 
                            actionId, 
                            status: ACTION_STATUS.APPROVED,
                            patternLearned: true,
                            patternInfo: patternResult
                        });
                    } catch (patternError) {
                        console.error('[AIActionExecutor] Pattern learning error:', patternError);
                        // Still resolve successfully - pattern learning is non-blocking
                        resolve({ success: true, actionId, status: ACTION_STATUS.APPROVED });
                    }
                });
        });
    },

    /**
     * Reject an action
     * @param {string} actionId - Action ID to reject
     * @param {string} userId - User ID rejecting the action
     * @param {string} reason - Optional reason for rejection
     * @param {object} options - Options: { alwaysReject: boolean } - Enable auto-reject for similar actions
     */
    rejectAction: async (actionId, userId, reason = null, options = {}) => {
        await initDeps();
        // First, get the action details for pattern learning
        const action = await AIActionExecutor.getAction(actionId);
        if (!action) {
            return { success: false, error: 'Action not found' };
        }
        if (action.status !== ACTION_STATUS.PENDING) {
            return { success: false, error: 'Action already processed' };
        }

        return new Promise((resolve, reject) => {
            deps.db.run(`UPDATE ai_actions 
                    SET status = 'REJECTED', approved_at = CURRENT_TIMESTAMP, approved_by = ?
                    WHERE id = ? AND status = 'PENDING'`,
                [userId, actionId], async function (err) {
                    if (err) return reject(err);

                    if (this.changes === 0) {
                        return resolve({ success: false, error: 'Action not found or already processed' });
                    }

                    // Log audit
                    AIActionExecutor._logAudit(actionId, userId, 'REJECTED', reason);

                    // HITL Learning: Record the rejection decision for pattern learning
                    try {
                        const patternResult = await deps.ApprovalPatternService.recordDecision(
                            userId,
                            action.organization_id,
                            action.action_type,
                            action.payload,
                            'REJECTED',
                            action.payload?.riskLevel || 'LOW',
                            options.alwaysReject || false
                        );
                        
                        console.log(`[AIActionExecutor] Pattern learned for ${action.action_type}: REJECTED`, 
                            patternResult.created ? '(new pattern)' : `(${patternResult.decision_count} decisions)`);
                        
                        resolve({ 
                            success: true, 
                            actionId, 
                            status: ACTION_STATUS.REJECTED,
                            patternLearned: true,
                            patternInfo: patternResult
                        });
                    } catch (patternError) {
                        console.error('[AIActionExecutor] Pattern learning error:', patternError);
                        // Still resolve successfully - pattern learning is non-blocking
                        resolve({ success: true, actionId, status: ACTION_STATUS.REJECTED });
                    }
                });
        });
    },

    /**
     * Execute an approved action
     */
    executeAction: async (actionId, userId) => {
        await initDeps();
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
        await initDeps();
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

    /**
     * Get a single action by ID
     */
    getAction: async (actionId) => {
        await initDeps();
        return new Promise((resolve, reject) => {
            deps.db.get(`SELECT * FROM ai_actions WHERE id = ?`, [actionId], (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);
                
                try {
                    row.payload = JSON.parse(row.payload || '{}');
                    row.draftContent = row.draft_content ? JSON.parse(row.draft_content) : null;
                } catch { }
                resolve(row);
            });
        });
    },

    /**
     * List actions for a project
     */
    listActions: async (projectId, filters = {}) => {
        await initDeps();
        return new Promise((resolve, reject) => {
            let sql = `SELECT * FROM ai_actions WHERE project_id = ?`;
            const params = [projectId];

            if (filters.status) {
                sql += ` AND status = ?`;
                params.push(filters.status);
            }
            if (filters.actionType) {
                sql += ` AND action_type = ?`;
                params.push(filters.actionType);
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

    /**
     * Get pattern info for an action - shows if similar actions have been approved/rejected
     * @param {string} userId - User ID
     * @param {string} actionType - Action type
     * @param {object} payload - Action payload
     * @returns {Promise<object>} - Pattern info or null
     */
    getPatternInfo: async (userId, actionType, payload) => {
        await initDeps();
        try {
            const pattern = await deps.ApprovalPatternService.findMatchingPattern(userId, actionType, payload);
            if (!pattern) return null;
            
            const confidence = deps.ApprovalPatternService.calculateConfidence(pattern, payload);
            return {
                patternId: pattern.id,
                decision: pattern.decision,
                decisionCount: pattern.decision_count,
                autoApply: pattern.auto_apply === 1,
                confidence: Math.round(confidence * 100),
                lastDecisionAt: pattern.last_decision_at,
                message: `Similar to ${pattern.decision_count} previous ${pattern.decision.toLowerCase()} decisions`
            };
        } catch (error) {
            console.error('[AIActionExecutor] getPatternInfo error:', error);
            return null;
        }
    },

    /**
     * Get user's approval patterns statistics
     */
    getUserPatternStats: async (userId) => {
        await initDeps();
        return deps.ApprovalPatternService.getPatternStats(userId);
    },

    /**
     * Get user's approval patterns list
     */
    getUserPatterns: async (userId, actionType = null) => {
        await initDeps();
        return deps.ApprovalPatternService.getUserPatterns(userId, actionType);
    },

    /**
     * Toggle auto-apply for a pattern
     */
    setPatternAutoApply: async (patternId, enabled, userId) => {
        await initDeps();
        return deps.ApprovalPatternService.setAutoApply(patternId, enabled, userId);
    },

    /**
     * Delete a learned pattern
     */
    deletePattern: async (patternId, userId) => {
        await initDeps();
        return deps.ApprovalPatternService.deletePattern(patternId, userId);
    },

    // ==================== INTERNAL EXECUTORS ====================

    _executeCreateTask: async (draftContent, action) => {
        await initDeps();
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
        await initDeps();
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

    /**
     * Send notification for pending AI action requiring approval
     * @private
     */
    _sendPendingActionNotification: async (actionId, userId, organizationId, projectId, actionType, payload) => {
        await initDeps();
        const NotificationSvc = await deps.getNotificationService();
        if (!NotificationSvc) return;

        // Get action type description
        const actionDescriptions = {
            [ACTION_TYPES.CREATE_DRAFT_TASK]: 'create a new task',
            [ACTION_TYPES.CREATE_DRAFT_INITIATIVE]: 'create a new initiative',
            [ACTION_TYPES.SUGGEST_ROADMAP_CHANGE]: 'suggest a roadmap change',
            [ACTION_TYPES.GENERATE_REPORT]: 'generate a report',
            [ACTION_TYPES.PREPARE_DECISION_SUMMARY]: 'prepare a decision summary',
            [ACTION_TYPES.ANALYZE_RISKS]: 'analyze risks'
        };

        const actionDesc = actionDescriptions[actionType] || actionType.toLowerCase().replace(/_/g, ' ');
        const draftName = payload.content?.title || payload.content?.name || 'unnamed item';

        try {
            await NotificationSvc.create({
                userId: userId,
                organizationId: organizationId,
                projectId: projectId,
                type: 'AI_ACTION_PENDING',
                severity: 'INFO',
                title: 'AI Action Awaiting Your Approval',
                message: `AI wants to ${actionDesc}: "${draftName}". Review and approve or reject this action.`,
                relatedObjectType: 'ai_action',
                relatedObjectId: actionId,
                isActionable: true,
                actionUrl: `/ai/actions/${actionId}`
            });

            console.log(`[AIActionExecutor] Notification sent for pending action: ${actionId}`);
        } catch (err) {
            console.warn('[AIActionExecutor] Failed to create notification:', err.message);
        }
    },

    /**
     * Send notification when AI action is auto-approved/rejected by pattern
     * @private
     */
    _sendAutoDecisionNotification: async (actionId, userId, organizationId, decision, patternInfo) => {
        await initDeps();
        const NotificationSvc = await deps.getNotificationService();
        if (!NotificationSvc) return;

        const isApproval = decision === 'APPROVED';

        try {
            await NotificationSvc.create({
                userId: userId,
                organizationId: organizationId,
                type: isApproval ? 'AI_ACTION_AUTO_APPROVED' : 'AI_ACTION_AUTO_REJECTED',
                severity: 'INFO',
                title: isApproval ? 'AI Action Auto-Approved' : 'AI Action Auto-Rejected',
                message: isApproval 
                    ? `An AI action was automatically approved based on your past preferences (${patternInfo.decisionCount} similar approvals).`
                    : `An AI action was automatically rejected based on your past preferences (${patternInfo.decisionCount} similar rejections).`,
                relatedObjectType: 'ai_action',
                relatedObjectId: actionId
            });
        } catch (err) {
            console.warn('[AIActionExecutor] Failed to create auto-decision notification:', err.message);
        }
    },

    _logAudit: async (actionId, userId, decision, feedback = null) => {
        await initDeps();
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

export default AIActionExecutor;
