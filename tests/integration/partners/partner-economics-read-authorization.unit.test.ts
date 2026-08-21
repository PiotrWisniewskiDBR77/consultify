/**
 * AMD-PRT-ECONOMICS-002 (owner decision 2A) — MOCK-ONLY UNIT SUITE.
 *
 * TRUTHFUL SCOPE, stated first per the pattern of the sibling suites in this
 * directory (see `partner-economics-policy-disabled.unit.test.ts`'s own
 * header). This file proves the READ-SIDE authorization gap closed on
 * `server/src/routes/v8/partner.routes.ts` by worker S8: before this change
 * the six economic read routes (`GET /program/status`, `GET /program/ledger`,
 * `GET /earnings-summary`, `GET /commission-transactions`, `GET /payouts`,
 * `GET /payout-settings`) had NO role check at all — any authenticated
 * partner-portal user could read full commission/payout history — and the
 * already-imported `partnerEconomicsPolicyProjection` was never attached to
 * any response body.
 *
 * WHAT THIS FILE ACTUALLY PROVES. The REAL `partner.routes.ts` router (no
 * reimplementation, no route interception) is mounted with `supertest`
 * against a real in-process `express()` app. A synthetic auth-simulation
 * middleware stands in for the real `verifyToken` + `attachV8Context` chain
 * (which normally runs in `server/src/routes/v8/index.ts`, upstream of this
 * router, and is therefore intentionally out of scope for a file that owns
 * only `partner.routes.ts`): it sets `req.userId`, `req.user`, `req.userRole`,
 * `req.organizationId` and `req.v8Context` directly, from fixed per-test
 * fixture values — never from a request header or body — modelling "role is
 * server-derived" the same way `verifyToken` resolves it from a live
 * `organization_members` row before a request ever reaches this router.
 * Every service the router imports (`PartnerProgramLedgerService`,
 * `PartnerCommissionService`, `PartnerReferralService`,
 * `partnerPayoutSettingsService`, `partnerOrgResolution`,
 * `partnerDemoSeedService`, `legalService`, `ensureUserOnboardingStatusTable`)
 * and the shared persistence seam (`utils/DbPromise.js`,
 * `database/Database.js`, `utils/Logger.js`) are mocked. The REAL
 * `partnerEconomicsPolicy.ts` (write-refusal guard + projection),
 * `middleware/rbac.middleware.ts` (`requireOrgRole`) and
 * `services/legacyCutover/requireActiveMembership.ts` are NOT mocked — those
 * three modules are exactly what this suite is verifying.
 *
 * From this it proves:
 *   1. OWNER and ADMIN reach the handler (200) on each of the six economic
 *      read routes.
 *   2. MEMBER, a caller whose real membership is for a different
 *      organization ("foreign tenant"), a REVOKED membership, and a
 *      SUPERADMIN role claim with no live membership row are all denied
 *      (403) on each of the six routes.
 *   3. Every one of the six routes' 200 response carries
 *      `meta.policyUnavailable` (the `partnerEconomicsPolicyProjection()`
 *      shape) on a successful OWNER/ADMIN read.
 *   4. The non-economic routes (`GET /clients` as the representative case)
 *      still succeed for an ordinary MEMBER partner user — proving the gate
 *      is scoped to exactly the six economic reads, not a blanket lockdown.
 *   5. `PUT /payout-settings` (an economic MUTATION) still returns 410 with
 *      the policy-guard's own code, even for a MEMBER who would otherwise
 *      get a role-based 403 — proving `createPartnerEconomicsPolicyGuard`
 *      (mounted first, unmoved by this change) still runs before any
 *      role check, and a policy refusal is never converted into a role
 *      error.
 *
 * WHAT THIS FILE DOES NOT PROVE, AND MUST NOT BE CITED FOR:
 *   - anything requiring a real database — no schema is applied, no
 *     `organization_members` row is ever actually queried; "ACTIVE" /
 *     "REVOKED" / "absent" membership states are simulated entirely through
 *     the mocked `DbPromise.get` return value, not through real SQL or a
 *     real unique-constraint/FK-backed table;
 *   - the real `verifyToken` middleware or the real `attachV8Context`
 *     middleware — both are files this worker does not own, and both are
 *     replaced here by the synthetic auth-simulation middleware described
 *     above. This suite cannot detect a regression in how THOSE modules
 *     resolve `req.userRole` / `req.v8Context` from a real JWT + DB row; it
 *     only proves that GIVEN a resolved role/tenant context, this router's
 *     own gate (`requireActiveMembership` + `requireOrgRole('admin')`)
 *     enforces it correctly;
 *   - `getActivePartnerOrgIdForUser`'s own logic (self-heal fallbacks,
 *     partner_users role column) — that service is mocked wholesale here;
 *   - concurrency, rate limiting, or anything about the real
 *     `partner_economics_policy_events` telemetry table (the 410 case below
 *     asserts the HTTP response only, not the telemetry row).
 *
 * CASES THAT COULD NOT BE HONESTLY EXPRESSED WITH MOCKS ALONE (reported
 * rather than faked): a genuinely distinct "foreign tenant" scenario would
 * ideally use a DIFFERENT `req.v8Context.organizationId` than the one the
 * mocked membership row belongs to. Because `requireActiveMembership` reads
 * `req.v8Context.organizationId` itself (not a caller-supplied org id) and
 * this suite mocks its only I/O call (`DbPromise.get`) directly, "foreign
 * tenant" and "no matching active row at all" collapse into the same
 * observable mock behaviour (`DbPromise.get` resolves to `undefined`). Both
 * are still exercised as separate, explicitly named tests below for
 * documentation and regression-tracking purposes, but a reviewer should not
 * read them as proof of two different SQL query results — only of the same
 * "membership row not found for this actor+tenant" code path, entered with a
 * different fixture role each time.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import type { Server } from 'http';

/* ==========================================================================
 * Persistence + shared-utility seams. `partner.routes.ts`,
 * `requireActiveMembership.ts` and `partnerEconomicsPolicy.ts` all reach the
 * database through exactly these two modules.
 * ========================================================================== */

