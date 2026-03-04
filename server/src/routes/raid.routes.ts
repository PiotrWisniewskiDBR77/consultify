/**
 * RAID Routes (Risks, Actions, Issues, Dependencies)
 * API endpoints for RAID log management
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

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const { projectId, initiativeId, type } = req.query;
    let query = `SELECT id, initiative_id as initiativeId, type, title, description, 
               impact as severity, status, owner_id as ownerId, due_date as dueDate, 
               probability, impact, created_at as createdAt FROM raid_items WHERE organization_id = ?`;
    const params: any[] = [orgId];
    if (initiativeId) {
      query += ' AND initiative_id = ?';
      params.push(initiativeId);
    }
    if (projectId) {
      query += ' AND initiative_id IN (SELECT id FROM initiatives WHERE project_id = ? AND organization_id = ?)';
      params.push(projectId, orgId);
    }
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    query += ' ORDER BY created_at DESC';
    const rows = (await dbAll(query, params)) || [];
    res.json(Array.isArray(rows) ? rows : []);
  })
);

router.post(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const { projectId, initiativeId, type, title, description, severity, ownerId, dueDate } = req.body;
    if (!type || !title) return res.status(400).json({ error: 'Type and title required' });
    const id = uuidv4();
    const initId = initiativeId || null;
    const impactVal = severity ? String(severity).toUpperCase() : null;
    await dbRun(
      `
    INSERT INTO raid_items (id, organization_id, initiative_id, type, title, description, 
                            impact, status, owner_id, due_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, datetime('now'), datetime('now'))
  `,
      [
        id,
        orgId,
        initId,
        String(type).toUpperCase(),
        title,
        description || '',
        impactVal,
        ownerId || userId,
        dueDate || null,
      ]
    );
    res.status(201).json({ success: true, id });
  })
);

router.put(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { title, description, severity, status, ownerId, dueDate } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (severity !== undefined) {
      updates.push('impact = ?');
      params.push(String(severity).toUpperCase());
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(String(status).toUpperCase());
    }
    if (ownerId !== undefined) {
      updates.push('owner_id = ?');
      params.push(ownerId);
    }
    if (dueDate !== undefined) {
      updates.push('due_date = ?');
      params.push(dueDate);
    }
    if (!updates.length) return res.status(400).json({ error: 'No updates' });
    updates.push("updated_at = datetime('now')");
    params.push(req.params.id);
    await dbRun(`UPDATE raid_items SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true });
  })
);

router.patch(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ error: 'status required' });
    await dbRun(`UPDATE raid_items SET status = ?, updated_at = datetime('now') WHERE id = ?`, [
      String(status).toUpperCase(),
      req.params.id,
    ]);
    res.json({ success: true });
  })
);

router.delete(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await dbRun('DELETE FROM raid_items WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  })
);

router.get(
  '/summary',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const summary = await dbAll(
      `
    SELECT type, status, COUNT(*) as count FROM raid_items
    WHERE organization_id = ? GROUP BY type, status
  `,
      [orgId]
    );
    res.json(summary || []);
  })
);

export default router;
