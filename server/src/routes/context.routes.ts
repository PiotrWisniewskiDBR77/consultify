/**
 * Context Routes
 * API endpoints for AI context management
 */
import { Router, Request, Response } from 'express';
import { verifyToken, isAuthenticated } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
interface AuthRequest extends Request { user?: { id: string; organizationId: string }; }

router.get('/', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const orgId = req.user?.organizationId;
  const contexts = await dbAll(`
    SELECT id, name, type, content, is_active, priority, created_at
    FROM ai_contexts WHERE (user_id = ? OR organization_id = ?) AND is_active = 1
    ORDER BY priority DESC, created_at DESC
  `, [userId, orgId]);
  res.json(contexts || []);
}));

router.post('/', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const orgId = req.user?.organizationId;
  const { name, type, content, priority } = req.body;
  if (!name || !content) return res.status(400).json({ error: 'Name and content required' });
  const id = uuidv4();
  await dbRun(`
    INSERT INTO ai_contexts (id, user_id, organization_id, name, type, content, is_active, priority, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))
  `, [id, userId, orgId, name, type || 'custom', content, priority || 0]);
  res.status(201).json({ success: true, id });
}));

router.put('/:id', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, content, isActive, priority } = req.body;
  const updates: string[] = []; const params: any[] = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (content !== undefined) { updates.push('content = ?'); params.push(content); }
  if (isActive !== undefined) { updates.push('is_active = ?'); params.push(isActive ? 1 : 0); }
  if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }
  if (!updates.length) return res.status(400).json({ error: 'No updates' });
  params.push(id);
  await dbRun(`UPDATE ai_contexts SET ${updates.join(', ')} WHERE id = ?`, params);
  res.json({ success: true });
}));

router.delete('/:id', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  await dbRun('DELETE FROM ai_contexts WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));

export default router;
