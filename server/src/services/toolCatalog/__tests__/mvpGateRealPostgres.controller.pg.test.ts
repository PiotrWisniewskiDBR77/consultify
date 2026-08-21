/**
 * TLS-CATALOG-001 — real-PostgreSQL proof of the actual runtime gate
 * behaviour behind `ACTIVE_KNOWN_TOOL_TYPES`.
 *
 * Exercises the REAL production router (`server/src/routes/tools.routes.ts`,
 * mounted at the same `/api/tools` prefix as Gateway) through an in-process
 * Express app + supertest, against a
 * REAL, migrated PostgreSQL instance — same pattern already established by
 * `tests/integration/toolSessionHttpAdapter.realdb.test.ts` and
 * `tests/integration/tools-promotion-race.realdb.test.ts`.
 *
 * Proves, on the live database (not a mock, not an assumption):
 *
 *  1. POSITIVE CONTROL — the one owner-approved MVP tool (`dynamic-swot`)
 *     still starts a session successfully. Without this, the catalog work
 *     in this packet could have broken the one tool that must keep working.
 *  2. NEGATIVE CONTROL — a real `isComingSoon` tool type (`vsm-builder`,
 *     seeded with `is_active = 1` in the live `tools` row — see finding
 *     below) is refused with the documented 409, and no `tool_sessions`
 *     row is created for the attempt.
 *  3. TENANT NEGATIVE — a session created under one organization is
 *     invisible to a different organization on both the single-record read
 *     path (`GET /api/tools/:id`) and the list read path
 *     (`GET /api/tools`).
 *  4. COLD READBACK — after creation, a BRAND NEW `pg.Client` connection
 *     (independent of whatever connection the app used) can read the row
 *     back, proving real durable persistence in Postgres rather than
 *     in-process state.
 *
 * FINDING surfaced while writing this suite (recorded in
 * CATALOG_INVENTORY.md): the live `tools` table has `is_active = 1` for
 * EVERY seeded row, `vsm-builder` included. `KnownToolsService
 * .isKnownToolActive()` is `Boolean(rowIsActive) && ACTIVE_KNOWN_TOOL_TYPES
 * .has(toolType)` — since every row's DB flag is already true, the DB
 * column contributes nothing to the decision. `ACTIVE_KNOWN_TOOL_TYPES`
 * (the hardcoded in-code Set) is the ENTIRE gate today, confirming the
 * closure brief's premise directly against the live schema.
 *
 * RUN (dedicated, already-migrated Postgres — see the closure task's REAL
 * DB ENV block for the exact connection string used in this lane):
 *   RUN_DB_TESTS=1 MOCK_DB=false CI=true DB_TYPE=postgres \
 *     DATABASE_URL=postgresql://consultinity:consultinity@127.0.0.1:34912/consultinity \
 *     npx vitest run \
 *     server/src/services/toolCatalog/__tests__/mvpGateRealPostgres.controller.pg.test.ts \
 *     --retry=0
 *
 * Doctrine (repeated from this repo's other `.pg.test.ts` files, and worth
 * repeating again): a missing precondition here must FAIL, never SKIP —
 * `describe.skip` on an unset env var looks like success in a report that
 * never touched Postgres.
 */
import express, { type Express } from 'express';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

function fail(msg: string): never {
  throw new Error(`[mvpGateRealPostgres] ${msg} — this must FAIL, never be silently skipped.`);
}

if (process.env.RUN_DB_TESTS !== '1') {
  fail('RUN_DB_TESTS != 1 — the DB layer would return a mock instead of real Postgres.');
}
if (String(process.env.MOCK_DB).toLowerCase() !== 'false') {
  fail(`MOCK_DB=${process.env.MOCK_DB ?? '<unset>'} — explicit MOCK_DB=false is required.`);
}
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('postgres')) {
  fail('DATABASE_URL is missing or is not a postgres:// URL.');
}
process.env.DB_TYPE = 'postgres';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
process.env.RATE_LIMIT_BYPASS = 'true';

const DATABASE_URL = process.env.DATABASE_URL;
const FORBIDDEN_DB_HOSTS = ['centerbeam.proxy.rlwy.net', 'trolley.proxy.rlwy.net', 'ballast.proxy.rlwy.net'];

const P = `tls-catalog-001-${Date.now()}-`;
const ORG_A = `${P}orgA`;
const ORG_B = `${P}orgB`;
const USER = `${P}user`;

// A real, currently-active tool type (owner-approved MVP tool).
const ACTIVE_TOOL_TYPE = 'dynamic-swot';
// A real, currently-inactive ("coming soon") tool type — present in the
// seeded `tools` table, absent from ACTIVE_KNOWN_TOOL_TYPES.
const INACTIVE_TOOL_TYPE = 'vsm-builder';

let app: Express;

async function freshClient(): Promise<Client> {
  const c = new Client({ connectionString: DATABASE_URL, ssl: false });
  await c.connect();
  return c;
}

function asUser(org: string) {
  return { 'x-test-user': USER, 'x-test-org': org, 'x-test-role': 'admin' };
}

