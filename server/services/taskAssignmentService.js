import { v4 as uuid } from 'uuid';

/**
 * Dependency injection container
 */
const deps = {
  _db: null,
  _pmoDomainRegistry: null,
  _pmoStandardsMapping: null,
  _projectMemberService: null,
  _notificationService: null,
  _activityService: null,

  get db() { return this._db; },
  set db(val) { this._db = val; },

  get pmoDomainRegistry() { return this._pmoDomainRegistry; },
  set pmoDomainRegistry(val) { this._pmoDomainRegistry = val; },

  get pmoStandardsMapping() { return this._pmoStandardsMapping; },
  set pmoStandardsMapping(val) { this._pmoStandardsMapping = val; },

  get projectMemberService() { return this._projectMemberService; },
  set projectMemberService(val) { this._projectMemberService = val; },

  get notificationService() { return this._notificationService; },
  set notificationService(val) { this._notificationService = val; },

  get activityService() { return this._activityService; },
  set activityService(val) { this._activityService = val; }
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
  if (!deps._db) {
    const { default: dbInstance } = await import('../src/database/index.js');
    deps._db = dbInstance;
  }
  if (!deps._pmoDomainRegistry) {
    const { default: pmoDomainRegistry } = await import('./pmoDomainRegistry.js');
    deps._pmoDomainRegistry = pmoDomainRegistry;
  }
  if (!deps._pmoStandardsMapping) {
    const { default: pmoStandardsMapping } = await import('./pmoStandardsMapping.js');
    deps._pmoStandardsMapping = pmoStandardsMapping;
  }
  if (!deps._projectMemberService) {
    const { default: projectMemberService } = await import('./projectMemberService.js');
    deps._projectMemberService = projectMemberService;
  }
  if (!deps._notificationService) {
    const { default: notificationService } = await import('./notificationService.js');
    deps._notificationService = notificationService;
  }
  if (!deps._activityService) {
    const { default: activityService } = await import('../src/services/ActivityService.js');
    deps._activityService = activityService;
  }
}

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

class TaskAssignmentService {
  constructor() {
    this._db = null;
    this.SLA_HOURS_BY_PRIORITY = SLA_HOURS_BY_PRIORITY;
    this.ESCALATION_LEVELS = ESCALATION_LEVELS;
    this.ESCALATION_TRIGGERS = ESCALATION_TRIGGERS;
  }

  get db() {
    if (!this._db) {
      throw new Error('TaskAssignmentService: Database not initialized. Call init() first.');
    }
    return this._db;
  }

  /**
   * Initialize service dependencies
   */
  async init() {
    await initDeps();
    this._db = deps.db;
    return this;
  }

  /**
   * Set dependencies manually (for testing)
   */
  setDependencies(customDeps) {
    if (customDeps.db) {
      this._db = customDeps.db;
      deps.db = customDeps.db;
    }
    if (customDeps.pmoDomainRegistry) deps.pmoDomainRegistry = customDeps.pmoDomainRegistry;
    if (customDeps.pmoStandardsMapping) deps.pmoStandardsMapping = customDeps.pmoStandardsMapping;
    if (customDeps.projectMemberService) deps.projectMemberService = customDeps.projectMemberService;
    if (customDeps.notificationService) deps.notificationService = customDeps.notificationService;
    if (customDeps.activityService) deps.activityService = customDeps.activityService;
  }

