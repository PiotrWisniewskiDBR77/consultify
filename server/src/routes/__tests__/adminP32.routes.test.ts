import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import adminP32Routes from '../adminP32.routes.js';

const dbAll = vi.fn();
const dbGet = vi.fn();
const dbRun = vi.fn();
const logAction = vi.fn();
const getLogs = vi.fn();
const buildPolicySnapshot = vi.fn();
const getEffectivePolicy = vi.fn();
const getPolicySummary = vi.fn();
const getOrgContextPolicy = vi.fn();

let mockUserRole = 'admin';
let mockUserId = 'user-1';
let mockOrganizationId = 'org-1';

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  get: (...args: any[]) => dbGet(...args),
  run: (...args: any[]) => dbRun(...args),
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = {
      id: mockUserId,
      organizationId: mockOrganizationId,
      role: mockUserRole,
      isSuperAdmin: String(mockUserRole).toLowerCase() === 'superadmin',
    };
    req.userRole = mockUserRole;
    next();
  },
}));

vi.mock('../../middleware/admin.middleware.js', () => ({
  default: (req: any, res: any, next: any) => {
    const role = String(req.user?.role || '').toUpperCase();
    if (!['ADMIN', 'OWNER', 'SUPERADMIN'].includes(role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  },
}));

const getCachedResults = vi.fn();
vi.mock('../../services/health/healthProbeService.js', () => ({
  HEALTH_PROBES: [],
  getCachedResults: (...args: any[]) => getCachedResults(...args),
  summarizeResults: () => ({ total: 0 }),
  isHealthPanelAllowedEnv: () => false,
  cacheProbeResult: vi.fn(),
  getProbeById: vi.fn(),
  runAllProbes: vi.fn(),
  runProbe: vi.fn(),
}));

vi.mock('../../services/adminAuditService.js', () => ({
  default: {
    logAction: (...args: any[]) => logAction(...args),
    getLogs: (...args: any[]) => getLogs(...args),
  },
}));

vi.mock('../../services/accessPolicyService.js', () => ({
  default: {
    buildPolicySnapshot: (...args: any[]) => buildPolicySnapshot(...args),
  },
}));

vi.mock('../../services/aiPolicyEngine.js', () => ({
  default: {
    getEffectivePolicy: (...args: any[]) => getEffectivePolicy(...args),
    getPolicySummary: (...args: any[]) => getPolicySummary(...args),
  },
}));

vi.mock('../../services/ai/contextGovernance.js', () => ({
  getOrgContextPolicy: (...args: any[]) => getOrgContextPolicy(...args),
}));

const insertScimGroupMapping = vi.fn();
const scimMappingsHasProjectId = vi.fn();
vi.mock('../../services/scimGroupMappingService.js', () => {
  // Defined inside the factory (hoisted above imports) so the route and the
  // tests share the SAME class the route's `instanceof` check relies on.
  class ScimGroupMappingError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = 'ScimGroupMappingError';
      this.code = code;
    }
  }
  return {
    insertScimGroupMapping: (...args: any[]) => insertScimGroupMapping(...args),
    scimMappingsHasProjectId: (...args: any[]) => scimMappingsHasProjectId(...args),
    ScimGroupMappingError,
  };
});

// Resolves to the mocked module's class (set up above).
import { ScimGroupMappingError } from '../../services/scimGroupMappingService.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminP32Routes);
  return app;
}

