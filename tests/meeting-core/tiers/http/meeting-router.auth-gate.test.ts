/**
 * meeting-router.auth-gate.test.ts — TIER 2a (HTTP contract, unauthenticated).
 *
 * ============================================================================
 * WHAT THIS PROVES: the REAL `server/src/routes/meeting.routes.ts` router,
 * mounted on a REAL Express app and hit with REAL HTTP requests via
 * supertest, rejects every unauthenticated request under `/api/meeting`
 * with 401 — using the REAL, unmocked `verifyToken`/`isAuthenticated`
 * middleware (no auth mocking in this file at all).
 *
 * WHAT THIS DOES NOT PROVE: that any individual path is actually mounted
 * as a distinct route. `router.use(verifyToken)` runs for EVERY request
 * under this router's prefix, matched or not, BEFORE Express attempts to
 * match a specific route. That means a completely made-up path also
 * returns 401 here (see the "control" test below) — 401-everywhere is
 * necessary but not sufficient evidence of routing. Proving the routing
 * table itself (real paths match, fake paths 404) is TIER 2b:
 * meeting-router.routes-mounted.test.ts, which authenticates past this
 * gate with a mocked identity so Express's own dispatch becomes visible.
 *
 * Nothing here touches a database: the no-token path in verifyToken
 * returns 401 before any DB call (verified by reading
 * server/src/middleware/auth.middleware.ts — the `if (!token)` branch).
 * ============================================================================
 */
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import meetingRoutes from '../../../../server/src/routes/meeting.routes.ts';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/meeting', meetingRoutes);
  return app;
}

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

// Every method+path this router declares (server/src/routes/meeting.routes.ts),
// legacy single-segment routes plus the /core sub-router (Meeting Core wave 2).
const DOCUMENTED_ROUTES: Array<[Method, string]> = [
  // Legacy /api/meeting/*
  ['get', '/api/meeting'],
  ['post', '/api/meeting'],
  ['put', '/api/meeting/m1'],
  ['delete', '/api/meeting/m1'],
  ['patch', '/api/meeting/m1/status'],
  ['post', '/api/meeting/m1/decisions'],
  ['post', '/api/meeting/m1/follow-ups'],
  ['patch', '/api/meeting/m1/follow-ups/f1'],
  ['post', '/api/meeting/m1/generate-notes'],
  // Meeting Core /api/meeting/core/*
  ['post', '/api/meeting/core'],
  ['get', '/api/meeting/core/m1'],
  ['patch', '/api/meeting/core/m1/prep'],
  ['post', '/api/meeting/core/m1/participants'],
  ['get', '/api/meeting/core/m1/participants'],
  ['delete', '/api/meeting/core/m1/participants/u1'],
  ['post', '/api/meeting/core/m1/transitions/START_PREPARING'],
  ['post', '/api/meeting/core/m1/close'],
  ['post', '/api/meeting/core/m1/notes'],
  ['get', '/api/meeting/core/m1/notes'],
  ['post', '/api/meeting/core/m1/outputs'],
  ['post', '/api/meeting/core/m1/outputs/o1/approve'],
  ['post', '/api/meeting/core/m1/outputs/o1/reject'],
  ['post', '/api/meeting/core/m1/outputs/o1/materialize'],
];

describe('meeting.routes.ts — auth gate on a real mounted Express app (unauthenticated)', () => {
  const app = buildApp();

  it.each(DOCUMENTED_ROUTES)('%s %s -> 401 with no Authorization header', async (method, path) => {
    const res = await request(app)[method](path).send({});
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: 'No token provided' });
  });

  // Control case: a path this router never declares gets the SAME 401 as a
  // real one, because verifyToken runs before route matching. This is the
  // concrete evidence for the "does not prove routing" note above — do not
  // delete this test to "clean up", it is load-bearing documentation.
  it('CONTROL: an undeclared path under /api/meeting also 401s (not 404) — proves the gate runs first, not that this path is mounted', async () => {
    const res = await request(app).get('/api/meeting/this-path-does-not-exist-anywhere');
    expect(res.status).toBe(401);
  });

  it('rejects a garbage bearer token with 401 (still no DB touched — malformed JWT shape is rejected before verification)', async () => {
    const res = await request(app).get('/api/meeting').set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
  });
});
