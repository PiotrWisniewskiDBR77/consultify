/**
 * AMD-PRT-ECONOMICS-002 (owner decision 2A) — MOCK-ONLY UNIT SUITE.
 *
 * WHAT THIS FILE PROVES. Two things, both by mounting the REAL router
 * modules with `supertest` against a real in-process Express app — not a
 * reimplementation of their logic:
 *
 * 1. `server/src/routes/webhooks/stripe.routes.ts`, `invoice.paid` ->
 *    `handleInvoicePaid()`. The partner-commission block now starts with
 *    `assertPartnerEconomicsOperationAllowed('commission')` as its first
 *    statement (before `PartnerReferralService.getAttributionByOrganization`,
 *    before `PartnerReferralService.updateAttributionStatus`, before the raw
 *    `UPDATE partner_attributions SET first_payment_at = ...`, and before
 *    `PartnerCommissionService.createCommission`). The real
 *    `partnerEconomicsPolicy.ts` module is NOT mocked here — the guard that
 *    runs is the production predicate, currently hard-set to `disabled`. The
 *    tests prove: (a) none of those four calls/writes ever happen, (b) the
 *    webhook still responds 200 `{received:true}` — the existing
 *    `catch (partnerError) { log only }` swallows the policy refusal exactly
 *    like any other partner-tracking error, so Stripe never sees a failure
 *    and never goes into retry, and (c) ordinary invoice bookkeeping
 *    (billingService.recordInvoice, the notification path) is unaffected —
 *    the guard only removes the partner-economics block, nothing else in the
 *    handler.
 *
 * 2. `server/src/routes/organization/partner-code.routes.ts`. This router is
 *    current dead code (see the S7 handoff report / commit message for the
 *    import-chain evidence: `routes/organization/index.ts` mounts it, but
 *    that barrel is only re-exported by `routes/index.ts`, and nothing
 *    reachable from `Gateway.ts` or `src/index.ts` imports `routes/index.ts`
 *    or `routes/organization/index.ts` — `Gateway.ts` imports each
 *    `organization/*.routes.ts` file directly instead). Because it is dead,
 *    it cannot be reached through the real HTTP surface today, so this file
 *    mounts the router directly (bypassing the two absent barrels) to prove
 *    that IF it were ever remounted with one `app.use(...)` line, its two
 *    writer handlers (`POST /partner-code` -> `createAttribution` + the
 *    `INSERT INTO organization_discounts`; `DELETE /partner-code` ->
 *    `updateAttributionStatus` + the `UPDATE organization_discounts SET
 *    status='CANCELLED'`) refuse immediately with the policy error and touch
 *    neither the partner-referral service nor the database.
 *
 * WHAT THIS FILE DOES NOT PROVE, AND MUST NOT BE CITED FOR:
 * - No real database. `DbPromise`, `database/Database.js` and
 *   `services/BillingService.js` are mocked; nothing here proves schema
 *   correctness, transaction behavior, or that the mocked SQL text matches
 *   what a live Postgres/SQLite instance would accept.
 * - No Stripe signature verification is exercised. `shouldVerifySignature`
 *   in `stripe.routes.ts` is `false` whenever `process.env.VITEST === 'true'`
 *   (true for this whole run), so the webhook route parses the raw JSON body
 *   directly instead of calling `stripe.webhooks.constructEvent`. Signature
 *   verification itself is untested here (and always has been, by design, in
 *   the test environment).
 * - `PartnerReferralService.getAttributionByOrganization` /
 *   `updateAttributionStatus`, and `PartnerCommissionService.createCommission`
 *   are themselves ALSO independently guarded at their own top (owned by a
 *   parallel change, not this file) — see
 *   `partner-economics-policy-disabled.unit.test.ts` for direct proof of
 *   that layer. This file proves the stripe.routes.ts call site never even
 *   reaches them, which is a stronger, independent statement, but it is not
 *   a substitute for that other suite.
 * - `partner-code.routes.ts` `GET /partner-attribution` (a read) is
 *   deliberately left unguarded by the production edit and is not exercised
 *   here — the owner decision requires historical reads to stay available;
 *   only the two writers are in scope.
 * - Dunning-service and billingService.upsertOrganizationBilling paths are
 *   deliberately routed around in the webhook tests below by mocking the
 *   organization as `is_manual_override` (see `getManualOverrideState` in
 *   the route source) — this keeps the mock surface honest and small. It
 *   means the interaction between the partner-economics guard and the
 *   non-manual-override dunning branch is NOT separately exercised here;
 *   nothing in that branch touches partner economics, so it is out of scope
 *   for this packet, not merely skipped for convenience.
 */

