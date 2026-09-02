/**
 * Videos Routes - API endpoints for video content management
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

const videoBelongsToOrg = async (
  videoId: string,
  organizationId: string | undefined
): Promise<boolean> => {
  if (!organizationId) return false;
  const row = (await dbGet('SELECT organization_id FROM videos WHERE id = ?', [videoId])) as {
    organization_id?: string;
  } | null;
  return row?.organization_id === organizationId;
};

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
    if (!(await videoBelongsToOrg(req.params.id, req.user?.organizationId))) {
      return res.status(404).json({ error: 'Video not found' });
    }
    await dbRun('DELETE FROM videos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  })
);

export default router;
