/**
 * MAT-006B — Atelier deck canonical round-trip against the REAL route layer.
 *
 * This is the test that would have caught the staging blocker before Codex hit
 * it on `demo.consultify.ai`. It drives the ACTUAL `presentations.routes`
 * Express router with supertest, backed by real in-memory SQLite through the
 * `DbPromise` seam, and walks the exact path a presenter walks:
 *
 *     canonical seed → GET /decks (list)  → GET /decks/:id (builder open)
 *
 * The invariant under test: what the list advertises and what the builder can
 * render must be the same number. On `demo` they were 11 and 0.
 *
 * Anti-false-green: the fixture rows are written by the PRODUCTION seed
 * (`seedAtelierPresentationDecks`), not hand-built in the test, and every count
 * assertion reads back through an HTTP response — nothing here echoes an input.
 * The first test deliberately reproduces the broken row shape first, asserts the
 * failure is visible, and only then seeds.
 */
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const sqliteCtx = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sqlite3 = require('sqlite3') as typeof import('sqlite3');
  return { db: new sqlite3.Database(':memory:') };
});

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: <T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> =>
    new Promise((resolve) => {
      sqliteCtx.db.all(sql, params, (err: Error | null, rows: unknown[]) =>
        resolve(err ? [] : ((rows || []) as T[]))
      );
    }),
  get: <T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> => {
    // The seed probes Postgres' information_schema; answer as a migrated DB.
    if (/information_schema\.(tables|columns)/i.test(sql)) {
      return Promise.resolve({ exists: true } as T);
    }
    return new Promise((resolve) => {
      sqliteCtx.db.get(sql, params, (err: Error | null, row: unknown) =>
        resolve(err ? null : ((row || null) as T | null))
      );
    });
  },
  run: (
    sql: string,
    params: unknown[] = []
  ): Promise<{ success: boolean; changes?: number; error?: string }> =>
    new Promise((resolve, reject) => {
      sqliteCtx.db.run(sql, params, function (this: { changes: number }, err: Error | null) {
        if (err) return reject(err);
        resolve({ success: true, changes: this.changes });
      });
    }),
}));

const mockUser = { id: 'user-1', role: 'ADMIN', organizationId: 'atelier' };

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = mockUser;
    req.userId = mockUser.id;
    req.userRole = mockUser.role;
    req.organizationId = mockUser.organizationId;
    next();
  },
}));

vi.mock('../../../server/src/middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../server/src/middleware/requireAudit.middleware.js', () => ({
  requireAudit: (req: any, _res: any, next: () => void) => {
    req.emitAuditEvent = async () => undefined;
    next();
  },
}));

const ORG = 'atelier';
const STEERING_ID = 'atelier--deck--line3-steering';
const ANCHOR = '2026-06-01T00:00:00.000Z';

let app: express.Express;
let seedAtelierPresentationDecks: typeof import('../../../server/src/services/demo/atelierPresentationDeckSeed.js').seedAtelierPresentationDecks;

