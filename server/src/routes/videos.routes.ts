/**
 * Videos Routes - API endpoints for video content management
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
    const { category, status } = req.query;
    let query =
      'SELECT id, title, description, url, thumbnail_url, duration, category, status, created_at FROM videos WHERE organization_id = ?';
    const params: any[] = [orgId];
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    res.json((await dbAll(query + ' ORDER BY created_at DESC', params)) || []);
  })
);

router.post(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const { title, description, url, thumbnailUrl, duration, category } = req.body;
    if (!title || !url) return res.status(400).json({ error: 'Title and URL required' });
    const id = uuidv4();
    await dbRun(
      `INSERT INTO videos (id, organization_id, title, description, url, thumbnail_url, duration, category, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))`,
      [id, orgId, title, description || '', url, thumbnailUrl, duration || 0, category || 'general']
    );
    res.status(201).json({ success: true, id });
  })
);

router.delete(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await dbRun('DELETE FROM videos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  })
);

export default router;
