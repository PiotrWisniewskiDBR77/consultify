/**
 * Premium Reports Routes - API endpoints for premium report access
 */
import { Request, Response, Router } from 'express';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet } from '../utils/DbPromise.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

function isSchemaMissingError(err: unknown): boolean {
  const msg = String((err as any)?.message || '').toLowerCase();
  return msg.includes('no such table') || msg.includes('does not exist') || msg.includes('relation');
}

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.user?.organizationId;
      const reports = await dbAll(
        `
          SELECT id, title, description, type, format, is_premium, price, preview_url, created_at
          FROM premium_reports WHERE is_active = 1 ORDER BY created_at DESC
        `,
        [],
        { fallback: false }
      );
      res.json(reports || []);
    } catch (error: unknown) {
      if (isSchemaMissingError(error)) {
        return res.status(503).json({ error: 'Premium reports storage not available (schema missing)' });
      }
      throw error;
    }
  })
);

router.get(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const report = await dbGet('SELECT * FROM premium_reports WHERE id = ?', [req.params.id], {
        fallback: false,
      });
      if (!report) return res.status(404).json({ error: 'Report not found' });
      res.json(report);
    } catch (error: unknown) {
      if (isSchemaMissingError(error)) {
        return res.status(503).json({ error: 'Premium reports storage not available (schema missing)' });
      }
      throw error;
    }
  })
);

router.get(
  '/:id/access',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const orgId = req.user?.organizationId;
      const access = await dbGet(
        `
          SELECT id FROM premium_report_access
          WHERE report_id = ? AND organization_id = ? AND expires_at > datetime('now')
        `,
        [req.params.id, orgId],
        { fallback: false }
      );
      res.json({ hasAccess: !!access });
    } catch (error: unknown) {
      if (isSchemaMissingError(error)) {
        return res.status(503).json({ error: 'Premium reports storage not available (schema missing)' });
      }
      throw error;
    }
  })
);

export default router;
