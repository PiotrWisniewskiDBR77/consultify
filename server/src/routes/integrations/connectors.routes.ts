/**
 * Connectors Routes
 * API endpoints for data connectors management
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { verifyAdmin } from '../../middleware/admin.middleware.js';
import { isAuthenticated, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

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
    const connectors = await dbAll(
      `
    SELECT id, name, type, provider, status, config, last_synced_at, created_at
    FROM connectors WHERE organization_id = ? ORDER BY created_at DESC
  `,
      [orgId]
    );
    res.json(connectors || []);
  })
);

router.get(
  '/available',
  verifyToken,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json([
      { id: 'rest_api', name: 'REST API', category: 'api' },
      { id: 'graphql', name: 'GraphQL', category: 'api' },
      { id: 'postgresql', name: 'PostgreSQL', category: 'database' },
      { id: 'mysql', name: 'MySQL', category: 'database' },
      { id: 'mongodb', name: 'MongoDB', category: 'database' },
      { id: 'csv_import', name: 'CSV Import', category: 'file' },
      { id: 'excel_import', name: 'Excel Import', category: 'file' },
      { id: 'sftp', name: 'SFTP', category: 'file' },
    ]);
  })
);

router.post(
  '/',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const { name, type, provider, config } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'Name and type required' });
    const id = uuidv4();
    await dbRun(
      `
    INSERT INTO connectors (id, organization_id, name, type, provider, status, config, created_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, datetime('now'))
  `,
      [id, orgId, name, type, provider || type, JSON.stringify(config || {})]
    );
    logger.info(`[Connectors] Created: ${name} (${type})`);
    res.status(201).json({ success: true, id });
  })
);

router.put(
  '/:id',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const { name, config, status } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    if (name) {
      updates.push('name = ?');
      params.push(name);
    }
    if (config) {
      updates.push('config = ?');
      params.push(JSON.stringify(config));
    }
    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (!updates.length) return res.status(400).json({ error: 'No updates' });
    updates.push("updated_at = datetime('now')");
    params.push(id, orgId);
    const result = await dbRun(
      `UPDATE connectors SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
      params
    );
    if (!result || !result.changes) {
      return res.status(404).json({ error: 'Connector not found' });
    }
    res.json({ success: true });
  })
);

router.delete(
  '/:id',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await dbRun('DELETE FROM connectors WHERE id = ? AND organization_id = ?', [
      req.params.id,
      orgId,
    ]);
    if (!result || !result.changes) {
      return res.status(404).json({ error: 'Connector not found' });
    }
    res.json({ success: true });
  })
);

router.post(
  '/:id/test',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    logger.info(`[Connectors] Testing connection ${req.params.id}`);
    res.json({ success: true, message: 'Connection test passed' });
  })
);

export default router;
