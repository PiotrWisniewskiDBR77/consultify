/**
 * User Settings Templates Routes
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
    const templates = await dbAll(
      `SELECT id, name, settings, is_default, created_at
    FROM user_settings_templates WHERE user_id = ? OR is_global = 1 ORDER BY name`,
      [req.user?.id]
    );
    res.json(templates || []);
  })
);

router.post(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, settings } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const id = uuidv4();
    await dbRun(
      `INSERT INTO user_settings_templates (id, user_id, name, settings, is_default, is_global, created_at)
    VALUES (?, ?, ?, ?, 0, 0, datetime('now'))`,
      [id, req.user?.id, name, JSON.stringify(settings || {})]
    );
    res.status(201).json({ success: true, id });
  })
);

router.post(
  '/:id/apply',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // In production, apply template settings to user
    res.json({ success: true, message: 'Template applied' });
  })
);

router.delete(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await dbRun('DELETE FROM user_settings_templates WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user?.id,
    ]);
    res.json({ success: true });
  })
);

export default router;
