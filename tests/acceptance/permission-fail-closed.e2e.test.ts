/**
 * Acceptance E2E — T6: permissionService / permission.middleware fail-CLOSED audit.
 *
 * REJESTR T6 (task_d6485926 "permissionService fail-open"): a prior skeptic
 * review concluded the middleware is fail-CLOSED. This suite verifies that
 * formally, end to end, against the REAL permission.middleware.ts (the one
 * actually wired into routes — confirmed live caller: server/src/routes/
 * interview.routes.ts -> Gateway.ts mounts it at /api/interview) and the REAL
 * permissionService.ts, against the REAL local parity Postgres (:5443,
 * schema = demo/production; DATABASE_URL must be local per harness.ts guard).
 *
 * ★ REAL BUG FOUND AND FIXED while writing this test (not a phantom):
 * `permissionService.hasPermission()` had a well-designed catch block that
 * correctly distinguishes "permissions tables missing/not migrated" (apply a
 * narrow role-fallback allowlist) from any other internal error (deny). BUT
 * the two `DbPromise.get()` calls inside the try block were invoked WITHOUT
 * `{ fallback: false }`, and DbPromise.get() defaults to `fallback: true`,
 * which SWALLOWS db errors and resolves `null` instead of rejecting —
 * indistinguishable from "no row found". That meant the catch block was
 * effectively dead code: ANY internal DB error (connection reset, timeout,
 * transient failure — not just a missing table) silently fell through to
 * `allowFallbackPermission()`, granting narrow-allowlisted roles (e.g.
 * ADMIN + INTERVIEW_ASSIGN_MANAGE) access on an unrelated internal error.
 * Verified empirically with a fake `db.get`/`db.all` that invokes its
 * callback with a generic Error — BEFORE the fix this returned `true` for
 * ADMIN+INTERVIEW_ASSIGN_MANAGE; AFTER the fix (added `{ fallback: false }`
 * to both DbPromise.get calls in server/src/services/permissionService.ts)
 * it returns `false`, while the legitimate "missing table" degraded-mode
 * fallback (a real Postgres "relation ... does not exist" error) is
 * preserved unchanged. Tests A1-A3 below encode both the fix and the
 * preserved legitimate behaviour so this can't silently regress.
 *
 * Scope per rejestr T6:
 *   (a) internal error in the permission resolver -> request DENIED (not
 *       passed through) — proven at THREE layers: service (A), middleware
 *       with an injected broken PermissionService (B), and the full real
 *       HTTP pipeline through the real router with a broken db (D).
 *   (b) missing permission -> 403 — proven via a real HTTP request through
 *       the real interview router (C).
 *
 * Fixture prefix: odbior--t6-- (uses the shared SEED org/user from seed.mjs,
 * which already carries the reversible odbior-- prefix; no new persistent
 * rows are created by this file — permission checks use synthetic
 * userId/permission keys instead of writing DB rows).
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { mintToken } from './harness.js';
import { seed } from './seed.mjs';

// ==========================================================================
// A) SERVICE LEVEL — server/src/services/permissionService.ts
// ==========================================================================

describe('T6-A · permissionService.hasPermission — internal error is fail-CLOSED', () => {
  let PermissionService: typeof import('../../server/src/services/permissionService.js').default;
  let realDb: unknown;

  /** A fake IDatabase whose get/all invoke their callback with a generic,
   * non-missing-table error — simulates a genuine internal failure (dropped
   * connection, timeout, transient network blip), NOT a schema problem. */
  const genericErrorDb = {
    get: (_sql: string, _params: unknown[], cb: (err: Error | null, row: unknown) => void) =>
      cb(new Error('connection terminated unexpectedly'), null),
    all: (_sql: string, _params: unknown[], cb: (err: Error | null, rows: unknown[]) => void) =>
      cb(new Error('connection terminated unexpectedly'), []),
    run: (
      _sql: string,
      _params: unknown[],
      cb: (this: { changes: number }, err: Error | null) => void
    ) => cb.call({ changes: 0 }, new Error('connection terminated unexpectedly')),
    exec: (_sql: string, cb: (err: Error | null) => void) =>
      cb(new Error('connection terminated unexpectedly')),
  };

  /** A fake IDatabase simulating the LEGITIMATE degraded-mode condition:
   * permission tables genuinely missing (migration not applied yet). This
   * must keep working exactly as designed after the fix. */
  const missingTableDb = {
    get: (_sql: string, _params: unknown[], cb: (err: Error | null, row: unknown) => void) =>
      cb(new Error('relation "org_user_permissions" does not exist'), null),
    all: (_sql: string, _params: unknown[], cb: (err: Error | null, rows: unknown[]) => void) =>
      cb(new Error('relation "org_user_permissions" does not exist'), []),
    run: (
      _sql: string,
      _params: unknown[],
      cb: (this: { changes: number }, err: Error | null) => void
    ) => cb.call({ changes: 0 }, new Error('boom')),
    exec: (_sql: string, cb: (err: Error | null) => void) => cb(new Error('boom')),
  };

  beforeAll(async () => {
    const mod = await import('../../server/src/services/permissionService.js');
    PermissionService = mod.default;
    const { getDatabase } = await import('../../server/src/database/Database.js');
    realDb = getDatabase();
  });

  afterEach(() => {
    // Always restore the real db so later tests/files never see the fake one.
    PermissionService.setDependencies({ db: realDb as any });
  });

  it('A1: generic internal DB error -> DENIED even for a role that would normally be fallback-allowed (the bug this test locks in)', async () => {
    PermissionService.setDependencies({ db: genericErrorDb as any });
    const allowed = await PermissionService.hasPermission(
      'probe-user',
      'probe-org',
      'INTERVIEW_ASSIGN_MANAGE',
      'ADMIN'
    );
    expect(allowed).toBe(false);
  });

  it('A2: generic internal DB error -> DENIED for a role with no fallback entries (control)', async () => {
    PermissionService.setDependencies({ db: genericErrorDb as any });
    const allowed = await PermissionService.hasPermission(
      'probe-user',
      'probe-org',
      'INTERVIEW_ASSIGN_MANAGE',
      'TEAM_MEMBER'
    );
    expect(allowed).toBe(false);
  });

  it('A3: generic internal DB error -> DENIED for a permission key not on ANY fallback allowlist, even for ADMIN', async () => {
    PermissionService.setDependencies({ db: genericErrorDb as any });
    const allowed = await PermissionService.hasPermission(
      'probe-user',
      'probe-org',
      'SOME_RANDOM_UNLISTED_PERMISSION',
      'ADMIN'
    );
    expect(allowed).toBe(false);
  });

  it('A4 (control, must NOT regress): a genuinely missing-table error still applies the narrow, intentional degraded-mode fallback for ADMIN', async () => {
    PermissionService.setDependencies({ db: missingTableDb as any });
    const allowed = await PermissionService.hasPermission(
      'probe-user',
      'probe-org',
      'INTERVIEW_ASSIGN_MANAGE',
      'ADMIN'
    );
    expect(allowed).toBe(true);
  });

  it('A5 (control): the same missing-table condition still denies a role with no fallback entries', async () => {
    PermissionService.setDependencies({ db: missingTableDb as any });
    const allowed = await PermissionService.hasPermission(
      'probe-user',
      'probe-org',
      'INTERVIEW_ASSIGN_MANAGE',
      'TEAM_MEMBER'
    );
    expect(allowed).toBe(false);
  });
});

