import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../server/src/Gateway.js';
import { assertDay42Preconditions, restoreDay42FixtureColumns } from './day42SchemaResilience.js';

const DATABASE_URL = String(process.env.DATABASE_URL || '');
// Z31 detektor 2026-08-31: unpinned from a hardcoded '/cx_day42' database-name
// substring, which silently skipped this security suite (exit 0) on any other
// disposable database name. assertDay42Preconditions() below still refuses
// LOUD (throws DAY42_PRECONDITION_SCHEMA_DAMAGED) if a destructive sibling in
// this directory dropped the required fixture tables, so the directory-wide
// hazard this pin was guarding against is still caught -- just not silently.
const RUN =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');
const describeReal = RUN ? describe : describe.skip;
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-min-32-chars-long-for-validation';

/**
 * Day 42 FIX-1 — this suite must never be retried.
 *
 * `vitest.config.ts` sets `retry: process.env.CI ? 3 : 1` globally. A security
 * suite that retries heals itself with the effect of the attack it is supposed
 * to detect: the first attempt performs the real cross-tenant DELETE, the retry
 * then observes a 404 and an unchanged readback, and the file reports 8/8 PASS
 * while a live IDOR is present. Proven mutationally by removing
 * `AND partner_org_id = ?` from `deleteCampaignLink`
 * (server/src/services/partnerReferralService.ts:832).
 *
 * Vitest suite options win over the config value
 * (@vitest/runner: `retry: options.retry ?? runner.config.retry`, and suite
 * options are merged into every test in the suite), so this pin is local to
 * this file and does not touch the global configuration.
 */
const NO_RETRY = { retry: 0 } as const;

