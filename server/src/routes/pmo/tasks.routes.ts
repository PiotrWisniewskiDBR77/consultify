/**
 * Tasks Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * All task-related API endpoints with Zod validation
 */

import type { Response } from 'express';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import TaskControllerRaw from '../../controllers/TaskController.js';
const TaskController = TaskControllerRaw as any;
import { verifyToken } from '../../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../../middleware/demoGuard.middleware.js';
import { requireCanonicalExecutionWriter } from '../../middleware/executionSpineLegacyReadOnly.middleware.js';
import { requireTaskCapability } from '../../middleware/effectiveCapability.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { requireOrgAccess } from '../../middleware/rbac.middleware.js';
import { requireAudit } from '../../middleware/requireAudit.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import type { CriticalPathTask } from '../../services/criticalPathService.js';
import { calculateCriticalPath } from '../../services/criticalPathService.js';
import { computeCanonicalExecutionHealth } from '../../services/execution/canonicalExecutionHealthService.js';
import {
  type CustomFieldDefinition,
  CustomFieldDefinitionSchema,
  UpdateCustomFieldSchema,
  validateCustomFieldValues,
} from '../../services/customFieldsService.js';
import {
  getCapacityOverview,
  getOverloadAlerts,
  getUserForecast,
} from '../../services/workloadCapacityService.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import DbPromise from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import {
  AddTaskCommentSchema,
  AssignTaskSchema,
  BlockTaskSchema,
  CreateTaskSchema,
  EscalateTaskSchema,
  ReassignTaskSchema,
  ResolveEscalationSchema,
  UnblockTaskSchema,
  UpdateTaskSchema,
} from '../../validators/task.validators.js';

const router = Router();

// Apply rate limiting
router.use(apiAuthRateLimiter);

// Apply auth middleware to all routes
router.use(verifyToken);
router.use(requireOrgAccess());

// Apply demo context middleware (switches org to demo org if x-demo-mode header is set)
router.use(demoContextMiddleware);
// AMD-EXE-SPINE-AUTHORITY-004: retain the legacy PMO task read model during
// cutover, but route every mutation through the receipt-backed Runtime-v1
// writer. This runs after auth and tenant resolution to avoid leaking route
// availability to an unauthenticated or foreign principal.
router.use(requireCanonicalExecutionWriter);

// ==========================================
// TASK CRUD
// ==========================================

/**
 * GET /api/tasks
 * Get all tasks with filters
 */
router.get(
  '/',
  (req, res, next) => {
    logger.info('[TasksRoute] GET / matched');
    next();
  },
  TaskController.getTasks
);

/**
 * POST /api/tasks
 * Create a new task
 */
router.post(
  '/',
  requireAudit,
  requireTaskCapability('task.create', { shadow: true }),
  validateBody(CreateTaskSchema),
  TaskController.createTask
);

/**
 * GET /api/tasks/search
 * Search tasks by title (for dependency linking)
 * NOTE: Must be before /:id to avoid Express matching "search" as an id
 */
router.get('/search', TaskController.searchTasks);

/**
 * GET /api/tasks/rollups
 * V4-TASK-01: Hierarchy rollups by initiative/list/program
 */
router.get('/rollups', TaskController.getTaskHierarchyRollups);

/**
 * GET /api/tasks/workflow-config
 * V4-TASK-03: Canonical workflow statuses + transitions
 */
router.get('/workflow-config', TaskController.getWorkflowConfig);

/**
 * POST /api/tasks/:id/sections/:sectionKey/generate
 * Wzorzec N — AI generacja treści karty-sekcji Task (strategy|execution|evidence|dependencies).
 * ⚠ Prompty w kodzie (taskSectionGenerationService) — weryfikacja Piotra przed live.
 */
router.post('/:id/sections/:sectionKey/generate', TaskController.generateSection);

// ==========================================
// V4-TASK-02: CUSTOM FIELD SCHEMA CRUD
// (before /:id to avoid Express matching "custom-fields" as an id)
// ==========================================

router.get(
  '/custom-fields',
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const entityType = String(req.query.entityType || 'task').toLowerCase();

    const rows = await DbPromise.all<Record<string, unknown>>(
      `SELECT * FROM task_custom_field_schemas
       WHERE organization_id = ? AND entity_type = ?
       ORDER BY COALESCE(sort_order, 0) ASC, created_at ASC`,
      [orgId, entityType]
    );

    res.json(
      rows.map((r: any) => ({
        id: r.id,
        fieldKey: r.field_key,
        label: r.label || r.field_key,
        fieldType: r.field_type,
        entityType: r.entity_type,
        required: Boolean(r.required),
        options: r.options_json ? JSON.parse(r.options_json) : undefined,
        defaultValue: r.default_value_json ? JSON.parse(r.default_value_json) : undefined,
        validation: r.validation_json ? JSON.parse(r.validation_json) : undefined,
        isActive: r.is_active !== undefined ? Boolean(r.is_active) : true,
        sortOrder: r.sort_order ?? 0,
        createdAt: r.created_at,
      }))
    );
  })
);

