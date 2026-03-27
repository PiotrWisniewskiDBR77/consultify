/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';

const mockGetReferralAnalytics = vi.fn();
const mockGetPartnerAttributions = vi.fn();
const mockGetEarningsSummary = vi.fn();
const mockGetCommissions = vi.fn();
const mockGetPayouts = vi.fn();
const mockRequestPayout = vi.fn();
const mockCreateCampaignLink = vi.fn();
const mockDeleteCampaignLink = vi.fn();
const mockDbRun = vi.fn();
const mockDbTransaction = vi.fn();
const mockGetActivePartnerOrgIdForUser = vi.fn();
const mockIsV8Enabled = vi.fn();
const mockIsV8ShadowMode = vi.fn();

vi.mock('../../../services/partnerOrgResolution.js', () => ({
  getActivePartnerOrgIdForUser: (...args: unknown[]) => mockGetActivePartnerOrgIdForUser(...args),
}));

vi.mock('../../../services/partnerReferralService.js', () => ({
  default: {
    getReferralAnalytics: (...args: unknown[]) => mockGetReferralAnalytics(...args),
    getPartnerAttributions: (...args: unknown[]) => mockGetPartnerAttributions(...args),
    createCampaignLink: (...args: unknown[]) => mockCreateCampaignLink(...args),
    deleteCampaignLink: (...args: unknown[]) => mockDeleteCampaignLink(...args),
  },
}));

vi.mock('../../../services/partnerCommissionService.js', () => ({
  default: {
    getEarningsSummary: (...args: unknown[]) => mockGetEarningsSummary(...args),
    getCommissions: (...args: unknown[]) => mockGetCommissions(...args),
    getPayouts: (...args: unknown[]) => mockGetPayouts(...args),
    requestPayout: (...args: unknown[]) => mockRequestPayout(...args),
  },
}));

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ mocked: true }),
}));

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  transaction: (...args: unknown[]) => mockDbTransaction(...args),
}));

vi.mock('../../../services/v8/featureFlagService.js', () => ({
  isV8Enabled: (...args: unknown[]) => mockIsV8Enabled(...args),
  isV8ShadowMode: (...args: unknown[]) => mockIsV8ShadowMode(...args),
}));

