/**
 * @vitest-environment node
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetReferralAnalytics = vi.fn();
const mockGetReferralTools = vi.fn();
const mockGetPartnerAttributions = vi.fn();
const mockGetPartnerClients = vi.fn();
const mockGetPartnerProjects = vi.fn();
const mockGetPartnerEmployees = vi.fn();
const mockGetEarningsSummary = vi.fn();
const mockGetPayoutEligibility = vi.fn();
const mockGetCommissions = vi.fn();
const mockGetPayouts = vi.fn();
const mockRequestPayout = vi.fn();
const mockGetPartnerPayoutSettings = vi.fn();
const mockUpdatePartnerPayoutSettings = vi.fn();
const mockGetProgramStatusDetail = vi.fn();
const mockTransitionLifecycle = vi.fn();
const mockAppendLedgerEntry = vi.fn();
const mockCreateCampaignLink = vi.fn();
const mockDeleteCampaignLink = vi.fn();
const mockAcceptDocuments = vi.fn();
const mockDbGet = vi.fn();
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
    getReferralTools: (...args: unknown[]) => mockGetReferralTools(...args),
    getPartnerAttributions: (...args: unknown[]) => mockGetPartnerAttributions(...args),
    getPartnerClients: (...args: unknown[]) => mockGetPartnerClients(...args),
    getPartnerProjects: (...args: unknown[]) => mockGetPartnerProjects(...args),
    getPartnerEmployees: (...args: unknown[]) => mockGetPartnerEmployees(...args),
    createCampaignLink: (...args: unknown[]) => mockCreateCampaignLink(...args),
    deleteCampaignLink: (...args: unknown[]) => mockDeleteCampaignLink(...args),
  },
}));

vi.mock('../../../services/partnerCommissionService.js', () => ({
  default: {
    getEarningsSummary: (...args: unknown[]) => mockGetEarningsSummary(...args),
    getPayoutEligibility: (...args: unknown[]) => mockGetPayoutEligibility(...args),
    getCommissions: (...args: unknown[]) => mockGetCommissions(...args),
    getPayouts: (...args: unknown[]) => mockGetPayouts(...args),
    requestPayout: (...args: unknown[]) => mockRequestPayout(...args),
  },
}));

vi.mock('../../../services/partnerPayoutSettingsService.js', () => ({
  getPartnerPayoutSettings: (...args: unknown[]) => mockGetPartnerPayoutSettings(...args),
  updatePartnerPayoutSettings: (...args: unknown[]) => mockUpdatePartnerPayoutSettings(...args),
  isPartnerPayoutDestinationComplete: (settings: any) =>
    Boolean(settings?.payoutAccount?.accountHolderName && settings?.payoutAccount?.iban),
}));

vi.mock('../../../services/partnerProgramLedgerService.js', () => ({
  default: {
    getProgramStatusDetail: (...args: unknown[]) => mockGetProgramStatusDetail(...args),
    transitionLifecycle: (...args: unknown[]) => mockTransitionLifecycle(...args),
    appendEntry: (...args: unknown[]) => mockAppendLedgerEntry(...args),
    listEntries: vi.fn(),
  },
}));

vi.mock('../../../services/legalService.js', () => ({
  default: {
    acceptDocuments: (...args: unknown[]) => mockAcceptDocuments(...args),
  },
}));

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ mocked: true }),
}));

vi.mock('../../../utils/ensureUserOnboardingStatusTable.js', () => ({
  ensureUserOnboardingStatusTable: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../utils/DbPromise.js', () => ({
  get: (...args: unknown[]) => mockDbGet(...args),
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
    mockGetPartnerClients.mockResolvedValue([
      {
        id: 'org-1',
        organizationId: 'org-1',
        name: 'ACME GmbH',
        organizationName: 'ACME GmbH',
        clientName: 'ACME GmbH',
        status: 'active',
        accessLevel: 'referral link',
        users: 0,
        userCount: 0,
        projects: 0,
        assessmentScore: 0,
        industry: 'Unspecified',
        region: null,
        plan: null,
      },
    ]);
    mockGetPartnerProjects.mockResolvedValue([
      {
        id: 'project-1',
        name: 'Digital Transformation',
        clientId: 'org-1',
        clientName: 'ACME GmbH',
        framework: 'PMBOK',
        progress: 35,
        status: 'active',
        targetEndDate: '2026-06-30',
      },
    ]);
    mockGetPartnerEmployees.mockResolvedValue([
      {
        id: 'user-1',
        employeeName: 'Alice Admin',
        email: 'alice@example.com',
        accessType: 'Admin',
        permissionSet: 'Admin',
        clientCount: null,
        status: 'ACTIVE',
        lastActive: '2026-03-27T10:00:00Z',
      },
    ]);
    mockGetReferralTools.mockResolvedValue({
      referralCode: 'PARTNER-123',
      referralLink: 'https://example.com/r/PARTNER-123',
      referralLinkSlug: 'PARTNER-123',
      qrCodeUrl: null,
      campaignLinks: [],
    });
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
    mockGetPayoutEligibility.mockResolvedValue({
      eligible: false,
      eligibleGross: 20,
      eligibleNet: 19.8,
      minimumThreshold: 100,
      currency: 'EUR',
      reason: 'BELOW_MINIMUM',
    });
    mockRequestPayout.mockResolvedValue({
      id: 'payout-1',
      status: 'requested',
      grossAmount: 150,
      netAmount: 148.5,
      currency: 'EUR',
    });
    mockGetPartnerPayoutSettings.mockResolvedValue({
      minimumThreshold: 100,
      payoutMethod: 'BANK_TRANSFER',
      autoPayoutEnabled: false,
      payoutAccount: {
        accountHolderName: 'Partner Co',
        iban: 'DE123',
        bicSwift: 'COBADEFF',
        bankName: 'Commerzbank',
      },
    });
    mockUpdatePartnerPayoutSettings.mockResolvedValue({
      minimumThreshold: 250,
      payoutMethod: 'PAYPAL',
      autoPayoutEnabled: true,
      payoutAccount: null,
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
    mockAcceptDocuments.mockResolvedValue(undefined);
    mockDbGet.mockResolvedValue({
      terms_accepted: 1,
      privacy_accepted: 1,
      pricing_tier: 'professional',
      payment_setup: 0,
      completed: 0,
    });
    mockDbRun.mockResolvedValue({ changes: 1 });
    mockDbTransaction.mockResolvedValue({ success: true });
    mockGetProgramStatusDetail.mockResolvedValue({
      runtime: {
        lifecycle_phase: 'earn',
        partner_status: 'active',
        onboard_checklist_json: '{"termsAccepted":true}',
      },
      balances: {
        grossEarned: 100,
        paidOut: 70,
        heldAmount: 0,
        availableToPayout: 30,
        currency: 'EUR',
      },
      whatNext: ['Request payout'],
      hold: null,
    });
    mockTransitionLifecycle.mockResolvedValue({ ok: true, from: 'earn', to: 'payout' });
    mockAppendLedgerEntry.mockResolvedValue({ id: 'ledger-1' });
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
    const res = await request(app).get(
      '/api/v8/partner/attributions?status=ACTIVE&limit=10&offset=5'
    );

    expect(res.status).toBe(200);
    expect(mockGetPartnerAttributions).toHaveBeenCalledWith('partner-org-resolved', {
      status: 'ACTIVE',
      limit: 10,
      offset: 5,
    });
    expect(res.body.data.attributions[0].id).toBe('attr-1');
    expect(res.body.meta.partnerOrgId).toBe('partner-org-resolved');
  });

  it('GET /api/v8/partner/clients returns partner client list with partner meta', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/partner/clients?limit=10&offset=5');

    expect(res.status).toBe(200);
    expect(mockGetPartnerClients).toHaveBeenCalledWith('partner-org-resolved', {
      status: undefined,
      limit: 10,
      offset: 5,
    });
    expect(res.body.data.clients[0].id).toBe('org-1');
    expect(res.body.meta.partnerOrgId).toBe('partner-org-resolved');
  });

  it('GET /api/v8/partner/projects returns partner project list with partner meta', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/partner/projects?limit=10&offset=5');

    expect(res.status).toBe(200);
    expect(mockGetPartnerProjects).toHaveBeenCalledWith('partner-org-resolved', {
      limit: 10,
      offset: 5,
    });
    expect(res.body.data.projects[0].id).toBe('project-1');
    expect(res.body.meta.partnerOrgId).toBe('partner-org-resolved');
  });

  it('GET /api/v8/partner/employees returns partner employee list with partner meta', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/partner/employees?limit=10&offset=5');

    expect(res.status).toBe(200);
    expect(mockGetPartnerEmployees).toHaveBeenCalledWith('partner-org-resolved', {
      status: undefined,
      limit: 10,
      offset: 5,
    });
    expect(res.body.data.employees[0].id).toBe('user-1');
    expect(res.body.meta.partnerOrgId).toBe('partner-org-resolved');
  });

  it('GET /api/v8/partner/referral-tools returns tools with partner meta', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/partner/referral-tools');

    expect(res.status).toBe(200);
    expect(mockGetReferralTools).toHaveBeenCalledWith('partner-org-resolved');
    expect(res.body.data.tools.referralCode).toBe('PARTNER-123');
    expect(res.body.meta.partnerOrgId).toBe('partner-org-resolved');
  });

  it('GET /api/v8/partner/referral-tools preserves legacy fallback shape when service returns null', async () => {
    mockGetReferralTools.mockResolvedValueOnce(null);
    const app = createApp();
    const res = await request(app).get('/api/v8/partner/referral-tools');

    expect(res.status).toBe(200);
    expect(String(res.body.data.tools.referralCode || '').length).toBeGreaterThan(0);
    expect(String(res.body.data.tools.referralLink || '').includes('/r/')).toBe(true);
    expect(res.body.data.tools.campaignLinks).toEqual([]);
  });

  it('GET /api/v8/partner/onboarding-status returns onboarding readback with partner meta', async () => {
    mockDbGet.mockResolvedValueOnce({
      terms_accepted: true,
      privacy_accepted: true,
      pricing_tier: 'professional',
      payment_setup: false,
      completed: false,
    });
    const app = createApp();
    const res = await request(app).get('/api/v8/partner/onboarding-status');

    expect(res.status).toBe(200);
    expect(mockDbGet).toHaveBeenCalled();
    expect(res.body.data.status).toEqual({
      termsAccepted: true,
      privacyAccepted: true,
      pricingTier: 'professional',
      paymentSetup: false,
      completed: false,
    });
    expect(res.body.meta.partnerOrgId).toBe('partner-org-resolved');
  });

  it('POST /api/v8/partner/onboarding/accept-terms records legal acceptance with partner meta', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/partner/onboarding/accept-terms').send({
      termsVersion: 'v2.0',
      privacyVersion: 'v3.0',
    });

    expect(res.status).toBe(201);
    expect(mockDbRun).toHaveBeenCalled();
    expect(mockAcceptDocuments).toHaveBeenCalledWith(
      'user-partner-1',
      ['TOS', 'PRIVACY'],
      'USER',
      expect.any(String),
      '',
      'tenant-org-v8'
    );
    expect(res.body.data).toEqual({ success: true, message: 'Terms accepted' });
    expect(res.body.meta.partnerOrgId).toBe('partner-org-resolved');
  });

  it('POST /api/v8/partner/onboarding/select-tier records pricing-tier selection with partner meta', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/partner/onboarding/select-tier').send({
      tier: 'professional',
    });

    expect(res.status).toBe(200);
    expect(mockDbRun).toHaveBeenCalled();
    expect(res.body.data).toEqual({
      success: true,
      tier: 'professional',
      message: 'Pricing tier selected',
    });
    expect(res.body.meta.partnerOrgId).toBe('partner-org-resolved');
  });

  it('POST /api/v8/partner/onboarding/complete records onboarding completion with partner meta', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/partner/onboarding/complete').send({});

    expect(res.status).toBe(200);
    expect(mockDbGet).toHaveBeenCalled();
    expect(mockDbRun).toHaveBeenCalledTimes(2);
    expect(res.body.data).toEqual({ success: true, message: 'Onboarding completed!' });
    expect(res.body.meta.partnerOrgId).toBe('partner-org-resolved');
  });

  it('GET /api/v8/partner/program/status returns governed lifecycle + balances', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/partner/program/status');
    expect(res.status).toBe(200);
    expect(mockGetProgramStatusDetail).toHaveBeenCalledWith('partner-org-resolved', 'partner');
    expect(res.body.data.lifecyclePhase).toBe('earn');
    expect(res.body.data.payoutSettingsComplete).toBe(true);
    expect(res.body.meta.contract).toBe('partner_program_p29_v1');
  });

  it('GET /api/v8/partner/earnings-summary returns governed earnings with partner meta', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/partner/earnings-summary');
    expect(res.status).toBe(200);
    expect(mockGetEarningsSummary).toHaveBeenCalledWith('partner-org-resolved');
    expect(mockGetPayoutEligibility).toHaveBeenCalledWith('partner-org-resolved');
    expect(res.body.data.earnings.totalEarned).toBe(100);
    expect(res.body.data.earnings.readyForPayout).toBe(30);
    expect(res.body.data.earnings.payoutEligibility).toEqual({
      eligible: false,
      eligibleGross: 20,
      eligibleNet: 19.8,
      minimumThreshold: 100,
      currency: 'EUR',
      reason: 'BELOW_MINIMUM',
    });
    expect(res.body.meta.contract).toBe('partner_program_p29_v1');
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
    const res = await request(app).get(
      '/api/v8/partner/payouts?status=COMPLETED&limit=10&offset=5'
    );

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

  it('POST /api/v8/partner/payouts/request transitions lifecycle and delegates one atomic payout request', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v8/partner/payouts/request').send({
      notes: 'Please process this cycle',
    });

    expect(res.status).toBe(201);
    expect(mockTransitionLifecycle).toHaveBeenCalledWith({
      partnerOrgId: 'partner-org-resolved',
      toPhase: 'payout',
      actor: 'partner',
      actorId: 'user-partner-1',
      reason: 'Please process this cycle',
    });
    expect(mockRequestPayout).toHaveBeenCalledWith({
      partnerOrgId: 'partner-org-resolved',
      payoutAccountId: undefined,
      requestedBy: 'user-partner-1',
      notes: 'Please process this cycle',
    });
    // requestPayout owns the payout + governed ledger transaction. The route
    // must not append a second, non-atomic payout.requested entry.
    expect(mockAppendLedgerEntry).not.toHaveBeenCalled();
    expect(res.body.data.payout.id).toBe('payout-1');
    expect(res.body.meta.contract).toBe('partner_program_p29_v1');
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

  it('PUT /api/v8/partner/organization updates only program-owned profile fields', async () => {
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
       SET contact_phone = ?, website = ?, updated_at = NOW()
       WHERE id = ?`,
      ['+49 30 12345', 'https://test.example.com', 'partner-org-resolved']
    );
    expect(res.body.data).toEqual({
      success: true,
      message: 'Partner-program profile updated successfully',
      ignoredFields: ['name', 'taxId', 'contactEmail'],
    });
    expect(res.body.meta.contract).toBe('partner_runtime_read_v1');
  });

  it('PUT /api/v8/partner/organization/specializations updates specializations with partnerOrgId', async () => {
    const app = createApp();
    const res = await request(app)
      .put('/api/v8/partner/organization/specializations')
      .send({
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
    const res = await request(app)
      .put('/api/v8/partner/organization/regions')
      .send({
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
      [true, 'partner-org-resolved']
    );
    expect(res.body.data).toEqual({ success: true, publicListingEnabled: true });
    expect(res.body.meta.contract).toBe('partner_runtime_read_v1');
  });

  it('GET /api/v8/partner/payout-settings resolves partnerOrgId and returns governed settings', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/partner/payout-settings');

    expect(res.status).toBe(200);
    expect(mockGetPartnerPayoutSettings).toHaveBeenCalledWith('partner-org-resolved');
    expect(res.body.data.settings.minimumThreshold).toBe(100);
    expect(res.body.meta.partnerOrgId).toBe('partner-org-resolved');
  });

  it('PUT /api/v8/partner/payout-settings updates settings with partnerOrgId', async () => {
    const app = createApp();
    const res = await request(app)
      .put('/api/v8/partner/payout-settings')
      .send({
        minimumThreshold: 250,
        payoutMethod: 'PAYPAL',
        autoPayoutEnabled: true,
        payoutAccount: {
          accountHolderName: 'Partner Co',
          iban: 'DE123',
          bicSwift: 'COBADEFF',
          bankName: 'Commerzbank',
        },
      });

    expect(res.status).toBe(200);
    expect(mockUpdatePartnerPayoutSettings).toHaveBeenCalledWith('partner-org-resolved', {
      minimumThreshold: 250,
      payoutMethod: 'PAYPAL',
      autoPayoutEnabled: true,
      payoutAccount: {
        accountHolderName: 'Partner Co',
        iban: 'DE123',
        bicSwift: 'COBADEFF',
        bankName: 'Commerzbank',
      },
    });
    expect(res.body.data.success).toBe(true);
    expect(res.body.meta.contract).toBe('partner_runtime_read_v1');
  });
});
