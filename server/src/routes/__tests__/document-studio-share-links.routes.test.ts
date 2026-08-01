/**
 * Document Studio — Slice E13.1 — Share-link routes integration tests.
 *
 * Exercises the HTTP surface end-to-end through `supertest`:
 *
 *   - POST   /:artifactId/share-links              — create
 *   - GET    /:artifactId/share-links              — list
 *   - GET    /share-links/:shareLinkId             — get one
 *   - POST   /share-links/:shareLinkId/revoke      — revoke
 *   - GET    /share-links/:shareLinkId/audit       — audit trail
 *   - POST   /share-links/resolve                  — UNAUTHENTICATED public consume
 *
 * Strategy:
 *   - Mocks `verifyToken` so authed routes resolve to a deterministic
 *     `(userId, organizationId)` pair from a `mockUser` capture.
 *   - Mounts the public router BEFORE the authed router so the resolve
 *     path can be exercised with `mockUser = null` (no auth header).
 *   - Reuses the in-process service state so creating + listing +
 *     revoking + consuming share the same registry.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetDocumentCommentsForTests } from '../../services/documentStudio/documentCommentsService.js';
import {
  __resetShareLinkRegistryForTests,
  listShareLinks,
} from '../../services/documentStudio/documentShareLinkService.js';

const mockDbAll = vi.fn();
const mockDbRun = vi.fn();
const mockDbGet = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
}));

vi.mock('../../services/wave5ArtifactRuntimeService.js', () => ({
  getWave5Artifact: vi.fn(async (artifactId: string, organizationId: string) =>
    artifactId === 'art-share-test-1' && organizationId === 'org-share-A'
      ? {
          artifact_id: artifactId,
          organization_id: organizationId,
          title: 'Shareable document',
          metadata_json: {
            documentStudioSchema: {
              artifactId,
              documentId: artifactId,
              title: 'Shareable document',
              sections: [],
              createdAt: '2026-08-01T20:00:00.000Z',
              updatedAt: '2026-08-01T20:00:00.000Z',
            },
          },
        }
      : null
  ),
  createWave5Artifact: vi.fn(),
  buildWave5ExportManifest: vi.fn(async () => ({})),
  markWave5ArtifactExported: vi.fn(async () => undefined),
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

import documentStudioRoutes, { documentShareLinkPublicRoutes } from '../document-studio.routes.js';

function createApp(): Express {
  const app = express();
  app.use(express.json());
  // Public routes mount BEFORE authed routes — same prefix, Express
  // walks routers in registration order.
  app.use('/api/document-studio', documentShareLinkPublicRoutes);
  app.use('/api/document-studio', documentStudioRoutes);
  return app;
}

const ORG = 'org-share-A';
const UID = 'user-share-1';
const ARTIFACT = 'art-share-test-1';

beforeEach(async () => {
  vi.clearAllMocks();
  mockUser = { id: UID, organizationId: ORG, role: 'CONSULTANT' };
  mockDbAll.mockResolvedValue([]);
  mockDbRun.mockResolvedValue({ rowCount: 1, changes: 1, success: true });
  mockDbGet.mockResolvedValue(null);
  await __resetShareLinkRegistryForTests();
  __resetDocumentCommentsForTests();
});

describe('POST /api/document-studio/:artifactId/share-links — create', () => {
  it('mints a share link with default `read` scope and returns 201', async () => {
    const res = await request(createApp())
      .post(`/api/document-studio/${ARTIFACT}/share-links`)
      .send({ accessScope: 'read', label: 'Q1 review' });
    expect(res.status).toBe(201);
    expect(res.body.shareLink).toBeDefined();
    expect(res.body.shareLink.artifactId).toBe(ARTIFACT);
    expect(res.body.shareLink.organizationId).toBe(ORG);
    expect(res.body.shareLink.accessScope).toBe('read');
    expect(res.body.shareLink.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.body.shareLink.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(res.body.shareLink.status).toBe('active');
    expect(res.body.shareLink.label).toBe('Q1 review');
  });

  it('returns 400 on invalid access scope', async () => {
    const res = await request(createApp())
      .post(`/api/document-studio/${ARTIFACT}/share-links`)
      .send({ accessScope: 'owner' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_access_scope');
  });

  it('returns 400 on a past expiresAt', async () => {
    const res = await request(createApp())
      .post(`/api/document-studio/${ARTIFACT}/share-links`)
      .send({ accessScope: 'read', expiresAt: '2020-01-01T00:00:00.000Z' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('share_link_create_failed');
  });

  it('returns 401 when unauthenticated', async () => {
    mockUser = null;
    const res = await request(createApp())
      .post(`/api/document-studio/${ARTIFACT}/share-links`)
      .send({ accessScope: 'read' });
    expect(res.status).toBe(401);
  });

  it('returns 404 and creates no link for a guessed/non-existent artifact id', async () => {
    const res = await request(createApp())
      .post('/api/document-studio/not-a-real-document/share-links')
      .send({ accessScope: 'read' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('document_not_found');
    expect(listShareLinks(ORG, { includeExpired: true })).toHaveLength(0);
  });

  it('returns 503 and does not publish a token when durable creation is not confirmed', async () => {
    mockDbRun.mockResolvedValueOnce({ success: false, error: 'database unavailable' });
    const res = await request(createApp())
      .post(`/api/document-studio/${ARTIFACT}/share-links`)
      .send({ accessScope: 'read' });
    expect(res.status).toBe(503);
    expect(res.body.message).toBe('share_link_persistence_failed');
    expect(res.body.shareLink).toBeUndefined();
    expect(listShareLinks(ORG, { includeExpired: true })).toHaveLength(0);
  });
});

describe('GET /api/document-studio/:artifactId/share-links — list', () => {
  it('lists tenant-scoped active links with runtimeStatus decoration', async () => {
    const app = createApp();
    await request(app)
      .post(`/api/document-studio/${ARTIFACT}/share-links`)
      .send({ accessScope: 'read' });
    await request(app)
      .post(`/api/document-studio/${ARTIFACT}/share-links`)
      .send({ accessScope: 'comment' });

    const res = await request(app).get(`/api/document-studio/${ARTIFACT}/share-links`);
    expect(res.status).toBe(200);
    expect(res.body.shareLinks).toHaveLength(2);
    expect(res.body.shareLinks[0].runtimeStatus.effectiveStatus).toBe('active');
    expect(res.body.shareLinks[0].runtimeStatus.isUsable).toBe(true);
  });

  it('does not leak cross-tenant rows', async () => {
    const app = createApp();
    await request(app)
      .post(`/api/document-studio/${ARTIFACT}/share-links`)
      .send({ accessScope: 'read' });
    mockUser = { id: 'other-user', organizationId: 'org-share-B', role: 'CONSULTANT' };
    const res = await request(app).get(`/api/document-studio/${ARTIFACT}/share-links`);
    expect(res.status).toBe(200);
    expect(res.body.shareLinks).toHaveLength(0);
  });
});

describe('GET /api/document-studio/share-links/:shareLinkId — get one', () => {
  it('returns 200 with runtimeStatus for an existing link', async () => {
    const app = createApp();
    const created = await request(app)
      .post(`/api/document-studio/${ARTIFACT}/share-links`)
      .send({ accessScope: 'read' });
    const id = created.body.shareLink.shareLinkId;
    const res = await request(app).get(`/api/document-studio/share-links/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.shareLink.shareLinkId).toBe(id);
    expect(res.body.runtimeStatus.effectiveStatus).toBe('active');
  });

  it('returns 404 for an unknown id', async () => {
    const res = await request(createApp()).get('/api/document-studio/share-links/unknown-id');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('share_link_not_found');
  });
});

describe('POST /api/document-studio/share-links/:shareLinkId/revoke', () => {
  it('flips status to revoked', async () => {
    const app = createApp();
    const created = await request(app)
      .post(`/api/document-studio/${ARTIFACT}/share-links`)
      .send({ accessScope: 'read' });
    const id = created.body.shareLink.shareLinkId;
    const res = await request(app)
      .post(`/api/document-studio/share-links/${id}/revoke`)
      .send({ reason: 'engagement closed' });
    expect(res.status).toBe(200);
    expect(res.body.shareLink.status).toBe('revoked');
    expect(res.body.shareLink.revokedReason).toBe('engagement closed');
  });

  it('returns 404 cross-tenant', async () => {
    const app = createApp();
    const created = await request(app)
      .post(`/api/document-studio/${ARTIFACT}/share-links`)
      .send({ accessScope: 'read' });
    const id = created.body.shareLink.shareLinkId;
    mockUser = { id: 'other-user', organizationId: 'org-share-B', role: 'CONSULTANT' };
    const res = await request(app).post(`/api/document-studio/share-links/${id}/revoke`).send({});
    expect(res.status).toBe(404);
  });

  it('returns 503 and keeps the link active when durable revoke is not confirmed', async () => {
    const app = createApp();
    const created = await request(app)
      .post(`/api/document-studio/${ARTIFACT}/share-links`)
      .send({ accessScope: 'read' });
    const { shareLinkId, token } = created.body.shareLink;
    mockDbRun.mockResolvedValueOnce({ success: false, error: 'database unavailable' });

    const revoke = await request(app)
      .post(`/api/document-studio/share-links/${shareLinkId}/revoke`)
      .send({});
    expect(revoke.status).toBe(503);
    expect(listShareLinks(ORG, { includeExpired: true })[0]?.status).toBe('active');
    mockUser = null;
    const resolve = await request(app)
      .post('/api/document-studio/share-links/resolve')
      .send({ token });
    expect(resolve.status).toBe(200);
  });
});

describe('POST /api/document-studio/share-links/:shareLinkId/rotate', () => {
  it('rotates token and invalidates the previous token immediately', async () => {
    const app = createApp();
    const created = await request(app)
      .post(`/api/document-studio/${ARTIFACT}/share-links`)
      .send({ accessScope: 'download' });
    const id = created.body.shareLink.shareLinkId;
    const oldToken = created.body.shareLink.token;

    const rotate = await request(app)
      .post(`/api/document-studio/share-links/${id}/rotate`)
      .send({ reason: 'routine-rotation' });
    expect(rotate.status).toBe(200);
    expect(rotate.body.shareLink.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(rotate.body.shareLink.token).not.toBe(oldToken);

    mockUser = null;
    const staleConsume = await request(app)
      .post('/api/document-studio/share-links/resolve')
      .send({ token: oldToken });
    expect(staleConsume.status).toBe(404);

    const freshConsume = await request(app)
      .post('/api/document-studio/share-links/resolve')
      .send({ token: rotate.body.shareLink.token });
    expect(freshConsume.status).toBe(200);
    expect(freshConsume.body.resolved.shareLinkId).toBe(id);
    expect(freshConsume.body.resolved.accessScope).toBe('download');
  });

  it('returns 409 for revoked links', async () => {
    const app = createApp();
    const created = await request(app)
      .post(`/api/document-studio/${ARTIFACT}/share-links`)
      .send({ accessScope: 'read' });
    const id = created.body.shareLink.shareLinkId;
    await request(app).post(`/api/document-studio/share-links/${id}/revoke`).send({});

    const rotate = await request(app)
      .post(`/api/document-studio/share-links/${id}/rotate`)
      .send({});
    expect(rotate.status).toBe(409);
    expect(rotate.body.error).toBe('share_link_not_active');
  });

  it('returns 503 and leaves the old token valid when rotation persistence fails', async () => {
    const app = createApp();
    const created = await request(app)
      .post(`/api/document-studio/${ARTIFACT}/share-links`)
      .send({ accessScope: 'read' });
    const { shareLinkId, token } = created.body.shareLink;
    mockDbRun.mockResolvedValueOnce({ success: false, error: 'database unavailable' });

    const rotate = await request(app)
      .post(`/api/document-studio/share-links/${shareLinkId}/rotate`)
      .send({});
    expect(rotate.status).toBe(503);
    expect(listShareLinks(ORG, { includeExpired: true })[0]?.token).toBe(token);
    mockUser = null;
    const resolve = await request(app)
      .post('/api/document-studio/share-links/resolve')
      .send({ token });
    expect(resolve.status).toBe(200);
  });
});

describe('GET /api/document-studio/share-links/:shareLinkId/audit', () => {
  it('returns the full audit trail for a tenant-owned link', async () => {
    const app = createApp();
    const created = await request(app)
      .post(`/api/document-studio/${ARTIFACT}/share-links`)
      .send({ accessScope: 'read' });
    const id = created.body.shareLink.shareLinkId;
    await request(app).post(`/api/document-studio/share-links/${id}/revoke`).send({});
    const res = await request(app).get(`/api/document-studio/share-links/${id}/audit`);
    expect(res.status).toBe(200);
    expect(res.body.auditEntries.map((e: { action: string }) => e.action).sort()).toEqual([
      'share_link_created',
      'share_link_revoked',
    ]);
  });

  it('returns 404 cross-tenant (no audit leakage)', async () => {
    const app = createApp();
    const created = await request(app)
      .post(`/api/document-studio/${ARTIFACT}/share-links`)
      .send({ accessScope: 'read' });
    const id = created.body.shareLink.shareLinkId;
    mockUser = { id: 'other-user', organizationId: 'org-share-B', role: 'CONSULTANT' };
    const res = await request(app).get(`/api/document-studio/share-links/${id}/audit`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/document-studio/share-links/resolve — public consume', () => {
  it('resolves a valid token without authentication', async () => {
    const app = createApp();
    const created = await request(app)
      .post(`/api/document-studio/${ARTIFACT}/share-links`)
      .send({ accessScope: 'comment' });
    const token = created.body.shareLink.token;

    // Consumer is anonymous.
    mockUser = null;
    const res = await request(app)
      .post('/api/document-studio/share-links/resolve')
      .send({ token, consumerFingerprint: 'fp-abc' });
    expect(res.status).toBe(200);
    expect(res.body.resolved).toMatchObject({
      artifactId: ARTIFACT,
      accessScope: 'comment',
      consumeCount: 1,
    });
    expect(res.body.resolved.organizationId).toBeUndefined();
  });

  it('returns 400 when token is missing', async () => {
    mockUser = null;
    const res = await request(createApp())
      .post('/api/document-studio/share-links/resolve')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('token_required');
  });

  it('returns 404 (not 401) for an unknown token — single-surface anti-enumeration', async () => {
    mockUser = null;
    const res = await request(createApp())
      .post('/api/document-studio/share-links/resolve')
      .send({ token: 'totally-bogus-token' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('share_link_invalid_or_expired');
  });

  it('returns 404 for a revoked token', async () => {
    const app = createApp();
    const created = await request(app)
      .post(`/api/document-studio/${ARTIFACT}/share-links`)
      .send({ accessScope: 'read' });
    const token = created.body.shareLink.token;
    const id = created.body.shareLink.shareLinkId;
    await request(app).post(`/api/document-studio/share-links/${id}/revoke`).send({});

    mockUser = null;
    const res = await request(app).post('/api/document-studio/share-links/resolve').send({ token });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('share_link_invalid_or_expired');
  });
});

describe('POST /api/document-studio/share-links/edit-session + public edit comments', () => {
  it('creates edit session and allows anonymous comment mutation for edit scope', async () => {
    const app = createApp();
    const created = await request(app)
      .post(`/api/document-studio/${ARTIFACT}/share-links`)
      .send({ accessScope: 'edit' });
    expect(created.status).toBe(201);
    const token = created.body.shareLink.token;
    const shareLinkId = created.body.shareLink.shareLinkId;

    mockUser = null;
    const session = await request(app)
      .post('/api/document-studio/share-links/edit-session')
      .send({ token, consumerFingerprint: 'fp-edit-1' });
    expect(session.status).toBe(201);
    expect(session.body.session.shareLinkId).toBe(shareLinkId);
    expect(session.body.session.editSessionToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const commentCreate = await request(app)
      .post('/api/document-studio/share-links/comments')
      .send({
        token,
        editSessionToken: session.body.session.editSessionToken,
        consumerFingerprint: 'fp-edit-1',
        body: 'External reviewer edit suggestion',
        anchor: { kind: 'document' },
      });
    expect(commentCreate.status).toBe(201);
    expect(commentCreate.body.comment.authorId).toBe(`share-link:${shareLinkId}`);

    const commentReply = await request(app)
      .post(
        `/api/document-studio/share-links/comments/${commentCreate.body.comment.commentId}/reply`
      )
      .send({
        token,
        editSessionToken: session.body.session.editSessionToken,
        consumerFingerprint: 'fp-edit-1',
        body: 'Follow-up detail from same external reviewer',
      });
    expect(commentReply.status).toBe(201);
    expect(commentReply.body.comment.parentCommentId).toBe(commentCreate.body.comment.commentId);
  });

  it('rejects edit session for view-only scopes (read / download)', async () => {
    const app = createApp();
    const created = await request(app)
      .post(`/api/document-studio/${ARTIFACT}/share-links`)
      .send({ accessScope: 'read' });
    const token = created.body.shareLink.token;
    mockUser = null;
    const session = await request(app)
      .post('/api/document-studio/share-links/edit-session')
      .send({ token, consumerFingerprint: 'fp-edit-2' });
    expect(session.status).toBe(403);
    expect(session.body.error).toBe('share_link_scope_forbidden');
  });

  // F1/F3 client-reader — a `comment` scoped link is meant to let an
  // external reader open threads and add comments (just not edit
  // document content), so it must be allowed to mint an anonymous
  // session and post/reply through the same public surface as `edit`.
  it('allows edit-session + anonymous comment mutation for comment scope', async () => {
    const app = createApp();
    const created = await request(app)
      .post(`/api/document-studio/${ARTIFACT}/share-links`)
      .send({ accessScope: 'comment' });
    expect(created.status).toBe(201);
    const token = created.body.shareLink.token;
    const shareLinkId = created.body.shareLink.shareLinkId;

    mockUser = null;
    const session = await request(app)
      .post('/api/document-studio/share-links/edit-session')
      .send({ token, consumerFingerprint: 'fp-comment-1' });
    expect(session.status).toBe(201);
    expect(session.body.session.shareLinkId).toBe(shareLinkId);

    const commentCreate = await request(app)
      .post('/api/document-studio/share-links/comments')
      .send({
        token,
        editSessionToken: session.body.session.editSessionToken,
        consumerFingerprint: 'fp-comment-1',
        body: 'Client comment on a comment-scope link',
        anchor: { kind: 'document' },
      });
    expect(commentCreate.status).toBe(201);
    expect(commentCreate.body.comment.authorId).toBe(`share-link:${shareLinkId}`);
  });
});