beforeAll(async () => {
  // Prove the connection with a real query, not just env-var presence.
  const probe = await freshClient();
  try {
    const host = new URL(DATABASE_URL).hostname;
    if (FORBIDDEN_DB_HOSTS.includes(host)) {
      fail(`host ${host} is a production/demo database — integration tests are forbidden there.`);
    }
    const v = await probe.query<{ version: string }>('SELECT version() AS version');
    const d = await probe.query<{ db: string }>('SELECT current_database() AS db');
    if (!/PostgreSQL/i.test(String(v.rows[0]?.version ?? ''))) {
      fail(`server does not identify as PostgreSQL: "${v.rows[0]?.version}".`);
    }
    if (d.rows[0]?.db !== 'consultinity') {
      fail(`expected database "consultinity", connected to "${d.rows[0]?.db}".`);
    }
  } finally {
    await probe.end();
  }

  // Current mounted routes enforce active organization membership before
  // they reach the catalog controller. The historical fixture only injected
  // req.user headers, so it stopped proving catalog behavior once the
  // membership wall became canonical. Seed the minimum real identity graph
  // for both the positive tenant and the cross-tenant negative control.
  const identity = await freshClient();
  try {
    await identity.query(
      `INSERT INTO organizations (id,name) VALUES ($1,$2),($3,$4)`,
      [ORG_A, `${P}org A`, ORG_B, `${P}org B`]
    );
    await identity.query(
      `INSERT INTO users (id,organization_id,email,role,status)
       VALUES ($1,$2,$3,'ADMIN','active')`,
      [USER, ORG_A, `${P}u@example.test`]
    );
    await identity.query(
      `INSERT INTO organization_members (id,organization_id,user_id,role,status)
       VALUES ($1,$2,$3,'ADMIN','ACTIVE'),($4,$5,$3,'ADMIN','ACTIVE')`,
      [`${P}member-a`, ORG_A, USER, `${P}member-b`, ORG_B]
    );
  } finally {
    await identity.end();
  }

  const toolsRoutes = (await import('../../../routes/tools.routes.js')).default;
  const knownToolsRoutes = (await import('../../../routes/knownTools.routes.js')).default;

  app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = {
      id: req.header('x-test-user') || USER,
      organizationId: req.header('x-test-org') || ORG_A,
      role: req.header('x-test-role') || 'admin',
      email: `${P}u@example.test`,
    };
    next();
  });
  app.use('/api/tools', toolsRoutes);
  app.use('/api/known-tools', knownToolsRoutes);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ error: err?.message || 'unknown', code: err?.code });
  });

  // Warm up ensureToolsSchema()/ensureToolsSeedOnce() (lazy, self-bootstrapping
  // on the create path) so `vsm-builder` definitely has a `tools` row before
  // the negative-control assertions run.
  const warm = await request(app)
    .post('/api/tools')
    .set(asUser(ORG_A))
    .send({ toolType: ACTIVE_TOOL_TYPE, name: `${P}warmup` });
  if (warm.status >= 400) {
    // eslint-disable-next-line no-console
    console.error('WARMUP FAILED', warm.status, warm.body);
    fail(`warmup POST /api/tools failed: status=${warm.status} body=${JSON.stringify(warm.body)}`);
  }
}, 60_000);

afterAll(async () => {
  const c = await freshClient();
  try {
    await c.query(`DELETE FROM tool_sessions WHERE organization_id IN ($1, $2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM organization_members WHERE organization_id IN ($1, $2)`, [ORG_A, ORG_B]);
    await c.query(`DELETE FROM users WHERE id=$1`, [USER]);
    await c.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [ORG_A, ORG_B]);
  } finally {
    await c.end();
  }
});

