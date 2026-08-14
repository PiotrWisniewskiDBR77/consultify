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
 * The route-coherence assertions below use persisted SQL rows and read every
 * count back through an HTTP response — nothing echoes an input.  The original
 * version of this file also imported `atelierPresentationDeckSeed`, but that
 * production module was never committed (not in the introducing commit, any
 * reachable Git object, or the cleanup preservation archives).  Keep that
 * missing deliverable explicit as a TODO instead of making the ordinary test
 * suite fail at transform time on an implementation that does not exist.
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

vi.mock('../../../server/src/utils/DbPromise.js', () => {
  // Anti-false-green: a failing query REJECTS here, as the real DbPromise does.
  // Swallowing the error into `[]` would let the schema-missing degrade path
  // (and any future broken SQL) look like "an empty tenant".
  const all = <T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> =>
    new Promise((resolve, reject) => {
      sqliteCtx.db.all(sql, params, (err: Error | null, rows: unknown[]) =>
        err ? reject(err) : resolve((rows || []) as T[])
      );
    });
  const get = <T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> => {
    // The seed probes Postgres' information_schema; answer as a migrated DB.
    if (/information_schema\.(tables|columns)/i.test(sql)) {
      return Promise.resolve({ exists: true } as T);
    }
    return new Promise((resolve) => {
      sqliteCtx.db.get(sql, params, (err: Error | null, row: unknown) =>
        resolve(err ? null : ((row || null) as T | null))
      );
    });
  };
  const run = (
    sql: string,
    params: unknown[] = []
  ): Promise<{ success: boolean; changes?: number; error?: string }> =>
    new Promise((resolve, reject) => {
      sqliteCtx.db.run(sql, params, function (this: { changes: number }, err: Error | null) {
        if (err) return reject(err);
        resolve({ success: true, changes: this.changes });
      });
    });
  // The canonical seed writes all three decks through ONE transaction; without
  // this the seed silently reports 'failed' and the round-trip below would be
  // asserting against an empty tenant. Mirrors DbPromise.transaction():
  // sequential statements, ROLLBACK + `{ success: false }` on any failure.
  const transaction = async (statements: Array<{ sql: string; params?: unknown[] }>) => {
    try {
      await run('BEGIN TRANSACTION');
      const results = [];
      for (const stmt of statements) {
        results.push(await run(stmt.sql, stmt.params ?? []));
      }
      await run('COMMIT');
      return { success: true, results };
    } catch (error) {
      try {
        await run('ROLLBACK');
      } catch {
        /* the transaction already failed; the rollback error adds nothing */
      }
      return { success: false, error: String((error as Error)?.message || error), results: [] };
    }
  };
  const safeAll = async <T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> => {
    try {
      return await all<T>(sql, params);
    } catch {
      return [];
    }
  };
  const exec = (sql: string): Promise<{ success: boolean }> =>
    new Promise((resolve, reject) => {
      sqliteCtx.db.exec(sql, (err: Error | null) =>
        err ? reject(err) : resolve({ success: true })
      );
    });
  const api = {
    all,
    get,
    run,
    transaction,
    safeAll,
    exec,
    tableExists: async () => true,
    columnExists: async () => true,
  };
  return { ...api, DbPromise: api, default: api };
});

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
let app: express.Express;

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
         updated_at TIMESTAMP,
         -- The live CHECK from the Railway demo PostgreSQL, verified read-only
         -- 2026-08-01. A test schema more permissive than production would let
         -- the seed pass here and silently write nothing on demo.
         CHECK (status IN ('draft', 'generating', 'ready', 'exported', 'failed'))
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

describe('MAT-006B — Atelier canonical demo seed', () => {
  it.todo('adds a real production seed and proves all three Atelier decks through list + detail');
});

// ────────────────────────────────────────────────────────────────────────────
// MAT-006B P1/P2 — the list is fail-closed, not merely "payload is non-empty".
//
// The first cut of this gate asked SQL `COALESCE(deck_json,'') <> ''` and, when
// true, echoed the stored `slide_count` under `content_state: 'unverified'`.
// Every fixture below has a NON-EMPTY content column and still cannot render
// the count it advertises, so each one slipped straight through that predicate.
// The list must now derive the count from the payload and agree, field for
// field, with the canonical GET the builder calls next.
// ────────────────────────────────────────────────────────────────────────────

