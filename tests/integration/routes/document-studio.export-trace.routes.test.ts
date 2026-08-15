import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const exportDocumentArtifactMock = vi.fn();
const recordCompletedExportMock = vi.fn();
const recordFailedExportMock = vi.fn();

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'u-1', organizationId: 'org-1', role: 'owner' };
    req.userId = 'u-1';
    req.organizationId = 'org-1';
    next();
  },
}));

vi.mock('../../../server/src/middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../server/src/services/documentStudio/documentStudioService.js', () => ({
  ensureTemplateRegistryHydrated: vi.fn(),
  ensureDocumentVersionSnapshotsHydrated: vi.fn(),
  ensureDocumentCommentsHydrated: vi.fn(),
  ensureSourcePackRegistryHydrated: vi.fn(),
  ensureDocumentLifecycleHydrated: vi.fn(),
  exportDocumentArtifact: (...args: any[]) => exportDocumentArtifactMock(...args),
  getDocumentArtifact: vi.fn(),
  planDocument: vi.fn(),
  planDocumentAsync: vi.fn(),
  materializeDocumentArtifact: vi.fn(),
  listDocumentAuditEntries: vi.fn().mockResolvedValue([]),
  runDocumentQa: vi.fn(),
  listDocumentComments: vi.fn(),
  listDocumentCommentThreads: vi.fn(),
  getDocumentCommentSectionCounts: vi.fn(),
  getDocumentComment: vi.fn(),
  createDocumentComment: vi.fn(),
  replyToDocumentComment: vi.fn(),
  resolveDocumentComment: vi.fn(),
  reopenDocumentComment: vi.fn(),
  deleteDocumentComment: vi.fn(),
  listDocumentVersionSnapshots: vi.fn(),
  getDocumentVersionSnapshot: vi.fn(),
  transitionDocumentStatus: vi.fn(),
  rollbackDocumentToVersion: vi.fn(),
  getDocumentLifecycleState: vi.fn(),
  QaOverrideUnauthorizedError: class QaOverrideUnauthorizedError extends Error {
    role = '';
  },
  QaBlockingError: class QaBlockingError extends Error {
    report: unknown = {};
  },
  MissingRequiredSourceError: class MissingRequiredSourceError extends Error {},
  DocumentCommentError: class DocumentCommentError extends Error {
    code = 'unknown';
  },
}));

vi.mock('../../../server/src/services/documentStudio/documentTemplateService.js', () => ({
  ensureTemplateRegistryHydrated: vi.fn(),
  listTemplates: vi.fn().mockResolvedValue([]),
  draftTemplate: vi.fn(),
  draftTemplateAsync: vi.fn(),
  getTemplate: vi.fn(),
  approveTemplate: vi.fn(),
  deprecateTemplate: vi.fn(),
  listTemplateAuditEntries: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../server/src/services/documentStudio/documentSourcePackRegistry.js', () => ({
  ensureSourcePackRegistryHydrated: vi.fn(),
  draftSourcePack: vi.fn(),
  listSourcePacks: vi.fn().mockResolvedValue([]),
  getSourcePack: vi.fn(),
  listSourcePackAuditEntries: vi.fn().mockResolvedValue([]),
  addSourcePackItem: vi.fn(),
  removeSourcePackItem: vi.fn(),
  markSourcePackReady: vi.fn(),
  archiveSourcePack: vi.fn(),
  attachSourcePackToDocument: vi.fn(),
  getSourcePackStatus: vi.fn(),
  setSourcePackStatus: vi.fn(),
  updateSourcePackItemStatus: vi.fn(),
}));

vi.mock('../../../server/src/services/documentStudio/documentSourcePackConnectors.js', () => ({
  ingestRawTextSource: vi.fn(),
  ingestUrlSource: vi.fn(),
  ingestFileSource: vi.fn(),
  ingestV8ArtifactSource: vi.fn(),
  ingestIntegrationSource: vi.fn(),
  SourcePackConnectorError: class SourcePackConnectorError extends Error {},
}));

vi.mock('../../../server/src/services/documentStudio/documentEditProposalService.js', () => ({
  createLocalEditProposal: vi.fn(),
  createSectionRewriteProposal: vi.fn(),
  createGlobalRewriteProposal: vi.fn(),
  listDocumentEditProposals: vi.fn().mockResolvedValue([]),
  applyEditProposal: vi.fn(),
  rejectEditProposal: vi.fn(),
}));

vi.mock('../../../server/src/services/v8/reportsPresModelService.js', () => ({
  recordCompletedExport: (...args: any[]) => recordCompletedExportMock(...args),
  recordFailedExport: (...args: any[]) => recordFailedExportMock(...args),
}));

vi.mock('../../../server/src/services/lineage/artifactLineageService.js', () => ({
  deriveCreatedEventIdempotencyKey: vi.fn(() => 'created-key'),
  deriveRequestBoundIdempotencyKey: vi.fn(() => 'request-key'),
  recordLineageEventSafe: vi.fn().mockResolvedValue({ durable: true }),
  recordLineageEventTracked: vi.fn().mockResolvedValue({ durable: true }),
}));

vi.mock('../../../server/src/services/documentStudio/documentQaService.js', () => ({
  runDocumentQa: vi.fn(),
}));

import documentStudioRouter from '../../../server/src/routes/document-studio.routes.js';

describe('document-studio export trace parity', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/document-studio', documentStudioRouter);

  beforeEach(() => {
    vi.clearAllMocks();
    exportDocumentArtifactMock.mockResolvedValue({ ok: true, format: 'docx' });
    recordCompletedExportMock.mockResolvedValue(undefined);
    recordFailedExportMock.mockResolvedValue(undefined);
  });

  it('records completed export trace for docx export success', async () => {
    const res = await request(app).get('/api/document-studio/artifact-1/export/docx');

    expect(res.status).toBe(200);
    expect(recordCompletedExportMock).toHaveBeenCalledWith('artifact-1', 'org-1', 'docx', 'u-1');
  });

  it('records failed export trace for pdf export failure', async () => {
    exportDocumentArtifactMock.mockRejectedValueOnce(new Error('boom'));

    const res = await request(app).get('/api/document-studio/artifact-1/export/pdf');

    expect(res.status).toBe(500);
    expect(recordFailedExportMock).toHaveBeenCalledWith('artifact-1', 'org-1', 'pdf', 'u-1');
  });
});
