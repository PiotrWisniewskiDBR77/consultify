import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import adminP32Routes from '../adminP32.routes.js';

const dbAll = vi.fn();
const dbGet = vi.fn();
const dbRun = vi.fn();
const logAction = vi.fn();
const getLogs = vi.fn();

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
    logAction.mockResolvedValue({ success: true });
    dbRun.mockResolvedValue({ success: true, changes: 1 });
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
});