import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* ==========================================================================
 * Persistence + service spies, shared by both suites below. Every writer
 * this packet touches reaches the database or a partner service through one
 * of these seams; a regression shows up as a nonzero call count.
 * ========================================================================== */

const dbRun = vi.fn();
const dbGet = vi.fn();
const dbAll = vi.fn();

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => dbRun(...args),
  get: (...args: unknown[]) => dbGet(...args),
  all: (...args: unknown[]) => dbAll(...args),
}));

const dbInstanceQuery = vi.fn();
vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({ query: (...a: unknown[]) => dbInstanceQuery(...a) }),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const getAttributionByOrganization = vi.fn();
const updateAttributionStatus = vi.fn();
const createAttribution = vi.fn();
const validateReferralCode = vi.fn();

vi.mock('../../../server/src/services/partnerReferralService.js', () => ({
  getAttributionByOrganization: (...args: unknown[]) => getAttributionByOrganization(...args),
  updateAttributionStatus: (...args: unknown[]) => updateAttributionStatus(...args),
  createAttribution: (...args: unknown[]) => createAttribution(...args),
  validateReferralCode: (...args: unknown[]) => validateReferralCode(...args),
}));

const createCommission = vi.fn();
vi.mock('../../../server/src/services/partnerCommissionService.js', () => ({
  createCommission: (...args: unknown[]) => createCommission(...args),
}));

const recordInvoice = vi.fn();
const upsertOrganizationBilling = vi.fn();
vi.mock('../../../server/src/services/BillingService.js', () => ({
  default: {
    recordInvoice: (...args: unknown[]) => recordInvoice(...args),
    upsertOrganizationBilling: (...args: unknown[]) => upsertOrganizationBilling(...args),
  },
}));

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', organization_id: 'org-referred-1' };
    next();
  },
}));

const partnerAttributionsWrites = () =>
  dbRun.mock.calls.filter(([sql]) => /partner_attributions/i.test(String(sql)));
const organizationDiscountsWrites = () =>
  dbRun.mock.calls.filter(([sql]) => /organization_discounts/i.test(String(sql)));

beforeEach(() => {
  vi.clearAllMocks();
});

/* ==========================================================================
 * Suite 1 — stripe.routes.ts invoice.paid
 * ========================================================================== */

async function loadStripeWebhookRouter() {
  const mod = await import('../../../server/src/routes/webhooks/stripe.routes.ts');
  return mod.default;
}

function makeStripeWebhookApp(router: express.Router) {
  const app = express();
  // No global body parser: the router applies its own `express.raw(...)`
  // on the specific route, matching production wiring exactly.
  app.use('/webhooks', router);
  return app;
}

function invoicePaidEvent(opts: { orgCustomerId: string; eventId: string }) {
  return {
    id: opts.eventId,
    type: 'invoice.paid',
    data: {
      object: {
        id: 'in_test_1',
        customer: opts.orgCustomerId,
        amount_paid: 10000,
        currency: 'usd',
        billing_reason: 'subscription_create',
        period_start: 1700000000,
        period_end: 1702592000,
        payment_intent: 'pi_test_1',
      },
    },
  };
}

/** Wires the generic DbPromise mocks for one invoice.paid pass. */
function wireInvoicePaidDb(opts: { customerId: string; organizationId: string }) {
  dbGet.mockImplementation(async (sql: string) => {
    const s = String(sql);
    if (/FROM stripe_events WHERE event_id/i.test(s)) return null; // not a dup
    if (/FROM organization_billing WHERE stripe_customer_id/i.test(s)) {
      return { organization_id: opts.organizationId };
    }
    if (/billing_rail, contract_status, is_manual_override/i.test(s)) {
      // is_manual_override:true short-circuits billingService.upsertOrganizationBilling
      // AND the dunning-service import branch, keeping this suite's mock
      // surface to exactly what the partner-economics guard touches.
      return { billing_rail: 'manual_invoice', contract_status: 'ACTIVE', is_manual_override: 1 };
    }
    return null;
  });
  dbAll.mockResolvedValue([]); // createNotification: no admin users -> no INSERT
  dbRun.mockResolvedValue({ success: true, changes: 1 });
}