router.post(
  '/custom-fields',
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const parsed = CustomFieldDefinitionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }
    const def = parsed.data;

    const existing = await DbPromise.get<{ id: string }>(
      `SELECT id FROM task_custom_field_schemas WHERE organization_id = ? AND entity_type = ? AND field_key = ?`,
      [orgId, def.entityType, def.fieldKey]
    );
    if (existing) {
      res.status(409).json({
        error: `Field key "${def.fieldKey}" already exists for entity type "${def.entityType}"`,
      });
      return;
    }

    const id = uuidv4();
    await DbPromise.run(
      `INSERT INTO task_custom_field_schemas (id, organization_id, entity_type, field_key, field_type, label, required, options_json, default_value_json, validation_json, is_active, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        id,
        orgId,
        def.entityType,
        def.fieldKey,
        def.fieldType,
        def.label,
        def.required ? 1 : 0,
        def.options ? JSON.stringify(def.options) : null,
        def.defaultValue !== undefined ? JSON.stringify(def.defaultValue) : null,
        def.validation ? JSON.stringify(def.validation) : null,
        def.isActive ? 1 : 0,
        def.sortOrder,
      ]
    );

    res.status(201).json({ id, ...def });
  })
);

router.put(
  '/custom-fields/:fieldId',
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { fieldId } = req.params;
    const parsed = UpdateCustomFieldSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const existing = await DbPromise.get<Record<string, unknown>>(
      `SELECT * FROM task_custom_field_schemas WHERE id = ? AND organization_id = ?`,
      [fieldId, orgId]
    );
    if (!existing) {
      res.status(404).json({ error: 'Custom field not found' });
      return;
    }

    const upd = parsed.data;
    const sets: string[] = [];
    const params: unknown[] = [];

    if (upd.label !== undefined) {
      sets.push('label = ?');
      params.push(upd.label);
    }
    if (upd.required !== undefined) {
      sets.push('required = ?');
      params.push(upd.required ? 1 : 0);
    }
    if (upd.options !== undefined) {
      sets.push('options_json = ?');
      params.push(JSON.stringify(upd.options));
    }
    if (upd.defaultValue !== undefined) {
      sets.push('default_value_json = ?');
      params.push(JSON.stringify(upd.defaultValue));
    }
    if (upd.validation !== undefined) {
      sets.push('validation_json = ?');
      params.push(JSON.stringify(upd.validation));
    }
    if (upd.isActive !== undefined) {
      sets.push('is_active = ?');
      params.push(upd.isActive ? 1 : 0);
    }
    if (upd.sortOrder !== undefined) {
      sets.push('sort_order = ?');
      params.push(upd.sortOrder);
    }

    if (sets.length === 0) {
      res.json({ id: fieldId, message: 'No changes' });
      return;
    }

    params.push(fieldId, orgId);
    await DbPromise.run(
      `UPDATE task_custom_field_schemas SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`,
      params
    );

    res.json({ id: fieldId, message: 'Updated' });
  })
);

router.delete(
  '/custom-fields/:fieldId',
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { fieldId } = req.params;
    const existing = await DbPromise.get<{ id: string }>(
      `SELECT id FROM task_custom_field_schemas WHERE id = ? AND organization_id = ?`,
      [fieldId, orgId]
    );
    if (!existing) {
      res.status(404).json({ error: 'Custom field not found' });
      return;
    }

    await DbPromise.run(
      `UPDATE task_custom_field_schemas SET is_active = 0 WHERE id = ? AND organization_id = ?`,
      [fieldId, orgId]
    );

    res.json({ id: fieldId, message: 'Deactivated' });
  })
);

// ==========================================
// V4-TASK-04: BASELINE SNAPSHOTS
// ==========================================

router.post(
  '/baseline-snapshots',
  requireAudit,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      initiativeId,
      projectId,
      snapshotType = 'manual',
    } = req.body as {
      initiativeId?: string;
      projectId?: string;
      snapshotType?: 'manual' | 'auto';
    };

    if (!initiativeId && !projectId) {
      res.status(400).json({ error: 'initiativeId or projectId is required' });
      return;
    }

    const filterCol = initiativeId ? 'initiative_id' : 'project_id';
    const filterVal = initiativeId || projectId;

    const tasks = await DbPromise.all<Record<string, unknown>>(
      `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.started_at,
              t.estimated_hours, t.progress, t.assignee_id, t.initiative_id, t.project_id
       FROM tasks t
       WHERE t.organization_id = ? AND t.${filterCol} = ?
       ORDER BY t.created_at`,
      [orgId, filterVal]
    );

    const deps = await DbPromise.all<Record<string, unknown>>(
      // Silent-degr fix: `predecessor_id` does not exist on Postgres (real cols
      // are from_task_id/to_task_id). COALESCE(<nonexistent>, real) errors the
      // whole statement (42703) -> DbPromise fallback swallows -> deps always [].
      `SELECT td.*
       FROM task_dependencies td
       JOIN tasks t ON t.id = td.from_task_id
       WHERE t.organization_id = ? AND t.${filterCol} = ?`,
      [orgId, filterVal]
    );

    const snapshotId = uuidv4();
    const tasksJson = JSON.stringify({ tasks, dependencies: deps });

    await DbPromise.run(
      `INSERT INTO task_baseline_snapshots (id, organization_id, initiative_id, project_id, snapshot_type, snapshot_at, created_by, tasks_json)
       VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?)`,
      [snapshotId, orgId, initiativeId || null, projectId || null, snapshotType, userId, tasksJson]
    );

    res.status(201).json({ success: true, snapshotId });
  })
);

router.get(
  '/baseline-snapshots',
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      initiativeId,
      projectId,
      limit = '20',
      offset = '0',
    } = req.query as {
      initiativeId?: string;
      projectId?: string;
      limit?: string;
      offset?: string;
    };

    let sql = `SELECT id, organization_id, initiative_id, project_id, snapshot_type, snapshot_at, created_by, metadata_json, created_at
               FROM task_baseline_snapshots WHERE organization_id = ?`;
    const params: unknown[] = [orgId];

    if (initiativeId) {
      sql += ' AND initiative_id = ?';
      params.push(initiativeId);
    }
    if (projectId) {
      sql += ' AND project_id = ?';
      params.push(projectId);
    }

    sql += ' ORDER BY snapshot_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const snapshots = await DbPromise.all<Record<string, unknown>>(sql, params);
    res.json({ success: true, snapshots });
  })
);

router.get(
  '/baseline-snapshots/:snapshotId',
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const snapshot = await DbPromise.get<Record<string, unknown>>(
      'SELECT * FROM task_baseline_snapshots WHERE id = ? AND organization_id = ?',
      [req.params.snapshotId, orgId]
    );

    if (!snapshot) {
      res.status(404).json({ error: 'Snapshot not found' });
      return;
    }

    let tasksJson = null;
    try {
      tasksJson = JSON.parse(snapshot.tasks_json as string);
    } catch {
      tasksJson = snapshot.tasks_json;
    }

    res.json({ success: true, snapshot: { ...snapshot, tasks_json: tasksJson } });
  })
);

router.get(
  '/baseline-snapshots/:snapshotId/compare',
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const snapshot = await DbPromise.get<{
      tasks_json: string;
      initiative_id?: string;
      project_id?: string;
    }>(
      'SELECT tasks_json, initiative_id, project_id FROM task_baseline_snapshots WHERE id = ? AND organization_id = ?',
      [req.params.snapshotId, orgId]
    );

    if (!snapshot) {
      res.status(404).json({ error: 'Snapshot not found' });
      return;
    }

    let baselineData: { tasks: Record<string, unknown>[] };
    try {
      baselineData = JSON.parse(snapshot.tasks_json);
    } catch {
      res.status(500).json({ error: 'Corrupt snapshot data' });
      return;
    }

    const filterCol = snapshot.initiative_id ? 'initiative_id' : 'project_id';
    const filterVal = snapshot.initiative_id || snapshot.project_id;

    const currentTasks = await DbPromise.all<Record<string, unknown>>(
      `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.started_at,
              t.estimated_hours, t.progress, t.assignee_id, t.initiative_id, t.project_id
       FROM tasks t
       WHERE t.organization_id = ? AND t.${filterCol} = ?`,
      [orgId, filterVal]
    );

    const baselineMap = new Map<string, Record<string, unknown>>();
    for (const t of baselineData.tasks || []) baselineMap.set(t.id as string, t);

    const currentMap = new Map<string, Record<string, unknown>>();
    for (const t of currentTasks) currentMap.set(t.id as string, t);

    const added: Record<string, unknown>[] = [];
    const removed: Record<string, unknown>[] = [];
    const changed: Array<{ taskId: string; field: string; before: unknown; after: unknown }> = [];

    const compareFields = [
      'title',
      'status',
      'priority',
      'due_date',
      'started_at',
      'estimated_hours',
      'progress',
      'assignee_id',
    ];

    for (const [id, current] of currentMap) {
      if (!baselineMap.has(id)) {
        added.push(current);
      } else {
        const baseline = baselineMap.get(id)!;
        for (const field of compareFields) {
          const before = baseline[field] ?? null;
          const after = current[field] ?? null;
          if (String(before) !== String(after)) {
            changed.push({ taskId: id, field, before, after });
          }
        }
      }
    }

    for (const [id, baseline] of baselineMap) {
      if (!currentMap.has(id)) {
        removed.push(baseline);
      }
    }

    res.json({ success: true, diff: { added, removed, changed } });
  })
);

// ==========================================
// V4-TASK-04: CRITICAL PATH
// ==========================================

router.get(
  '/critical-path',
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { initiativeId, projectId } = req.query as { initiativeId?: string; projectId?: string };
    if (!initiativeId && !projectId) {
      res.status(400).json({ error: 'initiativeId or projectId is required' });
      return;
    }

    const filterCol = initiativeId ? 'initiative_id' : 'project_id';
    const filterVal = initiativeId || projectId;

    const taskRows = await DbPromise.all<{
      id: string;
      title: string;
      status: string;
      started_at: string | null;
      due_date: string | null;
      estimated_hours: number | null;
      initiative_id: string | null;
    }>(
      `SELECT t.id, t.title, t.status, t.started_at, t.due_date, t.estimated_hours, t.initiative_id
       FROM tasks t
       WHERE t.organization_id = ? AND t.${filterCol} = ?`,
      [orgId, filterVal]
    );

    const taskIds = new Set(taskRows.map((t) => t.id));

    // Detect schema variant
    let depRows: Array<{ pred: string; succ: string; dep_type: string; lag: number }>;
    try {
      depRows = await DbPromise.all<{ pred: string; succ: string; dep_type: string; lag: number }>(
        `SELECT td.predecessor_id as pred, td.successor_id as succ,
                COALESCE(td.dependency_type, 'FS') as dep_type,
                COALESCE(td.lag_days, 0) as lag
         FROM task_dependencies td
         WHERE td.predecessor_id IN (${taskRows.map(() => '?').join(',')})
            OR td.successor_id IN (${taskRows.map(() => '?').join(',')})`,
        [...taskRows.map((t) => t.id), ...taskRows.map((t) => t.id)],
        // Silent-degr fix: force throw on the legacy-schema attempt so the
        // catch{} fallback (from_task_id/to_task_id) actually runs. With the
        // default fallback=true, the 42703 (predecessor_id missing) was
        // swallowed to [] and the working fallback query never executed.
        { fallback: false }
      );
    } catch {
      depRows = await DbPromise.all<{ pred: string; succ: string; dep_type: string; lag: number }>(
        `SELECT td.from_task_id as pred, td.to_task_id as succ,
                COALESCE(td.dependency_type, 'FS') as dep_type,
                COALESCE(td.lag_days, 0) as lag
         FROM task_dependencies td
         WHERE td.from_task_id IN (${taskRows.map(() => '?').join(',')})
            OR td.to_task_id IN (${taskRows.map(() => '?').join(',')})`,
        [...taskRows.map((t) => t.id), ...taskRows.map((t) => t.id)]
      );
    }

    const dbToShort: Record<string, string> = {
      finish_to_start: 'FS',
      start_to_start: 'SS',
      finish_to_finish: 'FF',
      start_to_finish: 'SF',
      FS: 'FS',
      SS: 'SS',
      FF: 'FF',
      SF: 'SF',
    };

    const depsBySucc = new Map<
      string,
      Array<{ fromTaskId: string; type: string; lagDays: number }>
    >();
    for (const d of depRows) {
      if (!taskIds.has(d.pred) || !taskIds.has(d.succ)) continue;
      const list = depsBySucc.get(d.succ) ?? [];
      list.push({ fromTaskId: d.pred, type: dbToShort[d.dep_type] || 'FS', lagDays: d.lag });
      depsBySucc.set(d.succ, list);
    }

    const cpTasks: CriticalPathTask[] = taskRows.map((t) => {
      let durationDays = 1;
      if (t.estimated_hours) {
        durationDays = Math.max(1, Math.ceil(t.estimated_hours / 8));
      } else if (t.started_at && t.due_date) {
        const start = new Date(t.started_at).getTime();
        const end = new Date(t.due_date).getTime();
        if (!isNaN(start) && !isNaN(end) && end > start) {
          durationDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
        }
      }

      return {
        id: t.id,
        title: t.title,
        startDate: t.started_at,
        endDate: t.due_date,
        durationDays,
        status: t.status,
        dependencies: depsBySucc.get(t.id) ?? [],
        initiativeId: t.initiative_id,
      };
    });

    const result = calculateCriticalPath(cpTasks);

    const criticalCount = result.tasks.filter((t) => t.isCritical).length;
    const totalCount = result.tasks.length;
    const criticalPercent = totalCount > 0 ? (criticalCount / totalCount) * 100 : 0;
    const overdueCritical = result.tasks.filter(
      (t) =>
        t.isCritical &&
        t.endDate &&
        new Date(t.endDate) < new Date() &&
        !['done', 'completed', 'validated', 'cancelled'].includes((t.status || '').toLowerCase())
    );

    const canonicalHealth = computeCanonicalExecutionHealth({
      criticalPathPercent: criticalPercent,
      overdueCriticalCount: overdueCritical.length,
    });
    const scheduleHealth = canonicalHealth.rag === 'NA' ? 'GREEN' : canonicalHealth.rag;

    res.json({
      success: true,
      ...result,
      scheduleHealth,
      healthScore: canonicalHealth.score,
      healthFormulaVersion: canonicalHealth.formulaVersion,
    });
  })
);

// ==========================================
// V4-EXEC-03: SCHEDULE RISK ANALYTICS
// ==========================================

router.get(
  '/schedule-risk-analysis',
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { initiativeId, projectId } = req.query as { initiativeId?: string; projectId?: string };
    if (!initiativeId && !projectId) {
      res.status(400).json({ error: 'initiativeId or projectId is required' });
      return;
    }

    const filterCol = initiativeId ? 'initiative_id' : 'project_id';
    const filterVal = initiativeId || projectId;

    const taskRows = await DbPromise.all<{
      id: string;
      title: string;
      status: string;
      started_at: string | null;
      due_date: string | null;
      estimated_hours: number | null;
      assignee_id: string | null;
    }>(
      `SELECT t.id, t.title, t.status, t.started_at, t.due_date, t.estimated_hours, t.assignee_id
       FROM tasks t
       WHERE t.organization_id = ? AND t.${filterCol} = ?`,
      [orgId, filterVal]
    );

    if (taskRows.length === 0) {
      res.json({
        criticalPathLength: 0,
        totalTasks: 0,
        criticalTaskCount: 0,
        scheduleRiskPercent: 0,
        slackDistribution: { zero: 0, low: 0, medium: 0, high: 0 },
        bottlenecks: [],
        atRiskTasks: [],
        estimatedCompletionDate: null,
      });
      return;
    }

    const taskIds = new Set(taskRows.map((t) => t.id));

    let depRows: Array<{ pred: string; succ: string; dep_type: string; lag: number }>;
    try {
      depRows = await DbPromise.all<{ pred: string; succ: string; dep_type: string; lag: number }>(
        `SELECT td.predecessor_id as pred, td.successor_id as succ,
                COALESCE(td.dependency_type, 'FS') as dep_type,
                COALESCE(td.lag_days, 0) as lag
         FROM task_dependencies td
         WHERE td.predecessor_id IN (${taskRows.map(() => '?').join(',')})
            OR td.successor_id IN (${taskRows.map(() => '?').join(',')})`,
        [...taskRows.map((t) => t.id), ...taskRows.map((t) => t.id)],
        // Silent-degr fix: force throw on the legacy-schema attempt so the
        // catch{} fallback (from_task_id/to_task_id) actually runs. With the
        // default fallback=true, the 42703 (predecessor_id missing) was
        // swallowed to [] and the working fallback query never executed.
        { fallback: false }
      );
    } catch {
      depRows = await DbPromise.all<{ pred: string; succ: string; dep_type: string; lag: number }>(
        `SELECT td.from_task_id as pred, td.to_task_id as succ,
                COALESCE(td.dependency_type, 'FS') as dep_type,
                COALESCE(td.lag_days, 0) as lag
         FROM task_dependencies td
         WHERE td.from_task_id IN (${taskRows.map(() => '?').join(',')})
            OR td.to_task_id IN (${taskRows.map(() => '?').join(',')})`,
        [...taskRows.map((t) => t.id), ...taskRows.map((t) => t.id)]
      );
    }

    const dbToShort: Record<string, string> = {
      finish_to_start: 'FS',
      start_to_start: 'SS',
      finish_to_finish: 'FF',
      start_to_finish: 'SF',
      FS: 'FS',
      SS: 'SS',
      FF: 'FF',
      SF: 'SF',
    };

    const depsBySucc = new Map<
      string,
      Array<{ fromTaskId: string; type: string; lagDays: number }>
    >();
    const dependentCount = new Map<string, number>();

    for (const d of depRows) {
      if (!taskIds.has(d.pred) || !taskIds.has(d.succ)) continue;
      const list = depsBySucc.get(d.succ) ?? [];
      list.push({ fromTaskId: d.pred, type: dbToShort[d.dep_type] || 'FS', lagDays: d.lag });
      depsBySucc.set(d.succ, list);
      dependentCount.set(d.pred, (dependentCount.get(d.pred) ?? 0) + 1);
    }

    const cpTasks: CriticalPathTask[] = taskRows.map((t) => {
      let durationDays = 1;
      if (t.estimated_hours) {
        durationDays = Math.max(1, Math.ceil(t.estimated_hours / 8));
      } else if (t.started_at && t.due_date) {
        const start = new Date(t.started_at).getTime();
        const end = new Date(t.due_date).getTime();
        if (!isNaN(start) && !isNaN(end) && end > start) {
          durationDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
        }
      }
      return {
        id: t.id,
        title: t.title,
        startDate: t.started_at,
        endDate: t.due_date,
        durationDays,
        status: t.status,
        dependencies: depsBySucc.get(t.id) ?? [],
      };
    });

    const cpResult = calculateCriticalPath(cpTasks);
    const criticalSet = new Set(cpResult.criticalPath);
    const now = new Date();

    const slackDistribution = { zero: 0, low: 0, medium: 0, high: 0 };
    for (const t of cpResult.tasks) {
      if (t.slack <= 0) slackDistribution.zero++;
      else if (t.slack <= 3) slackDistribution.low++;
      else if (t.slack <= 7) slackDistribution.medium++;
      else slackDistribution.high++;
    }

    const bottlenecks = [...dependentCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([taskId, count]) => {
        const task = taskRows.find((t) => t.id === taskId);
        return { taskId, title: task?.title || '', dependentCount: count };
      });

    const atRiskTasks: Array<{ taskId: string; title: string; reason: string }> = [];
    const taskRowMap = new Map(taskRows.map((t) => [t.id, t]));
    for (const taskId of cpResult.criticalPath) {
      const row = taskRowMap.get(taskId);
      if (!row) continue;
      const status = (row.status || '').toLowerCase();
      if (['done', 'completed', 'validated', 'cancelled'].includes(status)) continue;

      if (row.due_date && new Date(row.due_date) < now) {
        atRiskTasks.push({ taskId, title: row.title, reason: 'Overdue on critical path' });
      } else if (!row.assignee_id) {
        atRiskTasks.push({ taskId, title: row.title, reason: 'No assignee on critical path' });
      }
    }

    let estimatedCompletionDate: string | null = null;
    if (cpResult.totalDuration > 0) {
      const completion = new Date(now.getTime() + cpResult.totalDuration * 24 * 60 * 60 * 1000);
      estimatedCompletionDate = completion.toISOString().split('T')[0];
    }

    let baselineVariance:
      | { plannedDays: number; currentDays: number; varianceDays: number }
      | undefined;
    try {
      const latestBaseline = await DbPromise.get<{ tasks_json: string }>(
        `SELECT tasks_json FROM task_baseline_snapshots
         WHERE organization_id = ? AND ${filterCol} = ?
         ORDER BY snapshot_at DESC LIMIT 1`,
        [orgId, filterVal]
      );
      if (latestBaseline?.tasks_json) {
        const baselineData = JSON.parse(latestBaseline.tasks_json);
        const baselineTasks = baselineData.tasks || [];
        if (baselineTasks.length > 0) {
          let maxBaselineDays = 0;
          for (const bt of baselineTasks) {
            if (bt.started_at && bt.due_date) {
              const s = new Date(bt.started_at).getTime();
              const e = new Date(bt.due_date).getTime();
              if (!isNaN(s) && !isNaN(e)) {
                maxBaselineDays = Math.max(
                  maxBaselineDays,
                  Math.ceil((e - s) / (1000 * 60 * 60 * 24))
                );
              }
            }
          }
          if (maxBaselineDays > 0) {
            baselineVariance = {
              plannedDays: maxBaselineDays,
              currentDays: cpResult.totalDuration,
              varianceDays: cpResult.totalDuration - maxBaselineDays,
            };
          }
        }
      }
    } catch {
      // baseline table may not exist or data may be corrupt
    }

    const totalTasks = taskRows.length;
    const criticalTaskCount = cpResult.criticalPath.length;
    const scheduleRiskPercent =
      totalTasks > 0 ? Math.round((criticalTaskCount / totalTasks) * 100) : 0;

    res.json({
      criticalPathLength: cpResult.totalDuration,
      totalTasks,
      criticalTaskCount,
      scheduleRiskPercent,
      slackDistribution,
      bottlenecks,
      atRiskTasks,
      estimatedCompletionDate,
      baselineVariance,
    });
  })
);

// ==========================================
// V4-TASK-06: WORKLOAD & CAPACITY
// ==========================================

router.get(
  '/capacity/overview',
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const overview = await getCapacityOverview(orgId);
    res.json({ success: true, ...overview });
  })
);

router.get(
  '/capacity/overload-alerts',
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const alerts = await getOverloadAlerts(orgId);
    res.json({ success: true, alerts });
  })
);

router.get(
  '/capacity/user/:userId/forecast',
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const forecast = await getUserForecast(orgId, req.params.userId);
    res.json({ success: true, weeks: forecast });
  })
);

router.post(
  '/time-entries',
  requireAudit,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { taskId, hours, date, description } = req.body as {
      taskId: string;
      hours: number;
      date: string;
      description?: string;
    };

    if (!taskId || !hours || !date) {
      res.status(400).json({ error: 'taskId, hours, and date are required' });
      return;
    }

    const task = await DbPromise.get<{ id: string }>(
      'SELECT id FROM tasks WHERE id = ? AND organization_id = ?',
      [taskId, orgId]
    );
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const id = uuidv4();
    await DbPromise.run(
      `INSERT INTO time_entries (id, task_id, user_id, organization_id, hours, date, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [id, taskId, userId, orgId, hours, date, description || null]
    );

    try {
      const weekDay = new Date(date);
      const day = weekDay.getDay();
      const diff = weekDay.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(weekDay);
      monday.setDate(diff);
      const weekStart = monday.toISOString().split('T')[0];

      await DbPromise.run(
        `INSERT INTO task_allocations (id, task_id, user_id, organization_id, actual_hours, week_start, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(task_id, user_id, week_start) DO UPDATE SET
           actual_hours = actual_hours + ?,
           updated_at = datetime('now')`,
        [uuidv4(), taskId, userId, orgId, hours, weekStart, hours]
      );
    } catch {
      // task_allocations table may not exist yet
    }

    res.status(201).json({ success: true, id, taskId, hours, date });
  })
);

