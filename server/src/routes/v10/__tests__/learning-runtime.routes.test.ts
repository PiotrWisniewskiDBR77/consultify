import type { RequestHandler } from 'express';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createLearningRuntimeRouter } from '../learning-runtime.routes.js';

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

function createApp(service: any) {
  const app = express();
  app.use(express.json());
  app.use('/api/v10/learning-runtime', createLearningRuntimeRouter(service));
  return app;
}

describe('learning-runtime.routes', () => {
  it('ingests learning signals through the runtime contract', async () => {
    const service = {
      ingest: vi.fn(() => ({
        signalId: 'learn-1',
        now: '2026-04-23T10:00:00.000Z',
        accepted: true,
      })),
    };

    const res = await request(createApp(service))
      .post('/api/v10/learning-runtime/ingest')
      .send({ signal: 'user_feedback: thumbs_up' });

    expect(res.status).toBe(200);
    expect(service.ingest).toHaveBeenCalledWith({ signal: 'user_feedback: thumbs_up' });
    expect(res.body.meta.contract).toBe('learning_runtime_wave_a_v1');
  });

  it('exposes learning runtime contract metadata', async () => {
    const service = { ingest: vi.fn() };

    const res = await request(createApp(service)).get('/api/v10/learning-runtime/contract');

    expect(res.status).toBe(200);
    expect(res.body.data.contract).toBe('learning_runtime_wave_a_v1');
    expect(res.body.meta.contract).toBe('learning_runtime_wave_a_v1');
  });
});
