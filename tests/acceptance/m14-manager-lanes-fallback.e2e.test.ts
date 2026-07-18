/**
 * Acceptance E2E — M14 D-03: Manager lanes LEGACY FALLBACK.
 *
 * DECYZJA Piotra 2026-07-18 (rejestr M14 D-03): zakładka Management (manager
 * lanes) MUSI zwracać REALNE dane na demo BEZ wymogu `ENABLE_V8_GLOBAL` i BEZ
 * org-level V8 enablement — pozostając za tym samym auth + org-scope + gatem
 * uprawnień `manage_workstreams`.
 *
 * Ten test odtwarza DOKŁADNĄ kolejność montowania z Gateway.ts:
 *   1) alias  `/api/v8/execution-control/manager` (verifyToken + requireV8OrgContext
 *      + attachV8Context + managerRouter)  — ZAREJESTROWANY PRZED gatem,
 *   2) gated  `/api/v8`  (v8FeatureGate → v8Router).
 * Z `ENABLE_V8_GLOBAL` USUNIĘTYM ze środowiska dowodzimy, że:
 *   - lanes GET zwraca 200 + sensowny kształt (fallback DZIAŁA),
 *   - ten sam GET bez tokenu = 401 (auth EGZEKWOWANY),
 *   - a KAŻDA inna, wyłącznie-gated ścieżka /api/v8 = 404 V8_DISABLED
 *     (gate JEST realnie aktywny → lanes to świadomy wyjątek, nie wyłączony gate).
 *
 * ZERO mocków logiki biznesowej. Reużywa harness.ts (mintToken) + seed.mjs.
 * JEDYNY plik tej pracy.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const LANE = 'action-queue';
const LANES_PATH = `/api/v8/execution-control/manager/lanes/${LANE}/problems`;

let savedEnableV8: string | undefined;

/**
 * Build an app that MIRRORS Gateway.ts mount ordering: the legacy-fallback
 * alias is registered BEFORE the feature-gated /api/v8 mount, so the lanes
 * paths are intercepted ahead of v8FeatureGate.
 */
async function buildApp(): Promise<Express> {
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const { requireV8OrgContext, attachV8Context } = await import(
    '../../server/src/middleware/v8Auth.middleware.js'
  );
  const { managerRouter } = await import(
    '../../server/src/routes/v8/execution-control.routes.js'
  );
  const v8Router = (await import('../../server/src/routes/v8/index.js')).default;

  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // (1) LEGACY FALLBACK alias — BEFORE the gate (exactly as Gateway.ts).
  app.use(
    '/api/v8/execution-control/manager',
    verifyToken as any,
    requireV8OrgContext as any,
    attachV8Context as any,
    managerRouter
  );

  // (2) Feature-gated /api/v8 — v8FeatureGate 404s everything when
  //     ENABLE_V8_GLOBAL !== 'true'. Present so the CONTROL assertion below
  //     proves the gate is genuinely active.
  const { v8FeatureGate } = await import(
    '../../server/src/middleware/v8FeatureGate.middleware.js'
  );
  app.use('/api/v8', v8FeatureGate as any, v8Router);

  return app;
}

let app: Express;
let token: string;

beforeAll(async () => {
  // Prove the fallback WITHOUT the global V8 flag: remove it for this suite.
  savedEnableV8 = process.env.ENABLE_V8_GLOBAL;
  delete process.env.ENABLE_V8_GLOBAL;

  // Seed only if the fixture user/membership is absent. The shared seed.mjs
  // INSERT references a `users.updated_at` column that has drifted out of the
  // local parity schema; when the fixture already exists we skip it (its
  // ON CONFLICT path would still fail to compile against the drifted table).
  await ensureSeed();
  app = await buildApp();
  token = mintToken();
}, 60_000);

async function ensureSeed(): Promise<void> {
  const client = pgClient();
  await client.connect();
  let present = false;
  try {
    const r = await client.query(
      `SELECT 1
       FROM users u
       JOIN organization_members m
         ON m.user_id = u.id AND m.organization_id = u.organization_id
       WHERE u.id = $1 AND m.status = 'ACTIVE'`,
      [SEED.USER_ID]
    );
    present = (r.rowCount ?? 0) > 0;
  } finally {
    await client.end();
  }
  if (!present) await seed();
}

afterAll(() => {
  if (savedEnableV8 === undefined) delete process.env.ENABLE_V8_GLOBAL;
  else process.env.ENABLE_V8_GLOBAL = savedEnableV8;
});

describe('Acceptance M14 D-03 · Manager lanes legacy fallback (no ENABLE_V8_GLOBAL)', () => {
  it('CONTROL: a gated-only /api/v8 path returns 404 V8_DISABLED (gate really is active)', async () => {
    const res = await request(app)
      .get('/api/v8/health')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body?.code).toBe('V8_DISABLED');
  });

  it('GET lanes/:laneId/problems returns 200 with a sensible shape WITHOUT ENABLE_V8_GLOBAL', async () => {
    expect(process.env.ENABLE_V8_GLOBAL).toBeUndefined();

    const res = await request(app)
      .get(LANES_PATH)
      .set('Authorization', `Bearer ${token}`);

    // Fallback works: NOT 404 (gate bypassed), NOT 401/403 (auth+perm ok),
    // NOT 500 (handler runs against the real DB).
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.data?.problems)).toBe(true);
    expect(typeof res.body?.data?.count).toBe('number');
    expect(res.body.data.count).toBe(res.body.data.problems.length);
    // Stable V8 read contract still stamped even on the fallback path.
    expect(res.body?.meta?.contract).toBe('execution_control_read_v1');
    expect(res.body?.meta?.version).toBe('v8');
  }, 30_000);

  it('GET lanes analysis returns 200 (six-section shape) on the fallback path', async () => {
    const res = await request(app)
      .get(`/api/v8/execution-control/manager/lanes/${LANE}/analysis`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body?.data).toBeTruthy();
    expect(res.body?.meta?.contract).toBe('execution_control_read_v1');
  }, 30_000);

  it('rejects an unauthenticated request with 401 (real auth is enforced on the alias)', async () => {
    const res = await request(app).get(LANES_PATH);
    expect(res.status).toBe(401);
  });

  it('rejects an invalid laneId with 400 MANAGER_LANE_INVALID (handler validation intact)', async () => {
    const res = await request(app)
      .get('/api/v8/execution-control/manager/lanes/not-a-lane/problems')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body?.code).toBe('MANAGER_LANE_INVALID');
  });
});
