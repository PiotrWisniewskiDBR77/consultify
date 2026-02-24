/**
 * My Work Routes
 *
 * Provides aggregated endpoints for the My Work module:
 * - Inbox (triage)
 * - Focus (lightweight focus state)
 * - Stats / Team workload (executive view)
 *
 * IMPORTANT:
 * - No mock/demo/sample data. All outputs are derived from real tables.
 * - Uses small state tables created with IF NOT EXISTS for triage/focus persistence.
 */

import { type Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import NotificationService from '../services/notificationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getTableColumns } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

const router = Router();

router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(demoContextMiddleware);

type InboxItemType =
  | 'new_assignment'
  | 'mention'
  | 'escalation'
  | 'review_request'
  | 'decision_request'
  | 'ai_suggestion'
  | 'system_alert'
  | 'billing_alert'
  | 'project_update';

type TriageAction = 'accept_today' | 'accept_week' | 'accept_later' | 'schedule' | 'delegate' | 'archive' | 'dismiss' | 'done' | 'save' | 'reject';

type InboxUrgency = 'critical' | 'high' | 'normal' | 'low';

type FocusColumn = 'today' | 'thisWeek' | 'later';

type InboxItemKey = `task:${string}` | `decision:${string}` | `notification:${string}`;

type InboxSection =
  | 'decisions_required'
  | 'approvals_gates'
  | 'assigned_tasks'
  | 'blocked_escalations'
  | 'overdue_sla_breach'
  | 'fyi_system'
  | 'fyi_mentions'
  | 'ai_insights'
  | 'other';

type SlaLevel = 'none' | 'L1' | 'L2' | 'L3';

interface InboxItem {
  id: string;
  type: InboxItemType;
  section: InboxSection;
  title: string;
  description?: string;
  source: {
    type: 'user' | 'system' | 'ai';
    userId?: string;
    userName?: string;
    avatarUrl?: string;
  };
  receivedAt: string;
  urgency: InboxUrgency;
  dueDate?: string;
  sla?: {
    dueAt: string;
    remainingMs: number;
    isBreached: boolean;
    level: SlaLevel;
  };
  linkedTaskId?: string;
  linkedDecisionId?: string;
  linkedInitiativeId?: string;
  linkedTask?: { id: string; title: string; status: string; priority: string; dueDate?: string };
  triaged: boolean;
  triagedAt?: string;
  triageAction?: TriageAction;
  triageParams?: Record<string, unknown>;
  // N1: Read vs Done semantics
  itemStatus: 'open' | 'done' | 'saved' | 'snoozed' | 'dismissed';
  // N7: "Why am I seeing this?"
  reason: string;
  // N2: Is this item actionable (requires my action)?
  isActionable: boolean;
  // C1: AI suggestions
  suggestedAction?: TriageAction;
  suggestedReason?: string;
  _key: InboxItemKey;
}

const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);

const normalizeTaskStatus = (status?: string | null) => String(status || '').toLowerCase();
const isTaskDone = (status?: string | null) => {
  const s = normalizeTaskStatus(status);
  return s === 'done' || s === 'completed' || s === 'validated';
};

const parseTagsArray = (input: unknown): string[] => {
  if (Array.isArray(input)) return input.map((x) => String(x).trim()).filter(Boolean);
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
    } catch {
      // ignore
    }
    if (s.includes(','))
      return s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
  }
  return [];
};

const normalizeDecisionStatus = (status?: string | null) => String(status || '').toLowerCase();
const isDecisionPending = (status?: string | null) => {
  const s = normalizeDecisionStatus(status);
  return s === 'pending' || s === 'escalated';
};

const urgencyFromPriority = (priority?: string | null): InboxUrgency => {
  const p = String(priority || '').toLowerCase();
  if (p === 'urgent' || p === 'critical') return 'critical';
  if (p === 'high') return 'high';
  if (p === 'low') return 'low';
  return 'normal';
};

const addDaysIso = (baseIso: string, days: number): string => {
  const ms = new Date(baseIso).getTime();
  return new Date(ms + days * 24 * 60 * 60 * 1000).toISOString();
};

const defaultSlaDaysBySection: Record<InboxSection, number | null> = {
  decisions_required: 5,
  approvals_gates: 3,
  blocked_escalations: 2,
  overdue_sla_breach: 0,
  assigned_tasks: 7,
  fyi_system: null,
  fyi_mentions: null,
  ai_insights: null,
  other: null,
};

const computeSla = (
  nowIso: string,
  receivedAtIso: string,
  section: InboxSection,
  dueAt?: string
): InboxItem['sla'] => {
  const effectiveDue =
    dueAt ||
    (defaultSlaDaysBySection[section] != null
      ? addDaysIso(receivedAtIso, defaultSlaDaysBySection[section] as number)
      : undefined);
  if (!effectiveDue) return undefined;

  const remainingMs = new Date(effectiveDue).getTime() - new Date(nowIso).getTime();
  const isBreached = remainingMs < 0;
  const absMs = Math.abs(remainingMs);

  let level: SlaLevel = 'none';
  if (!isBreached && remainingMs <= 24 * 60 * 60 * 1000) level = 'L1';
  if (isBreached && absMs <= 72 * 60 * 60 * 1000) level = 'L2';
  if (isBreached && absMs > 72 * 60 * 60 * 1000) level = 'L3';

  return { dueAt: effectiveDue, remainingMs, isBreached, level };
};

const mapNotificationToInboxType = (type?: string | null): InboxItemType => {
  const t = String(type || '').toUpperCase();
  if (t.includes('MENTION')) return 'mention';
  if (t.includes('ESCALATION')) return 'escalation';
  if (t.includes('REVIEW') || t.includes('APPROVAL')) return 'review_request';
  if (t.includes('DECISION')) return 'decision_request';
  if (t.includes('AI') || t.includes('RECOMMENDATION') || t.includes('INSIGHT') || t.includes('RISK')) return 'ai_suggestion';
  if (t.includes('BILLING') || t.includes('PAYMENT') || t.includes('SUBSCRIPTION') || t.includes('USAGE') || t.includes('INVOICE') || t.includes('LIMIT')) return 'billing_alert';
  if (t.includes('SYSTEM') || t.includes('SECURITY')) return 'system_alert';
  if (t.includes('PROJECT') || t.includes('INITIATIVE')) return 'project_update';
  return 'new_assignment';
};

// C1: Heuristic auto-triage suggestions (lightweight pattern matching, not LLM)
const suggestTriageAction = (item: InboxItem): { action?: TriageAction; reason?: string } => {
  // FYI notifications older than 3 days → suggest archive
  if (
    (item.section === 'fyi_system' || item.section === 'fyi_mentions') &&
    Date.now() - new Date(item.receivedAt).getTime() > 3 * 86400000
  ) {
    return { action: 'archive', reason: 'FYI notification older than 3 days' };
  }

  // SLA-breached overdue items → suggest accept_today (urgent)
  if (item.sla?.isBreached && item.section === 'overdue_sla_breach') {
    return { action: 'accept_today', reason: 'SLA breached — needs immediate attention' };
  }

  // Critical/high urgency decisions → suggest accept_today
  if (item.type === 'decision_request' && (item.urgency === 'critical' || item.urgency === 'high')) {
    return { action: 'accept_today', reason: 'High-priority decision awaiting you' };
  }

  // Low urgency system notifications → suggest archive
  if (item.urgency === 'low' && item.type === 'new_assignment' && !item.dueDate) {
    return { action: 'schedule', reason: 'Low priority, no due date — consider scheduling' };
  }

  return {};
};

const requireUser = (req: AuthRequest, res: Response): { userId: string; orgId: string } | null => {
  const userId = (req as any).userId || req.user?.id;
  const orgId = req.user?.organizationId;
  if (!userId || !orgId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return { userId, orgId };
};

const requireTables = async (res: Response, tables: string[]): Promise<boolean> => {
  for (const t of tables) {
    const cols = await getTableColumns(t);
    if (!cols || cols.size === 0) {
      res.status(503).json({
        error: `Database table missing: ${t}. Run migrations (npm run db:migrate:*).`,
      });
      return false;
    }
  }
  return true;
};

/**
 * GET /api/my-work/tasks
 * Lightweight list for Focus + My Work aggregations
 */
router.get(
  '/tasks',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const limit = Number(req.query.limit) || 50;
    const onlyOpen = String(req.query.onlyOpen ?? 'true') !== 'false';

    const rows =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          t.id,
          t.title,
          t.description,
          t.status,
          t.priority,
          t.due_date as dueDate,
          t.initiative_id as initiativeId,
          i.name as initiativeName,
          p.name as projectName,
          t.assignee_id as assigneeId,
          a.first_name as assigneeFirstName,
          a.last_name as assigneeLastName,
          a.avatar_url as assigneeAvatarUrl,
          t.estimated_hours as estimatedHours,
          t.checklist
        FROM tasks t
        LEFT JOIN initiatives i ON t.initiative_id = i.id
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN users a ON t.assignee_id = a.id
        WHERE t.organization_id = ?
          AND t.assignee_id = ?
          ${onlyOpen ? "AND lower(coalesce(t.status,'')) NOT IN ('done','completed','validated')" : ''}
        ORDER BY
          CASE lower(coalesce(t.priority,'')) WHEN 'urgent' THEN 0 WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 2 END,
          COALESCE(t.due_date, '9999-12-31') ASC,
          t.updated_at DESC
        LIMIT ?
      `,
        [orgId, userId, limit]
      )) || [];

    res.json(rows);
  })
);

/**
 * T007 (V2) — Personal Tasks (private per-user)
 *
 * NOTE: stored in `tasks` with `task_type='personal'` and filtered by assignee + org.
 */
router.get(
  '/personal-tasks',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const includeDone = String(req.query.includeDone || 'false') === 'true';
    const status = req.query.status ? String(req.query.status).trim().toLowerCase() : '';
    const q = req.query.q ? String(req.query.q).trim().toLowerCase() : '';
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 200;

    const taskCols = await getTableColumns('tasks');
    const sourceTypeSelect = taskCols.has('source_type') ? 't.source_type' : "NULL as source_type";
    const sourceIdSelect = taskCols.has('source_id') ? 't.source_id' : "NULL as source_id";

    const params: any[] = [orgId, userId];
    let whereExtra = '';

    if (!includeDone) {
      whereExtra += " AND lower(coalesce(t.status,'')) NOT IN ('done','completed','validated')";
    }
    if (status) {
      whereExtra += " AND lower(coalesce(t.status,'')) = ?";
      params.push(status);
    }
    if (q) {
      whereExtra +=
        " AND (lower(coalesce(t.title,'')) LIKE ? OR lower(coalesce(t.description,'')) LIKE ?)";
      params.push(`%${q}%`, `%${q}%`);
    }

    params.push(limit);

    const rows =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          t.id,
          t.title,
          t.description,
          t.status,
          t.priority,
          t.due_date as "dueDate",
          t.tags,
          t.created_at as "createdAt",
          t.updated_at as "updatedAt",
          t.completed_at as "completedAt",
          ${sourceTypeSelect} as "sourceType",
          ${sourceIdSelect} as "sourceId"
        FROM tasks t
        WHERE t.organization_id = ?
          AND t.assignee_id = ?
          AND lower(coalesce(t.task_type,'')) = 'personal'
          ${whereExtra}
        ORDER BY
          CASE lower(coalesce(t.priority,'')) WHEN 'urgent' THEN 0 WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 2 END,
          COALESCE(t.due_date, '9999-12-31') ASC,
          t.updated_at DESC
        LIMIT ?
      `,
        params
      )) || [];

    res.json(rows.map((r: any) => ({ ...r, tags: parseTagsArray(r?.tags) })));
  })
);

router.post(
  '/personal-tasks',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const title = String(req.body?.title || '').trim();
    if (!title) {
      res.status(400).json({ error: 'title is required' });
      return;
    }

    const description =
      typeof req.body?.description === 'string' ? req.body.description : undefined;
    const status = String(req.body?.status || 'todo').trim() || 'todo';
    const priority = String(req.body?.priority || 'medium').trim() || 'medium';
    const dueDate = req.body?.dueDate ? String(req.body.dueDate).trim() : undefined;
    const tags = parseTagsArray(req.body?.tags);

    const id = uuidv4();
    const cols = await getTableColumns('tasks');

    const insertCols: string[] = ['id'];
    const insertVals: string[] = ['?'];
    const insertParams: any[] = [id];

    const add = (col: string, val: any) => {
      if (!cols.has(col)) return;
      insertCols.push(col);
      insertVals.push('?');
      insertParams.push(val);
    };

    add('organization_id', orgId);
    add('title', title);
    add('description', description ?? null);
    add('status', status);
    add('priority', priority);
    add('assignee_id', userId);
    add('reporter_id', userId);
    if (dueDate) add('due_date', dueDate);
    add('tags', JSON.stringify(tags));
    add('task_type', 'personal');

    await queryHelpers.queryRun(
      `INSERT INTO tasks (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
      insertParams
    );

    const row = await queryHelpers.queryOne<any>(
      `
      SELECT
        t.id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.due_date as "dueDate",
        t.tags,
        t.created_at as "createdAt",
        t.updated_at as "updatedAt",
        t.completed_at as "completedAt"
      FROM tasks t
      WHERE t.id = ? AND t.organization_id = ? AND t.assignee_id = ?
        AND lower(coalesce(t.task_type,'')) = 'personal'
      LIMIT 1
    `,
      [id, orgId, userId]
    );

    res.status(201).json({ ...row, tags: parseTagsArray((row as any)?.tags) });
  })
);

router.get(
  '/personal-tasks/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const id = String(req.params.id || '').trim();
    const row = await queryHelpers.queryOne<any>(
      `
      SELECT
        t.id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.due_date as "dueDate",
        t.tags,
        t.created_at as "createdAt",
        t.updated_at as "updatedAt",
        t.completed_at as "completedAt"
      FROM tasks t
      WHERE t.id = ? AND t.organization_id = ? AND t.assignee_id = ?
        AND lower(coalesce(t.task_type,'')) = 'personal'
      LIMIT 1
    `,
      [id, orgId, userId]
    );

    if (!row) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    res.json({ ...row, tags: parseTagsArray((row as any)?.tags) });
  })
);

router.put(
  '/personal-tasks/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const id = String(req.params.id || '').trim();
    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, status FROM tasks WHERE id = ? AND organization_id = ? AND assignee_id = ? AND lower(coalesce(task_type,''))='personal' LIMIT 1`,
      [id, orgId, userId]
    );
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const cols = await getTableColumns('tasks');
    const setParts: string[] = [];
    const params: any[] = [];

    const setIf = (col: string, val: any) => {
      if (!cols.has(col)) return;
      setParts.push(`${col} = ?`);
      params.push(val);
    };

    if (typeof req.body?.title === 'string') setIf('title', String(req.body.title).trim());
    if (typeof req.body?.description === 'string') setIf('description', req.body.description);
    if (typeof req.body?.priority === 'string') setIf('priority', String(req.body.priority).trim());
    if (req.body?.dueDate !== undefined) {
      const d = req.body.dueDate ? String(req.body.dueDate).trim() : null;
      setIf('due_date', d);
    }
    if (req.body?.tags !== undefined) setIf('tags', JSON.stringify(parseTagsArray(req.body.tags)));

    let nextStatus: string | null = null;
    if (typeof req.body?.status === 'string') {
      nextStatus = String(req.body.status).trim();
      setIf('status', nextStatus);
    }

    // completed_at bookkeeping
    const wasDone = isTaskDone(existing?.status);
    const isDoneNow = nextStatus ? isTaskDone(nextStatus) : wasDone;
    if (nextStatus) {
      if (!wasDone && isDoneNow) {
        setIf('completed_at', new Date().toISOString());
      } else if (wasDone && !isDoneNow) {
        setIf('completed_at', null);
      }
    }

    if (cols.has('updated_at')) {
      setParts.push(`updated_at = CURRENT_TIMESTAMP`);
    }

    if (setParts.length === 0) {
      const row = await queryHelpers.queryOne<any>(
        `
        SELECT
          t.id,
          t.title,
          t.description,
          t.status,
          t.priority,
          t.due_date as "dueDate",
          t.tags,
          t.created_at as "createdAt",
          t.updated_at as "updatedAt",
          t.completed_at as "completedAt"
        FROM tasks t
        WHERE t.id = ? AND t.organization_id = ? AND t.assignee_id = ?
          AND lower(coalesce(t.task_type,'')) = 'personal'
        LIMIT 1
      `,
        [id, orgId, userId]
      );
      res.json({ ...row, tags: parseTagsArray((row as any)?.tags) });
      return;
    }

    params.push(id, orgId, userId);
    await queryHelpers.queryRun(
      `UPDATE tasks SET ${setParts.join(', ')} WHERE id = ? AND organization_id = ? AND assignee_id = ? AND lower(coalesce(task_type,''))='personal'`,
      params
    );

    const row = await queryHelpers.queryOne<any>(
      `
      SELECT
        t.id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.due_date as "dueDate",
        t.tags,
        t.created_at as "createdAt",
        t.updated_at as "updatedAt",
        t.completed_at as "completedAt"
      FROM tasks t
      WHERE t.id = ? AND t.organization_id = ? AND t.assignee_id = ?
        AND lower(coalesce(t.task_type,'')) = 'personal'
      LIMIT 1
    `,
      [id, orgId, userId]
    );

    res.json({ ...row, tags: parseTagsArray((row as any)?.tags) });
  })
);

