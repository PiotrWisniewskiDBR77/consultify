import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

let mockUser: any = {
  id: 'admin-1',
  role: 'ADMIN',
  organizationId: 'org-1',
};

vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.user = mockUser;
    req.userId = mockUser.id;
    req.organizationId = mockUser.organizationId;
    next();
  },
}));

vi.mock('../../../../server/src/middleware/admin.middleware.js', () => ({
  verifyAdmin: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue(null),
  run: vi.fn().mockResolvedValue(undefined),
}));

describe('consultant-project-access routes org guard', () => {
  it('returns 403 RBAC code when user has no valid organization context', async () => {
    mockUser = {
      id: 'admin-1',
      role: 'ADMIN',
      organizationId: '',
    };
    const { default: router } = await import(
      '../../../../server/src/routes/consultant-project-access.routes.js'
    );
    const app = express();
    app.use('/consultant-project-access', router);

    const res = await request(app).get('/consultant-project-access');

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      error: 'Organization access required',
      code: 'RBAC_ORGANIZATION_ACCESS_REQUIRED',
    });
  });
});