router.get(
  '/time-entries',
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { taskId, userId, from, to } = req.query as {
      taskId?: string;
      userId?: string;
      from?: string;
      to?: string;
    };

    let sql = 'SELECT * FROM time_entries WHERE organization_id = ?';
    const params: unknown[] = [orgId];

    if (taskId) {
      sql += ' AND task_id = ?';
      params.push(taskId);
    }
    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }
    if (from) {
      sql += ' AND date >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND date <= ?';
      params.push(to);
    }

    sql += ' ORDER BY date DESC, created_at DESC';

    const entries = await DbPromise.all<Record<string, unknown>>(sql, params);
    res.json({ success: true, entries });
  })
);

router.post(
  '/allocations',
  requireAudit,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { taskId, userId, allocatedHours, weekStart } = req.body as {
      taskId: string;
      userId: string;
      allocatedHours: number;
      weekStart: string;
    };

    if (!taskId || !userId || allocatedHours === undefined || !weekStart) {
      res.status(400).json({ error: 'taskId, userId, allocatedHours, and weekStart are required' });
      return;
    }

    const id = uuidv4();
    await DbPromise.run(
      `INSERT INTO task_allocations (id, task_id, user_id, organization_id, allocated_hours, week_start, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(task_id, user_id, week_start) DO UPDATE SET
         allocated_hours = ?,
         updated_at = datetime('now')`,
      [id, taskId, userId, orgId, allocatedHours, weekStart, allocatedHours]
    );

    res.status(201).json({ success: true, id, taskId, userId, allocatedHours, weekStart });
  })
);

