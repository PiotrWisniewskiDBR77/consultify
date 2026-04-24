// @ts-nocheck
/**
 * AI Action Executor - Handles AI actions with approval workflow
 * AI Core Layer — Enterprise PMO Brain
 */

import { v4 as uuidPackage } from 'uuid';
let uuidv4 = uuidPackage;

import { all, get, run } from '../utils/DbPromise.js';
let dbAll = all;
let dbGet = get;
let dbRun = run;
import {
  mapDbActionStatusToV8Lifecycle,
  V8LifecycleState,
} from '../types/chatExecutionIntegration.js';
import logger from '../utils/Logger.js';
import AIPolicyEngine from './aiPolicyEngine.js';

// Enums and Constants
export const ACTION_TYPES = {
  CREATE_DRAFT_TASK: 'CREATE_DRAFT_TASK',
  CREATE_DRAFT_INITIATIVE: 'CREATE_DRAFT_INITIATIVE',
  CREATE_DRAFT_DECISION: 'CREATE_DRAFT_DECISION',
  SUGGEST_ROADMAP_CHANGE: 'SUGGEST_ROADMAP_CHANGE',
  GENERATE_REPORT: 'GENERATE_REPORT',
  PREPARE_DECISION_SUMMARY: 'PREPARE_DECISION_SUMMARY',
  EXPLAIN_CONTEXT: 'EXPLAIN_CONTEXT',
  ANALYZE_RISKS: 'ANALYZE_RISKS',
};

export const ACTION_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXECUTED: 'EXECUTED',
};

/**
 * Expose the canonical V8 lifecycle state (Chat V8 §ACTIONS_AND_APPROVALS)
 * for a given legacy DB status. Use this in API responses so clients that
 * understand the V8 vocabulary can render the correct thread state without
 * waiting for a DB migration of the legacy enum.
 */
export function lifecycleStateOf(dbStatus: string | null | undefined): V8LifecycleState {
  return mapDbActionStatusToV8Lifecycle(dbStatus);
}

/**
 * V8 chat emission context passed through the action lifecycle.
 *
 * When present, the action executor will additionally write first-class
 * `execution_proposal`/`execution_progress`/`execution_result` rows into
 * `conversation_messages`, so the chat thread reflects the canonical
 * proposal → approval → execution lifecycle (Chat V8 §ACTIONS_AND_APPROVALS).
 *
 * This is fully opt-in: callers that do not pass `conversationId` keep the
 * pre-existing behavior (ai_actions row only, no chat emission).
 */
export interface ChatEmissionOptions {
  conversationId?: string | null;
  /**
   * Human-readable one-line summary of the plan, shown in the proposal bubble.
   * Falls back to the action_type when missing.
   */
  planSummary?: string | null;
  /**
   * Optional structured plan breakdown. Rendered as a numbered list.
   */
  steps?: Array<{ id?: string; label?: string; description?: string }>;
  /**
   * Optional explicit step count — if omitted and `steps` is provided, it is
   * derived from `steps.length`.
   */
  stepCount?: number;
  /**
   * Proposal risk level. Used by the bubble to show a risk pill.
   */
  risk?: 'low' | 'medium' | 'high' | string;
  /**
   * Optional reviewer display info for approve/reject messages.
   */
  reviewer?: { userId?: string; name?: string } | null;
  /**
   * Optional expiration to surface on the proposal bubble.
   */
  expiresAt?: string | null;
}

interface EmitChatExecutionMessageInput {
  conversationId: string;
  messageType: 'execution_proposal' | 'execution_progress' | 'execution_result';
  content: string;
  executionProposal: {
    proposalId: string;
    lifecycleState: V8LifecycleState;
    actionType?: string;
    planSummary?: string;
    stepCount?: number;
    steps?: Array<{ id?: string; label?: string; description?: string }>;
    risk?: string;
    reviewer?: { userId?: string; name?: string } | null;
    rejectionReason?: string | null;
    expiresAt?: string | null;
    result?: unknown;
  };
}

/**
 * Internal helper: persist a governed execution-family message to
 * `conversation_messages`. Best-effort — failures are logged and swallowed so
 * they never break the underlying action workflow.
 */
