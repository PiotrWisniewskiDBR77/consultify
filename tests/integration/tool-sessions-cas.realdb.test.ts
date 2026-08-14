/**
 * Sprint S1 (2026-08-13) — CAS (optimistic concurrency) on tool sessions,
 * proven against a REAL Postgres instance (not mocks, not SQLite).
 *
 * Ground truth before this sprint: `tool_sessions.version` existed and was
 * bumped by `updateToolSession` on every content write, but GET never
 * returned it and PUT never checked it — two concurrent editors (or an
 * autosave racing a manual save) silently clobbered each other,
 * last-write-wins. This suite proves the fix in `ToolController.
 * getToolSession` / `ToolController.updateToolSession`
 * (server/src/controllers/ToolController.ts):
 *
 *   - GET returns the real `version` + a `serverTime`.
 *   - PUT requires `expectedVersion`; missing it is 428, never a silent
 *     last-write-wins.
 *   - The write is a SINGLE atomic `UPDATE ... WHERE version = ?` — never
 *     read-then-write — so a version mismatch touches zero rows (no partial
 *     write) and a genuine race resolves to exactly one winner.
 *   - A mismatch returns 409 with the CURRENT server state in the body.
 *   - Cross-org access is rejected with no data leak.
 *
 * Run (this worktree's disposable container only):
 *   RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DB_TYPE=postgres \
 *   DATABASE_URL=postgres://consultinity:test@localhost:56500/consultinity \
 *   npx vitest run tests/integration/tool-sessions-cas.realdb.test.ts
 */
import express, { type Express } from 'express';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  assertRealPostgresTestEnvironment,
} from './_helpers/assertRealPostgres.js';

// vitest.config.ts hardcodes DB_TYPE=sqlite project-wide — override BEFORE
// the environment assertion below, same as every other *.realdb.test.ts in
// this repo (see tools-outputs-immutable.realdb.test.ts's header comment).
process.env.DB_TYPE = 'postgres';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const DATABASE_URL = process.env.DATABASE_URL || '';

const P = `cas-${Date.now()}-`;
const ORG_A = `${P}orgA`;
const ORG_B = `${P}orgB`;
const USER = `${P}user`;

let uidCounter = 0;
const uid = (label: string): string => `${P}${label}-${Date.now()}-${uidCounter++}`;

let app: Express;

async function db(): Promise<Client> {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  return c;
}

function as(org: string, user = USER) {
  return { 'x-test-org': org, 'x-test-user': user, 'x-test-role': 'admin' };
}

/**
 * Seeds a minimal tool_sessions row directly, bypassing the controller's own
 * create endpoint — lets each test start from a known, explicit version.
 */
async function seedSession(opts: { id: string; org: string; version?: number }): Promise<void> {
  const c = await db();
  try {
    await c.query(
      `INSERT INTO tool_sessions
         (id, organization_id, project_id, tool_type, name, status, completion_percent,
          confidence_avg, answers_json, version, created_by, updated_by, created_at, updated_at)
       VALUES ($1,$2,NULL,'dynamic-swot',$3,'DRAFT',0,0,'{}',$4,$5,$5,NOW(),NOW())
       ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, status = 'DRAFT'`,
      [opts.id, opts.org, `cas session ${opts.id}`, opts.version ?? 1, USER]
    );
  } finally {
    await c.end();
  }
}

async function readVersion(id: string): Promise<{ version: number; answersJson: string | null }> {
  const c = await db();
  try {
    const res = await c.query(`SELECT version, answers_json FROM tool_sessions WHERE id = $1`, [id]);
    return { version: Number(res.rows[0]?.version), answersJson: res.rows[0]?.answers_json ?? null };
  } finally {
    await c.end();
  }
}

