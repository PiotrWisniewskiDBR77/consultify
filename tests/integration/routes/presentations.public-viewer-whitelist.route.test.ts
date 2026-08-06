/**
 * P0.4 — Route-level contract for the public (unauthenticated) share-token viewer.
 *
 * `GET /presentations/shared/:token` (presentations.routes.ts ~line 609) is the
 * ONE endpoint in this router that intentionally serves data to an
 * unauthenticated caller. `toPublicDeckRow` (built on `PUBLIC_DECK_DENY_FIELDS`,
 * ~line 400) is the last line of defense against over-disclosure: it must
 * strip tenant-identifying / internal bookkeeping fields before the row ever
 * reaches `res.json`.
 *
 * This test boots the REAL router (no auth mock needed — the route is public
 * and declared before any `router.use(verifyToken)` gating) and asserts the
 * HTTP response body directly, so a future refactor that inlines the row
 * instead of calling `toPublicDeckRow`, or that adds a new sensitive column
 * without updating the deny-list, fails a real HTTP contract test — not just
 * a unit test of the helper.
 */
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    // Not exercised by the public viewer route, but the router module wires
    // `router.use(verifyToken)` further down for other endpoints, so the
    // mock must exist and be well-behaved for module import to succeed.
    req.user = { id: 'user-1', role: 'OWNER', organizationId: 'org-A' };
    req.userId = 'user-1';
    req.userRole = 'OWNER';
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

vi.mock('../../../server/src/services/lineage/artifactLineageService.js', () => ({
  cancelPendingLineageIntent: vi.fn(),
  deriveCreatedEventIdempotencyKey: vi.fn(),
  preflightStreamingExportIntent: vi.fn(),
  recordLineageEventSafe: vi.fn().mockResolvedValue(undefined),
  recordLineageEventTracked: vi.fn().mockResolvedValue({ durable: true }),
}));

// Row exactly as it would be read from `presentation_decks` — deliberately
// includes every field named in PUBLIC_DECK_DENY_FIELDS plus the fields a
// public viewer legitimately needs (title, deck content).
const SHARED_DECK_ROW = {
  id: 'deck-shared-1',
  organization_id: 'org-SECRET-tenant',
  confidentiality: 'internal',
  share_token: 'tok_abc123',
  share_created_by: 'user-owner-1',
  created_by: 'user-owner-1',
  updated_by: 'user-editor-2',
  title: 'Q3 Board Update',
  description: 'Quarterly steering deck',
  deck_json: JSON.stringify({
    schemaVersion: 1,
    cards: [{ card_id: 'c1', intent: 'cover', title: 'Cover', blocks: [] }],
  }),
  source_artifacts: '[]',
  source_refs_json: '[]',
  outline_json: '[]',
  validation_warnings: '[]',
  status: 'shared',
  theme: 'corporate',
  slide_count: 1,
  share_expires_at: null,
};

const mockDbGet = vi.fn();
const mockDbRun = vi.fn();
vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn().mockResolvedValue([]),
  get: (...args: unknown[]) => mockDbGet(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));

async function buildApp() {
  vi.resetModules();
  const { default: router } = await import('../../../server/src/routes/presentations.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/presentations', router);
  app.use((error: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ error: String(error?.message || error) });
  });
  return app;
}

describe('P0.4 — GET /presentations/shared/:token public viewer whitelist', () => {
  it('response does NOT contain any PUBLIC_DECK_DENY_FIELDS entry', async () => {
    mockDbGet.mockResolvedValue(SHARED_DECK_ROW);
    const app = await buildApp();

    const res = await request(app).get('/presentations/shared/tok_abc123');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;

    // The exact deny-list from presentations.routes.ts PUBLIC_DECK_DENY_FIELDS.
    const DENY_FIELDS = [
      'organization_id',
      'confidentiality',
      'share_token',
      'share_created_by',
      'created_by',
      'updated_by',
    ];
    for (const field of DENY_FIELDS) {
      expect(data).not.toHaveProperty(field);
    }

    // Belt-and-braces: none of the actual secret VALUES leak anywhere in the
    // serialized response, in case a future refactor renames a field but
    // still threads the raw value through under a different key.
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain('org-SECRET-tenant');
    expect(serialized).not.toContain('tok_abc123');
    expect(serialized).not.toContain('user-owner-1');
    expect(serialized).not.toContain('user-editor-2');
  });

  it('response DOES contain the fields a public viewer needs (title + deck content)', async () => {
    mockDbGet.mockResolvedValue(SHARED_DECK_ROW);
    const app = await buildApp();

    const res = await request(app).get('/presentations/shared/tok_abc123');

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.title).toBe('Q3 Board Update');
    // normalizeDeckRow re-serializes deck_json as a canonical string; the
    // viewer's own deck-hydration step re-parses it. Assert the cards made
    // it through end to end rather than assuming a particular key name.
    expect(typeof data.deck_json).toBe('string');
    const parsedDeck = JSON.parse(data.deck_json);
    expect(Array.isArray(parsedDeck.cards)).toBe(true);
    expect(parsedDeck.cards.length).toBeGreaterThan(0);
    expect(parsedDeck.cards[0].title).toBe('Cover');
    expect(data.deck).toEqual(parsedDeck);
  });

  it('share mint -> viewer returns the canonical normalized deck payload', async () => {
    let token: string | null = null;
    const persistedRow = {
      ...SHARED_DECK_ROW,
      share_token: null,
      // Exercise normalization/repair, not a pass-through assertion: legacy
      // cards are accepted by normalizeDeckDocument and returned as schema v1.
      deck_json: JSON.stringify({
        cards: [{ card_id: 'legacy-c1', intent: 'cover', title: 'Canonical cover', blocks: [] }],
      }),
    };

    mockDbGet.mockImplementation(async (sql: string, params: unknown[]) => {
      if (/WHERE share_token = \?/i.test(sql)) {
        return token && params[0] === token ? { ...persistedRow, share_token: token } : null;
      }
      if (/WHERE id = \? AND organization_id = \?/i.test(sql)) return persistedRow;
      return null;
    });
    mockDbRun.mockImplementation(async (sql: string, params: unknown[]) => {
      if (/UPDATE presentation_decks SET share_token = \?/i.test(sql)) token = String(params[0]);
      return { success: true };
    });

    const app = await buildApp();
    const share = await request(app)
      .post('/presentations/decks/deck-shared-1/share')
      .send({ expiresInDays: 7 });
    expect(share.status, JSON.stringify(share.body)).toBe(200);
    const mintedToken = share.body?.data?.shareToken ?? share.body?.shareToken;
    expect(mintedToken).toEqual(expect.any(String));

    const viewer = await request(app).get(`/presentations/shared/${mintedToken}`);
    expect(viewer.status).toBe(200);
    expect(viewer.body.data.content_state).toBe('canonical');
    expect(viewer.body.data.slide_count).toBe(1);
    expect(viewer.body.data.deck).toMatchObject({
      schemaVersion: 1,
      title: 'Q3 Board Update',
      cards: [{ title: 'Canonical cover' }],
    });
    expect(JSON.parse(viewer.body.data.deck_json)).toEqual(viewer.body.data.deck);
  });

  it('missing/expired/revoked token -> single 404 surface (anti-enumeration)', async () => {
    mockDbGet.mockResolvedValue(null);
    const app = await buildApp();

    const res = await request(app).get('/presentations/shared/tok_does_not_exist');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false });
  });
});
