/**
 * V8 read-only Partner bridge — data scoped by `partner_users.partner_org_id`.
 * Namespace: /api/v8/partner (mounted by v8/index after v8OrgGate).
 *
 * Auth model:
 * - Same stack as other V8 routes: JWT, `req.organizationId` (tenant) for V8 org gate + context.
 * - Partner rows are loaded only for `partnerOrgId` from `getActivePartnerOrgIdForUser(userId)`.
 * - `v8TenantOrganizationId` in meta is the JWT org (V8 gate); it must not be used as partner scope.
 *
 * @module routes/v8/partner.routes
 */

import { Router } from 'express';
import type { Response } from 'express';

import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import { getActivePartnerOrgIdForUser } from '../../services/partnerOrgResolution.js';
import PartnerCommissionService from '../../services/partnerCommissionService.js';
import PartnerReferralService from '../../services/partnerReferralService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

export const V8_PARTNER_READ_CONTRACT = 'partner_runtime_read_v1';

function partnerReadMeta(req: AuthRequest, partnerOrgId: string) {
  const { organizationId } = getV8Context(req);
  return {
    version: 'v8' as const,
    contract: V8_PARTNER_READ_CONTRACT,
    partnerOrgId,
    v8TenantOrganizationId: organizationId,
  };
}

/**
 * GET /api/v8/partner/referral-analytics?days=
 */
router.get(
  '/referral-analytics',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    const daysRaw = req.query.days;
    const days =
      typeof daysRaw === 'string' && /^\d+$/.test(daysRaw)
        ? Math.min(365, Math.max(1, parseInt(daysRaw, 10)))
        : 30;
    const analytics = await PartnerReferralService.getReferralAnalytics(partnerOrgId, days);
    return res.json({
      data: { analytics, days },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  }),
);

/**
 * GET /api/v8/partner/earnings-summary
 */
router.get(
  '/earnings-summary',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
    if (!partnerOrgId) {
      return res.status(403).json({
        error: 'Partner organization required',
        code: 'PARTNER_ORG_REQUIRED',
      });
    }
    const earnings = await PartnerCommissionService.getEarningsSummary(partnerOrgId);
    return res.json({
      data: { earnings },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  }),
);

export default router;
