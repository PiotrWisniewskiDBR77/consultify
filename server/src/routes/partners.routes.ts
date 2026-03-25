// @ts-nocheck
/**
 * Partner Portal Routes
 *
 * API endpoints for Partner Portal module including:
 * - Partner organization management
 * - Referral codes & links (NEW)
 * - Attribution tracking (NEW)
 * - Client organizations
 * - Certifications & Learning
 * - Licenses & Billing
 * - Commissions & Payouts (NEW)
 * - Resources
 *
 * @module routes/partners
 */

import crypto from 'crypto';
import { NextFunction, Request, Response, Router } from 'express';

import { getDatabase } from '../database/Database.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { generatePartnerCertificatePdf } from '../services/partnerCertificatePdf.js';
import {
  ensureLearningProgressRows,
  ensureSalesCertification,
  getEffectivePartnerTier,
  getSalesModules,
  recalcCertificationProgress,
  startSalesExam,
  submitSalesExam,
} from '../services/partnerCertificationService.js';
import PartnerCommissionService from '../services/partnerCommissionService.js';
import { getActivePartnerOrgIdForUser } from '../services/partnerOrgResolution.js';
import PartnerReferralService from '../services/partnerReferralService.js';
import { generatePartnerToolkitResourceFile } from '../services/partnerToolkitResources.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();

function isSchemaMissingError(err: unknown): boolean {
  const msg = String((err as any)?.message || '').toLowerCase();
  return (
    msg.includes('no such table') || msg.includes('does not exist') || msg.includes('relation')
  );
}

const featureUnavailable = (res: Response, message: string) =>
  res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: message || 'Service temporarily unavailable due to missing configuration',
  });

type CanonicalTier = 'REGISTERED' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
const TIER_ORDER: CanonicalTier[] = ['REGISTERED', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
function tierRank(tier: string | null | undefined): number {
  if (!tier) return 0;
  const upper = String(tier).trim().toUpperCase();
  const idx = TIER_ORDER.indexOf(upper as CanonicalTier);
  if (idx >= 0) return idx;
  const legacy = String(tier).trim().toLowerCase();
  if (legacy === 'elite') return tierRank('PLATINUM');
  if (legacy === 'premier') return tierRank('GOLD');
  if (legacy === 'certified') return tierRank('SILVER');
  return tierRank('REGISTERED');
}

function looksPolish(req: Request): boolean {
  const al = String(req.headers['accept-language'] || '').toLowerCase();
  return al.includes('pl');
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let b = bytes;
  while (b >= 1024 && i < units.length - 1) {
    b /= 1024;
    i++;
  }
  const value = i === 0 ? Math.round(b) : Math.round(b * 10) / 10;
  return `${value} ${units[i]}`;
}

function resourceTypeLabel(mimeType?: string | null, fileType?: string | null): string {
  const v = String(mimeType || fileType || '').toLowerCase();
  if (v.includes('pdf')) return 'PDF';
  if (v.includes('presentation') || v.includes('pptx')) return 'PPTX';
  if (v.includes('zip')) return 'ZIP';
  if (v.includes('text')) return 'TXT';
  return 'FILE';
}

async function requirePartnerOrgId(req: Request, res: Response): Promise<string | null> {
  const userId = (req as any).user?.id || (req as any).userId;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return null;
  }
  const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
  if (!partnerOrgId) {
    res.status(403).json({ success: false, error: 'Partner organization required' });
    return null;
  }
  return partnerOrgId;
}

// Apply authentication to all routes
router.use(verifyToken);

// =============================================================================
// PARTNER CONNECTION (ONBOARDING)
// =============================================================================

/**
 * GET /api/partners/connection
 * Returns partner connection status without 403 gating.
 */
router.get('/connection', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
    if (!partnerOrgId) {
      return res.json({ success: true, data: { connected: false } });
    }

    const db = getDatabase();
    const org = await DbPromise.get<any>(
      db,
      `SELECT po.*
       FROM partner_organizations po
       WHERE po.id = ?
       LIMIT 1`,
      [partnerOrgId]
    );

    if (!org) {
      return res.json({ success: true, data: { connected: false } });
    }

    const [specializations, regions] = await Promise.all([
      DbPromise.all<{ framework: string }>(
        db,
        `SELECT framework FROM partner_specializations WHERE partner_org_id = ? ORDER BY framework ASC`,
        [org.id]
      ),
      DbPromise.all<{ region: string }>(
        db,
        `SELECT region FROM partner_regions WHERE partner_org_id = ? ORDER BY region ASC`,
        [org.id]
      ),
    ]);

    return res.json({
      success: true,
      data: {
        connected: true,
        organization: {
          id: org.id,
          name: org.name,
          legalName: org.legal_name || undefined,
          taxId: org.tax_id || undefined,
          contactEmail: org.contact_email,
          contactPhone: org.contact_phone || undefined,
          website: org.website || undefined,
          tier: org.tier,
          status: org.status,
          partnerSince: org.partner_since || undefined,
          licenseDiscountPercent: org.license_discount_percent ?? undefined,
          commissionRatePercent: org.commission_rate_percent ?? undefined,
          performanceScore: org.performance_score ?? undefined,
          publicListingEnabled: Boolean(org.public_listing_enabled),
          specializations: specializations.map((s) => s.framework),
          regions: regions.map((r) => r.region),
        },
      },
    });
  } catch (error: any) {
    logger.error('Error fetching partner connection:', error);
    if (isSchemaMissingError(error)) {
      return featureUnavailable(res, 'Partner connection unavailable (database schema missing)');
    }
    next(error);
  }
});

/**
 * POST /api/partners/connect
 * Creates a partner organization and connects the current user (owner).
 * Idempotent: if already connected, returns existing connection.
 */
