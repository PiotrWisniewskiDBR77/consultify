/**
 * AI Action Executor - Handles AI actions with approval workflow
 * AI Core Layer — Enterprise PMO Brain
 */

import { get as dbGet, run as dbRun, all as dbAll } from '../utils/DbPromise.js';
import { v4 as uuidv4 } from 'uuid';
import AIPolicyEngine from './aiPolicyEngine.js';

// Enums and Constants
export const ACTION_TYPES = {
    CREATE_DRAFT_TASK: 'CREATE_DRAFT_TASK',
    CREATE_DRAFT_INITIATIVE: 'CREATE_DRAFT_INITIATIVE',
    SUGGEST_ROADMAP_CHANGE: 'SUGGEST_ROADMAP_CHANGE',
    GENERATE_REPORT: 'GENERATE_REPORT',
    PREPARE_DECISION_SUMMARY: 'PREPARE_DECISION_SUMMARY',
    EXPLAIN_CONTEXT: 'EXPLAIN_CONTEXT',
    ANALYZE_RISKS: 'ANALYZE_RISKS'
};

export const ACTION_STATUS = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    EXECUTED: 'EXECUTED'
};

// Lazy-load dependencies to avoid circular dependencies
let _notificationService: any = null;
const getNotificationService = async () => {
    if (!_notificationService) {
        try {
            const mod = (await import('./NotificationService.js')) as any;
            _notificationService = mod.default || mod;
        } catch (e: unknown) {
            console.warn('[AIActionExecutor] NotificationService not available');
        }
    }
    return _notificationService;
};

let _aiRoleGuard: any = null;
const getAIRoleGuard = async () => {
    if (!_aiRoleGuard) {
        try {
            const mod = (await import('./aiRoleGuard.js')) as any;
            _aiRoleGuard = mod.default || mod;
        } catch (e: unknown) {
            console.warn('[AIActionExecutor] AIRoleGuard not available');
        }
    }
    return _aiRoleGuard;
};

let _regulatoryModeGuard: any = null;
const getRegulatoryModeGuard = async () => {
    if (!_regulatoryModeGuard) {
        try {
            const mod = (await import('./regulatoryModeGuard.js')) as any;
            _regulatoryModeGuard = mod.default || mod;
        } catch (e: unknown) {
            console.warn('[AIActionExecutor] RegulatoryModeGuard not available');
        }
    }
    return _regulatoryModeGuard;
};

let _approvalPatternService: any = null;
const getApprovalPatternService = async () => {
    if (!_approvalPatternService) {
        try {
            const mod = (await import('./approvalPatternService.js')) as any;
            _approvalPatternService = mod.default || mod;
        } catch (e: unknown) {
            console.warn('[AIActionExecutor] ApprovalPatternService not available');
        }
    }
    return _approvalPatternService;
};