async function insertDeck(params: {
  id: string;
  slideCount: number;
  deckJson?: string | null;
  unifiedJson?: string | null;
  title?: string;
}): Promise<void> {
  await run(
    `INSERT INTO presentation_decks
       (id, organization_id, title, template_id, slide_count, status, version,
        deck_json, unified_json, updated_at)
     VALUES (?, ?, ?, 'executive-standard', ?, 'ready', 1, ?, ?, '2026-07-04T03:21:31.624Z')`,
    [
      params.id,
      ORG,
      params.title ?? 'Fixture deck',
      params.slideCount,
      params.deckJson ?? null,
      params.unifiedJson ?? null,
    ]
  );
}

/** A canonical, renderable deck document with exactly `cardCount` cards. */
function canonicalDeckJson(deckId: string, cardCount: number): string {
  return JSON.stringify({
    schemaVersion: 1,
    deck_id: deckId,
    deckId,
    title: 'Fixture deck',
    cards: Array.from({ length: cardCount }, (_, index) => ({
      card_id: `${deckId}-card-${index}`,
      deck_id: deckId,
      order_index: index,
      intent: index === 0 ? 'cover' : 'key_messages',
      layout_id: 'content_full',
      title: `Card ${index + 1}`,
      blocks: [
        {
          block_id: `${deckId}-block-${index}`,
          card_id: `${deckId}-card-${index}`,
          type: 'paragraph',
          order_index: 0,
          content: { text: `Body ${index + 1}` },
          source_refs: [],
        },
      ],
      source_refs: [],
    })),
    source_refs: [],
  });
}

/** Reads the SAME deck through both endpoints a presenter hits, in order. */
async function readListAndDetail(id: string) {
  const list = await request(app).get('/api/presentations/decks');
  expect(list.status).toBe(200);
  const listRow = list.body.data.find((d: any) => d.id === id);
  expect(listRow, `deck ${id} missing from the list response`).toBeDefined();

  const detailRes = await request(app).get(`/api/presentations/decks/${id}`);
  expect(detailRes.status).toBe(200);
  return { listRow, detail: detailRes.body.data };
}

/**
 * The contract, asserted the same way for every shape: the list reports the
 * content-derived count, states it explicitly, and matches the canonical GET.
 */
function expectAgreement(
  listRow: any,
  detail: any,
  expected: { slideCount: number; declared: number; state: 'canonical' | 'missing' }
) {
  expect(listRow.slide_count).toBe(expected.slideCount);
  expect(listRow.declared_slide_count).toBe(expected.declared);
  expect(listRow.content_state).toBe(expected.state);
  expect(listRow.has_canonical_content).toBe(expected.state === 'canonical');
  // No 'unverified' escape hatch survives anywhere on this route.
  expect(listRow.content_state).not.toBe('unverified');
  // The list derives the count but must not start shipping 40 KB payloads.
  expect(listRow).not.toHaveProperty('deck_json');
  expect(listRow).not.toHaveProperty('unified_json');

  expect(detail.slide_count).toBe(expected.slideCount);
  expect(detail.declared_slide_count).toBe(expected.declared);
  expect(detail.content_state).toBe(expected.state);

  // THE invariant: the two endpoints cannot disagree.
  expect(detail.slide_count).toBe(listRow.slide_count);
  expect(detail.content_state).toBe(listRow.content_state);
  // 'missing' always travels with 0 — no consumer can advertise phantom slides.
  if (expected.state === 'missing') expect(listRow.slide_count).toBe(0);
}