router.post('/connect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).userId;
    const userEmail = String((req as any).user?.email || '').trim();
    const userName = String((req as any).user?.name || '').trim();
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const existingPartnerOrgId = await getActivePartnerOrgIdForUser(userId);
    if (existingPartnerOrgId) {
      const db = getDatabase();
      const org = await DbPromise.get<any>(
        db,
        `SELECT po.*
         FROM partner_organizations po
         WHERE po.id = ?
         LIMIT 1`,
        [existingPartnerOrgId]
      );
      if (!org) {
        return res.json({ success: true, data: { connected: false } });
      }

      const [specializations, regions] = await Promise.all([
        DbPromise.all<{ framework: string }>(
          db,
          `SELECT framework FROM partner_specializations WHERE partner_org_id = ? ORDER BY framework ASC`,
          [org.id]
        ),
        DbPromise.all<{ region: string }>(
          db,
          `SELECT region FROM partner_regions WHERE partner_org_id = ? ORDER BY region ASC`,
          [org.id]
        ),
      ]);

      return res.json({
        success: true,
        data: {
          connected: true,
          organization: {
            id: org.id,
            name: org.name,
            legalName: org.legal_name || undefined,
            taxId: org.tax_id || undefined,
            contactEmail: org.contact_email,
            contactPhone: org.contact_phone || undefined,
            website: org.website || undefined,
            tier: org.tier,
            status: org.status,
            partnerSince: org.partner_since || undefined,
            licenseDiscountPercent: org.license_discount_percent ?? undefined,
            commissionRatePercent: org.commission_rate_percent ?? undefined,
            performanceScore: org.performance_score ?? undefined,
            publicListingEnabled: Boolean(org.public_listing_enabled),
            specializations: specializations.map((s) => s.framework),
            regions: regions.map((r) => r.region),
          },
        },
      });
    }

    const requestedName = String(req.body?.name || '').trim();
    const name = requestedName || (userName ? `${userName} — Partner` : 'Partner Organization');
    const contactEmail = String(req.body?.contactEmail || userEmail || '').trim();
    if (!contactEmail) {
      return res.status(400).json({ success: false, error: 'contactEmail is required' });
    }

    const partnerOrgId = crypto.randomUUID();
    const partnerUserId = crypto.randomUUID();
    const db = getDatabase();

    const result = await DbPromise.transaction([
      {
        sql: `INSERT INTO partner_organizations
              (id, name, contact_email, tier, status, partner_since, public_listing_enabled, created_at, updated_at, created_by, updated_by)
              VALUES (?, ?, ?, 'registered', 'active', NOW(), FALSE, NOW(), NOW(), ?, ?)`,
        params: [partnerOrgId, name, contactEmail, userId, userId],
      },
      {
        sql: `INSERT INTO partner_users
              (id, partner_org_id, user_id, role, status, joined_at, created_at, updated_at)
              VALUES (?, ?, ?, 'owner', 'active', NOW(), NOW(), NOW())`,
        params: [partnerUserId, partnerOrgId, userId],
      },
    ]);

    if (!result.success) {
      if (isSchemaMissingError(new Error(String(result.error || '')))) {
        return featureUnavailable(res, 'Partner connect unavailable (database schema missing)');
      }
      return res.status(500).json({ success: false, error: result.error || 'Failed to connect' });
    }

    // Return connection info (connected: true)
    const org = await DbPromise.get<any>(
      db,
      `SELECT po.*
       FROM partner_organizations po
       WHERE po.id = ?
       LIMIT 1`,
      [partnerOrgId]
    );

    return res.status(201).json({
      success: true,
      data: {
        connected: true,
        organization: {
          id: org?.id || partnerOrgId,
          name: org?.name || name,
          legalName: org?.legal_name || undefined,
          taxId: org?.tax_id || undefined,
          contactEmail: org?.contact_email || contactEmail,
          contactPhone: org?.contact_phone || undefined,
          website: org?.website || undefined,
          tier: org?.tier || 'registered',
          status: org?.status || 'active',
          partnerSince: org?.partner_since || undefined,
          licenseDiscountPercent: org?.license_discount_percent ?? undefined,
          commissionRatePercent: org?.commission_rate_percent ?? undefined,
          performanceScore: org?.performance_score ?? undefined,
          publicListingEnabled: Boolean(org?.public_listing_enabled),
          specializations: [],
          regions: [],
        },
      },
    });
  } catch (error: any) {
    logger.error('Error connecting partner profile:', error);
    if (isSchemaMissingError(error)) {
      return featureUnavailable(res, 'Partner connect unavailable (database schema missing)');
    }
    next(error);
  }
});

// =============================================================================
// PARTNER ORGANIZATION ROUTES
// =============================================================================

/**
 * GET /api/partners/organization
 * Get current user's partner organization
 */
router.get('/organization', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const db = getDatabase();
    const org = await DbPromise.get<any>(
      db,
      `SELECT po.*
       FROM partner_users pu
       JOIN partner_organizations po ON po.id = pu.partner_org_id
       WHERE pu.user_id = ? AND pu.status = 'active'
       LIMIT 1`,
      [userId]
    );

    if (!org) {
      return res.status(403).json({ success: false, error: 'Partner organization required' });
    }

    const [specializations, regions] = await Promise.all([
      DbPromise.all<{ framework: string }>(
        db,
        `SELECT framework FROM partner_specializations WHERE partner_org_id = ? ORDER BY framework ASC`,
        [org.id]
      ),
      DbPromise.all<{ region: string }>(
        db,
        `SELECT region FROM partner_regions WHERE partner_org_id = ? ORDER BY region ASC`,
        [org.id]
      ),
    ]);

    return res.json({
      success: true,
      data: {
        id: org.id,
        name: org.name,
        legalName: org.legal_name || undefined,
        taxId: org.tax_id || undefined,
        contactEmail: org.contact_email,
        contactPhone: org.contact_phone || undefined,
        website: org.website || undefined,
        tier: org.tier,
        status: org.status,
        partnerSince: org.partner_since || undefined,
        licenseDiscountPercent: org.license_discount_percent ?? undefined,
        commissionRatePercent: org.commission_rate_percent ?? undefined,
        performanceScore: org.performance_score ?? undefined,
        publicListingEnabled: Boolean(org.public_listing_enabled),
        specializations: specializations.map((s) => s.framework),
        regions: regions.map((r) => r.region),
      },
    });
  } catch (error: any) {
    logger.error('Error fetching partner organization:', error);
    next(error);
  }
});

/**
 * PUT /api/partners/organization
 * Update partner organization details
 */
