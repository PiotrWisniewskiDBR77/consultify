/**
 * M02-P08 — Ideas hub golden flow + IDOR, against a REAL Postgres database
 * (no mocks), through the REAL Express router (`server/src/routes/my-work.routes.ts`)
 * and the REAL `verifyToken` middleware.
 *
 * Mirrors the harness pattern in `tests/integration/table-platform.idor.realdb.test.ts`
 * and `tests/integration/mw010-vault-versioning.golden-flow.realdb.test.ts`: REAL router +
 * REAL auth (E2E_MODE unsigned-JWT bypass) + a `pgReachable()` precondition that reports a
 * clean, non-failing skip when no Postgres is configured.
 *
 * Scope (M02-P08 packet — Ideas hub / idea lifecycle, NOT the 4 tool-modes' internals):
 *  1. Golden flow: create -> list read-back -> GET detail -> PUT update (mutate) ->
 *     GET read-back -> PUT workspace map (mutate) -> GET map "fresh reopen" read-back ->
 *     DELETE -> GET 404 (post-delete confirms hard delete, no soft-archive column exists).
 *  2. Cross-tenant negative control: a real user in a DIFFERENT real org gets 404 (not 403 —
 *     `my-ideas/:id` intentionally leaks no existence signal across orgs) on GET/PUT/DELETE,
 *     and the write path leaves no row behind.
 *  3. Same-org, different-user (private-per-user boundary): `GET /my-ideas/:id` is scoped by
 *     `user_id AND organization_id` (T009 "private per-user repository"), so a colleague in
 *     the SAME org who is not the owner also gets 404 on the base idea record.
 *  4. Same-org, different-user, workspace MAP read: `GET /my-ideas/:id/map` is intentionally
 *     ORG-scoped (not user-scoped) per the DP-3 multiplayer comment in the route — a colleague
 *     in the same org CAN read the shared board. Documents the split boundary so a future
 *     packet doesn't "fix" one without checking the other.
 *  5. Auth sanity: no token -> 401.
 *
 * HOW TO RUN LOCALLY:
 *   docker run -d --name m02p08-pg -e POSTGRES_USER=iris -e POSTGRES_PASSWORD=iris_test \
 *     -e POSTGRES_DB=iris_test -p 55901:5432 pgvector/pgvector:pg16
 *   NODE_ENV=test DB_TYPE=postgres DATABASE_URL=postgres://iris:iris_test@localhost:55901/iris_test \
 *     npm run db:migrate -- --safe
 *   DATABASE_URL=postgres://iris:iris_test@localhost:55901/iris_test \
 *     npx vitest run tests/integration/m02-p08-ideas-hub-golden-flow.realdb.test.ts
 */

import { randomBytes } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import express from 'express';

if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
  process.env.E2E_MODE = 'true';
}

const { default: myWorkRoutes } = await import('../../server/src/routes/my-work.routes.js');

// ---------------------------------------------------------------------------
// Connection probe (same contract as table-platform.idor.realdb.test.ts)
// ---------------------------------------------------------------------------

const PROBE_TIMEOUT_MS = 2_000;

function readDatabaseUrl(): string | null {
  const raw = process.env.DATABASE_URL;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes('${{')) return null;
  return trimmed;
}

function buildClientConfig(): ClientConfig | null {
  const databaseUrl = readDatabaseUrl();
  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      connectionTimeoutMillis: PROBE_TIMEOUT_MS,
      statement_timeout: 5_000,
    };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: PROBE_TIMEOUT_MS,
    statement_timeout: 5_000,
  };
}

async function pgReachable(): Promise<boolean> {
  const config = buildClientConfig();
  if (!config) return false;
  const probe = new Client(config);
  try {
    await probe.connect();
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    try {
      await probe.end();
    } catch {
      // best-effort
    }
  }
}

