/**
 * External Assessments Routes
 */
import { Router, Request, Response } from 'express';
import { verifyToken, isAuthenticated } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
interface AuthRequest extends Request { user?: { id: string; organizationId: string }; }

router.get('/', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const orgId = req.user?.organizationId;
  res.json(await dbAll(`SELECT id, title, framework, score, status, assessor, completed_at, created_at
    FROM external_assessments WHERE organization_id = ? ORDER BY created_at DESC`, [orgId]) || []);
}));

router.post('/', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { title, framework, assessor, score, findings } = req.body;
  const id = uuidv4();
  await dbRun(`INSERT INTO external_assessments (id, organization_id, title, framework, assessor, score, findings, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`,
    [id, req.user?.organizationId, title, framework || '', assessor || '', score, JSON.stringify(findings || [])]);
  res.status(201).json({ success: true, id });
}));

export default router;
