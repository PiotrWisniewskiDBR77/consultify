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

import { __resetShareLinkRegistryForTests } from '../../services/documentStudio/documentShareLinkService.js';

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
  await __resetShareLinkRegistryForTests();
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
    expect(res.body.shareLink.token).toMatch(/^[a-z0-9]{40,}$/);
    expect(res.body.shareLink.status).toBe('active');
    expect(res.body.shareLink.label).toBe('Q1 review');
  });

  it('returns 400 on invalid access scope', async () => {
    const res = await request(createApp())
      .post(`/api/document-studio/${ARTIFACT}/share-links`)
      .send({ accessScope: 'edit' });
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
      organizationId: ORG,
      accessScope: 'comment',
      consumeCount: 1,
    });
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
