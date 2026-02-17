/**
 * L2: user sessions routes (honest router tests)
 */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAll = vi.fn(async () => [
  {
    id: 's-1',
    device: 'Mac',
    ip_address: '127.0.0.1',
    last_active: '2026-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
  },
]);

const dbRun = vi.fn(async () => ({ success: true, changes: 1 }));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'u-1', organizationId: 'org-1' };
    (req as any).sessionId = 's-1';
    next();
  },
}));

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  authRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (..._args: any[]) => dbAll(),
  run: (..._args: any[]) => dbRun(),
  get: vi.fn(async () => null),
}));

import sessionsRouter from '../../../server/src/routes/user/sessions.routes.js';

describe('sessions.routes', () => {
  let app: express.Express;

  beforeEach(() => {
    dbAll.mockClear();
    dbRun.mockClear();
    app = express();
    app.use(express.json());
    app.use('/api/sessions', sessionsRouter);
  });

  it('GET /api/sessions returns active sessions and marks current', async () => {
    const res = await request(app).get('/api/sessions').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].isCurrent).toBe(true);
  });

  it('DELETE /api/sessions terminates other sessions', async () => {
    const res = await request(app).delete('/api/sessions').expect(200);
    expect(res.body.success).toBe(true);
    expect(dbRun).toHaveBeenCalled();
  });
});
