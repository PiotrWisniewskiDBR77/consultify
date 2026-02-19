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

import { NextFunction, Request, Response, Router } from 'express';

import { verifyToken } from '../middleware/auth.middleware.js';
import PartnerCommissionService from '../services/partnerCommissionService.js';
import PartnerReferralService from '../services/partnerReferralService.js';
import logger from '../utils/Logger.js';

const router = Router();

<<<<<<< Updated upstream
=======
function isSchemaMissingError(err: unknown): boolean {
  const msg = String((err as any)?.message || '').toLowerCase();
  return msg.includes('no such table') || msg.includes('does not exist') || msg.includes('relation');
}

const FEATURE_UNAVAILABLE_CODE = 'FEATURE_UNAVAILABLE';
const featureUnavailable = (res: Response, message: string) =>
  res.status(503).json({ success: false, error: message, code: FEATURE_UNAVAILABLE_CODE });

>>>>>>> Stashed changes
// Apply authentication to all routes
router.use(verifyToken);

// =============================================================================
// PARTNER ORGANIZATION ROUTES
// =============================================================================

/**
 * GET /api/partners/organization
 * Get current user's partner organization
 */
router.get('/organization', async (req: Request, res: Response, next: NextFunction) => {
  try {
<<<<<<< Updated upstream
    const userId = (req as any).user?.id;

    // Return demo data for now - will be replaced with DB query
    const organization = {
      id: 'partner-org-001',
      name: 'Acme Consulting GmbH',
      legalName: 'Acme Consulting GmbH',
      taxId: 'DE123456789',
      contactEmail: 'partner@acme-consulting.de',
      contactPhone: '+49 30 12345678',
      website: 'https://acme-consulting.de',
      tier: 'certified',
      status: 'active',
      partnerSince: '2024-01-15',
      licenseDiscountPercent: 20,
      commissionRatePercent: 15,
      performanceScore: 85,
      publicListingEnabled: true,
      specializations: ['DRD', 'SIRI', 'Lean4.0'],
      regions: ['DACH', 'CEE', 'Baltics'],
    };

    res.json({ success: true, data: organization });
=======
    return featureUnavailable(
      res,
      'Partner portal organization endpoint not available (no real implementation)'
    );
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
    const { name, taxId, contactEmail, contactPhone, website } = req.body;

    // TODO: Update in database
    res.json({
      success: true,
      message: 'Organization updated successfully',
      data: req.body,
    });
=======
    return featureUnavailable(
      res,
      'Partner portal organization updates not available (no real implementation)'
    );
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
      const { specializations } = req.body;

      res.json({
        success: true,
        message: 'Specializations updated successfully',
        data: { specializations },
      });
=======
      return featureUnavailable(
        res,
        'Partner portal organization updates not available (no real implementation)'
      );
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
    const { regions } = req.body;

    res.json({
      success: true,
      message: 'Regions updated successfully',
      data: { regions },
    });
=======
    return featureUnavailable(
      res,
      'Partner portal organization updates not available (no real implementation)'
    );
>>>>>>> Stashed changes
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
    return featureUnavailable(
      res,
      'Partner portal listing updates not available (no real implementation)'
    );
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
        referralLink: `${process.env.APP_URL || 'https://app.consultinity.com'}/ref/acme-consulting`,
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
          { name: 'Consultinity Foundations', status: 'completed' },
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
 * Get partner performance metrics
 * GAP-PARTNER-005: Connected to real database
 */
router.get('/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return featureUnavailable(res, 'Partner metrics unavailable (no real implementation)');
  } catch (error: any) {
    logger.error('Error fetching metrics:', error);
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
    return featureUnavailable(res, 'Partner employee creation unavailable (no real implementation)');
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
    return featureUnavailable(res, 'Partner certifications unavailable (no real implementation)');
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
      return featureUnavailable(res, 'Partner certification modules unavailable (no real implementation)');
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
      return featureUnavailable(
        res,
        'Partner certification progress updates unavailable (no real implementation)'
      );
    } catch (error: any) {
      logger.error('Error updating progress:', error);
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
 * Get partner commissions
 */
router.get('/commissions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    return featureUnavailable(res, 'Partner commissions unavailable (no real implementation)');
  } catch (error: any) {
    logger.error('Error fetching commissions:', error);
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
      return featureUnavailable(res, 'Partner invoice downloads unavailable (no real implementation)');
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
    return featureUnavailable(res, 'Partner resources unavailable (no real implementation)');
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
      return featureUnavailable(res, 'Partner resource downloads unavailable (no real implementation)');
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
