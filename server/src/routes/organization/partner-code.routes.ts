/**
 * Organization Partner Code Routes
 *
 * Allows organization admins to:
 * - Apply a partner referral code
 * - View current partner attribution
 * - Remove partner attribution
 */

import { Request, Response, Router } from 'express';

import { getDatabase } from '../../database/Database.js';
import {
  type AuthRequest,
  verifyToken as authenticateToken,
} from '../../middleware/auth.middleware.js';
import {
  isPartnerEconomicsOperationAvailable,
  PARTNER_ECONOMICS_POLICY_CODE,
  PARTNER_ECONOMICS_POLICY_DECISION,
  PARTNER_ECONOMICS_POLICY_STATUS,
} from '../../services/partnerEconomicsPolicy.js';
import * as partnerReferralService from '../../services/partnerReferralService.js';
import * as DbPromise from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

/**
 * AMD-PRT-ECONOMICS-002 (owner decision 2A).
 *
 * This entire router is currently DEAD CODE: `routes/organization/index.ts`
 * mounts it, but that barrel is only re-exported by `routes/index.ts`, which
 * nothing in `Gateway.ts` or `src/index.ts` imports (verified by grep — see
 * the S7 handoff report). It is being fixed anyway, in place, so that
 * re-adding a single `app.use(...)` line can never resurrect a bypass: the
 * writers below (`createAttribution`, the `organization_discounts` INSERT,
 * and the `organization_discounts` status=CANCELLED UPDATE) must refuse
 * before any service call or SQL, exactly like every other partner-economics
 * writer in the codebase. GET /partner-attribution is left untouched — it is
 * a read, not a writer.
 */
function refusePartnerEconomicsWrite(res: Response): Response {
  return res.status(PARTNER_ECONOMICS_POLICY_STATUS).json({
    success: false,
    error: `Partner code operations are excluded by owner policy ${PARTNER_ECONOMICS_POLICY_DECISION}`,
    code: PARTNER_ECONOMICS_POLICY_CODE,
  });
}

const router = Router();

/**
 * GET /api/organization/partner-attribution
 * Get current partner attribution for the organization
 */
router.get('/partner-attribution', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const organizationId = authReq.user?.organization_id;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID required',
      });
    }

    const attribution = await partnerReferralService.getAttributionByOrganization(organizationId);

    if (!attribution) {
      return res.json({
        success: true,
        data: null,
      });
    }

    // Get partner details
    const db = getDatabase();
    const partnerOrg = (await DbPromise.get(
      db,
      `SELECT po.id, po.partner_name, po.contact_email, po.referral_code,
                    po.commission_rate
             FROM partner_organizations po
             WHERE po.id = ?`,
      [attribution.partnerOrgId]
    )) as { partner_name?: string; contact_email?: string; referral_code?: string } | null;

    // Get discount info if applicable
    const discount = (await DbPromise.get(
      db,
      `SELECT discount_type, discount_value, start_date, end_date, status
             FROM organization_discounts
             WHERE organization_id = ? AND partner_org_id = ? AND status = 'ACTIVE'
             ORDER BY created_at DESC
             LIMIT 1`,
      [organizationId, attribution.partnerOrgId]
    )) as { discount_type?: string; discount_value?: number; end_date?: string } | null;

    return res.json({
      success: true,
      data: {
        id: attribution.id,
        partnerOrgId: attribution.partnerOrgId,
        partnerName: partnerOrg?.partner_name || 'Partner',
        partnerEmail: partnerOrg?.contact_email,
        referralCode: attribution.referralCodeUsed || partnerOrg?.referral_code,
        attributionType: attribution.attributionType,
        discountPercent: discount?.discount_type === 'PERCENTAGE' ? discount.discount_value : null,
        discountMonths: discount?.end_date
          ? Math.ceil(
              (new Date(discount.end_date).getTime() - new Date().getTime()) /
                (1000 * 60 * 60 * 24 * 30)
            )
          : null,
        discountExpiresAt: discount?.end_date,
        attributedAt: attribution.attributedAt,
        status: attribution.status,
      },
    });
  } catch (err: any) {
    logger.error('Error fetching partner attribution:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch partner attribution',
    });
  }
});

/**
 * POST /api/organization/partner-code
 * Apply a partner referral code to the organization
 */
