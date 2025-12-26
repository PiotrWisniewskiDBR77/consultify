/**
 * Task Assignment Service
 * 
 * PMO Standards Compliant Task Assignment with SLA and Escalation
 * 
 * Standards:
 * - ISO 21500:2021 - Activity (Clause 4.4.5), Escalation (Clause 4.3.4)
 * - PMI PMBOK 7th Edition - Project Work Performance Domain
 * - PRINCE2 - Progress Theme, Exception Handling
 * 
 * Features:
 * - Task assignment with validation
 * - SLA tracking and enforcement
 * - Automatic escalation for overdue tasks
 * - Escalation path: INITIATIVE_OWNER → PMO_LEAD → SPONSOR
 * 
 * @module taskAssignmentService
 */

const { v4: uuid } = require('uuid');
const db = require('../database');
const { PMO_DOMAIN_IDS } = require('./pmoDomainRegistry');
const PMOStandardsMapping = require('./pmoStandardsMapping');
const ProjectMemberService = require('./projectMemberService');
const NotificationService = require('./notificationService');
const ActivityService = require('./activityService');

/**
 * Default SLA hours by priority
 */
const SLA_HOURS_BY_PRIORITY = {
  urgent: 8,
  high: 24,
  medium: 48,
  low: 72
};

/**
 * Escalation levels
 */
const ESCALATION_LEVELS = {
  NONE: 0,
  INITIATIVE_OWNER: 1,
  PMO_LEAD: 2,
  SPONSOR: 3
};

/**
 * Escalation trigger types
 */
const ESCALATION_TRIGGERS = {
  SLA_BREACH: 'SLA_BREACH',
  BLOCKED: 'BLOCKED',
  MANUAL: 'MANUAL',
  PRIORITY_CHANGE: 'PRIORITY_CHANGE'
};

/**
 * Task Assignment Service
 */