async function tablesExist(client: Client, names: readonly string[]): Promise<boolean> {
  const result = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [names as unknown as string[]]
  );
  const found = new Set(result.rows.map((r) => r.table_name));
  return names.every((n) => found.has(n));
}

const REQUIRED_TABLES = ['my_ideas', 'my_idea_maps', 'organizations', 'users'] as const;

// ---------------------------------------------------------------------------
// E2E identity minting (same shape as tests/e2e/tools/collab-*.spec.ts)
// ---------------------------------------------------------------------------

function base64UrlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json, 'utf8').toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function makeE2EToken(userId: string, organizationId: string): string {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode({
    e2e: true,
    id: userId,
    email: `${userId}@local.test`,
    name: 'Ideas Hub RealDB Test User',
    role: 'ADMIN',
    userRole: 'ADMIN',
    organizationId,
    isSuperAdmin: false,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  return `${header}.${payload}.e2e`;
}

// ---------------------------------------------------------------------------
// App under test — REAL router, REAL verifyToken (mounted inside the router
// itself, see my-work.routes.ts:77 `router.use(verifyToken)`).
// ---------------------------------------------------------------------------

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/my-work', myWorkRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

interface Harness {
  client: Client;
  orgAId: string;
  orgBId: string;
  userAId: string; // idea owner
  userA2Id: string; // same org as A, different user (colleague)
  userBId: string; // different org entirely (attacker)
  cleanup: () => Promise<void>;
}

function suffix(): string {
  return `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

async function setupHarness(): Promise<Harness | null> {
  if (!(await pgReachable())) return null;
  const config = buildClientConfig();
  if (!config) return null;

  const client = new Client(config);
  try {
    await client.connect();
  } catch {
    return null;
  }

  try {
    if (!(await tablesExist(client, REQUIRED_TABLES))) {
      await client.end().catch(() => {});
      return null;
    }
  } catch {
    await client.end().catch(() => {});
    return null;
  }

  const tag = suffix();
  const orgAId = `org_m02p08_a_${tag}`;
  const orgBId = `org_m02p08_b_${tag}`;
  const userAId = `user_m02p08_a_${tag}`;
  const userA2Id = `user_m02p08_a2_${tag}`;
  const userBId = `user_m02p08_b_${tag}`;

  const cleanup = async () => {
    try {
      await client.query(
        `DELETE FROM my_idea_maps WHERE organization_id = ANY($1)`,
        [[orgAId, orgBId]]
      );
      await client.query(`DELETE FROM my_ideas WHERE organization_id = ANY($1)`, [[orgAId, orgBId]]);
      await client.query(
        `DELETE FROM organization_members WHERE organization_id = ANY($1)`,
        [[orgAId, orgBId]]
      );
      await client.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [[orgAId, orgBId]]);
      await client.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgAId, orgBId]]);
    } catch {
      // Leaking a few rows is acceptable; a hung/throwing cleanup is not.
    }
    try {
      await client.end();
    } catch {
      // ignore
    }
  };

  return { client, orgAId, orgBId, userAId, userA2Id, userBId, cleanup };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('M02-P08 — Ideas hub golden flow + IDOR against a real Postgres database (no mocks)', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — M02-P08 Ideas hub realdb tests ' +
        'skipped. See file header for the docker run + migrate + vitest command to exercise ' +
        'this suite locally.'
    );
  }

  beforeAll(async () => {
    harness = await setupHarness();
    if (!harness) emitSkipOnce();
  }, 30_000);

  afterAll(async () => {
    if (harness) {
      await harness.cleanup();
      harness = null;
    }
  });

  const itDB = (name: string, fn: (h: Harness) => Promise<void>, timeoutMs = 20_000) =>
    it(
      name,
      async () => {
        if (!harness) {
          expect(true).toBe(true);
          return;
        }
        await fn(harness);
      },
      timeoutMs
    );

  itDB(
    'golden flow: create -> list -> get -> update -> map save -> map fresh-reopen read-back -> delete -> 404',
    async (h) => {
      const app = buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);

      // 1. CREATE
      const createRes = await request(app)
        .post('/api/my-work/my-ideas')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'M02-P08 golden flow idea', body: 'initial body', tags: ['golden-flow'] });
      expect(createRes.status).toBe(201);
      const ideaId = createRes.body?.id;
      expect(typeof ideaId).toBe('string');
      expect(createRes.body?.title).toBe('M02-P08 golden flow idea');
      expect(createRes.body?.stage).toBe('seed');

      // 2. LIST read-back — the new idea must appear in the owner's list.
      const listRes = await request(app)
        .get('/api/my-work/my-ideas')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);
      expect(listRes.body.some((row: any) => row.id === ideaId)).toBe(true);

      // 3. GET detail
      const getRes = await request(app)
        .get(`/api/my-work/my-ideas/${ideaId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body?.body).toBe('initial body');

      // 4. UPDATE (mutate)
      const updateRes = await request(app)
        .put(`/api/my-work/my-ideas/${ideaId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'M02-P08 golden flow idea (edited)', stage: 'exploring' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body?.title).toBe('M02-P08 golden flow idea (edited)');
      expect(updateRes.body?.stage).toBe('exploring');

      // 5. Server read-back after update, on a FRESH GET (not the mutation response).
      const rereadRes = await request(app)
        .get(`/api/my-work/my-ideas/${ideaId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(rereadRes.status).toBe(200);
      expect(rereadRes.body?.title).toBe('M02-P08 golden flow idea (edited)');
      expect(rereadRes.body?.stage).toBe('exploring');

      // 6. Workspace map (IdeaMapWorkspace mount): default skeleton first.
      const mapDefaultRes = await request(app)
        .get(`/api/my-work/my-ideas/${ideaId}/map`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(mapDefaultRes.status).toBe(200);
      expect(mapDefaultRes.body?.isDefault).toBe(true);

      // 7. PUT map — mutate the workspace (simulates a mindmap edit + save).
      const nodePayload = [
        { id: 'n1', data: { label: 'Golden flow node' }, position: { x: 0, y: 0 } },
      ];
      const mapSaveRes = await request(app)
        .put(`/api/my-work/my-ideas/${ideaId}/map`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ nodes: nodePayload, edges: [] });
      expect(mapSaveRes.status).toBe(200);

      // 8. "Fresh reopen" — a NEW GET request (not the same connection/response)
      //    simulating navigating away and back into the workspace.
      const mapReopenRes = await request(app)
        .get(`/api/my-work/my-ideas/${ideaId}/map`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(mapReopenRes.status).toBe(200);
      expect(mapReopenRes.body?.isDefault).toBe(false);
      expect(Array.isArray(mapReopenRes.body?.map?.nodes)).toBe(true);
      expect(mapReopenRes.body?.map?.nodes?.some((n: any) => n.id === 'n1')).toBe(true);

      // 9. DELETE (hard delete — my_ideas has no archive/soft-delete column).
      const deleteRes = await request(app)
        .delete(`/api/my-work/my-ideas/${ideaId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(deleteRes.status).toBe(204);

      // 10. Confirm gone, both via the API and directly in the DB (map cascades).
      const postDeleteGet = await request(app)
        .get(`/api/my-work/my-ideas/${ideaId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(postDeleteGet.status).toBe(404);

      const dbRow = await h.client.query('SELECT id FROM my_ideas WHERE id = $1', [ideaId]);
      expect(dbRow.rows.length).toBe(0);
      const dbMapRow = await h.client.query('SELECT id FROM my_idea_maps WHERE idea_id = $1', [ideaId]);
      expect(dbMapRow.rows.length).toBe(0);
    }
  );

  itDB(
    'cross-tenant negative control: a real user in a DIFFERENT real org gets 404 on GET/PUT/DELETE',
    async (h) => {
      const app = buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const attackerToken = makeE2EToken(h.userBId, h.orgBId);

      const createRes = await request(app)
        .post('/api/my-work/my-ideas')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'M02-P08 cross-tenant target idea' });
      expect(createRes.status).toBe(201);
      const ideaId = createRes.body?.id;

      const attackerGet = await request(app)
        .get(`/api/my-work/my-ideas/${ideaId}`)
        .set('Authorization', `Bearer ${attackerToken}`);
      expect(attackerGet.status).toBe(404);

      const attackerPut = await request(app)
        .put(`/api/my-work/my-ideas/${ideaId}`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ title: 'PWNED' });
      expect(attackerPut.status).toBe(404);

      const attackerDelete = await request(app)
        .delete(`/api/my-work/my-ideas/${ideaId}`)
        .set('Authorization', `Bearer ${attackerToken}`);
      expect(attackerDelete.status).toBe(404);

      // Belt-and-suspenders: the attacker's write/delete attempts must not
      // have touched the row even if a status-code assertion above weakened.
      const dbRow = await h.client.query(
        'SELECT title FROM my_ideas WHERE id = $1',
        [ideaId]
      );
      expect(dbRow.rows.length).toBe(1);
      expect(dbRow.rows[0].title).toBe('M02-P08 cross-tenant target idea');

      // Cross-tenant should also not appear in the attacker's own list.
      const attackerList = await request(app)
        .get('/api/my-work/my-ideas')
        .set('Authorization', `Bearer ${attackerToken}`);
      expect(attackerList.status).toBe(200);
      expect(attackerList.body.some((row: any) => row.id === ideaId)).toBe(false);
    }
  );

  itDB(
    'private-per-user boundary: a colleague in the SAME org (not the owner) gets 404 on the base idea record',
    async (h) => {
      const app = buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const colleagueToken = makeE2EToken(h.userA2Id, h.orgAId);

      const createRes = await request(app)
        .post('/api/my-work/my-ideas')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'M02-P08 private-per-user idea' });
      expect(createRes.status).toBe(201);
      const ideaId = createRes.body?.id;

      const colleagueGet = await request(app)
        .get(`/api/my-work/my-ideas/${ideaId}`)
        .set('Authorization', `Bearer ${colleagueToken}`);
      // T009 "My Ideas (private per-user repository)" — org membership alone
      // does not grant access to the base idea record; only the creating
      // user_id does.
      expect(colleagueGet.status).toBe(404);

      const colleagueList = await request(app)
        .get('/api/my-work/my-ideas')
        .set('Authorization', `Bearer ${colleagueToken}`);
      expect(colleagueList.status).toBe(200);
      expect(colleagueList.body.some((row: any) => row.id === ideaId)).toBe(false);
    }
  );

  itDB(
    'documented split boundary: the SAME colleague CAN read the workspace map (DP-3 multiplayer, org-scoped by design)',
    async (h) => {
      const app = buildApp();
      const ownerToken = makeE2EToken(h.userAId, h.orgAId);
      const colleagueToken = makeE2EToken(h.userA2Id, h.orgAId);

      const createRes = await request(app)
        .post('/api/my-work/my-ideas')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ title: 'M02-P08 shared-map idea' });
      expect(createRes.status).toBe(201);
      const ideaId = createRes.body?.id;

      // Colleague still cannot see the base record (previous test covers this),
      // but the workspace map route resolves idea existence ORG-scoped, so the
      // same colleague opening the map directly by id gets a 200, not a 404.
      const colleagueMapRes = await request(app)
        .get(`/api/my-work/my-ideas/${ideaId}/map`)
        .set('Authorization', `Bearer ${colleagueToken}`);
      expect(colleagueMapRes.status).toBe(200);
    }
  );

  itDB('auth sanity: no token at all -> 401 (auth is not accidentally optional)', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/my-work/my-ideas');
    expect(res.status).toBe(401);
  });
});
