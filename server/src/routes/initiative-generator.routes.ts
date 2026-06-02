/**
 * Initiative Generator Routes - AI-powered initiative generation
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
        `SELECT id, title, description, source, priority, status, estimated_impact, created_at
    FROM generated_initiatives WHERE organization_id = ? ORDER BY priority DESC, created_at DESC`,
        [orgId]
      )) || []
    );
  })
);

router.post(
  '/generate',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { source, context, assessmentId } = req.body;
    const id = uuidv4();
    // Portable timestamp (ISO string) so the INSERT works on both SQLite and
    // Postgres — `datetime('now')` is SQLite-only and breaks on Postgres.
    const createdAt = new Date().toISOString();
    await dbRun(
      `INSERT INTO generated_initiatives (id, organization_id, title, description, source, priority, status, assessment_id, created_by, created_at)
    VALUES (?, ?, 'AI Generated Initiative', ?, ?, 'medium', 'draft', ?, ?, ?)`,
      [
        id,
        orgId,
        JSON.stringify(context || {}),
        source || 'manual',
        assessmentId ?? null,
        userId ?? null,
        createdAt,
      ]
    );
    res.json({ success: true, id, message: 'Initiative generation started' });
  })
);

router.put(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { title, description, priority, status } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    if (title) {
      updates.push('title = ?');
      params.push(title);
    }
    if (description) {
      updates.push('description = ?');
      params.push(description);
    }
    if (priority) {
      updates.push('priority = ?');
      params.push(priority);
    }
    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (!updates.length) return res.status(400).json({ error: 'No updates' });
    params.push(req.params.id);
    await dbRun(`UPDATE generated_initiatives SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true });
  })
);

export default router;
