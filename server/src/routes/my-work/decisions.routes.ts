/**
 * Decisions sub-router — extracted from my-work.routes.ts
 *
 * Handles /decisions, /decisions/queue, snooze/unsnooze, and /decisions/preferences.
 * Mounted under /api/my-work by the parent aggregator.
 *
 * Note: GET /decisions/:id/brief remains in the monolith (AI/aux section).
 */

import type { Response } from 'express';
import { Router } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getTableColumns } from '../../utils/dbSchema.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import { requireTables, requireUser } from './_helpers.js';

const router = Router();

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
  if (p === 'week' || p === 'next_week')
    return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
  return new Date(now + 24 * 60 * 60 * 1000).toISOString();
};

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
    // Mirror the Initiatives `?source` filter (e.g. ?source=interview_insight).
    const normalizedSourceFilter = req.query.source
      ? String(req.query.source).trim().toLowerCase()
      : '';

    const decisionCols = await getTableColumns('decisions');
    const prioritySelect = decisionCols.has('priority') ? 'd.priority' : `'MEDIUM' as priority`;
    const impactSelect = decisionCols.has('impact') ? 'd.impact' : `'MEDIUM' as impact`;
    const dSourceTypeSelect = decisionCols.has('source_type')
      ? 'd.source_type'
      : 'NULL as source_type';
    const dSourceIdSelect = decisionCols.has('source_id') ? 'd.source_id' : 'NULL as source_id';
    const workflowStatusSelect = decisionCols.has('workflow_status')
      ? 'd.workflow_status'
      : `'proposed' as workflow_status`;

    // Source lineage filter (org scope preserved below). No-ops when the
    // source_type column is absent.
    const applySourceFilter = !!(normalizedSourceFilter && decisionCols.has('source_type'));
    const sourceWhere = applySourceFilter ? `AND LOWER(COALESCE(d.source_type, '')) = ?` : '';

    const rows =
      (await queryHelpers.queryAll<any>(
        `
        SELECT
          d.id,
          d.title,
          d.description,
          d.type as "decisionType",
          d.status,
          ${workflowStatusSelect} as "workflowStatus",
          ${prioritySelect},
          ${impactSelect},
          d.deadline as "dueDate",
          d.created_at as "createdAt",
          p.name as "projectName",
          requester.first_name || ' ' || requester.last_name as "requestedByName",
          ${dSourceTypeSelect} as "sourceType",
          ${dSourceIdSelect} as "sourceId"
        FROM decisions d
        LEFT JOIN projects p ON d.project_id = p.id
        LEFT JOIN users requester ON d.created_by = requester.id
        WHERE d.organization_id = ?
          AND d.decision_maker_id = ?
          ${onlyPending ? "AND lower(coalesce(d.status,'')) IN ('pending','escalated')" : ''}
          ${sourceWhere}
        ORDER BY d.created_at DESC
        LIMIT ?
      `,
        [orgId, userId, ...(applySourceFilter ? [normalizedSourceFilter] : []), limit]
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

    const modeRaw = String(req.query.mode || 'my')
      .trim()
      .toLowerCase();
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
    const workflowStatusSelect = decisionCols.has('workflow_status')
      ? 'd.workflow_status'
      : `'proposed' as workflow_status`;

    // For "requests pending" we rely on decisions.created_by (canonical).
    if (!decisionCols.has('created_by')) {
      return res.status(503).json({
        statusCode: 503,
        status: false,
        type: 'not_configured',
        message: 'Service temporarily unavailable due to missing configuration',
      });
    }

    const prioritySelect = hasPriority ? 'd.priority' : `'MEDIUM' as priority`;
    const impactSelect = hasImpact ? 'd.impact' : `'MEDIUM' as impact`;
    const escalationSelect = hasEscalationLevelCol
      ? 'd.escalation_level'
      : `'none' as escalation_level`;

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
          d.type as "decisionType",
          d.status,
          ${workflowStatusSelect} as "workflowStatus",
          ${prioritySelect},
          ${impactSelect},
          ${escalationSelect},
          d.deadline as "dueDate",
          d.created_at as "createdAt",
          d.updated_at as "updatedAt",
          d.project_id as "projectId",
          d.initiative_id as "initiativeId",
          d.task_id as "taskId",
          d.decision_maker_id as "decisionOwnerId",
          d.created_by as "requestedById",
          owner.first_name || ' ' || owner.last_name as "ownerName",
          requester.first_name || ' ' || requester.last_name as "requestedByName",
          p.name as "projectName",
          (SELECT COUNT(*) FROM decision_impacts di WHERE di.decision_id = d.id AND di.is_blocker = TRUE) as "blockedItemsCount",
          s.snoozed_until as "snoozedUntil"
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
        ? req.body.prefs && typeof req.body.prefs === 'object'
          ? req.body.prefs
          : req.body
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

export default router;
