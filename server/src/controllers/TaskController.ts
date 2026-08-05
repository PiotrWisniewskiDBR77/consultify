// @ts-nocheck
/**
 * Task Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles all task-related business logic
 */

import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import ActivityService from '../services/ActivityService.js';
import auditEventsService from '../services/AuditEventsService.js';
import { notifyAssignment } from '../services/initiative/initiativeNotificationService.js';
import { dispatchProjectCommunicationEvent } from '../services/integrations/communicationSyncService.js';
import {
  createIssueFromTask,
  parseJiraConfig,
  updateIssueFromTask,
} from '../services/integrations/jiraOrgClient.js';
import NotificationService from '../services/notificationService.js';
import { PMO_DOMAIN_IDS } from '../services/pmoDomainRegistry.js';
import TaskAssignmentService from '../services/taskAssignmentService.js';
import {
  getAllowedTaskTransitions,
  TASK_STATUSES,
  validateTaskStatusTransition,
} from '../services/taskWorkflowService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import DbPromise from '../utils/DbPromise.js';
import { getTableColumns as getSchemaColumns } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';
import type {
  AddTaskCommentRequest,
  AssignTaskRequest,
  BlockTaskRequest,
  CreateTaskRequest,
  EscalateTaskRequest,
  GetTasksQuery,
  ReassignTaskRequest,
  ResolveEscalationRequest,
  UnblockTaskRequest,
  UpdateTaskRequest,
} from '../validators/task.validators.js';

const ESCALATION_TRIGGERS = {
  SLA_BREACH: 'SLA_BREACH',
  BLOCKED: 'BLOCKED',
  MANUAL: 'MANUAL',
  PRIORITY_CHANGE: 'PRIORITY_CHANGE',
} as const;

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function createNotificationSafely(payload: Record<string, unknown>) {
  const service = NotificationService as any;
  const notifier =
    typeof service?.send === 'function'
      ? service.send.bind(service)
      : typeof service?.create === 'function'
        ? service.create.bind(service)
        : null;

  if (!notifier) {
    return Promise.resolve();
  }

  return Promise.resolve(notifier(payload));
}

// ==========================================
// TYPES
// ==========================================

type SQLParam = string | number | boolean | null | undefined;

interface CommentRow {
  id: string;
  task_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface TaskRow {
  id: string;
  project_id: string;
  project_name?: string;
  program_id?: string;
  organization_id: string;
  title: string;
  source?: string;
  description?: string;
  status: string;
  priority: string;
  assignee_id?: string;
  backup_assignee_id?: string;
  assignee_first_name?: string;
  assignee_last_name?: string;
  assignee_avatar?: string;
  reporter_id?: string;
  reporter_first_name?: string;
  reporter_last_name?: string;
  reporter_avatar?: string;
  due_date?: string;
  started_at?: string;
  estimated_hours?: number;
  checklist?: string;
  attachments?: string;
  tags?: string;
  custom_status_id?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  task_type?: string;
  budget_allocated?: number;
  budget_spent?: number;
  risk_rating?: string;
  acceptance_criteria?: string;
  blocking_issues?: string;
  step_phase?: string;
  why?: string;
  owner_id?: string;
  requires_acceptance?: number | boolean;
  acceptance_type?: string;
  acceptor_id?: string;
  weight?: number;
  weight_reason?: string;
  roadmap_initiative_id?: string;
  kpi_id?: string;
  raid_item_id?: string;
  assignees?: string;
  initiative_id?: string;
  initiative_name?: string;
  list_id?: string;
  list_name?: string;
  progress?: number;
  blocked_reason?: string;
  blocked_at?: string;
  blocked_by_decision_id?: string | null;
  // SLA / Escalation
  sla_hours?: number;
  sla_due_at?: string;
  escalation_level?: number;
  escalated_to_id?: string;
  last_escalated_at?: string;

  // PMO notification rules + throttling
  notify_on_overdue?: number;
  notify_on_acceptance?: number;
  notify_on_unassigned?: number;
  notify_on_blocked?: number;
  last_overdue_notified_at?: string;
  last_acceptance_notified_at?: string;
  last_unassigned_notified_at?: string;
  last_blocked_notified_at?: string;
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Parse multilingual text and return translation for user's language
 * @param text - JSON string with translations {pl: '...', en: '...', ...} or plain string
 * @param userLang - User's language code (default: 'en')
 * @returns Translated text or original if not multilingual
 */
const getMultilingualText = (text: string | null | undefined, userLang: string = 'en'): string => {
  if (!text) return '';

  // If it's a plain string (not JSON), return as-is
  if (!text.startsWith('{') && !text.startsWith('[')) {
    return text;
  }

  try {
    const translations = JSON.parse(text);
    // Check if it's a multilingual object
    if (typeof translations === 'object' && translations !== null && !Array.isArray(translations)) {
      // Return translation for user's language, fallback to English, then first available
      return (
        translations[userLang] ||
        translations.en ||
        translations[Object.keys(translations)[0]] ||
        text
      );
    }
    return text;
  } catch {
    // Not JSON, return as-is
    return text;
  }
};

// ==========================================
// TASK DEPENDENCIES: SCHEMA COMPATIBILITY
// ==========================================

type TaskDepsSchema = {
  fromCol: 'predecessor_id' | 'from_task_id';
  toCol: 'successor_id' | 'to_task_id';
};
let taskDepsSchemaCache: TaskDepsSchema | null = null;

async function getTaskDepsSchema(): Promise<TaskDepsSchema> {
  if (taskDepsSchemaCache) return taskDepsSchemaCache;
  try {
    const names = await getSchemaColumns('task_dependencies');
    if (names.has('predecessor_id') && names.has('successor_id')) {
      taskDepsSchemaCache = { fromCol: 'predecessor_id', toCol: 'successor_id' };
      return taskDepsSchemaCache;
    }
    if (names.has('from_task_id') && names.has('to_task_id')) {
      taskDepsSchemaCache = { fromCol: 'from_task_id', toCol: 'to_task_id' };
      return taskDepsSchemaCache;
    }
  } catch {
    // ignore; fall back
  }
  taskDepsSchemaCache = { fromCol: 'predecessor_id', toCol: 'successor_id' };
  return taskDepsSchemaCache;
}

async function logTaskAuditEvent(params: {
  actorId: string;
  organizationId: string;
  action: string;
  resourceId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { actorId, organizationId, action, resourceId, before, after, metadata } = params;
  await auditEventsService.log({
    actorId,
    actorType: 'USER',
    action,
    resourceType: 'task',
    resourceId,
    before: before ?? undefined,
    after: after ?? undefined,
    metadata: metadata ?? {},
    organizationId,
  });
}

function buildTransitionErrorPayload(
  from: string | null | undefined,
  to: string | null | undefined
) {
  return {
    from,
    to,
    allowedNext: getAllowedTaskTransitions(from),
  };
}

function isRetriableSyncError(message: string): boolean {
  return /HTTP\s*5\d\d/i.test(message) || /timeout/i.test(message) || /ECONN/i.test(message);
}

async function logJiraTaskSyncEvent(params: {
  integrationId: string;
  status: 'success' | 'partial' | 'failed';
  itemsCreated?: number;
  itemsUpdated?: number;
  itemsFailed?: number;
  errorSummary?: string | null;
  errorDetails?: unknown;
  direction?: 'read_only' | 'bidirectional';
  triggerType?: 'event' | 'manual';
}): Promise<void> {
  try {
    const cols = await DbPromise.all<{ name: string }>(
      'PRAGMA table_info(integration_sync_log)',
      []
    );
    const names = new Set((cols || []).map((c) => String(c.name || '')));
    if (!names.size) return;

    const now = new Date().toISOString();
    const logId = `log-${uuidv4()}`;
    const errorDetails =
      params.errorDetails == null
        ? null
        : typeof params.errorDetails === 'string'
          ? params.errorDetails
          : JSON.stringify(params.errorDetails);

    if (names.has('items_processed')) {
      await DbPromise.run(
        `INSERT INTO integration_sync_log (
           id, integration_id, sync_type, direction, trigger_type,
           status, items_processed, items_created, items_updated, items_failed,
           error_summary, error_details, started_at, completed_at, duration_ms
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          logId,
          params.integrationId,
          'single_item',
          params.direction || 'bidirectional',
          params.triggerType || 'event',
          params.status,
          (params.itemsCreated || 0) + (params.itemsUpdated || 0) + (params.itemsFailed || 0),
          params.itemsCreated || 0,
          params.itemsUpdated || 0,
          params.itemsFailed || 0,
          params.errorSummary || null,
          errorDetails,
          now,
          now,
          0,
        ]
      );
      return;
    }

    await DbPromise.run(
      `INSERT INTO integration_sync_log (
         id, integration_id, sync_type, direction, status, items_synced, items_failed, error_details,
         started_at, completed_at, duration_ms
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        logId,
        params.integrationId,
        'single_item',
        params.direction || 'bidirectional',
        params.status,
        (params.itemsCreated || 0) + (params.itemsUpdated || 0),
        params.itemsFailed || 0,
        errorDetails,
        now,
        now,
        0,
      ]
    );
  } catch (err: any) {
    logger.warn('[TaskController] Failed to write Jira sync log', { error: err?.message });
  }
}

async function syncTaskToJiraIntegrations(params: {
  organizationId: string;
  task: { id: string; title: string; description?: string | null; status?: string | null };
}): Promise<void> {
  const { organizationId, task } = params;
  const integrations = await DbPromise.all<{
    integration_id: string;
    settings: string | null;
    provider_name?: string | null;
  }>(
    `
      SELECT i.id as integration_id, i.settings, p.name as provider_name
      FROM integrations i
      LEFT JOIN integration_providers p ON p.id = i.provider_id
      WHERE i.organization_id = ?
        AND (p.name = 'jira' OR i.provider_id = 'jira')
        AND (i.status IS NULL OR i.status IN ('active','connected'))
    `,
    [organizationId]
  ).catch(() => []);

  for (const integration of integrations || []) {
    const integrationId = String(integration.integration_id || '').trim();
    if (!integrationId) continue;

    let settings: Record<string, unknown> = {};
    try {
      settings = integration.settings ? JSON.parse(integration.settings) : {};
    } catch {
      settings = {};
    }

    const cfg = parseJiraConfig(settings);
    if (!cfg) {
      await logJiraTaskSyncEvent({
        integrationId,
        status: 'failed',
        itemsFailed: 1,
        errorSummary: 'jira_config_missing',
        errorDetails: ['Missing Jira config fields (baseUrl/email/apiToken/projectKey)'],
      });
      continue;
    }

    try {
      const existing = await DbPromise.get<{
        id: string;
        external_id: string | null;
        metadata: string | null;
      }>(
        `SELECT id, external_id, metadata
         FROM integration_sync_mappings
         WHERE integration_id = ? AND local_type = 'task' AND local_id = ?
         LIMIT 1`,
        [integrationId, task.id]
      );

      if (existing?.id) {
        let metadata: Record<string, unknown> = {};
        try {
          metadata = existing.metadata ? JSON.parse(existing.metadata) : {};
        } catch {
          metadata = {};
        }
        const issueIdOrKey = String(metadata.key || existing.external_id || '').trim();
        await updateIssueFromTask({
          config: cfg,
          issueIdOrKey,
          task,
          deepLinkUrl: null,
        });
        await DbPromise.run(
          `UPDATE integration_sync_mappings
           SET sync_status = 'synced', last_sync_at = datetime('now'), updated_at = datetime('now')
           WHERE id = ?`,
          [existing.id]
        );
        await logJiraTaskSyncEvent({
          integrationId,
          status: 'success',
          itemsUpdated: 1,
        });
        continue;
      }

      const created = await createIssueFromTask({
        config: cfg,
        task,
        deepLinkUrl: null,
      });
      const now = new Date().toISOString();
      await DbPromise.run(
        `INSERT INTO integration_sync_mappings (
           id, integration_id,
           local_type, local_id,
           external_type, external_id, external_url,
           sync_status, last_sync_at, created_at, updated_at, metadata
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?)`,
        [
          `sync-${uuidv4()}`,
          integrationId,
          'task',
          task.id,
          'issue',
          created.id,
          created.browseUrl,
          now,
          now,
          now,
          JSON.stringify({ key: created.key }),
        ]
      );
      await logJiraTaskSyncEvent({
        integrationId,
        status: 'success',
        itemsCreated: 1,
      });
    } catch (err: any) {
      const message = String(err?.message || 'Failed to sync task to Jira');
      await logJiraTaskSyncEvent({
        integrationId,
        status: 'partial',
        itemsFailed: 1,
        errorSummary: 'jira_sync_failed',
        errorDetails: [{ message, retriable: isRetriableSyncError(message) }],
      });
      logger.warn('[TaskController] Jira task sync failed', {
        integrationId,
        taskId: task.id,
        error: message,
      });
    }
  }
}

// ==========================================
// CONTROLLER METHODS
// ==========================================

export class TaskController {
  /**
   * V4-TASK-03: Canonical workflow statuses + transitions for UI/API clients.
   */
  static getWorkflowConfig = asyncHandler(
    async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
      res.json({
        statuses: TASK_STATUSES,
        transitions: Object.fromEntries(
          TASK_STATUSES.map((status) => [status, getAllowedTaskTransitions(status)])
        ),
      });
    }
  );

  /**
   * Get all tasks with filters
   */
  /**
   * Get all tasks with filters
   */
  static getTasks = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      logger.info('[TaskController] getTasks called', {
        user: req.user?.id,
        org: req.user?.organizationId,
      });
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Get user language from Accept-Language header or default to English
      const acceptLang = req.headers['accept-language'] || req.headers['Accept-Language'] || 'en';
      const userLang = acceptLang.split(',')[0].split('-')[0].toLowerCase() || 'en';
      const supportedLangs = ['pl', 'en', 'de', 'es', 'ar', 'ja'];
      const lang = supportedLangs.includes(userLang) ? userLang : 'en';

      const query = req.query as unknown as GetTasksQuery;
      // Default page 1, default limit 100 (or from schema default)
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 100;
      const offset = (page - 1) * limit;

      const {
        projectId,
        programId,
        listId,
        status,
        assigneeId,
        priority,
        initiativeId,
        reporterId,
        taskType,
        search,
        scope,
        source,
      } = query as any;

      // Mirror the Initiatives `?source` filter (e.g. ?source=interview_insight).
      const normalizedSourceFilter = source ? String(source).trim().toLowerCase() : '';

      // V4-TASK-01: scope=personal|initiative|program — validate required params
      if (scope === 'initiative' && !initiativeId) {
        res.status(400).json({
          error: 'initiativeId required when scope=initiative',
          code: 'SCOPE_INITIATIVE_REQUIRES_ID',
        });
        return;
      }
      if (scope === 'program' && !programId) {
        res.status(400).json({
          error: 'programId required when scope=program',
          code: 'SCOPE_PROGRAM_REQUIRES_ID',
        });
        return;
      }

      const taskColumns = await getSchemaColumns('tasks');
      const listIdExpr = taskColumns.has('list_id')
        ? taskColumns.has('workstream_id')
          ? 'COALESCE(t.list_id, t.workstream_id)'
          : 't.list_id'
        : taskColumns.has('workstream_id')
          ? 't.workstream_id'
          : 'NULL';
      const listNameExpr = listIdExpr === 'NULL' ? 'NULL' : listIdExpr;
      const workstreamsJoin =
        listIdExpr === 'NULL' ? '' : `LEFT JOIN workstreams w ON w.id = ${listNameExpr}`;

      const sql = `
            SELECT 
                t.*,
                a.first_name as assignee_first_name,
                a.last_name as assignee_last_name,
                a.avatar_url as assignee_avatar,
                r.first_name as reporter_first_name,
                r.last_name as reporter_last_name,
                r.avatar_url as reporter_avatar,
                p.name as project_name,
                i.name as initiative_name,
                i.program_id as program_id,
                ${listIdExpr} as list_id,
                ${listIdExpr === 'NULL' ? 'NULL' : 'w.name'} as list_name
            FROM tasks t
            LEFT JOIN users a ON t.assignee_id = a.id
            LEFT JOIN users r ON t.reporter_id = r.id
            LEFT JOIN projects p ON t.project_id = p.id
            LEFT JOIN initiatives i ON t.initiative_id = i.id
            ${workstreamsJoin}
            WHERE t.organization_id = ?
        `;
      const countSql = `SELECT COUNT(*) as total FROM tasks t
        LEFT JOIN initiatives i ON t.initiative_id = i.id
        WHERE t.organization_id = ?`;

      const params: SQLParam[] = [orgId];
      const countParams: SQLParam[] = [orgId];

      const applyFilters = (baseSql: string, baseParams: SQLParam[]) => {
        let s = baseSql;
        const p = [...baseParams];

        const normalizeCsvOrArray = (value: unknown): string[] => {
          if (value == null) return [];
          if (Array.isArray(value)) {
            return value
              .flatMap((v) => String(v ?? '').split(','))
              .map((v) => v.trim())
              .filter(Boolean);
          }
          return String(value)
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean);
        };

        if (projectId) {
          s += ` AND t.project_id = ?`;
          p.push(projectId);
        }
        if (programId) {
          s += ` AND i.program_id = ?`;
          p.push(programId);
        }
        if (listId) {
          if (listIdExpr !== 'NULL') {
            s += ` AND ${listIdExpr} = ?`;
            p.push(listId);
          } else {
            s += ` AND 1 = 0`;
          }
        }
        if (scope === 'personal') {
          s += ` AND (t.assignee_id = ? OR t.reporter_id = ?)`;
          p.push(userId, userId);
        }
        if (status) {
          const statuses = normalizeCsvOrArray(status);
          if (statuses.length === 1) {
            s += ` AND t.status = ?`;
            p.push(statuses[0]);
          } else if (statuses.length > 1) {
            s += ` AND t.status IN (${statuses.map(() => '?').join(',')})`;
            p.push(...statuses);
          }
        }
        if (assigneeId) {
          s += ` AND t.assignee_id = ?`;
          p.push(assigneeId);
        }
        if (reporterId) {
          s += ` AND t.reporter_id = ?`;
          p.push(reporterId);
        }
        if (priority) {
          const priorities = normalizeCsvOrArray(priority);
          if (priorities.length === 1) {
            s += ` AND t.priority = ?`;
            p.push(priorities[0]);
          } else if (priorities.length > 1) {
            s += ` AND t.priority IN (${priorities.map(() => '?').join(',')})`;
            p.push(...priorities);
          }
        }
        if (initiativeId) {
          s += ` AND t.initiative_id = ?`;
          p.push(initiativeId);
        }
        if (taskType) {
          s += ` AND t.task_type = ?`;
          p.push(taskType);
        }
        if (search) {
          s += ` AND (t.title LIKE ? OR t.description LIKE ?)`;
          p.push(`%${search}%`, `%${search}%`);
        }
        // Source lineage filter (org scope preserved by WHERE t.organization_id = ?).
        // No-ops gracefully when the tasks.source_type column is absent.
        if (normalizedSourceFilter && taskColumns.has('source_type')) {
          s += ` AND LOWER(COALESCE(t.source_type, '')) = ?`;
          p.push(normalizedSourceFilter);
        }

        // For regular users, show only tasks assigned to them or reported by them
        if (req.user?.role === 'team_member' || req.user?.role === 'viewer') {
          s += ` AND (t.assignee_id = ? OR t.reporter_id = ?)`;
          p.push(userId, userId);
        }
        return { sql: s, params: p };
      };

      // Filter valid parts
      const filteredMain = applyFilters(sql, params);
      const filteredCount = applyFilters(countSql, countParams);

      // Sort and Paginate Main Query
      filteredMain.sql += ` ORDER BY 
            CASE t.priority 
                WHEN 'urgent' THEN 1 
                WHEN 'critical' THEN 1
                WHEN 'high' THEN 2 
                WHEN 'medium' THEN 3 
                WHEN 'low' THEN 4 
            END,
            t.due_date ASC,
            t.created_at DESC
            LIMIT ? OFFSET ?`;
      filteredMain.params.push(limit, offset);

      // Execute queries
      const [rows, countResult] = await Promise.all([
        DbPromise.all<TaskRow>(filteredMain.sql, filteredMain.params),
        DbPromise.get<{ total: number }>(filteredCount.sql, filteredCount.params),
      ]);

      const total = countResult?.total || 0;
      const totalPages = Math.ceil(total / limit);

      // Set Pagination Headers
      res.setHeader('X-Total-Count', total);
      res.setHeader('X-Page', page);
      res.setHeader('X-Limit', limit);
      res.setHeader('X-Total-Pages', totalPages);

      const tasks = rows.map((t) => ({
        id: t.id,
        projectId: t.project_id,
        projectName: getMultilingualText(t.project_name, lang),
        organizationId: t.organization_id,
        title: getMultilingualText(t.title, lang),
        source: t.source || 'manual',
        description: getMultilingualText(t.description, lang),
        status: t.status,
        priority: t.priority,
        assigneeId: t.assignee_id,
        backupAssigneeId: t.backup_assignee_id,
        assignee: t.assignee_id
          ? {
              id: t.assignee_id,
              firstName: t.assignee_first_name,
              lastName: t.assignee_last_name,
              avatarUrl: t.assignee_avatar,
            }
          : null,
        reporterId: t.reporter_id,
        reporter: t.reporter_id
          ? {
              id: t.reporter_id,
              firstName: t.reporter_first_name,
              lastName: t.reporter_last_name,
              avatarUrl: t.reporter_avatar,
            }
          : null,
        dueDate: t.due_date,
        startedAt: t.started_at,
        estimatedHours: t.estimated_hours,
        checklist: safeJsonParse(t.checklist, []),
        attachments: safeJsonParse(t.attachments, []),
        tags: safeJsonParse(t.tags, []),
        customStatusId: t.custom_status_id,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        completedAt: t.completed_at,
        taskType: t.task_type,
        budgetAllocated: t.budget_allocated,
        budgetSpent: t.budget_spent,
        riskRating: t.risk_rating,
        acceptanceCriteria: t.acceptance_criteria,
        blockingIssues: t.blocking_issues,
        stepPhase: t.step_phase,
        why: t.why,
        ownerId: t.owner_id,
        requiresAcceptance: Boolean(t.requires_acceptance),
        acceptanceType: t.acceptance_type || null,
        acceptorId: t.acceptor_id || null,
        weight: t.weight ?? 1,
        weightReason: t.weight_reason || null,
        roadmapInitiativeId: t.roadmap_initiative_id,
        kpiId: t.kpi_id,
        raidItemId: t.raid_item_id,
        assignees: safeJsonParse(t.assignees, []),
        programId: t.program_id || t.project_id || null,
        initiativeId: t.initiative_id,
        initiativeName: getMultilingualText(t.initiative_name, lang),
        listId: t.list_id || null,
        listName: t.list_name || null,
        progress: t.progress || 0,
        blockedReason: t.blocked_reason || '',
        // SLA / Escalation
        slaHours: t.sla_hours,
        slaDueAt: t.sla_due_at,
        escalationLevel: t.escalation_level || 0,
        escalatedToId: t.escalated_to_id,
        lastEscalatedAt: t.last_escalated_at,
      }));

      res.json(tasks);
    }
  );

