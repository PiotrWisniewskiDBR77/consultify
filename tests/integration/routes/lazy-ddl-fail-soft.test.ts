/**
 * Fail-soft standard for lazy-DDL read handlers.
 *
 * Regression guard for the "bare HTTP 500 = uncaught ensure*Table DDL in a GET"
 * class of bug (finding: settings_500_lazy_ddl). When the lazy CREATE TABLE
 * inside a read handler throws (DDL error, permission, connection loss), the
 * endpoint must degrade to an empty/default 200 response instead of surfacing
 * a 500 that white-screens the client.
 *
 * We mock DbPromise so `run` (the DDL) rejects and assert the read still 200s.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

import { makeTestApp } from '../_helpers/testApp';

// DbPromise mock: `run` (used by ensure*Table DDL) rejects; `all`/`get` return empty.
const db = vi.hoisted(() => ({
  run: vi.fn(),
  all: vi.fn(),
  get: vi.fn(),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  run: (...a: any[]) => db.run(...a),
  all: (...a: any[]) => db.all(...a),
  get: (...a: any[]) => db.get(...a),
}));

// Pass-through auth so we exercise the handler, not the guards.
vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'u-1', organizationId: 'o-1', role: 'SUPERADMIN', email: 'a@b.c' };
    req.userId = 'u-1';
    req.organizationId = 'o-1';
    req.userRole = 'SUPERADMIN';
    next();
  },
}));

vi.mock('../../../server/src/middleware/superAdmin.middleware.js', () => ({
  verifySuperAdmin: (_req: any, _res: any, next: any) => next(),
}));

describe('Lazy-DDL read handlers are fail-soft (no bare 500)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The lazy CREATE TABLE / ALTER inside ensureTable() rejects hard.
    db.run.mockRejectedValue(new Error('relation "feature_flags" DDL failed'));
    db.all.mockResolvedValue([]);
    db.get.mockResolvedValue(null);
  });

  it('GET /feature-flags/runtime degrades to empty flags when lazy DDL throws', async () => {
    vi.resetModules();
    const router = (await import('../../../server/src/routes/featureFlags.routes.ts')).default;
    const app = makeTestApp({ mountPath: '/api/feature-flags', router });

    const res = await request(app).get('/api/feature-flags/runtime');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ flags: {}, variants: {} });
  });
});