router.put('/organization', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = await requirePartnerOrgId(req, res);
    if (!partnerOrgId) return;

    const { name, taxId, contactEmail, contactPhone, website } = req.body || {};
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: 'name is required' });
    }
    if (!contactEmail || typeof contactEmail !== 'string') {
      return res.status(400).json({ success: false, error: 'contactEmail is required' });
    }

    const db = getDatabase();
    await DbPromise.run(
      db,
      `UPDATE partner_organizations
       SET name = ?, tax_id = ?, contact_email = ?, contact_phone = ?, website = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, taxId || null, contactEmail, contactPhone || null, website || null, partnerOrgId]
    );

    return res.json({ success: true, message: 'Organization updated successfully' });
  } catch (error: any) {
    logger.error('Error updating partner organization:', error);
    next(error);
  }
});

/**
 * PUT /api/partners/organization/specializations
 * Update partner specializations
 */
router.put(
  '/organization/specializations',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const partnerOrgId = await requirePartnerOrgId(req, res);
      if (!partnerOrgId) return;

      const { specializations } = req.body || {};
      if (!Array.isArray(specializations)) {
        return res.status(400).json({ success: false, error: 'specializations must be an array' });
      }

      const uniqueFrameworks = Array.from(
        new Set(
          specializations
            .filter((s: unknown) => typeof s === 'string' && s.trim().length > 0)
            .map((s: string) => s.trim())
        )
      );

      const statements = [
        {
          sql: `DELETE FROM partner_specializations WHERE partner_org_id = ?`,
          params: [partnerOrgId],
        },
        ...uniqueFrameworks.map((fw) => ({
          sql: `INSERT INTO partner_specializations (id, partner_org_id, framework, certified, created_at)
                VALUES (?, ?, ?, FALSE, NOW())
                ON CONFLICT (partner_org_id, framework) DO NOTHING`,
          params: [crypto.randomUUID(), partnerOrgId, fw],
        })),
      ];

      const result = await DbPromise.transaction(statements);
      if (!result.success) {
        return res.status(500).json({ success: false, error: result.error || 'Failed to update' });
      }

      return res.json({ success: true, message: 'Specializations updated successfully' });
    } catch (error: any) {
      logger.error('Error updating specializations:', error);
      next(error);
    }
  }
);

/**
 * PUT /api/partners/organization/regions
 * Update operating regions
 */
router.put('/organization/regions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = await requirePartnerOrgId(req, res);
    if (!partnerOrgId) return;

    const { regions } = req.body || {};
    if (!Array.isArray(regions)) {
      return res.status(400).json({ success: false, error: 'regions must be an array' });
    }

    const uniqueRegions = Array.from(
      new Set(
        regions
          .filter((r: unknown) => typeof r === 'string' && r.trim().length > 0)
          .map((r: string) => r.trim())
      )
    );

    const statements = [
      { sql: `DELETE FROM partner_regions WHERE partner_org_id = ?`, params: [partnerOrgId] },
      ...uniqueRegions.map((region) => ({
        sql: `INSERT INTO partner_regions (id, partner_org_id, region, is_primary, created_at)
              VALUES (?, ?, ?, FALSE, NOW())
              ON CONFLICT (partner_org_id, region) DO NOTHING`,
        params: [crypto.randomUUID(), partnerOrgId, region],
      })),
    ];

    const result = await DbPromise.transaction(statements);
    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error || 'Failed to update' });
    }

    return res.json({ success: true, message: 'Regions updated successfully' });
  } catch (error: any) {
    logger.error('Error updating regions:', error);
    next(error);
  }
});

/**
 * PUT /api/partners/organization/listing
 * Update public listing settings
 */
router.put('/organization/listing', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = await requirePartnerOrgId(req, res);
    if (!partnerOrgId) return;

    const { publicListingEnabled } = req.body || {};
    if (typeof publicListingEnabled !== 'boolean') {
      return res
        .status(400)
        .json({ success: false, error: 'publicListingEnabled must be boolean' });
    }

    const db = getDatabase();
    await DbPromise.run(
      db,
      `UPDATE partner_organizations
       SET public_listing_enabled = ?, updated_at = NOW()
       WHERE id = ?`,
      [publicListingEnabled, partnerOrgId]
    );

    return res.json({ success: true, message: 'Listing updated successfully' });
  } catch (error: any) {
    logger.error('Error updating listing:', error);
    next(error);
  }
});

// =============================================================================
// REFERRAL TOOLS ROUTES (NEW - Core Partner Referral System)
// =============================================================================

/**
 * GET /api/partners/referral-tools
 * Get partner's referral codes, links, and campaign links
 */
router.get('/referral-tools', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = (req as any).user?.partnerOrgId || 'partner-org-001';

    let tools;
    try {
      tools = await PartnerReferralService.getReferralTools(partnerOrgId);
    } catch (dbError: any) {
      logger.warn('Referral tools: DB query failed, using fallback data:', dbError?.message);
    }

    if (!tools) {
      // Return fallback demo data when DB is unavailable
      tools = {
        referralCode: 'ACME-2024',
        referralLink: `${process.env.APP_URL || 'https://app.consultify.com'}/ref/acme-consulting`,
        referralLinkSlug: 'acme-consulting',
        qrCodeUrl: null,
        campaignLinks: [],
      };
    }

    res.json({ success: true, data: tools });
  } catch (error: any) {
    logger.error('Error fetching referral tools:', error);
    next(error);
  }
});

/**
 * POST /api/partners/campaign-links
 * Create a new campaign link with UTM parameters
 */
router.post('/campaign-links', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = (req as any).user?.partnerOrgId || 'partner-org-001';
    const { name, description, utmSource, utmMedium, utmCampaign, utmContent, destinationUrl } =
      req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Campaign name is required' });
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

    res.status(201).json({ success: true, data: campaignLink });
  } catch (error: any) {
    logger.error('Error creating campaign link:', error);
    next(error);
  }
});

/**
 * DELETE /api/partners/campaign-links/:linkId
 * Delete a campaign link
 */
router.delete(
  '/campaign-links/:linkId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const partnerOrgId = (req as any).user?.partnerOrgId || 'partner-org-001';
      const { linkId } = req.params;

      const deleted = await PartnerReferralService.deleteCampaignLink(partnerOrgId, linkId);

      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Campaign link not found' });
      }

      res.json({ success: true, message: 'Campaign link deleted' });
    } catch (error: any) {
      logger.error('Error deleting campaign link:', error);
      next(error);
    }
  }
);

/**
 * GET /api/partners/referral-analytics
 * Get referral click and conversion analytics
 */
router.get('/referral-analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = (req as any).user?.partnerOrgId || 'partner-org-001';
    const days = parseInt(req.query.days as string) || 30;

    let analytics;
    try {
      analytics = await PartnerReferralService.getReferralAnalytics(partnerOrgId, days);
    } catch (dbError: any) {
      logger.warn('Referral analytics: DB query failed, using fallback data:', dbError?.message);
      analytics = {
        totalClicks: 0,
        uniqueClicks: 0,
        signups: 0,
        conversions: 0,
        clicksByDay: [],
        topCampaigns: [],
      };
    }

    res.json({ success: true, data: analytics });
  } catch (error: any) {
    logger.error('Error fetching referral analytics:', error);
    next(error);
  }
});

/**
 * GET /api/partners/attributions
 * Get list of organizations attributed to this partner
 */
router.get('/attributions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = (req as any).user?.partnerOrgId || 'partner-org-001';
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    let attributions;
    try {
      attributions = await PartnerReferralService.getPartnerAttributions(partnerOrgId, {
        status: status as any,
        limit,
        offset,
      });
    } catch (dbError: any) {
      logger.warn('Attributions: DB query failed, using fallback data:', dbError?.message);
      attributions = { items: [], total: 0, limit, offset };
    }

    res.json({ success: true, data: attributions });
  } catch (error: any) {
    logger.error('Error fetching attributions:', error);
    next(error);
  }
});

// =============================================================================
// EARNINGS & PAYOUTS ROUTES (NEW - Commission System)
// =============================================================================

/**
 * GET /api/partners/earnings
 * Get earnings summary for the partner
 */
router.get('/earnings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = (req as any).user?.partnerOrgId || 'partner-org-001';

    let earnings;
    try {
      earnings = await PartnerCommissionService.getEarningsSummary(partnerOrgId);
    } catch (dbError: any) {
      logger.warn('Earnings: DB query failed, using fallback data:', dbError?.message);
      earnings = {
        totalEarnedYTD: 0,
        thisMonth: 0,
        pendingApproval: 0,
        readyForPayout: 0,
        totalPaidOut: 0,
        commissionRate: 15,
        nextPaymentDate: null,
        bankInfoComplete: true,
      };
    }

    res.json({ success: true, data: earnings });
  } catch (error: any) {
    logger.error('Error fetching earnings:', error);
    next(error);
  }
});

/**
 * GET /api/partners/commission-transactions
 * Get detailed commission transactions
 */
router.get('/commission-transactions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = (req as any).user?.partnerOrgId || 'partner-org-001';
    const status = req.query.status as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    let commissions;
    try {
      commissions = await PartnerCommissionService.getCommissions(partnerOrgId, {
        status: status as any,
        startDate,
        endDate,
        limit,
        offset,
      });
    } catch (dbError: any) {
      logger.warn(
        'Commission transactions: DB query failed, using fallback data:',
        dbError?.message
      );
      commissions = [];
    }

    res.json({ success: true, data: commissions });
  } catch (error: any) {
    logger.error('Error fetching commission transactions:', error);
    next(error);
  }
});

/**
 * POST /api/partners/payouts/request
 * Request a payout of approved commissions
 */
router.post('/payouts/request', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = (req as any).user?.partnerOrgId || 'partner-org-001';
    const userId = (req as any).user?.id;
    const { payoutAccountId, notes } = req.body;

    const payout = await PartnerCommissionService.requestPayout({
      partnerOrgId,
      payoutAccountId,
      requestedBy: userId,
      notes,
    });

    if (!payout) {
      return res.status(400).json({
        success: false,
        error: 'No approved commissions available for payout or amount below threshold',
      });
    }

    res.status(201).json({ success: true, data: payout });
  } catch (error: any) {
    logger.error('Error requesting payout:', error);
    next(error);
  }
});

/**
 * GET /api/partners/payouts
 * Get payout history
 */
router.get('/payouts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = (req as any).user?.partnerOrgId;
    if (!partnerOrgId) {
      return res.status(403).json({ success: false, error: 'Partner organization required' });
    }
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    try {
      const payouts = await PartnerCommissionService.getPayouts(partnerOrgId, {
        status: status as any,
        limit,
        offset,
      });
      return res.json({ success: true, data: payouts });
    } catch (dbError: any) {
      logger.warn('Payouts: DB query failed:', dbError?.message);
      if (isSchemaMissingError(dbError)) {
        return featureUnavailable(
          res,
          'Partner payouts unavailable (database schema missing or misconfigured)'
        );
      }
      throw dbError;
    }
  } catch (error: any) {
    logger.error('Error fetching payouts:', error);
    next(error);
  }
});

// =============================================================================
// DASHBOARD & METRICS ROUTES
// =============================================================================

/**
 * GET /api/partners/dashboard
 * Get partner dashboard summary data
 * GAP-PARTNER-005: Connected to real database
 */
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Default fallback dashboard data
    const fallbackDashboard = {
      stats: {
        activeClients: 0,
        activeProjects: 0,
        certificationLevel: 'registered',
        monthlyRevenue: 0,
        revenueChange: 0,
        totalLicenses: 0,
        activeLicenses: 0,
        availableLicenses: 0,
      },
      recentActivity: [] as Array<{ type: string; text: string; time: string }>,
      certificationProgress: {
        completed: 2,
        total: 4,
        courses: [
          { name: 'Consultify Foundations', status: 'completed' },
          { name: 'PMO Standards', status: 'completed' },
          { name: 'AI Intelligence Modules', status: 'in-progress', progress: 45 },
          { name: 'Assessment Specialist', status: 'locked' },
        ],
      },
    };

    // Try to load from database, fallback to demo data
    try {
      const partnerOrgId = (req as any).user?.partnerOrgId || 'partner-org-001';
      const { getDatabase } = await import('../database/Database.js');
      const db = getDatabase();
      const { get: dbGet, all: dbAll } = await import('../utils/DbPromise.js');

      const partnerOrg = await dbGet<{
        tier: string;
        status: string;
        commission_rate_percent: number;
      }>(
        db,
        `SELECT tier, status, commission_rate_percent FROM partner_organizations WHERE id = ?`,
        [partnerOrgId]
      );

      const clientStats = await dbGet<{ count: number }>(
        db,
        `SELECT COUNT(*) as count FROM partner_attributions WHERE partner_org_id = ? AND status = 'ACTIVE'`,
        [partnerOrgId]
      );

      const thisMonthRevenue = await dbGet<{ total: number }>(
        db,
        `SELECT COALESCE(SUM(gross_amount), 0) as total 
               FROM partner_commission_transactions 
               WHERE partner_org_id = ? 
               AND transaction_date >= date('now', 'start of month')`,
        [partnerOrgId]
      );

      const lastMonthRevenue = await dbGet<{ total: number }>(
        db,
        `SELECT COALESCE(SUM(gross_amount), 0) as total 
               FROM partner_commission_transactions 
               WHERE partner_org_id = ? 
               AND transaction_date >= date('now', 'start of month', '-1 month')
               AND transaction_date < date('now', 'start of month')`,
        [partnerOrgId]
      );

      const currentRev = thisMonthRevenue?.total || 0;
      const lastRev = lastMonthRevenue?.total || 1;
      const revenueChange = lastRev > 0 ? Math.round(((currentRev - lastRev) / lastRev) * 100) : 0;

      const recentCommissions = await dbAll<{
        transaction_type: string;
        gross_amount: number;
        created_at: string;
      }>(
        db,
        `SELECT transaction_type, gross_amount, created_at 
               FROM partner_commission_transactions 
               WHERE partner_org_id = ? 
               ORDER BY created_at DESC 
               LIMIT 3`,
        [partnerOrgId]
      );

      const recentAttributions = await dbAll<{
        organization_id: string;
        attributed_at: string;
      }>(
        db,
        `SELECT pa.organization_id, pa.attributed_at, o.name as org_name
               FROM partner_attributions pa
               LEFT JOIN organizations o ON pa.organization_id = o.id
               WHERE pa.partner_org_id = ? 
               ORDER BY pa.attributed_at DESC 
               LIMIT 2`,
        [partnerOrgId]
      );

      const recentActivity: Array<{ type: string; text: string; time: string }> = [];

      for (const comm of recentCommissions || []) {
        const timeAgo = getTimeAgo(new Date(comm.created_at));
        recentActivity.push({
          type: 'commission',
          text: `Commission earned: €${comm.gross_amount.toFixed(2)} (${comm.transaction_type})`,
          time: timeAgo,
        });
      }

      for (const attr of (recentAttributions as any[]) || []) {
        const timeAgo = getTimeAgo(new Date(attr.attributed_at));
        recentActivity.push({
          type: 'client',
          text: `New referral: ${attr.org_name || 'Organization'}`,
          time: timeAgo,
        });
      }

      recentActivity.sort((a, b) => {
        const aTime = parseTimeAgo(a.time);
        const bTime = parseTimeAgo(b.time);
        return aTime - bTime;
      });

      fallbackDashboard.stats.activeClients = clientStats?.count || 0;
      fallbackDashboard.stats.certificationLevel = partnerOrg?.tier || 'registered';
      fallbackDashboard.stats.monthlyRevenue = Math.round(currentRev);
      fallbackDashboard.stats.revenueChange = revenueChange;
      fallbackDashboard.recentActivity = recentActivity.slice(0, 5);
    } catch (dbError: any) {
      logger.warn('Dashboard: DB query failed, using fallback data:', dbError?.message);
    }

    res.json({ success: true, data: fallbackDashboard });
  } catch (error: any) {
    logger.error('Error fetching dashboard:', error);
    next(error);
  }
});

// Helper function to get time ago string
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

// Helper function to parse time ago for sorting
function parseTimeAgo(timeStr: string): number {
  const num = parseInt(timeStr);
  if (timeStr.includes('m')) return num;
  if (timeStr.includes('h')) return num * 60;
  if (timeStr.includes('d')) return num * 60 * 24;
  if (timeStr.includes('w')) return num * 60 * 24 * 7;
  return 9999;
}

/**
 * GET /api/partners/metrics
 * Referral funnel + earnings summary (same runtime services as V8 partner read bridge).
 */
router.get('/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
    if (!partnerOrgId) {
      return res.status(403).json({ success: false, error: 'Partner organization required' });
    }

    const days = parseInt(req.query.days as string) || 30;
    const [referralAnalytics, earningsSummary] = await Promise.all([
      PartnerReferralService.getReferralAnalytics(partnerOrgId, days),
      PartnerCommissionService.getEarningsSummary(partnerOrgId),
    ]);

    return res.json({
      success: true,
      data: { partnerOrgId, days, referralAnalytics, earningsSummary },
    });
  } catch (error: any) {
    logger.error('Error fetching metrics:', error);
    if (isSchemaMissingError(error)) {
      return featureUnavailable(res, 'Partner metrics unavailable (database schema missing)');
    }
    next(error);
  }
});

// =============================================================================
// CLIENT ORGANIZATIONS ROUTES
// =============================================================================

/**
 * GET /api/partners/clients
 * Get list of client organizations
 */
router.get('/clients', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return featureUnavailable(res, 'Partner clients unavailable (no real implementation)');
  } catch (error: any) {
    logger.error('Error fetching clients:', error);
    next(error);
  }
});

/**
 * POST /api/partners/clients
 * Add new client organization
 */
router.post('/clients', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return featureUnavailable(res, 'Partner client creation unavailable (no real implementation)');
  } catch (error: any) {
    logger.error('Error creating client:', error);
    next(error);
  }
});

/**
 * GET /api/partners/clients/:clientId
 * Get specific client details
 */
router.get('/clients/:clientId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return featureUnavailable(res, 'Partner client details unavailable (no real implementation)');
  } catch (error: any) {
    logger.error('Error fetching client:', error);
    next(error);
  }
});

// =============================================================================
// EMPLOYEES ROUTES (Team Members with Client Access)
// =============================================================================

/**
 * GET /api/partners/employees
 * Get list of partner employees with client access
 */
router.get('/employees', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return featureUnavailable(res, 'Partner employees unavailable (no real implementation)');
  } catch (error: any) {
    logger.error('Error fetching employees:', error);
    next(error);
  }
});

/**
 * POST /api/partners/employees
 * Add new team member
 */
router.post('/employees', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return featureUnavailable(
      res,
      'Partner employee creation unavailable (no real implementation)'
    );
  } catch (error: any) {
    logger.error('Error creating employee:', error);
    next(error);
  }
});

// =============================================================================
// STATS ROUTES
// =============================================================================

/**
 * GET /api/partners/stats
 * Get partner statistics summary
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return featureUnavailable(res, 'Partner stats unavailable (no real implementation)');
  } catch (error: any) {
    logger.error('Error fetching partner stats:', error);
    next(error);
  }
});

// =============================================================================
// ACCESS LINKS ROUTES
// =============================================================================

/**
 * POST /api/partners/access-links
 * Generate a new access link for client onboarding
 */
router.post('/access-links', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return featureUnavailable(res, 'Partner access links unavailable (no real implementation)');
  } catch (error: any) {
    logger.error('Error generating access link:', error);
    next(error);
  }
});

// =============================================================================
// PROJECTS ROUTES
// =============================================================================

/**
 * GET /api/partners/projects
 * Get list of partner projects
 */
router.get('/projects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return featureUnavailable(res, 'Partner projects unavailable (no real implementation)');
  } catch (error: any) {
    logger.error('Error fetching projects:', error);
    next(error);
  }
});

// =============================================================================
// CERTIFICATION & LEARNING ROUTES
// =============================================================================

/**
 * GET /api/partners/certifications
 * Get partner certifications status
 */
router.get('/certifications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = await requirePartnerOrgId(req, res);
    if (!partnerOrgId) return;
    const userId = (req as any).user?.id || (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const language = looksPolish(req) ? 'pl' : 'en';
    const certification = await ensureSalesCertification({ partnerOrgId, userId });
    const modules = await getSalesModules(language);
    await ensureLearningProgressRows({
      certificationId: certification.id,
      moduleIds: modules.map((m) => m.id),
    });
    await recalcCertificationProgress(certification.id);

    const db = getDatabase();
    const updated = await DbPromise.get<any>(
      db,
      `SELECT * FROM partner_certifications WHERE id = ?`,
      [certification.id]
    );

    const totalMinutes = modules.reduce((sum, m) => {
      const v = Number(m.minutes ?? m.duration_minutes ?? 0);
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    return res.json({
      success: true,
      data: [
        {
          id: updated.id,
          name: updated.certification_name || 'Sales Certification',
          type: updated.certification_type || 'sales',
          status: updated.status || 'not_started',
          progress: updated.progress_percent || 0,
          duration,
          modules: modules.length,
          startedAt: updated.started_at || undefined,
          completedAt: updated.completed_at || undefined,
          certificateId: updated.certificate_id || undefined,
          certificateUrl: updated.certificate_url || undefined,
        },
      ],
    });
  } catch (error: any) {
    logger.error('Error fetching certifications:', error);
    next(error);
  }
});

/**
 * GET /api/partners/certifications/:certId/modules
 * Get modules for a certification
 */
router.get(
  '/certifications/:certId/modules',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const partnerOrgId = await requirePartnerOrgId(req, res);
      if (!partnerOrgId) return;
      const userId = (req as any).user?.id || (req as any).userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const { certId } = req.params;
      const db = getDatabase();
      const cert = await DbPromise.get<any>(
        db,
        `SELECT * FROM partner_certifications WHERE id = ? AND partner_org_id = ? AND user_id = ?`,
        [certId, partnerOrgId, userId]
      );
      if (!cert) return res.status(404).json({ success: false, error: 'Certification not found' });

      const language = looksPolish(req) ? 'pl' : 'en';
      const modules = await getSalesModules(language);
      await ensureLearningProgressRows({
        certificationId: certId,
        moduleIds: modules.map((m) => m.id),
      });

      const progressRows = await DbPromise.all<any>(
        db,
        `SELECT module_id, status, progress_percent, started_at, completed_at
         FROM partner_learning_progress
         WHERE certification_id = ?`,
        [certId]
      );
      const progressByModule = new Map(progressRows.map((r: any) => [r.module_id, r]));

      return res.json({
        success: true,
        data: modules.map((m) => {
          const p = progressByModule.get(m.id);
          return {
            id: m.id,
            name: m.name,
            description: m.description || null,
            order: m.module_order,
            minutes: m.minutes ?? m.duration_minutes ?? null,
            status: p?.status || 'not_started',
            progress: p?.progress_percent || 0,
            startedAt: p?.started_at || null,
            completedAt: p?.completed_at || null,
          };
        }),
      });
    } catch (error: any) {
      logger.error('Error fetching modules:', error);
      next(error);
    }
  }
);

/**
 * POST /api/partners/certifications/:certId/modules/:moduleId/progress
 * Update module progress
 */
router.post(
  '/certifications/:certId/modules/:moduleId/progress',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const partnerOrgId = await requirePartnerOrgId(req, res);
      if (!partnerOrgId) return;
      const userId = (req as any).user?.id || (req as any).userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const { certId, moduleId } = req.params;
      const { status, progress } = req.body || {};

      const allowedStatus = new Set(['not_started', 'in_progress', 'completed']);
      const nextStatus = allowedStatus.has(status) ? status : null;
      const nextProgress = Number.isFinite(Number(progress))
        ? Math.max(0, Math.min(100, Number(progress)))
        : null;
      if (!nextStatus && nextProgress === null) {
        return res.status(400).json({ success: false, error: 'status or progress required' });
      }

      const db = getDatabase();
      const cert = await DbPromise.get<any>(
        db,
        `SELECT id FROM partner_certifications WHERE id = ? AND partner_org_id = ? AND user_id = ?`,
        [certId, partnerOrgId, userId]
      );
      if (!cert) return res.status(404).json({ success: false, error: 'Certification not found' });

      await DbPromise.run(
        db,
        `INSERT INTO partner_learning_progress (id, certification_id, module_id, status, progress_percent, started_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())
         ON CONFLICT (certification_id, module_id)
         DO UPDATE SET status = COALESCE(?, partner_learning_progress.status),
                       progress_percent = COALESCE(?, partner_learning_progress.progress_percent),
                       started_at = COALESCE(partner_learning_progress.started_at, NOW()),
                       completed_at = CASE WHEN COALESCE(?, partner_learning_progress.status) = 'completed'
                                           THEN COALESCE(partner_learning_progress.completed_at, NOW())
                                           ELSE partner_learning_progress.completed_at END,
                       updated_at = NOW()`,
        [
          crypto.randomUUID(),
          certId,
          moduleId,
          nextStatus || 'in_progress',
          nextProgress ?? 0,
          nextStatus,
          nextProgress,
          nextStatus,
        ]
      );

      await recalcCertificationProgress(certId);
      return res.json({ success: true });
    } catch (error: any) {
      logger.error('Error updating progress:', error);
      next(error);
    }
  }
);

/**
 * POST /api/partners/certifications/:certId/exam/start
 */
router.post(
  '/certifications/:certId/exam/start',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const partnerOrgId = await requirePartnerOrgId(req, res);
      if (!partnerOrgId) return;
      const userId = (req as any).user?.id || (req as any).userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const { certId } = req.params;
      const language = req.body?.language === 'pl' || looksPolish(req) ? 'pl' : 'en';
      const ip = String((req.headers['x-forwarded-for'] as any) || req.socket.remoteAddress || '');
      const userAgent = String(req.headers['user-agent'] || '');

      const attempt = await startSalesExam({
        certificationId: certId,
        partnerOrgId,
        userId,
        language,
        ip,
        userAgent,
      });

      return res.json({ success: true, data: attempt });
    } catch (error: any) {
      logger.error('Error starting exam:', error);
      return res
        .status(400)
        .json({ success: false, error: error?.message || 'Failed to start exam' });
    }
  }
);

/**
 * POST /api/partners/certifications/:certId/exam/submit
 */
router.post(
  '/certifications/:certId/exam/submit',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const partnerOrgId = await requirePartnerOrgId(req, res);
      if (!partnerOrgId) return;
      const userId = (req as any).user?.id || (req as any).userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const { certId } = req.params;
      const { attemptId, answers } = req.body || {};
      if (!attemptId || typeof attemptId !== 'string') {
        return res.status(400).json({ success: false, error: 'attemptId is required' });
      }
      if (!answers || typeof answers !== 'object') {
        return res.status(400).json({ success: false, error: 'answers is required' });
      }

      const result = await submitSalesExam({
        attemptId,
        certificationId: certId,
        partnerOrgId,
        userId,
        answers,
      });
      return res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Error submitting exam:', error);
      return res
        .status(400)
        .json({ success: false, error: error?.message || 'Failed to submit exam' });
    }
  }
);

/**
 * GET /api/partners/certificates/:certificateId/download
 */
router.get(
  '/certificates/:certificateId/download',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const partnerOrgId = await requirePartnerOrgId(req, res);
      if (!partnerOrgId) return;
      const userId = (req as any).user?.id || (req as any).userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const { certificateId } = req.params;
      const db = getDatabase();
      const cert = await DbPromise.get<any>(
        db,
        `SELECT pc.id, pc.certificate_type, pc.earned_at, po.name as partner_org_name
         FROM partner_certificates pc
         JOIN partner_organizations po ON po.id = pc.partner_org_id
         WHERE pc.id = ? AND pc.partner_org_id = ? AND pc.user_id = ?`,
        [certificateId, partnerOrgId, userId]
      );
      if (!cert) return res.status(404).json({ success: false, error: 'Certificate not found' });

      const pdf = await generatePartnerCertificatePdf({
        certificateId: cert.id,
        partnerOrgName: cert.partner_org_name || 'Partner',
        userName: (req as any).user?.name || 'User',
        certificateType: cert.certificate_type || 'sales',
        earnedAt: cert.earned_at || new Date().toISOString(),
        language: looksPolish(req) ? 'pl' : 'en',
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="partner-certificate-${certificateId}.pdf"`
      );
      return res.status(200).send(pdf);
    } catch (error: any) {
      logger.error('Error downloading certificate:', error);
      next(error);
    }
  }
);

