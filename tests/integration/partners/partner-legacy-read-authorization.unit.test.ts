/**
 * AMD-PRT-ECONOMICS-002 (owner decision 2A) — MOCK-ONLY UNIT SUITE.
 *
 * GAP B (independent-audit finding): `server/src/routes/partners.routes.ts`
 * (the LEGACY `/api/partners/*` surface) has FIVE economic GETs with NO role
 * check at all — `GET /payout-settings`, `GET /earnings`,
 * `GET /commission-transactions`, `GET /payouts`, `GET /commissions` — every
 * one of them gates only on `requirePartnerOrgId` (any authenticated user
 * with an ACTIVE partner-org membership, of ANY role). This mirrors the gap
 * `partner-economics-read-authorization.unit.test.ts` already closed on the
 * sibling V8 router (`server/src/routes/v8/partner.routes.ts`); this file
 * proves the equivalent fix on the legacy router, applied via the SAME
 * `requireActiveMembership` + `requireOrgRole('admin')` pair.
 *
 * WHAT THIS FILE ACTUALLY PROVES. The REAL `partners.routes.ts` router (no
 * reimplementation, no route interception) is mounted with `supertest`
 * against a real in-process `express()` app. Because this legacy router
 * calls `verifyToken` itself (`router.use(verifyToken)`, unlike the v8
 * router where auth is attached upstream), `verifyToken` is replaced with a
 * synthetic auth-simulation middleware that sets `req.userId`, `req.user`,
 * `req.userRole` and `req.organizationId` directly from a fixed per-test
 * fixture — never from a request header or body — modelling "role is
 * server-derived" the same way the real `verifyToken` resolves it from a
 * live JWT + `organization_members` row. Every service the router imports
 * and the shared persistence seam (`utils/DbPromise.js`,
 * `database/Database.js`, `utils/Logger.js`) are mocked. The REAL
 * `partnerEconomicsPolicy.ts`, `middleware/rbac.middleware.ts`
 * (`requireOrgRole`) and `services/legacyCutover/requireActiveMembership.ts`
 * are NOT mocked — those are exactly what this suite verifies, together with
 * the real `partnerLegacyCutoverGuard` (unmoved, still runs, and must not
 * itself gate these GETs).
 *
 * From this it proves:
 *   1. ACTIVE OWNER and ACTIVE ADMIN reach the handler (200) on each of the
 *      five economic read routes.
 *   2. MEMBER, a revoked membership, a foreign-tenant membership and a
 *      SUPERADMIN role claim with no live membership row are all denied
 *      (403) on each of the five routes.
 *   3. At least three non-economic GETs (`/connection`, `/referral-tools`,
 *      `/attributions`) still succeed for an ordinary MEMBER — proving the
 *      gate is scoped to exactly the five economic reads, not a blanket
 *      lockdown.
 *
 * WHAT THIS FILE DOES NOT PROVE, AND MUST NOT BE CITED FOR: anything
 * requiring a real database — no schema is applied, no `organization_members`
 * row is ever actually queried; membership states are simulated entirely
 * through the mocked `DbPromise.get` return value. It also does not exercise
 * the real `verifyToken` JWT-verification logic (replaced here, as described
 * above) nor `getActivePartnerOrgIdForUser`'s own logic (mocked wholesale).
 * "Foreign tenant" and "no matching active row at all" collapse into the
 * same observable mock behaviour (`DbPromise.get` resolving to `undefined`),
 * exactly as documented in the v8 sibling suite this file mirrors.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import type { Server } from 'http';

/* ==========================================================================
 * Persistence + shared-utility seams. `partners.routes.ts`,
 * `requireActiveMembership.ts`, `partnerEconomicsPolicy.ts` and
 * `partnerLegacyCutover.ts` all reach the database through exactly these
 * two modules.
 * ========================================================================== */