async function emitChatExecutionMessage(input: EmitChatExecutionMessageInput): Promise<void> {
  try {
    const id = uuidv4();
    await dbRun(
      `INSERT INTO conversation_messages
        (id, conversation_id, role, content, message_type, metadata, created_at)
       VALUES (?, ?, 'ai', ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        id,
        input.conversationId,
        input.content,
        input.messageType,
        JSON.stringify({ executionProposal: input.executionProposal }),
      ]
    );
  } catch (err: any) {
    logger.warn('[AIActionExecutor] emitChatExecutionMessage failed:', err?.message || String(err));
  }
}

function defaultPlanSummary(actionType: string, explicit?: string | null): string {
  const trimmed = (explicit || '').trim();
  if (trimmed) return trimmed;
  const readable = String(actionType || 'Action')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return `AI proposed: ${readable}`;
}

// Lazy-load dependencies to avoid circular dependencies
let _notificationService: any = null;
const getNotificationService = async () => {
  if (!_notificationService) {
    try {
      const mod = (await import('./notificationService.js')) as any;
      _notificationService = mod.default || mod;
    } catch (e: unknown) {
      logger.warn('[AIActionExecutor] NotificationService not available');
    }
  }
  return _notificationService;
};

let _aiRoleGuard: any = null;
const getAIRoleGuard = async () => {
  if (!_aiRoleGuard) {
    try {
      const mod = (await import('./aiRoleGuard.js')) as any;
      const svc = mod.default || mod.AIRoleGuard || mod.aiRoleGuard || mod;
      _aiRoleGuard = svc && svc.__unavailable__ !== true ? svc : null;
    } catch (e: unknown) {
      logger.warn('[AIActionExecutor] AIRoleGuard not available');
      _aiRoleGuard = null;
    }
  }
  return _aiRoleGuard;
};

let _regulatoryModeGuard: any = null;
const getRegulatoryModeGuard = async () => {
  if (!_regulatoryModeGuard) {
    try {
      const mod = (await import('./regulatoryModeGuard.js')) as any;
      const svc = mod.default || mod.RegulatoryModeGuard || mod.regulatoryModeGuard || mod;
      _regulatoryModeGuard = svc && svc.__unavailable__ !== true ? svc : null;
    } catch (e: unknown) {
      logger.warn('[AIActionExecutor] RegulatoryModeGuard not available');
      _regulatoryModeGuard = null;
    }
  }
  return _regulatoryModeGuard;
};

let _approvalPatternService: any = null;
const getApprovalPatternService = async () => {
  if (!_approvalPatternService) {
    try {
      const mod = (await import('./approvalPatternService.js')) as any;
      const svc = mod.default || mod;
      _approvalPatternService = svc && svc.__unavailable__ !== true ? svc : null;
    } catch (e: unknown) {
      logger.warn('[AIActionExecutor] ApprovalPatternService not available');
      _approvalPatternService = null;
    }
  }
  return _approvalPatternService;
};

const AIActionExecutor = {
  ACTION_TYPES,
  ACTION_STATUS,

  setDependencies(deps: any) {
    if (deps.db) {
      dbAll = deps.db.all || dbAll;
      dbGet = deps.db.get || dbGet;
      dbRun = deps.db.run || dbRun;
    }
    if (deps.uuidv4) {
      uuidv4 = deps.uuidv4;
    }
  },

  /**
   * Request an AI action.
   *
   * The optional `chatEmission` argument enables Chat V8 governed-proposal
   * semantics: when `chatEmission.conversationId` is provided AND the action
   * requires human approval, a first-class `execution_proposal` message is
   * also persisted into the thread referenced by that conversationId.
   * See `docs/product/CHAT_V8_ACTIONS_AND_APPROVALS.md`.
   */
  requestAction: async (
    actionType: string,
    payload: any,
    userId: string,
    organizationId: string,
    projectId: string | null = null,
    chatEmission: ChatEmissionOptions | null = null
  ) => {
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
          suggestion: 'Regulatory Mode is enabled. AI can only explain and advise.',
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
          suggestion: roleCheck.suggestion,
        };
      }

      if (roleCheck.requiresApproval) {
        payload._forceApproval = true;
      }
    }

    // Policy Engine check
    const permission = await AIPolicyEngine.canPerformAction(
      actionType,
      organizationId,
      projectId,
      userId
    );

    if (!permission.allowed) {
      return {
        success: false,
        error: permission.reason,
        requiresUpgrade: true,
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
        userId,
        actionType,
        payload,
        riskLevel
      );

      if (autoDecideCheck.canAutoDecide) {
        autoDecided = true;
        autoDecision = autoDecideCheck.decision;
        patternInfo = {
          patternId: autoDecideCheck.pattern?.id,
          confidence: autoDecideCheck.confidence,
          decisionCount: autoDecideCheck.pattern?.decision_count,
          reason: autoDecideCheck.reason,
        };

        if (autoDecision === 'REJECTED') {
          return {
            success: false,
            autoRejected: true,
            blocked: true,
            reason: `Auto-rejected based on learned pattern`,
            patternInfo,
          };
        }

        requiresApproval = false;
      }
    }

    const id = uuidv4();
    const finalStatus = requiresApproval ? ACTION_STATUS.PENDING : ACTION_STATUS.APPROVED;

    await dbRun(
      `INSERT INTO ai_actions 
            (id, user_id, organization_id, project_id, action_type, payload, 
             required_policy_level, current_policy_level, requires_approval, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        organizationId,
        projectId,
        actionType,
        JSON.stringify(payload),
        permission.requiredLevel,
        permission.currentLevel,
        requiresApproval ? 1 : 0,
        finalStatus,
      ]
    );

    const result: any = {
      success: true,
      actionId: id,
      requiresApproval: requiresApproval,
      status: finalStatus,
    };

    if (autoDecided) {
      result.autoApproved = true;
      result.patternInfo = patternInfo;
    }

    if (requiresApproval && finalStatus === ACTION_STATUS.PENDING) {
      AIActionExecutor._sendPendingActionNotification(
        id,
        userId,
        organizationId,
        projectId,
        actionType,
        payload
      ).catch((err: Error | null) => {
        logger.warn(
          '[AIActionExecutor] Failed to send notification:',
          err?.message || 'Unknown error'
        );
      });
    }

    // V8: emit first-class execution_proposal message into the chat thread
    // so the proposal becomes visible, reviewable and never silent.
    if (chatEmission?.conversationId) {
      const stepCount =
        typeof chatEmission.stepCount === 'number'
          ? chatEmission.stepCount
          : Array.isArray(chatEmission.steps)
            ? chatEmission.steps.length
            : undefined;
      const planSummary = defaultPlanSummary(actionType, chatEmission.planSummary);
      const lifecycleState: V8LifecycleState = requiresApproval ? 'pending_review' : 'approved';
      result.lifecycleState = lifecycleState;
      await emitChatExecutionMessage({
        conversationId: chatEmission.conversationId,
        messageType: 'execution_proposal',
        content: planSummary,
        executionProposal: {
          proposalId: id,
          lifecycleState,
          actionType,
          planSummary,
          stepCount,
          steps: chatEmission.steps,
          risk: chatEmission.risk,
          expiresAt: chatEmission.expiresAt || null,
        },
      });
    }

    return result;
  },

  /**
   * Create a draft
   */
  createDraft: async (
    draftType: 'task' | 'initiative',
    draftContent: any,
    userId: string,
    organizationId: string,
    projectId: string,
    chatEmission: ChatEmissionOptions | null = null
  ) => {
    const actionType =
      draftType === 'task' ? ACTION_TYPES.CREATE_DRAFT_TASK : ACTION_TYPES.CREATE_DRAFT_INITIATIVE;

    const result = await AIActionExecutor.requestAction(
      actionType,
      { draftType, content: draftContent },
      userId,
      organizationId,
      projectId,
      chatEmission
    );

    if (result.success) {
      await dbRun(`UPDATE ai_actions SET draft_content = ? WHERE id = ?`, [
        JSON.stringify(draftContent),
        result.actionId,
      ]);
    }

    return result;
  },

  /**
   * Approve an action.
   *
   * When `options.conversationId` is provided, a follow-up
   * `execution_progress` message with lifecycleState=`approved` is written
   * into the chat thread, preserving the V8 visible lifecycle.
   */
  approveAction: async (actionId: string, userId: string, options: any = {}) => {
    const ApprovalPatternService = await getApprovalPatternService();
    const action = await AIActionExecutor.getAction(actionId);
    if (!action) return { success: false, error: 'Action not found' };
    if (action.status !== ACTION_STATUS.PENDING)
      return { success: false, error: 'Action already processed' };

    const res = await dbRun(
      `UPDATE ai_actions 
                SET status = 'APPROVED', approved_at = CURRENT_TIMESTAMP, approved_by = ?
                WHERE id = ? AND status = 'PENDING'`,
      [userId, actionId]
    );

    if (res.changes === 0) {
      return { success: false, error: 'Action not found or already processed' };
    }

    if (options?.conversationId) {
      await emitChatExecutionMessage({
        conversationId: options.conversationId,
        messageType: 'execution_progress',
        content: 'Proposal approved — ready to execute.',
        executionProposal: {
          proposalId: actionId,
          lifecycleState: 'approved',
          actionType: action.action_type,
          reviewer: options?.reviewer || { userId },
        },
      });
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
          lifecycleState: lifecycleStateOf(ACTION_STATUS.APPROVED),
          patternLearned: true,
          patternInfo: patternResult,
        };
      } catch (err: any) {
        logger.error('[AIActionExecutor] Pattern learning error:', err);
      }
    }

    return {
      success: true,
      actionId,
      status: ACTION_STATUS.APPROVED,
      lifecycleState: lifecycleStateOf(ACTION_STATUS.APPROVED),
    };
  },

  /**
   * Reject an action
   */
  rejectAction: async (
    actionId: string,
    userId: string,
    reason: string | null = null,
    options: any = {}
  ) => {
    const ApprovalPatternService = await getApprovalPatternService();
    const action = await AIActionExecutor.getAction(actionId);
    if (!action) return { success: false, error: 'Action not found' };
    if (action.status !== ACTION_STATUS.PENDING)
      return { success: false, error: 'Action already processed' };

    const res = await dbRun(
      `UPDATE ai_actions 
                SET status = 'REJECTED', approved_at = CURRENT_TIMESTAMP, approved_by = ?
                WHERE id = ? AND status = 'PENDING'`,
      [userId, actionId]
    );

    if (res.changes === 0) {
      return { success: false, error: 'Action not found or already processed' };
    }

    if (options?.conversationId) {
      await emitChatExecutionMessage({
        conversationId: options.conversationId,
        messageType: 'execution_result',
        content: reason ? `Proposal rejected — ${reason}` : 'Proposal rejected.',
        executionProposal: {
          proposalId: actionId,
          lifecycleState: 'rejected',
          actionType: action.action_type,
          reviewer: options?.reviewer || { userId },
          rejectionReason: reason || null,
        },
      });
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
          lifecycleState: lifecycleStateOf(ACTION_STATUS.REJECTED),
          patternLearned: true,
          patternInfo: patternResult,
        };
      } catch (err: any) {
        logger.error('[AIActionExecutor] Pattern learning error:', err);
      }
    }

    return {
      success: true,
      actionId,
      status: ACTION_STATUS.REJECTED,
      lifecycleState: lifecycleStateOf(ACTION_STATUS.REJECTED),
    };
  },

  /**
   * Execute an approved action.
   *
   * When `options.conversationId` is provided, a follow-up
   * `execution_result` message is written into the chat thread with
   * lifecycleState=`executed` on success or `failed` on error.
   */
  executeAction: async (actionId: string, _userId: string, options: any = {}) => {
    const action: any = await dbGet(`SELECT * FROM ai_actions WHERE id = ?`, [actionId]);

    if (!action) return { success: false, error: 'Action not found' };
    if (action.status !== ACTION_STATUS.APPROVED)
      return { success: false, error: `Action is ${action.status}, not APPROVED` };

    try {
      const draftContent = (action as any).draft_content
        ? JSON.parse((action as any).draft_content)
        : null;

      let result = null;
      switch (action.action_type) {
        case ACTION_TYPES.CREATE_DRAFT_TASK:
          result = await AIActionExecutor._executeCreateTask(draftContent, action);
          break;
        case ACTION_TYPES.CREATE_DRAFT_INITIATIVE:
          result = await AIActionExecutor._executeCreateInitiative(draftContent, action);
          break;
        case ACTION_TYPES.CREATE_DRAFT_DECISION:
          result = await AIActionExecutor._executeCreateDecision(draftContent, action);
          break;
        case ACTION_TYPES.PREPARE_DECISION_SUMMARY:
          result = await AIActionExecutor._executePrepareSummary(draftContent, action);
          break;
        case ACTION_TYPES.GENERATE_REPORT:
          result = { reportGenerated: true, content: draftContent };
          break;
        default:
          result = { executed: true, actionType: action.action_type };
      }

      await dbRun(
        `UPDATE ai_actions SET status = 'EXECUTED', executed_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [actionId]
      );

      if (options?.conversationId) {
        await emitChatExecutionMessage({
          conversationId: options.conversationId,
          messageType: 'execution_result',
          content: 'Proposal executed successfully.',
          executionProposal: {
            proposalId: actionId,
            lifecycleState: 'executed',
            actionType: action.action_type,
            reviewer: options?.reviewer || { userId: _userId },
            result,
          },
        });
      }

      return {
        success: true,
        actionId,
        result,
        status: ACTION_STATUS.EXECUTED,
        lifecycleState: lifecycleStateOf(ACTION_STATUS.EXECUTED),
      };
    } catch (err: any) {
      if (options?.conversationId) {
        await emitChatExecutionMessage({
          conversationId: options.conversationId,
          messageType: 'execution_result',
          content: `Proposal execution failed — ${(err as Error).message}`,
          executionProposal: {
            proposalId: actionId,
            lifecycleState: 'failed',
            actionType: action.action_type,
            reviewer: options?.reviewer || { userId: _userId },
          },
        });
      }
      return { success: false, error: (err as Error).message };
    }
  },

  /**
   * Get pending actions
   */
  getPendingActions: async (
    userId: string | null = null,
    projectId: string | null = null,
    organizationId: string | null = null
  ) => {
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

    const rows = await dbAll(sql, params);
    return (rows || []).map((row: any) => {
      try {
        row.payload = JSON.parse(row.payload || '{}');
        row.draftContent = row.draft_content ? JSON.parse(row.draft_content) : null;
      } catch {}
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
    } catch {}
    return row;
  },

  /**
   * List actions
   */
  listActions: async (projectId: string, filters: any = {}) => {
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

    const rows = await dbAll(sql, params);
    return (rows || []).map((row: any) => {
      try {
        row.payload = JSON.parse(row.payload || '{}');
        row.draftContent = row.draft_content ? JSON.parse(row.draft_content) : null;
      } catch {}
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
        message: `Similar to ${pattern.decision_count} previous ${pattern.decision.toLowerCase()} decisions`,
      };
    } catch (error: unknown) {
      logger.error('[AIActionExecutor] getPatternInfo error:', error);
      return null;
    }
  },

  /**
   * Get user's approval patterns statistics
   */
  getUserPatternStats: async (userId: string) => {
    const ApprovalPatternService = await getApprovalPatternService();
    return ApprovalPatternService
      ? ApprovalPatternService.getPatternStats(userId)
      : { approved: 0, rejected: 0, autoApplied: 0 };
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
    return ApprovalPatternService
      ? ApprovalPatternService.setAutoApply(patternId, enabled, userId)
      : { success: false };
  },

  /**
   * Delete a learned pattern
   */
  deletePattern: async (patternId: string, userId: string) => {
    const ApprovalPatternService = await getApprovalPatternService();
    return ApprovalPatternService
      ? ApprovalPatternService.deletePattern(patternId, userId)
      : { success: false };
  },

  // ==================== INTERNAL EXECUTORS ====================

  _executeCreateTask: async (draftContent: any, action: any) => {
    const taskId = uuidv4();
    const { title, description, assigneeId, dueDate } = draftContent;

    await dbRun(
      `INSERT INTO tasks (id, project_id, title, description, assignee_id, due_date, status, created_by)
                VALUES (?, ?, ?, ?, ?, ?, 'TODO', ?)`,
      [taskId, action.project_id, title, description, assigneeId, dueDate, action.user_id]
    );

    // Post-creation notification (best-effort)
    try {
      const NotificationSvc = await getNotificationService();
      if (NotificationSvc) {
        // Notify the user who requested the task
        await NotificationSvc.send({
          userId: action.user_id,
          organizationId: action.organization_id,
          type: 'AI_ACTION_COMPLETED',
          title: 'Task Created by AI',
          body: `AI has created task "${title}" in your project.`,
          entityType: 'task',
          entityId: taskId,
          actionUrl: `/tasks/${taskId}`,
          priority: 'normal',
          metadata: { projectId: action.project_id, source: 'ai_action' },
        });
        // If assignee is different from requester, notify them too
        if (assigneeId && assigneeId !== action.user_id) {
          await NotificationSvc.send({
            userId: assigneeId,
            organizationId: action.organization_id,
            type: 'TASK_ASSIGNED',
            title: 'New Task Assigned to You',
            body: `AI has assigned you a new task: "${title}".`,
            entityType: 'task',
            entityId: taskId,
            actionUrl: `/tasks/${taskId}`,
            priority: 'normal',
            metadata: { projectId: action.project_id, source: 'ai_action' },
          });
        }
      }
    } catch (notifErr: any) {
      logger.warn('[AIActionExecutor] Post-task notification failed:', notifErr?.message);
    }

    return { taskId, title, created: true };
  },

  _executeCreateInitiative: async (draftContent: any, action: any) => {
    const initiativeId = uuidv4();
    const { name, description, ownerId, priority } = draftContent;

    await dbRun(
      `INSERT INTO initiatives (id, project_id, name, description, owner_business_id, priority, status)
                VALUES (?, ?, ?, ?, ?, ?, 'DRAFT')`,
      [initiativeId, action.project_id, name, description, ownerId, priority || 'MEDIUM']
    );

    // Post-creation notification (best-effort)
    try {
      const NotificationSvc = await getNotificationService();
      if (NotificationSvc) {
        await NotificationSvc.send({
          userId: action.user_id,
          organizationId: action.organization_id,
          type: 'AI_ACTION_COMPLETED',
          title: 'Initiative Created by AI',
          body: `AI has created initiative "${name}" as a draft in your project.`,
          entityType: 'initiative',
          entityId: initiativeId,
          actionUrl: `/initiatives/${initiativeId}`,
          priority: 'normal',
          metadata: { projectId: action.project_id, source: 'ai_action' },
        });
      }
    } catch (notifErr: any) {
      logger.warn('[AIActionExecutor] Post-initiative notification failed:', notifErr?.message);
    }

    return { initiativeId, name, created: true };
  },

  _executeCreateDecision: async (draftContent: any, action: any) => {
    const decisionId = uuidv4();
    const { title, description, type, options, criteria, deadline } = draftContent;

    await dbRun(
      `INSERT INTO decisions (id, organization_id, project_id, title, description, type, 
       decision_maker_id, options, criteria, deadline, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        decisionId,
        action.organization_id,
        action.project_id,
        title,
        description || '',
        type || 'OTHER',
        action.user_id,
        JSON.stringify(options || []),
        criteria || null,
        deadline || null,
      ]
    );

    // Post-creation notification (best-effort)
    try {
      const NotificationSvc = await getNotificationService();
      if (NotificationSvc) {
        await NotificationSvc.send({
          userId: action.user_id,
          organizationId: action.organization_id,
          type: 'AI_ACTION_COMPLETED',
          title: 'Decision Created by AI',
          body: `AI has created decision "${title}" for your review.`,
          entityType: 'decision',
          entityId: decisionId,
          actionUrl: `/decisions/${decisionId}`,
          priority: 'high',
          metadata: { projectId: action.project_id, source: 'ai_action' },
        });
      }
    } catch (notifErr: any) {
      logger.warn('[AIActionExecutor] Post-decision notification failed:', notifErr?.message);
    }

    return { decisionId, title, created: true };
  },

  _executePrepareSummary: async (draftContent: any, action: any) => {
    // Generate a structured decision brief from the draft content
    const summary = {
      title: draftContent?.title || 'Decision Summary',
      context: draftContent?.context || '',
      options: (draftContent?.options || []).map((opt: any, idx: number) => ({
        label: opt.label || opt.name || `Option ${idx + 1}`,
        description: opt.description || '',
        pros: opt.pros || [],
        cons: opt.cons || [],
        estimatedImpact: opt.estimatedImpact || 'unknown',
      })),
      recommendation: draftContent?.recommendation || null,
      criteria: draftContent?.criteria || [],
      riskAssessment: draftContent?.riskAssessment || 'Not assessed',
      deadline: draftContent?.deadline || null,
      preparedAt: new Date().toISOString(),
    };

    // Notify user the summary is ready
    try {
      const NotificationSvc = await getNotificationService();
      if (NotificationSvc) {
        await NotificationSvc.send({
          userId: action.user_id,
          organizationId: action.organization_id,
          type: 'AI_ACTION_COMPLETED',
          title: 'Decision Summary Ready',
          body: `AI has prepared a decision summary: "${summary.title}" with ${summary.options.length} options.`,
          entityType: 'ai_action',
          entityId: action.id,
          priority: 'normal',
          metadata: { projectId: action.project_id, source: 'ai_action', summary },
        });
      }
    } catch (notifErr: any) {
      logger.warn('[AIActionExecutor] Post-summary notification failed:', notifErr?.message);
    }

    return { summary, prepared: true };
  },

  /**
   * Send notification for pending AI action
   * @private
   */
  _sendPendingActionNotification: async (
    actionId: string,
    userId: string,
    organizationId: string,
    projectId: string | null,
    actionType: string,
    payload: any
  ) => {
    const NotificationSvc = await getNotificationService();
    if (!NotificationSvc) return;

    const actionDescriptions: Record<string, string> = {
      [ACTION_TYPES.CREATE_DRAFT_TASK]: 'create a new task',
      [ACTION_TYPES.CREATE_DRAFT_INITIATIVE]: 'create a new initiative',
      [ACTION_TYPES.SUGGEST_ROADMAP_CHANGE]: 'suggest a roadmap change',
      [ACTION_TYPES.GENERATE_REPORT]: 'generate a report',
      [ACTION_TYPES.PREPARE_DECISION_SUMMARY]: 'prepare a decision summary',
      [ACTION_TYPES.ANALYZE_RISKS]: 'analyze risks',
    };

    const actionDesc =
      actionDescriptions[actionType] || actionType.toLowerCase().replace(/_/g, ' ');
    const draftName = payload.content?.title || payload.content?.name || 'unnamed item';

    try {
      await NotificationSvc.send({
        userId: userId,
        organizationId: organizationId,
        type: 'AI_ACTION_PENDING',
        title: 'AI Action Awaiting Your Approval',
        body: `AI wants to ${actionDesc}: "${draftName}". Review and approve or reject this action.`,
        entityType: 'ai_action',
        entityId: actionId,
        actionUrl: `/ai/actions/${actionId}`,
        priority: 'normal',
        metadata: { projectId, actionType, draftName },
      });
    } catch (err: any) {
      logger.warn('[AIActionExecutor] Failed to send notification:', (err as Error).message);
    }
  },

  _logAudit: async (
    actionId: string,
    userId: string,
    decision: string,
    feedback: string | null = null
  ) => {
    const action: any = (await dbGet(`SELECT * FROM ai_actions WHERE id = ?`, [actionId])) || {};
    const auditId = uuidv4();

    return dbRun(
      `INSERT INTO ai_audit_logs 
            (id, user_id, organization_id, project_id, action_type, action_description, 
             ai_role, policy_level, user_decision, user_feedback)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        auditId,
        userId,
        (action as any).organization_id,
        (action as any).project_id,
        (action as any).action_type,
        `AI action: ${(action as any).action_type}`,
        'EXECUTOR',
        (action as any).current_policy_level,
        decision,
        feedback,
      ]
    );
  },
};

export default AIActionExecutor;