vi.mock('../../../middleware/v8Metrics.middleware.js', () => ({
  v8MetricsMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

let mockUser: any = null;

vi.mock('../../../middleware/auth.middleware.js', () => ({
  default: (req: any, _res: any, next: () => void) => {
    if (!mockUser) {
      _res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    req.can = () => true;
    next();
  },
  verifyToken: (req: any, _res: any, next: () => void) => {
    if (!mockUser) {
      _res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    req.can = () => true;
    next();
  },
  requireSuperAdmin: (req: any, res: any, next: () => void) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!req.user.isSuperAdmin) {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }
    next();
  },
  requireRole: () => (_req: any, _res: any, next: () => void) => next(),
  requireOrganization: (_req: any, _res: any, next: () => void) => next(),
  isAuthenticated: (_req: any, _res: any, next: () => void) => next(),
}));

import v8Router from '../index.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8', v8Router);
  return app;
}

describe('V8 partner read bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      id: 'user-partner-1',
      email: 'partner@example.com',
      name: 'Partner User',
      role: 'ADMIN',
      organizationId: 'tenant-org-v8',
      isSuperAdmin: false,
    };
    mockIsV8Enabled.mockResolvedValue(true);
    mockIsV8ShadowMode.mockResolvedValue(false);
    mockGetActivePartnerOrgIdForUser.mockResolvedValue('partner-org-resolved');
    mockGetReferralAnalytics.mockResolvedValue({
      totalClicks: 3,
      uniqueClicks: 2,
      signups: 1,
      trials: 0,
      paidCustomers: 1,
      conversionRate: 33.33,
      clicksByDay: [],
      clicksBySource: [],
    });
    mockGetPartnerAttributions.mockResolvedValue([
      {
        id: 'attr-1',
        organizationId: 'org-1',
        organizationName: 'ACME GmbH',
        attributionType: 'REFERRAL_LINK',
        totalCommissionEarned: 120,
        status: 'ACTIVE',
        attributedAt: '2026-03-10',
      },
    ]);
    mockGetEarningsSummary.mockResolvedValue({
      totalEarned: 100,
      totalPending: 10,
      totalApproved: 20,
      totalPaid: 70,
      thisMonth: 5,
      thisMonthCount: 1,
      lastMonth: 4,
      readyForPayout: 20,
      currency: 'EUR',
    });
    mockRequestPayout.mockResolvedValue({
      id: 'payout-1',
      status: 'requested',
      grossAmount: 150,
      netAmount: 148.5,
      currency: 'EUR',
    });
    mockGetCommissions.mockResolvedValue([
      {
        id: 'tx-1',
        organizationName: 'ACME GmbH',
        transactionType: 'RECURRING',
        transactionDate: '2026-03-31',
        grossAmount: 1000,
        commissionRate: 15,
        commissionAmount: 150,
        currency: 'EUR',
        status: 'APPROVED',
      },
    ]);
    mockGetPayouts.mockResolvedValue([
      {
        id: 'payout-1',
        status: 'COMPLETED',
        netAmount: 148.5,
        transactionCount: 3,
        periodStart: '2026-03-01',
        periodEnd: '2026-03-31',
        completedAt: '2026-04-15',
      },
    ]);
    mockCreateCampaignLink.mockResolvedValue({
      id: 'campaign-1',
      name: 'Spring launch',
      slug: 'spring-launch',
      fullUrl: 'https://example.com/?c=spring-launch',
    });
    mockDeleteCampaignLink.mockResolvedValue(true);
    mockDbRun.mockResolvedValue({ changes: 1 });
    mockDbTransaction.mockResolvedValue({ success: true });
  });

  it('GET /api/v8/partner/referral-analytics resolves partnerOrgId from user and calls service', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/partner/referral-analytics?days=14');
    expect(res.status).toBe(200);
    expect(mockGetActivePartnerOrgIdForUser).toHaveBeenCalledWith('user-partner-1');
    expect(mockGetReferralAnalytics).toHaveBeenCalledWith('partner-org-resolved', 14);
    expect(res.body.data.analytics.totalClicks).toBe(3);
    expect(res.body.data.days).toBe(14);
    expect(res.body.meta.contract).toBe('partner_runtime_read_v1');
    expect(res.body.meta.partnerOrgId).toBe('partner-org-resolved');
    expect(res.body.meta.v8TenantOrganizationId).toBe('tenant-org-v8');
  });

  it('GET /api/v8/partner/referral-analytics clamps days to 1..365', async () => {
    const app = createApp();
    const hi = await request(app).get('/api/v8/partner/referral-analytics?days=999');
    expect(hi.status).toBe(200);
    expect(mockGetReferralAnalytics).toHaveBeenCalledWith('partner-org-resolved', 365);
    const lo = await request(app).get('/api/v8/partner/referral-analytics?days=0');
    expect(lo.status).toBe(200);
    expect(mockGetReferralAnalytics).toHaveBeenCalledWith('partner-org-resolved', 1);
  });

  it('GET /api/v8/partner/attributions returns customer attributions with partner meta', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/partner/attributions?status=ACTIVE&limit=10&offset=5');

    expect(res.status).toBe(200);
    expect(mockGetPartnerAttributions).toHaveBeenCalledWith('partner-org-resolved', {
      status: 'ACTIVE',
      limit: 10,
      offset: 5,
    });
    expect(res.body.data.attributions[0].id).toBe('attr-1');
    expect(res.body.meta.partnerOrgId).toBe('partner-org-resolved');
  });

  it('GET /api/v8/partner/earnings-summary returns earnings with partner meta', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/partner/earnings-summary');
    expect(res.status).toBe(200);
    expect(mockGetEarningsSummary).toHaveBeenCalledWith('partner-org-resolved');
    expect(res.body.data.earnings.totalEarned).toBe(100);
    expect(res.body.meta.partnerOrgId).toBe('partner-org-resolved');
  });

  it('GET /api/v8/partner/commission-transactions returns transactions with partner meta', async () => {
    const app = createApp();
    const res = await request(app).get(
      '/api/v8/partner/commission-transactions?status=APPROVED&limit=10&offset=5'
    );

    expect(res.status).toBe(200);
    expect(mockGetCommissions).toHaveBeenCalledWith('partner-org-resolved', {
      status: 'APPROVED',
      startDate: undefined,
      endDate: undefined,
      limit: 10,
      offset: 5,
    });
    expect(res.body.data.transactions[0].id).toBe('tx-1');
    expect(res.body.meta.partnerOrgId).toBe('partner-org-resolved');
  });

  it('GET /api/v8/partner/payouts returns payout history with partner meta', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/partner/payouts?status=COMPLETED&limit=10&offset=5');

    expect(res.status).toBe(200);
    expect(mockGetPayouts).toHaveBeenCalledWith('partner-org-resolved', {
      status: 'COMPLETED',
      limit: 10,
      offset: 5,
    });
    expect(res.body.data.payouts[0].id).toBe('payout-1');
    expect(res.body.meta.partnerOrgId).toBe('partner-org-resolved');
  });

  it('returns 403 PARTNER_ORG_REQUIRED when user has no partner row', async () => {
    mockGetActivePartnerOrgIdForUser.mockResolvedValue(null);
    const app = createApp();
    const res = await request(app).get('/api/v8/partner/earnings-summary');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PARTNER_ORG_REQUIRED');
    expect(mockGetEarningsSummary).not.toHaveBeenCalled();
  });

  it('POST /api/v8/partner/payouts/request delegates to requestPayout with partnerOrgId', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/partner/payouts/request').send({
      notes: 'Please process this cycle',
    });

    expect(res.status).toBe(201);
    expect(mockRequestPayout).toHaveBeenCalledWith({
      partnerOrgId: 'partner-org-resolved',
      payoutAccountId: undefined,
      requestedBy: 'user-partner-1',
      notes: 'Please process this cycle',
    });
    expect(res.body.data.payout.id).toBe('payout-1');
    expect(res.body.meta.contract).toBe('partner_runtime_read_v1');
  });

  it('POST /api/v8/partner/campaign-links delegates to createCampaignLink with partnerOrgId', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/partner/campaign-links').send({
      name: 'Spring launch',
      utmSource: 'newsletter',
      utmMedium: 'email',
      utmCampaign: 'spring-launch',
    });

    expect(res.status).toBe(201);
    expect(mockCreateCampaignLink).toHaveBeenCalledWith({
      partnerOrgId: 'partner-org-resolved',
      name: 'Spring launch',
      description: undefined,
      utmSource: 'newsletter',
      utmMedium: 'email',
      utmCampaign: 'spring-launch',
      utmContent: undefined,
      destinationUrl: undefined,
    });
    expect(res.body.data.campaignLink.id).toBe('campaign-1');
    expect(res.body.meta.contract).toBe('partner_runtime_read_v1');
  });

  it('DELETE /api/v8/partner/campaign-links/:linkId delegates to deleteCampaignLink with partnerOrgId', async () => {
    const app = createApp();
    const res = await request(app).delete('/api/v8/partner/campaign-links/campaign-1');

    expect(res.status).toBe(200);
    expect(mockDeleteCampaignLink).toHaveBeenCalledWith('partner-org-resolved', 'campaign-1');
    expect(res.body.data).toEqual({ success: true, deleted: 'campaign-1' });
    expect(res.body.meta.contract).toBe('partner_runtime_read_v1');
  });

  it('PUT /api/v8/partner/organization updates company info with partnerOrgId', async () => {
    const app = createApp();
    const res = await request(app).put('/api/v8/partner/organization').send({
      name: 'Test Partner Co',
      taxId: 'DE123456789',
      contactEmail: 'partner@example.com',
      contactPhone: '+49 30 12345',
      website: 'https://test.example.com',
    });

    expect(res.status).toBe(200);
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.anything(),
      `UPDATE partner_organizations
       SET name = ?, tax_id = ?, contact_email = ?, contact_phone = ?, website = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        'Test Partner Co',
        'DE123456789',
        'partner@example.com',
        '+49 30 12345',
        'https://test.example.com',
        'partner-org-resolved',
      ],
    );
    expect(res.body.data).toEqual({
      success: true,
      message: 'Organization updated successfully',
    });
    expect(res.body.meta.contract).toBe('partner_runtime_read_v1');
  });

  it('PUT /api/v8/partner/organization/specializations updates specializations with partnerOrgId', async () => {
    const app = createApp();
    const res = await request(app).put('/api/v8/partner/organization/specializations').send({
      specializations: ['DRD', 'SIRI', 'DRD'],
    });

    expect(res.status).toBe(200);
    expect(mockDbTransaction).toHaveBeenCalledWith([
      {
        sql: `DELETE FROM partner_specializations WHERE partner_org_id = ?`,
        params: ['partner-org-resolved'],
      },
      {
        sql: `INSERT INTO partner_specializations (id, partner_org_id, framework, certified, created_at)
              VALUES (?, ?, ?, FALSE, NOW())
              ON CONFLICT (partner_org_id, framework) DO NOTHING`,
        params: [expect.any(String), 'partner-org-resolved', 'DRD'],
      },
      {
        sql: `INSERT INTO partner_specializations (id, partner_org_id, framework, certified, created_at)
              VALUES (?, ?, ?, FALSE, NOW())
              ON CONFLICT (partner_org_id, framework) DO NOTHING`,
        params: [expect.any(String), 'partner-org-resolved', 'SIRI'],
      },
    ]);
    expect(res.body.data).toEqual({
      success: true,
      message: 'Specializations updated successfully',
    });
    expect(res.body.meta.contract).toBe('partner_runtime_read_v1');
  });

  it('PUT /api/v8/partner/organization/regions updates regions with partnerOrgId', async () => {
    const app = createApp();
    const res = await request(app).put('/api/v8/partner/organization/regions').send({
      regions: ['DACH', 'CEE', 'DACH'],
    });

    expect(res.status).toBe(200);
    expect(mockDbTransaction).toHaveBeenCalledWith([
      {
        sql: `DELETE FROM partner_regions WHERE partner_org_id = ?`,
        params: ['partner-org-resolved'],
      },
      {
        sql: `INSERT INTO partner_regions (id, partner_org_id, region, is_primary, created_at)
              VALUES (?, ?, ?, FALSE, NOW())
              ON CONFLICT (partner_org_id, region) DO NOTHING`,
        params: [expect.any(String), 'partner-org-resolved', 'DACH'],
      },
      {
        sql: `INSERT INTO partner_regions (id, partner_org_id, region, is_primary, created_at)
              VALUES (?, ?, ?, FALSE, NOW())
              ON CONFLICT (partner_org_id, region) DO NOTHING`,
        params: [expect.any(String), 'partner-org-resolved', 'CEE'],
      },
    ]);
    expect(res.body.data).toEqual({
      success: true,
      message: 'Regions updated successfully',
    });
    expect(res.body.meta.contract).toBe('partner_runtime_read_v1');
  });

  it('PUT /api/v8/partner/organization/listing updates listing with partnerOrgId', async () => {
    const app = createApp();
    const res = await request(app).put('/api/v8/partner/organization/listing').send({
      publicListingEnabled: true,
    });

    expect(res.status).toBe(200);
    expect(mockDbRun).toHaveBeenCalledWith(
      expect.anything(),
      `UPDATE partner_organizations
       SET public_listing_enabled = ?, updated_at = NOW()
       WHERE id = ?`,
      [true, 'partner-org-resolved'],
    );
    expect(res.body.data).toEqual({ success: true, publicListingEnabled: true });
    expect(res.body.meta.contract).toBe('partner_runtime_read_v1');
  });
});
