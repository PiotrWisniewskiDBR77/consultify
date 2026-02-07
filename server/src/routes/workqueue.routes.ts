/**
 * Work Queue Routes
 * API endpoints for task queue management
 */
import { Router, Request, Response } from 'express';
import { verifyToken, isAuthenticated } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
interface AuthRequest extends Request { user?: { id: string; organizationId: string }; }

router.get('/', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const orgId = req.user?.organizationId;
  const { status = 'pending', limit = '50' } = req.query;
  const items = await dbAll(`
    SELECT id, title, type, priority, status, assigned_to, due_date, created_at
    FROM work_queue WHERE organization_id = ? AND status = ?
    ORDER BY priority DESC, created_at ASC LIMIT ?
  `, [orgId, status, parseInt(limit as string)]);
  res.json(items || []);
}));

router.post('/', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const orgId = req.user?.organizationId;
  const userId = req.user?.id;
  const { title, type, priority, assignedTo, dueDate, metadata } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const id = uuidv4();
  await dbRun(`
    INSERT INTO work_queue (id, organization_id, title, type, priority, status, 
                            assigned_to, due_date, metadata, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, datetime('now'))
  `, [id, orgId, title, type || 'task', priority || 'medium', assignedTo, dueDate, JSON.stringify(metadata || {}), userId]);
  res.status(201).json({ success: true, id });
}));

router.put('/:id/claim', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  await dbRun(`
    UPDATE work_queue SET assigned_to = ?, status = 'in_progress', updated_at = datetime('now')
    WHERE id = ? AND status = 'pending'
  `, [userId, req.params.id]);
  res.json({ success: true });
}));

router.put('/:id/complete', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  await dbRun(`
    UPDATE work_queue SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `, [req.params.id]);
  res.json({ success: true });
}));

router.delete('/:id', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  await dbRun('DELETE FROM work_queue WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));

export default router;