describe('TLS-CATALOG-001 — real runtime gate against real Postgres', () => {
  it('MOUNTED CATALOG: only Dynamic SWOT is active; unsupported rows are explicitly coming-soon and have no detail route', async () => {
    const catalog = await request(app).get('/api/known-tools?limit=50').set(asUser(ORG_A));
    expect(catalog.status).toBe(200);
    const active = catalog.body.items.filter((item: { isActive: boolean }) => item.isActive);
    expect(active.map((item: { toolType: string }) => item.toolType)).toEqual([ACTIVE_TOOL_TYPE]);
    const unavailable = catalog.body.items.find(
      (item: { toolType: string }) => item.toolType === INACTIVE_TOOL_TYPE
    );
    expect(unavailable).toMatchObject({ isActive: false, isComingSoon: true });

    const detail = await request(app)
      .get(`/api/known-tools/${INACTIVE_TOOL_TYPE}`)
      .set(asUser(ORG_A));
    expect(detail.status).toBe(404);
  }, 30_000);

  it('POSITIVE CONTROL: dynamic-swot (owner-approved MVP tool) still starts a session', async () => {
    const res = await request(app)
      .post('/api/tools')
      .set(asUser(ORG_A))
      .send({ toolType: ACTIVE_TOOL_TYPE, name: `${P}positive` });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('DRAFT');
    expect(typeof res.body.id).toBe('string');

    const c = await freshClient();
    try {
      const row = await c.query(
        `SELECT id, organization_id, tool_type, status FROM tool_sessions WHERE id = $1`,
        [res.body.id]
      );
      expect(row.rowCount).toBe(1);
      expect(row.rows[0].tool_type).toBe(ACTIVE_TOOL_TYPE);
      expect(row.rows[0].organization_id).toBe(ORG_A);
      expect(row.rows[0].status).toBe('DRAFT');
    } finally {
      await c.end();
    }
  }, 30_000);

  it('confirms the live `tools` row for the negative-control tool has is_active=1 (DB flag does not gate it)', async () => {
    const c = await freshClient();
    try {
      const row = await c.query<{ is_active: number; tool_type: string }>(
        `SELECT is_active, tool_type FROM tools WHERE tool_type = $1`,
        [INACTIVE_TOOL_TYPE]
      );
      expect(row.rowCount).toBe(1);
      expect(Boolean(row.rows[0].is_active)).toBe(true);
    } finally {
      await c.end();
    }
  }, 30_000);

  it('NEGATIVE CONTROL: a real coming-soon tool type (vsm-builder) is refused with the documented 409 and creates NO tool_sessions row', async () => {
    const c = await freshClient();
    let before: number;
    try {
      const r = await c.query(
        `SELECT COUNT(*)::int AS n FROM tool_sessions WHERE organization_id = $1 AND tool_type = $2`,
        [ORG_A, INACTIVE_TOOL_TYPE]
      );
      before = r.rows[0].n;
    } finally {
      await c.end();
    }

    const res = await request(app)
      .post('/api/tools')
      .set(asUser(ORG_A))
      .send({ toolType: INACTIVE_TOOL_TYPE, name: `${P}negative` });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'This tool is inactive and cannot start a session yet' });

    const c2 = await freshClient();
    try {
      const r2 = await c2.query(
        `SELECT COUNT(*)::int AS n FROM tool_sessions WHERE organization_id = $1 AND tool_type = $2`,
        [ORG_A, INACTIVE_TOOL_TYPE]
      );
      expect(r2.rows[0].n).toBe(before);
      expect(r2.rows[0].n).toBe(0);
    } finally {
      await c2.end();
    }
  }, 30_000);

  it('TENANT NEGATIVE: a session created under one org is invisible to a different org (single-record and list read paths)', async () => {
    const created = await request(app)
      .post('/api/tools')
      .set(asUser(ORG_A))
      .send({ toolType: ACTIVE_TOOL_TYPE, name: `${P}tenant` });
    expect(created.status).toBe(200);
    const sessionId = created.body.id as string;

    // Same org can read it.
    const sameOrgGet = await request(app).get(`/api/tools/${sessionId}`).set(asUser(ORG_A));
    expect(sameOrgGet.status).toBe(200);
    expect(sameOrgGet.body.id).toBe(sessionId);

    // A different org gets a 404 on the single-record path...
    const crossOrgGet = await request(app).get(`/api/tools/${sessionId}`).set(asUser(ORG_B));
    expect(crossOrgGet.status).toBe(404);

    // ...and never sees it on the list path either.
    const crossOrgList = await request(app).get('/api/tools').set(asUser(ORG_B));
    expect(crossOrgList.status).toBe(200);
    const leaked = (crossOrgList.body.items as Array<{ id: string }>).some((it) => it.id === sessionId);
    expect(leaked).toBe(false);

    // Sanity: the owning org DOES see it on the list path.
    const sameOrgList = await request(app).get('/api/tools').set(asUser(ORG_A));
    expect(sameOrgList.status).toBe(200);
    const present = (sameOrgList.body.items as Array<{ id: string }>).some((it) => it.id === sessionId);
    expect(present).toBe(true);
  }, 30_000);

  it('COLD READBACK: a brand new Postgres connection (independent of the app) reads back a created row unchanged', async () => {
    const created = await request(app)
      .post('/api/tools')
      .set(asUser(ORG_A))
      .send({ toolType: ACTIVE_TOOL_TYPE, name: `${P}cold-readback` });
    expect(created.status).toBe(200);
    const sessionId = created.body.id as string;

    // A completely independent connection — not the app's, not reused from
    // any earlier query in this file — proves the row is really durable in
    // Postgres and not merely held in the app process's memory.
    const cold = await freshClient();
    try {
      const row = await cold.query(
        `SELECT id, organization_id, tool_type, name, status, version FROM tool_sessions WHERE id = $1`,
        [sessionId]
      );
      expect(row.rowCount).toBe(1);
      expect(row.rows[0]).toMatchObject({
        id: sessionId,
        organization_id: ORG_A,
        tool_type: ACTIVE_TOOL_TYPE,
        name: `${P}cold-readback`,
        status: 'DRAFT',
        version: 1,
      });
    } finally {
      await cold.end();
    }
  }, 30_000);
});