const dbRun = vi.fn();
const dbGet = vi.fn();
const dbAll = vi.fn();
const dbExec = vi.fn();
const dbTransaction = vi.fn();

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => dbRun(...args),
  get: (...args: unknown[]) => dbGet(...args),
  all: (...args: unknown[]) => dbAll(...args),
  exec: (...args: unknown[]) => dbExec(...args),
  transaction: (...args: unknown[]) => dbTransaction(...args),
}));

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({
    get: vi.fn(),
    run: vi.fn(),
    all: vi.fn(),
  }),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/* ==========================================================================
 * Service seams `partner.routes.ts` imports directly. Mocked wholesale so
 * every economic-read handler resolves without touching a database.
 * ========================================================================== */

const getActivePartnerOrgIdForTenantUser = vi.fn();
vi.mock('../../../server/src/services/partnerOrgResolution.js', () => ({
  getActivePartnerOrgIdForTenantUser: (...args: unknown[]) =>
    getActivePartnerOrgIdForTenantUser(...args),
}));

vi.mock('../../../server/src/services/legalService.js', () => ({
  default: { acceptDocuments: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../../server/src/utils/ensureUserOnboardingStatusTable.js', () => ({
  ensureUserOnboardingStatusTable: vi.fn().mockResolvedValue(undefined),
}));

const getProgramStatusDetail = vi.fn();
const listEntries = vi.fn();
const transitionLifecycle = vi.fn();
vi.mock('../../../server/src/services/partnerProgramLedgerService.js', () => ({
  default: {
    getProgramStatusDetail: (...args: unknown[]) => getProgramStatusDetail(...args),
    listEntries: (...args: unknown[]) => listEntries(...args),
    transitionLifecycle: (...args: unknown[]) => transitionLifecycle(...args),
  },
}));

const getEarningsSummary = vi.fn();
const getPayoutEligibility = vi.fn();
const getCommissions = vi.fn();
const getPayouts = vi.fn();
const requestPayout = vi.fn();
vi.mock('../../../server/src/services/partnerCommissionService.js', () => ({
  default: {
    getEarningsSummary: (...args: unknown[]) => getEarningsSummary(...args),
    getPayoutEligibility: (...args: unknown[]) => getPayoutEligibility(...args),
    getCommissions: (...args: unknown[]) => getCommissions(...args),
    getPayouts: (...args: unknown[]) => getPayouts(...args),
    requestPayout: (...args: unknown[]) => requestPayout(...args),
  },
}));

const getPartnerClients = vi.fn();
vi.mock('../../../server/src/services/partnerReferralService.js', () => ({
  default: {
    getPartnerClients: (...args: unknown[]) => getPartnerClients(...args),
    getPartnerProjects: vi.fn(),
    getPartnerEmployees: vi.fn(),
    getReferralTools: vi.fn(),
    getReferralAnalytics: vi.fn(),
    getPartnerAttributions: vi.fn(),
    createCampaignLink: vi.fn(),
    deleteCampaignLink: vi.fn(),
    ensurePartnerReferralIdentity: vi.fn(),
  },
}));

const getPartnerPayoutSettings = vi.fn();
const isPartnerPayoutDestinationComplete = vi.fn();
const updatePartnerPayoutSettings = vi.fn();
vi.mock('../../../server/src/services/partnerPayoutSettingsService.js', () => ({
  getPartnerPayoutSettings: (...args: unknown[]) => getPartnerPayoutSettings(...args),
  isPartnerPayoutDestinationComplete: (...args: unknown[]) =>
    isPartnerPayoutDestinationComplete(...args),
  updatePartnerPayoutSettings: (...args: unknown[]) => updatePartnerPayoutSettings(...args),
}));

/* ==========================================================================
 * Real modules under test — deliberately NOT mocked:
 *   - server/src/services/partnerEconomicsPolicy.ts (write guard + projection)
 *   - server/src/middleware/rbac.middleware.ts (requireOrgRole)
 *   - server/src/services/legacyCutover/requireActiveMembership.ts
 *   - server/src/routes/v8/partner.routes.ts (the file under test)
 * ========================================================================== */

import partnerRoutes from '../../../server/src/routes/v8/partner.routes.js';
import { PARTNER_ECONOMICS_POLICY_CODE } from '../../../server/src/services/partnerEconomicsPolicy.js';

/* ==========================================================================
 * Test app. A synthetic middleware stands in for the real verifyToken +
 * attachV8Context chain (owned by other files / mounted upstream in
 * server/src/routes/v8/index.ts) and sets the request identity fields this
 * router and its new gate consume — always from a fixed fixture, never from
 * a header or body the "client" controls.
 * ========================================================================== */

interface Actor {
  userId: string;
  organizationId: string;
  userRole: string; // e.g. 'OWNER' | 'ADMIN' | 'MEMBER' | 'SUPERADMIN'
}

/*
 * ACTOR IS READ PER-REQUEST, NOT BAKED INTO THE APP AT CONSTRUCTION TIME.
 *
 * The suite below has 46 assertions across ~40 `request(...)` calls. The
 * original version of this file called `buildApp(actor)` fresh for every
 * single one of those calls; each fresh, not-yet-listening Express app
 * handed to `supertest.request()` makes supertest open its own ephemeral
 * `app.listen(0)` server and close it again at the end of that one request
 * (see `node_modules/supertest/lib/test.js`: `serverAddress()` calls
 * `app.listen(0)` whenever `app.address()` is falsy, and `.end()` closes
 * that server once the response lands). That is ~40 bind+close cycles for
 * this file alone, on top of a similar count from each of the four sibling
 * economics suites that run in the same combined command — all of it
 * executing inside ONE Node process, because `--no-file-parallelism` still
 * lets Vitest's `forks` pool reuse a single worker process across
 * sequentially-run files (only the per-file module registry is reset, not
 * the OS process or its open sockets/ports).
 *
 * Under host CPU contention (this run reproduced at ~13%, 2/15, with the
 * combined 5-file command; the same file alone was clean on 3/3 runs) that
 * much rapid ephemeral-port churn is exactly the shape of thing that trips
 * `ECONNRESET`/"socket hang up" on an in-flight request from a completely
 * unrelated test — the failure was NOT confined to this file's own tests
 * (it also hit `partner-registration-economics-denied.unit.test.ts`, a
 * file this suite does not own), consistent with shared-process socket
 * pressure rather than a bug in any one file's assertions.
 *
 * The fix that is actually within this file's control: stop being a
 * contributor to that churn. Build ONE Express app and ONE already-listening
 * `http.Server` for the whole file (`beforeAll`/`afterAll` below), and read
 * the current test's actor from a per-request-time variable instead of a
 * per-app-construction closure. `supertest`'s `serverAddress()` only calls
 * `app.listen(0)` when the passed object has no address yet — passing the
 * same already-listening `server` to every `request(server)` call skips
 * that path entirely, so this file now performs exactly ONE bind and ONE
 * close for its whole 46-assertion run instead of ~40. Tests in this file
 * run strictly sequentially (no `it.concurrent`), so mutating `currentActor`
 * immediately before each `await request(...)` call is race-free — the
 * middleware below reads it synchronously on the very next request cycle
 * before the next test could reassign it.
 */
let currentActor: Actor | null = null;

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    const actor = currentActor;
    if (!actor) {
      next(new Error('test bug: currentActor not set before request'));
      return;
    }
    req.userId = actor.userId;
    req.organizationId = actor.organizationId;
    req.requestedOrganizationId = actor.organizationId;
    req.userRole = actor.userRole;
    req.user = { id: actor.userId, organizationId: actor.organizationId, role: actor.userRole };
    // Mirrors attachV8Context's output shape (server/src/middleware/v8Auth.middleware.ts),
    // which getV8Context() and requireActiveMembership() both read.
    req.v8Context = {
      organizationId: actor.organizationId,
      userId: actor.userId,
      userRole: actor.userRole,
    };
    next();
  });
  app.use('/api/v8/partner', partnerRoutes);
  // Minimal JSON error handler so an unmocked throw surfaces as JSON, not HTML.
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
// "Foreign tenant": the actor's JWT/session claims ADMIN, but the live
// membership row (mocked below) does not exist for (userId, organizationId) —
// modelling a caller whose real membership belongs to a different org.
const FOREIGN_TENANT_ADMIN: Actor = { userId: USER_ID, organizationId: TENANT_ORG, userRole: 'ADMIN' };
const REVOKED_ADMIN: Actor = { userId: USER_ID, organizationId: TENANT_ORG, userRole: 'ADMIN' };

