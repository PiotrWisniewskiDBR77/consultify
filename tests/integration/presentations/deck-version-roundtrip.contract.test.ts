/**
 * M19 · L-07 — Deck version snapshot round-trip (S4) against a real SQL store.
 *
 * Background: 15/21 integration "tests" in the legacy p20 suite are vacuous —
 * they `fetch('localhost:3001')` and `if (status !== 201) return`, so with no
 * server running they pass without asserting anything (false green). There was
 * also NO real S4 test proving that autosave → version snapshot → restore
 * survives a "reload" on the actual SQL store.
 *
 * This test mounts the REAL `presentations.routes` Express router and drives it
 * with supertest. The persistence seam (`DbPromise` get/all/run) is backed by an
 * in-memory SQLite database, so the handlers run their ACTUAL SQL —
 * `INSERT INTO presentation_deck_versions` (mig.752), the version-history
 * SELECT, and the restore UPDATE — against a genuine store.
 *
 * Anti-false-green: SQLite physically stores rows. A fresh GET /versions reads
 * them back through a SEPARATE request (= reload, no handler-level cache), and
 * restore is proven by re-reading the live deck JSON. If autosave stopped
 * writing snapshots, or restore stopped rehydrating deck_json, these assertions
 * FAIL — they are not echoes of the request payload.
 *
 * The route SQL already uses `?` placeholders (DbPromise is a SQLite wrapper),
 * so no $N→? translation is needed.
 */
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Real in-memory SQLite behind the DbPromise seam ----------------------
const sqliteCtx = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sqlite3 = require('sqlite3') as typeof import('sqlite3');
  return { db: new sqlite3.Database(':memory:') };
});

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// DbPromise is the ONLY persistence seam these handlers touch. Back it with
// real SQLite so the handlers' SQL actually executes and rows actually persist.
vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: <T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> =>
    new Promise((resolve) => {
      sqliteCtx.db.all(sql, params, (err: Error | null, rows: unknown[]) =>
        resolve(err ? [] : ((rows || []) as T[]))
      );
    }),
  get: <T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> =>
    new Promise((resolve) => {
      sqliteCtx.db.get(sql, params, (err: Error | null, row: unknown) =>
        resolve(err ? null : ((row || null) as T | null))
      );
    }),
  run: (
    sql: string,
    params: unknown[] = []
  ): Promise<{ success: boolean; changes?: number; error?: string }> =>
    new Promise((resolve, reject) => {
      sqliteCtx.db.run(sql, params, function (this: { changes: number }, err: Error | null) {
        // Surface write failures so a broken INSERT/UPDATE cannot pass silently.
        if (err) return reject(err);
        resolve({ success: true, changes: this.changes });
      });
    }),
}));

// ---- Auth + org guard: inject a deterministic user, no real tokens ---------
let mockUser: any = { id: 'user-1', role: 'ADMIN', organizationId: 'org-A' };

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }
    req.user = mockUser;
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    next();
  },
}));

vi.mock('../../../server/src/middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (req: any, res: any, next: () => void) => {
    if (!req.user?.organizationId) {
      return res
        .status(403)
        .json({ error: 'Organization access required', code: 'RBAC_ORGANIZATION_ACCESS_REQUIRED' });
    }
    next();
  },
}));

vi.mock('../../../server/src/middleware/requireAudit.middleware.js', () => ({
  requireAudit: (req: any, _res: any, next: () => void) => {
    req.emitAuditEvent = async () => undefined;
    next();
  },
}));

// ---- DDL: real tables matching mig.752 + the columns the handlers touch ----
function ddl(): Promise<void> {
  return new Promise((resolve, reject) => {
    sqliteCtx.db.exec(
      `CREATE TABLE IF NOT EXISTS presentation_decks (
         id TEXT PRIMARY KEY,
         organization_id TEXT,
         title TEXT,
         deck_json TEXT,
         slide_count INTEGER NOT NULL DEFAULT 0,
         version INTEGER NOT NULL DEFAULT 1,
         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       );
       CREATE TABLE IF NOT EXISTS presentation_deck_versions (
         id TEXT PRIMARY KEY,
         deck_id TEXT NOT NULL,
         version INTEGER NOT NULL,
         deck_json_snapshot TEXT NOT NULL,
         slide_count INTEGER DEFAULT 0,
         created_by TEXT,
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       );`,
      (err) => (err ? reject(err) : resolve())
    );
  });
}

function run(sql: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    sqliteCtx.db.run(sql, params, (err: Error | null) => (err ? reject(err) : resolve()));
  });
}

function seedDeck(id: string, org: string, deckJson: string, version = 1): Promise<void> {
  return run(
    `INSERT INTO presentation_decks (id, organization_id, title, deck_json, version)
     VALUES (?, ?, ?, ?, ?)`,
    [id, org, 'Seed Deck', deckJson, version]
  );
}