  /**
   * Assign a task to a user
   */
  async assignTask(taskId, assigneeId, options = {}) {
    await this.init();
    const { assignedById, slaHours } = options;

    const task = await this.db.getAsync('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      throw new Error('Task not found');
    }

    const projectId = task.project_id;
    const member = await deps.projectMemberService.getMember(projectId, assigneeId);
    if (!member) {
      throw new Error('User is not a member of this project');
    }

    const { PROJECT_ROLES } = deps.projectMemberService;
    const canBeAssigned = [
      PROJECT_ROLES.TASK_ASSIGNEE,
      PROJECT_ROLES.INITIATIVE_OWNER,
      PROJECT_ROLES.WORKSTREAM_OWNER,
      PROJECT_ROLES.PMO_LEAD
    ].includes(member.projectRole);

    if (!canBeAssigned) {
      throw new Error(`User with role ${member.projectRole} cannot be assigned tasks`);
    }

    const effectiveSlaHours = slaHours || SLA_HOURS_BY_PRIORITY[task.priority] || 24;
    const now = new Date();
    const slaDueAt = new Date(now.getTime() + effectiveSlaHours * 60 * 60 * 1000).toISOString();

    await this.db.runAsync(
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

    await this._logAudit(projectId, 'TASK_ASSIGNED', {
      taskId,
      assigneeId,
      assignedById,
      slaHours: effectiveSlaHours,
      slaDueAt
    });

    await this._createActivity(projectId, taskId, 'TASK_ASSIGNED', {
      assigneeId,
      assignedById
    });

    return this.getTask(taskId);
  }

  /**
   * Reassign a task to a different user
   */
  async reassignTask(taskId, newAssigneeId, options = {}) {
    await this.init();
    const { reassignedById, reason, resetSla = true } = options;

    const task = await this.db.getAsync('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      throw new Error('Task not found');
    }

    const oldAssigneeId = task.assignee_id;

    const result = await this.assignTask(taskId, newAssigneeId, {
      assignedById: reassignedById,
      slaHours: resetSla ? null : task.sla_hours
    });

    await this._logAudit(task.project_id, 'TASK_REASSIGNED', {
      taskId,
      oldAssigneeId,
      newAssigneeId,
      reassignedById,
      reason
    });

    return result;
  }

  /**
   * Unassign a task
   */
  async unassignTask(taskId) {
    await this.init();
    const task = await this.db.getAsync('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      throw new Error('Task not found');
    }

    await this.db.runAsync(
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
  }

  /**
   * Escalate a task
   */
  async escalateTask(taskId, options = {}) {
    await this.init();
    const { reason, triggerType = ESCALATION_TRIGGERS.MANUAL, escalatedById } = options;

    const task = await this.db.getAsync('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) {
      throw new Error('Task not found');
    }

    const currentLevel = task.escalation_level || 0;
    if (currentLevel >= 3) {
      throw new Error('Task is already at maximum escalation level');
    }

    const newLevel = currentLevel + 1;

    const recipients = await deps.projectMemberService.getEscalationRecipients(
      task.project_id,
      newLevel
    );

    if (recipients.length === 0) {
      throw new Error(`No recipients found for escalation level ${newLevel}`);
    }

    const escalatedToId = recipients[0].userId;
    const now = new Date().toISOString();

    await this.db.runAsync(
      `UPDATE tasks 
       SET escalation_level = ?, 
           escalated_to_id = ?,
           last_escalated_at = ?,
           updated_at = ?
       WHERE id = ?`,
      [newLevel, escalatedToId, now, now, taskId]
    );

    const escalationId = uuid();
    await this.db.runAsync(
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

    await this._logAudit(task.project_id, 'TASK_ESCALATED', {
      taskId,
      fromLevel: currentLevel,
      toLevel: newLevel,
      escalatedToId,
      reason,
      triggerType,
      escalatedById
    });

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
  }

  /**
   * Resolve an escalation
   */
  async resolveEscalation(escalationId, options = {}) {
    await this.init();
    const { resolutionNote, resolvedById } = options;

    const escalation = await this.db.getAsync(
      'SELECT * FROM task_escalations WHERE id = ?',
      [escalationId]
    );
    if (!escalation) {
      throw new Error('Escalation not found');
    }

    const now = new Date().toISOString();

    await this.db.runAsync(
      `UPDATE task_escalations 
       SET resolved_at = ?, resolution_note = ?
       WHERE id = ?`,
      [now, resolutionNote || null, escalationId]
    );

    const latestEscalation = await this.db.getAsync(
      `SELECT id FROM task_escalations 
       WHERE task_id = ? AND resolved_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [escalation.task_id]
    );

    if (!latestEscalation) {
      await this.db.runAsync(
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

    return this.db.getAsync('SELECT * FROM task_escalations WHERE id = ?', [escalationId]);
  }

  /**
   * Check and escalate overdue tasks (for cron job)
   */
  async checkAndEscalateOverdue(options = {}) {
    await this.init();
    const { limit = 100 } = options;
    const now = new Date().toISOString();

    const overdueTasks = await this.db.allAsync(
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
  }

  /**
   * Get overdue tasks for a project
   */
  async getOverdueTasks(projectId, options = {}) {
    await this.init();
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

    const tasks = await this.db.allAsync(query, params);
    return tasks.map(t => this._formatTask(t));
  }

  /**
   * Get tasks approaching SLA deadline
   */
  async getTasksApproachingSLA(projectId, hoursAhead = 4) {
    await this.init();
    const now = new Date();
    const threshold = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000).toISOString();

    const tasks = await this.db.allAsync(
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
  }

  /**
   * Get escalation history for a task
   */
  async getTaskEscalationHistory(taskId) {
    await this.init();
    const escalations = await this.db.allAsync(
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
  }

  /**
   * Get task with all PMO fields
   */
  async getTask(taskId) {
    await this.init();
    const task = await this.db.getAsync(
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
  async getUserWorkload(userId, options = {}) {
    await this.init();
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

    const tasks = await this.db.allAsync(query, params);
    const now = new Date();

    const byProject = {};
    let total = 0;
    let overdue = 0;
    let atRisk = 0;

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
  }

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
  }

  async _createActivity(projectId, taskId, type, data) {
    try {
      await this.init();
      const project = await this.db.getAsync('SELECT organization_id FROM projects WHERE id = ?', [projectId]);

      deps.activityService.log({
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
  }

  async _notifyEscalation(task, recipient, level, reason) {
    try {
      await this.init();
      const levelNames = {
        1: 'Initiative Owner',
        2: 'PMO Lead',
        3: 'Project Sponsor'
      };

      await deps.notificationService.create({
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
    } catch (err) {
      console.error(`[ESCALATION] Failed to send notification: ${err.message}`);
    }
  }

  async _logAudit(projectId, action, metadata = {}) {
    try {
      await this.init();
      const { PMO_DOMAIN_IDS } = deps.pmoDomainRegistry;
      const mapping = action.includes('ESCALAT')
        ? deps.pmoStandardsMapping.getMapping('Escalation')
        : deps.pmoStandardsMapping.getMapping('Task');

      await this.db.runAsync(
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
}

const taskAssignmentServiceInstance = new TaskAssignmentService();
export default taskAssignmentServiceInstance;

