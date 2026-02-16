/**
 * Multi-Framework Workflow Routes
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';

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
    res.json(
      (await dbAll(
        `SELECT id, name, frameworks, status, progress_pct, created_at
    FROM multi_framework_workflows WHERE organization_id = ? ORDER BY created_at DESC`,
        [orgId]
      )) || []
    );
  })
);

router.post(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, frameworks } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const id = uuidv4();
    await dbRun(
      `INSERT INTO multi_framework_workflows (id, organization_id, name, frameworks, status, progress_pct, created_at)
    VALUES (?, ?, ?, ?, 'active', 0, datetime('now'))`,
      [id, req.user?.organizationId, name, JSON.stringify(frameworks || [])]
    );
    res.status(201).json({ success: true, id });
  })
);

router.put(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status, progressPct } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (progressPct !== undefined) {
      updates.push('progress_pct = ?');
      params.push(progressPct);
    }
    if (!updates.length) return res.status(400).json({ error: 'No updates' });
    params.push(req.params.id);
    await dbRun(`UPDATE multi_framework_workflows SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true });
  })
);

export default router;
