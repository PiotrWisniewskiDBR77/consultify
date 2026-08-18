/**
 * AMD-PRT-ECONOMICS-002 (owner decision 2A) — MOCK-ONLY UNIT SUITE.
 *
 * SCOPE. This file proves the CALL SITE fix in
 * `server/src/routes/auth.routes.ts` (the `/register` handler, around the
 * "GAP-PARTNER-007" block). That call site was the most severe bypass found
 * in the packet: `/api/auth` is mounted unauthenticated (Gateway.ts) and is
 * NOT covered by any `partnerEconomicsPolicy` route rule, so an anonymous
 * signup carrying a partner/promo code could create a commission-bearing
 * `PartnerReferralService.createAttribution(...)` row AND a raw
 * `INSERT INTO organization_discounts (... 'ACTIVE' ...)` row even while the
 * policy (`server/src/services/partnerEconomicsPolicy.ts`,
 * `PARTNER_ECONOMICS_OPERATIONS_ENABLED = false`) says those operations are
 * unavailable. The fix skips that whole block up front when the policy is
 * disabled, before any partner service call or DB write, and leaves ordinary
 * registration untouched.
 *
 * WHAT THIS FILE ACTUALLY PROVES. The full `/register` Express handler is
 * mounted with supertest against a real `express()` app, and every I/O seam
 * it can reach is mocked:
 *   - the persistence seams (`utils/DbPromise.js`, `database/Database.js`)
 *   - every service the handler reaches via dynamic `await import(...)`
 *     (accessPolicyService, emailVerificationService, welcomeEmailService,
 *     slack/slackRouter, partnerReferralService, partnerEmailService,
 *     promoCodeService, attributionService)
 *   - `utils/Logger.js`
 * From this it proves, with real request/response objects and the real
 * `RegisterRequestSchema` validation and JWT signing in the loop:
 *   1. registration with a valid partner code still returns 200 with a
 *      user/org/token payload (positive control — the fix does not break
 *      ordinary registration success);
 *   2. zero calls reach `PartnerReferralService.validateReferralCode` /
 *      `.createAttribution`, and zero calls reach the raw discount seam
 *      (`getDatabase().get` / `.run`, which is the ONLY code path that can
 *      write `organization_discounts` from this handler) — i.e. the
 *      discount + attribution side effects are provably skipped, not just
 *      individually asserted against one table name;
 *   3. a policy refusal is a normal 200, never a 5xx, and the response body
 *      carries no error field — a refusal can never surface as a failed
 *      registration;
 *   4. registration WITHOUT a partner code takes the exact same code path it
 *      took before this change (the `if (effectivePartnerCode)` gate never
 *      opens), proving ordinary registration is untouched.
 *
 * WHAT THIS FILE DOES NOT PROVE, AND MUST NOT BE CITED FOR:
 *   - anything requiring a real database — no schema is applied, no
 *     migration runs, no `organization_discounts` table constraint is
 *     exercised, no FK/UNIQUE violation is possible or ruled out;
 *   - the deep-service guard inside `PartnerReferralService.createAttribution`
 *     itself (owned by a parallel change, S5, to
 *     `server/src/services/partnerReferralService.ts`) — this suite does not
 *     import the real service at all, so it cannot detect a regression THERE;
 *     it only proves this call site never reaches that service;
 *   - the `partnerEconomicsPolicy.ts` predicate/telemetry module in general
 *     (route-rule matching, receipt idempotency, the Express guard
 *     middleware) — that is covered by
 *     `tests/integration/partners/partner-economics-policy-disabled.unit.test.ts`;
 *   - any other `/api/auth/*` route, or any v8/legacy partner economics
 *     router — out of scope for this call site;
 *   - concurrent/racing registrations, rate limiting, or anything about the
 *     real `attribution_events` / `activity_logs` tables (those inserts are
 *     mocked away as an accepted side effect of mounting the whole handler,
 *     not something this suite makes claims about).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

import authRouter from '../../../server/src/routes/auth.routes.ts';

/* ==========================================================================
 * Persistence + service seams. auth.routes.ts reaches every one of these
 * either as a static import or via `await import(...)` inside the handler.
 * Mocking them all is what makes it possible to mount the REAL /register
 * handler (real Zod validation, real bcrypt hash, real jwt.sign) without a
 * database.
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

// The ONLY code path in this handler that can write `organization_discounts`
// is `getDatabase().get(...)` (discount config lookup) then
// `getDatabase().run(INSERT INTO organization_discounts ...)` inside the
// (now policy-skipped) partner-economics block. Zero calls to these two spies
// is therefore direct proof that neither the lookup nor the insert happened.
const pgGet = vi.fn();
const pgRun = vi.fn();

vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({
    get: (...args: unknown[]) => pgGet(...args),
    run: (...args: unknown[]) => pgRun(...args),
  }),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// accessPolicyService.createDefaultLimits pulls in a large limit/trial/usage
// service tree that itself talks to the database in ways this suite does not
// want to model; mocked wholesale so trial-org creation can succeed.
vi.mock('../../../server/src/services/accessPolicyService.js', () => ({
  default: { createDefaultLimits: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../../server/src/services/emailVerificationService.js', () => ({
  default: {
    createVerificationToken: vi.fn().mockResolvedValue('mock-verification-token'),
    sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../server/src/services/welcomeEmailService.js', () => ({
  default: { sendWelcomeEmail: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../../server/src/services/slack/slackRouter.js', () => ({
  routeToSlack: vi.fn().mockResolvedValue(undefined),
  default: { routeToSlack: vi.fn().mockResolvedValue(undefined) },
}));

// The economics-adjacent services. These are the two spies the "zero
// attribution created" assertion is keyed on directly, in addition to the
// db-level pgGet/pgRun spies above.
const validateReferralCode = vi.fn();
const createAttribution = vi.fn();

vi.mock('../../../server/src/services/partnerReferralService.js', () => ({
  default: {
    validateReferralCode: (...args: unknown[]) => validateReferralCode(...args),
    createAttribution: (...args: unknown[]) => createAttribution(...args),
  },
}));

vi.mock('../../../server/src/services/partnerEmailService.js', () => ({
  sendNewReferralNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../server/src/services/promoCodeService.js', () => ({
  default: {
    validatePromoCode: vi.fn(),
    markPromoCodeUsed: vi.fn(),
  },
}));

vi.mock('../../../server/src/services/attributionService.js', () => ({
  default: {
    recordAttribution: vi.fn().mockResolvedValue(undefined),
    SOURCE_TYPES: {
      PROMO_CODE: 'PROMO_CODE',
      SELF_SERVE: 'SELF_SERVE',
      INVITATION: 'INVITATION',
      DEMO: 'DEMO',
    },
  },
}));

describe('AMD-PRT-ECONOMICS-002 (2A) — /api/auth/register call site', () => {
  let app: express.Application;

  const validBody = (overrides: Record<string, unknown> = {}) => ({
    email: `owner-${Math.random().toString(36).slice(2)}@example.com`,
    password: 'a-strong-password-123',
    firstName: 'Ada',
    lastName: 'Lovelace',
    companyName: 'Analytical Engines Ltd',
    ...overrides,
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default persistence behaviour: every INSERT "succeeds", every lookup
    // finds nothing (no existing user, no existing org, no access code row).
    // The handler branches on `.success` for the organizations/users inserts,
    // so this default is what lets registration reach the 200 response at
    // all -- a positive control has to actually complete the write path.
    dbRun.mockImplementation(async () => ({ success: true }));
    dbGet.mockImplementation(async () => undefined);
    dbAll.mockImplementation(async () => []);
    dbExec.mockImplementation(async () => undefined);
    dbTransaction.mockImplementation(async (fn: unknown) =>
      typeof fn === 'function' ? (fn as () => unknown)() : undefined
    );
    pgGet.mockResolvedValue(undefined);
    pgRun.mockResolvedValue({ success: true });

    validateReferralCode.mockResolvedValue({
      valid: true,
      partnerOrgId: 'partner-org-1',
      commissionRate: 15,
    });
    createAttribution.mockResolvedValue({ id: 'attribution-1' });

    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
  });

  it('1. registers successfully with a valid partner code present (positive control)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(validBody({ partner_code: 'PARTNER-ABC' }));

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBeDefined();
    expect(res.body.user.organizationId).toEqual(expect.any(String));
    expect(res.body.token).toEqual(expect.any(String));

    // Proves the write path genuinely ran (not short-circuited before the
    // user/org rows), which is what makes this a positive control rather
    // than an accidental early-return.
    const insertedTables = dbRun.mock.calls.map((call) => String(call[0]));
    expect(insertedTables.some((sql) => sql.includes('INSERT INTO organizations'))).toBe(true);
    expect(insertedTables.some((sql) => sql.includes('INSERT INTO users'))).toBe(true);
  });

  it('2. creates ZERO partner attribution and ZERO organization_discounts row for that same request', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(validBody({ partner_code: 'PARTNER-ABC' }));

    expect(res.status).toBe(200);

    // The commission-bearing attribution call.
    expect(validateReferralCode).not.toHaveBeenCalled();
    expect(createAttribution).not.toHaveBeenCalled();

    // The only seam that can reach `organization_discounts` (discount-config
    // SELECT via pgGet, INSERT via pgRun) was never touched.
    expect(pgGet).not.toHaveBeenCalled();
    expect(pgRun).not.toHaveBeenCalled();

    // Belt-and-braces: no call on the primary DbPromise seam ever mentions
    // the table either (defends against a future change routing the insert
    // through DbPromise instead of the raw db handle).
    const allSql = [...dbRun.mock.calls, ...dbGet.mock.calls, ...dbExec.mock.calls].map((call) =>
      String(call[0])
    );
    expect(allSql.some((sql) => sql.includes('organization_discounts'))).toBe(false);
  });

  it('3. a policy refusal never surfaces as a 5xx or a failed registration', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(validBody({ partner_code: 'PARTNER-ABC' }));

    expect(res.status).toBeLessThan(500);
    expect(res.status).toBe(200);
    expect(res.body.error).toBeUndefined();
    // The success envelope is the same shape ordinary registration returns --
    // no `policyUnavailable` / refusal projection leaks into a 200 response.
    expect(res.body.policyUnavailable).toBeUndefined();
  });

  it('4. ordinary registration WITHOUT any partner code is completely unaffected', async () => {
    const res = await request(app).post('/api/auth/register').send(validBody());

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.token).toEqual(expect.any(String));

    // No partner code means the `if (effectivePartnerCode)` gate this fix
    // sits in front of never opens at all -- same as before this change.
    expect(validateReferralCode).not.toHaveBeenCalled();
    expect(createAttribution).not.toHaveBeenCalled();
    expect(pgGet).not.toHaveBeenCalled();
    expect(pgRun).not.toHaveBeenCalled();
  });
});
