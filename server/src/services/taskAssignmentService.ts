/**
 * Task Assignment Service
 *
 * PMO Standards Compliant Task Assignment with SLA and Escalation
 */

import { v4 as uuid } from 'uuid';

import ActivityService from '../services/ActivityService.js';
import DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { normalizeProjectRole } from '../utils/roleNormalization.js';
import notificationService from './notificationService.js';
import { PMO_DOMAIN_IDS } from './pmoDomainRegistry.js';
import PMOStandardsMapping from './pmoStandardsMapping.js';
import ProjectMemberService from './projectMemberService.js';

/**
 * Default SLA hours by priority
 */
export const SLA_HOURS_BY_PRIORITY: Record<string, number> = {
  urgent: 8,
  high: 24,
  medium: 48,
  low: 72,
};

/**
 * Escalation levels
 */
export const ESCALATION_LEVELS = {
  NONE: 0,
  INITIATIVE_OWNER: 1,
  PMO_LEAD: 2,
  SPONSOR: 3,
} as const;

/**
 * Escalation trigger types
 */
export const ESCALATION_TRIGGERS = {
  SLA_BREACH: 'SLA_BREACH',
  BLOCKED: 'BLOCKED',
  MANUAL: 'MANUAL',
  PRIORITY_CHANGE: 'PRIORITY_CHANGE',
} as const;

export class TaskAssignmentService {
  /**
   * Check overdue tasks and notify key stakeholders (assignee + owner + backup).
   * Canon: if work is not realized on time, notify execution + ownership + backup.
   *
   * Anti-spam: send at most once per 24h per task via `tasks.last_overdue_notified_at`.
   */
  static async checkAndNotifyOverdueStakeholders(options: any = {}): Promise<{
    processed: number;
    notified: number;
    skipped: number;
    failed: number;
  }> {
    const { limit = 200 } = options;
    const nowIso = new Date().toISOString();

    // Prefer due_date if present; fallback to sla_due_at.
    // Use lower(status) to be resilient to mixed casing in DB.
    const tasks: any[] = await DbPromise.all(
      `SELECT
          id, organization_id, project_id, title, priority, status,
          due_date, sla_due_at,
          assignee_id, owner_id, backup_assignee_id,
          last_overdue_notified_at
        FROM tasks
        WHERE
          (
            (due_date IS NOT NULL AND due_date < ?)
            OR
            (sla_due_at IS NOT NULL AND sla_due_at < ?)
          )
          AND lower(status) NOT IN ('done', 'completed', 'cancelled')
          AND (
            last_overdue_notified_at IS NULL
            OR last_overdue_notified_at < datetime('now', '-24 hours')
          )
        ORDER BY coalesce(due_date, sla_due_at) ASC
        LIMIT ?`,
      [nowIso, nowIso, limit]
    );

    const results = { processed: 0, notified: 0, skipped: 0, failed: 0 };

    for (const task of tasks || []) {
      results.processed++;
      try {
        const due = task.due_date || task.sla_due_at || null;
        const dueMs = due ? new Date(due).getTime() : NaN;
        const overdueDays =
          !due || Number.isNaN(dueMs)
            ? null
            : Math.max(1, Math.floor((Date.now() - dueMs) / (1000 * 60 * 60 * 24)));

        const recipients = new Set<string>();
        if (task.assignee_id) recipients.add(String(task.assignee_id));
        if (task.owner_id) recipients.add(String(task.owner_id));
        if (task.backup_assignee_id) recipients.add(String(task.backup_assignee_id));

        if (recipients.size === 0) {
          results.skipped++;
          continue;
        }

        const priority = String(task.priority || '').toLowerCase();
        const notifPriority =
          priority === 'critical' || priority === 'urgent'
            ? 'urgent'
            : overdueDays && overdueDays >= 3
              ? 'high'
              : 'normal';

        const title = overdueDays ? `Task overdue (${overdueDays}d)` : 'Task overdue';
        const bodyBase = `Task "${task.title}" is overdue${due ? ` (due: ${String(due).slice(0, 10)})` : ''}.`;

        for (const userId of recipients) {
          const isBackup = userId === String(task.backup_assignee_id || '');
          await notificationService.send({
            userId,
            organizationId: task.organization_id,
            type: isBackup ? 'task_overdue_backup' : 'task_overdue',
            title: isBackup ? `${title} • backup` : title,
            body: isBackup ? `${bodyBase} You are listed as backup for this task.` : bodyBase,
            entityType: 'task',
            entityId: task.id,
            actionUrl: '/my-work',
            priority: notifPriority,
          });
          results.notified++;
        }

        // Mark as notified (single timestamp gates the whole recipient set)
        await DbPromise.run(
          `UPDATE tasks SET last_overdue_notified_at = ?, updated_at = ? WHERE id = ?`,
          [nowIso, nowIso, task.id]
        );
      } catch (err: any) {
        results.failed++;
        logger.warn('[TaskAssignmentService] Overdue stakeholder notification failed:', {
          taskId: task?.id,
          error: err?.message || String(err),
        });
      }
    }

    return results;
  }