const AIActionExecutor = {
    ACTION_TYPES,
    ACTION_STATUS,

    /**
     * Request an AI action
     */
    requestAction: async (actionType: string, payload: any, userId: string, organizationId: string, projectId: string | null = null) => {
        const RegulatoryModeGuard = await getRegulatoryModeGuard();
        const AIRoleGuard = await getAIRoleGuard();
        const ApprovalPatternService = await getApprovalPatternService();

        // 0. REGULATORY MODE
        if (projectId && RegulatoryModeGuard) {
            const regulatoryCheck = await RegulatoryModeGuard.enforceRegulatoryMode(
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
                    suggestion: 'Regulatory Mode is enabled. AI can only explain and advise.'
                };
            }
        }

        // AI Roles Model check
        if (projectId && AIRoleGuard) {
            const roleCheck = await AIRoleGuard.isActionBlocked(projectId, actionType);
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

            if (roleCheck.requiresApproval) {
                payload._forceApproval = true;
            }
        }

        // Policy Engine check
        const permission = await AIPolicyEngine.canPerformAction(actionType, organizationId, projectId, userId);

        if (!permission.allowed) {
            return {
                success: false,
                error: permission.reason,
                requiresUpgrade: true
            };
        }

        let requiresApproval = Boolean(permission.requiresApproval || payload._forceApproval);

        // HITL Learning System
        let autoDecided = false;
        let autoDecision = null;
        let patternInfo = null;

        if (requiresApproval && ApprovalPatternService) {
            const riskLevel = payload.riskLevel || 'LOW';
            const autoDecideCheck = await ApprovalPatternService.canAutoDecide(
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

                if (autoDecision === 'REJECTED') {
                    return {
                        success: false,
                        autoRejected: true,
                        blocked: true,
                        reason: `Auto-rejected based on learned pattern`,
                        patternInfo
                    };
                }

                requiresApproval = false;
            }
        }

        const id = uuidv4();
        const finalStatus = requiresApproval ? ACTION_STATUS.PENDING : ACTION_STATUS.APPROVED;

        await dbRun(`INSERT INTO ai_actions 
            (id, user_id, organization_id, project_id, action_type, payload, 
             required_policy_level, current_policy_level, requires_approval, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id, userId, organizationId, projectId, actionType,
                JSON.stringify(payload),
                permission.requiredLevel, permission.currentLevel,
                requiresApproval ? 1 : 0,
                finalStatus
            ]);

        const result: any = {
            success: true,
            actionId: id,
            requiresApproval: requiresApproval,
            status: finalStatus
        };

        if (autoDecided) {
            result.autoApproved = true;
            result.patternInfo = patternInfo;
        }

        if (requiresApproval && finalStatus === ACTION_STATUS.PENDING) {
            AIActionExecutor._sendPendingActionNotification(
                id, userId, organizationId, projectId, actionType, payload
            ).catch(err => {
                console.warn('[AIActionExecutor] Failed to send notification:', err.message);
            });
        }

        return result;
    },

    /**
     * Create a draft
     */
    createDraft: async (draftType: 'task' | 'initiative', draftContent: any, userId: string, organizationId: string, projectId: string) => {
        const actionType = draftType === 'task'
            ? ACTION_TYPES.CREATE_DRAFT_TASK
            : ACTION_TYPES.CREATE_DRAFT_INITIATIVE;

        const result = await AIActionExecutor.requestAction(
            actionType,
            { draftType, content: draftContent },
            userId, organizationId, projectId
        );

        if (result.success) {
            await dbRun(`UPDATE ai_actions SET draft_content = ? WHERE id = ?`,
                [JSON.stringify(draftContent), result.actionId]);
        }

        return result;
    },

    /**
     * Approve an action
     */
    approveAction: async (actionId: string, userId: string, options: any = {}) => {
        const ApprovalPatternService = await getApprovalPatternService();
        const action = await AIActionExecutor.getAction(actionId);
        if (!action) return { success: false, error: 'Action not found' };
        if (action.status !== ACTION_STATUS.PENDING) return { success: false, error: 'Action already processed' };

        const res = await dbRun(`UPDATE ai_actions 
                SET status = 'APPROVED', approved_at = CURRENT_TIMESTAMP, approved_by = ?
                WHERE id = ? AND status = 'PENDING'`,
            [userId, actionId]);

        if (res.changes === 0) {
            return { success: false, error: 'Action not found or already processed' };
        }

        if (ApprovalPatternService) {
            try {
                const patternResult = await ApprovalPatternService.recordDecision(
                    userId,
                    action.organization_id,
                    action.action_type,
                    action.payload,
                    'APPROVED',
                    action.payload?.riskLevel || 'LOW',
                    options.alwaysApprove || false
                );

                return {
                    success: true,
                    actionId,
                    status: ACTION_STATUS.APPROVED,
                    patternLearned: true,
                    patternInfo: patternResult
                };
            } catch (err: unknown) {
                console.error('[AIActionExecutor] Pattern learning error:', err);
            }
        }

        return { success: true, actionId, status: ACTION_STATUS.APPROVED };
    },

    /**
     * Reject an action
     */
    rejectAction: async (actionId: string, userId: string, reason: string | null = null, options: any = {}) => {
        const ApprovalPatternService = await getApprovalPatternService();
        const action = await AIActionExecutor.getAction(actionId);
        if (!action) return { success: false, error: 'Action not found' };
        if (action.status !== ACTION_STATUS.PENDING) return { success: false, error: 'Action already processed' };

        const res = await dbRun(`UPDATE ai_actions 
                SET status = 'REJECTED', approved_at = CURRENT_TIMESTAMP, approved_by = ?
                WHERE id = ? AND status = 'PENDING'`,
            [userId, actionId]);

        if (res.changes === 0) {
            return { success: false, error: 'Action not found or already processed' };
        }

        AIActionExecutor._logAudit(actionId, userId, 'REJECTED', reason);

        if (ApprovalPatternService) {
            try {
                const patternResult = await ApprovalPatternService.recordDecision(
                    userId,
                    action.organization_id,
                    action.action_type,
                    action.payload,
                    'REJECTED',
                    action.payload?.riskLevel || 'LOW',
                    options.alwaysReject || false
                );

                return {
                    success: true,
                    actionId,
                    status: ACTION_STATUS.REJECTED,
                    patternLearned: true,
                    patternInfo: patternResult
                };
            } catch (err: unknown) {
                console.error('[AIActionExecutor] Pattern learning error:', err);
            }
        }

        return { success: true, actionId, status: ACTION_STATUS.REJECTED };
    },

    /**
     * Execute an approved action
     */
    executeAction: async (actionId: string, _userId: string) => {
        const action: any = await dbGet(`SELECT * FROM ai_actions WHERE id = ?`, [actionId]);

        if (!action) return { success: false, error: 'Action not found' };
        if (action.status !== ACTION_STATUS.APPROVED) return { success: false, error: `Action is ${action.status}, not APPROVED` };

        try {
            const draftContent = (action as any).draft_content ? JSON.parse((action as any).draft_content) : null;

            let result = null;
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

            await dbRun(`UPDATE ai_actions SET status = 'EXECUTED', executed_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [actionId]);

            return { success: true, actionId, result };
        } catch (err: unknown) {
            return { success: false, error: (err as Error).message };
        }
    },

    /**
     * Get pending actions
     */
    getPendingActions: async (userId: string | null = null, projectId: string | null = null, organizationId: string | null = null) => {
        let sql = `SELECT * FROM ai_actions WHERE status = 'PENDING'`;
        const params = [];

        if (userId) { sql += ` AND user_id = ?`; params.push(userId); }
        if (projectId) { sql += ` AND project_id = ?`; params.push(projectId); }
        if (organizationId) { sql += ` AND organization_id = ?`; params.push(organizationId); }

        sql += ` ORDER BY created_at DESC`;

        const rows = await dbAll(sql, params);
        return (rows || []).map((row: any) => {
            try {
                row.payload = JSON.parse(row.payload || '{}');
                row.draftContent = row.draft_content ? JSON.parse(row.draft_content) : null;
            } catch { }
            return row;
        });
    },

    /**
     * Get a single action
     */
    getAction: async (actionId: string) => {
        const row: any = await dbGet(`SELECT * FROM ai_actions WHERE id = ?`, [actionId]);
        if (!row) return null;
        try {
            row.payload = JSON.parse(row.payload || '{}');
            row.draftContent = row.draft_content ? JSON.parse(row.draft_content) : null;
        } catch { }
        return row;
    },

    /**
     * List actions
     */
    listActions: async (projectId: string, filters: any = {}) => {
        let sql = `SELECT * FROM ai_actions WHERE project_id = ?`;
        const params = [projectId];

        if (filters.status) { sql += ` AND status = ?`; params.push(filters.status); }
        if (filters.actionType) { sql += ` AND action_type = ?`; params.push(filters.actionType); }

        sql += ` ORDER BY created_at DESC`;

        const rows = await dbAll(sql, params);
        return (rows || []).map((row: any) => {
            try {
                row.payload = JSON.parse(row.payload || '{}');
                row.draftContent = row.draft_content ? JSON.parse(row.draft_content) : null;
            } catch { }
            return row;
        });
    },

    /**
     * Get pattern info
     */
    getPatternInfo: async (userId: string, actionType: string, payload: any) => {
        const ApprovalPatternService = await getApprovalPatternService();
        if (!ApprovalPatternService) return null;

        try {
            const pattern = await ApprovalPatternService.findMatchingPattern(userId, actionType, payload);
            if (!pattern) return null;

            const confidence = ApprovalPatternService.calculateConfidence(pattern, payload);
            return {
                patternId: pattern.id,
                decision: pattern.decision,
                decisionCount: pattern.decision_count,
                autoApply: pattern.auto_apply === 1,
                confidence: Math.round(confidence * 100),
                lastDecisionAt: pattern.last_decision_at,
                message: `Similar to ${pattern.decision_count} previous ${pattern.decision.toLowerCase()} decisions`
            };
        } catch (error: unknown) {
            console.error('[AIActionExecutor] getPatternInfo error:', error);
            return null;
        }
    },

    /**
     * Get user's approval patterns statistics
     */
    getUserPatternStats: async (userId: string) => {
        const ApprovalPatternService = await getApprovalPatternService();
        return ApprovalPatternService ? ApprovalPatternService.getPatternStats(userId) : { approved: 0, rejected: 0, autoApplied: 0 };
    },

    /**
     * Get user's approval patterns list
     */
    getUserPatterns: async (userId: string, actionType: string | null = null) => {
        const ApprovalPatternService = await getApprovalPatternService();
        return ApprovalPatternService ? ApprovalPatternService.getUserPatterns(userId, actionType) : [];
    },

    /**
     * Toggle auto-apply for a pattern
     */
    setPatternAutoApply: async (patternId: string, enabled: boolean, userId: string) => {
        const ApprovalPatternService = await getApprovalPatternService();
        return ApprovalPatternService ? ApprovalPatternService.setAutoApply(patternId, enabled, userId) : { success: false };
    },

    /**
     * Delete a learned pattern
     */
    deletePattern: async (patternId: string, userId: string) => {
        const ApprovalPatternService = await getApprovalPatternService();
        return ApprovalPatternService ? ApprovalPatternService.deletePattern(patternId, userId) : { success: false };
    },

    // ==================== INTERNAL EXECUTORS ====================

    _executeCreateTask: async (draftContent: any, action: any) => {
        const taskId = uuidv4();
        const { title, description, assigneeId, dueDate } = draftContent;

        await dbRun(`INSERT INTO tasks (id, project_id, title, description, assignee_id, due_date, status, created_by)
                VALUES (?, ?, ?, ?, ?, ?, 'TODO', ?)`,
            [taskId, action.project_id, title, description, assigneeId, dueDate, action.user_id]);

        return { taskId, title, created: true };
    },

    _executeCreateInitiative: async (draftContent: any, action: any) => {
        const initiativeId = uuidv4();
        const { name, description, ownerId, priority } = draftContent;

        await dbRun(`INSERT INTO initiatives (id, project_id, name, description, owner_business_id, priority, status)
                VALUES (?, ?, ?, ?, ?, ?, 'DRAFT')`,
            [initiativeId, action.project_id, name, description, ownerId, priority || 'MEDIUM']);

        return { initiativeId, name, created: true };
    },

    /**
     * Send notification for pending AI action
     * @private
     */
    _sendPendingActionNotification: async (actionId: string, userId: string, organizationId: string, projectId: string | null, actionType: string, payload: any) => {
        const NotificationSvc = await getNotificationService();
        if (!NotificationSvc) return;

        const actionDescriptions: Record<string, string> = {
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
        } catch (err: unknown) {
            console.warn('[AIActionExecutor] Failed to create notification:', (err as Error).message);
        }
    },

    _logAudit: async (actionId: string, userId: string, decision: string, feedback: string | null = null) => {
        const action: any = (await dbGet(`SELECT * FROM ai_actions WHERE id = ?`, [actionId])) || {};
        const auditId = uuidv4();

        return dbRun(`INSERT INTO ai_audit_logs 
            (id, user_id, organization_id, project_id, action_type, action_description, 
             ai_role, policy_level, user_decision, user_feedback)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                auditId, userId, (action as any).organization_id, (action as any).project_id,
                (action as any).action_type, `AI action: ${(action as any).action_type}`,
                'EXECUTOR', (action as any).current_policy_level,
                decision, feedback
            ]);
    }
};

export default AIActionExecutor;
