import type { RequestHandler } from 'express';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockAuthRequest = {
  userId?: string;
  organizationId?: string;
  userRole?: string;
  user?: {
    id?: string;
    organizationId?: string;
    role?: string;
  };
};

const authState = vi.hoisted(() => ({
  role: 'ADMIN',
}));

vi.mock('../../../middleware/auth.middleware.js', () => ({
  default: ((req: MockAuthRequest, _res: unknown, next: () => void) => {
    req.userId = 'route-user';
    req.organizationId = 'route-org';
    req.userRole = authState.role;
    req.user = { id: 'route-user', organizationId: 'route-org', role: authState.role };
    next();
  }) satisfies RequestHandler,
  requireOrganization: ((_req: unknown, _res: unknown, next: () => void) =>
    next()) satisfies RequestHandler,
}));

vi.mock('../../../middleware/rbac.middleware.js', () => ({
  requireRole:
    (...requiredRoles: string[]) =>
    ((req: MockAuthRequest, res: any, next: () => void) => {
      const role = String(req.userRole || req.user?.role || '').toLowerCase();
      const allowed = requiredRoles.map((r) => String(r).toLowerCase());
      if (!allowed.includes(role)) {
        return res.status(403).json({ error: 'Insufficient role', code: 'RBAC_INSUFFICIENT_ROLE' });
      }
      next();
    }) satisfies RequestHandler,
}));

import { LearningLoopInputError } from '../../../services/v10/learning/learningLoopService.js';
import { createLearningLoopRouter } from '../learning-loop.routes.js';

function createApp(service: any) {
  const app = express();
  app.use(express.json());
  app.use('/api/v10/learning-loop', createLearningLoopRouter(service));
  return app;
}