router.delete(
  '/personal-tasks/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const id = String(req.params.id || '').trim();
    await queryHelpers.queryRun(
      `DELETE FROM tasks WHERE id = ? AND organization_id = ? AND assignee_id = ? AND lower(coalesce(task_type,''))='personal'`,
      [id, orgId, userId]
    );
    res.status(204).send();
  })
);

/**
 * GET /api/my-work/calendar
 * Query:
 * - source=personal|project|all (default: all)
 * - projectId? (optional, for project filtering)
 * - includeDone=true|false (default: false)
 * - limit (default: 500)
 */
router.get(
  '/calendar',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const source = String(req.query.source || 'all').toLowerCase();
    const projectId = req.query.projectId ? String(req.query.projectId) : null;
    const includeDone = String(req.query.includeDone || 'false') === 'true';
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 2000) : 500;

    const where: string[] = ['t.organization_id = ?', 't.assignee_id = ?'];
    const params: any[] = [orgId, userId];

    if (!includeDone) {
      where.push("lower(coalesce(t.status,'')) NOT IN ('done','completed','validated')");
    }

    if (source === 'personal') {
      where.push("lower(coalesce(t.task_type,'')) = 'personal'");
    } else if (source === 'project') {
      where.push('t.project_id IS NOT NULL');
      where.push("lower(coalesce(t.task_type,'')) != 'personal'");
    } else if (source !== 'all') {
      return res.status(400).json({ error: 'Invalid source (expected personal|project|all)' });
    }

    if (projectId) {
      where.push('t.project_id = ?');
      params.push(projectId);
    }

    const rows =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          t.id,
          t.title,
          t.description,
          t.status,
          t.priority,
          t.due_date as dueDate,
          t.task_type as taskType,
          t.project_id as projectId,
          p.name as projectName,
          t.initiative_id as initiativeId,
          i.name as initiativeName,
          t.created_at as createdAt,
          t.updated_at as updatedAt
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN initiatives i ON t.initiative_id = i.id
        WHERE ${where.join(' AND ')}
        ORDER BY
          CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
          date(COALESCE(t.due_date, '9999-12-31')) ASC,
          CASE lower(coalesce(t.priority,'')) WHEN 'urgent' THEN 0 WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 2 END,
          t.updated_at DESC
        LIMIT ?
      `,
        [...params, limit]
      )) || [];

    res.json({ tasks: rows });
  })
);

/**
 * GET /api/my-work/decisions
 * Lightweight list for Focus + Inbox
 */
router.get(
  '/decisions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const limit = Number(req.query.limit) || 50;
    const onlyPending = String(req.query.onlyPending ?? 'true') !== 'false';

    const decisionCols = await getTableColumns('decisions');
    const prioritySelect = decisionCols.has('priority') ? 'd.priority' : `'MEDIUM' as priority`;
    const impactSelect = decisionCols.has('impact') ? 'd.impact' : `'MEDIUM' as impact`;
    const dSourceTypeSelect = decisionCols.has('source_type') ? 'd.source_type' : "NULL as source_type";
    const dSourceIdSelect = decisionCols.has('source_id') ? 'd.source_id' : "NULL as source_id";

    const rows =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          d.id,
          d.title,
          d.description,
          d.type as decisionType,
          d.status,
          ${prioritySelect},
          ${impactSelect},
          d.deadline as dueDate,
          d.created_at as createdAt,
          p.name as projectName,
          ${dSourceTypeSelect} as "sourceType",
          ${dSourceIdSelect} as "sourceId"
        FROM decisions d
        LEFT JOIN projects p ON d.project_id = p.id
        WHERE d.organization_id = ?
          AND d.decision_maker_id = ?
          ${onlyPending ? "AND lower(coalesce(d.status,'')) IN ('pending','escalated')" : ''}
        ORDER BY d.created_at DESC
        LIMIT ?
      `,
        [orgId, userId, limit]
      )) || [];

    const now = Date.now();
    const out = rows.map((d: any) => {
      const createdAt = d.createdAt ? new Date(d.createdAt).getTime() : now;
      const daysWaiting = Math.max(0, Math.floor((now - createdAt) / (1000 * 60 * 60 * 24)));
      const due = d.dueDate ? new Date(d.dueDate).getTime() : null;
      const isOverdue = typeof due === 'number' ? due < now : false;
      return { ...d, daysWaiting, isOverdue };
    });

    res.json(out);
  })
);

/**
 * GET /api/my-work/decisions/queue
 * Query:
 * - mode=my|requests_pending|all|snoozed (default: my)
 * - limit (default: 25, max: 200)
 * - cursor (optional; numeric offset for now)
 *
 * Notes:
 * - Excludes snoozed decisions for the caller in modes my/requests_pending/all.
 * - Mode=snoozed returns only snoozed decisions (snoozed_until > now).
 */
