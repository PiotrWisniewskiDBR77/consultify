/**
 * P0.3-b — legacy route concurrent-generation lock
 * (`POST /presentations/generate/deck`, presentations.routes.ts ~line 1277).
 *
 * Context: P0.3 added an atomic lock in
 * deliverablesGenerationService.start() — a conditional
 * `UPDATE presentation_decks SET status='generating' WHERE id=? AND
 * status!='generating' RETURNING id`; `changes===0` -> 'invalid_state'.
 * But the LEGACY route calls `generateDeck()` (presentationGeneratorService)
 * directly, bypassing that lock entirely. `generateDeck()` itself does an
 * UNCONDITIONAL `UPDATE ... SET status='generating'` with no guard, so two
 * concurrent POSTs for the same deckId both pass through and both run
 * `generateDeck()`, corrupting/duplicating the deck.
 *
 * FIX: the route now performs the SAME conditional UPDATE before calling
 * generateDeck(). The loser (changes===0) gets 409 with
 * code: 'PRESENTATION_GENERATION_IN_PROGRESS' instead of re-entering
 * generateDeck(). deckId always originates from a prior
 * `/generate/outline` call, which INSERTs the row with status='draft', so
 * by the time `/generate/deck` is called the row already exists — the lock
 * only ever fires for this re-generation path. When deckId is absent, the
 * route fails open (no lock check) since that shape doesn't correspond to
 * the outline->deck flow the lock protects.
 *
 * Tests:
 *  1. Sequential call on a 'draft' deck -> lock acquired, generateDeck() runs, 200.
 *  2. Deck already 'generating' -> 409 PRESENTATION_GENERATION_IN_PROGRESS,
 *     generateDeck() is NOT called.
 *  3. Two concurrent POSTs on the same deckId -> exactly one 200, one 409;
 *     generateDeck() called exactly once.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
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
  send: vi.fn(),
}));

vi.mock('../../../server/src/services/OrgPoliciesService.js', () => ({
  requireNoLegalHold: vi.fn().mockResolvedValue(undefined),
  OrgPoliciesError: class OrgPoliciesError extends Error {},
}));

const mockGenerateDeck = vi.fn(async (deckId: string) => ({
  deckId,
  slideCount: 3,
  warnings: [],
  exportPath: `/exports/${deckId}.pptx`,
}));

vi.mock('../../../server/src/services/presentationGeneratorService.js', () => ({
  generateDeck: (...args: [string, unknown, unknown, string]) => mockGenerateDeck(...args),
  generateOutline: vi.fn(),
}));

vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  getArtifactByOrigin: vi.fn().mockResolvedValue({ artifactId: 'artifact-1' }),
  getArtifactByOriginUnscoped: vi.fn(),
  registerArtifactOrigin: vi.fn(),
  mapPresentationStatusToDeliveryState: vi.fn(() => 'delivered'),
  deriveArtifactVisibilityScope: vi.fn(() => 'private'),
}));

vi.mock('../../../server/src/services/v8/reportsPresModelService.js', () => ({
  recordCompletedExport: vi.fn(),
}));

// In-memory fake row for presentation_decks(id='deck-1', organization_id='org-A').
let deckStatus: string;

// Interleaving gate: forces N concurrent UPDATE attempts to all read the same
// `deckStatus` snapshot before any of them commit, simulating a true DB race
// on the conditional UPDATE ... WHERE status != 'generating' guard.
let interleaveGate: { remaining: number; release: (() => void)[] } | null = null;
function armInterleaveGate(count: number) {
  interleaveGate = { remaining: count, release: [] };
}

const mockDbRun = vi.fn(async (sql: string, params: unknown[] = []) => {
  if (/UPDATE presentation_decks SET status = 'generating'/i.test(sql)) {
    if (interleaveGate) {
      await new Promise<void>((resolve) => {
        interleaveGate!.release.push(resolve);
        interleaveGate!.remaining -= 1;
        if (interleaveGate!.remaining <= 0) {
          interleaveGate!.release.forEach((r) => r());
        }
      });
    }
    const [deckId, orgId] = params as [string, string];
    if (deckId === 'deck-1' && orgId === 'org-A' && deckStatus !== 'generating') {
      deckStatus = 'generating';
      return { success: true, changes: 1 };
    }
    return { success: true, changes: 0 };
  }
  return { success: true, changes: 1 };
});

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue(null),
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

describe('P0.3-b — POST /presentations/generate/deck concurrent-generation lock', () => {
  beforeEach(() => {
    deckStatus = 'draft';
    interleaveGate = null;
    mockDbRun.mockClear();
    mockGenerateDeck.mockClear();
  });

  it('draft deck -> lock acquired, generateDeck() runs, 200', async () => {
    const app = await buildApp();

    const res = await request(app)
      .post('/presentations/generate/deck')
      .send({ deckId: 'deck-1', outline: [], setup: { title: 't', language: 'pl' } });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockGenerateDeck).toHaveBeenCalledTimes(1);
    expect(deckStatus).toBe('generating');
  });

  it('deck already generating -> 409 PRESENTATION_GENERATION_IN_PROGRESS, generateDeck() not called', async () => {
    deckStatus = 'generating';
    const app = await buildApp();

    const res = await request(app)
      .post('/presentations/generate/deck')
      .send({ deckId: 'deck-1', outline: [], setup: { title: 't', language: 'pl' } });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      success: false,
      code: 'PRESENTATION_GENERATION_IN_PROGRESS',
    });
    expect(mockGenerateDeck).not.toHaveBeenCalled();
  });

  it('no deckId -> fails open, lock skipped, generateDeck() still invoked', async () => {
    const app = await buildApp();

    const res = await request(app)
      .post('/presentations/generate/deck')
      .send({ outline: [], setup: { title: 't', language: 'pl' } });

    expect(res.status).toBe(200);
    expect(mockGenerateDeck).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Core regression guard: two truly concurrent POSTs for the same deckId.
  // -----------------------------------------------------------------------
  it('two concurrent POSTs on the same deckId -> exactly ONE gets 200, the OTHER gets 409; generateDeck() called exactly once', async () => {
    const app = await buildApp();

    armInterleaveGate(2);

    const [resA, resB] = await Promise.all([
      request(app)
        .post('/presentations/generate/deck')
        .send({ deckId: 'deck-1', outline: [], setup: { title: 't', language: 'pl' } }),
      request(app)
        .post('/presentations/generate/deck')
        .send({ deckId: 'deck-1', outline: [], setup: { title: 't', language: 'pl' } }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);

    const loser = resA.status === 409 ? resA : resB;
    expect(loser.body).toMatchObject({
      success: false,
      code: 'PRESENTATION_GENERATION_IN_PROGRESS',
    });

    expect(mockGenerateDeck).toHaveBeenCalledTimes(1);
  });
});
