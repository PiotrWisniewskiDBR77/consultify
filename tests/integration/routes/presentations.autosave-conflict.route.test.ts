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
 * P0.5 FIX: the UPDATE now carries its own compare-and-swap guard —
 * `UPDATE ... WHERE id = ? AND organization_id = ? AND version = ?`, where
 * the expected version is the client-supplied version (or the just-read
 * server version, for header-less callers) — and the handler branches on
 * `changes === 0` to return the same 409 VERSION_CONFLICT shape as the
 * pre-existing stale-read check. This closes the lost-update race: under
 * true concurrency, where both requests interleave their SELECT before
 * either UPDATE commits and both observe the SAME `deck.version`, only the
 * writer whose UPDATE lands first still matches `version = expectedVersion`;
 * the second writer's UPDATE matches zero rows (the row has already moved
 * on), so it now gets 409 instead of silently overwriting the winner. See
 * presentations.routes.ts:2172-2260.
 *
 * The tests below pin CURRENT observable behaviour:
 *  1. Sequential autosave with an up-to-date version -> 200, version bumped.
 *  2. Sequential autosave with a stale (behind) version -> 409 VERSION_CONFLICT.
 *  3. Two "concurrent" writers that both read version N before either writes
 *     (simulated via a controllable DB mock) -> exactly ONE succeeds (200)
 *     and the OTHER is rejected (409 VERSION_CONFLICT), because the losing
 *     writer's compare-and-swap UPDATE no longer matches the row's version.
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
let deckState: { version: number; deck_json: string; slide_count: number };
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
    // Mirrors the real compare-and-swap: `UPDATE ... WHERE id = ? AND
    // organization_id = ? AND version = ?`. Only mutate `deckState` (and
    // report changes: 1) when the expected version in the WHERE clause
    // still matches the CURRENT row version at the moment this UPDATE
    // actually executes -- i.e. after any interleave-gate release, so a
    // second writer whose expected version was overtaken by the first
    // writer's commit sees changes: 0, just like a real DB's rowCount.
    const [, newDeckJson, newVersion, , , expectedVersion] = params as [
      string,
      string,
      number,
      string,
      string,
      number,
    ];
    if (deckState.version === expectedVersion) {
      const parsed = JSON.parse(newDeckJson);
      deckState = {
        version: newVersion,
        deck_json: newDeckJson,
        slide_count: Array.isArray(parsed?.cards) ? parsed.cards.length : 0,
      };
      return { success: true, changes: 1 };
    }
    return { success: true, changes: 0 };
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

describe('P0.4 — PUT /presentations/decks/:deckId/autosave version-conflict contract', () => {
  beforeEach(() => {
    deckState = {
      version: 1,
      deck_json: JSON.stringify({ schemaVersion: 1, cards: [] }),
      slide_count: 0,
    };
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
    expect(deckState.slide_count).toBe(1);
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
    deckState = {
      version: 5,
      deck_json: JSON.stringify({ schemaVersion: 1, cards: [] }),
      slide_count: 0,
    };
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
  // P0.5 regression guard — see file header. Asserts the compare-and-swap
  // fix: two writers who both observed version N under true concurrency no
  // longer BOTH win; exactly one succeeds and the other is rejected.
  // -------------------------------------------------------------------
  it('two interleaved writers that both read version=1 -> exactly ONE gets 200, the OTHER gets 409 (no lost update)', async () => {
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

    // Fixed behaviour: both SELECTs observed the same pre-write snapshot
    // before either UPDATE landed, but the UPDATE's own compare-and-swap
    // guard (`AND version = ?`) means only the writer whose UPDATE commits
    // FIRST still matches the row (version still 1); the second writer's
    // UPDATE matches zero rows because the first writer already bumped it
    // to 2, so it is rejected with 409 instead of silently overwriting.
    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);

    const [winner, loser] = resA.status === 200 ? [resA, resB] : [resB, resA];
    expect(winner.body).toMatchObject({ success: true, version: 2 });
    expect(loser.body).toMatchObject({
      success: false,
      code: 'VERSION_CONFLICT',
      serverVersion: 2,
      clientVersion: 1,
    });

    // The DB ends up on the winner's content, with no silent overwrite: the
    // loser was told to refresh instead of clobbering the winner's write.
    expect(deckState.version).toBe(2);
  });
});
