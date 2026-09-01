/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import logger from '../../utils/Logger.js';
import { getPartnerClients } from '../partnerReferralService.js';

const NO_RETRY = { retry: 0 } as const;
const databaseUrl = process.env.DATABASE_URL ?? '';

describe('Day 224 Partner client user counts on real PostgreSQL', NO_RETRY, () => {
  const ownerOrgId = randomUUID();
  const customerOrgId = randomUUID();
  const ownerUserId = randomUUID();
  const customerUserId = randomUUID();
  const partnerOrgId = randomUUID();
  const attributionId = randomUUID();
  const sql = new Client({ connectionString: databaseUrl });

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    const proof = await assertRealPostgresTestEnvironment();
    expect(proof.host).toBe('127.0.0.1');
    expect(Number(proof.port)).toBeGreaterThan(0);
    expect(proof.database.length).toBeGreaterThan(0);

    await sql.connect();
    await sql.query(
      `INSERT INTO organizations(id, name, status)
       VALUES($1, 'Day 224 owner', 'active'), ($2, 'Day 224 customer', 'active')`,
      [ownerOrgId, customerOrgId]
    );
    await sql.query(
      `INSERT INTO users(id, organization_id, email, password, role, status, email_verified)
       VALUES($1, $2, $3, 'unused', 'OWNER', 'active', 1),
             ($4, $5, $6, 'unused', 'USER', 'active', 1)`,
      [
        ownerUserId,
        ownerOrgId,
        `day224-owner-${ownerUserId}@test.invalid`,
        customerUserId,
        customerOrgId,
        `day224-customer-${customerUserId}@test.invalid`,
      ]
    );
    await sql.query(
      `INSERT INTO partner_organizations(id, name, contact_email, status, owner_organization_id, created_by)
       VALUES($1, 'Day 224 partner', $2, 'active', $3, $4)`,
      [partnerOrgId, `day224-partner-${partnerOrgId}@test.invalid`, ownerOrgId, ownerUserId]
    );
    await sql.query(
      `INSERT INTO partner_attributions
         (id, partner_org_id, organization_id, attribution_type, commission_rate_percent, status)
       VALUES($1, $2, $3, 'REFERRAL', 0, 'ACTIVE')`,
      [attributionId, partnerOrgId, customerOrgId]
    );
  }, 30_000);

  afterAll(async () => {
    await sql.query(`DELETE FROM partner_attributions WHERE id=$1`, [attributionId]);
    await sql.query(`DELETE FROM partner_organizations WHERE id=$1`, [partnerOrgId]);
    await sql.query(`DELETE FROM users WHERE id=ANY($1)`, [[ownerUserId, customerUserId]]);
    await sql.query(`DELETE FROM organizations WHERE id=ANY($1)`, [[ownerOrgId, customerOrgId]]);
    await sql.end();
    const pgModule = await import('../../database/PostgresDatabase.js');
    await (pgModule as unknown as { closePool?: () => Promise<void> }).closePool?.();
  });

  it('returns the real users COUNT without falling back through the warning path', async () => {
    const warn = vi.spyOn(logger, 'warn');
    const clients = await getPartnerClients(partnerOrgId);
    const customer = clients.find((client) => client.organizationId === customerOrgId);

    expect(customer).toMatchObject({ users: 1, userCount: 1 });
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining('getPartnerClients user counts failed'),
      expect.anything()
    );
    warn.mockRestore();
  });
});
