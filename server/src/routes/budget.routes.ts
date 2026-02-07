/**
 * Budget Routes
 * API endpoints for project budget management
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const { projectId } = req.query;
    let query = `SELECT id, project_id, category, planned_amount, actual_amount, currency, 
               period_start, period_end, created_at FROM budgets WHERE organization_id = ?`;
    const params: any[] = [orgId];
    if (projectId) {
      query += ' AND project_id = ?';
      params.push(projectId);
    }
    query += ' ORDER BY created_at DESC';
    const budgets = await dbAll(query, params);
    res.json(budgets || []);
  })
);

router.get(
  '/summary',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const summary = await dbGet(
      `
    SELECT SUM(planned_amount) as total_planned, SUM(actual_amount) as total_actual,
           COUNT(*) as budget_count
    FROM budgets WHERE organization_id = ?
  `,
      [orgId]
    );
    res.json(summary || { total_planned: 0, total_actual: 0, budget_count: 0 });
  })
);

router.post(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const { projectId, category, plannedAmount, currency, periodStart, periodEnd } = req.body;
    const id = uuidv4();
    await dbRun(
      `
    INSERT INTO budgets (id, organization_id, project_id, category, planned_amount, 
                         actual_amount, currency, period_start, period_end, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, datetime('now'))
  `,
      [
        id,
        orgId,
        projectId,
        category || 'general',
        plannedAmount || 0,
        currency || 'USD',
        periodStart,
        periodEnd,
      ]
    );
    logger.info(`[Budget] Created budget ${id}`);
    res.status(201).json({ success: true, id });
  })
);

router.put(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { plannedAmount, actualAmount, category } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    if (plannedAmount !== undefined) {
      updates.push('planned_amount = ?');
      params.push(plannedAmount);
    }
    if (actualAmount !== undefined) {
      updates.push('actual_amount = ?');
      params.push(actualAmount);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category);
    }
    if (!updates.length) return res.status(400).json({ error: 'No updates' });
    params.push(id);
    await dbRun(`UPDATE budgets SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true });
  })
);

router.delete(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await dbRun('DELETE FROM budgets WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  })
);

export default router;