router.get(
  '/decisions/queue',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_work_decision_snoozes', 'decisions']))) return;

    const modeRaw = String(req.query.mode || 'my').trim().toLowerCase();
    const mode =
      modeRaw === 'requests_pending' || modeRaw === 'requests' || modeRaw === 'pending_requests'
        ? 'requests_pending'
        : modeRaw === 'all'
          ? 'all'
          : modeRaw === 'snoozed'
            ? 'snoozed'
            : 'my';

    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 25;

    const cursorRaw = req.query.cursor ? Number(req.query.cursor) : 0;
    const offset = Number.isFinite(cursorRaw) && cursorRaw >= 0 ? cursorRaw : 0;

    const nowIso = new Date().toISOString();

    const decisionCols = await getTableColumns('decisions');
    const hasPriority = decisionCols.has('priority');
    const hasImpact = decisionCols.has('impact');
    const hasEscalationLevelCol = decisionCols.has('escalation_level');

    // For "requests pending" we rely on decisions.created_by (canonical).
    if (!decisionCols.has('created_by')) {
      return res.status(503).json({
        error: 'Database column missing: decisions.created_by. Run migrations / self-heal.',
      });
    }

    const prioritySelect = hasPriority ? 'd.priority' : `'MEDIUM' as priority`;
    const impactSelect = hasImpact ? 'd.impact' : `'MEDIUM' as impact`;
    const escalationSelect = hasEscalationLevelCol ? 'd.escalation_level' : `'none' as escalation_level`;

    const where: string[] = [
      `d.organization_id = ?`,
      `lower(coalesce(d.status,'')) IN ('pending','escalated')`,
    ];
    const params: any[] = [orgId];

    if (mode === 'my') {
      where.push(`d.decision_maker_id = ?`);
      params.push(userId);
    } else if (mode === 'requests_pending') {
      where.push(`d.created_by = ?`);
      params.push(userId);
      where.push(`d.decision_maker_id != ?`);
      params.push(userId);
    } else if (mode === 'all') {
      where.push(`(d.decision_maker_id = ? OR d.created_by = ?)`);
      params.push(userId, userId);
    } else if (mode === 'snoozed') {
      // handled below; keep base where for pending/escalated
      where.push(`(d.decision_maker_id = ? OR d.created_by = ?)`);
      params.push(userId, userId);
    }

    // Snooze join (per-user)
    const snoozeJoin = `
      LEFT JOIN my_work_decision_snoozes s
        ON s.decision_id = d.id
       AND s.user_id = ?
       AND s.organization_id = ?
    `;
    const snoozeParams = [userId, orgId];

    // Exclude snoozed unless mode=snoozed
    if (mode !== 'snoozed') {
      where.push(`(s.snoozed_until IS NULL OR s.snoozed_until <= ?)`);
      params.push(nowIso);
    } else {
      where.push(`(s.snoozed_until IS NOT NULL AND s.snoozed_until > ?)`);
      params.push(nowIso);
    }

    const rows =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          d.id,
          d.title,
          d.description,
          d.type as decisionType,
          d.status,
          ${prioritySelect},
          ${impactSelect},
          ${escalationSelect},
          d.deadline as dueDate,
          d.created_at as createdAt,
          d.updated_at as updatedAt,
          d.project_id as projectId,
          d.initiative_id as initiativeId,
          d.task_id as taskId,
          d.decision_maker_id as decisionOwnerId,
          d.created_by as requestedById,
          owner.first_name || ' ' || owner.last_name as ownerName,
          requester.first_name || ' ' || requester.last_name as requestedByName,
          p.name as projectName,
          (SELECT COUNT(*) FROM decision_impacts di WHERE di.decision_id = d.id AND di.is_blocker = 1) as blockedItemsCount,
          s.snoozed_until as snoozedUntil
        FROM decisions d
        ${snoozeJoin}
        LEFT JOIN users owner ON d.decision_maker_id = owner.id
        LEFT JOIN users requester ON d.created_by = requester.id
        LEFT JOIN projects p ON d.project_id = p.id
        WHERE ${where.join(' AND ')}
        ORDER BY
          CASE lower(coalesce(d.status,'')) WHEN 'pending' THEN 0 WHEN 'escalated' THEN 1 ELSE 2 END,
          CASE lower(coalesce(${hasPriority ? 'd.priority' : `'MEDIUM'`},'')) WHEN 'urgent' THEN 0 WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 2 END,
          CASE WHEN d.deadline IS NULL THEN 1 ELSE 0 END,
          COALESCE(d.deadline, '9999-12-31') ASC,
          d.created_at ASC,
          d.id ASC
        LIMIT ?
        OFFSET ?
      `,
        [...snoozeParams, ...params, limit, offset]
      )) || [];

    const out = rows.map((r: any) => ({ ...r, canRemind: true, lastRemindedAt: null }));

    const nextCursor = out.length === limit ? offset + limit : null;
    res.json({ items: out, nextCursor, mode });
  })
);

/**
 * POST /api/my-work/decisions/:id/snooze
 * Body: { until?: string, preset?: string }
 */
router.post(
  '/decisions/:id/snooze',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_work_decision_snoozes', 'decisions']))) return;

    const decisionId = String(req.params.id || '').trim();
    if (!decisionId) return res.status(400).json({ error: 'id is required' });

    const until =
      typeof req.body?.until === 'string' && req.body.until.trim()
        ? String(req.body.until).trim()
        : snoozePresetToUntil(String(req.body?.preset || 'tomorrow'));

    const untilDate = new Date(until);
    if (Number.isNaN(untilDate.getTime())) {
      return res.status(400).json({ error: 'Invalid until (expected ISO date string)' });
    }

    // Access control: allow snooze only if the decision is relevant to this user.
    const access = await queryHelpers.queryOne<{ ok: number }>(
      `
      SELECT 1 as ok
      FROM decisions d
      WHERE d.id = ?
        AND d.organization_id = ?
        AND (d.decision_maker_id = ? OR d.created_by = ?)
      LIMIT 1
    `,
      [decisionId, orgId, userId, userId]
    );
    if (!access) return res.status(404).json({ error: 'Not found' });

    await queryHelpers.queryRun(
      `
      INSERT INTO my_work_decision_snoozes
        (user_id, organization_id, decision_id, snoozed_until, created_at, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, organization_id, decision_id) DO UPDATE SET
        snoozed_until = excluded.snoozed_until,
        updated_at = CURRENT_TIMESTAMP
    `,
      [userId, orgId, decisionId, untilDate.toISOString()]
    );

    res.json({ success: true, decisionId, snoozedUntil: untilDate.toISOString() });
  })
);

/**
 * POST /api/my-work/decisions/:id/unsnooze
 */
router.post(
  '/decisions/:id/unsnooze',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_work_decision_snoozes']))) return;

    const decisionId = String(req.params.id || '').trim();
    if (!decisionId) return res.status(400).json({ error: 'id is required' });

    await queryHelpers.queryRun(
      `DELETE FROM my_work_decision_snoozes WHERE user_id = ? AND organization_id = ? AND decision_id = ?`,
      [userId, orgId, decisionId]
    );
    res.json({ success: true, decisionId });
  })
);

/**
 * GET /api/my-work/decisions/preferences
 * Returns user preferences JSON (and defaults when missing).
 */
router.get(
  '/decisions/preferences',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_work_decision_prefs']))) return;

    const row = await queryHelpers.queryOne<{ prefs_json: string; updated_at: string }>(
      `SELECT prefs_json, updated_at FROM my_work_decision_prefs WHERE user_id = ? AND organization_id = ? LIMIT 1`,
      [userId, orgId]
    );

    const defaults = {
      defaultViewMode: 'split',
      defaultFilterMode: 'my',
      savedViews: [],
    };

    if (!row?.prefs_json) {
      return res.json({ prefs: defaults, updatedAt: null });
    }

    try {
      const parsed = JSON.parse(row.prefs_json);
      res.json({ prefs: { ...defaults, ...(parsed || {}) }, updatedAt: row.updated_at || null });
    } catch {
      res.json({ prefs: defaults, updatedAt: row.updated_at || null });
    }
  })
);

/**
 * PUT /api/my-work/decisions/preferences
 * Body: { prefs: object } or raw object
 */
router.put(
  '/decisions/preferences',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_work_decision_prefs']))) return;

    const prefsObj =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? (req.body.prefs && typeof req.body.prefs === 'object' ? req.body.prefs : req.body)
        : null;
    if (!prefsObj) return res.status(400).json({ error: 'prefs object is required' });

    // Safety: cap size to avoid abusing TEXT column and logs.
    const prefsJson = JSON.stringify(prefsObj);
    if (prefsJson.length > 50_000) {
      return res.status(413).json({ error: 'prefs payload too large' });
    }

    const nowIso = new Date().toISOString();
    await queryHelpers.queryRun(
      `
      INSERT INTO my_work_decision_prefs (user_id, organization_id, prefs_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (user_id, organization_id) DO UPDATE SET
        prefs_json = excluded.prefs_json,
        updated_at = excluded.updated_at
    `,
      [userId, orgId, prefsJson, nowIso]
    );

    res.json({ success: true, prefs: prefsObj, updatedAt: nowIso });
  })
);

/**
 * GET /api/my-work/inbox
 * Derived inbox items + triage state
 */
router.get(
  '/inbox',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_work_inbox_triage']))) return;

    const limit = Number(req.query.limit) || 50;
    const nowIso = new Date().toISOString();
    const today = todayIsoDate();

    const triagedRows =
      (await queryHelpers.queryAll<{
        item_key: string;
        action: string;
        params_json?: string;
        triaged_at: string;
      }>(
        `SELECT item_key, action, params_json, triaged_at FROM my_work_inbox_triage WHERE user_id = ?`,
        [userId]
      )) || [];
    const triagedMap = new Map<
      string,
      { action: TriageAction; params?: Record<string, unknown>; triagedAt: string }
    >();
    for (const r of triagedRows) {
      let params: Record<string, unknown> | undefined;
      if (r.params_json) {
        try {
          params = JSON.parse(r.params_json);
        } catch {
          params = undefined;
        }
      }
      triagedMap.set(r.item_key, {
        action: r.action as TriageAction,
        params,
        triagedAt: r.triaged_at,
      });
    }

    // 1) Overdue tasks (assigned)
    const overdueTasks =
      (await queryHelpers.queryAll<any>(
        `
        SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date as dueDate,
               t.initiative_id as initiativeId, i.name as initiativeName,
               t.blocked_reason as blockedReason,
               t.blocked_by_decision_id as blockedByDecisionId,
               t.blocked_at as blockedAt,
               t.created_at as createdAt
        FROM tasks t
        LEFT JOIN initiatives i ON t.initiative_id = i.id
        WHERE t.organization_id = ?
          AND t.assignee_id = ?
          AND t.due_date IS NOT NULL
          AND date(t.due_date) < date(?)
          AND lower(coalesce(t.status,'')) NOT IN ('done','completed','validated')
        ORDER BY date(t.due_date) ASC
        LIMIT ?
      `,
        [orgId, userId, today, Math.min(25, limit)]
      )) || [];

    // 1b) Blocked tasks (assigned)
    const blockedTasks =
      (await queryHelpers.queryAll<any>(
        `
        SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date as dueDate,
               t.initiative_id as initiativeId, i.name as initiativeName,
               t.blocked_reason as blockedReason,
               t.blocked_by_decision_id as blockedByDecisionId,
               t.blocked_at as blockedAt,
               t.updated_at as updatedAt,
               t.created_at as createdAt
        FROM tasks t
        LEFT JOIN initiatives i ON t.initiative_id = i.id
        WHERE t.organization_id = ?
          AND t.assignee_id = ?
          AND lower(coalesce(t.status,'')) NOT IN ('done','completed','validated')
          AND (
            lower(coalesce(t.status,'')) = 'blocked'
            OR t.blocked_by_decision_id IS NOT NULL
            OR t.blocked_reason IS NOT NULL
          )
        ORDER BY
          CASE lower(coalesce(t.priority,'')) WHEN 'urgent' THEN 0 WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 2 END,
          COALESCE(t.updated_at, t.created_at) DESC
        LIMIT ?
      `,
        [orgId, userId, Math.min(25, limit)]
      )) || [];

    // 1c) Assigned open tasks (non-overdue, non-blocked)
    const assignedOpenTasks =
      (await queryHelpers.queryAll<any>(
        `
        SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date as dueDate,
               t.initiative_id as initiativeId, i.name as initiativeName,
               t.updated_at as updatedAt,
               t.created_at as createdAt
        FROM tasks t
        LEFT JOIN initiatives i ON t.initiative_id = i.id
        WHERE t.organization_id = ?
          AND t.assignee_id = ?
          AND lower(coalesce(t.status,'')) NOT IN ('done','completed','validated')
          AND lower(coalesce(t.status,'')) != 'blocked'
          AND (t.blocked_by_decision_id IS NULL AND t.blocked_reason IS NULL)
          AND (
            t.due_date IS NULL
            OR date(t.due_date) >= date(?)
          )
        ORDER BY
          CASE lower(coalesce(t.priority,'')) WHEN 'urgent' THEN 0 WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 2 END,
          COALESCE(t.due_date, '9999-12-31') ASC,
          COALESCE(t.updated_at, t.created_at) DESC
        LIMIT ?
      `,
        [orgId, userId, today, Math.min(25, limit)]
      )) || [];

    // 2) Pending decisions (owned)
    const decisionCols = await getTableColumns('decisions');
    const decisionPrioritySelect = decisionCols.has('priority')
      ? 'd.priority'
      : `'MEDIUM' as priority`;
    const pendingDecisions =
      (await queryHelpers.queryAll<any>(
        `
        SELECT d.id, d.title, d.description, d.type as decisionType, d.status, ${decisionPrioritySelect}, d.deadline as dueDate, d.created_at as createdAt,
               p.name as projectName
        FROM decisions d
        LEFT JOIN projects p ON d.project_id = p.id
        WHERE d.organization_id = ?
          AND d.decision_maker_id = ?
          AND lower(coalesce(d.status,'')) IN ('pending','escalated')
        ORDER BY d.created_at DESC
        LIMIT ?
      `,
        [orgId, userId, Math.min(25, limit)]
      )) || [];

    // 3) Unread notifications (owned)
    const notifCols = await getTableColumns('notifications');
    const notifHasRead = notifCols.has('read');
    const notifReadExpr = notifHasRead ? 'COALESCE(read, 0)' : '0';
    const notifPrioritySelect = notifCols.has('priority') ? 'priority' : `'normal' as priority`;
    const notifMessageSelect = notifCols.has('message')
      ? 'message as body'
      : notifCols.has('body')
        ? 'body as body'
        : `'' as body`;
    const notifEntityTypeSelect = notifCols.has('entity_type')
      ? 'entity_type as entityType'
      : notifCols.has('entityType')
        ? 'entityType as entityType'
        : 'NULL as entityType';
    const notifEntityIdSelect = notifCols.has('entity_id')
      ? 'entity_id as entityId'
      : notifCols.has('entityId')
        ? 'entityId as entityId'
        : 'NULL as entityId';

    const unreadNotifications =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          id,
          type,
          title,
          ${notifMessageSelect},
          ${notifPrioritySelect},
          ${notifEntityTypeSelect},
          ${notifEntityIdSelect},
          created_at as createdAt
        FROM notifications
        WHERE user_id = ?
          AND ${notifReadExpr} = 0
        ORDER BY created_at DESC
        LIMIT ?
      `,
        [userId, Math.min(25, limit)]
      )) || [];

    // Anti-spam aggregation (best-effort): group notifications by (type, entityType, entityId) when possible
    const aggregatedNotifications: any[] = [];
    {
      const byKey = new Map<string, any>();
      for (const n of unreadNotifications) {
        const type = String(n.type || '');
        const entityType = n.entityType ? String(n.entityType) : '';
        const entityId = n.entityId ? String(n.entityId) : '';
        const key = entityType && entityId ? `${type}:${entityType}:${entityId}` : `id:${String(n.id)}`;
        const existing = byKey.get(key);
        if (!existing) {
          byKey.set(key, n);
          continue;
        }
        const exTs = new Date(existing.createdAt || 0).getTime();
        const nTs = new Date(n.createdAt || 0).getTime();
        if (nTs > exTs) byKey.set(key, n);
      }
      aggregatedNotifications.push(...Array.from(byKey.values()));
    }

    const items: InboxItem[] = [];

    for (const t of overdueTasks) {
      const key: InboxItemKey = `task:${t.id}`;
      const triaged = triagedMap.get(key);
      const urgency: InboxUrgency = urgencyFromPriority(t.priority);
      const section: InboxSection = 'overdue_sla_breach';
      const receivedAt = t.dueDate ? new Date(t.dueDate).toISOString() : nowIso;
      const dueDate = t.dueDate ? new Date(t.dueDate).toISOString() : undefined;
      items.push({
        id: `inbox-${uuidv4()}`,
        section,
        type: 'escalation',
        title: t.title,
        description: t.description || undefined,
        source: { type: 'system' },
        receivedAt,
        urgency: urgency === 'low' ? 'normal' : urgency, // overdue can't be "low" priority in UI
        dueDate,
        sla: computeSla(nowIso, receivedAt, section, dueDate),
        linkedTaskId: t.id,
        linkedInitiativeId: t.initiativeId || undefined,
        linkedTask: {
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate || undefined,
        },
        triaged: Boolean(triaged),
        triagedAt: triaged?.triagedAt,
        triageAction: triaged?.action,
        triageParams: triaged?.params,
        _key: key,
      });
    }

    for (const t of blockedTasks) {
      const key: InboxItemKey = `task:${t.id}`;
      const triaged = triagedMap.get(key);
      const section: InboxSection = 'blocked_escalations';
      const urgency: InboxUrgency = urgencyFromPriority(t.priority);
      const receivedAt = t.blockedAt || t.updatedAt || t.createdAt || nowIso;
      const dueDate = t.dueDate ? new Date(t.dueDate).toISOString() : undefined;
      const descParts = [
        t.blockedReason ? `Blocked: ${String(t.blockedReason)}` : null,
        t.description ? String(t.description) : null,
      ].filter(Boolean);
      items.push({
        id: `inbox-${uuidv4()}`,
        section,
        type: 'escalation',
        title: t.title,
        description: descParts.length ? descParts.join('\n') : undefined,
        source: { type: 'system' },
        receivedAt,
        urgency: urgency === 'low' ? 'normal' : urgency,
        dueDate,
        sla: computeSla(nowIso, receivedAt, section, dueDate),
        linkedTaskId: t.id,
        linkedDecisionId: t.blockedByDecisionId || undefined,
        linkedInitiativeId: t.initiativeId || undefined,
        linkedTask: {
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate || undefined,
        },
        triaged: Boolean(triaged),
        triagedAt: triaged?.triagedAt,
        triageAction: triaged?.action,
        triageParams: triaged?.params,
        _key: key,
      });
    }

    for (const t of assignedOpenTasks) {
      const key: InboxItemKey = `task:${t.id}`;
      const triaged = triagedMap.get(key);
      const section: InboxSection = 'assigned_tasks';
      const urgency: InboxUrgency = urgencyFromPriority(t.priority);
      const receivedAt = t.updatedAt || t.createdAt || nowIso;
      const dueDate = t.dueDate ? new Date(t.dueDate).toISOString() : undefined;
      items.push({
        id: `inbox-${uuidv4()}`,
        section,
        type: 'new_assignment',
        title: t.title,
        description: t.description || undefined,
        source: { type: 'system' },
        receivedAt,
        urgency,
        dueDate,
        sla: computeSla(nowIso, receivedAt, section, dueDate),
        linkedTaskId: t.id,
        linkedInitiativeId: t.initiativeId || undefined,
        linkedTask: {
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate || undefined,
        },
        triaged: Boolean(triaged),
        triagedAt: triaged?.triagedAt,
        triageAction: triaged?.action,
        triageParams: triaged?.params,
        _key: key,
      });
    }

    for (const d of pendingDecisions) {
      const key: InboxItemKey = `decision:${d.id}`;
      const triaged = triagedMap.get(key);
      const urgency = urgencyFromPriority(d.priority);
      const section: InboxSection = 'decisions_required';
      const receivedAt = d.createdAt || nowIso;
      const dueDate = d.dueDate ? new Date(d.dueDate).toISOString() : undefined;
      items.push({
        id: `inbox-${uuidv4()}`,
        section,
        type: 'decision_request',
        title: d.title,
        description: d.description || undefined,
        source: { type: 'system' },
        receivedAt,
        urgency,
        dueDate,
        sla: computeSla(nowIso, receivedAt, section, dueDate),
        linkedDecisionId: d.id,
        triaged: Boolean(triaged),
        triagedAt: triaged?.triagedAt,
        triageAction: triaged?.action,
        triageParams: triaged?.params,
        _key: key,
      });
    }

    for (const n of aggregatedNotifications) {
      const key: InboxItemKey = `notification:${n.id}`;
      const triaged = triagedMap.get(key);
      const inboxType = mapNotificationToInboxType(n.type);
      const section: InboxSection =
        inboxType === 'review_request'
          ? 'approvals_gates'
          : inboxType === 'decision_request'
            ? 'decisions_required'
            : inboxType === 'escalation'
              ? 'blocked_escalations'
              : inboxType === 'ai_suggestion'
                ? 'ai_insights'
                : inboxType === 'mention'
                  ? 'fyi_mentions'
                  : 'fyi_system';
      const receivedAt = n.createdAt || nowIso;
      const sourceType: 'user' | 'system' | 'ai' =
        inboxType === 'ai_suggestion' ? 'ai'
          : inboxType === 'mention' || inboxType === 'review_request' ? 'user'
            : 'system';
      items.push({
        id: `inbox-${uuidv4()}`,
        section,
        type: inboxType,
        title: n.title || 'Notification',
        description: n.body || undefined,
        source: { type: sourceType },
        receivedAt,
        urgency: urgencyFromPriority(n.priority),
        sla: computeSla(nowIso, receivedAt, section, undefined),
        triaged: Boolean(triaged),
        triagedAt: triaged?.triagedAt,
        triageAction: triaged?.action,
        triageParams: triaged?.params,
        _key: key,
      });
    }

    // ── Enrich items with status, reason, isActionable (N1, N2, N7) ──
    const ACTIONABLE_SECTIONS = new Set<InboxSection>([
      'decisions_required', 'approvals_gates', 'blocked_escalations', 'overdue_sla_breach', 'assigned_tasks',
    ]);
    const ACTIONABLE_TYPES = new Set<InboxItemType>([
      'decision_request', 'review_request', 'escalation', 'new_assignment',
    ]);

    const reasonForSection = (section: InboxSection, type: InboxItemType): string => {
      if (section === 'overdue_sla_breach') return 'Task is overdue (assigned to you)';
      if (section === 'blocked_escalations') return 'Task is blocked (assigned to you)';
      if (section === 'decisions_required') return 'Decision pending (you are decision maker)';
      if (section === 'approvals_gates') return 'Approval/review requested for you';
      if (section === 'assigned_tasks') return 'Task assigned to you';
      if (type === 'mention') return 'You were mentioned';
      if (type === 'ai_suggestion') return 'AI insight relevant to your work';
      if (section === 'fyi_system') return 'System notification';
      if (section === 'fyi_mentions') return 'You were mentioned or tagged';
      if (section === 'ai_insights') return 'AI signal for your review';
      return 'Notification for your awareness';
    };

    for (const item of items) {
      // N1: Item status (open by default; triaged items get their action as status)
      if (item.triaged) {
        const act = item.triageAction;
        if (act === 'done') item.itemStatus = 'done';
        else if (act === 'save') item.itemStatus = 'saved';
        else if (act === 'dismiss' || act === 'archive' || act === 'reject') item.itemStatus = 'dismissed';
        else item.itemStatus = 'open';
      } else {
        item.itemStatus = 'open';
      }

      // N7: Reason
      item.reason = reasonForSection(item.section, item.type);

      // N2: Is actionable?
      item.isActionable = ACTIONABLE_SECTIONS.has(item.section) || ACTIONABLE_TYPES.has(item.type);

      // C1: Apply heuristic auto-triage suggestions
      if (!item.triaged) {
        const suggestion = suggestTriageAction(item);
        if (suggestion.action) {
          item.suggestedAction = suggestion.action;
          item.suggestedReason = suggestion.reason;
        }
      }
    }

    // Return all items (not just non-triaged) so frontend can show Done/Saved/Snoozed views
    const openItems = items.filter((i) => i.itemStatus === 'open');
    const doneItems = items.filter((i) => i.itemStatus === 'done');
    const savedItems = items.filter((i) => i.itemStatus === 'saved');
    const dismissedItems = items.filter((i) => i.itemStatus === 'dismissed');

    // Summary
    const summary = {
      total: openItems.length,
      critical: openItems.filter((i) => i.urgency === 'critical').length,
      newToday: openItems.filter((i) => i.receivedAt.slice(0, 10) === today).length,
      actionRequired: openItems.filter((i) => i.isActionable).length,
      counts: {
        open: openItems.length,
        done: doneItems.length,
        saved: savedItems.length,
        dismissed: dismissedItems.length,
      },
    };

    // F3: Smart composite sorting — urgency × SLA breach × section priority × recency
    const urgencyRank: Record<InboxUrgency, number> = { critical: 0, high: 1, normal: 2, low: 3 };
    const sectionRank: Record<InboxSection, number> = {
      overdue_sla_breach: 0,
      blocked_escalations: 1,
      decisions_required: 2,
      approvals_gates: 3,
      assigned_tasks: 4,
      ai_insights: 5,
      fyi_mentions: 6,
      fyi_system: 7,
      other: 8,
    };
    const smartSort = (arr: InboxItem[]) => {
      arr.sort((a, b) => {
        const aBreach = a.sla?.isBreached ? 0 : 1;
        const bBreach = b.sla?.isBreached ? 0 : 1;
        if (aBreach !== bBreach) return aBreach - bBreach;
        const ra = urgencyRank[a.urgency];
        const rb = urgencyRank[b.urgency];
        if (ra !== rb) return ra - rb;
        const sa = sectionRank[a.section] ?? 8;
        const sb = sectionRank[b.section] ?? 8;
        if (sa !== sb) return sa - sb;
        return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
      });
      return arr;
    };

    smartSort(openItems);
    doneItems.sort((a, b) => new Date(b.triagedAt || b.receivedAt).getTime() - new Date(a.triagedAt || a.receivedAt).getTime());
    savedItems.sort((a, b) => new Date(b.triagedAt || b.receivedAt).getTime() - new Date(a.triagedAt || a.receivedAt).getTime());

    // Query filter: ?status=open|done|saved|dismissed|all (default: open)
    const statusFilter = (req.query.status as string) || 'open';
    let resultItems: InboxItem[];
    if (statusFilter === 'all') resultItems = items;
    else if (statusFilter === 'done') resultItems = doneItems;
    else if (statusFilter === 'saved') resultItems = savedItems;
    else if (statusFilter === 'dismissed') resultItems = dismissedItems;
    else resultItems = openItems;

    res.json({ summary, items: resultItems.slice(0, limit) });
  })
);

