/**
 * Finance v3 canonical adapter — Pakiet B ★ dowód montażu (obowiązkowy).
 *
 * Brief's exact requirement: "401/403 nie dowodzi montażu. Udowodnij montaż
 * tak, żeby odróżnić 'trasa istnieje i odmawia' od 'trasy nie ma': porównaj
 * 401/403 na istniejącej trasie z 404 na nieistniejącej pod tym samym
 * prefiksem." This file produces THREE distinguishable outcomes, not two:
 *
 *   1. Real auth chain (unmocked `verifyToken`), no token, on a REAL,
 *      mounted route -> 401 (auth denial — proves nothing about mounting
 *      by itself, this is the exact trap the brief warns about).
 *   2. Mocked-valid v8 context (same convention as every other
 *      `finance-v2/__tests__/*.pg.test.ts` file), REAL route, artifact id
 *      that does not exist -> 404 WITH `{code:'NOT_FOUND'}` — this is MY
 *      router's own application-level "not found", proof the handler code
 *      actually ran (it queried the DB and decided).
 *   3. Mocked-valid v8 context, a path that no router in this file tree
 *      handles at all -> a DIFFERENT 404 (raw Express "Cannot GET ...",
 *      no JSON `code` field) — proof of "route genuinely absent" as
 *      distinct from "route present, resource absent".
 *
 * Plus the brief's literal "cofnięcie montażu -> 404; przywrócenie ->
 * 200/401" check, done as a deterministic in-process equivalent rather than
 * editing files on disk mid-suite: build one Express app with ONLY
 * `modelsRoutes` mounted (byte-for-byte what `finance-v2/index.ts` looked
 * like before this package's commit — see `git show
 * <parent-of-this-branch>:server/src/routes/v8/finance-v2/index.ts`) and a
 * second app with the CURRENT `financeV2Router` (which also includes
 * `modelsRoutes`, unioned) — same reasoning as `git show <parent>:<file> >
 * <file>` (swap the mounted router set, not the auth layer), just without
 * needing a live HTTP server process in this test environment. This
 * environment never boots the real server on a port, so a literal
 * `curl`-before/after against a live process was not available — this is
 * the closest deterministic equivalent and is called out explicitly, not
 * silently substituted.
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

describe.skipIf(!REAL_PG)('Finance v2 Pakiet B — dowód montażu (401 real-auth vs 404 not-found vs 404 not-mounted)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let financeV2Router: express.Router;
  let modelsOnlyRouter: express.Router;
  let v8Router: express.Router;

  const orgId = `org-mountproof-${randomUUID()}`;
  const userId = `user-mountproof-${randomUUID()}`;

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    financeV2Router = (await import('../index.js')).default;
    modelsOnlyRouter = (await import('../models.routes.js')).default;
    // The full v8Router (`../../index.js`) transitively imports every /api/v8/*
    // route file in the repo — a real, slow module graph under vitest's
    // transform step (not a hang), hence the generous explicit timeout.
    v8Router = (await import('../../index.js')).default;

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'MountProof Org'])
    );
  }, 120000);

  // -----------------------------------------------------------------
  // 1. Real auth chain, no token -> 401 on a route this package added.
  // -----------------------------------------------------------------

  it('1) REAL v8Router (unmocked verifyToken), no Authorization header -> 401 on a Pakiet B route', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v8', v8Router);

    const res = await request(app).get('/api/v8/finance-v2/artifacts/whatever-id');
    expect(res.status).toBe(401);
  });

  it('1b) same REAL v8Router, no Authorization header -> ALSO 401 on a path that does not exist anywhere (auth runs BEFORE routing — documented limitation of a single 401-vs-404 check without a valid token)', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v8', v8Router);

    const res = await request(app).get('/api/v8/finance-v2/this-path-truly-does-not-exist-anywhere');
    expect(res.status).toBe(401);
    // This is the exact reason the brief says "401/403 nie dowodzi montażu"
    // — with no valid token, EVERY path under /api/v8 (real or fake) is
    // indistinguishable at 401. Tests 2/3 below use a valid v8 context
    // (same stubbing convention every other adapter test in this package
    // uses) specifically to get PAST this and distinguish "exists" from
    // "doesn't", which a bare unauthenticated probe cannot do.
  });

  // -----------------------------------------------------------------
  // 2 vs 3. Valid context, real-route-absent-resource vs route-truly-absent.
  // -----------------------------------------------------------------

  function appWithValidContext(router: express.Router) {
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = { id: userId, organizationId: orgId, role: 'finance_admin' };
      req.v8Context = { organizationId: orgId, userId, userRole: 'finance_admin' };
      next();
    });
    app.use('/api/v8/finance-v2', router);
    return app;
  }

  it('2) valid context + REAL router, artifact id absent from DB -> 404 WITH {code:"NOT_FOUND"} (handler ran, queried, decided)', async () => {
    const app = appWithValidContext(financeV2Router);
    const res = await request(app).get(`/api/v8/finance-v2/artifacts/${randomUUID()}`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code', 'NOT_FOUND');
  });

  it('3) valid context + REAL router, path no router in this tree handles -> 404 WITHOUT a code field (Express default, route never matched)', async () => {
    const app = appWithValidContext(financeV2Router);
    const res = await request(app).get('/api/v8/finance-v2/this-path-truly-does-not-exist-anywhere');
    expect(res.status).toBe(404);
    expect(res.body).not.toHaveProperty('code');
  });

  // -----------------------------------------------------------------
  // Literal "cofnięcie montażu -> 404; przywrócenie -> 200/401" check —
  // in-process router-swap equivalent (see file header for why).
  // -----------------------------------------------------------------

  it('cofnięcie montażu: app built with ONLY the pre-Pakiet-B router (modelsRoutes) -> /artifacts/:id is 404-not-mounted, not 404-not-found', async () => {
    const beforeApp = appWithValidContext(modelsOnlyRouter);
    const res = await request(beforeApp).get(`/api/v8/finance-v2/artifacts/${randomUUID()}`);
    expect(res.status).toBe(404);
    // Same signature as test 3 above (no `code`) — proves this 404 comes
    // from Express having no matching route at all, NOT from
    // artifacts.routes.ts's NOT_FOUND branch (which requires the router to
    // exist and run in the first place).
    expect(res.body).not.toHaveProperty('code');
  });

  it('przywrócenie montażu: the CURRENT financeV2Router (this package\'s commit) -> same request now resolves through the real handler -> 404 WITH {code:"NOT_FOUND"}', async () => {
    const afterApp = appWithValidContext(financeV2Router);
    const res = await request(afterApp).get(`/api/v8/finance-v2/artifacts/${randomUUID()}`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('code', 'NOT_FOUND');
  });

  it('przywrócenie montażu, positive case: 200 for a real artifact through the CURRENT router', async () => {
    const app = appWithValidContext(financeV2Router);
    const created = await request(app).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'HISTORICAL_ANALYSIS' });
    expect(created.status).toBe(201);

    const res = await request(app).get(`/api/v8/finance-v2/artifacts/${created.body.data.artifactId}`);
    expect(res.status).toBe(200);
  });
});
