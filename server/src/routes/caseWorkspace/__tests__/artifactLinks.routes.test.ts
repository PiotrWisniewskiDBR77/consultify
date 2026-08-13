import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetV8Context = vi.fn();
const mockRequireCaseAccess = vi.fn();
const mockLinkArtifactToCase = vi.fn();
const mockGetArtifactLink = vi.fn();
const mockUnlinkArtifactFromCase = vi.fn();
const mockListArtifactLinksForCase = vi.fn();

vi.mock('../../../middleware/v8Auth.middleware.js', () => ({
  getV8Context: (...args: unknown[]) => mockGetV8Context(...args),
}));

vi.mock('../../../services/caseWorkspace/caseWorkspaceAuthContext.js', async () => {
  const actual = await vi.importActual<typeof import('../../../services/caseWorkspace/caseWorkspaceAuthContext.js')>(
    '../../../services/caseWorkspace/caseWorkspaceAuthContext.js'
  );
  return { ...actual, requireCaseAccess: (...args: unknown[]) => mockRequireCaseAccess(...args) };
});

vi.mock('../../../services/caseWorkspace/artifactLinkService.js', () => ({
  linkArtifactToCase: (...args: unknown[]) => mockLinkArtifactToCase(...args),
  pinArtifactRevision: vi.fn(),
  markLinkStale: vi.fn(),
  markLinkArtifactUnavailable: vi.fn(),
  unlinkArtifactFromCase: (...args: unknown[]) => mockUnlinkArtifactFromCase(...args),
  getArtifactLink: (...args: unknown[]) => mockGetArtifactLink(...args),
  listArtifactLinksForCase: (...args: unknown[]) => mockListArtifactLinksForCase(...args),
  computeArtifactLinkSetDigest: vi.fn(),
}));

import artifactLinksRoutes from '../artifactLinks.routes.js';
import { errorHandlerMiddleware } from '../../../utils/ErrorHandler.js';

const ORG = 'org-1';
const USER = 'user-1';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/v8/case-workspace', artifactLinksRoutes);
  app.use(errorHandlerMiddleware);
  return app;
}

describe('caseWorkspace artifact-link routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetV8Context.mockReturnValue({ organizationId: ORG, userId: USER, userRole: 'ADMIN', isSuperAdmin: false });
    mockRequireCaseAccess.mockResolvedValue({ membershipId: 'm1', organizationId: ORG, userId: USER, role: 'ADMIN' });
  });

  it('rejects a link-artifact body with an invalid relation enum with 400', async () => {
    const res = await request(createApp())
      .post('/api/v8/case-workspace/cases/case-1/artifact-links')
      .send({ artifactType: 'document', artifactId: 'doc-1', relation: 'NOT_A_RELATION' });
    expect(res.status).toBe(400);
    expect(mockLinkArtifactToCase).not.toHaveBeenCalled();
  });

  it('checks case access before linking an artifact', async () => {
    mockLinkArtifactToCase.mockResolvedValue({ linkId: 'link-1', caseId: 'case-1' });
    const res = await request(createApp())
      .post('/api/v8/case-workspace/cases/case-1/artifact-links')
      .send({ artifactType: 'document', artifactId: 'doc-1', relation: 'EVIDENCE' });
    expect(res.status).toBe(201);
    expect(mockRequireCaseAccess).toHaveBeenCalledWith(USER, 'case-1');
  });

  it('resolves the owning caseId via getArtifactLink before authorizing unlink, and 404s when missing', async () => {
    mockGetArtifactLink.mockResolvedValue(null);
    const res = await request(createApp()).delete('/api/v8/case-workspace/artifact-links/link-missing').send({});
    expect(res.status).toBe(404);
    expect(mockUnlinkArtifactFromCase).not.toHaveBeenCalled();
  });

  it('maps artifact_link_not_active to 409 on unlink of an already-unlinked link', async () => {
    mockGetArtifactLink.mockResolvedValue({ linkId: 'link-1', caseId: 'case-1' });
    mockUnlinkArtifactFromCase.mockRejectedValue(new Error('artifact_link_not_active'));
    const res = await request(createApp()).delete('/api/v8/case-workspace/artifact-links/link-1').send({});
    expect(res.status).toBe(409);
  });

  it('checks case access before listing artifact links for a case', async () => {
    mockListArtifactLinksForCase.mockResolvedValue([]);
    const res = await request(createApp()).get('/api/v8/case-workspace/cases/case-1/artifact-links');
    expect(res.status).toBe(200);
    expect(mockRequireCaseAccess).toHaveBeenCalledWith(USER, 'case-1');
  });
});