router.get(
  '/allocations',
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { taskId, userId, weekStart, weekEnd } = req.query as {
      taskId?: string;
      userId?: string;
      weekStart?: string;
      weekEnd?: string;
    };

    let sql = 'SELECT * FROM task_allocations WHERE organization_id = ?';
    const params: unknown[] = [orgId];

    if (taskId) {
      sql += ' AND task_id = ?';
      params.push(taskId);
    }
    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }
    if (weekStart) {
      sql += ' AND week_start >= ?';
      params.push(weekStart);
    }
    if (weekEnd) {
      sql += ' AND week_start <= ?';
      params.push(weekEnd);
    }

    sql += ' ORDER BY week_start ASC';

    const allocations = await DbPromise.all<Record<string, unknown>>(sql, params);
    res.json({ success: true, allocations });
  })
);

/**
 * GET /api/tasks/:id
 * Get single task by ID
 */
router.get('/:id', TaskController.getTaskById);

/**
 * PUT /api/tasks/:id
 * Update task
 */
router.put(
  '/:id',
  requireAudit,
  requireTaskCapability('task.update', { shadow: true }),
  validateBody(UpdateTaskSchema),
  TaskController.updateTask
);

/**
 * DELETE /api/tasks/:id
 * Delete task
 */
router.delete(
  '/:id',
  requireAudit,
  requireTaskCapability('task.delete', { shadow: true }),
  TaskController.deleteTask
);

