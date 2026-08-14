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
 * Exercises the real `ToolController` handlers through an in-process
 * Express app + supertest, exactly the pattern already established by
 * tests/integration/tools-promote-characterization.realdb.test.ts.
 *
 * Run (against this stream's own throwaway Postgres):
 *   RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DB_TYPE=postgres \
 *     DATABASE_URL=postgres://consultinity:test@localhost:56500/consultinity \
 *     npx vitest run tests/integration/toolSessionHttpAdapter.realdb.test.ts
 *
 * Sprint S1 update (2026-08-13): originally written against a server that
 * did not yet check `expectedVersion` (see the file's original "DOCUMENTS
 * the known gap" test, since replaced below) and used `describe.skip` when
 * RUN_DB_TESTS was unset -- looks green in a report that never touched
 * Postgres. Rebased onto the now-shared `assertRealPostgres.ts` helper
 * (fail hard, never skip) and every PUT below now threads `expectedVersion`
 * through, since `ToolController.updateToolSession` requires it (428
 * otherwise) as of this sprint's CAS work.
 */
import express, { type Express } from 'express';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  assertRealPostgresTestEnvironment,
} from './_helpers/assertRealPostgres.js';

process.env.DB_TYPE = 'postgres';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const DATABASE_URL = process.env.DATABASE_URL || '';

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
  // Fail hard (never skip) on a misconfigured run -- proves the connection
  // with real queries (SELECT version()/current_database()), not just env
  // var presence. See assertRealPostgres.ts.
  await assertRealPostgresTestEnvironment({ expectedDatabase: 'consultinity' });

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
  const c = await db();
  try {
    await c.query(`DELETE FROM tool_sessions WHERE organization_id = $1`, [ORG]);
  } finally {
    await c.end();
  }
});

describe('create -> update -> reload -> identical state (real Postgres)', () => {
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
    // createToolSession now hands back the starting version (always 1) --
    // exactly what useToolSessionSync.ts's sessionRef would hold after its
    // own load()/create() before the first performSave().
    expect(created.body.version).toBe(1);

    // This is exactly the shape src/hooks/useToolSessionSync.ts's
    // performSave() sends via toolSessionApi.update() -- including
    // `expectedVersion`, which the server now REQUIRES (this sprint's CAS
    // work; see server/src/controllers/ToolController.ts:updateToolSession).
    const answers = {
      mission: 'Grow into adjacent markets',
      signals: [{ id: 'sig-1', text: 'Strong Q2 pipeline', category: 'strength' }],
      items: [{ id: 'item-1', category: 'strength', text: 'Loyal enterprise base' }],
    };

    const updated = await request(app).put(`/api/tools/${toolId}`).set(asUser()).send({
      answers,
      completionPercent: 40,
      confidenceAvg: 3,
      expectedVersion: created.body.version,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.id).toBe(toolId);
    expect(updated.body.version).toBe(2);

    const reloaded = await request(app).get(`/api/tools/${toolId}`).set(asUser());
    expect(reloaded.status).toBe(200);
    // The exact "reload from server -> identical state" assertion the
    // adapter's contract rests on.
    expect(reloaded.body.answers).toEqual(answers);
    expect(reloaded.body.progress).toBe(40);
    expect(reloaded.body.confidenceAvg).toBe(3);
    expect(reloaded.body.version).toBe(2);
  });

  it('a second update+reload cycle stays consistent (no drift across repeated saves)', async () => {
    const created = await request(app)
      .post('/api/tools')
      .set(asUser())
      .send({ toolType: 'dynamic-swot', name: `${P}session-3` });
    const toolId = created.body.id as string;

    const first = await request(app)
      .put(`/api/tools/${toolId}`)
      .set(asUser())
      .send({ answers: { mission: 'v1' }, expectedVersion: 1 });
    expect(first.status).toBe(200);
    const afterFirst = await request(app).get(`/api/tools/${toolId}`).set(asUser());
    expect(afterFirst.body.answers).toEqual({ mission: 'v1' });
    expect(afterFirst.body.version).toBe(2);

    const second = await request(app)
      .put(`/api/tools/${toolId}`)
      .set(asUser())
      .send({ answers: { mission: 'v2', extra: true }, expectedVersion: afterFirst.body.version });
    expect(second.status).toBe(200);
    const afterSecond = await request(app).get(`/api/tools/${toolId}`).set(asUser());
    expect(afterSecond.body.answers).toEqual({ mission: 'v2', extra: true });
    expect(afterSecond.body.version).toBe(3);
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

    // Cross-org PUT is rejected the same way, and never writes.
    const otherOrgWrite = await request(app)
      .put(`/api/tools/${toolId}`)
      .set({ 'x-test-user': USER, 'x-test-org': `${P}other-org`, 'x-test-role': 'admin' })
      .send({ answers: { hijacked: true }, expectedVersion: 1 });
    expect(otherOrgWrite.status).toBe(404);
  });

  it('CLOSES the former "known gap": GET returns `version`, and PUT enforces it as a real CAS token', async () => {
    // This replaces the original "DOCUMENTS the known gap" test, which
    // pinned `reloaded.body.version` as `toBeUndefined()` — that gap is
    // exactly what this sprint's server-side CAS work (ToolController.
    // getToolSession/updateToolSession) closes. Proven end-to-end through
    // the same adapter/hook HTTP contract this file exists to verify.
    const created = await request(app)
      .post('/api/tools')
      .set(asUser())
      .send({ toolType: 'dynamic-swot', name: `${P}session-version-gap` });
    const toolId = created.body.id as string;

    const afterCreate = await request(app).get(`/api/tools/${toolId}`).set(asUser());
    expect(afterCreate.body.version).toBe(1);

    const bumped = await request(app)
      .put(`/api/tools/${toolId}`)
      .set(asUser())
      .send({ answers: { mission: 'bump version' }, expectedVersion: 1 });
    expect(bumped.status).toBe(200);
    expect(bumped.body.version).toBe(2);

    const c = await db();
    let dbVersion: number;
    try {
      const row = await c.query(`SELECT version FROM tool_sessions WHERE id = $1`, [toolId]);
      dbVersion = Number(row.rows[0].version);
    } finally {
      await c.end();
    }
    expect(dbVersion).toBe(2);

    const reloaded = await request(app).get(`/api/tools/${toolId}`).set(asUser());
    expect(reloaded.body.version).toBe(2);

    // And the enforcement half of the gap: a PUT with the now-stale
    // version (1) is rejected, never silently applied.
    const stale = await request(app)
      .put(`/api/tools/${toolId}`)
      .set(asUser())
      .send({ answers: { mission: 'stale write' }, expectedVersion: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body.current.version).toBe(2);
  });
});