// =============================================================================
// LICENSES ROUTES
// =============================================================================

/**
 * GET /api/partners/licenses
 * Get partner license allocations
 */
router.get('/licenses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return featureUnavailable(res, 'Partner licenses unavailable (no real implementation)');
  } catch (error: any) {
    logger.error('Error fetching licenses:', error);
    next(error);
  }
});

/**
 * POST /api/partners/licenses/order
 * Order additional licenses
 */
router.post('/licenses/order', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return featureUnavailable(res, 'Partner license ordering unavailable (no real implementation)');
  } catch (error: any) {
    logger.error('Error ordering licenses:', error);
    next(error);
  }
});

// =============================================================================
// COMMISSIONS ROUTES
// =============================================================================

/**
 * GET /api/partners/commissions
 * Commission transactions for the authenticated partner org (read-only).
 */
router.get('/commissions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const partnerOrgId = await getActivePartnerOrgIdForUser(userId);
    if (!partnerOrgId) {
      return res.status(403).json({ success: false, error: 'Partner organization required' });
    }

    const status = req.query.status as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const commissions = await PartnerCommissionService.getCommissions(partnerOrgId, {
      status: status as any,
      startDate,
      endDate,
      limit,
      offset,
    });

    return res.json({ success: true, data: commissions });
  } catch (error: any) {
    logger.error('Error fetching commissions:', error);
    if (isSchemaMissingError(error)) {
      return featureUnavailable(res, 'Partner commissions unavailable (database schema missing)');
    }
    next(error);
  }
});

