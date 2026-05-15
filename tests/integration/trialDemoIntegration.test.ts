import jwt from 'jsonwebtoken';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from './_helpers/testApp';

const { mockConvertTrialToOrg, mockAuditLog, mockBuildPolicySnapshot } = vi.hoisted(() => ({
  mockConvertTrialToOrg: vi.fn(),
  mockAuditLog: vi.fn(),
  mockBuildPolicySnapshot: vi.fn(),
}));

vi.mock('../../server/src/services/trialService.js', () => ({
  default: {
    convertTrialToOrg: mockConvertTrialToOrg,
    sendTrialWarnings: vi.fn(),
    processExpiredTrials: vi.fn(),
  },
}));

vi.mock('../../server/src/services/auditService.js', () => ({
  default: {
    log: mockAuditLog,
  },
}));

vi.mock('../../server/src/services/accessPolicyService.js', () => ({
  default: {
    buildPolicySnapshot: mockBuildPolicySnapshot,
  },
}));

describe('Trial routes contract', () => {
  const basePath = '/api/trial';
  let router: any;

  const tokenFor = (user: { id: string; role?: string; organizationId?: string }) => {
    const secret = process.env.JWT_SECRET || 'test-secret';
    return jwt.sign(
      {
        id: user.id,
        role: user.role || 'ADMIN',
        organizationId: user.organizationId || 'o-1',
      },
      secret
    );
  };

  const mount = () =>
    makeTestApp({
      mountPath: basePath,
      router,
    });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'false';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

    vi.resetModules();
    router = (await import('../../server/src/routes/trial.routes.ts')).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockConvertTrialToOrg.mockResolvedValue({ newOrganizationId: 't1' });
    mockAuditLog.mockResolvedValue(undefined);
    mockBuildPolicySnapshot.mockResolvedValue({
      orgType: 'TRIAL',
      isTrial: true,
      isDemo: false,
      isPaid: false,
      subscriptionStatus: null,
      trialDaysLeft: 3,
      isTrialExpired: false,
      warningLevel: 'warning',
      trialStartedAt: '2026-01-01T00:00:00.000Z',
      trialExpiresAt: '2026-01-08T00:00:00.000Z',
      usagePercent: {},
      hasPaymentMethod: false,
      upgradeCtas: { primaryAction: 'Upgrade', urlOrRoute: '/settings?tab=billing' },
    });
  });

  it('POST /:trialId/convert returns 400 when newOrgName is missing', async () => {
    const token = tokenFor({ id: 'u1', organizationId: 't1', role: 'ADMIN' });
    const res = await request(mount())
      .post(`${basePath}/t1/convert`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /:trialId/convert returns 403 when token is missing', async () => {
    const res = await request(mount()).post(`${basePath}/t1/convert`).send({ newOrgName: 'X' });
    expect(res.status).toBe(403);
  });

  it('POST /:trialId/convert returns 503 when TrialService is unavailable', async () => {
    mockConvertTrialToOrg.mockResolvedValueOnce(undefined as any);
    const token = tokenFor({ id: 'u1', organizationId: 't1', role: 'ADMIN' });
    const res = await request(mount())
      .post(`${basePath}/t1/convert`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newOrgName: 'Acme' });
    expect(res.status).toBe(503);
  });

  it('POST /:trialId/convert returns 403 when trialId is outside user scope', async () => {
    const token = tokenFor({ id: 'u1', organizationId: 'org-own', role: 'ADMIN' });
    const res = await request(mount())
      .post(`${basePath}/other-org/convert`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newOrgName: 'Acme' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual(expect.objectContaining({ errorCode: 'TRIAL_SCOPE_MISMATCH' }));
  });

  it('POST /:trialId/convert returns 403 for non-admin roles', async () => {
    const token = tokenFor({ id: 'u1', organizationId: 't1', role: 'MEMBER' });
    const res = await request(mount())
      .post(`${basePath}/t1/convert`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newOrgName: 'Acme' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual(
      expect.objectContaining({ errorCode: 'TRIAL_CONVERSION_FORBIDDEN' })
    );
  });

  it('POST /confirm-transition returns 400 when confirmations are incomplete', async () => {
    const token = tokenFor({ id: 'u1' });
    const res = await request(mount())
      .post(`${basePath}/confirm-transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        confirmations: { timeCommitment: true, teamScope: true },
      });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ required: expect.any(Array) }));
  });

  it('POST /confirm-transition writes audit_log when confirmations are valid', async () => {
    const token = tokenFor({ id: 'u1' });
    const res = await request(mount())
      .post(`${basePath}/confirm-transition`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        confirmations: { timeCommitment: true, teamScope: true, memoryAware: true },
        confirmedAt: '2026-01-01T00:00:00.000Z',
      });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ success: true, nextStep: 'ORG_SETUP_WIZARD' })
    );
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        action: 'trial_transition_confirmed',
      })
    );
  });
});
