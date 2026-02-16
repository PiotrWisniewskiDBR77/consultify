/**
 * Framework RBAC Routes - Role-Based Access Control for frameworks
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { verifyAdmin } from '../middleware/admin.middleware.js';
import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

router.get(
  '/roles',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    res.json(
      (await dbAll(
        `SELECT id, name, permissions, framework_id, created_at
    FROM framework_roles WHERE organization_id = ? ORDER BY name`,
        [orgId]
      )) || []
    );
  })
);

router.post(
  '/roles',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, permissions, frameworkId } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const id = uuidv4();
    await dbRun(
      `INSERT INTO framework_roles (id, organization_id, name, permissions, framework_id, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [id, req.user?.organizationId, name, JSON.stringify(permissions || []), frameworkId]
    );
    res.status(201).json({ success: true, id });
  })
);

router.put(
  '/roles/:id',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, permissions } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    if (name) {
      updates.push('name = ?');
      params.push(name);
    }
    if (permissions) {
      updates.push('permissions = ?');
      params.push(JSON.stringify(permissions));
    }
    if (!updates.length) return res.status(400).json({ error: 'No updates' });
    params.push(req.params.id);
    await dbRun(`UPDATE framework_roles SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true });
  })
);

router.delete(
  '/roles/:id',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await dbRun('DELETE FROM framework_roles WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  })
);

router.get(
  '/assignments',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    res.json(
      (await dbAll(
        `SELECT ra.*, u.first_name, u.last_name, fr.name as role_name
    FROM role_assignments ra JOIN users u ON ra.user_id = u.id
    JOIN framework_roles fr ON ra.role_id = fr.id WHERE ra.organization_id = ?`,
        [orgId]
      )) || []
    );
  })
);

export default router;
