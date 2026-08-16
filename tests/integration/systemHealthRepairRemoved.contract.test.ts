/**
 * SEC-PUB-001 — the anonymous auto-repair shell-out is GONE from the public app.
 *
 * This runs against the REAL Express app (`server/src/index`), not a bare router.
 * That distinction is the whole point: the previous coverage for this endpoint
 * (`tests/integration/system/system-health.repair.exec-*.test.ts`) mounted the
 * router in isolation via `makeTestApp`, so it asserted the handler's happy path
 * while telling us nothing about whether the route was reachable, or guarded, on
 * the app the product actually boots.
 *
 * The load-bearing assertion is NOT the 404 — it is that `child_process.exec` is
 * never invoked. A 404 alone could still mask a handler that shelled out before
 * responding, or a route re-added under a different mount.
 */
import path from 'path';
import request from 'supertest';
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Records every attempted process spawn. Declared via `vi.hoisted` so the
// `vi.mock` factory below (which is hoisted above the imports) can close over it.
const spawnLog = vi.hoisted(() => ({ calls: [] as string[] }));

vi.hoisted(() => {
  const nodePath = require('path');
  const nodeFs = require('fs');
  const dbFile = nodePath.resolve(__dirname, 'system-health-repair-removed.integration.db');
  // Start from an empty file every run, so a leftover DB can never make a fresh
  // assertion pass for the wrong reason.
  try {
    nodeFs.rmSync(dbFile, { force: true });
  } catch {
    /* best effort */
  }
  process.env.SQLITE_PATH = dbFile;
  process.env.MOCK_DB = 'false';
  process.env.DEMO_ORG_ID = 'demo-org';
});

// Spy on `child_process` while keeping every other export real, so mocking this
// module cannot itself break unrelated startup code. `exec` still invokes its
// callback (and still answers `promisify`) — if the handler were restored it
// would succeed and return 200, which keeps the negative control honest: the
// test must fail on the spy, not merely because a mock made the handler throw.
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  const fakeExec = Object.assign(
    (cmd: string, ...rest: any[]) => {
      spawnLog.calls.push(`exec:${cmd}`);
      const cb = rest.find((a) => typeof a === 'function');
      if (cb) cb(null, 'MOCKED-STDOUT', '');
      return undefined as any;
    },
    {
      [Symbol.for('nodejs.util.promisify.custom')]: async (cmd: string) => {
        spawnLog.calls.push(`exec:${cmd}`);
        return { stdout: 'MOCKED-STDOUT', stderr: '' };
      },
    }
  );
  const fakeSpawn = (cmd: string, ...rest: any[]) => {
    spawnLog.calls.push(`spawn:${cmd}`);
    return (actual as any).spawn(cmd, ...rest);
  };
  return { ...actual, default: actual, exec: fakeExec, spawn: fakeSpawn };
});

import app from '../../server/src/index';
import { initializeDatabase } from '../../server/src/database/DatabaseInitializer.js';
import { dbProxy, resetConnection } from '../../server/src/database/Database.js';
import { setDependencies } from '../../server/src/controllers/AuthController.js';

/** Every path that has ever named this operation, in code, docs or a dead view. */
const REPAIR_PATHS = [
  // The real historical mount: `index.ts` mounts system-health.routes.ts at
  // `/api/system`, so `router.post('/repair')` resolved here.
  '/api/system/repair',
  // The path SEC-PUB-001 and the OPS-DEMO-002 brief originally named. It never
  // existed — `/api/system-health` is the *twin* module systemHealth.routes.ts,
  // which is superadmin-guarded — but assert it stays unreachable regardless.
  '/api/system-health/repair',
  // What the (unrendered) SystemHealthDashboard view actually fetched.
  '/api/system/health/repair',
];

/** A path that has certainly never been routed, used as the "unrouted" baseline. */
const UNROUTED_CONTROL_PATH = '/api/system/definitely-not-a-route-sec-pub-001';

describe('SEC-PUB-001 anonymous auto-repair shell-out is removed', () => {
  beforeAll(async () => {
    await resetConnection();
    const init = await initializeDatabase();
    if (!init.success) throw new Error(`DB init failed: ${init.message}`);
    await setDependencies({ db: dbProxy });
  }, 120_000);

  afterAll(async () => {
    await resetConnection();
    try {
      const fs = await import('fs');
      fs.rmSync(path.resolve(__dirname, 'system-health-repair-removed.integration.db'), {
        force: true,
      });
    } catch {
      /* best effort */
    }
  });

  beforeEach(() => {
    spawnLog.calls = [];
  });

  it.each(REPAIR_PATHS)('POST %s is unrouted and spawns nothing', async (p) => {
    const res = await request(app).post(p).send({});

    // The assertion that actually matters, and it is asserted FIRST: a status
    // check alone could pass while a handler still shelled out before replying.
    expect(spawnLog.calls).toEqual([]);

    // The meaningful assertion is that the removed path is indistinguishable
    // from a path that never existed. The current secure catch-all returns 404.
    const control = await request(app).post(UNROUTED_CONTROL_PATH).send({});
    expect(res.status).toBe(control.status);
    expect(res.status).toBe(404);

    // Rule out the states that would mean the handler still exists: 200/202 is a
    // successful repair, 500 is a repair that ran and blew up.
    expect(res.status).not.toBe(200);
    expect(res.status).not.toBe(202);
    expect(res.status).not.toBe(500);
  });

  it('unauthenticated repair attempts spawn no process, even concurrently', async () => {
    const responses = await Promise.all(
      Array.from({ length: 12 }, () => request(app).post('/api/system/repair').send({}))
    );

    // A DoS via repeated shell-outs is the second half of this defect, so the
    // count must be zero under concurrency too, not merely on a single request.
    expect(spawnLog.calls).toHaveLength(0);
    for (const res of responses) {
      expect(res.status).toBe(404);
      expect(res.status).not.toBe(200);
    }
  });

  it('no repair verb is accepted under any HTTP method', async () => {
    for (const method of ['get', 'put', 'patch', 'delete'] as const) {
      const res = await (request(app) as any)[method]('/api/system/repair');
      expect(res.status).not.toBe(200);
    }
    expect(spawnLog.calls).toEqual([]);
  });

  // Targeted removal, not a broken router: the sibling route on the very same
  // module must still answer.
  it('GET /api/system/health (same router) still responds — now as readiness only', async () => {
    // SEC-PUB-002 replaced the detailed body (`overall` + `checks`) with a minimal
    // readiness answer. The detailed diagnostics live behind verifySuperAdmin at
    // /api/system-health. This assertion follows that change deliberately; the
    // point it still makes is that removing `/repair` did not break its sibling.
    const res = await request(app).get('/api/system/health');

    expect([200, 503]).toContain(res.status);
    expect(res.body.status === 'ready' || res.body.status === 'not-ready').toBe(true);
    expect(res.body).not.toHaveProperty('checks');
    // The health check must not have gained a shell-out of its own.
    expect(spawnLog.calls).toEqual([]);
  });

  it('the superadmin-guarded twin module is still mounted and still guarded', async () => {
    // systemHealth.routes.ts under /api/system-health — proves we removed the
    // unguarded module's route without collateral damage to the guarded one.
    // (Its *base* route `GET /api/system-health` answers 200 anonymously; that
    // is a separate read-only exposure reported under SEC-PUB-001, not fixed
    // here, since that module is owned by another workstream.)
    const res = await request(app).get('/api/system-health/detailed');
    expect([401, 403]).toContain(res.status);
    expect(spawnLog.calls).toEqual([]);
  });
});
