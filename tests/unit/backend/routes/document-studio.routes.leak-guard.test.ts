/**
 * H6.4 500-leak sweep (fala 3) — proof that document-studio.routes.ts no
 * longer echoes a raw, unexpected `err.message` to the client on the
 * template-approve error path.
 *
 * `approveTemplate` is a synchronous service function whose ONLY intended
 * throw surface is a short, controlled domain code (`template_not_found`,
 * `template_deprecated`) — see `documentTemplateService.ts`. Before the fix,
 * the route echoed `err.message` verbatim whenever `err instanceof Error`,
 * which is the common case for ANY exception, including a genuinely
 * unexpected one (a bug, a DB-driver error bubbling through a future
 * refactor, etc.). This test forces exactly that unexpected case and
 * proves the raw text never reaches the response body.
 *
 * Mocking pattern copied from the sibling
 * document-studio.routes.org-guard.test.ts (same directory).
 */
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

const mockUser = {
  id: 'user-1',
  role: 'ADMIN',
  organizationId: 'org-1',
};

vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = mockUser;
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    next();
  },
}));

const approveTemplate = vi.fn();
const deprecateTemplate = vi.fn();

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
  approveTemplate,
  deprecateTemplate,
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
  approveTemplate,
  deprecateTemplate,
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

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

async function buildApp() {
  const { default: router } =
    await import('../../../../server/src/routes/document-studio.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/document-studio', router);
  return app;
}

const RAW_LEAK_TEXT =
  'Cannot read properties of undefined (reading \'foo\'); duplicate key value violates unique constraint "doc_template_pk"';

describe('document-studio /templates/:templateId/approve — 500-leak guard', () => {
  it('does NOT echo a raw/unexpected exception message to the client', async () => {
    approveTemplate.mockImplementation(() => {
      throw new Error(RAW_LEAK_TEXT);
    });

    const app = await buildApp();
    const res = await request(app).post('/document-studio/templates/tmpl-1/approve').send({});

    expect([400, 404]).toContain(res.status);
    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain(RAW_LEAK_TEXT);
    expect(bodyText).not.toContain('duplicate key value');
    expect(['template_approve_failed', 'template_not_found']).toContain(res.body.error);
  });

  it('still passes through a known, safe domain code unchanged (no regression)', async () => {
    approveTemplate.mockImplementation(() => {
      throw new Error('template_not_found');
    });

    const app = await buildApp();
    const res = await request(app).post('/document-studio/templates/tmpl-missing/approve').send({});

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'template_not_found' });
  });

  it('deprecate route also sanitizes an unexpected message', async () => {
    deprecateTemplate.mockImplementation(() => {
      throw new Error(RAW_LEAK_TEXT);
    });

    const app = await buildApp();
    const res = await request(app).post('/document-studio/templates/tmpl-1/deprecate').send({});

    expect(res.status).toBe(400);
    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain(RAW_LEAK_TEXT);
    expect(res.body).toMatchObject({ error: 'template_deprecate_failed' });
  });
});