  /**
   * Assign a task to a user
   */
  static async assignTask(taskId: string, assigneeId: string, options: any = {}): Promise<any> {
    const { assignedById, slaHours } = options;

    // Get task
    const task: any = await DbPromise.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      throw new Error('Task not found');
    }

    // Validate assignee is a project member
    const projectId = task.project_id;
    const member = await ProjectMemberService.getMember(projectId, assigneeId);
    if (!member) {
      throw new Error('User is not a member of this project');
    }

    // Check if assignee has permission to be assigned tasks
    const normalizedAssigneeRole = normalizeProjectRole(member.projectRole);
    const canBeAssigned = [
      'TASK_ASSIGNEE',
      'INITIATIVE_OWNER',
      'WORKSTREAM_OWNER',
      'PROJECT_LEADER',
      'PMO',
      'CONSULTANT',
    ].includes(String(normalizedAssigneeRole || ''));

    if (!canBeAssigned) {
      throw new Error(`User with role ${member.projectRole} cannot be assigned tasks`);
    }

    // Calculate SLA
    const effectiveSlaHours = slaHours || SLA_HOURS_BY_PRIORITY[task.priority] || 24;
    const now = new Date();
    const slaDueAt = new Date(now.getTime() + effectiveSlaHours * 60 * 60 * 1000).toISOString();

    // Update task
    await DbPromise.run(
      `UPDATE tasks 
       SET assignee_id = ?, 
           sla_hours = ?, 
           sla_due_at = ?,
           escalation_level = 0,
           escalated_to_id = NULL,
           last_escalated_at = NULL,
           last_overdue_notified_at = NULL,
           updated_at = ?
       WHERE id = ?`,
      [assigneeId, effectiveSlaHours, slaDueAt, now.toISOString(), taskId]
    );

    // Log to audit trail
    await TaskAssignmentService._logAudit(projectId, 'TASK_ASSIGNED', {
      taskId,
      assigneeId,
      assignedById,
      slaHours: effectiveSlaHours,
      slaDueAt,
    });

    // Create activity entry
    await this._createActivity(projectId, taskId, 'TASK_ASSIGNED', {
      assigneeId,
      assignedById,
    });

