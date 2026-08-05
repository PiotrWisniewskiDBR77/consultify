/**
 * Manager snapshot — THE ROUTE, on real PostgreSQL (Master Codex gate 1).
 *
 * The sibling file proves the SQL. This one proves the ROUTE: the express
 * handler, the RBAC gate, the JSON contract and the fact that the response is
 * scoped by the SESSION and by nothing the caller can send.
 *
 *   docker run -d --name m02d-pg -e POSTGRES_PASSWORD=pg -e POSTGRES_DB=m02d \
 *     -p 55440:5432 postgres:16-alpine
 *   RUN_DB_TESTS=1 M02D_DATABASE_URL=postgres://postgres:pg@127.0.0.1:55440/m02d \
 *   npx vitest run tests/integration/myWork/managerSnapshotRoute.realdb.test.ts
 *
 * Skipped — loudly — without those variables, because a mocked DB would make
 * every assertion below pass while touching nothing.
 */

import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.M02D_DATABASE_URL;
const ENABLED = process.env.RUN_DB_TESTS === '1' && Boolean(DATABASE_URL);

const ORG_A = 'org-a';
const USER_A = 'user-a';
const ORG_B = 'org-b';
const USER_B = 'user-b';

let app: Express;
let request: (app: Express) => any;
let closeDb: (() => Promise<void>) | null = null;

/** Session identity injected ahead of the router, as `verifyToken` would. */
let session: { userId: string; orgId: string; role: string } = {
  userId: USER_A,
  orgId: ORG_A,
  role: 'manager',
};

beforeAll(async () => {
  if (!ENABLED) return;

  // Must be set BEFORE the database modules are imported.
  process.env.DB_TYPE = 'postgres';
  process.env.DATABASE_URL = DATABASE_URL;

  const [{ default: express }, supertestModule, managerRouter, db] = await Promise.all([
    import('express'),
    import('supertest'),
    import('../../../server/src/routes/my-work/manager.routes.js').then((m) => m.default),
    import('../../../server/src/database/Database.js'),
  ]);
  // supertest is CJS: under ESM interop the callable lives on `.default`.
  request = ((supertestModule as any).default ?? supertestModule) as (app: Express) => any;

  if (typeof (db as any).initializeDatabase === 'function') {
    await (db as any).initializeDatabase();
  }
  if (typeof (db as any).closeDatabase === 'function') {
    closeDb = () => (db as any).closeDatabase();
  }

  app = express();
  app.use((req, _res, next) => {
    // Stand in for `verifyToken`: the identity the route is allowed to trust.
    (req as any).userId = session.userId;
    (req as any).organizationId = session.orgId;
    (req as any).userRole = session.role;
    (req as any).user = { id: session.userId, organizationId: session.orgId, role: session.role };
    next();
  });
  app.use('/api/my-work', managerRouter);
}, 120_000);

afterAll(async () => {
  await closeDb?.();
});

