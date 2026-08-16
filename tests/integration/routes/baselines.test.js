// @vitest-environment node

import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req, _res, next) => {
    req.user = { id: 'baseline-user', organizationId: 'baseline-org', role: 'ADMIN' };
    next();
  },
}));

import baselinesRoutes from '../../../server/src/routes/baselines.routes.ts';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/baselines', baselinesRoutes);
  return app;
}

describe('Integration Test: Baselines Routes', () => {
  it('POST /api/baselines/:roadmapId/capture returns the current create contract', async () => {
    const res = await request(createApp())
      .post('/api/baselines/roadmap-1/capture')
      .send({ projectId: 'baseline-proj', rationale: 'Initial Baseline' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      roadmapId: 'roadmap-1',
      message: 'Baseline captured successfully',
    });
    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body.capturedAt).toEqual(expect.any(String));
  });

  it('GET /api/baselines/:roadmapId/current honestly returns 404 when none exists', async () => {
    const res = await request(createApp()).get('/api/baselines/roadmap-1/current');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'No baseline found for this roadmap' });
  });

  it('GET /api/baselines/:roadmapId/variance returns the current variance contract', async () => {
    const res = await request(createApp()).get('/api/baselines/roadmap-1/variance');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      roadmapId: 'roadmap-1',
      variance: 0,
      status: 'on_track',
      details: [],
    });
  });
});
