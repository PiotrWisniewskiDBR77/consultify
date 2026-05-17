import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

let mockUser: any = {
  id: 'user-1',
  role: 'ADMIN',
  organizationId: 'org-1',
};

vi.mock('../../../../server/src/controllers/AssessmentController.js', () => ({
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

vi.mock('../../../../server/src/middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/database/index.js', () => ({
  getDatabase: vi.fn(),
}));

vi.mock('../../../../server/src/services/ActivityService.js', () => ({
  default: {},
}));

vi.mock('../../../../server/src/services/ai/industryBenchmarkService.js', () => ({
  default: {},
}));

vi.mock('../../../../server/src/services/assessmentInitiativeGenerationRunService.js', () => ({
  default: {},
}));

vi.mock('../../../../server/src/services/assessmentPermissionService.js', () => ({
  default: {
    getUserRole: vi.fn(),
    hasPermission: vi.fn(),
  },
}));

vi.mock('../../../../server/src/services/benchmarkingService.js', () => ({
  default: {},
}));

vi.mock('../../../../server/src/services/notificationService.js', () => ({
  default: {},
}));

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn().mockResolvedValue(null),
  queryRun: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../server/src/validators/assessment.validators.js', () => ({
  CreateAssessmentSchema: {},
  UpdateAssessmentSchema: {},
  RequestReviewSchema: {},
  GenerateReportSchema: {},
  ApproveReportSchema: {},
  ApproveAssessmentSchema: {},
  SendBackSchema: {},
  GenerateInitiativesSchema: {},
  UpsertAssignmentSchema: {},
  AssignAssessmentRoleSchema: {},
  UpsertAssessmentRoleSchema: {},
  UpdateUserStateSchema: {},
  CreateInitiativeGenerationRunSchema: {},
  CreateManualInitiativeFromAssessmentSchema: {},
  ApproveAssessmentAccessRequestSchema: {},
  RejectAssessmentAccessRequestSchema: {},
}));

describe('assessment-workflow-v2 routes org guard', () => {
  it('returns 403 RBAC code when authenticated user has no organization', async () => {
    mockUser = {
      id: 'user-1',
      role: 'ADMIN',
      organizationId: '',
    };
    const { default: router } = await import(
      '../../../../server/src/routes/assessment-workflow-v2.routes.js'
    );
    const app = express();
    app.use('/assessment-workflow-v2', router);

    const res = await request(app).get('/assessment-workflow-v2/sessions');
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      error: 'Organization access required',
      code: 'RBAC_ORGANIZATION_ACCESS_REQUIRED',
    });
  });
});
