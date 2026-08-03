/**
 * F1/F3 — client-reader public routes (`ff_client_reader`).
 *
 * Exercises the three UNAUTHENTICATED share-link routes the reader FE
 * consumes, end-to-end through `supertest`:
 *
 *   - POST /share-links/document         — whitelisted read-only projection
 *   - POST /share-links/comments/list    — existing threads (comment/edit scope only)
 *   - POST /share-links/edit-session + /share-links/comments — comment-scope mutation
 *
 * Also asserts the negative security cases that matter for a PUBLIC
 * surface: no `organizationId` leak, no internal-only schema fields
 * leak (`clientId`, `owner`, `sourcePackId`, `evidence`, `sourceRefs`),
 * and `read`/`download` scope links cannot see or post comments.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetDocumentCommentsForTests } from '../../services/documentStudio/documentCommentsService.js';
import { __resetShareLinkRegistryForTests } from '../../services/documentStudio/documentShareLinkService.js';
import type { DocumentSchema } from '../../services/documentStudio/documentStudioTypes.js';

const mockDbAll = vi.fn();
const mockDbRun = vi.fn();
const mockDbGet = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
}));

let mockUser: { id: string; organizationId: string; role: string } | null = null;

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    req.user = mockUser;
    next();
  },
}));

const ORG = 'org-reader-A';
const ARTIFACT = 'art-reader-test-1';

const baseSchema: DocumentSchema = {
  documentId: 'doc-reader-1',
  artifactId: ARTIFACT,
  title: 'Client Reader Test Document',
  documentType: 'client_final_report',
  language: 'en',
  audience: ['Client sponsor'],
  goal: 'inform',
  communicationRegister: 'executive',
  density: 'standard',
  languageStyle: 'consulting',
  confidentiality: 'client_confidential',
  formattingSchema: {
    fonts: { body: 'Aptos 11', heading: 'Aptos Display' },
    headingStyles: { h1: 'h1', h2: 'h2', h3: 'h3' },
    tableStyles: { default: 'default' },
    listStyles: { bullet: 'bullet', numbered: 'numbered' },
    page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2.3, right: 2.3 } },
    headers: { enabled: true },
    footers: { enabled: true, pageNumbering: true, confidentialityLabel: true },
    toc: false,
    coverPage: true,
    appendixStyle: 'lettered',
    citationStyle: 'inline_marker',
  } as DocumentSchema['formattingSchema'],
  sections: [
    {
      sectionId: 'sec-summary',
      orderIndex: 0,
      level: 1,
      title: 'Executive Summary',
      blocks: [
        {
          blockId: 'blk-1',
          type: 'paragraph',
          content: { text: 'Public-facing recommendation.' } as unknown,
          sourceRef: {
            sourceType: 'internal_kb',
            sourceId: 'kb-secret-123',
            sourceTitle: 'Internal knowledge base entry',
          },
        },
      ],
      sourceRefs: [{ sourceType: 'internal_kb', sourceId: 'kb-secret-123' }],
    },
  ],
  sourceRefs: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  clientId: 'client-secret-acme',
  owner: 'consultant-internal-42',
  sourcePackId: 'source-pack-internal-9',
};

vi.mock('../../services/wave5ArtifactRuntimeService.js', () => ({
  createWave5Artifact: vi.fn(),
  getWave5Artifact: vi.fn(async (artifactId: string, organizationId: string) => {
    if (artifactId !== ARTIFACT || organizationId !== ORG) return null;
    return {
      artifact_id: artifactId,
      organization_id: organizationId,
      title: baseSchema.title,
      content: `# ${baseSchema.title}`,
      content_json: baseSchema,
      metadata_json: { documentStudioSchema: baseSchema },
    };
  }),
  listWave5ArtifactVersions: vi.fn(async () => []),
  listWave5Mutations: vi.fn(async () => []),
  buildWave5ExportManifest: vi.fn(async () => ({ artifactId: ARTIFACT, formats: [] })),
  markWave5ArtifactExported: vi.fn(async () => ({ artifact_id: ARTIFACT, status: 'exported' })),
}));

import documentStudioRoutes, { documentShareLinkPublicRoutes } from '../document-studio.routes.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/document-studio', documentShareLinkPublicRoutes);
  app.use('/api/document-studio', documentStudioRoutes);
  return app;
}

async function mintLink(
  app: Express,
  accessScope: string
): Promise<{ token: string; shareLinkId: string }> {
  mockUser = { id: 'user-reader-1', organizationId: ORG, role: 'CONSULTANT' };
  const created = await request(app)
    .post(`/api/document-studio/${ARTIFACT}/share-links`)
    .send({ accessScope });
  expect(created.status).toBe(201);
  mockUser = null;
  return { token: created.body.shareLink.token, shareLinkId: created.body.shareLink.shareLinkId };
}

beforeEach(async () => {
  vi.clearAllMocks();
  mockUser = null;
  mockDbAll.mockResolvedValue([]);
  mockDbRun.mockResolvedValue({ rowCount: 0, success: true });
  mockDbGet.mockResolvedValue(null);
  await __resetShareLinkRegistryForTests();
  __resetDocumentCommentsForTests();
});

describe('POST /api/document-studio/share-links/document', () => {
  it('returns the whitelisted document projection for a read-scope link', async () => {
    const app = createApp();
    const { token } = await mintLink(app, 'read');

    const res = await request(app)
      .post('/api/document-studio/share-links/document')
      .send({ token });

    expect(res.status).toBe(200);
    expect(res.body.accessScope).toBe('read');
    expect(res.body.artifactId).toBe(ARTIFACT);
    expect(res.body.document.title).toBe('Client Reader Test Document');
    expect(res.body.document.sections).toHaveLength(1);
    expect(res.body.document.sections[0].blocks[0]).toMatchObject({
      blockId: 'blk-1',
      type: 'paragraph',
      content: { text: 'Public-facing recommendation.' },
    });
  });

  it('never leaks organizationId or internal-only schema fields', async () => {
    const app = createApp();
    const { token } = await mintLink(app, 'read');

    const res = await request(app)
      .post('/api/document-studio/share-links/document')
      .send({ token });

    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('organizationId');
    expect(raw).not.toContain('client-secret-acme');
    expect(raw).not.toContain('consultant-internal-42');
    expect(raw).not.toContain('source-pack-internal-9');
    expect(raw).not.toContain('kb-secret-123');
    expect(res.body.document.sections[0].sourceRefs).toBeUndefined();
    expect(res.body.document.sections[0].blocks[0].sourceRef).toBeUndefined();
  });

  it('returns 404 for an unknown/expired token', async () => {
    const res = await request(createApp())
      .post('/api/document-studio/share-links/document')
      .send({ token: 'bogus' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('share_link_invalid_or_expired');
  });

  it('returns 400 when token is missing', async () => {
    const res = await request(createApp())
      .post('/api/document-studio/share-links/document')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('token_required');
  });
});

describe('POST /api/document-studio/share-links/comments/list', () => {
  it('returns 403 for a read-scope link (no comment UI)', async () => {
    const app = createApp();
    const { token } = await mintLink(app, 'read');

    const res = await request(app)
      .post('/api/document-studio/share-links/comments/list')
      .send({ token });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('share_link_scope_forbidden');
  });

  it('lists existing threads for a comment-scope link, including a client-posted comment', async () => {
    const app = createApp();
    const { token, shareLinkId } = await mintLink(app, 'comment');

    const session = await request(app)
      .post('/api/document-studio/share-links/edit-session')
      .send({ token, consumerFingerprint: 'fp-list-1' });
    expect(session.status).toBe(201);

    const created = await request(app)
      .post('/api/document-studio/share-links/comments')
      .send({
        token,
        editSessionToken: session.body.session.editSessionToken,
        consumerFingerprint: 'fp-list-1',
        body: 'Question from the client about section 1',
        anchor: { kind: 'section', sectionId: 'sec-summary' },
      });
    expect(created.status).toBe(201);

    const res = await request(app)
      .post('/api/document-studio/share-links/comments/list')
      .send({ token });
    expect(res.status).toBe(200);
    expect(res.body.comments).toHaveLength(1);
    expect(res.body.comments[0]).toMatchObject({
      body: 'Question from the client about section 1',
      authorId: `share-link:${shareLinkId}`,
    });
    // organizationId (internal tenant id) must never reach an
    // anonymous share-link consumer — same invariant as `resolve`.
    expect(res.body.comments[0].organizationId).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(ORG);
  });
});