function ddl(): Promise<void> {
  return new Promise((resolve, reject) => {
    sqliteCtx.db.exec(
      `CREATE TABLE IF NOT EXISTS presentation_decks (
         id TEXT PRIMARY KEY,
         organization_id TEXT,
         title TEXT,
         description TEXT,
         template_id TEXT NOT NULL DEFAULT 'default',
         deck_type TEXT,
         audience TEXT,
         goal TEXT,
         language TEXT,
         confidentiality TEXT,
         theme TEXT,
         presentation_mode TEXT,
         source_type TEXT,
         source_id TEXT,
         source_artifacts TEXT,
         outline_json TEXT,
         unified_json TEXT,
         deck_json TEXT,
         source_refs_json TEXT,
         validation_warnings TEXT,
         slide_count INTEGER DEFAULT 0,
         status TEXT,
         export_format TEXT,
         exported_at TIMESTAMP,
         export_path TEXT,
         thumbnail_url TEXT,
         generated_by TEXT,
         created_by TEXT,
         version INTEGER NOT NULL DEFAULT 1,
         created_at TIMESTAMP,
         updated_at TIMESTAMP
       );
       CREATE TABLE IF NOT EXISTS users (
         id TEXT PRIMARY KEY,
         organization_id TEXT,
         first_name TEXT,
         last_name TEXT
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

beforeAll(async () => {
  await ddl();
  const seedModule = await import(
    '../../../server/src/services/demo/atelierPresentationDeckSeed.js'
  );
  seedAtelierPresentationDecks = seedModule.seedAtelierPresentationDecks;
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
  await run('DELETE FROM presentation_decks');
});

describe('MAT-006B — Atelier deck canonical round-trip (real SQL, real router)', () => {
  it('reproduces the staging blocker on the legacy row shape, then fixes it with the seed', async () => {
    // AS-IS on demo: "Ready", slide_count 11, no content columns at all.
    await run(
      `INSERT INTO presentation_decks
         (id, organization_id, title, template_id, slide_count, status, version, updated_at)
       VALUES (?, ?, ?, 'executive-standard', 11, 'ready', 1, '2026-07-04T03:21:31.624Z')`,
      [STEERING_ID, ORG, 'Line 3 Digital Twin — Steering Committee Deck']
    );

    // The list must NOT advertise slides the deck cannot serve.
    const brokenList = await request(app).get('/api/presentations/decks');
    expect(brokenList.status).toBe(200);
    const brokenRow = brokenList.body.data.find((d: any) => d.id === STEERING_ID);
    expect(brokenRow).toBeDefined();
    expect(brokenRow.declared_slide_count).toBe(11); // the column still says 11
    expect(brokenRow.slide_count).toBe(0); // ...but the API refuses to repeat it
    expect(brokenRow.content_state).toBe('missing');

    // Canonical GET tells the same story instead of returning a silent empty deck.
    const brokenDetail = await request(app).get(`/api/presentations/decks/${STEERING_ID}`);
    expect(brokenDetail.status).toBe(200);
    expect(brokenDetail.body.data.content_state).toBe('missing');
    expect(brokenDetail.body.data.slide_count).toBe(0);

    // Now run the canonical seed — the actual fix.
    await seedAtelierPresentationDecks({ organizationId: ORG, anchorDate: ANCHOR });

    const list = await request(app).get('/api/presentations/decks');
    const row = list.body.data.find((d: any) => d.id === STEERING_ID);
    expect(row.content_state).toBe('canonical');
    expect(row.slide_count).toBe(11);
    expect(row.status).toBe('ready');

    const detail = await request(app).get(`/api/presentations/decks/${STEERING_ID}`);
    expect(detail.status).toBe(200);
    const deckJson = JSON.parse(detail.body.data.deck_json);
    // THE invariant: list count === canonical GET count === renderable cards.
    expect(deckJson.cards.length).toBe(11);
    expect(detail.body.data.slide_count).toBe(deckJson.cards.length);
    expect(detail.body.data.slide_count).toBe(row.slide_count);
    expect(detail.body.data.content_state).toBe('canonical');
  });

  it('every seeded Atelier deck opens with exactly the cards its list entry promises', async () => {
    await seedAtelierPresentationDecks({ organizationId: ORG, anchorDate: ANCHOR });

    const list = await request(app).get('/api/presentations/decks');
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBe(3);

    for (const listRow of list.body.data) {
      expect(listRow.content_state, `${listRow.id} has no canonical content`).toBe('canonical');
      expect(listRow.slide_count, `${listRow.id} advertises zero slides`).toBeGreaterThan(0);

      const detail = await request(app).get(`/api/presentations/decks/${listRow.id}`);
      expect(detail.status).toBe(200);
      const deckJson = JSON.parse(detail.body.data.deck_json);
      expect(deckJson.cards.length, `${listRow.id} list/builder mismatch`).toBe(
        listRow.slide_count
      );
      // Cards must be renderable, not placeholders — this is what "Ready" claims.
      for (const card of deckJson.cards) {
        expect(String(card.title || '').trim().length).toBeGreaterThan(0);
        expect(Array.isArray(card.blocks) && card.blocks.length).toBeTruthy();
      }
    }
  });

  it('a seeded deck is tenant-scoped: another org gets 404 on the canonical GET', async () => {
    await seedAtelierPresentationDecks({ organizationId: ORG, anchorDate: ANCHOR });
    const previousOrg = mockUser.organizationId;
    mockUser.organizationId = 'other-tenant';
    try {
      const detail = await request(app).get(`/api/presentations/decks/${STEERING_ID}`);
      expect(detail.status).toBe(404);
      const list = await request(app).get('/api/presentations/decks');
      expect(list.body.data).toEqual([]);
    } finally {
      mockUser.organizationId = previousOrg;
    }
  });
});
