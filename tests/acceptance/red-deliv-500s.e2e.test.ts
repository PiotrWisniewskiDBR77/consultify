/**
 * Acceptance E2E — RED-DELIV: schema-500 hunt in the deliverables/inbox/
 * discovery/my-work(non-v8)/meeting/interview router perimeter.
 *
 * Mounts the REAL my-work router behind its own internal auth chain (the router
 * applies verifyToken/demoContext itself via router.use), plus the global
 * `req.db = getDatabase()` attach that index.ts installs for every /api/ path
 * (WITHOUT it, req.db is undefined and handlers throw a *false* 500 — the
 * RED-A missing-middleware trap). Real local Postgres parity, no mocks.
 *
 * Two genuine hard/silent schema bugs were found and fixed; this locks them:
 *
 *   1. GET /api/my-work/inbox/evals/cost-summary
 *      Threw PG 42883 `function datetime(unknown, unknown) does not exist`:
 *      the SQL used a *parameterized* `datetime('now', ?)` modifier, which
 *      PostgresDatabase.adaptQuery never rewrites (it only matches literal
 *      string modifiers). Fixed to use the daysAgoSql() helper.
 *
 *   2. GET /api/my-work/delegation-suggestions
 *      Selected `u.name` (PG 42703 — `users` has first_name/last_name, no
 *      `name`) and compared `u.is_active = 1` against a TEXT column. The error
 *      was swallowed by try/catch → HTTP 200 with EMPTY suggestions (silent
 *      data loss). Fixed to build the name from first_name/last_name and to
 *      use a tolerant text check for is_active.
 *
 * Reversible `odbior--reddel--` prefix; nothing is written by these reads.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { mintToken } from './harness.js';
import { seed } from './seed.mjs';

async function buildApp(): Promise<Express> {
  const { getDatabase } = await import('../../server/src/database/index.js');
  const myWorkRouter = (await import('../../server/src/routes/my-work.routes.js')).default;

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  // Mirror server/src/index.ts global middleware: attach req.db for /api/ paths.
  app.use((req: any, _res: any, next: any) => {
    if (req.path.startsWith('/api/')) req.db = getDatabase();
    next();
  });
  app.use('/api/my-work', myWorkRouter);
  return app;
}

let app: Express;
let token: string;

beforeAll(async () => {
  await seed();
  token = mintToken();
  app = await buildApp();
});

describe('RED-DELIV — schema-500 regressions (real runtime)', () => {
  it('GET /inbox/evals/cost-summary returns 200 (no 42883 datetime())', async () => {
    const res = await request(app)
      .get('/api/my-work/inbox/evals/cost-summary?days=30')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalCostUsd');
    expect(res.body).toHaveProperty('callCount');
    expect(res.body.days).toBe(30);
    // Guard against the fixed bug re-appearing as a swallowed PG error payload.
    expect(res.body.__err).toBeUndefined();
    expect(res.body.code).not.toBe('42883');
  });

  it('GET /delegation-suggestions returns 200 with a suggestions array (no 42703 u.name / text=int)', async () => {
    const res = await request(app)
      .get('/api/my-work/delegation-suggestions')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.suggestions)).toBe(true);
    expect(res.body.code).not.toBe('42703');
    expect(res.body.code).not.toBe('42883');
  });
});
