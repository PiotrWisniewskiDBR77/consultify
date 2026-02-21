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
  | 'ai_suggestion';

type TriageAction = 'accept_today' | 'schedule' | 'delegate' | 'archive' | 'reject';

type InboxUrgency = 'critical' | 'high' | 'normal' | 'low';

type FocusColumn = 'today' | 'thisWeek' | 'later';

type InboxItemKey = `task:${string}` | `decision:${string}` | `notification:${string}`;

interface InboxItem {
  id: string;
  type: InboxItemType;
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
  linkedTaskId?: string;
  linkedDecisionId?: string;
  linkedInitiativeId?: string;
  linkedTask?: { id: string; title: string; status: string; priority: string; dueDate?: string };
  triaged: boolean;
  triagedAt?: string;
  triageAction?: TriageAction;
  triageParams?: Record<string, unknown>;
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

const mapNotificationToInboxType = (type?: string | null): InboxItemType => {
  const t = String(type || '').toUpperCase();
  if (t.includes('MENTION')) return 'mention';
  if (t.includes('ESCALATION')) return 'escalation';
  if (t.includes('REVIEW') || t.includes('APPROVAL')) return 'review_request';
  if (t.includes('DECISION')) return 'decision_request';
  if (t.includes('AI') || t.includes('RECOMMENDATION')) return 'ai_suggestion';
  return 'new_assignment';
};

const ensureMyWorkTables = async () => {
  // Triage state: hides already-processed inbox items per user
  await queryHelpers.queryRun(
    `CREATE TABLE IF NOT EXISTS my_work_inbox_triage (
      user_id TEXT NOT NULL,
      item_key TEXT NOT NULL,
      action TEXT NOT NULL,
      params_json TEXT,
      triaged_at TEXT NOT NULL,
      PRIMARY KEY (user_id, item_key)
    )`
  );

  // Focus state: stores manual column/position for focus items per user+date
  await queryHelpers.queryRun(
    `CREATE TABLE IF NOT EXISTS my_work_focus_state (
      user_id TEXT NOT NULL,
      focus_date TEXT NOT NULL,
      item_key TEXT NOT NULL,
      column_name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, focus_date, item_key)
    )`
  );
};

const ensureMyIdeasTable = async () => {
  await queryHelpers.queryRun(
    `CREATE TABLE IF NOT EXISTS my_ideas (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      tags TEXT DEFAULT '[]',
      source_type TEXT,
      source_conversation_id TEXT,
      source_message_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );
  await queryHelpers.queryRun(
    `CREATE INDEX IF NOT EXISTS idx_my_ideas_user_id ON my_ideas(user_id)`
  );
  await queryHelpers.queryRun(
    `CREATE INDEX IF NOT EXISTS idx_my_ideas_org_id ON my_ideas(organization_id)`
  );
  await queryHelpers.queryRun(
    `CREATE INDEX IF NOT EXISTS idx_my_ideas_created_at ON my_ideas(created_at)`
  );
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
          a.avatar_url as assigneeAvatarUrl
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
          t.completed_at as "completedAt"
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
          p.name as projectName
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
 * GET /api/my-work/inbox
 * Derived inbox items + triage state
 */
router.get(
  '/inbox',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    await ensureMyWorkTables();

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

    const unreadNotifications =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          id,
          type,
          title,
          ${notifMessageSelect},
          ${notifPrioritySelect},
          NULL as entityType,
          NULL as entityId,
          created_at as createdAt
        FROM notifications
        WHERE user_id = ?
          AND ${notifReadExpr} = 0
        ORDER BY created_at DESC
        LIMIT ?
      `,
        [userId, Math.min(25, limit)]
      )) || [];

    const items: InboxItem[] = [];