  /**
   * V4-TASK-01: Hierarchy rollups (program -> initiative -> list -> task)
   */
  static getTaskHierarchyRollups = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const query = req.query as unknown as GetTasksQuery & { listId?: string };
      const { projectId, programId, initiativeId, scope, listId } = query as any;

      if (scope === 'initiative' && !initiativeId) {
        res.status(400).json({ error: 'initiativeId required when scope=initiative' });
        return;
      }
      if (scope === 'program' && !programId) {
        res.status(400).json({ error: 'programId required when scope=program' });
        return;
      }

      const params: SQLParam[] = [orgId];
      let sql = '';
      let level: 'program' | 'initiative' | 'list' | 'personal' = 'initiative';

      if (scope === 'initiative' || initiativeId) {
        level = 'list';
        sql = `
          SELECT
            COALESCE(t.list_id, t.workstream_id, 'unassigned') as id,
            COALESCE(w.name, 'Unassigned') as name,
            COUNT(*) as task_count,
            SUM(CASE WHEN UPPER(COALESCE(t.status, '')) = 'DONE' THEN 1 ELSE 0 END) as done_count,
            ROUND(AVG(COALESCE(t.progress, 0))) as avg_progress
          FROM tasks t
          LEFT JOIN workstreams w ON w.id = COALESCE(t.list_id, t.workstream_id)
          WHERE t.organization_id = ?
            AND t.initiative_id = ?
          GROUP BY COALESCE(t.list_id, t.workstream_id, 'unassigned'), COALESCE(w.name, 'Unassigned')
          ORDER BY name ASC
        `;
        params.push(initiativeId);
      } else if (scope === 'personal') {
        level = 'personal';
        sql = `
          SELECT
            COALESCE(t.initiative_id, 'unassigned') as id,
            COALESCE(i.name, 'Unassigned') as name,
            COUNT(*) as task_count,
            SUM(CASE WHEN UPPER(COALESCE(t.status, '')) = 'DONE' THEN 1 ELSE 0 END) as done_count,
            ROUND(AVG(COALESCE(t.progress, 0))) as avg_progress
          FROM tasks t
          LEFT JOIN initiatives i ON i.id = t.initiative_id
          WHERE t.organization_id = ?
            AND (t.assignee_id = ? OR t.reporter_id = ?)
          GROUP BY COALESCE(t.initiative_id, 'unassigned'), COALESCE(i.name, 'Unassigned')
          ORDER BY name ASC
        `;
        params.push(userId, userId);
      } else {
        level = 'initiative';
        sql = `
          SELECT
            COALESCE(t.initiative_id, 'unassigned') as id,
            COALESCE(i.name, 'Unassigned') as name,
            COUNT(*) as task_count,
            SUM(CASE WHEN UPPER(COALESCE(t.status, '')) = 'DONE' THEN 1 ELSE 0 END) as done_count,
            ROUND(AVG(COALESCE(t.progress, 0))) as avg_progress
          FROM tasks t
          LEFT JOIN initiatives i ON i.id = t.initiative_id
          WHERE t.organization_id = ?
        `;
        if (programId) {
          sql += ` AND i.program_id = ?`;
          params.push(programId);
        }
        if (projectId) {
          sql += ` AND t.project_id = ?`;
          params.push(projectId);
        }
        if (listId) {
          sql += ` AND COALESCE(t.list_id, t.workstream_id) = ?`;
          params.push(listId);
        }
        sql += `
          GROUP BY COALESCE(t.initiative_id, 'unassigned'), COALESCE(i.name, 'Unassigned')
          ORDER BY name ASC
        `;
      }