// ==========================================================================
// B) MIDDLEWARE LEVEL — server/src/middleware/permission.middleware.ts
//    (the REAL middleware; live caller confirmed: interview.routes.ts,
//    benefitsRegister.routes.ts, rollout*.routes.ts, v8/interview*.routes.ts)
// ==========================================================================

describe('T6-B · permission.middleware.requirePermission — resolver throw is fail-CLOSED, never calls next()', () => {
  let requirePermission: typeof import('../../server/src/middleware/permission.middleware.js').requirePermission;
  let setDependencies: typeof import('../../server/src/middleware/permission.middleware.js').setDependencies;

  beforeAll(async () => {
    const mod = await import('../../server/src/middleware/permission.middleware.js');
    requirePermission = mod.requirePermission;
    setDependencies = mod.setDependencies;
  });

  afterEach(async () => {
    // Restore the real PermissionService + GovernanceAuditService for later tests.
    const [{ default: RealPermissionService }, { default: RealGovernanceAuditService }] =
      await Promise.all([
        import('../../server/src/services/permissionService.js'),
        import('../../server/src/services/governanceAuditService.js'),
      ]);
    setDependencies({
      PermissionService: RealPermissionService as any,
      GovernanceAuditService: RealGovernanceAuditService as any,
    });
  });

  function buildProbeApp(): { app: Express; handlerHit: () => boolean } {
    let hit = false;
    const app = express();
    app.use((req: any, _res, next) => {
      // Simulate what verifyToken would have attached.
      req.user = { id: 'probe-user', organization_id: 'probe-org', role: 'ADMIN' };
      req.userId = 'probe-user';
      req.organizationId = 'probe-org';
      req.userRole = 'ADMIN';
      next();
    });
    app.get('/probe', requirePermission('INTERVIEW_ASSIGN_MANAGE') as any, (_req, res) => {
      hit = true;
      res.status(200).json({ ok: true });
    });
    return { app, handlerHit: () => hit };
  }

  it('B1: PermissionService.hasPermission throwing -> 500 PERMISSION_ERROR, downstream route handler NEVER reached', async () => {
    setDependencies({
      PermissionService: {
        hasPermission: async () => {
          throw new Error('simulated resolver internal error');
        },
      } as any,
    });
    const { app, handlerHit } = buildProbeApp();
    const res = await request(app).get('/probe');
    expect(res.status).toBe(500);
    expect(res.body?.code).toBe('PERMISSION_ERROR');
    expect(handlerHit()).toBe(false);
  });

  it('B2 (control): PermissionService.hasPermission resolving false -> 403 PERMISSION_DENIED, handler not reached', async () => {
    setDependencies({
      PermissionService: {
        hasPermission: async () => false,
      } as any,
    });
    const { app, handlerHit } = buildProbeApp();
    const res = await request(app).get('/probe');
    expect(res.status).toBe(403);
    expect(res.body?.code).toBe('PERMISSION_DENIED');
    expect(handlerHit()).toBe(false);
  });

  it('B3 (control): PermissionService.hasPermission resolving true -> 200, handler IS reached', async () => {
    setDependencies({
      PermissionService: {
        hasPermission: async () => true,
      } as any,
    });
    const { app, handlerHit } = buildProbeApp();
    const res = await request(app).get('/probe');
    expect(res.status).toBe(200);
    expect(handlerHit()).toBe(true);
  });
});