// ==========================================
// TASK COMMENTS
// ==========================================

/**
 * GET /api/tasks/:taskId/comments
 * Get comments for a task
 */
router.get('/:taskId/comments', TaskController.getTaskComments);

/**
 * POST /api/tasks/:taskId/comments
 * Add comment to task
 */
router.post(
  '/:taskId/comments',
  requireAudit,
  validateBody(AddTaskCommentSchema),
  TaskController.addTaskComment
);

/**
 * DELETE /api/tasks/:taskId/comments/:commentId
 * Delete task comment
 */
router.delete('/:taskId/comments/:commentId', requireAudit, TaskController.deleteTaskComment);

// ==========================================
// TASK ASSIGNMENT & ESCALATION
// ==========================================

/**
 * POST /api/tasks/:id/assign
 * Assign task to user
 */
router.post(
  '/:id/assign',
  requireAudit,
  requireTaskCapability('task.assign', { shadow: true }),
  validateBody(AssignTaskSchema),
  TaskController.assignTask
);

/**
 * POST /api/tasks/:id/reassign
 * Reassign task
 */
router.post(
  '/:id/reassign',
  requireAudit,
  requireTaskCapability('task.reassign', { shadow: true }),
  validateBody(ReassignTaskSchema),
  TaskController.reassignTask
);

