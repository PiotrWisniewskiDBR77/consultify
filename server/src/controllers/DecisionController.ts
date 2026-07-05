/**
 * Decision Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles all decision-related business logic
 */

import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import auditEventsService from '../services/AuditEventsService.js';
import {
  type DecisionPlaybook,
  validateRequiredFields,
} from '../services/decisionPlaybookService.js';
import { recordHandoff as recordStageHandoff } from '../services/initiative/stageHandoffService.js';
import {
  type DecisionWorkflowStatus,
  validateDecisionWorkflowTransition,
} from '../services/decisionWorkflowService.js';
import { dispatchProjectCommunicationEvent } from '../services/integrations/communicationSyncService.js';
import NotificationService from '../services/notificationService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as DbPromise from '../utils/DbPromise.js';
import { getTableColumns } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import type {
  CreateDecisionRequest,
  DecideRequest,
  EscalateDecisionRequest,
  RemindDecisionRequest,
  UpdateDecisionRequest,
} from '../validators/decision.validators.js';

// ==========================================
// TYPES
// ==========================================

interface DecisionRow {
  id: string;
  organization_id: string;
  project_id: string | null;
  initiative_id: string | null;
  task_id: string | null;
  title: string;
  description: string | null;
  type: string;
  decision_maker_id: string;
  deadline: string | null;
  status: string;
  priority: string | null;
  impact: string | null;
  escalation_level: string | null;
  pmo_domain?: string | null;
  workflow_status?: string | null;
  created_by: string;
  created_at: string;
  decided_at?: string | null;
  decision_rationale?: string | null;
  owner_name?: string | null;
  owner_avatar_url?: string | null;
  requested_by_name?: string | null;
  project_name?: string | null;
  blocked_items_count?: number;
}

const ESCALATION_RED_DAYS = 7;

const normalizeStatus = (status?: string | null): string => {
  if (!status) return 'pending';
  const normalized = status.toLowerCase();
  if (['pending', 'approved', 'rejected', 'escalated', 'cancelled'].includes(normalized)) {
    return normalized;
  }
  if (normalized === 'made') return 'approved';
  if (normalized === 'expired') return 'escalated';
  if (normalized === 'deferred') return 'pending';
  return 'pending';
};

const normalizeAdminLikeRole = (role?: string | null): string => {
  const normalized = String(role || '')
    .trim()
    .toUpperCase();
  if (normalized === 'OWNER' || normalized === 'SUPER_ADMIN') return 'SUPERADMIN';
  if (normalized === 'ADMINISTRATOR') return 'ADMIN';
  return normalized;
};

const toApiStatus = (status?: string | null): string => normalizeStatus(status).toUpperCase();

const isDecisionStatusInput = (status?: string | null): boolean => {
  if (!status) return false;
  const normalized = status.toLowerCase();
  return [
    'pending',
    'approved',
    'rejected',
    'deferred',
    'escalated',
    'cancelled',
    'made',
    'expired',
  ].includes(normalized);
};

const DECISION_BLOCK_TAG = (decisionId: string) => `[decision:${decisionId}]`;

const refreshTaskDecisionBlock = async (input: {
  taskId: string;
  organizationId: string;
  resolvedDecisionId: string;
}): Promise<void> => {
  const { taskId, organizationId, resolvedDecisionId } = input;

  const task = await queryHelpers.queryOne<{
    status?: string;
    blocked_by_decision_id?: string | null;
    blocked_reason?: string | null;
  }>(
    `SELECT status, blocked_by_decision_id, blocked_reason FROM tasks WHERE id = ? AND organization_id = ?`,
    [taskId, organizationId]
  );

  if (!task) return;

  // Only manage tasks that are currently blocked by this decision
  if (task.blocked_by_decision_id !== resolvedDecisionId) return;

  const nextBlocker = await queryHelpers.queryOne<{ id: string; title: string }>(
    `
      SELECT d.id, d.title
      FROM decisions d
      JOIN decision_impacts di ON d.id = di.decision_id
      WHERE d.organization_id = ?
        AND di.impacted_type = 'task'
        AND di.impacted_id = ?
        AND di.is_blocker = TRUE
        AND d.status IN ('pending', 'escalated')
      ORDER BY
        CASE WHEN d.deadline IS NULL THEN 1 ELSE 0 END,
        d.deadline ASC,
        d.created_at ASC
      LIMIT 1
    `,
    [organizationId, taskId]
  );

  if (nextBlocker) {
    await queryHelpers.queryRun(
      `UPDATE tasks SET 
        status = CASE WHEN status = 'done' THEN status ELSE 'blocked' END,
        blocked_at = COALESCE(blocked_at, CURRENT_TIMESTAMP),
        blocked_by_decision_id = ?,
        blocked_reason = CASE
          WHEN blocked_reason IS NULL OR blocked_reason = '' THEN ?
          ELSE blocked_reason
        END,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ?`,
      [
        nextBlocker.id,
        `${DECISION_BLOCK_TAG(nextBlocker.id)} Blocked by decision: ${nextBlocker.title}`,
        taskId,
        organizationId,
      ]
    );
    return;
  }

  // No more blockers -> unblock
  await queryHelpers.queryRun(
    `UPDATE tasks SET
      status = CASE WHEN status = 'blocked' THEN 'in_progress' ELSE status END,
      blocked_at = NULL,
      blocked_reason = NULL,
      blocked_by_decision_id = NULL,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND organization_id = ? AND blocked_by_decision_id = ?`,
    [taskId, organizationId, resolvedDecisionId]
  );
};

const refreshInitiativeDecisionBlock = async (input: {
  initiativeId: string;
  organizationId: string;
  resolvedDecisionId: string;
}): Promise<void> => {
  const { initiativeId, organizationId, resolvedDecisionId } = input;

  const initiative = await queryHelpers.queryOne<{
    status?: string;
    blocked_reason?: string | null;
  }>(`SELECT status, blocked_reason FROM initiatives WHERE id = ? AND organization_id = ?`, [
    initiativeId,
    organizationId,
  ]);
  if (!initiative) return;

  // Only unblock initiatives that we blocked for this decision (tag-based)
  const tag = DECISION_BLOCK_TAG(resolvedDecisionId);
  if (!initiative.blocked_reason || !initiative.blocked_reason.includes(tag)) return;

  const stillBlocked = await queryHelpers.queryOne<{ count: number }>(
    `
      SELECT COUNT(*) as count
      FROM decisions d
      JOIN decision_impacts di ON d.id = di.decision_id
      WHERE d.organization_id = ?
        AND di.impacted_type = 'initiative'
        AND di.impacted_id = ?
        AND di.is_blocker = TRUE
        AND d.status IN ('pending', 'escalated')
    `,
    [organizationId, initiativeId]
  );

  if ((stillBlocked?.count || 0) > 0) return;

  // Only record handoff when the initiative was actually blocked (conditional SQL won't fire for others)
  const wasBlocked =
    initiative.status != null &&
    String(initiative.status).toUpperCase() === 'BLOCKED';

  await queryHelpers.queryRun(
    `UPDATE initiatives SET
      status = CASE WHEN status = 'blocked' THEN 'executing' ELSE status END,
      unblocked_at = CURRENT_TIMESTAMP,
      blocked_reason = NULL,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND organization_id = ?`,
    [initiativeId, organizationId]
  );

  // Best-effort handoff audit: BLOCKED → EXECUTING (decision auto-unblock).
  if (wasBlocked) {
    void recordStageHandoff(organizationId, initiativeId, 'BLOCKED', 'EXECUTING').catch((e) =>
      logger.warn('[decision] recordStageHandoff failed (auto-unblock):', e)
    );
  }
};

