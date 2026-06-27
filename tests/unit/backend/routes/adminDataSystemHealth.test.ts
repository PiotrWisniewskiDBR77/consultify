/**
 * AdminData Routes - system health smoke test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock auth middleware to inject org/user
vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'test-user-id', organizationId: 'test-org-id', role: 'ADMIN' };
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
}));

// Mock DB helpers so the route can execute without hitting a real DB
const mockDbGet = vi.fn().mockResolvedValue({ ok: true });
vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: any[]) => mockDbGet(...args),
  run: vi.fn().mockResolvedValue({ success: true }),
  all: vi.fn().mockResolvedValue([]),
}));

describe('AdminData Routes', () => {
  let app: express.Application;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = express();
    const adminDataRoutes = (await import('../../../../server/src/routes/admin-data.routes.js'))
      .default;
    app.use('/api/admin-data', adminDataRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/admin-data/system-health returns status and services', async () => {
    const res = await request(app).get('/api/admin-data/system-health').expect(200);
    expect(res.body).toHaveProperty('status');
    expect(Array.isArray(res.body.services)).toBe(true);
    expect(res.body.services.length).toBeGreaterThan(0);
  });
});