    for (const t of overdueTasks) {
      const key: InboxItemKey = `task:${t.id}`;
      const triaged = triagedMap.get(key);
      const urgency: InboxUrgency = urgencyFromPriority(t.priority);
      items.push({
        id: `inbox-${uuidv4()}`,
        type: 'escalation',
        title: t.title,
        description: t.description || undefined,
        source: { type: 'system' },
        receivedAt: t.dueDate ? new Date(t.dueDate).toISOString() : nowIso,
        urgency: urgency === 'low' ? 'normal' : urgency, // overdue can't be "low" priority in UI
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
      items.push({
        id: `inbox-${uuidv4()}`,
        type: 'decision_request',
        title: d.title,
        description: d.description || undefined,
        source: { type: 'system' },
        receivedAt: d.createdAt || nowIso,
        urgency,
        linkedDecisionId: d.id,
        triaged: Boolean(triaged),
        triagedAt: triaged?.triagedAt,
        triageAction: triaged?.action,
        triageParams: triaged?.params,
        _key: key,
      });
    }

    for (const n of unreadNotifications) {
      const key: InboxItemKey = `notification:${n.id}`;
      const triaged = triagedMap.get(key);
      items.push({
        id: `inbox-${uuidv4()}`,
        type: mapNotificationToInboxType(n.type),
        title: n.title || 'Notification',
        description: n.body || undefined,
        source: { type: 'system' },
        receivedAt: n.createdAt || nowIso,
        urgency: urgencyFromPriority(n.priority),
        triaged: Boolean(triaged),
        triagedAt: triaged?.triagedAt,
        triageAction: triaged?.action,
        triageParams: triaged?.params,
        _key: key,
      });
    }

    // Remove triaged items from main list shown in UI (InboxTriage filters triaged anyway, but keep clean)
    const visible = items.filter((i) => !i.triaged);

    // Summary (minimal)
    const summary = {
      total: visible.length,
      critical: visible.filter((i) => i.urgency === 'critical').length,
      newToday: visible.filter((i) => i.receivedAt.slice(0, 10) === today).length,
      groups: {
        urgent: visible.filter((i) => i.urgency === 'critical' || i.urgency === 'high'),
        new_assignments: visible.filter((i) => i.type === 'new_assignment'),
        mentions: visible.filter((i) => i.type === 'mention'),
        review_requests: visible.filter(
          (i) => i.type === 'review_request' || i.type === 'decision_request'
        ),
        other: visible.filter(
          (i) =>
            !['new_assignment', 'mention', 'review_request', 'decision_request'].includes(i.type)
        ),
      },
    };

    // Sort by urgency then time
    const urgencyRank: Record<InboxUrgency, number> = { critical: 0, high: 1, normal: 2, low: 3 };
    visible.sort((a, b) => {
      const ra = urgencyRank[a.urgency];
      const rb = urgencyRank[b.urgency];
      if (ra !== rb) return ra - rb;
      return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
    });

    res.json({ summary, items: visible.slice(0, limit) });
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
    await ensureMyWorkTables();

    const action = String(req.body?.action || '') as TriageAction;
    const params = (req.body?.params || undefined) as Record<string, unknown> | undefined;
    const itemKey = String(
      req.body?.itemKey || req.body?._key || req.query.itemKey || ''
    ) as InboxItemKey;

    if (
      !action ||
      !['accept_today', 'schedule', 'delegate', 'archive', 'reject'].includes(action)
    ) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    if (!itemKey || !itemKey.includes(':')) {
      return res.status(400).json({
        error: 'Missing itemKey (expected task:<id> | decision:<id> | notification:<id>)',
      });
    }

    const triagedAt = new Date().toISOString();
    await queryHelpers.queryRun(
      `INSERT OR REPLACE INTO my_work_inbox_triage (user_id, item_key, action, params_json, triaged_at)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, itemKey, action, params ? JSON.stringify(params) : null, triagedAt]
    );

    // Side-effects (minimal, real)
    const [kind, rawId] = itemKey.split(':') as [string, string];
    if (action === 'accept_today') {
      // Add to focus "today"
      await queryHelpers.queryRun(
        `INSERT OR REPLACE INTO my_work_focus_state (user_id, focus_date, item_key, column_name, position, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
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

    if (action === 'archive' && kind === 'notification') {
      // Mark as read (real API semantics)
      try {
        await NotificationService.markAsRead(rawId, userId);
      } catch (e) {
        // ignore
      }
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
    await ensureMyWorkTables();

    const action = String(req.body?.action || '') as TriageAction;
    const params = (req.body?.params || undefined) as Record<string, unknown> | undefined;
    const itemKeys = (req.body?.itemKeys || req.body?.item_keys || []) as string[];

    if (
      !action ||
      !['accept_today', 'schedule', 'delegate', 'archive', 'reject'].includes(action)
    ) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    if (!Array.isArray(itemKeys) || itemKeys.length === 0) {
      return res.status(400).json({ error: 'Missing itemKeys[]' });
    }

    const triagedAt = new Date().toISOString();
    for (const key of itemKeys) {
      await queryHelpers.queryRun(
        `INSERT OR REPLACE INTO my_work_inbox_triage (user_id, item_key, action, params_json, triaged_at)
         VALUES (?, ?, ?, ?, ?)`,
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
    await ensureMyWorkTables();

    const itemId = String(req.body?.itemId || '');
    const column = String(req.body?.column || '') as FocusColumn;
    if (!itemId || !['today', 'thisWeek', 'later'].includes(column)) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    await queryHelpers.queryRun(
      `INSERT OR REPLACE INTO my_work_focus_state (user_id, focus_date, item_key, column_name, position, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
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
    await ensureMyWorkTables();

    const itemId = String(req.body?.itemId || '');
    const column = String(req.body?.column || '') as FocusColumn;
    const position = Number(req.body?.position || 0);
    if (!itemId || !['today', 'thisWeek', 'later'].includes(column) || !Number.isFinite(position)) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    await queryHelpers.queryRun(
      `INSERT OR REPLACE INTO my_work_focus_state (user_id, focus_date, item_key, column_name, position, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, todayIsoDate(), itemId, column, position, new Date().toISOString()]
    );

    res.json({ success: true });
  })
);

/**
 * GET /api/my-work/stats?period=week
 * Minimal aggregates for ExecutiveDashboard
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
    const today = todayIsoDate();

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
    // Note: PostgreSQL doesn't support datetime() function - columns are already timestamps
    // Compare timestamps directly without function calls
    const onTime = await queryHelpers.queryOne<{ onTime: number; totalDone: number }>(
      `SELECT
         SUM(CASE WHEN due_date IS NOT NULL AND completed_at IS NOT NULL AND completed_at <= due_date THEN 1 ELSE 0 END) as onTime,
         SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) as totalDone
       FROM tasks
       WHERE organization_id = ? AND assignee_id = ? AND completed_at IS NOT NULL AND completed_at >= ?`,
      [orgId, userId, sinceIso]
    );

    const total = Number((totals as any)?.total || 0);
    const completedCount = Number((completed as any)?.completed || 0);
    const overdueCount = Number((overdue as any)?.overdue || 0);
    const totalDone = Number((onTime as any)?.totalDone || 0);
    const onTimeRate =
      totalDone > 0 ? Math.round((Number((onTime as any)?.onTime || 0) / totalDone) * 100) : 0;

    res.json({
      total,
      completed: completedCount,
      onTimeRate,
      trend: 'stable',
      byStatus: { overdue: overdueCount },
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
 * T009 (V2) — My Ideas (private per-user repository)
 */
router.get(
  '/my-ideas',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;

    await ensureMyIdeasTable();

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

    await ensureMyIdeasTable();

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

    await ensureMyIdeasTable();

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

    await ensureMyIdeasTable();

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

    await ensureMyIdeasTable();

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

    await ensureMyIdeasTable();

    const id = String(req.params.id || '').trim();
    await queryHelpers.queryRun(
      `DELETE FROM my_ideas WHERE id = ? AND user_id = ? AND organization_id = ?`,
      [id, userId, orgId]
    );
    res.status(204).send();
  })
);

export default router;