/**
 * POST /api/my-work/inbox/:id/triage
 * Body: { action, params }
 */
router.post(
  '/inbox/:id/triage',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_work_inbox_triage', 'my_work_focus_state']))) return;

    const action = String(req.body?.action || '') as TriageAction;
    const params = (req.body?.params || undefined) as Record<string, unknown> | undefined;
    const itemKey = String(
      req.body?.itemKey || req.body?._key || req.query.itemKey || ''
    ) as InboxItemKey;

    const VALID_TRIAGE_ACTIONS: TriageAction[] = [
      'accept_today', 'accept_week', 'accept_later', 'schedule', 'delegate',
      'archive', 'dismiss', 'done', 'save', 'reject',
    ];
    if (!action || !VALID_TRIAGE_ACTIONS.includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    if (!itemKey || !itemKey.includes(':')) {
      return res.status(400).json({
        error: 'Missing itemKey (expected task:<id> | decision:<id> | notification:<id>)',
      });
    }

    const triagedAt = new Date().toISOString();
    await queryHelpers.queryRun(
      `INSERT INTO my_work_inbox_triage (user_id, item_key, action, params_json, triaged_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (user_id, item_key) DO UPDATE SET
         action = excluded.action,
         params_json = excluded.params_json,
         triaged_at = excluded.triaged_at`,
      [userId, itemKey, action, params ? JSON.stringify(params) : null, triagedAt]
    );

    // Side-effects (minimal, real)
    const [kind, rawId] = itemKey.split(':') as [string, string];
    if (action === 'accept_today') {
      // Add to focus "today"
      await queryHelpers.queryRun(
        `INSERT INTO my_work_focus_state (user_id, focus_date, item_key, column_name, position, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, focus_date, item_key) DO UPDATE SET
           column_name = excluded.column_name,
           position = excluded.position,
           updated_at = excluded.updated_at`,
        [userId, todayIsoDate(), itemKey, 'today', 0, triagedAt]
      );
    }

    if (action === 'schedule') {
      const date = typeof params?.date === 'string' ? params.date : undefined;
      if (date && kind === 'task') {
        await queryHelpers.queryRun(
          `UPDATE tasks SET due_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
          [date, rawId, orgId]
        );
      }
      if (date && kind === 'decision') {
        await queryHelpers.queryRun(
          `UPDATE decisions SET deadline = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
          [date, rawId, orgId]
        );
      }
    }

    if (action === 'delegate') {
      const delegateUserId = typeof params?.userId === 'string' ? params.userId : undefined;
      if (delegateUserId && kind === 'task') {
        await queryHelpers.queryRun(
          `UPDATE tasks SET assignee_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
          [delegateUserId, rawId, orgId]
        );
        await NotificationService.send({
          userId: delegateUserId,
          organizationId: orgId,
          type: 'TASK_ASSIGNED',
          title: 'Task delegated to you',
          body: 'A task was delegated to you from My Work inbox.',
          entityType: 'task',
          entityId: rawId,
          priority: 'normal',
        });
      }
      if (delegateUserId && kind === 'decision') {
        await queryHelpers.queryRun(
          `UPDATE decisions SET decision_maker_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
          [delegateUserId, rawId, orgId]
        );
        await NotificationService.send({
          userId: delegateUserId,
          organizationId: orgId,
          type: 'DECISION_DELEGATED',
          title: 'Decision delegated to you',
          body: 'A decision was delegated to you from My Work inbox.',
          entityType: 'decision',
          entityId: rawId,
          priority: 'high',
        });
      }
    }

    // N11: Route to Focus — accept_week / accept_later
    if (action === 'accept_week') {
      await queryHelpers.queryRun(
        `INSERT INTO my_work_focus_state (user_id, focus_date, item_key, column_name, position, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, focus_date, item_key) DO UPDATE SET
           column_name = excluded.column_name,
           position = excluded.position,
           updated_at = excluded.updated_at`,
        [userId, todayIsoDate(), itemKey, 'thisWeek', 0, triagedAt]
      );
    }
    if (action === 'accept_later') {
      await queryHelpers.queryRun(
        `INSERT INTO my_work_focus_state (user_id, focus_date, item_key, column_name, position, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, focus_date, item_key) DO UPDATE SET
           column_name = excluded.column_name,
           position = excluded.position,
           updated_at = excluded.updated_at`,
        [userId, todayIsoDate(), itemKey, 'later', 0, triagedAt]
      );
    }

    // N8: Archive/Dismiss unified
    if ((action === 'archive' || action === 'dismiss') && kind === 'notification') {
      try {
        await NotificationService.markAsRead(rawId, userId);
      } catch (_e) {
        // ignore
      }
    }

    // N1: Done — mark source task as completed if possible
    if (action === 'done' && kind === 'task') {
      await queryHelpers.queryRun(
        `UPDATE tasks SET status = 'Completed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`,
        [rawId, orgId]
      );
    }

    res.json({ success: true, triagedAt });
  })
);

/**
 * POST /api/my-work/inbox/bulk-triage
 * Body: { itemIds: string[], action, params?, itemKeys?: string[] }
 */
router.post(
  '/inbox/bulk-triage',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId } = identity;
    if (!(await requireTables(res, ['my_work_inbox_triage']))) return;

    const action = String(req.body?.action || '') as TriageAction;
    const params = (req.body?.params || undefined) as Record<string, unknown> | undefined;
    const itemKeys = (req.body?.itemKeys || req.body?.item_keys || []) as string[];

    const VALID_BULK: TriageAction[] = [
      'accept_today', 'accept_week', 'accept_later', 'schedule', 'delegate',
      'archive', 'dismiss', 'done', 'save', 'reject',
    ];
    if (!action || !VALID_BULK.includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    if (!Array.isArray(itemKeys) || itemKeys.length === 0) {
      return res.status(400).json({ error: 'Missing itemKeys[]' });
    }

    const triagedAt = new Date().toISOString();
    for (const key of itemKeys) {
      await queryHelpers.queryRun(
        `INSERT INTO my_work_inbox_triage (user_id, item_key, action, params_json, triaged_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (user_id, item_key) DO UPDATE SET
           action = excluded.action,
           params_json = excluded.params_json,
           triaged_at = excluded.triaged_at`,
        [userId, String(key), action, params ? JSON.stringify(params) : null, triagedAt]
      );
    }

    res.json({ success: true, count: itemKeys.length, triagedAt });
  })
);

/**
 * PUT /api/my-work/focus/move
 * Body: { itemId: string, column: 'today'|'thisWeek'|'later' }
 */
router.put(
  '/focus/move',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId } = identity;
    if (!(await requireTables(res, ['my_work_focus_state']))) return;

    const itemId = String(req.body?.itemId || '');
    const column = String(req.body?.column || '') as FocusColumn;
    if (!itemId || !['today', 'thisWeek', 'later'].includes(column)) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    await queryHelpers.queryRun(
      `INSERT INTO my_work_focus_state (user_id, focus_date, item_key, column_name, position, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, focus_date, item_key) DO UPDATE SET
         column_name = excluded.column_name,
         position = excluded.position,
         updated_at = excluded.updated_at`,
      [userId, todayIsoDate(), itemId, column, 0, new Date().toISOString()]
    );

    res.json({ success: true });
  })
);

/**
 * PUT /api/my-work/focus/reorder
 * Body: { itemId: string, column: 'today'|'thisWeek'|'later', position: number }
 */
router.put(
  '/focus/reorder',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId } = identity;
    if (!(await requireTables(res, ['my_work_focus_state']))) return;

    const itemId = String(req.body?.itemId || '');
    const column = String(req.body?.column || '') as FocusColumn;
    const position = Number(req.body?.position || 0);
    if (!itemId || !['today', 'thisWeek', 'later'].includes(column) || !Number.isFinite(position)) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    await queryHelpers.queryRun(
      `INSERT INTO my_work_focus_state (user_id, focus_date, item_key, column_name, position, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, focus_date, item_key) DO UPDATE SET
         column_name = excluded.column_name,
         position = excluded.position,
         updated_at = excluded.updated_at`,
      [userId, todayIsoDate(), itemId, column, position, new Date().toISOString()]
    );

    res.json({ success: true });
  })
);

/**
 * GET /api/my-work/focus/state?date=YYYY-MM-DD
 * Returns persisted focus board state for a user/date.
 */
router.get(
  '/focus/state',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId } = identity;
    if (!(await requireTables(res, ['my_work_focus_state']))) return;

    const focusDate = req.query.date ? String(req.query.date) : todayIsoDate();
    const rows =
      (await queryHelpers.queryAll<{
        item_key: string;
        column_name: string;
        position: number;
        updated_at: string;
      }>(
        `SELECT item_key, column_name, position, updated_at
         FROM my_work_focus_state
         WHERE user_id = ? AND focus_date = ?
         ORDER BY column_name ASC, position ASC, updated_at DESC`,
        [userId, focusDate]
      )) || [];

    res.json({
      date: focusDate,
      items: rows.map((r) => ({
        itemKey: r.item_key,
        column: r.column_name as FocusColumn,
        position: Number(r.position || 0),
        updatedAt: r.updated_at,
      })),
    });
  })
);

/**
 * DELETE /api/my-work/focus/item?itemId=task:<id>|decision:<id>
 * Removes an item from focus state for the given day.
 */
router.delete(
  '/focus/item',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId } = identity;
    if (!(await requireTables(res, ['my_work_focus_state']))) return;

    const itemId = String(req.query.itemId || req.body?.itemId || '');
    const focusDate = req.query.date ? String(req.query.date) : todayIsoDate();
    if (!itemId || !itemId.includes(':')) {
      return res.status(400).json({ error: 'Missing itemId' });
    }

    await queryHelpers.queryRun(
      `DELETE FROM my_work_focus_state WHERE user_id = ? AND focus_date = ? AND item_key = ?`,
      [userId, focusDate, itemId]
    );

    res.json({ success: true });
  })
);

/**
 * GET /api/my-work/stats?period=week
 * Aggregates for ExecutiveDashboard — real trend + previous period comparison
 */
router.get(
  '/stats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    const period = String(req.query.period || 'week');
    const days = period === 'month' ? 30 : 7;
    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const prevSinceIso = new Date(Date.now() - days * 2 * 24 * 60 * 60 * 1000).toISOString();
    const today = todayIsoDate();

    // --- Current period ---
    const totals = await queryHelpers.queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM tasks WHERE organization_id = ? AND assignee_id = ? AND created_at >= ?`,
      [orgId, userId, sinceIso]
    );
    const completed = await queryHelpers.queryOne<{ completed: number }>(
      `SELECT COUNT(*) as completed FROM tasks
       WHERE organization_id = ? AND assignee_id = ? AND completed_at IS NOT NULL AND completed_at >= ?`,
      [orgId, userId, sinceIso]
    );
    const overdue = await queryHelpers.queryOne<{ overdue: number }>(
      `SELECT COUNT(*) as overdue FROM tasks
       WHERE organization_id = ? AND assignee_id = ?
         AND due_date IS NOT NULL AND date(due_date) < date(?)
         AND lower(coalesce(status,'')) NOT IN ('done','completed','validated')`,
      [orgId, userId, today]
    );
    const onTime = await queryHelpers.queryOne<{ onTime: number; totalDone: number }>(
      `SELECT
         SUM(CASE WHEN due_date IS NOT NULL AND completed_at IS NOT NULL AND completed_at <= due_date THEN 1 ELSE 0 END) as onTime,
         SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) as totalDone
       FROM tasks
       WHERE organization_id = ? AND assignee_id = ? AND completed_at IS NOT NULL AND completed_at >= ?`,
      [orgId, userId, sinceIso]
    );

    // --- Previous period (for trend calculation) ---
    const prevTotals = await queryHelpers.queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM tasks WHERE organization_id = ? AND assignee_id = ? AND created_at >= ? AND created_at < ?`,
      [orgId, userId, prevSinceIso, sinceIso]
    );
    const prevCompleted = await queryHelpers.queryOne<{ completed: number }>(
      `SELECT COUNT(*) as completed FROM tasks
       WHERE organization_id = ? AND assignee_id = ? AND completed_at IS NOT NULL AND completed_at >= ? AND completed_at < ?`,
      [orgId, userId, prevSinceIso, sinceIso]
    );
    const prevOnTime = await queryHelpers.queryOne<{ onTime: number; totalDone: number }>(
      `SELECT
         SUM(CASE WHEN due_date IS NOT NULL AND completed_at IS NOT NULL AND completed_at <= due_date THEN 1 ELSE 0 END) as onTime,
         SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) as totalDone
       FROM tasks
       WHERE organization_id = ? AND assignee_id = ? AND completed_at IS NOT NULL AND completed_at >= ? AND completed_at < ?`,
      [orgId, userId, prevSinceIso, sinceIso]
    );

    // --- Escalations count ---
    const escalations = await queryHelpers.queryOne<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM decisions
       WHERE organization_id = ? AND lower(coalesce(status,'')) = 'escalated'`,
      [orgId]
    );

    // --- Blocked tasks count ---
    const blocked = await queryHelpers.queryOne<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM tasks
       WHERE organization_id = ? AND assignee_id = ?
         AND (lower(coalesce(status,'')) = 'blocked' OR blocked_reason IS NOT NULL OR blocked_by_decision_id IS NOT NULL)
         AND lower(coalesce(status,'')) NOT IN ('done','completed','validated')`,
      [orgId, userId]
    );

    const total = Number((totals as any)?.total || 0);
    const completedCount = Number((completed as any)?.completed || 0);
    const overdueCount = Number((overdue as any)?.overdue || 0);
    const totalDone = Number((onTime as any)?.totalDone || 0);
    const onTimeRate =
      totalDone > 0 ? Math.round((Number((onTime as any)?.onTime || 0) / totalDone) * 100) : 0;

    const prevTotal = Number((prevTotals as any)?.total || 0);
    const prevCompletedCount = Number((prevCompleted as any)?.completed || 0);
    const prevTotalDone = Number((prevOnTime as any)?.totalDone || 0);
    const prevOnTimeRate =
      prevTotalDone > 0
        ? Math.round((Number((prevOnTime as any)?.onTime || 0) / prevTotalDone) * 100)
        : 0;

    const currentScore = total > 0 ? (completedCount / total) * 100 : 0;
    const prevScore = prevTotal > 0 ? (prevCompletedCount / prevTotal) * 100 : 0;
    const trend: 'up' | 'down' | 'stable' =
      currentScore > prevScore + 5 ? 'up' : currentScore < prevScore - 5 ? 'down' : 'stable';

    res.json({
      total,
      completed: completedCount,
      onTimeRate,
      trend,
      byStatus: {
        overdue: overdueCount,
        blocked: Number((blocked as any)?.cnt || 0),
        escalated: Number((escalations as any)?.cnt || 0),
      },
      previous: {
        total: prevTotal,
        completed: prevCompletedCount,
        onTimeRate: prevOnTimeRate,
      },
    });
  })
);

