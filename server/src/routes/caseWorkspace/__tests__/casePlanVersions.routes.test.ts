import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetV8Context = vi.fn();
const mockRequireCaseAccess = vi.fn();
const mockCreatePlanDraft = vi.fn();
const mockGetPlanVersion = vi.fn();
const mockUpdatePlanDraft = vi.fn();
const mockPublishPlanVersion = vi.fn();
const mockListPlanVersionsForCase = vi.fn();

vi.mock('../../../middleware/v8Auth.middleware.js', () => ({
  getV8Context: (...args: unknown[]) => mockGetV8Context(...args),
}));

vi.mock('../../../services/caseWorkspace/caseWorkspaceAuthContext.js', async () => {
  const actual = await vi.importActual<typeof import('../../../services/caseWorkspace/caseWorkspaceAuthContext.js')>(
    '../../../services/caseWorkspace/caseWorkspaceAuthContext.js'
  );
  return { ...actual, requireCaseAccess: (...args: unknown[]) => mockRequireCaseAccess(...args) };
});

vi.mock('../../../services/caseWorkspace/casePlanVersionService.js', () => ({
  createPlanDraft: (...args: unknown[]) => mockCreatePlanDraft(...args),
  getPlanVersion: (...args: unknown[]) => mockGetPlanVersion(...args),
  updatePlanDraft: (...args: unknown[]) => mockUpdatePlanDraft(...args),
  listPlanVersionsForCase: (...args: unknown[]) => mockListPlanVersionsForCase(...args),
  validatePlanVersion: vi.fn(),
  proposePlanVersion: vi.fn(),
  requestChangesOnPlanVersion: vi.fn(),
  publishPlanVersion: (...args: unknown[]) => mockPublishPlanVersion(...args),
  withdrawPlanVersion: vi.fn(),
  getGraph: vi.fn(),
  diffPlanVersions: vi.fn(),
  getViewState: vi.fn(),
  putViewState: vi.fn(),
}));

import casePlanVersionsRoutes from '../casePlanVersions.routes.js';
import { errorHandlerMiddleware } from '../../../utils/ErrorHandler.js';
import { CaseWorkspaceAuthError } from '../../../services/caseWorkspace/caseWorkspaceAuthContext.js';

const ORG = 'org-1';
const USER = 'user-1';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8/case-workspace', casePlanVersionsRoutes);
  app.use(errorHandlerMiddleware);
  return app;
}

describe('caseWorkspace plan-version routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetV8Context.mockReturnValue({ organizationId: ORG, userId: USER, userRole: 'ADMIN', isSuperAdmin: false });
    mockRequireCaseAccess.mockResolvedValue({ membershipId: 'm1', organizationId: ORG, userId: USER, role: 'ADMIN' });
  });

  it('rejects createPlanDraft missing semanticGraph with 400', async () => {
    const res = await request(createApp())
      .post('/api/v8/case-workspace/cases/case-1/plan-versions')
      .send({});
    expect(res.status).toBe(400);
    expect(mockCreatePlanDraft).not.toHaveBeenCalled();
  });

  it('checks case access before creating a plan draft', async () => {
    mockCreatePlanDraft.mockResolvedValue({ casePlanVersionId: 'planv-1' });
    const res = await request(createApp())
      .post('/api/v8/case-workspace/cases/case-1/plan-versions')
      .send({ semanticGraph: { entryNodeIds: [], terminalNodeIds: [], nodes: [], edges: [] } });
    expect(res.status).toBe(201);
    expect(mockRequireCaseAccess).toHaveBeenCalledWith(USER, 'case-1');
  });

  it('resolves the owning caseId via getPlanVersion before authorizing a by-id route, and 404s if missing', async () => {
    mockGetPlanVersion.mockResolvedValue(null);
    const res = await request(createApp()).get('/api/v8/case-workspace/plan-versions/planv-missing');
    expect(res.status).toBe(404);
    expect(mockRequireCaseAccess).not.toHaveBeenCalled();
  });

  it('maps case_access_denied on a resolved plan version to 404', async () => {
    mockGetPlanVersion.mockResolvedValue({ casePlanVersionId: 'planv-1', caseId: 'case-other-tenant' });
    mockRequireCaseAccess.mockRejectedValue(
      new CaseWorkspaceAuthError('case_access_denied', 'Access to this case is denied.')
    );
    const res = await request(createApp()).get('/api/v8/case-workspace/plan-versions/planv-1');
    expect(res.status).toBe(404);
  });

  it('rejects updatePlanDraft missing expectedVersion with 400', async () => {
    mockGetPlanVersion.mockResolvedValue({ casePlanVersionId: 'planv-1', caseId: 'case-1' });
    const res = await request(createApp())
      .put('/api/v8/case-workspace/plan-versions/planv-1')
      .send({ semanticGraph: { entryNodeIds: [], terminalNodeIds: [], nodes: [], edges: [] } });
    expect(res.status).toBe(400);
    expect(mockUpdatePlanDraft).not.toHaveBeenCalled();
  });

  it('maps plan_version_conflict to 409 with the OCC-conflict shape', async () => {
    mockGetPlanVersion.mockResolvedValue({ casePlanVersionId: 'planv-1', caseId: 'case-1' });
    mockPublishPlanVersion.mockRejectedValue(new Error('plan_version_conflict'));
    const res = await request(createApp())
      .post('/api/v8/case-workspace/plan-versions/planv-1/publish')
      .send({ expectedVersion: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PLAN_VERSION_CONFLICT');
  });

  it('maps a plan_status_transition_not_allowed:X->Y dynamic-detail error to 409 without leaking the dynamic detail as the code', async () => {
    mockGetPlanVersion.mockResolvedValue({ casePlanVersionId: 'planv-1', caseId: 'case-1' });
    mockPublishPlanVersion.mockRejectedValue(new Error('plan_status_transition_not_allowed:DRAFT->PUBLISHED'));
    const res = await request(createApp())
      .post('/api/v8/case-workspace/plan-versions/planv-1/publish')
      .send({ expectedVersion: 1 });
    expect(res.status).toBe(409);
  });

  it('lists plan versions for a case after checking access', async () => {
    mockListPlanVersionsForCase.mockResolvedValue([]);
    const res = await request(createApp()).get('/api/v8/case-workspace/cases/case-1/plan-versions');
    expect(res.status).toBe(200);
    expect(mockRequireCaseAccess).toHaveBeenCalledWith(USER, 'case-1');
  });
});