// =============================================================================
// INVOICES ROUTES
// =============================================================================

/**
 * GET /api/partners/invoices
 * Get partner invoices
 */
router.get('/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return featureUnavailable(res, 'Partner invoices unavailable (no real implementation)');
  } catch (error: any) {
    logger.error('Error fetching invoices:', error);
    next(error);
  }
});

/**
 * GET /api/partners/invoices/:invoiceId/download
 * Download invoice PDF
 */
router.get(
  '/invoices/:invoiceId/download',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      return featureUnavailable(
        res,
        'Partner invoice downloads unavailable (no real implementation)'
      );
    } catch (error: any) {
      logger.error('Error downloading invoice:', error);
      next(error);
    }
  }
);

// =============================================================================
// RESOURCES ROUTES
// =============================================================================

/**
 * GET /api/partners/resources
 * Get partner resources
 */
router.get('/resources', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partnerOrgId = await requirePartnerOrgId(req, res);
    if (!partnerOrgId) return;

    const db = getDatabase();
    const partnerTier = await getEffectivePartnerTier(partnerOrgId);

    const rows = await DbPromise.all<any>(
      db,
      `SELECT id, title, category, file_type, file_size_bytes, min_partner_tier,
              file_key, file_name, mime_type, size_bytes
       FROM partner_resources
       WHERE is_active = TRUE
       ORDER BY category ASC, title ASC`,
      []
    );

    const grouped = {
      documentation: [] as any[],
      marketing: [] as any[],
      caseStudies: [] as any[],
      templates: [] as any[],
    };

    for (const r of rows) {
      if (tierRank(partnerTier) < tierRank(r.min_partner_tier)) continue;
      const bytes = Number(r.size_bytes ?? r.file_size_bytes ?? 0);
      const item = {
        id: r.id,
        title: r.title,
        type: resourceTypeLabel(r.mime_type, r.file_type),
        size: formatBytes(Number.isFinite(bytes) ? bytes : 0),
        category: r.category,
      };

      if (r.category === 'marketing') grouped.marketing.push(item);
      else if (r.category === 'documentation') grouped.documentation.push(item);
      else if (r.category === 'case_study') grouped.caseStudies.push(item);
      else if (r.category === 'template') grouped.templates.push(item);
      else grouped.documentation.push(item);
    }

    return res.json({ success: true, data: grouped });
  } catch (error: any) {
    logger.error('Error fetching resources:', error);
    next(error);
  }
});

