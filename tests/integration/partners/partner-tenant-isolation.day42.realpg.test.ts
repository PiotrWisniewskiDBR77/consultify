import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiGateway } from '../../../server/src/Gateway.js';

const DATABASE_URL = String(process.env.DATABASE_URL || '');
const RUN =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.includes('/cx_day42');
const describeReal = RUN ? describe : describe.skip;
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-min-32-chars-long-for-validation';

describeReal('Day 42 Partner tenant isolation through the real ApiGateway', () => {
  let sql: Client;
  let app: Express;
  const prefix = `day42iso_${randomUUID().replaceAll('-', '')}`;
  const orgA = randomUUID();
  const orgB = randomUUID();
  const ownerA = randomUUID();
  const ownerB = randomUUID();
  const memberA = randomUUID();
  const partnerA = randomUUID();
  const partnerB = randomUUID();
  const linkB = randomUUID();
  const transactionA = randomUUID();
  const transactionB = randomUUID();
  const payoutA = randomUUID();
  const payoutB = randomUUID();
  const bSentinel = '987654.32';

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
         FROM partner_program_ledger WHERE partner_org_id = ANY($1::text[])
       UNION ALL
       SELECT 'commission', id::text, partner_org_id::text, commission_amount::text
         FROM partner_commission_transactions WHERE partner_org_id = ANY($1::uuid[])
       UNION ALL
       SELECT 'payout', id::text, partner_org_id::text, net_amount::text
         FROM partner_payouts WHERE partner_org_id = ANY($1::uuid[])
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
    const target = await sql.query<{ name: string }>('SELECT current_database() AS name');
    if (target.rows[0]?.name !== 'cx_day42') {
      throw new Error(`DAY42_REFUSING_DATABASE:${target.rows[0]?.name || 'unknown'}`);
    }

    await sql.query(
      `INSERT INTO organizations (id, name, plan, status)
       VALUES ($1, $2, 'enterprise', 'active'), ($3, $4, 'enterprise', 'active')`,
      [orgA, `${prefix}_org_a`, orgB, `${prefix}_org_b`]
    );
    for (const [userId, organizationId, role] of [
      [ownerA, orgA, 'OWNER'],
      [ownerB, orgB, 'OWNER'],
      [memberA, orgA, 'MEMBER'],
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
              ($3, 'Partner B', 'b@day42.local', 'B-IMMUTABLE', 'https://b.immutable', 'active', $4)`,
      [partnerA, orgA, partnerB, orgB]
    );
    await sql.query(
      `INSERT INTO partner_users (partner_org_id, user_id, role, status)
       VALUES ($1, $2, 'owner', 'active'), ($1, $3, 'member', 'active'),
              ($4, $5, 'owner', 'active')`,
      [partnerA, ownerA, memberA, partnerB, ownerB]
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
    if (!sql) return;
    await sql.query('DELETE FROM partner_payouts WHERE partner_org_id = ANY($1::uuid[])', [
      [partnerA, partnerB],
    ]);
    await sql.query(
      'DELETE FROM partner_commission_transactions WHERE partner_org_id = ANY($1::uuid[])',
      [[partnerA, partnerB]]
    );
    await sql.query('DELETE FROM partner_program_ledger WHERE partner_org_id = ANY($1::text[])', [
      [partnerA, partnerB],
    ]);
    await sql.query('DELETE FROM partner_program_runtime WHERE partner_org_id = ANY($1::text[])', [
      [partnerA, partnerB],
    ]);
    await sql.query('DELETE FROM partner_campaign_links WHERE partner_org_id = ANY($1::uuid[])', [
      [partnerA, partnerB],
    ]);
    await sql.query('DELETE FROM partner_users WHERE user_id = ANY($1::uuid[])', [
      [ownerA, ownerB, memberA],
    ]);
    await sql.query('DELETE FROM partner_organizations WHERE id = ANY($1::uuid[])', [
      [partnerA, partnerB],
    ]);
    await sql.query('DELETE FROM organization_members WHERE id LIKE $1', [`${prefix}%`]);
    await sql.query('DELETE FROM users WHERE id = ANY($1::text[])', [[ownerA, ownerB, memberA]]);
    await sql.query('DELETE FROM organizations WHERE id = ANY($1::text[])', [[orgA, orgB]]);
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
    expect(response.status).not.toBe(200);
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
      'SELECT * FROM partner_organizations WHERE id = ANY($1::uuid[]) ORDER BY id',
      [[partnerA, partnerB]]
    );
    const response = await request(app)
      .put('/api/v8/partner/organization')
      .set('Authorization', `Bearer ${token(ownerA, orgA, 'OWNER')}`)
      .set('x-org-context', orgB)
      .send({ organizationId: orgB, contactPhone: 'FORBIDDEN' });
    expect(response.status).not.toBe(200);
    expect(
      await coldRows('SELECT * FROM partner_organizations WHERE id = ANY($1::uuid[]) ORDER BY id', [
        [partnerA, partnerB],
      ])
    ).toEqual(before);
  });

  it('N5 keeps every V8 money read scoped to A and excludes B identifiers and sentinel amounts', async () => {
    for (const path of [
      '/api/v8/partner/program/ledger',
      '/api/v8/partner/earnings-summary',
      '/api/v8/partner/commission-transactions',
      '/api/v8/partner/payouts',
      '/api/v8/partner/payout-settings',
    ]) {
      const response = await request(app).get(path).set(auth(ownerA, orgA));
      expect(response.status, `${path} ${JSON.stringify(response.body)}`).toBe(200);
      const body = JSON.stringify(response.body);
      expect(body, path).not.toContain(partnerB);
      expect(body, path).not.toContain(transactionB);
      expect(body, path).not.toContain(payoutB);
      expect(body, path).not.toContain(bSentinel);
    }
  });

  it('denies MEMBER access to every money read and leaves all financial rows unchanged', async () => {
    const before = await financialSnapshot();
    for (const path of [
      '/api/v8/partner/program/ledger',
      '/api/v8/partner/earnings-summary',
      '/api/v8/partner/commission-transactions',
      '/api/v8/partner/payouts',
      '/api/v8/partner/payout-settings',
    ]) {
      const response = await request(app)
        .get(path)
        .set(auth(memberA, orgA, 'MEMBER'));
      expect(response.status, path).toBe(403);
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

  it('N6 denies all five money reads after revocation and leaves cold financial readback unchanged', async () => {
    const before = await financialSnapshot();
    await sql.query(
      `UPDATE organization_members SET status = 'INACTIVE'
       WHERE organization_id = $1 AND user_id = $2`,
      [orgA, ownerA]
    );
    for (const path of [
      '/api/v8/partner/program/ledger',
      '/api/v8/partner/earnings-summary',
      '/api/v8/partner/commission-transactions',
      '/api/v8/partner/payouts',
      '/api/v8/partner/payout-settings',
    ]) {
      const response = await request(app).get(path).set(auth(ownerA, orgA));
      expect(response.status, path).toBe(403);
    }
    expect(await financialSnapshot()).toEqual(before);
  });
});
