/**
 * Context Routes
 * API endpoints for AI context management
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import organizationContextService from '../services/organizationContext/OrganizationContextService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

const contextBelongsToOrg = async (
  contextId: string,
  organizationId: string | undefined
): Promise<boolean> => {
  if (!organizationId) return false;
  const row = (await dbGet('SELECT organization_id FROM ai_contexts WHERE id = ?', [
    contextId,
  ])) as {
    organization_id?: string;
  } | null;
  return row?.organization_id === organizationId;
};

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    const contexts = await dbAll(
      `
    SELECT id, name, type, content, is_active, priority, created_at
    FROM ai_contexts WHERE (user_id = ? OR organization_id = ?) AND is_active = 1
    ORDER BY priority DESC, created_at DESC
  `,
      [userId, orgId]
    );
    res.json(contexts || []);
  })
);

router.post(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    const { name, type, content, priority } = req.body;
    if (!name || !content) return res.status(400).json({ error: 'Name and content required' });
    const id = uuidv4();
    await dbRun(
      `
    INSERT INTO ai_contexts (id, user_id, organization_id, name, type, content, is_active, priority, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))
  `,
      [id, userId, orgId, name, type || 'custom', content, priority || 0]
    );
    if (orgId) {
      await organizationContextService.recordManualAIContext({
        organizationId: orgId,
        userId: userId || null,
        contextId: id,
        payload: { name, type: type || 'custom', content, priority: priority || 0 },
      });
    }
    res.status(201).json({ success: true, id });
  })
);

router.put(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const orgId = req.user?.organizationId;
    if (!(await contextBelongsToOrg(id, orgId))) {
      return res.status(404).json({ error: 'Context not found' });
    }
    const { name, content, isActive, priority } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (content !== undefined) {
      updates.push('content = ?');
      params.push(content);
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      params.push(priority);
    }
    if (!updates.length) return res.status(400).json({ error: 'No updates' });
    params.push(id);
    await dbRun(`UPDATE ai_contexts SET ${updates.join(', ')} WHERE id = ?`, params);
    const row = (await dbGet(`SELECT name, type, content, priority FROM ai_contexts WHERE id = ?`, [
      id,
    ])) as { name?: string; type?: string; content?: string; priority?: number } | null;
    if (orgId && row) {
      await organizationContextService.recordManualAIContext({
        organizationId: orgId,
        userId: req.user?.id || null,
        contextId: id,
        payload: {
          name: row.name,
          type: row.type,
          content: row.content,
          priority: row.priority,
          isActive,
        },
      });
    }
    res.json({ success: true });
  })
);

router.delete(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!(await contextBelongsToOrg(req.params.id, req.user?.organizationId))) {
      return res.status(404).json({ error: 'Context not found' });
    }
    await dbRun('DELETE FROM ai_contexts WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  })
);

export default router;
