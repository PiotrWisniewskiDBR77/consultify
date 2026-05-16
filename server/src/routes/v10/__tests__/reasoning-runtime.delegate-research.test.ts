import type { RequestHandler } from 'express';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

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

vi.mock('../../../middleware/auth.middleware.js', () => ({
  default: ((req: MockAuthRequest, _res: unknown, next: () => void) => {
    req.userId = 'route-user';
    req.organizationId = 'route-org';
    req.userRole = 'ADMIN';
    req.user = { id: 'route-user', organizationId: 'route-org', role: 'ADMIN' };
    next();
  }) satisfies RequestHandler,
  requireOrganization: ((_req: unknown, _res: unknown, next: () => void) =>
    next()) satisfies RequestHandler,
}));

vi.mock('../../../services/v10/research/researchRuntimeService.js', () => ({
  researchRuntimeService: {
    planMission: vi.fn(() => ({
      missionId: 'm-1',
      now: '2026-04-21T10:00:00.000Z',
      plan: [{ kind: 'scope', label: 'Scope' }],
      missionSummary: 'planned',
    })),
  },
}));

import { createReasoningRuntimeRouter } from '../reasoning-runtime.routes.js';

function createApp(service: any) {
  const app = express();
  app.use(express.json());
  app.use('/api/v10/reasoning-runtime', createReasoningRuntimeRouter(service));
  return app;
}

describe('reasoning-runtime.routes delegate research', () => {
  it('delegates research planning', async () => {
    const service = { fastChat: vi.fn() };
    const res = await request(createApp(service))
      .post('/api/v10/reasoning-runtime/delegate/research/plan')
      .send({ query: 'q1', depth: 'standard', maxSources: 8 });

    expect(res.status).toBe(200);
    expect(res.body.data.missionId).toBe('m-1');
    const serviceModule = await import('../../../services/v10/research/researchRuntimeService.js');
    expect(serviceModule.researchRuntimeService.planMission).toHaveBeenCalledWith({
      query: 'q1',
      depth: 'standard',
      maxSources: 8,
      scope: { tenantId: 'route-org', userId: 'route-user', userRole: 'ADMIN' },
    });
  });
});
