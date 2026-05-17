import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeTestApp } from '../_helpers/testApp';
import { all as dbAll, get as dbGet, run as dbRun } from '../../../server/src/utils/DbPromise.js';

let currentUserId = 'delegated-billing-admin';
let assignedCapabilities = ['billing:read'];
let assignedRoleId = 'billing_admin';
let assignedRoleName = 'Billing Admin';

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: currentUserId, organizationId: 'org-1', role: 'MEMBER' };
    req.userId = currentUserId;
    req.organizationId = 'org-1';
    next();
  },
}));

vi.mock('../../../server/src/services/adminAuditService.js', () => ({
  default: {
    logAction: vi.fn(),
    getLogs: vi.fn(),
  },
}));

vi.mock('../../../server/src/services/accessPolicyService.js', () => ({
  default: {
    buildPolicySnapshot: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
}));

describe('P32 admin overview partial capabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUserId = 'delegated-billing-admin';
    assignedCapabilities = ['billing:read'];
    assignedRoleId = 'billing_admin';
    assignedRoleName = 'Billing Admin';
    vi.mocked(dbRun).mockResolvedValue({ changes: 1 });
    vi.mocked(dbAll).mockImplementation(async (sql: string) => {
      if (sql.includes('FROM admin_role_assignments')) {
        return [
          {
            id: 'assignment-1',
            user_id: currentUserId,
            role_id: assignedRoleId,
            role_name: assignedRoleName,
            capabilities_json: JSON.stringify(assignedCapabilities),
            expires_at: null,
          },
        ];
      }
      return [];
    });
    vi.mocked(dbGet).mockImplementation(async (sql: string) => {
      if (sql.includes('FROM organization_members')) return { role: 'MEMBER' };
      if (sql.includes('mfa_required')) {
        return { mfa_required: 1, mfa_grace_period_days: 7 };
      }
      if (sql.includes('FROM organization_billing')) {
        return {
          status: 'active',
          subscription_plan_id: 'pro',
          plan_name: 'Professional',
          price_monthly: 99,
          token_limit: 10000,
          storage_limit_gb: 50,
        };
      }
      if (sql.includes('FROM organizations')) {
        return { plan: 'Professional', token_balance: 1200, trial_tokens_used: 300 };
      }
      if (sql.includes('FROM billing_alerts')) return {};
      return null;
    });
  });

  it('returns available overview sections with per-section capability errors', async () => {
    const router = (await import('../../../server/src/routes/adminP32.routes.js')).default;
    const app = makeTestApp({ mountPath: '/api/admin', router });

    const res = await request(app).get('/api/admin/overview').expect(200);

    expect(res.body.organizationId).toBe('org-1');
    expect(res.body.sectionErrors).toEqual(
      expect.objectContaining({
        people: 'People overview requires people:read capability.',
        security: 'Security overview requires security:read capability.',
        audit: 'Audit overview requires audit:read capability.',
      })
    );
    expect(res.body.sectionErrors).not.toHaveProperty('billing');
    expect(res.body.overview.totalMembers).toBeNull();
    expect(res.body.overview.securityPolicy).toBeNull();
    expect(res.body.overview.audit).toBeNull();
    expect(res.body.overview.billing.plan.name).toBe('Professional');
    expect(res.body.overview.billing.usage.tokenBalance).toBe(1200);
  });

  it('treats same-scope write capability as sufficient for read-only security views', async () => {
    currentUserId = 'delegated-security-admin';
    assignedCapabilities = ['security:write', 'audit:read'];
    assignedRoleId = 'security_admin';
    assignedRoleName = 'Security Admin';

    const router = (await import('../../../server/src/routes/adminP32.routes.js')).default;
    const app = makeTestApp({ mountPath: '/api/admin', router });

    const securityRes = await request(app).get('/api/admin/security').expect(200);
    expect(securityRes.body.policy.mfaRequired).toBe(true);

    const overviewRes = await request(app).get('/api/admin/overview').expect(200);
    expect(overviewRes.body.sectionErrors).not.toHaveProperty('security');
    expect(overviewRes.body.overview.securityPolicy.mfaRequired).toBe(true);
  });
});
