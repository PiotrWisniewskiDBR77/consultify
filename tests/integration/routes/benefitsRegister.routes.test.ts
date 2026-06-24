/**
 * Integration tests — benefitsRegister.routes (M14/F6 handoff M14 → M15).
 *
 * Verifies the three endpoints route org-scoped through BenefitsRegisterService:
 *   GET  /benefits                       — list (optional ?initiativeId)
 *   POST /benefits                       — create (write-gated)
 *   POST /benefits/handoff/:initiativeId — real closure handoff (write-gated)
 *
 * Auth + write-permission middleware are mocked as pass-through (the gating
 * logic itself lives in / is tested with the middleware); the service is mocked
 * so we assert wiring (org id, params, body) rather than DB behaviour. 401 is
 * asserted when no org is present on req.user.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  userId: 'u-1' as string | null,
  organizationId: 'org-1' as string | null,
  role: 'ADMIN' as string | null,
}));

const listBenefitsMock = vi.fn(async () => [{ id: 'b-1', name: 'Benefit 1' }]);
const createBenefitMock = vi.fn(async () => ({ id: 'b-new', name: 'Created' }));
const handoffFromClosureMock = vi.fn(async () => ({
  id: 'b-handoff',
  name: 'Handoff benefit',
  source: 'M14_CLOSURE_HANDOFF',
}));

// Auth: pass-through, attaches req.user from authState (or nothing).
vi.mock('../../../server/src/middleware/auth.middleware.js', async () => {
  const actual = (await vi.importActual(
    '../../../server/src/middleware/auth.middleware.js'
  )) as Record<string, unknown>;
  return {
    ...actual,
    verifyToken: (req: any, _res: any, next: any) => {
      req.user = authState.userId
        ? {
            id: authState.userId,
            organizationId: authState.organizationId,
            role: authState.role || 'ADMIN',
          }
        : undefined;
      next();
    },
    isAuthenticated: (_req: any, _res: any, next: any) => next(),
  };
});

// Permission write-gate: pass-through.
vi.mock('../../../server/src/middleware/permissionMiddleware.js', () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
}));

// Service: mocked — we assert wiring, not persistence.
vi.mock('../../../server/src/services/benefitsRegisterService.js', () => ({
  BenefitsRegisterService: {
    listBenefits: (...args: unknown[]) => listBenefitsMock(...args),
    createBenefit: (...args: unknown[]) => createBenefitMock(...args),
    handoffFromClosure: (...args: unknown[]) => handoffFromClosureMock(...args),
  },
}));

const { default: benefitsRouter } = await import(
  '../../../server/src/routes/benefitsRegister.routes.js'
);

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', benefitsRouter);
  return app;
}

describe('benefitsRegister routes (M14/F6)', () => {
  beforeEach(() => {
    authState.userId = 'u-1';
    authState.organizationId = 'org-1';
    authState.role = 'ADMIN';
    vi.clearAllMocks();
  });

  describe('GET /benefits', () => {
    it('lists benefits org-scoped', async () => {
      const app = createApp();
      const res = await request(app).get('/api/benefits');
      expect(res.status).toBe(200);
      expect(res.body.benefits).toHaveLength(1);
      expect(res.body.count).toBe(1);
      expect(listBenefitsMock).toHaveBeenCalledWith('org-1', undefined);
    });

    it('forwards ?initiativeId filter', async () => {
      const app = createApp();
      const res = await request(app).get('/api/benefits?initiativeId=init-9');
      expect(res.status).toBe(200);
      expect(listBenefitsMock).toHaveBeenCalledWith('org-1', 'init-9');
    });

    it('401 when no org on req.user', async () => {
      authState.userId = null;
      authState.organizationId = null;
      const app = createApp();
      const res = await request(app).get('/api/benefits');
      expect(res.status).toBe(401);
      expect(listBenefitsMock).not.toHaveBeenCalled();
    });
  });

  describe('POST /benefits', () => {
    it('creates a benefit org-scoped', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/benefits')
        .send({ name: 'New benefit', kpiName: 'NPS', targetValue: 50 });
      expect(res.status).toBe(201);
      expect(res.body.benefit.id).toBe('b-new');
      expect(createBenefitMock).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ name: 'New benefit', kpiName: 'NPS', targetValue: 50 })
      );
    });

    it('400 on invalid body (missing name)', async () => {
      const app = createApp();
      const res = await request(app).post('/api/benefits').send({ kpiName: 'NPS' });
      expect(res.status).toBe(400);
      expect(createBenefitMock).not.toHaveBeenCalled();
    });

    it('401 when no org on req.user', async () => {
      authState.userId = null;
      authState.organizationId = null;
      const app = createApp();
      const res = await request(app).post('/api/benefits').send({ name: 'x' });
      expect(res.status).toBe(401);
      expect(createBenefitMock).not.toHaveBeenCalled();
    });
  });

  describe('POST /benefits/handoff/:initiativeId', () => {
    it('hands off closure KPI delta org-scoped', async () => {
      const app = createApp();
      const res = await request(app)
        .post('/api/benefits/handoff/init-42')
        .send({ kpiName: 'Lead time', baselineValue: 10, currentValue: 4 });
      expect(res.status).toBe(201);
      expect(res.body.benefit.source).toBe('M14_CLOSURE_HANDOFF');
      expect(handoffFromClosureMock).toHaveBeenCalledWith(
        'org-1',
        'init-42',
        expect.objectContaining({ kpiName: 'Lead time', baselineValue: 10, currentValue: 4 })
      );
    });

    it('401 when no org on req.user', async () => {
      authState.userId = null;
      authState.organizationId = null;
      const app = createApp();
      const res = await request(app).post('/api/benefits/handoff/init-42').send({});
      expect(res.status).toBe(401);
      expect(handoffFromClosureMock).not.toHaveBeenCalled();
    });
  });
});
