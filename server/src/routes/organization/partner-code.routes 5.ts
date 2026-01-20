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
import { verifyToken as authenticateToken, AuthRequest } from '../../middleware/auth.middleware.js';
import * as partnerReferralService from '../../services/partnerReferralService.js';
import * as DbPromise from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

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
    const partnerOrg = await DbPromise.get(
      db,
      `SELECT po.id, po.partner_name, po.contact_email, po.referral_code,
                    po.commission_rate
             FROM partner_organizations po
             WHERE po.id = ?`,
      [attribution.partnerOrgId]
    );

    // Get discount info if applicable
    const discount = await DbPromise.get(
      db,
      `SELECT discount_type, discount_value, start_date, end_date, status
             FROM organization_discounts
             WHERE organization_id = ? AND partner_org_id = ? AND status = 'ACTIVE'
             ORDER BY created_at DESC
             LIMIT 1`,
      [organizationId, attribution.partnerOrgId]
    );

    return res.json({
      success: true,
      data: {
        id: attribution.id,
        partnerOrgId: attribution.partnerOrgId,
        partnerName: (partnerOrg as any)?.partner_name || 'Partner',
        partnerEmail: (partnerOrg as any)?.contact_email,
        referralCode: attribution.referralCodeUsed || (partnerOrg as any)?.referral_code,
        attributionType: attribution.attributionType,
        discountPercent: (discount as any)?.discount_type === 'PERCENTAGE' ? (discount as any)?.discount_value : null,
        discountMonths: (discount as any)?.end_date
          ? Math.ceil(
              (new Date((discount as any).end_date).getTime() - new Date().getTime()) /
                (1000 * 60 * 60 * 24 * 30)
            )
          : null,
        discountExpiresAt: (discount as any)?.end_date,
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
        error: (validation as any).error || 'Invalid partner code',
      });
    }

    // Create attribution
    const attribution = await partnerReferralService.createAttribution({
      partnerOrgId: validation.partnerOrgId,
      organizationId,
      attributionType: 'PROMO_CODE',
      referralCodeUsed: partnerCode,
      commissionRatePercent: 0, // Default commission rate for promo codes
    });

    // Create discount if applicable (check partner discount config)
    const db = getDatabase();
    const discountConfig = await DbPromise.get(
      db,
      `SELECT discount_type, discount_value, duration_months
             FROM partner_discount_config
             WHERE is_active = 1
             ORDER BY created_at DESC
             LIMIT 1`
    );

    if (discountConfig) {
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + ((discountConfig as any).duration_months || 12));

      await DbPromise.run(
        db,
        `INSERT INTO organization_discounts 
                 (id, organization_id, partner_org_id, discount_type, discount_value, start_date, end_date, status, created_at)
                 VALUES (?, ?, ?, ?, ?, datetime('now'), ?, 'ACTIVE', datetime('now'))`,
        [
          crypto.randomUUID(),
          organizationId,
          validation.partnerOrgId,
          (discountConfig as any).discount_type,
          (discountConfig as any).discount_value,
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
