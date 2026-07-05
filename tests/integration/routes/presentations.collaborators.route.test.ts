/**
 * P3.3 — /presentations/decks/:id/collaborators (list / invite / revoke).
 *
 * Follows the P3.2 route-test pattern (presentations.share-revoke-and-rate-limit).
 * Covers:
 *   - POST creates a collaborator row with the chosen role (200 + collaborator)
 *   - POST accepts a P3.1-style { permission } and maps it to a role
 *   - GET lists collaborators for the deck
 *   - DELETE revokes a collaborator
 *   - POST 400 on missing email/userId
 *   - share capability gate: a same-org VIEWER (no share cap) gets 403 on invite
 *   - deck not in org → 404
 *   - FAIL-OPEN: when the collaborator store is degraded, POST returns a soft
 *     200 with degraded:true rather than a 500
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

// ── In-memory presentation_decks + presentation_deck_collaborators ────────────

let deckRow: any;
let collaborators: any[] = [];
let seq = 0;
let degradeStore = false; // simulate missing collaborators table

function freshDeck() {
  return { id: 'deck-1', organization_id: 'org-A', title: 'Q3 Deck' };
}

const mockDbGet = vi.fn(async (sql: string, params: unknown[] = []) => {
  if (/FROM presentation_decks WHERE id = \? AND organization_id = \?/i.test(sql)) {
    const [id, orgId] = params as string[];
    return deckRow && deckRow.id === id && deckRow.organization_id === orgId ? { ...deckRow } : null;
  }
  if (/SELECT id FROM presentation_deck_collaborators/i.test(sql)) {
    if (degradeStore) throw new Error('relation "presentation_deck_collaborators" does not exist');
    const [deckId, orgId, userId] = params as string[];
    const row = collaborators.find(
      (c) => c.deck_id === deckId && c.organization_id === orgId && c.user_id === userId
    );
    return row ? { id: row.id } : null;
  }
  if (/SELECT \* FROM presentation_deck_collaborators WHERE id = \?/i.test(sql)) {
    if (degradeStore) throw new Error('relation "presentation_deck_collaborators" does not exist');
    const [id] = params as string[];
    return collaborators.find((c) => c.id === id) ?? null;
  }
  if (/SELECT \* FROM presentation_deck_collaborators/i.test(sql)) {
    if (degradeStore) throw new Error('relation "presentation_deck_collaborators" does not exist');
    const [deckId, orgId, userId, email] = params as (string | null)[];
    const matches = collaborators.filter(
      (c) =>
        c.deck_id === deckId &&
        c.organization_id === orgId &&
        (c.user_id === userId || (c.user_id === null && c.invited_email === email))
    );
    return matches[matches.length - 1] ?? null;
  }
  return null;
});

const mockDbAll = vi.fn(async (sql: string, params: unknown[] = []) => {
  if (/FROM presentation_deck_collaborators/i.test(sql)) {
    if (degradeStore) throw new Error('relation "presentation_deck_collaborators" does not exist');
    const [deckId, orgId] = params as string[];
    return collaborators.filter(
      (c) => c.deck_id === deckId && c.organization_id === orgId && c.status !== 'revoked'
    );
  }
  return [];
});

const mockDbRun = vi.fn(async (sql: string, params: unknown[] = []) => {
  if (/INSERT INTO presentation_deck_collaborators/i.test(sql)) {
    if (degradeStore) throw new Error('relation "presentation_deck_collaborators" does not exist');
    const [deckId, orgId, userId, email, role, status, invitedBy] = params as (string | null)[];
    collaborators.push({
      id: `collab-${++seq}`,
      deck_id: deckId,
      organization_id: orgId,
      user_id: userId ?? null,
      invited_email: email ?? null,
      role,
      status,
      invited_by: invitedBy ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return { success: true, changes: 1 };
  }
  if (/UPDATE presentation_deck_collaborators\s+SET status = 'revoked'/i.test(sql)) {
    if (degradeStore) throw new Error('relation "presentation_deck_collaborators" does not exist');
    const [id] = params as string[];
    const row = collaborators.find((c) => c.id === id);
    if (row) row.status = 'revoked';
    return { success: true, changes: row ? 1 : 0 };
  }
  return { success: true, changes: 1 };
});

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...a: [string, unknown[]?]) => mockDbAll(...a),
  get: (...a: [string, unknown[]?]) => mockDbGet(...a),
  run: (...a: [string, unknown[]?]) => mockDbRun(...a),
}));

async function buildApp() {
  vi.resetModules();
  const { default: router } = await import('../../../server/src/routes/presentations.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/presentations', router);
  return app;
}

describe('P3.3 — /presentations/decks/:id/collaborators', () => {
  beforeEach(() => {
    currentRole = 'OWNER';
    deckRow = freshDeck();
    collaborators = [];
    seq = 0;
    degradeStore = false;
    mockDbGet.mockClear();
    mockDbAll.mockClear();
    mockDbRun.mockClear();
  });

  it('POST creates a collaborator row with the chosen role', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/presentations/decks/deck-1/collaborators')
      .send({ email: 'bob@example.com', role: 'editor' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.collaborator.role).toBe('editor');
    expect(res.body.data.collaborator.invitedEmail).toBe('bob@example.com');
    expect(collaborators).toHaveLength(1);
  });

  it('POST maps a P3.1 { permission } to a role', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/presentations/decks/deck-1/collaborators')
      .send({ email: 'v@example.com', permission: 'comment' });
    expect(res.status).toBe(200);
    expect(res.body.data.collaborator.role).toBe('viewer');
  });

  it('GET lists active collaborators', async () => {
    const app = await buildApp();
    await request(app)
      .post('/presentations/decks/deck-1/collaborators')
      .send({ userId: 'user-2', role: 'viewer' });
    const res = await request(app).get('/presentations/decks/deck-1/collaborators');
    expect(res.status).toBe(200);
    expect(res.body.data.collaborators).toHaveLength(1);
    expect(res.body.data.collaborators[0].userId).toBe('user-2');
  });

  it('DELETE revokes a collaborator', async () => {
    const app = await buildApp();
    const created = await request(app)
      .post('/presentations/decks/deck-1/collaborators')
      .send({ userId: 'user-2', role: 'viewer' });
    const id = created.body.data.collaborator.id;
    const del = await request(app).delete(`/presentations/decks/deck-1/collaborators/${id}`);
    expect(del.status).toBe(200);
    expect(del.body.data.revoked).toBe(true);
    const list = await request(app).get('/presentations/decks/deck-1/collaborators');
    expect(list.body.data.collaborators).toHaveLength(0);
  });

  it('POST 400 when neither email nor userId is provided', async () => {
    const app = await buildApp();
    const res = await request(app)
      .post('/presentations/decks/deck-1/collaborators')
      .send({ role: 'viewer' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_INVITE');
  });

  it('invite requires the presentation_share capability (VIEWER → 403)', async () => {
    currentRole = 'VIEWER';
    const app = await buildApp();
    const res = await request(app)
      .post('/presentations/decks/deck-1/collaborators')
      .send({ email: 'x@example.com', role: 'viewer' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');
    expect(collaborators).toHaveLength(0);
  });

  it('404 when the deck is not in the caller org', async () => {
    deckRow = { id: 'deck-1', organization_id: 'org-OTHER', title: 'x' };
    const app = await buildApp();
    const res = await request(app)
      .post('/presentations/decks/deck-1/collaborators')
      .send({ email: 'x@example.com', role: 'viewer' });
    expect(res.status).toBe(404);
  });

  it('FAIL-OPEN: degraded collaborator store returns soft 200 degraded:true (not 500)', async () => {
    degradeStore = true;
    const app = await buildApp();
    const res = await request(app)
      .post('/presentations/decks/deck-1/collaborators')
      .send({ email: 'x@example.com', role: 'viewer' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.degraded).toBe(true);
    expect(res.body.data.collaborator).toBeNull();
  });
});
