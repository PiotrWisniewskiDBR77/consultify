import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression test for module 19 MVP P0 fix.
 *
 * Before the fix, `GET /api/partners/payouts` read the partner org id from
 * `req.user?.partnerOrgId` — a field the auth middleware never sets — so the
 * route returned 403 for every authenticated caller. The fix routes it through
 * `requirePartnerOrgId` (DB resolution via `getActivePartnerOrgIdForUser`), the
 * same helper every other partner route uses.
 *
 * These tests assert that a valid JWT *without* `partnerOrgId` on `req.user`
 * still resolves to the correct partner org and returns 200, and that a user
 * with no partner org gets a clean 403 (not a crash).
 */

let mockUser: any = { id: 'user-1', role: 'PARTNER', organizationId: 'org-1' };
let resolvedPartnerOrgId: string | null = 'partner-org-1';

const getPayoutsMock = vi.fn(async () => [
  { id: 'payout-1', amount: 100, status: 'PAID' },
]);

vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    if (!mockUser) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    // Intentionally do NOT set req.user.partnerOrgId — mirrors real middleware.
    req.user = mockUser;
    req.userId = mockUser.id;
    next();
  },
}));

vi.mock('../../../../server/src/middleware/superAdmin.middleware.js', () => ({
  verifySuperAdmin: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/middleware/rbac.middleware.js', () => ({
  requireOrgRole: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/services/legacyCutover/requireActiveMembership.js', () => ({
  requireActiveMembership: (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../../server/src/services/partnerOrgResolution.js', () => ({
  getActivePartnerOrgIdForUser: vi.fn(async () => resolvedPartnerOrgId),
}));

vi.mock('../../../../server/src/services/partnerDemoSeedService.js', () => ({
  ensurePartnerDemoDataset: vi.fn(async () => undefined),
}));

vi.mock('../../../../server/src/services/partnerCommissionService.js', () => ({
  default: {
    getPayouts: getPayoutsMock,
  },
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  get: vi.fn(async () => null),
  run: vi.fn(async () => ({ changes: 0 })),
  tableExists: vi.fn(async () => true),
}));

describe('GET /api/partners/payouts — auth resolution (module 19 P0 fix)', () => {
  beforeEach(() => {
    mockUser = { id: 'user-1', role: 'PARTNER', organizationId: 'org-1' };
    resolvedPartnerOrgId = 'partner-org-1';
    getPayoutsMock.mockClear();
  });

  it('resolves the partner org from the DB even when req.user.partnerOrgId is unset', async () => {
    const { default: partnersRouter } = await import(
      '../../../../server/src/routes/partners.routes.js'
    );
    const app = express();
    app.use(express.json());
    app.use('/api/partners', partnersRouter);

    const res = await request(app).get('/api/partners/payouts');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(Array.isArray(res.body.data)).toBe(true);
    // Confirms the resolved org id (NOT a bogus req.user.partnerOrgId) was used.
    expect(getPayoutsMock).toHaveBeenCalledWith('partner-org-1', expect.any(Object));
  });

  it('returns 403 (not a crash) when the user has no partner org', async () => {
    resolvedPartnerOrgId = null;

    const { default: partnersRouter } = await import(
      '../../../../server/src/routes/partners.routes.js'
    );
    const app = express();
    app.use(express.json());
    app.use('/api/partners', partnersRouter);

    const res = await request(app).get('/api/partners/payouts');

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false });
    expect(getPayoutsMock).not.toHaveBeenCalled();
  });
});