router.post('/partner-code', authenticateToken, async (req: Request, res: Response) => {
  if (!isPartnerEconomicsOperationAvailable()) {
    return refusePartnerEconomicsWrite(res);
  }

  try {
    const authReq = req as AuthRequest;
    const organizationId = authReq.user?.organization_id;
    const userId = authReq.user?.id;
    const { partnerCode } = req.body;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID required',
      });
    }

    if (!partnerCode || typeof partnerCode !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Partner code is required',
      });
    }

    // Check if organization already has an attribution
    const existingAttribution =
      await partnerReferralService.getAttributionByOrganization(organizationId);
    if (existingAttribution) {
      return res.status(400).json({
        success: false,
        error:
          'Organization already has a partner attribution. Remove it first to apply a new code.',
      });
    }

    // Validate the partner code
    const validation = await partnerReferralService.validateReferralCode(partnerCode);
    if (!validation.valid || !validation.partnerOrgId) {
      return res.status(400).json({
        success: false,
        error: (validation as { error?: string }).error || 'Invalid partner code',
      });
    }

    // Create attribution
    const attribution = await partnerReferralService.createAttribution({
      partnerOrgId: validation.partnerOrgId,
      organizationId,
      attributionType: 'PROMO_CODE',
      referralCodeUsed: partnerCode,
      commissionRatePercent: 0, // Default commission rate
    });

    // Create discount if applicable (check partner discount config)
    const db = getDatabase();
    const discountConfig = (await DbPromise.get(
      db,
      `SELECT discount_type, discount_value, duration_months
             FROM partner_discount_config
             WHERE is_active = 1
             ORDER BY created_at DESC
             LIMIT 1`
    )) as { discount_type?: string; discount_value?: number; duration_months?: number } | null;

    if (discountConfig) {
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + (discountConfig.duration_months || 12));

      await DbPromise.run(
        db,
        `INSERT INTO organization_discounts 
                 (id, organization_id, partner_org_id, discount_type, discount_value, start_date, end_date, status, created_at)
                 VALUES (?, ?, ?, ?, ?, datetime('now'), ?, 'ACTIVE', datetime('now'))`,
        [
          crypto.randomUUID(),
          organizationId,
          validation.partnerOrgId,
          discountConfig.discount_type,
          discountConfig.discount_value,
          endDate.toISOString(),
        ]
      );
    }

    // Log the action
    logger.info(
      `Partner code ${partnerCode} applied to organization ${organizationId} by user ${userId}`
    );

    return res.json({
      success: true,
      message: 'Partner code applied successfully',
      data: {
        attributionId: attribution.id,
        partnerName: validation.partnerName,
      },
    });
  } catch (err: any) {
    logger.error('Error applying partner code:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to apply partner code',
    });
  }
});

/**
 * DELETE /api/organization/partner-code
 * Remove partner attribution from the organization
 */
router.delete('/partner-code', authenticateToken, async (req: Request, res: Response) => {
  if (!isPartnerEconomicsOperationAvailable()) {
    return refusePartnerEconomicsWrite(res);
  }

  try {
    const authReq = req as AuthRequest;
    const organizationId = authReq.user?.organization_id;
    const userId = authReq.user?.id;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        error: 'Organization ID required',
      });
    }

    // Get existing attribution
    const existingAttribution =
      await partnerReferralService.getAttributionByOrganization(organizationId);
    if (!existingAttribution) {
      return res.status(404).json({
        success: false,
        error: 'No partner attribution found',
      });
    }

    // Update attribution status to EXPIRED
    await partnerReferralService.updateAttributionStatus(existingAttribution.id, 'EXPIRED');

    // Deactivate any associated discounts
    const db = getDatabase();
    await DbPromise.run(
      db,
      `UPDATE organization_discounts 
             SET status = 'CANCELLED', updated_at = datetime('now')
             WHERE organization_id = ? AND partner_org_id = ? AND status = 'ACTIVE'`,
      [organizationId, existingAttribution.partnerOrgId]
    );

    // Log the action
    logger.info(
      `Partner attribution removed from organization ${organizationId} by user ${userId}`
    );

    return res.json({
      success: true,
      message: 'Partner attribution removed successfully',
    });
  } catch (err: any) {
    logger.error('Error removing partner attribution:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to remove partner attribution',
    });
  }
});

export default router;
