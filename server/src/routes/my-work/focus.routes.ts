/**
 * Focus sub-router — extracted from my-work.routes.ts
 *
 * Handles /focus/move, /focus/reorder, /focus/rules, /focus/state, /focus/item.
 * POST /focus/ai-plan remains in the monolith (AI/aux section).
 * Mounted under /api/my-work by the parent router.
 */

import type { Response } from 'express';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getTableColumns } from '../../utils/dbSchema.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import { requireTables, requireUser } from './_helpers.js';

const router = Router();

type FocusColumn = 'today' | 'thisWeek' | 'later';

const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);

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
 * GET /api/my-work/focus/rules (V4-INBX-02)
 * Returns focus board rules: max_today, max_week, capacity_aware.
 */
router.get(
  '/focus/rules',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    const rulesTable = await getTableColumns('my_work_focus_rules');
    if (!rulesTable || rulesTable.size === 0) {
      return res.json({
        maxToday: 5,
        maxWeek: 15,
        capacityAware: true,
      });
    }

    const row = await queryHelpers.queryOne<{
      max_today: number;
      max_week: number;
      capacity_aware: number;
    }>(`SELECT max_today, max_week, capacity_aware FROM my_work_focus_rules WHERE user_id = ?`, [
      userId,
    ]);
    if (!row) {
      return res.json({ maxToday: 5, maxWeek: 15, capacityAware: true });
    }
    res.json({
      maxToday: row.max_today ?? 5,
      maxWeek: row.max_week ?? 15,
      capacityAware: Boolean(row.capacity_aware),
    });
  })
);

/**
 * PUT /api/my-work/focus/rules (V4-INBX-02)
 * Body: { maxToday?, maxWeek?, capacityAware? }
 */
router.put(
  '/focus/rules',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const identity = requireUser(req, res);
    if (!identity) return;
    const { userId, orgId } = identity;
    const rulesTable = await getTableColumns('my_work_focus_rules');
    if (!rulesTable || rulesTable.size === 0) {
      return res.status(503).json({ error: 'Focus rules table not available' });
    }

    const maxToday =
      typeof req.body?.maxToday === 'number'
        ? Math.max(1, Math.min(20, req.body.maxToday))
        : undefined;
    const maxWeek =
      typeof req.body?.maxWeek === 'number'
        ? Math.max(1, Math.min(50, req.body.maxWeek))
        : undefined;
    const capacityAware =
      typeof req.body?.capacityAware === 'boolean' ? req.body.capacityAware : undefined;

    const existing = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM my_work_focus_rules WHERE user_id = ?`,
      [userId]
    );

    const now = new Date().toISOString();
    if (existing) {
      const updates: string[] = ['updated_at = ?'];
      const params: unknown[] = [now];
      if (maxToday != null) {
        updates.push('max_today = ?');
        params.push(maxToday);
      }
      if (maxWeek != null) {
        updates.push('max_week = ?');
        params.push(maxWeek);
      }
      if (capacityAware != null) {
        updates.push('capacity_aware = ?');
        params.push(capacityAware ? 1 : 0);
      }
      params.push(userId);
      await queryHelpers.queryRun(
        `UPDATE my_work_focus_rules SET ${updates.join(', ')} WHERE user_id = ?`,
        params
      );
    } else {
      await queryHelpers.queryRun(
        `INSERT INTO my_work_focus_rules (id, user_id, organization_id, max_today, max_week, capacity_aware, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          userId,
          orgId,
          maxToday ?? 5,
          maxWeek ?? 15,
          capacityAware !== false ? 1 : 0,
          now,
          now,
        ]
      );
    }
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

export default router;
