/**
 * MCP Routes - Model Context Protocol endpoints
 */
import { Request, Response, Router } from 'express';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll } from '../utils/DbPromise.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

router.get(
  '/providers',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const providers = await dbAll(
      `SELECT id, name, type, status, config, created_at
    FROM mcp_providers WHERE organization_id = ? ORDER BY name`,
      [orgId]
    );
    res.json(providers || []);
  })
);

router.get(
  '/context',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const orgId = req.user?.organizationId;
    // Aggregate context from various sources
    const activeProject = await dbAll(
      `SELECT p.id, p.name FROM projects p
    JOIN project_members pm ON p.id = pm.project_id WHERE pm.user_id = ? AND p.status = 'active' LIMIT 3`,
      [userId]
    );
    res.json({
      user: { id: userId },
      organization: { id: orgId },
      activeProjects: activeProject || [],
      timestamp: new Date().toISOString(),
    });
  })
);

export default router;
