import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetV8Context = vi.fn();
const mockRequireCaseAccess = vi.fn();
const mockRequireOrgMember = vi.fn();
const mockCreateCase = vi.fn();
const mockGetCase = vi.fn();
const mockListCasesForOrganization = vi.fn();
const mockTransitionStatus = vi.fn();
const mockCancelCase = vi.fn();

vi.mock('../../../middleware/v8Auth.middleware.js', () => ({
  getV8Context: (...args: unknown[]) => mockGetV8Context(...args),
}));

vi.mock('../../../services/caseWorkspace/caseWorkspaceAuthContext.js', async () => {
  const actual = await vi.importActual<typeof import('../../../services/caseWorkspace/caseWorkspaceAuthContext.js')>(
    '../../../services/caseWorkspace/caseWorkspaceAuthContext.js'
  );
  return {
    ...actual,
    requireCaseAccess: (...args: unknown[]) => mockRequireCaseAccess(...args),
    requireOrgMember: (...args: unknown[]) => mockRequireOrgMember(...args),
    requireOrgRole: vi.fn(),
  };
});

vi.mock('../../../services/caseWorkspace/caseCoreService.js', () => ({
  createCase: (...args: unknown[]) => mockCreateCase(...args),
  getCase: (...args: unknown[]) => mockGetCase(...args),
  listCasesForOrganization: (...args: unknown[]) => mockListCasesForOrganization(...args),
  transitionStatus: (...args: unknown[]) => mockTransitionStatus(...args),
  updateGovernanceTier: vi.fn(),
  updateAutonomyPolicy: vi.fn(),
  updateClosureAxisStatus: vi.fn(),
  recordClosure: vi.fn(),
  cancelCase: (...args: unknown[]) => mockCancelCase(...args),
}));

import casesRoutes from '../cases.routes.js';
import { errorHandlerMiddleware } from '../../../utils/ErrorHandler.js';
import { CaseWorkspaceAuthError } from '../../../services/caseWorkspace/caseWorkspaceAuthContext.js';

const ORG = 'org-1';
const USER = 'user-1';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.get = (name: string) => req.headers[name.toLowerCase()];
    next();
  });
  app.use('/api/v8/case-workspace', casesRoutes);
  app.use(errorHandlerMiddleware);
  return app;
}

describe('caseWorkspace cases routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetV8Context.mockReturnValue({ organizationId: ORG, userId: USER, userRole: 'ADMIN', isSuperAdmin: false });
    mockRequireOrgMember.mockResolvedValue({ membershipId: 'm1', organizationId: ORG, userId: USER, role: 'ADMIN' });
    mockRequireCaseAccess.mockResolvedValue({ membershipId: 'm1', organizationId: ORG, userId: USER, role: 'ADMIN' });
  });

  it('rejects a create-case body missing required fields with 400', async () => {
    const res = await request(createApp()).post('/api/v8/case-workspace/cases').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockCreateCase).not.toHaveBeenCalled();
  });

  it('never forwards a body-supplied organizationId to the service — always uses the authenticated org', async () => {
    mockCreateCase.mockResolvedValue({ caseId: 'case-1', organizationId: ORG });
    const res = await request(createApp())
      .post('/api/v8/case-workspace/cases')
      .send({
        projectId: 'proj-1',
        contractedClosureType: 'DELIVERY_COMPLETED',
        organizationId: 'attacker-org', // must be ignored
      });
    expect(res.status).toBe(201);
    expect(mockCreateCase).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG, createdByActorId: USER })
    );
  });

  it('maps CaseWorkspaceAuthError case_access_denied to 404, never 403 (enumeration-safe)', async () => {
    mockRequireCaseAccess.mockRejectedValue(
      new CaseWorkspaceAuthError('case_access_denied', 'Access to this case is denied.')
    );
    const res = await request(createApp()).get('/api/v8/case-workspace/cases/case-other-tenant');
    expect(res.status).toBe(404);
    expect(mockGetCase).not.toHaveBeenCalled();
  });

  it('maps a not_org_member auth failure to 403', async () => {
    mockRequireOrgMember.mockRejectedValue(new CaseWorkspaceAuthError('not_org_member', 'not a member'));
    const res = await request(createApp()).get('/api/v8/case-workspace/cases');
    expect(res.status).toBe(403);
  });

  it('maps a domain case_version_conflict error to 409', async () => {
    mockTransitionStatus.mockRejectedValue(new Error('case_version_conflict'));
    const res = await request(createApp())
      .post('/api/v8/case-workspace/cases/case-1/status')
      .send({ targetStatus: 'ACTIVE' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CASE_VERSION_CONFLICT');
  });

  it('maps a domain case_not_found error to 404', async () => {
    mockGetCase.mockResolvedValue(null);
    const res = await request(createApp()).get('/api/v8/case-workspace/cases/case-missing');
    expect(res.status).toBe(404);
  });

  it('returns 200 with the case list on a valid authenticated request', async () => {
    mockListCasesForOrganization.mockResolvedValue([{ caseId: 'case-1', organizationId: ORG }]);
    const res = await request(createApp()).get('/api/v8/case-workspace/cases');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(mockListCasesForOrganization).toHaveBeenCalledWith(ORG, {}, USER);
  });

  it('rejects an invalid enum query param with 400', async () => {
    const res = await request(createApp()).get('/api/v8/case-workspace/cases').query({ caseStatus: 'NOT_A_STATUS' });
    expect(res.status).toBe(400);
  });

  it('rejects a cancel-case call missing reason with 400 before calling the service', async () => {
    const res = await request(createApp()).post('/api/v8/case-workspace/cases/case-1/cancel').send({});
    expect(res.status).toBe(400);
    expect(mockCancelCase).not.toHaveBeenCalled();
  });
});