/**
 * POST /api/tasks/:id/unassign
 * Unassign task
 */
router.post(
  '/:id/unassign',
  requireAudit,
  requireTaskCapability('task.unassign', { shadow: true }),
  TaskController.unassignTask
);

/**
 * POST /api/tasks/:id/escalate
 * Escalate task
 */
router.post(
  '/:id/escalate',
  requireAudit,
  validateBody(EscalateTaskSchema),
  TaskController.escalateTask
);

/**
 * POST /api/tasks/:taskId/escalations/:escalationId/resolve
 * Resolve escalation
 */
router.post(
  '/:taskId/escalations/:escalationId/resolve',
  requireAudit,
  validateBody(ResolveEscalationSchema),
  TaskController.resolveEscalation
);

/**
 * GET /api/tasks/:id/escalations
 * Get task escalation history
 */
router.get('/:id/escalations', TaskController.getTaskEscalations);

// ==========================================
// TASK ANALYTICS
// ==========================================

/**
 * GET /api/tasks/overdue
 * Get overdue tasks
 */
router.get('/overdue', TaskController.getOverdueTasks);

/**
 * GET /api/tasks/at-risk
 * Get tasks approaching SLA deadline
 */
router.get('/at-risk', TaskController.getTasksAtRisk);

/**
 * GET /api/tasks/workload/:userId
 * Get user workload
 */
