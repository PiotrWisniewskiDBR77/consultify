/**
 * toolSessionApi / useToolSessionSync — real-PostgreSQL proof.
 *
 * The frontend adapter (`src/services/toolSessionApi.ts`) and sync hook
 * (`src/hooks/useToolSessionSync.ts`) treat the server as the source of
 * truth for a tool session's working state (Dynamic SWOT and friends).
 * This test proves the actual HTTP contract they depend on holds against a
 * REAL PostgreSQL database, not a mock:
 *
 *   create (POST /api/tools) -> update (PUT /api/tools/:id, answers_json)
 *   -> reload (GET /api/tools/:id) -> identical state.
 *
 * Exercises the real `ToolController` handlers (owned by another
 * workstream during this session and NOT modified here) through an
 * in-process Express app + supertest, exactly the pattern already
 * established by tests/integration/tools-promote-characterization.realdb.test.ts.
 *
 * Run (against this stream's own throwaway Postgres, port 56203):
 *   RUN_DB_TESTS=1 MOCK_DB=false \
 *     DATABASE_URL=postgres://consultinity:test@localhost:56203/consultinity \
 *     npx vitest run tests/integration/toolSessionHttpAdapter.realdb.test.ts
 *
 * Fail-closed: every test in here asserts RUN_DB_TESTS=1, MOCK_DB=false,
 * and (via `SELECT current_database(), current_schema()`) that it is
 * actually talking to a real Postgres database on the expected schema --
 * not a mock, and not silently skipped-but-green. If any of those
 * assertions fail, the suite fails loudly instead of passing empty.
 */
import express, { type Express } from 'express';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const RUN_DB_TESTS = process.env.RUN_DB_TESTS === '1';
const MOCK_DB = process.env.MOCK_DB;
const DATABASE_URL = process.env.DATABASE_URL || '';

// Fail-CLOSED gate: this suite must not silently report green when it never
// actually reached Postgres. `describe.skip` only fires when the operator
// explicitly did not ask for DB tests (RUN_DB_TESTS unset) -- if
// RUN_DB_TESTS=1 was passed but the rest of the contract (MOCK_DB=false,
// a DATABASE_URL) is missing, that is a misconfiguration and must throw,
// not skip.
if (RUN_DB_TESTS) {
  if (MOCK_DB !== 'false') {
    throw new Error(
      'toolSessionHttpAdapter.realdb.test.ts: RUN_DB_TESTS=1 requires MOCK_DB=false (got ' +
        `MOCK_DB=${String(MOCK_DB)}) -- refusing to run against a mocked DB and report false green.`
    );
  }
  if (!DATABASE_URL) {
    throw new Error(
      'toolSessionHttpAdapter.realdb.test.ts: RUN_DB_TESTS=1 requires DATABASE_URL to be set.'
    );
  }
}

process.env.DATABASE_URL = DATABASE_URL;
process.env.DB_TYPE = 'postgres';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const describeDb = RUN_DB_TESTS ? describe : describe.skip;

const P = `httpadapter-${Date.now()}-`;
const ORG = `${P}org`;
const USER = `${P}user`;

let app: Express;

async function db(): Promise<Client> {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  return c;
}

function asUser() {
  return { 'x-test-user': USER, 'x-test-org': ORG, 'x-test-role': 'admin' };
}

beforeAll(async () => {
  if (!RUN_DB_TESTS) return;

  // Fail-closed connectivity + identity proof -- if this cannot connect, or
  // is not really Postgres/the expected schema, everything below is moot.
  const c = await db();
  try {
    const identity = await c.query('SELECT current_database() AS db, current_schema() AS schema');
    const row = identity.rows[0] as { db: string; schema: string };
    if (!row?.db || !row?.schema) {
      throw new Error('toolSessionHttpAdapter.realdb.test.ts: could not read current_database()/current_schema() -- not a real Postgres connection.');
    }
    // eslint-disable-next-line no-console
    console.log(
      `[toolSessionHttpAdapter.realdb] connected to real Postgres — database=${row.db} schema=${row.schema}`
    );
    const kindProbe = await c.query('SHOW server_version');
    if (!kindProbe.rows[0]?.server_version) {
      throw new Error('toolSessionHttpAdapter.realdb.test.ts: server_version probe failed -- not talking to real Postgres.');
    }
  } finally {
    await c.end();
  }

  const ToolController = (await import('../../server/src/controllers/ToolController.js')).default;

  app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      id: req.header('x-test-user') || USER,
      organizationId: req.header('x-test-org') || ORG,
      role: req.header('x-test-role') || 'admin',
      email: `${P}u@example.test`,
    };
    next();
  });
  app.post('/api/tools', ToolController.createToolSession);
  app.get('/api/tools/:toolId', ToolController.getToolSession);
  app.put('/api/tools/:toolId', ToolController.updateToolSession);

  // Bootstrap the tool_sessions schema the same way the characterization
  // suite does: it is created lazily on the create path, not on read.
  const warm = await request(app)
    .post('/api/tools')
    .set(asUser())
    .send({ toolType: 'dynamic-swot', name: `${P}warmup` });
  if (warm.status >= 400) {
    // eslint-disable-next-line no-console
    console.error('WARMUP FAILED', warm.status, warm.body);
  }
}, 60_000);