beforeAll(async () => {
  // Hard fail (never skip) on a misconfigured run — proves the connection
  // with real queries, not just env var presence. See assertRealPostgres.ts.
  await assertRealPostgresTestEnvironment({ expectedDatabase: 'consultinity' });

  const { default: ToolControllerRaw } = await import('../../server/src/controllers/ToolController.js');
  const ToolController = ToolControllerRaw as any;
  const { UpdateToolSessionSchema } = await import('../../server/src/validators/tool.validators.js');
  const { validateBody } = await import('../../server/src/middleware/validation.middleware.js');

  app = express();
  app.use(express.json());
  // Deliberately bypass verifyToken/requireOrgAccess (network/JWT concerns
  // orthogonal to CAS) — same header-driven synthetic auth pattern as
  // tools-promotion-race.realdb.test.ts / tools-outputs-immutable.realdb
  // .test.ts, the established precedent for this style of realdb suite.
  app.use((req, _res, next) => {
    (req as any).user = {
      id: req.header('x-test-user') || USER,
      organizationId: req.header('x-test-org') || ORG_A,
      role: req.header('x-test-role') || 'admin',
      email: `${P}u@example.test`,
    };
    next();
  });
  app.get('/api/tools/:toolId', ToolController.getToolSession);
  app.put('/api/tools/:toolId', validateBody(UpdateToolSessionSchema), ToolController.updateToolSession);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ error: err?.message || 'unknown', code: err?.code });
  });
}, 60_000);

afterAll(async () => {
  const c = await db();
  try {
    await c.query(`DELETE FROM tool_sessions WHERE organization_id IN ($1,$2)`, [ORG_A, ORG_B]);
  } finally {
    await c.end();
  }
});