router.get('/workload/:userId', TaskController.getUserWorkload);

/**
 * GET /api/tasks/my-workload
 * Get current user workload
 */
router.get('/my-workload', TaskController.getMyWorkload);

// ==========================================
// FLOW-TASK-001: DECISION INTEGRATION
// ==========================================

/**
 * POST /api/tasks/:id/block
 * Block task (manual or by decision)
 */
router.post(
  '/:id/block',
  requireAudit,
  requireTaskCapability('task.status.update', { shadow: true }),
  validateBody(BlockTaskSchema),
  TaskController.blockTask
);

/**
 * POST /api/tasks/:id/unblock
 * Unblock task
 */
router.post(
  '/:id/unblock',
  requireAudit,
  validateBody(UnblockTaskSchema),
  TaskController.unblockTask
);

/**
 * POST /api/tasks/:id/move
 * Move task to different initiative
 */
router.post('/:id/move', requireAudit, TaskController.moveTask);

/**
 * GET /api/tasks/:id/blocking-decision
 * Get blocking decision details
 */
router.get('/:id/blocking-decision', TaskController.getBlockingDecision);

// ==========================================
// TASK DEPENDENCIES (Gantt-style)
// ==========================================

/**
 * GET /api/tasks/:id/dependencies
 * Get all dependencies for a task
 */