const normalizePriority = (priority?: string | null): string =>
  (priority || 'MEDIUM').toUpperCase();

const normalizeImpact = (impact?: string | null): string => (impact || 'MEDIUM').toUpperCase();

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const computeEscalationLevel = (
  dueDate?: string | null,
  priority?: string | null,
  impact?: string | null
): { level: 'none' | 'amber' | 'red'; overdueDays: number } => {
  const due = parseDate(dueDate);
  if (!due) return { level: 'none', overdueDays: 0 };
  const now = Date.now();
  const diffDays = Math.floor((now - due.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return { level: 'none', overdueDays: 0 };
  const isCritical =
    normalizePriority(priority) === 'CRITICAL' || normalizeImpact(impact) === 'HIGH';
  if (isCritical || diffDays > ESCALATION_RED_DAYS) {
    return { level: 'red', overdueDays: diffDays };
  }
  return { level: 'amber', overdueDays: diffDays };
};

const resolveRelatedObject = (row: DecisionRow): { type?: string; id?: string } => {
  if (row.task_id) return { type: 'task', id: row.task_id };
  if (row.initiative_id) return { type: 'initiative', id: row.initiative_id };
  if (row.project_id) return { type: 'project', id: row.project_id };
  return {};
};

const parseHistoryNotes = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return parsed?.notes as string | undefined;
  } catch {
    return undefined;
  }
};

const parseHistoryDetails = (value?: string | null): Record<string, unknown> | undefined => {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return undefined;
  } catch {
    return undefined;
  }
};

// ==========================================
// CONTROLLER METHODS
// ==========================================

export class DecisionController {
  /**
   * Get all decisions
   */
  static getDecisions = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { projectId, status, relatedObjectId, taskId, initiativeId, source, limit, offset } =
        req.query;
      const orgId = req.user?.organizationId;
      const decisionCols = await getTableColumns('decisions');
      const hasEscalationLevelCol = decisionCols.has('escalation_level');
      // Guard the blocker subquery: if `decision_impacts` is absent (schema drift
      // on an under-migrated env) the whole query would error and queryAll would
      // swallow it to [], silently emptying the decisions list. Default to 0.
      const hasDecisionImpacts = (await getTableColumns('decision_impacts')).has('is_blocker');
      const blockedItemsCountSelect = hasDecisionImpacts
        ? `(SELECT COUNT(*) FROM decision_impacts di WHERE di.decision_id = d.id AND di.is_blocker = TRUE)`
        : `0`;
      // Mirror the Initiatives `?source` filter semantics (e.g. ?source=interview_insight).
      const normalizedSourceFilter = source ? source.toString().trim().toLowerCase() : '';

      let sql = `
        SELECT
          d.*,
          owner.first_name || ' ' || owner.last_name as owner_name,
          requester.first_name || ' ' || requester.last_name as requested_by_name,
          p.name as project_name,
          ${blockedItemsCountSelect} as blocked_items_count
        FROM decisions d
        LEFT JOIN users owner ON d.decision_maker_id = owner.id
        LEFT JOIN users requester ON d.created_by = requester.id
        LEFT JOIN projects p ON d.project_id = p.id
        WHERE 1=1`;

      type SQLParam = string | number | boolean | null | undefined;
      const params: SQLParam[] = [];

      if (orgId) {
        sql += ` AND d.organization_id = ?`;
        params.push(orgId);
      }
      if (projectId) {
        sql += ` AND d.project_id = ?`;
        params.push(projectId);
      }
      if (status) {
        sql += ` AND d.status = ?`;
        params.push(normalizeStatus(String(status)));
      }
      if (taskId) {
        sql += ` AND d.task_id = ?`;
        params.push(String(taskId));
      }
      if (initiativeId) {
        sql += ` AND d.initiative_id = ?`;
        params.push(String(initiativeId));
      }
      if (relatedObjectId) {
        sql += ` AND (d.initiative_id = ? OR d.task_id = ? OR d.project_id = ?)`;
        params.push(relatedObjectId, relatedObjectId, relatedObjectId);
      }
      // Source lineage filter (org scope preserved above). No-ops gracefully when
      // the source_type column is absent.
      if (normalizedSourceFilter && decisionCols.has('source_type')) {
        sql += ` AND LOWER(COALESCE(d.source_type, '')) = ?`;
        params.push(normalizedSourceFilter);
      }

      sql += ` ORDER BY d.created_at DESC`;

      const limitValue = limit ? Number(limit) : undefined;
      const offsetValue = offset ? Number(offset) : undefined;
      if (Number.isFinite(limitValue)) {
        sql += ` LIMIT ?`;
        params.push(limitValue as number);
        if (Number.isFinite(offsetValue)) {
          sql += ` OFFSET ?`;
          params.push(offsetValue as number);
        }
      }

      const rows = (await queryHelpers.queryAll<DecisionRow>(sql, params)) || [];

