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

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  get: (...args: any[]) => dbGet(...args),
  run: (...args: any[]) => dbRun(...args),
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', organizationId: 'org-1', role: mockUserRole };
    next();
  },
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

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminP32Routes);
  return app;
}

describe('adminP32Routes', () => {
  beforeEach(() => {
    mockUserRole = 'admin';
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
      limits: { maxUsers: 20, maxProjects: 10, maxStorageMb: 1024, maxTotalTokens: 5000, maxAICallsPerDay: 200 },
      trialExpiresAt: null,
    });
    getEffectivePolicy.mockResolvedValue({ level: 'ASSISTED' });
    getPolicySummary.mockResolvedValue({ policyLevel: 'ASSISTED', modelCount: 4, budgetStatus: 'healthy' });
    getOrgContextPolicy.mockResolvedValue({ allowExternalContext: false, defaultSensitivity: 'internal' });
  });

  it('blocks guests from the admin cockpit with explicit guidance', async () => {
    mockUserRole = 'guest';
    dbGet.mockResolvedValueOnce({ role: 'GUEST' });

    const app = createApp();
    const res = await request(app).get('/api/admin/security');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ADMIN_ACCESS_REQUIRED');
    expect(res.body.guidance).toContain('Guests cannot access admin tools');
  });

  it('returns canonical security policy from org + organization_settings + sso', async () => {
    dbGet
      .mockResolvedValueOnce({ role: 'ADMIN' })
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
    dbGet.mockResolvedValueOnce({ role: 'OWNER' });
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
    dbGet.mockResolvedValueOnce({ role: 'ADMIN' });
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
      .mockResolvedValueOnce({ role: 'ADMIN' })
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
      .mockResolvedValueOnce({ is_enabled: 1, provider_name: 'Okta', provider_type: 'okta', protocol: 'saml' })
      .mockResolvedValueOnce({ mode: 'approved', review_state: 'published', audit_required: 1, updated_at: 'now' });

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
    dbGet
      .mockResolvedValueOnce({ role: 'OWNER' })
      .mockResolvedValueOnce({
        setting_value: JSON.stringify({
          delegatedRoles: [{ id: 'billing_admin', name: 'Billing Admin', capabilities: ['billing:read'] }],
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

    dbGet
      .mockResolvedValueOnce({ role: 'OWNER' })
      .mockResolvedValueOnce({
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
});
