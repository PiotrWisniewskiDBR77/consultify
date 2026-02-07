/**
 * Multi-Framework Assessment Routes
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';

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
    res.json(
      (await dbAll(
        `SELECT id, title, frameworks, overall_score, status, created_at
    FROM multi_framework_assessments WHERE organization_id = ? ORDER BY created_at DESC`,
        [orgId]
      )) || []
    );
  })
);

router.post(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { title, frameworks } = req.body;
    const id = uuidv4();
    await dbRun(
      `INSERT INTO multi_framework_assessments (id, organization_id, title, frameworks, status, created_at)
    VALUES (?, ?, ?, ?, 'in_progress', datetime('now'))`,
      [
        id,
        req.user?.organizationId,
        title || 'MFA Assessment',
        JSON.stringify(frameworks || ['SIRI', 'ADMA', 'CMMI']),
      ]
    );
    res.status(201).json({ success: true, id });
  })
);

router.get(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const assessment = await dbAll(`SELECT * FROM multi_framework_assessments WHERE id = ?`, [
      req.params.id,
    ]);
    if (!assessment?.length) return res.status(404).json({ error: 'Not found' });
    res.json(assessment[0]);
  })
);

export default router;
