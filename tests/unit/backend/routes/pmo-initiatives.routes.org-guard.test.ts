import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

let mockUser: any = {
  id: 'user-1',
  role: 'ADMIN',
  organizationId: 'org-1',
};

vi.mock('../../../../server/src/controllers/InitiativeController.js', () => ({
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

vi.mock('../../../../server/src/controllers/StaffingPlanController.js', () => ({
  StaffingPlanController: new Proxy(
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

vi.mock('../../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/services/blueprintService.js', () => ({
  default: {},
}));

vi.mock('../../../../server/src/services/initiative/initiativeKpiAssignmentService.js', () => ({
  upsertInitiativeKpiAssignment: vi.fn(),
}));

vi.mock('../../../../server/src/services/initiativeGenerationService.js', () => ({
  default: {},
}));

vi.mock('../../../../server/src/services/initiativeSectionTypeService.js', () => ({
  default: {},
}));

vi.mock('../../../../server/src/services/initiativeTemplateService.js', () => ({
  default: {},
}));

vi.mock('../../../../server/src/services/workloadCapacityService.js', () => ({
  getCapacityTimeline: vi.fn(),
  getInitiativeCapacity: vi.fn(),
}));

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn().mockResolvedValue(null),
  queryRun: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../server/src/validators/initiative.validators.js', () => ({
  CreateInitiativeSchema: {},
  QuickUpdateInitiativeSchema: {},
  UpdateInitiativeSchema: {},
  UpdateInitiativeStatusSchema: {},
  UpdateInitiativeTemplateSchema: {},
}));

describe('pmo initiatives routes org guard', () => {
  it('returns 403 RBAC code when authenticated user has no organization', async () => {
    mockUser = {
      id: 'user-1',
      role: 'ADMIN',
      organizationId: '',
    };
    const { default: router } = await import(
      '../../../../server/src/routes/pmo/initiatives.routes.js'
    );
    const app = express();
    app.use('/initiatives', router);

    const res = await request(app).get('/initiatives/portfolio');
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      error: 'Organization access required',
      code: 'RBAC_ORGANIZATION_ACCESS_REQUIRED',
    });
  });
});