describe('CAS — tool_sessions optimistic concurrency (real Postgres)', () => {
  it('GET returns the real server version and a serverTime', async () => {
    const id = uid('get-version');
    await seedSession({ id, org: ORG_A, version: 1 });

    const res = await request(app).get(`/api/tools/${id}`).set(as(ORG_A));
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(1);
    expect(typeof res.body.serverTime).toBe('string');
    expect(Number.isNaN(Date.parse(res.body.serverTime))).toBe(false);
  });

  it('PUT without expectedVersion is rejected (428), no write happens', async () => {
    const id = uid('missing-version');
    await seedSession({ id, org: ORG_A, version: 1 });

    const res = await request(app)
      .put(`/api/tools/${id}`)
      .set(as(ORG_A))
      .send({ answers: { items: ['should not be written'] } });

    expect(res.status).toBe(428);
    expect(res.body.code).toBe('MISSING_EXPECTED_VERSION');

    const row = await readVersion(id);
    expect(row.version).toBe(1);
    expect(row.answersJson).toBe('{}');
  });

  it('PUT with the correct expectedVersion saves and returns the new version', async () => {
    const id = uid('correct-version');
    await seedSession({ id, org: ORG_A, version: 1 });

    const res = await request(app)
      .put(`/api/tools/${id}`)
      .set(as(ORG_A))
      .send({ answers: { items: ['v2 content'] }, expectedVersion: 1 });

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(2);

    const row = await readVersion(id);
    expect(row.version).toBe(2);
    expect(JSON.parse(row.answersJson || '{}')).toEqual({ items: ['v2 content'] });
  });

  it('PUT with a stale expectedVersion is rejected (409) with the CURRENT server state, and does NOT write', async () => {
    const id = uid('stale-version');
    await seedSession({ id, org: ORG_A, version: 1 });

    // Advance the session to version 2 first (a "concurrent" prior save).
    const first = await request(app)
      .put(`/api/tools/${id}`)
      .set(as(ORG_A))
      .send({ answers: { items: ['first writer'] }, expectedVersion: 1 });
    expect(first.status).toBe(200);
    expect(first.body.version).toBe(2);

    // A second caller still believes it's at version 1 (stale read).
    const stale = await request(app)
      .put(`/api/tools/${id}`)
      .set(as(ORG_A))
      .send({ answers: { items: ['stale loser'] }, expectedVersion: 1 });

    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('STALE_VERSION');
    expect(stale.body.current.version).toBe(2);
    expect(stale.body.current.answers).toEqual({ items: ['first writer'] });

    // No partial write — the first writer's content is untouched.
    const row = await readVersion(id);
    expect(row.version).toBe(2);
    expect(JSON.parse(row.answersJson || '{}')).toEqual({ items: ['first writer'] });
  });

  it('two GENUINELY CONCURRENT writes at the same expectedVersion: exactly ONE succeeds, the loser gets 409 + current state', async () => {
    const id = uid('race');
    await seedSession({ id, org: ORG_A, version: 1 });

    const CONCURRENCY = 10;
    const results = await Promise.all(
      Array.from({ length: CONCURRENCY }, (_, i) =>
        request(app)
          .put(`/api/tools/${id}`)
          .set(as(ORG_A))
          .send({ answers: { items: [`racer-${i}`] }, expectedVersion: 1 })
      )
    );

    const winners = results.filter((r) => r.status === 200);
    const losers = results.filter((r) => r.status === 409);

    expect(winners.length).toBe(1);
    expect(losers.length).toBe(CONCURRENCY - 1);
    winners.forEach((r) => expect(r.body.version).toBe(2));
    losers.forEach((r) => {
      expect(r.body.code).toBe('STALE_VERSION');
      expect(r.body.current.version).toBe(2);
    });

    // The row's final content matches exactly the ONE winner's payload —
    // never a merge, never the last request to physically arrive at
    // Postgres (which could easily be a "loser" under real concurrency).
    const row = await readVersion(id);
    expect(row.version).toBe(2);
    const winnerAnswers = JSON.parse(row.answersJson || '{}');
    expect(winners[0].body).toBeTruthy();
    // Cross-check: whichever racer's payload is on the row, exactly one
    // racer's index matches it (proves no interleaving/merge occurred).
    const matchingRacers = Array.from({ length: CONCURRENCY }, (_, i) => i).filter(
      (i) => JSON.stringify(winnerAnswers) === JSON.stringify({ items: [`racer-${i}`] })
    );
    expect(matchingRacers.length).toBe(1);
  });

  it('retrying the SAME write (same expectedVersion, already applied) does not duplicate — it 409s cleanly against the new version', async () => {
    const id = uid('retry');
    await seedSession({ id, org: ORG_A, version: 1 });

    const first = await request(app)
      .put(`/api/tools/${id}`)
      .set(as(ORG_A))
      .send({ answers: { items: ['once'] }, expectedVersion: 1 });
    expect(first.status).toBe(200);
    expect(first.body.version).toBe(2);

    // A naive client retry (e.g. after a dropped response) replays the
    // EXACT same request, still asserting expectedVersion: 1.
    const retry = await request(app)
      .put(`/api/tools/${id}`)
      .set(as(ORG_A))
      .send({ answers: { items: ['once'] }, expectedVersion: 1 });

    expect(retry.status).toBe(409);
    expect(retry.body.code).toBe('STALE_VERSION');

    // Exactly one write landed — version advanced exactly once, not twice.
    const row = await readVersion(id);
    expect(row.version).toBe(2);
  });

  it('cross-org PUT is rejected 404 with no data leak, and does not write', async () => {
    const id = uid('cross-org');
    await seedSession({ id, org: ORG_A, version: 1 });

    const res = await request(app)
      .put(`/api/tools/${id}`)
      .set(as(ORG_B)) // wrong org
      .send({ answers: { items: ['attacker payload'] }, expectedVersion: 1 });

    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/attacker payload/);

    const row = await readVersion(id);
    expect(row.version).toBe(1);
    expect(row.answersJson).toBe('{}');
  });

  it('cross-org GET is rejected 404 with no data leak', async () => {
    const id = uid('cross-org-get');
    await seedSession({ id, org: ORG_A, version: 1 });

    const res = await request(app).get(`/api/tools/${id}`).set(as(ORG_B));
    expect(res.status).toBe(404);
    expect(res.body.version).toBeUndefined();
  });

  it('a local draft older than the server never overwrites the server (client holding a stale copy retries and loses)', async () => {
    const id = uid('local-draft');
    await seedSession({ id, org: ORG_A, version: 1 });

    // Client A loads at version 1, then goes offline with a local draft.
    const localDraftVersion = 1;
    const localDraftAnswers = { items: ['offline edit'] };

    // Meanwhile, client B (or the same user on another tab) saves twice,
    // advancing the server to version 3.
    const b1 = await request(app)
      .put(`/api/tools/${id}`)
      .set(as(ORG_A))
      .send({ answers: { items: ['server edit 1'] }, expectedVersion: 1 });
    expect(b1.status).toBe(200);
    const b2 = await request(app)
      .put(`/api/tools/${id}`)
      .set(as(ORG_A))
      .send({ answers: { items: ['server edit 2'] }, expectedVersion: 2 });
    expect(b2.status).toBe(200);
    expect(b2.body.version).toBe(3);

    // Client A comes back online and tries to flush its local draft against
    // the version it last saw (1) — must be rejected, never silently applied.
    const flush = await request(app)
      .put(`/api/tools/${id}`)
      .set(as(ORG_A))
      .send({ answers: localDraftAnswers, expectedVersion: localDraftVersion });
    expect(flush.status).toBe(409);
    expect(flush.body.current.version).toBe(3);
    expect(flush.body.current.answers).toEqual({ items: ['server edit 2'] });

    // Server content is exactly what B wrote — A's stale draft never landed.
    const row = await readVersion(id);
    expect(row.version).toBe(3);
    expect(JSON.parse(row.answersJson || '{}')).toEqual({ items: ['server edit 2'] });
  });

  it('reload (a fresh GET) reflects the persisted version after multiple writes', async () => {
    const id = uid('reload');
    await seedSession({ id, org: ORG_A, version: 1 });

    await request(app)
      .put(`/api/tools/${id}`)
      .set(as(ORG_A))
      .send({ answers: { items: ['a'] }, expectedVersion: 1 });
    await request(app)
      .put(`/api/tools/${id}`)
      .set(as(ORG_A))
      .send({ answers: { items: ['b'] }, expectedVersion: 2 });

    const reloaded = await request(app).get(`/api/tools/${id}`).set(as(ORG_A));
    expect(reloaded.status).toBe(200);
    expect(reloaded.body.version).toBe(3);
    expect(reloaded.body.answers).toEqual({ items: ['b'] });
  });

  it('version survives a "server restart" — it lives in the tool_sessions.version column, not process memory', async () => {
    const id = uid('restart');
    await seedSession({ id, org: ORG_A, version: 1 });

    const saved = await request(app)
      .put(`/api/tools/${id}`)
      .set(as(ORG_A))
      .send({ answers: { items: ['before restart'] }, expectedVersion: 1 });
    expect(saved.status).toBe(200);
    expect(saved.body.version).toBe(2);

    // Proof this isn't an in-process cache (a module-level Map, a
    // singleton) standing in for real persistence: open a BRAND NEW,
    // independent `pg.Client` connection — sharing no state, no pool, no
    // object identity with the app/controller/queryHelpers used above — and
    // read the row directly. A server restart tears down exactly the kind
    // of in-process state this bypasses; a fresh TCP connection to Postgres
    // is the part that must still see it.
    const independentClient = new Client({ connectionString: DATABASE_URL });
    await independentClient.connect();
    let persisted: { version: number; answers_json: string };
    try {
      const res = await independentClient.query(
        `SELECT version, answers_json FROM tool_sessions WHERE id = $1`,
        [id]
      );
      persisted = res.rows[0];
    } finally {
      await independentClient.end();
    }
    expect(Number(persisted.version)).toBe(2);
    expect(JSON.parse(persisted.answers_json)).toEqual({ items: ['before restart'] });

    // And the app's own GET (through the normal pooled connection) agrees.
    const res = await request(app).get(`/api/tools/${id}`).set(as(ORG_A));
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(2);
    expect(res.body.answers).toEqual({ items: ['before restart'] });
  });
});