describeReal('Day 42 Partner tenant isolation through the real ApiGateway', NO_RETRY, () => {
  let sql: Client;
  let app: Express;

  /**
   * FIX-7: this file flips a PROCESS-WIDE env flag, and the original teardown
   * left `ENABLE_V8_GLOBAL='true'` behind for every file that ran afterwards in
   * the same worker. Capture the entry value and put it back exactly, including
   * the "was not set at all" case.
   */
  const originalEnableV8Global = process.env.ENABLE_V8_GLOBAL;
  const restoreEnableV8Global = () => {
    if (originalEnableV8Global === undefined) delete process.env.ENABLE_V8_GLOBAL;
    else process.env.ENABLE_V8_GLOBAL = originalEnableV8Global;
  };
  const prefix = `day42iso_${randomUUID().replaceAll('-', '')}`;
  const orgA = randomUUID();
  const orgB = randomUUID();
  const ownerA = randomUUID();
  const ownerB = randomUUID();
  const memberA = randomUUID();
  // FIX-2 / FIX-4 fixtures: every case that must exercise a guard inside the
  // partner router itself gets its own principal, so no case depends on the
  // side effect of another one and file order cannot change the verdict.
  const crossTenantUser = randomUUID();
  const unboundPartnerUser = randomUUID();
  const revokedUser = randomUUID();
  const cacheWindowUser = randomUUID();
  const partnerA = randomUUID();
  const partnerB = randomUUID();
  const partnerNull = randomUUID();
  const linkB = randomUUID();
  const transactionA = randomUUID();
  const transactionB = randomUUID();
  const payoutA = randomUUID();
  const payoutB = randomUUID();
  const bSentinel = '987654.32';
  const allUsers = [
    ownerA,
    ownerB,
    memberA,
    crossTenantUser,
    unboundPartnerUser,
    revokedUser,
    cacheWindowUser,
  ];
  const allPartners = [partnerA, partnerB, partnerNull];
  /** The five economic read surfaces named by the duty scenario N5/N6. */
  const MONEY_READS = [
    '/api/v8/partner/program/ledger',
    '/api/v8/partner/earnings-summary',
    '/api/v8/partner/commission-transactions',
    '/api/v8/partner/payouts',
    '/api/v8/partner/payout-settings',
  ];

  const token = (userId: string, organizationId: string, role: string) =>
    jwt.sign({ id: userId, email: `${userId}@day42.local`, organizationId, role }, JWT_SECRET, {
      expiresIn: '1h',
    });

  const auth = (userId: string, organizationId: string, role = 'OWNER') => ({
    Authorization: `Bearer ${token(userId, organizationId, role)}`,
    'x-org-context': organizationId,
  });

  const coldRows = async (query: string, params: unknown[] = []) => {
    const cold = new Client({ connectionString: DATABASE_URL });
    await cold.connect();
    try {
      return (await cold.query(query, params)).rows;
    } finally {
      await cold.end();
    }
  };

  const financialSnapshot = () =>
    coldRows(
      `SELECT 'ledger' AS kind, id::text, partner_org_id::text, amount::text AS value
         FROM partner_program_ledger WHERE partner_org_id::text = ANY($1::text[])
       UNION ALL
       SELECT 'commission', id::text, partner_org_id::text, commission_amount::text
         FROM partner_commission_transactions WHERE partner_org_id::text = ANY($1::text[])
       UNION ALL
       SELECT 'payout', id::text, partner_org_id::text, net_amount::text
         FROM partner_payouts WHERE partner_org_id::text = ANY($1::text[])
       ORDER BY kind, id`,
      [[partnerA, partnerB]]
    );

  beforeAll(async () => {
    process.env.ENABLE_V8_GLOBAL = 'true';
    process.env.PARTNER_ACCRUAL_POLICY_JSON = JSON.stringify({
      status: 'APPROVED',
      version: 'day42-isolation',
      baseCurrency: 'EUR',
      commissionRateBps: 1000,
      payoutFeeBps: 0,
      minimumPayoutMinor: 10000,
    });
    sql = new Client({ connectionString: DATABASE_URL });
    await sql.connect();
    // Z31 detektor 2026-08-31: redundant inner pin to the literal 'cx_day42'
    // name removed (duplicated the outer RUN gate). Only require a real name.
    const target = await sql.query<{ name: string }>('SELECT current_database() AS name');
    if (!target.rows[0]?.name) {
      throw new Error('DAY42_NO_REAL_DATABASE');
    }
    // FIX-7: survive destructive neighbours in a whole-directory run.
    await assertDay42Preconditions(sql);
    await restoreDay42FixtureColumns(sql);

    await sql.query(
      `INSERT INTO organizations (id, name, plan, status)
       VALUES ($1, $2, 'enterprise', 'active'), ($3, $4, 'enterprise', 'active')`,
      [orgA, `${prefix}_org_a`, orgB, `${prefix}_org_b`]
    );
    for (const [userId, organizationId, role] of [
      [ownerA, orgA, 'OWNER'],
      [ownerB, orgB, 'OWNER'],
      [memberA, orgA, 'MEMBER'],
      [crossTenantUser, orgA, 'OWNER'],
      [unboundPartnerUser, orgA, 'OWNER'],
      [revokedUser, orgA, 'OWNER'],
      [cacheWindowUser, orgA, 'OWNER'],
    ]) {
      await sql.query(
        `INSERT INTO users (id, organization_id, email, password, role, status)
         VALUES ($1, $2, $3, 'x', $4, 'active')`,
        [userId, organizationId, `${userId}@day42.local`, role]
      );
      await sql.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, $4, 'ACTIVE')`,
        [`${prefix}_${userId}`, organizationId, userId, role]
      );
    }
    await sql.query(
      `INSERT INTO partner_organizations
         (id, name, contact_email, contact_phone, website, status, owner_organization_id)
       VALUES ($1, 'Partner A', 'a@day42.local', 'A-BEFORE', 'https://a.before', 'active', $2),
              ($3, 'Partner B', 'b@day42.local', 'B-IMMUTABLE', 'https://b.immutable', 'active', $4),
              ($5, 'Partner NULL', 'n@day42.local', 'N-IMMUTABLE', 'https://n.immutable', 'active', NULL)`,
      [partnerA, orgA, partnerB, orgB, partnerNull]
    );
    await sql.query(
      `INSERT INTO partner_users (partner_org_id, user_id, role, status)
       VALUES ($1, $2, 'owner', 'active'), ($1, $3, 'member', 'active'),
              ($1, $6, 'owner', 'active'), ($1, $7, 'owner', 'active'),
              ($4, $5, 'owner', 'active'), ($4, $8, 'owner', 'active'),
              ($9, $10, 'owner', 'active')`,
      [
        partnerA,
        ownerA,
        memberA,
        partnerB,
        ownerB,
        revokedUser,
        cacheWindowUser,
        crossTenantUser,
        partnerNull,
        unboundPartnerUser,
      ]
    );
    await sql.query(
      `INSERT INTO partner_campaign_links (id, partner_org_id, name, slug, destination_url)
       VALUES ($1, $2, 'B private link', $3, '/b-private')`,
      [linkB, partnerB, `${prefix}_b_link`]
    );
    await sql.query(
      `INSERT INTO partner_commission_transactions
         (id, partner_org_id, organization_id, transaction_type, transaction_date,
          gross_amount, commission_rate, commission_amount, currency, status, notes)
       VALUES ($1, $2, $3, 'BONUS', NOW(), 123.40, 10, 12.34, 'EUR', 'APPROVED', 'A_ONLY'),
              ($4, $5, $6, 'BONUS', NOW(), $7, 100, $7, 'EUR', 'APPROVED', 'B_FINANCIAL_SENTINEL')`,
      [transactionA, partnerA, orgA, transactionB, partnerB, orgB, bSentinel]
    );
    await sql.query(
      `INSERT INTO partner_payouts
         (id, partner_org_id, payout_period_start, payout_period_end, gross_amount,
          fees, net_amount, currency, status, notes)
       VALUES ($1, $2, CURRENT_DATE - 2, CURRENT_DATE - 1, 12.34, 0, 12.34, 'EUR', 'PENDING', 'A_ONLY'),
              ($3, $4, CURRENT_DATE - 2, CURRENT_DATE - 1, $5, 0, $5, 'EUR', 'PENDING', 'B_FINANCIAL_SENTINEL')`,
      [payoutA, partnerA, payoutB, partnerB, bSentinel]
    );

    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  });

  afterAll(async () => {
    delete process.env.PARTNER_ACCRUAL_POLICY_JSON;
    restoreEnableV8Global();
    if (!sql) return;
    await sql.query('DELETE FROM partner_payouts WHERE partner_org_id::text = ANY($1::text[])', [
      allPartners,
    ]);
    await sql.query(
      'DELETE FROM partner_commission_transactions WHERE partner_org_id::text = ANY($1::text[])',
      [allPartners]
    );
    await sql.query(
      'DELETE FROM partner_program_ledger WHERE partner_org_id::text = ANY($1::text[])',
      [allPartners]
    );
    await sql.query(
      'DELETE FROM partner_program_runtime WHERE partner_org_id::text = ANY($1::text[])',
      [allPartners]
    );
    await sql.query(
      'DELETE FROM partner_campaign_links WHERE partner_org_id::text = ANY($1::text[])',
      [allPartners]
    );
    await sql.query('DELETE FROM partner_users WHERE user_id::text = ANY($1::text[])', [allUsers]);
    await sql.query('DELETE FROM partner_organizations WHERE id::text = ANY($1::text[])', [
      allPartners,
    ]);
    await sql.query('DELETE FROM organization_members WHERE id LIKE $1', [`${prefix}%`]);
    await sql.query('DELETE FROM users WHERE id::text = ANY($1::text[])', [allUsers]);
    await sql.query('DELETE FROM organizations WHERE id::text = ANY($1::text[])', [[orgA, orgB]]);
    await sql.end();
  });

  it('N1 returns 404 for deleting B link as A and leaves the foreign row unchanged', async () => {
    const before = await coldRows('SELECT * FROM partner_campaign_links WHERE id = $1', [linkB]);
    const response = await request(app)
      .delete(`/api/v8/partner/campaign-links/${linkB}`)
      .set(auth(ownerA, orgA));
    expect(response.status).toBe(404);
    expect(await coldRows('SELECT * FROM partner_campaign_links WHERE id = $1', [linkB])).toEqual(
      before
    );
  });

  it('N2 rejects an A token with a B tenant header and discloses no B earnings', async () => {
    const response = await request(app)
      .get('/api/v8/partner/earnings-summary')
      .set('Authorization', `Bearer ${token(ownerA, orgA, 'OWNER')}`)
      .set('x-org-context', orgB);
    // FIX-3: `not.toBe(200)` also accepted a 500, i.e. a crash would have been
    // scored as working isolation. The refusal is `requireExactPartnerTenantContext`
    // (server/src/routes/v8/partner.routes.ts:103-106), so the exact contract is
    // asserted here.
    expect({ status: response.status, code: response.body?.code }).toEqual({
      status: 403,
      code: 'ORG_MEMBERSHIP_REVOKED',
    });
    expect(JSON.stringify(response.body)).not.toContain(bSentinel);
    expect(JSON.stringify(response.body)).not.toContain(partnerB);
  });

  it('N3 ignores a foreign organizationId in the body, updates A, and leaves B bit-identical', async () => {
    const beforeB = await coldRows('SELECT * FROM partner_organizations WHERE id = $1', [partnerB]);
    const response = await request(app)
      .put('/api/v8/partner/organization')
      .set(auth(ownerA, orgA))
      .send({ organizationId: orgB, contactPhone: 'A-AFTER', website: 'https://a.after' });
    expect(response.status).toBe(200);
    const afterA = await coldRows(
      'SELECT contact_phone, website FROM partner_organizations WHERE id = $1',
      [partnerA]
    );
    expect(afterA).toEqual([{ contact_phone: 'A-AFTER', website: 'https://a.after' }]);
    expect(await coldRows('SELECT * FROM partner_organizations WHERE id = $1', [partnerB])).toEqual(
      beforeB
    );
  });

  it('N4 rejects foreign header plus foreign body with zero mutation in A or B', async () => {
    const before = await coldRows(
      'SELECT * FROM partner_organizations WHERE id::text = ANY($1::text[]) ORDER BY id',
      [[partnerA, partnerB]]
    );
    const response = await request(app)
      .put('/api/v8/partner/organization')
      .set('Authorization', `Bearer ${token(ownerA, orgA, 'OWNER')}`)
      .set('x-org-context', orgB)
      .send({ organizationId: orgB, contactPhone: 'FORBIDDEN' });
    // FIX-3: exact refusal, not merely "anything but 200".
    expect({ status: response.status, code: response.body?.code }).toEqual({
      status: 403,
      code: 'ORG_MEMBERSHIP_REVOKED',
    });
    expect(
      await coldRows(
        'SELECT * FROM partner_organizations WHERE id::text = ANY($1::text[]) ORDER BY id',
        [[partnerA, partnerB]]
      )
    ).toEqual(before);
  });

  it('N5 keeps every V8 money read scoped to A and excludes B identifiers and sentinel amounts', async () => {
    for (const path of MONEY_READS) {
      const response = await request(app).get(path).set(auth(ownerA, orgA));
      expect(response.status, `${path} ${JSON.stringify(response.body)}`).toBe(200);
      const body = JSON.stringify(response.body);
      expect(body, path).not.toContain(partnerB);
      expect(body, path).not.toContain(transactionB);
      expect(body, path).not.toContain(payoutB);
      expect(body, path).not.toContain(bSentinel);
    }
  });

  /**
   * FIX-3/FIX-4 — this case DOES bite the partner router: `memberA` has a live
   * ACTIVE membership, so every upstream membership wall passes and the only
   * thing left is `requirePartnerEconomicsReadAccess`
   * (`requireOrgRole('admin')`, server/src/routes/v8/partner.routes.ts:272).
   * Asserting the exact RBAC code is what makes deleting that array red.
   */
  it('denies MEMBER access to every money read through the partner router RBAC guard', async () => {
    const before = await financialSnapshot();
    for (const path of MONEY_READS) {
      const response = await request(app)
        .get(path)
        .set(auth(memberA, orgA, 'MEMBER'));
      expect({ path, status: response.status, code: response.body?.code }).toEqual({
        path,
        status: 403,
        code: 'RBAC_INSUFFICIENT_ROLE',
      });
    }
    expect(await financialSnapshot()).toEqual(before);
  });

  it('N7 records the actual legacy earnings result without exposing B data', async () => {
    const response = await request(app).get('/api/partners/earnings').set(auth(ownerA, orgA));
    expect(response.status).toBe(200);
    expect(response.headers.deprecation).toBe('true');
    expect(response.body.success).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain(partnerB);
    expect(JSON.stringify(response.body)).not.toContain(bSentinel);
  });

  /**
   * FIX-2 — the tenant-to-partner binding itself.
   *
   * Until now nothing in this file exercised
   * `server/src/services/partnerOrgResolution.ts:117`
   * (`WHERE po.owner_organization_id = ?`): every principal was bound to the
   * partner organization owned by its own tenant, so neutralising that
   * predicate changed no observable behaviour. These two cases are the missing
   * half — a user whose partner membership points at a partner organization
   * owned by a FOREIGN tenant, and the historical `owner_organization_id IS NULL`
   * row that `partner.routes.ts:136-138` explicitly says must not pass.
   */
  it('B1 refuses a caller whose partner membership belongs to a partner org owned by another tenant', async () => {
    const beforeB = await coldRows('SELECT * FROM partner_organizations WHERE id = $1', [partnerB]);

    const clients = await request(app)
      .get('/api/v8/partner/clients')
      .set(auth(crossTenantUser, orgA));
    expect({ status: clients.status, code: clients.body?.code }).toEqual({
      status: 403,
      code: 'PARTNER_ORG_REQUIRED',
    });
    expect(JSON.stringify(clients.body)).not.toContain(partnerB);

    for (const path of MONEY_READS) {
      const money = await request(app).get(path).set(auth(crossTenantUser, orgA));
      expect({ path, status: money.status, code: money.body?.code }).toEqual({
        path,
        status: 403,
        code: 'PARTNER_ORG_REQUIRED',
      });
      expect(JSON.stringify(money.body), path).not.toContain(bSentinel);
    }

    const write = await request(app)
      .put('/api/v8/partner/organization')
      .set(auth(crossTenantUser, orgA))
      .send({ contactPhone: 'CROSS-TENANT-FORBIDDEN', website: 'https://cross.forbidden' });
    expect({ status: write.status, code: write.body?.code }).toEqual({
      status: 403,
      code: 'PARTNER_ORG_REQUIRED',
    });
    expect(await coldRows('SELECT * FROM partner_organizations WHERE id = $1', [partnerB])).toEqual(
      beforeB
    );
  });

  it('B2 refuses a caller bound to a historical partner org whose owner_organization_id is NULL', async () => {
    const beforeNull = await coldRows('SELECT * FROM partner_organizations WHERE id = $1', [
      partnerNull,
    ]);
    expect(beforeNull[0].owner_organization_id).toBeNull();

    const clients = await request(app)
      .get('/api/v8/partner/clients')
      .set(auth(unboundPartnerUser, orgA));
    expect({ status: clients.status, code: clients.body?.code }).toEqual({
      status: 403,
      code: 'PARTNER_ORG_REQUIRED',
    });
    expect(JSON.stringify(clients.body)).not.toContain(partnerNull);

    const write = await request(app)
      .put('/api/v8/partner/organization')
      .set(auth(unboundPartnerUser, orgA))
      .send({ contactPhone: 'NULL-OWNER-FORBIDDEN', website: 'https://null.forbidden' });
    expect({ status: write.status, code: write.body?.code }).toEqual({
      status: 403,
      code: 'PARTNER_ORG_REQUIRED',
    });
    expect(
      await coldRows('SELECT * FROM partner_organizations WHERE id = $1', [partnerNull])
    ).toEqual(beforeNull);
  });

  /**
   * FIX-4 — the partner router's OWN membership wall.
   *
   * `validateOrgMembership` re-reads membership on every request. This case
   * warms the route with a legitimate 200 read, revokes membership, and reads
   * again immediately, proving there is no stale upstream positive verdict.
   * Measured on this branch:
   * removing BOTH partner-router membership walls (`partner.routes.ts:213` and
   * `:272`) makes these five reads answer 200 — this case is red exactly then.
   * The refusal body is `{ success:false, code }` with no `error` field, which
   * identifies `requireActiveMembership`
   * (server/src/services/legacyCutover/requireActiveMembership.ts:35) as the
   * responder rather than the platform gate (`{ error, code }`).
   */
  it('N6b denies money reads inside the upstream membership-cache window, from the partner router itself', async () => {
    const before = await financialSnapshot();
    const warm = await request(app)
      .get('/api/v8/partner/earnings-summary')
      .set(auth(cacheWindowUser, orgA));
    expect(warm.status).toBe(200);

    await sql.query(
      `UPDATE organization_members SET status = 'INACTIVE'
       WHERE organization_id = $1 AND user_id = $2`,
      [orgA, cacheWindowUser]
    );

    for (const path of MONEY_READS) {
      const response = await request(app).get(path).set(auth(cacheWindowUser, orgA));
      expect({ path, status: response.status, code: response.body?.code }).toEqual({
        path,
        status: 403,
        code: 'ORG_MEMBERSHIP_REVOKED',
      });
      expect(response.body.error, path).toBeUndefined();
      expect(response.body.success, path).toBe(false);
      expect(JSON.stringify(response.body), path).not.toContain(bSentinel);
    }
    expect(await financialSnapshot()).toEqual(before);
  });

  /**
   * FIX-4 — renamed to what it actually proves, after measuring the layer.
   *
   * The old name implied this case pinned the partner router's guard. It does
   * not pin any single mount, because the wall is deliberately redundant:
   * `requireActiveMembership` sits BOTH on the catch-all
   * `router.use(/^(?!\/(?:connect|connection)\/?$)/, ...)`
   * (server/src/routes/v8/partner.routes.ts:213) AND on the economic-read array
   * (`partner.routes.ts:272`). Measured mutationally on this branch:
   *   - deleting only `requirePartnerEconomicsReadAccess` (:272) -> this case stays green
   *     (the MEMBER case above turns red, because only :272 carries the role check);
   *   - deleting only the catch-all's `requireActiveMembership` (:213) -> stays green;
   *   - deleting BOTH -> every money read answers 200 with the revoked membership,
   *     and this case, N6b and the MEMBER case all turn red.
   *
   * The refusal body is `{ success:false, code }` with NO `error` field, i.e. it
   * comes from `requireActiveMembership`
   * (server/src/services/legacyCutover/requireActiveMembership.ts:35) inside the
   * partner router — NOT from `validateOrgMembership`
   * (server/src/middleware/auth.middleware.ts:1740-1747), whose body is
   * `{ error, code }`. Asserting the body shape is what keeps that attribution
   * honest.
   *
   * FINDING FOR DUTY 37 (organization-context gate): with both partner-router
   * walls removed the money reads answer 200 for a revoked membership, so no
   * platform-level organization-context gate covers `/api/v8/partner`. The whole
   * guarantee rests on this router's own middleware.
   *
   * Uses its own principal so that revoking a membership cannot poison any other
   * case in this file regardless of execution order.
   */
  it('N6 denies all five money reads after revocation, from the partner router membership wall', async () => {
    const before = await financialSnapshot();
    await sql.query(
      `UPDATE organization_members SET status = 'INACTIVE'
       WHERE organization_id = $1 AND user_id = $2`,
      [orgA, revokedUser]
    );
    for (const path of MONEY_READS) {
      const response = await request(app).get(path).set(auth(revokedUser, orgA));
      expect({ path, status: response.status, code: response.body?.code }).toEqual({
        path,
        status: 403,
        code: 'ORG_MEMBERSHIP_REVOKED',
      });
      expect(response.body.success, path).toBe(false);
      expect(response.body.error, path).toBeUndefined();
      expect(JSON.stringify(response.body), path).not.toContain(bSentinel);
    }
    expect(await financialSnapshot()).toEqual(before);
  });
});