const {
  dbRun,
  dbGet,
  dbAll,
  dbExec,
  dbTransaction,
  getActivePartnerOrgIdForUser,
  ensurePartnerDemoDataset,
  getPartnerPayoutSettings,
  getEarningsSummary,
  getCommissions,
  getPayouts,
} = vi.hoisted(() => ({
  dbRun: vi.fn(),
  dbGet: vi.fn(),
  dbAll: vi.fn(),
  dbExec: vi.fn(),
  dbTransaction: vi.fn(),
  getActivePartnerOrgIdForUser: vi.fn(),
  ensurePartnerDemoDataset: vi.fn().mockResolvedValue(undefined),
  getPartnerPayoutSettings: vi.fn(),
  getEarningsSummary: vi.fn(),
  getCommissions: vi.fn(),
  getPayouts: vi.fn(),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => dbRun(...args),
  get: (...args: unknown[]) => dbGet(...args),
  all: (...args: unknown[]) => dbAll(...args),
  exec: (...args: unknown[]) => dbExec(...args),
  transaction: (...args: unknown[]) => dbTransaction(...args),
}));

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({ get: vi.fn(), run: vi.fn(), all: vi.fn(), query: vi.fn() }),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/* ==========================================================================
 * verifyToken is called BY THIS ROUTER (`router.use(verifyToken)`), unlike
 * the v8 router where auth attaches upstream. Replaced with a middleware
 * that copies the per-request fixture actor onto `req`, exactly mirroring
 * what the real `verifyToken` does after JWT verification.
 * ========================================================================== */

interface Actor {
  userId: string;
  organizationId: string;
  userRole: string; // e.g. 'OWNER' | 'ADMIN' | 'MEMBER' | 'SUPERADMIN'
}

let currentActor: Actor | null = null;

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: any) => {
    const actor = currentActor;
    if (!actor) {
      next(new Error('test bug: currentActor not set before request'));
      return;
    }
    req.userId = actor.userId;
    req.organizationId = actor.organizationId;
    req.userRole = actor.userRole;
    req.user = { id: actor.userId, organizationId: actor.organizationId, role: actor.userRole };
    next();
  },
}));

/* ==========================================================================
 * Service seams `partners.routes.ts` imports directly. Mocked wholesale so
 * every economic-read handler under test resolves without touching a real
 * database. Non-economic services used by the three positive-control routes
 * (`getReferralTools`, `getPartnerAttributions`) are deliberately left
 * unmocked — those handlers already catch a DB error and fall back to an
 * empty/derived result (see `partners.routes.ts` `/referral-tools` and
 * `/attributions`), so they succeed even against the bare mocked DB handle
 * above; this keeps the mock surface honest and minimal.
 * ========================================================================== */

vi.mock('../../../server/src/services/partnerOrgResolution.js', () => ({
  getActivePartnerOrgIdForUser: (...args: unknown[]) => getActivePartnerOrgIdForUser(...args),
}));

vi.mock('../../../server/src/services/partnerDemoSeedService.js', () => ({
  ensurePartnerDemoDataset: (...args: unknown[]) => ensurePartnerDemoDataset(...args),
  default: { ensurePartnerDemoDataset: (...args: unknown[]) => ensurePartnerDemoDataset(...args) },
}));

vi.mock('../../../server/src/services/partnerPayoutSettingsService.js', () => ({
  getPartnerPayoutSettings: (...args: unknown[]) => getPartnerPayoutSettings(...args),
  isPartnerPayoutDestinationComplete: () => true,
  updatePartnerPayoutSettings: vi.fn(),
}));

vi.mock('../../../server/src/services/partnerCommissionService.js', () => ({
  default: {
    getEarningsSummary: (...args: unknown[]) => getEarningsSummary(...args),
    getCommissions: (...args: unknown[]) => getCommissions(...args),
    getPayouts: (...args: unknown[]) => getPayouts(...args),
    requestPayout: vi.fn(),
  },
}));

/* ==========================================================================
 * Real modules under test — deliberately NOT mocked:
 *   - server/src/services/partnerEconomicsPolicy.ts (write guard + projection)
 *   - server/src/middleware/rbac.middleware.ts (requireOrgRole)
 *   - server/src/services/legacyCutover/requireActiveMembership.ts
 *   - server/src/services/partnerLegacyCutover.ts (partnerLegacyCutoverGuard)
 *   - server/src/routes/partners.routes.ts (the file under test)
 * ========================================================================== */

