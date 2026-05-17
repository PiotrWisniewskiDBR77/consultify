import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

let mockUser: any = {
  id: 'user-1',
  role: 'ADMIN',
  organizationId: 'org-1',
};

vi.mock('../../../../server/src/controllers/TaskController.js', () => ({
  default: new Proxy(
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

vi.mock('../../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/middleware/requireAudit.middleware.js', () => ({
  requireAudit: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  default: {
    all: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../../server/src/services/criticalPathService.js', () => ({
  calculateCriticalPath: vi.fn().mockReturnValue([]),
}));

vi.mock('../../../../server/src/services/customFieldsService.js', () => ({
  CustomFieldDefinitionSchema: { safeParse: () => ({ success: true, data: {} }) },
  UpdateCustomFieldSchema: { safeParse: () => ({ success: true, data: {} }) },
  validateCustomFieldValues: vi.fn(),
}));

vi.mock('../../../../server/src/services/workloadCapacityService.js', () => ({
  getCapacityOverview: vi.fn(),
  getOverloadAlerts: vi.fn(),
  getUserForecast: vi.fn(),
}));

vi.mock('../../../../server/src/validators/task.validators.js', () => ({
  CreateTaskSchema: {},
  UpdateTaskSchema: {},
  AssignTaskSchema: {},
  ReassignTaskSchema: {},
  BlockTaskSchema: {},
  UnblockTaskSchema: {},
  AddTaskCommentSchema: {},
  EscalateTaskSchema: {},
  ResolveEscalationSchema: {},
}));

describe('pmo tasks routes org guard', () => {
  it('returns 403 RBAC code when authenticated user has no organization', async () => {
    mockUser = {
      id: 'user-1',
      role: 'ADMIN',
      organizationId: '',
    };
    const { default: router } = await import('../../../../server/src/routes/pmo/tasks.routes.js');
    const app = express();
    app.use('/tasks', router);

    const res = await request(app).get('/tasks');
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      error: 'Organization access required',
      code: 'RBAC_ORGANIZATION_ACCESS_REQUIRED',
    });
  });
});
