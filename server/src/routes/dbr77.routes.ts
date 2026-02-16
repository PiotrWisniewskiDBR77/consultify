/**
 * DBR77 Routes - Platform-specific assessment & benchmark endpoints
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
  '/benchmarks',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    res.json(
      (await dbAll(
        `SELECT id, name, category, score, industry_avg, percentile, assessed_at
    FROM dbr77_benchmarks WHERE organization_id = ? ORDER BY assessed_at DESC`,
        [orgId]
      )) || []
    );
  })
);

router.get(
  '/assessments',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    res.json(
      (await dbAll(
        `SELECT id, title, type, status, score, dimensions, created_at
    FROM dbr77_assessments WHERE organization_id = ? ORDER BY created_at DESC`,
        [orgId]
      )) || []
    );
  })
);

router.post(
  '/assessments',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const { title, type, dimensions } = req.body;
    const id = uuidv4();
    await dbRun(
      `INSERT INTO dbr77_assessments (id, organization_id, title, type, status, dimensions, created_at)
    VALUES (?, ?, ?, ?, 'in_progress', ?, datetime('now'))`,
      [id, orgId, title || 'DBR77 Assessment', type || 'standard', JSON.stringify(dimensions || {})]
    );
    res.status(201).json({ success: true, id });
  })
);

router.get(
  '/insights',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    res.json(
      (await dbAll(
        `SELECT id, category, insight, severity, recommendation, created_at
    FROM dbr77_insights WHERE organization_id = ? ORDER BY severity DESC, created_at DESC`,
        [orgId]
      )) || []
    );
  })
);

export default router;
