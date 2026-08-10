import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetV8Context = vi.fn();
const mockRequireOrgMember = vi.fn();
const mockRequireCaseAccess = vi.fn();
const mockCreateProcessDefinition = vi.fn();
const mockGetProcessDefinition = vi.fn();
const mockGetProcessVersion = vi.fn();
const mockPublishProcessVersion = vi.fn();
const mockListProcessDefinitions = vi.fn();

vi.mock('../../../middleware/v8Auth.middleware.js', () => ({
  getV8Context: (...args: unknown[]) => mockGetV8Context(...args),
}));

vi.mock('../../../services/caseWorkspace/caseWorkspaceAuthContext.js', async () => {
  const actual = await vi.importActual<typeof import('../../../services/caseWorkspace/caseWorkspaceAuthContext.js')>(
    '../../../services/caseWorkspace/caseWorkspaceAuthContext.js'
  );
  return {
    ...actual,
    requireOrgMember: (...args: unknown[]) => mockRequireOrgMember(...args),
    requireCaseAccess: (...args: unknown[]) => mockRequireCaseAccess(...args),
  };
});

vi.mock('../../../services/caseWorkspace/playService.js', () => ({
  createProcessDefinition: (...args: unknown[]) => mockCreateProcessDefinition(...args),
  getProcessDefinition: (...args: unknown[]) => mockGetProcessDefinition(...args),
  listProcessDefinitions: (...args: unknown[]) => mockListProcessDefinitions(...args),
  isAuthorizedPublisher: vi.fn(),
  shareProcessDefinition: vi.fn(),
  createProcessVersionDraft: vi.fn(),
  listProcessVersionsForDefinition: vi.fn(),
  getProcessVersion: (...args: unknown[]) => mockGetProcessVersion(...args),
  updateProcessVersionDraft: vi.fn(),
  proposeProcessVersion: vi.fn(),
  reviewProcessVersion: vi.fn(),
  publishProcessVersion: (...args: unknown[]) => mockPublishProcessVersion(...args),
  deprecateProcessVersion: vi.fn(),
  archiveProcessVersion: vi.fn(),
  instantiateProcessVersion: vi.fn(),
}));

import playRoutes from '../play.routes.js';
import { errorHandlerMiddleware } from '../../../utils/ErrorHandler.js';

const ORG = 'org-1';
const USER = 'user-1';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8/case-workspace', playRoutes);
  app.use(errorHandlerMiddleware);
  return app;
}

describe('caseWorkspace play (process definitions/versions) routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetV8Context.mockReturnValue({ organizationId: ORG, userId: USER, userRole: 'ADMIN', isSuperAdmin: false });
    mockRequireOrgMember.mockResolvedValue({ membershipId: 'm1', organizationId: ORG, userId: USER, role: 'ADMIN' });
    mockRequireCaseAccess.mockResolvedValue({ membershipId: 'm1', organizationId: ORG, userId: USER, role: 'ADMIN' });
  });

  it('rejects a create-process-definition body missing name with 400', async () => {
    const res = await request(createApp()).post('/api/v8/case-workspace/process-definitions').send({});
    expect(res.status).toBe(400);
    expect(mockCreateProcessDefinition).not.toHaveBeenCalled();
  });

  it('always forces organizationId to the authenticated actor org, defaults ownerActorId to the actor', async () => {
    mockCreateProcessDefinition.mockResolvedValue({ processDefinitionId: 'procdef-1', organizationId: ORG });
    const res = await request(createApp())
      .post('/api/v8/case-workspace/process-definitions')
      .send({ name: 'My Process', organizationId: 'attacker-org' });
    expect(res.status).toBe(201);
    expect(mockCreateProcessDefinition).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG, ownerActorId: USER, createdByActorId: USER })
    );
  });

  it('404s a cross-tenant process definition (enumeration-safe) instead of leaking existence via 403', async () => {
    mockGetProcessDefinition.mockResolvedValue({ processDefinitionId: 'procdef-1', organizationId: 'other-org' });
    const res = await request(createApp()).get('/api/v8/case-workspace/process-definitions/procdef-1');
    expect(res.status).toBe(404);
  });

  it('resolves a process version to its definition and 404s if the definition belongs to another org', async () => {
    mockGetProcessVersion.mockResolvedValue({ processVersionId: 'procv-1', processDefinitionId: 'procdef-1' });
    mockGetProcessDefinition.mockResolvedValue({ processDefinitionId: 'procdef-1', organizationId: 'other-org' });
    const res = await request(createApp())
      .post('/api/v8/case-workspace/process-versions/procv-1/publish')
      .send({ expectedVersion: 1 });
    expect(res.status).toBe(404);
    expect(mockPublishProcessVersion).not.toHaveBeenCalled();
  });

  it('maps process_version_publish_requires_review to 409', async () => {
    mockGetProcessVersion.mockResolvedValue({ processVersionId: 'procv-1', processDefinitionId: 'procdef-1' });
    mockGetProcessDefinition.mockResolvedValue({ processDefinitionId: 'procdef-1', organizationId: ORG });
    mockPublishProcessVersion.mockRejectedValue(new Error('process_version_publish_requires_review'));
    const res = await request(createApp())
      .post('/api/v8/case-workspace/process-versions/procv-1/publish')
      .send({ expectedVersion: 1 });
    expect(res.status).toBe(409);
  });

  it('lists process definitions with native cursor pagination fields', async () => {
    mockListProcessDefinitions.mockResolvedValue({ items: [], nextCursor: null });
    const res = await request(createApp()).get('/api/v8/case-workspace/process-definitions');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], nextCursor: null });
    expect(mockListProcessDefinitions).toHaveBeenCalledWith(ORG, expect.any(Object), expect.any(Object), USER);
  });
});