// ==========================================================================
// C) + D) FULL HTTP PIPELINE — real router (interview.routes.ts, the live
//    caller mounted at /api/interview in Gateway.ts) behind real verifyToken,
//    against the real local parity Postgres.
// ==========================================================================

async function mountRouter(prefix: string, routerImportPath: string): Promise<Express> {
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const { default: router } = await import(routerImportPath as any);
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(prefix, verifyToken as any, router);
  return app;
}

describe('T6-C/D · Real HTTP pipeline through interview.routes.ts (live caller of permission.middleware)', () => {
  let app: Express;

  beforeAll(async () => {
    await seed();
    app = await mountRouter('/api/interview', '../../server/src/routes/interview.routes.js');
  }, 60_000);

  afterEach(async () => {
    // Make sure the real db is restored on permissionService after test D.
    const [{ default: RealPermissionService }, { getDatabase }] = await Promise.all([
      import('../../server/src/services/permissionService.js'),
      import('../../server/src/database/Database.js'),
    ]);
    RealPermissionService.setDependencies({ db: getDatabase() as any });
  });

  it('C1 (b — missing permission -> 403): TEAM_MEMBER with no override/builtin rows is DENIED on a permission-gated route', async () => {
    const token = mintToken({ role: 'TEAM_MEMBER' });
    const res = await request(app)
      .get('/api/interview/assignments')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body?.code).toBe('PERMISSION_DENIED');
  });

  it('C2 (control): ADMIN (narrow role-fallback includes INTERVIEW_ASSIGN_VIEW/MANAGE) passes the same gate — NOT 403', async () => {
    const token = mintToken({ role: 'ADMIN' });
    const res = await request(app)
      .get('/api/interview/assignments')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).not.toBe(403);
    expect(res.body?.code).not.toBe('PERMISSION_DENIED');
  });

  it('D1 (a — internal error, full pipeline): a real internal permissionService DB error DENIES a request that would otherwise pass the gate', async () => {
    const { default: RealPermissionService } = await import(
      '../../server/src/services/permissionService.js'
    );
    // Break the resolver exactly like probe A1: generic (non-missing-table) error.
    RealPermissionService.setDependencies({
      db: {
        get: (_s: string, _p: unknown[], cb: (err: Error | null, row: unknown) => void) =>
          cb(new Error('connection terminated unexpectedly'), null),
        all: (_s: string, _p: unknown[], cb: (err: Error | null, rows: unknown[]) => void) =>
          cb(new Error('connection terminated unexpectedly'), []),
        run: (
          _s: string,
          _p: unknown[],
          cb: (this: { changes: number }, err: Error | null) => void
        ) => cb.call({ changes: 0 }, new Error('connection terminated unexpectedly')),
        exec: (_s: string, cb: (err: Error | null) => void) =>
          cb(new Error('connection terminated unexpectedly')),
      } as any,
    });

    const token = mintToken({ role: 'ADMIN' });
    const res = await request(app)
      .get('/api/interview/assignments')
      .set('Authorization', `Bearer ${token}`);

    // BEFORE the T6 fix this request would have returned 200 (fail-open via the
    // swallowed DbPromise error). After the fix it must be denied.
    expect(res.status).toBe(403);
    expect(res.body?.code).toBe('PERMISSION_DENIED');
  }, 30_000);
});

afterAll(async () => {
  // Belt-and-braces: restore the real db handle one more time in case a test
  // above threw before its own afterEach ran.
  const [{ default: RealPermissionService }, { getDatabase }] = await Promise.all([
    import('../../server/src/services/permissionService.js'),
    import('../../server/src/database/Database.js'),
  ]);
  RealPermissionService.setDependencies({ db: getDatabase() as any });
});