/**
 * GET /api/my-work/team-workload
 * Simple team rollup for ExecutiveDashboard (no mock data)
 */
router.get(
  '/team-workload',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { orgId } = identity;

    // Basic list of active users in org
    const users =
      (await queryHelpers.queryAll<any>(
        `SELECT id, first_name as firstName, last_name as lastName, email FROM users WHERE organization_id = ? LIMIT 50`,
        [orgId]
      )) || [];

    // For each user: count assigned open tasks + completed last 7d
    const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const rows: any[] = [];
    for (const u of users) {
      const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || u.id;
      const tasksAssigned = await queryHelpers.queryOne<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM tasks
         WHERE organization_id = ? AND assignee_id = ? AND lower(coalesce(status,'')) NOT IN ('done','completed','validated')`,
        [orgId, u.id]
      );
      const tasksCompleted = await queryHelpers.queryOne<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM tasks
         WHERE organization_id = ? AND assignee_id = ? AND completed_at IS NOT NULL AND completed_at >= ?`,
        [orgId, u.id, sinceIso]
      );
      const openCnt = Number((tasksAssigned as any)?.cnt || 0);
      const doneCnt = Number((tasksCompleted as any)?.cnt || 0);

      // Capacity heuristic (real data not available here): use 80 as neutral baseline
      // NOTE: This is not mock business data, it's a UI capacity default until a capacity model exists.
      const capacity = 80;
      rows.push({
        id: u.id,
        name,
        capacity: Math.min(140, Math.max(0, capacity + openCnt * 2)),
        tasksAssigned: openCnt,
        tasksCompleted: doneCnt,
      });
    }

    res.json(rows);
  })
);

/**
 * T012 (V2) — Contextual Intelligence Feed (Signals)
 * Backend-driven feed derived from notifications + persisted user prefs (mute/snooze/dismiss).
 */
const isAiSignalNotification = (nType?: string | null) => {
  const t = String(nType || '').toUpperCase();
  return t.includes('AI') || t.includes('RECOMMENDATION') || t.includes('INSIGHT') || t.includes('RISK');
};

const snoozePresetToUntil = (preset: string): string => {
  const now = Date.now();
  const p = String(preset || '').toLowerCase();
  if (p === '1h') return new Date(now + 60 * 60 * 1000).toISOString();
  if (p === '4h') return new Date(now + 4 * 60 * 60 * 1000).toISOString();
  if (p === 'tomorrow') {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }
  if (p === 'week' || p === 'next_week') return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
  return new Date(now + 24 * 60 * 60 * 1000).toISOString();
};

router.get(
  '/signals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (
      !(await requireTables(res, [
        'my_work_signal_prefs',
        'my_work_signal_snoozes',
        'my_work_signal_dismissals',
        'notifications',
      ]))
    )
      return;

    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;
    const projectId = req.query.projectId ? String(req.query.projectId) : null;
    const nowIso = new Date().toISOString();

    const prefs = await queryHelpers.queryOne<{ muted_types_json?: string }>(
      `SELECT muted_types_json FROM my_work_signal_prefs WHERE user_id = ? AND organization_id = ? LIMIT 1`,
      [userId, orgId]
    );
    const mutedTypes = parseTagsArray((prefs as any)?.muted_types_json).map((x) => x.toUpperCase());
    const mutedSet = new Set(mutedTypes);

    const snoozedRows =
      (await queryHelpers.queryAll<{ signal_key: string }>(
        `SELECT signal_key FROM my_work_signal_snoozes WHERE user_id = ? AND snoozed_until > ?`,
        [userId, nowIso]
      )) || [];
    const snoozedSet = new Set(snoozedRows.map((r) => String(r.signal_key)));

    const dismissedRows =
      (await queryHelpers.queryAll<{ signal_key: string }>(
        `SELECT signal_key FROM my_work_signal_dismissals WHERE user_id = ?`,
        [userId]
      )) || [];
    const dismissedSet = new Set(dismissedRows.map((r) => String(r.signal_key)));

    const notifCols = await getTableColumns('notifications');
    const notifHasRead = notifCols.has('read');
    const notifReadExpr = notifHasRead ? 'COALESCE(read, 0)' : '0';
    const notifMessageSelect = notifCols.has('message')
      ? 'message as body'
      : notifCols.has('body')
        ? 'body as body'
        : `'' as body`;
    const notifEntityTypeSelect = notifCols.has('entity_type')
      ? 'entity_type as entityType'
      : notifCols.has('entityType')
        ? 'entityType as entityType'
        : 'NULL as entityType';
    const notifEntityIdSelect = notifCols.has('entity_id')
      ? 'entity_id as entityId'
      : notifCols.has('entityId')
        ? 'entityId as entityId'
        : 'NULL as entityId';
    const notifProjectIdSelect = notifCols.has('project_id')
      ? 'project_id as projectId'
      : notifCols.has('projectId')
        ? 'projectId as projectId'
        : 'NULL as projectId';
    const notifProjectNameSelect = notifCols.has('project_name')
      ? 'project_name as projectName'
      : notifCols.has('projectName')
        ? 'projectName as projectName'
        : 'NULL as projectName';
    const notifSeveritySelect = notifCols.has('severity')
      ? 'severity'
      : `'INFO' as severity`;

    const rows =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          id,
          type,
          title,
          ${notifMessageSelect},
          ${notifSeveritySelect},
          ${notifEntityTypeSelect},
          ${notifEntityIdSelect},
          ${notifProjectIdSelect},
          ${notifProjectNameSelect},
          created_at as createdAt
        FROM notifications
        WHERE user_id = ?
          AND ${notifReadExpr} = 0
        ORDER BY created_at DESC
        LIMIT 200
      `,
        [userId]
      )) || [];

    // Aggregate + filter
    const byKey = new Map<string, any>();
    for (const n of rows) {
      if (!isAiSignalNotification(n.type)) continue;
      const typeUp = String(n.type || '').toUpperCase();
      if (mutedSet.has(typeUp)) continue;

      const key = `notification:${String(n.id)}`;
      if (snoozedSet.has(key) || dismissedSet.has(key)) continue;
      if (projectId && n.projectId && String(n.projectId) !== String(projectId)) continue;

      const aggKey =
        n.entityType && n.entityId
          ? `${typeUp}:${String(n.entityType)}:${String(n.entityId)}`
          : key;
      const existing = byKey.get(aggKey);
      if (!existing) {
        byKey.set(aggKey, { ...n, key });
        continue;
      }
      const exTs = new Date(existing.createdAt || 0).getTime();
      const nTs = new Date(n.createdAt || 0).getTime();
      if (nTs > exTs) byKey.set(aggKey, { ...n, key });
    }

    const signals = Array.from(byKey.values())
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, limit)
      .map((n) => ({
        key: String(n.key),
        type: String(n.type || ''),
        title: String(n.title || 'Signal'),
        body: String(n.body || ''),
        severity: String(n.severity || 'INFO'),
        createdAt: n.createdAt || nowIso,
        projectId: n.projectId || null,
        projectName: n.projectName || null,
        entityType: n.entityType || null,
        entityId: n.entityId || null,
      }));

    res.json({ signals, mutedTypes });
  })
);

router.post(
  '/signals/mute-type',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_work_signal_prefs']))) return;

    const type = String(req.body?.type || '').trim().toUpperCase();
    if (!type) return res.status(400).json({ error: 'type is required' });

    const existing = await queryHelpers.queryOne<any>(
      `SELECT muted_types_json FROM my_work_signal_prefs WHERE user_id = ? AND organization_id = ? LIMIT 1`,
      [userId, orgId]
    );
    const current = parseTagsArray(existing?.muted_types_json).map((x) => x.toUpperCase());
    const next = Array.from(new Set([...current, type]));

    await queryHelpers.queryRun(
      `INSERT OR REPLACE INTO my_work_signal_prefs (user_id, organization_id, muted_types_json, quiet_hours_json, updated_at)
       VALUES (?, ?, ?, COALESCE((SELECT quiet_hours_json FROM my_work_signal_prefs WHERE user_id = ? AND organization_id = ?), '{}'), ?)`,
      [userId, orgId, JSON.stringify(next), userId, orgId, new Date().toISOString()]
    );

    res.json({ success: true, mutedTypes: next });
  })
);

router.post(
  '/signals/:key/snooze',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId } = identity;
    if (!(await requireTables(res, ['my_work_signal_snoozes']))) return;

    const key = String(req.params.key || '').trim();
    if (!key) return res.status(400).json({ error: 'key is required' });

    const until =
      typeof req.body?.until === 'string' && req.body.until.trim()
        ? String(req.body.until).trim()
        : snoozePresetToUntil(String(req.body?.preset || 'tomorrow'));

    await queryHelpers.queryRun(
      `INSERT OR REPLACE INTO my_work_signal_snoozes (user_id, signal_key, snoozed_until, created_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [userId, key, until]
    );
    res.json({ success: true, snoozedUntil: until });
  })
);

router.post(
  '/signals/:key/dismiss',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId } = identity;
    if (!(await requireTables(res, ['my_work_signal_dismissals']))) return;

    const key = String(req.params.key || '').trim();
    if (!key) return res.status(400).json({ error: 'key is required' });

    const dismissedAt = new Date().toISOString();
    await queryHelpers.queryRun(
      `INSERT OR REPLACE INTO my_work_signal_dismissals (user_id, signal_key, dismissed_at)
       VALUES (?, ?, ?)`,
      [userId, key, dismissedAt]
    );

    // If this is a notification-backed signal, mark as read as well.
    if (key.startsWith('notification:')) {
      const notifId = key.replace(/^notification:/, '');
      try {
        await NotificationService.markAsRead(notifId, userId);
      } catch {
        // ignore
      }
    }

    res.json({ success: true, dismissedAt });
  })
);

/**
 * T009 (V2) — My Ideas (private per-user repository)
 */
router.get(
  '/my-ideas',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas']))) return;

    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 200;
    const q = req.query.q ? String(req.query.q).trim().toLowerCase() : '';
    const tag = req.query.tag ? String(req.query.tag).trim().toLowerCase() : '';

    const params: any[] = [userId, orgId];
    let whereExtra = '';
    if (q) {
      whereExtra += " AND (lower(coalesce(title,'')) LIKE ? OR lower(coalesce(body,'')) LIKE ?)";
      params.push(`%${q}%`, `%${q}%`);
    }
    if (tag) {
      whereExtra += " AND lower(coalesce(tags,'')) LIKE ?";
      params.push(`%${tag}%`);
    }
    params.push(limit);

    const rows =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          id,
          title,
          body,
          tags,
          source_type as "sourceType",
          source_conversation_id as "sourceConversationId",
          source_message_id as "sourceMessageId",
          stage,
          potential,
          complexity,
          area,
          priority,
          branch,
          promoted_to as "promotedTo",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM my_ideas
        WHERE user_id = ? AND organization_id = ?
          ${whereExtra}
        ORDER BY created_at DESC
        LIMIT ?
      `,
        params
      )) || [];

    res.json(rows.map((r: any) => ({ ...r, tags: parseTagsArray(r?.tags) })));
  })
);

router.get(
  '/my-ideas/suggest',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas']))) return;

    const q = req.query.q ? String(req.query.q).trim().toLowerCase() : '';
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 5;

    const params: any[] = [userId, orgId];
    let whereExtra = '';
    if (q) {
      whereExtra += " AND (lower(coalesce(title,'')) LIKE ? OR lower(coalesce(body,'')) LIKE ?)";
      params.push(`%${q}%`, `%${q}%`);
    }
    params.push(limit);

    const rows =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          id,
          title,
          body,
          tags,
          created_at as "createdAt"
        FROM my_ideas
        WHERE user_id = ? AND organization_id = ?
          ${whereExtra}
        ORDER BY created_at DESC
        LIMIT ?
      `,
        params
      )) || [];

    res.json(rows.map((r: any) => ({ ...r, tags: parseTagsArray(r?.tags) })));
  })
);

router.post(
  '/my-ideas',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas']))) return;

    const title = String(req.body?.title || '').trim();
    if (!title) {
      res.status(400).json({ error: 'title is required' });
      return;
    }

    const body = typeof req.body?.body === 'string' ? req.body.body : null;
    const tags = parseTagsArray(req.body?.tags);
    const sourceType = req.body?.sourceType ? String(req.body.sourceType) : null;
    const sourceConversationId = req.body?.sourceConversationId
      ? String(req.body.sourceConversationId)
      : null;
    const sourceMessageId = req.body?.sourceMessageId ? String(req.body.sourceMessageId) : null;

    const id = uuidv4();
    await queryHelpers.queryRun(
      `
      INSERT INTO my_ideas (
        id, user_id, organization_id, title, body, tags, source_type, source_conversation_id, source_message_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        id,
        userId,
        orgId,
        title,
        body,
        JSON.stringify(tags),
        sourceType,
        sourceConversationId,
        sourceMessageId,
      ]
    );

    const row = await queryHelpers.queryOne<any>(
      `
      SELECT
        id,
        title,
        body,
        tags,
        source_type as "sourceType",
        source_conversation_id as "sourceConversationId",
        source_message_id as "sourceMessageId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM my_ideas
      WHERE id = ? AND user_id = ? AND organization_id = ?
      LIMIT 1
    `,
      [id, userId, orgId]
    );

    res.status(201).json({ ...row, tags: parseTagsArray((row as any)?.tags) });
  })
);

router.get(
  '/my-ideas/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas']))) return;

    const id = String(req.params.id || '').trim();
    const row = await queryHelpers.queryOne<any>(
      `
      SELECT
        id,
        title,
        body,
        tags,
        source_type as "sourceType",
        source_conversation_id as "sourceConversationId",
        source_message_id as "sourceMessageId",
        stage,
        seed_text as "seedText",
        ai_expansion as "aiExpansion",
        research_data as "researchData",
        creative_proposals as "creativeProposals",
        summary_data as "summaryData",
        potential,
        complexity,
        area,
        priority,
        branch,
        promoted_to as "promotedTo",
        promoted_entity_id as "promotedEntityId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM my_ideas
      WHERE id = ? AND user_id = ? AND organization_id = ?
      LIMIT 1
    `,
      [id, userId, orgId]
    );

    if (!row) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    res.json({ ...row, tags: parseTagsArray((row as any)?.tags) });
  })
);

router.put(
  '/my-ideas/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas']))) return;

    const id = String(req.params.id || '').trim();
    const existing = await queryHelpers.queryOne<any>(
      `SELECT id FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [id, userId, orgId]
    );
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const setParts: string[] = [];
    const params: any[] = [];

    const set = (col: string, val: any) => {
      setParts.push(`${col} = ?`);
      params.push(val);
    };

    if (typeof req.body?.title === 'string') set('title', String(req.body.title).trim());
    if (typeof req.body?.body === 'string') set('body', req.body.body);
    if (req.body?.tags !== undefined) set('tags', JSON.stringify(parseTagsArray(req.body.tags)));
    if (typeof req.body?.branch === 'string') set('branch', req.body.branch);
    if (typeof req.body?.area === 'string') set('area', req.body.area);
    if (typeof req.body?.priority === 'number') set('priority', Math.max(0, Math.min(100, req.body.priority)));
    if (typeof req.body?.stage === 'string') set('stage', req.body.stage);

    if (setParts.length === 0) {
      const row = await queryHelpers.queryOne<any>(
        `
        SELECT
          id,
          title,
          body,
          tags,
          source_type as "sourceType",
          source_conversation_id as "sourceConversationId",
          source_message_id as "sourceMessageId",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM my_ideas
        WHERE id = ? AND user_id = ? AND organization_id = ?
        LIMIT 1
      `,
        [id, userId, orgId]
      );
      res.json({ ...row, tags: parseTagsArray((row as any)?.tags) });
      return;
    }

    setParts.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id, userId, orgId);
    await queryHelpers.queryRun(
      `UPDATE my_ideas SET ${setParts.join(', ')} WHERE id = ? AND user_id = ? AND organization_id = ?`,
      params
    );

    const row = await queryHelpers.queryOne<any>(
      `
      SELECT
        id,
        title,
        body,
        tags,
        source_type as "sourceType",
        source_conversation_id as "sourceConversationId",
        source_message_id as "sourceMessageId",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM my_ideas
      WHERE id = ? AND user_id = ? AND organization_id = ?
      LIMIT 1
    `,
      [id, userId, orgId]
    );

    res.json({ ...row, tags: parseTagsArray((row as any)?.tags) });
  })
);