    return this.getTask(taskId);
  }

  /**
   * Reassign a task to a different user
   */
  static async reassignTask(
    taskId: string,
    newAssigneeId: string,
    options: any = {}
  ): Promise<any> {
    const { reassignedById, reason, resetSla = true } = options;

    const task: any = await DbPromise.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      throw new Error('Task not found');
    }

    const oldAssigneeId = task.assignee_id;

    // Use assignTask for actual assignment
    const result = await this.assignTask(taskId, newAssigneeId, {
      assignedById: reassignedById,
      slaHours: resetSla ? SLA_HOURS_BY_PRIORITY[task.priority] || 24 : task.sla_hours,
    });

    // Log reassignment
    await TaskAssignmentService._logAudit(task.project_id, 'TASK_REASSIGNED', {
      taskId,
      oldAssigneeId,
      newAssigneeId,
      reassignedById,
      reason,
    });

    return result;
  }

  /**
   * Unassign a task
   */
  static async unassignTask(taskId: string, _options: any = {}): Promise<any> {
    const task: any = await DbPromise.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      throw new Error('Task not found');
    }

    await DbPromise.run(
      `UPDATE tasks 
       SET assignee_id = NULL, 
           sla_due_at = NULL,
           escalation_level = 0,
           escalated_to_id = NULL,
           last_escalated_at = NULL,
           last_overdue_notified_at = NULL,
           updated_at = ?
       WHERE id = ?`,
      [new Date().toISOString(), taskId]
    );

    await TaskAssignmentService._logAudit(task.project_id, 'TASK_UNASSIGNED', {
      taskId,
      previousAssigneeId: task.assignee_id,
    });

    return this.getTask(taskId);
  }

  /**
   * Escalate a task
   */
  static async escalateTask(taskId: string, options: any = {}): Promise<any> {
    const { reason, triggerType = ESCALATION_TRIGGERS.MANUAL, escalatedById } = options;

    const task: any = await DbPromise.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      throw new Error('Task not found');
    }

    const currentLevel = task.escalation_level || 0;
    if (currentLevel >= 3) {
      throw new Error('Task is already at maximum escalation level');
    }

    const newLevel = currentLevel + 1;

    // Get escalation recipients
    const recipients = await ProjectMemberService.getEscalationRecipients(
      task.project_id,
      newLevel
    );

    if (recipients.length === 0) {
      throw new Error(`No recipients found for escalation level ${newLevel}`);
    }

    const escalatedToId = recipients[0].userId;
    const now = new Date().toISOString();

    // Update task
    await DbPromise.run(
      `UPDATE tasks 
       SET escalation_level = ?, 
           escalated_to_id = ?,
           last_escalated_at = ?,
           updated_at = ?
       WHERE id = ?`,
      [newLevel, escalatedToId, now, now, taskId]
    );

    // Create escalation record
    const escalationId = uuid();
    await DbPromise.run(
      `INSERT INTO task_escalations 
       (id, task_id, project_id, from_level, to_level, escalated_to_id, reason, trigger_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        escalationId,
        taskId,
        task.project_id,
        currentLevel,
        newLevel,
        escalatedToId,
        reason || 'Escalated due to SLA breach or blocker',
        triggerType,
        now,
      ]
    );

    // Log to audit trail
    await TaskAssignmentService._logAudit(task.project_id, 'TASK_ESCALATED', {
      taskId,
      fromLevel: currentLevel,
      toLevel: newLevel,
      escalatedToId,
      reason,
      triggerType,
      escalatedById,
    });

    // Notify escalation recipient
    await this._notifyEscalation(task, recipients[0], newLevel, reason);

    return {
      task: await this.getTask(taskId),
      escalation: {
        id: escalationId,
        fromLevel: currentLevel,
        toLevel: newLevel,
        escalatedTo: recipients[0],
        reason,
        triggerType,
        createdAt: now,
      },
    };
  }

  /**
   * Resolve an escalation
   */
  static async resolveEscalation(escalationId: string, options: any = {}): Promise<any> {
    const { resolutionNote, resolvedById } = options;

    const escalation: any = await DbPromise.get('SELECT * FROM task_escalations WHERE id = ?', [
      escalationId,
    ]);
    if (!escalation) {
      throw new Error('Escalation not found');
    }

    const now = new Date().toISOString();

    await DbPromise.run(
      `UPDATE task_escalations 
       SET resolved_at = ?, resolution_note = ?
       WHERE id = ?`,
      [now, resolutionNote || null, escalationId]
    );

    // Reset task escalation level if this was the latest
    const latestEscalation = await DbPromise.get(
      `SELECT id FROM task_escalations 
       WHERE task_id = ? AND resolved_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [escalation.task_id]
    );

    if (!latestEscalation) {
      await DbPromise.run(
        `UPDATE tasks 
         SET escalation_level = 0, escalated_to_id = NULL
         WHERE id = ?`,
        [escalation.task_id]
      );
    }

    await TaskAssignmentService._logAudit(escalation.project_id, 'ESCALATION_RESOLVED', {
      escalationId,
      taskId: escalation.task_id,
      resolutionNote,
      resolvedById,
    });

    return DbPromise.get('SELECT * FROM task_escalations WHERE id = ?', [escalationId]);
  }

  /**
   * Check and escalate overdue tasks (for cron job)
   */
  static async checkAndEscalateOverdue(options: any = {}): Promise<any> {
    const { limit = 100 } = options;
    const now = new Date().toISOString();

    // Find tasks that are overdue and not at max escalation
    const overdueTasks: any[] = await DbPromise.all(
      `SELECT * FROM tasks 
       WHERE sla_due_at IS NOT NULL 
         AND sla_due_at < ?
         AND status NOT IN ('DONE', 'COMPLETED', 'CANCELLED')
         AND escalation_level < 3
         AND (last_escalated_at IS NULL OR last_escalated_at < datetime('now', '-24 hours'))
       ORDER BY sla_due_at ASC
       LIMIT ?`,
      [now, limit]
    );

    const results: any = {
      processed: 0,
      escalated: 0,
      failed: 0,
      tasks: [],
    };

    for (const task of overdueTasks) {
      results.processed++;
      try {
        const result = await this.escalateTask(task.id, {
          reason: `SLA breached: Task was due at ${task.sla_due_at}`,
          triggerType: ESCALATION_TRIGGERS.SLA_BREACH,
        });
        results.escalated++;
        results.tasks.push({
          taskId: task.id,
          title: task.title,
          newLevel: result.escalation.toLevel,
          success: true,
        });
      } catch (err: any) {
        results.failed++;
        results.tasks.push({
          taskId: task.id,
          title: task.title,
          success: false,
          error: err.message,
        });
      }
    }

    return results;
  }

  /**
   * Get overdue tasks for a project
   */
  static async getOverdueTasks(projectId: string, options: any = {}): Promise<any[]> {
    const now = new Date().toISOString();

    let query = `
      SELECT t.*, u.first_name, u.last_name, u.email
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assignee_id
      WHERE t.project_id = ?
        AND t.sla_due_at IS NOT NULL
        AND t.sla_due_at < ?
        AND t.status NOT IN ('DONE', 'COMPLETED', 'CANCELLED')
    `;
    const params: any[] = [projectId, now];

    if (options.escalationLevel !== undefined) {
      query += ' AND t.escalation_level = ?';
      params.push(options.escalationLevel);
    }

    query += ' ORDER BY t.sla_due_at ASC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    const tasks: any[] = await DbPromise.all(query, params);
    return tasks.map((t) => this._formatTask(t));
  }

  /**
   * Get tasks approaching SLA deadline
   */
  static async getTasksApproachingSLA(projectId: string, hoursAhead = 4): Promise<any[]> {
    const now = new Date();
    const threshold = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000).toISOString();

    const tasks: any[] = await DbPromise.all(
      `SELECT t.*, u.first_name, u.last_name, u.email
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.project_id = ?
         AND t.sla_due_at IS NOT NULL
         AND t.sla_due_at > ?
         AND t.sla_due_at <= ?
         AND t.status NOT IN ('DONE', 'COMPLETED', 'CANCELLED')
       ORDER BY t.sla_due_at ASC`,
      [projectId, now.toISOString(), threshold]
    );

    return tasks.map((t) => this._formatTask(t));
  }

  /**
   * Get escalation history for a task
   */
  static async getTaskEscalationHistory(taskId: string): Promise<any[]> {
    const escalations: any[] = await DbPromise.all(
      `SELECT e.*, u.first_name, u.last_name
       FROM task_escalations e
       LEFT JOIN users u ON u.id = e.escalated_to_id
       WHERE e.task_id = ?
       ORDER BY e.created_at DESC`,
      [taskId]
    );

    return escalations.map((e) => ({
      id: e.id,
      taskId: e.task_id,
      fromLevel: e.from_level,
      toLevel: e.to_level,
      escalatedToId: e.escalated_to_id,
      escalatedToName: e.first_name && e.last_name ? `${e.first_name} ${e.last_name}` : null,
      reason: e.reason,
      triggerType: e.trigger_type,
      resolvedAt: e.resolved_at,
      resolutionNote: e.resolution_note,
      createdAt: e.created_at,
    }));
  }

  /**
   * Get task with all PMO fields
   */
  static async getTask(taskId: string): Promise<any | null> {
    const task = await DbPromise.get(
      `SELECT t.*, 
              u.first_name as assignee_first_name, 
              u.last_name as assignee_last_name,
              u.email as assignee_email,
              e.first_name as escalated_to_first_name,
              e.last_name as escalated_to_last_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       LEFT JOIN users e ON e.id = t.escalated_to_id
       WHERE t.id = ?`,
      [taskId]
    );

    if (!task) return null;
    return this._formatTask(task);
  }

  /**
   * Get user workload (assigned tasks and their status)
   */
  static async getUserWorkload(userId: string, options: any = {}): Promise<any> {
    const { projectId, organizationId } = options;

    if (!organizationId) {
      throw new Error('organizationId is required to read task workload');
    }

    let query = `
      SELECT t.project_id, t.status, t.priority, t.sla_due_at, t.escalation_level,
             p.name as project_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE t.assignee_id = ?
        AND t.organization_id = ?
        AND p.organization_id = ?
        AND t.status NOT IN ('DONE', 'COMPLETED', 'CANCELLED')
    `;
    const params: any[] = [userId, organizationId, organizationId];

    if (projectId) {
      query += ' AND t.project_id = ?';
      params.push(projectId);
    }

    const tasks: any[] = await DbPromise.all<any>(query, params);
    const now = new Date();

    const byProject: any = {};
    let total = 0;
    let overdue = 0;
    let atRisk = 0; // Within 4 hours of SLA

    for (const task of tasks) {
      total++;

      if (task.sla_due_at) {
        const slaDue = new Date(task.sla_due_at);
        if (slaDue < now) {
          overdue++;
        } else if (slaDue.getTime() - now.getTime() < 4 * 60 * 60 * 1000) {
          atRisk++;
        }
      }

      if (!byProject[task.project_id]) {
        byProject[task.project_id] = {
          projectId: task.project_id,
          projectName: task.project_name,
          count: 0,
          overdue: 0,
          byStatus: {} as Record<string, number>,
        };
      }
      byProject[task.project_id].count++;
      byProject[task.project_id].byStatus[task.status] =
        (byProject[task.project_id].byStatus[task.status] || 0) + 1;

      if (task.sla_due_at && new Date(task.sla_due_at) < now) {
        byProject[task.project_id].overdue++;
      }
    }

    return {
      userId,
      total,
      overdue,
      atRisk,
      byProject: Object.values(byProject),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Format task from DB to API response
   * @private
   */
  private static _formatTask(row: any): any {
    const now = new Date();
    const slaDueAt = row.sla_due_at ? new Date(row.sla_due_at) : null;

    let slaStatus = 'OK';
    if (slaDueAt) {
      if (slaDueAt < now) {
        slaStatus = 'BREACHED';
      } else if (slaDueAt.getTime() - now.getTime() < 4 * 60 * 60 * 1000) {
        slaStatus = 'AT_RISK';
      }
    }

    return {
      id: row.id,
      projectId: row.project_id,
      initiativeId: row.initiative_id,
      workstreamId: row.workstream_id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      assigneeId: row.assignee_id,
      assigneeName:
        row.assignee_first_name && row.assignee_last_name
          ? `${row.assignee_first_name} ${row.assignee_last_name}`
          : null,
      assigneeEmail: row.assignee_email,
      dueDate: row.due_date,
      slaHours: row.sla_hours,
      slaDueAt: row.sla_due_at,
      slaStatus,
      escalationLevel: row.escalation_level || 0,
      escalatedToId: row.escalated_to_id,
      escalatedToName:
        row.escalated_to_first_name && row.escalated_to_last_name
          ? `${row.escalated_to_first_name} ${row.escalated_to_last_name}`
          : null,
      lastEscalatedAt: row.last_escalated_at,
      progress: row.progress,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    };
  }

  /**
   * Create activity log entry using ActivityService
   * @private
   */
  private static async _createActivity(
    projectId: string,
    taskId: string,
    type: string,
    data: any
  ): Promise<void> {
    try {
      // Get organization_id from project
      const project = (await DbPromise.get<any>(
        'SELECT organization_id FROM projects WHERE id = ?',
        [projectId]
      )) as { organization_id: string } | undefined;

      if (project?.organization_id && ActivityService?.log) {
        await ActivityService.log({
          organizationId: project.organization_id,
          userId: data.assignedById || data.escalatedById || null,
          action: type,
          entityType: 'TASK',
          entityId: taskId,
          entityName: data.taskTitle || null,
          newValue: data,
        });
      }
    } catch (err: any) {
      logger.error('[TaskAssignmentService] Activity log failed:', err.message);
    }
  }

  /**
   * Notify escalation recipient
   * @private
   */
  private static async _notifyEscalation(
    task: any,
    recipient: any,
    level: number,
    reason: string
  ): Promise<void> {
    try {
      const levelNames: Record<number, string> = {
        1: 'Initiative Owner',
        2: 'PMO Lead',
        3: 'Project Sponsor',
      };

      await notificationService.send({
        userId: recipient.userId,
        organizationId: task.organization_id,
        type: 'task_escalated',
        title: `Task escalated to ${levelNames[level] || `Level ${level}`}`,
        body: `Task "${task.title}" has been escalated. Reason: ${reason}`,
        entityType: 'task',
        entityId: task.id,
        actionUrl: '/my-work',
        priority: level >= 3 ? 'urgent' : level >= 2 ? 'high' : 'normal',
      });

      logger.info(
        `[ESCALATION] Notification sent to ${recipient.firstName} ${recipient.lastName} (${recipient.email})`
      );
    } catch (err: any) {
      logger.error(`[ESCALATION] Failed to send notification: ${err.message}`);
    }
  }

  /**
   * Log to PMO audit trail
   * @private
   */
  private static async _logAudit(
    projectId: string,
    action: string,
    metadata: any = {}
  ): Promise<void> {
    try {
      const mapping = action.includes('ESCALAT')
        ? PMOStandardsMapping.getMapping('Escalation')
        : PMOStandardsMapping.getMapping('Task');

      await DbPromise.run(
        `INSERT INTO pmo_audit_trail 
         (id, project_id, pmo_domain_id, pmo_phase, object_type, object_id, action, actor_id,
          iso21500_mapping, pmbok_mapping, prince2_mapping, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid(),
          projectId,
          action.includes('ESCALAT')
            ? PMO_DOMAIN_IDS.GOVERNANCE_DECISION_MAKING
            : PMO_DOMAIN_IDS.SCOPE_CHANGE_CONTROL,
          null,
          'TASK',
          metadata.taskId || null,
          action,
          metadata.assignedById || metadata.escalatedById || null,
          mapping?.iso21500?.term || 'Activity (4.4.5)',
          mapping?.pmbok7?.term || 'Activity',
          mapping?.prince2?.term || 'Activity',
          JSON.stringify(metadata),
          new Date().toISOString(),
        ]
      );
    } catch (err: any) {
      logger.error('[TaskAssignmentService] Audit log failed:', err.message);
    }
  }
}

export default TaskAssignmentService;
