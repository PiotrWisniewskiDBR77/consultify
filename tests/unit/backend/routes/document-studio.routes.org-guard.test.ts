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

vi.mock('../../../../server/src/services/documentStudio/documentStudioService.js', () => ({
  planDocument: vi.fn(),
  planDocumentAsync: vi.fn(),
  materializeDocumentArtifact: vi.fn(),
  getDocumentArtifact: vi.fn(),
  exportDocumentArtifact: vi.fn(),
  canOverrideQa: vi.fn(),
  ensureTemplateRegistryHydrated: vi.fn(),
  listTemplates: vi.fn(),
  getTemplate: vi.fn(),
  draftTemplate: vi.fn(),
  draftTemplateAsync: vi.fn(),
  approveTemplate: vi.fn(),
  deprecateTemplate: vi.fn(),
  listTemplateAuditEntries: vi.fn(),
  ensureSourcePackRegistryHydrated: vi.fn(),
  listSourcePacks: vi.fn(),
  draftSourcePack: vi.fn(),
  getSourcePack: vi.fn(),
  listSourcePackAuditEntries: vi.fn(),
  addSourcePackItem: vi.fn(),
  removeSourcePackItem: vi.fn(),
  markSourcePackReady: vi.fn(),
  archiveSourcePack: vi.fn(),
  attachSourcePackToDocument: vi.fn(),
  createDocumentFromChatSourcePack: vi.fn(),
  ensureDocumentLifecycleHydrated: vi.fn(),
  getDocumentLifecycleState: vi.fn(),
  transitionDocumentStatus: vi.fn(),
  ensureDocumentVersionSnapshotsHydrated: vi.fn(),
  listDocumentVersionSnapshots: vi.fn(),
  createDocumentSnapshot: vi.fn(),
  getDocumentVersionSnapshot: vi.fn(),
  rollbackDocumentToVersion: vi.fn(),
  ensureDocumentCommentsHydrated: vi.fn(),
  listDocumentComments: vi.fn(),
  listDocumentCommentThreads: vi.fn(),
  getDocumentCommentSectionCounts: vi.fn(),
  getDocumentComment: vi.fn(),
  createDocumentComment: vi.fn(),
  replyToDocumentComment: vi.fn(),
  resolveDocumentComment: vi.fn(),
  reopenDocumentComment: vi.fn(),
  deleteDocumentComment: vi.fn(),
  createGlobalEditProposal: vi.fn(),
  createSectionEditProposal: vi.fn(),
  createLocalEditProposal: vi.fn(),
  approveEditProposal: vi.fn(),
  rejectEditProposal: vi.fn(),
  listDocumentAuditEntries: vi.fn(),
  QaBlockingError: class QaBlockingError extends Error {},
  QaOverrideUnauthorizedError: class QaOverrideUnauthorizedError extends Error {},
  MissingRequiredSourceError: class MissingRequiredSourceError extends Error {},
  DocumentLifecycleTransitionError: class DocumentLifecycleTransitionError extends Error {},
  DocumentRollbackError: class DocumentRollbackError extends Error {},
  DocumentCommentError: class DocumentCommentError extends Error {},
  SourcePackConnectorError: class SourcePackConnectorError extends Error {},
}));

vi.mock('../../../../server/src/services/documentStudio/documentQaService.js', () => ({
  runDocumentQa: vi.fn(),
}));

vi.mock('../../../../server/src/services/documentStudio/documentTemplateService.js', () => ({
  ensureTemplateRegistryHydrated: vi.fn(),
  listTemplates: vi.fn(),
  getTemplate: vi.fn(),
  draftTemplate: vi.fn(),
  draftTemplateAsync: vi.fn(),
  approveTemplate: vi.fn(),
  deprecateTemplate: vi.fn(),
  listTemplateAuditEntries: vi.fn(),
}));

vi.mock('../../../../server/src/services/documentStudio/documentSourcePackService.js', () => ({
  ensureSourcePackRegistryHydrated: vi.fn(),
  listSourcePacks: vi.fn(),
  draftSourcePack: vi.fn(),
  getSourcePack: vi.fn(),
  listSourcePackAuditEntries: vi.fn(),
  addSourcePackItem: vi.fn(),
  removeSourcePackItem: vi.fn(),
  markSourcePackReady: vi.fn(),
  archiveSourcePack: vi.fn(),
  attachSourcePackToDocument: vi.fn(),
}));

vi.mock('../../../../server/src/services/documentStudio/documentSourcePackConnectors.js', () => ({
  ingestRawTextSource: vi.fn(),
  ingestUrlSource: vi.fn(),
  ingestFileSource: vi.fn(),
  ingestV8ArtifactSource: vi.fn(),
  ingestIntegrationSource: vi.fn(),
  SourcePackConnectorError: class SourcePackConnectorError extends Error {},
}));

describe('document-studio routes org guard', () => {
  it('returns 403 RBAC code when authenticated user has no organization', async () => {
    mockUser = {
      id: 'user-1',
      role: 'ADMIN',
      organizationId: '',
    };
    const { default: router } = await import(
      '../../../../server/src/routes/document-studio.routes.js'
    );
    const app = express();
    app.use(express.json());
    app.use('/document-studio', router);

    const res = await request(app).post('/document-studio/plan').send({ intake: { topic: 'test' } });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      error: 'Organization access required',
      code: 'RBAC_ORGANIZATION_ACCESS_REQUIRED',
    });
  });
});
