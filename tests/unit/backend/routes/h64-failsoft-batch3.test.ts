/**
 * H6.4 batch 3 — ADMIN/CONFIG/SYSTEM handlers: standard fail-soft/fail-closed.
 *
 * Continuation of tests/unit/backend/routes/h64-failsoft.test.ts (W4's 3 hot
 * user-facing handlers). This batch covers admin/superadmin/settings/config
 * routes per docs/standards/ERROR_HANDLING_STANDARD.md:
 *   - enrichment reads (settings preferences panels, superadmin signals badge)
 *     degrade to 200 + `degraded: true` with a safe empty/default payload when
 *     the underlying subsystem (DB) throws — never a bare 500.
 *   - writes (preference PUTs, lifecycle stage create) stay fail-closed: real
 *     5xx, but with a stable `code` and WITHOUT leaking `err.message`.
 *   - primary panel content that is not a side enrichment (org policy snapshot
 *     — drives access-control decisions downstream; superadmin lifecycle
 *     stages list) also stays fail-closed with a code, no err.message leak.
 *
 * Services/DB are mocked (subsystem-down simulation) — fast unit tests, not
 * the tests/acceptance/ real-DB parity harness.
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.userId = 'test-user-id';
    req.organizationId = 'test-org-id';
    req.user = { id: 'test-user-id', organizationId: 'test-org-id', role: 'SUPERADMIN' };
    next();
  },
}));

vi.mock('../../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: any) => next(),
  aiRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../../server/src/middleware/superAdmin.middleware.js', () => ({
  verifySuperAdmin: (_req: any, _res: any, next: any) => next(),
  requireSuperAdminCapability: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../../server/src/middleware/requireAudit.middleware.js', () => ({
  requireAudit: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../../server/src/middleware/superadminAuditMonitor.middleware.js', () => ({
  superadminAuditMonitor: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// 1. settings.routes.ts — preference panels (GET fail-soft, PUT fail-closed)
// ============================================================================
describe('/api/settings/preferences/* — fail-soft reads + fail-closed writes (H6.4 batch3)', () => {
  const dbGet = vi.fn();
  const dbAll = vi.fn();
  const dbRun = vi.fn();

  beforeEach(() => {
    dbGet.mockReset();
    dbAll.mockReset();
    dbRun.mockReset();
    vi.doMock('../../../../server/src/utils/DbPromise.js', () => ({
      get: dbGet,
      all: dbAll,
      run: dbRun,
    }));
  });

  afterEach(() => vi.resetModules());

  async function loadApp() {
    const router = (await import('../../../../server/src/routes/settings.routes.ts')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/settings', router);
    return app;
  }

  it('GET /preferences/regional degrades to 200 + safe defaults when DB subsystem throws', async () => {
    dbRun.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:5432'));
    dbGet.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:5432'));
    const app = await loadApp();

    const res = await request(app).get('/api/settings/preferences/regional');

    expect(res.status).toBe(200);
    expect(res.body.degraded).toBe(true);
    expect(res.body.preferences).toMatchObject({ timezone: 'UTC', currency: 'USD' });
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
  });

  it('PUT /preferences/regional stays fail-closed: 500 + code, no err.message leak', async () => {
    dbRun.mockRejectedValue(new Error('duplicate key value violates unique constraint xyz'));
    const app = await loadApp();

    const res = await request(app)
      .put('/api/settings/preferences/regional')
      .send({ preferences: { timezone: 'UTC' } });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('SETTINGS_REGIONAL_UPDATE_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('duplicate key');
  });

  it('PUT /preferences/regional names an unmigrated schema as 409 instead of 500', async () => {
    const missingRelation = Object.assign(
      new Error('relation "user_preferences" does not exist'),
      { code: '42P01' }
    );
    dbRun.mockRejectedValue(missingRelation);
    const app = await loadApp();

    const res = await request(app)
      .put('/api/settings/preferences/regional')
      .send({ preferences: { timezone: 'UTC' } });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SETTINGS_SCHEMA_NOT_MIGRATED');
    expect(JSON.stringify(res.body)).not.toContain('user_preferences');
  });

  it('GET /preferences/notifications degrades to 200 + safe defaults when DB subsystem throws', async () => {
    dbRun.mockRejectedValue(new Error('relation "user_preferences" does not exist'));
    dbGet.mockRejectedValue(new Error('relation "user_preferences" does not exist'));
    const app = await loadApp();

    const res = await request(app).get('/api/settings/preferences/notifications');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      preferences: { email: true, push: true, inApp: true, digest: 'daily' },
      degraded: true,
    });
    expect(JSON.stringify(res.body)).not.toContain('does not exist');
  });

  it('PUT /preferences/notifications stays fail-closed: 500 + code, no err.message leak', async () => {
    dbRun.mockRejectedValue(new Error('db unreachable at 10.0.0.5'));
    const app = await loadApp();

    const res = await request(app)
      .put('/api/settings/preferences/notifications')
      .send({ preferences: { email: false } });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('SETTINGS_NOTIFICATIONS_UPDATE_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
  });

  it('GET /preferences/quietHours degrades to 200 + safe defaults when DB subsystem throws', async () => {
    dbRun.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:5432'));
    dbGet.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:5432'));
    const app = await loadApp();

    const res = await request(app).get('/api/settings/preferences/quietHours');

    expect(res.status).toBe(200);
    expect(res.body.degraded).toBe(true);
    expect(res.body.preferences).toMatchObject({ enabled: false, startTime: '22:00' });
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
  });

  it('PUT /preferences/quietHours stays fail-closed: 500 + code, no err.message leak', async () => {
    dbRun.mockRejectedValue(new Error('constraint violation xyz'));
    const app = await loadApp();

    const res = await request(app)
      .put('/api/settings/preferences/quietHours')
      .send({ enabled: true });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('SETTINGS_QUIET_HOURS_UPDATE_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('constraint violation xyz');
  });

  it('GET /preferences/regional happy path unchanged (no degraded flag)', async () => {
    dbRun.mockResolvedValue({ success: true });
    dbGet.mockResolvedValue(undefined);
    const app = await loadApp();

    const res = await request(app).get('/api/settings/preferences/regional');

    expect(res.status).toBe(200);
    expect(res.body.degraded).toBeUndefined();
    expect(res.body.preferences.timezone).toBe('UTC');
  });
});

// ============================================================================
// 2. organization-limits.routes.ts — policy snapshot (fail-closed, security-relevant)
// ============================================================================
describe('/api/organization/policy-snapshot — fail-closed, no err.message leak (H6.4 batch3)', () => {
  const buildPolicySnapshot = vi.fn();

  beforeEach(() => {
    buildPolicySnapshot.mockReset();
    vi.doMock('../../../../server/src/services/accessPolicyService.js', () => ({
      buildPolicySnapshot,
    }));
  });

  afterEach(() => vi.resetModules());

  async function loadApp() {
    const router = (
      await import('../../../../server/src/routes/organization/organization-limits.routes.ts')
    ).default;
    const app = express();
    app.use(express.json());
    app.use('/api/organization', router);
    return app;
  }

  it('GET /policy-snapshot stays fail-closed: 500 + code, no err.message leak', async () => {
    buildPolicySnapshot.mockRejectedValue(new Error('relation "org_policies" does not exist'));
    const app = await loadApp();

    const res = await request(app).get('/api/organization/policy-snapshot');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('ORG_POLICY_SNAPSHOT_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('does not exist');
  });

  it('GET /policy-snapshot happy path unchanged', async () => {
    buildPolicySnapshot.mockResolvedValue({ organizationId: 'test-org-id', policies: [] });
    const app = await loadApp();

    const res = await request(app).get('/api/organization/policy-snapshot');

    expect(res.status).toBe(200);
    expect(res.body.organizationId).toBe('test-org-id');
  });
});

// ============================================================================
// 3. superadmin.routes.ts — signals (fail-soft badge) + lifecycle stages
//    (fail-closed primary content / fail-closed write)
// ============================================================================
describe('/api/superadmin — signals fail-soft, lifecycle stages fail-closed (H6.4 batch3)', () => {
  const dbGet = vi.fn();
  const dbAll = vi.fn();
  const dbRun = vi.fn();

  beforeEach(() => {
    dbGet.mockReset();
    dbAll.mockReset();
    dbRun.mockReset();
    vi.doMock('../../../../server/src/utils/DbPromise.js', () => ({
      get: dbGet,
      all: dbAll,
      run: dbRun,
    }));
  });

  afterEach(() => vi.resetModules());

  async function loadApp() {
    const router = (await import('../../../../server/src/routes/superadmin.routes.ts')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/superadmin', router);
    return app;
  }

  it('GET /signals degrades to 200 + empty array when DB subsystem throws (no 500)', async () => {
    dbAll.mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:5432'));
    const app = await loadApp();

    const res = await request(app).get('/api/superadmin/signals');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
  });

  it('GET /lifecycle/stages stays fail-closed: 500 + code, no err.message leak', async () => {
    dbAll.mockRejectedValue(new Error('relation "customer_lifecycle_stages" does not exist'));
    const app = await loadApp();

    const res = await request(app).get('/api/superadmin/lifecycle/stages');

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('SUPERADMIN_LIFECYCLE_STAGES_FETCH_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('does not exist');
  });

  it('POST /lifecycle/stages (write) stays fail-closed: 500 + code, no err.message leak', async () => {
    dbRun.mockRejectedValue(new Error('duplicate key value violates unique constraint xyz'));
    const app = await loadApp();

    const res = await request(app)
      .post('/api/superadmin/lifecycle/stages')
      .send({ name: 'Onboarding' });

    expect(res.status).toBe(500);
    expect(res.body.code).toBe('SUPERADMIN_LIFECYCLE_STAGE_CREATE_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('duplicate key');
  });
});
