/**
 * Task Service
 * Enterprise SaaS Architecture - Task domain service
 * Handles all task-related business logic with full type safety
 */

import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import type { Task, TaskPriority, TaskStatus, User } from '../types/index.js';
import { AuthorizationError, NotFoundError } from '../types/index.js';
import logger from '../utils/Logger.js';
import { send as sendNotification } from './notificationService.js';

// ==========================================
// VALIDATION SCHEMAS (Zod)
// ==========================================

const CreateTaskSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  status: z.enum(['todo', 'in_progress', 'review', 'done', 'blocked']).default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  assigneeId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
  estimatedHours: z.number().positive().max(1000).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  initiativeId: z.string().uuid().optional(),
  sourceType: z.string().max(100).optional(),
  sourceId: z.string().max(500).optional(),
});

const UpdateTaskSchema = CreateTaskSchema.partial().extend({
  actualHours: z.number().min(0).max(10000).optional(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

// ==========================================
// SERVICE CLASS
// ==========================================

export class TaskService {
  constructor(private readonly db: DatabaseClient) {}

  /**
   * Get all tasks for a project with optional filters
   */
  async getTasks(filters: TaskFilters): Promise<Task[]> {
    const { projectId, status, assigneeId, priority, initiativeId } = filters;

    let query = `
            SELECT t.*, (u.first_name || ' ' || u.last_name) as assignee_name, u.avatar_url as assignee_avatar
            FROM tasks t
            LEFT JOIN users u ON t.assignee_id = u.id
            WHERE 1=1
        `;
    const params: unknown[] = [];
    let paramIndex = 1;

    if (projectId) {
      query += ` AND t.project_id = $${paramIndex++}`;
      params.push(projectId);
    }
    if (status) {
      query += ` AND t.status = $${paramIndex++}`;
      params.push(status);
    }
    if (assigneeId) {
      query += ` AND t.assignee_id = $${paramIndex++}`;
      params.push(assigneeId);
    }
    if (priority) {
      query += ` AND t.priority = $${paramIndex++}`;
      params.push(priority);
    }
    if (initiativeId) {
      query += ` AND t.initiative_id = $${paramIndex++}`;
      params.push(initiativeId);
    }

    query += ` ORDER BY t.created_at DESC`;

    const result = await this.db.query<TaskRow>(query, params);
    return result.rows.map(this.mapRowToTask);
  }

  /**
   * Get a single task by ID
   */
  async getTask(id: string): Promise<Task> {
    const result = await this.db.query<TaskRow>(
      `SELECT t.*, (u.first_name || ' ' || u.last_name) as assignee_name, u.avatar_url as assignee_avatar
             FROM tasks t
             LEFT JOIN users u ON t.assignee_id = u.id
             WHERE t.id = $1`,
      [id]
    );

    if (!result.rows[0]) {
      throw new NotFoundError('Task');
    }

    return this.mapRowToTask(result.rows[0]);
  }

  /**
   * Create a new task
   */
  async createTask(input: CreateTaskInput, userId: string): Promise<Task> {
    // Validate input
    const validated = CreateTaskSchema.parse(input);

    // Check project access only if projectId is provided
    if (validated.projectId) {
      await this.verifyProjectAccess(validated.projectId, userId);
    }

    // tasks.id and tasks.organization_id are NOT NULL with no DB default, so the
    // INSERT must supply both (Postgres rejects the row otherwise — SQLite was
    // lenient here). Generate the id (canon: uuidv4, like TaskController) and
    // resolve organization_id from the creating user's org — a task belongs to
    // its creator's organization. Deriving it here keeps every caller correct
    // (interview-insights handoff, CQRS CreateTaskHandler) without threading an
    // extra argument through each one.
    const id = uuidv4();
    const orgResult = await this.db.query<{ organization_id: string | null }>(
      `SELECT organization_id FROM users WHERE id = $1`,
      [userId]
    );
    const organizationId = orgResult.rows[0]?.organization_id;
    if (!organizationId) {
      throw new NotFoundError('User organization');
    }

    const result = await this.db.query<TaskRow>(
      `INSERT INTO tasks (
                id, organization_id, project_id, title, description, status, priority,
                assignee_id, due_date, estimated_hours, tags, initiative_id,
                created_by, source_type, source_id
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
             RETURNING *`,
      [
        id,
        organizationId,
        validated.projectId || null, // projectId is optional
        validated.title,
        validated.description || null,
        validated.status,
        validated.priority,
        validated.assigneeId || null,
        validated.dueDate ? new Date(validated.dueDate) : null,
        validated.estimatedHours || null,
        validated.tags ? JSON.stringify(validated.tags) : null,
        validated.initiativeId || null,
        userId,
        validated.sourceType || null,
        validated.sourceId || null,
      ]
    );

    // Notify assignee if assigned
    if (validated.assigneeId && validated.assigneeId !== userId) {
      await this.notifyAssignee(result.rows[0].id, validated.assigneeId);
    }

    return this.mapRowToTask(result.rows[0]);
  }

  /**
   * Update an existing task
   */
  async updateTask(id: string, input: UpdateTaskInput, userId: string): Promise<Task> {
    // Get existing task
    const existingTask = await this.getTask(id);

    // Verify access
    await this.verifyProjectAccess(existingTask.projectId, userId);

    // Validate input
    const validated = UpdateTaskSchema.parse(input);

    // Build update query
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    Object.entries(validated).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbKey = this.camelToSnake(key);
        updates.push(`${dbKey} = $${paramIndex++}`);

        if (key === 'tags') {
          params.push(JSON.stringify(value));
        } else if (key === 'dueDate' && value) {
          params.push(new Date(value as string));
        } else {
          params.push(value);
        }
      }
    });

    if (updates.length === 0) {
      return existingTask;
    }

    updates.push(`updated_at = NOW()`);
    params.push(id);

    const result = await this.db.query<TaskRow>(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    // Track status change for metrics
    if (validated.status && validated.status !== existingTask.status) {
      await this.trackStatusChange(id, existingTask.status, validated.status, userId);
    }

    // Notify new assignee if changed
    if (validated.assigneeId && validated.assigneeId !== existingTask.assigneeId) {
      await this.notifyAssignee(id, validated.assigneeId);
    }

    return this.mapRowToTask(result.rows[0]);
  }

  /**
   * Delete a task
   */
  async deleteTask(id: string, userId: string): Promise<void> {
    const task = await this.getTask(id);
    await this.verifyProjectAccess(task.projectId, userId);

    await this.db.query(`DELETE FROM tasks WHERE id = $1`, [id]);
  }

  /**
   * Wzorzec N — AI generacja treści jednej karty-sekcji Task.
   *
   * Prompty są STAŁE w kodzie (`taskSectionGenerationService.TASK_SECTION_PROMPTS`),
   * bo NIE MA tabeli `task_section_types` z `ai_prompt_template`. Doktryna BCG §0
   * w system-promptcie, instrukcja karty §3 w user-promptcie.
   *
   * ⚠ Prompty zmieniają output klienta → wymagają weryfikacji Piotra przed live.
   *
   * @param taskId     — id zadania (do pobrania kontekstu)
   * @param sectionKey — strategy | execution | evidence | dependencies
   */
  async generateSection(
    taskId: string,
    sectionKey: 'strategy' | 'execution' | 'evidence' | 'dependencies',
    options: { language?: string } = {}
  ): Promise<unknown> {
    const task = await this.getTask(taskId);
    const { generateTaskSection } = await import('./taskSectionGenerationService.js');
    return generateTaskSection(
      sectionKey,
      {
        title: task.title,
        description: task.description || null,
        taskType: (task as unknown as { taskType?: string }).taskType || null,
        priority: task.priority || null,
        status: task.status || null,
      },
      { language: options.language }
    );
  }

  /**
   * Get task statistics for a project
   */
  async getTaskStats(projectId: string): Promise<TaskStats> {
    const result = await this.db.query<{ status: TaskStatus; count: string }>(
      `SELECT status, COUNT(*) as count FROM tasks WHERE project_id = $1 GROUP BY status`,
      [projectId]
    );

    const stats: TaskStats = {
      total: 0,
      byStatus: {
        todo: 0,
        in_progress: 0,
        review: 0,
        done: 0,
        blocked: 0,
      },
      completionRate: 0,
      overdueCount: 0,
    };

    result.rows.forEach((row) => {
      const count = parseInt(row.count, 10);
      stats.total += count;
      stats.byStatus[row.status] = count;
    });

    if (stats.total > 0) {
      stats.completionRate = (stats.byStatus.done / stats.total) * 100;
    }

    // Get overdue count
    const overdueResult = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM tasks 
             WHERE project_id = $1 AND due_date < NOW() AND status NOT IN ('done', 'blocked')`,
      [projectId]
    );
    stats.overdueCount = parseInt(overdueResult.rows[0]?.count || '0', 10);

    return stats;
  }

  // ==========================================
  // PRIVATE METHODS
  // ==========================================

  private async verifyProjectAccess(projectId: string, userId: string): Promise<void> {
    const result = await this.db.query<{ id: string }>(
      `SELECT p.id FROM projects p
             LEFT JOIN project_members pm ON p.id = pm.project_id
             WHERE p.id = $1 AND (p.owner_id = $2 OR pm.user_id = $2)`,
      [projectId, userId]
    );

    if (!result.rows[0]) {
      throw new AuthorizationError('Access to this project denied');
    }
  }

  /**
   * H6.3: routed through notificationService.send() instead of a raw INSERT so
   * task assignment notifications get the shared idempotency guard (dedup_key
   * = type + entity ref, scoped per recipient, 60s window — see
   * NotificationService.claimDedupSlot). This closes two real duplicate risks
   * that the old raw INSERT had none of:
   *  - double-click / client retry on create-task or update-task-assignee
   *  - a race between two concurrent updateTask calls that both read the same
   *    stale `existingTask.assigneeId` before either UPDATE lands, so both
   *    conclude "assignee changed" and both call notifyAssignee.
   * Also fail-safe (swallow + log) so a notification hiccup never fails the
   * task create/update it was attached to — the task write already committed.
   */
  private async notifyAssignee(taskId: string, assigneeId: string): Promise<void> {
    try {
      const orgResult = await this.db.query<{ organization_id: string | null }>(
        `SELECT organization_id FROM users WHERE id = $1`,
        [assigneeId]
      );
      const organizationId = orgResult.rows[0]?.organization_id || '';

      await sendNotification({
        userId: assigneeId,
        organizationId,
        type: 'TASK_ASSIGNED',
        title: 'New task assigned',
        body: 'You have been assigned a new task',
        entityType: 'task',
        entityId: taskId,
        actionUrl: `/tasks/${taskId}`,
        isActionable: true,
        dedupeKey: `task-assigned:${taskId}:${assigneeId}`,
      });
    } catch (err) {
      logger.warn(
        `[TaskService] notifyAssignee failed for task=${taskId} assignee=${assigneeId}:`,
        err
      );
    }
  }

  private async trackStatusChange(
    taskId: string,
    oldStatus: TaskStatus,
    newStatus: TaskStatus,
    userId: string
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO task_status_history (task_id, old_status, new_status, changed_by)
             VALUES ($1, $2, $3, $4)`,
      [taskId, oldStatus, newStatus, userId]
    );
  }

  private mapRowToTask(row: TaskRow): Task {
    return {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      description: row.description || undefined,
      status: row.status,
      priority: row.priority,
      assigneeId: row.assignee_id || undefined,
      dueDate: row.due_date || undefined,
      estimatedHours: row.estimated_hours || undefined,
      actualHours: row.actual_hours || undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}

// ==========================================
// TYPES
// ==========================================

interface TaskFilters {
  projectId?: string;
  status?: TaskStatus;
  assigneeId?: string;
  priority?: TaskPriority;
  initiativeId?: string;
}

interface TaskRow {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  due_date: Date | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  tags: string | null;
  initiative_id: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  assignee_name?: string;
  assignee_avatar?: string;
}

interface TaskStats {
  total: number;
  byStatus: Record<TaskStatus, number>;
  completionRate: number;
  overdueCount: number;
}

interface DatabaseClient {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