import partnersRoutes from '../../../server/src/routes/partners.routes.js';

/* ==========================================================================
 * Test app. ONE Express app + ONE already-listening http.Server for the
 * whole file (beforeAll/afterAll), per the supertest-lifecycle guidance for
 * this directory: passing a not-yet-listening app to supertest makes it
 * bind+close its own ephemeral port PER REQUEST, and this file alone issues
 * ~30 requests, which is exactly the kind of rapid ephemeral-port churn that
 * previously produced ECONNRESET under load. `currentActor` is read
 * per-request-time (not baked in at app-construction time); tests in this
 * file run strictly sequentially, so mutating it immediately before each
 * `await request(...)` call is race-free.
 * ========================================================================== */

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/partners', partnersRoutes);
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err?.status || 500).json({ error: err?.message || 'error' });
  });
  return app;
}

let server: Server;

beforeAll(() => {
  server = buildApp().listen(0);
});

afterAll(() => {
  return new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

const TENANT_ORG = 'org-tenant-1';
const PARTNER_ORG_ID = 'partner-org-1';
const USER_ID = 'user-1';

const OWNER: Actor = { userId: USER_ID, organizationId: TENANT_ORG, userRole: 'OWNER' };
const ADMIN: Actor = { userId: USER_ID, organizationId: TENANT_ORG, userRole: 'ADMIN' };
const MEMBER: Actor = { userId: USER_ID, organizationId: TENANT_ORG, userRole: 'MEMBER' };
const SUPERADMIN_NO_MEMBERSHIP: Actor = {
  userId: USER_ID,
  organizationId: TENANT_ORG,
  userRole: 'SUPERADMIN',
};
// "Foreign tenant": the actor's session claims ADMIN, but the live
// membership row (mocked below) does not exist for (userId, organizationId).
const FOREIGN_TENANT_ADMIN: Actor = { userId: USER_ID, organizationId: TENANT_ORG, userRole: 'ADMIN' };
const REVOKED_ADMIN: Actor = { userId: USER_ID, organizationId: TENANT_ORG, userRole: 'ADMIN' };

const ECONOMIC_READ_ROUTES: Array<{ method: 'get'; path: string }> = [
  { method: 'get', path: '/api/partners/payout-settings' },
  { method: 'get', path: '/api/partners/earnings' },
  { method: 'get', path: '/api/partners/commission-transactions' },
  { method: 'get', path: '/api/partners/payouts' },
  { method: 'get', path: '/api/partners/commissions' },
];

function mockAllEconomicReadsSucceed() {
  getActivePartnerOrgIdForUser.mockResolvedValue(PARTNER_ORG_ID);
  getPartnerPayoutSettings.mockResolvedValue({});
  getEarningsSummary.mockResolvedValue({
    totalPending: 0,
    totalApproved: 0,
    thisMonth: 0,
    thisMonthCount: 0,
    lastMonth: 0,
    currency: 'EUR',
  });
  getCommissions.mockResolvedValue([]);
  getPayouts.mockResolvedValue([]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAllEconomicReadsSucceed();
  // partnerLegacyCutoverGuard (real, unmoved) writes a `legacy_read` telemetry
  // row via DbPromise.run for every GET. It swallows a rejection and still
  // calls next(), but resolving keeps these tests' failure signal limited to
  // the auth gate under test.
  dbRun.mockResolvedValue(undefined);
  // GET /connection (a non-economic positive control) does its own
  // DbPromise.all lookups for specializations/regions once an org row is
  // found; default to empty arrays so that unrelated code path never fails
  // with a 500 and masks what this suite actually tests (authorization).
  dbAll.mockResolvedValue([]);
});

describe('AMD-PRT-ECONOMICS-002 — economic read authorization (legacy partners router, GAP B)', () => {
  describe('positive: OWNER and ADMIN can read each economic route', () => {
    for (const actorName of ['OWNER', 'ADMIN'] as const) {
      const actor = actorName === 'OWNER' ? OWNER : ADMIN;
      for (const route of ECONOMIC_READ_ROUTES) {
        it(`${actorName} reading ${route.path} succeeds with 200`, async () => {
          dbGet.mockResolvedValue({ status: 'ACTIVE' });
          currentActor = actor;
          const res = await request(server)[route.method](route.path);
          expect(res.status).toBe(200);
        });
      }
    }
  });

  describe('negative: MEMBER is denied on every economic route', () => {
    for (const route of ECONOMIC_READ_ROUTES) {
      it(`MEMBER reading ${route.path} is denied with 403`, async () => {
        // Membership row exists and is ACTIVE — MEMBER fails the ROLE check,
        // not the membership check.
        dbGet.mockResolvedValue({ status: 'ACTIVE' });
        currentActor = MEMBER;
        const res = await request(server)[route.method](route.path);
        expect(res.status).toBe(403);
        expect(res.body?.code).toBe('RBAC_INSUFFICIENT_ROLE');
      });
    }
  });

  describe('negative: foreign-tenant ADMIN is denied on every economic route', () => {
    for (const route of ECONOMIC_READ_ROUTES) {
      it(`foreign-tenant ADMIN reading ${route.path} is denied with 403`, async () => {
        dbGet.mockResolvedValue(undefined);
        currentActor = FOREIGN_TENANT_ADMIN;
        const res = await request(server)[route.method](route.path);
        expect(res.status).toBe(403);
        expect(res.body?.code).toBe('ORG_MEMBERSHIP_REVOKED');
      });
    }
  });

  describe('negative: revoked ADMIN membership is denied on every economic route', () => {
    for (const route of ECONOMIC_READ_ROUTES) {
      it(`revoked ADMIN reading ${route.path} is denied with 403`, async () => {
        dbGet.mockResolvedValue({ status: 'REVOKED' });
        currentActor = REVOKED_ADMIN;
        const res = await request(server)[route.method](route.path);
        expect(res.status).toBe(403);
        expect(res.body?.code).toBe('ORG_MEMBERSHIP_REVOKED');
      });
    }
  });

  describe('negative: SUPERADMIN without a live membership row is denied on every economic route', () => {
    for (const route of ECONOMIC_READ_ROUTES) {
      it(`SUPERADMIN-without-membership reading ${route.path} is denied with 403`, async () => {
        // requireActiveMembership's own contract — "Role claims, including
        // SUPERADMIN, never bypass it" — must hold even though
        // requireOrgRole's role hierarchy alone WOULD have let a
        // 'superadmin'-canonical role through.
        dbGet.mockResolvedValue(undefined);
        currentActor = SUPERADMIN_NO_MEMBERSHIP;
        const res = await request(server)[route.method](route.path);
        expect(res.status).toBe(403);
        expect(res.body?.code).toBe('ORG_MEMBERSHIP_REVOKED');
      });
    }
  });

  describe('positive control: non-economic routes are unaffected by the new gate', () => {
    it('GET /connection still succeeds for an ordinary MEMBER partner user', async () => {
      dbGet.mockResolvedValue({ status: 'ACTIVE' });
      currentActor = MEMBER;
      const res = await request(server).get('/api/partners/connection');
      expect(res.status).toBe(200);
    });

    it('GET /referral-tools still succeeds for an ordinary MEMBER partner user', async () => {
      dbGet.mockResolvedValue({ status: 'ACTIVE' });
      currentActor = MEMBER;
      const res = await request(server).get('/api/partners/referral-tools');
      expect(res.status).toBe(200);
    });

    it('GET /attributions still succeeds for an ordinary MEMBER partner user', async () => {
      dbGet.mockResolvedValue({ status: 'ACTIVE' });
      currentActor = MEMBER;
      const res = await request(server).get('/api/partners/attributions');
      expect(res.status).toBe(200);
    });

    it('GET /connection also succeeds for a foreign-tenant-shaped MEMBER (no membership row at all)', async () => {
      // Non-economic routes were never gated by requireActiveMembership, so
      // an absent membership row must not affect them — regression guard
      // against accidentally widening the new gate onto this route.
      dbGet.mockResolvedValue(undefined);
      currentActor = MEMBER;
      const res = await request(server).get('/api/partners/connection');
      expect(res.status).toBe(200);
    });
  });
});