/**
 * GET /api/partners/resources/:resourceId/download
 * Download a resource
 */
router.get(
  '/resources/:resourceId/download',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const partnerOrgId = await requirePartnerOrgId(req, res);
      if (!partnerOrgId) return;
      const userId = (req as any).user?.id || (req as any).userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const { resourceId } = req.params;
      const db = getDatabase();
      const resource = await DbPromise.get<any>(
        db,
        `SELECT id, title, category, min_partner_tier, file_key, file_name, mime_type, language,
                size_bytes, file_size_bytes, file_type
         FROM partner_resources
         WHERE id = ? AND is_active = TRUE
         LIMIT 1`,
        [resourceId]
      );
      if (!resource) return res.status(404).json({ success: false, error: 'Resource not found' });

      const partnerTier = await getEffectivePartnerTier(partnerOrgId);
      if (tierRank(partnerTier) < tierRank(resource.min_partner_tier)) {
        return res.status(403).json({ success: false, error: 'Insufficient partner tier' });
      }

      if (!resource.file_key) {
        return res.status(500).json({ success: false, error: 'Resource not configured' });
      }

      const generated = await generatePartnerToolkitResourceFile({
        fileKey: resource.file_key,
        language: resource.language === 'pl' ? 'pl' : 'en',
        fileNameHint: resource.file_name || null,
      });

      // Audit download (best-effort)
      const ip = String((req.headers['x-forwarded-for'] as any) || req.socket.remoteAddress || '');
      const ipHash = ip ? crypto.createHash('sha256').update(String(ip)).digest('hex') : null;
      const userAgent = String(req.headers['user-agent'] || '');

      try {
        await DbPromise.run(
          db,
          `INSERT INTO partner_resource_downloads
            (id, resource_id, partner_org_id, user_id, downloaded_at, ip_hash, user_agent)
           VALUES (?, ?, ?, ?, NOW(), ?, ?)`,
          [crypto.randomUUID(), resourceId, partnerOrgId, userId, ipHash, userAgent || null]
        );
      } catch {
        await DbPromise.run(
          db,
          `INSERT INTO partner_resource_downloads (id, resource_id, partner_org_id, user_id, downloaded_at)
           VALUES (?, ?, ?, ?, NOW())`,
          [crypto.randomUUID(), resourceId, partnerOrgId, userId]
        );
      }

      await DbPromise.run(
        db,
        `UPDATE partner_resources
         SET download_count = COALESCE(download_count, 0) + 1, updated_at = NOW()
         WHERE id = ?`,
        [resourceId]
      );

      res.setHeader('Content-Type', generated.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${generated.fileName}"`);
      return res.status(200).send(generated.buffer);
    } catch (error: any) {
      logger.error('Error downloading resource:', error);
      next(error);
    }
  }
);

