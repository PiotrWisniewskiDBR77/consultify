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
const FEATURE_NAME = 'premium-reports';

<<<<<<< Updated upstream
=======
function isSchemaMissingError(err: unknown): boolean {
  const msg = String((err as any)?.message || '').toLowerCase();
  return (
    msg.includes('no such table') ||
    msg.includes('no such column') ||
    msg.includes('does not exist') ||
    msg.includes('relation')
  );
}

const respondFeatureUnavailable = (res: Response, detail?: string) =>
  res.status(503).json({
    error: 'Feature unavailable',
    code: 'FEATURE_UNAVAILABLE',
    feature: FEATURE_NAME,
    detail,
  });

>>>>>>> Stashed changes
router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
<<<<<<< Updated upstream
    const orgId = req.user?.organizationId;
    const reports = await dbAll(`
    SELECT id, title, description, type, format, is_premium, price, preview_url, created_at
    FROM premium_reports WHERE is_active = 1 ORDER BY created_at DESC
  `);
    res.json(reports || []);
=======
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
        return respondFeatureUnavailable(res, 'schema missing');
      }
      throw error;
    }
>>>>>>> Stashed changes
  })
);

router.get(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
<<<<<<< Updated upstream
    const report = await dbGet('SELECT * FROM premium_reports WHERE id = ?', [req.params.id]);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
=======
    try {
      const report = await dbGet('SELECT * FROM premium_reports WHERE id = ?', [req.params.id], {
        fallback: false,
      });
      if (!report) return res.status(404).json({ error: 'Report not found' });
      res.json(report);
    } catch (error: unknown) {
      if (isSchemaMissingError(error)) {
        return respondFeatureUnavailable(res, 'schema missing');
      }
      throw error;
    }
>>>>>>> Stashed changes
  })
);

router.get(
  '/:id/access',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
<<<<<<< Updated upstream
    const orgId = req.user?.organizationId;
    const access = await dbGet(
      `
    SELECT id FROM premium_report_access WHERE report_id = ? AND organization_id = ? AND expires_at > datetime('now')
  `,
      [req.params.id, orgId]
    );
    res.json({ hasAccess: !!access });
=======
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
        return respondFeatureUnavailable(res, 'schema missing');
      }
      throw error;
    }
>>>>>>> Stashed changes
  })
);

export default router;