router.delete(
  '/my-ideas/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas']))) return;

    const id = String(req.params.id || '').trim();
    await queryHelpers.queryRun(
      `DELETE FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ?`,
      [id, userId, orgId]
    );
    res.status(204).send();
  })
);

// ============================================================================
// T009 Enhancement — My Ideas Mind Map Edges (persistent relationships)
// ============================================================================

/**
 * GET /api/my-work/my-ideas/:id/edges
 * Special-case: :id = 'all' returns all edges for the user.
 */
router.get(
  '/my-ideas/:id/edges',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas', 'my_idea_edges']))) return;

    const id = String(req.params.id || '').trim();
    const kind = req.query.kind ? String(req.query.kind).trim() : '';

    const params: any[] = [userId, orgId];
    let whereExtra = '';

    if (id && id !== 'all') {
      whereExtra += ' AND (source_idea_id = ? OR target_idea_id = ?)';
      params.push(id, id);
    }
    if (kind) {
      whereExtra += ' AND kind = ?';
      params.push(kind);
    }

    const rows =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          id,
          source_idea_id as "sourceIdeaId",
          target_idea_id as "targetIdeaId",
          kind,
          created_at as "createdAt"
        FROM my_idea_edges
        WHERE user_id = ? AND organization_id = ?
          ${whereExtra}
        ORDER BY created_at DESC
      `,
        params
      )) || [];

    res.json({ edges: rows });
  })
);

/**
 * POST /api/my-work/my-ideas/:id/edges
 * Body: { targetIdeaId: string, kind?: string }
 */
router.post(
  '/my-ideas/:id/edges',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas', 'my_idea_edges']))) return;

    const sourceIdeaId = String(req.params.id || '').trim();
    const targetIdeaId = String(req.body?.targetIdeaId || req.body?.target_idea_id || '').trim();
    const kind = String(req.body?.kind || 'relates_to').trim() || 'relates_to';

    if (!sourceIdeaId || sourceIdeaId === 'all') {
      return res.status(400).json({ error: 'Invalid source idea id' });
    }
    if (!targetIdeaId) {
      return res.status(400).json({ error: 'targetIdeaId is required' });
    }
    if (sourceIdeaId === targetIdeaId) {
      return res.status(400).json({ error: 'Cannot connect idea to itself' });
    }

    const sourceOk = await queryHelpers.queryOne<any>(
      `SELECT id FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [sourceIdeaId, userId, orgId]
    );
    if (!sourceOk) return res.status(404).json({ error: 'Source idea not found' });

    const targetOk = await queryHelpers.queryOne<any>(
      `SELECT id FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [targetIdeaId, userId, orgId]
    );
    if (!targetOk) return res.status(404).json({ error: 'Target idea not found' });

    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO my_idea_edges (id, user_id, organization_id, source_idea_id, target_idea_id, kind)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, source_idea_id, target_idea_id, kind) DO NOTHING`,
      [id, userId, orgId, sourceIdeaId, targetIdeaId, kind]
    );

    const row = await queryHelpers.queryOne<any>(
      `
      SELECT
        id,
        source_idea_id as "sourceIdeaId",
        target_idea_id as "targetIdeaId",
        kind,
        created_at as "createdAt"
      FROM my_idea_edges
      WHERE user_id = ? AND organization_id = ?
        AND source_idea_id = ? AND target_idea_id = ? AND kind = ?
      LIMIT 1
    `,
      [userId, orgId, sourceIdeaId, targetIdeaId, kind]
    );

    res.status(201).json({ edge: row });
  })
);

/**
 * DELETE /api/my-work/my-ideas/:id/edges/:edgeId
 */
router.delete(
  '/my-ideas/:id/edges/:edgeId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_idea_edges']))) return;

    const ideaId = String(req.params.id || '').trim();
    const edgeId = String(req.params.edgeId || '').trim();
    if (!edgeId) return res.status(400).json({ error: 'edgeId is required' });

    await queryHelpers.queryRun(
      `DELETE FROM my_idea_edges
       WHERE id = ? AND user_id = ? AND organization_id = ?
         ${ideaId && ideaId !== 'all' ? 'AND source_idea_id = ?' : ''}`,
      ideaId && ideaId !== 'all' ? [edgeId, userId, orgId, ideaId] : [edgeId, userId, orgId]
    );

    res.status(204).send();
  })
);

// ============================================================================
// T009 Enhancement — My Ideas Convert/Promote
// ============================================================================

/**
 * POST /api/my-work/my-ideas/:id/convert
 * Body: { target: 'initiative'|'task_set'|'decision'|'team_chat', options?: {...} }
 */
router.post(
  '/my-ideas/:id/convert',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas']))) return;

    const ideaId = String(req.params.id || '').trim();
    const target = String(req.body?.target || '').trim();
    const options = (req.body?.options || {}) as Record<string, unknown>;

    if (!ideaId) return res.status(400).json({ error: 'Missing idea id' });
    if (!['initiative', 'task_set', 'decision', 'team_chat'].includes(target)) {
      return res.status(400).json({ error: 'Invalid target' });
    }

    const idea = await queryHelpers.queryOne<any>(
      `
      SELECT
        id,
        title,
        body,
        tags,
        seed_text as "seedText",
        ai_expansion as "aiExpansion",
        summary_data as "summaryData",
        potential,
        complexity,
        area,
        priority,
        stage,
        promoted_to as "promotedTo",
        promoted_entity_id as "promotedEntityId"
      FROM my_ideas
      WHERE id = ? AND user_id = ? AND organization_id = ?
      LIMIT 1
    `,
      [ideaId, userId, orgId]
    );
    if (!idea) return res.status(404).json({ error: 'Idea not found' });

    const tags = parseTagsArray(idea?.tags);
    const safeTitle = String(idea?.title || 'Idea').trim() || 'Idea';
    const safeBody = String(idea?.body || '').trim();
    const safeExpansion = String(idea?.aiExpansion || '').trim();

    let summary: any = null;
    try {
      summary = idea?.summaryData
        ? typeof idea.summaryData === 'string'
          ? JSON.parse(idea.summaryData)
          : idea.summaryData
        : null;
    } catch {
      summary = null;
    }
    const nextSteps: string[] = Array.isArray(summary?.nextSteps)
      ? summary.nextSteps.map((s: any) => String(s || '').trim()).filter(Boolean)
      : [];

    const promote = async (promotedTo: string, promotedEntityId: string | null) => {
      await queryHelpers.queryRun(
        `UPDATE my_ideas
         SET promoted_to = ?, promoted_entity_id = ?, stage = 'promoted', updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ? AND organization_id = ?`,
        [promotedTo, promotedEntityId, ideaId, userId, orgId]
      );
    };

    // ----- Convert: Initiative -----
    if (target === 'initiative') {
      if (!(await requireTables(res, ['initiatives']))) return;
      const cols = await getTableColumns('initiatives');

      const initiativeId = uuidv4();
      const insertCols: string[] = ['id'];
      const insertVals: string[] = ['?'];
      const insertParams: any[] = [initiativeId];

      const add = (col: string, val: any) => {
        if (!cols.has(col)) return;
        insertCols.push(col);
        insertVals.push('?');
        insertParams.push(val);
      };

      add('organization_id', orgId);
      add('name', safeTitle.slice(0, 255));
      add('summary', (safeExpansion || safeBody).slice(0, 5000) || null);
      add('area', idea?.area ? String(idea.area).slice(0, 120) : null);
      // Optional: link as owner fields when present
      add('owner_execution_id', userId);
      add('owner_business_id', userId);
      add('sponsor_id', userId);

      await queryHelpers.queryRun(
        `INSERT INTO initiatives (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
        insertParams
      );

      await promote('initiative', initiativeId);

      return res.json({
        promotedTo: 'initiative',
        promotedEntityId: initiativeId,
        created: { initiativeId },
      });
    }

    // ----- Convert: Task set -----
    if (target === 'task_set') {
      if (!(await requireTables(res, ['tasks']))) return;
      const cols = await getTableColumns('tasks');

      const steps = nextSteps.length > 0 ? nextSteps.slice(0, 20) : [safeTitle];
      const taskIds: string[] = [];

      const baseTags = Array.from(new Set([`idea:${ideaId}`, ...tags].filter(Boolean)));

      for (const step of steps) {
        const taskId = uuidv4();
        taskIds.push(taskId);

        const insertCols: string[] = ['id'];
        const insertVals: string[] = ['?'];
        const insertParams: any[] = [taskId];
        const add = (col: string, val: any) => {
          if (!cols.has(col)) return;
          insertCols.push(col);
          insertVals.push('?');
          insertParams.push(val);
        };

        add('organization_id', orgId);
        add('title', String(step).slice(0, 255) || safeTitle.slice(0, 255));
        add(
          'description',
          [
            `Origin idea: ${safeTitle}`,
            safeBody ? `\n${safeBody}` : null,
            safeExpansion ? `\nAI expansion:\n${safeExpansion}` : null,
          ]
            .filter(Boolean)
            .join('\n')
            .slice(0, 9000)
        );
        add('status', 'todo');
        add('priority', 'medium');
        add('assignee_id', userId);
        add('reporter_id', userId);
        add('tags', JSON.stringify(baseTags));
        add('task_type', 'personal');
        add('source_type', 'idea');
        add('source_id', ideaId);

        await queryHelpers.queryRun(
          `INSERT INTO tasks (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
          insertParams
        );
      }

      await promote('task_set', JSON.stringify(taskIds));

      return res.json({
        promotedTo: 'task_set',
        promotedEntityId: JSON.stringify(taskIds),
        created: { taskIds },
      });
    }

    // ----- Convert: Decision -----
    if (target === 'decision') {
      if (!(await requireTables(res, ['decisions']))) return;
      const cols = await getTableColumns('decisions');

      const decisionId = uuidv4();
      const insertCols: string[] = ['id'];
      const insertVals: string[] = ['?'];
      const insertParams: any[] = [decisionId];

      const add = (col: string, val: any) => {
        if (!cols.has(col)) return;
        insertCols.push(col);
        insertVals.push('?');
        insertParams.push(val);
      };

      add('organization_id', orgId);
      add('title', safeTitle.slice(0, 255));
      add(
        'description',
        [
          safeBody ? `Idea:\n${safeBody}` : null,
          safeExpansion ? `\nAI expansion:\n${safeExpansion}` : null,
          summary?.verdict ? `\nSummary:\n${String(summary.verdict)}` : null,
          nextSteps.length ? `\nNext steps:\n- ${nextSteps.join('\n- ')}` : null,
        ]
          .filter(Boolean)
          .join('\n')
          .slice(0, 12000)
      );
      add('type', 'general');
      add('decision_maker_id', userId);
      add('created_by', userId);
      add('status', 'pending');
      add('source_type', 'idea');
      add('source_id', ideaId);

      await queryHelpers.queryRun(
        `INSERT INTO decisions (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
        insertParams
      );

      await promote('decision', decisionId);

      return res.json({
        promotedTo: 'decision',
        promotedEntityId: decisionId,
        created: { decisionId },
      });
    }

    // ----- Convert: Team chat -----
    if (target === 'team_chat') {
      if (!(await requireTables(res, ['chat_projects', 'conversations', 'conversation_messages'])))
        return;

      const chatProjectIdOpt = typeof options?.chatProjectId === 'string' ? options.chatProjectId : null;
      let chatProjectId: string | null = chatProjectIdOpt;

      if (!chatProjectId) {
        const existingTeamProject = await queryHelpers.queryOne<any>(
          `SELECT id FROM chat_projects WHERE organization_id = ? AND scope = 'team' ORDER BY updated_at DESC LIMIT 1`,
          [orgId]
        );
        chatProjectId = existingTeamProject?.id ? String(existingTeamProject.id) : null;
      }

      if (!chatProjectId) {
        const cpCols = await getTableColumns('chat_projects');
        const newProjectId = uuidv4();
        const now = new Date().toISOString();

        const insertCols: string[] = ['id'];
        const insertVals: string[] = ['?'];
        const insertParams: any[] = [newProjectId];
        const add = (col: string, val: any) => {
          if (!cpCols.has(col)) return;
          insertCols.push(col);
          insertVals.push('?');
          insertParams.push(val);
        };

        add('user_id', userId);
        add('organization_id', orgId);
        add('name', 'Team Ideas');
        add('description', 'Ideas shared for team discussion');
        add('color', '#8b5cf6');
        add('icon', 'sparkles');
        add('scope', 'team');
        add('created_at', now);
        add('updated_at', now);

        await queryHelpers.queryRun(
          `INSERT INTO chat_projects (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
          insertParams
        );
        chatProjectId = newProjectId;
      }

      const convCols = await getTableColumns('conversations');
      const conversationId = uuidv4();
      const now = new Date().toISOString();

      const convInsertCols: string[] = ['id'];
      const convInsertVals: string[] = ['?'];
      const convInsertParams: any[] = [conversationId];
      const addConv = (col: string, val: any) => {
        if (!convCols.has(col)) return;
        convInsertCols.push(col);
        convInsertVals.push('?');
        convInsertParams.push(val);
      };

      addConv('user_id', userId);
      addConv('organization_id', orgId);
      addConv('chat_project_id', chatProjectId);
      addConv('created_by', userId);
      addConv('title', safeTitle.slice(0, 255));
      addConv('title_source', 'user');
      addConv('tags', JSON.stringify(['idea', 'my_work']));
      addConv('pmo_context', JSON.stringify({ ideaId }));
      addConv('language', typeof options?.language === 'string' ? String(options.language) : 'en');
      addConv('created_at', now);
      addConv('updated_at', now);

      await queryHelpers.queryRun(
        `INSERT INTO conversations (${convInsertCols.join(', ')}) VALUES (${convInsertVals.join(', ')})`,
        convInsertParams
      );

      const msgCols = await getTableColumns('conversation_messages');
      const messageId = uuidv4();

      const content = [
        `Idea: ${safeTitle}`,
        safeBody ? `\n${safeBody}` : null,
        safeExpansion ? `\nAI expansion:\n${safeExpansion}` : null,
        summary?.verdict ? `\nAI verdict:\n${String(summary.verdict)}` : null,
        nextSteps.length ? `\nNext steps:\n- ${nextSteps.join('\n- ')}` : null,
      ]
        .filter(Boolean)
        .join('\n')
        .slice(0, 12000);

      const msgInsertCols: string[] = ['id'];
      const msgInsertVals: string[] = ['?'];
      const msgInsertParams: any[] = [messageId];
      const addMsg = (col: string, val: any) => {
        if (!msgCols.has(col)) return;
        msgInsertCols.push(col);
        msgInsertVals.push('?');
        msgInsertParams.push(val);
      };

      addMsg('conversation_id', conversationId);
      addMsg('role', 'user');
      addMsg('content', content || `Idea: ${safeTitle}`);
      addMsg('message_type', 'text');
      addMsg('metadata', JSON.stringify({ origin: 'my_ideas', ideaId }));
      addMsg('author_user_id', userId);
      addMsg('created_at', now);

      await queryHelpers.queryRun(
        `INSERT INTO conversation_messages (${msgInsertCols.join(', ')}) VALUES (${msgInsertVals.join(', ')})`,
        msgInsertParams
      );

      // Best-effort metadata update for list previews (if columns exist)
      const setParts: string[] = [];
      const setParams: any[] = [];
      const setIf = (col: string, val: any) => {
        if (!convCols.has(col)) return;
        setParts.push(`${col} = ?`);
        setParams.push(val);
      };
      setIf('message_count', 1);
      setIf('last_message_preview', String(content || '').slice(0, 200));
      setIf('last_message_at', now);
      setIf('updated_at', now);
      if (setParts.length) {
        await queryHelpers.queryRun(
          `UPDATE conversations SET ${setParts.join(', ')} WHERE id = ?`,
          [...setParams, conversationId]
        );
      }

      await promote('team_chat', conversationId);

      return res.json({
        promotedTo: 'team_chat',
        promotedEntityId: conversationId,
        created: { conversationId, chatProjectId },
      });
    }
  })
);

