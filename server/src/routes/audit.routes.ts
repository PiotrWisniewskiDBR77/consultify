/**
 * Audit Routes - API endpoints for compliance audit management
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
  '/',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const audits = await dbAll(
      `
    SELECT id, name, type, status, score, auditor, scheduled_date, completed_date, created_at
    FROM audits WHERE organization_id = ? ORDER BY created_at DESC
  `,
      [orgId]
    );
    res.json(audits);
  })
);

router.post(
  '/',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const { name, type, scheduledDate, auditor } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const id = uuidv4();
    await dbRun(
      `INSERT INTO audits (id, organization_id, name, type, status, auditor, scheduled_date, created_at)
    VALUES (?, ?, ?, ?, 'planned', ?, ?, now())`,
      [id, orgId, name, type || 'internal', auditor || '', scheduledDate]
    );
    res.status(201).json({ success: true, id });
  })
);

router.put(
  '/:id',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { status, score, findings } = req.body;
    const updates: string[] = [];
    const params: any[] = [];
    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (score !== undefined) {
      updates.push('score = ?');
      params.push(score);
    }
    if (findings) {
      updates.push('findings = ?');
      params.push(JSON.stringify(findings));
    }
    if (status === 'completed') updates.push('completed_date = now()');
    if (!updates.length) return res.status(400).json({ error: 'No updates' });
    params.push(req.params.id);
    await dbRun(`UPDATE audits SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true });
  })
);

export default router;
