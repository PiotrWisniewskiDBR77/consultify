/**
 * P3.2 — public deck share-link hardening
 * (`GET /presentations/shared/:token` + `POST|DELETE /presentations/decks/:id/share`,
 * presentations.routes.ts ~line 610 / ~line 1817 / ~line 1875).
 *
 * P0.4 already pinned the anti-enumeration contract (missing/expired/revoked
 * token -> single 404) and the field whitelist for the public viewer
 * (`tests/integration/routes/presentations.public-viewer-whitelist.route.test.ts`).
 * This file covers the remaining P3.2 scope on top of that:
 *
 *  1. Revoke (`DELETE /decks/:id/share`) nulls `share_token`, and the SAME
 *     token subsequently 404s on `GET /shared/:token` — the revoke actually
 *     takes effect, not just "returns 200".
 *  2. `GET /shared/:token` is throttled by `publicViewerLimiter` (60/min);
 *     exceeding the window returns 429 with the limiter's message body.
 *  3. Revoke requires the `presentation_share` capability
 *     (`ensurePresentationCapability`, presentationAccessPolicyService.ts).
 *     A same-org VIEWER (view/export only, no share) gets 403
 *     PERMISSION_DENIED and the deck's share_token is left untouched.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let currentRole = 'OWNER';

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'user-1', role: currentRole, organizationId: 'org-A' };
    req.userId = 'user-1';
    req.userRole = currentRole;
    req.organizationId = 'org-A';
    next();
  },
}));

vi.mock('../../../server/src/middleware/requireAudit.middleware.js', () => ({
  requireAudit: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../server/src/services/notificationService.js', () => ({
  send: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../server/src/services/OrgPoliciesService.js', () => ({
  requireNoLegalHold: vi.fn().mockResolvedValue(undefined),
  OrgPoliciesError: class OrgPoliciesError extends Error {},
}));

vi.mock('../../../server/src/services/presentationGeneratorService.js', () => ({
  generateDeck: vi.fn(),
  generateOutline: vi.fn(),
}));

vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  getArtifactByOrigin: vi.fn().mockResolvedValue(null),
  getArtifactByOriginUnscoped: vi.fn(),
  registerArtifactOrigin: vi.fn(),
  mapPresentationStatusToDeliveryState: vi.fn(() => 'delivered'),
  deriveArtifactVisibilityScope: vi.fn(() => 'private'),
}));

vi.mock('../../../server/src/services/v8/reportsPresModelService.js', () => ({
  recordCompletedExport: vi.fn(),
}));

// In-memory fake row for presentation_decks(id='deck-1', organization_id='org-A').
// Mutated in place by the DbPromise mock so DELETE /decks/:id/share and a
// subsequent GET /shared/:token observe the SAME state.
let deckRow: any;

function freshDeckRow() {
  return {
    id: 'deck-1',
    organization_id: 'org-A',
    title: 'Q3 Deck',
    confidentiality: 'internal',
    share_token: 'tok_live_1',
    share_expires_at: null,
    share_created_by: 'user-1',
    created_by: 'user-1',
    updated_by: 'user-1',
    deck_json: JSON.stringify({ schemaVersion: 1, cards: [] }),
    source_artifacts: '[]',
    source_refs_json: '[]',
    outline_json: '[]',
    validation_warnings: '[]',
    status: 'shared',
    theme: 'corporate',
    slide_count: 0,
  };
}

const mockDbGet = vi.fn(async (sql: string, params: unknown[] = []) => {
  if (/FROM presentation_decks\s+WHERE share_token = \?/i.test(sql)) {
    const [token] = params as [string];
    if (deckRow.share_token && deckRow.share_token === token) return { ...deckRow };
    return null;
  }
  if (/FROM presentation_decks WHERE id = \? AND organization_id = \?/i.test(sql)) {
    const [id, orgId] = params as [string, string];
    if (deckRow.id === id && deckRow.organization_id === orgId) return { ...deckRow };
    return null;
  }
  return null;
});

const mockDbRun = vi.fn(async (sql: string, params: unknown[] = []) => {
  if (/UPDATE presentation_decks SET share_token = NULL/i.test(sql)) {
    const [id, orgId] = params as [string, string];
    if (deckRow.id === id && deckRow.organization_id === orgId) {
      deckRow.share_token = null;
      deckRow.share_expires_at = null;
    }
    return { success: true, changes: 1 };
  }
  if (/UPDATE presentation_decks SET share_token = \?/i.test(sql)) {
    const [token, expiresAt, id, orgId] = params as [string, string, string, string];
    if (deckRow.id === id && deckRow.organization_id === orgId) {
      deckRow.share_token = token;
      deckRow.share_expires_at = expiresAt;
    }
    return { success: true, changes: 1 };
  }
  return { success: true, changes: 1 };
});

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn().mockResolvedValue([]),
  get: (...args: [string, unknown[]?]) => mockDbGet(...args),
  run: (...args: [string, unknown[]?]) => mockDbRun(...args),
}));

async function buildApp() {
  vi.resetModules();
  const { default: router } = await import('../../../server/src/routes/presentations.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/presentations', router);
  return app;
}

describe('P3.2 — DELETE /presentations/decks/:id/share revokes the public link', () => {
  beforeEach(() => {
    currentRole = 'OWNER';
    deckRow = freshDeckRow();
    mockDbGet.mockClear();
    mockDbRun.mockClear();
  });

  it('revoked token 404s on the public viewer afterwards (anti-enumeration surface preserved)', async () => {
    const app = await buildApp();

    // Sanity: the link is live before revoke.
    const before = await request(app).get('/presentations/shared/tok_live_1');
    expect(before.status).toBe(200);
    expect(before.body.success).toBe(true);

    const revoke = await request(app).delete('/presentations/decks/deck-1/share');
    expect(revoke.status).toBe(200);
    expect(revoke.body).toMatchObject({ success: true, data: { revoked: true } });
    expect(deckRow.share_token).toBeNull();

    const after = await request(app).get('/presentations/shared/tok_live_1');
    expect(after.status).toBe(404);
    expect(after.body).toMatchObject({ success: false });
  });

  it('revoking a foreign/unknown deck id -> 404, share_token left untouched', async () => {
    const app = await buildApp();

    const res = await request(app).delete('/presentations/decks/deck-does-not-exist/share');
    expect(res.status).toBe(404);
    expect(deckRow.share_token).toBe('tok_live_1');
  });
});

describe('Artifact Studio — public presentation link classification gate', () => {
  beforeEach(() => {
    currentRole = 'OWNER';
    deckRow = freshDeckRow();
    mockDbGet.mockClear();
    mockDbRun.mockClear();
  });

  it('fails closed for an Internal deck even when the caller has share permission', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/presentations/decks/deck-1/share')
      .send({ expiresInDays: 7 });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      success: false,
      code: 'PUBLIC_LINK_CLASSIFICATION_BLOCKED',
      blocks: ['PUBLIC_LINK_CLASSIFICATION_BLOCKED'],
    });
    expect(mockDbRun).not.toHaveBeenCalledWith(
      expect.stringMatching(/SET share_token = \?/i),
      expect.anything()
    );
  });

  it('mints a public link after the deck is explicitly classified Public', async () => {
    deckRow.confidentiality = 'public';
    const app = await buildApp();
    const res = await request(app)
      .post('/presentations/decks/deck-1/share')
      .send({ expiresInDays: 7 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.shareToken).toMatch(/^[a-f0-9]{32}$/);
  });
});

describe('P3.2 — DELETE /presentations/decks/:id/share requires presentation_share RBAC', () => {
  beforeEach(() => {
    currentRole = 'OWNER';
    deckRow = freshDeckRow();
    mockDbGet.mockClear();
    mockDbRun.mockClear();
  });

  it('same-org VIEWER (no presentation_share capability) -> 403 PERMISSION_DENIED, token untouched', async () => {
    currentRole = 'VIEWER';
    const app = await buildApp();

    const res = await request(app).delete('/presentations/decks/deck-1/share');

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      success: false,
      code: 'PERMISSION_DENIED',
      requiredCapability: 'presentation_share',
    });
    // The capability gate runs before any DB mutation.
    expect(deckRow.share_token).toBe('tok_live_1');

    // Confirm the link is still live -- RBAC rejection must not have any
    // side effect on the public viewer contract.
    const stillLive = await request(app).get('/presentations/shared/tok_live_1');
    expect(stillLive.status).toBe(200);
  });

  it('OWNER (has presentation_share capability) -> revoke proceeds (200)', async () => {
    currentRole = 'OWNER';
    const app = await buildApp();

    const res = await request(app).delete('/presentations/decks/deck-1/share');

    expect(res.status).toBe(200);
    expect(deckRow.share_token).toBeNull();
  });
});

describe('P3.2 — GET /presentations/shared/:token is rate-limited (publicViewerLimiter)', () => {
  beforeEach(() => {
    currentRole = 'OWNER';
    deckRow = freshDeckRow();
    mockDbGet.mockClear();
    mockDbRun.mockClear();
  });

  it('exceeding the 60/min window on the public viewer returns 429', async () => {
    const app = await buildApp();

    let lastStatus = 200;
    let lastBody: any = null;
    // publicViewerLimiter is configured max:60 per 60s window, keyed by IP.
    // supertest requests all originate from the same loopback address, so
    // this single-agent loop exercises the same limiter bucket.
    for (let i = 0; i < 65; i += 1) {
      const res = await request(app).get('/presentations/shared/tok_live_1');
      lastStatus = res.status;
      lastBody = res.body;
    }

    expect(lastStatus).toBe(429);
    expect(lastBody).toMatchObject({ success: false });
  });
});
