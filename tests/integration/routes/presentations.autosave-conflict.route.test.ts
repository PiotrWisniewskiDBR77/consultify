/**
 * P0.4 — Route-level contract for deck autosave versioning
 * (`PUT /presentations/decks/:deckId/autosave`, presentations.routes.ts ~line 2172).
 *
 * Documented semantics (as implemented today):
 *   - Client sends the version it last saw via the `x-deck-version` header.
 *   - Handler reads the current server row (`SELECT ... version ...`).
 *   - If `clientVersion < serverVersion` -> 409 VERSION_CONFLICT (stale write
 *     rejected, caller must refresh).
 *   - Otherwise it writes: `UPDATE presentation_decks SET deck_json = ?,
 *     version = serverVersion + 1 ... WHERE id = ? AND organization_id = ?`.
 *
 * KNOWN-GAP (documented here, NOT fixed — out of scope for P0.4 which is
 * tests-only): the version check and the write are two separate round-trips
 * with NO compare-and-swap in the UPDATE's WHERE clause (no `AND version = ?`).
 * So the "409 on stale write" guarantee only holds when the second writer's
 * SELECT observes a version that has already been bumped by the first
 * writer's UPDATE. Under true concurrency — both requests interleave their
 * SELECT before either UPDATE commits — both requests see the SAME
 * `deck.version`, both pass the `clientVersion < deck.version` check (since
 * clientVersion equals serverVersion for both), and BOTH writes succeed: the
 * second UPDATE silently overwrites the first with no 409 and no merge. This
 * is a classic lost-update race, not just a "client forgot to send the
 * header" edge case. A real fix would need `UPDATE ... WHERE id = ? AND
 * organization_id = ? AND version = ?` and branch on `rowCount === 0` (or a
 * row-level lock/transaction). See presentations.routes.ts:2172-2233.
 *
 * The tests below pin CURRENT observable behaviour:
 *  1. Sequential autosave with an up-to-date version -> 200, version bumped.
 *  2. Sequential autosave with a stale (behind) version -> 409 VERSION_CONFLICT.
 *  3. Two "concurrent" writers that both read version N before either writes
 *     (simulated via a controllable DB mock) -> the gap reproduces: BOTH
 *     succeed with 200, no 409, and the DB ends up on the LAST writer's
 *     content even though from the first writer's perspective its update
 *     silently vanished. This test intentionally documents the gap; it is a
 *     regression guard for CURRENT behaviour, not an endorsement of it.
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

vi.mock('../../../server/src/services/presentationGeneratorService.js', () => ({
  generateDeck: vi.fn(),
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

// In-memory fake table backing `presentation_decks` for id='deck-1'/'org-A',
// plus a no-op sink for `presentation_deck_versions` inserts, so the handler's
// real SELECT -> [conflict check] -> INSERT (version history) -> UPDATE
// sequence runs against controllable, observable state instead of a live DB.
let deckState: { version: number; deck_json: string };
const dbRunCalls: Array<{ sql: string; params: unknown[] }> = [];

// Interleaving gate: lets a test force N concurrent SELECTs to resolve
// (each with the SAME snapshot of `deckState`) before ANY subsequent UPDATE
// is allowed to mutate it — i.e. a true race, not an accidentally-serialized
// microtask chain. `armInterleaveGate(2)` primes it for two readers.
let interleaveGate: { remaining: number; release: (() => void)[] } | null = null;
function armInterleaveGate(readerCount: number) {
  interleaveGate = { remaining: readerCount, release: [] };
}

const mockDbGet = vi.fn(async (sql: string) => {
  if (/FROM presentation_decks/i.test(sql)) {
    const snapshot = { id: 'deck-1', version: deckState.version, deck_json: deckState.deck_json };
    if (interleaveGate) {
      // Block this reader until every expected concurrent reader has also
      // reached this point, so all of them observe the identical snapshot
      // before any writer's UPDATE can run.
      await new Promise<void>((resolve) => {
        interleaveGate!.release.push(resolve);
        interleaveGate!.remaining -= 1;
        if (interleaveGate!.remaining <= 0) {
          interleaveGate!.release.forEach((r) => r());
        }
      });
    }
    return snapshot;
  }
  return null;
});

const mockDbRun = vi.fn(async (sql: string, params: unknown[] = []) => {
  dbRunCalls.push({ sql, params });
  if (/UPDATE presentation_decks SET/i.test(sql)) {
    const [newDeckJson, newVersion] = params as [string, number, string, string];
    deckState = { version: newVersion, deck_json: newDeckJson };
  }
  return undefined;
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

describe('P0.4 — PUT /presentations/decks/:deckId/autosave version-conflict contract', () => {
  beforeEach(() => {
    deckState = { version: 1, deck_json: JSON.stringify({ schemaVersion: 1, cards: [] }) };
    dbRunCalls.length = 0;
    interleaveGate = null;
    mockDbGet.mockClear();
    mockDbRun.mockClear();
  });

  it('up-to-date client version (matches server) -> 200 and version is bumped by 1', async () => {
    const app = await buildApp();

    const res = await request(app)
      .put('/presentations/decks/deck-1/autosave')
      .set('x-deck-version', '1')
      .send({ cards: [{ card_id: 'c1', title: 'Edited' }] });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, version: 2 });
    expect(deckState.version).toBe(2);
  });

  it('no version header sent -> treated as "no conflict check", write proceeds -> 200', async () => {
    const app = await buildApp();

    const res = await request(app)
      .put('/presentations/decks/deck-1/autosave')
      .send({ cards: [] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('stale client version (behind server) -> 409 VERSION_CONFLICT with server/client version echoed', async () => {
    deckState = { version: 5, deck_json: JSON.stringify({ schemaVersion: 1, cards: [] }) };
    const app = await buildApp();

    const res = await request(app)
      .put('/presentations/decks/deck-1/autosave')
      .set('x-deck-version', '3')
      .send({ cards: [{ card_id: 'c1', title: 'Stale edit' }] });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      success: false,
      code: 'VERSION_CONFLICT',
      serverVersion: 5,
      clientVersion: 3,
    });
    // The stale write must NOT have been applied.
    expect(deckState.version).toBe(5);
  });

  it('unknown deck id -> 404 (not a version conflict)', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const app = await buildApp();

    const res = await request(app)
      .put('/presentations/decks/does-not-exist/autosave')
      .set('x-deck-version', '1')
      .send({ cards: [] });

    expect(res.status).toBe(404);
  });

  // -------------------------------------------------------------------
  // KNOWN-GAP regression guard — see file header. This documents CURRENT
  // behaviour under true read-then-write concurrency: no compare-and-swap
  // in the UPDATE, so two writers who both observed version N both "win".
  // -------------------------------------------------------------------
  it('KNOWN-GAP: two interleaved writers that both read version=1 BOTH succeed with 200 (no 409, lost update)', async () => {
    const app = await buildApp();

    // Force the true race: both requests' SELECTs are held open until BOTH
    // have read the identical `deckState` snapshot (version=1), only then
    // are they released to proceed to their INSERT (version history) +
    // UPDATE. This mirrors two browser tabs racing an autosave against the
    // same starting point — the exact scenario the version header is meant
    // to guard against, and the exact interleaving a real Postgres
    // connection pool can produce under concurrent requests since the
    // route's SELECT and UPDATE are two independent round-trips with no
    // transaction/row lock tying them together.
    armInterleaveGate(2);

    const [resA, resB] = await Promise.all([
      request(app)
        .put('/presentations/decks/deck-1/autosave')
        .set('x-deck-version', '1')
        .send({ cards: [{ card_id: 'c1', title: 'Writer A' }] }),
      request(app)
        .put('/presentations/decks/deck-1/autosave')
        .set('x-deck-version', '1')
        .send({ cards: [{ card_id: 'c1', title: 'Writer B' }] }),
    ]);

    // Current (gap) behaviour: NEITHER request is rejected with 409, because
    // both SELECTs observed the same pre-write snapshot before either
    // UPDATE landed — there is no compare-and-swap (`AND version = ?`) in
    // the UPDATE's WHERE clause to catch this after the fact.
    expect([resA.status, resB.status]).toEqual([200, 200]);
    expect(resA.body.success).toBe(true);
    expect(resB.body.success).toBe(true);

    // Both bumped from the SAME base version (1 -> 2), so the final DB state
    // reflects whichever write physically landed last — the other writer's
    // change is silently lost with no signal to either client.
    expect(resA.body.version).toBe(2);
    expect(resB.body.version).toBe(2);
    expect(deckState.version).toBe(2);
  });
});