describe('adminP32Routes', () => {
  beforeEach(() => {
    mockUserRole = 'admin';
    mockUserId = 'user-1';
    mockOrganizationId = 'org-1';
    dbAll.mockReset();
    dbGet.mockReset();
    dbRun.mockReset();
    logAction.mockReset();
    getLogs.mockReset();
    buildPolicySnapshot.mockReset();
    getEffectivePolicy.mockReset();
    getPolicySummary.mockReset();
    getOrgContextPolicy.mockReset();
    logAction.mockResolvedValue({ success: true });
    dbRun.mockResolvedValue({ success: true, changes: 1 });
    buildPolicySnapshot.mockResolvedValue({
      subscriptionStatus: 'active',
      usageToday: { users: 5, projects: 2, storageMb: 50, tokensUsed: 120, aiCalls: 18 },
      limits: {
        maxUsers: 20,
        maxProjects: 10,
        maxStorageMb: 1024,
        maxTotalTokens: 5000,
        maxAICallsPerDay: 200,
      },
      trialExpiresAt: null,
    });
    getEffectivePolicy.mockResolvedValue({ level: 'ASSISTED' });
    getPolicySummary.mockResolvedValue({
      policyLevel: 'ASSISTED',
      modelCount: 4,
      budgetStatus: 'healthy',
    });
    getOrgContextPolicy.mockResolvedValue({
      allowExternalContext: false,
      defaultSensitivity: 'internal',
    });
    insertScimGroupMapping.mockReset();
    scimMappingsHasProjectId.mockReset();
    scimMappingsHasProjectId.mockResolvedValue(true);
  });

  it.each(['ADMIN', 'OWNER'])('allows an ACTIVE %s membership', async (role) => {
    mockUserRole = role.toLowerCase();
    dbGet.mockResolvedValueOnce({ role, status: 'ACTIVE' });
    getLogs.mockResolvedValue([]);

    const res = await request(createApp()).get('/api/admin/audit-logs');

    expect(res.status).toBe(200);
    expect(getLogs).toHaveBeenCalledTimes(1);
  });

  it('denies a revoked membership on the first request with the same token', async () => {
    dbGet.mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' });
    getLogs.mockResolvedValue([]);
    const app = createApp();
    expect((await request(app).get('/api/admin/audit-logs')).status).toBe(200);

    dbGet.mockResolvedValueOnce({ role: 'ADMIN', status: 'REVOKED' });
    const revoked = await request(app).get('/api/admin/audit-logs');

    expect(revoked.status).toBe(403);
    expect(revoked.body.code).toBe('ADMIN_MEMBERSHIP_REQUIRED');
    expect(getLogs).toHaveBeenCalledTimes(1);
  });

  it('does not let SUPERADMIN bypass a missing membership', async () => {
    mockUserRole = 'superadmin';
    dbGet.mockResolvedValueOnce(null);

    const res = await request(createApp()).get('/api/admin/audit-logs');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ADMIN_MEMBERSHIP_REQUIRED');
    expect(getLogs).not.toHaveBeenCalled();
  });

  it('does not let SUPERADMIN with an ACTIVE MEMBER membership bypass tenant admin authority', async () => {
    mockUserRole = 'superadmin';
    dbGet.mockResolvedValueOnce({ role: 'MEMBER', status: 'ACTIVE' }).mockResolvedValueOnce(null);

    const res = await request(createApp()).get('/api/admin/audit-logs');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ADMIN_ACCESS_REQUIRED');
    expect(getLogs).not.toHaveBeenCalled();
  });

  it('fails closed with 503 when the authoritative membership lookup fails', async () => {
    dbGet.mockRejectedValueOnce(new Error('database unavailable'));

    const res = await request(createApp()).get('/api/admin/audit-logs');

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('ADMIN_MEMBERSHIP_LOOKUP_FAILED');
    expect(getLogs).not.toHaveBeenCalled();
  });

  it('rejects a foreign query selector and ignores body organization authority', async () => {
    const foreign = await request(createApp()).get('/api/admin/audit-logs?orgId=org-2');
    expect(foreign.status).toBe(403);
    expect(foreign.body.code).toBe('ADMIN_BOUNDARY_VIOLATION');
    expect(dbGet).not.toHaveBeenCalled();

    dbGet.mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' });
    getLogs.mockResolvedValue([]);
    const bodySpoof = await request(createApp())
      .get('/api/admin/audit-logs')
      .send({ organizationId: 'org-2' });
    expect(bodySpoof.status).toBe(200);
    expect(getLogs).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org-1' }));
  });

  it('applies the same authoritative membership gate before the health admin role', async () => {
    const healthRouter = (await import('../admin/health-panel.routes.js')).default;
    const app = express();
    app.use('/api/admin/health-panel', healthRouter);

    dbGet.mockResolvedValueOnce({ role: 'ADMIN', status: 'REVOKED' });
    expect((await request(app).get('/api/admin/health-panel/probes')).status).toBe(403);

    dbGet.mockRejectedValueOnce(new Error('database unavailable'));
    expect((await request(app).get('/api/admin/health-panel/probes')).status).toBe(503);

    dbGet.mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' });
    getCachedResults.mockResolvedValueOnce([]);
    expect((await request(app).get('/api/admin/health-panel/probes')).status).toBe(200);
  });

  it('does not let SUPERADMIN with an ACTIVE MEMBER membership bypass health tenant authority', async () => {
    mockUserRole = 'superadmin';
    const healthRouter = (await import('../admin/health-panel.routes.js')).default;
    const app = express();
    app.use('/api/admin/health-panel', healthRouter);
    dbGet.mockResolvedValueOnce({ role: 'MEMBER', status: 'ACTIVE' });

    const res = await request(app).get('/api/admin/health-panel/probes');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ADMIN_ACCESS_REQUIRED');
    expect(getCachedResults).not.toHaveBeenCalled();
  });

  it('blocks guests from the admin cockpit with explicit guidance', async () => {
    mockUserRole = 'guest';
    dbGet.mockResolvedValueOnce({ role: 'GUEST', status: 'ACTIVE' });

    const app = createApp();
    const res = await request(app).get('/api/admin/security');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ADMIN_ACCESS_REQUIRED');
    expect(res.body.guidance).toContain('Guests cannot access admin tools');
  });

  it('returns canonical security policy from org + organization_settings + sso', async () => {
    dbGet
      .mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' })
      .mockResolvedValueOnce({ mfa_required: 1, mfa_grace_period_days: 5 })
      .mockResolvedValueOnce({
        setting_value: JSON.stringify({
          passwordPolicy: 'strict',
          sessionTimeout: 30,
          ssoEnforced: true,
          allowPasswordLogin: false,
        }),
      })
      .mockResolvedValueOnce({
        provider_name: 'Okta',
        provider_type: 'okta',
        protocol: 'saml',
        is_enabled: 1,
      });

    const app = createApp();
    const res = await request(app).get('/api/admin/security');

    expect(res.status).toBe(200);
    expect(res.body.policy.mfaRequired).toBe(true);
    expect(res.body.policy.passwordPolicy).toBe('strict');
    expect(res.body.policy.sessionTimeoutMinutes).toBe(30);
    expect(res.body.policy.ssoEnabled).toBe(true);
    expect(res.body.policy.ssoProvider).toBe('Okta');
  });

  it('writes collaboration controls to canonical settings keys and audits the change', async () => {
    dbGet.mockResolvedValueOnce({ role: 'OWNER', status: 'ACTIVE' });
    dbAll.mockResolvedValueOnce([
      { key: 'tenant:org-1:guest_access_enabled', value: 'false' },
      { key: 'tenant:org-1:external_link_sharing', value: 'false' },
      { key: 'module:org-1:tools:tool_approval_required', value: 'true' },
    ]);

    const app = createApp();
    const res = await request(app).put('/api/admin/collaboration').send({
      guestAccessEnabled: true,
      externalLinkSharing: true,
      toolApprovalRequired: false,
    });

    expect(res.status).toBe(200);
    expect(dbRun).toHaveBeenCalledTimes(3);
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'update_collaboration_controls',
        details: expect.objectContaining({ orgId: 'org-1' }),
      })
    );
  });

  it('filters audit logs to the active organization only', async () => {
    dbGet.mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' });
    getLogs.mockResolvedValue([
      {
        id: 'log-1',
        admin_id: 'user-1',
        action_type: 'update_security_policy',
        metadata_json: JSON.stringify({ orgId: 'org-1' }),
        risk_score: 60,
        risk_level: 'high',
        status: 'unresolved',
      },
      {
        id: 'log-2',
        admin_id: 'user-2',
        action_type: 'update_security_policy',
        metadata_json: JSON.stringify({ orgId: 'org-2' }),
        risk_score: 60,
        risk_level: 'high',
        status: 'unresolved',
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/admin/audit-logs');

    expect(res.status).toBe(200);
    expect(res.body.logs).toHaveLength(1);
    expect(res.body.logs[0].id).toBe('log-1');
  });

  it('returns enterprise admin overview with billing, ai, and audit posture', async () => {
    dbGet
      .mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' })
      .mockResolvedValueOnce({ total: 1 })
      .mockResolvedValueOnce({
        subscription_plan_id: 'plan-1',
        status: 'active',
        current_period_end: '2026-05-01',
        plan_name: 'Enterprise',
        price_monthly: 999,
        token_limit: 10000,
        storage_limit_gb: 100,
      })
      .mockResolvedValueOnce({
        trial_tokens_used: 140,
        token_balance: 8000,
        plan: 'enterprise',
        trial_expires_at: null,
      })
      .mockResolvedValueOnce({
        token_threshold_80: 1,
        token_threshold_90: 1,
        token_threshold_100: 0,
        cost_cap_monthly: 2500,
        email_notifications: 1,
      })
      .mockResolvedValueOnce({ mfa_required: 1, mfa_grace_period_days: 7 })
      .mockResolvedValueOnce({ setting_value: JSON.stringify({ passwordPolicy: 'strict' }) })
      .mockResolvedValueOnce({
        is_enabled: 1,
        provider_name: 'Okta',
        provider_type: 'okta',
        protocol: 'saml',
      })
      .mockResolvedValueOnce({
        mode: 'approved',
        review_state: 'published',
        audit_required: 1,
        updated_at: 'now',
      });

    dbAll
      .mockResolvedValueOnce([
        { role: 'OWNER', total: 1 },
        { role: 'ADMIN', total: 2 },
        { role: 'MEMBER', total: 5 },
      ])
      .mockResolvedValueOnce([
        { key: 'tenant:org-1:guest_access_enabled', value: 'false' },
        { key: 'tenant:org-1:external_link_sharing', value: 'true' },
        { key: 'module:org-1:tools:tool_approval_required', value: 'true' },
      ]);
    getLogs.mockResolvedValue([
      {
        id: 'log-1',
        action_type: 'update_security_policy',
        metadata_json: JSON.stringify({ orgId: 'org-1' }),
        status: 'unresolved',
        risk_score: 80,
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/admin/overview');

    expect(res.status).toBe(200);
    expect(res.body.overview.totalMembers).toBe(8);
    expect(res.body.overview.billing.plan.name).toBe('Enterprise');
    expect(res.body.overview.ai.governanceSummary.policyLevel).toBe('ASSISTED');
    expect(res.body.overview.audit.highRiskCount).toBe(1);
  });

  it('reads and writes tenant IAM policy from organization settings', async () => {
    dbGet.mockResolvedValueOnce({ role: 'OWNER', status: 'ACTIVE' }).mockResolvedValueOnce({
      setting_value: JSON.stringify({
        delegatedRoles: [
          { id: 'billing_admin', name: 'Billing Admin', capabilities: ['billing:read'] },
        ],
        accessReviewsEnabled: true,
        accessReviewCadenceDays: 60,
        contextAwareAccessEnabled: true,
        privilegedSessionReauthMinutes: 15,
        breakGlassEnabled: false,
        breakGlassApprovers: ['owner@company.com'],
        alertOnPrivilegedChange: true,
      }),
    });

    const app = createApp();
    const getRes = await request(app).get('/api/admin/iam/policy');

    expect(getRes.status).toBe(200);
    expect(getRes.body.policy.accessReviewCadenceDays).toBe(60);

    dbGet.mockResolvedValueOnce({ role: 'OWNER', status: 'ACTIVE' }).mockResolvedValueOnce({
      setting_value: JSON.stringify({
        delegatedRoles: [],
        accessReviewsEnabled: true,
        accessReviewCadenceDays: 90,
        contextAwareAccessEnabled: false,
        privilegedSessionReauthMinutes: 30,
        breakGlassEnabled: false,
        breakGlassApprovers: [],
        alertOnPrivilegedChange: true,
      }),
    });

    const putRes = await request(app).put('/api/admin/iam/policy').send({
      accessReviewCadenceDays: 45,
      contextAwareAccessEnabled: true,
    });

    expect(putRes.status).toBe(200);
    expect(dbRun).toHaveBeenCalled();
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'update_admin_iam_policy',
      })
    );
    expect(putRes.body.policy.contextAwareAccessEnabled).toBe(true);
  });

  it('allows delegated billing admins to access billing summaries', async () => {
    mockUserRole = 'member';
    dbGet
      .mockResolvedValueOnce({ role: 'MEMBER', status: 'ACTIVE' })
      .mockResolvedValueOnce({
        subscription_plan_id: 'plan-1',
        status: 'active',
        current_period_end: '2026-05-01',
        plan_name: 'Enterprise',
        price_monthly: 999,
        token_limit: 10000,
        storage_limit_gb: 100,
      })
      .mockResolvedValueOnce({
        trial_tokens_used: 140,
        token_balance: 8000,
        plan: 'enterprise',
        trial_expires_at: null,
      })
      .mockResolvedValueOnce({
        token_threshold_80: 1,
        token_threshold_90: 1,
        token_threshold_100: 0,
        cost_cap_monthly: 2500,
        email_notifications: 1,
      });
    dbAll.mockResolvedValueOnce([
      {
        id: 'assign-1',
        user_id: 'user-1',
        role_id: 'billing_admin',
        role_name: 'Billing Admin',
        capabilities_json: JSON.stringify(['billing:read']),
        expires_at: null,
      },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/admin/billing/summary');

    expect(res.status).toBe(200);
    expect(res.body.summary.plan.name).toBe('Enterprise');
  });

  it('creates delegated assignments, payment methods, and SCIM tokens from admin surfaces', async () => {
    dbGet
      .mockResolvedValueOnce({ role: 'OWNER', status: 'ACTIVE' })
      .mockResolvedValueOnce({ role: 'OWNER', status: 'ACTIVE' })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ id: 'pm-1', brand: 'Visa', last4: '4242' })
      .mockResolvedValueOnce({ role: 'OWNER', status: 'ACTIVE' });

    const app = createApp();

    const assignmentRes = await request(app)
      .post('/api/admin/iam/assignments')
      .send({
        userId: 'user-2',
        roleId: 'billing_admin',
        roleName: 'Billing Admin',
        capabilities: ['billing:read', 'billing:write'],
      });
    expect(assignmentRes.status).toBe(201);
    expect(assignmentRes.body.assignment.roleId).toBe('billing_admin');

    const paymentRes = await request(app).post('/api/admin/billing/payment-methods').send({
      paymentMethodId: 'pm_demo_4242',
    });
    expect(paymentRes.status).toBe(201);

    const scimRes = await request(app)
      .post('/api/admin/identity/scim/tokens')
      .send({
        name: 'Tenant SCIM Token',
        scopes: ['users:read', 'users:write'],
      });
    expect(scimRes.status).toBe(201);
    expect(String(scimRes.body.token.token)).toContain('scim_');
  });

  it('does not let platform superadmins select a foreign organization context', async () => {
    mockUserRole = 'superadmin';
    dbGet
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ total: 3 })
      .mockResolvedValueOnce({
        subscription_plan_id: 'plan-9',
        status: 'active',
        current_period_end: '2026-06-01',
        plan_name: 'Global Enterprise',
        price_monthly: 4999,
        token_limit: 500000,
        storage_limit_gb: 500,
      })
      .mockResolvedValueOnce({
        trial_tokens_used: 2000,
        token_balance: 420000,
        plan: 'enterprise',
        trial_expires_at: null,
      })
      .mockResolvedValueOnce({
        token_threshold_80: 1,
        token_threshold_90: 1,
        token_threshold_100: 1,
        cost_cap_monthly: 20000,
        email_notifications: 1,
      })
      .mockResolvedValueOnce({ mfa_required: 1, mfa_grace_period_days: 7 })
      .mockResolvedValueOnce({ setting_value: JSON.stringify({ passwordPolicy: 'strict' }) })
      .mockResolvedValueOnce({
        is_enabled: 1,
        provider_name: 'Okta',
        provider_type: 'okta',
        protocol: 'saml',
      })
      .mockResolvedValueOnce({
        mode: 'approved',
        review_state: 'published',
        audit_required: 1,
        updated_at: 'now',
      });

    dbAll
      .mockResolvedValueOnce([
        { role: 'OWNER', total: 1 },
        { role: 'ADMIN', total: 4 },
      ])
      .mockResolvedValueOnce([
        { key: 'tenant:org-2:guest_access_enabled', value: 'false' },
        { key: 'tenant:org-2:external_link_sharing', value: 'false' },
      ]);
    getLogs.mockResolvedValueOnce([]);

    const app = createApp();
    const res = await request(app).get('/api/admin/overview').query({ orgId: 'org-2' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ADMIN_BOUNDARY_VIOLATION');
    expect(dbGet).not.toHaveBeenCalled();
  });

  it('assigns a manual-billing plan + limits and audits the change', async () => {
    dbGet
      // getAdminActor membership lookup
      .mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' })
      // assignBillingPlan: plan id validation
      .mockResolvedValueOnce({ id: 'plan-pro' })
      // assignBillingPlan: existing organization_billing row
      .mockResolvedValueOnce({ id: 'billing-1' })
      // assignBillingPlan: existing organization_limits row
      .mockResolvedValueOnce({ id: 'limits-1' })
      // readBillingSummary: organization_billing join
      .mockResolvedValueOnce({
        subscription_plan_id: 'plan-pro',
        status: 'active',
        plan_name: 'Pro',
        token_limit: 500000,
        storage_limit_gb: 2,
      })
      // readBillingSummary: organizations row
      .mockResolvedValueOnce({ token_balance: 100000, plan: 'Pro', trial_expires_at: null })
      // readBillingSummary: billing_alerts row
      .mockResolvedValueOnce(null);

    const app = createApp();
    const res = await request(app).put('/api/admin/billing/plan').send({
      planId: 'plan-pro',
      planName: 'Pro',
      status: 'active',
      tokenLimit: 500000,
      storageLimitMb: 2048,
      seats: 25,
      aiCallsPerDay: 1000,
      tokenBalance: 100000,
      expiresAt: '2026-12-31T00:00:00.000Z',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // organization_billing UPDATE + organization_limits UPDATE + organizations UPDATE
    expect(dbRun).toHaveBeenCalledTimes(3);
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'update_billing',
        details: expect.objectContaining({
          orgId: 'org-1',
          planId: 'plan-pro',
          tokenLimit: 500000,
          seats: 25,
        }),
      })
    );
  });

  it('rejects an invalid plan assignment payload with validation errors', async () => {
    dbGet
      .mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' })
      // plan id validation: no matching plan
      .mockResolvedValueOnce(null);

    const app = createApp();
    const res = await request(app).put('/api/admin/billing/plan').send({
      planId: 'does-not-exist',
      tokenLimit: -5,
      status: 'bogus',
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.validationErrors)).toBe(true);
    expect(dbRun).not.toHaveBeenCalled();
    expect(logAction).not.toHaveBeenCalled();
  });

  // ── HP-25 B2/B4: SCIM group-mapping per-project + org-scope ──

  it('creates a per-project group mapping using the token org (never the body org)', async () => {
    dbGet.mockResolvedValueOnce({ role: 'OWNER', status: 'ACTIVE' });
    insertScimGroupMapping.mockResolvedValueOnce({
      id: 'map-1',
      externalGroupId: 'grp-1',
      externalGroupName: 'Finance',
      internalRole: 'PROJECT_LEADER',
      projectId: 'proj-A',
      projectName: 'Alpha',
      isActive: true,
      memberCount: 0,
      projectIdApplied: true,
    });

    const app = createApp();
    const res = await request(app).post('/api/admin/identity/scim/group-mappings').send({
      externalGroupName: 'Finance',
      externalGroupId: 'grp-1',
      internalRole: 'PROJECT_LEADER',
      projectId: 'proj-A',
      // Attempt to smuggle another org — must be ignored.
      organizationId: 'org-evil',
      orgId: 'org-evil',
    });

    expect(res.status).toBe(201);
    expect(res.body.mapping.projectId).toBe('proj-A');
    // Service was called with the authenticated org, not the body-supplied one.
    expect(insertScimGroupMapping).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-1', projectId: 'proj-A' })
    );
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'create_scim_group_mapping',
        details: expect.objectContaining({ orgId: 'org-1', projectScoped: true }),
      })
    );
  });

  it('returns 404 when the mapping targets a project outside the org (cross-org guard)', async () => {
    dbGet.mockResolvedValueOnce({ role: 'OWNER', status: 'ACTIVE' });
    insertScimGroupMapping.mockRejectedValueOnce(
      new ScimGroupMappingError('PROJECT_NOT_IN_ORG', 'Project not found in this organization')
    );

    const app = createApp();
    const res = await request(app).post('/api/admin/identity/scim/group-mappings').send({
      externalGroupName: 'Finance',
      externalGroupId: 'grp-1',
      internalRole: 'member',
      projectId: 'proj-from-org-2',
    });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('PROJECT_NOT_IN_ORG');
    expect(logAction).not.toHaveBeenCalled();
  });

  it('blocks a non-superadmin from managing another org via ?orgId (403)', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/admin/identity/scim/group-mappings')
      .query({ orgId: 'org-2' })
      .send({ externalGroupName: 'Finance', internalRole: 'member' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ADMIN_BOUNDARY_VIOLATION');
    expect(insertScimGroupMapping).not.toHaveBeenCalled();
  });

  it('scopes the delete to the active org (id + organization_id predicate)', async () => {
    dbGet.mockResolvedValueOnce({ role: 'OWNER', status: 'ACTIVE' });

    const app = createApp();
    const res = await request(app).delete('/api/admin/identity/scim/group-mappings/map-9');

    expect(res.status).toBe(200);
    const deleteCall = dbRun.mock.calls.find((call) =>
      String(call[0]).includes('DELETE FROM scim_group_mappings')
    );
    expect(deleteCall).toBeDefined();
    expect(String(deleteCall?.[0])).toContain('organization_id = ?');
    expect(deleteCall?.[1]).toEqual(['map-9', 'org-1']);
  });
});