const ORG = 'org-A';
const OTHER_ORG = 'org-B';

let app: express.Express;

beforeAll(async () => {
  await ddl();
  const { default: router } = await import('../../../server/src/routes/presentations.routes.js');
  app = express();
  app.use(express.json({ limit: '20mb' }));
  app.use('/api/presentations', router);
});

afterAll(
  () =>
    new Promise<void>((resolve, reject) => {
      sqliteCtx.db.close((err) => (err ? reject(err) : resolve()));
    })
);

beforeEach(async () => {
  mockUser = { id: 'user-1', role: 'ADMIN', organizationId: ORG };
  await run('DELETE FROM presentation_deck_versions');
  await run('DELETE FROM presentation_decks');
});

describe('M19 · L-07 — deck version snapshot round-trip (S4, real SQL)', () => {
  it('autosave writes a real snapshot row of the PREVIOUS deck_json and bumps version', async () => {
    // Seed a deck with v1 content. Autosave must snapshot the pre-edit JSON.
    const v1Json = JSON.stringify({ cards: [{ id: 'c1', title: 'Original' }] });
    await seedDeck('deck-1', ORG, v1Json, 1);

    const newBody = {
      cards: [
        { id: 'c1', title: 'Edited' },
        { id: 'c2', title: 'Added' },
      ],
    };
    const res = await request(app)
      .put('/api/presentations/decks/deck-1/autosave')
      .set('x-deck-version', '1')
      .send(newBody);

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(2);

    // A snapshot of the ORIGINAL (pre-autosave) JSON must physically exist.
    const versions = await request(app).get('/api/presentations/decks/deck-1/versions');
    expect(versions.status).toBe(200);
    expect(versions.body.data).toHaveLength(1);
    expect(versions.body.data[0].version).toBe(1); // snapshot captured prior version
    expect(versions.body.data[0].slide_count).toBe(1); // computed from original cards
  });

  it('round-trip: autosave → snapshot → restore rehydrates the OLD deck_json (survives reload)', async () => {
    const v1Json = JSON.stringify({ cards: [{ id: 'c1', title: 'Version One' }] });
    await seedDeck('deck-1', ORG, v1Json, 1);

    // Edit the deck — this snapshots v1 and writes v2 as live.
    await request(app)
      .put('/api/presentations/decks/deck-1/autosave')
      .set('x-deck-version', '1')
      .send({ cards: [{ id: 'c1', title: 'Version Two' }] });

    // Fetch the snapshot id back from the store (separate request = reload).
    const versions = await request(app).get('/api/presentations/decks/deck-1/versions');
    const snapshotId = versions.body.data[0].id as string;
    expect(snapshotId).toBeTruthy();

    // Restore the v1 snapshot.
    const restore = await request(app)
      .post(`/api/presentations/decks/deck-1/versions/${snapshotId}/restore`)
      .send({ expectedVersion: 2 });
    expect(restore.status).toBe(200);
    expect(restore.body.restoredFromVersion).toBe(1);

    // PROOF the live deck JSON was actually rehydrated from the snapshot store,
    // not echoed: read deck_json straight from SQLite.
    const liveDeck: any = await new Promise((resolve, reject) =>
      sqliteCtx.db.get(
        'SELECT deck_json, version FROM presentation_decks WHERE id = ?',
        ['deck-1'],
        (err: Error | null, row: unknown) => (err ? reject(err) : resolve(row))
      )
    );
    expect(JSON.parse(liveDeck.deck_json).cards[0].title).toBe('Version One');
    // restore also bumps version forward (history-preserving, no rewind of counter)
    expect(liveDeck.version).toBe(3);
  });

  it('autosave is org-scoped: another org cannot touch the deck (404, no snapshot leak)', async () => {
    await seedDeck('deck-1', ORG, JSON.stringify({ cards: [] }), 1);
    mockUser = { id: 'intruder', role: 'ADMIN', organizationId: OTHER_ORG };

    const res = await request(app)
      .put('/api/presentations/decks/deck-1/autosave')
      .send({ cards: [{ id: 'x', title: 'hijack' }] });

    expect(res.status).toBe(404);
    // No snapshot row should have been created for the cross-org write.
    const count: any = await new Promise((resolve, reject) =>
      sqliteCtx.db.get(
        'SELECT COUNT(*) AS n FROM presentation_deck_versions',
        [],
        (err: Error | null, row: unknown) => (err ? reject(err) : resolve(row))
      )
    );
    expect(count.n).toBe(0);
  });

  it('restore is org-scoped: cross-org restore is rejected (404)', async () => {
    const v1Json = JSON.stringify({ cards: [{ id: 'c1', title: 'One' }] });
    await seedDeck('deck-1', ORG, v1Json, 1);
    await request(app)
      .put('/api/presentations/decks/deck-1/autosave')
      .set('x-deck-version', '1')
      .send({ cards: [{ id: 'c1', title: 'Two' }] });
    const versions = await request(app).get('/api/presentations/decks/deck-1/versions');
    const snapshotId = versions.body.data[0].id as string;

    mockUser = { id: 'intruder', role: 'ADMIN', organizationId: OTHER_ORG };
    const restore = await request(app).post(
      `/api/presentations/decks/deck-1/versions/${snapshotId}/restore`
    );
    expect(restore.status).toBe(404);
  });

  it('restore rejects a stale expectedVersion with 409 and leaves live content unchanged', async () => {
    const v1Json = JSON.stringify({ cards: [{ id: 'c1', title: 'Version One' }] });
    await seedDeck('deck-1', ORG, v1Json, 1);
    await request(app)
      .put('/api/presentations/decks/deck-1/autosave')
      .set('x-deck-version', '1')
      .send({ cards: [{ id: 'c1', title: 'Version Two' }] });
    const versions = await request(app).get('/api/presentations/decks/deck-1/versions');
    const snapshotId = versions.body.data[0].id as string;
    const restore = await request(app)
      .post(`/api/presentations/decks/deck-1/versions/${snapshotId}/restore`)
      .send({ expectedVersion: 1 });
    expect(restore.status).toBe(409);
    expect(restore.body).toMatchObject({
      code: 'VERSION_CONFLICT',
      serverVersion: 2,
      clientVersion: 1,
    });
    const liveDeck: any = await new Promise((resolve, reject) =>
      sqliteCtx.db.get(
        'SELECT deck_json, version FROM presentation_decks WHERE id = ?',
        ['deck-1'],
        (err: Error | null, row: unknown) => (err ? reject(err) : resolve(row))
      )
    );
    expect(JSON.parse(liveDeck.deck_json).cards[0].title).toBe('Version Two');
    expect(liveDeck.version).toBe(2);
  });

  it('version conflict: stale x-deck-version is rejected 409 and writes NO snapshot', async () => {
    // Server deck is at v5; client thinks it is at v2 → conflict.
    await seedDeck('deck-1', ORG, JSON.stringify({ cards: [{ id: 'c1' }] }), 5);

    const res = await request(app)
      .put('/api/presentations/decks/deck-1/autosave')
      .set('x-deck-version', '2')
      .send({ cards: [{ id: 'c1', title: 'stale' }] });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('VERSION_CONFLICT');
    const count: any = await new Promise((resolve, reject) =>
      sqliteCtx.db.get(
        'SELECT COUNT(*) AS n FROM presentation_deck_versions',
        [],
        (err: Error | null, row: unknown) => (err ? reject(err) : resolve(row))
      )
    );
    expect(count.n).toBe(0); // conflict path must not persist a snapshot
  });

  it('concurrent autosaves with the same expected version create exactly one snapshot', async () => {
    await seedDeck('deck-1', ORG, JSON.stringify({ cards: [{ id: 'c1', title: 'v1' }] }), 1);

    const [first, second] = await Promise.all([
      request(app)
        .put('/api/presentations/decks/deck-1/autosave')
        .set('x-deck-version', '1')
        .send({ cards: [{ id: 'c1', title: 'writer-a' }] }),
      request(app)
        .put('/api/presentations/decks/deck-1/autosave')
        .set('x-deck-version', '1')
        .send({ cards: [{ id: 'c1', title: 'writer-b' }] }),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);

    const liveDeck: any = await new Promise((resolve, reject) =>
      sqliteCtx.db.get(
        'SELECT version FROM presentation_decks WHERE id = ?',
        ['deck-1'],
        (err: Error | null, row: unknown) => (err ? reject(err) : resolve(row))
      )
    );
    const snapshots: any = await new Promise((resolve, reject) =>
      sqliteCtx.db.get(
        'SELECT COUNT(*) AS n FROM presentation_deck_versions WHERE deck_id = ?',
        ['deck-1'],
        (err: Error | null, row: unknown) => (err ? reject(err) : resolve(row))
      )
    );

    expect(liveDeck.version).toBe(2);
    expect(snapshots.n).toBe(1);
  });

  it('multiple autosaves accumulate an ordered version history (DESC by version)', async () => {
    await seedDeck('deck-1', ORG, JSON.stringify({ cards: [{ id: 'c1', title: 'v1' }] }), 1);

    await request(app)
      .put('/api/presentations/decks/deck-1/autosave')
      .set('x-deck-version', '1')
      .send({ cards: [{ id: 'c1', title: 'v2' }] }); // snapshots v1, live→v2
    await request(app)
      .put('/api/presentations/decks/deck-1/autosave')
      .set('x-deck-version', '2')
      .send({ cards: [{ id: 'c1', title: 'v3' }] }); // snapshots v2, live→v3

    const versions = await request(app).get('/api/presentations/decks/deck-1/versions');
    expect(versions.body.data.map((v: any) => v.version)).toEqual([2, 1]);
  });
});