const ECONOMIC_READ_ROUTES: Array<{ method: 'get'; path: string }> = [
  { method: 'get', path: '/api/v8/partner/program/status' },
  { method: 'get', path: '/api/v8/partner/program/ledger' },
  { method: 'get', path: '/api/v8/partner/earnings-summary' },
  { method: 'get', path: '/api/v8/partner/commission-transactions' },
  { method: 'get', path: '/api/v8/partner/payouts' },
  { method: 'get', path: '/api/v8/partner/payout-settings' },
];

function fakeProgramDetail() {
  return {
    runtime: { lifecycle_phase: 'earn', partner_status: 'active', onboard_checklist_json: '{}' },
    balances: { grossEarned: 0, paidOut: 0, availableToPayout: 0, currency: 'EUR' },
    whatNext: [],
    hold: null,
    degraded: undefined,
  };
}

function mockAllEconomicReadsSucceed() {
  getActivePartnerOrgIdForTenantUser.mockResolvedValue(PARTNER_ORG_ID);
  getProgramStatusDetail.mockResolvedValue(fakeProgramDetail());
  listEntries.mockResolvedValue([]);
  getPartnerPayoutSettings.mockResolvedValue({});
  isPartnerPayoutDestinationComplete.mockReturnValue(true);
  getEarningsSummary.mockResolvedValue({
    totalPending: 0,
    totalApproved: 0,
    thisMonth: 0,
    thisMonthCount: 0,
    lastMonth: 0,
    currency: 'EUR',
  });
  getPayoutEligibility.mockResolvedValue({ eligible: false });
  getCommissions.mockResolvedValue([]);
  getPayouts.mockResolvedValue([]);
  getPartnerClients.mockResolvedValue([]);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAllEconomicReadsSucceed();
});