describe('learning-loop.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.role = 'ADMIN';
  });

  it('injects auth scope into feedback submission', async () => {
    const service = {
      submitFeedback: vi.fn(async (input: any) => ({
        feedbackId: 'f-1',
        now: '2026-04-21T10:00:00.000Z',
        queuedForStewardship: false,
        scopeEcho: input.scope,
      })),
      retentionPreview: vi.fn(),
      listStewardship: vi.fn(),
      resolveStewardship: vi.fn(),
      coverage: vi.fn(),
      dashboard: vi.fn(),
      reportIncident: vi.fn(),
      listIncidents: vi.fn(),
    };

    const res = await request(createApp(service))
      .post('/api/v10/learning-loop/feedback/submit')
      .send({ rating: 5, comment: 'ok', targetType: 'chat', tags: [] });

    expect(res.status).toBe(200);
    expect(service.submitFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { tenantId: 'route-org', userId: 'route-user', userRole: 'ADMIN' },
      })
    );
  });

  it('maps service input errors to typed responses', async () => {
    const service = {
      submitFeedback: vi.fn(async () => {
        throw new LearningLoopInputError('LEARNING_LOOP_BAD_INPUT', 'bad input', 422);
      }),
      retentionPreview: vi.fn(),
      listStewardship: vi.fn(),
      resolveStewardship: vi.fn(),
      coverage: vi.fn(),
      dashboard: vi.fn(),
      reportIncident: vi.fn(),
      listIncidents: vi.fn(),
    };

    const res = await request(createApp(service))
      .post('/api/v10/learning-loop/feedback/submit')
      .send({ rating: 5, targetType: 'chat', tags: [] });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('LEARNING_LOOP_BAD_INPUT');
    expect(res.body.error).toBe('bad input');
  });

  it('loads stewardship and dashboard surfaces with authenticated tenant scope', async () => {
    const service = {
      submitFeedback: vi.fn(),
      retentionPreview: vi.fn(),
      listStewardship: vi.fn(async () => ({ now: '2026-04-21T10:00:00.000Z', items: [] })),
      resolveStewardship: vi.fn(),
      coverage: vi.fn(async () => ({ now: '2026-04-21T10:00:00.000Z', coverage: 1 })),
      dashboard: vi.fn(async () => ({
        now: '2026-04-21T10:00:00.000Z',
        incidents: { open: 0, total: 0 },
      })),
      reportIncident: vi.fn(),
      listIncidents: vi.fn(async () => ({ now: '2026-04-21T10:00:00.000Z', incidents: [] })),
    };

    const queueRes = await request(createApp(service)).get(
      '/api/v10/learning-loop/stewardship/queue'
    );
    expect(queueRes.status).toBe(200);
    expect(service.listStewardship).toHaveBeenCalledWith({ tenantId: 'route-org' });

    const coverageRes = await request(createApp(service)).get(
      '/api/v10/learning-loop/coverage/summary'
    );
    expect(coverageRes.status).toBe(200);
    expect(service.coverage).toHaveBeenCalledWith({ tenantId: 'route-org' });

    const dashboardRes = await request(createApp(service)).get(
      '/api/v10/learning-loop/quality/dashboard'
    );
    expect(dashboardRes.status).toBe(200);
    expect(service.dashboard).toHaveBeenCalledWith({ tenantId: 'route-org' });

    const incidentsRes = await request(createApp(service)).get('/api/v10/learning-loop/incidents');
    expect(incidentsRes.status).toBe(200);
    expect(service.listIncidents).toHaveBeenCalledWith({ tenantId: 'route-org' });
  });

  it('injects scope into stewardship resolution and incident reporting', async () => {
    const service = {
      submitFeedback: vi.fn(),
      retentionPreview: vi.fn(),
      listStewardship: vi.fn(),
      resolveStewardship: vi.fn(async (_itemId: string, input: any) => ({
        now: '2026-04-21T10:00:00.000Z',
        itemId: 'item-1',
        status: 'resolved',
        scopeEcho: input.scope,
      })),
      coverage: vi.fn(),
      dashboard: vi.fn(),
      reportIncident: vi.fn(async (input: any) => ({
        now: '2026-04-21T10:00:00.000Z',
        incidentId: 'inc-1',
        status: 'open',
        scopeEcho: input.scope,
      })),
      listIncidents: vi.fn(),
    };

    const resolveRes = await request(createApp(service))
      .post('/api/v10/learning-loop/stewardship/item-1/resolve')
      .send({ note: 'ok' });
    expect(resolveRes.status).toBe(200);
    expect(service.resolveStewardship).toHaveBeenCalledWith(
      'item-1',
      expect.objectContaining({
        scope: { tenantId: 'route-org', userId: 'route-user', userRole: 'ADMIN' },
      })
    );

    const incidentRes = await request(createApp(service))
      .post('/api/v10/learning-loop/incidents/report')
      .send({ kind: 'drift', severity: 'medium', summary: 'drift detected', tags: [] });
    expect(incidentRes.status).toBe(200);
    expect(service.reportIncident).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { tenantId: 'route-org', userId: 'route-user', userRole: 'ADMIN' },
      })
    );
  });

  it('exposes learning loop contract metadata', async () => {
    const service = {
      submitFeedback: vi.fn(),
      retentionPreview: vi.fn(),
      listStewardship: vi.fn(),
      resolveStewardship: vi.fn(),
      coverage: vi.fn(),
      dashboard: vi.fn(),
      reportIncident: vi.fn(),
      listIncidents: vi.fn(),
    };

    const res = await request(createApp(service)).get('/api/v10/learning-loop/contract');

    expect(res.status).toBe(200);
    expect(res.body.data.contract).toBe('learning_loop_wave_b_v1');
    expect(res.body.meta.contract).toBe('learning_loop_wave_b_v1');
  });

  it('returns 403 fail-closed when user role is not admin', async () => {
    const service = {
      submitFeedback: vi.fn(),
      retentionPreview: vi.fn(),
      listStewardship: vi.fn(),
      resolveStewardship: vi.fn(),
      coverage: vi.fn(),
      dashboard: vi.fn(),
      reportIncident: vi.fn(),
      listIncidents: vi.fn(),
    };
    authState.role = 'MEMBER';
    const app = createApp(service);

    const res = await request(app).get('/api/v10/learning-loop/stewardship/queue');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('RBAC_INSUFFICIENT_ROLE');
    expect(res.body.error).toBe('Insufficient role');
    expect(service.listStewardship).not.toHaveBeenCalled();
  });

  it('maps missing stewardship queue item to coded 404 response', async () => {
    const service = {
      submitFeedback: vi.fn(),
      retentionPreview: vi.fn(),
      listStewardship: vi.fn(),
      resolveStewardship: vi.fn(async () => {
        throw new LearningLoopInputError(
          'LEARNING_LOOP_QUEUE_ITEM_NOT_FOUND',
          'Queue item not found',
          404
        );
      }),
      coverage: vi.fn(),
      dashboard: vi.fn(),
      reportIncident: vi.fn(),
      listIncidents: vi.fn(),
    };

    const res = await request(createApp(service))
      .post('/api/v10/learning-loop/stewardship/missing-row/resolve')
      .send({ note: 'ack' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('LEARNING_LOOP_QUEUE_ITEM_NOT_FOUND');
    expect(res.body.error).toBe('Queue item not found');
    expect(res.body.meta.contract).toBe('learning_loop_wave_b_v1');
    expect(service.resolveStewardship).toHaveBeenCalledWith(
      'missing-row',
      expect.objectContaining({
        scope: expect.objectContaining({ tenantId: 'route-org', userId: 'route-user' }),
      })
    );
  });

  it('validates and injects scope for retention preview endpoint', async () => {
    const service = {
      submitFeedback: vi.fn(),
      retentionPreview: vi.fn(async (input: any) => ({
        now: '2026-04-21T10:00:00.000Z',
        retain: true,
        ttlDays: 30,
        reasons: ['ok'],
        redactedSample: null,
        scopeEcho: input.scope,
      })),
      listStewardship: vi.fn(),
      resolveStewardship: vi.fn(),
      coverage: vi.fn(),
      dashboard: vi.fn(),
      reportIncident: vi.fn(),
      listIncidents: vi.fn(),
    };

    const okRes = await request(createApp(service))
      .post('/api/v10/learning-loop/retention/preview')
      .send({ text: 'hello world', contextHint: 'settings' });
    expect(okRes.status).toBe(200);
    expect(okRes.body.meta.contract).toBe('learning_loop_wave_b_v1');
    expect(service.retentionPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'hello world',
        contextHint: 'settings',
        scope: { tenantId: 'route-org', userId: 'route-user', userRole: 'ADMIN' },
      })
    );

    const badRes = await request(createApp(service))
      .post('/api/v10/learning-loop/retention/preview')
      .send({});
    expect(badRes.status).toBe(400);
    expect(service.retentionPreview).toHaveBeenCalledTimes(1);

    authState.role = 'MEMBER';
    const deniedRes = await request(createApp(service))
      .post('/api/v10/learning-loop/retention/preview')
      .send({ text: 'still valid' });
    expect(deniedRes.status).toBe(403);
    expect(deniedRes.body.code).toBe('RBAC_INSUFFICIENT_ROLE');
  });
});
