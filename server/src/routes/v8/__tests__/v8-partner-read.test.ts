import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';

const mockGetReferralAnalytics = vi.fn();
const mockGetEarningsSummary = vi.fn();
const mockGetActivePartnerOrgIdForUser = vi.fn();
const mockIsV8Enabled = vi.fn();
const mockIsV8ShadowMode = vi.fn();

vi.mock('../../../services/partnerOrgResolution.js', () => ({
  getActivePartnerOrgIdForUser: (...args: unknown[]) => mockGetActivePartnerOrgIdForUser(...args),
}));

vi.mock('../../../services/partnerReferralService.js', () => ({
  default: {
    getReferralAnalytics: (...args: unknown[]) => mockGetReferralAnalytics(...args),
  },
}));

vi.mock('../../../services/partnerCommissionService.js', () => ({
  default: {
    getEarningsSummary: (...args: unknown[]) => mockGetEarningsSummary(...args),
  },
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

  it('GET /api/v8/partner/earnings-summary returns earnings with partner meta', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v8/partner/earnings-summary');
    expect(res.status).toBe(200);
    expect(mockGetEarningsSummary).toHaveBeenCalledWith('partner-org-resolved');
    expect(res.body.data.earnings.totalEarned).toBe(100);
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
});
