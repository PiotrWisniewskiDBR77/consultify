/** @vitest-environment node */

/**
 * WORD clone mode — `POST /api/document-studio/templates/from-artifact/:artifactId`.
 *
 * Route-level coverage for the CLONE endpoint added per brief §1/§10
 * ("Komplet od razu"): saves an existing native-artifact document as a new
 * draft template (clone → edit → save-as-new). Companion service-level
 * suite: `../../services/documentStudio/__tests__/documentTemplateService.createTemplateFromArtifact.test.ts`.
 *
 * `getDocumentArtifact` (documentStudioService) is mocked directly rather
 * than materializing a real wave5 artifact row — it is already the
 * org-scoped read used by every other `:artifactId` route in this file
 * (variants, lifecycle, comments, …), so re-testing its own tenant
 * isolation here would duplicate coverage instead of testing the new
 * clone-mapping logic.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentSchema } from '../../services/documentStudio/documentStudioTypes.js';

const mockDbAll = vi.fn();
const mockDbRun = vi.fn();
const mockDbGet = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
}));

const mockGetDocumentArtifact = vi.fn();

vi.mock('../../services/documentStudio/documentStudioService.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../services/documentStudio/documentStudioService.js')>();
  return {
    ...actual,
    getDocumentArtifact: (...args: unknown[]) => mockGetDocumentArtifact(...args),
  };
});

let mockUser: { id: string; organizationId: string; role: string } | null = null;

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    if (mockUser) {
      req.userId = mockUser.id;
      req.userRole = mockUser.role;
      req.organizationId = mockUser.organizationId;
      req.user = mockUser;
    }
    next();
  },
}));

vi.mock('../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
}));

import { __resetTemplateRegistryForTests } from '../../services/documentStudio/documentTemplateService.js';
import documentStudioRoutes from '../document-studio.routes.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/document-studio', documentStudioRoutes);
  return app;
}

const ORG = 'org-1';
const USER = 'user-1';

function asUser(): void {
  mockUser = { id: USER, organizationId: ORG, role: 'MEMBER' };
}

function buildSourceSchema(overrides: Partial<DocumentSchema> = {}): DocumentSchema {
  return {
    documentId: 'doc-1',
    artifactId: 'artifact-1',
    title: 'Raport dla Zarządu',
    documentType: 'board_report',
    language: 'pl',
    audience: ['board'],
    goal: 'inform',
    communicationRegister: 'executive',
    density: 'standard',
    languageStyle: 'consulting',
    confidentiality: 'internal',
    formattingSchema: {} as DocumentSchema['formattingSchema'],
    sections: [
      {
        sectionId: 'sec-1',
        orderIndex: 0,
        level: 1,
        title: 'Podsumowanie zarządcze',
        purpose: 'Streszczenie kluczowych wniosków',
        blocks: [
          { blockId: 'b1', type: 'paragraph', content: 'x' },
          { blockId: 'b2', type: 'paragraph', content: 'y' },
        ],
        sourceRefs: [],
      },
      {
        sectionId: 'sec-2',
        orderIndex: 1,
        level: 1,
        title: 'Rekomendacje',
        blocks: [{ blockId: 'b3', type: 'paragraph', content: 'z' }],
        sourceRefs: [],
      },
    ],
    sourceRefs: [],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  } as DocumentSchema;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDbAll.mockResolvedValue([]);
  mockDbRun.mockResolvedValue({ rowCount: 0, success: true });
  mockDbGet.mockResolvedValue(null);
  __resetTemplateRegistryForTests();
  mockUser = null;
});

describe('POST /templates/from-artifact/:artifactId', () => {
  it('401 when unauthenticated', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/document-studio/templates/from-artifact/artifact-1')
      .send({});
    expect(res.status).toBe(401);
  });

  it('404 document_not_found when the source artifact does not resolve for this tenant', async () => {
    const app = createApp();
    asUser();
    mockGetDocumentArtifact.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/document-studio/templates/from-artifact/does-not-exist')
      .send({});
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('document_not_found');
  });

  it('reads the source artifact scoped to the caller org', async () => {
    const app = createApp();
    asUser();
    mockGetDocumentArtifact.mockResolvedValue(buildSourceSchema());
    await request(app).post('/api/document-studio/templates/from-artifact/artifact-1').send({});
    expect(mockGetDocumentArtifact).toHaveBeenCalledWith('artifact-1', ORG);
  });

  it('201 clones the document sections into sectionBlueprint and defaults the name to "<title> (Copy)"', async () => {
    const app = createApp();
    asUser();
    mockGetDocumentArtifact.mockResolvedValue(buildSourceSchema());

    const res = await request(app)
      .post('/api/document-studio/templates/from-artifact/artifact-1')
      .send({});

    expect(res.status).toBe(201);
    const template = res.body.template;
    expect(template.name).toBe('Raport dla Zarządu (Copy)');
    expect(template.organizationId).toBe(ORG);
    expect(template.status).toBe('draft');
    expect(template.documentType).toBe('board_report');
    expect(template.language).toBe('pl');
    expect(template.sectionBlueprint).toHaveLength(2);
    expect(template.sectionBlueprint[0]).toMatchObject({
      title: 'Podsumowanie zarządcze',
      level: 1,
      purpose: 'Streszczenie kluczowych wniosków',
    });
    expect(template.sectionBlueprint[1]).toMatchObject({
      title: 'Rekomendacje',
      // no explicit purpose on the source section → falls back to the title
      purpose: 'Rekomendacje',
    });
  });

  it('honors an explicit name override in the request body', async () => {
    const app = createApp();
    asUser();
    mockGetDocumentArtifact.mockResolvedValue(buildSourceSchema());

    const res = await request(app)
      .post('/api/document-studio/templates/from-artifact/artifact-1')
      .send({ name: 'Custom template name' });

    expect(res.status).toBe(201);
    expect(res.body.template.name).toBe('Custom template name');
  });

  it('the cloned draft template is immediately readable via GET /templates/:templateId', async () => {
    const app = createApp();
    asUser();
    mockGetDocumentArtifact.mockResolvedValue(buildSourceSchema());

    const cloneRes = await request(app)
      .post('/api/document-studio/templates/from-artifact/artifact-1')
      .send({});
    expect(cloneRes.status).toBe(201);
    const templateId = cloneRes.body.template.templateId as string;

    const getRes = await request(app).get(`/api/document-studio/templates/${templateId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.template.templateId).toBe(templateId);
  });
});
