import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

let mockUser: any = {
  id: 'user-1',
  role: 'ADMIN',
  organizationId: 'org-1',
  isSuperAdmin: false,
};

vi.mock('../../../../server/src/controllers/InterviewController.js', () => ({
  InterviewController: new Proxy(
    {},
    {
      get:
        () =>
        (_req: any, res: any) =>
          res.status(200).json({ ok: true }),
    }
  ),
}));

vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  validateOrgMembership: (_req: any, _res: any, next: () => void) => next(),
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.user = mockUser;
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    next();
  },
}));

vi.mock('../../../../server/src/middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/middleware/permission.middleware.js', () => ({
  requireAnyPermission: () => (_req: any, _res: any, next: () => void) => next(),
  requirePermission: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

describe('interview.routes org guard', () => {
  it('returns 403 RBAC code when authenticated user has no organization', async () => {
    mockUser = {
      id: 'user-1',
      role: 'ADMIN',
      organizationId: '',
      isSuperAdmin: false,
    };
    const { default: interviewRouter } = await import(
      '../../../../server/src/routes/interview.routes.js'
    );
    const app = express();
    app.use('/interview', interviewRouter);

    const res = await request(app).get('/interview/sessions');

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      error: 'Organization access required',
      code: 'RBAC_ORGANIZATION_ACCESS_REQUIRED',
    });
  });
});
