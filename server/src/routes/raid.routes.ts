/**
 * RAID Routes (Risks, Actions, Issues, Dependencies)
 * API endpoints for RAID log management
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
  const { projectId, type } = req.query;
  let query = `SELECT id, project_id, type, title, description, severity, status, 
               owner_id, due_date, created_at FROM raid_items WHERE organization_id = ?`;
  const params: any[] = [orgId];
  if (projectId) { query += ' AND project_id = ?'; params.push(projectId); }
  if (type) { query += ' AND type = ?'; params.push(type); }
  query += ' ORDER BY severity DESC, created_at DESC';
  res.json(await dbAll(query, params) || []);
}));

router.post('/', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const orgId = req.user?.organizationId;
  const userId = req.user?.id;
  const { projectId, type, title, description, severity, ownerId, dueDate } = req.body;
  if (!type || !title) return res.status(400).json({ error: 'Type and title required' });
  const id = uuidv4();
  await dbRun(`
    INSERT INTO raid_items (id, organization_id, project_id, type, title, description, 
                            severity, status, owner_id, due_date, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, datetime('now'))
  `, [id, orgId, projectId, type, title, description || '', severity || 'medium', ownerId || userId, dueDate, userId]);
  res.status(201).json({ success: true, id });
}));

router.put('/:id', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { title, description, severity, status, ownerId, dueDate } = req.body;
  const updates: string[] = []; const params: any[] = [];
  if (title) { updates.push('title = ?'); params.push(title); }
  if (description) { updates.push('description = ?'); params.push(description); }
  if (severity) { updates.push('severity = ?'); params.push(severity); }
  if (status) { updates.push('status = ?'); params.push(status); }
  if (ownerId) { updates.push('owner_id = ?'); params.push(ownerId); }
  if (dueDate) { updates.push('due_date = ?'); params.push(dueDate); }
  if (!updates.length) return res.status(400).json({ error: 'No updates' });
  params.push(req.params.id);
  await dbRun(`UPDATE raid_items SET ${updates.join(', ')} WHERE id = ?`, params);
  res.json({ success: true });
}));

router.delete('/:id', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  await dbRun('DELETE FROM raid_items WHERE id = ?', [req.params.id]);
  res.json({ success: true });
}));

router.get('/summary', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const orgId = req.user?.organizationId;
  const summary = await dbAll(`
    SELECT type, status, COUNT(*) as count FROM raid_items
    WHERE organization_id = ? GROUP BY type, status
  `, [orgId]);
  res.json(summary || []);
}));

export default router;
