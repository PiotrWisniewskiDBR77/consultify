// @vitest-environment node

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAll = vi.fn();
const dbGet = vi.fn();
const dbRun = vi.fn();

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...args) => dbAll(...args),
  get: (...args) => dbGet(...args),
  run: (...args) => dbRun(...args),
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req, _res, next) => {
    req.user = { id: 'econ-user', organizationId: 'econ-org', role: 'ADMIN' };
    next();
  },
}));

import economicsRoutes from '../../../server/src/routes/economics.routes.ts';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/economics', economicsRoutes);
  return app;
}

describe('Integration Test: Economics Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbAll.mockResolvedValue([]);
    dbGet.mockResolvedValue({ count: 0, avg: 0 });
    dbRun.mockResolvedValue({ changes: 1 });
  });

  it('GET /api/economics/analyses lists analyses for the authenticated tenant', async () => {
    const res = await request(createApp()).get('/api/economics/analyses');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ analyses: [], total: 0 });
    expect(dbAll).toHaveBeenCalledWith(
      expect.stringContaining('WHERE da.organization_id = ?'),
      ['econ-org'],
      { fallback: false }
    );
  });

  it('GET /api/economics/stats returns current catalog counters', async () => {
    dbGet
      .mockResolvedValueOnce({ count: 7 })
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 3 })
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ avg: 73 });

    const res = await request(createApp()).get('/api/economics/stats');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      total: 7,
      draft: 2,
      inProgress: 3,
      completed: 2,
      avgScore: 73,
    });
  });

  it('POST /api/economics/analyses persists a validated tenant-scoped analysis', async () => {
    const res = await request(createApp())
      .post('/api/economics/analyses')
      .send({ name: 'Test Analysis', description: 'Integration Check', projectId: 'econ-proj' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      success: true,
      analysis: { name: 'Test Analysis', organizationId: 'econ-org' },
    });
    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO digitization_analyses'),
      expect.arrayContaining(['Test Analysis', 'econ-proj', 'econ-org', 'econ-user'])
    );
  });
});
