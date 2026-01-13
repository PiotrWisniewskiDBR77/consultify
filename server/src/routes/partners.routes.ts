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

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import logger from '../utils/Logger.js';
import PartnerReferralService from '../services/partnerReferralService.js';
import PartnerCommissionService from '../services/partnerCommissionService.js';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// =============================================================================
// PARTNER ORGANIZATION ROUTES
// =============================================================================

/**
 * GET /api/partners/organization
 * Get current user's partner organization
 */
router.get('/organization', async (req: Request, res: Response, next: NextFunction) => {
  try {
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
    const { name, taxId, contactEmail, contactPhone, website } = req.body;

    // TODO: Update in database
    res.json({
      success: true,
      message: 'Organization updated successfully',
      data: req.body,
    });
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
      const { specializations } = req.body;

      res.json({
        success: true,
        message: 'Specializations updated successfully',
        data: { specializations },
      });
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
    const { regions } = req.body;

    res.json({
      success: true,
      message: 'Regions updated successfully',
      data: { regions },
    });
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
    const { publicListingEnabled, listingDescription } = req.body;

    res.json({
      success: true,
      message: 'Listing settings updated successfully',
      data: { publicListingEnabled, listingDescription },
    });
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
    const partnerOrgId = (req as any).user?.partnerOrgId || 'partner-org-001'; // TODO: Get from user context

    const tools = await PartnerReferralService.getReferralTools(partnerOrgId);

    if (!tools) {
      return res.status(404).json({ success: false, error: 'Partner organization not found' });
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

    const analytics = await PartnerReferralService.getReferralAnalytics(partnerOrgId, days);

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

    const attributions = await PartnerReferralService.getPartnerAttributions(partnerOrgId, {
      status: status as any,
      limit,
      offset,
    });

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

    const earnings = await PartnerCommissionService.getEarningsSummary(partnerOrgId);

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

    const commissions = await PartnerCommissionService.getCommissions(partnerOrgId, {
      status: status as any,
      startDate,
      endDate,
      limit,
      offset,
    });

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
    const partnerOrgId = (req as any).user?.partnerOrgId || 'partner-org-001';
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const payouts = await PartnerCommissionService.getPayouts(partnerOrgId, {
      status: status as any,
      limit,
      offset,
    });

    res.json({ success: true, data: payouts });
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
    const partnerOrgId = (req as any).user?.partnerOrgId || 'partner-org-001';
    const { getDatabase } = await import('../database/Database.js');
    const db = getDatabase();
    const { get: dbGet, all: dbAll } = await import('../utils/DbPromise.js');

    // Get partner organization info
    const partnerOrg = await dbGet<{
      tier: string;
      status: string;
      commission_rate: number;
    }>(db, `SELECT tier, status, commission_rate FROM partner_organizations WHERE id = ?`, [
      partnerOrgId,
    ]);

    // Get active attributions count (clients referred)
    const clientStats = await dbGet<{ count: number }>(
      db,
      `SELECT COUNT(*) as count FROM partner_attributions WHERE partner_org_id = ? AND status = 'ACTIVE'`,
      [partnerOrgId]
    );

    // Get monthly revenue from commissions
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

    // Calculate revenue change percentage
    const currentRev = thisMonthRevenue?.total || 0;
    const lastRev = lastMonthRevenue?.total || 1;
    const revenueChange = lastRev > 0 ? Math.round(((currentRev - lastRev) / lastRev) * 100) : 0;

    // Get recent activity (commissions, attributions)
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

    // Build recent activity list
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

    // Sort by most recent
    recentActivity.sort((a, b) => {
      const aTime = parseTimeAgo(a.time);
      const bTime = parseTimeAgo(b.time);
      return aTime - bTime;
    });

    // Get certification progress (mock for now - would need learning tables)
    const certificationProgress = {
      completed: 2,
      total: 4,
      courses: [
        { name: 'Consultinity Foundations', status: 'completed' },
        { name: 'PMO Standards', status: 'completed' },
        { name: 'AI Intelligence Modules', status: 'in-progress', progress: 45 },
        { name: 'Assessment Specialist', status: 'locked' },
      ],
    };

    const dashboard = {
      stats: {
        activeClients: clientStats?.count || 0,
        activeProjects: 0, // Would need projects table connection
        certificationLevel: partnerOrg?.tier || 'registered',
        monthlyRevenue: Math.round(currentRev),
        revenueChange,
        totalLicenses: 0, // Would need licenses table
        activeLicenses: 0,
        availableLicenses: 0,
      },
      recentActivity: recentActivity.slice(0, 5),
      certificationProgress,
    };

    res.json({ success: true, data: dashboard });
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
    const partnerOrgId = (req as any).user?.partnerOrgId || 'partner-org-001';
    const { getDatabase } = await import('../database/Database.js');
    const db = getDatabase();
    const { get: dbGet, all: dbAll } = await import('../utils/DbPromise.js');

    // Get YTD revenue from commissions
    const ytdRevenue = await dbGet<{ total: number }>(
      db,
      `SELECT COALESCE(SUM(gross_amount), 0) as total 
             FROM partner_commission_transactions 
             WHERE partner_org_id = ? 
             AND transaction_date >= date('now', 'start of year')`,
      [partnerOrgId]
    );

    // Get monthly revenue breakdown
    const monthlyRevenue = await dbAll<{ month: number; total: number }>(
      db,
      `SELECT 
                CAST(strftime('%m', transaction_date) AS INTEGER) as month,
                COALESCE(SUM(gross_amount), 0) as total
             FROM partner_commission_transactions 
             WHERE partner_org_id = ? 
             AND transaction_date >= date('now', 'start of year')
             GROUP BY strftime('%m', transaction_date)
             ORDER BY month`,
      [partnerOrgId]
    );

    // Build monthly array (fill missing months with 0)
    const byMonth = new Array(12).fill(0);
    for (const row of monthlyRevenue || []) {
      if (row.month >= 1 && row.month <= 12) {
        byMonth[row.month - 1] = Math.round(row.total);
      }
    }

    // Calculate revenue change YoY
    const lastYearRevenue = await dbGet<{ total: number }>(
      db,
      `SELECT COALESCE(SUM(gross_amount), 0) as total 
             FROM partner_commission_transactions 
             WHERE partner_org_id = ? 
             AND transaction_date >= date('now', '-1 year', 'start of year')
             AND transaction_date < date('now', 'start of year')`,
      [partnerOrgId]
    );

    const currentYTD = ytdRevenue?.total || 0;
    const lastYTD = lastYearRevenue?.total || 1;
    const revenueChange = lastYTD > 0 ? Math.round(((currentYTD - lastYTD) / lastYTD) * 100) : 0;

    // Get client stats
    const totalAttributions = await dbGet<{ count: number }>(
      db,
      `SELECT COUNT(*) as count FROM partner_attributions WHERE partner_org_id = ?`,
      [partnerOrgId]
    );

    const activeAttributions = await dbGet<{ count: number }>(
      db,
      `SELECT COUNT(*) as count FROM partner_attributions WHERE partner_org_id = ? AND status = 'ACTIVE'`,
      [partnerOrgId]
    );

    const newThisQuarter = await dbGet<{ count: number }>(
      db,
      `SELECT COUNT(*) as count FROM partner_attributions 
             WHERE partner_org_id = ? 
             AND attributed_at >= date('now', 'start of month', '-2 months')`,
      [partnerOrgId]
    );

    const churned = await dbGet<{ count: number }>(
      db,
      `SELECT COUNT(*) as count FROM partner_attributions 
             WHERE partner_org_id = ? AND status = 'CHURNED'`,
      [partnerOrgId]
    );

    // Calculate retention rate
    const total = totalAttributions?.count || 1;
    const active = activeAttributions?.count || 0;
    const retention = Math.round((active / total) * 100);

    // Calculate performance score based on various factors
    const avgCommissionRate = await dbGet<{ avg: number }>(
      db,
      `SELECT COALESCE(AVG(commission_rate), 15) as avg 
             FROM partner_commission_transactions 
             WHERE partner_org_id = ?`,
      [partnerOrgId]
    );

    const clickConversion = await dbGet<{ clicks: number; conversions: number }>(
      db,
      `SELECT 
                COUNT(*) as clicks,
                SUM(CASE WHEN converted_at IS NOT NULL THEN 1 ELSE 0 END) as conversions
             FROM partner_referral_clicks
             WHERE partner_org_id = ?`,
      [partnerOrgId]
    );

    const convRate = clickConversion?.clicks
      ? Math.round((clickConversion.conversions / clickConversion.clicks) * 100)
      : 0;

    const performanceScore = Math.min(
      100,
      Math.round(retention * 0.3 + convRate * 0.3 + (avgCommissionRate?.avg || 15) * 2)
    );

    const metrics = {
      revenue: {
        totalYTD: Math.round(currentYTD),
        change: revenueChange,
        byMonth,
      },
      clients: {
        retention,
        newThisQuarter: newThisQuarter?.count || 0,
        churned: churned?.count || 0,
        avgProjectDuration: 4.2, // Would need project tracking
      },
      performance: {
        score: performanceScore,
        breakdown: {
          clientAcquisition: convRate,
          projectDelivery: 85, // Mock - would need project tracking
          customerSatisfaction: 90, // Mock - would need feedback tracking
          certificationProgress: 70, // Mock - would need learning tracking
        },
        ranking:
          performanceScore >= 80 ? 'Top 15%' : performanceScore >= 60 ? 'Top 30%' : 'Growing',
      },
      satisfaction: {
        score: 4.5, // Mock - would need feedback data
        responses: 0,
        trend: 'stable',
      },
    };

    res.json({ success: true, data: metrics });
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
    const { status, search, page = 1, limit = 20 } = req.query;

    const clients = [
      {
        id: 'client-001',
        name: 'Nordic Manufacturing AB',
        industry: 'Manufacturing',
        users: 45,
        projects: 3,
        assessmentScore: 3.8,
        status: 'active',
        onboardedAt: '2024-06-15',
        contractValue: 45000,
      },
      {
        id: 'client-002',
        name: 'Baltic Energy Group',
        industry: 'Energy',
        users: 120,
        projects: 5,
        assessmentScore: 4.2,
        status: 'active',
        onboardedAt: '2024-03-20',
        contractValue: 85000,
      },
      {
        id: 'client-003',
        name: 'TechVentures Sp. z o.o.',
        industry: 'Technology',
        users: 28,
        projects: 2,
        assessmentScore: 3.5,
        status: 'onboarding',
        onboardedAt: '2025-12-01',
        contractValue: 25000,
      },
    ];

    res.json({
      success: true,
      data: clients,
      pagination: { page: Number(page), limit: Number(limit), total: clients.length },
    });
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
    const { name, industry, contactEmail, notes } = req.body;

    const newClient = {
      id: `client-${Date.now()}`,
      name,
      industry,
      contactEmail,
      users: 0,
      projects: 0,
      status: 'onboarding',
      onboardedAt: new Date().toISOString(),
    };

    res.status(201).json({ success: true, data: newClient });
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
    const { clientId } = req.params;

    // Return demo data
    const client = {
      id: clientId,
      name: 'Nordic Manufacturing AB',
      industry: 'Manufacturing',
      users: 45,
      projects: 3,
      assessmentScore: 3.8,
      status: 'active',
      onboardedAt: '2024-06-15',
      contractValue: 45000,
      contacts: [{ name: 'Erik Johansson', role: 'CTO', email: 'erik@nordic-mfg.se' }],
    };

    res.json({ success: true, data: client });
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
    // Return demo data - in production would query from database
    const employees = [
      {
        id: 'emp-001',
        employeeName: 'Maria Schmidt',
        email: 'maria.schmidt@acme-consulting.de',
        accessType: 'FULL_ACCESS',
        permissionSet: 'Senior Consultant',
        clients: ['client-001', 'client-002'],
        clientCount: 2,
        status: 'ACTIVE',
        lastActive: '2026-01-09',
      },
      {
        id: 'emp-002',
        employeeName: 'Thomas Müller',
        email: 'thomas.mueller@acme-consulting.de',
        accessType: 'READ_ONLY',
        permissionSet: 'Junior Consultant',
        clients: ['client-001'],
        clientCount: 1,
        status: 'ACTIVE',
        lastActive: '2026-01-08',
      },
      {
        id: 'emp-003',
        employeeName: 'Anna Weber',
        email: 'anna.weber@acme-consulting.de',
        accessType: 'FULL_ACCESS',
        permissionSet: 'Manager',
        clients: [],
        clientCount: 0,
        status: 'DEACTIVATED',
        lastActive: '2025-12-15',
      },
    ];

    res.json({ success: true, data: employees });
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
    const { name, email, permissionSet } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, error: 'Name and email are required' });
    }

    // In production, create employee in database
    const newEmployee = {
      id: `emp-${Date.now()}`,
      employeeName: name,
      email,
      accessType: 'READ_ONLY',
      permissionSet: permissionSet || 'Consultant',
      clients: [],
      clientCount: 0,
      status: 'ACTIVE',
      lastActive: null,
    };

    res.status(201).json({ success: true, data: newEmployee });
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
    const partnerOrgId = (req as any).user?.partnerOrgId || 'partner-org-001';

    // In production, aggregate from database
    const stats = {
      totalEarnings: 58400,
      thisMonthEarnings: 4350,
      activeClients: 12,
      conversionRate: 23.5,
      tier: 'GOLD',
      tierProgress: 65,
      nextTier: 'PLATINUM',
      nextTierRevenue: 100000,
      currentRevenue: 65000,
    };

    res.json({ success: true, data: stats });
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
    const partnerOrgId = (req as any).user?.partnerOrgId || 'partner-org-001';
    const { type = 'client' } = req.body;

    // Generate unique access link
    const token = require('crypto').randomBytes(16).toString('hex');
    const baseUrl = process.env.APP_URL || 'https://app.consultinity.com';
    const link = `${baseUrl}/onboard/${type}/${token}`;

    // In production, store the access link in database with expiry
    res.json({
      success: true,
      data: {
        link,
        type,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      },
    });
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
    const { status, clientId, page = 1, limit = 20 } = req.query;

    const projects = [
      {
        id: 'proj-001',
        name: 'Digital Transformation Assessment',
        clientId: 'client-001',
        clientName: 'Nordic Manufacturing AB',
        framework: 'DRD',
        progress: 65,
        status: 'active',
        startDate: '2025-09-01',
        targetEndDate: '2026-02-28',
      },
      {
        id: 'proj-002',
        name: 'Industry 4.0 Readiness',
        clientId: 'client-002',
        clientName: 'Baltic Energy Group',
        framework: 'SIRI',
        progress: 40,
        status: 'active',
        startDate: '2025-10-15',
        targetEndDate: '2026-04-30',
      },
      {
        id: 'proj-003',
        name: 'Lean Manufacturing Implementation',
        clientId: 'client-003',
        clientName: 'TechVentures Sp. z o.o.',
        framework: 'Lean4.0',
        progress: 15,
        status: 'planning',
        startDate: '2026-01-15',
        targetEndDate: '2026-06-30',
      },
    ];

    res.json({
      success: true,
      data: projects,
      pagination: { page: Number(page), limit: Number(limit), total: projects.length },
    });
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
    const certifications = [
      {
        id: 'cert-001',
        name: 'Consultinity Foundations',
        type: 'foundation',
        status: 'completed',
        progress: 100,
        duration: '2 hours',
        modules: 5,
        completedAt: '2025-12-15',
        certificateId: 'CF-2025-001',
        certificateUrl: '/certificates/CF-2025-001.pdf',
      },
      {
        id: 'cert-002',
        name: 'PMO Standards (ISO/PMBOK/PRINCE2)',
        type: 'pmo_standards',
        status: 'completed',
        progress: 100,
        duration: '4 hours',
        modules: 8,
        completedAt: '2026-01-05',
        certificateId: 'PMO-2026-001',
        certificateUrl: '/certificates/PMO-2026-001.pdf',
      },
      {
        id: 'cert-003',
        name: 'AI Intelligence Modules',
        type: 'ai_modules',
        status: 'in_progress',
        progress: 45,
        duration: '3 hours',
        modules: 6,
        startedAt: '2026-01-06',
      },
      {
        id: 'cert-004',
        name: 'Assessment Specialist',
        type: 'assessment_specialist',
        status: 'locked',
        progress: 0,
        duration: '6 hours',
        modules: 12,
      },
    ];

    res.json({ success: true, data: certifications });
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
      const { certId } = req.params;

      const modules = [
        {
          id: 'mod-001',
          name: 'Platform Overview',
          status: 'completed',
          progress: 100,
          duration: 30,
        },
        {
          id: 'mod-002',
          name: 'Navigation & UI',
          status: 'completed',
          progress: 100,
          duration: 20,
        },
        { id: 'mod-003', name: 'Project Setup', status: 'in_progress', progress: 60, duration: 25 },
        {
          id: 'mod-004',
          name: 'Assessment Basics',
          status: 'not_started',
          progress: 0,
          duration: 35,
        },
        { id: 'mod-005', name: 'Partner Tools', status: 'not_started', progress: 0, duration: 30 },
      ];

      res.json({ success: true, data: modules });
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
      const { certId, moduleId } = req.params;
      const { progress, status } = req.body;

      res.json({
        success: true,
        message: 'Progress updated',
        data: { certId, moduleId, progress, status },
      });
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
    const licenses = {
      summary: {
        total: 150,
        active: 142,
        available: 8,
        utilizationPercent: 95,
      },
      allocations: [
        {
          clientId: 'client-001',
          clientName: 'Nordic Manufacturing AB',
          quantity: 45,
          type: 'professional',
        },
        {
          clientId: 'client-002',
          clientName: 'Baltic Energy Group',
          quantity: 85,
          type: 'enterprise',
        },
        {
          clientId: 'client-003',
          clientName: 'TechVentures Sp. z o.o.',
          quantity: 12,
          type: 'standard',
        },
      ],
      history: [
        { date: '2026-01-01', action: 'added', quantity: 20, balance: 150 },
        { date: '2025-12-15', action: 'allocated', quantity: 12, balance: 130 },
        { date: '2025-12-01', action: 'added', quantity: 30, balance: 142 },
      ],
    };

    res.json({ success: true, data: licenses });
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
    const { quantity, type } = req.body;

    res.json({
      success: true,
      message: 'License order submitted',
      data: { orderId: `ORD-${Date.now()}`, quantity, type, status: 'pending' },
    });
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
    const { status, period, page = 1, limit = 20 } = req.query;

    const commissions = {
      summary: {
        totalYTD: 18450,
        thisMonth: 2340,
        pending: 1200,
        nextPayout: '2026-01-15',
      },
      transactions: [
        {
          id: 'comm-001',
          client: 'Nordic Manufacturing AB',
          type: 'referral',
          amount: 850,
          status: 'paid',
          date: '2026-01-05',
        },
        {
          id: 'comm-002',
          client: 'Baltic Energy Group',
          type: 'renewal',
          amount: 1200,
          status: 'pending',
          date: '2026-01-08',
        },
        {
          id: 'comm-003',
          client: 'TechVentures Sp. z o.o.',
          type: 'new_license',
          amount: 290,
          status: 'pending',
          date: '2026-01-07',
        },
      ],
    };

    res.json({
      success: true,
      data: commissions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: commissions.transactions.length,
      },
    });
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
    const { status, page = 1, limit = 20 } = req.query;

    const invoices = [
      {
        id: 'INV-2026-003',
        date: '2026-01-01',
        amount: 8500,
        status: 'pending',
        dueDate: '2026-01-31',
      },
      {
        id: 'INV-2025-012',
        date: '2025-12-01',
        amount: 7200,
        status: 'paid',
        paidDate: '2025-12-15',
      },
      {
        id: 'INV-2025-011',
        date: '2025-11-01',
        amount: 6800,
        status: 'paid',
        paidDate: '2025-11-18',
      },
    ];

    res.json({
      success: true,
      data: invoices,
      pagination: { page: Number(page), limit: Number(limit), total: invoices.length },
    });
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
      const { invoiceId } = req.params;

      // In production, this would stream the actual PDF
      res.json({
        success: true,
        data: {
          downloadUrl: `/api/partners/invoices/${invoiceId}/pdf`,
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      });
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
    const { category, search } = req.query;

    const resources = {
      documentation: [
        { id: 'res-001', title: 'Partner Onboarding Guide', type: 'PDF', size: '2.4 MB' },
        { id: 'res-002', title: 'Consultinity Platform Overview', type: 'PDF', size: '5.1 MB' },
        { id: 'res-003', title: 'API Documentation', type: 'Web', size: 'Online' },
        { id: 'res-004', title: 'Integration Guide', type: 'PDF', size: '1.8 MB' },
      ],
      marketing: [
        { id: 'res-005', title: 'Partner Logo Kit', type: 'ZIP', size: '12 MB' },
        { id: 'res-006', title: 'Sales Presentation Template', type: 'PPTX', size: '8.5 MB' },
        { id: 'res-007', title: 'Product One-Pager', type: 'PDF', size: '1.2 MB' },
        { id: 'res-008', title: 'Email Templates', type: 'ZIP', size: '500 KB' },
      ],
      caseStudies: [
        {
          id: 'res-009',
          title: 'Nordic Manufacturing - Digital Transformation',
          type: 'PDF',
          size: '3.2 MB',
        },
        {
          id: 'res-010',
          title: 'Baltic Energy - Industry 4.0 Journey',
          type: 'PDF',
          size: '2.8 MB',
        },
        { id: 'res-011', title: 'TechVentures - Lean Implementation', type: 'PDF', size: '2.1 MB' },
      ],
      templates: [
        { id: 'res-012', title: 'PMO Setup Checklist', type: 'XLSX', size: '450 KB' },
        { id: 'res-013', title: 'Assessment Report Template', type: 'DOCX', size: '1.1 MB' },
        { id: 'res-014', title: 'Roadmap Template', type: 'XLSX', size: '800 KB' },
        { id: 'res-015', title: 'Governance Framework', type: 'PDF', size: '2.5 MB' },
      ],
    };

    res.json({ success: true, data: resources });
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
      const { resourceId } = req.params;

      res.json({
        success: true,
        data: {
          downloadUrl: `/api/partners/resources/${resourceId}/file`,
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      });
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
    const tiers = {
      current: {
        name: 'Certified Partner',
        licenseDiscount: 20,
        supportLevel: 'priority',
        benefits: ['20% license discount', 'Priority support', 'Co-marketing included'],
      },
      next: {
        name: 'Premier Partner',
        licenseDiscount: 30,
        requirements: [
          { name: '10+ active projects', current: 8, target: 10, met: false },
          { name: 'Published case study', current: 1, target: 1, met: true },
          { name: 'All certifications complete', current: 2, target: 4, met: false },
        ],
      },
      all: [
        { name: 'Registered', discount: 0, minRevenue: 0, minProjects: 0 },
        { name: 'Certified', discount: 20, minRevenue: 50000, minProjects: 3 },
        { name: 'Premier', discount: 30, minRevenue: 150000, minProjects: 10 },
        { name: 'Elite', discount: 40, minRevenue: 500000, minProjects: 25 },
      ],
    };

    res.json({ success: true, data: tiers });
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
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string | undefined;

      // In production, this would query the database
      // For now, return demo data
      const attributions = [
        {
          id: 'attr-001',
          partnerOrgId: 'partner-001',
          partnerName: 'Acme Consulting GmbH',
          organizationId: 'org-001',
          organizationName: 'Nordic Manufacturing AB',
          attributionType: 'REFERRAL_LINK',
          referralCodeUsed: 'ACME2026',
          status: 'ACTIVE',
          attributedAt: '2026-01-05',
        },
        {
          id: 'attr-002',
          partnerOrgId: 'partner-002',
          partnerName: 'Digital Partners Ltd',
          organizationId: 'org-002',
          organizationName: 'Baltic Energy Group',
          attributionType: 'PROMO_CODE',
          referralCodeUsed: 'DIGI15',
          status: 'ACTIVE',
          attributedAt: '2026-01-03',
        },
      ];

      res.json({ success: true, data: attributions });
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
      const { attributionId } = req.params;

      // In production, this would update the database
      // await PartnerReferralService.updateAttributionStatus(attributionId, 'EXPIRED');

      res.json({ success: true, message: 'Attribution removed' });
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
