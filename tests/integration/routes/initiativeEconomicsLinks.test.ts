import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock services BEFORE importing the router
vi.mock('../../../server/src/services/v8/financeIntegrationService.js', () => ({
  getLinkagesByInitiative: vi.fn().mockResolvedValue([]),
  createEconomicsLinkage: vi.fn().mockResolvedValue({
    linkageId: 'lnk-1',
    initiativeId: 'init-1',
    financeModelRef: 'model-1',
    linkageType: 'financial_model',
    status: 'not_started',
    createdAt: '',
    updatedAt: '',
  }),
}));

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryOne: vi.fn().mockResolvedValue({ id: 'init-1' }),
  queryAll: vi.fn().mockResolvedValue([]),
  queryRun: vi.fn().mockResolvedValue({ changes: 1 }),
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => {
    next();
  },
  isAuthenticated: (_req: any, _res: any, next: any) => {
    next();
  },
}));

vi.mock('../../../server/src/middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: any) => {
    next();
  },
  requireOrgRole: () => (_req: any, _res: any, next: any) => {
    next();
  },
}));

vi.mock('../../../server/src/middleware/validation.middleware.js', () => ({
  validateBody: () => (_req: any, _res: any, next: any) => {
    next();
  },
}));

vi.mock('../../../server/src/middleware/permissionMiddleware.js', () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => {
    next();
  },
}));

// Additional mocks for other services imported by the router
vi.mock('../../../server/src/services/initiative/initiativeLineageService.js', () => ({
  getInitiativeFunnel: vi.fn().mockResolvedValue({}),
  getInitiativeLineage: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../server/src/services/initiative/proposeEngineService.js', () => ({
  proposeCandidates: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../server/src/services/initiative/portfolioMeceService.js', () => ({
  checkPortfolioMece: vi.fn().mockReturnValue({ isValid: true, overlaps: [], gaps: [] }),
}));

vi.mock('../../../server/src/services/initiative/suggestedChangesService.js', () => ({
  createSuggestedChange: vi.fn().mockResolvedValue({}),
  listSuggestedChanges: vi.fn().mockResolvedValue([]),
  resolveSuggestedChange: vi.fn().mockResolvedValue({}),
}));

import additivesRouter from '../../../server/src/routes/initiatives-additive.routes.js';
import { createEconomicsLinkage } from '../../../server/src/services/v8/financeIntegrationService.js';

const authState: { organizationId: string | null } = { organizationId: 'org-1' };

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = authState.organizationId
      ? { id: 'u-1', organizationId: authState.organizationId, role: 'ADMIN' }
      : undefined;
    next();
  });
  app.use('/api/initiatives', additivesRouter);
  return app;
}

describe('initiative economics-links routes (M16 integration)', () => {
  beforeEach(() => {
    authState.organizationId = 'org-1';
    vi.clearAllMocks();
  });

  it('POST /:initiativeId/economics-links returns 201 with linkage when initiative exists', async () => {
    const res = await request(createApp())
      .post('/api/initiatives/init-1/economics-links')
      .send({ financeModelRef: 'model-1', linkageType: 'financial_model', status: 'not_started' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('linkage');
    expect(res.body.linkage).toMatchObject({
      linkageId: 'lnk-1',
      financeModelRef: 'model-1',
      linkageType: 'financial_model',
    });
    expect(createEconomicsLinkage).toHaveBeenCalledWith({
      organizationId: 'org-1',
      initiativeId: 'init-1',
      financeModelRef: 'model-1',
      linkageType: 'forecast',
      status: 'not_started',
    });
  });

  it('POST /:initiativeId/economics-links returns 401 when no auth', async () => {
    authState.organizationId = null;

    const res = await request(createApp())
      .post('/api/initiatives/init-1/economics-links')
      .send({ financeModelRef: 'model-1' });

    expect(res.status).toBe(401);
  });

  it('GET /:initiativeId/economics-links returns 200 with links array when initiative exists', async () => {
    const res = await request(createApp()).get('/api/initiatives/init-1/economics-links');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('links');
    expect(Array.isArray(res.body.links)).toBe(true);
  });
});