describe('AMD-PRT-ECONOMICS-002 — economic read authorization (v8 partner router)', () => {
  describe('positive: OWNER and ADMIN can read each economic route', () => {
    for (const actorName of ['OWNER', 'ADMIN'] as const) {
      const actor = actorName === 'OWNER' ? OWNER : ADMIN;
      // ACTIVE membership row for this actor's own tenant.
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
        // No membership row for (userId, this organizationId) — the actor's
        // real membership is for a different tenant. requireActiveMembership
        // must deny before the role check is ever reached.
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
        // No membership row at all. requireActiveMembership's own contract —
        // "Role claims, including SUPERADMIN, never bypass it" — must hold
        // even though requireOrgRole's role hierarchy alone WOULD have let a
        // 'superadmin'-canonical role through.
        dbGet.mockResolvedValue(undefined);
        currentActor = SUPERADMIN_NO_MEMBERSHIP;
        const res = await request(server)[route.method](route.path);
        expect(res.status).toBe(403);
        expect(res.body?.code).toBe('ORG_MEMBERSHIP_REVOKED');
      });
    }
  });

  describe('every economic read response carries policyUnavailable', () => {
    for (const route of ECONOMIC_READ_ROUTES) {
      it(`${route.path} response includes meta.policyUnavailable`, async () => {
        dbGet.mockResolvedValue({ status: 'ACTIVE' });
        currentActor = OWNER;
        const res = await request(server)[route.method](route.path);
        expect(res.status).toBe(200);
        expect(res.body?.meta?.policyUnavailable).toBeDefined();
        expect(res.body.meta.policyUnavailable).toMatchObject({
          decision: 'AMD-PRT-ECONOMICS-002',
          code: PARTNER_ECONOMICS_POLICY_CODE,
          historicalReadOnly: true,
        });
        expect(Array.isArray(res.body.meta.policyUnavailable.operations)).toBe(true);
      });
    }
  });

  describe('positive control: non-economic routes are unaffected by the new gate', () => {
    it('GET /clients still succeeds for an ordinary MEMBER partner user', async () => {
      dbGet.mockResolvedValue({ status: 'ACTIVE' });
      currentActor = MEMBER;
      const res = await request(server).get('/api/v8/partner/clients');
      expect(res.status).toBe(200);
      expect(getPartnerClients).toHaveBeenCalled();
    });

    it('GET /clients denies a foreign-tenant-shaped MEMBER with no matching membership row', async () => {
      dbGet.mockResolvedValue(undefined);
      currentActor = MEMBER;
      const res = await request(server).get('/api/v8/partner/clients');
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ORG_MEMBERSHIP_REVOKED');
      expect(getPartnerClients).not.toHaveBeenCalled();
    });
  });

  describe('the economics policy guard still runs first: mutation refusal is never converted into a role error', () => {
    it('PUT /payout-settings still returns 410 PARTNER_ECONOMICS_POLICY_DISABLED for a MEMBER', async () => {
      // A MEMBER would get 403 RBAC_INSUFFICIENT_ROLE on the READ routes.
      // The mutation route carries no read-gate at all, and the top-level
      // createPartnerEconomicsPolicyGuard (router.use, unmoved by this
      // change) must still refuse it with 410 before any role logic runs.
      dbGet.mockResolvedValue({ status: 'ACTIVE' });
      currentActor = MEMBER;
      const res = await request(server)
        .put('/api/v8/partner/payout-settings')
        .send({ method: 'BANK_TRANSFER' });
      expect(res.status).toBe(410);
      expect(res.body?.code).toBe(PARTNER_ECONOMICS_POLICY_CODE);
      expect(res.body?.code).not.toBe('RBAC_INSUFFICIENT_ROLE');
      expect(updatePartnerPayoutSettings).not.toHaveBeenCalled();
    });

    it('PUT /payout-settings still returns 410 for an OWNER too (guard applies regardless of role)', async () => {
      dbGet.mockResolvedValue({ status: 'ACTIVE' });
      currentActor = OWNER;
      const res = await request(server)
        .put('/api/v8/partner/payout-settings')
        .send({ method: 'BANK_TRANSFER' });
      expect(res.status).toBe(410);
      expect(res.body?.code).toBe(PARTNER_ECONOMICS_POLICY_CODE);
      expect(updatePartnerPayoutSettings).not.toHaveBeenCalled();
    });
  });
});