// =============================================================================
// DISCOUNT TIERS ROUTES
// =============================================================================

/**
 * GET /api/partners/tiers
 * Get partner tier information and requirements
 */
router.get('/tiers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return featureUnavailable(res, 'Partner tiers unavailable (no real implementation)');
  } catch (error: any) {
    logger.error('Error fetching tiers:', error);
    next(error);
  }
});

// =============================================================================
// PUBLIC ROUTES (No Authentication Required)
// These need to be mounted separately or use a different middleware setup
// =============================================================================

/**
 * Create a separate router for public endpoints
 * These should be mounted at /api/public/partner in Gateway
 */
export const publicPartnerRouter = Router();

/**
 * GET /api/public/partner/validate-code/:code
 * Validate a partner/referral code (used during signup)
 */
publicPartnerRouter.get(
  '/validate-code/:code',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code } = req.params;

      if (!code) {
        return res.status(400).json({ success: false, error: 'Code is required' });
      }

      const result = await PartnerReferralService.validateReferralCode(code);

      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Error validating partner code:', error);
      next(error);
    }
  }
);

/**
 * POST /api/public/partner/track-click
 * Track a referral link click (called when someone visits via referral link)
 */
publicPartnerRouter.post(
  '/track-click',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        referralCode,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
        landingPage,
        referer,
        sessionId,
        cookieId,
      } = req.body;

      if (!referralCode) {
        return res.status(400).json({ success: false, error: 'Referral code is required' });
      }

      // Look up partner by code
      const partner = await PartnerReferralService.getPartnerByReferralCode(referralCode);

      if (!partner) {
        return res.status(404).json({ success: false, error: 'Invalid referral code' });
      }

      // Hash IP for privacy
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
      const ipHash = require('crypto').createHash('sha256').update(String(ip)).digest('hex');

      const result = await PartnerReferralService.trackClick({
        partnerOrgId: partner.partnerOrgId,
        referralCode,
        ipHash,
        userAgent: req.headers['user-agent'] || undefined,
        referer,
        landingPage,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
        sessionId,
        cookieId,
      });

      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Error tracking click:', error);
      next(error);
    }
  }
);

// =============================================================================
// SUPERADMIN PARTNER SETTLEMENTS ROUTES
// These should be protected by superAdmin middleware
// =============================================================================

export const superAdminPartnerRouter = Router();

/**
 * GET /api/superadmin/partner-settlements/summary
 * Get overall partner settlements summary
 */
superAdminPartnerRouter.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await PartnerCommissionService.getSettlementsSummary();
    res.json({ success: true, data: summary });
  } catch (error: any) {
    logger.error('Error fetching settlements summary:', error);
    next(error);
  }
});

/**
 * GET /api/superadmin/partner-settlements/pending-commissions
 * Get all pending commissions across all partners
 */
superAdminPartnerRouter.get(
  '/pending-commissions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const commissions = await PartnerCommissionService.getAllPendingCommissions({
        limit,
        offset,
      });
      res.json({ success: true, data: commissions });
    } catch (error: any) {
      logger.error('Error fetching pending commissions:', error);
      next(error);
    }
  }
);

/**
 * POST /api/superadmin/partner-settlements/approve-commissions
 * Approve selected commission transactions
 */