const TaskAssignmentService = {
  SLA_HOURS_BY_PRIORITY,
  ESCALATION_LEVELS,
  ESCALATION_TRIGGERS,

  /**
   * Assign a task to a user
   * 
   * @param {string} taskId - Task ID
   * @param {string} assigneeId - User ID to assign to
   * @param {Object} options - Assignment options
   * @param {string} options.assignedById - Who is assigning
   * @param {number} options.slaHours - Override SLA hours
   * @returns {Promise<Object>} Updated task
   */
  async assignTask(taskId, assigneeId, options = {}) {
    const { assignedById, slaHours } = options;

    // Get task
    const task = await db.getAsync('SELECT * FROM tasks WHERE id = ?', [taskId]);
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
    const canBeAssigned = [
      ProjectMemberService.PROJECT_ROLES.TASK_ASSIGNEE,
      ProjectMemberService.PROJECT_ROLES.INITIATIVE_OWNER,
      ProjectMemberService.PROJECT_ROLES.WORKSTREAM_OWNER,
      ProjectMemberService.PROJECT_ROLES.PMO_LEAD
    ].includes(member.projectRole);

    if (!canBeAssigned) {
      throw new Error(`User with role ${member.projectRole} cannot be assigned tasks`);
    }

    // Calculate SLA
    const effectiveSlaHours = slaHours || SLA_HOURS_BY_PRIORITY[task.priority] || 24;
    const now = new Date();
    const slaDueAt = new Date(now.getTime() + effectiveSlaHours * 60 * 60 * 1000).toISOString();

    // Update task
    await db.runAsync(
      `UPDATE tasks 
       SET assignee_id = ?, 
           sla_hours = ?, 
           sla_due_at = ?,
           escalation_level = 0,
           escalated_to_id = NULL,
           last_escalated_at = NULL,
           updated_at = ?
       WHERE id = ?`,
      [assigneeId, effectiveSlaHours, slaDueAt, now.toISOString(), taskId]
    );

    // Log to audit trail
    await this._logAudit(projectId, 'TASK_ASSIGNED', {
      taskId,
      assigneeId,
      assignedById,
      slaHours: effectiveSlaHours,
      slaDueAt
    });

    // Create activity entry
    await this._createActivity(projectId, taskId, 'TASK_ASSIGNED', {
      assigneeId,
      assignedById
    });

    return this.getTask(taskId);
  },

  /**
   * Reassign a task to a different user
   * 
   * @param {string} taskId - Task ID
   * @param {string} newAssigneeId - New user ID
   * @param {Object} options - Options
   * @param {string} options.reassignedById - Who is reassigning
   * @param {string} options.reason - Reason for reassignment
   * @param {boolean} options.resetSla - Whether to reset SLA
   * @returns {Promise<Object>} Updated task
   */
  async reassignTask(taskId, newAssigneeId, options = {}) {
    const { reassignedById, reason, resetSla = true } = options;

    const task = await db.getAsync('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      throw new Error('Task not found');
    }

    const oldAssigneeId = task.assignee_id;

    // Use assignTask for actual assignment
    const result = await this.assignTask(taskId, newAssigneeId, {
      assignedById: reassignedById,
      slaHours: resetSla ? null : task.sla_hours
    });

    // Log reassignment
    await this._logAudit(task.project_id, 'TASK_REASSIGNED', {
      taskId,
      oldAssigneeId,
      newAssigneeId,
      reassignedById,
      reason
    });

    return result;
  },

  /**
   * Unassign a task
   * 
   * @param {string} taskId - Task ID
   * @param {Object} options - Options
   * @returns {Promise<Object>} Updated task
   */
  async unassignTask(taskId, options = {}) {
    const task = await db.getAsync('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      throw new Error('Task not found');
    }

    await db.runAsync(
      `UPDATE tasks 
       SET assignee_id = NULL, 
           sla_due_at = NULL,
           escalation_level = 0,
           escalated_to_id = NULL,
           last_escalated_at = NULL,
           updated_at = ?
       WHERE id = ?`,
      [new Date().toISOString(), taskId]
    );

    await this._logAudit(task.project_id, 'TASK_UNASSIGNED', {
      taskId,
      previousAssigneeId: task.assignee_id
    });

    return this.getTask(taskId);
  },

  /**
   * Escalate a task
   * 
   * @param {string} taskId - Task ID
   * @param {Object} options - Escalation options
   * @param {string} options.reason - Reason for escalation
   * @param {string} options.triggerType - What triggered escalation
   * @param {string} options.escalatedById - Who triggered escalation (for manual)
   * @returns {Promise<Object>} Updated task with escalation record
   */
  async escalateTask(taskId, options = {}) {
    const { reason, triggerType = ESCALATION_TRIGGERS.MANUAL, escalatedById } = options;

    const task = await db.getAsync('SELECT * FROM tasks WHERE id = ?', [taskId]);
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
    await db.runAsync(
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
    await db.runAsync(
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
        now
      ]
    );

    // Log to audit trail
    await this._logAudit(task.project_id, 'TASK_ESCALATED', {
      taskId,
      fromLevel: currentLevel,
      toLevel: newLevel,
      escalatedToId,
      reason,
      triggerType,
      escalatedById
    });

    // Notify escalation recipient (TODO: integrate with notification service)
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
        createdAt: now
      }
    };
  },

  /**
   * Resolve an escalation
   * 
   * @param {string} escalationId - Escalation ID
   * @param {Object} options - Resolution options
   * @param {string} options.resolutionNote - Note about resolution
   * @param {string} options.resolvedById - Who resolved it
   * @returns {Promise<Object>} Updated escalation
   */
  async resolveEscalation(escalationId, options = {}) {
    const { resolutionNote, resolvedById } = options;

    const escalation = await db.getAsync(
      'SELECT * FROM task_escalations WHERE id = ?',
      [escalationId]
    );
    if (!escalation) {
      throw new Error('Escalation not found');
    }

    const now = new Date().toISOString();

    await db.runAsync(
      `UPDATE task_escalations 
       SET resolved_at = ?, resolution_note = ?
       WHERE id = ?`,
      [now, resolutionNote || null, escalationId]
    );

    // Reset task escalation level if this was the latest
    const latestEscalation = await db.getAsync(
      `SELECT id FROM task_escalations 
       WHERE task_id = ? AND resolved_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [escalation.task_id]
    );

    if (!latestEscalation) {
      await db.runAsync(
        `UPDATE tasks 
         SET escalation_level = 0, escalated_to_id = NULL
         WHERE id = ?`,
        [escalation.task_id]
      );
    }

    await this._logAudit(escalation.project_id, 'ESCALATION_RESOLVED', {
      escalationId,
      taskId: escalation.task_id,
      resolutionNote,
      resolvedById
    });

    return db.getAsync('SELECT * FROM task_escalations WHERE id = ?', [escalationId]);
  },

  /**
   * Check and escalate overdue tasks (for cron job)
   * 
   * @param {Object} options - Options
   * @param {number} options.limit - Max tasks to process
   * @returns {Promise<Object>} Summary of escalations
   */
  async checkAndEscalateOverdue(options = {}) {
    const { limit = 100 } = options;
    const now = new Date().toISOString();

    // Find tasks that are overdue and not at max escalation
    const overdueTasks = await db.allAsync(
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

    const results = {
      processed: 0,
      escalated: 0,
      failed: 0,
      tasks: []
    };

    for (const task of overdueTasks) {
      results.processed++;
      try {
        const result = await this.escalateTask(task.id, {
          reason: `SLA breached: Task was due at ${task.sla_due_at}`,
          triggerType: ESCALATION_TRIGGERS.SLA_BREACH
        });
        results.escalated++;
        results.tasks.push({
          taskId: task.id,
          title: task.title,
          newLevel: result.escalation.toLevel,
          success: true
        });
      } catch (err) {
        results.failed++;
        results.tasks.push({
          taskId: task.id,
          title: task.title,
          success: false,
          error: err.message
        });
      }
    }

    return results;
  },

  /**
   * Get overdue tasks for a project
   * 
   * @param {string} projectId - Project ID
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} Overdue tasks
   */
  async getOverdueTasks(projectId, options = {}) {
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
    const params = [projectId, now];

    if (options.escalationLevel !== undefined) {
      query += ' AND t.escalation_level = ?';
      params.push(options.escalationLevel);
    }

    query += ' ORDER BY t.sla_due_at ASC';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    const tasks = await db.allAsync(query, params);
    return tasks.map(t => this._formatTask(t));
  },

  /**
   * Get tasks approaching SLA deadline
   * 
   * @param {string} projectId - Project ID
   * @param {number} hoursAhead - Hours before deadline
   * @returns {Promise<Array>} Tasks approaching deadline
   */
  async getTasksApproachingSLA(projectId, hoursAhead = 4) {
    const now = new Date();
    const threshold = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000).toISOString();

    const tasks = await db.allAsync(
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

    return tasks.map(t => this._formatTask(t));
  },

  /**
   * Get escalation history for a task
   * 
   * @param {string} taskId - Task ID
   * @returns {Promise<Array>} Escalation records
   */
  async getTaskEscalationHistory(taskId) {
    const escalations = await db.allAsync(
      `SELECT e.*, u.first_name, u.last_name
       FROM task_escalations e
       LEFT JOIN users u ON u.id = e.escalated_to_id
       WHERE e.task_id = ?
       ORDER BY e.created_at DESC`,
      [taskId]
    );

    return escalations.map(e => ({
      id: e.id,
      taskId: e.task_id,
      fromLevel: e.from_level,
      toLevel: e.to_level,
      escalatedToId: e.escalated_to_id,
      escalatedToName: e.first_name && e.last_name 
        ? `${e.first_name} ${e.last_name}` 
        : null,
      reason: e.reason,
      triggerType: e.trigger_type,
      resolvedAt: e.resolved_at,
      resolutionNote: e.resolution_note,
      createdAt: e.created_at
    }));
  },

  /**
   * Get task with all PMO fields
   * 
   * @param {string} taskId - Task ID
   * @returns {Promise<Object>} Task
   */
  async getTask(taskId) {
    const task = await db.getAsync(
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
  },

  /**
   * Get user workload (assigned tasks and their status)
   * 
   * @param {string} userId - User ID
   * @param {Object} options - Filter options
   * @returns {Promise<Object>} Workload summary
   */
  async getUserWorkload(userId, options = {}) {
    const { projectId } = options;

    let query = `
      SELECT t.project_id, t.status, t.priority, t.sla_due_at, t.escalation_level,
             p.name as project_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE t.assignee_id = ?
        AND t.status NOT IN ('DONE', 'COMPLETED', 'CANCELLED')
    `;
    const params = [userId];

    if (projectId) {
      query += ' AND t.project_id = ?';
      params.push(projectId);
    }

    const tasks = await db.allAsync(query, params);
    const now = new Date();

    const byProject = {};
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
          byStatus: {}
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
      generatedAt: new Date().toISOString()
    };
  },

  /**
   * Format task from DB to API response
   * @private
   */
  _formatTask(row) {
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
      assigneeName: row.assignee_first_name && row.assignee_last_name
        ? `${row.assignee_first_name} ${row.assignee_last_name}`
        : null,
      assigneeEmail: row.assignee_email,
      dueDate: row.due_date,
      slaHours: row.sla_hours,
      slaDueAt: row.sla_due_at,
      slaStatus,
      escalationLevel: row.escalation_level || 0,
      escalatedToId: row.escalated_to_id,
      escalatedToName: row.escalated_to_first_name && row.escalated_to_last_name
        ? `${row.escalated_to_first_name} ${row.escalated_to_last_name}`
        : null,
      lastEscalatedAt: row.last_escalated_at,
      progress: row.progress,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at
    };
  },

  /**
   * Create activity log entry using ActivityService
   * @private
   */
  async _createActivity(projectId, taskId, type, data) {
    try {
      // Get organization_id from project
      const project = await db.getAsync('SELECT organization_id FROM projects WHERE id = ?', [projectId]);
      
      ActivityService.log({
        organizationId: project?.organization_id,
        userId: data.assignedById || data.escalatedById || null,
        action: type,
        entityType: 'TASK',
        entityId: taskId,
        entityName: data.taskTitle || null,
        newValue: data
      });
    } catch (err) {
      console.error('[TaskAssignmentService] Activity log failed:', err.message);
    }
  },

  /**
   * Notify escalation recipient
   * @private
   */
  async _notifyEscalation(task, recipient, level, reason) {
    try {
      const levelNames = {
        1: 'Initiative Owner',
        2: 'PMO Lead',
        3: 'Project Sponsor'
      };

      await NotificationService.create({
        userId: recipient.id,
        organizationId: task.organization_id,
        projectId: task.project_id,
        type: 'TASK_ESCALATED',
        severity: level >= 3 ? 'CRITICAL' : level >= 2 ? 'WARNING' : 'INFO',
        title: `Task Escalated to ${levelNames[level] || 'Level ' + level}`,
        message: `Task "${task.title}" has been escalated. Reason: ${reason}`,
        relatedObjectType: 'TASK',
        relatedObjectId: task.id,
        isActionable: true,
        actionUrl: `/projects/${task.project_id}/tasks/${task.id}`
      });

      console.log(`[ESCALATION] Notification sent to ${recipient.firstName} ${recipient.lastName} (${recipient.email})`);
    } catch (err) {
      console.error(`[ESCALATION] Failed to send notification: ${err.message}`);
      // Don't throw - escalation should continue even if notification fails
    }
  },

  /**
   * Log to PMO audit trail
   * @private
   */
  async _logAudit(projectId, action, metadata = {}) {
    try {
      const mapping = action.includes('ESCALAT') 
        ? PMOStandardsMapping.getMapping('Escalation')
        : PMOStandardsMapping.getMapping('Task');
      
      await db.runAsync(
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
          new Date().toISOString()
        ]
      );
    } catch (err) {
      console.error('[TaskAssignmentService] Audit log failed:', err.message);
    }
  }
};

module.exports = TaskAssignmentService;

