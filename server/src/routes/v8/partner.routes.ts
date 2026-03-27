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

import crypto from 'node:crypto';
import { Router } from 'express';
import type { Response } from 'express';

import { getDatabase } from '../../database/Database.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';
import { getV8Context } from '../../middleware/v8Auth.middleware.js';
import { getActivePartnerOrgIdForUser } from '../../services/partnerOrgResolution.js';
import PartnerCommissionService from '../../services/partnerCommissionService.js';
import PartnerReferralService from '../../services/partnerReferralService.js';
import * as DbPromise from '../../utils/DbPromise.js';
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

/**
 * POST /api/v8/partner/payouts/request
 */
router.post(
  '/payouts/request',
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
    const payout = await PartnerCommissionService.requestPayout({
      partnerOrgId,
      payoutAccountId: req.body?.payoutAccountId,
      requestedBy: userId,
      notes: req.body?.notes,
    });
    if (!payout) {
      return res.status(400).json({
        error: 'No approved commissions available for payout or amount below threshold',
        code: 'PAYOUT_NOT_AVAILABLE',
      });
    }
    return res.status(201).json({
      data: { payout },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  }),
);

/**
 * POST /api/v8/partner/campaign-links
 */
router.post(
  '/campaign-links',
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
    const { name, description, utmSource, utmMedium, utmCampaign, utmContent, destinationUrl } =
      req.body ?? {};
    if (!name) {
      return res.status(400).json({ error: 'Campaign name is required', code: 'CAMPAIGN_NAME_REQUIRED' });
    }
    const campaignLink = await PartnerReferralService.createCampaignLink({
      partnerOrgId,
      name,
      description,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      destinationUrl,
    });
    return res.status(201).json({
      data: { campaignLink },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  }),
);

/**
 * DELETE /api/v8/partner/campaign-links/:linkId
 */
router.delete(
  '/campaign-links/:linkId',
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
    const linkId = String(req.params.linkId || '');
    const deleted = await PartnerReferralService.deleteCampaignLink(partnerOrgId, linkId);
    if (!deleted) {
      return res.status(404).json({ error: 'Campaign link not found', code: 'CAMPAIGN_LINK_NOT_FOUND' });
    }
    return res.json({
      data: { success: true, deleted: linkId },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  }),
);

/**
 * PUT /api/v8/partner/organization
 */
router.put(
  '/organization',
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
    const { name, taxId, contactEmail, contactPhone, website } = req.body ?? {};
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required', code: 'PARTNER_NAME_REQUIRED' });
    }
    if (!contactEmail || typeof contactEmail !== 'string') {
      return res.status(400).json({
        error: 'contactEmail is required',
        code: 'PARTNER_CONTACT_EMAIL_REQUIRED',
      });
    }

    await DbPromise.run(
      getDatabase(),
      `UPDATE partner_organizations
       SET name = ?, tax_id = ?, contact_email = ?, contact_phone = ?, website = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, taxId || null, contactEmail, contactPhone || null, website || null, partnerOrgId],
    );

    return res.json({
      data: { success: true, message: 'Organization updated successfully' },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  }),
);

/**
 * PUT /api/v8/partner/organization/specializations
 */
router.put(
  '/organization/specializations',
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
    const { specializations } = req.body ?? {};
    if (!Array.isArray(specializations)) {
      return res.status(400).json({
        error: 'specializations must be an array',
        code: 'PARTNER_SPECIALIZATIONS_ARRAY_REQUIRED',
      });
    }

    const uniqueFrameworks = Array.from(
      new Set(
        specializations
          .filter((s: unknown) => typeof s === 'string' && s.trim().length > 0)
          .map((s: string) => s.trim()),
      ),
    );

    const result = await DbPromise.transaction([
      {
        sql: `DELETE FROM partner_specializations WHERE partner_org_id = ?`,
        params: [partnerOrgId],
      },
      ...uniqueFrameworks.map((framework) => ({
        sql: `INSERT INTO partner_specializations (id, partner_org_id, framework, certified, created_at)
              VALUES (?, ?, ?, FALSE, NOW())
              ON CONFLICT (partner_org_id, framework) DO NOTHING`,
        params: [crypto.randomUUID(), partnerOrgId, framework],
      })),
    ]);

    if (!result.success) {
      return res.status(500).json({
        error: result.error || 'Failed to update specializations',
        code: 'PARTNER_SPECIALIZATIONS_UPDATE_FAILED',
      });
    }

    return res.json({
      data: { success: true, message: 'Specializations updated successfully' },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  }),
);

/**
 * PUT /api/v8/partner/organization/regions
 */
router.put(
  '/organization/regions',
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
    const { regions } = req.body ?? {};
    if (!Array.isArray(regions)) {
      return res.status(400).json({
        error: 'regions must be an array',
        code: 'PARTNER_REGIONS_ARRAY_REQUIRED',
      });
    }

    const uniqueRegions = Array.from(
      new Set(
        regions
          .filter((region: unknown) => typeof region === 'string' && region.trim().length > 0)
          .map((region: string) => region.trim()),
      ),
    );

    const result = await DbPromise.transaction([
      {
        sql: `DELETE FROM partner_regions WHERE partner_org_id = ?`,
        params: [partnerOrgId],
      },
      ...uniqueRegions.map((region) => ({
        sql: `INSERT INTO partner_regions (id, partner_org_id, region, is_primary, created_at)
              VALUES (?, ?, ?, FALSE, NOW())
              ON CONFLICT (partner_org_id, region) DO NOTHING`,
        params: [crypto.randomUUID(), partnerOrgId, region],
      })),
    ]);

    if (!result.success) {
      return res.status(500).json({
        error: result.error || 'Failed to update regions',
        code: 'PARTNER_REGIONS_UPDATE_FAILED',
      });
    }

    return res.json({
      data: { success: true, message: 'Regions updated successfully' },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  }),
);

/**
 * PUT /api/v8/partner/organization/listing
 */
router.put(
  '/organization/listing',
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
    const { publicListingEnabled } = req.body ?? {};
    if (typeof publicListingEnabled !== 'boolean') {
      return res.status(400).json({
        error: 'publicListingEnabled must be boolean',
        code: 'PUBLIC_LISTING_BOOLEAN_REQUIRED',
      });
    }

    await DbPromise.run(
      getDatabase(),
      `UPDATE partner_organizations
       SET public_listing_enabled = ?, updated_at = NOW()
       WHERE id = ?`,
      [publicListingEnabled, partnerOrgId],
    );

    return res.json({
      data: { success: true, publicListingEnabled },
      meta: partnerReadMeta(req, partnerOrgId),
    });
  }),
);

export default router;