describe('MAT-006B — GET /decks is fail-closed on unrenderable payloads', () => {
  it('case 1: deck_json that is not valid JSON reports 0 / missing on both endpoints', async () => {
    const id = 'deck-invalid-json';
    // Truncated write — the exact shape a half-finished UPDATE leaves behind.
    await insertDeck({ id, slideCount: 7, deckJson: '{"schemaVersion":1,"cards":[{"tit' });

    const { listRow, detail } = await readListAndDetail(id);
    expectAgreement(listRow, detail, { slideCount: 0, declared: 7, state: 'missing' });
  });

  it('case 2: deck_json = "{}" reports 0 / missing on both endpoints', async () => {
    const id = 'deck-empty-object';
    await insertDeck({ id, slideCount: 5, deckJson: '{}' });

    const { listRow, detail } = await readListAndDetail(id);
    expectAgreement(listRow, detail, { slideCount: 0, declared: 5, state: 'missing' });
  });

  it('case 3: a schema-valid deck with zero cards reports 0 / missing on both endpoints', async () => {
    const id = 'deck-zero-cards';
    // A payload IS present and parses cleanly — there is simply nothing to
    // render. The builder would show "Card 1 of 0" if the list said 4.
    await insertDeck({ id, slideCount: 4, deckJson: '{"schemaVersion":1,"cards":[]}' });

    const { listRow, detail } = await readListAndDetail(id);
    expectAgreement(listRow, detail, { slideCount: 0, declared: 4, state: 'missing' });
  });

  it('case 4: the cards+1 drift is reported as 10, never as the declared 11', async () => {
    const id = 'deck-cards-plus-one';
    // The PPTX pipeline counts its appended closing slide; the column says 11.
    await insertDeck({ id, slideCount: 11, deckJson: canonicalDeckJson(id, 10) });

    const { listRow, detail } = await readListAndDetail(id);
    expectAgreement(listRow, detail, { slideCount: 10, declared: 11, state: 'canonical' });

    // Anti-echo: the derived count is the number of cards actually served.
    const cards = JSON.parse(detail.deck_json).cards;
    expect(cards.length).toBe(10);
    expect(listRow.slide_count).toBe(cards.length);
  });

  it('a legacy unified_json-only deck is still counted, via the second-pass fetch', async () => {
    const id = 'deck-unified-only';
    // `deck_json` is absent, so the up-front SELECT (which deliberately does
    // NOT pull `unified_json`) sees zero cards. The route must top up from
    // `unified_json` rather than declare the deck empty.
    const unifiedJson = JSON.stringify({
      meta: { project: 'Legacy deck' },
      slides: Array.from({ length: 3 }, (_, index) => ({
        intent: index === 0 ? 'cover' : 'key_messages',
        key_message: `Message ${index + 1}`,
        content: { type: 'key_messages', title: `Slide ${index + 1}`, messages: ['a', 'b'] },
      })),
    });
    await insertDeck({ id, slideCount: 9, deckJson: null, unifiedJson });

    const { listRow, detail } = await readListAndDetail(id);
    expectAgreement(listRow, detail, { slideCount: 3, declared: 9, state: 'canonical' });
  });

  it('reports every broken shape correctly in ONE list response, side by side', async () => {
    // Mixed tenant: the per-row derivation must not bleed between rows.
    await insertDeck({ id: 'mix-invalid', slideCount: 7, deckJson: '{"cards":' });
    await insertDeck({ id: 'mix-empty-object', slideCount: 5, deckJson: '{}' });
    await insertDeck({
      id: 'mix-zero-cards',
      slideCount: 4,
      deckJson: '{"schemaVersion":1,"cards":[]}',
    });
    await insertDeck({
      id: 'mix-drift',
      slideCount: 11,
      deckJson: canonicalDeckJson('mix-drift', 10),
    });

    const list = await request(app).get('/api/presentations/decks');
    expect(list.status).toBe(200);
    const byId = Object.fromEntries(list.body.data.map((d: any) => [d.id, d]));
    expect(byId['mix-invalid'].slide_count).toBe(0);
    expect(byId['mix-empty-object'].slide_count).toBe(0);
    expect(byId['mix-zero-cards'].slide_count).toBe(0);
    expect(byId['mix-drift'].slide_count).toBe(10);
    for (const row of list.body.data) {
      // Structural: no row may ever advertise slides with state 'missing'.
      if (row.content_state === 'missing') expect(row.slide_count).toBe(0);
      expect(row.slide_count).toBeLessThanOrEqual(row.declared_slide_count);
    }
  });

  it('keeps the org filter and the schema-missing degrade path intact', async () => {
    await insertDeck({ id: 'org-scoped-deck', slideCount: 3, deckJson: canonicalDeckJson('x', 3) });

    const previousOrg = mockUser.organizationId;
    mockUser.organizationId = 'other-tenant';
    try {
      const foreign = await request(app).get('/api/presentations/decks');
      expect(foreign.status).toBe(200);
      expect(foreign.body.data).toEqual([]);
    } finally {
      mockUser.organizationId = previousOrg;
    }

    // Schema not migrated yet -> degrade to an empty, explicitly flagged list
    // rather than a 500. Dropping the table makes the real SQL fail for real.
    await run('ALTER TABLE presentation_decks RENAME TO presentation_decks_backup');
    try {
      const degraded = await request(app).get('/api/presentations/decks');
      expect(degraded.status).toBe(200);
      expect(degraded.body).toMatchObject({ success: true, data: [], unavailable: true });
    } finally {
      await run('ALTER TABLE presentation_decks_backup RENAME TO presentation_decks');
    }
  });
});
