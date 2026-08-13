import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetV8Context = vi.fn();
const mockRequireCaseAccess = vi.fn();
const mockBindRunToPlanVersion = vi.fn();
const mockGetRunBinding = vi.fn();
const mockListRunBindingsForCase = vi.fn();
const mockGetPlanVersion = vi.fn();

vi.mock('../../../middleware/v8Auth.middleware.js', () => ({
  getV8Context: (...args: unknown[]) => mockGetV8Context(...args),
}));

vi.mock('../../../services/caseWorkspace/caseWorkspaceAuthContext.js', async () => {
  const actual = await vi.importActual<typeof import('../../../services/caseWorkspace/caseWorkspaceAuthContext.js')>(
    '../../../services/caseWorkspace/caseWorkspaceAuthContext.js'
  );
  return { ...actual, requireCaseAccess: (...args: unknown[]) => mockRequireCaseAccess(...args) };
});

vi.mock('../../../services/caseWorkspace/runBindingService.js', () => ({
  bindRunToPlanVersion: (...args: unknown[]) => mockBindRunToPlanVersion(...args),
  getRunBinding: (...args: unknown[]) => mockGetRunBinding(...args),
  listRunBindingsForCase: (...args: unknown[]) => mockListRunBindingsForCase(...args),
  listRunBindingsForPlanVersion: vi.fn(),
}));

vi.mock('../../../services/caseWorkspace/casePlanVersionService.js', () => ({
  getPlanVersion: (...args: unknown[]) => mockGetPlanVersion(...args),
}));

import runBindingsRoutes from '../runBindings.routes.js';
import { errorHandlerMiddleware } from '../../../utils/ErrorHandler.js';

const ORG = 'org-1';
const USER = 'user-1';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8/case-workspace', runBindingsRoutes);
  app.use(errorHandlerMiddleware);
  return app;
}

describe('caseWorkspace run-binding routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetV8Context.mockReturnValue({ organizationId: ORG, userId: USER, userRole: 'ADMIN', isSuperAdmin: false });
    mockRequireCaseAccess.mockResolvedValue({ membershipId: 'm1', organizationId: ORG, userId: USER, role: 'ADMIN' });
  });

  it('rejects a bind-run body missing casePlanVersionId with 400', async () => {
    const res = await request(createApp())
      .post('/api/v8/case-workspace/run-bindings')
      .send({ runId: 'run-1' });
    expect(res.status).toBe(400);
    expect(mockBindRunToPlanVersion).not.toHaveBeenCalled();
  });

  it('resolves the owning caseId via casePlanVersionService before binding, and checks access', async () => {
    mockGetPlanVersion.mockResolvedValue({ casePlanVersionId: 'planv-1', caseId: 'case-1' });
    mockBindRunToPlanVersion.mockResolvedValue({ runId: 'run-1', caseId: 'case-1' });
    const res = await request(createApp())
      .post('/api/v8/case-workspace/run-bindings')
      .send({ runId: 'run-1', casePlanVersionId: 'planv-1' });
    expect(res.status).toBe(201);
    expect(mockRequireCaseAccess).toHaveBeenCalledWith(USER, 'case-1');
  });

  it('404s when the referenced plan version does not exist, before calling bindRunToPlanVersion', async () => {
    mockGetPlanVersion.mockResolvedValue(null);
    const res = await request(createApp())
      .post('/api/v8/case-workspace/run-bindings')
      .send({ runId: 'run-1', casePlanVersionId: 'planv-missing' });
    expect(res.status).toBe(404);
    expect(mockBindRunToPlanVersion).not.toHaveBeenCalled();
  });

  it('maps run_already_bound to 409', async () => {
    mockGetPlanVersion.mockResolvedValue({ casePlanVersionId: 'planv-1', caseId: 'case-1' });
    mockBindRunToPlanVersion.mockRejectedValue(new Error('run_already_bound'));
    const res = await request(createApp())
      .post('/api/v8/case-workspace/run-bindings')
      .send({ runId: 'run-1', casePlanVersionId: 'planv-1' });
    expect(res.status).toBe(409);
  });

  it('checks case access using the found binding before returning getRunBinding by id', async () => {
    mockGetRunBinding.mockResolvedValue({ runId: 'run-1', caseId: 'case-1' });
    const res = await request(createApp()).get('/api/v8/case-workspace/run-bindings/run-1');
    expect(res.status).toBe(200);
    expect(mockRequireCaseAccess).toHaveBeenCalledWith(USER, 'case-1');
  });

  it('404s getRunBinding for a run with no binding', async () => {
    mockGetRunBinding.mockResolvedValue(null);
    const res = await request(createApp()).get('/api/v8/case-workspace/run-bindings/run-missing');
    expect(res.status).toBe(404);
  });
});
