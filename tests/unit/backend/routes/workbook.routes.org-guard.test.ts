import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

let mockUser: any = {
  id: 'user-1',
  role: 'ADMIN',
  organizationId: 'org-1',
};

vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  validateOrgMembership: (_req: any, _res: any, next: () => void) => next(),
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

vi.mock('../../../../server/src/middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryRun: vi.fn().mockResolvedValue(undefined),
  queryOne: vi.fn().mockResolvedValue(null),
  queryAll: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../../server/src/services/workbook/WorkbookGeneratorService.js', () => ({
  default: {
    generate: vi.fn(),
  },
}));

describe('workbook.routes org guard', () => {
  it('returns 403 RBAC code when org context is missing', async () => {
    mockUser = {
      id: 'user-1',
      role: 'ADMIN',
      organizationId: '',
    };
    const { default: workbookRouter } =
      await import('../../../../server/src/routes/workbook.routes.js');
    const app = express();
    app.use('/workbook', workbookRouter);

    const res = await request(app).post('/workbook/generate').send({ prompt: 'Test prompt' });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      error: 'Organization access required',
      code: 'RBAC_ORGANIZATION_ACCESS_REQUIRED',
    });
  });
});
