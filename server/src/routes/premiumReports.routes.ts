/**
 * Premium Reports Routes - API endpoints for premium report access
 */
import { Router, Request, Response } from 'express';
import { verifyToken, isAuthenticated } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet } from '../utils/DbPromise.js';

const router = Router();
interface AuthRequest extends Request { user?: { id: string; organizationId: string }; }

router.get('/', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const orgId = req.user?.organizationId;
  const reports = await dbAll(`
    SELECT id, title, description, type, format, is_premium, price, preview_url, created_at
    FROM premium_reports WHERE is_active = 1 ORDER BY created_at DESC
  `);
  res.json(reports || []);
}));

router.get('/:id', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const report = await dbGet('SELECT * FROM premium_reports WHERE id = ?', [req.params.id]);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.json(report);
}));

router.get('/:id/access', verifyToken, isAuthenticated, asyncHandler(async (req: AuthRequest, res: Response) => {
  const orgId = req.user?.organizationId;
  const access = await dbGet(`
    SELECT id FROM premium_report_access WHERE report_id = ? AND organization_id = ? AND expires_at > datetime('now')
  `, [req.params.id, orgId]);
  res.json({ hasAccess: !!access });
}));

export default router;