      const rows = await DbPromise.all<any>(sql, params);
      const items = (rows || []).map((row: any) => {
        const taskCount = Number(row.task_count || 0);
        const doneCount = Number(row.done_count || 0);
        const progress = Number(row.avg_progress || 0);
        return {
          id: row.id,
          name: row.name,
          taskCount,
          doneCount,
          progress,
        };
      });

      res.json({
        level,
        items,
        totals: {
          taskCount: items.reduce((sum: number, item: any) => sum + item.taskCount, 0),
          doneCount: items.reduce((sum: number, item: any) => sum + item.doneCount, 0),
          avgProgress:
            items.length > 0
              ? Math.round(
                  items.reduce((sum: number, item: any) => sum + item.progress, 0) / items.length
                )
              : 0,
        },
      });
    }
  );

  /**
   * Get single task by ID
   */
  static getTaskById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Get user language from Accept-Language header or default to English
      const acceptLang = req.headers['accept-language'] || req.headers['Accept-Language'] || 'en';
      const userLang = acceptLang.split(',')[0].split('-')[0].toLowerCase() || 'en';
      const supportedLangs = ['pl', 'en', 'de', 'es', 'ar', 'ja'];
      const lang = supportedLangs.includes(userLang) ? userLang : 'en';

      const sql = `
            SELECT 
                t.*,
                a.first_name as assignee_first_name,
                a.last_name as assignee_last_name,
                a.avatar_url as assignee_avatar,
                r.first_name as reporter_first_name,
                r.last_name as reporter_last_name,
                r.avatar_url as reporter_avatar,
                p.name as project_name,
                i.name as initiative_name,
                i.program_id as program_id,
                COALESCE(t.list_id, t.workstream_id) as list_id,
                w.name as list_name
            FROM tasks t
            LEFT JOIN users a ON t.assignee_id = a.id
            LEFT JOIN users r ON t.reporter_id = r.id
            LEFT JOIN projects p ON t.project_id = p.id
            LEFT JOIN initiatives i ON t.initiative_id = i.id
            LEFT JOIN workstreams w ON w.id = COALESCE(t.list_id, t.workstream_id)
            WHERE t.id = ? AND t.organization_id = ?
        `;

      const t = await DbPromise.get<TaskRow>(sql, [id, orgId]);
      if (!t) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      // Auto-apply decision block if there is an active blocking decision impact
      // (keeps task.status consistent with decision gate)
      try {
        if (t.status !== 'done') {
          const activeBlocker = await DbPromise.get<{ id: string; title: string }>(
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
            [orgId, id]
          );

          const shouldBlock =
            Boolean(activeBlocker?.id) && (t.status !== 'blocked' || !t.blocked_by_decision_id);

          if (shouldBlock) {
            const nowIso = new Date().toISOString();
            await DbPromise.run(
              `UPDATE tasks SET
                status = 'blocked',
                blocked_at = ?,
                blocked_reason = COALESCE(NULLIF(blocked_reason, ''), ?),
                blocked_by_decision_id = COALESCE(blocked_by_decision_id, ?),
                updated_at = ?
               WHERE id = ? AND organization_id = ?`,
              [
                nowIso,
                `[decision:${activeBlocker!.id}] Blocked by decision: ${activeBlocker!.title}`,
                activeBlocker!.id,
                nowIso,
                id,
                orgId,
              ]
            );
            t.status = 'blocked';
            (t as any).blocked_by_decision_id = activeBlocker!.id;
            (t as any).blocked_at = nowIso;
            t.blocked_reason =
              t.blocked_reason && t.blocked_reason !== ''
                ? t.blocked_reason
                : `[decision:${activeBlocker!.id}] Blocked by decision: ${activeBlocker!.title}`;
          }
        }
      } catch (e: any) {
        logger.warn('[TaskController] Decision-block auto-apply skipped:', e?.message || e);
      }

      const task = {
        id: t.id,
        projectId: t.project_id,
        projectName: getMultilingualText(t.project_name, lang),
        organizationId: t.organization_id,
        title: getMultilingualText(t.title, lang),
        source: t.source || 'manual',
        description: getMultilingualText(t.description, lang),
        status: t.status,
        priority: t.priority,
        assigneeId: t.assignee_id,
        backupAssigneeId: t.backup_assignee_id,
        assignee: t.assignee_id
          ? {
              id: t.assignee_id,
              firstName: t.assignee_first_name,
              lastName: t.assignee_last_name,
              avatarUrl: t.assignee_avatar,
            }
          : null,
        reporterId: t.reporter_id,
        reporter: t.reporter_id
          ? {
              id: t.reporter_id,
              firstName: t.reporter_first_name,
              lastName: t.reporter_last_name,
              avatarUrl: t.reporter_avatar,
            }
          : null,
        dueDate: t.due_date,
        startedAt: t.started_at,
        estimatedHours: t.estimated_hours,
        checklist: safeJsonParse(t.checklist, []),
        attachments: safeJsonParse(t.attachments, []),
        tags: safeJsonParse(t.tags, []),
        customStatusId: t.custom_status_id,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        completedAt: t.completed_at,
        taskType: t.task_type,
        budgetAllocated: t.budget_allocated,
        budgetSpent: t.budget_spent,
        riskRating: t.risk_rating,
        acceptanceCriteria: t.acceptance_criteria,
        blockingIssues: t.blocking_issues,
        stepPhase: t.step_phase,
        why: t.why,
        ownerId: t.owner_id,
        requiresAcceptance: Boolean(t.requires_acceptance),
        acceptanceType: t.acceptance_type || null,
        acceptorId: t.acceptor_id || null,
        weight: t.weight ?? 1,
        weightReason: t.weight_reason || null,
        roadmapInitiativeId: t.roadmap_initiative_id,
        kpiId: t.kpi_id,
        raidItemId: t.raid_item_id,
        assignees: safeJsonParse(t.assignees, []),
        programId: t.program_id || t.project_id || null,
        initiativeId: t.initiative_id,
        initiativeName: getMultilingualText(t.initiative_name, lang),
        listId: t.list_id || null,
        listName: t.list_name || null,
        progress: t.progress || 0,
        blockedReason: t.blocked_reason || '',
        blockedAt: (t as any).blocked_at || null,
        blockedByDecisionId: (t as any).blocked_by_decision_id || null,
        // SLA / Escalation
        slaHours: t.sla_hours,
        slaDueAt: t.sla_due_at,
        escalationLevel: t.escalation_level || 0,
        escalatedToId: t.escalated_to_id,
        lastEscalatedAt: t.last_escalated_at,
      };

      res.json(task);
    }
  );

  /**
   * Create a new task
   */
  /**
   * Create a new task
   */
  static createTask = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const body = req.body as CreateTaskRequest;
      const {
        projectId,
        title,
        source,
        description,
        status,
        priority,
        assigneeId,
        backupAssigneeId,
        dueDate,
        startedAt,
        estimatedHours,
        tags,
        taskType,
        initiativeId,
        listId,
        workstreamId,
        ownerId,
        blockedByDecisionId,
        requiresAcceptance,
        acceptanceType,
        acceptorId,
        why,
        expectedOutcome,
        decisionImpact,
        evidenceRequired,
        strategicContribution,
        weight,
        weightReason,
        roadmapInitiativeId,
        kpiId,
        raidItemId,
        assignees,
        progress,
        blockedReason,
        idempotencyKey,
      } = body;

      // EXE-002-004: idempotent retry support, originally scoped to tasks created
      // under an initiative (partial unique index idx_tasks_idempotency on
      // (initiative_id, idempotency_key)). Postgres treats every NULL initiative_id
      // as distinct from every other NULL in that index, so it silently enforced
      // NOTHING for tasks without an initiative — exactly the case TaskDetailModal
      // uses for "global" tasks (`initiativeId: initiativeId || null`).
      // M02-003/M02-P04 (20260804_m02a_tasks_tenant_idempotency.sql) adds a second,
      // org-scoped unique index (organization_id, idempotency_key) that does cover
      // the no-initiative case, so the lookup here now branches: initiative-scoped
      // when an initiativeId is present (byte-for-byte the original EXE-002-004
      // contract), org-scoped when it is not.
      if (idempotencyKey) {
        const existingTask = initiativeId
          ? await DbPromise.get<TaskRow>(
              `SELECT * FROM tasks WHERE initiative_id = ? AND idempotency_key = ? AND organization_id = ?`,
              [initiativeId, idempotencyKey, orgId]
            )
          : await DbPromise.get<TaskRow>(
              `SELECT * FROM tasks WHERE initiative_id IS NULL AND idempotency_key = ? AND organization_id = ?`,
              [idempotencyKey, orgId]
            );
        if (existingTask) {
          res.status(200).json({ ...existingTask, idempotent: true });
          return;
        }
      }

      let effectiveProjectId = projectId || null;
      const effectiveListId = listId || workstreamId || null;
      if (!effectiveProjectId && initiativeId) {
        const parentInitiative = await DbPromise.get<{ project_id?: string }>(
          `SELECT project_id FROM initiatives WHERE id = ? AND organization_id = ?`,
          [initiativeId, orgId]
        );
        effectiveProjectId = parentInitiative?.project_id || null;
      }
      if (!effectiveProjectId && effectiveListId) {
        const parentWorkstream = await DbPromise.get<{ project_id?: string }>(
          `SELECT project_id FROM workstreams WHERE id = ? LIMIT 1`,
          [effectiveListId]
        );
        effectiveProjectId = parentWorkstream?.project_id || null;
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      // Default values
      const finalStatus = status || 'todo';
      const finalPriority = priority || 'medium';
      const finalTaskType = taskType || 'execution';
      const finalSource = source === 'ai' ? 'ai' : 'manual';
      const finalExpectedOutcome = expectedOutcome || '';
      const finalDecisionImpact = decisionImpact ? JSON.stringify(decisionImpact) : '{}';
      const finalEvidenceRequired = evidenceRequired ? JSON.stringify(evidenceRequired) : '[]';
      const finalStrategicContribution = strategicContribution
        ? JSON.stringify(strategicContribution)
        : '[]';
      const finalProgress = progress || 0;
      const finalBlockedReason = blockedReason || '';
      const finalRequiresAcceptance = Boolean(requiresAcceptance);
      const finalWeight = typeof weight === 'number' ? weight : 1;
      // Owner is mandatory (system contract). Default: explicit owner -> assignee -> creator.
      const effectiveOwnerId = ownerId || assigneeId || userId;
      const effectiveBlockedByDecisionId =
        finalStatus === 'blocked' ? blockedByDecisionId || null : null;
      const effectiveBlockedAt = finalStatus === 'blocked' ? now : null;

      let finalCustomFieldsJson = '{}';
      const rawCustomFields = (body as any).customFields;
      if (rawCustomFields && typeof rawCustomFields === 'object') {
        try {
          const { validateCustomFieldValues } = await import('../services/customFieldsService.js');
          const fieldRows = await DbPromise.all<Record<string, unknown>>(
            `SELECT * FROM task_custom_field_schemas WHERE organization_id = ? AND entity_type = 'task' AND is_active = 1`,
            [orgId]
          );
          if (fieldRows.length > 0) {
            const defs = fieldRows.map((r: any) => ({
              fieldKey: r.field_key,
              label: r.label || r.field_key,
              fieldType: r.field_type,
              required: Boolean(r.required),
              entityType: r.entity_type || 'task',
              options: r.options_json ? JSON.parse(r.options_json) : undefined,
              validation: r.validation_json ? JSON.parse(r.validation_json) : undefined,
              isActive: true,
              sortOrder: r.sort_order ?? 0,
            }));
            const result = validateCustomFieldValues(defs as any, rawCustomFields);
            if (!result.valid) {
              res
                .status(400)
                .json({ error: 'Custom field validation failed', fieldErrors: result.errors });
              return;
            }
          }
          finalCustomFieldsJson = JSON.stringify(rawCustomFields);
        } catch (cfErr: any) {
          logger.warn(
            '[TaskController.createTask] Custom fields validation skipped:',
            cfErr?.message
          );
          finalCustomFieldsJson = JSON.stringify(rawCustomFields);
        }
      }

      const sql = `
            INSERT INTO tasks (
                id, project_id, organization_id, title, description,
                status, priority, assignee_id, backup_assignee_id, reporter_id,
                due_date, started_at, estimated_hours, tags,
                task_type, initiative_id, list_id, workstream_id, why,
                source,
                owner_id, requires_acceptance, acceptance_type, acceptor_id,
                weight, weight_reason,
                expected_outcome, decision_impact, evidence_required, strategic_contribution,
                roadmap_initiative_id, kpi_id, raid_item_id, assignees,
                progress, blocked_reason, blocked_by_decision_id, blocked_at,
                custom_fields_json, idempotency_key,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

      // Idempotency is enforced whenever a key is supplied — via
      // idx_tasks_idempotency (initiative_id, idempotency_key) when initiativeId is
      // present, via idx_tasks_idempotency_org (organization_id, idempotency_key)
      // — added by 20260804_m02a_tasks_tenant_idempotency.sql — otherwise. See the
      // comment on the pre-insert SELECT above for why the old
      // `initiativeId && idempotencyKey` gate silently protected nothing for
      // no-initiative tasks.
      const effectiveIdempotencyKey = idempotencyKey || null;

      const insertParams = [
        id,
        effectiveProjectId,
        orgId,
        title,
        description,
        finalStatus,
        finalPriority,
        assigneeId,
        backupAssigneeId || null,
        userId,
        dueDate,
        startedAt || null,
        estimatedHours,
        tags ? JSON.stringify(tags) : '[]',
        finalTaskType,
        initiativeId,
        effectiveListId,
        effectiveListId,
        why,
        finalSource,
        effectiveOwnerId,
        finalRequiresAcceptance,
        finalRequiresAcceptance ? acceptanceType || 'manual' : null,
        finalRequiresAcceptance ? acceptorId || null : null,
        finalWeight,
        weightReason || null,
        finalExpectedOutcome,
        finalDecisionImpact,
        finalEvidenceRequired,
        finalStrategicContribution,
        roadmapInitiativeId,
        kpiId,
        raidItemId,
        assignees ? JSON.stringify(assignees) : '[]',
        finalProgress,
        finalBlockedReason,
        effectiveBlockedByDecisionId,
        effectiveBlockedAt,
        finalCustomFieldsJson,
        effectiveIdempotencyKey,
        now,
        now,
      ];

      let result: Awaited<ReturnType<typeof DbPromise.run>>;
      if (effectiveIdempotencyKey) {
        // Race guard: two concurrent retries can both pass the pre-insert
        // SELECT above. Let a unique-violation on (initiative_id, idempotency_key)
        // surface as a thrown error here, then resolve it by re-reading the
        // row the other request inserted instead of failing the request.
        try {
          result = await DbPromise.run(sql, insertParams, { fallback: false });
        } catch (insertErr: any) {
          if (insertErr?.code === '23505') {
            const winningTask = initiativeId
              ? await DbPromise.get<TaskRow>(
                  `SELECT * FROM tasks WHERE initiative_id = ? AND idempotency_key = ? AND organization_id = ?`,
                  [initiativeId, effectiveIdempotencyKey, orgId]
                )
              : await DbPromise.get<TaskRow>(
                  `SELECT * FROM tasks WHERE initiative_id IS NULL AND idempotency_key = ? AND organization_id = ?`,
                  [effectiveIdempotencyKey, orgId]
                );
            if (winningTask) {
              res.status(200).json({ ...winningTask, idempotent: true });
              return;
            }
          }
          throw insertErr;
        }
      } else {
        result = await DbPromise.run(sql, insertParams);
      }

      if (!result.success) {
        logger.error('[TaskController] Task creation failed:', result.error);
        res.status(500).json({ error: 'Task creation failed', details: result.error });
        return;
      }

      // Notifications
      if (assigneeId && assigneeId !== userId) {
        createNotificationSafely({
          userId: assigneeId,
          organizationId: orgId,
          projectId: effectiveProjectId,
          type: 'task_assigned',
          title: 'New Task Assignment',
          message: `You have been assigned to task "${title}"`,
          relatedObjectType: 'TASK',
          relatedObjectId: id,
        }).catch((err: any) => logger.error('[TaskController] Notification failed:', err));
      }

      // Activity logging
      (ActivityService as any)
        .log({
          organizationId: orgId,
          userId: userId,
          action: 'created',
          entityType: 'TASK',
          entityId: id,
          entityName: title,
          newValue: body,
        })
        .catch((err: any) => logger.error('[TaskController] Activity log failed:', err));

      // Audit Trail (PMO Standard)
      await DbPromise.run(
        `INSERT INTO pmo_audit_trail (id, project_id, pmo_domain_id, object_type, object_id, action, actor_id, metadata, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          effectiveProjectId,
          PMO_DOMAIN_IDS.SCOPE_CHANGE_CONTROL,
          'TASK',
          id,
          'TASK_CREATED',
          userId,
          JSON.stringify(body),
          now,
        ]
      ).catch((err: Error | null) => logger.error('[TaskController] PMO Audit log failed:', err));

      // V4-TASK-08: Unified audit log
      auditEventsService
        .log({
          actorId: userId,
          actorType: 'USER',
          action: 'TASK_CREATE',
          resourceType: 'task',
          resourceId: id,
          after: { title, status: finalStatus, priority: finalPriority, assigneeId, dueDate },
          metadata: { initiativeId, projectId: effectiveProjectId },
          organizationId: orgId,
        })
        .catch((err: any) => logger.error('[TaskController] Audit log failed:', err?.message));

      await syncTaskToJiraIntegrations({
        organizationId: orgId,
        task: {
          id,
          title,
          description: description || null,
          status: finalStatus,
        },
      });

      const dueAtMs = dueDate ? new Date(dueDate).getTime() : Number.NaN;
      if (effectiveProjectId && Number.isFinite(dueAtMs)) {
        const daysUntilDue = Math.ceil((dueAtMs - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysUntilDue <= 7) {
          await dispatchProjectCommunicationEvent({
            organizationId: orgId,
            projectId: effectiveProjectId,
            eventType: 'task_due',
            title: `Task due soon: ${title}`,
            body:
              daysUntilDue <= 0
                ? `Task "${title}" is due now or overdue.`
                : `Task "${title}" is due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}.`,
            deepLink: `/my-work/tasks/${id}`,
            severity: daysUntilDue <= 1 ? 'high' : 'normal',
          }).catch((err: any) =>
            logger.warn('[TaskController] Task due communication sync failed:', err?.message)
          );
        }
      }

      if (effectiveProjectId && finalStatus === 'blocked') {
        await dispatchProjectCommunicationEvent({
          organizationId: orgId,
          projectId: effectiveProjectId,
          eventType: 'blocker_detected',
          title: `Task blocked: ${title}`,
          body: finalBlockedReason || `Task "${title}" was marked as blocked.`,
          deepLink: `/my-work/tasks/${id}`,
          severity: 'high',
        }).catch((err: any) =>
          logger.warn('[TaskController] Blocker communication sync failed:', err?.message)
        );
      }

      // Recalculate Initiative Progress
      if (initiativeId) {
        // Lazy load for now to avoid circular dependency
        const InitiativeService = await import('../services/initiativeService.js').then(
          (m) => m.default || m
        );
        if (InitiativeService && (InitiativeService as any).recalculateProgress) {
          (InitiativeService as any)
            .recalculateProgress({ organizationId: orgId, initiativeId })
            .catch((err: any) => logger.error('[TaskController] Recalc failed:', err));
        }
      }

      logger.info(`[TaskController DEBUG] Attempting to retrieve created task. ID: ${id}`);
      const createdTask = await DbPromise.get<TaskRow>(`SELECT * FROM tasks WHERE id = ?`, [id]);
      logger.info(`[TaskController DEBUG] Retrieved task:`, createdTask);

      res.status(201).json(createdTask);
    }
  );

  /**
   * Update task
   */
  /**
   * Update task
   */
  static updateTask = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const userId = req.user?.id;
      const orgId = req.user?.organizationId;
      if (!userId || !orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Get current task
      const currentTask = await DbPromise.get<TaskRow>(
        `SELECT * FROM tasks WHERE id = ? AND organization_id = ?`,
        [id, orgId]
      );

      if (!currentTask) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      const updates = { ...(req.body as UpdateTaskRequest) } as Record<string, any>;
      if (
        Object.prototype.hasOwnProperty.call(updates, 'listId') &&
        !Object.prototype.hasOwnProperty.call(updates, 'workstreamId')
      ) {
        updates.workstreamId = updates.listId;
      }
      if (
        Object.prototype.hasOwnProperty.call(updates, 'workstreamId') &&
        !Object.prototype.hasOwnProperty.call(updates, 'listId')
      ) {
        updates.listId = updates.workstreamId;
      }

      // Owner is mandatory (system contract). Prevent explicitly clearing.
      if (Object.prototype.hasOwnProperty.call(updates as any, 'ownerId')) {
        const v = (updates as any).ownerId;
        if (!v) {
          res.status(400).json({ error: 'ownerId is required' });
          return;
        }
      }
      // If legacy task has no owner, auto-heal on first update.
      if (!currentTask.owner_id && !(updates as any).ownerId) {
        const incomingAssignee = (updates as any).assigneeId || (updates as any).assignee_id;
        (updates as any).ownerId = incomingAssignee || currentTask.assignee_id || userId;
      }

      // V4-TASK-03: Workflow guard — block invalid status transitions
      const newStatus = (updates as any)?.status;
      if (
        newStatus != null &&
        String(newStatus).toLowerCase() !== String(currentTask.status || '').toLowerCase()
      ) {
        const validation = validateTaskStatusTransition(currentTask.status, newStatus);
        if (!validation.allowed && 'rule' in validation && 'message' in validation) {
          res.status(400).json({
            error: validation.message,
            code: validation.rule,
            ...buildTransitionErrorPayload(currentTask.status, newStatus),
          });
          return;
        }
      }

      // Gate: prevent completing when blocking decisions exist
      if ((updates as any)?.status === 'done') {
        const blockers = await DbPromise.all<{ id: string; title: string }>(
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
            LIMIT 5
          `,
          [orgId, id]
        );
        if (Array.isArray(blockers) && blockers.length > 0) {
          res.status(409).json({
            error: 'Blocking decisions must be resolved before completing the task',
            blockers,
          });
          return;
        }
      }

      if (updates.customFields && typeof updates.customFields === 'object') {
        try {
          const { validateCustomFieldValues } = await import('../services/customFieldsService.js');
          const fieldRows = await DbPromise.all<Record<string, unknown>>(
            `SELECT * FROM task_custom_field_schemas WHERE organization_id = ? AND entity_type = 'task' AND is_active = 1`,
            [orgId]
          );
          if (fieldRows.length > 0) {
            const defs = fieldRows.map((r: any) => ({
              fieldKey: r.field_key,
              label: r.label || r.field_key,
              fieldType: r.field_type,
              required: Boolean(r.required),
              entityType: r.entity_type || 'task',
              options: r.options_json ? JSON.parse(r.options_json) : undefined,
              validation: r.validation_json ? JSON.parse(r.validation_json) : undefined,
              isActive: true,
              sortOrder: r.sort_order ?? 0,
            }));
            const cfResult = validateCustomFieldValues(defs as any, updates.customFields);
            if (!cfResult.valid) {
              res
                .status(400)
                .json({ error: 'Custom field validation failed', fieldErrors: cfResult.errors });
              return;
            }
          }
          updates.custom_fields_json = JSON.stringify(updates.customFields);
        } catch (cfErr: any) {
          logger.warn(
            '[TaskController.updateTask] Custom fields validation skipped:',
            cfErr?.message
          );
          updates.custom_fields_json = JSON.stringify(updates.customFields);
        }
        delete updates.customFields;
      }

      const allowedFields = [
        'title',
        'description',
        'status',
        'priority',
        'assignee_id',
        'backup_assignee_id',
        'due_date',
        'started_at',
        'estimated_hours',
        'checklist',
        'attachments',
        'tags',
        'custom_status_id',
        'task_type',
        'initiative_id',
        'list_id',
        'workstream_id',
        'why',
        'owner_id',
        'requires_acceptance',
        'acceptance_type',
        'acceptor_id',
        'weight',
        'weight_reason',
        'expected_outcome',
        'decision_impact',
        'evidence_required',
        'strategic_contribution',
        'roadmap_initiative_id',
        'kpi_id',
        'raid_item_id',
        'assignees',
        'progress',
        'blocked_reason',
        'blocked_by_decision_id',
        'blocked_at',
        'custom_fields_json',
      ];

      const fieldMap: Record<string, string> = {
        assigneeId: 'assignee_id',
        backupAssigneeId: 'backup_assignee_id',
        dueDate: 'due_date',
        startedAt: 'started_at',
        estimatedHours: 'estimated_hours',
        customStatusId: 'custom_status_id',
        taskType: 'task_type',
        initiativeId: 'initiative_id',
        listId: 'list_id',
        workstreamId: 'workstream_id',
        ownerId: 'owner_id',
        requiresAcceptance: 'requires_acceptance',
        acceptanceType: 'acceptance_type',
        acceptorId: 'acceptor_id',
        weightReason: 'weight_reason',
        expectedOutcome: 'expected_outcome',
        decisionImpact: 'decision_impact',
        evidenceRequired: 'evidence_required',
        strategicContribution: 'strategic_contribution',
        roadmapInitiativeId: 'roadmap_initiative_id',
        kpiId: 'kpi_id',
        raidItemId: 'raid_item_id',
        blockedReason: 'blocked_reason',
        blockedByDecisionId: 'blocked_by_decision_id',
        blockedAt: 'blocked_at',
      };

      const sqlUpdates: string[] = [];
      const params: SQLParam[] = [];
      const historyEntries: any[] = [];
      const now = new Date().toISOString();

      Object.keys(updates).forEach((key) => {
        const dbKey = fieldMap[key] || key;
        if (allowedFields.includes(dbKey)) {
          let value = (updates as any)[key];

          // Serialize JSON fields
          if (
            [
              'checklist',
              'attachments',
              'tags',
              'decision_impact',
              'evidence_required',
              'strategic_contribution',
              'assignees',
            ].includes(dbKey)
          ) {
            if (typeof value === 'object') value = JSON.stringify(value);
          }

          // Check for change
          const oldValue = (currentTask as any)[dbKey];
          if (value !== oldValue) {
            sqlUpdates.push(`${dbKey} = ?`);
            params.push(value);

            historyEntries.push({
              taskId: id,
              field: dbKey,
              oldValue: oldValue ? String(oldValue) : '',
              newValue: value ? String(value) : '',
              changedBy: userId,
            });
          }
        }
      });

      if (sqlUpdates.length === 0) {
        res.json(currentTask);
        return;
      }

      // Status change side effects
      if (updates.status === 'done' && currentTask.status !== 'done') {
        sqlUpdates.push(`completed_at = ?`);
        params.push(now);
        if (!updates.progress || updates.progress < 100) {
          sqlUpdates.push(`progress = ?`);
          params.push(100);
        }
      }

      // When task becomes blocked, set blocked_at if missing
      if ((updates as any).status === 'blocked' && currentTask.status !== 'blocked') {
        const alreadySettingBlockedAt = sqlUpdates.some((s) => s.startsWith('blocked_at ='));
        if (!alreadySettingBlockedAt) {
          sqlUpdates.push(`blocked_at = ?`);
          params.push(now);
        }
      }

      if (
        updates.status === 'blocked' &&
        (updates.blockedReason || currentTask.blocked_reason) === ''
      ) {
        res.status(400).json({ error: 'Blocked reason is required' });
        return;
      }

      sqlUpdates.push(`updated_at = ?`);
      params.push(now);

      const sql = `UPDATE tasks SET ${sqlUpdates.join(', ')} WHERE id = ?`;
      params.push(id);

      await DbPromise.run(sql, params);

      // History logs
      if (historyEntries.length > 0) {
        for (const entry of historyEntries) {
          await DbPromise.run(
            `INSERT INTO task_history (id, task_id, field, old_value, new_value, changed_by) VALUES (?, ?, ?, ?, ?, ?)`,
            [uuidv4(), entry.taskId, entry.field, entry.oldValue, entry.newValue, entry.changedBy]
          ).catch((err: Error | null) => logger.error('[TaskController] History log failed:', err));
        }
      }

      // Activity log
      (ActivityService as any)
        .log({
          organizationId: orgId,
          userId: userId,
          action: 'updated',
          entityType: 'TASK',
          entityId: id,
          entityName: currentTask.title,
          newValue: updates,
        })
        .catch((err: any) => logger.error('[TaskController] Activity log failed:', err));

      // V4-TASK-08: Unified audit log
      const beforeSnapshot = {
        title: currentTask.title,
        status: currentTask.status,
        priority: currentTask.priority,
        assigneeId: currentTask.assignee_id,
        dueDate: currentTask.due_date,
      };
      const afterSnapshot = {
        ...beforeSnapshot,
        ...Object.fromEntries(
          Object.entries(updates).filter(([k]) =>
            ['title', 'status', 'priority', 'assigneeId', 'dueDate'].includes(k)
          )
        ),
      };
      auditEventsService
        .log({
          actorId: userId,
          actorType: 'USER',
          action: 'TASK_UPDATE',
          resourceType: 'task',
          resourceId: id,
          before: beforeSnapshot,
          after: afterSnapshot,
          metadata: { changedFields: Object.keys(updates) },
          organizationId: orgId,
        })
        .catch((err: any) => logger.error('[TaskController] Audit log failed:', err?.message));

      const syncedTask = await DbPromise.get<TaskRow>(
        `SELECT * FROM tasks WHERE id = ? AND organization_id = ?`,
        [id, orgId]
      );
      await syncTaskToJiraIntegrations({
        organizationId: orgId,
        task: {
          id,
          title: String((updates as any).title || currentTask.title || ''),
          description:
            (updates as any).description !== undefined
              ? ((updates as any).description as string | null)
              : (currentTask.description as string | null),
          status: String((updates as any).status || syncedTask?.status || currentTask.status || ''),
        },
      });

      const nextProjectId = String(syncedTask?.project_id || currentTask.project_id || '').trim();
      const nextTitle = String(
        (updates as any).title || syncedTask?.title || currentTask.title || ''
      );
      const nextStatus = String(
        (updates as any).status || syncedTask?.status || currentTask.status || ''
      ).toLowerCase();
      const nextDueDate =
        (updates as any).dueDate ??
        (updates as any).due_date ??
        syncedTask?.due_date ??
        currentTask.due_date ??
        null;

      if (nextProjectId && nextDueDate) {
        const dueAtMs = new Date(String(nextDueDate)).getTime();
        if (Number.isFinite(dueAtMs)) {
          const daysUntilDue = Math.ceil((dueAtMs - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysUntilDue <= 7) {
            await dispatchProjectCommunicationEvent({
              organizationId: orgId,
              projectId: nextProjectId,
              eventType: 'task_due',
              title: `Task due soon: ${nextTitle}`,
              body:
                daysUntilDue <= 0
                  ? `Task "${nextTitle}" is due now or overdue.`
                  : `Task "${nextTitle}" is due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}.`,
              deepLink: `/my-work/tasks/${id}`,
              severity: daysUntilDue <= 1 ? 'high' : 'normal',
            }).catch((err: any) =>
              logger.warn('[TaskController] Task due communication sync failed:', err?.message)
            );
          }
        }
      }

      if (nextProjectId && nextStatus === 'blocked') {
        const nextBlockedReason = String(
          (updates as any).blockedReason ||
            (updates as any).blocked_reason ||
            syncedTask?.blocked_reason ||
            currentTask.blocked_reason ||
            ''
        ).trim();
        await dispatchProjectCommunicationEvent({
          organizationId: orgId,
          projectId: nextProjectId,
          eventType: 'blocker_detected',
          title: `Task blocked: ${nextTitle}`,
          body: nextBlockedReason || `Task "${nextTitle}" was marked as blocked.`,
          deepLink: `/my-work/tasks/${id}`,
          severity: 'high',
        }).catch((err: any) =>
          logger.warn('[TaskController] Blocker communication sync failed:', err?.message)
        );
      }

      // V4-TASK-05: Emit task.updated event for automation rules engine
      try {
        const { EventBus } = await import('../services/event/EventBus.js');
        EventBus.getInstance().publish('task.updated', {
          taskId: id,
          organizationId: orgId,
          userId,
          oldStatus: beforeSnapshot.status,
          newStatus: afterSnapshot.status,
          assigneeId: (updates as any).assigneeId || currentTask.assignee_id,
          priority: (updates as any).priority || currentTask.priority,
          title: currentTask.title,
          changedFields: Object.keys(updates),
        });
      } catch (evtErr: any) {
        logger.warn('[TaskController] EventBus publish failed:', evtErr?.message);
      }

      // M13/R4-E2: dedicated initiative-assignment notification when a task's
      // assignee actually CHANGES — links the new assignee to the initiative
      // (distinct from the generic task_updated below). Fire-and-forget, fail-safe.
      try {
        const nextAssignee = (updates as any).assigneeId || (updates as any).assignee_id;
        if (
          nextAssignee &&
          String(nextAssignee) !== String(currentTask.assignee_id || '') &&
          String(nextAssignee) !== String(userId) &&
          currentTask.initiative_id
        ) {
          void notifyAssignment(
            orgId,
            String(currentTask.initiative_id),
            String(nextAssignee),
            'task assignee',
            { actorId: userId }
          );
        }
      } catch (asgErr: any) {
        logger.warn('[TaskController] R4 notifyAssignment skipped:', asgErr?.message);
      }

      // Notifications
      const affectedUserId = (updates as any).assigneeId || currentTask.assignee_id;
      if (affectedUserId && affectedUserId !== userId) {
        createNotificationSafely({
          userId: affectedUserId,
          organizationId: orgId,
          type: 'task_updated',
          title: 'Task Updated',
          message: `Task "${currentTask.title}" has been updated`,
          relatedObjectType: 'TASK',
          relatedObjectId: id,
        }).catch((err: any) => logger.error('[TaskController] Notification failed:', err));
      }

      // PMO Notification Rules (throttled)
      try {
        const updatedRow = await DbPromise.get<TaskRow>(
          `SELECT * FROM tasks WHERE id = ? AND organization_id = ?`,
          [id, orgId]
        );
        const row: any = updatedRow || currentTask;
        const nowIso = now;
        const nowMs = Date.now();
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;

        const parseMs = (ts?: string | null) => {
          if (!ts) return 0;
          const t = Date.parse(ts);
          return Number.isFinite(t) ? t : 0;
        };
        const canNotify = (lastAt?: string | null) => nowMs - parseMs(lastAt) > ONE_DAY_MS;
        const isDone = (s?: string) => String(s || '').toLowerCase() === 'done';

        const due = row.due_date || null;
        const statusVal = row.status;
        const assignee = row.assignee_id || null;
        const backup = row.backup_assignee_id || null;
        const owner = row.owner_id || null;
        const acceptor = row.acceptor_id || null;
        const requiresAcceptanceFlag = Boolean(row.requires_acceptance);

        const recipientsUnique = (ids: Array<string | null | undefined>) => {
          const set = new Set<string>();
          ids.forEach((x) => {
            if (x && x !== userId) set.add(String(x));
          });
          return Array.from(set);
        };

        // Overdue
        const overdueEnabled = (row.notify_on_overdue ?? 1) === 1;
        if (overdueEnabled && due && !isDone(statusVal)) {
          const dueMs = Date.parse(due);
          const isOverdue = Number.isFinite(dueMs) && dueMs < nowMs;
          if (isOverdue && canNotify(row.last_overdue_notified_at)) {
            const recipients = recipientsUnique([assignee, owner, backup]);
            for (const rid of recipients) {
              createNotificationSafely({
                userId: rid,
                organizationId: orgId,
                type: 'task_overdue',
                title: 'Task Overdue',
                message: `Task "${row.title}" is overdue`,
                relatedObjectType: 'TASK',
                relatedObjectId: id,
              }).catch((err: any) =>
                logger.error('[TaskController] Overdue notification failed:', err)
              );
            }
            await DbPromise.run(`UPDATE tasks SET last_overdue_notified_at = ? WHERE id = ?`, [
              nowIso,
              id,
            ]);
          }
        }

        // Acceptance gate (we treat status=review as waiting for approval)
        const acceptanceEnabled = (row.notify_on_acceptance ?? 1) === 1;
        const enteredReview = updates.status === 'review' && currentTask.status !== 'review';
        if (
          acceptanceEnabled &&
          requiresAcceptanceFlag &&
          acceptor &&
          (row.status === 'review' || enteredReview) &&
          canNotify(row.last_acceptance_notified_at)
        ) {
          createNotificationSafely({
            userId: acceptor,
            organizationId: orgId,
            type: 'task_pending_approval',
            title: 'Approval Required',
            message: `Task "${row.title}" is awaiting approval`,
            relatedObjectType: 'TASK',
            relatedObjectId: id,
          }).catch((err: any) =>
            logger.error('[TaskController] Acceptance notification failed:', err)
          );
          await DbPromise.run(`UPDATE tasks SET last_acceptance_notified_at = ? WHERE id = ?`, [
            nowIso,
            id,
          ]);
        }

        // Unassigned -> backup/owner
        const unassignedEnabled = (row.notify_on_unassigned ?? 1) === 1;
        if (
          unassignedEnabled &&
          !assignee &&
          (backup || owner) &&
          canNotify(row.last_unassigned_notified_at)
        ) {
          const target = backup || owner;
          if (target) {
            createNotificationSafely({
              userId: target,
              organizationId: orgId,
              type: 'task_unassigned',
              title: 'Task Unassigned',
              message: `Task "${row.title}" has no assignee`,
              relatedObjectType: 'TASK',
              relatedObjectId: id,
            }).catch((err: any) =>
              logger.error('[TaskController] Unassigned notification failed:', err)
            );
            await DbPromise.run(`UPDATE tasks SET last_unassigned_notified_at = ? WHERE id = ?`, [
              nowIso,
              id,
            ]);
          }
        }

        // Blocked (status transition)
        const blockedEnabled = (row.notify_on_blocked ?? 1) === 1;
        const becameBlocked = updates.status === 'blocked' && currentTask.status !== 'blocked';
        if (blockedEnabled && becameBlocked && canNotify(row.last_blocked_notified_at)) {
          const recipients = recipientsUnique([assignee, owner, backup]);
          for (const rid of recipients) {
            createNotificationSafely({
              userId: rid,
              organizationId: orgId,
              type: 'task_blocked',
              title: 'Task Blocked',
              message: `Task "${row.title}" is blocked`,
              relatedObjectType: 'TASK',
              relatedObjectId: id,
            }).catch((err: any) =>
              logger.error('[TaskController] Blocked notification failed:', err)
            );
          }
          await DbPromise.run(`UPDATE tasks SET last_blocked_notified_at = ? WHERE id = ?`, [
            nowIso,
            id,
          ]);
        }
      } catch (e: any) {
        logger.warn('[TaskController] PMO notification rules skipped:', e?.message || e);
      }

      // Initiative Progress Recalc
      const initiativeId = updates.initiativeId || currentTask.initiative_id;
      if (initiativeId) {
        const InitiativeService = await import('../services/initiativeService.js').then(
          (m) => m.default || m
        );
        if (InitiativeService && InitiativeService.recalculateProgress) {
          InitiativeService.recalculateProgress({ organizationId: orgId, initiativeId }).catch(
            (err: Error | null) => logger.error('[TaskController] Recalc failed:', err)
          );
        }
      }

      const updatedTask = await DbPromise.get<TaskRow>(`SELECT * FROM tasks WHERE id = ?`, [id]);
      res.json(updatedTask);
    }
  );

  /**
   * Delete task
   */
  /**
   * Delete task
   */
  static deleteTask = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Check permission - only Admin/SuperAdmin or task reporter can delete
      const task = await DbPromise.get<TaskRow>(
        'SELECT reporter_id, initiative_id, title FROM tasks WHERE id = ? AND organization_id = ?',
        [id, orgId]
      );

      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      if (req.user?.role === 'team_member' && task.reporter_id !== userId) {
        res.status(403).json({ error: 'You can only delete tasks you created' });
        return;
      }

      // Delete task comments
      await DbPromise.run('DELETE FROM task_comments WHERE task_id = ?', [id]);

      // Delete task history
      await DbPromise.run('DELETE FROM task_history WHERE task_id = ?', [id]);

      // Delete task
      const result = await DbPromise.run('DELETE FROM tasks WHERE id = ? AND organization_id = ?', [
        id,
        orgId,
      ]);

      if (result.changes === 0) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      // Activity log
      (ActivityService as any)
        .log({
          organizationId: orgId,
          userId: userId,
          action: 'deleted',
          entityType: 'TASK',
          entityId: id,
          entityName: task.title,
        })
        .catch((err: any) => logger.error('[TaskController] Activity log failed:', err));

      // V4-TASK-08: Unified audit log
      auditEventsService
        .log({
          actorId: userId,
          actorType: 'USER',
          action: 'TASK_DELETE',
          resourceType: 'task',
          resourceId: id,
          before: { title: task.title, initiativeId: task.initiative_id },
          metadata: {},
          organizationId: orgId,
        })
        .catch((err: any) => logger.error('[TaskController] Audit log failed:', err?.message));

      // Recalculate Initiative Progress
      if (task.initiative_id) {
        const InitiativeService = await import('../services/initiativeService.js').then(
          (m) => m.default || m
        );
        if (InitiativeService && (InitiativeService as any).recalculateProgress) {
          (InitiativeService as any)
            .recalculateProgress({ organizationId: orgId, initiativeId: task.initiative_id })
            .catch((err: any) => logger.error('[TaskController] Recalc failed:', err));
        }
      }

      res.json({ message: 'Task deleted' });
    }
  );

  /**
   * Get task comments
   */
  static getTaskComments = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { taskId } = req.params;
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify task belongs to org
      const task = await DbPromise.get<{ id: string; title: string }>(
        'SELECT id, title FROM tasks WHERE id = ? AND organization_id = ?',
        [taskId, orgId]
      );

      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      const sql = `
            SELECT c.*, u.first_name, u.last_name, u.avatar_url
            FROM task_comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.task_id = ?
            ORDER BY c.created_at ASC
        `;

      const rows = await DbPromise.all<CommentRow>(sql, [taskId]);

      const comments = rows.map((c) => ({
        id: c.id,
        taskId: c.task_id,
        userId: c.user_id,
        user: {
          id: c.user_id,
          firstName: c.first_name,
          lastName: c.last_name,
          avatarUrl: c.avatar_url,
        },
        content: c.content,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }));

      res.json(comments);
    }
  );

  /**
   * Add comment to task
   */
  static addTaskComment = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const taskId = (req.params as any).taskId || (req.params as any).id;
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const { content } = req.body as AddTaskCommentRequest;
      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!taskId) {
        res.status(400).json({ error: 'taskId is required' });
        return;
      }

      if (!content) {
        res.status(400).json({ error: 'Content is required' });
        return;
      }

      // Verify task belongs to org
      const task = await DbPromise.get<{ id: string; title: string }>(
        'SELECT id, title FROM tasks WHERE id = ? AND organization_id = ?',
        [taskId, orgId]
      );

      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      const sql = `INSERT INTO task_comments (id, task_id, user_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`;

      await DbPromise.run(sql, [id, taskId, userId, content, now, now]);

      logTaskAuditEvent({
        actorId: userId,
        organizationId: orgId,
        action: 'TASK_COMMENT_ADD',
        resourceId: taskId,
        after: { commentId: id, taskId, content },
        metadata: { taskTitle: task.title },
      }).catch((err: any) => logger.error('[TaskController] Audit log failed:', err?.message));

      res.json({
        id,
        taskId,
        userId,
        content,
        createdAt: now,
        updatedAt: now,
      });
    }
  );

  /**
   * Delete task comment
   */
  static deleteTaskComment = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { commentId } = req.params;
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      if (!userId || !orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Check if user owns the comment or is admin
      const comment = await DbPromise.get<{
        user_id: string;
        task_id: string;
        content: string;
        title: string;
      }>(
        `SELECT tc.user_id, tc.task_id, tc.content, t.title
         FROM task_comments tc
         JOIN tasks t ON t.id = tc.task_id
         WHERE tc.id = ? AND t.organization_id = ?`,
        [commentId, orgId]
      );

      if (!comment) {
        res.status(404).json({ error: 'Comment not found' });
        return;
      }

      if (
        req.user?.role !== 'owner' &&
        req.user?.role !== 'administrator' &&
        comment.user_id !== userId
      ) {
        res.status(403).json({ error: 'You can only delete your own comments' });
        return;
      }

      await DbPromise.run('DELETE FROM task_comments WHERE id = ?', [commentId]);

      logTaskAuditEvent({
        actorId: userId,
        organizationId: orgId,
        action: 'TASK_COMMENT_DELETE',
        resourceId: comment.task_id,
        before: { commentId, content: comment.content },
        metadata: { taskTitle: comment.title },
      }).catch((err: any) => logger.error('[TaskController] Audit log failed:', err?.message));

      res.json({ message: 'Comment deleted' });
    }
  );

  /**
   * Assign task (uses TaskAssignmentService - will be migrated later)
   */
  static assignTask = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id: taskId } = req.params;
      const { assigneeId, slaHours } = req.body as AssignTaskRequest;
      const orgId = req.user?.organizationId;
      const actorId = req.user?.id;
      if (!orgId || !actorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const beforeTask = await DbPromise.get<{ assignee_id: string | null; title: string }>(
        'SELECT assignee_id, title FROM tasks WHERE id = ? AND organization_id = ?',
        [taskId, orgId]
      );
      if (!beforeTask) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      const result = await TaskAssignmentService.assignTask(taskId, assigneeId, {
        assignedById: actorId,
        slaHours,
      });

      logTaskAuditEvent({
        actorId,
        organizationId: orgId,
        action: 'TASK_ASSIGN',
        resourceId: taskId,
        before: { assigneeId: beforeTask.assignee_id },
        after: {
          assigneeId: result?.assigneeId || assigneeId,
          slaHours: result?.slaHours || slaHours,
        },
        metadata: { taskTitle: beforeTask.title },
      }).catch((err: any) => logger.error('[TaskController] Audit log failed:', err?.message));

      res.json(result);
    }
  );

  /**
   * Reassign task
   */
  static reassignTask = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id: taskId } = req.params;
      const { toAssigneeId, reason } = req.body as ReassignTaskRequest;
      const orgId = req.user?.organizationId;
      const actorId = req.user?.id;
      if (!orgId || !actorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const beforeTask = await DbPromise.get<{ assignee_id: string | null; title: string }>(
        'SELECT assignee_id, title FROM tasks WHERE id = ? AND organization_id = ?',
        [taskId, orgId]
      );
      if (!beforeTask) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      const result = await TaskAssignmentService.reassignTask(taskId, toAssigneeId, {
        reassignedById: actorId,
        reason,
        resetSla: true,
      });

      logTaskAuditEvent({
        actorId,
        organizationId: orgId,
        action: 'TASK_REASSIGN',
        resourceId: taskId,
        before: { assigneeId: beforeTask.assignee_id },
        after: { assigneeId: result?.assigneeId || toAssigneeId },
        metadata: { reason, taskTitle: beforeTask.title },
      }).catch((err: any) => logger.error('[TaskController] Audit log failed:', err?.message));

      res.json(result);
    }
  );

  /**
   * Unassign task
   */
  static unassignTask = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const orgId = req.user?.organizationId;
      const actorId = req.user?.id;
      if (!orgId || !actorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const beforeTask = await DbPromise.get<{ assignee_id: string | null; title: string }>(
        'SELECT assignee_id, title FROM tasks WHERE id = ? AND organization_id = ?',
        [id, orgId]
      );
      if (!beforeTask) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      const result = await TaskAssignmentService.unassignTask(id);

      logTaskAuditEvent({
        actorId,
        organizationId: orgId,
        action: 'TASK_UNASSIGN',
        resourceId: id,
        before: { assigneeId: beforeTask.assignee_id },
        after: { assigneeId: null },
        metadata: { taskTitle: beforeTask.title },
      }).catch((err: any) => logger.error('[TaskController] Audit log failed:', err?.message));

      res.json(result);
    }
  );

  /**
   * Escalate task
   */
  static escalateTask = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id: taskId } = req.params;
      const { reason } = req.body as EscalateTaskRequest;
      const orgId = req.user?.organizationId;
      const actorId = req.user?.id;
      if (!orgId || !actorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const beforeTask = await DbPromise.get<{ escalation_level: number | null; title: string }>(
        'SELECT escalation_level, title FROM tasks WHERE id = ? AND organization_id = ?',
        [taskId, orgId]
      );
      if (!beforeTask) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      const result = await TaskAssignmentService.escalateTask(taskId, {
        reason: reason || 'Manual escalation',
        triggerType: ESCALATION_TRIGGERS.MANUAL,
        escalatedById: actorId,
      });

      logTaskAuditEvent({
        actorId,
        organizationId: orgId,
        action: 'TASK_ESCALATE',
        resourceId: taskId,
        before: { escalationLevel: beforeTask.escalation_level },
        after: { escalationLevel: result?.escalationLevel },
        metadata: { reason: reason || 'Manual escalation', taskTitle: beforeTask.title },
      }).catch((err: any) => logger.error('[TaskController] Audit log failed:', err?.message));

      res.json(result);
    }
  );

  /**
   * Resolve escalation
   */
  static resolveEscalation = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { escalationId } = req.params;
      const { resolution } = req.body as ResolveEscalationRequest;
      const orgId = req.user?.organizationId;
      const actorId = req.user?.id;
      if (!orgId || !actorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const escalation = await DbPromise.get<{ task_id: string; resolution_note: string | null }>(
        'SELECT task_id, resolution_note FROM task_escalations WHERE id = ?',
        [escalationId]
      );
      if (!escalation) {
        res.status(404).json({ error: 'Escalation not found' });
        return;
      }

      const result = await TaskAssignmentService.resolveEscalation(escalationId, {
        resolutionNote: resolution,
        resolvedById: actorId,
      });

      logTaskAuditEvent({
        actorId,
        organizationId: orgId,
        action: 'TASK_ESCALATION_RESOLVE',
        resourceId: escalation.task_id,
        before: { escalationId, resolution: escalation.resolution_note },
        after: { escalationId, resolution },
        metadata: {},
      }).catch((err: any) => logger.error('[TaskController] Audit log failed:', err?.message));

      res.json(result);
    }
  );

  /**
   * Get task escalations
   */
  static getTaskEscalations = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;

      const escalations = await TaskAssignmentService.getTaskEscalationHistory(id);

      res.json(escalations);
    }
  );

  /**
   * Get overdue tasks
   */
  static getOverdueTasks = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { projectId, escalationLevel, limit } = req.query;

      if (!projectId || typeof projectId !== 'string') {
        res.status(400).json({ error: 'projectId is required' });
        return;
      }

      const tasks = await TaskAssignmentService.getOverdueTasks(projectId, {
        escalationLevel: escalationLevel ? parseInt(String(escalationLevel)) : undefined,
        limit: limit ? parseInt(String(limit)) : undefined,
      });

      res.json(tasks);
    }
  );

  /**
   * Get tasks at risk
   */
  static getTasksAtRisk = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { projectId, hoursAhead } = req.query;

      if (!projectId || typeof projectId !== 'string') {
        res.status(400).json({ error: 'projectId is required' });
        return;
      }

      const tasks = await TaskAssignmentService.getTasksApproachingSLA(
        projectId,
        hoursAhead ? parseInt(String(hoursAhead)) : 4
      );

      res.json(tasks);
    }
  );

  /**
   * Get user workload
   */
  static getUserWorkload = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { userId } = req.params;
      const { projectId } = req.query;

      const workload = await TaskAssignmentService.getUserWorkload(userId, {
        projectId: projectId as string | undefined,
      });

      res.json(workload);
    }
  );

  /**
   * Get my workload (current user)
   */
  static getMyWorkload = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user?.id;
      const { projectId } = req.query;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const workload = await TaskAssignmentService.getUserWorkload(userId, {
        projectId: projectId as string | undefined,
      });

      res.json(workload);
    }
  );

  // ==========================================
  // FLOW-TASK-001: DECISION INTEGRATION
  // ==========================================

  /**
   * Block task (manual or by decision)
   */
  static blockTask = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const taskId = req.params.id;
      const { reason, decisionId } = req.body as BlockTaskRequest;

      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!reason) {
        res.status(400).json({ error: 'Block reason is required' });
        return;
      }

      const now = new Date().toISOString();
      const task = await DbPromise.get<{
        status: string;
        blocked_reason: string | null;
        title: string;
      }>('SELECT status, blocked_reason, title FROM tasks WHERE id = ? AND organization_id = ?', [
        taskId,
        orgId,
      ]);
      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      const validation = validateTaskStatusTransition(task.status, 'blocked');
      if (!validation.allowed && 'rule' in validation && 'message' in validation) {
        res.status(400).json({
          error: validation.message,
          code: validation.rule,
          ...buildTransitionErrorPayload(task.status, 'blocked'),
        });
        return;
      }

      await DbPromise.run(
        `UPDATE tasks SET 
                status = 'blocked',
                blocked_at = ?,
                blocked_reason = ?,
                blocked_by_decision_id = ?,
                updated_at = ?
             WHERE id = ?`,
        [now, reason, decisionId || null, now, taskId]
      );

      logTaskAuditEvent({
        actorId: userId,
        organizationId: orgId,
        action: 'TASK_BLOCK',
        resourceId: taskId,
        before: { status: task.status, blockedReason: task.blocked_reason },
        after: {
          status: 'blocked',
          blockedReason: reason,
          blockedByDecisionId: decisionId || null,
        },
        metadata: { taskTitle: task.title },
      }).catch((err: any) => logger.error('[TaskController] Audit log failed:', err?.message));

      res.json({
        success: true,
        message: 'Task blocked',
        taskId,
        blockedByDecision: decisionId || null,
      });
    }
  );

  /**
   * Unblock task
   */
  static unblockTask = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const taskId = req.params.id;
      const { newStatus } = req.body as UnblockTaskRequest;

      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const now = new Date().toISOString();
      const task = await DbPromise.get<{
        status: string;
        blocked_reason: string | null;
        title: string;
      }>('SELECT status, blocked_reason, title FROM tasks WHERE id = ? AND organization_id = ?', [
        taskId,
        orgId,
      ]);
      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      if (String(task.status || '').toLowerCase() !== 'blocked') {
        res.status(409).json({
          error: 'Only blocked tasks can be unblocked',
          code: 'TASK_NOT_BLOCKED',
          currentStatus: task.status,
        });
        return;
      }

      const targetStatus = newStatus || 'in_progress';
      const validation = validateTaskStatusTransition(task.status, targetStatus);
      if (!validation.allowed && 'rule' in validation && 'message' in validation) {
        res.status(400).json({
          error: validation.message,
          code: validation.rule,
          ...buildTransitionErrorPayload(task.status, targetStatus),
        });
        return;
      }

      await DbPromise.run(
        `UPDATE tasks SET 
                status = ?,
                blocked_at = NULL,
                blocked_reason = NULL,
                blocked_by_decision_id = NULL,
                updated_at = ?
             WHERE id = ?`,
        [targetStatus, now, taskId]
      );

      logTaskAuditEvent({
        actorId: userId,
        organizationId: orgId,
        action: 'TASK_UNBLOCK',
        resourceId: taskId,
        before: { status: task.status, blockedReason: task.blocked_reason },
        after: { status: targetStatus, blockedReason: null },
        metadata: { taskTitle: task.title },
      }).catch((err: any) => logger.error('[TaskController] Audit log failed:', err?.message));

      res.json({
        success: true,
        message: 'Task unblocked',
        taskId,
        newStatus: targetStatus,
      });
    }
  );

  /**
   * Move task to different initiative
   */
  static moveTask = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const taskId = req.params.id;
      const { targetInitiativeId } = req.body;

      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!targetInitiativeId) {
        res.status(400).json({ error: 'targetInitiativeId is required' });
        return;
      }

      // Get target initiative and its project
      const targetInitiative = await DbPromise.get<{ id: string; project_id: string }>(
        'SELECT id, project_id FROM initiatives WHERE id = ? AND organization_id = ?',
        [targetInitiativeId, orgId]
      );

      if (!targetInitiative) {
        res.status(404).json({ error: 'Target initiative not found' });
        return;
      }

      // Get current task info
      const task = await DbPromise.get<{
        initiative_id: string;
        project_id: string;
        title: string;
      }>(
        'SELECT initiative_id, project_id, title FROM tasks WHERE id = ? AND organization_id = ?',
        [taskId, orgId]
      );

      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      const now = new Date().toISOString();

      // Move task
      await DbPromise.run(
        `UPDATE tasks SET 
                initiative_id = ?,
                project_id = ?,
                updated_at = ?
             WHERE id = ?`,
        [targetInitiativeId, targetInitiative.project_id, now, taskId]
      );

      // Log history
      await DbPromise.run(
        `INSERT INTO task_history (id, task_id, field, old_value, new_value, changed_by)
             VALUES (?, ?, 'moved', ?, ?, ?)`,
        [
          uuidv4(),
          taskId,
          JSON.stringify({ initiative_id: task.initiative_id, project_id: task.project_id }),
          JSON.stringify({
            initiative_id: targetInitiativeId,
            project_id: targetInitiative.project_id,
          }),
          userId,
        ]
      );

      logTaskAuditEvent({
        actorId: userId,
        organizationId: orgId,
        action: 'TASK_MOVE',
        resourceId: taskId,
        before: { initiativeId: task.initiative_id, projectId: task.project_id },
        after: { initiativeId: targetInitiativeId, projectId: targetInitiative.project_id },
        metadata: { taskTitle: task.title },
      }).catch((err: any) => logger.error('[TaskController] Audit log failed:', err?.message));

      res.json({
        success: true,
        message: 'Task moved successfully',
        taskId,
        fromInitiativeId: task.initiative_id,
        toInitiativeId: targetInitiativeId,
        toProjectId: targetInitiative.project_id,
      });
    }
  );

  /**
   * Get blocking decision details
   */
  static getBlockingDecision = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const taskId = req.params.id;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Get task with blocking decision info
      const task = await DbPromise.get<{
        blocked_by_decision_id: string | null;
        blocked_at: string | null;
        blocked_reason: string | null;
      }>('SELECT blocked_by_decision_id, blocked_at, blocked_reason FROM tasks WHERE id = ?', [
        taskId,
      ]);

      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      if (!task.blocked_by_decision_id) {
        res.json({
          success: true,
          isBlocked: false,
          decision: null,
        });
        return;
      }

      // Get decision details
      const decision = await DbPromise.get<{
        id: string;
        title: string;
        status: string;
        deadline: string;
        decision_maker_id: string;
      }>('SELECT id, title, status, deadline, decision_maker_id FROM decisions WHERE id = ?', [
        task.blocked_by_decision_id,
      ]);

      res.json({
        success: true,
        isBlocked: true,
        blockedAt: task.blocked_at,
        blockedReason: task.blocked_reason,
        decision: decision || null,
      });
    }
  );

  // ==========================================
  // TASK DEPENDENCIES (Gantt-style)
  // ==========================================

  /**
   * GET /api/tasks/:id/dependencies
   * Get all dependencies for a task (both directions)
   */
  static getTaskDependencies = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const taskId = req.params.id;
      const schema = await getTaskDepsSchema();

      // DB stores dependency_type as 'finish_to_start' etc. — map to short form FS/SS/FF/SF
      const dbToShort: Record<string, string> = {
        finish_to_start: 'FS',
        start_to_start: 'SS',
        finish_to_finish: 'FF',
        start_to_finish: 'SF',
        FS: 'FS',
        SS: 'SS',
        FF: 'FF',
        SF: 'SF', // accept both
      };

      const outgoing =
        schema.fromCol === 'predecessor_id'
          ? await DbPromise.all<{
              id: string;
              predecessor_id: string;
              successor_id: string;
              dependency_type: string;
              lag_days: number;
              notes: string;
              created_at: string;
              created_by: string;
              task_title: string;
              task_status: string;
              task_priority: string;
              task_index_code: string;
            }>(
              `SELECT td.id, td.predecessor_id, td.successor_id,
                      CASE
                        WHEN td.dependency_type IS NULL OR TRIM(CAST(td.dependency_type AS TEXT)) = '' THEN 'finish_to_start'
                        ELSE LOWER(TRIM(CAST(td.dependency_type AS TEXT)))
                      END as dependency_type,
                      CASE
                        WHEN td.lag_days IS NULL OR TRIM(CAST(td.lag_days AS TEXT)) = '' THEN 0
                        ELSE CAST(td.lag_days AS INTEGER)
                      END as lag_days,
                      td.notes, td.created_at, td.created_by,
                      t.title as task_title, t.status as task_status,
                      t.priority as task_priority, t.id as task_index_code
               FROM task_dependencies td
               JOIN tasks t ON t.id = td.successor_id
               WHERE td.predecessor_id = ? AND t.organization_id = ?
               ORDER BY td.created_at DESC`,
              [taskId, orgId]
            )
          : await DbPromise.all<{
              id: string;
              from_task_id: string;
              to_task_id: string;
              dependency_type: string;
              lag_days: number;
              notes: string;
              created_at: string;
              created_by: string;
              task_title: string;
              task_status: string;
              task_priority: string;
              task_index_code: string;
            }>(
              `SELECT td.id, td.from_task_id, td.to_task_id,
                      CASE
                        WHEN td.dependency_type IS NULL OR TRIM(CAST(td.dependency_type AS TEXT)) = '' THEN 'finish_to_start'
                        ELSE LOWER(TRIM(CAST(td.dependency_type AS TEXT)))
                      END as dependency_type,
                      CASE
                        WHEN td.lag_days IS NULL OR TRIM(CAST(td.lag_days AS TEXT)) = '' THEN 0
                        ELSE CAST(td.lag_days AS INTEGER)
                      END as lag_days,
                      td.notes, td.created_at, td.created_by,
                      t.title as task_title, t.status as task_status,
                      t.priority as task_priority, t.id as task_index_code
               FROM task_dependencies td
               JOIN tasks t ON t.id = td.to_task_id
               WHERE td.from_task_id = ? AND t.organization_id = ?
               ORDER BY td.created_at DESC`,
              [taskId, orgId]
            );

      const incoming =
        schema.fromCol === 'predecessor_id'
          ? await DbPromise.all<{
              id: string;
              predecessor_id: string;
              successor_id: string;
              dependency_type: string;
              lag_days: number;
              notes: string;
              created_at: string;
              created_by: string;
              task_title: string;
              task_status: string;
              task_priority: string;
              task_index_code: string;
            }>(
              `SELECT td.id, td.predecessor_id, td.successor_id,
                      CASE
                        WHEN td.dependency_type IS NULL OR TRIM(CAST(td.dependency_type AS TEXT)) = '' THEN 'finish_to_start'
                        ELSE LOWER(TRIM(CAST(td.dependency_type AS TEXT)))
                      END as dependency_type,
                      CASE
                        WHEN td.lag_days IS NULL OR TRIM(CAST(td.lag_days AS TEXT)) = '' THEN 0
                        ELSE CAST(td.lag_days AS INTEGER)
                      END as lag_days,
                      td.notes, td.created_at, td.created_by,
                      t.title as task_title, t.status as task_status,
                      t.priority as task_priority, t.id as task_index_code
               FROM task_dependencies td
               JOIN tasks t ON t.id = td.predecessor_id
               WHERE td.successor_id = ? AND t.organization_id = ?
               ORDER BY td.created_at DESC`,
              [taskId, orgId]
            )
          : await DbPromise.all<{
              id: string;
              from_task_id: string;
              to_task_id: string;
              dependency_type: string;
              lag_days: number;
              notes: string;
              created_at: string;
              created_by: string;
              task_title: string;
              task_status: string;
              task_priority: string;
              task_index_code: string;
            }>(
              `SELECT td.id, td.from_task_id, td.to_task_id,
                      CASE
                        WHEN td.dependency_type IS NULL OR TRIM(CAST(td.dependency_type AS TEXT)) = '' THEN 'finish_to_start'
                        ELSE LOWER(TRIM(CAST(td.dependency_type AS TEXT)))
                      END as dependency_type,
                      CASE
                        WHEN td.lag_days IS NULL OR TRIM(CAST(td.lag_days AS TEXT)) = '' THEN 0
                        ELSE CAST(td.lag_days AS INTEGER)
                      END as lag_days,
                      td.notes, td.created_at, td.created_by,
                      t.title as task_title, t.status as task_status,
                      t.priority as task_priority, t.id as task_index_code
               FROM task_dependencies td
               JOIN tasks t ON t.id = td.from_task_id
               WHERE td.to_task_id = ? AND t.organization_id = ?
               ORDER BY td.created_at DESC`,
              [taskId, orgId]
            );

      res.json({
        success: true,
        successors: outgoing.map((d) => ({
          id: d.id,
          taskId:
            schema.fromCol === 'predecessor_id' ? (d as any).successor_id : (d as any).to_task_id,
          taskTitle: d.task_title,
          taskStatus: d.task_status,
          taskPriority: d.task_priority,
          taskIndexCode: d.task_index_code,
          dependencyType: dbToShort[d.dependency_type] || 'FS',
          lagDays: d.lag_days,
          notes: d.notes,
          createdAt: d.created_at,
        })),
        predecessors: incoming.map((d) => ({
          id: d.id,
          taskId:
            schema.fromCol === 'predecessor_id'
              ? (d as any).predecessor_id
              : (d as any).from_task_id,
          taskTitle: d.task_title,
          taskStatus: d.task_status,
          taskPriority: d.task_priority,
          taskIndexCode: d.task_index_code,
          dependencyType: dbToShort[d.dependency_type] || 'FS',
          lagDays: d.lag_days,
          notes: d.notes,
          createdAt: d.created_at,
        })),
      });
    }
  );

  /**
   * POST /api/tasks/:id/dependencies
   * Add a dependency link between two tasks
   */
  static addTaskDependency = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const taskId = req.params.id;
      const { targetTaskId, direction, dependencyType, lagDays, notes } = req.body as {
        targetTaskId: string;
        direction: 'successor' | 'predecessor';
        dependencyType?: string;
        lagDays?: number;
        notes?: string;
      };
      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!targetTaskId) {
        res.status(400).json({ error: 'targetTaskId is required' });
        return;
      }

      if (targetTaskId === taskId) {
        res.status(400).json({ error: 'A task cannot depend on itself' });
        return;
      }

      // Verify both tasks exist and belong to the same org
      const sourceTask = await DbPromise.get<{ id: string }>(
        'SELECT id FROM tasks WHERE id = ? AND organization_id = ?',
        [taskId, orgId]
      );
      const targetTask = await DbPromise.get<{ id: string; title: string; status: string }>(
        'SELECT id, title, status FROM tasks WHERE id = ? AND organization_id = ?',
        [targetTaskId, orgId]
      );

      if (!sourceTask) {
        res.status(404).json({ error: 'Source task not found' });
        return;
      }
      if (!targetTask) {
        res.status(404).json({ error: 'Target task not found' });
        return;
      }

      // Map short form (FS/SS/FF/SF) to DB values
      const shortToDb: Record<string, string> = {
        FS: 'finish_to_start',
        SS: 'start_to_start',
        FF: 'finish_to_finish',
        SF: 'start_to_finish',
        finish_to_start: 'finish_to_start',
        start_to_start: 'start_to_start',
        finish_to_finish: 'finish_to_finish',
        start_to_finish: 'start_to_finish',
      };

      // Determine predecessor/successor based on direction
      // "predecessor" means: targetTask is a predecessor of current task
      //   → predecessor_id = targetTaskId, successor_id = taskId
      // "successor" means: targetTask is a successor of current task
      //   → predecessor_id = taskId, successor_id = targetTaskId
      const predecessorId = direction === 'predecessor' ? targetTaskId : taskId;
      const successorId = direction === 'predecessor' ? taskId : targetTaskId;
      const schema = await getTaskDepsSchema();

      // Check for duplicate
      const existing = await DbPromise.get<{ id: string }>(
        schema.fromCol === 'predecessor_id'
          ? 'SELECT id FROM task_dependencies WHERE predecessor_id = ? AND successor_id = ?'
          : 'SELECT id FROM task_dependencies WHERE from_task_id = ? AND to_task_id = ?',
        [predecessorId, successorId]
      );
      if (existing) {
        res.status(409).json({ error: 'This dependency already exists' });
        return;
      }

      // Simple cycle detection: check if creating this link would form a cycle
      // by checking if successorId can reach predecessorId through existing dependencies
      const visited = new Set<string>();
      const queue = [successorId];
      let hasCycle = false;

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current === predecessorId) {
          hasCycle = true;
          break;
        }
        if (visited.has(current)) continue;
        visited.add(current);

        const nextDeps = await DbPromise.all<{ next_id: string }>(
          schema.fromCol === 'predecessor_id'
            ? 'SELECT successor_id as next_id FROM task_dependencies WHERE predecessor_id = ?'
            : 'SELECT to_task_id as next_id FROM task_dependencies WHERE from_task_id = ?',
          [current]
        );
        for (const nd of nextDeps) {
          if (!visited.has(nd.next_id)) {
            queue.push(nd.next_id);
          }
        }
      }

      if (hasCycle) {
        res.status(400).json({
          error: 'Adding this dependency would create a circular reference',
          code: 'CIRCULAR_DEPENDENCY',
        });
        return;
      }

      const depId = uuidv4();
      const depType = shortToDb[dependencyType || 'FS'] || 'finish_to_start';
      const lag = lagDays || 0;

      if (schema.fromCol === 'predecessor_id') {
        await DbPromise.run(
          `INSERT INTO task_dependencies (id, predecessor_id, successor_id, dependency_type, lag_days, notes, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [depId, predecessorId, successorId, depType, lag, notes || null, userId || null]
        );
      } else {
        await DbPromise.run(
          `INSERT INTO task_dependencies (id, from_task_id, to_task_id, dependency_type, lag_days, notes, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [depId, predecessorId, successorId, depType, lag, notes || null, userId || null]
        );
      }

      // Log activity
      try {
        await ActivityService.logActivity({
          organizationId: orgId,
          entityType: 'task',
          entityId: taskId,
          action: 'dependency_added',
          userId,
          details: {
            targetTaskId,
            targetTaskTitle: targetTask.title,
            direction,
            dependencyType: depType,
          },
        });
      } catch {
        // best-effort
      }

      // Map back to short form for the response
      const dbToShort: Record<string, string> = {
        finish_to_start: 'FS',
        start_to_start: 'SS',
        finish_to_finish: 'FF',
        start_to_finish: 'SF',
      };

      logTaskAuditEvent({
        actorId: userId,
        organizationId: orgId,
        action: 'TASK_DEPENDENCY_ADD',
        resourceId: taskId,
        after: {
          dependencyId: depId,
          predecessorId,
          successorId,
          dependencyType: depType,
          lagDays: lag,
        },
        metadata: { targetTaskId, direction },
      }).catch((err: any) => logger.error('[TaskController] Audit log failed:', err?.message));

      res.status(201).json({
        success: true,
        dependency: {
          id: depId,
          predecessorId,
          successorId,
          taskId: targetTaskId,
          taskTitle: targetTask.title,
          taskStatus: targetTask.status,
          dependencyType: dbToShort[depType] || dependencyType || 'FS',
          lagDays: lag,
          notes: notes || null,
          direction,
        },
      });
    }
  );

  /**
   * DELETE /api/tasks/:id/dependencies/:depId
   * Remove a dependency
   */
  static removeTaskDependency = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const taskId = req.params.id;
      const depId = req.params.depId;
      const schema = await getTaskDepsSchema();
      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify the dependency exists and involves this task
      const dep = await DbPromise.get<{
        id: string;
        predecessor_id?: string;
        successor_id?: string;
        from_task_id?: string;
        to_task_id?: string;
      }>(
        schema.fromCol === 'predecessor_id'
          ? `SELECT td.id, td.predecessor_id, td.successor_id
             FROM task_dependencies td
             JOIN tasks t1 ON t1.id = td.predecessor_id AND t1.organization_id = ?
             WHERE td.id = ? AND (td.predecessor_id = ? OR td.successor_id = ?)`
          : `SELECT td.id, td.from_task_id, td.to_task_id
             FROM task_dependencies td
             JOIN tasks t1 ON t1.id = td.from_task_id AND t1.organization_id = ?
             WHERE td.id = ? AND (td.from_task_id = ? OR td.to_task_id = ?)`,
        [orgId, depId, taskId, taskId]
      );

      if (!dep) {
        res.status(404).json({ error: 'Dependency not found' });
        return;
      }

      await DbPromise.run('DELETE FROM task_dependencies WHERE id = ?', [depId]);

      logTaskAuditEvent({
        actorId: userId,
        organizationId: orgId,
        action: 'TASK_DEPENDENCY_REMOVE',
        resourceId: taskId,
        before: {
          dependencyId: depId,
          predecessorId:
            schema.fromCol === 'predecessor_id' ? dep.predecessor_id : dep.from_task_id,
          successorId: schema.fromCol === 'predecessor_id' ? dep.successor_id : dep.to_task_id,
        },
        metadata: {},
      }).catch((err: any) => logger.error('[TaskController] Audit log failed:', err?.message));

      // Log activity
      try {
        await ActivityService.logActivity({
          organizationId: orgId,
          entityType: 'task',
          entityId: taskId,
          action: 'dependency_removed',
          userId,
          details: { dependencyId: depId },
        });
      } catch {
        // best-effort
      }

      res.json({ success: true });
    }
  );

  /**
   * GET /api/tasks/search
   * Search tasks by title for dependency linking
   */
  static searchTasks = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const query = String(req.query.q || '').trim();
      const excludeId = String(req.query.exclude || '');

      if (!query) {
        res.json({ tasks: [] });
        return;
      }

      // ── Smart query parsing ────────────────────────────────
      // If the user pastes an internal URL like:
      //   http://localhost:3000/my-work?artifact=task%3Atask-rich-006
      //   http://localhost:3000/my-work?artifact=task:task-rich-006
      // Extract the task ID from it.
      let extractedId: string | null = null;
      try {
        if (
          query.startsWith('http://') ||
          query.startsWith('https://') ||
          query.startsWith('localhost')
        ) {
          const url = new URL(query.startsWith('localhost') ? `http://${query}` : query);
          const artifact = url.searchParams.get('artifact');
          if (artifact) {
            // artifact format: "task:task-rich-001" or "task%3Atask-rich-001"
            const decoded = decodeURIComponent(artifact);
            const match = decoded.match(/^task:(.+)$/);
            if (match) {
              extractedId = match[1];
            }
          }
        }
      } catch {
        // Not a valid URL, treat as normal search
      }

      // Also detect if the query itself looks like a task ID (e.g. "task-rich-006")
      if (!extractedId && /^task-/i.test(query)) {
        extractedId = query;
      }

      const effectiveQuery = extractedId || query;
      const effectiveLike = `%${effectiveQuery}%`;

      // If we extracted an ID, search by ID first, then also by title as fallback
      const tasks = await DbPromise.all<{
        id: string;
        title: string;
        status: string;
        priority: string;
        initiative_name: string | null;
      }>(
        `SELECT t.id, t.title, t.status, t.priority,
                i.name as initiative_name
         FROM tasks t
         LEFT JOIN initiatives i ON i.id = t.initiative_id
         WHERE t.organization_id = ?
           AND (? = '' OR CAST(t.id AS TEXT) <> ?)
           AND (
             lower(CAST(t.title AS TEXT)) LIKE lower(?)
             OR CAST(t.id AS TEXT) = ?
             OR CAST(t.id AS TEXT) LIKE ?
           )
         ORDER BY
           CASE WHEN CAST(t.id AS TEXT) = ? THEN 0 ELSE 1 END,
           t.updated_at DESC
         LIMIT 20`,
        [orgId, excludeId, excludeId, effectiveLike, effectiveQuery, effectiveLike, effectiveQuery]
      );

      res.json({
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          initiativeName: t.initiative_name,
        })),
      });
    }
  );

  /**
   * POST /api/tasks/:id/sections/:sectionKey/generate
   * Wzorzec N — AI generacja treści jednej karty-sekcji Task.
   *
   * Prompty = STAŁE w kodzie (taskSectionGenerationService.TASK_SECTION_PROMPTS),
   * bo NIE MA tabeli task_section_types z ai_prompt_template. Doktryna BCG §0 w
   * system-promptcie, instrukcja karty §3 w user-promptcie.
   *
   * ⚠ Prompty zmieniają output klienta → weryfikacja Piotra przed live.
   */
  static generateSection = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id, sectionKey } = req.params;
      const allowed = ['strategy', 'execution', 'evidence', 'dependencies'];
      if (!allowed.includes(String(sectionKey))) {
        res.status(400).json({ error: 'Unsupported section', sectionKey });
        return;
      }

      // Language: body override → Accept-Language → en
      const bodyLang = String((req.body && (req.body as any).language) || '').toLowerCase();
      const acceptLang = req.headers['accept-language'] || 'en';
      const headerLang = String(acceptLang).split(',')[0].split('-')[0].toLowerCase();
      const language = bodyLang === 'pl' || bodyLang === 'en' ? bodyLang : headerLang || 'en';

      const task = await DbPromise.get<TaskRow>(
        `SELECT t.*, i.name as initiative_name, i.description as initiative_description
         FROM tasks t
         LEFT JOIN initiatives i ON i.id = t.initiative_id
         WHERE t.id = ? AND t.organization_id = ?`,
        [id, orgId]
      );
      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      try {
        const { generateTaskSection } = await import('../services/taskSectionGenerationService.js');
        const result = await generateTaskSection(
          sectionKey as any,
          {
            title: getMultilingualText((task as any).title, language),
            description: getMultilingualText((task as any).description, language),
            why: (task as any).why || null,
            expectedOutcome: (task as any).expected_outcome || null,
            taskType: (task as any).task_type || null,
            priority: (task as any).priority || null,
            status: (task as any).status || null,
            initiativeName: getMultilingualText((task as any).initiative_name, language),
            initiativeContext: getMultilingualText((task as any).initiative_description, language),
          },
          { language }
        );

        res.json({
          sectionKey,
          content: result.parsedContent ?? result.content,
          raw: result.content,
          isJson: result.isJson,
          model: result.model,
          tokensUsed: result.tokensUsed,
          // Advisory-only (BCG §0 heuristics) — UI may show a soft warning; never blocks.
          qualityFlags: (result as { qualityFlags?: unknown }).qualityFlags,
        });
      } catch (err: any) {
        const message = String(err?.message || 'AI generation failed');
        logger.warn('[TaskController] generateSection failed', {
          taskId: id,
          sectionKey,
          error: message,
        });
        // Uczciwy błąd — front mapuje na stan karty 'error' + retry.
        res.status(502).json({ error: 'AI_GENERATION_FAILED', message });
      }
    }
  );
}

export default TaskController;
