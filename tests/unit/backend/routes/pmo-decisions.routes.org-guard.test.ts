import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

let mockUser: any = {
  id: 'user-1',
  role: 'ADMIN',
  organizationId: 'org-1',
};

vi.mock('../../../../server/src/controllers/DecisionController.js', () => ({
  default: new Proxy(
    {},
    {
      get: () => (_req: any, res: any) => res.status(200).json({ ok: true }),
    }
  ),
}));

vi.mock('../../../../server/src/controllers/DecisionPlaybookController.js', () => ({
  default: new Proxy(
    {},
    {
      get: () => (_req: any, res: any) => res.status(200).json({ ok: true }),
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

vi.mock('../../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/services/decisionPlaybookService.js', () => ({
  PlaybookSchema: {},
}));

vi.mock('../../../../server/src/validators/decision.validators.js', () => ({
  CreateDecisionSchema: {},
  UpdateDecisionSchema: {},
  DecideSchema: {},
  EscalateDecisionSchema: {},
  RemindDecisionSchema: {},
  CreateDecisionCommentSchema: {},
  UpdateDecisionCommentSchema: {},
  CreateDecisionAlternativeSchema: {},
  UpdateDecisionAlternativeSchema: {},
  CreateDecisionRiskSchema: {},
  UpdateDecisionRiskSchema: {},
}));

describe('pmo decisions routes org guard', () => {
  it('returns 403 RBAC code when authenticated user has no organization', async () => {
    mockUser = {
      id: 'user-1',
      role: 'ADMIN',
      organizationId: '',
    };
    const { default: router } =
      await import('../../../../server/src/routes/pmo/decisions.routes.js');
    const app = express();
    app.use('/decisions', router);

    const res = await request(app).get('/decisions');
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      error: 'Organization access required',
      code: 'RBAC_ORGANIZATION_ACCESS_REQUIRED',
    });
  });
});