// ============================================================================
// T009 Enhancement — AI Idea Incubator (develop endpoint)
// ============================================================================

router.post(
  '/my-ideas/:id/develop',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['my_ideas']))) return;

    const { id } = req.params;
    const existing = await queryHelpers.queryOne<any>(
      `SELECT * FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ? LIMIT 1`,
      [id, userId, orgId]
    );
    if (!existing) return res.status(404).json({ error: 'Idea not found' });

    const seedText = String(req.body.seedText || existing.body || existing.title || '').trim();
    if (!seedText) return res.status(400).json({ error: 'Seed text is required' });
    const language = String(req.body.language || 'en').toLowerCase();
    const isPl = language.startsWith('pl');

    // SSE setup
    if (req.socket) {
      req.socket.setTimeout(120_000);
      req.socket.setNoDelay(true);
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const emit = (type: string, data: any) => {
      try { res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`); } catch {}
    };

    emit('stage', { stage: 'expanding', label: isPl ? 'Rozwijam Twój pomysł...' : 'Expanding your idea...' });

    try {
      const { llmService } = await import('../services/ai/llmService.js');
      const modelRouter = (await import('../services/ai/modelRouter.js')).default;
      const modelCfg = await modelRouter.select({ capability: 'chat', organizationId: orgId, options: { tier: 'STANDARD' } });

      // STAGE 1: AI Expansion
      const expansionPrompt = isPl
        ? `Jesteś kreatywnym konsultantem strategicznym. Użytkownik ma pomysł:\n\n"${seedText}"\n\nRozwiń ten pomysł w 3-4 akapitach. Opisz:\n1. Na czym dokładnie polega ten pomysł\n2. Jaką wartość przyniesie\n3. Jak mógłby wyglądać w praktyce\n4. Co czyni go wyjątkowym\n\nBądź entuzjastyczny ale rzeczowy. Pisz po polsku.`
        : `You are a creative strategic consultant. The user has an idea:\n\n"${seedText}"\n\nExpand this idea in 3-4 paragraphs. Describe:\n1. What exactly this idea entails\n2. What value it would bring\n3. How it could look in practice\n4. What makes it unique\n\nBe enthusiastic but grounded.`;

      const expansionResult = await llmService.callText({
        type: 'text',
        modelConfig: { id: modelCfg.id, provider: modelCfg.provider },
        systemPrompt: isPl ? 'Jesteś kreatywnym partnerem do rozwoju pomysłów.' : 'You are a creative idea development partner.',
        messages: [{ role: 'user', content: expansionPrompt }],
      });
      const aiExpansion = String((expansionResult as any)?.content || '');
      emit('expansion', { content: aiExpansion });

      // Save expansion to DB
      await queryHelpers.queryRun(
        `UPDATE my_ideas SET seed_text = ?, ai_expansion = ?, stage = 'expanding', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`,
        [seedText, aiExpansion, id, userId]
      );

      // STAGE 2: Web Research
      emit('stage', { stage: 'researching', label: isPl ? 'Szukam informacji w sieci...' : 'Researching the web...' });

      let researchResults: any[] = [];
      try {
        const tavilyKey = process.env.TAVILY_API_KEY;
        if (tavilyKey) {
          const { TavilyWebSearchService } = await import('../services/ai/tavilyWebSearchService.js');
          const tavily = new (TavilyWebSearchService as any)(tavilyKey);

          const searchQuery = aiExpansion.split('\n').slice(0, 2).join(' ').slice(0, 200);
          const searchRes = await tavily.search(searchQuery, { maxResults: 5, searchDepth: 'advanced' });
          researchResults = (searchRes?.results || []).map((r: any) => ({
            title: String(r?.title || '').slice(0, 200),
            url: String(r?.url || ''),
            snippet: String(r?.content || '').slice(0, 400),
          }));
          emit('research', { results: researchResults, answer: searchRes?.answer || null });
        }
      } catch (err: any) {
        logger.warn('[IdeaDevelop] Web search failed:', err?.message);
        emit('research', { results: [], answer: null, error: 'Web search unavailable' });
      }

      // Save research
      await queryHelpers.queryRun(
        `UPDATE my_ideas SET research_data = ?, stage = 'researching', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [JSON.stringify(researchResults), id]
      );

      // STAGE 3: Creative Proposals
      emit('stage', { stage: 'proposing', label: isPl ? 'Generuję kreatywne propozycje...' : 'Generating creative proposals...' });

      const researchContext = researchResults.map(r => `- ${r.title}: ${r.snippet}`).join('\n');
      const proposalsPrompt = isPl
        ? `Na podstawie pomysłu użytkownika i badań, zaproponuj 4 kreatywne warianty/rozszerzenia.\n\nPomysł: "${seedText}"\n\nRozwinięcie:\n${aiExpansion}\n\nBadania:\n${researchContext}\n\nDla każdego wariantu podaj:\n- Tytuł (krótki, chwytliwy)\n- Opis (2-3 zdania)\n- Dlaczego warto (1 zdanie)\n\nOdpowiedz jako JSON array: [{"title":"...","description":"...","whyItMatters":"..."}]\nTylko JSON, bez markdown.`
        : `Based on the user's idea and research, propose 4 creative variants/extensions.\n\nIdea: "${seedText}"\n\nExpansion:\n${aiExpansion}\n\nResearch:\n${researchContext}\n\nFor each variant provide:\n- Title (short, catchy)\n- Description (2-3 sentences)\n- Why it matters (1 sentence)\n\nRespond as JSON array: [{"title":"...","description":"...","whyItMatters":"..."}]\nOnly JSON, no markdown.`;

      const proposalsResult = await llmService.callText({
        type: 'text',
        modelConfig: { id: modelCfg.id, provider: modelCfg.provider },
        systemPrompt: isPl ? 'Jesteś kreatywnym generatorem pomysłów. Odpowiadasz tylko poprawnym JSON.' : 'You are a creative idea generator. You respond only with valid JSON.',
        messages: [{ role: 'user', content: proposalsPrompt }],
      });

      let proposals: any[] = [];
      try {
        const raw = String((proposalsResult as any)?.content || '[]');
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        proposals = JSON.parse(jsonMatch ? jsonMatch[0] : '[]');
      } catch { proposals = []; }

      emit('proposals', { proposals });

      await queryHelpers.queryRun(
        `UPDATE my_ideas SET creative_proposals = ?, stage = 'proposing', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [JSON.stringify(proposals), id]
      );

      // STAGE 4: Summary
      emit('stage', { stage: 'summary', label: isPl ? 'Tworzę podsumowanie...' : 'Creating summary...' });

      const summaryPrompt = isPl
        ? `Podsumuj ten pomysł jako kreatywny konsultant.\n\nPomysł: "${seedText}"\nRozwinięcie: ${aiExpansion.slice(0, 500)}\nPropozycje: ${proposals.map(p => p.title).join(', ')}\n\nOdpowiedz jako JSON:\n{"verdict":"...(1-2 zdania entuzjastycznej oceny)","potential":"high|medium|low","complexity":"low|medium|high","timeToValue":"...(np. 2-4 tygodnie)","nextSteps":["krok1","krok2","krok3"]}\nTylko JSON.`
        : `Summarize this idea as a creative consultant.\n\nIdea: "${seedText}"\nExpansion: ${aiExpansion.slice(0, 500)}\nProposals: ${proposals.map(p => p.title).join(', ')}\n\nRespond as JSON:\n{"verdict":"...(1-2 sentence enthusiastic assessment)","potential":"high|medium|low","complexity":"low|medium|high","timeToValue":"...(e.g. 2-4 weeks)","nextSteps":["step1","step2","step3"]}\nOnly JSON.`;

      const summaryResult = await llmService.callText({
        type: 'text',
        modelConfig: { id: modelCfg.id, provider: modelCfg.provider },
        systemPrompt: isPl ? 'Jesteś pozytywnym konsultantem strategicznym. Odpowiadasz JSON.' : 'You are a positive strategic consultant. You respond with JSON.',
        messages: [{ role: 'user', content: summaryPrompt }],
      });

      let summary: any = {};
      try {
        const raw = String((summaryResult as any)?.content || '{}');
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        summary = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
      } catch { summary = { verdict: '', potential: 'medium', complexity: 'medium', timeToValue: '?', nextSteps: [] }; }

      emit('summary', { summary });

      // Auto-priority: calculate from AI assessment
      let autoPriority = 50;
      const pot = summary.potential || 'medium';
      const cmplx = summary.complexity || 'medium';
      if (pot === 'high') autoPriority += 25;
      else if (pot === 'low') autoPriority -= 15;
      if (cmplx === 'low') autoPriority += 10;
      else if (cmplx === 'high') autoPriority -= 5;
      if (proposals.length >= 3) autoPriority += 5;
      if (researchResults.length >= 3) autoPriority += 5;
      autoPriority = Math.max(10, Math.min(100, autoPriority));

      // Auto-detect area from content
      let autoArea: string | null = null;
      const allText = `${seedText} ${aiExpansion}`.toLowerCase();
      if (/strateg|vision|roadmap|competitive/.test(allText)) autoArea = 'strategy';
      else if (/product|feature|ux|user experience|interface/.test(allText)) autoArea = 'product';
      else if (/process|workflow|operations|efficiency|automat/.test(allText)) autoArea = 'process';
      else if (/culture|team|hr|hiring|talent|wellbeing/.test(allText)) autoArea = 'culture';
      else if (/tech|architecture|infra|devops|security|code/.test(allText)) autoArea = 'tech';
      else if (/growth|market|sales|revenue|customer|acqui/.test(allText)) autoArea = 'growth';

      await queryHelpers.queryRun(
        `UPDATE my_ideas
         SET summary_data = ?, potential = ?, complexity = ?, stage = 'ready', priority = ?, area = COALESCE(area, ?), updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [JSON.stringify(summary), pot, cmplx, autoPriority, autoArea, id]
      );

      emit('done', { stage: 'ready', priority: autoPriority, area: autoArea });
      res.end();
    } catch (err: any) {
      logger.error('[IdeaDevelop] Error:', err);
      emit('error', { message: err?.message || 'Development failed' });
      res.end();
    }
  })
);

// ============================================================================
// T011 — Notebook (backend persistence)
// ============================================================================

type NotebookVisibility = 'private' | 'project';

const safeJsonString = (v: unknown, fallback: string) => {
  if (typeof v === 'string') {
    try {
      JSON.parse(v);
      return v;
    } catch {
      // fall through
    }
  }
  try {
    return JSON.stringify(v ?? JSON.parse(fallback));
  } catch {
    return fallback;
  }
};

const canAccessNotebookRow = async (
  userId: string,
  orgId: string,
  row: { owner_user_id?: string; organization_id?: string; visibility?: string; project_id?: string }
): Promise<boolean> => {
  if (!row) return false;
  if (String(row.organization_id || '') !== String(orgId)) return false;
  const owner = String(row.owner_user_id || '');
  const vis = String(row.visibility || 'private').toLowerCase() as NotebookVisibility;
  const projectId = row.project_id ? String(row.project_id) : null;

  if (owner === userId) return true;
  if (vis !== 'project' || !projectId) return false;

  const pm = await queryHelpers.queryOne<{ ok: number }>(
    `SELECT 1 as ok FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1`,
    [projectId, userId]
  );
  return Boolean((pm as any)?.ok);
};

/**
 * GET /api/my-work/notebook/pages?projectId?&q?&status?&pinned?&sort?&limit?&offset?
 */
router.get(
  '/notebook/pages',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const projectId = req.query.projectId ? String(req.query.projectId) : null;
    const q = req.query.q ? String(req.query.q).trim().toLowerCase() : '';
    const statusFilter = req.query.status ? String(req.query.status).trim().toLowerCase() : '';
    const pinnedFilter = req.query.pinned !== undefined ? String(req.query.pinned) : '';
    const sortParam = req.query.sort ? String(req.query.sort).trim().toLowerCase() : 'updated';
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;
    const offsetRaw = Number(req.query.offset);
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

    const where: string[] = ['np.organization_id = ?'];
    const params: any[] = [orgId];

    where.push(
      `( (lower(np.visibility) = 'private' AND np.owner_user_id = ?)
         OR (lower(np.visibility) = 'project' AND np.project_id IS NOT NULL AND (np.owner_user_id = ? OR pm.user_id IS NOT NULL)) )`
    );
    params.push(userId, userId);

    if (projectId) {
      where.push('np.project_id = ?');
      params.push(projectId);
    }

    if (statusFilter && ['inbox', 'active', 'converted', 'archived'].includes(statusFilter)) {
      where.push("lower(coalesce(np.status, 'active')) = ?");
      params.push(statusFilter);
    }

    if (pinnedFilter === '1') {
      where.push('np.pinned = 1');
    } else if (pinnedFilter === '0') {
      where.push('(np.pinned = 0 OR np.pinned IS NULL)');
    }

    if (q) {
      where.push(
        `(lower(np.title) LIKE ? OR lower(coalesce(np.content_text,'')) LIKE ? OR lower(coalesce(np.tags_json,'')) LIKE ?)`
      );
      const like = `%${q}%`;
      params.push(like, like, like);
    }

    const orderClauses: Record<string, string> = {
      updated: 'np.pinned DESC, np.updated_at DESC',
      created: 'np.pinned DESC, np.created_at DESC',
      title: 'np.pinned DESC, np.title ASC',
    };
    const orderBy = orderClauses[sortParam] || orderClauses.updated;

    const rows =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          np.id,
          np.owner_user_id as "ownerUserId",
          np.organization_id as "organizationId",
          np.project_id as "projectId",
          np.visibility,
          np.title,
          np.content_json as "contentJson",
          np.content_text as "contentText",
          np.tags_json as tags,
          np.maturity,
          np.icon,
          np.summary,
          coalesce(np.status, 'active') as status,
          coalesce(np.pinned, 0) as pinned,
          np.converted_to_json as "convertedToJson",
          np.created_at as "createdAt",
          np.updated_at as "updatedAt"
        FROM notebook_pages np
        LEFT JOIN project_members pm
          ON pm.project_id = np.project_id
         AND pm.user_id = ?
        WHERE ${where.join(' AND ')}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
      `,
        [userId, ...params, limit, offset]
      )) || [];

    const parseConvertedTo = (raw: string | null) => {
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    };

    res.json(
      rows.map((r: any) => ({
        ...r,
        tags: parseTagsArray(r.tags),
        pinned: Boolean(r.pinned),
        convertedTo: parseConvertedTo(r.convertedToJson),
        convertedToJson: undefined,
        contentJson: (() => {
          try {
            return r.contentJson ? JSON.parse(r.contentJson) : { type: 'doc', content: [] };
          } catch {
            return { type: 'doc', content: [] };
          }
        })(),
      }))
    );
  })
);

/**
 * POST /api/my-work/notebook/pages
 */
router.post(
  '/notebook/pages',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ error: 'title is required' });

    const projectId = req.body?.projectId ? String(req.body.projectId) : null;
    const visibility = (req.body?.visibility
      ? String(req.body.visibility).toLowerCase()
      : projectId
        ? 'project'
        : 'private') as NotebookVisibility;

    if (visibility === 'project' && !projectId) {
      return res.status(400).json({ error: 'projectId is required for visibility=project' });
    }

    // If creating a project-visible note, require membership
    if (visibility === 'project' && projectId) {
      const pm = await queryHelpers.queryOne<{ ok: number }>(
        `SELECT 1 as ok FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1`,
        [projectId, userId]
      );
      if (!pm) return res.status(403).json({ error: 'Not a project member' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    const tags = JSON.stringify(parseTagsArray(req.body?.tags));
    const contentJson = safeJsonString(req.body?.contentJson, JSON.stringify({ type: 'doc', content: [] }));
    const contentText = typeof req.body?.contentText === 'string' ? req.body.contentText : null;
    const icon = typeof req.body?.icon === 'string' ? req.body.icon : null;
    const maturity = typeof req.body?.maturity === 'string' ? req.body.maturity : 'seed';
    const status = typeof req.body?.status === 'string' && ['inbox', 'active'].includes(req.body.status) ? req.body.status : 'active';

    await queryHelpers.queryRun(
      `INSERT INTO notebook_pages
        (id, owner_user_id, organization_id, project_id, visibility, title, content_json, content_text, tags_json, icon, maturity, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, orgId, projectId, visibility, title, contentJson, contentText, tags, icon, maturity, status, now, now]
    );

    const row = await queryHelpers.queryOne<any>(
      `SELECT
        id,
        owner_user_id as "ownerUserId",
        organization_id as "organizationId",
        project_id as "projectId",
        visibility,
        title,
        content_json as "contentJson",
        content_text as "contentText",
        tags_json as tags,
        maturity,
        icon,
        summary,
        coalesce(status, 'active') as status,
        coalesce(pinned, 0) as pinned,
        converted_to_json as "convertedToJson",
        created_at as "createdAt",
        updated_at as "updatedAt"
       FROM notebook_pages
       WHERE id = ? LIMIT 1`,
      [id]
    );

    const parseConvertedTo = (raw: string | null) => {
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    };

    res.status(201).json({
      ...row,
      tags: parseTagsArray((row as any)?.tags),
      pinned: Boolean(row?.pinned),
      convertedTo: parseConvertedTo(row?.convertedToJson),
      convertedToJson: undefined,
      contentJson: (() => {
        try {
          return row?.contentJson ? JSON.parse(row.contentJson) : { type: 'doc', content: [] };
        } catch {
          return { type: 'doc', content: [] };
        }
      })(),
    });
  })
);