describe('AMD-PRT-ECONOMICS-002 — stripe webhook invoice.paid (mounted router)', () => {
  it('performs ZERO partner-economics writes for a referred org (attribution activation, first_payment_at, commission row)', async () => {
    wireInvoicePaidDb({ customerId: 'cus_referred_1', organizationId: 'org-referred-1' });

    const router = await loadStripeWebhookRouter();
    const app = makeStripeWebhookApp(router);
    const event = invoicePaidEvent({ orgCustomerId: 'cus_referred_1', eventId: 'evt_referred_1' });

    const res = await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(event));

    expect(res.status).toBe(200);

    // The guard fires before the attribution is even looked up.
    expect(getAttributionByOrganization).not.toHaveBeenCalled();
    expect(updateAttributionStatus).not.toHaveBeenCalled();
    expect(createCommission).not.toHaveBeenCalled();
    expect(partnerAttributionsWrites()).toEqual([]);
  });

  it('still resolves successfully and does not throw (Stripe-retry regression guard)', async () => {
    wireInvoicePaidDb({ customerId: 'cus_referred_2', organizationId: 'org-referred-2' });

    const router = await loadStripeWebhookRouter();
    const app = makeStripeWebhookApp(router);
    const event = invoicePaidEvent({ orgCustomerId: 'cus_referred_2', eventId: 'evt_referred_2' });

    const res = await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(event));

    // Preserved semantics: the existing `catch (partnerError) { log only }`
    // swallows the policy refusal exactly like it swallows any other
    // partner-tracking error, so this MUST be a 200 with `received:true`,
    // never a 4xx/5xx that would drive Stripe into retrying forever.
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  it('leaves non-partner invoice.paid handling unaffected (positive control)', async () => {
    wireInvoicePaidDb({ customerId: 'cus_no_partner_1', organizationId: 'org-no-partner-1' });

    const router = await loadStripeWebhookRouter();
    const app = makeStripeWebhookApp(router);
    const event = invoicePaidEvent({
      orgCustomerId: 'cus_no_partner_1',
      eventId: 'evt_no_partner_1',
    });

    const res = await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(event));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    // Ordinary invoice bookkeeping still runs — the guard only removed the
    // partner-economics block, nothing else in the handler.
    expect(recordInvoice).toHaveBeenCalledWith(
      'org-no-partner-1',
      expect.objectContaining({ id: 'in_test_1' })
    );
    // And the (never-reachable-anyway, since this org has no attribution)
    // partner path still made zero calls, same as the referred-org case.
    expect(getAttributionByOrganization).not.toHaveBeenCalled();
    expect(createCommission).not.toHaveBeenCalled();
  });
});

/* ==========================================================================
 * Suite 2 — organization/partner-code.routes.ts, mounted directly
 * (the router itself is dead code today — see file header).
 * ========================================================================== */

async function loadPartnerCodeRouter() {
  const mod = await import(
    '../../../server/src/routes/organization/partner-code.routes.ts'
  );
  return mod.default;
}

function makePartnerCodeApp(router: express.Router) {
  const app = express();
  app.use(express.json());
  app.use('/api/organization', router);
  return app;
}

describe('AMD-PRT-ECONOMICS-002 — organization/partner-code.routes.ts, fail-closed if remounted', () => {
  it('POST /partner-code refuses with the policy error and writes nothing', async () => {
    dbGet.mockResolvedValue(null);
    dbRun.mockResolvedValue({ success: true, changes: 1 });

    const router = await loadPartnerCodeRouter();
    const app = makePartnerCodeApp(router);

    const res = await request(app)
      .post('/api/organization/partner-code')
      .send({ partnerCode: 'PROMO123' });

    expect(res.status).toBe(410);
    expect(res.body).toMatchObject({
      success: false,
      code: 'PARTNER_ECONOMICS_POLICY_DISABLED',
    });
    expect(res.body.error).toContain('AMD-PRT-ECONOMICS-002');

    expect(createAttribution).not.toHaveBeenCalled();
    expect(validateReferralCode).not.toHaveBeenCalled();
    expect(organizationDiscountsWrites()).toEqual([]);
    expect(dbInstanceQuery).not.toHaveBeenCalled();
  });

  it('DELETE /partner-code refuses with the policy error and writes nothing', async () => {
    dbGet.mockResolvedValue(null);
    dbRun.mockResolvedValue({ success: true, changes: 1 });

    const router = await loadPartnerCodeRouter();
    const app = makePartnerCodeApp(router);

    const res = await request(app).delete('/api/organization/partner-code');

    expect(res.status).toBe(410);
    expect(res.body).toMatchObject({
      success: false,
      code: 'PARTNER_ECONOMICS_POLICY_DISABLED',
    });
    expect(res.body.error).toContain('AMD-PRT-ECONOMICS-002');

    expect(getAttributionByOrganization).not.toHaveBeenCalled();
    expect(updateAttributionStatus).not.toHaveBeenCalled();
    expect(organizationDiscountsWrites()).toEqual([]);
    expect(dbInstanceQuery).not.toHaveBeenCalled();
  });
});
