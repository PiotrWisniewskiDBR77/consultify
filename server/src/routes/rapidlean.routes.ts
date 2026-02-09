/**
 * Rapid Lean Routes - Lean assessment functionality
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
  '/assessments',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    res.json(
      (await dbAll(
        `SELECT id, title, methodology, score, status, created_at
    FROM rapid_lean_assessments WHERE organization_id = ? ORDER BY created_at DESC`,
        [orgId]
      )) || []
    );
  })
);

router.post(
  '/assessments',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { title, methodology, dimensions } = req.body;
    const id = uuidv4();
    await dbRun(
      `INSERT INTO rapid_lean_assessments (id, organization_id, title, methodology, dimensions, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'draft', datetime('now'))`,
      [
        id,
        req.user?.organizationId,
        title || 'Rapid Lean Assessment',
        methodology || 'lean_4_0',
        JSON.stringify(dimensions || {}),
      ]
    );
    res.status(201).json({ success: true, id });
  })
);

router.put(
  '/assessments/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { score, status, dimensions } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    if (score !== undefined) {
      updates.push('score = ?');
      params.push(score);
    }
    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (dimensions) {
      updates.push('dimensions = ?');
      params.push(JSON.stringify(dimensions));
    }
    if (!updates.length) return res.status(400).json({ error: 'No updates' });
    params.push(req.params.id);
    await dbRun(`UPDATE rapid_lean_assessments SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true });
  })
);

export default router;
