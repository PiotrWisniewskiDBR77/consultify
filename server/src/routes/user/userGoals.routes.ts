/**
 * User Goals Routes
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { isAuthenticated, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, run as dbRun } from '../../utils/DbPromise.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string };
}

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json(
      (await dbAll(
        `SELECT id, title, description, target_date, progress_pct, status, created_at
    FROM user_goals WHERE user_id = ? ORDER BY target_date ASC`,
        [req.user?.id]
      )) || []
    );
  })
);

router.post(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { title, description, targetDate } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required' });
    const id = uuidv4();
    await dbRun(
      `INSERT INTO user_goals (id, user_id, title, description, target_date, progress_pct, status, created_at)
    VALUES (?, ?, ?, ?, ?, 0, 'active', datetime('now'))`,
      [id, req.user?.id, title, description || '', targetDate]
    );
    res.status(201).json({ success: true, id });
  })
);

router.put(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { title, progressPct, status } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    if (title) {
      updates.push('title = ?');
      params.push(title);
    }
    if (progressPct !== undefined) {
      updates.push('progress_pct = ?');
      params.push(progressPct);
    }
    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (!updates.length) return res.status(400).json({ error: 'No updates' });
    params.push(req.params.id, req.user?.id);
    await dbRun(`UPDATE user_goals SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);
    res.json({ success: true });
  })
);

router.delete(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await dbRun('DELETE FROM user_goals WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user?.id,
    ]);
    res.json({ success: true });
  })
);

export default router;
