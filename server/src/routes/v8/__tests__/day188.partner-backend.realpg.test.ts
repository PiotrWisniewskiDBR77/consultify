/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import { ApiGateway } from '../../../Gateway.js';

const NO_RETRY = { retry: 0 } as const;
const databaseUrl = process.env.DATABASE_URL ?? '';
const jwtSecret = process.env.JWT_SECRET ?? '';

describe('Day 188 Partner backend through real ApiGateway and PostgreSQL', NO_RETRY, () => {
  const tenantOrgId = randomUUID();
  const customerOrgId = randomUUID();
  const userId = randomUUID();
  const partnerOrgId = randomUUID();
  const projectId = `day188-project-${randomUUID()}`;
  const attributionId = randomUUID();
  const app = express();
  const sql = new Client({ connectionString: databaseUrl });
  let authorization = '';

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    const proof = await assertRealPostgresTestEnvironment();
    expect(proof.host).toBe('127.0.0.1');
    expect(proof.port).toBe('6108');
    expect(proof.database).toBe('cx188');
    expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBe('false');

    await sql.connect();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);

    await sql.query(
      `INSERT INTO organizations(id, name, status) VALUES($1, 'Day 188 tenant', 'active'), ($2, 'Day 188 customer', 'active')`,
      [tenantOrgId, customerOrgId]
    );
    await sql.query(
      `INSERT INTO users(id, organization_id, email, password, role, status, email_verified)
       VALUES($1, $2, $3, 'unused', 'OWNER', 'active', 1)`,
      [userId, tenantOrgId, `day188-${userId}@test.invalid`]
    );
    await sql.query(
      `INSERT INTO organization_members(id, organization_id, user_id, role, status)
       VALUES($1, $2, $3, 'OWNER', 'ACTIVE')`,
      [randomUUID(), tenantOrgId, userId]
    );
    await sql.query(
      `INSERT INTO partner_organizations(id, name, contact_email, status, owner_organization_id, created_by)
       VALUES($1, 'Day 188 partner', $2, 'active', $3, $4)`,
      [partnerOrgId, `partner-${partnerOrgId}@test.invalid`, tenantOrgId, userId]
    );
    await sql.query(
      `INSERT INTO partner_users(id, partner_org_id, user_id, role, status)
       VALUES($1, $2, $3, 'owner', 'active')`,
      [randomUUID(), partnerOrgId, userId]
    );
    await sql.query(
      `INSERT INTO projects(id, organization_id, name, status)
       VALUES($1, $2, 'Day 188 attributed project', 'active')`,
      [projectId, customerOrgId]
    );
    await sql.query(
      `INSERT INTO partner_attributions
         (id, partner_org_id, organization_id, attribution_type, commission_rate_percent, status)
       VALUES($1, $2, $3, 'REFERRAL', 10, 'ACTIVE')`,
      [attributionId, partnerOrgId, customerOrgId]
    );

    authorization = `Bearer ${jwt.sign(
      {
        id: userId,
        userId,
        organizationId: tenantOrgId,
        organization_id: tenantOrgId,
        role: 'OWNER',
      },
      jwtSecret,
      { algorithm: 'HS256', expiresIn: '10m', jwtid: randomUUID() }
    )}`;
  }, 30_000);

  afterAll(async () => {
    delete process.env.PARTNER_ACCRUAL_POLICY_JSON;
    await sql.query(
      `DO $$ BEGIN
         IF EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name='projects' AND column_name='organization_id_day188_unavailable'
         ) THEN
           ALTER TABLE projects RENAME COLUMN organization_id_day188_unavailable TO organization_id;
         END IF;
       END $$`
    );
    await sql.query(`DELETE FROM partner_attributions WHERE id=$1`, [attributionId]);
    await sql.query(`DELETE FROM projects WHERE id=$1`, [projectId]);
    await sql.query(`DELETE FROM partner_users WHERE partner_org_id=$1`, [partnerOrgId]);
    await sql.query(`DELETE FROM partner_organizations WHERE id=$1`, [partnerOrgId]);
    await sql.query(`DELETE FROM organization_members WHERE organization_id=$1`, [tenantOrgId]);
    await sql.query(`DELETE FROM users WHERE id=$1`, [userId]);
    await sql.query(`DELETE FROM organizations WHERE id=ANY($1)`, [[tenantOrgId, customerOrgId]]);
    await sql.end();
    const pgModule = await import('../../../database/PostgresDatabase.js');
    await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
  });

  const authenticatedGet = (path: string) =>
    request(app).get(path).set('Authorization', authorization).set('x-org-context', tenantOrgId);

  it('returns 200 and an explicit policy state when accrual policy is absent', async () => {
    delete process.env.PARTNER_ACCRUAL_POLICY_JSON;

    const response = await authenticatedGet('/api/v8/partner/earnings-summary');

    expect(response.status).toBe(200);
    expect(response.body.data.earnings.payoutEligibility).toEqual({
      eligible: false,
      eligibleGross: null,
      eligibleNet: null,
      minimumThreshold: null,
      currency: null,
      reason: 'POLICY_NOT_APPROVED',
    });
  });

  it('preserves the approved-policy payout eligibility path', async () => {
    process.env.PARTNER_ACCRUAL_POLICY_JSON = JSON.stringify({
      status: 'APPROVED',
      version: 'day188-v1',
      baseCurrency: 'EUR',
      commissionRateBps: 1000,
      payoutFeeBps: 100,
      minimumPayoutMinor: 10_000,
    });

    const response = await authenticatedGet('/api/v8/partner/earnings-summary');

    expect(response.status).toBe(200);
    expect(response.body.data.earnings.payoutEligibility).toEqual({
      eligible: false,
      eligibleGross: 0,
      eligibleNet: 0,
      minimumThreshold: 100,
      currency: 'EUR',
      reason: 'NO_APPROVED_COMMISSIONS',
    });
    delete process.env.PARTNER_ACCRUAL_POLICY_JSON;
  });

  it('returns the project linked through UUID attribution to TEXT project organization', async () => {
    const response = await authenticatedGet('/api/v8/partner/projects');

    expect(response.status).toBe(200);
    expect(response.body.data.projects).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: projectId, clientId: customerOrgId })])
    );
  });

  it('keeps a genuine no-attribution result distinct as an empty list', async () => {
    await sql.query(`DELETE FROM partner_attributions WHERE id=$1`, [attributionId]);
    try {
      const response = await authenticatedGet('/api/v8/partner/projects');
      expect(response.status).toBe(200);
      expect(response.body.data.projects).toEqual([]);
    } finally {
      await sql.query(
        `INSERT INTO partner_attributions
           (id, partner_org_id, organization_id, attribution_type, commission_rate_percent, status)
         VALUES($1, $2, $3, 'REFERRAL', 10, 'ACTIVE')`,
        [attributionId, partnerOrgId, customerOrgId]
      );
    }
  });

  it('does not disguise an unrelated projects query failure as an empty list', async () => {
    await sql.query(
      `ALTER TABLE projects RENAME COLUMN organization_id TO organization_id_day188_unavailable`
    );
    try {
      const response = await authenticatedGet('/api/v8/partner/projects');
      expect(response.status).toBe(500);
      expect(response.body.data?.projects).not.toEqual([]);
    } finally {
      await sql.query(
        `ALTER TABLE projects RENAME COLUMN organization_id_day188_unavailable TO organization_id`
      );
    }
  });
});
