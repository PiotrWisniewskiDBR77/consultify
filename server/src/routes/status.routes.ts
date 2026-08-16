/**
 * Status Routes
 * API endpoints for project/initiative status tracking
 */
import { Request, Response, Router } from 'express';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

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
    const statuses = await dbAll(
      `
    SELECT p.id, p.name, p.status, p.health, p.progress_pct, p.updated_at,
           (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status != 'completed') as open_tasks
    FROM projects p WHERE p.organization_id = ?
    ORDER BY p.updated_at DESC
  `,
      [orgId]
    );
    res.json(
      (statuses || []).map((status: any) => ({
        ...status,
        progress_pct: status.progress_pct == null ? status.progress_pct : Number(status.progress_pct),
        open_tasks: Number(status.open_tasks || 0),
      }))
    );
  })
);

router.get(
  '/overview',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const overview = await dbGet(
      `
    SELECT COUNT(*) as total,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN health = 'red' THEN 1 ELSE 0 END) as at_risk,
           AVG(progress_pct) as avg_progress
    FROM projects WHERE organization_id = ?
  `,
      [orgId]
    );
    if (!overview) {
      return res.json({ total: 0, active: 0, completed: 0, at_risk: 0, avg_progress: 0 });
    }
    return res.json({
      ...overview,
      total: Number((overview as any).total || 0),
      active: Number((overview as any).active || 0),
      completed: Number((overview as any).completed || 0),
      at_risk: Number((overview as any).at_risk || 0),
      avg_progress: Number((overview as any).avg_progress || 0),
    });
  })
);

router.put(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status, health, progressPct } = req.body;
    const updates: string[] = ["updated_at = datetime('now')"];
    const params: any[] = [];
    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (health) {
      updates.push('health = ?');
      params.push(health);
    }
    if (progressPct !== undefined) {
      updates.push('progress_pct = ?');
      params.push(progressPct);
    }
    params.push(req.params.id);
    await dbRun(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true });
  })
);

export default router;