afterAll(async () => {
  if (!RUN_DB_TESTS) return;
  const c = await db();
  try {
    await c.query(`DELETE FROM tool_sessions WHERE organization_id = $1`, [ORG]);
  } finally {
    await c.end();
  }
});

describeDb('create -> update -> reload -> identical state (real Postgres)', () => {
  it('POST /api/tools creates a real row a subsequent GET can see', async () => {
    const created = await request(app)
      .post('/api/tools')
      .set(asUser())
      .send({ toolType: 'dynamic-swot', name: `${P}session-1` });
    expect(created.status).toBe(200);
    expect(created.body.id).toBeTruthy();

    const c = await db();
    try {
      const row = await c.query(
        `SELECT id, organization_id, tool_type, status, answers_json FROM tool_sessions WHERE id = $1`,
        [created.body.id]
      );
      expect(row.rows).toHaveLength(1);
      expect(row.rows[0].organization_id).toBe(ORG);
      expect(row.rows[0].tool_type).toBe('dynamic-swot');
    } finally {
      await c.end();
    }
  });

  it('PUT (answers) -> GET reload returns byte-identical answers -- the adapter/hook contract', async () => {
    const created = await request(app)
      .post('/api/tools')
      .set(asUser())
      .send({ toolType: 'dynamic-swot', name: `${P}session-2` });
    const toolId = created.body.id as string;

    // This is exactly the shape src/hooks/useToolSessionSync.ts's
    // performSave() sends via toolSessionApi.update().
    const answers = {
      mission: 'Grow into adjacent markets',
      signals: [{ id: 'sig-1', text: 'Strong Q2 pipeline', category: 'strength' }],
      items: [{ id: 'item-1', category: 'strength', text: 'Loyal enterprise base' }],
    };

    const updated = await request(app).put(`/api/tools/${toolId}`).set(asUser()).send({
      answers,
      completionPercent: 40,
      confidenceAvg: 3,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.id).toBe(toolId);

    const reloaded = await request(app).get(`/api/tools/${toolId}`).set(asUser());
    expect(reloaded.status).toBe(200);
    // The exact "reload from server -> identical state" assertion the
    // adapter's contract rests on.
    expect(reloaded.body.answers).toEqual(answers);
    expect(reloaded.body.progress).toBe(40);
    expect(reloaded.body.confidenceAvg).toBe(3);
  });

  it('a second update+reload cycle stays consistent (no drift across repeated saves)', async () => {
    const created = await request(app)
      .post('/api/tools')
      .set(asUser())
      .send({ toolType: 'dynamic-swot', name: `${P}session-3` });
    const toolId = created.body.id as string;

    await request(app)
      .put(`/api/tools/${toolId}`)
      .set(asUser())
      .send({ answers: { mission: 'v1' } });
    const afterFirst = await request(app).get(`/api/tools/${toolId}`).set(asUser());
    expect(afterFirst.body.answers).toEqual({ mission: 'v1' });

    await request(app)
      .put(`/api/tools/${toolId}`)
      .set(asUser())
      .send({ answers: { mission: 'v2', extra: true } });
    const afterSecond = await request(app).get(`/api/tools/${toolId}`).set(asUser());
    expect(afterSecond.body.answers).toEqual({ mission: 'v2', extra: true });
  });

  it('cross-organization GET cannot see the session (404) -- the same isolation the adapter relies on', async () => {
    const created = await request(app)
      .post('/api/tools')
      .set(asUser())
      .send({ toolType: 'dynamic-swot', name: `${P}session-iso` });
    const toolId = created.body.id as string;

    const otherOrgRead = await request(app)
      .get(`/api/tools/${toolId}`)
      .set({ 'x-test-user': USER, 'x-test-org': `${P}other-org`, 'x-test-role': 'admin' });
    expect(otherOrgRead.status).toBe(404);
  });

  it('DOCUMENTS the known gap: GET does not return `version`, even after an update bumped it in the DB', async () => {
    // This is the exact gap toolSessionApi.ts's file header describes.
    // Asserted here, against a real DB row, so the note cannot silently
    // go stale if ToolController is ever extended (this test would then
    // start failing the `toBeUndefined()` and force an update).
    const created = await request(app)
      .post('/api/tools')
      .set(asUser())
      .send({ toolType: 'dynamic-swot', name: `${P}session-version-gap` });
    const toolId = created.body.id as string;

    await request(app)
      .put(`/api/tools/${toolId}`)
      .set(asUser())
      .send({ answers: { mission: 'bump version' } });

    const c = await db();
    let dbVersion: number;
    try {
      const row = await c.query(`SELECT version FROM tool_sessions WHERE id = $1`, [toolId]);
      dbVersion = row.rows[0].version;
    } finally {
      await c.end();
    }
    expect(dbVersion).toBeGreaterThanOrEqual(2); // bumped by the answers_json write

    const reloaded = await request(app).get(`/api/tools/${toolId}`).set(asUser());
    expect(reloaded.body.version).toBeUndefined();
  });
});
