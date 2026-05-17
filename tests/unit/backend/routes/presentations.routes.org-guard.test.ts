import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

let mockUser: any = {
  id: 'user-1',
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
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    next();
  },
}));

vi.mock('../../../../server/src/middleware/requireAudit.middleware.js', () => ({
  requireAudit: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/services/notificationService.js', () => ({
  send: vi.fn(),
}));

vi.mock('../../../../server/src/services/OrgPoliciesService.js', () => ({
  requireNoLegalHold: vi.fn(),
  OrgPoliciesError: class OrgPoliciesError extends Error {},
}));

vi.mock('../../../../server/src/services/presentationGeneratorService.js', () => ({
  generateDeck: vi.fn(),
  generateOutline: vi.fn(),
}));

vi.mock('../../../../server/src/services/v8/artifactRegistryService.js', () => ({
  getArtifactByOrigin: vi.fn(),
}));

vi.mock('../../../../server/src/services/v8/reportsPresModelService.js', () => ({
  recordCompletedExport: vi.fn(),
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue(null),
  run: vi.fn().mockResolvedValue(undefined),
}));

describe('presentations routes org guard', () => {
  it('returns 403 RBAC code when authenticated user has no organization', async () => {
    mockUser = {
      id: 'user-1',
      role: 'ADMIN',
      organizationId: '',
    };
    const { default: router } = await import('../../../../server/src/routes/presentations.routes.js');
    const app = express();
    app.use('/presentations', router);

    const res = await request(app).get('/presentations/templates');
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      error: 'Organization access required',
      code: 'RBAC_ORGANIZATION_ACCESS_REQUIRED',
    });
  });
});
