import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from './_helpers/testApp';

const { convertTrialToOrg, auditLog } = vi.hoisted(() => ({
  convertTrialToOrg: vi.fn(),
  auditLog: vi.fn(),
}));

vi.mock('../../server/src/services/trialService.js', () => ({
  default: {
    convertTrialToOrg: (...args: any[]) => convertTrialToOrg(...args),
  },
}));

vi.mock('../../server/src/services/auditService.js', () => ({
  default: {
    log: (...args: any[]) => auditLog(...args),
  },
}));

vi.mock('../../server/src/middleware/rateLimiting.middleware.js', () => ({
  authRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../server/src/middleware/demoGuard.middleware.js', () => ({
  demoGuard: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
}));

async function loadTrialRouter() {
  return (await import('../../server/src/routes/trial.routes.ts')).default;
}

async function makeTrialApp(opts?: { user?: { id: string } }) {
  const router = await loadTrialRouter();
  return makeTestApp({
    mountPath: '/api/trial',
    router,
    beforeMount: (app) => {
      if (!opts?.user) return;
      app.use((req, _res, next) => {
        (req as any).user = opts.user;
        next();
      });
    },
  });
}

describe('Trial demo integration (trial.routes) - REAL integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    convertTrialToOrg.mockResolvedValue({ newOrganizationId: 'org-new' });
    auditLog.mockResolvedValue(undefined);
  });

  it('POST /:trialId/convert returns 400 when newOrgName is missing', async () => {
    const app = await makeTrialApp({ user: { id: 'u1' } });
    const res = await request(app).post('/api/trial/t1/convert').send({});
    expect(res.status).toBe(400);
  });

  it('POST /:trialId/convert returns 401 when user is missing', async () => {
    const app = await makeTrialApp();
    const res = await request(app).post('/api/trial/t1/convert').send({ newOrgName: 'X' });
    expect(res.status).toBe(401);
  });

  it('POST /:trialId/convert calls TrialService.convertTrialToOrg on success', async () => {
    const app = await makeTrialApp({ user: { id: 'u1' } });
    const res = await request(app).post('/api/trial/t1/convert').send({ newOrgName: 'Acme' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ success: true, newOrganizationId: 'org-new' })
    );
    expect(convertTrialToOrg).toHaveBeenCalledWith('t1', 'u1', 'Acme');
  });

  it('POST /confirm-transition returns 400 when confirmations are incomplete', async () => {
    const app = await makeTrialApp({ user: { id: 'u1' } });
    const res = await request(app)
      .post('/api/trial/confirm-transition')
      .send({
        confirmations: { timeCommitment: true, teamScope: true },
      });
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expect.objectContaining({ required: expect.any(Array) }));
  });

  it('POST /confirm-transition logs audit event when confirmations are valid', async () => {
    const app = await makeTrialApp({ user: { id: 'u1' } });
    const res = await request(app)
      .post('/api/trial/confirm-transition')
      .send({
        confirmations: { timeCommitment: true, teamScope: true, memoryAware: true },
        confirmedAt: '2026-01-01T00:00:00.000Z',
      });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({ success: true, nextStep: 'ORG_SETUP_WIZARD' })
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        action: 'trial_transition_confirmed',
        metadata: expect.objectContaining({ phase: 'C_TO_D' }),
      })
    );
  });
});
