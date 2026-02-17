/**
 * L2: sessions.routes assessment overview endpoint (honest router test)
 */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'u-1', organizationId: 'org-1' };
    next();
  },
}));

vi.mock('../../server/src/middleware/rateLimiting.middleware.js', () => ({
  authRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

const dbAll = vi.fn(async () => [
  {
    id: 'a-1',
    name: 'Assessment 1',
    description: 'Desc',
    status: 'APPROVED',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
  },
]);

vi.mock('../../server/src/utils/DbPromise.js', () => ({
  all: (..._args: any[]) => dbAll(),
  get: vi.fn(async () => null),
  run: vi.fn(async () => ({ success: true, changes: 1 })),
}));

import sessionsRouter from '../../server/src/routes/user/sessions.routes.js';

describe('GET /api/sessions/:projectId/assessment-overview', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/sessions', sessionsRouter);
  });

  it('returns consolidated payload with DRD assessments', async () => {
    const res = await request(app).get('/api/sessions/proj-123/assessment-overview').expect(200);

    expect(res.body.drd.assessments).toHaveLength(1);
    expect(res.body.consolidated.totalAssessments).toBe(1);
    expect(res.body.consolidated.completedModules).toBe(1);
  });
});