/**
 * GET /api/my-work/notebook/pages/:id
 */
router.get(
  '/notebook/pages/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const id = String(req.params.id || '').trim();
    const row = await queryHelpers.queryOne<any>(
      `SELECT
        id,
        owner_user_id,
        organization_id,
        project_id,
        visibility,
        title,
        content_json as "contentJson",
        content_text as "contentText",
        tags_json as tags,
        maturity,
        icon,
        summary,
        coalesce(status, 'active') as status,
        coalesce(pinned, 0) as pinned,
        converted_to_json as "convertedToJson",
        created_at as "createdAt",
        updated_at as "updatedAt"
       FROM notebook_pages
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (!(await canAccessNotebookRow(userId, orgId, row))) return res.status(403).json({ error: 'Forbidden' });

    const parseConvertedTo = (raw: string | null) => {
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    };

    res.json({
      id: row.id,
      projectId: row.project_id || null,
      visibility: row.visibility,
      title: row.title,
      contentText: row.contentText,
      tags: parseTagsArray(row.tags),
      maturity: row.maturity || 'seed',
      icon: row.icon || null,
      summary: row.summary || null,
      status: row.status,
      pinned: Boolean(row.pinned),
      convertedTo: parseConvertedTo(row.convertedToJson),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      contentJson: (() => {
        try {
          return row?.contentJson ? JSON.parse(row.contentJson) : { type: 'doc', content: [] };
        } catch {
          return { type: 'doc', content: [] };
        }
      })(),
    });
  })
);

/**
 * PUT /api/my-work/notebook/pages/:id
 * Owner-only updates.
 */
router.put(
  '/notebook/pages/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const id = String(req.params.id || '').trim();
    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id, project_id, visibility
       FROM notebook_pages
       WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (String(existing.organization_id || '') !== String(orgId)) return res.status(403).json({ error: 'Forbidden' });
    if (String(existing.owner_user_id || '') !== String(userId))
      return res.status(403).json({ error: 'Owner-only' });

    const setParts: string[] = [];
    const params: any[] = [];
    const set = (col: string, val: any) => {
      setParts.push(`${col} = ?`);
      params.push(val);
    };

    if (typeof req.body?.title === 'string') set('title', String(req.body.title).trim());
    if (req.body?.tags !== undefined) set('tags_json', JSON.stringify(parseTagsArray(req.body.tags)));
    if (req.body?.contentJson !== undefined)
      set('content_json', safeJsonString(req.body.contentJson, JSON.stringify({ type: 'doc', content: [] })));
    if (typeof req.body?.contentText === 'string') set('content_text', req.body.contentText);
    if (typeof req.body?.maturity === 'string') set('maturity', req.body.maturity);
    if (typeof req.body?.icon === 'string') set('icon', req.body.icon);
    if (typeof req.body?.summary === 'string') set('summary', req.body.summary);
    if (typeof req.body?.status === 'string' && ['inbox', 'active', 'converted', 'archived'].includes(req.body.status))
      set('status', req.body.status);

    if (req.body?.projectId !== undefined) {
      const nextProjectId = req.body.projectId ? String(req.body.projectId) : null;
      set('project_id', nextProjectId);
      const nextVis = nextProjectId ? 'project' : 'private';
      set('visibility', nextVis);
    }

    const selectNotebookFull = `
      SELECT
        id,
        owner_user_id as "ownerUserId",
        organization_id as "organizationId",
        project_id as "projectId",
        visibility,
        title,
        content_json as "contentJson",
        content_text as "contentText",
        tags_json as tags,
        maturity,
        icon,
        summary,
        coalesce(status, 'active') as status,
        coalesce(pinned, 0) as pinned,
        converted_to_json as "convertedToJson",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM notebook_pages WHERE id = ? LIMIT 1`;

    const formatNotebookRow = (r: any) => {
      const parseCT = (raw: string | null) => { if (!raw) return null; try { return JSON.parse(raw); } catch { return null; } };
      return {
        ...r,
        tags: parseTagsArray(r?.tags),
        pinned: Boolean(r?.pinned),
        convertedTo: parseCT(r?.convertedToJson),
        convertedToJson: undefined,
        contentJson: (() => {
          try { return r?.contentJson ? JSON.parse(r.contentJson) : { type: 'doc', content: [] }; } catch { return { type: 'doc', content: [] }; }
        })(),
      };
    };

    if (setParts.length === 0) {
      const row = await queryHelpers.queryOne<any>(selectNotebookFull, [id]);
      return res.json(formatNotebookRow(row));
    }

    setParts.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);
    await queryHelpers.queryRun(`UPDATE notebook_pages SET ${setParts.join(', ')} WHERE id = ?`, params);

    const row = await queryHelpers.queryOne<any>(selectNotebookFull, [id]);
    res.json(formatNotebookRow(row));
  })
);

/**
 * DELETE /api/my-work/notebook/pages/:id
 * Owner-only delete.
 */
router.delete(
  '/notebook/pages/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const id = String(req.params.id || '').trim();
    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id FROM notebook_pages WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (String(existing.organization_id || '') !== String(orgId)) return res.status(403).json({ error: 'Forbidden' });
    if (String(existing.owner_user_id || '') !== String(userId))
      return res.status(403).json({ error: 'Owner-only' });

    await queryHelpers.queryRun(`DELETE FROM notebook_pages WHERE id = ?`, [id]);
    res.status(204).send();
  })
);

/**
 * PUT /api/my-work/notebook/pages/:id/pin
 * Toggle pinned state.
 */
router.put(
  '/notebook/pages/:id/pin',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const id = String(req.params.id || '').trim();
    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id, coalesce(pinned, 0) as pinned FROM notebook_pages WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (String(existing.organization_id || '') !== String(orgId)) return res.status(403).json({ error: 'Forbidden' });
    if (String(existing.owner_user_id || '') !== String(userId)) return res.status(403).json({ error: 'Owner-only' });

    const newPinned = existing.pinned ? 0 : 1;
    await queryHelpers.queryRun(
      `UPDATE notebook_pages SET pinned = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newPinned, id]
    );

    res.json({ id, pinned: Boolean(newPinned) });
  })
);

/**
 * PUT /api/my-work/notebook/pages/:id/status
 * Change note status (inbox/active/converted/archived).
 */
router.put(
  '/notebook/pages/:id/status',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const id = String(req.params.id || '').trim();
    const status = String(req.body?.status || '').trim().toLowerCase();
    if (!['inbox', 'active', 'converted', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be inbox|active|converted|archived' });
    }

    const existing = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id FROM notebook_pages WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (String(existing.organization_id || '') !== String(orgId)) return res.status(403).json({ error: 'Forbidden' });
    if (String(existing.owner_user_id || '') !== String(userId)) return res.status(403).json({ error: 'Owner-only' });

    await queryHelpers.queryRun(
      `UPDATE notebook_pages SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status, id]
    );

    res.json({ id, status });
  })
);

/**
 * POST /api/my-work/notebook/pages/:id/convert
 * Convert a notebook page to a task, decision, or initiative.
 */
router.post(
  '/notebook/pages/:id/convert',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const pageId = String(req.params.id || '').trim();
    const target = String(req.body?.target || '').trim().toLowerCase();
    if (!['task', 'decision', 'initiative'].includes(target)) {
      return res.status(400).json({ error: 'target must be task|decision|initiative' });
    }

    const page = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id, title, content_text, tags_json, converted_to_json
       FROM notebook_pages WHERE id = ? LIMIT 1`,
      [pageId]
    );
    if (!page) return res.status(404).json({ error: 'Not found' });
    if (String(page.organization_id || '') !== String(orgId)) return res.status(403).json({ error: 'Forbidden' });
    if (String(page.owner_user_id || '') !== String(userId)) return res.status(403).json({ error: 'Owner-only' });

    const overrideTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const overrideDesc = typeof req.body?.description === 'string' ? req.body.description : '';
    const entityTitle = overrideTitle || page.title || 'Untitled';
    const entityDesc = overrideDesc || (page.content_text || '').slice(0, 2000);
    const newId = uuidv4();
    let createdEntity: { id: string; type: string; title: string } | null = null;

    if (target === 'task') {
      const cols = await getTableColumns('tasks');
      const insertCols: string[] = ['id'];
      const insertVals: string[] = ['?'];
      const insertParams: any[] = [newId];
      const add = (col: string, val: any) => {
        if (!cols.has(col)) return;
        insertCols.push(col);
        insertVals.push('?');
        insertParams.push(val);
      };
      add('organization_id', orgId);
      add('title', entityTitle);
      add('description', entityDesc);
      add('status', 'todo');
      add('priority', 'medium');
      add('assignee_id', userId);
      add('reporter_id', userId);
      add('tags', page.tags_json || '[]');
      add('task_type', 'personal');
      add('source_type', 'notebook');
      add('source_id', pageId);
      await queryHelpers.queryRun(
        `INSERT INTO tasks (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
        insertParams
      );
      createdEntity = { id: newId, type: 'task', title: entityTitle };
    } else if (target === 'decision') {
      const cols = await getTableColumns('decisions');
      if (cols.size > 0) {
        const insertCols: string[] = ['id'];
        const insertVals: string[] = ['?'];
        const insertParams: any[] = [newId];
        const add = (col: string, val: any) => {
          if (!cols.has(col)) return;
          insertCols.push(col);
          insertVals.push('?');
          insertParams.push(val);
        };
        add('organization_id', orgId);
        add('title', entityTitle);
        add('description', entityDesc);
        add('status', 'pending');
        add('decision_maker_id', userId);
        add('created_by', userId);
        add('priority', 'medium');
        add('source_type', 'notebook');
        add('source_id', pageId);
        await queryHelpers.queryRun(
          `INSERT INTO decisions (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`,
          insertParams
        );
      }
      createdEntity = { id: newId, type: 'decision', title: entityTitle };
    } else {
      createdEntity = { id: newId, type: 'initiative', title: entityTitle };
    }

    // Update notebook page: track conversion + set status
    let existingConverted: any[] = [];
    try { existingConverted = JSON.parse(page.converted_to_json || '[]'); } catch { existingConverted = []; }
    if (!Array.isArray(existingConverted)) existingConverted = [];
    existingConverted.push({ type: target, id: newId });

    await queryHelpers.queryRun(
      `UPDATE notebook_pages SET status = 'converted', converted_to_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [JSON.stringify(existingConverted), pageId]
    );

    res.status(201).json(createdEntity);
  })
);

/**
 * POST /api/my-work/notebook/pages/:id/extract-actions
 * AI-based action item extraction via SSE.
 */
router.post(
  '/notebook/pages/:id/extract-actions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    if (!(await requireTables(res, ['notebook_pages']))) return;

    const pageId = String(req.params.id || '').trim();
    const page = await queryHelpers.queryOne<any>(
      `SELECT id, owner_user_id, organization_id, title, content_text
       FROM notebook_pages WHERE id = ? LIMIT 1`,
      [pageId]
    );
    if (!page) return res.status(404).json({ error: 'Not found' });
    if (String(page.organization_id || '') !== String(orgId)) return res.status(403).json({ error: 'Forbidden' });
    if (String(page.owner_user_id || '') !== String(userId)) return res.status(403).json({ error: 'Owner-only' });

    const noteContent = String(page.content_text || page.title || '').trim();
    if (!noteContent) return res.status(400).json({ error: 'Note has no content to analyze' });

    const language = String(req.body?.language || 'en').toLowerCase();
    const isPl = language.startsWith('pl');

    if (req.socket) {
      req.socket.setTimeout(120_000);
      req.socket.setNoDelay(true);
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const emit = (type: string, data: any) => {
      try { res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`); } catch {}
    };

    emit('stage', { stage: 'extracting', label: isPl ? 'Analizuję notatkę...' : 'Analyzing note...' });

    try {
      const { llmService } = await import('../services/ai/llmService.js');
      const modelRouter = (await import('../services/ai/modelRouter.js')).default;
      const modelCfg = await modelRouter.select({ capability: 'chat', organizationId: orgId, options: { tier: 'STANDARD' } });

      const prompt = isPl
        ? `Przeanalizuj poniższą notatkę i wyodrębnij konkretne akcje (action items) do wykonania.\n\nNotatka: "${noteContent.slice(0, 3000)}"\n\nDla każdej akcji podaj:\n- title: krótki tytuł\n- suggestedOwner: sugerowany właściciel (lub null)\n- suggestedDue: sugerowany termin jako opis (np. "do końca tygodnia") lub null\n- priority: high|medium|low\n\nOdpowiedz JSON array: [{"title":"...","suggestedOwner":null,"suggestedDue":null,"priority":"medium"}]\nTylko JSON, bez markdown.`
        : `Analyze the following note and extract concrete action items.\n\nNote: "${noteContent.slice(0, 3000)}"\n\nFor each action provide:\n- title: short task title\n- suggestedOwner: suggested owner (or null)\n- suggestedDue: suggested due description (e.g. "end of week") or null\n- priority: high|medium|low\n\nRespond as JSON array: [{"title":"...","suggestedOwner":null,"suggestedDue":null,"priority":"medium"}]\nOnly JSON, no markdown.`;

      const result = await llmService.callText({
        type: 'text',
        modelConfig: { id: modelCfg.id, provider: modelCfg.provider },
        systemPrompt: isPl ? 'Jesteś asystentem do analizy notatek. Odpowiadasz tylko JSON.' : 'You are a note analysis assistant. You respond only with valid JSON.',
        messages: [{ role: 'user', content: prompt }],
      });

      let items: any[] = [];
      try {
        const raw = String((result as any)?.content || '[]');
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        items = JSON.parse(jsonMatch ? jsonMatch[0] : '[]');
      } catch { items = []; }

      emit('actions', { items });
      emit('done', { count: items.length });
      res.end();
    } catch (err: any) {
      logger.error('[NotebookExtractActions] Error:', err);
      emit('error', { message: err?.message || 'Extraction failed' });
      res.end();
    }
  })
);

export default router;
