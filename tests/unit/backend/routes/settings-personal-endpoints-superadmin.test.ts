/**
 * TRI-MUST-01 (2026-08-24, TRIANGLE_COMPLETENESS_VERDICT) — nine personal
 * Settings/GDPR endpoints in settings.routes.ts were gated by
 * `requireActiveMembership`, a tenant-membership wall that 403s any account
 * without a row in `organization_members`. A SUPERADMIN has no tenant
 * membership by design (ADM-RAW-P0-001), so they could not save their own
 * notification/appearance preferences or use their own GDPR self-service
 * flows — the middleware conflated "acting on organization data" with
 * "acting on your own account".
 *
 * Fix: the nine endpoints that only ever read/write the *caller's own* row
 * (keyed by `req.user.id`, never another user's or another org's data) now
 * sit behind `verifyToken` alone — the same identity-only gate already used
 * by the pre-existing `/gdpr/consents` GET/PUT routes in this file.
 * `POST /notifications` is deliberately excluded from this fix: it lets an
 * org owner/admin update *another* member's preferences and performs its
 * own organization_members role check inline, so it keeps
 * `requireActiveMembership`.
 */
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  // A real SUPERADMIN token shape: no organizationId, no membership row anywhere.
  verifyToken: (req: any, _res: any, next: any) => {
    req.userId = 'superadmin-user-id';
    req.user = { id: 'superadmin-user-id', role: 'SUPERADMIN' };
    next();
  },
}));

describe('settings.routes.ts personal endpoints admit a membership-less SUPERADMIN (TRI-MUST-01)', () => {
  const dbGet = vi.fn();
  const dbAll = vi.fn();
  const dbRun = vi.fn();

  beforeEach(() => {
    dbGet.mockReset();
    dbAll.mockReset();
    dbRun.mockReset();
    // Personal-data reads (e.g. an existing user_preferences row) resolve
    // normally. Any query against organization_members rejects — if one of
    // these routes still consulted membership, that surfaces as a 500/503
    // instead of the 200 the test expects, which is exactly the proof that
    // the gate is really gone.
    dbGet.mockImplementation((sql: string) => {
      if (typeof sql === 'string' && sql.includes('organization_members')) {
        return Promise.reject(
          new Error('organization_members must not be queried for personal routes')
        );
      }
      return Promise.resolve(undefined);
    });
    dbRun.mockResolvedValue({ success: true });
    dbAll.mockResolvedValue([]);
    vi.doMock('../../../../server/src/utils/DbPromise.js', () => ({
      get: dbGet,
      all: dbAll,
      run: dbRun,
    }));
  });

  afterEach(() => {
    vi.resetModules();
  });

  async function loadApp() {
    const router = (await import('../../../../server/src/routes/settings.routes.ts')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/settings', router);
    return app;
  }

  it('PUT /preferences/notifications succeeds for a SUPERADMIN with no organization_members row', async () => {
    const app = await loadApp();
    const res = await request(app)
      .put('/api/settings/preferences/notifications')
      .send({ preferences: { email: true } });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('PUT /preferences/appearance succeeds for a SUPERADMIN with no organization_members row', async () => {
    const app = await loadApp();
    const res = await request(app)
      .put('/api/settings/preferences/appearance')
      .send({ theme: 'dark' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /gdpr/export-status succeeds for a SUPERADMIN with no organization_members row', async () => {
    const app = await loadApp();
    const res = await request(app).get('/api/settings/gdpr/export-status');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ request: null });
  });

  it('GET /gdpr/deletion-status succeeds for a SUPERADMIN with no organization_members row', async () => {
    const app = await loadApp();
    const res = await request(app).get('/api/settings/gdpr/deletion-status');

    expect(res.status).toBe(200);
    expect(res.body.request).toBeNull();
  });
});

describe('does NOT weaken org isolation: POST /notifications (acting on ANOTHER user) still enforces active membership (TRI-MUST-01)', () => {
  const dbGet = vi.fn();
  const dbAll = vi.fn();
  const dbRun = vi.fn();

  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('../../../../server/src/middleware/auth.middleware.js');
  });

  async function loadAppAs(user: Record<string, unknown>) {
    dbGet.mockReset();
    dbAll.mockReset();
    dbRun.mockReset();
    // No active-membership row for anyone — the handler must reject, never
    // silently allow the actor to rewrite another user's preferences.
    dbGet.mockResolvedValue(undefined);
    vi.doMock('../../../../server/src/middleware/auth.middleware.js', () => ({
      verifyToken: (req: any, _res: any, next: any) => {
        req.userId = user.id;
        req.user = user;
        next();
      },
    }));
    vi.doMock('../../../../server/src/utils/DbPromise.js', () => ({
      get: dbGet,
      all: dbAll,
      run: dbRun,
    }));
    vi.doMock('../../../../server/src/utils/Logger.js', () => ({
      default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    }));
    const router = (await import('../../../../server/src/routes/settings.routes.ts')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/settings', router);
    return app;
  }

  it('rejects a SUPERADMIN with no organizationId claim at all (identity unverifiable, blocked before the handler)', async () => {
    const app = await loadAppAs({ id: 'superadmin-user-id', role: 'SUPERADMIN' });

    const res = await request(app)
      .post('/api/settings/notifications')
      .send({ userId: 'some-other-member-id', preferences: { email: true } });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('ORG_MEMBERSHIP_UNVERIFIABLE');
  });

  it('rejects an actor who carries an organizationId claim but has no active row for it', async () => {
    const app = await loadAppAs({
      id: 'superadmin-user-id',
      role: 'SUPERADMIN',
      organizationId: 'some-org-id',
    });

    const res = await request(app)
      .post('/api/settings/notifications')
      .send({ userId: 'some-other-member-id', preferences: { email: true } });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ORG_MEMBERSHIP_REVOKED');
  });
});