router.get('/:id/dependencies', TaskController.getTaskDependencies);

/**
 * POST /api/tasks/:id/dependencies
 * Add dependency between tasks
 */
router.post('/:id/dependencies', requireAudit, TaskController.addTaskDependency);

/**
 * DELETE /api/tasks/:id/dependencies/:depId
 * Remove a dependency
 */
router.delete('/:id/dependencies/:depId', requireAudit, TaskController.removeTaskDependency);

// ==========================================
// V4-TASK-04: MILESTONE-TASK LINKING
// ==========================================

router.post(
  '/:id/milestone',
  requireAudit,
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    if (!orgId || !userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const taskId = req.params.id;
    const { isMilestone, milestoneTargetDate } = req.body as {
      isMilestone?: boolean;
      milestoneTargetDate?: string;
    };

    const task = await DbPromise.get<{ id: string }>(
      'SELECT id FROM tasks WHERE id = ? AND organization_id = ?',
      [taskId, orgId]
    );

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const milestone = isMilestone !== undefined ? isMilestone : true;

    await DbPromise.run(
      `UPDATE tasks SET is_milestone = ?, milestone_target_date = ?, updated_at = datetime('now') WHERE id = ?`,
      [milestone ? 1 : 0, milestoneTargetDate || null, taskId]
    );

    res.json({
      success: true,
      taskId,
      isMilestone: milestone,
      milestoneTargetDate: milestoneTargetDate || null,
    });
  })
);

export default router;