      const decisions = await Promise.all(
        rows.map(async (row) => {
          const escalation = computeEscalationLevel(row.deadline, row.priority, row.impact);
          const statusNormalized = normalizeStatus(row.status);
          const shouldEscalate = statusNormalized === 'pending' && escalation.overdueDays > 0;
          const nextStatus = shouldEscalate ? 'escalated' : statusNormalized;
          const escalationLevel = escalation.level;

          // Persist escalation status only if the column exists (Postgres schema may omit it).
          if (nextStatus !== statusNormalized) {
            if (hasEscalationLevelCol) {
              await queryHelpers.queryRun(
                `UPDATE decisions SET status = ?, escalation_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [nextStatus, escalationLevel, row.id]
              );
            } else {
              await queryHelpers.queryRun(
                `UPDATE decisions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [nextStatus, row.id]
              );
            }
          } else if (
            hasEscalationLevelCol &&
            escalationLevel !== (row.escalation_level || 'none')
          ) {
            await queryHelpers.queryRun(
              `UPDATE decisions SET escalation_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [escalationLevel, row.id]
            );
          }

          const createdAt = row.created_at;
          const dueDate = row.deadline;
          const daysWaiting = Math.floor(
            (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
          );
          const daysUntilDue = dueDate
            ? Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null;
          const { type: relatedObjectType, id: relatedObjectIdValue } = resolveRelatedObject(row);

          return {
            id: row.id,
            title: row.title,
            description: row.description || undefined,
            decisionType: row.type,
            pmoDomain: row.pmo_domain || undefined,
            status: toApiStatus(nextStatus),
            decisionOwnerId: row.decision_maker_id,
            ownerName: row.owner_name || undefined,
            requestedById: row.created_by,
            requestedByName: row.requested_by_name || undefined,
            projectId: row.project_id || undefined,
            projectName: row.project_name || undefined,
            createdAt,
            dueDate: dueDate || undefined,
            priority: normalizePriority(row.priority),
            impact: normalizeImpact(row.impact),
            escalationLevel: escalationLevel === 'red' ? 2 : escalationLevel === 'amber' ? 1 : 0,
            escalationLevelName: escalationLevel,
            daysWaiting,
            daysUntilDue: daysUntilDue ?? undefined,
            isOverdue: escalation.overdueDays > 0,
            daysOverdue: escalation.overdueDays,
            relatedObjectType,
            relatedObjectId: relatedObjectIdValue,
            blockedItemsCount: Number(row.blocked_items_count ?? 0),
          };
        })
      );

      res.json(decisions);
    }
  );

  /**
   * Get decision bottlenecks
   */
  static getBottlenecks = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { projectId } = req.query;

      // Aging decisions
      const agingSql = `
            SELECT d.*, 
                CAST(julianday('now') - julianday(d.created_at) AS INTEGER) as days_waiting,
                u.first_name || ' ' || u.last_name as owner_name
            FROM decisions d
            LEFT JOIN users u ON d.decision_maker_id = u.id
            WHERE d.status IN ('pending', 'escalated')
            ${projectId ? 'AND d.project_id = ?' : ''}
            AND julianday('now') - julianday(d.created_at) > 5
            ORDER BY days_waiting DESC
            LIMIT 20
        `;
      const agingParams = projectId ? [projectId] : [];

      const aging = await DbPromise.all(agingSql, agingParams);

      // Blocking decisions
      const blockingSql = `
            SELECT d.*, 
                u.first_name || ' ' || u.last_name as owner_name,
                COUNT(di.id) as blocked_count
            FROM decisions d
            LEFT JOIN users u ON d.decision_maker_id = u.id
            LEFT JOIN decision_impacts di ON d.id = di.decision_id AND di.is_blocker = TRUE
            WHERE d.status IN ('pending', 'escalated')
            ${projectId ? 'AND d.project_id = ?' : ''}
            GROUP BY d.id
            HAVING blocked_count > 0
            ORDER BY blocked_count DESC
            LIMIT 20
        `;
      const blockingParams = projectId ? [projectId] : [];

      const blocking = await DbPromise.all(blockingSql, blockingParams);

      // Owner overload (too many pending decisions)
      const overloadSql = `
        SELECT d.decision_maker_id as user_id,
               u.first_name || ' ' || u.last_name as name,
               u.email as email,
               COUNT(*) as pending_count
        FROM decisions d
        LEFT JOIN users u ON d.decision_maker_id = u.id
        WHERE d.status IN ('pending', 'escalated')
        ${projectId ? 'AND d.project_id = ?' : ''}
        GROUP BY d.decision_maker_id
        HAVING pending_count >= 5
        ORDER BY pending_count DESC
        LIMIT 10
      `;
      const overloadParams = projectId ? [projectId] : [];
      const ownerOverload = await DbPromise.all(overloadSql, overloadParams);

      res.json({
        aging: (aging || []).map((row: any) => ({
          id: row.id,
          title: row.title,
          daysWaiting: row.days_waiting,
          ownerName: row.owner_name || undefined,
          decision_type: row.type,
        })),
        blocking: (blocking || []).map((row: any) => ({
          id: row.id,
          title: row.title,
          blockedCount: row.blocked_count,
          ownerName: row.owner_name || undefined,
          decision_type: row.type,
        })),
        ownerOverload: (ownerOverload || []).map((row: any) => ({
          userId: row.user_id,
          name: row.name,
          email: row.email,
          pendingCount: row.pending_count,
        })),
      });
    }
  );

  /**
   * Get single decision by ID
   */
  static getDecisionById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const sql = `
        SELECT 
          d.*,
          owner.first_name || ' ' || owner.last_name as owner_name,
          owner.avatar_url as owner_avatar_url,
          requester.first_name || ' ' || requester.last_name as requested_by_name
        FROM decisions d
        LEFT JOIN users owner ON d.decision_maker_id = owner.id
        LEFT JOIN users requester ON d.created_by = requester.id
        WHERE d.id = ?
      `;

      const decision = await queryHelpers.queryOne<DecisionRow>(sql, [id]);
      if (!decision) {
        res.status(404).json({ error: 'Decision not found' });
        return;
      }
      if (decision.organization_id !== orgId) {
        res.status(404).json({ error: 'Decision not found' });
        return;
      }

      const impacts = await queryHelpers.queryAll(
        `SELECT id, impacted_type, impacted_id, impact_description, is_blocker
         FROM decision_impacts WHERE decision_id = ? ORDER BY created_at ASC`,
        [id]
      );

      const history = await queryHelpers.queryAll(
        `SELECT
            dh.id,
            dh.action,
            dh.old_status,
            dh.new_status,
            dh.changed_by,
            dh.changed_at,
            dh.details,
            TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS changed_by_name
         FROM decision_history dh
         LEFT JOIN users u ON dh.changed_by = u.id
         WHERE dh.decision_id = ?
         ORDER BY dh.changed_at ASC`,
        [id]
      );

      const escalation = computeEscalationLevel(
        decision.deadline,
        decision.priority,
        decision.impact
      );
      const statusNormalized = normalizeStatus(decision.status);
      const shouldEscalate = statusNormalized === 'pending' && escalation.overdueDays > 0;
      const nextStatus = shouldEscalate ? 'escalated' : statusNormalized;

      if (
        nextStatus !== statusNormalized ||
        escalation.level !== (decision.escalation_level || 'none')
      ) {
        await queryHelpers.queryRun(
          `UPDATE decisions SET status = ?, escalation_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [nextStatus, escalation.level, id]
        );
      }

      const { type: relatedObjectType, id: relatedObjectId } = resolveRelatedObject(decision);

      res.json({
        id: decision.id,
        title: decision.title,
        description: decision.description || undefined,
        decisionType: decision.type,
        pmoDomain: decision.pmo_domain || undefined,
        status: toApiStatus(nextStatus),
        priority: normalizePriority(decision.priority),
        impact: normalizeImpact(decision.impact),
        escalationLevel: escalation.level === 'red' ? 2 : escalation.level === 'amber' ? 1 : 0,
        escalationLevelName: escalation.level,
        decisionOwnerId: decision.decision_maker_id,
        ownerName: decision.owner_name || undefined,
        ownerAvatarUrl: decision.owner_avatar_url || undefined,
        requestedById: decision.created_by,
        requestedByName: decision.requested_by_name || undefined,
        createdAt: decision.created_at,
        dueDate: decision.deadline || undefined,
        outcome: decision.decision_rationale || undefined,
        decidedAt: decision.decided_at || undefined,
        workflowStatus: decision.workflow_status || 'proposed',
        relatedObjectType,
        relatedObjectId,
        impacts: impacts.map((impact: any) => ({
          id: impact.id,
          impactedType: impact.impacted_type,
          impactedId: impact.impacted_id,
          impactDescription: impact.impact_description,
          isBlocker: impact.is_blocker === 1,
        })),
        auditTrail: history.map((entry: any) => ({
          id: entry.id,
          action: entry.action,
          by: entry.changed_by,
          userName: entry.changed_by_name || undefined,
          oldStatus: normalizeStatus(entry.old_status || null),
          newStatus: normalizeStatus(entry.new_status || null),
          at: entry.created_at,
          notes: parseHistoryNotes(entry.details),
          details: parseHistoryDetails(entry.details),
        })),
        audit_trail: JSON.stringify(
          history.map((entry: any) => ({
            id: entry.id,
            action: entry.action,
            by: entry.changed_by,
            userName: entry.changed_by_name || undefined,
            oldStatus: normalizeStatus(entry.old_status || null),
            newStatus: normalizeStatus(entry.new_status || null),
            at: entry.created_at,
            notes: parseHistoryNotes(entry.details),
            details: parseHistoryDetails(entry.details),
          }))
        ),
      });
    }
  );

  /**
   * Create a new decision
   */
  static createDecision = asyncHandler(
    async (req: AuthenticatedRequest<CreateDecisionRequest>, res: Response): Promise<void> => {
      const userId = req.user?.id;
      const orgId = req.user?.organizationId;
      if (!userId || !orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Check permission
      if (!req.can || !req.can('approve_changes')) {
        res.status(403).json({ error: 'Permission denied' });
        return;
      }

      const {
        projectId,
        title,
        description,
        pmoDomain,
        decisionOwnerId,
        relatedObjectType,
        relatedObjectId,
        initiativeId,
        taskId,
        dueDate,
        priority,
        impact,
        decisionType,
        type,
        impacts,
      } = req.body;

      if (!title) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const id = uuidv4();
      const dueDateValue = parseDate(dueDate || undefined);
      const normalizedDueDate = dueDateValue ? dueDateValue.toISOString() : null;
      const normalizedPriority = normalizePriority(priority);
      const normalizedImpact = normalizeImpact(impact);
      const decisionTypeValue = (decisionType || type || 'GENERAL').toString();
      const normalizedType = decisionTypeValue.toUpperCase();

      const shouldRequireDecision = [
        'INITIATIVE_APPROVAL',
        'PHASE_TRANSITION',
        'EXECUTION',
      ].includes(normalizedType);

      const initiativeIdValue =
        relatedObjectType === 'initiative' ? relatedObjectId : initiativeId || null;
      const taskIdValue = relatedObjectType === 'task' ? relatedObjectId : taskId || null;
      const projectIdValue = relatedObjectType === 'project' ? relatedObjectId : projectId || null;

      if (!projectIdValue && !initiativeIdValue && !taskIdValue) {
        res.status(400).json({ error: 'Missing decision context' });
        return;
      }

      const impactEntries = Array.isArray(impacts)
        ? impacts.map((entry: any) => ({
            impactedType: entry.impactedType,
            impactedId: entry.impactedId,
            impactDescription: entry.impactDescription,
            isBlocker: Boolean(entry.isBlocker),
          }))
        : [];

      const defaultBlockerTypes = [
        'SCOPE_CHANGE',
        'RISK_ACCEPTANCE',
        'BLOCKER_RESOLUTION',
        'PHASE_TRANSITION',
        'EXECUTION',
      ];

      if (impactEntries.length === 0 && defaultBlockerTypes.includes(normalizedType)) {
        if (taskIdValue) {
          impactEntries.push({
            impactedType: 'task',
            impactedId: taskIdValue,
            impactDescription: 'Blocking task until decision is resolved',
            isBlocker: true,
          });
        } else if (initiativeIdValue) {
          impactEntries.push({
            impactedType: 'initiative',
            impactedId: initiativeIdValue,
            impactDescription: 'Blocking initiative until decision is resolved',
            isBlocker: true,
          });
        }
      }

      const escalationDeadline =
        normalizedDueDate &&
        new Date(new Date(normalizedDueDate).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const sql = `INSERT INTO decisions (
            id, organization_id, project_id, initiative_id, task_id,
            title, description, type, decision_maker_id,
            deadline, escalation_deadline, status, created_by,
            priority, impact, escalation_level, pmo_domain, required,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;

      const relatedObjectTypeValue =
        relatedObjectType ||
        (initiativeIdValue
          ? 'initiative'
          : taskIdValue
            ? 'task'
            : projectIdValue
              ? 'project'
              : null);
      const relatedObjectIdValue =
        relatedObjectId || initiativeIdValue || taskIdValue || projectIdValue || null;

      try {
        await queryHelpers.queryRun(sql, [
          id,
          orgId,
          projectIdValue,
          initiativeIdValue,
          taskIdValue,
          title,
          description || null,
          normalizedType,
          decisionOwnerId || userId,
          normalizedDueDate,
          escalationDeadline || null,
          'pending',
          userId,
          normalizedPriority,
          normalizedImpact,
          'none',
          pmoDomain || null,
          shouldRequireDecision ? 1 : 0,
        ]);
      } catch (error) {
        const legacySql = `INSERT INTO decisions (
              id, organization_id, project_id, title, description, pmo_domain,
              decision_owner_id, related_object_type, related_object_id, due_date,
              priority, status, required, audit_trail, impact, escalation_level, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
        await queryHelpers.queryRun(legacySql, [
          id,
          orgId,
          projectIdValue,
          title,
          description || null,
          pmoDomain || null,
          decisionOwnerId || userId,
          relatedObjectTypeValue,
          relatedObjectIdValue,
          normalizedDueDate,
          normalizedPriority,
          'pending',
          shouldRequireDecision ? 1 : 0,
          JSON.stringify({ decisionType: normalizedType, createdBy: userId }),
          normalizedImpact,
          'none',
        ]);
      }

      await queryHelpers.queryRun(
        `INSERT INTO decision_history (id, decision_id, action, old_status, new_status, changed_by, details)
         VALUES (?, ?, 'created', NULL, 'pending', ?, ?)`,
        [
          uuidv4(),
          id,
          userId,
          JSON.stringify({ notes: 'Decision created', priority: normalizedPriority }),
        ]
      );

      if (impactEntries.length > 0) {
        for (const entry of impactEntries) {
          await queryHelpers.queryRun(
            `INSERT INTO decision_impacts (id, decision_id, impacted_type, impacted_id, impact_description, is_blocker)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              id,
              entry.impactedType,
              entry.impactedId,
              entry.impactDescription || null,
              entry.isBlocker ? 1 : 0,
            ]
          );
        }
      }

      // Auto-block impacted items if this decision is a blocker (PMO gate)
      if (impactEntries.length > 0) {
        const tag = DECISION_BLOCK_TAG(id);
        for (const entry of impactEntries) {
          if (!entry.isBlocker) continue;
          if (entry.impactedType === 'task') {
            await queryHelpers.queryRun(
              `UPDATE tasks SET
                status = CASE WHEN status = 'done' THEN status ELSE 'blocked' END,
                blocked_at = COALESCE(blocked_at, CURRENT_TIMESTAMP),
                blocked_by_decision_id = COALESCE(blocked_by_decision_id, ?),
                blocked_reason = CASE
                  WHEN blocked_reason IS NULL OR blocked_reason = '' THEN ?
                  ELSE blocked_reason
                END,
                updated_at = CURRENT_TIMESTAMP
               WHERE id = ? AND organization_id = ?`,
              [id, `${tag} Blocked by decision: ${title}`, entry.impactedId, orgId]
            );
          } else if (entry.impactedType === 'initiative') {
            // Fetch current status before overwriting so we can record an accurate handoff.
            const preBlockRow = await queryHelpers
              .queryOne<{ status?: string }>(
                `SELECT status FROM initiatives WHERE id = ? AND organization_id = ?`,
                [entry.impactedId, orgId]
              )
              .catch(() => null);
            const preBlockStatus = preBlockRow?.status
              ? String(preBlockRow.status).toUpperCase()
              : null;

            await queryHelpers.queryRun(
              `UPDATE initiatives SET
                status = CASE WHEN status = 'done' THEN status ELSE 'blocked' END,
                blocked_at = COALESCE(blocked_at, CURRENT_TIMESTAMP),
                blocked_reason = CASE
                  WHEN blocked_reason IS NULL OR blocked_reason = '' THEN ?
                  ELSE blocked_reason
                END,
                updated_at = CURRENT_TIMESTAMP
               WHERE id = ? AND organization_id = ?`,
              [`${tag} Blocked by decision: ${title}`, entry.impactedId, orgId]
            );

            // Best-effort handoff audit: <prevStatus> → BLOCKED (decision auto-block).
            if (preBlockStatus && preBlockStatus !== 'DONE' && preBlockStatus !== 'BLOCKED') {
              void recordStageHandoff(
                orgId,
                entry.impactedId,
                preBlockStatus,
                'BLOCKED',
                userId
              ).catch((e) =>
                logger.warn('[decision] recordStageHandoff failed (auto-block):', e)
              );
            }
          }
        }
      }

      // V4-TASK-08: Unified audit log
      auditEventsService
        .log({
          actorId: userId,
          actorType: 'USER',
          action: 'DECISION_CREATE',
          resourceType: 'decision',
          resourceId: id,
          after: {
            title,
            type: normalizedType,
            status: 'pending',
            decisionMakerId: decisionOwnerId || userId,
          },
          metadata: {
            initiativeId: initiativeIdValue,
            taskId: taskIdValue,
            projectId: projectIdValue,
          },
          organizationId: orgId,
        })
        .catch((err: any) => logger.error('[DecisionController] Audit log failed:', err?.message));

      await dispatchProjectCommunicationEvent({
        organizationId: orgId,
        projectId: projectIdValue,
        eventType: 'decision_required',
        title: `Decision required: ${title}`,
        body: `Decision "${title}" requires review${normalizedDueDate ? ` by ${new Date(normalizedDueDate).toLocaleDateString()}` : ''}.`,
        deepLink: `/decisions/${id}`,
        severity: normalizePriority(normalizedPriority) === 'CRITICAL' ? 'critical' : 'normal',
      }).catch((err: any) =>
        logger.warn('[DecisionController] Communication sync failed:', err?.message)
      );

      res.status(201).json({ id, projectId: projectIdValue, title, status: 'PENDING' });
    }
  );

  /**
   * Make a decision (approve/reject/defer)
   */
  static decide = asyncHandler(
    async (req: AuthenticatedRequest<DecideRequest>, res: Response): Promise<void> => {
      const { id } = req.params;
      const { decision, rationale, notes, status, outcome } = req.body as DecideRequest & {
        status?: string;
        outcome?: string;
      };
      const userId = req.user?.id;
      const orgId = req.user?.organizationId;
      if (!userId || !orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const statusInput = status || decision;
      if (statusInput && !isDecisionStatusInput(statusInput)) {
        res.status(400).json({ error: 'Invalid decision' });
        return;
      }
      const requestedStatus = String(statusInput || '').toLowerCase();
      const isDeferredAction = requestedStatus === 'deferred';
      const normalizedStatus = normalizeStatus(statusInput || '');
      if (!['approved', 'rejected', 'pending'].includes(normalizedStatus)) {
        res.status(400).json({ error: 'Invalid decision' });
        return;
      }

      const rationaleValue = (rationale || outcome || '').trim();
      const rationaleText =
        rationaleValue ||
        (normalizedStatus === 'approved'
          ? 'Approved'
          : normalizedStatus === 'rejected'
            ? 'Rejected'
            : '');

      // Get decision first — scoped to caller's org
      const currentDecision = await queryHelpers.queryOne<{
        decision_maker_id?: string;
        status?: string;
      }>(`SELECT * FROM decisions WHERE id = ? AND organization_id = ?`, [id, orgId]);

      if (!currentDecision) {
        res.status(404).json({ error: 'Decision not found' });
        return;
      }

      // Check if user is decision owner
      const normalizedUserRole = normalizeAdminLikeRole(req.user?.role);
      if (
        currentDecision.decision_maker_id !== userId &&
        normalizedUserRole !== 'ADMIN' &&
        normalizedUserRole !== 'SUPERADMIN'
      ) {
        res.status(403).json({ error: 'Only decision owner can decide' });
        return;
      }

      if (normalizedStatus !== 'pending' && rationaleText.trim() === '') {
        res.status(400).json({ error: 'Decision rationale is required' });
        return;
      }

      const sql = `UPDATE decisions 
                     SET status = ?, decision_rationale = ?, decided_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`;

      await queryHelpers.queryRun(sql, [normalizedStatus, rationaleText || null, id]);

      await queryHelpers.queryRun(
        `INSERT INTO decision_history (id, decision_id, action, old_status, new_status, changed_by, details)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          id,
          isDeferredAction ? 'deferred' : normalizedStatus,
          normalizeStatus(currentDecision.status || null),
          normalizedStatus,
          userId,
          JSON.stringify({
            notes: rationaleText || (isDeferredAction ? 'Deferred' : undefined),
            outcome: isDeferredAction ? 'deferred' : normalizedStatus,
          }),
        ]
      );

      // V4-TASK-08: Unified audit log
      if (orgId) {
        auditEventsService
          .log({
            actorId: userId,
            actorType: 'USER',
            action: 'DECISION_DECIDE',
            resourceType: 'decision',
            resourceId: id,
            before: { status: normalizeStatus(currentDecision.status || null) },
            after: { status: normalizedStatus, rationale: rationaleText },
            metadata: {},
            organizationId: orgId,
          })
          .catch((err: any) =>
            logger.error('[DecisionController] Audit log failed:', err?.message)
          );
      }

      // If decision is resolved, refresh blocks on impacted items
      if (orgId && normalizedStatus !== 'pending') {
        const impacts = await queryHelpers.queryAll<{
          impacted_type: string;
          impacted_id: string;
          is_blocker: number;
        }>(
          `SELECT impacted_type, impacted_id, is_blocker FROM decision_impacts WHERE decision_id = ? AND is_blocker = TRUE`,
          [id]
        );
        for (const impact of impacts || []) {
          if (impact.impacted_type === 'task') {
            await refreshTaskDecisionBlock({
              taskId: impact.impacted_id,
              organizationId: orgId,
              resolvedDecisionId: id,
            });
          } else if (impact.impacted_type === 'initiative') {
            await refreshInitiativeDecisionBlock({
              initiativeId: impact.impacted_id,
              organizationId: orgId,
              resolvedDecisionId: id,
            });
          }
        }
      }

      res.json({ id, status: normalizedStatus.toUpperCase(), decidedBy: userId });
    }
  );

  /**
   * Update a decision (delegate, reprioritize, reschedule)
   */
  static updateDecision = asyncHandler(
    async (req: AuthenticatedRequest<UpdateDecisionRequest>, res: Response): Promise<void> => {
      const { id } = req.params;
      const userId = req.user?.id;
      const orgId = req.user?.organizationId;
      if (!userId || !orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const {
        decisionOwnerId,
        dueDate,
        priority,
        impact,
        status,
        title,
        description,
        delegationNote,
      } = req.body;

      if (status && !isDecisionStatusInput(status)) {
        res.status(400).json({ error: 'Invalid decision status' });
        return;
      }

      const currentDecision = await queryHelpers.queryOne<DecisionRow>(
        `SELECT * FROM decisions WHERE id = ? AND organization_id = ?`,
        [id, orgId]
      );
      if (!currentDecision) {
        res.status(404).json({ error: 'Decision not found' });
        return;
      }

      if (
        currentDecision.created_by !== userId &&
        req.user?.role !== 'ADMIN' &&
        req.user?.role !== 'SUPERADMIN'
      ) {
        res.status(403).json({ error: 'Permission denied' });
        return;
      }

      const updates: string[] = [];
      const params: (string | number | null)[] = [];

      if (decisionOwnerId) {
        updates.push('decision_maker_id = ?');
        params.push(decisionOwnerId);
      }
      if (dueDate) {
        updates.push('deadline = ?');
        const parsedDueDate = parseDate(dueDate);
        if (parsedDueDate) {
          params.push(parsedDueDate.toISOString());
        } else {
          params.push(null);
        }
      }
      if (priority) {
        updates.push('priority = ?');
        params.push(normalizePriority(priority));
      }
      if (impact) {
        updates.push('impact = ?');
        params.push(normalizeImpact(impact));
      }
      if (status) {
        updates.push('status = ?');
        params.push(normalizeStatus(status));
      }
      if (title) {
        updates.push('title = ?');
        params.push(title);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
      }

      if (updates.length === 0) {
        res.json({ id, message: 'No changes applied' });
        return;
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      await queryHelpers.queryRun(
        `UPDATE decisions SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      await queryHelpers.queryRun(
        `INSERT INTO decision_history (id, decision_id, action, old_status, new_status, changed_by, details)
         VALUES (?, ?, 'updated', ?, ?, ?, ?)`,
        [
          uuidv4(),
          id,
          normalizeStatus(currentDecision.status),
          status ? normalizeStatus(status) : normalizeStatus(currentDecision.status),
          userId,
          JSON.stringify({ notes: delegationNote || 'Decision updated' }),
        ]
      );

      // V4-TASK-08: Unified audit log
      if (orgId) {
        auditEventsService
          .log({
            actorId: userId,
            actorType: 'USER',
            action: 'DECISION_UPDATE',
            resourceType: 'decision',
            resourceId: id,
            before: {
              title: currentDecision.title,
              status: currentDecision.status,
              priority: currentDecision.priority,
              decisionMakerId: currentDecision.decision_maker_id,
            },
            after: {
              ...(decisionOwnerId && { decisionMakerId: decisionOwnerId }),
              ...(dueDate && { dueDate }),
              ...(priority && { priority: normalizePriority(priority) }),
              ...(status && { status: normalizeStatus(status) }),
              ...(title && { title }),
            },
            metadata: {},
            organizationId: orgId,
          })
          .catch((err: any) =>
            logger.error('[DecisionController] Audit log failed:', err?.message)
          );
      }

      res.json({ id, message: 'Decision updated' });
    }
  );

  /**
   * Escalate decision
   */
  static escalateDecision = asyncHandler(
    async (req: AuthenticatedRequest<EscalateDecisionRequest>, res: Response): Promise<void> => {
      const { id } = req.params;
      const { reason, escalateToUserId } = req.body;
      const userId = req.user?.id;
      const orgId = req.user?.organizationId;
      if (!userId || !orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const currentDecision = await queryHelpers.queryOne<DecisionRow>(
        `SELECT * FROM decisions WHERE id = ? AND organization_id = ?`,
        [id, orgId]
      );

      if (!currentDecision) {
        res.status(404).json({ error: 'Decision not found' });
        return;
      }

      const nextOwner = escalateToUserId || currentDecision.decision_maker_id;
      const escalationLevel =
        normalizePriority(currentDecision.priority) === 'CRITICAL' ||
        normalizeImpact(currentDecision.impact) === 'HIGH'
          ? 'red'
          : 'amber';

      await queryHelpers.queryRun(
        `UPDATE decisions SET status = 'escalated', escalation_level = ?, decision_maker_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [escalationLevel, nextOwner, id]
      );

      await queryHelpers.queryRun(
        `INSERT INTO decision_history (id, decision_id, action, old_status, new_status, changed_by, details)
         VALUES (?, ?, 'escalated', ?, 'escalated', ?, ?)`,
        [
          uuidv4(),
          id,
          normalizeStatus(currentDecision.status),
          userId,
          JSON.stringify({ notes: reason || 'Escalated', escalatedTo: nextOwner }),
        ]
      );

      res.json({ id, message: 'Decision escalated', escalatedBy: userId });
    }
  );

  /**
   * Remind / nudge a decision owner
   *
   * POST /api/decisions/:id/remind
   * Body: { message?: string }
   *
   * Policy:
   * - Allowed for requester (created_by) and admins.
   * - Rate limit: max 1 reminder per decision per requester per 24h.
   * - Writes audit entry to decision_history.
   */
  static remindDecision = asyncHandler(
    async (req: AuthenticatedRequest<RemindDecisionRequest>, res: Response): Promise<void> => {
      const { id } = req.params;
      const userId = req.user?.id;
      const orgId = req.user?.organizationId;
      if (!userId || !orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const message =
        typeof (req.body as any)?.message === 'string'
          ? String((req.body as any).message).trim()
          : '';

      const decision = await queryHelpers.queryOne<{
        id: string;
        title?: string | null;
        status?: string | null;
        decision_maker_id?: string | null;
        created_by?: string | null;
        organization_id?: string | null;
      }>(
        `SELECT id, title, status, decision_maker_id, created_by, organization_id
         FROM decisions
         WHERE id = ? AND organization_id = ?
         LIMIT 1`,
        [id, orgId]
      );

      if (!decision) {
        res.status(404).json({ error: 'Decision not found' });
        return;
      }

      const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN';
      if (!isAdmin && String(decision.created_by || '') !== String(userId)) {
        res.status(403).json({ error: 'Only requester can remind' });
        return;
      }

      const ownerId = String(decision.decision_maker_id || '').trim();
      if (!ownerId) {
        res.status(400).json({ error: 'Decision has no owner' });
        return;
      }

      // 24h rate limit per decision+requester (best-effort; if history is missing we still send).
      try {
        const last = await queryHelpers.queryOne<{ created_at?: string | null }>(
          `
          SELECT created_at
          FROM decision_history
          WHERE decision_id = ?
            AND lower(coalesce(action,'')) = 'reminded'
            AND changed_by = ?
          ORDER BY created_at DESC
          LIMIT 1
        `,
          [id, userId]
        );
        const lastIso = last?.created_at ? String(last.created_at) : '';
        if (lastIso) {
          const diffMs = Date.now() - new Date(lastIso).getTime();
          if (Number.isFinite(diffMs) && diffMs < 24 * 60 * 60 * 1000) {
            res
              .status(429)
              .json({ error: 'Reminder already sent recently', lastRemindedAt: lastIso });
            return;
          }
        }
      } catch (e) {
        // If history table/schema is missing in some envs, don't fail remind entirely.
        logger.warn(
          '[Decision.remindDecision] Rate-limit check failed (continuing):',
          (e as any)?.message || e
        );
      }

      const title = String(decision.title || 'Decision');
      const body = message || `Reminder: please review and decide on "${title}".`;

      await NotificationService.send({
        userId: ownerId,
        organizationId: orgId,
        type: 'DECISION_REMINDER',
        title: 'Decision reminder',
        body,
        entityType: 'decision',
        entityId: id,
        priority: 'normal',
      });

      // Audit trail
      try {
        await queryHelpers.queryRun(
          `INSERT INTO decision_history (id, decision_id, action, old_status, new_status, changed_by, details)
           VALUES (?, ?, 'reminded', ?, ?, ?, ?)`,
          [
            uuidv4(),
            id,
            normalizeStatus(decision.status || null),
            normalizeStatus(decision.status || null),
            userId,
            JSON.stringify({
              notes: message || 'Reminder sent',
              remindedTo: ownerId,
            }),
          ]
        );
      } catch (e) {
        logger.warn(
          '[Decision.remindDecision] decision_history insert failed (continuing):',
          (e as any)?.message || e
        );
      }

      res.json({ success: true, id, remindedTo: ownerId, remindedAt: new Date().toISOString() });
    }
  );

  /**
   * V4-EXEC-06: Get tasks created from a published decision
   * GET /api/decisions/:id/created-tasks
   */
  static getCreatedTasks = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const decision = await queryHelpers.queryOne<{ id: string }>(
        `SELECT id FROM decisions WHERE id = ? AND organization_id = ? LIMIT 1`,
        [id, orgId]
      );
      if (!decision) {
        res.status(404).json({ error: 'Decision not found' });
        return;
      }

      let tasks: any[] = [];
      try {
        tasks = await queryHelpers.queryAll(
          `SELECT t.id, t.title, t.status, t.assignee_id,
                  u.first_name || ' ' || u.last_name as assignee_name
           FROM tasks t
           LEFT JOIN users u ON t.assignee_id = u.id
           WHERE t.source_type = 'decision' AND t.source_id = ? AND t.organization_id = ?
           ORDER BY t.created_at ASC`,
          [id, orgId]
        );
      } catch (_e) {
        tasks = [];
      }

      res.json({
        decisionId: id,
        tasks: tasks.map((t: any) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          assigneeId: t.assignee_id || null,
          assigneeName: t.assignee_name || null,
        })),
      });
    }
  );

  /**
   * V4-EXEC-06: Decision workflow — propose→review→approve→publish; auto-create tasks on publish
   * PATCH /api/decisions/:id/workflow
   * Body: { toStatus: 'proposed'|'review'|'approve'|'published' }
   */
  static transitionWorkflow = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const userId = req.user?.id;
      const orgId = req.user?.organizationId;
      if (!userId || !orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const toStatus = (req.body as { toStatus?: string })?.toStatus;
      if (
        !toStatus ||
        !['proposed', 'review', 'approve', 'published', 'publish'].includes(
          String(toStatus).toLowerCase()
        )
      ) {
        res.status(400).json({
          error: 'toStatus required',
          allowed: ['proposed', 'review', 'approve', 'published'],
        });
        return;
      }

      const decision = await queryHelpers.queryOne<{
        id: string;
        workflow_status?: string | null;
        initiative_id?: string | null;
        project_id?: string | null;
        title?: string | null;
        description?: string | null;
        status?: string | null;
        playbook_id?: string | null;
        type?: string | null;
        priority?: string | null;
        impact?: string | null;
        deadline?: string | null;
        decision_maker_id?: string | null;
        decision_rationale?: string | null;
        options?: string | null;
      }>(
        `SELECT id, workflow_status, initiative_id, project_id, title, description, status, playbook_id, type, priority, impact, deadline, decision_maker_id, decision_rationale, options FROM decisions WHERE id = ? AND organization_id = ? LIMIT 1`,
        [id, orgId]
      );

      if (!decision) {
        res.status(404).json({ error: 'Decision not found' });
        return;
      }

      const currentWorkflow = String(decision.workflow_status || 'proposed').toLowerCase();
      const targetWorkflow: DecisionWorkflowStatus =
        String(toStatus).toLowerCase() === 'publish'
          ? 'published'
          : (String(toStatus).toLowerCase() as DecisionWorkflowStatus);

      const validation = validateDecisionWorkflowTransition(currentWorkflow, targetWorkflow);
      if (!validation.allowed) {
        res
          .status(400)
          .json({ error: (validation as { allowed: false; message: string }).message });
        return;
      }

      // V4-TASK-07: Check required fields from playbook before allowing transition
      try {
        let playbookRow: any = null;
        if (decision.playbook_id) {
          playbookRow = await queryHelpers.queryOne(
            `SELECT * FROM decision_playbooks WHERE id = ? AND organization_id = ?`,
            [decision.playbook_id, orgId]
          );
        }
        if (!playbookRow && decision.type) {
          playbookRow = await queryHelpers.queryOne(
            `SELECT * FROM decision_playbooks WHERE organization_id = ? AND decision_type = ? AND is_default = true AND is_active = true LIMIT 1`,
            [orgId, decision.type]
          );
        }
        if (playbookRow) {
          const playbook: DecisionPlaybook = {
            id: playbookRow.id,
            organizationId: playbookRow.organization_id,
            name: playbookRow.name,
            description: playbookRow.description ?? undefined,
            decisionType: playbookRow.decision_type,
            requiredFields: JSON.parse(playbookRow.required_fields_json || '[]'),
            workflowStages: JSON.parse(playbookRow.workflow_stages_json || '[]'),
            approvalConfig: playbookRow.approval_config_json
              ? JSON.parse(playbookRow.approval_config_json)
              : undefined,
            isDefault: Boolean(playbookRow.is_default),
            isActive: Boolean(playbookRow.is_active),
          };
          const decisionData: Record<string, unknown> = {
            title: decision.title,
            description: decision.description,
            priority: decision.priority,
            impact: decision.impact,
            deadline: decision.deadline,
            decisionMakerId: decision.decision_maker_id,
            rationale: decision.decision_rationale,
          };
          const fieldsCheck = validateRequiredFields(playbook, decisionData, targetWorkflow);
          if (!fieldsCheck.complete) {
            res.status(400).json({
              error: 'Required fields are incomplete for this workflow stage',
              missing: fieldsCheck.missing,
              playbook: { id: playbook.id, name: playbook.name },
            });
            return;
          }
        }
      } catch (err: any) {
        logger.warn(
          '[DecisionController.transitionWorkflow] Playbook check failed (continuing):',
          err?.message
        );
      }

      const hasWorkflowCol = (await getTableColumns('decisions'))?.has?.('workflow_status') ?? true;
      if (hasWorkflowCol) {
        await queryHelpers.queryRun(
          `UPDATE decisions SET workflow_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [targetWorkflow, id]
        );
      }

      const createdTaskIds: string[] = [];
      if (targetWorkflow === 'published') {
        const now = new Date().toISOString();

        let parsedOptions: Array<{ id?: string; label?: string; description?: string }> = [];
        try {
          parsedOptions = JSON.parse(decision.options || '[]');
          if (!Array.isArray(parsedOptions)) parsedOptions = [];
        } catch {
          parsedOptions = [];
        }

        const taskSources =
          parsedOptions.length > 0
            ? parsedOptions.map((opt) => ({
                title: `Implement: ${String(opt.label || opt.id || 'Option').slice(0, 200)}`,
                description: opt.description || null,
              }))
            : [
                {
                  title: `Implement: ${String(decision.title || 'Decision').slice(0, 200)}`,
                  description: decision.description || null,
                },
              ];

        const hasLinkGraph = (await getTableColumns('link_graph_edges'))?.size > 0;

        for (const src of taskSources) {
          const taskId = uuidv4();
          try {
            try {
              await queryHelpers.queryRun(
                `INSERT INTO tasks (id, organization_id, initiative_id, project_id, title, description, status, created_by, created_at, updated_at, source_type, source_id)
                 VALUES (?, ?, ?, ?, ?, ?, 'todo', ?, ?, ?, 'decision', ?)`,
                [
                  taskId,
                  orgId,
                  decision.initiative_id ?? null,
                  decision.project_id ?? null,
                  src.title,
                  src.description,
                  userId,
                  now,
                  now,
                  id,
                ]
              );
            } catch (_e) {
              await queryHelpers.queryRun(
                `INSERT INTO tasks (id, organization_id, initiative_id, project_id, title, description, status, created_by, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, 'todo', ?, ?, ?)`,
                [
                  taskId,
                  orgId,
                  decision.initiative_id ?? null,
                  decision.project_id ?? null,
                  src.title,
                  src.description,
                  userId,
                  now,
                  now,
                ]
              );
            }
            createdTaskIds.push(taskId);

            if (hasLinkGraph) {
              const edgeId = uuidv4();
              try {
                await queryHelpers.queryRun(
                  `INSERT INTO link_graph_edges (id, organization_id, created_by, source_type, source_id, target_type, target_id, relation, created_at)
                   VALUES (?, ?, ?, 'decision', ?, 'task', ?, 'created_from', ?)`,
                  [edgeId, orgId, userId, id, taskId, now]
                );
              } catch (linkErr: any) {
                logger.warn(
                  '[DecisionController.transitionWorkflow] LinkGraph edge failed:',
                  linkErr?.message
                );
              }
            }

            auditEventsService
              .log({
                actorId: userId,
                actorType: 'USER',
                action: 'TASK_CREATE',
                resourceType: 'task',
                resourceId: taskId,
                after: { title: src.title, status: 'todo', sourceType: 'decision', sourceId: id },
                metadata: { decisionId: id },
                organizationId: orgId,
              })
              .catch((e: any) =>
                logger.warn('[DecisionController] Task audit log failed:', e?.message)
              );
          } catch (err: any) {
            logger.warn(
              '[DecisionController.transitionWorkflow] Auto-create task failed:',
              err?.message
            );
          }
        }
      }

      await auditEventsService
        .log({
          actorId: userId,
          actorType: 'USER',
          action: 'DECISION_WORKFLOW_TRANSITION',
          resourceType: 'decision',
          resourceId: id,
          before: { workflowStatus: currentWorkflow },
          after: { workflowStatus: targetWorkflow, createdTaskIds },
          metadata: {},
          organizationId: orgId,
        })
        .catch((e: any) => logger.warn('[DecisionController] Audit log failed:', e?.message));

      res.json({
        id,
        workflowStatus: targetWorkflow,
        createdTaskIds,
      });
    }
  );
}

export default DecisionController;