superAdminPartnerRouter.post(
  '/approve-commissions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { commissionIds } = req.body;
      const approvedBy = (req as any).user?.id;

      if (!Array.isArray(commissionIds) || commissionIds.length === 0) {
        return res.status(400).json({ success: false, error: 'Commission IDs array is required' });
      }

      const result = await PartnerCommissionService.approveCommissions(commissionIds, approvedBy);
      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Error approving commissions:', error);
      next(error);
    }
  }
);

/**
 * GET /api/superadmin/partner-settlements/pending-payouts
 * Get all pending/processing payouts
 */
superAdminPartnerRouter.get(
  '/pending-payouts',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const payouts = await PartnerCommissionService.getAllPendingPayouts({ limit, offset });
      res.json({ success: true, data: payouts });
    } catch (error: any) {
      logger.error('Error fetching pending payouts:', error);
      next(error);
    }
  }
);

/**
 * POST /api/superadmin/partner-settlements/process-payout/:payoutId
 * Mark a payout as processing
 */
superAdminPartnerRouter.post(
  '/process-payout/:payoutId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { payoutId } = req.params;
      const processedBy = (req as any).user?.id;
      const { payoutReference, externalPayoutId } = req.body;

      const success = await PartnerCommissionService.processPayout(payoutId, processedBy, {
        payoutReference,
        externalPayoutId,
      });

      if (!success) {
        return res.status(400).json({ success: false, error: 'Could not process payout' });
      }

      res.json({ success: true, message: 'Payout marked as processing' });
    } catch (error: any) {
      logger.error('Error processing payout:', error);
      next(error);
    }
  }
);

/**
 * POST /api/superadmin/partner-settlements/complete-payout/:payoutId
 * Mark a payout as completed
 */
superAdminPartnerRouter.post(
  '/complete-payout/:payoutId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { payoutId } = req.params;
      const { payoutReference } = req.body;

      const success = await PartnerCommissionService.completePayout(payoutId, { payoutReference });

      if (!success) {
        return res.status(400).json({ success: false, error: 'Could not complete payout' });
      }

      res.json({ success: true, message: 'Payout completed successfully' });
    } catch (error: any) {
      logger.error('Error completing payout:', error);
      next(error);
    }
  }
);

/**
 * POST /api/superadmin/partner-settlements/fail-payout/:payoutId
 * Mark a payout as failed
 */
superAdminPartnerRouter.post(
  '/fail-payout/:payoutId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { payoutId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ success: false, error: 'Failure reason is required' });
      }

      const success = await PartnerCommissionService.failPayout(payoutId, reason);

      if (!success) {
        return res.status(400).json({ success: false, error: 'Could not fail payout' });
      }

      res.json({ success: true, message: 'Payout marked as failed' });
    } catch (error: any) {
      logger.error('Error failing payout:', error);
      next(error);
    }
  }
);

/**
 * GET /api/superadmin/partner-settlements/attributions
 * Get all partner-organization attributions
 */
superAdminPartnerRouter.get(
  '/attributions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      return featureUnavailable(
        res,
        'Partner attributions listing unavailable (no real implementation)'
      );
    } catch (error: any) {
      logger.error('Error fetching attributions:', error);
      next(error);
    }
  }
);

/**
 * DELETE /api/superadmin/partner-settlements/attributions/:attributionId
 * Remove an attribution
 */
superAdminPartnerRouter.delete(
  '/attributions/:attributionId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      return featureUnavailable(
        res,
        'Partner attribution removal unavailable (no real implementation)'
      );
    } catch (error: any) {
      logger.error('Error removing attribution:', error);
      next(error);
    }
  }
);

/**
 * GET /api/superadmin/partner-settlements/expiring-attributions
 * Get attributions/discounts that are expiring soon
 * GAP-PARTNER-004: Expiring attributions view
 */
superAdminPartnerRouter.get(
  '/expiring-attributions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      // Query expiring attributions and their associated discounts
      const expiringAttributions = await PartnerReferralService.getExpiringAttributions(
        days,
        limit,
        offset
      );

      res.json({ success: true, data: expiringAttributions });
    } catch (error: any) {
      logger.error('Error fetching expiring attributions:', error);
      next(error);
    }
  }
);

/**
 * GET /api/superadmin/partner-settlements/code-analytics
 * Get analytics per referral code
 * GAP-PARTNER-003: Code analytics
 */
superAdminPartnerRouter.get(
  '/code-analytics',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const days = parseInt(req.query.days as string) || 90;
      const limit = parseInt(req.query.limit as string) || 20;

      const analytics = await PartnerReferralService.getCodeAnalytics(days, limit);

      res.json({ success: true, data: analytics });
    } catch (error: any) {
      logger.error('Error fetching code analytics:', error);
      next(error);
    }
  }
);

// =============================================================================
// SUPERADMIN PARTNER CONFIG ROUTES
// =============================================================================

import * as PartnerConfigService from '../services/partnerConfigService.js';

export const partnerConfigRouter = Router();

/**
 * GET /api/superadmin/partner-config/commission-rates
 * Get commission rates per tier
 */
partnerConfigRouter.get(
  '/commission-rates',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rates = await PartnerConfigService.getCommissionRates();
      res.json({ success: true, data: rates });
    } catch (error: any) {
      logger.error('Error fetching commission rates:', error);
      next(error);
    }
  }
);

/**
 * PUT /api/superadmin/partner-config/commission-rates
 * Update commission rate for a tier
 */
partnerConfigRouter.put(
  '/commission-rates',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tier, rate } = req.body;

      if (!tier || rate === undefined) {
        return res.status(400).json({ success: false, error: 'Tier and rate are required' });
      }

      await PartnerConfigService.updateCommissionRate(tier, rate);
      res.json({ success: true, message: 'Commission rate updated' });
    } catch (error: any) {
      logger.error('Error updating commission rate:', error);
      next(error);
    }
  }
);

/**
 * GET /api/superadmin/partner-config/discount
 * Get discount configuration
 */
partnerConfigRouter.get('/discount', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await PartnerConfigService.getDiscountConfig();
    res.json({ success: true, data: config });
  } catch (error: any) {
    logger.error('Error fetching discount config:', error);
    next(error);
  }
});

/**
 * PUT /api/superadmin/partner-config/discount
 * Update discount configuration
 */
partnerConfigRouter.put('/discount', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = req.body;
    await PartnerConfigService.updateDiscountConfig(config);
    res.json({ success: true, message: 'Discount configuration updated' });
  } catch (error: any) {
    logger.error('Error updating discount config:', error);
    next(error);
  }
});

/**
 * GET /api/superadmin/partner-config/payout-settings
 * Get payout settings
 */
partnerConfigRouter.get(
  '/payout-settings',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await PartnerConfigService.getPayoutSettings();
      res.json({ success: true, data: settings });
    } catch (error: any) {
      logger.error('Error fetching payout settings:', error);
      next(error);
    }
  }
);

/**
 * PUT /api/superadmin/partner-config/payout-settings
 * Update payout settings
 */
partnerConfigRouter.put(
  '/payout-settings',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = req.body;
      await PartnerConfigService.updatePayoutSettings(settings);
      res.json({ success: true, message: 'Payout settings updated' });
    } catch (error: any) {
      logger.error('Error updating payout settings:', error);
      next(error);
    }
  }
);

export default router;
