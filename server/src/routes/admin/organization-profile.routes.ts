import { type NextFunction, type Response, Router } from 'express';

import verifyAdmin from '../../middleware/admin.middleware.js';
import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { get as dbGet, run as dbRun } from '../../utils/DbPromise.js';

/**
 * GET/PUT /api/admin/organization-profile
 *
 * Narrow, token-scoped counterpart to /api/organization-profiles/:orgId for
 * the three fields the Admin "Organization Defaults" screen actually owns:
 * defaultTimezone, defaultLanguage, dateFormat. The organization is always
 * taken from the verified token (req.user.organizationId) — never from a
 * URL param or request body — so the frontend can drop orgId from the URL
 * entirely.
 */

const router = Router();
router.use(verifyToken);
router.use(
  asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const organizationId = String(req.user?.organizationId || '').trim();
    const userId = String(req.user?.id || '').trim();
    if (!organizationId || !userId)
      return res.status(401).json({ success: false, code: 'UNAUTHORIZED' });
    const membership = await dbGet<{ role?: string; status?: string }>(
      'SELECT role, status FROM organization_members WHERE organization_id = ? AND user_id = ? LIMIT 1',
      [organizationId, userId],
      { fallback: false }
    );
    if (!membership || String(membership.status).toUpperCase() !== 'ACTIVE')
      return res.status(403).json({ success: false, code: 'ADMIN_MEMBERSHIP_REQUIRED' });
    if (!['OWNER', 'ADMIN'].includes(String(membership.role).toUpperCase()))
      return res.status(403).json({ success: false, code: 'ADMIN_ACCESS_REQUIRED' });
    next();
  })
);
router.use(verifyAdmin);

async function readBranding(orgId: string): Promise<Record<string, unknown>> {
  const row = await dbGet<{ setting_value?: string | null }>(
    `SELECT setting_value FROM organization_settings WHERE organization_id = ? AND setting_key = 'branding'`,
    [orgId],
    { fallback: false }
  ).catch(() => null);
  if (!row?.setting_value) return {};
  try {
    return JSON.parse(row.setting_value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = String(req.user?.organizationId || '');
    const org = await dbGet<{ default_timezone?: string; default_language?: string }>(
      'SELECT default_timezone, default_language FROM organizations WHERE id = ?',
      [organizationId],
      { fallback: false }
    );
    if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });
    const branding = await readBranding(organizationId);
    return res.json({
      profile: {
        defaultTimezone: org.default_timezone || '',
        defaultLanguage: org.default_language || '',
        dateFormat: (branding.dateFormat as string) || '',
      },
    });
  })
);

router.put(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const organizationId = String(req.user?.organizationId || '');
    const defaultTimezone = req.body?.defaultTimezone;
    const defaultLanguage = req.body?.defaultLanguage;
    const dateFormat = req.body?.dateFormat;

    await dbRun(
      `UPDATE organizations SET
         default_timezone = COALESCE(?, default_timezone),
         default_language = COALESCE(?, default_language)
       WHERE id = ?`,
      [defaultTimezone || null, defaultLanguage || null, organizationId]
    );

    if (dateFormat !== undefined) {
      const branding = await readBranding(organizationId);
      branding.dateFormat = dateFormat;
      await dbRun(
        `INSERT OR REPLACE INTO organization_settings (organization_id, setting_key, setting_value, updated_at)
         VALUES (?, 'branding', ?, datetime('now'))`,
        [organizationId, JSON.stringify(branding)]
      );
    }

    return res.json({ success: true });
  })
);

export default router;