describe.runIf(ENABLED)('GET /api/my-work/manager/snapshot — real route, real PostgreSQL', () => {
  it('gate 1 — returns 200 with a complete, self-consistent snapshot', async () => {
    session = { userId: USER_A, orgId: ORG_A, role: 'manager' };
    const res = await request(app).get('/api/my-work/manager/snapshot?period=week');

    expect(res.status).toBe(200);
    const snapshot = res.body;

    // Negative control: an empty/mocked database would give zeroes everywhere.
    // The seeded fixture has real rows, so this proves the route read them.
    expect(snapshot.owner.tasks.openTotal).toBeGreaterThan(0);
    expect(snapshot.organization.tasks.openTotal).toBeGreaterThan(
      snapshot.owner.tasks.openTotal - 1
    );

    expect(snapshot.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(snapshot.scope).toEqual({ organizationId: ORG_A, ownerUserId: USER_A });
    expect(snapshot.window.days).toBe(7);
    expect(snapshot.owner.basis).toBe('owner');
    expect(snapshot.organization.basis).toBe('organization');
  });

  it('gate 2 — every invariant the contract declares holds on real data', async () => {
    session = { userId: USER_A, orgId: ORG_A, role: 'manager' };
    const res = await request(app).get('/api/my-work/manager/snapshot');
    const failed = res.body.coherence.checks.filter((check: any) => !check.ok);
    expect(failed, `failing invariants: ${JSON.stringify(failed)}`).toHaveLength(0);
    expect(res.body.coherence.ok).toBe(true);
    expect(res.body.coherence.checks.length).toBeGreaterThanOrEqual(10);
  });

  it('reads one clock — every figure shares a single generatedAt', async () => {
    session = { userId: USER_A, orgId: ORG_A, role: 'manager' };
    const first = await request(app).get('/api/my-work/manager/snapshot');
    const second = await request(app).get('/api/my-work/manager/snapshot');
    // Two reads differ in time but each is internally one point in time.
    expect(first.body.generatedAt).not.toBe(second.body.generatedAt);
    expect(first.body.window.end).toBe(first.body.generatedAt);
    expect(new Date(first.body.window.start).getTime()).toBeLessThan(
      new Date(first.body.generatedAt).getTime()
    );
  });

  it('gate 3 — a non-manager is refused, and no numbers leak in the refusal', async () => {
    session = { userId: USER_A, orgId: ORG_A, role: 'user' };
    const res = await request(app).get('/api/my-work/manager/snapshot');
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toMatch(/openTotal|overdue|coherence/);
  });

  it('gate 3 — a session in another organization sees only its own rows', async () => {
    session = { userId: USER_A, orgId: ORG_A, role: 'manager' };
    const a = (await request(app).get('/api/my-work/manager/snapshot')).body;

    session = { userId: USER_B, orgId: ORG_B, role: 'manager' };
    const b = (await request(app).get('/api/my-work/manager/snapshot')).body;

    expect(b.scope.organizationId).toBe(ORG_B);
    expect(b.organization.tasks.openTotal).not.toBe(a.organization.tasks.openTotal);
    expect(b.owner.tasks.openTotal).toBeLessThanOrEqual(b.organization.tasks.openTotal);
  });

  it('gate 4 — query and body cannot forge the scope', async () => {
    session = { userId: USER_B, orgId: ORG_B, role: 'manager' };
    const honest = (await request(app).get('/api/my-work/manager/snapshot')).body;

    // Every shape a caller could try to smuggle a scope through.
    const forged = (
      await request(app).get(
        `/api/my-work/manager/snapshot?organizationId=${ORG_A}&orgId=${ORG_A}&userId=${USER_A}&ownerUserId=${USER_A}`
      )
    ).body;

    expect(forged.scope).toEqual({ organizationId: ORG_B, ownerUserId: USER_B });
    expect(forged.organization.tasks.openTotal).toBe(honest.organization.tasks.openTotal);
    expect(forged.owner.tasks.openTotal).toBe(honest.owner.tasks.openTotal);
  });

  it('fails closed with 401 when the session carries no identity', async () => {
    session = { userId: '', orgId: '', role: 'manager' };
    const res = await request(app).get('/api/my-work/manager/snapshot');
    expect(res.status).toBe(401);
  });

  it('degrades the team block honestly when capacity data is unavailable', async () => {
    // This fixture deliberately omits `project_members` / `users`, so
    // `getCapacityOverview` throws and the route's `.catch` takes over. The log
    // will show "[Postgres] Query Error" for THAT query only — it is expected,
    // and this assertion is what stops a future reader from mistaking the noise
    // for a broken snapshot. The rest of the snapshot must still be complete.
    session = { userId: USER_A, orgId: ORG_A, role: 'manager' };
    const snapshot = (await request(app).get('/api/my-work/manager/snapshot')).body;

    expect(snapshot.team.memberCount).toBe(0);
    // Never "0% utilized" — that would be a number nobody can act on.
    expect(snapshot.team.utilizationCredible).toBe(false);
    // A missing sub-read must not take the surface down with it.
    expect(snapshot.owner.tasks.openTotal).toBeGreaterThan(0);
    expect(snapshot.coherence.ok).toBe(true);
  });
});

describe.runIf(!ENABLED)('GET /api/my-work/manager/snapshot — real route', () => {
  it('is skipped without RUN_DB_TESTS=1 and M02D_DATABASE_URL', () => {
    // Visible on purpose: a skipped DB gate must never read as a passing one.
    expect(ENABLED).toBe(false);
  });
});
