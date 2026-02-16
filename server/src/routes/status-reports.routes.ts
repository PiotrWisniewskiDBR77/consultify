/**
 * Status Reports Routes
 * API endpoints for project status reports
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
    const { projectId } = req.query;
    let query =
      'SELECT id, project_id, title, content, health, period, created_by, created_at FROM status_reports WHERE organization_id = ?';
    const params: any[] = [orgId];
    if (projectId) {
      query += ' AND project_id = ?';
      params.push(projectId);
    }
    query += ' ORDER BY created_at DESC LIMIT 50';
    res.json((await dbAll(query, params)) || []);
  })
);

router.post(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { projectId, title, content, health, period } = req.body;
    const id = uuidv4();
    await dbRun(
      `INSERT INTO status_reports (id, organization_id, project_id, title, content, health, period, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        id,
        orgId,
        projectId,
        title || 'Status Report',
        JSON.stringify(content || {}),
        health || 'green',
        period || 'weekly',
        userId,
      ]
    );
    res.status(201).json({ success: true, id });
  })
);

router.delete(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await dbRun('DELETE FROM status_reports WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  })
);

export default router;
